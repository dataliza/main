# Consulta de Timbres Finkok

Módulo Odoo 19 que añade la pestaña **Timbres** en contactos para consultar
el consumo de timbres vía el webservice SOAP `report_total` de Finkok.

## Configuración

1. Instalar el módulo `partner_finkok_timbres`.
2. Ir a **Ajustes → Finkok Timbres** y capturar:
   - Usuario Finkok
   - Contraseña Finkok
   - Entorno (Demo / Producción)

## Uso

1. Abrir un contacto → pestaña **Timbres**.
2. Indicar **Timbres vendidos** (actualizar anualmente).
3. Agregar uno o más **RFCs**.
4. Pulsar **Consultar timbres**, elegir la fecha fin (la inicio siempre es
   el 1 de enero del año actual) y confirmar.
5. El **historial** guarda RFC, total y rango; el **% de uso** se calcula
   con la última consulta frente a timbres vendidos.

## Dependencias Python

- `requests` y `lxml` (habituales en Odoo).
- Opcional: `zeep` (si está instalado se usa primero; si no, HTTP + lxml).
