(function ($) {
    'use strict';
    let running = false;
    const status = $('#uniforma-status');
    function request(action, data) {
        return $.ajax({url: UniformaFotosNov.url, type: 'POST', timeout: 120000,
            data: $.extend({action: 'uniforma_fotonov_' + action, nonce: UniformaFotosNov.nonce}, data || {})});
    }
    function busy(value) {
        running = value;
        $('#uniforma-review, #uniforma-reset, #uniforma-start, .uniforma-target').prop('disabled', value);
    }
    function failed(xhr) {
        busy(false);
        const data = xhr && xhr.responseJSON && xhr.responseJSON.data;
        status.text((data && data.message) || 'La conexión se interrumpió. Podés reanudar la carga.');
    }
    function show(data) {
        status.text(data.message + ' Productos: ' + data.completed + '/' + data.total + '. Fotos nuevas: ' + data.created + '; reutilizadas: ' + data.reused + '.');
        $('#uniforma-progress').val(data.percent);
    }
    function step() {
        if (!running) return;
        request('step').done(function (r) {
            if (!r.success) { busy(false); status.text(r.data.message); return; }
            show(r.data);
            if (r.data.done) { busy(false); $('#uniforma-start').text('Carga completada'); return; }
            window.setTimeout(step, 200);
        }).fail(failed);
    }
    $('#uniforma-review').on('click', function () {
        if (running) return;
        const selection = {};
        $('.uniforma-target').each(function () { selection[$(this).data('key')] = $(this).val() || 0; });
        busy(true); status.text('Revisando productos y colores…');
        request('review', {selection: JSON.stringify(selection)}).done(function (r) {
            busy(false);
            if (!r.success) { status.text(r.data.message); $('#uniforma-start').prop('disabled', true); return; }
            const box = $('#uniforma-review-results').empty();
            const table = $('<table class="widefat striped"><thead><tr><th>Producto</th><th>Destino</th><th>Fotos</th><th>Resultado</th></tr></thead></table>');
            const body = $('<tbody>').appendTo(table);
            r.data.rows.forEach(function (row) {
                const tr = $('<tr>').appendTo(body);
                [row.product, row.target, row.images, row.message].forEach(function (text) { $('<td>').text(text).appendTo(tr); });
            });
            box.append(table); status.text(r.data.message);
            $('#uniforma-start').prop('disabled', !r.data.ready);
        }).fail(function (xhr) { failed(xhr); $('#uniforma-start').prop('disabled', true); });
    });
    $('.uniforma-target').on('change', function () {
        $('#uniforma-start').prop('disabled', true);
        status.text('Cambiaste una coincidencia. Volvé a revisar antes de iniciar.');
    });
    $('#uniforma-start').on('click', function () {
        if (running) return;
        busy(true);
        request('start').done(function (r) {
            if (!r.success) { busy(false); status.text(r.data.message); return; }
            show(r.data);
            if (r.data.done) { busy(false); return; }
            step();
        }).fail(failed);
    });
    $('#uniforma-reset').on('click', function () {
        if (running || !window.confirm('¿Reiniciar el progreso? Los productos, fotos y respaldos ya guardados se conservan.')) return;
        busy(true);
        request('reset').done(function (r) {
            busy(false); status.text(r.data.message); $('#uniforma-start').prop('disabled', true).text('Iniciar / reanudar carga');
            $('#uniforma-progress').val(0); $('#uniforma-review-results').empty();
        }).fail(failed);
    });
})(jQuery);
