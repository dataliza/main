# -*- coding: utf-8 -*-
from __future__ import annotations

from odoo import fields, models


class PartnerFinkokTimbreHistory(models.Model):
    _name = 'partner.finkok.timbre.history'
    _description = 'Historial de consultas de timbres Finkok'
    _order = 'create_date desc, id desc'

    partner_id = fields.Many2one(
        'res.partner',
        string='Contacto',
        required=True,
        ondelete='cascade',
        index=True,
    )
    rfc = fields.Char(
        string='RFC',
        required=True,
        index=True,
    )
    total = fields.Integer(
        string='Timbres',
        required=True,
        default=0,
    )
    date_from = fields.Date(
        string='Fecha inicio',
        required=True,
    )
    date_to = fields.Date(
        string='Fecha fin',
        required=True,
    )
    query_batch = fields.Char(
        string='Lote de consulta',
        required=True,
        index=True,
        help='Identificador compartido por todas las filas de una misma consulta.',
    )
