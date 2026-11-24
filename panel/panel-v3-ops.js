/* UNIFORMA ERP — operaciones: link del cliente, stock, calendario, caja, escáner QR, garantías, rentabilidad,
   recibos y remitos, vistas guardadas, tareas repetitivas, plantillas editables e importación CSV.
   Se carga después de panel-v3.js y panel-v3-admin.js. */
(() => {
  "use strict";
  const UF3 = window.UF3;
  if (!UF3) return;
  const { svg, ico, payStatus } = UF3;
  const NUM = (n) => Number(n || 0);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => new Date(`${s}T12:00:00`);
  const stamp = (iso) => (iso ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const downloadCsv = (name, lines) => {
    const csv = "﻿" + lines.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const BILLED = ["Aprobada", "En producción", "Lista", "Entregada"];
  const OPEN = ["Aprobada", "En producción", "Lista"];

  /* ================= seguimiento / link del cliente ================= */
  let tracking = {};
  async function refreshTracking() {
    try { const r = await fetch("api.php", { credentials: "same-origin" }); const d = await r.json(); if (d.ok && d.tracking) tracking = d.tracking; } catch (e) { /* sin red */ }
  }
  const baseApi = api;
  api = async function (action, payload) {
    const data = await baseApi(action, payload);
    if (data && data.tracking) tracking = data.tracking;
    return data;
  };
  refreshTracking();

  function linkSection(p) {
    const url = UF3.trackLink(p), t = tracking[p.id] || {};
    const manage = can("proposals.manage");
    const a = p.artApproval;
    let body;
    if (!url) {
      body = `<p>El cliente puede ver el estado de su pedido, las prendas con sus logos y <b>aprobar el diseño</b> desde un link, sin entrar al ERP.</p>${manage ? `<button type="button" class="primary-button" data-v3-link="create:${esc(p.id)}">Crear link para el cliente</button>` : ""}`;
    } else {
      body = `<div class="v3-linkrow"><input type="text" readonly value="${esc(url)}" id="v3LinkInput-${esc(p.id)}" aria-label="Link del cliente"><button type="button" data-v3-link="copy:${esc(p.id)}">Copiar</button><a class="v2-button-link" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a></div>
        <p class="v3-linkmeta">${t.views ? `Visto <b>${t.views}</b> vez/veces · última ${stamp(t.lastViewedAt)}` : "Todavía no lo abrió"}${a && a.via === "link" ? ` · <b>Aprobado por el cliente desde el link</b> (${esc(a.approvedBy)})` : ""}</p>
        ${manage ? `<div class="button-row"><button type="button" data-v3-link="regenerate:${esc(p.id)}">Renovar link</button><button type="button" class="danger" data-v3-link="revoke:${esc(p.id)}">Desactivar</button></div>` : ""}`;
    }
    const change = p.changeRequest && p.changeRequest.comment ? `<div class="v3-change"><b>El cliente pidió cambios</b> (${stamp(p.changeRequest.at)}${p.changeRequest.by ? " · " + esc(p.changeRequest.by) : ""}): «${esc(p.changeRequest.comment)}»${manage ? ` <button type="button" data-v3-clear-change="${esc(p.id)}">Marcar atendido</button>` : ""}</div>` : "";
    return `<section class="v3-link"><h3>${svg("msg", 16)} Link para el cliente</h3>${change}${body}</section>`;
  }
  function linkedSection(p) {
    const parent = p.parentId ? state.proposals.find((x) => x.id === p.parentId) : null;
    const kids = state.proposals.filter((x) => x.parentId === p.id);
    if (!parent && !kids.length) return "";
    return `<section class="v3-linked"><h3>${svg("repeat", 16)} Pedidos vinculados</h3>${parent ? `<p>${esc(p.kind || "Vinculado")} de <button type="button" class="v3-linkbtn" data-open-proposal="${esc(parent.id)}">${esc(parent.publicId)}</button></p>` : ""}${kids.map((k) => `<p>${esc(k.kind || "Vinculado")}: <button type="button" class="v3-linkbtn" data-open-proposal="${esc(k.id)}">${esc(k.publicId)}</button> · ${esc(k.status)}</p>`).join("")}</section>`;
  }

  const baseDetail = proposalDetail;
  proposalDetail = function (item) {
    let html = baseDetail(item);
    if (!item) return html;
    const extra = `<a class="v2-button-link" href="labels.php?p=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">${svg("qr", 15)} Etiquetas QR</a>`
      + (["Lista", "Entregada"].includes(item.status) ? `<button data-v3-remito="${esc(item.id)}" type="button">Remito</button>` : "")
      + (can("proposals.manage") && (item.designs || []).length && BILLED.includes(item.status) ? `<button data-v3-warranty="${esc(item.id)}" type="button">${svg("repeat", 15)} Rehacer / garantía</button>` : "");
    html = html.replace(/(<div class="button-row v2-actions">[\s\S]*?)(<\/div>)/, `$1${extra}$2`);
    return html.replace('<section class="v3-quickmsg">', `${linkSection(item)}${linkedSection(item)}<section class="v3-quickmsg">`);
  };

  /* ================= pedidos vinculados: rehacer / garantía ================= */
  function warrantyModal(id) {
    const p = proposal(id); if (!p) return;
    modal(`<div class="v2-form"><h2>Rehacer / garantía</h2><p>Crea un pedido nuevo <b>vinculado a ${esc(p.publicId)}</b>, sin cargo (descuento del 100%), ya aprobado y listo para producir. Sirve para llevar el control de lo que se rehace sin tocar el pedido original.</p>
      <label>Tipo<select id="v3WarKind"><option>Garantía</option><option>Rehacer</option><option>Cambio</option></select></label>
      <fieldset class="v2-checklist"><legend>Prendas a rehacer</legend>${p.designs.map((d, i) => `<label><input type="checkbox" data-v3-wardesign="${esc(d.id)}" checked> ${esc(product(d.productId).name)} · ${d.qty} u.</label>`).join("")}</fieldset>
      <label>Motivo (obligatorio)<textarea id="v3WarReason" rows="3" maxlength="300" placeholder="Ej.: bordado corrido en 3 prendas"></textarea></label>
      <div class="button-row"><button class="primary-button" type="button" data-v3-warranty-go="${esc(id)}">Crear pedido vinculado</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  async function createWarranty(id) {
    const parent = proposal(id), kind = $("v3WarKind").value, reason = $("v3WarReason").value.trim();
    const ids = qa("[data-v3-wardesign]:checked").map((c) => c.dataset.v3Wardesign);
    if (reason.length < 3) { toast("Escribí el motivo."); return; }
    if (!ids.length) { toast("Elegí al menos una prenda."); return; }
    const n = state.proposals.filter((x) => x.parentId === parent.id).length + 1;
    const child = clone(parent);
    Object.assign(child, {
      id: uid("proposal"), publicId: `${parent.publicId}-${kind[0]}${n}`, parentId: parent.id, kind, title: `${kind} de ${parent.publicId}`, status: "Aprobada",
      createdDate: today(), updatedDate: today(), deliveryDate: addDays(state.settings.productionDays || 14), validUntil: addDays(state.settings.validityDays || 7),
      payments: [], history: [], discount: 100, surcharge: 0, shipping: 0, shippingCost: 0, taxRate: 0, notes: "", internalNotes: `${kind}: ${reason}`, ownerId: currentUser.id,
      approvalHistory: [], changeRequest: null, paymentTerms: "Sin cargo",
    });
    delete child.publicToken; delete child.stockConsumed;
    child.designs = parent.designs.filter((d) => ids.includes(d.id)).map((d) => ({ ...clone(d), id: uid("design"), production: {} }));
    state.proposals.unshift(child);
    proposalEvent(child, "Pedido creado", `${kind} de ${parent.publicId}: ${reason}`);
    proposalEvent(parent, `${kind} creada`, `${child.publicId}: ${reason}`);
    state.activeProposalId = child.id;
    try { await save(`${kind} creada: ${child.publicId}`); closeModal(); go("propuestas"); }
    catch (e) { state.proposals = state.proposals.filter((x) => x.id !== child.id); toast(e.message); }
  }

  /* ================= impresos: recibo y remito ================= */
  const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const HUND = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  function words(n) {
    n = Math.floor(n);
    if (n === 0) return "cero";
    if (n === 100) return "cien";
    if (n < 30) return UNITS[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " y " + UNITS[n % 10] : "");
    if (n < 1000) return HUND[Math.floor(n / 100)] + (n % 100 ? " " + words(n % 100) : "");
    if (n < 1e6) { const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? "mil" : words(m).replace(/uno$/, "un") + " mil") + (r ? " " + words(r) : ""); }
    const m = Math.floor(n / 1e6), r = n % 1e6;
    return (m === 1 ? "un millón" : words(m).replace(/uno$/, "un") + " millones") + (r ? " " + words(r) : "");
  }
  const docCss = () => `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#2b241f}.doc{max-width:182mm;margin:auto;border:1px solid #cdbfa6;border-radius:3mm;padding:10mm}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b77a2b;padding-bottom:5mm}header img{width:62mm}header div{text-align:right}h1{margin:0;font-size:19px}small{color:#6b5a4a}table{width:100%;border-collapse:collapse;margin:6mm 0}th{background:#f6f0e4;text-align:left;padding:2mm;font-size:10px;text-transform:uppercase}td{padding:2.2mm;border-bottom:1px solid #e3d9c6}.big{font-size:22px;font-weight:700}.box{border:1px solid #cdbfa6;border-radius:2mm;padding:4mm;margin:4mm 0}.sign{display:flex;gap:10mm;margin-top:22mm}.sign div{flex:1;border-top:1px solid #333;padding-top:2mm;font-size:11px}.note{margin-top:8mm;font-size:10px;color:#6b5a4a}`;
  function printReceipt(pid, payid) {
    const p = proposal(pid), x = (p?.payments || []).find((e) => e.id === payid);
    if (!p || !x || payStatus(x) !== "validated") return toast("Solo se emite recibo de pagos validados.");
    const c = client(p.clientId), n = (p.payments || []).filter((e) => payStatus(e) === "validated").sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.registeredAt || "").localeCompare(String(b.registeredAt || ""))).findIndex((e) => e.id === payid) + 1;
    const sum = totals(p);
    openPrintable(`${printableHead(`Recibo ${p.publicId}-${n}`, docCss())}<main class="doc"><header><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>RECIBO DE PAGO</small><h1>N.º ${esc(p.publicId)}-R${n}</h1><small>Fecha ${printDate(x.date)}</small></div></header>
      <div class="box"><small>RECIBIMOS DE</small><br><b>${esc(c.company || "")}</b>${c.cuit ? ` · CUIT ${esc(c.cuit)}` : ""}</div>
      <div class="box"><small>LA SUMA DE</small><div class="big">${money(x.amount)}</div><small>${esc(words(NUM(x.amount)))} pesos</small></div>
      <table><tr><th>Concepto</th><th>Medio de pago</th><th>Referencia</th><th>Pedido</th></tr><tr><td>${esc(x.type || "Pago")}</td><td>${esc(x.method || "")}</td><td>${esc(x.reference || "—")}</td><td>${esc(p.publicId)} · ${esc(p.title)}</td></tr></table>
      <table><tr><th>Total del pedido</th><th>Cobrado a la fecha</th><th>Saldo</th></tr><tr><td>${money(sum.total)}</td><td>${money(sum.paid)}</td><td><b>${money(sum.balance)}</b></td></tr></table>
      <p class="note">Pago validado por ${esc(x.validatedBy || "Administración")}. Documento interno de constancia de cobro: <b>no reemplaza a la factura</b>.</p></main>${printableFoot()}`);
  }
  function printRemito(id) {
    const p = proposal(id); if (!p) return;
    const c = client(p.clientId), sum = totals(p);
    const rows = p.designs.flatMap((d) => variantAllocations(d, product(d.productId)).filter((r) => r.qty > 0).map((r) => `<tr><td>${esc(product(d.productId).name)}</td><td>${esc(r.color)}</td><td>${esc(r.size)}</td><td style="text-align:right">${r.qty}</td></tr>`)).join("");
    const total = p.designs.reduce((s, d) => s + variantAllocations(d, product(d.productId)).reduce((a, r) => a + r.qty, 0), 0);
    openPrintable(`${printableHead(`Remito ${p.publicId}`, docCss())}<main class="doc"><header><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>REMITO DE ENTREGA</small><h1>N.º ${esc(p.publicId)}</h1><small>Fecha ${printDate(today())}</small></div></header>
      <div class="box"><small>ENTREGAMOS A</small><br><b>${esc(c.company || "")}</b>${c.contact ? ` · ${esc(c.contact)}` : ""}${c.address ? `<br>${esc(c.address)}` : ""}</div>
      <table><tr><th>Prenda</th><th>Color</th><th>Talle</th><th style="text-align:right">Cantidad</th></tr>${rows}<tr><td colspan="3"><b>Total de unidades</b></td><td style="text-align:right"><b>${total}</b></td></tr></table>
      ${sum.balance > 0 ? `<p class="note"><b>Saldo pendiente al momento de la entrega: ${money(sum.balance)}</b></p>` : ""}
      <div class="sign"><div>Entregó (nombre y firma)</div><div>Recibí conforme (nombre, DNI, fecha)</div></div><p class="note">Documento interno de entrega: no es una factura.</p></main>${printableFoot()}`);
  }

  /* ================= stock ================= */
  let stockQ = "", stockOnlyShort = false, stockTab = "stock";
  function stockRows() {
    const need = new Map();
    stockPlan().forEach((r) => need.set(`${r.productId}|${r.color}|${r.size}`, r.needed));
    const rows = [], seen = new Set();
    state.products.forEach((pr) => {
      (pr.stockVariants || []).forEach((v) => {
        const key = `${pr.id}|${v.color}|${v.size}`; seen.add(key);
        const reserved = need.get(key) || 0;
        rows.push({ pr, color: v.color, size: v.size, stock: NUM(v.qty), reserved, available: NUM(v.qty) - reserved, shortage: Math.max(0, reserved - NUM(v.qty)), configured: true });
      });
    });
    stockPlan().forEach((r) => {
      const key = `${r.productId}|${r.color}|${r.size}`;
      if (!seen.has(key)) rows.push({ pr: state.products.find((x) => x.id === r.productId) || { name: r.productName, id: r.productId }, color: r.color, size: r.size, stock: null, reserved: r.needed, available: null, shortage: null, configured: false });
    });
    return rows.sort((a, b) => (b.shortage ?? -1) - (a.shortage ?? -1) || String(a.pr.name).localeCompare(String(b.pr.name), "es"));
  }
  function renderStock() {
    const rows = stockRows();
    const totalStock = rows.reduce((s, r) => s + (r.stock || 0), 0), reserved = rows.reduce((s, r) => s + r.reserved, 0);
    const shortages = rows.filter((r) => r.shortage > 0), unknown = rows.filter((r) => !r.configured && r.reserved > 0);
    const terms = searchText(stockQ).split(/\s+/).filter(Boolean);
    const shown = rows.filter((r) => (!stockOnlyShort || r.shortage > 0 || !r.configured) && terms.every((t) => searchText(`${r.pr.name} ${r.color} ${r.size}`).includes(t)));
    const moves = state.stockMovements || [];
    $("view-stock").innerHTML = `<div class="page-heading"><div><h1>${ico("box", 25)} Stock</h1><p>Prendas en depósito, reservadas por pedidos abiertos y faltantes por conseguir.</p></div><div class="button-row">${can("catalog.manage") ? `<button class="primary-button" type="button" data-v3-stockentry>Ingreso de mercadería</button>` : ""}<button type="button" data-v3-stock-csv>Descargar CSV</button><button type="button" data-v3-manual="produccion">${svg("book", 16)} Manual</button></div></div>
      <div class="v3-kpis"><div class="v3-kpi"><small>Unidades en stock</small><strong>${totalStock}</strong><em>${rows.filter((r) => r.configured).length} variante(s) cargada(s)</em></div><div class="v3-kpi"><small>Reservadas por pedidos</small><strong>${reserved}</strong><em>Aprobados, en producción o listos</em></div><div class="v3-kpi ${shortages.length ? "bad" : "good"}"><small>Con faltante</small><strong>${shortages.length}</strong><em>${shortages.reduce((s, r) => s + r.shortage, 0)} prenda(s) por conseguir</em></div><div class="v3-kpi ${unknown.length ? "warn" : "good"}"><small>Sin stock cargado</small><strong>${unknown.length}</strong><em>con pedidos que las necesitan</em></div></div>
      <section class="surface"><div class="v3-chips"><button type="button" class="v3-chip ${stockTab === "stock" ? "on" : ""}" data-v3-stocktab="stock">Stock y reservas<b>${shown.length}</b></button><button type="button" class="v3-chip ${stockTab === "moves" ? "on" : ""}" data-v3-stocktab="moves">Movimientos<b>${moves.length}</b></button></div>
      ${stockTab === "stock" ? `<div class="v2-toolbar" style="padding:0;margin-bottom:12px"><input id="v3StockSearch" type="search" placeholder="Buscar producto, color o talle" value="${esc(stockQ)}"><label class="check-row" style="flex:0 0 auto"><input type="checkbox" id="v3StockShort" ${stockOnlyShort ? "checked" : ""}> Solo faltantes</label></div>
        ${shown.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Producto</th><th>Color</th><th>Talle</th><th style="text-align:right">Stock</th><th style="text-align:right">Reservado</th><th style="text-align:right">Disponible</th><th style="text-align:right">Faltante</th><th></th></tr></thead><tbody>${shown.map((r) => `<tr class="${r.shortage > 0 ? "v2-shortage-row" : ""}"><td><strong>${esc(r.pr.name)}</strong></td><td>${esc(r.color)}</td><td>${esc(r.size)}</td><td style="text-align:right">${r.configured ? r.stock : "Sin cargar"}</td><td style="text-align:right">${r.reserved}</td><td style="text-align:right">${r.configured ? `<b class="${r.available < 0 ? "danger" : ""}">${r.available}</b>` : "—"}</td><td style="text-align:right"><b>${r.configured ? r.shortage || "" : "Pendiente"}</b></td><td>${can("catalog.manage") ? `<button type="button" data-stock-product="${esc(r.pr.id)}">Ajustar</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin resultados</b>${rows.length ? "Probá con otra búsqueda." : "Todavía no hay stock ni pedidos aprobados. Cargá un ingreso de mercadería para empezar."}</div>`}`
      : `${moves.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Variante</th><th style="text-align:right">Cantidad</th><th>Motivo</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${moves.slice(0, 200).map((m) => `<tr><td>${stamp(m.at)}</td><td>${esc(m.productName)}</td><td>${esc(m.color)} · ${esc(m.size)}</td><td style="text-align:right"><b class="${m.qty < 0 ? "danger" : ""}" style="${m.qty > 0 ? "color:var(--ok)" : ""}">${m.qty > 0 ? "+" : ""}${m.qty}</b></td><td>${esc(m.reason)}</td><td>${esc(m.note || m.ref || "")}</td><td>${esc(m.userName || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin movimientos</b>Los ingresos, ajustes y entregas quedan registrados acá.</div>`}`}</section>`;
  }
  function stockEntryModal(preselect = "") {
    const first = preselect || state.products[0]?.id || "";
    modal(`<div class="v2-form"><h2>Ingreso de mercadería</h2><p>Cargá las prendas que llegaron. Se <b>suman</b> al stock actual y queda el movimiento registrado.</p><label>Producto<select id="v3EntryProduct">${state.products.map((pr) => `<option value="${esc(pr.id)}" ${pr.id === first ? "selected" : ""}>${esc(pr.name)}</option>`).join("")}</select></label><div id="v3EntryGrid"></div><label>Proveedor / remito (opcional)<input id="v3EntryNote" maxlength="200"></label><div class="button-row"><button class="primary-button" type="button" data-v3-entry-go>Registrar ingreso</button><button type="button" data-close-modal>Cancelar</button></div></div>`, true);
    const draw = () => {
      const pr = state.products.find((x) => x.id === $("v3EntryProduct").value); if (!pr) return;
      const sizes = sizesOf(pr), colors = colorsOf(pr);
      $("v3EntryGrid").innerHTML = `<div class="v2-variant-grid"><table><thead><tr><th>Color</th>${sizes.map((s) => `<th>${esc(s)}</th>`).join("")}</tr></thead><tbody>${colors.map((c) => `<tr><th><span class="v2-color-swatch" style="background:${esc(c.hex)}"></span>${esc(c.name)}</th>${sizes.map((s) => `<td><input type="number" min="0" step="1" value="0" data-v3-entry-cell data-color="${esc(c.name)}" data-size="${esc(s)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    };
    $("v3EntryProduct").addEventListener("change", draw); draw();
  }
  async function submitStockEntry() {
    const rows = qa("[data-v3-entry-cell]").map((i) => ({ color: i.dataset.color, size: i.dataset.size, qty: Math.floor(NUM(i.value)) })).filter((r) => r.qty > 0);
    if (!rows.length) { toast("Cargá al menos una cantidad."); return; }
    try { await api("stock_entry", { productId: $("v3EntryProduct").value, rows, note: $("v3EntryNote").value }); closeModal(); toast(`Ingreso registrado: ${rows.reduce((s, r) => s + r.qty, 0)} prenda(s).`); renderView(); } catch (e) { toast(e.message); }
  }
  const baseSetStatusOps = setProposalStatus;
  setProposalStatus = async function (id, status) {
    const before = proposal(id)?.status;
    await baseSetStatusOps(id, status);
    const p = proposal(id);
    if (p && status === "Aprobada" && before !== "Aprobada" && p.status === "Aprobada") stockAlert(p);
  };
  function stockAlert(p) {
    const mine = new Set(p.designs.flatMap((d) => variantAllocations(d, product(d.productId)).filter((r) => r.qty > 0).map((r) => `${d.productId}|${r.color}|${r.size}`)));
    const short = stockPlan().filter((r) => r.shortage > 0 && mine.has(`${r.productId}|${r.color}|${r.size}`));
    const unknown = stockPlan().filter((r) => r.stock === null && mine.has(`${r.productId}|${r.color}|${r.size}`));
    if (!short.length && !unknown.length) return;
    modal(`<div class="v2-form"><h2>Prendas por conseguir para ${esc(p.publicId)}</h2>${short.length ? `<p>Con el stock actual y los otros pedidos abiertos, <b>faltan</b>:</p><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Prenda</th><th>Color</th><th>Talle</th><th>Faltan</th></tr></thead><tbody>${short.map((r) => `<tr><td>${esc(r.productName)}</td><td>${esc(r.color)}</td><td>${esc(r.size)}</td><td><b>${r.shortage}</b></td></tr>`).join("")}</tbody></table></div>` : ""}${unknown.length ? `<p>${unknown.length} variante(s) de este pedido no tienen stock cargado; no se puede saber si alcanzan.</p>` : ""}<div class="button-row">${short.length && can("tasks.manage") ? `<button class="primary-button" type="button" data-v3-buytask="${esc(p.id)}">Crear tarea «Conseguir prendas»</button>` : ""}<button type="button" data-go="stock">Ver stock</button><button type="button" data-close-modal>Cerrar</button></div></div>`);
  }

  /* ================= calendario de entregas y carga ================= */
  let calMonth = today().slice(0, 7);
  const capacityPerDay = () => Math.max(1, NUM(state.settings.dailyCapacity) || 50);
  const unitsOf = (p) => p.designs.reduce((s, d) => s + variantAllocations(d, product(d.productId)).reduce((a, r) => a + r.qty, 0), 0);
  function weekStart(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function weekLoad(startDate) {
    const s = ymd(startDate), e = ymd(new Date(startDate.getTime() + 6 * 86400000));
    return state.proposals.filter((p) => p.deliveryDate >= s && p.deliveryDate <= e && !["Rechazada", "Entregada", "Borrador"].includes(p.status)).reduce((a, p) => a + unitsOf(p), 0);
  }
  function renderCalendar() {
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1, 12), start = weekStart(first);
    const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(first);
    const cap = capacityPerDay() * 5;
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const ws = new Date(start.getTime() + w * 7 * 86400000);
      if (w >= 4 && ws.getMonth() !== m - 1 && ws > first) break;
      weeks.push(ws);
    }
    const byDay = {};
    state.proposals.filter((p) => p.deliveryDate && p.status !== "Rechazada").forEach((p) => { (byDay[p.deliveryDate] = byDay[p.deliveryDate] || []).push(p); });
    const t = today();
    $("view-calendario").innerHTML = `<div class="page-heading"><div><h1>${ico("calendar", 25)} Calendario de entregas</h1><p>Fechas de entrega y carga del taller por semana (capacidad: ${capacityPerDay()} prendas por día hábil${can("settings.manage") ? " · se cambia en Configuración" : ""}).</p></div><div class="button-row"><button type="button" data-v3-cal="-1">‹</button><b style="min-width:150px;text-align:center">${esc(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1))}</b><button type="button" data-v3-cal="1">›</button><button type="button" data-v3-cal="0">Hoy</button></div></div>
      <div class="v3-promise surface"><b>¿Puedo prometer una fecha?</b><label>Prendas<input type="number" id="v3PromQty" min="1" value="30"></label><label>Fecha<input type="date" id="v3PromDate" value="${addDays(14)}"></label><button type="button" data-v3-promise>Consultar</button><span id="v3PromOut"></span></div>
      <div class="v3-cal">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom", "Carga semana"].map((d) => `<div class="v3-cal-h">${d}</div>`).join("")}${weeks.map((ws) => {
        let cells = "";
        for (let i = 0; i < 7; i++) {
          const d = new Date(ws.getTime() + i * 86400000), key = ymd(d), items = byDay[key] || [];
          cells += `<div class="v3-cal-d ${d.getMonth() !== m - 1 ? "out" : ""} ${key === t ? "today" : ""}"><span class="n">${d.getDate()}</span>${items.slice(0, 4).map((p) => `<button type="button" class="v3-cal-p s-${slug(p.status)} ${p.deliveryDate < t && !["Entregada"].includes(p.status) ? "late" : ""}" data-open-proposal="${esc(p.id)}" title="${esc(p.publicId)} · ${esc(client(p.clientId).company)} · ${p.status}">${esc(p.publicId.replace(/^#?\d{4}-/, "#"))} · ${esc((client(p.clientId).company || "").slice(0, 14))} <b>${unitsOf(p)}u</b></button>`).join("")}${items.length > 4 ? `<small>+${items.length - 4} más</small>` : ""}</div>`;
        }
        const load = weekLoad(ws), pct = Math.min(100, Math.round((load / cap) * 100));
        return cells + `<div class="v3-cal-w"><b>${load}</b><small>/ ${cap}</small><i class="${load > cap ? "bad" : load > cap * 0.8 ? "warn" : "ok"}" style="width:${pct}%"></i></div>`;
      }).join("")}</div>
      <p class="v2-help-text">La carga cuenta las prendas de los pedidos aprobados, en producción o listos según su <b>fecha de entrega</b> (no incluye borradores). Es una guía: ajustá la capacidad real del taller en Configuración.</p>`;
  }
  function promiseCheck() {
    const qty = Math.max(1, NUM($("v3PromQty").value)), d = parseYmd($("v3PromDate").value || addDays(14));
    const ws = weekStart(d), cap = capacityPerDay() * 5, load = weekLoad(ws), free = cap - load;
    let msg = free >= qty ? `<b style="color:var(--ok)">Sí, entra.</b> Esa semana hay ${load} de ${cap} prendas cargadas; quedan ${free} libres.` : `<b style="color:var(--danger)">Se pasa por ${qty - free}.</b> Esa semana ya tiene ${load} de ${cap}.`;
    if (free < qty) {
      for (let i = 1; i <= 10; i++) {
        const w = new Date(ws.getTime() + i * 7 * 86400000);
        if (cap - weekLoad(w) >= qty) { msg += ` La primera semana con lugar es la del <b>${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(w)}</b>.`; break; }
      }
    }
    $("v3PromOut").innerHTML = msg;
  }

  /* ================= caja diaria ================= */
  let cashDate = today();
  function expectedFor(date) {
    const by = {};
    state.proposals.forEach((p) => (p.payments || []).filter((x) => payStatus(x) === "validated" && x.date === date).forEach((x) => { by[x.method || "Otro"] = (by[x.method || "Otro"] || 0) + NUM(x.amount); }));
    return by;
  }
  function renderCash() {
    const canV = can("payments.validate");
    const exp = expectedFor(cashDate), methods = [...new Set([...PAYMENT_METHODS, ...Object.keys(exp)])];
    const closings = (state.cashClosings || []), current = closings.find((c) => c.date === cashDate);
    const pendDay = state.proposals.flatMap((p) => (p.payments || []).filter((x) => payStatus(x) === "pending" && x.date === cashDate));
    const totalExp = Object.values(exp).reduce((s, v) => s + v, 0);
    $("view-caja").innerHTML = `<div class="page-heading"><div><h1>${ico("cash", 25)} Caja diaria</h1><p>Cobros <b>validados</b> del día por medio de pago, y el cierre contra lo que hay realmente.</p></div><div class="button-row"><label class="v3-datepick">Día<input type="date" id="v3CashDate" value="${cashDate}"></label><button type="button" data-v3-cash-csv>Descargar CSV</button><button type="button" data-v3-manual="administracion">${svg("book", 16)} Manual</button></div></div>
      <div class="v3-kpis"><div class="v3-kpi good"><small>Cobrado validado</small><strong>${money(totalExp)}</strong><em>${new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(parseYmd(cashDate))}</em></div><div class="v3-kpi ${pendDay.length ? "warn" : ""}"><small>Pendiente de validar (de ese día)</small><strong>${money(pendDay.reduce((s, x) => s + NUM(x.amount), 0))}</strong><em>${pendDay.length} pago(s)</em></div><div class="v3-kpi ${current ? "good" : "warn"}"><small>Estado de la caja</small><strong style="font-size:22px">${current ? "Cerrada" : "Abierta"}</strong><em>${current ? `por ${esc(current.closedBy)} · ${stamp(current.closedAt)}` : "Falta el cierre"}</em></div><div class="v3-kpi"><small>Diferencia del cierre</small><strong>${current ? money(Object.values(current.diff || {}).reduce((s, v) => s + NUM(v), 0)) : "—"}</strong><em>contado − esperado</em></div></div>
      <section class="surface"><div class="section-row"><h2>Cierre del día</h2></div><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Medio de pago</th><th style="text-align:right">Esperado (validado)</th><th style="text-align:right">Contado</th><th style="text-align:right">Diferencia</th></tr></thead><tbody>${methods.map((mth) => { const e = exp[mth] || 0, c = current?.counted?.[mth]; return `<tr><td><b>${esc(mth)}</b></td><td style="text-align:right">${money(e)}</td><td style="text-align:right">${canV && !current ? `<input type="number" min="0" step="0.01" data-v3-cash-in="${esc(mth)}" value="${e}" style="width:130px;text-align:right">` : (c !== undefined ? money(c) : "—")}</td><td style="text-align:right"><b ${current && current.diff?.[mth] ? `class="${current.diff[mth] < 0 ? "danger" : ""}"` : ""}>${current ? money(current.diff?.[mth] || 0) : "—"}</b></td></tr>`; }).join("")}</tbody></table></div>
        ${canV && !current ? `<label style="margin-top:12px">Nota del cierre (opcional)<input id="v3CashNote" maxlength="300" placeholder="Ej.: se retiró efectivo para proveedores"></label><div class="button-row" style="margin-top:12px"><button class="primary-button" type="button" data-v3-cash-close>Cerrar caja del día</button></div><p class="v2-help-text">Por defecto el contado es igual a lo esperado; corregí el efectivo si no coincide con lo que contaste.</p>` : ""}
        ${current && current.note ? `<p><b>Nota:</b> ${esc(current.note)}</p>` : ""}
        ${current && JSON.stringify(current.expected) !== JSON.stringify(exp) ? `<div class="v3-note">Atención: después del cierre se validaron o anularon pagos de este día. Lo esperado ahora es ${money(totalExp)} y al cierre era ${money(Object.values(current.expected || {}).reduce((s, v) => s + NUM(v), 0))}.</div>` : ""}</section>
      <section class="surface" style="margin-top:16px"><div class="section-row"><h2>Cobros validados del día</h2></div>${(() => { const rows = state.proposals.flatMap((p) => (p.payments || []).filter((x) => payStatus(x) === "validated" && x.date === cashDate).map((x) => ({ p, x }))); return rows.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Propuesta</th><th>Cliente</th><th>Tipo</th><th>Medio · Ref.</th><th style="text-align:right">Monto</th><th></th></tr></thead><tbody>${rows.map(({ p, x }) => `<tr><td>${esc(p.publicId)}</td><td>${esc(client(p.clientId).company || "")}</td><td>${esc(x.type || "")}</td><td>${esc(x.method || "")}${x.reference ? ` · ${esc(x.reference)}` : ""}</td><td style="text-align:right"><b>${money(x.amount)}</b></td><td><button type="button" data-v3-receipt="${esc(p.id)}:${esc(x.id)}">Recibo</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin cobros validados</b>Cuando Administración valide pagos con fecha de este día, aparecen acá.</div>`; })()}</section>
      <section class="surface" style="margin-top:16px"><div class="section-row"><h2>Últimos cierres</h2></div>${closings.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Día</th><th style="text-align:right">Esperado</th><th style="text-align:right">Contado</th><th style="text-align:right">Diferencia</th><th>Cerró</th></tr></thead><tbody>${closings.slice(0, 30).map((c) => { const dif = Object.values(c.diff || {}).reduce((s, v) => s + NUM(v), 0); return `<tr><td>${dateLabel(c.date)}</td><td style="text-align:right">${money(Object.values(c.expected || {}).reduce((s, v) => s + NUM(v), 0))}</td><td style="text-align:right">${money(Object.values(c.counted || {}).reduce((s, v) => s + NUM(v), 0))}</td><td style="text-align:right"><b class="${dif < 0 ? "danger" : ""}">${money(dif)}</b></td><td>${esc(c.closedBy)} · ${stamp(c.closedAt)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Todavía no hay cierres</b></div>`}</section>`;
  }
  async function closeCash() {
    const counted = {}; qa("[data-v3-cash-in]").forEach((i) => { counted[i.dataset.v3CashIn] = NUM(i.value); });
    try { await api("close_cash", { date: cashDate, counted, note: $("v3CashNote")?.value || "" }); toast("Caja cerrada."); renderView(); } catch (e) { toast(e.message); }
  }

  /* ================= escáner QR y accesos por etiqueta ================= */
  let scanStream = null, scanTimer = null;
  function stopScanner() { clearInterval(scanTimer); scanTimer = null; if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; } }
  function parseScan(text) {
    try { const u = new URL(text, location.href); const pid = u.searchParams.get("p"), did = u.searchParams.get("d"); if (pid) return { pid, did: did || "" }; } catch (e) { /* no es URL */ }
    return null;
  }
  function handleScan(pid, did) {
    stopScanner();
    const p = proposal(pid);
    if (!p) { modal(`<div class="v2-form"><h2>No se encontró el pedido</h2><p>El código no corresponde a ningún pedido de este panel.</p></div>`); return; }
    const d = p.designs.find((x) => x.id === did), c = client(p.clientId), sum = totals(p), prog = d ? productionProgress(d) : null;
    modal(`<div class="v2-form"><h2>${esc(p.publicId)} · ${esc(c.company || "")}</h2><p><span class="v2-status status-${slug(p.status)}">${esc(p.status)}</span> · entrega ${dateLabel(p.deliveryDate)}${productionUrgency(p) ? ` · <b class="danger">${productionUrgency(p)}</b>` : ""}</p>
      ${d ? `<div class="v3-scan-card"><b>${esc(product(d.productId).name)}</b><p>${esc(variantSummary(d))}</p><p class="v2-production-progress ${prog.ready ? "ready" : prog.quality === "Rehacer" ? "redo" : ""}">${prog.ready ? "Control aprobado" : prog.quality === "Rehacer" ? "Requiere rehacer" : `${prog.done}/${prog.total} pasos · calidad ${prog.quality.toLowerCase()}`}</p></div>` : `<p>${p.designs.length} prenda(s) en el pedido.</p>`}
      <p>Cobrado ${money(sum.paid)} de ${money(sum.total)} · saldo <b>${money(sum.balance)}</b></p>
      <div class="button-row">${d && can("proposals.manage") ? `<button class="primary-button" type="button" data-v3-scan-control="${esc(pid)}:${esc(d.id)}">Control de esta prenda</button>` : ""}<button type="button" data-open-proposal="${esc(pid)}" data-close-modal>Abrir pedido</button>${can("proposals.manage") && p.status === "Aprobada" ? `<button type="button" data-v3-status="${esc(pid)}:En producción" data-close-modal>Pasar a producción</button>` : ""}${can("proposals.manage") && p.status === "En producción" ? `<button type="button" data-v3-status="${esc(pid)}:Lista" data-close-modal>Marcar lista</button>` : ""}<button type="button" data-close-modal>Cerrar</button></div></div>`);
  }
  async function openScanner() {
    modal(`<div class="v2-form"><h2>Escanear etiqueta</h2><p>Apuntá la cámara al QR de la etiqueta. En el celular también podés usar la cámara común: el QR abre este panel directo en el pedido.</p><div class="v3-scanbox"><video id="v3ScanVideo" playsinline muted></video></div><p id="v3ScanMsg" class="v2-help-text"></p><label>O pegá el código / link<input id="v3ScanText" placeholder="https://…/panel/?p=…"></label><div class="button-row"><button type="button" data-v3-scan-text>Abrir</button><button type="button" data-close-modal>Cerrar</button></div></div>`);
    const msg = $("v3ScanMsg");
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) { msg.textContent = "Este navegador no puede leer QR con la cámara desde acá. Usá la cámara del celular o pegá el link."; $("v3ScanVideo").parentElement.hidden = true; return; }
    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = $("v3ScanVideo"); v.srcObject = scanStream; await v.play();
      scanTimer = setInterval(async () => { try { const found = await detector.detect(v); if (found[0]) { const r = parseScan(found[0].rawValue); if (r) handleScan(r.pid, r.did); else msg.textContent = "Ese QR no es de una etiqueta de UNIFORMA."; } } catch (e) { /* frame sin datos */ } }, 350);
    } catch (e) { msg.textContent = "No se pudo abrir la cámara (permiso denegado o sin cámara). Pegá el link de la etiqueta."; $("v3ScanVideo").parentElement.hidden = true; }
  }
  UF3.openScanner = openScanner;
  let deepLinkDone = false;
  function handleDeepLink() {
    if (deepLinkDone || !state.proposals || !state.proposals.length) return;
    deepLinkDone = true;
    const sp = new URLSearchParams(location.search), pid = sp.get("p");
    if (!pid) return;
    history.replaceState(null, "", location.pathname);
    setTimeout(() => handleScan(pid, sp.get("d") || ""), 200);
  }

  /* ================= rentabilidad (Reportes) ================= */
  function profitSection() {
    const rows = state.proposals.filter((p) => BILLED.includes(p.status) && (p.designs || []).length).map((p) => ({ p, e: proposalCost(p), c: client(p.clientId) }));
    if (!rows.length) return "";
    const sum = (list, f) => list.reduce((s, r) => s + f(r), 0);
    const rev = sum(rows, (r) => r.e.revenue), profit = sum(rows, (r) => r.e.profit), margin = rev > 0 ? (profit / rev) * 100 : 0;
    const incomplete = rows.filter((r) => r.e.missing.length).length;
    const group = (keyFn) => { const m = new Map(); rows.forEach((r) => { const k = keyFn(r) || "Sin dato"; const g = m.get(k) || { k, n: 0, rev: 0, profit: 0 }; g.n++; g.rev += r.e.revenue; g.profit += r.e.profit; m.set(k, g); }); return [...m.values()].sort((a, b) => b.profit - a.profit); };
    const tbl = (list) => `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th></th><th style="text-align:right">Pedidos</th><th style="text-align:right">Venta s/IVA</th><th style="text-align:right">Ganancia</th><th style="text-align:right">Margen</th></tr></thead><tbody>${list.map((g) => `<tr><td><b>${esc(g.k)}</b></td><td style="text-align:right">${g.n}</td><td style="text-align:right">${money(g.rev)}</td><td style="text-align:right">${money(g.profit)}</td><td style="text-align:right"><b class="${g.rev && g.profit / g.rev < 0.15 ? "danger" : ""}">${g.rev ? ((g.profit / g.rev) * 100).toFixed(1) + "%" : "—"}</b></td></tr>`).join("")}</tbody></table></div>`;
    const redo = state.proposals.filter((p) => p.parentId && ["Garantía", "Rehacer", "Cambio"].includes(p.kind));
    const redoCost = redo.reduce((s, p) => s + proposalCost(p).cost, 0);
    return `<section class="surface report-block"><div class="section-row"><div><h2>Rentabilidad</h2><p>Solo aprobados, en producción, listos y entregados. Usa los costos cargados en Productos y Configuración.</p></div></div>
      <div class="v3-kpis"><div class="v3-kpi"><small>Venta sin IVA</small><strong>${money(rev)}</strong></div><div class="v3-kpi good"><small>Ganancia estimada</small><strong>${money(profit)}</strong></div><div class="v3-kpi ${margin < 20 ? "warn" : "good"}"><small>Margen</small><strong>${margin.toFixed(1)}%</strong></div><div class="v3-kpi ${redo.length ? "warn" : ""}"><small>Rehacer / garantías</small><strong>${redo.length}</strong><em>${rows.length ? ((redo.length / rows.length) * 100).toFixed(1) : 0}% de los pedidos · costo ${money(redoCost)}</em></div></div>
      ${incomplete ? `<p class="v2-cost-warning">${incomplete} pedido(s) tienen costos incompletos: el margen real puede ser menor.</p>` : ""}
      <div class="v2-two"><div><h3>Por cliente</h3>${tbl(group((r) => r.c.company))}</div><div><h3>Por rubro</h3>${tbl(group((r) => r.c.sector))}</div></div>
      <h3 style="margin-top:18px">Pedidos con menor margen</h3><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Pedido</th><th>Cliente</th><th style="text-align:right">Venta s/IVA</th><th style="text-align:right">Costo</th><th style="text-align:right">Ganancia</th><th style="text-align:right">Margen</th></tr></thead><tbody>${rows.slice().sort((a, b) => a.e.margin - b.e.margin).slice(0, 8).map((r) => `<tr><td><button type="button" class="v3-linkbtn" data-open-proposal="${esc(r.p.id)}">${esc(r.p.publicId)}</button>${r.p.kind ? ` <small>(${esc(r.p.kind)})</small>` : ""}</td><td>${esc(r.c.company || "")}</td><td style="text-align:right">${money(r.e.revenue)}</td><td style="text-align:right">${money(r.e.cost)}</td><td style="text-align:right">${money(r.e.profit)}</td><td style="text-align:right"><b class="${r.e.margin < 15 ? "danger" : ""}">${r.e.margin.toFixed(1)}%</b>${r.e.missing.length ? " *" : ""}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  const baseReports = renderReports;
  renderReports = function () { baseReports(); if (can("settings.manage")) $("view-reportes").insertAdjacentHTML("beforeend", profitSection()); };

  /* ================= vistas guardadas por usuario (Propuestas) ================= */
  const viewsOf = () => (currentUser.prefs && Array.isArray(currentUser.prefs.views) ? currentUser.prefs.views : []);
  async function savePrefs(views) {
    try { await api("save_prefs", { prefs: { ...(currentUser.prefs || {}), views } }); } catch (e) { toast(e.message); }
  }
  const baseRenderProposals = renderProposals;
  renderProposals = function () {
    baseRenderProposals();
    const bar = q("#view-propuestas .v2-toolbar"); if (!bar || q("#v3Views", bar)) return;
    const views = viewsOf();
    bar.insertAdjacentHTML("beforeend", `<span class="v3-views"><select id="v3Views" aria-label="Vistas guardadas"><option value="">Vistas guardadas${views.length ? ` (${views.length})` : ""}</option>${views.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}</select><button type="button" data-v3-saveview title="Guardar los filtros actuales como vista">${svg("check", 15)} Guardar vista</button><button type="button" class="danger" data-v3-delview title="Borrar la vista elegida" ${views.length ? "" : "hidden"}>×</button></span>`);
  };
  function applyView(id) {
    const v = viewsOf().find((x) => x.id === id); if (!v) return;
    if (collectionViews.propuestas !== v.mode) setCollectionView("propuestas", v.mode);
    $("proposalSearch").value = v.search || ""; $("proposalClientFilter").value = v.client || ""; $("proposalStatusFilter").value = v.status || "";
    filterProposals(); const sel = $("v3Views"); if (sel) sel.value = id;
  }
  async function saveCurrentView() {
    const name = (window.prompt("Nombre de la vista (por ejemplo «Enviadas de Constructora»):") || "").trim().slice(0, 40);
    if (!name) return;
    const v = { id: uid("view"), name, search: $("proposalSearch")?.value || "", client: $("proposalClientFilter")?.value || "", status: $("proposalStatusFilter")?.value || "", mode: collectionViews.propuestas };
    await savePrefs([...viewsOf(), v].slice(-15)); toast("Vista guardada."); renderProposals(); filterProposals(); const sel = $("v3Views"); if (sel) sel.value = v.id;
  }

  /* ================= tareas repetitivas ================= */
  const REPEATS = [["none", "No se repite"], ["weekly", "Cada semana"], ["monthly", "Cada mes"], ["yearly", "Cada año"]];
  const baseTaskModal = taskModal;
  taskModal = function (id = "") {
    baseTaskModal(id);
    const form = q("#taskFormV2"), t = state.tasks.find((x) => x.id === id) || {};
    form?.querySelector('button[type="submit"]')?.insertAdjacentHTML("beforebegin", `<label>${svg("repeat", 14)} Repetir<select name="repeat">${REPEATS.map(([k, l]) => `<option value="${k}" ${k === (t.repeat || "none") ? "selected" : ""}>${l}</option>`).join("")}</select></label>`);
  };
  const baseSubmit = handleFormSubmit;
  handleFormSubmit = async function (event) {
    const form = event.target, isTask = !!(form && form.getAttribute && form.getAttribute("id") === "taskFormV2"), repeat = isTask ? form.elements.repeat?.value : null, taskId = isTask ? form.elements.id?.value : "";
    const result = await baseSubmit(event);
    if (repeat !== null) { const t = taskId ? state.tasks.find((x) => x.id === taskId) : state.tasks[0]; if (t && (t.repeat || "none") !== repeat) { t.repeat = repeat; scheduleSave(); } }
    return result;
  };
  function nextDue(task) {
    const d = parseYmd(task.dueDate || today());
    const step = () => { if (task.repeat === "weekly") d.setDate(d.getDate() + 7); else if (task.repeat === "monthly") d.setMonth(d.getMonth() + 1); else d.setFullYear(d.getFullYear() + 1); };
    step(); let guard = 0; while (ymd(d) < today() && guard++ < 400) step();
    return ymd(d);
  }
  function spawnRecurring() {
    const add = [];
    state.tasks.forEach((t) => {
      if (t.status === "Hecha" && t.repeat && t.repeat !== "none" && !t.spawned) {
        t.spawned = true;
        add.push({ ...clone(t), id: uid("task"), status: "Pendiente", spawned: false, dueDate: nextDue(t), createdAt: new Date().toISOString() });
      }
    });
    if (add.length) { state.tasks.unshift(...add); toast(`${add.length} tarea(s) repetitiva(s) programada(s) para la próxima vez.`); }
  }
  const baseSave = save;
  save = async function (message) { spawnRecurring(); return baseSave(message); };

  /* ================= configuración: plantillas, capacidad e importación ================= */
  const baseSettings = renderSettings;
  renderSettings = function () {
    baseSettings();
    const tpls = UF3.templates();
    $("view-configuracion").insertAdjacentHTML("beforeend", `<section class="surface report-block" id="v3SettingsExtra"><div class="section-row"><div><h2>Mensajes rápidos y taller</h2><p>Variables: {cliente} {pedido} {total} {saldo} {entrega} {validez} {link}. Los textos se usan en WhatsApp y en los correos.</p></div></div>
      <label style="max-width:320px">Capacidad del taller (prendas por día hábil)<input type="number" id="v3Capacity" min="1" value="${capacityPerDay()}"></label>
      <div class="v3-tpls">${tpls.map((t) => `<div class="v3-tpl"><div class="v3-tplhead"><input type="text" data-v3-tpl-label="${esc(t.id)}" value="${esc(t.label)}" aria-label="Nombre de la plantilla"><button type="button" data-v3-tpl-reset="${esc(t.id)}">Restaurar</button></div><textarea rows="3" data-v3-tpl-text="${esc(t.id)}">${esc(t.text)}</textarea></div>`).join("")}</div>
      <div class="button-row"><button class="primary-button" type="button" data-v3-settings-save>Guardar mensajes y capacidad</button></div></section>
      <section class="surface report-block"><div class="section-row"><div><h2>Importar desde Excel (CSV)</h2><p>En Excel: Archivo → Guardar como → <b>CSV (delimitado por comas o punto y coma)</b>. Se muestra una vista previa antes de importar y no se pisa nada existente.</p></div></div>
      <div class="button-row"><label class="v2-upload">${svg("upload", 15)} Importar clientes<input type="file" accept=".csv,text/csv" data-v3-import="clientes"></label><label class="v2-upload">${svg("upload", 15)} Importar productos<input type="file" accept=".csv,text/csv" data-v3-import="productos"></label><button type="button" data-v3-tpl-csv="clientes">Plantilla de clientes</button><button type="button" data-v3-tpl-csv="productos">Plantilla de productos</button></div></section>`);
  };
  async function saveSettingsExtra() {
    const list = UF3.templates().map((t) => ({ ...t, label: (q(`[data-v3-tpl-label="${t.id}"]`)?.value || t.label).trim() || t.label, text: (q(`[data-v3-tpl-text="${t.id}"]`)?.value || t.text).trim() || t.text }));
    state.settings.messageTemplates = list;
    state.settings.dailyCapacity = Math.max(1, Math.floor(NUM($("v3Capacity").value) || 50));
    audit("Configuración actualizada", "Mensajes rápidos y capacidad del taller");
    try { await save("Mensajes y capacidad guardados."); renderSettings(); } catch (e) { toast(e.message); }
  }

  /* ---------- importación CSV ---------- */
  const norm = (s) => searchText(String(s || "")).replace(/[^a-z0-9]+/g, " ").trim();
  function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/, 1)[0] || "", delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cell = "", q_ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q_) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q_ = false; } else cell += ch; }
      else if (ch === '"') q_ = true;
      else if (ch === delim) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim() !== "")) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some((c) => c.trim() !== "")) rows.push(row);
    return rows;
  }
  async function readCsvFile(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
    return parseCsv(text);
  }
  const CLIENT_COLS = { company: ["empresa", "razon social", "cliente", "company", "nombre"], contact: ["contacto", "contact", "persona"], phone: ["telefono", "whatsapp", "celular", "phone", "tel"], email: ["email", "mail", "correo"], cuit: ["cuit", "cuil", "dni"], address: ["direccion", "domicilio", "address"], sector: ["rubro", "sector", "actividad"], priority: ["prioridad", "priority"], notes: ["notas", "observaciones", "notes"] };
  const PRODUCT_COLS = { name: ["nombre", "producto", "name"], category: ["categoria", "category", "rubro"], sku: ["sku", "codigo"], sizes: ["talles", "sizes", "talle"], colors: ["colores", "colors", "color"], material: ["material", "tela"], price5: ["precio x5", "x5", "precio 5", "precio5"], price10: ["precio x10", "x10", "precio 10", "precio10"], price20: ["precio x20", "x20", "precio 20", "precio20"], price50: ["precio x50", "x50", "precio 50", "precio50"], unitCost: ["costo", "costo unitario", "unit cost"] };
  function mapHeaders(headerRow, spec) {
    const idx = {}; const names = headerRow.map(norm);
    Object.entries(spec).forEach(([k, aliases]) => { const i = names.findIndex((n) => aliases.includes(n)); if (i >= 0) idx[k] = i; });
    return idx;
  }
  let importCtx = null;
  async function startImport(kind, file) {
    let rows; try { rows = await readCsvFile(file); } catch (e) { toast("No se pudo leer el archivo."); return; }
    if (rows.length < 2) { toast("El archivo no tiene filas para importar."); return; }
    const spec = kind === "clientes" ? CLIENT_COLS : PRODUCT_COLS, idx = mapHeaders(rows[0], spec);
    const need = kind === "clientes" ? "company" : "name";
    if (idx[need] === undefined) { toast(`No encontré la columna «${kind === "clientes" ? "Empresa" : "Nombre"}». Descargá la plantilla y usala como guía.`); return; }
    const get = (r, k) => (idx[k] !== undefined ? String(r[idx[k]] ?? "").trim() : "");
    const items = [], dups = [], bad = [];
    rows.slice(1).forEach((r, i) => {
      if (kind === "clientes") {
        const company = get(r, "company"); if (!company) { bad.push(i + 2); return; }
        const exists = state.clients.some((c) => norm(c.company) === norm(company) || (get(r, "cuit") && c.cuit && norm(c.cuit) === norm(get(r, "cuit"))));
        if (exists || items.some((x) => norm(x.company) === norm(company))) { dups.push(company); return; }
        const pr = norm(get(r, "priority")); const priority = pr.startsWith("alt") ? "Alta" : pr.startsWith("baj") ? "Baja" : "Media";
        items.push({ id: uid("client"), company, contact: get(r, "contact"), phone: get(r, "phone"), email: get(r, "email"), cuit: get(r, "cuit"), address: get(r, "address"), sector: get(r, "sector"), priority, notes: get(r, "notes"), internalNotes: "", source: "Importado", ownerId: currentUser.id, logos: [] });
      } else {
        const name = get(r, "name"); if (!name) { bad.push(i + 2); return; }
        const exists = state.products.some((p) => norm(p.name) === norm(name) || (get(r, "sku") && p.sku && norm(p.sku) === norm(get(r, "sku"))));
        if (exists || items.some((x) => norm(x.name) === norm(name))) { dups.push(name); return; }
        const n = (k) => Math.max(0, Number(String(get(r, k)).replace(/\./g, "").replace(",", ".")) || 0);
        const colors = get(r, "colors").split(/[,|]/).map((v) => { const [nm, hex] = v.split(":"); return { name: (nm || "").trim(), hex: /^#[\da-f]{6}$/i.test((hex || "").trim()) ? hex.trim() : "#d8d1c7" }; }).filter((c) => c.name);
        const sizes = get(r, "sizes").split(/[,;\/|]|\sal\s/i).map((v) => v.trim()).filter(Boolean);
        items.push({ id: uid("product"), name, category: get(r, "category") || "Sin categoría", sku: get(r, "sku"), material: get(r, "material"), unitCost: n("unitCost"), source: "Manual", image: "", imageBack: "", colors, sizeOptions: sizes, methods: ["Bordado", "DTF"], prices: { 5: n("price5"), 10: n("price10"), 20: n("price20"), 50: n("price50") }, basePrice: n("price5"), description: "", features: [], sizeChart: [] });
      }
    });
    importCtx = { kind, items };
    const label = (it) => (kind === "clientes" ? `${esc(it.company)}${it.contact ? ` · ${esc(it.contact)}` : ""}${it.phone ? ` · ${esc(it.phone)}` : ""}` : `${esc(it.name)} · ${esc(it.category)}${it.prices[5] ? ` · desde ${money(it.prices[5])}` : ""}`);
    modal(`<div class="v2-form"><h2>Importar ${kind}</h2><p>Se van a crear <b>${items.length}</b> ${kind}${dups.length ? `; se omiten <b>${dups.length}</b> que ya existen (${esc(dups.slice(0, 5).join(", "))}${dups.length > 5 ? "…" : ""})` : ""}${bad.length ? `; <b>${bad.length}</b> fila(s) sin ${kind === "clientes" ? "empresa" : "nombre"} (${bad.slice(0, 6).join(", ")}${bad.length > 6 ? "…" : ""})` : ""}.</p>
      <div class="v3-importlist">${items.slice(0, 40).map((it) => `<div>${label(it)}</div>`).join("") || "<div>Nada para importar.</div>"}${items.length > 40 ? `<div>… y ${items.length - 40} más</div>` : ""}</div>
      <div class="button-row"><button class="primary-button" type="button" data-v3-import-go ${items.length ? "" : "disabled"}>Importar ${items.length}</button><button type="button" data-close-modal>Cancelar</button></div></div>`, true);
  }
  async function commitImport() {
    if (!importCtx) return;
    const { kind, items } = importCtx; importCtx = null;
    const perm = kind === "clientes" ? "clients.manage" : "catalog.manage";
    if (!can(perm)) { toast("No tenés permiso para importar esto."); return; }
    if (kind === "clientes") state.clients.unshift(...items); else state.products.unshift(...items);
    audit(`Importación de ${kind}`, `${items.length} registro(s) desde CSV`);
    try { await save(`${items.length} ${kind} importado(s).`); closeModal(); renderView(); } catch (e) { toast(e.message); }
  }
  function templateCsv(kind) {
    if (kind === "clientes") downloadCsv("plantilla-clientes.csv", [["Empresa", "Contacto", "WhatsApp", "Email", "CUIT", "Dirección", "Rubro", "Prioridad", "Notas"], ["Panadería Don Luis", "Luis Pérez", "+54 9 351 555 0000", "luis@ejemplo.com", "20-12345678-9", "Av. Siempreviva 123", "Gastronomía", "Alta", "Quiere delantales"]]);
    else downloadCsv("plantilla-productos.csv", [["Nombre", "Categoría", "SKU", "Talles", "Colores", "Material", "Precio x5", "Precio x10", "Precio x20", "Precio x50", "Costo"], ["Remera clásica", "Remeras", "REM-001", "S,M,L,XL,XXL", "Negro:#171717,Blanco:#f5f3ed", "Jersey 24/1", "23000", "20700", "19000", "17500", "9000"]]);
  }

  /* ================= clics y eventos ================= */
  let stockSearchTimer = null;
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const link = t.closest("[data-v3-link]");
    if (link) {
      const [op, id] = link.dataset.v3Link.split(":");
      if (op === "copy") { const url = UF3.trackLink(proposal(id)); try { await navigator.clipboard.writeText(url); toast("Link copiado."); } catch (er) { const i = $(`v3LinkInput-${id}`); i?.select(); document.execCommand("copy"); toast("Link copiado."); } return; }
      if (op === "revoke" && !confirm("El cliente ya no podrá abrir su link. ¿Desactivarlo?")) return;
      if (op === "regenerate" && !confirm("El link anterior dejará de funcionar. ¿Generar uno nuevo?")) return;
      try { await api("tracking_link", { proposalId: id, op }); if ($("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(proposal(id)); toast(op === "revoke" ? "Link desactivado." : "Link listo."); } catch (er) { toast(er.message); }
      return;
    }
    const clear = t.closest("[data-v3-clear-change]");
    if (clear) { const p = proposal(clear.dataset.v3ClearChange); if (p) { p.changeRequest = null; proposalEvent(p, "Pedido de cambios atendido", ""); try { await save("Marcado como atendido."); } catch (er) { toast(er.message); } if (currentView === "propuestas" && $("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(p); else renderView(); } return; }
    const war = t.closest("[data-v3-warranty]"); if (war) return warrantyModal(war.dataset.v3Warranty);
    const warGo = t.closest("[data-v3-warranty-go]"); if (warGo) return createWarranty(warGo.dataset.v3WarrantyGo);
    const rem = t.closest("[data-v3-remito]"); if (rem) return printRemito(rem.dataset.v3Remito);
    const rec = t.closest("[data-v3-receipt]"); if (rec) { const [pid, payid] = rec.dataset.v3Receipt.split(":"); return printReceipt(pid, payid); }
    if (t.closest("[data-v3-stockentry]")) return stockEntryModal();
    if (t.closest("[data-v3-entry-go]")) return submitStockEntry();
    const st = t.closest("[data-v3-stocktab]"); if (st) { stockTab = st.dataset.v3Stocktab; return renderStock(); }
    if (t.closest("[data-v3-stock-csv]")) return downloadCsv(`uniforma-stock-${today()}.csv`, [["Producto", "Color", "Talle", "Stock", "Reservado", "Disponible", "Faltante"], ...stockRows().map((r) => [r.pr.name, r.color, r.size, r.configured ? r.stock : "Sin cargar", r.reserved, r.configured ? r.available : "", r.configured ? r.shortage : ""])]);
    const buy = t.closest("[data-v3-buytask]");
    if (buy) { const p = proposal(buy.dataset.v3Buytask); if (p) { state.tasks.unshift({ id: uid("task"), title: `Conseguir prendas para ${p.publicId}`, clientId: p.clientId, proposalId: p.id, dueDate: addDays(2), status: "Pendiente", priority: "Alta", ownerId: currentUser.id, note: "Faltantes detectados al aprobar. Ver Stock.", createdAt: new Date().toISOString() }); try { await save("Tarea creada."); closeModal(); } catch (er) { toast(er.message); } } return; }
    const cal = t.closest("[data-v3-cal]");
    if (cal) { const dir = Number(cal.dataset.v3Cal); if (dir === 0) calMonth = today().slice(0, 7); else { const [y, m] = calMonth.split("-").map(Number); const d = new Date(y, m - 1 + dir, 1); calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; } return renderCalendar(); }
    if (t.closest("[data-v3-promise]")) return promiseCheck();
    if (t.closest("[data-v3-cash-close]")) return closeCash();
    if (t.closest("[data-v3-cash-csv]")) { const rows = []; state.proposals.forEach((p) => (p.payments || []).filter((x) => payStatus(x) === "validated" && x.date === cashDate).forEach((x) => rows.push([cashDate, p.publicId, client(p.clientId).company || "", x.type || "", x.method || "", x.reference || "", NUM(x.amount)]))); return downloadCsv(`uniforma-caja-${cashDate}.csv`, [["Fecha", "Propuesta", "Cliente", "Tipo", "Medio", "Referencia", "Monto"], ...rows]); }
    if (t.closest("[data-v3-scan]")) return openScanner();
    const sc = t.closest("[data-v3-scan-control]"); if (sc) { const [pid, did] = sc.dataset.v3ScanControl.split(":"); closeModal(); return productionModal(pid, did); }
    if (t.closest("[data-v3-scan-text]")) { const r = parseScan($("v3ScanText").value.trim()); if (r) handleScan(r.pid, r.did); else toast("Ese código no es de una etiqueta de UNIFORMA."); return; }
    if (t.closest("[data-close-modal]")) stopScanner();
    if (t.closest("[data-v3-saveview]")) return saveCurrentView();
    if (t.closest("[data-v3-delview]")) { const id = $("v3Views")?.value; if (!id) { toast("Elegí primero la vista que querés borrar."); return; } await savePrefs(viewsOf().filter((v) => v.id !== id)); toast("Vista borrada."); renderProposals(); filterProposals(); return; }
    const tr_ = t.closest("[data-v3-tpl-reset]"); if (tr_) { const d = UF3.DEFAULT_TEMPLATES.find((x) => x.id === tr_.dataset.v3TplReset); const ta = q(`[data-v3-tpl-text="${tr_.dataset.v3TplReset}"]`); if (d && ta) { ta.value = d.text; q(`[data-v3-tpl-label="${d.id}"]`).value = d.label; } return; }
    if (t.closest("[data-v3-settings-save]")) return saveSettingsExtra();
    const tc = t.closest("[data-v3-tpl-csv]"); if (tc) return templateCsv(tc.dataset.v3TplCsv);
    if (t.closest("[data-v3-import-go]")) return commitImport();
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "v3Views" && t.value) return applyView(t.value);
    if (t.id === "v3StockShort") { stockOnlyShort = t.checked; return renderStock(); }
    if (t.id === "v3CashDate") { cashDate = t.value || today(); return renderCash(); }
    const imp = t.closest ? t.closest("[data-v3-import]") : null;
    if (imp && t.files && t.files[0]) { const f = t.files[0]; t.value = ""; return startImport(imp.dataset.v3Import, f); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "v3StockSearch") { stockQ = e.target.value; clearTimeout(stockSearchTimer); stockSearchTimer = setTimeout(() => { renderStock(); const i = $("v3StockSearch"); if (i) { i.focus(); i.setSelectionRange(stockQ.length, stockQ.length); } }, 150); }
  });
  new MutationObserver(() => { if ($("v2Modal") && $("v2Modal").hidden) stopScanner(); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });

  /* ================= registro de pantallas y arranque ================= */
  UF3.views.stock = renderStock;
  UF3.views.calendario = renderCalendar;
  UF3.views.caja = renderCash;
  const baseShell = shell;
  shell = function () {
    baseShell();
    const tb = q(".topbar"), anchor = q(".v3-help-btn", tb);
    if (tb && anchor && !q("[data-v3-scan]", tb)) anchor.insertAdjacentHTML("beforebegin", `<button class="v3-help-btn" type="button" data-v3-scan title="Escanear etiqueta QR" aria-label="Escanear etiqueta QR">${svg("qr", 18)}<span>Escanear</span></button>`);
  };
  const baseRenderView = renderView;
  renderView = function () { baseRenderView(); handleDeepLink(); };
  if (state && state.proposals && q(".topbar")) { shell(); renderView(); }
})();
