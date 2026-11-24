<?php
/**
 * UNIFORMA - Garment customizer.
 * Shortcode: [uniforma_customizer]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_customizer_get_acf_value($field_name, $post_id, $default = '')
{
    if (function_exists('get_field')) {
        $value = get_field($field_name, $post_id);

        if ($value !== null && $value !== false && $value !== '') {
            return $value;
        }
    }

    $meta = get_post_meta($post_id, $field_name, true);

    return $meta !== '' ? $meta : $default;
}

function uniforma_customizer_image_url($value, $size = 'full')
{
    if (is_array($value)) {
        if (! empty($value['ID'])) {
            return wp_get_attachment_image_url((int) $value['ID'], $size) ?: '';
        }

        if (! empty($value['id'])) {
            return wp_get_attachment_image_url((int) $value['id'], $size) ?: '';
        }

        return ! empty($value['url']) ? esc_url_raw($value['url']) : '';
    }

    if (is_numeric($value)) {
        return wp_get_attachment_image_url((int) $value, $size) ?: '';
    }

    return is_string($value) ? esc_url_raw($value) : '';
}

function uniforma_customizer_get_ordered_attribute_terms($product, $taxonomy)
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

function uniforma_customizer_size_sort_key($label)
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

    if (preg_match('/^(\d+)AL(\d+)$/', $normalized, $matches)) {
        return array(40, (int) $matches[1], $normalized);
    }

    if (in_array($normalized, array('TALLEUNICO', 'UNICO', 'UNICA'), true)) {
        return array(90, 0, $normalized);
    }

    return array(80, 0, $normalized);
}

function uniforma_customizer_sort_size_terms($terms)
{
    $indexed = array();

    foreach ((array) $terms as $index => $term) {
        $indexed[] = array(
            'term' => $term,
            'key' => uniforma_customizer_size_sort_key($term->name),
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

function uniforma_customizer_color_swatch($color_name)
{
    $override = uniforma_term_hex_override($color_name);

    if ('' !== $override) {
        return uniforma_swatch_from_hex($override);
    }

    $slug = sanitize_title(remove_accents((string) $color_name));
    $aliases = array(
        'azul-y-blanco' => 'azul-blanco',
        'blanca-negra' => 'blanco-negro',
        'blanco-azul-marino' => 'blanco-azul-marino',
        'blnco-verde-benetton' => 'blanco-verde-benetton',
        'blnco-rosa' => 'blanco-rosa',
        'gris-y-negro' => 'gris-negro',
        'celaste-localizado' => 'celeste-localizado',
    );

    if (isset($aliases[$slug])) {
        $slug = $aliases[$slug];
    }

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

function uniforma_customizer_variation_image_map($product)
{
    $map = json_decode(get_post_meta($product->get_id(), '_uniforma_color_image_map', true), true);
    $map = is_array($map) ? $map : array();
    $normalized = array();

    foreach ($map as $color_slug => $attachment_id) {
        if ((int) $attachment_id > 0) {
            $normalized[sanitize_title($color_slug)] = (int) $attachment_id;
        }
    }

    if (! empty($normalized) || ! $product->is_type('variable')) {
        return $normalized;
    }

    $variation_ids = get_posts(array(
        'post_type' => 'product_variation',
        'post_parent' => $product->get_id(),
        'post_status' => 'publish',
        'numberposts' => -1,
        'fields' => 'ids',
        'meta_query' => array(
            array(
                'key' => '_thumbnail_id',
                'compare' => 'EXISTS',
            ),
        ),
    ));

    foreach ($variation_ids as $variation_id) {
        $variation = wc_get_product((int) $variation_id);

        if (! $variation instanceof WC_Product_Variation || ! $variation->get_image_id()) {
            continue;
        }

        $attributes = $variation->get_attributes();
        $color_slug = isset($attributes['pa_color']) ? $attributes['pa_color'] : '';

        if ($color_slug && ! isset($normalized[$color_slug])) {
            $normalized[sanitize_title($color_slug)] = (int) $variation->get_image_id();
        }
    }

    return $normalized;
}

function uniforma_customizer_attachment_sources($attachment_id)
{
    return array_filter(array(
        get_post_meta($attachment_id, '_uniforma_source_file', true),
        $attachment_id ? basename((string) get_attached_file($attachment_id)) : '',
        $attachment_id ? get_post_field('post_title', $attachment_id) : '',
        $attachment_id ? get_post_meta($attachment_id, '_wp_attachment_image_alt', true) : '',
    ));
}

function uniforma_customizer_detect_attachment($attachment_id, $color_terms, $variation_image_map)
{
    foreach ((array) $variation_image_map as $color_slug => $mapped_attachment_id) {
        if ((int) $mapped_attachment_id === (int) $attachment_id) {
            return array('color' => sanitize_title($color_slug), 'view' => 'frente');
        }
    }

    $candidate_slugs = array();

    foreach ((array) $color_terms as $term) {
        $candidate_slugs[] = sanitize_title($term->slug ?: $term->name);
    }

    usort($candidate_slugs, function ($left, $right) {
        return strlen($right) <=> strlen($left);
    });

    foreach (uniforma_customizer_attachment_sources($attachment_id) as $source) {
        $normalized = sanitize_title(remove_accents(pathinfo((string) $source, PATHINFO_FILENAME)));
        $view = '';

        if (preg_match('/(?:^|-)(espalda|dorso|back)(?:$|-)/', $normalized)) {
            $view = 'espalda';
        } elseif (preg_match('/(?:^|-)(frente|front)(?:$|-)/', $normalized)) {
            $view = 'frente';
        }

        foreach ($candidate_slugs as $candidate_slug) {
            $with_view = '/(?:^|-)' . preg_quote($candidate_slug, '/') . '-(?:frente|front|espalda|dorso|back)(?:$|-)/';
            $at_end = '/(?:^|-)' . preg_quote($candidate_slug, '/') . '$/';

            if (preg_match($with_view, $normalized) || (! $view && preg_match($at_end, $normalized))) {
                return array(
                    'color' => $candidate_slug,
                    'view' => $view ?: 'frente',
                );
            }
        }
    }

    return array('color' => '', 'view' => '');
}

function uniforma_customizer_attachment_pair_key($attachment_id)
{
    foreach (uniforma_customizer_attachment_sources($attachment_id) as $source) {
        $normalized = sanitize_title(remove_accents(pathinfo((string) $source, PATHINFO_FILENAME)));
        $pair_key = preg_replace('/-(frente|front|espalda|dorso|back)(?:-\d+)?$/', '', $normalized);

        if ($pair_key && $pair_key !== $normalized) {
            return $pair_key;
        }
    }

    return '';
}

function uniforma_customizer_pick_group_views($images)
{
    $front = null;
    $back = null;

    foreach ((array) $images as $image) {
        if (! $front && $image['view'] === 'frente') {
            $front = $image;
        }

        if (! $back && $image['view'] === 'espalda') {
            $back = $image;
        }
    }

    if (! $front && ! empty($images)) {
        $front = $images[0];
    }

    if (! $back && count($images) > 1) {
        foreach ($images as $image) {
            if (! $front || $image['id'] !== $front['id']) {
                $back = $image;
                break;
            }
        }
    }

    return array(
        'front' => $front,
        'back' => $back,
    );
}

function uniforma_customizer_build_product_views($product, $color_terms)
{
    $product_id = $product->get_id();
    $variation_map = uniforma_customizer_variation_image_map($product);
    $attachment_ids = array_values(array_unique(array_filter(array_merge(
        array($product->get_image_id()),
        (array) $product->get_gallery_image_ids(),
        array_values($variation_map)
    ))));
    $records = array();

    foreach ($attachment_ids as $attachment_id) {
        $detected = uniforma_customizer_detect_attachment((int) $attachment_id, $color_terms, $variation_map);
        $records[] = array(
            'id' => (int) $attachment_id,
            'url' => wp_get_attachment_image_url((int) $attachment_id, 'full') ?: wc_placeholder_img_src(),
            'color' => $detected['color'],
            'view' => $detected['view'],
            'pair_key' => uniforma_customizer_attachment_pair_key((int) $attachment_id),
        );
    }

    $pair_color_map = array();

    foreach ($records as $record) {
        if ($record['color'] && $record['pair_key']) {
            $pair_color_map[$record['pair_key']] = $record['color'];
        }
    }

    foreach ($records as $index => $record) {
        if (! $record['color'] && $record['pair_key'] && isset($pair_color_map[$record['pair_key']])) {
            $records[$index]['color'] = $pair_color_map[$record['pair_key']];
        }
    }

    $groups = array();

    foreach ($records as $record) {
        $key = $record['color'] ?: '__generic';

        if (! isset($groups[$key])) {
            $groups[$key] = array();
        }

        $groups[$key][] = $record;
    }

    foreach ($groups as $key => $images) {
        usort($images, function ($left, $right) {
            $order = array('frente' => 0, 'espalda' => 1, '' => 2);
            $left_order = isset($order[$left['view']]) ? $order[$left['view']] : 2;
            $right_order = isset($order[$right['view']]) ? $order[$right['view']] : 2;

            return $left_order === $right_order ? 0 : ($left_order <=> $right_order);
        });
        $groups[$key] = $images;
    }

    $acf_front = uniforma_customizer_image_url(uniforma_customizer_get_acf_value('uniforma_simulador_imagen_frente', $product_id, ''));
    $acf_back = uniforma_customizer_image_url(uniforma_customizer_get_acf_value('uniforma_simulador_imagen_espalda', $product_id, ''));
    $generic = isset($groups['__generic']) ? uniforma_customizer_pick_group_views($groups['__generic']) : array('front' => null, 'back' => null);
    $generic_front = $acf_front;
    $generic_back = $acf_back;

    if (! $generic_front && ! empty($generic['front']['url'])) {
        $generic_front = $generic['front']['url'];
    }

    if (! $generic_back && ! empty($generic['back']['url'])) {
        $generic_back = $generic['back']['url'];
    }

    if (! $generic_front && $product->get_image_id()) {
        $generic_front = wp_get_attachment_image_url($product->get_image_id(), 'full') ?: '';
    }

    if (! $generic_front && ! empty($records[0]['url'])) {
        $generic_front = $records[0]['url'];
    }

    $has_explicit_generic_back = (bool) $generic_back;

    if (! $generic_front) {
        $generic_front = wc_placeholder_img_src();
    }

    if (! $generic_back) {
        $generic_back = $generic_front;
    }

    $views = array();
    $default_color = '';

    foreach ((array) $color_terms as $term) {
        $slug = sanitize_title($term->slug ?: $term->name);
        $picked = isset($groups[$slug]) ? uniforma_customizer_pick_group_views($groups[$slug]) : array('front' => null, 'back' => null);
        $front_url = ! empty($picked['front']['url']) ? $picked['front']['url'] : '';
        $back_url = ! empty($picked['back']['url']) ? $picked['back']['url'] : '';
        $front_exact = (bool) $front_url;
        $back_exact = (bool) $back_url;

        if (! $front_url && isset($variation_map[$slug])) {
            $front_url = wp_get_attachment_image_url((int) $variation_map[$slug], 'full') ?: '';
            $front_exact = (bool) $front_url;
        }

        if (! $front_url) {
            $front_url = $generic_front;
        }

        if (! $back_url) {
            $back_url = $has_explicit_generic_back ? $generic_back : $front_url;
        }

        $views[$slug] = array(
            'frente' => array(
                'url' => $front_url,
                'exact' => $front_exact,
            ),
            'espalda' => array(
                'url' => $back_url,
                'exact' => $back_exact,
            ),
        );

        if (! $default_color && $front_exact) {
            $default_color = $slug;
        }
    }

    if (empty($color_terms)) {
        $views['unico'] = array(
            'frente' => array('url' => $generic_front, 'exact' => true),
            'espalda' => array('url' => $generic_back, 'exact' => $generic_back !== $generic_front),
        );
        $default_color = 'unico';
    }

    if (! $default_color && ! empty($views)) {
        $default_color = array_key_first($views);
    }

    $views['__generic'] = array(
        'frente' => array('url' => $generic_front, 'exact' => false),
        'espalda' => array('url' => $generic_back, 'exact' => false),
    );

    return array(
        'views' => $views,
        'default_color' => $default_color,
    );
}

function uniforma_customizer_location_label($location)
{
    $labels = array(
        'pecho_izquierdo' => 'Pecho izquierdo',
        'pecho_derecho' => 'Pecho derecho',
        'centro_pecho' => 'Centro del pecho',
        'frente_completo' => 'Frente completo',
        'espalda_superior' => 'Espalda superior',
        'espalda_centro' => 'Centro de espalda',
        'espalda_inferior' => 'Espalda inferior',
        'manga_izquierda' => 'Manga izquierda',
        'manga_derecha' => 'Manga derecha',
        'frente_gorra' => 'Frente de gorra',
        'otro' => 'Otra ubicacion',
    );

    return isset($labels[$location]) ? $labels[$location] : ucwords(str_replace('_', ' ', $location));
}

function uniforma_customizer_default_locations()
{
    return array(
        array('value' => 'pecho_izquierdo', 'label' => 'Pecho izquierdo', 'side' => 'frente'),
        array('value' => 'pecho_derecho', 'label' => 'Pecho derecho', 'side' => 'frente'),
        array('value' => 'centro_pecho', 'label' => 'Centro del pecho', 'side' => 'frente'),
        array('value' => 'frente_completo', 'label' => 'Frente completo', 'side' => 'frente'),
        array('value' => 'manga_izquierda', 'label' => 'Manga izquierda', 'side' => 'frente'),
        array('value' => 'manga_derecha', 'label' => 'Manga derecha', 'side' => 'frente'),
        array('value' => 'espalda_superior', 'label' => 'Espalda superior', 'side' => 'espalda'),
        array('value' => 'espalda_centro', 'label' => 'Centro de espalda', 'side' => 'espalda'),
        array('value' => 'espalda_inferior', 'label' => 'Espalda inferior', 'side' => 'espalda'),
        array('value' => 'otro', 'label' => 'Otra ubicacion', 'side' => 'ambas'),
    );
}

function uniforma_customizer_product_locations($product_id)
{
    $locations_raw = uniforma_customizer_get_acf_value('uniforma_ubicaciones_logo', $product_id, array());
    $locations = uniforma_customizer_default_locations();
    $seen = array();

    foreach ($locations as $location) {
        $seen[$location['value']] = true;
    }

    if (! is_array($locations_raw)) {
        return $locations;
    }

    foreach ($locations_raw as $location) {
        if (is_array($location) && isset($location['value'])) {
            $value = sanitize_key($location['value']);
            $label = isset($location['label']) ? sanitize_text_field($location['label']) : uniforma_customizer_location_label($value);
        } elseif (is_string($location)) {
            $value = sanitize_key($location);
            $label = uniforma_customizer_location_label($value);
        } else {
            continue;
        }

        if (! $value || isset($seen[$value])) {
            continue;
        }

        $side = strpos($value, 'espalda') === 0 ? 'espalda' : 'frente';
        $locations[] = array('value' => $value, 'label' => $label, 'side' => $side);
        $seen[$value] = true;
    }

    return $locations;
}

function uniforma_customizer_get_products()
{
    $cache_key = 'uniforma_customizer_products_v130';
    $cached = get_transient($cache_key);

    if (is_array($cached)) {
        return $cached;
    }

    $query = new WP_Query(array(
        'post_type' => 'product',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'orderby' => 'menu_order title',
        'order' => 'ASC',
        'no_found_rows' => true,
    ));
    $products = array();

    if (! $query->have_posts()) {
        return $products;
    }

    while ($query->have_posts()) {
        $query->the_post();
        $product_id = get_the_ID();
        $product = wc_get_product($product_id);

        if (! $product) {
            continue;
        }

        $categories = wc_get_product_terms($product_id, 'product_cat', array('fields' => 'names'));
        $colors = uniforma_customizer_get_ordered_attribute_terms($product, 'pa_color');
        $has_real_colors = ! empty($colors);
        $sizes = uniforma_customizer_sort_size_terms(uniforma_customizer_get_ordered_attribute_terms($product, 'pa_talle'));
        $personalizations = uniforma_customizer_get_ordered_attribute_terms($product, 'pa_personalizacion');

        if (empty($personalizations)) {
            $personalizations = array(
                (object) array('slug' => 'bordado', 'name' => 'Bordado'),
                (object) array('slug' => 'estampado-dtf', 'name' => 'Estampado DTF'),
            );
        }

        if (empty($colors)) {
            $colors = array((object) array('slug' => 'unico', 'name' => 'Unico'));
        }

        $view_data = uniforma_customizer_build_product_views($product, $colors);

        if (! $has_real_colors && isset($view_data['views']['unico'])) {
            $view_data['views']['unico']['frente']['exact'] = true;
            $view_data['views']['unico']['espalda']['exact'] = (
                $view_data['views']['unico']['espalda']['url'] !== $view_data['views']['unico']['frente']['url']
            );
        }

        $product_colors = array();

        foreach ($colors as $term) {
            $swatch = uniforma_customizer_color_swatch($term->name);
            $slug = sanitize_title($term->slug ?: $term->name);
            $product_colors[] = array(
                'slug' => $slug,
                'name' => $term->name,
                'swatch' => $swatch['background'],
                'light' => $swatch['light'],
                'has_front' => ! empty($view_data['views'][$slug]['frente']['exact']),
                'has_back' => ! empty($view_data['views'][$slug]['espalda']['exact']),
            );
        }

        $products[] = array(
            'id' => $product_id,
            'name' => $product->get_name(),
            'category' => ! empty($categories) ? $categories[0] : 'Sin categoria',
            'price' => wp_strip_all_tags($product->get_price_html()),
            'url' => get_permalink($product_id),
            'views' => $view_data['views'],
            'default_color' => $view_data['default_color'],
            'colors' => $product_colors,
            'sizes' => array_map(function ($term) {
                return array(
                    'slug' => sanitize_title($term->slug ?: $term->name),
                    'name' => $term->name,
                );
            }, $sizes),
            'personalizations' => array_map(function ($term) {
                return array(
                    'slug' => sanitize_title($term->slug ?: $term->name),
                    'name' => $term->name,
                );
            }, $personalizations),
            'locations' => uniforma_customizer_product_locations($product_id),
            'min_qty' => (int) apply_filters('uniforma_customizer_min_qty', 5, $product_id),
        );
    }

    wp_reset_postdata();
    set_transient($cache_key, $products, 6 * HOUR_IN_SECONDS);

    return $products;
}

function uniforma_customizer_clear_products_cache($object_id = 0)
{
    if ($object_id) {
        $post_type = get_post_type($object_id);

        if ($post_type && ! in_array($post_type, array('product', 'product_variation'), true)) {
            return;
        }
    }

    delete_transient('uniforma_customizer_products_v130');
}
function uniforma_customizer_clear_products_cache_all()
{
    delete_transient('uniforma_customizer_products_v130');
}

add_action('save_post_product', 'uniforma_customizer_clear_products_cache');
add_action('save_post_product_variation', 'uniforma_customizer_clear_products_cache');
add_action('woocommerce_update_product', 'uniforma_customizer_clear_products_cache');
add_action('created_pa_color', 'uniforma_customizer_clear_products_cache_all');
add_action('edited_pa_color', 'uniforma_customizer_clear_products_cache_all');
add_action('delete_pa_color', 'uniforma_customizer_clear_products_cache_all');
add_action('created_pa_talle', 'uniforma_customizer_clear_products_cache_all');
add_action('edited_pa_talle', 'uniforma_customizer_clear_products_cache_all');
add_action('delete_pa_talle', 'uniforma_customizer_clear_products_cache_all');
add_action('created_pa_personalizacion', 'uniforma_customizer_clear_products_cache_all');
add_action('edited_pa_personalizacion', 'uniforma_customizer_clear_products_cache_all');
add_action('delete_pa_personalizacion', 'uniforma_customizer_clear_products_cache_all');

function uniforma_customizer_initial_config()
{
    $initial = array(
        'product_id' => 0,
        'product_name' => '',
        'color' => '',
        'size' => '',
        'qty' => 5,
    );

    if (isset($_GET['producto_id'])) {
        $initial['product_id'] = absint(wp_unslash($_GET['producto_id']));
    }

    if (isset($_GET['producto'])) {
        $initial['product_name'] = sanitize_text_field(wp_unslash($_GET['producto']));
    }

    foreach (array('attribute_pa_color', 'pa_color', 'color') as $key) {
        if (isset($_GET[$key])) {
            $initial['color'] = sanitize_title(wp_unslash($_GET[$key]));
            break;
        }
    }

    foreach (array('attribute_pa_talle', 'pa_talle', 'talle') as $key) {
        if (isset($_GET[$key])) {
            $initial['size'] = sanitize_title(wp_unslash($_GET[$key]));
            break;
        }
    }

    if (isset($_GET['cantidad'])) {
        $initial['qty'] = max(1, absint(wp_unslash($_GET['cantidad'])));
    }

    return $initial;
}

function uniforma_customizer_shortcode()
{
    if (! class_exists('WooCommerce')) {
        return '<p>WooCommerce no esta activo.</p>';
    }

    $products = uniforma_customizer_get_products();
    $config = array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('uniforma_customizer_nonce'),
        'whatsapp' => uniforma_whatsapp_number(),
        'initial' => uniforma_customizer_initial_config(),
    );

    ob_start();
    ?>
    <main class="uniforma-customizer" id="uniformaCustomizer">
        <script type="application/json" id="uniformaCustomizerData"><?php echo wp_json_encode($products); ?></script>
        <script type="application/json" id="uniformaCustomizerConfig"><?php echo wp_json_encode($config); ?></script>

        <section class="uc-head">
            <span>Simulador UNIFORMA</span>
            <h1>Personaliz&aacute; tu uniforme</h1>
            <p>Dise&ntilde;&aacute; el frente y la espalda, agreg&aacute; todos los logos que necesites y solicit&aacute; un &uacute;nico presupuesto.</p>
        </section>

        <?php if (empty($products)) : ?>
            <section class="uniforma-customizer-empty">
                <h2>No hay productos publicados para personalizar</h2>
            </section>
        <?php else : ?>
            <section class="uc-layout">
                <div class="uc-left">
                    <div class="uc-preview-card">
                        <div class="uc-preview-toolbar">
                            <div class="uc-view-tabs" role="tablist" aria-label="Vista de la prenda">
                                <button type="button" class="uc-view-tab is-active" data-view="frente" role="tab" aria-selected="true">Frente</button>
                                <button type="button" class="uc-view-tab" data-view="espalda" role="tab" aria-selected="false">Espalda</button>
                            </div>
                            <span class="uc-view-status" id="ucViewStatus">Imagen del color seleccionado</span>
                        </div>

                        <div class="uc-canvas" id="uniformaCanvas">
                            <div id="uniformaNoProductMessage" class="uc-no-product-message" hidden>
                                <strong>Eleg&iacute; una prenda para empezar</strong>
                                <p>Busc&aacute; o seleccion&aacute; un producto en el panel de la derecha. Despu&eacute;s vas a poder cargar tu logo, elegir color y talle, y ver una vista previa antes de pedir tu presupuesto.</p>
                            </div>
                            <img id="uniformaGarmentImage" alt="Prenda para personalizar">
                            <div id="uniformaLogoStage" aria-label="Area de personalizacion"></div>
                            <p id="uniformaLogoPlaceholder">Carg&aacute; uno o m&aacute;s logos y ubicalos sobre esta vista</p>
                            <span class="uc-canvas-side" id="ucCanvasSide">FRENTE</span>
                        </div>

                        <div class="uc-preview-help">
                            <span>Arrastr&aacute; cada logo para moverlo.</span>
                            <span>Us&aacute; la esquina para cambiar su tama&ntilde;o.</span>
                        </div>
                    </div>
                </div>

                <div class="uc-right">
                <aside class="uc-panel">
                    <h2>Tu dise&ntilde;o</h2>

                    <div class="uc-step">
                        <h3>1. &iquest;Qu&eacute; prenda busc&aacute;s?</h3>
                        <label class="uc-search-label" for="uniformaProductSearch">Buscar producto</label>
                        <input type="search" id="uniformaProductSearch" class="uc-product-search" placeholder="Ej: remera, ambo, campera..." autocomplete="off">
                        <select id="uniformaProductSelect" aria-label="Producto">
                            <option value="">Selecciona una prenda</option>
                            <?php foreach ($products as $item) : ?>
                                <option value="<?php echo esc_attr($item['id']); ?>"><?php echo esc_html($item['name']); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="uc-step">
                        <h3>2. Eleg&iacute; color, talle y cantidad</h3>
                        <div class="uc-color-heading">
                            <span>Color</span>
                            <strong id="ucSelectedColor">-</strong>
                        </div>
                        <div id="ucColorSwatches" class="uc-swatches" role="radiogroup" aria-label="Color"></div>
                        <select id="uniformaColorSelect" hidden></select>

                        <div class="uc-two">
                            <label>Talle
                                <select id="uniformaSizeSelect"></select>
                            </label>
                            <label>Cantidad
                                <input type="number" id="uniformaQtyInput" value="5" min="1" step="1" inputmode="numeric">
                            </label>
                        </div>

                        <div class="uc-qty-presets" aria-label="Cantidades rapidas">
                            <button type="button" data-qty="5" class="is-active">5</button>
                            <button type="button" data-qty="10">10</button>
                            <button type="button" data-qty="20">20</button>
                            <button type="button" data-qty="50">50</button>
                        </div>
                        <p class="uc-field-error" id="ucQtyError" hidden>El pedido m&iacute;nimo es de 5 unidades.</p>
                    </div>

                    <div class="uc-step uc-step--logos">
                        <div class="uc-step-row">
                            <h3>3. Logos y personalizaci&oacute;n</h3>
                            <span>Varios logos</span>
                        </div>
                        <input type="file" id="uniformaLogoUpload" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple hidden>
                        <button type="button" id="ucAddLogo" class="uc-add-logo">+ Agregar logos</button>
                        <small>Cada logo puede tener su propia vista, t&eacute;cnica, medida, rotaci&oacute;n, color y fondo transparente. Las medidas se guardan en cent&iacute;metros; la escala de la vista previa es orientativa.</small>
                        <div id="ucLogoList" class="uc-logo-list">
                            <p class="uc-logo-list-empty">Todav&iacute;a no cargaste logos.</p>
                        </div>
                    </div>

                    <div class="uc-step">
                        <h3>4. Observaciones</h3>
                        <textarea id="uniformaNotesInput" placeholder="Ej: entrega para determinada fecha, detalle de colores del logo, indicaciones especiales..."></textarea>
                    </div>

                    <button type="button" id="ucAddItem" class="uc-save">Agregar al pedido y seguir dise&ntilde;ando</button>
                    <button type="button" id="uniformaWhatsappButton" class="uc-send">Solicitar presupuesto (<span id="ucSendCount">0</span>)</button>
                </aside>

                <div class="uc-order-card">
                    <div class="uc-order-title">
                        <h2>Tu pedido actual</h2>
                        <span id="ucOrderCount">0 prendas</span>
                    </div>
                    <div id="ucOrderList" class="uc-order-list">
                        <p class="uc-empty">Todav&iacute;a no agregaste prendas.</p>
                    </div>
                </div>
                </div>
            </section>
        <?php endif; ?>
    </main>
    <?php

    return ob_get_clean();
}
add_shortcode('uniforma_customizer', 'uniforma_customizer_shortcode');
