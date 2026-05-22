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
- [x] **1.6 RLS aplicado** — `0002_auth_and_rls.sql` corrido + trigger corregido
- [x] **1.7 Primer admin configurado** (role actualizado en Table Editor)
- [x] **1.8 Reemplazar mocks** por cliente Supabase + hooks (`useEvents`, `useRanking`, `useProfile`)
- [x] **1.9 Variables de entorno** (`.env.local` + `.env.example` + `.gitignore` reforzado)

## 🟠 P2 — Reglas del negocio

- [x] **2.1 Empates en pozos**: matches pueden terminar empatados. Al cerrar el evento desempatar: wins → empates → head-to-head diff
- [x] **2.2 Criterio de fin de partido**: selector `tiempo` / `games` / `puntos` + valor objetivo en CreateEvent
- [x] **2.3 Historial de pozos**: vista de resultados anteriores filtrable + sección en perfil
- [x] **2.4 Inscripciones + Waitlist**: estados `confirmed`/`waitlist`/`cancelled`, promoción automática al cancelar
- [x] **2.5 Cancelar evento programable**: botón manual en coordinador + cancela inscripciones + banner de estado
- [x] **2.6 Puntos por posición configurables**: tabla editable en CreateEvent. Aplicar al cerrar evento
- [x] **2.7 Retos con apuesta (parejas)**: validación 5-de-diferencia, flujo retar → aceptar/rechazar → admin resuelve → transferir puntos. Notificación in-app a admins. Solo aplica a ranking de parejas
- [x] **2.8 Ranking de parejas fijas**: pestaña en `/ranking`. Invitación mutua → pareja activa → ranking propio con puntos de eventos + retos
- [ ] **2.7b Retos individuales**: ⏳ Pendiente alineación con dueño — definir reglas de elegibilidad entre categorías antes de implementar
- [x] **2.9 Cambio de categoría manual por admin**: panel para mover jugadores. Registro en `player_category_history`. Categoría + nivel + teléfono + género en registro
- [x] **2.10 Autorización a categoría superior**: panel `/admin/autorizaciones` — otorgar (puntual por evento o por fecha de vencimiento), revocar. Backend ya validado en `register_for_event`
- [x] **2.11 Excluir resultados del ranking**: panel `/admin/exclusiones` — sistema sugiere peores N (≥4 eventos→1, ≥8→2), admin confirma/revoca por jugador
- [x] **2.12 Notificaciones MVP**: recordatorios automáticos 12h y 1h antes del evento via Edge Function + GitHub Actions cron

## 🟡 P3 — Calidad y robustez

- [x] **3.1 Validación servidor**: doble inscripción, categoría/nivel incorrecto (con soporte de autorizaciones especiales), reto duplicado — todo en server-side. Frontend muestra "Categoría no compatible" preventivamente
- [x] **3.2 Auditoría** (registrar cambios sensibles en `audit_log`)
- [x] **3.3 Loading + error states** en todas las páginas
- [ ] **3.4 Tests** para lógica de puntos, retos, waitlist y reglas de desempate
- [x] **3.5 Página 404 + manejo global de errores**
- [x] **3.6 Mover lógica de generación de rondas al backend**
- [x] **3.7 Validación de contraseña segura**: mín. 8 caracteres + mayúscula + minúscula + número (en `/registro`)

## 🟢 P4 — Mejoras de negocio sugeridas

- [ ] **4.1 Notificaciones expandidas**
- [ ] **4.2 Pagos en línea** (SINPE Móvil + Stripe)
- [x] **4.3 Sistema de no-show / reputación**
- [ ] **4.4 Estadísticas avanzadas en perfil**
- [ ] **4.5 Calendario público embebible**
- [ ] **4.6 Histórico de temporadas con archivo**
- [ ] **4.7 Entidad Club con coordinador local**
- [ ] **4.8 Validación de elegibilidad por categoría en backend**
- [x] **4.9 Categorías por género (M / F / Mixto)**
- [ ] **4.10 PWA / app instalable**

---

## 🔵 QA — Manual de pruebas (ejecutar antes de cada release)

> Ejecutar en el sitio de Netlify, no en localhost. Marcar ✅ al aprobar, ❌ si falla.

### Auth
- [ ] **Registro** — completar formulario con datos válidos → llega email de confirmación con contenido
- [ ] **Contraseña débil** — ingresar "abc" → aparece mensaje de error de validación (no envía)
- [ ] **Confirmar email** — click en link del email → puede ingresar al sitio
- [ ] **Login correcto** — credenciales válidas → navbar muestra nombre del jugador + botón "Salir"
- [ ] **Login incorrecto** — contraseña mala → aparece mensaje de error
- [ ] **Cerrar sesión** → redirige y ya no muestra nombre en navbar

### Navegación general
- [ ] **URL directa `/historial`** — no da 404, carga la página
- [ ] **URL directa `/ranking`** — no da 404, carga la página
- [ ] **URL directa `/eventos`** — no da 404, carga la página
- [ ] **URL directa `/perfil`** — redirige a `/login` si no hay sesión
- [ ] **Navbar mobile** — en pantalla pequeña aparece ícono hamburguesa y abre menú

### Página de Eventos (`/eventos`)
- [ ] Carga sin errores, lista eventos activos con fecha, categoría y cupo
- [ ] Filtros de categoría y formato actualizan la lista en tiempo real
- [ ] Sin sesión → click "Inscribirme" redirige a `/login`
- [ ] Con sesión → inscripción exitosa muestra badge verde **✓ Inscrito**
- [ ] Cancelar inscripción → badge desaparece, cupo se libera
- [ ] Evento lleno → botón cambia a **"Evento cerrado"** deshabilitado o muestra **Lista de espera #N**

### Historial (`/historial`)
- [ ] Carga lista de eventos con status `finished`, más recientes primero
- [ ] Filtros de categoría y formato funcionan
- [ ] Click en evento → se expande el leaderboard inline
- [ ] Top 3 muestran 🥇🥈🥉 y fondo diferenciado (dorado/plata/bronce)
- [ ] Click nuevamente → se contrae
- [ ] Evento sin posiciones finales → mensaje "No hay posiciones finales registradas"

### Perfil (`/perfil`)
- [ ] Muestra nombre, categoría y nivel actual
- [ ] Stats correctas: puntos de temporada, eventos jugados, win rate
- [ ] Sección "Mis eventos" muestra historial con emoji de posición por evento
- [ ] Botón "Ver todo" lleva a `/historial`
- [ ] Próximos eventos muestra inscripciones activas

### Ranking (`/ranking`)
- [ ] Tabla carga con posición, nombre, puntos y eventos jugados
- [ ] Jugador en sesión aparece destacado (si tiene resultados)

### Admin — Crear evento (`/admin/crear-evento`)
- [ ] Formulario carga sin errores
- [ ] Selector **Criterio de fin** (tiempo/juegos/puntos) cambia la etiqueta del campo y el hint
- [ ] Tabla de **puntos por posición** es editable; cambia cantidad de filas al cambiar cupo
- [ ] Preview lateral se actualiza en tiempo real con los datos ingresados
- [ ] Guardar → redirige al coordinador del evento recién creado
- [ ] El evento aparece en `/eventos` con estado "Abierto"

### Admin — Coordinador de evento (`/admin/evento/:id`)
- [ ] Carga nombre del evento, jugadores confirmados y tabla de posiciones
- [ ] Botón **"Generar ronda 1"** genera partidos con jugadores correctamente asignados
- [ ] Se pueden ingresar resultados en los campos de score
- [ ] **Guardar partido** → standing actualiza W/T/P y puntos
- [ ] Al completar todos los partidos de la ronda → aparece botón "Generar ronda 2"
- [ ] Al completar todas las rondas → aparece sección **"Finalizar evento"** con posiciones
- [ ] **Finalizar** → estado pasa a "Finalizado", jugadores ganan puntos de ranking
- [ ] Evento finalizado aparece en `/historial` con leaderboard completo

### Admin — Dashboard (`/admin`)
- [ ] Stats muestran: eventos activos, jugadores registrados, partidos pendientes, temporada
- [ ] Carrusel muestra eventos activos con navegación ← →
- [ ] Acciones rápidas: links a crear evento, ranking, historial funcionan

---

**Progreso:** 29 / 39 ítems completos (74.4%)
