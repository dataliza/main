# -*- coding: utf-8 -*-
from __future__ import annotations

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class PartnerFinkokRfc(models.Model):
    _name = 'partner.finkok.rfc'
    _description = 'RFC para consulta de timbres Finkok'
    _order = 'rfc'

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

    _partner_rfc_uniq = models.Constraint(
        'UNIQUE(partner_id, rfc)',
        'El RFC ya está configurado en este contacto.',
    )

    @api.constrains('rfc')
    def _check_rfc(self):
        for line in self:
            rfc = (line.rfc or '').strip().upper()
            if not rfc:
                raise ValidationError(_('El RFC no puede estar vacío.'))
            if len(rfc) < 12 or len(rfc) > 13:
                raise ValidationError(_(
                    'El RFC "%(rfc)s" debe tener 12 o 13 caracteres.',
                    rfc=rfc,
                ))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('rfc'):
                vals['rfc'] = vals['rfc'].strip().upper()
        return super().create(vals_list)

    def write(self, vals):
        if vals.get('rfc'):
            vals = dict(vals)
            vals['rfc'] = vals['rfc'].strip().upper()
        return super().write(vals)
