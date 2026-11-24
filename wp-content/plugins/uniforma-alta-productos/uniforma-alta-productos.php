<?php
/**
 * Plugin Name: UNIFORMA - Alta de productos nuevos
 * Description: Crea como BORRADOR los productos de data/productos-nuevos.csv, con la misma función que usa el ERP (producto variable Color x Talle). Omite los que ya existen. No toca productos existentes.
 * Version: 1.0.0
 * Author: Web Systems
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 */
defined('ABSPATH') || exit;

final class Uniforma_Alta_Productos_202611 {
    const VERSION = '1.0.0';
    const CAP = 'manage_woocommerce';
    const NONCE = 'uniforma_alta_202611';
    const LOG = 'uniforma_alta_202611_log';
    const LOCK = 'uniforma_alta_202611_lock';
    const MARK = '_uniforma_alta_202611';

    public function __construct() {
        add_action('admin_menu', array($this, 'menu'));
        foreach (array('review', 'create', 'undo') as $action) {
            add_action('wp_ajax_uniforma_alta_' . $action, function () use ($action) { $this->ajax($action); });
        }
        add_action('admin_post_uniforma_alta_report', array($this, 'report'));
    }

    public function menu() {
        add_submenu_page('woocommerce', 'Alta de productos UNIFORMA', 'Alta de productos UNIFORMA', self::CAP, 'uniforma-alta-productos', array($this, 'page'));
    }

    /* ---------- Datos ---------- */

    private function key($text) {
        return sanitize_title(remove_accents((string) $text));
    }

    private function split($text, $sep = ',') {
        return array_values(array_filter(array_map('trim', explode($sep, (string) $text)), 'strlen'));
    }

    private function rows() {
        $file = __DIR__ . '/data/productos-nuevos.csv';
        $handle = fopen($file, 'r');
        if (!$handle) throw new RuntimeException('No se pudo leer data/productos-nuevos.csv.');
        $header = null; $rows = array();
        while (($line = fgetcsv($handle, 0, ';')) !== false) {
            if ($header === null) {
                $line[0] = preg_replace('/^\xEF\xBB\xBF/', '', $line[0]);
                $header = array_map('trim', $line);
                continue;
            }
            if (count(array_filter($line, 'strlen')) === 0) continue;
            $row = array();
            foreach ($header as $i => $col) $row[$col] = isset($line[$i]) ? trim($line[$i]) : '';
            if ($row['Nombre'] === '') continue;
            $row['key'] = $this->key($row['Nombre']);
            $rows[] = $row;
        }
        fclose($handle);
        return $rows;
    }

    /** Todos los productos de la base (cualquier estado menos papelera). */
    private function existing() {
        global $wpdb;
        $list = $wpdb->get_results("SELECT p.ID, p.post_title, p.post_status, m.meta_value AS sku FROM {$wpdb->posts} p LEFT JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_sku' WHERE p.post_type = 'product' AND p.post_status NOT IN ('trash','auto-draft')");
        foreach ($list as $p) $p->tokens = $this->tokens($p->post_title);
        return $list;
    }

    private function tokens($name) {
        $stop = array('de', 'del', 'con', 'y', 'la', 'el', 'para', 'en', 'x');
        $out = array();
        foreach (explode('-', $this->key($name)) as $t) {
            if (strlen($t) < 2 || in_array($t, $stop, true) || ctype_digit($t)) continue;
            $out[] = preg_replace('/(es|s)$/', '', $t); // singular simple
        }
        return array_values(array_unique($out));
    }

    private function status_label($status) {
        $labels = array('publish' => 'publicado', 'draft' => 'borrador', 'pending' => 'pendiente', 'private' => 'privado');
        return isset($labels[$status]) ? $labels[$status] : $status;
    }

    /** Coincidencia exacta (bloquea) y parecidos (solo avisan). */
    private function matches($row, $existing) {
        $exact = array(); $similar = array();
        $mine = $this->tokens($row['Nombre']);
        foreach ($existing as $p) {
            $label = $p->post_title . ' (#' . $p->ID . ', ' . ($p->sku ?: 'sin SKU') . ', ' . $this->status_label($p->post_status) . ')';
            if ($this->key($p->post_title) === $row['key'] || implode('-', $p->tokens) === implode('-', $mine)) { $exact[] = $label; continue; }
            $shared = count(array_intersect($mine, $p->tokens));
            $min = min(count($mine), count($p->tokens));
            if ($min > 0 && ($shared === $min || ($shared >= 2 && $shared / max(count($mine), count($p->tokens)) >= 0.5))) $similar[] = $label;
        }
        return array($exact, $similar);
    }

    /** "a, b/c" -> IDs: en cada grupo se usa el primer slug que exista. Nunca crea categorías. */
    private function categories($text, &$missing) {
        $ids = array();
        foreach ($this->split($text) as $group) {
            $found = false;
            foreach ($this->split($group, '/') as $slug) {
                $term = get_term_by('slug', $slug, 'product_cat');
                if ($term && !is_wp_error($term)) { $ids[] = (int) $term->term_id; $found = true; break; }
            }
            if (!$found) $missing[] = $group;
        }
        return array_values(array_unique($ids));
    }

    private function prices($row) {
        $prices = array();
        foreach (array(5, 10, 20, 50) as $qty) {
            $value = str_replace(array('$', '.', ' '), '', $row['Precio x' . $qty] ?? '');
            $value = str_replace(',', '.', $value);
            if ($value !== '' && is_numeric($value) && (float) $value > 0) $prices[(string) $qty] = (float) $value;
        }
        return $prices;
    }

    private function payload($row, $dry_run, $sku = '') {
        $details = implode("\n", $this->split($row['Detalles'] ?? '', '|'));
        $data = array(
            'dryRun' => $dry_run,
            'status' => 'draft',
            'name' => $row['Nombre'],
            'colors' => array_map(function ($c) { return array('name' => $c); }, $this->split($row['Colores'])),
            'sizes' => $this->split($row['Talles']),
            'shortDescription' => $row['Descripción corta'] ?? '',
        );
        if ($details !== '') $data['details'] = $details;
        if ($sku !== '') $data['sku'] = $sku;
        $prices = $this->prices($row);
        if ($prices) $data['prices'] = $prices;
        return $data;
    }

    /** Llama a la misma función que usa el ERP del tema (sin pasar por HTTP ni por la clave). */
    private function erp($data) {
        if (!function_exists('uniforma_erp_product_handle')) throw new RuntimeException('El tema UNIFORMA no está activo o es de una versión sin la carga de productos del ERP.');
        $request = new WP_REST_Request('POST', '/uniforma/v1/product');
        $request->set_header('content-type', 'application/json');
        $request->set_body(wp_json_encode($data));
        try {
            return uniforma_erp_product_handle($request);
        } catch (UniformaErpException $e) {
            $extra = array();
            foreach ((array) $e->details as $k => $v) $extra[] = is_array($v) ? implode(', ', $v) : (is_int($k) ? $v : $k . ': ' . $v);
            throw new RuntimeException($e->getMessage() . ($extra ? ' ' . implode(' ', $extra) : ''));
        }
    }

    /** Próximo SKU libre UNI-P### según la base real. */
    private function next_sku() {
        global $wpdb;
        $values = $wpdb->get_col("SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_sku' AND meta_value LIKE 'UNI-P%'");
        $max = 0;
        foreach ($values as $v) if (preg_match('/^UNI-P(\d+)$/', $v, $m)) $max = max($max, (int) $m[1]);
        return sprintf('UNI-P%03d', $max + 1);
    }

    /** Misma estructura de descripción larga que los productos actuales. */
    private function description($row) {
        $html = '<p>' . esc_html($row['Descripción corta'] ?? '') . '</p>' . "\n<ul>\n";
        $html .= '<li><strong>Talles disponibles:</strong> ' . esc_html(implode(', ', $this->split($row['Talles']))) . "</li>\n";
        $html .= '<li><strong>Colores disponibles:</strong> ' . esc_html(implode(', ', $this->split($row['Colores']))) . "</li>\n";
        $html .= "<li>Personalizable con bordado, DTF u otras técnicas según el proyecto.</li>\n<li>Precios unitarios escalonados por cantidad.</li>\n</ul>";
        return wp_kses_post($html);
    }

    private function created_by_me($key) {
        $ids = get_posts(array('post_type' => 'product', 'post_status' => array('publish', 'draft', 'pending', 'private'), 'fields' => 'ids', 'posts_per_page' => 1, 'meta_key' => self::MARK, 'meta_value' => $key));
        return $ids ? (int) $ids[0] : 0;
    }

    /* ---------- Acciones ---------- */

    private function review() {
        $existing = $this->existing();
        $out = array();
        foreach ($this->rows() as $i => $row) {
            list($exact, $similar) = $this->matches($row, $existing);
            $missing = array();
            $this->categories($row['Categorías'], $missing);
            $r = array('i' => $i, 'name' => $row['Nombre'], 'exact' => $exact, 'similar' => $similar, 'missing_categories' => $missing, 'note' => $row['A revisar'] ?? '', 'error' => '', 'plan' => '');
            $mine = $this->created_by_me($row['key']);
            if ($mine) { $r['state'] = 'done'; $r['plan'] = 'Ya creado por este plugin (#' . $mine . ').'; }
            elseif (strtoupper($row['Crear']) !== 'SI') { $r['state'] = 'skip'; $r['plan'] = 'Marcado «Crear = NO» en el CSV.'; }
            elseif ($exact) { $r['state'] = 'exists'; $r['plan'] = 'Ya existe: no se crea.'; }
            else {
                try {
                    $sim = $this->erp($this->payload($row, true));
                    $p = $sim['plan'];
                    $r['state'] = 'ready';
                    $r['plan'] = $sim['variations']['toCreate'] . ' variaciones';
                    if ($p['colorsToCreate']) $r['plan'] .= ' · colores nuevos en la web: ' . implode(', ', $p['colorsToCreate']);
                    if ($p['sizesToCreate']) $r['plan'] .= ' · talles nuevos en la web: ' . implode(', ', $p['sizesToCreate']);
                } catch (Throwable $e) { $r['state'] = 'error'; $r['error'] = $e->getMessage(); }
            }
            $out[] = $r;
        }
        return array('rows' => $out);
    }

    private function create($i) {
        $rows = $this->rows();
        if (!isset($rows[$i])) throw new RuntimeException('Fila inexistente.');
        $row = $rows[$i];
        if (strtoupper($row['Crear']) !== 'SI') throw new RuntimeException('La fila está marcada «Crear = NO».');
        if ($id = $this->created_by_me($row['key'])) return $this->log($row, $id, 'Ya estaba creado (no se repite).');
        list($exact) = $this->matches($row, $this->existing());
        if ($exact) throw new RuntimeException('Ya existe un producto con ese nombre: ' . implode('; ', $exact));

        $missing = array();
        $cat_ids = $this->categories($row['Categorías'], $missing);
        $sku = $this->next_sku();
        $result = $this->erp($this->payload($row, false, $sku));
        $id = (int) $result['wooId'];
        if (!$id) throw new RuntimeException('El ERP no devolvió el ID del producto.');

        update_post_meta($id, self::MARK, $row['key']);
        $product = wc_get_product($id);
        if ($cat_ids) $product->set_category_ids($cat_ids);
        $product->set_description($this->description($row));
        $product->set_status('draft');
        $product->save();
        wc_delete_product_transients($id);

        $msg = 'Creado en borrador con ' . (int) $result['variations']['created'] . ' variaciones.';
        if ($missing) $msg .= ' Categorías inexistentes (no asignadas): ' . implode(', ', $missing) . '.';
        if (!$this->prices($row)) $msg .= ' Sin precios: cargarlos antes de publicar.';
        return $this->log($row, $id, $msg, $sku);
    }

    private function log($row, $id, $msg, $sku = '') {
        $log = get_option(self::LOG, array());
        $log[$row['key']] = array('date' => current_time('mysql'), 'name' => $row['Nombre'], 'id' => $id, 'sku' => $sku ?: get_post_meta($id, '_sku', true), 'result' => $msg, 'edit' => admin_url('post.php?post=' . $id . '&action=edit'));
        update_option(self::LOG, $log, false);
        return $log[$row['key']];
    }

    /** Deshacer: manda a la papelera SOLO los productos creados por este plugin que sigan en borrador. */
    private function undo() {
        $ids = get_posts(array('post_type' => 'product', 'post_status' => 'draft', 'fields' => 'ids', 'posts_per_page' => -1, 'meta_key' => self::MARK, 'meta_compare' => 'EXISTS'));
        foreach ($ids as $id) wp_trash_post($id);
        return array('message' => count($ids) . ' producto(s) en borrador creados por este plugin se movieron a la papelera (Productos > Papelera para restaurarlos).');
    }

    public function ajax($action) {
        if (!current_user_can(self::CAP)) wp_send_json_error(array('message' => 'No tenés permisos.'), 403);
        check_ajax_referer(self::NONCE, 'nonce');
        if (!function_exists('wc_get_product')) wp_send_json_error(array('message' => 'WooCommerce debe estar activo.'), 400);
        $old = get_option(self::LOCK);
        if ($old && (int) $old < time() - 300) delete_option(self::LOCK);
        if (!add_option(self::LOCK, time(), '', false)) wp_send_json_error(array('message' => 'Hay otra operación en curso. Esperá unos segundos.'), 409);
        try {
            if ($action === 'review') $result = $this->review();
            elseif ($action === 'create') $result = $this->create(isset($_POST['row']) && ctype_digit((string) $_POST['row']) ? (int) $_POST['row'] : -1);
            else $result = $this->undo();
        } catch (Throwable $e) {
            delete_option(self::LOCK);
            wp_send_json_error(array('message' => $e->getMessage()), 400);
        }
        delete_option(self::LOCK);
        wp_send_json_success($result);
    }

    public function report() {
        if (!current_user_can(self::CAP)) wp_die('No tenés permisos.');
        check_admin_referer(self::NONCE);
        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="uniforma-alta-productos-registro.csv"');
        $f = fopen('php://output', 'w'); fwrite($f, "\xEF\xBB\xBF");
        fputcsv($f, array('Fecha', 'Producto', 'ID', 'SKU', 'Resultado', 'Editar'), ';');
        foreach (get_option(self::LOG, array()) as $l) fputcsv($f, array($l['date'], $l['name'], $l['id'], $l['sku'], $l['result'], $l['edit']), ';');
        fclose($f); exit;
    }

    /* ---------- Pantalla ---------- */

    public function page() {
        if (!current_user_can(self::CAP)) return;
        $nonce = wp_create_nonce(self::NONCE);
        ?>
        <div class="wrap">
        <h1>UNIFORMA · Alta de productos nuevos</h1>
        <div class="notice notice-info inline"><p>
            Crea los productos del archivo <code>data/productos-nuevos.csv</code> <strong>siempre en borrador</strong>, sin fotos (se ve la imagen genérica) y sin tocar ningún producto existente.
            Si un producto con el mismo nombre ya existe (publicado, borrador o privado) se omite.
        </p></div>
        <h2>1. Revisar</h2>
        <p>No escribe nada: compara con todos los productos de la web y simula la creación.</p>
        <p><button class="button button-primary" id="ua-review">Revisar</button></p>
        <div id="ua-table"></div>
        <h2>2. Crear seleccionados</h2>
        <p>Crea de a uno. Mantené la pestaña abierta; si se corta, volvé a revisar y crear: lo ya creado no se repite.</p>
        <p><button class="button button-primary" id="ua-create" disabled>Crear seleccionados en borrador</button> <span id="ua-status" aria-live="polite"></span></p>
        <h2>3. Registro y deshacer</h2>
        <p>
            <a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=uniforma_alta_report'), self::NONCE)); ?>">Descargar registro CSV</a>
            <button class="button" id="ua-undo">Deshacer: mandar a la papelera lo creado (solo borradores)</button>
        </p>
        </div>
        <style>
            #ua-table table td{vertical-align:top} .ua-exists{color:#996800} .ua-error{color:#b32d2e} .ua-ok{color:#007017} .ua-small{font-size:12px;color:#555}
        </style>
        <script>
        (function($){
            var nonce = <?php echo wp_json_encode($nonce); ?>, url = ajaxurl, rows = [];
            function post(action, data){ return $.post(url, $.extend({action:'uniforma_alta_'+action, nonce:nonce}, data||{})); }
            function esc(s){ return $('<div>').text(s||'').html(); }
            function render(){
                var h = '<table class="widefat striped"><thead><tr><th style="width:30px"></th><th>Producto</th><th>Resultado de la revisión</th><th>Parecidos en la web (revisar a mano)</th><th>A revisar</th></tr></thead><tbody>';
                rows.forEach(function(r){
                    var ok = r.state==='ready', cls = {ready:'ua-ok', exists:'ua-exists', error:'ua-error', done:'ua-ok', skip:''}[r.state];
                    var res = r.state==='exists' ? 'Ya existe: '+r.exact.join('; ') : (r.error || r.plan);
                    if (r.missing_categories.length) res += ' · Categorías inexistentes: '+r.missing_categories.join(', ');
                    h += '<tr><td>'+(ok?'<input type="checkbox" class="ua-sel" value="'+r.i+'" checked>':'')+'</td><td><strong>'+esc(r.name)+'</strong></td><td class="'+cls+'">'+esc(res)+'</td><td class="ua-small">'+esc(r.similar.join(' · '))+'</td><td class="ua-small">'+esc(r.note)+'</td></tr>';
                });
                $('#ua-table').html(h+'</tbody></table>');
                $('#ua-create').prop('disabled', !rows.some(function(r){return r.state==='ready';}));
            }
            $('#ua-review').on('click', function(){
                var b=$(this).prop('disabled',true); $('#ua-status').text('Revisando…');
                post('review').done(function(res){ if(!res.success){alert(res.data.message);return;} rows=res.data.rows; render(); $('#ua-status').text('Revisión lista. Destildá lo que no quieras crear.'); })
                .fail(function(x){ alert((x.responseJSON&&x.responseJSON.data&&x.responseJSON.data.message)||'Error de conexión.'); })
                .always(function(){ b.prop('disabled',false); });
            });
            $('#ua-create').on('click', function(){
                var queue = $('.ua-sel:checked').map(function(){return +this.value;}).get();
                if(!queue.length || !confirm('Se crearán '+queue.length+' productos en BORRADOR. ¿Continuar?')) return;
                $('#ua-create,#ua-review').prop('disabled',true);
                var done=0, errors=0;
                (function next(){
                    if(!queue.length){ $('#ua-status').text('Terminado: '+done+' creados, '+errors+' con error. Volvé a revisar para ver el estado.'); $('#ua-review').prop('disabled',false); return; }
                    var i=queue.shift(), r=rows.find(function(x){return x.i===i;});
                    $('#ua-status').text('Creando '+r.name+'… (faltan '+queue.length+')');
                    post('create',{row:i}).done(function(res){ var td=$('.ua-sel[value='+i+']').closest('tr').find('td').eq(2);
                        if(res.success){ done++; td.attr('class','ua-ok').html(esc(res.data.result)+' <a href="'+res.data.edit+'" target="_blank">Editar #'+res.data.id+'</a>'); }
                        else { errors++; td.attr('class','ua-error').text(res.data.message); } })
                    .fail(function(x){ errors++; $('.ua-sel[value='+i+']').closest('tr').find('td').eq(2).attr('class','ua-error').text((x.responseJSON&&x.responseJSON.data&&x.responseJSON.data.message)||'Error de conexión (podés reintentar).'); })
                    .always(function(){ $('.ua-sel[value='+i+']').remove(); setTimeout(next, 400); });
                })();
            });
            $('#ua-undo').on('click', function(){
                if(!confirm('Se moverán a la PAPELERA todos los productos creados por este plugin que sigan en borrador. ¿Continuar?')) return;
                post('undo').done(function(res){ alert(res.success?res.data.message:res.data.message); });
            });
        })(jQuery);
        </script>
        <?php
    }
}
new Uniforma_Alta_Productos_202611();
