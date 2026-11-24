/* UNIFORMA ERP — Consultas de la web, Compras y talleres externos, Tablero de gerencia.
   Se carga después de panel-v3-ops.js. */
(() => {
  "use strict";
  const UF3 = window.UF3;
  if (!UF3) return;
  const { svg, ico, payStatus } = UF3;
  const NUM = (n) => Number(n || 0);
  const stamp = (iso) => (iso ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const norm = (s) => searchText(String(s || "")).replace(/[^a-z0-9]+/g, " ").trim();
  const arr = (k) => (Array.isArray(state[k]) ? state[k] : []);
  const BILLED = ["Aprobada", "En producción", "Lista", "Entregada"];

  /* nombres de usuarios (para el tablero) */
  UF3.userNames = UF3.userNames || {};
  const prevApi = api;
  api = async function (action, payload) {
    const data = await prevApi(action, payload);
    if (data && data.userNames) UF3.userNames = data.userNames;
    return data;
  };
  fetch("api.php", { credentials: "same-origin" }).then((r) => r.json()).then((d) => { if (d && d.userNames) UF3.userNames = d.userNames; }).catch(() => {});

  const saveEntity = async (action, body, okMsg) => {
    try { await api(action, body); if (okMsg) toast(okMsg); closeModal(); renderView(); return true; } catch (e) { toast(e.message); return false; }
  };

  /* ================= CONSULTAS DE LA WEB ================= */
  let leadTab = "Nuevo";
  const LEAD_SRC = { contacto: "Formulario de contacto", producto: "Interés en un producto", recompra: "Pedido de recompra" };
  function renderLeads() {
    const leads = arr("leads");
    const count = (s) => leads.filter((l) => l.status === s).length;
    const shown = leadTab === "Todas" ? leads : leads.filter((l) => l.status === leadTab);
    const tabs = [["Nuevo", "Nuevas"], ["Contactado", "Contactadas"], ["Convertido", "Convertidas"], ["Descartado", "Descartadas"], ["Todas", "Todas"]];
    const conv = leads.length ? Math.round((count("Convertido") / leads.length) * 100) : 0;
    $("view-consultas").innerHTML = `<div class="page-heading"><div><h1>${ico("inbox", 25)} Consultas de la web</h1><p>Lo que llega del formulario de contacto, de «Pedir presupuesto» en cada producto y de los pedidos de recompra. Convertí cada una en propuesta con un clic.</p></div></div>
      <div class="v3-kpis"><div class="v3-kpi ${count("Nuevo") ? "warn" : "good"}"><small>Sin atender</small><strong>${count("Nuevo")}</strong><em>consultas nuevas</em></div><div class="v3-kpi"><small>Contactadas</small><strong>${count("Contactado")}</strong><em>en seguimiento</em></div><div class="v3-kpi good"><small>Convertidas en propuesta</small><strong>${count("Convertido")}</strong><em>${conv}% del total</em></div><div class="v3-kpi"><small>Total recibidas</small><strong>${leads.length}</strong><em>${count("Descartado")} descartadas</em></div></div>
      <section class="surface"><div class="v3-chips">${tabs.map(([k, l]) => `<button type="button" class="v3-chip ${leadTab === k ? "on" : ""}" data-v3-leadtab="${k}">${l}<b>${k === "Todas" ? leads.length : count(k)}</b></button>`).join("")}</div>
      ${shown.length ? shown.map((l) => leadCard(l)).join("") : `<div class="v3-empty"><b>${leads.length ? "Nada en esta pestaña" : "Todavía no llegaron consultas"}</b>${leads.length ? "" : "Cuando alguien complete el formulario de contacto o pida un presupuesto en la web, aparece acá. Falta configurar la conexión con la web (ver el LEEME)."}</div>`}</section>`;
  }
  function leadCard(l) {
    const who = l.company || l.name || "Sin nombre";
    const phone = String(l.phone || "").replace(/\D/g, "");
    const rows = [["Producto", l.product], ["SKU", l.sku], ["Color", l.color], ["Talle", l.size], ["Cantidad", l.qty], ["Tipo de prendas", l.type], ["Personalización", l.personalization]].filter(([, v]) => v);
    const manage = can("proposals.manage");
    return `<article class="v3-lead ${l.status === "Nuevo" ? "new" : ""}"><header><div><b>${esc(who)}</b>${l.company && l.name ? ` <span>· ${esc(l.name)}</span>` : ""}<small>${esc(LEAD_SRC[l.source] || l.source)} · ${stamp(l.at)}</small></div><span class="v3-leadstate s-${slug(l.status)}">${esc(l.status)}</span></header>
      ${l.message ? `<p class="msg">${esc(l.message)}</p>` : ""}
      ${rows.length ? `<div class="v3-leadrows">${rows.map(([k, v]) => `<span><small>${k}</small>${esc(v)}</span>`).join("")}</div>` : ""}
      <div class="v3-leadcontact">${phone ? `<a class="v2-button-link" href="https://wa.me/${phone}" target="_blank" rel="noopener">WhatsApp ${esc(l.phone)}</a>` : ""}${l.email ? `<a class="v2-button-link" href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : ""}${l.page ? `<a class="v2-button-link" href="${esc(l.page)}" target="_blank" rel="noopener">Ver página</a>` : ""}</div>
      ${l.note ? `<p class="v2-help-text">Nota: ${esc(l.note)}</p>` : ""}
      ${manage ? `<div class="button-row">${l.status !== "Convertido" ? `<button class="primary-button" type="button" data-v3-leadconv="${esc(l.id)}">Convertir en propuesta</button>` : l.proposalId ? `<button type="button" data-open-proposal="${esc(l.proposalId)}">Ver propuesta</button>` : ""}${l.status === "Nuevo" ? `<button type="button" data-v3-leadset="${esc(l.id)}:Contactado">Marcar contactada</button>` : ""}${l.status !== "Descartado" && l.status !== "Convertido" ? `<button type="button" class="danger" data-v3-leadset="${esc(l.id)}:Descartado">Descartar</button>` : ""}${l.status === "Descartado" || l.status === "Contactado" ? `<button type="button" data-v3-leadset="${esc(l.id)}:Nuevo">Volver a «nueva»</button>` : ""}</div>` : ""}</article>`;
  }
  async function convertLead(id) {
    const l = arr("leads").find((x) => x.id === id);
    if (!l) return;
    if (!can("clients.manage")) { toast("Necesitás permiso para crear clientes."); return; }
    const email = norm(l.email), phone = String(l.phone || "").replace(/\D/g, "").slice(-8);
    let c = state.clients.find((x) => (email && norm(x.email) === email) || (phone.length >= 8 && String(x.phone || "").replace(/\D/g, "").endsWith(phone)) || (l.company && norm(x.company) === norm(l.company)) || (l.clientId && x.id === l.clientId));
    let created = false;
    if (!c) {
      c = { id: uid("client"), company: l.company || l.name || "Cliente web", contact: l.name || "", phone: l.phone || "", email: l.email || "", cuit: "", address: "", sector: "", priority: "Media", notes: l.message || "", internalNotes: `Llegó por la web (${LEAD_SRC[l.source] || l.source}) el ${new Date(l.at).toLocaleDateString("es-AR")}.`, source: "Web", ownerId: currentUser.id, logos: [] };
      state.clients.unshift(c); created = true;
    }
    const ref = l.proposalRef ? state.proposals.find((x) => x.id === l.proposalRef) : null;
    const prod = !ref && (l.sku || l.product) ? state.products.find((x) => (l.sku && norm(x.sku) === norm(l.sku)) || (l.product && norm(x.name) === norm(l.product))) : null;
    const p = { id: uid("proposal"), publicId: nextQuoteId(), createdDate: today(), updatedDate: today(), designs: [], payments: [], history: [], ownerId: currentUser.id, clientId: c.id, status: "Borrador", priority: l.status === "Nuevo" ? "Alta" : "Media",
      title: ref ? `Recompra de ${ref.publicId}` : prod ? `Presupuesto ${prod.name}` : `Consulta web de ${c.company}`, notes: "", internalNotes: `Consulta web: ${l.message || ""}${l.qty ? ` · Cantidad: ${l.qty}` : ""}`.trim(), paymentTerms: ref?.paymentTerms || "Efectivo / transferencia", discount: 0, surcharge: 0, shipping: 0, shippingCost: 0, taxRate: ref ? ref.taxRate : state.settings.taxRate ?? 0 };
    if (ref) {
      p.repeatOf = ref.id;
      p.designs = ref.designs.map((d) => { const copy = { ...clone(d), id: uid("design"), production: {} }; copy.unitPrice = tierPrice(product(d.productId), d.qty) || d.unitPrice; return copy; });
    } else if (prod) {
      const qty = Math.max(5, parseInt(l.qty, 10) || 5);
      p.designs = [{ id: uid("design"), productId: prod.id, qty, color: l.color || "", size: l.size || "", method: /bordad/i.test(l.personalization) ? "Bordado" : /dtf/i.test(l.personalization) ? "DTF" : "Bordado", logos: [], note: l.personalization ? `Personalización pedida: ${l.personalization}` : "" }];
    }
    state.proposals.unshift(p);
    normalize();
    proposalEvent(p, "Propuesta creada desde una consulta web", ref ? `Recompra de ${ref.publicId}` : (l.message || "").slice(0, 100));
    state.activeProposalId = p.id;
    try {
      await save(created ? "Cliente nuevo y propuesta creados." : "Propuesta creada.");
      await api("lead_update", { id: l.id, status: "Convertido", proposalId: p.id, note: l.note || "" });
      go("propuestas");
    } catch (e) { state.proposals = state.proposals.filter((x) => x.id !== p.id); if (created) state.clients = state.clients.filter((x) => x.id !== c.id); toast(e.message); }
  }
  UF3.views.consultas = renderLeads;
  UF3.agendaHooks.push((items, push) => {
    if (!can("proposals.view")) return;
    const fresh = arr("leads").filter((l) => l.status === "Nuevo");
    if (fresh.length) push({ group: "seguimiento", level: fresh.some((l) => (Date.now() - new Date(l.at).getTime()) > 86400000) ? "bad" : "warn", tag: "Web", title: `${fresh.length} consulta(s) nueva(s) de la web`, sub: fresh.slice(0, 2).map((l) => l.company || l.name || l.product || "Interesado").join(" · "), acts: [{ label: "Ver consultas", main: true, attr: 'data-go="consultas"' }] });
  });
  UF3.badgeHooks.push((set) => { set("consultas", can("proposals.view") ? arr("leads").filter((l) => l.status === "Nuevo").length : 0, false); });

  /* ================= COMPRAS Y TALLERES EXTERNOS ================= */
  let buyTab = "oc";
  const poPaid = (po) => (po.payments || []).reduce((s, x) => s + NUM(x.amount), 0);
  const woTotal = (w) => NUM(w.qty) * NUM(w.unitCost);
  const supplierName = (id) => (arr("suppliers").find((s) => s.id === id) || {}).name || "—";
  const supplyLow = (s) => NUM(s.min) > 0 && NUM(s.stock) <= NUM(s.min);
  const woLate = (w) => w.status !== "Recibido" && w.dueDate && w.dueDate < today();
  function renderBuy() {
    if (!can("purchases.view")) { $("view-compras").innerHTML = `${viewHeader("Compras", "")}<div class="v2-empty">No tenés permiso para ver las compras.</div>`; return; }
    const manage = can("purchases.manage");
    const pos = arr("purchaseOrders"), wos = arr("workOrders"), sups = arr("supplies");
    const payablePO = pos.filter((p) => p.status !== "Cancelada").reduce((s, p) => s + Math.max(0, NUM(p.total) - poPaid(p)), 0);
    const payableWO = wos.reduce((s, w) => s + Math.max(0, woTotal(w) - NUM(w.paid)), 0);
    const lowCount = sups.filter(supplyLow).length, lateCount = wos.filter(woLate).length;
    const tabs = [["oc", "Órdenes de compra", pos.filter((p) => ["Borrador", "Pedida", "Recibida parcial"].includes(p.status)).length], ["prov", "Proveedores", arr("suppliers").length], ["ins", "Insumos", sups.length], ["ot", "Talleres externos", wos.filter((w) => w.status !== "Recibido").length], ["pagar", "Por pagar", null]];
    $("view-compras").innerHTML = `<div class="page-heading"><div><h1>${ico("cart", 25)} Compras y talleres</h1><p>Órdenes de compra de prendas e insumos, proveedores, trabajos tercerizados y lo que hay que pagar.</p></div><div class="button-row">${manage ? `<button class="primary-button" type="button" data-v3-newpo>Nueva orden de compra</button><button type="button" data-v3-newwo>Nueva orden de trabajo</button>` : ""}</div></div>
      <div class="v3-kpis"><div class="v3-kpi ${payablePO + payableWO ? "warn" : "good"}"><small>Por pagar</small><strong>${money(payablePO + payableWO)}</strong><em>proveedores ${money(payablePO)} · talleres ${money(payableWO)}</em></div><div class="v3-kpi"><small>Órdenes abiertas</small><strong>${tabs[0][2]}</strong><em>de compra, sin cerrar</em></div><div class="v3-kpi ${lateCount ? "bad" : ""}"><small>Trabajos atrasados</small><strong>${lateCount}</strong><em>${wos.filter((w) => w.status !== "Recibido").length} en curso</em></div><div class="v3-kpi ${lowCount ? "warn" : "good"}"><small>Insumos bajo mínimo</small><strong>${lowCount}</strong><em>${sups.length} insumo(s) cargado(s)</em></div></div>
      <section class="surface"><div class="v3-chips">${tabs.map(([k, l, n]) => `<button type="button" class="v3-chip ${buyTab === k ? "on" : ""}" data-v3-buytab="${k}">${l}${n === null ? "" : `<b>${n}</b>`}</button>`).join("")}</div>${buyPane(manage)}</section>`;
  }
  function buyPane(manage) {
    if (buyTab === "oc") {
      const pos = arr("purchaseOrders");
      if (!pos.length) return `<div class="v3-empty"><b>Todavía no hay órdenes de compra</b>${manage ? "Creá la primera con «Nueva orden de compra»." : ""}</div>`;
      return `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Orden</th><th>Proveedor</th><th>Fecha</th><th>Esperada</th><th style="text-align:right">Total</th><th style="text-align:right">Pagado</th><th>Estado</th><th></th></tr></thead><tbody>${pos.map((p) => `<tr class="${p.status === "Cancelada" ? "v3-row-voided" : ""}"><td><b>${esc(p.number)}</b></td><td>${esc(supplierName(p.supplierId))}</td><td>${dateLabel(p.date)}</td><td>${p.expectedDate ? dateLabel(p.expectedDate) : "—"}</td><td style="text-align:right">${money(p.total)}</td><td style="text-align:right">${money(poPaid(p))}</td><td><span class="v3-leadstate s-${slug(p.status)}">${esc(p.status)}</span></td><td><div class="button-row"><button type="button" data-v3-poview="${esc(p.id)}">Ver</button>${manage && ["Pedida", "Recibida parcial"].includes(p.status) ? `<button type="button" class="v3-ok" data-v3-porec="${esc(p.id)}">Recibir</button>` : ""}${manage && p.status === "Borrador" ? `<button type="button" data-v3-poorder="${esc(p.id)}">Marcar pedida</button>` : ""}${manage && p.status !== "Cancelada" && NUM(p.total) - poPaid(p) > 0 ? `<button type="button" data-v3-popay="${esc(p.id)}">Pagar</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
    }
    if (buyTab === "prov") {
      const list = arr("suppliers");
      return `${manage ? `<div class="button-row" style="margin-bottom:12px"><button type="button" class="primary-button" data-v3-newsup>Nuevo proveedor o taller</button></div>` : ""}${list.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th></th></tr></thead><tbody>${list.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.type)}</td><td>${esc(s.contact || "")}</td><td>${esc(s.phone || "")}</td><td>${esc(s.email || "")}</td><td>${manage ? `<div class="button-row"><button type="button" data-v3-editsup="${esc(s.id)}">Editar</button><button type="button" class="danger" data-v3-delsup="${esc(s.id)}">Borrar</button></div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin proveedores</b>Cargá tus proveedores de prendas, insumos y talleres externos.</div>`}`;
    }
    if (buyTab === "ins") {
      const list = arr("supplies"), moves = arr("supplyMovements");
      return `${manage ? `<div class="button-row" style="margin-bottom:12px"><button type="button" class="primary-button" data-v3-newsupply>Nuevo insumo</button></div>` : ""}${list.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Insumo</th><th style="text-align:right">Stock</th><th style="text-align:right">Mínimo</th><th style="text-align:right">Costo</th><th></th></tr></thead><tbody>${list.map((s) => `<tr class="${supplyLow(s) ? "v2-shortage-row" : ""}"><td><b>${esc(s.name)}</b>${supplyLow(s) ? ` <span class="v2-delivery-alert">bajo mínimo</span>` : ""}</td><td style="text-align:right"><b>${NUM(s.stock)}</b> ${esc(s.unit)}</td><td style="text-align:right">${NUM(s.min)}</td><td style="text-align:right">${money(s.cost)}</td><td>${manage ? `<div class="button-row"><button type="button" data-v3-supmove="${esc(s.id)}">Consumo / ajuste</button><button type="button" data-v3-editsupply="${esc(s.id)}">Editar</button></div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin insumos cargados</b>Hilo, film DTF, tintas, etiquetas… cargalos con su stock mínimo y el panel avisa cuando falten.</div>`}
        ${moves.length ? `<h3 style="margin-top:18px">Últimos movimientos</h3><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Fecha</th><th>Insumo</th><th style="text-align:right">Cantidad</th><th>Motivo</th><th>Detalle</th><th>Usuario</th></tr></thead><tbody>${moves.slice(0, 30).map((m) => `<tr><td>${stamp(m.at)}</td><td>${esc(m.name)}</td><td style="text-align:right"><b style="${m.qty > 0 ? "color:var(--ok)" : "color:var(--danger)"}">${m.qty > 0 ? "+" : ""}${m.qty}</b></td><td>${esc(m.reason)}</td><td>${esc(m.note || "")}</td><td>${esc(m.userName || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
    }
    if (buyTab === "ot") {
      const list = arr("workOrders");
      if (!list.length) return `<div class="v3-empty"><b>Sin trabajos tercerizados</b>${manage ? "Si mandás bordado o estampado a un taller externo, cargalo con «Nueva orden de trabajo» y seguí plazo y costo." : ""}</div>`;
      return `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Orden</th><th>Pedido</th><th>Taller</th><th>Servicio</th><th style="text-align:right">Cant.</th><th style="text-align:right">Costo</th><th style="text-align:right">Pagado</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${list.map((w) => { const p = state.proposals.find((x) => x.id === w.proposalId); return `<tr class="${woLate(w) ? "v2-shortage-row" : ""}"><td><b>${esc(w.number)}</b></td><td>${p ? `<button type="button" class="v3-linkbtn" data-open-proposal="${esc(p.id)}">${esc(p.publicId)}</button>` : "—"}</td><td>${esc(supplierName(w.vendorId))}</td><td>${esc(w.service)}</td><td style="text-align:right">${w.qty}</td><td style="text-align:right">${money(woTotal(w))}</td><td style="text-align:right">${money(w.paid)}</td><td>${w.dueDate ? dateLabel(w.dueDate) : "—"}${woLate(w) ? ` <span class="v2-delivery-alert">atrasado</span>` : ""}</td><td>${manage ? `<select data-v3-wostatus="${esc(w.id)}">${["Enviado", "En proceso", "Recibido", "Con problema"].map((s) => `<option ${s === w.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : esc(w.status)}</td><td>${manage ? `<div class="button-row"><button type="button" data-v3-wopay="${esc(w.id)}">Pagar</button><button type="button" data-v3-editwo="${esc(w.id)}">Editar</button></div>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
    // por pagar
    const rows = [];
    arr("purchaseOrders").filter((p) => p.status !== "Cancelada").forEach((p) => { const bal = NUM(p.total) - poPaid(p); if (bal > 0) rows.push({ who: supplierName(p.supplierId), what: `Orden ${p.number}`, total: NUM(p.total), paid: poPaid(p), bal, due: p.expectedDate || "" }); });
    arr("workOrders").forEach((w) => { const bal = woTotal(w) - NUM(w.paid); if (bal > 0) rows.push({ who: supplierName(w.vendorId), what: `Trabajo ${w.number} (${w.service})`, total: woTotal(w), paid: NUM(w.paid), bal, due: w.dueDate || "" }); });
    const by = {}; rows.forEach((r) => { by[r.who] = (by[r.who] || 0) + r.bal; });
    return rows.length ? `<h3>Por proveedor</h3><div class="v3-methods" style="max-width:420px;margin-bottom:14px">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span>${esc(k)} <b>${money(v)}</b></span>`).join("")}</div><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Proveedor / taller</th><th>Concepto</th><th style="text-align:right">Total</th><th style="text-align:right">Pagado</th><th style="text-align:right">Saldo</th><th>Fecha</th></tr></thead><tbody>${rows.sort((a, b) => b.bal - a.bal).map((r) => `<tr><td><b>${esc(r.who)}</b></td><td>${esc(r.what)}</td><td style="text-align:right">${money(r.total)}</td><td style="text-align:right">${money(r.paid)}</td><td style="text-align:right"><b>${money(r.bal)}</b></td><td>${r.due ? dateLabel(r.due) : "—"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>No hay nada por pagar</b>Las órdenes con saldo y los trabajos sin pagar aparecen acá.</div>`;
  }

  /* ---- modales de compras ---- */
  const sel = (id, opts, val = "") => `<select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  function supplierModal(id = "") {
    const s = arr("suppliers").find((x) => x.id === id) || {};
    modal(`<div class="v2-form"><h2>${id ? "Editar" : "Nuevo"} proveedor o taller</h2><div class="v2-form-grid"><label>Nombre<input id="sName" value="${esc(s.name || "")}" required></label><label>Tipo${sel("sType", [["prendas", "Proveedor de prendas"], ["insumos", "Proveedor de insumos"], ["taller", "Taller externo (bordado, estampado, costura)"], ["otro", "Otro"]], s.type || "prendas")}</label><label>Contacto<input id="sContact" value="${esc(s.contact || "")}"></label><label>Teléfono<input id="sPhone" value="${esc(s.phone || "")}"></label><label>Email<input id="sEmail" value="${esc(s.email || "")}"></label><label>CUIT<input id="sCuit" value="${esc(s.cuit || "")}"></label></div><label>Notas<textarea id="sNote" rows="2">${esc(s.note || "")}</textarea></label><div class="button-row"><button class="primary-button" type="button" data-v3-sup-go="${esc(id)}">Guardar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  function supplyModal(id = "") {
    const s = arr("supplies").find((x) => x.id === id) || {};
    modal(`<div class="v2-form"><h2>${id ? "Editar" : "Nuevo"} insumo</h2><div class="v2-form-grid"><label>Nombre<input id="iName" value="${esc(s.name || "")}" placeholder="Hilo negro, film DTF…"></label><label>Unidad<input id="iUnit" value="${esc(s.unit || "u")}" placeholder="conos, metros, litros…"></label>${id ? "" : `<label>Stock inicial<input id="iStock" type="number" min="0" step="any" value="0"></label>`}<label>Stock mínimo (avisa al llegar)<input id="iMin" type="number" min="0" step="any" value="${NUM(s.min)}"></label><label>Costo por unidad<input id="iCost" type="number" min="0" step="any" value="${NUM(s.cost)}"></label></div><div class="button-row"><button class="primary-button" type="button" data-v3-supply-go="${esc(id)}">Guardar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  function supplyMoveModal(id) {
    const s = arr("supplies").find((x) => x.id === id); if (!s) return;
    modal(`<div class="v2-form"><h2>Movimiento de ${esc(s.name)}</h2><p>Stock actual: <b>${NUM(s.stock)} ${esc(s.unit)}</b>. Usá números negativos para consumos.</p><div class="v2-form-grid"><label>Motivo${sel("mReason", [["Consumo", "Consumo en producción"], ["Ingreso", "Ingreso"], ["Ajuste", "Ajuste de inventario"]], "Consumo")}</label><label>Cantidad (+ o −)<input id="mQty" type="number" step="any" value="-1"></label></div><label>Detalle<input id="mNote" maxlength="200" placeholder="Pedido, taller, motivo…"></label><div class="button-row"><button class="primary-button" type="button" data-v3-move-go="${esc(id)}">Registrar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  let poDraftRows = [];
  function poRowHtml(r, i) {
    const prods = [["", "— prenda —"], ...state.products.map((p) => [p.id, p.name])];
    const supplies = [["", "— insumo —"], ...arr("supplies").map((s) => [s.id, s.name])];
    const prod = state.products.find((p) => p.id === r.productId);
    return `<tr data-row="${i}"><td><select data-f="kind"><option value="prenda" ${r.kind !== "insumo" ? "selected" : ""}>Prenda</option><option value="insumo" ${r.kind === "insumo" ? "selected" : ""}>Insumo</option></select></td><td>${r.kind === "insumo" ? `<select data-f="supplyId">${supplies.map(([v, l]) => `<option value="${esc(v)}" ${v === r.supplyId ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : `<select data-f="productId">${prods.map(([v, l]) => `<option value="${esc(v)}" ${v === r.productId ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`}</td><td>${r.kind === "insumo" ? "" : `<select data-f="color"><option value="">Color</option>${(prod ? colorsOf(prod) : []).map((c) => `<option ${c.name === r.color ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select> <select data-f="size"><option value="">Talle</option>${(prod ? sizesOf(prod) : []).map((s) => `<option ${s === r.size ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`}</td><td><input data-f="qty" type="number" min="1" step="1" value="${r.qty || 1}" style="width:80px"></td><td><input data-f="unitCost" type="number" min="0" step="any" value="${r.unitCost || 0}" style="width:110px"></td><td><button type="button" class="danger" data-v3-porow-del="${i}">×</button></td></tr>`;
  }
  function poModal(id = "") {
    const po = arr("purchaseOrders").find((x) => x.id === id);
    if (!arr("suppliers").length) { toast("Primero cargá un proveedor en la pestaña Proveedores."); buyTab = "prov"; renderBuy(); return; }
    poDraftRows = po ? clone(po.items) : [{ kind: "prenda", qty: 10, unitCost: 0 }];
    modal(`<div class="v2-form"><h2>${po ? `Editar ${esc(po.number)}` : "Nueva orden de compra"}</h2><div class="v2-form-grid"><label>Proveedor${sel("poSup", arr("suppliers").filter((s) => s.type !== "taller").map((s) => [s.id, s.name]).concat(arr("suppliers").filter((s) => s.type === "taller").map((s) => [s.id, s.name + " (taller)"])), po?.supplierId || "")}</label><label>Entrega esperada<input type="date" id="poExp" value="${esc(po?.expectedDate || addDays(7))}"></label></div><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Tipo</th><th>Producto / insumo</th><th>Color · talle</th><th>Cantidad</th><th>Costo unit.</th><th></th></tr></thead><tbody id="poRows"></tbody></table></div><div class="button-row" style="margin:8px 0"><button type="button" data-v3-porow-add>+ Agregar renglón</button><b id="poTotal" style="margin-left:auto"></b></div><label>Notas<input id="poNote" maxlength="300" value="${esc(po?.note || "")}"></label><div class="button-row"><button class="primary-button" type="button" data-v3-po-go="${esc(id)}:Pedida">${po ? "Guardar" : "Crear y marcar como pedida"}</button>${!po ? `<button type="button" data-v3-po-go=":Borrador">Guardar como borrador</button>` : ""}<button type="button" data-close-modal>Cancelar</button></div></div>`, true);
    drawPoRows();
  }
  function drawPoRows() {
    $("poRows").innerHTML = poDraftRows.map(poRowHtml).join("");
    const t = poDraftRows.reduce((s, r) => s + NUM(r.qty) * NUM(r.unitCost), 0);
    $("poTotal").textContent = `Total: ${money(t)}`;
  }
  function readPoRows() {
    qa("#poRows tr").forEach((tr) => { const i = +tr.dataset.row, r = poDraftRows[i]; qa("[data-f]", tr).forEach((el) => { r[el.dataset.f] = el.type === "number" ? NUM(el.value) : el.value; }); });
  }
  function receiveModal(id) {
    const po = arr("purchaseOrders").find((x) => x.id === id); if (!po) return;
    modal(`<div class="v2-form"><h2>Recibir mercadería · ${esc(po.number)}</h2><p>${esc(supplierName(po.supplierId))}. Cargá lo que llegó ahora: se suma al stock de prendas o insumos.</p><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Renglón</th><th style="text-align:right">Pedido</th><th style="text-align:right">Ya recibido</th><th>Recibo ahora</th></tr></thead><tbody>${po.items.map((it, i) => { const left = NUM(it.qty) - NUM(it.received); return `<tr><td>${esc(it.name || (it.kind === "insumo" ? "Insumo" : "Prenda"))}${it.color ? ` · ${esc(it.color)} ${esc(it.size)}` : ""}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${it.received || 0}</td><td><input type="number" min="0" max="${left}" step="1" value="${left}" data-v3-recv="${i}" ${left <= 0 ? "disabled" : ""} style="width:90px"></td></tr>`; }).join("")}</tbody></table></div><label class="check-row" style="margin-top:10px"><input type="checkbox" id="recvCost" checked> Actualizar el costo del producto/insumo con el de esta orden</label><div class="button-row"><button class="primary-button" type="button" data-v3-recv-go="${esc(id)}">Registrar recepción</button><button type="button" data-close-modal>Cancelar</button></div></div>`, true);
  }
  function payModal(kind, id) {
    const o = kind === "po" ? arr("purchaseOrders").find((x) => x.id === id) : arr("workOrders").find((x) => x.id === id); if (!o) return;
    const bal = kind === "po" ? NUM(o.total) - poPaid(o) : woTotal(o) - NUM(o.paid);
    modal(`<div class="v2-form"><h2>Registrar pago · ${esc(o.number)}</h2><p>Saldo: <b>${money(bal)}</b></p><div class="v2-form-grid"><label>Monto<input id="ppAmount" type="number" min="0.01" step="0.01" value="${Math.max(0, bal)}"></label>${kind === "po" ? `<label>Medio${sel("ppMethod", PAYMENT_METHODS.map((m) => [m, m]), "Transferencia")}</label><label>Fecha<input id="ppDate" type="date" value="${today()}"></label>` : ""}</div>${kind === "po" ? `<label>Detalle<input id="ppNote" maxlength="200"></label>` : ""}<div class="button-row"><button class="primary-button" type="button" data-v3-pay-go="${kind}:${esc(id)}">Registrar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  function poViewModal(id) {
    const po = arr("purchaseOrders").find((x) => x.id === id); if (!po) return;
    modal(`<div class="v2-form"><h2>${esc(po.number)} · ${esc(supplierName(po.supplierId))}</h2><p>${esc(po.status)} · ${dateLabel(po.date)}${po.expectedDate ? ` · esperada ${dateLabel(po.expectedDate)}` : ""}</p><div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Renglón</th><th style="text-align:right">Cant.</th><th style="text-align:right">Recibido</th><th style="text-align:right">Costo</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${po.items.map((it) => `<tr><td>${esc(it.name || it.kind)}${it.color ? ` · ${esc(it.color)} ${esc(it.size)}` : ""}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">${it.received || 0}</td><td style="text-align:right">${money(it.unitCost)}</td><td style="text-align:right">${money(it.qty * it.unitCost)}</td></tr>`).join("")}<tr><td colspan="4"><b>Total</b></td><td style="text-align:right"><b>${money(po.total)}</b></td></tr></tbody></table></div>
      <h3>Pagos</h3>${(po.payments || []).length ? `<div class="v2-mini-list">${po.payments.map((x) => `<div><span><b>${dateLabel(x.date)} · ${esc(x.method)}</b><small>${esc(x.note || "")} · ${esc(x.by || "")}</small></span><strong>${money(x.amount)}</strong>${can("purchases.manage") ? `<button class="danger" type="button" data-v3-popaydel="${esc(po.id)}:${esc(x.id)}">×</button>` : ""}</div>`).join("")}</div>` : `<p class="v2-help-text">Sin pagos registrados.</p>`}
      <p>Saldo: <b>${money(NUM(po.total) - poPaid(po))}</b></p><div class="button-row">${can("purchases.manage") && !["Recibida", "Cancelada"].includes(po.status) ? `<button type="button" data-v3-poedit="${esc(po.id)}">Editar</button>` : ""}${can("purchases.manage") && ["Borrador", "Pedida"].includes(po.status) ? `<button type="button" class="danger" data-v3-pocancel="${esc(po.id)}">Cancelar orden</button>` : ""}<button type="button" data-close-modal>Cerrar</button></div></div>`, true);
  }
  function woModal(id = "") {
    const w = arr("workOrders").find((x) => x.id === id) || {};
    const vendors = arr("suppliers").filter((s) => ["taller", "otro"].includes(s.type));
    if (!vendors.length) { toast("Primero cargá un taller en Proveedores (tipo «Taller externo»)."); buyTab = "prov"; renderBuy(); return; }
    modal(`<div class="v2-form"><h2>${id ? `Editar ${esc(w.number)}` : "Nueva orden de trabajo"}</h2><p>Para trabajos que hace un taller externo (bordado, estampado, costura).</p><div class="v2-form-grid"><label>Taller${sel("woVendor", vendors.map((s) => [s.id, s.name]), w.vendorId || "")}</label><label>Servicio${sel("woService", ["Bordado", "DTF / estampado", "Costura", "Corte", "Otro"].map((s) => [s, s]), w.service || "Bordado")}</label><label>Pedido relacionado${sel("woProp", [["", "— sin pedido —"], ...state.proposals.filter((p) => BILLED.includes(p.status) || p.status === "Borrador").map((p) => [p.id, `${p.publicId} · ${client(p.clientId).company || ""}`])], w.proposalId || "")}</label><label>Cantidad de prendas<input id="woQty" type="number" min="1" value="${w.qty || 10}"></label><label>Costo por prenda<input id="woCost" type="number" min="0" step="any" value="${NUM(w.unitCost)}"></label><label>Fecha de envío<input id="woSent" type="date" value="${esc(w.sentDate || today())}"></label><label>Debe volver el<input id="woDue" type="date" value="${esc(w.dueDate || addDays(7))}"></label></div><label>Notas<input id="woNote" maxlength="300" value="${esc(w.note || "")}"></label><div class="button-row"><button class="primary-button" type="button" data-v3-wo-go="${esc(id)}">Guardar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
  }
  UF3.views.compras = renderBuy;
  UF3.agendaHooks.push((items, push) => {
    if (!can("purchases.view")) return;
    const late = arr("workOrders").filter(woLate), probs = arr("workOrders").filter((w) => w.status === "Con problema"), low = arr("supplies").filter(supplyLow);
    if (late.length) push({ group: "entregas", level: "bad", tag: "Taller externo", title: `${late.length} trabajo(s) tercerizado(s) atrasado(s)`, sub: late.slice(0, 2).map((w) => `${w.number} · ${supplierName(w.vendorId)}`).join(" · "), acts: [{ label: "Ver talleres", main: true, attr: 'data-v3-gobuy="ot"' }] });
    if (probs.length) push({ group: "entregas", level: "warn", tag: "Taller externo", title: `${probs.length} trabajo(s) con problema`, sub: probs.slice(0, 2).map((w) => `${w.number} · ${supplierName(w.vendorId)}`).join(" · "), acts: [{ label: "Ver talleres", attr: 'data-v3-gobuy="ot"' }] });
    if (low.length) push({ group: "otros", level: "warn", tag: "Insumos", title: `${low.length} insumo(s) bajo el mínimo`, sub: low.slice(0, 3).map((s) => `${s.name} (${s.stock} ${s.unit})`).join(" · "), acts: [{ label: "Ver insumos", main: true, attr: 'data-v3-gobuy="ins"' }, can("purchases.manage") ? { label: "Nueva orden", attr: "data-v3-newpo" } : null] });
  });
  UF3.badgeHooks.push((set) => { set("compras", can("purchases.view") ? arr("workOrders").filter(woLate).length + arr("supplies").filter(supplyLow).length : 0, arr("workOrders").some(woLate)); });

  /* ================= TABLERO DE GERENCIA ================= */
  const monthKey = (d) => String(d).slice(0, 7);
  const eventAt = (p, to) => ((p.history || []).slice().reverse().find((h) => h.action === "Estado actualizado" && new RegExp(`→ ${to}$`).test(h.detail || "")) || {}).at || "";
  const daysBetween = (a, b) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
  const avg = (list) => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : null);
  const fmtDays = (v) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")} d`);
  function renderBoard() {
    if (!can("reports.view")) { $("view-tablero").innerHTML = `${viewHeader("Tablero", "")}<div class="v2-empty">No tenés permiso para ver los reportes.</div>`; return; }
    const props = state.proposals;
    const approved = props.filter((p) => BILLED.includes(p.status)).map((p) => ({ p, at: eventAt(p, "Aprobada") || p.artApproval?.recordedAt || `${p.createdDate}T12:00:00` }));
    const months = []; const base = new Date(); base.setDate(1);
    for (let i = 11; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
    const sales = Object.fromEntries(months.map((m) => [m, 0])); approved.forEach(({ p, at }) => { const k = monthKey(at.slice(0, 10)); if (k in sales) sales[k] += totals(p).total; });
    const maxSale = Math.max(1, ...Object.values(sales));
    const thisM = months[11], prevM = months[10];
    const mName = (m) => new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(`${m}-01T12:00:00`)).replace(".", "");
    const sent = props.filter((p) => p.status !== "Borrador");
    const closed = sent.filter((p) => BILLED.includes(p.status)).length, lost = sent.filter((p) => p.status === "Rechazada").length;
    const closeRate = closed + lost ? Math.round((closed / (closed + lost)) * 100) : null;
    const cycleApprove = avg(approved.map(({ p, at }) => daysBetween(`${p.createdDate}T12:00:00`, at)).filter((v) => v < 400));
    const stages = [["Aprobada → En producción", "Aprobada", "En producción"], ["En producción → Lista", "En producción", "Lista"], ["Lista → Entregada", "Lista", "Entregada"]].map(([label, a, b]) => ({ label, v: avg(props.map((p) => { const x = eventAt(p, a), y = eventAt(p, b); return x && y ? daysBetween(x, y) : null; }).filter((v) => v !== null)) }));
    const rate = NUM(state.settings.commissionRate);
    const bySeller = {}; approved.forEach(({ p }) => { const k = p.ownerId || "—"; const s = bySeller[k] || (bySeller[k] = { n: 0, sales: 0, paid: 0 }); s.n++; s.sales += totals(p).total; s.paid += totals(p).paid; });
    const sellers = Object.entries(bySeller).sort((a, b) => b[1].sales - a[1].sales);
    const byClient = {}; approved.forEach(({ p }) => { const k = client(p.clientId).company || "—"; byClient[k] = (byClient[k] || 0) + totals(p).total; });
    const surveys = props.filter((p) => p.survey && p.survey.rating);
    const nps = surveys.length ? (surveys.reduce((s, p) => s + p.survey.rating, 0) / surveys.length).toFixed(1).replace(".", ",") : "—";
    const leads = arr("leads"), conv = leads.length ? Math.round((leads.filter((l) => l.status === "Convertido").length / leads.length) * 100) : null;
    const bar = (v, max, cls = "") => `<i class="${cls}" style="width:${Math.max(2, Math.round((v / Math.max(1, max)) * 100))}%"></i>`;
    $("view-tablero").innerHTML = `<div class="page-heading"><div><h1>${ico("gauge", 25)} Tablero de gerencia</h1><p>Cómo viene el negocio: ventas, cierre de presupuestos, tiempos del taller, vendedores y satisfacción.</p></div></div>
      <div class="v3-kpis"><div class="v3-kpi good"><small>Ventas del mes</small><strong>${money(sales[thisM])}</strong><em>mes anterior ${money(sales[prevM])}${sales[prevM] ? ` (${sales[thisM] >= sales[prevM] ? "+" : ""}${Math.round(((sales[thisM] - sales[prevM]) / sales[prevM]) * 100)}%)` : ""}</em></div><div class="v3-kpi"><small>Tasa de cierre</small><strong>${closeRate === null ? "—" : closeRate + "%"}</strong><em>${closed} aprobadas · ${lost} perdidas</em></div><div class="v3-kpi"><small>Del presupuesto a la aprobación</small><strong>${fmtDays(cycleApprove)}</strong><em>promedio</em></div><div class="v3-kpi ${nps !== "—" && Number(nps.replace(",", ".")) < 4 ? "warn" : "good"}"><small>Satisfacción</small><strong>${nps}${nps === "—" ? "" : " / 5"}</strong><em>${surveys.length} encuesta(s)${conv === null ? "" : ` · web: ${conv}% convertidas`}</em></div></div>
      <div class="v2-two"><section class="surface"><h2>Ventas aprobadas por mes</h2><div class="v3-bars">${months.map((m) => `<div class="v3-bar"><span class="v3-barv">${sales[m] ? money(sales[m]).replace("$ ", "$") : ""}</span><div class="v3-barfill ${m === thisM ? "now" : ""}" style="height:${Math.max(2, Math.round((sales[m] / maxSale) * 100))}%"></div><small>${mName(m)}</small></div>`).join("")}</div></section>
      <section class="surface"><h2>Tiempo en cada etapa</h2>${stages.map((s) => `<div class="v2-report-line"><span>${s.label}</span><b>${fmtDays(s.v)}</b></div>`).join("")}<p class="v2-help-text">Se calcula con los cambios de estado registrados en cada propuesta.</p><h2 style="margin-top:16px">Clientes que más compran</h2>${Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `<div class="v3-hbar"><span>${esc(k)}</span><div>${bar(v, Math.max(...Object.values(byClient)))}</div><b>${money(v)}</b></div>`).join("") || `<div class="v2-empty">Sin ventas todavía.</div>`}</section></div>
      <section class="surface report-block"><div class="section-row"><div><h2>Vendedores</h2><p>Ventas aprobadas y cobrado validado${rate ? `. Comisión calculada: ${rate}% sobre lo cobrado validado` : ". Para ver comisiones, cargá el porcentaje en Configuración"}.</p></div></div>
      ${sellers.length ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Vendedor</th><th style="text-align:right">Pedidos</th><th style="text-align:right">Ventas</th><th style="text-align:right">Cobrado validado</th>${rate ? `<th style="text-align:right">Comisión</th>` : ""}</tr></thead><tbody>${sellers.map(([id, s]) => `<tr><td><b>${esc(UF3.userNames[id] || "Sin asignar")}</b></td><td style="text-align:right">${s.n}</td><td style="text-align:right">${money(s.sales)}</td><td style="text-align:right">${money(s.paid)}</td>${rate ? `<td style="text-align:right"><b>${money(s.paid * rate / 100)}</b></td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<div class="v3-empty"><b>Sin ventas aprobadas</b></div>`}</section>`;
  }
  UF3.views.tablero = renderBoard;

  /* ================= eventos ================= */
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const lt = t.closest("[data-v3-leadtab]"); if (lt) { leadTab = lt.dataset.v3Leadtab; return renderLeads(); }
    const lc = t.closest("[data-v3-leadconv]"); if (lc) return convertLead(lc.dataset.v3Leadconv);
    const ls = t.closest("[data-v3-leadset]"); if (ls) { const [id, st] = ls.dataset.v3Leadset.split(":"); try { await api("lead_update", { id, status: st }); toast("Consulta actualizada."); renderLeads(); } catch (er) { toast(er.message); } return; }
    const bt = t.closest("[data-v3-buytab]"); if (bt) { buyTab = bt.dataset.v3Buytab; return renderBuy(); }
    const gb = t.closest("[data-v3-gobuy]"); if (gb) { buyTab = gb.dataset.v3Gobuy; return go("compras"); }
    if (t.closest("[data-v3-newpo]")) return poModal();
    if (t.closest("[data-v3-newwo]")) return woModal();
    if (t.closest("[data-v3-newsup]")) return supplierModal();
    if (t.closest("[data-v3-newsupply]")) return supplyModal();
    const es = t.closest("[data-v3-editsup]"); if (es) return supplierModal(es.dataset.v3Editsup);
    const ds = t.closest("[data-v3-delsup]"); if (ds) { if (!confirm("¿Borrar este proveedor?")) return; try { await api("supplier_delete", { id: ds.dataset.v3Delsup }); renderBuy(); } catch (er) { toast(er.message); } return; }
    const sg = t.closest("[data-v3-sup-go]"); if (sg) { const name = $("sName").value.trim(); if (!name) { toast("Poné un nombre."); return; } return saveEntity("supplier_save", { supplier: { id: sg.dataset.v3SupGo, name, type: $("sType").value, contact: $("sContact").value, phone: $("sPhone").value, email: $("sEmail").value, cuit: $("sCuit").value, note: $("sNote").value } }, "Guardado."); }
    const esu = t.closest("[data-v3-editsupply]"); if (esu) return supplyModal(esu.dataset.v3Editsupply);
    const sug = t.closest("[data-v3-supply-go]"); if (sug) { const name = $("iName").value.trim(); if (!name) { toast("Poné un nombre."); return; } return saveEntity("supply_save", { supply: { id: sug.dataset.v3SupplyGo, name, unit: $("iUnit").value, stock: $("iStock")?.value, min: $("iMin").value, cost: $("iCost").value } }, "Insumo guardado."); }
    const sm = t.closest("[data-v3-supmove]"); if (sm) return supplyMoveModal(sm.dataset.v3Supmove);
    const mg = t.closest("[data-v3-move-go]"); if (mg) return saveEntity("supply_move", { id: mg.dataset.v3MoveGo, qty: NUM($("mQty").value), reason: $("mReason").value, note: $("mNote").value }, "Movimiento registrado.");
    if (t.closest("[data-v3-porow-add]")) { readPoRows(); poDraftRows.push({ kind: "prenda", qty: 10, unitCost: 0 }); return drawPoRows(); }
    const pd = t.closest("[data-v3-porow-del]"); if (pd) { readPoRows(); poDraftRows.splice(+pd.dataset.v3PorowDel, 1); if (!poDraftRows.length) poDraftRows.push({ kind: "prenda", qty: 1, unitCost: 0 }); return drawPoRows(); }
    const pg = t.closest("[data-v3-po-go]");
    if (pg) {
      readPoRows(); const [id, status] = pg.dataset.v3PoGo.split(":");
      const items = poDraftRows.filter((r) => NUM(r.qty) > 0).map((r) => { const prod = state.products.find((p) => p.id === r.productId), sup = arr("supplies").find((s) => s.id === r.supplyId); return { ...r, name: r.kind === "insumo" ? (sup?.name || "Insumo") : (prod?.name || "Prenda") }; });
      return saveEntity("po_save", { po: { id, supplierId: $("poSup").value, expectedDate: $("poExp").value, note: $("poNote").value, status, items } }, "Orden guardada.");
    }
    const pe = t.closest("[data-v3-poedit]"); if (pe) return poModal(pe.dataset.v3Poedit);
    const pv = t.closest("[data-v3-poview]"); if (pv) return poViewModal(pv.dataset.v3Poview);
    const po = t.closest("[data-v3-poorder]"); if (po) { const o = arr("purchaseOrders").find((x) => x.id === po.dataset.v3Poorder); if (o) await saveEntity("po_save", { po: { ...o, status: "Pedida" } }, "Orden marcada como pedida."); return; }
    const pr = t.closest("[data-v3-porec]"); if (pr) return receiveModal(pr.dataset.v3Porec);
    const rg = t.closest("[data-v3-recv-go]"); if (rg) return saveEntity("po_receive", { id: rg.dataset.v3RecvGo, updateCost: $("recvCost").checked, lines: qa("[data-v3-recv]").map((i) => ({ index: +i.dataset.v3Recv, qty: NUM(i.value) })) }, "Recepción registrada: el stock se actualizó.");
    const pp = t.closest("[data-v3-popay]"); if (pp) return payModal("po", pp.dataset.v3Popay);
    const wp = t.closest("[data-v3-wopay]"); if (wp) return payModal("wo", wp.dataset.v3Wopay);
    const pgo = t.closest("[data-v3-pay-go]");
    if (pgo) { const [kind, id] = pgo.dataset.v3PayGo.split(":"); return saveEntity(kind === "po" ? "po_payment" : "wo_pay", { id, amount: NUM($("ppAmount").value), method: $("ppMethod")?.value, date: $("ppDate")?.value, note: $("ppNote")?.value }, "Pago registrado."); }
    const pdel = t.closest("[data-v3-popaydel]"); if (pdel) { if (!confirm("¿Eliminar este pago a proveedor?")) return; const [id, paymentId] = pdel.dataset.v3Popaydel.split(":"); return saveEntity("po_payment_delete", { id, paymentId }, "Pago eliminado."); }
    const pc = t.closest("[data-v3-pocancel]"); if (pc) { if (!confirm("¿Cancelar esta orden de compra?")) return; return saveEntity("po_cancel", { id: pc.dataset.v3Pocancel }, "Orden cancelada."); }
    const ew = t.closest("[data-v3-editwo]"); if (ew) return woModal(ew.dataset.v3Editwo);
    const wg = t.closest("[data-v3-wo-go]"); if (wg) return saveEntity("wo_save", { wo: { id: wg.dataset.v3WoGo, vendorId: $("woVendor").value, service: $("woService").value, proposalId: $("woProp").value, qty: NUM($("woQty").value), unitCost: NUM($("woCost").value), sentDate: $("woSent").value, dueDate: $("woDue").value, note: $("woNote").value } }, "Orden de trabajo guardada.");
  });
  document.addEventListener("change", async (e) => {
    const s = e.target.closest ? e.target.closest("[data-v3-wostatus]") : null;
    if (s) { try { await api("wo_status", { id: s.dataset.v3Wostatus, status: s.value }); toast("Estado actualizado."); renderBuy(); } catch (er) { toast(er.message); } return; }
    const row = e.target.closest ? e.target.closest("#poRows [data-f]") : null;
    if (row && ["kind", "productId", "supplyId"].includes(row.dataset.f)) { readPoRows(); const i = +row.closest("tr").dataset.row; if (row.dataset.f === "kind") { poDraftRows[i].productId = ""; poDraftRows[i].supplyId = ""; poDraftRows[i].color = ""; poDraftRows[i].size = ""; } if (row.dataset.f === "productId") { const prod = state.products.find((p) => p.id === row.value); if (prod && !NUM(poDraftRows[i].unitCost)) poDraftRows[i].unitCost = NUM(prod.unitCost); poDraftRows[i].color = ""; poDraftRows[i].size = ""; } if (row.dataset.f === "supplyId") { const su = arr("supplies").find((x) => x.id === row.value); if (su && !NUM(poDraftRows[i].unitCost)) poDraftRows[i].unitCost = NUM(su.cost); } drawPoRows(); }
  });
  document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest("#poRows")) { readPoRows(); const t = poDraftRows.reduce((s, r) => s + NUM(r.qty) * NUM(r.unitCost), 0); const el = $("poTotal"); if (el) el.textContent = `Total: ${money(t)}`; } });
})();
