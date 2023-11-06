# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models


class ProjectMilestone(models.Model):
    _inherit = "project.milestone"

    project_task_ids = fields.One2many(
        "project.task", "milestone_id", string="Project Tasks"
    )
    active = fields.Boolean('Active', default=True)
