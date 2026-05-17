-- =====================================================================
-- Padel Nation CR — Actualizar trigger de nuevo usuario
-- =====================================================================
-- El formulario de registro ahora envía: phone, gender,
-- current_category y current_level en los metadatos del usuario.
-- El trigger los guarda directamente en profiles al crear la cuenta.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, full_name, email, phone, gender,
    current_category, current_level, role
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    coalesce(
      (new.raw_user_meta_data ->> 'gender')::gender,
      'unspecified'::gender
    ),
    nullif(trim(new.raw_user_meta_data ->> 'current_category'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'current_level'), ''),
    'player'::user_role
  );
  return new;
exception
  when others then
    raise warning '[handle_new_user] Error: %, SQLSTATE: %', sqlerrm, sqlstate;
    return new;
end;
$$ language plpgsql security definer set search_path = public;
