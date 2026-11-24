<?php
/**
 * Plugin Name: UNIFORMA - Importador de catálogo e imágenes
 * Description: Edición octubre 2026: actualización de fotos de productos existentes y remera con lycra a borrador. Incluye revisión de coincidencias.
 * Version: 2.1.0
 * Author: Web Systems
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 */
defined('ABSPATH') || exit;

final class Uniforma_Photo_Importer_202610 {
    const VERSION = '2.1.0';
    const STATE = 'uniforma_photos_202610_state';
    const LOCK = 'uniforma_photos_202610_lock';
    const NONCE = 'uniforma_photos_202610';
    const BACKUP = '_uniforma_photos_backup_20261016';
    const CAP = 'manage_woocommerce';
    private $data;

    public function __construct() {
        add_action('admin_menu', array($this, 'menu'));
        add_action('admin_enqueue_scripts', array($this, 'assets'));
        foreach (array('review', 'start', 'step', 'reset') as $action) {
            add_action('wp_ajax_uniforma_photos_' . $action, function () use ($action) { $this->ajax($action); });
        }
        add_action('admin_post_uniforma_photos_report', array($this, 'report'));
    }

    private function manifest() {
        if (!$this->data) {
            $this->data = json_decode(file_get_contents(__DIR__ . '/data/fotos.json'), true);
            if (!is_array($this->data) || empty($this->data['products'])) throw new RuntimeException('No se pudo leer el paquete de fotos.');
        }
        return $this->data;
    }

    public function menu() {
        add_submenu_page('woocommerce', 'Importador UNIFORMA', 'Importador UNIFORMA', self::CAP, 'uniforma-importador-catalogo', array($this, 'page'));
    }

    public function assets($hook) {
        if ($hook !== 'woocommerce_page_uniforma-importador-catalogo') return;
        wp_enqueue_script('wc-enhanced-select');
        wp_enqueue_style('woocommerce_admin_styles');
        wp_enqueue_style('uniforma-photos', plugin_dir_url(__FILE__) . 'assets/admin.css', array(), self::VERSION);
        wp_enqueue_script('uniforma-photos', plugin_dir_url(__FILE__) . 'assets/admin.js', array('jquery', 'wc-enhanced-select'), self::VERSION, true);
        wp_localize_script('uniforma-photos', 'UniformaPhotos', array('url' => admin_url('admin-ajax.php'), 'nonce' => wp_create_nonce(self::NONCE)));
    }

    private function key($text) { return sanitize_title(remove_accents((string) $text)); }

    private function excluded($product, $operation) {
        $sku = $product->get_sku();
        $name = $this->key($product->get_name());
        if ($operation === 'draft') {
            return !($sku === 'UNI-P006' || in_array($name, array('remera-mujer-con-lycra', 'remera-de-mujer-con-lycra'), true));
        }
        if (in_array($sku, $this->manifest()['excluded_skus'], true)) return true;
        return (bool) preg_match('/^(remera-(clasica|oversize)|remera-(de-)?mujer.*lycra|chomba-pique|buzo-canguro|campera-polar|buzo-polar|chaleco-polar|camisa-|gorra-vintage|zapatos?-bochin|botin(es)?-dielectrico|zapato-dielectrico|zapatillas?-boston|botines-grafa|zapatos?-grafa|zapato-berlin)/', $name);
    }

    private function valid_product($id, $item) {
        $p = wc_get_product(absint($id));
        if (!$p || get_post_type($id) !== 'product' || $p->get_status() === 'trash' || $this->excluded($p, $item['operation'])) return false;
        return $p;
    }

    private function find_product($item) {
        $id = wc_get_product_id_by_sku($item['sku']);
        if ($id) return $this->valid_product($id, $item) ? absint($id) : 0;
        $candidates = array();
        $p = get_page_by_path($item['slug'], OBJECT, 'product');
        if ($p) $candidates[] = $p->ID;
        if (!empty($item['existing_id'])) $candidates[] = $item['existing_id'];
        global $wpdb;
        foreach ($item['names'] as $name) {
            $candidates = array_merge($candidates, $wpdb->get_col($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type='product' AND post_status NOT IN ('trash','auto-draft') AND post_title=%s", $name)));
        }
        $names = array_map(array($this, 'key'), $item['names']);
        $matches = array();
        foreach (array_unique(array_map('absint', $candidates)) as $candidate) {
            $p = $this->valid_product($candidate, $item);
            if (!$p || ($p->get_sku() && $p->get_sku() !== $item['sku'])) continue;
            if (!in_array($this->key($p->get_name()), $names, true)) continue;
            $matches[] = $candidate;
        }
        return count($matches) === 1 ? $matches[0] : 0;
    }

    public function page() {
        if (!current_user_can(self::CAP)) return;
        if (!function_exists('wc_get_product')) { echo '<div class="notice notice-error"><p>Activá WooCommerce para usar este importador.</p></div>'; return; }
        $m = $this->manifest();
        $state = get_option(self::STATE, array());
        ?>
        <div class="wrap uniforma-photos">
        <h1>UNIFORMA · Fotos de octubre</h1>
        <p>172 fotos nuevas · 34 productos previstos · 1 producto a borrador. Esta edición reemplaza la sincronización general por una carga exclusiva de fotos.</p>
        <p>Conserva precios, talles, textos, stock y categorías. Solo actualiza productos existentes. Las imágenes anteriores quedan en Medios.</p>
        <details><summary>Exclusiones y fotos pendientes</summary>
            <?php foreach ($m['excluded_notes'] as $note) echo '<p>' . esc_html($note) . '</p>'; ?>
            <p>18 fotos pendientes: conjuntos Milano, Mora, Venecia y Turín; alpargatas con guarda; gorro chef azul de jean. Ver PENDIENTES.csv dentro del ZIP.</p>
        </details>
        <h2>1. Revisar productos</h2>
        <p>Las coincidencias seguras vienen seleccionadas. Si una fila está vacía, buscá el producto correspondiente o dejala vacía para omitirla. Los colores se comparan con los que ya existen en la ficha.</p>
        <table class="widefat striped"><thead><tr><th>Producto del paquete</th><th>Producto en la web</th><th>Acción</th></tr></thead><tbody>
        <?php foreach ($m['products'] as $item):
            $id = isset($state['selection']) && array_key_exists($item['sku'], $state['selection']) ? absint($state['selection'][$item['sku']]) : $this->find_product($item); $p = $id ? wc_get_product($id) : false; ?>
            <tr><td><?php echo esc_html($item['name']); ?><br><small><?php echo esc_html($item['sku']); ?></small></td>
            <td><select class="wc-product-search uniforma-target" data-sku="<?php echo esc_attr($item['sku']); ?>" data-placeholder="Buscar producto existente…" data-action="woocommerce_json_search_products" data-allow_clear="true" style="width:100%">
                <?php if ($p): ?><option value="<?php echo absint($id); ?>" selected><?php echo esc_html($p->get_name() . ' (#' . $id . ')'); ?></option><?php endif; ?>
            </select></td><td><?php echo $item['operation'] === 'draft' ? '<strong>Pasar a borrador</strong>' : esc_html(count($item['images']) . ' fotos'); ?></td></tr>
        <?php endforeach; ?></tbody></table>
        <p><button class="button" id="uniforma-review">Revisar coincidencias</button></p>
        <div id="uniforma-review-results" aria-live="polite"></div>
        <h2>2. Importar</h2>
        <p>Mantené esta pestaña abierta. Si la conexión se interrumpe, podés reanudar. No se crean productos ni variaciones.</p>
        <progress id="uniforma-progress" value="0" max="100"></progress>
        <p id="uniforma-status" aria-live="polite"><?php echo !empty($state['started']) ? 'Hay una ejecución guardada. Podés reanudarla.' : 'Primero revisá las coincidencias.'; ?></p>
        <button class="button button-primary" id="uniforma-start" <?php disabled(empty($state['plan'])); ?>>Iniciar / reanudar carga</button>
        <button class="button" id="uniforma-reset">Reiniciar progreso</button>
        <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=uniforma_photos_report'), self::NONCE)); ?>">Descargar registro CSV</a>
        <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=uniforma_photos_report&format=backup'), self::NONCE)); ?>">Descargar respaldo de asignaciones</a>
        <p>Antes del primer cambio de cada producto se guarda su estado y sus asignaciones de imágenes anteriores. Reiniciar el progreso no elimina ese respaldo.</p>
        </div>
        <?php
    }

    private function acquire() {
        $old = get_option(self::LOCK);
        if ($old && (int) $old < time() - 180) delete_option(self::LOCK);
        if (!add_option(self::LOCK, time(), '', false)) throw new RuntimeException('Hay otro lote en curso. Esperá unos segundos y reanudá.');
    }

    public function ajax($action) {
        if (!current_user_can(self::CAP)) wp_send_json_error(array('message' => 'No tenés permisos.'), 403);
        check_ajax_referer(self::NONCE, 'nonce');
        if (!function_exists('wc_get_product')) wp_send_json_error(array('message' => 'WooCommerce debe estar activo.'), 400);
        $locked = false; $error = null; $result = null;
        try {
            $this->acquire(); $locked = true;
            if ($action === 'review') $result = $this->review();
            elseif ($action === 'reset') { delete_option(self::STATE); $result = array('message' => 'Progreso reiniciado. Revisá las coincidencias otra vez.'); }
            else {
                $state = get_option(self::STATE, array());
                if (empty($state['plan']) || ($state['version'] ?? '') !== self::VERSION) throw new RuntimeException('Primero revisá las coincidencias.');
                if ($action === 'start') { $state['started'] = true; update_option(self::STATE, $state, false); }
                elseif (!empty($state['started']) && empty($state['done'])) $state = $this->step($state);
                $result = $this->public_state($state);
            }
        } catch (Throwable $e) { $error = $e->getMessage(); }
        finally { if ($locked) delete_option(self::LOCK); }
        if ($error !== null) wp_send_json_error(array('message' => $error), 400);
        wp_send_json_success($result);
    }

    private function colors($product) {
        $colors = array();
        foreach ($product->get_attributes() as $attribute) {
            if (!in_array($this->key($attribute->get_name()), array('pa_color', 'pa-color', 'color', 'colores'), true)) continue;
            if ($attribute->is_taxonomy()) {
                foreach ($attribute->get_options() as $id) {
                    $term = get_term($id, $attribute->get_name());
                    if (!$term || is_wp_error($term)) continue;
                    $colors[$this->key($term->name)] = $term->slug;
                    $colors[$this->key($term->slug)] = $term->slug;
                }
            } else foreach ($attribute->get_options() as $value) $colors[$this->key($value)] = $this->key($value);
        }
        return $colors;
    }

    private function review() {
        $previous = get_option(self::STATE, array());
        if (!empty($previous['started'])) throw new RuntimeException('Ya hay una ejecución guardada. Reanudala o reiniciá el progreso para cambiar las coincidencias.');
        $selection = isset($_POST['selection']) ? json_decode(wp_unslash($_POST['selection']), true) : array();
        if (!is_array($selection)) throw new RuntimeException('La selección no es válida.');
        $plan = array(); $rows = array(); $seen = array();
        foreach ($this->manifest()['products'] as $item) {
            $id = absint($selection[$item['sku']] ?? 0);
            $message = ''; $images = array(); $allowed = array();
            if (!$id) $message = 'Omitido: no se seleccionó un producto existente.';
            else {
                $p = $this->valid_product($id, $item);
                if (!$p) throw new RuntimeException($item['name'] . ': el destino no es un producto válido o está excluido.');
                if (isset($seen[$id])) throw new RuntimeException('El producto #' . $id . ' fue elegido en dos filas. Asigná cada fila al producto correcto.');
                $seen[$id] = true;
                if ($item['operation'] === 'photos') {
                    $live = $this->colors($p); $missing = array();
                    foreach ($item['images'] as $image) {
                        if (!isset($live[$image['color_slug']])) { $missing[] = $image['color']; continue; }
                        $image['target_color'] = $live[$image['color_slug']];
                        $images[] = $image; $allowed[$image['color_slug']] = $image['target_color'];
                    }
                    if ($missing) $message = 'Sin importar los colores ausentes en la web: ' . implode(', ', array_unique($missing)) . '.';
                    if (!$images) $message = 'Omitido: no hay colores coincidentes. ' . $message;
                }
                if ($images || $item['operation'] === 'draft') {
                    $item['product_id'] = $id; $item['images'] = $images; $item['color_targets'] = $allowed;
                    $item['target_name'] = $p->get_name(); $item['target_sku'] = $p->get_sku();
                    $plan[] = $item;
                }
            }
            $rows[] = array('sku' => $item['sku'], 'product' => $item['name'], 'target' => $id ? $p->get_name() . ' (#' . $id . ')' : 'Sin asignar', 'operation' => $item['operation'], 'images' => count($images), 'message' => $message ?: 'Listo.');
        }
        $state = array('version' => self::VERSION, 'selection' => array_map('absint', $selection), 'plan' => $plan, 'review' => $rows, 'index' => 0, 'phase' => 'images', 'offset' => 0, 'variation_offset' => 0, 'ids' => array(), 'fronts' => array(), 'done' => false, 'started' => false, 'log' => array(), 'created' => 0, 'reused' => 0, 'message' => 'Coincidencias revisadas.');
        update_option(self::STATE, $state, false);
        return array('rows' => $rows, 'ready' => count($plan), 'message' => count($plan) . ' productos preparados.');
    }

    private function backup($id) {
        if (metadata_exists('post', $id, self::BACKUP)) return;
        $p = wc_get_product($id); $variations = array();
        foreach ($this->variation_ids($id) as $vid) $variations[$vid] = get_post_meta($vid, '_thumbnail_id', true);
        $backup = array('date' => current_time('mysql'), 'product_id' => $id, 'status' => $p->get_status(), 'featured' => $p->get_image_id(), 'gallery' => $p->get_gallery_image_ids(), 'color_map' => get_post_meta($id, '_uniforma_color_image_map', true), 'variation_images' => $variations);
        if (!add_post_meta($id, self::BACKUP, $backup, true)) throw new RuntimeException('No se pudo guardar el respaldo del producto #' . $id . '.');
    }

    private function variation_ids($id) {
        return get_posts(array('post_type' => 'product_variation', 'post_parent' => $id, 'post_status' => array('publish', 'private', 'draft', 'pending'), 'fields' => 'ids', 'posts_per_page' => -1, 'orderby' => 'ID', 'order' => 'ASC'));
    }

    private function step($state) {
        @set_time_limit(60);
        $item = $state['plan'][$state['index']]; $id = $item['product_id'];
        $p = $this->valid_product($id, $item);
        if (!$p || $p->get_sku() !== $item['target_sku'] || $p->get_name() !== $item['target_name']) throw new RuntimeException('La ficha cambió desde la revisión. Reiniciá el progreso y revisá las coincidencias.');
        if ($item['operation'] === 'photos') {
            $live = $this->colors($p);
            foreach ($item['color_targets'] as $color => $target) if (($live[$color] ?? '') !== $target) throw new RuntimeException('Los colores de la ficha cambiaron. Revisá las coincidencias nuevamente.');
        }
        $this->backup($id);
        if ($item['operation'] === 'draft') {
            $p->set_status('draft'); $p->save();
            $state['phase'] = 'finish';
        } elseif ($state['phase'] === 'images') {
            foreach (array_slice($item['images'], $state['offset'], 2) as $image) {
                $result = $this->attachment($image, $item['name']);
                $state['ids'][] = $result['id'];
                if ($image['view'] === 'frente') $state['fronts'][$image['target_color']] = $result['id'];
                $state[$result['created'] ? 'created' : 'reused']++;
                $state['offset']++;
                update_option(self::STATE, $state, false);
            }
            if ($state['offset'] >= count($item['images'])) $state['phase'] = 'apply';
        } elseif ($state['phase'] === 'apply') {
            $this->apply_images($p, $state['ids'], $state['fronts']);
            $state['variation_ids'] = $this->variation_ids($id);
            $state['phase'] = 'variations';
        } elseif ($state['phase'] === 'variations') {
            foreach (array_slice($state['variation_ids'], $state['variation_offset'], 20) as $vid) {
                $v = wc_get_product($vid);
                if ($v && $v->get_parent_id() === $id) {
                    foreach ($v->get_attributes() as $key => $color) {
                        if (!in_array($this->key($key), array('pa_color','pa-color','color','colores'), true)) continue;
                        $color = $this->key($color);
                        if (isset($state['fronts'][$color])) { $v->set_image_id($state['fronts'][$color]); $v->save(); }
                    }
                }
                $state['variation_offset']++;
            }
            if ($state['variation_offset'] >= count($state['variation_ids'])) $state['phase'] = 'finish';
        }
        $state['message'] = $item['name'] . ': ' . $state['offset'] . '/' . count($item['images']) . ' fotos; ' . $state['phase'] . '.';
        if ($state['phase'] === 'finish') {
            wc_delete_product_transients($id); clean_post_cache($id);
            $state['log'][] = array('sku' => $item['sku'], 'id' => $id, 'product' => $p->get_name(), 'operation' => $item['operation'], 'images' => count($item['images']), 'result' => 'OK');
            $state['index']++; $state['phase'] = 'images'; $state['offset'] = 0; $state['variation_offset'] = 0; $state['ids'] = array(); $state['fronts'] = array();
            if ($state['index'] >= count($state['plan'])) { $state['done'] = true; $state['message'] = 'Carga terminada. Revisá el registro y las fichas actualizadas.'; }
        }
        update_option(self::STATE, $state, false);
        return $state;
    }

    private function attachment($image, $product_name) {
        $filename = basename($image['filename']);
        $path = __DIR__ . '/images/' . $filename;
        if (!is_readable($path) || hash_file('sha256', $path) !== $image['sha256']) throw new RuntimeException('Archivo ausente o incompleto: ' . $filename);
        $ids = get_posts(array('post_type' => 'attachment', 'post_status' => 'inherit', 'fields' => 'ids', 'posts_per_page' => -1, 'meta_key' => '_uniforma_source_sha256', 'meta_value' => $image['sha256']));
        foreach ($ids as $id) {
            $file = get_attached_file($id);
            if ($file && is_readable($file) && hash_file('sha256', $file) === $image['sha256']) {
                $this->attachment_labels($id, $image, $product_name);
                $this->attachment_metadata($id, $file);
                return array('id' => absint($id), 'created' => false);
            }
        }
        $upload = wp_upload_bits($filename, null, file_get_contents($path));
        if (!empty($upload['error'])) throw new RuntimeException('No se pudo subir ' . $filename . ': ' . $upload['error']);
        $id = wp_insert_attachment(array('post_mime_type' => 'image/webp', 'post_title' => $product_name . ' - ' . $image['color'] . ' - ' . $image['view'], 'post_status' => 'inherit'), $upload['file'], 0, true);
        if (is_wp_error($id) || !$id) throw new RuntimeException('No se pudo registrar la imagen: ' . $filename);
        // Registrar la huella antes de generar miniaturas permite reanudar tras un timeout.
        update_post_meta($id, '_uniforma_source_sha256', $image['sha256']);
        $this->attachment_labels($id, $image, $product_name);
        $this->attachment_metadata($id, $upload['file']);
        return array('id' => absint($id), 'created' => true);
    }

    private function attachment_labels($id, $image, $name) {
        // El tema detecta color y vista a partir de este nombre y su sufijo frente/espalda.
        $label = 'uniforma-oct2026-' . $this->key($name) . '-' . $image['target_color'] . '-' . $image['view'] . '.webp';
        update_post_meta($id, '_uniforma_source_file', $label);
        update_post_meta($id, '_wp_attachment_image_alt', $name . ' ' . $image['color'] . ' ' . $image['view']);
    }

    private function attachment_metadata($id, $file) {
        if (wp_get_attachment_metadata($id)) return;
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $metadata = wp_generate_attachment_metadata($id, $file);
        if (!is_array($metadata) || empty($metadata['width'])) throw new RuntimeException('WordPress no pudo procesar la imagen WebP #' . $id . '.');
        wp_update_attachment_metadata($id, $metadata);
    }

    private function image_color($id, $colors, $old_map) {
        foreach ($old_map as $color => $front) if ((int) $front === (int) $id) return $color;
        usort($colors, function ($a, $b) { return strlen($b) <=> strlen($a); });
        $sources = array(get_post_meta($id, '_uniforma_source_file', true), basename((string) get_attached_file($id)), get_post_field('post_title', $id), get_post_meta($id, '_wp_attachment_image_alt', true));
        foreach ($sources as $source) {
            $text = $this->key(pathinfo((string) $source, PATHINFO_FILENAME));
            foreach ($colors as $color) if (preg_match('/(?:^|-)' . preg_quote($color, '/') . '(?:-(?:frente|front|espalda|dorso|back)(?:$|-)|$)/', $text)) return $color;
        }
        return '';
    }

    private function apply_images($p, $ids, $fronts) {
        $id = $p->get_id();
        $old_map = json_decode(get_post_meta($id, '_uniforma_color_image_map', true), true);
        if (!is_array($old_map)) $old_map = array();
        $colors = array_values(array_unique(array_merge(array_keys($old_map), array_keys($fronts), array_values($this->colors($p)))));
        $old_featured = $p->get_image_id();
        $featured_color = $this->image_color($old_featured, $colors, $old_map);
        $featured = $old_featured;
        if (!$featured) $featured = reset($ids);
        elseif (isset($fronts[$featured_color])) $featured = $fronts[$featured_color];
        elseif (!$featured_color) $featured = reset($ids);
        $keep = array();
        foreach ($p->get_gallery_image_ids() as $old_id) {
            $color = $this->image_color($old_id, $colors, $old_map);
            if (!isset($fronts[$color])) $keep[] = $old_id;
        }
        $gallery = array_values(array_diff(array_unique(array_merge($ids, $keep)), array($featured)));
        $p->set_image_id(absint($featured)); $p->set_gallery_image_ids($gallery); $p->save();
        update_post_meta($id, '_uniforma_color_image_map', wp_json_encode(array_merge($old_map, $fronts)));
    }

    private function public_state($s) {
        $total = count($s['plan']);
        return array('done' => !empty($s['done']), 'percent' => !empty($s['done']) ? 100 : round(100 * $s['index'] / max(1, $total), 1), 'message' => $s['message'], 'completed' => $s['index'], 'total' => $total, 'created' => $s['created'], 'reused' => $s['reused']);
    }

    public function report() {
        if (!current_user_can(self::CAP)) wp_die('No tenés permisos.');
        check_admin_referer(self::NONCE);
        $s = get_option(self::STATE, array());
        nocache_headers();
        if (isset($_GET['format']) && $_GET['format'] === 'backup') {
            $backups = array();
            // Incluye respaldos de ejecuciones anteriores aunque se haya reiniciado el progreso.
            $ids = get_posts(array('post_type' => 'product', 'post_status' => array('publish','draft','private','pending','trash'), 'posts_per_page' => -1, 'fields' => 'ids', 'meta_key' => self::BACKUP, 'meta_compare' => 'EXISTS'));
            foreach ($ids as $id) $backups[] = get_post_meta($id, self::BACKUP, true);
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="uniforma-respaldo-fotos-20261016.json"');
            echo wp_json_encode($backups, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE); exit;
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="uniforma-registro-fotos-20261016.csv"');
        $f = fopen('php://output', 'w'); fwrite($f, "\xEF\xBB\xBF");
        fputcsv($f, array('SKU','Producto','Destino','Acción','Fotos','Resultado'), ';');
        foreach (($s['review'] ?? array()) as $row) {
            $result = $row['message'];
            foreach (($s['log'] ?? array()) as $log) if ($log['sku'] === $row['sku']) $result = 'OK. ' . $result;
            $values = array($row['sku'], $row['product'], $row['target'], $row['operation'], $row['images'], $result);
            $values = array_map(function ($v) { $v = (string) $v; return preg_match('/^[=+@\-\t\r]/', $v) ? "'" . $v : $v; }, $values);
            fputcsv($f, $values, ';');
        }
        fclose($f); exit;
    }
}
new Uniforma_Photo_Importer_202610();
