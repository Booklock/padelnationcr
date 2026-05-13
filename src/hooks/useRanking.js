import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/** Ranking individual desde la vista v_ranking_individual. */
export function useRanking({ category } = {}) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRanking() {
      setLoading(true);
      let query = supabase
        .from("v_ranking_individual")
        .select("*")
        .order("position", { ascending: true });

      if (category && category !== "Todos") {
        query = query.eq("category_code", category);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) setError(fetchError);
      else setRanking(data ?? []);
      setLoading(false);
    }
    fetchRanking();
  }, [category]);

  return { ranking, loading, error };
}

/** Ranking de parejas desde la vista v_ranking_pairs. */
export function useRankingPairs() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPairs() {
      const { data } = await supabase
        .from("v_ranking_pairs")
        .select(`
          *,
          player_a:player_a_id(full_name, current_level),
          player_b:player_b_id(full_name, current_level)
        `)
        .order("position", { ascending: true });
      setPairs(data ?? []);
      setLoading(false);
    }
    fetchPairs();
  }, []);

  return { pairs, loading };
}
