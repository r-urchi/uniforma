<?php
/**
 * UNIFORMA — Puerta de entrada para crear y actualizar productos desde el ERP.
 *
 * Rutas (todas protegidas con la clave UNIFORMA_CATALOG_SYNC_TOKEN, que debe estar en wp-config.php):
 *   GET  /wp-json/uniforma/v1/taxonomies  Categorías, colores, talles y etiquetas que ya existen.
 *   POST /wp-json/uniforma/v1/product     Crea o actualiza un producto variable (colores x talles).
 *
 * El POST acepta "dryRun": true para verificar todo sin guardar nada, y "statusOnly": true
 * para cambiar solo el estado (publicado, borrador, pendiente, privado) de un producto.
 *
 * Reglas de seguridad de los datos:
 *  - Todo se valida ANTES de escribir; un error nunca deja cambios a medias.
 *  - Un campo que no viene en el pedido no se toca.
 *  - Los textos con formato (enlaces, negritas, imágenes) solo se reemplazan si el texto cambió.
 *  - No se borra ninguna variación: las que sobran quedan privadas y se avisa.
 *  - Productos que usan otros atributos de variación se rechazan para no corromperlos.
 */

if (! defined('ABSPATH')) {
    exit;
}

class UniformaErpException extends Exception
{
    public $status = 400;
    public $details = array();

    public function __construct($message, $status = 400, $details = array())
    {
        parent::__construct($message);
        $this->status = (int) $status;
        $this->details = (array) $details;
    }
}

const UNIFORMA_ERP_STATUSES = array('publish', 'draft', 'pending', 'private');

/* =========================================
   TEXTO <-> HTML
   El ERP trabaja con texto simple: una línea por párrafo y «- » al comienzo para viñetas.
========================================= */

function uniforma_erp_html_to_text($html)
{
    $html = wp_check_invalid_utf8((string) $html, true);
    $html = preg_replace('#<li[^>]*>#i', "\n- ", $html);
    $html = preg_replace('#</(p|div|ul|ol|h[1-6]|tr|table)>#i', "\n", $html);
    $html = preg_replace('#<br\s*/?>#i', "\n", $html);
    $text = html_entity_decode(wp_strip_all_tags($html), ENT_QUOTES, 'UTF-8');
    $parts = preg_split('/\R/u', $text);

    if (false === $parts) {
        $parts = explode("\n", str_replace("\r", '', $text));
    }

    $lines = array_map('trim', $parts);

    return trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $lines)));
}

function uniforma_erp_text_to_html($text)
{
    $text = trim((string) $text);

    if ('' === $text) {
        return '';
    }

    $html = '';
    $items = array();
    $flush = static function () use (&$html, &$items) {
        if ($items) {
            $html .= '<ul>' . implode('', $items) . '</ul>';
            $items = array();
        }
    };

    foreach (preg_split('/\R/u', $text) as $line) {
        $line = trim($line);

        if ('' === $line) {
            $flush();
            continue;
        }

        if (preg_match('/^[-•*]\s+(.*)$/u', $line, $matches)) {
            $items[] = '<li>' . esc_html($matches[1]) . '</li>';
            continue;
        }

        $flush();
        $html .= '<p>' . esc_html($line) . '</p>';
    }

    $flush();

    return $html;
}

/** ¿El texto que mandó el ERP es el mismo que ya tiene la web (ignorando el formato)? */
function uniforma_erp_same_text($current_html, $sent_text)
{
    $normalize = static function ($text) {
        return trim(preg_replace("/\n{3,}/", "\n\n", preg_replace('/\R/u', "\n", (string) $text)));
    };

    return $normalize(uniforma_erp_html_to_text($current_html)) === $normalize($sent_text);
}

function uniforma_erp_size_chart_to_html($rows)
{
    $body = '';

    foreach ((array) $rows as $row) {
        if (! is_array($row)) {
            continue;
        }

        $size = isset($row['size']) && is_scalar($row['size']) ? trim((string) $row['size']) : '';

        if ('' === $size) {
            continue;
        }

        $width = isset($row['width']) && is_scalar($row['width']) ? (string) $row['width'] : '';
        $length = isset($row['length']) && is_scalar($row['length']) ? (string) $row['length'] : '';
        $body .= '<tr><td>' . esc_html($size) . '</td><td>' . esc_html($width) . '</td><td>' . esc_html($length) . '</td></tr>';
    }

    if ('' === $body) {
        return '';
    }

    return '<table><thead><tr><th>Talle</th><th>Ancho (cm)</th><th>Largo (cm)</th></tr></thead><tbody>' . $body . '</tbody></table>';
}

/* =========================================
   TÉRMINOS Y ATRIBUTOS
========================================= */

function uniforma_erp_ensure_attribute($slug, $label, $dry_run)
{
    $taxonomy = wc_attribute_taxonomy_name($slug);

    if (taxonomy_exists($taxonomy)) {
        $id = (int) wc_attribute_taxonomy_id_by_name($slug);

        if ($id <= 0 && ! $dry_run) {
            throw new UniformaErpException('No se encontró el atributo «' . $label . '» en WooCommerce. Revisalo en Productos → Atributos.', 500);
        }

        return array('taxonomy' => $taxonomy, 'created' => false, 'id' => $id);
    }

    if ($dry_run) {
        return array('taxonomy' => $taxonomy, 'created' => true, 'id' => 0);
    }

    $result = wc_create_attribute(array(
        'name'         => $label,
        'slug'         => $slug,
        'type'         => 'select',
        'order_by'     => 'menu_order',
        'has_archives' => false,
    ));

    if (is_wp_error($result)) {
        throw new UniformaErpException('No se pudo crear el atributo «' . $label . '»: ' . $result->get_error_message(), 500);
    }

    register_taxonomy($taxonomy, array('product'), array(
        'hierarchical' => false,
        'show_ui'      => false,
        'query_var'    => true,
        'rewrite'      => false,
    ));

    return array('taxonomy' => $taxonomy, 'created' => true, 'id' => (int) $result);
}

function uniforma_erp_term($taxonomy, $name, $dry_run, $hex = '')
{
    $term = get_term_by('name', $name, $taxonomy);

    if (! $term) {
        $term = get_term_by('slug', sanitize_title($name), $taxonomy);
    }

    if ($term && ! is_wp_error($term)) {
        if ('' !== $hex && ! $dry_run) {
            update_term_meta($term->term_id, 'uniforma_hex', $hex);
        }

        return array('id' => (int) $term->term_id, 'slug' => $term->slug, 'name' => $term->name, 'created' => false);
    }

    if ($dry_run || ! taxonomy_exists($taxonomy)) {
        return array('id' => 0, 'slug' => sanitize_title($name), 'name' => $name, 'created' => true);
    }

    $inserted = wp_insert_term($name, $taxonomy, array('slug' => sanitize_title($name)));

    if (is_wp_error($inserted)) {
        // Otro proceso lo creó justo antes: se usa ese.
        if ('term_exists' === $inserted->get_error_code()) {
            $existing_id = (int) $inserted->get_error_data('term_exists');
            $existing = get_term($existing_id, $taxonomy);

            if ($existing && ! is_wp_error($existing)) {
                if ('' !== $hex) {
                    update_term_meta($existing_id, 'uniforma_hex', $hex);
                }

                return array('id' => $existing_id, 'slug' => $existing->slug, 'name' => $existing->name, 'created' => false);
            }
        }

        throw new UniformaErpException('No se pudo crear «' . $name . '»: ' . $inserted->get_error_message(), 500);
    }

    if ('' !== $hex) {
        update_term_meta((int) $inserted['term_id'], 'uniforma_hex', $hex);
    }

    $created = get_term((int) $inserted['term_id'], $taxonomy);

    return array('id' => (int) $inserted['term_id'], 'slug' => $created->slug, 'name' => $created->name, 'created' => true);
}

function uniforma_erp_category_ids($names, $create, $dry_run, &$missing)
{
    $ids = array();

    foreach ($names as $name) {
        $term = get_term_by('name', $name, 'product_cat');

        if (! $term) {
            $term = get_term_by('slug', sanitize_title($name), 'product_cat');
        }

        if ($term && ! is_wp_error($term)) {
            $ids[] = (int) $term->term_id;
            continue;
        }

        if (! $create) {
            $missing[] = $name;
            continue;
        }

        if (! $dry_run) {
            $inserted = wp_insert_term($name, 'product_cat');

            if (is_wp_error($inserted)) {
                if ('term_exists' === $inserted->get_error_code()) {
                    $ids[] = (int) $inserted->get_error_data('term_exists');
                    continue;
                }

                throw new UniformaErpException('No se pudo crear la categoría «' . $name . '»: ' . $inserted->get_error_message(), 500);
            }

            $ids[] = (int) $inserted['term_id'];
        }
    }

    return $ids;
}

function uniforma_erp_tag_ids($names)
{
    $ids = array();

    foreach ($names as $name) {
        $term = get_term_by('name', $name, 'product_tag');

        if ($term && ! is_wp_error($term)) {
            $ids[] = (int) $term->term_id;
            continue;
        }

        $inserted = wp_insert_term($name, 'product_tag');

        if (! is_wp_error($inserted)) {
            $ids[] = (int) $inserted['term_id'];
        } elseif ('term_exists' === $inserted->get_error_code()) {
            $ids[] = (int) $inserted->get_error_data('term_exists');
        }
    }

    return $ids;
}

function uniforma_erp_set_field($key, $value, $post_id)
{
    if (function_exists('update_field')) {
        update_field($key, $value, $post_id);

        return;
    }

    update_post_meta($post_id, $key, $value);
}

/* =========================================
   BLOQUEO CONTRA GUARDADOS SIMULTÁNEOS
   Evita crear dos veces el mismo producto si el ERP reintenta mientras el primer pedido sigue en curso.
========================================= */

function uniforma_erp_acquire_lock($key)
{
    $name = 'uniforma_erp_lock_' . md5((string) $key);
    $existing = get_option($name);

    if ($existing && (time() - (int) $existing) > 600) {
        delete_option($name);
    }

    if (! add_option($name, time(), '', 'no')) {
        throw new UniformaErpException('Este producto ya se está guardando. Esperá un minuto y volvé a intentar.', 409);
    }

    return $name;
}

/* =========================================
   ENTRADA: LIMPIEZA Y VALIDACIÓN
   Un campo que no viene en el pedido queda en null y no se toca.
========================================= */

function uniforma_erp_scalar($value)
{
    return is_scalar($value) ? (string) $value : '';
}

function uniforma_erp_clean_list($values, $max = 60)
{
    $clean = array();
    $seen = array();

    foreach ((array) $values as $value) {
        $text = sanitize_text_field(uniforma_erp_scalar($value));
        $key = strtolower(remove_accents($text));

        if ('' === $text || isset($seen[$key])) {
            continue;
        }

        $seen[$key] = true;
        $clean[] = $text;

        if (count($clean) >= $max) {
            break;
        }
    }

    return $clean;
}

function uniforma_erp_normalize_input($data, $status, &$warnings, $woo_id = 0)
{
    $errors = array();

    $name = sanitize_text_field(uniforma_erp_scalar(isset($data['name']) ? $data['name'] : ''));

    if (strlen($name) < 3) {
        $errors[] = 'El nombre del producto es obligatorio (mínimo 3 letras).';
    }

    $sku = preg_replace('/[^A-Za-z0-9._\-]/', '', uniforma_erp_scalar(isset($data['sku']) ? $data['sku'] : ''));

    // Precios: null = el pedido no trae ese tramo (no se toca).
    $prices = array();
    $sent_prices = isset($data['prices']) && is_array($data['prices']) ? $data['prices'] : null;
    foreach (array(5, 10, 20, 50) as $qty) {
        if (null === $sent_prices || (! array_key_exists((string) $qty, $sent_prices) && ! array_key_exists($qty, $sent_prices))) {
            $prices[$qty] = null;
            continue;
        }

        $value = array_key_exists((string) $qty, $sent_prices) ? $sent_prices[(string) $qty] : $sent_prices[$qty];
        $prices[$qty] = is_numeric($value) && (float) $value > 0 ? round((float) $value, 2) : 0.0;
    }

    $effective_5 = null !== $prices[5] ? $prices[5] : ($woo_id > 0 ? (float) get_post_meta($woo_id, 'uniforma_precio_x5', true) : 0.0);

    if ('publish' === $status && $effective_5 <= 0) {
        $errors[] = 'Para publicar hace falta el precio x5. Cargalo o dejá el producto como borrador.';
    }

    $last = 0;
    foreach ($prices as $qty => $price) {
        if (null === $price || $price <= 0) {
            continue;
        }

        if ($last > 0 && $price > $last) {
            $warnings[] = 'El precio x' . $qty . ' es más caro que el tramo anterior: revisá los precios.';
        }

        $last = $price;
    }

    $colors = array();
    $seen_colors = array();
    foreach ((array) (isset($data['colors']) ? $data['colors'] : array()) as $color) {
        $color_name = sanitize_text_field(uniforma_erp_scalar(is_array($color) ? (isset($color['name']) ? $color['name'] : '') : $color));
        $key = sanitize_title(remove_accents($color_name));

        if ('' === $color_name || '' === $key || isset($seen_colors[$key])) {
            continue;
        }

        $hex = is_array($color) && isset($color['hex']) ? uniforma_erp_scalar($color['hex']) : '';
        $seen_colors[$key] = true;
        $colors[] = array('name' => $color_name, 'hex' => preg_match('/^#[0-9a-fA-F]{6}$/', $hex) ? strtolower($hex) : '');
    }

    $sizes = array();
    $seen_sizes = array();
    foreach (uniforma_erp_clean_list(isset($data['sizes']) ? $data['sizes'] : array(), 40) as $size) {
        $key = sanitize_title(remove_accents($size));

        if ('' === $key || isset($seen_sizes[$key])) {
            continue;
        }

        $seen_sizes[$key] = true;
        $sizes[] = $size;
    }

    if (! $colors) {
        $errors[] = 'Elegí al menos un color.';
    }

    if (! $sizes) {
        $errors[] = 'Elegí al menos un talle.';
    }

    if (count($colors) * count($sizes) > 400) {
        $errors[] = 'Son demasiadas combinaciones de color y talle (máximo 400).';
    }

    $categories = array_key_exists('categories', $data) ? uniforma_erp_clean_list($data['categories'], 12) : null;

    if ('publish' === $status && null !== $categories && ! $categories) {
        $errors[] = 'Para publicar elegí al menos una categoría.';
    }

    if ($errors) {
        throw new UniformaErpException('Faltan datos para continuar.', 422, $errors);
    }

    $text = static function ($key) use ($data) {
        return array_key_exists($key, $data) ? uniforma_erp_scalar($data[$key]) : null;
    };
    $html = static function ($value) {
        return null === $value ? null : wp_kses_post(uniforma_erp_text_to_html($value));
    };

    $size_chart_html = '';
    if (isset($data['sizeChart']) && is_array($data['sizeChart'])) {
        $size_chart_html = wp_kses_post(uniforma_erp_size_chart_to_html($data['sizeChart']));
    }

    $string_or_null = static function ($key) use ($data) {
        return array_key_exists($key, $data) ? sanitize_text_field(uniforma_erp_scalar($data[$key])) : null;
    };

    return array(
        'name'              => $name,
        'slug'              => sanitize_title(uniforma_erp_scalar(isset($data['slug']) ? $data['slug'] : '')),
        'sku'               => $sku,
        'categories'        => $categories,
        'createCategories'  => ! empty($data['createCategories']),
        'tags'              => array_key_exists('tags', $data) ? uniforma_erp_clean_list($data['tags'], 20) : null,
        'shortDescription'  => $html($text('shortDescription')),
        'description'       => $html($text('description')),
        'details'           => $html($text('details')),
        'care'              => $html($text('care')),
        'rawShort'          => $text('shortDescription'),
        'rawDescription'    => $text('description'),
        'rawDetails'        => $text('details'),
        'rawCare'           => $text('care'),
        'sizeChartHtml'     => $size_chart_html,
        'isNew'             => array_key_exists('isNew', $data) ? ! empty($data['isNew']) : null,
        'buttonPersonalize' => $string_or_null('buttonPersonalize'),
        'buttonQuote'       => $string_or_null('buttonQuote'),
        'seoDescription'    => $string_or_null('seoDescription'),
        'minQuantity'       => isset($data['minQuantity']) && is_numeric($data['minQuantity']) ? max(1, (int) $data['minQuantity']) : null,
        'prices'            => $prices,
        'colors'            => $colors,
        'sizes'             => $sizes,
    );
}

/* =========================================
   CAMBIO DE ESTADO
========================================= */

function uniforma_erp_set_status($woo_id, $status, $dry_run)
{
    $post = $woo_id > 0 ? get_post($woo_id) : null;

    if (! $post || 'product' !== $post->post_type) {
        throw new UniformaErpException('No se encontró el producto en la web.', 404);
    }

    if ('trash' === $post->post_status) {
        throw new UniformaErpException('El producto está en la papelera de WordPress.', 409);
    }

    $product = wc_get_product($woo_id);

    if (! $product) {
        throw new UniformaErpException('No se pudo abrir el producto en la web.', 404);
    }

    if ('publish' === $status && (float) get_post_meta($woo_id, 'uniforma_precio_x5', true) <= 0) {
        throw new UniformaErpException('Para publicar hace falta el precio x5. Cargalo y guardá el producto antes.', 422);
    }

    if (! $dry_run) {
        $product->set_status($status);
        $product->save();
    }

    return array(
        'ok'        => true,
        'dryRun'    => (bool) $dry_run,
        'wooId'     => (int) $woo_id,
        'status'    => $status,
        'permalink' => get_permalink($woo_id),
        'editUrl'   => admin_url('post.php?post=' . (int) $woo_id . '&action=edit'),
        'product'   => uniforma_catalog_product_payload(wc_get_product($woo_id)),
    );
}

/* =========================================
   CREAR / ACTUALIZAR PRODUCTO
========================================= */

function uniforma_erp_product_handle(WP_REST_Request $request)
{
    if (! function_exists('wc_get_product')) {
        throw new UniformaErpException('WooCommerce no está activo en la web.', 503);
    }

    $data = $request->get_json_params();

    if (! is_array($data)) {
        throw new UniformaErpException('La solicitud no trae datos válidos.', 400);
    }

    $dry_run = ! empty($data['dryRun']);

    $woo_id = 0;
    if (isset($data['wooId']) && '' !== $data['wooId'] && 0 !== $data['wooId'] && '0' !== $data['wooId']) {
        if (! is_scalar($data['wooId']) || ! ctype_digit((string) $data['wooId'])) {
            throw new UniformaErpException('El identificador del producto en la web no es válido.', 422);
        }

        $woo_id = (int) $data['wooId'];
    }

    $is_new = $woo_id <= 0;
    $existing_post = null;

    if (! $is_new) {
        $existing_post = get_post($woo_id);

        if (! $existing_post || 'product' !== $existing_post->post_type) {
            throw new UniformaErpException('El producto ' . $woo_id . ' ya no existe en la web. Sincronizá el catálogo.', 404);
        }

        if ('trash' === $existing_post->post_status) {
            throw new UniformaErpException('El producto está en la papelera de WordPress. Restauralo o sincronizá el catálogo.', 409);
        }
    }

    // Sin estado en el pedido: un producto nuevo queda como borrador y uno existente conserva el suyo.
    $status = isset($data['status']) ? uniforma_erp_scalar($data['status']) : ($is_new ? 'draft' : (string) $existing_post->post_status);

    if (! in_array($status, UNIFORMA_ERP_STATUSES, true)) {
        throw new UniformaErpException('El estado tiene que ser publish, draft, pending o private.', 422);
    }

    if (! empty($data['statusOnly'])) {
        return uniforma_erp_set_status($woo_id, $status, $dry_run);
    }

    $warnings = array();
    $input = uniforma_erp_normalize_input($data, $status, $warnings, $woo_id);

    // ---------- Fase 1: verificar todo SIN escribir nada ----------

    $color_attr = uniforma_erp_ensure_attribute('color', 'Color', true);
    $size_attr = uniforma_erp_ensure_attribute('talle', 'Talle', true);

    $plan = array(
        'attributesToCreate' => array(),
        'colorsToCreate'     => array(),
        'sizesToCreate'      => array(),
    );

    if ($color_attr['created']) {
        $plan['attributesToCreate'][] = 'Color';
    }

    if ($size_attr['created']) {
        $plan['attributesToCreate'][] = 'Talle';
    }

    $color_terms = array();
    foreach ($input['colors'] as $color) {
        $term = uniforma_erp_term($color_attr['taxonomy'], $color['name'], true);

        if ($term['created']) {
            $plan['colorsToCreate'][] = $color['name'];
        }

        $color_terms[] = $term;
    }

    $size_terms = array();
    foreach ($input['sizes'] as $size) {
        $term = uniforma_erp_term($size_attr['taxonomy'], $size, true);

        if ($term['created']) {
            $plan['sizesToCreate'][] = $size;
        }

        $size_terms[] = $term;
    }

    if (null !== $input['categories']) {
        $missing_categories = array();
        uniforma_erp_category_ids($input['categories'], $input['createCategories'], true, $missing_categories);

        if ($missing_categories) {
            throw new UniformaErpException(
                'Estas categorías no existen en la web: ' . implode(', ', $missing_categories) . '. Elegí una existente o creala desde el ERP.',
                422,
                array('missingCategories' => $missing_categories)
            );
        }
    }

    if ('' !== $input['sku']) {
        $owner = (int) wc_get_product_id_by_sku($input['sku']);

        if ($owner && $owner !== $woo_id) {
            throw new UniformaErpException('Ese SKU ya lo usa otro producto de la web (n.º ' . $owner . ').', 409, array('wooId' => $owner));
        }
    }

    $product = null;
    $existing_variations = array();

    if (! $is_new) {
        $product = wc_get_product($woo_id);

        if (! $product) {
            throw new UniformaErpException('No se pudo abrir el producto ' . $woo_id . '.', 404);
        }

        if (! $product->is_type(array('simple', 'variable'))) {
            throw new UniformaErpException('El producto es de tipo «' . $product->get_type() . '»: solo se actualizan productos simples o variables.', 409);
        }

        if ($product->is_type('variable')) {
            $conflicts = array();

            foreach ($product->get_attributes() as $key => $attribute) {
                if ($attribute instanceof WC_Product_Attribute && $attribute->get_variation() && ! in_array($key, array('pa_color', 'pa_talle'), true)) {
                    $conflicts[] = $attribute->is_taxonomy() ? wc_attribute_label($attribute->get_name()) : $attribute->get_name();
                }
            }

            if ($conflicts) {
                throw new UniformaErpException(
                    'El producto usa otros atributos de variación (' . implode(', ', $conflicts) . '). Corregilo a mano en WordPress antes de actualizarlo desde el ERP.',
                    409,
                    array('conflictingAttributes' => $conflicts)
                );
            }

            $unmatched = array();

            foreach ($product->get_children() as $child_id) {
                $variation = wc_get_product($child_id);

                if (! $variation || ! $variation->is_type('variation')) {
                    continue;
                }

                $attributes = $variation->get_attributes();
                $color_slug = isset($attributes['pa_color']) ? (string) $attributes['pa_color'] : '';
                $size_slug = isset($attributes['pa_talle']) ? (string) $attributes['pa_talle'] : '';

                if ('' === $color_slug || '' === $size_slug) {
                    $unmatched[] = '#' . $child_id;
                    continue;
                }

                $existing_variations[$color_slug . '|' . $size_slug] = (int) $child_id;
            }

            if ($unmatched) {
                throw new UniformaErpException(
                    'Hay variaciones sin color o sin talle (' . implode(', ', array_slice($unmatched, 0, 8)) . '). Corregilas en WordPress antes de actualizar el producto desde el ERP.',
                    409,
                    array('unmatchedVariations' => $unmatched)
                );
            }
        }
    }

    $matrix = array();
    foreach ($color_terms as $color_term) {
        foreach ($size_terms as $size_term) {
            $matrix[$color_term['slug'] . '|' . $size_term['slug']] = true;
        }
    }

    $to_create = array_diff_key($matrix, $existing_variations);
    $extra = array_diff_key($existing_variations, $matrix);

    if ($extra) {
        $warnings[] = count($extra) . ' variación(es) que ya existían en la web no están en esta combinación de colores y talles: no se borran, pero quedan en privado.';
    }

    $summary = array(
        'ok'         => true,
        'dryRun'     => $dry_run,
        'created'    => $is_new,
        'wooId'      => $woo_id,
        'status'     => $status,
        'plan'       => $plan,
        'variations' => array(
            'total'       => count($matrix),
            'toCreate'    => count($to_create),
            'existing'    => count(array_intersect_key($existing_variations, $matrix)),
            'notInMatrix' => count($extra),
        ),
        'warnings'   => $warnings,
    );

    if ($dry_run) {
        return $summary;
    }

    // ---------- Fase 2: escribir (con bloqueo contra guardados simultáneos) ----------

    $lock = uniforma_erp_acquire_lock($woo_id ? 'id-' . $woo_id : ('' !== $input['sku'] ? 'sku-' . $input['sku'] : 'name-' . $input['name']));

    try {
        if (function_exists('wc_set_time_limit')) {
            wc_set_time_limit(0);
        }

        ignore_user_abort(true);
        wp_defer_term_counting(true);

        $color_attr = uniforma_erp_ensure_attribute('color', 'Color', false);
        $size_attr = uniforma_erp_ensure_attribute('talle', 'Talle', false);

        $color_terms = array();
        foreach ($input['colors'] as $color) {
            $term = uniforma_erp_term($color_attr['taxonomy'], $color['name'], false, $color['hex']);
            $term['hex'] = $color['hex'];
            $color_terms[] = $term;
        }

        $size_terms = array();
        foreach ($input['sizes'] as $size) {
            $size_terms[] = uniforma_erp_term($size_attr['taxonomy'], $size, false);
        }

        $category_ids = null;
        if (null !== $input['categories']) {
            $missing = array();
            $category_ids = uniforma_erp_category_ids($input['categories'], $input['createCategories'], false, $missing);
        }

        if ($is_new) {
            $product = new WC_Product_Variable();
            $product->set_catalog_visibility('visible');
        } elseif (! $product->is_type('variable')) {
            wp_set_object_terms($woo_id, 'variable', 'product_type');
            clean_post_cache($woo_id);
            $product = new WC_Product_Variable($woo_id);
            // Un producto simple podía tener stock y precio propios: en uno variable los manejan las variaciones.
            $product->set_manage_stock(false);
            $product->set_regular_price('');
            $product->set_sale_price('');
        }

        $product->set_name($input['name']);
        $product->set_status($status);

        if (null !== $input['shortDescription'] && ($is_new || ! uniforma_erp_same_text($product->get_short_description(), $input['rawShort']))) {
            $product->set_short_description($input['shortDescription']);
        }

        if (null !== $input['description'] && ($is_new || ! uniforma_erp_same_text($product->get_description(), $input['rawDescription']))) {
            $product->set_description($input['description']);
        }

        if (null !== $category_ids) {
            $product->set_category_ids($category_ids);
        }

        if (null !== $input['tags']) {
            $product->set_tag_ids(uniforma_erp_tag_ids($input['tags']));
        }

        if ('' !== $input['slug']) {
            $product->set_slug($input['slug']);
        }

        if ('' !== $input['sku'] && $input['sku'] !== $product->get_sku()) {
            try {
                $product->set_sku($input['sku']);
            } catch (WC_Data_Exception $exception) {
                throw new UniformaErpException('Ese SKU ya lo usa otro producto de la web.', 409);
            }
        }

        $attributes = $product->get_attributes();

        $color_attribute = new WC_Product_Attribute();
        $color_attribute->set_id($color_attr['id']);
        $color_attribute->set_name($color_attr['taxonomy']);
        $color_attribute->set_options(array_map('intval', wp_list_pluck($color_terms, 'id')));
        $color_attribute->set_position(0);
        $color_attribute->set_visible(true);
        $color_attribute->set_variation(true);

        $size_attribute = new WC_Product_Attribute();
        $size_attribute->set_id($size_attr['id']);
        $size_attribute->set_name($size_attr['taxonomy']);
        $size_attribute->set_options(array_map('intval', wp_list_pluck($size_terms, 'id')));
        $size_attribute->set_position(1);
        $size_attribute->set_visible(true);
        $size_attribute->set_variation(true);

        $attributes[$color_attr['taxonomy']] = $color_attribute;
        $attributes[$size_attr['taxonomy']] = $size_attribute;
        $product->set_attributes($attributes);

        $product_id = $product->save();

        if (! $product_id) {
            throw new UniformaErpException('WooCommerce no pudo guardar el producto.', 500);
        }

        if ($is_new) {
            $admins = get_users(array('role' => 'administrator', 'number' => 1, 'fields' => 'ID'));

            if (! empty($admins)) {
                wp_update_post(array('ID' => $product_id, 'post_author' => (int) $admins[0]));
            }
        }

        // Campos propios de UNIFORMA (los mismos que lee la ficha de producto). Lo que no viene, no se toca.
        foreach (array(5, 10, 20, 50) as $qty) {
            if (null !== $input['prices'][$qty]) {
                uniforma_erp_set_field('uniforma_precio_x' . $qty, $input['prices'][$qty] > 0 ? $input['prices'][$qty] : '', $product_id);
            }
        }

        if (null !== $input['details'] && ($is_new || ! uniforma_erp_same_text(get_post_meta($product_id, 'uniforma_detalles', true), $input['rawDetails']))) {
            uniforma_erp_set_field('uniforma_detalles', $input['details'], $product_id);
        }

        if (null !== $input['care'] && ($is_new || ! uniforma_erp_same_text(get_post_meta($product_id, 'uniforma_cuidados', true), $input['rawCare']))) {
            uniforma_erp_set_field('uniforma_cuidados', $input['care'], $product_id);
        }

        if ('' !== $input['sizeChartHtml']) {
            uniforma_erp_set_field('uniforma_tabla_talles', $input['sizeChartHtml'], $product_id);
        }

        if (null !== $input['isNew']) {
            uniforma_erp_set_field('uniforma_producto_nuevo', $input['isNew'] ? 1 : 0, $product_id);
        }

        if (null !== $input['buttonPersonalize']) {
            uniforma_erp_set_field('uniforma_texto_boton_personalizar', $input['buttonPersonalize'], $product_id);
        }

        if (null !== $input['buttonQuote']) {
            uniforma_erp_set_field('uniforma_texto_boton_presupuesto', $input['buttonQuote'], $product_id);
        }

        if (null !== $input['minQuantity']) {
            uniforma_erp_set_field('uniforma_cantidad_minima', $input['minQuantity'], $product_id);
        }

        if (null !== $input['seoDescription']) {
            update_post_meta($product_id, 'uniforma_seo_descripcion', $input['seoDescription']);
        }

        // Variaciones: una por color y talle, al precio del primer tramo.
        $price_5 = null !== $input['prices'][5] ? $input['prices'][5] : (float) get_post_meta($product_id, 'uniforma_precio_x5', true);
        $base_price = $price_5 > 0 ? wc_format_decimal($price_5) : '';
        $created = 0;
        $updated = 0;
        $matrix_ids = array();

        foreach ($color_terms as $color_term) {
            foreach ($size_terms as $size_term) {
                $key = $color_term['slug'] . '|' . $size_term['slug'];
                $matrix_ids[$key] = true;
                $variation_id = isset($existing_variations[$key]) ? $existing_variations[$key] : 0;
                $variation = $variation_id ? new WC_Product_Variation($variation_id) : new WC_Product_Variation();

                if (! $variation_id) {
                    $variation->set_parent_id($product_id);
                    $variation->set_attributes(array(
                        $color_attr['taxonomy'] => $color_term['slug'],
                        $size_attr['taxonomy']  => $size_term['slug'],
                    ));
                    $variation->set_manage_stock(false);
                    $variation->set_stock_status('instock');
                    $variation->set_status('publish');
                }

                if ('' !== $base_price) {
                    $variation->set_regular_price($base_price);
                }

                if ($variation_id && ! $variation->get_changes()) {
                    continue;
                }

                $variation->save();
                $variation_id ? $updated++ : $created++;
            }
        }

        // Las variaciones que ya no están en la combinación quedan privadas (nunca se borran).
        foreach (array_diff_key($existing_variations, $matrix_ids) as $orphan_id) {
            $orphan = wc_get_product($orphan_id);

            if ($orphan && 'private' !== $orphan->get_status()) {
                $orphan->set_status('private');
                $orphan->save();
            }
        }

        if (class_exists('WC_Product_Variable')) {
            WC_Product_Variable::sync($product_id);
        }

        if (function_exists('uniforma_sync_x5_price_to_woocommerce')) {
            uniforma_sync_x5_price_to_woocommerce($product_id);
        }

        if (function_exists('wc_delete_product_transients')) {
            wc_delete_product_transients($product_id);
        }
    } finally {
        wp_defer_term_counting(false);
        delete_option($lock);
    }

    $summary['wooId'] = (int) $product_id;
    $summary['variations']['created'] = $created;
    $summary['variations']['updated'] = $updated;
    $summary['permalink'] = get_permalink($product_id);
    $summary['editUrl'] = admin_url('post.php?post=' . (int) $product_id . '&action=edit');
    $summary['product'] = uniforma_catalog_product_payload(wc_get_product($product_id));

    return $summary;
}

function uniforma_erp_product_callback(WP_REST_Request $request)
{
    try {
        return rest_ensure_response(uniforma_erp_product_handle($request));
    } catch (UniformaErpException $exception) {
        return new WP_Error('uniforma_erp_error', $exception->getMessage(), array('status' => $exception->status, 'details' => $exception->details));
    } catch (Throwable $throwable) {
        // El detalle técnico queda en el registro de PHP; al ERP solo llega un mensaje general.
        error_log('[UNIFORMA ERP] ' . get_class($throwable) . ': ' . $throwable->getMessage() . ' en ' . $throwable->getFile() . ':' . $throwable->getLine());

        return new WP_Error('uniforma_erp_exception', 'Error inesperado en la web. Revisá el registro de errores de PHP del hosting.', array('status' => 500));
    }
}

/* =========================================
   LO QUE YA EXISTE EN LA WEB
========================================= */

function uniforma_erp_taxonomies_callback()
{
    $categories = array();
    $terms = get_terms(array('taxonomy' => 'product_cat', 'hide_empty' => false));

    if (! is_wp_error($terms)) {
        foreach ($terms as $term) {
            $categories[] = array('id' => (int) $term->term_id, 'name' => $term->name, 'slug' => $term->slug, 'parent' => (int) $term->parent, 'count' => (int) $term->count);
        }
    }

    $colors = array();
    $color_terms = taxonomy_exists('pa_color') ? get_terms(array('taxonomy' => 'pa_color', 'hide_empty' => false)) : array();

    if (! is_wp_error($color_terms)) {
        foreach ($color_terms as $term) {
            $colors[] = array('name' => $term->name, 'slug' => $term->slug, 'hex' => uniforma_catalog_color_hex($term->name));
        }
    }

    $sizes = array();
    $size_terms = taxonomy_exists('pa_talle') ? get_terms(array('taxonomy' => 'pa_talle', 'hide_empty' => false)) : array();

    if (! is_wp_error($size_terms)) {
        foreach ($size_terms as $term) {
            $sizes[] = array('name' => $term->name, 'slug' => $term->slug);
        }
    }

    $tags = array();
    $tag_terms = get_terms(array('taxonomy' => 'product_tag', 'hide_empty' => false));

    if (! is_wp_error($tag_terms)) {
        foreach ($tag_terms as $term) {
            $tags[] = $term->name;
        }
    }

    return rest_ensure_response(array('ok' => true, 'categories' => $categories, 'colors' => $colors, 'sizes' => $sizes, 'tags' => $tags));
}

function uniforma_erp_register_routes()
{
    register_rest_route('uniforma/v1', '/product', array(
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'uniforma_erp_product_callback',
        'permission_callback' => 'uniforma_catalog_api_permission',
    ));

    register_rest_route('uniforma/v1', '/taxonomies', array(
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'uniforma_erp_taxonomies_callback',
        'permission_callback' => 'uniforma_catalog_api_permission',
    ));
}
add_action('rest_api_init', 'uniforma_erp_register_routes');
