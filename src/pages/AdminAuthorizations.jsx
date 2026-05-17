import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminAuthorizations.css";

const CATEGORIES = ["AA", "A", "B", "C", "D"];

const CATEGORY_ORDER = { AA: 0, A: 1, B: 2, C: 3, D: 4 };

function categoryLabel(code) {
  return `Categoría ${code}`;
}

export default function AdminAuthorizations() {
  const { user, isAdmin } = useAuth();
  const navigate          = useNavigate();

  const [auths,      setAuths]      = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [eventsMap,  setEventsMap]  = useState({});
  const [loading,    setLoading]    = useState(true);

  // ── Grant form ───────────────────────────────────────────────────
  const [search,          setSearch]          = useState("");
  const [searchResults,   setSearchResults]   = useState([]);
  const [selectedPlayer,  setSelectedPlayer]  = useState(null);
  const [category,        setCategory]        = useState("");
  const [expiresAt,       setExpiresAt]       = useState("");
  const [eventId,         setEventId]         = useState("");
  const [notes,           setNotes]           = useState("");
  const [upcomingEvents,  setUpcomingEvents]  = useState([]);
  const [granting,        setGranting]        = useState(false);
  const [grantMsg,        setGrantMsg]        = useState("");

  // ── Revoke ───────────────────────────────────────────────────────
  const [revokingId, setRevokingId] = useState(null);
  const [revokeMsg,  setRevokeMsg]  = useState("");

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    loadData();
    loadUpcomingEvents();
  }, [isAdmin]);

  // Player search debounce
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, current_category, current_level")
        .ilike("full_name", `%${search}%`)
        .eq("role", "player")
        .eq("is_active", true)
        .limit(7);
      setSearchResults(data ?? []);
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("category_promotion_authorizations")
      .select("*")
      .is("revoked_at", null)
      .order("granted_at", { ascending: false });

    const allAuths = data ?? [];
    setAuths(allAuths);

    // Profiles
    const playerIds = [...new Set(allAuths.map((a) => a.player_id))];
    const grantorIds = [...new Set(allAuths.map((a) => a.granted_by))];
    const allIds = [...new Set([...playerIds, ...grantorIds])];

    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, current_category, current_level")
        .in("id", allIds);
      setProfileMap(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])));
    }

    // Events referenced by authorizations
    const evIds = allAuths.map((a) => a.event_id).filter(Boolean);
    if (evIds.length > 0) {
      const { data: evs } = await supabase
        .from("events")
        .select("id, title, starts_at")
        .in("id", evIds);
      setEventsMap(Object.fromEntries((evs ?? []).map((e) => [e.id, e])));
    }

    setLoading(false);
  }, []);

  async function loadUpcomingEvents() {
    const { data } = await supabase
      .from("events")
      .select("id, title, category_code, starts_at")
      .in("status", ["open", "almost_full", "draft"])
      .order("starts_at", { ascending: true })
      .limit(30);
    setUpcomingEvents(data ?? []);
  }

  async function handleGrant() {
    if (!selectedPlayer || !category) {
      setGrantMsg("❌ Seleccioná un jugador y una categoría.");
      return;
    }
    setGranting(true); setGrantMsg("");
    const { error } = await supabase.rpc("grant_category_authorization", {
      p_player_id:  selectedPlayer.id,
      p_category:   category,
      p_expires_at: expiresAt || null,
      p_event_id:   eventId   || null,
      p_notes:      notes     || null,
    });
    if (error) {
      setGrantMsg("❌ " + error.message);
    } else {
      setGrantMsg("✅ Autorización otorgada.");
      setSearch(""); setSelectedPlayer(null); setCategory("");
      setExpiresAt(""); setEventId(""); setNotes("");
      await loadData();
    }
    setGranting(false);
  }

  async function handleRevoke(authId) {
    if (!window.confirm("¿Revocar esta autorización?")) return;
    setRevokingId(authId); setRevokeMsg("");
    const { error } = await supabase.rpc("revoke_category_authorization", {
      p_auth_id: authId,
    });
    if (error) setRevokeMsg("❌ " + error.message);
    else       await loadData();
    setRevokingId(null);
  }

  // Suggest categories above player's current
  const eligibleCategories = selectedPlayer
    ? CATEGORIES.filter(
        (c) => CATEGORY_ORDER[c] < (CATEGORY_ORDER[selectedPlayer.current_category] ?? 99),
      )
    : CATEGORIES;

  return (
    <main className="auth-admin-page section">
      <div className="container">

        <div className="auth-admin-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Autorizaciones de categoría</h1>
            <p className="section-description">
              Permitís a jugadores inscribirse en eventos de una categoría superior a la propia,
              de forma puntual (un evento) o por tiempo.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {revokeMsg && <p className="auth-admin-toast auth-admin-toast-err">{revokeMsg}</p>}

        <div className="auth-admin-layout">

          {/* ── Formulario de nueva autorización ── */}
          <section className="card auth-admin-form-card">
            <p className="section-kicker">Nueva autorización</p>
            <h2>Otorgar acceso a categoría superior</h2>

            {/* Player search */}
            <div className="aa-field">
              <label>Jugador *</label>
              <div className="aa-search-wrap">
                <input
                  type="search"
                  className="aa-input"
                  placeholder="Buscá por nombre…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedPlayer(null); }}
                />
                {searchResults.length > 0 && !selectedPlayer && (
                  <ul className="aa-search-results">
                    {searchResults.map((p) => (
                      <li
                        key={p.id}
                        className="aa-search-item"
                        onClick={() => {
                          setSelectedPlayer(p);
                          setSearch(p.full_name);
                          setSearchResults([]);
                          setCategory("");
                        }}
                      >
                        <strong>{p.full_name}</strong>
                        <small>{p.email} · Cat. {p.current_category ?? "—"} {p.current_level ?? ""}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selectedPlayer && (
                <div className="aa-selected-player">
                  <span>
                    ✅ <strong>{selectedPlayer.full_name}</strong>
                    {" "}— actualmente en{" "}
                    <strong>Cat. {selectedPlayer.current_category ?? "sin asignar"} {selectedPlayer.current_level ?? ""}</strong>
                  </span>
                  <button className="aa-clear-btn" onClick={() => { setSelectedPlayer(null); setSearch(""); setCategory(""); }}>✕</button>
                </div>
              )}
            </div>

            {/* Categoría autorizada */}
            <div className="aa-field">
              <label>Categoría autorizada *</label>
              <select
                className="aa-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Seleccioná…</option>
                {eligibleCategories.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c)}</option>
                ))}
              </select>
              {selectedPlayer && eligibleCategories.length === 0 && (
                <small className="aa-note-err">
                  Este jugador ya está en la categoría más alta (AA).
                </small>
              )}
            </div>

            <div className="aa-grid-2">
              {/* Tipo: hasta fecha o puntual */}
              <div className="aa-field">
                <label>Vence (opcional)</label>
                <input
                  type="date"
                  className="aa-input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                <small className="aa-hint">Dejá vacío para autorización sin vencimiento.</small>
              </div>

              {/* Evento puntual */}
              <div className="aa-field">
                <label>Solo para un evento (opcional)</label>
                <select
                  className="aa-input"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <option value="">Cualquier evento de esa categoría</option>
                  {upcomingEvents
                    .filter((e) => !category || e.category_code === category)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} · Cat. {e.category_code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Notas */}
            <div className="aa-field">
              <label>Notas internas (opcional)</label>
              <input
                type="text"
                className="aa-input"
                placeholder="Motivo de la autorización…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
              />
            </div>

            {grantMsg && (
              <p className={`aa-msg ${grantMsg.startsWith("✅") ? "aa-msg-ok" : "aa-msg-err"}`}>
                {grantMsg}
              </p>
            )}

            <button
              className="btn btn-primary"
              onClick={handleGrant}
              disabled={granting || !selectedPlayer || !category}
            >
              {granting ? "Guardando…" : "Otorgar autorización"}
            </button>
          </section>

          {/* ── Lista de autorizaciones activas ── */}
          <section className="card auth-admin-list-card">
            <p className="section-kicker">Activas</p>
            <h2>Autorizaciones vigentes</h2>

            {loading ? (
              <p className="aa-empty">Cargando…</p>
            ) : auths.length === 0 ? (
              <p className="aa-empty">No hay autorizaciones activas.</p>
            ) : (
              <div className="aa-auth-list">
                {auths.map((auth) => {
                  const player  = profileMap[auth.player_id];
                  const grantor = profileMap[auth.granted_by];
                  const event   = auth.event_id ? eventsMap[auth.event_id] : null;
                  const expired = auth.expires_at && new Date(auth.expires_at) < new Date();

                  return (
                    <div key={auth.id} className={`aa-auth-card ${expired ? "aa-auth-expired" : ""}`}>
                      <div className="aa-auth-top">
                        <div>
                          <strong className="aa-auth-player">{player?.full_name ?? "—"}</strong>
                          <span className="aa-auth-current">
                            Cat. {player?.current_category ?? "—"} → autorizado en{" "}
                            <strong className="aa-cat-badge">{auth.authorized_category}</strong>
                          </span>
                        </div>
                        {expired ? (
                          <span className="aa-badge aa-badge-expired">Vencida</span>
                        ) : (
                          <span className="aa-badge aa-badge-active">Activa</span>
                        )}
                      </div>

                      <div className="aa-auth-meta">
                        {auth.expires_at ? (
                          <span>⏳ Vence: {new Date(auth.expires_at).toLocaleDateString("es-CR")}</span>
                        ) : (
                          <span>⏳ Sin vencimiento</span>
                        )}
                        {event && <span>📅 Solo para: {event.title}</span>}
                        {auth.notes && <span>📝 {auth.notes}</span>}
                        <span className="aa-auth-grantor">Otorgada por {grantor?.full_name ?? "admin"}</span>
                      </div>

                      <button
                        className="aa-revoke-btn"
                        onClick={() => handleRevoke(auth.id)}
                        disabled={revokingId === auth.id}
                      >
                        {revokingId === auth.id ? "Revocando…" : "Revocar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
