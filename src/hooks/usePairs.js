import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// ── Helpers ──────────────────────────────────────────────────────────

/** Nombre legible de una pareja dado su id, un mapa de parejas y uno de perfiles. */
export function getPairName(pairId, pairsMap, profileMap) {
  const pair = pairsMap?.[pairId];
  if (!pair) return "Pareja";
  if (pair.display_name) return pair.display_name;
  const a = profileMap?.[pair.player_a_id]?.full_name ?? "?";
  const b = profileMap?.[pair.player_b_id]?.full_name ?? "?";
  return `${a} / ${b}`;
}

// ── usePairs: datos del jugador logueado ─────────────────────────────

export function usePairs() {
  const { user } = useAuth();

  const [myPair,             setMyPair]             = useState(null);
  const [pendingInvites,     setPendingInvites]     = useState([]);
  const [sentChallenges,     setSentChallenges]     = useState([]);
  const [receivedChallenges, setReceivedChallenges] = useState([]);
  const [profileMap,         setProfileMap]         = useState({});
  const [pairsMap,           setPairsMap]           = useState({});
  const [loading,            setLoading]            = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Parejas del usuario
      const { data: pairs } = await supabase
        .from("fixed_pairs")
        .select("*")
        .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`)
        .in("status", ["pending", "active"])
        .order("invited_at", { ascending: false });

      const allPairs = pairs ?? [];
      const active   = allPairs.find((p) => p.status === "active") ?? null;
      const pending  = allPairs.filter((p) => p.status === "pending");

      setMyPair(active);
      setPendingInvites(pending);

      // 2. Perfiles de los integrantes de esas parejas
      const myPlayerIds = [...new Set(allPairs.flatMap((p) => [p.player_a_id, p.player_b_id]))];
      const map = {};
      if (myPlayerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, current_category, current_level")
          .in("id", myPlayerIds);
        (profiles ?? []).forEach((p) => { map[p.id] = p; });
      }

      // 3. Retos activos de la pareja
      const pm = {};
      let sent = [], received = [];

      if (active) {
        const { data: challenges } = await supabase
          .from("pair_challenges")
          .select("*")
          .or(`challenger_pair_id.eq.${active.id},challenged_pair_id.eq.${active.id}`)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false });

        const allCh = challenges ?? [];

        // Parejas involucradas en retos (distintas a la propia)
        const otherPairIds = [...new Set(
          allCh.flatMap((c) => [c.challenger_pair_id, c.challenged_pair_id])
            .filter((id) => id !== active.id),
        )];

        if (otherPairIds.length > 0) {
          const { data: cPairs } = await supabase
            .from("fixed_pairs")
            .select("id, player_a_id, player_b_id, display_name")
            .in("id", otherPairIds);

          (cPairs ?? []).forEach((p) => { pm[p.id] = p; });

          // Perfiles extra
          const extraIds = [...new Set(
            (cPairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id])
              .filter((id) => !map[id]),
          )];
          if (extraIds.length > 0) {
            const { data: ep } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", extraIds);
            (ep ?? []).forEach((p) => { map[p.id] = p; });
          }
        }

        pm[active.id] = active;
        sent     = allCh.filter((c) => c.challenger_pair_id === active.id);
        received = allCh.filter((c) => c.challenged_pair_id === active.id);
      }

      setProfileMap(map);
      setPairsMap(pm);
      setSentChallenges(sent);
      setReceivedChallenges(received);
    } catch (err) {
      console.error("usePairs:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return {
    myPair,
    pendingInvites,
    sentChallenges,
    receivedChallenges,
    profileMap,
    pairsMap,
    loading,
    refetch: fetch,
  };
}

// ── usePairsRanking: ranking público de parejas ──────────────────────

export function usePairsRanking() {
  const [pairs,   setPairs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from("v_ranking_pairs")
        .select("*")
        .order("position", { ascending: true });

      if (dbErr) throw dbErr;
      if (!data || data.length === 0) { setPairs([]); return; }

      const playerIds = [...new Set(data.flatMap((p) => [p.player_a_id, p.player_b_id]))];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, current_category, current_level")
        .in("id", playerIds);

      if (profErr) throw profErr;

      const pm = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

      setPairs(data.map((pair) => ({
        ...pair,
        player_a: pm[pair.player_a_id],
        player_b: pm[pair.player_b_id],
        name: pair.display_name
          || [pm[pair.player_a_id]?.full_name, pm[pair.player_b_id]?.full_name]
            .filter(Boolean).join(" / ")
          || "Pareja",
      })));
    } catch (err) {
      console.error("usePairsRanking:", err);
      setError(err.message ?? "Error al cargar el ranking de parejas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { pairs, loading, error, refetch: load };
}

// ── usePendingChallenges: para el admin dashboard ─────────────────────

export function usePendingChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [pairsMap,   setPairsMap]   = useState({});
  const [profileMap, setProfileMap] = useState({});
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ch } = await supabase
        .from("pair_challenges")
        .select("*")
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false });

      const allCh = ch ?? [];

      if (allCh.length === 0) { setChallenges([]); setLoading(false); return; }

      const pairIds = [...new Set(allCh.flatMap((c) => [c.challenger_pair_id, c.challenged_pair_id]))];
      const { data: pairs } = await supabase
        .from("fixed_pairs")
        .select("id, player_a_id, player_b_id, display_name")
        .in("id", pairIds);

      const pm = Object.fromEntries((pairs ?? []).map((p) => [p.id, p]));

      const playerIds = [...new Set((pairs ?? []).flatMap((p) => [p.player_a_id, p.player_b_id]))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", playerIds);

      const prm = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

      setPairsMap(pm);
      setProfileMap(prm);
      setChallenges(allCh);
    } catch (err) {
      console.error("usePendingChallenges:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { challenges, pairsMap, profileMap, loading, refetch: load };
}
