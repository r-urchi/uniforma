document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('#uniformaHeader');

    if (!header) return;

    const mobileBtn = header.querySelector('#uniformaMobileBtn');
    const mobileNav = header.querySelector('#uniformaMobileNav');

    const mobileDropdownToggles = header.querySelectorAll('.uniforma-header__mobile-dropdown-toggle');
    const desktopDropdownWrappers = header.querySelectorAll('.uniforma-header__has-dropdown');

    if (mobileBtn && mobileNav) {
        mobileBtn.addEventListener('click', function () {
            const isOpen = mobileNav.classList.toggle('is-open');

            mobileBtn.classList.toggle('is-active', isOpen);
            mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    mobileDropdownToggles.forEach(function (mobileDropdownToggle) {
        mobileDropdownToggle.addEventListener('click', function () {
            const mobileDropdown = mobileDropdownToggle.nextElementSibling;
            if (!mobileDropdown || !mobileDropdown.classList.contains('uniforma-header__mobile-dropdown')) return;

            const isOpen = mobileDropdown.classList.toggle('is-open');
            const icon = mobileDropdownToggle.querySelector('span');

            if (icon) {
                icon.textContent = isOpen ? '-' : '+';
            }
            mobileDropdownToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    desktopDropdownWrappers.forEach(function (desktopDropdownWrapper) {
        const desktopDropdownToggle = desktopDropdownWrapper.querySelector('.uniforma-header__dropdown-toggle');
        if (!desktopDropdownToggle) return;

        desktopDropdownToggle.addEventListener('click', function (event) {
            event.preventDefault();

            desktopDropdownWrappers.forEach(function (otherWrapper) {
                if (otherWrapper !== desktopDropdownWrapper) {
                    otherWrapper.classList.remove('is-open');
                    const otherToggle = otherWrapper.querySelector('.uniforma-header__dropdown-toggle');
                    if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
                }
            });

            const isOpen = desktopDropdownWrapper.classList.toggle('is-open');
            desktopDropdownToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    });

    document.addEventListener('click', function (event) {
        desktopDropdownWrappers.forEach(function (desktopDropdownWrapper) {
            if (!desktopDropdownWrapper.contains(event.target)) {
                desktopDropdownWrapper.classList.remove('is-open');
                const toggle = desktopDropdownWrapper.querySelector('.uniforma-header__dropdown-toggle');
                if (toggle) toggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    const searchForm = header.querySelector('.uniforma-header__search');
    const searchInput = header.querySelector('#uniformaProductSearch');
    const searchResults = header.querySelector('#uniformaSearchResults');

    if (searchForm && searchInput && searchResults) {
        let searchTimer = null;
        let searchController = null;
        let activeResult = -1;

        const resultLinks = function () {
            return Array.from(searchResults.querySelectorAll('.uniforma-header__search-result'));
        };

        const closeResults = function () {
            searchResults.hidden = true;
            searchResults.replaceChildren();
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.removeAttribute('aria-activedescendant');
            activeResult = -1;
        };

        const showMessage = function (message) {
            const status = document.createElement('p');
            status.className = 'uniforma-header__search-status';
            status.textContent = message;
            searchResults.replaceChildren(status);
            searchResults.hidden = false;
            searchInput.setAttribute('aria-expanded', 'true');
            activeResult = -1;
        };

        const renderResults = function (items) {
            if (!items.length) {
                showMessage('No encontramos productos con ese nombre.');
                return;
            }

            const fragment = document.createDocumentFragment();

            items.forEach(function (item, index) {
                const link = document.createElement('a');
                link.className = 'uniforma-header__search-result';
                link.id = 'uniformaSearchResult' + index;
                link.href = item.url;
                link.setAttribute('role', 'option');
                link.setAttribute('aria-selected', 'false');

                const image = document.createElement('img');
                image.src = item.image;
                image.alt = '';
                image.loading = 'lazy';

                const content = document.createElement('span');
                content.className = 'uniforma-header__search-result-content';

                const name = document.createElement('strong');
                name.textContent = item.name;
                content.appendChild(name);

                if (item.price || item.sku) {
                    const meta = document.createElement('small');
                    meta.textContent = [item.price, item.sku ? 'SKU: ' + item.sku : ''].filter(Boolean).join(' · ');
                    content.appendChild(meta);
                }

                link.append(image, content);
                fragment.appendChild(link);
            });

            searchResults.replaceChildren(fragment);
            searchResults.hidden = false;
            searchInput.setAttribute('aria-expanded', 'true');
            activeResult = -1;
        };

        const selectResult = function (nextIndex) {
            const links = resultLinks();
            if (!links.length) return;

            activeResult = (nextIndex + links.length) % links.length;
            links.forEach(function (link, index) {
                const active = index === activeResult;
                link.classList.toggle('is-active', active);
                link.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            searchInput.setAttribute('aria-activedescendant', links[activeResult].id);
            links[activeResult].scrollIntoView({ block: 'nearest' });
        };

        const searchProducts = function (query) {
            if (searchController) searchController.abort();
            searchController = new AbortController();
            showMessage('Buscando productos…');

            const params = new URLSearchParams({
                action: 'uniforma_product_search',
                nonce: searchForm.dataset.searchNonce,
                query: query
            });

            fetch(searchForm.dataset.ajaxUrl + '?' + params.toString(), {
                signal: searchController.signal,
                credentials: 'same-origin'
            })
                .then(function (response) {
                    if (!response.ok) throw new Error('Search request failed');
                    return response.json();
                })
                .then(function (response) {
                    renderResults(response.success && response.data ? response.data.items || [] : []);
                })
                .catch(function (error) {
                    if (error.name !== 'AbortError') showMessage('No pudimos completar la búsqueda. Intentá nuevamente.');
                });
        };

        searchInput.addEventListener('input', function () {
            const query = searchInput.value.trim();
            window.clearTimeout(searchTimer);

            if (query.length < 2) {
                if (searchController) searchController.abort();
                closeResults();
                return;
            }

            searchTimer = window.setTimeout(function () { searchProducts(query); }, 260);
        });

        searchInput.addEventListener('keydown', function (event) {
            if (searchResults.hidden) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                selectResult(activeResult + 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                selectResult(activeResult - 1);
            } else if (event.key === 'Enter' && activeResult >= 0) {
                event.preventDefault();
                const links = resultLinks();
                if (links[activeResult]) window.location.assign(links[activeResult].href);
            } else if (event.key === 'Escape') {
                closeResults();
            }
        });

        document.addEventListener('click', function (event) {
            if (!searchForm.contains(event.target)) closeResults();
        });
    }
});
