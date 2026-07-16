import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "./types";

type GameRow = Omit<Game, "best" | "plays">;

async function withStats(
  supabase: SupabaseClient,
  row: GameRow,
): Promise<Game> {
  const [bestResult, playsResult] = await Promise.all([
    supabase
      .from("scores")
      .select("score")
      .eq("game_id", row.id)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("game_id", row.id),
  ]);

  return {
    ...row,
    best: bestResult.data?.score ?? null,
    plays: playsResult.count ?? 0,
  };
}

export async function getGames(supabase: SupabaseClient): Promise<Game[]> {
  const { data, error } = await supabase.from("games").select("*");
  if (error) throw error;

  return Promise.all(
    (data as GameRow[]).map((row) => withStats(supabase, row)),
  );
}

export async function getGameById(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return withStats(supabase, data as GameRow);
}
