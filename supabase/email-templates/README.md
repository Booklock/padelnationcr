# Email Templates — Padel Nation CR

Plantillas HTML para los emails transaccionales de Supabase Auth.

## Cómo aplicar

1. Ir a **Supabase Dashboard → Authentication → Email Templates**
2. Seleccionar la plantilla a editar
3. Pegar el contenido del archivo `.html` correspondiente en el editor
4. Actualizar el asunto (Subject) según la tabla abajo
5. Guardar

## Plantillas disponibles

| Archivo | Template en Supabase | Asunto sugerido |
|---------|---------------------|-----------------|
| `confirm-signup.html` | Confirm signup | `Confirmá tu cuenta en Padel Nation CR` |

## Variables disponibles (Supabase)

| Variable | Descripción |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Link de confirmación de email |
| `{{ .Email }}` | Email del usuario |
| `{{ .SiteURL }}` | URL del sitio |
| `{{ .Token }}` | Token OTP (si usás OTP flow) |
