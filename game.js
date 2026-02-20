// game.js - Jogo Rítmico Core Logic

const GameEngine = (() => {
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let stats = { perfects: 0, goods: 0, misses: 0 };

    // Configurações de Dificuldade (Em segundos de tolerância)
    const hitWindows = {
        easy: { perfect: 0.150, good: 0.300 }, // Crianças pequenas: margem enorme de acerto
        medium: { perfect: 0.080, good: 0.150 }, // Crianças maiores: margem moderada
        hard: { perfect: 0.050, good: 0.100 }  // Mais velhas: margem rigorosa
    };

    let currentWindow = hitWindows.medium;

    // Fila de notas (alvos) agendadas pelo AudioEngine
    // [{ beatNumber: int, time: float, hit: boolean }]
    let scheduledNotes = [];

    // O Alfabeto Rítmico (Simplificado para o Jogo)
    // 1 Vazio = silêncio. 1 'X' = Nota a ser tocada.
    // O padrão tem 16 posições correspondentes a um compasso 4/4 subdividido em semicolcheias
    const patterns = [
        // A - Semínimas
        ['X', '.', '.', '.', 'X', '.', '.', '.', 'X', '.', '.', '.', 'X', '.', '.', '.'],
        // B - Colcheias
        ['X', '.', 'X', '.', 'X', '.', 'X', '.', 'X', '.', 'X', '.', 'X', '.', 'X', '.'],
        // C - Offbeats
        ['.', '.', 'X', '.', '.', '.', 'X', '.', '.', '.', 'X', '.', '.', '.', 'X', '.'],
        // D - Primeira e Terceira
        ['X', '.', 'X', '.', '.', '.', '.', '.', 'X', '.', 'X', '.', '.', '.', '.', '.']
    ];

    let currentPatternIndex = 0;

    const reset = (difficulty) => {
        score = 0;
        combo = 0;
        maxCombo = 0;
        stats = { perfects: 0, goods: 0, misses: 0 };
        currentWindow = hitWindows[difficulty] || hitWindows.medium;
        scheduledNotes = [];
        currentPatternIndex = 0; // Inicia nas semínimas sempre
        UI.updateScore(score, combo);
    };

    const registerMetronomeTick = (sixteenthIndex, time) => {
        // Obter o padrão atual
        const pattern = patterns[currentPatternIndex];

        // Se a subdivisão atual do metrônomo corresponder a um 'X' no padrão, agendamos um alvo!
        if (pattern[sixteenthIndex] === 'X') {
            scheduledNotes.push({
                index: sixteenthIndex,
                time: time,
                hit: false, // O jogador acertou essa?
                missProcessed: false // Já descontamos os pontos de erro?
            });
            // Avisa o renderizador que um bloco alvo precisa começar a cair
            if (window.RenderEngine) {
                RenderEngine.spawnTarget(time);
            }
        }

        // Troca o padrão a cada 2 compassos inteiros (semicolcheia 0 significa reset do compasso)
        // Simplificação MVP: só gira os padrões ad aeternum
        if (sixteenthIndex === 15 && Math.random() > 0.5) {
            currentPatternIndex = (currentPatternIndex + 1) % patterns.length;
        }
    };

    // Chamado pelo audio.js quando o microfone bate o limite
    const handlePlayerHit = (audioContextTime) => {
        // Encontra a nota alvo que está mais próxima DESTE EXATO TEMPO (audioContextTime)
        // que ainda não foi acertada

        let bestTarget = null;
        let bestDiff = 999;

        for (let target of scheduledNotes) {
            if (target.hit || target.missProcessed) continue;

            const diff = Math.abs(target.time - audioContextTime);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestTarget = target;
            }
        }

        if (bestTarget) {
            evaluateHit(bestTarget, bestDiff);
        } else {
            // Tocou muito fora ou de bobeira: quebra combo
            breakCombo();
            UI.showFeedback('miss', 'No vazio...');
        }
    };

    const evaluateHit = (target, diffTime) => {
        // Diferença absoluta de tempo para o alvo

        if (diffTime <= currentWindow.perfect) {
            // Perfeito!
            target.hit = true;
            stats.perfects++;
            combo++;
            score += 100 * combo;
            UI.updateScore(score, combo);
            UI.showFeedback('perfect', 'Perfeito!');
            updateMaxCombo();
            if (window.RenderEngine) RenderEngine.removeTarget(target.time, true);

        } else if (diffTime <= currentWindow.good) {
            // Bom, quase cravado
            target.hit = true;
            stats.goods++;
            combo++;
            score += 50 * combo;
            UI.updateScore(score, combo);
            UI.showFeedback('good', 'Bom!');
            updateMaxCombo();
            if (window.RenderEngine) RenderEngine.removeTarget(target.time, true);

        } else {
            // Fora da janela: Ignora este "hit" isolado para não roubar hits de alvos futuros próximos
            // Deixa o garbage collector de erros pegar
            // Não mexemos no target.hit ainda.
        }
    };

    // Garbage collector para limpar notas que o jogador deixou passar direto
    const checkMisses = (currentTime) => {
        // Uma nota foi "perdida" se o tempo dela + janela 'good' já ficou para trás
        for (let target of scheduledNotes) {
            if (!target.hit && !target.missProcessed && currentTime > (target.time + currentWindow.good)) {
                target.missProcessed = true;
                stats.misses++;
                breakCombo();
                UI.showFeedback('late', 'Passou!');
                if (window.RenderEngine) RenderEngine.removeTarget(target.time, false);
            }
        }

        // Limpar array antigo para economizar memória (notas muito antigas e já resolvidas)
        scheduledNotes = scheduledNotes.filter(n => currentTime < (n.time + 5.0));
    };

    const breakCombo = () => {
        combo = 0;
        UI.updateScore(score, combo);
    };

    const updateMaxCombo = () => {
        if (combo > maxCombo) maxCombo = combo;
    };

    return {
        start: (diff) => { reset(diff); AudioEngine.start(); },
        stop: () => { },
        registerMetronomeTick,
        handlePlayerHit,
        checkMisses,
        getStats: () => ({ score, maxCombo, ...stats }),
        getCurrentDifficultyObj: () => currentWindow
    };
})();
