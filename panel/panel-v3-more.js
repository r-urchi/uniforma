/* UNIFORMA ERP — planilla de talles, fotos del trabajo, encuesta, recompra, avisos automáticos, mi cuenta (2 pasos),
   respaldo, comisiones, barra inferior móvil y app instalable. Se carga después de panel-v3-biz.js. */
(() => {
  "use strict";
  const UF3 = window.UF3;
  if (!UF3) return;
  const { svg, ico } = UF3;
  const NUM = (n) => Number(n || 0);
  const BILLED = ["Aprobada", "En producción", "Lista", "Entregada"];
  const stamp = (iso) => (iso ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const csv = (name, lines) => {
    const body = "﻿" + lines.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const refreshDetail = (id) => { if (currentView === "propuestas" && $("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(proposal(id)); else renderView(); };

  /* ================= planilla de talles ================= */
  const rosterTotals = (p) => (p.roster || []).reduce((s, r) => s + NUM(r.qty), 0);
  function rosterSection(p) {
    if (!can("proposals.view") || !(p.designs || []).length) return "";
    const manage = can("proposals.manage"), r = p.roster || [], st = p.rosterStatus;
    if (!p.rosterEnabled && !r.length) {
      return manage ? `<section class="v3-roster"><h3>${svg("users2", 16)} Planilla de talles y nombres</h3><p>Para uniformes de varias personas: el cliente completa desde su link el talle y el nombre a bordar de cada una, y con un clic se cargan las cantidades por talle.</p><button type="button" data-v3-roster="enable:${esc(p.id)}">Habilitar planilla para el cliente</button></section>` : "";
    }
    const agg = {};
    r.forEach((x) => { const k = `${x.designId}|${x.color}|${x.size}`; agg[k] = (agg[k] || 0) + NUM(x.qty); });
    const label = { open: "Abierta para el cliente", submitted: "Recibida del cliente", applied: "Aplicada al pedido" }[st] || "Abierta para el cliente";
    return `<section class="v3-roster"><h3>${svg("users2", 16)} Planilla de talles y nombres <span class="v3-paystatus ${st === "applied" ? "validated" : st === "submitted" ? "pending" : "voided"}">${label}</span></h3>
      ${r.length ? `<p>${r.length} renglón(es) · ${rosterTotals(p)} prenda(s)${p.rosterAt ? ` · enviada ${stamp(p.rosterAt)}` : ""}</p>
        <div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Persona</th><th>Prenda</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Texto a bordar</th></tr></thead><tbody>${r.slice(0, 14).map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(product((p.designs.find((d) => d.id === x.designId) || {}).productId).name || "")}</td><td>${esc(x.color)}</td><td>${esc(x.size)}</td><td>${x.qty}</td><td>${esc(x.text)}</td></tr>`).join("")}${r.length > 14 ? `<tr><td colspan="6">… y ${r.length - 14} más</td></tr>` : ""}</tbody></table></div>
        <p class="v2-help-text">Resumen: ${Object.entries(agg).map(([k, v]) => { const [d, c, s] = k.split("|"); return `${v} ${esc(c)} ${esc(s)}`; }).join(" · ")}</p>`
        : `<p>El cliente todavía no la envió. Se completa desde su link${UF3.trackLink(p) ? "" : " (creá primero el link)"}.</p>`}
      <div class="button-row">${manage && st === "submitted" ? `<button type="button" class="primary-button" data-v3-roster="apply:${esc(p.id)}">Aplicar a las prendas</button>` : ""}${manage && st === "applied" ? `<button type="button" data-v3-roster="reopen:${esc(p.id)}">Reabrir para que la corrija</button>` : ""}${r.length ? `<button type="button" data-v3-roster="print:${esc(p.id)}">Imprimir planilla</button><button type="button" data-v3-roster="csv:${esc(p.id)}">CSV</button>` : ""}${manage ? `<button type="button" class="danger" data-v3-roster="disable:${esc(p.id)}">Deshabilitar</button>` : ""}</div></section>`;
  }
  async function rosterAction(op, id) {
    const p = proposal(id); if (!p) return;
    if (op === "enable") {
      if (!p.publicToken) { try { await api("tracking_link", { proposalId: id, op: "create" }); } catch (e) { toast(e.message); return; } }
      const q_ = proposal(id); q_.rosterEnabled = true; q_.rosterStatus = q_.rosterStatus || "open"; proposalEvent(q_, "Planilla de talles habilitada", "El cliente puede completarla desde su link");
      try { await save("Planilla habilitada. Mandale el link al cliente."); } catch (e) { toast(e.message); }
      return refreshDetail(id);
    }
    if (op === "disable") { p.rosterEnabled = false; try { await save("Planilla deshabilitada."); } catch (e) { toast(e.message); } return refreshDetail(id); }
    if (op === "reopen") { p.rosterStatus = "open"; proposalEvent(p, "Planilla reabierta", "El cliente puede corregirla"); try { await save("Planilla reabierta."); } catch (e) { toast(e.message); } return refreshDetail(id); }
    if (op === "csv") return csv(`planilla-${p.publicId}.csv`, [["Persona", "Prenda", "Color", "Talle", "Cantidad", "Texto a bordar"], ...(p.roster || []).map((x) => [x.name, product((p.designs.find((d) => d.id === x.designId) || {}).productId).name, x.color, x.size, x.qty, x.text])]);
    if (op === "print") {
      const c = client(p.clientId);
      const groups = p.designs.map((d) => ({ d, rows: (p.roster || []).filter((x) => x.designId === d.id) })).filter((g) => g.rows.length);
      return openPrintable(`${printableHead(`Planilla ${p.publicId}`, `@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#2b241f}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b77a2b;padding-bottom:4mm}header img{width:56mm}header div{text-align:right}h1{margin:0;font-size:18px}h2{font-size:14px;margin:6mm 0 2mm}table{width:100%;border-collapse:collapse}th{background:#f6f0e4;text-align:left;padding:2mm;font-size:10px;text-transform:uppercase}td{padding:2mm;border-bottom:1px solid #e3d9c6}small{color:#6b5a4a}`)}<header><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>PLANILLA DE PERSONALIZACIÓN</small><h1>${esc(p.publicId)}</h1><small>${esc(c.company || "")} · Entrega ${printDate(p.deliveryDate)}</small></div></header>${groups.map((g) => `<h2>${esc(product(g.d.productId).name)} — ${g.rows.reduce((s, x) => s + NUM(x.qty), 0)} unidades</h2><table><tr><th>#</th><th>Persona</th><th>Color</th><th>Talle</th><th>Cant.</th><th>Texto a bordar / estampar</th><th>✓</th></tr>${g.rows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.color)}</td><td>${esc(x.size)}</td><td>${x.qty}</td><td><b>${esc(x.text)}</b></td><td>☐</td></tr>`).join("")}</table>`).join("")}${printableFoot()}`);
    }
    if (op === "apply") {
      if (p.artApproval) { toast("El diseño ya está aprobado. Reabrí la aprobación antes de cambiar las cantidades."); return; }
      const lines = [];
      p.designs.forEach((d) => {
        const rows = (p.roster || []).filter((x) => x.designId === d.id); if (!rows.length) return;
        const map = new Map(); rows.forEach((x) => { const k = `${x.color}|${x.size}`; map.set(k, (map.get(k) || 0) + NUM(x.qty)); });
        const prod = product(d.productId), total = [...map.values()].reduce((s, v) => s + v, 0);
        lines.push(`${prod.name}: ${d.qty} → ${total} u.`);
      });
      if (!lines.length) { toast("La planilla no tiene renglones para las prendas del pedido."); return; }
      if (!confirm(`Se van a reemplazar las cantidades por talle con las de la planilla:\n\n${lines.join("\n")}\n\nTambién se actualiza el precio unitario según el tramo. ¿Aplicar?`)) return;
      p.designs.forEach((d) => {
        const rows = (p.roster || []).filter((x) => x.designId === d.id); if (!rows.length) return;
        const map = new Map(); rows.forEach((x) => { const k = `${x.color}|${x.size}`; map.set(k, (map.get(k) || 0) + NUM(x.qty)); });
        const prod = product(d.productId);
        d.colorSizeQuantities = [...map.entries()].map(([k, qty]) => { const [color, size] = k.split("|"); return { color, size, qty, hex: (colorsOf(prod).find((c) => c.name === color) || {}).hex || "#d8d1c7" }; });
        syncVariantTotals(d);
        d.qty = d.colorSizeQuantities.reduce((s, r) => s + r.qty, 0);
        d.unitPrice = tierPrice(prod, d.qty) || d.unitPrice;
        d.rosterNames = rows.map((x) => ({ name: x.name, size: x.size, text: x.text }));
      });
      markDesignChanged(p); p.rosterStatus = "applied";
      proposalEvent(p, "Planilla aplicada a las prendas", lines.join(" · "));
      try { await save("Planilla aplicada: cantidades y precios actualizados."); } catch (e) { toast(e.message); }
      return refreshDetail(id);
    }
  }

  /* ================= fotos del trabajo terminado ================= */
  const photoBlob = (file) => new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
  function photosSection(p) {
    const list = Array.isArray(p.photos) ? p.photos : [];
    const manage = can("proposals.manage") || can("tasks.manage");
    if (!manage && !list.length) return "";
    return `<section class="v3-photos"><h3>${svg("camera", 16)} Fotos del trabajo terminado</h3><p>Subí fotos de las prendas listas. Las que marques «Mostrar al cliente» aparecen en su link.</p>
      <div class="v3-photogrid">${list.map((ph) => `<figure><img src="photos.php?p=${encodeURIComponent(p.id)}&id=${encodeURIComponent(ph.id)}" alt="${esc(ph.caption || "Foto")}" loading="lazy"><figcaption>${esc(ph.caption || "")}<small>${stamp(ph.at)} · ${esc(ph.by || "")}</small>${manage ? `<label class="check-row"><input type="checkbox" data-v3-photoshare="${esc(p.id)}:${esc(ph.id)}" ${ph.shared ? "checked" : ""}> Mostrar al cliente</label><button type="button" class="danger" data-v3-photodel="${esc(p.id)}:${esc(ph.id)}">Borrar</button>` : ph.shared ? `<small>Visible para el cliente</small>` : ""}</figcaption></figure>`).join("")}</div>
      ${manage ? `<label class="v2-upload" style="margin-top:10px">${svg("camera", 15)} Subir fotos<input type="file" accept="image/*" multiple capture="environment" data-v3-photoup="${esc(p.id)}"></label>` : ""}</section>`;
  }
  async function uploadPhotos(id, files) {
    let ok = 0;
    toast(`Subiendo ${files.length} foto(s)…`);
    for (const f of files) {
      try {
        const blob = await photoBlob(f), fd = new FormData();
        fd.append("proposalId", id); fd.append("caption", ""); fd.append("file", blob, "foto.jpg");
        const res = await fetch("photos.php?action=upload", { method: "POST", headers: { "X-CSRF-Token": window.UNIFORMA_BOOT.csrf }, body: fd, credentials: "same-origin" });
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || "No se pudo subir");
        ok++;
      } catch (e) { toast(e.message); }
    }
    if (ok) { toast(`${ok} foto(s) subida(s).`); await reloadFromServer(); refreshDetail(id); }
  }
  function surveySection(p) {
    if (!p.survey) return "";
    const r = NUM(p.survey.rating);
    return `<section class="v3-linked"><h3>${svg("check", 16)} Encuesta del cliente</h3><p><span class="v3-stars">${"★".repeat(r)}${"☆".repeat(5 - r)}</span> ${r}/5 · ${stamp(p.survey.at)}${p.survey.comment ? `<br>«${esc(p.survey.comment)}»` : ""}</p></section>`;
  }
  const baseDetail = proposalDetail;
  proposalDetail = function (item) {
    const html = baseDetail(item);
    if (!item) return html;
    const extra = surveySection(item) + rosterSection(item) + photosSection(item) + (item.repeatOf ? `<section class="v3-linked"><p>${svg("repeat", 15)} Recompra de <button type="button" class="v3-linkbtn" data-open-proposal="${esc(item.repeatOf)}">${esc((state.proposals.find((x) => x.id === item.repeatOf) || {}).publicId || "otro pedido")}</button></p></section>` : "");
    return html.replace('<section class="v3-link">', `${extra}<section class="v3-link">`);
  };

  /* ================= avisos en «Mi día» ================= */
  UF3.agendaHooks.push((items, push) => {
    state.proposals.filter((p) => p.rosterStatus === "submitted").forEach((p) => push({ group: "seguimiento", level: "warn", tag: "Planilla", title: `${p.publicId} · ${client(p.clientId).company || ""}`, sub: `El cliente envió su planilla de talles (${rosterTotals(p)} prendas)`, acts: [{ label: "Revisar y aplicar", main: true, attr: `data-open-proposal="${esc(p.id)}"` }] }));
    if (can("proposals.view")) {
      const snooze = (currentUser.prefs && currentUser.prefs.reorderSnooze) || {};
      const cutoff = addDays(-180), open = (p) => !["Rechazada", "Entregada"].includes(p.status);
      const list = [];
      state.clients.forEach((c) => {
        const mine = state.proposals.filter((p) => p.clientId === c.id);
        const delivered = mine.filter((p) => p.status === "Entregada").sort((a, b) => String(b.updatedDate).localeCompare(String(a.updatedDate)));
        if (!delivered.length || mine.some(open) || mine.some((p) => String(p.createdDate) > cutoff) || delivered[0].updatedDate > cutoff || (snooze[c.id] && snooze[c.id] > today())) return;
        list.push({ c, last: delivered[0] });
      });
      list.slice(0, 3).forEach(({ c, last }) => push({ group: "seguimiento", level: "info", tag: "Recompra", title: `${c.company}`, sub: `Último pedido ${last.publicId} entregado el ${dateLabel(last.updatedDate)}. Buen momento para escribirle.`, acts: [{ label: "Escribirle", main: true, attr: `data-v3-reorder="${esc(c.id)}"` }, { label: "Postergar 60 días", attr: `data-v3-snooze="${esc(c.id)}"` }] }));
    }
    if (currentUser.role === "admin" && !(currentUser.totp && currentUser.totp.enabled)) push({ group: "otros", level: "info", tag: "Seguridad", title: "Activá la verificación en dos pasos", sub: "Protege tu usuario de administrador aunque alguien conozca tu contraseña.", acts: [{ label: "Activar", main: true, attr: "data-v3-account" }] });
  });

  /* ================= Configuración: avisos automáticos, equipo, respaldo ================= */
  const AUTO_STATES = ["Aprobada", "En producción", "Lista", "Entregada"];
  const DEFAULT_AUTO = {
    "Aprobada": { subject: "Recibimos tu aprobación · {pedido}", body: "Hola {cliente},\n\n¡Gracias! Registramos la aprobación de tu pedido {pedido}. Ya lo pasamos a producción y te avisamos cuando esté listo.\n\nPodés ver el estado en cualquier momento acá:\n{link}" },
    "En producción": { subject: "Tu pedido {pedido} está en producción", body: "Hola {cliente},\n\nTu pedido {pedido} ya está en producción. La fecha estimada de entrega es el {entrega}.\n\nSeguimiento: {link}" },
    "Lista": { subject: "Tu pedido {pedido} está listo", body: "Hola {cliente},\n\nTu pedido {pedido} está listo para retirar o coordinar el envío.{saldoTxt}\n\nDetalle: {link}" },
    "Entregada": { subject: "Gracias por elegirnos · {pedido}", body: "Hola {cliente},\n\nGracias por tu compra. Si querés, contanos cómo te fue con una encuesta de 10 segundos y, cuando necesites repetir el pedido, lo hacés desde el mismo link:\n{link}" },
  };
  const baseSettings = renderSettings;
  renderSettings = function () {
    baseSettings();
    const am = state.settings.autoMail || {}, st = am.statuses || {}, tp = am.templates || {};
    $("view-configuracion").insertAdjacentHTML("beforeend", `<section class="surface report-block" id="v3AutoMail"><div class="section-row"><div><h2>Avisos automáticos al cliente por mail</h2><p>Cuando una propuesta pasa a uno de estos estados, el cliente recibe un mail con el link para seguir su pedido. Se envía una sola vez por estado y solo si el cliente tiene email. Variables: {cliente} {pedido} {total} {saldo} {entrega} {link} {saldoTxt}.</p></div></div>
      <label class="check-row"><input type="checkbox" id="amOn" ${am.enabled ? "checked" : ""}> Enviar avisos automáticos</label>
      ${AUTO_STATES.map((s) => { const t = tp[s] || DEFAULT_AUTO[s]; return `<details class="v3-tpl" ${st[s] ? "open" : ""}><summary><label class="check-row" style="display:inline-flex"><input type="checkbox" data-v3-amst="${esc(s)}" ${st[s] ? "checked" : ""}> <b>${esc(s)}</b></label></summary><label>Asunto<input data-v3-amsub="${esc(s)}" value="${esc(t.subject)}"></label><label>Mensaje<textarea rows="5" data-v3-ambody="${esc(s)}">${esc(t.body)}</textarea></label></details>`; }).join("")}
      <div class="button-row" style="margin-top:12px"><button class="primary-button" type="button" data-v3-am-save>Guardar avisos</button><input type="email" id="amTest" placeholder="tu@mail.com" style="max-width:240px"><button type="button" data-v3-am-test>Enviar correo de prueba</button></div>
      <p class="v2-help-text">El envío depende de la configuración del servidor (<code>mail</code> en <code>config.local.php</code>: apagado, prueba o real). Si dice «apagado», los avisos no salen.</p></section>
      <section class="surface report-block" id="v3Team"><div class="section-row"><div><h2>Equipo, comisiones y seguridad</h2></div></div>
      <label class="check-row"><input type="checkbox" id="tmSep" ${state.settings.separateDuties ? "checked" : ""}> <span><b>Separar funciones:</b> quien registra un pago no puede validarlo (lo valida otra persona)</span></label>
      <label style="max-width:300px;margin-top:10px">Comisión de vendedores (% del cobrado validado)<input type="number" id="tmComm" min="0" max="100" step="0.1" value="${NUM(state.settings.commissionRate)}"></label>
      <div class="button-row" style="margin-top:12px"><button class="primary-button" type="button" data-v3-team-save>Guardar</button><button type="button" data-v3-account>Mi cuenta: contraseña y verificación en dos pasos</button></div></section>
      <section class="surface report-block"><div class="section-row"><div><h2>Respaldos</h2><p>El panel guarda <b>una copia comprimida por día</b> (se conservan 14) en el servidor. Descargá una copia completa a tu computadora antes de cambios grandes o una vez por semana: incluye datos, versiones de diseño aprobadas, proyectos y fotos. <b>Una copia fuera del servidor es la que te salva si el hosting falla.</b></p></div></div><div class="button-row"><a class="v2-button-link" href="backup.php" style="min-height:40px;padding:0 16px">${svg("upload", 15)}&nbsp;Descargar respaldo completo (ZIP)</a></div></section>`);
  };
  async function saveAutoMail() {
    const statuses = {}, templates = {};
    AUTO_STATES.forEach((s) => { statuses[s] = !!q(`[data-v3-amst="${s}"]`)?.checked; templates[s] = { subject: q(`[data-v3-amsub="${s}"]`).value.trim() || DEFAULT_AUTO[s].subject, body: q(`[data-v3-ambody="${s}"]`).value.trim() || DEFAULT_AUTO[s].body }; });
    state.settings.autoMail = { enabled: !!$("amOn").checked, statuses, templates };
    audit("Configuración actualizada", "Avisos automáticos por mail");
    try { await save("Avisos guardados."); } catch (e) { toast(e.message); }
  }

  /* ================= Mi cuenta: contraseña y 2 pasos ================= */
  function loadQr() {
    return new Promise((resolve) => { if (window.qrcode) return resolve(); const s = document.createElement("script"); s.src = "studio/vendor/qrcode.js"; s.onload = () => resolve(); s.onerror = () => resolve(); document.head.appendChild(s); });
  }
  function accountModal() {
    const on = !!(currentUser.totp && currentUser.totp.enabled);
    modal(`<div class="v2-form"><h2>Mi cuenta</h2><p><b>${esc(currentUser.name)}</b> · usuario ${esc(currentUser.username)} · ${esc(roles[currentUser.role]?.label || currentUser.role)}</p>
      <h3>Cambiar contraseña</h3><div class="v2-form-grid"><label>Contraseña actual<input type="password" id="acCur" autocomplete="current-password"></label><label>Nueva (mínimo 10 caracteres)<input type="password" id="acNew" autocomplete="new-password"></label></div><div class="button-row"><button type="button" data-v3-ac-pass>Cambiar contraseña</button></div>
      <h3 style="margin-top:20px">Verificación en dos pasos ${on ? '<span class="v3-paystatus validated">Activada</span>' : '<span class="v3-paystatus voided">Desactivada</span>'}</h3>
      ${on ? `<p>Al ingresar se pide, además de la contraseña, un código de tu celular. Para desactivarla confirmá con tu contraseña y un código.</p><div class="v2-form-grid"><label>Contraseña<input type="password" id="acDisPass"></label><label>Código actual o de recuperación<input id="acDisCode" inputmode="numeric"></label></div><div class="button-row"><button type="button" class="danger" data-v3-ac-dis>Desactivar</button></div>`
        : `<p>Protege tu usuario aunque alguien conozca tu contraseña. Necesitás una app como Google Authenticator, Microsoft Authenticator o Authy.</p><div id="acTotp"><button type="button" class="primary-button" data-v3-ac-begin>Activar verificación en dos pasos</button></div>`}
      <div class="button-row" style="margin-top:16px"><button type="button" data-close-modal>Cerrar</button></div></div>`);
  }
  UF3.openAccount = accountModal;

  /* ================= barra inferior móvil ================= */
  function buildBottomBar() {
    if (q(".v3-bottombar")) return;
    const items = [["dashboard", "Mi día", "home", "dashboard.view"], ["propuestas", "Propuestas", "file", "proposals.view"], ["@scan", "Escanear", "qr", "tasks.view"], ["tareas", "Producción", "factory", "tasks.view"], ["@more", "Más", "more", null]].filter(([, , , perm]) => !perm || can(perm));
    document.body.insertAdjacentHTML("beforeend", `<nav class="v3-bottombar" aria-label="Navegación rápida">${items.map(([k, l, i]) => k === "@scan" ? `<button type="button" class="scan" data-v3-scan aria-label="${l}">${ico(i, 22)}<span>${l}</span></button>` : k === "@more" ? `<button type="button" data-v3-more aria-label="Más opciones">${ico(i, 22)}<span>${l}</span></button>` : `<button type="button" data-go="${k}" data-bb="${k}">${ico(i, 22)}<span>${l}</span></button>`).join("")}</nav>`);
  }
  const markBottom = () => qa(".v3-bottombar [data-bb]").forEach((b) => b.classList.toggle("on", b.dataset.bb === currentView));

  /* ================= eventos ================= */
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const ro = t.closest("[data-v3-roster]"); if (ro) { const [op, id] = ro.dataset.v3Roster.split(":"); return rosterAction(op, id); }
    const pdel = t.closest("[data-v3-photodel]");
    if (pdel) { if (!confirm("¿Borrar esta foto?")) return; const [pid, phid] = pdel.dataset.v3Photodel.split(":"); try { await fetch("photos.php?action=delete", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window.UNIFORMA_BOOT.csrf }, body: JSON.stringify({ proposalId: pid, photoId: phid }), credentials: "same-origin" }); await reloadFromServer(); refreshDetail(pid); } catch (er) { toast(er.message); } return; }
    if (t.closest("[data-v3-am-save]")) return saveAutoMail();
    if (t.closest("[data-v3-am-test]")) { const em = $("amTest").value.trim(); if (!em) { toast("Escribí un email para la prueba."); return; } try { const r = await api("mail_test", { email: em }); toast(r.mode === "test" ? `Prueba enviada a ${r.sentTo} (modo prueba).` : "Correo de prueba enviado."); } catch (er) { toast(er.message); } return; }
    if (t.closest("[data-v3-team-save]")) { state.settings.separateDuties = !!$("tmSep").checked; state.settings.commissionRate = Math.min(100, Math.max(0, NUM($("tmComm").value))); audit("Configuración actualizada", "Equipo y comisiones"); try { await save("Guardado."); } catch (er) { toast(er.message); } return; }
    if (t.closest("[data-v3-account]")) return accountModal();
    if (t.closest(".profile") && !t.closest("button")) return accountModal();
    if (t.closest("[data-v3-more]")) { q(".sidebar")?.classList.toggle("open"); return; }
    if (t.closest("[data-v3-ac-pass]")) { try { await api("change_password", { current: $("acCur").value, new: $("acNew").value }); toast("Contraseña cambiada."); closeModal(); } catch (er) { toast(er.message); } return; }
    if (t.closest("[data-v3-ac-begin]")) {
      try {
        const r = await api("totp_begin"); await loadQr();
        let qr = ""; if (window.qrcode) { const o = window.qrcode(0, "M"); o.addData(r.uri); o.make(); qr = o.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
        $("acTotp").innerHTML = `<ol class="m-steps" style="list-style:none;padding:0"><li>1. Escaneá este código con tu app (o escribí la clave a mano).</li></ol><div class="v3-qrbox">${qr}</div><p class="v2-help-text">Clave: <code>${esc(r.secret)}</code></p><label>2. Escribí el código de 6 números que muestra la app<input id="acCode" inputmode="numeric" maxlength="8" autocomplete="one-time-code"></label><div class="button-row"><button type="button" class="primary-button" data-v3-ac-enable>Confirmar y activar</button></div>`;
      } catch (er) { toast(er.message); }
      return;
    }
    if (t.closest("[data-v3-ac-enable]")) {
      try {
        const r = await api("totp_enable", { code: $("acCode").value });
        $("v2ModalBody").innerHTML = `<div class="v2-form"><h2>Verificación activada</h2><p><b>Guardá estos códigos de recuperación.</b> Cada uno sirve una sola vez si perdés el celular. No se vuelven a mostrar.</p><div class="v3-recovery">${(r.recoveryCodes || []).map((c) => `<code>${esc(c)}</code>`).join("")}</div><div class="button-row"><button type="button" data-v3-ac-copy="${esc((r.recoveryCodes || []).join("\n"))}">Copiar</button><button class="primary-button" type="button" data-close-modal>Ya los guardé</button></div></div>`;
        renderView();
      } catch (er) { toast(er.message); }
      return;
    }
    const cp = t.closest("[data-v3-ac-copy]"); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.v3AcCopy); toast("Códigos copiados."); } catch (er) { toast("No se pudo copiar; anotalos a mano."); } return; }
    if (t.closest("[data-v3-ac-dis]")) { try { await api("totp_disable", { password: $("acDisPass").value, code: $("acDisCode").value }); toast("Verificación desactivada."); closeModal(); renderView(); } catch (er) { toast(er.message); } return; }
    const ro2 = t.closest("[data-v3-reorder]");
    if (ro2) {
      const c = client(ro2.dataset.v3Reorder), last = state.proposals.filter((p) => p.clientId === c.id && p.status === "Entregada").sort((a, b) => String(b.updatedDate).localeCompare(String(a.updatedDate)))[0];
      const phone = String(c.phone || state.settings.whatsapp || "").replace(/\D/g, "");
      if (!last || !phone) { toast("Este cliente no tiene WhatsApp cargado."); return; }
      if (!last.publicToken && can("proposals.manage")) { try { await api("tracking_link", { proposalId: last.id, op: "create" }); } catch (er) { toast(er.message); } }
      const tpl = UF3.templates().find((x) => x.id === "reorder");
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(UF3.fillTemplate(tpl.text, proposal(last.id) || last))}`, "_blank", "noopener");
      if (can("proposals.manage")) { proposalEvent(proposal(last.id) || last, "Mensaje de recompra por WhatsApp", c.company); const snooze = { ...((currentUser.prefs && currentUser.prefs.reorderSnooze) || {}), [c.id]: addDays(60) }; try { await save(); await api("save_prefs", { prefs: { ...(currentUser.prefs || {}), reorderSnooze: snooze } }); renderView(); } catch (er) { toast(er.message); } }
      return;
    }
    const sn = t.closest("[data-v3-snooze]"); if (sn) { const snooze = { ...((currentUser.prefs && currentUser.prefs.reorderSnooze) || {}), [sn.dataset.v3Snooze]: addDays(60) }; try { await api("save_prefs", { prefs: { ...(currentUser.prefs || {}), reorderSnooze: snooze } }); toast("Postergado 60 días."); renderView(); } catch (er) { toast(er.message); } return; }
  });
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.matches && t.matches("[data-v3-photoup]")) { const files = [...t.files]; const id = t.dataset.v3Photoup; t.value = ""; return uploadPhotos(id, files); }
    if (t.matches && t.matches("[data-v3-photoshare]")) { const [pid, phid] = t.dataset.v3Photoshare.split(":"); const ph = (proposal(pid).photos || []).find((x) => x.id === phid); if (ph) { ph.shared = t.checked; try { await save(t.checked ? "La foto ahora la ve el cliente." : "La foto quedó oculta para el cliente."); } catch (er) { toast(er.message); } } }
  });

  /* ================= enganches y arranque ================= */
  const baseRenderView = renderView;
  renderView = function () { baseRenderView(); buildBottomBar(); markBottom(); };
  if (state && state.proposals && q(".topbar")) { renderView(); }

  // App instalable: el service worker solo cachea archivos estáticos (nunca datos ni páginas con sesión).
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
