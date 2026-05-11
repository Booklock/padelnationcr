-- =====================================================================
-- Padel Nation CR — Datos semilla
-- =====================================================================
-- Catálogos básicos: categorías, niveles, temporada activa.
-- Idempotente: se puede correr varias veces.
-- =====================================================================

insert into categories (code, display_name, rank) values
  ('AA','AA',1),
  ('A','A',2),
  ('B','B',3),
  ('C','C',4),
  ('D','D',5)
on conflict (code) do nothing;

insert into levels (code, category_code, rank) values
  ('AA','AA',1),
  ('A+','A',2),  ('A','A',3),  ('A-','A',4),
  ('B+','B',5),  ('B','B',6),  ('B-','B',7),
  ('C+','C',8),  ('C','C',9),  ('C-','C',10),
  ('D+','D',11), ('D','D',12), ('D-','D',13)
on conflict (code) do nothing;

insert into seasons (name, starts_at, ends_at, is_active) values
  ('2026','2026-01-01','2026-12-31', true)
on conflict (name) do nothing;
