<?php
declare(strict_types=1);

/**
 * Funciones de operación compartidas por api.php, track.php y labels.php:
 * totales de una propuesta, aprobación de diseño (con huella), seguimiento público, stock, caja y correo.
 * Se carga desde bootstrap.php (solo define funciones).
 */

const PROPOSAL_STATES = ['Borrador', 'Enviada', 'Vista', 'Aprobada', 'Rechazada', 'En producción', 'Lista', 'Entregada'];

function payment_status_of(array $payment): string
{
    $status = (string)($payment['status'] ?? 'validated');
    return in_array($status, ['pending', 'validated', 'rejected', 'voided'], true) ? $status : 'validated';
}

/* ---------- totales (mismo cálculo que la interfaz) ---------- */
function proposal_totals_php(array $p): array
{
    $subtotal = 0.0;
    foreach (is_array($p['designs'] ?? null) ? $p['designs'] : [] as $d) {
        $subtotal += (float)($d['qty'] ?? 0) * (float)($d['unitPrice'] ?? 0);
    }
    $discount = $subtotal * (float)($p['discount'] ?? 0) / 100;
    $base = $subtotal - $discount + (float)($p['surcharge'] ?? 0) + (float)($p['shipping'] ?? 0);
    $tax = $base * (float)($p['taxRate'] ?? 0) / 100;
    $total = max(0.0, $base + $tax);
    $paid = 0.0;
    $pending = 0.0;
    foreach (is_array($p['payments'] ?? null) ? $p['payments'] : [] as $pay) {
        if (!is_array($pay)) {
            continue;
        }
        $status = payment_status_of($pay);
        if ($status === 'validated') {
            $paid += (float)($pay['amount'] ?? 0);
        } elseif ($status === 'pending') {
            $pending += (float)($pay['amount'] ?? 0);
        }
    }
    return ['subtotal' => $subtotal, 'total' => $total, 'paid' => $paid, 'pending' => $pending, 'balance' => max(0.0, $total - $paid)];
}

function product_sizes_php(array $product): array
{
    $sizes = $product['sizeOptions'] ?? [];
    if (!is_array($sizes) || !$sizes) {
        $sizes = preg_split('/\s*[,;\/]\s*/', (string)($product['sizes'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }
    return array_values(array_filter(array_map(static fn($s): string => trim((string)$s), $sizes)));
}

/** Variantes (color/talle/cantidad) de una prenda de la propuesta. */
function variant_rows_php(array $design, array $product): array
{
    $rows = [];
    $firstSize = product_sizes_php($product)[0] ?? 'Único';
    if (is_array($design['colorSizeQuantities'] ?? null) && count($design['colorSizeQuantities'])) {
        foreach ($design['colorSizeQuantities'] as $e) {
            $color = (string)($e['color'] ?? '');
            if ($color === '') {
                continue;
            }
            $rows[] = ['color' => $color, 'size' => (string)($e['size'] ?? ($design['size'] ?? $firstSize)), 'qty' => max(0, (int)floor((float)($e['qty'] ?? 0)))];
        }
        return $rows;
    }
    if (is_array($design['colorQuantities'] ?? null) && count($design['colorQuantities'])) {
        foreach ($design['colorQuantities'] as $e) {
            $color = (string)($e['color'] ?? $e['name'] ?? '');
            if ($color !== '') {
                $rows[] = ['color' => $color, 'size' => (string)($design['size'] ?? $firstSize), 'qty' => max(0, (int)floor((float)($e['qty'] ?? $e['quantity'] ?? 0)))];
            }
        }
        return $rows;
    }
    $rows[] = ['color' => (string)($design['color'] ?? 'Sin color'), 'size' => (string)($design['size'] ?? $firstSize), 'qty' => max(1, (int)floor((float)($design['qty'] ?? 1)))];
    return $rows;
}

/* ---------- versiones de diseño aprobadas ---------- */
function design_snapshot_dir(): string
{
    return data_dir() . '/design-snapshots';
}

function design_snapshot_file(string $id): string
{
    if (!preg_match('/^[a-f0-9]{24}$/', $id)) {
        http_response_code(422);
        json_response(['ok' => false, 'error' => 'Versión de diseño inválida']);
    }
    return design_snapshot_dir() . '/' . $id . '.json';
}

/**
 * Congela el diseño de la propuesta, guarda la versión y registra la aprobación (con huella del contenido).
 * $in: approvedBy, approvedAt (Y-m-d), note, evidenceName, evidenceData, recordedBy, via, ip, userAgent.
 */
function finalize_design_approval(array &$state, int $index, array $in): string
{
    $proposal = &$state['proposals'][$index];
    $revision = max(1, (int)($proposal['designRevision'] ?? 0));
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
        $frozen = array_intersect_key($design, array_flip(['id', 'productId', 'qty', 'color', 'colorHex', 'size', 'colorSizeQuantities', 'colorQuantities', 'logos', 'note']));
        $designs[] = ['design' => $frozen, 'product' => $garment];
    }
    $snapshotId = bin2hex(random_bytes(12));
    $hash = hash('sha256', (string)json_encode($designs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $approval = [
        'revision' => $revision,
        'approvedAt' => (string)$in['approvedAt'],
        'approvedBy' => (string)$in['approvedBy'],
        'note' => (string)($in['note'] ?? ''),
        'evidenceName' => substr((string)($in['evidenceName'] ?? ''), 0, 180),
        'evidenceData' => (string)($in['evidenceData'] ?? ''),
        'recordedBy' => (string)($in['recordedBy'] ?? 'Equipo'),
        'snapshotId' => $snapshotId,
        'via' => (string)($in['via'] ?? 'staff'),
        'contentHash' => $hash,
        'ip' => (string)($in['ip'] ?? ''),
        'userAgent' => substr((string)($in['userAgent'] ?? ''), 0, 200),
        'recordedAt' => date('c'),
    ];
    $snapshot = [
        'version' => 1,
        'proposalId' => (string)($proposal['id'] ?? ''),
        'publicId' => (string)($proposal['publicId'] ?? ''),
        'title' => (string)($proposal['title'] ?? ''),
        'client' => $customer,
        'revision' => $revision,
        'contentHash' => $hash,
        'approval' => array_intersect_key($approval, array_flip(['revision', 'approvedAt', 'approvedBy', 'note', 'via', 'contentHash'])),
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
        'userName' => (string)$approval['recordedBy'],
        'action' => 'Diseño aprobado',
        'detail' => $approval['approvedBy'] . ' · versión ' . $revision . ($approval['via'] === 'link' ? ' · desde el link del cliente' : ''),
    ]);
    return $snapshotId;
}

function history_entry(string $who, string $action, string $detail = ''): array
{
    return ['id' => 'history-' . bin2hex(random_bytes(6)), 'at' => date('c'), 'userName' => $who, 'action' => $action, 'detail' => $detail];
}

/* ---------- seguimiento público por link ---------- */
function tracking_file(): string
{
    return data_dir() . '/tracking.json';
}

function tracking_load(): array
{
    $raw = is_file(tracking_file()) ? json_decode((string)@file_get_contents(tracking_file()), true) : [];
    return is_array($raw) ? $raw : [];
}

function tracking_save(array $rows): void
{
    ensure_storage_ready();
    @file_put_contents(tracking_file(), json_encode($rows), LOCK_EX);
}

function tracking_touch(string $proposalId): array
{
    $rows = tracking_load();
    $row = $rows[$proposalId] ?? ['views' => 0, 'firstViewedAt' => '', 'lastViewedAt' => ''];
    $row['views'] = (int)$row['views'] + 1;
    $row['firstViewedAt'] = $row['firstViewedAt'] ?: date('c');
    $row['lastViewedAt'] = date('c');
    $rows[$proposalId] = $row;
    tracking_save($rows);
    return $row;
}

function find_proposal_index_by_token(array $state, string $token): ?int
{
    if (!preg_match('/^[a-f0-9]{32}$/', $token)) {
        return null;
    }
    foreach ($state['proposals'] as $i => $p) {
        if (is_array($p) && !empty($p['publicToken']) && hash_equals((string)$p['publicToken'], $token)) {
            return (int)$i;
        }
    }
    return null;
}

/* ---------- reglas de propuestas del lado del servidor ---------- */
function enforce_proposal_rules(array $incoming, array $current): array
{
    if (!is_array($incoming['proposals'] ?? null)) {
        return $incoming;
    }
    $user = current_user();
    $canOverride = can_user($user, 'settings.manage');
    $before = [];
    foreach ($current['proposals'] ?? [] as $p) {
        if (is_array($p) && isset($p['id'])) {
            $before[(string)$p['id']] = $p;
        }
    }
    foreach ($incoming['proposals'] as &$p) {
        if (!is_array($p)) {
            continue;
        }
        $id = (string)($p['id'] ?? '');
        $prev = $before[$id] ?? null;
        // El token del link público lo maneja solo el servidor.
        if ($prev !== null && !empty($prev['publicToken'])) {
            $p['publicToken'] = $prev['publicToken'];
        } else {
            unset($p['publicToken']);
        }
        if ($prev === null) {
            unset($p['stockConsumed']);
        } else {
            if (array_key_exists('stockConsumed', $prev)) {
                $p['stockConsumed'] = $prev['stockConsumed'];
            } else {
                unset($p['stockConsumed']);
            }
        }
        // Compuerta de entrega: sin saldo validado pendiente (o con autorización de un administrador).
        $status = (string)($p['status'] ?? '');
        if ($status === 'Entregada' && (($prev['status'] ?? '') !== 'Entregada')) {
            $sum = proposal_totals_php($p);
            if ($sum['balance'] > 0.5) {
                $knownIds = [];
                foreach (is_array($prev['history'] ?? null) ? $prev['history'] : [] as $h) {
                    $knownIds[(string)($h['id'] ?? '')] = true;
                }
                $authorized = false;
                foreach (is_array($p['history'] ?? null) ? $p['history'] : [] as $h) {
                    if (($h['action'] ?? '') === 'Entrega con saldo autorizada' && !isset($knownIds[(string)($h['id'] ?? '')])) {
                        $authorized = true;
                        break;
                    }
                }
                if (!($canOverride && $authorized)) {
                    http_response_code(403);
                    json_response(['ok' => false, 'error' => 'No se puede entregar ' . (string)($p['publicId'] ?? '') . ' con saldo pendiente de $' . number_format($sum['balance'], 0, ',', '.') . '. Registrá y validá el pago, o pedí autorización a un administrador.']);
                }
            }
        }
    }
    unset($p);
    return $incoming;
}

/* ---------- stock: movimientos, ajustes y consumo al entregar ---------- */
function stock_key(string $color, string $size): string
{
    return $color . '|' . $size;
}

function stock_movement(string $productId, string $productName, string $color, string $size, int $qty, string $reason, string $note = '', string $ref = ''): array
{
    $user = current_user();
    return [
        'id' => 'mov-' . bin2hex(random_bytes(6)), 'at' => date('c'), 'productId' => $productId, 'productName' => $productName,
        'color' => $color, 'size' => $size, 'qty' => $qty, 'reason' => $reason, 'note' => $note, 'ref' => $ref,
        'userName' => (string)($user['name'] ?? 'Sistema'),
    ];
}

function push_stock_movements(array &$state, array $movements): void
{
    if (!$movements) {
        return;
    }
    $list = is_array($state['stockMovements'] ?? null) ? $state['stockMovements'] : [];
    $state['stockMovements'] = array_slice(array_merge(array_reverse($movements), $list), 0, 1500);
}

/** Registra como movimientos de "Ajuste" las diferencias de stock cargadas a mano. */
function log_stock_diffs(array &$incoming, array $current): void
{
    $old = [];
    foreach ($current['products'] ?? [] as $p) {
        foreach (is_array($p['stockVariants'] ?? null) ? $p['stockVariants'] : [] as $row) {
            $old[(string)($p['id'] ?? '')][stock_key((string)$row['color'], (string)$row['size'])] = (int)$row['qty'];
        }
    }
    $moves = [];
    foreach ($incoming['products'] ?? [] as $p) {
        $pid = (string)($p['id'] ?? '');
        foreach (is_array($p['stockVariants'] ?? null) ? $p['stockVariants'] : [] as $row) {
            $key = stock_key((string)$row['color'], (string)$row['size']);
            $prev = (int)($old[$pid][$key] ?? 0);
            $now = (int)$row['qty'];
            if ($now !== $prev) {
                $moves[] = stock_movement($pid, (string)($p['name'] ?? ''), (string)$row['color'], (string)$row['size'], $now - $prev, 'Ajuste', 'Carga manual de stock');
            }
        }
    }
    push_stock_movements($incoming, $moves);
}

/** Descuenta del stock las prendas de las propuestas que pasaron a "Entregada" (una sola vez por propuesta). */
function apply_stock_consumption(array &$incoming, array $current): void
{
    $before = [];
    foreach ($current['proposals'] ?? [] as $p) {
        if (is_array($p) && isset($p['id'])) {
            $before[(string)$p['id']] = $p;
        }
    }
    $moves = [];
    foreach ($incoming['proposals'] as &$p) {
        if (!is_array($p) || ($p['status'] ?? '') !== 'Entregada' || !empty($p['stockConsumed'])) {
            continue;
        }
        $prevStatus = (string)($before[(string)($p['id'] ?? '')]['status'] ?? '');
        if ($prevStatus === 'Entregada') {
            continue;
        }
        foreach (is_array($p['designs'] ?? null) ? $p['designs'] : [] as $design) {
            foreach ($incoming['products'] as &$prod) {
                if (($prod['id'] ?? '') !== ($design['productId'] ?? '') || empty($prod['stockVariants'])) {
                    continue;
                }
                foreach (variant_rows_php($design, $prod) as $need) {
                    if ($need['qty'] <= 0) {
                        continue;
                    }
                    foreach ($prod['stockVariants'] as &$row) {
                        if ($row['color'] === $need['color'] && $row['size'] === $need['size']) {
                            $take = min((int)$row['qty'], $need['qty']);
                            if ($take > 0) {
                                $row['qty'] = (int)$row['qty'] - $take;
                                $moves[] = stock_movement((string)$prod['id'], (string)($prod['name'] ?? ''), $need['color'], $need['size'], -$take, 'Entrega', 'Entrega de ' . (string)($p['publicId'] ?? ''), (string)($p['publicId'] ?? ''));
                            }
                            break;
                        }
                    }
                    unset($row);
                }
            }
            unset($prod);
        }
        $p['stockConsumed'] = true;
    }
    unset($p);
    push_stock_movements($incoming, $moves);
}

/* ---------- caja diaria ---------- */
function cash_expected_for(array $state, string $date): array
{
    $by = [];
    foreach ($state['proposals'] ?? [] as $p) {
        foreach (is_array($p['payments'] ?? null) ? $p['payments'] : [] as $pay) {
            if (is_array($pay) && payment_status_of($pay) === 'validated' && (string)($pay['date'] ?? '') === $date) {
                $m = (string)($pay['method'] ?? 'Otro');
                $by[$m] = ($by[$m] ?? 0) + (float)($pay['amount'] ?? 0);
            }
        }
    }
    return $by;
}

/* ---------- correo ---------- */
function mail_settings(): array
{
    global $config;
    $m = is_array($config['mail'] ?? null) ? $config['mail'] : [];
    $mode = (string)($m['mode'] ?? 'off');
    return [
        'mode' => in_array($mode, ['off', 'test', 'on'], true) ? $mode : 'off',
        'from' => (string)($m['from'] ?? ''),
        'from_name' => (string)($m['from_name'] ?? 'UNIFORMA'),
        'test_to' => (string)($m['test_to'] ?? ''),
        'reply_to' => (string)($m['reply_to'] ?? ''),
    ];
}

function mail_log(array $row): void
{
    ensure_storage_ready();
    @file_put_contents(data_dir() . '/mail-log.jsonl', json_encode($row + ['at' => date('c')], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}

/** Envía un correo de texto plano. Modos: off (no envía), test (todo va a test_to), on (real). */
function send_plain_mail(string $to, string $subject, string $body, string $context = ''): array
{
    $cfg = mail_settings();
    $to = trim($to);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'El cliente no tiene un email válido cargado.'];
    }
    if ($cfg['mode'] === 'off' || $cfg['from'] === '' || !filter_var($cfg['from'], FILTER_VALIDATE_EMAIL)) {
        mail_log(['to' => $to, 'subject' => $subject, 'context' => $context, 'result' => 'apagado']);
        return ['ok' => false, 'error' => 'El envío de correos está apagado. Configuralo en config.local.php (mail.mode = test u on y mail.from).', 'mode' => 'off'];
    }
    $realTo = $to;
    if ($cfg['mode'] === 'test') {
        if (!filter_var($cfg['test_to'], FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Modo prueba sin mail.test_to configurado.', 'mode' => 'test'];
        }
        $subject = '[PRUEBA para ' . $to . '] ' . $subject;
        $to = $cfg['test_to'];
    }
    $clean = static fn(string $s): string => trim(preg_replace('/[\r\n]+/', ' ', $s) ?? '');
    $headers = [
        'From: ' . $clean($cfg['from_name']) . ' <' . $cfg['from'] . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    if (filter_var($cfg['reply_to'], FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . $cfg['reply_to'];
    }
    $sent = @mail($to, '=?UTF-8?B?' . base64_encode($clean($subject)) . '?=', str_replace("\r\n", "\n", $body), implode("\r\n", $headers));
    mail_log(['to' => $realTo, 'sentTo' => $to, 'subject' => $subject, 'context' => $context, 'mode' => $cfg['mode'], 'result' => $sent ? 'enviado' : 'fallo']);
    return $sent ? ['ok' => true, 'mode' => $cfg['mode'], 'sentTo' => $to] : ['ok' => false, 'error' => 'El servidor no pudo enviar el correo. Revisá la configuración del hosting.', 'mode' => $cfg['mode']];
}
