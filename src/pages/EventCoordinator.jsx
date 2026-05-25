import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

  // ── Pair management state ─────────────────────────────────────────
  const [pairRegs,         setPairRegs]         = useState([]);   // registrations with pair info
  const [pairProfiles,     setPairProfiles]      = useState({});   // profileId → profile
  const [pairRegsLoading,  setPairRegsLoading]   = useState(false);
  const [assigningFor,     setAssigningFor]      = useState(null); // playerId being assigned
  const [assignSearch,     setAssignSearch]      = useState("");
  const [assignResults,    setAssignResults]     = useState([]);
  const [assignSearching,  setAssignSearching]   = useState(false);
  const [assigningAction,  setAssigningAction]   = useState(false);
  const [pairPanelError,   setPairPanelError]    = useState("");
  const assignDebounce = useRef(null);

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

  /* ── Carga de inscripciones con info de pareja ──────────── */
  const loadPairRegs = useCallback(async () => {
    if (!id) return;
    setPairRegsLoading(true);
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("id, player_id, status, pair_partner_id, pair_confirmed")
      .eq("event_id", id)
      .in("status", ["registered", "confirmed", "waitlist"])
      .order("registered_at", { ascending: true });

    const allRegs = regs ?? [];
    setPairRegs(allRegs);

    const playerIds = [...new Set(
      allRegs.flatMap((r) => [r.player_id, r.pair_partner_id].filter(Boolean))
    )];
    if (playerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, current_level, current_category")
        .in("id", playerIds);
      const map = {};
      (profiles ?? []).forEach((p) => { map[p.id] = p; });
      setPairProfiles(map);
    }
    setPairRegsLoading(false);
  }, [id]);

  /* ── Inicialización ─────────────────────────────────────── */
  useEffect(() => {
    if (playersLoading || initialized || !id) return;
    loadMatchesFromDB().then(() => setInitialized(true));
  }, [registeredPlayers, playersLoading, initialized, id, loadMatchesFromDB]);

  useEffect(() => {
    if (event?.pair_format) loadPairRegs();
  }, [event?.pair_format, id, loadPairRegs]);

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

    // Para eventos de parejas, verificar que todas las parejas estén confirmadas
    if (event.pair_format) {
      const { data: readiness } = await supabase.rpc("check_pair_readiness", { p_event_id: id });
      if (readiness && !readiness.ready) {
        const tbd   = readiness.tbd_count ?? 0;
        const unconf = readiness.unconfirmed_count ?? 0;
        const parts = [];
        if (tbd > 0)    parts.push(`${tbd} jugador${tbd !== 1 ? "es" : ""} sin pareja (TBD)`);
        if (unconf > 0) parts.push(`${unconf} pareja${unconf !== 1 ? "s" : ""} sin confirmar`);
        setActionError(`No se puede generar la ronda: ${parts.join(" · ")}. Resolvé las parejas primero.`);
        return;
      }
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

  /* ── Búsqueda de jugadores para asignar pareja ───────────── */
  function handleAssignSearch(query) {
    setAssignSearch(query);
    if (!query.trim() || query.trim().length < 2) {
      setAssignResults([]);
      return;
    }
    clearTimeout(assignDebounce.current);
    assignDebounce.current = setTimeout(async () => {
      setAssignSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, current_level, current_category")
        .ilike("full_name", `%${query.trim()}%`)
        .eq("role", "player")
        .eq("is_active", true)
        .limit(6);
      setAssignResults(data ?? []);
      setAssignSearching(false);
    }, 300);
  }

  async function handleAdminAssignPartner(playerId, partnerId) {
    setAssigningAction(true);
    setPairPanelError("");
    const { data, error } = await supabase.rpc("admin_assign_pair_partner", {
      p_event_id:   id,
      p_player_id:  playerId,
      p_partner_id: partnerId ?? null,
    });
    if (error || data?.error) {
      setPairPanelError(error?.message ?? data.error);
    } else {
      setAssigningFor(null);
      setAssignSearch("");
      setAssignResults([]);
      await loadPairRegs();
    }
    setAssigningAction(false);
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
  const canGenerateRound  = !isLocked && (currentRound === 0 || allCurrentSaved);
  const isExtraRound      = currentRound >= (event.rounds ?? 0) && currentRound > 0;
  const generateBtnLabel  = currentRound === 0
    ? "Generar ronda 1"
    : isExtraRound
      ? "Agregar ronda extra"
      : "Siguiente ronda";
  const roundsRemaining   = Math.max(0, (event.rounds ?? 0) - currentRound);

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
            {event.pair_format && (
              <span className="event-pair-badge-sm">👥 Parejas fijas</span>
            )}
            {event.location && <small>{event.location}</small>}
            <small>
              {event.players_registered}/{event.player_limit} jugadores
              {event.courts ? ` · ${event.courts} canchas` : ""}
            </small>
            {event.warm_up_time > 0 && (
              <small>⏱ Calentamiento: {event.warm_up_time} min</small>
            )}
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
                  className={`btn ${isExtraRound ? "btn-secondary" : "btn-primary"}`}
                  onClick={handleGenerateRound}
                  disabled={generatingRound || saving}
                  title={isExtraRound ? "El evento tenía configuradas " + (event.rounds ?? 0) + " rondas. Esto agrega una extra." : undefined}
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

        {/* ── Sección parejas fijas ───────────────────────── */}
        {event.pair_format && !isCancelled && (
          <section className="card coordinator-panel pair-mgmt-section">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Parejas fijas</p>
                <h2>Asignación de parejas</h2>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => { loadPairRegs(); setPairPanelError(""); }}
                disabled={pairRegsLoading}
              >
                {pairRegsLoading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>

            <p className="pair-mgmt-note">
              Todos los jugadores deben tener pareja asignada y confirmada antes de poder
              generar rondas. Usá el botón <strong>"Asignar pareja"</strong> para resolver los TBD.
            </p>

            {pairPanelError && (
              <p className="pair-mgmt-error">{pairPanelError}</p>
            )}

            {pairRegsLoading ? (
              <p className="pair-mgmt-loading">Cargando parejas…</p>
            ) : pairRegs.length === 0 ? (
              <p className="pair-mgmt-empty">Aún no hay jugadores inscriptos.</p>
            ) : (
              <div className="pair-list">
                {pairRegs.map((reg) => {
                  const player  = pairProfiles[reg.player_id];
                  const partner = reg.pair_partner_id ? pairProfiles[reg.pair_partner_id] : null;
                  const isTbd   = !reg.pair_partner_id;
                  const isPending = reg.pair_partner_id && !reg.pair_confirmed;
                  const isAssigning = assigningFor === reg.player_id;

                  return (
                    <div
                      key={reg.id}
                      className={`pair-row ${isTbd ? "pair-row-tbd" : isPending ? "pair-row-pending" : "pair-row-ok"}`}
                    >
                      <div className="pair-row-player">
                        <strong>{player?.full_name ?? "Jugador"}</strong>
                        <small>Nivel {player?.current_level ?? "?"} · Cat. {player?.current_category ?? "?"}</small>
                      </div>

                      <div className="pair-row-partner">
                        {isTbd ? (
                          <span className="pair-tag-tbd">TBD</span>
                        ) : (
                          <>
                            <span className={isPending ? "pair-tag-pending" : "pair-tag-ok"}>
                              {isPending ? "⏳" : "✓"} {partner?.full_name ?? "Pareja"}
                            </span>
                          </>
                        )}
                      </div>

                      {!isLocked && (
                        <div className="pair-row-actions">
                          {isAssigning ? (
                            <div className="pair-assign-form">
                              <div className="pair-assign-search-wrap">
                                <input
                                  className="pair-assign-input"
                                  type="text"
                                  placeholder="Buscar jugador…"
                                  value={assignSearch}
                                  onChange={(e) => handleAssignSearch(e.target.value)}
                                  autoFocus
                                />
                                {(assignSearching || assignResults.length > 0) && (
                                  <ul className="pair-assign-results">
                                    {assignSearching && <li className="pair-assign-searching">Buscando…</li>}
                                    {!assignSearching && assignResults
                                      .filter((p) => p.id !== reg.player_id) // no self-assign
                                      .map((p) => (
                                        <li
                                          key={p.id}
                                          className="pair-assign-item"
                                          onClick={() => handleAdminAssignPartner(reg.player_id, p.id)}
                                        >
                                          <strong>{p.full_name}</strong>
                                          <small>Nivel {p.current_level ?? "?"} · Cat. {p.current_category ?? "?"}</small>
                                        </li>
                                      ))}
                                    {!assignSearching && assignResults.length === 0 && assignSearch.trim().length >= 2 && (
                                      <li className="pair-assign-no-results">Sin resultados</li>
                                    )}
                                  </ul>
                                )}
                              </div>
                              {!isTbd && (
                                <button
                                  className="pair-assign-tbd-btn"
                                  onClick={() => handleAdminAssignPartner(reg.player_id, null)}
                                  disabled={assigningAction}
                                  title="Dejar como TBD"
                                >
                                  Dejar TBD
                                </button>
                              )}
                              <button
                                className="btn btn-secondary pair-assign-cancel"
                                onClick={() => { setAssigningFor(null); setAssignSearch(""); setAssignResults([]); }}
                                disabled={assigningAction}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-secondary pair-assign-btn"
                              onClick={() => {
                                setAssigningFor(reg.player_id);
                                setAssignSearch("");
                                setAssignResults([]);
                                setPairPanelError("");
                              }}
                            >
                              {isTbd ? "Asignar pareja" : "Cambiar pareja"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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

            {roundsRemaining > 0 && (
              <div className="finalize-early-warning">
                ⚠️ Quedan <strong>{roundsRemaining} ronda{roundsRemaining !== 1 ? "s" : ""}</strong> configuradas sin jugar.
                Estás finalizando el evento anticipadamente.
              </div>
            )}

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
