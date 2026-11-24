<?php
/**
 * UNIFORMA — Botón de arrepentimiento
 * Shortcode: [uniforma_withdrawal]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_withdrawal_shortcode()
{
    $whatsapp_url = uniforma_whatsapp_url('Hola UNIFORMA, quiero ejercer mi derecho de arrepentimiento sobre un pedido. Mi número de pedido es: ');

    ob_start();
    ?>

    <main class="uniforma-info-page">

        <section class="uniforma-info-hero">
            <div class="uniforma-info-hero__inner">
                <span>Derechos del consumidor</span>
                <h1>Botón de arrepentimiento</h1>
                <p>Conforme la Ley 24.240 de Defensa del Consumidor y la Resolución 424/2020.</p>
            </div>
        </section>

        <div class="uniforma-info-content">

            <h2>¿Qué es el derecho de arrepentimiento?</h2>
            <p>
                Es el derecho que tenés, como consumidor, a revocar la aceptación de una compra realizada a
                distancia (como una compra online) dentro de los <strong>10 (diez) días corridos</strong>
                desde que recibís el producto, sin necesidad de justificar el motivo y sin ningún costo
                adicional, conforme el artículo 34 de la Ley 24.240.
            </p>

            <h2>Importante: excepción para productos personalizados</h2>
            <p>
                De acuerdo con el <strong>artículo 1116 del Código Civil y Comercial de la Nación</strong>, el
                derecho de arrepentimiento <strong>no se aplica a los productos confeccionados conforme a las
                especificaciones del consumidor o claramente personalizados</strong> — por ejemplo, prendas con
                logo bordado o estampado, talles especiales fuera de stock estándar, o diseños a medida.
            </p>
            <p>
                Como la mayoría de los productos de UNIFORMA se fabrican o personalizan a pedido, en esos casos
                no corresponde el derecho de arrepentimiento una vez iniciada la producción. Te lo aclaramos
                siempre antes de confirmar tu pedido.
            </p>

            <h2>¿Cuándo sí podés arrepentirte de tu compra?</h2>
            <p>
                Si compraste un producto <strong>sin personalizar</strong> (sin logo, sin bordado ni diseño a
                medida) y todavía no pasaron 10 días corridos desde que lo recibiste, podés ejercer tu derecho
                de arrepentimiento.
            </p>

            <h2>¿Cómo ejercer tu derecho de arrepentimiento?</h2>
            <p>Escribinos indicando:</p>
            <ul>
                <li>Número de pedido</li>
                <li>Producto que querés devolver</li>
                <li>Fecha en que lo recibiste</li>
            </ul>
            <p>
                Te confirmamos la recepción de tu solicitud y te indicamos los pasos siguientes (devolución del
                producto y reintegro del pago).
            </p>

            <a href="<?php echo esc_url($whatsapp_url); ?>" class="uniforma-info-cta" target="_blank" rel="noopener noreferrer">
                Ejercer mi derecho de arrepentimiento por WhatsApp
            </a>

        </div>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_withdrawal', 'uniforma_withdrawal_shortcode');
