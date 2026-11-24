<?php
declare(strict_types=1);

/**
 * Funciones de la segunda tanda: consultas de la web (leads), compras y talleres externos, fotos de trabajos terminados,
 * avisos automáticos por mail, doble verificación (TOTP), respaldos diarios y colecciones que escribe solo el servidor.
 * Se carga desde bootstrap.php (solo define funciones).
 */

function server_owned_keys(): array
{
    return ['stockMovements', 'cashClosings', 'leads', 'suppliers', 'supplies', 'purchaseOrders', 'workOrders', 'supplyMovements'];
}

function server_owned_caps(): array
{
    return ['stockMovements' => 1500, 'cashClosings' => 800, 'leads' => 600, 'suppliers' => 300, 'supplies' => 500, 'purchaseOrders' => 1500, 'workOrders' => 2000, 'supplyMovements' => 2000];
}

/** Copia del estado actual las colecciones que el navegador no puede modificar por save_changes. */
function preserve_server_owned(array &$incoming, array $current): void
{
    foreach (server_owned_keys() as $key) {
        $incoming[$key] = is_array($current[$key] ?? null) ? $current[$key] : [];
    }
}

function new_id(string $prefix): string
{
    return $prefix . '-' . bin2hex(random_bytes(6));
}

function ar_today(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
}

function clean_text($value, int $max = 300): string
{
    $value = is_scalar($value) ? (string)$value : '';
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}

function clean_money($value): float
{
    $n = is_numeric($value) ? (float)$value : 0.0;
    return $n > 0 && $n < 1e10 ? round($n, 2) : 0.0;
}

/* ---------- consultas de la web ---------- */
function lead_token_ok(): bool
{
    global $config;
    $expected = (string)($config['lead_token'] ?? '');
    $given = (string)($_SERVER['HTTP_X_UNIFORMA_LEAD_TOKEN'] ?? '');
    return $expected !== '' && strlen($expected) >= 20 && $given !== '' && hash_equals($expected, $given);
}

function add_lead(array &$state, array $lead): ?string
{
    $leads = is_array($state['leads'] ?? null) ? $state['leads'] : [];
    $sig = md5(strtolower(($lead['email'] ?? '') . '|' . ($lead['phone'] ?? '') . '|' . ($lead['message'] ?? '') . '|' . ($lead['product'] ?? '')));
    foreach (array_slice($leads, 0, 25) as $old) {
        if (($old['sig'] ?? '') === $sig && time() - strtotime((string)($old['at'] ?? '')) < 900) {
            return null;
        }
    }
    $lead = array_merge(['id' => new_id('lead'), 'at' => date('c'), 'status' => 'Nuevo', 'note' => '', 'sig' => $sig, 'proposalId' => ''], $lead);
    array_unshift($leads, $lead);
    $state['leads'] = array_slice($leads, 0, server_owned_caps()['leads']);
    return (string)$lead['id'];
}

/* ---------- avisos automáticos por mail ---------- */
function default_auto_mail(): array
{
    return [
        'Aprobada' => ['subject' => 'Recibimos tu aprobación · {pedido}', 'body' => "Hola {cliente},\n\n¡Gracias! Registramos la aprobación de tu pedido {pedido}. Ya lo pasamos a producción y te avisamos cuando esté listo.\n\nPodés ver el estado en cualquier momento acá:\n{link}"],
        'En producción' => ['subject' => 'Tu pedido {pedido} está en producción', 'body' => "Hola {cliente},\n\nTu pedido {pedido} ya está en producción. La fecha estimada de entrega es el {entrega}.\n\nSeguimiento: {link}"],
        'Lista' => ['subject' => 'Tu pedido {pedido} está listo', 'body' => "Hola {cliente},\n\nTu pedido {pedido} está listo para retirar o coordinar el envío.{saldoTxt}\n\nDetalle: {link}"],
        'Entregada' => ['subject' => 'Gracias por elegirnos · {pedido}', 'body' => "Hola {cliente},\n\nGracias por tu compra. Si querés, contanos cómo te fue con una encuesta de 10 segundos y, cuando necesites repetir el pedido, lo hacés desde el mismo link:\n{link}"],
    ];
}

function fill_mail_template(string $text, array $proposal, array $client, string $link): string
{
    $sum = proposal_totals_php($proposal);
    $map = [
        'cliente' => (string)($client['contact'] ?? '') ?: (string)($client['company'] ?? ''),
        'pedido' => (string)($proposal['publicId'] ?? ''),
        'total' => '$' . number_format($sum['total'], 0, ',', '.'),
        'saldo' => '$' . number_format($sum['balance'], 0, ',', '.'),
        'entrega' => implode('/', array_reverse(explode('-', (string)($proposal['deliveryDate'] ?? '')))),
        'link' => $link,
        'saldoTxt' => $sum['balance'] > 0 ? ' Recordá que queda un saldo de $' . number_format($sum['balance'], 0, ',', '.') . '.' : '',
    ];
    return (string)preg_replace_callback('/\{(\w+)\}/', static fn($m) => $map[$m[1]] ?? '', $text);
}

function base_panel_url(): string
{
    global $config;
    $fixed = trim((string)($config['public_url'] ?? ''));
    if ($fixed !== '') {
        return rtrim($fixed, '/') . '/';
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/panel/api.php')), '/') . '/';
}

/** Manda el mail automático cuando una propuesta cambia a un estado con aviso activado. */
function auto_notify_status_changes(array &$incoming, array $current): void
{
    $auto = is_array($incoming['settings']['autoMail'] ?? null) ? $incoming['settings']['autoMail'] : [];
    if (empty($auto['enabled']) || mail_settings()['mode'] === 'off') {
        return;
    }
    $defaults = default_auto_mail();
    $before = [];
    foreach ($current['proposals'] ?? [] as $p) {
        if (is_array($p) && isset($p['id'])) {
            $before[(string)$p['id']] = (string)($p['status'] ?? '');
        }
    }
    foreach ($incoming['proposals'] as &$p) {
        $id = (string)($p['id'] ?? '');
        $status = (string)($p['status'] ?? '');
        if ($id === '' || !isset($before[$id]) || $before[$id] === $status || !isset($defaults[$status]) || empty($auto['statuses'][$status])) {
            continue;
        }
        if (!empty($p['autoMailSent'][$status])) {
            continue;
        }
        $client = [];
        foreach ($incoming['clients'] as $c) {
            if (($c['id'] ?? '') === ($p['clientId'] ?? '')) {
                $client = $c;
            }
        }
        if (!filter_var((string)($client['email'] ?? ''), FILTER_VALIDATE_EMAIL)) {
            continue;
        }
        if (empty($p['publicToken'])) {
            $p['publicToken'] = bin2hex(random_bytes(16));
        }
        $tpl = is_array($auto['templates'][$status] ?? null) ? $auto['templates'][$status] : $defaults[$status];
        $subject = fill_mail_template((string)($tpl['subject'] ?? $defaults[$status]['subject']), $p, $client, '');
        $body = fill_mail_template((string)($tpl['body'] ?? $defaults[$status]['body']), $p, $client, base_panel_url() . 'track.php?t=' . $p['publicToken']);
        $company = (string)($incoming['settings']['companyName'] ?? 'UNIFORMA');
        $r = send_plain_mail((string)$client['email'], $subject, $body . "\n\n—\n" . $company, 'automático ' . $status . ' ' . (string)($p['publicId'] ?? ''));
        $p['history'] = is_array($p['history'] ?? null) ? $p['history'] : [];
        array_unshift($p['history'], history_entry('Sistema', $r['ok'] ? 'Correo automático enviado' : 'Correo automático no enviado', $status . ($r['ok'] ? '' : ' · ' . ($r['error'] ?? ''))));
        if ($r['ok']) {
            $p['autoMailSent'] = is_array($p['autoMailSent'] ?? null) ? $p['autoMailSent'] : [];
            $p['autoMailSent'][$status] = date('c');
        }
    }
    unset($p);
}

/* ---------- doble verificación (TOTP, RFC 6238) ---------- */
function app_key(): string
{
    $file = data_dir() . '/.appkey';
    if (!is_file($file)) {
        ensure_storage_ready();
        @file_put_contents($file, bin2hex(random_bytes(32)), LOCK_EX);
        @chmod($file, 0600);
    }
    return hash('sha256', (string)@file_get_contents($file), true);
}

function secret_encrypt(string $plain): string
{
    $iv = random_bytes(12);
    $tag = '';
    $enc = openssl_encrypt($plain, 'aes-256-gcm', app_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . (string)$enc);
}

function secret_decrypt(string $blob): string
{
    $raw = base64_decode($blob, true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }
    $dec = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', app_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $dec === false ? '' : $dec;
}

function base32_encode_str(string $bin): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split($bin) as $ch) {
        $bits .= str_pad(decbin(ord($ch)), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 5) as $chunk) {
        $out .= $alphabet[bindec(str_pad($chunk, 5, '0'))];
    }
    return $out;
}

function base32_decode_str(string $text): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    foreach (str_split(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $text) ?? '')) as $ch) {
        $bits .= str_pad(decbin((int)strpos($alphabet, $ch)), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) {
        if (strlen($byte) === 8) {
            $out .= chr(bindec($byte));
        }
    }
    return $out;
}

function totp_code(string $secretB32, int $slice): string
{
    $key = base32_decode_str($secretB32);
    $hash = hash_hmac('sha1', pack('N*', 0, $slice), $key, true);
    $offset = ord($hash[19]) & 0x0F;
    $value = ((ord($hash[$offset]) & 0x7F) << 24) | ((ord($hash[$offset + 1]) & 0xFF) << 16) | ((ord($hash[$offset + 2]) & 0xFF) << 8) | (ord($hash[$offset + 3]) & 0xFF);
    return str_pad((string)($value % 1000000), 6, '0', STR_PAD_LEFT);
}

function totp_verify(string $secretB32, string $code): bool
{
    $code = preg_replace('/\D/', '', $code) ?? '';
    if (strlen($code) !== 6) {
        return false;
    }
    $now = intdiv(time(), 30);
    for ($i = -1; $i <= 1; $i++) {
        if (hash_equals(totp_code($secretB32, $now + $i), $code)) {
            return true;
        }
    }
    return false;
}

function user_has_totp(array $user): bool
{
    return !empty($user['totp']['enabled']) && !empty($user['totp']['secret']);
}

/** Verifica un código TOTP o un código de recuperación (se consume). Devuelve true y actualiza $users si hace falta guardar. */
function verify_second_factor(array &$user, string $input): bool
{
    $secret = secret_decrypt((string)($user['totp']['secret'] ?? ''));
    if ($secret !== '' && totp_verify($secret, $input)) {
        return true;
    }
    $norm = strtolower(preg_replace('/[^a-z0-9]/i', '', $input) ?? '');
    foreach ($user['totp']['recovery'] ?? [] as $i => $hash) {
        if (strlen($norm) >= 8 && password_verify($norm, (string)$hash)) {
            unset($user['totp']['recovery'][$i]);
            $user['totp']['recovery'] = array_values($user['totp']['recovery']);
            return true;
        }
    }
    return false;
}

/* ---------- respaldos ---------- */
function backup_dir(): string
{
    return data_dir() . '/backups-daily';
}

function backup_sources(): array
{
    $base = data_dir();
    $files = [];
    foreach (['state.json', 'users.json', 'revision.txt', 'tracking.json'] as $f) {
        if (is_file($base . '/' . $f)) {
            $files[$f] = $base . '/' . $f;
        }
    }
    foreach (['design-snapshots', 'studio/projects', 'studio/assets', 'studio/thumbs', 'photos'] as $dir) {
        $root = $base . '/' . $dir;
        if (!is_dir($root)) {
            continue;
        }
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->isFile()) {
                $files[$dir . '/' . ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($root))), '/')] = $file->getPathname();
            }
        }
    }
    return $files;
}

function make_backup_zip(string $target): bool
{
    if (!class_exists('ZipArchive')) {
        return false;
    }
    $zip = new ZipArchive();
    if ($zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return false;
    }
    foreach (backup_sources() as $name => $path) {
        $zip->addFile($path, $name);
    }
    $zip->addFromString('LEEME.txt', "Respaldo UNIFORMA " . date('c') . "\nContiene el estado, usuarios, versiones de diseño aprobadas, proyectos y archivos del Estudio y fotos.\nNO contiene config.local.php ni claves. Para restaurar: subir estos archivos a la carpeta data/ del panel (con el panel apagado o sin uso).\n");
    return $zip->close();
}

/** Una vez por día (al primer guardado) deja una copia comprimida en data/backups-daily y borra las de más de 14 días. */
function daily_backup_if_needed(): void
{
    $dir = backup_dir();
    $file = $dir . '/uniforma-' . date('Ymd') . '.zip';
    if (is_file($file) || !class_exists('ZipArchive')) {
        return;
    }
    if (!is_dir($dir) && !@mkdir($dir, 0775) && !is_dir($dir)) {
        return;
    }
    @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    make_backup_zip($file);
    foreach (glob($dir . '/uniforma-*.zip') ?: [] as $old) {
        if (filemtime($old) < time() - 14 * 86400) {
            @unlink($old);
        }
    }
}

/* ---------- fotos de trabajos terminados ---------- */
function photos_dir(string $proposalId): string
{
    return data_dir() . '/photos/' . preg_replace('/[^A-Za-z0-9_-]/', '', $proposalId);
}
