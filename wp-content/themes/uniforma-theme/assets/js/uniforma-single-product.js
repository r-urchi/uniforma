document.addEventListener('DOMContentLoaded', function () {
  /* =========================================
     GALERÍA POR COLOR
  ========================================= */

  const gallery = document.querySelector('.uniforma-single-gallery');
  const mainImage = document.querySelector('#uniformaSingleMainImage');
  const thumbsContainer = document.querySelector('#uniformaSingleThumbs');
  const allThumbs = [...document.querySelectorAll('.uniforma-single-gallery__thumb')];
  const previousImageButton = document.querySelector('.uniforma-single-gallery__arrow--prev');
  const nextImageButton = document.querySelector('.uniforma-single-gallery__arrow--next');
  const colorButtons = [...document.querySelectorAll('.uniforma-single-color')];
  const selectedColorLabel = document.querySelector('#uniformaSingleSelectedColor');

  function updatePersonalizeParameter(name, value) {
    const personalizeLink = document.querySelector('#uniformaSinglePersonalize');
    if (!personalizeLink || value === undefined || value === null || value === '') return;

    try {
      const personalizeUrl = new URL(personalizeLink.href, window.location.href);
      personalizeUrl.searchParams.set(name, String(value));
      personalizeLink.href = personalizeUrl.toString();
    } catch (error) {
      // Conserva el enlace original si el navegador no puede procesarlo.
    }
  }

  let activeThumbs = [];
  let currentImageIndex = 0;

  function thumbsForColor(colorSlug) {
    const exactMatch = allThumbs.filter((thumb) => (thumb.dataset.color || '') === colorSlug);

    if (exactMatch.length) {
      return exactMatch;
    }

    const genericImages = allThumbs.filter((thumb) => !(thumb.dataset.color || ''));

    if (genericImages.length) {
      return genericImages;
    }

    const initialColor = gallery?.dataset.initialColor || '';
    const initialImages = allThumbs.filter((thumb) => (thumb.dataset.color || '') === initialColor);

    if (initialImages.length) {
      return initialImages;
    }

    if (!allThumbs.length) {
      return [];
    }

    const firstAvailableColor = allThumbs[0].dataset.color || '';
    return allThumbs.filter((thumb) => (thumb.dataset.color || '') === firstAvailableColor);
  }

  function updateGalleryControls() {
    const hasMultipleImages = activeThumbs.length > 1;

    if (previousImageButton) previousImageButton.hidden = !hasMultipleImages;
    if (nextImageButton) nextImageButton.hidden = !hasMultipleImages;

    if (thumbsContainer) {
      thumbsContainer.hidden = !hasMultipleImages;
      thumbsContainer.classList.toggle('is-compact', activeThumbs.length <= 2);
    }
  }

  function setImage(index) {
    if (!mainImage || !activeThumbs.length) return;

    currentImageIndex = (index + activeThumbs.length) % activeThumbs.length;
    allThumbs.forEach((thumb) => thumb.classList.remove('is-active'));

    const thumb = activeThumbs[currentImageIndex];
    thumb.classList.add('is-active');
    mainImage.src = thumb.dataset.image || mainImage.src;

    if (thumb.dataset.srcset) {
      mainImage.setAttribute('srcset', thumb.dataset.srcset);
    } else {
      mainImage.removeAttribute('srcset');
    }

    if (thumb.dataset.sizes) {
      mainImage.setAttribute('sizes', thumb.dataset.sizes);
    }

    if (thumb.dataset.alt) {
      mainImage.alt = thumb.dataset.alt;
    }
  }

  function showGalleryForColor(colorSlug) {
    activeThumbs = thumbsForColor(colorSlug);
    const activeKeys = new Set(activeThumbs.map((thumb) => thumb.dataset.galleryKey));

    allThumbs.forEach((thumb) => {
      thumb.hidden = !activeKeys.has(thumb.dataset.galleryKey);
    });

    if (gallery) {
      gallery.dataset.currentColor = colorSlug;
    }

    updateGalleryControls();
    setImage(0);
  }

  allThumbs.forEach((thumb) => {
    thumb.addEventListener('click', function () {
      const index = activeThumbs.indexOf(thumb);
      if (index >= 0) setImage(index);
    });
  });

  previousImageButton?.addEventListener('click', function () {
    setImage(currentImageIndex - 1);
  });

  nextImageButton?.addEventListener('click', function () {
    setImage(currentImageIndex + 1);
  });

  function activateColor(button) {
    colorButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      item.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    if (selectedColorLabel) {
      selectedColorLabel.textContent = button.dataset.value || '';
    }

    const selectedColorSlug = button.dataset.slug || '';
    showGalleryForColor(selectedColorSlug);
    updatePersonalizeParameter('color', selectedColorSlug);
  }

  colorButtons.forEach((button) => {
    button.addEventListener('click', function () {
      activateColor(button);
    });
  });

  const initialColorButton = colorButtons.find((button) => button.classList.contains('is-active')) || colorButtons[0];

  if (initialColorButton) {
    activateColor(initialColorButton);
  } else {
    showGalleryForColor(gallery?.dataset.initialColor || '');
  }

  /* =========================================
     SELECTORES SIMPLES
  ========================================= */

  function activateSingle(groupSelector) {
    const group = document.querySelector(groupSelector);
    if (!group) return;

    group.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', function () {
        group.querySelectorAll('button').forEach((item) => {
          item.classList.remove('is-active');
          item.setAttribute('aria-pressed', 'false');
        });

        button.classList.add('is-active');
        button.setAttribute('aria-pressed', 'true');

        if (groupSelector === '.uniforma-single-sizes') {
          updatePersonalizeParameter('talle', button.dataset.value || button.textContent.trim());
        }
      });
    });
  }

  ['.uniforma-single-sizes', '.uniforma-single-personalization'].forEach(activateSingle);

  /* =========================================
     CANTIDAD Y PRECIOS MAYORISTAS
  ========================================= */

  const MINIMUM_QUANTITY = 5;
  const qtyInput = document.querySelector('#uniformaSingleQty');
  const qtyButtons = [...document.querySelectorAll('.uniforma-single-qty-option')];
  const qtyWarning = document.querySelector('#uniformaSingleQtyWarning');
  const unitPriceElement = document.querySelector('#uniformaSingleUnitPrice');
  const totalPriceElement = document.querySelector('#uniformaSingleTotalPrice');
  const totalQtyElement = document.querySelector('#uniformaSingleTotalQty');
  const totalUnitLabel = document.querySelector('#uniformaSingleTotalUnitLabel');
  const quote = document.querySelector('#uniformaSingleQuote');
  const personalize = document.querySelector('#uniformaSinglePersonalize');
  const currency = quote?.dataset.currency || 'ARS';

  const formatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  });

  function normalizedQty(value, fallback = MINIMUM_QUANTITY) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  }

  function tierButtonForQty(quantity) {
    return [...qtyButtons]
      .sort((a, b) => Number(b.dataset.qty) - Number(a.dataset.qty))
      .find((button) => quantity >= Number(button.dataset.qty)) || qtyButtons[0];
  }

  function setMinimumWarning(show) {
    if (qtyWarning) qtyWarning.hidden = !show;

    if (qtyInput) {
      qtyInput.setAttribute('aria-invalid', show ? 'true' : 'false');
      qtyInput.classList.toggle('has-error', show);
    }
  }

  function updatePrice(quantity, writeInput = true) {
    const qty = normalizedQty(quantity);
    const tierButton = tierButtonForQty(qty);
    const unitPrice = Number.parseFloat(tierButton?.dataset.unitPrice || '0');

    if (qtyInput && writeInput) qtyInput.value = String(qty);
    updatePersonalizeParameter('cantidad', qty);

    qtyButtons.forEach((button) => {
      const active = button === tierButton;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (totalQtyElement) totalQtyElement.textContent = String(qty);
    if (totalUnitLabel) totalUnitLabel.textContent = qty === 1 ? 'unidad' : 'unidades';
    if (unitPriceElement) unitPriceElement.textContent = unitPrice > 0 ? formatter.format(unitPrice) : 'Consultar';
    if (totalPriceElement) totalPriceElement.textContent = unitPrice > 0 ? formatter.format(unitPrice * qty) : 'Consultar';

    if (qtyWarning && !qtyWarning.hidden) {
      setMinimumWarning(qty < MINIMUM_QUANTITY);
    }
  }

  qtyButtons.forEach((button) => {
    button.addEventListener('click', function () {
      setMinimumWarning(false);
      updatePrice(button.dataset.qty);
    });
  });

  qtyInput?.addEventListener('input', function () {
    if (qtyInput.value.trim() === '') return;
    updatePrice(qtyInput.value, false);
  });

  qtyInput?.addEventListener('blur', function () {
    updatePrice(qtyInput.value || MINIMUM_QUANTITY);
  });

  function validateMinimumQuantity(event) {
    const quantity = normalizedQty(qtyInput?.value || MINIMUM_QUANTITY);
    updatePrice(quantity);

    if (quantity >= MINIMUM_QUANTITY) {
      setMinimumWarning(false);
      return true;
    }

    event?.preventDefault();
    setMinimumWarning(true);
    qtyInput?.focus({ preventScroll: true });
    qtyInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  updatePrice(qtyInput?.value || MINIMUM_QUANTITY);

  personalize?.addEventListener('click', function (event) {
    validateMinimumQuantity(event);
  });

  quote?.addEventListener('click', function (event) {
    event.preventDefault();

    if (!validateMinimumQuantity(event)) return;

    const selected = (selector, fallback) => {
      const active = document.querySelector(selector + ' .is-active');
      return active ? (active.dataset.value || active.textContent.trim()) : fallback;
    };
    const quantity = normalizedQty(qtyInput?.value || MINIMUM_QUANTITY);
    const tierButton = tierButtonForQty(quantity);
    const unitPrice = Number.parseFloat(tierButton?.dataset.unitPrice || '0');
    const priceLines = unitPrice > 0
      ? ['Precio unitario: ' + formatter.format(unitPrice), 'Total estimado: ' + formatter.format(unitPrice * quantity)]
      : [];
    const message = [
      'Hola UNIFORMA, quiero solicitar un presupuesto.',
      '',
      'Producto: ' + quote.dataset.product,
      'Color: ' + selected('.uniforma-single-colors', 'A definir'),
      'Talle: ' + selected('.uniforma-single-sizes', 'A definir'),
      'Cantidad: ' + quantity + ' unidades',
      ...priceLines,
      'Personalización: ' + selected('.uniforma-single-personalization', 'A definir')
    ];

    const notes = (document.querySelector('#uniformaSingleNotes')?.value || '').trim();
    if (notes) {
      message.push('', 'Aclaraciones: ' + notes);
    }

    const messageText = message.join('\n');

    if (typeof window.uniformaSendLead === 'function') {
      window.uniformaSendLead({
        source: 'producto',
        product: quote.dataset.product,
        sku: quote.dataset.sku || '',
        color: selected('.uniforma-single-colors', ''),
        size: selected('.uniforma-single-sizes', ''),
        qty: String(quantity),
        personalization: selected('.uniforma-single-personalization', ''),
        message: notes
      });
    }

    window.open(
      'https://wa.me/' + quote.dataset.whatsapp + '?text=' + encodeURIComponent(messageText),
      '_blank',
      'noopener,noreferrer'
    );
  });

  /* =========================================
     PRODUCTOS RELACIONADOS
  ========================================= */

  const carousel = document.querySelector('#uniformaRelatedCarousel');
  const scroll = (direction) => {
    const card = carousel?.querySelector('.uniforma-product-card');
    carousel?.scrollBy({ left: direction * ((card?.offsetWidth || 280) + 24), behavior: 'smooth' });
  };

  document.querySelector('#uniformaRelatedPrev')?.addEventListener('click', () => scroll(-1));
  document.querySelector('#uniformaRelatedNext')?.addEventListener('click', () => scroll(1));

  /* =========================================
     ZOOM DE LA FOTO PRINCIPAL
     Clic en la imagen: pantalla completa. Flechas ← → cambian de vista, Esc cierra.
  ========================================= */

  const mainFrame = document.querySelector('.uniforma-single-gallery__main');

  if (mainFrame && mainImage) {
    let lightbox = null;
    let lightboxImage = null;
    let previousFocus = null;

    const syncLightbox = () => {
      if (!lightboxImage) return;
      lightboxImage.src = mainImage.currentSrc || mainImage.src;
      lightboxImage.alt = mainImage.alt || '';
    };

    const closeLightbox = () => {
      if (!lightbox) return;
      lightbox.remove();
      lightbox = null;
      lightboxImage = null;
      document.removeEventListener('keydown', onLightboxKey);
      document.body.style.overflow = '';
      if (previousFocus) previousFocus.focus();
    };

    const onLightboxKey = (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        setImage(currentImageIndex - 1);
        window.setTimeout(syncLightbox, 30);
      } else if (event.key === 'ArrowRight') {
        setImage(currentImageIndex + 1);
        window.setTimeout(syncLightbox, 30);
      }
    };

    const openLightbox = () => {
      if (lightbox) return;
      previousFocus = document.activeElement;

      lightbox = document.createElement('div');
      lightbox.className = 'uniforma-lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Foto ampliada');
      lightbox.innerHTML = '<button type="button" class="uniforma-lightbox__close" aria-label="Cerrar">×</button><img alt="">';
      lightboxImage = lightbox.querySelector('img');
      lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox || event.target.closest('.uniforma-lightbox__close')) closeLightbox();
      });

      document.body.appendChild(lightbox);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onLightboxKey);
      syncLightbox();
      lightbox.querySelector('.uniforma-lightbox__close').focus();
    };

    mainImage.style.cursor = 'zoom-in';
    mainImage.addEventListener('click', openLightbox);
  }

  /* =========================================
     VISTOS RECIENTEMENTE
     Se guardan en el navegador (la página puede estar en caché) y se piden por AJAX.
  ========================================= */

  const productRoot = document.querySelector('.uniforma-single-product');
  const recentSection = document.querySelector('#uniformaRecentSection');
  const recentGrid = document.querySelector('#uniformaRecentGrid');
  const RECENT_KEY = 'uniforma_recent_products';

  if (productRoot && recentSection && recentGrid) {
    const currentId = Number.parseInt(productRoot.dataset.productId || '0', 10);
    let recent = [];

    try {
      recent = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]').filter(Number.isInteger);
    } catch (error) {
      recent = [];
    }

    const others = recent.filter((id) => id !== currentId).slice(0, 8);

    if (currentId) {
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify([currentId, ...others].slice(0, 12)));
      } catch (error) {
        // Sin almacenamiento disponible: la sección simplemente no aparece.
      }
    }

    if (others.length) {
      fetch(recentGrid.dataset.ajaxUrl + '?action=uniforma_recent_products&ids=' + others.join(','), { credentials: 'same-origin' })
        .then((response) => (response.ok ? response.json() : null))
        .then((response) => {
          if (response && response.success && response.data && response.data.html && response.data.html.trim()) {
            recentGrid.innerHTML = response.data.html;
            recentSection.hidden = false;
          }
        })
        .catch(() => {});
    }
  }
});
