/* UNIFORMA ERP — capa de interfaz v3.
   Se carga DESPUÉS de panel-v2.js y reutiliza sus funciones globales (state, can, go, proposal, totals, save…).
   No toca datos: solo agrega navegación, "Mi día", buscador de comandos (Ctrl+K), mensajes rápidos de WhatsApp,
   alertas por antigüedad en cada etapa, compuerta de entrega y tablero de propuestas arrastrable. */
(() => {
  "use strict";

  const V3I = {
    plus: '<path d="M12 5v14M5 12h14"/>', chevron: '<path d="m15 18-6-6 6-6"/>', search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    wand: '<path d="M4 20 16 8M14 4l1.5-1.5L17 4l1.5-1.5M19 9l1.5-1.5M15 13l1.5 1.5"/><path d="m13 5 6 6"/>', msg: '<path d="M21 12a8 8 0 0 1-11.7 7L3 21l2-5.6A8 8 0 1 1 21 12z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', task: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>', cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', down: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16"/>', sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16m0 0v5m0-5h5M3 12A9 9 0 0 1 18.5 5.8L21 8m0 0V3m0 5h-5"/>',
  };
  const svg = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${V3I[name] || ""}</svg>`;
  const ico = (name, size = 18) => (V3I[name] ? svg(name, size) : icon(name, size));
  V3I.card = '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>';
  V3I.book = '<path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/>';
  V3I.check = '<path d="m4 12 5 5L20 6"/>';
  V3I.calendar = '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>';
  V3I.box = '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>';
  V3I.cash = '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>';
  V3I.qr = '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1"/>';
  V3I.upload = '<path d="M12 21V9m0 0-4 4m4-4 4 4M4 3h16"/>';
  V3I.repeat = '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>';
  V3I.inbox = '<path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>';
  V3I.cart = '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.5L21 8H6"/>';
  V3I.gauge = '<path d="M12 14l4-5M3.3 17a9 9 0 1 1 17.4 0M12 3v2M5 7l1.5 1.5M19 7l-1.5 1.5"/>';
  V3I.camera = '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>';
  V3I.users2 = '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m4 10v-2a6 6 0 0 0-4-5.65"/>';
  V3I.more = '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>';
  // Registro que usa panel-v3-admin.js (pagos y manuales) para engancharse a esta capa.
  const UF3 = (window.UF3 = { views: {}, agendaHooks: [], badgeHooks: [], V3I, svg, ico });

  const store = {
    get(k, d) { try { const v = localStorage.getItem("uf-v3-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("uf-v3-" + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };

  /* ---------- pagos: solo cuenta lo validado ---------- */
  const payStatus = (p) => (["pending", "validated", "rejected", "voided"].includes(p && p.status) ? p.status : "validated");
  UF3.payStatus = payStatus;
  totals = function (item) {
    const subtotal = (item?.designs || []).reduce((sum, d) => sum + Number(d.qty || 0) * Number(d.unitPrice || 0), 0);
    const discount = subtotal * Number(item?.discount || 0) / 100;
    const base = subtotal - discount + Number(item?.surcharge || 0) + Number(item?.shipping || 0);
    const tax = base * Number(item?.taxRate || 0) / 100;
    const total = Math.max(0, base + tax);
    const pays = item?.payments || [];
    const sumBy = (st) => pays.filter((p) => payStatus(p) === st).reduce((s, p) => s + Number(p.amount || 0), 0);
    const paid = sumBy("validated");
    return { subtotal, discount, tax, total, paid, pending: sumBy("pending"), rejected: sumBy("rejected"), balance: Math.max(0, total - paid), credit: Math.max(0, paid - total) };
  };
  const pendingPayments = () => state.proposals.flatMap((p) => (p.payments || []).filter((x) => payStatus(x) === "pending").map((x) => ({ p, x })));
  UF3.pendingPayments = pendingPayments;

  /* ---------- helpers de negocio ---------- */
  const ageDays = (iso) => {
    if (!iso) return 0;
    const t = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : 0;
  };
  // Cuándo entró la propuesta en su estado actual (último cambio de estado del historial).
  const lastMove = (p) => ((p.history || []).find((h) => h.action === "Estado actualizado") || {}).at || p.updatedDate || p.createdDate || "";
  const daysInStage = (p) => ageDays(lastMove(p));
  const ACTIVE_PAID = ["Aprobada", "En producción", "Lista", "Entregada"];
  const ONGOING = ["Aprobada", "En producción", "Lista"];
  const NEGOTIATION = ["Borrador", "Enviada", "Vista"];
  const STATUS_COLORS = { "Borrador": "#b9ab98", "Enviada": "#5b8bb8", "Vista": "#8b63b5", "Aprobada": "#4f9a62", "Rechazada": "#cf6a5a", "En producción": "#d9a93a", "Lista": "#2a9c8f", "Entregada": "#7f9b6a" };

  function staleLevel(p) {
    const d = daysInStage(p);
    if (["Enviada", "Vista"].includes(p.status)) return d >= 7 ? "bad" : d >= 3 ? "warn" : "";
    if (p.status === "Borrador") return d >= 7 ? "warn" : "";
    if (p.status === "Aprobada") return d >= 4 ? "bad" : d >= 2 ? "warn" : "";
    if (p.status === "En producción") return d >= 14 ? "warn" : "";
    if (p.status === "Lista") return d >= 14 ? "bad" : d >= 7 ? "warn" : "";
    return "";
  }

  /* ---------- mensajes rápidos (WhatsApp con variables) ---------- */
  const DEFAULT_TEMPLATES = [
    { id: "quote", label: "Enviar presupuesto", when: ["Borrador", "Enviada"], text: "Hola {cliente}, te paso el presupuesto {pedido} de UNIFORMA por {total}. Es válido hasta el {validez}. Si querés ajustar cantidades, colores o el diseño, avisame y lo vemos. Podés verlo y aprobarlo online acá: {link}" },
    { id: "followup", label: "Repescar presupuesto", when: ["Enviada", "Vista"], text: "Hola {cliente}, ¿pudiste ver el presupuesto {pedido}? Si querés ajustamos cantidades, colores o el diseño. ¡Quedo atento!" },
    { id: "logo", label: "Pedir logo", when: ["Borrador", "Enviada", "Vista", "Aprobada"], text: "Hola {cliente}, para avanzar con {pedido} necesitamos tu logo en la mejor calidad posible (PNG sin fondo, PDF o vector). ¿Nos lo podés enviar por acá?" },
    { id: "proof", label: "Diseño para aprobar", when: ["Vista", "Enviada", "Aprobada"], text: "Hola {cliente}, te mandamos la ficha visual del pedido {pedido} con la ubicación y el tamaño de cada logo. Podés revisarlo y aprobarlo acá: {link} — o decinos qué cambiarías antes de producir." },
    { id: "balance", label: "Seña / saldo", when: ACTIVE_PAID, text: "Hola {cliente}, el saldo pendiente del pedido {pedido} es {saldo}. Te paso los datos para transferir cuando quieras. ¡Gracias!" },
    { id: "delivery", label: "Fecha de entrega", when: ["Aprobada", "En producción"], text: "Hola {cliente}, te confirmamos que el pedido {pedido} estaría listo el {entrega}. Cualquier novedad te avisamos." },
    { id: "reorder", label: "Recompra", when: ["Entregada"], text: "Hola {cliente}, ¿cómo estás? Hace un tiempo hicimos tu pedido {pedido}. Si necesitás repetirlo o sumar prendas, armamos el presupuesto con los precios actuales. Podés pedirlo con un clic acá: {link}" },
    { id: "ready", label: "Pedido listo", when: ["Lista"], text: "Hola {cliente}, tu pedido {pedido} ya está listo para retirar o coordinar el envío. {saldoTxt}" },
  ];
  const templates = () => {
    const custom = state.settings?.messageTemplates;
    return Array.isArray(custom) && custom.length ? [...custom, ...DEFAULT_TEMPLATES.filter((d) => !custom.some((c) => c.id === d.id))] : DEFAULT_TEMPLATES;
  };
  const trackLink = (p) => (p && p.publicToken ? new URL(`track.php?t=${p.publicToken}`, location.href).href : "");
  UF3.DEFAULT_TEMPLATES = DEFAULT_TEMPLATES; UF3.templates = templates; UF3.trackLink = trackLink;
  const fillTemplate = (text, p) => {
    const c = client(p.clientId), sum = totals(p);
    const map = {
      cliente: c.contact || c.company || "", pedido: p.publicId, total: money(sum.total), saldo: money(sum.balance),
      validez: dateLabel(p.validUntil), entrega: dateLabel(p.deliveryDate), link: trackLink(p), saldoTxt: sum.balance > 0 ? `Recordá que queda un saldo de ${money(sum.balance)}.` : "",
    };
    return text.replace(/\{(\w+)\}/g, (_, k) => (k in map ? map[k] : "")).replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
  };
  UF3.fillTemplate = fillTemplate;
  function quickMsgSection(p) {
    const suggested = templates().filter((t) => t.when.includes(p.status)).map((t) => t.id);
    const hasMail = /\S+@\S+\.\S+/.test(client(p.clientId).email || "");
    return `<section class="v3-quickmsg"><h3>${svg("msg", 16)} Mensajes rápidos</h3><p>Abre WhatsApp con el texto armado (cliente, pedido, importes)${hasMail ? " o lo manda por mail con el botón ✉" : ""}. No se envía nada solo; queda registrado en el historial.</p><div class="chips">${templates().map((t) => `<span class="v3-chipgrp"><button type="button" data-v3-msg="${esc(p.id)}:${t.id}" class="${suggested.includes(t.id) ? "suggest" : ""}">${esc(t.label)}</button>${hasMail && can("proposals.manage") ? `<button type="button" class="mail" data-v3-mail="${esc(p.id)}:${t.id}" title="Enviar «${esc(t.label)}» por mail" aria-label="Enviar por mail">✉</button>` : ""}</span>`).join("")}</div></section>`;
  }
  async function sendQuickMessage(id, tplId) {
    const p = proposal(id), tpl = templates().find((t) => t.id === tplId);
    if (!p || !tpl) return;
    const c = client(p.clientId);
    const phone = String(c.phone || state.settings.whatsapp || "").replace(/\D/g, "");
    if (!phone) { toast("Este cliente no tiene WhatsApp cargado. Editá el cliente y agregá el teléfono."); return; }
    if (tpl.text.includes("{link}") && !p.publicToken && can("proposals.manage")) { try { await api("tracking_link", { proposalId: p.id, op: "create" }); } catch (e) { toast(e.message); } }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fillTemplate(tpl.text, proposal(p.id) || p))}`, "_blank", "noopener");
    if (can("proposals.manage")) {
      proposalEvent(p, "Mensaje por WhatsApp", tpl.label);
      try { await save(); } catch (e) { toast(e.message); }
      if (currentView === "propuestas" && $("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(proposal(p.id));
      else renderView();
    }
  }

  async function sendQuickMail(id, tplId) {
    let p = proposal(id);
    const tpl = templates().find((x) => x.id === tplId);
    if (!p || !tpl) return;
    if (tpl.text.includes("{link}") && !p.publicToken) { try { await api("tracking_link", { proposalId: id, op: "create" }); p = proposal(id); } catch (e) { toast(e.message); return; } }
    toast("Enviando correo…");
    try {
      const data = await api("send_proposal_email", { proposalId: id, label: tpl.label, subject: `${tpl.label} · ${p.publicId} · ${state.settings.companyName || "UNIFORMA"}`, body: fillTemplate(tpl.text, p) });
      toast(data.mail && data.mail.mode === "test" ? `Correo de PRUEBA enviado a ${data.mail.sentTo}.` : "Correo enviado al cliente.");
      if (currentView === "propuestas" && $("proposalDetailV2")) $("proposalDetailV2").innerHTML = proposalDetail(proposal(id)); else renderView();
    } catch (e) { toast(e.message); }
  }

  /* ---------- condiciones de entrega ---------- */
  function deliveryChecks(p) {
    const sum = totals(p);
    const pending = (p.designs || []).filter((d) => !productionProgress(d).ready).length;
    return [
      { ok: sum.balance <= 0, text: sum.balance <= 0 ? "Pago completo (validado)" : `Saldo ${money(sum.balance)}${sum.pending > 0 ? ` · ${money(sum.pending)} esperando validación` : ""}` },
      { ok: !!(p.designs || []).length && pending === 0, text: pending === 0 ? "Control de calidad aprobado" : `${pending} prenda(s) sin control aprobado` },
      { ok: !!p.artApproval, text: p.artApproval ? "Diseño aprobado por el cliente" : "Diseño sin aprobación registrada" },
    ];
  }
  function deliverySection(p) {
    if (!["Aprobada", "En producción", "Lista"].includes(p.status)) return "";
    const rows = deliveryChecks(p);
    return `<section class="v3-checks"><h3>Para poder entregar</h3><ul>${rows.map((r) => `<li class="${r.ok ? "ok" : "no"}"><span>${r.ok ? "✓" : "✕"}</span>${esc(r.text)}</li>`).join("")}</ul></section>`;
  }

  /* ---------- agenda de "Mi día" ---------- */
  const SEVERITY = { bad: 0, warn: 1, info: 2, good: 3 };
  function agenda() {
    const items = [], now = today();
    const push = (it) => items.push(it);
    state.tasks.filter((t) => t.status !== "Hecha" && t.dueDate && t.dueDate <= now).forEach((t) => push({
      group: "tareas", level: t.dueDate < now ? "bad" : "warn", tag: "Tarea", title: t.title, sub: `${client(t.clientId).company || "Sin cliente"} · ${t.dueDate < now ? "venció" : "vence"} ${dateLabel(t.dueDate)}`,
      acts: [can("tasks.manage") ? { label: "Completar", main: true, attr: `data-complete-task="${esc(t.id)}"` } : null, can("tasks.manage") ? { label: "Editar", attr: `data-edit-task="${esc(t.id)}"` } : null],
    }));
    state.proposals.forEach((p) => {
      const sum = totals(p), c = client(p.clientId), who = `${p.publicId} · ${c.company || ""}`, d = daysInStage(p);
      const open = { label: "Abrir", attr: `data-open-proposal="${esc(p.id)}"` };
      const wa = (id, label, main) => (can("proposals.view") ? { label, main, attr: `data-v3-msg="${esc(p.id)}:${id}"` } : null);
      if (["Enviada", "Vista"].includes(p.status) && d >= 3) push({ group: "seguimiento", level: d >= 7 ? "bad" : "warn", tag: "Seguimiento", title: who, sub: `Sin respuesta hace ${d} días · ${money(sum.total)}`, acts: [wa("followup", "Repescar por WhatsApp", true), open] });
      if (p.validUntil && p.validUntil < now && NEGOTIATION.includes(p.status)) push({ group: "seguimiento", level: "bad", tag: "Vencida", title: who, sub: `La validez terminó el ${dateLabel(p.validUntil)}`, acts: [open, can("proposals.manage") ? { label: "Duplicar", attr: `data-duplicate-proposal="${esc(p.id)}"` } : null] });
      if (ACTIVE_PAID.includes(p.status) && sum.balance > 0) push({ group: "cobranza", level: p.status === "Entregada" ? "bad" : p.status === "Lista" ? "warn" : "info", tag: "Cobranza", title: who, sub: `Saldo ${money(sum.balance)} de ${money(sum.total)} · ${p.status.toLowerCase()}`, acts: [can("proposals.manage") ? { label: "Registrar pago", main: true, attr: `data-add-payment="${esc(p.id)}"` } : null, wa("balance", "Pedir saldo")] });
      if (!["Entregada", "Rechazada"].includes(p.status) && p.deliveryDate && p.deliveryDate <= addDays(3) && ONGOING.includes(p.status)) push({ group: "entregas", level: p.deliveryDate < now ? "bad" : "warn", tag: "Entrega", title: who, sub: `${p.deliveryDate < now ? "Venció" : "Entrega"} ${dateLabel(p.deliveryDate)} · ${p.status.toLowerCase()}`, acts: [open, { label: "Producción", attr: 'data-go="tareas"' }] });
      if (p.status === "Aprobada" && d >= 2) push({ group: "entregas", level: d >= 4 ? "bad" : "warn", tag: "Sin producir", title: who, sub: `Aprobada hace ${d} días y todavía no pasó a producción`, acts: [can("proposals.manage") ? { label: "Pasar a producción", main: true, attr: `data-v3-status="${esc(p.id)}:En producción"` } : null, open] });
      if (p.status === "Lista" && d >= 7) push({ group: "entregas", level: d >= 14 ? "bad" : "warn", tag: "Sin retirar", title: who, sub: `Lista hace ${d} días`, acts: [wa("ready", "Avisar por WhatsApp", true), open] });
      if (p.changeRequest && p.changeRequest.comment) push({ group: "seguimiento", level: "bad", tag: "Cambios", title: who, sub: `El cliente pidió: «${String(p.changeRequest.comment).slice(0, 110)}»`, acts: [open, can("proposals.manage") ? { label: "Marcar atendido", main: true, attr: `data-v3-clear-change="${esc(p.id)}"` } : null] });
      if (ONGOING.includes(p.status) && (p.designs || []).length && !p.artApproval) push({ group: "otros", level: "warn", tag: "Diseño", title: who, sub: "Falta registrar la aprobación del diseño", acts: [open] });
    });
    if (can("payments.validate")) {
      const pend = pendingPayments();
      if (pend.length) {
        const oldest = Math.max(...pend.map(({ x }) => ageDays(x.registeredAt || x.createdAt || x.date)));
        push({ group: "cobranza", level: oldest >= 2 ? "bad" : "warn", tag: "Validar pagos", title: `${pend.length} pago(s) por validar`, sub: `${money(pend.reduce((s, { x }) => s + Number(x.amount || 0), 0))} esperando confirmación${oldest ? ` · el más viejo hace ${oldest} d` : ""}`, acts: [{ label: "Revisar pagos", main: true, attr: 'data-go="pagos"' }] });
      }
    }
    const short = stockPlan().filter((r) => r.shortage > 0);
    if (short.length) push({ group: "otros", level: "warn", tag: "Stock", title: `${short.length} variante(s) con faltantes de prendas`, sub: "Revisá «Prendas por conseguir» en Producción", acts: [{ label: "Ver faltantes", attr: 'data-go="tareas"' }] });
    UF3.agendaHooks.forEach((hook) => { try { hook(items, push); } catch (e) { console.error(e); } });
    items.forEach((it) => { it.acts = (it.acts || []).filter(Boolean); });
    return items.sort((a, b) => SEVERITY[a.level] - SEVERITY[b.level]);
  }

  const FILTERS = [["all", "Todo"], ["cobranza", "Cobranza"], ["entregas", "Entregas"], ["seguimiento", "Seguimiento"], ["tareas", "Tareas"], ["otros", "Otros"]];
  let dayFilter = "all";

  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  }
  function renderDay() {
    const all = agenda();
    const shown = dayFilter === "all" ? all : all.filter((i) => i.group === dayFilter);
    const bad = all.filter((i) => i.level === "bad").length, warn = all.filter((i) => i.level === "warn").length;
    const active = state.proposals.filter((p) => !["Rechazada", "Entregada"].includes(p.status));
    const outstandingRows = state.proposals.filter((p) => ACTIVE_PAID.includes(p.status) && totals(p).balance > 0);
    const outstanding = outstandingRows.reduce((s, p) => s + totals(p).balance, 0);
    const inProd = state.proposals.filter((p) => ONGOING.includes(p.status));
    const next7 = inProd.filter((p) => p.deliveryDate && p.deliveryDate >= today() && p.deliveryDate <= addDays(7));
    const counts = Object.fromEntries(STATUS.map((s) => [s, state.proposals.filter((p) => p.status === s).length]));
    const total = Math.max(1, state.proposals.length);
    const dateText = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const first = esc((currentUser.name || "equipo").split(" ")[0]);
    const summary = all.length ? `${all.length} para revisar${bad ? ` (${bad} urgente${bad > 1 ? "s" : ""})` : ""}` : "Todo al día";
    const actionBtn = (it) => it.acts.map((a) => `<button type="button" class="${a.main ? "main" : ""}" ${a.attr}>${esc(a.label)}</button>`).join("");

    $("view-dashboard").innerHTML = `
      <div class="page-heading"><div><h1>${greeting()}, ${first}</h1><p>${esc(dateText.charAt(0).toUpperCase() + dateText.slice(1))} · ${esc(summary)}</p></div>
        <div class="button-row">${can("proposals.manage") ? `<button class="primary-button" data-new-proposal type="button">Nueva propuesta</button>` : ""}${can("editor.use") ? `<a class="v2-button-link" href="estudio.php" style="min-height:38px;padding:0 14px">${svg("wand", 16)}&nbsp;Estudio de logos</a>` : ""}</div></div>
      <div class="v3-kpis">
        <button class="v3-kpi" data-go="propuestas" type="button"><small>Propuestas activas</small><strong>${active.length}</strong><em>${state.proposals.filter((p) => NEGOTIATION.includes(p.status)).length} en negociación</em></button>
        <button class="v3-kpi ${outstanding > 0 ? "warn" : "good"}" data-go="propuestas" type="button"><small>Por cobrar</small><strong>${money(outstanding)}</strong><em>${outstandingRows.length} pedido(s) con saldo</em></button>
        <button class="v3-kpi" data-go="tareas" type="button"><small>En taller</small><strong>${inProd.length}</strong><em>${next7.length} entrega(s) en 7 días</em></button>
        <button class="v3-kpi ${bad ? "bad" : warn ? "warn" : "good"}" data-v3-scroll="v3Todo" type="button"><small>A resolver</small><strong>${all.length}</strong><em>${bad ? `${bad} urgente(s)` : warn ? "nada urgente" : "todo al día"}</em></button>
      </div>
      <div class="v3-day">
        <section class="surface" id="v3Todo"><div class="section-row"><h2>Para hacer hoy</h2><small>${shown.length} de ${all.length}</small></div>
          <div class="v3-chips">${FILTERS.map(([k, l]) => { const n = k === "all" ? all.length : all.filter((i) => i.group === k).length; return `<button type="button" class="v3-chip ${dayFilter === k ? "on" : ""}" data-v3-filter="${k}">${l}<b>${n}</b></button>`; }).join("")}</div>
          <div class="v3-todo">${shown.length ? shown.map((it) => `<article class="v3-item ${it.level}"><span class="tag">${esc(it.tag)}</span><div><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></div><div class="acts">${actionBtn(it)}</div></article>`).join("") : `<div class="v3-empty"><b>${all.length ? "Nada en esta categoría" : "Todo al día"}</b>${all.length ? "Probá con otro filtro." : "No hay tareas, cobros ni entregas pendientes. Buen momento para hacer seguimiento comercial."}</div>`}</div>
        </section>
        <div style="display:grid;gap:18px">
          <section class="surface"><div class="section-row"><h2>Embudo de propuestas</h2><small>${state.proposals.length} en total</small></div>
            <div class="v3-pipe">${STATUS.filter((s) => counts[s]).map((s) => `<i style="width:${(counts[s] / total) * 100}%;background:${STATUS_COLORS[s]}" title="${esc(s)}: ${counts[s]}"></i>`).join("")}</div>
            <div class="v3-pipe-legend">${STATUS.map((s) => `<button type="button" data-v3-status-filter="${esc(s)}"><i style="background:${STATUS_COLORS[s]}"></i><span>${esc(s)}</span><b>${counts[s]}</b></button>`).join("")}</div></section>
          <section class="surface"><div class="section-row"><h2>Accesos rápidos</h2></div><div class="v3-quick">
            ${can("proposals.manage") ? `<button data-new-proposal type="button">${svg("plus")}Nueva propuesta</button>` : ""}${can("clients.manage") ? `<button data-new-client type="button">${svg("user")}Nuevo cliente</button>` : ""}
            ${can("tasks.manage") ? `<button data-new-task type="button">${svg("task")}Nueva tarea</button>` : ""}${can("editor.use") ? `<a href="estudio.php">${svg("wand")}Estudio de logos</a>` : ""}
            <button type="button" data-v3-cmd style="grid-column:1/-1">${svg("search")}Buscar o ejecutar <span class="v3-kbd" style="margin-left:auto">Ctrl K</span></button></div></section>
          <section class="surface"><div class="section-row"><h2>Propuestas recientes</h2><button class="text-button" data-go="propuestas" type="button">Ver todas</button></div>${proposalRows(state.proposals.slice().sort((a, b) => String(b.updatedDate).localeCompare(String(a.updatedDate))).slice(0, 5))}</section>
        </div>
      </div>`;
  }

  /* ---------- menú lateral y barra superior ---------- */
  const NAV = [
    ["Ventas", [["dashboard", "Mi día", "dashboard.view", "home"], ["consultas", "Consultas", "proposals.view", "inbox"], ["clientes", "Clientes", "clients.view", "users"], ["propuestas", "Propuestas", "proposals.view", "file"]]],
    ["Taller", [["tareas", "Producción", "tasks.view", "factory"], ["calendario", "Calendario", "tasks.view", "calendar"], ["catalogo", "Productos", "catalog.view", "shirt"], ["stock", "Stock", "catalog.view", "box"], ["editor", "Editor visual", "editor.use", "image"], ["@estudio", "Estudio de logos", "editor.use", "wand"]]],
    ["Administración", [["pagos", "Pagos", "payments.view", "card"], ["caja", "Caja diaria", "payments.view", "cash"], ["compras", "Compras y talleres", "purchases.view", "cart"], ["tablero", "Tablero", "reports.view", "gauge"], ["reportes", "Reportes", "reports.view", "chart"], ["usuarios", "Usuarios", "users.manage", "shield"], ["configuracion", "Configuración", "settings.manage", "settings"]]],
  ];
  function buildChrome() {
    document.body.classList.toggle("v3-collapsed", !!store.get("collapsed", false));
    const brand = q(".sidebar .brand");
    if (brand && !q(".v3-mono", brand)) brand.insertAdjacentHTML("afterbegin", `<span class="v3-mono" aria-hidden="true">U</span>`);
    if (brand && !q(".v3-collapse", brand)) brand.insertAdjacentHTML("beforeend", `<button class="v3-collapse" id="v3Collapse" type="button" aria-label="Plegar o desplegar el menú" title="Plegar menú">${svg("chevron", 16)}</button>`);
    const nav = q(".nav-list");
    nav.innerHTML = NAV.map(([group, items]) => {
      const visible = items.filter(([, , perm]) => can(perm));
      if (!visible.length) return "";
      return `<div class="v3-group">${group}</div>` + visible.map(([view, label, , symbol]) => view === "@estudio"
        ? `<a class="nav-item" href="estudio.php" title="${label}"><span class="v2-nav-icon">${ico(symbol)}</span><span class="v3-label">${label}</span></a>`
        : `<button class="nav-item" data-go="${view}" type="button" title="${label}"><span class="v2-nav-icon">${ico(symbol)}</span><span class="v3-label">${label}</span><span class="v3-badge" data-badge="${view}" hidden></span></button>`).join("");
    }).join("") + `<div class="v3-group v3-mobile-only">Cuenta</div><button class="nav-item v3-mobile-only" type="button" data-v3-logout><span class="v2-nav-icon">${svg("out")}</span><span class="v3-label">Cerrar sesión (${esc(currentUser.name || "")})</span></button>`;
    const ws = q(".workspace");
    ["pagos", "manual", "stock", "calendario", "caja", "consultas", "compras", "tablero"].forEach((id) => { if (ws && !$(`view-${id}`)) ws.insertAdjacentHTML("beforeend", `<section class="view" id="view-${id}"></section>`); });
    const side = q(".sidebar");
    if (side && !q(".v3-side-foot", side)) side.insertAdjacentHTML("beforeend", `<div class="v3-side-foot">Buscá cualquier cosa con <kbd>Ctrl</kbd> <kbd>K</kbd></div>`);

    const tb = q(".topbar");
    const searchBox = q(".search-box", tb);
    if (searchBox && !q(".v3-cmd-btn", tb)) {
      searchBox.insertAdjacentHTML("afterend", `<button class="v3-cmd-btn" id="v3CmdBtn" type="button" data-v3-cmd>${svg("search", 17)}<span>Buscar o ejecutar…</span><kbd class="v3-kbd">Ctrl K</kbd></button><span class="v3-spacer"></span>`);
      const newItems = [
        can("proposals.manage") ? `<button type="button" data-new-proposal data-v3-close>${svg("plus")}Nueva propuesta</button>` : "",
        can("clients.manage") ? `<button type="button" data-new-client data-v3-close>${svg("user")}Nuevo cliente</button>` : "",
        can("tasks.manage") ? `<button type="button" data-new-task data-v3-close>${svg("task")}Nueva tarea</button>` : "",
        can("catalog.manage") ? `<button type="button" data-new-product data-v3-close>${icon("shirt", 17)}Producto manual</button>` : "",
        can("editor.use") ? `<a href="estudio.php">${svg("wand")}Nuevo logo en el Estudio</a>` : "",
      ].join("");
      q(".notification-wrap", tb).insertAdjacentHTML("beforebegin", `<button class="v3-help-btn" type="button" data-go="manual" title="Manuales de uso" aria-label="Manuales de uso">${svg("book", 18)}<span>Manuales</span></button>`);
      if (newItems.trim()) q(".notification-wrap", tb).insertAdjacentHTML("beforebegin", `<div class="v3-new"><button type="button" id="v3NewBtn" aria-haspopup="true" aria-expanded="false">${svg("plus", 16)}<span>Nuevo</span></button><div class="v3-menu" id="v3NewMenu" hidden>${newItems}</div></div>`);
    }
  }
  function updateBadges() {
    const follow = state.proposals.filter((p) => ["Enviada", "Vista"].includes(p.status) && daysInStage(p) >= 3).length
      + state.proposals.filter((p) => ONGOING.includes(p.status) === false && p.validUntil && p.validUntil < today() && NEGOTIATION.includes(p.status)).length;
    const shop = state.proposals.filter((p) => ONGOING.includes(p.status) && (productionUrgency(p) || (p.status === "Aprobada" && daysInStage(p) >= 2))).length;
    const day = agenda();
    const set = (view, n, danger) => { const el = q(`[data-badge="${view}"]`); if (!el) return; const txt = n > 99 ? "99+" : String(n); if (el.hidden !== !n) el.hidden = !n; if (el.textContent !== txt) el.textContent = txt; el.classList.toggle("danger", !!danger); };
    set("dashboard", day.length, day.some((i) => i.level === "bad"));
    set("pagos", can("payments.validate") ? pendingPayments().length : 0, true);
    UF3.badgeHooks.forEach((hook) => { try { hook(set); } catch (e) { console.error(e); } });
    set("propuestas", follow, false);
    set("tareas", shop, state.proposals.some((p) => ONGOING.includes(p.status) && productionUrgency(p) === "Vencida"));
  }

  /* ---------- tablero: edades y arrastre ---------- */
  function ageChip(p) {
    const lv = staleLevel(p), d = daysInStage(p);
    if (!["Borrador", "Enviada", "Vista", "Aprobada", "En producción", "Lista"].includes(p.status)) return "";
    return `<span class="v3-age ${lv}" title="Días en este estado">${d === 0 ? "hoy" : `${d} d en ${p.status.toLowerCase()}`}</span>`;
  }
  function enhanceBoards() {
    qa(".v2-proposals.kanban .v2-board-column").forEach((col) => {
      const h = q("h3", col), status = h && h.childNodes[0] ? h.childNodes[0].textContent.trim() : "";
      if (STATUS.includes(status)) col.dataset.dropStatus = status;
    });
    qa(".v2-proposals.kanban .v2-board-card-button[data-open-proposal]").forEach((card) => {
      const id = card.dataset.openProposal, p = proposal(id);
      if (can("proposals.manage") && !card.dataset.productionCard) { card.dataset.productionCard = id; card.draggable = true; }
      if (p && !q(".v3-age", card)) card.insertAdjacentHTML("beforeend", ageChip(p));
    });
    qa(".v2-production-card[data-production-card]").forEach((card) => {
      const p = proposal(card.dataset.productionCard);
      if (p && !q(".v3-age", card)) q("button", card)?.insertAdjacentHTML("beforeend", ageChip(p));
    });
  }
  let rafQueued = false;
  const queueEnhance = () => { if (rafQueued) return; rafQueued = true; requestAnimationFrame(() => { rafQueued = false; try { enhanceBoards(); updateBadges(); } catch (e) { /* vista sin datos todavía */ } }); };

  /* ---------- paleta de comandos ---------- */
  let cmdOpen = false, cmdSel = 0, cmdRows = [];
  const hide = (el) => { el.hidden = true; };
  function clickHidden(attr) {
    const b = document.createElement("button");
    b.setAttribute(attr, ""); b.style.display = "none"; document.body.appendChild(b); b.click(); setTimeout(() => b.remove(), 400);
  }
  function filterClient(name) { go("clientes"); const el = $("clientSearchV2"); if (el) { el.value = name; renderClientCards(name); } }
  function filterProduct(name) { go("catalogo"); const el = $("productSearch"); if (el) { el.value = name; renderProductCards(name); } }
  function openProposalsFiltered(status) { go("propuestas"); const el = $("proposalStatusFilter"); if (el) { el.value = status; filterProposals(); } }
  function commandItems() {
    const A = [];
    const act = (label, sub, icon_, run, perm, keys = "") => { if (!perm || can(perm)) A.push({ group: "Acciones", label, sub, icon: icon_, run, keys: label + " " + keys }); };
    act("Nueva propuesta", "Crear un presupuesto", "plus", () => proposalModal(""), "proposals.manage", "presupuesto crear");
    act("Nuevo cliente", "Registrar un cliente", "user", () => clientModal(), "clients.manage", "crear empresa");
    act("Nueva tarea", "Agendar un seguimiento", "task", () => taskModal(), "tasks.manage", "recordatorio");
    act("Nuevo producto manual", "Agregar al catálogo", "shirt", () => productModal(), "catalog.manage");
    act("Abrir el Estudio de logos", "Editar y preparar logos", "wand", () => { location.href = "estudio.php"; }, "editor.use", "logo canva recortar fondo");
    [["dashboard", "Ir a Mi día", "home"], ["clientes", "Ir a Clientes", "users"], ["propuestas", "Ir a Propuestas", "file"], ["tareas", "Ir a Producción", "factory"], ["catalogo", "Ir a Productos", "shirt"], ["editor", "Ir al Editor visual", "image"], ["reportes", "Ir a Reportes", "chart"], ["usuarios", "Ir a Usuarios", "shield"], ["configuracion", "Ir a Configuración", "settings"]].forEach(([view, label, ic]) => {
      const perm = { dashboard: "dashboard.view", clientes: "clients.view", propuestas: "proposals.view", tareas: "tasks.view", catalogo: "catalog.view", editor: "editor.use", reportes: "reports.view", usuarios: "users.manage", configuracion: "settings.manage" }[view];
      act(label, "Navegar", ic, () => go(view), perm, "abrir ver pantalla");
    });
    act("Ir a Pagos (validar, rechazar, anular)", "Administración", "card", () => go("pagos"), "payments.view", "validar cobranza administracion");
    act("Ir a Consultas de la web", "Pedidos de presupuesto que llegan del sitio", "inbox", () => go("consultas"), "proposals.view", "web leads formulario contacto");
    act("Ir a Compras y talleres", "Órdenes de compra, insumos, talleres externos", "cart", () => go("compras"), "purchases.view", "proveedores insumos ordenes talleres");
    act("Ir al Tablero de gerencia", "Ventas, tasa de cierre, tiempos y vendedores", "gauge", () => go("tablero"), "reports.view", "kpi ventas comisiones metricas");
    act("Mi cuenta: contraseña y verificación en dos pasos", "Seguridad de tu usuario", "user", () => UF3.openAccount && UF3.openAccount(), null, "password clave 2fa seguridad perfil");
    act("Ir a Stock", "Inventario de prendas y reservas", "box", () => go("stock"), "catalog.view", "inventario mercaderia faltantes");
    act("Ir al Calendario de entregas", "Carga del taller por semana", "calendar", () => go("calendario"), "tasks.view", "fechas semana capacidad");
    act("Ir a la Caja diaria", "Cobros validados y cierre", "cash", () => go("caja"), "payments.view", "cierre efectivo arqueo");
    act("Escanear etiqueta QR", "Abrir un pedido con la cámara", "qr", () => UF3.openScanner && UF3.openScanner(), "tasks.view", "qr camara etiqueta");
    act("Abrir mi manual", "Guía de uso de tu puesto", "book", () => go("manual"), null, "ayuda manual guia como");
    act("Sincronizar catálogo con la web", "Traer productos de WooCommerce", "sync", () => clickHidden("data-sync-catalog"), "catalog.manage", "woocommerce actualizar");
    act("Exportar respaldo", "Descargar copia del panel", "down", () => exportBackup(), "settings.manage", "backup copia");
    act("Cerrar sesión", "Salir del panel", "out", () => $("logoutBtn")?.click(), null, "salir logout");

    const E = [];
    if (can("proposals.view")) state.proposals.forEach((p) => E.push({ group: "Propuestas", label: `${p.publicId} · ${client(p.clientId).company || ""}`, sub: `${p.title || ""} · ${p.status} · ${money(totals(p).total)}`, icon: "file", keys: `${p.publicId} ${p.title} ${client(p.clientId).company} ${p.status} ${(p.designs || []).map((d) => product(d.productId).name).join(" ")}`, run: () => { state.activeProposalId = p.id; go("propuestas"); }, recent: p.updatedDate }));
    if (can("clients.view")) state.clients.forEach((c) => E.push({ group: "Clientes", label: c.company || "Sin nombre", sub: [c.contact, c.phone].filter(Boolean).join(" · "), icon: "users", keys: `${c.company} ${c.contact} ${c.phone} ${c.email} ${c.cuit}`, run: () => filterClient(c.company || "") }));
    if (can("catalog.view")) state.products.forEach((p) => E.push({ group: "Productos", label: p.name, sub: `${p.category || "Sin categoría"}${p.sku ? " · " + p.sku : ""}`, icon: "shirt", keys: `${p.name} ${p.category} ${p.sku}`, run: () => filterProduct(p.name) }));
    if (can("tasks.view")) state.tasks.filter((t) => t.status !== "Hecha").forEach((t) => E.push({ group: "Tareas", label: t.title, sub: `${client(t.clientId).company || ""} · ${dateLabel(t.dueDate)}`, icon: "task", keys: `${t.title} ${client(t.clientId).company}`, run: () => go("tareas") }));
    return { A, E };
  }
  function runSearch(query) {
    const { A, E } = commandItems();
    const terms = searchText(query).split(/\s+/).filter(Boolean);
    const score = (it) => {
      const hay = searchText(it.keys || it.label), label = searchText(it.label);
      if (!terms.every((t) => hay.includes(t))) return -1;
      return (label.startsWith(terms[0]) ? 0 : label.includes(terms[0]) ? 1 : 2);
    };
    if (!terms.length) {
      const recent = E.filter((e) => e.group === "Propuestas").sort((a, b) => String(b.recent).localeCompare(String(a.recent))).slice(0, 5);
      return [...A.slice(0, 7), ...recent];
    }
    const pick = (list, n) => list.map((it) => [score(it), it]).filter(([s]) => s >= 0).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, it]) => it);
    return [...pick(A, 5), ...pick(E.filter((e) => e.group === "Propuestas"), 6), ...pick(E.filter((e) => e.group === "Clientes"), 5), ...pick(E.filter((e) => e.group === "Productos"), 5), ...pick(E.filter((e) => e.group === "Tareas"), 4)];
  }
  function renderCmd() {
    const list = $("v3CmdList"); if (!list) return;
    if (!cmdRows.length) { list.innerHTML = `<div class="v3-cmd-empty">Sin resultados. Probá con otro nombre, número de propuesta o acción.</div>`; return; }
    let last = "", html = "";
    cmdRows.forEach((r, i) => {
      if (r.group !== last) { html += `<div class="v3-cmd-group">${esc(r.group)}</div>`; last = r.group; }
      html += `<button type="button" class="v3-cmd-row ${i === cmdSel ? "sel" : ""}" data-cmd-i="${i}"><span class="ico">${ico(r.icon, 17)}</span><span class="txt"><b>${esc(r.label)}</b><small>${esc(r.sub || "")}</small></span>${i === cmdSel ? `<span class="hint">Enter ↵</span>` : ""}</button>`;
    });
    list.innerHTML = html;
    q(".v3-cmd-row.sel", list)?.scrollIntoView({ block: "nearest" });
  }
  function openCmd(prefill = "") {
    if (cmdOpen) return;
    cmdOpen = true;
    document.body.insertAdjacentHTML("beforeend", `<div class="v3-cmd-layer" id="v3CmdLayer"><div class="v3-cmd" role="dialog" aria-modal="true" aria-label="Buscar o ejecutar"><div class="v3-cmd-input">${svg("search", 19)}<input id="v3CmdInput" autocomplete="off" spellcheck="false" placeholder="Buscar propuesta, cliente, producto o escribir una acción…" value="${esc(prefill)}"></div><div class="v3-cmd-list" id="v3CmdList"></div><div class="v3-cmd-foot"><span>↑↓ moverse</span><span>Enter abrir</span><span>Esc cerrar</span></div></div></div>`);
    const input = $("v3CmdInput");
    const refresh = () => { cmdRows = runSearch(input.value); cmdSel = 0; renderCmd(); };
    input.addEventListener("input", refresh);
    refresh(); input.focus();
  }
  function closeCmd() { $("v3CmdLayer")?.remove(); cmdOpen = false; }
  function execCmd(i) {
    const row = cmdRows[i]; if (!row) return;
    closeCmd();
    try { row.run(); } catch (e) { toast(e.message || "No se pudo ejecutar la acción"); }
  }

  /* ---------- eventos ---------- */
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); return cmdOpen ? closeCmd() : openCmd(); }
    if (cmdOpen) {
      if (e.key === "Escape") { e.preventDefault(); return closeCmd(); }
      if (e.key === "ArrowDown") { e.preventDefault(); cmdSel = Math.min(cmdRows.length - 1, cmdSel + 1); return renderCmd(); }
      if (e.key === "ArrowUp") { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); return renderCmd(); }
      if (e.key === "Enter") { e.preventDefault(); return execCmd(cmdSel); }
      return;
    }
    const modalOpen = $("v2Modal") && !$("v2Modal").hidden;
    if (e.key === "/" && !typing && !modalOpen && !e.ctrlKey && !e.metaKey) { e.preventDefault(); openCmd(); }
  });
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("#v3CmdLayer")) {
      const row = t.closest("[data-cmd-i]"); if (row) return execCmd(+row.dataset.cmdI);
      return;
    }
    if (cmdOpen && !t.closest(".v3-cmd")) return closeCmd();
    if (t.closest("[data-v3-logout]")) return $("logoutBtn")?.click();
    if (t.closest("[data-v3-cmd]")) return openCmd();
    if (t.closest("#v3Collapse")) { const on = !document.body.classList.contains("v3-collapsed"); document.body.classList.toggle("v3-collapsed", on); store.set("collapsed", on); return; }
    const menu = $("v3NewMenu");
    if (t.closest("#v3NewBtn")) { if (menu) { menu.hidden = !menu.hidden; $("v3NewBtn").setAttribute("aria-expanded", String(!menu.hidden)); } return; }
    if (menu && !menu.hidden) { menu.hidden = true; $("v3NewBtn")?.setAttribute("aria-expanded", "false"); }
    const f = t.closest("[data-v3-filter]"); if (f) { dayFilter = f.dataset.v3Filter; return renderDay(); }
    const sc = t.closest("[data-v3-scroll]"); if (sc) { $(sc.dataset.v3Scroll)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const sf = t.closest("[data-v3-status-filter]"); if (sf) return openProposalsFiltered(sf.dataset.v3StatusFilter);
    const mail = t.closest("[data-v3-mail]"); if (mail) { const [id, tpl] = mail.dataset.v3Mail.split(":"); return sendQuickMail(id, tpl); }
    const msg = t.closest("[data-v3-msg]"); if (msg) { const [id, tpl] = msg.dataset.v3Msg.split(":"); return sendQuickMessage(id, tpl); }
    const st = t.closest("[data-v3-status]"); if (st) { const [id, status] = st.dataset.v3Status.split(":"); try { await setProposalStatus(id, status); } catch (er) { toast(er.message); } return; }
  });
  // Recarga de la pantalla "Mi día" cuando cambian los datos (guardados, estados, pagos…).
  new MutationObserver(queueEnhance).observe(document.body, { childList: true, subtree: true });

  /* ---------- enganches sobre panel-v2.js ---------- */
  const baseShell = shell;
  shell = function () { baseShell(); buildChrome(); };

  renderDashboard = renderDay;

  const baseRenderView = renderView;
  renderView = function () {
    baseRenderView();
    if (UF3.views[currentView]) { try { UF3.views[currentView](); } catch (e) { console.error(e); toast("No se pudo mostrar esta pantalla."); } }
    updateBadges(); queueEnhance();
  };

  const baseDetail = proposalDetail;
  proposalDetail = function (item) {
    const html = baseDetail(item);
    if (!item) return html;
    const sum = totals(item);
    let out = html.replace('<section class="v2-art-approval">', `${quickMsgSection(item)}${deliverySection(item)}<section class="v2-art-approval">`)
      .replace("<span>Pagado / señas</span>", "<span>Cobrado (validado)</span>");
    if (sum.pending > 0) out = out.replace('<div class="balance">', `<div class="pending"><span>Pagos por validar</span><b>${money(sum.pending)}</b></div><div class="balance">`);
    return out;
  };

  const baseNotifications = notifications;
  notifications = function () {
    const result = baseNotifications();
    state.proposals.forEach((p) => {
      const d = daysInStage(p);
      if (p.status === "Aprobada" && d >= 2) result.push({ id: `stuck:${p.id}`, title: "Aprobada sin producir", text: `${p.publicId} lleva ${d} días aprobada`, view: "propuestas", proposalId: p.id });
      if (p.status === "Lista" && d >= 7) result.push({ id: `pickup:${p.id}`, title: "Lista sin retirar", text: `${p.publicId} lista hace ${d} días`, view: "propuestas", proposalId: p.id });
    });
    if (can("payments.validate")) {
      const pend = pendingPayments();
      if (pend.length) result.push({ id: `pay-review:${pend.length}`, title: "Pagos por validar", text: `${pend.length} pago(s) · ${money(pend.reduce((s, { x }) => s + Number(x.amount || 0), 0))}`, view: "pagos" });
    }
    return result;
  };

  // Compuerta de entrega: no se entrega con saldo pendiente salvo autorización de un administrador (con motivo).
  const baseSetStatus = setProposalStatus;
  setProposalStatus = async function (id, status) {
    const item = proposal(id);
    if (item && status === "Entregada" && item.status !== "Entregada" && can("proposals.manage")) {
      const sum = totals(item);
      const revert = () => qa("[data-inline-status],[data-proposal-status]").forEach((s) => { if ((s.dataset.inlineStatus || s.dataset.proposalStatus) === id) s.value = item.status; });
      if (sum.balance > 0) {
        if (!can("settings.manage")) { revert(); toast(`No se puede entregar con saldo pendiente de ${money(sum.balance)}. Registrá el pago o pedí autorización a un administrador.`); return; }
        const reason = window.prompt(`El pedido ${item.publicId} tiene un saldo pendiente de ${money(sum.balance)}.\nPara entregarlo igual escribí el motivo (queda registrado):`);
        if (!reason || !reason.trim()) { revert(); return; }
        proposalEvent(item, "Entrega con saldo autorizada", `${currentUser.name || "Administrador"}: ${reason.trim()} (saldo ${money(sum.balance)})`);
      }
    }
    return baseSetStatus(id, status);
  };

  // Si el panel ya terminó de arrancar antes de cargar esta capa, reconstruir la interfaz.
  if (state && state.proposals && q(".nav-list") && q(".nav-list").children.length) { buildChrome(); renderView(); }
})();
