import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useEvent, useEventPlayers } from "../hooks/useEvents";
import { generateMexicanoRound } from "../utils/generateMexicanoRound";
import { FORMAT_LABELS, formatEventDate } from "../utils/formatters";
import "./EventCoordinator.css";

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

/**
 * Calcula standings a partir del historial de partidos guardados.
 * `basePlayers` es el array original de useEventPlayers (sin stats acumuladas).
 */
function calcStandings(basePlayers, savedMatches) {
  return basePlayers.map((player) => {
    let pts = 0, pj = 0, pg = 0, pe = 0, pp = 0, pf = 0, pa = 0;

    for (const match of savedMatches) {
      const inA = match.teamA.some((p) => p.id === player.id);
      const inB = match.teamB.some((p) => p.id === player.id);
      if (!inA && !inB) continue;

      const myScore  = inA ? Number(match.teamAScore) : Number(match.teamBScore);
      const oppScore = inA ? Number(match.teamBScore) : Number(match.teamAScore);

      pts += myScore;
      pf  += myScore;
      pa  += oppScore;
      pj  += 1;

      if      (myScore > oppScore)  pg++;
      else if (myScore === oppScore) pe++;
      else                           pp++;
    }

    return {
      ...player,
      eventPoints:   pts,
      matchesPlayed: pj,
      wins:          pg,
      ties:          pe,
      losses:        pp,
      pointsFor:     pf,
      pointsAgainst: pa,
    };
  });
}

/**
 * Convierte un partido de la DB al formato local del UI.
 * `playersList` son los jugadores ya cargados del evento.
 */
function dbMatchToLocal(dbMatch, playersList) {
  const findPlayer = (uid) =>
    playersList.find((p) => p.id === uid) ?? { id: uid, name: "Jugador", level: "?" };

  const localId = `${dbMatch.round_number}-${(dbMatch.court_number - 1) * 4}`;

  return {
    id:          localId,
    dbId:        dbMatch.id,
    roundNumber: dbMatch.round_number,
    courtNumber: dbMatch.court_number,
    teamA:       (dbMatch.team_a_player_ids ?? []).map(findPlayer),
    teamB:       (dbMatch.team_b_player_ids ?? []).map(findPlayer),
    teamAScore:  dbMatch.team_a_score ?? "",
    teamBScore:  dbMatch.team_b_score ?? "",
    status:      dbMatch.status === "finished" ? "Finalizado" : "Pendiente",
    isSaved:     dbMatch.status === "finished",
    isEditing:   false,
  };
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────────────────────── */

function EventCoordinator() {
  const { id } = useParams();
  const { event, loading: eventLoading }     = useEvent(id);
  const { players: registeredPlayers, loading: playersLoading } = useEventPlayers(id);

  const [currentRound,  setCurrentRound]  = useState(1);
  const [players,       setPlayers]       = useState([]);
  const [matches,       setMatches]       = useState([]);
  const [matchHistory,  setMatchHistory]  = useState([]);
  const [initialized,   setInitialized]   = useState(false);
  const [saving,        setSaving]        = useState(false);

  /* ── Inicialización: reconstruir estado desde la DB ──────── */
  useEffect(() => {
    if (playersLoading || initialized || !id) return;

    async function init() {
      // Cargar partidos existentes de esta edición
      const { data: dbMatches = [] } = await supabase
        .from("matches")
        .select("*")
        .eq("event_id", id)
        .order("round_number",  { ascending: true })
        .order("court_number",  { ascending: true });

      const finishedDb = dbMatches.filter((m) => m.status === "finished");

      if (!registeredPlayers.length || !finishedDb.length) {
        // Evento sin historial: ronda 1 generada al azar
        setPlayers(registeredPlayers);
        setMatches(generateMexicanoRound(registeredPlayers, 1));
        setCurrentRound(1);
      } else {
        // Hay historial → reconstruir standings
        const historyLocal  = finishedDb.map((m) => dbMatchToLocal(m, registeredPlayers));
        const standings     = calcStandings(registeredPlayers, historyLocal);
        const maxRound      = Math.max(...finishedDb.map((m) => m.round_number));
        const currentInDb   = dbMatches.filter((m) => m.round_number === maxRound);
        const allDone       = currentInDb.every((m) => m.status === "finished");

        setMatchHistory(historyLocal);
        setPlayers(standings);

        if (allDone) {
          // Ronda actual terminada → preparar siguiente
          const nextRound = maxRound + 1;
          setCurrentRound(nextRound);
          setMatches(generateMexicanoRound(standings, nextRound));
        } else {
          // Ronda en curso → reconstruir partidos pendientes
          setCurrentRound(maxRound);
          setMatches(currentInDb.map((m) => dbMatchToLocal(m, registeredPlayers)));
        }
      }

      setInitialized(true);
    }

    init();
  }, [registeredPlayers, playersLoading, initialized, id]);

  /* ── Tabla ordenada ─────────────────────────────────────── */
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.eventPoints !== a.eventPoints) return b.eventPoints - a.eventPoints;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
  }, [players]);

  /* ── Handlers ───────────────────────────────────────────── */
  function handleScoreChange(matchId, field, value) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, [field]: value } : m))
    );
  }

  async function handleSaveResult(matchId) {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const aScore = Number(match.teamAScore);
    const bScore = Number(match.teamBScore);

    if (
      match.teamAScore === "" ||
      match.teamBScore === "" ||
      Number.isNaN(aScore) ||
      Number.isNaN(bScore)
    ) {
      alert("Ingresá ambos resultados antes de guardar.");
      return;
    }

    setSaving(true);

    try {
      // 1. Guardar partido en DB (upsert por event + ronda + cancha)
      const { error: matchErr } = await supabase
        .from("matches")
        .upsert(
          {
            event_id:            id,
            round_number:        currentRound,
            court_number:        match.courtNumber,
            team_a_player_ids:   match.teamA.map((p) => p.id),
            team_b_player_ids:   match.teamB.map((p) => p.id),
            team_a_score:        aScore,
            team_b_score:        bScore,
            status:              "finished",
            finished_at:         new Date().toISOString(),
          },
          { onConflict: "event_id,round_number,court_number" }
        );

      if (matchErr) throw matchErr;

      // 2. Actualizar estado local
      const savedMatch = {
        ...match,
        teamAScore: aScore,
        teamBScore: bScore,
        status:     "Finalizado",
        isSaved:    true,
        isEditing:  false,
      };

      const newMatches  = matches.map((m) => (m.id === matchId ? savedMatch : m));
      const newHistory  = [...matchHistory.filter((m) => m.id !== matchId), savedMatch];
      const newStandings = calcStandings(registeredPlayers, newHistory);

      setMatches(newMatches);
      setMatchHistory(newHistory);
      setPlayers(newStandings);

      // 3. Persistir stats de jugadores que ya jugaron
      const activePlayers = newStandings.filter((p) => p.matchesPlayed > 0);

      if (activePlayers.length > 0) {
        const upserts = activePlayers.map((p) => ({
          event_id:       id,
          player_id:      p.id,
          points_earned:  0, // se asigna al cerrar el evento (P2)
          wins:           p.wins,
          ties:           p.ties,
          losses:         p.losses,
          points_for:     p.pointsFor,
          points_against: p.pointsAgainst,
          updated_at:     new Date().toISOString(),
        }));

        await supabase
          .from("player_event_results")
          .upsert(upserts, { onConflict: "event_id,player_id" });
      }
    } catch (err) {
      alert("Error al guardar resultado: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditResult(matchId) {
    const newMatches = matches.map((m) =>
      m.id === matchId
        ? { ...m, status: "Editando", isSaved: false, isEditing: true }
        : m
    );
    const newHistory   = matchHistory.filter((m) => m.id !== matchId);
    const newStandings = calcStandings(registeredPlayers, newHistory);

    setMatches(newMatches);
    setMatchHistory(newHistory);
    setPlayers(newStandings);
  }

  function handleGenerateNextRound() {
    if (matches.some((m) => !m.isSaved)) {
      alert("Guardá todos los resultados antes de generar la siguiente ronda.");
      return;
    }
    const nextRound = currentRound + 1;
    setCurrentRound(nextRound);
    setMatches(generateMexicanoRound(sortedPlayers, nextRound));
  }

  /* ── Estados de carga ──────────────────────────────────── */
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

  const formatLabel = FORMAT_LABELS[event.format] ?? event.format;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="section coordinator-page">
      <div className="container">
        <Link className="back-link" to="/admin">
          ← Volver al admin
        </Link>

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
            <strong>Categoría {event.category_code}</strong>
            {event.location && <small>{event.location}</small>}
            <small>
              {event.players_registered}/{event.player_limit} jugadores
              {event.courts ? ` · ${event.courts} canchas` : ""}
            </small>
          </div>
        </div>

        <div className="coordinator-grid">

          {/* Ronda actual */}
          <section className="card coordinator-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Ronda actual</p>
                <h2>Ronda {currentRound}</h2>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerateNextRound}
                disabled={saving}
              >
                Generar siguiente ronda
              </button>
            </div>

            <div className="round-note">
              {currentRound === 1
                ? "Primera ronda generada al azar."
                : "Ronda generada según puntaje acumulado."}
            </div>

            {matches.length === 0 ? (
              <div className="empty-state card" style={{ marginTop: 16 }}>
                <p>No hay jugadores inscritos en este evento aún.</p>
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
                          <strong>
                            {match.teamA[0]?.name} + {match.teamA[1]?.name}
                          </strong>
                          <small>
                            {match.teamA[0]?.level} / {match.teamA[1]?.level}
                          </small>
                        </div>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={match.teamAScore}
                          disabled={match.isSaved || saving}
                          onChange={(e) =>
                            handleScoreChange(match.id, "teamAScore", e.target.value)
                          }
                        />
                      </div>

                      <div className="versus">vs</div>

                      <div className="team-row">
                        <div>
                          <strong>
                            {match.teamB[0]?.name} + {match.teamB[1]?.name}
                          </strong>
                          <small>
                            {match.teamB[0]?.level} / {match.teamB[1]?.level}
                          </small>
                        </div>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={match.teamBScore}
                          disabled={match.isSaved || saving}
                          onChange={(e) =>
                            handleScoreChange(match.id, "teamBScore", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="match-actions">
                      {match.isSaved ? (
                        <button
                          className="btn btn-secondary match-save"
                          onClick={() => handleEditResult(match.id)}
                          disabled={saving}
                        >
                          Editar resultado
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary match-save"
                          onClick={() => handleSaveResult(match.id)}
                          disabled={saving}
                        >
                          {saving
                            ? "Guardando…"
                            : match.isEditing
                              ? "Guardar corrección"
                              : "Guardar resultado"}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Tabla interna del evento */}
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
                          {player.level} · PJ {player.matchesPlayed} · PG {player.wins}
                          {player.ties > 0 ? ` · PE ${player.ties}` : ""}
                        </small>
                      </div>

                      <div className="ranking-points">
                        <strong>{player.eventPoints} pts</strong>
                        <small>
                          Dif. {diff >= 0 ? "+" : ""}{diff}
                        </small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default EventCoordinator;
