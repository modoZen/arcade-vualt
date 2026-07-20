"use client";

import { useEffect, useRef } from "react";

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

type Direction = "up" | "down" | "left" | "right";

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  cycleT?: number; // fase del ciclo de inmersión, solo para "turtle"
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const ROAD_SPEED_MIN = 1.5;
const ROAD_SPEED_MAX = 4;
const RIVER_SPEED_MIN = 1;
const RIVER_SPEED_MAX = 3;
const LEVEL_SPEED_STEP = 1.15;
const LANE_MIN_ENTITIES = 2;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

function levelFactor(level: number): number {
  return LEVEL_SPEED_STEP ** (level - 1);
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function rowsInRange(from: number, to: number): number[] {
  const rows: number[] = [];
  for (let r = from; r <= to; r++) rows.push(r);
  return rows;
}

function buildRoadLane(row: number, dir: 1 | -1, level: number): Lane {
  const speed =
    randBetween(ROAD_SPEED_MIN, ROAD_SPEED_MAX) * levelFactor(level);
  const entities: Entity[] = [];
  let col = randBetween(-4, 0);
  while (entities.length < LANE_MIN_ENTITIES || col < COLS) {
    const isTruck = Math.random() < 0.35;
    const width = isTruck
      ? 2 + Math.floor(Math.random() * 2)
      : 1 + Math.floor(Math.random() * 2);
    entities.push({ col, width, type: isTruck ? "truck" : "car" });
    col += width + randBetween(2.5, 4.5);
  }
  return { row, speed, dir, entities };
}

function buildRiverLane(row: number, dir: 1 | -1, level: number): Lane {
  const speed =
    randBetween(RIVER_SPEED_MIN, RIVER_SPEED_MAX) * levelFactor(level);
  const entities: Entity[] = [];
  const isTurtleLane = Math.random() < 0.4;
  let col = randBetween(-4, 0);
  while (entities.length < LANE_MIN_ENTITIES || col < COLS) {
    if (isTurtleLane) {
      const groupSize = 2 + Math.floor(Math.random() * 2); // 2-3
      entities.push({
        col,
        width: groupSize,
        type: "turtle",
        submerged: false,
        cycleT: Math.random() * TURTLE_VISIBLE_MS,
      });
      col += groupSize + randBetween(2, 4);
    } else {
      const width = 2 + Math.floor(Math.random() * 3); // 2-4
      entities.push({ col, width, type: "log" });
      col += width + randBetween(1.5, 3);
    }
  }
  return { row, speed, dir, entities };
}

function buildLanes(level: number): Lane[] {
  const roadRows = rowsInRange(ROW_ROAD_TOP, ROW_ROAD_BOT);
  const riverRows = rowsInRange(ROW_RIVER_TOP, ROW_RIVER_BOT);
  const lanes: Lane[] = [
    ...roadRows.map((row, i) =>
      buildRoadLane(row, i % 2 === 0 ? 1 : -1, level),
    ),
    ...riverRows.map((row, i) =>
      buildRiverLane(row, i % 2 === 0 ? -1 : 1, level),
    ),
  ];
  return lanes;
}

const GOAL_WIDTH = 2;
const GOAL_STARTS = [1, 4, 7, 10, 13];
const JUMP_MS = 120;
const START_LIVES = 3;
const ROUND_TIME_BASE_MS = 15000;
const ROUND_TIME_STEP_MS = 1000;
const ROUND_TIME_MIN_MS = 6000;
const MAX_FRAME_DT = 250;
const LANE_WRAP_MARGIN = 6; // >= ancho máximo de entidad (4 celdas)
const LANE_TRACK_LENGTH = COLS + LANE_WRAP_MARGIN * 2;

function wrapLaneCol(col: number): number {
  const shifted = col + LANE_WRAP_MARGIN;
  const wrapped =
    ((shifted % LANE_TRACK_LENGTH) + LANE_TRACK_LENGTH) % LANE_TRACK_LENGTH;
  return wrapped - LANE_WRAP_MARGIN;
}

function roundTimeForLevel(level: number): number {
  return Math.max(
    ROUND_TIME_MIN_MS,
    ROUND_TIME_BASE_MS - (level - 1) * ROUND_TIME_STEP_MS,
  );
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type FroggerSkin = "retro" | "neon" | "pastel" | "pixel";

interface SkinDef {
  label: string;
  bgGoal: string;
  bgRiver: string;
  bgRoad: string;
  bgGrass: string;
  goalBox: string;
  goalBorder: string;
  goalFilled: string;
  cars: string[];
  truckBody: string;
  truckCab: string;
  wheels: string;
  log: string;
  logLines: string;
  turtle: string;
  turtleShell: string;
  turtleSubmerged: string;
  frog: string;
  hudBg: string;
  hudText: string;
  glow?: boolean;
  flat?: boolean;
}

const SKINS: Record<FroggerSkin, SkinDef> = {
  retro: {
    label: "Retro",
    bgGoal: "#9fe6a0",
    bgRiver: "#0a2a4d",
    bgRoad: "#111111",
    bgGrass: "#123a1f",
    goalBox: "#123a1f",
    goalBorder: "#d4af37",
    goalFilled: "#33ff66",
    cars: ["#e63946", "#f4d35e", "#4361ee"],
    truckBody: "#8d99ae",
    truckCab: "#495057",
    wheels: "#111111",
    log: "#7f5539",
    logLines: "rgba(0,0,0,0.3)",
    turtle: "#2ecc71",
    turtleShell: "#1e8449",
    turtleSubmerged: "rgba(46, 204, 113, 0.35)",
    frog: "#39ff14",
    hudBg: "rgba(0,0,0,0.55)",
    hudText: "#ffffff",
  },
  neon: {
    label: "Neón",
    bgGoal: "#003b1a",
    bgRiver: "#001233",
    bgRoad: "#050505",
    bgGrass: "#001a0d",
    goalBox: "#001a0d",
    goalBorder: "#39ff14",
    goalFilled: "#39ff14",
    cars: ["#ff2079", "#00e5ff", "#faff00"],
    truckBody: "#8a2be2",
    truckCab: "#5e17eb",
    wheels: "#000000",
    log: "#ff8800",
    logLines: "rgba(0,0,0,0.4)",
    turtle: "#00ffb3",
    turtleShell: "#00b386",
    turtleSubmerged: "rgba(0, 255, 179, 0.35)",
    frog: "#c6ff00",
    hudBg: "rgba(0,0,0,0.65)",
    hudText: "#00f5ff",
    glow: true,
  },
  pastel: {
    label: "Pastel",
    bgGoal: "#dff5e1",
    bgRiver: "#cfe3f5",
    bgRoad: "#3a3a3a",
    bgGrass: "#dcefe0",
    goalBox: "#e8f5e9",
    goalBorder: "#f4d58d",
    goalFilled: "#a8e6a1",
    cars: ["#ffb3ba", "#fff2a8", "#bcd4ff"],
    truckBody: "#cfd8e3",
    truckCab: "#b0bec5",
    wheels: "#666666",
    log: "#d8a47f",
    logLines: "rgba(0,0,0,0.15)",
    turtle: "#9fd8a3",
    turtleShell: "#7fc484",
    turtleSubmerged: "rgba(159, 216, 163, 0.35)",
    frog: "#aef7c1",
    hudBg: "rgba(255,255,255,0.55)",
    hudText: "#333333",
  },
  pixel: {
    label: "Pixel Art",
    bgGoal: "#00a800",
    bgRiver: "#0000bc",
    bgRoad: "#000000",
    bgGrass: "#005800",
    goalBox: "#005800",
    goalBorder: "#f8d800",
    goalFilled: "#00f800",
    cars: ["#f83800", "#f8d800", "#0058f8"],
    truckBody: "#a8a8a8",
    truckCab: "#585858",
    wheels: "#000000",
    log: "#a85800",
    logLines: "rgba(0,0,0,0.5)",
    turtle: "#58f858",
    turtleShell: "#005800",
    turtleSubmerged: "rgba(0, 248, 0, 0.35)",
    frog: "#58f858",
    hudBg: "rgba(0,0,0,0.8)",
    hudText: "#f8f8f8",
    flat: true,
  },
};

interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: FroggerSkin;
}

export default function FroggerGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skin = "retro",
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef(skin);
  const callbacksRef = useRef({
    onScoreChange,
    onLivesChange,
    onLevelChange,
    onGameOver,
  });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    skinRef.current = skin;
  }, [skin]);

  useEffect(() => {
    callbacksRef.current = {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    };
  }, [onScoreChange, onLivesChange, onLevelChange, onGameOver]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const startCol = Math.floor(COLS / 2);

    function makeFrog(): Frog {
      return {
        col: startCol,
        row: ROW_START,
        animating: false,
        animT: 0,
        targetCol: startCol,
        targetRow: ROW_START,
      };
    }

    let level = 1;
    let score = 0;
    let lives = START_LIVES;
    let lanes: Lane[] = buildLanes(level);
    let goals: boolean[] = new Array(GOAL_STARTS.length).fill(false);
    let roundTimeMs = roundTimeForLevel(level);
    let timeLeft = roundTimeMs;
    let frog: Frog = makeFrog();
    let bestRow = ROW_START;
    let pendingDir: Direction | null = null;
    let gameOver = false;

    function handleKeyDown(e: KeyboardEvent) {
      const dir = KEY_DIRECTIONS[e.code];
      if (!dir) return;
      e.preventDefault();
      pendingDir = dir;
    }

    document.addEventListener("keydown", handleKeyDown);

    function goalIndexForCol(col: number): number {
      return GOAL_STARTS.findIndex(
        (start) => col >= start && col < start + GOAL_WIDTH,
      );
    }

    function checkRoadCollision(f: Frog, ls: Lane[]): boolean {
      return ls.some(
        (lane) =>
          lane.row === f.row &&
          lane.entities.some(
            (e) =>
              (e.type === "car" || e.type === "truck") &&
              f.col >= e.col &&
              f.col < e.col + e.width,
          ),
      );
    }

    function getSupport(f: Frog, ls: Lane[]): Entity | null {
      const lane = ls.find((l) => l.row === f.row);
      if (!lane) return null;
      const entity = lane.entities.find(
        (e) => f.col >= e.col && f.col < e.col + e.width,
      );
      if (!entity) return null;
      if (entity.type === "turtle" && entity.submerged) return null;
      return entity;
    }

    function resetFrogPosition() {
      frog = makeFrog();
      bestRow = ROW_START;
      timeLeft = roundTimeMs;
      pendingDir = null;
    }

    function killFrog() {
      lives -= 1;
      if (lives <= 0) {
        lives = 0;
        gameOver = true;
      } else {
        resetFrogPosition();
      }
    }

    function completeRound() {
      score += 200;
      goals = new Array(GOAL_STARTS.length).fill(false);
      level += 1;
      lanes = buildLanes(level);
      roundTimeMs = roundTimeForLevel(level);
      resetFrogPosition();
    }

    function checkGoal(f: Frog): "scored" | "dead" | null {
      if (f.row !== ROW_GOALS) return null;
      const idx = goalIndexForCol(f.col);
      if (idx === -1 || goals[idx]) return "dead";
      goals[idx] = true;
      score += 50 + Math.round(timeLeft / 1000) * 10;
      return "scored";
    }

    function resolveLanding() {
      if (checkRoadCollision(frog, lanes)) {
        killFrog();
        return;
      }
      if (frog.row === ROW_GOALS) {
        const result = checkGoal(frog);
        if (result === "dead") {
          killFrog();
          return;
        }
        if (result === "scored") {
          if (goals.every(Boolean)) {
            completeRound();
          } else {
            resetFrogPosition();
          }
        }
        return;
      }
      if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        if (!getSupport(frog, lanes)) {
          killFrog();
        }
      }
    }

    function moveLanes(dt: number) {
      for (const lane of lanes) {
        for (const e of lane.entities) {
          // lane.speed está en px/frame (16ms); e.col vive en celdas, no px.
          e.col += (lane.speed * lane.dir * dt) / 16 / CELL;
          // Wrap modular (no un reset "a lo bruto"): todas las entidades del
          // carril comparten velocidad, así que su espaciado relativo debe
          // mantenerse constante para siempre; solo un wrap periódico lo logra.
          e.col = wrapLaneCol(e.col);
          if (e.type === "turtle") {
            e.cycleT = (e.cycleT ?? 0) + dt;
            const cycle = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
            e.submerged = e.cycleT % cycle >= TURTLE_VISIBLE_MS;
          }
        }
      }
    }

    function tryStartJump() {
      if (!pendingDir) return;
      const delta = DIR_DELTA[pendingDir];
      pendingDir = null;
      const baseCol = Math.round(frog.col);
      const targetCol = baseCol + delta.dc;
      const targetRow = frog.row + delta.dr;
      if (targetCol < 0 || targetCol >= COLS) return;
      if (targetRow < ROW_GOALS || targetRow > ROW_START) return;
      frog.animating = true;
      frog.animT = 0;
      frog.targetCol = targetCol;
      frog.targetRow = targetRow;
    }

    function finishJump() {
      frog.animating = false;
      frog.animT = 0;
      frog.col = frog.targetCol;
      frog.row = frog.targetRow;
      if (frog.row < bestRow) {
        score += 10;
        bestRow = frog.row;
      }
      resolveLanding();
    }

    function driftWithSupport(dt: number) {
      const lane = lanes.find((l) => l.row === frog.row);
      const support = lane ? getSupport(frog, lanes) : null;
      if (!lane || !support) {
        killFrog();
        return;
      }
      frog.col += (lane.speed * lane.dir * dt) / 16 / CELL;
      if (frog.col < 0 || frog.col >= COLS) killFrog();
    }

    function update(dt: number) {
      if (gameOver) return;

      moveLanes(dt);

      if (frog.animating) {
        frog.animT += dt;
        if (frog.animT >= JUMP_MS) finishJump();
      } else if (pendingDir) {
        tryStartJump();
      } else if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
        driftWithSupport(dt);
      }

      if (!frog.animating && !gameOver) {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          timeLeft = 0;
          killFrog();
        }
      }
    }

    function drawGoals(def: SkinDef) {
      GOAL_STARTS.forEach((start, i) => {
        const x = start * CELL;
        const y = ROW_GOALS * CELL;
        const w = GOAL_WIDTH * CELL;
        ctx.fillStyle = def.goalBox;
        ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
        ctx.strokeStyle = def.goalBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
        if (goals[i]) {
          if (def.glow) {
            ctx.shadowColor = def.goalFilled;
            ctx.shadowBlur = 10;
          }
          ctx.fillStyle = def.goalFilled;
          ctx.beginPath();
          ctx.ellipse(
            x + w / 2,
            y + CELL / 2,
            w * 0.28,
            CELL * 0.32,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          if (def.glow) ctx.shadowBlur = 0;
        }
      });
    }

    function drawEntity(lane: Lane, e: Entity, def: SkinDef) {
      const x = e.col * CELL;
      const y = lane.row * CELL;
      const w = e.width * CELL;
      const h = CELL;
      if (def.glow) {
        ctx.shadowBlur = 6;
      }
      if (e.type === "car") {
        const carColor =
          def.cars[Math.abs(Math.floor(e.col)) % def.cars.length];
        if (def.glow) {
          ctx.shadowColor = carColor;
        }
        ctx.fillStyle = carColor;
        ctx.fillRect(x + 2, y + 6, w - 4, h - 16);
        if (def.flat) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 6, w - 4, h - 16);
        }
        if (def.glow) {
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = def.wheels;
        const wheelY = y + h - 10;
        ctx.beginPath();
        ctx.arc(x + 8, wheelY, 5, 0, Math.PI * 2);
        ctx.arc(x + w - 8, wheelY, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "truck") {
        if (def.glow) {
          ctx.shadowColor = def.truckBody;
        }
        ctx.fillStyle = def.truckBody;
        ctx.fillRect(x + 2, y + 4, w - 4, h - 12);
        ctx.fillStyle = def.truckCab;
        ctx.fillRect(x + 2, y + 4, Math.min(CELL - 8, w - 4), h - 12);
        if (def.flat) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 4, w - 4, h - 12);
        }
        if (def.glow) {
          ctx.shadowBlur = 6;
        }
        ctx.fillStyle = def.wheels;
        const wheelY = y + h - 8;
        ctx.beginPath();
        ctx.arc(x + 8, wheelY, 5, 0, Math.PI * 2);
        ctx.arc(x + w - 8, wheelY, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "log") {
        if (def.glow) {
          ctx.shadowColor = def.log;
        }
        ctx.fillStyle = def.log;
        ctx.fillRect(x + 1, y + 8, w - 2, h - 16);
        if (def.glow) {
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = def.logLines;
        ctx.lineWidth = 1;
        for (let lx = x + 6; lx < x + w - 6; lx += 10) {
          ctx.beginPath();
          ctx.moveTo(lx, y + 9);
          ctx.lineTo(lx, y + h - 9);
          ctx.stroke();
        }
      } else if (e.type === "turtle") {
        for (let i = 0; i < e.width; i++) {
          const cx = x + i * CELL + CELL / 2;
          const cy = y + h / 2;
          if (e.submerged) {
            if (def.glow) {
              ctx.shadowBlur = 0;
            }
            ctx.strokeStyle = def.turtleSubmerged;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            if (def.glow) {
              ctx.shadowColor = def.turtle;
              ctx.shadowBlur = 6;
            }
            ctx.fillStyle = def.turtle;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
            ctx.fill();
            if (def.glow) {
              ctx.shadowBlur = 0;
            }
            ctx.strokeStyle = def.turtleShell;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.2, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      if (def.glow) {
        ctx.shadowBlur = 0;
      }
    }

    function drawFrog(def: SkinDef) {
      const t = frog.animating ? frog.animT / JUMP_MS : 1;
      const col = frog.animating ? lerp(frog.col, frog.targetCol, t) : frog.col;
      const row = frog.animating ? lerp(frog.row, frog.targetRow, t) : frog.row;
      const x = col * CELL + CELL / 2;
      const y = row * CELL + CELL / 2;

      if (def.glow) {
        ctx.shadowColor = def.frog;
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = def.frog;
      ctx.beginPath();
      ctx.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      if (def.flat) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (def.glow) {
        ctx.shadowBlur = 0;
      }

      const legSpread = frog.animating ? 10 : 4;
      ctx.strokeStyle = def.frog;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 6);
      ctx.lineTo(x - 10 - legSpread, y - 10);
      ctx.moveTo(x + 10, y - 6);
      ctx.lineTo(x + 10 + legSpread, y - 10);
      ctx.moveTo(x - 8, y + 8);
      ctx.lineTo(x - 8 - legSpread, y + 12);
      ctx.moveTo(x + 8, y + 8);
      ctx.lineTo(x + 8 + legSpread, y + 12);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - 6, y - 6, 4, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x - 6, y - 6, 1.8, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawHud(def: SkinDef) {
      const hudH = 20;
      ctx.fillStyle = def.hudBg;
      ctx.fillRect(0, 0, CANVAS_W, hudH);

      ctx.fillStyle = def.hudText;
      ctx.font = "14px monospace";
      ctx.textBaseline = "middle";

      ctx.textAlign = "left";
      ctx.fillText(`SCORE ${score}`, 8, hudH / 2);

      ctx.textAlign = "center";
      ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, hudH / 2);

      ctx.textAlign = "right";
      const iconR = 5;
      for (let i = 0; i < lives; i++) {
        ctx.fillStyle = def.frog;
        ctx.beginPath();
        ctx.arc(
          CANVAS_W - 10 - i * (iconR * 2 + 5),
          hudH / 2,
          iconR,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      const ratio = Math.max(0, timeLeft / roundTimeMs);
      ctx.fillStyle =
        ratio > 0.5 ? def.frog : ratio > 0.25 ? def.cars[1] : def.cars[0];
      ctx.fillRect(0, 0, CANVAS_W * ratio, 3);
    }

    function draw() {
      const def = SKINS[skinRef.current];

      for (let row = 0; row < ROWS; row++) {
        let color: string;
        if (row === ROW_GOALS) color = def.bgGoal;
        else if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT)
          color = def.bgRiver;
        else if (row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT) color = def.bgRoad;
        else if (row === ROW_SAFE_MID || row === ROW_START) color = def.bgGrass;
        else color = def.bgGrass;
        ctx.fillStyle = color;
        ctx.fillRect(0, row * CELL, CANVAS_W, CELL);
      }

      drawGoals(def);

      for (const lane of lanes) {
        for (const e of lane.entities) drawEntity(lane, e, def);
      }

      drawFrog(def);
      drawHud(def);
    }

    let lastScore = -1;
    let lastLives = -1;
    let lastLevel = -1;
    let gameOverNotified = false;

    function notifyState() {
      const cb = callbacksRef.current;
      if (score !== lastScore) {
        lastScore = score;
        cb.onScoreChange(score);
      }
      if (lives !== lastLives) {
        lastLives = lives;
        cb.onLivesChange(lives);
      }
      if (level !== lastLevel) {
        lastLevel = level;
        cb.onLevelChange(level);
      }
      if (gameOver && !gameOverNotified) {
        gameOverNotified = true;
        cb.onGameOver(score);
      }
    }

    notifyState();

    let lastTime: number | null = null;
    let rafId = 0;

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_FRAME_DT);
      lastTime = ts;

      if (!pausedRef.current) {
        update(dt);
      }
      draw();
      notifyState();
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
