// main.js - Core UI and State coordination

// Elementos da UI
const screens = {
    start: document.getElementById('start-screen'),
    play: document.getElementById('play-screen'),
    end: document.getElementById('end-screen')
};

const diffButtons = document.querySelectorAll('.diff-btn');
const btnStart = document.getElementById('btn-start-game');
const btnStop = document.getElementById('btn-stop-game');
const btnRestart = document.getElementById('btn-restart');

const uiElements = {
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    finalScore: document.getElementById('final-score'),
    finalCombo: document.getElementById('final-combo'),
    statPerfect: document.getElementById('stat-perfect'),
    statGood: document.getElementById('stat-good'),
    statMiss: document.getElementById('stat-miss'),
    feedbackText: document.getElementById('feedback-text')
};

// Estado Global App
const AppState = {
    difficulty: 'medium', // Valores: 'easy' (4-6), 'medium' (7-10), 'hard' (11+)
    isRunning: false
};

// Eventos de Seleção de Dificuldade
diffButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remover classe de todos
        diffButtons.forEach(b => b.classList.remove('selected'));
        // Adicionar no clicado
        e.target.classList.add('selected');
        // Atualizar state
        AppState.difficulty = e.target.dataset.level;
    });
});

// Navegação de Telas
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Inicialização do Jogo
btnStart.addEventListener('click', async () => {
    showScreen('play');
    
    // Iniciar Módulos (Definidos nos outros arquivos)
    try {
        await AudioEngine.init(); // Pede mic e cria contexto
        GameEngine.start(AppState.difficulty);
        RenderEngine.start();
        AppState.isRunning = true;
    } catch (err) {
        alert("Ops! Precisamos do microfone para sentir o seu ritmo. Recarregue a página e permita o acesso.");
        console.error("Erro ao iniciar áudio:", err);
        showScreen('start');
    }
});

btnStop.addEventListener('click', () => {
    endGame();
});

btnRestart.addEventListener('click', () => {
    showScreen('start');
});

function endGame() {
    GameEngine.stop();
    RenderEngine.stop();
    AudioEngine.stop();
    AppState.isRunning = false;
    
    // Atualizar stats finais
    const stats = GameEngine.getStats();
    uiElements.finalScore.innerText = stats.score;
    uiElements.finalCombo.innerText = stats.maxCombo;
    uiElements.statPerfect.innerText = stats.perfects;
    uiElements.statGood.innerText = stats.goods;
    uiElements.statMiss.innerText = stats.misses;

    showScreen('end');
}

// Funções Expostas para outros módulos atualizarem UI
window.UI = {
    updateScore: (score, combo) => {
        uiElements.score.innerText = score;
        uiElements.combo.innerText = combo;
    },
    showFeedback: (type, text) => {
        const fb = uiElements.feedbackText;
        fb.innerText = text;
        fb.className = ''; // reset
        // Timeout para forçar o re-flow do CSS caso animate pop rapidamente de novo
        void fb.offsetWidth; 
        fb.classList.add(`anim-${type}`);
    },
    triggerEndGame: endGame
};
