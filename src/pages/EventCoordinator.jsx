import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEvent, useEventPlayers, useEventAttendance } from "../hooks/useEvents";
import { FORMAT_LABELS, GENDER_FILTER_LABELS, GENDER_FILTER_CLASS } from "../utils/formatters";
import "./EventCoordinator.css";

/* ─────────────────────────────────────────────────────────────
   Helpers de desempate
   Orden: pts evento → victorias → empates → head-to-head → diff general
───────────────────────────────────────────────────────────── */

function headToHeadDiff(playerA, playerB, savedMatches) {
  let diff = 0;
  for (const match of savedMatches) {
    const aInA = match.teamA.some((p) => p.id === playerA.id);
    const aInB = match.teamB.some((p) => p.id === playerA.id);
    const bInA = match.teamA.some((p) => p.id === playerB.id);
    const bInB = match.teamB.some((p) => p.id === playerB.id);
    if ((aInA && bInB) || (aInB && bInA)) {
      const aScore = aInA ? Number(match.teamAScore) : Number(match.teamBScore);
      const bScore = bInA ? Number(match.teamAScore) : Number(match.teamBScore);
      diff += aScore - bScore;
    }
  }
  return diff;
}

function compareStandings(a, b, savedMatches) {
  if (b.eventPoints !== a.eventPoints) return b.eventPoints - a.eventPoints;
  if (b.wins        !== a.wins)        return b.wins        - a.wins;
  if (b.ties        !== a.ties)        return b.ties        - a.ties;
  const h2h  = headToHeadDiff(a, b, savedMatches);
  if (h2h !== 0) return -h2h;
  return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
}

function calcStandings(basePlayers, savedMatches) {
  return basePlayers.map((player) => {
    let pts = 0, pj = 0, pg = 0, pe = 0, pp = 0, pf = 0, pa = 0;
    for (const match of savedMatches) {
      const inA = match.teamA.some((p) => p.id === player.id);
      const inB = match.teamB.some((p) => p.id === player.id);
      if (!inA && !inB) continue;
      const myScore  = inA ? Number(match.teamAScore) : Number(match.teamBScore);
      const oppScore = inA ? Number(match.teamBScore) : Number(match.teamAScore);
      pts += myScore; pf += myScore; pa += oppScore; pj++;
      if      (myScore > oppScore)   pg++;
      else if (myScore === oppScore) pe++;
      else                           pp++;
    }
    return { ...player, eventPoints: pts, matchesPlayed: pj, wins: pg, ties: pe, losses: pp, pointsFor: pf, pointsAgainst: pa };
  });
}

function dbMatchToLocal(dbMatch, playersList) {
  const find    = (uid) => playersList.find((p) => p.id === uid) ?? { id: uid, name: "Jugador", level: "?" };
  const localId = `${dbMatch.round_number}-${dbMatch.court_number}`;
  return {
    id: localId, dbId: dbMatch.id,
    roundNumber: dbMatch.round_number, courtNumber: dbMatch.court_number,
    teamA: (dbMatch.team_a_player_ids ?? []).map(find),
    teamB: (dbMatch.team_b_player_ids ?? []).map(find),
    teamAScore: dbMatch.team_a_score ?? "", teamBScore: dbMatch.team_b_score ?? "",
    status:    dbMatch.status === "finished" ? "Finalizado" : "Pendiente",
    isSaved:   dbMatch.status === "finished",
    isEditing: false,
  };
}

/* ─────────────────────────────────────────────────────────────
   Componente
───────────────────────────────────────────────────────────── */

function EventCoordinator() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { event, pointRules, loading: eventLoading }                   = useEvent(id);
  const { players: registeredPlayers, loading: playersLoading }          = useEventPlayers(id);
  const { registrations: attendanceRegs, loading: attendanceLoading, refetch: refetchAttendance } = useEventAttendance(id);

  const [currentRound,   setCurrentRound]   = useState(0);   // 0 = ninguna ronda generada aún
  const [players,        setPlayers]        = useState([]);
  const [matches,        setMatches]        = useState([]);
  const [matchHistory,   setMatchHistory]   = useState([]);
  const [initialized,    setInitialized]    = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [generatingRound,setGeneratingRound]= useState(false);
  const [finalizing,     setFinalizing]     = useState(false);
  const [cancelling,     setCancelling]     = useState(false);
  const [markingNoShow,  setMarkingNoShow]  = useState(null); // registrationId en proceso
  const [actionError,    setActionError]    = useState(null);

  /* ── Mapa posición → puntos de ranking ─────────────────── */
  const pointsMap = useMemo(() => {
    const map = {};
    for (const r of pointRules) map[r.position] = r.points;
    return map;
  }, [pointRules]);

  /* ── Carga de partidos desde DB ─────────────────────────── */
  const loadMatchesFromDB = useCallback(async () => {
    const { data: dbMatches = [] } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", id)
      .order("round_number", { ascending: true })
      .order("court_number", { ascending: true });

    if (!dbMatches.length) {
      // Sin partidos: estado inicial
      setPlayers(registeredPlayers);
      setMatches([]);
      setMatchHistory([]);
      setCurrentRound(0);
      return;
    }

    const finishedDb   = dbMatches.filter((m) => m.status === "finished");
    const historyLocal = finishedDb.map((m) => dbMatchToLocal(m, registeredPlayers));
    const standings    = calcStandings(registeredPlayers, historyLocal);
    const maxRound     = Math.max(...dbMatches.map((m) => m.round_number));
    const currentInDb  = dbMatches.filter((m) => m.round_number === maxRound);

    setMatchHistory(historyLocal);
    setPlayers(standings);
    setCurrentRound(maxRound);
    setMatches(currentInDb.map((m) => dbMatchToLocal(m, registeredPlayers)));
  }, [id, registeredPlayers]);

  /* ── Inicialización ─────────────────────────────────────── */
  useEffect(() => {
    if (playersLoading || initialized || !id) return;
    loadMatchesFromDB().then(() => setInitialized(true));
  }, [registeredPlayers, playersLoading, initialized, id, loadMatchesFromDB]);

  /* ── Standings ordenados ────────────────────────────────── */
  const savedMatches  = useMemo(() => matchHistory.filter((m) => m.isSaved), [matchHistory]);
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => compareStandings(a, b, savedMatches)),
    [players, savedMatches],
  );

  /* ── Handlers de partidos ───────────────────────────────── */
  function handleScoreChange(matchId, field, value) {
    setMatches((cur) => cur.map((m) => (m.id === matchId ? { ...m, [field]: value } : m)));
  }

  async function handleSaveResult(matchId) {
    const match  = matches.find((m) => m.id === matchId);
    if (!match) return;

    const aScore = Number(match.teamAScore);
    const bScore = Number(match.teamBScore);

    if (match.teamAScore === "" || match.teamBScore === "" || isNaN(aScore) || isNaN(bScore)) {
      setActionError("Ingresá ambos resultados antes de guardar.");
      return;
    }

    setSaving(true);
    try {
      const { error: matchErr } = await supabase
        .from("matches")
        .upsert(
          {
            event_id: id, round_number: currentRound, court_number: match.courtNumber,
            team_a_player_ids: match.teamA.map((p) => p.id),
            team_b_player_ids: match.teamB.map((p) => p.id),
            team_a_score: aScore, team_b_score: bScore,
            status: "finished", finished_at: new Date().toISOString(),
          },
          { onConflict: "event_id,round_number,court_number" },
        );
      if (matchErr) throw matchErr;

      const savedMatch   = { ...match, teamAScore: aScore, teamBScore: bScore, status: "Finalizado", isSaved: true, isEditing: false };
      const newMatches   = matches.map((m) => (m.id === matchId ? savedMatch : m));
      const newHistory   = [...matchHistory.filter((m) => m.id !== matchId), savedMatch];
      const newStandings = calcStandings(registeredPlayers, newHistory);

      setMatches(newMatches);
      setMatchHistory(newHistory);
      setPlayers(newStandings);

      // Persistir stats parciales de jugadores
      const active = newStandings.filter((p) => p.matchesPlayed > 0);
      if (active.length > 0) {
        await supabase.from("player_event_results").upsert(
          active.map((p) => ({
            event_id: id, player_id: p.id,
            points_earned: 0, wins: p.wins, ties: p.ties, losses: p.losses,
            points_for: p.pointsFor, points_against: p.pointsAgainst,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "event_id,player_id" },
        );
      }
    } catch (err) {
      setActionError("Error al guardar resultado: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditResult(matchId) {
    const newMatches = matches.map((m) => m.id === matchId ? { ...m, status: "Editando", isSaved: false, isEditing: true } : m);
    const newHistory = matchHistory.filter((m) => m.id !== matchId);
    setMatches(newMatches);
    setMatchHistory(newHistory);
    setPlayers(calcStandings(registeredPlayers, newHistory));
  }

  /* ── Generar ronda (llama al backend) ───────────────────── */
  async function handleGenerateRound() {
    if (matches.length > 0 && matches.some((m) => !m.isSaved)) {
      setActionError("Guardá todos los resultados antes de generar la siguiente ronda.");
      return;
    }
    setActionError(null);
    setGeneratingRound(true);
    try {
      const { error } = await supabase.rpc("generate_round", { p_event_id: id });
      if (error) throw error;
      await loadMatchesFromDB();
    } catch (err) {
      setActionError("Error al generar la ronda: " + err.message);
    } finally {
      setGeneratingRound(false);
    }
  }

  /* ── Marcar / desmarcar no-show ────────────────────────── */
  async function handleToggleNoShow(regId, currentValue) {
    setMarkingNoShow(regId);
    setActionError(null);
    try {
      const { data, error } = await supabase.rpc("mark_no_show", {
        p_registration_id: regId,
        p_is_no_show:      !currentValue,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchAttendance();
    } catch (err) {
      setActionError("Error al marcar asistencia: " + err.message);
    } finally {
      setMarkingNoShow(null);
    }
  }

  /* ── Cancelar evento ───────────────────────────────────── */
  async function handleCancelEvent() {
    const confirmed = window.confirm(
      "¿Cancelar este evento?\n\nTodas las inscripciones activas serán canceladas. Esta acción no se puede deshacer."
    );
    if (!confirmed) return;
    const reason = window.prompt("Motivo de cancelación (opcional):");
    if (reason === null) return;

    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc("cancel_event", {
        p_event_id: id,
        p_reason:   reason.trim() || null,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      navigate("/admin");
    } catch (err) {
      setActionError("Error al cancelar el evento: " + err.message);
    } finally {
      setCancelling(false);
    }
  }

  /* ── Finalizar evento ───────────────────────────────────── */
  async function handleFinalizeEvent() {
    if (!window.confirm(
      "¿Finalizar el evento? Se asignarán posiciones y puntos de ranking definitivos a cada jugador."
    )) return;

    setFinalizing(true);
    try {
      const finalStandings = [...players].sort((a, b) => compareStandings(a, b, savedMatches));

      const upserts = finalStandings.map((player, index) => ({
        event_id:       id,
        player_id:      player.id,
        final_position: index + 1,
        points_earned:  pointsMap[index + 1] ?? 0,
        wins:           player.wins,
        ties:           player.ties,
        losses:         player.losses,
        points_for:     player.pointsFor,
        points_against: player.pointsAgainst,
        updated_at:     new Date().toISOString(),
      }));

      const { error: resErr } = await supabase
        .from("player_event_results")
        .upsert(upserts, { onConflict: "event_id,player_id" });
      if (resErr) throw resErr;

      const { error: evErr } = await supabase
        .from("events")
        .update({ status: "finished" })
        .eq("id", id);
      if (evErr) throw evErr;

      navigate("/admin");
    } catch (err) {
      setActionError("Error al finalizar el evento: " + err.message);
    } finally {
      setFinalizing(false);
    }
  }

  /* ── Estados de carga ───────────────────────────────────── */
  if (eventLoading || playersLoading || !initialized) {
    return (
      <main className="section coordinator-page">
        <div className="container">
          <div className="auth-loading"><span>Cargando evento…</span></div>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="section coordinator-page">
        <div className="container">
          <Link className="back-link" to="/admin">← Volver al admin</Link>
          <div className="empty-state card">
            <h3>Evento no encontrado.</h3>
            <p>Verificá que el ID del evento sea correcto.</p>
          </div>
        </div>
      </main>
    );
  }

  const formatLabel     = FORMAT_LABELS[event.format] ?? event.format;
  const allCurrentSaved = matches.length > 0 && matches.every((m) => m.isSaved);
  const hasHistory      = matchHistory.length > 0;
  const isFinished      = event.status === "finished";
  const isCancelled     = event.status === "cancelled";
  const isLocked        = isFinished || isCancelled;

  // Puede generar ronda: si no hay ninguna todavía, o si todos los partidos actuales están guardados
  const canGenerateRound = !isLocked && (currentRound === 0 || allCurrentSaved);
  const generateBtnLabel = currentRound === 0 ? "Generar ronda 1" : "Siguiente ronda";

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="section coordinator-page">
      <div className="container">
        <Link className="back-link" to="/admin">← Volver al admin</Link>

        {actionError && (
          <div className="coordinator-action-error card" role="alert">
            <span>⚠️ {actionError}</span>
            <button
              className="coordinator-action-error-close"
              onClick={() => setActionError(null)}
              aria-label="Cerrar"
            >✕</button>
          </div>
        )}

        <div className="coordinator-header">
          <div>
            <p className="section-kicker">Coordinador de evento</p>
            <h1 className="section-title">{event.title}</h1>
            <p className="section-description">
              {event.format === "mexicano"
                ? "En mexicano, la primera ronda es aleatoria. Luego las rondas se generan según el puntaje acumulado."
                : event.format === "americano"
                  ? "En americano, las rondas se generan como todos contra todos sin reorganizar por puntos."
                  : `Evento de formato ${formatLabel}.`}
            </p>
          </div>

          <div className="event-summary card">
            <span className="badge">{formatLabel}</span>
            {GENDER_FILTER_LABELS[event.gender_filter] && (
              <span className={`event-gender-badge ${GENDER_FILTER_CLASS[event.gender_filter]}`}>
                {GENDER_FILTER_LABELS[event.gender_filter]}
              </span>
            )}
            <strong>Categoría {event.category_code}</strong>
            {event.location && <small>{event.location}</small>}
            <small>
              {event.players_registered}/{event.player_limit} jugadores
              {event.courts ? ` · ${event.courts} canchas` : ""}
            </small>
            {!isLocked && (
              <button
                className="btn btn-danger"
                onClick={handleCancelEvent}
                disabled={cancelling}
                style={{ marginTop: 12 }}
              >
                {cancelling ? "Cancelando…" : "Cancelar evento"}
              </button>
            )}
          </div>
        </div>

        {isCancelled && (
          <div className="event-cancelled-banner card">
            <strong>✗ Evento cancelado</strong>
            <p>
              Este evento fue cancelado.
              {event.cancellation_reason && ` Motivo: ${event.cancellation_reason}`}
            </p>
          </div>
        )}

        {isFinished && (
          <div className="event-finished-banner card">
            <strong>✓ Evento finalizado</strong>
            <p>Las posiciones y puntos de ranking ya fueron asignados.</p>
          </div>
        )}

        <div className="coordinator-grid">

          {/* Ronda actual */}
          <section className="card coordinator-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Ronda actual</p>
                <h2>{currentRound === 0 ? "Sin rondas generadas" : `Ronda ${currentRound}`}</h2>
              </div>

              {canGenerateRound && (
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateRound}
                  disabled={generatingRound || saving}
                >
                  {generatingRound ? "Generando…" : generateBtnLabel}
                </button>
              )}
            </div>

            {currentRound > 0 && (
              <div className="round-note">
                {currentRound === 1
                  ? "Primera ronda generada al azar."
                  : "Ronda generada según puntaje acumulado (con desempate)."}
              </div>
            )}

            {matches.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <p style={{ color: "var(--color-text-muted)" }}>
                  {currentRound === 0
                    ? "Presioná \"Generar ronda 1\" para comenzar el evento."
                    : "No hay partidos en esta ronda."}
                </p>
              </div>
            ) : (
              <div className="match-list">
                {matches.map((match) => (
                  <article
                    className={`match-card ${match.isSaved ? "match-saved" : ""}`}
                    key={match.id}
                  >
                    <div className="match-top">
                      <span>Cancha {match.courtNumber}</span>
                      <strong>{match.status}</strong>
                    </div>

                    <div className="match-teams">
                      <div className="team-row">
                        <div>
                          <strong>{match.teamA[0]?.name} + {match.teamA[1]?.name}</strong>
                          <small>{match.teamA[0]?.level} / {match.teamA[1]?.level}</small>
                        </div>
                        <input
                          type="number" min="0" placeholder="0"
                          value={match.teamAScore}
                          disabled={match.isSaved || saving || isLocked}
                          onChange={(e) => handleScoreChange(match.id, "teamAScore", e.target.value)}
                        />
                      </div>

                      <div className="versus">vs</div>

                      <div className="team-row">
                        <div>
                          <strong>{match.teamB[0]?.name} + {match.teamB[1]?.name}</strong>
                          <small>{match.teamB[0]?.level} / {match.teamB[1]?.level}</small>
                        </div>
                        <input
                          type="number" min="0" placeholder="0"
                          value={match.teamBScore}
                          disabled={match.isSaved || saving || isLocked}
                          onChange={(e) => handleScoreChange(match.id, "teamBScore", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="match-actions">
                      {match.isSaved ? (
                        <button
                          className="btn btn-secondary match-save"
                          onClick={() => handleEditResult(match.id)}
                          disabled={saving || isLocked}
                        >
                          Editar resultado
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary match-save"
                          onClick={() => handleSaveResult(match.id)}
                          disabled={saving}
                        >
                          {saving ? "Guardando…" : match.isEditing ? "Guardar corrección" : "Guardar resultado"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Tabla interna */}
          <aside className="card coordinator-panel">
            <p className="section-kicker">Tabla del evento</p>
            <h2>Ranking interno</h2>

            <div className="event-ranking-list">
              {sortedPlayers.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", padding: "12px 0" }}>
                  Los standings aparecerán al guardar el primer resultado.
                </p>
              ) : (
                sortedPlayers.map((player, index) => {
                  const diff = player.pointsFor - player.pointsAgainst;
                  return (
                    <div className="event-ranking-row" key={player.id}>
                      <span>#{index + 1}</span>
                      <div>
                        <strong>{player.name}</strong>
                        <small>
                          {player.level} · {player.wins}V {player.ties}E {player.losses}P
                        </small>
                      </div>
                      <div className="ranking-points">
                        <strong>{player.eventPoints} pts</strong>
                        <small>Dif. {diff >= 0 ? "+" : ""}{diff}</small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>

        {/* ── Sección asistencia ──────────────────────────── */}
        {!isCancelled && (
          <section className="card coordinator-panel attendance-section">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Asistencia</p>
                <h2>Control de no-shows</h2>
              </div>
              {attendanceLoading && (
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>Actualizando…</span>
              )}
            </div>

            <p className="attendance-note">
              Marcá los jugadores que <strong>no se presentaron</strong> al evento.
              Si acumulan suficientes no-shows serán suspendidos automáticamente.
            </p>

            {attendanceRegs.length === 0 ? (
              <p className="attendance-empty">No hay jugadores confirmados.</p>
            ) : (
              <div className="attendance-list">
                {attendanceRegs.map((reg) => (
                  <div
                    key={reg.id}
                    className={`attendance-row ${reg.no_show ? "attendance-no-show" : ""}`}
                  >
                    <div className="attendance-player-info">
                      <strong>{reg.profiles?.full_name ?? "Jugador"}</strong>
                      <small>
                        Nivel {reg.profiles?.current_level ?? "?"} · Cat. {reg.profiles?.current_category ?? "?"}
                      </small>
                    </div>
                    <button
                      className={`attendance-toggle ${reg.no_show ? "is-no-show" : ""}`}
                      onClick={() => handleToggleNoShow(reg.id, reg.no_show)}
                      disabled={markingNoShow === reg.id}
                      title={reg.no_show ? "Desmarcar — estaba presente" : "Marcar como no-show"}
                    >
                      {markingNoShow === reg.id
                        ? "…"
                        : reg.no_show
                          ? "✗ No-show"
                          : "✓ Presente"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Sección finalizar evento ─────────────────────── */}
        {!isLocked && hasHistory && allCurrentSaved && (
          <section className="card coordinator-panel finalize-section">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Cierre del evento</p>
                <h2>Posiciones y puntos finales</h2>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleFinalizeEvent}
                disabled={finalizing}
              >
                {finalizing ? "Finalizando…" : "Confirmar y finalizar"}
              </button>
            </div>

            <p className="finalize-note">
              Las posiciones se determinan con las reglas de desempate:{" "}
              <strong>puntos → victorias → empates → head-to-head → diferencia general</strong>.
              Al confirmar, se asignan los puntos de ranking a cada jugador.
            </p>

            <div className="final-positions-list">
              {sortedPlayers.map((player, index) => {
                const pos     = index + 1;
                const rPoints = pointsMap[pos] ?? 0;
                const diff    = player.pointsFor - player.pointsAgainst;
                return (
                  <div className="final-position-row" key={player.id}>
                    <span className={`final-pos-badge ${pos <= 3 ? `top-${pos}` : ""}`}>
                      #{pos}
                    </span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {player.wins}V · {player.ties}E · {player.losses}P
                        {" · "}Dif. {diff >= 0 ? "+" : ""}{diff}
                      </small>
                    </div>
                    <div className="final-ranking-pts">
                      <strong>+{rPoints}</strong>
                      <small>pts ranking</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

export default EventCoordinator;
