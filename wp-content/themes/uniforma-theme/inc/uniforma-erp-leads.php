<?php
/**
 * Envía al ERP de UNIFORMA las consultas y pedidos de presupuesto hechos en la web.
 *
 * La web NO guarda el token del ERP en el código. Se define en wp-config.php:
 *   define('UNIFORMA_ERP_LEAD_URL',   'https://uniforma.com.ar/panel/lead.php');
 *   define('UNIFORMA_ERP_LEAD_TOKEN', '...token largo y secreto, igual a lead_token del panel...');
 * Si no están definidas, la consulta sigue yendo por WhatsApp como siempre y este envío se omite.
 */
if (!defined('ABSPATH')) {
    exit;
}

function uniforma_lead_clean($value, $max = 400)
{
    $value = is_scalar($value) ? (string) $value : '';
    return mb_substr(trim(wp_strip_all_tags($value)), 0, $max);
}

function uniforma_lead_rest_callback(WP_REST_Request $request)
{
    $data = $request->get_json_params();
    if (!is_array($data)) {
        $data = $request->get_params();
    }
    // Anti-spam: campo trampa y límite por IP.
    if (!empty($data['website'])) {
        return rest_ensure_response(array('ok' => true));
    }
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    $key = 'uniforma_lead_' . md5($ip);
    $count = (int) get_transient($key);
    if ($count >= 8) {
        return new WP_REST_Response(array('ok' => false, 'error' => 'Demasiados envíos. Probá más tarde.'), 429);
    }
    set_transient($key, $count + 1, HOUR_IN_SECONDS);

    $payload = array(
        'source' => uniforma_lead_clean($data['source'] ?? 'contacto', 30),
        'name' => uniforma_lead_clean($data['name'] ?? '', 120),
        'company' => uniforma_lead_clean($data['company'] ?? '', 160),
        'email' => sanitize_email((string) ($data['email'] ?? '')),
        'phone' => uniforma_lead_clean($data['phone'] ?? '', 60),
        'qty' => uniforma_lead_clean($data['qty'] ?? '', 40),
        'type' => uniforma_lead_clean($data['type'] ?? '', 80),
        'message' => uniforma_lead_clean($data['message'] ?? '', 1500),
        'product' => uniforma_lead_clean($data['product'] ?? '', 160),
        'sku' => uniforma_lead_clean($data['sku'] ?? '', 60),
        'color' => uniforma_lead_clean($data['color'] ?? '', 60),
        'size' => uniforma_lead_clean($data['size'] ?? '', 60),
        'personalization' => uniforma_lead_clean($data['personalization'] ?? '', 80),
        'page' => esc_url_raw((string) ($data['page'] ?? '')),
    );
    $needsContact = $payload['source'] !== 'producto';
    if ($needsContact && $payload['name'] === '' && $payload['company'] === '') {
        return new WP_REST_Response(array('ok' => false, 'error' => 'Faltan datos de contacto.'), 422);
    }
    if ($needsContact && $payload['email'] === '' && $payload['phone'] === '') {
        return new WP_REST_Response(array('ok' => false, 'error' => 'Falta un email o teléfono.'), 422);
    }
    if (!defined('UNIFORMA_ERP_LEAD_URL') || !defined('UNIFORMA_ERP_LEAD_TOKEN') || !UNIFORMA_ERP_LEAD_URL || !UNIFORMA_ERP_LEAD_TOKEN) {
        return rest_ensure_response(array('ok' => true, 'forwarded' => false));
    }
    $response = wp_remote_post(UNIFORMA_ERP_LEAD_URL, array(
        'timeout' => 8,
        'headers' => array('Content-Type' => 'application/json', 'X-Uniforma-Lead-Token' => UNIFORMA_ERP_LEAD_TOKEN),
        'body' => wp_json_encode($payload),
    ));
    $ok = !is_wp_error($response) && (int) wp_remote_retrieve_response_code($response) < 300;
    return rest_ensure_response(array('ok' => true, 'forwarded' => $ok));
}

function uniforma_register_lead_api()
{
    register_rest_route('uniforma/v1', '/lead', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'uniforma_lead_rest_callback',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'uniforma_register_lead_api');

/** JS común: window.uniformaSendLead(datos). Falla en silencio: nunca debe frenar el WhatsApp. */
function uniforma_enqueue_leads_script()
{
    uniforma_enqueue_script('uniforma-leads', 'assets/js/uniforma-leads.js');
    wp_localize_script('uniforma-leads', 'uniformaLeads', array('endpoint' => esc_url_raw(rest_url('uniforma/v1/lead'))));
}
