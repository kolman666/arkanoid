// Arkanoid — игровой цикл, поле, ракетка (Vaus), мяч и кирпичи.
// Весь функционал изолирован внутри класса Arkanoid, чтобы не пересекаться
// с чужим кодом на странице.

(function () {
    'use strict';

    const BORDER = 12;

    // Параметры сетки кирпичей.
    const BRICK = {
        cols: 11,
        rows: 8,
        top: 60,
        gap: 3,
        height: 20
    };

    // Типы кирпичей: цвет, очки, прочность (hits), indestructible.
    // Буква — символ в схемах уровней ниже.
    const BRICK_TYPES = {
        r: { fill: '#e0483c', score: 90, hits: 1 },
        o: { fill: '#e08a3c', score: 80, hits: 1 },
        b: { fill: '#3c74e0', score: 70, hits: 1 },
        g: { fill: '#40c060', score: 60, hits: 1 },
        p: { fill: '#d84cd8', score: 50, hits: 1 },
        y: { fill: '#e0d43c', score: 40, hits: 1 },
        c: { fill: '#4bc8ff', score: 30, hits: 1 },
        s: { fill: '#b8bcd0', score: 120, hits: 2 },              // серебро — 2 удара
        X: { fill: '#d9c34a', score: 0, hits: Infinity, gold: true } // золото — не разбить
    };

    // Схемы уровней. Каждая строка — ряд из 11 символов ('.' — пусто).
    const LEVELS = [
        [
            'rrrrrrrrrrr',
            'ooooooooooo',
            'bbbbbbbbbbb',
            'ggggggggggg',
            'ppppppppppp',
            'yyyyyyyyyyy',
            'ccccccccccc'
        ],
        [
            'sssssssssss',
            'r.r.r.r.r.r',
            '.o.o.o.o.o.',
            'b.b.b.b.b.b',
            '.g.g.g.g.g.',
            'yyyyyyyyyyy',
            'sssssssssss'
        ],
        [
            '.....r.....',
            '....ooo....',
            '...bbbbb...',
            '..ggggggg..',
            '.ppppppppp.',
            'yyyyyyyyyyy',
            'X.X.X.X.X.X'
        ],
        [
            'X.........X',
            'X.sssssss.X',
            'X.s.r.r.s.X',
            'X.s.ooo.s.X',
            'X.s.bbb.s.X',
            'X.sssssss.X',
            'X.........X'
        ]
    ];

    // ---- Ракетка игрока (Vaus) -------------------------------------------
    class Paddle {
        constructor(field) {
            this.field = field;
            this.baseWidth = 84;
            this.height = 16;
            this.speed = 480;
            this.reset();
        }

        reset() {
            this.width = this.baseWidth;
            this.targetWidth = this.baseWidth;
            this.sticky = false;   // режим «ловушка» (бонус Catch)
            this.laser = false;    // режим лазера (бонус Laser)
            this.x = (this.field.left + this.field.right) / 2 - this.width / 2;
            this.y = this.field.bottom - 48;
        }

        get centerX() {
            return this.x + this.width / 2;
        }

        expand() { this.targetWidth = Math.min(140, this.targetWidth + 36); }
        shrinkToBase() { this.targetWidth = this.baseWidth; }

        // Плавная анимация изменения ширины вокруг центра.
        update(dt) {
            if (Math.abs(this.width - this.targetWidth) > 0.5) {
                const cx = this.centerX;
                this.width += (this.targetWidth - this.width) * Math.min(1, dt * 10);
                this.x = cx - this.width / 2;
                this._clamp();
            }
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

            // Пушки при активном лазере.
            if (this.laser) {
                ctx.fillStyle = '#d0d0e0';
                ctx.fillRect(x + 8, y - 6, 4, 6);
                ctx.fillRect(x + w - 12, y - 6, 4, 6);
            }
        }
    }

    // ---- Мяч -------------------------------------------------------------
    class Ball {
        constructor(field) {
            this.field = field;
            this.radius = 7;
            this.speed = 300;
            this.stuck = true; // «приклеен» к ракетке до запуска
            this.stickOffset = 0;
            this.vx = 0;
            this.vy = 0;
            this.x = 0;
            this.y = 0;
        }

        // Поворачивает вектор скорости на заданный угол (для мультимяча).
        rotate(rad) {
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const vx = this.vx * cos - this.vy * sin;
            const vy = this.vx * sin + this.vy * cos;
            this.vx = vx;
            this.vy = vy;
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

            if (paddle.sticky) {
                this.stuck = true;
                this.stickOffset = this.x - paddle.centerX;
            }
        }

        stickTo(paddle) {
            this.x = paddle.centerX + (this.stickOffset || 0);
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

    // ---- Кирпич ----------------------------------------------------------
    class Brick {
        constructor(x, y, w, h, def) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.fill = def.fill;
            this.score = def.score;
            this.hits = def.hits;
            this.gold = !!def.gold;
            this.alive = true;
            this.flash = 0; // короткая вспышка при попадании
        }

        get destructible() {
            return this.hits !== Infinity;
        }

        // Возвращает true, если кирпич разрушен этим попаданием.
        hit() {
            this.flash = 1;
            if (!this.destructible) return false;
            this.hits--;
            if (this.hits <= 0) {
                this.alive = false;
                return true;
            }
            return false;
        }

        update(dt) {
            if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
        }

        draw(ctx) {
            if (!this.alive) return;
            const { x, y, w, h } = this;
            ctx.fillStyle = this.fill;
            ctx.fillRect(x, y, w, h);

            // Объёмная фаска: светлый верх/лево, тёмный низ/право.
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(x, y, w, 2);
            ctx.fillRect(x, y, 2, h);
            ctx.fillStyle = 'rgba(0,0,0,0.30)';
            ctx.fillRect(x, y + h - 2, w, 2);
            ctx.fillRect(x + w - 2, y, 2, h);

            // Золото — металлический блик по диагонали.
            if (this.gold) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(x + 3, y + 3, w - 6, 2);
            }
            // Серебро с 2 HP — насечка по центру.
            if (this.hits === 2) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6);
            }
            // Вспышка попадания.
            if (this.flash > 0) {
                ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.7) + ')';
                ctx.fillRect(x, y, w, h);
            }
        }
    }

    // ---- Бонусы (капсулы) ------------------------------------------------
    // Тип: буква, цвет, вероятность выпадения.
    const POWERUPS = [
        { type: 'expand', letter: 'E', color: '#e08a3c' }, // расширить ракетку
        { type: 'catch',  letter: 'C', color: '#40c060' }, // ловить мяч
        { type: 'slow',   letter: 'S', color: '#3c74e0' }, // замедлить мяч
        { type: 'multi',  letter: 'D', color: '#4bc8ff' }, // тройной мяч
        { type: 'laser',  letter: 'L', color: '#e0483c' }, // лазер
        { type: 'life',   letter: 'P', color: '#d0d0e0' }  // доп. жизнь
    ];

    class Capsule {
        constructor(x, y, def) {
            this.x = x;
            this.y = y;
            this.w = 30;
            this.h = 14;
            this.vy = 130;
            this.type = def.type;
            this.letter = def.letter;
            this.color = def.color;
            this.dead = false;
            this.phase = Math.random() * Math.PI * 2;
        }

        update(dt, bottom) {
            this.y += this.vy * dt;
            this.phase += dt * 8;
            if (this.y > bottom) this.dead = true;
        }

        caught(paddle) {
            return this.y + this.h >= paddle.y &&
                this.y <= paddle.y + paddle.height &&
                this.x + this.w > paddle.x &&
                this.x < paddle.x + paddle.width;
        }

        draw(ctx) {
            const { x, y, w, h } = this;
            // Пульсирующее свечение капсулы.
            const glow = 0.6 + 0.4 * Math.sin(this.phase);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = glow;
            roundRect(ctx, x, y, w, h, 7);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            roundRect(ctx, x, y, w, 3, 2);
            ctx.fill();
            // Буква бонуса.
            ctx.fillStyle = '#111';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.letter, x + w / 2, y + h / 2 + 1);
        }
    }

    // ---- Лазерный выстрел ------------------------------------------------
    class Laser {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.w = 3;
            this.h = 12;
            this.vy = -520;
            this.dead = false;
        }

        update(dt, top) {
            this.y += this.vy * dt;
            if (this.y + this.h < top) this.dead = true;
        }

        draw(ctx) {
            ctx.fillStyle = '#ff5a4a';
            ctx.fillRect(this.x - this.w / 2, this.y, this.w, this.h);
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x - 1, this.y, 1, this.h);
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
            this.balls = [new Ball(this.field)];
            this.capsules = [];
            this.lasers = [];
            this.fireCooldown = 0;
            this.input.onLaunch = () => this._onLaunch();

            // Состояние партии.
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.state = 'menu'; // menu | ready | playing | gameover | win
            this.time = 0; // для мигающих подсказок

            this.bricks = this._buildBricks();

            this.lastTime = 0;
            this._loop = this._loop.bind(this);
        }

        // Строит сетку кирпичей по схеме текущего уровня.
        _buildBricks() {
            const bricks = [];
            const scheme = LEVELS[(this.level - 1) % LEVELS.length];
            const usable = this.field.right - this.field.left;
            const w = (usable - BRICK.gap * (BRICK.cols + 1)) / BRICK.cols;
            for (let r = 0; r < scheme.length; r++) {
                const row = scheme[r];
                for (let c = 0; c < BRICK.cols; c++) {
                    const ch = row[c];
                    const def = BRICK_TYPES[ch];
                    if (!def) continue; // '.' — пустая клетка
                    const x = this.field.left + BRICK.gap + c * (w + BRICK.gap);
                    const y = BRICK.top + r * (BRICK.height + BRICK.gap);
                    bricks.push(new Brick(x, y, w, BRICK.height, def));
                }
            }
            return bricks;
        }

        // Столкновение одного мяча с кирпичами. Отражаем по оси наименьшего
        // перекрытия, чтобы отскок выглядел естественно.
        _collideBricks(b) {
            for (const brick of this.bricks) {
                if (!brick.alive) continue;
                if (b.x + b.radius < brick.x || b.x - b.radius > brick.x + brick.w ||
                    b.y + b.radius < brick.y || b.y - b.radius > brick.y + brick.h) {
                    continue;
                }

                const overlapL = (b.x + b.radius) - brick.x;
                const overlapR = (brick.x + brick.w) - (b.x - b.radius);
                const overlapT = (b.y + b.radius) - brick.y;
                const overlapB = (brick.y + brick.h) - (b.y - b.radius);
                const minX = Math.min(overlapL, overlapR);
                const minY = Math.min(overlapT, overlapB);

                if (minX < minY) {
                    b.vx = -b.vx;
                } else {
                    b.vy = -b.vy;
                }

                const destroyed = brick.hit();
                if (destroyed) {
                    this.score += brick.score;
                    this._maybeDropCapsule(brick);
                }
                break; // один кирпич за кадр — достаточно
            }
        }

        // Разрушенный кирпич с некоторым шансом роняет бонус-капсулу.
        _maybeDropCapsule(brick) {
            if (Math.random() > 0.16) return;
            const def = POWERUPS[(Math.random() * POWERUPS.length) | 0];
            const cx = brick.x + brick.w / 2 - 15;
            this.capsules.push(new Capsule(cx, brick.y, def));
        }

        // Применение подобранного бонуса.
        _applyPowerup(type) {
            switch (type) {
                case 'expand':
                    this.paddle.expand();
                    break;
                case 'catch':
                    this.paddle.sticky = true;
                    break;
                case 'slow':
                    for (const b of this.balls) {
                        b.speed = Math.max(210, b.speed - 60);
                        this._rescale(b);
                    }
                    break;
                case 'multi':
                    this._multiBall();
                    break;
                case 'laser':
                    this.paddle.laser = true;
                    break;
                case 'life':
                    this.lives++;
                    break;
            }
        }

        // Приводит модуль скорости мяча к текущему b.speed.
        _rescale(b) {
            const mag = Math.hypot(b.vx, b.vy) || 1;
            b.vx = (b.vx / mag) * b.speed;
            b.vy = (b.vy / mag) * b.speed;
        }

        // Тройной мяч: каждый летящий мяч даёт две копии под углом.
        _multiBall() {
            const extra = [];
            for (const b of this.balls) {
                if (b.stuck) continue;
                for (const a of [-0.4, 0.4]) {
                    const clone = new Ball(this.field);
                    clone.stuck = false;
                    clone.speed = b.speed;
                    clone.x = b.x;
                    clone.y = b.y;
                    clone.vx = b.vx;
                    clone.vy = b.vy;
                    clone.rotate(a);
                    extra.push(clone);
                }
            }
            this.balls.push(...extra);
        }

        // Считаем только разрушаемые кирпичи — золото не мешает победе.
        get bricksLeft() {
            let n = 0;
            for (const b of this.bricks) if (b.alive && b.destructible) n++;
            return n;
        }

        // Гибель последнего мяча: минус жизнь, при нуле — конец игры.
        _loseLife() {
            this.lives--;
            this.capsules.length = 0;
            this.lasers.length = 0;
            this.paddle.reset();
            this.balls = [new Ball(this.field)];
            if (this.lives <= 0) {
                this.state = 'gameover';
            } else {
                this.state = 'ready';
            }
        }

        start() {
            requestAnimationFrame(this._loop);
        }

        _onLaunch() {
            if (this.state === 'menu') {
                this.state = 'ready';
            } else if (this.state === 'ready') {
                this.state = 'playing';
                for (const b of this.balls) b.launch();
            } else if (this.state === 'playing') {
                const stuck = this.balls.filter((b) => b.stuck);
                if (stuck.length) {
                    // Отпустить пойманные мячи (режим Catch).
                    for (const b of stuck) { b.stuck = false; b.launch(); b.stickOffset = 0; }
                } else if (this.paddle.laser) {
                    this._fireLasers();
                }
            } else if (this.state === 'gameover' || this.state === 'win') {
                this._restart();
            }
        }

        _restart() {
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.capsules.length = 0;
            this.lasers.length = 0;
            this.bricks = this._buildBricks();
            this.paddle.reset();
            this.balls = [new Ball(this.field)];
            this.state = 'ready';
        }

        _nextLevel() {
            this.level++;
            this.capsules.length = 0;
            this.lasers.length = 0;
            this.bricks = this._buildBricks();
            this.paddle.reset();
            const ball = new Ball(this.field);
            ball.speed += 20 * (this.level - 1); // с уровнем становится быстрее
            this.balls = [ball];
            this.state = 'ready';
        }

        _loop(time) {
            const dt = Math.min((time - this.lastTime) / 1000, 0.05);
            this.lastTime = time;
            this._update(dt);
            this._render();
            requestAnimationFrame(this._loop);
        }

        _update(dt) {
            this.time += dt;
            if (this.state === 'menu' || this.state === 'gameover' || this.state === 'win') return;

            if (this.input.mouseX !== null) this.paddle.moveTo(this.input.mouseX);
            if (this.input.left) this.paddle.move(-1, dt);
            if (this.input.right) this.paddle.move(1, dt);
            this.paddle.update(dt);

            for (const brick of this.bricks) brick.update(dt);

            // Мячи.
            const survivors = [];
            for (const b of this.balls) {
                if (b.stuck) {
                    b.stickTo(this.paddle);
                    survivors.push(b);
                    continue;
                }
                const alive = b.update(dt);
                this._collideBricks(b);
                b.bounceOffPaddle(this.paddle);
                if (alive) survivors.push(b);
            }
            this.balls = survivors;

            if (this.balls.length === 0) {
                this._loseLife();
                return;
            }

            this._updateCapsules(dt);
            this._updateLasers(dt);

            if (this.bricksLeft === 0) {
                if (this.level >= 4) this.state = 'win';
                else this._nextLevel();
            }
        }

        _fireLasers() {
            if (this.fireCooldown > 0) return;
            const p = this.paddle;
            this.lasers.push(new Laser(p.x + 10, p.y));
            this.lasers.push(new Laser(p.x + p.width - 10, p.y));
            this.fireCooldown = 0.18;
        }

        _updateLasers(dt) {
            if (this.fireCooldown > 0) this.fireCooldown -= dt;
            const kept = [];
            for (const laser of this.lasers) {
                laser.update(dt, this.field.top);
                if (laser.dead) continue;
                // Столкновение с кирпичами.
                let hit = false;
                for (const brick of this.bricks) {
                    if (!brick.alive) continue;
                    if (laser.x > brick.x && laser.x < brick.x + brick.w &&
                        laser.y < brick.y + brick.h && laser.y > brick.y) {
                        const destroyed = brick.hit();
                        if (destroyed) {
                            this.score += brick.score;
                            this._maybeDropCapsule(brick);
                        }
                        hit = true; // выстрел гасится о любой кирпич (включая золото)
                        break;
                    }
                }
                if (!hit) kept.push(laser);
            }
            this.lasers = kept;
        }

        _updateCapsules(dt) {
            const kept = [];
            for (const cap of this.capsules) {
                cap.update(dt, this.field.bottom);
                if (cap.caught(this.paddle)) {
                    this._applyPowerup(cap.type);
                    this.score += 100;
                    continue;
                }
                if (!cap.dead) kept.push(cap);
            }
            this.capsules = kept;
        }

        _render() {
            const ctx = this.ctx;
            ctx.fillStyle = '#0b0b16';
            ctx.fillRect(0, 0, this.width, this.height);
            for (const brick of this.bricks) brick.draw(ctx);
            for (const cap of this.capsules) cap.draw(ctx);
            for (const laser of this.lasers) laser.draw(ctx);
            this.paddle.draw(ctx);
            for (const b of this.balls) b.draw(ctx);
            this._drawBorders();
            this._drawHUD();
            this._drawOverlay();
        }

        _drawHUD() {
            const ctx = this.ctx;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textBaseline = 'middle';

            ctx.textAlign = 'left';
            ctx.fillText('SCORE ' + this.score, BORDER + 6, 34);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#4bc8ff';
            ctx.fillText('LV ' + this.level, this.width / 2, 34);

            // Жизни — миниатюрные ракетки справа.
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e0483c';
            ctx.fillText('♥'.repeat(Math.max(0, this.lives)), this.width - BORDER - 6, 34);
        }

        _drawOverlay() {
            const ctx = this.ctx;

            if (this.state === 'menu') {
                this._drawMenu();
                return;
            }

            let title = null;
            let subtitle = null;

            if (this.state === 'ready') {
                subtitle = 'ПРОБЕЛ / КЛИК — запуск мяча';
            } else if (this.state === 'gameover') {
                title = 'GAME OVER';
                subtitle = 'Нажмите ПРОБЕЛ для новой игры';
            } else if (this.state === 'win') {
                title = 'ПОБЕДА!';
                subtitle = 'Нажмите ПРОБЕЛ для новой игры';
            }
            if (!title && !subtitle) return;

            if (title) {
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(0, 0, this.width, this.height);
                ctx.fillStyle = '#e0d43c';
                ctx.font = 'bold 40px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(title, this.width / 2, this.height / 2 - 20);
            }
            if (subtitle) {
                ctx.fillStyle = '#fff';
                ctx.font = '15px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const y = title ? this.height / 2 + 24 : this.paddle.y - 40;
                ctx.fillText(subtitle, this.width / 2, y);
            }
        }

        // Стартовый экран с обучением: заголовок, управление и легенда бонусов.
        _drawMenu() {
            const ctx = this.ctx;
            const cx = this.width / 2;

            ctx.fillStyle = 'rgba(4,4,12,0.82)';
            ctx.fillRect(0, 0, this.width, this.height);

            // Заголовок с лёгкой пульсацией.
            const pulse = 1 + 0.03 * Math.sin(this.time * 3);
            ctx.save();
            ctx.translate(cx, 120);
            ctx.scale(pulse, pulse);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e0d43c';
            ctx.font = 'bold 52px monospace';
            ctx.fillText('ARKANOID', 0, 0);
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#4bc8ff';
            ctx.font = '15px monospace';
            ctx.fillText('P E P P E R S   E D I T I O N', cx, 158);

            // Управление.
            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('УПРАВЛЕНИЕ', cx, 210);
            ctx.fillStyle = '#c8c8e0';
            ctx.font = '13px monospace';
            ctx.fillText('← →  или  мышь — движение ракетки', cx, 236);
            ctx.fillText('ПРОБЕЛ / КЛИК — запуск мяча и выстрел', cx, 258);

            // Легенда бонусов.
            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.fillText('БОНУСЫ', cx, 300);

            const legend = [
                ['E', '#e08a3c', 'шире ракетка'],
                ['C', '#40c060', 'ловить мяч'],
                ['S', '#3c74e0', 'замедление'],
                ['D', '#4bc8ff', 'тройной мяч'],
                ['L', '#e0483c', 'лазер'],
                ['P', '#d0d0e0', 'доп. жизнь']
            ];
            ctx.textAlign = 'left';
            ctx.font = 'bold 12px monospace';
            const startY = 326;
            for (let i = 0; i < legend.length; i++) {
                const [letter, color, text] = legend[i];
                const col = i % 2;
                const rowY = startY + Math.floor(i / 2) * 30;
                const x = cx - 150 + col * 160;
                ctx.fillStyle = color;
                roundRect(ctx, x, rowY - 9, 22, 14, 5);
                ctx.fill();
                ctx.fillStyle = '#111';
                ctx.textAlign = 'center';
                ctx.fillText(letter, x + 11, rowY - 1);
                ctx.fillStyle = '#c8c8e0';
                ctx.textAlign = 'left';
                ctx.font = '12px monospace';
                ctx.fillText(text, x + 30, rowY - 1);
                ctx.font = 'bold 12px monospace';
            }

            // Мигающая подсказка старта.
            if (Math.sin(this.time * 4) > -0.3) {
                ctx.textAlign = 'center';
                ctx.fillStyle = '#e0d43c';
                ctx.font = 'bold 18px monospace';
                ctx.fillText('НАЖМИТЕ ПРОБЕЛ', cx, 470);
            }
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
