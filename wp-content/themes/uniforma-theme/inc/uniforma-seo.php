<?php
/**
 * UNIFORMA — Descripción para Google y vista previa al compartir (WhatsApp, redes).
 *
 * Agrega la meta descripción y las etiquetas Open Graph de cada página, y corrige
 * los títulos de pestaña. Si hay un plugin de SEO activo no hace nada, para no duplicar etiquetas.
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_seo_plugin_active()
{
    return defined('WPSEO_VERSION')
        || defined('RANK_MATH_VERSION')
        || defined('AIOSEO_VERSION')
        || defined('SEOPRESS_VERSION')
        || defined('THE_SEO_FRAMEWORK_VERSION');
}

/**
 * Texto plano en una sola línea, recortado sin cortar palabras.
 */
function uniforma_seo_trim($text, $max = 155)
{
    $text = wp_strip_all_tags(strip_shortcodes((string) $text));
    $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode($text, ENT_QUOTES, 'UTF-8')));

    if (mb_strlen($text) <= $max) {
        return $text;
    }

    $cut = mb_substr($text, 0, $max - 1);
    $by_word = preg_replace('/\s+\S*$/u', '', $cut);

    if (is_string($by_word) && mb_strlen($by_word) > ($max * 0.6)) {
        $cut = $by_word;
    }

    return rtrim($cut, " ,.;:-") . '…';
}

/**
 * Descripciones fijas de las páginas del sitio, por dirección (slug).
 */
function uniforma_seo_page_descriptions()
{
    return array(
        'nosotros'                 => 'Conocé UNIFORMA: diseñamos y producimos indumentaria personalizada para empresas y equipos de trabajo, con bordado y estampado DTF de calidad profesional.',
        'contacto'                 => 'Pedí tu presupuesto de indumentaria personalizada. Escribinos por WhatsApp o completá el formulario y te respondemos a la brevedad.',
        'simula-tu-prenda'         => 'Simulá tu uniforme online: elegí la prenda, el color y el talle, cargá tu logo y mirá cómo queda antes de pedir tu presupuesto.',
        'preguntas-frecuentes'     => 'Respuestas sobre pedidos, personalización con logo, plazos de entrega, envíos y descuentos por cantidad en UNIFORMA.',
        'terminos-y-condiciones'   => 'Términos y condiciones de compra y de uso del sitio de UNIFORMA.',
        'boton-de-arrepentimiento' => 'Botón de arrepentimiento de UNIFORMA: pedí la revocación de tu compra a distancia.',
    );
}

/**
 * Títulos de pestaña correctos para las páginas informativas
 * (WordPress usa el título cargado en el editor, que puede venir en minúsculas y sin acentos).
 */
function uniforma_seo_page_titles()
{
    return array(
        'preguntas-frecuentes'     => 'Preguntas frecuentes',
        'terminos-y-condiciones'   => 'Términos y condiciones',
        'boton-de-arrepentimiento' => 'Botón de arrepentimiento',
    );
}

function uniforma_seo_current_page_slug()
{
    return is_singular('page') ? (string) get_post_field('post_name', get_queried_object_id()) : '';
}

/**
 * Meta descripción de la página actual. Devuelve '' en páginas que no se indexan.
 */
function uniforma_seo_description()
{
    $tagline = 'Personalizable con bordado o DTF. Pedido mínimo de 5 unidades.';

    if (is_search() || is_404()) {
        return '';
    }

    if (function_exists('is_cart') && (is_cart() || is_checkout() || is_account_page())) {
        return '';
    }

    if (is_front_page()) {
        return 'UNIFORMA: indumentaria personalizada para empresas y equipos de trabajo. Bordado y estampado DTF, pedido mínimo de 5 unidades y envíos a todo el país.';
    }

    if (function_exists('is_product') && is_product()) {
        // Descripción para Google cargada a mano (por ejemplo desde el ERP).
        $custom = uniforma_seo_trim(get_post_meta(get_queried_object_id(), 'uniforma_seo_descripcion', true), 160);

        if ('' !== $custom) {
            return $custom;
        }

        $product = wc_get_product(get_queried_object_id());

        if ($product) {
            $lead = uniforma_seo_trim($product->get_short_description() ?: $product->get_description(), 95);

            if ('' === $lead) {
                $lead = $product->get_name() . '.';
            } elseif (! preg_match('/[.…]$/u', $lead)) {
                $lead .= '.';
            }

            return $lead . ' ' . $tagline;
        }
    }

    if (function_exists('is_product_category') && is_product_category()) {
        $term = get_queried_object();

        if ($term && ! is_wp_error($term)) {
            $own = uniforma_seo_trim($term->description, 155);

            if ('' !== $own) {
                return $own;
            }

            return $term->name . ' en UNIFORMA: indumentaria personalizable con bordado o DTF para empresas y equipos. Pedido mínimo de 5 unidades y envíos a todo el país.';
        }
    }

    if ((function_exists('is_shop') && is_shop()) || uniforma_is_shop_page()) {
        return 'Catálogo de indumentaria para empresas: remeras, chombas, buzos, camisas, pantalones y más. Personalizable con bordado o DTF. Mínimo 5 unidades.';
    }

    $slug = uniforma_seo_current_page_slug();
    $fixed = uniforma_seo_page_descriptions();

    if ($slug && isset($fixed[$slug])) {
        return $fixed[$slug];
    }

    if (is_singular()) {
        $post = get_queried_object();

        if ($post instanceof WP_Post) {
            return uniforma_seo_trim($post->post_excerpt ?: $post->post_content, 155);
        }
    }

    return '';
}

/**
 * Imagen para la vista previa al compartir.
 */
function uniforma_seo_image()
{
    if (function_exists('is_product') && is_product()) {
        $image_id = get_post_thumbnail_id(get_queried_object_id());
        $image = $image_id ? wp_get_attachment_image_url($image_id, 'large') : '';

        if ($image) {
            return $image;
        }
    }

    return trailingslashit(get_template_directory_uri()) . 'assets/images/home/uniforma-banner-identidad.webp';
}

function uniforma_seo_head()
{
    if (is_admin() || uniforma_seo_plugin_active()) {
        return;
    }

    $description = uniforma_seo_description();

    if ('' === $description) {
        return;
    }

    $title = wp_get_document_title();
    $url = trailingslashit(home_url($GLOBALS['wp']->request));
    $type = (function_exists('is_product') && is_product()) ? 'product' : 'website';

    echo '<meta name="description" content="' . esc_attr($description) . '">' . "\n";
    echo '<meta property="og:locale" content="es_AR">' . "\n";
    echo '<meta property="og:site_name" content="UNIFORMA">' . "\n";
    echo '<meta property="og:type" content="' . esc_attr($type) . '">' . "\n";
    echo '<meta property="og:title" content="' . esc_attr($title) . '">' . "\n";
    echo '<meta property="og:description" content="' . esc_attr($description) . '">' . "\n";
    echo '<meta property="og:url" content="' . esc_url($url) . '">' . "\n";
    echo '<meta property="og:image" content="' . esc_url(uniforma_seo_image()) . '">' . "\n";
    echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
}
add_action('wp_head', 'uniforma_seo_head', 1);

/**
 * Título de la pestaña: portada con su descripción corta y páginas informativas con su nombre correcto.
 */
function uniforma_seo_document_title_parts($parts)
{
    if (uniforma_seo_plugin_active()) {
        return $parts;
    }

    if (is_front_page()) {
        $parts['title'] = 'UNIFORMA';
        $parts['tagline'] = 'Indumentaria personalizada para empresas y equipos';
        unset($parts['site']);

        return $parts;
    }

    $slug = uniforma_seo_current_page_slug();
    $titles = uniforma_seo_page_titles();

    if ($slug && isset($titles[$slug])) {
        $parts['title'] = $titles[$slug];
    }

    return $parts;
}
add_filter('document_title_parts', 'uniforma_seo_document_title_parts');
