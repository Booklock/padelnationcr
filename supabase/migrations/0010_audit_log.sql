-- =====================================================================
-- Padel Nation CR — Auditoría de cambios sensibles (3.2)
-- =====================================================================
-- 1. Tabla audit_log
-- 2. update_player_category  — reemplaza los 2 llamados desde AdminPlayers
-- 3. grant_category_authorization  — versión con audit
-- 4. revoke_category_authorization — versión con audit
-- 5. set_result_exclusion          — versión con audit
-- 6. resolve_pair_challenge        — versión con audit
-- =====================================================================

-- ── 1. Tabla audit_log ────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigserial    primary key,
  actor_id    uuid         references public.profiles(id) on delete set null,
  action      text         not null,   -- 'category_change' | 'auth_granted' | 'auth_revoked'
                                        -- 'result_excluded' | 'result_included' | 'challenge_resolved'
  entity_type text         not null,   -- 'profile' | 'authorization' | 'result' | 'challenge'
  entity_id   text         not null,
  before_data jsonb,
  after_data  jsonb,
  notes       text,
  created_at  timestamptz  not null default now()
);

create index if not exists audit_log_actor_idx  on public.audit_log (actor_id);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_ts_idx     on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "admins_read_audit_log" on public.audit_log;
create policy "admins_read_audit_log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and   role in ('admin', 'super_admin')
    )
  );


-- ── 2. update_player_category ─────────────────────────────────────────
create or replace function public.update_player_category(
  p_player_id uuid,
  p_category  text,
  p_level     text,
  p_reason    text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid   := auth.uid();
  v_prev_cat text;
  v_prev_lvl text;
begin
  -- Verificar que el actor es admin
  if not exists (
    select 1 from profiles where id = v_actor and role in ('admin', 'super_admin')
  ) then
    raise exception 'Solo admins pueden cambiar categorías.';
  end if;

  -- Estado anterior
  select current_category, current_level
  into   v_prev_cat, v_prev_lvl
  from   profiles
  where  id = p_player_id;

  -- Actualizar perfil
  update profiles
  set    current_category = p_category,
         current_level    = p_level,
         updated_at       = now()
  where  id = p_player_id;

  -- Solo registrar si hubo cambio real
  if v_prev_cat is distinct from p_category or
     v_prev_lvl is distinct from p_level then

    insert into player_category_history
      (player_id, category_code, level_code, decided_by, reason, started_at)
    values
      (p_player_id, p_category, p_level, v_actor, p_reason, now());

    insert into audit_log
      (actor_id, action, entity_type, entity_id, before_data, after_data, notes)
    values (
      v_actor,
      'category_change',
      'profile',
      p_player_id::text,
      jsonb_build_object('category', v_prev_cat, 'level', v_prev_lvl),
      jsonb_build_object('category', p_category, 'level', p_level),
      p_reason
    );
  end if;
end;
$$;

grant execute on function public.update_player_category(uuid, text, text, text) to authenticated;


-- ── 3. grant_category_authorization (con audit) ───────────────────────
create or replace function public.grant_category_authorization(
  p_player_id  uuid,
  p_category   text,
  p_expires_at timestamptz default null,
  p_event_id   uuid        default null,
  p_notes      text        default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_auth_id uuid;
begin
  if not exists (
    select 1 from profiles where id = v_actor and role in ('admin', 'super_admin')
  ) then
    raise exception 'Solo admins pueden otorgar autorizaciones.';
  end if;

  -- Revocar activas anteriores para el mismo jugador + categoría
  update category_promotion_authorizations
  set    revoked_at = now()
  where  player_id  = p_player_id
  and    category   = p_category
  and    revoked_at is null;

  insert into category_promotion_authorizations
    (player_id, category, granted_by, expires_at, event_id, notes)
  values
    (p_player_id, p_category, v_actor, p_expires_at, p_event_id, p_notes)
  returning id into v_auth_id;

  insert into audit_log
    (actor_id, action, entity_type, entity_id, after_data, notes)
  values (
    v_actor,
    'auth_granted',
    'authorization',
    v_auth_id::text,
    jsonb_build_object(
      'player_id',  p_player_id,
      'category',   p_category,
      'expires_at', p_expires_at,
      'event_id',   p_event_id
    ),
    p_notes
  );

  return v_auth_id;
end;
$$;

grant execute on function public.grant_category_authorization(uuid, text, timestamptz, uuid, text) to authenticated;


-- ── 4. revoke_category_authorization (con audit) ──────────────────────
create or replace function public.revoke_category_authorization(
  p_auth_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_auth  record;
begin
  if not exists (
    select 1 from profiles where id = v_actor and role in ('admin', 'super_admin')
  ) then
    raise exception 'Solo admins pueden revocar autorizaciones.';
  end if;

  select * into v_auth
  from   category_promotion_authorizations
  where  id = p_auth_id;

  update category_promotion_authorizations
  set    revoked_at = now()
  where  id = p_auth_id;

  insert into audit_log
    (actor_id, action, entity_type, entity_id, before_data)
  values (
    v_actor,
    'auth_revoked',
    'authorization',
    p_auth_id::text,
    jsonb_build_object(
      'player_id',  v_auth.player_id,
      'category',   v_auth.category,
      'expires_at', v_auth.expires_at
    )
  );
end;
$$;

grant execute on function public.revoke_category_authorization(uuid) to authenticated;


-- ── 5. set_result_exclusion (con audit) ───────────────────────────────
create or replace function public.set_result_exclusion(
  p_result_id uuid,
  p_excluded  boolean,
  p_reason    text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor  uuid := auth.uid();
  v_result record;
begin
  if not exists (
    select 1 from profiles
    where id = v_actor and role in ('admin', 'super_admin', 'coordinator')
  ) then
    raise exception 'No tenés permisos para modificar exclusiones.';
  end if;

  select * into v_result from player_event_results where id = p_result_id;

  update player_event_results
  set
    excluded        = p_excluded,
    excluded_by     = case when p_excluded then v_actor    else null end,
    excluded_at     = case when p_excluded then now()      else null end,
    excluded_reason = case when p_excluded then p_reason   else null end
  where id = p_result_id;

  insert into audit_log
    (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    v_actor,
    case when p_excluded then 'result_excluded' else 'result_included' end,
    'result',
    p_result_id::text,
    jsonb_build_object(
      'excluded',        v_result.excluded,
      'excluded_reason', v_result.excluded_reason,
      'player_id',       v_result.player_id,
      'event_id',        v_result.event_id,
      'points_earned',   v_result.points_earned
    ),
    jsonb_build_object(
      'excluded',        p_excluded,
      'excluded_reason', case when p_excluded then p_reason else null end,
      'player_id',       v_result.player_id,
      'event_id',        v_result.event_id,
      'points_earned',   v_result.points_earned
    )
  );
end;
$$;

grant execute on function public.set_result_exclusion(uuid, boolean, text) to authenticated;


-- ── 6. resolve_pair_challenge (con audit) ─────────────────────────────
create or replace function public.resolve_pair_challenge(
  p_challenge_id   uuid,
  p_winner_pair_id uuid
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_ch            record;
  v_loser_pair_id uuid;
begin
  if not is_admin() then
    raise exception 'Solo admins pueden resolver retos.';
  end if;

  select * into v_ch from pair_challenges where id = p_challenge_id;
  if not found then raise exception 'Reto no encontrado.'; end if;
  if v_ch.status <> 'accepted' then
    raise exception 'El reto debe estar en estado "aceptado" para resolverse.';
  end if;
  if p_winner_pair_id not in (v_ch.challenger_pair_id, v_ch.challenged_pair_id) then
    raise exception 'El ganador debe ser una de las parejas del reto.';
  end if;

  v_loser_pair_id := case
    when p_winner_pair_id = v_ch.challenger_pair_id then v_ch.challenged_pair_id
    else v_ch.challenger_pair_id
  end;

  update pair_challenges
  set status         = 'completed',
      winner_pair_id = p_winner_pair_id,
      resolved_at    = now(),
      resolved_by    = auth.uid()
  where id = p_challenge_id;

  update fixed_pairs set challenge_points = challenge_points + v_ch.points_wagered where id = p_winner_pair_id;
  update fixed_pairs set challenge_points = challenge_points - v_ch.points_wagered where id = v_loser_pair_id;

  insert into audit_log
    (actor_id, action, entity_type, entity_id, after_data)
  values (
    auth.uid(),
    'challenge_resolved',
    'challenge',
    p_challenge_id::text,
    jsonb_build_object(
      'winner_pair_id', p_winner_pair_id,
      'loser_pair_id',  v_loser_pair_id,
      'points_wagered', v_ch.points_wagered
    )
  );

  return json_build_object(
    'success',            true,
    'points_transferred', v_ch.points_wagered,
    'winner_pair_id',     p_winner_pair_id
  );
end;
$$;

grant execute on function public.resolve_pair_challenge(uuid, uuid) to authenticated;
