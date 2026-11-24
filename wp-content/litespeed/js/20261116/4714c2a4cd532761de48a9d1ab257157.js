document.addEventListener('DOMContentLoaded', function () {
    const slider = document.querySelector('#uniformaHeroSlider');

    if (slider) {
        const track = slider.querySelector('#uniformaHeroTrack');
        const slides = Array.from(track.querySelectorAll('.uniforma-hero'));
        const dots = Array.from(slider.querySelectorAll('[data-slide]'));
        const counter = slider.querySelector('.uniforma-hero-slider__current');
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let current = 0;
        let timer = null;
        let touchStartX = 0;

        const show = function (index, userInitiated) {
            current = (index + slides.length) % slides.length;
            track.style.transform = 'translateX(-' + (current * 100) + '%)';
            slides.forEach(function (slide, slideIndex) {
                const active = slideIndex === current;
                slide.classList.toggle('is-active', active);
                slide.setAttribute('aria-hidden', active ? 'false' : 'true');
                slide.querySelectorAll('a, button').forEach(function (control) {
                    if (active) control.removeAttribute('tabindex');
                    else control.setAttribute('tabindex', '-1');
                });
            });
            dots.forEach(function (dot, dotIndex) {
                const active = dotIndex === current;
                dot.classList.toggle('is-active', active);
                dot.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            if (counter) counter.textContent = String(current + 1).padStart(2, '0');
            if (userInitiated) restart();
        };

        const stop = function () {
            if (timer) window.clearInterval(timer);
            timer = null;
        };

        const start = function () {
            if (reduceMotion || slides.length < 2 || timer) return;
            timer = window.setInterval(function () { show(current + 1, false); }, 6500);
        };

        const restart = function () {
            stop();
            start();
        };

        slider.querySelector('.uniforma-hero-slider__arrow--prev')?.addEventListener('click', function () { show(current - 1, true); });
        slider.querySelector('.uniforma-hero-slider__arrow--next')?.addEventListener('click', function () { show(current + 1, true); });
        dots.forEach(function (dot) { dot.addEventListener('click', function () { show(Number(dot.dataset.slide), true); }); });
        slider.addEventListener('mouseenter', stop);
        slider.addEventListener('mouseleave', start);
        slider.addEventListener('focusin', stop);
        slider.addEventListener('focusout', start);
        slider.addEventListener('touchstart', function (event) { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
        slider.addEventListener('touchend', function (event) {
            const distance = event.changedTouches[0].clientX - touchStartX;
            if (Math.abs(distance) > 45) show(current + (distance < 0 ? 1 : -1), true);
        }, { passive: true });
        document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
        show(0, false);
        start();
    }

    const bestTrack = document.querySelector('#uniformaBestTrack');
    if (bestTrack) {
        const move = function (direction) {
            const card = bestTrack.querySelector('.uniforma-product-card');
            bestTrack.scrollBy({ left: direction * ((card?.offsetWidth || 260) + 24), behavior: 'smooth' });
        };
        document.querySelector('#uniformaBestPrev')?.addEventListener('click', function () { move(-1); });
        document.querySelector('#uniformaBestNext')?.addEventListener('click', function () { move(1); });
    }
});
