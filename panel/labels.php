<?php
declare(strict_types=1);

/**
 * Etiquetas QR para taller (A4, 8 por hoja). Cada QR abre el pedido en el panel (y, escaneado desde el panel,
 * deja marcar los pasos de control de esa prenda).
 *   labels.php?p=ID_PROPUESTA            una etiqueta por prenda (línea del pedido)
 *   labels.php?p=ID_PROPUESTA&per=unit   una etiqueta por unidad (hasta 300)
 */
require __DIR__ . '/bootstrap.php';
if (!is_logged_in()) {
    header('Location: ./');
    exit;
}
if (!can_user(current_user(), 'proposals.view') && !can_user(current_user(), 'tasks.view')) {
    http_response_code(403);
    echo 'Sin permiso.';
    exit;
}

function h($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

$state = load_state();
$proposal = null;
foreach ($state['proposals'] as $p) {
    if (($p['id'] ?? '') === (string)($_GET['p'] ?? '')) {
        $proposal = $p;
    }
}
if (!$proposal) {
    http_response_code(404);
    echo 'No se encontró la propuesta.';
    exit;
}
$client = [];
foreach ($state['clients'] as $c) {
    if (($c['id'] ?? '') === ($proposal['clientId'] ?? '')) {
        $client = $c;
    }
}
$products = [];
foreach ($state['products'] as $prod) {
    $products[(string)($prod['id'] ?? '')] = $prod;
}
$perUnit = ($_GET['per'] ?? '') === 'unit';
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$base = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/panel/labels.php')), '/') . '/';

$labels = [];
$designs = is_array($proposal['designs'] ?? null) ? $proposal['designs'] : [];
foreach ($designs as $di => $design) {
    $prod = $products[(string)($design['productId'] ?? '')] ?? [];
    $rows = array_values(array_filter(variant_rows_php($design, $prod), static fn($r) => $r['qty'] > 0));
    $url = $base . '?p=' . rawurlencode((string)$proposal['id']) . '&d=' . rawurlencode((string)($design['id'] ?? ''));
    if ($perUnit) {
        $total = array_sum(array_column($rows, 'qty'));
        $n = 0;
        foreach ($rows as $r) {
            for ($k = 0; $k < $r['qty'] && count($labels) < 300; $k++) {
                $n++;
                $labels[] = ['url' => $url, 'prenda' => (string)($prod['name'] ?? 'Prenda'), 'detalle' => $r['color'] . ' · talle ' . $r['size'], 'extra' => 'Unidad ' . $n . ' de ' . $total, 'line' => ($di + 1) . '/' . count($designs)];
            }
        }
    } else {
        $detail = implode(' · ', array_map(static fn($r) => $r['qty'] . ' ' . $r['color'] . ' ' . $r['size'], $rows));
        $labels[] = ['url' => $url, 'prenda' => (string)($prod['name'] ?? 'Prenda'), 'detalle' => $detail, 'extra' => (int)($design['qty'] ?? 0) . ' unidades', 'line' => ($di + 1) . '/' . count($designs)];
    }
}
$self = 'labels.php?p=' . rawurlencode((string)$proposal['id']);
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Etiquetas <?= h($proposal['publicId']) ?></title>
<style>
@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#2b241f;background:#eee}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 14px;background:#2a1b12;color:#fff}
.bar a,.bar button{border:1px solid #b77a2b;background:#b77a2b;color:#2a1b12;font-weight:700;padding:8px 14px;border-radius:6px;text-decoration:none;cursor:pointer;font:inherit}
.bar a.alt{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}.bar a.on{background:#fff;border-color:#fff}
.sheet{width:194mm;margin:12px auto;display:grid;grid-template-columns:1fr 1fr;gap:3mm;background:#fff;padding:3mm}
.lb{height:65mm;border:1px dashed #999;border-radius:3mm;padding:4mm;display:grid;grid-template-columns:1fr 34mm;gap:3mm;break-inside:avoid;overflow:hidden}
.lb b{display:block;font-size:15px;line-height:1.15}.lb .ord{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a5a20;font-weight:700}
.lb .cl{font-size:12px;margin:1mm 0 2.5mm}.lb .pr{font-size:14px;font-weight:700}.lb .dt{font-size:12px;margin-top:1mm;line-height:1.3}.lb .ex{margin-top:2mm;font-size:12px;font-weight:700}
.lb .meta{font-size:10.5px;color:#555;margin-top:2mm}.qr{align-self:center}.qr svg{width:34mm;height:34mm;display:block}.qrcap{font-size:8.5px;text-align:center;color:#555;margin-top:1mm}
@media print{body{background:#fff}.bar{display:none}.sheet{margin:0;padding:0;width:auto}}
</style></head><body>
<div class="bar"><b><?= h($proposal['publicId']) ?> · <?= h($client['company'] ?? '') ?></b>
  <a class="<?= $perUnit ? 'alt' : 'on' ?>" href="<?= h($self) ?>">Una por prenda</a><a class="<?= $perUnit ? 'on' : 'alt' ?>" href="<?= h($self . '&per=unit') ?>">Una por unidad</a>
  <span style="flex:1"></span><span><?= count($labels) ?> etiqueta(s)</span><button onclick="window.print()">Imprimir</button></div>
<div class="sheet">
<?php foreach ($labels as $i => $l): ?>
  <div class="lb"><div><div class="ord"><?= h($proposal['publicId']) ?> · prenda <?= h($l['line']) ?></div><div class="cl"><b><?= h($client['company'] ?? '') ?></b></div>
    <div class="pr"><?= h($l['prenda']) ?></div><div class="dt"><?= h($l['detalle']) ?></div><div class="ex"><?= h($l['extra']) ?></div>
    <div class="meta">Entrega <?= h(implode('/', array_reverse(explode('-', (string)($proposal['deliveryDate'] ?? ''))))) ?></div></div>
    <div><div class="qr" data-qr="<?= h($l['url']) ?>"></div><div class="qrcap">Escanear en el panel</div></div></div>
<?php endforeach; ?>
<?php if (!$labels): ?><p style="padding:20px">La propuesta todavía no tiene prendas.</p><?php endif; ?>
</div>
<script src="studio/vendor/qrcode.js"></script>
<script>
document.querySelectorAll('[data-qr]').forEach(function (el) {
  var qr = qrcode(0, 'M'); qr.addData(el.getAttribute('data-qr')); qr.make(); el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
});
</script></body></html>
