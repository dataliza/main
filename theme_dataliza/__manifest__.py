{
    'name': 'Theme Dataliza',
    'summary': 'Terminal-style dark theme for dataliza.mx: blueprint grid, ASCII hero, mono type.',
    'description': 'Website theme for Dataliza (Odoo ERP consulting). Informative cyberpunk/code look.',
    'category': 'Theme/Corporate',
    'version': '19.0.1.2.0',
    'author': 'Dataliza',
    'license': 'LGPL-3',
    'depends': ['website'],
    'data': [
        'data/ir_asset.xml',
        'views/header.xml',
        'views/footer.xml',
        'views/snippets/s_dz_ascii_hero.xml',
        'views/snippets/s_dz_stats.xml',
        'views/snippets/s_dz_features.xml',
        'views/snippets/s_dz_steps.xml',
        'views/snippets/s_dz_trust.xml',
        'views/snippets/s_dz_cta.xml',
        'views/snippets/snippets.xml',
    ],
    'assets': {
        # Editor-only OWL templates (header/footer template selectors). Global bundle, same pattern as
        # odoo/design-themes 19.0 theme_test_custo; the views they activate only exist where this theme is applied.
        'website.website_builder_assets': [
            'theme_dataliza/static/src/builder/**/*',
        ],
    },
    'installable': True,
    'application': False,
}
