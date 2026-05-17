import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { usePairs, getPairName } from "../hooks/usePairs";
import { useAuth } from "../contexts/AuthContext";
import "./PairSection.css";

const STATUS_CHALLENGE = {
  pending:  "Pendiente",
  accepted: "Aceptado — partido por jugar",
};

export default function PairSection() {
  const { user, profile } = useAuth();
  const {
    myPair, pendingInvites,
    sentChallenges, receivedChallenges,
    profileMap, pairsMap,
    loading, refetch,
  } = usePairs();

  // ── Invite form ──────────────────────────────────────────────────
  const [inviteQuery,   setInviteQuery]   = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [selected,      setSelected]      = useState(null); // profile
  const [pairName,      setPairName]      = useState("");
  const [inviting,      setInviting]      = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState("");

  useEffect(() => {
    if (inviteQuery.trim().length < 2) { setInviteResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, current_category, current_level")
        .ilike("full_name", `%${inviteQuery}%`)
        .neq("id", user.id)
        .eq("role", "player")
        .eq("is_active", true)
        .limit(6);
      setInviteResults(data ?? []);
    }, 320);
    return () => clearTimeout(t);
  }, [inviteQuery, user?.id]);

  async function sendInvite() {
    if (!selected) return;
    setInviting(true); setInviteMsg("");
    const { data, error } = await supabase.rpc("invite_fixed_pair", {
      p_partner_id:   selected.id,
      p_display_name: pairName.trim() || null,
    });
    if (error) {
      setInviteMsg("❌ " + error.message);
    } else {
      setInviteMsg("✅ Invitación enviada. El jugador verá la solicitud en su perfil.");
      setInviteQuery(""); setInviteResults([]); setSelected(null); setPairName("");
      await refetch();
    }
    setInviting(false);
  }

  // ── Respond to invite ────────────────────────────────────────────
  const [respondingId, setRespondingId] = useState(null);
  const [respondMsg,   setRespondMsg]   = useState("");

  async function handleRespondInvite(pairId, accept) {
    setRespondingId(pairId); setRespondMsg("");
    const { error } = await supabase.rpc("respond_pair_invite", {
      p_pair_id: pairId,
      p_accept:  accept,
    });
    if (error) setRespondMsg("❌ " + error.message);
    else       await refetch();
    setRespondingId(null);
  }

  // ── Dissolve pair ────────────────────────────────────────────────
  const [dissolving,  setDissolving]  = useState(false);
  const [dissolveMsg, setDissolveMsg] = useState("");

  async function handleDissolve() {
    if (!window.confirm("¿Seguro que querés disolver la pareja? Perderán el historial de retos pendientes.")) return;
    setDissolving(true); setDissolveMsg("");
    const { error } = await supabase.rpc("dissolve_pair", { p_pair_id: myPair.id });
    if (error) setDissolveMsg("❌ " + error.message);
    else       await refetch();
    setDissolving(false);
  }

  // ── Respond to challenge ─────────────────────────────────────────
  const [respondingChId, setRespondingChId] = useState(null);
  const [challengeMsg,   setChallengeMsg]   = useState("");

  async function handleRespondChallenge(challengeId, accept) {
    setRespondingChId(challengeId); setChallengeMsg("");
    const { error } = await supabase.rpc("respond_pair_challenge", {
      p_challenge_id: challengeId,
      p_accept:       accept,
    });
    if (error) setChallengeMsg("❌ " + error.message);
    else       await refetch();
    setRespondingChId(null);
  }

  if (loading) {
    return (
      <section className="pair-section card">
        <p className="section-kicker">Pareja fija</p>
        <p className="pair-loading">Cargando…</p>
      </section>
    );
  }

  const partnerId = myPair
    ? (myPair.player_a_id === user.id ? myPair.player_b_id : myPair.player_a_id)
    : null;
  const partner   = partnerId ? profileMap[partnerId] : null;
  const myPairName = myPair?.display_name
    || (partner ? `${profile?.full_name ?? "Vos"} / ${partner.full_name}` : "Mi Pareja");

  return (
    <section className="pair-section card">
      <p className="section-kicker">Pareja fija</p>
      <h2>Mi pareja</h2>

      {/* ── Pareja activa ── */}
      {myPair ? (
        <div className="pair-active-card">
          <div className="pair-active-header">
            <span className="pair-badge pair-badge-active">Activa</span>
            <span className="pair-pts">
              {(myPair.challenge_points ?? 0) >= 0 ? "+" : ""}
              {myPair.challenge_points ?? 0} pts retos
            </span>
          </div>
          <h3 className="pair-name">{myPairName}</h3>
          {partner && (
            <p className="pair-partner">
              Compañero/a: <strong>{partner.full_name}</strong>
              {partner.current_category && (
                <span className="pair-partner-cat"> · Cat. {partner.current_category} {partner.current_level}</span>
              )}
            </p>
          )}
          {dissolveMsg && <p className="pair-msg pair-msg-err">{dissolveMsg}</p>}
          <button
            className="btn-dissolve"
            onClick={handleDissolve}
            disabled={dissolving}
          >
            {dissolving ? "Disolviendo…" : "Disolver pareja"}
          </button>
        </div>
      ) : (
        /* ── Sin pareja: formulario de invitación ── */
        <div className="pair-invite-form">
          <p className="pair-hint">
            Invitá a otro jugador para formar una pareja fija y competir en el ranking de parejas.
          </p>

          <div className="pair-search-wrap">
            <input
              className="pair-search-input"
              type="search"
              placeholder="Buscá por nombre…"
              value={inviteQuery}
              onChange={(e) => { setInviteQuery(e.target.value); setSelected(null); }}
            />
            {inviteResults.length > 0 && !selected && (
              <ul className="pair-search-results">
                {inviteResults.map((p) => (
                  <li
                    key={p.id}
                    className="pair-search-item"
                    onClick={() => { setSelected(p); setInviteQuery(p.full_name); setInviteResults([]); }}
                  >
                    <strong>{p.full_name}</strong>
                    <small>{p.email} · Cat. {p.current_category ?? "—"}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected && (
            <>
              <div className="pair-selected">
                ✅ Seleccionado: <strong>{selected.full_name}</strong>
                <button className="pair-clear-btn" onClick={() => { setSelected(null); setInviteQuery(""); }}>✕</button>
              </div>
              <input
                className="pair-name-input"
                type="text"
                placeholder="Nombre de la pareja (opcional)"
                value={pairName}
                onChange={(e) => setPairName(e.target.value)}
                maxLength={60}
              />
            </>
          )}

          {inviteMsg && (
            <p className={`pair-msg ${inviteMsg.startsWith("✅") ? "pair-msg-ok" : "pair-msg-err"}`}>
              {inviteMsg}
            </p>
          )}

          <button
            className="btn btn-primary pair-invite-btn"
            onClick={sendInvite}
            disabled={!selected || inviting}
          >
            {inviting ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>
      )}

      {/* ── Invitaciones pendientes recibidas ── */}
      {pendingInvites.length > 0 && (
        <div className="pair-invites-section">
          <p className="pair-sub-label">Solicitudes de pareja</p>
          {pendingInvites.map((inv) => {
            const otherPlayerId = inv.player_a_id === user.id ? inv.player_b_id : inv.player_a_id;
            const other = profileMap[otherPlayerId];
            const isSender = inv.player_a_id === user.id || inv.player_b_id === user.id;
            const iCreated = /* the one who called invite_fixed_pair */
              (inv.invited_by ?? inv.player_a_id) === user.id;

            return (
              <div key={inv.id} className="pair-invite-card">
                <p>
                  {inv.display_name ? <strong>{inv.display_name} — </strong> : null}
                  Pareja con <strong>{other?.full_name ?? "jugador"}</strong>
                </p>
                {respondMsg && <p className="pair-msg pair-msg-err">{respondMsg}</p>}
                <div className="pair-invite-btns">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRespondInvite(inv.id, true)}
                    disabled={respondingId === inv.id}
                  >
                    Aceptar
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRespondInvite(inv.id, false)}
                    disabled={respondingId === inv.id}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Retos recibidos ── */}
      {receivedChallenges.length > 0 && (
        <div className="pair-challenges-section">
          <p className="pair-sub-label">Retos recibidos</p>
          {challengeMsg && <p className="pair-msg pair-msg-err">{challengeMsg}</p>}
          {receivedChallenges.map((ch) => (
            <div key={ch.id} className="pair-challenge-card received">
              <div className="pair-ch-top">
                <span className={`pair-ch-status status-${ch.status}`}>
                  {STATUS_CHALLENGE[ch.status]}
                </span>
                <span className="pair-ch-pts">🎯 {ch.points_wagered} pts en juego</span>
              </div>
              <p className="pair-ch-from">
                De: <strong>{getPairName(ch.challenger_pair_id, pairsMap, profileMap)}</strong>
              </p>
              <p className="pair-ch-positions">
                Posición ellos #{ch.challenger_position_at_request} → vos #{ch.challenged_position_at_request}
              </p>
              {ch.message && <p className="pair-ch-msg">"{ch.message}"</p>}
              {ch.status === "pending" && (
                <div className="pair-ch-btns">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleRespondChallenge(ch.id, true)}
                    disabled={respondingChId === ch.id}
                  >
                    Aceptar reto
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRespondChallenge(ch.id, false)}
                    disabled={respondingChId === ch.id}
                  >
                    Rechazar
                  </button>
                </div>
              )}
              {ch.status === "accepted" && (
                <p className="pair-ch-note">
                  ⚔️ Reto aceptado. El admin registrará el resultado una vez jugado.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Retos enviados ── */}
      {sentChallenges.length > 0 && (
        <div className="pair-challenges-section">
          <p className="pair-sub-label">Retos enviados</p>
          {sentChallenges.map((ch) => (
            <div key={ch.id} className="pair-challenge-card sent">
              <div className="pair-ch-top">
                <span className={`pair-ch-status status-${ch.status}`}>
                  {STATUS_CHALLENGE[ch.status]}
                </span>
                <span className="pair-ch-pts">🎯 {ch.points_wagered} pts</span>
              </div>
              <p className="pair-ch-from">
                A: <strong>{getPairName(ch.challenged_pair_id, pairsMap, profileMap)}</strong>
              </p>
              <p className="pair-ch-positions">
                Vos #{ch.challenger_position_at_request} → ellos #{ch.challenged_position_at_request}
              </p>
              {ch.message && <p className="pair-ch-msg">"{ch.message}"</p>}
              {ch.status === "accepted" && (
                <p className="pair-ch-note">
                  ⚔️ Aceptado. El admin registrará el resultado.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
