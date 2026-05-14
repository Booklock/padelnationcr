import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Carga todas las inscripciones activas (confirmed / waitlist) del usuario
 * y las expone como un map: { [event_id]: { id, status, waitlist_position } }
 */
export function useMyRegistrations() {
  const { user } = useAuth();
  const [regs, setRegs]       = useState({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setRegs({});
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("event_registrations")
      .select("id, event_id, status, waitlist_position")
      .eq("player_id", user.id)
      .neq("status", "cancelled");

    const map = {};
    for (const r of (data ?? [])) {
      map[r.event_id] = r;
    }
    setRegs(map);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { regs, loading, refetch };
}

/**
 * Inscribe al usuario en el evento vía función RPC (security definer).
 * Retorna { status, registration_id, waitlist_pos } o lanza un error.
 */
export async function registerForEvent(eventId) {
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
  });

  if (error)      throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data; // { status, registration_id, waitlist_pos }
}

/**
 * Cancela la inscripción del usuario al evento (promueve waitlist automáticamente).
 * Retorna { success: true } o lanza un error.
 */
export async function cancelRegistration(eventId) {
  const { data, error } = await supabase.rpc("cancel_event_registration", {
    p_event_id: eventId,
  });

  if (error)       throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  return data; // { success: true }
}
