/**
 * Caliope Videokê Engine (Motor Clássico Oficial de Karaokê)
 * Pontuação e avaliação vocal rigorosa em tempo real:
 * - Níveis de Dificuldade (Fácil, Médio, Difícil)
 * - Avaliação de Tom da Música (Chroma / Escala Harmônica)
 * - Detecção de Estabilidade Vocal vs Desafinação/Tremor
 * - Precisão Rítmica e Presença Vocal
 */

// Mapeamento e detecção de escala musical por tonalidade
function parseScalePitchClasses(keyStr) {
  if (!keyStr) return null;
  const str = keyStr.trim().toLowerCase();
  
  const rootMap = {
    'c': 0, 'dó': 0, 'do': 0,
    'c#': 1, 'db': 1, 'dó#': 1, 'réb': 1,
    'd': 2, 'ré': 2, 're': 2,
    'd#': 3, 'eb': 3, 'ré#': 3, 'mib': 3,
    'e': 4, 'mi': 4,
    'f': 5, 'fá': 5, 'fa': 5,
    'f#': 6, 'gb': 6, 'fá#': 6, 'solb': 6,
    'g': 7, 'sol': 7,
    'g#': 8, 'ab': 8, 'sol#': 8, 'láb': 8, 'lab': 8,
    'a': 9, 'lá': 9, 'la': 9,
    'a#': 10, 'bb': 10, 'lá#': 10, 'sib': 10,
    'b': 11, 'si': 11
  };

  let root = -1;
  const prefixes = [
    'c#', 'db', 'dó#', 'réb', 'd#', 'eb', 'ré#', 'mib', 'f#', 'gb', 'fá#', 'solb',
    'g#', 'ab', 'sol#', 'láb', 'a#', 'bb', 'lá#', 'sib',
    'c', 'd', 'e', 'f', 'g', 'a', 'b', 'dó', 'do', 'ré', 're', 'mi', 'fá', 'fa', 'sol', 'lá', 'la', 'si'
  ];

  for (const p of prefixes) {
    if (str.startsWith(p)) {
      root = rootMap[p];
      break;
    }
  }

  if (root === -1) return null;

  const isMinor = str.includes('menor') || str.includes('minor') || (str.includes('m') && !str.includes('maior') && !str.includes('major'));
  
  // Notas da escala (Pitch Classes 0 a 11):
  // Escala Maior: [0, 2, 4, 5, 7, 9, 11]
  // Escala Menor Natural + Harmônica: [0, 2, 3, 5, 7, 8, 10, 11]
  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10, 11] : [0, 2, 4, 5, 7, 9, 11];
  const scaleSet = new Set(intervals.map(i => (root + i) % 12));

  return {
    root,
    isMinor,
    scaleNotes: scaleSet,
    keyName: keyStr
  };
}

const DIFFICULTY_CONFIG = {
  easy: {
    id: 'easy',
    name: 'Fácil',
    label: '🟢 Fácil',
    desc: 'Festa & Diversão: super tolerante, para cantar sem pressão',
    centsTolerance: 45,       // Quase o semitom inteiro (super generoso)
    maxWaverSemitones: 2.8,   // Tolera vibrato e transições livres
    correlationMin: 0.75,     // Capta a voz facilmente
    pauseTolerance: 6.0,      // Permite respirar e curtir o instrumental
    strictScale: false,       // Sem penalização por tom
    comboBreakOnBadPitch: false,
    scoreRate: 35,
    starThresholds: [20, 40, 55, 70, 82] // Muito fácil tirar 4 ou 5 estrelas
  },
  medium: {
    id: 'medium',
    name: 'Médio',
    label: '🟡 Médio',
    desc: 'Videokê Clássico: avaliação equilibrada e gratificante para quem canta no dia a dia',
    centsTolerance: 32,       // Tolerância amigável para cantores amadores
    maxWaverSemitones: 2.0,   // Tolera vibrato natural (1.5 a 2 semitons)
    correlationMin: 0.82,     // Boa captação vocal
    pauseTolerance: 4.0,      // Pausas normais de respiração
    strictScale: false,       // Bonifica quem tá no tom, não massacra quem escapa levemente
    comboBreakOnBadPitch: false,
    scoreRate: 30,
    starThresholds: [30, 50, 68, 80, 90] // Justo e motivador (65-88% típico)
  },
  hard: {
    id: 'hard',
    name: 'Difícil',
    label: '🔴 Difícil',
    desc: 'Modo Jurado / The Voice: rigor de estúdio, desafinar zera o combo na hora',
    centsTolerance: 14,       // Afinação cirúrgica
    maxWaverSemitones: 1.0,   // Proibido oscilar ou tremer a voz
    correlationMin: 0.92,     // Tom puro das cordas vocais
    pauseTolerance: 2.0,      // Ritmo estrito
    strictScale: true,        // Fora do tom zera o combo imediatamente!
    comboBreakOnBadPitch: true,
    scoreRate: 40,
    starThresholds: [45, 65, 80, 90, 96] // Muito difícil
  }
};

class KaraokeEngine {
  constructor(canvasId, pitchDetector, calibrator, sequencer) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.detector = pitchDetector;
    this.calibrator = calibrator;
    this.sequencer = sequencer;

    if (this.sequencer) {
      this.sequencer.onEnded = () => {
        if (this.isPlaying) {
          this.finishSong();
        }
      };
    }

    this.isPlaying = false;
    this.isPaused = false;
    this.currentSong = null;
    this.songStartTime = 0;
    
    // Dimensões do canvas
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Dificuldade e Escala
    this.difficulty = 'medium';
    this.currentScale = null;

    // Partículas de celebração
    this.particles = [];

    // Sistema de Pontuação Normalizado (Máximo 10.000 pontos para todas as músicas)
    this.score = 0;
    this.scoreFloat = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.basePointsPerSecond = 50;
    this.comboBonusPerSecond = 15;

    // Sistema anti-monotonia (rejeição de zumbido / lalala na mesma nota)
    this.uniqueNotesSung = new Set();
    this.currentNoteMidi = -1;
    this.currentNoteDuration = 0;
    this.melodicShifts = 0;

    // Métricas de afinação e presença
    this.perfectHits = 0;
    this.goodHits = 0;
    this.offKeyHits = 0;
    this.waverHits = 0;
    this.perfectSeconds = 0;
    this.goodSeconds = 0;
    this.waverSeconds = 0;
    this.offKeySeconds = 0;
    this.unpitchedSeconds = 0;
    this.recentPitches = [];
    this.comboPulseTimer = 0;
    this.silenceTimer = 0;
    this.timeSinceLastPitch = 999;

    // Callbacks de UI
    this.onScoreUpdate = null;
    this.onProgressUpdate = null;
    this.onSongEnd = null;
    this.onLyricsUpdate = null;

    // Deslocamento de sincronia manual (+/- segundos)
    this.songSyncOffset = 0.0;
  }

  setDifficulty(level) {
    if (DIFFICULTY_CONFIG[level]) {
      this.difficulty = level;
    }
  }

  calculateSongRate() {
    let dur = 0;
    if (this.sequencer && this.sequencer.getDuration) {
      dur = this.sequencer.getDuration();
    }
    if (!dur || dur <= 15) {
      dur = (this.currentSong && this.currentSong.duration > 15) ? this.currentSong.duration : 200;
    }
    // Meta realista de tempo cantado ativo em videokê (~18s a 28s de fôlego real no microfone ao longo da faixa)
    const expectedVocalSeconds = Math.min(28, Math.max(14, dur * 0.10));
    // 7.500 pontos base (afinação e estabilidade) + 2.500 pontos bônus de combo = 10.000 pontos máx.
    this.basePointsPerSecond = 7500 / expectedVocalSeconds;
    this.comboBonusPerSecond = 2500 / expectedVocalSeconds;
  }

  loadSong(song) {
    this.currentSong = song;
    this.currentScale = parseScalePitchClasses(song ? song.key : null);
    this.calculateSongRate();
    if (this.sequencer && this.sequencer.prepare) {
      this.sequencer.prepare(song);
    }
  }

  start() {
    if (!this.currentSong) return;
    this.isPlaying = true;
    this.isPaused = false;

    // Recalcular taxa caso a duração do sequencer ou arquivo tenha mudado
    this.calculateSongRate();

    // Reset completo de pontuação para início limpo
    this.score = 0;
    this.scoreFloat = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.uniqueNotesSung = new Set();
    this.currentNoteMidi = -1;
    this.currentNoteDuration = 0;
    this.melodicShifts = 0;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.offKeyHits = 0;
    this.waverHits = 0;
    this.perfectSeconds = 0;
    this.goodSeconds = 0;
    this.waverSeconds = 0;
    this.offKeySeconds = 0;
    this.unpitchedSeconds = 0;
    this.recentPitches = [];
    this.comboPulseTimer = 0;
    this.silenceTimer = 0;
    this.timeSinceLastPitch = 999;
    this.particles = [];
    this.lastFrameTime = performance.now();
    this.lastStallTime = undefined;
    this.stallCounter = 0;

    this.sequencer.start(this.currentSong);
    this.songStartTime = performance.now();
    this.loop();
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.sequencer.pause();
    this.drawPauseOverlay();
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.sequencer.resume();
    this.loop();
  }

  togglePause() {
    if (!this.isPlaying) return false;
    if (this.isPaused) {
      this.resume();
      return false;
    } else {
      this.pause();
      return true;
    }
  }

  restart() {
    this.stop();
    this.start();
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.sequencer.stop();
  }

  drawPauseOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.75)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 32px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏸ PAUSADO', this.width / 2, this.height / 2 - 10);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Plus Jakarta Sans, sans-serif';
    ctx.fillText('Pressione [Espaço] ou clique em Continuar para voltar ao Karaokê', this.width / 2, this.height / 2 + 25);
  }

  loop() {
    if (!this.isPlaying || this.isPaused) return;

    const now = performance.now();
    const dt = this.lastFrameTime ? Math.min(0.08, (now - this.lastFrameTime) / 1000) : 0.016;
    this.lastFrameTime = now;

    const songTime = Math.max(0, this.sequencer.getCurrentTime() + this.songSyncOffset);

    // Checar fim da música
    const isMediaEnded = this.sequencer.isEnded ? this.sequencer.isEnded() : false;
    const mediaDuration = this.sequencer.getDuration ? this.sequencer.getDuration() : (this.currentSong ? this.currentSong.duration : 0);
    const effectiveDuration = (mediaDuration > 0 && Math.abs(mediaDuration - this.currentSong.duration) < 6)
      ? mediaDuration
      : (this.currentSong ? this.currentSong.duration : 0);

    // Detecção inteligente de finalização da música:
    // [1] Elemento de vídeo/áudio disparou evento 'ended'
    // [2] Tempo atingiu a margem final da duração (< 0.4s)
    // [3] Vídeo/áudio parou de avançar nos últimos 2.5s (evita travar congelado no último segundo)
    let shouldFinish = isMediaEnded || (effectiveDuration > 0 && songTime >= (effectiveDuration - 0.4));

    if (!shouldFinish && effectiveDuration > 0 && songTime >= (effectiveDuration - 2.5)) {
      if (this.lastStallTime === undefined) {
        this.lastStallTime = songTime;
        this.stallCounter = 0;
      } else if (Math.abs(songTime - this.lastStallTime) < 0.05) {
        this.stallCounter += dt;
        if (this.stallCounter >= 0.75) {
          shouldFinish = true;
        }
      } else {
        this.lastStallTime = songTime;
        this.stallCounter = 0;
      }
    } else {
      this.lastStallTime = undefined;
      this.stallCounter = 0;
    }

    if (shouldFinish) {
      this.finishSong();
      return;
    }

    const config = DIFFICULTY_CONFIG[this.difficulty] || DIFFICULTY_CONFIG.medium;

    // 1. Processar microfone
    const audioData = this.detector.getAudioData();

    // 2. Avaliação Vocal de Videokê com Dificuldade e Tonalidade
    // Rejeição rigorosa de ruído/som ambiente e transientes mecânicos (batidas no microfone)
    const isAboveThreshold = audioData.volume >= this.detector.noiseThreshold;
    const isSustainedVoice = audioData.isSinging && isAboveThreshold && (audioData.isSustainedVoice !== false);
    const hasValidPitch = isSustainedVoice && audioData.pitch > 70 && audioData.pitch < 1000 && audioData.note !== null;

    if (hasValidPitch) {
      this.timeSinceLastPitch = 0;
    } else {
      this.timeSinceLastPitch = (this.timeSinceLastPitch || 0) + dt;
    }

    // Transição de consoante (ex: p, t, k) durante um verso ativo:
    // Só é aceita se o jogador estava cantando afinado há menos de 150ms e o microfone ainda tem som presente
    const isConsonantInPhrase = !hasValidPitch && isAboveThreshold && (this.timeSinceLastPitch < 0.15);
    const isVoicePresent = hasValidPitch || isConsonantInPhrase;

    let isPureTone = false;
    let isPitchStable = false;
    let isCentTuned = false;
    let isInScale = true; // Por padrão, se não tiver tom detectado, não penaliza

    let monotoneFactor = 1.0;

    if (hasValidPitch) {
      const midi = audioData.note.midi + (audioData.note.cents / 100);
      this.recentPitches.push(midi);
      if (this.recentPitches.length > 6) this.recentPitches.shift();

      // Rastrear nota melódica e variedade
      const noteMidiInt = audioData.note.midi;
      this.uniqueNotesSung.add(noteMidiInt);

      if (this.currentNoteMidi === noteMidiInt) {
        this.currentNoteDuration += dt;
      } else {
        if (this.currentNoteMidi !== -1) {
          this.melodicShifts++;
        }
        this.currentNoteMidi = noteMidiInt;
        this.currentNoteDuration = 0;
      }

      // Rejeição de Monotonia / Zumbido ("Lalala" ou "hummm" na mesma nota):
      // Se passar de 2.0s sustentando a mesmíssima nota fixa sem modular a melodia:
      if (this.currentNoteDuration > 2.0) {
        monotoneFactor = Math.max(0.10, 1.0 - ((this.currentNoteDuration - 2.0) * 0.50));
      }

      // Checar estabilidade melódica (canto firme vs desafinação tremida)
      if (this.recentPitches.length >= 3) {
        const minP = Math.min(...this.recentPitches);
        const maxP = Math.max(...this.recentPitches);
        isPitchStable = (maxP - minP) <= config.maxWaverSemitones;
      } else {
        isPitchStable = true;
      }

      // Correlação de frequência (pureza das cordas vocais cantando nota musical)
      isPureTone = (audioData.correlation || 0) >= config.correlationMin;

      // Desvio de micro-afinação em cents
      isCentTuned = Math.abs(audioData.note.cents) <= config.centsTolerance;

      // Comparação com a Tonalidade / Escala da Música
      const hasScaleConfigured = !!(this.currentScale && this.currentScale.scaleNotes && this.currentScale.scaleNotes.size > 0);
      if (hasScaleConfigured) {
        const pitchClass = audioData.note.midi % 12;
        isInScale = this.currentScale.scaleNotes.has(pitchClass);
      } else {
        isInScale = true; // Se a música não tem escala cadastrada, nunca penaliza!
      }
    } else {
      this.recentPitches = [];
      this.currentNoteMidi = -1;
      this.currentNoteDuration = 0;
    }

    let currentHitType = null;

    if (isVoicePresent) {
      this.silenceTimer = 0;

      if (hasValidPitch) {
        const hasScaleConfigured = !!(this.currentScale && this.currentScale.scaleNotes && this.currentScale.scaleNotes.size > 0);

        if (!isInScale && config.strictScale && hasScaleConfigured) {
          // No Modo Difícil (somente se a escala da música estiver cadastrada!), sair do tom penaliza
          currentHitType = 'offkey';
          this.offKeyHits++;
          this.offKeySeconds += dt;

          if (config.comboBreakOnBadPitch) {
            this.combo = 0;
            this.multiplier = 1;
          }

        } else if (!isPitchStable && this.recentPitches.length >= 4) {
          // Voz oscilando / tremendo muito rápido
          currentHitType = 'waver';
          this.waverHits++;
          this.waverSeconds += dt;

          if (config.comboBreakOnBadPitch) {
            this.combo = 0;
            this.multiplier = 1;
          }

        } else if (isPureTone && isCentTuned && isPitchStable) {
          // Afinação Perfeita: pura, afinada nos cents e firme!
          currentHitType = 'perfect';
          this.perfectHits++;
          this.perfectSeconds += dt;

        } else if (isPureTone && isPitchStable) {
          // Afinação Boa: tom puro e sustentado
          currentHitType = 'good';
          this.goodHits++;
          this.goodSeconds += dt;

        } else if (isCentTuned || isPureTone) {
          // Nota em transição ou leve oscilação
          currentHitType = 'good';
          this.goodHits++;
          this.goodSeconds += dt * 0.7;

        } else {
          // Nota sem pureza harmônica ou oscilante
          currentHitType = 'waver';
          this.waverHits++;
          this.waverSeconds += dt;
        }

        // --- CÁLCULO SEGURO DE PONTUAÇÃO (APENAS COM VOZ ATIVA) ---
        // A pontuação só avança quando o cantor estiver ativamente cantando e afinando!
        const baseRate = this.basePointsPerSecond || 50;
        const comboBonusRate = this.comboBonusPerSecond || 15;
        const comboRatio = Math.min(1.0, this.combo / 25);

        let hitRate = 0;
        if (currentHitType === 'perfect') {
          hitRate = (baseRate * 1.0 + (comboBonusRate * comboRatio)) * monotoneFactor;
        } else if (currentHitType === 'good') {
          hitRate = (baseRate * 0.85 + (comboBonusRate * comboRatio * 0.75)) * monotoneFactor;
        } else if (currentHitType === 'waver') {
          hitRate = (baseRate * 0.30) * monotoneFactor;
        } else if (currentHitType === 'offkey') {
          hitRate = config.comboBreakOnBadPitch ? 0 : (baseRate * 0.10);
        }

        this.scoreFloat += hitRate * dt;
        this.score = Math.min(10000, Math.max(0, Math.floor(this.scoreFloat)));

      } else if (isConsonantInPhrase) {
        // Consoante rápida durante verso cantado: mantém o fluxo sem pontuação gratuita de ruído
        this.unpitchedSeconds += dt;
      }

      // Incremento de combo por cadência musical (a cada 0.28s de canto afinado)
      if (currentHitType === 'perfect' || currentHitType === 'good' || (this.difficulty === 'easy' && currentHitType)) {
        this.comboPulseTimer += dt;
        if (this.comboPulseTimer >= 0.28) {
          this.comboPulseTimer = 0;
          this.combo++;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;

          // Multiplicadores
          if (this.combo >= 35) this.multiplier = 5;
          else if (this.combo >= 22) this.multiplier = 4;
          else if (this.combo >= 12) this.multiplier = 3;
          else if (this.combo >= 5) this.multiplier = 2;
          else this.multiplier = 1;
        }

        this.emitParticles(this.width / 2, this.height * 0.88, currentHitType === 'perfect');
      } else {
        this.comboPulseTimer = 0;
      }

    } else {
      // Jogador em silêncio: a pontuação congela rigorosamente, sem correr sozinha!
      this.comboPulseTimer = 0;
      this.silenceTimer += dt;

      // Tolerância para respiração entre versos de acordo com a dificuldade
      if (this.silenceTimer > config.pauseTolerance && this.combo > 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

      // Tolerância para respiração entre versos de acordo com a dificuldade
      if (this.silenceTimer > config.pauseTolerance && this.combo > 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

    // 3. Atualizar partículas
    this.updateParticles();

    // 4. Renderizar Palco Videokê
    this.render(songTime, currentHitType, audioData);

    // 5. Cálculo de Precisão e Afinação Rigoroso
    const liveAccuracy = this.calculateAccuracy(songTime);

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        multiplier: this.multiplier,
        hitType: currentHitType,
        accuracy: liveAccuracy,
        difficulty: this.difficulty,
        key: this.currentSong ? this.currentSong.key : null,
        micVolume: audioData.volume,
        micPitch: audioData.pitch,
        micNote: audioData.note,
        micIsSinging: hasValidPitch,
        micThreshold: this.detector.noiseThreshold
      });
    }

    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        current: songTime,
        total: this.currentSong.duration,
        progress: songTime / this.currentSong.duration
      });
    }

    // Se houver letra de partitura (ex: músicas embutidas), atualiza
    if (this.onLyricsUpdate && !this.currentSong.hasVideoLyrics) {
      this.updateLyricsSubtitles(songTime);
    }

    requestAnimationFrame(() => this.loop());
  }

  updateLyricsSubtitles(songTime) {
    const currentNotes = this.currentSong.notes || [];
    let currentSyllableIndex = -1;

    for (let i = 0; i < currentNotes.length; i++) {
      if (songTime >= currentNotes[i].start && songTime <= currentNotes[i].start + currentNotes[i].duration + 0.5) {
        currentSyllableIndex = i;
        break;
      }
    }

    this.onLyricsUpdate(currentNotes, currentSyllableIndex, songTime);
  }

  emitParticles(x, y, isPerfect) {
    const count = isPerfect ? 4 : 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() * 24 - 12),
        y: y + (Math.random() * 12 - 6),
        vx: (Math.random() - 0.5) * 5,
        vy: -Math.random() * 4 - 1.5,
        life: 1.0,
        color: isPerfect ? '#fbbf24' : '#38bdf8',
        size: Math.random() * 3 + 2
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render(songTime, currentHitType, audioData) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const isHitting = currentHitType === 'perfect' || currentHitType === 'good';
    const centerY = this.height * 0.88;
    const vol = audioData ? Math.min(1.0, audioData.volume * 5.0) : 0;

    // 1. Linha Laser de Pulso no Rodapé (Não obstrui a letra do vídeo)
    ctx.strokeStyle = isHitting ? 'rgba(251, 191, 36, 0.45)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, centerY);
    ctx.lineTo(this.width - 30, centerY);
    ctx.stroke();

    // 2. Onda Sonora Neon Reativa ao Microfone Fifine
    if (vol > 0.008) {
      let strokeColor = '#06b6d4';
      if (currentHitType === 'perfect') strokeColor = '#fbbf24';
      else if (currentHitType === 'good') strokeColor = '#38bdf8';
      else if (currentHitType === 'waver') strokeColor = '#f97316';
      else if (currentHitType === 'offkey') strokeColor = '#ef4444';

      ctx.lineWidth = isHitting ? 4.5 : (currentHitType ? 3.0 : 2.0);
      ctx.strokeStyle = strokeColor;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = isHitting ? 22 : 12;

      ctx.beginPath();
      const segments = 64;
      const widthSpan = this.width - 60;
      const nowMs = performance.now();

      for (let i = 0; i <= segments; i++) {
        const x = 30 + (i / segments) * widthSpan;
        const wave = Math.sin((i * 0.28) + (nowMs * 0.016)) * (vol * 36);
        const y = centerY + wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Partículas de Brilho
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  calculateAccuracy(songTime) {
    const config = DIFFICULTY_CONFIG[this.difficulty] || DIFFICULTY_CONFIG.medium;
    const totalSingingTime = this.perfectSeconds + this.goodSeconds + this.waverSeconds + this.offKeySeconds;
    const totalActiveTime = totalSingingTime + (this.unpitchedSeconds * 0.25);

    if (totalActiveTime < 0.3) {
      return 100;
    }

    let liveAccuracy = 100;
    if (this.difficulty === 'easy') {
      // Fácil: Muito generoso! Cantores amadores atingem facilmente 80% a 98%
      const weighted = (this.perfectSeconds * 1.0) +
                       (this.goodSeconds * 0.95) +
                       (this.waverSeconds * 0.80) +
                       (this.offKeySeconds * 0.70) +
                       (this.unpitchedSeconds * 0.25 * 0.5);
      const ratio = Math.min(1.0, weighted / totalActiveTime);
      liveAccuracy = Math.min(100, Math.round(55 + (ratio * 43)));
    } else if (this.difficulty === 'medium') {
      // Médio: Clássico e motivador! Cantores normais atingem 70% a 90%
      const weighted = (this.perfectSeconds * 1.0) +
                       (this.goodSeconds * 0.88) +
                       (this.waverSeconds * 0.60) +
                       (this.offKeySeconds * 0.40) +
                       (this.unpitchedSeconds * 0.25 * 0.3);
      const ratio = Math.min(1.0, Math.max(0, weighted / totalActiveTime));
      liveAccuracy = Math.min(100, Math.round(38 + (ratio * 60)));
    } else {
      // Difícil: Rigoroso e impiedoso! Desafinar ou cantar fora do tom derruba a nota
      const weighted = (this.perfectSeconds * 1.0) +
                       (this.goodSeconds * 0.50) -
                       (this.waverSeconds * 0.35) -
                       (this.offKeySeconds * 0.75);
      const ratio = Math.max(0, weighted / totalActiveTime);
      liveAccuracy = Math.min(100, Math.round(ratio * 100));
    }

    return Math.max(1, liveAccuracy);
  }

  finishSong() {
    this.stop();

    const config = DIFFICULTY_CONFIG[this.difficulty] || DIFFICULTY_CONFIG.medium;
    const songDuration = (this.currentSong && this.currentSong.duration > 15) ? this.currentSong.duration : 200;
    const accuracy = this.calculateAccuracy(songDuration);

    // Avaliação de diversidade melódica (ter cantado notas variadas da melodia):
    // Um cantor que varia pelo menos 4 a 5 notas diferentes recebe 100% de diversidade.
    // Quem fica em 1 única nota ("hummm" monótono sem sair do lugar) recebe penalidade severa.
    const distinctNotes = (this.uniqueNotesSung && this.uniqueNotesSung.size) ? this.uniqueNotesSung.size : 0;
    const melodyDiversityRatio = Math.min(1.0, Math.max(0.25, distinctNotes / 4.5));

    // A pontuação final é baseada no canto real acumulado ponderado pela variedade melódica
    const finalCalculated = Math.round(this.scoreFloat * melodyDiversityRatio);
    this.score = Math.min(10000, Math.max(0, finalCalculated));

    // Determinar estrelas (1 a 5) de acordo com os limiares da dificuldade
    const [t1, t2, t3, t4, t5] = config.starThresholds;
    let stars = 1;
    if (accuracy >= t5) stars = 5;
    else if (accuracy >= t4) stars = 4;
    else if (accuracy >= t3) stars = 3;
    else if (accuracy >= t2) stars = 2;
    else stars = 1;

    // Ranks e títulos clássicos
    let rank = 'D';
    let title = 'Cantor de Chuveiro 🚿';
    if (accuracy >= t5) { rank = 'S'; title = 'Lenda do Karaokê! 🌟'; }
    else if (accuracy >= t4) { rank = 'A'; title = 'Vocalista Profissional! 🎤'; }
    else if (accuracy >= t3) { rank = 'B'; title = 'Afinado no Ritmo! 🎶'; }
    else if (accuracy >= t2) { rank = 'C'; title = 'Cantor Amador! 🎵'; }

    if (this.onSongEnd) {
      this.onSongEnd({
        score: this.score,
        maxCombo: this.maxCombo,
        accuracy: accuracy,
        stars: stars,
        rank: rank,
        title: title,
        difficulty: config.name,
        difficultyId: this.difficulty
      });
    }
  }
}

window.KaraokeEngine = KaraokeEngine;
window.DIFFICULTY_CONFIG = DIFFICULTY_CONFIG;

