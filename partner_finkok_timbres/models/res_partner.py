# -*- coding: utf-8 -*-
from __future__ import annotations

from odoo import api, fields, models
from odoo.tools.translate import _


class ResPartner(models.Model):
    _inherit = 'res.partner'

    finkok_rfc_ids = fields.One2many(
        'partner.finkok.rfc',
        'partner_id',
        string='RFCs Finkok',
    )
    finkok_timbre_history_ids = fields.One2many(
        'partner.finkok.timbre.history',
        'partner_id',
        string='Historial de consultas',
    )
    finkok_timbres_vendidos = fields.Integer(
        string='Timbres vendidos',
        default=0,
        help='Cantidad de timbres vendidos al contacto (actualizar anualmente).',
    )
    finkok_timbres_consumidos = fields.Integer(
        string='Timbres consumidos',
        compute='_compute_finkok_uso',
        help='Suma de timbres de la última consulta (todos los RFC).',
    )
    finkok_uso_porcentaje = fields.Float(
        string='% de uso',
        compute='_compute_finkok_uso',
        digits=(16, 2),
        help='Porcentaje de timbres consumidos respecto a los vendidos. '
             'Puede superar el 100%%.',
    )

    @api.depends(
        'finkok_timbre_history_ids',
        'finkok_timbre_history_ids.total',
        'finkok_timbre_history_ids.query_batch',
        'finkok_timbres_vendidos',
    )
    def _compute_finkok_uso(self):
        for partner in self:
            history = partner.finkok_timbre_history_ids
            if not history:
                partner.finkok_timbres_consumidos = 0
                partner.finkok_uso_porcentaje = 0.0
                continue
            latest_batch = max(history.mapped('query_batch'))
            lines = history.filtered(lambda h: h.query_batch == latest_batch)
            consumed = sum(lines.mapped('total'))
            partner.finkok_timbres_consumidos = consumed
            vendidos = partner.finkok_timbres_vendidos or 0
            partner.finkok_uso_porcentaje = (
                (consumed / vendidos) * 100.0 if vendidos else 0.0
            )

    def action_open_finkok_timbre_wizard(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Consultar timbres'),
            'res_model': 'partner.finkok.timbre.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_partner_id': self.id,
                'active_id': self.id,
                'active_model': 'res.partner',
            },
        }
