"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/actualizar-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">RECUPERAR ACCESO</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            TE ENVIAMOS UN LINK PARA RESETEAR TU CONTRASEÑA
          </div>
        </div>

        {!sent ? (
          <form onSubmit={submit}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                required
              />
            </div>

            {error && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--magenta)",
                  marginBottom: 12,
                }}
              >
                ▸ {error.toUpperCase()}_
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              {loading ? "ENVIANDO…" : "ENVIAR LINK DE RECUPERACIÓN"}
            </button>
          </form>
        ) : (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--green)", textAlign: "center" }}
          >
            ▸ REVISÁ TU EMAIL PARA CONTINUAR_
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link
            href="/auth"
            className="mono"
            style={{ fontSize: 11, color: "var(--cyan)" }}
          >
            ← VOLVER A INICIAR SESIÓN
          </Link>
        </div>
      </div>
    </div>
  );
}
