/* Envía la consulta al ERP de UNIFORMA (vía el endpoint del theme). No bloquea ni cambia el flujo de WhatsApp. */
(function () {
  window.uniformaSendLead = function (data) {
    try {
      if (!window.uniformaLeads || !window.uniformaLeads.endpoint) return;
      var body = Object.assign({ page: location.href }, data || {});
      fetch(window.uniformaLeads.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit'
      }).catch(function () {});
    } catch (e) { /* sin red: se ignora */ }
  };
})();
