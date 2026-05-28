-- =====================================================================
-- Padel Nation CR — Retos individuales (2.7b)
-- =====================================================================
-- 1. challenge_points en profiles → suma al ranking individual
-- 2. Actualiza v_ranking_individual
-- 3. Tabla individual_challenges + RLS
-- 4. RPCs:
--    · create_individual_challenge   — jugador A crea el reto
--    · respond_individual_challenge  — jugador B acepta/rechaza
--    · admin_review_challenge        — admin aprueba/rechaza + asigna cancha/fecha
--    · admin_complete_challenge      — admin ingresa resultado, transfiere puntos
-- =====================================================================

-- ── 1. Puntos de retos en profiles ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS challenge_points INT NOT NULL DEFAULT 0;

-- ── 2. Vista ranking individual (incluye challenge_points) ────────────
CREATE OR REPLACE VIEW public.v_ranking_individual AS
SELECT
  p.id                                                                       AS player_id,
  p.full_name,
  p.current_category                                                         AS category_code,
  p.current_level                                                            AS level_code,
  COALESCE(SUM(per.points_earned) FILTER (WHERE per.excluded = false), 0)
    + p.challenge_points                                                     AS total_points,
  COUNT(*) FILTER (WHERE per.excluded = false)                               AS events_counted,
  RANK() OVER (
    ORDER BY (
      COALESCE(SUM(per.points_earned) FILTER (WHERE per.excluded = false), 0)
      + p.challenge_points
    ) DESC
  )                                                                          AS position
FROM public.profiles p
LEFT JOIN public.player_event_results per ON per.player_id = p.id
WHERE p.is_active = true AND p.role = 'player'
GROUP BY p.id;

-- ── 3. Tabla de retos individuales ───────────────────────────────────
CREATE TABLE public.individual_challenges (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id         UUID        NOT NULL REFERENCES public.profiles(id),
  challenged_id         UUID        NOT NULL REFERENCES public.profiles(id),
  challenger_partner_id UUID        NOT NULL REFERENCES public.profiles(id),
  challenged_partner_id UUID        REFERENCES public.profiles(id),   -- se llena al aceptar
  points_wagered        INTEGER     NOT NULL CHECK (points_wagered BETWEEN 5 AND 20),
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                      'pending','accepted','approved',
                                      'rejected','completed','cancelled','expired'
                                    )),
  scheduled_date        TIMESTAMPTZ,
  court                 TEXT,
  admin_notes           TEXT,
  winner_pair           TEXT        CHECK (winner_pair IN ('challenger','challenged')),
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ic_no_self      CHECK (challenger_id <> challenged_id),
  CONSTRAINT ic_partner_self CHECK (challenger_partner_id <> challenger_id),
  CONSTRAINT ic_partner_riv  CHECK (challenger_partner_id <> challenged_id)
);

CREATE INDEX idx_ic_challenger ON public.individual_challenges(challenger_id);
CREATE INDEX idx_ic_challenged  ON public.individual_challenges(challenged_id);
CREATE INDEX idx_ic_status      ON public.individual_challenges(status);

-- ── 4. RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.individual_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_player_select" ON public.individual_challenges
  FOR SELECT USING (
    auth.uid() IN (
      challenger_id, challenged_id,
      challenger_partner_id, challenged_partner_id
    )
  );

CREATE POLICY "ic_admin_select" ON public.individual_challenges
  FOR SELECT USING (is_admin());

-- ── Helper inline: puntos totales de un jugador ───────────────────────
-- (reutilizado en las 4 RPCs)
-- total = challenge_points + SUM(non-excluded event results)

-- ── 5. create_individual_challenge ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_individual_challenge(
  p_challenged_id         UUID,
  p_challenger_partner_id UUID,
  p_points_wagered        INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me           UUID    := auth.uid();
  v_my_level     TEXT;
  v_their_level  TEXT;
  v_pts          INTEGER;
  v_challenge_id UUID;
BEGIN
  IF v_me IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  IF p_points_wagered NOT BETWEEN 5 AND 20 THEN
    RETURN jsonb_build_object('error', 'Los puntos deben estar entre 5 y 20');
  END IF;
  IF v_me = p_challenged_id THEN
    RETURN jsonb_build_object('error', 'No podés retarte a vos mismo');
  END IF;
  IF p_challenger_partner_id = v_me OR p_challenger_partner_id = p_challenged_id THEN
    RETURN jsonb_build_object('error', 'Tu pareja no puede ser vos mismo ni el retado');
  END IF;

  -- Mismo nivel
  SELECT current_level INTO v_my_level    FROM profiles WHERE id = v_me;
  SELECT current_level INTO v_their_level FROM profiles WHERE id = p_challenged_id;
  IF v_my_level IS DISTINCT FROM v_their_level THEN
    RETURN jsonb_build_object('error', 'Solo podés retar a jugadores del mismo nivel');
  END IF;

  -- Sin reto activo entre estos dos jugadores
  IF EXISTS (
    SELECT 1 FROM individual_challenges
    WHERE status IN ('pending','accepted','approved')
      AND (
        (challenger_id = v_me          AND challenged_id = p_challenged_id)
        OR (challenger_id = p_challenged_id AND challenged_id = v_me)
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Ya existe un reto activo entre estos jugadores');
  END IF;

  -- Puntos del retador
  SELECT p.challenge_points
       + COALESCE((SELECT SUM(per.points_earned) FROM player_event_results per
                   WHERE per.player_id = v_me AND per.excluded = false), 0)
  INTO v_pts FROM profiles p WHERE p.id = v_me;
  IF v_pts < p_points_wagered THEN
    RETURN jsonb_build_object('error', 'No tenés suficientes puntos (' || v_pts || ' disponibles)');
  END IF;

  -- Puntos de la pareja del retador
  SELECT p.challenge_points
       + COALESCE((SELECT SUM(per.points_earned) FROM player_event_results per
                   WHERE per.player_id = p_challenger_partner_id AND per.excluded = false), 0)
  INTO v_pts FROM profiles p WHERE p.id = p_challenger_partner_id;
  IF v_pts < p_points_wagered THEN
    RETURN jsonb_build_object('error', 'Tu pareja no tiene suficientes puntos (' || v_pts || ' disponibles)');
  END IF;

  -- Crear reto
  INSERT INTO individual_challenges (
    challenger_id, challenged_id, challenger_partner_id,
    points_wagered, expires_at
  ) VALUES (
    v_me, p_challenged_id, p_challenger_partner_id,
    p_points_wagered, now() + INTERVAL '48 hours'
  ) RETURNING id INTO v_challenge_id;

  -- Notificar al retado
  INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
  VALUES (
    p_challenged_id, 'challenge_received', 'inapp',
    'individual_challenge', v_challenge_id::text,
    jsonb_build_object(
      'title', 'Nuevo reto recibido',
      'body',  (SELECT full_name FROM profiles WHERE id = v_me)
               || ' te retó. Tenés 48h para responder.',
      'points_wagered', p_points_wagered
    )
  );

  RETURN jsonb_build_object('success', true, 'challenge_id', v_challenge_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_individual_challenge(UUID, UUID, INTEGER) TO authenticated;

-- ── 6. respond_individual_challenge ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_individual_challenge(
  p_challenge_id UUID,
  p_accept       BOOLEAN,
  p_partner_id   UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    UUID    := auth.uid();
  v_ch    individual_challenges%ROWTYPE;
  v_pts   INTEGER;
  v_adm   UUID;
BEGIN
  SELECT * INTO v_ch FROM individual_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Reto no encontrado'); END IF;
  IF v_ch.challenged_id <> v_me  THEN RETURN jsonb_build_object('error', 'No estás autorizado'); END IF;
  IF v_ch.status <> 'pending'    THEN RETURN jsonb_build_object('error', 'Este reto ya no está pendiente'); END IF;

  IF now() > v_ch.expires_at THEN
    UPDATE individual_challenges SET status = 'expired', updated_at = now() WHERE id = p_challenge_id;
    RETURN jsonb_build_object('error', 'El reto ya expiró');
  END IF;

  -- Rechazar
  IF NOT p_accept THEN
    UPDATE individual_challenges SET status = 'cancelled', updated_at = now() WHERE id = p_challenge_id;
    RETURN jsonb_build_object('success', true, 'action', 'cancelled');
  END IF;

  -- Aceptar: necesita pareja
  IF p_partner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Debés elegir una pareja para aceptar');
  END IF;
  IF p_partner_id = v_me OR p_partner_id = v_ch.challenger_id THEN
    RETURN jsonb_build_object('error', 'La pareja no puede ser vos mismo ni el retador');
  END IF;

  -- Re-verificar los 4 jugadores
  FOREACH v_adm IN ARRAY ARRAY[
    v_ch.challenger_id, v_ch.challenger_partner_id, v_me, p_partner_id
  ] LOOP
    SELECT p.challenge_points
         + COALESCE((SELECT SUM(per.points_earned) FROM player_event_results per
                     WHERE per.player_id = v_adm AND per.excluded = false), 0)
    INTO v_pts FROM profiles p WHERE p.id = v_adm;
    IF v_pts < v_ch.points_wagered THEN
      RETURN jsonb_build_object('error',
        'Uno de los jugadores no tiene suficientes puntos ('
        || (SELECT full_name FROM profiles WHERE id = v_adm)
        || ': ' || v_pts || ' pts)');
    END IF;
  END LOOP;

  UPDATE individual_challenges
  SET status = 'accepted', challenged_partner_id = p_partner_id, updated_at = now()
  WHERE id = p_challenge_id;

  -- Notificar admins
  FOR v_adm IN SELECT id FROM profiles WHERE role IN ('admin','super_admin') AND is_active
  LOOP
    INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
    VALUES (
      v_adm, 'challenge_pending_review', 'inapp',
      'individual_challenge', p_challenge_id::text,
      jsonb_build_object(
        'title', 'Reto pendiente de aprobación',
        'body',  'Un reto individual fue aceptado y requiere revisión.'
      )
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'action', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_individual_challenge(UUID, BOOLEAN, UUID) TO authenticated;

-- ── 7. admin_review_challenge ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_challenge(
  p_challenge_id   UUID,
  p_approve        BOOLEAN,
  p_court          TEXT        DEFAULT NULL,
  p_scheduled_date TIMESTAMPTZ DEFAULT NULL,
  p_notes          TEXT        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch    individual_challenges%ROWTYPE;
  v_pts   INTEGER;
  v_pid   UUID;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('error', 'No autorizado'); END IF;

  SELECT * INTO v_ch FROM individual_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Reto no encontrado'); END IF;
  IF v_ch.status <> 'accepted' THEN
    RETURN jsonb_build_object('error', 'El reto debe estar en estado aceptado');
  END IF;

  IF NOT p_approve THEN
    UPDATE individual_challenges
    SET status = 'rejected', admin_notes = p_notes, updated_at = now()
    WHERE id = p_challenge_id;

    INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
    VALUES (
      v_ch.challenger_id, 'challenge_rejected', 'inapp',
      'individual_challenge', p_challenge_id::text,
      jsonb_build_object(
        'title', 'Reto rechazado',
        'body',  'El admin rechazó tu reto.'
                 || COALESCE(' Motivo: ' || p_notes, '')
      )
    );
    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;

  -- Aprobar: re-verificar los 4
  FOREACH v_pid IN ARRAY ARRAY[
    v_ch.challenger_id, v_ch.challenger_partner_id,
    v_ch.challenged_id, v_ch.challenged_partner_id
  ] LOOP
    SELECT p.challenge_points
         + COALESCE((SELECT SUM(per.points_earned) FROM player_event_results per
                     WHERE per.player_id = v_pid AND per.excluded = false), 0)
    INTO v_pts FROM profiles p WHERE p.id = v_pid;
    IF v_pts < v_ch.points_wagered THEN
      RETURN jsonb_build_object('error',
        'Un jugador ya no tiene puntos suficientes: '
        || (SELECT full_name FROM profiles WHERE id = v_pid)
        || ' (' || v_pts || ' pts disponibles)');
    END IF;
  END LOOP;

  UPDATE individual_challenges
  SET status         = 'approved',
      court          = p_court,
      scheduled_date = p_scheduled_date,
      admin_notes    = p_notes,
      updated_at     = now()
  WHERE id = p_challenge_id;

  -- Notificar a los 4
  FOREACH v_pid IN ARRAY ARRAY[
    v_ch.challenger_id, v_ch.challenger_partner_id,
    v_ch.challenged_id, v_ch.challenged_partner_id
  ] LOOP
    INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
    VALUES (
      v_pid, 'challenge_approved', 'inapp',
      'individual_challenge', p_challenge_id::text,
      jsonb_build_object(
        'title', 'Reto aprobado',
        'body',  'Tu reto fue aprobado.'
          || CASE WHEN p_scheduled_date IS NOT NULL
                  THEN ' Fecha: ' || to_char(
                    p_scheduled_date AT TIME ZONE 'America/Costa_Rica',
                    'DD/MM/YYYY HH24:MI')
                  ELSE '' END
          || CASE WHEN p_court IS NOT NULL THEN ' | Cancha: ' || p_court ELSE '' END
      )
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'action', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_challenge(UUID, BOOLEAN, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- ── 8. admin_complete_challenge ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_complete_challenge(
  p_challenge_id UUID,
  p_winner_pair  TEXT          -- 'challenger' | 'challenged'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch  individual_challenges%ROWTYPE;
  v_w1  UUID; v_w2 UUID;
  v_l1  UUID; v_l2 UUID;
  v_pts INTEGER;
  v_pid UUID;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('error', 'No autorizado'); END IF;
  IF p_winner_pair NOT IN ('challenger','challenged') THEN
    RETURN jsonb_build_object('error', 'winner_pair debe ser challenger o challenged');
  END IF;

  SELECT * INTO v_ch FROM individual_challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Reto no encontrado'); END IF;
  IF v_ch.status <> 'approved' THEN
    RETURN jsonb_build_object('error', 'El reto debe estar aprobado para cerrarlo');
  END IF;

  IF p_winner_pair = 'challenger' THEN
    v_w1 := v_ch.challenger_id;  v_w2 := v_ch.challenger_partner_id;
    v_l1 := v_ch.challenged_id;  v_l2 := v_ch.challenged_partner_id;
  ELSE
    v_w1 := v_ch.challenged_id;  v_w2 := v_ch.challenged_partner_id;
    v_l1 := v_ch.challenger_id;  v_l2 := v_ch.challenger_partner_id;
  END IF;

  -- Verificar puntos de los perdedores
  FOREACH v_pid IN ARRAY ARRAY[v_l1, v_l2] LOOP
    SELECT p.challenge_points
         + COALESCE((SELECT SUM(per.points_earned) FROM player_event_results per
                     WHERE per.player_id = v_pid AND per.excluded = false), 0)
    INTO v_pts FROM profiles p WHERE p.id = v_pid;
    IF v_pts < v_ch.points_wagered THEN
      RETURN jsonb_build_object('error',
        'Un perdedor ya no tiene puntos suficientes: '
        || (SELECT full_name FROM profiles WHERE id = v_pid)
        || ' (' || v_pts || ' pts)');
    END IF;
  END LOOP;

  -- Transferir
  UPDATE public.profiles
  SET challenge_points = challenge_points + v_ch.points_wagered
  WHERE id IN (v_w1, v_w2);

  UPDATE public.profiles
  SET challenge_points = challenge_points - v_ch.points_wagered
  WHERE id IN (v_l1, v_l2);

  -- Cerrar
  UPDATE individual_challenges
  SET status = 'completed', winner_pair = p_winner_pair, updated_at = now()
  WHERE id = p_challenge_id;

  -- Auditoría
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after_data)
  VALUES (
    auth.uid(), 'complete_individual_challenge',
    'individual_challenge', p_challenge_id::text,
    jsonb_build_object(
      'winner_pair',       p_winner_pair,
      'points_transferred', v_ch.points_wagered
    )
  );

  -- Notificaciones
  FOREACH v_pid IN ARRAY ARRAY[v_w1, v_w2] LOOP
    INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
    VALUES (
      v_pid, 'challenge_won', 'inapp',
      'individual_challenge', p_challenge_id::text,
      jsonb_build_object(
        'title', '¡Ganaste el reto!',
        'body',  '+' || v_ch.points_wagered || ' pts añadidos a tu cuenta.'
      )
    );
  END LOOP;

  FOREACH v_pid IN ARRAY ARRAY[v_l1, v_l2] LOOP
    INSERT INTO notifications (recipient_id, type, channel, entity_type, entity_id, payload)
    VALUES (
      v_pid, 'challenge_lost', 'inapp',
      'individual_challenge', p_challenge_id::text,
      jsonb_build_object(
        'title', 'Perdiste el reto',
        'body',  '−' || v_ch.points_wagered || ' pts de tu cuenta.'
      )
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'points_transferred', v_ch.points_wagered);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_challenge(UUID, TEXT) TO authenticated;
