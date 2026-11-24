<?php
declare(strict_types=1);

/**
 * Manuales de uso por puesto. Los textos están en manuals/*.html (carpeta cerrada al acceso directo).
 *  GET manual.php?list=1  -> manuales que le corresponden a quien está logueado (JSON)
 *  GET manual.php?m=clave -> fragmento HTML del manual (403 si no es de su puesto)
 */
require __DIR__ . '/bootstrap.php';
require_login();

function manual_catalog(): array
{
    return [
        'general' => ['Guía general', 'Cómo está armado el ERP, atajos, estados y glosario.'],
        'ventas' => ['Ventas', 'Clientes, propuestas, editor visual, seguimiento y WhatsApp.'],
        'gerente' => ['Gerencia', 'Control comercial, tableros, reportes y equipo.'],
        'produccion' => ['Diseño y producción', 'Aprobación de diseño, tablero de taller y control de calidad.'],
        'administracion' => ['Administración', 'Validación de pagos, cobranzas y entrega.'],
        'estudio' => ['Estudio de logos', 'Preparar logos: tamaño real, quitar fondo, colores y exportar.'],
    ];
}

function manual_keys_for_role(string $role): array
{
    $map = [
        'admin' => ['general', 'administracion', 'gerente', 'ventas', 'produccion', 'estudio'],
        'gerente' => ['gerente', 'ventas', 'estudio', 'general'],
        'administracion' => ['administracion', 'general'],
        'vendedor' => ['ventas', 'estudio', 'general'],
        'diseno' => ['produccion', 'estudio', 'general'],
        'lectura' => ['general'],
    ];
    return $map[$role] ?? ['general'];
}

$user = current_user() ?: [];
$allowed = manual_keys_for_role((string)($user['role'] ?? 'lectura'));
$catalog = manual_catalog();

if (isset($_GET['list'])) {
    $items = [];
    foreach ($allowed as $key) {
        $items[] = ['key' => $key, 'title' => $catalog[$key][0], 'description' => $catalog[$key][1]];
    }
    json_response(['ok' => true, 'manuals' => $items]);
}

$key = (string)($_GET['m'] ?? $allowed[0]);
if (!isset($catalog[$key]) || !in_array($key, $allowed, true)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Ese manual no corresponde a tu puesto.';
    exit;
}
$file = __DIR__ . '/manuals/' . $key . '.html';
if (!is_file($file)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Manual no disponible.';
    exit;
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, max-age=300');
readfile($file);
