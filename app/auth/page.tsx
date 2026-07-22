"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type LoginError = "invalid" | "unconfirmed" | "unknown" | null;

function passwordError(pw: string): string | null {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[a-z]/.test(pw)) return "La contraseña debe incluir una minúscula.";
  if (!/[A-Z]/.test(pw)) return "La contraseña debe incluir una mayúscula.";
  if (!/[0-9]/.test(pw)) return "La contraseña debe incluir un dígito.";
  if (!/[^a-zA-Z0-9]/.test(pw)) return "La contraseña debe incluir un símbolo.";
  return null;
}

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");

  // Iniciar sesión
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<LoginError>(null);

  // Crear cuenta
  const [signupUser, setSignupUser] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  const submitLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPass,
    });

    setLoginLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setLoginError("unconfirmed");
      } else if (
        error.message.toLowerCase().includes("invalid login credentials")
      ) {
        setLoginError("invalid");
      } else {
        setLoginError("unknown");
      }
      return;
    }

    router.push("/");
  };

  const submitSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSignupError(null);

    const passErr = passwordError(signupPass);
    if (passErr) {
      setSignupError(passErr);
      return;
    }

    if (signupPass !== signupConfirm) {
      setSignupError("Las contraseñas no coinciden.");
      return;
    }

    setSignupLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPass,
      options: {
        data: { display_name: signupUser.toUpperCase().slice(0, 10) },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSignupLoading(false);

    if (error) {
      setSignupError(error.message);
      return;
    }

    setSignupDone(true);
  };

  const playAsGuest = () => {
    router.push("/");
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {tab === "in" ? (
          <form onSubmit={submitLogin}>
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                required
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div
              style={{ textAlign: "right", marginTop: -4, marginBottom: 12 }}
            >
              <a
                href="/auth/recuperar"
                className="mono"
                style={{ fontSize: 11, color: "var(--cyan)" }}
              >
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {loginError === "invalid" && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--magenta)",
                  marginBottom: 12,
                }}
              >
                ▸ CREDENCIALES INVÁLIDAS_
              </div>
            )}
            {loginError === "unconfirmed" && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--yellow)",
                  marginBottom: 12,
                }}
              >
                ▸ CONFIRMÁ TU EMAIL ANTES DE INICIAR SESIÓN_
              </div>
            )}
            {loginError === "unknown" && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--magenta)",
                  marginBottom: 12,
                }}
              >
                ▸ ERROR AL INICIAR SESIÓN, PROBÁ DE NUEVO_
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loginLoading}
            >
              {loginLoading ? "ENTRANDO…" : "ENTRAR AL VAULT"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitSignup}>
            <div className="field">
              <label>Usuario</label>
              <input
                value={signupUser}
                onChange={(e) => setSignupUser(e.target.value)}
                placeholder="px_kai"
                required
              />
            </div>
            <div className="field slide-in">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                required
              />
            </div>
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={signupPass}
                onChange={(e) => setSignupPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {signupError && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--magenta)",
                  marginBottom: 12,
                }}
              >
                ▸ {signupError.toUpperCase()}_
              </div>
            )}
            {signupDone && (
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--green)",
                  marginBottom: 12,
                }}
              >
                ▸ CUENTA CREADA. REVISÁ TU EMAIL PARA CONFIRMARLA_
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              style={{ width: "100%", marginTop: 8 }}
              disabled={signupLoading}
            >
              {signupLoading ? "CREANDO…" : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          type="button"
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithOAuth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithOAuth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
