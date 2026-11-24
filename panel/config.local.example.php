<?php
// Copiar como config.local.php y completar. Ese archivo NUNCA se sube a repositorios.
return [
    // 'data_dir' => '/home/USUARIO/uniforma-data',
    // 'setup_key' => 'clave-para-crear-el-primer-admin',
    // Recepción de consultas de la web: token largo y secreto (mínimo 20 caracteres, ej.: 40 letras y números al azar).
    // El MISMO valor se define en el wp-config.php de la web como UNIFORMA_ERP_LEAD_TOKEN. Vacío = no recibe consultas.
    'lead_token' => '',
    // URL pública del panel para los links que se mandan a clientes (opcional; si se omite se deduce del pedido).
    // 'public_url' => 'https://uniforma.com.ar/panel',
    // Correo saliente. mode: 'off' (no envía), 'test' (todo va a test_to) o 'on' (real).
    // Probar primero en 'test'. from debe ser una casilla del dominio de UNIFORMA.
    'mail' => [
        'mode' => 'off',
        'from' => '',          // ej.: 'ventas@uniforma.com.ar'
        'from_name' => 'UNIFORMA',
        'reply_to' => '',
        'test_to' => '',       // casilla de prueba para el modo test
    ],
    'catalog_sync' => [
        // Token privado del catalogo (el mismo que valida la web). Rotarlo si estuvo expuesto.
        'token' => '',
    ],
];
