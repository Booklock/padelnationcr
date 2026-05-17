-- =====================================================================
-- Padel Nation CR — Cancelación manual de eventos
-- =====================================================================
-- cancel_event(p_event_id, p_reason)
--   · Solo coordinadores/admins pueden ejecutarla
--   · Pasa el evento a 'cancelled' y registra quién y por qué
--   · Cancela TODAS las inscripciones activas (confirmed + waitlist)
--   · Security definer → bypasa RLS para poder tocar inscripciones ajenas
-- =====================================================================

create or replace function public.cancel_event(
  p_event_id uuid,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event           events%rowtype;
  v_cancelled_count int;
begin
  -- Solo coordinadores y admins pueden cancelar
  if not is_coordinator_or_above() then
    return jsonb_build_object('error', 'No tenés permisos para cancelar eventos.');
  end if;

  -- Obtener evento
  select * into v_event from events where id = p_event_id;
  if not found then
    return jsonb_build_object('error', 'Evento no encontrado.');
  end if;

  -- No cancelar lo que ya está cancelado o finalizado
  if v_event.status in ('cancelled', 'finished') then
    return jsonb_build_object(
      'error', 'El evento ya está ' || v_event.status::text || ' y no puede cancelarse.'
    );
  end if;

  -- Cancelar el evento
  update events
  set
    status              = 'cancelled',
    cancelled_at        = now(),
    cancelled_by        = auth.uid(),
    cancellation_reason = p_reason
  where id = p_event_id;

  -- Cancelar todas las inscripciones activas (confirmed + waitlist)
  update event_registrations
  set
    status       = 'cancelled',
    cancelled_at = now()
  where event_id = p_event_id
    and status in ('confirmed', 'waitlist');

  get diagnostics v_cancelled_count = row_count;

  return jsonb_build_object(
    'success',                 true,
    'cancelled_registrations', v_cancelled_count
  );
end;
$$;

grant execute on function public.cancel_event(uuid, text) to authenticated;
