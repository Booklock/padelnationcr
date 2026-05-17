import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { formatEventDate } from "../utils/formatters";
import "./AdminExclusions.css";

/**
 * Sugiere cuántos resultados excluir según eventos jugados.
 * Regla: ≥4 eventos → excluir 1 peor · ≥8 eventos → excluir 2 peores
 */
function getSuggestedCount(totalResults) {
  if (totalResults >= 8) return 2;
  if (totalResults >= 4) return 1;
  return 0;
}

export default function AdminExclusions() {
  const { isAdmin } = useAuth();
  const navigate    = useNavigate();

  const [playerData,  setPlayerData]  = useState([]); // [{ profile, results }]
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState({}); // { [playerId]: bool }
  const [toggling,    setToggling]    = useState(null); // result id being toggled
  const [actionMsg,   setActionMsg]   = useState({ id: null, text: "" });
  const [filterMode,  setFilterMode]  = useState("all"); // "all" | "suggested" | "excluded"

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);

    // Todos los resultados de jugadores activos
    const { data: results } = await supabase
      .from("player_event_results")
      .select(`
        id, player_id, points_earned, excluded,
        excluded_reason, excluded_at,
        events(id, title, starts_at, category_code)
      `)
      .order("points_earned", { ascending: true });

    if (!results || results.length === 0) {
      setPlayerData([]);
      setLoading(false);
      return;
    }

    // Agrupar por jugador
    const byPlayer = {};
    results.forEach((r) => {
      if (!byPlayer[r.player_id]) byPlayer[r.player_id] = [];
      byPlayer[r.player_id].push(r);
    });

    // Perfiles
    const playerIds = Object.keys(byPlayer);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, current_category, current_level")
      .in("id", playerIds)
      .eq("is_active", true)
      .order("full_name");

    const data = (profiles ?? []).map((profile) => ({
      profile,
      results: (byPlayer[profile.id] ?? []).sort(
        (a, b) => a.points_earned - b.points_earned,
      ),
    }));

    setPlayerData(data);
    setLoading(false);
  }

  // IDs de resultados sugeridos para excluir (peores N no excluidos)
  const suggestedIds = useMemo(() => {
    const ids = new Set();
    playerData.forEach(({ results }) => {
      const n = getSuggestedCount(results.length);
      results
        .filter((r) => !r.excluded)
        .slice(0, n)
        .forEach((r) => ids.add(r.id));
    });
    return ids;
  }, [playerData]);

  // Filtrado de jugadores según modo
  const filteredPlayers = useMemo(() => {
    if (filterMode === "all") return playerData;
    if (filterMode === "suggested") {
      return playerData.filter(({ results }) =>
        results.some((r) => suggestedIds.has(r.id)),
      );
    }
    if (filterMode === "excluded") {
      return playerData.filter(({ results }) =>
        results.some((r) => r.excluded),
      );
    }
    return playerData;
  }, [playerData, filterMode, suggestedIds]);

  async function handleToggle(result, exclude) {
    setToggling(result.id);
    setActionMsg({ id: null, text: "" });

    const reason = exclude
      ? (suggestedIds.has(result.id) ? "worst_n_auto" : "manual")
      : null;

    const { error } = await supabase.rpc("set_result_exclusion", {
      p_result_id: result.id,
      p_excluded:  exclude,
      p_reason:    reason,
    });

    if (error) {
      setActionMsg({ id: result.id, text: "❌ " + error.message });
    } else {
      // Actualizar localmente sin recargar todo
      setPlayerData((prev) =>
        prev.map(({ profile, results }) => ({
          profile,
          results: results.map((r) =>
            r.id === result.id
              ? { ...r, excluded: exclude, excluded_reason: reason }
              : r,
          ),
        })),
      );
    }
    setToggling(null);
  }

  // Stats globales
  const totalResults   = playerData.reduce((s, p) => s + p.results.length, 0);
  const totalExcluded  = playerData.reduce((s, p) => s + p.results.filter((r) => r.excluded).length, 0);
  const totalSuggested = suggestedIds.size;

  return (
    <main className="excl-page section">
      <div className="container">

        <div className="excl-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Exclusiones de ranking</h1>
            <p className="section-description">
              El sistema sugiere los peores resultados de cada jugador.
              Confirmá o descartá manualmente. Los resultados excluidos no
              cuentan en el ranking pero siguen visibles.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {/* Stats */}
        <div className="excl-stats-row">
          <div className="excl-stat card">
            <span>Total resultados</span>
            <strong>{totalResults}</strong>
          </div>
          <div className="excl-stat card">
            <span>Excluidos</span>
            <strong>{totalExcluded}</strong>
          </div>
          <div className="excl-stat card excl-stat-suggested">
            <span>Sugeridos pendientes</span>
            <strong>{totalSuggested}</strong>
          </div>
        </div>

        {/* Filtros */}
        <div className="excl-filters card">
          {[
            { key: "all",       label: "Todos los jugadores" },
            { key: "suggested", label: `Con sugerencias (${totalSuggested})` },
            { key: "excluded",  label: `Con excluidos (${totalExcluded})` },
          ].map((f) => (
            <button
              key={f.key}
              className={`filter-pill ${filterMode === f.key ? "active" : ""}`}
              onClick={() => setFilterMode(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de jugadores */}
        {loading ? (
          <div className="empty-state card"><p>Cargando resultados…</p></div>
        ) : filteredPlayers.length === 0 ? (
          <div className="empty-state card"><p>No hay jugadores con ese filtro.</p></div>
        ) : (
          <div className="excl-player-list">
            {filteredPlayers.map(({ profile, results }) => {
              const excluded   = results.filter((r) => r.excluded).length;
              const suggested  = results.filter((r) => suggestedIds.has(r.id)).length;
              const isOpen     = expanded[profile.id] ?? false;
              const totalPts   = results.filter((r) => !r.excluded).reduce((s, r) => s + r.points_earned, 0);

              return (
                <div key={profile.id} className="excl-player-card card">

                  {/* Cabecera del jugador */}
                  <button
                    className="excl-player-header"
                    onClick={() => setExpanded((prev) => ({ ...prev, [profile.id]: !isOpen }))}
                  >
                    <div className="excl-player-info">
                      <strong>{profile.full_name}</strong>
                      <span>Cat. {profile.current_category ?? "—"} {profile.current_level ?? ""}</span>
                    </div>

                    <div className="excl-player-badges">
                      <span className="excl-badge excl-badge-total">{results.length} resultados</span>
                      {suggested > 0 && (
                        <span className="excl-badge excl-badge-suggested">⚠️ {suggested} sugerido{suggested > 1 ? "s" : ""}</span>
                      )}
                      {excluded > 0 && (
                        <span className="excl-badge excl-badge-excluded">{excluded} excluido{excluded > 1 ? "s" : ""}</span>
                      )}
                      <span className="excl-pts-total">{totalPts} pts netos</span>
                    </div>

                    <span className="excl-chevron">{isOpen ? "▲" : "▼"}</span>
                  </button>

                  {/* Resultados expandidos */}
                  {isOpen && (
                    <div className="excl-results-list">
                      <div className="excl-results-head">
                        <span>Evento</span>
                        <span>Fecha</span>
                        <span>Puntos</span>
                        <span>Estado</span>
                        <span></span>
                      </div>

                      {results.map((r) => {
                        const isSuggested = suggestedIds.has(r.id);
                        const isToggling  = toggling === r.id;

                        return (
                          <div
                            key={r.id}
                            className={`excl-result-row
                              ${r.excluded   ? "excl-row-excluded"  : ""}
                              ${isSuggested  ? "excl-row-suggested" : ""}
                            `}
                          >
                            <span className="excl-event-name">
                              {r.events?.title ?? "Evento"}
                              <small>{r.events?.category_code}</small>
                            </span>
                            <span className="excl-date">
                              {r.events?.starts_at ? formatEventDate(r.events.starts_at) : "—"}
                            </span>
                            <strong className={r.excluded ? "excl-pts-grey" : "excl-pts-green"}>
                              {r.excluded ? "—" : `+${r.points_earned}`}
                              {r.excluded && <span className="excl-original"> ({r.points_earned})</span>}
                            </strong>
                            <span>
                              {r.excluded ? (
                                <span className="excl-status-excluded">
                                  Excluido
                                  {r.excluded_reason === "worst_n_auto" ? " (auto)" : " (manual)"}
                                </span>
                              ) : isSuggested ? (
                                <span className="excl-status-suggested">Sugerido</span>
                              ) : (
                                <span className="excl-status-ok">Contando</span>
                              )}
                            </span>
                            <div className="excl-action">
                              {actionMsg.id === r.id && (
                                <span className="excl-action-err">{actionMsg.text}</span>
                              )}
                              {r.excluded ? (
                                <button
                                  className="excl-btn excl-btn-include"
                                  onClick={() => handleToggle(r, false)}
                                  disabled={isToggling}
                                >
                                  {isToggling ? "…" : "Incluir"}
                                </button>
                              ) : (
                                <button
                                  className={`excl-btn ${isSuggested ? "excl-btn-confirm" : "excl-btn-exclude"}`}
                                  onClick={() => handleToggle(r, true)}
                                  disabled={isToggling}
                                >
                                  {isToggling ? "…" : isSuggested ? "Confirmar" : "Excluir"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
