# -*- coding: utf-8 -*-
{
    'name': 'Consulta de Timbres Finkok',
    'version': '19.0.1.0.0',
    'category': 'Contacts',
    'summary': 'Consulta de consumo de timbres Finkok (report_total) en contactos',
    'description': """
Consulta de Timbres Finkok
==========================

Añade la pestaña Timbres en contactos para configurar RFCs, consultar el
consumo vía SOAP report_total de Finkok, guardar historial y calcular el
porcentaje de uso frente a los timbres vendidos.

Credenciales y entorno (demo/producción) se configuran en Ajustes.

Dependencia opcional: zeep (si no está instalado se usa requests + lxml).
    """,
    'author': 'Dataliza',
    'license': 'LGPL-3',
    'depends': ['base', 'contacts'],
    'data': [
        'security/ir.model.access.csv',
        'wizard/partner_finkok_timbre_wizard_views.xml',
        'views/res_partner_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
