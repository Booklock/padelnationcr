-- =====================================================================
-- Padel Nation CR — Vistas, helpers y ajustes para el frontend
-- =====================================================================
-- 1. Campo location en events (texto libre para MVP)
-- 2. Función para contar inscripciones (security definer, bypasa RLS)
-- 3. Vista v_events_list con conteo de inscritos
-- 4. Grants para anon / authenticated sobre vistas y funciones
-- =====================================================================

-- 1. Campo location en events
alter table public.events add column if not exists location text;

-- 2. Función de conteo de inscritos confirmados por evento
--    security definer → corre como postgres → bypasa RLS → conteo real
create or replace function public.get_event_player_count(event_uuid uuid)
returns integer as $$
  select count(*)::integer
  from public.event_registrations
  where event_id = event_uuid
    and status = 'confirmed'
$$ language sql stable security definer set search_path = public;

-- 3. Vista unificada de eventos para el frontend
create or replace view public.v_events_list as
select
  e.id,
  e.title,
  e.format,
  e.category_code,
  e.allowed_levels,
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
  e.created_at,
  coalesce(c.name, '') as club_name,
  public.get_event_player_count(e.id) as players_registered
from public.events e
left join public.clubs c on c.id = e.club_id;

-- 4. Grants para vistas y funciones
grant select on public.v_events_list          to anon, authenticated;
grant select on public.v_ranking_individual   to anon, authenticated;
grant select on public.v_ranking_pairs        to anon, authenticated;

grant execute on function public.get_event_player_count(uuid) to anon, authenticated;
grant execute on function public.is_admin()                   to authenticated;
grant execute on function public.is_coordinator_or_above()    to authenticated;
