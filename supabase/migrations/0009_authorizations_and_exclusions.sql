-- =====================================================================
-- Padel Nation CR — 2.10 Autorizaciones + 2.11 Exclusiones de ranking
-- =====================================================================
-- 1. grant_category_authorization  — admin otorga autorización a jugar arriba
-- 2. revoke_category_authorization — admin revoca autorización
-- 3. set_result_exclusion          — coordinador+ incluye/excluye resultado
-- =====================================================================

-- ── 1. Otorgar autorización a categoría superior ──────────────────────
create or replace function public.grant_category_authorization(
  p_player_id   uuid,
  p_category    text,
  p_expires_at  timestamptz default null,
  p_event_id    uuid        default null,
  p_notes       text        default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Solo admins pueden otorgar autorizaciones.';
  end if;

  if not exists (select 1 from profiles where id = p_player_id and is_active) then
    raise exception 'Jugador no encontrado.';
  end if;

  if not exists (select 1 from categories where code = p_category) then
    raise exception 'Categoría inválida.';
  end if;

  -- Revocar la anterior activa para el mismo jugador + categoría (si la hay)
  update category_promotion_authorizations
  set revoked_at = now()
  where player_id          = p_player_id
    and authorized_category = p_category
    and revoked_at          is null;

  insert into category_promotion_authorizations (
    player_id, authorized_category, granted_by,
    expires_at, event_id, notes
  ) values (
    p_player_id, p_category, auth.uid(),
    p_expires_at, p_event_id, p_notes
  )
  returning id into v_id;

  return json_build_object('success', true, 'authorization_id', v_id);
end;
$$;

-- ── 2. Revocar autorización ───────────────────────────────────────────
create or replace function public.revoke_category_authorization(p_auth_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Solo admins pueden revocar autorizaciones.';
  end if;

  if not exists (select 1 from category_promotion_authorizations where id = p_auth_id and revoked_at is null) then
    raise exception 'Autorización no encontrada o ya revocada.';
  end if;

  update category_promotion_authorizations
  set revoked_at = now()
  where id = p_auth_id;

  return json_build_object('success', true);
end;
$$;

-- ── 3. Incluir / excluir resultado del ranking ────────────────────────
create or replace function public.set_result_exclusion(
  p_result_id uuid,
  p_excluded  boolean,
  p_reason    text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not is_coordinator_or_above() then
    raise exception 'Solo coordinadores o admins pueden gestionar exclusiones.';
  end if;

  if not exists (select 1 from player_event_results where id = p_result_id) then
    raise exception 'Resultado no encontrado.';
  end if;

  if p_excluded then
    update player_event_results
    set excluded        = true,
        excluded_by     = auth.uid(),
        excluded_at     = now(),
        excluded_reason = coalesce(nullif(trim(p_reason), ''), 'manual')
    where id = p_result_id;
  else
    update player_event_results
    set excluded        = false,
        excluded_by     = null,
        excluded_at     = null,
        excluded_reason = null
    where id = p_result_id;
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────
grant execute on function public.grant_category_authorization(uuid, text, timestamptz, uuid, text) to authenticated;
grant execute on function public.revoke_category_authorization(uuid)                               to authenticated;
grant execute on function public.set_result_exclusion(uuid, boolean, text)                        to authenticated;
