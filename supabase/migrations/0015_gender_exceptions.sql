-- =====================================================================
-- Padel Nation CR — Excepciones de género en eventos (4.16 / #8)
-- =====================================================================
-- 1. Tabla gender_exception_authorizations
-- 2. RPCs: grant_gender_exception, revoke_gender_exception
-- 3. register_for_event actualizado para respetar excepciones
-- =====================================================================


-- ── 1. Tabla de excepciones ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gender_exception_authorizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id  UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES public.events(id)    ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes      TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.profiles(id),
  UNIQUE (player_id, event_id)
);

ALTER TABLE public.gender_exception_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_gender_exceptions"
  ON public.gender_exception_authorizations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'coordinator')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.gender_exception_authorizations TO authenticated;


-- ── 2a. RPC: otorgar excepción ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_gender_exception(
  p_player_id UUID,
  p_event_id  UUID,
  p_notes     TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('error', 'Sin permisos para otorgar excepciones de género.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('error', 'Evento no encontrado.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_player_id AND is_active = true) THEN
    RETURN jsonb_build_object('error', 'Jugador no encontrado o inactivo.');
  END IF;

  INSERT INTO gender_exception_authorizations (player_id, event_id, granted_by, notes)
  VALUES (p_player_id, p_event_id, v_actor, p_notes)
  ON CONFLICT (player_id, event_id) DO UPDATE
    SET revoked_at = NULL,
        revoked_by = NULL,
        notes      = EXCLUDED.notes,
        granted_at = NOW(),
        granted_by = EXCLUDED.granted_by;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_actor, 'gender_exception_granted', 'player', p_player_id,
    jsonb_build_object('event_id', p_event_id, 'notes', p_notes)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_gender_exception(uuid, uuid, text) TO authenticated;


-- ── 2b. RPC: revocar excepción ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_gender_exception(p_exception_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_player   uuid;
  v_event    uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN jsonb_build_object('error', 'Sin permisos para revocar excepciones de género.');
  END IF;

  SELECT player_id, event_id INTO v_player, v_event
  FROM gender_exception_authorizations
  WHERE id = p_exception_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Excepción no encontrada.');
  END IF;

  UPDATE gender_exception_authorizations
  SET revoked_at = NOW(), revoked_by = v_actor
  WHERE id = p_exception_id;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (
    v_actor, 'gender_exception_revoked', 'player', v_player,
    jsonb_build_object('event_id', v_event, 'exception_id', p_exception_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_gender_exception(uuid) TO authenticated;


-- ── 3. register_for_event actualizado con soporte de excepciones ───
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
