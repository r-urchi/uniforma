# Uniforma Divi Child

Child theme base para usar UNIFORMA sobre Divi.

## Instalacion

1. Comprimir la carpeta `uniforma-divi-child` como `.zip`.
2. En WordPress ir a `Apariencia > Temas > Anadir nuevo > Subir tema`.
3. Subir el `.zip`.
4. Activar `Uniforma Divi Child`.
5. Confirmar que Divi este instalado como theme padre.

## Que incluye

- Paleta base de UNIFORMA como variables CSS.
- Tipografias Inter y Montserrat desde Google Fonts.
- Estilos globales para botones, titulos, formularios y WooCommerce.
- Modo catalogo/presupuesto activado.
- Reemplazo basico de compra directa por acciones de presupuesto y personalizacion.

## Modo presupuesto

La constante `UNIFORMA_CATALOG_MODE` esta activa en `functions.php`.

Con esta opcion:

- Se desactiva la compra directa.
- En listados aparecen acciones de `Ver producto` y `Personalizar`.
- En producto individual aparecen `Personalizar prenda` y `Pedir presupuesto`.

Si mas adelante quieren venta directa, cambiar:

```php
define('UNIFORMA_CATALOG_MODE', true);
```

por:

```php
define('UNIFORMA_CATALOG_MODE', false);
```
