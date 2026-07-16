"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getGames } from "@/lib/supabase/games";
import { getTopScoresByGame, getTopScoresGlobal } from "@/lib/supabase/scores";
import type { Game, ScoreRow } from "@/lib/supabase/types";

const GLOBAL_TAB = "GLOBAL";

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export default function HallOfFamePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [tab, setTab] = useState<string>(GLOBAL_TAB);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    getGames(supabase).then(setGames);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const request =
      tab === GLOBAL_TAB
        ? getTopScoresGlobal(supabase, 10)
        : getTopScoresByGame(supabase, tab, 10);
    request.then(setRows).finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        <button
          className={"chip" + (tab === GLOBAL_TAB ? " active" : "")}
          onClick={() => setTab(GLOBAL_TAB)}
        >
          GLOBAL
        </button>
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          className="mono"
          style={{ textAlign: "center", padding: 60, color: "var(--ink-dim)" }}
        >
          CARGANDO…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="pixel"
          style={{
            textAlign: "center",
            padding: 60,
            color: "var(--ink-faint)",
          }}
        >
          SÉ EL PRIMERO EN ENTRAR AL SALÓN DE LA FAMA
        </div>
      ) : (
        <>
          {rows.length >= 3 && (
            <div className="podium">
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].player_name}</div>
                {tab === GLOBAL_TAB && rows[1].game && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--cyan)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {rows[1].game.title}
                  </div>
                )}
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[1].created_at)}</div>
              </div>
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].player_name}</div>
                {tab === GLOBAL_TAB && rows[0].game && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--cyan)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {rows[0].game.title}
                  </div>
                )}
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[0].created_at)}</div>
              </div>
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].player_name}</div>
                {tab === GLOBAL_TAB && rows[2].game && (
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--cyan)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {rows[2].game.title}
                  </div>
                )}
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[2].created_at)}</div>
              </div>
            </div>
          )}

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">
                  {r.player_name}
                  {tab === GLOBAL_TAB && r.game && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--ink-faint)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      {r.game.title}
                    </div>
                  )}
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{formatDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
