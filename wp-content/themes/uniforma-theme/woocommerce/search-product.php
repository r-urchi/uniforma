<?php
/**
 * UNIFORMA product search results.
 *
 * This partial is loaded from archive-product.php after get_header().
 */

defined('ABSPATH') || exit;

$search_query = sanitize_text_field(get_search_query(false));
$search_data = uniforma_product_search_find($search_query);
$matched_product_ids = isset($search_data['ids']) ? array_map('intval', $search_data['ids']) : array();
$used_fallback = ! empty($search_data['fallback']);
$selected_orderby = isset($_GET['orden']) && is_scalar($_GET['orden'])
    ? sanitize_key(wp_unslash($_GET['orden']))
    : '';

$paged = max(
    1,
    get_query_var('paged') ? (int) get_query_var('paged') : 1,
    get_query_var('page') ? (int) get_query_var('page') : 1
);

$query_args = array(
    'post_type' => 'product',
    'post_status' => 'publish',
    'posts_per_page' => 12,
    'paged' => $paged,
    'post__in' => ! empty($matched_product_ids) ? $matched_product_ids : array(0),
    'ignore_sticky_posts' => true,
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

    case 'title':
        $query_args['orderby'] = 'title';
        $query_args['order'] = 'ASC';
        break;

    default:
        $query_args['orderby'] = 'post__in';
        break;
}

$products_query = new WP_Query($query_args);
$search_action = home_url('/');
$catalog_url = home_url('/catalogo/');
$result_count = (int) $products_query->found_posts;
?>

<main class="uniforma-category-page uniforma-search-page">

    <section class="uniforma-search-hero">
        <div class="uniforma-search-hero__inner">
            <nav class="uniforma-category-breadcrumb" aria-label="Breadcrumb">
                <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
                <span>&rsaquo;</span>
                <span>B&uacute;squeda</span>
            </nav>

            <span class="uniforma-search-hero__eyebrow">Cat&aacute;logo UNIFORMA</span>
            <h1>Resultados de b&uacute;squeda</h1>

            <?php if ($search_query !== '') : ?>
                <p>
                    Productos relacionados con
                    <strong>&ldquo;<?php echo esc_html($search_query); ?>&rdquo;</strong>.
                </p>
            <?php else : ?>
                <p>Escrib&iacute; el nombre, color, talle, rubro o c&oacute;digo del producto que busc&aacute;s.</p>
            <?php endif; ?>

            <form class="uniforma-search-form" role="search" method="get" action="<?php echo esc_url($search_action); ?>">
                <label class="screen-reader-text" for="uniformaSearchPageInput">Buscar productos</label>
                <input
                    id="uniformaSearchPageInput"
                    type="search"
                    name="s"
                    value="<?php echo esc_attr($search_query); ?>"
                    placeholder="Ej: remera, negro, gastronom&iacute;a, XL..."
                    autocomplete="off"
                    minlength="2"
                    required
                >
                <input type="hidden" name="post_type" value="product">
                <button type="submit">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-4-4"></path>
                    </svg>
                    <span>Buscar</span>
                </button>
            </form>

            <p class="uniforma-search-hero__scope">
                Buscamos en nombres, descripciones, categor&iacute;as, rubros, colores, talles y SKU.
            </p>
        </div>
    </section>

    <section class="uniforma-search-content">
        <div class="uniforma-search-content__inner">

            <?php if ($used_fallback && $result_count > 0) : ?>
                <div class="uniforma-search-related-notice" role="status">
                    <span aria-hidden="true">i</span>
                    <p>No encontramos una coincidencia completa. Te mostramos los productos m&aacute;s relacionados.</p>
                </div>
            <?php endif; ?>

            <?php if ($products_query->have_posts()) : ?>
                <div class="uniforma-search-toolbar">
                    <div class="uniforma-search-toolbar__summary">
                        <strong>
                            <?php echo esc_html($result_count); ?>
                            producto<?php echo $result_count === 1 ? '' : 's'; ?>
                        </strong>
                        <span>encontrado<?php echo $result_count === 1 ? '' : 's'; ?></span>
                    </div>

                    <form method="get" action="<?php echo esc_url($search_action); ?>" class="uniforma-category-order-form">
                        <input type="hidden" name="s" value="<?php echo esc_attr($search_query); ?>">
                        <input type="hidden" name="post_type" value="product">

                        <label class="screen-reader-text" for="uniformaSearchOrder">Ordenar productos</label>
                        <select id="uniformaSearchOrder" name="orden" onchange="this.form.submit()">
                            <option value="" <?php selected($selected_orderby, ''); ?>>Ordenar por: Relevancia</option>
                            <option value="popular" <?php selected($selected_orderby, 'popular'); ?>>Ordenar por: M&aacute;s vendidos</option>
                            <option value="price_asc" <?php selected($selected_orderby, 'price_asc'); ?>>Ordenar por: Menor precio</option>
                            <option value="price_desc" <?php selected($selected_orderby, 'price_desc'); ?>>Ordenar por: Mayor precio</option>
                            <option value="recent" <?php selected($selected_orderby, 'recent'); ?>>Ordenar por: M&aacute;s recientes</option>
                            <option value="title" <?php selected($selected_orderby, 'title'); ?>>Ordenar por: A-Z</option>
                        </select>
                    </form>
                </div>

                <div class="uniforma-category-grid uniforma-search-grid">
                    <?php $card_index = 0; ?>
                    <?php while ($products_query->have_posts()) : ?>
                        <?php
                        $products_query->the_post();
                        $product = wc_get_product(get_the_ID());

                        if (! $product || ! $product->is_visible()) {
                            continue;
                        }

                        $product_id = $product->get_id();
                        $product_url = get_permalink($product_id);
                        $image_id = $product->get_image_id();
                        $image_url = $image_id
                            ? wp_get_attachment_image_url($image_id, 'large')
                            : wc_placeholder_img_src();
                        $price_html = $product->get_price_html();
                        $personalize_url = function_exists('uniforma_product_personalize_url')
                            ? uniforma_product_personalize_url($product_id)
                            : add_query_arg(array('producto' => get_the_title($product_id)), home_url('/simula-tu-prenda/'));
                        $product_colors = uniforma_category_get_product_attribute_terms($product, 'pa_color');
                        $visible_product_colors = array_slice($product_colors, 0, 8);
                        $remaining_product_colors = max(0, count($product_colors) - count($visible_product_colors));
                        $loading = $card_index < 4 ? 'eager' : 'lazy';
                        $card_index++;
                        ?>

                        <article class="uniforma-category-card">
                            <a href="<?php echo esc_url($product_url); ?>" class="uniforma-category-card__image">
                                <img
                                    src="<?php echo esc_url($image_url); ?>"
                                    alt="<?php echo esc_attr(get_the_title()); ?>"
                                    loading="<?php echo esc_attr($loading); ?>"
                                    decoding="async"
                                >
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
                                    <a href="<?php echo esc_url($product_url); ?>">
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

                <?php if ($products_query->max_num_pages > 1) : ?>
                    <nav class="uniforma-category-pagination uniforma-search-pagination" aria-label="Paginaci&oacute;n de resultados">
                        <?php
                        $big = 999999999;
                        echo paginate_links(array(
                            'base' => str_replace($big, '%#%', esc_url(get_pagenum_link($big))),
                            'format' => '?paged=%#%',
                            'total' => $products_query->max_num_pages,
                            'current' => $paged,
                            'prev_text' => '&larr;',
                            'next_text' => '&rarr;',
                            'add_args' => array_filter(array(
                                's' => $search_query,
                                'post_type' => 'product',
                                'orden' => $selected_orderby,
                            )),
                        ));
                        ?>
                    </nav>
                <?php endif; ?>

                <?php wp_reset_postdata(); ?>

            <?php else : ?>
                <div class="uniforma-search-empty">
                    <span class="uniforma-search-empty__icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                            <circle cx="10.5" cy="10.5" r="6.5"></circle>
                            <path d="m20 20-4.2-4.2"></path>
                            <path d="M8 10h5"></path>
                        </svg>
                    </span>

                    <?php if (strlen(uniforma_product_search_normalize($search_query)) < 2) : ?>
                        <h2>Escrib&iacute; al menos dos caracteres</h2>
                        <p>Pod&eacute;s buscar por producto, color, talle, rubro o SKU.</p>
                    <?php else : ?>
                        <h2>No encontramos productos para &ldquo;<?php echo esc_html($search_query); ?>&rdquo;</h2>
                        <p>Prob&aacute; con una palabra m&aacute;s general o revis&aacute; c&oacute;mo est&aacute; escrita.</p>
                    <?php endif; ?>

                    <div class="uniforma-search-empty__suggestions" aria-label="B&uacute;squedas sugeridas">
                        <a href="<?php echo esc_url(add_query_arg(array('s' => 'remera', 'post_type' => 'product'), $search_action)); ?>">Remeras</a>
                        <a href="<?php echo esc_url(add_query_arg(array('s' => 'chomba', 'post_type' => 'product'), $search_action)); ?>">Chombas</a>
                        <a href="<?php echo esc_url(add_query_arg(array('s' => 'pantalon', 'post_type' => 'product'), $search_action)); ?>">Pantalones</a>
                        <a href="<?php echo esc_url(add_query_arg(array('s' => 'ambo', 'post_type' => 'product'), $search_action)); ?>">Ambos</a>
                    </div>

                    <a class="uniforma-search-empty__catalog" href="<?php echo esc_url($catalog_url); ?>">
                        Ver cat&aacute;logo completo
                    </a>
                </div>
            <?php endif; ?>

        </div>
    </section>

    <section class="uniforma-category-benefits">
        <div class="uniforma-category-benefits__inner">

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('thread'); ?>
                <div>
                    <h3>Bordado</h3>
                    <p>Acabado profesional y m&aacute;xima durabilidad.</p>
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
                    <h3>Ped&iacute; tu presupuesto</h3>
                    <p>R&aacute;pido, simple y sin compromiso.</p>
                </div>
            </div>

            <div class="uniforma-category-benefit">
                <?php echo uniforma_category_icon_svg('truck'); ?>
                <div>
                    <h3>Env&iacute;os a todo el pa&iacute;s</h3>
                    <p>Llegamos a donde nos necesites.</p>
                </div>
            </div>

        </div>
    </section>

</main>
