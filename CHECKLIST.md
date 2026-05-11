# Padel Nation CR — Checklist del proyecto

> Stack confirmado: **Supabase (Postgres + Auth + Storage + Edge Functions)** + React 19 / Vite.
> Fuente de verdad del progreso. Se actualiza con cada avance.

---

## 🔴 P1 — Fundación

- [x] **1.1 Stack backend decidido**: Supabase
- [x] **1.2 Schema SQL inicial** — `supabase/migrations/0001_initial_schema.sql` + `supabase/seed.sql`
- [x] **1.3 Proyecto Supabase creado** (URL y anon key recibidas)
- [x] **1.4 Migración aplicada** en Supabase SQL Editor (schema + seed)
- [x] **1.5 Auth real** — trigger auto-crea profiles, `AuthContext`, `/login`, `/registro`, `ProtectedRoute` y Navbar actualizados
- [ ] **1.6 RLS aplicado en Supabase** — correr `0002_auth_and_rls.sql` en SQL Editor
- [ ] **1.7 Primer admin configurado** (crear usuario en Supabase Auth dashboard y setear `app_metadata: { initial_role: "admin" }` o editar role en Table Editor)
- [ ] **1.8 Reemplazar mocks** por cliente Supabase + hooks (`useEvents`, `useRanking`, `useProfile`)
- [x] **1.9 Variables de entorno** (`.env.local` + `.env.example` + `.gitignore` reforzado)

## 🟠 P2 — Reglas del negocio

- [ ] **2.1 Empates en pozos**: matches pueden terminar empatados (válido). Al cerrar el evento, si dos jugadores quedan iguales en puntos, desempatar: **más wins → más empates → diferencia de puntos head-to-head**
- [ ] **2.2 Criterio de fin de partido**: en `CreateEvent` selector `tiempo` / `games` / `puntos` + valor objetivo. Mostrar cronómetro/contador en coordinador
- [ ] **2.3 Historial de pozos**: vista de resultados anteriores filtrable + sección en perfil
- [ ] **2.4 Inscripciones + Waitlist**: estados `confirmed`/`waitlist`/`cancelled`, promoción automática al cancelar
- [ ] **2.5 Cancelar evento programable**: fecha límite + botón manual + trigger automático si no hay mínimo X horas antes
- [ ] **2.6 Puntos por posición configurables**: tabla editable en CreateEvent. Aplicar al cerrar evento
- [ ] **2.7 Retos con apuesta**: validación 5-de-diferencia, flujo retar → aceptar/rechazar → jugar → transferir puntos
- [ ] **2.8 Ranking de parejas fijas**: pestaña en `/ranking`. Invitación mutua → pareja activa → ranking propio
- [ ] **2.9 Cambio de categoría manual por admin**: panel para mover jugadores. **Eliminar barra de progreso "puntos para próximo nivel" en `PlayerProfile.jsx`**
- [ ] **2.10 Autorización a categoría superior**: admin marca jugador como autorizado (puntual o por tiempo)
- [ ] **2.11 Excluir resultados del ranking**: sistema sugiere los peores N (`suggested_for_exclusion`), el admin confirma (`excluded = true`)
- [ ] **2.12 Notificaciones MVP**: email de confirmación al inscribirse + recordatorio pre-evento

## 🟡 P3 — Calidad y robustez

- [ ] **3.1 Validación servidor** (doble inscripción, categoría incorrecta, reto duplicado)
- [ ] **3.2 Auditoría** (registrar cambios sensibles en `audit_log`)
- [ ] **3.3 Loading + error states** en todas las páginas
- [ ] **3.4 Tests** para lógica de puntos, retos, waitlist y reglas de desempate
- [ ] **3.5 Página 404 + manejo global de errores**
- [ ] **3.6 Mover lógica de generación de rondas al backend**

## 🟢 P4 — Mejoras de negocio sugeridas

- [ ] **4.1 Notificaciones expandidas** (waitlist promovida, resultados publicados, reto recibido, etc.)
- [ ] **4.2 Pagos en línea** (SINPE Móvil + Stripe)
- [ ] **4.3 Sistema de no-show / reputación**
- [ ] **4.4 Estadísticas avanzadas en perfil**
- [ ] **4.5 Calendario público embebible**
- [ ] **4.6 Histórico de temporadas con archivo**
- [ ] **4.7 Entidad Club con coordinador local**
- [ ] **4.8 Validación de elegibilidad por categoría en backend**
- [ ] **4.9 Categorías por género (M / F / Mixto)**
- [ ] **4.10 PWA / app instalable**

---

**Progreso:** 6 / 36 ítems completos (16.7%)
