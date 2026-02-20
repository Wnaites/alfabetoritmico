// render.js - Canvas visual renderer (Playhead 4 Blocks)

const RenderEngine = (() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    let isRunning = false;

    // Efeitos visuais para os 4 blocos (pulsar quando acerta)
    let blockEffects = [0, 0, 0, 0];

    const resizeCanvas = () => {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);

    // Chamado pelo GameEngine
    const spawnTarget = (time, index) => {
        // Ignoramos a criação de objetos visuais caindo. A renderização agora é estática.
    };

    const removeTarget = (index, wasHit) => {
        const boxIndex = index % 4; // Qual dos 4 blocos do compasso?
        if (wasHit) {
            blockEffects[boxIndex] = 1.0; // Inicia animação de pulso positivo
        } else {
            blockEffects[boxIndex] = -1.0; // Pulso negativo (erro)
        }
    };

    const drawFrame = () => {
        if (!isRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const currentTime = AudioEngine.getCurrentAudioTime();
        const startTime = AudioEngine.getStartTime();

        // Garante que o garbage collector de notas corra no render pass
        GameEngine.checkMisses(currentTime);

        const bps = AudioEngine.getBPM() / 60;
        const beatDuration = 1 / bps;

        let elapsedTime = currentTime - startTime;
        if (elapsedTime < 0) elapsedTime = 0;

        // Progresso dentro de 1 semínima (0.0 no beat, 0.99 logo antes do próximo)
        let beatProgress = (elapsedTime % beatDuration) / beatDuration;

        // Configuração dos 4 Blocos Centrais (1 Beat dividido em 4 Semicolcheias)
        const blockWidth = canvas.width > 600 ? 100 : Math.floor(canvas.width / 5);
        const blockHeight = blockWidth;
        const gap = 20;
        const totalWidth = (4 * blockWidth) + (3 * gap);
        const startX = (canvas.width - totalWidth) / 2;
        const startY = (canvas.height - blockHeight) / 2;

        const currentLevel = GameEngine.getCurrentLevel();
        // Pegamos os 4 primeiros elementos do padrão (representam as 4 subdivisões)
        const basePattern = currentLevel.pattern.slice(0, 4);
        const labels = ['1', 'e', '&', 'a']; // Sílabas do método clássico

        // === 1. DESENHAR OS BLOCOS ===
        for (let i = 0; i < 4; i++) {
            const bx = startX + i * (blockWidth + gap);
            const by = startY;
            const isTarget = basePattern[i] === 'X';

            // Decair os efeitos de animação (pulso volta a 0)
            if (blockEffects[i] > 0) blockEffects[i] = Math.max(0, blockEffects[i] - 0.05);
            if (blockEffects[i] < 0) blockEffects[i] = Math.min(0, blockEffects[i] + 0.05);

            let scale = 1.0 + (Math.abs(blockEffects[i]) * 0.2); // Aumenta 20% no hit/miss

            ctx.save();
            ctx.translate(bx + blockWidth / 2, by + blockHeight / 2);
            ctx.scale(scale, scale);

            // Cor base do bloco
            if (isTarget) {
                if (blockEffects[i] > 0) {
                    ctx.fillStyle = '#2ecc71'; // Verde (Acertou!)
                } else if (blockEffects[i] < 0) {
                    ctx.fillStyle = '#e74c3c'; // Vermelho (Errou!)
                } else {
                    ctx.fillStyle = '#FF6B6B'; // Cor padrão do alvo a ser batido
                }
            } else {
                ctx.fillStyle = '#E8F8F5'; // Bloco vazio inativo (cor bem levinha)
            }

            ctx.beginPath();
            ctx.roundRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight, 15);
            ctx.fill();

            // Borda do Alvo
            if (isTarget) {
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#fff';
                ctx.stroke();
            }

            // Texto interno (1, e, &, a)
            ctx.fillStyle = isTarget ? 'white' : '#BDC3C7';
            ctx.font = `bold ${blockWidth * 0.4}px "Fredoka One"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labels[i], 0, 5);

            ctx.restore();
        }

        // === 2. DESENHAR O PLAYHEAD (A AGULHA QUE VARRE O TEMPO) ===
        // O playhead tem que cruzar exatamente o centro de cada bloco no momento certo.
        // Bloco 0 = hit no beatProgress 0.0
        // Bloco 1 = hit no beatProgress 0.25
        // Bloco 2 = hit no beatProgress 0.50
        // Bloco 3 = hit no beatProgress 0.75

        // Posição central de cada bloco
        const centers = [
            startX + (0 * (blockWidth + gap)) + (blockWidth / 2),
            startX + (1 * (blockWidth + gap)) + (blockWidth / 2),
            startX + (2 * (blockWidth + gap)) + (blockWidth / 2),
            startX + (3 * (blockWidth + gap)) + (blockWidth / 2)
        ];

        let playheadX = 0;
        if (beatProgress < 0.25) {
            let p = beatProgress / 0.25;
            playheadX = centers[0] + (centers[1] - centers[0]) * p;
        } else if (beatProgress < 0.50) {
            let p = (beatProgress - 0.25) / 0.25;
            playheadX = centers[1] + (centers[2] - centers[1]) * p;
        } else if (beatProgress < 0.75) {
            let p = (beatProgress - 0.50) / 0.25;
            playheadX = centers[2] + (centers[3] - centers[2]) * p;
        } else {
            let p = (beatProgress - 0.75) / 0.25;
            let centerNext = centers[3] + (blockWidth + gap);
            playheadX = centers[3] + (centerNext - centers[3]) * p;
        }

        ctx.beginPath();
        ctx.moveTo(playheadX, startY - 30);
        ctx.lineTo(playheadX, startY + blockHeight + 30);
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)'; // Teal
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(playheadX, startY - 30, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#4ECDC4';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(playheadX, startY + blockHeight + 30, 10, 0, Math.PI * 2);
        ctx.fill();

        requestAnimationFrame(drawFrame);
    };

    const start = () => {
        resizeCanvas();
        if (isRunning) return;
        isRunning = true;
        blockEffects = [0, 0, 0, 0];
        requestAnimationFrame(drawFrame);
    };

    const stop = () => {
        isRunning = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return {
        start,
        stop,
        spawnTarget,
        removeTarget
    };
})();
