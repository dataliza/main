# -*- coding: utf-8 -*-
"""Cliente SOAP para el método report_total de Finkok (utilerías)."""
from __future__ import annotations

import logging
from typing import Any
from xml.sax.saxutils import escape

from odoo.exceptions import UserError
from odoo.tools.translate import _

_logger = logging.getLogger(__name__)

WSDL_DEMO = 'https://demo-facturacion.finkok.com/servicios/soap/utilities.wsdl'
WSDL_PROD = 'https://facturacion.finkok.com/servicios/soap/utilities.wsdl'
ENDPOINT_DEMO = 'https://demo-facturacion.finkok.com/servicios/soap/utilities'
ENDPOINT_PROD = 'https://facturacion.finkok.com/servicios/soap/utilities'
NS_UTIL = 'http://facturacion.finkok.com/utilities'
NS_CORE = 'apps.services.soap.core.views'


def get_finkok_urls(environment: str) -> tuple[str, str]:
    """Devuelve (wsdl, endpoint) según el entorno."""
    if environment == 'prod':
        return WSDL_PROD, ENDPOINT_PROD
    return WSDL_DEMO, ENDPOINT_DEMO


def report_total(
    username: str,
    password: str,
    taxpayer_id: str,
    date_from: str,
    date_to: str,
    environment: str = 'demo',
    invoice_type: str = 'I',
) -> dict[str, Any]:
    """Consulta el total de timbres consumidos para un RFC.

    :return: dict con keys ``total`` (int) y ``taxpayer_id`` (str)
    """
    if not username or not password:
        raise UserError(_(
            'Configure el usuario y la contraseña de Finkok en Ajustes '
            'antes de consultar timbres.'
        ))
    if not taxpayer_id:
        raise UserError(_('El RFC a consultar es obligatorio.'))

    wsdl, endpoint = get_finkok_urls(environment)
    try:
        return _report_total_zeep(
            wsdl, username, password, taxpayer_id,
            date_from, date_to, invoice_type,
        )
    except ImportError:
        _logger.info('zeep no disponible; usando cliente SOAP HTTP + lxml')
        return _report_total_http(
            endpoint, username, password, taxpayer_id,
            date_from, date_to, invoice_type,
        )
    except UserError:
        raise
    except Exception as exc:  # noqa: BLE001
        _logger.exception('Error en report_total (zeep); intentando HTTP')
        try:
            return _report_total_http(
                endpoint, username, password, taxpayer_id,
                date_from, date_to, invoice_type,
            )
        except UserError:
            raise
        except Exception as http_exc:  # noqa: BLE001
            _logger.exception('Error en report_total (HTTP)')
            raise UserError(_(
                'No se pudo consultar Finkok: %(error)s',
                error=str(http_exc) or str(exc),
            )) from http_exc


def _report_total_zeep(
    wsdl: str,
    username: str,
    password: str,
    taxpayer_id: str,
    date_from: str,
    date_to: str,
    invoice_type: str,
) -> dict[str, Any]:
    from zeep import Client  # type: ignore[import-untyped]

    client = Client(wsdl=wsdl)
    response = client.service.report_total(
        username, password, taxpayer_id, date_from, date_to, invoice_type,
    )
    return _parse_zeep_result(response, taxpayer_id)


def _parse_zeep_result(response: Any, fallback_rfc: str) -> dict[str, Any]:
    """Normaliza la respuesta zeep (lista o elemento único)."""
    result = getattr(response, 'result', None)
    if result is None and hasattr(response, 'report_totalResult'):
        result = getattr(response.report_totalResult, 'result', None)
    if result is None:
        raise UserError(_('Finkok no devolvió resultado para el RFC %s.') % fallback_rfc)

    report = getattr(result, 'ReportTotal', None)
    if report is None:
        raise UserError(_('Finkok no devolvió ReportTotal para el RFC %s.') % fallback_rfc)

    # zeep puede devolver lista o un solo objeto
    item = report[0] if isinstance(report, (list, tuple)) else report
    if isinstance(report, (list, tuple)) and not report:
        raise UserError(_('Finkok devolvió una lista vacía para el RFC %s.') % fallback_rfc)

    total = int(getattr(item, 'total', 0) or 0)
    rfc = str(getattr(item, 'taxpayer_id', '') or fallback_rfc)
    return {'total': total, 'taxpayer_id': rfc}


def _report_total_http(
    endpoint: str,
    username: str,
    password: str,
    taxpayer_id: str,
    date_from: str,
    date_to: str,
    invoice_type: str,
) -> dict[str, Any]:
    import requests
    from lxml import etree

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
        'xmlns:util="http://facturacion.finkok.com/utilities">'
        '<soapenv:Header/>'
        '<soapenv:Body>'
        '<util:report_total>'
        f'<util:username>{escape(username)}</util:username>'
        f'<util:password>{escape(password)}</util:password>'
        f'<util:taxpayer_id>{escape(taxpayer_id)}</util:taxpayer_id>'
        f'<util:date_from>{escape(date_from)}</util:date_from>'
        f'<util:date_to>{escape(date_to)}</util:date_to>'
        f'<util:invoice_type>{escape(invoice_type)}</util:invoice_type>'
        '</util:report_total>'
        '</soapenv:Body>'
        '</soapenv:Envelope>'
    )
    headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'report_total',
    }
    try:
        resp = requests.post(endpoint, data=body.encode('utf-8'), headers=headers, timeout=60)
    except requests.RequestException as exc:
        raise UserError(_(
            'Error de red al consultar Finkok: %(error)s',
            error=str(exc),
        )) from exc

    if resp.status_code >= 400:
        raise UserError(_(
            'Finkok respondió HTTP %(code)s al consultar el RFC %(rfc)s.',
            code=resp.status_code,
            rfc=taxpayer_id,
        ))

    try:
        root = etree.fromstring(resp.content)
    except etree.XMLSyntaxError as exc:
        raise UserError(_(
            'Respuesta XML inválida de Finkok para el RFC %(rfc)s.',
            rfc=taxpayer_id,
        )) from exc

    # Fault SOAP
    fault = root.find('.//{http://schemas.xmlsoap.org/soap/envelope/}Fault')
    if fault is not None:
        fault_string = fault.findtext('faultstring') or fault.findtext(
            '{http://schemas.xmlsoap.org/soap/envelope/}faultstring'
        ) or etree.tostring(fault, encoding='unicode')
        raise UserError(_(
            'Error SOAP de Finkok: %(error)s',
            error=fault_string,
        ))

    totals = root.findall(f'.//{{{NS_CORE}}}ReportTotal')
    if not totals:
        # Algunos entornos no usan el namespace esperado
        totals = root.xpath('//*[local-name()="ReportTotal"]')
    if not totals:
        raise UserError(_(
            'Finkok no devolvió ReportTotal para el RFC %(rfc)s.',
            rfc=taxpayer_id,
        ))

    node = totals[0]
    total_text = node.findtext(f'{{{NS_CORE}}}total')
    if total_text is None:
        total_el = node.find('.//*[local-name()="total"]')
        total_text = total_el.text if total_el is not None else '0'
    rfc_text = node.findtext(f'{{{NS_CORE}}}taxpayer_id')
    if rfc_text is None:
        rfc_el = node.find('.//*[local-name()="taxpayer_id"]')
        rfc_text = rfc_el.text if rfc_el is not None else taxpayer_id

    return {
        'total': int(total_text or 0),
        'taxpayer_id': str(rfc_text or taxpayer_id),
    }
