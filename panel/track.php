<?php
declare(strict_types=1);

/**
 * Página pública de seguimiento y aprobación para el cliente (link con token largo, sin login).
 * Muestra el estado del pedido, las prendas con sus logos y permite aprobar el diseño o pedir cambios.
 * Nunca muestra costos, márgenes ni notas internas.
 */
require __DIR__ . '/bootstrap.php';
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

function h($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

function money_ar($v): string
{
    return '$ ' . number_format((float)$v, 0, ',', '.');
}

function date_ar(string $d): string
{
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) ? implode('/', array_reverse(explode('-', $d))) : $d;
}

function public_page(string $title, string $body, int $code = 200): void
{
    http_response_code($code);
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>' . h($title) . '</title>' . track_css() . '</head><body><main class="wrap">' . $body . '</main></body></html>';
    exit;
}

function track_css(): string
{
    return '<style>
@font-face{font-family:"Archivo";font-weight:700;src:url(studio/vendor/fonts/archivo-latin-700-normal.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Jost";font-weight:400;src:url(studio/vendor/fonts/jost-latin-400-normal.woff2) format("woff2");font-display:swap}
@font-face{font-family:"Jost";font-weight:700;src:url(studio/vendor/fonts/jost-latin-700-normal.woff2) format("woff2");font-display:swap}
:root{--ink:#5f3d27;--strong:#3d2718;--muted:#8a6f5a;--line:#e3d9c6;--bg:#f4efe5;--card:#fffdf9;--accent:#b77a2b;--accent-d:#8a5a20;--ok:#3f7a4a;--ok-s:#e1efe3;--warn:#9a6a14;--warn-s:#fbefd2;--bad:#b3412f;--bad-s:#f7e1dc}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Jost,system-ui,sans-serif}
.wrap{max-width:880px;margin:0 auto;padding:22px 16px 60px}
h1,h2,h3{font-family:Archivo,Jost,sans-serif;color:var(--strong);margin:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px;margin-top:16px}
.brand{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.brand img{height:46px;width:auto;display:block}
.brand small{color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:700;font-size:11px}
.top h1{font-size:26px;margin-top:6px}.top p{margin:4px 0 0;color:var(--muted)}
.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:18px}
.step{position:relative;padding-top:26px;text-align:center;font-size:12.5px;font-weight:700;color:var(--muted)}
.step::before{content:"";position:absolute;left:0;right:0;top:9px;height:4px;background:var(--line);border-radius:2px}
.step::after{content:"";position:absolute;left:50%;top:3px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:var(--card);border:3px solid var(--line)}
.step.done::before{background:var(--accent)}.step.done::after{background:var(--accent);border-color:var(--accent)}
.step.now{color:var(--strong)}.step.now::after{background:var(--card);border-color:var(--accent-d);box-shadow:0 0 0 4px rgba(183,122,43,.2)}
.pill{display:inline-block;padding:3px 12px;border-radius:999px;font-size:13px;font-weight:700;background:#ece6da;color:#6b5a4a}
.pill.ok{background:var(--ok-s);color:var(--ok)}.pill.warn{background:var(--warn-s);color:var(--warn)}.pill.bad{background:var(--bad-s);color:var(--bad)}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}
.meta div{background:#f6f0e4;border-radius:8px;padding:10px 12px}.meta small{display:block;color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}.meta b{font-size:16px;color:var(--strong)}
.design{border-top:1px solid var(--line);padding-top:16px;margin-top:16px}.design:first-of-type{border-top:0;padding-top:0;margin-top:8px}
.design h3{font-size:18px}.design p{margin:4px 0;color:var(--muted)}
.sides{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}
.side{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px}.side b{display:block;font-size:11px;letter-spacing:.1em;color:var(--muted);text-align:center}
.art{position:relative;aspect-ratio:1/1;margin-top:4px}.art>img.garment{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.art .lg{position:absolute}.art .lg img{width:100%;height:100%;object-fit:contain;display:block}.art .lg span{display:block;width:100%;height:100%;mask-size:contain;mask-repeat:no-repeat;mask-position:center;-webkit-mask-size:contain;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 8px;background:#f6f0e4}td{padding:7px 8px;border-bottom:1px solid var(--line)}
.tot{display:grid;gap:6px;margin-top:6px}.tot div{display:flex;justify-content:space-between;gap:10px}.tot .big{font-family:Archivo,sans-serif;font-size:20px;color:var(--strong);border-top:1px solid var(--line);padding-top:8px;margin-top:4px}
.flash{padding:12px 14px;border-radius:8px;font-weight:700;margin-top:16px}.flash.ok{background:var(--ok-s);color:var(--ok)}.flash.bad{background:var(--bad-s);color:var(--bad)}
label{display:block;font-weight:700;font-size:14px;margin:12px 0 4px;color:var(--strong)}input[type=text],textarea{width:100%;border:1px solid #cdbfa6;border-radius:8px;padding:11px 12px;font:inherit;background:#fff;color:var(--strong)}textarea{min-height:90px;resize:vertical}
.chk{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin:14px 0}.chk input{margin-top:5px;width:18px;height:18px;accent-color:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--accent-d);background:var(--accent);color:#2a1b12;font:inherit;font-weight:700;padding:12px 20px;border-radius:8px;cursor:pointer;font-size:16px}
.btn.alt{background:#fff;border-color:#cdbfa6;color:var(--strong)}.hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.seal{font-family:ui-monospace,monospace;font-size:12.5px;color:var(--muted);word-break:break-all}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:10px}.photos figure{margin:0}.photos img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}.photos figcaption{font-size:12.5px;color:var(--muted);margin-top:4px}
.rtab{overflow-x:auto}.rtab table td{padding:4px}.rtab input[type=text],.rtab select,.rtab input[type=number]{width:100%;border:1px solid #cdbfa6;border-radius:6px;padding:8px;font:inherit;background:#fff}.rtab .x{border:0;background:transparent;font-size:20px;color:var(--bad);cursor:pointer}.rbtns{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.rbtns .btn{padding:8px 14px;font-size:14px}
@media(max-width:640px){.rtab thead{display:none}.rtab table,.rtab tbody{display:block}.rtab tr{display:grid;grid-template-columns:1.5fr 1fr .8fr 62px;gap:6px;padding:10px 0;border-bottom:1px solid var(--line);position:relative}.rtab td{padding:0;display:block}.rtab td.c-name,.rtab td.c-text{grid-column:1/-1}.rtab td.c-x{position:absolute;right:0;top:6px}.rtab td.c-name{padding-right:30px}}
.stars{display:inline-flex;flex-direction:row-reverse;gap:4px;font-size:34px}.stars input{display:none}.stars label{margin:0;cursor:pointer;color:#cdbfa6;font-size:34px}.stars input:checked~label,.stars label:hover,.stars label:hover~label{color:#d9a93a}
.foot{text-align:center;color:var(--muted);font-size:13px;margin-top:24px}
@media(max-width:560px){.steps{grid-template-columns:repeat(5,1fr)}.step{font-size:11px}.sides{grid-template-columns:1fr}}
</style>';
}

function render_logos(array $design, string $side): string
{
    $out = '';
    foreach (is_array($design['logos'] ?? null) ? $design['logos'] : [] as $logo) {
        if (!is_array($logo) || (($logo['side'] ?? 'front') === 'back' ? 'back' : 'front') !== $side) {
            continue;
        }
        $src = (string)($logo['src'] ?? '');
        if (!preg_match('~^data:image/(?:png|jpeg|webp|gif|svg\+xml);base64,~', $src) && !preg_match('~^https?://~', $src)) {
            continue;
        }
        $style = sprintf('left:%.2f%%;top:%.2f%%;width:%.2f%%;height:%.2f%%;transform:translate(-50%%,-50%%) rotate(%ddeg)', (float)($logo['x'] ?? 50), (float)($logo['y'] ?? 40), (float)($logo['width'] ?? 20), (float)($logo['height'] ?? 20), (int)($logo['rotation'] ?? 0));
        $tint = (string)($logo['tintColor'] ?? '');
        if (preg_match('/^#[0-9a-f]{6}$/i', $tint)) {
            $out .= '<div class="lg" style="' . $style . '"><span style="background-color:' . $tint . ';mask-image:url(' . h(json_encode($src)) . ');-webkit-mask-image:url(' . h(json_encode($src)) . ')"></span></div>';
        } else {
            $out .= '<div class="lg" style="' . $style . '"><img src="' . h($src) . '" alt="Logo"></div>';
        }
    }
    return $out;
}

$token = (string)($_GET['t'] ?? '');
if (login_locked_seconds('track') > 0) {
    public_page('Demasiados intentos', '<div class="card"><h1>Demasiados intentos</h1><p>Probá de nuevo en unos minutos.</p></div>', 429);
}
$state = load_state();
$idx = find_proposal_index_by_token($state, $token);
if ($idx === null) {
    login_register_failure('track');
    public_page('Link no válido', '<div class="card"><h1>Este link no es válido</h1><p>Puede haber vencido o haberse desactivado. Pedile a UNIFORMA que te envíe uno nuevo.</p></div>', 404);
}

if (isset($_GET['photo']) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $pp = $state['proposals'][$idx];
    foreach (is_array($pp['photos'] ?? null) ? $pp['photos'] : [] as $ph) {
        if (($ph['id'] ?? '') === (string)$_GET['photo'] && !empty($ph['shared']) && in_array($ph['ext'] ?? '', ['jpg', 'png', 'webp'], true) && preg_match('/^[a-z0-9-]+$/', (string)$ph['id'])) {
            $file = photos_dir((string)$pp['id']) . '/' . $ph['id'] . '.' . $ph['ext'];
            if (is_file($file)) {
                header('Content-Type: ' . ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$ph['ext']]);
                header('Cache-Control: private, max-age=3600');
                readfile($file);
                exit;
            }
        }
    }
    http_response_code(404);
    exit;
}

$flash = '';
$flashClass = 'ok';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $self = 'track.php?t=' . rawurlencode($token);
    $okCsrf = hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''));
    if (!$okCsrf || trim((string)($_POST['website'] ?? '')) !== '') {
        header('Location: ' . $self . '&e=session');
        exit;
    }
    acquire_state_lock();
    $state = load_state();
    $idx = find_proposal_index_by_token($state, $token);
    if ($idx === null) {
        header('Location: ' . $self);
        exit;
    }
    $p = $state['proposals'][$idx];
    $act = (string)($_POST['a'] ?? '');
    $client = null;
    foreach ($state['clients'] as $c) {
        if (($c['id'] ?? '') === ($p['clientId'] ?? '')) {
            $client = $c;
        }
    }
    $ownerId = (string)($p['ownerId'] ?? 'user-admin');
    $today = (new DateTimeImmutable('now', new DateTimeZone('America/Argentina/Buenos_Aires')))->format('Y-m-d');
    $closed = in_array((string)($p['status'] ?? ''), ['Rechazada', 'Entregada'], true);
    if ($act === 'approve' && !$closed && empty($p['artApproval']) && !empty($p['designs'])) {
        $name = trim((string)($_POST['name'] ?? ''));
        if (mb_strlen($name) < 3 || mb_strlen($name) > 120 || empty($_POST['confirm'])) {
            header('Location: ' . $self . '&e=data');
            exit;
        }
        $comment = mb_substr(trim((string)($_POST['comment'] ?? '')), 0, 600);
        finalize_design_approval($state, $idx, [
            'approvedBy' => $name, 'approvedAt' => $today, 'note' => $comment, 'recordedBy' => 'Cliente (link)',
            'via' => 'link', 'ip' => client_ip(), 'userAgent' => (string)($_SERVER['HTTP_USER_AGENT'] ?? ''),
        ]);
        $proposal = &$state['proposals'][$idx];
        if (in_array((string)$proposal['status'], ['Borrador', 'Enviada', 'Vista'], true)) {
            $prev = (string)$proposal['status'];
            $proposal['status'] = 'Aprobada';
            array_unshift($proposal['history'], history_entry('Cliente (link)', 'Estado actualizado', $prev . ' → Aprobada'));
            array_unshift($proposal['history'], history_entry('Cliente (link)', 'Presupuesto aceptado por el cliente', $name));
        }
        unset($proposal);
        array_unshift($state['tasks'], [
            'id' => 'task-' . bin2hex(random_bytes(5)), 'title' => 'El cliente aprobó ' . (string)$p['publicId'] . ': pasar a producción y pedir seña', 'clientId' => (string)($p['clientId'] ?? ''),
            'proposalId' => (string)$p['id'], 'dueDate' => $today, 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => $ownerId, 'note' => 'Aprobado por ' . $name . ' desde el link del cliente.', 'createdAt' => date('c'),
        ]);
        $state = push_audit($state, 'Diseño aprobado por el cliente (link)', (string)$p['publicId'] . ' · ' . $name);
        save_state($state);
        header('Location: ' . $self . '&ok=approved');
        exit;
    }
    if ($act === 'changes' && !$closed) {
        $comment = trim((string)($_POST['comment'] ?? ''));
        $name = mb_substr(trim((string)($_POST['name'] ?? '')), 0, 120);
        if (mb_strlen($comment) < 5) {
            header('Location: ' . $self . '&e=comment');
            exit;
        }
        $comment = mb_substr($comment, 0, 1000);
        $proposal = &$state['proposals'][$idx];
        $proposal['changeRequest'] = ['at' => date('c'), 'by' => $name, 'comment' => $comment];
        $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
        array_unshift($proposal['history'], history_entry('Cliente (link)', 'El cliente pidió cambios', ($name !== '' ? $name . ': ' : '') . $comment));
        unset($proposal);
        array_unshift($state['tasks'], [
            'id' => 'task-' . bin2hex(random_bytes(5)), 'title' => 'Responder pedido de cambios de ' . (string)$p['publicId'], 'clientId' => (string)($p['clientId'] ?? ''),
            'proposalId' => (string)$p['id'], 'dueDate' => $today, 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => $ownerId, 'note' => $comment, 'createdAt' => date('c'),
        ]);
        $state = push_audit($state, 'El cliente pidió cambios (link)', (string)$p['publicId']);
        save_state($state);
        header('Location: ' . $self . '&ok=changes');
        exit;
    }
    if ($act === 'roster' && !$closed && !empty($p['rosterEnabled']) && ($p['rosterStatus'] ?? '') !== 'applied') {
        $designIds = [];
        foreach ($p['designs'] ?? [] as $dd) {
            $designIds[(string)($dd['id'] ?? '')] = true;
        }
        $names = (array)($_POST['r_name'] ?? []);
        $rows = [];
        foreach ($names as $i => $nm) {
            $name = clean_text($nm, 80);
            $design = (string)(((array)($_POST['r_design'] ?? []))[$i] ?? '');
            $qty = (int)(((array)($_POST['r_qty'] ?? []))[$i] ?? 1);
            if ($name === '' && $qty <= 0) {
                continue;
            }
            if (!isset($designIds[$design]) || $qty < 1 || $qty > 99) {
                continue;
            }
            $rows[] = ['id' => 'ro-' . bin2hex(random_bytes(4)), 'name' => $name, 'designId' => $design, 'color' => clean_text(((array)($_POST['r_color'] ?? []))[$i] ?? '', 40), 'size' => clean_text(((array)($_POST['r_size'] ?? []))[$i] ?? '', 30), 'qty' => $qty, 'text' => clean_text(((array)($_POST['r_text'] ?? []))[$i] ?? '', 60)];
            if (count($rows) >= 300) {
                break;
            }
        }
        if (!$rows) {
            header('Location: ' . $self . '&e=roster');
            exit;
        }
        $proposal = &$state['proposals'][$idx];
        $proposal['roster'] = $rows;
        $proposal['rosterStatus'] = 'submitted';
        $proposal['rosterAt'] = date('c');
        $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
        array_unshift($proposal['history'], history_entry('Cliente (link)', 'El cliente envió la planilla de talles', count($rows) . ' renglón(es), ' . array_sum(array_column($rows, 'qty')) . ' prenda(s)'));
        unset($proposal);
        array_unshift($state['tasks'], ['id' => 'task-' . bin2hex(random_bytes(5)), 'title' => 'Revisar planilla de talles de ' . (string)$p['publicId'], 'clientId' => (string)($p['clientId'] ?? ''), 'proposalId' => (string)$p['id'], 'dueDate' => $today, 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => $ownerId, 'note' => count($rows) . ' renglones enviados por el cliente.', 'createdAt' => date('c')]);
        $state = push_audit($state, 'Planilla de talles recibida (link)', (string)$p['publicId']);
        save_state($state);
        header('Location: ' . $self . '&ok=roster');
        exit;
    }
    if ($act === 'survey' && (string)($p['status'] ?? '') === 'Entregada' && empty($p['survey'])) {
        $rating = (int)($_POST['rating'] ?? 0);
        if ($rating < 1 || $rating > 5) {
            header('Location: ' . $self . '&e=survey');
            exit;
        }
        $comment = clean_text($_POST['comment'] ?? '', 600);
        $proposal = &$state['proposals'][$idx];
        $proposal['survey'] = ['rating' => $rating, 'comment' => $comment, 'at' => date('c')];
        $proposal['history'] = is_array($proposal['history'] ?? null) ? $proposal['history'] : [];
        array_unshift($proposal['history'], history_entry('Cliente (link)', 'Encuesta respondida', $rating . '/5' . ($comment !== '' ? ' · ' . $comment : '')));
        unset($proposal);
        if ($rating <= 3) {
            array_unshift($state['tasks'], ['id' => 'task-' . bin2hex(random_bytes(5)), 'title' => 'Contactar a ' . (string)($client['company'] ?? 'el cliente') . ': encuesta baja (' . $rating . '/5) en ' . (string)$p['publicId'], 'clientId' => (string)($p['clientId'] ?? ''), 'proposalId' => (string)$p['id'], 'dueDate' => $today, 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => $ownerId, 'note' => $comment, 'createdAt' => date('c')]);
        }
        $state = push_audit($state, 'Encuesta respondida (link)', (string)$p['publicId'] . ' · ' . $rating . '/5');
        save_state($state);
        header('Location: ' . $self . '&ok=survey');
        exit;
    }
    if ($act === 'repeat') {
        $refId = (string)($_POST['ref'] ?? '');
        $ref = null;
        foreach ($state['proposals'] as $other) {
            if (($other['id'] ?? '') === $refId && ($other['clientId'] ?? '') === ($p['clientId'] ?? '') && ($other['status'] ?? '') === 'Entregada') {
                $ref = $other;
            }
        }
        if ($ref === null) {
            header('Location: ' . $self . '&e=closed');
            exit;
        }
        $leadId = add_lead($state, [
            'source' => 'recompra', 'name' => (string)($client['contact'] ?? ''), 'company' => (string)($client['company'] ?? ''), 'email' => (string)($client['email'] ?? ''), 'phone' => (string)($client['phone'] ?? ''),
            'message' => 'Quiere repetir el pedido ' . (string)$ref['publicId'] . '. ' . clean_text($_POST['note'] ?? '', 500), 'product' => (string)$ref['title'], 'proposalRef' => (string)$ref['id'], 'clientId' => (string)($p['clientId'] ?? ''),
        ]);
        if ($leadId !== null) {
            array_unshift($state['tasks'], ['id' => 'task-' . bin2hex(random_bytes(5)), 'title' => 'Recompra pedida por ' . (string)($client['company'] ?? 'el cliente') . ' (repetir ' . (string)$ref['publicId'] . ')', 'clientId' => (string)($p['clientId'] ?? ''), 'proposalId' => (string)$ref['id'], 'dueDate' => $today, 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => $ownerId, 'note' => clean_text($_POST['note'] ?? '', 500), 'createdAt' => date('c')]);
            $state = push_audit($state, 'Recompra pedida (link)', (string)$ref['publicId']);
            save_state($state);
        }
        header('Location: ' . $self . '&ok=repeat');
        exit;
    }
    header('Location: ' . $self . '&e=closed');
    exit;
}

// Vista GET: contar visita (cada 20 min como máximo) y pasar "Enviada" a "Vista".
$p = $state['proposals'][$idx];
$track = tracking_load();
$last = (string)($track[(string)$p['id']]['lastViewedAt'] ?? '');
if ($last === '' || (time() - strtotime($last)) > 1200) {
    tracking_touch((string)$p['id']);
}
if (($p['status'] ?? '') === 'Enviada') {
    acquire_state_lock();
    $state = load_state();
    $idx = find_proposal_index_by_token($state, $token);
    if ($idx !== null && ($state['proposals'][$idx]['status'] ?? '') === 'Enviada') {
        $state['proposals'][$idx]['status'] = 'Vista';
        $state['proposals'][$idx]['history'] = is_array($state['proposals'][$idx]['history'] ?? null) ? $state['proposals'][$idx]['history'] : [];
        array_unshift($state['proposals'][$idx]['history'], history_entry('Cliente (link)', 'Estado actualizado', 'Enviada → Vista'));
        array_unshift($state['proposals'][$idx]['history'], history_entry('Cliente (link)', 'El cliente abrió el link', ''));
        save_state($state);
        $p = $state['proposals'][$idx];
    }
}

$client = ['company' => '', 'contact' => ''];
foreach ($state['clients'] as $c) {
    if (($c['id'] ?? '') === ($p['clientId'] ?? '')) {
        $client = $c;
    }
}
$products = [];
foreach ($state['products'] as $prod) {
    $products[(string)($prod['id'] ?? '')] = $prod;
}
$status = (string)($p['status'] ?? 'Borrador');
$stepIndex = ['Borrador' => 0, 'Enviada' => 0, 'Vista' => 0, 'Aprobada' => 1, 'En producción' => 2, 'Lista' => 3, 'Entregada' => 4, 'Rechazada' => 0][$status] ?? 0;
$labels = ['Presupuesto', 'Aprobado', 'En producción', 'Listo', 'Entregado'];
$pillClass = in_array($status, ['Lista', 'Entregada', 'Aprobada'], true) ? 'ok' : ($status === 'Rechazada' ? 'bad' : 'warn');
$publicStatus = ['Borrador' => 'Preparando tu presupuesto', 'Enviada' => 'Esperando tu respuesta', 'Vista' => 'Esperando tu respuesta', 'Aprobada' => 'Aprobado, por pasar a producción', 'En producción' => 'En producción', 'Lista' => 'Listo para retirar o enviar', 'Entregada' => 'Entregado', 'Rechazada' => 'Presupuesto cerrado'][$status] ?? $status;
$sum = proposal_totals_php($p);
$closed = in_array($status, ['Rechazada', 'Entregada'], true);
$company = (string)($state['settings']['companyName'] ?? 'UNIFORMA');
$wa = preg_replace('/\D/', '', (string)($state['settings']['whatsapp'] ?? ''));

ob_start();
?>
<div class="card top">
  <div class="brand"><img src="assets/brand/uniforma-logo-print.jpg" alt="<?= h($company) ?>"><small>Seguimiento de tu pedido</small></div>
  <h1><?= h($p['publicId'] ?? '') ?> · <?= h($p['title'] ?? '') ?></h1>
  <p><?= h($client['company'] ?? '') ?><?= !empty($client['contact']) ? ' · ' . h($client['contact']) : '' ?></p>
  <?php if ($status !== 'Rechazada'): ?>
  <div class="steps"><?php foreach ($labels as $i => $label): ?><div class="step <?= $i < $stepIndex ? 'done' : ($i === $stepIndex ? 'now' : '') ?>"><?= h($label) ?></div><?php endforeach; ?></div>
  <?php endif; ?>
  <div class="meta">
    <div><small>Estado</small><b><span class="pill <?= $pillClass ?>"><?= h($publicStatus) ?></span></b></div>
    <div><small>Entrega estimada</small><b><?= h(date_ar((string)($p['deliveryDate'] ?? ''))) ?></b></div>
    <div><small>Presupuesto válido hasta</small><b><?= h(date_ar((string)($p['validUntil'] ?? ''))) ?></b></div>
    <div><small>Diseño</small><b><?= !empty($p['artApproval']) ? '<span class="pill ok">Aprobado</span>' : '<span class="pill warn">Pendiente de aprobación</span>' ?></b></div>
  </div>
</div>
<?php
$ok = (string)($_GET['ok'] ?? '');
$err = (string)($_GET['e'] ?? '');
if ($ok === 'approved') {
    echo '<div class="flash ok">¡Gracias! Registramos tu aprobación. Nos ponemos a trabajar y te avisamos cuando esté listo.</div>';
} elseif ($ok === 'changes') {
    echo '<div class="flash ok">Recibimos tu pedido de cambios. Te vamos a responder a la brevedad.</div>';
} elseif ($ok === 'roster') {
    echo '<div class="flash ok">¡Listo! Recibimos tu planilla de talles. Si querés corregir algo, podés volver a enviarla antes de que la confirmemos.</div>';
} elseif ($ok === 'survey') {
    echo '<div class="flash ok">¡Gracias por tu opinión! Nos ayuda a mejorar.</div>';
} elseif ($ok === 'repeat') {
    echo '<div class="flash ok">Recibimos tu pedido de recompra. Te contactamos enseguida con el presupuesto.</div>';
} elseif ($err !== '') {
    $msg = ['session' => 'La sesión venció. Recargá la página e intentá de nuevo.', 'data' => 'Completá tu nombre y tildá la confirmación.', 'comment' => 'Contanos qué querés cambiar (mínimo 5 letras).', 'closed' => 'Este pedido ya no admite cambios desde el link.', 'roster' => 'Cargá al menos una persona con prenda y cantidad.', 'survey' => 'Elegí una puntuación de 1 a 5.'][$err] ?? 'No pudimos procesar tu respuesta.';
    echo '<div class="flash bad">' . h($msg) . '</div>';
}
?>
<div class="card">
  <h2>Prendas y personalización</h2>
  <?php if (empty($p['designs'])): ?><p>Todavía estamos cargando las prendas de tu pedido.</p><?php endif; ?>
  <?php foreach ($p['designs'] ?? [] as $design):
      if (!is_array($design)) { continue; }
      $prod = $products[(string)($design['productId'] ?? '')] ?? [];
      $rows = variant_rows_php($design, $prod);
  ?>
  <section class="design">
    <h3><?= h($prod['name'] ?? 'Prenda') ?> <span class="pill"><?= (int)($design['qty'] ?? 0) ?> u.</span></h3>
    <p><?= h(implode(' · ', array_map(static fn($r) => $r['qty'] . ' ' . $r['color'] . ' ' . $r['size'], array_filter($rows, static fn($r) => $r['qty'] > 0)))) ?></p>
    <div class="sides">
      <?php foreach (['front' => 'FRENTE', 'back' => 'ESPALDA'] as $side => $label):
          $img = $side === 'back' ? ($prod['imageBack'] ?? $prod['image'] ?? '') : ($prod['image'] ?? '');
          $logos = render_logos($design, $side);
          if ($side === 'back' && $logos === '') { continue; } ?>
      <div class="side"><b><?= $label ?></b><div class="art"><?php if ($img !== ''): ?><img class="garment" src="<?= h($img) ?>" alt="" onerror="this.style.display='none'"><?php endif; ?><?= $logos ?></div></div>
      <?php endforeach; ?>
    </div>
    <?php if (!empty($design['logos'])): ?>
    <table><thead><tr><th>Logo</th><th>Lugar</th><th>Técnica</th><th>Medida</th></tr></thead><tbody>
      <?php foreach ($design['logos'] as $logo): ?>
      <tr><td><?= h($logo['name'] ?? 'Logo') ?></td><td><?= (($logo['side'] ?? 'front') === 'back') ? 'Espalda' : 'Frente' ?><?= !empty($logo['placement']) ? ' · ' . h($logo['placement']) : '' ?></td><td><?= h($logo['technique'] ?? '') ?></td><td><?= ((float)($logo['widthCm'] ?? 0) > 0) ? h(rtrim(rtrim(number_format((float)$logo['widthCm'], 1, ',', ''), '0'), ',')) . ' × ' . h(rtrim(rtrim(number_format((float)($logo['heightCm'] ?? 0), 1, ',', ''), '0'), ',')) . ' cm' : '—' ?></td></tr>
      <?php endforeach; ?>
    </tbody></table>
    <?php endif; ?>
    <?php if (!empty($design['note'])): ?><p><b>Observaciones:</b> <?= h($design['note']) ?></p><?php endif; ?>
  </section>
  <?php endforeach; ?>
</div>
<div class="card">
  <h2>Importes</h2>
  <div class="tot">
    <div><span>Total del pedido</span><b><?= money_ar($sum['total']) ?></b></div>
    <div><span>Pagos confirmados</span><b><?= money_ar($sum['paid']) ?></b></div>
    <?php if ($sum['pending'] > 0): ?><div><span>Pagos en revisión</span><b><?= money_ar($sum['pending']) ?></b></div><?php endif; ?>
    <div class="big"><span>Saldo</span><b><?= money_ar($sum['balance']) ?></b></div>
  </div>
</div>
<?php
$shared = array_values(array_filter(is_array($p['photos'] ?? null) ? $p['photos'] : [], static fn($ph) => !empty($ph['shared'])));
if ($shared): ?>
<div class="card"><h2>Tu pedido terminado</h2><div class="photos">
  <?php foreach ($shared as $ph): ?><figure><img src="track.php?t=<?= h($token) ?>&photo=<?= h($ph['id']) ?>" alt="<?= h($ph['caption'] ?? 'Foto del pedido') ?>" loading="lazy"><?php if (!empty($ph['caption'])): ?><figcaption><?= h($ph['caption']) ?></figcaption><?php endif; ?></figure><?php endforeach; ?>
</div></div>
<?php endif; ?>
<?php if (!empty($p['rosterEnabled']) && !$closed && ($p['rosterStatus'] ?? '') !== 'applied' && !empty($p['designs'])):
    $rosterRows = is_array($p['roster'] ?? null) && $p['roster'] ? $p['roster'] : array_fill(0, 5, ['name' => '', 'designId' => (string)($p['designs'][0]['id'] ?? ''), 'color' => '', 'size' => '', 'qty' => 1, 'text' => '']);
    $designsInfo = [];
    foreach ($p['designs'] as $dd) {
        $pr = $products[(string)($dd['productId'] ?? '')] ?? [];
        $colors = [];
        foreach (variant_rows_php($dd, $pr) as $vr) { $colors[$vr['color']] = true; }
        foreach (is_array($pr['colors'] ?? null) ? $pr['colors'] : [] as $cc) { $colors[(string)(is_array($cc) ? ($cc['name'] ?? '') : $cc)] = true; }
        $sizes = product_sizes_php($pr);
        foreach (variant_rows_php($dd, $pr) as $vr) { if (!in_array($vr['size'], $sizes, true)) { $sizes[] = $vr['size']; } }
        $designsInfo[(string)$dd['id']] = ['name' => (string)($pr['name'] ?? 'Prenda'), 'colors' => array_keys(array_filter($colors, static fn($k) => $k !== '', ARRAY_FILTER_USE_KEY)), 'sizes' => $sizes];
    }
?>
<div class="card" id="roster">
  <h2>Planilla de talles y nombres</h2>
  <p>Cargá una fila por persona: el talle de cada uno y, si corresponde, el nombre o texto que va bordado. Podés pegar una lista desde Excel (nombre, talle, texto).<?= ($p['rosterStatus'] ?? '') === 'submitted' ? ' <b>Ya enviaste una planilla; podés corregirla y reenviarla.</b>' : '' ?></p>
  <form method="post" id="rosterForm">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="a" value="roster">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="rtab"><table><thead><tr><th>Nombre / persona</th><th>Prenda</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Texto a bordar</th><th></th></tr></thead><tbody id="rosterBody"></tbody></table></div>
    <div class="rbtns"><button class="btn alt" type="button" id="rosterAdd">+ Agregar fila</button><button class="btn alt" type="button" id="rosterPaste">Pegar lista de Excel</button><span id="rosterCount" style="align-self:center;color:var(--muted)"></span></div>
    <textarea id="rosterPasteBox" style="display:none;margin-top:10px" placeholder="Una persona por línea: nombre ; talle ; texto a bordar (separado por tabulación, punto y coma o coma)"></textarea>
    <p style="margin-top:12px"><button class="btn" type="submit">Enviar planilla</button></p>
  </form>
  <script>
  (function(){
    var designs = <?= json_encode($designsInfo, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
    var rows = <?= json_encode(array_values($rosterRows), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?>;
    var body = document.getElementById('rosterBody'), firstDesign = Object.keys(designs)[0];
    function opt(list, val){ return list.map(function(v){ return '<option' + (v === val ? ' selected' : '') + '>' + String(v).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}) + '</option>'; }).join(''); }
    function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
    function addRow(r){
      r = r || {}; var d = designs[r.designId] ? r.designId : firstDesign, info = designs[d], tr = document.createElement('tr');
      var dsel = '<select name="r_design[]">' + Object.keys(designs).map(function(k){ return '<option value="' + esc(k) + '"' + (k === d ? ' selected' : '') + '>' + esc(designs[k].name) + '</option>'; }).join('') + '</select>';
      tr.innerHTML = '<td class="c-name"><input type="text" name="r_name[]" maxlength="80" placeholder="Nombre de la persona" value="' + esc(r.name) + '"></td><td>' + dsel + '</td><td><select name="r_color[]">' + opt(info.colors, r.color) + '</select></td><td><select name="r_size[]">' + opt(info.sizes, r.size) + '</select></td><td><input type="number" name="r_qty[]" min="1" max="99" value="' + (r.qty || 1) + '" style="width:64px"></td><td class="c-text"><input type="text" name="r_text[]" maxlength="60" placeholder="Texto a bordar (opcional)" value="' + esc(r.text) + '"></td><td class="c-x"><button type="button" class="x" aria-label="Quitar">×</button></td>';
      tr.querySelector('select[name="r_design[]"]').addEventListener('change', function(){ var i = designs[this.value]; tr.querySelector('select[name="r_color[]"]').innerHTML = opt(i.colors, ''); tr.querySelector('select[name="r_size[]"]').innerHTML = opt(i.sizes, ''); });
      tr.querySelector('.x').addEventListener('click', function(){ tr.remove(); count(); });
      tr.addEventListener('input', count);
      body.appendChild(tr); count();
    }
    function count(){ var n = 0; body.querySelectorAll('input[name="r_qty[]"]').forEach(function(i){ n += parseInt(i.value || '0', 10) || 0; }); document.getElementById('rosterCount').textContent = body.children.length + ' fila(s) · ' + n + ' prenda(s)'; }
    rows.forEach(addRow);
    document.getElementById('rosterAdd').addEventListener('click', function(){ addRow({designId: firstDesign}); });
    var box = document.getElementById('rosterPasteBox');
    document.getElementById('rosterPaste').addEventListener('click', function(){
      if (box.style.display === 'none') { box.style.display = 'block'; box.focus(); this.textContent = 'Aplicar lista'; return; }
      box.value.split(/\r?\n/).forEach(function(line){
        if (!line.trim()) return; var c = line.split(/\t|;|,/);
        var info = designs[firstDesign], size = (c[1] || '').trim().toUpperCase();
        addRow({designId: firstDesign, name: (c[0] || '').trim(), size: info.sizes.indexOf(size) >= 0 ? size : (info.sizes[0] || ''), text: (c[2] || '').trim(), qty: 1});
      });
      box.value = ''; box.style.display = 'none'; this.textContent = 'Pegar lista de Excel';
    });
  })();
  </script>
</div>
<?php elseif (!empty($p['roster']) && ($p['rosterStatus'] ?? '') === 'applied'): ?>
<div class="card"><h2>Planilla de talles</h2><p>Ya cargamos tu planilla (<?= count($p['roster']) ?> renglones) en el pedido. Gracias.</p></div>
<?php endif; ?>
<?php if ($status === 'Entregada' && empty($p['survey'])): ?>
<div class="card"><h2>¿Cómo te fue con tu pedido?</h2>
  <form method="post"><input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="a" value="survey">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="stars"><?php for ($s = 5; $s >= 1; $s--): ?><input type="radio" name="rating" id="st<?= $s ?>" value="<?= $s ?>" required><label for="st<?= $s ?>" title="<?= $s ?> de 5">★</label><?php endfor; ?></div>
    <label for="sc">Comentario (opcional)</label><textarea id="sc" name="comment" maxlength="600"></textarea>
    <p><button class="btn" type="submit">Enviar opinión</button></p></form></div>
<?php elseif (!empty($p['survey'])): ?>
<div class="card"><h2>Tu opinión</h2><p>Puntuaste este pedido con <b><?= (int)$p['survey']['rating'] ?>/5</b>. ¡Gracias!</p></div>
<?php endif; ?>
<?php
$prevOrders = [];
foreach ($state['proposals'] as $other) {
    if (($other['clientId'] ?? '') === ($p['clientId'] ?? '') && ($other['id'] ?? '') !== ($p['id'] ?? '') && ($other['status'] ?? '') === 'Entregada') {
        $prevOrders[] = $other;
    }
}
if ($status === 'Entregada') { array_unshift($prevOrders, $p); }
if ($prevOrders): ?>
<div class="card"><h2>¿Querés repetir un pedido?</h2><p>Elegí uno de tus pedidos anteriores y te preparamos un presupuesto actualizado, con los mismos productos y logos.</p>
  <?php foreach (array_slice($prevOrders, 0, 5) as $po): ?>
  <form method="post" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding:10px 0">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="a" value="repeat"><input type="hidden" name="ref" value="<?= h($po['id']) ?>">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <span style="flex:1;min-width:200px"><b><?= h($po['publicId']) ?></b> · <?= h($po['title'] ?? '') ?> <small style="color:var(--muted)">(<?= h(date_ar((string)($po['updatedDate'] ?? ''))) ?>)</small></span>
    <input type="text" name="note" maxlength="300" placeholder="Cambios o cantidades (opcional)" style="flex:1;min-width:180px">
    <button class="btn alt" type="submit">Pedir de nuevo</button>
  </form>
  <?php endforeach; ?></div>
<?php endif; ?>
<?php if (!empty($p['artApproval'])): $a = $p['artApproval']; ?>
<div class="card">
  <h2>Aprobación registrada</h2>
  <p>Aprobado por <b><?= h($a['approvedBy'] ?? '') ?></b> el <?= h(date_ar((string)($a['approvedAt'] ?? ''))) ?> · versión <?= (int)($a['revision'] ?? 1) ?>.</p>
  <?php if (!empty($a['contentHash'])): ?><p class="seal">Código de verificación: <?= h(substr((string)$a['contentHash'], 0, 24)) ?></p><?php endif; ?>
</div>
<?php endif; ?>
<?php if (!$closed): ?>
<div class="card">
  <h2><?= empty($p['artApproval']) ? '¿Está todo bien?' : '¿Querés pedir algún cambio?' ?></h2>
  <?php if (empty($p['artApproval']) && !empty($p['designs'])): ?>
  <p>Revisá las prendas, los logos y las medidas. Si está todo correcto, aprobá para que empecemos a producir.</p>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="a" value="approve">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label for="n1">Tu nombre y apellido</label><input id="n1" type="text" name="name" required minlength="3" maxlength="120" autocomplete="name">
    <label for="c1">Comentario (opcional)</label><textarea id="c1" name="comment" maxlength="600"></textarea>
    <label class="chk"><input type="checkbox" name="confirm" value="1" required> <span>Revisé el pedido y <b>apruebo el presupuesto y el diseño</b> tal como se muestran.</span></label>
    <button class="btn" type="submit">Aprobar</button>
  </form>
  <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
  <?php endif; ?>
  <p><b>¿Querés cambiar algo?</b> Contanos qué y lo ajustamos.</p>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>"><input type="hidden" name="a" value="changes">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label for="n2">Tu nombre (opcional)</label><input id="n2" type="text" name="name" maxlength="120">
    <label for="c2">Qué querés cambiar</label><textarea id="c2" name="comment" required minlength="5" maxlength="1000"></textarea>
    <button class="btn alt" type="submit">Pedir cambios</button>
  </form>
</div>
<?php endif; ?>
<p class="foot"><?= h($company) ?><?= $wa !== '' ? ' · <a href="https://wa.me/' . h($wa) . '" style="color:inherit">WhatsApp</a>' : '' ?></p>
<?php
public_page($p['publicId'] . ' · Seguimiento', (string)ob_get_clean());
