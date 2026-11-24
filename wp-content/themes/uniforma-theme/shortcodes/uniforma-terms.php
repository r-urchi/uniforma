<?php
/**
 * UNIFORMA — Términos y condiciones
 * Shortcode: [uniforma_terms]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_terms_shortcode()
{
    ob_start();
    ?>

    <main class="uniforma-info-page">

        <section class="uniforma-info-hero">
            <div class="uniforma-info-hero__inner">
                <span>Legal</span>
                <h1>Términos y condiciones</h1>
                <?php /* La fecha NO se genera sola: una fecha dinámica aparenta una revisión legal que no ocurrió. Completar al validar el texto. */ ?>
                <p>Última actualización: [fecha de la revisión legal — completar]</p>
            </div>
        </section>

        <div class="uniforma-info-content">

            <p class="uniforma-info-notice">
                Este texto es un borrador general para comercio electrónico en Argentina. Antes de publicarlo,
                UNIFORMA debe completarlo con sus datos legales exactos (razón social, CUIT, domicilio) y
                validarlo con un asesor legal.
            </p>

            <h2>1. Aceptación de los términos</h2>
            <p>
                El acceso y uso de este sitio (<strong>uniforma.com.ar</strong>), operado por
                <strong>[Razón social de UNIFORMA — completar]</strong>, CUIT <strong>[completar]</strong>,
                con domicilio en <strong>[completar]</strong>, implica la aceptación de estos Términos y
                Condiciones. Si no estás de acuerdo, te pedimos que no utilices el sitio.
            </p>

            <h2>2. Productos y personalización</h2>
            <p>
                UNIFORMA comercializa indumentaria de trabajo y uniformes, con posibilidad de personalización
                mediante bordado, estampado u otras técnicas, según lo definido por cada cliente al momento
                de realizar su pedido (color, talle, logo, ubicación y cantidad).
            </p>
            <p>
                Las imágenes de los productos son ilustrativas. Los colores pueden variar levemente según la
                pantalla del dispositivo utilizado.
            </p>

            <h2>3. Precios y forma de pago</h2>
            <p>
                Los precios se informan en pesos argentinos y pueden ser modificados sin previo aviso. Los
                pedidos personalizados se presupuestan de forma individual según cantidad, técnica de
                personalización y plazo solicitado. El presupuesto se confirma por los canales de contacto
                oficiales de UNIFORMA (WhatsApp, email).
            </p>

            <h2>4. Plazos de producción y envíos</h2>
            <p>
                Los plazos de producción dependen del producto, la cantidad y el tipo de personalización
                solicitada, y se informan antes de confirmar cada pedido. UNIFORMA realiza envíos a todo el
                país a través de los medios que correspondan según destino.
            </p>

            <h2>5. Cambios, devoluciones y derecho de arrepentimiento</h2>
            <p>
                De acuerdo con el artículo 1116 del Código Civil y Comercial de la Nación, el derecho de
                revocación (o "botón de arrepentimiento") <strong>no aplica a los bienes confeccionados
                conforme a las especificaciones del consumidor o claramente personalizados</strong>, como los
                productos con logo, bordado o diseño a medida.
            </p>
            <p>
                Para productos estándar sin personalizar, el cliente puede ejercer su derecho de arrepentimiento
                dentro de los 10 (diez) días corridos desde la recepción del producto, conforme la Ley 24.240 de
                Defensa del Consumidor. Más información en nuestra página de
                <a href="<?php echo esc_url(home_url('/boton-de-arrepentimiento/')); ?>">Botón de arrepentimiento</a>.
            </p>
            <p>
                En caso de error de fabricación o defecto de fábrica, UNIFORMA gestiona el cambio o la
                reposición de la prenda, evaluando cada caso según lo previsto en la Ley 24.240.
            </p>

            <h2>6. Propiedad intelectual</h2>
            <p>
                Los contenidos de este sitio (textos, imágenes, diseños, logo) son propiedad de UNIFORMA o de
                sus licenciantes, y no pueden reproducirse sin autorización previa.
            </p>
            <p>
                Al enviar un logo o diseño para personalizar un producto, el cliente declara contar con los
                derechos necesarios sobre esa imagen y autoriza a UNIFORMA a utilizarla exclusivamente para
                producir el pedido solicitado.
            </p>

            <h2>7. Modificaciones</h2>
            <p>
                UNIFORMA puede modificar estos Términos y Condiciones en cualquier momento. Los cambios rigen
                desde su publicación en esta página.
            </p>

            <h2>8. Legislación aplicable y jurisdicción</h2>
            <p>
                Estos términos se rigen por las leyes de la República Argentina. Ante cualquier controversia,
                las partes se someten a los tribunales ordinarios competentes, sin perjuicio de las normas de
                protección al consumidor que resulten aplicables.
            </p>

            <h2>9. Contacto</h2>
            <p>
                Ante cualquier consulta sobre estos Términos y Condiciones, podés escribirnos desde nuestra
                <a href="<?php echo esc_url(home_url('/contacto/')); ?>">página de contacto</a>.
            </p>

        </div>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_terms', 'uniforma_terms_shortcode');
