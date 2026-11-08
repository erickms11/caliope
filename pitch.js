/**
 * Caliope Pitch Detector
 * Autocorrelation com interpolação parabólica para detecção de tom em tempo real
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

class PitchDetector {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.buffer = null;
    this.isListening = false;

    // Detecção específica de iOS / Safari para calibração de ganho e sensibilidade
    const isIOS = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    this.isIOS = isIOS;
    
    // Configurações
    // No iOS, o microfone com AGC precisa de limiar mais sensível (0.015). Em PC/Android USB, 0.028.
    const savedThreshold = localStorage.getItem('caliope_noise_gate');
    const defaultThreshold = this.isIOS ? '0.015' : '0.028';
    this.noiseThreshold = parseFloat(savedThreshold || defaultThreshold);
    this.speakerRejectionMode = localStorage.getItem('caliope_speaker_mode') !== 'false';
    this.echoCancellation = true; // Ativado como padrão para isolar o som dos alto-falantes da TV/celular!
    this.noiseSuppression = true;
    this.autoGainControl = this.isIOS; // No iOS, AGC é indispensável para evitar atenuação bruta do microfone
    this.minFreq = 70;   // ~C#2 (grave masculino)
    this.maxFreq = 1000; // ~B5 (agudo feminino)
    this.correlationThreshold = this.speakerRejectionMode ? 0.76 : 0.68;

    // Filtro Anti-Batida e Rejeição de Transientes Mecânicos
    this.consecutivePitchFrames = 0;
    this.lastDetectedPitch = 0;

    // Suporte a Microfone Remoto (Celular via WebRTC / P2P)
    this.remoteAudioData = null;
    this.lastRemoteDataTime = 0;
  }

  setRemoteAudioData(data) {
    if (!data) {
      this.remoteAudioData = null;
      this.lastRemoteDataTime = 0;
      return;
    }
    this.remoteAudioData = data;
    this.lastRemoteDataTime = performance.now();
  }

  setSpeakerMode(enabled) {
    this.speakerRejectionMode = !!enabled;
    localStorage.setItem('caliope_speaker_mode', this.speakerRejectionMode ? 'true' : 'false');
    this.correlationThreshold = this.speakerRejectionMode ? 0.76 : 0.68;
    if (this.speakerRejectionMode && this.noiseThreshold < 0.035) {
      this.setNoiseThreshold(0.040);
    } else if (!this.speakerRejectionMode && this.noiseThreshold > 0.028) {
      this.setNoiseThreshold(0.022);
    }
  }

  setNoiseThreshold(val) {
    this.noiseThreshold = Math.max(0.012, Math.min(0.12, Math.round(val * 1000) / 1000));
    localStorage.setItem('caliope_noise_gate', this.noiseThreshold.toString());
  }

  async calibrateAmbient(samplesCount = 20, delayMs = 50) {
    if (!this.isListening || !this.analyser) return null;
    let maxRms = 0;
    let sumRms = 0;
    for (let i = 0; i < samplesCount; i++) {
      this.analyser.getFloatTimeDomainData(this.buffer);
      let sumSq = 0;
      for (let j = 0; j < this.buffer.length; j++) {
        sumSq += this.buffer[j] * this.buffer[j];
      }
      const r = Math.sqrt(sumSq / this.buffer.length);
      if (r > maxRms) maxRms = r;
      sumRms += r;
      await new Promise(res => setTimeout(res, delayMs));
    }
    const avgRms = sumRms / samplesCount;
    // O corte deve ficar com folga acústica confortável (45% acima do maior pico de ruído medido)
    const newCut = Math.max(0.030, Math.min(0.095, Math.round((maxRms * 1.45 + 0.008) * 1000) / 1000));
    this.setNoiseThreshold(newCut);
    return { peakRms: maxRms, avgRms: avgRms, newThreshold: newCut };
  }

  async init(deviceId = null) {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Parar stream anterior se houver
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
      audio: {
        echoCancellation: this.echoCancellation,
        noiseSuppression: this.noiseSuppression,
        autoGainControl: this.autoGainControl,
        channelCount: 1
      }
    };

    if (deviceId) {
      constraints.audio.deviceId = { exact: deviceId };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn("Restrições avançadas de áudio não suportadas neste dispositivo, usando fallback padrão:", err);
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048; // ~46ms @ 44.1kHz
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // Pré-amplificador digital para iOS / Safari (aumenta o ganho limpo em 2.2x sem estourar distorção)
    if (this.isIOS) {
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 2.2;
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
    } else {
      this.sourceNode.connect(this.analyser);
    }
    // NÃO conectamos analyser ao audioCtx.destination para NÃO gerar microfonia / eco!

    this.isListening = true;
    return this.mediaStream;
  }

  getAudioData() {
    // 1. Verificar se há dados recentes de microfone remoto (celular via WebRTC)
    const hasFreshRemote = this.remoteAudioData && (performance.now() - (this.lastRemoteDataTime || 0) < 400);
    const remote = hasFreshRemote ? this.remoteAudioData : null;

    // 2. Se o microfone local do PC estiver ouvindo, processar sinal local
    let local = { volume: 0, pitch: -1, note: null, buffer: this.buffer, isSinging: false, isSustainedVoice: false };
    if (this.isListening && this.analyser) {
      this.analyser.getFloatTimeDomainData(this.buffer);

      let sumSquares = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        sumSquares += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sumSquares / this.buffer.length);

      if (rms >= this.noiseThreshold) {
        const pitchResult = this.autoCorrelate(this.buffer, this.audioCtx.sampleRate);
        const pitch = pitchResult.freq;
        const noteData = pitch > 0 ? this.frequencyToNote(pitch) : null;
        const minCorr = this.correlationThreshold || 0.68;
        const rawIsSinging = pitch > 0 && noteData !== null && (pitchResult.correlation >= minCorr);

        // Filtro Anti-Batida e Rejeição de Transientes Mecânicos:
        // Batidas no microfone, estalos e cliques duram menos de 40ms (1 frame).
        // Voz humana sustentada mantém frequência coerente por pelo menos 2 frames consecutivos (~50-60ms).
        if (rawIsSinging && pitch >= 70 && pitch <= 1000) {
          this.consecutivePitchFrames = (this.consecutivePitchFrames || 0) + 1;
          this.lastDetectedPitch = pitch;
        } else {
          this.consecutivePitchFrames = 0;
          this.lastDetectedPitch = 0;
        }

        const isSustainedVoice = rawIsSinging && (this.consecutivePitchFrames >= 2);

        local = {
          volume: rms,
          pitch: isSustainedVoice ? pitch : -1,
          correlation: pitchResult.correlation,
          note: isSustainedVoice ? noteData : null,
          buffer: this.buffer,
          isSinging: isSustainedVoice,
          isSustainedVoice: isSustainedVoice,
          consecutiveFrames: this.consecutivePitchFrames,
          threshold: this.noiseThreshold,
          source: 'local'
        };
      } else {
        this.consecutivePitchFrames = 0;
        this.lastDetectedPitch = 0;
        local.volume = rms;
      }
    }

    // 3. Decisão de Áudio: Se o celular estiver conectado e cantando (ou se não houver microfone local)
    if (remote) {
      if (!this.isListening || remote.isSinging || (remote.volume > (local.volume || 0))) {
        return {
          volume: remote.volume || 0,
          pitch: remote.pitch || -1,
          correlation: remote.correlation || 0.85,
          note: remote.note || null,
          buffer: this.buffer,
          isSinging: !!remote.isSinging,
          isSustainedVoice: !!remote.isSinging,
          threshold: this.noiseThreshold,
          source: 'remote',
          remoteSinger: remote.singerName || ''
        };
      }
    }

    return local;
  }

  autoCorrelate(buffer, sampleRate) {
    const SIZE = buffer.length;
    const minPeriod = Math.floor(sampleRate / this.maxFreq);
    const maxPeriod = Math.floor(sampleRate / this.minFreq);

    // Encontrar melhor período de repetição
    let bestCorrelation = -1;
    let bestPeriod = -1;

    // Normalização inicial
    let sumSquares = 0;
    for (let i = 0; i < SIZE; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    if (sumSquares < 0.0001) return { freq: -1, correlation: 0 };

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < SIZE - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      correlation = correlation / (SIZE - period);

      // Normalizado
      const normCorrelation = correlation / (sumSquares / SIZE);

      if (normCorrelation > bestCorrelation) {
        bestCorrelation = normCorrelation;
        bestPeriod = period;
      }
    }

    // Threshold de confiança da nota vocal
    const minCorr = this.correlationThreshold || 0.68;
    if (bestCorrelation >= minCorr && bestPeriod > 0) {
      // Interpolação parabólica para precisão sub-sample
      const p = bestPeriod;
      let refinedPeriod = p;

      if (p > 1 && p < maxPeriod - 1) {
        const c1 = this.calculateCorrelationAt(buffer, p - 1, SIZE);
        const c2 = bestCorrelation;
        const c3 = this.calculateCorrelationAt(buffer, p + 1, SIZE);
        const delta = (c3 - c1) / (2 * (2 * c2 - c1 - c3) + 1e-6);
        if (Math.abs(delta) < 1) {
          refinedPeriod = p + delta;
        }
      }

      return { freq: sampleRate / refinedPeriod, correlation: bestCorrelation };
    }

    return { freq: -1, correlation: bestCorrelation };
  }

  calculateCorrelationAt(buffer, period, size) {
    let corr = 0;
    for (let i = 0; i < size - period; i++) {
      corr += buffer[i] * buffer[i + period];
    }
    return corr / (size - period);
  }

  frequencyToNote(freq) {
    // MIDI note number: 69 = A4 (440Hz)
    const midiFloat = 12 * (Math.log2(freq / 440)) + 69;
    const midi = Math.round(midiFloat);
    const noteIndex = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const noteName = NOTE_NAMES[noteIndex];
    
    // Desvio em cents (-50 a +50 cents do semitom exato)
    const cents = Math.round((midiFloat - midi) * 100);

    return {
      name: noteName,
      octave: octave,
      full: `${noteName}${octave}`,
      midi: midi,
      cents: cents,
      freq: Math.round(freq * 10) / 10
    };
  }
}

window.PitchDetector = PitchDetector;

