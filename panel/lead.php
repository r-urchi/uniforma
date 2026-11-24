<?php
declare(strict_types=1);

/**
 * Recibe las consultas y pedidos de presupuesto que llegan desde la web (el theme las reenvía desde el servidor).
 * Autenticación: encabezado X-Uniforma-Lead-Token = lead_token de config.local.php (nunca viaja al navegador).
 */
require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo '{"ok":false,"error":"Método no permitido"}';
    exit;
}
global $config;
if ((string)($config['lead_token'] ?? '') === '') {
    http_response_code(503);
    echo '{"ok":false,"error":"La recepción de consultas no está configurada"}';
    exit;
}
if (login_locked_seconds('lead-token') > 0) {
    http_response_code(429);
    echo '{"ok":false,"error":"Demasiados intentos"}';
    exit;
}
if (!lead_token_ok()) {
    login_register_failure('lead-token');
    http_response_code(401);
    echo '{"ok":false,"error":"No autorizado"}';
    exit;
}
$d = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($d)) {
    http_response_code(400);
    echo '{"ok":false,"error":"JSON inválido"}';
    exit;
}
$source = in_array((string)($d['source'] ?? ''), ['contacto', 'producto', 'recompra'], true) ? (string)$d['source'] : 'contacto';
$email = clean_text($d['email'] ?? '', 120);
$lead = [
    'source' => $source,
    'name' => clean_text($d['name'] ?? '', 120),
    'company' => clean_text($d['company'] ?? '', 160),
    'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '',
    'phone' => clean_text($d['phone'] ?? '', 60),
    'qty' => clean_text($d['qty'] ?? '', 40),
    'type' => clean_text($d['type'] ?? '', 80),
    'message' => clean_text($d['message'] ?? '', 1500),
    'product' => clean_text($d['product'] ?? '', 160),
    'sku' => clean_text($d['sku'] ?? '', 60),
    'color' => clean_text($d['color'] ?? '', 60),
    'size' => clean_text($d['size'] ?? '', 60),
    'personalization' => clean_text($d['personalization'] ?? '', 80),
    'page' => clean_text($d['page'] ?? '', 300),
];
if ($source !== 'producto' && $lead['name'] === '' && $lead['company'] === '') {
    http_response_code(422);
    echo '{"ok":false,"error":"Faltan datos de contacto"}';
    exit;
}
acquire_state_lock();
$state = load_state();
$id = add_lead($state, $lead);
if ($id !== null) {
    $label = $source === 'producto' ? 'Interés en ' . ($lead['product'] ?: 'un producto') : 'Consulta de ' . ($lead['company'] ?: $lead['name']);
    $state = push_audit($state, 'Consulta de la web', $label);
    save_state($state);
}
echo json_encode(['ok' => true, 'duplicate' => $id === null]);
