-- =====================================================================
-- Padel Nation CR — Sistema de no-show y reputación (4.3)
-- =====================================================================
-- 1. app_settings — configuración de la plataforma (threshold, días)
-- 2. Columnas en profiles: no_show_count, suspended_until, suspension_reason
-- 3. Columnas en event_registrations: no_show, no_show_marked_by, no_show_marked_at
-- 4. mark_no_show()          — coordinador/admin marca o desmarca no-show
-- 5. rehabilitate_player()   — admin rehabilita a un jugador suspendido
-- 6. update_app_setting()    — admin actualiza configuración
-- 7. register_for_event      — actualizado: bloquea inscripción si suspendido
-- =====================================================================

-- ── 1. app_settings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_settings"  ON public.app_settings;
DROP POLICY IF EXISTS "admins_write_settings" ON public.app_settings;

CREATE POLICY "anyone_read_settings"
  ON public.app_settings FOR SELECT USING (true);

-- Los writes solo van a través de update_app_setting (SECURITY DEFINER)
-- No se permite escritura directa desde el cliente

-- Valores por defecto
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('no_show_threshold', '3',  'Cantidad de no-shows para suspender automáticamente a un jugador'),
  ('suspension_days',   '30', 'Duración de la suspensión automática en días')
ON CONFLICT (key) DO NOTHING;


-- ── 2. Columnas en profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS no_show_count     INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;


-- ── 3. Columnas en event_registrations ────────────────────────────────
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS no_show           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS no_show_marked_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMPTZ;


-- ── 4. mark_no_show ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_no_show(
  p_registration_id uuid,
  p_is_no_show      boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_reg       record;
  v_threshold int;
  v_susp_days int;
  v_new_count int;
  v_suspended boolean := false;
BEGIN
  -- Verificar permisos
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor AND role IN ('admin', 'super_admin', 'coordinator')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para marcar no-show.';
  END IF;

  -- Obtener la inscripción
  SELECT * INTO v_reg FROM event_registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inscripción no encontrada.';
  END IF;

  -- Marcar / desmarcar no-show
  UPDATE event_registrations
  SET no_show           = p_is_no_show,
      no_show_marked_by = CASE WHEN p_is_no_show THEN v_actor  ELSE NULL END,
      no_show_marked_at = CASE WHEN p_is_no_show THEN NOW()    ELSE NULL END
  WHERE id = p_registration_id;

  -- Recalcular contador (desde cero para evitar desincronización)
  SELECT COUNT(*) INTO v_new_count
  FROM event_registrations
  WHERE player_id = v_reg.player_id AND no_show = TRUE;

  UPDATE profiles SET no_show_count = v_new_count WHERE id = v_reg.player_id;

  -- Leer configuración
  SELECT COALESCE(value::int, 3)  INTO v_threshold FROM app_settings WHERE key = 'no_show_threshold';
  SELECT COALESCE(value::int, 30) INTO v_susp_days FROM app_settings WHERE key = 'suspension_days';

  IF p_is_no_show AND v_new_count >= v_threshold THEN
    -- Auto-suspender (solo si no está ya suspendido más tiempo)
    UPDATE profiles
    SET suspended_until   = NOW() + (v_susp_days || ' days')::interval,
        suspension_reason = 'Suspendido automáticamente por ' || v_new_count || ' no-shows.'
    WHERE id = v_reg.player_id
      AND (suspended_until IS NULL OR suspended_until < NOW() + (v_susp_days || ' days')::interval);
    v_suspended := true;

  ELSIF NOT p_is_no_show AND v_new_count < v_threshold THEN
    -- Desmarcar: si baja del umbral, limpiar suspensión automática
    UPDATE profiles
    SET suspended_until   = NULL,
        suspension_reason = NULL
    WHERE id = v_reg.player_id
      AND suspension_reason LIKE 'Suspendido automáticamente%';
  END IF;

  -- Auditoría
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_data)
  VALUES (
    v_actor,
    CASE WHEN p_is_no_show THEN 'no_show_marked' ELSE 'no_show_cleared' END,
    'registration',
    p_registration_id::text,
    jsonb_build_object(
      'player_id',     v_reg.player_id,
      'event_id',      v_reg.event_id,
      'no_show_count', v_new_count,
      'suspended',     v_suspended
    )
  );

  RETURN jsonb_build_object(
    'ok',            true,
    'no_show_count', v_new_count,
    'suspended',     v_suspended
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_no_show(uuid, boolean) TO authenticated;


-- ── 5. rehabilitate_player ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rehabilitate_player(p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_actor AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Solo admins pueden rehabilitar jugadores.';
  END IF;

  UPDATE profiles
  SET suspended_until   = NULL,
      suspension_reason = NULL
  WHERE id = p_player_id;

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id)
  VALUES (v_actor, 'player_rehabilitated', 'profile', p_player_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rehabilitate_player(uuid) TO authenticated;


-- ── 6. update_app_setting ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_app_setting(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Solo admins pueden cambiar la configuración.';
  END IF;

  UPDATE app_settings
  SET value = p_value, updated_at = NOW()
  WHERE key = p_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuración "%" no encontrada.', p_key;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_app_setting(text, text) TO authenticated;


-- ── 7. register_for_event — con chequeo de suspensión ─────────────────
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

  -- ── Chequeo de suspensión ─────────────────────────────────────────
  SELECT * INTO v_player FROM profiles WHERE id = auth.uid();

  IF v_player.suspended_until IS NOT NULL AND v_player.suspended_until > NOW() THEN
    RETURN jsonb_build_object(
      'error',
      'Tu cuenta está suspendida hasta el '
        || TO_CHAR(v_player.suspended_until AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY')
        || '. Contactá al admin si creés que es un error.'
    );
  END IF;
  -- ─────────────────────────────────────────────────────────────────

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

  -- Validación de nivel
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
