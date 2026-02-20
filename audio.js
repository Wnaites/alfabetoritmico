// audio.js - Audio Engine using Web Audio API

const AudioEngine = (() => {
    let audioContext = null;
    let micStream = null;
    let analyser = null;
    let dataArray = null;

    // Configurações do Metrônomo
    let isPlaying = false;
    let tempo = 90; // BPM base moderado para crianças
    let lookahead = 25.0; // Em ms, quão frequente chamamos o scheduler
    let scheduleAheadTime = 0.1; // Em s, quão longe no futuro agendamos (100ms)
    let current16thNote = 0; // Qual nota (16 avos) estamos agora (0 a 15 por compasso)
    let nextNoteTime = 0.0; // Quando a próxima nota vai tocar
    let timerID = null;

    // Configurações de Detecção (Energy)
    let threshold = 50; // Limiar de volume (0 a 255)
    let debounceTime = 100; // ms mínimo entre dois "hits" detectados
    let lastHitTime = 0;

    const init = async () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Retomar contexto se estiver suspenso (política do navegador)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Solicitar Microfone
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const source = audioContext.createMediaStreamSource(micStream);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256; // Fast e leve
            source.connect(analyser); // Não conecta ao destination (não queremos eco)

            dataArray = new Uint8Array(analyser.frequencyBinCount);

            // Inicia o loop de monitoramento do microfone
            requestAnimationFrame(monitorMic);
            console.log("Áudio inicializado com sucesso.");

        } catch (err) {
            throw new Error("Permissão de Microfone Recusada.");
        }
    };

    const playClick = (time, isDownbeat) => {
        // Oscilador simples para o Click
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (isDownbeat) {
            osc.frequency.value = 880.0; // A5 - Tom mais alto no tempo 1
        } else {
            osc.frequency.value = 440.0; // A4 - Outros tempos
        }

        // Env envelope
        gainNode.gain.setValueAtTime(1, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    };

    const nextNote = () => {
        // Avança o tempo de 1 semicolcheia (16th note)
        // Duração de uma semicolcheia: 1/4 da duração de uma semínima = (60/BPM) / 4 = 15/BPM
        const secondsPerBeat = 60.0 / tempo;
        nextNoteTime += 0.25 * secondsPerBeat;

        current16thNote++;
        if (current16thNote === 16) {
            current16thNote = 0; // Reseta no final do compasso (4/4 tem dezesseis 16 avos)
        }
    };

    const scheduleNote = (beatNumber, time) => {
        // Envia o evento pro GameEngine registrar que essa nota passou
        GameEngine.registerMetronomeTick(beatNumber, time);

        // Toca SOM apenas nos tempos (0, 4, 8, 12, que são as semínimas) para não poluir
        if ((beatNumber % 4) === 0) {
            playClick(time, beatNumber === 0);
        }
    };

    const scheduler = () => {
        // Agendar todas as notas neste trecho futuro
        while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
            scheduleNote(current16thNote, nextNoteTime);
            nextNote();
        }
        timerID = setTimeout(scheduler, lookahead);
    };

    const monitorMic = () => {
        if (!isPlaying) return;

        analyser.getByteTimeDomainData(dataArray);

        // Achar a amplitude máxima (energia bruta) local
        let maxVal = 0;
        for (let i = 0; i < dataArray.length; i++) {
            // Os valores orbitam o 128 (silêncio). Medimos a distância de 128 central
            let val = Math.abs(dataArray[i] - 128);
            if (val > maxVal) maxVal = val;
        }

        const nowMs = performance.now();

        // Se passamos o "threshold" (limiar de detecção)
        if (maxVal > threshold) {
            // Debounce: Evita detectar 10 hits seguidos num único som sustentado
            if (nowMs - lastHitTime > debounceTime) {
                lastHitTime = nowMs;
                // Informa ao motor do jogo o exato tempo do audioContext (não da GPU frame)
                GameEngine.handlePlayerHit(audioContext.currentTime);
            }
        }

        requestAnimationFrame(monitorMic);
    };

    const startMetronome = () => {
        if (isPlaying) return;
        isPlaying = true;

        // Pega o tempo atual e chuta a primeira nota um pouco pra frente
        nextNoteTime = audioContext.currentTime + 0.1;
        current16thNote = 0;

        scheduler();
        monitorMic();
    };

    const stopMetronome = () => {
        isPlaying = false;
        clearTimeout(timerID);
    };

    const stop = () => {
        stopMetronome();
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            // Fechamos o contexto para limpar na saída de tela
            audioContext.close();
            audioContext = null;
        }
    };

    // Funções auxiliares pro RenderEngine
    const getCurrentAudioTime = () => audioContext ? audioContext.currentTime : 0;
    const getBPM = () => tempo;

    return {
        init,
        start: startMetronome,
        stop,
        getCurrentAudioTime,
        getBPM
    };
})();
