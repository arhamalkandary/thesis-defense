const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('webcam');

const hpBar = document.getElementById('hp-bar');
const scoreDisplay = document.getElementById('score-display');
const bossStatus = document.getElementById('boss-status');
const uiOverlay = document.getElementById('ui-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const btnAction = document.getElementById('btn-action');
const btnToggleCam = document.getElementById('btn-toggle-cam');

// Konfigurasi Layar
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Status Game
let gameState = "MENU"; // MENU, PLAYING, GAMEOVER
let score = 0;
let mentalHealth = 100;
let lastSpawnTime = 0;
let spawnInterval = 1400; // ms

// Posisi Perisai Pemain (Dikontrol Tangan)
const playerShield = {
  x: canvas.width / 2,
  y: canvas.height - 90,
  width: 160,
  height: 22,
  targetX: canvas.width / 2
};

// Array Objek Game
let projectiles = [];
let particles = [];
let floatTexts = [];

// Jenis Proyektil Ujian Dosen
const ITEM_TYPES = [
  { text: "Revisi Bab 2!", type: "DAMAGE", color: "#ff3366", speed: 4.2, hp: -15, points: 10 },
  { text: "Mana Dalil Mazhab?", type: "FAST", color: "#ffcc00", speed: 6.2, hp: -25, points: 20 },
  { text: "Margin Belum 4-4-3-3", type: "DAMAGE", color: "#ff8844", speed: 3.5, hp: -10, points: 10 },
  { text: "Typo di Abstrak!", type: "DAMAGE", color: "#ff55aa", speed: 4.5, hp: -12, points: 15 },
  { text: "☕ Kopi Dosen Penguji", type: "HEAL", color: "#00ff88", speed: 3.2, hp: 20, points: 25 }
];

// ------------------------------------------------------------------
// Web Audio API Synthesizer (Retro Arcade SFX)
// ------------------------------------------------------------------
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playRetroSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  if (type === "DEFLECT") {
    // Bunyi tangkisan perisai berdentang (laser ping)
    osc.type = "square";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } else if (type === "HEAL") {
    // Chime manis kena kopi
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } else if (type === "HURT") {
    // Suara Mental Health Berkurang (buzz)
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.25);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } else if (type === "GAMEOVER") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.7);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.7);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }
}

// ------------------------------------------------------------------
// Efek Visual: Partikel & Teks Pantulan
// ------------------------------------------------------------------
function spawnParticles(x, y, color) {
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      color: color,
      size: Math.random() * 4 + 2
    });
  }
}

function spawnFloatText(text, x, y, color) {
  floatTexts.push({
    text, x, y,
    alpha: 1,
    color,
    vy: -2
  });
}

// ------------------------------------------------------------------
// Spawn & Update Proyektil
// ------------------------------------------------------------------
function spawnProjectile() {
  const template = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const width = ctx.measureText(template.text).width + 36;
  const x = Math.random() * (canvas.width - width - 40) + 20;

  projectiles.push({
    ...template,
    x,
    y: 70,
    width: Math.max(width, 140),
    height: 32
  });
}

function updateGameLogic() {
  const now = performance.now();

  // Kemunculan Proyektil Bertahap
  if (now - lastSpawnTime > spawnInterval) {
    spawnProjectile();
    lastSpawnTime = now;
    // Semakin tinggi skor, semakin cepat ujian datang
    spawnInterval = Math.max(650, 1400 - score * 8);
  }

  // Update Status Dosen berdasarkan Skor
  if (score < 80) bossStatus.innerText = "Dosen Penguji: Menelusuri Bab 1...";
  else if (score < 180) bossStatus.innerText = "Dosen Penguji: Membedah Landasan Teori! 🔥";
  else if (score < 300) bossStatus.innerText = "Dosen Penguji: Mencecar Metode & Dalil! ⚡";
  else bossStatus.innerText = "Dosen Penguji: Menyerah! Siap Lulus! 🎓";

  // Gerakkan Perisai mengikuti Tangan secara Halus (Smooth Lerp)
  playerShield.x += (playerShield.targetX - playerShield.x) * 0.22;
  playerShield.y = canvas.height - 90;

  // Batasi agar tidak tembus dinding
  playerShield.x = Math.max(playerShield.width / 2, Math.min(canvas.width - playerShield.width / 2, playerShield.x));

  // Loop Pergerakan Proyektil
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.y += p.speed;

    // Deteksi Tabrakan dengan Perisai Pemain
    const shieldLeft = playerShield.x - playerShield.width / 2;
    const shieldRight = playerShield.x + playerShield.width / 2;
    const shieldTop = playerShield.y - playerShield.height / 2;
    const shieldBottom = playerShield.y + playerShield.height / 2;

    if (
      p.y + p.height >= shieldTop &&
      p.y <= shieldBottom &&
      p.x + p.width >= shieldLeft &&
      p.x <= shieldRight
    ) {
      // TABRAKAN BERHASIL!
      if (p.type === "HEAL") {
        mentalHealth = Math.min(100, mentalHealth + p.hp);
        playRetroSound("HEAL");
        spawnFloatText("+20 HP KOPI!", p.x, p.y, "#00ff88");
      } else {
        score += p.points;
        playRetroSound("DEFLECT");
        const shouts = ["DALIL KUAT!", "TERBANTAHKAN!", "REVISI HILANG!", "AMAN!"];
        const randomShout = shouts[Math.floor(Math.random() * shouts.length)];
        spawnFloatText(randomShout, p.x, p.y, "#00f0ff");
      }

      spawnParticles(p.x + p.width / 2, p.y + p.height / 2, p.color);
      scoreDisplay.innerText = score;
      hpBar.style.width = `${mentalHealth}%`;
      projectiles.splice(i, 1);
      continue;
    }

    // Jika Proyektil Lewat Bawah Layar (Gagal Ditangkis)
    if (p.y > canvas.height) {
      if (p.type !== "HEAL") {
        mentalHealth = Math.max(0, mentalHealth + p.hp);
        hpBar.style.width = `${mentalHealth}%`;
        playRetroSound("HURT");
        spawnFloatText(`${p.hp} MENTAL!`, p.x, canvas.height - 50, "#ff3366");

        // Flash layar merah
        ctx.fillStyle = "rgba(255, 0, 60, 0.25)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (mentalHealth <= 0) {
          triggerGameOver();
          return;
        }
      }
      projectiles.splice(i, 1);
    }
  }

  // Update Partikel
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.alpha -= 0.035;
    if (pt.alpha <= 0) particles.splice(i, 1);
  }

  // Update Teks Mengambang
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const ft = floatTexts[i];
    ft.y += ft.vy;
    ft.alpha -= 0.025;
    if (ft.alpha <= 0) floatTexts.splice(i, 1);
  }
}

// ------------------------------------------------------------------
// Render Grafis Game
// ------------------------------------------------------------------
function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Garis Grid Latar Cyber
  ctx.save();
  ctx.strokeStyle = "rgba(25, 35, 60, 0.4)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  ctx.restore();

  // Gambar Perisai Mahasiswa
  ctx.save();
  const sx = playerShield.x - playerShield.width / 2;
  const sy = playerShield.y - playerShield.height / 2;

  // Glow Perisai
  ctx.shadowColor = "#00f0ff";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#00f0ff";
  ctx.fillRect(sx, sy, playerShield.width, playerShield.height);

  // Core Perisai
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(sx + 4, sy + 4, playerShield.width - 8, playerShield.height - 8);

  ctx.fillStyle = "#0d0f18";
  ctx.font = "bold 11px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText("PERISAI MAHASISWA", playerShield.x, playerShield.y + 4);
  ctx.restore();

  // Gambar Proyektil Ujian
  ctx.font = "bold 13px Consolas, monospace";
  for (const p of projectiles) {
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(20, 24, 38, 0.9)";
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.8;

    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.strokeRect(p.x, p.y, p.width, p.height);

    ctx.fillStyle = p.color;
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x + p.width / 2, p.y + 20);
    ctx.restore();
  }

  // Gambar Partikel
  for (const pt of particles) {
    ctx.save();
    ctx.globalAlpha = pt.alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Gambar Teks Mengambang
  for (const ft of floatTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.font = "bold 14px Consolas, monospace";
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function gameLoop() {
  if (gameState === "PLAYING") {
    updateGameLogic();
    renderGame();
  }
  requestAnimationFrame(gameLoop);
}

// ------------------------------------------------------------------
// State Game Over & Start
// ------------------------------------------------------------------
function triggerGameOver() {
  gameState = "GAMEOVER";
  playRetroSound("GAMEOVER");

  overlayTitle.innerText = "MENTAL HEALTH JEBOL!";
  overlayTitle.style.color = "#ff3366";
  overlayDesc.innerHTML = `Proposal skripsimu dihujani revisi!<br><br><strong>Total Revisi Ditangkis: ${score}</strong><br>Status: Disuruh Konsultasi Ulang ke Ruang Dosen.`;
  btnAction.innerText = "COBA SIDANG LAGI";
  uiOverlay.style.display = "flex";
}

function startGame() {
  score = 0;
  mentalHealth = 100;
  projectiles = [];
  particles = [];
  floatTexts = [];
  scoreDisplay.innerText = "0";
  hpBar.style.width = "100%";
  gameState = "PLAYING";
  uiOverlay.style.display = "none";
}

// ------------------------------------------------------------------
// Pelacakan Tangan (MediaPipe Hands)
// ------------------------------------------------------------------
let currentFacingMode = "user"; // default selfie laptop
let currentStream = null;

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.65,
  minTrackingConfidence: 0.65
});

hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const lm = results.multiHandLandmarks[0];
    const isFront = (currentFacingMode === "user");

    // Dapatkan koordinat X telapak tangan
    let handX = lm[9].x;
    if (isFront) handX = 1.0 - handX; // mirror agar sinkron

    playerShield.targetX = handX * canvas.width;
  }
});

async function startCamera() {
  if (currentStream) currentStream.getTracks().forEach(t => t.stop());

  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    await video.play();

    video.style.transform = (currentFacingMode === "user") ? "scaleX(-1)" : "scaleX(1)";

    const cameraHelper = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 320,
      height: 240
    });
    cameraHelper.start();
  } catch (err) {
    alert("Izin kamera gagal: " + err.message);
  }
}

btnToggleCam.addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
  startCamera();
});

btnAction.addEventListener('click', () => {
  initAudio();
  if (!currentStream) {
    startCamera();
    gameLoop();
  }
  startGame();
});