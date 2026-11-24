/* UNIFORMA panel · Productos (v4)
 * Formulario completo de producto y publicación en la web con estado Publicado / Borrador,
 * igual que en WordPress. Reemplaza el formulario anterior sin tocar el resto del panel.
 */
(() => {
  "use strict";

  const range = (from, to, step = 1) => { const out = []; for (let n = from; n <= to; n += step) out.push(String(n)); return out; };
  const STATUS_LABELS = { publish: "Publicado", draft: "Borrador", pending: "Pendiente de revisión", private: "Privado" };
  const SIZE_PRESETS = [
    ["S a XXL", ["S", "M", "L", "XL", "XXL"]],
    ["XS a XXXL", ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]],
    ["Calzado 35 a 45", range(35, 45)],
    ["Pantalón 38 a 54 (pares)", range(38, 54, 2)],
    ["6E · 7E · 8E", ["6E", "7E", "8E"]],
    ["Talle único", ["Talle único"]],
  ];
  const TABS = [
    ["general", "General"], ["textos", "Textos"], ["precios", "Precios"], ["variantes", "Colores y talles"],
    ["medidas", "Tabla de talles"], ["fotos", "Fotos"], ["seo", "Google"], ["interno", "Interno"],
  ];

  let pf = null;            // borrador del formulario abierto
  let webTax = null;        // categorías, colores y talles que ya existen en la web
  let webTaxLoading = false;
  let busy = false;

  const root = () => document.getElementById("productFormV4");
  const slugOf = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const numberOf = (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };

  function fromProduct(item) {
    const p = item || {};
    const prices = p.prices || {};
    const price = (qty) => prices[qty] ?? prices[String(qty)] ?? (qty === 5 ? p.basePrice : "") ?? "";
    return {
      id: p.id || "", wooId: Number(p.wooId || 0), source: p.source || "",
      name: p.name || "", sku: p.sku || "", slug: p.slug || "", status: p.status || "publish",
      categories: Array.isArray(p.categories) && p.categories.length ? [...p.categories] : (p.category ? [p.category] : []),
      createCategories: false, tags: (p.tags || []).join(", "), isNew: Boolean(p.isNew),
      shortDescription: p.shortDescription ?? p.material ?? "", description: p.description || "",
      details: p.details || (p.features || []).map((line) => `- ${line}`).join("\n"), care: p.care || "",
      buttonPersonalize: p.buttonPersonalize || "", buttonQuote: p.buttonQuote || "",
      price5: price(5) || "", price10: price(10) || "", price20: price(20) || "", price50: price(50) || "",
      unitCost: Number(p.unitCost || 0) || "", minQuantity: Number(p.minQuantity || 5),
      colors: (p.colors || []).map((c) => ({ name: c.name, hex: /^#[0-9a-f]{6}$/i.test(c.hex || "") ? c.hex : "#d8d1c7" })),
      sizes: (p.sizeOptions?.length || p.sizes) ? sizesOf({ sizeOptions: p.sizeOptions || [], sizes: p.sizes || "" }).filter(Boolean) : [],
      sizeChart: (p.sizeChart || []).map((row) => ({ size: row.size || "", width: row.width ?? "", length: row.length ?? "" })),
      hasSizeChart: Boolean(p.hasSizeChart), seoDescription: p.seoDescription || "",
      methods: (p.methods || ["Bordado", "DTF"]).join(", "),
      image: p.image || "", imageBack: p.imageBack || "",
      permalink: p.permalink || "", editUrl: p.editUrl || "", publishedAt: p.publishedAt || "", modifiedAt: p.modifiedAt || "",
    };
  }

  // sizesOf() devuelve S a XXL cuando recibe una lista vacía; acá una lista vacía tiene que quedar vacía.
  function sizeSort(list) { return list.length ? sizesOf({ sizeOptions: list }) : []; }

  /* ---------- Piezas dinámicas ---------- */

  function knownColors() {
    const map = new Map();
    const add = (name, hex) => {
      const key = slugOf(name);
      if (!key || map.has(key)) return;
      map.set(key, { name: String(name), hex: /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#d8d1c7" });
    };
    for (const color of webTax?.colors || []) add(color.name, color.hex);
    for (const product of state.products) for (const color of product.colors || []) { if (color?.name && color.hex && color.hex !== "#d8d1c7") add(color.name, color.hex); }
    for (const product of state.products) for (const color of product.colors || []) if (color?.name) add(color.name, color.hex);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  function renderCats() {
    const box = document.getElementById("pfCats"); if (!box) return;
    const fromWeb = (webTax?.categories || []).map((c) => c.name);
    const all = [...new Set([...fromWeb, ...pf.categories])];
    const note = webTax?.error ? `<small class="v2-help-text">No se pudieron traer las categorías de la web (${esc(webTax.error)}). Podés escribirlas a mano.</small>` : (!webTax ? `<small class="v2-help-text">Buscando las categorías de la web…</small>` : "");
    box.innerHTML = `<div class="v2-chip-row">${all.map((name) => {
      const on = pf.categories.includes(name);
      const isNewOne = on && webTax && !webTax.error && !fromWeb.some((n) => slugOf(n) === slugOf(name));
      return `<button type="button" class="v2-chip ${on ? "is-on" : ""}" data-pf="cat" data-v="${esc(name)}" aria-pressed="${on}">${esc(name)}${isNewOne ? " · nueva" : ""}</button>`;
    }).join("") || `<small class="v2-help-text">Todavía no hay categorías.</small>`}</div>${note}`;
  }

  function renderColors() {
    const box = document.getElementById("pfColors"); if (!box) return;
    const chosen = new Set(pf.colors.map((c) => slugOf(c.name)));
    const suggestions = knownColors().filter((c) => !chosen.has(slugOf(c.name)));
    box.innerHTML = `
      <div class="v2-pf-colors">${pf.colors.map((color, index) => `<div class="v2-pf-color"><input type="color" value="${esc(color.hex)}" data-pf-hex="${index}" aria-label="Color de ${esc(color.name)}"><strong>${esc(color.name)}</strong><button type="button" data-pf="color-del" data-v="${index}" aria-label="Quitar ${esc(color.name)}">×</button></div>`).join("") || `<small class="v2-help-text">Elegí los colores del producto.</small>`}</div>
      ${suggestions.length ? `<small class="v2-help-text">Colores que ya existen (tocá para agregar):</small><div class="v2-chip-row">${suggestions.map((c) => `<button type="button" class="v2-chip" data-pf="color-add" data-v="${esc(c.name)}" data-hex="${esc(c.hex)}"><span class="v2-color-swatch" style="background:${esc(c.hex)}"></span>${esc(c.name)}</button>`).join("")}</div>` : ""}
      <div class="v2-inline v2-pf-newcolor"><label>Color nuevo<input id="pfNewColor" placeholder="Ej. Verde agua"></label><label>Muestra<input id="pfNewHex" type="color" value="#cccccc"></label><button type="button" data-pf="color-new">Agregar color</button></div>`;
    counters();
  }

  function renderSizes() {
    const box = document.getElementById("pfSizes"); if (!box) return;
    const fromWeb = (webTax?.sizes || []).map((s) => s.name).filter((n) => !pf.sizes.includes(n));
    box.innerHTML = `
      <div class="v2-chip-row">${pf.sizes.map((size) => `<span class="v2-chip is-on">${esc(size)}<button type="button" data-pf="size-del" data-v="${esc(size)}" aria-label="Quitar talle ${esc(size)}">×</button></span>`).join("") || `<small class="v2-help-text">Elegí los talles de la prenda.</small>`}</div>
      <small class="v2-help-text">Grupos listos:</small>
      <div class="v2-chip-row">${SIZE_PRESETS.map(([label], index) => `<button type="button" class="v2-chip" data-pf="size-preset" data-v="${index}">${esc(label)}</button>`).join("")}</div>
      ${fromWeb.length ? `<small class="v2-help-text">Talles que ya existen en la web:</small><div class="v2-chip-row">${fromWeb.slice(0, 40).map((s) => `<button type="button" class="v2-chip" data-pf="size-add" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
      <div class="v2-inline"><label>Talle propio<input id="pfNewSize" placeholder="Ej. 3XL"></label><button type="button" data-pf="size-new">Agregar talle</button></div>`;
    counters();
  }

  function renderChart() {
    const box = document.getElementById("pfChart"); if (!box) return;
    box.innerHTML = `${pf.hasSizeChart ? `<div class="v2-pf-note">La web ya tiene una tabla de talles cargada. Si completás filas acá, se reemplaza al publicar. Si las dejás vacías, no se toca.</div>` : ""}
      <div class="v2-variant-grid"><table><thead><tr><th>Talle</th><th>Ancho (cm)</th><th>Largo (cm)</th><th></th></tr></thead><tbody>${pf.sizeChart.map((row, index) => `<tr><td><input data-pf-chart="${index}:size" value="${esc(row.size)}" aria-label="Talle"></td><td><input data-pf-chart="${index}:width" inputmode="decimal" value="${esc(row.width)}" aria-label="Ancho"></td><td><input data-pf-chart="${index}:length" inputmode="decimal" value="${esc(row.length)}" aria-label="Largo"></td><td><button type="button" data-pf="chart-del" data-v="${index}" aria-label="Quitar fila">×</button></td></tr>`).join("") || `<tr><td colspan="4"><small class="v2-help-text">Sin filas.</small></td></tr>`}</tbody></table></div>
      <div class="button-row"><button type="button" data-pf="chart-add">+ Fila</button><button type="button" data-pf="chart-fill">Crear una fila por cada talle elegido</button></div>`;
  }

  function counters() {
    const count = document.getElementById("pfVarCount");
    if (count) {
      const total = pf.colors.length * pf.sizes.length;
      count.textContent = total ? `${pf.colors.length} color(es) × ${pf.sizes.length} talle(s) = ${total} variaciones en la web.` : "Elegí al menos un color y un talle.";
      count.className = total ? "v2-color-ok" : "v2-color-warning";
    }
  }

  function margins() {
    const box = document.getElementById("pfMargins"); if (!box) return;
    const cost = numberOf(root()?.querySelector('[name="unitCost"]')?.value);
    if (!cost) { box.textContent = "Cargá el costo para ver el margen de cada tramo."; return; }
    box.innerHTML = [5, 10, 20, 50].map((qty) => {
      const price = numberOf(root().querySelector(`[name="price${qty}"]`)?.value);
      if (!price) return `<span>x${qty}: —</span>`;
      const margin = Math.round((price - cost) / price * 100);
      return `<span class="${margin < 20 ? "v2-color-warning" : "v2-color-ok"}">x${qty}: ${margin}% de margen</span>`;
    }).join("");
  }

  function publishLabel() {
    const status = root()?.querySelector('[name="status"]')?.value || pf.status;
    const exists = pf.wooId > 0;
    if (status === "publish") return exists ? "Actualizar en la web" : "Publicar en la web";
    if (status === "draft") return "Guardar borrador en la web";
    if (status === "pending") return "Guardar como pendiente en la web";
    return "Guardar como privado en la web";
  }

  function refreshSide() {
    const button = document.getElementById("pfPublishBtn"); if (button) button.textContent = publishLabel();
    const status = root()?.querySelector('[name="status"]')?.value || pf.status;
    const pill = document.getElementById("pfPill");
    if (pill) { pill.textContent = pf.wooId ? `En la web: ${STATUS_LABELS[pf.status] || pf.status}` : "Solo en el ERP"; pill.className = `v2-pf-pill ${pf.wooId ? `is-${pf.status}` : "is-local"}`; }
    const hint = document.getElementById("pfStatusHint");
    if (hint) hint.textContent = status === "publish" ? "Se ve en la web apenas lo publicás." : status === "draft" ? "No se ve en la web hasta que lo publiques." : status === "pending" ? "Queda esperando revisión; no se ve en la web." : "Solo lo ven quienes tienen sesión en WordPress.";
    const links = document.getElementById("pfLinks");
    if (links) links.innerHTML = [pf.permalink && pf.status === "publish" ? `<a href="${esc(pf.permalink)}" target="_blank" rel="noopener">Ver en la web</a>` : "", pf.editUrl ? `<a href="${esc(pf.editUrl)}" target="_blank" rel="noopener">Editar en WordPress</a>` : ""].filter(Boolean).join(" · ");
  }

  /* ---------- Formulario ---------- */

  function field(label, name, value, extra = "") { return `<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`; }
  function area(label, name, value, rows = 4, hint = "") { return `<label>${label}<textarea name="${name}" rows="${rows}">${esc(value)}</textarea>${hint ? `<small class="v2-help-text">${hint}</small>` : ""}</label>`; }

  function formHtml() {
    return `<div id="productFormV4" class="v2-form v2-pf">
      <div class="v2-pf-head"><h2>${pf.id ? "Editar producto" : "Nuevo producto"}</h2><span id="pfPill" class="v2-pf-pill"></span></div>
      <div class="v2-pf-layout">
        <div class="v2-pf-main">
          <nav class="v2-pf-tabs" role="tablist">${TABS.map(([key, label], index) => `<button type="button" role="tab" class="${index ? "" : "is-on"}" data-pf="tab" data-v="${key}">${label}</button>`).join("")}</nav>

          <section data-pf-tab="general">
            <div class="v2-form-grid">${field("Nombre del producto *", "name", pf.name, "required")}${field("SKU (código)", "sku", pf.sku)}</div>
            ${field("Dirección web (opcional)", "slug", pf.slug, 'placeholder="Se arma sola con el nombre"')}
            <div><strong class="v2-pf-label">Categorías *</strong><div id="pfCats"></div>
              <div class="v2-inline"><label>Categoría nueva<input id="pfNewCat" placeholder="Si no existe en la web"></label><button type="button" data-pf="cat-new">Agregar categoría</button></div></div>
            ${field("Etiquetas (separadas por coma)", "tags", pf.tags)}
            <label class="check-row"><input type="checkbox" name="isNew" ${pf.isNew ? "checked" : ""}> Mostrar la etiqueta «Nuevo» en la ficha</label>
          </section>

          <section data-pf-tab="textos" hidden>
            ${area("Descripción corta", "shortDescription", pf.shortDescription, 3, "Aparece junto al título del producto.")}
            ${area("Descripción larga", "description", pf.description, 6, "Una línea por párrafo.")}
            ${area("Detalles (puntos de la ficha)", "details", pf.details, 6, "Una línea por punto. Empezá con «- » para que salga como viñeta.")}
            ${area("Cuidados", "care", pf.care, 4, "Una línea por indicación (por ejemplo: «- Lavar con agua fría»).")}
            <div class="v2-form-grid">${field("Texto del botón «Personalizar»", "buttonPersonalize", pf.buttonPersonalize, 'placeholder="Personalizar prenda"')}${field("Texto del botón «Pedir presupuesto»", "buttonQuote", pf.buttonQuote, 'placeholder="Pedir presupuesto"')}</div>
          </section>

          <section data-pf-tab="precios" hidden>
            <h3>Precio unitario por cantidad</h3>
            <div class="v2-inline">${[5, 10, 20, 50].map((qty) => `<label>x${qty}<input name="price${qty}" type="number" min="0" step="1" inputmode="numeric" value="${esc(pf[`price${qty}`])}"></label>`).join("")}</div>
            <div class="v2-form-grid"><label>Cantidad mínima de pedido<input name="minQuantity" type="number" min="1" step="1" value="${esc(pf.minQuantity)}"></label><label>Costo de compra por unidad ($, solo ERP)<input name="unitCost" type="number" min="0" step="0.01" value="${esc(pf.unitCost)}"></label></div>
            <div id="pfMargins" class="v2-pf-margins"></div>
            <small class="v2-help-text">El precio x5 es el que se muestra en el listado de la web y el que se usa en cada variación.</small>
          </section>

          <section data-pf-tab="variantes" hidden>
            <h3>Colores</h3><div id="pfColors"></div>
            <h3>Talles</h3><div id="pfSizes"></div>
            <p id="pfVarCount"></p>
          </section>

          <section data-pf-tab="medidas" hidden>
            <h3>Tabla de talles</h3><div id="pfChart"></div>
          </section>

          <section data-pf-tab="fotos" hidden>
            <h3>Fotos del producto</h3>
            <div class="v2-pf-photos">${pf.image ? `<figure><img src="${esc(pf.image)}" alt="Frente"><figcaption>Frente</figcaption></figure>` : ""}${pf.imageBack ? `<figure><img src="${esc(pf.imageBack)}" alt="Espalda"><figcaption>Espalda</figcaption></figure>` : ""}</div>
            <div class="v2-form-grid"><label>Foto de frente (para el editor del ERP)<input name="imageFile" type="file" accept="image/*,.svg"></label><label>Foto de espalda (para el editor del ERP)<input name="imageBackFile" type="file" accept="image/*,.svg"></label></div>
            <div class="v2-pf-note">Estas fotos se usan en el editor visual del ERP. Subir a la web la foto principal, las de cada color y las del carrusel es la próxima etapa: por ahora se cargan desde WordPress.</div>
          </section>

          <section data-pf-tab="seo" hidden>
            ${area("Descripción para Google", "seoDescription", pf.seoDescription, 3, "Hasta 160 letras. Si la dejás vacía, se arma sola con la descripción corta.")}
            <small id="pfSeoCount" class="v2-help-text"></small>
          </section>

          <section data-pf-tab="interno" hidden>
            ${field("Técnicas de personalización (separadas por coma)", "methods", pf.methods)}
            <small class="v2-help-text">Solo se usan dentro del ERP (editor visual y costos).</small>
          </section>
        </div>

        <aside class="v2-pf-side">
          <div class="v2-pf-box">
            <h3>Publicar</h3>
            <label>Estado<select name="status">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${pf.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            <small id="pfStatusHint" class="v2-help-text"></small>
            <div id="pfLinks" class="v2-pf-links"></div>
            ${pf.publishedAt ? `<small class="v2-help-text">Última publicación desde el ERP: ${esc(new Date(pf.publishedAt).toLocaleString("es-AR"))}</small>` : ""}
            <button type="button" class="primary-button" id="pfPublishBtn" data-pf="publish"></button>
            <button type="button" data-pf="check">Verificar sin publicar</button>
            <button type="button" data-pf="save">Guardar solo en el ERP</button>
          </div>
        </aside>
      </div>
      <div id="pfResult" class="v2-pf-result" hidden></div>
    </div>`;
  }

  function collect() {
    const el = root(); if (!el) return pf;
    const get = (name) => el.querySelector(`[name="${name}"]`);
    for (const name of ["name", "sku", "slug", "tags", "shortDescription", "description", "details", "care", "buttonPersonalize", "buttonQuote", "price5", "price10", "price20", "price50", "unitCost", "minQuantity", "seoDescription", "methods", "status"]) {
      const input = get(name); if (input) pf[name] = input.value;
    }
    pf.isNew = Boolean(get("isNew")?.checked);
    return pf;
  }

  function validate(mode) {
    collect();
    const errors = [];
    if (pf.name.trim().length < 3) errors.push("Escribí el nombre del producto.");
    if (mode === "save") return errors;
    if (!pf.colors.length) errors.push("Elegí al menos un color (pestaña Colores y talles).");
    if (!pf.sizes.length) errors.push("Elegí al menos un talle (pestaña Colores y talles).");
    if (pf.status === "publish") {
      if (!numberOf(pf.price5)) errors.push("Para publicar hace falta el precio x5. Cargalo o guardá como borrador.");
      if (!pf.categories.length) errors.push("Para publicar elegí al menos una categoría.");
    }
    const prices = [5, 10, 20, 50].map((qty) => numberOf(pf[`price${qty}`])).filter(Boolean);
    if (prices.some((value, index) => index && value > prices[index - 1])) errors.push("Revisá los precios: un tramo con más unidades no debería costar más que el anterior.");
    return errors;
  }

  function showResult(kind, title, lines = []) {
    const box = document.getElementById("pfResult"); if (!box) return;
    box.hidden = false; box.className = `v2-pf-result is-${kind}`;
    box.innerHTML = `<strong>${esc(title)}</strong>${lines.length ? `<ul>${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : ""}`;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function describeCheck(result) {
    const lines = [];
    lines.push(result.created ? "Se va a crear un producto nuevo en la web." : "Se va a actualizar el producto que ya está en la web.");
    const v = result.variations || {};
    lines.push(`Variaciones: ${v.total || 0} en total (${v.toCreate || 0} nuevas, ${v.existing || 0} ya existen).`);
    const plan = result.plan || {};
    if (plan.attributesToCreate?.length) lines.push(`Se crean los atributos: ${plan.attributesToCreate.join(", ")}.`);
    if (plan.colorsToCreate?.length) lines.push(`Colores nuevos en la web: ${plan.colorsToCreate.join(", ")}.`);
    if (plan.sizesToCreate?.length) lines.push(`Talles nuevos en la web: ${plan.sizesToCreate.join(", ")}.`);
    for (const warning of result.warnings || []) lines.push(`Aviso: ${warning}`);
    return lines;
  }

  /* ---------- Guardar y publicar ---------- */

  async function applyToState() {
    collect();
    const el = root();
    const existing = pf.id ? state.products.find((p) => p.id === pf.id) : null;
    const price = (qty) => numberOf(pf[`price${qty}`]);
    const prices = { 5: price(5), 10: price(10), 20: price(20), 50: price(50) };
    const detailsLines = pf.details.split("\n").map((line) => line.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
    const frontFile = el.querySelector('[name="imageFile"]')?.files?.[0];
    const backFile = el.querySelector('[name="imageBackFile"]')?.files?.[0];
    const data = {
      name: pf.name.trim(), sku: pf.sku.trim(), slug: pf.slug.trim(), status: pf.status,
      category: pf.categories[0] || existing?.category || "Sin categoría", categories: [...pf.categories],
      tags: pf.tags.split(",").map((t) => t.trim()).filter(Boolean), isNew: pf.isNew,
      shortDescription: pf.shortDescription.trim(), material: pf.shortDescription.trim(), description: pf.description.trim(),
      details: pf.details.trim(), features: detailsLines, care: pf.care.trim(),
      buttonPersonalize: pf.buttonPersonalize.trim(), buttonQuote: pf.buttonQuote.trim(),
      prices, basePrice: prices[5], minQuantity: Math.max(1, Math.floor(numberOf(pf.minQuantity)) || 5),
      unitCost: Math.max(0, Number(pf.unitCost) || 0),
      colors: pf.colors.map((c) => ({ name: c.name, hex: c.hex })),
      sizeOptions: sizeSort(pf.sizes), sizes: sizeSort(pf.sizes).join(", "),
      sizeChart: pf.sizeChart.filter((row) => String(row.size).trim()).map((row) => ({ size: String(row.size).trim(), width: String(row.width).trim(), length: String(row.length).trim() })),
      seoDescription: pf.seoDescription.trim(),
      methods: pf.methods.split(",").map((t) => t.trim()).filter(Boolean),
      image: frontFile ? await readFile(frontFile) : (existing?.image || pf.image || ""),
      imageBack: backFile ? await readFile(backFile) : (existing?.imageBack || pf.imageBack || existing?.image || ""),
    };
    if (existing) Object.assign(existing, data);
    else { pf.id = uid("product"); state.products.unshift({ id: pf.id, source: "Manual", ...data }); }
    audit(existing ? "Producto actualizado" : "Producto creado", data.name);
    await save();
    return state.products.find((p) => p.id === pf.id);
  }

  function setBusy(value) {
    busy = value;
    qa("#productFormV4 [data-pf='publish'], #productFormV4 [data-pf='check'], #productFormV4 [data-pf='save']").forEach((button) => { button.disabled = value; });
  }

  function reportError(error) {
    const details = Array.isArray(error.details) ? error.details : (error.details && typeof error.details === "object" ? Object.values(error.details).flat().map(String) : []);
    showResult("error", error.message || "No se pudo completar la operación.", details);
  }

  async function run(mode) {
    if (busy) return;
    const errors = validate(mode);
    if (errors.length) return showResult("error", "Falta completar:", errors);
    setBusy(true);
    try {
      showResult("info", mode === "save" ? "Guardando…" : mode === "check" ? "Verificando con la web…" : "Publicando en la web…");
      const item = await applyToState();
      const createCategories = Boolean(webTax && !webTax.error && pf.categories.some((name) => !(webTax.categories || []).some((c) => slugOf(c.name) === slugOf(name))));
      if (mode === "save") {
        showResult("ok", "Guardado en el ERP.", ["Todavía no se publicó en la web."]);
        if (typeof renderCatalog === "function") renderCatalog();
        return;
      }
      if (mode === "check") {
        const answer = await api("publish_product", { productId: item.id, status: pf.status, dryRun: true, createCategories });
        showResult("ok", "Todo en orden. No se publicó nada todavía.", describeCheck(answer.result || {}));
        return;
      }
      const answer = await api("publish_product", { productId: item.id, status: pf.status, createCategories });
      const fresh = state.products.find((p) => p.id === item.id);
      if (fresh) { const keep = pf.status; pf = { ...fromProduct(fresh) }; pf.status = fresh.status || keep; }
      refreshSide();
      const v = answer.publish?.variations || {};
      const lines = [`Estado en la web: ${STATUS_LABELS[pf.status] || pf.status}.`, `Variaciones: ${v.created || 0} nuevas, ${v.updated || 0} actualizadas.`];
      for (const warning of answer.publish?.warnings || []) lines.push(`Aviso: ${warning}`);
      showResult("ok", answer.publish?.created ? "Producto creado en la web." : "Producto actualizado en la web.", lines);
      if (typeof renderCatalog === "function") renderCatalog();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Interacción ---------- */

  function addColor(name, hex) {
    const clean = String(name || "").trim(); if (!clean) return;
    if (pf.colors.some((c) => slugOf(c.name) === slugOf(clean))) return;
    pf.colors.push({ name: clean, hex: /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : "#d8d1c7" });
    renderColors();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-pf]");
    if (!target || !root()) return;
    const action = target.dataset.pf, value = target.dataset.v;
    if (action === "tab") {
      qa("#productFormV4 [data-pf-tab]").forEach((panel) => { panel.hidden = panel.dataset.pfTab !== value; });
      qa("#productFormV4 .v2-pf-tabs button").forEach((button) => button.classList.toggle("is-on", button === target));
      return;
    }
    if (action === "cat") { pf.categories = pf.categories.includes(value) ? pf.categories.filter((c) => c !== value) : [...pf.categories, value]; renderCats(); return; }
    if (action === "cat-new") { const input = document.getElementById("pfNewCat"); const name = input.value.trim(); if (name && !pf.categories.some((c) => slugOf(c) === slugOf(name))) pf.categories.push(name); input.value = ""; renderCats(); return; }
    if (action === "color-add") return addColor(value, target.dataset.hex);
    if (action === "color-del") { pf.colors.splice(Number(value), 1); renderColors(); return; }
    if (action === "color-new") { const name = document.getElementById("pfNewColor"); addColor(name.value, document.getElementById("pfNewHex").value); name.value = ""; return; }
    if (action === "size-preset") { pf.sizes = sizeSort([...new Set([...pf.sizes, ...SIZE_PRESETS[Number(value)][1]])]); renderSizes(); return; }
    if (action === "size-add") { pf.sizes = sizeSort([...new Set([...pf.sizes, value])]); renderSizes(); return; }
    if (action === "size-del") { pf.sizes = pf.sizes.filter((s) => s !== value); renderSizes(); return; }
    if (action === "size-new") { const input = document.getElementById("pfNewSize"); const size = input.value.trim(); if (size) pf.sizes = sizeSort([...new Set([...pf.sizes, size])]); input.value = ""; renderSizes(); return; }
    if (action === "chart-add") { pf.sizeChart.push({ size: "", width: "", length: "" }); renderChart(); return; }
    if (action === "chart-del") { pf.sizeChart.splice(Number(value), 1); renderChart(); return; }
    if (action === "chart-fill") { for (const size of pf.sizes) if (!pf.sizeChart.some((row) => slugOf(row.size) === slugOf(size))) pf.sizeChart.push({ size, width: "", length: "" }); renderChart(); return; }
    if (action === "save" || action === "check" || action === "publish") { run(action); }
  });

  document.addEventListener("input", (event) => {
    if (!root() || !root().contains(event.target)) return;
    const t = event.target;
    if (t.dataset.pfHex !== undefined) { pf.colors[Number(t.dataset.pfHex)].hex = t.value; return; }
    if (t.dataset.pfChart) { const [index, key] = t.dataset.pfChart.split(":"); pf.sizeChart[Number(index)][key] = t.value; return; }
    if (t.name === "seoDescription") { const c = document.getElementById("pfSeoCount"); if (c) c.textContent = `${t.value.length} de 160 letras`; }
    if (["price5", "price10", "price20", "price50", "unitCost"].includes(t.name)) margins();
    if (t.name === "status") { pf.status = t.value; refreshSide(); }
  });
  document.addEventListener("change", (event) => {
    if (root() && event.target.name === "status") { pf.status = event.target.value; refreshSide(); }
  });

  async function loadTaxonomies() {
    if (webTax || webTaxLoading) return;
    webTaxLoading = true;
    try { webTax = (await api("web_taxonomies")).taxonomies || { error: "respuesta vacía" }; }
    catch (error) { webTax = { error: error.message }; }
    webTaxLoading = false;
    if (root()) { renderCats(); renderColors(); renderSizes(); }
  }

  /* ---------- Entradas al formulario ---------- */

  window.productModal = function productModalV4(id = "") {
    const item = id ? state.products.find((p) => p.id === id) : null;
    pf = fromProduct(item);
    busy = false;
    modal(formHtml(), true);
    renderCats(); renderColors(); renderSizes(); renderChart(); margins(); refreshSide(); counters();
    const seo = document.getElementById("pfSeoCount"); if (seo) seo.textContent = `${pf.seoDescription.length} de 160 letras`;
    loadTaxonomies();
  };

  /* ---------- Etiquetas de estado en el listado ---------- */

  const originalCards = window.renderProductCards;
  window.renderProductCards = function renderProductCardsV4(...args) {
    const result = originalCards.apply(this, args);
    qa("#productCards [data-edit-product]").forEach((button) => {
      const card = button.closest(".v2-board-card, .v2-product, .v2-card, tr, .v2-row");
      const item = state.products.find((p) => p.id === button.dataset.editProduct);
      if (!card || !item || card.querySelector(".v2-pf-badge")) return;
      const label = item.wooId ? (item.status && item.status !== "publish" ? STATUS_LABELS[item.status] || item.status : "") : "Solo en el ERP";
      if (!label) return;
      card.insertAdjacentHTML("afterbegin", `<span class="v2-pf-badge ${item.wooId ? `is-${item.status}` : "is-local"}">${esc(label)}</span>`);
    });
    return result;
  };

  const originalCatalog = window.renderCatalog;
  window.renderCatalog = function renderCatalogV4(...args) {
    const result = originalCatalog.apply(this, args);
    const button = document.querySelector("#view-catalogo [data-new-product]");
    if (button) button.textContent = "Nuevo producto";
    return result;
  };
})();
