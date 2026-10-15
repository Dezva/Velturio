# Veli → Velturio CRM · Captación con consentimiento

Cambios preparados en la rama `feature/veli-crm-consent`. No mezclar con `main`
hasta ejecutar la migración SQL y configurar las variables de Netlify.

## Qué hace
- Veli atiende consultas normales como antes, sin crear un cliente.
- Ante contratación, solicitud de presupuesto o pedido de seguimiento, solicita autorización explícita.
- Registra **solo** si la respuesta a la solicitud pendiente es `SI AUTORIZO` (también acepta `Sí, autorizo`).
- `NO AUTORIZO` rechaza el registro. Un `sí` genérico **no** alcanza.
- Guarda nombre de perfil si Meta lo proporciona, número de WhatsApp, servicio y metadatos de consentimiento.
- No almacena mensajes de conversación en Supabase. El bot existente mantiene por separado un historial corto en Netlify Blobs.
- Detecta registros anteriores por teléfono y reusa el contacto; evita duplicados con `whatsapp_id`.
- Cuando alguien ya autorizó el mismo servicio, no pide permiso otra vez durante la conversación.
- No envía mensajes salientes no solicitados, ni transfiere chats a un humano automáticamente.
- El CRM muestra los registros nuevos al recargar Clientes; el código actual no tiene actualización en tiempo real.

## Paso A — Supabase (SIN deploy de Netlify)
En el proyecto `velturio-crm`, SQL Editor, ejecutar TODO:
[database_veli_leads.sql](https://github.com/Dezva/Velturio-CRM/blob/feature/veli-crm-consent/database_veli_leads.sql)

Comprobar con:

```sql
select to_regprocedure('public.veli_register_lead(text,text,text,text)') is not null as created;
```

Debe devolver `true`. El SQL añade columnas sin borrar datos.

## Paso B — Netlify del BOT, no Netlify del CRM
En **el sitio Netlify que aloja la web de Velturio y el webhook de Veli**,
Project configuration → Environment variables → agregar:

```env
VELI_CRM_ENABLED=true
VELI_CRM_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VELI_CRM_SUPABASE_SECRET_KEY=sb_secret_... # de Supabase > Project Settings > API Keys
```

- `VELI_CRM_SUPABASE_URL`: la misma Project URL utilizada en el CRM.
- `VELI_CRM_SUPABASE_SECRET_KEY`: **nueva clave SECRET**, NO `sb_publishable_`.
- Marcar la clave como secreta / masked, únicamente para Netlify Functions.
- NUNCA guardar el valor en GitHub, `config.js`, HTML, ni mandarlo por chat.
- Si no querés activar todavía, usá `VELI_CRM_ENABLED=false`. Por defecto está desactivado.
- Cambiar variables puede requerir un despliegue para que la Function las reciba.

## Paso C — Publicar UNA sola vez
Cuando estén listos el SQL y las variables, fusionar
`feature/veli-crm-consent` con `main` en `Dezva/Velturio`.
Netlify desplegará la función actualizada. **No cambiar el callback de Meta**.
No es necesario publicar nuevas versiones de la web del CRM para que un contacto
se vea en el módulo Clientes: los campos extra son aditivos.

⚠️ Si creás un pull request, revisá si Netlify tiene habilitados los Deploy Previews,
porque esos despliegues también pueden gastar créditos. Por eso dejamos los cambios
en una rama, sin PR.

## Prueba manual con teléfono autorizado
1. Enviar a Veli: `Hola`. Debe responder como siempre, sin alta en CRM.
2. Enviar: `¿Cuánto cuesta Stock Plus?`. Tampoco debe registrar.
3. Enviar: `Quiero contratar Stock Plus`. Debe pedir consentimiento.
4. Enviar: `NO AUTORIZO` desde un contacto de prueba distinto. No debe aparecer en CRM.
5. Desde otro contacto o tras `/reiniciar`: `Quiero contratar Stock Plus`, luego `SI AUTORIZO`.
6. En CRM → Clientes (recargar): debe verse el contacto y su servicio, estado `Nuevo`.
7. Repetir consulta por el mismo servicio: no debe crear otro contacto.

Si el RPC falla, Veli informa que no pudo registrar la solicitud y no afirma lo contrario.

## Seguridad y observaciones
- El webhook mantiene la verificación de la firma de Meta y deduplicación de IDs.
- Solamente una función en Netlify utiliza la clave secreta; la API de Supabase
  recibe la clave en el header `apikey`, no `Authorization: Bearer sb_secret_...`.
- La función PostgreSQL `veli_register_lead` está restringida al rol `service_role`
  y utiliza `SECURITY DEFINER`; no puede invocarse desde un usuario anónimo del CRM.
- Por ser una credencial privilegiada, conviene reservarla solo al backend y rotarla
  inmediatamente si se filtra. La clave publicable del frontend NO sirve para el RPC.
- Los usuarios internos ya tienen acceso a `crm_clients` mediante RLS, así que
  podrán ver los contactos añadidos por Veli.
- Es una primera fase de captación: no incluye bandeja de conversaciones,
  validación IA de intención, ni recordatorios automáticos.
