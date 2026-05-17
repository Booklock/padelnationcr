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
      .select("id, full_name, email, phone, gender, current_category, current_level, role, created_at")
      .order("full_name", { ascending: true });

    if (!error) setPlayers(data ?? []);
    setLoading(false);
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

  // ── Guardar cambio de categoría ──
  async function saveEdit() {
    if (!editing.category) { setSaveError("Seleccioná una categoría."); return; }
    if (!editing.level)    { setSaveError("Seleccioná un nivel.");      return; }

    setSaving(true);
    setSaveError("");
    setSaveOk("");

    // 1. Actualizar profiles
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        current_category: editing.category,
        current_level:    editing.level,
      })
      .eq("id", editing.id);

    if (profileErr) {
      setSaveError("Error al actualizar: " + profileErr.message);
      setSaving(false);
      return;
    }

    // 2. Registrar en historial
    const player = players.find((p) => p.id === editing.id);
    const changed = player?.current_category !== editing.category ||
                    player?.current_level    !== editing.level;

    if (changed) {
      await supabase.from("player_category_history").insert({
        player_id:     editing.id,
        category_code: editing.category,
        level_code:    editing.level,
        decided_by:    user.id,
        reason:        editing.reason || null,
        started_at:    new Date().toISOString(),
      });
    }

    // 3. Refrescar lista local
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
                        <td colSpan={2}>
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
                          <span className={`ap-role-badge role-${player.role}`}>
                            {player.role === "super_admin" ? "Super Admin"
                              : player.role === "admin"    ? "Admin"
                              : player.role === "coordinator" ? "Coord."
                              : "Jugador"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="ap-edit-btn"
                            onClick={() => startEdit(player)}
                            title="Cambiar categoría/nivel"
                          >
                            Editar
                          </button>
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
