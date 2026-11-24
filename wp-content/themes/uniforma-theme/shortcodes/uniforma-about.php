<?php
/**
 * UNIFORMA — Sobre nosotros
 * Shortcode: [uniforma_about]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_about_shortcode()
{
    $hero_image = trailingslashit(get_template_directory_uri()) . 'assets/images/about/uniforma-equipo-viga.webp';
    $embroidery_image = 'https://uniforma.com.ar/wp-content/uploads/2026/08/proceso-bordado-logo-uniforma-1200x600-1.webp';

    ob_start();
    ?>

    <main class="uniforma-about" id="uniformaAbout">

        <section class="uniforma-about-hero" style="background-image: linear-gradient(90deg, rgba(251,248,244,.98) 0%, rgba(251,248,244,.88) 34%, rgba(251,248,244,.22) 58%, rgba(251,248,244,.02) 100%), url('<?php echo esc_url($hero_image); ?>'); --uniforma-hero-image: url('<?php echo esc_url($hero_image); ?>');">
            <div class="uniforma-about-hero__inner">
                <span>Nosotros</span>
                <i></i>

                <h1>
                    Vestimos equipos,<br>
                    construimos <strong>identidad.</strong>
                </h1>

                <p>
                    En UNIFORMA creamos prendas personalizadas para empresas,
                    equipos de trabajo y profesionales que buscan comunicar
                    una imagen sólida, cuidada y coherente.
                </p>

                <a href="#uniformaAboutContent" class="uniforma-about-btn">
                    Conocé más
                </a>
            </div>
        </section>

        <section class="uniforma-about-intro" id="uniformaAboutContent">
            <div class="uniforma-about-intro__inner">

                <figure class="uniforma-about-intro__image">
                    <img src="<?php echo esc_url($embroidery_image); ?>" alt="Proceso de bordado UNIFORMA">
                </figure>

                <article class="uniforma-about-intro__text">
                    <h2>¿Quiénes somos?</h2>
                    <i></i>

                    <p>
                        Somos un equipo apasionado por el diseño, la calidad y los detalles.
                        Nos especializamos en la confección y personalización de uniformes
                        que representan la identidad de cada marca y fortalecen el sentido
                        de pertenencia de cada equipo.
                    </p>
                </article>

                <div class="uniforma-about-values">

                    <article>
                        <?php echo uniforma_about_icon('quality'); ?>
                        <div>
                            <h3>Calidad premium</h3>
                            <p>
                                Seleccionamos los mejores materiales y técnicas para garantizar
                                prendas duraderas y profesionales.
                            </p>
                        </div>
                    </article>

                    <article>
                        <?php echo uniforma_about_icon('people'); ?>
                        <div>
                            <h3>Atención personalizada</h3>
                            <p>
                                Acompañamos cada proyecto de principio a fin para lograr
                                el resultado que tu equipo necesita.
                            </p>
                        </div>
                    </article>

                    <article>
                        <?php echo uniforma_about_icon('thread'); ?>
                        <div>
                            <h3>Tecnología y detalle</h3>
                            <p>
                                Contamos con bordado y estampado DTF de última generación
                                para un acabado impecable.
                            </p>
                        </div>
                    </article>

                    <article>
                        <?php echo uniforma_about_icon('truck'); ?>
                        <div>
                            <h3>Envíos a todo el país</h3>
                            <p>
                                Llegamos a donde nos necesites para que tu equipo siempre
                                esté bien vestido.
                            </p>
                        </div>
                    </article>

                </div>

            </div>
        </section>

        <section class="uniforma-about-process">
            <div class="uniforma-about-process__inner">

                <h2>Nuestro proceso</h2>
                <i></i>

                <div class="uniforma-about-process__steps">

                    <article>
                        <span><?php echo uniforma_about_icon('shirt'); ?></span>
                        <b>1</b>
                        <div>
                            <h3>Elegí la prenda</h3>
                            <p>Seleccioná el tipo de prenda que mejor representa a tu equipo.</p>
                        </div>
                    </article>

                    <article>
                        <span><?php echo uniforma_about_icon('upload'); ?></span>
                        <b>2</b>
                        <div>
                            <h3>Cargá tu logo</h3>
                            <p>Nos enviás tu logo o imagen para personalizar.</p>
                        </div>
                    </article>

                    <article>
                        <span><?php echo uniforma_about_icon('eye'); ?></span>
                        <b>3</b>
                        <div>
                            <h3>Previsualizá</h3>
                            <p>Te mostramos cómo quedará tu prenda antes de producir.</p>
                        </div>
                    </article>

                    <article>
                        <span><?php echo uniforma_about_icon('file'); ?></span>
                        <b>4</b>
                        <div>
                            <h3>Recibí tu presupuesto</h3>
                            <p>Te enviamos una propuesta rápida, clara y sin compromiso.</p>
                        </div>
                    </article>

                    <article>
                        <span><?php echo uniforma_about_icon('truck'); ?></span>
                        <b>5</b>
                        <div>
                            <h3>Producimos y entregamos</h3>
                            <p>Producimos tu pedido con la mejor calidad y lo enviamos donde lo necesites.</p>
                        </div>
                    </article>

                </div>

            </div>
        </section>

        <section class="uniforma-about-benefits">
            <div class="uniforma-about-benefits__inner">

                <article>
                    <?php echo uniforma_about_icon('thread'); ?>
                    <div>
                        <h3>Bordado</h3>
                        <p>Acabado profesional y máxima durabilidad.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_about_icon('printer'); ?>
                    <div>
                        <h3>Estampado DTF</h3>
                        <p>Colores vibrantes, detalle y resistencia al lavado.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_about_icon('tag'); ?>
                    <div>
                        <h3>Pedí tu presupuesto</h3>
                        <p>Rápido, simple y sin compromiso.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_about_icon('truck'); ?>
                    <div>
                        <h3>Envíos a todo el país</h3>
                        <p>Llegamos a donde nos necesites.</p>
                    </div>
                </article>

            </div>
        </section>

    </main>

    <?php
    return ob_get_clean();
}

add_shortcode('uniforma_about', 'uniforma_about_shortcode');


function uniforma_about_icon($name)
{
    $icons = array(
        'quality' => '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 14.6 8.4 20.5 9.2 16.2 13.4 17.2 19.3 12 16.5 6.8 19.3 7.8 13.4 3.5 9.2 9.4 8.4 12 3Z"/></svg>',
        'people' => '<svg viewBox="0 0 24 24" fill="none"><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M17 10a3 3 0 1 0 0-6"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M15 16.5a5 5 0 0 1 6 4.5"/></svg>',
        'thread' => '<svg viewBox="0 0 24 24" fill="none"><path d="M8 3h8v18H8V3Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h8"/><path d="M8 19h8"/></svg>',
        'truck' => '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h11v10H3V6Z"/><path d="M14 10h4l3 3v3h-7v-6Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
        'shirt' => '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4 5 6.2 3 10l3 1.5V20h12v-8.5L21 10l-2-3.8L16 4l-2 2h-4L8 4Z"/><path d="M10 6c.5.7 1.2 1 2 1s1.5-.3 2-1"/></svg>',
        'upload' => '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        'eye' => '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>',
        'file' => '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>',
        'printer' => '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8V3h10v5"/><rect x="5" y="13" width="14" height="8" rx="1"/><path d="M5 17H3V9h18v8h-2"/><path d="M8 16h8"/><path d="M8 19h5"/></svg>',
        'tag' => '<svg viewBox="0 0 24 24" fill="none"><path d="M20 13.5L13.5 20a2.2 2.2 0 0 1-3.1 0L4 13.6V4h9.6L20 10.4a2.2 2.2 0 0 1 0 3.1Z"/><path d="M8.5 8.5h.01"/></svg>',
    );

    return isset($icons[$name]) ? $icons[$name] : '';
}