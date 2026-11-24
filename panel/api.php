<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
require_login();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function role_payload(): array
{
    $roles = role_definitions();
    foreach ($roles as $key => &$role) {
        $role['id'] = $key;
    }
    unset($role);
    return $roles;
}

function current_payload(): array
{
    $user = current_user();
    $payload = [
        'ok' => true,
        'state' => load_state(),
        'csrf' => csrf_token(),
        'user' => public_user($user ?: []),
        'permissions' => permission_list_for_user($user),
        'roles' => role_payload(),
        'allPermissions' => all_permission_keys(),
    ];

    if (can_user($user, 'users.manage')) {
        $payload['users'] = array_map('public_user', load_users());
    }
    if (can_user($user, 'proposals.view')) {
        $payload['tracking'] = tracking_load();
    }

    $payload['userNames'] = [];
    foreach (load_users() as $u) {
        $payload['userNames'][(string)($u['id'] ?? '')] = (string)($u['name'] ?? '');
    }
    if (!can_user($user, 'purchases.view')) {
        foreach (['suppliers', 'supplies', 'purchaseOrders', 'workOrders', 'supplyMovements'] as $hidden) {
            $payload['state'][$hidden] = [];
        }
    }
    if (!can_user($user, 'proposals.view')) {
        $payload['state']['leads'] = [];
    }
    if (!can_user($user, 'settings.manage')) {
        foreach ($payload['state']['products'] as &$product) {
            unset($product['unitCost']);
        }
        unset($product);
        foreach ($payload['state']['proposals'] as &$proposal) {
            unset($proposal['shippingCost']);
        }
        unset($proposal);
        unset($payload['state']['settings']['techniqueCosts'], $payload['state']['settings']['defaultMargin']);
    }

    return $payload;
}

function referenced_snapshot_ids(array $state): array
{
    $ids = [];
    $collect = static function (array $proposal) use (&$ids): void {
        $approvals = array_merge(
            is_array($proposal['approvalHistory'] ?? null) ? $proposal['approvalHistory'] : [],
            isset($proposal['artApproval']) && is_array($proposal['artApproval']) ? [$proposal['artApproval']] : []
        );
        foreach ($approvals as $approval) {
            $id = (string)($approval['snapshotId'] ?? '');
            if (preg_match('/^[a-f0-9]{24}$/', $id)) {
                $ids[$id] = true;
            }
        }
    };
    foreach ($state['proposals'] ?? [] as $proposal) {
        if (is_array($proposal)) {
            $collect($proposal);
        }
    }
    foreach ($state['trash'] ?? [] as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        if (($entry['type'] ?? '') === 'Propuesta' && is_array($entry['data'] ?? null)) {
            $collect($entry['data']);
        }
        if (($entry['type'] ?? '') === 'Cliente' && is_array($entry['data']['proposals'] ?? null)) {
            foreach ($entry['data']['proposals'] as $proposal) {
                if (is_array($proposal)) {
                    $collect($proposal);
                }
            }
        }
    }
    return array_keys($ids);
}

function changed(array $incoming, array $current, string $key): bool
{
    return json_encode($incoming[$key] ?? null) !== json_encode($current[$key] ?? null);
}

function remote_catalog_response(string $url, string $token, int $timeout): array
{
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => min(10, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'X-Uniforma-Catalog-Token: ' . $token,
            ],
        ]);
        $raw = curl_exec($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        return [is_string($raw) ? $raw : '', $status, $error];
    }

    if (!filter_var((string)ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) {
        return ['', 0, 'El servidor no tiene habilitado cURL ni allow_url_fopen'];
    }

    $headers = "Accept: application/json\r\nX-Uniforma-Catalog-Token: {$token}\r\n";
    $context = stream_context_create(['http' => [
        'method' => 'GET',
        'header' => $headers,
        'timeout' => $timeout,
        'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents($url, false, $context);
    $status = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $match)) {
            $status = (int)$match[1];
        }
    }
    return [is_string($raw) ? $raw : '', $status, $raw === false ? 'No se pudo abrir la URL del catalogo' : ''];
}

function fetch_web_catalog(): array
{
    global $config;
    $sync = is_array($config['catalog_sync'] ?? null) ? $config['catalog_sync'] : [];
    $url = trim((string)($sync['url'] ?? ''));
    $token = trim((string)($sync['token'] ?? ''));
    if ($url === '' || $token === '') {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'La sincronización del catálogo no está configurada']);
    }

    [$raw, $status, $transportError] = remote_catalog_response(
        $url,
        $token,
        max(5, (int)($sync['timeout'] ?? 25))
    );
    if ($raw === '') {
        http_response_code(502);
        json_response(['ok' => false, 'error' => 'No se pudo conectar con el catálogo de la web. ' . $transportError]);
    }
    $decoded = json_decode($raw, true);
    if ($status >= 400 || !is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['products'] ?? null)) {
        $message = is_array($decoded) ? (string)($decoded['message'] ?? $decoded['error'] ?? '') : '';
        http_response_code(502);
        json_response(['ok' => false, 'error' => $message ?: 'La web devolvió un catálogo inválido']);
    }
    return $decoded['products'];
}

function authorize_state_save(array $incoming, array $current): array
{
    // El frontend envia el estado completo. Una normalizacion del navegador
    // puede generar diferencias inocentes en secciones ajenas a la accion que
    // se esta realizando. En vez de bloquear todo el guardado, conservamos la
    // version actual de cada seccion que el usuario no puede administrar.
    $sections = [
        'settings' => 'settings.manage',
        'products' => 'catalog.manage',
        'clients' => 'clients.manage',
        'tasks' => 'tasks.manage',
        'proposals' => 'proposals.manage',
        'editor' => 'editor.use',
        'editorDraft' => 'editor.use',
    ];

    $user = current_user();
    if (!can_user($user, 'settings.manage')) {
        $shippingCosts = [];
        foreach ($current['proposals'] ?? [] as $proposal) {
            $shippingCosts[(string)($proposal['id'] ?? '')] = max(0, (float)($proposal['shippingCost'] ?? 0));
        }
        if (isset($incoming['proposals']) && is_array($incoming['proposals'])) {
            foreach ($incoming['proposals'] as &$proposal) {
                if (is_array($proposal)) {
                    $proposal['shippingCost'] = $shippingCosts[(string)($proposal['id'] ?? '')] ?? 0;
                }
            }
            unset($proposal);
        }
    }
    // La papelera solo la tocan quienes pueden modificar datos (borrar o restaurar).
    $canManageAny = false;
    foreach (['clients.manage', 'proposals.manage', 'catalog.manage', 'tasks.manage', 'settings.manage'] as $manageKey) {
        if (can_user($user, $manageKey)) {
            $canManageAny = true;
            break;
        }
    }
    if (!$canManageAny) {
        $incoming['trash'] = $current['trash'] ?? [];
    }
    foreach ($sections as $key => $permission) {
        if (!changed($incoming, $current, $key)) {
            continue;
        }
        if (!can_user($user, $permission)) {
            $incoming[$key] = $current[$key] ?? null;
        }
    }

    return $incoming;
}

function require_valid_proposal_clients(array $incoming, array $current): void
{
    $clientIds = [];
    foreach ($incoming['clients'] ?? [] as $client) {
        if (is_array($client) && isset($client['id'])) {
            $clientIds[(string)$client['id']] = true;
        }
    }
    $previous = [];
    foreach ($current['proposals'] ?? [] as $proposal) {
        if (is_array($proposal) && isset($proposal['id'])) {
            $previous[(string)$proposal['id']] = (string)($proposal['clientId'] ?? '');
        }
    }
    foreach ($incoming['proposals'] ?? [] as $proposal) {
        if (!is_array($proposal)) {
            continue;
        }
        $id = (string)($proposal['id'] ?? '');
        $clientId = (string)($proposal['clientId'] ?? '');
        // Conservar propuestas historicas aunque referencien una ficha ausente;
        // validar siempre las propuestas nuevas y los cambios de cliente.
        if ($id !== '' && isset($previous[$id]) && $previous[$id] === $clientId) {
            continue;
        }
        if ($clientId === '' || !isset($clientIds[$clientId])) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'Elegí un cliente existente o cargá sus datos junto con la propuesta.']);
        }
    }
}

function require_approved_design_integrity(array $incoming, array $current): void
{
    $incomingById = [];
    foreach ($incoming['proposals'] ?? [] as $proposal) {
        if (is_array($proposal)) {
            $incomingById[(string)($proposal['id'] ?? '')] = $proposal;
        }
    }
    foreach ($current['proposals'] ?? [] as $saved) {
        if (!is_array($saved) || empty($saved['artApproval']['snapshotId'])) {
            continue;
        }
        $next = $incomingById[(string)($saved['id'] ?? '')] ?? null;
        if (!is_array($next)) {
            continue;
        }
        $savedDesigns = array_map(static function ($design): array {
            if (!is_array($design)) {
                return [];
            }
            unset($design['production']);
            return $design;
        }, is_array($saved['designs'] ?? null) ? $saved['designs'] : []);
        $nextDesigns = array_map(static function ($design): array {
            if (!is_array($design)) {
                return [];
            }
            unset($design['production']);
            return $design;
        }, is_array($next['designs'] ?? null) ? $next['designs'] : []);
        if (($saved['clientId'] ?? '') !== ($next['clientId'] ?? '') ||
            ($saved['artApproval'] ?? null) !== ($next['artApproval'] ?? null) ||
            json_encode($savedDesigns) !== json_encode($nextDesigns)) {
            http_response_code(409);
            json_response(['ok' => false, 'error' => 'El diseño fue aprobado en otra sesión. Actualizá el panel o reabrí la aprobación antes de modificarlo.']);
        }
    }
}

/** Los numeros de presupuesto los define el servidor: nunca quedan dos propuestas con el mismo. */
function ensure_unique_public_ids(array $incoming, array $current): array
{
    $known = [];
    foreach ($current['proposals'] ?? [] as $proposal) {
        if (is_array($proposal) && isset($proposal['id'])) {
            $known[(string)$proposal['id']] = (string)($proposal['publicId'] ?? '');
        }
    }
    $used = [];
    $max = [];
    foreach ($incoming['proposals'] ?? [] as $proposal) {
        if (!is_array($proposal)) {
            continue;
        }
        $public = (string)($proposal['publicId'] ?? '');
        if ($public !== '') {
            $used[$public] = ($used[$public] ?? 0) + 1;
            if (preg_match('/^(.*?)(\d+)$/', $public, $m)) {
                $max[$m[1]] = max($max[$m[1]] ?? 0, (int)$m[2]);
            }
        }
    }
    foreach ($incoming['proposals'] as &$proposal) {
        if (!is_array($proposal)) {
            continue;
        }
        $id = (string)($proposal['id'] ?? '');
        $public = (string)($proposal['publicId'] ?? '');
        $isNew = !isset($known[$id]);
        if ($isNew && $public !== '' && ($used[$public] ?? 0) > 1 && preg_match('/^(.*?)(\d+)$/', $public, $m)) {
            $max[$m[1]] = ($max[$m[1]] ?? (int)$m[2]) + 1;
            $new = $m[1] . str_pad((string)$max[$m[1]], strlen($m[2]), '0', STR_PAD_LEFT);
            $used[$public]--;
            $used[$new] = 1;
            $proposal['publicId'] = $new;
        } elseif (!$isNew && $public === '' ) {
            $proposal['publicId'] = $known[$id];
        }
    }
    unset($proposal);
    return $incoming;
}

/** Resume que coleccion cambio y cuanto, para que la auditoria diga algo util. */
function change_summary(array $incoming, array $current): string
{
    $labels = ['clients' => 'Clientes', 'proposals' => 'Propuestas', 'products' => 'Productos', 'tasks' => 'Tareas', 'settings' => 'Configuración', 'trash' => 'Papelera'];
    $parts = [];
    foreach ($labels as $key => $label) {
        if (!changed($incoming, $current, $key)) {
            continue;
        }
        if (!is_array($incoming[$key] ?? null) || !array_is_list($incoming[$key])) {
            $parts[] = $label;
            continue;
        }
        $before = [];
        foreach ($current[$key] ?? [] as $row) {
            if (is_array($row) && isset($row['id'])) {
                $before[(string)$row['id']] = json_encode($row);
            }
        }
        $added = 0;
        $edited = 0;
        $seen = [];
        foreach ($incoming[$key] as $row) {
            if (!is_array($row) || !isset($row['id'])) {
                continue;
            }
            $id = (string)$row['id'];
            $seen[$id] = true;
            if (!isset($before[$id])) {
                $added++;
            } elseif ($before[$id] !== json_encode($row)) {
                $edited++;
            }
        }
        $removed = count(array_diff_key($before, $seen));
        $bits = [];
        if ($added) {
            $bits[] = "+$added";
        }
        if ($edited) {
            $bits[] = "~$edited";
        }
        if ($removed) {
            $bits[] = "-$removed";
        }
        $parts[] = $label . ($bits ? ' (' . implode(' ', $bits) . ')' : '');
    }
    return $parts ? implode(' · ', $parts) : 'Sin cambios relevantes';
}

/**
 * Reglas de pagos del lado del servidor (el navegador no decide nada):
 * - Todo pago nuevo entra "pending" (pendiente de validación), sin importar lo que mande el navegador.
 * - Estado y datos de revisión solo los cambia la acción review_payments (permiso payments.validate).
 * - Un pago validado o anulado no se edita ni se borra; para corregirlo Administración lo anula con motivo.
 * - Un pago rechazado que se corrige vuelve a pendiente.
 */
function enforce_payment_rules(array $incoming, array $current): array
{
    if (!is_array($incoming['proposals'] ?? null)) {
        return $incoming;
    }
    $user = current_user();
    $canValidate = can_user($user, 'payments.validate');
    $who = (string)($user['name'] ?? 'Equipo');

    // Pagos conocidos (propuestas actuales y papelera, para que restaurar no resetee estados).
    $known = [];
    $remember = static function (array $proposal) use (&$known): void {
        foreach (is_array($proposal['payments'] ?? null) ? $proposal['payments'] : [] as $pay) {
            if (is_array($pay) && isset($pay['id'])) {
                $known[(string)($proposal['id'] ?? '')][(string)$pay['id']] = $pay;
            }
        }
    };
    foreach ($current['proposals'] ?? [] as $proposal) {
        if (is_array($proposal)) {
            $remember($proposal);
        }
    }
    foreach ($current['trash'] ?? [] as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        if (($entry['type'] ?? '') === 'Propuesta' && is_array($entry['data'] ?? null)) {
            $remember($entry['data']);
        }
        if (($entry['type'] ?? '') === 'Cliente' && is_array($entry['data']['proposals'] ?? null)) {
            foreach ($entry['data']['proposals'] as $proposal) {
                if (is_array($proposal)) {
                    $remember($proposal);
                }
            }
        }
    }

    $incomingIds = [];
    foreach ($incoming['proposals'] as &$proposal) {
        if (!is_array($proposal)) {
            continue;
        }
        $pid = (string)($proposal['id'] ?? '');
        $incomingIds[$pid] = true;
        $out = [];
        $seen = [];
        foreach (is_array($proposal['payments'] ?? null) ? $proposal['payments'] : [] as $pay) {
            if (!is_array($pay)) {
                continue;
            }
            $id = (string)($pay['id'] ?? '');
            $seen[$id] = true;
            $prev = $known[$pid][$id] ?? null;
            $amount = (float)($pay['amount'] ?? 0);
            if (!is_finite($amount) || $amount <= 0 || $amount > 1000000000) {
                http_response_code(422);
                json_response(['ok' => false, 'error' => 'El monto del pago no es válido.']);
            }
            $receipt = (string)($pay['receiptData'] ?? '');
            if ($receipt !== '' && (strlen($receipt) > 2800000 || !preg_match('~^data:(image/(?:png|jpeg|webp)|application/pdf);base64,~', $receipt))) {
                $pay['receiptData'] = '';
                $pay['receiptName'] = '';
            }
            $reviewKeys = ['status', 'registeredBy', 'registeredById', 'registeredAt', 'validatedBy', 'validatedAt', 'reviewNote', 'voidedBy', 'voidedAt', 'legacy'];
            if ($prev === null) {
                foreach ($reviewKeys as $key) {
                    unset($pay[$key]);
                }
                $pay['status'] = 'pending';
                $pay['registeredBy'] = $who;
                $pay['registeredById'] = (string)($user['id'] ?? '');
                $pay['registeredAt'] = date('c');
            } else {
                $status = payment_status_of($prev);
                if (in_array($status, ['validated', 'voided'], true)) {
                    $pay = $prev;
                } else {
                    $keep = array_intersect_key($prev, array_flip($reviewKeys));
                    $dataKeys = ['type', 'amount', 'method', 'date', 'reference', 'note', 'receiptData'];
                    $changed = false;
                    foreach ($dataKeys as $key) {
                        if (($pay[$key] ?? null) != ($prev[$key] ?? null)) {
                            $changed = true;
                            break;
                        }
                    }
                    $pay = array_merge($pay, $keep, ['status' => $status]);
                    if ($status === 'rejected' && $changed) {
                        $pay['status'] = 'pending';
                        $pay['resubmittedAt'] = date('c');
                    }
                }
            }
            $out[] = $pay;
        }
        // Un pago validado/anulado no se puede quitar de la propuesta.
        foreach ($known[$pid] ?? [] as $id => $prev) {
            if (!isset($seen[$id]) && in_array(payment_status_of($prev), ['validated', 'voided'], true)) {
                $out[] = $prev;
            }
        }
        $proposal['payments'] = $out;
    }
    unset($proposal);

    // No se puede borrar una propuesta que tiene pagos validados sin el permiso de validar.
    foreach ($current['proposals'] ?? [] as $proposal) {
        $pid = (string)($proposal['id'] ?? '');
        if ($pid === '' || isset($incomingIds[$pid]) || $canValidate) {
            continue;
        }
        foreach (is_array($proposal['payments'] ?? null) ? $proposal['payments'] : [] as $pay) {
            if (is_array($pay) && payment_status_of($pay) === 'validated') {
                http_response_code(403);
                json_response(['ok' => false, 'error' => 'La propuesta ' . (string)($proposal['publicId'] ?? '') . ' tiene pagos validados. Solo Administración puede eliminarla.']);
            }
        }
    }
    return $incoming;
}

function sanitize_user_payload(array $payload, ?array $existing = null): array
{
    $roles = role_definitions();
    $role = (string)($payload['role'] ?? ($existing['role'] ?? 'lectura'));
    if (!isset($roles[$role])) {
        $role = 'lectura';
    }

    $known = all_permission_keys();
    $permissionsOverride = array_key_exists('permissionsOverride', $payload) && is_array($payload['permissionsOverride'])
        ? array_values(array_filter($payload['permissionsOverride'], static fn($permission): bool => is_string($permission) && in_array($permission, $known, true)))
        : (is_array($existing['permissionsOverride'] ?? null) ? $existing['permissionsOverride'] : []);

    return [
        'id' => (string)($existing['id'] ?? ('user-' . bin2hex(random_bytes(6)))),
        'name' => trim((string)($payload['name'] ?? ($existing['name'] ?? ''))),
        'email' => trim((string)($payload['email'] ?? ($existing['email'] ?? ''))),
        'username' => trim((string)($payload['username'] ?? ($existing['username'] ?? ''))),
        'role' => $role,
        'permissionsOverride' => $permissionsOverride,
        'active' => array_key_exists('active', $payload) ? (bool)$payload['active'] : (bool)($existing['active'] ?? true),
        'createdAt' => (string)($existing['createdAt'] ?? date('c')),
        'updatedAt' => date('c'),
        'lastLoginAt' => (string)($existing['lastLoginAt'] ?? ''),
        'prefs' => is_array($existing['prefs'] ?? null) ? $existing['prefs'] : [],
        'totp' => is_array($existing['totp'] ?? null) ? $existing['totp'] : null,
    ];
}

function ensure_unique_login(array $users, array $candidate): void
{
    $username = strtolower((string)$candidate['username']);
    $email = strtolower((string)$candidate['email']);
    foreach ($users as $user) {
        if (($user['id'] ?? '') === ($candidate['id'] ?? '')) {
            continue;
        }
        if ($username !== '' && strtolower((string)($user['username'] ?? '')) === $username) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'Ya existe un usuario con ese nombre']);
        }
        if ($email !== '' && strtolower((string)($user['email'] ?? '')) === $email) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'Ya existe un usuario con ese email']);
        }
    }
}

function ensure_admin_available(array $users): void
{
    foreach ($users as $user) {
        if (($user['role'] ?? '') === 'admin' && !empty($user['active'])) {
            return;
        }
    }

    http_response_code(422);
    json_response(['ok' => false, 'error' => 'Tiene que quedar al menos un administrador activo']);
}

if ($method === 'GET') {
    json_response(current_payload());
}

if ($method !== 'POST') {
    http_response_code(405);
    json_response(['ok' => false, 'error' => 'Metodo no permitido']);
}

require_csrf();
acquire_state_lock();

$rawInput = file_get_contents('php://input') ?: '';
if ($rawInput === '' && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    http_response_code(413);
    json_response(['ok' => false, 'error' => 'La solicitud supera el limite de carga del servidor']);
}
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    http_response_code(400);
    json_response(['ok' => false, 'error' => 'JSON invalido: ' . json_last_error_msg()]);
}

$action = $payload['action'] ?? '';

if ($action === 'approve_design') {
    require_permission('proposals.manage');
    $proposalId = (string)($payload['proposalId'] ?? '');
    $approvedBy = trim((string)($payload['approvedBy'] ?? ''));
    $approvedAt = (string)($payload['approvedAt'] ?? '');
    $note = trim((string)($payload['note'] ?? ''));
    $evidenceName = trim((string)($payload['evidenceName'] ?? ''));
    $evidenceData = (string)($payload['evidenceData'] ?? '');
    $parts = explode('-', $approvedAt);
    if ($approvedBy === '' || strlen($approvedBy) > 180 || count($parts) !== 3 ||
        !checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Ingresá una persona y una fecha de aprobación válidas']);
    }
    if (strlen($note) > 1000 || strlen($evidenceData) > 2800000 ||
        ($evidenceData !== '' && !preg_match('~^data:(image/(?:png|jpeg|webp)|application/pdf);base64,~', $evidenceData))) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El comprobante es inválido o supera los 2 MB']);
    }
    $state = load_state();
    foreach ($state['proposals'] as &$proposal) {
        if (($proposal['id'] ?? '') !== $proposalId) {
            continue;
        }
        if (empty($proposal['designs']) || !empty($proposal['artApproval'])) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'La propuesta no tiene prendas o ya está aprobada']);
        }
        $revision = max(1, (int)($proposal['designRevision'] ?? 0));
        $incomingDesigns = $payload['designs'] ?? null;
        if (!is_array($incomingDesigns) || count($incomingDesigns) !== count($proposal['designs']) ||
            (int)($payload['expectedRevision'] ?? -1) !== $revision) {
            http_response_code(409);
            json_response(['ok' => false, 'error' => 'La propuesta cambió en otra sesión. Actualizá el panel antes de aprobarla.']);
        }
        foreach ($incomingDesigns as $index => $incomingDesign) {
            $savedDesign = $proposal['designs'][$index];
            if (!is_array($incomingDesign) || !is_array($savedDesign) ||
                ($incomingDesign['id'] ?? '') !== ($savedDesign['id'] ?? '') ||
                ($incomingDesign['productId'] ?? '') !== ($savedDesign['productId'] ?? '') ||
                (int)($incomingDesign['qty'] ?? 0) !== (int)($savedDesign['qty'] ?? 0)) {
                http_response_code(409);
                json_response(['ok' => false, 'error' => 'Las prendas cambiaron en otra sesión. Recargá el panel antes de aprobar.']);
            }
            if (isset($savedDesign['production']) && is_array($savedDesign['production'])) {
                $incomingDesigns[$index]['production'] = $savedDesign['production'];
            }
        }
        $proposal['designs'] = array_values($incomingDesigns);
        $customer = [];
        foreach ($state['clients'] as $client) {
            if (($client['id'] ?? '') === ($proposal['clientId'] ?? '')) {
                $customer = ['company' => (string)($client['company'] ?? ''), 'contact' => (string)($client['contact'] ?? '')];
                break;
            }
        }
        $designs = [];
        foreach ($proposal['designs'] as $design) {
            if (!is_array($design)) {
                continue;
            }
            $garment = [];
            foreach ($state['products'] as $product) {
                if (($product['id'] ?? '') === ($design['productId'] ?? '')) {
                    $garment = array_intersect_key($product, array_flip(['id', 'name', 'image', 'imageBack']));
                    break;
                }
            }
            $frozenDesign = array_intersect_key($design, array_flip([
                'id', 'productId', 'qty', 'color', 'colorHex', 'size',
                'colorSizeQuantities', 'colorQuantities', 'logos', 'note',
            ]));
            $designs[] = ['design' => $frozenDesign, 'product' => $garment];
        }
        $snapshotId = bin2hex(random_bytes(12));
        $approval = [
            'revision' => $revision,
            'approvedAt' => $approvedAt,
            'approvedBy' => $approvedBy,
            'note' => $note,
            'evidenceName' => substr($evidenceName, 0, 180),
            'evidenceData' => $evidenceData,
            'recordedBy' => (string)(current_user()['name'] ?? 'Equipo'),
            'snapshotId' => $snapshotId,
            'via' => 'staff',
            'contentHash' => hash('sha256', (string)json_encode($designs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            'ip' => client_ip(),
            'recordedAt' => date('c'),
        ];
        $snapshot = [
            'version' => 1,
            'proposalId' => $proposalId,
            'publicId' => (string)($proposal['publicId'] ?? ''),
            'title' => (string)($proposal['title'] ?? ''),
            'client' => $customer,
            'revision' => $revision,
            'approval' => array_intersect_key($approval, array_flip(['revision', 'approvedAt', 'approvedBy', 'note'])),
            'designs' => $designs,
        ];
        $dir = design_snapshot_dir();
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            http_response_code(500);
            json_response(['ok' => false, 'error' => 'No se pudo crear el archivo de versiones aprobadas']);
        }
        atomic_json_write(design_snapshot_file($snapshotId), $snapshot, 'versión aprobada');
        $proposal['artApproval'] = $approval;
        $proposal['designRevision'] = $revision;
        $proposal['updatedDate'] = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
        $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
        array_unshift($proposal['history'], [
            'id' => 'history-' . bin2hex(random_bytes(6)),
            'at' => date('c'),
            'userName' => (string)(current_user()['name'] ?? 'Equipo'),
            'action' => 'Diseño aprobado',
            'detail' => $approvedBy . ' · versión ' . $revision,
        ]);
        unset($proposal);
        $state = push_audit($state, 'Diseño aprobado', (string)$snapshot['publicId']);
        save_state($state);
        json_response(current_payload());
    }
    unset($proposal);
    http_response_code(404);
    json_response(['ok' => false, 'error' => 'No se encontró la propuesta']);
}

if ($action === 'reopen_design') {
    require_permission('proposals.manage');
    $proposalId = (string)($payload['proposalId'] ?? '');
    $state = load_state();
    foreach ($state['proposals'] as &$proposal) {
        if (($proposal['id'] ?? '') !== $proposalId) {
            continue;
        }
        if (empty($proposal['artApproval'])) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'El diseño ya está abierto']);
        }
        $proposal['approvalHistory'] = is_array($proposal['approvalHistory'] ?? null) ? $proposal['approvalHistory'] : [];
        array_unshift($proposal['approvalHistory'], array_merge($proposal['artApproval'], ['revokedAt' => date('c')]));
        $proposal['artApproval'] = null;
        if (isset($proposal['designs']) && is_array($proposal['designs'])) {
            foreach ($proposal['designs'] as &$design) {
                if (!is_array($design)) {
                    continue;
                }
                $design['production'] = is_array($design['production'] ?? null) ? $design['production'] : [];
                $design['production']['quality'] = 'Pendiente';
                $design['production']['checkedBy'] = '';
                $design['production']['checkedAt'] = '';
            }
            unset($design);
        }
        $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
        array_unshift($proposal['history'], [
            'id' => 'history-' . bin2hex(random_bytes(6)),
            'at' => date('c'),
            'userName' => (string)(current_user()['name'] ?? 'Equipo'),
            'action' => 'Aprobación de diseño reabierta',
            'detail' => 'Se requiere una nueva aprobación del cliente.',
        ]);
        $proposal['updatedDate'] = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
        unset($proposal);
        $state = push_audit($state, 'Aprobación reabierta', $proposalId);
        save_state($state);
        json_response(current_payload());
    }
    unset($proposal);
    http_response_code(404);
    json_response(['ok' => false, 'error' => 'No se encontró la propuesta']);
}

if ($action === 'get_design_snapshot') {
    require_permission('proposals.view');
    $proposalId = (string)($payload['proposalId'] ?? '');
    $snapshotId = (string)($payload['snapshotId'] ?? '');
    $state = load_state();
    $found = false;
    foreach ($state['proposals'] as $proposal) {
        if (($proposal['id'] ?? '') !== $proposalId) {
            continue;
        }
        foreach (array_merge(is_array($proposal['approvalHistory'] ?? null) ? $proposal['approvalHistory'] : [], is_array($proposal['artApproval'] ?? null) ? [$proposal['artApproval']] : []) as $approval) {
            if (($approval['snapshotId'] ?? '') === $snapshotId) {
                $found = true;
                break;
            }
        }
        break;
    }
    if (!$found || !is_file(design_snapshot_file($snapshotId))) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró la versión aprobada']);
    }
    $snapshot = json_decode((string)file_get_contents(design_snapshot_file($snapshotId)), true);
    if (!is_array($snapshot)) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'La versión aprobada no se pudo leer']);
    }
    json_response(['ok' => true, 'snapshot' => $snapshot]);
}

if ($action === 'export_design_snapshots') {
    require_permission('settings.manage');
    $snapshots = [];
    $missing = [];
    foreach (referenced_snapshot_ids(load_state()) as $id) {
        $file = design_snapshot_file($id);
        $snapshot = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
        if (is_array($snapshot)) {
            $snapshots[$id] = $snapshot;
        } else {
            $missing[] = $id;
        }
    }
    json_response(['ok' => true, 'snapshots' => $snapshots, 'missing' => $missing]);
}

if ($action === 'restore_design_snapshot') {
    require_permission('settings.manage');
    $id = (string)($payload['snapshotId'] ?? '');
    $snapshot = $payload['snapshot'] ?? null;
    $file = design_snapshot_file($id);
    if (!is_array($snapshot) || !isset($snapshot['proposalId'], $snapshot['designs'], $snapshot['revision']) ||
        !is_array($snapshot['designs']) || strlen((string)json_encode($snapshot)) > 20000000) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El archivo de versión aprobada es inválido']);
    }
    $dir = design_snapshot_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'No se pudo preparar el archivo de versiones']);
    }
    if (is_file($file)) {
        $existing = json_decode((string)file_get_contents($file), true);
        if ($existing !== $snapshot) {
            http_response_code(409);
            json_response(['ok' => false, 'error' => 'Ya existe otra versión con el mismo identificador']);
        }
    } else {
        atomic_json_write($file, $snapshot, 'versión aprobada');
    }
    json_response(['ok' => true]);
}

if ($action === 'restore_backup_state') {
    require_permission('settings.manage');
    $incoming = $payload['state'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El respaldo no contiene un estado válido']);
    }
    $current = load_state();
    $incoming = normalize_state($incoming);
    require_valid_proposal_clients($incoming, $current);
    foreach (referenced_snapshot_ids($incoming) as $id) {
        if (!is_file(design_snapshot_file($id))) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'El respaldo no incluye todas las versiones visuales aprobadas']);
        }
    }
    $incoming = push_audit($incoming, 'Respaldo restaurado', 'Se importó un respaldo completo del panel.');
    save_state($incoming);
    json_response(current_payload());
}

if ($action === 'save_changes') {
    $changes = $payload['changes'] ?? null;
    if (!is_array($changes)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Cambios invalidos']);
    }

    $allowed = [
        'products', 'clients', 'tasks', 'proposals', 'activeProposalId',
        'catalogFilter', 'editorDraft', 'settings', 'trash', 'notificationsRead',
    ];
    $current = load_state();
    $baseRevision = $payload['baseRevision'] ?? null;
    if ($baseRevision !== null && (int)$baseRevision !== (int)($current['stateRevision'] ?? 0)) {
        http_response_code(409);
        json_response(['ok' => false, 'conflict' => true, 'error' => 'Otra persona guardó cambios mientras trabajabas. Se recargaron los datos más recientes; repetí tu último cambio.']);
    }
    $incoming = $current;
    foreach ($changes as $key => $value) {
        if (in_array($key, $allowed, true)) {
            $incoming[$key] = $value;
        }
    }

    if (array_key_exists('proposals', $changes)) {
        $incoming = enforce_payment_rules($incoming, $current);
        $incoming = enforce_proposal_rules($incoming, $current);
    }
    $incoming = normalize_state($incoming);
    $incoming['auditLog'] = $current['auditLog'] ?? [];
    preserve_server_owned($incoming, $current);
    $incoming = authorize_state_save($incoming, $current);
    log_stock_diffs($incoming, $current);
    apply_stock_consumption($incoming, $current);
    require_valid_proposal_clients($incoming, $current);
    require_approved_design_integrity($incoming, $current);
    $incoming = ensure_unique_public_ids($incoming, $current);
    auto_notify_status_changes($incoming, $current);
    $summary = change_summary($incoming, $current);
    if ($summary !== 'Sin cambios relevantes') {
        $incoming = push_audit($incoming, 'Datos actualizados', $summary);
    }
    save_state($incoming);
    json_response(current_payload());
}

if ($action === 'save_state') {
    $incoming = $payload['state'] ?? null;
    if (!is_array($incoming)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Estado invalido']);
    }

    unset($incoming['users'], $incoming['roles']);
    $current = load_state();
    $incoming = enforce_payment_rules($incoming, $current);
    $incoming = enforce_proposal_rules($incoming, $current);
    $incoming = normalize_state($incoming);
    $incoming['auditLog'] = $current['auditLog'] ?? [];
    preserve_server_owned($incoming, $current);
    $incoming = authorize_state_save($incoming, $current);
    log_stock_diffs($incoming, $current);
    apply_stock_consumption($incoming, $current);
    require_valid_proposal_clients($incoming, $current);
    require_approved_design_integrity($incoming, $current);
    $incoming = ensure_unique_public_ids($incoming, $current);
    auto_notify_status_changes($incoming, $current);
    $incoming = push_audit($incoming, 'Datos actualizados', change_summary($incoming, $current));
    save_state($incoming);
    json_response(current_payload());
}


// ---- Publicación de productos en la web (la clave vive solo en el servidor) ----

function web_endpoint(string $suffix): string
{
    global $config;
    $sync = is_array($config['catalog_sync'] ?? null) ? $config['catalog_sync'] : [];
    $explicit = trim((string)($sync[$suffix . '_url'] ?? ''));
    if ($explicit !== '') {
        return $explicit;
    }
    $base = (string)preg_replace('#/catalog/?$#', '', trim((string)($sync['url'] ?? '')));
    return $base . '/' . $suffix;
}

function web_token(): string
{
    global $config;
    $sync = is_array($config['catalog_sync'] ?? null) ? $config['catalog_sync'] : [];
    return trim((string)($sync['token'] ?? ''));
}

/** @return array{0:int,1:?array,2:string,3:string} estado HTTP, JSON decodificado, texto crudo y error de conexión */
function web_json_request(string $method, string $url, string $token, ?array $body, int $timeout): array
{
    $headers = ['Accept: application/json', 'X-Uniforma-Catalog-Token: ' . $token];
    $json = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json; charset=utf-8';
    }

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => min(10, $timeout),
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        if ($json !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $json);
        }
        $raw = curl_exec($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
    } else {
        $context = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers) . "\r\n",
            'content' => $json ?? '',
            'timeout' => $timeout,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $context);
        $status = 0;
        foreach ($http_response_header ?? [] as $line) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $match)) {
                $status = (int)$match[1];
            }
        }
        $error = $raw === false ? 'No se pudo abrir la URL de la web' : '';
    }

    $text = is_string($raw) ? $raw : '';
    $decoded = json_decode($text, true);
    return [$status, is_array($decoded) ? $decoded : null, $text, $error];
}

function web_error_response(int $status, ?array $data, string $raw, string $transportError): void
{
    $message = '';
    $details = [];
    if (is_array($data)) {
        $message = (string)($data['message'] ?? $data['error'] ?? '');
        $inner = is_array($data['data'] ?? null) ? $data['data'] : [];
        $details = is_array($inner['details'] ?? null) ? $inner['details'] : [];
    }
    if ($message === '') {
        $message = $raw === ''
            ? 'No se pudo conectar con la web. ' . $transportError
            : 'La web devolvió una respuesta inesperada (HTTP ' . $status . ').';
    }
    http_response_code($status >= 400 && $status < 500 ? 422 : 502);
    json_response(['ok' => false, 'error' => $message, 'details' => $details, 'webStatus' => $status]);
}

function product_to_web_body(array $p, string $status, bool $createCategories, bool $dryRun): array
{
    $features = is_array($p['features'] ?? null) ? $p['features'] : [];
    $details = trim((string)($p['details'] ?? ''));
    if ($details === '' && $features) {
        $details = implode("\n", array_map(static fn($line): string => '- ' . trim((string)$line), $features));
    }
    $categories = is_array($p['categories'] ?? null) && $p['categories']
        ? $p['categories']
        : (trim((string)($p['category'] ?? '')) !== '' ? [(string)$p['category']] : []);
    $prices = is_array($p['prices'] ?? null) ? $p['prices'] : [];
    $price = static fn(string $qty): float => (float)($prices[$qty] ?? $prices[(int)$qty] ?? 0);
    $colors = [];
    foreach (is_array($p['colors'] ?? null) ? $p['colors'] : [] as $color) {
        $colors[] = is_array($color)
            ? ['name' => (string)($color['name'] ?? ''), 'hex' => (string)($color['hex'] ?? '')]
            : ['name' => (string)$color, 'hex' => ''];
    }
    $body = [
        'dryRun' => $dryRun,
        'wooId' => (int)($p['wooId'] ?? 0),
        'sku' => (string)($p['sku'] ?? ''),
        'name' => (string)($p['name'] ?? ''),
        'slug' => (string)($p['slug'] ?? ''),
        'status' => $status,
        'categories' => array_values($categories),
        'createCategories' => $createCategories,
        'tags' => is_array($p['tags'] ?? null) ? array_values($p['tags']) : [],
        'shortDescription' => (string)($p['shortDescription'] ?? $p['material'] ?? ''),
        'description' => (string)($p['description'] ?? ''),
        'details' => $details,
        'care' => (string)($p['care'] ?? ''),
        'sizeChart' => is_array($p['sizeChart'] ?? null) ? array_values($p['sizeChart']) : [],
        'isNew' => !empty($p['isNew']),
        'buttonPersonalize' => (string)($p['buttonPersonalize'] ?? ''),
        'buttonQuote' => (string)($p['buttonQuote'] ?? ''),
        'seoDescription' => (string)($p['seoDescription'] ?? ''),
        'prices' => ['5' => $price('5'), '10' => $price('10'), '20' => $price('20'), '50' => $price('50')],
        'colors' => $colors,
        'sizes' => is_array($p['sizeOptions'] ?? null) ? array_values($p['sizeOptions']) : [],
    ];
    if ((int)($p['minQuantity'] ?? 0) > 0) {
        $body['minQuantity'] = (int)$p['minQuantity'];
    }
    return $body;
}

/** Trae a la ficha del ERP lo que quedó guardado en la web, sin pisar lo que solo existe en el ERP. */
function merge_web_product(array $local, array $web): array
{
    $oldColorOrder = [];
    foreach (is_array($local['colors'] ?? null) ? $local['colors'] : [] as $index => $color) {
        $oldColorOrder[mb_strtolower((string)(is_array($color) ? ($color['name'] ?? '') : $color))] = $index;
    }
    $fromWeb = [
        'wooId', 'sku', 'slug', 'status', 'permalink', 'editUrl', 'modifiedAt', 'categories', 'category', 'tags',
        'colors', 'sizeOptions', 'sizes', 'prices', 'basePrice', 'shortDescription', 'material', 'description',
        'details', 'care', 'hasSizeChart', 'isNew', 'buttonPersonalize', 'buttonQuote', 'seoDescription',
        'minQuantity', 'wooType',
    ];
    foreach ($fromWeb as $key) {
        if (array_key_exists($key, $web)) {
            $local[$key] = $web[$key];
        }
    }
    if ($oldColorOrder && is_array($local['colors'] ?? null)) {
        usort($local['colors'], static function ($a, $b) use ($oldColorOrder): int {
            $left = $oldColorOrder[mb_strtolower((string)($a['name'] ?? ''))] ?? 9999;
            $right = $oldColorOrder[mb_strtolower((string)($b['name'] ?? ''))] ?? 9999;
            return $left <=> $right;
        });
    }
    foreach (['image', 'imageBack'] as $photo) {
        $candidate = (string)($web[$photo] ?? '');
        if (empty($local[$photo]) && $candidate !== '' && stripos($candidate, 'placeholder') === false) {
            $local[$photo] = $candidate;
        }
    }
    $local['source'] = 'Web';
    $local['publishedAt'] = date('c');
    return $local;
}

if ($action === 'web_taxonomies') {
    require_permission('catalog.manage');
    $token = web_token();
    if ($token === '') {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'Falta la clave de la web en config.local.php (catalog_sync > token).']);
    }
    [$httpStatus, $data, $raw, $transportError] = web_json_request('GET', web_endpoint('taxonomies'), $token, null, 25);
    if ($httpStatus !== 200 || !is_array($data) || empty($data['ok'])) {
        web_error_response($httpStatus, $data, $raw, $transportError);
    }
    json_response(['ok' => true, 'taxonomies' => $data]);
}

if ($action === 'publish_product') {
    require_permission('catalog.manage');
    $productId = (string)($payload['productId'] ?? '');
    $dryRun = !empty($payload['dryRun']);
    $statusOnly = !empty($payload['statusOnly']);
    $state = load_state();
    $index = null;
    foreach ($state['products'] as $position => $candidate) {
        if (is_array($candidate) && (string)($candidate['id'] ?? '') === $productId) {
            $index = $position;
            break;
        }
    }
    if ($index === null) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'No se encontró el producto. Guardalo primero en el ERP.']);
    }
    $product = $state['products'][$index];
    $status = (string)($payload['status'] ?? $product['status'] ?? 'publish');
    if (!in_array($status, ['publish', 'draft', 'pending', 'private'], true)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El estado tiene que ser Publicado, Borrador, Pendiente o Privado.']);
    }
    $token = web_token();
    if ($token === '') {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'Falta la clave de la web en config.local.php (catalog_sync > token).']);
    }
    if ($statusOnly) {
        if ((int)($product['wooId'] ?? 0) <= 0) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'Este producto todavía no está en la web: publicalo primero.']);
        }
        $body = ['statusOnly' => true, 'wooId' => (int)$product['wooId'], 'status' => $status, 'dryRun' => $dryRun];
    } else {
        $body = product_to_web_body($product, $status, !empty($payload['createCategories']), $dryRun);
    }

    [$httpStatus, $data, $raw, $transportError] = web_json_request('POST', web_endpoint('product'), $token, $body, 150);
    if ($httpStatus >= 400 || !is_array($data) || empty($data['ok'])) {
        web_error_response($httpStatus, $data, $raw, $transportError);
    }

    $summary = $data;
    unset($summary['product']);
    if ($dryRun) {
        json_response(['ok' => true, 'dryRun' => true, 'result' => $summary]);
    }

    if (is_array($data['product'] ?? null)) {
        $state['products'][$index] = merge_web_product($product, $data['product']);
    }
    $label = [
        'publish' => 'publicado', 'draft' => 'como borrador', 'pending' => 'pendiente de revisión', 'private' => 'privado',
    ][$status];
    $state = push_audit(
        $state,
        $statusOnly ? 'Estado del producto en la web' : (!empty($data['created']) ? 'Producto creado en la web' : 'Producto actualizado en la web'),
        (string)($product['name'] ?? $productId) . ' · ' . $label
    );
    save_state($state);
    $response = current_payload();
    $response['publish'] = $summary;
    json_response($response);
}

if ($action === 'sync_catalog') {
    require_permission('catalog.manage');
    $products = fetch_web_catalog();
    $state = load_state();
    $previousById = [];
    $previousBySku = [];
    $previousByWoo = [];
    foreach ($state['products'] as $old) {
        if (!is_array($old)) {
            continue;
        }
        $previousById[(string)($old['id'] ?? '')] = $old;
        if (!empty($old['sku'])) {
            $previousBySku[(string)$old['sku']] = $old;
        }
        if (!empty($old['wooId'])) {
            $previousByWoo[(string)$old['wooId']] = $old;
        }
    }
    foreach ($products as &$incomingProduct) {
        if (!is_array($incomingProduct)) {
            continue;
        }
        $old = $previousByWoo[(string)($incomingProduct['wooId'] ?? '')]
            ?? $previousById[(string)($incomingProduct['id'] ?? '')]
            ?? $previousBySku[(string)($incomingProduct['sku'] ?? '')]
            ?? null;
        if (is_array($old)) {
            // Un producto cargado en el ERP y publicado después conserva su identificador del ERP,
            // para no perder las propuestas y el stock que ya lo usan.
            if (!empty($old['id']) && $old['id'] !== ($incomingProduct['id'] ?? '')) {
                $incomingProduct['id'] = $old['id'];
            }
            foreach (['unitCost', 'stockVariants', 'methods', 'features', 'sizeChart'] as $localField) {
                if (array_key_exists($localField, $old)) {
                    $incomingProduct[$localField] = $old[$localField];
                }
            }
            // El color elegido en el ERP no se pisa con el gris de respaldo de la web.
            $oldHex = [];
            foreach (is_array($old['colors'] ?? null) ? $old['colors'] : [] as $oldColor) {
                if (is_array($oldColor) && !empty($oldColor['hex'])) {
                    $oldHex[mb_strtolower((string)($oldColor['name'] ?? ''))] = (string)$oldColor['hex'];
                }
            }
            if (is_array($incomingProduct['colors'] ?? null)) {
                foreach ($incomingProduct['colors'] as &$webColor) {
                    $key = mb_strtolower((string)($webColor['name'] ?? ''));
                    if (is_array($webColor) && ($webColor['hex'] ?? '') === '#d8d1c7' && isset($oldHex[$key])) {
                        $webColor['hex'] = $oldHex[$key];
                    }
                }
                unset($webColor);
            }
        }
    }
    unset($incomingProduct);
    foreach ($state['products'] as $old) {
        $id = (string)($old['id'] ?? '');
        if (($old['source'] ?? '') === 'Manual' || str_starts_with($id, 'product-')) {
            if (!in_array($id, array_column($products, 'id'), true)) {
                $products[] = $old;
            }
        }
    }
    $state['products'] = array_values($products);
    $state['catalogSyncedAt'] = date('c');
    $state = push_audit($state, 'Catálogo sincronizado', count($products) . ' productos importados desde la web.');
    save_state($state);
    json_response(current_payload());
}

if ($action === 'review_payments') {
    require_permission('payments.validate');
    $decision = (string)($payload['decision'] ?? '');
    $note = trim((string)($payload['note'] ?? ''));
    $items = is_array($payload['items'] ?? null) ? array_slice($payload['items'], 0, 100) : [];
    if (!in_array($decision, ['validated', 'rejected', 'void'], true) || !$items) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Elegí al menos un pago y una decisión válida.']);
    }
    if (in_array($decision, ['rejected', 'void'], true) && mb_strlen($note) < 3) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Escribí el motivo (mínimo 3 caracteres).']);
    }
    $note = mb_substr($note, 0, 300);
    $state = load_state();
    $user = current_user();
    $who = (string)($user['name'] ?? 'Administración');
    $done = 0;
    $skipped = 0;
    $blocked = 0;
    $total = 0.0;
    $labels = ['validated' => 'Pago validado', 'rejected' => 'Pago rechazado', 'void' => 'Pago anulado'];
    foreach ($items as $item) {
        $proposalId = (string)($item['proposalId'] ?? '');
        $paymentId = (string)($item['paymentId'] ?? '');
        $found = false;
        foreach ($state['proposals'] as &$proposal) {
            if (($proposal['id'] ?? '') !== $proposalId) {
                continue;
            }
            if (!is_array($proposal['payments'] ?? null)) {
                break;
            }
            foreach ($proposal['payments'] as &$pay) {
                if (($pay['id'] ?? '') !== $paymentId) {
                    continue;
                }
                $found = true;
                $status = payment_status_of($pay);
                $allowed = $decision === 'void' ? $status === 'validated' : $status === 'pending';
                if (!$allowed) {
                    $skipped++;
                    break 2;
                }
                if (!empty($state['settings']['separateDuties']) && $decision === 'validated' && ($pay['registeredById'] ?? '') !== '' && ($pay['registeredById'] ?? '') === (string)($user['id'] ?? '')) {
                    $blocked++;
                    break 2;
                }
                if ($decision === 'validated') {
                    $pay['status'] = 'validated';
                    $pay['validatedBy'] = $who;
                    $pay['validatedAt'] = date('c');
                    $pay['reviewNote'] = $note;
                } elseif ($decision === 'rejected') {
                    $pay['status'] = 'rejected';
                    $pay['validatedBy'] = $who;
                    $pay['validatedAt'] = date('c');
                    $pay['reviewNote'] = $note;
                } else {
                    $pay['status'] = 'voided';
                    $pay['voidedBy'] = $who;
                    $pay['voidedAt'] = date('c');
                    $pay['reviewNote'] = $note;
                }
                $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
                array_unshift($proposal['history'], [
                    'id' => 'history-' . bin2hex(random_bytes(6)),
                    'at' => date('c'),
                    'userName' => $who,
                    'action' => $labels[$decision],
                    'detail' => (string)($pay['type'] ?? 'Pago') . ' · $' . number_format((float)($pay['amount'] ?? 0), 0, ',', '.') . ' · ' . (string)($pay['method'] ?? '') . ($note !== '' ? ' · ' . $note : ''),
                ]);
                $proposal['updatedDate'] = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
                $total += (float)($pay['amount'] ?? 0);
                $done++;
                break 2;
            }
            unset($pay);
        }
        unset($proposal);
        if (!$found) {
            $skipped++;
        }
    }
    if ($done > 0) {
        $state = push_audit($state, $labels[$decision], $done . ' pago(s) · $' . number_format($total, 0, ',', '.') . ($note !== '' ? ' · ' . $note : ''));
        save_state($state);
    }
    $response = current_payload();
    $response['review'] = ['done' => $done, 'skipped' => $skipped, 'blocked' => $blocked];
    json_response($response);
}

if ($action === 'tracking_link') {
    require_permission('proposals.manage');
    $proposalId = (string)($payload['proposalId'] ?? '');
    $op = (string)($payload['op'] ?? 'create');
    $state = load_state();
    $done = false;
    foreach ($state['proposals'] as &$proposal) {
        if (($proposal['id'] ?? '') !== $proposalId) {
            continue;
        }
        if ($op === 'revoke') {
            $proposal['publicToken'] = '';
            $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
            array_unshift($proposal['history'], history_entry((string)(current_user()['name'] ?? 'Equipo'), 'Link del cliente desactivado', ''));
        } elseif (empty($proposal['publicToken']) || $op === 'regenerate') {
            $proposal['publicToken'] = bin2hex(random_bytes(16));
            $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
            array_unshift($proposal['history'], history_entry((string)(current_user()['name'] ?? 'Equipo'), $op === 'regenerate' ? 'Link del cliente renovado' : 'Link del cliente creado', ''));
        }
        $done = true;
        break;
    }
    unset($proposal);
    if (!$done) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró la propuesta']);
    }
    $state = push_audit($state, 'Link del cliente', $op . ' · ' . $proposalId);
    save_state($state);
    json_response(current_payload());
}

if ($action === 'add_client_logo') {
    if (!can_user(current_user(), 'editor.use') && !can_user(current_user(), 'clients.manage')) {
        http_response_code(403);
        json_response(['ok' => false, 'error' => 'No tenés permisos para guardar logos.']);
    }
    $clientId = (string)($payload['clientId'] ?? '');
    $name = trim(mb_substr((string)($payload['name'] ?? 'Logo'), 0, 120)) ?: 'Logo';
    $data = (string)($payload['dataUrl'] ?? '');
    if (strlen($data) > 2800000 || !preg_match('~^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$~', $data)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El logo es inválido o supera los 2 MB.']);
    }
    $state = load_state();
    $found = false;
    foreach ($state['clients'] as &$client) {
        if (($client['id'] ?? '') !== $clientId) {
            continue;
        }
        $client['logos'] = is_array($client['logos'] ?? null) ? $client['logos'] : [];
        if (count($client['logos']) >= 15) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'El cliente ya tiene 15 logos guardados. Borrá alguno antes de agregar otro.']);
        }
        $client['logos'][] = ['id' => 'logo-' . bin2hex(random_bytes(5)), 'name' => $name, 'src' => $data, 'addedFrom' => 'estudio', 'addedAt' => date('c')];
        $found = true;
        break;
    }
    unset($client);
    if (!$found) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró el cliente.']);
    }
    $state = push_audit($state, 'Logo guardado desde el Estudio', $name . ' → ' . $clientId);
    save_state($state);
    json_response(current_payload());
}

if ($action === 'stock_entry') {
    require_permission('catalog.manage');
    $productId = (string)($payload['productId'] ?? '');
    $rows = is_array($payload['rows'] ?? null) ? array_slice($payload['rows'], 0, 400) : [];
    $note = mb_substr(trim((string)($payload['note'] ?? '')), 0, 200);
    $state = load_state();
    $moves = [];
    $found = false;
    foreach ($state['products'] as &$prod) {
        if (($prod['id'] ?? '') !== $productId) {
            continue;
        }
        $found = true;
        $prod['stockVariants'] = is_array($prod['stockVariants'] ?? null) ? $prod['stockVariants'] : [];
        foreach ($rows as $r) {
            $color = trim((string)($r['color'] ?? ''));
            $size = trim((string)($r['size'] ?? ''));
            $qty = (int)floor((float)($r['qty'] ?? 0));
            if ($color === '' || $size === '' || $qty <= 0 || $qty > 100000) {
                continue;
            }
            $hit = false;
            foreach ($prod['stockVariants'] as &$v) {
                if ($v['color'] === $color && $v['size'] === $size) {
                    $v['qty'] = (int)$v['qty'] + $qty;
                    $hit = true;
                    break;
                }
            }
            unset($v);
            if (!$hit) {
                $prod['stockVariants'][] = ['color' => $color, 'size' => $size, 'qty' => $qty];
            }
            $moves[] = stock_movement($productId, (string)($prod['name'] ?? ''), $color, $size, $qty, 'Ingreso', $note);
        }
        break;
    }
    unset($prod);
    if (!$found || !$moves) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => $found ? 'Cargá al menos una cantidad mayor a cero.' : 'No se encontró el producto.']);
    }
    push_stock_movements($state, $moves);
    $state = push_audit($state, 'Ingreso de mercadería', count($moves) . ' variante(s) · ' . $productId . ($note !== '' ? ' · ' . $note : ''));
    save_state($state);
    json_response(current_payload());
}

if ($action === 'close_cash') {
    require_permission('payments.validate');
    $date = (string)($payload['date'] ?? '');
    $parts = explode('-', $date);
    if (count($parts) !== 3 || !checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Elegí una fecha válida.']);
    }
    $counted = [];
    foreach (is_array($payload['counted'] ?? null) ? $payload['counted'] : [] as $method => $value) {
        if (is_numeric($value) && (float)$value >= 0) {
            $counted[mb_substr((string)$method, 0, 40)] = round((float)$value, 2);
        }
    }
    $state = load_state();
    $expected = cash_expected_for($state, $date);
    $diff = [];
    foreach (array_unique(array_merge(array_keys($expected), array_keys($counted))) as $m) {
        $diff[$m] = round((float)($counted[$m] ?? 0) - (float)($expected[$m] ?? 0), 2);
    }
    $row = [
        'id' => 'cash-' . bin2hex(random_bytes(5)), 'date' => $date, 'expected' => $expected, 'counted' => $counted, 'diff' => $diff,
        'note' => mb_substr(trim((string)($payload['note'] ?? '')), 0, 300),
        'closedBy' => (string)(current_user()['name'] ?? 'Administración'), 'closedAt' => date('c'),
    ];
    $list = is_array($state['cashClosings'] ?? null) ? $state['cashClosings'] : [];
    array_unshift($list, $row);
    $state['cashClosings'] = array_slice($list, 0, 800);
    $state = push_audit($state, 'Caja cerrada', $date . ' · diferencia $' . number_format(array_sum($diff), 0, ',', '.'));
    save_state($state);
    json_response(current_payload());
}

if ($action === 'send_proposal_email') {
    require_permission('proposals.manage');
    $proposalId = (string)($payload['proposalId'] ?? '');
    $subject = mb_substr(trim((string)($payload['subject'] ?? '')), 0, 150);
    $body = mb_substr(trim((string)($payload['body'] ?? '')), 0, 4000);
    $label = mb_substr((string)($payload['label'] ?? ''), 0, 80);
    if ($subject === '' || $body === '') {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Falta el asunto o el mensaje.']);
    }
    $state = load_state();
    $index = null;
    foreach ($state['proposals'] as $i => $p) {
        if (($p['id'] ?? '') === $proposalId) {
            $index = $i;
            break;
        }
    }
    if ($index === null) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró la propuesta.']);
    }
    $email = '';
    foreach ($state['clients'] as $c) {
        if (($c['id'] ?? '') === ($state['proposals'][$index]['clientId'] ?? '')) {
            $email = (string)($c['email'] ?? '');
        }
    }
    $company = (string)($state['settings']['companyName'] ?? 'UNIFORMA');
    $result = send_plain_mail($email, $subject, $body . "\n\n—\n" . $company, 'propuesta ' . (string)($state['proposals'][$index]['publicId'] ?? ''));
    if ($result['ok']) {
        $state['proposals'][$index]['history'] = is_array($state['proposals'][$index]['history'] ?? null) ? $state['proposals'][$index]['history'] : [];
        array_unshift($state['proposals'][$index]['history'], history_entry((string)(current_user()['name'] ?? 'Equipo'), 'Correo enviado', $label . ' · ' . $email . ($result['mode'] === 'test' ? ' (modo prueba)' : '')));
        $state = push_audit($state, 'Correo enviado', (string)($state['proposals'][$index]['publicId'] ?? '') . ' · ' . $label);
        save_state($state);
    }
    $response = $result['ok'] ? current_payload() : ['ok' => false, 'error' => $result['error']];
    $response['mail'] = $result;
    if (!$result['ok']) {
        http_response_code(502);
    }
    json_response($response);
}

if ($action === 'save_prefs') {
    $prefs = $payload['prefs'] ?? null;
    if (!is_array($prefs) || strlen((string)json_encode($prefs)) > 30000) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Preferencias inválidas.']);
    }
    $users = load_users();
    $me = (string)(current_user()['id'] ?? '');
    foreach ($users as &$u) {
        if (($u['id'] ?? '') === $me) {
            $u['prefs'] = $prefs;
        }
    }
    unset($u);
    save_users($users);
    json_response(current_payload());
}

/* ======== Consultas de la web ======== */
if ($action === 'lead_update') {
    require_permission('proposals.manage');
    $id = (string)($payload['id'] ?? '');
    $status = (string)($payload['status'] ?? '');
    if (!in_array($status, ['Nuevo', 'Contactado', 'Convertido', 'Descartado'], true)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Estado inválido.']);
    }
    $state = load_state();
    $found = false;
    foreach ($state['leads'] as &$lead) {
        if (($lead['id'] ?? '') !== $id) {
            continue;
        }
        $lead['status'] = $status;
        $lead['note'] = clean_text($payload['note'] ?? ($lead['note'] ?? ''), 300);
        if (!empty($payload['proposalId'])) {
            $lead['proposalId'] = clean_text($payload['proposalId'], 80);
        }
        $lead['updatedBy'] = (string)(current_user()['name'] ?? '');
        $lead['updatedAt'] = date('c');
        $found = true;
        break;
    }
    unset($lead);
    if (!$found) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'No se encontró la consulta.']);
    }
    $state = push_audit($state, 'Consulta ' . strtolower($status), $id);
    save_state($state);
    json_response(current_payload());
}

/* ======== Compras, insumos y talleres externos ======== */
if (in_array($action, ['supplier_save', 'supplier_delete', 'supply_save', 'supply_move', 'po_save', 'po_receive', 'po_payment', 'po_payment_delete', 'po_cancel', 'wo_save', 'wo_status', 'wo_pay', 'wo_delete'], true)) {
    require_permission('purchases.manage');
    $state = load_state();
    $who = (string)(current_user()['name'] ?? 'Equipo');
    $fail = static function (string $msg, int $code = 422): void {
        http_response_code($code);
        json_response(['ok' => false, 'error' => $msg]);
    };
    $findIndex = static function (array $list, string $id): ?int {
        foreach ($list as $i => $row) {
            if (($row['id'] ?? '') === $id) {
                return (int)$i;
            }
        }
        return null;
    };
    $audit = '';

    if ($action === 'supplier_save') {
        $s = is_array($payload['supplier'] ?? null) ? $payload['supplier'] : [];
        $name = clean_text($s['name'] ?? '', 120);
        $type = (string)($s['type'] ?? 'prendas');
        if ($name === '') {
            $fail('El proveedor necesita un nombre.');
        }
        $row = ['id' => clean_text($s['id'] ?? '', 40), 'name' => $name, 'type' => in_array($type, ['prendas', 'insumos', 'taller', 'otro'], true) ? $type : 'otro',
            'contact' => clean_text($s['contact'] ?? '', 120), 'phone' => clean_text($s['phone'] ?? '', 60), 'email' => clean_text($s['email'] ?? '', 120), 'cuit' => clean_text($s['cuit'] ?? '', 30), 'note' => clean_text($s['note'] ?? '', 300)];
        $i = $row['id'] !== '' ? $findIndex($state['suppliers'], $row['id']) : null;
        if ($i === null) {
            $row['id'] = new_id('sup');
            $row['createdAt'] = date('c');
            array_unshift($state['suppliers'], $row);
        } else {
            $state['suppliers'][$i] = array_merge($state['suppliers'][$i], $row);
        }
        $audit = 'Proveedor guardado: ' . $name;
    } elseif ($action === 'supplier_delete') {
        $id = (string)($payload['id'] ?? '');
        foreach (array_merge($state['purchaseOrders'], $state['workOrders']) as $r) {
            if (($r['supplierId'] ?? $r['vendorId'] ?? '') === $id) {
                $fail('No se puede borrar: tiene órdenes asociadas.');
            }
        }
        $state['suppliers'] = array_values(array_filter($state['suppliers'], static fn($r) => ($r['id'] ?? '') !== $id));
        $audit = 'Proveedor eliminado: ' . $id;
    } elseif ($action === 'supply_save') {
        $s = is_array($payload['supply'] ?? null) ? $payload['supply'] : [];
        $name = clean_text($s['name'] ?? '', 120);
        if ($name === '') {
            $fail('El insumo necesita un nombre.');
        }
        $row = ['id' => clean_text($s['id'] ?? '', 40), 'name' => $name, 'unit' => clean_text($s['unit'] ?? 'u', 20) ?: 'u', 'min' => max(0, (float)($s['min'] ?? 0)), 'cost' => max(0, (float)($s['cost'] ?? 0)), 'note' => clean_text($s['note'] ?? '', 200)];
        $i = $row['id'] !== '' ? $findIndex($state['supplies'], $row['id']) : null;
        if ($i === null) {
            $row['id'] = new_id('ins');
            $row['stock'] = max(0, (float)($s['stock'] ?? 0));
            array_unshift($state['supplies'], $row);
            if ($row['stock'] > 0) {
                array_unshift($state['supplyMovements'], ['id' => new_id('smv'), 'at' => date('c'), 'supplyId' => $row['id'], 'name' => $name, 'qty' => $row['stock'], 'reason' => 'Stock inicial', 'note' => '', 'userName' => $who]);
            }
        } else {
            $state['supplies'][$i] = array_merge($state['supplies'][$i], $row);
        }
        $audit = 'Insumo guardado: ' . $name;
    } elseif ($action === 'supply_move') {
        $i = $findIndex($state['supplies'], (string)($payload['id'] ?? ''));
        $qty = (float)($payload['qty'] ?? 0);
        if ($i === null || !is_finite($qty) || $qty == 0.0 || abs($qty) > 1e7) {
            $fail('Elegí un insumo y una cantidad distinta de cero.');
        }
        $new = (float)$state['supplies'][$i]['stock'] + $qty;
        if ($new < -0.0001) {
            $fail('El stock no puede quedar negativo.');
        }
        $state['supplies'][$i]['stock'] = round($new, 3);
        $reason = in_array((string)($payload['reason'] ?? ''), ['Ingreso', 'Consumo', 'Ajuste'], true) ? (string)$payload['reason'] : 'Ajuste';
        array_unshift($state['supplyMovements'], ['id' => new_id('smv'), 'at' => date('c'), 'supplyId' => $state['supplies'][$i]['id'], 'name' => $state['supplies'][$i]['name'], 'qty' => $qty, 'reason' => $reason, 'note' => clean_text($payload['note'] ?? '', 200), 'userName' => $who]);
        $audit = 'Movimiento de insumo: ' . $state['supplies'][$i]['name'] . ' ' . $qty;
    } elseif ($action === 'po_save') {
        $o = is_array($payload['po'] ?? null) ? $payload['po'] : [];
        $supplierId = (string)($o['supplierId'] ?? '');
        if ($findIndex($state['suppliers'], $supplierId) === null) {
            $fail('Elegí un proveedor.');
        }
        $items = [];
        foreach (is_array($o['items'] ?? null) ? array_slice($o['items'], 0, 120) : [] as $it) {
            $qty = (int)floor((float)($it['qty'] ?? 0));
            if ($qty <= 0) {
                continue;
            }
            $kind = ($it['kind'] ?? '') === 'insumo' ? 'insumo' : 'prenda';
            $items[] = ['kind' => $kind, 'productId' => clean_text($it['productId'] ?? '', 60), 'supplyId' => clean_text($it['supplyId'] ?? '', 60), 'name' => clean_text($it['name'] ?? '', 160), 'color' => clean_text($it['color'] ?? '', 60), 'size' => clean_text($it['size'] ?? '', 40), 'qty' => $qty, 'unitCost' => clean_money($it['unitCost'] ?? 0), 'received' => max(0, min($qty, (int)($it['received'] ?? 0)))];
        }
        if (!$items) {
            $fail('Agregá al menos un renglón con cantidad.');
        }
        $id = clean_text($o['id'] ?? '', 40);
        $i = $id !== '' ? $findIndex($state['purchaseOrders'], $id) : null;
        if ($i !== null && in_array($state['purchaseOrders'][$i]['status'], ['Recibida', 'Cancelada'], true)) {
            $fail('Una orden recibida o cancelada no se edita.');
        }
        if ($i !== null) {
            // las cantidades ya recibidas no se pueden perder
            foreach ($state['purchaseOrders'][$i]['items'] as $k => $old) {
                if (isset($items[$k])) {
                    $items[$k]['received'] = (int)($old['received'] ?? 0);
                    $items[$k]['qty'] = max($items[$k]['qty'], $items[$k]['received']);
                }
            }
        }
        $total = 0.0;
        foreach ($items as $it) {
            $total += $it['qty'] * $it['unitCost'];
        }
        $statusIn = (string)($o['status'] ?? 'Borrador');
        $row = ['supplierId' => $supplierId, 'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($o['date'] ?? '')) ? $o['date'] : ar_today(), 'expectedDate' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($o['expectedDate'] ?? '')) ? $o['expectedDate'] : '', 'items' => $items, 'total' => round($total, 2), 'note' => clean_text($o['note'] ?? '', 300)];
        if ($i === null) {
            $max = 0;
            foreach ($state['purchaseOrders'] as $po) {
                $max = max($max, (int)preg_replace('/\D/', '', (string)($po['number'] ?? '')));
            }
            $row += ['id' => new_id('po'), 'number' => 'OC-' . str_pad((string)($max + 1), 4, '0', STR_PAD_LEFT), 'status' => $statusIn === 'Pedida' ? 'Pedida' : 'Borrador', 'payments' => [], 'createdBy' => $who, 'createdAt' => date('c')];
            array_unshift($state['purchaseOrders'], $row);
            $audit = 'Orden de compra creada: ' . $row['number'];
        } else {
            $old = $state['purchaseOrders'][$i];
            $row['status'] = ($old['status'] === 'Borrador' && $statusIn === 'Pedida') ? 'Pedida' : $old['status'];
            $state['purchaseOrders'][$i] = array_merge($old, $row);
            $audit = 'Orden de compra editada: ' . ($old['number'] ?? '');
        }
    } elseif ($action === 'po_receive') {
        $i = $findIndex($state['purchaseOrders'], (string)($payload['id'] ?? ''));
        if ($i === null) {
            $fail('No se encontró la orden.', 404);
        }
        $po = &$state['purchaseOrders'][$i];
        if (in_array($po['status'], ['Cancelada', 'Recibida'], true)) {
            $fail('Esta orden ya está cerrada.');
        }
        $lines = is_array($payload['lines'] ?? null) ? $payload['lines'] : [];
        $update = !empty($payload['updateCost']);
        $moves = [];
        $took = 0;
        foreach ($lines as $ln) {
            $k = (int)($ln['index'] ?? -1);
            if (!isset($po['items'][$k])) {
                continue;
            }
            $it = &$po['items'][$k];
            $take = min(max(0, (int)floor((float)($ln['qty'] ?? 0))), (int)$it['qty'] - (int)$it['received']);
            if ($take <= 0) {
                unset($it);
                continue;
            }
            if ($it['kind'] === 'insumo') {
                $si = $findIndex($state['supplies'], (string)$it['supplyId']);
                if ($si !== null) {
                    $state['supplies'][$si]['stock'] = round((float)$state['supplies'][$si]['stock'] + $take, 3);
                    if ($update && $it['unitCost'] > 0) {
                        $state['supplies'][$si]['cost'] = $it['unitCost'];
                    }
                    array_unshift($state['supplyMovements'], ['id' => new_id('smv'), 'at' => date('c'), 'supplyId' => $state['supplies'][$si]['id'], 'name' => $state['supplies'][$si]['name'], 'qty' => $take, 'reason' => 'Ingreso', 'note' => 'OC ' . $po['number'], 'userName' => $who]);
                }
            } else {
                foreach ($state['products'] as &$prod) {
                    if (($prod['id'] ?? '') !== $it['productId']) {
                        continue;
                    }
                    $prod['stockVariants'] = is_array($prod['stockVariants'] ?? null) ? $prod['stockVariants'] : [];
                    $hit = false;
                    foreach ($prod['stockVariants'] as &$v) {
                        if ($v['color'] === $it['color'] && $v['size'] === $it['size']) {
                            $v['qty'] = (int)$v['qty'] + $take;
                            $hit = true;
                            break;
                        }
                    }
                    unset($v);
                    if (!$hit && $it['color'] !== '' && $it['size'] !== '') {
                        $prod['stockVariants'][] = ['color' => $it['color'], 'size' => $it['size'], 'qty' => $take];
                    }
                    if ($update && $it['unitCost'] > 0) {
                        $prod['unitCost'] = $it['unitCost'];
                    }
                    $moves[] = stock_movement((string)$prod['id'], (string)($prod['name'] ?? ''), $it['color'], $it['size'], $take, 'Ingreso', 'OC ' . $po['number'], $po['number']);
                    break;
                }
                unset($prod);
            }
            $it['received'] = (int)$it['received'] + $take;
            $took += $take;
            unset($it);
        }
        if ($took <= 0) {
            unset($po);
            $fail('Indicá cantidades recibidas mayores a cero (no pueden superar lo pedido).');
        }
        $all = true;
        foreach ($po['items'] as $it) {
            if ((int)$it['received'] < (int)$it['qty']) {
                $all = false;
            }
        }
        $po['status'] = $all ? 'Recibida' : 'Recibida parcial';
        $po['receivedAt'] = date('c');
        $number = $po['number'];
        unset($po);
        push_stock_movements($state, $moves);
        $audit = 'Recepción de ' . $number . ': ' . $took . ' unidad(es)';
    } elseif ($action === 'po_cancel') {
        $i = $findIndex($state['purchaseOrders'], (string)($payload['id'] ?? ''));
        if ($i === null) {
            $fail('No se encontró la orden.', 404);
        }
        foreach ($state['purchaseOrders'][$i]['items'] as $it) {
            if ((int)$it['received'] > 0) {
                $fail('No se puede cancelar: ya se recibió mercadería.');
            }
        }
        $state['purchaseOrders'][$i]['status'] = 'Cancelada';
        $audit = 'Orden cancelada: ' . $state['purchaseOrders'][$i]['number'];
    } elseif ($action === 'po_payment' || $action === 'po_payment_delete') {
        $i = $findIndex($state['purchaseOrders'], (string)($payload['id'] ?? ''));
        if ($i === null) {
            $fail('No se encontró la orden.', 404);
        }
        if ($action === 'po_payment') {
            $amount = clean_money($payload['amount'] ?? 0);
            if ($amount <= 0) {
                $fail('Ingresá un monto válido.');
            }
            $state['purchaseOrders'][$i]['payments'][] = ['id' => new_id('pp'), 'amount' => $amount, 'method' => clean_text($payload['method'] ?? 'Transferencia', 40), 'date' => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($payload['date'] ?? '')) ? $payload['date'] : ar_today(), 'note' => clean_text($payload['note'] ?? '', 200), 'by' => $who, 'at' => date('c')];
            $audit = 'Pago a proveedor: ' . $state['purchaseOrders'][$i]['number'] . ' $' . $amount;
        } else {
            $pid = (string)($payload['paymentId'] ?? '');
            $state['purchaseOrders'][$i]['payments'] = array_values(array_filter($state['purchaseOrders'][$i]['payments'], static fn($r) => ($r['id'] ?? '') !== $pid));
            $audit = 'Pago a proveedor eliminado: ' . $state['purchaseOrders'][$i]['number'];
        }
    } elseif ($action === 'wo_save') {
        $w = is_array($payload['wo'] ?? null) ? $payload['wo'] : [];
        $vendorId = (string)($w['vendorId'] ?? '');
        if ($findIndex($state['suppliers'], $vendorId) === null) {
            $fail('Elegí el taller o proveedor.');
        }
        $qty = (int)floor((float)($w['qty'] ?? 0));
        if ($qty <= 0) {
            $fail('Indicá la cantidad de prendas.');
        }
        $date = static fn($v) => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$v) ? (string)$v : '';
        $row = ['proposalId' => clean_text($w['proposalId'] ?? '', 80), 'vendorId' => $vendorId, 'service' => clean_text($w['service'] ?? 'Bordado', 60), 'qty' => $qty, 'unitCost' => clean_money($w['unitCost'] ?? 0), 'sentDate' => $date($w['sentDate'] ?? '') ?: ar_today(), 'dueDate' => $date($w['dueDate'] ?? ''), 'note' => clean_text($w['note'] ?? '', 300)];
        $id = clean_text($w['id'] ?? '', 40);
        $i = $id !== '' ? $findIndex($state['workOrders'], $id) : null;
        if ($i === null) {
            $max = 0;
            foreach ($state['workOrders'] as $r) {
                $max = max($max, (int)preg_replace('/\D/', '', (string)($r['number'] ?? '')));
            }
            $row += ['id' => new_id('wo'), 'number' => 'OT-' . str_pad((string)($max + 1), 4, '0', STR_PAD_LEFT), 'status' => 'Enviado', 'paid' => 0, 'createdBy' => $who, 'createdAt' => date('c')];
            array_unshift($state['workOrders'], $row);
            $audit = 'Orden de trabajo creada: ' . $row['number'];
        } else {
            $state['workOrders'][$i] = array_merge($state['workOrders'][$i], $row);
            $audit = 'Orden de trabajo editada: ' . ($state['workOrders'][$i]['number'] ?? '');
        }
    } elseif ($action === 'wo_status') {
        $i = $findIndex($state['workOrders'], (string)($payload['id'] ?? ''));
        $st = (string)($payload['status'] ?? '');
        if ($i === null || !in_array($st, ['Enviado', 'En proceso', 'Recibido', 'Con problema'], true)) {
            $fail('Orden o estado inválido.');
        }
        $state['workOrders'][$i]['status'] = $st;
        if ($st === 'Recibido') {
            $state['workOrders'][$i]['receivedDate'] = ar_today();
        }
        if (!empty($payload['note'])) {
            $state['workOrders'][$i]['note'] = clean_text($payload['note'], 300);
        }
        $audit = 'Orden de trabajo ' . ($state['workOrders'][$i]['number'] ?? '') . ': ' . $st;
    } elseif ($action === 'wo_pay') {
        $i = $findIndex($state['workOrders'], (string)($payload['id'] ?? ''));
        $amount = clean_money($payload['amount'] ?? 0);
        if ($i === null || $amount <= 0) {
            $fail('Orden o monto inválido.');
        }
        $state['workOrders'][$i]['paid'] = round((float)($state['workOrders'][$i]['paid'] ?? 0) + $amount, 2);
        $audit = 'Pago a taller ' . ($state['workOrders'][$i]['number'] ?? '') . ': $' . $amount;
    } elseif ($action === 'wo_delete') {
        $state['workOrders'] = array_values(array_filter($state['workOrders'], static fn($r) => ($r['id'] ?? '') !== (string)($payload['id'] ?? '')));
        $audit = 'Orden de trabajo eliminada';
    }
    foreach (server_owned_caps() as $k => $cap) {
        $state[$k] = array_slice(array_values($state[$k]), 0, $cap);
    }
    $state = push_audit($state, 'Compras', $audit);
    save_state($state);
    json_response(current_payload());
}

/* ======== Cuenta propia: contraseña y verificación en dos pasos ======== */
if ($action === 'mail_test') {
    require_permission('settings.manage');
    $to = clean_text($payload['email'] ?? '', 120);
    $r = send_plain_mail($to, 'Prueba de correo de UNIFORMA', "Hola,\n\nSi recibiste este mensaje, el envío de correos del panel funciona.\n\n— UNIFORMA", 'prueba');
    if (!$r['ok']) {
        http_response_code(502);
    }
    json_response($r + ['mailMode' => mail_settings()['mode']]);
}

if ($action === 'change_password') {
    $users = load_users();
    $me = (string)(current_user()['id'] ?? '');
    $new = (string)($payload['new'] ?? '');
    $changed = false;
    foreach ($users as &$u) {
        if (($u['id'] ?? '') !== $me) {
            continue;
        }
        if (!verify_user_password($u, (string)($payload['current'] ?? ''))) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'La contraseña actual no es correcta.']);
        }
        if (strlen($new) < 10) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'La nueva contraseña debe tener al menos 10 caracteres.']);
        }
        $u['password_hash'] = password_hash($new, PASSWORD_DEFAULT);
        unset($u['password_sha256']);
        $changed = true;
    }
    unset($u);
    if ($changed) {
        save_users($users);
        save_state(push_audit(load_state(), 'Contraseña cambiada', (string)(current_user()['name'] ?? '')));
    }
    json_response(current_payload());
}

if ($action === 'totp_begin') {
    $secret = base32_encode_str(random_bytes(20));
    $_SESSION['totp_pending'] = $secret;
    $uname = (string)(current_user()['username'] ?? 'usuario');
    json_response(['ok' => true, 'secret' => $secret, 'uri' => 'otpauth://totp/UNIFORMA:' . rawurlencode($uname) . '?secret=' . $secret . '&issuer=UNIFORMA&digits=6&period=30']);
}

if ($action === 'totp_enable') {
    $secret = (string)($_SESSION['totp_pending'] ?? '');
    if ($secret === '' || !totp_verify($secret, (string)($payload['code'] ?? ''))) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'El código no coincide. Revisá la hora del celular e intentá de nuevo.']);
    }
    $codes = [];
    $hashes = [];
    for ($i = 0; $i < 8; $i++) {
        $raw = strtolower(bin2hex(random_bytes(5)));
        $codes[] = substr($raw, 0, 5) . '-' . substr($raw, 5, 5);
        $hashes[] = password_hash($raw, PASSWORD_DEFAULT);
    }
    $users = load_users();
    $me = (string)(current_user()['id'] ?? '');
    foreach ($users as &$u) {
        if (($u['id'] ?? '') === $me) {
            $u['totp'] = ['enabled' => true, 'secret' => secret_encrypt($secret), 'recovery' => $hashes, 'enabledAt' => date('c')];
        }
    }
    unset($u);
    save_users($users);
    unset($_SESSION['totp_pending']);
    save_state(push_audit(load_state(), 'Verificación en dos pasos activada', (string)(current_user()['name'] ?? '')));
    $response = current_payload();
    $response['recoveryCodes'] = $codes;
    json_response($response);
}

if ($action === 'totp_disable') {
    $users = load_users();
    $me = (string)(current_user()['id'] ?? '');
    foreach ($users as &$u) {
        if (($u['id'] ?? '') !== $me) {
            continue;
        }
        if (!verify_user_password($u, (string)($payload['password'] ?? '')) || (user_has_totp($u) && !verify_second_factor($u, (string)($payload['code'] ?? '')))) {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'La contraseña o el código no son correctos.']);
        }
        $u['totp'] = null;
    }
    unset($u);
    save_users($users);
    save_state(push_audit(load_state(), 'Verificación en dos pasos desactivada', (string)(current_user()['name'] ?? '')));
    json_response(current_payload());
}

if ($action === 'totp_reset') {
    require_permission('users.manage');
    $target = (string)($payload['userId'] ?? '');
    $users = load_users();
    foreach ($users as &$u) {
        if (($u['id'] ?? '') === $target) {
            $u['totp'] = null;
        }
    }
    unset($u);
    save_users($users);
    save_state(push_audit(load_state(), 'Verificación en dos pasos restablecida', $target));
    json_response(current_payload());
}

if ($action === 'create_user') {
    require_permission('users.manage');
    $users = load_users();
    $userPayload = is_array($payload['user'] ?? null) ? $payload['user'] : [];
    $password = (string)($userPayload['password'] ?? '');
    $newUser = sanitize_user_payload($userPayload);

    if ($newUser['name'] === '' || $newUser['username'] === '') {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Nombre y usuario son obligatorios']);
    }
    if (strlen($password) < 8) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres']);
    }

    ensure_unique_login($users, $newUser);
    $newUser['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    $users[] = $newUser;
    ensure_admin_available($users);
    save_users($users);

    $state = push_audit(load_state(), 'Usuario creado', $newUser['name']);
    save_state($state);
    json_response(current_payload());
}

if ($action === 'update_user') {
    require_permission('users.manage');
    $users = load_users();
    $userPayload = is_array($payload['user'] ?? null) ? $payload['user'] : [];
    $id = (string)($userPayload['id'] ?? '');
    $password = (string)($userPayload['password'] ?? '');
    $updated = false;

    foreach ($users as &$user) {
        if (($user['id'] ?? '') !== $id) {
            continue;
        }
        $next = sanitize_user_payload($userPayload, $user);
        if ($next['name'] === '' || $next['username'] === '') {
            http_response_code(422);
            json_response(['ok' => false, 'error' => 'Nombre y usuario son obligatorios']);
        }
        ensure_unique_login($users, $next);
        if ($password !== '') {
            if (strlen($password) < 8) {
                http_response_code(422);
                json_response(['ok' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres']);
            }
            $next['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        } else {
            if (!empty($user['password_hash'])) {
                $next['password_hash'] = $user['password_hash'];
            }
            if (!empty($user['password_sha256'])) {
                $next['password_sha256'] = $user['password_sha256'];
            }
        }
        $user = $next;
        $updated = true;
        break;
    }
    unset($user);

    if (!$updated) {
        http_response_code(404);
        json_response(['ok' => false, 'error' => 'Usuario no encontrado']);
    }

    ensure_admin_available($users);
    save_users($users);

    $state = push_audit(load_state(), 'Usuario actualizado', (string)($userPayload['name'] ?? ''));
    save_state($state);
    json_response(current_payload());
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $cookie = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $cookie['path'], $cookie['domain'] ?? '', (bool)$cookie['secure'], true);
    }
    session_destroy();
    json_response(['ok' => true]);
}

http_response_code(400);
json_response(['ok' => false, 'error' => 'Accion invalida']);
