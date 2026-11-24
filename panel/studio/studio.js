/* Estudio de logos — UNIFORMA. Editor de lienzo (Konva) para preparar logos de clientes: tamaño real en cm,
   quitar fondo, color plano, reducir colores, texto y formas, alinear, capas, vista previa en prenda y exportación. */
(() => {
  'use strict';

  const BOOT = window.STUDIO_BOOT || {};
  const PX_CM = 40;                // px de documento por cm (al 100% de zoom)
  const MAX_IMPORT_PX = 3000;      // lado mayor de imagen al importar
  const MAX_EXPORT_PX = 8192;
  const FONTS = ['Archivo', 'Jost', 'Montserrat', 'Oswald', 'Bebas Neue', 'Anton', 'Playfair Display', 'Roboto Slab', 'Pacifico', 'Lobster', 'Dancing Script', 'Permanent Marker'];
  const PRESETS = [
    ['Pecho 10×10', 10, 10], ['Pecho 12×8', 12, 8], ['Espalda 30×35', 30, 35], ['Manga 8×8', 8, 8],
    ['Etiqueta 8×3', 8, 3], ['Gorra 10×5', 10, 5], ['A4', 21, 29.7], ['Cuadrado 20×20', 20, 20],
  ];
  const SHAPES = [
    ['rect', 'Cuadrado'], ['ellipse', 'Círculo'], ['triangle', 'Triángulo'],
    ['star', 'Estrella'], ['hexagon', 'Hexágono'], ['line', 'Línea'],
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const px = (c) => c * PX_CM;
  const cm = (p) => p / PX_CM;
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const num = (v, fallback = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : fallback; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- iconos ---------- */
  const IC = {
    select: '<path d="M5 3l14 8-6 1.5L10 19z"/>', hand: '<path d="M8 12V6a1.5 1.5 0 013 0v5m0-6a1.5 1.5 0 013 0v6m0-4a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-4a1.5 1.5 0 012.5-1.5L8 14"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
    shapes: '<rect x="3" y="12" width="9" height="9" rx="1"/><circle cx="16.5" cy="7.5" r="4.5"/>', rect: '<rect x="4" y="4" width="16" height="16"/>', ellipse: '<circle cx="12" cy="12" r="8"/>',
    triangle: '<path d="M12 4l9 16H3z"/>', star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z"/>', hexagon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>', line: '<path d="M4 20L20 4"/>',
    undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>', redo: '<path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3"/>',
    save: '<path d="M5 3h11l4 4v14H5zM8 3v6h8V3M8 21v-7h8v7"/>', download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.8M6.5 7.6A17 17 0 002 12s4 7 10 7a9.6 9.6 0 004-.9"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
    front: '<rect x="3" y="3" width="10" height="10"/><rect x="11" y="11" width="10" height="10" fill="currentColor"/>', back: '<rect x="3" y="3" width="10" height="10" fill="currentColor"/><rect x="11" y="11" width="10" height="10"/>',
    up: '<path d="M12 19V5m0 0l-6 6m6-6l6 6"/>', down: '<path d="M12 5v14m0 0l6-6m-6 6l-6-6"/>',
    flipH: '<path d="M12 3v18M8 7L3 17h5zM16 7l5 10h-5z"/>', flipV: '<path d="M3 12h18M7 8L17 3v5zM7 16l10 5v-5z"/>',
    alL: '<path d="M4 3v18M8 7h12M8 14h7"/>', alCH: '<path d="M12 3v18M5 7h14M8 14h8"/>', alR: '<path d="M20 3v18M4 7h12M9 14h7"/>',
    alT: '<path d="M3 4h18M7 8v12M14 8v7"/>', alCV: '<path d="M3 12h18M7 5v14M14 8v8"/>', alB: '<path d="M3 20h18M7 4v12M14 9v7"/>',
    group: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M7 11v2h6M17 13v-2h-6" stroke-dasharray="2 2"/>', ungroup: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', back2: '<path d="M15 5l-7 7 7 7"/>',
    shirt: '<path d="M8 3l-5 3 2.5 4L8 9v12h8V9l2.5 1L21 6l-5-3a4 4 0 01-8 0z"/>', layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>', folder: '<path d="M3 6a2 2 0 012-2h4l2 3h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    wand: '<path d="M4 20L16 8M14 4l1.5-1.5L17 4l1.5-1.5M19 9l1.5-1.5M15 13l1.5 1.5"/><path d="M13 5l6 6"/>', crop: '<path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 17h.01"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 15h12v7H6z"/>',
    grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>', magnet: '<path d="M6 3v10a6 6 0 0012 0V3h-4v10a2 2 0 01-4 0V3zM6 7h4M14 7h4"/>', picker: '<path d="M15 4l5 5-9 9H6v-5zM13 6l5 5"/>',
  };
  const ic = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;

  /* ---------- estado ---------- */
  const S = {
    doc: { name: 'Logo sin título', clientId: '', widthCm: 20, heightCm: 20, bg: 'transparent', bgColor: '#ffffff', snap: true, grid: false },
    projectId: '', rev: 0, dirty: false, saving: false, lastSavedAt: '',
    tool: 'select', leftTab: 'layers', shapesOpen: false, pickMode: false,
    clients: [], products: [], projects: [],
    history: [], hIndex: -1, restoring: false,
    assets: new Map(), pending: new Set(), clipboard: null, lockRatio: true,
    fxBusy: false, spaceDown: false, panning: null, autoFit: true,
  };

  /* ---------- API ---------- */
  async function http(url, opts = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta no JSON */ }
    if (!res.ok || !data || data.ok === false) {
      const err = new Error((data && data.error) || `Error del servidor (HTTP ${res.status})`);
      err.status = res.status; err.conflict = !!(data && data.conflict);
      throw err;
    }
    return data;
  }
  const apiGet = (action, params = {}) => http('studio-api.php?' + new URLSearchParams({ action, ...params }));
  const apiPost = (action, body) => http('studio-api.php?action=' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': BOOT.csrf }, body: JSON.stringify(body),
  });
  async function uploadBlob(blob, name = 'imagen.png') {
    const fd = new FormData();
    fd.append('file', blob, name);
    return http('studio-api.php?action=upload', { method: 'POST', headers: { 'X-CSRF-Token': BOOT.csrf }, body: fd });
  }

  /* ---------- Konva ---------- */
  const host = $('stageHost');
  const stage = new Konva.Stage({ container: 'stageHost', width: host.clientWidth || 800, height: host.clientHeight || 600 });
  const bgLayer = new Konva.Layer({ listening: true });
  const content = new Konva.Layer();
  const ui = new Konva.Layer();
  stage.add(bgLayer, content, ui);

  const checker = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 20;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 20, 20);
    g.fillStyle = '#ece6da'; g.fillRect(0, 0, 10, 10); g.fillRect(10, 10, 10, 10);
    return c;
  })();
  const pageRect = new Konva.Rect({ name: 'page', x: 0, y: 0, fillPatternImage: checker, shadowColor: 'rgba(60,35,15,.28)', shadowBlur: 22, shadowOffsetY: 5, shadowForStrokeEnabled: false });
  const gridGroup = new Konva.Group({ listening: false });
  bgLayer.add(pageRect, gridGroup);

  const tr = new Konva.Transformer({
    rotateEnabled: true, rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315], rotationSnapTolerance: 5,
    anchorSize: 10, anchorCornerRadius: 2, borderStroke: '#b77a2b', anchorStroke: '#b77a2b', anchorFill: '#ffffff',
    keepRatio: true, ignoreStroke: true, padding: 2,
    boundBoxFunc: (o, n) => (n.width < 6 || n.height < 6 ? o : n),
  });
  const marquee = new Konva.Rect({ fill: 'rgba(183,122,43,.12)', stroke: '#b77a2b', strokeWidth: 1, visible: false, listening: false });
  const guides = new Konva.Group({ listening: false });
  ui.add(guides, tr, marquee);

  /* ---------- utilidades de escena ---------- */
  const selected = () => tr.nodes();
  const objs = () => content.getChildren().slice();
  const pageW = () => px(S.doc.widthCm);
  const pageH = () => px(S.doc.heightCm);
  const iw = (img) => img.naturalWidth || img.width;
  const ih = (img) => img.naturalHeight || img.height;
  const rectOf = (n) => n.getClientRect({ relativeTo: content, skipShadow: true });
  const unionRect = (nodes) => {
    const rs = nodes.map(rectOf);
    const x1 = Math.min(...rs.map((r) => r.x)), y1 = Math.min(...rs.map((r) => r.y));
    const x2 = Math.max(...rs.map((r) => r.x + r.width)), y2 = Math.max(...rs.map((r) => r.y + r.height));
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  };
  const pointer = () => {
    const p = stage.getPointerPosition();
    return p ? stage.getAbsoluteTransform().copy().invert().point(p) : { x: 0, y: 0 };
  };
  const topObj = (t) => { let n = t; while (n && n.getParent() !== content) n = n.getParent(); return n && n.getParent() === content ? n : null; };
  const kindOf = (n) => n.getAttr('kind') || ({ Image: 'image', Text: 'text', Group: 'group' }[n.getClassName()] || 'shape');

  function toast(msg, err = false) {
    const t = $('toast'); t.textContent = msg; t.classList.toggle('err', err); t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), err ? 4200 : 2200);
  }
  function modal({ title, body, actions = [], narrow = false }) {
    return new Promise((resolve) => {
      const m = $('modal');
      m.innerHTML = `<div class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true"><header><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Cerrar">${ic('x')}</button></header><div class="body">${body}</div><footer>${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer></div>`;
      m.hidden = false;
      const done = (v) => { m.hidden = true; m.innerHTML = ''; m.onclick = null; resolve(v); };
      m.onclick = (e) => {
        if (e.target === m || e.target.closest('[data-close]')) return done(null);
        const b = e.target.closest('[data-act]');
        if (b) { const a = actions[+b.dataset.act]; done(a.value !== undefined ? a.value : true); }
      };
      m._done = done;
    });
  }
  const closeModal = () => { const m = $('modal'); if (!m.hidden && m._done) m._done(null); };

  /* ---------- assets ---------- */
  function loadAsset(id) {
    if (S.assets.has(id)) return Promise.resolve(S.assets.get(id));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { S.assets.set(id, img); resolve(img); };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen ' + id));
      img.src = 'studio-api.php?action=asset&id=' + encodeURIComponent(id);
    });
  }
  const canvasToBlob = (c, type = 'image/png', q) => new Promise((r) => c.toBlob(r, type, q));
  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }
  async function svgToCanvas(file) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('El SVG no es válido');
    let w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if ((!w || !h) && vb.length === 4) { w = vb[2]; h = vb[3]; }
    if (!w || !h) { w = 1000; h = 1000; }
    if (!svg.getAttribute('width') || !svg.getAttribute('height')) { svg.setAttribute('width', w); svg.setAttribute('height', h); }
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const img = await fileToImage(blob);
    const k = Math.min(2400 / Math.max(w, h), 8);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  async function prepareImportCanvas(file) {
    let c;
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) c = await svgToCanvas(file);
    else {
      const img = await fileToImage(file);
      const k = Math.min(1, MAX_IMPORT_PX / Math.max(iw(img), ih(img)));
      c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw(img) * k)); c.height = Math.max(1, Math.round(ih(img) * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    }
    return c;
  }

  /* ---------- fábrica de nodos ---------- */
  const DEFAULT_FILL = '#5f3d27';
  function baseAttrs(extra) { return { name: 'obj', draggable: true, ...extra }; }
  function makeShape(type) {
    const c = centerOf(0, 0);
    const common = { fill: DEFAULT_FILL, kind: 'shape', strokeScaleEnabled: false };
    switch (type) {
      case 'rect': return new Konva.Rect(baseAttrs({ ...common, label: 'Cuadrado', x: c.x - px(3), y: c.y - px(3), width: px(6), height: px(6), strokeWidth: 0, stroke: '#000000' }));
      case 'ellipse': return new Konva.Ellipse(baseAttrs({ ...common, label: 'Círculo', x: c.x, y: c.y, radiusX: px(3), radiusY: px(3), strokeWidth: 0, stroke: '#000000' }));
      case 'triangle': return new Konva.RegularPolygon(baseAttrs({ ...common, label: 'Triángulo', x: c.x, y: c.y, sides: 3, radius: px(3.6), strokeWidth: 0, stroke: '#000000' }));
      case 'hexagon': return new Konva.RegularPolygon(baseAttrs({ ...common, label: 'Hexágono', x: c.x, y: c.y, sides: 6, radius: px(3.4), strokeWidth: 0, stroke: '#000000' }));
      case 'star': return new Konva.Star(baseAttrs({ ...common, label: 'Estrella', x: c.x, y: c.y, numPoints: 5, innerRadius: px(1.5), outerRadius: px(3.6), strokeWidth: 0, stroke: '#000000' }));
      default: return new Konva.Line(baseAttrs({ kind: 'shape', label: 'Línea', stroke: DEFAULT_FILL, strokeWidth: px(0.25), lineCap: 'round', hitStrokeWidth: 24, strokeScaleEnabled: false, points: [c.x - px(4), c.y, c.x + px(4), c.y] }));
    }
  }
  const centerOf = () => ({ x: pageW() / 2, y: pageH() / 2 });

  function serializeNode(n) {
    const a = { ...n.attrs };
    delete a.image; delete a.fillPatternImage;
    const o = { t: n.getClassName(), a };
    if (o.t === 'Group') o.c = n.getChildren().map(serializeNode);
    return o;
  }
  const serialize = () => ({ v: 1, widthCm: S.doc.widthCm, heightCm: S.doc.heightCm, bg: S.doc.bg, bgColor: S.doc.bgColor, nodes: objs().map(serializeNode) });

  async function build(o) {
    const A = { ...o.a };
    let n;
    if (o.t === 'Image') {
      try {
        const img = await loadAsset(A.assetId);
        n = new Konva.Image({ ...A, image: img });
      } catch (e) {
        n = new Konva.Rect({ ...A, fill: '#ece6da', stroke: '#b3412f', dash: [8, 6], strokeWidth: 2, label: (A.label || 'Imagen') + ' (no disponible)' });
      }
    } else if (o.t === 'Group') {
      n = new Konva.Group(A);
      for (const c of o.c || []) n.add(await build(c));
    } else if (Konva[o.t]) {
      n = new Konva[o.t](A);
    } else {
      throw new Error('Tipo desconocido: ' + o.t);
    }
    return n;
  }

  /* ---------- selección ---------- */
  function select(nodes) {
    nodes = (nodes || []).filter((n) => n && n.getParent() === content && n.visible());
    tr.nodes(nodes);
    ui.batchDraw();
    renderProps(); renderLeft();
  }
  const isSel = (n) => selected().includes(n);

  /* ---------- zoom / vista ---------- */
  function setZoom(z, anchor) {
    z = clamp(z, 0.05, 10); S.autoFit = false;
    const old = stage.scaleX();
    const a = anchor || { x: host.clientWidth / 2, y: host.clientHeight / 2 };
    const pos = stage.position();
    const wx = (a.x - pos.x) / old, wy = (a.y - pos.y) / old;
    stage.scale({ x: z, y: z });
    stage.position({ x: a.x - wx * z, y: a.y - wy * z });
    stage.batchDraw(); drawGrid(); renderZoom();
  }
  function fit() {
    const pad = 70, w = host.clientWidth, h = host.clientHeight;
    const z = clamp(Math.min((w - pad * 2) / pageW(), (h - pad * 2) / pageH()), 0.05, 4);
    stage.scale({ x: z, y: z });
    stage.position({ x: (w - pageW() * z) / 2, y: (h - pageH() * z) / 2 });
    stage.batchDraw(); drawGrid(); renderZoom();
  }
  function renderZoom() {
    $('zoombar').innerHTML = `<button data-z="out" aria-label="Alejar">−</button><span class="z">${Math.round(stage.scaleX() * 100)}%</span><button data-z="in" aria-label="Acercar">+</button><button data-z="fit">Ajustar</button><button data-z="grid" title="Cuadrícula de 1 cm" style="${S.doc.grid ? 'color:var(--accent-dark)' : ''}">${ic('grid').replace('<svg', '<svg width="16" height="16"')}</button>`;
  }
  function drawGrid() {
    gridGroup.destroyChildren();
    if (S.doc.grid && stage.scaleX() > 0.25) {
      const z = stage.scaleX(), stroke = 'rgba(95,61,39,.16)';
      for (let x = 0; x <= S.doc.widthCm + 1e-6; x++) gridGroup.add(new Konva.Line({ points: [px(x), 0, px(x), pageH()], stroke, strokeWidth: 1 / z }));
      for (let y = 0; y <= S.doc.heightCm + 1e-6; y++) gridGroup.add(new Konva.Line({ points: [0, px(y), pageW(), px(y)], stroke, strokeWidth: 1 / z }));
    }
    bgLayer.batchDraw();
  }
  function applyPage() {
    pageRect.size({ width: pageW(), height: pageH() });
    if (S.doc.bg === 'transparent') { pageRect.fillPatternImage(checker); pageRect.fill(null); }
    else { pageRect.fillPatternImage(null); pageRect.fill(S.doc.bg === 'white' ? '#ffffff' : S.doc.bgColor); }
    drawGrid(); bgLayer.batchDraw();
  }

  /* ---------- historial ---------- */
  const snap = () => JSON.stringify(serialize());
  function markDirty() { S.dirty = true; renderStatus(); scheduleAutosave(); }
  function commit() {
    if (S.restoring) return;
    const s = snap();
    if (S.history[S.hIndex] === s) return;
    S.history = S.history.slice(0, S.hIndex + 1);
    S.history.push(s);
    if (S.history.length > 80) S.history.shift();
    S.hIndex = S.history.length - 1;
    markDirty(); renderLeft(); renderTop();
  }
  async function jump(i) {
    if (i < 0 || i >= S.history.length || S.restoring) return;
    S.restoring = true;
    try {
      S.hIndex = i;
      await loadDoc(JSON.parse(S.history[i]), { keepView: true, keepHistory: true });
    } finally { S.restoring = false; }
    markDirty(); renderTop();
  }
  const undo = () => jump(S.hIndex - 1);
  const redo = () => jump(S.hIndex + 1);

  async function loadDoc(d, { keepView = false, keepHistory = false } = {}) {
    await fontsReady;
    tr.nodes([]); content.destroyChildren(); guides.destroyChildren();
    S.doc.widthCm = d.widthCm || 20; S.doc.heightCm = d.heightCm || 20;
    S.doc.bg = d.bg || 'transparent'; S.doc.bgColor = d.bgColor || '#ffffff';
    for (const o of d.nodes || []) content.add(await build(o));
    applyPage();
    if (!keepView) fit();
    content.batchDraw();
    if (!keepHistory) { S.history = [snap()]; S.hIndex = 0; }
    select([]);
    renderTop();
  }

  /* ---------- agregar contenido ---------- */
  function addNode(n, { selectIt = true } = {}) {
    if (S.finishEdit) S.finishEdit(true);
    content.add(n);
    content.batchDraw();
    if (selectIt) select([n]);
    commit();
    return n;
  }
  async function addImageFile(file) {
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) { toast('Ese archivo no es una imagen', true); return; }
    try {
      toast('Subiendo imagen…');
      const c = await prepareImportCanvas(file);
      const blob = await canvasToBlob(c);
      const up = await uploadBlob(blob, (file.name || 'imagen').replace(/\.[^.]+$/, '') + '.png');
      S.assets.set(up.id, c);
      const maxW = pageW() * 0.7, maxH = pageH() * 0.7;
      const k = Math.min(maxW / c.width, maxH / c.height);
      const w = c.width * k, h = c.height * k;
      const n = new Konva.Image(baseAttrs({
        image: c, assetId: up.id, origAssetId: up.id, rootAssetId: up.id, kind: 'image', fx: {},
        label: (file.name || 'Imagen').replace(/\.[^.]+$/, '').slice(0, 40) || 'Imagen',
        x: (pageW() - w) / 2, y: (pageH() - h) / 2, width: w, height: h,
      }));
      addNode(n);
      toast('Imagen agregada');
    } catch (e) { toast(e.message, true); }
  }
  function addText() {
    const c = centerOf();
    const n = new Konva.Text(baseAttrs({
      kind: 'text', label: 'Texto', text: 'Tu texto', fontFamily: 'Archivo', fontSize: px(2.2), fontStyle: 'bold', fill: DEFAULT_FILL,
      align: 'center', lineHeight: 1.1, letterSpacing: 0, stroke: '#000000', strokeWidth: 0, fillAfterStrokeEnabled: true, strokeScaleEnabled: false,
    }));
    n.position({ x: c.x - n.width() / 2, y: c.y - n.height() / 2 });
    addNode(n);
    setTool('select');
    setTimeout(() => editText(n), 30);
  }
  function addShape(type) { addNode(makeShape(type)); S.shapesOpen = false; renderRail(); }

  /* ---------- edición de texto en el lienzo ---------- */
  function editText(node) {
    if (node.getClassName() !== 'Text') return;
    tr.nodes([]); node.hide(); content.batchDraw();
    const area = document.createElement('textarea');
    const rect = stage.container().getBoundingClientRect();
    const abs = node.getAbsolutePosition();
    const sc = node.getAbsoluteScale().x;
    Object.assign(area.style, {
      position: 'fixed', left: rect.left + abs.x + 'px', top: rect.top + abs.y + 'px', zIndex: 90,
      width: Math.max(80, node.width() * sc + 8) + 'px', height: node.height() * sc + 6 + 'px', fontSize: node.fontSize() * sc + 'px',
      fontFamily: `"${node.fontFamily()}"`, fontWeight: /bold/.test(node.fontStyle()) ? 700 : 400, fontStyle: /italic/.test(node.fontStyle()) ? 'italic' : 'normal',
      lineHeight: node.lineHeight(), textAlign: node.align(), color: node.fill() || '#000', border: '2px solid #b77a2b', background: 'rgba(255,255,255,.92)',
      padding: '0', margin: '0', overflow: 'hidden', resize: 'none', outline: 'none', transformOrigin: 'left top', transform: `rotate(${node.rotation()}deg)`,
      letterSpacing: node.letterSpacing() * sc + 'px',
    });
    area.value = node.text();
    document.body.appendChild(area);
    area.focus(); area.select();
    const grow = () => { area.style.height = 'auto'; area.style.height = area.scrollHeight + 'px'; };
    area.addEventListener('input', grow);
    let closed = false;
    const finish = (apply) => {
      if (closed) return; closed = true; S.finishEdit = null;
      if (apply && area.value.trim() !== '') node.text(area.value);
      area.remove(); node.show(); content.batchDraw(); select([node]); commit();
    };
    S.finishEdit = finish;
    area.addEventListener('blur', () => finish(true));
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(true); }
      e.stopPropagation();
    });
  }

  /* ---------- medidas ---------- */
  function dimsOf(n) {
    const c = n.getClassName(), sx = Math.abs(n.scaleX()), sy = Math.abs(n.scaleY());
    if (c === 'Group' || c === 'Line') {
      const rot = n.rotation(); n.rotation(0);
      const r = n.getClientRect({ relativeTo: content, skipStroke: true, skipShadow: true });
      n.rotation(rot);
      return { w: r.width, h: r.height };
    }
    return { w: n.width() * sx, h: n.height() * sy };
  }
  function setDims(n, w, h) {
    const c = n.getClassName(), d = dimsOf(n);
    w = Math.max(4, w); h = Math.max(4, h);
    if (c === 'Ellipse') { n.radiusX(w / 2); n.radiusY(h / 2); n.scale({ x: Math.sign(n.scaleX()) || 1, y: Math.sign(n.scaleY()) || 1 }); }
    else if (c === 'Text') {
      const f = w / d.w;
      n.fontSize(Math.max(4, n.fontSize() * f)); n.width(Math.max(8, n.width() * f));
    } else if (c === 'Image' || c === 'Rect') { n.width(w); n.height(h); n.scale({ x: Math.sign(n.scaleX()) || 1, y: Math.sign(n.scaleY()) || 1 }); }
    else {
      const bx = d.w / Math.abs(n.scaleX()), by = d.h / Math.abs(n.scaleY());
      n.scaleX((Math.sign(n.scaleX()) || 1) * (w / bx)); n.scaleY((Math.sign(n.scaleY()) || 1) * (h / by));
    }
  }
  function bake(n) {
    const c = n.getClassName(), sx = n.scaleX(), sy = n.scaleY(), ax = Math.abs(sx), ay = Math.abs(sy);
    const sign = { x: Math.sign(sx) || 1, y: Math.sign(sy) || 1 };
    if (c === 'Image' || c === 'Rect') { n.setAttrs({ width: n.width() * ax, height: n.height() * ay, scaleX: sign.x, scaleY: sign.y }); }
    else if (c === 'Ellipse') { n.setAttrs({ radiusX: n.radiusX() * ax, radiusY: n.radiusY() * ay, scaleX: sign.x, scaleY: sign.y }); }
    else if (c === 'Text') {
      if (Math.abs(ax - ay) < 1e-3) { n.setAttrs({ fontSize: Math.max(4, n.fontSize() * ax), width: Math.max(8, n.width() * ax) }); }
      else { n.setAttrs({ width: Math.max(8, n.width() * ax) }); if (Math.abs(ay - 1) > 1e-3) n.fontSize(Math.max(4, n.fontSize() * ay)); }
      n.setAttrs({ scaleX: sign.x, scaleY: sign.y });
    }
  }
  function moveBy(nodes, dx, dy) { nodes.forEach((n) => n.position({ x: n.x() + dx, y: n.y() + dy })); }

  /* ---------- imanes y guías ---------- */
  let dragSession = null;
  function drawGuides(gx, gy) {
    guides.destroyChildren();
    const z = stage.scaleX(), style = { stroke: '#e0457b', strokeWidth: 1 / z, dash: [4 / z, 4 / z], listening: false };
    if (gx !== null) guides.add(new Konva.Line({ points: [gx, -pageH() * 0.2, gx, pageH() * 1.2], ...style }));
    if (gy !== null) guides.add(new Konva.Line({ points: [-pageW() * 0.2, gy, pageW() * 1.2, gy], ...style }));
    ui.batchDraw();
  }
  function snapDrag(n) {
    const sel = selected();
    const r = sel.length > 1 ? unionRect(sel) : rectOf(n);
    let gx = null, gy = null;
    if (S.doc.snap) {
      const T = 7 / stage.scaleX();
      const xs = [0, pageW() / 2, pageW()], ys = [0, pageH() / 2, pageH()];
      objs().forEach((o) => {
        if (sel.includes(o) || !o.visible()) return;
        const q = rectOf(o); xs.push(q.x, q.x + q.width / 2, q.x + q.width); ys.push(q.y, q.y + q.height / 2, q.y + q.height);
      });
      let dx = null, dy = null;
      for (const c of [r.x, r.x + r.width / 2, r.x + r.width]) for (const g of xs) { const d = g - c; if (Math.abs(d) <= T && (dx === null || Math.abs(d) < Math.abs(dx))) { dx = d; gx = g; } }
      for (const c of [r.y, r.y + r.height / 2, r.y + r.height]) for (const g of ys) { const d = g - c; if (Math.abs(d) <= T && (dy === null || Math.abs(d) < Math.abs(dy))) { dy = d; gy = g; } }
      if (dx !== null) n.x(n.x() + dx);
      if (dy !== null) n.y(n.y() + dy);
    }
    if (dragSession) {
      const ddx = n.x() - dragSession.start.get(n).x, ddy = n.y() - dragSession.start.get(n).y;
      dragSession.others.forEach((o) => o.position({ x: dragSession.start.get(o).x + ddx, y: dragSession.start.get(o).y + ddy }));
    }
    drawGuides(gx, gy);
  }

  content.on('dragstart', (e) => {
    const n = topObj(e.target); if (!n) return;
    const sel = selected();
    if (!sel.includes(n)) select([n]);
    const group = selected();
    dragSession = { start: new Map(group.map((o) => [o, { x: o.x(), y: o.y() }])), others: group.filter((o) => o !== n) };
  });
  content.on('dragmove', (e) => { const n = topObj(e.target); if (n) snapDrag(n); });
  content.on('dragend', () => { dragSession = null; guides.destroyChildren(); ui.batchDraw(); commit(); renderProps(); });
  content.on('transformend', (e) => { const n = topObj(e.target); if (n) bake(n); content.batchDraw(); commit(); renderProps(); });
  content.on('transform', () => { /* feedback visual lo da el Transformer */ });
  content.on('dblclick dbltap', (e) => { const n = topObj(e.target); if (n && n.getClassName() === 'Text') editText(n); });

  /* ---------- interacción de puntero ---------- */
  stage.on('mousedown touchstart', (e) => {
    if (S.finishEdit) S.finishEdit(true);
    if (S.pickMode) return;
    const mid = e.evt && e.evt.button === 1;
    if (S.tool === 'hand' || S.spaceDown || mid) { startPan(e.evt); return; }
    const t = e.target;
    const n = topObj(t);
    if (n) {
      const shift = e.evt && (e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey);
      if (shift) { const cur = selected(); select(cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]); n.stopDrag(); }
      else if (!isSel(n)) select([n]);
      return;
    }
    if (t === stage || t.name() === 'page' || t.getLayer() === bgLayer) {
      if (!(e.evt && (e.evt.shiftKey))) select([]);
      const p = pointer();
      S.marq = { x: p.x, y: p.y };
      marquee.setAttrs({ x: p.x, y: p.y, width: 0, height: 0, visible: true });
    }
  });
  stage.on('mousemove touchmove', () => {
    if (S.panning) {
      const p = stage.getPointerPosition();
      stage.position({ x: S.panning.ox + p.x - S.panning.sx, y: S.panning.oy + p.y - S.panning.sy });
      stage.batchDraw(); return;
    }
    if (S.marq) {
      const p = pointer();
      marquee.setAttrs({ x: Math.min(p.x, S.marq.x), y: Math.min(p.y, S.marq.y), width: Math.abs(p.x - S.marq.x), height: Math.abs(p.y - S.marq.y) });
      ui.batchDraw();
    }
  });
  window.addEventListener('mouseup', () => {
    if (S.panning) { S.panning = null; host.classList.remove('panning'); }
    if (S.marq) {
      const box = marquee.getClientRect({ relativeTo: ui });
      marquee.visible(false);
      S.marq = null;
      if (box.width > 3 || box.height > 3) {
        const hit = objs().filter((o) => o.visible() && o.listening() && Konva.Util.haveIntersection(box, rectOf(o)));
        select(hit);
      }
      ui.batchDraw();
    }
  });
  function startPan(evt) {
    const p = stage.getPointerPosition(); if (!p) return;
    S.autoFit = false;
    S.panning = { sx: p.x, sy: p.y, ox: stage.x(), oy: stage.y() };
    host.classList.add('panning');
    if (evt && evt.preventDefault) evt.preventDefault();
  }
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const factor = e.evt.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom(stage.scaleX() * factor, stage.getPointerPosition());
    } else {
      S.autoFit = false;
      stage.position({ x: stage.x() - (e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX), y: stage.y() - (e.evt.shiftKey ? 0 : e.evt.deltaY) });
      stage.batchDraw();
    }
  });
  stage.on('click tap', (e) => {
    if (!S.pickMode) return;
    const n = topObj(e.target);
    const img = selected()[0];
    if (!n || n !== img || img.getClassName() !== 'Image') { toast('Hacé clic sobre la imagen seleccionada', true); return; }
    const p = pointer();
    const local = img.getAbsoluteTransform(content).copy().invert().point(p);
    const src = img.image();
    const x = clamp(Math.floor((local.x / img.width()) * iw(src)), 0, iw(src) - 1), y = clamp(Math.floor((local.y / img.height()) * ih(src)), 0, ih(src) - 1);
    const c = document.createElement('canvas'); c.width = 1; c.height = 1;
    const g = c.getContext('2d'); g.drawImage(src, x, y, 1, 1, 0, 0, 1, 1);
    const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data;
    S.pickMode = false; host.style.cursor = '';
    if (a < 16) { toast('Ese punto ya es transparente'); return; }
    const fx = { ...(img.getAttr('fx') || {}) };
    fx.bg = { color: [r, gg, b], tol: fx.bg ? fx.bg.tol : 24, mode: fx.bg ? fx.bg.mode : 'edge' };
    applyFx(img, fx, true);
  });
  new ResizeObserver(() => { stage.size({ width: host.clientWidth, height: host.clientHeight }); if (S.autoFit) fit(); else stage.batchDraw(); }).observe(host);

  /* ---------- procesado de imagen ---------- */
  function autoBgColor(d) {
    const { data, width: w, height: h } = d;
    const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; }).filter((p) => p[3] > 200);
    if (!pts.length) return null;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let best = pts[0], bestN = 0;
    pts.forEach((p) => { const n = pts.filter((q) => dist(p, q) < 36).length; if (n > bestN) { bestN = n; best = p; } });
    return [best[0], best[1], best[2]];
  }
  function removeBg(d, o) {
    const { data, width: w, height: h } = d;
    const [cr, cg, cb] = o.color;
    const T = Math.max(1, (o.tol / 100) * 230);
    const dist = (i) => Math.hypot(data[i] - cr, data[i + 1] - cg, data[i + 2] - cb);
    const mask = new Uint8Array(w * h);
    const isBg = (p) => data[p * 4 + 3] < 16 || dist(p * 4) <= T;
    if (o.mode === 'all') { for (let p = 0; p < w * h; p++) if (isBg(p)) mask[p] = 1; }
    else {
      const q = new Int32Array(w * h); let qs = 0, qe = 0;
      const push = (p) => { if (!mask[p] && isBg(p)) { mask[p] = 1; q[qe++] = p; } };
      for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (qs < qe) {
        const p = q[qs++], x = p % w, y = (p / w) | 0;
        if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
      }
    }
    const soft = T * 0.9;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (mask[p]) { data[i + 3] = 0; continue; }
      const x = p % w, y = (p / w) | 0;
      const edge = (x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w]);
      if (edge) { const dd = dist(i); if (dd < T + soft) data[i + 3] = Math.round(data[i + 3] * clamp((dd - T) / soft, 0, 1)); }
    }
  }
  function posterize(d, k) {
    const { data } = d;
    const samples = [];
    const step = Math.max(1, Math.floor((data.length / 4) / 20000));
    for (let p = 0; p < data.length / 4; p += step) if (data[p * 4 + 3] > 128) samples.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
    if (!samples.length) return [];
    samples.sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
    k = Math.min(k, samples.length);
    let centers = Array.from({ length: k }, (_, i) => samples[Math.floor(((i + 0.5) / k) * samples.length)].slice());
    for (let it = 0; it < 9; it++) {
      const sum = centers.map(() => [0, 0, 0, 0]);
      for (const s of samples) {
        let bi = 0, bd = 1e12;
        centers.forEach((c, i) => { const dd = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } });
        sum[bi][0] += s[0]; sum[bi][1] += s[1]; sum[bi][2] += s[2]; sum[bi][3]++;
      }
      centers = centers.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
    }
    centers = centers.map((c) => c.map(Math.round));
    for (let p = 0; p < data.length / 4; p++) {
      const i = p * 4;
      if (data[i + 3] <= 128) { data[i + 3] = 0; continue; }
      let bi = 0, bd = 1e12;
      centers.forEach((c, j) => { const dd = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } });
      data[i] = centers[bi][0]; data[i + 1] = centers[bi][1]; data[i + 2] = centers[bi][2]; data[i + 3] = 255;
    }
    return centers.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''));
  }
  function tint(d, hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const { data } = d;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) { data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  }
  async function fxCanvas(n, fx) {
    const orig = await loadAsset(n.getAttr('origAssetId'));
    const c = document.createElement('canvas'); c.width = iw(orig); c.height = ih(orig);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(orig, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    let palette = [];
    if (fx.bg) {
      if (!fx.bg.color) fx.bg.color = autoBgColor(d);
      if (fx.bg.color) removeBg(d, fx.bg);
    }
    if (fx.colors >= 2) palette = posterize(d, fx.colors);
    if (fx.tint) tint(d, fx.tint);
    ctx.putImageData(d, 0, 0);
    return { c, palette };
  }
  let fxToken = 0;
  async function applyFx(n, fx, upload) {
    const token = ++fxToken;
    try {
      const { c, palette } = await fxCanvas(n, fx);
      if (token !== fxToken) return;
      n.image(c); n.setAttrs({ fx, palette }); content.batchDraw();
      if (upload) {
        const p = (async () => {
          const up = await uploadBlob(await canvasToBlob(c), 'logo.png');
          S.assets.set(up.id, c);
          n.setAttr('assetId', up.id);
        })();
        S.pending.add(p);
        try { await p; } finally { S.pending.delete(p); }
        commit(); renderProps();
      }
    } catch (e) { toast(e.message, true); }
  }
  async function trimImage(n) {
    const src = n.image(), w = iw(src), h = ih(src);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(src, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let x1 = w, y1 = h, x2 = -1, y2 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
    if (x2 < 0) { toast('La imagen está vacía', true); return; }
    if (x1 === 0 && y1 === 0 && x2 === w - 1 && y2 === h - 1) { toast('No hay espacio vacío para recortar'); return; }
    const nw = x2 - x1 + 1, nh = y2 - y1 + 1;
    const out = document.createElement('canvas'); out.width = nw; out.height = nh;
    out.getContext('2d').drawImage(c, x1, y1, nw, nh, 0, 0, nw, nh);
    const sx = n.width() / w, sy = n.height() / h;
    const rot = (n.rotation() * Math.PI) / 180;
    const ox = x1 * sx, oy = y1 * sy;
    const up = await uploadBlob(await canvasToBlob(out), 'logo.png');
    S.assets.set(up.id, out);
    n.setAttrs({
      image: out, assetId: up.id, origAssetId: up.id, fx: {}, palette: [],
      x: n.x() + (ox * Math.cos(rot) - oy * Math.sin(rot)) * Math.sign(n.scaleX() || 1),
      y: n.y() + (ox * Math.sin(rot) + oy * Math.cos(rot)) * Math.sign(n.scaleY() || 1),
      width: nw * sx, height: nh * sy,
    });
    content.batchDraw(); tr.forceUpdate(); commit(); renderProps();
    toast('Espacio vacío recortado');
  }
  async function restoreOriginal(n) {
    const root = n.getAttr('rootAssetId') || n.getAttr('origAssetId');
    const img = await loadAsset(root);
    const w = n.width();
    n.setAttrs({ image: img, assetId: root, origAssetId: root, fx: {}, palette: [], height: w * (ih(img) / iw(img)) });
    content.batchDraw(); tr.forceUpdate(); commit(); renderProps();
  }

  /* ---------- acciones sobre selección ---------- */
  const withSel = (fn) => { const s = selected(); if (!s.length) return; fn(s); content.batchDraw(); tr.forceUpdate(); commit(); renderProps(); };
  function align(mode) {
    withSel((s) => {
      const ref = s.length > 1 ? unionRect(s) : { x: 0, y: 0, width: pageW(), height: pageH() };
      s.forEach((n) => {
        const r = rectOf(n);
        const d = { l: [ref.x - r.x, 0], ch: [ref.x + ref.width / 2 - (r.x + r.width / 2), 0], r: [ref.x + ref.width - (r.x + r.width), 0], t: [0, ref.y - r.y], cv: [0, ref.y + ref.height / 2 - (r.y + r.height / 2)], b: [0, ref.y + ref.height - (r.y + r.height)] }[mode];
        moveBy([n], d[0], d[1]);
      });
    });
  }
  function order(how) {
    withSel((s) => {
      const list = how === 'front' || how === 'up' ? s.slice().sort((a, b) => b.zIndex() - a.zIndex()) : s.slice().sort((a, b) => a.zIndex() - b.zIndex());
      list.forEach((n) => ({ front: () => n.moveToTop(), back: () => n.moveToBottom(), up: () => n.moveUp(), down: () => n.moveDown() }[how]()));
    });
  }
  function flip(axis) {
    withSel((s) => s.forEach((n) => {
      const r0 = rectOf(n);
      axis === 'h' ? n.scaleX(-n.scaleX()) : n.scaleY(-n.scaleY());
      const r1 = rectOf(n);
      n.position({ x: n.x() + (r0.x + r0.width / 2 - (r1.x + r1.width / 2)), y: n.y() + (r0.y + r0.height / 2 - (r1.y + r1.height / 2)) });
    }));
  }
  function duplicate() {
    const s = selected(); if (!s.length) return;
    const copies = s.map((n) => { const c = n.clone({ x: n.x() + px(0.6), y: n.y() + px(0.6) }); c.setAttr('label', (n.getAttr('label') || 'Capa') + ' copia'); return c; });
    copies.forEach((c) => content.add(c));
    content.batchDraw(); select(copies); commit();
  }
  function remove() {
    const s = selected(); if (!s.length) return;
    s.forEach((n) => n.destroy());
    select([]); content.batchDraw(); commit();
  }
  function groupSel() {
    const s = selected().slice().sort((a, b) => a.zIndex() - b.zIndex());
    if (s.length < 2) { toast('Elegí al menos dos elementos'); return; }
    const g = new Konva.Group(baseAttrs({ kind: 'group', label: 'Grupo' }));
    const z = s[s.length - 1].zIndex();
    content.add(g);
    s.forEach((n) => { n.draggable(false); n.moveTo(g); });
    g.zIndex(Math.min(z, content.getChildren().length - 1));
    content.batchDraw(); select([g]); commit();
  }
  function ungroupSel() {
    const s = selected().filter((n) => n.getClassName() === 'Group');
    if (!s.length) { toast('Elegí un grupo'); return; }
    const out = [];
    s.forEach((g) => {
      g.getChildren().slice().forEach((ch) => {
        const t = ch.getAbsoluteTransform(content).copy();
        ch.moveTo(content); ch.setAttrs(t.decompose()); ch.draggable(true); out.push(ch);
      });
      g.destroy();
    });
    content.batchDraw(); select(out); commit();
  }
  function toggleLock(n) {
    const lock = !n.getAttr('locked');
    n.setAttrs({ locked: lock, draggable: !lock, listening: !lock });
    if (lock && isSel(n)) select(selected().filter((x) => x !== n));
    commit();
  }
  function toggleVisible(n) {
    n.visible(!n.visible());
    if (!n.visible() && isSel(n)) select(selected().filter((x) => x !== n));
    content.batchDraw(); commit();
  }
  function copySel() { const s = selected(); if (s.length) { S.clipboard = s.map(serializeNode); toast('Copiado'); } }
  async function pasteSel() {
    if (!S.clipboard) return;
    const added = [];
    for (const o of S.clipboard) {
      const n = await build(JSON.parse(JSON.stringify(o)));
      n.position({ x: n.x() + px(0.8), y: n.y() + px(0.8) });
      content.add(n); added.push(n);
    }
    S.clipboard = S.clipboard.map((o) => ({ ...o, a: { ...o.a, x: (o.a.x || 0) + px(0.8), y: (o.a.y || 0) + px(0.8) } }));
    content.batchDraw(); select(added); commit();
  }

  /* ---------- exportación ---------- */
  function renderArtboard({ dpi = 300, bg = 'transparent', bgColor = '#ffffff', trim = false, mime = 'image/png', maxSide = MAX_EXPORT_PX, keepSelection = false }) {
    const prev = { sc: stage.scale(), pos: stage.position(), sel: selected() };
    tr.nodes([]); guides.destroyChildren();
    bgLayer.visible(false); ui.visible(false);
    stage.scale({ x: 1, y: 1 }); stage.position({ x: 0, y: 0 });
    const W = pageW(), H = pageH();
    let ratio = (dpi / 2.54) / PX_CM;
    ratio = Math.min(ratio, maxSide / Math.max(W, H));
    let tmp = null;
    if (bg !== 'transparent') {
      tmp = new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: bg === 'white' ? '#ffffff' : bgColor, listening: false });
      content.add(tmp); tmp.moveToBottom();
    }
    let canvas;
    try {
      content.clip({ x: 0, y: 0, width: W, height: H });
      canvas = stage.toCanvas({ x: 0, y: 0, width: W, height: H, pixelRatio: ratio });
    } finally {
      content.clip(null);
      if (tmp) tmp.destroy();
      bgLayer.visible(true); ui.visible(true);
      stage.scale(prev.sc); stage.position(prev.pos);
      if (keepSelection) tr.nodes(prev.sel);
      stage.batchDraw();
    }
    let outW = canvas.width, outH = canvas.height, pxPerCm = canvas.width / S.doc.widthCm;
    if (trim) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let x1 = canvas.width, y1 = canvas.height, x2 = -1, y2 = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 6) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
      if (x2 >= 0) {
        const c2 = document.createElement('canvas'); c2.width = x2 - x1 + 1; c2.height = y2 - y1 + 1;
        c2.getContext('2d').drawImage(canvas, x1, y1, c2.width, c2.height, 0, 0, c2.width, c2.height);
        canvas = c2; outW = c2.width; outH = c2.height;
      }
    }
    return { canvas, width: outW, height: outH, widthCm: outW / pxPerCm, heightCm: outH / pxPerCm, mime };
  }
  async function doExport(opts) {
    await settle();
    const r = renderArtboard({ dpi: opts.dpi, bg: opts.bg, bgColor: S.doc.bgColor, trim: opts.trim, mime: opts.mime });
    const blob = await canvasToBlob(r.canvas, opts.mime, 0.95);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (S.doc.name || 'logo').replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]+/g, '').trim().replace(/\s+/g, '-') + (opts.mime === 'image/jpeg' ? '.jpg' : '.png');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`Exportado: ${r.width} × ${r.height} px (${round(r.widthCm, 1)} × ${round(r.heightCm, 1)} cm)`);
  }
  async function exportDialog() {
    if (!objs().length) { toast('El lienzo está vacío', true); return; }
    const body = `
      <div class="row c2">
        <label class="field">Formato<select id="exFmt"><option value="image/png">PNG (admite transparencia)</option><option value="image/jpeg">JPG</option></select></label>
        <label class="field">Resolución<select id="exDpi"><option value="150">150 dpi · pantalla</option><option value="300" selected>300 dpi · impresión</option><option value="600">600 dpi · máxima</option></select></label>
      </div>
      <div class="row c2">
        <label class="field">Fondo<select id="exBg"><option value="transparent">Transparente</option><option value="white">Blanco</option><option value="color">Color del lienzo</option></select></label>
        <label class="field">Área<select id="exTrim"><option value="0">Todo el lienzo</option><option value="1">Recortar al contenido</option></select></label>
      </div>
      <p class="note" id="exInfo"></p>`;
    const read = () => ({ mime: $('exFmt').value, dpi: +$('exDpi').value, bg: $('exBg').value, trim: $('exTrim').value === '1' });
    let last = null;
    const info = () => {
      const o = read();
      if (o.mime === 'image/jpeg' && o.bg === 'transparent') $('exBg').value = 'white';
      const ratio = Math.min((o.dpi / 2.54) / PX_CM, MAX_EXPORT_PX / Math.max(pageW(), pageH()));
      $('exInfo').textContent = `Lienzo de ${round(S.doc.widthCm, 1)} × ${round(S.doc.heightCm, 1)} cm → ${Math.round(pageW() * ratio)} × ${Math.round(pageH() * ratio)} px${o.trim ? ' (se recorta al contenido)' : ''}.`;
    };
    const ready = modal({ title: 'Exportar diseño', body, actions: [{ label: 'Cancelar', value: false }, { label: 'Descargar', primary: true, value: 'go' }], narrow: true });
    ['exFmt', 'exDpi', 'exBg', 'exTrim'].forEach((id) => $(id).addEventListener('change', info));
    info();
    const watcher = setInterval(() => { if ($('exFmt')) last = read(); }, 100);
    const result = await ready;
    clearInterval(watcher);
    if (result === 'go' && last) doExport(last);
  }

  /* ---------- usar en una propuesta (guarda el logo en la ficha del cliente) ---------- */
  async function useInProposal() {
    if (!objs().length) { toast('El lienzo está vacío', true); return; }
    if (!S.clients.length) { toast('Todavía no hay clientes cargados en el panel.', true); return; }
    const body = `<p class="note" style="margin-top:0">Se guarda un <b>PNG con fondo transparente, recortado al contenido</b>, en la ficha del cliente. Después lo elegís en el Editor visual del panel al armar la prenda.</p>
      <label class="field">Cliente<select id="ucClient">${S.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === S.doc.clientId ? 'selected' : ''}>${esc(c.company)}</option>`).join('')}</select></label>
      <label class="field" style="margin-top:10px">Nombre del logo<input type="text" id="ucName" value="${esc(S.doc.name)}" maxlength="120"></label>`;
    let last = null;
    const ready = modal({ title: 'Usar en una propuesta', body, actions: [{ label: 'Cancelar', value: false }, { label: 'Guardar en la ficha del cliente', primary: true, value: 'go' }], narrow: true });
    const watcher = setInterval(() => { if ($('ucClient')) last = { clientId: $('ucClient').value, name: $('ucName').value.trim() || 'Logo' }; }, 100);
    const result = await ready;
    clearInterval(watcher);
    if (result !== 'go' || !last) return;
    try {
      await settle();
      let dpi = 150, data = '';
      for (const tryDpi of [150, 100, 72]) {
        dpi = tryDpi;
        data = renderArtboard({ dpi, bg: 'transparent', trim: true, maxSide: 1600 }).canvas.toDataURL('image/png');
        if (data.length < 2600000) break;
      }
      if (data.length >= 2600000) throw new Error('El logo es demasiado pesado. Reducí el tamaño del lienzo o los colores.');
      await http('api.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': BOOT.csrf }, body: JSON.stringify({ action: 'add_client_logo', clientId: last.clientId, name: last.name, dataUrl: data }) });
      S.doc.clientId = last.clientId; markDirty(); renderProps();
      const cname = (S.clients.find((c) => c.id === last.clientId) || {}).company || 'el cliente';
      modal({ title: 'Logo guardado', body: `<p>«${esc(last.name)}» quedó en la ficha de <b>${esc(cname)}</b> (${dpi} dpi, fondo transparente).</p><p class="note">Abrí el panel, entrá al <b>Editor visual</b> de una propuesta de ese cliente y elegilo en «Logos del cliente».</p>`, actions: [{ label: 'Seguir acá', value: false }, { label: 'Ir al panel', primary: true, value: 'panel' }], narrow: true }).then((v) => { if (v === 'panel') location.href = './'; });
    } catch (e) { toast(e.message, true); }
  }

  /* ---------- ficha imprimible del logo ---------- */
  function palette(canvas, n = 6) {
    const w = Math.min(160, canvas.width), h = Math.max(1, Math.round(canvas.height * (w / canvas.width)));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0, w, h);
    const { data } = g.getImageData(0, 0, w, h), bins = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; bins.set(k, b);
    }
    const total = [...bins.values()].reduce((s, b) => s + b.n, 0) || 1;
    return [...bins.values()].sort((a, b) => b.n - a.n).slice(0, n).map((b) => ({ hex: '#' + [b.r, b.g, b.b].map((v) => Math.round(v / b.n).toString(16).padStart(2, '0')).join(''), pct: Math.round((b.n / total) * 100) })).filter((p) => p.pct >= 2);
  }
  function printSheet(info) {
    const win = window.open('', '_blank');
    if (!win) { toast('Habilitá las ventanas emergentes para imprimir.', true); return; }
    const client = (S.clients.find((c) => c.id === S.doc.clientId) || {}).company || '—';
    const cmTxt = (n) => String(round(n, 1)).replace('.', ',');
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${esc(location.href.replace(/[^/]*$/, ''))}"><title>Ficha de logo</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font:12px Arial,sans-serif;color:#2b241f}.sheet{max-width:186mm;margin:auto}
      header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b77a2b;padding-bottom:4mm}header img{width:60mm}header div{text-align:right}h1{margin:0;font-size:19px}small{color:#6b5a4a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm}.box{border:1px solid #cdbfa6;border-radius:2mm;padding:4mm}.box h2{margin:0 0 3mm;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a5a20}
      .logo{display:grid;place-items:center;min-height:62mm;background:repeating-conic-gradient(#f1ece2 0 25%,#fff 0 50%) 0 0/8mm 8mm}.logo img{max-width:100%;max-height:60mm}
      table{width:100%;border-collapse:collapse}td{padding:2mm 0;border-bottom:1px solid #e3d9c6}td:last-child{text-align:right;font-weight:700}
      .sw{display:flex;gap:3mm;flex-wrap:wrap}.sw span{display:flex;align-items:center;gap:2mm;font-size:11px}.sw i{width:9mm;height:9mm;border-radius:50%;border:1px solid #999;display:block}
      .mock{position:relative;width:100%;aspect-ratio:1/1;background:#fff;border:1px solid #e3d9c6;border-radius:2mm;overflow:hidden}.mock .base,.mock svg{position:absolute;inset:6%;width:88%;height:88%;object-fit:contain}.mock .art{position:absolute;transform:translate(-50%,-50%)}
      .sign{display:flex;gap:10mm;margin-top:14mm}.sign div{flex:1;border-top:1px solid #333;padding-top:2mm;font-size:11px}footer{margin-top:8mm;color:#6b5a4a;font-size:10px}
    </style></head><body><div class="sheet"><header><img src="assets/brand/uniforma-logo-print.jpg" alt="UNIFORMA"><div><small>FICHA DE LOGO</small><h1>${esc(S.doc.name)}</h1><small>Cliente: ${esc(client)} · ${new Date().toLocaleDateString('es-AR')}</small></div></header>
      <div class="grid"><div class="box"><h2>Logo (fondo transparente)</h2><div class="logo"><img src="${info.logo}" alt="Logo"></div></div>
      <div class="box"><h2>Vista a escala real en la prenda</h2><div class="mock">${info.garment}</div></div>
      <div class="box"><h2>Medidas</h2><table><tr><td>Ancho del logo</td><td>${cmTxt(info.widthCm)} cm</td></tr><tr><td>Alto del logo</td><td>${cmTxt(info.heightCm)} cm</td></tr><tr><td>Ubicación</td><td>${esc(info.place)}</td></tr><tr><td>Prenda de referencia</td><td>${esc(info.product)}</td></tr><tr><td>Ancho de prenda usado</td><td>${cmTxt(info.garmentCm)} cm</td></tr></table></div>
      <div class="box"><h2>Colores detectados</h2><div class="sw">${info.colors.map((c) => `<span><i style="background:${c.hex}"></i>${c.hex.toUpperCase()} · ${c.pct}%</span>`).join('') || 'Sin datos'}</div><p style="margin:4mm 0 0;color:#6b5a4a">Técnica: ____________ &nbsp; N.º de hilos / tintas: ______</p></div></div>
      <div class="sign"><div>Aprobó el cliente (nombre y firma)</div><div>Fecha</div></div><footer>UNIFORMA · Ficha de referencia para taller y cliente. Los colores pueden variar según el material.</footer></div>
      <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})<\/script></body></html>`);
    win.document.close();
  }

  /* ---------- vista previa en prenda ---------- */
  const TEE_SVG = '<svg class="tee" viewBox="0 0 200 200" aria-hidden="true"><path id="teeBody" d="M70 14c8 14 52 14 60 0l46 20 20 42-30 14-8-18v108H42V72l-8 18L4 76l20-42z" fill="#f4f4f2" stroke="rgba(0,0,0,.18)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const PLACEMENTS = { 'Pecho izquierdo': [64, 32], 'Centro pecho': [50, 34], 'Centro espalda': [50, 36], 'Espalda alta': [50, 22], 'Manga': [86, 28] };
  async function openPreview() {
    if (!objs().length) { toast('El lienzo está vacío', true); return; }
    await settle();
    const art = renderArtboard({ dpi: 200, bg: 'transparent', trim: true, maxSide: 2400 });
    const url = art.canvas.toDataURL('image/png');
    const st = { product: '', face: 'front', place: 'Centro pecho', garmentCm: 52, color: '#f4f4f2', widthCm: round(art.widthCm, 1) };
    const colors = ['#f4f4f2', '#1f1f23', '#5b5f66', '#1c2a4a', '#9c1f2b', '#d9c9a8', '#2f5d3a'];
    const body = `
      <div class="preview">
        <div class="garment" id="pvGarment"><div id="pvBase"></div><div class="zone" id="pvZone"></div><img class="art" id="pvArt" src="${url}" alt="" /></div>
        <div>
          <label class="field">Prenda<select id="pvProduct"><option value="">Remera genérica</option>${S.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
          <div class="row" style="margin-top:8px"><div class="seg" id="pvFace"><button data-v="front" class="on" style="padding:7px">Frente</button><button data-v="back" style="padding:7px">Espalda</button></div></div>
          <label class="field">Ubicación<select id="pvPlace">${Object.keys(PLACEMENTS).map((k) => `<option ${k === st.place ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <div class="row c2" style="margin-top:8px">
            <label class="field">Ancho del logo (cm)<input type="number" id="pvW" min="1" max="60" step="0.5" value="${st.widthCm}"></label>
            <label class="field">Ancho de prenda (cm)<input type="number" id="pvG" min="30" max="90" step="1" value="52"></label>
          </div>
          <div id="pvColors"><span class="note">Color de la prenda genérica</span><div class="chips" style="margin-top:6px">${colors.map((c) => `<button class="chip" data-c="${c}" style="background:${c};width:28px;height:28px;padding:0;border-radius:50%"></button>`).join('')}</div></div>
          <p class="note">El logo se muestra a escala real sobre la prenda, útil para validar tamaño y contraste. Es una referencia visual, no el mockup final.</p>
        </div>
      </div>`;
    const p = modal({ title: 'Vista previa en prenda', body, actions: [{ label: 'Imprimir ficha', value: 'print' }, { label: 'Cerrar', value: true, primary: true }] });
    let snapshot = null;
    const snap = () => {
      const g = $('pvGarment'), artEl = $('pvArt'); if (!g || !artEl) return;
      const base = $('pvBase');
      snapshot = {
        garment: (base ? base.outerHTML.replace('id="pvBase"', '').replace(/class="base"/, 'class="base"') : '') + `<img class="art" src="${url}" alt="" style="width:${artEl.style.width};left:${artEl.style.left};top:${artEl.style.top}">`,
        place: st.place, widthCm: st.widthCm, heightCm: st.widthCm * (artEl.naturalHeight / Math.max(1, artEl.naturalWidth)), garmentCm: st.garmentCm,
        product: (S.products.find((x) => x.id === st.product) || {}).name || 'Remera genérica', logo: url, colors: palette(trimmedCanvas),
      };
    };
    const trimmedCanvas = art.canvas;
    const snapTimer = setInterval(snap, 250);
    const draw = () => {
      const prod = S.products.find((x) => x.id === st.product);
      const src = prod ? (st.face === 'back' && prod.imageBack ? prod.imageBack : prod.image) : '';
      $('pvBase').outerHTML = src ? `<img class="base" id="pvBase" src="${esc(src)}" alt="" onerror="this.style.display='none'">` : `<div id="pvBase">${TEE_SVG}</div>`;
      const tee = document.getElementById('teeBody'); if (tee) tee.setAttribute('fill', st.color);
      $('pvColors').style.display = src ? 'none' : '';
      const [x, y] = PLACEMENTS[st.place];
      const share = 0.72;
      const wPct = (st.widthCm / st.garmentCm) * share * 100;
      const art = $('pvArt'); art.style.width = wPct + '%'; art.style.left = x + '%';
      const hPct = (wPct * art.naturalHeight / Math.max(1, art.naturalWidth));
      art.style.top = (y + hPct / 2) + '%';
      const z = $('pvZone'); z.style.width = (10 / st.garmentCm) * share * 100 + '%'; z.style.height = (3 / st.garmentCm) * share * 100 + '%'; z.style.left = x + '%'; z.style.top = (y + (3 / st.garmentCm) * share * 50) + '%';
      z.style.display = 'none';
    };
    const root = $('modal');
    root.addEventListener('input', (e) => {
      if (e.target.id === 'pvProduct') st.product = e.target.value;
      if (e.target.id === 'pvPlace') { st.place = e.target.value; st.face = /espalda/i.test(st.place) ? 'back' : 'front'; document.querySelectorAll('#pvFace button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.face)); }
      if (e.target.id === 'pvW') st.widthCm = Math.max(1, num(e.target.value, 10));
      if (e.target.id === 'pvG') st.garmentCm = Math.max(30, num(e.target.value, 52));
      draw();
    });
    root.addEventListener('click', (e) => {
      const f = e.target.closest('#pvFace button'); if (f) { st.face = f.dataset.v; document.querySelectorAll('#pvFace button').forEach((b) => b.classList.toggle('on', b === f)); draw(); }
      const c = e.target.closest('[data-c]'); if (c) { st.color = c.dataset.c; draw(); }
    });
    $('pvArt').addEventListener('load', draw);
    draw();
    const choice = await p;
    clearInterval(snapTimer);
    if (choice === 'print' && snapshot) printSheet(snapshot);
  }

  /* ---------- guardado / proyectos ---------- */
  async function settle() { if (S.finishEdit) S.finishEdit(true); while (S.pending.size) await Promise.allSettled([...S.pending]); }
  function renderStatus() {
    const el = $('saveStatus'); if (!el) return;
    el.className = 'status' + (S.saving ? '' : S.dirty ? ' dirty' : '');
    el.textContent = S.saving ? 'Guardando…' : S.dirty ? 'Cambios sin guardar' : S.lastSavedAt ? 'Guardado ' + S.lastSavedAt : 'Sin guardar';
  }
  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    if (!S.projectId) return;
    autosaveTimer = setTimeout(() => { if (S.dirty && !S.saving) save().catch(() => {}); }, 6000);
  }
  async function save(asCopy = false) {
    if (S.saving) return;
    await settle();
    S.saving = true; renderStatus();
    try {
      const thumbCanvas = renderArtboard({ dpi: 40, bg: 'transparent', maxSide: 240, keepSelection: true }).canvas;
      const r = await apiPost('save', {
        id: asCopy ? '' : S.projectId, baseRev: asCopy ? undefined : S.rev || undefined,
        name: asCopy ? S.doc.name + ' (copia)' : S.doc.name, clientId: S.doc.clientId, doc: serialize(), thumb: thumbCanvas.toDataURL('image/png'),
      });
      if (asCopy) S.doc.name += ' (copia)';
      S.projectId = r.id; S.rev = r.rev; S.dirty = false;
      S.lastSavedAt = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      toast('Proyecto guardado');
      loadProjects();
    } catch (e) {
      toast(e.message, true);
      if (e.conflict) S.dirty = true;
    } finally { S.saving = false; renderStatus(); renderTop(); }
  }
  async function loadProjects() {
    try { S.projects = (await apiGet('list')).projects; } catch (e) { /* silencioso */ }
    if (S.leftTab === 'projects') renderLeft();
  }
  async function openProject(id) {
    if (S.dirty && !(await modal({ title: '¿Descartar cambios?', body: '<p>Tenés cambios sin guardar en el diseño actual.</p>', actions: [{ label: 'Cancelar', value: false }, { label: 'Abrir igual', primary: true, value: true }], narrow: true }))) return;
    try {
      const { project } = await apiGet('project', { id });
      S.projectId = project.id; S.rev = project.rev; S.doc.name = project.name; S.doc.clientId = project.clientId || '';
      await loadDoc(project.doc);
      S.dirty = false; S.lastSavedAt = ''; renderStatus(); renderTop(); renderProps();
      S.leftTab = 'layers'; renderLeft();
      toast('Proyecto abierto');
    } catch (e) { toast(e.message, true); }
  }
  async function newProject() {
    if (S.dirty && !(await modal({ title: '¿Descartar cambios?', body: '<p>Tenés cambios sin guardar en el diseño actual.</p>', actions: [{ label: 'Cancelar', value: false }, { label: 'Nuevo igual', primary: true, value: true }], narrow: true }))) return;
    S.projectId = ''; S.rev = 0; S.doc.name = 'Logo sin título'; S.doc.clientId = '';
    await loadDoc({ widthCm: 20, heightCm: 20, bg: 'transparent', bgColor: '#ffffff', nodes: [] });
    S.dirty = false; S.lastSavedAt = ''; renderStatus(); renderTop(); renderProps();
  }
  async function deleteProject(id, name) {
    if (!(await modal({ title: 'Eliminar proyecto', body: `<p>«${esc(name)}» se mueve a la papelera del estudio. Los archivos no se pierden.</p>`, actions: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', danger: true, value: true }], narrow: true }))) return;
    try { await apiPost('delete', { id }); if (id === S.projectId) { S.projectId = ''; S.rev = 0; S.dirty = true; } toast('Proyecto eliminado'); loadProjects(); renderStatus(); } catch (e) { toast(e.message, true); }
  }

  /* ---------- herramientas ---------- */
  function setTool(t) {
    S.tool = t; S.pickMode = false;
    host.classList.toggle('pan', t === 'hand');
    renderRail(); renderHint();
  }
  function renderHint() {
    const h = $('hint');
    h.textContent = S.pickMode ? 'Hacé clic sobre el color que querés quitar' : S.tool === 'hand' ? 'Arrastrá para mover el lienzo' : 'Clic para elegir · Shift suma · Doble clic edita texto · Ctrl+rueda zoom · Espacio+arrastrar mueve';
  }
  function renderRail() {
    const b = (id, icon, tip, on) => `<button data-tool="${id}" data-tip="${tip}" class="${on ? 'on' : ''}" aria-label="${tip}">${ic(icon)}</button>`;
    $('rail').innerHTML = b('select', 'select', 'Seleccionar (V)', S.tool === 'select') + b('hand', 'hand', 'Mover lienzo (H)', S.tool === 'hand') + '<div class="rail-sep"></div>' +
      b('image', 'image', 'Subir imagen (I)') + b('text', 'text', 'Texto (T)') +
      `<div style="position:relative">${b('shapes', 'shapes', 'Formas', S.shapesOpen)}${S.shapesOpen ? `<div class="shapes-pop">${SHAPES.map(([k, l]) => `<button data-shape="${k}" data-tip="${l}" aria-label="${l}">${ic(k === 'rect' ? 'rect' : k)}</button>`).join('')}</div>` : ''}</div>` +
      '<div class="rail-sep"></div>' + b('help', 'help', 'Atajos de teclado (?)');
  }
  function renderTop() {
    $('topbar').innerHTML = `
      <a class="brand" href="./" title="Volver al panel">${ic('back2')}<span>Panel</span></a>
      <a class="brand" style="border:0;padding:0" href="estudio.php" aria-label="Estudio de logos">${ic('wand')}<span>Estudio de logos</span></a>
      <input class="name" id="docName" value="${esc(S.doc.name)}" maxlength="120" aria-label="Nombre del proyecto" />
      <span class="spacer"></span>
      <span class="status" id="saveStatus"></span>
      <button class="btn icon ghost" data-top="undo" ${S.hIndex <= 0 ? 'disabled' : ''} title="Deshacer (Ctrl+Z)">${ic('undo')}</button>
      <button class="btn icon ghost" data-top="redo" ${S.hIndex >= S.history.length - 1 ? 'disabled' : ''} title="Rehacer (Ctrl+Shift+Z)">${ic('redo')}</button>
      <span class="sep"></span>
      <button class="btn" data-top="preview">${ic('shirt')}Ver en prenda</button>
      <button class="btn" data-top="export">${ic('download')}Exportar</button>
      <button class="btn" data-top="client" title="Guardar el logo en la ficha de un cliente para usarlo en sus propuestas">${ic('send')}Usar en propuesta</button>
      <button class="btn primary" data-top="save">${ic('save')}Guardar</button>`;
    renderStatus();
  }

  /* ---------- panel izquierdo: capas / proyectos ---------- */
  function layerThumb(n) {
    const k = kindOf(n);
    if (k === 'image') return `<span class="thumb" style="background-image:url('studio-api.php?action=asset&id=${encodeURIComponent(n.getAttr('assetId') || '')}')"></span>`;
    if (k === 'text') return '<span class="thumb">T</span>';
    if (k === 'group') return `<span class="thumb">${ic('layers').replace('<svg', '<svg width="14" height="14"')}</span>`;
    return `<span class="thumb" style="color:${esc(n.fill && n.fill() || '#5f3d27')}">${ic('rect').replace('<svg', '<svg width="14" height="14" fill="currentColor"')}</span>`;
  }
  function renderLeft() {
    const lp = $('leftpanel');
    const tabs = `<div class="tabs"><button data-tab="layers" class="${S.leftTab === 'layers' ? 'on' : ''}">Capas</button><button data-tab="projects" class="${S.leftTab === 'projects' ? 'on' : ''}">Proyectos</button></div>`;
    let body = '';
    if (S.leftTab === 'layers') {
      const list = objs().reverse();
      body = list.length ? list.map((n) => `
        <div class="layer ${isSel(n) ? 'sel' : ''}" draggable="true" data-layer="${n._id}">
          ${layerThumb(n)}
          <input class="lname" value="${esc(n.getAttr('label') || kindOf(n))}" data-rename="${n._id}" aria-label="Nombre de la capa" />
          <span class="acts">
            <button data-lock="${n._id}" class="${n.getAttr('locked') ? 'active' : ''}" title="${n.getAttr('locked') ? 'Desbloquear' : 'Bloquear'}">${ic(n.getAttr('locked') ? 'lock' : 'unlock')}</button>
            <button data-vis="${n._id}" class="${n.visible() ? '' : 'active'}" title="${n.visible() ? 'Ocultar' : 'Mostrar'}">${ic(n.visible() ? 'eye' : 'eyeoff')}</button>
          </span>
        </div>`).join('') : `<div class="empty"><b>Lienzo vacío</b>Subí el logo del cliente o arrastralo acá. También podés pegar una imagen con Ctrl+V.<div style="margin-top:12px"><button class="btn primary" data-tool="image">${ic('image')}Subir logo</button></div></div>`;
    } else {
      const q = ($('projSearch') && $('projSearch').value) || '';
      const clientName = (id) => (S.clients.find((c) => c.id === id) || {}).company || '';
      const items = S.projects.filter((p) => (p.name + ' ' + clientName(p.clientId)).toLowerCase().includes(q.toLowerCase()));
      body = `<div style="display:flex;gap:6px;margin-bottom:8px"><input class="lname" style="flex:1;background:#fff;border:1px solid var(--line-strong);padding:7px 8px;border-radius:6px" id="projSearch" placeholder="Buscar proyecto o cliente…" value="${esc(q)}" /><button class="btn sm" data-top="new">${ic('plus').replace('<svg', '<svg width="14" height="14"')}Nuevo</button></div>` +
        (items.length ? items.map((p) => `<div class="proj ${p.id === S.projectId ? 'cur' : ''}" data-open="${p.id}"><span class="pt" style="background-image:url('studio-api.php?action=thumb&id=${p.id}')"></span><div><b>${esc(p.name)}</b><small>${esc(clientName(p.clientId) || 'Sin cliente')}</small><small>${round(p.widthCm, 1)} × ${round(p.heightCm, 1)} cm · ${esc((p.updatedAt || '').slice(0, 10))}</small></div><button class="del" data-del="${p.id}" data-name="${esc(p.name)}" title="Eliminar">${ic('trash')}</button></div>`).join('') : `<div class="empty"><b>${S.projects.length ? 'Sin resultados' : 'Todavía no hay proyectos'}</b>Guardá tu diseño con el botón Guardar y lo vas a encontrar acá.</div>`);
    }
    const keep = lp.querySelector('.tabbody'); const scroll = keep ? keep.scrollTop : 0;
    lp.innerHTML = tabs + `<div class="tabbody">${body}</div>`;
    const nb = lp.querySelector('.tabbody'); if (nb) nb.scrollTop = scroll;
  }

  /* ---------- panel de propiedades ---------- */
  const fld = (label, inner, extra = '') => `<label class="field" ${extra}>${label}${inner}</label>`;
  const numIn = (k, v, o = {}) => `<input type="number" data-k="${k}" value="${v}" step="${o.step || 0.1}" ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.max !== undefined ? `max="${o.max}"` : ''} ${o.dis ? 'disabled' : ''}>`;
  const segBtn = (act, icon, tip, on) => `<button data-act="${act}" title="${tip}" class="${on ? 'on' : ''}" aria-label="${tip}">${ic(icon)}</button>`;

  function pagePanel() {
    const clientOpts = '<option value="">Sin cliente</option>' + S.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === S.doc.clientId ? 'selected' : ''}>${esc(c.company)}</option>`).join('');
    return `
      <h3>Lienzo</h3>
      <div class="row c2">${fld('Ancho (cm)', numIn('pageW', round(S.doc.widthCm, 2), { min: 1, max: 120 }))}${fld('Alto (cm)', numIn('pageH', round(S.doc.heightCm, 2), { min: 1, max: 120 }))}</div>
      <div class="chips" style="margin-bottom:10px">${PRESETS.map(([l, w, h]) => `<button class="chip ${S.doc.widthCm === w && S.doc.heightCm === h ? 'on' : ''}" data-preset="${w}x${h}">${l}</button>`).join('')}</div>
      <h3>Fondo de trabajo</h3>
      <div class="seg" style="margin-bottom:8px"><button data-bg="transparent" class="${S.doc.bg === 'transparent' ? 'on' : ''}" style="padding:7px">Transparente</button><button data-bg="white" class="${S.doc.bg === 'white' ? 'on' : ''}" style="padding:7px">Blanco</button><button data-bg="color" class="${S.doc.bg === 'color' ? 'on' : ''}" style="padding:7px">Color</button></div>
      ${S.doc.bg === 'color' ? fld('Color', `<input type="color" data-k="bgColor" value="${S.doc.bgColor}">`) : '<p class="note">Probá el logo sobre un fondo oscuro con «Color» para ver cómo se lee en la prenda.</p>'}
      <h3>Ayudas</h3>
      <label class="check"><input type="checkbox" data-k="snap" ${S.doc.snap ? 'checked' : ''}> Imantar a bordes, centro y otros elementos</label>
      <label class="check"><input type="checkbox" data-k="grid" ${S.doc.grid ? 'checked' : ''}> Mostrar cuadrícula de 1 cm</label>
      <h3>Cliente</h3>
      ${fld('Vincular proyecto a', `<select data-k="clientId">${clientOpts}</select>`)}
      <p class="note">Elegí un elemento del lienzo para editar su tamaño, color y efectos. El tamaño se expresa en <b>centímetros reales</b>.</p>`;
  }
  function commonPanel(s) {
    const single = s.length === 1, n = s[0];
    const r = single ? rectOf(n) : unionRect(s);
    const d = single ? dimsOf(n) : { w: r.width, h: r.height };
    const textLike = single && n.getClassName() === 'Text';
    return `
      <h3>Posición y tamaño</h3>
      <div class="row c2">${fld('X (cm)', numIn('x', round(cm(r.x))))}${fld('Y (cm)', numIn('y', round(cm(r.y))))}</div>
      <div class="row" style="grid-template-columns:1fr 1fr 34px">${fld('Ancho (cm)', numIn('w', round(cm(d.w)), { min: 0.1, dis: !single }))}${fld(textLike ? 'Alto (auto)' : 'Alto (cm)', numIn('h', round(cm(d.h)), { min: 0.1, dis: !single || textLike }))}<button class="btn icon ghost lockbtn ${S.lockRatio ? 'on' : ''}" data-act="ratio" title="Mantener proporción" ${!single ? 'disabled' : ''}>${ic(S.lockRatio ? 'lock' : 'unlock')}</button></div>
      <div class="row c2">${fld('Rotación (°)', numIn('rotation', single ? round(n.rotation(), 1) : 0, { step: 1, dis: !single }))}${fld(`Opacidad <span class="val" id="opVal">${Math.round((single ? n.opacity() : 1) * 100)}%</span>`, `<input type="range" data-k="opacity" min="0" max="100" value="${Math.round((single ? n.opacity() : 1) * 100)}">`)}</div>
      <h3>Alinear ${s.length > 1 ? 'entre sí' : 'al lienzo'}</h3>
      <div class="seg" style="margin-bottom:8px">${segBtn('al:l', 'alL', 'Izquierda')}${segBtn('al:ch', 'alCH', 'Centro horizontal')}${segBtn('al:r', 'alR', 'Derecha')}${segBtn('al:t', 'alT', 'Arriba')}${segBtn('al:cv', 'alCV', 'Centro vertical')}${segBtn('al:b', 'alB', 'Abajo')}</div>
      <h3>Orden y acciones</h3>
      <div class="seg" style="margin-bottom:8px">${segBtn('ord:front', 'front', 'Traer al frente')}${segBtn('ord:up', 'up', 'Subir una capa')}${segBtn('ord:down', 'down', 'Bajar una capa')}${segBtn('ord:back', 'back', 'Enviar al fondo')}${segBtn('flip:h', 'flipH', 'Voltear horizontal')}${segBtn('flip:v', 'flipV', 'Voltear vertical')}</div>
      <div class="seg">${segBtn('dup', 'copy', 'Duplicar (Ctrl+D)')}${segBtn('group', 'group', 'Agrupar (Ctrl+G)')}${segBtn('ungroup', 'ungroup', 'Desagrupar')}${segBtn('del', 'trash', 'Eliminar (Supr)')}</div>`;
  }
  function imagePanel(n) {
    const fx = n.getAttr('fx') || {};
    const bg = fx.bg;
    const pal = n.getAttr('palette') || [];
    return `
      <h3>Imagen</h3>
      <div class="row"><button class="btn" data-act="autobg">${ic('wand')}${bg ? 'Reaplicar quitar fondo' : 'Quitar fondo automático'}</button></div>
      ${bg ? `
        <div class="row">${fld(`Tolerancia <span class="val">${Math.round(bg.tol)}</span>`, `<input type="range" data-fx="tol" min="1" max="100" value="${bg.tol}">`)}</div>
        <div class="row c2">${fld('Quitar', `<select data-fx="mode"><option value="edge" ${bg.mode === 'edge' ? 'selected' : ''}>Solo el fondo exterior</option><option value="all" ${bg.mode === 'all' ? 'selected' : ''}>Ese color en todo el logo</option></select>`)}<div style="display:flex;align-items:end"><button class="btn sm" data-act="pick" style="width:100%">${ic('picker').replace('<svg', '<svg width="15" height="15"')}Cuentagotas</button></div></div>
        <div class="row"><button class="btn sm" data-act="bgoff">Volver a mostrar el fondo</button></div>` : '<p class="note">Detecta el color de fondo desde los bordes y lo vuelve transparente. Ajustá la tolerancia si quedan restos.</p>'}
      <h3>Para bordado y estampado</h3>
      <div class="row">${fld(`Reducir colores <span class="val">${fx.colors >= 2 ? fx.colors : 'original'}</span>`, `<input type="range" data-fx="colors" min="1" max="8" value="${fx.colors >= 2 ? fx.colors : 1}">`)}</div>
      ${pal.length ? `<div class="chips" style="margin-bottom:8px">${pal.map((c) => `<span class="chip" style="background:${c};width:26px;height:26px;padding:0;border-radius:50%" title="${c}"></span>`).join('')}</div><p class="note">${pal.length} colores de hilo/tinta detectados.</p>` : ''}
      <label class="check"><input type="checkbox" data-fx="tintOn" ${fx.tint ? 'checked' : ''}> Color plano (un solo color)</label>
      ${fx.tint ? fld('Color', `<input type="color" data-fx="tint" value="${fx.tint}">`) : ''}
      <h3>Ajustes</h3>
      <div class="row c2"><button class="btn sm" data-act="trim">${ic('crop').replace('<svg', '<svg width="15" height="15"')}Recortar vacío</button><button class="btn sm" data-act="restore">Imagen original</button></div>`;
  }
  function textPanel(n) {
    const bold = /bold/.test(n.fontStyle()), italic = /italic/.test(n.fontStyle());
    return `
      <h3>Texto</h3>
      <div class="row"><textarea rows="3" data-k="text" style="border:1px solid var(--line-strong);border-radius:6px;padding:7px 8px;resize:vertical;width:100%">${esc(n.text())}</textarea></div>
      <div class="row c2">${fld('Fuente', `<select data-k="fontFamily">${FONTS.map((f) => `<option ${f === n.fontFamily() ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select>`)}${fld('Alto de letra (cm)', numIn('fontCm', round(cm(n.fontSize())), { min: 0.2, step: 0.1 }))}</div>
      <div class="row c2"><div class="seg">${segBtn('bold', 'text', 'Negrita', bold).replace(ic('text'), '<b>N</b>')}${segBtn('italic', 'text', 'Cursiva', italic).replace(ic('text'), '<i>C</i>')}</div><div class="seg"><button data-align="left" class="${n.align() === 'left' ? 'on' : ''}">⇤</button><button data-align="center" class="${n.align() === 'center' ? 'on' : ''}">↔</button><button data-align="right" class="${n.align() === 'right' ? 'on' : ''}">⇥</button></div></div>
      <div class="row c2">${fld('Interletra', numIn('letterSpacing', round(n.letterSpacing(), 1), { step: 0.5 }))}${fld('Interlínea', numIn('lineHeight', round(n.lineHeight(), 2), { step: 0.05, min: 0.6 }))}</div>
      <h3>Color</h3>
      <div class="row c2">${fld('Relleno', `<input type="color" data-k="fill" value="${n.fill() || '#000000'}">`)}${fld('Contorno', `<input type="color" data-k="stroke" value="${n.stroke() || '#000000'}">`)}</div>
      <div class="row">${fld('Grosor del contorno (cm)', numIn('strokeCm', round(cm(n.strokeWidth()), 2), { step: 0.02, min: 0 }))}</div>
      <p class="note">Doble clic sobre el texto para editarlo directamente en el lienzo.</p>`;
  }
  function shapePanel(n) {
    const hasFill = !!n.fill();
    return `
      <h3>Forma</h3>
      <label class="check"><input type="checkbox" data-k="fillOn" ${hasFill ? 'checked' : ''} ${n.getClassName() === 'Line' ? 'disabled' : ''}> Relleno</label>
      ${n.getClassName() === 'Line' ? '' : fld('Color de relleno', `<input type="color" data-k="fill" value="${n.fill() || DEFAULT_FILL}">`)}
      <div class="row c2" style="margin-top:8px">${fld('Contorno', `<input type="color" data-k="stroke" value="${n.stroke() || '#000000'}">`)}${fld('Grosor (cm)', numIn('strokeCm', round(cm(n.strokeWidth()), 2), { step: 0.05, min: 0 }))}</div>
      ${n.getClassName() === 'Rect' ? fld('Esquinas redondeadas (cm)', numIn('radiusCm', round(cm(n.cornerRadius() || 0), 2), { step: 0.1, min: 0 })) : ''}`;
  }
  function renderProps() {
    const p = $('props');
    const s = selected();
    const keepScroll = p.scrollTop;
    if (!s.length) { p.innerHTML = pagePanel(); p.scrollTop = keepScroll; return; }
    let html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><b style="font-family:var(--font-head)">${s.length > 1 ? s.length + ' elementos' : esc(s[0].getAttr('label') || kindOf(s[0]))}</b><button class="btn sm ghost" data-act="deselect">Cerrar</button></div>`;
    if (s.length === 1) {
      const n = s[0], k = kindOf(n);
      if (k === 'image') html += imagePanel(n);
      else if (k === 'text') html += textPanel(n);
      else if (k === 'shape') html += shapePanel(n);
    }
    html += commonPanel(s);
    p.innerHTML = html; p.scrollTop = keepScroll;
  }

  /* ---------- eventos de UI ---------- */
  $('rail').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]'), sh = e.target.closest('[data-shape]');
    if (sh) return addShape(sh.dataset.shape);
    if (!t) return;
    const tool = t.dataset.tool;
    if (tool === 'select' || tool === 'hand') { S.shapesOpen = false; return setTool(tool); }
    if (tool === 'image') { S.shapesOpen = false; renderRail(); return $('fileInput').click(); }
    if (tool === 'text') { S.shapesOpen = false; renderRail(); return addText(); }
    if (tool === 'shapes') { S.shapesOpen = !S.shapesOpen; return renderRail(); }
    if (tool === 'help') return showHelp();
  });
  $('leftpanel').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.leftTab = tab.dataset.tab; if (S.leftTab === 'projects') loadProjects(); return renderLeft(); }
    const tool = e.target.closest('[data-tool]'); if (tool && tool.dataset.tool === 'image') return $('fileInput').click();
    const top = e.target.closest('[data-top="new"]'); if (top) return newProject();
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); return deleteProject(del.dataset.del, del.dataset.name); }
    const open = e.target.closest('[data-open]'); if (open) return openProject(open.dataset.open);
    const lock = e.target.closest('[data-lock]'); if (lock) { const n = objs().find((o) => String(o._id) === lock.dataset.lock); if (n) toggleLock(n); return; }
    const vis = e.target.closest('[data-vis]'); if (vis) { const n = objs().find((o) => String(o._id) === vis.dataset.vis); if (n) toggleVisible(n); return; }
    const row = e.target.closest('[data-layer]');
    if (row && !e.target.closest('input')) {
      const n = objs().find((o) => String(o._id) === row.dataset.layer);
      if (n && n.visible()) { const multi = e.shiftKey || e.ctrlKey || e.metaKey; const cur = selected(); select(multi ? (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]) : [n]); }
    }
  });
  $('leftpanel').addEventListener('change', (e) => {
    const r = e.target.closest('[data-rename]');
    if (r) { const n = objs().find((o) => String(o._id) === r.dataset.rename); if (n) { n.setAttr('label', r.value.trim() || 'Capa'); commit(); renderProps(); } }
  });
  $('leftpanel').addEventListener('input', (e) => { if (e.target.id === 'projSearch') { const v = e.target.value; renderLeft(); const i = $('projSearch'); i.focus(); i.setSelectionRange(v.length, v.length); } });
  let dragLayer = null;
  $('leftpanel').addEventListener('dragstart', (e) => { const row = e.target.closest('[data-layer]'); if (row) { dragLayer = row.dataset.layer; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragLayer); } });
  $('leftpanel').addEventListener('dragover', (e) => {
    const row = e.target.closest('[data-layer]'); if (!row || !dragLayer) return;
    e.preventDefault();
    const b = row.getBoundingClientRect(), before = e.clientY < b.top + b.height / 2;
    document.querySelectorAll('.layer.drop-before,.layer.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));
    row.classList.add(before ? 'drop-before' : 'drop-after');
  });
  $('leftpanel').addEventListener('drop', (e) => {
    const row = e.target.closest('[data-layer]'); if (!row || !dragLayer) return;
    e.preventDefault();
    const b = row.getBoundingClientRect(), before = e.clientY < b.top + b.height / 2;
    const n = objs().find((o) => String(o._id) === dragLayer), t = objs().find((o) => String(o._id) === row.dataset.layer);
    dragLayer = null;
    if (!n || !t || n === t) return renderLeft();
    const arr = objs().filter((o) => o !== n);
    let to = arr.indexOf(t); if (before) to += 1;
    n.zIndex(to); content.batchDraw(); commit();
  });
  $('leftpanel').addEventListener('dragend', () => { dragLayer = null; renderLeft(); });

  $('topbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-top]'); if (!b) return;
    ({ undo, redo, preview: openPreview, export: exportDialog, client: useInProposal, save: () => save() }[b.dataset.top] || (() => {}))();
  });
  $('topbar').addEventListener('input', (e) => { if (e.target.id === 'docName') { S.doc.name = e.target.value; markDirty(); } });
  $('zoombar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    if (b.dataset.z === 'in') setZoom(stage.scaleX() * 1.25); else if (b.dataset.z === 'out') setZoom(stage.scaleX() / 1.25); else if (b.dataset.z === 'fit') fit();
    else if (b.dataset.z === 'grid') { S.doc.grid = !S.doc.grid; drawGrid(); renderZoom(); renderProps(); }
  });

  function setProp(k, raw, phase) {
    const s = selected(), n = s[0];
    const live = phase === 'input';
    const done = () => { content.batchDraw(); tr.forceUpdate(); if (!live) { commit(); renderProps(); } };
    if (!s.length) {
      if (k === 'pageW' || k === 'pageH') { S.doc[k === 'pageW' ? 'widthCm' : 'heightCm'] = clamp(num(raw, 20), 1, 120); applyPage(); if (!live) { fit(); commit(); renderProps(); } return; }
      if (k === 'bgColor') { S.doc.bgColor = raw; applyPage(); if (!live) { commit(); } return; }
      if (k === 'snap') { S.doc.snap = !!raw; return; }
      if (k === 'grid') { S.doc.grid = !!raw; drawGrid(); renderZoom(); return; }
      if (k === 'clientId') { S.doc.clientId = raw; markDirty(); return; }
      return;
    }
    const v = num(raw, NaN);
    if (['x', 'y'].includes(k) && Number.isFinite(v)) {
      const r = s.length > 1 ? unionRect(s) : rectOf(n);
      moveBy(s, k === 'x' ? px(v) - r.x : 0, k === 'y' ? px(v) - r.y : 0); return done();
    }
    if (['w', 'h'].includes(k) && n && Number.isFinite(v) && v > 0) {
      const d = dimsOf(n); let w = d.w, h = d.h;
      if (k === 'w') { w = px(v); if (S.lockRatio) h = d.h * (w / d.w); } else { h = px(v); if (S.lockRatio) w = d.w * (h / d.h); }
      const r0 = rectOf(n);
      setDims(n, w, h);
      const r1 = rectOf(n); n.position({ x: n.x() + (r0.x - r1.x), y: n.y() + (r0.y - r1.y) });
      if (live) { tr.forceUpdate(); content.batchDraw(); return; } return done();
    }
    if (k === 'rotation' && n && Number.isFinite(v)) {
      const r0 = rectOf(n), c0 = { x: r0.x + r0.width / 2, y: r0.y + r0.height / 2 };
      n.rotation(v);
      const r1 = rectOf(n); n.position({ x: n.x() + (c0.x - (r1.x + r1.width / 2)), y: n.y() + (c0.y - (r1.y + r1.height / 2)) });
      return done();
    }
    if (k === 'opacity') { s.forEach((o) => o.opacity(clamp(num(raw, 100), 0, 100) / 100)); const l = $('opVal'); if (l) l.textContent = Math.round(num(raw, 100)) + '%'; content.batchDraw(); if (!live) commit(); return; }
    if (!n) return;
    const m = {
      text: () => n.text(String(raw)), fontFamily: () => n.fontFamily(raw), fontCm: () => Number.isFinite(v) && v > 0 && n.fontSize(px(v)),
      letterSpacing: () => Number.isFinite(v) && n.letterSpacing(v), lineHeight: () => Number.isFinite(v) && n.lineHeight(clamp(v, 0.6, 4)),
      fill: () => n.fill(raw), stroke: () => n.stroke(raw), strokeCm: () => Number.isFinite(v) && n.strokeWidth(px(Math.max(0, v))),
      fillOn: () => n.fill(raw ? (n.getAttr('lastFill') || DEFAULT_FILL) : (n.setAttr('lastFill', n.fill()), null)), radiusCm: () => Number.isFinite(v) && n.cornerRadius(px(Math.max(0, v))),
    }[k];
    if (m) { m(); if (k === 'strokeCm' && v > 0 && !n.stroke()) n.stroke('#000000'); return done(); }
  }
  $('props').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k && ['range', 'color'].includes(t.type)) return setProp(t.dataset.k, t.value, 'input');
    if (t.dataset.k && t.tagName === 'TEXTAREA') return setProp(t.dataset.k, t.value, 'input');
    if (t.dataset.fx) fxInput(t, 'input');
  });
  $('props').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.k) return setProp(t.dataset.k, t.type === 'checkbox' ? t.checked : t.value, 'change');
    if (t.dataset.fx) fxInput(t, 'change');
  });
  function fxInput(t, phase) {
    const n = selected()[0]; if (!n || n.getClassName() !== 'Image') return;
    const fx = JSON.parse(JSON.stringify(n.getAttr('fx') || {}));
    const k = t.dataset.fx;
    if (k === 'tol') { fx.bg = fx.bg || { color: null, tol: 24, mode: 'edge' }; fx.bg.tol = +t.value; }
    else if (k === 'mode') { fx.bg.mode = t.value; }
    else if (k === 'colors') { fx.colors = +t.value >= 2 ? +t.value : 0; }
    else if (k === 'tintOn') { fx.tint = t.checked ? (fx.tint || '#000000') : null; }
    else if (k === 'tint') { fx.tint = t.value; }
    if (phase === 'input') { if (S.fxBusy) return; S.fxBusy = true; applyFx(n, fx, false).finally(() => { S.fxBusy = false; }); const v = t.parentElement && t.parentElement.querySelector('.val'); if (v) v.textContent = k === 'colors' ? (fx.colors >= 2 ? fx.colors : 'original') : Math.round(+t.value); }
    else applyFx(n, fx, true);
  }
  $('props').addEventListener('click', (e) => {
    const n = selected()[0];
    const chip = e.target.closest('[data-preset]');
    if (chip) { const [w, h] = chip.dataset.preset.split('x').map(Number); S.doc.widthCm = w; S.doc.heightCm = h; applyPage(); fit(); commit(); return renderProps(); }
    const bg = e.target.closest('[data-bg]'); if (bg) { S.doc.bg = bg.dataset.bg; applyPage(); commit(); return renderProps(); }
    const al = e.target.closest('[data-align]'); if (al && n) { n.align(al.dataset.align); content.batchDraw(); commit(); return renderProps(); }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act.startsWith('al:')) return align(act.slice(3));
    if (act.startsWith('ord:')) return order(act.slice(4));
    if (act.startsWith('flip:')) return flip(act.slice(5));
    ({
      dup: duplicate, del: remove, group: groupSel, ungroup: ungroupSel, deselect: () => select([]),
      ratio: () => { S.lockRatio = !S.lockRatio; renderProps(); },
      bold: () => { if (!n) return; const b = /bold/.test(n.fontStyle()), i = /italic/.test(n.fontStyle()); n.fontStyle(((i ? 'italic ' : '') + (!b ? 'bold' : '')).trim() || 'normal'); content.batchDraw(); tr.forceUpdate(); commit(); renderProps(); },
      italic: () => { if (!n) return; const b = /bold/.test(n.fontStyle()), i = /italic/.test(n.fontStyle()); n.fontStyle((((!i) ? 'italic ' : '') + (b ? 'bold' : '')).trim() || 'normal'); content.batchDraw(); tr.forceUpdate(); commit(); renderProps(); },
      autobg: () => { const fx = JSON.parse(JSON.stringify(n.getAttr('fx') || {})); fx.bg = { color: (fx.bg && fx.bg.color) || null, tol: fx.bg ? fx.bg.tol : 24, mode: fx.bg ? fx.bg.mode : 'edge' }; applyFx(n, fx, true); },
      bgoff: () => { const fx = JSON.parse(JSON.stringify(n.getAttr('fx') || {})); delete fx.bg; applyFx(n, fx, true); },
      pick: () => { S.pickMode = true; host.style.cursor = 'crosshair'; renderHint(); },
      trim: () => trimImage(n).catch((er) => toast(er.message, true)),
      restore: () => restoreOriginal(n).catch((er) => toast(er.message, true)),
    }[act] || (() => {}))();
  });

  /* ---------- teclado ---------- */
  function showHelp() {
    const rows = [['V / H', 'Seleccionar / mover lienzo'], ['I · T', 'Subir imagen · Texto'], ['Ctrl+Z · Ctrl+Shift+Z', 'Deshacer · Rehacer'], ['Ctrl+D', 'Duplicar'], ['Ctrl+C · Ctrl+V', 'Copiar · Pegar'], ['Ctrl+G · Ctrl+Shift+G', 'Agrupar · Desagrupar'], ['Ctrl+A', 'Seleccionar todo'], ['Supr', 'Eliminar'], ['Flechas · Shift+flechas', 'Mover 1 mm · 1 cm'], ['[ · ]', 'Bajar · Subir capa'], ['Ctrl+rueda · + − 0', 'Zoom · ajustar'], ['Espacio+arrastrar', 'Mover el lienzo'], ['Ctrl+S', 'Guardar']];
    modal({ title: 'Atajos de teclado', body: `<table style="width:100%;border-collapse:collapse;font-size:13px">${rows.map(([k, v]) => `<tr><td style="padding:6px 0;border-bottom:1px solid var(--line);font-weight:700;white-space:nowrap;padding-right:16px">${k}</td><td style="padding:6px 0;border-bottom:1px solid var(--line)">${v}</td></tr>`).join('')}</table>`, actions: [{ label: 'Listo', primary: true, value: true }], narrow: true });
  }
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('modal').hidden) return closeModal();
    if (typing(e) || !$('modal').hidden) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.code === 'Space') { S.spaceDown = true; host.classList.add('pan'); e.preventDefault(); return; }
    if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (ctrl && k === 'y') { e.preventDefault(); return redo(); }
    if (ctrl && k === 's') { e.preventDefault(); return save(); }
    if (ctrl && k === 'd') { e.preventDefault(); return duplicate(); }
    if (ctrl && k === 'c') { return copySel(); }
    if (ctrl && k === 'v') { return; /* lo maneja el evento paste */ }
    if (ctrl && k === 'a') { e.preventDefault(); return select(objs().filter((o) => o.visible() && o.listening())); }
    if (ctrl && k === 'g') { e.preventDefault(); return e.shiftKey ? ungroupSel() : groupSel(); }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); return remove(); }
    if (k === 'escape') { S.pickMode = false; S.shapesOpen = false; host.style.cursor = ''; renderRail(); renderHint(); return select([]); }
    if (k.startsWith('arrow') && selected().length) {
      e.preventDefault();
      const step = e.shiftKey ? px(1) : px(0.1);
      moveBy(selected(), k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0);
      content.batchDraw(); tr.forceUpdate(); clearTimeout(keyCommit.t); keyCommit.t = setTimeout(() => { commit(); renderProps(); }, 350); return;
    }
    if (!ctrl) {
      if (k === 'v') return setTool('select');
      if (k === 'h') return setTool('hand');
      if (k === 't') { e.preventDefault(); return addText(); }
      if (k === 'i') return $('fileInput').click();
      if (k === '?') return showHelp();
      if (k === '+' || k === '=') return setZoom(stage.scaleX() * 1.25);
      if (k === '-') return setZoom(stage.scaleX() / 1.25);
      if (k === '0') return fit();
      if (k === ']') return order('up');
      if (k === '[') return order('down');
    }
  });
  const keyCommit = {};
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') { S.spaceDown = false; if (S.tool !== 'hand') host.classList.remove('pan'); } });
  window.addEventListener('paste', async (e) => {
    if (typing(e)) return;
    const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); for (const f of files) await addImageFile(f); return; }
    pasteSel();
  });
  $('fileInput').addEventListener('change', async (e) => { for (const f of [...e.target.files]) await addImageFile(f); e.target.value = ''; });
  const ws = $('workspace');
  ['dragenter', 'dragover'].forEach((ev) => ws.addEventListener(ev, (e) => {
    if (![...(e.dataTransfer ? e.dataTransfer.types : [])].includes('Files')) return;
    e.preventDefault();
    if (!ws.querySelector('.drop-overlay')) { const d = document.createElement('div'); d.className = 'drop-overlay'; d.textContent = 'Soltá la imagen para agregarla'; ws.appendChild(d); }
  }));
  ['dragleave', 'drop'].forEach((ev) => ws.addEventListener(ev, (e) => { if (ev === 'dragleave' && ws.contains(e.relatedTarget)) return; const d = ws.querySelector('.drop-overlay'); if (d) d.remove(); }));
  ws.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    for (const f of [...e.dataTransfer.files]) await addImageFile(f);
  });
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- arranque ---------- */
  const fontsReady = Promise.all(FONTS.map((f) => document.fonts.load(`700 20px "${f}"`).catch(() => null)).concat(FONTS.map((f) => document.fonts.load(`400 20px "${f}"`).catch(() => null)))).then(() => {
    content.find('Text').forEach((t) => { const f = t.fontFamily(); t.fontFamily('x'); t.fontFamily(f); });
    content.batchDraw();
  });

  async function init() {
    renderTop(); renderRail(); renderLeft(); renderProps(); renderHint(); renderZoom();
    applyPage(); fit();
    S.history = [snap()]; S.hIndex = 0; renderTop();
    try {
      const ctx = await apiGet('context');
      S.clients = ctx.clients || []; S.products = ctx.products || [];
      if (ctx.csrf) BOOT.csrf = ctx.csrf;
      renderProps();
    } catch (e) { toast(e.message, true); }
    loadProjects();
    const id = new URLSearchParams(location.search).get('proyecto');
    if (id) openProject(id);
    S.dirty = false; renderStatus();
  }
  window.UNIFORMA_STUDIO = { S, stage, content, tr, select, addShape, addText, serialize, loadDoc, save, fit, setZoom, renderArtboard, applyFx };
  init();
})();
