/**
 * Caliope Mini-Game Sandbox (Estilo Let's Sing / SingStar)
 * Renderiza as barrinhas de notas e a curva da voz do jogador
 */

class SingStarSandbox {
  constructor(canvasId, pitchDetector, calibrator) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.detector = pitchDetector;
    this.calibrator = calibrator;

    this.isPlaying = false;
    this.startTime = 0;
    this.score = 0;
    this.hitCallback = null;

    // Resolução interna
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Escala musical exibida (MIDI 48 = C3 a MIDI 72 = C5)
    this.minMidi = 48; // C3
    this.maxMidi = 72; // C5
    this.pixelsPerSecond = 140;
    this.hitLineX = 180; // Onde a agulha do jogador fica parada

    // Histórico da voz do jogador para desenhar a linha neon
    // Armazena { time, midi, cents }
    this.playerTrail = [];

    // Partitura de teste pré-definida (Melodia animada de teste)
    // start (segundos), duration (segundos), midi, text
    this.testNotes = [
      { start: 1.0, duration: 0.8, midi: 60, text: "Dó" },   // C4
      { start: 2.0, duration: 0.8, midi: 62, text: "Ré" },   // D4
      { start: 3.0, duration: 0.8, midi: 64, text: "Mi" },   // E4
      { start: 4.0, duration: 1.2, midi: 65, text: "Fá!" },  // F4
      { start: 5.5, duration: 0.6, midi: 65, text: "Fá" },
      { start: 6.3, duration: 0.6, midi: 65, text: "Fá!" },
      { start: 7.2, duration: 0.8, midi: 60, text: "Dó" },
      { start: 8.2, duration: 0.8, midi: 62, text: "Ré" },
      { start: 9.2, duration: 0.8, midi: 60, text: "Dó" },
      { start: 10.2, duration: 1.4, midi: 62, text: "Ré!" },
      { start: 12.0, duration: 0.8, midi: 60, text: "Dó" },
      { start: 13.0, duration: 0.8, midi: 67, text: "Sol" },  // G4
      { start: 14.0, duration: 0.8, midi: 65, text: "Fá" },
      { start: 15.0, duration: 1.4, midi: 64, text: "Mi!" },
    ];

    this.totalDuration = 17.5; // segundos para reiniciar o loop
  }

  start() {
    this.isPlaying = true;
    this.startTime = performance.now();
    this.score = 0;
    this.playerTrail = [];
    this.loop();
  }

  stop() {
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  midiToY(midi) {
    const range = this.maxMidi - this.minMidi;
    const norm = (midi - this.minMidi) / range;
    // Inverter para notas agudas ficarem no topo
    return this.height - (norm * (this.height - 40)) - 20;
  }

  loop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    let songTime = (now - this.startTime) / 1000;

    // Loop contínuo da música de teste
    if (songTime > this.totalDuration) {
      this.startTime = performance.now();
      songTime = 0;
      this.playerTrail = [];
    }

    // 1. Capturar nota atual do jogador e aplicar COMPENSAÇÃO DE ATRASO
    const audioData = this.detector.getAudioData();
    const offsetSeconds = (this.calibrator.getOffset() || 0) / 1000;

    // Se o jogador cantou algo, o tempo real musical daquele som é (songTime - offsetSeconds)
    const effectiveSongTime = Math.max(0, songTime - offsetSeconds);

    let isHitNow = false;

    if (audioData.note && audioData.pitch > 0) {
      const midi = audioData.note.midi;
      const fineMidi = midi + (audioData.note.cents / 100);

      this.playerTrail.push({
        time: effectiveSongTime,
        fineMidi: fineMidi,
        midi: midi
      });

      // Checa se está acertando a nota alvo atual
      for (const note of this.testNotes) {
        if (effectiveSongTime >= note.start && effectiveSongTime <= note.start + note.duration) {
          // Permite acertar a mesma nota ou oitavas correspondentes (C3 = C4)
          const semitoneDiff = Math.abs(midi - note.midi) % 12;
          if (semitoneDiff === 0 || semitoneDiff === 12) {
            isHitNow = true;
            this.score += 10;
            break;
          }
        }
      }
    }

    if (this.hitCallback) {
      this.hitCallback(isHitNow, this.score);
    }

    // 2. Limpar rastro antigo
    while (this.playerTrail.length > 0 && this.playerTrail[0].time < songTime - 5) {
      this.playerTrail.shift();
    }

    // 3. Renderizar Gráficos
    this.render(songTime, isHitNow);

    requestAnimationFrame(() => this.loop());
  }

  render(songTime, isHitNow) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Linhas de grade de fundo (semitons)
    ctx.strokeStyle = '#151d30';
    ctx.lineWidth = 1;
    for (let m = this.minMidi; m <= this.maxMidi; m++) {
      const y = this.midiToY(m);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();

      // Destaque para notas naturais C, E, G
      if (m % 12 === 0) {
        ctx.fillStyle = '#334155';
        ctx.font = '10px monospace';
        ctx.fillText(`C${Math.floor(m / 12) - 1}`, 10, y - 3);
      }
    }

    // Linha vertical do "Cursor / Agulha" do microfone
    ctx.strokeStyle = isHitNow ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.hitLineX, 0);
    ctx.lineTo(this.hitLineX, this.height);
    ctx.stroke();

    // 4. Desenhar Barrinhas de Notas Alvo
    for (const note of this.testNotes) {
      const x = this.hitLineX + (note.start - songTime) * this.pixelsPerSecond;
      const barWidth = note.duration * this.pixelsPerSecond;
      const y = this.midiToY(note.midi) - 9;
      const barHeight = 18;

      // Desenhar se estiver visível na tela
      if (x + barWidth > 0 && x < this.width) {
        // Barrinha de nota estilo SingStar
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;

        // Efeito de preenchimento dourado se a agulha está passando por ela
        const isCurrentlyPlaying = songTime >= note.start && songTime <= (note.start + note.duration);
        if (isCurrentlyPlaying) {
          ctx.fillStyle = isHitNow ? 'rgba(251, 191, 36, 0.4)' : 'rgba(99, 102, 241, 0.4)';
          ctx.strokeStyle = isHitNow ? '#fbbf24' : '#818cf8';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 6);
        ctx.fill();
        ctx.stroke();

        // Texto da sílaba/letra
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(note.text, x + barWidth / 2, y + 13);
      }
    }

    // 5. Desenhar Rastro da Voz do Jogador (Curva Neon)
    if (this.playerTrail.length > 1) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineCap = 'round';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      let started = false;

      for (let i = 0; i < this.playerTrail.length; i++) {
        const pt = this.playerTrail[i];
        const ptX = this.hitLineX + (pt.time - songTime) * this.pixelsPerSecond;
        const ptY = this.midiToY(pt.fineMidi);

        if (ptX > 0 && ptX < this.width) {
          if (!started) {
            ctx.moveTo(ptX, ptY);
            started = true;
          } else {
            // Se houve um salto de tempo grande (silêncio), quebra a linha
            const prevPt = this.playerTrail[i - 1];
            if (pt.time - prevPt.time > 0.08) {
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(ptX, ptY);
            } else {
              ctx.lineTo(ptX, ptY);
            }
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Resetar glow
    }

    // 6. Desenhar a "Centelha" na agulha
    if (isHitNow) {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      // Encontrar altura da nota atual
      for (const note of this.testNotes) {
        if (songTime >= note.start && songTime <= note.start + note.duration) {
          ctx.arc(this.hitLineX, this.midiToY(note.midi), 9, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.shadowBlur = 0;
    }
  }
}

window.SingStarSandbox = SingStarSandbox;

