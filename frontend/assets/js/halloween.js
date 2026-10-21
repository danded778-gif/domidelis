var HalloweenTheme = (function () {
    'use strict';

    var _active = false;
    var _config = null;
    var _moveTimers = [];

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var DEFAULTS = {
        startDate: '10-01',
        endDate: '11-02',
        storageKey: 'halloween_v6',
        decorations: [
            { emoji: '🎃', name: 'calabaza', className: 'hw-decoration--pumpkin' },
            { emoji: '👻', name: 'fantasma', className: 'hw-decoration--ghost' },
            { emoji: '🦇', name: 'murciélago', className: 'hw-decoration--bats' },
            { emoji: '🧙‍♀️', name: 'bruja', className: 'hw-decoration--witch' }
        ]
    };

    var SPOTS = [14, 27, 68, 82, 42, 58];

    function _todayMMDD() {
        var date = new Date();
        return String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0');
    }

    function _inSeason(start, end) {
        var today = _todayMMDD();
        if (start > end) return today >= start || today <= end;
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
            console.warn('No se pudo guardar la preferencia de Halloween:', error);
        }
    }

    function _svgElement(name, attributes) {
        var element = document.createElementNS(SVG_NS, name);
        Object.keys(attributes || {}).forEach(function (key) {
            element.setAttribute(key, attributes[key]);
        });
        return element;
    }

    function _createGarland(isBottom) {
        var vine = isBottom ?
            'M -20 17 C 110 6 230 20 350 12 S 540 3 650 15 S 850 20 980 10 S 1120 6 1220 17' :
            'M -20 3 C 110 14 230 0 350 8 S 540 17 650 5 S 850 0 980 10 S 1120 14 1220 3';
        var wire = isBottom ?
            'M -20 19 C 110 8 230 22 350 14 S 540 5 650 17 S 850 22 980 12 S 1120 8 1220 19' :
            'M -20 1 C 110 12 230 -2 350 6 S 540 15 650 3 S 850 -2 980 8 S 1120 12 1220 1';
        var svg = _svgElement('svg', {
            class: isBottom ? 'hw-garland hw-garland--bottom hw-bottom-garland' : 'hw-garland',
            viewBox: '0 0 1200 20',
            preserveAspectRatio: 'none',
            'aria-hidden': 'true'
        });
        if (isBottom) svg.id = 'hw-bottom-garland';

        svg.appendChild(_svgElement('path', { class: 'hw-light-wire', d: wire }));
        svg.appendChild(_svgElement('path', { class: 'hw-vine', d: vine }));

        for (var i = 0; i < 21; i += 1) {
            var x = 20 + i * 58;
            var y = (isBottom ? 13 : 7) + Math.sin(i * 0.92) * 2;
            var angle = Math.sin(i * 1.7) * 48;

            svg.appendChild(_svgElement('path', {
                class: i % 2 ? 'hw-leaf' : 'hw-leaf hw-leaf--light',
                d: isBottom ?
                    'M 0 0 C -7 -5 -8 -10 0 -12 C 8 -10 7 -5 0 0 Z' :
                    'M 0 0 C -7 5 -8 10 0 12 C 8 10 7 5 0 0 Z',
                transform: 'translate(' + x + ' ' + y + ') rotate(' + angle + ')'
            }));
            svg.appendChild(_svgElement('circle', {
                class: 'hw-bulb',
                cx: x + 9,
                cy: y + 2,
                r: 2.4
            }));
        }

        return svg;
    }

    function _createFallingLeaves() {
        var layer = document.createElement('div');
        var leaves = ['🍂', '🍁', '🍂', '🍁'];

        layer.id = 'hw-falling-leaves';
        layer.className = 'hw-falling-leaves';
        layer.setAttribute('aria-hidden', 'true');

        leaves.forEach(function (emoji) {
            var leaf = document.createElement('span');
            leaf.className = 'hw-falling-leaf';
            leaf.textContent = emoji;
            leaf.style.setProperty('--hw-left', (5 + Math.random() * 90) + '%');
            leaf.style.setProperty('--hw-size', (12 + Math.random() * 9) + 'px');
            leaf.style.setProperty('--hw-duration', (10 + Math.random() * 7) + 's');
            leaf.style.setProperty('--hw-delay', (-Math.random() * 15) + 's');
            layer.appendChild(leaf);
        });

        return layer;
    }

    function _setPosition(element, index) {
        element.dataset.spot = String(index);
        element.style.left = SPOTS[index] + '%';
    }

    function _createBurst(element) {
        var rect = element.getBoundingClientRect();
        var particles = ['✨', '🦇', '🍬', '✨', '⭐', '🦇'];

        particles.forEach(function (emoji, index) {
            var particle = document.createElement('span');
            var angle = (Math.PI * 2 * index) / particles.length;
            particle.className = 'hw-burst';
            particle.textContent = emoji;
            particle.style.left = rect.left + rect.width / 2 + 'px';
            particle.style.top = rect.top + rect.height / 2 + 'px';
            particle.style.setProperty('--hw-x', Math.cos(angle) * 48 + 'px');
            particle.style.setProperty('--hw-y', Math.sin(angle) * 48 + 'px');
            element.parentNode.appendChild(particle);
            particle.addEventListener('animationend', function () {
                if (particle.parentNode) particle.parentNode.removeChild(particle);
            }, { once: true });
        });
    }

    function _relocate(element) {
        var occupied = Array.prototype.map.call(
            document.querySelectorAll('.hw-decoration'),
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
        if (element.classList.contains('hw-decoration--moving')) return;

        var isPumpkin = element.classList.contains('hw-decoration--pumpkin');
        if (isPumpkin) _createBurst(element);
        element.classList.add('hw-decoration--moving');

        var timer = window.setTimeout(function () {
            if (!_active || !element.parentNode) return;
            _relocate(element);
            element.classList.remove('hw-decoration--moving');
            element.classList.add('hw-decoration--reappearing');
            element.focus({ preventScroll: true });

            element.addEventListener('animationend', function () {
                element.classList.remove('hw-decoration--reappearing');
            }, { once: true });
        }, isPumpkin ? 620 : 220);

        _moveTimers.push(timer);
    }

    function _createScene() {
        var scene = document.createElement('div');
        var available = SPOTS.map(function (_, index) {
            return index;
        });

        scene.id = 'hw-scene';
        scene.className = 'hw-scene';
        scene.setAttribute('aria-label', 'Guirnalda interactiva de Halloween');
        scene.appendChild(_createGarland(false));

        _config.decorations.forEach(function (decoration) {
            var item = document.createElement('button');
            var availableIndex = Math.floor(Math.random() * available.length);

            item.type = 'button';
            item.className = 'hw-decoration ' + decoration.className;
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
        button.id = 'hw-dismiss';
        button.className = 'hw-dismiss';
        button.type = 'button';
        button.setAttribute('aria-label', 'Ocultar decoración de Halloween');
        button.title = 'Ocultar decoración';
        button.textContent = '✕';
        button.addEventListener('click', function () {
            _setFlag(_config.storageKey, 'disabled');
            _hide();
        });
        return button;
    }

    function _show() {
        if (_active || !document.body) return;

        document.body.appendChild(_createScene());
        document.body.appendChild(_createGarland(true));
        document.body.appendChild(_createFallingLeaves());
        document.body.appendChild(_createDismiss());
        document.body.classList.add('hw-halloween-active');
        _active = true;
    }

    function _hide() {
        _moveTimers.forEach(function (timer) {
            window.clearTimeout(timer);
        });
        _moveTimers = [];

        ['hw-scene', 'hw-bottom-garland', 'hw-falling-leaves', 'hw-dismiss'].forEach(function (id) {
            var element = document.getElementById(id);
            if (element && element.parentNode) element.parentNode.removeChild(element);
        });
        if (document.body) document.body.classList.remove('hw-halloween-active');
        _active = false;
    }

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
        isActive: function () {
            return _active;
        }
    };
})();
