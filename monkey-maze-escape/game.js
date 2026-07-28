(() => {
  "use strict";

  // # wall  . floor  P player  M monkey  G gem  D door  E exit  T torch
  // Validated topology: every gem reachable before the gate; exit only after gate opens.
  const RAW_LEVEL = [
    "#########################",
    "#.#.....G...........M...#",
    "#.#..####.###.###.#.###.#",
    "#.#.#.....#.#...#...#...#",
    "#.###.#####.##..#.#....##",
    "#...#.#...#.....#.#.#...#",
    "###.#...#.#.#.#.#.#.###.#",
    "#.#...#.#...#...#.#.#...#",
    "#G#####.#...#######.#.###",
    "#...G...#T#...#ED.#.T...#",
    "###.#G###.#######...###.#",
    "#...#...........#.#...#.#",
    "#.###.###########G###.#.#",
    "#...#...#.......#T#...#.#",
    "#..T#.##..#####.#..#.##.#",
    "#.#.#.#...#...#.#.....#.#",
    "#.#.###..####.#.#####.#P#",
    "#.#.......G...#.........#",
    "#########################",
  ];

  const TILE = 16;
  const COLS = RAW_LEVEL[0].length;
  const ROWS = RAW_LEVEL.length;
  const VIEW = 3; // pixel scale

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("title");
  const subtitleEl = document.getElementById("subtitle");
  const eyebrowEl = document.getElementById("eyebrow");
  const objectiveEl = document.getElementById("objective");
  const gemPipsEl = document.getElementById("gemPips");
  const threatBar = document.getElementById("threatBar");
  const tickerEl = document.getElementById("ticker");
  const startBtn = document.getElementById("startBtn");

  canvas.width = COLS * TILE * VIEW;
  canvas.height = ROWS * TILE * VIEW;
  ctx.imageSmoothingEnabled = false;

  const keys = new Set();
  let state = "title";
  let grid;
  let player;
  let monkey;
  let gems = [];
  let doors = [];
  let torches = [];
  let exit;
  let gemsNeeded = 0;
  let doorsOpen = false;
  let particles = [];
  let floats = [];
  let anim = 0;
  let shake = 0;
  let hitstop = 0;
  let pathCache = [];
  let pathAge = 0;
  let audioCtx = null;
  let lastMoveDir = { x: 0, y: 1 };
  let inputBuffer = null;
  let inputBufferT = 0;
  let doorBumpCool = 0;

  const C = {
    wall: "#2a3d34",
    wallHi: "#4d6b58",
    wallLo: "#16221c",
    floorA: "#1a2230",
    floorB: "#151c28",
    floorEdge: "#0f141c",
    gem: "#3de7c3",
    gemCore: "#d9fff5",
    door: "#8a4f24",
    doorBand: "#ff5d6c",
    doorOpen: "#3f6d4e",
    exit: "#f0b429",
    exitCore: "#ffe29a",
    player: "#6ecbff",
    playerHi: "#d7f3ff",
    monkey: "#c47a3a",
    monkeyDk: "#6e3a16",
    monkeyFace: "#f2c9a0",
    torch: "#ff9f43",
    ink: "#0a0e14",
  };

  function assertConnectedLevel() {
    let sx = 0;
    let sy = 0;
    let ex = 0;
    let ey = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = RAW_LEVEL[y][x];
        if (ch === "P") {
          sx = x;
          sy = y;
        }
        if (ch === "E") {
          ex = x;
          ey = y;
        }
      }
    }

    function flood(blockDoors) {
      const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
      const q = [[sx, sy]];
      seen[sy][sx] = true;
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || seen[ny][nx]) continue;
          const ch = RAW_LEVEL[ny][nx];
          if (ch === "#") continue;
          if (blockDoors && ch === "D") continue;
          seen[ny][nx] = true;
          q.push([nx, ny]);
        }
      }
      return seen;
    }

    const open = flood(false);
    const locked = flood(true);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = RAW_LEVEL[y][x];
        if (ch === "#" || ch === "E" || ch === "D") continue;
        if (!locked[y][x]) {
          throw new Error(`Unreachable before gate at ${x},${y} (${ch})`);
        }
        if (!open[y][x]) {
          throw new Error(`Unreachable after gate at ${x},${y} (${ch})`);
        }
      }
    }

    if (locked[ey][ex]) throw new Error("Exit must stay sealed until gate opens");
    if (!open[ey][ex]) throw new Error("Exit unreachable after gate opens");
  }

  function resetLevel() {
    assertConnectedLevel();
    grid = RAW_LEVEL.map((row) => row.split(""));
    gems = [];
    doors = [];
    torches = [];
    particles = [];
    floats = [];
    doorsOpen = false;
    pathCache = [];
    pathAge = 0;
    hitstop = 0;
    shake = 0;
    inputBuffer = null;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = grid[y][x];
        if (ch === "P") {
          player = {
            x: x + 0.5,
            y: y + 0.5,
            vx: 0,
            vy: 0,
            facing: { x: 1, y: 0 },
            trail: 0,
          };
          grid[y][x] = ".";
        } else if (ch === "M") {
          monkey = {
            x: x + 0.5,
            y: y + 0.5,
            tx: x,
            ty: y,
            windup: 0,
            roar: 0,
          };
          grid[y][x] = ".";
        } else if (ch === "G") {
          gems.push({ x, y, taken: false, phase: Math.random() * Math.PI * 2 });
          grid[y][x] = ".";
        } else if (ch === "D") {
          doors.push({ x, y });
        } else if (ch === "E") {
          exit = { x, y };
          grid[y][x] = ".";
        } else if (ch === "T") {
          torches.push({ x, y, phase: Math.random() * 10 });
          grid[y][x] = ".";
        }
      }
    }

    gemsNeeded = gems.length;
    buildPips();
    setObjective("COLLECT EVERY GEM — GATE OPENS AT FULL CHARGE");
    tickerEl.textContent = "TEMPLE SEALED · HUNT THE GEMS · DO NOT TOUCH THE GUARDIAN";
  }

  function buildPips() {
    gemPipsEl.innerHTML = "";
    for (let i = 0; i < gemsNeeded; i++) {
      const d = document.createElement("div");
      d.className = "pip";
      gemPipsEl.appendChild(d);
    }
  }

  function updatePips() {
    const taken = gems.filter((g) => g.taken).length;
    [...gemPipsEl.children].forEach((el, i) => {
      el.classList.toggle("on", i < taken);
    });
  }

  function setObjective(text) {
    objectiveEl.textContent = text;
  }

  function tileSolid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const ch = grid[ty][tx];
    if (ch === "#") return true;
    if (ch === "D" && !doorsOpen) return true;
    return false;
  }

  function tileIsLockedDoor(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
    return grid[ty][tx] === "D" && !doorsOpen;
  }

  function notifyDoorBump() {
    if (doorBumpCool > 0) return;
    doorBumpCool = 45;
    const taken = gems.filter((g) => g.taken).length;
    floatText(player.x, player.y - 0.6, `${taken}/${gemsNeeded}`, C.doorBand);
    setObjective(`GATE LOCKED — NEED ${gemsNeeded - taken} MORE GEM${gemsNeeded - taken === 1 ? "" : "S"}`);
    tickerEl.textContent = "SEALED GATE · RED BARS MEAN NO PASSAGE · FINISH THE GEM METER";
    sfxBump();
    shake = 3;
  }

  function circleBlocked(cx, cy, r = 0.32) {
    const samples = [
      [cx - r, cy - r],
      [cx + r, cy - r],
      [cx - r, cy + r],
      [cx + r, cy + r],
      [cx, cy - r],
      [cx, cy + r],
      [cx - r, cy],
      [cx + r, cy],
    ];
    return samples.some(([x, y]) => tileSolid(Math.floor(x), Math.floor(y)));
  }

  function tryOpenDoors() {
    const taken = gems.filter((g) => g.taken).length;
    if (doorsOpen || taken < gemsNeeded) return;
    doorsOpen = true;
    for (const d of doors) {
      grid[d.y][d.x] = ".";
      burst(d.x + 0.5, d.y + 0.5, C.exit, 18);
      floatText(d.x + 0.5, d.y, "OPEN", C.exit);
    }
    setObjective("GATE OPEN — SPRINT TO THE EXIT LADDER");
    tickerEl.textContent = "SEAL BROKEN · GUARDIAN ENTERING RAGE STATE";
    sfxDoor();
    shake = 10;
  }

  function collectGems() {
    for (const g of gems) {
      if (g.taken) continue;
      const dx = player.x - (g.x + 0.5);
      const dy = player.y - (g.y + 0.5);
      if (dx * dx + dy * dy < 0.35 * 0.35) {
        g.taken = true;
        burst(g.x + 0.5, g.y + 0.5, C.gem, 14);
        floatText(g.x + 0.5, g.y, "+GEM", C.gem);
        sfxGem();
        updatePips();
        tryOpenDoors();
        const left = gemsNeeded - gems.filter((x) => x.taken).length;
        if (!doorsOpen) setObjective(`${left} GEM${left === 1 ? "" : "S"} REMAINING`);
      }
    }
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.02 + Math.random() * 0.08;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 20 + Math.random() * 18,
        color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, text, color, life: 40 });
  }

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function tone(freq, dur, type = "square", vol = 0.04, delay = 0) {
    try {
      ensureAudio();
      const t0 = audioCtx.currentTime + delay;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (_) {}
  }

  function sfxGem() {
    tone(660, 0.05, "triangle", 0.05);
    tone(990, 0.08, "triangle", 0.04, 0.05);
  }
  function sfxDoor() {
    tone(180, 0.08, "sawtooth", 0.05);
    tone(360, 0.1, "square", 0.04, 0.08);
    tone(540, 0.12, "square", 0.035, 0.16);
  }
  function sfxStep() {
    tone(140 + Math.random() * 30, 0.02, "triangle", 0.02);
  }
  function sfxBump() {
    tone(70, 0.04, "square", 0.03);
  }
  function sfxWin() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, "square", 0.045, i * 0.09));
  }
  function sfxLose() {
    tone(160, 0.16, "sawtooth", 0.05);
    tone(90, 0.22, "sawtooth", 0.05, 0.12);
  }
  function sfxRoar() {
    tone(90, 0.18, "sawtooth", 0.06);
    tone(60, 0.22, "sawtooth", 0.05, 0.1);
  }

  function bfs(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const q = [[sx, sy]];
    const prev = new Map();
    const key = (x, y) => x + "," + y;
    prev.set(key(sx, sy), null);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const k = key(nx, ny);
        if (prev.has(k) || tileSolid(nx, ny)) continue;
        prev.set(k, [x, y]);
        if (nx === tx && ny === ty) {
          const path = [];
          let cur = [tx, ty];
          while (cur) {
            path.push(cur);
            const p = prev.get(key(cur[0], cur[1]));
            cur = p;
          }
          path.reverse();
          return path.slice(1);
        }
        q.push([nx, ny]);
      }
    }
    return [];
  }

  function updatePlayer() {
    if (state !== "play") return;

    let ix = 0;
    let iy = 0;
    if (keys.has("w") || keys.has("arrowup")) iy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) iy += 1;
    if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
    if (keys.has("d") || keys.has("arrowright")) ix += 1;

    if (ix || iy) {
      // prefer latest cardinal if diagonal
      if (ix && iy) {
        if (inputBuffer && inputBufferT > 0) {
          if (inputBuffer.x) iy = 0;
          else ix = 0;
        } else if (Math.abs(player.vx) > Math.abs(player.vy)) iy = 0;
        else ix = 0;
      }
      lastMoveDir = { x: ix, y: iy };
      player.facing = { x: ix, y: iy };
    } else if (inputBuffer && inputBufferT > 0) {
      ix = inputBuffer.x;
      iy = inputBuffer.y;
    }

    const sprint = keys.has("shift");
    const speed = sprint ? 0.095 : 0.07;
    const nx = player.x + ix * speed;
    const ny = player.y + iy * speed;

    let moved = false;
    if (ix && !circleBlocked(nx, player.y)) {
      player.x = nx;
      moved = true;
    } else if (ix) {
      // axis slide assist
      const nudge = 0.08;
      if (!circleBlocked(nx, player.y - nudge)) {
        player.y -= nudge;
        if (!circleBlocked(nx, player.y)) {
          player.x = nx;
          moved = true;
        }
      } else if (!circleBlocked(nx, player.y + nudge)) {
        player.y += nudge;
        if (!circleBlocked(nx, player.y)) {
          player.x = nx;
          moved = true;
        }
      } else {
        const hx = Math.floor(nx);
        const hy = Math.floor(player.y);
        if (tileIsLockedDoor(hx, hy)) notifyDoorBump();
        else if (anim % 10 === 0) sfxBump();
      }
    }

    if (iy && !circleBlocked(player.x, ny)) {
      player.y = ny;
      moved = true;
    } else if (iy) {
      const nudge = 0.08;
      if (!circleBlocked(player.x - nudge, ny)) {
        player.x -= nudge;
        if (!circleBlocked(player.x, ny)) {
          player.y = ny;
          moved = true;
        }
      } else if (!circleBlocked(player.x + nudge, ny)) {
        player.x += nudge;
        if (!circleBlocked(player.x, ny)) {
          player.y = ny;
          moved = true;
        }
      } else {
        const hx = Math.floor(player.x);
        const hy = Math.floor(ny);
        if (tileIsLockedDoor(hx, hy)) notifyDoorBump();
        else if (anim % 10 === 0) sfxBump();
      }
    }

    if (moved) {
      player.trail++;
      if (player.trail % (sprint ? 5 : 8) === 0) {
        sfxStep();
        particles.push({
          x: player.x,
          y: player.y + 0.25,
          vx: (Math.random() - 0.5) * 0.02,
          vy: 0.01,
          life: 12,
          color: "#6a7d93",
          size: 1,
        });
      }
    }

    if (inputBufferT > 0) inputBufferT--;

    collectGems();

    if (doorsOpen) {
      const dx = player.x - (exit.x + 0.5);
      const dy = player.y - (exit.y + 0.5);
      if (dx * dx + dy * dy < 0.4 * 0.4) win();
    }
  }

  function updateMonkey() {
    if (state !== "play") return;

    const taken = gems.filter((g) => g.taken).length;
    const rage = doorsOpen ? 1.35 : 1 + taken * 0.06;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const mx = Math.floor(monkey.x);
    const my = Math.floor(monkey.y);

    pathAge--;
    if (pathAge <= 0 || pathCache.length === 0) {
      pathCache = bfs(mx, my, px, py);
      pathAge = doorsOpen ? 8 : 14;
    }

    // windup telegraph when close
    const dist = Math.hypot(player.x - monkey.x, player.y - monkey.y);
    threatBar.style.width = `${Math.max(0, Math.min(100, (1 - dist / 14) * 100))}%`;

    if (dist < 3.2 && monkey.roar <= 0) {
      monkey.roar = 90;
      monkey.windup = 12;
      sfxRoar();
      shake = 6;
      floatText(monkey.x, monkey.y - 1, "!!", C.doorBand);
    }
    if (monkey.roar > 0) monkey.roar--;
    if (monkey.windup > 0) {
      monkey.windup--;
      return;
    }

    const step = 0.045 * rage;
    if (pathCache.length) {
      const [tx, ty] = pathCache[0];
      const goalX = tx + 0.5;
      const goalY = ty + 0.5;
      const dx = goalX - monkey.x;
      const dy = goalY - monkey.y;
      const len = Math.hypot(dx, dy) || 1;
      monkey.x += (dx / len) * step;
      monkey.y += (dy / len) * step;
      if (Math.hypot(goalX - monkey.x, goalY - monkey.y) < 0.12) {
        monkey.x = goalX;
        monkey.y = goalY;
        pathCache.shift();
      }
    }

    if (dist < 0.72) lose();
  }

  function updateFx() {
    if (doorBumpCool > 0) doorBumpCool--;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.0015;
      p.life--;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const f of floats) {
      f.y -= 0.015;
      f.life--;
    }
    floats = floats.filter((f) => f.life > 0);

    if (shake > 0) shake *= 0.85;
    if (shake < 0.2) shake = 0;
  }

  function objectiveTarget() {
    if (doorsOpen) return { x: exit.x + 0.5, y: exit.y + 0.5, color: C.exit };
    let best = null;
    let bestD = Infinity;
    for (const g of gems) {
      if (g.taken) continue;
      const d = Math.hypot(player.x - (g.x + 0.5), player.y - (g.y + 0.5));
      if (d < bestD) {
        bestD = d;
        best = { x: g.x + 0.5, y: g.y + 0.5, color: C.gem };
      }
    }
    return best;
  }

  function win() {
    state = "win";
    burst(exit.x + 0.5, exit.y + 0.5, C.exit, 28);
    shake = 12;
    sfxWin();
    eyebrowEl.textContent = "RUN COMPLETE";
    titleEl.textContent = "YOU ESCAPED";
    subtitleEl.textContent =
      "Gate sealed behind you. The guardian slams the bars. Temple loot secured.";
    startBtn.textContent = "RUN AGAIN";
    overlay.classList.remove("hidden");
    setObjective("ESCAPED — PERFECT EXTRACTION");
    tickerEl.textContent = "VICTORY · ALL SYSTEMS CLEAR";
  }

  function lose() {
    state = "lose";
    burst(player.x, player.y, C.doorBand, 24);
    shake = 16;
    hitstop = 10;
    sfxLose();
    eyebrowEl.textContent = "RUN FAILED";
    titleEl.textContent = "GUARDIAN CATCH";
    subtitleEl.textContent =
      "You got flattened. Grab every gem, open the glowing gate, then sprint the exit route.";
    startBtn.textContent = "RETRY";
    overlay.classList.remove("hidden");
    setObjective("CAUGHT — RETRY THE RAID");
    tickerEl.textContent = "DEFEAT · STUDY THE ROUTE · USE SPRINT";
  }

  function startGame() {
    ensureAudio();
    resetLevel();
    updatePips();
    state = "play";
    overlay.classList.add("hidden");
    tone(330, 0.05, "square", 0.04);
    tone(440, 0.07, "square", 0.04, 0.06);
  }

  // ---------- DRAW ----------
  function worldToScreen(x, y) {
    return [x * TILE * VIEW, y * TILE * VIEW];
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const ox = shake ? (Math.random() - 0.5) * shake * VIEW : 0;
    const oy = shake ? (Math.random() - 0.5) * shake * VIEW : 0;
    ctx.setTransform(VIEW, 0, 0, VIEW, ox, oy);

    // floor + walls
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = grid[y][x];
        if (ch === "#") drawWall(x, y);
        else {
          drawFloor(x, y);
          if (ch === "D") drawDoor(x, y);
        }
      }
    }

    drawExit();
    for (const t of torches) drawTorch(t);
    for (const g of gems) drawGem(g);

    if (doorsOpen) {
      for (const d of doors) {
        ctx.fillStyle = "rgba(240,180,41,0.18)";
        ctx.fillRect(d.x * TILE, d.y * TILE, TILE, TILE);
      }
    }

    drawPlayer();
    drawMonkey();
    drawNav();

    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life / 16);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * TILE - p.size / 2, p.y * TILE - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }

    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life / 20);
      ctx.fillStyle = f.color;
      ctx.font = "5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x * TILE, f.y * TILE);
      ctx.globalAlpha = 1;
    }

    // scanlines
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let y = 0; y < canvas.height; y += 3) ctx.fillRect(0, y, canvas.width, 1);
  }

  function drawFloor(x, y) {
    const alt = (x + y) % 2 === 0;
    ctx.fillStyle = alt ? C.floorA : C.floorB;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = C.floorEdge;
    ctx.fillRect(x * TILE, y * TILE + TILE - 1, TILE, 1);
  }

  function drawWall(x, y) {
    ctx.fillStyle = C.wall;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.fillStyle = C.wallHi;
    ctx.fillRect(x * TILE, y * TILE, TILE, 3);
    ctx.fillStyle = C.wallLo;
    ctx.fillRect(x * TILE, y * TILE + TILE - 2, TILE, 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x * TILE + 3, y * TILE + 6, 4, 2);
    ctx.fillRect(x * TILE + 9, y * TILE + 10, 4, 2);
  }

  function drawDoor(x, y) {
    ctx.fillStyle = C.door;
    ctx.fillRect(x * TILE + 1, y * TILE, TILE - 2, TILE);
    ctx.fillStyle = C.doorBand;
    ctx.fillRect(x * TILE + 3, y * TILE + 2, TILE - 6, 3);
    ctx.fillRect(x * TILE + 3, y * TILE + TILE - 5, TILE - 6, 3);
    // lock gem meter
    const taken = gems.filter((g) => g.taken).length;
    ctx.fillStyle = C.ink;
    ctx.fillRect(x * TILE + 5, y * TILE + 6, 6, 5);
    ctx.fillStyle = C.gem;
    const h = Math.floor((taken / gemsNeeded) * 5);
    ctx.fillRect(x * TILE + 5, y * TILE + 11 - h, 6, h);
    // blocked stripes so it never looks like a hallway
    ctx.fillStyle = "rgba(255,93,108,0.55)";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x * TILE + 2 + i * 3, y * TILE + 4, 2, TILE - 8);
    }
  }

  function drawExit() {
    const pulse = 0.45 + Math.sin(anim * 0.12) * 0.25;
    ctx.fillStyle = C.exit;
    ctx.fillRect(exit.x * TILE + 2, exit.y * TILE + 1, TILE - 4, TILE - 2);
    ctx.fillStyle = C.exitCore;
    ctx.globalAlpha = doorsOpen ? 0.5 + pulse * 0.5 : 0.15;
    ctx.fillRect(exit.x * TILE + 4, exit.y * TILE + 3, TILE - 8, TILE - 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ink;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(exit.x * TILE + 5, exit.y * TILE + 4 + i * 3, TILE - 10, 2);
    }
    if (!doorsOpen) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(exit.x * TILE + 2, exit.y * TILE + 1, TILE - 4, TILE - 2);
    }
  }

  function drawTorch(t) {
    const flicker = 0.7 + Math.sin(anim * 0.25 + t.phase) * 0.3;
    const px = t.x * TILE + 8;
    const py = t.y * TILE + 6;
    ctx.fillStyle = "#5a3a22";
    ctx.fillRect(px - 1, py, 2, 7);
    ctx.fillStyle = C.torch;
    ctx.globalAlpha = flicker;
    ctx.fillRect(px - 2, py - 3, 4, 4);
    ctx.fillStyle = "#ffe29a";
    ctx.fillRect(px - 1, py - 4, 2, 2);
    ctx.globalAlpha = 1;
    // soft light on floor
    ctx.fillStyle = `rgba(255,159,67,${0.08 * flicker})`;
    ctx.beginPath();
    ctx.arc(px, py + 4, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGem(g) {
    if (g.taken) return;
    const bob = Math.sin(anim * 0.14 + g.phase) * 1.8;
    const px = g.x * TILE + 8;
    const py = g.y * TILE + 8 + bob;
    ctx.fillStyle = "rgba(61,231,195,0.2)";
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.gem;
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px, py + 5);
    ctx.lineTo(px - 5, py);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.gemCore;
    ctx.fillRect(px - 1, py - 2, 2, 2);
  }

  function drawNav() {
    if (state !== "play") return;
    const target = objectiveTarget();
    if (!target) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.2) return;
    const ang = Math.atan2(dy, dx);
    const ax = player.x * TILE + Math.cos(ang) * 10;
    const ay = player.y * TILE + Math.sin(ang) * 10;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = target.color;
    ctx.globalAlpha = 0.35 + Math.sin(anim * 0.2) * 0.2;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3, 3);
    ctx.lineTo(-3, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const px = player.x * TILE;
    const py = player.y * TILE;
    const step = Math.floor(anim / 5) % 2;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(px - 5, py + 5, 10, 3);
    ctx.fillStyle = C.player;
    ctx.fillRect(px - 4, py - 3, 8, 8);
    ctx.fillStyle = C.playerHi;
    ctx.fillRect(px - 3, py - 6, 6, 5);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px - 2 + player.facing.x, py - 4, 1, 1);
    ctx.fillRect(px + 1 + player.facing.x, py - 4, 1, 1);
    ctx.fillStyle = C.player;
    ctx.fillRect(px - 4, py + 5, 3, 2 - step);
    ctx.fillRect(px + 1, py + 5, 3, 1 + step);
  }

  function drawMonkey() {
    const px = monkey.x * TILE;
    const py = monkey.y * TILE;
    const step = Math.floor(anim / 6) % 2;
    const mad = monkey.roar > 0;

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(px - 11, py + 8, 22, 4);

    if (monkey.windup > 0) {
      ctx.strokeStyle = C.doorBand;
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 14, py - 16, 28, 28);
    }

    ctx.fillStyle = C.monkey;
    ctx.fillRect(px - 10, py - 4, 20, 14);
    ctx.fillStyle = C.monkeyFace;
    ctx.fillRect(px - 6, py, 12, 7);
    ctx.fillStyle = C.monkey;
    ctx.fillRect(px - 9, py - 13, 18, 11);
    ctx.fillStyle = C.monkeyFace;
    ctx.fillRect(px - 6, py - 10, 12, 8);
    ctx.fillStyle = C.monkeyDk;
    ctx.fillRect(px - 12, py - 11, 4, 4);
    ctx.fillRect(px + 8, py - 11, 4, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px - 4, py - 8, 2, 2);
    ctx.fillRect(px + 2, py - 8, 2, 2);
    ctx.fillStyle = mad ? C.doorBand : "#5a2a12";
    ctx.fillRect(px - 4, py - 9, 2, 1);
    ctx.fillRect(px + 2, py - 9, 2, 1);
    ctx.fillStyle = C.ink;
    ctx.fillRect(px - 3, py - 4, 6, 1);
    // arms
    const reach = player.x >= monkey.x ? 1 : -1;
    ctx.fillStyle = C.monkey;
    ctx.fillRect(px + (reach > 0 ? 9 : -15), py - 1, 6, 3);
    ctx.fillStyle = C.monkeyDk;
    ctx.fillRect(px - 8, py + 9, 6, 4 + step);
    ctx.fillRect(px + 2, py + 9, 6, 4 + (1 - step));
  }

  function loop() {
    anim++;
    if (hitstop > 0) {
      hitstop--;
      draw();
      requestAnimationFrame(loop);
      return;
    }
    updatePlayer();
    updateMonkey();
    updateFx();
    draw();
    requestAnimationFrame(loop);
  }

  function bufferDir(x, y) {
    inputBuffer = { x, y };
    inputBufferT = 10;
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift"].includes(k)) {
      e.preventDefault();
    }
    keys.add(k);
    if (k === "w" || k === "arrowup") bufferDir(0, -1);
    if (k === "s" || k === "arrowdown") bufferDir(0, 1);
    if (k === "a" || k === "arrowleft") bufferDir(-1, 0);
    if (k === "d" || k === "arrowright") bufferDir(1, 0);
    if ((k === " " || k === "enter") && state !== "play") startGame();
  });

  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  startBtn.addEventListener("click", startGame);
  overlay.addEventListener("click", (e) => {
    if (e.target === startBtn) return;
    if (state !== "play") startGame();
  });

  resetLevel();
  updatePips();
  loop();
})();
