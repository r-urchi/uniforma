<?php
/**
 * UNIFORMA — Tarjeta de producto compartida (home, tienda, categorías, búsqueda).
 *
 * Una sola pieza de marcado: foto sobre fondo de papel, nombre, precio por tramo
 * y dos acciones de texto. Los estilos viven en style.css (.uniforma-product-card).
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Color elegido en el ERP para un color de producto (guardado en el término, meta uniforma_hex).
 * Devuelve '' si ese color no tiene uno propio, y entonces se usa la paleta del sitio.
 */
function uniforma_term_hex_override($name)
{
    static $cache = null;

    if (null === $cache) {
        $cache = array();

        if (taxonomy_exists('pa_color')) {
            $terms = get_terms(array('taxonomy' => 'pa_color', 'hide_empty' => false));

            if (! is_wp_error($terms)) {
                foreach ($terms as $term) {
                    $hex = (string) get_term_meta($term->term_id, 'uniforma_hex', true);

                    if (preg_match('/^#[0-9a-fA-F]{6}$/', $hex)) {
                        $cache[sanitize_title(remove_accents($term->name))] = $hex;
                        $cache[$term->slug] = $hex;
                    }
                }
            }
        }
    }

    $key = sanitize_title(remove_accents((string) $name));

    return isset($cache[$key]) ? $cache[$key] : '';
}

/**
 * Muestra de color con el formato que usan la ficha, el listado y el personalizador:
 * array('background' => color CSS, 'light' => true si es claro y necesita borde visible).
 */
function uniforma_swatch_from_hex($hex)
{
    $rgb = sscanf((string) $hex, '#%02x%02x%02x');
    $luminance = (is_array($rgb) && 3 === count(array_filter($rgb, 'is_int')))
        ? (0.299 * $rgb[0] + 0.587 * $rgb[1] + 0.114 * $rgb[2])
        : 0;

    return array(
        'background' => (string) $hex,
        'light'      => $luminance > 186,
    );
}

/**
 * Hex de muestra para un nombre de color. Devuelve '' si no se reconoce,
 * para que la tarjeta use una muestra rayada en lugar de un chip blanco engañoso.
 */
function uniforma_color_swatch_hex($name)
{
    $override = uniforma_term_hex_override($name);

    if ('' !== $override) {
        return $override;
    }

    $name = remove_accents(strtolower(trim((string) $name)));

    // De lo más específico a lo más general.
    $map = array(
        'azul marino'   => '#1c2a44',
        'marino'        => '#1c2a44',
        'azul francia'  => '#2b4c9b',
        'celeste'       => '#8fb3d6',
        'azul'          => '#24406f',
        'bordo'         => '#6d1f2f',
        'rojo'          => '#b3262e',
        'verde botella' => '#1f4a38',
        'verde militar' => '#4c5130',
        'verde'         => '#4c5130',
        'amarillo'      => '#e0b72f',
        'naranja'       => '#d9772b',
        'rosa'          => '#d9a0b3',
        'violeta'       => '#6b4a8a',
        'chocolate'     => '#4a2f20',
        'marron'        => '#6a4630',
        'camel'         => '#b38a58',
        'arena'         => '#d5c29d',
        'crema'         => '#eadfc6',
        'natural'       => '#e6dcc8',
        'beige'         => '#d9ccb4',
        'plomo'         => '#6f7174',
        'gris'          => '#9a9a97',
        'negro'         => '#1b1b1b',
        'blanco'        => '#fbfaf7',
    );

    foreach ($map as $needle => $hex) {
        if (false !== strpos($name, $needle)) {
            return $hex;
        }
    }

    return '';
}

/**
 * Nombres de color de un producto (taxonomía pa_color o atributo personalizado «Color»).
 */
function uniforma_product_color_names($product)
{
    $names = array();

    foreach ($product->get_attributes() as $attribute) {
        if (! is_a($attribute, 'WC_Product_Attribute')) {
            continue;
        }

        $label = remove_accents(strtolower(wc_attribute_label($attribute->get_name())));

        if ('color' !== $label && 'colores' !== $label) {
            continue;
        }

        if ($attribute->is_taxonomy()) {
            $terms = wc_get_product_terms($product->get_id(), $attribute->get_name(), array('fields' => 'names'));
            $names = array_merge($names, is_array($terms) ? $terms : array());
        } else {
            $names = array_merge($names, $attribute->get_options());
        }
    }

    return array_values(array_unique(array_filter(array_map('strval', $names))));
}

/**
 * Imprime una tarjeta de producto.
 *
 * @param WC_Product $product
 * @param array      $args {
 *     @type bool   $colors   Mostrar muestras de color (por defecto true).
 *     @type bool   $actions  Mostrar «Ver» y «Personalizar» (por defecto true).
 *     @type string $size     Tamaño de imagen (por defecto 'large').
 *     @type string $tag      Etiqueta contenedora (por defecto 'article').
 * }
 */
function uniforma_render_product_card($product, $args = array())
{
    if (! $product || ! is_a($product, 'WC_Product')) {
        return;
    }

    $args = wp_parse_args($args, array(
        'colors'  => true,
        'actions' => true,
        'size'    => 'large',
        'tag'     => 'article',
    ));

    $product_id = $product->get_id();
    $url        = $product->get_permalink();
    $title      = $product->get_name();
    $image_id   = $product->get_image_id();
    $image_html = $image_id
        ? wp_get_attachment_image($image_id, $args['size'], false, array('alt' => $title, 'loading' => 'lazy', 'decoding' => 'async'))
        : '<img src="' . esc_url(wc_placeholder_img_src($args['size'])) . '" alt="' . esc_attr($title) . '" loading="lazy" decoding="async">';

    $price_html = $product->get_price_html();

    $personalize_url = function_exists('uniforma_product_personalize_url')
        ? uniforma_product_personalize_url($product_id)
        : add_query_arg(array('producto' => $title), home_url('/simula-tu-prenda/'));

    $tag = tag_escape($args['tag']);
    ?>
    <<?php echo $tag; ?> class="uniforma-product-card">
        <a href="<?php echo esc_url($url); ?>" class="uniforma-product-card__image" tabindex="-1" aria-hidden="true">
            <?php echo $image_html; // phpcs:ignore WordPress.Security.EscapeOutput ?>
        </a>

        <div class="uniforma-product-card__body">
            <h3 class="uniforma-product-card__title">
                <a href="<?php echo esc_url($url); ?>"><?php echo esc_html($title); ?></a>
            </h3>

            <?php if ($price_html) : ?>
                <p class="uniforma-product-card__price">
                    <span><?php echo wp_kses_post($price_html); ?></span>
                    <small>por unidad, desde 5</small>
                </p>
            <?php else : ?>
                <p class="uniforma-product-card__price"><span>Consultar precio</span></p>
            <?php endif; ?>

            <?php if ($args['colors']) : ?>
                <?php
                $color_names = uniforma_product_color_names($product);
                $shown       = array_slice($color_names, 0, 6);
                $extra       = count($color_names) - count($shown);
                ?>
                <?php if (! empty($shown)) : ?>
                    <ul class="uniforma-product-card__colors" aria-label="Colores disponibles">
                        <?php foreach ($shown as $color_name) : ?>
                            <?php $hex = uniforma_color_swatch_hex($color_name); ?>
                            <li class="uniforma-swatch<?php echo $hex ? '' : ' is-unknown'; ?>" title="<?php echo esc_attr($color_name); ?>"<?php echo $hex ? ' style="--swatch:' . esc_attr($hex) . ';"' : ''; ?>>
                                <span class="screen-reader-text"><?php echo esc_html($color_name); ?></span>
                            </li>
                        <?php endforeach; ?>
                        <?php if ($extra > 0) : ?>
                            <li class="uniforma-product-card__more">+<?php echo esc_html($extra); ?></li>
                        <?php endif; ?>
                    </ul>
                <?php endif; ?>
            <?php endif; ?>

            <?php if ($args['actions']) : ?>
                <div class="uniforma-product-card__actions">
                    <a href="<?php echo esc_url($url); ?>" class="uniforma-link">Ver producto</a>
                    <a href="<?php echo esc_url($personalize_url); ?>" class="uniforma-link">Personalizar</a>
                </div>
            <?php endif; ?>
        </div>
    </<?php echo $tag; ?>>
    <?php
}
