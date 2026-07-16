export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number | null;
  plays: number; // ambos calculados, no almacenados
}

export interface ScoreRow {
  id: number;
  player_name: string;
  score: number;
  created_at: string;
  game?: { id: string; title: string }; // solo presente en la vista global
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
