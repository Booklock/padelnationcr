-- =====================================================================
-- Padel Nation CR — Generación de rondas en backend (3.6)
-- =====================================================================
-- generate_round(p_event_id)
--   · Determina el número de la próxima ronda
--   · Ronda 1: orden aleatorio de jugadores confirmados
--   · Ronda N: orden por puntos acumulados DESC (suma de scores, con random()
--              como desempate secundario para evitar empates perfectos)
--   · Grupos de 4: Team A = [pos 1, pos 4] · Team B = [pos 2, pos 3]
--   · Inserta los partidos en la tabla matches con status = 'pending'
--   · Retorna los partidos generados como JSONB
-- =====================================================================

CREATE OR REPLACE FUNCTION public.generate_round(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_next_round   int;
  v_player_count int;
  v_court_num    int  := 0;
  v_sorted_ids   uuid[];
  v_generated    jsonb := '[]'::jsonb;
  v_match_id     uuid;
  v_team_a       uuid[];
  v_team_b       uuid[];
  i              int;
BEGIN
  -- ── 1. Verificar permisos ──────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_actor
      AND role IN ('admin', 'super_admin', 'coordinator')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para generar rondas.';
  END IF;

  -- ── 2. Verificar que el evento existe y está activo ────────────────
  IF NOT EXISTS (
    SELECT 1 FROM events
    WHERE id = p_event_id
      AND status NOT IN ('finished', 'cancelled', 'draft')
  ) THEN
    RAISE EXCEPTION 'Evento no encontrado, ya finalizado o cancelado.';
  END IF;

  -- ── 3. Determinar número de la próxima ronda ──────────────────────
  SELECT COALESCE(MAX(round_number), 0) + 1
  INTO   v_next_round
  FROM   matches
  WHERE  event_id = p_event_id;

  -- ── 4. Si hay ronda previa, verificar que está completa ───────────
  IF v_next_round > 1 THEN
    IF EXISTS (
      SELECT 1 FROM matches
      WHERE event_id    = p_event_id
        AND round_number = v_next_round - 1
        AND status      <> 'finished'
    ) THEN
      RAISE EXCEPTION 'Hay partidos sin terminar en la ronda %. Guardá todos los resultados antes de continuar.', v_next_round - 1;
    END IF;
  END IF;

  -- ── 5. Obtener jugadores ordenados ────────────────────────────────
  IF v_next_round = 1 THEN
    -- Ronda 1: orden completamente aleatorio
    SELECT array_agg(er.player_id ORDER BY random())
    INTO   v_sorted_ids
    FROM   event_registrations er
    WHERE  er.event_id = p_event_id
      AND  er.status   = 'confirmed';

  ELSE
    -- Ronda N: ordenar por puntos acumulados DESC
    -- Puntos = suma de scores obtenidos en todos los partidos finalizados
    WITH player_scores AS (
      SELECT unnest(team_a_player_ids) AS player_id,
             team_a_score             AS score
      FROM   matches
      WHERE  event_id = p_event_id AND status = 'finished'
      UNION ALL
      SELECT unnest(team_b_player_ids),
             team_b_score
      FROM   matches
      WHERE  event_id = p_event_id AND status = 'finished'
    ),
    standings AS (
      SELECT player_id,
             COALESCE(SUM(score), 0) AS event_points
      FROM   player_scores
      GROUP  BY player_id
    ),
    all_confirmed AS (
      SELECT er.player_id,
             COALESCE(s.event_points, 0) AS event_points
      FROM   event_registrations er
      LEFT   JOIN standings s ON s.player_id = er.player_id
      WHERE  er.event_id = p_event_id
        AND  er.status   = 'confirmed'
    )
    SELECT array_agg(player_id ORDER BY event_points DESC, random())
    INTO   v_sorted_ids
    FROM   all_confirmed;
  END IF;

  -- ── 6. Validar que hay suficientes jugadores ──────────────────────
  v_player_count := COALESCE(array_length(v_sorted_ids, 1), 0);

  IF v_player_count < 4 THEN
    RAISE EXCEPTION 'Se necesitan al menos 4 jugadores confirmados para generar una ronda (hay %).', v_player_count;
  END IF;

  -- ── 7. Generar partidos en grupos de 4 ────────────────────────────
  -- Asignación: [pos 1 + pos 4] vs [pos 2 + pos 3]
  -- Se descartan los jugadores sobrantes al final (no caben en grupo de 4)
  i := 1;
  WHILE i + 3 <= v_player_count LOOP
    v_court_num := v_court_num + 1;
    v_team_a    := ARRAY[ v_sorted_ids[i],   v_sorted_ids[i+3] ];
    v_team_b    := ARRAY[ v_sorted_ids[i+1], v_sorted_ids[i+2] ];

    INSERT INTO matches (
      event_id, round_number, court_number,
      team_a_player_ids, team_b_player_ids, status
    )
    VALUES (
      p_event_id, v_next_round, v_court_num,
      v_team_a, v_team_b, 'pending'
    )
    RETURNING id INTO v_match_id;

    v_generated := v_generated || jsonb_build_object(
      'id',                 v_match_id,
      'round_number',       v_next_round,
      'court_number',       v_court_num,
      'team_a_player_ids',  v_team_a,
      'team_b_player_ids',  v_team_b,
      'status',             'pending',
      'team_a_score',       null,
      'team_b_score',       null
    );

    i := i + 4;
  END LOOP;

  IF v_court_num = 0 THEN
    RAISE EXCEPTION 'No se pudieron generar partidos. Verificá que haya jugadores confirmados.';
  END IF;

  RETURN jsonb_build_object(
    'round',   v_next_round,
    'courts',  v_court_num,
    'matches', v_generated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_round(uuid) TO authenticated;
