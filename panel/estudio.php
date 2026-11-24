<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if (!is_logged_in()) {
    header('Location: ./');
    exit;
}
if (!can_user(current_user(), 'editor.use')) {
    http_response_code(403);
    echo 'No tenés permiso para usar el Estudio de logos.';
    exit;
}

$v = '20261015-1';
?>
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>Estudio de logos · UNIFORMA</title>
    <link rel="stylesheet" href="studio/studio.css?v=<?= $v ?>" />
  </head>
  <body>
    <script>
      window.STUDIO_BOOT = {
        csrf: <?= json_encode(csrf_token()) ?>,
        user: <?= json_encode((string)(current_user()['name'] ?? '')) ?>,
        canManageCatalog: <?= json_encode(can_user(current_user(), 'catalog.view')) ?>,
      };
    </script>
    <div id="app" class="studio">
      <header class="topbar" id="topbar"></header>
      <aside class="rail" id="rail"></aside>
      <aside class="leftpanel" id="leftpanel"></aside>
      <main class="workspace" id="workspace">
        <div id="stageHost"></div>
        <div class="zoombar" id="zoombar"></div>
        <div class="hint" id="hint"></div>
      </main>
      <aside class="props" id="props"></aside>
    </div>
    <div class="toast" id="toast" role="status"></div>
    <div class="modal-backdrop" id="modal" hidden></div>
    <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden />
    <script src="studio/vendor/konva.min.js"></script>
    <script src="studio/studio.js?v=<?= $v ?>"></script>
  </body>
</html>
