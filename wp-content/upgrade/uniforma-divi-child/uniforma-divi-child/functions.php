<?php
/**
 * UNIFORMA Divi child theme functions.
 */

if (! defined('ABSPATH')) {
    exit;
}

define('UNIFORMA_CATALOG_MODE', true);

function uniforma_enqueue_assets()
{
    $theme = wp_get_theme();

    wp_enqueue_style(
        'uniforma-fonts',
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&display=swap',
        array(),
        null
    );

    wp_enqueue_style(
        'divi-parent-style',
        get_template_directory_uri() . '/style.css',
        array(),
        $theme->parent() ? $theme->parent()->get('Version') : null
    );

    wp_enqueue_style(
        'uniforma-child-style',
        get_stylesheet_uri(),
        array('uniforma-fonts', 'divi-parent-style'),
        $theme->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'uniforma_enqueue_assets', 20);

function uniforma_theme_setup()
{
    add_theme_support('woocommerce');
}
add_action('after_setup_theme', 'uniforma_theme_setup');

function uniforma_disable_direct_purchase($purchasable, $product)
{
    if (UNIFORMA_CATALOG_MODE) {
        return false;
    }

    return $purchasable;
}
add_filter('woocommerce_is_purchasable', 'uniforma_disable_direct_purchase', 10, 2);

function uniforma_catalog_mode_hooks()
{
    if (! UNIFORMA_CATALOG_MODE || ! class_exists('WooCommerce')) {
        return;
    }

    remove_action('woocommerce_after_shop_loop_item', 'woocommerce_template_loop_add_to_cart', 10);
    remove_action('woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30);
}
add_action('wp', 'uniforma_catalog_mode_hooks');

function uniforma_product_quote_url($product_id = 0)
{
    $product_id = $product_id ? $product_id : get_the_ID();

    return add_query_arg(
        array(
            'producto' => get_the_title($product_id),
        ),
        home_url('/contacto/')
    );
}

function uniforma_product_personalize_url($product_id = 0)
{
    $product_id = $product_id ? $product_id : get_the_ID();

    return add_query_arg(
        array(
            'producto' => get_the_title($product_id),
        ),
        home_url('/simula-tu-prenda/')
    );
}

function uniforma_loop_product_actions()
{
    if (! UNIFORMA_CATALOG_MODE) {
        return;
    }

    $product_id = get_the_ID();

    echo '<div class="uniforma-product-actions">';
    echo '<a class="button uniforma-button-outline" href="' . esc_url(get_permalink($product_id)) . '">Ver producto</a>';
    echo '<a class="button uniforma-button-outline" href="' . esc_url(uniforma_product_personalize_url($product_id)) . '">Personalizar</a>';
    echo '</div>';
}
add_action('woocommerce_after_shop_loop_item', 'uniforma_loop_product_actions', 10);

function uniforma_single_product_actions()
{
    if (! UNIFORMA_CATALOG_MODE) {
        return;
    }

    $product_id = get_the_ID();

    echo '<div class="uniforma-single-actions">';
    echo '<a class="button uniforma-button" href="' . esc_url(uniforma_product_personalize_url($product_id)) . '">Personalizar prenda</a>';
    echo '<a class="button uniforma-button-outline" href="' . esc_url(uniforma_product_quote_url($product_id)) . '">Pedir presupuesto</a>';
    echo '</div>';
}
add_action('woocommerce_single_product_summary', 'uniforma_single_product_actions', 31);
