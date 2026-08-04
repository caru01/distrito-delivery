import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { Link, useSearchParams } from '../routing';
import { API_URL } from "../config/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.get("token"),
          newPassword: password,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <section className="auth-panel full-auth">
        <form className="auth-card" onSubmit={submit}>
          <img className="reset-logo" src="/logo.png" alt="Distrito BG" />
          <span className="eyebrow">Distrito Delivery</span>
          <h2>Nueva contraseña</h2>
          {error && <div className="alert alert-error">{error}</div>}
          {message ? (
            <>
              <div className="alert alert-success">{message}</div>
              <Link className="button button-primary" to="/login">
                Iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <label>
                Nueva contraseña
                <div className="field">
                  <KeyRound />
                  <input
                    type="password"
                    minLength="10"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </label>
              <button
                className="button button-primary button-large"
                disabled={busy}
              >
                Guardar contraseña
              </button>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
