"use client";

import { useEffect, useRef } from "react";

const W = 600;
const H = 600;
const GRID = 20;
const CELL = 30;

const BASE_INTERVAL = 180;
const INTERVAL_STEP = 15;
const MIN_INTERVAL = 60;
const FRUITS_PER_LEVEL = 5;
const MAX_FRAME_DT = 250;

const FRUIT_SHEET_SRC = "/games/serpiente/fruits.png";

const FRUIT_ATLAS = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
} as const;

type FruitKey = keyof typeof FRUIT_ATLAS;
const FRUIT_KEYS = Object.keys(FRUIT_ATLAS) as FruitKey[];

let fruitsImg: HTMLImageElement | null = null;
let fruitsLoaded = false;
const fruitsCallbacks: (() => void)[] = [];

function loadFruitsImage(cb: () => void) {
  if (fruitsLoaded) {
    cb();
    return;
  }
  fruitsCallbacks.push(cb);
  if (fruitsImg) return;

  const img = new Image();
  img.onload = () => {
    fruitsLoaded = true;
    fruitsCallbacks.forEach((f) => f());
    fruitsCallbacks.length = 0;
  };
  img.onerror = () => console.error("Failed to load fruits spritesheet");
  img.src = FRUIT_SHEET_SRC;
  fruitsImg = img;
}

interface Segment {
  x: number;
  y: number;
}

interface Direction {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
  key: FruitKey;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const ARROW_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function intervalForLevel(level: number): number {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * INTERVAL_STEP);
}

const HEAD_COLOR = "#00ff88";
const BODY_COLOR = "#ff006e";
const GRID_COLOR = "rgba(255, 0, 110, 0.08)";
const BG_COLOR = "#0a0a12";

export type SerpienteSkin = "retro" | "neon" | "pastel" | "pixel";

interface SkinDef {
  label: string;
  head: string;
  body: string;
  grid: string;
  bg: string;
  glow?: boolean;
  flat?: boolean;
}

const SKINS: Record<SerpienteSkin, SkinDef> = {
  retro: {
    label: "Retro",
    head: HEAD_COLOR,
    body: BODY_COLOR,
    grid: GRID_COLOR,
    bg: BG_COLOR,
  },
  neon: {
    label: "Neón",
    head: "#00ffe5",
    body: "#ff2e9e",
    grid: "rgba(0, 255, 229, 0.2)",
    bg: "#050510",
    glow: true,
  },
  pastel: {
    label: "Pastel",
    head: "#a8e6b0",
    body: "#ffb3c6",
    grid: "rgba(255, 255, 255, 0.08)",
    bg: "#1a1a24",
  },
  pixel: {
    label: "Pixel Art",
    head: "#33ff33",
    body: "#cc0044",
    grid: "rgba(255, 255, 255, 0.15)",
    bg: "#000000",
    flat: true,
  },
};

interface SerpienteGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: SerpienteSkin;
}

export default function SerpienteGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skin = "retro",
}: SerpienteGameProps) {
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

    const center = Math.floor(GRID / 2);
    const segments: Segment[] = [
      { x: center, y: center },
      { x: center - 1, y: center },
      { x: center - 2, y: center },
    ];
    let direction: Direction = { x: 1, y: 0 };
    let nextDirection: Direction = { x: 1, y: 0 };
    let started = false;
    let score = 0;
    let lives = 1;
    let level = 1;
    let fruitsEaten = 0;
    let currentInterval = intervalForLevel(level);
    let gameOver = false;

    function randomFreeCell(): Segment {
      const free: Segment[] = [];
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (!segments.some((s) => s.x === x && s.y === y)) {
            free.push({ x, y });
          }
        }
      }
      return free[Math.floor(Math.random() * free.length)];
    }

    function spawnFood(): Food {
      const cell = randomFreeCell();
      const key = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
      return { x: cell.x, y: cell.y, key };
    }

    let food: Food = spawnFood();

    function tick() {
      if (gameOver || !started) return;

      direction = nextDirection;
      const head = segments[0];
      const newHead: Segment = {
        x: head.x + direction.x,
        y: head.y + direction.y,
      };

      if (
        newHead.x < 0 ||
        newHead.x >= GRID ||
        newHead.y < 0 ||
        newHead.y >= GRID
      ) {
        gameOver = true;
        lives = 0;
        return;
      }

      const willGrow = newHead.x === food.x && newHead.y === food.y;
      const bodyToCheck = willGrow ? segments : segments.slice(0, -1);
      if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
        gameOver = true;
        lives = 0;
        return;
      }

      segments.unshift(newHead);
      if (willGrow) {
        score += 100;
        fruitsEaten++;
        if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
          level++;
          currentInterval = intervalForLevel(level);
        }
        food = spawnFood();
      } else {
        segments.pop();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (ARROW_CODES.has(e.code)) e.preventDefault();
      if (gameOver) return;
      const dir = KEY_DIRECTIONS[e.code];
      if (!dir) return;
      if (dir.x === -direction.x && dir.y === -direction.y) return;
      nextDirection = dir;
      started = true;
    }

    window.addEventListener("keydown", handleKeyDown);

    function drawGrid() {
      const def = SKINS[skinRef.current];
      ctx.strokeStyle = def.grid ?? GRID_COLOR;
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL, 0);
        ctx.lineTo(i * CELL, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL);
        ctx.lineTo(W, i * CELL);
        ctx.stroke();
      }
    }

    function drawSnake() {
      const def = SKINS[skinRef.current];
      segments.forEach((seg, i) => {
        const color =
          i === 0 ? (def.head ?? HEAD_COLOR) : (def.body ?? BODY_COLOR);
        ctx.fillStyle = color;
        if (def.glow) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
        }
        ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
        if (def.glow) ctx.shadowBlur = 0;
        if (def.flat) {
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(
            seg.x * CELL + 1.5,
            seg.y * CELL + 1.5,
            CELL - 3,
            CELL - 3,
          );
        }
      });
    }

    function drawFood() {
      const rect = FRUIT_ATLAS[food.key];
      if (!fruitsLoaded || !fruitsImg) return;
      const padding = 4;
      const maxW = CELL - padding * 2;
      const maxH = CELL - padding * 2;
      const scale = Math.min(maxW / rect.w, maxH / rect.h);
      const dw = rect.w * scale;
      const dh = rect.h * scale;
      const dx = food.x * CELL + (CELL - dw) / 2;
      const dy = food.y * CELL + (CELL - dh) / 2;
      ctx.drawImage(fruitsImg, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh);
    }

    function draw() {
      ctx.fillStyle = SKINS[skinRef.current].bg ?? BG_COLOR;
      ctx.fillRect(0, 0, W, H);
      drawGrid();
      drawFood();
      drawSnake();
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
    let moveAccum = 0;
    let rafId = 0;

    function loop(ts: number) {
      const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_FRAME_DT);
      lastTime = ts;

      if (!pausedRef.current && !gameOver) {
        moveAccum += dt;
        if (moveAccum >= currentInterval) {
          moveAccum = 0;
          tick();
        }
      }

      draw();
      notifyState();
      rafId = requestAnimationFrame(loop);
    }

    loadFruitsImage(() => {
      rafId = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
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
