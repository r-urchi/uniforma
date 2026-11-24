<?php
/**
 * UNIFORMA — Preguntas frecuentes
 * Shortcode: [uniforma_faq]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_faq_shortcode()
{
    $faqs = function_exists('uniforma_get_all_faqs') ? uniforma_get_all_faqs() : array();

    ob_start();
    ?>

    <main class="uniforma-info-page">

        <section class="uniforma-info-hero">
            <div class="uniforma-info-hero__inner">
                <span>Ayuda</span>
                <h1>Preguntas frecuentes</h1>
                <p>Encontrá respuestas rápidas sobre envíos, personalización, plazos y pedidos. Si no encontrás lo que buscás, escribinos.</p>
            </div>
        </section>

        <div class="uniforma-info-content">
            <?php if (! empty($faqs)) : ?>
                <div class="uniforma-faq-list">
                    <?php foreach ($faqs as $faq) : ?>
                        <details class="uniforma-faq-item">
                            <summary>
                                <span><?php echo esc_html($faq['question']); ?></span>
                                <span class="uniforma-faq-item__icon" aria-hidden="true"></span>
                            </summary>
                            <div class="uniforma-faq-answer">
                                <p><?php echo nl2br(esc_html($faq['answer'])); ?></p>
                            </div>
                        </details>
                    <?php endforeach; ?>
                </div>
            <?php else : ?>
                <p class="uniforma-faq-empty">Todavía no cargamos preguntas frecuentes. Escribinos y te respondemos directamente.</p>
            <?php endif; ?>

            <a href="<?php echo esc_url(home_url('/contacto/')); ?>" class="uniforma-info-cta">
                ¿Tenés otra consulta? Contactanos
            </a>
        </div>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_faq', 'uniforma_faq_shortcode');
