/**
 * Caliope Controller Principal (Videokê Experience)
 * Gerencia o Lobby de Músicas, a Contagem Regressiva de 5s, o Palco e as Configurações de Áudio.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Módulos Centrais
  const detector = new PitchDetector();
  const calibrator = new LatencyCalibrator(detector);
  let sequencer = null;
  let gameEngine = null;
  let selectedSong = null;
  let countdownInterval = null;

  // 2. Elementos de Visualização (Lobby vs Palco vs Ranking)
  const viewLobby = document.getElementById('view-lobby');
  const viewRanking = document.getElementById('view-ranking');
  const viewStage = document.getElementById('view-stage');
  const navBtnLobby = document.getElementById('nav-btn-lobby');
  const navBtnRanking = document.getElementById('nav-btn-ranking');
  const btnHomeLogo = document.getElementById('btn-home-logo');
  const btnStageBack = document.getElementById('btn-stage-back');
  const btnBackToMenuBottom = document.getElementById('btn-back-to-menu-bottom');
  const songsGrid = document.getElementById('songs-grid');
  const lobbySearch = document.getElementById('lobby-search');

  // Elementos da Tela de Ranking
  const rankingSearch = document.getElementById('ranking-search');
  const podiumGrid = document.getElementById('podium-grid');
  const rankingTableBody = document.getElementById('ranking-table-body');
  const rankingEmptyState = document.getElementById('ranking-empty-state');
  const btnClearRanking = document.getElementById('btn-clear-ranking');
  const btnEmptyGoSing = document.getElementById('btn-empty-go-sing');
  const DEFAULT_RANKINGS = [
  {
    "id": "mw5pihvqptq7",
    "singer": "Erick Moraes",
    "songTitle": "Te Esperando",
    "songArtist": "Luan Santana",
    "songId": "__Te_Esperando_Luan_Santana_3nBAoA",
    "score": 8800,
    "accuracy": 85,
    "maxCombo": 72,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T01:10:29.126Z"
  },
  {
    "id": "mw5o551e5pir",
    "singer": "Erick Moraes",
    "songTitle": "Talking To The Moon",
    "songArtist": "Bruno Mars",
    "songId": "Bruno_Mars_Talking_To_The_Moon_-_Version_from_kdtWMj",
    "score": 8800,
    "accuracy": 85,
    "maxCombo": 38,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:32:06.338Z"
  },
  {
    "id": "mw6tsj9uyfju",
    "singer": "Erick Moraes",
    "songTitle": "Te Esperando",
    "songArtist": "Luan Santana",
    "songId": "__Te_Esperando_Luan_Santana_3nBAoA",
    "score": 8720,
    "accuracy": 84,
    "maxCombo": 59,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T19:58:02.130Z"
  },
  {
    "id": "mw5mdji05luw",
    "singer": "Erick Moraes",
    "songTitle": "Angels",
    "songArtist": "Robbie Williams",
    "songId": "Robbie_Williams_Angels_pGFEj-",
    "score": 8720,
    "accuracy": 84,
    "maxCombo": 49,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-06T23:42:39.096Z"
  },
  {
    "id": "mw6uf4z4y3vt",
    "singer": "Erick Moraes",
    "songTitle": "Bijuteria",
    "songArtist": "Bruno & Marrone",
    "songId": "Bijuteria_Bruno_e_Marrone_qk4w6J",
    "score": 8640,
    "accuracy": 83,
    "maxCombo": 35,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:15:36.688Z"
  },
  {
    "id": "mw5p7pliojsc",
    "singer": "Erick Moraes",
    "songTitle": "Just Give Me A Reason",
    "songArtist": "P!nk ft. Nate Ruess",
    "songId": "Just_Give_Me_A_Reason_Pink_Ft__Nate_ruess_7YSYFT",
    "score": 8640,
    "accuracy": 83,
    "maxCombo": 27,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T01:02:05.910Z"
  },
  {
    "id": "mw6vtzzgsrsy",
    "singer": "Priscila Moraes",
    "songTitle": "Como nossos pais",
    "songArtist": "Elis Regina",
    "songId": "Elis_Regina_Como_nossos_pais_f0zT_J",
    "score": 8640,
    "accuracy": 83,
    "maxCombo": 30,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:55:09.676Z"
  },
  {
    "id": "mw6wrdxhfk6j",
    "singer": "Erick Moraes",
    "songTitle": "Lady Laura",
    "songArtist": "Roberto Carlos",
    "songId": "Roberto_Carlos_Lady_Laura_aNZqP4",
    "score": 8640,
    "accuracy": 83,
    "maxCombo": 29,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:21:07.397Z"
  },
  {
    "id": "mw5n7knz5cs4",
    "singer": "Erick Moraes",
    "songTitle": "Minha Estrela Perdida",
    "songArtist": "João Paulo e Daniel",
    "songId": "Jo_o_Paulo_e_Daniel_Minha_Estrela_Perdida_BvTDeE",
    "score": 8560,
    "accuracy": 82,
    "maxCombo": 27,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:06:00.287Z"
  },
  {
    "id": "mw5oogwd32tu",
    "singer": "Erick Moraes",
    "songTitle": "Caça e Caçador",
    "songArtist": "Fábio Jr.",
    "songId": "__Ca_a_e_Ca_ador_F_bio_Jr__8fm8rn",
    "score": 8560,
    "accuracy": 82,
    "maxCombo": 26,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:47:08.173Z"
  },
  {
    "id": "mw6wxfrk74vb",
    "singer": "Emerson e Valdevino",
    "songTitle": "Boate azul",
    "songArtist": "Bruno e Marrone",
    "songId": "Bruno_e_Marrone_Boate_azul_CCSeIh",
    "score": 8560,
    "accuracy": 83,
    "maxCombo": 24,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:25:49.712Z"
  },
  {
    "id": "mw6u1ly9as9w",
    "singer": "Erick Moraes",
    "songTitle": "GUSTAVO MIOTO",
    "songArtist": "EU E EU",
    "songId": "EU_E_EU_GUSTAVO_MIOTO_oft0y3",
    "score": 8480,
    "accuracy": 83,
    "maxCombo": 23,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:05:05.505Z"
  },
  {
    "id": "mw5ny7rr5hc1",
    "singer": "Erick Moraes",
    "songTitle": "Like A Stone",
    "songArtist": "Audioslave",
    "songId": "CC_Karaoke_X_Audioslave___Like_A_Stone_WjHMQZ",
    "score": 8400,
    "accuracy": 82,
    "maxCombo": 23,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:26:43.287Z"
  },
  {
    "id": "mw6wk8zgxtgv",
    "singer": "Erick Kinoshita",
    "songTitle": "Minha Estrela Perdida",
    "songArtist": "João Paulo e Daniel",
    "songId": "Jo_o_Paulo_e_Daniel_Minha_Estrela_Perdida_BvTDeE",
    "score": 8182,
    "accuracy": 81,
    "maxCombo": 21,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:15:34.397Z"
  },
  {
    "id": "mw5oimrzie81",
    "singer": "Erick Moraes",
    "songTitle": "How Deep Is Your Love",
    "songArtist": "Take That",
    "songId": "Take_That_How_Deep_Is_Your_Love_-_from_Zoom_iXYKvk",
    "score": 8160,
    "accuracy": 82,
    "maxCombo": 20,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:42:35.855Z"
  },
  {
    "id": "mw5p0eio2y6y",
    "singer": "Erick Moraes",
    "songTitle": "Dois Rios",
    "songArtist": "Skank",
    "songId": "SKANK_DOIS_RIOS_NSve9N",
    "score": 8080,
    "accuracy": 82,
    "maxCombo": 19,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T00:56:24.960Z"
  },
  {
    "id": "mw6tbr07j123",
    "singer": "Erick Moraes",
    "songTitle": "Ainda Ontem Chorei De Saudade",
    "songArtist": "João Mineiro E Marciano",
    "songId": "Jo_o_Mineiro_E_Marciano_Ainda_Ontem_Chorei_De__C62mL",
    "score": 7600,
    "accuracy": 81,
    "maxCombo": 14,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T19:44:58.999Z"
  },
  {
    "id": "mw6w8ad57nke",
    "singer": "Valdevino e Priscila",
    "songTitle": "Dona",
    "songArtist": "Roupa Nova",
    "songId": "Roupa_Nova_Dona__AvqUg",
    "score": 7600,
    "accuracy": 82,
    "maxCombo": 13,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:06:16.313Z"
  },
  {
    "id": "mw6tmsp9komu",
    "singer": "Erick Moraes",
    "songTitle": "Ainda Ontem Chorei De Saudade",
    "songArtist": "João Mineiro E Marciano",
    "songId": "Jo_o_Mineiro_E_Marciano_Ainda_Ontem_Chorei_De__C62mL",
    "score": 6960,
    "accuracy": 81,
    "maxCombo": 6,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T19:53:34.413Z"
  },
  {
    "id": "mw6pmyi7o8y4",
    "singer": "Erick Moraes",
    "songTitle": "Angels",
    "songArtist": "Robbie Williams",
    "songId": "Robbie_Williams_Angels_pGFEj-",
    "score": 6960,
    "accuracy": 87,
    "maxCombo": 0,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T18:01:43.471Z"
  },
  {
    "id": "mw6w1gdmsipq",
    "singer": "Valdevino e Priscila",
    "songTitle": "Estou Apaixonado",
    "songArtist": "João Paulo & Daniel",
    "songId": "Jo_o_Paulo___Daniel_Estou_Apaixonado_r68Ak9",
    "score": 6960,
    "accuracy": 80,
    "maxCombo": 7,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:00:57.514Z"
  },
  {
    "id": "mw6u70x65l01",
    "singer": "Erick Moraes",
    "songTitle": "Que Nem Maré",
    "songArtist": "Jorge Vercillo",
    "songId": "__Que_Nem_Mar__Jorge_Vercillo_yZRSFb",
    "score": 6880,
    "accuracy": 80,
    "maxCombo": 6,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:09:18.187Z"
  },
  {
    "id": "mw6ukn8yec66",
    "singer": "Priscila Moraes",
    "songTitle": "Liga pra mim",
    "songArtist": "Calcinha Preta",
    "songId": "Calcinha_Preta_Liga_pra_mim_Fa2HI8",
    "score": 6720,
    "accuracy": 78,
    "maxCombo": 6,
    "stars": 3,
    "rank": "B",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:19:53.650Z"
  },
  {
    "id": "mw6sv0xrx4u6",
    "singer": "Erick Moraes",
    "songTitle": "Até Que Durou",
    "songArtist": "Péricles",
    "songId": "Karaok__Melhor_Do_Brasil___At__Que_Durou_P_ri_7Jrl7j",
    "score": 6560,
    "accuracy": 79,
    "maxCombo": 3,
    "stars": 3,
    "rank": "B",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T19:31:58.719Z"
  },
  {
    "id": "mw6we75qenoc",
    "singer": "Valdevino e Priscila",
    "songTitle": "Mastruz Com Leite",
    "songArtist": "3885 Moto Táxi",
    "songId": "3885_Moto_T_xi_Mastruz_Com_Leite_SsEpSl",
    "score": 6320,
    "accuracy": 79,
    "maxCombo": 0,
    "stars": 3,
    "rank": "B",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T21:10:52.094Z"
  },
  {
    "id": "mw6vnpdatrx1",
    "singer": "Priscila Moraes",
    "songTitle": "POEMA",
    "songArtist": "NEY MATOGROSSO",
    "songId": "NEY_MATOGROSSO_POEMA_ZvVruy",
    "score": 6212,
    "accuracy": 84,
    "maxCombo": 44,
    "stars": 4,
    "rank": "A",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:50:15.982Z"
  },
  {
    "id": "mw6vhy53qb6j",
    "singer": "Priscila Moraes",
    "songTitle": "Thiaguinho",
    "songArtist": "Ainda Bem",
    "songId": "Ainda_Bem_Thiaguinho_kyTDGR",
    "score": 2979,
    "accuracy": 79,
    "maxCombo": 6,
    "stars": 3,
    "rank": "B",
    "difficulty": "Médio",
    "difficultyId": "medium",
    "date": "2026-11-07T20:45:47.415Z"
  }
];
  let caliopeRankings = [...DEFAULT_RANKINGS];
  let currentRankingDiff = 'all';
  let currentSinger = localStorage.getItem('caliope_singer_name') || 'Erick Moraes';

  // Contagem Regressiva de 5 Segundos
  const countdownOverlay = document.getElementById('countdown-overlay');
  const countdownSongTitle = document.getElementById('countdown-song-title');
  const countdownDetails = document.getElementById('countdown-details');
  const countdownNumber = document.getElementById('countdown-number');
  const countdownTip = document.getElementById('countdown-tip');
  const btnSkipCountdown = document.getElementById('btn-skip-countdown');

  // HUD do Palco
  const hudGenre = document.getElementById('hud-genre');
  const hudKey = document.getElementById('hud-key');
  const hudTitle = document.getElementById('hud-title');
  const hudArtist = document.getElementById('hud-artist');
  const liveScore = document.getElementById('live-score');
  const liveAccuracy = document.getElementById('live-accuracy');
  const comboPill = document.getElementById('combo-pill');
  const comboText = document.getElementById('combo-text');
  const multiplierTag = document.getElementById('multiplier-tag');
  const starsElements = document.querySelectorAll('#stars-row .star');
  const timelineFill = document.getElementById('timeline-fill');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const floatingHit = document.getElementById('floating-hit');

  // Banner de Celebração de Marcos de Pontuação (5k, 10k...) e Confetes
  const milestoneBanner = document.getElementById('milestone-banner');
  const milestoneBadge = document.getElementById('milestone-badge');
  const milestoneScore = document.getElementById('milestone-score');
  const milestoneSubtitle = document.getElementById('milestone-subtitle');
  const confettiCanvas = document.getElementById('confetti-canvas');
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiAnimId = null;
  let milestoneHideTimeout = null;
  let achievedMilestones = new Set();

  const SCORE_MILESTONES = [
    { threshold: 1000, badge: '🔥 AQUECENDO A VOZ', title: '1.000 PONTOS!', subtitle: 'Primeiro marco! Segure o ritmo!', sound: 'low' },
    { threshold: 2500, badge: '⚡ EM RITMO ACELERADO', title: '2.500 PONTOS!', subtitle: 'Ótimo fôlego! Mandando bem demais!', sound: 'mid' },
    { threshold: 5000, badge: '🌟 METADE DO CAMINHO!', title: '5.000 PONTOS!', subtitle: 'Espetacular! A plateia está vibrando!', sound: 'high' },
    { threshold: 7500, badge: '🎤 AFINAÇÃO DE OURO', title: '7.500 PONTOS!', subtitle: 'Voz cirúrgica! Nível de gravação profissional!', sound: 'high' },
    { threshold: 9000, badge: '👑 SHOW HISTÓRICO!', title: '9.000 PONTOS!', subtitle: 'Incrível! O palco é todo seu!', sound: 'high' },
    { threshold: 10000, badge: '🏆 PONTUAÇÃO MÁXIMA!', title: '10.000 PONTOS!', subtitle: 'PERFEITO! Você zerou o videokê!', sound: 'fanfare' }
  ];

  // Sistema de Confetes e Partículas Festivas
  function initConfettiCanvas() {
    if (!confettiCanvas) return;
    confettiCtx = confettiCanvas.getContext('2d');
  }

  function launchMilestoneConfetti(count = 70) {
    if (!confettiCanvas) return;
    if (!confettiCtx) initConfettiCanvas();
    if (!confettiCtx) return;

    const width = confettiCanvas.width || 1160;
    const height = confettiCanvas.height || 540;

    const colors = [
      '#fbbf24', '#f59e0b', // Dourado e Âmbar
      '#06b6d4', '#38bdf8', // Ciano Neon e Azul Céu
      '#ec4899', '#f43f5e', // Rosa Choque e Carmesim
      '#a855f7', '#6366f1', // Roxo Neon e Índigo
      '#10b981', '#34d399', // Esmeralda
      '#ffffff'             // Branco puro cintilante
    ];

    const originX = width / 2;
    const originY = 85;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 0.15) + (Math.random() * Math.PI * 0.7);
      const speed = 4 + Math.random() * 8.5;
      confettiParticles.push({
        x: originX + (Math.random() - 0.5) * 120,
        y: originY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.7),
        vy: -Math.sin(angle) * (speed * 0.6) - (1 + Math.random() * 2.8),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 7,
        tiltAngle: Math.random() * Math.PI * 2,
        tiltSpeed: 0.05 + Math.random() * 0.12,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        gravity: 0.18 + Math.random() * 0.1,
        drag: 0.985,
        opacity: 1,
        life: 0,
        maxLife: 130 + Math.floor(Math.random() * 55),
        shape: Math.random() > 0.35 ? 'rect' : 'circle'
      });
    }

    if (!confettiAnimId) {
      runConfettiLoop();
    }
  }

  function runConfettiLoop() {
    if (!confettiCtx || !confettiCanvas) return;
    const width = confettiCanvas.width;
    const height = confettiCanvas.height;

    confettiCtx.clearRect(0, 0, width, height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.life++;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.tiltAngle += p.tiltSpeed;
      p.rotation += p.rotationSpeed;

      if (p.life > p.maxLife * 0.7) {
        p.opacity = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
      }

      if (p.opacity <= 0 || p.y > height + 25) {
        confettiParticles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.globalAlpha = p.opacity;
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);

      confettiCtx.fillStyle = p.color;
      if (p.shape === 'rect') {
        const tiltX = Math.sin(p.tiltAngle) * (p.size * 0.6);
        confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size + tiltX, p.size * 0.6);
      } else {
        confettiCtx.beginPath();
        confettiCtx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        confettiCtx.fill();
      }
      confettiCtx.restore();
    }

    if (confettiParticles.length > 0) {
      confettiAnimId = requestAnimationFrame(runConfettiLoop);
    } else {
      confettiAnimId = null;
      confettiCtx.clearRect(0, 0, width, height);
    }
  }

  // Mini-Sintetizador de Fanfarra Festiva (Web Audio API)
  function playMilestoneSound(soundType) {
    try {
      const ctx = detector?.audioCtx;
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      let notes = [587.33, 880.00]; // D5, A5
      if (soundType === 'mid') {
        notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      } else if (soundType === 'high') {
        notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      } else if (soundType === 'fanfare') {
        notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      }

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.38);
      });
    } catch (e) {
      // Ignora silenciosamente se o contexto de áudio não permitir
    }
  }

  function triggerMilestoneCelebration(m) {
    playMilestoneSound(m.sound);

    // Efeito de pulso dourado comemorativo no placar
    if (liveScore) {
      liveScore.classList.remove('milestone-pop');
      void liveScore.offsetWidth;
      liveScore.classList.add('milestone-pop');
    }

    // Explosão de confetes e serpentinas
    launchMilestoneConfetti(m.threshold >= 10000 ? 95 : 65);

    // Exibir banner de conquista com fade-out automático
    if (milestoneBanner) {
      if (milestoneHideTimeout) clearTimeout(milestoneHideTimeout);

      if (milestoneBadge) milestoneBadge.textContent = m.badge;
      if (milestoneScore) milestoneScore.textContent = m.title;
      if (milestoneSubtitle) milestoneSubtitle.textContent = m.subtitle;

      milestoneBanner.classList.remove('hide');
      milestoneBanner.classList.add('show');

      milestoneHideTimeout = setTimeout(() => {
        milestoneBanner.classList.remove('show');
        milestoneBanner.classList.add('hide');
      }, 2800);
    }
  }

  function checkScoreMilestones(score) {
    for (let i = 0; i < SCORE_MILESTONES.length; i++) {
      const m = SCORE_MILESTONES[i];
      if (score >= m.threshold && !achievedMilestones.has(m.threshold)) {
        achievedMilestones.add(m.threshold);
        triggerMilestoneCelebration(m);
        break;
      }
    }
  }

  // Monitor Visual do Microfone no HUD (Barrinha VU + Nota Musical Estável)
  const hudMicMeterFill = document.getElementById('hud-mic-meter-fill');
  const hudMicVol = document.getElementById('hud-mic-vol');
  const hudMicNote = document.getElementById('hud-mic-note');
  let lastNoteText = '🎵 Tom: aguardando voz...';
  let lastNoteTime = 0;

  // Nível de Dificuldade (Fácil, Médio, Difícil)
  let currentDifficulty = localStorage.getItem('caliope_difficulty') || 'medium';
  const diffLabels = { easy: '🟢 Fácil', medium: '🟡 Médio', hard: '🔴 Difícil' };
  const diffNames = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };

  // Elementos do Modal de Dificuldade Pré-Jogo
  const stageDiffBadge = document.getElementById('stage-diff-badge');
  const prestartModal = document.getElementById('prestart-modal');
  const prestartSongTitle = document.getElementById('prestart-song-title');
  const prestartSongArtist = document.getElementById('prestart-song-artist');
  const prestartSongKey = document.getElementById('prestart-song-key');
  const prestartSongDuration = document.getElementById('prestart-song-duration');
  const singerNameInput = document.getElementById('singer-name-input');
  const btnCancelPrestart = document.getElementById('btn-cancel-prestart');
  const btnConfirmStart = document.getElementById('btn-confirm-start');
  let pendingSong = null;

  function updateDifficultyUI(level) {
    if (!['easy', 'medium', 'hard'].includes(level)) level = 'medium';
    currentDifficulty = level;
    localStorage.setItem('caliope_difficulty', level);

    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === level);
    });

    document.querySelectorAll('.diff-choice-card').forEach(card => {
      card.classList.toggle('active', card.dataset.diff === level);
    });

    if (stageDiffBadge) {
      stageDiffBadge.textContent = diffLabels[level] || '🟡 Médio';
    }

    if (gameEngine) {
      gameEngine.setDifficulty(level);
    }

    if (countdownDetails && selectedSong) {
      countdownDetails.textContent = `🎹 Tom: ${selectedSong.key || 'Detectado'} • Dificuldade: ${diffNames[level] || 'Médio'}`;
    }
  }

  function openDifficultyModal(song) {
    pendingSong = song;
    prestartSongTitle.textContent = song.title;
    prestartSongArtist.textContent = song.artist;
    prestartSongKey.textContent = song.key ? `🎹 Tom: ${song.key}` : '🎹 Tom: Auto';
    prestartSongDuration.textContent = `⏱️ ${formatTime(song.duration)}`;

    if (singerNameInput) {
      singerNameInput.value = localStorage.getItem('caliope_singer_name') || 'Erick Moraes';
    }

    // Destacar o card da dificuldade atual
    document.querySelectorAll('.diff-choice-card').forEach(card => {
      card.classList.toggle('active', card.dataset.diff === currentDifficulty);
    });

    prestartModal.classList.add('active');
  }

  document.querySelectorAll('.diff-choice-card').forEach(card => {
    card.addEventListener('click', () => {
      const diff = card.dataset.diff;
      if (diff) {
        updateDifficultyUI(diff);
      }
    });

    // Dois cliques já inicia o videokê diretamente!
    card.addEventListener('dblclick', () => {
      const diff = card.dataset.diff;
      if (diff) updateDifficultyUI(diff);
      if (pendingSong) {
        const songToPlay = pendingSong;
        prestartModal.classList.remove('active');
        pendingSong = null;
        startSongWithCountdown(songToPlay);
      }
    });
  });

  if (btnConfirmStart) {
    btnConfirmStart.addEventListener('click', () => {
      if (pendingSong) {
        const songToPlay = pendingSong;
        prestartModal.classList.remove('active');
        pendingSong = null;
        startSongWithCountdown(songToPlay);
      }
    });
  }

  const btnClosePrestartTop = document.getElementById('btn-close-prestart-top');
  if (btnClosePrestartTop) {
    btnClosePrestartTop.addEventListener('click', () => {
      prestartModal.classList.remove('active');
      pendingSong = null;
    });
  }

  if (btnCancelPrestart) {
    btnCancelPrestart.addEventListener('click', () => {
      prestartModal.classList.remove('active');
      pendingSong = null;
    });
  }

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const diff = btn.dataset.diff;
      if (diff) updateDifficultyUI(diff);
    });
  });

  // Controles de Palco
  const stageOverlay = document.getElementById('stage-overlay');
  const btnPlaySong = document.getElementById('btn-play-song');
  const btnPauseSong = document.getElementById('btn-pause-song');
  const btnRestartSong = document.getElementById('btn-restart-song');
  const pauseIcon = document.getElementById('pause-icon');
  const pauseText = document.getElementById('pause-text');

  // Letra Auxiliar (para músicas sem vídeo)
  const lyricsBox = document.getElementById('lyrics-box');
  const lyricsLine1 = document.getElementById('lyrics-line-1');
  const lyricsLine2 = document.getElementById('lyrics-line-2');

  // Modal de Resultados
  const resultsModal = document.getElementById('results-modal');
  const modalRank = document.getElementById('modal-rank');
  const modalTitle = document.getElementById('modal-title');
  const modalSongInfo = document.getElementById('modal-song-info');
  const modalDifficulty = document.getElementById('modal-difficulty');
  const modalKey = document.getElementById('modal-key');
  const modalStars = document.getElementById('modal-stars');
  const modalScore = document.getElementById('modal-score');
  const modalAccuracy = document.getElementById('modal-accuracy');
  const modalCombo = document.getElementById('modal-combo');
  const modalSingerName = document.getElementById('modal-singer-name');
  const modalRankingPos = document.getElementById('modal-ranking-pos');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnChooseOther = document.getElementById('btn-choose-other');
  const btnViewRanking = document.getElementById('btn-view-ranking');

  // Modal de Ajustes
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const modalBtnToggleEcho = document.getElementById('modal-btn-toggle-echo');
  const modalEchoIcon = document.getElementById('modal-echo-icon');
  const modalEchoText = document.getElementById('modal-echo-text');
  const modalBtnToggleNormalize = document.getElementById('modal-btn-toggle-normalize');
  const modalNormIcon = document.getElementById('modal-norm-icon');
  const modalNormText = document.getElementById('modal-norm-text');
  const modalQuickGate = document.getElementById('modal-quick-gate');
  const modalGateValText = document.getElementById('modal-gate-val-text');
  const btnAutoCalibrateGate = document.getElementById('btn-auto-calibrate-gate');
  const modalMicMeterFill = document.getElementById('modal-mic-meter-fill');
  const modalVolNum = document.getElementById('modal-vol-num');
  const modalBtnClearCache = document.getElementById('modal-btn-clear-cache');

  // Modal de Importação do YouTube
  const btnOpenImport = document.getElementById('btn-open-import');
  const btnImportLabel = document.getElementById('btn-import-label');
  const btnImportIcon = document.getElementById('btn-import-icon');
  const btnCloseImport = document.getElementById('btn-close-import');
  const importModal = document.getElementById('import-modal');
  const importForm = document.getElementById('import-form');
  const ytUrlInput = document.getElementById('yt-url-input');
  const btnStartImport = document.getElementById('btn-start-import');
  const importProgressWrap = document.getElementById('import-progress-wrap');
  const importBarFill = document.getElementById('import-bar-fill');
  const importStatusText = document.getElementById('import-status-text');
  const stepDl = document.getElementById('step-dl');
  const stepSep = document.getElementById('step-sep');
  const stepLyr = document.getElementById('step-lyr');

  // Botão de Tela Cheia
  const btnToggleFullscreen = document.getElementById('btn-toggle-fullscreen');
  const fullscreenIcon = document.getElementById('fullscreen-icon');
  const fullscreenLabel = document.getElementById('fullscreen-label');

  // Elementos do Microfone no Celular (WebRTC PeerJS)
  const btnOpenRemoteMic = document.getElementById('btn-open-remote-mic');
  const remoteMicHeaderIcon = document.getElementById('remote-mic-header-icon');
  const remoteMicHeaderLabel = document.getElementById('remote-mic-header-label');
  const hudRemoteBadge = document.getElementById('hud-remote-badge');
  const hudRemoteDot = document.getElementById('hud-remote-dot');
  const hudRemoteText = document.getElementById('hud-remote-text');
  const modalRemoteMic = document.getElementById('modal-remote-mic');
  const btnCloseRemoteMic = document.getElementById('btn-close-remote-mic');
  const remoteMicQrcode = document.getElementById('remote-mic-qrcode');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const remoteStatusDot = document.getElementById('remote-status-dot');
  const remoteMicStatusText = document.getElementById('remote-mic-status-text');
  const connectedSingerCard = document.getElementById('connected-singer-card');
  const connectedSingerName = document.getElementById('connected-singer-name');
  const remoteMicLinkInput = document.getElementById('remote-mic-link-input');
  const btnCopyMicLink = document.getElementById('btn-copy-mic-link');

  let remotePeer = null;
  let remoteConnection = null;
  let isStaticHosting = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';
  let currentRoomId = 'cali-' + Math.floor(1000 + Math.random() * 9000);

  // 3. Formatação Auxiliar
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // 4. Renderização do Lobby de Músicas (Padrão Jogo)
  function renderLobbySongs(filterText = '') {
    if (!songsGrid) return;
    songsGrid.innerHTML = '';

    const filter = filterText.toLowerCase().trim();
    const songsToDisplay = window.SONGS_CATALOG.filter(s => {
      if (!filter) return true;
      return (s.title && s.title.toLowerCase().includes(filter)) ||
             (s.artist && s.artist.toLowerCase().includes(filter));
    });

    songsToDisplay.forEach(song => {
      const card = document.createElement('div');
      card.className = 'song-card';
      
      const thumbUrl = song.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
      const isVideo = Boolean(song.videoUrl);
      const keyTag = song.key ? `<span class="song-card-key">🎹 Tom: ${song.key}</span>` : '';

      card.innerHTML = `
        <div class="song-card-thumb">
          <img src="${thumbUrl}" alt="${song.title}" loading="lazy">
          <span class="song-card-duration">⏱️ ${formatTime(song.duration)}</span>
          <span class="song-card-tag">${isVideo ? '🎬 Videokê' : '🎵 Clássico'}</span>
          <button class="song-card-btn-delete" title="Excluir música do Videokê">🗑️</button>
        </div>
        <div class="song-card-body">
          <h3 class="song-card-title" title="${song.title}">${song.title}</h3>
          <p class="song-card-artist" title="${song.artist}">${song.artist}</p>
          ${keyTag}
          <button class="btn btn-primary btn-start-song">
            🎤 Cantar
          </button>
        </div>
      `;

      card.querySelector('.btn-start-song').addEventListener('click', () => {
        openDifficultyModal(song);
      });

      const btnDelete = card.querySelector('.song-card-btn-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = confirm(`Deseja realmente excluir "${song.title}" da sua biblioteca?`);
          if (!confirmed) return;

          btnDelete.disabled = true;
          btnDelete.textContent = '⏳';

          try {
            const res = await fetch(`/api/songs/${encodeURIComponent(song.id)}`, {
              method: 'DELETE'
            });

            if (res.ok) {
              const idx = window.SONGS_CATALOG.findIndex(s => s.id === song.id);
              if (idx !== -1) {
                window.SONGS_CATALOG.splice(idx, 1);
              }
              renderLobbySongs(lobbySearch ? lobbySearch.value : '');
            } else {
              const err = await res.json().catch(() => ({}));
              alert(`Erro ao excluir: ${err.error || 'Falha no servidor'}`);
              btnDelete.disabled = false;
              btnDelete.textContent = '🗑️';
            }
          } catch (err) {
            alert(`Erro ao conectar com o servidor: ${err.message}`);
            btnDelete.disabled = false;
            btnDelete.textContent = '🗑️';
          }
        });
      }

      songsGrid.appendChild(card);
    });

    // Card Especial para Adicionar do YouTube
    const addCard = document.createElement('div');
    if (isStaticHosting) {
      addCard.className = 'song-card song-card-add-special is-coming-soon';
      addCard.title = 'A importação de novos vídeos online estará disponível em breve!';
      addCard.innerHTML = `
        <div class="coming-soon-badge">⏳ EM BREVE</div>
        <div class="add-icon">✨</div>
        <h3>Adicionar Novo Karaokê</h3>
        <p>A importação de novos vídeos do YouTube estará disponível em breve online!</p>
        <div class="coming-soon-note">Disponível no app local do Caliope 💻</div>
      `;
      addCard.addEventListener('click', () => {
        alert("⏳ Em Breve na Versão Online!\n\nA importação e separação de faixas de novos vídeos do YouTube requer processamento local via Python.\n\nNo seu computador local, você já pode importar qualquer link do YouTube!");
      });
    } else {
      addCard.className = 'song-card song-card-add-special';
      addCard.innerHTML = `
        <div class="add-icon">✨</div>
        <h3>Adicionar Novo Karaokê</h3>
        <p>Cole o link de qualquer vídeo do YouTube para cantar agora!</p>
      `;
      addCard.addEventListener('click', () => {
        importModal.classList.add('active');
      });
    }
    songsGrid.appendChild(addCard);
  }

  if (lobbySearch) {
    lobbySearch.addEventListener('input', (e) => {
      renderLobbySongs(e.target.value);
    });
  }

  // 5. Transições de Telas (Lobby <-> Palco <-> Ranking)
  function showLobby() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (countdownOverlay) countdownOverlay.style.display = 'none';

    if (gameEngine && gameEngine.isPlaying) {
      gameEngine.stop();
    }

    viewStage.style.display = 'none';
    if (viewRanking) viewRanking.style.display = 'none';
    viewLobby.style.display = 'block';

    if (navBtnLobby) navBtnLobby.classList.add('active');
    if (navBtnRanking) navBtnRanking.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showRanking() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (countdownOverlay) countdownOverlay.style.display = 'none';

    if (gameEngine && gameEngine.isPlaying) {
      gameEngine.stop();
    }

    viewStage.style.display = 'none';
    viewLobby.style.display = 'none';
    if (viewRanking) viewRanking.style.display = 'block';

    if (navBtnRanking) navBtnRanking.classList.add('active');
    if (navBtnLobby) navBtnLobby.classList.remove('active');
    loadAndRenderRankings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStage() {
    viewLobby.style.display = 'none';
    if (viewRanking) viewRanking.style.display = 'none';
    viewStage.style.display = 'block';

    if (navBtnLobby) navBtnLobby.classList.remove('active');
    if (navBtnRanking) navBtnRanking.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (navBtnLobby) navBtnLobby.addEventListener('click', showLobby);
  if (navBtnRanking) navBtnRanking.addEventListener('click', showRanking);
  if (btnHomeLogo) btnHomeLogo.addEventListener('click', showLobby);
  if (btnStageBack) btnStageBack.addEventListener('click', showLobby);
  if (btnBackToMenuBottom) btnBackToMenuBottom.addEventListener('click', showLobby);

  // 6. Contagem Regressiva de 5 Segundos (Get Ready!)
  async function startSongWithCountdown(song) {
    selectedSong = song;

    // Resgatar e salvar nome do cantor
    const name = (singerNameInput && singerNameInput.value.trim()) || localStorage.getItem('caliope_singer_name') || 'Erick Moraes';
    currentSinger = name;
    localStorage.setItem('caliope_singer_name', name);

    showStage();

    // Atualizar dados no HUD
    hudTitle.textContent = song.title;
    hudArtist.textContent = song.artist;
    hudGenre.textContent = song.genre || 'Videokê Oficial';
    if (hudKey) hudKey.textContent = `🎹 Tom: ${song.key || 'Auto'}`;
    if (stageDiffBadge) stageDiffBadge.textContent = diffLabels[currentDifficulty] || '🟡 Médio';
    timeTotal.textContent = formatTime(song.duration);

    // Resetar HUD de pontuação e marcos
    liveScore.textContent = '00000';
    liveAccuracy.textContent = '100%';
    comboText.textContent = '0';
    multiplierTag.textContent = '1x';
    if (comboPill) comboPill.classList.remove('on-fire');
    achievedMilestones.clear();
    if (milestoneHideTimeout) clearTimeout(milestoneHideTimeout);
    if (milestoneBanner) {
      milestoneBanner.classList.remove('show');
      milestoneBanner.classList.add('hide');
    }
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    confettiParticles = [];
    if (confettiCtx && confettiCanvas) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    starsElements.forEach(s => s.classList.remove('filled'));
    timelineFill.style.setProperty('--progress', '0%');
    timeCurrent.textContent = '0:00';
    stageOverlay.classList.add('hidden');

    // Resetar Monitor Visual do Microfone
    if (hudMicMeterFill) hudMicMeterFill.style.width = '0%';
    if (hudMicVol) hudMicVol.textContent = '0%';
    if (hudMicNote) {
      hudMicNote.textContent = '🎵 Tom: aguardando voz...';
      hudMicNote.style.color = '#64748b';
    }
    lastNoteText = '🎵 Tom: aguardando voz...';
    lastNoteTime = 0;

    // Inicializar áudio se ainda não estiver ouvindo
    await initAudioAndGame();
    gameEngine.setDifficulty(currentDifficulty);
    gameEngine.loadSong(selectedSong);

    // Preparar contagem regressiva
    if (countdownInterval) clearInterval(countdownInterval);
    countdownSongTitle.textContent = `${song.title} • ${song.artist}`;
    if (countdownDetails) {
      countdownDetails.textContent = `🎹 Tom: ${song.key || 'Detectado'} • Dificuldade: ${diffNames[currentDifficulty] || 'Médio'}`;
    }
    countdownOverlay.style.display = 'flex';

    let count = 5;
    countdownNumber.textContent = count;
    countdownNumber.style.animation = 'none';
    void countdownNumber.offsetWidth; // Trigger reflow
    countdownNumber.style.animation = 'popPulse 1s ease-in-out infinite';
    countdownTip.textContent = 'Segure seu microfone e respire fundo!';

    function launchMusicNow() {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      countdownNumber.textContent = '🎶 SOLTA O SOM!';
      countdownNumber.style.fontSize = '2.8rem';
      countdownTip.textContent = 'Mostre o seu talento!';

      setTimeout(() => {
        countdownOverlay.style.display = 'none';
        countdownNumber.style.fontSize = '4.8rem';
        gameEngine.start();
      }, 500);
    }

    if (btnSkipCountdown) {
      btnSkipCountdown.onclick = () => launchMusicNow();
    }

    countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        if (count === 3) countdownTip.textContent = 'Atenção à introdução...';
        if (count === 1) countdownTip.textContent = 'Vai começar!';
      } else {
        launchMusicNow();
      }
    }, 1000);
  }

  // 7. Inicializar Sistema de Áudio & Motor do Jogo
  async function initAudioAndGame() {
    if (!gameEngine) {
      try {
        await detector.init();
      } catch (err) {
        console.warn("Microfone local não detectado ou bloqueado no host. Habilitando modo de áudio seguro / remoto:", err);
        if (!detector.audioCtx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          detector.audioCtx = new AudioContext({ latencyHint: 'interactive' });
        }
      }
      sequencer = new BackingTrackSequencer(detector.audioCtx);
      gameEngine = new KaraokeEngine('game-canvas', detector, calibrator, sequencer);
      setupEngineCallbacks();
    }
  }

  function setupEngineCallbacks() {
    // Atualização de Pontuação
    gameEngine.onScoreUpdate = (data) => {
      liveScore.textContent = data.score.toString().padStart(5, '0');
      checkScoreMilestones(data.score);

      // Sequência Afinada / Bônus Multiplicador
      if (data.combo > 0) {
        comboText.textContent = data.combo >= 20 ? `🔥 ${data.combo}` : `${data.combo}`;
        if (comboPill) comboPill.classList.toggle('on-fire', data.combo >= 20);
        multiplierTag.textContent = `${data.multiplier}x BÔNUS`;
      } else {
        comboText.textContent = '0';
        if (comboPill) comboPill.classList.remove('on-fire');
        multiplierTag.textContent = '1x';
      }

      if (liveAccuracy && data.accuracy !== undefined) {
        liveAccuracy.textContent = `${data.accuracy}%`;
      }

      // Atualizar Estrelas (Faixas estritas de Videokê)
      let starsCount = 0;
      if (data.accuracy >= 95) starsCount = 5;
      else if (data.accuracy >= 85) starsCount = 4;
      else if (data.accuracy >= 72) starsCount = 3;
      else if (data.accuracy >= 55) starsCount = 2;
      else if (data.accuracy >= 35) starsCount = 1;

      starsElements.forEach((star, idx) => {
        star.classList.toggle('filled', idx < starsCount);
      });

      // Feedback flutuante
      if (data.hitType) {
        let msg = 'NO RITMO! ✨';
        if (data.hitType === 'perfect') msg = 'PERFEITO! 🔥';
        else if (data.hitType === 'good') msg = 'NO TOM! 🎶';
        else if (data.hitType === 'waver') msg = 'INSTÁVEL 〰️';
        else if (data.hitType === 'offkey') msg = 'FORA DO TOM ⚠️';

        floatingHit.textContent = msg;
        floatingHit.className = `hit-floating-text active ${data.hitType}`;
      } else {
        floatingHit.classList.remove('active');
      }

      // Monitor Visual do Microfone em Tempo Real (Apenas Barrinha VU e Tom Musical)
      if (hudMicMeterFill && data.micVolume !== undefined) {
        const vol = data.micVolume || 0;
        const volPct = Math.min(100, Math.round(vol * 450));
        hudMicMeterFill.style.width = `${volPct}%`;
        if (hudMicVol) hudMicVol.textContent = `${volPct}%`;

        if (hudMicNote) {
          const now = performance.now();
          if (data.micIsSinging && data.micNote) {
            const centsText = data.micNote.cents > 0 ? `+${data.micNote.cents}¢` : `${data.micNote.cents}¢`;
            lastNoteText = `🎵 ${data.micNote.name}${data.micNote.octave} • ${Math.round(data.micNote.freq || data.micPitch || 0)}Hz (${centsText})`;
            lastNoteTime = now;
            hudMicNote.textContent = lastNoteText;
            hudMicNote.style.color = 'var(--cyan-neon)';
          } else if (now - lastNoteTime < 450) {
            // Mantém a última nota por 450ms para visual calmo e sem piscadeiras entre sílabas
            hudMicNote.textContent = lastNoteText;
          } else {
            hudMicNote.textContent = '🎵 Tom: aguardando voz...';
            hudMicNote.style.color = '#64748b';
          }
        }
      }
    };

    // Progresso
    gameEngine.onProgressUpdate = (data) => {
      const percent = Math.min(100, (data.current / data.total) * 100);
      timelineFill.style.setProperty('--progress', `${percent}%`);
      timeCurrent.textContent = formatTime(data.current);
    };

    // Fim da Música (Tela de Resultados)
    gameEngine.onSongEnd = async (stats) => {
      modalRank.textContent = stats.rank;
      modalTitle.textContent = stats.title;
      modalSongInfo.textContent = `${selectedSong.title} • ${selectedSong.artist}`;
      if (modalDifficulty) {
        modalDifficulty.textContent = diffLabels[stats.difficultyId || currentDifficulty] || '🟡 Médio';
      }
      if (modalKey) {
        modalKey.textContent = `🎹 Tom: ${selectedSong.key || 'Detectado'}`;
      }
      modalStars.textContent = '★'.repeat(stats.stars) + '☆'.repeat(5 - stats.stars);
      modalScore.textContent = stats.score;
      modalAccuracy.textContent = `${stats.accuracy}%`;
      modalCombo.textContent = `${stats.maxCombo} notas`;

      // 🏆 Salvar Pontuação no Ranking do Servidor & Local
      const rankingEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        singer: currentSinger || 'Cantor(a)',
        songTitle: selectedSong.title,
        songArtist: selectedSong.artist,
        songId: selectedSong.id,
        score: stats.score,
        accuracy: stats.accuracy,
        maxCombo: stats.maxCombo,
        stars: stats.stars,
        rank: stats.rank,
        difficulty: stats.difficulty || diffNames[currentDifficulty],
        difficultyId: stats.difficultyId || currentDifficulty,
        date: new Date().toISOString()
      };

      try {
        await fetch('/api/rankings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rankingEntry)
        });
      } catch (e) {
        console.warn("Aviso salvando ranking no servidor:", e);
      }

      caliopeRankings.push(rankingEntry);
      caliopeRankings.sort((a, b) => (b.score || 0) - (a.score || 0));
      try {
        localStorage.setItem('caliope_rankings_cache', JSON.stringify(caliopeRankings));
      } catch (_) {}

      // Atualizar crachá de posição no resultado
      const pos = caliopeRankings.findIndex(r => r.id === rankingEntry.id) + 1;
      if (modalRankingPos) {
        const medal = pos === 1 ? '🥇' : (pos === 2 ? '🥈' : (pos === 3 ? '🥉' : '🏆'));
        modalRankingPos.textContent = `${medal} #${pos} no Ranking Geral!`;
      }
      if (modalSingerName) {
        modalSingerName.textContent = rankingEntry.singer;
      }

      resultsModal.classList.add('active');
    };
  }

  // 8. Controles do Palco (Pause, Reiniciar)
  btnPauseSong.addEventListener('click', () => {
    if (!gameEngine || !gameEngine.isPlaying) return;
    const isPaused = gameEngine.togglePause();
    pauseIcon.textContent = isPaused ? '▶' : '⏸';
    pauseText.textContent = isPaused ? 'Continuar' : 'Pausar';
  });

  btnRestartSong.addEventListener('click', () => {
    if (!selectedSong) return;
    startSongWithCountdown(selectedSong);
  });

  btnPlaySong.addEventListener('click', () => {
    stageOverlay.classList.add('hidden');
    if (gameEngine && gameEngine.isPaused) {
      gameEngine.resume();
      pauseIcon.textContent = '⏸';
      pauseText.textContent = 'Pausar';
    } else if (selectedSong) {
      startSongWithCountdown(selectedSong);
    }
  });

  // Resultados
  btnPlayAgain.addEventListener('click', () => {
    resultsModal.classList.remove('active');
    if (selectedSong) startSongWithCountdown(selectedSong);
  });

  btnChooseOther.addEventListener('click', () => {
    resultsModal.classList.remove('active');
    showLobby();
  });

  const btnCloseResultsTop = document.getElementById('btn-close-results-top');
  if (btnCloseResultsTop) {
    btnCloseResultsTop.addEventListener('click', () => {
      resultsModal.classList.remove('active');
      showLobby();
    });
  }

  if (btnViewRanking) {
    btnViewRanking.addEventListener('click', () => {
      resultsModal.classList.remove('active');
      showRanking();
    });
  }

  // 9. Modal de Ajustes de Áudio & Microfone
  btnOpenSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
  });

  const btnCloseSettingsTop = document.getElementById('btn-close-settings-top');
  if (btnCloseSettingsTop) {
    btnCloseSettingsTop.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  // Fechar modais ao clicar no fundo escuro (backdrop)
  [settingsModal, importModal, prestartModal, resultsModal].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        if (modal === prestartModal) pendingSong = null;
        if (modal === resultsModal) showLobby();
      }
    });
  });

  // Sincronização e Controle de Ajustes de Microfone / Anti-Vazamento
  function syncAudioSettingsUI() {
    if (!modalBtnToggleEcho || !modalQuickGate) return;
    const isSpeakerMode = !!detector.speakerRejectionMode;
    const val = Math.round(detector.noiseThreshold * 1000);

    modalEchoIcon.textContent = isSpeakerMode ? '🔊' : '🎧';
    modalEchoText.textContent = isSpeakerMode ? 'Modo Caixas (Anti-Vazamento)' : 'Modo Fone de Ouvido';
    modalBtnToggleEcho.classList.toggle('btn-primary', isSpeakerMode);
    modalBtnToggleEcho.classList.toggle('btn-secondary', !isSpeakerMode);

    // Normalização Automática de Volume
    const isNorm = sequencer ? sequencer.isNormalizationEnabled : (localStorage.getItem('caliope_normalize_audio') !== 'false');
    if (modalNormIcon && modalNormText && modalBtnToggleNormalize) {
      modalNormIcon.textContent = isNorm ? '🎚️' : '🔈';
      modalNormText.textContent = isNorm ? 'Normalização Ativa' : 'Volume Original';
      modalBtnToggleNormalize.classList.toggle('btn-primary', isNorm);
      modalBtnToggleNormalize.classList.toggle('btn-secondary', !isNorm);
    }

    modalQuickGate.value = val;
    let label = 'Médio';
    if (val < 28) label = 'Sensível';
    else if (val <= 48) label = 'Médio';
    else label = 'Alto (Anti-Vazamento)';
    modalGateValText.textContent = `${label} (${val})`;
  }

  // Inicializar UI de configurações
  syncAudioSettingsUI();

  // Modo Caixas de Som (Anti-Vazamento inteligente sem mutar microfone)
  modalBtnToggleEcho.addEventListener('click', () => {
    detector.setSpeakerMode(!detector.speakerRejectionMode);
    syncAudioSettingsUI();
  });

  // Normalização Automática de Volume (Nivelamento inteligente sem mexer nos arquivos)
  if (modalBtnToggleNormalize) {
    modalBtnToggleNormalize.addEventListener('click', () => {
      const current = sequencer ? sequencer.isNormalizationEnabled : (localStorage.getItem('caliope_normalize_audio') !== 'false');
      const next = !current;
      if (sequencer) {
        sequencer.setNormalization(next);
      } else {
        localStorage.setItem('caliope_normalize_audio', next ? 'true' : 'false');
      }
      syncAudioSettingsUI();
    });
  }

  // Corte de Ruído Manual (Noise Gate)
  modalQuickGate.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    detector.setNoiseThreshold(val / 1000);
    syncAudioSettingsUI();
  });

  // Botão 🎯 Auto-Calibrar com o Som da Sala
  if (btnAutoCalibrateGate) {
    btnAutoCalibrateGate.addEventListener('click', async () => {
      btnAutoCalibrateGate.disabled = true;
      btnAutoCalibrateGate.textContent = '🎧 Ouvindo a sala...';

      if (!detector.isListening) {
        await detector.init();
      }

      const res = await detector.calibrateAmbient(25, 45);
      btnAutoCalibrateGate.disabled = false;
      if (res) {
        syncAudioSettingsUI();
        btnAutoCalibrateGate.textContent = `✅ Calibrado (${Math.round(res.newThreshold * 1000)})`;
        setTimeout(() => {
          btnAutoCalibrateGate.textContent = '🎯 Auto-Calibrar com a Sala';
        }, 2500);
      } else {
        btnAutoCalibrateGate.textContent = '⚠️ Falha ao calibrar';
        setTimeout(() => {
          btnAutoCalibrateGate.textContent = '🎯 Auto-Calibrar com a Sala';
        }, 2000);
      }
    });
  }

  // Limpar Cache
  modalBtnClearCache.addEventListener('click', () => {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.pathname + '?nocache=' + Date.now();
  });

  // Medidor contínuo de volume para o modal de ajustes
  setInterval(() => {
    if (settingsModal.classList.contains('active') && detector.isListening) {
      const data = detector.getAudioData();
      const pct = Math.min(100, Math.round(data.volume * 500));
      if (modalMicMeterFill) modalMicMeterFill.style.width = `${pct}%`;
      if (modalVolNum) modalVolNum.textContent = `${pct}%`;
    }
  }, 60);

  function updateServerModeUI(hasServer) {
    if (!hasServer || isStaticHosting) {
      isStaticHosting = true;
      if (btnOpenImport) {
        btnOpenImport.disabled = true;
        btnOpenImport.classList.add('disabled');
        btnOpenImport.title = 'A importação de novos vídeos do YouTube requer o Caliope rodando com o servidor Python no computador.';
      }
      if (btnImportLabel) btnImportLabel.innerHTML = '<span class="hide-mobile">+ Adicionar (Servidor)</span><span class="show-mobile">+ Vídeo</span>';
      if (btnImportIcon) btnImportIcon.textContent = '🔒';
    } else {
      isStaticHosting = false;
      if (btnOpenImport) {
        btnOpenImport.disabled = false;
        btnOpenImport.classList.remove('disabled');
        btnOpenImport.title = 'Adicionar novo vídeo de Karaokê do YouTube';
      }
      if (btnImportLabel) btnImportLabel.innerHTML = '<span class="hide-mobile">+ Adicionar do YouTube</span><span class="show-mobile">+ Vídeo</span>';
      if (btnImportIcon) btnImportIcon.textContent = '✨';
    }
  }

  // 10. Modal de Importação do YouTube
  btnOpenImport.addEventListener('click', () => {
    if (isStaticHosting) {
      alert("🔒 Modo Catálogo Oficial Online\n\nA importação de novos vídeos do YouTube requer o Caliope rodando com o servidor Python no computador.\n\nNo GitHub Pages, você tem acesso imediato a todas as 40 músicas do catálogo oficial!");
      return;
    }
    importModal.classList.add('active');
  });

  const btnCloseImportTop = document.getElementById('btn-close-import-top');
  if (btnCloseImportTop) {
    btnCloseImportTop.addEventListener('click', () => {
      importModal.classList.remove('active');
    });
  }

  btnCloseImport.addEventListener('click', () => {
    importModal.classList.remove('active');
  });

  importForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = ytUrlInput.value.trim();
    if (!url) return;

    btnStartImport.disabled = true;
    btnStartImport.textContent = 'Processando...';
    importProgressWrap.style.display = 'flex';
    importBarFill.style.width = '10%';
    importStatusText.textContent = 'Enviando link para o servidor...';

    resetSteps();
    stepDl.classList.add('active');

    try {
      const res = await fetch('/api/import-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) throw new Error(`Erro no servidor (${res.status})`);
      const { job_id } = await res.json();
      pollJobStatus(job_id);
    } catch (err) {
      console.error(err);
      importStatusText.textContent = `❌ Erro: ${err.message}`;
      btnStartImport.disabled = false;
      btnStartImport.textContent = 'Tentar Novamente';
    }
  });

  function resetSteps() {
    [stepDl, stepSep, stepLyr].forEach(s => s.className = 'step-pill');
  }

  function pollJobStatus(jobId) {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;

        const job = await res.json();
        importBarFill.style.width = `${job.progress}%`;
        importStatusText.textContent = job.message || 'Processando...';

        if (job.status === 'downloading') {
          stepDl.classList.add('active');
        } else if (job.status === 'separating') {
          stepDl.className = 'step-pill done';
          stepSep.classList.add('active');
        } else if (job.status === 'finalizing' || job.status === 'done') {
          stepDl.className = 'step-pill done';
          stepSep.className = 'step-pill done';
          stepLyr.classList.add('active');
        }

        if (job.status === 'done') {
          clearInterval(timer);
          stepLyr.className = 'step-pill done';
          importBarFill.style.width = '100%';
          importStatusText.textContent = '🎉 Sucesso! Preparando música...';

          setTimeout(() => {
            const newSong = job.song;
            if (newSong) {
              const idx = window.SONGS_CATALOG.findIndex(s => s.id === newSong.id);
              if (idx !== -1) window.SONGS_CATALOG[idx] = newSong;
              else window.SONGS_CATALOG.unshift(newSong);

              renderLobbySongs();
              importModal.classList.remove('active');
              btnStartImport.disabled = false;
              btnStartImport.textContent = 'Iniciar Processamento';
              ytUrlInput.value = '';
              importProgressWrap.style.display = 'none';

              // Abre o seletor de dificuldade para começar!
              openDifficultyModal(newSong);
            }
          }, 1200);
        } else if (job.status === 'error') {
          clearInterval(timer);
          importStatusText.textContent = `❌ Erro: ${job.error || 'Falha no processamento'}`;
          btnStartImport.disabled = false;
          btnStartImport.textContent = 'Tentar Novamente';
        }
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  }

  // 10.1 Alternar Tela Cheia (Fullscreen API Cross-Browser)
  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function toggleFullscreen() {
    const docEl = document.documentElement;
    if (!isFullscreen()) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch((err) => console.warn('Aviso fullscreen:', err));
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => console.warn('Aviso exit fullscreen:', err));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  function updateFullscreenUI() {
    const active = isFullscreen();
    if (fullscreenIcon) {
      fullscreenIcon.textContent = active ? '🗗' : '⛶';
    }
    if (fullscreenLabel) {
      fullscreenLabel.innerHTML = active
        ? '<span class="hide-mobile">Sair da Tela Cheia</span><span class="show-mobile">Sair Cheia</span>'
        : '<span class="hide-mobile">Tela Cheia</span><span class="show-mobile">Tela Cheia</span>';
    }
    if (btnToggleFullscreen) {
      btnToggleFullscreen.title = active ? 'Sair da Tela Cheia (Esc ou F)' : 'Alternar Tela Cheia (F ou F11)';
      if (active) {
        btnToggleFullscreen.classList.add('fullscreen-active');
      } else {
        btnToggleFullscreen.classList.remove('fullscreen-active');
      }
    }
  }

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', toggleFullscreen);
  }

  document.addEventListener('fullscreenchange', updateFullscreenUI);
  document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
  document.addEventListener('mozfullscreenchange', updateFullscreenUI);
  document.addEventListener('MSFullscreenChange', updateFullscreenUI);

  // 11. Carregar Músicas Salvas do Servidor
  async function loadImportedSongs() {
    if (isStaticHosting) {
      updateServerModeUI(false);
      renderLobbySongs();
      return;
    }

    try {
      const res = await fetch(`/api/songs?_t=${Date.now()}`);
      if (res.ok) {
        updateServerModeUI(true);
        const importedSongs = await res.json();
        importedSongs.forEach(imp => {
          const idx = window.SONGS_CATALOG.findIndex(s => s.id === imp.id);
          if (idx !== -1) {
            window.SONGS_CATALOG[idx] = imp;
          } else {
            window.SONGS_CATALOG.push(imp);
          }
        });
        renderLobbySongs();
      } else {
        updateServerModeUI(false);
        renderLobbySongs();
      }
    } catch (e) {
      console.warn("Aviso carregando músicas importadas:", e);
      updateServerModeUI(false);
      renderLobbySongs();
    }
  }

  // 12. Atalhos de Teclado
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (viewStage.style.display !== 'none' && gameEngine && gameEngine.isPlaying) {
        const isPaused = gameEngine.togglePause();
        pauseIcon.textContent = isPaused ? '▶' : '⏸';
        pauseText.textContent = isPaused ? 'Continuar' : 'Pausar';
      }
    } else if (e.code === 'KeyR') {
      if (viewStage.style.display !== 'none' && selectedSong) {
        startSongWithCountdown(selectedSong);
      }
    } else if (e.code === 'KeyF' || e.code === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.code === 'Escape') {
      if (prestartModal && prestartModal.classList.contains('active')) {
        prestartModal.classList.remove('active');
        pendingSong = null;
      } else if (settingsModal.classList.contains('active')) {
        settingsModal.classList.remove('active');
      } else if (importModal.classList.contains('active')) {
        importModal.classList.remove('active');
      } else if (resultsModal.classList.contains('active')) {
        resultsModal.classList.remove('active');
        showLobby();
      } else if (viewStage.style.display !== 'none') {
        showLobby();
      }
    }
  });

  // 13. Sistema de Ranking Geral & Leaderboard
  async function loadAndRenderRankings() {
    try {
      let res = await fetch(`/api/rankings?_t=${Date.now()}`);
      if (!res.ok) {
        res = await fetch(`rankings.json?_t=${Date.now()}`);
      }
      if (res && res.ok) {
        caliopeRankings = await res.json();
      }
    } catch (e) {
      const cached = localStorage.getItem('caliope_rankings_cache');
      if (cached) {
        try { caliopeRankings = JSON.parse(cached); } catch(_) {}
      }
    }

    if (!caliopeRankings || caliopeRankings.length === 0) {
      caliopeRankings = [...DEFAULT_RANKINGS];
      try {
        localStorage.setItem('caliope_rankings_cache', JSON.stringify(caliopeRankings));
      } catch (_) {}
    }

    renderRankingsUI();
  }

  function renderRankingsUI() {
    if (!rankingTableBody || !podiumGrid) return;

    // Filtros
    const searchFilter = (rankingSearch ? rankingSearch.value : '').toLowerCase().trim();
    let filtered = caliopeRankings.filter(r => {
      if (currentRankingDiff !== 'all' && r.difficultyId !== currentRankingDiff) {
        return false;
      }
      if (searchFilter) {
        const singer = (r.singer || '').toLowerCase();
        const song = (r.songTitle || '').toLowerCase();
        const artist = (r.songArtist || '').toLowerCase();
        return singer.includes(searchFilter) || song.includes(searchFilter) || artist.includes(searchFilter);
      }
      return true;
    });

    // Ordenar por maior pontuação
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

    if (filtered.length === 0) {
      podiumGrid.style.display = 'none';
      if (rankingEmptyState) rankingEmptyState.style.display = 'flex';
      rankingTableBody.innerHTML = '';
      return;
    }

    if (rankingEmptyState) rankingEmptyState.style.display = 'none';

    // 1. Renderizar Pódio Top 3
    podiumGrid.style.display = 'grid';
    podiumGrid.innerHTML = '';

    const top3 = filtered.slice(0, 3);
    const podiumStyles = [
      { class: 'gold', medal: '🥇', label: '1º LUGAR' },
      { class: 'silver', medal: '🥈', label: '2º LUGAR' },
      { class: 'bronze', medal: '🥉', label: '3º LUGAR' }
    ];

    top3.forEach((item, idx) => {
      const style = podiumStyles[idx];
      const card = document.createElement('div');
      card.className = `podium-card ${style.class}`;
      card.innerHTML = `
        <div class="podium-badge">${style.medal}</div>
        <h3 class="podium-singer" title="${item.singer}">${item.singer}</h3>
        <p class="podium-song" title="${item.songTitle} • ${item.songArtist}">${item.songTitle} • ${item.songArtist}</p>
        <div class="podium-score">${item.score} pts</div>
        <div class="podium-meta">
          <span class="badge-difficulty">${diffLabels[item.difficultyId] || item.difficulty}</span>
          <span style="color: var(--cyan-neon); font-weight: 700;">★ ${item.stars || 5}</span>
          <span style="font-family: var(--font-mono); font-weight: 700;">${item.accuracy || 100}%</span>
        </div>
      `;
      podiumGrid.appendChild(card);
    });

    // 2. Renderizar Tabela Completa
    rankingTableBody.innerHTML = '';
    filtered.forEach((item, index) => {
      const tr = document.createElement('tr');
      const pos = index + 1;
      let posClass = '';
      if (pos === 1) posClass = 'top-1';
      else if (pos === 2) posClass = 'top-2';
      else if (pos === 3) posClass = 'top-3';

      const starsDisplay = '★'.repeat(item.stars || 1) + '☆'.repeat(5 - (item.stars || 1));

      tr.innerHTML = `
        <td><span class="rank-pos-pill ${posClass}">${pos}º</span></td>
        <td class="rank-singer-cell">🎤 ${item.singer}</td>
        <td class="rank-song-cell">
          <span class="rank-song-title">${item.songTitle}</span>
          <span class="rank-song-artist">${item.songArtist}</span>
        </td>
        <td><span class="badge-difficulty">${diffLabels[item.difficultyId] || item.difficulty}</span></td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${item.accuracy}%</td>
        <td style="color: #fbbf24; letter-spacing: 2px;">${starsDisplay}</td>
        <td class="rank-score-cell">${item.score}</td>
      `;
      rankingTableBody.appendChild(tr);
    });
  }

  // Filtros de Dificuldade do Ranking
  document.querySelectorAll('.rank-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rank-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRankingDiff = btn.dataset.diff || 'all';
      renderRankingsUI();
    });
  });

  if (rankingSearch) {
    rankingSearch.addEventListener('input', () => {
      renderRankingsUI();
    });
  }

  if (btnClearRanking) {
    btnClearRanking.addEventListener('click', async () => {
      const ok = confirm("Tem certeza que deseja apagar todo o ranking de pontuações?");
      if (!ok) return;

      try {
        await fetch('/api/rankings', { method: 'DELETE' });
      } catch (_) {}

      caliopeRankings = [];
      localStorage.removeItem('caliope_rankings_cache');
      renderRankingsUI();
    });
  }

  if (btnEmptyGoSing) {
    btnEmptyGoSing.addEventListener('click', showLobby);
  }

  // 14. Sistema de Microfone no Celular (WebRTC PeerJS Host)
  function updateRemoteMicDisplay(id) {
    if (roomCodeDisplay) {
      roomCodeDisplay.textContent = id.toUpperCase().replace('CALI-', 'SALA ');
    }

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let micUrl;

    if (isLocalhost) {
      micUrl = `https://erickms11.github.io/caliope/mic.html?room=${id}`;
    } else {
      const currentPath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
      micUrl = `${window.location.origin}${currentPath}/mic.html?room=${id}`;
    }

    if (remoteMicLinkInput) {
      remoteMicLinkInput.value = micUrl;
    }

    if (remoteMicQrcode && typeof QRCode !== 'undefined') {
      try {
        remoteMicQrcode.innerHTML = '';
        new QRCode(remoteMicQrcode, {
          text: micUrl,
          width: 160,
          height: 160,
          colorDark: '#080c16',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.warn("Erro renderizando QRCode:", err);
      }
    }
  }

  function initRemoteMicHost() {
    // Renderiza dados e QR Code imediatamente com a sala atual
    updateRemoteMicDisplay(currentRoomId);

    if (typeof Peer === 'undefined') {
      console.warn("PeerJS não carregado. Microfone remoto desabilitado.");
      return;
    }

    try {
      if (remotePeer) {
        try { remotePeer.destroy(); } catch (_) {}
      }
      remotePeer = new Peer(currentRoomId);

      remotePeer.on('open', (id) => {
        console.log("Servidor PeerJS de Microfone Aberto:", id);
        updateRemoteMicDisplay(id);
      });

      remotePeer.on('connection', (conn) => {
        console.log("📱 Celular conectado ao Videokê via WebRTC!");
        remoteConnection = conn;

        updateRemoteMicUIState(true);

        conn.on('data', (data) => {
          if (!data) return;

          if (data.type === 'mic_data') {
            detector.setRemoteAudioData(data);
            if (data.singerName && data.singerName !== currentSinger) {
              setSingerFromRemote(data.singerName);
            }
          } else if (data.type === 'singer_joined' || data.type === 'singer_update') {
            if (data.singerName) {
              setSingerFromRemote(data.singerName);
            }
          }
        });

        conn.on('close', () => {
          console.warn("Celular desconectado.");
          remoteConnection = null;
          detector.setRemoteAudioData(null);
          updateRemoteMicUIState(false);
        });

        conn.on('error', (e) => {
          console.error("Erro WebRTC remoto:", e);
          remoteConnection = null;
          detector.setRemoteAudioData(null);
          updateRemoteMicUIState(false);
        });
      });

      remotePeer.on('error', (err) => {
        console.warn("Aviso PeerJS Host:", err);
        if (err && err.type === 'unavailable-id') {
          currentRoomId = 'cali-' + Math.floor(1000 + Math.random() * 9000);
          setTimeout(initRemoteMicHost, 400);
        }
      });
    } catch (e) {
      console.warn("Falha iniciando PeerJS Host:", e);
    }
  }

  function setSingerFromRemote(name) {
    currentSinger = name;
    localStorage.setItem('caliope_singer_name', name);
    if (connectedSingerName) connectedSingerName.textContent = name;
    if (singerNameInput) singerNameInput.value = name;
    if (hudRemoteText) hudRemoteText.textContent = `📱 ${name}`;
  }

  function updateRemoteMicUIState(connected) {
    if (connected) {
      if (remoteStatusDot) remoteStatusDot.className = 'status-indicator-dot connected';
      if (remoteMicStatusText) remoteMicStatusText.textContent = '✅ Celular Conectado! Cante à vontade!';
      if (connectedSingerCard) connectedSingerCard.style.display = 'flex';
      if (btnOpenRemoteMic) btnOpenRemoteMic.classList.add('connected');
      if (remoteMicHeaderLabel) remoteMicHeaderLabel.textContent = '📱 Celular Ativo';
      if (hudRemoteBadge) hudRemoteBadge.classList.add('connected');
      if (hudRemoteText) hudRemoteText.textContent = currentSinger ? `📱 ${currentSinger}` : '📱 Celular Ativo';
    } else {
      if (remoteStatusDot) remoteStatusDot.className = 'status-indicator-dot pulse';
      if (remoteMicStatusText) remoteMicStatusText.textContent = 'Aguardando celular conectar...';
      if (connectedSingerCard) connectedSingerCard.style.display = 'none';
      if (btnOpenRemoteMic) btnOpenRemoteMic.classList.remove('connected');
      if (remoteMicHeaderLabel) remoteMicHeaderLabel.textContent = 'Microfone no Celular';
      if (hudRemoteBadge) hudRemoteBadge.classList.remove('connected');
      if (hudRemoteText) hudRemoteText.textContent = '📱 Conectar Celular';
    }
  }

  // Abertura e Fechamento do Modal de Microfone Remoto
  if (btnOpenRemoteMic) {
    btnOpenRemoteMic.addEventListener('click', () => {
      updateRemoteMicDisplay(currentRoomId);
      if (modalRemoteMic) modalRemoteMic.classList.add('active');
    });
  }

  if (hudRemoteBadge) {
    hudRemoteBadge.addEventListener('click', () => {
      updateRemoteMicDisplay(currentRoomId);
      if (modalRemoteMic) modalRemoteMic.classList.add('active');
    });
  }

  const btnCloseRemoteMicTop = document.getElementById('btn-close-remote-mic-top');
  if (btnCloseRemoteMicTop) {
    btnCloseRemoteMicTop.addEventListener('click', () => {
      if (modalRemoteMic) modalRemoteMic.classList.remove('active');
    });
  }

  if (btnCloseRemoteMic) {
    btnCloseRemoteMic.addEventListener('click', () => {
      if (modalRemoteMic) modalRemoteMic.classList.remove('active');
    });
  }

  if (modalRemoteMic) {
    modalRemoteMic.addEventListener('click', (e) => {
      if (e.target === modalRemoteMic) {
        modalRemoteMic.classList.remove('active');
      }
    });
  }

  if (btnCopyMicLink) {
    btnCopyMicLink.addEventListener('click', () => {
      if (remoteMicLinkInput && remoteMicLinkInput.value) {
        navigator.clipboard.writeText(remoteMicLinkInput.value).then(() => {
          btnCopyMicLink.textContent = 'Copiado! ✅';
          setTimeout(() => { btnCopyMicLink.textContent = 'Copiar Link'; }, 2000);
        });
      }
    });
  }

  // Inicialização no Lobby e Configurações
  updateDifficultyUI(currentDifficulty);
  loadImportedSongs();
  loadAndRenderRankings();
  renderLobbySongs();
  initRemoteMicHost();
});
