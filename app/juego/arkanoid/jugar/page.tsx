"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { insertScore } from "@/lib/supabase/scores";
import { useUser } from "@/app/context/UserContext";
import ArkanoidGame, { ArkanoidSkin } from "@/components/games/ArkanoidGame";
import TouchControls from "@/components/games/TouchControls";

const GAME_ID = "arkanoid";
const GAME_TITLE = "ARKANOID";
const LAST_PLAYER_NAME_KEY = "av_last_player_name";
const SKIN_KEY = "av_arkanoid_skin";
const SKIN_OPTIONS: { value: ArkanoidSkin; label: string }[] = [
  { value: "retro", label: "Retro" },
  { value: "neon", label: "Neón" },
  { value: "pastel", label: "Pastel" },
];

export default function ArkanoidPlayerPage() {
  const { user, username } = useUser();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [runId, setRunId] = useState(0);
  const [name, setName] = useState(() => {
    if (typeof window === "undefined") return username ?? "INVITADO";
    return localStorage.getItem(LAST_PLAYER_NAME_KEY) ?? username ?? "INVITADO";
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skin, setSkin] = useState<ArkanoidSkin>(() => {
    if (typeof window === "undefined") return "retro";
    return (localStorage.getItem(SKIN_KEY) as ArkanoidSkin) ?? "retro";
  });

  const changeSkin = (value: ArkanoidSkin) => {
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
    const playerName = user ? (username ?? "INVITADO") : name;
    await insertScore(supabase, {
      gameId: GAME_ID,
      playerName,
      score: finalScore,
      userId: user?.id ?? null,
    });
    if (!user) localStorage.setItem(LAST_PLAYER_NAME_KEY, name);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="hud-stats-row">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {user ? (username ?? "INVITADO") : name}
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
            onChange={(e) => changeSkin(e.target.value as ArkanoidSkin)}
            aria-label="Skin de fondo y HUD"
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
          <ArkanoidGame
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

      <TouchControls directionMode="hold" />

      <div className="landscape-lock">
        <div className="pixel">GIRÁ TU DISPOSITIVO A VERTICAL</div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                {!user && (
                  <input
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toUpperCase().slice(0, 10))
                    }
                    placeholder="TUS INICIALES"
                  />
                )}
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
