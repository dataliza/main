# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import date, datetime, timezone

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError
from odoo.tools.translate import _

from odoo.addons.partner_finkok_timbres.models.finkok_client import report_total


class PartnerFinkokTimbreWizard(models.TransientModel):
    _name = 'partner.finkok.timbre.wizard'
    _description = 'Consultar timbres Finkok'

    partner_id = fields.Many2one(
        'res.partner',
        string='Contacto',
        required=True,
        default=lambda self: self.env.context.get('active_id'),
    )
    date_from = fields.Date(
        string='Fecha inicio',
        required=True,
        readonly=True,
        default=lambda self: date(fields.Date.context_today(self).year, 1, 1),
    )
    date_to = fields.Date(
        string='Fecha fin',
        required=True,
        default=fields.Date.context_today,
    )

    @api.constrains('date_from', 'date_to')
    def _check_date_range(self):
        for wizard in self:
            if wizard.date_to and wizard.date_from and wizard.date_to < wizard.date_from:
                raise ValidationError(_(
                    'La fecha fin debe ser mayor o igual a la fecha inicio.'
                ))

    def action_consultar(self):
        self.ensure_one()
        partner = self.partner_id
        if not partner.finkok_rfc_ids:
            raise UserError(_(
                'Configure al menos un RFC en la pestaña Timbres antes de consultar.'
            ))

        icp = self.env['ir.config_parameter'].sudo()
        username = icp.get_param('partner_finkok_timbres.username') or ''
        password = icp.get_param('partner_finkok_timbres.password') or ''
        environment = icp.get_param('partner_finkok_timbres.environment') or 'demo'

        date_from_str = f'{self.date_from.isoformat()}T00:00:00'
        date_to_str = f'{self.date_to.isoformat()}T23:59:59'
        query_batch = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')

        History = self.env['partner.finkok.timbre.history']
        errors = []
        created = 0

        for rfc_line in partner.finkok_rfc_ids:
            rfc = rfc_line.rfc
            try:
                result = report_total(
                    username=username,
                    password=password,
                    taxpayer_id=rfc,
                    date_from=date_from_str,
                    date_to=date_to_str,
                    environment=environment,
                    invoice_type='I',
                )
            except UserError as exc:
                errors.append(f'{rfc}: {exc.args[0] if exc.args else str(exc)}')
                continue

            History.create({
                'partner_id': partner.id,
                'rfc': result.get('taxpayer_id') or rfc,
                'total': int(result.get('total') or 0),
                'date_from': self.date_from,
                'date_to': self.date_to,
                'query_batch': query_batch,
            })
            created += 1

        if not created and errors:
            raise UserError(_(
                'No se pudo completar la consulta:\n%s'
            ) % '\n'.join(errors))

        message = _('Consulta de timbres registrada (%s RFC).') % created
        if errors:
            message = _(
                'Consulta parcial (%(ok)s RFC). Errores:\n%(errors)s',
                ok=created,
                errors='\n'.join(errors),
            )

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Timbres Finkok'),
                'message': message,
                'type': 'warning' if errors else 'success',
                'sticky': bool(errors),
                'next': {
                    'type': 'ir.actions.act_window',
                    'res_model': 'res.partner',
                    'res_id': partner.id,
                    'view_mode': 'form',
                    'views': [(False, 'form')],
                    'target': 'current',
                },
            },
        }
