<?php
declare(strict_types=1);

/**
 * API del Estudio de logos.
 * - Los archivos (imagenes) y proyectos viven en disco (data/studio), NO dentro de state.json.
 * - Requiere sesion y el permiso editor.use. Las escrituras exigen CSRF.
 */
require __DIR__ . '/bootstrap.php';
require_login();
require_permission('editor.use');

const STUDIO_MAX_UPLOAD = 10 * 1024 * 1024;
const STUDIO_MAX_DOC = 3 * 1024 * 1024;
const STUDIO_MAX_THUMB = 600 * 1024;

function studio_dir(string $sub = ''): string
{
    ensure_storage_ready();
    // Se crea nivel por nivel (algunos entornos no soportan mkdir recursivo).
    $dir = data_dir() . '/studio';
    foreach ($sub !== '' ? ['', $sub] : [''] as $part) {
        $dir = $part === '' ? $dir : $dir . '/' . $part;
        if (!is_dir($dir) && !@mkdir($dir, 0775) && !is_dir($dir)) {
            http_response_code(500);
            json_response(['ok' => false, 'error' => 'No se pudo crear la carpeta del estudio']);
        }
    }
    return $dir;
}

function studio_id(string $id): string
{
    if (!preg_match('/^[a-f0-9]{16,40}$/', $id)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Identificador inválido']);
    }
    return $id;
}

function studio_log(string $action, string $detail): void
{
    $user = current_user();
    $line = json_encode([
        'at' => date('c'),
        'user' => (string)($user['name'] ?? ''),
        'ip' => client_ip(),
        'action' => $action,
        'detail' => $detail,
    ], JSON_UNESCAPED_UNICODE) . "\n";
    @file_put_contents(studio_dir() . '/log.jsonl', $line, FILE_APPEND | LOCK_EX);
}

function studio_project_path(string $id): string
{
    return studio_dir('projects') . '/' . studio_id($id) . '.json';
}

function studio_read_project(string $id): ?array
{
    $file = studio_project_path($id);
    if (!is_file($file)) {
        return null;
    }
    $data = json_decode((string)file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

function studio_asset_file(string $id): ?string
{
    studio_id($id);
    foreach (['png', 'jpg', 'webp', 'gif'] as $ext) {
        $file = studio_dir('assets') . '/' . $id . '.' . $ext;
        if (is_file($file)) {
            return $file;
        }
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string)($_GET['action'] ?? '');

if ($method === 'GET') {
    if ($action === 'list') {
        $items = [];
        foreach (glob(studio_dir('projects') . '/*.json') ?: [] as $file) {
            $project = json_decode((string)file_get_contents($file), true);
            if (!is_array($project)) {
                continue;
            }
            $items[] = [
                'id' => (string)$project['id'],
                'name' => (string)($project['name'] ?? 'Sin nombre'),
                'clientId' => (string)($project['clientId'] ?? ''),
                'widthCm' => (float)($project['doc']['widthCm'] ?? 0),
                'heightCm' => (float)($project['doc']['heightCm'] ?? 0),
                'updatedAt' => (string)($project['updatedAt'] ?? ''),
                'updatedBy' => (string)($project['updatedBy'] ?? ''),
                'rev' => (int)($project['rev'] ?? 1),
            ];
        }
        usort($items, static fn(array $a, array $b): int => strcmp($b['updatedAt'], $a['updatedAt']));
        json_response(['ok' => true, 'projects' => $items]);
    }

    if ($action === 'project') {
        $project = studio_read_project((string)($_GET['id'] ?? ''));
        if (!$project) {
            http_response_code(404);
            json_response(['ok' => false, 'error' => 'No se encontró el proyecto']);
        }
        json_response(['ok' => true, 'project' => $project]);
    }

    if ($action === 'asset' || $action === 'thumb') {
        $id = studio_id((string)($_GET['id'] ?? ''));
        $file = $action === 'thumb' ? studio_dir('thumbs') . '/' . $id . '.png' : studio_asset_file($id);
        if (!$file || !is_file($file)) {
            http_response_code(404);
            exit;
        }
        $mime = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif'][strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($file));
        header('Cache-Control: private, max-age=86400');
        readfile($file);
        exit;
    }

    if ($action === 'context') {
        // Clientes y prendas para vincular proyectos y previsualizar (solo lectura, sin precios ni costos).
        $state = load_state();
        $clients = [];
        foreach ($state['clients'] as $client) {
            if (is_array($client)) {
                $clients[] = ['id' => (string)($client['id'] ?? ''), 'company' => (string)($client['company'] ?? '')];
            }
        }
        $products = [];
        foreach ($state['products'] as $product) {
            if (is_array($product) && !empty($product['name'])) {
                $products[] = [
                    'id' => (string)($product['id'] ?? ''),
                    'name' => (string)$product['name'],
                    'image' => (string)($product['image'] ?? ''),
                    'imageBack' => (string)($product['imageBack'] ?? ''),
                ];
            }
        }
        json_response(['ok' => true, 'clients' => $clients, 'products' => $products, 'csrf' => csrf_token()]);
    }

    http_response_code(400);
    json_response(['ok' => false, 'error' => 'Acción inválida']);
}

if ($method !== 'POST') {
    http_response_code(405);
    json_response(['ok' => false, 'error' => 'Método no permitido']);
}

require_csrf();

if ($action === 'upload') {
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'No se recibió el archivo o supera el límite del servidor']);
    }
    if ((int)$file['size'] > STUDIO_MAX_UPLOAD) {
        http_response_code(413);
        json_response(['ok' => false, 'error' => 'La imagen supera los 10 MB']);
    }
    $bytes = (string)file_get_contents((string)$file['tmp_name']);
    $info = @getimagesizefromstring($bytes);
    $types = [IMAGETYPE_PNG => 'png', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
    if (!$info || !isset($types[$info[2]])) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Formato no permitido. Usá PNG, JPG, WEBP o GIF (los SVG se convierten en el navegador).']);
    }
    if ($info[0] > 8000 || $info[1] > 8000) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'La imagen supera los 8000 px por lado']);
    }
    $id = substr(hash('sha256', $bytes), 0, 32);
    $target = studio_dir('assets') . '/' . $id . '.' . $types[$info[2]];
    if (!is_file($target)) {
        // Nombre por contenido: escribir a un temporal y renombrar evita archivos a medias.
        $temp = $target . '.tmp-' . bin2hex(random_bytes(4));
        $written = @file_put_contents($temp, $bytes);
        if ($written === false || !@rename($temp, $target)) {
            @unlink($temp);
            $err = error_get_last();
            http_response_code(500);
            json_response(['ok' => false, 'error' => 'No se pudo guardar la imagen' . ($err ? ' (' . $err['message'] . ')' : '')]);
        }
    }
    json_response(['ok' => true, 'id' => $id, 'width' => $info[0], 'height' => $info[1]]);
}

$payload = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($payload)) {
    http_response_code(400);
    json_response(['ok' => false, 'error' => 'JSON inválido']);
}

if ($action === 'save') {
    $doc = $payload['doc'] ?? null;
    $name = trim((string)($payload['name'] ?? ''));
    $clientId = trim((string)($payload['clientId'] ?? ''));
    $docJson = json_encode($doc);
    if (!is_array($doc) || $docJson === false || strlen($docJson) > STUDIO_MAX_DOC) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El diseño es inválido o demasiado grande']);
    }
    if ($name === '' || mb_strlen($name) > 120) {
        $name = 'Sin nombre';
    }
    $id = (string)($payload['id'] ?? '');
    $existing = $id !== '' ? studio_read_project($id) : null;
    if ($id !== '' && !$existing) {
        $id = '';
    }
    if ($existing && isset($payload['baseRev']) && (int)$payload['baseRev'] !== (int)($existing['rev'] ?? 1)) {
        http_response_code(409);
        json_response(['ok' => false, 'conflict' => true, 'error' => 'Otra persona guardó este proyecto. Duplicalo con «Guardar como copia» o recargalo.']);
    }
    if ($id === '') {
        $id = bin2hex(random_bytes(10));
    }
    $user = current_user();
    $project = [
        'id' => $id,
        'name' => $name,
        'clientId' => $clientId,
        'doc' => $doc,
        'rev' => (int)($existing['rev'] ?? 0) + 1,
        'createdAt' => (string)($existing['createdAt'] ?? date('c')),
        'createdBy' => (string)($existing['createdBy'] ?? ($user['name'] ?? '')),
        'updatedAt' => date('c'),
        'updatedBy' => (string)($user['name'] ?? ''),
    ];
    atomic_json_write(studio_project_path($id), $project, 'proyecto del estudio');

    $thumb = (string)($payload['thumb'] ?? '');
    if ($thumb !== '' && strlen($thumb) <= STUDIO_MAX_THUMB * 1.4 && preg_match('~^data:image/png;base64,([A-Za-z0-9+/=]+)$~', $thumb, $m)) {
        $png = base64_decode($m[1], true);
        if ($png !== false && strlen($png) <= STUDIO_MAX_THUMB && @getimagesizefromstring($png)) {
            @file_put_contents(studio_dir('thumbs') . '/' . $id . '.png', $png, LOCK_EX);
        }
    }
    studio_log($existing ? 'Proyecto guardado' : 'Proyecto creado', $name . ' [' . $id . ']');
    json_response(['ok' => true, 'id' => $id, 'rev' => $project['rev'], 'updatedAt' => $project['updatedAt']]);
}

if ($action === 'delete') {
    $id = studio_id((string)($payload['id'] ?? ''));
    $file = studio_project_path($id);
    if (!is_file($file)) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró el proyecto']);
    }
    // No se borra: se mueve a la papelera del estudio para poder recuperarlo.
    $trash = studio_dir('trash');
    @rename($file, $trash . '/' . $id . '-' . date('Ymd-His') . '.json');
    studio_log('Proyecto a papelera', $id);
    json_response(['ok' => true]);
}

http_response_code(400);
json_response(['ok' => false, 'error' => 'Acción inválida']);
