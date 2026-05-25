-- =====================================================================
-- Padel Nation CR — Plantillas de eventos reutilizables (#4)
-- =====================================================================
-- Permite al admin guardar configuraciones como plantilla y reutilizarlas
-- al crear nuevos eventos (pre-rellena el formulario).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.event_templates (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT    NOT NULL,
  format              TEXT    NOT NULL DEFAULT 'mexicano',
  allowed_levels      TEXT[]  NOT NULL DEFAULT '{}',
  gender_filter       TEXT    NOT NULL DEFAULT 'any'
    CHECK (gender_filter IN ('any', 'male', 'female', 'mixed')),
  location            TEXT,
  player_limit        INTEGER NOT NULL DEFAULT 16,
  courts              INTEGER NOT NULL DEFAULT 4,
  rounds              INTEGER NOT NULL DEFAULT 4,
  match_end_criterion TEXT    NOT NULL DEFAULT 'time',
  match_end_value     INTEGER NOT NULL DEFAULT 15,
  warm_up_time        INTEGER NOT NULL DEFAULT 0,
  price_crc           INTEGER NOT NULL DEFAULT 0,
  prize_description   TEXT,
  -- Reglas de puntos serializadas: [{position, points}, ...]
  point_rules         JSONB   NOT NULL DEFAULT '[]',
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver y gestionar plantillas
CREATE POLICY "admins_manage_templates"
  ON public.event_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_templates TO authenticated;
