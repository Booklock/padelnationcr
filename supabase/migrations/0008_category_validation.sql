-- =====================================================================
-- Padel Nation CR — Validación de categoría/nivel en inscripción (3.1)
-- =====================================================================
-- Actualiza register_for_event para verificar que el nivel del jugador
-- esté en allowed_levels del evento, o que tenga una autorización activa
-- para esa categoría (category_promotion_authorizations).
-- =====================================================================

create or replace function public.register_for_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event        events%rowtype;
  v_player       profiles%rowtype;
  v_existing     event_registrations%rowtype;
  v_confirmed_ct integer;
  v_reg_status   registration_status;
  v_waitlist_pos integer := null;
  v_reg_id       uuid;
  v_authorized   boolean := false;
begin
  -- Usuario autenticado requerido
  if auth.uid() is null then
    return jsonb_build_object('error', 'Debés iniciar sesión para inscribirte.');
  end if;

  -- Obtener evento (bloqueo compartido para evitar condiciones de carrera)
  select * into v_event from events where id = p_event_id for share;
  if not found then
    return jsonb_build_object('error', 'Evento no encontrado.');
  end if;

  -- Verificar que el evento acepte inscripciones
  if v_event.status not in ('open', 'almost_full') then
    return jsonb_build_object('error', 'Este evento no está aceptando inscripciones en este momento.');
  end if;

  -- ── Validación de categoría / nivel ──────────────────────────────
  select * into v_player from profiles where id = auth.uid();

  if not found or not v_player.is_active then
    return jsonb_build_object('error', 'No se encontró tu perfil de jugador.');
  end if;

  -- Verificar si el nivel del jugador está en los niveles permitidos
  if v_player.current_level is not null
     and v_player.current_level = any(v_event.allowed_levels) then
    -- Nivel coincide directamente → OK
    v_authorized := true;

  else
    -- Verificar si tiene autorización activa para esta categoría
    select exists (
      select 1
      from category_promotion_authorizations
      where player_id          = auth.uid()
        and authorized_category = v_event.category_code
        and revoked_at          is null
        and (expires_at   is null or expires_at   > now())
        and (event_id     is null or event_id     = p_event_id)
    ) into v_authorized;

    if not v_authorized then
      return jsonb_build_object(
        'error',
        case
          when v_player.current_level is null then
            'Tu perfil no tiene nivel asignado. Contactá al admin para que lo configure.'
          else
            'Tu nivel (' || v_player.current_level || ') no está habilitado para este evento. '
            || 'Niveles permitidos: ' || array_to_string(v_event.allowed_levels, ', ') || '.'
        end
      );
    end if;
  end if;
  -- ─────────────────────────────────────────────────────────────────

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
    update event_registrations
    set status            = v_reg_status,
        waitlist_position = v_waitlist_pos,
        registered_at     = now(),
        cancelled_at      = null
    where id = v_existing.id
    returning id into v_reg_id;
  else
    insert into event_registrations (event_id, player_id, status, waitlist_position)
    values (p_event_id, auth.uid(), v_reg_status, v_waitlist_pos)
    returning id into v_reg_id;
  end if;

  -- Actualizar estado del evento si se llenó
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
