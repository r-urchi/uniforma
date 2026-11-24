document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('#uniformaShopFilters');

    if (!form) return;

    const panel = form.querySelector('.uniforma-shop-filters__panel');
    const mobile = window.matchMedia('(max-width: 767px)');

    // Escritorio: filtros siempre visibles. Mobile: plegados hasta que se abren.
    const syncPanel = function () {
        if (!panel) return;
        if (mobile.matches) {
            if (!panel.dataset.userToggled) panel.open = false;
        } else {
            panel.open = true;
        }
    };

    if (panel) {
        panel.addEventListener('toggle', function () {
            if (mobile.matches) panel.dataset.userToggled = '1';
        });
        syncPanel();
        mobile.addEventListener('change', syncPanel);
    }

    // Con JS el filtro se aplica al elegir; el botón queda como alternativa sin JS.
    form.classList.add('is-enhanced');
    form.querySelectorAll('select').forEach(function (select) {
        select.addEventListener('change', function () {
            form.submit();
        });
    });
});
