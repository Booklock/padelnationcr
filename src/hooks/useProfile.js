import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Datos del perfil propio: inscripciones, resultados históricos y posición en ranking.
 */
export function useProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [results, setResults] = useState([]);
  const [rankingInfo, setRankingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [user?.id]);

  async function fetchData() {
    setLoading(true);
    try {
      const [regsRes, resultsRes, rankRes] = await Promise.all([
        // Próximos eventos inscritos
        supabase
          .from("event_registrations")
          .select("id, status, registered_at, events(id, title, starts_at, location, format, status, category_code)")
          .eq("player_id", user.id)
          .neq("status", "cancelled")
          .order("registered_at", { ascending: false }),

        // Historial de resultados
        supabase
          .from("player_event_results")
          .select("id, final_position, points_earned, wins, ties, losses, excluded, events(id, title, starts_at, format, category_code)")
          .eq("player_id", user.id)
          .order("created_at", { ascending: false }),

        // Posición en ranking
        supabase
          .from("v_ranking_individual")
          .select("position, total_points, events_counted")
          .eq("player_id", user.id)
          .maybeSingle(),
      ]);

      if (regsRes.error)    throw regsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      setRegistrations(regsRes.data ?? []);
      setResults(resultsRes.data ?? []);
      setRankingInfo(rankRes.data ?? null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  return {
    profile,
    registrations,
    results,
    rankingInfo,
    loading,
    error,
    refetch: fetchData,
    refreshProfile,
  };
}
