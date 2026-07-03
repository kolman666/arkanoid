// Arkanoid — игровой цикл, поле, ракетка (Vaus) и мяч.
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
            this.speed = 480;
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
            const grad = ctx.createLinearGradient(0, y, 0, y + h);
            grad.addColorStop(0, '#e8e8f4');
            grad.addColorStop(0.5, '#9aa0c0');
            grad.addColorStop(1, '#5a6090');
            ctx.fillStyle = grad;
            roundRect(ctx, x, y, w, h, 8);
            ctx.fill();

            ctx.fillStyle = '#e0483c';
            roundRect(ctx, x, y, 16, h, 8);
            ctx.fill();
            roundRect(ctx, x + w - 16, y, 16, h, 8);
            ctx.fill();

            ctx.fillStyle = '#4bc8ff';
            ctx.fillRect(x + w / 2 - 6, y + 4, 12, h - 8);
        }
    }

    // ---- Мяч -------------------------------------------------------------
    class Ball {
        constructor(field) {
            this.field = field;
            this.radius = 7;
            this.speed = 300;
            this.stuck = true; // «приклеен» к ракетке до запуска
            this.vx = 0;
            this.vy = 0;
            this.x = 0;
            this.y = 0;
        }

        launch() {
            if (!this.stuck) return;
            this.stuck = false;
            const angle = -Math.PI / 3; // вверх-вправо на старте
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
        }

        // Возвращает false, если мяч упал за нижний край.
        update(dt) {
            if (this.stuck) return true;

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            const f = this.field;
            if (this.x - this.radius < f.left) {
                this.x = f.left + this.radius;
                this.vx = Math.abs(this.vx);
            } else if (this.x + this.radius > f.right) {
                this.x = f.right - this.radius;
                this.vx = -Math.abs(this.vx);
            }
            if (this.y - this.radius < f.top) {
                this.y = f.top + this.radius;
                this.vy = Math.abs(this.vy);
            }

            return this.y - this.radius <= f.bottom;
        }

        // Отскок от ракетки: угол зависит от точки касания.
        bounceOffPaddle(paddle) {
            if (this.vy <= 0) return;
            const withinX = this.x + this.radius > paddle.x &&
                this.x - this.radius < paddle.x + paddle.width;
            const atLevel = this.y + this.radius >= paddle.y &&
                this.y - this.radius < paddle.y + paddle.height;
            if (!withinX || !atLevel) return;

            const hit = (this.x - paddle.centerX) / (paddle.width / 2); // -1..1
            const angle = hit * (Math.PI / 3); // до 60° от вертикали
            this.vx = Math.sin(angle) * this.speed;
            this.vy = -Math.abs(Math.cos(angle) * this.speed);
            this.y = paddle.y - this.radius - 0.5;
        }

        stickTo(paddle) {
            this.x = paddle.centerX;
            this.y = paddle.y - this.radius - 1;
        }

        draw(ctx) {
            const grad = ctx.createRadialGradient(
                this.x - 2, this.y - 2, 1,
                this.x, this.y, this.radius
            );
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#c8c8ff');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ---- Ввод ------------------------------------------------------------
    class Input {
        constructor(canvas) {
            this.left = false;
            this.right = false;
            this.mouseX = null;
            this.onLaunch = null;

            window.addEventListener('keydown', (e) => this._key(e, true));
            window.addEventListener('keyup', (e) => this._key(e, false));
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
            });
            canvas.addEventListener('mousedown', () => {
                if (this.onLaunch) this.onLaunch();
            });
        }

        _key(e, down) {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.left = down;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.right = down;
            if (down && e.code === 'Space' && this.onLaunch) this.onLaunch();
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
            this.ball = new Ball(this.field);
            this.input.onLaunch = () => this.ball.launch();

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
            if (this.input.mouseX !== null) this.paddle.moveTo(this.input.mouseX);
            if (this.input.left) this.paddle.move(-1, dt);
            if (this.input.right) this.paddle.move(1, dt);

            if (this.ball.stuck) {
                this.ball.stickTo(this.paddle);
            } else {
                const alive = this.ball.update(dt);
                this.ball.bounceOffPaddle(this.paddle);
                if (!alive) {
                    // Пока просто возвращаем мяч на ракетку.
                    this.ball.stuck = true;
                }
            }
        }

        _render() {
            const ctx = this.ctx;
            ctx.fillStyle = '#0b0b16';
            ctx.fillRect(0, 0, this.width, this.height);
            this.paddle.draw(ctx);
            this.ball.draw(ctx);
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

    // ---- Утилиты ---------------------------------------------------------
    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    const canvas = document.getElementById('game');
    const game = new Arkanoid(canvas);
    game.start();
})();
