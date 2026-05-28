import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const PROFILE_FIELDS = "id, full_name, current_category, current_level";

/**
 * Carga todos los retos individuales del usuario autenticado.
 * La RLS garantiza que solo devuelve retos donde el usuario participa.
 */
export function useMyChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) { setChallenges([]); setLoading(false); return; }

    const { data } = await supabase
      .from("individual_challenges")
      .select(`
        *,
        challenger:profiles!challenger_id(${PROFILE_FIELDS}),
        challenged:profiles!challenged_id(${PROFILE_FIELDS}),
        challenger_partner:profiles!challenger_partner_id(${PROFILE_FIELDS}),
        challenged_partner:profiles!challenged_partner_id(${PROFILE_FIELDS})
      `)
      .order("created_at", { ascending: false });

    setChallenges(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refetch(); }, [refetch]);

  return { challenges, loading, refetch };
}

/**
 * Para admins: carga todos los retos (sin filtro de RLS — la policy ic_admin_select aplica).
 * Filtra por status relevantes para el panel admin.
 */
export function useAllChallenges() {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("individual_challenges")
      .select(`
        *,
        challenger:profiles!challenger_id(${PROFILE_FIELDS}),
        challenged:profiles!challenged_id(${PROFILE_FIELDS}),
        challenger_partner:profiles!challenger_partner_id(${PROFILE_FIELDS}),
        challenged_partner:profiles!challenged_partner_id(${PROFILE_FIELDS})
      `)
      .order("created_at", { ascending: false });

    setAll(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { all, loading, refetch };
}

/**
 * Cuenta los retos recibidos pendientes de respuesta (para badge en navbar).
 */
export function usePendingChallengeCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    supabase
      .from("individual_challenges")
      .select("id", { count: "exact", head: true })
      .eq("challenged_id", user.id)
      .eq("status", "pending")
      .then(({ count: c }) => setCount(c ?? 0));
  }, [user?.id]);

  return count;
}

// ── RPC wrappers ──────────────────────────────────────────────────────

export async function createChallenge(challengedId, partnerIdchallenger, points) {
  const { data, error } = await supabase.rpc("create_individual_challenge", {
    p_challenged_id:         challengedId,
    p_challenger_partner_id: partnerIdchallenger,
    p_points_wagered:        points,
  });
  if (error)       throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function respondChallenge(challengeId, accept, partnerId = null) {
  const { data, error } = await supabase.rpc("respond_individual_challenge", {
    p_challenge_id: challengeId,
    p_accept:       accept,
    p_partner_id:   partnerId,
  });
  if (error)       throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function adminReviewChallenge(challengeId, approve, court, scheduledDate, notes) {
  const { data, error } = await supabase.rpc("admin_review_challenge", {
    p_challenge_id:   challengeId,
    p_approve:        approve,
    p_court:          court   || null,
    p_scheduled_date: scheduledDate || null,
    p_notes:          notes   || null,
  });
  if (error)       throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function adminCompleteChallenge(challengeId, winnerPair) {
  const { data, error } = await supabase.rpc("admin_complete_challenge", {
    p_challenge_id: challengeId,
    p_winner_pair:  winnerPair,
  });
  if (error)       throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Búsqueda de jugadores por nombre (para los modales) */
export async function searchPlayers(query, levelFilter = null) {
  let q = supabase
    .from("profiles")
    .select("id, full_name, current_category, current_level")
    .ilike("full_name", `%${query}%`)
    .eq("is_active", true)
    .eq("role", "player")
    .order("full_name")
    .limit(8);

  if (levelFilter) q = q.eq("current_level", levelFilter);

  const { data } = await q;
  return data ?? [];
}
