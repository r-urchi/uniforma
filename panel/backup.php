<?php
declare(strict_types=1);

/** Descarga un respaldo completo (ZIP) de los datos del panel. Solo quien tiene settings.manage. */
require __DIR__ . '/bootstrap.php';
require_login();
if (!can_user(current_user(), 'settings.manage')) {
    http_response_code(403);
    json_response(['ok' => false, 'error' => 'No tenés permiso para descargar respaldos.']);
}
if (!class_exists('ZipArchive')) {
    http_response_code(501);
    json_response(['ok' => false, 'error' => 'Este servidor no tiene la extensión ZIP de PHP. Pedile a Hostinger que la active o usá «Exportar backup» (JSON).']);
}
$tmp = tempnam(sys_get_temp_dir(), 'uf-backup-');
if ($tmp === false || !make_backup_zip($tmp)) {
    @unlink((string)$tmp);
    http_response_code(500);
    json_response(['ok' => false, 'error' => 'No se pudo armar el respaldo.']);
}
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="uniforma-respaldo-' . date('Ymd-Hi') . '.zip"');
header('Content-Length: ' . filesize($tmp));
header('Cache-Control: no-store');
readfile($tmp);
@unlink($tmp);
exit;
