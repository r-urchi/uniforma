"use strict";

const $ = (id) => document.getElementById(id);
const q = (selector, root = document) => root.querySelector(selector);
const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const slug = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const today = () => {const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map((part)=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
const addDays = (days) => { const date = new Date(`${today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + Number(days || 0)); return date.toISOString().slice(0, 10); };
const dateLabel = (value) => value ? new Intl.DateTimeFormat("es-AR").format(new Date(`${value}T12:00:00`)) : "Sin fecha";
const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const readFile = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); });

let state = {};
let lastSavedState = {};
let currentUser = {};
let permissions = [];
let roles = {};
let users = [];
let currentView = "dashboard";
let selectedLogoId = "";
let editingDesignId = "";
let saveTimer = null;
let editorHistory = [];
let editorFuture = [];
let pointerSession = null;
let suppressStageClick = false;
let editorSide = "front";
let productionTouch = null;
let suppressProductionClick = false;
const collectionViews = { clientes: "kanban", catalogo: "kanban", propuestas: "lista", tareas: "kanban", usuarios: "lista" };

function icon(name, size = 19) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m4 10v-2a6 6 0 0 0-4-5.65"/>',
    factory: '<path d="M3 21V9l6 3V9l6 3V5l6-2v18zM3 21h18M7 16h1m4 0h1m4 0h1"/>',
    shirt: '<path d="m8 3-5 3-1 5 4 2 2-2v10h8V11l2 2 4-2-1-5-5-3a4 4 0 0 1-8 0z"/>',
    file: '<path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM14 2v6h5M8 13h8M8 17h8"/>',
    image: '<rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m3 18 5-5 4 3 4-5 5 6"/>',
    chart: '<path d="M4 20V4M4 20h17M8 16v-5m5 5V7m5 9V4"/>',
    shield: '<path d="m12 2 9 4v6c0 5-3.5 8.5-9 10-5.5-1.5-9-5-9-10V6zM9 12l2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M10 2h4l.6 2.2 2 .8 2-.9 2.8 2.8-.9 2 .8 2L23 12l-1.7 1.1-.8 2 .9 2-2.8 2.8-2-.9-2 .8L14 22h-4l-.6-2.2-2-.8-2 .9-2.8-2.8.9-2-.8-2L1 12l1.7-1.1.8-2-.9-2 2.8-2.8 2 .9 2-.8z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    kanban: '<rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="4" width="6" height="11" rx="1"/><rect x="16" y="4" width="6" height="14" rx="1"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 15h12v7H6zM17 12h1"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>'
  };
  return `<svg class="v2-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}
function viewSwitcher(view) { return `<div class="v2-view-switch" role="group" aria-label="Vista"><button data-view-mode="${view}:lista" class="${collectionViews[view]==="lista"?"active":""}" type="button" aria-pressed="${collectionViews[view]==="lista"}">${icon("list",16)} Lista</button><button data-view-mode="${view}:kanban" class="${collectionViews[view]==="kanban"?"active":""}" type="button" aria-pressed="${collectionViews[view]==="kanban"}">${icon("kanban",16)} Kanban</button></div>`; }
function setCollectionView(view, mode) {
  if (!Object.hasOwn(collectionViews, view) || !["lista", "kanban"].includes(mode)) return;
  const remembered = { clientSearchV2: $("clientSearchV2")?.value, productSearch: $("productSearch")?.value,
    proposalSearch: $("proposalSearch")?.value, proposalClientFilter: $("proposalClientFilter")?.value, proposalStatusFilter: $("proposalStatusFilter")?.value };
  collectionViews[view] = mode;
  renderView();
  for (const [id, value] of Object.entries(remembered)) if ($(id) && value !== undefined) $(id).value = value;
  if (view === "clientes") renderClientCards(remembered.clientSearchV2 || "");
  if (view === "catalogo") renderProductCards(remembered.productSearch || "");
  if (view === "propuestas") filterProposals();
}
function resetEditorDraft(productId=state.products[0]?.id||"") { state.editorDraft={productId,qty:0,logos:[]};ensureDraft();editingDesignId="";selectedLogoId="";editorSide="front";editorHistory=[];editorFuture=[]; }

const STATUS = ["Borrador", "Enviada", "Vista", "Aprobada", "Rechazada", "En producción", "Lista", "Entregada"];
const METHODS = ["Bordado", "DTF"];
const PAYMENT_METHODS = ["Transferencia", "Efectivo", "Mercado Pago", "Tarjeta", "Cheque", "Otro"];
const PRODUCTION_STEPS = [["materials", "Prendas e insumos listos"], ["customization", "Bordado / DTF terminado"], ["finishing", "Terminación y empaque"]];
const SAVED_STATE_KEYS = ["products", "clients", "tasks", "proposals", "activeProposalId", "catalogFilter", "editorDraft", "settings", "trash", "notificationsRead"];

function can(permission) { return permissions.includes(permission); }
function product(id) { return state.products.find((item) => item.id === id) || state.products[0] || {}; }
function client(id) { return state.clients.find((item) => item.id === id) || state.clients[0] || {}; }
function proposal(id = state.activeProposalId) { return state.proposals.find((item) => item.id === id) || null; }
function colorsOf(item) {
  if (Array.isArray(item.colors) && item.colors.length) return item.colors.map((color) => typeof color === "string" ? { name: color, hex: "#d8d1c7" } : color);
  return [{ name: "Blanco", hex: "#f5f3ed" }, { name: "Negro", hex: "#171717" }, { name: "Azul marino", hex: "#10294a" }, { name: "Beige", hex: "#cbb394" }];
}
function colorAllocations(record, item) {
  if (Array.isArray(record.colorQuantities) && record.colorQuantities.length) {
    return record.colorQuantities.map((entry) => ({
      color: String(entry.color || entry.name || ""),
      hex: String(entry.hex || colorsOf(item).find((c) => c.name === entry.color)?.hex || "#d8d1c7"),
      qty: Math.max(0, Math.floor(Number(entry.qty ?? entry.quantity) || 0))
    })).filter((entry) => entry.color);
  }
  const fallback = colorsOf(item)[0];
  return [{ color: record.color || fallback?.name || "Sin color", hex: record.colorHex || fallback?.hex || "#d8d1c7", qty: Math.max(1, Math.floor(Number(record.qty) || 1)) }];
}
function variantAllocations(record, item) {
  if (Array.isArray(record.colorSizeQuantities) && record.colorSizeQuantities.length) {
    return record.colorSizeQuantities.map((entry) => ({
      color: String(entry.color || ""), hex: String(entry.hex || colorsOf(item).find((color) => color.name === entry.color)?.hex || "#d8d1c7"),
      size: String(entry.size || record.size || sizesOf(item)[0] || "Único"),
      qty: Math.max(0, Math.floor(Number(entry.qty) || 0))
    })).filter((entry) => entry.color);
  }
  return colorAllocations(record, item).map((row) => ({ ...row, size: record.size || sizesOf(item)[0] || "Único" }));
}
function colorTotalsFromVariants(rows) {
  const totals = new Map();
  for (const row of rows) {
    if (!totals.has(row.color)) totals.set(row.color, { color: row.color, hex: row.hex, qty: 0 });
    totals.get(row.color).qty += Number(row.qty || 0);
  }
  return [...totals.values()];
}
function syncVariantTotals(record) { record.colorQuantities = colorTotalsFromVariants(record.colorSizeQuantities || []); }
function allocatedQuantity(record) { return Array.isArray(record.colorSizeQuantities) && record.colorSizeQuantities.length
  ? record.colorSizeQuantities.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  : (record.colorQuantities || []).reduce((sum, row) => sum + Number(row.qty || 0), 0); }
function variantSummary(record) {
  const rows = variantAllocations(record, product(record.productId)).filter((row) => row.qty > 0);
  return rows.map((row) => `${row.qty} ${row.color} ${row.size}`).join(" · ") || "Sin variantes asignadas";
}
function priceTierRows(item) {
  const tiers = item.prices || {};
  return Object.keys(tiers).map(Number).filter((tier) => Number.isFinite(tier) && Number(tiers[String(tier)]) > 0).sort((a, b) => a - b)
    .map((tier) => ({ tier, price: Number(tiers[String(tier)]) }));
}
function activeTier(item, qty) {
  const rows = priceTierRows(item);
  return rows.filter((row) => row.tier <= qty).pop() || rows[0] || null;
}
function tierHint(item, qty) {
  const rows = priceTierRows(item);
  if (!rows.length) return "";
  if (!qty) return "Escribí las cantidades por talle: el precio se ajusta solo.";
  if (qty < rows[0].tier) return `El primer tramo es desde ${rows[0].tier} prendas.`;
  const current = activeTier(item, qty), next = rows.find((row) => row.tier > qty);
  return next ? `Tramo x${current.tier}. Con ${next.tier - qty} prenda(s) más pasa a ${money(next.price)} (x${next.tier}).` : `Tramo x${current.tier}: es el mejor precio.`;
}
// Deja en el borrador todos los talles de la prenda para cada color elegido, conservando lo ya cargado.
function fillDraftGrid(draft, item) {
  const used = draft.colorSizeQuantities.filter((row) => row.qty > 0).map((row) => row.size);
  const sizes = [...new Set([...sizesOf(item), ...used])];
  const names = [...new Set(draft.colorSizeQuantities.map((row) => row.color))];
  const rows = [];
  for (const name of names) {
    const hex = draft.colorSizeQuantities.find((row) => row.color === name)?.hex || colorsOf(item).find((color) => color.name === name)?.hex || "#d8d1c7";
    for (const size of sizes) rows.push({ color: name, hex, size, qty: draft.colorSizeQuantities.find((row) => row.color === name && row.size === size)?.qty || 0 });
  }
  draft.colorSizeQuantities = rows;
  syncVariantTotals(draft);
}
// La cantidad total es la suma de los talles; el precio sigue el tramo salvo que se haya cambiado a mano.
function syncDraftQuantity(draft, item) {
  draft.qty = allocatedQuantity(draft);
  if (!draft.priceManual) draft.unitPrice = tierPrice(item, draft.qty);
}
function syncEditorColorFeedback() {
  const draft = state.editorDraft, item = product(draft.productId);
  syncDraftQuantity(draft, item);
  qa("[data-color-total]").forEach((node)=>{node.textContent=draft.colorQuantities.find((row)=>row.color===node.dataset.colorTotal)?.qty||0;});
  if ($("editorTotalQty")) $("editorTotalQty").textContent = draft.qty;
  if ($("editorPriceV2") && document.activeElement !== $("editorPriceV2")) $("editorPriceV2").value = draft.unitPrice;
  const tier = activeTier(item, draft.qty);
  qa("[data-price-tier]").forEach((node) => node.classList.toggle("on", Boolean(tier) && Number(node.dataset.priceTier) === tier.tier));
  if ($("editorSubtotal")) $("editorSubtotal").textContent = money(draft.qty * draft.unitPrice);
  if ($("editorTierHint")) $("editorTierHint").textContent = tierHint(item, draft.qty);
  qa("[data-auto-price]").forEach((node) => { node.hidden = !draft.priceManual; });
}
function colorSummary(record) {
  return colorAllocations(record, product(record.productId)).filter((row) => row.qty > 0)
    .map((row) => `${row.qty} ${row.color}`).join(" · ") || "Sin colores asignados";
}
function searchText(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR"); }
function positiveCm(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function garmentScale(item, draft = state.editorDraft) {
  const chart = (item.sizeChart || []).find((row) => searchText(row.size) === searchText(draft.size));
  return { width: positiveCm(draft.previewWidthCm) || positiveCm(chart?.width), height: positiveCm(draft.previewHeightCm) || positiveCm(chart?.length) };
}
function cmLabel(value) { return Number(value).toLocaleString("es-AR", { maximumFractionDigits: 1 }); }
function logoCm(logo, axis, draft = state.editorDraft, item = product(draft.productId)) {
  const key = axis === "width" ? "widthCm" : "heightCm";
  const explicit = positiveCm(logo[key]);
  if (explicit) return explicit;
  const scale = garmentScale(item, draft);
  return scale[axis] ? Math.round(Number(logo[axis]) * scale[axis]) / 100 : 0;
}
function tintColor(logo) { return /^#[\da-f]{6}$/i.test(logo.tintColor || "") ? logo.tintColor : ""; }
function logoArtwork(logo) {
  const tint = tintColor(logo);
  if (!tint) return `<img src="${esc(logo.src)}" alt="${esc(logo.name || "Logo")}">`;
  const source = esc(JSON.stringify(String(logo.src || "")));
  return `<span class="v2-logo-tint" style="background-color:${tint};mask-image:url(${source});-webkit-mask-image:url(${source})" role="img" aria-label="${esc(logo.name || "Logo")}"></span>`;
}
function sizesOf(item) {
  const values = Array.isArray(item.sizeOptions) && item.sizeOptions.length
    ? item.sizeOptions
    : String(item.sizes || "S,M,L,XL,XXL").split(/[,;/]|\sal\s/i);
  const letterOrder = { XXS: 10, XS: 20, S: 30, M: 40, L: 50, XL: 60, XXL: 70, XXXL: 80, XXXXL: 90 };
  const rank = (value) => {
    const key = String(value).trim().toUpperCase().replace(/\s+/g, "");
    if (letterOrder[key]) return [1, letterOrder[key], key];
    if (/^\d+(?:[.,]\d+)?E$/.test(key)) return [3, Number(key.slice(0, -1).replace(",", ".")), key];
    if (/^\d+(?:[.,]\d+)?$/.test(key)) return [2, Number(key.replace(",", ".")), key];
    if (["UNICO", "ÚNICO", "TALLEUNICO", "TALLEÚNICO", "REGULABLE"].includes(key)) return [5, 0, key];
    return [4, 0, key];
  };
  return [...new Set(values.map((size) => String(size).trim()).filter(Boolean))].sort((left, right) => {
    const a = rank(left), b = rank(right);
    return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2], "es", { numeric: true });
  });
}
function methodsOf(item) { return Array.isArray(item.methods) && item.methods.length ? item.methods : METHODS; }
function tierPrice(item, qty) {
  const tiers = item.prices || {};
  const quantity = Math.max(1, Number(qty || 1));
  const available = Object.keys(tiers).map(Number).filter((tier) => Number.isFinite(tier) && Number(tiers[String(tier)]) > 0).sort((a, b) => a - b);
  const applicable = available.filter((tier) => tier <= quantity).pop() ?? available[0];
  return Number((applicable !== undefined ? tiers[String(applicable)] : undefined) ?? item.basePrice ?? 0);
}
function techniqueCost(method) {
  const configured=state.settings.techniqueCosts?.[method]||{};
  return {unit:Math.max(0,Number(configured.unit)||0),setup:Math.max(0,Number(configured.setup)||0)};
}
function designCost(design) {
  const garment=product(design.productId),garmentCost=Math.max(0,Number(garment.unitCost)||0);
  let unit=garmentCost,setup=0;
  const missing=[];
  if(!garmentCost)missing.push(`Costo de ${garment.name||"prenda"}`);
  for(const logo of design.logos||[]){
    const method=logo.technique||design.method||"Bordado",cost=techniqueCost(method);
    unit+=cost.unit;setup+=cost.setup;
    if(!cost.unit)missing.push(`Costo ${method}`);
  }
  const qty=Math.max(1,Number(design.qty)||1);
  return {unit,setup,total:qty*unit+setup,missing:[...new Set(missing)]};
}
function suggestedUnitPrice(design) {
  const cost=designCost(design),margin=Math.min(90,Math.max(0,Number(state.settings.defaultMargin??35)));
  if(cost.missing.length)return null;
  return Math.ceil(((cost.total/Math.max(1,Number(design.qty)||1))/(1-margin/100))/100)*100;
}
function proposalCost(item) {
  const lines=(item.designs||[]).map(designCost),shippingCost=Math.max(0,Number(item.shippingCost)||0);
  const cost=lines.reduce((sum,line)=>sum+line.total,0)+shippingCost;
  const t=totals(item),revenue=t.subtotal-t.discount+Number(item.surcharge||0)+Number(item.shipping||0);
  const missing=lines.flatMap((line)=>line.missing);
  if(Number(item.shipping||0)>0&&!shippingCost)missing.push("Costo interno del envío");
  return {cost,revenue,profit:revenue-cost,margin:revenue>0?(revenue-cost)/revenue*100:0,missing:[...new Set(missing)]};
}
function productionOf(design) {
  const current=design.production||{};
  return {materials:Boolean(current.materials),customization:Boolean(current.customization),finishing:Boolean(current.finishing),
    quality:["Pendiente","Aprobada","Rehacer"].includes(current.quality)?current.quality:"Pendiente",
    qualityNote:String(current.qualityNote||""),checkedBy:String(current.checkedBy||""),checkedAt:String(current.checkedAt||""),
    responsible:String(current.responsible||""),dueDate:String(current.dueDate||"")};
}
function productionProgress(design) {
  const row=productionOf(design),done=PRODUCTION_STEPS.filter(([key])=>row[key]).length;
  return {done,total:PRODUCTION_STEPS.length,quality:row.quality,ready:done===PRODUCTION_STEPS.length&&row.quality==="Aprobada"};
}
function productionUrgency(item) {
  if(!item.deliveryDate||item.status==="Entregada")return "";
  if(item.deliveryDate<today())return "Vencida";
  if(item.deliveryDate<=addDays(3))return "Próxima";
  return "";
}
function stockPlan() {
  const plan=new Map();
  for(const sale of state.proposals){
    if(!["Aprobada","En producción","Lista"].includes(sale.status))continue;
    for(const design of sale.designs||[])for(const variant of variantAllocations(design,product(design.productId))){
      if(!variant.qty)continue;
      const key=JSON.stringify([design.productId,variant.color,variant.size]);
      if(!plan.has(key))plan.set(key,{productId:design.productId,color:variant.color,size:variant.size,needed:0});
      plan.get(key).needed+=variant.qty;
    }
  }
  return [...plan.values()].map((row)=>{
    const garment=state.products.find((entry)=>entry.id===row.productId)||{};
    const configured=Array.isArray(garment.stockVariants)&&garment.stockVariants.length>0;
    const stock=configured?Number(garment.stockVariants.find((entry)=>entry.color===row.color&&entry.size===row.size)?.qty||0):null;
    return {...row,productName:garment.name||"Prenda no disponible",stock,shortage:stock===null?null:Math.max(0,row.needed-stock)};
  }).sort((a,b)=>(b.shortage??-1)-(a.shortage??-1)||a.productName.localeCompare(b.productName,"es"));
}
function normalize() {
  state.products = Array.isArray(state.products) ? state.products : [];
  state.clients = Array.isArray(state.clients) ? state.clients : [];
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.proposals = Array.isArray(state.proposals) ? state.proposals : [];
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.trash = Array.isArray(state.trash) ? state.trash : [];
  state.notificationsRead = Array.isArray(state.notificationsRead) ? state.notificationsRead : [];
  state.settings = state.settings || {};
  state.settings.statuses = STATUS;
  state.settings.defaultMargin = Number(state.settings.defaultMargin ?? 35);
  state.settings.techniqueCosts = state.settings.techniqueCosts || {};
  for(const method of METHODS)state.settings.techniqueCosts[method]=techniqueCost(method);
  state.products.forEach((item)=>{
    item.unitCost=Math.max(0,Number(item.unitCost)||0);
    item.stockVariants=Array.isArray(item.stockVariants)?item.stockVariants.filter((row)=>row&&row.color&&row.size).map((row)=>({color:String(row.color),size:String(row.size),qty:Math.max(0,Math.floor(Number(row.qty)||0))})):[];
  });
  state.proposals.forEach((item, index) => {
    if (item.status === "En produccion") item.status = "En producción";
    item.publicId = item.publicId || `${state.settings.quotePrefix || "UNF"}-${String(index + 1).padStart(4, "0")}`;
    item.title = item.title || `Propuesta ${item.publicId}`;
    item.createdDate = item.createdDate || item.updatedDate || today();
    item.updatedDate = item.updatedDate || today();
    item.validUntil = item.validUntil || addDays(state.settings.validityDays || 7);
    item.deliveryDate = item.deliveryDate || addDays(state.settings.productionDays || 14);
    item.priority = item.priority || "Media";
    item.designs = Array.isArray(item.designs) ? item.designs : [];
    item.payments = Array.isArray(item.payments) ? item.payments : [];
    item.history = Array.isArray(item.history) ? item.history : [];
    item.designRevision = Math.max(item.designs.length ? 1 : 0, Number(item.designRevision || 0));
    item.approvalHistory = Array.isArray(item.approvalHistory) ? item.approvalHistory : [];
    item.artApproval = item.artApproval || null;
    item.paymentTerms = item.paymentTerms || "Efectivo / transferencia";
    item.discount = Number(item.discount || 0);
    item.surcharge = Number(item.surcharge || 0);
    item.shipping = Number(item.shipping || 0);
    item.shippingCost = Math.max(0,Number(item.shippingCost)||0);
    item.taxRate = Number(item.taxRate ?? state.settings.taxRate ?? 0);
    item.notes = item.notes || "";
    item.internalNotes = item.internalNotes || "";
    item.designs.forEach((design) => {
      design.productId = design.productId || state.products[0]?.id || "";
      design.qty = [5, 10, 20, 50].includes(Number(design.qty)) ? Number(design.qty) : Math.max(1, Number(design.qty || 5));
      design.size = design.size || sizesOf(product(design.productId))[0] || "Único";
      design.color = design.color || "Negro";
      design.colorHex = design.colorHex || colorsOf(product(design.productId)).find((c) => c.name === design.color)?.hex || "#171717";
      design.colorSizeQuantities = variantAllocations(design, product(design.productId));
      syncVariantTotals(design);
      design.method = design.method || "Bordado";
      design.placement = design.placement || "Frente";
      design.unitPrice = Number(design.unitPrice || tierPrice(product(design.productId), design.qty));
      if (design.logo && !design.logos) design.logos = [{ id: uid("logo"), src: state.editor?.logoData || "", name: "Logo", x: design.logo.x || 50, y: design.logo.y || 40, width: 22 * (design.logo.scale || 1), height: 16 * (design.logo.scale || 1), rotation: design.logo.rotation || 0, locked: true }].filter((logo) => logo.src);
      design.logos = Array.isArray(design.logos) ? design.logos : [];
      design.production = productionOf(design);
      design.logos.forEach((logo) => {
        delete logo.opacity;
        logo.technique = logo.technique || design.method || "Bordado";
        logo.logoColor = logo.logoColor || "Según archivo";
        logo.side = logo.side || (/espalda|atrás|atras/i.test(logo.placement || design.placement || "") ? "back" : "front");
        logo.placement = logo.placement || design.placement || (logo.side === "back" ? "Espalda" : "Frente");
        logo.note = logo.note || "";
      });
    });
  });
  if (!state.activeProposalId && state.proposals[0]) state.activeProposalId = state.proposals[0].id;
  ensureDraft();
}

function ensureDraft() {
  const first = state.products[0] || {};
  const existing = state.editorDraft || {};
  const item = product(existing.productId || first.id);
  const hasQuantities = (Array.isArray(existing.colorSizeQuantities) && existing.colorSizeQuantities.length) || Number(existing.qty) > 0;
  const qty = hasQuantities ? Math.max(1, Number(existing.qty || 1)) : 0;
  const firstColor = colorsOf(item).find((color) => color.name === existing.color) || colorsOf(item)[0];
  const variants = hasQuantities
    ? variantAllocations({ ...existing, qty }, item)
    : [{ color: firstColor.name, hex: firstColor.hex, size: sizesOf(item)[0] || "Único", qty: 0 }];
  state.editorDraft = {
    productId: item.id || "", color: existing.color || colorsOf(item)[0]?.name || "Blanco", colorHex: existing.colorHex || colorsOf(item)[0]?.hex || "#eee",
    size: existing.size || sizesOf(item)[0] || "Único", qty, method: existing.method || methodsOf(item)[0] || "Bordado", placement: existing.placement || "Frente",
    unitPrice: Number(existing.unitPrice || tierPrice(item, qty)), note: existing.note || "", logos: Array.isArray(existing.logos) ? existing.logos : [],
    colorSizeQuantities: variants, colorQuantities: colorTotalsFromVariants(variants), priceManual: existing.priceManual === true,
    previewWidthCm: existing.previewWidthCm || "", previewHeightCm: existing.previewHeightCm || ""
  };
  fillDraftGrid(state.editorDraft, item);
  syncDraftQuantity(state.editorDraft, item);
}

function totals(item) {
  const subtotal = (item?.designs || []).reduce((sum, design) => sum + Number(design.qty || 0) * Number(design.unitPrice || 0), 0);
  const discount = subtotal * Number(item?.discount || 0) / 100;
  const base = subtotal - discount + Number(item?.surcharge || 0) + Number(item?.shipping || 0);
  const tax = base * Number(item?.taxRate || 0) / 100;
  const total = Math.max(0, base + tax);
  const paid = (item?.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return { subtotal, discount, tax, total, paid, balance: Math.max(0, total - paid), credit: Math.max(0, paid - total) };
}

function audit(action, detail) {
  state.auditLog.unshift({ id: uid("audit"), at: new Date().toISOString(), userId: currentUser.id || "", userName: currentUser.name || "Equipo", action, detail });
  state.auditLog = state.auditLog.slice(0, 250);
}
function proposalEvent(item, action, detail = "") {
  item.history.unshift({ id: uid("history"), at: new Date().toISOString(), userName: currentUser.name || "Equipo", action, detail });
  item.updatedDate = today();
  audit(action, `${item.publicId}: ${detail}`);
}
function markDesignChanged(item) { item.designRevision = Number(item.designRevision || 0) + 1; }

async function api(action, payload = {}) {
  const response = await fetch("api.php", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": window.UNIFORMA_BOOT.csrf }, body: JSON.stringify({ action, ...payload }) });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    throw new Error(`El servidor devolvió una respuesta inválida (HTTP ${response.status}). Revisá el registro de errores PHP.`);
  }
  if (!data) {
    throw new Error(`El servidor no respondió (HTTP ${response.status}). El límite de carga o un error PHP está bloqueando la operación.`);
  }
  if (response.status === 409 && data.conflict) { await reloadFromServer(); throw new Error(data.error); }
  if (!response.ok || !data.ok) { const failure = new Error(data.error || `No se pudo completar la operación (HTTP ${response.status})`); failure.details = data.details; throw failure; }
  if (data.csrf) window.UNIFORMA_BOOT.csrf = data.csrf;
  if (data.state) state = data.state;
  if (data.user) currentUser = data.user;
  if (data.permissions) permissions = data.permissions;
  if (data.roles) roles = data.roles;
  if (data.users) users = data.users;
  normalize();
  lastSavedState = clone(state);
  return data;
}
async function reloadFromServer() {
  const response = await fetch("api.php");
  const data = await response.json();
  if (!data || !data.ok) return;
  state = data.state; if (data.csrf) window.UNIFORMA_BOOT.csrf = data.csrf;
  normalize(); lastSavedState = clone(state); renderView();
}
function pendingStateChanges() {
  const changes = {};
  for (const key of SAVED_STATE_KEYS) {
    if (JSON.stringify(state[key] ?? null) !== JSON.stringify(lastSavedState[key] ?? null)) changes[key] = state[key] ?? null;
  }
  return changes;
}
async function save(message = "") {
  setSaveStatus("Guardando…");
  try {
    const changes = pendingStateChanges();
    if (Object.keys(changes).length) await api("save_changes", { changes, baseRevision: lastSavedState.stateRevision });
    setSaveStatus("Guardado");
    if (message) toast(message);
  } catch (error) {
    setSaveStatus("Error al guardar");
    throw error;
  }
}
function scheduleSave() { clearTimeout(saveTimer); setSaveStatus("Cambios pendientes"); saveTimer = setTimeout(() => save().catch((error) => toast(error.message)), 1200); }
function setSaveStatus(text) { const element = $("autosaveStatus"); if (element) element.textContent = text; }
function toast(message) { const element = $("toast"); element.textContent = message; element.classList.add("show"); setTimeout(() => element.classList.remove("show"), 2600); }

function shell() {
  q(".nav-list").innerHTML = [
    ["dashboard", "Inicio", "dashboard.view", "home"], ["clientes", "Clientes", "clients.view", "users"], ["tareas", "Producción", "tasks.view", "factory"], ["catalogo", "Productos", "catalog.view", "shirt"],
    ["propuestas", "Propuestas", "proposals.view", "file"], ["editor", "Editor visual", "editor.use", "image"], ["reportes", "Reportes", "reports.view", "chart"], ["usuarios", "Usuarios", "users.manage", "shield"], ["configuracion", "Configuración", "settings.manage", "settings"]
  ].filter(([, , permission]) => can(permission)).map(([view, label, , symbol]) => `<button class="nav-item" data-go="${view}" type="button"><span class="v2-nav-icon">${icon(symbol)}</span>${label}</button>`).join("") + (can("editor.use") ? `<a class="nav-item" href="estudio.php" style="text-decoration:none"><span class="v2-nav-icon">${icon("image")}</span>Estudio de logos</a>` : "");
  q(".topbar").innerHTML = `<button class="v2-menu" id="mobileMenu" type="button" aria-label="Abrir menú">${icon("menu",22)}</button><label class="search-box"><span>${icon("search",18)}</span><input id="globalSearch" type="search" placeholder="Buscar clientes, propuestas o productos…"></label><span id="autosaveStatus" class="save-status">Guardado</span><div class="notification-wrap"><button class="notification-button" id="notificationBtn" type="button" aria-label="Notificaciones">${icon("bell",19)}<b id="notificationCount">0</b></button><div class="notification-panel" id="notificationPanel" hidden></div></div><div class="profile"><div class="avatar">${esc((currentUser.name || "U")[0])}</div><div><strong>${esc(currentUser.name || "UNIFORMA")}</strong><small>${esc(roles[currentUser.role]?.label || currentUser.role || "Equipo")}</small></div></div><button class="ghost-button" id="logoutBtn" type="button">Salir</button>`;
  qa(".view").forEach((view) => view.innerHTML = "");
  document.body.insertAdjacentHTML("beforeend", `<div class="v2-modal" id="v2Modal" hidden><div class="v2-modal__backdrop" data-close-modal></div><section class="v2-modal__card"><button class="v2-modal__close" data-close-modal type="button">×</button><div id="v2ModalBody"></div></section></div>`);
}

function viewHeader(title, subtitle, action = "") {
  const symbols={"Clientes":"users","Productos":"shirt","Propuestas":"file","Producción":"factory","Editor visual":"image","Reportes":"chart","Usuarios":"shield","Configuración":"settings"};
  return `<div class="page-heading"><div><h1>${icon(symbols[title]||"home",25)} ${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function empty(text) { return `<div class="v2-empty">${esc(text)}</div>`; }
function statusOptions(value) { return STATUS.map((status) => `<option ${status === value ? "selected" : ""}>${status}</option>`).join(""); }
function proposalOptions(value = "") { return state.proposals.map((item) => `<option value="${item.id}" ${item.id === value ? "selected" : ""}>${esc(item.publicId)} · ${esc(client(item.clientId).company)}</option>`).join(""); }
function clientOptions(value = "") { return state.clients.map((item) => `<option value="${item.id}" ${item.id === value ? "selected" : ""}>${esc(item.company)}</option>`).join(""); }
function refreshProposalClientOptions(show = true) {
  const form = $("proposalFormV2");
  if (!form) return;
  const query = searchText($("proposalClientSearch")?.value).trim();
  const matches = state.clients.filter((item) =>
    [item.company, item.contact, item.cuit, item.phone, item.email].some((value) =>
      searchText(value).includes(query)
    )
  ).slice(0, 12);
  const results = $("proposalClientResults");
  results.innerHTML = matches.length ? matches.map((item) =>
    `<button type="button" data-choose-client-id="${esc(item.id)}"><strong>${esc(item.company)}</strong><small>${esc([item.contact !== item.company ? item.contact : "", item.phone, item.cuit].filter(Boolean).join(" · "))}</small></button>`
  ).join("") : `<p>No hay clientes que coincidan. Podés cargar uno nuevo.</p>`;
  results.hidden = !show;
}
function chooseProposalClient(id) {
  const form = $("proposalFormV2");
  const item = state.clients.find((entry) => entry.id === id);
  if (!form || !item) return;
  form.elements.clientId.value = item.id;
  $("proposalClientSearch").value = item.company;
  $("proposalClientResults").hidden = true;
  $("proposalClientSelected").textContent = `Seleccionado: ${item.company}${item.phone ? ` · ${item.phone}` : ""}`;
}
function toggleProposalClientMode() {
  const form = $("proposalFormV2");
  if (!form) return;
  const mode = form.elements.clientMode.value;
  for (const section of form.querySelectorAll("[data-client-section]")) {
    const inactive = section.dataset.clientSection !== mode;
    section.disabled = inactive;
    section.hidden = inactive;
  }
}
function duplicateClientFor(input) {
  const cuit = String(input.cuit || "").replace(/\D/g, "");
  const email = String(input.email || "").trim().toLocaleLowerCase("es-AR");
  const phone = String(input.phone || "").replace(/\D/g, "");
  const name = slug(input.company);
  return state.clients.find((item) =>
    (cuit.length >= 8 && cuit === String(item.cuit || "").replace(/\D/g, "")) ||
    (email && email === String(item.email || "").trim().toLocaleLowerCase("es-AR")) ||
    (phone.length >= 8 && phone === String(item.phone || "").replace(/\D/g, "") && name === slug(item.company))
  );
}
function productOptions(value = "") { return state.products.map((item) => `<option value="${item.id}" ${item.id === value ? "selected" : ""}>${esc(item.name)}</option>`).join(""); }
function renderEditorProductResults(show = true) {
  const results = $("editorProductResults");
  if (!results) return;
  const query = searchText($("editorProductSearch")?.value).trim();
  const matches = state.products.filter((item) =>
    [item.name, item.category, item.sku].some((value) => searchText(value).includes(query))
  ).slice(0, 12);
  results.innerHTML = matches.length ? matches.map((item) =>
    `<button type="button" data-editor-product="${esc(item.id)}"><strong>${esc(item.name)}</strong><small>${esc([item.category, item.sku].filter(Boolean).join(" · "))}</small></button>`
  ).join("") : `<p>No hay prendas que coincidan.</p>`;
  results.hidden = !show;
}
function applyLogoCmScale() {
  const scale = garmentScale(product(state.editorDraft.productId));
  for (const logo of state.editorDraft.logos) {
    if (scale.width && positiveCm(logo.widthCm)) logo.width = Math.max(2, Math.min(95, positiveCm(logo.widthCm) / scale.width * 100));
    if (scale.height && positiveCm(logo.heightCm)) logo.height = Math.max(2, Math.min(95, positiveCm(logo.heightCm) / scale.height * 100));
  }
}
function setLogoCentimeters(logo, axis, value) {
  const previous = logoCm(logo, axis);
  const opposite = axis === "width" ? "height" : "width";
  const previousOpposite = logoCm(logo, opposite);
  const centimeters = positiveCm(value);
  logo[`${axis}Cm`] = centimeters || "";
  if (centimeters && logo.locked !== false && previous && previousOpposite) {
    logo[`${opposite}Cm`] = Math.round(centimeters * previousOpposite / previous * 10) / 10;
  }
  applyLogoCmScale();
}
function chooseEditorProduct(id) {
  const item = state.products.find((entry) => entry.id === id);
  if (!item) return;
  pushHistory();
  const draft = state.editorDraft;
  const first = colorsOf(item)[0];
  draft.productId = item.id;
  draft.color = first.name;
  draft.colorHex = first.hex;
  draft.size = sizesOf(item)[0] || "Único";
  draft.colorSizeQuantities = [{ color: first.name, hex: first.hex, size: draft.size, qty: 0 }];
  draft.priceManual = false;
  fillDraftGrid(draft, item);
  syncDraftQuantity(draft, item);
  draft.previewWidthCm = "";
  draft.previewHeightCm = "";
  applyLogoCmScale();
  selectedLogoId = "";
  scheduleSave();
  rerenderEditor();
}
function makeEditorLogo(name, src) { return {id:uid("logo"),name,src,x:50,y:42,width:22,height:16,rotation:0,locked:true,technique:methodsOf(product(state.editorDraft.productId))[0]||"Bordado",logoColor:"Según archivo",tintColor:"",widthCm:"",heightCm:"",side:editorSide,placement:editorSide==="back"?"Espalda":"Frente",note:""}; }
function setEditorTotalQuantity(value) {
  const draft = state.editorDraft;
  const qty = Math.max(1, Math.floor(Number(value) || 1));
  let difference = qty - allocatedQuantity(draft);
  const active = draft.colorSizeQuantities.find((row) => row.color === draft.color && row.size === draft.size) || draft.colorSizeQuantities[0];
  if (difference > 0 && active) active.qty += difference;
  if (difference < 0) {
    for (const row of [active, ...draft.colorSizeQuantities.filter((entry) => entry !== active).reverse()]) {
      const removed = Math.min(row.qty, -difference);
      row.qty -= removed;
      difference += removed;
      if (!difference) break;
    }
  }
  draft.qty = qty;
  syncVariantTotals(draft);
  draft.unitPrice = tierPrice(product(draft.productId), qty);
}

function renderDashboard() {
  const active = state.proposals.filter((item) => !["Rechazada", "Entregada"].includes(item.status));
  const outstanding = state.proposals.filter((item)=>["Aprobada","En producción","Lista","Entregada"].includes(item.status)).reduce((sum, item) => sum + totals(item).balance, 0);
  const upcoming = state.proposals.filter((item) => item.deliveryDate && item.deliveryDate >= today() && item.deliveryDate <= addDays(7) && ["Aprobada","En producción","Lista"].includes(item.status));
  const overdue=state.proposals.filter((item)=>["Aprobada","En producción","Lista"].includes(item.status)&&productionUrgency(item)==="Vencida");
  const plan=stockPlan(),shortages=plan.filter((row)=>row.shortage>0),unknownStock=plan.filter((row)=>row.stock===null);
  const artPending=state.proposals.filter((item)=>["Aprobada","En producción","Lista"].includes(item.status)&&item.designs.length&&!item.artApproval);
  const qualityPending=state.proposals.filter((item)=>["En producción","Lista"].includes(item.status)).flatMap((item)=>item.designs).filter((design)=>!productionProgress(design).ready);
  $("view-dashboard").innerHTML = `${viewHeader(`Hola, ${esc((currentUser.name || "equipo").split(" ")[0])}`, "Control comercial, pagos y producción en un solo lugar.", `<button class="primary-button" data-new-proposal>Nueva propuesta</button>`)}
  <div class="v2-metrics"><article><small>Propuestas activas</small><strong>${active.length}</strong></article><article><small>Saldo por cobrar</small><strong>${money(outstanding)}</strong></article><article><small>En producción</small><strong>${state.proposals.filter((p) => p.status === "En producción").length}</strong></article><article><small>Entregas próximas</small><strong>${upcoming.length}</strong></article></div>
  ${(overdue.length||shortages.length||unknownStock.length||artPending.length||qualityPending.length)?`<div class="v2-operational-alerts">${overdue.length?`<button data-go="tareas" type="button">${overdue.length} entrega(s) vencida(s)</button>`:""}${shortages.length?`<button data-go="tareas" type="button">${shortages.length} variante(s) con faltantes</button>`:""}${unknownStock.length?`<button data-go="tareas" type="button">${unknownStock.length} variante(s) sin stock cargado</button>`:""}${qualityPending.length?`<button data-go="tareas" type="button">${qualityPending.length} prenda(s) pendientes de control</button>`:""}${artPending.length?`<button data-go="propuestas" type="button">${artPending.length} diseño(s) sin aprobación registrada</button>`:""}</div>`:""}
  <div class="v2-two"><section class="surface"><div class="section-row"><h2>Propuestas recientes</h2><button class="text-button" data-go="propuestas">Ver todas</button></div>${proposalRows(state.proposals.slice().sort((a,b) => b.updatedDate.localeCompare(a.updatedDate)).slice(0,6))}</section>
  <section class="surface"><div class="section-row"><h2>Alertas de hoy</h2><button class="text-button" data-toggle-notifications>Ver todas</button></div>${notificationRows(notifications().slice(0,6))}</section></div>`;
}
function proposalRows(items) {
  return items.length ? `<div class="v2-list">${items.map((item) => { const sum = totals(item); return `<button class="v2-row" data-open-proposal="${item.id}" type="button"><div><strong>${esc(item.publicId)} · ${esc(client(item.clientId).company)}</strong><small>${item.designs.length} prenda(s) · ${dateLabel(item.updatedDate)}</small></div><span class="v2-status status-${slug(item.status)}">${esc(item.status)}</span><b>${money(sum.total)}</b></button>`; }).join("")}</div>` : empty("Todavía no hay propuestas.");
}
function renderClients() {
  $("view-clientes").innerHTML = `${viewHeader("Clientes", "Cada cliente puede tener múltiples propuestas, logos, pagos e historial.", can("clients.manage") ? `<button class="primary-button" data-new-client>Nuevo cliente</button>` : "")}
  <section class="surface"><div class="v2-toolbar"><input id="clientSearchV2" type="search" placeholder="Buscar empresa, contacto, CUIT o teléfono"><span>${state.clients.length} clientes</span>${viewSwitcher("clientes")}</div><div id="clientCards"></div></section>`;
  renderClientCards();
}
function clientActions(item) { return `<div class="button-row"><button data-client-proposals="${esc(item.id)}">Ver propuestas</button>${can("proposals.manage") ? `<button data-new-proposal="${esc(item.id)}">Nueva propuesta</button>` : ""}${can("clients.manage") ? `<button data-edit-client="${esc(item.id)}">Editar</button><button class="danger" data-trash-client="${esc(item.id)}">Borrar</button>` : ""}</div>`; }
function renderClientCards(query = "") {
  const target = $("clientCards"); if (!target) return;
  const list = state.clients.filter((item) => searchText([item.company,item.contact,item.cuit,item.phone,item.email].join(" ")).includes(searchText(query)));
  if (!list.length) { target.innerHTML=empty("No hay clientes que coincidan con la búsqueda."); return; }
  if (collectionViews.clientes === "lista") {
    target.innerHTML=`<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Teléfono</th><th>Propuestas</th><th>Acciones</th></tr></thead><tbody>${list.map((item)=>`<tr><td><strong>${esc(item.company)}</strong></td><td>${esc(item.contact||"")}</td><td>${esc(item.phone||"")}</td><td>${state.proposals.filter((p)=>p.clientId===item.id).length}</td><td>${clientActions(item)}</td></tr>`).join("")}</tbody></table></div>`;
    return;
  }
  const groups=["Alta","Media","Baja","Sin prioridad"];
  target.innerHTML=`<div class="v2-collection-board">${groups.map((priority)=>{const entries=list.filter((item)=>(item.priority||"Sin prioridad")===priority);return `<section class="v2-board-column"><h3>${priority}<b>${entries.length}</b></h3>${entries.map((item)=>{const props=state.proposals.filter((p)=>p.clientId===item.id);return `<article class="v2-board-card"><strong>${esc(item.company)}</strong><small>${esc(item.contact||"")} · ${esc(item.phone||"")}</small><small>${props.length} propuesta(s)</small>${clientActions(item)}</article>`;}).join("")||empty("Sin clientes")}</section>`;}).join("")}</div>`;
}

function renderCatalog() {
  const catalogActions = can("catalog.manage") ? `<div class="button-row"><button data-sync-catalog>Sincronizar con la web</button><button class="primary-button" data-new-product>Nuevo producto manual</button></div>` : "";
  $("view-catalogo").innerHTML = `${viewHeader("Productos", `Catálogo vinculado con WooCommerce${state.catalogSyncedAt ? ` · Última sincronización ${new Date(state.catalogSyncedAt).toLocaleString("es-AR")}` : ""}.`, catalogActions)}
  <section class="surface"><div class="v2-toolbar"><input id="productSearch" type="search" placeholder="Buscar producto o categoría"><span>${state.products.length} productos</span>${viewSwitcher("catalogo")}</div><div id="productCards"></div></section>`;
  renderProductCards();
}
function productActions(item) { return `<div class="button-row">${can("editor.use")?`<button data-use-product="${esc(item.id)}">Diseñar</button>`:""}${can("catalog.manage") ? `<button data-edit-product="${esc(item.id)}">Editar</button><button data-stock-product="${esc(item.id)}">Stock</button><button class="danger" data-trash-product="${esc(item.id)}">Borrar</button>` : ""}</div>`; }
function stockSummary(item) { return item.stockVariants?.length?`${item.stockVariants.reduce((sum,row)=>sum+Number(row.qty||0),0)} u. cargadas`:"Sin cargar"; }
function renderProductCards(query = "") {
  const target = $("productCards"); if (!target) return;
  const list = state.products.filter((item) => searchText(`${item.name} ${item.category} ${item.sku||""}`).includes(searchText(query)));
  if (!list.length) {target.innerHTML=empty("No se encontraron productos.");return;}
  if (collectionViews.catalogo === "lista") {
    target.innerHTML=`<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Colores</th><th>Talles</th><th>Precio x5</th><th>Stock</th><th>Acciones</th></tr></thead><tbody>${list.map((item)=>`<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.category||"")}</td><td>${colorsOf(item).length}</td><td>${sizesOf(item).length}</td><td>${money(tierPrice(item,5))}</td><td>${stockSummary(item)}</td><td>${productActions(item)}</td></tr>`).join("")}</tbody></table></div>`;
    return;
  }
  const groups=[...new Set(list.map((item)=>item.category||"Sin categoría"))];
  target.innerHTML=`<div class="v2-collection-board">${groups.map((category)=>{const entries=list.filter((item)=>(item.category||"Sin categoría")===category);return `<section class="v2-board-column"><h3>${esc(category)}<b>${entries.length}</b></h3>${entries.map((item)=>`<article class="v2-board-card"><img class="v2-board-product-image" src="${esc(item.image||"")}" alt=""><strong>${esc(item.name)}</strong><small>${colorsOf(item).length} colores · ${sizesOf(item).length} talles</small><small>Desde ${money(tierPrice(item,5))}</small><small>Stock: ${stockSummary(item)}</small>${productActions(item)}</article>`).join("")}</section>`;}).join("")}</div>`;
}

function renderProposals() {
  $("view-propuestas").innerHTML = `${viewHeader("Propuestas", "Editá cada propuesta, sus prendas, pagos y seguimiento de forma independiente.", can("proposals.manage") ? `<button class="primary-button" data-new-proposal>Nueva propuesta</button>` : "")}
  <div class="v2-toolbar surface"><input id="proposalSearch" type="search" placeholder="Buscar número, cliente o prenda en tiempo real"><select id="proposalClientFilter"><option value="">Todos los clientes</option>${state.clients.map((item)=>`<option value="${esc(item.id)}">${esc(item.company)}</option>`).join("")}</select><select id="proposalStatusFilter"><option value="">Todos los estados</option>${STATUS.map((s)=>`<option>${s}</option>`).join("")}</select>${viewSwitcher("propuestas")}</div>
  <div class="v2-proposals ${collectionViews.propuestas}"><section class="surface"><div id="proposalCards">${collectionViews.propuestas==="kanban"?proposalBoard(state.proposals):proposalRows(state.proposals)}</div></section><section class="surface" id="proposalDetailV2">${proposalDetail(proposal())}</section></div>`;
}
function proposalBoard(items) { return `<div class="v2-collection-board">${STATUS.map((status)=>{const entries=items.filter((item)=>item.status===status);return `<section class="v2-board-column"><h3>${esc(status)}<b>${entries.length}</b></h3>${entries.map((item)=>`<button class="v2-board-card v2-board-card-button" data-open-proposal="${esc(item.id)}" type="button"><strong>${esc(item.publicId)}</strong><span>${esc(client(item.clientId).company)}</span><small>${esc(item.title)} · ${item.designs.length} prenda(s)</small><b>${money(totals(item).total)}</b></button>`).join("")||empty("Sin propuestas")}</section>`;}).join("")}</div>`; }
function proposalCostPanel(item) {
  if(!can("settings.manage"))return "";
  const estimate=proposalCost(item);
  return `<section class="v2-cost-panel"><div class="section-row"><h3>Costos y margen estimado</h3><small>Solo equipo autorizado</small></div><div class="v2-cost-metrics"><span>Venta sin IVA<b>${money(estimate.revenue)}</b></span><span>Costo estimado<b>${money(estimate.cost)}</b></span><span>Ganancia estimada<b>${money(estimate.profit)}</b></span><span>Margen<b>${estimate.margin.toFixed(1)}%</b></span></div>${estimate.missing.length?`<p class="v2-cost-warning">Estimación incompleta: ${esc(estimate.missing.join(", "))}. Cargá estos costos antes de usar el margen para decidir el precio.</p>`:""}</section>`;
}
function proposalDetail(item) {
  if (!item) return empty("Seleccioná o creá una propuesta.");
  const customer = client(item.clientId); const sum = totals(item);
  return `<div class="section-row"><div><small>${esc(item.publicId)}</small><h2>${esc(item.title)}</h2><p>${esc(customer.company)} · ${esc(customer.contact)}</p></div>${can("proposals.manage")?`<label class="v2-status-control">Estado<select data-proposal-status="${esc(item.id)}">${statusOptions(item.status)}</select></label>`:`<span class="v2-status status-${slug(item.status)}">${esc(item.status)}</span>`}</div>
  <div class="v2-detail-meta"><span>Creada <b>${dateLabel(item.createdDate)}</b></span><span>Válida hasta <b>${dateLabel(item.validUntil)}</b></span><span>Entrega <b>${dateLabel(item.deliveryDate)}</b></span><span>Prioridad <b>${esc(item.priority)}</b></span></div>
  <div class="button-row v2-actions">${can("proposals.manage")?`<button data-edit-proposal="${item.id}">Editar datos</button><button data-edit-designs="${item.id}">Editar prendas</button><button data-duplicate-proposal="${item.id}">Duplicar</button>`:""}<button data-print-proposal="${item.id}">${icon("printer",16)} Presupuesto</button><button data-print-proof="${item.id}" ${item.designs.length?"":"disabled"}>${icon("image",16)} Ficha visual para cliente</button><button data-print-production="${item.id}">${icon("factory",16)} Ficha de producción</button><button data-whatsapp-proposal="${item.id}">WhatsApp</button>${can("proposals.manage") ? `<button class="danger" data-trash-proposal="${item.id}">Borrar</button>` : ""}</div>
  <section class="v2-art-approval"><div><strong>${icon("check",16)} Aprobación del diseño</strong><p>${item.artApproval?`Aprobado por ${esc(item.artApproval.approvedBy)} el ${dateLabel(item.artApproval.approvedAt)} · versión ${item.artApproval.revision}${item.artApproval.note?` · ${esc(item.artApproval.note)}`:""}`:"Pendiente de aprobación del cliente."}</p></div><div class="button-row">${item.artApproval?.snapshotId?`<button data-print-approved="${esc(item.id)}:${esc(item.artApproval.snapshotId)}" type="button">Ver versión aprobada</button>`:""}${item.artApproval?.evidenceData?`<a class="v2-button-link" href="${esc(item.artApproval.evidenceData)}" download="${esc(item.artApproval.evidenceName||"aprobacion")}">Ver comprobante</a>`:""}${can("proposals.manage")?item.artApproval?`<button data-revoke-art="${esc(item.id)}" type="button">Reabrir diseño</button>`:`<button data-approve-art="${esc(item.id)}" type="button" ${item.designs.length?"":"disabled"}>Registrar aprobación</button>`:""}</div>${item.approvalHistory?.length?`<details class="v2-approval-history"><summary>Versiones anteriores (${item.approvalHistory.length})</summary>${item.approvalHistory.map((entry)=>`<p>Versión ${entry.revision} · ${esc(entry.approvedBy)} · ${dateLabel(entry.approvedAt)}${entry.snapshotId?` · <button data-print-approved="${esc(item.id)}:${esc(entry.snapshotId)}" type="button">Ver diseño</button>`:""}${entry.evidenceData?` · <a href="${esc(entry.evidenceData)}" download="${esc(entry.evidenceName||"aprobacion")}">Comprobante</a>`:""}</p>`).join("")}</details>`:""}</section>
  <h3>Prendas de la propuesta</h3>${item.designs.length ? `<div class="v2-design-list">${item.designs.map((design) => designCard(design,item.id)).join("")}</div>` : empty("Todavía no agregaste prendas.")}
  <div class="v2-finance"><div><span>Subtotal</span><b>${money(sum.subtotal)}</b></div><div><span>Descuento (${item.discount}%)</span><b>-${money(sum.discount)}</b></div><div><span>Impuestos (${item.taxRate}%)</span><b>${money(sum.tax)}</b></div><div class="total"><span>Total</span><b>${money(sum.total)}</b></div><div class="paid"><span>Pagado / señas</span><b>${money(sum.paid)}</b></div><div class="balance"><span>Saldo restante</span><b>${money(sum.balance)}</b></div>${sum.credit ? `<div class="paid"><span>Saldo a favor</span><b>${money(sum.credit)}</b></div>` : ""}<div><span>Estado de pago</span><b>${sum.paid <= 0 ? "Pendiente" : sum.balance > 0 ? "Pago parcial" : sum.credit > 0 ? "Pagado con saldo a favor" : "Pagado"}</b></div></div>
  ${proposalCostPanel(item)}
  <div class="v2-two compact"><section><div class="section-row"><h3>Pagos</h3>${can("proposals.manage")?`<button data-add-payment="${item.id}">Registrar pago</button>`:""}</div>${paymentRows(item)}</section><section><h3>Historial</h3>${historyRows(item.history)}</section></div>`;
}
function designCard(design, proposalId) {
  const item=product(design.productId),progress=productionProgress(design);
  const label=progress.ready?"Control aprobado":progress.quality==="Rehacer"?"Requiere rehacer":`${progress.done}/${progress.total} pasos · calidad ${progress.quality.toLowerCase()}`;
  return `<article class="v2-design-card"><div class="v2-design-preview" style="--garment-color:${esc(design.colorHex)}"><img src="${esc(item.image)}" alt=""><div class="v2-print-logos">${(design.logos||[]).filter((logo)=>logo.side!=="back").map(logoHtml).join("")}</div></div><div><h4>${esc(item.name)}</h4><p>${esc(variantSummary(design))} · ${design.qty} unidades</p><p>${(design.logos||[]).length} logo(s) · ${money(design.unitPrice)} c/u</p><p class="v2-production-progress ${progress.ready?"ready":progress.quality==="Rehacer"?"redo":""}">${esc(label)}</p><small>${esc(design.note||"")}</small></div><strong>${money(design.qty*design.unitPrice)}</strong><div class="button-row">${can("proposals.manage")?`<button data-production-design="${esc(proposalId)}:${esc(design.id)}">Producción</button><button data-edit-design="${esc(proposalId)}:${esc(design.id)}">Editar</button><button data-duplicate-design="${esc(proposalId)}:${esc(design.id)}">Duplicar</button><button class="danger" data-delete-design="${esc(proposalId)}:${esc(design.id)}">Quitar</button>`:""}</div></article>`;
}
function paymentRows(item) { return item.payments.length ? `<div class="v2-mini-list v2-payments">${item.payments.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map((p) => `<div><span><b>${dateLabel(p.date)} · ${esc(p.type || "Pago")}</b><small>${esc(p.method)}${p.reference ? ` · Ref. ${esc(p.reference)}` : ""}${p.note ? ` · ${esc(p.note)}` : ""}</small></span><strong>${money(p.amount)}</strong><div class="button-row">${p.receiptData ? `<a class="v2-button-link" href="${esc(p.receiptData)}" download="${esc(p.receiptName || "comprobante")}">Comprobante</a>` : ""}${can("proposals.manage")?`<button data-edit-payment="${item.id}:${p.id}">Editar</button><button class="danger" data-delete-payment="${item.id}:${p.id}">×</button>`:""}</div></div>`).join("")}</div>` : empty("No hay pagos registrados."); }
function historyRows(items) { return items?.length ? `<div class="v2-timeline">${items.slice(0,8).map((h) => `<div><b>${esc(h.action)}</b><small>${esc(h.userName)} · ${new Date(h.at).toLocaleString("es-AR")}</small><p>${esc(h.detail || "")}</p></div>`).join("")}</div>` : empty("Sin actividad todavía."); }

function productionDesignButtons(item) {
  return `<div class="v2-production-designs">${(item.designs||[]).map((design)=>{const progress=productionProgress(design);return `<button data-production-design="${esc(item.id)}:${esc(design.id)}" type="button" class="${progress.ready?"ready":progress.quality==="Rehacer"?"redo":""}">${esc(product(design.productId).name)} · ${progress.ready?"Control OK":progress.quality==="Rehacer"?"Rehacer":`${progress.done}/${progress.total}`}</button>`;}).join("")}</div>`;
}
function stockPlanSection() {
  const rows=stockPlan();
  return `<section class="surface report-block"><div class="section-row"><div><h2>Prendas por conseguir</h2><p>Demanda de propuestas aprobadas, en producción o listas para entregar.</p></div><button data-export-stock-plan type="button">Descargar CSV</button></div>${rows.length?`<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Prenda</th><th>Color</th><th>Talle</th><th>Necesarias</th><th>Disponibles</th><th>Faltantes</th></tr></thead><tbody>${rows.map((row)=>`<tr class="${row.shortage>0?"v2-shortage-row":""}"><td>${esc(row.productName)}</td><td>${esc(row.color)}</td><td>${esc(row.size)}</td><td>${row.needed}</td><td>${row.stock===null?"Sin cargar":row.stock}</td><td><b>${row.shortage===null?"Pendiente":row.shortage}</b></td></tr>`).join("")}</tbody></table></div>`:empty("Todavía no hay propuestas aprobadas con prendas.")}<p class="v2-help-text">El stock se carga en Productos. Actualizalo al ingresar o entregar prendas para que los faltantes sean precisos.</p></section>`;
}
function renderTasks() {
  const stages=["Aprobada","En producción","Lista","Entregada"];
  const active=state.proposals.filter((item)=>stages.includes(item.status)).sort((a,b)=>String(a.deliveryDate||"9999").localeCompare(String(b.deliveryDate||"9999")));
  const board=`<div class="v2-kanban v2-production-board">${stages.map((stage)=>`<section data-drop-status="${esc(stage)}"><h2>${esc(stage)}<b>${active.filter((item)=>item.status===stage).length}</b></h2>${active.filter((item)=>item.status===stage).map((item)=>`<article class="v2-production-card" draggable="${can("proposals.manage")}" data-production-card="${esc(item.id)}"><button data-open-proposal="${esc(item.id)}" type="button"><strong>${esc(item.publicId)}</strong><span>${esc(client(item.clientId).company)}</span><small>${item.designs.length} prendas · entrega ${dateLabel(item.deliveryDate)}</small></button>${productionUrgency(item)?`<span class="v2-delivery-alert">${productionUrgency(item)} · ${dateLabel(item.deliveryDate)}</span>`:""}${can("proposals.manage")?productionDesignButtons(item):""}${can("proposals.manage")?`<select data-inline-status="${esc(item.id)}" aria-label="Estado de ${esc(item.publicId)}">${statusOptions(item.status)}</select>`:""}</article>`).join("")||empty("Sin trabajos")}</section>`).join("")}</div>`;
  const list=`<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Propuesta</th><th>Cliente</th><th>Prendas</th><th>Entrega</th><th>Estado</th><th>Control por prenda</th></tr></thead><tbody>${active.map((item)=>`<tr><td><button data-open-proposal="${esc(item.id)}" type="button">${esc(item.publicId)}</button></td><td>${esc(client(item.clientId).company)}</td><td>${item.designs.length}</td><td>${dateLabel(item.deliveryDate)} ${productionUrgency(item)?`<b class="v2-delivery-alert">${productionUrgency(item)}</b>`:""}</td><td>${can("proposals.manage")?`<select data-inline-status="${esc(item.id)}">${statusOptions(item.status)}</select>`:esc(item.status)}</td><td>${can("proposals.manage")?productionDesignButtons(item):item.designs.map((design)=>productionProgress(design).ready?"OK":"Pendiente").join(" · ")}</td></tr>`).join("")}</tbody></table></div>`;
  $("view-tareas").innerHTML=`${viewHeader("Producción", "Seguimiento por propuesta y control de cada prenda.", `<div class="button-row">${viewSwitcher("tareas")}${can("tasks.manage")?`<button class="primary-button" data-new-task>Nueva tarea</button>`:""}</div>`)}${collectionViews.tareas==="kanban"?board:list}${stockPlanSection()}<section class="surface report-block"><div class="section-row"><h2>Tareas y recordatorios</h2></div><div class="v2-list">${state.tasks.map((task)=>`<div class="v2-row"><div><strong>${esc(task.title)}</strong><small>${esc(client(task.clientId).company)} · ${dateLabel(task.dueDate)}</small></div><span class="v2-status">${esc(task.status)}</span><div class="button-row">${can("tasks.manage")?`<button data-edit-task="${task.id}">Editar</button><button data-complete-task="${task.id}">Completar</button>`:""}</div></div>`).join("")||empty("No hay tareas")}</div></section>`;
}
function exportStockPlan() {
  const lines=[["Prenda","Color","Talle","Necesarias","Disponibles","Faltantes"],...stockPlan().map((row)=>[row.productName,row.color,row.size,row.needed,row.stock??"Sin cargar",row.shortage??"Pendiente"])];
  const csv="\uFEFF"+lines.map((line)=>line.map((value)=>`"${String(value).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
  link.href=url;link.download=`uniforma-prendas-por-conseguir-${today()}.csv`;link.click();URL.revokeObjectURL(url);
}
function renderEditor() {
  ensureDraft(); const draft = state.editorDraft; const item = product(draft.productId); const active = proposal();
  const allocations = draft.colorQuantities;
  const selectedSizes = [...new Set(draft.colorSizeQuantities.map((row) => row.size))];
  const allColors = colorsOf(item);
  const tiers = priceTierRows(item);
  const tier = activeTier(item, draft.qty);
  const scale = garmentScale(item, draft);
  const suggested=suggestedUnitPrice(draft);
  $("view-editor").innerHTML = `${viewHeader("Editor visual", "Armá varias prendas y reunilas dentro de una misma propuesta.", `<div class="button-row"><button data-undo-editor>↶</button><button data-redo-editor>↷</button>${active?`<button data-go-proposal="${esc(active.id)}" type="button">Ir a la propuesta</button>`:""}<button class="primary-button" data-save-design>${editingDesignId ? "Actualizar prenda" : "Agregar prenda"}</button></div>`)}
  <div class="v2-editor"><aside class="surface v2-controls"><h2>Propuesta</h2><label>Propuesta<select id="editorProposal">${proposalOptions(active?.id)}</select></label><button data-new-proposal>Nueva propuesta</button><hr><h2>Prenda</h2>
  <label>Buscar prenda<input id="editorProductSearch" type="search" value="${esc(item.name || "")}" placeholder="Escribí nombre, categoría o SKU" autocomplete="off" role="combobox" aria-controls="editorProductResults" aria-autocomplete="list"></label><div id="editorProductResults" class="v2-search-results" hidden></div>
  <div class="v2-color-head"><h3>1. Colores del pedido</h3><small>Tocá los que necesites</small></div>
  <div class="v2-color-picker">${allColors.map((color)=>{const on=allocations.some((row)=>row.color===color.name);return `<button type="button" class="v2-color-chip ${on?"is-on":""}" data-toggle-color="${esc(color.name)}" aria-pressed="${on}"><span class="v2-color-swatch" style="background:${esc(color.hex)}"></span>${esc(color.name)}</button>`;}).join("")}</div>
  <div class="v2-color-head"><h3>2. Cantidad por talle</h3><span class="v2-color-ok">Total: <b id="editorTotalQty">${draft.qty}</b> prendas</span></div>
  <div class="v2-variant-grid v2-variant-grid--sizes"><table><thead><tr><th>Talle</th>${allocations.map((row)=>`<th><button type="button" class="v2-color-view ${row.color===draft.color?"is-on":""}" data-view-color="${esc(row.color)}" title="Ver ${esc(row.color)} en la prenda"><span class="v2-color-swatch" style="background:${esc(row.hex)}"></span><span>${esc(row.color)}</span></button></th>`).join("")}</tr></thead><tbody>${selectedSizes.map((size)=>`<tr><th>${esc(size)}</th>${allocations.map((row)=>`<td><input data-variant-color="${esc(row.color)}" data-variant-size="${esc(size)}" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${draft.colorSizeQuantities.find((entry)=>entry.color===row.color&&entry.size===size)?.qty||""}" aria-label="${esc(row.color)} talle ${esc(size)}"></td>`).join("")}</tr>`).join("")}</tbody><tfoot><tr><th>Total</th>${allocations.map((row)=>`<td><strong data-color-total="${esc(row.color)}">${row.qty}</strong></td>`).join("")}</tr></tfoot></table></div>
  <div class="v2-color-head"><h3>3. Precio</h3></div>
  <div class="v2-price-box"><div class="v2-price-tiers">${tiers.map((row)=>`<span data-price-tier="${row.tier}" class="${tier&&row.tier===tier.tier?"on":""}"><small>x${row.tier}</small><b>${money(row.price)}</b></span>`).join("")||`<small>Esta prenda no tiene precios por cantidad: cargalos en Productos.</small>`}</div>
  <label>Precio unitario<input id="editorPriceV2" type="number" min="0" value="${draft.unitPrice}"></label>
  <small id="editorTierHint" class="v2-help-text">${esc(tierHint(item,draft.qty))}</small>
  <div class="v2-price-sum"><span>Subtotal de la prenda</span><strong id="editorSubtotal">${money(draft.qty*draft.unitPrice)}</strong></div>
  <button data-auto-price type="button" class="v2-price-auto" ${draft.priceManual?"":"hidden"}>Precio cambiado a mano · volver al automático</button></div>
  ${suggested?`<div class="v2-price-suggestion"><span>Precio sugerido según costos: <b>${money(suggested)}</b></span><button data-apply-suggested type="button">Aplicar</button></div>`:""}
  <label>Observaciones de la prenda<textarea id="editorNoteV2" rows="3">${esc(draft.note)}</textarea></label>
  <details class="v2-scale-info"><summary>Medidas de referencia para la vista</summary><label>Talle de referencia<select id="editorSizeV2">${selectedSizes.map((s)=>`<option ${s===draft.size?"selected":""}>${esc(s)}</option>`).join("")}</select></label><div class="v2-inline"><label>Ancho (cm)<input id="editorScaleWidth" type="number" min="1" step="0.1" value="${esc(draft.previewWidthCm)}" placeholder="${scale.width || "Ingresar"}"></label><label>Alto (cm)<input id="editorScaleHeight" type="number" min="1" step="0.1" value="${esc(draft.previewHeightCm)}" placeholder="${scale.height || "Ingresar"}"></label></div><small>Se usa la tabla de talles si existe. Sin medidas de referencia, la posición y el tamaño en la imagen son orientativos; las medidas de producción se cargan en cada logo.</small></details></aside>
  <section class="v2-stage-wrap"><div class="v2-stage-toolbar"><div class="v2-side-switch"><button class="${editorSide === "front" ? "active" : ""}" data-editor-side="front">Frente</button><button class="${editorSide === "back" ? "active" : ""}" data-editor-side="back">Espalda</button></div><span>${esc(item.name || "Prenda")} · ${esc(draft.color)}</span><span>${draft.logos.filter((logo)=>logo.side === editorSide).length} logo(s)</span></div><div class="v2-stage" id="v2Stage" style="--garment-color:${esc(draft.colorHex)}"><div class="v2-garment"><img src="${esc(editorSide === "back" ? (item.imageBack || item.image || "") : (item.image || ""))}" alt="${esc(item.name || "Prenda")}"><span class="v2-garment-tint"></span></div><div id="v2LogoLayers">${draft.logos.filter((logo)=>logo.side === editorSide).map(editorLogoHtml).join("")}</div></div><div class="v2-stage-help">Hacé clic en un logo para seleccionarlo. Arrastralo para moverlo; la vista de la prenda es orientativa.</div></section>
  <aside class="surface v2-controls"><h2>Logos</h2><label class="v2-upload">+ Agregar logos<input id="editorLogoFiles" type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>${active&&state.clients.find((entry)=>entry.id===active.clientId)?.logos?.length?`<div class="v2-client-logo-picks"><strong>Logos guardados del cliente</strong>${state.clients.find((entry)=>entry.id===active.clientId).logos.map((logo)=>`<button data-use-client-logo="${esc(logo.id)}" type="button"><img src="${esc(logo.src)}" alt=""><span>${esc(logo.name||"Logo")}</span></button>`).join("")}</div>`:""}<div id="logoLayersList" class="v2-layer-list">${draft.logos.map((logo,index)=>`<button class="${logo.id===selectedLogoId?"active":""}" data-select-logo="${logo.id}">${logoArtwork(logo)}<span>${esc(logo.name || `Logo ${index+1}`)}<small>${logo.side === "back" ? "Espalda" : "Frente"} · ${esc(logo.technique || "Personalización")}</small></span></button>`).join("") || empty("Cargá uno o más logos.")}</div>${selectedLogoControls() || `<small class="v2-help-text">Seleccioná un logo para editar técnica, color, lado y medidas.</small>`}<hr><h2>Pedido actual</h2><div class="v2-editor-order">${active?.designs?.map((d)=>`<button data-edit-design="${active.id}:${d.id}">${esc(product(d.productId).name)}<small>${d.qty} u. · ${esc(variantSummary(d))}</small></button>`).join("") || empty("Todavía no hay prendas")}</div></aside></div>`;
}
function logoHtml(logo) { return `<div class="v2-print-logo" style="left:${logo.x}%;top:${logo.y}%;width:${logo.width}%;height:${logo.height}%;transform:translate(-50%,-50%) rotate(${logo.rotation}deg)">${logoArtwork(logo)}</div>`; }
function editorLogoHtml(logo) { return `<div class="v2-logo ${logo.id===selectedLogoId?"selected":""}" data-logo-id="${esc(logo.id)}" style="left:${logo.x}%;top:${logo.y}%;width:${logo.width}%;height:${logo.height}%;transform:translate(-50%,-50%) rotate(${logo.rotation}deg)">${logoArtwork(logo)}<button class="v2-handle v2-resize" data-logo-action="resize" aria-label="Cambiar tamaño"></button><button class="v2-handle v2-resize-x" data-logo-action="resize-x" aria-label="Cambiar ancho"></button><button class="v2-handle v2-resize-y" data-logo-action="resize-y" aria-label="Cambiar alto"></button><button class="v2-handle v2-rotate" data-logo-action="rotate" aria-label="Rotar">↻</button><button class="v2-logo-delete" data-delete-logo-id="${esc(logo.id)}" type="button" aria-label="Eliminar logo">×</button></div>`; }
function selectedLogo() { return state.editorDraft.logos.find((logo)=>logo.id===selectedLogoId) || null; }
function selectedLogoControls() {
  const logo = selectedLogo();
  if (!logo) return "";
  const techniques = [...new Set([...methodsOf(product(state.editorDraft.productId)), ...METHODS, logo.technique].filter(Boolean))];
  const scale = garmentScale(product(state.editorDraft.productId));
  return `<div class="v2-logo-controls">
    <label>Nombre del logo<input data-logo-field="name" value="${esc(logo.name || "Logo")}"></label>
    <div class="v2-inline"><label>Técnica<select data-logo-field="technique">${techniques.map((value)=>`<option ${value===logo.technique?"selected":""}>${esc(value)}</option>`).join("")}</select></label><label>Lado<select data-logo-field="side"><option value="front" ${logo.side!=="back"?"selected":""}>Frente</option><option value="back" ${logo.side==="back"?"selected":""}>Espalda</option></select></label></div>
    <div class="v2-inline v2-logo-color-picker"><label>Color visible del logo<input data-logo-tint type="color" value="${tintColor(logo) || "#ffffff"}" aria-label="Cambiar color visible del logo"></label><button data-logo-original type="button">Usar colores originales</button></div>
    <label>Color o hilo para producción<input data-logo-field="logoColor" value="${esc(logo.logoColor || "Según archivo")}" placeholder="Ej. blanco o Pantone"></label>
    <label>Ubicación<input data-logo-field="placement" value="${esc(logo.placement || "")}" placeholder="Ej. pecho izquierdo"></label>
    <div class="v2-inline"><label>Ancho (cm)<input data-logo-cm="width" type="number" min="0.1" step="0.1" value="${logoCm(logo,"width") ? Math.round(logoCm(logo,"width")*10)/10 : ""}" placeholder="Ingresar cm"></label><label>Alto (cm)<input data-logo-cm="height" type="number" min="0.1" step="0.1" value="${logoCm(logo,"height") ? Math.round(logoCm(logo,"height")*10)/10 : ""}" placeholder="Ingresar cm"></label></div>
    <small class="v2-help-text">${scale.width && scale.height ? "La vista usa las medidas de referencia para estimar el tamaño. Confirmá los centímetros antes de producir." : "Ingresá las medidas de referencia de la prenda para que el tamaño visual corresponda a los centímetros. Podés guardar medidas de producción aunque la vista siga siendo orientativa."}</small>
    <label class="check-row"><input data-logo-lock type="checkbox" ${logo.locked!==false?"checked":""}> Mantener proporción</label>
    <label>Indicaciones de este logo<textarea data-logo-field="note" rows="2" placeholder="Terminación, hilo, observaciones…">${esc(logo.note || "")}</textarea></label>
    <div class="button-row"><button data-remove-background>Quitar fondo</button><button data-duplicate-logo>Duplicar</button><button class="danger" data-delete-logo>Eliminar</button></div>
    <small class="v2-help-text">El cambio de color conserva la transparencia del archivo. Si tiene fondo opaco, usá “Quitar fondo” primero. Podés girarlo con el control circular sobre el logo.</small>
  </div>`;
}

function renderReports() {
  const sales = state.proposals.filter((p)=>["Aprobada","En producción","Lista","Entregada"].includes(p.status)).reduce((s,p)=>s+totals(p).total,0);
  const paid = state.proposals.reduce((s,p)=>s+totals(p).paid,0);
  $("view-reportes").innerHTML = `${viewHeader("Reportes", "Resultados comerciales, cobranzas y entregas.")}<div class="v2-metrics"><article><small>Ventas aprobadas</small><strong>${money(sales)}</strong></article><article><small>Cobrado</small><strong>${money(paid)}</strong></article><article><small>Por cobrar</small><strong>${money(state.proposals.reduce((s,p)=>s+totals(p).balance,0))}</strong></article><article><small>Clientes</small><strong>${state.clients.length}</strong></article></div><div class="v2-two"><section class="surface"><h2>Por estado</h2>${STATUS.map((status)=>`<div class="v2-report-line"><span>${status}</span><b>${state.proposals.filter((p)=>p.status===status).length}</b></div>`).join("")}</section><section class="surface"><h2>Próximas entregas</h2>${proposalRows(state.proposals.filter((p)=>p.deliveryDate && !["Entregada","Rechazada"].includes(p.status)).sort((a,b)=>a.deliveryDate.localeCompare(b.deliveryDate)).slice(0,8))}</section></div><section class="surface report-block"><h2>Actividad reciente</h2>${historyRows(state.auditLog)}</section>`;
}
function renderSettings() {
  const settings=state.settings,bordado=techniqueCost("Bordado"),dtf=techniqueCost("DTF");
  $("view-configuracion").innerHTML=`${viewHeader("Configuración", "Reglas comerciales, costos, respaldos y recuperación.")}
    <div class="v2-two"><form class="surface form-panel" id="settingsFormV2"><h2>Datos comerciales</h2>
      <label>Empresa<input name="companyName" value="${esc(settings.companyName||"UNIFORMA")}"></label>
      <label>WhatsApp<input name="whatsapp" value="${esc(settings.whatsapp||"")}"></label>
      <label>Prefijo de propuestas<input name="quotePrefix" value="${esc(settings.quotePrefix||"UNF")}"></label>
      <div class="v2-inline"><label>IVA %<input name="taxRate" type="number" min="0" value="${Number(settings.taxRate||0)}"></label><label>Validez (días)<input name="validityDays" type="number" min="1" value="${Number(settings.validityDays||7)}"></label><label>Producción (días)<input name="productionDays" type="number" min="1" value="${Number(settings.productionDays||14)}"></label></div>
      <h3>Costos y precio sugerido</h3><p class="v2-help-text">Los costos son internos y no aparecen en documentos para clientes. Se calculan por cada logo agregado a la prenda.</p>
      <label>Margen objetivo %<input name="defaultMargin" type="number" min="0" max="90" step="0.1" value="${Number(settings.defaultMargin??35)}"></label>
      <div class="v2-form-grid"><label>Bordado · costo por prenda y logo<input name="bordadoUnit" type="number" min="0" step="0.01" value="${bordado.unit}"></label><label>Bordado · preparación por logo<input name="bordadoSetup" type="number" min="0" step="0.01" value="${bordado.setup}"></label><label>DTF · costo por prenda y logo<input name="dtfUnit" type="number" min="0" step="0.01" value="${dtf.unit}"></label><label>DTF · preparación por logo<input name="dtfSetup" type="number" min="0" step="0.01" value="${dtf.setup}"></label></div>
      <button class="primary-button" type="submit">Guardar configuración</button></form>
    <section class="surface"><h2>Datos y respaldo</h2><p>El respaldo incluye las versiones visuales aprobadas.</p><div class="button-row"><button data-export-backup>Exportar backup</button><label class="v2-upload">Importar backup<input id="backupFileV2" type="file" accept="application/json"></label></div><h3>Papelera</h3><div class="v2-mini-list">${state.trash.map((entry)=>`<div><span>${esc(entry.type)} · ${esc(entry.label)}</span><button data-restore-trash="${entry.id}">Restaurar</button><button class="danger" data-purge-trash="${entry.id}">Eliminar</button></div>`).join("")||empty("La papelera está vacía.")}</div></section></div>`;
}
function renderUsers() {
  const content=collectionViews.usuarios==="lista"
    ? `<div class="v2-table-wrap"><table class="v2-data-table"><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>${users.map((user)=>`<tr><td>${esc(user.name)}</td><td>${esc(user.username)}</td><td>${esc(roles[user.role]?.label||user.role)}</td><td>${user.active?"Activo":"Inactivo"}</td><td><button data-edit-user="${esc(user.id)}">Editar</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="v2-collection-board">${[...new Set(users.map((user)=>user.role))].map((role)=>`<section class="v2-board-column"><h3>${esc(roles[role]?.label||role)}<b>${users.filter((user)=>user.role===role).length}</b></h3>${users.filter((user)=>user.role===role).map((user)=>`<article class="v2-board-card"><strong>${esc(user.name)}</strong><small>${esc(user.username)} · ${user.active?"Activo":"Inactivo"}</small><button data-edit-user="${esc(user.id)}">Editar</button></article>`).join("")}</section>`).join("")}</div>`;
  $("view-usuarios").innerHTML = `${viewHeader("Usuarios", "Equipo, roles y permisos.", `<div class="button-row">${viewSwitcher("usuarios")}<button class="primary-button" data-new-user>Nuevo usuario</button></div>`)}<section class="surface">${content}</section>`;
}
function renderView() {
  const renderers = { dashboard: renderDashboard, clientes: renderClients, tareas: renderTasks, catalogo: renderCatalog, propuestas: renderProposals, editor: renderEditor, reportes: renderReports, configuracion: renderSettings, usuarios: renderUsers };
  renderers[currentView]?.();
  qa(".view").forEach((view)=>view.classList.toggle("active", view.id===`view-${currentView}`));
  qa("[data-go]").forEach((button)=>button.classList.toggle("active", button.dataset.go===currentView));
  renderNotifications();
}
function go(view) { if(view==="editor" && currentView!=="editor") selectedLogoId=""; currentView=view; q(".sidebar").classList.remove("open"); renderView(); }

function modal(html, wide=false) { $("v2ModalBody").innerHTML=html; $("v2Modal").hidden=false; q(".v2-modal__card").classList.toggle("wide",wide); }
function closeModal() { $("v2Modal").hidden=true; $("v2ModalBody").innerHTML=""; }
function clientModal(id="") { const item=id?client(id):{}; modal(`<form id="clientFormV2" class="v2-form"><h2>${id?"Editar":"Nuevo"} cliente</h2><input type="hidden" name="id" value="${esc(id)}"><div class="v2-form-grid"><label>Empresa<input name="company" required value="${esc(item.company||"")}"></label><label>Contacto<input name="contact" required value="${esc(item.contact||"")}"></label><label>CUIT<input name="cuit" value="${esc(item.cuit||"")}"></label><label>WhatsApp<input name="phone" value="${esc(item.phone||"")}"></label><label>Email<input name="email" type="email" value="${esc(item.email||"")}"></label><label>Dirección<input name="address" value="${esc(item.address||"")}"></label><label>Rubro<input name="sector" value="${esc(item.sector||"")}"></label><label>Prioridad<select name="priority">${["Alta","Media","Baja"].map((v)=>`<option ${v===(item.priority||"Media")?"selected":""}>${v}</option>`).join("")}</select></label></div><label>Notas visibles<textarea name="notes">${esc(item.notes||"")}</textarea></label><label>Notas internas<textarea name="internalNotes">${esc(item.internalNotes||"")}</textarea></label><label>Logos del cliente<input name="logos" type="file" multiple accept="image/*,.svg"></label><div class="v2-saved-logos">${(item.logos||[]).map((logo)=>`<img src="${esc(logo.src)}" alt="${esc(logo.name)}">`).join("")}</div><button class="primary-button" type="submit">Guardar cliente</button></form>`,true); }
function productModal(id="") { const item=id?product(id):{}; const prices=item.prices||{}; modal(`<form id="productFormV2" class="v2-form"><h2>${id?"Editar":"Nuevo"} producto</h2><input type="hidden" name="id" value="${esc(id)}"><div class="v2-form-grid"><label>Nombre<input name="name" required value="${esc(item.name||"")}"></label><label>Categoría<input name="category" required value="${esc(item.category||"")}"></label><label>Material<input name="material" value="${esc(item.material||"")}"></label><label>Costo de compra por unidad ($)<input name="unitCost" type="number" min="0" step="0.01" value="${Number(item.unitCost||0)}"></label><label>Imagen frente<input name="imageFile" type="file" accept="image/*,.svg"></label><label>Imagen espalda<input name="imageBackFile" type="file" accept="image/*,.svg"></label><label>Colores (Nombre:#hex, separados por coma)<input name="colors" value="${esc((item.colors||[]).map((c)=>`${c.name}:${c.hex}`).join(", "))}"></label><label>Talles separados por coma<input name="sizes" value="${esc((item.sizeOptions||[]).join(", "))}"></label><label>Personalización<input name="methods" value="${esc((item.methods||METHODS).join(", "))}"></label></div><h3>Precios unitarios por cantidad</h3><div class="v2-inline">${[5,10,20,50].map((qty)=>`<label>x${qty}<input name="price${qty}" type="number" min="0" value="${Number(prices[qty]??item.basePrice??0)}"></label>`).join("")}</div><label>Descripción<textarea name="description">${esc(item.description||"")}</textarea></label><label>Características (una por línea)<textarea name="features">${esc((item.features||[]).join("\n"))}</textarea></label><label>Tabla de talles (Talle|Ancho|Largo, una fila por línea)<textarea name="sizeChart">${esc((item.sizeChart||[]).map((r)=>`${r.size}|${r.width}|${r.length}`).join("\n"))}</textarea></label><button class="primary-button" type="submit">Guardar producto</button></form>`,true); }
function stockModal(id) {
  const item=state.products.find((entry)=>entry.id===id);if(!item)return;
  const sizes=sizesOf(item),colors=colorsOf(item),recorded=item.stockVariants||[];
  modal(`<form id="stockFormV2" class="v2-form"><h2>Stock disponible · ${esc(item.name)}</h2><p>Cargá las prendas que tenés disponibles hoy. El panel compara estas cantidades con las propuestas aprobadas que siguen abiertas.</p><input name="productId" type="hidden" value="${esc(id)}"><div class="v2-variant-grid"><table><thead><tr><th>Color</th>${sizes.map((size)=>`<th>${esc(size)}</th>`).join("")}</tr></thead><tbody>${colors.map((color)=>`<tr><th><span class="v2-color-swatch" style="background:${esc(color.hex)}"></span>${esc(color.name)}</th>${sizes.map((size)=>`<td><input data-stock-variant data-stock-color="${esc(color.name)}" data-stock-size="${esc(size)}" type="number" min="0" step="1" inputmode="numeric" value="${recorded.find((row)=>row.color===color.name&&row.size===size)?.qty||0}" aria-label="Stock de ${esc(color.name)} talle ${esc(size)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div><small>Actualizá estas cantidades cuando ingresen o salgan prendas. Los pedidos abiertos se muestran como demanda reservada en Producción.</small><button class="primary-button" type="submit">Guardar stock</button></form>`,true);
}
function productionModal(proposalId,designId) {
  const item=proposal(proposalId),design=item?.designs.find((entry)=>entry.id===designId);if(!design)return;
  const progress=productionOf(design);
  modal(`<form id="productionFormV2" class="v2-form"><h2>Control de producción</h2><p>${esc(item.publicId)} · ${esc(product(design.productId).name)} · ${design.qty} unidades</p><input name="proposalId" type="hidden" value="${esc(proposalId)}"><input name="designId" type="hidden" value="${esc(designId)}"><div class="v2-form-grid"><label>Responsable<input name="responsible" value="${esc(progress.responsible)}" placeholder="Nombre o taller"></label><label>Fecha prevista<input name="dueDate" type="date" value="${esc(progress.dueDate||item.deliveryDate||"")}"></label></div><fieldset class="v2-checklist"><legend>Pasos de esta prenda</legend>${PRODUCTION_STEPS.map(([key,label])=>`<label><input name="${key}" type="checkbox" ${progress[key]?"checked":""}> ${label}</label>`).join("")}</fieldset><label>Control final<select name="quality">${["Pendiente","Aprobada","Rehacer"].map((value)=>`<option ${value===progress.quality?"selected":""}>${value}</option>`).join("")}</select></label><label>Observaciones del control<textarea name="qualityNote" rows="3" placeholder="Terminación, medidas, defecto a corregir…">${esc(progress.qualityNote)}</textarea></label>${progress.checkedBy?`<small>Último control: ${esc(progress.checkedBy)} · ${dateLabel(progress.checkedAt)}</small>`:""}<button class="primary-button" type="submit">Guardar control</button></form>`);
}
function proposalModal(id = "", clientId = "") {
  const item = id ? proposal(id) : {};
  const selectedId = item.clientId || clientId;
  const selectedClient = state.clients.find((entry) => entry.id === selectedId);
  const mode = state.clients.length ? "existing" : can("clients.manage") ? "new" : "existing";
  modal(`<form id="proposalFormV2" class="v2-form"><h2>${id ? "Editar" : "Nueva"} propuesta</h2>
    <input type="hidden" name="id" value="${esc(id)}">
    <div class="v2-client-choice">
      <label>Cliente de la venta
        <select id="proposalClientMode" name="clientMode">
          <option value="existing" ${mode === "existing" ? "selected" : ""}>Elegir cliente anterior</option>
          ${can("clients.manage") ? `<option value="new" ${mode === "new" ? "selected" : ""}>Cargar un cliente nuevo</option>` : ""}
        </select>
      </label>
      <fieldset class="v2-client-section" data-client-section="existing" ${mode !== "existing" ? "disabled hidden" : ""}>
        <legend>Cliente anterior</legend>
        <label>Buscar por nombre, contacto, CUIT, teléfono o email
          <input id="proposalClientSearch" type="search" value="${esc(selectedClient?.company || "")}" placeholder="Empezá a escribir el nombre del cliente" autocomplete="off" role="combobox" aria-controls="proposalClientResults" aria-autocomplete="list">
        </label>
        <input type="hidden" name="clientId" value="${esc(selectedClient?.id || "")}">
        <div id="proposalClientResults" class="v2-search-results" hidden></div>
        <small id="proposalClientSelected" class="v2-help-text">${selectedClient ? `Seleccionado: ${esc(selectedClient.company)}` : "Elegí un resultado para asociar la propuesta."}</small>
      </fieldset>
      ${can("clients.manage") ? `<fieldset class="v2-client-section" data-client-section="new" ${mode !== "new" ? "disabled hidden" : ""}>
        <legend>Datos del cliente nuevo</legend>
        <p>Se creará su ficha automáticamente al guardar esta propuesta.</p>
        <div class="v2-form-grid">
          <label>Nombre / razón social<input name="newClientCompany" required autocomplete="organization"></label>
          <label>Persona de contacto (opcional)<input name="newClientContact" autocomplete="name"></label>
          <label>WhatsApp<input name="newClientPhone" type="tel" autocomplete="tel"></label>
          <label>Email<input name="newClientEmail" type="email" autocomplete="email"></label>
          <label>CUIT / DNI<input name="newClientCuit" inputmode="numeric"></label>
          <label>Rubro<input name="newClientSector"></label>
          <label>Dirección<input name="newClientAddress" autocomplete="street-address"></label>
        </div>
      </fieldset>` : ""}
    </div>
    <div class="v2-form-grid">
      <label>Título<input name="title" required value="${esc(item.title || "")}"></label>
      <label>Estado<select name="status">${statusOptions(item.status || "Borrador")}</select></label>
      <label>Prioridad<select name="priority">${["Alta", "Media", "Baja"].map((v) => `<option ${v === (item.priority || "Media") ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Válida hasta<input name="validUntil" type="date" value="${esc(item.validUntil || addDays(state.settings.validityDays || 7))}"></label>
      <label>Entrega estimada<input name="deliveryDate" type="date" value="${esc(item.deliveryDate || addDays(state.settings.productionDays || 14))}"></label>
      <label>Descuento %<input name="discount" type="number" min="0" value="${Number(item.discount || 0)}"></label>
      <label>Recargo fijo<input name="surcharge" type="number" min="0" value="${Number(item.surcharge || 0)}"></label>
      <label>Envío<input name="shipping" type="number" min="0" value="${Number(item.shipping || 0)}"></label>${can("settings.manage")?`<label>Costo interno del envío<input name="shippingCost" type="number" min="0" value="${Number(item.shippingCost||0)}"></label>`:""}
      <label>IVA %<input name="taxRate" type="number" min="0" value="${Number(item.taxRate ?? state.settings.taxRate ?? 0)}"></label>
    </div>
    <label>Forma de pago para el presupuesto<input name="paymentTerms" value="${esc(item.paymentTerms || "Efectivo / transferencia")}"></label>
    <label>Observaciones para el cliente<textarea name="notes">${esc(item.notes || "")}</textarea></label>
    <label>Notas internas<textarea name="internalNotes">${esc(item.internalNotes || "")}</textarea></label>
    <button class="primary-button" type="submit">Guardar y diseñar</button>
  </form>`, true);
  refreshProposalClientOptions(false);
  toggleProposalClientMode();
}
function artApprovalModal(id) {
  const item=proposal(id);if(!item || !item.designs.length)return;
  modal(`<form id="artApprovalFormV2" class="v2-form"><h2>Aprobar diseño</h2><p>Registrá la aprobación recibida del cliente para la versión ${item.designRevision} de ${esc(item.publicId)}. Si se modifica una prenda, será necesario aprobarla nuevamente.</p><input type="hidden" name="proposalId" value="${esc(id)}"><label>Nombre de quien aprobó<input name="approvedBy" required value="${esc(client(item.clientId).contact||client(item.clientId).company)}"></label><label>Fecha de aprobación<input name="approvedAt" type="date" required value="${today()}"></label><label>Comprobante (opcional)<input name="evidence" type="file" accept="image/png,image/jpeg,image/webp,application/pdf"></label><label>Observaciones<input name="note" placeholder="Ej. aprobado por WhatsApp"></label><button class="primary-button" type="submit">Registrar aprobación</button></form>`);
}
function paymentModal(id, paymentId="") { const item=proposal(id), payment=(item?.payments||[]).find((entry)=>entry.id===paymentId)||{}, remaining=totals(item).balance; modal(`<form id="paymentFormV2" class="v2-form"><h2>${paymentId?"Editar":"Registrar"} pago o seña</h2><input type="hidden" name="proposalId" value="${id}"><input type="hidden" name="paymentId" value="${esc(paymentId)}"><div class="v2-payment-summary"><span>Total <b>${money(totals(item).total)}</b></span><span>Pagado <b>${money(totals(item).paid)}</b></span><span>Saldo <b>${money(remaining)}</b></span></div><div class="v2-form-grid"><label>Tipo<select name="type">${["Seña","Pago parcial","Saldo final","Ajuste"].map((value)=>`<option ${value===(payment.type||"Seña")?"selected":""}>${value}</option>`).join("")}</select></label><label>Monto<input name="amount" type="number" min="1" step="0.01" required value="${Number(payment.amount||remaining||0)}"></label><label>Medio<select name="method">${PAYMENT_METHODS.map((m)=>`<option ${m===(payment.method||"Transferencia")?"selected":""}>${m}</option>`).join("")}</select></label><label>Fecha<input name="date" type="date" required value="${esc(payment.date||today())}"></label><label>Referencia / operación<input name="reference" value="${esc(payment.reference||"")}" placeholder="N.º de transferencia o recibo"></label><label>Comprobante<input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf"><small>${payment.receiptName?`Actual: ${esc(payment.receiptName)}`:"Imagen o PDF, máximo 2 MB"}</small></label></div><label>Notas<input name="note" value="${esc(payment.note||"")}"></label><button class="primary-button" type="submit">${paymentId?"Guardar cambios":"Registrar pago"}</button></form>`); }
function taskModal(id="") { const item=state.tasks.find((task)=>task.id===id)||{}; modal(`<form id="taskFormV2" class="v2-form"><h2>${id?"Editar":"Nueva"} tarea</h2><input type="hidden" name="id" value="${esc(id)}"><label>Título<input name="title" required value="${esc(item.title||"")}"></label><div class="v2-form-grid"><label>Cliente<select name="clientId"><option value="">Sin cliente</option>${clientOptions(item.clientId)}</select></label><label>Propuesta<select name="proposalId"><option value="">Sin propuesta</option>${proposalOptions(item.proposalId)}</select></label><label>Fecha<input name="dueDate" type="date" value="${esc(item.dueDate||today())}"></label><label>Prioridad<select name="priority">${["Alta","Media","Baja"].map((v)=>`<option ${v===(item.priority||"Media")?"selected":""}>${v}</option>`).join("")}</select></label><label>Estado<select name="status">${["Pendiente","En curso","Hecha"].map((v)=>`<option ${v===(item.status||"Pendiente")?"selected":""}>${v}</option>`).join("")}</select></label></div><label>Notas<textarea name="note">${esc(item.note||"")}</textarea></label><button class="primary-button" type="submit">Guardar tarea</button></form>`); }
function userModal(id="") { const item=users.find((user)=>user.id===id)||{}; modal(`<form id="userFormV2" class="v2-form"><h2>${id?"Editar":"Nuevo"} usuario</h2><input type="hidden" name="id" value="${esc(id)}"><div class="v2-form-grid"><label>Nombre<input name="name" required value="${esc(item.name||"")}"></label><label>Usuario<input name="username" required value="${esc(item.username||"")}"></label><label>Email<input name="email" type="email" value="${esc(item.email||"")}"></label><label>Rol<select name="role">${Object.entries(roles).map(([key,role])=>`<option value="${key}" ${key===(item.role||"vendedor")?"selected":""}>${esc(role.label)}</option>`).join("")}</select></label><label>Contraseña<input name="password" type="password" minlength="8" ${id?"":"required"} placeholder="${id?"Dejar vacía para conservar":"Mínimo 8 caracteres"}"></label><label class="check-row"><input name="active" type="checkbox" ${item.active!==false?"checked":""}> Usuario activo</label></div><button class="primary-button" type="submit">Guardar usuario</button></form>`); }

function notifications() {
  const result=[]; const now=today();
  state.tasks.filter((t)=>t.status!=="Hecha" && t.dueDate<=now).forEach((t)=>result.push({id:`task:${t.id}`,title:t.dueDate<now?"Tarea vencida":"Tarea para hoy",text:t.title,view:"tareas",level:"danger"}));
  state.proposals.forEach((p)=>{ const sum=totals(p); if(sum.balance>0 && ["Aprobada","En producción","Lista","Entregada"].includes(p.status)) result.push({id:`balance:${p.id}`,title:"Saldo pendiente",text:`${p.publicId} · ${money(sum.balance)}`,view:"propuestas",proposalId:p.id}); if(p.deliveryDate && p.deliveryDate<=addDays(3) && !["Entregada","Rechazada"].includes(p.status)) result.push({id:`delivery:${p.id}`,title:"Entrega próxima",text:`${p.publicId} · ${dateLabel(p.deliveryDate)}`,view:"tareas",proposalId:p.id}); if(p.validUntil && p.validUntil<now && ["Borrador","Enviada","Vista"].includes(p.status)) result.push({id:`expired:${p.id}`,title:"Propuesta vencida",text:p.publicId,view:"propuestas",proposalId:p.id}); const age=(Date.now()-new Date(`${p.updatedDate}T12:00:00`).getTime())/86400000; if(["Enviada","Vista"].includes(p.status)&&age>=5)result.push({id:`followup:${p.id}`,title:"Seguimiento pendiente",text:`${p.publicId} lleva ${Math.floor(age)} días sin cambios`,view:"propuestas",proposalId:p.id}); });
  return result;
}
function notificationRows(items) { return items.length ? `<div class="v2-mini-list">${items.map((n)=>`<button data-notification="${n.id}" data-notification-view="${n.view}" data-notification-proposal="${n.proposalId||""}"><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span></button>`).join("")}</div>` : empty("No hay alertas pendientes."); }
function renderNotifications() { const all=notifications(); const unread=all.filter((n)=>!state.notificationsRead.includes(n.id)); if($("notificationCount")) $("notificationCount").textContent=unread.length; if($("notificationPanel")) $("notificationPanel").innerHTML=`<div class="section-row"><h3>Notificaciones</h3><button data-read-all>Marcar leídas</button></div>${notificationRows(all)}`; }

function pushHistory() { editorHistory.push(clone(state.editorDraft)); if(editorHistory.length>30) editorHistory.shift(); editorFuture=[]; }

async function removeBackground(logo) {
  const image = new Image();
  image.src = logo.src;
  await image.decode();
  const maxSide = 1400, scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale)), height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height), pixels = frame.data, total = width * height;
  const corners = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]].map(([x,y])=>{const i=(y*width+x)*4;return[pixels[i],pixels[i+1],pixels[i+2]]});
  const background = corners.reduce((sum,color)=>sum.map((value,index)=>value+color[index]),[0,0,0]).map((value)=>value/corners.length);
  const distance = (index) => Math.hypot(pixels[index]-background[0],pixels[index+1]-background[1],pixels[index+2]-background[2]);
  const seen = new Uint8Array(total), queue = new Int32Array(total); let head=0, tail=0;
  const enqueue = (position) => { if(position<0||position>=total||seen[position])return; seen[position]=1; if(distance(position*4)<=78)queue[tail++]=position; };
  for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x)} for(let y=0;y<height;y++){enqueue(y*width);enqueue(y*width+width-1)}
  while(head<tail){const position=queue[head++],index=position*4,delta=distance(index);pixels[index+3]=delta<45?0:Math.round(255*(delta-45)/33);const x=position%width;if(x>0)enqueue(position-1);if(x<width-1)enqueue(position+1);if(position>=width)enqueue(position-width);if(position<total-width)enqueue(position+width)}
  context.putImageData(frame,0,0);
  logo.src=canvas.toDataURL("image/png");
}
function updateEditorDraftFromFields() {
  const draft=state.editorDraft, item=product(draft.productId);
  if($("editorColorV2")){ const row=draft.colorQuantities.find((entry)=>entry.color===$("editorColorV2").value); if(row){draft.color=row.color;draft.colorHex=row.hex;} }
  if($("editorSizeV2")) draft.size=$("editorSizeV2").value;
  if($("editorQtyV2")) draft.qty=Math.max(1,Math.round(Number($("editorQtyV2").value||1)));
  if($("editorPriceV2")) draft.unitPrice=Number($("editorPriceV2").value||tierPrice(item,draft.qty));
  if($("editorNoteV2")) draft.note=$("editorNoteV2").value;
}
function rerenderEditor() { renderEditor(); renderNotifications(); }

function trash(type,id,label,data) { state.trash.unshift({id:uid("trash"),type,originalId:id,label,deletedAt:new Date().toISOString(),data:clone(data)}); state.trash=state.trash.slice(0,100); }
function nextQuoteId() { const prefix=(state.settings.quotePrefix||"UNF").replace(/-+$/g,""); const max=state.proposals.reduce((m,p)=>Math.max(m,Number(String(p.publicId||"").match(/(\d+)$/)?.[1]||0)),0); return `${prefix}-${String(max+1).padStart(4,"0")}`; }

function openPrintable(html) {
  const win=window.open("","_blank");
  if(!win)return toast("Habilitá las ventanas emergentes para imprimir.");
  win.document.write(html);
  win.document.close();
}
function printDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value||"") ? value.split("-").reverse().join("-") : esc(value||""); }
function printableHead(title, css) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${esc(location.href.replace(/[^/]*$/, ""))}"><title>${esc(title)}</title><style>${css}</style></head><body>`;
}
function printableFoot() { return `<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));<\/script></body></html>`; }
function buildQuoteHtml(item) {
  const customer=client(item.clientId),sum=totals(item);
  const count=item.designs.reduce((total,design)=>total+Number(design.qty||0),0);
  const lines=item.designs.length?item.designs.map((design)=>`<tr><td class="qty">${Number(design.qty||0)}</td><td><strong>${esc(product(design.productId).name||"Prenda")}</strong><small>Colores y talles: ${esc(variantSummary(design))}</small>${design.logos?.length?`<small>Personalización: ${design.logos.map((logo)=>esc(`${logo.technique||"Logo"} ${logo.side==="back"?"espalda":"frente"}`)).join(" · ")}</small>`:""}</td><td class="amount">${money(design.unitPrice)}</td><td class="amount strong">${money(Number(design.qty||0)*Number(design.unitPrice||0))}</td></tr>`).join(""):`<tr><td colspan="4" class="empty-quote">Todavía no hay prendas cargadas.</td></tr>`;
  const shipping=Number(item.shipping||0),surcharge=Number(item.surcharge||0);
  const totalsLines=`<div><span>Subtotal</span><strong>${money(sum.subtotal)}</strong></div>${sum.discount?`<div><span>Descuento (${Number(item.discount||0)}%)</span><strong>-${money(sum.discount)}</strong></div>`:""}<div><span>${shipping?"Envío":"Envío bonificado"}</span><strong>${money(shipping)}</strong></div>${surcharge?`<div><span>Recargo</span><strong>${money(surcharge)}</strong></div>`:""}${sum.tax?`<div><span>IVA (${Number(item.taxRate||0)}%)</span><strong>${money(sum.tax)}</strong></div>`:""}<div class="grand"><span>TOTAL</span><strong>${money(sum.total)}</strong></div>`;
  const whatsapp=String(state.settings.whatsapp||"+54 9 11 2490-3370");
  return `${printableHead(`Presupuesto ${item.publicId}`,quoteCss())}<main class="quote-page"><div class="gold-line"></div><header class="quote-head"><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div class="slogan">personalizamos lo que te identifica</div></header><section class="quote-meta"><div><small>CLIENTE</small><strong>${esc(customer.company||"")}</strong></div><div><small>FECHA</small><strong>${printDate(item.createdDate)}</strong></div><div><small>PRESUPUESTO N.º</small><strong>${esc(item.publicId)}</strong></div></section><table class="quote-lines"><colgroup><col class="qty-col"><col><col class="price-col"><col class="price-col"></colgroup><thead><tr><th>CANT.</th><th>DESCRIPCIÓN</th><th>PRECIO UNIT.</th><th>SUBTOTAL</th></tr></thead><tbody>${lines}</tbody></table><div class="quote-bottom"><section class="conditions"><h2>CONDICIONES</h2><p><b>Forma de pago:</b> ${esc(item.paymentTerms||"Efectivo / transferencia")}</p><p><b>Envío:</b> ${shipping?money(shipping):"Bonificado"}</p><p><b>Cantidad total:</b> ${count} prendas</p>${item.notes?`<p class="quote-note"><b>Observaciones:</b> ${esc(item.notes)}</p>`:""}</section><section class="quote-totals">${totalsLines}</section></div><section class="no-fiscal"><h2>DOCUMENTO SIN VALOR FISCAL</h2><p>Este presupuesto / comprobante comercial no reemplaza una factura ni constituye un comprobante fiscal. Los importes se expresan en pesos argentinos.</p></section><footer class="quote-footer"><div><strong>UNIFORMA</strong><small>Uniformes corporativos personalizados</small></div><div><strong>WhatsApp: ${esc(whatsapp)}</strong><small>personalizamos lo que te identifica</small></div></footer></main>${printableFoot()}`;
}
function quoteCss() { return `@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}body{background:#f7f3ef;color:#2b241f;font-family:Arial,sans-serif;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.quote-page{position:relative;display:flex;flex-direction:column;min-height:297mm;margin:0 auto;padding:20mm 16mm 19mm;width:210mm;background:#fff;border:1px solid #e4d2bf;border-radius:0 0 5mm 5mm}.gold-line{position:absolute;top:10mm;left:10mm;right:10mm;height:2.7mm;background:#b77a2b;border-radius:5mm}.quote-head{height:40mm;margin-top:3mm;border-bottom:1px solid #e4d2bf}.quote-head img{display:block;width:100mm;max-height:20mm;object-fit:contain;object-position:left}.slogan{margin:2mm 0 0 16mm;color:#643716;font:700 12px Georgia,serif}.quote-meta{display:grid;grid-template-columns:1.65fr .55fr .8fr;gap:3mm;margin-top:6mm;padding:5mm 6mm;background:#fbf8f5;border:1px solid #e5d5c4;border-radius:3mm}.quote-meta div{display:grid;gap:2mm;min-width:0}.quote-meta small{font-size:9px;font-weight:700;color:#99601e}.quote-meta strong{font:700 12px Georgia,serif;overflow-wrap:anywhere}.quote-lines{width:100%;margin-top:6mm;border:1px solid #e5d5c4;border-collapse:separate;border-spacing:0;border-radius:3mm;overflow:hidden;table-layout:fixed}.quote-lines .qty-col{width:10%}.quote-lines .price-col{width:18%}.quote-lines th{padding:4mm;background:#2a201b;color:#fff;font-size:9px;text-align:left}.quote-lines th:first-child,.quote-lines .qty{text-align:center}.quote-lines th:nth-child(n+3){text-align:center}.quote-lines td{padding:5mm 4mm;min-height:18mm;border-right:1px solid #e5d5c4;border-bottom:1px solid #e5d5c4;vertical-align:middle;line-height:1.5}.quote-lines tr:last-child td{border-bottom:0}.quote-lines td:last-child{border-right:0}.quote-lines td strong{display:block;font-size:12px}.quote-lines td small{display:block;margin-top:1mm;color:#73665c;font-size:9px}.quote-lines .amount{text-align:right;white-space:nowrap}.quote-lines .strong{font-weight:700}.empty-quote{text-align:center;color:#777}.quote-bottom{display:grid;grid-template-columns:1.55fr 1fr;gap:5mm;margin-top:7mm}.conditions,.quote-totals{padding:5mm;border:1px solid #e5d5c4;border-radius:3mm}.conditions{background:#fbf8f5}.conditions h2,.no-fiscal h2{margin:0 0 3mm;color:#986020;font-size:10px}.conditions p{margin:1.5mm 0;line-height:1.45}.conditions b{display:inline-block;min-width:26mm}.quote-note{margin-top:3mm!important;overflow-wrap:anywhere}.quote-totals{border-color:#bb7824}.quote-totals>div{display:flex;justify-content:space-between;gap:3mm;padding:1.3mm 0;color:#695c53}.quote-totals strong{color:#2b241f;white-space:nowrap}.quote-totals .grand{margin-top:3mm;padding-top:4mm;border-top:1px solid #e5d5c4;color:#986020;font-size:15px;font-weight:700}.quote-totals .grand strong{font-size:17px}.no-fiscal{margin-top:8mm;padding:5mm;border:1px solid #b77a2b;border-radius:3mm;background:#f7ecd9}.no-fiscal p{margin:0;line-height:1.5}.quote-footer{margin-top:auto;display:flex;justify-content:space-between;padding-top:5mm;border-top:1px solid #e5d5c4}.quote-footer div{display:grid;gap:2mm}.quote-footer div:last-child{text-align:right}.quote-footer strong{font-size:12px}.quote-footer small{font-size:9px;color:#74665a}.quote-footer div:last-child small{color:#986020;font-style:italic}@media print{.quote-page{border:0;border-radius:0;min-height:297mm}.quote-lines tr,.quote-bottom,.no-fiscal,.quote-footer{break-inside:avoid}}`; }
function printProposal(item) { if(item)openPrintable(buildQuoteHtml(item)); }
function productionPreview(design, side, item=product(design.productId)) {
  const image=side==="back"?(item.imageBack||item.image):(item.image||"");
  return `<div class="production-side"><strong>${side==="back"?"ESPALDA":"FRENTE"}</strong><div class="production-art"><img class="garment" src="${esc(image||"")}" alt=""><div class="v2-print-logos">${(design.logos||[]).filter((logo)=>(logo.side||"front")===side).map(logoHtml).join("")}</div></div></div>`;
}
function currentProofSnapshot(item) {
  const customer=client(item.clientId);
  return {publicId:item.publicId,title:item.title,client:{company:customer.company||"",contact:customer.contact||""},revision:item.designRevision,
    approval:item.artApproval?{approvedBy:item.artApproval.approvedBy,approvedAt:item.artApproval.approvedAt,note:item.artApproval.note}:null,
    designs:(item.designs||[]).map((design)=>({design:clone(design),product:{id:design.productId,name:product(design.productId).name,image:product(design.productId).image,imageBack:product(design.productId).imageBack}}))};
}
function buildClientProofHtml(snapshot) {
  const approval=snapshot.approval;
  return `${printableHead(`Diseño ${snapshot.publicId} v${snapshot.revision}`,clientProofCss())}<main class="proof-page"><header class="proof-header"><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>FICHA VISUAL PARA EL CLIENTE</small><h1>${esc(snapshot.publicId)}</h1><p>${esc(snapshot.client?.company||"")} · Versión ${Number(snapshot.revision||0)}</p></div></header><div class="proof-status">${approval?`Diseño aprobado por ${esc(approval.approvedBy)} el ${printDate(approval.approvedAt)} · versión ${Number(snapshot.revision||0)}`:`Diseño pendiente de aprobación · versión ${Number(snapshot.revision||0)}`}</div><p class="proof-intro">${esc(snapshot.title||"")}. Revisá prendas, colores, talles y ubicación de cada logo antes de confirmar la producción.</p>${(snapshot.designs||[]).map((record,index)=>{const design=record.design||{},garment=record.product||{};return `<section class="proof-design"><div class="proof-design-heading"><h2>${index+1}. ${esc(garment.name||"Prenda")}</h2><strong>${Number(design.qty||0)} unidades</strong></div><p><b>Distribución:</b> ${esc(variantAllocations(design,garment).filter((row)=>row.qty>0).map((row)=>`${row.qty} ${row.color} talle ${row.size}`).join(" · ")||"Sin variantes asignadas")}</p><p><b>Vista de referencia:</b> ${esc(design.color||"Color a confirmar")}. Las cantidades por color y talle se detallan arriba.</p><div class="production-sides">${productionPreview(design,"front",garment)}${productionPreview(design,"back",garment)}</div><h3>Logos y medidas</h3>${(design.logos||[]).length?`<table><thead><tr><th>Logo</th><th>Ubicación</th><th>Técnica</th><th>Medidas</th></tr></thead><tbody>${design.logos.map((logo)=>`<tr><td>${esc(logo.name||"Logo")}</td><td>${logo.side==="back"?"Espalda":"Frente"} · ${esc(logo.placement||"")}</td><td>${esc(logo.technique||"")} · ${esc(logo.logoColor||"Según archivo")}</td><td>${positiveCm(logo.widthCm)&&positiveCm(logo.heightCm)?`${cmLabel(logo.widthCm)} × ${cmLabel(logo.heightCm)} cm`:"A confirmar"}</td></tr>`).join("")}</tbody></table>`:"<p>Esta prenda no tiene logos agregados.</p>"}${design.note?`<p><b>Observaciones:</b> ${esc(design.note)}</p>`:""}</section>`;}).join("")}<footer><b>UNIFORMA · personalizamos lo que te identifica</b><span>${approval?`Aprobado por ${esc(approval.approvedBy)} · ${printDate(approval.approvedAt)}`:"Confirmá esta versión antes de comenzar la producción."}</span></footer></main>${printableFoot()}`;
}
function clientProofCss() { return `${productionCss()}@page{size:A4;margin:12mm}.proof-page{max-width:190mm;margin:auto;color:#2b241f}.proof-header{display:flex;justify-content:space-between;align-items:center;gap:8mm;border-bottom:2px solid #b77a2b;padding-bottom:5mm}.proof-header img{width:70mm;max-height:22mm;object-fit:contain}.proof-header div{text-align:right}.proof-header small{color:#986020;font-weight:700}.proof-header h1{margin:2mm 0;font-size:21px}.proof-header p{margin:0}.proof-status{margin:6mm 0;padding:3mm;background:#f7ecd9;border:1px solid #b77a2b;border-radius:2mm;text-align:center;font-weight:700}.proof-intro{line-height:1.5}.proof-design{break-inside:avoid;margin:7mm 0;padding:5mm;border:1px solid #e5d5c4;border-radius:3mm}.proof-design-heading{display:flex;justify-content:space-between;gap:5mm;align-items:center}.proof-design h2{margin:0;font-size:16px}.proof-design-heading strong{color:#986020}.proof-design p{line-height:1.5}.proof-design h3{margin:4mm 0 2mm;font-size:12px}.proof-design table{width:100%;border-collapse:collapse}.proof-design th,.proof-design td{border:1px solid #d9c8b7;padding:2mm;text-align:left}.proof-design th{background:#2b241f;color:#fff}.proof-page footer{display:flex;justify-content:space-between;gap:4mm;padding-top:4mm;border-top:1px solid #d9c8b7;color:#78675a}`; }
function printClientProof(item) { if(item?.designs?.length)openPrintable(buildClientProofHtml(currentProofSnapshot(item))); }
async function printApprovedSnapshot(proposalId,snapshotId) {
  const win=window.open("","_blank");if(!win)throw new Error("Permití las ventanas emergentes para ver la versión aprobada.");
  try{const result=await api("get_design_snapshot",{proposalId,snapshotId});win.document.write(buildClientProofHtml(result.snapshot));win.document.close();}
  catch(error){win.close();throw error;}
}
function buildProductionHtml(item) {
  const customer=client(item.clientId);
  return `${printableHead(`Producción ${item.publicId}`,productionCss())}<main class="production-page"><header><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>FICHA DE PRODUCCIÓN</small><h1>${esc(item.publicId)}</h1><p>${esc(customer.company||"")} · Entrega ${printDate(item.deliveryDate)}</p></div></header><div class="approval-banner">${item.artApproval?`DISEÑO APROBADO · ${esc(item.artApproval.approvedBy)} · ${printDate(item.artApproval.approvedAt)} · versión ${item.artApproval.revision}`:"DISEÑO PENDIENTE DE APROBACIÓN"}</div>${item.designs.map((design,index)=>`<section class="production-design"><h2>${index+1}. ${esc(product(design.productId).name)} <span>${design.qty} unidades</span></h2><table class="production-variants"><thead><tr><th>Color</th><th>Talle</th><th>Cantidad</th></tr></thead><tbody>${variantAllocations(design,product(design.productId)).filter((row)=>row.qty>0).map((row)=>`<tr><td>${esc(row.color)}</td><td>${esc(row.size)}</td><td>${row.qty}</td></tr>`).join("")}</tbody></table><div class="production-sides">${productionPreview(design,"front")}${productionPreview(design,"back")}</div><h3>Indicaciones de logos</h3>${(design.logos||[]).length?`<table class="production-logos"><thead><tr><th>Logo</th><th>Lado / ubicación</th><th>Técnica y color</th><th>Medidas</th></tr></thead><tbody>${design.logos.map((logo)=>`<tr><td>${esc(logo.name||"Logo")}</td><td>${logo.side==="back"?"Espalda":"Frente"} · ${esc(logo.placement||"")}</td><td>${esc(logo.technique||"")} · ${esc(logo.logoColor||"Según archivo")}</td><td>${positiveCm(logo.widthCm)?cmLabel(logo.widthCm):"—"} × ${positiveCm(logo.heightCm)?cmLabel(logo.heightCm):"—"} cm</td></tr>${logo.note?`<tr><td colspan="4">${esc(logo.note)}</td></tr>`:""}`).join("")}</tbody></table>`:"<p>Sin logos cargados.</p>"}${design.note?`<p class="production-note"><b>Observaciones de la prenda:</b> ${esc(design.note)}</p>`:""}</section>`).join("")}<footer>UNIFORMA · Documento interno de producción</footer></main>${printableFoot()}`;
}
function productionCss() { return `@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font:11px Arial,sans-serif;color:#2b241f;-webkit-print-color-adjust:exact;print-color-adjust:exact}.production-page{max-width:190mm;margin:auto}.production-page header{display:flex;justify-content:space-between;align-items:center;gap:8mm;border-bottom:2px solid #b77a2b;padding-bottom:5mm}.production-page header img{width:70mm;object-fit:contain}.production-page header div{text-align:right}.production-page h1{margin:1mm 0;font-size:20px}.production-page header p{margin:0}.approval-banner{margin:6mm 0;padding:3mm;background:#f7ecd9;border:1px solid #b77a2b;border-radius:2mm;font-weight:700;text-align:center}.production-design{break-inside:avoid;margin-bottom:9mm;padding-bottom:7mm;border-bottom:1px solid #d9c8b7}.production-design h2{display:flex;justify-content:space-between;gap:5mm;margin:5mm 0;font-size:15px}.production-design h2 span{color:#986020}.production-design h3{margin:5mm 0 2mm;font-size:12px}.production-variants,.production-logos{width:100%;border-collapse:collapse}.production-variants{margin-bottom:5mm}.production-variants th,.production-logos th{text-align:left;background:#2b241f;color:#fff}.production-variants td,.production-variants th,.production-logos td,.production-logos th{border:1px solid #d9c8b7;padding:2mm}.production-sides{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.production-side>strong{display:block;text-align:center;margin-bottom:1mm}.production-art{position:relative;height:68mm;background:#faf8f5;border:1px solid #e7d8c8;overflow:hidden}.production-art>.garment{width:100%;height:100%;object-fit:contain}.v2-print-logos{position:absolute;inset:0}.v2-print-logo{position:absolute}.v2-print-logo img,.v2-print-logo .v2-logo-tint{display:block;width:100%;height:100%;object-fit:contain}.v2-logo-tint{mask-size:contain;mask-position:center;mask-repeat:no-repeat;-webkit-mask-size:contain;-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;mask-mode:alpha;-webkit-mask-mode:alpha;print-color-adjust:exact;-webkit-print-color-adjust:exact}.production-note{padding:2mm;background:#fbf8f5}.production-page footer{margin-top:9mm;padding-top:3mm;border-top:1px solid #d9c8b7;text-align:center;color:#78675a}`; }
function printProductionSheet(item) { if(item)openPrintable(buildProductionHtml(item)); }

document.addEventListener("click", async (event) => {
  try {
    if(suppressProductionClick){suppressProductionClick=false;event.preventDefault();return;}
    const viewMode=event.target.closest("[data-view-mode]");if(viewMode){const [view,mode]=viewMode.dataset.viewMode.split(":");return setCollectionView(view,mode);}
    const goProposal=event.target.closest("[data-go-proposal]");if(goProposal){state.activeProposalId=goProposal.dataset.goProposal;return go("propuestas");}
    const goButton=event.target.closest("[data-go]"); if(goButton) return go(goButton.dataset.go);
    if(event.target.closest("[data-close-modal]")) return closeModal();
    const submitButton=event.target.closest('button[type="submit"]'); if(submitButton?.form){ event.preventDefault(); if(!submitButton.form.reportValidity()) return; return handleFormSubmit({target:submitButton.form}); }
    const pickedClient=event.target.closest("[data-choose-client-id]"); if(pickedClient) return chooseProposalClient(pickedClient.dataset.chooseClientId);
    const pickedProduct=event.target.closest("[data-editor-product]"); if(pickedProduct) return chooseEditorProduct(pickedProduct.dataset.editorProduct);
    if(!event.target.closest("#proposalClientSearch,#proposalClientResults") && $("proposalClientResults")) $("proposalClientResults").hidden=true;
    if(!event.target.closest("#editorProductSearch,#editorProductResults") && $("editorProductResults")) $("editorProductResults").hidden=true;
    const toggleColor=event.target.closest("[data-toggle-color]"); if(toggleColor){
      const draft=state.editorDraft,item=product(draft.productId),name=toggleColor.dataset.toggleColor;
      const chosen=new Set(draft.colorSizeQuantities.map((row)=>row.color));
      pushHistory();
      if(chosen.has(name)){
        if(chosen.size<=1)return toast("El pedido necesita al menos un color.");
        const lost=draft.colorSizeQuantities.filter((row)=>row.color===name).reduce((sum,row)=>sum+row.qty,0);
        draft.colorSizeQuantities=draft.colorSizeQuantities.filter((row)=>row.color!==name);
        syncVariantTotals(draft);
        if(draft.color===name){draft.color=draft.colorQuantities[0].color;draft.colorHex=draft.colorQuantities[0].hex;}
        if(lost)toast(`Quitaste ${name} (${lost} prendas). Usá ↶ para deshacer.`);
      }else{
        const meta=colorsOf(item).find((entry)=>entry.name===name);if(!meta)return;
        draft.colorSizeQuantities.push({color:meta.name,hex:meta.hex,size:sizesOf(item)[0]||"Único",qty:0});
        draft.color=meta.name;draft.colorHex=meta.hex;
      }
      fillDraftGrid(draft,item);syncDraftQuantity(draft,item);scheduleSave();return rerenderEditor();
    }
    const viewColor=event.target.closest("[data-view-color]"); if(viewColor){
      const row=state.editorDraft.colorQuantities.find((entry)=>entry.color===viewColor.dataset.viewColor);
      if(row){state.editorDraft.color=row.color;state.editorDraft.colorHex=row.hex;scheduleSave();rerenderEditor();}
      return;
    }
    if(event.target.closest("[data-auto-price]")){pushHistory();state.editorDraft.priceManual=false;syncDraftQuantity(state.editorDraft,product(state.editorDraft.productId));scheduleSave();return rerenderEditor();}
    if(event.target.closest("[data-add-color]")){
      const color=colorsOf(product(state.editorDraft.productId)).find((entry)=>entry.name===$("editorAddColorV2")?.value);
      if(!color || state.editorDraft.colorQuantities.some((row)=>row.color===color.name)) return;
      pushHistory();for(const size of new Set(state.editorDraft.colorSizeQuantities.map((row)=>row.size)))state.editorDraft.colorSizeQuantities.push({color:color.name,hex:color.hex,size,qty:0});syncVariantTotals(state.editorDraft);
      state.editorDraft.color=color.name;state.editorDraft.colorHex=color.hex;scheduleSave();return rerenderEditor();
    }
    if(event.target.closest("[data-add-size]")){
      const size=$("editorAddSizeV2")?.value;if(!size || state.editorDraft.colorSizeQuantities.some((row)=>row.size===size))return;
      pushHistory();for(const color of state.editorDraft.colorQuantities)state.editorDraft.colorSizeQuantities.push({color:color.color,hex:color.hex,size,qty:0});
      state.editorDraft.size=size;applyLogoCmScale();scheduleSave();return rerenderEditor();
    }
    const removeSize=event.target.closest("[data-remove-size]");if(removeSize){
      const sizes=new Set(state.editorDraft.colorSizeQuantities.map((row)=>row.size));if(sizes.size<=1)return;
      pushHistory();state.editorDraft.colorSizeQuantities=state.editorDraft.colorSizeQuantities.filter((row)=>row.size!==removeSize.dataset.removeSize);
      if(state.editorDraft.size===removeSize.dataset.removeSize)state.editorDraft.size=state.editorDraft.colorSizeQuantities[0].size;
      syncVariantTotals(state.editorDraft);applyLogoCmScale();scheduleSave();return rerenderEditor();
    }
    const removeColor=event.target.closest("[data-remove-color]"); if(removeColor){
      if(state.editorDraft.colorQuantities.length<=1)return;
      pushHistory();state.editorDraft.colorSizeQuantities=state.editorDraft.colorSizeQuantities.filter((row)=>row.color!==removeColor.dataset.removeColor);syncVariantTotals(state.editorDraft);
      if(!state.editorDraft.colorQuantities.some((row)=>row.color===state.editorDraft.color)){
        state.editorDraft.color=state.editorDraft.colorQuantities[0].color;state.editorDraft.colorHex=state.editorDraft.colorQuantities[0].hex;
      }
      scheduleSave();return rerenderEditor();
    }
    const useClientLogo=event.target.closest("[data-use-client-logo]");if(useClientLogo){
      const active=proposal(),customer=active?state.clients.find((entry)=>entry.id===active.clientId):null;
      const asset=customer?.logos?.find((entry)=>entry.id===useClientLogo.dataset.useClientLogo);if(!asset)return;
      pushHistory();state.editorDraft.logos.push(makeEditorLogo(asset.name||"Logo del cliente",asset.src));selectedLogoId="";scheduleSave();return rerenderEditor();
    }
    if(event.target.closest("[data-logo-original]")){
      const logo=selectedLogo();if(!logo)return;
      pushHistory();logo.tintColor="";
      if(/^#[\da-f]{6}$/i.test(logo.logoColor||""))logo.logoColor="Según archivo";
      scheduleSave();return rerenderEditor();
    }
    if(event.target.closest("#mobileMenu")) return q(".sidebar").classList.toggle("open");
    if(event.target.closest("#logoutBtn")){ await api("logout"); return location.reload(); }
    if(event.target.closest("#notificationBtn,[data-toggle-notifications]")){ const panel=$("notificationPanel"); panel.hidden=!panel.hidden; return; }
    const notification=event.target.closest("[data-notification]"); if(notification){ if(!state.notificationsRead.includes(notification.dataset.notification)) state.notificationsRead.push(notification.dataset.notification); if(notification.dataset.notificationProposal) state.activeProposalId=notification.dataset.notificationProposal; await save(); $("notificationPanel").hidden=true; return go(notification.dataset.notificationView); }
    if(event.target.closest("[data-read-all]")){ state.notificationsRead=notifications().map((n)=>n.id); await save("Notificaciones marcadas como leídas."); return renderNotifications(); }
    if(event.target.closest("[data-new-client]")) return clientModal();
    const editClient=event.target.closest("[data-edit-client]"); if(editClient) return clientModal(editClient.dataset.editClient);
    const syncCatalog=event.target.closest("[data-sync-catalog]"); if(syncCatalog){ syncCatalog.disabled=true; syncCatalog.textContent="Sincronizando…"; await api("sync_catalog"); toast(`${state.products.length} productos sincronizados desde la web.`); renderCatalog(); return; }
    if(event.target.closest("[data-new-product]")) return productModal();
    const editProduct=event.target.closest("[data-edit-product]"); if(editProduct) return productModal(editProduct.dataset.editProduct);
    const stockProduct=event.target.closest("[data-stock-product]");if(stockProduct)return stockModal(stockProduct.dataset.stockProduct);
    const productionDesign=event.target.closest("[data-production-design]");if(productionDesign){const [pid,did]=productionDesign.dataset.productionDesign.split(":");return productionModal(pid,did);}
    if(event.target.closest("[data-export-stock-plan]"))return exportStockPlan();
    if(event.target.closest("[data-new-task]")) return taskModal();
    const editTask=event.target.closest("[data-edit-task]"); if(editTask) return taskModal(editTask.dataset.editTask);
    if(event.target.closest("[data-new-user]")) return userModal();
    const editUser=event.target.closest("[data-edit-user]"); if(editUser) return userModal(editUser.dataset.editUser);
    const newProposal=event.target.closest("[data-new-proposal]"); if(newProposal) return proposalModal("",newProposal.dataset.newProposal||"");
    const editProposal=event.target.closest("[data-edit-proposal]"); if(editProposal) return proposalModal(editProposal.dataset.editProposal);
    const openProposal=event.target.closest("[data-open-proposal]"); if(openProposal){ state.activeProposalId=openProposal.dataset.openProposal; if(currentView!=="propuestas") go("propuestas"); else {$("proposalDetailV2").innerHTML=proposalDetail(proposal());} return; }
    const clientProps=event.target.closest("[data-client-proposals]"); if(clientProps){ const first=state.proposals.find((p)=>p.clientId===clientProps.dataset.clientProposals); if(first) state.activeProposalId=first.id; go("propuestas"); $("proposalClientFilter").value=clientProps.dataset.clientProposals; filterProposals(); return; }
    const useProduct=event.target.closest("[data-use-product]"); if(useProduct){chooseEditorProduct(useProduct.dataset.useProduct);go("editor");return;}
    const editDesigns=event.target.closest("[data-edit-designs]"); if(editDesigns){ const p=proposal(editDesigns.dataset.editDesigns);if(p?.artApproval)return toast("Reabrí la aprobación antes de cambiar las prendas.");state.activeProposalId=p.id;resetEditorDraft();scheduleSave();go("editor");return; }
    const editDesign=event.target.closest("[data-edit-design]"); if(editDesign){ const [pid,did]=editDesign.dataset.editDesign.split(":"); const p=proposal(pid), d=p?.designs.find((x)=>x.id===did); if(p?.artApproval)return toast("Reabrí la aprobación antes de cambiar el diseño.");if(d){ state.activeProposalId=pid; state.editorDraft=clone(d); state.editorDraft.priceManual=Number(d.unitPrice)!==tierPrice(product(d.productId),d.qty); editingDesignId=did; selectedLogoId=""; editorSide="front"; editorHistory=[]; editorFuture=[]; go("editor"); } return; }
    const duplicateDesign=event.target.closest("[data-duplicate-design]"); if(duplicateDesign){ const [pid,did]=duplicateDesign.dataset.duplicateDesign.split(":"), p=proposal(pid), d=p.designs.find((x)=>x.id===did);if(p.artApproval)return toast("Reabrí la aprobación antes de duplicar una prenda.");const copy=clone(d); copy.id=uid("design");copy.production=productionOf({}); p.designs.push(copy);markDesignChanged(p); proposalEvent(p,"Prenda duplicada",product(d.productId).name); await save("Prenda duplicada."); return renderProposals(); }
    const deleteDesign=event.target.closest("[data-delete-design]"); if(deleteDesign){ const [pid,did]=deleteDesign.dataset.deleteDesign.split(":"), p=proposal(pid), d=p.designs.find((x)=>x.id===did);if(p.artApproval)return toast("Reabrí la aprobación antes de quitar una prenda.");if(confirm("¿Quitar esta prenda de la propuesta?")){ p.designs=p.designs.filter((x)=>x.id!==did);markDesignChanged(p); proposalEvent(p,"Prenda eliminada",product(d.productId).name); await save("Prenda quitada."); renderProposals(); } return; }
    const duplicateProposal=event.target.closest("[data-duplicate-proposal]"); if(duplicateProposal){ const source=proposal(duplicateProposal.dataset.duplicateProposal), copy=clone(source); copy.id=uid("proposal"); copy.publicId=nextQuoteId(); copy.title=`Copia de ${source.title}`; copy.status="Borrador"; copy.createdDate=today(); copy.updatedDate=today(); copy.payments=[]; copy.history=[];copy.artApproval=null;copy.approvalHistory=[];copy.designRevision=0; copy.designs.forEach((d)=>{d.id=uid("design");d.production=productionOf({});}); state.proposals.unshift(copy); state.activeProposalId=copy.id; proposalEvent(copy,"Propuesta duplicada",source.publicId); await save("Propuesta duplicada."); renderProposals(); return; }
    const print=event.target.closest("[data-print-proposal]"); if(print) return printProposal(proposal(print.dataset.printProposal));
    const printProof=event.target.closest("[data-print-proof]");if(printProof)return printClientProof(proposal(printProof.dataset.printProof));
    const approvedProof=event.target.closest("[data-print-approved]");if(approvedProof){const [proposalId,snapshotId]=approvedProof.dataset.printApproved.split(":");return printApprovedSnapshot(proposalId,snapshotId);}
    const printProduction=event.target.closest("[data-print-production]");if(printProduction)return printProductionSheet(proposal(printProduction.dataset.printProduction));
    const approveArt=event.target.closest("[data-approve-art]");if(approveArt)return artApprovalModal(approveArt.dataset.approveArt);
    const revokeArt=event.target.closest("[data-revoke-art]");if(revokeArt){const item=proposal(revokeArt.dataset.revokeArt);if(!item?.artApproval)return;if(!confirm("¿Reabrir el diseño aprobado? Tendrá que volver a aprobarse después de los cambios."))return;clearTimeout(saveTimer);await save();await api("reopen_design",{proposalId:item.id});toast("Diseño reabierto para edición.");return renderProposals();}
    const whatsapp=event.target.closest("[data-whatsapp-proposal]"); if(whatsapp){ const p=proposal(whatsapp.dataset.whatsappProposal), c=client(p.clientId), sum=totals(p); const text=`Hola ${c.contact||c.company}, te enviamos la propuesta ${p.publicId} de UNIFORMA. Total: ${money(sum.total)}. Validez: ${dateLabel(p.validUntil)}.`; window.open(`https://wa.me/${String(c.phone||state.settings.whatsapp||"").replace(/\D/g,"")}?text=${encodeURIComponent(text)}`,"_blank"); return; }
    const addPayment=event.target.closest("[data-add-payment]"); if(addPayment) return paymentModal(addPayment.dataset.addPayment);
    const editPayment=event.target.closest("[data-edit-payment]"); if(editPayment){ const [pid,payid]=editPayment.dataset.editPayment.split(":"); return paymentModal(pid,payid); }
    const deletePayment=event.target.closest("[data-delete-payment]"); if(deletePayment){ const [pid,payid]=deletePayment.dataset.deletePayment.split(":"), p=proposal(pid); if(confirm("¿Eliminar este pago?")){ p.payments=p.payments.filter((x)=>x.id!==payid); proposalEvent(p,"Pago eliminado",payid); await save("Pago eliminado."); renderProposals(); } return; }
    const trashProposal=event.target.closest("[data-trash-proposal]"); if(trashProposal){ const p=proposal(trashProposal.dataset.trashProposal); if(confirm(`¿Enviar ${p.publicId} a la papelera?`)){ trash("Propuesta",p.id,p.publicId,p); state.proposals=state.proposals.filter((x)=>x.id!==p.id); state.activeProposalId=state.proposals[0]?.id||""; audit("Propuesta eliminada",p.publicId); await save("Propuesta enviada a la papelera."); renderProposals(); } return; }
    const trashClient=event.target.closest("[data-trash-client]"); if(trashClient){ const c=client(trashClient.dataset.trashClient),related=state.proposals.filter((p)=>p.clientId===c.id),tasks=state.tasks.filter((t)=>t.clientId===c.id); if(confirm(`¿Enviar ${c.company} y sus ${related.length} propuesta(s) a la papelera?`)){ trash("Cliente",c.id,c.company,{client:c,proposals:related,tasks}); state.clients=state.clients.filter((x)=>x.id!==c.id); state.proposals=state.proposals.filter((p)=>p.clientId!==c.id); state.tasks=state.tasks.filter((t)=>t.clientId!==c.id); await save("Cliente y datos asociados enviados a la papelera."); renderClients(); } return; }
    const trashProduct=event.target.closest("[data-trash-product]"); if(trashProduct){ const p=product(trashProduct.dataset.trashProduct),used=state.proposals.some((proposalItem)=>proposalItem.designs.some((design)=>design.productId===p.id)); if(used)return toast("Este producto está usado en propuestas. Quitalo de esas propuestas antes de borrarlo."); if(confirm(`¿Enviar ${p.name} a la papelera?`)){ trash("Producto",p.id,p.name,p); state.products=state.products.filter((x)=>x.id!==p.id); await save("Producto enviado a la papelera."); renderCatalog(); } return; }
    const restore=event.target.closest("[data-restore-trash]"); if(restore){ const entry=state.trash.find((x)=>x.id===restore.dataset.restoreTrash); if(entry){ if(entry.type==="Cliente"&&entry.data.client){state.clients.unshift(entry.data.client);state.proposals.unshift(...(entry.data.proposals||[]));state.tasks.unshift(...(entry.data.tasks||[]));}else{const map={Cliente:"clients",Producto:"products",Propuesta:"proposals"};state[map[entry.type]].unshift(entry.data);} state.trash=state.trash.filter((x)=>x.id!==entry.id); await save("Elemento restaurado."); renderSettings(); } return; }
    const purge=event.target.closest("[data-purge-trash]"); if(purge && confirm("¿Eliminar definitivamente?")){ state.trash=state.trash.filter((x)=>x.id!==purge.dataset.purgeTrash); await save("Eliminado definitivamente."); renderSettings(); return; }
    if(event.target.closest("[data-add-payment]")) return;
    if(event.target.closest("[data-export-backup]")) return exportBackup();
    const selectLogo=event.target.closest("[data-select-logo]"); if(selectLogo){ selectedLogoId=selectLogo.dataset.selectLogo; editorSide=selectedLogo()?.side||"front"; return rerenderEditor(); }
    const sideButton=event.target.closest("[data-editor-side]"); if(sideButton){ editorSide=sideButton.dataset.editorSide; selectedLogoId=""; return rerenderEditor(); }
    if(event.target.closest("[data-remove-background]")){ const logo=selectedLogo(); if(!logo)return; pushHistory(); toast("Quitando fondo…"); await removeBackground(logo); scheduleSave(); toast("Fondo eliminado. Usá ↶ para deshacer si hace falta."); return rerenderEditor(); }
    const deleteLogo=event.target.closest("[data-delete-logo-id],[data-delete-logo]"); if(deleteLogo){const id=deleteLogo.dataset.deleteLogoId||selectedLogoId;if(!id)return;pushHistory();state.editorDraft.logos=state.editorDraft.logos.filter((l)=>l.id!==id);selectedLogoId="";scheduleSave();return rerenderEditor();}
    if(event.target.closest("[data-duplicate-logo]")){ const logo=selectedLogo(); if(logo){ pushHistory(); const copy={...clone(logo),id:uid("logo"),x:logo.x+4,y:logo.y+4,name:`${logo.name} copia`}; state.editorDraft.logos.push(copy); selectedLogoId=copy.id; scheduleSave(); rerenderEditor(); } return; }
    const clickedLogo=event.target.closest(".v2-logo"); if(clickedLogo){selectedLogoId=clickedLogo.dataset.logoId;return rerenderEditor();}
    if(event.target.closest("[data-undo-editor]")){ if(editorHistory.length){ editorFuture.push(clone(state.editorDraft)); state.editorDraft=editorHistory.pop(); rerenderEditor(); } return; }
    if(event.target.closest("[data-redo-editor]")){ if(editorFuture.length){ editorHistory.push(clone(state.editorDraft)); state.editorDraft=editorFuture.pop(); rerenderEditor(); } return; }
    if(event.target.closest("[data-apply-suggested]")){const suggested=suggestedUnitPrice(state.editorDraft);if(!suggested)return;pushHistory();state.editorDraft.unitPrice=suggested;state.editorDraft.priceManual=true;scheduleSave();return rerenderEditor();}
    if(event.target.closest("[data-save-design]")){
      if($("editorProductSearch")?.value.trim()!==product(state.editorDraft.productId).name) return toast("Elegí una prenda de los resultados de la búsqueda.");
      updateEditorDraftFromFields();const p=proposal();if(!p)return toast("Creá o seleccioná una propuesta.");
      if(p.artApproval)return toast("Reabrí la aprobación antes de cambiar el diseño.");
      syncDraftQuantity(state.editorDraft,product(state.editorDraft.productId));
      if(!state.editorDraft.qty)return toast("Escribí la cantidad en al menos un talle antes de guardar.");
      const previewColor=state.editorDraft.colorQuantities.find((row)=>row.color===state.editorDraft.color && row.qty>0)
        || state.editorDraft.colorQuantities.find((row)=>row.qty>0);
      state.editorDraft.color=previewColor.color;state.editorDraft.colorHex=previewColor.hex;
      if(!state.editorDraft.colorSizeQuantities.some((row)=>row.size===state.editorDraft.size&&row.qty>0))state.editorDraft.size=state.editorDraft.colorSizeQuantities.find((row)=>row.qty>0).size;
      const design={...clone(state.editorDraft),id:editingDesignId||uid("design")};
      design.colorSizeQuantities=design.colorSizeQuantities.filter((row)=>row.qty>0);syncVariantTotals(design);
      design.production=productionOf({});
      const firstLogo=design.logos[0];design.method=firstLogo?.technique||"";design.placement=firstLogo?.placement||"";
      const snapshot={designs:clone(p.designs),revision:p.designRevision,history:clone(p.history),updatedDate:p.updatedDate,audit:clone(state.auditLog),draft:clone(state.editorDraft),editingDesignId};
      const index=p.designs.findIndex((d)=>d.id===editingDesignId);if(index>=0)p.designs[index]=design;else p.designs.push(design);
      markDesignChanged(p);proposalEvent(p,editingDesignId?"Prenda actualizada":"Prenda agregada",`${product(design.productId).name} x${design.qty}: ${variantSummary(design)}`);
      resetEditorDraft(design.productId);
      try{await save("Prenda guardada en la propuesta.");}catch(error){Object.assign(p,{designs:snapshot.designs,designRevision:snapshot.revision,history:snapshot.history,updatedDate:snapshot.updatedDate});state.auditLog=snapshot.audit;state.editorDraft=snapshot.draft;editingDesignId=snapshot.editingDesignId;rerenderEditor();throw error;}
      rerenderEditor();return;
    }
    if(event.target.closest("#v2Stage") && selectedLogoId){if(suppressStageClick)return;selectedLogoId="";return rerenderEditor();}
    const complete=event.target.closest("[data-complete-task]"); if(complete){ const task=state.tasks.find((t)=>t.id===complete.dataset.completeTask); task.status="Hecha"; await save("Tarea completada."); renderTasks(); }
  } catch(error){ console.error(error); toast(error.message); }
});

document.addEventListener("dragstart",(event)=>{
  const card=event.target.closest("[data-production-card]");
  if(!card || !can("proposals.manage"))return;
  event.dataTransfer.effectAllowed="move";
  event.dataTransfer.setData("text/plain",card.dataset.productionCard);
  card.classList.add("dragging");
});
document.addEventListener("dragover",(event)=>{
  const zone=event.target.closest("[data-drop-status]");if(!zone)return;
  event.preventDefault();event.dataTransfer.dropEffect="move";
  qa("[data-drop-status]").forEach((node)=>node.classList.toggle("drag-over",node===zone));
});
document.addEventListener("drop",async(event)=>{
  const zone=event.target.closest("[data-drop-status]");if(!zone)return;
  event.preventDefault();
  const id=event.dataTransfer.getData("text/plain");
  qa("[data-drop-status]").forEach((node)=>node.classList.remove("drag-over"));
  suppressProductionClick=true;setTimeout(()=>suppressProductionClick=false,250);
  try{await setProposalStatus(id,zone.dataset.dropStatus);}catch(error){toast(error.message);}
});
document.addEventListener("dragend",()=>{
  qa("[data-drop-status]").forEach((node)=>node.classList.remove("drag-over"));
  qa("[data-production-card]").forEach((node)=>node.classList.remove("dragging"));
});
document.addEventListener("pointerdown",(event)=>{
  if(event.pointerType==="mouse" || !can("proposals.manage") || event.target.closest("select"))return;
  const card=event.target.closest("[data-production-card]");if(!card)return;
  productionTouch={card,id:card.dataset.productionCard,startX:event.clientX,startY:event.clientY,moved:false,zone:null};
});
document.addEventListener("pointermove",(event)=>{
  if(!productionTouch)return;
  const session=productionTouch,dx=event.clientX-session.startX,dy=event.clientY-session.startY;
  if(Math.hypot(dx,dy)<8 && !session.moved)return;
  session.moved=true;event.preventDefault();
  const board=session.card.closest(".v2-production-board"),rect=board?.getBoundingClientRect();
  if(board && rect){if(event.clientX>rect.right-35)board.scrollLeft+=12;else if(event.clientX<rect.left+35)board.scrollLeft-=12;}
  session.card.classList.add("dragging");session.card.style.transform=`translate(${dx}px,${dy}px)`;
  session.card.style.pointerEvents="none";
  session.zone=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-drop-status]")||null;
  session.card.style.pointerEvents="";
  qa("[data-drop-status]").forEach((node)=>node.classList.toggle("drag-over",node===session.zone));
},{passive:false});
document.addEventListener("pointerup",async()=>{
  if(!productionTouch)return;
  const session=productionTouch;productionTouch=null;
  session.card.style.transform="";session.card.classList.remove("dragging");
  qa("[data-drop-status]").forEach((node)=>node.classList.remove("drag-over"));
  if(session.moved){suppressProductionClick=true;setTimeout(()=>suppressProductionClick=false,250);if(session.zone)try{await setProposalStatus(session.id,session.zone.dataset.dropStatus);}catch(error){toast(error.message);}}
});
document.addEventListener("pointercancel",()=>{
  if(!productionTouch)return;
  productionTouch.card.style.transform="";productionTouch.card.classList.remove("dragging");productionTouch=null;
  qa("[data-drop-status]").forEach((node)=>node.classList.remove("drag-over"));
});

async function handleFormSubmit(event) {
  const formId = event.target.getAttribute("id");
  try {
    if(formId==="clientFormV2"){ const form=event.target, data=new FormData(form), id=String(data.get("id")||""), existing=id?client(id):null, logos=existing?.logos||[]; for(const file of form.elements.logos.files||[]) logos.push({id:uid("client-logo"),name:file.name,src:await readFile(file)}); const payload={id:id||uid("client"),company:String(data.get("company")),contact:String(data.get("contact")),cuit:String(data.get("cuit")),phone:String(data.get("phone")),email:String(data.get("email")),address:String(data.get("address")),sector:String(data.get("sector")),priority:String(data.get("priority")),notes:String(data.get("notes")),internalNotes:String(data.get("internalNotes")),logos,ownerId:currentUser.id}; if(existing) Object.assign(existing,payload); else state.clients.unshift(payload); audit(id?"Cliente actualizado":"Cliente creado",payload.company); await save("Cliente guardado."); closeModal(); renderClients(); return; }
    if(formId==="productFormV2"){ const form=event.target,data=new FormData(form),id=String(data.get("id")||""),existing=id?product(id):null,front=form.elements.imageFile.files[0],back=form.elements.imageBackFile.files[0]; const parseColors=String(data.get("colors")||"").split(",").map((v)=>{const [name,hex]=v.split(":");return{name:(name||"").trim(),hex:(hex||"#d8d1c7").trim()};}).filter((c)=>c.name); const rows=String(data.get("sizeChart")||"").split("\n").map((r)=>{const [size,width,length]=r.split("|");return{size,width,length};}).filter((r)=>r.size); const payload={id:id||uid("product"),name:String(data.get("name")),category:String(data.get("category")),material:String(data.get("material")),unitCost:Math.max(0,Number(data.get("unitCost")||0)),source:existing?.source||(existing?"Web":"Manual"),image:front?await readFile(front):(existing?.image||""),imageBack:back?await readFile(back):(existing?.imageBack||existing?.image||""),colors:parseColors,sizeOptions:String(data.get("sizes")||"").split(",").map((v)=>v.trim()).filter(Boolean),methods:String(data.get("methods")||"").split(",").map((v)=>v.trim()).filter(Boolean),prices:Object.fromEntries([5,10,20,50].map((qty)=>[qty,Number(data.get(`price${qty}`)||0)])),basePrice:Number(data.get("price5")||0),description:String(data.get("description")),features:String(data.get("features")||"").split("\n").map((v)=>v.trim()).filter(Boolean),sizeChart:rows}; if(existing) Object.assign(existing,payload); else state.products.unshift(payload); audit(id?"Producto actualizado":"Producto creado",payload.name); await save("Producto guardado."); closeModal(); renderCatalog(); return; }
    if(formId==="stockFormV2"){
      if(!can("catalog.manage"))throw new Error("No tenés permisos para editar stock.");
      const form=event.target,item=state.products.find((entry)=>entry.id===new FormData(form).get("productId"));
      if(!item)throw new Error("No se encontró el producto.");
      const cells=[...form.querySelectorAll("[data-stock-variant]")];
      if(cells.some((cell)=>!Number.isInteger(Number(cell.value))||Number(cell.value)<0))throw new Error("Ingresá cantidades enteras de cero o más.");
      item.stockVariants=cells.map((cell)=>({color:cell.dataset.stockColor,size:cell.dataset.stockSize,qty:Number(cell.value)}));
      audit("Stock actualizado",item.name);
      await save("Stock actualizado.");closeModal();renderCatalog();return;
    }
    if(formId==="productionFormV2"){
      if(!can("proposals.manage"))throw new Error("No tenés permisos para controlar producción.");
      const data=new FormData(event.target),item=proposal(String(data.get("proposalId")||"")),design=item?.designs.find((row)=>row.id===String(data.get("designId")||""));
      if(!design)throw new Error("No se encontró la prenda.");
      const previous=productionOf(design),next={...previous,responsible:String(data.get("responsible")||"").trim(),dueDate:String(data.get("dueDate")||""),qualityNote:String(data.get("qualityNote")||"").trim()};
      for(const [key] of PRODUCTION_STEPS)next[key]=Boolean(data.get(key));
      next.quality=String(data.get("quality")||"Pendiente");
      if(!["Pendiente","Aprobada","Rehacer"].includes(next.quality))throw new Error("Estado de control inválido.");
      if(next.quality==="Aprobada" && PRODUCTION_STEPS.some(([key])=>!next[key]))throw new Error("Completá todos los pasos antes de aprobar el control final.");
      if(next.quality==="Aprobada" && !item.artApproval)throw new Error("Registrá primero la aprobación del diseño del cliente.");
      if(next.quality==="Rehacer" && !next.qualityNote)throw new Error("Indicá qué hay que rehacer.");
      if(next.quality!==previous.quality){next.checkedBy=currentUser.name||"Equipo";next.checkedAt=today();}
      const snapshot={production:clone(design.production),events:clone(item.history),updatedDate:item.updatedDate,audit:clone(state.auditLog)};
      design.production=next;proposalEvent(item,"Control de producción",`${product(design.productId).name}: ${next.quality}`);
      try{await save("Control de producción guardado.");}catch(error){design.production=snapshot.production;item.history=snapshot.events;item.updatedDate=snapshot.updatedDate;state.auditLog=snapshot.audit;throw error;}
      closeModal();if(currentView==="tareas")renderTasks();else renderProposals();return;
    }
    if(formId==="proposalFormV2"){
      const form=event.target, data=new FormData(form), id=String(data.get("id")||""), existing=id?proposal(id):null;
      if(id && !existing) throw new Error("No se encontró la propuesta que querés editar.");
      const mode=String(data.get("clientMode")||"");
      let clientId="", newClient=null;
      if(mode==="new"){
        if(!can("clients.manage")) throw new Error("Tu usuario no puede crear clientes.");
        const company=String(data.get("newClientCompany")||"").trim();
        if(!company) throw new Error("Ingresá el nombre del cliente o la razón social.");
        newClient={
          id:uid("client"), company, contact:String(data.get("newClientContact")||"").trim()||company,
          phone:String(data.get("newClientPhone")||"").trim(), email:String(data.get("newClientEmail")||"").trim(),
          cuit:String(data.get("newClientCuit")||"").trim(), sector:String(data.get("newClientSector")||"").trim(),
          address:String(data.get("newClientAddress")||"").trim(), priority:"Media", source:"Panel",
          notes:"", internalNotes:"", logos:[], ownerId:currentUser.id
        };
        const duplicate=duplicateClientFor(newClient);
        if(duplicate) throw new Error(`Ya existe una ficha para ${duplicate.company}. Elegí “cliente anterior” y buscala por nombre, CUIT o contacto.`);
        clientId=newClient.id;
      } else if(mode==="existing"){
        clientId=String(data.get("clientId")||"");
        if(!clientId || !state.clients.some((item)=>item.id===clientId)) throw new Error("Seleccioná un cliente anterior de la lista.");
      } else {
        throw new Error("Elegí si el cliente es nuevo o anterior.");
      }
      const payload={
        clientId,title:String(data.get("title")||"Propuesta comercial").trim(),status:String(data.get("status")),
        priority:String(data.get("priority")),validUntil:String(data.get("validUntil")),paymentTerms:String(data.get("paymentTerms")||"Efectivo / transferencia").trim(),
        deliveryDate:String(data.get("deliveryDate")),discount:Number(data.get("discount")||0),
        surcharge:Number(data.get("surcharge")||0),shipping:Number(data.get("shipping")||0),shippingCost:can("settings.manage")?Math.max(0,Number(data.get("shippingCost")||0)):Number(existing?.shippingCost||0),
        taxRate:Number(data.get("taxRate")||0),notes:String(data.get("notes")),internalNotes:String(data.get("internalNotes"))
      };
      if(existing?.artApproval && existing.clientId!==clientId)throw new Error("Reabrí la aprobación del diseño antes de cambiar el cliente.");
      const snapshot={clients:clone(state.clients),proposals:clone(state.proposals),activeProposalId:state.activeProposalId,auditLog:clone(state.auditLog),editorDraft:clone(state.editorDraft)};
      const submitButton=form.querySelector('[type="submit"]');
      submitButton.disabled=true;
      try {
        if(newClient){state.clients.unshift(newClient);audit("Cliente creado desde propuesta",newClient.company);}
        if(existing){
          const previous=existing.status;
          Object.assign(existing,payload);
          proposalEvent(existing,"Propuesta actualizada",previous!==payload.status?`${previous} → ${payload.status}`:payload.title);
          state.activeProposalId=existing.id;
        } else {
          const item={id:uid("proposal"),publicId:nextQuoteId(),createdDate:today(),updatedDate:today(),designs:[],payments:[],history:[],ownerId:currentUser.id,...payload};
          state.proposals.unshift(item);
          state.activeProposalId=item.id;
          proposalEvent(item,"Propuesta creada",payload.title);
          resetEditorDraft();
        }
        clearTimeout(saveTimer);
        await save(newClient?"Cliente y propuesta guardados.":"Propuesta guardada.");
      } catch(error){
        Object.assign(state,snapshot);
        throw error;
      } finally {
        submitButton.disabled=false;
      }
      closeModal();editingDesignId="";go("editor");return;
    }
    if(formId==="artApprovalFormV2"){
      const form=event.target,data=new FormData(form),item=proposal(String(data.get("proposalId")||""));
      if(!item || !item.designs.length || !can("proposals.manage"))throw new Error("No se puede aprobar este diseño.");
      if(item.artApproval)throw new Error("Este diseño ya está aprobado.");
      const file=form.elements.evidence.files[0];if(file&&file.size>2*1024*1024)throw new Error("El comprobante supera los 2 MB.");
      clearTimeout(saveTimer);await save();
      const latest=proposal(item.id);
      await api("approve_design",{proposalId:item.id,designs:latest.designs,expectedRevision:latest.designRevision,approvedAt:String(data.get("approvedAt")||""),approvedBy:String(data.get("approvedBy")||"").trim(),note:String(data.get("note")||"").trim(),evidenceName:file?.name||"",evidenceData:file?await readFile(file):""});
      toast("Aprobación registrada y versión visual archivada.");closeModal();renderProposals();return;
    }
    if(formId==="paymentFormV2"){ const form=event.target,data=new FormData(form),p=proposal(String(data.get("proposalId"))),paymentId=String(data.get("paymentId")||""),existing=p.payments.find((entry)=>entry.id===paymentId),receipt=form.elements.receipt.files[0]; if(receipt&&receipt.size>2*1024*1024)throw new Error("El comprobante supera el máximo de 2 MB."); const payment={id:paymentId||uid("payment"),type:String(data.get("type")),amount:Number(data.get("amount")),method:String(data.get("method")),date:String(data.get("date")),reference:String(data.get("reference")),note:String(data.get("note")),receiptName:receipt?receipt.name:(existing?.receiptName||""),receiptData:receipt?await readFile(receipt):(existing?.receiptData||""),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),createdBy:existing?.createdBy||currentUser.name||"Equipo"}; if(!payment.amount||payment.amount<0)throw new Error("Ingresá un monto válido."); if(existing)Object.assign(existing,payment);else p.payments.push(payment); proposalEvent(p,existing?"Pago actualizado":"Pago registrado",`${payment.type} · ${money(payment.amount)} · ${payment.method}`); await save(existing?"Pago actualizado.":"Pago registrado. El saldo se recalculó automáticamente."); closeModal(); renderProposals(); return; }
    if(formId==="taskFormV2"){ const data=new FormData(event.target),id=String(data.get("id")||""),existing=state.tasks.find((task)=>task.id===id),payload={title:String(data.get("title")),clientId:String(data.get("clientId")),proposalId:String(data.get("proposalId")),dueDate:String(data.get("dueDate")),priority:String(data.get("priority")),status:String(data.get("status")),note:String(data.get("note")),ownerId:currentUser.id}; if(existing)Object.assign(existing,payload);else state.tasks.unshift({id:uid("task"),createdAt:new Date().toISOString(),...payload});audit(id?"Tarea actualizada":"Tarea creada",payload.title);await save("Tarea guardada.");closeModal();renderTasks();return; }
    if(formId==="userFormV2"){ const data=new FormData(event.target),id=String(data.get("id")||""),role=String(data.get("role")||"vendedor"),payload={id,name:String(data.get("name")),username:String(data.get("username")),email:String(data.get("email")),role,password:String(data.get("password")),active:Boolean(data.get("active")),permissionsOverride:role==="admin"?[]:(roles[role]?.permissions||[]).filter((permission)=>permission!=="all")};await api(id?"update_user":"create_user",{user:payload});closeModal();renderUsers();toast("Usuario guardado.");return; }
    if(formId==="settingsFormV2"){ const data=new FormData(event.target); Object.assign(state.settings,{companyName:String(data.get("companyName")),whatsapp:String(data.get("whatsapp")),quotePrefix:String(data.get("quotePrefix")),taxRate:Number(data.get("taxRate")),validityDays:Number(data.get("validityDays")),productionDays:Number(data.get("productionDays")),defaultMargin:Math.min(90,Math.max(0,Number(data.get("defaultMargin")||0))),techniqueCosts:{Bordado:{unit:Math.max(0,Number(data.get("bordadoUnit")||0)),setup:Math.max(0,Number(data.get("bordadoSetup")||0))},DTF:{unit:Math.max(0,Number(data.get("dtfUnit")||0)),setup:Math.max(0,Number(data.get("dtfSetup")||0))}}}); audit("Configuración actualizada","Reglas comerciales y costos"); await save("Configuración guardada."); renderSettings(); }
  } catch(error){ console.error(error); toast(error.message); }
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  await handleFormSubmit(event);
});

document.addEventListener("change", async (event) => {
  const target=event.target;
  if(target.id==="proposalClientMode") return toggleProposalClientMode();
  if(target.id==="editorProposal"){ state.activeProposalId=target.value; resetEditorDraft();scheduleSave();return rerenderEditor(); }
  if(["editorColorV2","editorSizeV2"].includes(target.id)){ pushHistory(); updateEditorDraftFromFields(); if(target.id==="editorSizeV2")applyLogoCmScale(); scheduleSave(); return rerenderEditor(); }
  if(target.id==="editorQtyV2"){ pushHistory(); setEditorTotalQuantity(target.value); scheduleSave(); return rerenderEditor(); }
  if(target.matches("[data-variant-color]")){const row=state.editorDraft.colorSizeQuantities.find((entry)=>entry.color===target.dataset.variantColor&&entry.size===target.dataset.variantSize);if(row){row.qty=Math.max(0,Math.floor(Number(target.value)||0));target.value=row.qty||"";syncVariantTotals(state.editorDraft);syncEditorColorFeedback();scheduleSave();}return;}
  if(["editorScaleWidth","editorScaleHeight"].includes(target.id)){
    pushHistory();state.editorDraft[target.id==="editorScaleWidth"?"previewWidthCm":"previewHeightCm"]=positiveCm(target.value)||"";
    applyLogoCmScale();scheduleSave();return rerenderEditor();
  }
  if(target.id==="editorLogoFiles"){
    pushHistory();for(const file of target.files||[])state.editorDraft.logos.push(makeEditorLogo(file.name,await readFile(file)));
    selectedLogoId="";scheduleSave();return rerenderEditor();
  }
  if(target.matches("[data-logo-tint]")){const logo=selectedLogo();if(logo){pushHistory();logo.tintColor=target.value;if(!logo.logoColor||logo.logoColor==="Según archivo")logo.logoColor=target.value;scheduleSave();rerenderEditor();}return;}
  if(target.matches("[data-logo-cm]")){const logo=selectedLogo();if(logo){pushHistory();setLogoCentimeters(logo,target.dataset.logoCm,target.value);scheduleSave();rerenderEditor();}return;}
  if(target.matches("[data-logo-field]")){ const logo=selectedLogo(); if(logo){ pushHistory(); const field=target.dataset.logoField; logo[field]=target.value; if(field==="side")editorSide=target.value; scheduleSave(); rerenderEditor(); } return; }
  if(target.matches("[data-logo-lock]")){ const logo=selectedLogo(); if(logo){ logo.locked=target.checked; scheduleSave(); } return; }
  if(target.matches("[data-inline-status],[data-proposal-status]"))return setProposalStatus(target.dataset.inlineStatus||target.dataset.proposalStatus,target.value);
  if(target.id==="proposalClientFilter" || target.id==="proposalStatusFilter")return filterProposals();
  if(target.id==="backupFileV2" && target.files[0]) return importBackup(target.files[0]);
});

document.addEventListener("input", (event) => {
  if(event.target.id==="proposalClientSearch"){
    const form=$("proposalFormV2");if(form)form.elements.clientId.value="";
    if($("proposalClientSelected"))$("proposalClientSelected").textContent="Elegí un resultado para asociar la propuesta.";
    return refreshProposalClientOptions();
  }
  if(event.target.id==="editorProductSearch")return renderEditorProductResults();
  if(event.target.id==="clientSearchV2") renderClientCards(event.target.value);
  if(event.target.id==="productSearch") renderProductCards(event.target.value);
  if(event.target.id==="proposalSearch") filterProposals();
  if(event.target.matches("[data-variant-color]")){const row=state.editorDraft.colorSizeQuantities.find((entry)=>entry.color===event.target.dataset.variantColor&&entry.size===event.target.dataset.variantSize);if(row){row.qty=Math.max(0,Math.floor(Number(event.target.value)||0));syncVariantTotals(state.editorDraft);syncEditorColorFeedback();scheduleSave();}return;}
  if(["editorPriceV2","editorNoteV2"].includes(event.target.id)){
    if(event.target.id==="editorPriceV2"){state.editorDraft.priceManual=true;qa("[data-auto-price]").forEach((node)=>{node.hidden=false;});}
    updateEditorDraftFromFields();
    if(event.target.id==="editorPriceV2"&&$("editorSubtotal"))$("editorSubtotal").textContent=money(state.editorDraft.qty*state.editorDraft.unitPrice);
    scheduleSave();
  }
  if(event.target.id==="globalSearch"){ const value=event.target.value.trim(); if(value.length>1){ go("propuestas"); $("proposalSearch").value=value; filterProposals(); } }
});
document.addEventListener("focusin",(event)=>{
  if(event.target.id==="proposalClientSearch")refreshProposalClientOptions();
  if(event.target.id==="editorProductSearch")renderEditorProductResults();
  if(event.target.matches("[data-variant-color]"))pushHistory();
});
document.addEventListener("keydown",(event)=>{
  if(event.key==="Enter"&&event.target.matches?.("[data-variant-color]")){
    event.preventDefault();const inputs=qa("[data-variant-color]"),next=inputs[inputs.indexOf(event.target)+1];
    if(next){next.focus();next.select();}return;
  }
  const results=event.target.id==="proposalClientSearch"?$("proposalClientResults"):event.target.id==="editorProductSearch"?$("editorProductResults"):null;
  if(!results)return;
  if(event.key==="Escape")results.hidden=true;
  if(event.key==="Enter"&&!results.hidden){const first=q("button",results);if(first){event.preventDefault();first.click();}}
});
function filterProposals(){
  const query=searchText($("proposalSearch")?.value).trim(),status=$("proposalStatusFilter")?.value||"",clientId=$("proposalClientFilter")?.value||"";
  const list=state.proposals.filter((item)=>{
    const hay=searchText(`${item.publicId} ${item.title} ${client(item.clientId).company} ${(item.designs||[]).map((design)=>product(design.productId).name).join(" ")}`);
    return hay.includes(query)&&(!status||item.status===status)&&(!clientId||item.clientId===clientId);
  });
  $("proposalCards").innerHTML=collectionViews.propuestas==="kanban"?proposalBoard(list):proposalRows(list);
}
async function setProposalStatus(id,status){
  const item=proposal(id);
  if(!item || !STATUS.includes(status) || !can("proposals.manage")) return;
  if(item.status===status)return;
  if(["Lista","Entregada"].includes(status) && item.designs.some((design)=>!productionProgress(design).ready)){
    if(!confirm("Hay prendas sin control de calidad aprobado. ¿Querés cambiar el estado de todos modos?")){
      qa("[data-inline-status],[data-proposal-status]").forEach((select)=>{if((select.dataset.inlineStatus||select.dataset.proposalStatus)===id)select.value=item.status;});
      return;
    }
  }
  const previous=item.status;
  const snapshot={events:clone(item.history),updatedDate:item.updatedDate,audit:clone(state.auditLog)};
  const filters={search:$("proposalSearch")?.value||"",client:$("proposalClientFilter")?.value||"",status:$("proposalStatusFilter")?.value||""};
  item.status=status;
  proposalEvent(item,"Estado actualizado",`${previous} → ${status}`);
  try{await save("Estado actualizado.");}catch(error){item.status=previous;item.history=snapshot.events;item.updatedDate=snapshot.updatedDate;state.auditLog=snapshot.audit;throw error;}
  if(currentView==="tareas")renderTasks();else if(currentView==="propuestas"){
    renderProposals();$("proposalSearch").value=filters.search;$("proposalClientFilter").value=filters.client;$("proposalStatusFilter").value=filters.status;filterProposals();
  }else renderView();
}

document.addEventListener("pointerdown", (event) => {
  if(event.target.closest("[data-delete-logo-id]"))return;
  const layer=event.target.closest(".v2-logo"); if(!layer) return;
  selectedLogoId=layer.dataset.logoId;
  const logo=selectedLogo(),stage=$("v2Stage"),rect=stage.getBoundingClientRect(),action=event.target.closest("[data-logo-action]")?.dataset.logoAction||"move";
  if(!logo)return;
  pushHistory(); pointerSession={logo,startX:event.clientX,startY:event.clientY,rect,action,base:clone(logo),moved:false}; event.preventDefault();
});
document.addEventListener("pointermove", (event) => {
  if(!pointerSession)return;
  if(Math.abs(event.clientX-pointerSession.startX)>2 || Math.abs(event.clientY-pointerSession.startY)>2)pointerSession.moved=true;
  const {logo,startX,startY,rect,action,base}=pointerSession,dx=(event.clientX-startX)/rect.width*100,dy=(event.clientY-startY)/rect.height*100;
  if(action==="move"){
    logo.x=Math.max(0,Math.min(100,base.x+dx));logo.y=Math.max(0,Math.min(100,base.y+dy));
  } else if(action==="resize"||action==="resize-x"||action==="resize-y"){
    if(action!=="resize-y")logo.width=Math.max(2,Math.min(95,base.width+dx*2));
    if(action!=="resize-x")logo.height=Math.max(2,Math.min(95,base.height+dy*2));
    if(action==="resize"&&logo.locked!==false)logo.height=logo.width*(base.height/base.width);
    const scale=garmentScale(product(state.editorDraft.productId));
    if(action!=="resize-y")logo.widthCm=scale.width?Math.round(logo.width*scale.width)/100:"";
    if(action!=="resize-x")logo.heightCm=scale.height?Math.round(logo.height*scale.height)/100:"";
  } else if(action==="rotate"){
    const cx=rect.left+rect.width*logo.x/100,cy=rect.top+rect.height*logo.y/100;
    logo.rotation=Math.round(Math.atan2(event.clientY-cy,event.clientX-cx)*180/Math.PI+90);
  }
  const node=q(`[data-logo-id="${logo.id}"]`);
  if(node) node.style.cssText=`left:${logo.x}%;top:${logo.y}%;width:${logo.width}%;height:${logo.height}%;transform:translate(-50%,-50%) rotate(${logo.rotation}deg)`;
});
document.addEventListener("pointerup",()=>{if(pointerSession){suppressStageClick=pointerSession.moved;pointerSession=null;scheduleSave();setTimeout(()=>{suppressStageClick=false;rerenderEditor();},0);}});

async function exportBackup(){
  try{
    clearTimeout(saveTimer);await save();
    const result=await api("export_design_snapshots");
    if(result.missing?.length)throw new Error(`No se puede crear un respaldo completo: faltan ${result.missing.length} versión(es) aprobada(s) en el panel.`);
    const payload={app:"UNIFORMA Panel Integral",version:3,exportedAt:new Date().toISOString(),state,snapshots:result.snapshots||{}};
    const blob=new Blob([JSON.stringify(payload)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`uniforma-backup-${today()}.json`;link.click();URL.revokeObjectURL(url);
    toast("Respaldo completo descargado.");
  }catch(error){toast(error.message);}
}
async function importBackup(file){
  try{
    const parsed=JSON.parse(await file.text());if(!parsed.state&&!parsed.proposals)throw new Error("Backup inválido");
    const snapshots=parsed.snapshots&&typeof parsed.snapshots==="object"?parsed.snapshots:{};
    for(const [snapshotId,snapshot] of Object.entries(snapshots))await api("restore_design_snapshot",{snapshotId,snapshot});
    clearTimeout(saveTimer);await api("restore_backup_state",{state:parsed.state||parsed});
    renderView();toast("Backup importado correctamente.");
  }catch(error){toast(error.message);}
}

async function boot(){ const response=await fetch("api.php");const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch(error){throw new Error(`Respuesta inválida del servidor al iniciar (HTTP ${response.status})`);}if(!data||!data.ok)throw new Error(data?.error||"No se pudo iniciar");state=data.state;currentUser=data.user;permissions=data.permissions||[];roles=data.roles||{};users=data.users||[];window.UNIFORMA_BOOT.csrf=data.csrf||window.UNIFORMA_BOOT.csrf;normalize();lastSavedState=clone(state);shell();renderView(); }
boot().catch((error)=>{console.error(error);const toastElement=$("toast");if(toastElement){toastElement.textContent="No se pudo iniciar el panel.";toastElement.classList.add("show");}});
