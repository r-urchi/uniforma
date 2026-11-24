<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

function panel_next_url(): string
{
    $p = (string)($_GET['p'] ?? '');
    $d = (string)($_GET['d'] ?? '');
    if (preg_match('/^[A-Za-z0-9_-]{1,80}$/', $p)) {
        return './?p=' . rawurlencode($p) . (preg_match('/^[A-Za-z0-9_-]{1,80}$/', $d) ? '&d=' . rawurlencode($d) : '');
    }
    return './';
}

$loginError = '';
$setupError = '';
$setupMode = needs_setup();

if ($setupMode && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'setup') {
    $name = trim((string)($_POST['name'] ?? ''));
    $username = trim((string)($_POST['user'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $confirm = (string)($_POST['confirm'] ?? '');
    $key = (string)($_POST['setup_key'] ?? '');
    $requiredKey = (string)($config['setup_key'] ?? '');
    if ($requiredKey !== '' && !hash_equals($requiredKey, $key)) {
        $setupError = 'La clave de instalación no es correcta.';
    } elseif ($name === '' || $username === '') {
        $setupError = 'Completá nombre y usuario.';
    } elseif (strlen($password) < 10) {
        $setupError = 'La contraseña debe tener al menos 10 caracteres.';
    } elseif ($password !== $confirm) {
        $setupError = 'Las contraseñas no coinciden.';
    } else {
        acquire_state_lock();
        if (needs_setup()) {
            $admin = create_first_admin($name, $username, $password);
            session_regenerate_id(true);
            $_SESSION['uniforma_logged_in'] = true;
            $_SESSION['uniforma_user_id'] = $admin['id'];
            csrf_token();
            save_state(push_audit(load_state(), 'Instalación', 'Se creó el administrador inicial.'));
            header('Location: ./');
            exit;
        }
    }
}

if (!$setupMode && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    $user = trim((string)($_POST['user'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $wait = login_locked_seconds($user);

    if ($wait > 0) {
        $loginError = 'Demasiados intentos. Probá de nuevo en ' . max(1, (int)ceil($wait / 60)) . ' min.';
    } else {
        $foundUser = find_user_by_login($user);
        if ($foundUser && !empty($foundUser['active']) && verify_user_password($foundUser, $password)) {
            login_register_success($user);
            acquire_state_lock();
            update_user_login_stamp((string)$foundUser['id'], $password);
            if (user_has_totp($foundUser)) {
                // Segundo paso: todavía NO hay sesión iniciada, solo un pendiente de 5 minutos.
                session_regenerate_id(true);
                unset($_SESSION['uniforma_logged_in'], $_SESSION['uniforma_user_id']);
                $_SESSION['pending_2fa'] = ['id' => (string)$foundUser['id'], 'until' => time() + 300];
                $needSecondFactor = true;
            } else {
                session_regenerate_id(true);
                $_SESSION['uniforma_logged_in'] = true;
                $_SESSION['uniforma_user_id'] = $foundUser['id'];
                csrf_token();
                header('Location: ' . panel_next_url());
                exit;
            }
        } else {
            login_register_failure($user);
            $loginError = 'Usuario o contraseña incorrectos.';
        }
    }
}

if (!$setupMode && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login2') {
    $pending = $_SESSION['pending_2fa'] ?? null;
    if (!is_array($pending) || (int)($pending['until'] ?? 0) < time()) {
        unset($_SESSION['pending_2fa']);
        $loginError = 'La verificación venció. Ingresá de nuevo.';
    } else {
        $needSecondFactor = true;
        $key = '2fa:' . (string)$pending['id'];
        if (login_locked_seconds($key) > 0) {
            $loginError = 'Demasiados intentos. Probá de nuevo en unos minutos.';
        } else {
            $users = load_users();
            $ok = false;
            foreach ($users as &$u) {
                if (($u['id'] ?? '') === (string)$pending['id'] && !empty($u['active']) && user_has_totp($u) && verify_second_factor($u, (string)($_POST['code'] ?? ''))) {
                    $ok = true;
                    $uid = (string)$u['id'];
                }
            }
            unset($u);
            if ($ok) {
                acquire_state_lock();
                save_users($users);
                login_register_success($key);
                unset($_SESSION['pending_2fa']);
                session_regenerate_id(true);
                $_SESSION['uniforma_logged_in'] = true;
                $_SESSION['uniforma_user_id'] = $uid;
                csrf_token();
                header('Location: ' . panel_next_url());
                exit;
            }
            login_register_failure($key);
            $loginError = 'El código no es correcto.';
        }
    }
}
if (!isset($needSecondFactor)) {
    $needSecondFactor = false;
}
?>
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>UNIFORMA - Panel interno</title>
    <link rel="stylesheet" href="panel.css?v=20260630-brand" />
    <link rel="stylesheet" href="panel-v2.css?v=20260722-integral" />
    <link rel="stylesheet" href="panel-v2-upgrades.css?v=20261028-carga-dinamica" />
    <link rel="manifest" href="manifest.webmanifest" />
    <meta name="theme-color" content="#2a1b12" />
    <link rel="apple-touch-icon" href="icons/icon-192.png" />
    <link rel="stylesheet" href="panel-v3.css?v=20261017-1" />
  </head>
  <body>
    <?php if (!is_logged_in()): ?>
      <main class="login-screen">
        <?php if ($setupMode): ?>
        <form class="login-card" method="post" autocomplete="off">
          <input type="hidden" name="action" value="setup" />
          <div class="login-brand">
            <img class="brand-logo brand-logo-light" src="assets/brand/uniforma-logo-light.png" alt="UNIFORMA" />
            <small>Instalación del panel</small>
          </div>
          <h1>Crear administrador</h1>
          <p>Es la primera vez que se abre el panel. Elegí el usuario y la contraseña del administrador.</p>
          <?php if ($setupError !== ''): ?>
            <div class="login-error"><?= htmlspecialchars($setupError, ENT_QUOTES, 'UTF-8') ?></div>
          <?php endif; ?>
          <label>Nombre<input name="name" required autofocus /></label>
          <label>Usuario<input name="user" required /></label>
          <label>Contraseña (mínimo 10 caracteres)<input name="password" type="password" minlength="10" required /></label>
          <label>Repetir contraseña<input name="confirm" type="password" minlength="10" required /></label>
          <?php if (!empty($config['setup_key'])): ?>
            <label>Clave de instalación<input name="setup_key" type="password" required /></label>
          <?php endif; ?>
          <button class="primary-button" type="submit">Crear y entrar</button>
        </form>
        <?php elseif ($needSecondFactor): ?>
        <form class="login-card" method="post" autocomplete="off">
          <input type="hidden" name="action" value="login2" />
          <div class="login-brand">
            <img class="brand-logo brand-logo-light" src="assets/brand/uniforma-logo-light.png" alt="UNIFORMA" />
            <small>Verificación en dos pasos</small>
          </div>
          <h1>Ingresá el código</h1>
          <p>Abrí tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator, Authy…) y escribí el código de 6 números. Si perdiste el celular, usá un código de recuperación.</p>
          <?php if ($loginError !== ''): ?>
            <div class="login-error"><?= htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8') ?></div>
          <?php endif; ?>
          <label>
            Código
            <input name="code" inputmode="numeric" autocomplete="one-time-code" required autofocus />
          </label>
          <button class="primary-button" type="submit">Verificar y entrar</button>
        </form>
        <?php else: ?>
        <form class="login-card" method="post" autocomplete="off">
          <input type="hidden" name="action" value="login" />
          <div class="login-brand">
            <img class="brand-logo brand-logo-light" src="assets/brand/uniforma-logo-light.png" alt="UNIFORMA" />
            <small>Panel interno</small>
          </div>
          <h1>Acceso interno</h1>
          <p>Ingresá con el usuario del equipo comercial.</p>
          <?php if ($loginError !== ''): ?>
            <div class="login-error"><?= htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8') ?></div>
          <?php endif; ?>
          <label>
            Usuario
            <input name="user" required autofocus />
          </label>
          <label>
            Contraseña
            <input name="password" type="password" required />
          </label>
          <button class="primary-button" type="submit">Entrar al panel</button>
        </form>
        <?php endif; ?>
      </main>
    <?php else: ?>
      <script>
        window.UNIFORMA_BOOT = {
          csrf: <?= json_encode(csrf_token()) ?>,
        };
      </script>
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <img class="brand-logo brand-logo-dark" src="assets/brand/uniforma-logo-dark.png" alt="UNIFORMA" />
            <small>Panel interno</small>
          </div>
          <nav class="nav-list">
            <button class="nav-item active" data-view="dashboard" data-permission="dashboard.view" type="button"><span data-icon="home"></span>Dashboard</button>
            <button class="nav-item" data-view="clientes" data-permission="clients.view" type="button"><span data-icon="users"></span>Clientes</button>
            <button class="nav-item" data-view="tareas" data-permission="tasks.view" type="button"><span data-icon="check"></span>Tareas</button>
            <button class="nav-item" data-view="catalogo" data-permission="catalog.view" type="button"><span data-icon="shirt"></span>Catálogo</button>
            <button class="nav-item" data-view="propuestas" data-permission="proposals.view" type="button"><span data-icon="file"></span>Propuestas</button>
            <button class="nav-item" data-view="editor" data-permission="editor.use" type="button"><span data-icon="image"></span>Editor</button>
            <button class="nav-item" data-view="reportes" data-permission="reports.view" type="button"><span data-icon="chart"></span>Reportes</button>
            <button class="nav-item" data-view="usuarios" data-permission="users.manage" type="button"><span data-icon="shield"></span>Usuarios</button>
            <button class="nav-item" data-view="configuracion" data-permission="settings.manage" type="button"><span data-icon="settings"></span>Configuración</button>
          </nav>
        </aside>

        <main class="workspace">
          <header class="topbar">
            <label class="search-box">
              <span data-icon="search"></span>
              <input id="globalSearch" type="search" placeholder="Buscar..." />
            </label>
            <button class="notification-button" id="notificationBtn" type="button" aria-label="Notificaciones">
              <span data-icon="bell"></span>
              <b id="notificationCount">0</b>
            </button>
            <div class="profile">
              <div class="avatar" id="avatarInitials">U</div>
              <div>
                <strong id="profileName">UNIFORMA</strong>
                <small id="profileRole">Vendedor</small>
              </div>
            </div>
            <button class="ghost-button" id="logoutBtn" type="button">Salir</button>
          </header>

          <section class="view active" id="view-dashboard">
            <div class="page-heading">
              <div>
                <h1>¡Hola, <span id="welcomeName">equipo</span>!</h1>
                <p>Este es el resumen de tu actividad comercial.</p>
              </div>
              <div class="date-chip" id="todayLabel"></div>
            </div>

            <div class="dashboard-grid">
              <section class="surface quick-panel">
                <h2>Accesos rápidos</h2>
                <div class="quick-grid">
                  <button class="quick-card" data-action="new-proposal" data-permission="proposals.manage" type="button"><span>+</span><strong>Nueva propuesta</strong><small>Crear una nueva propuesta comercial</small></button>
                  <button class="quick-card" data-action="new-client" data-permission="clients.manage" type="button"><span data-icon="user-plus"></span><strong>Nuevo cliente</strong><small>Registrar un nuevo cliente</small></button>
                  <button class="quick-card" data-action="new-task" data-permission="tasks.manage" type="button"><span data-icon="check"></span><strong>Nueva tarea</strong><small>Agendar un seguimiento</small></button>
                  <button class="quick-card" data-view-jump="catalogo" type="button"><span data-icon="shirt"></span><strong>Catálogo de prendas</strong><small>Ver prendas disponibles</small></button>
                  <button class="quick-card" data-view-jump="editor" data-permission="editor.use" type="button"><span data-icon="image"></span><strong>Aplicar logo</strong><small>Simular una prenda</small></button>
                </div>
              </section>
              <div class="stat-grid">
                <article class="stat-card"><span>Propuestas este mes</span><strong id="metricMonth">0</strong><small class="good">+20% vs. mes anterior</small></article>
                <article class="stat-card"><span>Pendientes</span><strong id="metricPending">0</strong><small>Requieren seguimiento</small></article>
                <article class="stat-card"><span>Clientes activos</span><strong id="metricClients">0</strong><small class="good">+12% vs. mes anterior</small></article>
                <article class="stat-card"><span>Aprobadas</span><strong id="metricApproved">0</strong><small>Este mes</small></article>
                <article class="stat-card"><span>Tareas vencidas</span><strong id="metricOverdue">0</strong><small>Atención prioritaria</small></article>
              </div>
            </div>

            <div class="bottom-grid">
              <section class="surface">
                <div class="section-row">
                  <h2>Propuestas recientes</h2>
                  <button class="text-button" data-view-jump="propuestas" type="button">Ver todas</button>
                </div>
                <div id="recentProposals" class="recent-list"></div>
              </section>
              <section class="surface">
                <h2>Distribución de estados</h2>
                <div class="status-layout">
                  <div class="donut" id="statusDonut"><strong id="donutTotal">0</strong><small>Total</small></div>
                  <div class="legend" id="statusLegend"></div>
                </div>
                <aside class="tip-card"><strong>Tip comercial</strong><p>Recordá hacer seguimiento de las propuestas enviadas para aumentar cierres.</p></aside>
              </section>
            </div>
          </section>

          <section class="view" id="view-clientes">
            <div class="page-heading">
              <div><h1>Clientes</h1><p>Alta, edición y seguimiento de cuentas comerciales.</p></div>
              <label class="search-box"><span data-icon="search"></span><input id="clientSearch" type="search" placeholder="Buscar cliente..." /></label>
            </div>
            <div class="split-layout">
              <section class="surface"><div class="section-row"><h2>Base comercial</h2><small id="clientCount"></small></div><div class="client-list" id="clientList"></div></section>
              <form class="surface form-panel" id="clientForm">
                <h2 id="clientFormTitle">Nuevo cliente</h2>
                <label>Empresa<input name="company" required /></label>
                <label>Contacto<input name="contact" required /></label>
                <label>WhatsApp<input name="phone" /></label>
                <label>Email<input name="email" type="email" /></label>
                <label>Dirección<input name="address" /></label>
                <label>Rubro<select name="sector"><option>Gastronomía</option><option>Salud</option><option>Construcción</option><option>Retail</option><option>Servicios</option></select></label>
                <label>Origen<select name="source"><option>WhatsApp</option><option>Instagram</option><option>Web</option><option>Referido</option><option>Cliente anterior</option><option>Otro</option></select></label>
                <label>Prioridad<select name="priority"><option>Alta</option><option>Media</option><option>Baja</option></select></label>
                <label>Notas<textarea name="notes" rows="4"></textarea></label>
                <div class="button-row"><button class="primary-button" type="submit">Guardar cliente</button><button class="ghost-button" id="resetClientBtn" type="button">Limpiar</button></div>
              </form>
            </div>
          </section>

          <section class="view" id="view-tareas">
            <div class="page-heading">
              <div><h1>Tareas</h1><p>Seguimientos, pendientes y recordatorios del equipo.</p></div>
              <div class="filter-row" id="taskFilters"></div>
            </div>
            <div class="split-layout">
              <section class="surface">
                <div class="section-row"><h2>Agenda comercial</h2><small id="taskCount"></small></div>
                <div class="task-list" id="taskList"></div>
              </section>
              <form class="surface form-panel" id="taskForm" data-permission="tasks.manage">
                <div class="section-row">
                  <h2 id="taskFormTitle">Nueva tarea</h2>
                  <button class="ghost-button" id="resetTaskBtn" type="button">Limpiar</button>
                </div>
                <label>Título<input name="title" required /></label>
                <label>Cliente<select name="clientId" id="taskClient"></select></label>
                <label>Propuesta<select name="proposalId" id="taskProposal"></select></label>
                <label>Vencimiento<input name="dueDate" type="date" required /></label>
                <label>Prioridad<select name="priority"><option>Alta</option><option>Media</option><option>Baja</option></select></label>
                <label>Estado<select name="status"><option>Pendiente</option><option>En curso</option><option>Hecha</option></select></label>
                <label>Notas<textarea name="note" rows="4"></textarea></label>
                <button class="primary-button" type="submit">Guardar tarea</button>
              </form>
            </div>
          </section>

          <section class="view" id="view-catalogo">
            <div class="page-heading"><div><h1>Catálogo</h1><p>Prendas disponibles para propuestas.</p></div><div class="filter-row" id="catalogFilters"></div></div>
            <div class="catalog-layout">
              <div class="catalog-grid" id="catalogGrid"></div>
              <form class="surface form-panel permission-manage-catalog" id="productForm">
                <div class="section-row">
                  <h2 id="productFormTitle">Nueva prenda</h2>
                  <button class="ghost-button" id="resetProductBtn" type="button">Limpiar</button>
                </div>
                <label>Nombre<input name="name" required /></label>
                <label>Categoría<input name="category" required /></label>
                <label>Imagen frente<input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
                <div class="image-preview" id="productFrontPreview"></div>
                <label>Imagen espalda<input name="imageBackFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" /></label>
                <div class="image-preview" id="productBackPreview"></div>
                <label>Talles<input name="sizes" /></label>
                <label>Material<input name="material" /></label>
                <label>Precio base<input name="basePrice" type="number" min="0" step="100" required /></label>
                <button class="primary-button" type="submit">Guardar prenda</button>
              </form>
            </div>
          </section>

          <section class="view" id="view-propuestas">
            <div class="page-heading"><div><h1>Propuestas</h1><p>Seguimiento comercial y estados.</p></div><button class="primary-button" data-action="new-proposal" type="button">Nueva propuesta</button></div>
            <div class="proposals-layout"><div class="proposal-list" id="proposalList"></div><section class="surface" id="proposalDetail"></section></div>
            <section class="surface report-block">
              <div class="section-row"><h2>Pipeline comercial</h2><small>Arrastrable visual próximamente; hoy funciona como tablero de control.</small></div>
              <div class="pipeline-board" id="proposalBoard"></div>
            </section>
          </section>

          <section class="view" id="view-editor">
            <div class="page-heading"><div><h1>Editor de propuesta</h1><p>Aplicá el logo del cliente sobre una prenda.</p></div><button class="primary-button" id="saveDesignBtn" type="button">Guardar vista</button></div>
            <div class="editor-layout">
              <aside class="surface form-panel">
                <h2>Cliente y prenda</h2>
                <label>Cliente<select id="editorClient"></select></label>
                <label>Producto<select id="editorProduct"></select></label>
                <label>Logo<input id="logoInput" type="file" accept="image/png,image/jpeg,image/svg+xml" /></label>
                <label>Cantidad<input id="quantityInput" type="number" min="1" value="24" /></label>
                <label>Observaciones<textarea id="notesInput" rows="4"></textarea></label>
              </aside>
              <section>
                <div class="stage-toolbar"><button class="active" data-face="Frente" type="button">Frente</button><button data-face="Espalda" type="button">Espalda</button><span id="stageMeta"></span></div>
                <div class="garment-stage" id="garmentStage"><img id="garmentImage" alt="Prenda" /><div class="logo-layer" id="logoLayer"><img id="logoImage" alt="" /><span>LOGO</span></div></div>
              </section>
              <aside class="surface form-panel">
                <h2>Personalización</h2>
                <label>Método<select id="editorMethod"><option>Bordado</option><option>DTF</option></select></label>
                <label>Color<select id="editorColor"><option>Negro</option><option>Grafito</option><option>Azul noche</option><option>Crudo</option></select></label>
                <label>Escala<input id="scaleRange" type="range" min="0.5" max="1.9" step="0.05" value="1" /></label>
                <label>Rotación<input id="rotationRange" type="range" min="-35" max="35" step="1" value="0" /></label>
              </aside>
            </div>
          </section>

          <section class="view" id="view-reportes">
            <div class="page-heading"><div><h1>Reportes</h1><p>Análisis comercial, producción y seguimiento.</p></div></div>
            <div class="report-grid" id="reportMetrics"></div>
            <div class="bottom-grid">
              <section class="surface"><div class="section-row"><h2>Performance por producto</h2></div><div class="table-list" id="productPerformance"></div></section>
              <section class="surface"><div class="section-row"><h2>Performance por rubro</h2></div><div class="table-list" id="sectorPerformance"></div></section>
            </div>
            <section class="surface report-block"><div class="section-row"><h2>Próximas entregas</h2></div><div class="table-list" id="deliveryReport"></div></section>
            <section class="surface report-block"><div class="section-row"><h2>Actividad reciente</h2></div><div class="audit-list" id="auditList"></div></section>
          </section>

          <section class="view" id="view-usuarios">
            <div class="page-heading"><div><h1>Usuarios</h1><p>Alta de usuarios, roles y permisos internos.</p></div></div>
            <div class="split-layout">
              <section class="surface"><div class="section-row"><h2>Equipo</h2><small id="userCount"></small></div><div class="user-list" id="userList"></div></section>
              <form class="surface form-panel" id="userForm">
                <h2 id="userFormTitle">Nuevo usuario</h2>
                <label>Nombre<input name="name" required /></label>
                <label>Usuario<input name="username" required /></label>
                <label>Email<input name="email" type="email" /></label>
                <label>Rol<select name="role" id="userRoleSelect"></select></label>
                <label>Contraseña<input name="password" type="password" minlength="8" placeholder="Solo para crear o cambiar" /></label>
                <label class="check-row"><input name="active" type="checkbox" checked /> Usuario activo</label>
                <div class="permission-grid" id="userPermissionList"></div>
                <div class="permission-preview" id="permissionPreview"></div>
                <div class="button-row"><button class="primary-button" type="submit">Guardar usuario</button><button class="ghost-button" id="resetUserBtn" type="button">Limpiar</button></div>
              </form>
            </div>
          </section>

          <section class="view" id="view-configuracion">
            <div class="page-heading"><div><h1>Configuración</h1><p>Marca, apariencia, precios y reglas comerciales.</p></div></div>
            <form class="settings-layout" id="settingsForm">
              <section class="surface settings-form">
                <h2>Marca</h2>
                <label>Nombre comercial<input id="settingCompanyName" required /></label>
                <label>WhatsApp comercial<input id="settingWhatsapp" /></label>
                <label>Moneda<input id="settingCurrency" /></label>
                <label>Prefijo de propuestas<input id="settingQuotePrefix" /></label>
              </section>
              <section class="surface settings-form">
                <h2>Apariencia</h2>
                <label>Color principal<input id="settingAccent" type="color" /></label>
                <label>Color secundario<input id="settingAccentDark" type="color" /></label>
                <label>Color del menú<input id="settingSidebar" type="color" /></label>
                <label>Densidad<select id="settingDensity"><option value="comfortable">Cómoda</option><option value="compact">Compacta</option></select></label>
              </section>
              <section class="surface settings-form">
                <h2>Reglas comerciales</h2>
                <label>Margen sugerido (%)<input id="settingMargin" type="number" min="0" max="300" /></label>
                <label>IVA / impuesto (%)<input id="settingTax" type="number" min="0" max="100" /></label>
                <label>Validez de propuesta (días)<input id="settingValidity" type="number" min="1" max="90" /></label>
                <label>Producción estimada (días)<input id="settingProduction" type="number" min="1" max="120" /></label>
              </section>
              <section class="surface settings-form">
                <h2>Datos y respaldo</h2>
                <p>Exportá una copia del panel antes de hacer cambios grandes.</p>
                <button class="ghost-button" id="exportBackupBtn" type="button">Exportar backup</button>
                <label>Importar backup<input id="backupInput" type="file" accept="application/json" /></label>
              </section>
              <div class="settings-actions"><button class="primary-button" type="submit">Guardar configuración</button></div>
            </form>
          </section>
        </main>
      </div>
      <div class="toast" id="toast"></div>
      <script src="panel-v2.js?v=20261028-carga-dinamica"></script>
      <script src="panel-v3.js?v=20261017-1"></script>
      <script src="panel-v3-admin.js?v=20261017-1"></script>
      <script src="panel-v3-ops.js?v=20261017-1"></script>
      <script src="panel-v3-biz.js?v=20261017-1"></script>
      <script src="panel-v3-more.js?v=20261017-1"></script>
      <script src="panel-v4-productos.js?v=20261028-productos"></script>
    <?php endif; ?>
  </body>
</html>
