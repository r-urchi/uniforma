<?php
// Configuracion base SIN secretos. Los valores reales van en config.local.php
// (no se sube al repositorio ni se comparte) o en variables de entorno.
$config = [
    'app_name' => 'UNIFORMA Panel',
    'session_name' => 'UNIFORMA_PANEL_SESION',
    // Carpeta de datos. Lo ideal en produccion es una ruta FUERA de public_html,
    // por ejemplo '/home/usuario/uniforma-data'. Vacio = ./data (protegida con .htaccess).
    'data_dir' => '',
    // Clave opcional que se pide para crear el primer administrador.
    'setup_key' => '',
    'catalog_sync' => [
        'url' => 'https://uniforma.com.ar/wp-json/uniforma/v1/catalog',
        'token' => '',
        'timeout' => 25,
    ],
];

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
    $override = require $local;
    if (is_array($override)) {
        $config = array_replace_recursive($config, $override);
    }
}

$envToken = getenv('UNIFORMA_CATALOG_TOKEN');
if (is_string($envToken) && $envToken !== '') {
    $config['catalog_sync']['token'] = $envToken;
}
$envData = getenv('UNIFORMA_DATA_DIR');
if (is_string($envData) && $envData !== '') {
    $config['data_dir'] = $envData;
}

return $config;
