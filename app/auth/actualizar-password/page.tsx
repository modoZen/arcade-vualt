"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (pass !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            DEFINÍ TU NUEVA CONTRASEÑA DE ACCESO
          </div>
        </div>

        {!done ? (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
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
              {loading ? "GUARDANDO…" : "GUARDAR NUEVA CONTRASEÑA"}
            </button>
          </form>
        ) : (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--green)", textAlign: "center" }}
          >
            ▸ CONTRASEÑA ACTUALIZADA. REDIRIGIENDO…_
          </div>
        )}
      </div>
    </div>
  );
}
