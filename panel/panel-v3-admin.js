/* UNIFORMA ERP — Administración (validación de pagos) y Manuales de uso.
   Se carga después de panel-v3.js y se engancha a su registro (window.UF3). */
(() => {
  "use strict";
  const UF3 = window.UF3;
  if (!UF3) return;
  const { svg, ico, payStatus } = UF3;

  const STATUS_LABEL = { pending: "Pendiente de validación", validated: "Validado", rejected: "Rechazado", voided: "Anulado" };
  const SHORT_LABEL = { pending: "Por validar", validated: "Validado", rejected: "Rechazado", voided: "Anulado" };
  const NUM = (n) => Number(n || 0);
  const whoShort = (s) => esc(String(s || "—"));
  const stamp = (iso) => (iso ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const ls = {
    get(k, d) { try { const v = localStorage.getItem("uf-v3-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("uf-v3-" + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };

  /* ---------- acciones de revisión ---------- */
  async function reviewPayments(decision, items, note = "") {
    const data = await api("review_payments", { decision, items, note });
    const r = data.review || { done: 0, skipped: 0 };
    const word = { validated: "validado(s)", rejected: "rechazado(s)", void: "anulado(s)" }[decision];
    toast(r.done ? `${r.done} pago(s) ${word}.${r.skipped ? ` ${r.skipped} ya estaba(n) procesado(s).` : ""}` : "Esos pagos ya estaban procesados.");
    selected.clear();
    if (currentView === "propuestas" && $("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(proposal());
    else renderView();
    return r;
  }
  let reviewCtx = null;
  function askReason(decision, items) {
    reviewCtx = { decision, items };
    const title = decision === "void" ? "Anular pago validado" : "Rechazar pago";
    const hint = decision === "void"
      ? "El pago deja de sumar al saldo y queda en el historial como «Anulado». Escribí por qué."
      : "Quien lo cargó verá este motivo, podrá corregirlo y el pago volverá a quedar pendiente.";
    modal(`<div class="v2-form"><h2>${title}</h2><p>${hint}</p><label>Motivo (obligatorio)<textarea id="v3ReviewNote" rows="3" maxlength="300" placeholder="Ej.: no figura la transferencia en el banco"></textarea></label><div class="button-row"><button class="primary-button" type="button" data-v3-review-go>Confirmar</button><button type="button" data-close-modal>Cancelar</button></div></div>`);
    setTimeout(() => $("v3ReviewNote")?.focus(), 50);
  }

  /* ---------- filas de pagos dentro de la propuesta ---------- */
  paymentRows = function (item) {
    if (!item.payments.length) return empty("No hay pagos registrados.");
    const canV = can("payments.validate"), canEdit = can("proposals.manage");
    return `<div class="v2-mini-list v2-payments">${item.payments.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((p) => {
      const st = payStatus(p), key = `${item.id}:${p.id}`;
      const meta = [p.registeredBy ? `Cargó ${esc(p.registeredBy)}${p.registeredAt ? " · " + stamp(p.registeredAt) : ""}` : "", st === "validated" && p.validatedBy ? `Validó ${esc(p.validatedBy)} · ${stamp(p.validatedAt)}` : "", st === "rejected" ? `Rechazó ${esc(p.validatedBy || "")} · ${stamp(p.validatedAt)}` : "", st === "voided" ? `Anuló ${esc(p.voidedBy || "")} · ${stamp(p.voidedAt)}` : ""].filter(Boolean).join(" · ");
      const reason = (st === "rejected" || st === "voided") && p.reviewNote ? `<small class="v3-pay-reason">Motivo: ${esc(p.reviewNote)}</small>` : "";
      return `<div class="v3-pay ${st}"><span><b>${dateLabel(p.date)} · ${esc(p.type || "Pago")}</b> <i class="v3-paystatus ${st}">${STATUS_LABEL[st]}</i><small>${esc(p.method)}${p.reference ? ` · Ref. ${esc(p.reference)}` : ""}${p.note ? ` · ${esc(p.note)}` : ""}</small>${meta ? `<small>${meta}</small>` : ""}${reason}</span><strong class="${st === "voided" || st === "rejected" ? "struck" : ""}">${money(p.amount)}</strong><div class="button-row">${p.receiptData ? `<a class="v2-button-link" href="${esc(p.receiptData)}" download="${esc(p.receiptName || "comprobante")}">Comprobante</a>` : ""}${canV && st === "pending" ? `<button class="v3-ok" data-v3-pay="validated:${esc(key)}" type="button">Validar</button><button class="danger" data-v3-pay="rejected:${esc(key)}" type="button">Rechazar</button>` : ""}${st === "validated" ? `<button data-v3-receipt="${esc(key)}" type="button">Recibo</button>` : ""}${canV && st === "validated" ? `<button class="danger" data-v3-pay="void:${esc(key)}" type="button">Anular</button>` : ""}${canEdit && (st === "pending" || st === "rejected") ? `<button data-edit-payment="${esc(key)}" type="button">${st === "rejected" ? "Corregir" : "Editar"}</button><button class="danger" data-delete-payment="${esc(key)}" type="button" title="Eliminar">×</button>` : ""}</div></div>`;
    }).join("")}</div>`;
  };

  const basePaymentModal = paymentModal;
  paymentModal = function (id, paymentId = "") {
    const item = proposal(id), ex = (item?.payments || []).find((e) => e.id === paymentId);
    if (ex && ["validated", "voided"].includes(payStatus(ex))) { toast("Un pago validado no se edita. Si hay un error, Administración lo anula con motivo y se carga de nuevo."); return; }
    basePaymentModal(id, paymentId);
    const form = q("#paymentFormV2");
    if (!form) return;
    const note = ex && payStatus(ex) === "rejected"
      ? `Este pago fue rechazado: «${esc(ex.reviewNote || "sin motivo")}». Al guardar los cambios vuelve a quedar pendiente de validación.`
      : "El pago queda <b>pendiente de validación</b>: no baja el saldo hasta que Administración lo confirme.";
    q(".v2-payment-summary", form)?.insertAdjacentHTML("afterend", `<p class="v3-note">${note}</p>`);
  };

  /* ---------- reportes (cobrado solo validado) ---------- */
  renderReports = function () {
    const billed = ["Aprobada", "En producción", "Lista", "Entregada"];
    const rows = state.proposals.filter((p) => billed.includes(p.status));
    const sales = rows.reduce((s, p) => s + totals(p).total, 0);
    const paid = state.proposals.reduce((s, p) => s + totals(p).paid, 0);
    const pend = state.proposals.reduce((s, p) => s + totals(p).pending, 0);
    const outstanding = rows.reduce((s, p) => s + totals(p).balance, 0);
    const byMethod = {};
    state.proposals.forEach((p) => (p.payments || []).filter((x) => payStatus(x) === "validated").forEach((x) => { byMethod[x.method || "Otro"] = (byMethod[x.method || "Otro"] || 0) + NUM(x.amount); }));
    const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
    $("view-reportes").innerHTML = `${viewHeader("Reportes", "Resultados comerciales, cobranzas y entregas. «Cobrado» cuenta solo pagos validados.")}
      <div class="v3-kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))"><div class="v3-kpi"><small>Ventas aprobadas</small><strong>${money(sales)}</strong></div><div class="v3-kpi good"><small>Cobrado (validado)</small><strong>${money(paid)}</strong></div><div class="v3-kpi ${pend ? "warn" : ""}"><small>Por validar</small><strong>${money(pend)}</strong></div><div class="v3-kpi ${outstanding ? "warn" : "good"}"><small>Por cobrar</small><strong>${money(outstanding)}</strong></div><div class="v3-kpi"><small>Clientes</small><strong>${state.clients.length}</strong></div></div>
      <div class="v2-two"><section class="surface"><h2>Propuestas por estado</h2>${STATUS.map((status) => `<div class="v2-report-line"><span>${status}</span><b>${state.proposals.filter((p) => p.status === status).length}</b></div>`).join("")}</section>
        <section class="surface"><h2>Cobrado por medio de pago</h2>${methods.length ? methods.map(([m, v]) => `<div class="v2-report-line"><span>${esc(m)}</span><b>${money(v)}</b></div>`).join("") : `<div class="v2-empty">Todavía no hay pagos validados.</div>`}</section></div>
      <section class="surface report-block"><div class="section-row"><h2>Próximas entregas</h2></div>${proposalRows(state.proposals.filter((p) => p.deliveryDate && !["Entregada", "Rechazada"].includes(p.status)).sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)).slice(0, 8))}</section>
      <section class="surface report-block"><h2>Actividad reciente</h2>${historyRows(state.auditLog)}</section>`;
  };

  /* ---------- pantalla Pagos ---------- */
  let payTab = "pending", payPeriod = "month", payQuery = "";
  const selected = new Set();
  const TABS = [["pending", "Por validar"], ["validated", "Validados"], ["rejected", "Rechazados"], ["voided", "Anulados"], ["all", "Todos"]];
  const PERIODS = [["today", "Hoy"], ["week", "Esta semana"], ["month", "Este mes"], ["all", "Todo"]];

  function inPeriod(dateStr) {
    if (payPeriod === "all" || !dateStr) return true;
    const t = today();
    if (payPeriod === "today") return dateStr === t;
    if (payPeriod === "month") return dateStr.slice(0, 7) === t.slice(0, 7);
    const d = new Date(`${t}T12:00:00`), dow = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - dow);
    return dateStr >= start.toISOString().slice(0, 10) && dateStr <= t;
  }
  function allPayments() {
    return state.proposals.flatMap((p) => (p.payments || []).map((x) => ({ p, x, st: payStatus(x), c: client(p.clientId) })));
  }
  function baseRows() {
    const terms = searchText(payQuery).split(/\s+/).filter(Boolean);
    return allPayments().filter((r) => inPeriod(r.x.date) && terms.every((t) => searchText(`${r.p.publicId} ${r.c.company} ${r.c.contact} ${r.x.reference} ${r.x.method} ${r.x.type} ${r.x.registeredBy}`).includes(t)));
  }
  const sumOf = (rows) => rows.reduce((s, r) => s + NUM(r.x.amount), 0);

  function renderPayments() {
    if (!can("payments.view")) { $("view-pagos").innerHTML = `${viewHeader("Pagos", "")}<div class="v2-empty">No tenés permiso para ver los pagos.</div>`; return; }
    const canV = can("payments.validate");
    $("view-pagos").innerHTML = `
      <div class="page-heading"><div><h1>${ico("card", 25)} Pagos</h1><p>Un pago no baja el saldo hasta que Administración lo valida.${canV ? "" : " Tu rol puede consultar, no validar."}</p></div>
        <div class="button-row"><button type="button" data-v3-manual="administracion">${svg("book", 16)} Manual de Administración</button><button type="button" data-v3-pay-csv>Descargar CSV</button></div></div>
      <div id="v3PayKpis"></div>
      <section class="surface"><div class="v2-toolbar" style="padding:0;margin-bottom:12px"><input id="v3PaySearch" type="search" placeholder="Buscar por propuesta, cliente, referencia, medio o quién lo cargó" value="${esc(payQuery)}"><select id="v3PayPeriod" aria-label="Período">${PERIODS.map(([k, l]) => `<option value="${k}" ${k === payPeriod ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div id="v3PayTabs"></div><div id="v3PayBulk"></div><div id="v3PayTable"></div></section>`;
    renderPayParts();
  }
  function renderPayParts() {
    const base = baseRows();
    const by = (st) => base.filter((r) => r.st === st);
    const validatedAll = allPayments().filter((r) => r.st === "validated" && inPeriod(r.x.date));
    const methods = {};
    validatedAll.forEach((r) => { methods[r.x.method || "Otro"] = (methods[r.x.method || "Otro"] || 0) + NUM(r.x.amount); });
    const topMethods = Object.entries(methods).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const pendAll = allPayments().filter((r) => r.st === "pending");
    $("v3PayKpis").innerHTML = `<div class="v3-kpis">
      <div class="v3-kpi ${pendAll.length ? "warn" : "good"}"><small>Por validar (todas las fechas)</small><strong>${money(sumOf(pendAll))}</strong><em>${pendAll.length} pago(s)</em></div>
      <div class="v3-kpi good"><small>Validado en el período</small><strong>${money(sumOf(by("validated")))}</strong><em>${by("validated").length} pago(s)</em></div>
      <div class="v3-kpi ${by("rejected").length ? "bad" : ""}"><small>Rechazado en el período</small><strong>${by("rejected").length}</strong><em>${money(sumOf(by("rejected")))}</em></div>
      <div class="v3-kpi"><small>Cobrado por medio</small>${topMethods.length ? `<div class="v3-methods">${topMethods.map(([m, v]) => `<span>${esc(m)} <b>${money(v)}</b></span>`).join("")}</div>` : `<em>Sin pagos validados</em>`}</div></div>`;
    $("v3PayTabs").innerHTML = `<div class="v3-chips">${TABS.map(([k, l]) => { const rows = k === "all" ? base : by(k); return `<button type="button" class="v3-chip ${payTab === k ? "on" : ""}" data-v3-paytab="${k}">${l}<b>${rows.length}</b></button>`; }).join("")}</div>`;
    renderPayTable();
  }
  function currentRows() {
    const base = baseRows();
    const rows = payTab === "all" ? base : base.filter((r) => r.st === payTab);
    return rows.sort((a, b) => String(b.x.date).localeCompare(String(a.x.date)) || String(b.x.registeredAt || "").localeCompare(String(a.x.registeredAt || "")));
  }
  function renderPayTable() {
    const rows = currentRows(), canV = can("payments.validate");
    const key = (r) => `${r.p.id}:${r.x.id}`;
    const selectable = canV && payTab === "pending";
    [...selected].forEach((k) => { if (!rows.some((r) => key(r) === k)) selected.delete(k); });
    const picked = rows.filter((r) => selected.has(key(r)));
    $("v3PayBulk").innerHTML = selectable && picked.length ? `<div class="v3-bulk"><b>${picked.length}</b> seleccionado(s) · ${money(sumOf(picked))}<span class="v3-spacer"></span><button class="primary-button" type="button" data-v3-bulk="validated">Validar seleccionados</button><button type="button" data-v3-bulk="rejected" class="danger">Rechazar…</button></div>` : "";
    if (!rows.length) { $("v3PayTable").innerHTML = `<div class="v3-empty"><b>${payTab === "pending" ? "No hay pagos por validar" : "Sin resultados"}</b>${payTab === "pending" ? "Cuando alguien registre un pago aparece acá." : "Probá con otro período, pestaña o búsqueda."}</div>`; return; }
    $("v3PayTable").innerHTML = `<div class="v2-table-wrap"><table class="v2-data-table v3-paytable"><thead><tr>${selectable ? `<th><input type="checkbox" data-v3-paysel-all aria-label="Seleccionar todos" ${picked.length === rows.length ? "checked" : ""}></th>` : ""}<th>Fecha</th><th>Propuesta</th><th>Cliente</th><th>Tipo</th><th>Medio · Ref.</th><th style="text-align:right">Monto</th><th>Cargó</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map((r) => {
      const { p, x, st, c } = r, k = key(r);
      const detail = st === "validated" ? `Validó ${whoShort(x.validatedBy)} · ${stamp(x.validatedAt)}` : st === "rejected" ? `Rechazó ${whoShort(x.validatedBy)}: ${esc(x.reviewNote || "")}` : st === "voided" ? `Anuló ${whoShort(x.voidedBy)}: ${esc(x.reviewNote || "")}` : "";
      return `<tr class="v3-row-${st}">${selectable ? `<td><input type="checkbox" data-v3-paysel="${esc(k)}" ${selected.has(k) ? "checked" : ""} aria-label="Seleccionar pago"></td>` : ""}<td>${dateLabel(x.date)}</td><td><button type="button" class="v3-linkbtn" data-open-proposal="${esc(p.id)}">${esc(p.publicId)}</button></td><td>${esc(c.company || "")}</td><td>${esc(x.type || "Pago")}</td><td>${esc(x.method || "")}${x.reference ? `<small> · ${esc(x.reference)}</small>` : ""}</td><td style="text-align:right"><b>${money(x.amount)}</b></td><td>${whoShort(x.registeredBy || x.createdBy)}</td><td><i class="v3-paystatus ${st}">${SHORT_LABEL[st]}</i>${detail ? `<small class="v3-detail">${detail}</small>` : ""}</td><td><div class="button-row">${x.receiptData ? `<a class="v2-button-link" href="${esc(x.receiptData)}" download="${esc(x.receiptName || "comprobante")}">Comprobante</a>` : ""}${canV && st === "pending" ? `<button class="v3-ok" data-v3-pay="validated:${esc(k)}" type="button">Validar</button><button class="danger" data-v3-pay="rejected:${esc(k)}" type="button">Rechazar</button>` : ""}${st === "validated" ? `<button data-v3-receipt="${esc(k)}" type="button">Recibo</button>` : ""}${canV && st === "validated" ? `<button class="danger" data-v3-pay="void:${esc(k)}" type="button">Anular</button>` : ""}</div></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function exportPaymentsCsv() {
    const lines = [["Fecha", "Propuesta", "Cliente", "Tipo", "Medio", "Referencia", "Monto", "Cargó", "Estado", "Revisó", "Fecha revisión", "Motivo"], ...currentRows().map((r) => [r.x.date, r.p.publicId, r.c.company || "", r.x.type || "", r.x.method || "", r.x.reference || "", NUM(r.x.amount), r.x.registeredBy || r.x.createdBy || "", STATUS_LABEL[r.st], r.x.validatedBy || r.x.voidedBy || "", (r.x.validatedAt || r.x.voidedAt || "").slice(0, 16).replace("T", " "), r.x.reviewNote || ""])];
    const csv = "﻿" + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `uniforma-pagos-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  /* ---------- manuales ---------- */
  let manualKey = ls.get("manual", "");
  async function renderManual() {
    const root = $("view-manual");
    root.innerHTML = `<div class="page-heading"><div><h1>${ico("book", 25)} Manuales de uso</h1><p>La guía de tu puesto, con la rutina del día y el paso a paso.</p></div></div><div class="v3-empty">Cargando manuales…</div>`;
    let list;
    try {
      const res = await fetch("manual.php?list=1", { credentials: "same-origin" });
      list = (await res.json()).manuals || [];
    } catch (e) { root.innerHTML += `<div class="v2-empty">No se pudieron cargar los manuales.</div>`; return; }
    if (!list.length) { root.innerHTML = `<div class="v2-empty">No hay manuales para tu puesto.</div>`; return; }
    if (!list.some((m) => m.key === manualKey)) manualKey = list[0].key;
    let html = "";
    try {
      const res = await fetch("manual.php?m=" + encodeURIComponent(manualKey), { credentials: "same-origin" });
      html = res.ok ? await res.text() : `<p>No se pudo cargar este manual.</p>`;
    } catch (e) { html = `<p>No se pudo cargar este manual.</p>`; }
    const cur = list.find((m) => m.key === manualKey);
    root.innerHTML = `<div class="page-heading"><div><h1>${ico("book", 25)} Manuales de uso</h1><p>${esc(cur.description)}</p></div><label class="v3-mansearch"><input id="v3ManSearch" type="search" placeholder="Buscar en este manual…" autocomplete="off"></label></div>
      <div class="v3-chips">${list.map((m) => `<button type="button" class="v3-chip ${m.key === manualKey ? "on" : ""}" data-v3-manual="${esc(m.key)}">${esc(m.title)}</button>`).join("")}</div>
      <div class="v3-manual"><nav class="v3-toc" id="v3Toc" aria-label="Índice"></nav><article class="manual" id="v3ManBody">${html}</article></div>`;
    enhanceManual();
  }
  function enhanceManual() {
    const body = $("v3ManBody"), toc = $("v3Toc");
    if (!body) return;
    const sections = qa("section[id]", body);
    toc.innerHTML = `<b>En este manual</b>` + sections.map((s) => `<a href="#${esc(s.id)}" data-v3-toc="${esc(s.id)}">${esc(q("h2", s)?.textContent || s.id)}</a>`).join("");
    const dayKey = `routine-${manualKey}-${today()}`;
    const done = new Set(ls.get(dayKey, []));
    qa("ul.m-routine li", body).forEach((li, i) => {
      const id = String(i);
      li.innerHTML = `<label><input type="checkbox" data-v3-routine="${id}" ${done.has(id) ? "checked" : ""}><span>${li.innerHTML}</span></label>`;
      li.classList.toggle("done", done.has(id));
    });
    const input = $("v3ManSearch");
    input?.addEventListener("input", () => {
      const terms = searchText(input.value).split(/\s+/).filter(Boolean);
      let shown = 0;
      sections.forEach((s) => {
        const hit = !terms.length || terms.every((t) => searchText(s.textContent).includes(t));
        s.hidden = !hit; if (hit) shown++;
        qa("details", s).forEach((d) => { d.open = terms.length > 0 && hit && terms.every((t) => searchText(d.textContent).includes(t)); });
      });
      qa("a[data-v3-toc]", toc).forEach((a) => { const s = $(a.dataset.v3Toc); a.hidden = !!(s && s.hidden); });
      let none = $("v3ManNone");
      if (!shown) { if (!none) body.insertAdjacentHTML("beforeend", `<div class="v3-empty" id="v3ManNone"><b>Sin resultados</b>Probá con otra palabra.</div>`); } else none?.remove();
    });
  }
  UF3.openManual = (key) => { if (key) { manualKey = key; ls.set("manual", key); } go("manual"); };

  /* ---------- eventos ---------- */
  document.addEventListener("click", async (e) => {
    const t = e.target;
    const pay = t.closest("[data-v3-pay]");
    if (pay) {
      const [decision, proposalId, paymentId] = pay.dataset.v3Pay.split(":");
      const items = [{ proposalId, paymentId }];
      if (decision === "validated") { try { await reviewPayments("validated", items); } catch (err) { toast(err.message); } } else askReason(decision, items);
      return;
    }
    if (t.closest("[data-v3-review-go]")) {
      const note = ($("v3ReviewNote")?.value || "").trim();
      if (note.length < 3) { toast("Escribí el motivo (mínimo 3 caracteres)."); $("v3ReviewNote")?.focus(); return; }
      const ctx = reviewCtx; reviewCtx = null;
      try { await reviewPayments(ctx.decision, ctx.items, note); closeModal(); } catch (err) { toast(err.message); }
      return;
    }
    const bulk = t.closest("[data-v3-bulk]");
    if (bulk) {
      const items = [...selected].map((k) => { const [proposalId, paymentId] = k.split(":"); return { proposalId, paymentId }; });
      if (!items.length) return;
      if (bulk.dataset.v3Bulk === "validated") { try { await reviewPayments("validated", items); } catch (err) { toast(err.message); } } else askReason("rejected", items);
      return;
    }
    const tab = t.closest("[data-v3-paytab]"); if (tab) { payTab = tab.dataset.v3Paytab; selected.clear(); return renderPayParts(); }
    if (t.closest("[data-v3-pay-csv]")) return exportPaymentsCsv();
    const man = t.closest("[data-v3-manual]"); if (man) { UF3.openManual(man.dataset.v3Manual); return; }
    const toc = t.closest("[data-v3-toc]"); if (toc) { e.preventDefault(); $(toc.dataset.v3Toc)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-v3-paysel]")) { t.checked ? selected.add(t.dataset.v3Paysel) : selected.delete(t.dataset.v3Paysel); return renderPayTable(); }
    if (t.matches("[data-v3-paysel-all]")) { currentRows().forEach((r) => { const k = `${r.p.id}:${r.x.id}`; t.checked ? selected.add(k) : selected.delete(k); }); return renderPayTable(); }
    if (t.id === "v3PayPeriod") { payPeriod = t.value; selected.clear(); return renderPayParts(); }
    if (t.matches("[data-v3-routine]")) {
      const dayKey = `routine-${manualKey}-${today()}`, set = new Set(ls.get(dayKey, []));
      t.checked ? set.add(t.dataset.v3Routine) : set.delete(t.dataset.v3Routine);
      ls.set(dayKey, [...set]); t.closest("li")?.classList.toggle("done", t.checked);
    }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "v3PaySearch") { payQuery = e.target.value; renderPayParts(); } });

  UF3.views.pagos = renderPayments;
  UF3.views.manual = renderManual;
})();
