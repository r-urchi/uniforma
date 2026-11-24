<?php
/**
 * UNIFORMA — Home shortcode
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_home_shortcode()
{
    ob_start();

    $simulator_image_url = 'https://uniforma.com.ar/wp-content/uploads/2026/06/REMERA-scaled.webp';

    $asset_url = trailingslashit(get_template_directory_uri()) . 'assets/images/';

    $home_settings = function_exists('uniforma_get_home_settings')
        ? uniforma_get_home_settings()
        : array('featured_products' => array(), 'faqs' => array());

    $slides = array(
        array(
            'label'  => 'Identidad',
            'image'  => $asset_url . 'home/uniforma-banner-identidad.webp',
            'title'  => 'DISEÑAMOS PERTENENCIA. CREAMOS IDENTIDAD.',
            'text'   => 'Personalizamos indumentaria para representar la identidad de tu empresa y de quienes la hacen posible.',
            'button' => 'Conocé UNIFORMA',
            'url'    => home_url('/nosotros/'),
        ),
        array(
            'label'  => 'Equipos',
            'image'  => $asset_url . 'home/uniforma-banner-rubros.webp',
            'title'  => 'TU EMPRESA. TU EQUIPO. TU ESENCIA.',
            'text'   => 'Creamos prendas que identifican, unen y representan a todo tu equipo.',
            'button' => 'Solicitar presupuesto',
            'url'    => home_url('/contacto/'),
        ),
        array(
            'label'  => 'Rubros',
            'image'  => $asset_url . 'home/uniforma-banner-empresa.webp',
            'title'  => 'CADA TRABAJO TIENE SU PROPIA IDENTIDAD.',
            'text'   => 'Indumentaria pensada para cada rubro, profesión y equipo.',
            'button' => 'Explorar el catálogo',
            'url'    => home_url('/tienda/'),
        ),
        array(
            'label'  => 'Personalización',
            'image'  => $asset_url . 'home/uniforma-banner-personalizacion.webp',
            'title'  => 'PERSONALIZAMOS LO QUE TE IDENTIFICA.',
            'text'   => 'Bordado, impresión premium y diseño a medida para representar a tu empresa.',
            'button' => 'Simulá tu prenda',
            'url'    => home_url('/simula-tu-prenda/'),
        ),
    );

    $rubros = array(
        array('name' => 'Gastronomía y hotelería', 'slug' => 'gastronomia',            'image' => 'uniforma-hero-gastronomia.webp'),
        array('name' => 'Industria y construcción', 'slug' => 'industria-construccion', 'image' => 'uniforma-hero-industria-construccion.webp'),
        array('name' => 'Comercio y atención',     'slug' => 'comercio-atencion',      'image' => 'uniforma-hero-comercio-atencion.webp'),
        array('name' => 'Salud y estética',        'slug' => 'salud-estetica',         'image' => 'uniforma-hero-salud-estetica.webp'),
        array('name' => 'Empresas y oficinas',     'slug' => 'empresas-oficinas',      'image' => 'uniforma-hero-empresas-oficinas.webp'),
        array('name' => 'Campo y tradición',       'slug' => 'campo-tradicion',        'image' => 'uniforma-hero-campo-tradicion.webp'),
    );

    $categories = array(
        array('name' => 'Remeras',             'slug' => 'remeras'),
        array('name' => 'Chombas',             'slug' => 'chombas'),
        array('name' => 'Buzos y camperas',    'slug' => 'buzos-y-camperas'),
        array('name' => 'Camisas y chaquetas', 'slug' => 'camisas-y-chaquetas'),
        array('name' => 'Pantalones',          'slug' => 'pantalones'),
        array('name' => 'Ambos',               'slug' => 'ambos-y-guardapolvos'),
        array('name' => 'Delantales',          'slug' => 'delantales'),
        array('name' => 'Gorras y accesorios', 'slug' => 'accesorios'),
        array('name' => 'Calzado',             'slug' => 'zapatillas'),
    );

    // Sin las categorías que todavía no tienen productos
    $categories = array_values(array_filter($categories, function ($category) {
        return uniforma_category_has_products($category['slug']);
    }));

    $total_slides = count($slides);
    ?>

    <main class="uniforma-home">

        <!-- 1. Portada -->
        <section class="uniforma-hero-slider" id="uniformaHeroSlider" aria-label="Destacados de Uniforma" aria-roledescription="carrusel">
            <div class="uniforma-hero-slider__viewport">
                <div class="uniforma-hero-slider__track" id="uniformaHeroTrack">
                    <?php foreach ($slides as $index => $slide) : ?>
                        <?php $heading_tag = 0 === $index ? 'h1' : 'h2'; ?>
                        <article class="uniforma-hero <?php echo 0 === $index ? 'is-active' : ''; ?>" aria-hidden="<?php echo 0 === $index ? 'false' : 'true'; ?>">
                            <img
                                class="uniforma-hero__image"
                                src="<?php echo esc_url($slide['image']); ?>"
                                alt=""
                                <?php echo 0 === $index ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'; ?>
                                decoding="async"
                            >
                            <div class="uniforma-hero__content">
                                <<?php echo $heading_tag; ?> class="uniforma-hero__title"><?php echo esc_html($slide['title']); ?></<?php echo $heading_tag; ?>>
                                <p class="uniforma-hero__text"><?php echo esc_html($slide['text']); ?></p>
                                <a href="<?php echo esc_url($slide['url']); ?>" class="uniforma-btn"><?php echo esc_html($slide['button']); ?> <span aria-hidden="true">→</span></a>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="uniforma-hero-slider__bar">
                <p class="uniforma-hero-slider__count" aria-live="off">
                    <span class="uniforma-hero-slider__current">01</span> / <?php echo esc_html(str_pad((string) $total_slides, 2, '0', STR_PAD_LEFT)); ?>
                </p>

                <div class="uniforma-hero-slider__dots" role="tablist" aria-label="Elegir banner">
                    <?php foreach ($slides as $index => $slide) : ?>
                        <button type="button" role="tab" aria-label="Ver banner <?php echo esc_attr($index + 1); ?>: <?php echo esc_attr($slide['label']); ?>" aria-selected="<?php echo 0 === $index ? 'true' : 'false'; ?>" class="<?php echo 0 === $index ? 'is-active' : ''; ?>" data-slide="<?php echo esc_attr($index); ?>">
                            <span><?php echo esc_html(str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT)); ?></span>
                            <?php echo esc_html($slide['label']); ?>
                        </button>
                    <?php endforeach; ?>
                </div>

                <div class="uniforma-hero-slider__arrows">
                    <button class="uniforma-hero-slider__arrow uniforma-hero-slider__arrow--prev" type="button" aria-label="Banner anterior">←</button>
                    <button class="uniforma-hero-slider__arrow uniforma-hero-slider__arrow--next" type="button" aria-label="Banner siguiente">→</button>
                </div>
            </div>
        </section>

        <!-- 2. Forma de trabajar -->
        <section class="uniforma-working-band" aria-labelledby="uniforma-working-band-title">
            <div class="uniforma-working-band__inner">
                <h2 id="uniforma-working-band-title" class="uniforma-label">Nuestra forma de trabajar</h2>
                <ol class="uniforma-working-band__list">
                    <li><span class="uniforma-label">01</span>Atención personalizada.</li>
                    <li><span class="uniforma-label">02</span>Resultados que se ven.</li>
                    <li><span class="uniforma-label">03</span>Relaciones que duran.</li>
                </ol>
            </div>
        </section>

        <!-- 3. Rubros -->
        <section class="uniforma-rubros" aria-labelledby="uniforma-rubros-title">
            <div class="uniforma-wrap">
                <div class="uniforma-section-head">
                    <h2 id="uniforma-rubros-title">Elegí tu rubro</h2>
                    <span class="uniforma-label"><?php echo esc_html(str_pad((string) count($rubros), 2, '0', STR_PAD_LEFT)); ?> rubros</span>
                </div>

                <div class="uniforma-rubros__grid">
                    <?php foreach ($rubros as $index => $rubro) : ?>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/' . $rubro['slug'] . '/')); ?>" class="uniforma-rubro">
                            <span class="uniforma-rubro__image">
                                <img src="<?php echo esc_url($asset_url . 'category-heroes/' . $rubro['image']); ?>" alt="" loading="lazy" decoding="async">
                            </span>
                            <span class="uniforma-rubro__caption">
                                <span class="uniforma-label"><?php echo esc_html(str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT)); ?></span>
                                <span class="uniforma-rubro__name"><?php echo esc_html($rubro['name']); ?></span>
                                <span class="uniforma-rubro__arrow" aria-hidden="true">→</span>
                            </span>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>

        <?php
        $best_sellers = array();
        if (function_exists('wc_get_product') && ! empty($home_settings['featured_products'])) {
            foreach ($home_settings['featured_products'] as $product_id) {
                $selected_product = wc_get_product($product_id);
                if ($selected_product && 'publish' === $selected_product->get_status()) {
                    $best_sellers[] = $selected_product;
                }
            }
        } elseif (function_exists('wc_get_products')) {
            $best_sellers = wc_get_products(array(
                'status' => 'publish', 'limit' => 10, 'orderby' => 'popularity', 'order' => 'DESC'
            ));
        }
        ?>

        <!-- 4. Más vendidos -->
        <?php if (! empty($best_sellers)) : ?>
            <section class="uniforma-best-sellers" aria-labelledby="uniforma-best-sellers-title">
                <div class="uniforma-wrap">
                    <div class="uniforma-section-head">
                        <h2 id="uniforma-best-sellers-title">Los más pedidos</h2>
                        <div class="uniforma-best-sellers__arrows">
                            <button type="button" id="uniformaBestPrev" aria-label="Productos anteriores">←</button>
                            <button type="button" id="uniformaBestNext" aria-label="Productos siguientes">→</button>
                        </div>
                    </div>

                    <div class="uniforma-best-sellers__track" id="uniformaBestTrack">
                        <?php
                        foreach ($best_sellers as $best_product) {
                            uniforma_render_product_card($best_product, array('colors' => false, 'actions' => false, 'size' => 'woocommerce_single'));
                        }
                        ?>
                    </div>

                    <p class="uniforma-best-sellers__more">
                        <a href="<?php echo esc_url(home_url('/tienda/')); ?>" class="uniforma-link">Ver todo el catálogo</a>
                    </p>
                </div>
            </section>
        <?php endif; ?>

        <!-- 5. Prendas -->
        <section class="uniforma-prendas" aria-labelledby="uniforma-prendas-title">
            <div class="uniforma-wrap">
                <div class="uniforma-section-head">
                    <h2 id="uniforma-prendas-title">Por tipo de prenda</h2>
                    <span class="uniforma-label"><?php echo esc_html(str_pad((string) count($categories), 2, '0', STR_PAD_LEFT)); ?> categorías</span>
                </div>

                <ul class="uniforma-prendas__list">
                    <?php foreach ($categories as $index => $category) : ?>
                        <?php
                        $term  = taxonomy_exists('product_cat') ? get_term_by('slug', $category['slug'], 'product_cat') : false;
                        $count = ($term && ! is_wp_error($term) && (int) $term->count > 0) ? (int) $term->count : 0;
                        ?>
                        <li>
                            <a href="<?php echo esc_url(home_url('/categoria-producto/' . $category['slug'] . '/')); ?>">
                                <span class="uniforma-label"><?php echo esc_html(str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT)); ?></span>
                                <span class="uniforma-prendas__name"><?php echo esc_html($category['name']); ?></span>
                                <?php if ($count) : ?>
                                    <span class="uniforma-label"><?php echo esc_html($count); ?></span>
                                <?php endif; ?>
                                <span class="uniforma-prendas__arrow" aria-hidden="true">→</span>
                            </a>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </section>

        <!-- 6. Simulador -->
        <section class="uniforma-simulator-preview" aria-labelledby="uniforma-simulator-title">
            <div class="uniforma-wrap uniforma-simulator-preview__inner">

                <div class="uniforma-simulator-preview__copy">
                    <p class="uniforma-label">Simulador</p>
                    <h2 id="uniforma-simulator-title">Simulá tu prenda antes de pedirla</h2>

                    <ol class="uniforma-simulator-preview__steps">
                        <li>
                            <span class="uniforma-label">01</span>
                            <div>
                                <h3>Elegí tu prenda</h3>
                                <p>Seleccioná el tipo de prenda que quieras personalizar.</p>
                            </div>
                        </li>
                        <li>
                            <span class="uniforma-label">02</span>
                            <div>
                                <h3>Configurá tu diseño</h3>
                                <p>Elegí el color y cargá el logo o imagen que quieras aplicar.</p>
                            </div>
                        </li>
                        <li>
                            <span class="uniforma-label">03</span>
                            <div>
                                <h3>Previsualizá y solicitá</h3>
                                <p>Mirá cómo queda tu diseño y pedí tu presupuesto.</p>
                            </div>
                        </li>
                    </ol>

                    <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>" class="uniforma-btn">Ir al simulador <span aria-hidden="true">→</span></a>
                </div>

                <div class="uniforma-simulator-preview__product">
                    <img src="<?php echo esc_url($simulator_image_url); ?>" alt="Remera con logo bordado en el pecho" loading="lazy" decoding="async">
                    <p class="uniforma-label">Bordado o DTF · frente y espalda</p>
                </div>

            </div>
        </section>

        <!-- 7. Preguntas frecuentes -->
        <?php $home_faqs = function_exists('uniforma_get_home_faqs') ? uniforma_get_home_faqs(4) : array(); ?>
        <?php if (! empty($home_faqs)) : ?>
        <section class="uniforma-home-faq" aria-labelledby="uniforma-home-faq-title">
            <div class="uniforma-wrap uniforma-home-faq__inner">
                <div class="uniforma-home-faq__intro">
                    <h2 id="uniforma-home-faq-title">Preguntas frecuentes</h2>
                    <a href="<?php echo esc_url(home_url('/preguntas-frecuentes/')); ?>" class="uniforma-link">Ver todas</a>
                </div>

                <div class="uniforma-home-faq__list">
                    <?php foreach ($home_faqs as $faq) : ?>
                        <details class="uniforma-home-faq__item">
                            <summary>
                                <span><?php echo esc_html($faq['question']); ?></span>
                                <span class="uniforma-home-faq__icon" aria-hidden="true"></span>
                            </summary>
                            <div class="uniforma-home-faq__answer">
                                <p><?php echo nl2br(esc_html($faq['answer'])); ?></p>
                            </div>
                        </details>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
        <?php endif; ?>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_home', 'uniforma_home_shortcode');
