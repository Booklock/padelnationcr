-- =====================================================================
-- Padel Nation CR — Funciones de inscripción a eventos
-- =====================================================================
-- Usamos SECURITY DEFINER para que la lógica corra como el propietario
-- de la función y pueda actualizar inscripciones de OTRO jugador al
-- promover la lista de espera (lo que RLS normalmente bloquearía).
-- =====================================================================

-- ── 1. Inscribirse a un evento ────────────────────────────────────────
--   Retorna: { status: 'confirmed'|'waitlist', registration_id: uuid }
--         o: { error: '...' }
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event        events%rowtype;
  v_existing     event_registrations%rowtype;
  v_confirmed_ct integer;
  v_reg_status   registration_status;
  v_waitlist_pos integer := null;
  v_reg_id       uuid;
begin
  -- Usuario autenticado requerido
  if auth.uid() is null then
    return jsonb_build_object('error', 'Debés iniciar sesión para inscribirte.');
  end if;

  -- Obtener evento y bloquearlo para evitar condiciones de carrera
  select * into v_event from events where id = p_event_id for share;
  if not found then
    return jsonb_build_object('error', 'Evento no encontrado.');
  end if;

  -- Verificar que el evento acepte inscripciones
  if v_event.status not in ('open', 'almost_full') then
    return jsonb_build_object('error', 'Este evento no está aceptando inscripciones en este momento.');
  end if;

  -- Verificar si ya existe una inscripción (activa o cancelada)
  select * into v_existing
  from event_registrations
  where event_id = p_event_id and player_id = auth.uid();

  if found and v_existing.status <> 'cancelled' then
    return jsonb_build_object('error', 'Ya estás inscrito en este evento.');
  end if;

  -- Contar cupos confirmados
  select count(*) into v_confirmed_ct
  from event_registrations
  where event_id = p_event_id and status = 'confirmed';

  -- Decidir status: confirmed si hay cupo, waitlist si está lleno
  if v_confirmed_ct < v_event.player_limit then
    v_reg_status := 'confirmed';
  else
    v_reg_status := 'waitlist';
    select coalesce(max(waitlist_position), 0) + 1 into v_waitlist_pos
    from event_registrations
    where event_id = p_event_id and status = 'waitlist';
  end if;

  -- Insertar o reactivar inscripción cancelada
  if found then
    -- Registro existente (cancelado) → reactivar
    update event_registrations
    set status            = v_reg_status,
        waitlist_position = v_waitlist_pos,
        registered_at     = now(),
        cancelled_at      = null
    where id = v_existing.id
    returning id into v_reg_id;
  else
    -- Nuevo registro
    insert into event_registrations (event_id, player_id, status, waitlist_position)
    values (p_event_id, auth.uid(), v_reg_status, v_waitlist_pos)
    returning id into v_reg_id;
  end if;

  -- Actualizar status del evento si se llenó
  if v_reg_status = 'confirmed' then
    if v_confirmed_ct + 1 >= v_event.player_limit then
      update events set status = 'closed' where id = p_event_id;
    elsif (v_confirmed_ct + 1)::float / v_event.player_limit >= 0.8 then
      update events set status = 'almost_full'
      where id = p_event_id and status = 'open';
    end if;
  end if;

  return jsonb_build_object(
    'status',          v_reg_status::text,
    'registration_id', v_reg_id,
    'waitlist_pos',    v_waitlist_pos
  );
end;
$$;


-- ── 2. Cancelar inscripción (con promoción automática de waitlist) ────
--   Retorna: { success: true }
--         o: { error: '...' }
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.cancel_event_registration(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg    event_registrations%rowtype;
  v_next   event_registrations%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'Debés iniciar sesión.');
  end if;

  -- Buscar inscripción activa del usuario
  select * into v_reg
  from event_registrations
  where event_id = p_event_id
    and player_id = auth.uid()
    and status <> 'cancelled';

  if not found then
    return jsonb_build_object('error', 'No tenés una inscripción activa en este evento.');
  end if;

  -- Cancelar
  update event_registrations
  set status       = 'cancelled',
      cancelled_at = now()
  where id = v_reg.id;

  -- Si era confirmed → promover el primero de la lista de espera
  if v_reg.status = 'confirmed' then
    select * into v_next
    from event_registrations
    where event_id = p_event_id
      and status   = 'waitlist'
    order by waitlist_position asc nulls last
    limit 1;

    if found then
      -- Promover a confirmed
      update event_registrations
      set status            = 'confirmed',
          waitlist_position = null
      where id = v_next.id;

      -- Reordenar posiciones restantes
      update event_registrations
      set waitlist_position = waitlist_position - 1
      where event_id        = p_event_id
        and status          = 'waitlist'
        and waitlist_position > v_next.waitlist_position;
    else
      -- No hay waitlist → el evento vuelve a estar abierto
      update events
      set status = 'open'
      where id = p_event_id and status in ('closed', 'almost_full');
    end if;

  elsif v_reg.status = 'waitlist' then
    -- Solo reordenar posiciones
    update event_registrations
    set waitlist_position = waitlist_position - 1
    where event_id        = p_event_id
      and status          = 'waitlist'
      and waitlist_position > v_reg.waitlist_position;
  end if;

  return jsonb_build_object('success', true);
end;
$$;


-- ── Permisos ──────────────────────────────────────────────────────────
grant execute on function public.register_for_event(uuid)         to authenticated;
grant execute on function public.cancel_event_registration(uuid)  to authenticated;
