/**
 * Caliope Backing Track Sequencer
 * Sintetizador Web Audio polifônico e reprodutor de áudio real com sincronização cirúrgica
 */

class BackingTrackSequencer {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Sistema de Normalização Inteligente de Volume (sem alterar arquivos)
    this.isNormalizationEnabled = localStorage.getItem('caliope_normalize_audio') !== 'false';
    this.normalizerInput = this.ctx.createGain();

    // 1. Compressor Dinâmico de Estúdio (limita picos altos sem distorção)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(26, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // 2. Ganho de Compensação Automático (AGC)
    this.makeupGain = this.ctx.createGain();
    this.makeupGain.gain.setValueAtTime(1.15, this.ctx.currentTime);

    // 3. Analisador de Loudness (RMS da música em tempo real)
    this.loudnessAnalyser = this.ctx.createAnalyser();
    this.loudnessAnalyser.fftSize = 1024;
    this.loudnessBuffer = new Float32Array(this.loudnessAnalyser.fftSize);
    this.recentRmsValues = [];
    this.normalizerTimer = null;

    this.rebuildAudioRouting();

    this.isPlaying = false;
    this.song = null;
    this.startTime = 0;
    this.intervalId = null;
    this.currentStep = 0;

    // Reprodutor de áudio real (para músicas importadas do YouTube)
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = "anonymous";
    this.audioSourceNode = null;

    // Reprodutor de vídeo de Karaokê (para exibir clipes com letra no fundo)
    this.videoElement = document.getElementById('stage-video');
    this.videoDimmer = document.getElementById('stage-video-dimmer');
    this.videoSourceNode = null;
    this.onEnded = null;

    if (this.videoElement) {
      this.videoElement.crossOrigin = "anonymous";
      this.videoElement.addEventListener('ended', () => {
        if (this.onEnded) this.onEnded();
      });
      this.videoElement.addEventListener('loadedmetadata', () => {
        if (this.song && this.videoElement.duration && !isNaN(this.videoElement.duration)) {
          this.song.duration = Math.round(this.videoElement.duration * 10) / 10;
        }
      });
    }

    if (this.audioElement) {
      this.audioElement.addEventListener('ended', () => {
        if (this.onEnded) this.onEnded();
      });
      this.audioElement.addEventListener('loadedmetadata', () => {
        if (this.song && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
          this.song.duration = Math.round(this.audioElement.duration * 10) / 10;
        }
      });
    }

    // Frequências para notas MIDI
    this.midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

    // Mapeamento de acordes
    this.chordMap = {
      "A": [57, 61, 64],    // A, C#, E
      "F#m": [54, 57, 61],  // F#, A, C#
      "D": [50, 54, 57],    // D, F#, A
      "E": [52, 56, 59],    // E, G#, B
      "Bm": [47, 50, 54]    // B, D, F#
    };
  }

  rebuildAudioRouting() {
    try {
      this.normalizerInput.disconnect();
      this.compressor.disconnect();
      this.makeupGain.disconnect();
      this.loudnessAnalyser.disconnect();
    } catch (_) {}

    // Canal de análise de volume da música
    this.normalizerInput.connect(this.loudnessAnalyser);

    if (this.isNormalizationEnabled) {
      // Normalização ativa: normalizerInput -> compressor -> makeupGain -> masterGain -> destination
      this.normalizerInput.connect(this.compressor);
      this.compressor.connect(this.makeupGain);
      this.makeupGain.connect(this.masterGain);
    } else {
      // Normalização desativada: passa direto para masterGain
      this.normalizerInput.connect(this.masterGain);
    }
  }

  setNormalization(enabled) {
    this.isNormalizationEnabled = !!enabled;
    localStorage.setItem('caliope_normalize_audio', this.isNormalizationEnabled ? 'true' : 'false');
    this.rebuildAudioRouting();
  }

  startAutoGainControl() {
    if (this.normalizerTimer) clearInterval(this.normalizerTimer);
    if (!this.isNormalizationEnabled) return;

    this.normalizerTimer = setInterval(() => {
      if (!this.isPlaying || this.isPaused || !this.loudnessAnalyser) return;

      this.loudnessAnalyser.getFloatTimeDomainData(this.loudnessBuffer);
      let sum = 0;
      for (let i = 0; i < this.loudnessBuffer.length; i++) {
        sum += this.loudnessBuffer[i] * this.loudnessBuffer[i];
      }
      const rms = Math.sqrt(sum / this.loudnessBuffer.length);

      // Só calibra se houver som real tocando (> 0.02 para ignorar silêncio inicial)
      if (rms >= 0.02) {
        this.recentRmsValues.push(rms);
        if (this.recentRmsValues.length > 8) this.recentRmsValues.shift();

        // Média móvel dos últimos 3 segundos
        const avgRms = this.recentRmsValues.reduce((a, b) => a + b, 0) / this.recentRmsValues.length;

        // Alvo de volume confortável de Videokê: RMS 0.13 (~ -17.7 dBFS)
        const targetRms = 0.13;
        // Fator de ajuste suave: limita entre 0.65x (músicas muito altas) e 1.60x (músicas muito baixas)
        const targetGain = Math.max(0.65, Math.min(1.60, targetRms / (avgRms + 0.005)));

        // Aplica transição aveludada de 1.2 segundos (imperceptível ao ouvido humano)
        this.makeupGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 1.2);
      }
    }, 400);
  }

  setVolume(vol) {
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  resolveMediaUrl(url) {
    if (!url) return '';
    // Preserva URLs absolutas externas (http://, https://, blob:, data:)
    if (/^(?:https?:)?\/\/|^blob:|^data:/i.test(url)) {
      return url;
    }
    // Remove qualquer barra inicial para ser sempre relativo ao diretório da aplicação
    return url.replace(/^\/+/, '');
  }

  prepare(song) {
    if (!song) return;
    this.stop();

    if (song.videoUrl && this.videoElement) {
      if (this.videoDimmer) this.videoDimmer.classList.add('active');
      this.videoElement.classList.add('active');
      const cleanUrl = this.resolveMediaUrl(song.videoUrl);
      if (!this.videoElement.src || !this.videoElement.src.endsWith(cleanUrl)) {
        this.videoElement.src = cleanUrl;
        this.videoElement.load();
      }
      try {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
      } catch (_) {}
    } else if (song.audioUrl && this.audioElement) {
      if (this.videoElement) this.videoElement.classList.remove('active');
      if (this.videoDimmer) this.videoDimmer.classList.remove('active');
      const cleanUrl = this.resolveMediaUrl(song.audioUrl);
      if (!this.audioElement.src || !this.audioElement.src.endsWith(cleanUrl)) {
        this.audioElement.src = cleanUrl;
        this.audioElement.load();
      }
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (_) {}
    }
  }

  start(song) {
    this.stop();
    this.song = song;
    this.isPlaying = true;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.startTime = this.ctx.currentTime;
    this.currentStep = 0;

    // Reinicializar nivelamento para a nova música
    this.recentRmsValues = [];
    this.makeupGain.gain.setValueAtTime(1.15, this.ctx.currentTime);
    this.startAutoGainControl();

    // Se for uma música com vídeo de Karaokê
    if (song.videoUrl && this.videoElement) {
      if (this.videoDimmer) this.videoDimmer.classList.add('active');
      this.videoElement.classList.add('active');
      const cleanVideoUrl = this.resolveMediaUrl(song.videoUrl);
      if (!this.videoElement.src || !this.videoElement.src.endsWith(cleanVideoUrl)) {
        this.videoElement.src = cleanVideoUrl;
      }
      if (this.videoElement.currentTime !== 0) {
        try {
          this.videoElement.currentTime = 0;
        } catch (e) {}
      }

      this.videoElement.onerror = () => {
        console.warn("Erro no elemento de vídeo:", this.videoElement.error);
        if (song.audioUrl && this.audioElement) {
          const cleanAudio = this.resolveMediaUrl(song.audioUrl);
          this.audioElement.src = cleanAudio;
          this.audioElement.play().catch(aErr => console.error("Erro no áudio alternativo:", aErr));
        }
      };

      if (!this.videoSourceNode) {
        try {
          this.videoSourceNode = this.ctx.createMediaElementSource(this.videoElement);
          this.videoSourceNode.connect(this.normalizerInput);
        } catch (e) {
          // Navegador pode rotear áudio diretamente se já estiver conectado
        }
      }

      const playPromise = this.videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("Autoplay bloqueado pelo navegador, tentando fallback desmutado:", err);
          this.videoElement.muted = true;
          this.videoElement.play().then(() => {
            setTimeout(() => { this.videoElement.muted = false; }, 100);
          }).catch(e => {
            console.error("Erro tocando vídeo:", e);
            if (song.audioUrl && this.audioElement) {
              const cleanAudio = this.resolveMediaUrl(song.audioUrl);
              this.audioElement.src = cleanAudio;
              this.audioElement.play().catch(aErr => console.error("Erro tocando áudio:", aErr));
            }
          });
        });
      }
      return;
    }

    // Se for áudio puro (sem vídeo)
    if (this.videoElement) this.videoElement.classList.remove('active');
    if (this.videoDimmer) this.videoDimmer.classList.remove('active');

    if (song.audioUrl) {
      if (!this.audioSourceNode) {
        try {
          this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
          this.audioSourceNode.connect(this.normalizerInput);
        } catch (e) {
          console.warn("MediaElementSource já conectado:", e);
        }
      }
      const cleanAudioUrl = this.resolveMediaUrl(song.audioUrl);
      if (!this.audioElement.src || !this.audioElement.src.endsWith(cleanAudioUrl)) {
        this.audioElement.src = cleanAudioUrl;
      }
      this.audioElement.currentTime = 0;
      this.audioElement.play().catch(err => console.error("Erro tocando áudio:", err));
      return;
    }

    // Caso contrário, sintetizador polifônico
    if (this.song.backingTrack && this.song.backingTrack.progression) {
      const tempoMs = (60 / this.song.bpm) * 1000 / 2;
      this.intervalId = setInterval(() => this.tick(), tempoMs);
      this.tick();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;

    if (this.normalizerTimer) {
      clearInterval(this.normalizerTimer);
      this.normalizerTimer = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
      } catch (_) {}
      this.videoElement.classList.remove('active');
    }
    if (this.videoDimmer) {
      this.videoDimmer.classList.remove('active');
    }

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (_) {}
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;

    if (this.song && this.song.videoUrl && this.videoElement) {
      this.videoElement.pause();
    } else if (this.song && this.song.audioUrl && this.audioElement) {
      this.audioElement.pause();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pausedAt = this.ctx.currentTime - this.startTime;
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.startTime = this.ctx.currentTime - (this.pausedAt || 0);

    if (this.song && this.song.videoUrl && this.videoElement) {
      this.videoElement.play().catch(e => console.error(e));
      return;
    }

    if (this.song && this.song.audioUrl && this.audioElement) {
      this.audioElement.play().catch(e => console.error(e));
      return;
    }

    if (this.song && this.song.backingTrack && this.song.backingTrack.progression) {
      const tempoMs = (60 / this.song.bpm) * 1000 / 2;
      this.intervalId = setInterval(() => this.tick(), tempoMs);
      this.tick();
    }
  }

  getCurrentTime() {
    if (!this.isPlaying) return 0;
    if (this.isPaused) return this.pausedAt || 0;

    if (this.song && this.song.videoUrl && this.videoElement) {
      return this.videoElement.currentTime;
    }
    if (this.song && this.song.audioUrl && this.audioElement) {
      return this.audioElement.currentTime;
    }
    return this.ctx.currentTime - this.startTime;
  }

  isEnded() {
    if (!this.isPlaying) return false;
    if (this.song && this.song.videoUrl && this.videoElement) {
      return this.videoElement.ended;
    }
    if (this.song && this.song.audioUrl && this.audioElement) {
      return this.audioElement.ended;
    }
    return false;
  }

  getDuration() {
    if (this.song && this.song.videoUrl && this.videoElement && this.videoElement.duration && !isNaN(this.videoElement.duration)) {
      return this.videoElement.duration;
    }
    if (this.song && this.song.audioUrl && this.audioElement && this.audioElement.duration && !isNaN(this.audioElement.duration)) {
      return this.audioElement.duration;
    }
    return this.song ? this.song.duration : 0;
  }

  tick() {
    if (!this.isPlaying || !this.song || !this.song.backingTrack) return;

    const time = this.ctx.currentTime;
    const stepInMeasure = this.currentStep % 8;
    const measureIndex = Math.floor(this.currentStep / 8);
    const progression = this.song.backingTrack.progression;
    const currentChordInfo = progression[measureIndex % progression.length];

    // Bateria
    if (stepInMeasure === 0 || stepInMeasure === 4) this.playKick(time);
    if (stepInMeasure === 2 || stepInMeasure === 6) this.playSnare(time);
    this.playHiHat(time, stepInMeasure % 2 === 0 ? 0.08 : 0.04);

    // Baixo
    if (this.song.id === "stand_by_me") {
      const baseBass = currentChordInfo.bass + 12;
      if (stepInMeasure === 0) this.playBass(time, baseBass, 0.4);
      if (stepInMeasure === 3) this.playBass(time, baseBass, 0.2);
      if (stepInMeasure === 4) this.playBass(time, baseBass + 4, 0.2);
      if (stepInMeasure === 6) this.playBass(time, baseBass + 2, 0.3);
    } else {
      const baseBass = currentChordInfo.bass + 12;
      this.playBass(time, baseBass, 0.18);
    }

    // Teclado
    if (stepInMeasure === 0 || stepInMeasure === 4) {
      const notes = this.chordMap[currentChordInfo.chord] || [60, 64, 67];
      this.playChord(time, notes, 0.4);
    }

    this.currentStep++;
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.25);
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.26);
  }

  playSnare(time) {
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  playHiHat(time, vol = 0.08) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  playBass(time, midi, duration) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(this.midiToFreq(midi), time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);
    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  playChord(time, midiNotes, duration) {
    midiNotes.forEach(midi => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), time);
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });
  }
}

window.BackingTrackSequencer = BackingTrackSequencer;
