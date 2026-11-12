/* ============================================================================
   DOMIDELIS · TEMA NAVIDEÑO (Diciembre) — navidad.js v1
   Compañero de navidad.css · Prefijo: xm-
   Misma API que HalloweenTheme: init / destroy / forceShow / toggle / isActive
   NUEVO: celebración del carrito (gorro de Santa, nieve al agregar, trineo vacío)
   Temporada por defecto: 01-dic → 06-ene (Día de Reyes)
   ============================================================================ */
var NavidadTheme = (function () {
    'use strict';

    var _active = false;
    var _config = null;
    var _moveTimers = [];
    var _counterObserver = null;
    var _itemsObserver = null;
    var _dayNightTimer = null;
    var _lastCelebrate = 0;
    var _cartCountPrev = null;
    var _emptyOriginal = null;

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var BULB_COLORS = ['red', 'gold', 'green'];

    var DEFAULTS = {
        startDate: '12-01',            // MM-DD: 1 de diciembre
        endDate: '01-06',              // MM-DD: 6 de enero (Día de Reyes)
        storageKey: 'navidad_v1',
        cartButtonSelector: '#header-cart',
        cartCounterSelector: '#cart-counter',
        cartItemsSelector: '#cart-items',
        cartEmptySelector: '.cart-empty',
        cartEmptyText: '🛷 ¡Tu trineo está vacío! Agrégale algo rico 🎁',
        decorations: [
            { emoji: '🎁', name: 'regalo', className: 'xm-decoration--regalo' },
            { emoji: '🔔', name: 'campana', className: 'xm-decoration--campana' },
            { emoji: '⛄', name: 'muñeco de nieve', className: 'xm-decoration--muneco' },
            { emoji: '🍭', name: 'caramelo', className: 'xm-decoration--caramelo' }
        ]
    };

    var SPOTS = [12, 28, 50, 72, 88, 40, 62];
    var BURST_PARTICLES = ['✨', '❄️', '⭐', '🎁', '❄️', '🔔'];
    var CART_PARTICLES = ['❄️', '🎁', '✨', '⭐', '🔔', '❄️'];

    /* ---------- utilidades de fecha y preferencias ---------- */

    function _todayMMDD() {
        var date = new Date();
        return String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    function _inSeason(start, end) {
        var today = _todayMMDD();
        if (start > end) return today >= start || today <= end; /* cruza el año nuevo */
        return today >= start && today <= end;
    }

    function _getFlag(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function _setFlag(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('No se pudo guardar la preferencia de Navidad:', error);
        }
    }

    /* ---------- helpers SVG ---------- */

    function _svgElement(name, attributes) {
        var element = document.createElementNS(SVG_NS, name);
        Object.keys(attributes || {}).forEach(function (key) {
            element.setAttribute(key, attributes[key]);
        });
        return element;
    }

    /* Guirnalda de pino con nieve y bombillas tricolor */
    function _createGarland(isBottom) {
        var vine = isBottom ?
            'M -20 19 C 110 8 230 22 350 14 S 540 5 650 17 S 850 22 980 12 S 1120 8 1220 19' :
            'M -20 5 C 110 16 230 2 350 10 S 540 19 650 7 S 850 2 980 12 S 1120 16 1220 5';
        var wire = isBottom ?
            'M -20 21 C 110 10 230 24 350 16 S 540 7 650 19 S 850 24 980 14 S 1120 10 1220 21' :
            'M -20 3 C 110 14 230 0 350 8 S 540 17 650 5 S 850 0 980 10 S 1120 14 1220 3';

        var svg = _svgElement('svg', {
            class: isBottom ? 'xm-garland xm-garland--bottom xm-bottom-garland' : 'xm-garland',
            viewBox: '0 0 1200 24',
            preserveAspectRatio: 'none',
            'aria-hidden': 'true'
        });
        if (isBottom) svg.id = 'xm-bottom-garland';

        svg.appendChild(_svgElement('path', { class: 'xm-light-wire', d: wire }));
        svg.appendChild(_svgElement('path', { class: 'xm-vine', d: vine }));
        /* La nieve se dibuja 2.5px arriba de la rama, como capa acumulada */
        svg.appendChild(_svgElement('path', {
            class: 'xm-snowcap',
            d: vine,
            transform: 'translate(0 -2.5)'
        }));

        for (var i = 0; i < 21; i += 1) {
            var x = 20 + i * 58;
            var y = (isBottom ? 15 : 9) + Math.sin(i * 0.92) * 2;
            var angle = Math.sin(i * 1.7) * 48;

            svg.appendChild(_svgElement('path', {
                class: i % 2 ? 'xm-needle' : 'xm-needle xm-needle--light',
                d: isBottom ?
                    'M 0 0 C -7 -5 -8 -10 0 -12 C 8 -10 7 -5 0 0 Z' :
                    'M 0 0 C -7 5 -8 10 0 12 C 8 10 7 5 0 0 Z',
                transform: 'translate(' + x + ' ' + y + ') rotate(' + angle + ')'
            }));

            var bulb = _svgElement('circle', {
                class: 'xm-bulb xm-bulb--' + BULB_COLORS[i % 3],
                cx: x + 9,
                cy: y + 2,
                r: 2.6
            });
            bulb.style.animationDelay = (-i * 0.35) + 's';
            svg.appendChild(bulb);
        }

        return svg;
    }

    /* ---------- nieve cayendo (18 copos + 6 de emoji) ---------- */

    function _createSnow() {
        var layer = document.createElement('div');
        layer.id = 'xm-snow';
        layer.className = 'xm-snow';
        layer.setAttribute('aria-hidden', 'true');

        function addFlake(className, emoji) {
            var isEmoji = className === 'xm-flake xm-flake--emoji';
            var flake = document.createElement('span');
            flake.className = className;
            if (emoji) flake.textContent = emoji;
            flake.style.setProperty('--xm-left', (Math.random() * 98) + '%');
            flake.style.setProperty('--xm-size', isEmoji ?
                (10 + Math.random() * 8) + 'px' : (2 + Math.random() * 3) + 'px');
            flake.style.setProperty('--xm-duration', isEmoji ?
                (12 + Math.random() * 8) + 's' : (9 + Math.random() * 9) + 's');
            flake.style.setProperty('--xm-delay', (-Math.random() * (isEmoji ? 20 : 18)) + 's');
            flake.style.setProperty('--xm-drift', ((Math.random() * 90 - 45)) + 'px');
            flake.style.setProperty('--xm-opacity', (0.35 + Math.random() * 0.45).toFixed(2));
            layer.appendChild(flake);
        }

        var i;
        for (i = 0; i < 18; i += 1) addFlake('xm-flake');
        for (i = 0; i < 6; i += 1) addFlake('xm-flake xm-flake--emoji', i % 2 ? '❄️' : '❅');

        return layer;
    }

    /* ---------- adornos interactivos ---------- */

    function _setPosition(element, index) {
        element.dataset.spot = String(index);
        element.style.left = SPOTS[index] + '%';
    }

    function _createBurstAt(x, y, particles) {
        particles.forEach(function (emoji, index) {
            var particle = document.createElement('span');
            var angle = (Math.PI * 2 * index) / particles.length;
            particle.className = 'xm-burst';
            particle.textContent = emoji;
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--xm-x', Math.cos(angle) * 48 + 'px');
            particle.style.setProperty('--xm-y', Math.sin(angle) * 48 + 'px');
            document.body.appendChild(particle);
            particle.addEventListener('animationend', function () {
                if (particle.parentNode) particle.parentNode.removeChild(particle);
            }, { once: true });
        });
    }

    function _createBurst(element) {
        var rect = element.getBoundingClientRect();
        _createBurstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, BURST_PARTICLES);
    }

    function _relocate(element) {
        var occupied = Array.prototype.map.call(
            document.querySelectorAll('.xm-decoration'),
            function (decoration) {
                return decoration === element ? -1 : Number(decoration.dataset.spot);
            }
        );
        var available = SPOTS.map(function (_, index) {
            return index;
        }).filter(function (index) {
            return index !== Number(element.dataset.spot) && occupied.indexOf(index) === -1;
        });

        if (!available.length) return;
        _setPosition(element, available[Math.floor(Math.random() * available.length)]);
    }

    function _animateDecoration(element) {
        if (element.classList.contains('xm-decoration--moving')) return;

        var isGift = element.classList.contains('xm-decoration--regalo');
        var isBell = element.classList.contains('xm-decoration--campana');
        if (isGift) _createBurst(element);
        element.classList.add('xm-decoration--moving');

        var delay = isGift ? 620 : (isBell ? 850 : 220);
        var timer = window.setTimeout(function () {
            if (!_active || !element.parentNode) return;
            _relocate(element);
            element.classList.remove('xm-decoration--moving');
            element.classList.add('xm-decoration--reappearing');
            element.focus({ preventScroll: true });

            element.addEventListener('animationend', function () {
                element.classList.remove('xm-decoration--reappearing');
            }, { once: true });
        }, delay);

        _moveTimers.push(timer);
    }

    function _createScene() {
        var scene = document.createElement('div');
        var available = SPOTS.map(function (_, index) {
            return index;
        });

        scene.id = 'xm-scene';
        scene.className = 'xm-scene';
        scene.setAttribute('aria-label', 'Guirnalda interactiva navideña');
        scene.appendChild(_createGarland(false));

        _config.decorations.forEach(function (decoration) {
            var item = document.createElement('button');
            var availableIndex = Math.floor(Math.random() * available.length);

            item.type = 'button';
            item.className = 'xm-decoration ' + decoration.className;
            item.textContent = decoration.emoji;
            item.setAttribute('aria-label', 'Mover ' + decoration.name);
            item.title = 'Tócame para moverme';
            _setPosition(item, available.splice(availableIndex, 1)[0]);
            item.addEventListener('click', function () {
                _animateDecoration(item);
            });
            scene.appendChild(item);
        });

        return scene;
    }

    function _createDismiss() {
        var button = document.createElement('button');
        button.id = 'xm-dismiss';
        button.className = 'xm-dismiss';
        button.type = 'button';
        button.setAttribute('aria-label', 'Ocultar decoración navideña');
        button.title = 'Ocultar decoración';
        button.textContent = '✕';
        button.addEventListener('click', function () {
            _setFlag(_config.storageKey, 'disabled');
            _hide();
        });
        return button;
    }

    /* ---------- 🛒 EL CARRITO ENTRA EN ESCENA ---------- */

    function _cartButton() {
        return _config ? document.querySelector(_config.cartButtonSelector) : null;
    }

    /* Explosión navideña + salto del botón + regalo volador.
       Se dispara sola cuando el contador del carrito sube
       (MutationObserver sobre #cart-counter) o a mano con
       NavidadTheme.celebrarCarrito(). */
    function _celebrateCart(force) {
        if (!_active) return;
        var now = Date.now();
        if (!force && now - _lastCelebrate < 400) return;
        _lastCelebrate = now;

        var button = _cartButton();
        if (!button) return;

        var rect = button.getBoundingClientRect();
        _createBurstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, CART_PARTICLES);

        button.classList.remove('xm-cart-bump');
        void button.offsetWidth; /* reinicia la animación */
        button.classList.add('xm-cart-bump');
        var bumpTimer = window.setTimeout(function () {
            button.classList.remove('xm-cart-bump');
        }, 550);
        _moveTimers.push(bumpTimer);

        var gift = document.createElement('span');
        gift.className = 'xm-gift-fly';
        gift.textContent = '🎁';
        gift.style.left = (rect.left + rect.width / 2 - 12) + 'px';
        gift.style.top = (rect.top - 8) + 'px';
        gift.style.setProperty('--xm-x', (Math.random() * 80 - 40) + 'px');
        document.body.appendChild(gift);
        gift.addEventListener('animationend', function () {
            if (gift.parentNode) gift.parentNode.removeChild(gift);
        }, { once: true });
    }

    /* Si el carrito vuelve a quedar vacío (cliente.js regenera el bloque),
       volvemos a dejar el mensaje navideño del trineo */
    function _applyEmptyText() {
        var items = document.querySelector(_config.cartItemsSelector);
        if (!items) return;
        var empty = items.querySelector(_config.cartEmptySelector);
        if (empty && empty.textContent !== _config.cartEmptyText) {
            if (_emptyOriginal === null) _emptyOriginal = empty.textContent;
            empty.textContent = _config.cartEmptyText;
        }
    }

    function _restoreEmptyText() {
        if (_emptyOriginal === null) return;
        var items = document.querySelector(_config.cartItemsSelector);
        if (!items) return;
        var empty = items.querySelector(_config.cartEmptySelector);
        if (empty) empty.textContent = _emptyOriginal;
        _emptyOriginal = null;
    }

    function _observeCart() {
        var counter = document.querySelector(_config.cartCounterSelector);
        if (counter && typeof MutationObserver === 'function') {
            _cartCountPrev = counter.textContent;
            _counterObserver = new MutationObserver(function () {
                var value = counter.textContent.trim();
                if (value === _cartCountPrev) return;
                var prevNum = parseInt(_cartCountPrev, 10) || 0;
                var nextNum = parseInt(value, 10) || 0;
                _cartCountPrev = value;
                if (nextNum > prevNum) _celebrateCart(false);
            });
            _counterObserver.observe(counter, { childList: true, characterData: true, subtree: true });
        }

        var items = document.querySelector(_config.cartItemsSelector);
        if (items && typeof MutationObserver === 'function') {
            _itemsObserver = new MutationObserver(function () {
                _applyEmptyText();
            });
            _itemsObserver.observe(items, { childList: true });
        }

        _applyEmptyText();
    }

    function _unobserveCart() {
        if (_counterObserver) {
            _counterObserver.disconnect();
            _counterObserver = null;
        }
        if (_itemsObserver) {
            _itemsObserver.disconnect();
            _itemsObserver = null;
        }
        _restoreEmptyText();
    }

    /* ---------- 🌕 luna grande con gorrito (fija, centrada, no hace scroll) ---------- */

    function _createMoon() {
        var moon = document.createElement('div');
        var hat = document.createElement('div');

        moon.id = 'xm-bigmoon';
        moon.className = 'xm-bigmoon';
        moon.setAttribute('aria-hidden', 'true');
        hat.className = 'xm-bigmoon-hat';
        hat.innerHTML = '<span class="xm-bigmoon-hat-pom"></span>';
        moon.appendChild(hat);
        return moon;
    }

    function _createDayVillage() {
        var village = document.createElement('div');
        village.id = 'xm-day-village';
        village.className = 'xm-day-village';
        village.setAttribute('aria-hidden', 'true');
        village.innerHTML = '<svg viewBox="0 0 1200 280" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">' +
            '<path fill="#f7fcff" d="M0 224Q150 185 300 220T600 215t300 8 300-16v73H0z"/>' +
            '<path fill="#d9edfb" d="M0 253q180-36 350 0t350-1 300-8 200 4v32H0z"/>' +
            '<g stroke="#6688a1" stroke-width="4" stroke-linejoin="round">' +
            '<path fill="#c94b4b" d="M105 203v-74l65-51 66 51v74z"/><path fill="#fff" d="m99 132 71-59 72 59-12 9-60-49-59 49z"/>' +
            '<path fill="#ffe2a8" d="M158 151h25v52h-25z"/><path fill="#9ed7ed" d="M124 145h22v22h-22z"/>' +
            '<path fill="#e1a34b" d="M387 214v-95l78-61 80 61v95z"/><path fill="#fff" d="m376 126 89-72 91 72-13 12-78-61-76 61z"/>' +
            '<path fill="#9ed7ed" d="M415 139h25v25h-25zm83 0h25v25h-25z"/><path fill="#fff" d="M450 174h28v40h-28z"/>' +
            '<path fill="#b84a4a" d="M690 207v-69l59-47 60 47v69z"/><path fill="#fff" d="m682 145 67-55 69 55-11 10-58-46-57 46z"/>' +
            '<path fill="#9ed7ed" d="M710 153h22v22h-22z"/><path fill="#fff" d="M750 170h24v37h-24z"/>' +
            '</g>' +
            '<g fill="#28664b" stroke="#1d513c" stroke-width="3" stroke-linejoin="round">' +
            '<path d="m284 205 39-77 39 77z"/><path d="m290 174 33-65 33 65z"/><path d="m298 145 25-53 26 53z"/><path d="M318 202h11v27h-11z"/>' +
            '<path d="m835 213 47-91 46 91z"/><path d="m844 175 38-73 38 73z"/><path d="m852 142 30-58 30 58z"/><path d="M876 209h13v30h-13z"/>' +
            '<path d="m1010 218 35-68 35 68z"/><path d="m1017 188 28-56 29 56z"/><path d="m1023 162 22-44 23 44z"/><path d="M1040 214h11v25h-11z"/>' +
            '</g>' +
            '<g fill="#fff"><circle cx="169" cy="113" r="13"/><circle cx="465" cy="97" r="14"/><circle cx="749" cy="127" r="12"/><ellipse cx="323" cy="204" rx="43" ry="9"/><ellipse cx="882" cy="211" rx="49" ry="9"/><ellipse cx="1045" cy="216" rx="37" ry="8"/></g>' +
            '<g fill="#ffd166"><circle cx="136" cy="174" r="5"/><circle cx="463" cy="154" r="5"/><circle cx="761" cy="164" r="5"/></g>' +
            '</svg>';
        return village;
    }

    function _isDaytimeInBogota() {
        var hour = Number(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Bogota',
            hour: 'numeric',
            hourCycle: 'h23'
        }).format(new Date()));
        return hour >= 6 && hour < 16;
    }

    function _updateDayNight() {
        if (!document.body) return;
        var daytime = _isDaytimeInBogota();
        document.body.classList.toggle('xm-navidad-dia', daytime);
        document.body.classList.toggle('xm-navidad-noche', !daytime);
    }

    /* ---------- mostrar / ocultar ---------- */

    function _show() {
        if (_active || !document.body) return;

        document.body.appendChild(_createMoon());
        document.body.appendChild(_createDayVillage());
        document.body.appendChild(_createSnow());
        document.body.appendChild(_createScene());
        document.body.appendChild(_createGarland(true));
        document.body.appendChild(_createDismiss());
        document.body.classList.add('xm-navidad-active');
        _updateDayNight();
        _dayNightTimer = window.setInterval(_updateDayNight, 60000);
        _observeCart();
        _active = true;
    }

    function _hide() {
        _moveTimers.forEach(function (timer) {
            window.clearTimeout(timer);
        });
        _moveTimers = [];
        if (_dayNightTimer !== null) {
            window.clearInterval(_dayNightTimer);
            _dayNightTimer = null;
        }
        _unobserveCart();

        ['xm-bigmoon', 'xm-day-village', 'xm-scene', 'xm-bottom-garland', 'xm-snow', 'xm-dismiss'].forEach(function (id) {
            var element = document.getElementById(id);
            if (element && element.parentNode) element.parentNode.removeChild(element);
        });
        if (document.body) {
            document.body.classList.remove('xm-navidad-active', 'xm-navidad-dia', 'xm-navidad-noche');
        }
        _active = false;
    }

    /* ---------- API pública ---------- */

    return {
        init: function (options) {
            _config = Object.assign({}, DEFAULTS, options || {});
            if (_getFlag(_config.storageKey) === 'disabled') return;
            if (!_inSeason(_config.startDate, _config.endDate)) return;
            _show();
        },
        destroy: function () {
            _hide();
        },
        /* Para probar fuera de temporada: NavidadTheme.forceShow() */
        forceShow: function (options) {
            _config = Object.assign({}, DEFAULTS, options || {});
            _setFlag(_config.storageKey, 'enabled');
            _hide();
            _show();
        },
        toggle: function () {
            if (_active) {
                _setFlag(_config.storageKey, 'disabled');
                _hide();
            } else {
                _setFlag(_config.storageKey, 'enabled');
                _show();
            }
        },
        /* Llámala desde cliente.js al agregar producto si quieres
           forzar la celebración aunque el contador no cambie de dígito */
        celebrarCarrito: function () {
            _celebrateCart(true);
        },
        isActive: function () {
            return _active;
        }
    };
})();
