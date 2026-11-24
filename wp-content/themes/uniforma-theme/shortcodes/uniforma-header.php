<?php
/**
 * UNIFORMA — Header custom global
 * Tema propio UNIFORMA
 */

if (! defined('ABSPATH')) {
    exit;
}

/* =========================================
   HEADER HTML GLOBAL
========================================= */
function uniforma_render_global_header()
{
    if (is_admin()) {
        return;
    }

    $logo_url = trailingslashit(get_template_directory_uri()) . 'assets/images/logo/uniforma-logo-transparente.webp';

    ?>

    <div class="uniforma-bar">
        <p class="uniforma-bar__text">
            <span>Pedido mínimo: 5 unidades</span>
            <span aria-hidden="true">/</span>
            <span>Bordado y DTF</span>
            <span aria-hidden="true">/</span>
            <span>Envíos a todo el país</span>
        </p>
    </div>

    <header class="uniforma-header" id="uniformaHeader">
        <div class="uniforma-header__container">

            <a href="<?php echo esc_url(home_url('/')); ?>" class="uniforma-header__logo" aria-label="Ir al inicio">
                <img src="<?php echo esc_url($logo_url); ?>" alt="UNIFORMA">
            </a>

            <nav class="uniforma-header__nav" aria-label="Menú principal">
                <div class="uniforma-header__nav-item uniforma-header__has-dropdown">
                    <button class="uniforma-header__link uniforma-header__dropdown-toggle" type="button" aria-expanded="false">
                        Catálogo
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 9l6 6 6-6"></path>
                        </svg>
                    </button>

                    <div class="uniforma-header__dropdown">
                        <a href="<?php echo esc_url(home_url('/tienda/')); ?>" class="uniforma-header__dropdown-all">Todo el catálogo</a>
                        <?php foreach (uniforma_catalog_categories() as $category_slug => $category_name) : ?>
                            <a href="<?php echo esc_url(home_url('/categoria-producto/' . $category_slug . '/')); ?>"><?php echo esc_html($category_name); ?></a>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="uniforma-header__nav-item uniforma-header__has-dropdown">
                    <button class="uniforma-header__link uniforma-header__dropdown-toggle" type="button" aria-expanded="false">
                        Rubros
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M6 9l6 6 6-6"></path>
                        </svg>
                    </button>

                    <div class="uniforma-header__dropdown uniforma-header__dropdown--rubros">
                        <a href="<?php echo esc_url(home_url('/categoria-producto/gastronomia/')); ?>">Gastronomía y hotelería</a>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/industria-construccion/')); ?>">Industria y construcción</a>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/comercio-atencion/')); ?>">Comercio y atención</a>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/salud-estetica/')); ?>">Salud y estética</a>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/empresas-oficinas/')); ?>">Empresas y oficinas</a>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/campo-tradicion/')); ?>">Campo y tradición</a>
                    </div>
                </div>

                <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>" class="uniforma-header__link">Simulá tu prenda</a>
                <a href="<?php echo esc_url(home_url('/nosotros/')); ?>" class="uniforma-header__link">Nosotros</a>
                <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-header__link">Contacto</a>
            </nav>

            <form
                class="uniforma-header__search"
                role="search"
                method="get"
                action="<?php echo esc_url(home_url('/')); ?>"
                data-ajax-url="<?php echo esc_url(admin_url('admin-ajax.php')); ?>"
                data-search-nonce="<?php echo esc_attr(wp_create_nonce('uniforma_product_search')); ?>"
            >
                <label class="screen-reader-text" for="uniformaProductSearch">Buscar productos</label>
                <input id="uniformaProductSearch" type="search" name="s" value="<?php echo esc_attr(get_search_query()); ?>" placeholder="Buscar productos…" autocomplete="off" aria-autocomplete="list" aria-controls="uniformaSearchResults" aria-expanded="false">
                <input type="hidden" name="post_type" value="product">
                <button type="submit" aria-label="Buscar productos">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="m20 20-4-4"></path>
                    </svg>
                </button>
                <div class="uniforma-header__search-results" id="uniformaSearchResults" role="listbox" aria-label="Resultados de productos" hidden></div>
            </form>

            <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-header__quote">Pedir presupuesto</a>

            <button
                class="uniforma-header__mobile-btn"
                id="uniformaMobileBtn"
                type="button"
                aria-label="Abrir menú"
                aria-controls="uniformaMobileNav"
                aria-expanded="false"
            >
                <span></span>
                <span></span>
                <span></span>
            </button>

        </div>

        <nav class="uniforma-header__mobile-nav" id="uniformaMobileNav" aria-label="Menú mobile">
            <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>

            <button class="uniforma-header__mobile-dropdown-toggle" type="button" aria-expanded="false">
                Catálogo
                <span>+</span>
            </button>

            <div class="uniforma-header__mobile-dropdown">
                <a href="<?php echo esc_url(home_url('/tienda/')); ?>">Todo el catálogo</a>
                <?php foreach (uniforma_catalog_categories() as $category_slug => $category_name) : ?>
                    <a href="<?php echo esc_url(home_url('/categoria-producto/' . $category_slug . '/')); ?>"><?php echo esc_html($category_name); ?></a>
                <?php endforeach; ?>
            </div>

            <button class="uniforma-header__mobile-dropdown-toggle" type="button" aria-expanded="false">
                Rubros
                <span>+</span>
            </button>

            <div class="uniforma-header__mobile-dropdown">
                <a href="<?php echo esc_url(home_url('/categoria-producto/gastronomia/')); ?>">Gastronomía y hotelería</a>
                <a href="<?php echo esc_url(home_url('/categoria-producto/industria-construccion/')); ?>">Industria y construcción</a>
                <a href="<?php echo esc_url(home_url('/categoria-producto/comercio-atencion/')); ?>">Comercio y atención</a>
                <a href="<?php echo esc_url(home_url('/categoria-producto/salud-estetica/')); ?>">Salud y estética</a>
                <a href="<?php echo esc_url(home_url('/categoria-producto/empresas-oficinas/')); ?>">Empresas y oficinas</a>
                <a href="<?php echo esc_url(home_url('/categoria-producto/campo-tradicion/')); ?>">Campo y tradición</a>
            </div>

            <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>">Simulá tu prenda</a>
            <a href="<?php echo esc_url(home_url('/nosotros/')); ?>">Nosotros</a>
            <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-header__mobile-quote">Pedir presupuesto</a>
        </nav>
    </header>

    <?php
}
