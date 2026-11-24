<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

// Algunos hostings no dejan escribir en la carpeta de sesiones por defecto.
$sessionPath = session_save_path();
if ($sessionPath === '' || !is_dir($sessionPath) || !is_writable($sessionPath)) {
    $altPath = sys_get_temp_dir() . '/uniforma-sessions';
    if (!is_dir($altPath)) {
        @mkdir($altPath, 0700, true);
    }
    if (is_dir($altPath) && is_writable($altPath)) {
        session_save_path($altPath);
    }
}
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name($config['session_name']);
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");

function json_response(array $payload): void
{
    header('Content-Type: application/json; charset=utf-8');
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        http_response_code(500);
        $json = '{"ok":false,"error":"No se pudo generar la respuesta JSON del servidor"}';
    }
    echo $json;
    exit;
}

/**
 * La papelera no debe conservar archivos Base64 completos. Al duplicarlos el
 * estado puede superar el limite de peticiones de Hostinger y bloquear todas
 * las altas, bajas y modificaciones del panel.
 */
function compact_trash_value($value)
{
    if (is_array($value)) {
        foreach ($value as $key => $item) {
            if (is_string($item) && strpos($item, 'data:image/') === 0 && strlen($item) > 4096) {
                $value[$key] = '';
                continue;
            }
            $value[$key] = compact_trash_value($item);
        }
    }
    return $value;
}

function compact_trash(array $trash): array
{
    $result = [];
    foreach (array_slice($trash, 0, 30) as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $result[] = compact_trash_value($entry);
    }
    return $result;
}

function data_dir(): string
{
    global $config;
    $custom = trim((string)($config['data_dir'] ?? ''));
    return $custom !== '' ? rtrim($custom, '/\\') : __DIR__ . '/data';
}

function state_file(): string
{
    return data_dir() . '/state.json';
}

function users_file(): string
{
    return data_dir() . '/users.json';
}

function ensure_storage_ready(): void
{
    $dir = data_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'No se pudo crear la carpeta data del panel']);
    }

    @chmod($dir, 0775);
    // Defensa en profundidad: aunque la carpeta quede dentro de public_html, nada se sirve por web.
    $guard = $dir . '/.htaccess';
    if (!is_file($guard)) {
        @file_put_contents($guard, "Require all denied\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\nOptions -Indexes\n");
    }
    if (!is_file($dir . '/index.html')) {
        @file_put_contents($dir . '/index.html', '');
    }
    foreach ([state_file(), users_file()] as $file) {
        if (file_exists($file)) {
            @chmod($file, 0664);
        }
    }

    if (!is_writable($dir)) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'La carpeta panel/data no tiene permisos de escritura. En Hostinger asignale permisos 775.']);
    }
}

function atomic_json_write(string $file, array $payload, string $label): void
{
    ensure_storage_ready();
    $encoded = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'No se pudieron preparar los datos de ' . $label]);
    }

    $temp = $file . '.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($temp, $encoded, LOCK_EX) === false) {
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'No se pudo escribir ' . basename($file) . '. Revisá permisos 775 en panel/data.']);
    }
    @chmod($temp, 0664);
    if (!@rename($temp, $file)) {
        @unlink($temp);
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'No se pudo reemplazar ' . basename($file) . ' de forma segura']);
    }
}

function client_ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
}

function throttle_file(): string
{
    return data_dir() . '/login-attempts.json';
}

function throttle_key(string $login): string
{
    return hash('sha256', client_ip() . '|' . strtolower(trim($login)));
}

function throttle_load(): array
{
    $raw = is_file(throttle_file()) ? json_decode((string)@file_get_contents(throttle_file()), true) : [];
    return is_array($raw) ? $raw : [];
}

function throttle_save(array $rows): void
{
    $now = time();
    foreach ($rows as $key => $row) {
        if ((int)($row['until'] ?? 0) < $now && (int)($row['first'] ?? 0) < $now - 900) {
            unset($rows[$key]);
        }
    }
    ensure_storage_ready();
    @file_put_contents(throttle_file(), json_encode($rows), LOCK_EX);
}

/** Segundos que faltan para poder reintentar (0 = permitido). */
function login_locked_seconds(string $login): int
{
    $row = throttle_load()[throttle_key($login)] ?? null;
    $until = (int)($row['until'] ?? 0);
    return $until > time() ? $until - time() : 0;
}

function login_register_failure(string $login): void
{
    $rows = throttle_load();
    $key = throttle_key($login);
    $now = time();
    $row = $rows[$key] ?? ['count' => 0, 'first' => $now, 'until' => 0];
    if ($now - (int)$row['first'] > 900) {
        $row = ['count' => 0, 'first' => $now, 'until' => 0];
    }
    $row['count']++;
    if ($row['count'] >= 5) {
        $row['until'] = $now + 900;
    }
    $rows[$key] = $row;
    throttle_save($rows);
}

function login_register_success(string $login): void
{
    $rows = throttle_load();
    unset($rows[throttle_key($login)]);
    throttle_save($rows);
}

/** Serializa todo el ciclo leer-modificar-escribir (evita pisadas entre guardados simultaneos). */
function acquire_state_lock(): void
{
    static $handle = null;
    if ($handle !== null) {
        return;
    }
    ensure_storage_ready();
    $handle = @fopen(data_dir() . '/state.lock', 'c');
    if ($handle) {
        @flock($handle, LOCK_EX);
        register_shutdown_function(static function () use (&$handle): void {
            if ($handle) {
                @flock($handle, LOCK_UN);
                @fclose($handle);
            }
        });
    }
}

function role_definitions(): array
{
    return [
        'admin' => [
            'label' => 'Administrador',
            'description' => 'Control total del panel, usuarios, catalogo y configuracion.',
            'permissions' => ['all'],
        ],
        'gerente' => [
            'label' => 'Gerente comercial',
            'description' => 'Gestiona ventas, reportes, clientes y catalogo.',
            'permissions' => [
                'dashboard.view',
                'clients.view',
                'clients.manage',
                'tasks.view',
                'tasks.manage',
                'catalog.view',
                'catalog.manage',
                'proposals.view',
                'proposals.manage',
                'editor.use',
                'reports.view',
                'payments.view',
                'purchases.view',
                'purchases.manage',
                'settings.manage',
            ],
        ],
        'administracion' => [
            'label' => 'Administración',
            'description' => 'Valida pagos, controla cobranzas y consulta reportes. No edita catálogo ni usuarios.',
            'permissions' => [
                'dashboard.view',
                'clients.view',
                'tasks.view',
                'catalog.view',
                'proposals.view',
                'proposals.manage',
                'payments.view',
                'payments.validate',
                'purchases.view',
                'purchases.manage',
                'reports.view',
            ],
        ],
        'vendedor' => [
            'label' => 'Vendedor',
            'description' => 'Carga clientes, arma propuestas y hace seguimiento.',
            'permissions' => [
                'dashboard.view',
                'clients.view',
                'clients.manage',
                'tasks.view',
                'tasks.manage',
                'catalog.view',
                'proposals.view',
                'proposals.manage',
                'editor.use',
                'reports.view',
            ],
        ],
        'diseno' => [
            'label' => 'Diseño / produccion',
            'description' => 'Usa el editor y consulta propuestas sin administrar usuarios.',
            'permissions' => [
                'dashboard.view',
                'tasks.view',
                'catalog.view',
                'proposals.view',
                'proposals.manage',
                'editor.use',
                'reports.view',
            ],
        ],
        'lectura' => [
            'label' => 'Solo lectura',
            'description' => 'Puede consultar informacion, sin modificar datos.',
            'permissions' => [
                'dashboard.view',
                'clients.view',
                'tasks.view',
                'catalog.view',
                'proposals.view',
                'reports.view',
            ],
        ],
    ];
}

function role_permissions(string $role): array
{
    $roles = role_definitions();
    return $roles[$role]['permissions'] ?? $roles['lectura']['permissions'];
}

function all_permission_keys(): array
{
    $permissions = ['users.manage'];
    foreach (role_definitions() as $role) {
        foreach ($role['permissions'] as $permission) {
            if ($permission !== 'all') {
                $permissions[] = $permission;
            }
        }
    }
    return array_values(array_unique($permissions));
}

function permission_list_for_user(?array $user): array
{
    if (!$user || empty($user['active'])) {
        return [];
    }

    $permissions = role_permissions((string)($user['role'] ?? 'lectura'));
    if (in_array('all', $permissions, true)) {
        return all_permission_keys();
    }

    // Un arreglo vacio significa que no hay una personalizacion de permisos:
    // en ese caso se mantienen los permisos normales del rol. Antes se
    // interpretaba como "sin permisos" y un administrador no podia guardar.
    if (isset($user['permissionsOverride']) && is_array($user['permissionsOverride']) && count($user['permissionsOverride']) > 0) {
        $known = all_permission_keys();
        $permissions = array_values(array_filter($user['permissionsOverride'], static fn($permission): bool => in_array($permission, $known, true)));
    }

    return array_values(array_unique($permissions));
}

function public_user(array $user): array
{
    unset($user['password_hash'], $user['password_sha256']);
    // El secreto y los códigos de recuperación nunca salen del servidor; solo si está activada.
    $user['totp'] = ['enabled' => !empty($user['totp']['enabled'])];
    return $user;
}

function needs_setup(): bool
{
    return !is_file(users_file()) || count(load_users()) === 0;
}

function create_first_admin(string $name, string $username, string $password): array
{
    $user = [
        'id' => 'user-admin',
        'name' => $name,
        'email' => '',
        'username' => $username,
        'role' => 'admin',
        'active' => true,
        'permissionsOverride' => [],
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => date('c'),
        'updatedAt' => date('c'),
        'lastLoginAt' => '',
    ];
    save_users([$user]);
    return $user;
}

function load_users(): array
{
    $file = users_file();
    if (!is_file($file)) {
        return [];
    }
    $decoded = json_decode((string)file_get_contents($file), true);
    if (!is_array($decoded)) {
        // Nunca pisar un archivo ilegible con uno nuevo: se corta para revisarlo a mano.
        http_response_code(500);
        json_response(['ok' => false, 'error' => 'users.json no se pudo leer. No se modifico; restauralo desde un respaldo.']);
    }
    return array_values(array_filter($decoded, 'is_array'));
}

function save_users(array $users): void
{
    atomic_json_write(users_file(), array_values($users), 'usuarios');
}

function find_user_by_login(string $login): ?array
{
    $login = strtolower(trim($login));
    foreach (load_users() as $user) {
        $username = strtolower((string)($user['username'] ?? ''));
        $email = strtolower((string)($user['email'] ?? ''));
        if ($login !== '' && ($login === $username || ($email !== '' && $login === $email))) {
            return $user;
        }
    }
    return null;
}

function verify_user_password(array $user, string $password): bool
{
    if (!empty($user['password_hash']) && password_verify($password, (string)$user['password_hash'])) {
        return true;
    }

    if (!empty($user['password_sha256'])) {
        return hash_equals((string)$user['password_sha256'], hash('sha256', $password));
    }

    return false;
}

function update_user_login_stamp(string $userId, string $plainPassword = ''): void
{
    $users = load_users();
    foreach ($users as &$user) {
        if (($user['id'] ?? '') === $userId) {
            $user['lastLoginAt'] = date('c');
            $user['updatedAt'] = date('c');
            // Migracion transparente: SHA-256 sin sal -> bcrypt.
            $legacy = !empty($user['password_sha256']);
            $weak = !empty($user['password_hash']) && password_needs_rehash((string)$user['password_hash'], PASSWORD_DEFAULT);
            if ($plainPassword !== '' && ($legacy || $weak)) {
                $user['password_hash'] = password_hash($plainPassword, PASSWORD_DEFAULT);
                unset($user['password_sha256']);
            }
            break;
        }
    }
    unset($user);
    save_users($users);
}

function current_user(): ?array
{
    $users = load_users();
    $sessionId = (string)($_SESSION['uniforma_user_id'] ?? '');

    foreach ($users as $user) {
        if (($user['id'] ?? '') === $sessionId && !empty($user['active'])) {
            return $user;
        }
    }

    if (!empty($_SESSION['uniforma_logged_in'])) {
        foreach ($users as $user) {
            if (($user['role'] ?? '') === 'admin' && !empty($user['active'])) {
                $_SESSION['uniforma_user_id'] = $user['id'];
                return $user;
            }
        }
    }

    return null;
}

function is_logged_in(): bool
{
    return current_user() !== null;
}

function require_login(): void
{
    if (!is_logged_in()) {
        http_response_code(401);
        json_response(['ok' => false, 'error' => 'No autorizado']);
    }
}

function can_user(?array $user, string $permission): bool
{
    return in_array($permission, permission_list_for_user($user), true);
}

function require_permission(string $permission): void
{
    if (!can_user(current_user(), $permission)) {
        http_response_code(403);
        json_response(['ok' => false, 'error' => 'No tenes permisos para esta accion']);
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf(): void
{
    $header = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals(csrf_token(), $header)) {
        http_response_code(403);
        json_response(['ok' => false, 'error' => 'Sesion invalida']);
    }
}

function seed_state(): array
{
    $today = new DateTimeImmutable('today');
    $date = static fn(int $offset): string => $today->modify(($offset >= 0 ? '+' : '') . $offset . ' days')->format('Y-m-d');

    $products = [
        ['id' => 'remera', 'name' => 'Remera clasica', 'category' => 'Remeras', 'image' => 'assets/prendas/remera-clasica.png', 'imageBack' => 'assets/prendas/remera-clasica.png', 'sizes' => 'S al XXL', 'material' => 'Jersey peinado', 'basePrice' => 6200],
        ['id' => 'chomba', 'name' => 'Chomba pique', 'category' => 'Chombas', 'image' => 'assets/prendas/chomba-pique.png', 'imageBack' => 'assets/prendas/chomba-pique.png', 'sizes' => 'S al XXL', 'material' => 'Pique premium', 'basePrice' => 9800],
        ['id' => 'camisa', 'name' => 'Camisa work', 'category' => 'Camisas', 'image' => 'assets/prendas/camisa-work.png', 'imageBack' => 'assets/prendas/camisa-work.png', 'sizes' => 'S al XXL', 'material' => 'Gabardina liviana', 'basePrice' => 15500],
        ['id' => 'buzo', 'name' => 'Buzo canguro', 'category' => 'Abrigo', 'image' => 'assets/prendas/buzo-canguro.png', 'imageBack' => 'assets/prendas/buzo-canguro.png', 'sizes' => 'S al XXL', 'material' => 'Frisa invisible', 'basePrice' => 18200],
        ['id' => 'delantal', 'name' => 'Delantal urbano', 'category' => 'Gastronomia', 'image' => 'assets/prendas/delantal.png', 'imageBack' => 'assets/prendas/delantal.png', 'sizes' => 'Unico', 'material' => 'Canvas pesado', 'basePrice' => 11200],
        ['id' => 'gorra', 'name' => 'Gorra trucker', 'category' => 'Accesorios', 'image' => 'assets/prendas/gorra-trucker.png', 'imageBack' => 'assets/prendas/gorra-trucker.png', 'sizes' => 'Regulable', 'material' => 'Algodon y red', 'basePrice' => 5300],
        ['id' => 'tote', 'name' => 'Tote algodon', 'category' => 'Accesorios', 'image' => 'assets/prendas/tote-algodon.png', 'imageBack' => 'assets/prendas/tote-algodon.png', 'sizes' => '38 x 42 cm', 'material' => 'Lienzo crudo', 'basePrice' => 4200],
    ];

    $clients = [
        ['id' => 'barberia-norte', 'company' => 'Barberia Norte', 'contact' => 'Tomas Vidal', 'phone' => '+54 9 351 555 1018', 'email' => '', 'address' => '', 'sector' => 'Servicios', 'source' => 'Referido', 'priority' => 'Alta', 'notes' => 'Interesado en chombas bordadas para equipo de atencion.', 'logoData' => '', 'ownerId' => 'user-admin'],
        ['id' => 'cafe-del-centro', 'company' => 'Cafe del Centro', 'contact' => 'Marina Castro', 'phone' => '+54 9 351 555 0182', 'email' => '', 'address' => '', 'sector' => 'Gastronomia', 'source' => 'Instagram', 'priority' => 'Media', 'notes' => 'Consultar delantales y remeras para temporada alta.', 'logoData' => '', 'ownerId' => 'user-admin'],
        ['id' => 'constructora-delta', 'company' => 'Constructora Delta', 'contact' => 'Matias Robledo', 'phone' => '+54 9 351 555 2410', 'email' => '', 'address' => '', 'sector' => 'Construccion', 'source' => 'Web', 'priority' => 'Alta', 'notes' => 'Necesita prendas resistentes para cuadrilla.', 'logoData' => '', 'ownerId' => 'user-admin'],
        ['id' => 'restaurante-la-estacion', 'company' => 'Restaurante La Estacion', 'contact' => 'Rocio Benitez', 'phone' => '+54 9 351 555 9012', 'email' => '', 'address' => '', 'sector' => 'Gastronomia', 'source' => 'WhatsApp', 'priority' => 'Media', 'notes' => '', 'logoData' => '', 'ownerId' => 'user-admin'],
        ['id' => 'estudio-contable-sur', 'company' => 'Estudio Contable Sur', 'contact' => 'Lucas Perrone', 'phone' => '+54 9 351 555 7730', 'email' => '', 'address' => '', 'sector' => 'Servicios', 'source' => 'Referido', 'priority' => 'Baja', 'notes' => '', 'logoData' => '', 'ownerId' => 'user-admin'],
    ];

    $proposal = static function (string $id, string $publicId, string $clientId, string $status, string $productId, int $qty, int $days) use ($date): array {
        return [
            'id' => $id,
            'publicId' => $publicId,
            'clientId' => $clientId,
            'status' => $status,
            'ownerId' => 'user-admin',
            'updatedDate' => $date(-$days),
            'deliveryDate' => $date(14 - $days),
            'designs' => $qty > 0 ? [[
                'id' => 'design-' . $id,
                'productId' => $productId,
                'face' => 'Frente',
                'method' => $status === 'Borrador' ? 'DTF' : 'Bordado',
                'color' => 'Negro',
                'qty' => $qty,
                'note' => '',
                'logo' => ['x' => 42, 'y' => 34, 'scale' => 1, 'rotation' => 0],
            ]] : [],
        ];
    };

    $tasks = [
        ['id' => 'task-001', 'title' => 'Enviar propuesta final con talles', 'clientId' => 'barberia-norte', 'proposalId' => 'prop-018', 'dueDate' => $date(1), 'status' => 'Pendiente', 'priority' => 'Alta', 'ownerId' => 'user-admin', 'note' => 'Confirmar colores antes de cerrar.', 'createdAt' => date('c')],
        ['id' => 'task-002', 'title' => 'Pedir logo en PNG al cliente', 'clientId' => 'cafe-del-centro', 'proposalId' => 'prop-017', 'dueDate' => $date(0), 'status' => 'Pendiente', 'priority' => 'Media', 'ownerId' => 'user-admin', 'note' => '', 'createdAt' => date('c')],
        ['id' => 'task-003', 'title' => 'Coordinar fecha de entrega', 'clientId' => 'constructora-delta', 'proposalId' => 'prop-016', 'dueDate' => $date(3), 'status' => 'En curso', 'priority' => 'Alta', 'ownerId' => 'user-admin', 'note' => 'Pedido aprobado.', 'createdAt' => date('c')],
    ];

    return [
        'products' => $products,
        'clients' => $clients,
        'tasks' => $tasks,
        'proposals' => [
            $proposal('prop-018', '#2026-018', 'barberia-norte', 'Enviada', 'chomba', 24, 1),
            $proposal('prop-017', '#2026-017', 'cafe-del-centro', 'Borrador', 'buzo', 0, 2),
            $proposal('prop-016', '#2026-016', 'constructora-delta', 'Aprobada', 'camisa', 28, 3),
            $proposal('prop-015', '#2026-015', 'restaurante-la-estacion', 'Enviada', 'remera', 22, 4),
            $proposal('prop-014', '#2026-014', 'estudio-contable-sur', 'Rechazada', 'delantal', 0, 5),
        ],
        'activeProposalId' => 'prop-018',
        'catalogFilter' => 'Todos',
        'editor' => [
            'clientId' => 'barberia-norte',
            'productId' => 'remera',
            'face' => 'Frente',
            'method' => 'Bordado',
            'color' => 'Negro',
            'qty' => 24,
            'notes' => '',
            'logoData' => '',
            'logo' => ['x' => 42, 'y' => 34, 'scale' => 1, 'rotation' => 0],
        ],
        'settings' => [
            'companyName' => 'UNIFORMA',
            'currency' => 'ARS',
            'whatsapp' => '',
            'quotePrefix' => '#2026',
            'defaultMargin' => 35,
            'taxRate' => 21,
            'validityDays' => 7,
            'productionDays' => 14,
            'theme' => [
                'accent' => '#b7792a',
                'accentDark' => '#965f1c',
                'sidebar' => '#24180f',
                'density' => 'comfortable',
            ],
            'statuses' => ['Borrador', 'Enviada', 'Vista', 'Aprobada', 'Rechazada', 'En producción', 'Lista', 'Entregada'],
        ],
        'auditLog' => [[
            'id' => 'audit-seed',
            'at' => date('c'),
            'userId' => 'user-admin',
            'userName' => 'Sistema',
            'action' => 'Panel iniciado',
            'detail' => 'Se creo la base inicial del panel interno.',
        ]],
        'trash' => [],
        'notificationsRead' => [],
        'editorDraft' => [],
    ];
}

function normalize_state(array $state): array
{
    $defaults = seed_state();
    $settings = array_replace_recursive($defaults['settings'], is_array($state['settings'] ?? null) ? $state['settings'] : []);
    $settings['statuses'] = $defaults['settings']['statuses'];
    $editor = array_replace_recursive($defaults['editor'], is_array($state['editor'] ?? null) ? $state['editor'] : []);

    $normalized = $defaults;
    foreach (['products', 'clients', 'tasks', 'proposals', 'auditLog', 'notificationsRead'] as $key) {
        if (isset($state[$key]) && is_array($state[$key])) {
            $normalized[$key] = array_values($state[$key]);
        }
    }
    foreach ($normalized['products'] as &$product) {
        if (!is_array($product)) {
            continue;
        }
        $sizes = $product['sizeOptions'] ?? [];
        if (!is_array($sizes) || !$sizes) {
            $sizes = preg_split('/\s*[,;\/]\s*/', (string)($product['sizes'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        }
        $sizes = array_values(array_unique(array_filter(array_map(static fn($size): string => trim((string)$size), $sizes))));
        usort($sizes, static function (string $left, string $right): int {
            $rank = static function (string $size): array {
                $key = strtoupper(preg_replace('/\s+/', '', $size) ?? $size);
                $letters = ['XXS' => 10, 'XS' => 20, 'S' => 30, 'M' => 40, 'L' => 50, 'XL' => 60, 'XXL' => 70, 'XXXL' => 80, 'XXXXL' => 90];
                if (isset($letters[$key])) {
                    return [1, $letters[$key], $key];
                }
                if (preg_match('/^(\d+(?:[.,]\d+)?)E$/', $key, $match)) {
                    return [3, (float)str_replace(',', '.', $match[1]), $key];
                }
                if (is_numeric(str_replace(',', '.', $key))) {
                    return [2, (float)str_replace(',', '.', $key), $key];
                }
                if (in_array($key, ['UNICO', 'ÚNICO', 'TALLEUNICO', 'TALLEÚNICO', 'REGULABLE'], true)) {
                    return [5, 0, $key];
                }
                return [4, 0, $key];
            };
            return $rank($left) <=> $rank($right);
        });
        if ($sizes) {
            $product['sizeOptions'] = $sizes;
            $product['sizes'] = implode(', ', $sizes);
        }
    }
    unset($product);
    // Pagos anteriores a la validación: se consideran validados para no cambiar saldos históricos.
    foreach ($normalized['proposals'] as &$proposalRow) {
        if (!is_array($proposalRow) || !is_array($proposalRow['payments'] ?? null)) {
            continue;
        }
        foreach ($proposalRow['payments'] as &$paymentRow) {
            if (is_array($paymentRow) && !in_array($paymentRow['status'] ?? '', ['pending', 'validated', 'rejected', 'voided'], true)) {
                $paymentRow['status'] = 'validated';
                $paymentRow['legacy'] = true;
            }
        }
        unset($paymentRow);
    }
    unset($proposalRow);
    $normalized['trash'] = compact_trash(is_array($state['trash'] ?? null) ? $state['trash'] : []);

    $normalized['activeProposalId'] = (string)($state['activeProposalId'] ?? $defaults['activeProposalId']);
    $normalized['catalogFilter'] = (string)($state['catalogFilter'] ?? 'Todos');
    // Colecciones que solo escribe el servidor (movimientos de stock y cierres de caja).
    foreach (server_owned_caps() as $ownedKey => $cap) {
        $normalized[$ownedKey] = is_array($state[$ownedKey] ?? null) ? array_slice(array_values($state[$ownedKey]), 0, $cap) : [];
    }
    $normalized['catalogSyncedAt'] = (string)($state['catalogSyncedAt'] ?? '');
    $normalized['stateRevision'] = max(0, (int)($state['stateRevision'] ?? 0));
    $normalized['editor'] = $editor;
    $normalized['editorDraft'] = is_array($state['editorDraft'] ?? null) ? $state['editorDraft'] : [];
    $normalized['settings'] = $settings;

    return $normalized;
}

function revision_file(): string
{
    return data_dir() . '/revision.txt';
}

function current_revision(): int
{
    return is_file(revision_file()) ? max(0, (int)trim((string)@file_get_contents(revision_file()))) : 0;
}

function load_state(): array
{
    $file = state_file();
    if (!file_exists($file)) {
        save_state(seed_state());
    }

    $raw = file_get_contents($file);
    $decoded = json_decode($raw ?: '', true);
    if (!is_array($decoded)) {
        $decoded = seed_state();
        save_state($decoded);
    }

    $normalized = normalize_state($decoded);
    $normalized['stateRevision'] = max($normalized['stateRevision'], current_revision());
    if ($normalized !== $decoded) {
        save_state($normalized);
    }

    return $normalized;
}

function save_state(array $state): void
{
    ensure_storage_ready();
    $file = state_file();
    if (file_exists($file)) {
        $backupDir = data_dir() . '/backups';
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0775, true);
        }
        if (is_dir($backupDir) && is_writable($backupDir)) {
            $backupFile = $backupDir . '/state-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2)) . '.json';
            @copy($file, $backupFile);
            $backups = glob($backupDir . '/state-*.json') ?: [];
            rsort($backups);
            foreach (array_slice($backups, 60) as $oldBackup) {
                @unlink($oldBackup);
            }
        }
    }
    $state = normalize_state($state);
    $state['stateRevision'] = max($state['stateRevision'], current_revision()) + 1;
    atomic_json_write($file, $state, 'estado');
    @file_put_contents(revision_file(), (string)$state['stateRevision'], LOCK_EX);
    daily_backup_if_needed();
}

function audit_entry(string $action, string $detail = ''): array
{
    $user = current_user();
    return [
        'id' => 'audit-' . bin2hex(random_bytes(8)),
        'at' => date('c'),
        'userId' => (string)($user['id'] ?? 'system'),
        'userName' => (string)($user['name'] ?? 'Sistema'),
        'action' => $action,
        'detail' => $detail,
        'ip' => client_ip(),
    ];
}

function push_audit(array $state, string $action, string $detail = ''): array
{
    $state['auditLog'] = is_array($state['auditLog'] ?? null) ? $state['auditLog'] : [];
    array_unshift($state['auditLog'], audit_entry($action, $detail));
    $state['auditLog'] = array_slice($state['auditLog'], 0, 400);
    return $state;
}

require_once __DIR__ . '/lib-ops.php';
require_once __DIR__ . '/lib-extra.php';
