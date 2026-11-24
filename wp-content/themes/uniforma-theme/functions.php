<?php
/**
 * UNIFORMA Theme functions.
 */

if (! defined('ABSPATH')) {
    exit;
}

define('UNIFORMA_CATALOG_MODE', false);

/* =========================================
   WHATSAPP: UN SOLO NÚMERO PARA TODO EL SITIO
   Se cambia acá (o con el filtro 'uniforma_whatsapp_number') y se actualizan el botón flotante,
   el pie, contacto, ficha de producto, simulador y botón de arrepentimiento.
========================================= */

// Formato internacional para wa.me: 54 (país) + 9 (celular) + 11 (área) + número.
define('UNIFORMA_WHATSAPP_NUMBER', '5491124903370');
// Cómo se muestra el número en pantalla.
define('UNIFORMA_WHATSAPP_DISPLAY', '11 2490-3370');

function uniforma_whatsapp_number()
{
    return preg_replace('/\D+/', '', (string) apply_filters('uniforma_whatsapp_number', UNIFORMA_WHATSAPP_NUMBER));
}

function uniforma_whatsapp_display()
{
    return (string) apply_filters('uniforma_whatsapp_display', UNIFORMA_WHATSAPP_DISPLAY);
}

function uniforma_whatsapp_url($message = '')
{
    $url = 'https://wa.me/' . uniforma_whatsapp_number();

    if ($message !== '') {
        $url .= '?text=' . rawurlencode($message);
    }

    return $url;
}

/* =========================================
   1) HELPERS
========================================= */

function uniforma_is_page_slug($slug)
{
    return is_page($slug);
}

function uniforma_is_shop_page()
{
    return (
        is_page('tienda') ||
        is_page('catalogo') ||
        is_page('productos') ||
        (function_exists('is_shop') && is_shop())
    );
}

function uniforma_is_category_page()
{
    return function_exists('is_product_category') && is_product_category();
}

function uniforma_is_product_page()
{
    return function_exists('is_product') && is_product();
}

function uniforma_is_cart_or_checkout_or_account()
{
    return (
        (function_exists('is_cart') && is_cart()) ||
        (function_exists('is_checkout') && is_checkout()) ||
        (function_exists('is_account_page') && is_account_page())
    );
}

function uniforma_is_woocommerce_important_page()
{
    return (
        uniforma_is_shop_page() ||
        uniforma_is_category_page() ||
        (function_exists('uniforma_is_product_search_page') && uniforma_is_product_search_page()) ||
        uniforma_is_product_page() ||
        uniforma_is_cart_or_checkout_or_account()
    );
}

/**
 * Indica si una categoría de producto tiene productos para mostrar.
 * Si la categoría todavía no existe en WooCommerce devuelve true, para no ocultar un enlace por error.
 */
function uniforma_category_has_products($slug)
{
    if (! taxonomy_exists('product_cat')) {
        return true;
    }

    $term = get_term_by('slug', $slug, 'product_cat');

    if (! $term || is_wp_error($term)) {
        return true;
    }

    $with_children = (int) get_term_meta($term->term_id, 'product_count_product_cat', true);

    return max((int) $term->count, $with_children) > 0;
}

/**
 * Categorías por tipo de prenda del menú y del pie, sin las que no tienen productos.
 * Formato: slug => nombre visible.
 */
function uniforma_catalog_categories()
{
    $categories = array(
        'remeras'              => 'Remeras',
        'chombas'              => 'Chombas',
        'buzos-y-camperas'     => 'Buzos y camperas',
        'camisas-y-chaquetas'  => 'Camisas y chaquetas',
        'pantalones'           => 'Pantalones',
        'ambos-y-guardapolvos' => 'Ambos',
        'delantales'           => 'Delantales',
        'accesorios'           => 'Gorras y accesorios',
        'zapatillas'           => 'Calzado',
    );

    return array_filter($categories, 'uniforma_category_has_products', ARRAY_FILTER_USE_KEY);
}

require_once get_template_directory() . '/inc/uniforma-product-card.php';
require_once get_template_directory() . '/inc/uniforma-product-related.php';
require_once get_template_directory() . '/inc/uniforma-category-filters.php';
require_once get_template_directory() . '/inc/uniforma-product-search.php';
require_once get_template_directory() . '/inc/uniforma-seo.php';
require_once get_template_directory() . '/inc/uniforma-erp-products.php';

/* =========================================
   2) THEME SETUP
========================================= */

function uniforma_theme_setup()
{
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script'));
    add_theme_support('woocommerce');

    register_nav_menus(array(
        'primary' => 'Menú principal',
        'footer'  => 'Menú footer',
    ));
}
add_action('after_setup_theme', 'uniforma_theme_setup');

/* =========================================
   3) CARGA OPTIMIZADA DE ESTILOS Y SCRIPTS
========================================= */

/**
 * Versión de un recurso del theme = fecha de modificación del archivo
 * (cambia sola al editarlo y evita servir CSS/JS viejo desde la caché).
 */
function uniforma_asset_version($relative_path)
{
    $file = get_template_directory() . '/' . ltrim($relative_path, '/');

    return file_exists($file) ? (string) filemtime($file) : wp_get_theme()->get('Version');
}

function uniforma_enqueue_style($handle, $relative_path, $deps = array('uniforma-style'))
{
    wp_enqueue_style(
        $handle,
        get_template_directory_uri() . '/' . ltrim($relative_path, '/'),
        $deps,
        uniforma_asset_version($relative_path)
    );
}

function uniforma_enqueue_script($handle, $relative_path)
{
    wp_enqueue_script(
        $handle,
        get_template_directory_uri() . '/' . ltrim($relative_path, '/'),
        array(),
        uniforma_asset_version($relative_path),
        true
    );
}

function uniforma_enqueue_assets()
{
    // Archivo (eje de ancho + peso) para texto y titulares; Jost para menú, etiquetas, botones y precios.
    wp_enqueue_style(
        'uniforma-fonts',
        'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Jost:wght@400;500;600;700&display=swap',
        array(),
        null
    );

    // Sistema de diseño: tokens, tipografía, botones, tarjeta de producto.
    wp_enqueue_style('uniforma-style', get_stylesheet_uri(), array('uniforma-fonts'), uniforma_asset_version('style.css'));

    // Globales
    uniforma_enqueue_style('uniforma-header', 'assets/css/uniforma-header.css');
    uniforma_enqueue_script('uniforma-header', 'assets/js/uniforma-header.js');
    uniforma_enqueue_style('uniforma-footer', 'assets/css/uniforma-footer.css');
    uniforma_enqueue_style('uniforma-whatsapp', 'assets/css/uniforma-whatsapp.css');

    if (is_front_page() || is_home() || uniforma_is_page_slug('inicio')) {
        uniforma_enqueue_style('uniforma-home', 'assets/css/uniforma-home.css');
        uniforma_enqueue_script('uniforma-home', 'assets/js/uniforma-home.js');
    }

    if (uniforma_is_shop_page()) {
        uniforma_enqueue_style('uniforma-shop', 'assets/css/uniforma-shop.css');
        uniforma_enqueue_script('uniforma-shop', 'assets/js/uniforma-shop.js');
    }

    if (uniforma_is_category_page() || uniforma_is_product_search_page()) {
        uniforma_enqueue_style('uniforma-category', 'assets/css/uniforma-category.css');

        if (uniforma_is_category_page()) {
            uniforma_enqueue_script('uniforma-category', 'assets/js/uniforma-category.js');
        }
    }

    if (uniforma_is_product_search_page()) {
        uniforma_enqueue_style('uniforma-search', 'assets/css/uniforma-search.css', array('uniforma-category'));
    }

    if (uniforma_is_product_page()) {
        uniforma_enqueue_style('uniforma-single-product', 'assets/css/uniforma-single-product.css');
        uniforma_enqueue_leads_script();
        uniforma_enqueue_script('uniforma-single-product', 'assets/js/uniforma-single-product.js');
    }

    if (function_exists('is_checkout') && is_checkout()) {
        uniforma_enqueue_style('uniforma-checkout', 'assets/css/uniforma-checkout.css');
    }

    if (uniforma_is_page_slug('simula-tu-prenda')) {
        uniforma_enqueue_style('uniforma-customizer', 'assets/css/uniforma-customizer.css');
        uniforma_enqueue_script('uniforma-customizer', 'assets/js/uniforma-customizer.js');
    }

    if (uniforma_is_page_slug('contacto')) {
        uniforma_enqueue_style('uniforma-contact', 'assets/css/uniforma-contact.css');
        uniforma_enqueue_leads_script();
        uniforma_enqueue_script('uniforma-contact', 'assets/js/uniforma-contact.js');
    }

    if (uniforma_is_page_slug('nosotros')) {
        uniforma_enqueue_style('uniforma-about', 'assets/css/uniforma-about.css');
    }

    if (
        uniforma_is_page_slug('preguntas-frecuentes')
        || uniforma_is_page_slug('terminos-y-condiciones')
        || uniforma_is_page_slug('boton-de-arrepentimiento')
    ) {
        uniforma_enqueue_style('uniforma-info-pages', 'assets/css/uniforma-info-pages.css');
    }
}
add_action('wp_enqueue_scripts', 'uniforma_enqueue_assets', 20);

/* =========================================
   4) CLASES BODY
========================================= */

function uniforma_body_classes($classes)
{
    if (is_front_page() || is_home() || uniforma_is_page_slug('inicio')) {
        $classes[] = 'uniforma-page-home';
    }

    if (uniforma_is_shop_page()) {
        $classes[] = 'uniforma-page-shop';
    }

    if (uniforma_is_category_page()) {
        $classes[] = 'uniforma-page-category';
    }

    if (function_exists('uniforma_is_product_search_page') && uniforma_is_product_search_page()) {
        $classes[] = 'uniforma-page-search';
    }

    if (uniforma_is_product_page()) {
        $classes[] = 'uniforma-page-product';
    }

    if (function_exists('is_checkout') && is_checkout()) {
        $classes[] = 'uniforma-page-checkout';
    }

    if (uniforma_is_page_slug('simula-tu-prenda')) {
        $classes[] = 'uniforma-page-customizer';
    }

    if (uniforma_is_page_slug('contacto')) {
        $classes[] = 'uniforma-page-contact';
    }

    if (uniforma_is_page_slug('nosotros')) {
        $classes[] = 'uniforma-page-about';
    }

    if (
        uniforma_is_page_slug('preguntas-frecuentes')
        || uniforma_is_page_slug('terminos-y-condiciones')
        || uniforma_is_page_slug('boton-de-arrepentimiento')
    ) {
        $classes[] = 'uniforma-page-info';
    }

    return $classes;
}
add_filter('body_class', 'uniforma_body_classes');

/* =========================================
   5) DESCARGAR ASSETS WOO DONDE NO HACEN FALTA
========================================= */

function uniforma_dequeue_woocommerce_assets()
{
    if (! class_exists('WooCommerce')) {
        return;
    }

    if (uniforma_is_woocommerce_important_page()) {
        return;
    }

    wp_dequeue_style('woocommerce-general');
    wp_dequeue_style('woocommerce-layout');
    wp_dequeue_style('woocommerce-smallscreen');
    wp_dequeue_style('wc-blocks-style');
    wp_dequeue_style('wc-blocks-vendors-style');

    wp_dequeue_script('wc-cart-fragments');
    wp_dequeue_script('woocommerce');
    wp_dequeue_script('wc-add-to-cart');
    wp_dequeue_script('wc-checkout');
}
add_action('wp_enqueue_scripts', 'uniforma_dequeue_woocommerce_assets', 99);

/* =========================================
   6) MODO CATALOGO
========================================= */

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

/* =========================================
   7) URLS PRESUPUESTO Y PERSONALIZACION
========================================= */

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
            'producto_id' => $product_id,
            'producto' => get_the_title($product_id),
        ),
        home_url('/simula-tu-prenda/')
    );
}

/* =========================================
   8) BOTONES CATALOGO
========================================= */

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

/* =========================================
   9) CHECKOUT CUSTOM
========================================= */

function uniforma_checkout_body_cleanup()
{
    if (! function_exists('is_checkout') || ! is_checkout()) {
        return;
    }

    remove_action('woocommerce_before_checkout_form', 'woocommerce_checkout_coupon_form', 10);
}
add_action('wp', 'uniforma_checkout_body_cleanup');

function uniforma_checkout_fields_custom($fields)
{
    if (isset($fields['billing']['billing_first_name'])) {
        $fields['billing']['billing_first_name']['label'] = 'Nombre';
        $fields['billing']['billing_first_name']['placeholder'] = 'Ingresá tu nombre';
        $fields['billing']['billing_first_name']['priority'] = 10;
    }

    if (isset($fields['billing']['billing_last_name'])) {
        $fields['billing']['billing_last_name']['label'] = 'Apellido';
        $fields['billing']['billing_last_name']['placeholder'] = 'Ingresá tu apellido';
        $fields['billing']['billing_last_name']['priority'] = 20;
    }

    if (isset($fields['billing']['billing_company'])) {
        $fields['billing']['billing_company']['label'] = 'Empresa';
        $fields['billing']['billing_company']['placeholder'] = 'Nombre de la empresa';
        $fields['billing']['billing_company']['required'] = false;
        $fields['billing']['billing_company']['priority'] = 30;
    }

    if (isset($fields['billing']['billing_phone'])) {
        $fields['billing']['billing_phone']['label'] = 'Teléfono / WhatsApp';
        $fields['billing']['billing_phone']['placeholder'] = 'Ej: 11 1234 5678';
        $fields['billing']['billing_phone']['priority'] = 40;
    }

    if (isset($fields['billing']['billing_email'])) {
        $fields['billing']['billing_email']['label'] = 'Email';
        $fields['billing']['billing_email']['placeholder'] = 'tuemail@ejemplo.com';
        $fields['billing']['billing_email']['priority'] = 50;
    }

    if (isset($fields['billing']['billing_address_1'])) {
        $fields['billing']['billing_address_1']['label'] = 'Dirección';
        $fields['billing']['billing_address_1']['placeholder'] = 'Calle y número';
        $fields['billing']['billing_address_1']['priority'] = 60;
    }

    if (isset($fields['billing']['billing_city'])) {
        $fields['billing']['billing_city']['label'] = 'Localidad / Ciudad';
        $fields['billing']['billing_city']['placeholder'] = 'Ej: CABA, Lanús, Córdoba';
        $fields['billing']['billing_city']['priority'] = 70;
    }

    if (isset($fields['billing']['billing_state'])) {
        $fields['billing']['billing_state']['label'] = 'Provincia';
        $fields['billing']['billing_state']['priority'] = 80;
    }

    if (isset($fields['billing']['billing_postcode'])) {
        $fields['billing']['billing_postcode']['label'] = 'Código postal';
        $fields['billing']['billing_postcode']['placeholder'] = 'Ej: 1406';
        $fields['billing']['billing_postcode']['priority'] = 90;
    }

    if (isset($fields['order']['order_comments'])) {
        $fields['order']['order_comments']['label'] = 'Comentarios del pedido';
        $fields['order']['order_comments']['placeholder'] = 'Ej: cantidad por talle, logo a aplicar, aclaraciones de envío o facturación.';
    }

    return $fields;
}
add_filter('woocommerce_checkout_fields', 'uniforma_checkout_fields_custom');

function uniforma_checkout_order_button_text($button_text)
{
    return 'Finalizar pedido';
}
add_filter('woocommerce_order_button_text', 'uniforma_checkout_order_button_text');

function uniforma_checkout_before_customer_details()
{
    echo '<div class="uniforma-checkout-heading">';
    echo '<span>Pedido UNIFORMA</span>';
    echo '<h1>Finalizá tu compra</h1>';
    echo '<p>Completá tus datos para que podamos procesar tu pedido y coordinar la entrega.</p>';
    echo '</div>';
}
add_action('woocommerce_checkout_before_customer_details', 'uniforma_checkout_before_customer_details', 5);

/* =========================================
   10) SUBIDA DE LOGO SIMULADOR
========================================= */

if (! function_exists('uniforma_customizer_upload_logo')) {
    function uniforma_customizer_upload_logo()
    {
        check_ajax_referer('uniforma_customizer_nonce', 'nonce');

        if (empty($_FILES['logo_file'])) {
            wp_send_json_error(array('message' => 'No se recibió ningún archivo.'));
        }

        $file = $_FILES['logo_file'];

        if (! empty($file['error'])) {
            wp_send_json_error(array('message' => 'Error al subir el archivo.'));
        }

        $max_size = 10 * 1024 * 1024;

        if ($file['size'] > $max_size) {
            wp_send_json_error(array('message' => 'El archivo supera el límite de 10MB.'));
        }

        $allowed_mimes = array(
            'jpg|jpeg' => 'image/jpeg',
            'png'      => 'image/png',
            'webp'     => 'image/webp',
            'svg'      => 'image/svg+xml',
            'pdf'      => 'application/pdf',
            'ai'       => 'application/postscript',
            'eps'      => 'application/postscript',
        );

        $file_check = wp_check_filetype_and_ext($file['tmp_name'], $file['name'], $allowed_mimes);

        if (empty($file_check['type'])) {
            wp_send_json_error(array('message' => 'Formato no permitido. Usá PNG, JPG, WEBP, SVG, PDF, AI o EPS.'));
        }

        add_filter('upload_dir', 'uniforma_customizer_upload_dir');

        require_once ABSPATH . 'wp-admin/includes/file.php';

        $upload = wp_handle_upload($file, array(
            'test_form' => false,
            'mimes'     => $allowed_mimes,
        ));

        remove_filter('upload_dir', 'uniforma_customizer_upload_dir');

        if (isset($upload['error'])) {
            wp_send_json_error(array('message' => $upload['error']));
        }

        wp_send_json_success(array(
            'url'  => esc_url_raw($upload['url']),
            'name' => sanitize_file_name($file['name']),
        ));
    }
}

if (! function_exists('uniforma_customizer_upload_dir')) {
    function uniforma_customizer_upload_dir($dirs)
    {
        $subdir = '/uniforma-presupuestos';

        $dirs['subdir'] = $subdir;
        $dirs['path']   = $dirs['basedir'] . $subdir;
        $dirs['url']    = $dirs['baseurl'] . $subdir;

        return $dirs;
    }
}

add_action('wp_ajax_uniforma_upload_logo', 'uniforma_customizer_upload_logo');
add_action('wp_ajax_nopriv_uniforma_upload_logo', 'uniforma_customizer_upload_logo');

/* =========================================
   UNIFORMA — LIMPIEZA EXTRA PRODUCTO MOBILE
========================================= */

function uniforma_dequeue_single_product_extra_assets()
{
    if (! function_exists('is_product') || ! is_product()) {
        return;
    }

    wp_dequeue_script('zoom');
    wp_dequeue_script('flexslider');
    wp_dequeue_script('photoswipe');
    wp_dequeue_script('photoswipe-ui-default');
    wp_dequeue_style('photoswipe');
    wp_dequeue_style('photoswipe-default-skin');
}
add_action('wp_enqueue_scripts', 'uniforma_dequeue_single_product_extra_assets', 100);

/* =========================================
   BUSCADOR INSTANTANEO DE PRODUCTOS
========================================= */

function uniforma_ajax_product_search()
{
    check_ajax_referer('uniforma_product_search', 'nonce');

    if (! function_exists('wc_get_product')) {
        wp_send_json_error(array('message' => 'WooCommerce no está disponible.'), 503);
    }

    $search = isset($_GET['query']) ? sanitize_text_field(wp_unslash($_GET['query'])) : '';

    if (strlen($search) < 2) {
        wp_send_json_success(array('items' => array()));
    }

    $search_results = uniforma_product_search_find($search, 8);
    $product_ids = isset($search_results['ids']) ? $search_results['ids'] : array();

    $items = array();

    foreach ($product_ids as $product_id) {
        $product = wc_get_product((int) $product_id);

        if (! $product || ! $product->is_visible()) {
            continue;
        }

        $image_id = $product->get_image_id();
        $image_url = $image_id
            ? wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail')
            : wc_placeholder_img_src('woocommerce_thumbnail');

        $items[] = array(
            'id'    => $product->get_id(),
            'name'  => $product->get_name(),
            'url'   => $product->get_permalink(),
            'image' => $image_url,
            'price' => wp_strip_all_tags($product->get_price_html()),
            'sku'   => $product->get_sku(),
        );
    }

    wp_send_json_success(array('items' => $items));
}

add_action('wp_ajax_uniforma_product_search', 'uniforma_ajax_product_search');
add_action('wp_ajax_nopriv_uniforma_product_search', 'uniforma_ajax_product_search');





/* =========================================
   12) PRECIOS MAYORISTAS Y CANTIDAD MINIMA
========================================= */

/**
 * Mantiene el precio X5 como precio base de WooCommerce para listados,
 * búsquedas y tarjetas de producto.
 */
function uniforma_sync_x5_price_to_woocommerce($post_id)
{
    if (get_post_type($post_id) !== 'product' || wp_is_post_revision($post_id)) {
        return;
    }

    $price_x5 = get_post_meta($post_id, 'uniforma_precio_x5', true);

    if ($price_x5 === '' || ! is_numeric($price_x5)) {
        return;
    }

    $price_x5 = wc_format_decimal($price_x5);
    update_post_meta($post_id, '_regular_price', $price_x5);
    update_post_meta($post_id, '_price', $price_x5);

    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients($post_id);
    }
}
add_action('acf/save_post', 'uniforma_sync_x5_price_to_woocommerce', 20);
add_action('save_post_product', 'uniforma_sync_x5_price_to_woocommerce', 20);

/** Cantidad mínima global para productos de Uniforma. */
function uniforma_minimum_product_quantity($args, $product)
{
    $args['min_value'] = 5;
    $args['input_value'] = max(5, isset($args['input_value']) ? (int) $args['input_value'] : 5);
    return $args;
}
add_filter('woocommerce_quantity_input_args', 'uniforma_minimum_product_quantity', 10, 2);

function uniforma_validate_minimum_quantity($passed, $product_id, $quantity)
{
    if ((int) $quantity < 5) {
        wc_add_notice('La cantidad mínima por producto es de 5 unidades.', 'error');
        return false;
    }
    return $passed;
}
add_filter('woocommerce_add_to_cart_validation', 'uniforma_validate_minimum_quantity', 10, 3);


/* =========================================
   13) API PRIVADA DE CATALOGO PARA EL PANEL
========================================= */

/*
 * La clave de conexión con el ERP se define SOLO en wp-config.php (nunca dentro del theme):
 *   define('UNIFORMA_CATALOG_SYNC_TOKEN', 'una-clave-larga-y-secreta-de-48-caracteres');
 * Sin esa línea, o con una clave de menos de 24 caracteres, el catálogo y la carga de productos
 * quedan cerrados y responden con un aviso.
 */
if (! defined('UNIFORMA_CATALOG_SYNC_TOKEN')) {
    define('UNIFORMA_CATALOG_SYNC_TOKEN', '');
}

function uniforma_catalog_api_permission(WP_REST_Request $request)
{
    if (strlen((string) UNIFORMA_CATALOG_SYNC_TOKEN) < 24) {
        return new WP_Error(
            'uniforma_token_not_configured',
            'Falta la clave de conexión: definí UNIFORMA_CATALOG_SYNC_TOKEN (24 caracteres o más) en wp-config.php.',
            array('status' => 503)
        );
    }

    $provided = (string) $request->get_header('x-uniforma-catalog-token');

    if ('' === $provided || ! hash_equals((string) UNIFORMA_CATALOG_SYNC_TOKEN, $provided)) {
        return new WP_Error('uniforma_forbidden', 'Clave inválida.', array('status' => 403));
    }

    return true;
}

function uniforma_catalog_attribute_values($product, $taxonomy)
{
    if (! $product || ! taxonomy_exists($taxonomy)) {
        return array();
    }
    return array_values(wp_get_post_terms($product->get_id(), $taxonomy, array('fields' => 'names')));
}

/**
 * Color de muestra de un color de producto: el elegido en el ERP (guardado en el término),
 * si no el de la paleta del sitio, y si no un gris neutro.
 */
function uniforma_catalog_color_hex($name)
{
    $override = function_exists('uniforma_term_hex_override') ? uniforma_term_hex_override($name) : '';

    if ('' !== $override) {
        return $override;
    }

    $palette = function_exists('uniforma_color_swatch_hex') ? uniforma_color_swatch_hex($name) : '';

    return '' !== $palette ? $palette : '#d8d1c7';
}

function uniforma_catalog_product_payload($product)
{
    $id = $product->get_id();
    $image_id = $product->get_image_id();
    $gallery = $product->get_gallery_image_ids();
    $front = $image_id ? wp_get_attachment_image_url($image_id, 'full') : wc_placeholder_img_src('woocommerce_single');
    $back_id = ! empty($gallery) ? $gallery[0] : $image_id;
    $back = $back_id ? wp_get_attachment_image_url($back_id, 'full') : $front;
    $categories = wp_get_post_terms($id, 'product_cat', array('fields' => 'names'));
    $colors = uniforma_catalog_attribute_values($product, 'pa_color');
    if (empty($colors)) {
        $colors = uniforma_catalog_attribute_values($product, 'pa_colores');
    }
    $sizes = uniforma_catalog_attribute_values($product, 'pa_talle');
    if (empty($sizes)) {
        $sizes = uniforma_catalog_attribute_values($product, 'pa_talles');
    }
    $prices = array();
    foreach (array(5, 10, 20, 50) as $qty) {
        $value = get_post_meta($id, 'uniforma_precio_x' . $qty, true);
        $prices[(string) $qty] = is_numeric($value) ? (float) $value : 0;
    }
    if ($prices['5'] <= 0) {
        $prices['5'] = (float) $product->get_price();
    }
    foreach (array(10, 20, 50) as $qty) {
        if ($prices[(string) $qty] <= 0) {
            $prices[(string) $qty] = $prices['5'];
        }
    }

    return array(
        'id' => 'woo-' . $id,
        'wooId' => $id,
        'sku' => $product->get_sku(),
        'name' => $product->get_name(),
        'category' => ! empty($categories) ? $categories[0] : 'Sin categoría',
        'image' => esc_url_raw($front),
        'imageBack' => esc_url_raw($back),
        'sizeOptions' => array_values($sizes),
        'sizes' => implode(', ', $sizes),
        'colors' => array_map(static function ($name) { return array('name' => $name, 'hex' => uniforma_catalog_color_hex($name)); }, $colors),
        'methods' => array('Bordado', 'DTF'),
        'material' => wp_strip_all_tags($product->get_short_description()),
        'shortDescription' => uniforma_erp_html_to_text($product->get_short_description()),
        'description' => uniforma_erp_html_to_text($product->get_description()),
        'prices' => $prices,
        'basePrice' => $prices['5'],
        'permalink' => get_permalink($id),
        'modifiedAt' => get_post_modified_time('c', true, $id),
        'status' => get_post_status($id),
        'slug' => $product->get_slug(),
        'categories' => is_array($categories) ? array_values($categories) : array(),
        'tags' => array_values((array) wp_get_post_terms($id, 'product_tag', array('fields' => 'names'))),
        'details' => uniforma_erp_html_to_text(get_post_meta($id, 'uniforma_detalles', true)),
        'care' => uniforma_erp_html_to_text(get_post_meta($id, 'uniforma_cuidados', true)),
        'hasSizeChart' => '' !== trim((string) get_post_meta($id, 'uniforma_tabla_talles', true)),
        'isNew' => (bool) get_post_meta($id, 'uniforma_producto_nuevo', true),
        'buttonPersonalize' => (string) get_post_meta($id, 'uniforma_texto_boton_personalizar', true),
        'buttonQuote' => (string) get_post_meta($id, 'uniforma_texto_boton_presupuesto', true),
        'seoDescription' => (string) get_post_meta($id, 'uniforma_seo_descripcion', true),
        'minQuantity' => (int) get_post_meta($id, 'uniforma_cantidad_minima', true),
        'editUrl' => admin_url('post.php?post=' . (int) $id . '&action=edit'),
        'wooType' => $product->get_type(),
    );
}

function uniforma_catalog_api_callback()
{
    $query = new WP_Query(array(
        'post_type' => 'product',
        'post_status' => array('publish', 'draft', 'pending', 'private'),
        'posts_per_page' => -1,
        'orderby' => 'title',
        'order' => 'ASC',
        'fields' => 'ids',
    ));
    $products = array();
    foreach ($query->posts as $product_id) {
        $product = wc_get_product($product_id);
        if ($product) {
            $products[] = uniforma_catalog_product_payload($product);
        }
    }
    return rest_ensure_response(array('ok' => true, 'products' => $products, 'count' => count($products), 'generatedAt' => current_time('c', true)));
}

function uniforma_register_catalog_api()
{
    register_rest_route('uniforma/v1', '/catalog', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'uniforma_catalog_api_callback',
        'permission_callback' => 'uniforma_catalog_api_permission',
    ));
}
add_action('rest_api_init', 'uniforma_register_catalog_api');

/* =========================================
   11) SHORTCODES Y BLOQUES DEL TEMA
========================================= */

require_once get_template_directory() . '/inc/uniforma-erp-leads.php';
require_once get_template_directory() . '/inc/uniforma-home-settings.php';
require_once get_template_directory() . '/shortcodes/uniforma-header.php';
require_once get_template_directory() . '/shortcodes/uniforma-footer.php';
require_once get_template_directory() . '/shortcodes/uniforma-home.php';
require_once get_template_directory() . '/shortcodes/uniforma-shop.php';
require_once get_template_directory() . '/shortcodes/uniforma-customizer.php';
require_once get_template_directory() . '/shortcodes/uniforma-contact.php';
require_once get_template_directory() . '/shortcodes/uniforma-about.php';
require_once get_template_directory() . '/shortcodes/uniforma-faq.php';
require_once get_template_directory() . '/shortcodes/uniforma-terms.php';
require_once get_template_directory() . '/shortcodes/uniforma-withdrawal.php';

require_once get_template_directory() . '/whatsapp.php';

/* Guarda la vista previa generada por el simulador. */
function uniforma_customizer_upload_preview(){
    check_ajax_referer('uniforma_customizer_nonce','nonce');
    $data=isset($_POST['image'])?wp_unslash($_POST['image']):'';
    if(!preg_match('#^data:image/png;base64,#',$data)){wp_send_json_error(array('message'=>'Imagen inválida.'));}
    $binary=base64_decode(substr($data,strpos($data,',')+1));
    if(!$binary||strlen($binary)>12*1024*1024){wp_send_json_error(array('message'=>'La vista previa es demasiado grande.'));}
    $upload=wp_upload_bits('uniforma-diseno-'.wp_generate_password(8,false).'.png',null,$binary);
    if(!empty($upload['error'])){wp_send_json_error(array('message'=>$upload['error']));}
    wp_send_json_success(array('url'=>esc_url_raw($upload['url'])));
}
add_action('wp_ajax_uniforma_upload_preview','uniforma_customizer_upload_preview');
add_action('wp_ajax_nopriv_uniforma_upload_preview','uniforma_customizer_upload_preview');
