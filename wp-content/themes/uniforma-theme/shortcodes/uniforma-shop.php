<?php
/**
 * UNIFORMA — Shop shortcode con filtros
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Orden lógico de talles: ropa (XS…5XL), luego numéricos, luego el resto.
 */
function uniforma_shop_size_rank($label)
{
    $label = strtoupper(trim((string) $label));
    $order = array('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL');

    $pos = array_search($label, $order, true);
    if (false !== $pos) {
        return $pos;
    }

    if (is_numeric(str_replace(',', '.', $label))) {
        return 100 + (float) str_replace(',', '.', $label);
    }

    return 1000;
}

function uniforma_shop_shortcode()
{
    ob_start();

    /*
     * Cambiá esto si tu página no se llama /tienda/.
     * Ejemplo: home_url('/catalogo/')
     */
    $shop_page_url = home_url('/tienda/');

    $categories = array(
        array('label' => 'Todos',      'slug' => ''),
        array('label' => 'Remeras',    'slug' => 'remeras'),
        array('label' => 'Chombas',    'slug' => 'chombas'),
        array('label' => 'Buzos',      'slug' => 'buzos'),
        array('label' => 'Camperas',   'slug' => 'camperas'),
        array('label' => 'Pantalones', 'slug' => 'pantalones'),
        array('label' => 'Accesorios', 'slug' => 'accesorios'),
        array('label' => 'Calzado',    'slug' => 'zapatillas'),
    );

    $colors = array(
        'blanco' => 'Blanco',
        'beige'  => 'Beige',
        'gris'   => 'Gris',
        'azul'   => 'Azul',
        'negro'  => 'Negro',
        'verde'  => 'Verde',
    );

    $personalizations = array(
        'bordado'       => 'Bordado',
        'estampado-dtf' => 'Estampado DTF',
    );

    // Talles: se arman desde la taxonomía real, ordenados de forma lógica.
    $sizes = array();
    if (taxonomy_exists('pa_talle')) {
        $size_terms = get_terms(array('taxonomy' => 'pa_talle', 'hide_empty' => true));
        if (! is_wp_error($size_terms)) {
            usort($size_terms, function ($a, $b) {
                return uniforma_shop_size_rank($a->name) <=> uniforma_shop_size_rank($b->name);
            });
            foreach ($size_terms as $size_term) {
                $sizes[$size_term->slug] = $size_term->name;
            }
        }
    }

    $orderby_options = array(
        ''           => 'Predeterminado',
        'price_asc'  => 'Menor precio',
        'price_desc' => 'Mayor precio',
        'recent'     => 'Más recientes',
    );

    $selected_category        = isset($_GET['categoria']) ? sanitize_title(wp_unslash($_GET['categoria'])) : '';
    $selected_color           = isset($_GET['color']) ? sanitize_title(wp_unslash($_GET['color'])) : '';
    $selected_size            = isset($_GET['talle']) ? sanitize_title(wp_unslash($_GET['talle'])) : '';
    $selected_personalization = isset($_GET['personalizacion']) ? sanitize_title(wp_unslash($_GET['personalizacion'])) : '';
    $selected_orderby         = isset($_GET['orden']) ? sanitize_key(wp_unslash($_GET['orden'])) : '';

    $paged = max(
        1,
        get_query_var('paged') ? get_query_var('paged') : 1,
        get_query_var('page') ? get_query_var('page') : 1
    );

    $tax_query = array();

    if ('' !== $selected_category) {
        $tax_query[] = array('taxonomy' => 'product_cat', 'field' => 'slug', 'terms' => $selected_category);
    }

    if ('' !== $selected_color) {
        $tax_query[] = array('taxonomy' => 'pa_color', 'field' => 'slug', 'terms' => $selected_color);
    }

    if ('' !== $selected_size && ! empty($sizes)) {
        $tax_query[] = array('taxonomy' => 'pa_talle', 'field' => 'slug', 'terms' => $selected_size);
    }

    if ('' !== $selected_personalization) {
        $tax_query[] = array('taxonomy' => 'pa_personalizacion', 'field' => 'slug', 'terms' => $selected_personalization);
    }

    if (! empty($tax_query)) {
        $tax_query['relation'] = 'AND';
    }

    $query_args = array(
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => 12,
        'paged'          => $paged,
    );

    if (! empty($tax_query)) {
        $query_args['tax_query'] = $tax_query;
    }

    switch ($selected_orderby) {
        case 'price_asc':
            $query_args['meta_key'] = '_price';
            $query_args['orderby']  = 'meta_value_num';
            $query_args['order']    = 'ASC';
            break;

        case 'price_desc':
            $query_args['meta_key'] = '_price';
            $query_args['orderby']  = 'meta_value_num';
            $query_args['order']    = 'DESC';
            break;

        case 'recent':
            $query_args['orderby'] = 'date';
            $query_args['order']   = 'DESC';
            break;

        default:
            $query_args['orderby'] = 'menu_order title';
            $query_args['order']   = 'ASC';
            break;
    }

    $products_query = new WP_Query($query_args);

    // Filtros activos (chips con «×» para quitar uno por uno).
    $filter_state = array(
        'categoria'       => $selected_category,
        'color'           => $selected_color,
        'talle'           => $selected_size,
        'personalizacion' => $selected_personalization,
        'orden'           => $selected_orderby,
    );

    $active_filters = array();

    if ('' !== $selected_category) {
        $category_label = $selected_category;
        foreach ($categories as $category) {
            if ($category['slug'] === $selected_category) {
                $category_label = $category['label'];
            }
        }
        $active_filters['categoria'] = $category_label;
    }

    if ('' !== $selected_color) {
        $active_filters['color'] = isset($colors[$selected_color]) ? $colors[$selected_color] : $selected_color;
    }

    if ('' !== $selected_size) {
        $active_filters['talle'] = isset($sizes[$selected_size]) ? $sizes[$selected_size] : strtoupper($selected_size);
    }

    if ('' !== $selected_personalization) {
        $active_filters['personalizacion'] = isset($personalizations[$selected_personalization]) ? $personalizations[$selected_personalization] : $selected_personalization;
    }

    $filter_url = function ($overrides) use ($shop_page_url, $filter_state) {
        return add_query_arg(array_filter(array_merge($filter_state, $overrides), 'strlen'), $shop_page_url);
    };

    $filter_count = count($active_filters) + ('' !== $selected_orderby ? 1 : 0);
    ?>

    <main class="uniforma-shop-page">

        <header class="uniforma-shop-head">
            <div class="uniforma-wrap uniforma-shop-head__inner">
                <div>
                    <p class="uniforma-label">Catálogo / Uniformes</p>
                    <h1>
                        Catálogo
                        <sup class="uniforma-shop-head__count"><?php echo esc_html($products_query->found_posts); ?></sup>
                    </h1>
                </div>

                <div class="uniforma-shop-head__aside">
                    <p>Elegí la prenda para tu equipo y personalizala con bordado o DTF. Pedido mínimo de 5 unidades.</p>
                    <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>" class="uniforma-link">Simulá tu prenda</a>
                </div>
            </div>
        </header>

        <section class="uniforma-shop-products">
            <div class="uniforma-wrap">

                <nav class="uniforma-shop-categories" aria-label="Categorías de productos">
                    <?php foreach ($categories as $category) : ?>
                        <a
                            href="<?php echo esc_url($filter_url(array('categoria' => $category['slug']))); ?>"
                            class="uniforma-shop-categories__item <?php echo $selected_category === $category['slug'] ? 'is-active' : ''; ?>"
                            <?php echo $selected_category === $category['slug'] ? 'aria-current="true"' : ''; ?>
                        >
                            <?php echo esc_html($category['label']); ?>
                        </a>
                    <?php endforeach; ?>
                </nav>

                <form class="uniforma-shop-filters" id="uniformaShopFilters" method="get" action="<?php echo esc_url($shop_page_url); ?>">
                    <details class="uniforma-shop-filters__panel" open>
                        <summary>
                            <span>Filtrar y ordenar</span>
                            <?php if ($filter_count) : ?>
                                <span class="uniforma-shop-filters__badge"><?php echo esc_html($filter_count); ?></span>
                            <?php endif; ?>
                        </summary>

                        <div class="uniforma-shop-filters__fields">
                            <?php if ('' !== $selected_category) : ?>
                                <input type="hidden" name="categoria" value="<?php echo esc_attr($selected_category); ?>">
                            <?php endif; ?>

                            <label>
                                <span class="uniforma-label">Color</span>
                                <select name="color">
                                    <option value="">Todos</option>
                                    <?php foreach ($colors as $color_slug => $color_label) : ?>
                                        <option value="<?php echo esc_attr($color_slug); ?>" <?php selected($selected_color, $color_slug); ?>><?php echo esc_html($color_label); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </label>

                            <?php if (! empty($sizes)) : ?>
                                <label>
                                    <span class="uniforma-label">Talle</span>
                                    <select name="talle">
                                        <option value="">Todos</option>
                                        <?php foreach ($sizes as $size_slug => $size_label) : ?>
                                            <option value="<?php echo esc_attr($size_slug); ?>" <?php selected($selected_size, $size_slug); ?>><?php echo esc_html($size_label); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </label>
                            <?php endif; ?>

                            <label>
                                <span class="uniforma-label">Personalización</span>
                                <select name="personalizacion">
                                    <option value="">Todas</option>
                                    <?php foreach ($personalizations as $personalization_slug => $personalization_label) : ?>
                                        <option value="<?php echo esc_attr($personalization_slug); ?>" <?php selected($selected_personalization, $personalization_slug); ?>><?php echo esc_html($personalization_label); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </label>

                            <label>
                                <span class="uniforma-label">Ordenar por</span>
                                <select name="orden">
                                    <?php foreach ($orderby_options as $order_value => $order_label) : ?>
                                        <option value="<?php echo esc_attr($order_value); ?>" <?php selected($selected_orderby, $order_value); ?>><?php echo esc_html($order_label); ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </label>

                            <button type="submit" class="uniforma-btn uniforma-shop-filters__apply">Aplicar</button>
                        </div>
                    </details>
                </form>

                <div class="uniforma-shop-results">
                    <p class="uniforma-label">
                        <?php if ($products_query->have_posts()) : ?>
                            Mostrando <?php echo esc_html($products_query->post_count); ?> de <?php echo esc_html($products_query->found_posts); ?>
                        <?php else : ?>
                            0 resultados
                        <?php endif; ?>
                    </p>

                    <?php if (! empty($active_filters)) : ?>
                        <ul class="uniforma-shop-chips" aria-label="Filtros activos">
                            <?php foreach ($active_filters as $filter_key => $filter_label) : ?>
                                <li>
                                    <a href="<?php echo esc_url($filter_url(array($filter_key => ''))); ?>" aria-label="Quitar filtro <?php echo esc_attr($filter_label); ?>">
                                        <?php echo esc_html($filter_label); ?> <span aria-hidden="true">×</span>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                            <li class="uniforma-shop-chips__clear">
                                <a href="<?php echo esc_url($shop_page_url); ?>">Limpiar todos</a>
                            </li>
                        </ul>
                    <?php endif; ?>
                </div>

                <?php if ($products_query->have_posts()) : ?>

                    <div class="uniforma-shop-grid">
                        <?php
                        while ($products_query->have_posts()) {
                            $products_query->the_post();
                            uniforma_render_product_card(wc_get_product(get_the_ID()), array('colors' => true, 'actions' => true));
                        }
                        wp_reset_postdata();
                        ?>
                    </div>

                    <?php if ($products_query->max_num_pages > 1) : ?>
                        <nav class="uniforma-shop-pagination" aria-label="Paginación del catálogo">
                            <?php
                            echo paginate_links(array( // phpcs:ignore WordPress.Security.EscapeOutput
                                'base'      => esc_url_raw(add_query_arg('paged', '%#%', $shop_page_url)),
                                'format'    => '',
                                'total'     => $products_query->max_num_pages,
                                'current'   => $paged,
                                'prev_text' => '←',
                                'next_text' => '→',
                                'add_args'  => array_filter($filter_state, 'strlen'),
                            ));
                            ?>
                        </nav>
                    <?php endif; ?>

                <?php else : ?>

                    <div class="uniforma-shop-empty">
                        <h2>No encontramos productos</h2>
                        <p>Probá quitar algún filtro. Si buscás algo puntual, escribinos y lo conseguimos.</p>
                        <div class="uniforma-shop-empty__actions">
                            <a href="<?php echo esc_url($shop_page_url); ?>" class="uniforma-btn">Limpiar filtros</a>
                            <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-btn uniforma-btn--ghost">Pedir presupuesto</a>
                        </div>
                    </div>

                <?php endif; ?>

            </div>
        </section>

        <section class="uniforma-shop-cta" aria-labelledby="uniforma-shop-cta-title">
            <div class="uniforma-wrap uniforma-shop-cta__inner">
                <div>
                    <h2 id="uniforma-shop-cta-title">¿Uniformes para tu equipo?</h2>
                    <p>Asesoramiento personalizado y propuestas a medida para empresas. Contanos qué prendas, cuántas y dónde va el logo.</p>
                </div>
                <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-btn">Pedí tu presupuesto <span aria-hidden="true">→</span></a>
            </div>

            <div class="uniforma-wrap">
                <ul class="uniforma-shop-benefits">
                    <li><span class="uniforma-label">01</span><strong>Bordado</strong><span>Acabado profesional y máxima durabilidad.</span></li>
                    <li><span class="uniforma-label">02</span><strong>Estampado DTF</strong><span>Colores vibrantes, detalle y resistencia al lavado.</span></li>
                    <li><span class="uniforma-label">03</span><strong>Presupuesto</strong><span>Rápido, simple y sin compromiso.</span></li>
                    <li><span class="uniforma-label">04</span><strong>Envíos</strong><span>A todo el país.</span></li>
                </ul>
            </div>
        </section>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_shop', 'uniforma_shop_shortcode');
