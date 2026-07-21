import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreRow } from "./types";

export async function getTopScoresByGame(
  supabase: SupabaseClient,
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("id, player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data as ScoreRow[];
}

export async function getTopScoresGlobal(
  supabase: SupabaseClient,
  limit = 10,
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("id, player_name, score, created_at, game:games(id, title)")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return data as unknown as ScoreRow[];
}

export async function insertScore(
  supabase: SupabaseClient,
  params: {
    gameId: string;
    playerName: string;
    score: number;
    userId: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from("scores").insert({
    game_id: params.gameId,
    player_name: params.playerName,
    score: params.score,
    user_id: params.userId,
  });
  if (error) throw error;
}
