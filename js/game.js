// Arkanoid — игровой цикл и базовый класс.
// Весь функционал изолирован внутри класса Arkanoid, чтобы не пересекаться
// с чужим кодом на странице.

(function () {
    'use strict';

    // Размеры рамки игрового поля (как металлический бортик в оригинале).
    const BORDER = 12;

    class Arkanoid {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.width = canvas.width;
            this.height = canvas.height;

            // Границы игровой зоны (внутри рамки).
            this.field = {
                left: BORDER,
                right: this.width - BORDER,
                top: BORDER,
                bottom: this.height
            };

            this.lastTime = 0;
            this._loop = this._loop.bind(this);
        }

        start() {
            requestAnimationFrame(this._loop);
        }

        _loop(time) {
            const dt = Math.min((time - this.lastTime) / 1000, 0.05);
            this.lastTime = time;

            this._update(dt);
            this._render();

            requestAnimationFrame(this._loop);
        }

        _update(dt) {
            // Логика появится на следующих этапах.
        }

        _render() {
            const ctx = this.ctx;

            // Фон.
            ctx.fillStyle = '#0b0b16';
            ctx.fillRect(0, 0, this.width, this.height);

            this._drawBorders();
        }

        // Металлический бортик поля сверху и по бокам.
        _drawBorders() {
            const ctx = this.ctx;
            ctx.fillStyle = '#c0c0d0';
            ctx.fillRect(0, 0, this.width, BORDER);                  // верх
            ctx.fillRect(0, 0, BORDER, this.height);                 // лево
            ctx.fillRect(this.width - BORDER, 0, BORDER, this.height); // право

            // Блик на рамке.
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(0, 0, this.width, 3);
        }
    }

    const canvas = document.getElementById('game');
    const game = new Arkanoid(canvas);
    game.start();
})();
