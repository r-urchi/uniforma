<?php
/**
 * UNIFORMA — Ajustes editables del inicio.
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_faq_max_items()
{
    return 15;
}

function uniforma_home_settings_defaults()
{
    return array(
        'featured_products' => array(),
        'faqs' => array(
            array(
                'question' => '¿Hacen envíos a todo el país?',
                'answer'   => 'Sí. Realizamos envíos a todo el país y coordinamos la modalidad más conveniente para cada pedido.',
            ),
            array(
                'question' => '¿Puedo personalizar la indumentaria con mi logo?',
                'answer'   => 'Sí. Personalizamos las prendas con tu logo mediante la técnica más adecuada para el diseño y el tipo de tela.',
            ),
            array(
                'question' => '¿En cuánto tiempo recibo mi pedido?',
                'answer'   => 'El plazo depende del producto, la cantidad y el tipo de personalización. Te informamos la fecha estimada antes de confirmar el pedido.',
            ),
            array(
                'question' => '¿Ofrecen descuentos por compras grandes?',
                'answer'   => 'Sí. Trabajamos con precios por cantidad para empresas, equipos y pedidos mayoristas.',
            ),
        ),
    );
}

function uniforma_get_all_faqs()
{
    $settings = uniforma_get_home_settings();
    $faqs = array();

    foreach ((array) $settings['faqs'] as $faq) {
        if (! empty($faq['question']) && ! empty($faq['answer'])) {
            $faqs[] = $faq;
        }
    }

    return $faqs;
}

function uniforma_get_home_faqs($limit = 4)
{
    return array_slice(uniforma_get_all_faqs(), 0, $limit);
}

function uniforma_get_home_settings()
{
    $defaults = uniforma_home_settings_defaults();
    $settings = get_option('uniforma_home_settings', array());

    if (! is_array($settings)) {
        return $defaults;
    }

    $settings = wp_parse_args($settings, $defaults);
    $settings['featured_products'] = isset($settings['featured_products']) && is_array($settings['featured_products'])
        ? array_values(array_filter(array_map('absint', $settings['featured_products'])))
        : array();

    if (empty($settings['faqs']) || ! is_array($settings['faqs'])) {
        $settings['faqs'] = $defaults['faqs'];
    }

    return $settings;
}

function uniforma_sanitize_home_settings($input)
{
    $defaults = uniforma_home_settings_defaults();
    $clean = array(
        'featured_products' => array(),
        'faqs'              => array(),
    );

    if (isset($input['featured_products']) && is_array($input['featured_products'])) {
        $clean['featured_products'] = array_values(array_unique(array_filter(array_map('absint', $input['featured_products']))));
    }

    for ($index = 0; $index < uniforma_faq_max_items(); $index++) {
        $question = isset($input['faqs'][$index]['question']) ? sanitize_text_field($input['faqs'][$index]['question']) : '';
        $answer = isset($input['faqs'][$index]['answer']) ? sanitize_textarea_field($input['faqs'][$index]['answer']) : '';

        if ($question !== '' && $answer !== '') {
            $clean['faqs'][] = array(
                'question' => $question,
                'answer'   => $answer,
            );
        }
    }

    if (empty($clean['faqs'])) {
        $clean['faqs'] = $defaults['faqs'];
    }

    return $clean;
}

function uniforma_register_home_settings()
{
    register_setting(
        'uniforma_home_settings_group',
        'uniforma_home_settings',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'uniforma_sanitize_home_settings',
            'default'           => uniforma_home_settings_defaults(),
        )
    );
}
add_action('admin_init', 'uniforma_register_home_settings');

function uniforma_add_home_settings_page()
{
    add_theme_page(
        'Inicio Uniforma',
        'Inicio Uniforma',
        'manage_options',
        'uniforma-home-settings',
        'uniforma_render_home_settings_page'
    );
}
add_action('admin_menu', 'uniforma_add_home_settings_page');

function uniforma_home_settings_admin_assets($hook)
{
    if ('appearance_page_uniforma-home-settings' !== $hook || ! class_exists('WooCommerce')) {
        return;
    }

    wp_enqueue_style('woocommerce_admin_styles');
    wp_enqueue_script('wc-enhanced-select');
    wp_localize_script(
        'wc-enhanced-select',
        'wc_enhanced_select_params',
        array(
            'i18n_no_matches'           => 'No se encontraron productos',
            'i18n_ajax_error'           => 'No se pudieron cargar los productos',
            'i18n_input_too_short_1'    => 'Ingresá al menos 1 carácter',
            'i18n_input_too_short_n'    => 'Ingresá al menos %qty% caracteres',
            'i18n_input_too_long_1'     => 'Eliminá 1 carácter',
            'i18n_input_too_long_n'     => 'Eliminá %qty% caracteres',
            'i18n_selection_too_long_1' => 'Solo podés seleccionar 1 producto',
            'i18n_selection_too_long_n' => 'Solo podés seleccionar %qty% productos',
            'i18n_load_more'            => 'Cargando más resultados…',
            'i18n_searching'            => 'Buscando…',
            'ajax_url'                  => admin_url('admin-ajax.php'),
            'search_products_nonce'     => wp_create_nonce('search-products'),
        )
    );
}
add_action('admin_enqueue_scripts', 'uniforma_home_settings_admin_assets');

function uniforma_render_home_settings_page()
{
    if (! current_user_can('manage_options')) {
        return;
    }

    $settings = uniforma_get_home_settings();
    ?>
    <div class="wrap">
        <h1>Inicio Uniforma</h1>
        <p>Elegí los productos del carrusel y editá las preguntas frecuentes que aparecen al final del inicio.</p>

        <form method="post" action="options.php">
            <?php settings_fields('uniforma_home_settings_group'); ?>

            <h2>Productos más vendidos</h2>
            <p>Buscá y seleccioná los productos que querés mostrar. Si dejás el campo vacío, se usarán automáticamente los productos más vendidos de WooCommerce.</p>

            <?php if (class_exists('WooCommerce')) : ?>
                <select
                    class="wc-product-search"
                    multiple="multiple"
                    style="width: min(100%, 760px);"
                    name="uniforma_home_settings[featured_products][]"
                    data-placeholder="Buscar productos…"
                    data-action="woocommerce_json_search_products"
                >
                    <?php foreach ($settings['featured_products'] as $product_id) : ?>
                        <?php $product = wc_get_product($product_id); ?>
                        <?php if ($product) : ?>
                            <option value="<?php echo esc_attr($product_id); ?>" selected="selected"><?php echo esc_html(wp_strip_all_tags($product->get_formatted_name())); ?></option>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </select>
            <?php else : ?>
                <p><strong>WooCommerce debe estar activo para seleccionar productos.</strong></p>
            <?php endif; ?>

            <hr style="margin: 32px 0;">
            <h2>Preguntas frecuentes</h2>
            <p>
                Las primeras 4 preguntas completas se muestran en el inicio. Todas las que completes
                (hasta <?php echo esc_html(uniforma_faq_max_items()); ?>) se muestran en la página
                <a href="<?php echo esc_url(home_url('/preguntas-frecuentes/')); ?>" target="_blank">Preguntas frecuentes</a>.
                Dejá una pregunta vacía para que no se muestre.
            </p>

            <table class="form-table" role="presentation">
                <tbody>
                    <?php for ($index = 0; $index < uniforma_faq_max_items(); $index++) : ?>
                        <?php $faq = isset($settings['faqs'][$index]) ? $settings['faqs'][$index] : array('question' => '', 'answer' => ''); ?>
                        <tr>
                            <th scope="row">Pregunta <?php echo esc_html($index + 1); ?></th>
                            <td>
                                <input
                                    type="text"
                                    class="regular-text"
                                    style="width: min(100%, 760px);"
                                    name="uniforma_home_settings[faqs][<?php echo esc_attr($index); ?>][question]"
                                    value="<?php echo esc_attr($faq['question']); ?>"
                                >
                                <textarea
                                    class="large-text"
                                    rows="3"
                                    style="display:block; width:min(100%, 760px); margin-top:8px;"
                                    name="uniforma_home_settings[faqs][<?php echo esc_attr($index); ?>][answer]"
                                ><?php echo esc_textarea($faq['answer']); ?></textarea>
                            </td>
                        </tr>
                    <?php endfor; ?>
                </tbody>
            </table>

            <?php submit_button('Guardar cambios del inicio'); ?>
        </form>
    </div>
    <?php
}
