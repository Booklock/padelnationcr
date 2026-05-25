-- =====================================================================
-- Padel Nation CR — Nuevos campos de perfil + tiempo de calentamiento
-- =====================================================================
-- 1. nickname y preferred_side en profiles
-- 2. warm_up_time en events
-- 3. Actualiza v_events_list para incluir warm_up_time
-- 4. Actualiza trigger handle_new_user para mapear nuevos campos
-- =====================================================================


-- ── 1. Columnas en profiles ────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname       TEXT,
  ADD COLUMN IF NOT EXISTS preferred_side TEXT
    CHECK (preferred_side IN ('right', 'left', 'both'));


-- ── 2. Columna warm_up_time en events ─────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS warm_up_time INTEGER NOT NULL DEFAULT 0;


-- ── 3. Vista v_events_list actualizada ────────────────────────────
-- DROP primero para poder agregar columna nueva sin error 42P16
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
  e.location,
  e.cancelled_at,
  e.cancellation_reason,
  e.created_at,
  COALESCE(c.name, '') AS club_name,
  public.get_event_player_count(e.id) AS players_registered
FROM public.events e
LEFT JOIN public.clubs c ON c.id = e.club_id;

GRANT SELECT ON public.v_events_list TO anon, authenticated;


-- ── 4. Trigger handle_new_user — mapea nickname y preferred_side ───
-- Reemplaza la función existente para incluir los nuevos campos.
-- Mantiene misma lógica de 0006 (enum gender, role, exception handler).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    gender,
    current_category,
    current_level,
    nickname,
    preferred_side,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'),            ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'gender')::gender,
      'unspecified'::gender
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'current_category'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'current_level'),    ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'),         ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_side'),   ''),
    'player'::user_role
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING '[handle_new_user] Error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;
