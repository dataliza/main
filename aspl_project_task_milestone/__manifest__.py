# -*- coding: utf-8 -*-
###############################################################################
#
# Aspire Softserv Pvt. Ltd.
# Copyright (C) Aspire Softserv Pvt. Ltd.(<https://aspiresoftserv.com>).
#
###############################################################################
{
    "name": "Project Task Milestones",
    "category": "Project Management",
    "summary": "Plan your tasks by milestone/sprints.",
    "version": "16.0.0.1.0",
    "license": "AGPL-3",
    'description': """
        This module adds a new field 'Milestone' in Project Tasks. This helps bifurcating tasks by Milestone. User can filter/group tasks by milestone.
    """,
    "author": "Aspire Softserv Pvt. Ltd",
    "website": "https://aspiresoftserv.com",
    "depends": ["project"],
    "data": [
        "views/project_task.xml",
    ],
    "application": True,
    "installable": True,
    "maintainer": "Aspire Softserv Pvt. Ltd",
    "support":"odoo@aspiresoftserv.com",
    "images": ['static/description/banner.gif'],
}
