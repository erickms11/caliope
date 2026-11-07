/**
 * Caliope Latency Calibrator
 * Medição acústica automática e rítmica de atraso do microfone
 */

class LatencyCalibrator {
  constructor(pitchDetector, onOffsetChanged) {
    this.detector = pitchDetector;
    this.onOffsetChanged = onOffsetChanged;
    this.offsetMs = parseInt(localStorage.getItem('caliope_latency_offset') || '50', 10);
    
    // Auto Calib State
    this.isAutoCalibrating = false;
    this.beepTimes = [];
    this.detectedDelays = [];

    // Rhythm Calib State
    this.isRhythmCalibrating = false;
    this.rhythmStartTime = 0;
    this.beatDuration = 600; // ms por batida (100 BPM)
    this.rhythmIntervalId = null;
    this.targetBeatTime = 0;
    this.waitingForHit = false;
  }

  getOffset() {
    return this.offsetMs;
  }

  setOffset(ms) {
    this.offsetMs = Math.max(0, Math.min(400, Math.round(ms)));
    localStorage.setItem('caliope_latency_offset', this.offsetMs.toString());
    if (this.onOffsetChanged) {
      this.onOffsetChanged(this.offsetMs);
    }
  }

  /**
   * Teste Acústico Automático
   * Toca 3 bips curtos com intervalos e escuta quando o microfone registra o pico
   */
  async runAutoCalibration(statusCallback) {
    if (!this.detector.isListening) {
      statusCallback("⚠️ Inicie o microfone primeiro!");
      return;
    }
    if (this.isAutoCalibrating) return;

    this.isAutoCalibrating = true;
    this.detectedDelays = [];
    statusCallback("🔇 Silêncio na sala... preparando bips...");

    await new Promise(r => setTimeout(r, 600));

    const NUM_BEEPS = 3;
    const ctx = this.detector.audioCtx;

    for (let i = 0; i < NUM_BEEPS; i++) {
      statusCallback(`🔊 Bip ${i + 1}/${NUM_BEEPS}...`);
      
      const beepTime = performance.now();
      this.playShortBeep(ctx);

      // Aguarda pico no microfone por até 500ms
      const delay = await this.listenForSpike(beepTime, 500);
      if (delay !== null) {
        this.detectedDelays.push(delay);
        statusCallback(`✅ Bip ${i + 1}: ${Math.round(delay)} ms`);
      } else {
        statusCallback(`⚠️ Bip ${i + 1}: Sem retorno (aumente o som das caixas)`);
      }

      await new Promise(r => setTimeout(r, 700));
    }

    this.isAutoCalibrating = false;

    if (this.detectedDelays.length > 0) {
      const avg = this.detectedDelays.reduce((a, b) => a + b, 0) / this.detectedDelays.length;
      const finalOffset = Math.round(avg);
      this.setOffset(finalOffset);
      statusCallback(`🎉 Calibração concluída! Latência média: ${finalOffset} ms`);
    } else {
      statusCallback(`❌ Não foi possível ouvir o bip no microfone. Aproxime o som ou use o modo rítmico.`);
    }
  }

  playShortBeep(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime); // 1.4 kHz (bem audível)

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  }

  listenForSpike(beepTime, maxWaitMs) {
    return new Promise(resolve => {
      const startTime = performance.now();
      const checkInterval = 4; // ms
      const initialRms = this.detector.getAudioData().volume;
      const threshold = Math.max(0.08, initialRms * 3.5);

      const timer = setInterval(() => {
        const now = performance.now();
        if (now - startTime > maxWaitMs) {
          clearInterval(timer);
          resolve(null);
          return;
        }

        const data = this.detector.getAudioData();
        // Só aceita se já tiver passado pelo menos 15ms (evita vazamento eletrônico instantâneo se houver)
        if (now - beepTime > 15 && data.volume > threshold) {
          clearInterval(timer);
          resolve(now - beepTime);
        }
      }, checkInterval);
    });
  }

  /**
   * Teste Rítmico (Metrônomo visual)
   */
  startRhythmCalibration(renderRunnerCallback, feedbackCallback) {
    if (!this.detector.isListening) {
      feedbackCallback("⚠️ Inicie o microfone primeiro!");
      return;
    }

    this.isRhythmCalibrating = !this.isRhythmCalibrating;
    if (!this.isRhythmCalibrating) {
      feedbackCallback("Teste rítmico pausado.");
      return;
    }

    feedbackCallback("Observe a bolinha. Diga 'TÁ!' bem no centro amarelo!");
    this.rhythmStartTime = performance.now();
    let hitSamples = [];

    const loop = () => {
      if (!this.isRhythmCalibrating) return;

      const now = performance.now();
      const cycleDuration = this.beatDuration * 4; // 4 tempos
      const elapsed = (now - this.rhythmStartTime) % cycleDuration;
      const progress = elapsed / cycleDuration; // 0 a 1

      // A bolinha vai da esquerda (0) até o centro (0.5 no tempo 4) e depois direita
      const xPercent = (progress * 100);
      renderRunnerCallback(xPercent);

      // No tempo 0.5 (50%), é o alvo perfeito (batida 4)
      const targetTimeThisCycle = now - elapsed + (cycleDuration * 0.5);

      // Escuta som do usuário
      const audio = this.detector.getAudioData();
      if (audio.volume > 0.08) {
        const diffMs = now - targetTimeThisCycle;
        // Se cantou na janela de -250ms a +350ms em volta do alvo
        if (Math.abs(diffMs) < 300) {
          hitSamples.push(diffMs);
          const msg = diffMs >= 0 
            ? `Você soou ${Math.round(diffMs)} ms depois (+atraso)`
            : `Você soou ${Math.round(Math.abs(diffMs))} ms antes`;
          
          feedbackCallback(`🎯 ${msg}`);
          
          if (hitSamples.length >= 3) {
            const avgDiff = hitSamples.reduce((a, b) => a + b, 0) / hitSamples.length;
            if (avgDiff > 0) {
              this.setOffset(avgDiff);
              feedbackCallback(`⭐ Calibrado em ${Math.round(avgDiff)} ms!`);
            }
            hitSamples = [];
          }
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.LatencyCalibrator = LatencyCalibrator;

