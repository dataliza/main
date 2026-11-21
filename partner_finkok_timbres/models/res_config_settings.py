# -*- coding: utf-8 -*-
from __future__ import annotations

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    finkok_username = fields.Char(
        string='Usuario Finkok',
        config_parameter='partner_finkok_timbres.username',
    )
    finkok_password = fields.Char(
        string='Contraseña Finkok',
        config_parameter='partner_finkok_timbres.password',
        password=True,
        groups='base.group_system',
    )
    finkok_environment = fields.Selection(
        selection=[
            ('demo', 'Demo'),
            ('prod', 'Producción'),
        ],
        string='Entorno Finkok',
        config_parameter='partner_finkok_timbres.environment',
        default='demo',
    )
