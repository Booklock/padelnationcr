-- =====================================================================
-- Padel Nation CR — Schema inicial
-- Postgres 15+ (Supabase)
-- =====================================================================
--
-- Estructura general:
--   1. Extensiones
--   2. Tipos enumerados
--   3. Catálogos       (categories, levels, clubs, seasons)
--   4. Profiles        (extiende auth.users de Supabase Auth)
--   5. Eventos         (events, event_point_rules, event_registrations)
--   6. Partidos        (matches)
--   7. Resultados      (player_event_results, pair_event_results)
--   8. Retos           (challenges)
--   9. Parejas fijas   (fixed_pairs)
--  10. Cambios de cat. (player_category_history, authorizations)
--  11. Auditoría + Notificaciones
--  12. Vistas de ranking
--
-- Notas de diseño:
--   - UUID en todo (consistente con auth.users de Supabase).
--   - Resultados se ALMACENAN en `player_event_results.points_earned`
--     pero el ranking se calcula como suma WHERE excluded = false,
--     lo que permite al admin "ignorar" malos resultados sin borrarlos.
--   - Empates en matches: un partido PUEDE terminar empatado y es un resultado válido.
--     El desempate se aplica solo al final del POZO cuando dos jugadores quedan
--     con el mismo total de puntos: orden -> wins -> ties -> head_to_head_diff.
--   - Reto: el CHECK del 5-de-diferencia se valida en BD, no solo en app.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 2. Enums
-- =====================================================================
create type user_role            as enum ('super_admin','admin','coordinator','player');
create type event_format         as enum ('mexicano','americano','reto','torneo');
create type event_status         as enum ('draft','open','almost_full','closed','in_progress','finished','cancelled');
create type match_end_criterion  as enum ('time','games','points');
create type registration_status  as enum ('confirmed','waitlist','cancelled');
create type match_status         as enum ('pending','in_progress','finished');
create type challenge_status     as enum ('pending','accepted','rejected','completed','cancelled','expired');
create type pair_status          as enum ('pending','active','dissolved');
create type gender               as enum ('male','female','mixed','unspecified');

-- =====================================================================
-- 3. Catálogos
-- =====================================================================
create table categories (
  code         text primary key,             -- 'AA','A','B','C','D'
  display_name text not null,
  rank         int  not null unique          -- 1 = más alta
);

create table levels (
  code          text primary key,            -- 'AA','A+','A','A-', etc.
  category_code text not null references categories(code) on delete restrict,
  rank          int  not null unique
);

create table clubs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  location      text,
  contact_phone text,
  contact_email text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,           -- '2026'
  starts_at  date not null,
  ends_at    date,
  is_active  boolean not null default true
);

-- =====================================================================
-- 4. Profiles (1-1 con auth.users)
-- =====================================================================
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null,
  email            text not null unique,
  phone            text,
  role             user_role not null default 'player',
  current_category text references categories(code),
  current_level    text references levels(code),
  gender           gender not null default 'unspecified',
  avatar_url       text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index ix_profiles_role on profiles(role);

-- Historial de cambios de categoría (decisión manual del admin)
create table player_category_history (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references profiles(id) on delete cascade,
  category_code text not null references categories(code),
  level_code    text not null references levels(code),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  decided_by    uuid references profiles(id),
  reason        text
);

create index ix_pch_player on player_category_history(player_id);

-- Autorización a jugar UNA categoría arriba (puntual o por tiempo)
create table category_promotion_authorizations (
  id                  uuid primary key default gen_random_uuid(),
  player_id           uuid not null references profiles(id) on delete cascade,
  authorized_category text not null references categories(code),
  granted_by          uuid not null references profiles(id),
  granted_at          timestamptz not null default now(),
  expires_at          timestamptz,                 -- null = sin vencimiento hasta revocar
  event_id            uuid,                        -- opcional: solo para 1 evento
  revoked_at          timestamptz,
  notes               text
);

create index ix_cpa_player on category_promotion_authorizations(player_id) where revoked_at is null;

-- =====================================================================
-- 5. Eventos
-- =====================================================================
create table events (
  id                       uuid primary key default gen_random_uuid(),
  season_id                uuid not null references seasons(id),
  club_id                  uuid references clubs(id),
  created_by               uuid not null references profiles(id),
  title                    text not null,
  format                   event_format not null,
  category_code            text not null references categories(code),
  allowed_levels           text[] not null,                              -- ['B+','B','B-']
  starts_at                timestamptz not null,
  player_limit             int not null check (player_limit >= 4),
  courts                   int not null check (courts >= 1),
  rounds                   int check (rounds >= 1),                       -- null para 'reto'
  price_crc                int not null default 0,
  prize_description        text,
  status                   event_status not null default 'draft',

  -- Criterio de fin de partido configurable
  match_end_criterion      match_end_criterion not null default 'games',
  match_end_value          int not null check (match_end_value > 0),      -- 15(min) / 6(games) / 24(pts)

  -- Reglas de desempate del POZO ordenadas (cuando 2 jugadores empatan en puntos totales).
  -- Se aplican en orden hasta que una resuelva. Por defecto, el orden definido por el cliente:
  --   1) wins             — más victorias
  --   2) ties             — más empates
  --   3) head_to_head_diff — diferencia de puntos en los enfrentamientos entre los dos jugadores
  tiebreak_rules           text[] not null
                           default array['wins','ties','head_to_head_diff'],

  -- Inscripciones y cancelación automática
  registration_opens_at    timestamptz,
  registration_closes_at   timestamptz,
  auto_cancel_if_under     int,             -- min jugadores para no autocancelar
  auto_cancel_hours_before int,             -- horas antes del evento para chequear

  cancelled_at             timestamptz,
  cancelled_by             uuid references profiles(id),
  cancellation_reason      text,

  created_at               timestamptz not null default now()
);

create index ix_events_season  on events(season_id);
create index ix_events_status  on events(status);
create index ix_events_starts  on events(starts_at);

-- Puntos por posición final del evento (definidos por el admin al crear)
create table event_point_rules (
  event_id  uuid not null references events(id) on delete cascade,
  position  int  not null check (position >= 1),
  points    int  not null check (points >= 0),
  primary key (event_id, position)
);

-- Inscripciones + lista de espera
create table event_registrations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  player_id         uuid not null references profiles(id) on delete cascade,
  status            registration_status not null default 'confirmed',
  waitlist_position int,                                  -- 1 = primero en cola
  registered_at     timestamptz not null default now(),
  cancelled_at      timestamptz,
  promoted_at       timestamptz,                          -- pasó de waitlist a confirmed
  notified_at       timestamptz,
  unique (event_id, player_id)
);

create index ix_er_event_status on event_registrations (event_id, status, waitlist_position);

-- =====================================================================
-- 6. Partidos (siempre 2v2 en padel)
-- =====================================================================
create table matches (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references events(id) on delete cascade,
  round_number        int  not null,
  court_number        int  not null,
  team_a_player_1     uuid not null references profiles(id),
  team_a_player_2     uuid not null references profiles(id),
  team_b_player_1     uuid not null references profiles(id),
  team_b_player_2     uuid not null references profiles(id),
  team_a_score        int,
  team_b_score        int,
  status              match_status not null default 'pending',
  started_at          timestamptz,
  finished_at         timestamptz,
  is_tie              boolean generated always as (
                        team_a_score is not null
                        and team_b_score is not null
                        and team_a_score = team_b_score
                      ) stored,
  notes               text,
  created_at          timestamptz not null default now()
);

create index ix_matches_event_round on matches(event_id, round_number);

-- =====================================================================
-- 7. Resultados agregados por jugador y por pareja
--    Una fila por jugador-por-evento al cerrar el evento.
--    El flag `excluded` permite al admin "no contar" un resultado en el ranking.
-- =====================================================================
create table player_event_results (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  player_id       uuid not null references profiles(id) on delete cascade,
  final_position  int,
  points_earned   int not null default 0,           -- otorgados por event_point_rules según final_position
  -- Stats acumulados en el evento (usados para desempatar y para reportes)
  wins            int not null default 0,
  ties            int not null default 0,
  losses          int not null default 0,
  points_for      int not null default 0,
  points_against  int not null default 0,
  -- Control de exclusión del ranking (el sistema sugiere los peores N, el admin confirma)
  excluded        boolean not null default false,
  excluded_by     uuid references profiles(id),
  excluded_at     timestamptz,
  excluded_reason text,                              -- 'manual' | 'worst_n_auto' | etc.
  suggested_for_exclusion boolean not null default false,  -- sistema lo marca, admin confirma
  created_at      timestamptz not null default now(),
  unique (event_id, player_id)
);

create index ix_per_player_active on player_event_results(player_id) where excluded = false;

create table pair_event_results (
  id              uuid primary key default gen_random_uuid(),
  pair_id         uuid not null,        -- FK declarada después de crear fixed_pairs
  event_id        uuid not null references events(id) on delete cascade,
  final_position  int,
  points_earned   int not null default 0,
  excluded        boolean not null default false,
  excluded_by     uuid references profiles(id),
  excluded_at     timestamptz,
  excluded_reason text,
  created_at      timestamptz not null default now(),
  unique (pair_id, event_id)
);

-- =====================================================================
-- 8. Retos con apuesta de puntos
--    Reglas duras (CHECK constraints):
--    - No retarse a sí mismo
--    - Retado debe estar ARRIBA (posición numérica menor)
--    - Diferencia máxima 5 posiciones
-- =====================================================================
create table challenges (
  id                              uuid primary key default gen_random_uuid(),
  season_id                       uuid not null references seasons(id),
  challenger_id                   uuid not null references profiles(id),
  challenged_id                   uuid not null references profiles(id),
  challenger_position_at_request  int  not null,
  challenged_position_at_request  int  not null,
  points_wagered                  int  not null check (points_wagered > 0),
  status                          challenge_status not null default 'pending',
  event_id                        uuid references events(id),  -- evento para resolver
  winner_id                       uuid references profiles(id),
  message                         text,
  created_at                      timestamptz not null default now(),
  accepted_at                     timestamptz,
  rejected_at                     timestamptz,
  resolved_at                     timestamptz,
  expires_at                      timestamptz,
  check (challenger_id <> challenged_id),
  check (challenged_position_at_request < challenger_position_at_request),
  check (challenger_position_at_request - challenged_position_at_request <= 5)
);

create index ix_challenges_status     on challenges(status);
create index ix_challenges_challenger on challenges(challenger_id);
create index ix_challenges_challenged on challenges(challenged_id);

-- =====================================================================
-- 9. Parejas fijas (ranking separado)
--    Se normaliza con player_a_id < player_b_id para evitar duplicados invertidos.
-- =====================================================================
create table fixed_pairs (
  id            uuid primary key default gen_random_uuid(),
  player_a_id   uuid not null references profiles(id),
  player_b_id   uuid not null references profiles(id),
  status        pair_status not null default 'pending',
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  dissolved_at  timestamptz,
  display_name  text,
  check (player_a_id < player_b_id)
);

create unique index ux_active_pair on fixed_pairs (player_a_id, player_b_id) where status = 'active';

alter table pair_event_results
  add constraint fk_per_pair foreign key (pair_id) references fixed_pairs(id) on delete cascade;

-- =====================================================================
-- 10. Auditoría
-- =====================================================================
create table audit_log (
  id           bigserial primary key,
  actor_id     uuid references profiles(id),
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  payload      jsonb,
  created_at   timestamptz not null default now()
);

create index ix_audit_entity on audit_log(entity_type, entity_id);
create index ix_audit_actor  on audit_log(actor_id, created_at desc);

-- =====================================================================
-- 11.b Notificaciones
--    Guarda envíos hechos (email, WhatsApp, in-app) para evitar duplicados
--    y poder reintentar fallos. La lógica real de envío vive en una Edge Function.
-- =====================================================================
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  type          text not null,                  -- 'registration_confirmed', 'event_reminder', etc.
  channel       text not null,                  -- 'email', 'whatsapp', 'inapp'
  entity_type   text,                           -- 'event', 'challenge', ...
  entity_id     text,
  payload       jsonb,
  sent_at       timestamptz,
  delivered_at  timestamptz,
  failed_at     timestamptz,
  error_message text,
  created_at    timestamptz not null default now()
);

create index ix_notif_recipient on notifications(recipient_id, created_at desc);
create index ix_notif_pending   on notifications(type) where sent_at is null;

-- =====================================================================
-- 12. Vistas de ranking
--    Suman solo resultados no excluidos.
-- =====================================================================
create or replace view v_ranking_individual as
select
  p.id                                                         as player_id,
  p.full_name,
  p.current_category                                           as category_code,
  p.current_level                                              as level_code,
  coalesce(sum(per.points_earned) filter (where per.excluded = false), 0) as total_points,
  count(*) filter (where per.excluded = false)                 as events_counted,
  rank() over (
    order by coalesce(sum(per.points_earned) filter (where per.excluded = false), 0) desc
  )                                                            as position
from profiles p
left join player_event_results per on per.player_id = p.id
where p.is_active = true and p.role = 'player'
group by p.id;

create or replace view v_ranking_pairs as
select
  fp.id                                                              as pair_id,
  fp.player_a_id,
  fp.player_b_id,
  fp.display_name,
  coalesce(sum(per.points_earned) filter (where per.excluded = false), 0) as total_points,
  count(*) filter (where per.excluded = false)                       as events_counted,
  rank() over (
    order by coalesce(sum(per.points_earned) filter (where per.excluded = false), 0) desc
  )                                                                  as position
from fixed_pairs fp
left join pair_event_results per on per.pair_id = fp.id
where fp.status = 'active'
group by fp.id;
