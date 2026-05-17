-- =====================================================================
-- Padel Nation CR — Retos de parejas fijas (2.7 + 2.8)
-- =====================================================================
-- 1. Agrega challenge_points a fixed_pairs (puntos de retos ganados/perdidos)
-- 2. Actualiza v_ranking_pairs para incluirlos
-- 3. Crea tabla pair_challenges con RLS
-- 4. Funciones:
--    · invite_fixed_pair      — invitar compañero (normaliza player_a < player_b)
--    · respond_pair_invite    — aceptar / rechazar invitación
--    · dissolve_pair          — disolver pareja activa
--    · send_pair_challenge    — retar a otra pareja + notificar admins
--    · respond_pair_challenge — aceptar / rechazar reto (pareja retada)
--    · resolve_pair_challenge — resolver reto y transferir puntos (solo admin)
-- =====================================================================

-- ── 1. Puntos acumulados por retos ───────────────────────────────────
alter table public.fixed_pairs
  add column if not exists challenge_points int not null default 0;

-- ── 2. Vista de ranking actualizada ──────────────────────────────────
-- DROP requerido porque CREATE OR REPLACE no permite cambiar orden de columnas
drop view if exists v_ranking_pairs;

create view v_ranking_pairs as
select
  fp.id                                                                as pair_id,
  fp.player_a_id,
  fp.player_b_id,
  fp.display_name,
  fp.challenge_points,
  coalesce(
    sum(per.points_earned) filter (where not per.excluded), 0
  ) + fp.challenge_points                                              as total_points,
  count(per.id) filter (where not per.excluded)                       as events_counted,
  rank() over (
    order by (
      coalesce(sum(per.points_earned) filter (where not per.excluded), 0)
      + fp.challenge_points
    ) desc
  )                                                                    as position
from public.fixed_pairs fp
left join public.pair_event_results per on per.pair_id = fp.id
where fp.status = 'active'
group by fp.id;

-- ── 3. Tabla de retos de parejas ──────────────────────────────────────
create table public.pair_challenges (
  id                              uuid        primary key default gen_random_uuid(),
  season_id                       uuid        not null references public.seasons(id),
  challenger_pair_id              uuid        not null references public.fixed_pairs(id) on delete cascade,
  challenged_pair_id              uuid        not null references public.fixed_pairs(id) on delete cascade,
  challenger_position_at_request  int         not null,
  challenged_position_at_request  int         not null,
  points_wagered                  int         not null check (points_wagered > 0),
  status                          challenge_status not null default 'pending',
  winner_pair_id                  uuid        references public.fixed_pairs(id),
  message                         text,
  created_by                      uuid        not null references public.profiles(id),
  resolved_by                     uuid        references public.profiles(id),
  created_at                      timestamptz not null default now(),
  accepted_at                     timestamptz,
  rejected_at                     timestamptz,
  resolved_at                     timestamptz,
  expires_at                      timestamptz,
  check (challenger_pair_id <> challenged_pair_id),
  check (challenged_position_at_request < challenger_position_at_request),
  check (challenger_position_at_request - challenged_position_at_request <= 5)
);

create index ix_pc_status     on public.pair_challenges (status);
create index ix_pc_challenger on public.pair_challenges (challenger_pair_id);
create index ix_pc_challenged on public.pair_challenges (challenged_pair_id);

alter table public.pair_challenges enable row level security;

create policy "Autenticado lee retos de parejas" on public.pair_challenges
  for select to authenticated using (true);

-- ── 4. invite_fixed_pair ─────────────────────────────────────────────
-- Normaliza player_a_id < player_b_id automáticamente
create or replace function public.invite_fixed_pair(
  p_partner_id   uuid,
  p_display_name text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_a uuid; v_b uuid; v_pair_id uuid;
begin
  if p_partner_id = auth.uid() then
    raise exception 'No podés invitarte a vos mismo.';
  end if;

  if not exists (select 1 from profiles where id = p_partner_id and is_active) then
    raise exception 'Jugador no encontrado.';
  end if;

  -- UUID menor → player_a (evita duplicados invertidos)
  if auth.uid()::text < p_partner_id::text then
    v_a := auth.uid();  v_b := p_partner_id;
  else
    v_a := p_partner_id; v_b := auth.uid();
  end if;

  if exists (
    select 1 from fixed_pairs
    where player_a_id = v_a and player_b_id = v_b
      and status in ('pending','active')
  ) then
    raise exception 'Ya existe una pareja activa o pendiente entre ustedes.';
  end if;

  if exists (
    select 1 from fixed_pairs
    where (player_a_id = auth.uid() or player_b_id = auth.uid())
      and status = 'active'
  ) then
    raise exception 'Ya tenés una pareja activa. Disolvel antes de crear una nueva.';
  end if;

  insert into fixed_pairs (player_a_id, player_b_id, display_name)
  values (v_a, v_b, nullif(trim(coalesce(p_display_name, '')), ''))
  returning id into v_pair_id;

  return json_build_object('success', true, 'pair_id', v_pair_id);
end;
$$;

-- ── 5. respond_pair_invite ───────────────────────────────────────────
create or replace function public.respond_pair_invite(
  p_pair_id uuid,
  p_accept  boolean
)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from fixed_pairs
    where id = p_pair_id and status = 'pending'
      and (player_a_id = auth.uid() or player_b_id = auth.uid())
  ) then
    raise exception 'Invitación no encontrada o ya procesada.';
  end if;

  if p_accept then
    update fixed_pairs set status = 'active', accepted_at = now() where id = p_pair_id;
  else
    update fixed_pairs set status = 'dissolved', dissolved_at = now() where id = p_pair_id;
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 6. dissolve_pair ─────────────────────────────────────────────────
create or replace function public.dissolve_pair(p_pair_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from fixed_pairs
    where id = p_pair_id and status = 'active'
      and (player_a_id = auth.uid() or player_b_id = auth.uid())
  ) then
    raise exception 'Pareja no encontrada o no activa.';
  end if;

  update fixed_pairs set status = 'dissolved', dissolved_at = now() where id = p_pair_id;

  return json_build_object('success', true);
end;
$$;

-- ── 7. send_pair_challenge ───────────────────────────────────────────
create or replace function public.send_pair_challenge(
  p_challenger_pair_id uuid,
  p_challenged_pair_id uuid,
  p_points_wagered     int,
  p_message            text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_season_id      uuid;
  v_challenger_pos bigint;
  v_challenged_pos bigint;
  v_challenge_id   uuid;
  v_admin_id       uuid;
begin
  if not exists (
    select 1 from fixed_pairs
    where id = p_challenger_pair_id and status = 'active'
      and (player_a_id = auth.uid() or player_b_id = auth.uid())
  ) then
    raise exception 'No pertenecés a esta pareja o no está activa.';
  end if;

  if not exists (
    select 1 from fixed_pairs where id = p_challenged_pair_id and status = 'active'
  ) then
    raise exception 'La pareja retada no está activa.';
  end if;

  select id into v_season_id from seasons where is_active = true limit 1;
  if v_season_id is null then
    raise exception 'No hay temporada activa.';
  end if;

  select position into v_challenger_pos from v_ranking_pairs where pair_id = p_challenger_pair_id;
  select position into v_challenged_pos from v_ranking_pairs where pair_id = p_challenged_pair_id;
  v_challenger_pos := coalesce(v_challenger_pos, 9999);
  v_challenged_pos := coalesce(v_challenged_pos, 9998);

  if v_challenged_pos >= v_challenger_pos then
    raise exception 'Solo podés retar a una pareja que esté por encima en el ranking.';
  end if;
  if (v_challenger_pos - v_challenged_pos) > 5 then
    raise exception 'Solo podés retar a parejas dentro de las 5 posiciones superiores.';
  end if;

  if exists (
    select 1 from pair_challenges
    where challenger_pair_id = p_challenger_pair_id
      and challenged_pair_id = p_challenged_pair_id
      and status = 'pending'
  ) then
    raise exception 'Ya existe un reto pendiente entre estas parejas.';
  end if;

  insert into pair_challenges (
    season_id, challenger_pair_id, challenged_pair_id,
    challenger_position_at_request, challenged_position_at_request,
    points_wagered, message, created_by, expires_at
  ) values (
    v_season_id,
    p_challenger_pair_id, p_challenged_pair_id,
    v_challenger_pos::int, v_challenged_pos::int,
    p_points_wagered, p_message, auth.uid(),
    now() + interval '7 days'
  )
  returning id into v_challenge_id;

  -- Notificación in-app a todos los admins
  for v_admin_id in
    select id from profiles where role in ('admin','super_admin') and is_active
  loop
    insert into notifications (
      recipient_id, type, channel, entity_type, entity_id, payload
    ) values (
      v_admin_id, 'new_pair_challenge', 'inapp',
      'pair_challenge', v_challenge_id::text,
      jsonb_build_object(
        'challenger_pair_id', p_challenger_pair_id,
        'challenged_pair_id', p_challenged_pair_id,
        'points_wagered',     p_points_wagered
      )
    );
  end loop;

  return json_build_object('success', true, 'challenge_id', v_challenge_id);
end;
$$;

-- ── 8. respond_pair_challenge ────────────────────────────────────────
create or replace function public.respond_pair_challenge(
  p_challenge_id uuid,
  p_accept       boolean
)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from pair_challenges pc
    join fixed_pairs fp on fp.id = pc.challenged_pair_id
    where pc.id = p_challenge_id
      and pc.status = 'pending'
      and (fp.player_a_id = auth.uid() or fp.player_b_id = auth.uid())
  ) then
    raise exception 'Reto no encontrado, ya procesado, o no sos miembro de la pareja retada.';
  end if;

  if p_accept then
    update pair_challenges set status = 'accepted', accepted_at = now() where id = p_challenge_id;
  else
    update pair_challenges set status = 'rejected', rejected_at = now() where id = p_challenge_id;
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 9. resolve_pair_challenge (solo admin) ───────────────────────────
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

  -- Transferencia de puntos en fixed_pairs
  update fixed_pairs
  set challenge_points = challenge_points + v_ch.points_wagered
  where id = p_winner_pair_id;

  update fixed_pairs
  set challenge_points = challenge_points - v_ch.points_wagered
  where id = v_loser_pair_id;

  return json_build_object(
    'success',            true,
    'points_transferred', v_ch.points_wagered,
    'winner_pair_id',     p_winner_pair_id
  );
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────
grant execute on function public.invite_fixed_pair(uuid, text)                   to authenticated;
grant execute on function public.respond_pair_invite(uuid, boolean)              to authenticated;
grant execute on function public.dissolve_pair(uuid)                             to authenticated;
grant execute on function public.send_pair_challenge(uuid, uuid, int, text)      to authenticated;
grant execute on function public.respond_pair_challenge(uuid, boolean)           to authenticated;
grant execute on function public.resolve_pair_challenge(uuid, uuid)              to authenticated;
