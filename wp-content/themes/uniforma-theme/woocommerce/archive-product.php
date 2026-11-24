<?php
/**
 * UNIFORMA — WooCommerce archive custom template
 */

defined('ABSPATH') || exit;

get_header();

if (! function_exists('wc_get_products')) {
    get_footer();
    return;
}

if (! function_exists('uniforma_get_category_product_ids')) {
    function uniforma_get_category_product_ids($category_slug)
    {
        if (! $category_slug) {
            return array();
        }

        $products = get_posts(array(
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'tax_query'      => array(
                array(
                    'taxonomy' => 'product_cat',
                    'field'    => 'slug',
                    'terms'    => $category_slug,
                ),
            ),
        ));

        return is_array($products) ? $products : array();
    }
}

if (! function_exists('uniforma_get_attribute_terms_for_products')) {
    function uniforma_get_attribute_terms_for_products($taxonomy, $product_ids)
    {
        if (empty($product_ids) || ! taxonomy_exists($taxonomy)) {
            return array();
        }

        $terms = wp_get_object_terms($product_ids, $taxonomy, array(
            'hide_empty' => true,
        ));

        if (is_wp_error($terms) || empty($terms)) {
            return array();
        }

        return $terms;
    }
}

if (! function_exists('uniforma_category_icon_svg')) {
    function uniforma_category_icon_svg($icon)
    {
        $icons = array(
            'thread' => '
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 3h8v18H8V3Z"/>
                    <path d="M8 7h8"/>
                    <path d="M8 17h8"/>
                    <path d="M5 10c2 1 2 3 0 4"/>
                    <path d="M19 10c-2 1-2 3 0 4"/>
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
        );

        return isset($icons[$icon]) ? $icons[$icon] : '';
    }
}

$is_category = is_product_category();
$is_product_search = function_exists('uniforma_is_product_search_page') && uniforma_is_product_search_page();

if ($is_product_search) {
    require get_template_directory() . '/woocommerce/search-product.php';
    get_footer();
    return;
}

if (! $is_category) {
    ?>

    <main class="uniforma-category-page">
        <section class="uniforma-category-empty">
            <h1>Catálogo de uniformes</h1>
            <p>Visitá nuestro catálogo principal para ver todos los productos disponibles.</p>
            <a href="<?php echo esc_url(home_url('/catalogo/')); ?>">Ir al catálogo</a>
        </section>
    </main>

    <?php
    get_footer();
    return;
}

$term = get_queried_object();

$category_name = $term && ! is_wp_error($term) ? $term->name : 'Categoría';
$category_slug = $term && ! is_wp_error($term) ? $term->slug : '';
$category_description = $term && ! is_wp_error($term) && $term->description ? $term->description : 'Comodidad, estilo y presencia para tu equipo de trabajo.';

$thumbnail_id = get_term_meta($term->term_id, 'thumbnail_id', true);
$hero_image = $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'full') : '';

if (! $hero_image) {
    $theme_hero_map = function_exists('uniforma_category_hero_image_map') ? uniforma_category_hero_image_map() : array();

    if (isset($theme_hero_map[$category_slug])) {
        $hero_image = trailingslashit(get_template_directory_uri()) . $theme_hero_map[$category_slug];
    }
}

if (! $hero_image) {
    $hero_image = 'https://uniforma.com.ar/wp-content/uploads/2026/06/BANNERCATEGORIAS.png';
}

$selected_tipo = uniforma_category_request_values('tipo');
$selected_manga = uniforma_category_request_values('manga');
$selected_rubro = uniforma_category_request_values('rubro');
$selected_color = uniforma_category_request_values('color');
$selected_talle = uniforma_category_request_values('talle');
$selected_orderby = isset($_GET['orden']) && is_scalar($_GET['orden'])
    ? sanitize_key(wp_unslash($_GET['orden']))
    : '';

$paged = max(
    1,
    get_query_var('paged') ? get_query_var('paged') : 1,
    get_query_var('page') ? get_query_var('page') : 1
);

$category_product_ids = uniforma_get_category_product_ids($category_slug);

$tipo_terms = uniforma_category_get_terms_with_counts('pa_tipo', $category_product_ids);
$manga_terms = uniforma_category_get_terms_with_counts('pa_manga', $category_product_ids);
$color_terms = uniforma_category_get_terms_with_counts('pa_color', $category_product_ids);
$talle_terms = uniforma_category_sort_size_terms(
    uniforma_category_get_terms_with_counts('pa_talle', $category_product_ids)
);
$rubro_options = uniforma_category_get_rubro_options($term);
$rubro_options = uniforma_category_add_rubro_counts($rubro_options, $category_product_ids);
$filter_rubro_options = array_filter($rubro_options, static function ($option) {
    return empty($option['is_current_context']);
});

$current_rubro_key = '';
foreach ($rubro_options as $rubro_key => $rubro_option) {
    if (! empty($rubro_option['is_current_context'])) {
        $current_rubro_key = $rubro_key;
        break;
    }
}

$rubro_filters = $current_rubro_key
    ? uniforma_category_get_rubro_filters($current_rubro_key, $category_product_ids)
    : array();
$active_filter_count = count($selected_tipo)
    + count($selected_manga)
    + count($selected_rubro)
    + count($selected_color)
    + count($selected_talle);

$tax_query = array(
    'relation' => 'AND',
    array(
        'taxonomy' => 'product_cat',
        'field' => 'slug',
        'terms' => array($category_slug),
        'include_children' => true,
        'operator' => 'IN',
    ),
);

$rubro_term_ids = uniforma_category_resolve_rubro_term_ids($selected_rubro, $rubro_options);

if (! empty($rubro_term_ids)) {
    $tax_query[] = array(
        'taxonomy' => 'product_cat',
        'field' => 'term_id',
        'terms' => $rubro_term_ids,
        'include_children' => true,
        'operator' => 'IN',
    );
}

if (! empty($selected_tipo)) {
    if ($current_rubro_key) {
        $rubro_filter_cat_slugs = uniforma_category_resolve_rubro_filter_cat_slugs($current_rubro_key, $selected_tipo);

        if (! empty($rubro_filter_cat_slugs)) {
            $tax_query[] = array(
                'taxonomy' => 'product_cat',
                'field' => 'slug',
                'terms' => $rubro_filter_cat_slugs,
                'include_children' => true,
                'operator' => 'IN',
            );
        }
    } elseif (taxonomy_exists('pa_tipo')) {
        $tax_query[] = array(
            'taxonomy' => 'pa_tipo',
            'field' => 'slug',
            'terms' => $selected_tipo,
            'operator' => 'IN',
        );
    }
}

if (! empty($selected_manga) && taxonomy_exists('pa_manga')) {
    $tax_query[] = array(
        'taxonomy' => 'pa_manga',
        'field' => 'slug',
        'terms' => $selected_manga,
        'operator' => 'IN',
    );
}

if (! empty($selected_color) && taxonomy_exists('pa_color')) {
    $tax_query[] = array(
        'taxonomy' => 'pa_color',
        'field' => 'slug',
        'terms' => $selected_color,
        'operator' => 'IN',
    );
}

if (! empty($selected_talle) && taxonomy_exists('pa_talle')) {
    $tax_query[] = array(
        'taxonomy' => 'pa_talle',
        'field' => 'slug',
        'terms' => $selected_talle,
        'operator' => 'IN',
    );
}

$query_args = array(
    'post_type'      => 'product',
    'post_status'    => 'publish',
    'posts_per_page' => 12,
    'paged'          => $paged,
    'tax_query'      => $tax_query,
);

switch ($selected_orderby) {
    case 'price_asc':
        $query_args['meta_key'] = '_price';
        $query_args['orderby'] = 'meta_value_num';
        $query_args['order'] = 'ASC';
        break;

    case 'price_desc':
        $query_args['meta_key'] = '_price';
        $query_args['orderby'] = 'meta_value_num';
        $query_args['order'] = 'DESC';
        break;

    case 'recent':
        $query_args['orderby'] = 'date';
        $query_args['order'] = 'DESC';
        break;

    case 'popular':
        $query_args['meta_key'] = 'total_sales';
        $query_args['orderby'] = 'meta_value_num';
        $query_args['order'] = 'DESC';
        break;

    default:
        $query_args['orderby'] = 'menu_order title';
        $query_args['order'] = 'ASC';
        break;
}

$products_query = new WP_Query($query_args);
$base_url = get_term_link($term);

if (is_wp_error($base_url)) {
    $base_url = home_url('/catalogo/');
}
?>

<main class="uniforma-category-page">

    <section
        class="uniforma-category-hero"
        style="background-image: url('<?php echo esc_url($hero_image); ?>'); --uniforma-hero-image: url('<?php echo esc_url($hero_image); ?>');"
    >
        <div class="uniforma-category-hero__inner">
            <nav class="uniforma-category-breadcrumb" aria-label="Breadcrumb">
                <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
                <span>›</span>
                <a href="<?php echo esc_url(home_url('/catalogo/')); ?>">Categorías</a>
                <span>›</span>
                <span><?php echo esc_html($category_name); ?></span>
            </nav>

            <h1><?php echo esc_html($category_name); ?></h1>
            <span class="uniforma-category-hero__line"></span>
            <p><?php echo esc_html($category_description); ?></p>
        </div>
    </section>

    <section class="uniforma-category-content">
        <div class="uniforma-category-content__inner">

            <aside class="uniforma-category-sidebar" data-uniforma-category-filters>
                <button
                    type="button"
                    class="uniforma-category-filters-toggle"
                    aria-expanded="false"
                    aria-controls="uniforma-category-filters-panel"
                >
                    <span class="uniforma-category-filters-toggle__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M4 6h16M7 12h10M10 18h4"></path>
                        </svg>
                    </span>
                    <span class="uniforma-category-filters-toggle__copy">
                        <strong>Filtros</strong>
                        <small>Color, talle, rubro y más</small>
                    </span>
                    <?php if ($active_filter_count > 0) : ?>
                        <span
                            class="uniforma-category-filters-toggle__count"
                            aria-label="<?php echo esc_attr($active_filter_count . ' filtro' . ($active_filter_count === 1 ? '' : 's') . ' activo' . ($active_filter_count === 1 ? '' : 's')); ?>"
                        >
                            <?php echo esc_html($active_filter_count); ?>
                        </span>
                    <?php endif; ?>
                    <span class="uniforma-category-filters-toggle__chevron" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="m7 9 5 5 5-5"></path>
                        </svg>
                    </span>
                </button>

                <div id="uniforma-category-filters-panel" class="uniforma-category-filters-panel">
                    <form method="get" action="<?php echo esc_url($base_url); ?>" class="uniforma-category-filters">

                    <div class="uniforma-category-filters__head">
                        <h2>Filtrar por</h2>
                        <a href="<?php echo esc_url($base_url); ?>" class="uniforma-category-clear-all">
                            Limpiar todos
                        </a>
                    </div>

                    <?php if ($active_filter_count > 0) : ?>
                        <span class="uniforma-category-filters__count">
                            <?php echo esc_html($active_filter_count); ?> filtro<?php echo $active_filter_count === 1 ? '' : 's'; ?> activo<?php echo $active_filter_count === 1 ? '' : 's'; ?>
                        </span>
                    <?php endif; ?>

                    <?php if ($selected_orderby) : ?>
                        <input type="hidden" name="orden" value="<?php echo esc_attr($selected_orderby); ?>">
                    <?php endif; ?>

                    <?php if (! empty($filter_rubro_options) && ! $current_rubro_key) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Rubro</h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>
                            <p class="uniforma-category-filter-group__hint">Podés elegir más de uno.</p>

                            <div class="uniforma-category-check-list uniforma-category-check-list--rubros">
                                <?php foreach ($filter_rubro_options as $rubro_option) : ?>
                                    <?php $is_checked = in_array($rubro_option['key'], $selected_rubro, true); ?>
                                    <label class="uniforma-category-check-option <?php echo $is_checked ? 'is-selected' : ''; ?>">
                                        <input
                                            type="checkbox"
                                            name="rubro[]"
                                            value="<?php echo esc_attr($rubro_option['key']); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span><?php echo esc_html($rubro_option['label']); ?> <span class="uniforma-category-filter-count">(<?php echo esc_html($rubro_option['count']); ?>)</span></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php endif; ?>

                    <?php if ($current_rubro_key && ! empty($rubro_filters)) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Filtros de <?php echo esc_html($category_name); ?></h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>

                            <div class="uniforma-category-check-list">
                                <label class="uniforma-category-check-option <?php echo empty($selected_tipo) ? 'is-selected' : ''; ?>">
                                    <input type="checkbox" disabled <?php checked(empty($selected_tipo), true); ?>>
                                    <a href="<?php echo esc_url($base_url); ?>">Todos</a>
                                </label>
                                <?php foreach ($rubro_filters as $rubro_filter) : ?>
                                    <?php $is_checked = in_array($rubro_filter['key'], $selected_tipo, true); ?>
                                    <label class="uniforma-category-check-option <?php echo $is_checked ? 'is-selected' : ''; ?>">
                                        <input
                                            type="checkbox"
                                            name="tipo[]"
                                            value="<?php echo esc_attr($rubro_filter['key']); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span><?php echo esc_html($rubro_filter['label']); ?> <span class="uniforma-category-filter-count">(<?php echo esc_html($rubro_filter['count']); ?>)</span></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php elseif (! empty($tipo_terms)) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Tipo de <?php echo esc_html(strtolower($category_name)); ?></h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>

                            <div class="uniforma-category-check-list">
                                <?php foreach ($tipo_terms as $term_item) : ?>
                                    <?php $is_checked = in_array($term_item->slug, $selected_tipo, true); ?>
                                    <label class="uniforma-category-check-option <?php echo $is_checked ? 'is-selected' : ''; ?>">
                                        <input
                                            type="checkbox"
                                            name="tipo[]"
                                            value="<?php echo esc_attr($term_item->slug); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span><?php echo esc_html($term_item->name); ?> <span class="uniforma-category-filter-count">(<?php echo esc_html($term_item->uniforma_count); ?>)</span></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php endif; ?>

                    <?php if (! empty($manga_terms)) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Manga</h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>

                            <div class="uniforma-category-check-list">
                                <?php foreach ($manga_terms as $term_item) : ?>
                                    <?php $is_checked = in_array($term_item->slug, $selected_manga, true); ?>
                                    <label class="uniforma-category-check-option <?php echo $is_checked ? 'is-selected' : ''; ?>">
                                        <input
                                            type="checkbox"
                                            name="manga[]"
                                            value="<?php echo esc_attr($term_item->slug); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span><?php echo esc_html($term_item->name); ?> <span class="uniforma-category-filter-count">(<?php echo esc_html($term_item->uniforma_count); ?>)</span></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php endif; ?>

                    <?php if (! empty($color_terms)) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Colores</h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>
                            <p class="uniforma-category-filter-group__hint">Seleccioná todos los que quieras.</p>

                            <div class="uniforma-category-color-filter">
                                <?php foreach ($color_terms as $term_item) : ?>
                                    <?php
                                    $swatch = uniforma_category_color_swatch($term_item->name);
                                    $is_checked = in_array($term_item->slug, $selected_color, true);
                                    ?>
                                    <label
                                        class="uniforma-category-color-option <?php echo $is_checked ? 'is-selected' : ''; ?>"
                                        title="<?php echo esc_attr($term_item->name); ?>"
                                    >
                                        <input
                                            type="checkbox"
                                            name="color[]"
                                            value="<?php echo esc_attr($term_item->slug); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span class="uniforma-category-color-option__surface">
                                            <span
                                                class="uniforma-category-swatch <?php echo $swatch['light'] ? 'is-light' : ''; ?>"
                                                style="--uniforma-swatch-background: <?php echo esc_attr($swatch['background']); ?>;"
                                                aria-hidden="true"
                                            ></span>
                                            <span class="uniforma-category-color-option__name">
                                                <?php echo esc_html($term_item->name); ?>
                                                <span class="uniforma-category-filter-count">(<?php echo esc_html($term_item->uniforma_count); ?>)</span>
                                            </span>
                                        </span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php endif; ?>

                    <?php if (! empty($talle_terms)) : ?>
                        <details class="uniforma-category-filter-group" open>
                            <summary>
                                <h3>Talles</h3>
                                <span class="uniforma-category-filter-group__toggle" aria-hidden="true"></span>
                            </summary>

                            <div class="uniforma-category-size-filter">
                                <?php foreach ($talle_terms as $term_item) : ?>
                                    <?php $is_checked = in_array($term_item->slug, $selected_talle, true); ?>
                                    <label class="uniforma-category-size-option <?php echo $is_checked ? 'is-selected' : ''; ?>">
                                        <input
                                            type="checkbox"
                                            name="talle[]"
                                            value="<?php echo esc_attr($term_item->slug); ?>"
                                            <?php checked($is_checked, true); ?>
                                        >
                                        <span><?php echo esc_html($term_item->name); ?> <small>(<?php echo esc_html($term_item->uniforma_count); ?>)</small></span>
                                    </label>
                                <?php endforeach; ?>
                            </div>
                        </details>
                    <?php endif; ?>

                    <button type="submit" class="uniforma-category-apply">
                        Aplicar filtros
                    </button>

                    </form>
                </div>
            </aside>

            <div class="uniforma-category-main">

                <div class="uniforma-category-toolbar">
                    <p>
                        Mostrando <?php echo esc_html($products_query->post_count); ?>
                        de <?php echo esc_html($products_query->found_posts); ?>
                        resultados
                    </p>

                    <form method="get" action="<?php echo esc_url($base_url); ?>" class="uniforma-category-order-form">
                        <?php foreach ($selected_tipo as $value) : ?>
                            <input type="hidden" name="tipo[]" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>
                        <?php foreach ($selected_manga as $value) : ?>
                            <input type="hidden" name="manga[]" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>
                        <?php foreach ($selected_rubro as $value) : ?>
                            <input type="hidden" name="rubro[]" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>
                        <?php foreach ($selected_color as $value) : ?>
                            <input type="hidden" name="color[]" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>
                        <?php foreach ($selected_talle as $value) : ?>
                            <input type="hidden" name="talle[]" value="<?php echo esc_attr($value); ?>">
                        <?php endforeach; ?>

                        <select name="orden" onchange="this.form.submit()" aria-label="Ordenar productos">
                            <option value="" <?php selected($selected_orderby, ''); ?>>Ordenar por: Predeterminado</option>
                            <option value="popular" <?php selected($selected_orderby, 'popular'); ?>>Ordenar por: Más vendidos</option>
                            <option value="price_asc" <?php selected($selected_orderby, 'price_asc'); ?>>Ordenar por: Menor precio</option>
                            <option value="price_desc" <?php selected($selected_orderby, 'price_desc'); ?>>Ordenar por: Mayor precio</option>
                            <option value="recent" <?php selected($selected_orderby, 'recent'); ?>>Ordenar por: Más recientes</option>
                        </select>
                    </form>
                </div>

                <?php if ($products_query->have_posts()) : ?>
                    <div class="uniforma-category-grid">
                        <?php while ($products_query->have_posts()) : ?>
                            <?php
                            $products_query->the_post();

                            $product = wc_get_product(get_the_ID());

                            if (! $product) {
                                continue;
                            }

                            $product_id = $product->get_id();
                            $product_url = get_permalink($product_id);
                            $image_id = $product->get_image_id();
                            $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'large') : wc_placeholder_img_src();
                            $price_html = $product->get_price_html();

                            $personalize_url = function_exists('uniforma_product_personalize_url')
                                ? uniforma_product_personalize_url($product_id)
                                : add_query_arg(array('producto' => get_the_title($product_id)), home_url('/simula-tu-prenda/'));

                            $product_colors = uniforma_category_get_product_attribute_terms($product, 'pa_color');
                            $visible_product_colors = array_slice($product_colors, 0, 8);
                            $remaining_product_colors = max(0, count($product_colors) - count($visible_product_colors));
                            ?>

                            <article class="uniforma-category-card">
                                <a href="<?php echo esc_url($product_url); ?>" class="uniforma-category-card__image">
                                    <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr(get_the_title()); ?>">
                                </a>

                                <div class="uniforma-category-card__colors" aria-label="Colores disponibles">
                                    <?php if (! empty($visible_product_colors)) : ?>
                                        <?php foreach ($visible_product_colors as $color_term) : ?>
                                            <?php
                                            $card_swatch = uniforma_category_color_swatch($color_term->name);
                                            $color_product_url = add_query_arg('attribute_pa_color', $color_term->slug, $product_url);
                                            ?>
                                            <a
                                                href="<?php echo esc_url($color_product_url); ?>"
                                                class="uniforma-category-card__color <?php echo $card_swatch['light'] ? 'is-light' : ''; ?>"
                                                style="--uniforma-swatch-background: <?php echo esc_attr($card_swatch['background']); ?>;"
                                                title="<?php echo esc_attr($color_term->name); ?>"
                                                aria-label="<?php echo esc_attr(sprintf('Ver %s en color %s', get_the_title(), $color_term->name)); ?>"
                                            ></a>
                                        <?php endforeach; ?>

                                        <?php if ($remaining_product_colors > 0) : ?>
                                            <span
                                                class="uniforma-category-card__colors-more"
                                                title="<?php echo esc_attr(sprintf('%d colores adicionales', $remaining_product_colors)); ?>"
                                            >
                                                +<?php echo esc_html($remaining_product_colors); ?>
                                            </span>
                                        <?php endif; ?>
                                    <?php else : ?>
                                        <span class="uniforma-category-card__colors-empty">Color a definir</span>
                                    <?php endif; ?>
                                </div>

                                <div class="uniforma-category-card__content">
                                    <h2>
                                        <a href="<?php echo esc_url($product_url); ?>" title="<?php echo esc_attr(get_the_title()); ?>">
                                            <?php the_title(); ?>
                                        </a>
                                    </h2>

                                    <div class="uniforma-category-card__price">
                                        <?php echo $price_html ? wp_kses_post($price_html) : 'Consultar precio'; ?>
                                    </div>

                                    <div class="uniforma-category-card__actions">
                                        <a href="<?php echo esc_url($product_url); ?>">Ver producto</a>
                                        <a href="<?php echo esc_url($personalize_url); ?>">Personalizar</a>
                                    </div>
                                </div>
                            </article>

                        <?php endwhile; ?>
                    </div>

                    <div class="uniforma-category-pagination">
                        <?php
                        echo paginate_links(array(
                            'total'     => $products_query->max_num_pages,
                            'current'   => $paged,
                            'prev_text' => '←',
                            'next_text' => '→',
                            'add_args' => array_filter(array(
                                'tipo' => $selected_tipo,
                                'manga' => $selected_manga,
                                'rubro' => $selected_rubro,
                                'color' => $selected_color,
                                'talle' => $selected_talle,
                                'orden' => $selected_orderby,
                            )),
                        ));
                        ?>
                    </div>

                    <?php wp_reset_postdata(); ?>

                <?php else : ?>
                    <div class="uniforma-category-no-products">
                        <h2>No encontramos productos</h2>
                        <p>Probá limpiar los filtros o elegir otra combinación.</p>
                        <a href="<?php echo esc_url($base_url); ?>">Limpiar filtros</a>
                    </div>
                <?php endif; ?>

            </div>

        </div>
    </section>

    <section class="uniforma-category-benefits">
        <div class="uniforma-category-benefits__inner">

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('thread'); ?>
                <div>
                    <h3>Bordado</h3>
                    <p>Acabado profesional y máxima durabilidad.</p>
                </div>
            </div>

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('printer'); ?>
                <div>
                    <h3>Estampado DTF</h3>
                    <p>Colores vibrantes, detalle y resistencia al lavado.</p>
                </div>
            </div>

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('tag'); ?>
                <div>
                    <h3>Pedí tu presupuesto</h3>
                    <p>Rápido, simple y sin compromiso.</p>
                </div>
            </div>

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('truck'); ?>
                <div>
                    <h3>Envíos a todo el país</h3>
                    <p>Llegamos a donde nos necesites.</p>
                </div>
            </div>

        </div>
    </section>

</main>

<?php
get_footer();