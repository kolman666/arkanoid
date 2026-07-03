// Arkanoid — игровой цикл, поле и ракетка (Vaus).
// Весь функционал изолирован внутри класса Arkanoid, чтобы не пересекаться
// с чужим кодом на странице.

(function () {
    'use strict';

    const BORDER = 12;

    // ---- Ракетка игрока (Vaus) -------------------------------------------
    class Paddle {
        constructor(field) {
            this.field = field;
            this.width = 84;
            this.height = 16;
            this.speed = 480; // px/сек при управлении с клавиатуры
            this.reset();
        }

        reset() {
            this.x = (this.field.left + this.field.right) / 2 - this.width / 2;
            this.y = this.field.bottom - 48;
        }

        get centerX() {
            return this.x + this.width / 2;
        }

        moveTo(centerX) {
            this.x = centerX - this.width / 2;
            this._clamp();
        }

        move(dir, dt) {
            this.x += dir * this.speed * dt;
            this._clamp();
        }

        _clamp() {
            if (this.x < this.field.left) this.x = this.field.left;
            const max = this.field.right - this.width;
            if (this.x > max) this.x = max;
        }

        draw(ctx) {
            const { x, y, width: w, height: h } = this;

            // Корпус с градиентом «металл + красные капы».
            const grad = ctx.createLinearGradient(0, y, 0, y + h);
            grad.addColorStop(0, '#e8e8f4');
            grad.addColorStop(0.5, '#9aa0c0');
            grad.addColorStop(1, '#5a6090');
            ctx.fillStyle = grad;
            this._roundRect(ctx, x, y, w, h, 8);
            ctx.fill();

            // Красные торцы.
            ctx.fillStyle = '#e0483c';
            this._roundRect(ctx, x, y, 16, h, 8);
            ctx.fill();
            this._roundRect(ctx, x + w - 16, y, 16, h, 8);
            ctx.fill();

            // Синее «ядро».
            ctx.fillStyle = '#4bc8ff';
            ctx.fillRect(x + w / 2 - 6, y + 4, 12, h - 8);
        }

        _roundRect(ctx, x, y, w, h, r) {
            r = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
    }

    // ---- Ввод ------------------------------------------------------------
    class Input {
        constructor(canvas) {
            this.left = false;
            this.right = false;
            this.mouseX = null;

            window.addEventListener('keydown', (e) => this._key(e, true));
            window.addEventListener('keyup', (e) => this._key(e, false));
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
            });
        }

        _key(e, down) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.left = down;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.right = down;
        }
    }

    // ---- Игра ------------------------------------------------------------
    class Arkanoid {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.width = canvas.width;
            this.height = canvas.height;

            this.field = {
                left: BORDER,
                right: this.width - BORDER,
                top: BORDER,
                bottom: this.height
            };

            this.input = new Input(canvas);
            this.paddle = new Paddle(this.field);

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
            // Управление ракеткой: мышь имеет приоритет, если двигалась.
            if (this.input.mouseX !== null) {
                this.paddle.moveTo(this.input.mouseX);
            }
            if (this.input.left) this.paddle.move(-1, dt);
            if (this.input.right) this.paddle.move(1, dt);
        }

        _render() {
            const ctx = this.ctx;
            ctx.fillStyle = '#0b0b16';
            ctx.fillRect(0, 0, this.width, this.height);
            this.paddle.draw(ctx);
            this._drawBorders();
        }

        _drawBorders() {
            const ctx = this.ctx;
            ctx.fillStyle = '#c0c0d0';
            ctx.fillRect(0, 0, this.width, BORDER);
            ctx.fillRect(0, 0, BORDER, this.height);
            ctx.fillRect(this.width - BORDER, 0, BORDER, this.height);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(0, 0, this.width, 3);
        }
    }

    const canvas = document.getElementById('game');
    const game = new Arkanoid(canvas);
    game.start();
})();
