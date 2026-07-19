"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { insertScore } from "@/lib/supabase/scores";
import { useAuth } from "@/app/context/AuthContext";
import AsteroidsGame, { AsteroidsSkin } from "@/components/games/AsteroidsGame";

const GAME_ID = "asteroides";
const GAME_TITLE = "ASTEROIDES";
const LAST_PLAYER_NAME_KEY = "av_last_player_name";
const SKIN_KEY = "av_asteroides_skin";
const SKIN_OPTIONS: { value: AsteroidsSkin; label: string }[] = [
  { value: "retro", label: "Retro" },
  { value: "neon", label: "Neón" },
  { value: "pastel", label: "Pastel" },
];

export default function AsteroidsPlayerPage() {
  const { user } = useAuth();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [runId, setRunId] = useState(0);
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return user ?? "INVITADO";
    return localStorage.getItem(LAST_PLAYER_NAME_KEY) ?? user ?? "INVITADO";
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skin, setSkin] = useState<AsteroidsSkin>(() => {
    if (typeof window === "undefined") return "retro";
    return (localStorage.getItem(SKIN_KEY) as AsteroidsSkin) ?? "retro";
  });

  const changeSkin = (value: AsteroidsSkin) => {
    setSkin(value);
    localStorage.setItem(SKIN_KEY, value);
  };

  const endGame = () => {
    setFinalScore(score);
    setOver(true);
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setOver(false);
    setSaved(false);
    setPaused(false);
    setRunId((id) => id + 1);
  };

  const saveScore = async () => {
    setSaving(true);
    const supabase = createClient();
    await insertScore(supabase, {
      gameId: GAME_ID,
      playerName: name,
      score: finalScore,
    });
    localStorage.setItem(LAST_PLAYER_NAME_KEY, name);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <select
            className="skin-select"
            value={skin}
            onChange={(e) => changeSkin(e.target.value as AsteroidsSkin)}
            aria-label="Skin de nave y asteroides"
          >
            {SKIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juego/${GAME_ID}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt crt-fixed">
        <div className="crt-screen">
          <AsteroidsGame
            key={runId}
            paused={paused}
            skin={skin}
            onScoreChange={setScore}
            onLivesChange={setLives}
            onLevelChange={setLevel}
            onGameOver={(gameOverScore) => {
              setFinalScore(gameOverScore);
              setOver(true);
            }}
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{GAME_TITLE} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={saveScore}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
