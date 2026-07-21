"use client";

import { useEffect, useRef } from "react";

const W = 800;
const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_X = 40;
const BOARD_Y = 0;
const BOARD_W = COLS * BLOCK;
const BOARD_H = ROWS * BLOCK;

const PANEL_X = BOARD_X + BOARD_W + 40;
const NEXT_BOX = 4 * BLOCK;
const NEXT_X = PANEL_X + (W - PANEL_X - NEXT_BOX) / 2;
const NEXT_Y = 320;

const GRID_LINE_COLOR = "rgba(0, 245, 255, 0.15)";

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

interface SkinDef {
  label: string;
  colors: (string | null)[];
  grid: string;
  glow?: boolean;
  flat?: boolean;
}

const SKINS: Record<TetrisSkin, SkinDef> = {
  retro: {
    label: "Retro",
    colors: COLORS,
    grid: GRID_LINE_COLOR,
  },
  neon: {
    label: "Neon",
    colors: [
      null,
      "#00e5ff",
      "#fff176",
      "#e040fb",
      "#69f0ae",
      "#ff5252",
      "#448aff",
      "#ffab40",
      "#b388ff",
    ],
    grid: "rgba(0, 229, 255, 0.25)",
    glow: true,
  },
  pastel: {
    label: "Pastel",
    colors: [
      null,
      "#a8dadc",
      "#ffe8a3",
      "#d8bfd8",
      "#c1e1c1",
      "#ffb3ba",
      "#bcd4ff",
      "#ffdab9",
      "#e6e6e6",
    ],
    grid: "rgba(255, 255, 255, 0.1)",
  },
  pixel: {
    label: "Pixel Art",
    colors: COLORS,
    grid: GRID_LINE_COLOR,
    flat: true,
  },
};

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

interface TetrisGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  skin?: TetrisSkin;
}

export default function TetrisGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skin = "retro",
}: TetrisGameProps) {
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

    let bgCanvas: HTMLCanvasElement | OffscreenCanvas;
    let bgCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (typeof OffscreenCanvas !== "undefined") {
      const offscreen = new OffscreenCanvas(BOARD_W, BOARD_H);
      const offscreenCtx = offscreen.getContext("2d");
      if (!offscreenCtx) return;
      bgCanvas = offscreen;
      bgCtx = offscreenCtx;
    } else {
      const fallback = document.createElement("canvas");
      fallback.width = BOARD_W;
      fallback.height = BOARD_H;
      const fallbackCtx = fallback.getContext("2d");
      if (!fallbackCtx) return;
      bgCanvas = fallback;
      bgCtx = fallbackCtx;
    }

    function createBoard(): number[][] {
      return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    }

    function randomPiece(): Piece {
      const type = Math.floor(Math.random() * 8) + 1;
      const shape = PIECES[type]!.map((row) => [...row]);
      return {
        type,
        shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
      };
    }

    function collide(shape: number[][], ox: number, oy: number): boolean {
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (!shape[r][c]) continue;
          const nx = ox + c;
          const ny = oy + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    }

    function rotateCW(shape: number[][]): number[][] {
      const rows = shape.length;
      const cols = shape[0].length;
      const result = Array.from({ length: cols }, () =>
        new Array(rows).fill(0),
      );
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
      return result;
    }

    function tryRotate() {
      const rotated = rotateCW(current.shape);
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        if (!collide(rotated, current.x + kick, current.y)) {
          current.shape = rotated;
          current.x += kick;
          return;
        }
      }
    }

    function merge() {
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            board[current.y + r][current.x + c] = current.shape[r][c];
    }

    function clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every((v) => v !== 0)) {
          board.splice(r, 1);
          board.unshift(new Array(COLS).fill(0));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        score += (LINE_SCORES[cleared] || 0) * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      }
    }

    function ghostY(): number {
      let gy = current.y;
      while (!collide(current.shape, current.x, gy + 1)) gy++;
      return gy;
    }

    function hardDrop() {
      const gy = ghostY();
      score += (gy - current.y) * 2;
      current.y = gy;
      lockPiece();
    }

    function softDrop() {
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
        score += 1;
      } else {
        lockPiece();
      }
    }

    function lockPiece() {
      merge();
      clearLines();
      boardVersion++;
      spawn();
    }

    function spawn() {
      current = next;
      next = randomPiece();
      if (collide(current.shape, current.x, current.y)) {
        gameOver = true;
        lives = 0;
      }
    }

    function drawBlock(
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      x: number,
      y: number,
      colorIndex: number,
      size: number,
      alpha?: number,
    ) {
      if (!colorIndex) return;
      const def = SKINS[skinRef.current];
      const color = def.colors[colorIndex] ?? (COLORS[colorIndex] as string);
      context.globalAlpha = alpha ?? 1;
      if (def.glow) {
        context.shadowColor = color;
        context.shadowBlur = 8;
      }
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      if (def.glow) context.shadowBlur = 0;
      if (!def.flat) {
        context.fillStyle = "rgba(255,255,255,0.12)";
        context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      } else {
        context.strokeStyle = "rgba(0,0,0,0.5)";
        context.lineWidth = 1;
        context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
      }
      context.globalAlpha = 1;
    }

    function drawGrid(
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    ) {
      context.strokeStyle = SKINS[skinRef.current].grid;
      context.lineWidth = 0.5;
      for (let c = 1; c < COLS; c++) {
        context.beginPath();
        context.moveTo(c * BLOCK, 0);
        context.lineTo(c * BLOCK, ROWS * BLOCK);
        context.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        context.beginPath();
        context.moveTo(0, r * BLOCK);
        context.lineTo(COLS * BLOCK, r * BLOCK);
        context.stroke();
      }
    }

    function currentBgCacheKey(): string {
      return `${skinRef.current}|${boardVersion}`;
    }

    function renderBackground() {
      bgCtx.clearRect(0, 0, BOARD_W, BOARD_H);
      drawGrid(bgCtx);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          drawBlock(bgCtx, c, r, board[r][c], BLOCK);
    }

    function drawNext() {
      const shape = next.shape;
      const offX = Math.floor((4 - shape[0].length) / 2);
      const offY = Math.floor((4 - shape.length) / 2);
      ctx.save();
      ctx.translate(NEXT_X, NEXT_Y);
      for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++)
          drawBlock(ctx, offX + c, offY + r, shape[r][c], BLOCK);
      ctx.restore();
    }

    function drawPanel() {
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px monospace";
      ctx.fillText("TETRIS", PANEL_X, 50);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#00f5ff";
      ctx.fillText("SCORE", PANEL_X, 96);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(score.toLocaleString(), PANEL_X, 122);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#00f5ff";
      ctx.fillText("LINES", PANEL_X, 156);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(String(lines), PANEL_X, 182);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#00f5ff";
      ctx.fillText("LEVEL", PANEL_X, 216);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px monospace";
      ctx.fillText(String(level), PANEL_X, 242);

      ctx.font = "13px monospace";
      ctx.fillStyle = "#00f5ff";
      ctx.fillText("NEXT", PANEL_X, 300);

      drawNext();
    }

    function draw() {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(BOARD_X, BOARD_Y);

      const expectedBgKey = currentBgCacheKey();
      if (expectedBgKey !== bgCacheKey) {
        renderBackground();
        bgCacheKey = expectedBgKey;
      }
      ctx.drawImage(bgCanvas, 0, 0);

      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx,
              current.x + c,
              gy + r,
              current.shape[r][c],
              BLOCK,
              0.2,
            );

      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          drawBlock(
            ctx,
            current.x + c,
            current.y + r,
            current.shape[r][c],
            BLOCK,
          );

      ctx.strokeStyle = "rgba(0, 245, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, BOARD_W, BOARD_H);
      ctx.restore();

      drawPanel();
    }

    const board = createBoard();
    let current!: Piece;
    let next: Piece = randomPiece();
    let score = 0;
    let lines = 0;
    let level = 1;
    let lives = 1;
    let gameOver = false;
    let dropInterval = 1000;
    let dropAccum = 0;
    let boardVersion = 0;
    let bgCacheKey: string | null = null;

    spawn();

    const preventScrollCodes = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
    ]);

    function handleKeyDown(e: KeyboardEvent) {
      if (preventScrollCodes.has(e.code)) e.preventDefault();
      if (pausedRef.current || gameOver) return;
      switch (e.code) {
        case "ArrowLeft":
          if (!collide(current.shape, current.x - 1, current.y)) current.x--;
          break;
        case "ArrowRight":
          if (!collide(current.shape, current.x + 1, current.y)) current.x++;
          break;
        case "ArrowDown":
          softDrop();
          break;
        case "ArrowUp":
        case "KeyX":
          tryRotate();
          break;
        case "Space":
          hardDrop();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

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
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;

      if (!pausedRef.current && !gameOver) {
        dropAccum += dt * 1000;
        if (dropAccum >= dropInterval) {
          dropAccum = 0;
          if (!collide(current.shape, current.x, current.y + 1)) {
            current.y++;
          } else {
            lockPiece();
          }
        }
      }

      draw();
      notifyState();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

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
