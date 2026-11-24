const iconSvg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const icons = {
  home: iconSvg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
  users: iconSvg('<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  "user-plus": iconSvg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>'),
  shirt: iconSvg('<path d="M20.4 7.5 16 4a4 4 0 0 1-8 0L3.6 7.5 6 12v8h12v-8l2.4-4.5Z"/>'),
  file: iconSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>'),
  image: iconSvg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-4.5-4.5L6 19"/>'),
  settings: iconSvg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.87-.34l.06-.06A2 2 0 1 1 19.74 6.1l-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>'),
  search: iconSvg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  bell: iconSvg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  chart: iconSvg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/><path d="M18 7h1v1"/>'),
  shield: iconSvg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-5"/>'),
  check: iconSvg('<path d="M20 6 9 17l-5-5"/><path d="M21 12a9 9 0 1 1-5.3-8.2"/>'),
};

let state = null;
let currentUser = null;
let permissions = [];
let allPermissions = [];
let roles = {};
let users = [];
let activeView = "dashboard";
let editingClientId = "";
let editingProductId = "";
let editingTaskId = "";
let editingUserId = "";
let dragging = false;
let activeTaskFilter = "Todas";

const statusColors = {
  Borrador: "#e8d3ba",
  Enviada: "#8eb2d8",
  Aprobada: "#9dad78",
  Rechazada: "#d89489",
  "En produccion": "#d39b4a",
};

const viewPermissions = {
  dashboard: "dashboard.view",
  clientes: "clients.view",
  tareas: "tasks.view",
  catalogo: "catalog.view",
  propuestas: "proposals.view",
  editor: "editor.use",
  reportes: "reports.view",
  usuarios: "users.manage",
  configuracion: "settings.manage",
};

const permissionLabels = {
  "dashboard.view": "Dashboard",
  "clients.view": "Ver clientes",
  "clients.manage": "Gestionar clientes",
  "tasks.view": "Ver tareas",
  "tasks.manage": "Gestionar tareas",
  "catalog.view": "Ver catalogo",
  "catalog.manage": "Editar catalogo",
  "proposals.view": "Ver propuestas",
  "proposals.manage": "Gestionar propuestas",
  "editor.use": "Usar editor",
  "reports.view": "Ver reportes",
  "settings.manage": "Configuracion",
  "users.manage": "Usuarios",
};

const $ = (id) => document.getElementById(id);

const els = {
  toast: $("toast"),
  profileName: $("profileName"),
  profileRole: $("profileRole"),
  avatarInitials: $("avatarInitials"),
  welcomeName: $("welcomeName"),
  todayLabel: $("todayLabel"),
  recentProposals: $("recentProposals"),
  statusLegend: $("statusLegend"),
  statusDonut: $("statusDonut"),
  donutTotal: $("donutTotal"),
  metricMonth: $("metricMonth"),
  metricPending: $("metricPending"),
  metricClients: $("metricClients"),
  metricApproved: $("metricApproved"),
  metricOverdue: $("metricOverdue"),
  notificationCount: $("notificationCount"),
  clientList: $("clientList"),
  clientForm: $("clientForm"),
  clientCount: $("clientCount"),
  clientSearch: $("clientSearch"),
  taskFilters: $("taskFilters"),
  taskList: $("taskList"),
  taskForm: $("taskForm"),
  taskCount: $("taskCount"),
  taskFormTitle: $("taskFormTitle"),
  taskClient: $("taskClient"),
  taskProposal: $("taskProposal"),
  catalogGrid: $("catalogGrid"),
  catalogFilters: $("catalogFilters"),
  productForm: $("productForm"),
  productFormTitle: $("productFormTitle"),
  productFrontPreview: $("productFrontPreview"),
  productBackPreview: $("productBackPreview"),
  proposalList: $("proposalList"),
  proposalDetail: $("proposalDetail"),
  proposalBoard: $("proposalBoard"),
  editorClient: $("editorClient"),
  editorProduct: $("editorProduct"),
  editorMethod: $("editorMethod"),
  editorColor: $("editorColor"),
  logoInput: $("logoInput"),
  quantityInput: $("quantityInput"),
  notesInput: $("notesInput"),
  garmentImage: $("garmentImage"),
  logoLayer: $("logoLayer"),
  logoImage: $("logoImage"),
  stageMeta: $("stageMeta"),
  scaleRange: $("scaleRange"),
  rotationRange: $("rotationRange"),
  reportMetrics: $("reportMetrics"),
  productPerformance: $("productPerformance"),
  sectorPerformance: $("sectorPerformance"),
  deliveryReport: $("deliveryReport"),
  auditList: $("auditList"),
  userList: $("userList"),
  userCount: $("userCount"),
  userForm: $("userForm"),
  userFormTitle: $("userFormTitle"),
  userRoleSelect: $("userRoleSelect"),
  userPermissionList: $("userPermissionList"),
  permissionPreview: $("permissionPreview"),
  settingWhatsapp: $("settingWhatsapp"),
  settingCompanyName: $("settingCompanyName"),
  settingCurrency: $("settingCurrency"),
  settingQuotePrefix: $("settingQuotePrefix"),
  settingAccent: $("settingAccent"),
  settingAccentDark: $("settingAccentDark"),
  settingSidebar: $("settingSidebar"),
  settingDensity: $("settingDensity"),
  settingMargin: $("settingMargin"),
  settingTax: $("settingTax"),
  settingValidity: $("settingValidity"),
  settingProduction: $("settingProduction"),
  exportBackupBtn: $("exportBackupBtn"),
  backupInput: $("backupInput"),
};

function renderIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const name = node.dataset.icon;
    if (icons[name] && node.innerHTML.trim() === "") node.innerHTML = icons[name];
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageTag(src, alt = "") {
  if (!src) return '<span class="image-fallback">Sin imagen</span>';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" onerror="this.parentElement.classList.add('image-missing');this.remove();" /><span class="image-fallback">Sin imagen</span>`;
}

function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function initials(name) {
  return String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function can(permission) {
  return !permission || permissions.includes(permission);
}

function money(value) {
  const rawCurrency = String(state?.settings?.currency || "ARS").trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "ARS";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function taskIsOpen(task) {
  return task.status !== "Hecha";
}

function taskIsOverdue(task) {
  return taskIsOpen(task) && task.dueDate && task.dueDate < todayIso();
}

function taskIsDueToday(task) {
  return taskIsOpen(task) && task.dueDate === todayIso();
}

function openTasks() {
  return (state.tasks || []).filter(taskIsOpen);
}

function alertCount() {
  const tasks = state.tasks || [];
  const taskAlerts = tasks.filter((task) => taskIsOverdue(task) || taskIsDueToday(task)).length;
  const staleProposals = state.proposals.filter((proposal) => ["Borrador", "Enviada"].includes(proposal.status) && Date.now() - new Date(`${proposal.updatedDate}T12:00:00`).getTime() > 7 * 86400000).length;
  return taskAlerts + staleProposals;
}

function productById(id) {
  return state.products.find((item) => item.id === id) || state.products[0] || {
    id: "",
    name: "Producto",
    image: "",
    imageBack: "",
    category: "",
    sizes: "",
    material: "",
    basePrice: 0,
  };
}

function clientById(id) {
  return state.clients.find((item) => item.id === id) || state.clients[0] || {
    id: "",
    company: "Cliente",
    contact: "",
    phone: "",
    email: "",
    address: "",
    sector: "",
    source: "",
    priority: "Media",
    notes: "",
  };
}

function taskById(id) {
  return (state.tasks || []).find((item) => item.id === id) || null;
}

function activeProposal() {
  return state.proposals.find((item) => item.id === state.activeProposalId) || state.proposals[0] || null;
}

function quoteSettings() {
  return state.settings || {};
}

function proposalTotal(proposal) {
  const settings = quoteSettings();
  const margin = Number(settings.defaultMargin || 0) / 100;
  const tax = Number(settings.taxRate || 0) / 100;
  return (proposal?.designs || []).reduce((total, design) => {
    const product = productById(design.productId);
    const extra = design.method === "Bordado" ? 1400 : 900;
    const unit = (Number(product.basePrice || 0) + extra) * (1 + margin);
    return total + unit * Number(design.qty || 1) * (1 + tax);
  }, 0);
}

function statusClass(status) {
  return `status-${slugify(status)}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2400);
}

function syncPayload(data) {
  state = data.state || state;
  currentUser = data.user || currentUser;
  permissions = data.permissions || permissions || [];
  roles = data.roles || roles || {};
  allPermissions = data.allPermissions || allPermissions || Object.keys(permissionLabels);
  users = data.users || users || [];
}

async function apiAction(action, payload = {}) {
  const res = await fetch("api.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": window.UNIFORMA_BOOT.csrf,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "No se pudo guardar");
  if (data.csrf) window.UNIFORMA_BOOT.csrf = data.csrf;
  syncPayload(data);
  return data;
}

async function saveAndRender(message) {
  await apiAction("save_state", { state });
  renderAll();
  if (message) showToast(message);
}

function allowedView(view) {
  return can(viewPermissions[view]);
}

function firstAllowedView() {
  return Object.keys(viewPermissions).find((view) => allowedView(view)) || "dashboard";
}

function showView(view) {
  if (!allowedView(view)) {
    showToast("No tenes permisos para abrir esa seccion.");
    view = firstAllowedView();
  }
  activeView = view;
  document.querySelectorAll(".view").forEach((node) => node.classList.remove("active"));
  const target = document.querySelector(`#view-${view}`);
  if (target) target.classList.add("active");
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
}

function applyTheme() {
  const theme = state.settings?.theme || {};
  const root = document.documentElement;
  root.style.setProperty("--gold", theme.accent || "#b7792a");
  root.style.setProperty("--gold-2", theme.accentDark || "#965f1c");
  root.style.setProperty("--brown", theme.sidebar || "#24180f");
  document.body.classList.toggle("density-compact", theme.density === "compact");
}

function applyPermissions() {
  document.querySelectorAll("[data-permission]").forEach((node) => {
    node.hidden = !can(node.dataset.permission);
  });

  document.querySelectorAll(".permission-manage-catalog").forEach((node) => {
    node.hidden = !can("catalog.manage");
  });

  if (els.clientForm) els.clientForm.hidden = !can("clients.manage");
  if (els.taskForm) els.taskForm.hidden = !can("tasks.manage");
  if ($("saveDesignBtn")) $("saveDesignBtn").hidden = !can("editor.use");
  document.querySelectorAll('[data-action="new-proposal"]').forEach((node) => {
    node.hidden = !can("proposals.manage");
  });

  if (!allowedView(activeView)) showView(firstAllowedView());
}

function renderTop() {
  const name = currentUser?.name || "UNIFORMA";
  const role = roles[currentUser?.role]?.label || currentUser?.role || "Equipo";
  els.profileName.textContent = name;
  els.profileRole.textContent = role;
  els.avatarInitials.textContent = initials(name);
  els.welcomeName.textContent = name.split(" ")[0] || "equipo";
  els.todayLabel.textContent = new Date().toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const alerts = alertCount();
  els.notificationCount.textContent = alerts;
  els.notificationCount.hidden = alerts === 0;
}

function renderDashboard() {
  const pending = state.proposals.filter((p) => ["Borrador", "Enviada"].includes(p.status)).length;
  const approved = state.proposals.filter((p) => p.status === "Aprobada").length;
  const overdue = (state.tasks || []).filter(taskIsOverdue).length;
  els.metricMonth.textContent = state.proposals.length;
  els.metricPending.textContent = pending;
  els.metricClients.textContent = state.clients.length;
  els.metricApproved.textContent = approved;
  els.metricOverdue.textContent = overdue;

  els.recentProposals.innerHTML = [...state.proposals]
    .sort((a, b) => String(b.updatedDate).localeCompare(String(a.updatedDate)))
    .slice(0, 5)
    .map((proposal) => {
      const client = clientById(proposal.clientId);
      const first = proposal.designs?.[0];
      const product = first ? productById(first.productId) : state.products[0];
      const total = proposalTotal(proposal);
      return `
        <div class="recent-row">
          <div class="recent-thumb">${imageTag(product?.image || "", product?.name || "")}</div>
          <div><strong>${escapeHtml(client.company)}</strong><br /><small>Propuesta ${escapeHtml(proposal.publicId)}</small></div>
          <span class="status-pill ${statusClass(proposal.status)}">${escapeHtml(proposal.status)}</span>
          <div><strong>${total ? money(total) : "-"}</strong><br /><small>${escapeHtml(formatDate(proposal.updatedDate))}</small></div>
        </div>
      `;
    })
    .join("");

  const total = Math.max(1, state.proposals.length);
  let start = 0;
  const gradients = Object.entries(statusColors).map(([status, color]) => {
    const count = state.proposals.filter((p) => p.status === status).length;
    const end = start + (count / total) * 100;
    const part = `${color} ${start}% ${end}%`;
    start = end;
    return part;
  });
  els.statusDonut.style.background = `conic-gradient(${gradients.join(",")})`;
  els.donutTotal.textContent = state.proposals.length;
  els.statusLegend.innerHTML = Object.entries(statusColors)
    .map(([status, color]) => {
      const count = state.proposals.filter((p) => p.status === status).length;
      const pct = Math.round((count / total) * 100);
      return `<div class="legend-row"><span class="legend-dot" style="background:${color}"></span><span>${status}</span><strong>${count} (${pct}%)</strong></div>`;
    })
    .join("");
}

function renderClients() {
  const query = (els.clientSearch.value || "").toLowerCase().trim();
  const clients = state.clients.filter((client) => `${client.company} ${client.contact} ${client.sector}`.toLowerCase().includes(query));
  els.clientCount.textContent = `${clients.length} clientes`;
  els.clientList.innerHTML = clients.length
    ? clients
        .map((client) => `
          <article class="client-card">
            <div class="client-avatar">${initials(client.company)}</div>
            <div>
              <strong>${escapeHtml(client.company)}</strong>
              <div class="meta"><span>${escapeHtml(client.contact)}</span><span>${escapeHtml(client.sector)}</span><span>${escapeHtml(client.phone)}</span><span>${escapeHtml(client.priority || "Media")}</span><span>${escapeHtml(client.source || "Sin origen")}</span></div>
              ${client.notes ? `<p class="compact-note">${escapeHtml(client.notes)}</p>` : ""}
            </div>
            <div class="button-row">
              ${can("proposals.manage") ? `<button type="button" data-client-proposal="${client.id}">Propuesta</button>` : ""}
              ${can("tasks.manage") ? `<button type="button" data-client-task="${client.id}">Tarea</button>` : ""}
              ${can("clients.manage") ? `<button type="button" data-edit-client="${client.id}">Editar</button>` : ""}
              ${can("clients.manage") ? `<button class="danger-button" type="button" data-delete-client="${client.id}">Borrar</button>` : ""}
            </div>
          </article>
        `)
        .join("")
    : `<div class="empty-state">No hay clientes para mostrar.</div>`;

  if (!can("clients.manage")) return;

  if (editingClientId) {
    const client = clientById(editingClientId);
    els.clientForm.elements.company.value = client.company;
    els.clientForm.elements.contact.value = client.contact;
    els.clientForm.elements.phone.value = client.phone;
    els.clientForm.elements.email.value = client.email || "";
    els.clientForm.elements.address.value = client.address || "";
    els.clientForm.elements.sector.value = client.sector;
    els.clientForm.elements.source.value = client.source || "WhatsApp";
    els.clientForm.elements.priority.value = client.priority || "Media";
    els.clientForm.elements.notes.value = client.notes || "";
    $("clientFormTitle").textContent = "Editar cliente";
  } else {
    $("clientFormTitle").textContent = "Nuevo cliente";
  }
}

function renderTasks() {
  if (!can("tasks.view")) return;
  const filters = ["Todas", "Pendiente", "En curso", "Hecha", "Vencidas"];
  els.taskFilters.innerHTML = filters
    .map((filter) => `<button class="${filter === activeTaskFilter ? "active" : ""}" type="button" data-task-filter="${filter}">${filter}</button>`)
    .join("");

  els.taskClient.innerHTML = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.company)}</option>`).join("");
  els.taskProposal.innerHTML = [`<option value="">Sin propuesta</option>`, ...state.proposals.map((proposal) => `<option value="${proposal.id}">${escapeHtml(proposal.publicId)} · ${escapeHtml(clientById(proposal.clientId).company)}</option>`)].join("");

  let tasks = [...(state.tasks || [])];
  if (activeTaskFilter === "Vencidas") tasks = tasks.filter(taskIsOverdue);
  else if (activeTaskFilter !== "Todas") tasks = tasks.filter((task) => task.status === activeTaskFilter);
  tasks.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  els.taskCount.textContent = `${tasks.length} tareas`;

  els.taskList.innerHTML = tasks.length
    ? tasks
        .map((task) => {
          const client = clientById(task.clientId);
          const proposal = state.proposals.find((item) => item.id === task.proposalId);
          const dueClass = taskIsOverdue(task) ? "danger" : taskIsDueToday(task) ? "warn" : "";
          return `
            <article class="task-card ${task.status === "Hecha" ? "done" : ""}">
              <div>
                <strong>${escapeHtml(task.title)}</strong>
                <div class="meta"><span>${escapeHtml(client.company)}</span><span>${proposal ? escapeHtml(proposal.publicId) : "Sin propuesta"}</span><span class="${dueClass}">${formatDate(task.dueDate)}</span><span>${escapeHtml(task.priority)}</span></div>
                ${task.note ? `<p class="compact-note">${escapeHtml(task.note)}</p>` : ""}
              </div>
              <span class="status-pill ${statusClass(task.status)}">${escapeHtml(task.status)}</span>
              <div class="button-row">
                ${can("tasks.manage") ? `<button type="button" data-edit-task="${task.id}">Editar</button>` : ""}
                ${can("tasks.manage") && task.status !== "Hecha" ? `<button type="button" data-complete-task="${task.id}">Hecha</button>` : ""}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">No hay tareas para este filtro.</div>`;

  if (!can("tasks.manage")) return;

  if (editingTaskId) {
    const task = taskById(editingTaskId);
    if (task) {
      els.taskFormTitle.textContent = "Editar tarea";
      els.taskForm.elements.title.value = task.title || "";
      els.taskForm.elements.clientId.value = task.clientId || state.clients[0]?.id || "";
      els.taskForm.elements.proposalId.value = task.proposalId || "";
      els.taskForm.elements.dueDate.value = task.dueDate || todayIso();
      els.taskForm.elements.priority.value = task.priority || "Media";
      els.taskForm.elements.status.value = task.status || "Pendiente";
      els.taskForm.elements.note.value = task.note || "";
    }
  } else {
    els.taskFormTitle.textContent = "Nueva tarea";
    if (!els.taskForm.elements.dueDate.value) {
      els.taskForm.elements.dueDate.value = todayIso();
    }
  }
}

function renderCatalog() {
  const categories = ["Todos", ...new Set(state.products.map((p) => p.category))];
  const active = state.catalogFilter || "Todos";
  els.catalogFilters.innerHTML = categories.map((cat) => `<button class="${cat === active ? "active" : ""}" type="button" data-filter="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("");
  const products = active === "Todos" ? state.products : state.products.filter((p) => p.category === active);
  els.catalogGrid.innerHTML = products
    .map((product) => `
      <article class="product-card">
        <div class="product-thumb">${imageTag(product.image, product.name)}</div>
        <div><strong>${escapeHtml(product.name)}</strong><div class="meta"><span>${escapeHtml(product.category)}</span><span>${escapeHtml(product.sizes)}</span><span>${money(product.basePrice)}</span></div></div>
        <div class="button-row">
          ${can("editor.use") ? `<button type="button" data-use-product="${product.id}">Usar</button>` : ""}
          ${can("catalog.manage") ? `<button type="button" data-edit-product="${product.id}">Editar</button>` : ""}
          ${can("catalog.manage") ? `<button class="danger-button" type="button" data-delete-product="${product.id}">Borrar</button>` : ""}
        </div>
      </article>
    `)
    .join("");

  if (!can("catalog.manage")) return;

  if (editingProductId) {
    const product = productById(editingProductId);
    els.productFormTitle.textContent = "Editar prenda";
    els.productForm.elements.name.value = product.name || "";
    els.productForm.elements.category.value = product.category || "";
    els.productForm.elements.sizes.value = product.sizes || "";
    els.productForm.elements.material.value = product.material || "";
    els.productForm.elements.basePrice.value = product.basePrice || 0;
    els.productFrontPreview.innerHTML = imageTag(product.image, `${product.name} frente`);
    els.productBackPreview.innerHTML = imageTag(product.imageBack || product.image, `${product.name} espalda`);
  } else {
    els.productFormTitle.textContent = "Nueva prenda";
    els.productFrontPreview.innerHTML = '<span class="image-fallback">Sin imagen frente</span>';
    els.productBackPreview.innerHTML = '<span class="image-fallback">Sin imagen espalda</span>';
  }
}

function renderProposals() {
  els.proposalList.innerHTML = state.proposals.length
    ? state.proposals
        .map((proposal) => {
          const client = clientById(proposal.clientId);
          return `
            <article class="proposal-card ${proposal.id === state.activeProposalId ? "active" : ""}">
              <strong>${escapeHtml(client.company)}</strong>
              <span>${escapeHtml(proposal.publicId)} · ${formatDate(proposal.updatedDate)}</span>
              <div class="meta"><span class="status-pill ${statusClass(proposal.status)}">${escapeHtml(proposal.status)}</span><span>${money(proposalTotal(proposal))}</span></div>
              <button type="button" data-open-proposal="${proposal.id}">Abrir</button>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">Todavia no hay propuestas.</div>`;
  renderProposalDetail();
  renderProposalBoard();
}

function renderProposalDetail() {
  const proposal = activeProposal();
  if (!proposal) {
    els.proposalDetail.innerHTML = `<div class="empty-state">Selecciona una propuesta para ver el detalle.</div>`;
    return;
  }
  const client = clientById(proposal.clientId);
  const designs = proposal.designs || [];
  const statusButtons = ["Borrador", "Enviada", "Aprobada", "Rechazada", "En produccion"]
    .map((status) => `<button type="button" ${can("proposals.manage") ? `data-set-status="${status}"` : "disabled"}>${status}</button>`)
    .join("");
  els.proposalDetail.innerHTML = `
    <div class="section-row"><h2>${escapeHtml(client.company)}</h2><span class="status-pill ${statusClass(proposal.status)}">${escapeHtml(proposal.status)}</span></div>
    <p>${escapeHtml(client.contact)} · ${escapeHtml(client.phone)}</p>
    <p><strong>Total estimado:</strong> ${money(proposalTotal(proposal))}</p>
    <p><strong>Entrega estimada:</strong> ${formatDate(proposal.deliveryDate)}</p>
    <div class="button-row">${statusButtons}<button type="button" data-print-proposal="${proposal.id}">Imprimir / PDF</button></div>
    <h2 style="margin-top:22px">Vistas guardadas</h2>
    ${designs.length ? designs.map((design) => `<p>${escapeHtml(productById(design.productId).name)} · ${escapeHtml(design.method)} · ${design.qty} unidades</p>`).join("") : "<p>Sin vistas guardadas.</p>"}
  `;
}

function renderProposalBoard() {
  if (!els.proposalBoard) return;
  const statuses = ["Borrador", "Enviada", "Aprobada", "Rechazada", "En produccion"];
  els.proposalBoard.innerHTML = statuses
    .map((status) => {
      const proposals = state.proposals.filter((proposal) => proposal.status === status);
      return `
        <section class="pipeline-column">
          <div class="pipeline-head"><strong>${status}</strong><span>${proposals.length}</span></div>
          ${proposals.length ? proposals.map((proposal) => {
            const client = clientById(proposal.clientId);
            return `<button type="button" class="pipeline-item" data-open-proposal="${proposal.id}"><strong>${escapeHtml(client.company)}</strong><span>${escapeHtml(proposal.publicId)} · ${money(proposalTotal(proposal))}</span></button>`;
          }).join("") : `<div class="pipeline-empty">Sin propuestas</div>`}
        </section>
      `;
    })
    .join("");
}

function renderEditor() {
  els.editorClient.innerHTML = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.company)}</option>`).join("");
  els.editorProduct.innerHTML = state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join("");
  els.editorClient.value = state.editor.clientId;
  els.editorProduct.value = state.editor.productId;
  els.editorMethod.value = state.editor.method;
  els.editorColor.value = state.editor.color;
  els.quantityInput.value = state.editor.qty;
  els.notesInput.value = state.editor.notes;
  els.scaleRange.value = state.editor.logo.scale;
  els.rotationRange.value = state.editor.logo.rotation;
  updateStage();
}

function updateStage() {
  const product = productById(state.editor.productId);
  els.garmentImage.src = state.editor.face === "Espalda" ? (product.imageBack || product.image) : product.image;
  els.stageMeta.textContent = `${product.name} · ${state.editor.method} · ${state.editor.color}`;
  if (state.editor.logoData) {
    els.logoImage.src = state.editor.logoData;
    els.logoLayer.classList.add("has-image");
  } else {
    els.logoLayer.classList.remove("has-image");
  }
  const logo = state.editor.logo;
  els.logoLayer.style.left = `${logo.x}%`;
  els.logoLayer.style.top = `${logo.y}%`;
  els.logoLayer.style.transform = `translate(-50%, -50%) rotate(${logo.rotation}deg) scale(${logo.scale})`;
  document.querySelectorAll("[data-face]").forEach((button) => button.classList.toggle("active", button.dataset.face === state.editor.face));
}

function groupTotals(items, keyGetter, valueGetter) {
  return items.reduce((acc, item) => {
    const key = keyGetter(item) || "Sin dato";
    const current = acc.get(key) || { count: 0, value: 0 };
    current.count += 1;
    current.value += valueGetter(item);
    acc.set(key, current);
    return acc;
  }, new Map());
}

function renderReportTable(container, rows, empty = "Sin datos suficientes.") {
  container.innerHTML = rows.length
    ? rows.map((row) => `<div class="table-row"><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong><em>${money(row.value)}</em></div>`).join("")
    : `<div class="empty-state">${empty}</div>`;
}

function renderReports() {
  const totalValue = state.proposals.reduce((sum, proposal) => sum + proposalTotal(proposal), 0);
  const approved = state.proposals.filter((proposal) => proposal.status === "Aprobada");
  const closed = state.proposals.filter((proposal) => ["Aprobada", "Rechazada"].includes(proposal.status));
  const conversion = closed.length ? Math.round((approved.length / closed.length) * 100) : 0;
  const avgTicket = state.proposals.length ? totalValue / state.proposals.length : 0;
  const stale = state.proposals.filter((proposal) => ["Borrador", "Enviada"].includes(proposal.status) && Date.now() - new Date(`${proposal.updatedDate}T12:00:00`).getTime() > 7 * 86400000).length;
  const overdueTasks = (state.tasks || []).filter(taskIsOverdue).length;

  els.reportMetrics.innerHTML = [
    ["Valor potencial", money(totalValue), "Todas las propuestas"],
    ["Ticket promedio", money(avgTicket), "Estimado con margen e impuesto"],
    ["Conversion", `${conversion}%`, "Aprobadas sobre cerradas"],
    ["Seguimientos", stale, "Propuestas con mas de 7 dias"],
    ["Tareas vencidas", overdueTasks, "Pendientes fuera de fecha"],
  ]
    .map(([label, value, hint]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`)
    .join("");

  const productMap = groupTotals(
    state.proposals.flatMap((proposal) => (proposal.designs || []).map((design) => ({ proposal, design }))),
    ({ design }) => productById(design.productId).name,
    ({ proposal }) => proposalTotal(proposal),
  );
  const productRows = [...productMap.entries()].map(([label, data]) => ({ label, ...data })).sort((a, b) => b.value - a.value);
  renderReportTable(els.productPerformance, productRows);

  const sectorMap = groupTotals(
    state.proposals,
    (proposal) => clientById(proposal.clientId).sector,
    (proposal) => proposalTotal(proposal),
  );
  const sectorRows = [...sectorMap.entries()].map(([label, data]) => ({ label, ...data })).sort((a, b) => b.value - a.value);
  renderReportTable(els.sectorPerformance, sectorRows);

  const deliveries = [...state.proposals]
    .filter((proposal) => proposal.deliveryDate && proposal.status !== "Rechazada")
    .sort((a, b) => String(a.deliveryDate).localeCompare(String(b.deliveryDate)))
    .slice(0, 8)
    .map((proposal) => {
      const client = clientById(proposal.clientId);
      return `<div class="table-row"><span>${escapeHtml(client.company)}</span><strong>${formatDate(proposal.deliveryDate)}</strong><em>${escapeHtml(proposal.status)}</em></div>`;
    });
  els.deliveryReport.innerHTML = deliveries.length ? deliveries.join("") : `<div class="empty-state">No hay entregas programadas.</div>`;

  els.auditList.innerHTML = (state.auditLog || [])
    .slice(0, 12)
    .map((entry) => `<div class="audit-row"><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(entry.userName)} · ${formatDateTime(entry.at)}</span><small>${escapeHtml(entry.detail || "")}</small></div>`)
    .join("");
}

function renderSettings() {
  const settings = state.settings || {};
  const theme = settings.theme || {};
  els.settingWhatsapp.value = settings.whatsapp || "";
  els.settingCompanyName.value = settings.companyName || "UNIFORMA";
  els.settingCurrency.value = settings.currency || "ARS";
  els.settingQuotePrefix.value = settings.quotePrefix || "#2026";
  els.settingAccent.value = theme.accent || "#b7792a";
  els.settingAccentDark.value = theme.accentDark || "#965f1c";
  els.settingSidebar.value = theme.sidebar || "#24180f";
  els.settingDensity.value = theme.density || "comfortable";
  els.settingMargin.value = settings.defaultMargin ?? 35;
  els.settingTax.value = settings.taxRate ?? 21;
  els.settingValidity.value = settings.validityDays ?? 7;
  els.settingProduction.value = settings.productionDays ?? 14;
}

function renderUsers() {
  if (!can("users.manage")) return;
  els.userCount.textContent = `${users.length} usuarios`;
  els.userRoleSelect.innerHTML = Object.entries(roles)
    .map(([id, role]) => `<option value="${id}">${escapeHtml(role.label || id)}</option>`)
    .join("");

  els.userList.innerHTML = users
    .map((user) => `
      <article class="user-card">
        <div class="client-avatar">${initials(user.name)}</div>
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <div class="meta"><span>${escapeHtml(user.username)}</span><span>${escapeHtml(roles[user.role]?.label || user.role)}</span><span>${user.active ? "Activo" : "Inactivo"}</span></div>
        </div>
        <button type="button" data-edit-user="${user.id}">Editar</button>
      </article>
    `)
    .join("");

  if (editingUserId) {
    const user = users.find((item) => item.id === editingUserId);
    if (user) {
      els.userFormTitle.textContent = "Editar usuario";
      els.userForm.elements.name.value = user.name || "";
      els.userForm.elements.username.value = user.username || "";
      els.userForm.elements.email.value = user.email || "";
      els.userForm.elements.role.value = user.role || "lectura";
      els.userForm.elements.active.checked = Boolean(user.active);
    }
  } else {
    els.userFormTitle.textContent = "Nuevo usuario";
  }
  renderPermissionCheckboxes();
  renderPermissionPreview();
}

function rolePermissionList(roleId) {
  const role = roles[roleId] || {};
  const rolePermissions = role.permissions || [];
  return rolePermissions.includes("all") ? [...allPermissions] : rolePermissions;
}

function currentFormPermissions() {
  const checked = [...els.userPermissionList.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  return checked.length || els.userPermissionList.children.length ? checked : rolePermissionList(els.userRoleSelect.value);
}

function renderPermissionCheckboxes(forceRoleDefaults = false) {
  if (!can("users.manage")) return;
  const editingUser = users.find((item) => item.id === editingUserId);
  const selected = forceRoleDefaults
    ? rolePermissionList(els.userRoleSelect.value)
    : editingUser && editingUser.role === els.userRoleSelect.value && Array.isArray(editingUser.permissionsOverride) && editingUser.permissionsOverride.length
      ? editingUser.permissionsOverride
      : rolePermissionList(els.userRoleSelect.value);
  els.userPermissionList.innerHTML = allPermissions
    .map((permission) => `
      <label class="check-row permission-check">
        <input type="checkbox" value="${escapeHtml(permission)}" ${selected.includes(permission) ? "checked" : ""} />
        ${escapeHtml(permissionLabels[permission] || permission)}
      </label>
    `)
    .join("");
}

function renderPermissionPreview() {
  if (!can("users.manage")) return;
  const labels = currentFormPermissions().map((permission) => permissionLabels[permission] || permission);
  els.permissionPreview.innerHTML = labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("");
}

function renderAll() {
  applyTheme();
  applyPermissions();
  renderTop();
  renderDashboard();
  renderClients();
  renderTasks();
  renderCatalog();
  renderProposals();
  renderEditor();
  renderReports();
  renderSettings();
  renderUsers();
  renderIcons();
}

function ensureProposalForClient(clientId) {
  if (!clientId) return null;
  const existing = state.proposals.find((p) => p.clientId === clientId && p.status === "Borrador");
  if (existing) return existing;
  const productionDays = Number(state.settings?.productionDays || 14);
  const prefix = state.settings?.quotePrefix || "#2026";
  const next = {
    id: `prop-${Date.now()}`,
    publicId: `${prefix}-${String(state.proposals.length + 1).padStart(3, "0")}`,
    clientId,
    status: "Borrador",
    ownerId: currentUser?.id || "",
    updatedDate: new Date().toISOString().slice(0, 10),
    deliveryDate: new Date(Date.now() + productionDays * 86400000).toISOString().slice(0, 10),
    designs: [],
  };
  state.proposals.unshift(next);
  return next;
}

function createTaskDraft(clientId = "", proposalId = "") {
  const client = clientId || state.clients[0]?.id || "";
  const task = {
    id: `task-${Date.now()}`,
    title: "Nuevo seguimiento",
    clientId: client,
    proposalId,
    dueDate: todayIso(),
    status: "Pendiente",
    priority: "Media",
    ownerId: currentUser?.id || "",
    note: "",
    createdAt: new Date().toISOString(),
  };
  state.tasks = state.tasks || [];
  state.tasks.unshift(task);
  editingTaskId = task.id;
  return task;
}

function proposalPrintHtml(proposal) {
  const client = clientById(proposal.clientId);
  const designs = proposal.designs || [];
  const logoUrl = new URL("assets/brand/uniforma-logo-print.jpg", window.location.href).href;
  const rows = designs.length
    ? designs.map((design) => {
        const product = productById(design.productId);
        const unit = proposalTotal({ ...proposal, designs: [design] }) / Math.max(1, Number(design.qty || 1));
        return `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(design.method)}</td><td>${escapeHtml(design.color)}</td><td>${design.qty}</td><td>${money(unit)}</td><td>${money(unit * Number(design.qty || 1))}</td></tr>`;
      }).join("")
    : `<tr><td colspan="6">Sin vistas guardadas.</td></tr>`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(proposal.publicId)} - ${escapeHtml(client.company)}</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;margin:0;color:#211b16;background:#fff}
    main{max-width:880px;margin:0 auto;padding:42px}
    header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #b7792a;padding-bottom:22px;margin-bottom:26px}
    h1{margin:0;font-size:30px}.print-logo{width:230px;height:auto}.muted{color:#6e6259}
    table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #e8d9ca;padding:12px;text-align:left}th{color:#965f1c;text-transform:uppercase;font-size:12px}
    .total{margin-top:28px;text-align:right;font-size:24px;font-weight:800}.box{border:1px solid #e8d9ca;border-radius:8px;padding:16px;margin-top:18px}
    @media print{button{display:none}main{padding:24px}}
  </style>
</head>
<body>
  <main>
    <button onclick="window.print()">Imprimir / guardar PDF</button>
    <header>
      <div><img class="print-logo" src="${escapeHtml(logoUrl)}" alt="UNIFORMA" /><p class="muted">Propuesta comercial</p></div>
      <div><h1>${escapeHtml(proposal.publicId)}</h1><p class="muted">${formatDate(proposal.updatedDate)}</p></div>
    </header>
    <section class="box">
      <strong>${escapeHtml(client.company)}</strong><br />
      <span class="muted">${escapeHtml(client.contact)} · ${escapeHtml(client.phone)} ${client.email ? "· " + escapeHtml(client.email) : ""}</span>
    </section>
    <table><thead><tr><th>Producto</th><th>Método</th><th>Color</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total">Total estimado: ${money(proposalTotal(proposal))}</div>
    <section class="box"><strong>Condiciones</strong><p class="muted">Validez: ${escapeHtml(state.settings.validityDays || 7)} días. Producción estimada: ${escapeHtml(state.settings.productionDays || 14)} días. Valores sujetos a confirmación final de talles, colores y archivos de logo.</p></section>
  </main>
</body>
</html>`;
}

function printProposal(id) {
  const proposal = state.proposals.find((item) => item.id === id);
  if (!proposal) return;
  const win = window.open("", "_blank");
  if (!win) {
    showToast("El navegador bloqueo la ventana de impresion.");
    return;
  }
  win.document.open();
  win.document.write(proposalPrintHtml(proposal));
  win.document.close();
}

function exportBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "UNIFORMA Panel",
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `uniforma-panel-backup-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const importedState = parsed.state || parsed;
      if (!importedState || !Array.isArray(importedState.clients) || !Array.isArray(importedState.proposals)) {
        throw new Error("El archivo no parece ser un backup valido.");
      }
      state = importedState;
      await saveAndRender("Backup importado.");
      showView("dashboard");
    } catch (error) {
      showToast(error.message);
    }
  };
  reader.readAsText(file);
}

function moveLogo(event) {
  const rect = $("garmentStage").getBoundingClientRect();
  state.editor.logo.x = Math.min(92, Math.max(8, ((event.clientX - rect.left) / rect.width) * 100));
  state.editor.logo.y = Math.min(90, Math.max(10, ((event.clientY - rect.top) / rect.height) * 100));
  updateStage();
}

function bindEvents() {
  document.body.addEventListener("click", async (event) => {
    try {
      const view = event.target.closest("[data-view]");
      if (view) return showView(view.dataset.view);

      const jump = event.target.closest("[data-view-jump]");
      if (jump) return showView(jump.dataset.viewJump);

      const action = event.target.closest("[data-action]");
      if (action && action.dataset.action === "new-client") return showView("clientes");
      if (action && action.dataset.action === "new-task") {
        if (!can("tasks.manage")) return showToast("No tenes permisos para crear tareas.");
        createTaskDraft();
        await saveAndRender("Tarea creada.");
        showView("tareas");
        return;
      }
      if (action && action.dataset.action === "new-proposal") {
        if (!can("proposals.manage")) return showToast("No tenes permisos para crear propuestas.");
        if (!state.clients.length) return showToast("Primero carga un cliente.");
        const proposal = ensureProposalForClient(state.clients[0].id);
        state.activeProposalId = proposal.id;
        state.editor.clientId = proposal.clientId;
        await saveAndRender("Propuesta creada.");
        showView("editor");
        return;
      }

      const open = event.target.closest("[data-open-proposal]");
      if (open) {
        state.activeProposalId = open.dataset.openProposal;
        renderAll();
        return;
      }

      const clientProposal = event.target.closest("[data-client-proposal]");
      if (clientProposal) {
        if (!can("proposals.manage")) return showToast("No tenes permisos para crear propuestas.");
        const proposal = ensureProposalForClient(clientProposal.dataset.clientProposal);
        state.activeProposalId = proposal.id;
        state.editor.clientId = proposal.clientId;
        await saveAndRender("Propuesta lista para editar.");
        showView("editor");
        return;
      }

      const clientTask = event.target.closest("[data-client-task]");
      if (clientTask) {
        if (!can("tasks.manage")) return showToast("No tenes permisos para crear tareas.");
        createTaskDraft(clientTask.dataset.clientTask);
        await saveAndRender("Tarea creada.");
        showView("tareas");
        return;
      }

      const editClient = event.target.closest("[data-edit-client]");
      if (editClient) {
        editingClientId = editClient.dataset.editClient;
        renderClients();
        return;
      }

      const editProduct = event.target.closest("[data-edit-product]");
      if (editProduct) {
        editingProductId = editProduct.dataset.editProduct;
        renderCatalog();
        return;
      }

      const deleteClient = event.target.closest("[data-delete-client]");
      if (deleteClient) {
        if (!can("clients.manage")) return;
        const client = clientById(deleteClient.dataset.deleteClient);
        if (!confirm(`Borrar cliente "${client.company}" y sus propuestas/tareas asociadas?`)) return;
        state.clients = state.clients.filter((item) => item.id !== client.id);
        state.tasks = (state.tasks || []).filter((task) => task.clientId !== client.id);
        state.proposals = state.proposals.filter((proposal) => proposal.clientId !== client.id);
        if (state.editor.clientId === client.id) state.editor.clientId = state.clients[0]?.id || "";
        if (!state.proposals.some((proposal) => proposal.id === state.activeProposalId)) {
          state.activeProposalId = state.proposals[0]?.id || "";
        }
        editingClientId = "";
        await saveAndRender("Cliente borrado.");
        return;
      }

      const deleteProduct = event.target.closest("[data-delete-product]");
      if (deleteProduct) {
        if (!can("catalog.manage")) return;
        const product = productById(deleteProduct.dataset.deleteProduct);
        if (!confirm(`Borrar producto "${product.name}"?`)) return;
        state.products = state.products.filter((item) => item.id !== product.id);
        state.proposals.forEach((proposal) => {
          proposal.designs = (proposal.designs || []).filter((design) => design.productId !== product.id);
        });
        if (state.editor.productId === product.id) state.editor.productId = state.products[0]?.id || "";
        editingProductId = "";
        await saveAndRender("Producto borrado.");
        return;
      }

      const editUser = event.target.closest("[data-edit-user]");
      if (editUser) {
        editingUserId = editUser.dataset.editUser;
        renderUsers();
        return;
      }

      const editTask = event.target.closest("[data-edit-task]");
      if (editTask) {
        editingTaskId = editTask.dataset.editTask;
        renderTasks();
        return;
      }

      const completeTask = event.target.closest("[data-complete-task]");
      if (completeTask) {
        const task = taskById(completeTask.dataset.completeTask);
        if (task) {
          task.status = "Hecha";
          await saveAndRender("Tarea completada.");
        }
        return;
      }

      const filter = event.target.closest("[data-filter]");
      if (filter) {
        state.catalogFilter = filter.dataset.filter;
        renderCatalog();
        return;
      }

      const taskFilter = event.target.closest("[data-task-filter]");
      if (taskFilter) {
        activeTaskFilter = taskFilter.dataset.taskFilter;
        renderTasks();
        return;
      }

      const useProduct = event.target.closest("[data-use-product]");
      if (useProduct) {
        state.editor.productId = useProduct.dataset.useProduct;
        await saveAndRender();
        showView("editor");
        return;
      }

      const status = event.target.closest("[data-set-status]");
      if (status) {
        if (!can("proposals.manage")) return showToast("No tenes permisos para cambiar estados.");
        const proposal = activeProposal();
        if (!proposal) return;
        proposal.status = status.dataset.setStatus;
        proposal.updatedDate = new Date().toISOString().slice(0, 10);
        await saveAndRender("Estado actualizado.");
        return;
      }

      const print = event.target.closest("[data-print-proposal]");
      if (print) {
        printProposal(print.dataset.printProposal);
      }
    } catch (error) {
      showToast(error.message);
    }
  });

  els.clientSearch.addEventListener("input", renderClients);

  els.clientForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!can("clients.manage")) return;
    const data = new FormData(els.clientForm);
    const payload = {
      company: String(data.get("company") || "").trim(),
      contact: String(data.get("contact") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      address: String(data.get("address") || "").trim(),
      sector: String(data.get("sector") || "Servicios"),
      source: String(data.get("source") || "WhatsApp"),
      priority: String(data.get("priority") || "Media"),
      notes: String(data.get("notes") || "").trim(),
      logoData: "",
      ownerId: currentUser?.id || "",
    };
    if (!payload.company || !payload.contact) return;
    if (editingClientId) {
      Object.assign(clientById(editingClientId), payload);
      editingClientId = "";
    } else {
      state.clients.unshift({ id: `${slugify(payload.company)}-${Date.now()}`, ...payload });
    }
    els.clientForm.reset();
    await saveAndRender("Cliente guardado.");
  });

  $("resetClientBtn").addEventListener("click", () => {
    editingClientId = "";
    els.clientForm.reset();
    renderClients();
  });

  els.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!can("tasks.manage")) return;
    const data = new FormData(els.taskForm);
    const payload = {
      title: String(data.get("title") || "").trim(),
      clientId: String(data.get("clientId") || ""),
      proposalId: String(data.get("proposalId") || ""),
      dueDate: String(data.get("dueDate") || todayIso()),
      priority: String(data.get("priority") || "Media"),
      status: String(data.get("status") || "Pendiente"),
      note: String(data.get("note") || "").trim(),
      ownerId: currentUser?.id || "",
    };
    if (!payload.title) return;
    if (editingTaskId && taskById(editingTaskId)) {
      Object.assign(taskById(editingTaskId), payload);
      editingTaskId = "";
    } else {
      state.tasks = state.tasks || [];
      state.tasks.unshift({ id: `task-${Date.now()}`, createdAt: new Date().toISOString(), ...payload });
    }
    els.taskForm.reset();
    await saveAndRender("Tarea guardada.");
  });

  $("resetTaskBtn").addEventListener("click", () => {
    editingTaskId = "";
    els.taskForm.reset();
    renderTasks();
  });

  els.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!can("catalog.manage")) return;
    const data = new FormData(els.productForm);
    const existing = editingProductId ? productById(editingProductId) : null;
    const frontFile = els.productForm.elements.imageFile.files && els.productForm.elements.imageFile.files[0];
    const backFile = els.productForm.elements.imageBackFile.files && els.productForm.elements.imageBackFile.files[0];
    const frontImage = await readFileDataUrl(frontFile);
    const backImage = await readFileDataUrl(backFile);
    const payload = {
      name: String(data.get("name") || "").trim(),
      category: String(data.get("category") || "").trim(),
      image: frontImage || existing?.image || "",
      imageBack: backImage || existing?.imageBack || frontImage || existing?.image || "",
      sizes: String(data.get("sizes") || "").trim(),
      material: String(data.get("material") || "").trim(),
      basePrice: Number(data.get("basePrice") || 0),
    };
    if (!payload.name || !payload.category) return;
    if (editingProductId) {
      Object.assign(productById(editingProductId), payload);
      editingProductId = "";
    } else {
      state.products.unshift({ id: `${slugify(payload.name)}-${Date.now()}`, ...payload });
    }
    els.productForm.reset();
    await saveAndRender("Prenda guardada.");
  });

  $("resetProductBtn").addEventListener("click", () => {
    editingProductId = "";
    els.productForm.reset();
    els.productFrontPreview.innerHTML = '<span class="image-fallback">Sin imagen frente</span>';
    els.productBackPreview.innerHTML = '<span class="image-fallback">Sin imagen espalda</span>';
    renderCatalog();
  });

  els.productForm.elements.imageFile.addEventListener("change", async () => {
    const file = els.productForm.elements.imageFile.files && els.productForm.elements.imageFile.files[0];
    const dataUrl = await readFileDataUrl(file);
    if (dataUrl) els.productFrontPreview.innerHTML = imageTag(dataUrl, "Frente");
  });

  els.productForm.elements.imageBackFile.addEventListener("change", async () => {
    const file = els.productForm.elements.imageBackFile.files && els.productForm.elements.imageBackFile.files[0];
    const dataUrl = await readFileDataUrl(file);
    if (dataUrl) els.productBackPreview.innerHTML = imageTag(dataUrl, "Espalda");
  });

  els.editorClient.addEventListener("change", () => {
    state.editor.clientId = els.editorClient.value;
    const proposal = ensureProposalForClient(state.editor.clientId);
    if (proposal) state.activeProposalId = proposal.id;
    renderAll();
  });
  els.editorProduct.addEventListener("change", () => {
    state.editor.productId = els.editorProduct.value;
    updateStage();
  });
  els.editorMethod.addEventListener("change", () => {
    state.editor.method = els.editorMethod.value;
    updateStage();
  });
  els.editorColor.addEventListener("change", () => {
    state.editor.color = els.editorColor.value;
    updateStage();
  });
  els.quantityInput.addEventListener("input", () => (state.editor.qty = Math.max(1, Number(els.quantityInput.value || 1))));
  els.notesInput.addEventListener("input", () => (state.editor.notes = els.notesInput.value));
  els.scaleRange.addEventListener("input", () => {
    state.editor.logo.scale = Number(els.scaleRange.value);
    updateStage();
  });
  els.rotationRange.addEventListener("input", () => {
    state.editor.logo.rotation = Number(els.rotationRange.value);
    updateStage();
  });

  document.querySelectorAll("[data-face]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editor.face = button.dataset.face;
      updateStage();
    });
  });

  els.logoInput.addEventListener("change", () => {
    const file = els.logoInput.files && els.logoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.editor.logoData = String(reader.result || "");
      updateStage();
    };
    reader.readAsDataURL(file);
  });

  els.logoLayer.addEventListener("pointerdown", (event) => {
    dragging = true;
    els.logoLayer.setPointerCapture(event.pointerId);
    moveLogo(event);
  });
  els.logoLayer.addEventListener("pointermove", (event) => {
    if (dragging) moveLogo(event);
  });
  els.logoLayer.addEventListener("pointerup", () => (dragging = false));
  els.logoLayer.addEventListener("pointercancel", () => (dragging = false));

  $("saveDesignBtn").addEventListener("click", async () => {
    if (!can("editor.use")) return;
    const product = productById(state.editor.productId);
    const proposal = ensureProposalForClient(state.editor.clientId);
    if (!proposal) return showToast("Primero carga un cliente.");
    state.activeProposalId = proposal.id;
    proposal.designs.unshift({
      id: `design-${Date.now()}`,
      productId: product.id,
      face: state.editor.face,
      method: state.editor.method,
      color: state.editor.color,
      qty: Number(state.editor.qty || 1),
      note: state.editor.notes,
      logo: { ...state.editor.logo },
    });
    proposal.updatedDate = new Date().toISOString().slice(0, 10);
    await saveAndRender("Vista guardada.");
    showView("propuestas");
  });

  $("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!can("settings.manage")) return;
    state.settings.companyName = els.settingCompanyName.value.trim() || "UNIFORMA";
    state.settings.whatsapp = els.settingWhatsapp.value.trim();
    state.settings.currency = els.settingCurrency.value.trim() || "ARS";
    state.settings.quotePrefix = els.settingQuotePrefix.value.trim() || "#2026";
    state.settings.defaultMargin = Number(els.settingMargin.value || 0);
    state.settings.taxRate = Number(els.settingTax.value || 0);
    state.settings.validityDays = Number(els.settingValidity.value || 7);
    state.settings.productionDays = Number(els.settingProduction.value || 14);
    state.settings.theme = {
      accent: els.settingAccent.value || "#b7792a",
      accentDark: els.settingAccentDark.value || "#965f1c",
      sidebar: els.settingSidebar.value || "#24180f",
      density: els.settingDensity.value || "comfortable",
    };
    await saveAndRender("Configuracion guardada.");
  });

  els.exportBackupBtn.addEventListener("click", () => {
    if (!can("settings.manage")) return;
    exportBackup();
  });

  els.backupInput.addEventListener("change", () => {
    if (!can("settings.manage")) return;
    const file = els.backupInput.files && els.backupInput.files[0];
    if (file) importBackupFile(file);
    els.backupInput.value = "";
  });

  els.userRoleSelect.addEventListener("change", () => {
    renderPermissionCheckboxes(true);
    renderPermissionPreview();
  });

  els.userPermissionList.addEventListener("change", renderPermissionPreview);

  els.userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!can("users.manage")) return;
    const data = new FormData(els.userForm);
    const payload = {
      id: editingUserId,
      name: String(data.get("name") || "").trim(),
      username: String(data.get("username") || "").trim(),
      email: String(data.get("email") || "").trim(),
      role: String(data.get("role") || "lectura"),
      permissionsOverride: currentFormPermissions(),
      active: Boolean(data.get("active")),
      password: String(data.get("password") || ""),
    };
    await apiAction(editingUserId ? "update_user" : "create_user", { user: payload });
    editingUserId = "";
    els.userForm.reset();
    renderAll();
    showToast("Usuario guardado.");
  });

  $("resetUserBtn").addEventListener("click", () => {
    editingUserId = "";
    els.userForm.reset();
    renderUsers();
  });

  $("logoutBtn").addEventListener("click", async () => {
    await fetch("api.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": window.UNIFORMA_BOOT.csrf },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.reload();
  });

  $("notificationBtn").addEventListener("click", () => {
    const alerts = alertCount();
    showToast(alerts ? `Tenes ${alerts} alertas de seguimiento.` : "No hay alertas pendientes.");
  });
}

async function boot() {
  renderIcons();
  const res = await fetch("api.php");
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "No se pudo cargar el panel");
  if (data.csrf) window.UNIFORMA_BOOT.csrf = data.csrf;
  syncPayload(data);
  bindEvents();
  renderAll();
  showView(firstAllowedView());
}

boot().catch((error) => {
  console.error(error);
  showToast("No se pudo iniciar el panel.");
});
