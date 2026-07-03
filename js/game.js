// Arkanoid — точка входа.
// Весь функционал изолирован внутри одного класса, чтобы не пересекаться
// с чужим кодом на странице.

(function () {
    'use strict';

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');

    // Пока просто заливаем поле — каркас готов.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
})();
