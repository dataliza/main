{
    'name': 'Theme Dataliza',
    'summary': 'Light theme for dataliza.mx: black rounded hero card, white cells, Poppins, brand-green details.',
    'description': 'Website theme for Dataliza (Odoo ERP consulting). Light editorial look (grey page, black hero card, giant Poppins titles).',
    'category': 'Theme/Corporate',
    'version': '19.0.1.4.1',
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
