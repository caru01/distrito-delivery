import React, { useContext, useEffect, useState } from "react";
import {
  KeyRound,
  Laptop,
  LogOut,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { apiFetch, clearCredentials } from "../services/api";
import { dateTime } from "../utils/format";

export default function Profile() {
  const { profile, refreshProfile, logout, verify, user } =
    useContext(AuthContext);
  const [form, setForm] = useState({});
  const [sessions, setSessions] = useState([]);
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile)
      setForm({
        phone: profile.phone || "",
        email: profile.email || "",
        photoUrl: profile.photo_url || "",
        vehicleName: profile.vehicle_name || "",
        vehicleType: profile.vehicle_type || "",
        plate: profile.plate || "",
        documents: profile.documents || {},
      });
  }, [profile]);
  const loadSessions = () =>
    apiFetch("/admin/profile/sessions")
      .then((data) => setSessions(data.data))
      .catch((err) => setError(err.message));
  useEffect(loadSessions, []);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/delivery/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      await refreshProfile();
      setMessage("Perfil actualizado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const savePassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/delivery/profile", {
        method: "PUT",
        body: JSON.stringify({ ...form, ...password }),
      });
      setPassword({ currentPassword: "", newPassword: "" });
      await verify();
      setMessage("Contraseña actualizada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const closeSession = async (session) => {
    try {
      const data = await apiFetch(`/admin/profile/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (data.was_current) {
        clearCredentials();
        window.location.assign("/login");
        return;
      }
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };
  const doc = (key, value) =>
    setForm({
      ...form,
      documents: { ...(form.documents || {}), [key]: value },
    });
  return (
    <div className="page-content">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Cuenta y operación</span>
          <h1>Mi perfil</h1>
          <p>Actualiza tus datos, vehículo y dispositivos con sesión activa.</p>
        </div>
        <button className="button button-ghost" onClick={logout}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </section>
      {user?.must_change_password && (
        <div className="alert alert-error">Debes cambiar la contraseña temporal antes de continuar.</div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}
      <div className="profile-grid">
        <form className="panel profile-form" onSubmit={save}>
          <div className="panel-title">
            <div>
              <span className="eyebrow">Datos personales</span>
              <h2>Información y vehículo</h2>
            </div>
            <User />
          </div>
          <div className="form-grid">
            <label>
              Teléfono
              <input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="full">
              URL de fotografía
              <input
                type="url"
                value={form.photoUrl || ""}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label>
              Vehículo
              <input
                value={form.vehicleName || ""}
                onChange={(e) =>
                  setForm({ ...form, vehicleName: e.target.value })
                }
                placeholder="Ej. AKT 125"
              />
            </label>
            <label>
              Tipo
              <select
                value={form.vehicleType || ""}
                onChange={(e) =>
                  setForm({ ...form, vehicleType: e.target.value })
                }
              >
                <option value="">Seleccionar</option>
                <option>Moto</option>
                <option>Bicicleta</option>
                <option>Automóvil</option>
                <option>A pie</option>
              </select>
            </label>
            <label>
              Placa
              <input
                value={form.plate || ""}
                onChange={(e) =>
                  setForm({ ...form, plate: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              Licencia / documento
              <input
                value={form.documents?.license || ""}
                onChange={(e) => doc("license", e.target.value)}
              />
            </label>
            <label>
              Vence documento
              <input
                type="date"
                value={form.documents?.licenseExpiry || ""}
                onChange={(e) => doc("licenseExpiry", e.target.value)}
              />
            </label>
            <label>
              SOAT / seguro
              <input
                value={form.documents?.insurance || ""}
                onChange={(e) => doc("insurance", e.target.value)}
              />
            </label>
          </div>
          <button className="button button-primary" disabled={busy}>
            <Save size={18} /> Guardar perfil
          </button>
        </form>
        <div className="profile-side">
          <form className="panel profile-form" onSubmit={savePassword}>
            <div className="panel-title">
              <div>
                <span className="eyebrow">Seguridad</span>
                <h2>Cambiar contraseña</h2>
              </div>
              <KeyRound />
            </div>
            <label>
              Contraseña actual
              <input
                type="password"
                required
                value={password.currentPassword}
                onChange={(e) =>
                  setPassword({ ...password, currentPassword: e.target.value })
                }
              />
            </label>
            <label>
              Nueva contraseña
              <input
                type="password"
                minLength="10"
                required
                value={password.newPassword}
                onChange={(e) =>
                  setPassword({ ...password, newPassword: e.target.value })
                }
              />
            </label>
            <button className="button button-ghost" disabled={busy}>
              <ShieldCheck size={18} /> Actualizar contraseña
            </button>
          </form>
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Máximo 3</span>
                <h2>Dispositivos activos</h2>
              </div>
              <Smartphone />
            </div>
            <div className="sessions-list">
              {sessions.map((session) => (
                <div
                  className={`session-row ${session.status !== "Activa" ? "inactive" : ""}`}
                  key={session.id}
                >
                  <span>
                    {/móvil|android|iphone/i.test(
                      `${session.device_name} ${session.os}`,
                    ) ? (
                      <Smartphone />
                    ) : (
                      <Laptop />
                    )}
                  </span>
                  <div>
                    <b>
                      {session.device_name ||
                        `${session.browser} · ${session.os}`}
                    </b>
                    <small>
                      {session.status} · {dateTime(session.last_active)}
                    </small>
                    {session.is_current && <em>Este dispositivo</em>}
                  </div>
                  {session.status === "Activa" && (
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => closeSession(session)}
                      title="Cerrar sesión"
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
