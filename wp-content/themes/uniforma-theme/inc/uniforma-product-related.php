<?php
/**
 * UNIFORMA — Productos relacionados y complementarios para la ficha.
 *
 * - Relacionados: misma categoría; si faltan, categorías hermanas/rubro; si aún faltan, más pedidos.
 * - Completá el pedido: prendas de OTRAS categorías (hermanas primero) para armar el equipo completo.
 * - Vistos recientemente: se guardan en el navegador (no en la página, que puede estar en caché)
 *   y se piden por AJAX.
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Ids de productos publicados y visibles que pertenecen a ciertas categorías,
 * ordenados por ventas (los más pedidos primero).
 */
function uniforma_pdp_ids_in_categories($term_ids, $exclude_ids, $limit)
{
    $args = array(
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 60,
        'fields'         => 'ids',
        'post__not_in'   => array_map('intval', $exclude_ids),
        'no_found_rows'  => true,
    );

    if (! empty($term_ids)) {
        $args['tax_query'] = array(
            array(
                'taxonomy'         => 'product_cat',
                'field'            => 'term_id',
                'terms'            => array_map('intval', $term_ids),
                'include_children' => true,
            ),
        );
    }

    $ids = get_posts($args);

    // Los más pedidos primero (total_sales lo mantiene WooCommerce); desempata por título.
    usort($ids, function ($a, $b) {
        $sales_a = (int) get_post_meta($a, 'total_sales', true);
        $sales_b = (int) get_post_meta($b, 'total_sales', true);

        if ($sales_a !== $sales_b) {
            return $sales_b <=> $sales_a;
        }

        return strcasecmp(get_the_title($a), get_the_title($b));
    });

    $visible = array();

    foreach ($ids as $id) {
        $candidate = wc_get_product($id);

        if ($candidate && $candidate->is_visible()) {
            $visible[] = (int) $id;
        }

        if (count($visible) >= $limit) {
            break;
        }
    }

    return $visible;
}

/**
 * Categorías hermanas (mismo padre) de las categorías del producto. Si el producto
 * está en una categoría de primer nivel, no hay hermanas: devuelve las de primer nivel.
 */
function uniforma_pdp_sibling_term_ids($product_term_ids)
{
    $siblings = array();

    foreach ($product_term_ids as $term_id) {
        $term = get_term($term_id, 'product_cat');

        if (! $term || is_wp_error($term)) {
            continue;
        }

        $children = get_terms(array(
            'taxonomy'   => 'product_cat',
            'parent'     => (int) $term->parent,
            'hide_empty' => true,
            'fields'     => 'ids',
        ));

        if (! is_wp_error($children)) {
            $siblings = array_merge($siblings, $children);
        }
    }

    return array_values(array_diff(array_unique(array_map('intval', $siblings)), array_map('intval', $product_term_ids)));
}

/**
 * Relacionados: siempre intenta llegar a $limit productos.
 */
function uniforma_pdp_related_products($product, $limit = 8)
{
    $product_id = $product->get_id();
    $ids = array();

    // 1) Misma categoría / etiquetas (lógica de WooCommerce, con sus filtros).
    foreach ((array) wc_get_related_products($product_id, $limit) as $id) {
        $id = (int) $id;
        $candidate = wc_get_product($id);

        if ($candidate && $candidate->is_visible() && $id !== $product_id) {
            $ids[$id] = $id;
        }
    }

    $term_ids = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'ids'));
    $term_ids = is_wp_error($term_ids) ? array() : $term_ids;

    // 2) Categorías hermanas (mismo rubro).
    if (count($ids) < $limit) {
        $exclude = array_merge(array($product_id), array_values($ids));
        $siblings = uniforma_pdp_sibling_term_ids($term_ids);

        if (! empty($siblings)) {
            foreach (uniforma_pdp_ids_in_categories($siblings, $exclude, $limit - count($ids)) as $id) {
                $ids[$id] = $id;
            }
        }
    }

    // 3) Los más pedidos del catálogo.
    if (count($ids) < $limit) {
        $exclude = array_merge(array($product_id), array_values($ids));

        foreach (uniforma_pdp_ids_in_categories(array(), $exclude, $limit - count($ids)) as $id) {
            $ids[$id] = $id;
        }
    }

    return array_values($ids);
}

/**
 * «Completá el pedido»: prendas de otras categorías para vestir al equipo completo.
 */
function uniforma_pdp_complete_products($product, $exclude_ids, $limit = 4)
{
    $product_id = $product->get_id();
    $term_ids = wp_get_post_terms($product_id, 'product_cat', array('fields' => 'ids'));
    $term_ids = is_wp_error($term_ids) ? array() : $term_ids;

    $exclude = array_merge(array($product_id), array_map('intval', $exclude_ids));

    // Productos que están en las mismas categorías que éste NO complementan: se excluyen.
    $same_category = uniforma_pdp_ids_in_categories($term_ids, array($product_id), 200);
    $exclude = array_merge($exclude, $same_category);

    $ids = array();
    $siblings = uniforma_pdp_sibling_term_ids($term_ids);

    if (! empty($siblings)) {
        $ids = uniforma_pdp_ids_in_categories($siblings, $exclude, $limit);
    }

    if (count($ids) < $limit) {
        $exclude = array_merge($exclude, $ids);
        $ids = array_merge($ids, uniforma_pdp_ids_in_categories(array(), $exclude, $limit - count($ids)));
    }

    return array_slice(array_values(array_unique($ids)), 0, $limit);
}

/**
 * AJAX público (solo lectura): tarjetas de los productos vistos recientemente.
 * Recibe ?ids=12,45,7 desde el navegador.
 */
function uniforma_ajax_recent_products()
{
    $raw = isset($_GET['ids']) ? sanitize_text_field(wp_unslash($_GET['ids'])) : '';
    $ids = array_slice(array_values(array_unique(array_filter(array_map('absint', explode(',', $raw))))), 0, 8);

    ob_start();

    foreach ($ids as $id) {
        $item = wc_get_product($id);

        if ($item && 'publish' === $item->get_status() && $item->is_visible()) {
            uniforma_render_product_card($item, array('colors' => false, 'actions' => false, 'size' => 'woocommerce_single'));
        }
    }

    wp_send_json_success(array('html' => ob_get_clean()));
}
add_action('wp_ajax_uniforma_recent_products', 'uniforma_ajax_recent_products');
add_action('wp_ajax_nopriv_uniforma_recent_products', 'uniforma_ajax_recent_products');
