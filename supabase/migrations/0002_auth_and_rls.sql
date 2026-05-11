-- =====================================================================
-- Padel Nation CR — Auth, Trigger y RLS
-- =====================================================================
-- 1. Función helper: is_admin / is_coordinator_or_above
-- 2. Trigger: auto-crear profile al registrarse en Supabase Auth
-- 3. Habilitar RLS en todas las tablas
-- 4. Políticas por tabla
-- =====================================================================

-- =====================================================================
-- 1. Helpers de rol
--    Se usan en las políticas. security definer = corren como el dueño
--    de la función (evita recursión en RLS de profiles).
-- =====================================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  )
$$ language sql stable security definer;

create or replace function public.is_coordinator_or_above()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin', 'coordinator')
  )
$$ language sql stable security definer;

-- =====================================================================
-- 2. Trigger: al crear usuario en auth.users → crear profile
--    - Siempre crea con role='player'. El admin cambia el rol después.
--    - EXCEPTION handler: si el insert falla, loguea la advertencia pero
--      NO bloquea el signup (return new en ambos casos).
--    - set search_path = public: buena práctica de seguridad.
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    'player'::user_role
  );
  return new;
exception
  when others then
    raise warning '[handle_new_user] Error: %, SQLSTATE: %', sqlerrm, sqlstate;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger para updated_at en profiles
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- =====================================================================
-- 3. Habilitar RLS en todas las tablas públicas
-- =====================================================================
alter table public.profiles                        enable row level security;
alter table public.player_category_history         enable row level security;
alter table public.category_promotion_authorizations enable row level security;
alter table public.clubs                           enable row level security;
alter table public.seasons                         enable row level security;
alter table public.categories                      enable row level security;
alter table public.levels                          enable row level security;
alter table public.events                          enable row level security;
alter table public.event_point_rules               enable row level security;
alter table public.event_registrations             enable row level security;
alter table public.matches                         enable row level security;
alter table public.player_event_results            enable row level security;
alter table public.pair_event_results              enable row level security;
alter table public.challenges                      enable row level security;
alter table public.fixed_pairs                     enable row level security;
alter table public.audit_log                       enable row level security;
alter table public.notifications                   enable row level security;

-- =====================================================================
-- 4. Políticas RLS
-- =====================================================================

-- ── Catálogos: lectura pública (nadie escribe desde el cliente) ──────
create policy "Lectura pública" on public.categories     for select using (true);
create policy "Lectura pública" on public.levels         for select using (true);
create policy "Lectura pública" on public.seasons        for select using (true);
create policy "Lectura pública" on public.clubs          for select using (true);

create policy "Admin gestiona categories" on public.categories
  for all using (is_admin()) with check (is_admin());
create policy "Admin gestiona levels" on public.levels
  for all using (is_admin()) with check (is_admin());
create policy "Admin gestiona seasons" on public.seasons
  for all using (is_admin()) with check (is_admin());
create policy "Admin gestiona clubs" on public.clubs
  for all using (is_admin()) with check (is_admin());

-- ── Profiles ─────────────────────────────────────────────────────────
-- Lectura: autenticado ve a todos (necesario para mostrar nombres en ranking y eventos)
create policy "Autenticado lee profiles" on public.profiles
  for select to authenticated using (true);

-- Actualización propia (el jugador edita su nombre, teléfono, avatar)
create policy "Jugador actualiza su profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin actualiza cualquier profile (incluyendo cambio de rol)
create policy "Admin actualiza cualquier profile" on public.profiles
  for update using (is_admin()) with check (is_admin());

-- Insert: el trigger (security definer) inserta al crear cuenta.
-- Fallback: usuario autenticado puede crear su propio profile (mismo id).
create policy "Users can create their own profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- ── Historial de categorías ──────────────────────────────────────────
create policy "Jugador ve su historial" on public.player_category_history
  for select to authenticated using (player_id = auth.uid() or is_admin());

create policy "Admin gestiona historial" on public.player_category_history
  for all using (is_admin()) with check (is_admin());

-- ── Autorizaciones de categoría ──────────────────────────────────────
create policy "Jugador ve sus autorizaciones" on public.category_promotion_authorizations
  for select to authenticated using (player_id = auth.uid() or is_admin());

create policy "Admin gestiona autorizaciones" on public.category_promotion_authorizations
  for all using (is_admin()) with check (is_admin());

-- ── Eventos ──────────────────────────────────────────────────────────
-- Anónimo ve eventos no-draft
create policy "Público lee eventos activos" on public.events
  for select using (status <> 'draft');

-- Autenticado ve todos incluyendo drafts
create policy "Autenticado lee todos los eventos" on public.events
  for select to authenticated using (true);

-- Coordinador+ crea y edita eventos
create policy "Coordinador crea eventos" on public.events
  for insert to authenticated with check (is_coordinator_or_above());

create policy "Coordinador edita eventos" on public.events
  for update using (is_coordinator_or_above()) with check (is_coordinator_or_above());

-- Solo admin puede borrar
create policy "Admin borra eventos" on public.events
  for delete using (is_admin());

-- ── Reglas de puntos por posición ────────────────────────────────────
create policy "Autenticado lee reglas de puntos" on public.event_point_rules
  for select to authenticated using (true);

create policy "Coordinador gestiona reglas de puntos" on public.event_point_rules
  for all using (is_coordinator_or_above()) with check (is_coordinator_or_above());

-- ── Inscripciones ────────────────────────────────────────────────────
-- Jugador ve sus propias inscripciones; coordinador+ ve todas
create policy "Lee sus inscripciones" on public.event_registrations
  for select to authenticated
  using (player_id = auth.uid() or is_coordinator_or_above());

-- Jugador se inscribe (solo se puede inscribir a sí mismo)
create policy "Jugador se inscribe" on public.event_registrations
  for insert to authenticated
  with check (player_id = auth.uid());

-- Jugador cancela su inscripción; coordinador+ gestiona cualquiera
create policy "Jugador cancela su inscripción" on public.event_registrations
  for update to authenticated
  using (player_id = auth.uid() or is_coordinator_or_above())
  with check (player_id = auth.uid() or is_coordinator_or_above());

create policy "Admin borra inscripciones" on public.event_registrations
  for delete using (is_admin());

-- ── Partidos ─────────────────────────────────────────────────────────
create policy "Autenticado lee partidos" on public.matches
  for select to authenticated using (true);

create policy "Coordinador gestiona partidos" on public.matches
  for all using (is_coordinator_or_above()) with check (is_coordinator_or_above());

-- ── Resultados por jugador/evento ────────────────────────────────────
create policy "Autenticado lee resultados" on public.player_event_results
  for select to authenticated using (true);

create policy "Coordinador gestiona resultados" on public.player_event_results
  for all using (is_coordinator_or_above()) with check (is_coordinator_or_above());

create policy "Autenticado lee resultados de parejas" on public.pair_event_results
  for select to authenticated using (true);

create policy "Coordinador gestiona resultados de parejas" on public.pair_event_results
  for all using (is_coordinator_or_above()) with check (is_coordinator_or_above());

-- ── Retos ────────────────────────────────────────────────────────────
create policy "Lee retos propios o de admin" on public.challenges
  for select to authenticated
  using (challenger_id = auth.uid() or challenged_id = auth.uid() or is_admin());

-- Solo el retador puede crear el reto (en su nombre)
create policy "Jugador crea reto como retador" on public.challenges
  for insert to authenticated
  with check (challenger_id = auth.uid());

-- Actualizar: retado puede aceptar/rechazar; retador puede cancelar; admin todo
create policy "Partes actualizan reto" on public.challenges
  for update to authenticated
  using (challenger_id = auth.uid() or challenged_id = auth.uid() or is_admin())
  with check (challenger_id = auth.uid() or challenged_id = auth.uid() or is_admin());

-- ── Parejas fijas ────────────────────────────────────────────────────
create policy "Autenticado lee parejas" on public.fixed_pairs
  for select to authenticated using (true);

create policy "Jugador crea pareja consigo mismo" on public.fixed_pairs
  for insert to authenticated
  with check (player_a_id = auth.uid() or player_b_id = auth.uid());

create policy "Miembro de pareja la actualiza" on public.fixed_pairs
  for update to authenticated
  using (player_a_id = auth.uid() or player_b_id = auth.uid() or is_admin())
  with check (player_a_id = auth.uid() or player_b_id = auth.uid() or is_admin());

-- ── Auditoría ─────────────────────────────────────────────────────────
create policy "Admin lee audit log" on public.audit_log
  for select using (is_admin());

-- Los inserts vienen de funciones security definer o del servidor (bypasan RLS).
-- Coordinador+ puede insertar desde la app directamente.
create policy "Coordinador inserta audit" on public.audit_log
  for insert to authenticated with check (is_coordinator_or_above());

-- ── Notificaciones ───────────────────────────────────────────────────
create policy "Jugador lee sus notificaciones" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or is_admin());

-- Las notificaciones se crean desde Edge Functions (service_role, bypasa RLS).
-- Por si acaso, permitir insert desde coordinador+ para tests.
create policy "Coordinador inserta notificación" on public.notifications
  for insert to authenticated with check (is_coordinator_or_above());
