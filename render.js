// render.js - Canvas visual renderer

const RenderEngine = (() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');

    let isRunning = false;
    let visualTargets = []; // [{targetTime: float, hitStatus: 'none'|'hit'|'miss'}]

    // Setup viewport/canvas dimensions dynamically
    const resizeCanvas = () => {
        // Encaixa no tamanho do wrapper
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);

    // Velocidade de queda. "2" Segundos de antecedência visível caindo.
    const PREFALL_TIME = 2.0;

    const spawnTarget = (audioTime) => {
        visualTargets.push({
            targetTime: audioTime,
            hitStatus: 'none' // 'hit', 'miss' (usado para animar e esconder)
        });
    };

    const removeTarget = (audioTime, wasHit) => {
        const t = visualTargets.find(t => Math.abs(t.targetTime - audioTime) < 0.01);
        if (t) {
            t.hitStatus = wasHit ? 'hit' : 'miss';
        }
    };

    const drawFrame = () => {
        if (!isRunning) return;

        // Limpa a tela
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Tempo atual do áudio (linha de chegada)
        const currentTime = AudioEngine.getCurrentAudioTime();

        // O GameEngine precisa chegar se perdeu notas
        GameEngine.checkMisses(currentTime);

        const trackX = canvas.width / 2;
        const hitStartY = canvas.height - 100; // Onde fica a "Linha Central" de batida

        // Desenha a zona alvo - Círculo na base
        ctx.beginPath();
        ctx.arc(trackX, hitStartY, 40, 0, Math.PI * 2);

        // Pulsa a zona alvo nos tempos pares (beats) se quisermos
        const bps = GameEngine.getBPM() / 60;
        const beatPulsar = (currentTime * bps) % 1;

        ctx.fillStyle = `rgba(78, 205, 196, ${0.2 + (beatPulsar < 0.1 ? 0.3 : 0)})`;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'var(--secondary-color)';
        ctx.stroke();

        // Obtém hitwindows em Segundos para desenhar sombras
        const diffWins = GameEngine.getCurrentDifficultyObj();

        // Velocidade Y em Pixels por Segundo (A tela inteira até a linha representa PREFALL_TIME)
        const PIXELS_PER_SEC = hitStartY / PREFALL_TIME;

        // Desenhar indicador da janela 'Good'
        const winHeightGood = diffWins.good * PIXELS_PER_SEC * 2; // Dobro pq é +/- offset do centro
        ctx.fillStyle = 'rgba(241, 196, 15, 0.2)'; // amarelo
        ctx.fillRect(trackX - 60, hitStartY - (winHeightGood / 2), 120, winHeightGood);

        // Desenhar indicador da janela 'Perfect'
        const winHeightPerfect = diffWins.perfect * PIXELS_PER_SEC * 2;
        ctx.fillStyle = 'rgba(46, 204, 113, 0.4)'; // verde
        ctx.fillRect(trackX - 60, hitStartY - (winHeightPerfect / 2), 120, winHeightPerfect);

        // Desenha os alvos caindo
        visualTargets.forEach((target, index) => {
            // Se já bateu e sumiu faz tempo, limpar da memoria
            if (target.hitStatus !== 'none' && currentTime > target.targetTime + 0.5) {
                target.deleteMe = true;
                return;
            }

            // Distância em segundos entre onde o alvo deveria estar vs tempo atual (0 = agora, + = falta x seg, - = já passou)
            let timeToHit = target.targetTime - currentTime;

            // Se ainda não apareceu na tela (falta > que PREFALL_TIME)
            if (timeToHit > PREFALL_TIME + 0.5) return;

            // Y invertido. timeToHit positivo fica para "cima" (hitStartY - distanciaY)
            let targetY = hitStartY - (timeToHit * PIXELS_PER_SEC);

            // Animação de hit/miss
            let scale = 1.0;
            let alpha = 1.0;

            if (target.hitStatus === 'hit') {
                scale = 1.5;
                alpha = 0.0; // Desaparece rápido num Puf
            } else if (target.hitStatus === 'miss') {
                alpha = 0.3; // Fica cinzinha chuvoso caindo infinito
            }

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(trackX, targetY);
            ctx.scale(scale, scale);

            // Desenhar "A nota musical"
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fillStyle = target.hitStatus === 'miss' ? '#BDC3C7' : '#FF6B6B';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'white';
            ctx.stroke();

            // Símbolo musical de semicolcheia
            ctx.fillStyle = 'white';
            ctx.font = '30px "Fredoka One"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♪', 0, 2);

            ctx.restore();
        });

        // Limpeza de array (evitar VAZAMENTO de memoria do canvas array)
        visualTargets = visualTargets.filter(t => !t.deleteMe);

        requestAnimationFrame(drawFrame);
    };

    const start = () => {
        resizeCanvas();
        if (isRunning) return;
        isRunning = true;
        visualTargets = [];
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
