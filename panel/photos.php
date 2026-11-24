<?php
declare(strict_types=1);

/**
 * Fotos de trabajos terminados (solo equipo). Se guardan como archivos en data/photos/<propuesta>/, no en el JSON.
 *   POST multipart  action=upload  (proposalId, caption, file)   -> agrega la foto a la propuesta
 *   POST json       action=delete  (proposalId, photoId)
 *   GET  ?p=ID_PROPUESTA&id=ID_FOTO                              -> la imagen (para el equipo)
 * El cliente las ve desde track.php solo si la foto está marcada como compartida.
 */
require __DIR__ . '/bootstrap.php';
require_login();

const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

function photo_fail(string $msg, int $code = 422): void
{
    http_response_code($code);
    json_response(['ok' => false, 'error' => $msg]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$allowed = static fn(): bool => can_user(current_user(), 'proposals.manage') || can_user(current_user(), 'tasks.manage');

if ($method === 'GET') {
    if (!can_user(current_user(), 'proposals.view') && !can_user(current_user(), 'tasks.view')) {
        http_response_code(403);
        exit;
    }
    $pid = (string)($_GET['p'] ?? '');
    $id = (string)($_GET['id'] ?? '');
    $state = load_state();
    foreach ($state['proposals'] as $p) {
        if (($p['id'] ?? '') !== $pid) {
            continue;
        }
        foreach (is_array($p['photos'] ?? null) ? $p['photos'] : [] as $ph) {
            if (($ph['id'] ?? '') === $id && preg_match('/^[a-z0-9-]+$/', $id) && in_array($ph['ext'] ?? '', ['jpg', 'png', 'webp'], true)) {
                $file = photos_dir($pid) . '/' . $id . '.' . $ph['ext'];
                if (is_file($file)) {
                    header('Content-Type: ' . ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ph['ext']]);
                    header('Cache-Control: private, max-age=86400');
                    readfile($file);
                    exit;
                }
            }
        }
    }
    http_response_code(404);
    exit;
}

require_csrf();
if (!$allowed()) {
    photo_fail('No tenés permiso para subir fotos.', 403);
}
$action = (string)($_GET['action'] ?? '');

if ($action === 'upload') {
    $pid = (string)($_POST['proposalId'] ?? '');
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        photo_fail('No se recibió la foto (o supera el límite del servidor).');
    }
    if ((int)$file['size'] > PHOTO_MAX_BYTES) {
        photo_fail('La foto supera los 4 MB.');
    }
    $bytes = (string)file_get_contents((string)$file['tmp_name']);
    $info = @getimagesizefromstring($bytes);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]]) || $info[0] > 6000 || $info[1] > 6000) {
        photo_fail('Formato no permitido. Usá JPG, PNG o WEBP.');
    }
    acquire_state_lock();
    $state = load_state();
    $idx = null;
    foreach ($state['proposals'] as $i => $p) {
        if (($p['id'] ?? '') === $pid) {
            $idx = $i;
        }
    }
    if ($idx === null) {
        photo_fail('No se encontró la propuesta.', 404);
    }
    $list = is_array($state['proposals'][$idx]['photos'] ?? null) ? $state['proposals'][$idx]['photos'] : [];
    if (count($list) >= 12) {
        photo_fail('Ya hay 12 fotos en este pedido. Borrá alguna antes de subir otra.');
    }
    $dir = photos_dir($pid);
    foreach ([data_dir() . '/photos', $dir] as $d) {
        if (!is_dir($d) && !@mkdir($d, 0775) && !is_dir($d)) {
            photo_fail('No se pudo crear la carpeta de fotos.', 500);
        }
    }
    $photoId = 'ph-' . bin2hex(random_bytes(6));
    $ext = $types[$info[2]];
    if (@file_put_contents($dir . '/' . $photoId . '.' . $ext, $bytes) === false) {
        photo_fail('No se pudo guardar la foto.', 500);
    }
    $list[] = ['id' => $photoId, 'ext' => $ext, 'caption' => clean_text($_POST['caption'] ?? '', 120), 'at' => date('c'), 'by' => (string)(current_user()['name'] ?? ''), 'shared' => false];
    $state['proposals'][$idx]['photos'] = $list;
    $state['proposals'][$idx]['history'] = is_array($state['proposals'][$idx]['history'] ?? null) ? $state['proposals'][$idx]['history'] : [];
    array_unshift($state['proposals'][$idx]['history'], history_entry((string)(current_user()['name'] ?? 'Equipo'), 'Foto agregada', clean_text($_POST['caption'] ?? '', 120)));
    save_state($state);
    json_response(['ok' => true, 'photo' => end($list), 'proposal' => $state['proposals'][$idx]['photos']]);
}

if ($action === 'delete') {
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    $pid = (string)($payload['proposalId'] ?? '');
    $photoId = (string)($payload['photoId'] ?? '');
    acquire_state_lock();
    $state = load_state();
    foreach ($state['proposals'] as &$p) {
        if (($p['id'] ?? '') !== $pid) {
            continue;
        }
        $keep = [];
        foreach (is_array($p['photos'] ?? null) ? $p['photos'] : [] as $ph) {
            if (($ph['id'] ?? '') === $photoId) {
                @unlink(photos_dir($pid) . '/' . $photoId . '.' . ($ph['ext'] ?? 'jpg'));
                continue;
            }
            $keep[] = $ph;
        }
        $p['photos'] = $keep;
    }
    unset($p);
    save_state($state);
    json_response(['ok' => true]);
}

photo_fail('Acción inválida.', 400);
