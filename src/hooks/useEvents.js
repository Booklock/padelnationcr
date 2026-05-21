import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Obtiene eventos desde la vista v_events_list.
 * @param {Object} filters - { excludeStatuses: string[], category: string, format: string }
 */
export function useEvents({ excludeStatuses = ["draft", "cancelled"], category, format } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("v_events_list")
      .select("*")
      .order("starts_at", { ascending: true });

    if (excludeStatuses.length > 0) {
      query = query.not("status", "in", `(${excludeStatuses.join(",")})`);
    }
    if (category && category !== "Todos") {
      query = query.eq("category_code", category);
    }
    if (format && format !== "Todos") {
      query = query.eq("format", format.toLowerCase());
    }

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError);
    else setEvents(data ?? []);
    setLoading(false);
  }, [excludeStatuses.join(","), category, format]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

/** Obtiene un evento por ID junto con sus reglas de puntos. */
export function useEvent(eventId) {
  const [event, setEvent] = useState(null);
  const [pointRules, setPointRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const [{ data: ev, error: evErr }, { data: rules }] = await Promise.all([
        supabase
          .from("v_events_list")
          .select("*")
          .eq("id", eventId)
          .single(),
        supabase
          .from("event_point_rules")
          .select("*")
          .eq("event_id", eventId)
          .order("position", { ascending: true }),
      ]);
      if (evErr) setError(evErr);
      else {
        setEvent(ev);
        setPointRules(rules ?? []);
      }
      setLoading(false);
    }
    load();
  }, [eventId]);

  return { event, pointRules, loading, error };
}

/** Obtiene eventos finalizados con filtros opcionales de categoría y formato. */
export function useFinishedEvents({ category, format } = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("v_events_list")
      .select("*")
      .eq("status", "finished")
      .order("starts_at", { ascending: false });

    if (category && category !== "Todos") {
      query = query.eq("category_code", category);
    }
    if (format && format !== "Todos") {
      query = query.eq("format", format.toLowerCase());
    }

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError);
    else setEvents(data ?? []);
    setLoading(false);
  }, [category, format]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

/** Obtiene los resultados finales (posiciones) de un evento específico. */
export function useEventFinalResults(eventId) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setResults([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("player_event_results")
        .select("player_id, final_position, points_earned, wins, ties, losses, profiles(full_name, current_level, current_category)")
        .eq("event_id", eventId)
        .not("final_position", "is", null)
        .order("final_position", { ascending: true });
      if (!cancelled) {
        setResults(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [eventId]);

  return { results, loading };
}

/** Obtiene inscripciones confirmadas con flag no_show para el control de asistencia. */
export function useEventAttendance(eventId) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data } = await supabase
      .from("event_registrations")
      .select("id, player_id, status, no_show, no_show_marked_at, profiles(id, full_name, current_level, current_category)")
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    setRegistrations(
      (data ?? []).sort((a, b) =>
        (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "")
      )
    );
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  return { registrations, loading, refetch: load };
}

/** Obtiene los jugadores registrados (confirmados) de un evento. */
export function useEventPlayers(eventId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    async function load() {
      const { data } = await supabase
        .from("event_registrations")
        .select("player_id, status, profiles(id, full_name, current_level, current_category)")
        .eq("event_id", eventId)
        .eq("status", "confirmed");

      setPlayers(
        (data ?? []).map((reg) => ({
          id:            reg.profiles.id,
          name:          reg.profiles.full_name,
          level:         reg.profiles.current_level ?? "?",
          category:      reg.profiles.current_category ?? "?",
          eventPoints:   0,
          matchesPlayed: 0,
          wins:          0,
          ties:          0,
          losses:        0,
          pointsFor:     0,
          pointsAgainst: 0,
        }))
      );
      setLoading(false);
    }
    load();
  }, [eventId]);

  return { players, loading };
}
