<?php
/**
 * UNIFORMA — Single product custom template
 */

defined('ABSPATH') || exit;

get_header();

global $product;

if (! $product || ! is_a($product, 'WC_Product')) {
    $product = wc_get_product(get_the_ID());
}

if (! $product) {
    get_footer();
    return;
}

$product_id = $product->get_id();
$product_title = get_the_title($product_id);

$price_tiers = array(
    5  => (float) get_post_meta($product_id, 'uniforma_precio_x5', true),
    10 => (float) get_post_meta($product_id, 'uniforma_precio_x10', true),
    20 => (float) get_post_meta($product_id, 'uniforma_precio_x20', true),
    50 => (float) get_post_meta($product_id, 'uniforma_precio_x50', true),
);

// Compatibilidad: si todavía no cargaron X5, usamos el precio normal de WooCommerce.
if ($price_tiers[5] <= 0 && (float) $product->get_price() > 0) {
    $price_tiers[5] = (float) $product->get_price();
}

// Si falta algún tramo, conserva el último precio válido anterior.
$last_valid_price = 0;
foreach ($price_tiers as $tier_qty => $tier_price) {
    if ($tier_price > 0) {
        $last_valid_price = $tier_price;
    } elseif ($last_valid_price > 0) {
        $price_tiers[$tier_qty] = $last_valid_price;
    }
}

$initial_unit_price = $price_tiers[5];
$initial_total = $initial_unit_price > 0 ? $initial_unit_price * 5 : 0;
$price_html = $initial_unit_price > 0 ? wc_price($initial_unit_price) : '';
$short_description = apply_filters('woocommerce_short_description', $product->get_short_description());
$description = apply_filters('the_content', $product->get_description());

$main_image_id = $product->get_image_id();
$main_image_url = $main_image_id ? wp_get_attachment_image_url($main_image_id, 'large') : wc_placeholder_img_src();

$gallery_ids = $product->get_gallery_image_ids();
$gallery_images = array();
$single_image_sizes = '(max-width: 768px) 92vw, (max-width: 1200px) 50vw, 650px';

if (! function_exists('uniforma_single_image_data')) {
    function uniforma_single_image_data($attachment_id, $fallback_alt = '')
    {
        if (! $attachment_id) {
            return array(
                'id'     => 0,
                'url'    => wc_placeholder_img_src(),
                'thumb'  => wc_placeholder_img_src(),
                'srcset' => '',
                'sizes'  => '',
                'alt'    => $fallback_alt,
            );
        }

        $alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);

        return array(
            'id'     => $attachment_id,
            'url'    => wp_get_attachment_image_url($attachment_id, 'large') ?: wc_placeholder_img_src(),
            'thumb'  => wp_get_attachment_image_url($attachment_id, 'woocommerce_thumbnail') ?: (wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: wc_placeholder_img_src()),
            'srcset' => wp_get_attachment_image_srcset($attachment_id, 'large') ?: '',
            'sizes'  => wp_get_attachment_image_sizes($attachment_id, 'large') ?: '',
            'alt'    => $alt ?: $fallback_alt,
        );
    }
}

if (! function_exists('uniforma_single_get_ordered_attribute_terms')) {
    /**
     * Devuelve los términos respetando el orden guardado dentro del producto.
     * WooCommerce suele devolver wc_get_product_terms() alfabéticamente, lo que
     * desordena tanto los colores como los talles del inventario maestro.
     */
    function uniforma_single_get_ordered_attribute_terms($product, $taxonomy)
    {
        $ordered = array();
        $seen = array();
        $attributes = $product instanceof WC_Product ? $product->get_attributes() : array();
        $attribute = isset($attributes[$taxonomy]) ? $attributes[$taxonomy] : null;

        if ($attribute instanceof WC_Product_Attribute && $attribute->is_taxonomy()) {
            foreach ($attribute->get_options() as $term_id) {
                $term = get_term((int) $term_id, $taxonomy);

                if (! $term || is_wp_error($term) || isset($seen[$term->slug])) {
                    continue;
                }

                $seen[$term->slug] = true;
                $ordered[] = $term;
            }
        }

        if (empty($ordered)) {
            $fallback = wc_get_product_terms($product->get_id(), $taxonomy, array('fields' => 'all'));

            if (! is_wp_error($fallback)) {
                foreach ((array) $fallback as $term) {
                    if (! $term || isset($seen[$term->slug])) {
                        continue;
                    }

                    $seen[$term->slug] = true;
                    $ordered[] = $term;
                }
            }
        }

        return $ordered;
    }
}

if (! function_exists('uniforma_single_size_sort_key')) {
    function uniforma_single_size_sort_key($label)
    {
        $normalized = strtoupper(trim(remove_accents(wp_strip_all_tags((string) $label))));
        $normalized = preg_replace('/\s+/', '', $normalized);

        $alpha_order = array(
            'XXS' => 10,
            'XS' => 20,
            'S' => 30,
            'M' => 40,
            'L' => 50,
            'XL' => 60,
            'XXL' => 70,
            'XXXL' => 80,
            '3XL' => 80,
            '4XL' => 90,
            '5XL' => 100,
            '6XL' => 110,
            '7XL' => 120,
            '8XL' => 130,
        );

        if (isset($alpha_order[$normalized])) {
            return array(10, $alpha_order[$normalized], $normalized);
        }

        if (preg_match('/^(\d+)XL$/', $normalized, $matches)) {
            return array(10, 70 + ((int) $matches[1] * 10), $normalized);
        }

        if (ctype_digit($normalized)) {
            return array(20, (int) $normalized, $normalized);
        }

        if (preg_match('/^(\d+)E$/', $normalized, $matches)) {
            return array(30, (int) $matches[1], $normalized);
        }

        if (in_array($normalized, array('TALLEUNICO', 'UNICO', 'UNICA'), true)) {
            return array(90, 0, $normalized);
        }

        return array(80, 0, $normalized);
    }
}

if (! function_exists('uniforma_single_sort_size_terms')) {
    function uniforma_single_sort_size_terms($terms)
    {
        $indexed = array();

        foreach ((array) $terms as $index => $term) {
            $indexed[] = array(
                'term' => $term,
                'key' => uniforma_single_size_sort_key($term->name),
                'index' => $index,
            );
        }

        usort($indexed, function ($left, $right) {
            for ($i = 0; $i < 3; $i++) {
                if ($left['key'][$i] === $right['key'][$i]) {
                    continue;
                }

                if (is_numeric($left['key'][$i]) && is_numeric($right['key'][$i])) {
                    return $left['key'][$i] <=> $right['key'][$i];
                }

                return strnatcasecmp((string) $left['key'][$i], (string) $right['key'][$i]);
            }

            return $left['index'] <=> $right['index'];
        });

        return array_map(function ($entry) {
            return $entry['term'];
        }, $indexed);
    }
}

if (! function_exists('uniforma_single_color_swatch')) {
    /**
     * Paleta de todos los colores actuales de UNIFORMA. El fallback genera un
     * tono estable para que un término nuevo nunca vuelva a verse como blanco.
     */
    function uniforma_single_color_swatch($color_name)
    {
        $override = uniforma_term_hex_override($color_name);

        if ('' !== $override) {
            return uniforma_swatch_from_hex($override);
        }

        $slug = sanitize_title(remove_accents((string) $color_name));
        $palette = array(
            'aero' => '#66c4d2',
            'amarillo' => '#f2c94c',
            'arena' => '#c6a878',
            'azul' => '#193552',
            'azul-francia' => '#2458a6',
            'azul-liso' => '#173a63',
            'azul-localizado' => 'linear-gradient(135deg, #173a63 0 48%, #5d7ea1 52% 100%)',
            'azul-blanco' => 'linear-gradient(135deg, #1c3b65 0 50%, #ffffff 50% 100%)',
            'azul-marino' => '#172a46',
            'beige' => '#ded1bd',
            'blanco' => '#ffffff',
            'blanco-azul-marino' => 'linear-gradient(135deg, #ffffff 0 50%, #172a46 50% 100%)',
            'blanco-celeste' => 'linear-gradient(135deg, #ffffff 0 50%, #98cfe9 50% 100%)',
            'blanco-negro' => 'linear-gradient(135deg, #ffffff 0 50%, #171717 50% 100%)',
            'blanco-rosa' => 'linear-gradient(135deg, #ffffff 0 50%, #e8a6b7 50% 100%)',
            'blanco-verde-benetton' => 'linear-gradient(135deg, #ffffff 0 50%, #148552 50% 100%)',
            'bordo' => '#7a1f3d',
            'celeste' => '#9bcee7',
            'celeste-liso' => '#8fc8e6',
            'celeste-localizado' => 'linear-gradient(135deg, #8fc8e6 0 48%, #d3e8f3 52% 100%)',
            'celeste-melangino' => 'repeating-linear-gradient(135deg, #b4ccd5 0 4px, #9fb9c3 4px 8px)',
            'chocolate' => '#4a2d22',
            'gris' => '#97999c',
            'gris-plomo' => '#50545b',
            'gris-negro' => 'linear-gradient(135deg, #85888c 0 50%, #171717 50% 100%)',
            'lila' => '#bca4d6',
            'marron' => '#6a4637',
            'melange' => 'repeating-linear-gradient(135deg, #d0d1d2 0 4px, #b8babd 4px 8px)',
            'melange-azul-marino' => 'linear-gradient(135deg, #c2c4c6 0 50%, #172a46 50% 100%)',
            'melange-bordo' => 'linear-gradient(135deg, #c2c4c6 0 50%, #7a1f3d 50% 100%)',
            'melange-negro' => 'linear-gradient(135deg, #c2c4c6 0 50%, #171717 50% 100%)',
            'mostaza' => '#c7962d',
            'natural' => '#eee6d8',
            'naranja' => '#df7b2f',
            'negro' => '#171717',
            'negro-liso' => '#111111',
            'negro-localizado-gris-oscuro' => 'linear-gradient(135deg, #151515 0 48%, #3f4348 52% 100%)',
            'negro-localizado-gris' => 'linear-gradient(135deg, #171717 0 48%, #777b80 52% 100%)',
            'negro-oxido' => '#4b2a22',
            'rojo' => '#c72c31',
            'rosa' => '#e7a4b4',
            'verde' => '#354f3b',
            'verde-acqua' => '#6eb9a9',
            'verde-benetton' => '#148552',
            'verde-botella' => '#214a36',
            'verde-militar' => '#4c5130',
            'violeta' => '#6e3d8b',
        );
        $light_slugs = array(
            'amarillo', 'arena', 'beige', 'blanco', 'blanco-azul-marino',
            'blanco-celeste', 'blanco-negro', 'blanco-rosa', 'blanco-verde-benetton',
            'celeste', 'celeste-liso', 'celeste-localizado', 'celeste-melangino',
            'lila', 'melange', 'melange-azul-marino', 'melange-bordo', 'melange-negro',
            'natural', 'rosa', 'verde-acqua',
        );

        if (isset($palette[$slug])) {
            $background = $palette[$slug];
        } else {
            $hash = abs((int) crc32($slug ?: (string) $color_name));
            $background = sprintf('hsl(%d 42%% 42%%)', $hash % 360);
        }

        return array(
            'background' => $background,
            'light' => in_array($slug, $light_slugs, true),
        );
    }
}

if (! function_exists('uniforma_single_variation_image_map')) {
    function uniforma_single_variation_image_map($product)
    {
        $map = json_decode(get_post_meta($product->get_id(), '_uniforma_color_image_map', true), true);
        $map = is_array($map) ? $map : array();
        $normalized_map = array();

        foreach ($map as $color_slug => $attachment_id) {
            if ((int) $attachment_id > 0) {
                $normalized_map[sanitize_title($color_slug)] = (int) $attachment_id;
            }
        }

        if (! empty($normalized_map) || ! $product->is_type('variable')) {
            return $normalized_map;
        }

        foreach ($product->get_children() as $variation_id) {
            $variation = wc_get_product($variation_id);

            if (! $variation instanceof WC_Product_Variation || ! $variation->get_image_id()) {
                continue;
            }

            $attributes = $variation->get_attributes();
            $color_slug = isset($attributes['pa_color']) ? $attributes['pa_color'] : '';

            if (! $color_slug && isset($attributes['attribute_pa_color'])) {
                $color_slug = $attributes['attribute_pa_color'];
            }

            if ($color_slug && ! isset($normalized_map[$color_slug])) {
                $normalized_map[sanitize_title($color_slug)] = (int) $variation->get_image_id();
            }
        }

        return $normalized_map;
    }
}

if (! function_exists('uniforma_single_detect_attachment_color')) {
    function uniforma_single_detect_attachment_color($attachment_id, $color_terms, $variation_image_map)
    {
        foreach ((array) $variation_image_map as $color_slug => $mapped_attachment_id) {
            if ((int) $mapped_attachment_id === (int) $attachment_id) {
                return array('color' => sanitize_title($color_slug), 'view' => 'frente');
            }
        }

        $sources = array_filter(array(
            get_post_meta($attachment_id, '_uniforma_source_file', true),
            $attachment_id ? basename((string) get_attached_file($attachment_id)) : '',
            $attachment_id ? get_post_field('post_title', $attachment_id) : '',
            $attachment_id ? get_post_meta($attachment_id, '_wp_attachment_image_alt', true) : '',
        ));
        $candidate_slugs = array();

        foreach ((array) $color_terms as $term) {
            $candidate_slugs[] = sanitize_title($term->slug ?: $term->name);
        }

        usort($candidate_slugs, function ($left, $right) {
            return strlen($right) <=> strlen($left);
        });

        foreach ($sources as $source) {
            $without_extension = pathinfo((string) $source, PATHINFO_FILENAME);
            $normalized = sanitize_title(remove_accents($without_extension));
            $view = '';

            if (preg_match('/(?:^|-)(espalda|dorso|back)(?:$|-)/', $normalized)) {
                $view = 'espalda';
            } elseif (preg_match('/(?:^|-)(frente|front)(?:$|-)/', $normalized)) {
                $view = 'frente';
            }

            foreach ($candidate_slugs as $candidate_slug) {
                $with_view_pattern = '/(?:^|-)' . preg_quote($candidate_slug, '/') . '-(?:frente|front|espalda|dorso|back)(?:$|-)/';
                $at_end_pattern = '/(?:^|-)' . preg_quote($candidate_slug, '/') . '$/';

                if (preg_match($with_view_pattern, $normalized) || (! $view && preg_match($at_end_pattern, $normalized))) {
                    return array(
                        'color' => $candidate_slug,
                        'view' => $view ?: 'frente',
                    );
                }
            }
        }

        return array('color' => '', 'view' => '');
    }
}

if (! function_exists('uniforma_single_attachment_pair_key')) {
    /**
     * Une frente y espalda aunque el nombre comercial del color de la foto sea
     * más específico que el atributo (por ejemplo, "Verde oliva" -> "Verde").
     */
    function uniforma_single_attachment_pair_key($attachment_id)
    {
        $sources = array_filter(array(
            get_post_meta($attachment_id, '_uniforma_source_file', true),
            $attachment_id ? basename((string) get_attached_file($attachment_id)) : '',
            $attachment_id ? get_post_field('post_title', $attachment_id) : '',
            $attachment_id ? get_post_meta($attachment_id, '_wp_attachment_image_alt', true) : '',
        ));

        foreach ($sources as $source) {
            $normalized = sanitize_title(remove_accents(pathinfo((string) $source, PATHINFO_FILENAME)));
            $pair_key = preg_replace('/-(frente|front|espalda|dorso|back)(?:-\d+)?$/', '', $normalized);

            if ($pair_key && $pair_key !== $normalized) {
                return $pair_key;
            }
        }

        return '';
    }
}
$product_categories = wc_get_product_terms($product_id, 'product_cat');
$primary_category = ! empty($product_categories) ? $product_categories[0] : null;

$category_name = $primary_category ? $primary_category->name : '';
$category_slug = $primary_category ? $primary_category->slug : '';
$category_url = $primary_category ? get_term_link($primary_category) : home_url('/catalogo/');

foreach ($product_categories as $product_category) {
    if (preg_match('/remera|chomba|polo|buzo|hoodie|camper|chaqueta|pantal|jean|acces|gorra|zapat|calzado/i', $product_category->slug)) {
        $category_slug = $product_category->slug;
        break;
    }
}

$product_colors = uniforma_single_get_ordered_attribute_terms($product, 'pa_color');
$product_talles = uniforma_single_sort_size_terms(uniforma_single_get_ordered_attribute_terms($product, 'pa_talle'));
$product_personalizaciones = uniforma_single_get_ordered_attribute_terms($product, 'pa_personalizacion');
if (empty($product_personalizaciones)) {
    $product_personalizaciones = array(
        (object) array(
            'slug' => 'bordado',
            'name' => 'Bordado',
        ),
        (object) array(
            'slug' => 'estampado-dtf',
            'name' => 'Estampado DTF',
        ),
    );
}

/*
 * Galería agrupada por color.
 * El importador guarda el nombre original de cada archivo en
 * _uniforma_source_file (producto-color-frente/espalda.webp), por lo que
 * podemos mostrar solamente las vistas del color elegido sin duplicar medios.
 */
$variation_image_map = uniforma_single_variation_image_map($product);
$gallery_attachment_ids = array_values(array_unique(array_filter(array_merge(
    array($main_image_id),
    (array) $gallery_ids,
    array_values($variation_image_map)
))));
$gallery_by_color = array();
$gallery_position = 0;

foreach ($gallery_attachment_ids as $attachment_id) {
    // Salta los adjuntos cuyo archivo ya no existe: mostrarían la imagen genérica de WooCommerce
    // y el color afectado se vería vacío en vez de usar el respaldo de otro color.
    if (! wp_get_attachment_image_url((int) $attachment_id, 'large')) {
        continue;
    }

    $image = uniforma_single_image_data((int) $attachment_id, $product_title);
    $detected = uniforma_single_detect_attachment_color((int) $attachment_id, $product_colors, $variation_image_map);
    $image['color'] = $detected['color'];
    $image['view'] = $detected['view'];
    $image['position'] = $gallery_position++;
    $image['gallery_key'] = 'attachment-' . (int) $attachment_id;
    $image['pair_key'] = uniforma_single_attachment_pair_key((int) $attachment_id);
    $gallery_images[] = $image;
}

$pair_color_map = array();

foreach ($gallery_images as $image) {
    if ($image['color'] && $image['pair_key']) {
        $pair_color_map[$image['pair_key']] = $image['color'];
    }
}

$gallery_by_color = array();

foreach ($gallery_images as $index => $image) {
    if (! $image['color'] && $image['pair_key'] && isset($pair_color_map[$image['pair_key']])) {
        $gallery_images[$index]['color'] = $pair_color_map[$image['pair_key']];
        $image['color'] = $pair_color_map[$image['pair_key']];
    }

    $group_key = $image['color'] ?: '__generic';

    if (! isset($gallery_by_color[$group_key])) {
        $gallery_by_color[$group_key] = array();
    }

    $gallery_by_color[$group_key][] = $gallery_images[$index];
}

if (empty($gallery_images)) {
    $placeholder = array(
        'id' => 0,
        'url' => $main_image_url ?: wc_placeholder_img_src(),
        'thumb' => $main_image_url ?: wc_placeholder_img_src(),
        'srcset' => '',
        'sizes' => '',
        'alt' => $product_title,
        'color' => '',
        'view' => '',
        'position' => 0,
        'gallery_key' => 'placeholder',
    );
    $gallery_images[] = $placeholder;
    $gallery_by_color['__generic'] = array($placeholder);
}

foreach ($gallery_by_color as $group_key => $group_images) {
    usort($group_images, function ($left, $right) {
        $view_order = array('frente' => 0, 'espalda' => 1, '' => 2);
        $left_view = isset($view_order[$left['view']]) ? $view_order[$left['view']] : 2;
        $right_view = isset($view_order[$right['view']]) ? $view_order[$right['view']] : 2;

        if ($left_view !== $right_view) {
            return $left_view <=> $right_view;
        }

        return $left['position'] <=> $right['position'];
    });
    $gallery_by_color[$group_key] = $group_images;
}

$available_color_slugs = array();
$color_name_by_slug = array();

foreach ($product_colors as $color_term) {
    $color_slug = sanitize_title($color_term->slug ?: $color_term->name);
    $available_color_slugs[] = $color_slug;
    $color_name_by_slug[$color_slug] = $color_term->name;
}

$gallery_color_order = array_flip($available_color_slugs);

usort($gallery_images, function ($left, $right) use ($gallery_color_order) {
    $left_group = $left['color'] ?: '__generic';
    $right_group = $right['color'] ?: '__generic';
    $left_color_order = isset($gallery_color_order[$left_group]) ? $gallery_color_order[$left_group] : 9999;
    $right_color_order = isset($gallery_color_order[$right_group]) ? $gallery_color_order[$right_group] : 9999;

    if ($left_color_order !== $right_color_order) {
        return $left_color_order <=> $right_color_order;
    }

    $view_order = array('frente' => 0, 'espalda' => 1, '' => 2);
    $left_view_order = isset($view_order[$left['view']]) ? $view_order[$left['view']] : 2;
    $right_view_order = isset($view_order[$right['view']]) ? $view_order[$right['view']] : 2;

    if ($left_view_order !== $right_view_order) {
        return $left_view_order <=> $right_view_order;
    }

    return $left['position'] <=> $right['position'];
});

$requested_color_slug = '';

foreach (array('attribute_pa_color', 'pa_color', 'color') as $color_query_key) {
    if (isset($_GET[$color_query_key])) {
        $requested_color_slug = sanitize_title(wp_unslash($_GET[$color_query_key]));
        break;
    }
}

if ($requested_color_slug && ! in_array($requested_color_slug, $available_color_slugs, true)) {
    $requested_color_slug = '';
}

$initial_color_slug = $requested_color_slug;

if (! $initial_color_slug) {
    foreach ($available_color_slugs as $available_color_slug) {
        if (! empty($gallery_by_color[$available_color_slug])) {
            $initial_color_slug = $available_color_slug;
            break;
        }
    }
}

if (! $initial_color_slug && ! empty($available_color_slugs)) {
    $initial_color_slug = $available_color_slugs[0];
}

if ($initial_color_slug && ! empty($gallery_by_color[$initial_color_slug])) {
    $initial_gallery_images = $gallery_by_color[$initial_color_slug];
} elseif (! empty($gallery_by_color['__generic'])) {
    $initial_gallery_images = $gallery_by_color['__generic'];
} else {
    $initial_gallery_images = array();

    foreach ($gallery_by_color as $group_key => $group_images) {
        if (! empty($group_images)) {
            $initial_gallery_images = $group_images;
            break;
        }
    }
}

if (empty($initial_gallery_images)) {
    $initial_gallery_images = array($gallery_images[0]);
}

$initial_visible_gallery_keys = array();

foreach ($initial_gallery_images as $initial_gallery_image) {
    $initial_visible_gallery_keys[$initial_gallery_image['gallery_key']] = true;
}

$initial_main_image = $initial_gallery_images[0];
$initial_color_name = isset($color_name_by_slug[$initial_color_slug])
    ? $color_name_by_slug[$initial_color_slug]
    : '';
$personalize_url = function_exists('uniforma_product_personalize_url')
    ? uniforma_product_personalize_url($product_id)
    : add_query_arg(array('producto' => $product_title), home_url('/simula-tu-prenda/'));

$quote_url = function_exists('uniforma_product_quote_url')
    ? uniforma_product_quote_url($product_id)
    : add_query_arg(array('producto' => $product_title), home_url('/contacto/'));

$whatsapp_quote_url = uniforma_whatsapp_url(
    "Hola UNIFORMA, quiero solicitar un presupuesto.\n\nProducto: " . $product_title
);

$related_ids  = uniforma_pdp_related_products($product, 8);
$complete_ids = uniforma_pdp_complete_products($product, $related_ids, 4);

/**
 * Campos personalizados opcionales.
 *
 * Podés cargarlos con ACF o con campos personalizados nativos:
 *
 * uniforma_detalles
 * uniforma_tabla_talles
 * uniforma_cuidados
 *
 * Si están vacíos, usamos descripción larga o fallback según categoría.
 */

$custom_details = get_post_meta($product_id, 'uniforma_detalles', true);
$custom_size_table = get_post_meta($product_id, 'uniforma_tabla_talles', true);
$custom_care = get_post_meta($product_id, 'uniforma_cuidados', true);

function uniforma_single_icon_svg($icon)
{
    $icons = array(
        'shirt' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4l-5 3 3 5 2-1.2V20h8v-9.2L18 12l3-5-5-3-2 3h-4L8 4Z"/>
            </svg>
        ',
        'size' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16v10H4V7Z"/>
                <path d="M7 7v4"/>
                <path d="M10 7v3"/>
                <path d="M13 7v4"/>
                <path d="M16 7v3"/>
            </svg>
        ',
        'needle' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 4L8 16"/>
                <path d="M14 4l6 6"/>
                <path d="M5 19l3-3"/>
                <path d="M4 20c4 0 6-2 6-6"/>
            </svg>
        ',
        'printer' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 8V3h10v5"/>
                <path d="M6 17H4V9h16v8h-2"/>
                <path d="M7 14h10v7H7v-7Z"/>
                <path d="M17 12h.01"/>
            </svg>
        ',
        'thread' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3h8v18H8V3Z"/>
                <path d="M8 7h8"/>
                <path d="M8 17h8"/>
                <path d="M5 10c2 1 2 3 0 4"/>
                <path d="M19 10c-2 1-2 3 0 4"/>
            </svg>
        ',
        'tag' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 13l-7 7L4 11V4h7l9 9Z"/>
                <path d="M8 8h.01"/>
            </svg>
        ',
        'truck' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h12v10H3V6Z"/>
                <path d="M15 10h4l2 3v3h-6v-6Z"/>
                <path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
                <path d="M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
            </svg>
        ',
        'care-cold' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8l1.5 11h11L19 8"/>
                <path d="M7 8c1 1 2 1 3 0s2-1 3 0 2 1 4 0"/>
            </svg>
        ',
        'care-no' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4l16 16"/>
                <path d="M5 8l1.5 11h11L19 8"/>
            </svg>
        ',
        'care-iron' => '
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 17h12"/>
                <path d="M6 17l2-7h6c3 0 5 2 5 5v2"/>
                <path d="M9 20h8"/>
            </svg>
        ',
    );

    return isset($icons[$icon]) ? $icons[$icon] : '';
}


function uniforma_single_garment_diagram_svg($slug)
{
    $filename = 'remera.svg';

    if (strpos($slug, 'chomba') !== false || strpos($slug, 'polo') !== false) {
        $filename = 'chomba.svg';
    } elseif (strpos($slug, 'buzo') !== false || strpos($slug, 'hoodie') !== false) {
        $filename = 'buzo.svg';
    } elseif (strpos($slug, 'camper') !== false || strpos($slug, 'chaqueta') !== false) {
        $filename = 'campera.svg';
    } elseif (strpos($slug, 'pantal') !== false || strpos($slug, 'jean') !== false) {
        $filename = 'pantalones.svg';
    } elseif (strpos($slug, 'acces') !== false || strpos($slug, 'gorra') !== false) {
        $filename = 'gorra.svg';
    } elseif (strpos($slug, 'zapat') !== false || strpos($slug, 'calzado') !== false) {
        $filename = 'zapatilla.svg';
    }

    $url = trailingslashit(get_template_directory_uri()) . 'assets/images/categories/' . $filename;

    return '<div class="uniforma-single-garment-diagram">'
        . '<img src="' . esc_url($url) . '" alt="Esquema de medidas de la prenda">'
        . '<span class="uniforma-single-measure uniforma-single-measure--a">A</span>'
        . '<span class="uniforma-single-measure uniforma-single-measure--b">B</span>'
        . '</div>';
}

function uniforma_single_default_details($category_slug)
{
    if ($category_slug === 'accesorios') {
        return '<ul>
            <li>Producto ideal para identidad corporativa.</li>
            <li>Diseño cómodo y versátil para uso diario.</li>
            <li>Apto para personalización con logo.</li>
            <li>Terminaciones prolijas y resistentes.</li>
        </ul>';
    }

    if ($category_slug === 'pantalones') {
        return '<ul>
            <li>Prenda cómoda para equipos de trabajo.</li>
            <li>Confección resistente para uso diario.</li>
            <li>Corte práctico y funcional.</li>
            <li>Ideal para uniformes empresariales.</li>
        </ul>';
    }

    return '<ul>
        <li>Prenda cómoda para equipos de trabajo.</li>
        <li>Terminaciones reforzadas.</li>
        <li>Ideal para bordado y estampado.</li>
        <li>Corte clásico y profesional.</li>
    </ul>';
}

function uniforma_single_default_size_table($category_slug)
{
    if ($category_slug === 'accesorios') {
        return '<table>
            <thead>
                <tr>
                    <th>Medida</th>
                    <th>Único</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>Contorno ajustable</td><td>Regulable</td></tr>
                <tr><td>Calce</td><td>Adulto</td></tr>
            </tbody>
        </table>';
    }

    if ($category_slug === 'pantalones') {
        return '<table>
            <thead>
                <tr>
                    <th>Talle</th>
                    <th>Cintura</th>
                    <th>Largo</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>S</td><td>36-38</td><td>100 cm</td></tr>
                <tr><td>M</td><td>40-42</td><td>102 cm</td></tr>
                <tr><td>L</td><td>44-46</td><td>104 cm</td></tr>
                <tr><td>XL</td><td>48-50</td><td>106 cm</td></tr>
            </tbody>
        </table>';
    }

    return '<table>
        <thead>
            <tr>
                <th>Talle</th>
                <th>Ancho A</th>
                <th>Largo B</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>XS</td><td>48 cm</td><td>68 cm</td></tr>
            <tr><td>S</td><td>51 cm</td><td>70 cm</td></tr>
            <tr><td>M</td><td>54 cm</td><td>72 cm</td></tr>
            <tr><td>L</td><td>57 cm</td><td>74 cm</td></tr>
            <tr><td>XL</td><td>60 cm</td><td>76 cm</td></tr>
            <tr><td>XXL</td><td>63 cm</td><td>78 cm</td></tr>
            <tr><td>3XL</td><td>66 cm</td><td>80 cm</td></tr>
        </tbody>
    </table>';
}

function uniforma_single_default_care()
{
    return '<ul>
        <li>' . uniforma_single_icon_svg('care-cold') . ' Lavar con agua fría</li>
        <li>' . uniforma_single_icon_svg('care-no') . ' No usar lavandina</li>
        <li>' . uniforma_single_icon_svg('care-no') . ' No secar en máquina</li>
        <li>' . uniforma_single_icon_svg('care-iron') . ' Plancha tibia</li>
        <li>' . uniforma_single_icon_svg('care-cold') . ' Lavar y planchar del revés</li>
    </ul>';
}

function uniforma_single_prepare_care($custom_care)
{
    if (! $custom_care) {
        return uniforma_single_default_care();
    }

    $raw_items = array();

    if (stripos($custom_care, '<li') !== false) {
        preg_match_all('/<li[^>]*>(.*?)<\/li>/is', $custom_care, $matches);
        $raw_items = isset($matches[1]) ? $matches[1] : array();
    } else {
        $normalized = preg_replace('/<\/(p|div)>|<br\s*\/?\s*>/i', "\n", $custom_care);
        $raw_items = preg_split('/\r\n|\r|\n|•/', $normalized);
    }

    $items = array();

    foreach ($raw_items as $raw_item) {
        $label = trim(wp_strip_all_tags($raw_item));

        if ($label === '') {
            continue;
        }

        $normalized_label = remove_accents(strtolower($label));
        $icon = (strpos($normalized_label, 'lavandina') !== false || strpos($normalized_label, 'secar') !== false)
            ? 'care-no'
            : (strpos($normalized_label, 'plancha') !== false ? 'care-iron' : 'care-cold');

        $items[] = '<li>' . uniforma_single_icon_svg($icon) . ' <span>' . esc_html($label) . '</span></li>';
    }

    return $items ? '<ul>' . implode('', $items) . '</ul>' : uniforma_single_default_care();
}

function uniforma_single_content_allowed_html()
{
    $allowed = wp_kses_allowed_html('post');
    $allowed['svg'] = array(
        'viewbox' => true,
        'aria-hidden' => true,
        'focusable' => true,
        'role' => true,
        'class' => true,
    );
    $allowed['path'] = array(
        'd' => true,
        'fill' => true,
        'fill-rule' => true,
        'clip-rule' => true,
        'stroke' => true,
        'stroke-width' => true,
        'stroke-linecap' => true,
        'stroke-linejoin' => true,
    );
    $allowed['circle'] = array('cx' => true, 'cy' => true, 'r' => true);
    $allowed['line'] = array('x1' => true, 'x2' => true, 'y1' => true, 'y2' => true);
    $allowed['polyline'] = array('points' => true);
    $allowed['rect'] = array('x' => true, 'y' => true, 'width' => true, 'height' => true, 'rx' => true);

    return $allowed;
}

// La descripción larga tiene su propio bloque; «Detalles» no la repite.
$details_html = $custom_details
    ? wpautop(wp_kses_post($custom_details))
    : uniforma_single_default_details($category_slug);

$size_table_html = $custom_size_table
    ? wp_kses_post($custom_size_table)
    : uniforma_single_default_size_table($category_slug);

$care_html = uniforma_single_prepare_care($custom_care);
?>

<main class="uniforma-single-product" data-product-id="<?php echo esc_attr($product_id); ?>">

    <section class="uniforma-single-product__inner">

        <nav class="uniforma-single-breadcrumb" aria-label="Breadcrumb">
            <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
            <span>›</span>

            <?php if ($primary_category) : ?>
                <a href="<?php echo esc_url($category_url); ?>"><?php echo esc_html($category_name); ?></a>
                <span>›</span>
            <?php endif; ?>

            <span><?php echo esc_html($product_title); ?></span>
        </nav>

        <div class="uniforma-single-main">

            <div
                class="uniforma-single-gallery"
                data-initial-color="<?php echo esc_attr($initial_color_slug); ?>"
                data-current-color="<?php echo esc_attr($initial_color_slug); ?>"
            >

                <div class="uniforma-single-gallery__main">
                    <span class="uniforma-single-gallery__badge">Nuevo</span>

                    <button
                        class="uniforma-single-gallery__arrow uniforma-single-gallery__arrow--prev"
                        type="button"
                        aria-label="Imagen anterior"
                        <?php echo count($initial_gallery_images) <= 1 ? 'hidden' : ''; ?>
                    >
                        ‹
                    </button>

                    <?php if (! empty($initial_main_image['id'])) : ?>
                        <?php
                        echo wp_get_attachment_image(
                            $initial_main_image['id'],
                            'large',
                            false,
                            array(
                                'id'            => 'uniformaSingleMainImage',
                                'alt'           => $initial_main_image['alt'] ?: $product_title,
                                'loading'       => 'eager',
                                'fetchpriority' => 'high',
                                'decoding'      => 'async',
                                'sizes'         => $single_image_sizes,
                            )
                        );
                        ?>
                    <?php else : ?>
                        <img
                            id="uniformaSingleMainImage"
                            src="<?php echo esc_url($initial_main_image['url']); ?>"
                            alt="<?php echo esc_attr($initial_main_image['alt'] ?: $product_title); ?>"
                            loading="eager"
                            fetchpriority="high"
                            decoding="async"
                        >
                    <?php endif; ?>

                    <button
                        class="uniforma-single-gallery__arrow uniforma-single-gallery__arrow--next"
                        type="button"
                        aria-label="Imagen siguiente"
                        <?php echo count($initial_gallery_images) <= 1 ? 'hidden' : ''; ?>
                    >
                        ›
                    </button>
                </div>

                <?php if (! empty($gallery_images)) : ?>
                    <div
                        class="uniforma-single-gallery__thumbs<?php echo count($initial_gallery_images) <= 2 ? ' is-compact' : ''; ?>"
                        id="uniformaSingleThumbs"
                        aria-label="Vistas del color seleccionado"
                        <?php echo count($initial_gallery_images) <= 1 ? 'hidden' : ''; ?>
                    >
                        <?php foreach ($gallery_images as $image) : ?>
                            <?php
                            $is_initial_visible = isset($initial_visible_gallery_keys[$image['gallery_key']]);
                            $is_initial_active = $image['gallery_key'] === $initial_main_image['gallery_key'];
                            $image_color_label = isset($color_name_by_slug[$image['color']])
                                ? $color_name_by_slug[$image['color']]
                                : $image['color'];
                            $thumb_aria_label = 'Ver ' . ($image['view'] ?: 'imagen');

                            if ($image_color_label) {
                                $thumb_aria_label .= ' del color ' . $image_color_label;
                            }
                            ?>
                            <button
                                type="button"
                                class="uniforma-single-gallery__thumb <?php echo $is_initial_active ? 'is-active' : ''; ?>"
                                data-gallery-key="<?php echo esc_attr($image['gallery_key']); ?>"
                                data-color="<?php echo esc_attr($image['color']); ?>"
                                data-view="<?php echo esc_attr($image['view']); ?>"
                                data-image="<?php echo esc_url($image['url']); ?>"
                                data-srcset="<?php echo esc_attr($image['srcset']); ?>"
                                data-sizes="<?php echo esc_attr($single_image_sizes); ?>"
                                data-alt="<?php echo esc_attr($image['alt']); ?>"
                                aria-label="<?php echo esc_attr($thumb_aria_label); ?>"
                                <?php echo $is_initial_visible ? '' : 'hidden'; ?>
                            >
                                <img
                                    src="<?php echo esc_url($image['thumb']); ?>"
                                    alt="<?php echo esc_attr($image['alt']); ?>"
                                    loading="lazy"
                                    decoding="async"
                                >
                                <?php if (! empty($image['view'])) : ?>
                                    <span class="uniforma-single-gallery__thumb-label"><?php echo esc_html(ucfirst($image['view'])); ?></span>
                                <?php endif; ?>
                            </button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

            </div>
            <div class="uniforma-single-summary">

                <h1><?php echo esc_html($product_title); ?></h1>

                <?php if ($short_description) : ?>
                    <div class="uniforma-single-summary__short">
                        <?php echo wp_kses_post($short_description); ?>
                    </div>
                <?php endif; ?>

                <div class="uniforma-single-price" id="uniformaSinglePriceBox">
                    <div class="uniforma-single-price__unit">
                        <span>Precio unitario</span>
                        <?php if ($price_html) : ?>
                            <strong id="uniformaSingleUnitPrice"><?php echo wp_kses_post($price_html); ?></strong>
                        <?php else : ?>
                            <strong id="uniformaSingleUnitPrice">Consultar</strong>
                        <?php endif; ?>
                    </div>
                    <div class="uniforma-single-price__total">
                        <span>Total por <b id="uniformaSingleTotalQty">5</b> <span id="uniformaSingleTotalUnitLabel">unidades</span></span>
                        <strong id="uniformaSingleTotalPrice"><?php echo $initial_total > 0 ? wp_kses_post(wc_price($initial_total)) : 'Consultar'; ?></strong>
                    </div>
                </div>

                <p class="uniforma-single-price-note">
                    <strong>El precio incluye 1 estampado DTF de hasta 10 × 3&nbsp;cm por prenda. El bordado no está incluido.</strong>
                    Si querés bordado, más logos o un tamaño mayor, el precio varía: lo cotizamos en tu presupuesto.
                </p>

                <?php if (! empty($product_colors)) : ?>
                    <div class="uniforma-single-option uniforma-single-option--colors">
                        <h2>
                            Colores disponibles
                            <span class="uniforma-single-option__selection" id="uniformaSingleSelectedColor">
                                <?php echo esc_html($initial_color_name); ?>
                            </span>
                        </h2>

                        <div class="uniforma-single-colors" role="radiogroup" aria-label="Color del producto">
                            <?php foreach ($product_colors as $index => $color) : ?>
                                <?php
                                $color_slug = sanitize_title($color->slug ?: $color->name);
                                $swatch = uniforma_single_color_swatch($color->name);
                                $is_active_color = $color_slug === $initial_color_slug || (! $initial_color_slug && $index === 0);
                                ?>
                                <button
                                    type="button"
                                    class="uniforma-single-color<?php echo $swatch['light'] ? ' is-light' : ''; ?> <?php echo $is_active_color ? 'is-active' : ''; ?>"
                                    style="--uniforma-swatch-background: <?php echo esc_attr($swatch['background']); ?>;"
                                    title="<?php echo esc_attr($color->name); ?>"
                                    aria-label="Color <?php echo esc_attr($color->name); ?>"
                                    aria-pressed="<?php echo $is_active_color ? 'true' : 'false'; ?>"
                                    role="radio"
                                    aria-checked="<?php echo $is_active_color ? 'true' : 'false'; ?>"
                                    data-value="<?php echo esc_attr($color->name); ?>"
                                    data-slug="<?php echo esc_attr($color_slug); ?>"
                                >
                                    <span class="uniforma-screen-reader-text"><?php echo esc_html($color->name); ?></span>
                                </button>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endif; ?>
                <?php if (! empty($product_talles)) : ?>
                    <div class="uniforma-single-option">
                        <h2>Talles</h2>

                        <div class="uniforma-single-sizes">
                            <?php foreach ($product_talles as $index => $talle) : ?>
                                <button type="button" data-value="<?php echo esc_attr($talle->name); ?>" aria-pressed="<?php echo $index === 0 ? 'true' : 'false'; ?>" class="<?php echo $index === 0 ? 'is-active' : ''; ?>">
                                    <?php echo esc_html($talle->name); ?>
                                </button>
                            <?php endforeach; ?>
                        </div>

                        <a href="#uniformaTablaTalles" class="uniforma-single-size-guide">
                            <?php echo uniforma_single_icon_svg('size'); ?>
                            Guía de talles
                        </a>
                    </div>
                <?php endif; ?>

                <div class="uniforma-single-option">
                    <h2>Tipo de personalización</h2>

                    <div class="uniforma-single-personalization">
                        <?php foreach ($product_personalizaciones as $index => $personalizacion) : ?>
                            <?php
                            $icon = strpos($personalizacion->slug, 'dtf') !== false ? 'printer' : 'needle';
                            ?>
                            <button type="button" data-value="<?php echo esc_attr($personalizacion->name); ?>" aria-pressed="<?php echo $index === 0 ? 'true' : 'false'; ?>" class="<?php echo $index === 0 ? 'is-active' : ''; ?>">
                                <?php echo uniforma_single_icon_svg($icon); ?>
                                <?php echo esc_html($personalizacion->name); ?>
                            </button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="uniforma-single-option">
                    <h2>Cantidad</h2>

                    <div class="uniforma-single-quantity" role="group" aria-label="Cantidad mayorista">
                        <?php foreach (array(5, 10, 20, 50) as $qty_option) : ?>
                            <button
                                type="button"
                                class="uniforma-single-qty-option <?php echo $qty_option === 5 ? 'is-active' : ''; ?>"
                                data-qty="<?php echo esc_attr($qty_option); ?>"
                                data-value="<?php echo esc_attr($qty_option); ?>"
                                data-unit-price="<?php echo esc_attr($price_tiers[$qty_option]); ?>"
                                aria-pressed="<?php echo $qty_option === 5 ? 'true' : 'false'; ?>"
                            >
                                <span><?php echo esc_html('X' . $qty_option); ?></span>
                                <?php if ($price_tiers[$qty_option] > 0) : ?>
                                    <small><?php echo wp_kses_post(wc_price($price_tiers[$qty_option])); ?> c/u</small>
                                <?php endif; ?>
                            </button>
                        <?php endforeach; ?>
                        <input
                            type="number"
                            value="5"
                            min="1"
                            step="1"
                            inputmode="numeric"
                            id="uniformaSingleQty"
                            aria-label="Cantidad de unidades"
                            aria-describedby="uniformaSingleQtyHelp uniformaSingleQtyWarning"
                        >
                        <p class="uniforma-single-quantity__help" id="uniformaSingleQtyHelp">Ingresá cualquier cantidad. El pedido mínimo es de 5 unidades.</p>
                        <p class="uniforma-single-quantity__warning" id="uniformaSingleQtyWarning" role="alert" aria-live="assertive" hidden>
                            El pedido mínimo es de 5 unidades. Ingresá una cantidad igual o mayor para continuar.
                        </p>
                    </div>
                </div>

                <div class="uniforma-single-notes">
                    <label for="uniformaSingleNotes">Aclaraciones para el presupuesto</label>
                    <textarea id="uniformaSingleNotes" rows="4" maxlength="600" placeholder="Ej.: logo en el pecho y en la espalda, bordado en uno y DTF en otro, más 10 pantalones del mismo color…"></textarea>
                    <small>Opcional. Se agrega al mensaje de WhatsApp: podés sumar otras prendas, logos y lados.</small>
                </div>

                <div class="uniforma-single-actions">
                    <a href="<?php echo esc_url($personalize_url); ?>" class="uniforma-single-actions__primary" id="uniformaSinglePersonalize">
                        <?php echo uniforma_single_icon_svg('shirt'); ?>
                        Personalizar prenda
                    </a>

                    <a href="<?php echo esc_url($whatsapp_quote_url); ?>" class="uniforma-single-actions__secondary" id="uniformaSingleQuote" data-product="<?php echo esc_attr($product_title); ?>" data-sku="<?php echo esc_attr($product ? $product->get_sku() : ''); ?>" data-whatsapp="<?php echo esc_attr(uniforma_whatsapp_number()); ?>" data-currency="<?php echo esc_attr(get_woocommerce_currency()); ?>" target="_blank" rel="noopener noreferrer">
                        Pedir presupuesto
                    </a>
                </div>

            </div>

        </div>

        <section class="uniforma-single-info" id="uniformaTablaTalles">

            <div class="uniforma-single-info__details">
                <h2>Detalles</h2>

                <div class="uniforma-single-info__dynamic-content">
                    <?php echo wp_kses_post($details_html); ?>
                </div>
            </div>

            <div class="uniforma-single-info__sizes">
                <h2>Tabla de talles</h2>

                <div class="uniforma-single-size-table-wrap">
                    <div class="uniforma-single-size-drawing">
                        <?php echo uniforma_single_garment_diagram_svg($category_slug); ?>
                    </div>

                    <div class="uniforma-single-size-table">
                        <?php echo wp_kses_post($size_table_html); ?>
                    </div>
                </div>

                <small>* Medidas aproximadas</small>
            </div>

            <div class="uniforma-single-info__care">
                <h2>Cuidados</h2>

                <div class="uniforma-single-care-content">
                    <?php echo wp_kses($care_html, uniforma_single_content_allowed_html()); ?>
                </div>
            </div>

        </section>

                <section class="uniforma-single-order" aria-labelledby="uniformaSingleOrderTitle">
            <h2 id="uniformaSingleOrderTitle">Cómo es tu pedido</h2>
            <ol>
                <li>
                    <span class="uniforma-label">01</span>
                    <strong>Mínimo 5 unidades</strong>
                    <p>Podés combinar talles y colores. Cuantas más unidades, menor el precio por prenda.</p>
                </li>
                <li>
                    <span class="uniforma-label">02</span>
                    <strong>1 logo DTF incluido</strong>
                    <p>El precio incluye 1 estampado DTF de hasta 10 × 3&nbsp;cm por prenda. El bordado no está incluido y se cotiza aparte. Más logos o más tamaño: el precio varía.</p>
                </li>
                <li>
                    <span class="uniforma-label">03</span>
                    <strong>Presupuesto sin compromiso</strong>
                    <p>Nos mandás el logo y te respondemos con el valor final y el plazo de producción, que depende de la cantidad y la técnica.</p>
                </li>
                <li>
                    <span class="uniforma-label">04</span>
                    <strong>Envíos a todo el país</strong>
                    <p>Producimos y enviamos a donde nos necesites.</p>
                </li>
            </ol>
        </section>

        <?php if (! empty($related_ids)) : ?>
            <section class="uniforma-single-related" aria-labelledby="uniformaRelatedTitle">
                <div class="uniforma-single-related__heading">
                    <h2 id="uniformaRelatedTitle">Productos relacionados</h2>
                    <div class="uniforma-single-related__arrows">
                        <button type="button" id="uniformaRelatedPrev" aria-label="Ver productos anteriores">←</button>
                        <button type="button" id="uniformaRelatedNext" aria-label="Ver productos siguientes">→</button>
                    </div>
                </div>

                <div class="uniforma-single-related__grid" id="uniformaRelatedCarousel">
                    <?php
                    foreach ($related_ids as $related_id) {
                        uniforma_render_product_card(wc_get_product($related_id), array('colors' => true, 'actions' => false, 'size' => 'woocommerce_single'));
                    }
                    ?>
                </div>
            </section>
        <?php endif; ?>

        <?php if (! empty($complete_ids)) : ?>
            <section class="uniforma-single-related uniforma-single-complete" aria-labelledby="uniformaCompleteTitle">
                <div class="uniforma-single-related__heading">
                    <h2 id="uniformaCompleteTitle">Completá el pedido</h2>
                    <p class="uniforma-label">Otras prendas para vestir a todo el equipo</p>
                </div>

                <div class="uniforma-single-complete__grid">
                    <?php
                    foreach ($complete_ids as $complete_id) {
                        uniforma_render_product_card(wc_get_product($complete_id), array('colors' => true, 'actions' => false, 'size' => 'woocommerce_single'));
                    }
                    ?>
                </div>
            </section>
        <?php endif; ?>

        <section class="uniforma-single-related uniforma-single-recent" id="uniformaRecentSection" aria-labelledby="uniformaRecentTitle" hidden>
            <div class="uniforma-single-related__heading">
                <h2 id="uniformaRecentTitle">Vistos recientemente</h2>
            </div>
            <div class="uniforma-single-related__grid" id="uniformaRecentGrid"
                 data-ajax-url="<?php echo esc_url(admin_url('admin-ajax.php')); ?>"></div>
        </section>

    </section>

</main>

<?php
get_footer();
