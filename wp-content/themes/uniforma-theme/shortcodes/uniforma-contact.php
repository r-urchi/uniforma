<?php
/**
 * UNIFORMA — Página de contacto
 * Shortcode: [uniforma_contact]
 */

if (! defined('ABSPATH')) {
    exit;
}

function uniforma_contact_shortcode()
{
    $hero_image = 'https://uniforma.com.ar/wp-content/uploads/2026/06/BANNER-CONTACTO.webp';

    ob_start();
    ?>

    <main class="uniforma-contact" id="uniformaContact">

        <section class="uniforma-contact-hero" style="background-image: linear-gradient(90deg, rgba(251,248,244,.98) 0%, rgba(251,248,244,.92) 34%, rgba(251,248,244,.36) 58%, rgba(251,248,244,.06) 100%), url('<?php echo esc_url($hero_image); ?>');">
            <div class="uniforma-contact-hero__inner">

                <nav class="uniforma-contact-breadcrumb" aria-label="Breadcrumb">
                    <a href="<?php echo esc_url(home_url('/')); ?>">Inicio</a>
                    <span>›</span>
                    <strong>Contacto</strong>
                </nav>

                <h1>Contactanos</h1>

                <i></i>

                <p>
                    Contanos qué necesitás y te ayudamos<br>
                    a armar tu uniforme personalizado.
                </p>

                <div class="uniforma-contact-hero__actions">
                    <a href="#uniformaContactForm" class="uniforma-contact-btn uniforma-contact-btn--primary">
                        <?php echo uniforma_contact_icon('tag'); ?>
                        Pedí tu presupuesto
                    </a>

                    <a href="<?php echo esc_url(home_url('/simula-tu-prenda/')); ?>" class="uniforma-contact-btn uniforma-contact-btn--secondary">
                        <?php echo uniforma_contact_icon('shirt'); ?>
                        Simulá tu prenda
                    </a>
                </div>

            </div>
        </section>

        <section class="uniforma-contact-main">
            <div class="uniforma-contact-main__inner">

                <section class="uniforma-contact-form-card" id="uniformaContactForm">
                    <h2>Envianos tu consulta</h2>

                    <form class="uniforma-contact-form" id="uniformaContactFormElement" data-whatsapp="<?php echo esc_attr(uniforma_whatsapp_number()); ?>">
                        <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">

                        <div class="uniforma-contact-field">
                            <label for="uc_name">Nombre y apellido <span>*</span></label>
                            <input type="text" id="uc_name" name="name" placeholder="Escribí tu nombre" required>
                        </div>

                        <div class="uniforma-contact-field">
                            <label for="uc_company">Nombre de la empresa <span>*</span></label>
                            <input type="text" id="uc_company" name="company" placeholder="Escribí el nombre de tu empresa" required>
                        </div>

                        <div class="uniforma-contact-field">
                            <label for="uc_email">Email <span>*</span></label>
                            <input type="email" id="uc_email" name="email" placeholder="ejemplo@empresa.com" required>
                        </div>

                        <div class="uniforma-contact-row">
                            <div class="uniforma-contact-field">
                                <label for="uc_phone">Teléfono / WhatsApp <span>*</span></label>
                                <input type="text" id="uc_phone" name="phone" placeholder="11 1234 5678" required>
                            </div>

                            <div class="uniforma-contact-field">
                                <label for="uc_qty">Cantidad aproximada</label>
                                <input type="text" id="uc_qty" name="qty" placeholder="Ej: 25, 50, 100...">
                            </div>
                        </div>

                        <div class="uniforma-contact-field">
                            <label for="uc_type">Tipo de prendas</label>
                            <select id="uc_type" name="type">
                                <option value="">Seleccioná el tipo de prendas</option>
                                <option value="Remeras">Remeras</option>
                                <option value="Chombas">Chombas</option>
                                <option value="Buzos">Buzos</option>
                                <option value="Camperas">Camperas</option>
                                <option value="Pantalones">Pantalones</option>
                                <option value="Accesorios">Accesorios</option>
                                <option value="Varios productos">Varios productos</option>
                            </select>
                        </div>

                        <div class="uniforma-contact-field">
                            <label for="uc_message">Consulta <span>*</span></label>
                            <textarea id="uc_message" name="message" placeholder="Contanos qué necesitás, detalles del proyecto, colores, talles, fechas, etc." required></textarea>
                        </div>

                        <div class="uniforma-contact-field">
                            <label>Adjuntá tu logo o archivo <em>(opcional)</em></label>

                            <label class="uniforma-contact-upload" for="uc_file">
                                <input type="file" id="uc_file" name="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.ai,.eps,.svg">
                                <span><?php echo uniforma_contact_icon('upload'); ?></span>
                                <strong>Arrastrá tu archivo aquí o hacé clic para buscar</strong>
                                <small>Formatos permitidos: PNG, JPG, PDF, AI, EPS. Máx. 10MB</small>
                            </label>

                            <p class="uniforma-contact-file-name" id="uniformaContactFileName"></p>
                        </div>

                        <button type="submit" class="uniforma-contact-submit">
                            Enviar consulta
                        </button>

                        <p class="uniforma-contact-security">
                            <?php echo uniforma_contact_icon('lock'); ?>
                            Tus datos están protegidos. No compartimos tu información.
                        </p>

                    </form>
                </section>

                <aside class="uniforma-contact-info-card">
                    <h2>Otros medios de contacto</h2>

                    <div class="uniforma-contact-info-list">

                        <a href="<?php echo esc_url(uniforma_whatsapp_url()); ?>" target="_blank" rel="noopener noreferrer" class="uniforma-contact-info-item">
                            <span><?php echo uniforma_contact_icon('whatsapp'); ?></span>
                            <div>
                                <h3>WhatsApp</h3>
                                <strong><?php echo esc_html(uniforma_whatsapp_display()); ?></strong>
                                <p>Escribinos y te respondemos a la brevedad.</p>
                            </div>
                        </a>

                        <a href="mailto:contacto@uniforma.com.ar" class="uniforma-contact-info-item">
                            <span><?php echo uniforma_contact_icon('mail'); ?></span>
                            <div>
                                <h3>Email</h3>
                                <strong>contacto@uniforma.com.ar</strong>
                                <p>Respondemos todas las consultas por email.</p>
                            </div>
                        </a>

                        <a href="https://www.instagram.com/uniforma_ar" target="_blank" rel="noopener noreferrer" class="uniforma-contact-info-item">
                            <span><?php echo uniforma_contact_icon('instagram'); ?></span>
                            <div>
                                <h3>Instagram</h3>
                                <strong>@uniforma_ar</strong>
                                <p>Seguinos y conocé nuestros trabajos.</p>
                            </div>
                        </a>

                        <div class="uniforma-contact-info-item">
                            <span><?php echo uniforma_contact_icon('pin'); ?></span>
                            <div>
                                <h3>Ubicación</h3>
                                <strong>Envíos a todo el país</strong>
                                <p>Producimos y enviamos a donde nos necesites.</p>
                            </div>
                        </div>

                        <div class="uniforma-contact-info-item">
                            <span><?php echo uniforma_contact_icon('clock'); ?></span>
                            <div>
                                <h3>Horarios de atención</h3>
                                <strong>Lunes a Viernes de 10 a 19 hs</strong>
                                <p>Sábados de 10 a 14 hs.</p>
                            </div>
                        </div>

                    </div>

                    <div class="uniforma-contact-help">
                        <span><?php echo uniforma_contact_icon('headset'); ?></span>
                        <div>
                            <h3>¿Tenés dudas?</h3>
                            <p>
                                Nuestro equipo está listo para ayudarte
                                a crear el uniforme ideal para tu empresa.
                            </p>
                        </div>
                    </div>

                </aside>

            </div>
        </section>

        <section class="uniforma-contact-benefits">
            <div class="uniforma-contact-benefits__inner">

                <article>
                    <?php echo uniforma_contact_icon('thread'); ?>
                    <div>
                        <h3>Bordado</h3>
                        <p>Acabado profesional y máxima durabilidad.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_contact_icon('printer'); ?>
                    <div>
                        <h3>Estampado DTF</h3>
                        <p>Colores vibrantes, detalle y resistencia al lavado.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_contact_icon('tag'); ?>
                    <div>
                        <h3>Pedí tu presupuesto</h3>
                        <p>Rápido, simple y sin compromiso.</p>
                    </div>
                </article>

                <article>
                    <?php echo uniforma_contact_icon('truck'); ?>
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

add_shortcode('uniforma_contact', 'uniforma_contact_shortcode');


function uniforma_contact_icon($name)
{
    $icons = array(
        'tag' => '<svg viewBox="0 0 24 24" fill="none"><path d="M20 13.5L13.5 20a2.2 2.2 0 0 1-3.1 0L4 13.6V4h9.6L20 10.4a2.2 2.2 0 0 1 0 3.1Z"/><path d="M8.5 8.5h.01"/></svg>',
        'shirt' => '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4 5 6.2 3 10l3 1.5V20h12v-8.5L21 10l-2-3.8L16 4l-2 2h-4L8 4Z"/><path d="M10 6c.5.7 1.2 1 2 1s1.5-.3 2-1"/></svg>',
        'upload' => '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        'lock' => '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
        'whatsapp' => '<svg viewBox="0 0 24 24" fill="none"><path d="M5.2 19 6.1 15.8A7.2 7.2 0 1 1 9 18.6L5.2 19Z"/><path d="M9.5 8.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.4.5c-.1.1-.2.3-.1.5.3.7 1.1 1.6 2 2 .2.1.4 0 .5-.1l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.5 0 .5-.2 1.1-.6 1.4-.5.4-1.3.5-2.7-.1-2.7-1.1-4.5-3.3-5.1-5.1-.3-1-.1-1.6.2-1.9Z"/></svg>',
        'mail' => '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
        'instagram' => '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/></svg>',
        'pin' => '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-12a7 7 0 0 0-14 0c0 6.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
        'clock' => '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        'headset' => '<svg viewBox="0 0 24 24" fill="none"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M5 13h3v5H6a1 1 0 0 1-1-1v-4Z"/><path d="M19 13h-3v5h2a1 1 0 0 0 1-1v-4Z"/><path d="M16 19c-.8 1-2 1.5-4 1.5"/></svg>',
        'thread' => '<svg viewBox="0 0 24 24" fill="none"><path d="M8 3h8v18H8V3Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h8"/><path d="M8 19h8"/></svg>',
        'printer' => '<svg viewBox="0 0 24 24" fill="none"><path d="M7 8V3h10v5"/><rect x="5" y="13" width="14" height="8" rx="1"/><path d="M5 17H3V9h18v8h-2"/><path d="M8 16h8"/><path d="M8 19h5"/></svg>',
        'truck' => '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6h11v10H3V6Z"/><path d="M14 10h4l3 3v3h-7v-6Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    );

    return isset($icons[$name]) ? $icons[$name] : '';
}