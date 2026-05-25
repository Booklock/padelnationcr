-- =====================================================================
-- Padel Nation CR — Eventos de parejas fijas (Feature #5)
-- =====================================================================
-- 1. pair_format en events
-- 2. pair_partner_id + pair_confirmed en event_registrations
-- 3. Actualiza v_events_list
-- 4. Bloqueo en register_for_event para eventos de pareja
-- 5. RPCs: register_for_event_pair, confirm_pair_partner,
--          remove_pair_partner, admin_assign_pair_partner,
--          check_pair_readiness
-- =====================================================================


-- ── 1. Columnas ───────────────────────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS pair_format BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS pair_partner_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pair_confirmed  BOOLEAN NOT NULL DEFAULT FALSE;

-- Agregar pair_format a plantillas también
ALTER TABLE public.event_templates
  ADD COLUMN IF NOT EXISTS pair_format BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 2. Vista v_events_list actualizada ───────────────────────────────
-- Necesita DROP+CREATE para agregar columna sin error 42P16

DROP VIEW IF EXISTS public.v_events_list;

CREATE VIEW public.v_events_list AS
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
  e.warm_up_time,
  e.pair_format,
  e.location,
  e.cancelled_at,
  e.cancellation_reason,
  e.created_at,
  COALESCE(c.name, '') AS club_name,
  public.get_event_player_count(e.id) AS players_registered
FROM public.events e
LEFT JOIN public.clubs c ON c.id = e.club_id;

GRANT SELECT ON public.v_events_list TO anon, authenticated;


-- ── 3. Bloquear register_for_event en eventos de pareja ───────────────
-- Redirige al flujo correcto desde el backend para mayor seguridad.

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
  v_gender_ok    boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés iniciar sesión para inscribirte.');
  END IF;

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

  -- Bloquear inscripción normal en eventos de parejas fijas
  IF v_event.pair_format THEN
    RETURN jsonb_build_object(
      'error',
      'Este es un evento de parejas fijas. Usá la inscripción de parejas para unirte.'
    );
  END IF;

  IF v_event.status NOT IN ('open', 'almost_full') THEN
    RETURN jsonb_build_object('error', 'Este evento no está aceptando inscripciones en este momento.');
  END IF;

  IF NOT FOUND OR NOT v_player.is_active THEN
    RETURN jsonb_build_object('error', 'No se encontró tu perfil de jugador.');
  END IF;

  -- ── Chequeo de género (con soporte de excepción) ──────────────
  IF v_event.gender_filter = 'male' THEN
    v_gender_ok := (v_player.gender = 'male')
               OR EXISTS (
                 SELECT 1 FROM gender_exception_authorizations
                 WHERE player_id = auth.uid()
                   AND event_id  = p_event_id
                   AND revoked_at IS NULL
               );
    IF NOT v_gender_ok THEN
      RETURN jsonb_build_object(
        'error',
        'Este evento es exclusivo para jugadores masculinos. '
        || 'Si tu género en el perfil es incorrecto o tenés una autorización especial, contactá al admin.'
      );
    END IF;

  ELSIF v_event.gender_filter = 'female' THEN
    v_gender_ok := (v_player.gender = 'female')
               OR EXISTS (
                 SELECT 1 FROM gender_exception_authorizations
                 WHERE player_id = auth.uid()
                   AND event_id  = p_event_id
                   AND revoked_at IS NULL
               );
    IF NOT v_gender_ok THEN
      RETURN jsonb_build_object(
        'error',
        'Este evento es exclusivo para jugadoras femeninas. '
        || 'Si tu género en el perfil es incorrecto o tenés una autorización especial, contactá al admin.'
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
        AND event_id           = p_event_id
        AND is_active          = true
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object(
      'error',
      'Tu categoría/nivel actual no está habilitado para este evento. '
      || 'Contactá al admin si creés que es un error.'
    );
  END IF;

  -- ── ¿Ya inscrito? ──────────────────────────────────────────────
  SELECT * INTO v_existing
  FROM event_registrations
  WHERE event_id = p_event_id AND player_id = auth.uid()
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status IN ('registered', 'confirmed', 'waitlist') THEN
      RETURN jsonb_build_object('error', 'Ya estás inscrito en este evento.');
    END IF;
  END IF;

  -- ── ¿Suspendido del evento específico? ─────────────────────────
  SELECT COUNT(*) INTO v_confirmed_ct
  FROM event_registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'confirmed');

  IF v_confirmed_ct >= v_event.player_limit THEN
    v_reg_status   := 'waitlist';
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
    FROM event_registrations
    WHERE event_id = p_event_id AND status = 'waitlist';
  ELSE
    v_reg_status := 'confirmed';
  END IF;

  INSERT INTO event_registrations (event_id, player_id, status, waitlist_position)
  VALUES (p_event_id, auth.uid(), v_reg_status, v_waitlist_pos)
  RETURNING id INTO v_reg_id;

  RETURN jsonb_build_object(
    'ok',     true,
    'status', v_reg_status,
    'waitlist_pos', v_waitlist_pos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid) TO authenticated;


-- ── 4. RPC: register_for_event_pair ──────────────────────────────────
-- El jugador se inscribe en un evento de parejas, opcionalmente con pareja.
-- Si especifica pareja, también la inscribe (pendiente de confirmación).

CREATE OR REPLACE FUNCTION public.register_for_event_pair(
  p_event_id   UUID,
  p_partner_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_player    profiles%ROWTYPE;
  v_partner   profiles%ROWTYPE;
  v_event     events%ROWTYPE;
  v_confirmed_ct INTEGER;
  v_reg_id    UUID;
  v_authorized BOOLEAN := FALSE;
  v_par_authorized BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés iniciar sesión para inscribirte.');
  END IF;

  SELECT * INTO v_player FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT v_player.is_active THEN
    RETURN jsonb_build_object('error', 'No se encontró tu perfil de jugador.');
  END IF;

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

  IF NOT v_event.pair_format THEN
    RETURN jsonb_build_object('error', 'Este evento no es de parejas fijas. Usá la inscripción normal.');
  END IF;

  IF v_event.status NOT IN ('open', 'almost_full') THEN
    RETURN jsonb_build_object('error', 'Este evento no está aceptando inscripciones en este momento.');
  END IF;

  -- ¿Ya inscrito?
  IF EXISTS (
    SELECT 1 FROM event_registrations
    WHERE event_id = p_event_id AND player_id = auth.uid()
      AND status IN ('registered', 'confirmed', 'waitlist')
  ) THEN
    RETURN jsonb_build_object('error', 'Ya estás inscrito en este evento.');
  END IF;

  -- Validación de nivel del jugador
  IF v_player.current_level IS NOT NULL
     AND v_player.current_level = ANY(v_event.allowed_levels) THEN
    v_authorized := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM category_promotion_authorizations
      WHERE player_id = auth.uid() AND event_id = p_event_id AND is_active = TRUE
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object(
      'error',
      'Tu categoría/nivel actual no está habilitado para este evento.'
    );
  END IF;

  -- Validación de género del jugador
  IF v_event.gender_filter = 'male' THEN
    IF v_player.gender != 'male' AND NOT EXISTS (
      SELECT 1 FROM gender_exception_authorizations
      WHERE player_id = auth.uid() AND event_id = p_event_id AND revoked_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'Este evento es exclusivo para jugadores masculinos.');
    END IF;

  ELSIF v_event.gender_filter = 'female' THEN
    IF v_player.gender != 'female' AND NOT EXISTS (
      SELECT 1 FROM gender_exception_authorizations
      WHERE player_id = auth.uid() AND event_id = p_event_id AND revoked_at IS NULL
    ) THEN
      RETURN jsonb_build_object('error', 'Este evento es exclusivo para jugadoras femeninas.');
    END IF;

  ELSIF v_event.gender_filter = 'mixed' THEN
    IF v_player.gender NOT IN ('male', 'female') THEN
      RETURN jsonb_build_object('error', 'Este evento mixto requiere género especificado en tu perfil.');
    END IF;
  END IF;

  -- Contar cupos disponibles
  SELECT COUNT(*) INTO v_confirmed_ct
  FROM event_registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'confirmed');

  -- Inscribir al jugador (confirmado desde su lado)
  INSERT INTO event_registrations (event_id, player_id, status, pair_confirmed, pair_partner_id)
  VALUES (
    p_event_id,
    auth.uid(),
    CASE WHEN v_confirmed_ct < v_event.player_limit THEN 'confirmed' ELSE 'waitlist' END,
    TRUE,
    p_partner_id   -- NULL si TBD, se actualiza si pareja confirmada
  )
  RETURNING id INTO v_reg_id;

  -- Si especificó pareja, inscribirla también (pendiente de su confirmación)
  IF p_partner_id IS NOT NULL THEN
    SELECT * INTO v_partner FROM profiles WHERE id = p_partner_id;
    IF NOT FOUND OR NOT v_partner.is_active THEN
      RETURN jsonb_build_object('error', 'La pareja seleccionada no existe o está inactiva.');
    END IF;

    IF p_partner_id = auth.uid() THEN
      RETURN jsonb_build_object('error', 'No podés ser tu propia pareja.');
    END IF;

    -- ¿Pareja ya inscrita?
    IF EXISTS (
      SELECT 1 FROM event_registrations
      WHERE event_id = p_event_id AND player_id = p_partner_id
        AND status IN ('registered', 'confirmed', 'waitlist')
    ) THEN
      -- Revertir inscripción del jugador y devolver error
      DELETE FROM event_registrations WHERE id = v_reg_id;
      RETURN jsonb_build_object('error', 'Tu pareja ya está inscrita en este evento.');
    END IF;

    -- Validación de nivel de la pareja
    IF v_partner.current_level IS NOT NULL
       AND v_partner.current_level = ANY(v_event.allowed_levels) THEN
      v_par_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM category_promotion_authorizations
        WHERE player_id = p_partner_id AND event_id = p_event_id AND is_active = TRUE
      ) INTO v_par_authorized;
    END IF;

    IF NOT v_par_authorized THEN
      DELETE FROM event_registrations WHERE id = v_reg_id;
      RETURN jsonb_build_object('error', 'El nivel de tu pareja no está habilitado para este evento.');
    END IF;

    -- Validación de género de la pareja
    IF v_event.gender_filter = 'mixed' THEN
      -- Mixto: exactamente un hombre y una mujer
      IF v_player.gender = v_partner.gender THEN
        DELETE FROM event_registrations WHERE id = v_reg_id;
        RETURN jsonb_build_object('error', 'En eventos mixtos la pareja debe ser un hombre y una mujer.');
      END IF;

    ELSIF v_event.gender_filter = 'male' THEN
      IF v_partner.gender != 'male' AND NOT EXISTS (
        SELECT 1 FROM gender_exception_authorizations
        WHERE player_id = p_partner_id AND event_id = p_event_id AND revoked_at IS NULL
      ) THEN
        DELETE FROM event_registrations WHERE id = v_reg_id;
        RETURN jsonb_build_object('error', 'El género de tu pareja no coincide con el filtro del evento.');
      END IF;

    ELSIF v_event.gender_filter = 'female' THEN
      IF v_partner.gender != 'female' AND NOT EXISTS (
        SELECT 1 FROM gender_exception_authorizations
        WHERE player_id = p_partner_id AND event_id = p_event_id AND revoked_at IS NULL
      ) THEN
        DELETE FROM event_registrations WHERE id = v_reg_id;
        RETURN jsonb_build_object('error', 'El género de tu pareja no coincide con el filtro del evento.');
      END IF;
    END IF;

    -- Inscribir a la pareja (pendiente de confirmación)
    SELECT COUNT(*) INTO v_confirmed_ct
    FROM event_registrations
    WHERE event_id = p_event_id AND status IN ('registered', 'confirmed');

    INSERT INTO event_registrations (event_id, player_id, status, pair_partner_id, pair_confirmed)
    VALUES (
      p_event_id,
      p_partner_id,
      CASE WHEN v_confirmed_ct < v_event.player_limit THEN 'confirmed' ELSE 'waitlist' END,
      auth.uid(),
      FALSE   -- la pareja debe confirmar desde su perfil
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'registration_id', v_reg_id,
    'partner_registered', p_partner_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event_pair(uuid, uuid) TO authenticated;


-- ── 5. RPC: confirm_pair_partner ─────────────────────────────────────
-- La pareja asignada acepta la asignación desde su perfil.

CREATE OR REPLACE FUNCTION public.confirm_pair_partner(p_event_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés iniciar sesión.');
  END IF;

  UPDATE event_registrations
  SET pair_confirmed = TRUE
  WHERE event_id     = p_event_id
    AND player_id    = auth.uid()
    AND pair_partner_id IS NOT NULL
    AND pair_confirmed  = FALSE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No hay asignación de pareja pendiente para este evento.');
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pair_partner(uuid) TO authenticated;


-- ── 6. RPC: remove_pair_partner ──────────────────────────────────────
-- Cualquiera de los dos desvincula la pareja — ambos quedan TBD.

CREATE OR REPLACE FUNCTION public.remove_pair_partner(p_event_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés iniciar sesión.');
  END IF;

  -- Obtener pareja actual
  SELECT pair_partner_id INTO v_partner_id
  FROM event_registrations
  WHERE event_id = p_event_id AND player_id = auth.uid();

  -- Limpiar el jugador actual
  UPDATE event_registrations
  SET pair_partner_id = NULL, pair_confirmed = FALSE
  WHERE event_id = p_event_id AND player_id = auth.uid();

  -- Limpiar el back-link de la pareja
  IF v_partner_id IS NOT NULL THEN
    UPDATE event_registrations
    SET pair_partner_id = NULL, pair_confirmed = FALSE
    WHERE event_id      = p_event_id
      AND player_id     = v_partner_id
      AND pair_partner_id = auth.uid();
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_pair_partner(uuid) TO authenticated;


-- ── 7. RPC: admin_assign_pair_partner ────────────────────────────────
-- El admin asigna/cambia manualmente la pareja de un jugador en un evento.

CREATE OR REPLACE FUNCTION public.admin_assign_pair_partner(
  p_event_id   UUID,
  p_player_id  UUID,
  p_partner_id UUID DEFAULT NULL   -- NULL para dejar TBD
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_partner_id UUID;
  v_np_old_partner UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('error', 'Solo los administradores pueden asignar parejas.');
  END IF;

  -- Obtener pareja actual del jugador
  SELECT pair_partner_id INTO v_old_partner_id
  FROM event_registrations
  WHERE event_id = p_event_id AND player_id = p_player_id;

  -- Limpiar back-link del old partner (si cambió)
  IF v_old_partner_id IS NOT NULL
     AND v_old_partner_id IS DISTINCT FROM p_partner_id THEN
    UPDATE event_registrations
    SET pair_partner_id = NULL, pair_confirmed = FALSE
    WHERE event_id      = p_event_id
      AND player_id     = v_old_partner_id
      AND pair_partner_id = p_player_id;
  END IF;

  -- Actualizar el jugador
  UPDATE event_registrations
  SET pair_partner_id = p_partner_id,
      pair_confirmed  = (p_partner_id IS NOT NULL)
  WHERE event_id = p_event_id AND player_id = p_player_id;

  -- Actualizar la nueva pareja
  IF p_partner_id IS NOT NULL THEN
    -- Limpiar old partner de la nueva pareja
    SELECT pair_partner_id INTO v_np_old_partner
    FROM event_registrations
    WHERE event_id = p_event_id AND player_id = p_partner_id;

    IF v_np_old_partner IS NOT NULL
       AND v_np_old_partner IS DISTINCT FROM p_player_id THEN
      UPDATE event_registrations
      SET pair_partner_id = NULL, pair_confirmed = FALSE
      WHERE event_id      = p_event_id
        AND player_id     = v_np_old_partner
        AND pair_partner_id = p_partner_id;
    END IF;

    UPDATE event_registrations
    SET pair_partner_id = p_player_id, pair_confirmed = TRUE
    WHERE event_id = p_event_id AND player_id = p_partner_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_pair_partner(uuid, uuid, uuid) TO authenticated;


-- ── 8. RPC: check_pair_readiness ─────────────────────────────────────
-- Devuelve si todos los jugadores confirmados tienen pareja asignada y confirmada.
-- Usado por el coordinador antes de generar rondas.

CREATE OR REPLACE FUNCTION public.check_pair_readiness(p_event_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tbd_count         INTEGER;
  v_unconfirmed_count INTEGER;
BEGIN
  -- Jugadores sin pareja asignada (TBD)
  SELECT COUNT(*) INTO v_tbd_count
  FROM event_registrations
  WHERE event_id        = p_event_id
    AND status          IN ('registered', 'confirmed')
    AND pair_partner_id IS NULL;

  -- Jugadores con pareja pero sin confirmar
  SELECT COUNT(*) INTO v_unconfirmed_count
  FROM event_registrations
  WHERE event_id        = p_event_id
    AND status          IN ('registered', 'confirmed')
    AND pair_partner_id IS NOT NULL
    AND pair_confirmed  = FALSE;

  RETURN jsonb_build_object(
    'ready',             (v_tbd_count = 0 AND v_unconfirmed_count = 0),
    'tbd_count',         v_tbd_count,
    'unconfirmed_count', v_unconfirmed_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_pair_readiness(uuid) TO authenticated;
