<?php

add_action('wp_footer', 'uniforma_whatsapp_button');

if (!function_exists('uniforma_whatsapp_button')) {
function uniforma_whatsapp_button() {
    // 1. Ocultar en Checkout
    // Usamos is_checkout() (estándar Woo) O is_page('finalizar-compra') por seguridad.
    if (
        (function_exists('is_checkout') && is_checkout()) ||
        is_page('finalizar-compra') ||
        (function_exists('is_cart') && is_cart())
    ) {
        return;
    }

    // 2. Definir números
    // Número único del sitio (functions.php).
    $current_phone = uniforma_whatsapp_number();
    $message       = "Hola, quiero consultar por uniformes para mi empresa."; 


    // Generar enlace
    $whatsapp_url = uniforma_whatsapp_url($message);
    ?>

    <a href="<?php echo esc_url($whatsapp_url); ?>" class="un-whatsapp-float" target="_blank" rel="noopener noreferrer" aria-label="Chat en WhatsApp">
        <svg viewBox="0 0 32 32" class="un-whatsapp-icon">
            <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-1.834-1.057-2.658-1.057zM16 4.75C9.77 4.75 4.75 9.77 4.75 16c0 1.98.53 3.845 1.46 5.485L4.75 27.25l5.805-1.445c1.6 1.01 3.5 1.6 5.445 1.6 6.23 0 11.25-5.02 11.25-11.25S22.23 4.75 16 4.75z" fill-rule="evenodd"></path>
        </svg>
    </a>

    
    <?php
}
}
