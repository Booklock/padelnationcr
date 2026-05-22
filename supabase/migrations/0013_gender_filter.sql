-- =====================================================================
-- Padel Nation CR — Categorías por género en eventos (4.9)
-- =====================================================================
-- 1. gender_filter en events: 'any' | 'male' | 'female' | 'mixed'
-- 2. Actualiza v_events_list para incluir gender_filter + cancellation_reason
-- 3. Actualiza register_for_event con validación de género
-- =====================================================================

-- ── 1. Columna gender_filter en events ────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS gender_filter TEXT NOT NULL DEFAULT 'any'
  CHECK (gender_filter IN ('any', 'male', 'female', 'mixed'));


-- ── 2. Vista v_events_list actualizada ────────────────────────────
CREATE OR REPLACE VIEW public.v_events_list AS
SELECT
  e.id,
  e.title,
  e.format,
  e.category_code,
  e.allowed_levels,
  e.gender_filter,
  e.starts_at,
  e.player_limit,
  e.courts,
  e.rounds,
  e.price_crc,
  e.prize_description,
  e.status,
  e.match_end_criterion,
  e.match_end_value,
  e.location,
  e.cancelled_at,
  e.cancellation_reason,
  e.created_at,
  COALESCE(c.name, '') AS club_name,
  public.get_event_player_count(e.id) AS players_registered
FROM public.events e
LEFT JOIN public.clubs c ON c.id = e.club_id;

GRANT SELECT ON public.v_events_list TO anon, authenticated;


-- ── 3. register_for_event — con validación de género ──────────────
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event        events%rowtype;
  v_player       profiles%rowtype;
  v_existing     event_registrations%rowtype;
  v_confirmed_ct integer;
  v_reg_status   registration_status;
  v_waitlist_pos integer := null;
  v_reg_id       uuid;
  v_authorized   boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés iniciar sesión para inscribirte.');
  END IF;

  -- ── Chequeo de suspensión ─────────────────────────────────────
  SELECT * INTO v_player FROM profiles WHERE id = auth.uid();

  IF v_player.suspended_until IS NOT NULL AND v_player.suspended_until > NOW() THEN
    RETURN jsonb_build_object(
      'error',
      'Tu cuenta está suspendida hasta el '
        || TO_CHAR(v_player.suspended_until AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY')
        || '. Contactá al admin si creés que es un error.'
    );
  END IF;

  SELECT * INTO v_event FROM events WHERE id = p_event_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Evento no encontrado.');
  END IF;

  IF v_event.status NOT IN ('open', 'almost_full') THEN
    RETURN jsonb_build_object('error', 'Este evento no está aceptando inscripciones en este momento.');
  END IF;

  IF NOT FOUND OR NOT v_player.is_active THEN
    RETURN jsonb_build_object('error', 'No se encontró tu perfil de jugador.');
  END IF;

  -- ── Chequeo de género ─────────────────────────────────────────
  IF v_event.gender_filter = 'male' THEN
    IF v_player.gender IS DISTINCT FROM 'male' THEN
      RETURN jsonb_build_object(
        'error',
        'Este evento es exclusivo para jugadores masculinos. '
        || 'Si tu género en el perfil es incorrecto, contactá al admin.'
      );
    END IF;
  ELSIF v_event.gender_filter = 'female' THEN
    IF v_player.gender IS DISTINCT FROM 'female' THEN
      RETURN jsonb_build_object(
        'error',
        'Este evento es exclusivo para jugadoras femeninas. '
        || 'Si tu género en el perfil es incorrecto, contactá al admin.'
      );
    END IF;
  ELSIF v_event.gender_filter = 'mixed' THEN
    IF v_player.gender NOT IN ('male', 'female') THEN
      RETURN jsonb_build_object(
        'error',
        'Este evento es mixto y requiere género especificado en el perfil. '
        || 'Contactá al admin para actualizar tu perfil.'
      );
    END IF;
  END IF;
  -- 'any' → sin restricción

  -- ── Validación de nivel ────────────────────────────────────────
  IF v_player.current_level IS NOT NULL
     AND v_player.current_level = ANY(v_event.allowed_levels) THEN
    v_authorized := true;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM category_promotion_authorizations
      WHERE player_id          = auth.uid()
        AND authorized_category = v_event.category_code
        AND revoked_at          IS NULL
        AND (expires_at IS NULL OR expires_at   > NOW())
        AND (event_id   IS NULL OR event_id     = p_event_id)
    ) INTO v_authorized;

    IF NOT v_authorized THEN
      RETURN jsonb_build_object(
        'error',
        CASE
          WHEN v_player.current_level IS NULL THEN
            'Tu perfil no tiene nivel asignado. Contactá al admin para que lo configure.'
          ELSE
            'Tu nivel (' || v_player.current_level || ') no está habilitado para este evento. '
            || 'Niveles permitidos: ' || ARRAY_TO_STRING(v_event.allowed_levels, ', ') || '.'
        END
      );
    END IF;
  END IF;

  SELECT * INTO v_existing
  FROM event_registrations
  WHERE event_id = p_event_id AND player_id = auth.uid();

  IF FOUND AND v_existing.status <> 'cancelled' THEN
    RETURN jsonb_build_object('error', 'Ya estás inscrito en este evento.');
  END IF;

  SELECT COUNT(*) INTO v_confirmed_ct
  FROM event_registrations
  WHERE event_id = p_event_id AND status = 'confirmed';

  IF v_confirmed_ct < v_event.player_limit THEN
    v_reg_status := 'confirmed';
  ELSE
    v_reg_status := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
    FROM event_registrations
    WHERE event_id = p_event_id AND status = 'waitlist';
  END IF;

  IF FOUND THEN
    UPDATE event_registrations
    SET status            = v_reg_status,
        waitlist_position = v_waitlist_pos,
        registered_at     = NOW(),
        cancelled_at      = NULL
    WHERE id = v_existing.id
    RETURNING id INTO v_reg_id;
  ELSE
    INSERT INTO event_registrations (event_id, player_id, status, waitlist_position)
    VALUES (p_event_id, auth.uid(), v_reg_status, v_waitlist_pos)
    RETURNING id INTO v_reg_id;
  END IF;

  IF v_reg_status = 'confirmed' THEN
    IF v_confirmed_ct + 1 >= v_event.player_limit THEN
      UPDATE events SET status = 'closed' WHERE id = p_event_id;
    ELSIF (v_confirmed_ct + 1)::float / v_event.player_limit >= 0.8 THEN
      UPDATE events SET status = 'almost_full'
      WHERE id = p_event_id AND status = 'open';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status',          v_reg_status::text,
    'registration_id', v_reg_id,
    'waitlist_pos',    v_waitlist_pos
  );
END;
$$;
