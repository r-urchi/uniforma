<?php
/**
 * UNIFORMA — Footer custom global
 * Tema propio UNIFORMA
 */

if (! defined('ABSPATH')) {
    exit;
}

/* =========================================
   FOOTER HTML GLOBAL
========================================= */
function uniforma_render_global_footer()
{
    if (is_admin()) {
        return;
    }

    $logo_url = trailingslashit(get_template_directory_uri()) . 'assets/images/logo/uniforma-logo-transparente.webp';
    ?>

    <footer class="uniforma-footer" id="uniformaFooter">

        <div class="uniforma-footer__lead">
            <div class="uniforma-footer__lead-inner">
                <p class="uniforma-footer__slogan">Personalizamos lo que te identifica.</p>
                <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-footer__cta">Pedir presupuesto</a>
            </div>
        </div>

        <div class="uniforma-footer__container">

            <div class="uniforma-footer__brand">
                <a href="<?php echo esc_url(home_url('/')); ?>" class="uniforma-footer__logo" aria-label="Ir al inicio">
                    <img src="<?php echo esc_url($logo_url); ?>" alt="UNIFORMA">
                </a>

                <p>
                    Indumentaria para empresas, equipos y profesionales. Bordado y DTF.
                </p>
            </div>

            <div class="uniforma-footer__column">
                <h3>Catálogo</h3>

                <nav aria-label="Categorías del footer">
                    <?php foreach (uniforma_catalog_categories() as $category_slug => $category_name) : ?>
                        <a href="<?php echo esc_url(home_url('/categoria-producto/' . $category_slug . '/')); ?>"><?php echo esc_html($category_name); ?></a>
                    <?php endforeach; ?>
                </nav>
            </div>

            <div class="uniforma-footer__column">
                <h3>Información</h3>

                <nav aria-label="Información del footer">
                    <a href="<?php echo esc_url(home_url('/nosotros/')); ?>">Nosotros</a>
                    <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>">Simulá tu prenda</a>
                    <a href="<?php echo esc_url(home_url('/preguntas-frecuentes/')); ?>">Preguntas frecuentes</a>
                    <a href="<?php echo esc_url(home_url('/terminos-y-condiciones/')); ?>">Términos y condiciones</a>
                    <a href="<?php echo esc_url(home_url('/boton-de-arrepentimiento/')); ?>">Botón de arrepentimiento</a>
                    <a href="<?php echo esc_url(home_url('/contacto/')); ?>">Contacto</a>
                </nav>
            </div>

            <div class="uniforma-footer__social">
                <h3>Seguinos</h3>

                <div class="uniforma-footer__icons">
                    <a href="https://www.instagram.com/uniforma_ar" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="5"></rect>
                            <circle cx="12" cy="12" r="4"></circle>
                            <circle cx="17.5" cy="6.5" r="1"></circle>
                        </svg>
                    </a>

                    <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.6.4-1 1-1Z"></path>
                        </svg>
                    </a>

                    <a href="<?php echo esc_url(uniforma_whatsapp_url()); ?>" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"></path>
                            <path d="M9.5 8.5c.2 3 2.3 5.1 5 6l1.3-1.3c.2-.2.5-.3.8-.2.9.3 1.8.5 2.8.5"></path>
                        </svg>
                    </a>
                </div>
            </div>

        </div>

        <div class="uniforma-footer__legal">
            <p class="uniforma-footer__copy">
                © <?php echo esc_html(date('Y')); ?> UNIFORMA. Todos los derechos reservados.
            </p>
        </div>
    </footer>

    <?php
}
