import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminPlayers.css";

const CATEGORY_LEVELS = {
  AA: ["AA"],
  A:  ["A+", "A", "A-"],
  B:  ["B+", "B", "B-"],
  C:  ["C+", "C", "C-"],
  D:  ["D+", "D", "D-"],
};

const GENDER_LABELS = {
  male:        "Masculino",
  female:      "Femenino",
  unspecified: "No especificado",
};

function AdminPlayers() {
  const { user, isAdmin } = useAuth();
  const navigate          = useNavigate();

  const [players,    setPlayers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState("");

  // Edición inline
  const [editing,    setEditing]    = useState(null); // { id, category, level, reason }
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState("");
  const [saveOk,     setSaveOk]     = useState("");

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    fetchPlayers();
  }, [isAdmin]);

  async function fetchPlayers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, gender, current_category, current_level, role, no_show_count, suspended_until, suspension_reason, created_at")
      .order("full_name", { ascending: true });

    if (!error) setPlayers(data ?? []);
    setLoading(false);
  }

  // ── Rehabilitar jugador suspendido ──
  async function rehabilitatePlayer(playerId) {
    if (!window.confirm("¿Rehabilitar este jugador? Se elimina la suspensión vigente.")) return;
    const { error } = await supabase.rpc("rehabilitate_player", { p_player_id: playerId });
    if (error) {
      setSaveError("Error al rehabilitar: " + error.message);
      setSaveOk("");
      return;
    }
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, suspended_until: null, suspension_reason: null } : p
      )
    );
    setSaveOk("Jugador rehabilitado correctamente.");
  }

  // ── Filtrado local ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      const matchSearch =
        !q ||
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q);
      const matchCat = !filterCat || p.current_category === filterCat;
      return matchSearch && matchCat;
    });
  }, [players, search, filterCat]);

  // ── Iniciar edición ──
  function startEdit(player) {
    setEditing({
      id:       player.id,
      category: player.current_category ?? "",
      level:    player.current_level    ?? "",
      reason:   "",
    });
    setSaveError("");
    setSaveOk("");
  }

  function cancelEdit() {
    setEditing(null);
    setSaveError("");
  }

  function handleEditChange(field, value) {
    setEditing((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "category" ? { level: "" } : {}),
    }));
  }

  // ── Guardar cambio de categoría (via RPC con auditoría) ──
  async function saveEdit() {
    if (!editing.category) { setSaveError("Seleccioná una categoría."); return; }
    if (!editing.level)    { setSaveError("Seleccioná un nivel.");      return; }

    setSaving(true);
    setSaveError("");
    setSaveOk("");

    const { error } = await supabase.rpc("update_player_category", {
      p_player_id: editing.id,
      p_category:  editing.category,
      p_level:     editing.level,
      p_reason:    editing.reason || null,
    });

    if (error) {
      setSaveError("Error al actualizar: " + error.message);
      setSaving(false);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === editing.id
          ? { ...p, current_category: editing.category, current_level: editing.level }
          : p
      )
    );

    setSaveOk("Cambios guardados.");
    setSaving(false);
    setEditing(null);
  }

  const availableLevels = editing
    ? CATEGORY_LEVELS[editing.category] ?? []
    : [];

  return (
    <main className="admin-players-page section">
      <div className="container">

        {/* Header */}
        <div className="ap-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Gestión de jugadores</h1>
            <p className="section-description">
              Revisá y ajustá la categoría y nivel de los jugadores registrados.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {saveOk && <p className="ap-toast ap-toast-ok">{saveOk}</p>}

        {/* Filtros */}
        <div className="ap-filters card">
          <input
            className="ap-search"
            type="search"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="ap-filter-select"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {Object.keys(CATEGORY_LEVELS).map((cat) => (
              <option key={cat} value={cat}>Categoría {cat}</option>
            ))}
          </select>

          <span className="ap-count">{filtered.length} jugador{filtered.length !== 1 ? "es" : ""}</span>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="ap-loading">Cargando jugadores…</div>
        ) : filtered.length === 0 ? (
          <div className="ap-empty card">No se encontraron jugadores con ese filtro.</div>
        ) : (
          <div className="ap-table-wrap card">
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Contacto</th>
                  <th>Género</th>
                  <th>Categoría</th>
                  <th>Nivel</th>
                  <th>Reputación</th>
                  <th>Rol</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr key={player.id} className={editing?.id === player.id ? "ap-row-editing" : ""}>
                    <td>
                      <span className="ap-player-name">{player.full_name ?? "—"}</span>
                    </td>
                    <td>
                      <span className="ap-email">{player.email}</span>
                      {player.phone && <small className="ap-phone">{player.phone}</small>}
                    </td>
                    <td>
                      <span className="ap-gender">{GENDER_LABELS[player.gender] ?? "—"}</span>
                    </td>

                    {editing?.id === player.id ? (
                      /* ── Edición inline ── */
                      <>
                        <td>
                          <select
                            className="ap-inline-select"
                            value={editing.category}
                            onChange={(e) => handleEditChange("category", e.target.value)}
                          >
                            <option value="">Seleccioná…</option>
                            {Object.keys(CATEGORY_LEVELS).map((cat) => (
                              <option key={cat} value={cat}>Categoría {cat}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="ap-inline-select"
                            value={editing.level}
                            onChange={(e) => handleEditChange("level", e.target.value)}
                            disabled={!editing.category}
                          >
                            <option value="">{editing.category ? "Nivel…" : "Primero categoría"}</option>
                            {availableLevels.map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </td>
                        <td colSpan={3}>
                          <div className="ap-edit-actions">
                            <input
                              className="ap-reason-input"
                              type="text"
                              placeholder="Motivo (opcional)"
                              value={editing.reason}
                              onChange={(e) => handleEditChange("reason", e.target.value)}
                            />
                            {saveError && <span className="ap-save-error">{saveError}</span>}
                            <div className="ap-edit-btns">
                              <button
                                className="btn btn-primary ap-save-btn"
                                onClick={saveEdit}
                                disabled={saving}
                              >
                                {saving ? "Guardando…" : "Guardar"}
                              </button>
                              <button
                                className="btn btn-secondary ap-cancel-btn"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </>
                    ) : (
                      /* ── Vista normal ── */
                      <>
                        <td>
                          <span className={`ap-cat-badge cat-${(player.current_category ?? "").toLowerCase()}`}>
                            {player.current_category ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className="ap-level">{player.current_level ?? "—"}</span>
                        </td>
                        <td>
                          <div className="ap-reputation">
                            {(player.no_show_count ?? 0) > 0 ? (
                              <span className="ap-noshow-badge">
                                {player.no_show_count} no-show{player.no_show_count !== 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="ap-noshow-ok">Sin no-shows</span>
                            )}
                            {player.suspended_until && new Date(player.suspended_until) > new Date() && (
                              <span className="ap-suspended-badge" title={player.suspension_reason ?? ""}>
                                Suspendido
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`ap-role-badge role-${player.role}`}>
                            {player.role === "super_admin" ? "Super Admin"
                              : player.role === "admin"    ? "Admin"
                              : player.role === "coordinator" ? "Coord."
                              : "Jugador"}
                          </span>
                        </td>
                        <td>
                          <div className="ap-action-btns">
                            <button
                              className="ap-edit-btn"
                              onClick={() => startEdit(player)}
                              title="Cambiar categoría/nivel"
                            >
                              Editar
                            </button>
                            {player.suspended_until && new Date(player.suspended_until) > new Date() && (
                              <button
                                className="ap-rehabilitate-btn"
                                onClick={() => rehabilitatePlayer(player.id)}
                                title="Levantar la suspensión"
                              >
                                Rehabilitar
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default AdminPlayers;
