# Velturio — Web + bot de WhatsApp

Este proyecto contiene la web de Velturio y un bot de WhatsApp preparado para una primera prueba en Netlify. Falta configurar las credenciales y probar el recorrido real WhatsApp → Veli → WhatsApp.

## Qué hace

- Recibe mensajes entrantes desde WhatsApp Cloud API.
- Verifica que los webhooks realmente vengan de Meta usando `X-Hub-Signature-256`.
- Envía el texto a OpenAI.
- Usa por defecto `gpt-6-luna`.
- Responde al mismo usuario por WhatsApp.
- Mantiene un contexto corto por usuario con Netlify Blobs.
- Deduplica mensajes repetidos en condiciones normales. No garantiza entrega exactamente una vez ante cortes entre servicios.
- Comando `/reiniciar` para borrar el contexto del usuario.
- No expone claves en el HTML ni en JavaScript del navegador.

## Estructura

```text
velturio_whatsapp_bot/
├── index.html
├── styles.css
├── script.js
├── assets/
├── package.json
├── netlify.toml
├── .env.example
└── netlify/
    ├── functions/
    │   ├── whatsapp.mjs
    │   └── health.mjs
    └── lib/
        └── velturio-prompt.mjs
```

---

# 1. Crear la clave de OpenAI

1. Entrá en la plataforma de OpenAI para desarrolladores.
2. Creá un proyecto/API key.
3. Configurá facturación para la API si todavía no la tenés.
4. Guardá la clave. No la pongas dentro de `index.html`, `script.js` ni GitHub.

Variable que vas a cargar luego en Netlify:

```text
OPENAI_API_KEY=sk-...
```

El modelo predeterminado de este proyecto es:

```text
OPENAI_MODEL=gpt-6-luna
```

Podés cambiarlo después sin modificar el código.

---

# 2. Crear/configurar WhatsApp Cloud API en Meta

1. Entrá a Meta for Developers.
2. Creá una app de tipo Business si todavía no tenés una.
3. Agregá el producto WhatsApp.
4. En la sección de configuración de WhatsApp, Meta te dará inicialmente:
   - un número de prueba,
   - `Phone Number ID`,
   - `WhatsApp Business Account ID (WABA ID)`,
   - un access token temporal para hacer pruebas.
5. Primero probá con el número de prueba antes de conectar el número real de Velturio.

Guardá:

```text
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TOKEN=...
```

Para producción, reemplazá el token temporal por un token apropiado de producción/sistema según la configuración de Meta.

---

# 3. Subir este proyecto a GitHub

Para el bot no conviene depender solamente de arrastrar el HTML. Netlify necesita desplegar también las Functions.

La forma más cómoda es conectar el proyecto a GitHub.

Podés usar el mismo sitio de Netlify que ya creaste:

1. Abrí tu proyecto de Velturio en Netlify.
2. Andá a:
   `Project configuration > Developer settings > Continuous deployment > Repository`
3. Elegí `Link repository`.
4. Conectá un repositorio de GitHub que contenga TODOS los archivos de esta carpeta.

También podés usar la opción de Netlify para crear un repo nuevo desde un proyecto desplegado manualmente si la tenés disponible.

Después, cada cambio que subas a GitHub hará que Netlify vuelva a publicar la web y las funciones automáticamente.

---

# 4. Variables de entorno en Netlify

En Netlify:

`Project configuration > Environment variables`

Creá estas variables:

```text
OPENAI_API_KEY=tu_clave_de_openai
OPENAI_MODEL=gpt-6-luna

WHATSAPP_TOKEN=tu_token_de_meta
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id

WHATSAPP_VERIFY_TOKEN=un_token_que_inventas_vos
META_APP_SECRET=el_app_secret_de_meta

WHATSAPP_GRAPH_VERSION=v26.0

BOT_ENABLED=true
CONVERSATION_TTL_HOURS=24
```

## Importante

`WHATSAPP_VERIFY_TOKEN` NO te lo entrega Meta.
Lo inventás vos. Por ejemplo, generá una cadena larga y difícil de adivinar.

No uses el ejemplo literalmente.

`META_APP_SECRET` se obtiene desde la configuración básica de tu app de Meta.

Después de agregar o cambiar variables, hacé un nuevo deploy.

---

# 5. Comprobar que Netlify cargó las variables

Cuando el proyecto esté desplegado, abrí:

```text
https://TU-SITIO.netlify.app/.netlify/functions/health
```

Si está todo configurado debe devolver algo parecido a:

```json
{
  "ok": true,
  "service": "Velturio WhatsApp Bot",
  "model": "gpt-6-luna",
  "graphVersion": "v26.0",
  "missing": []
}
```

Si `missing` muestra nombres, todavía falta configurar esas variables.

La función de salud nunca imprime los valores secretos.

---

# 6. Configurar el webhook en Meta

La URL del webhook será:

```text
https://TU-SITIO.netlify.app/.netlify/functions/whatsapp
```

Si luego usás `velturio.com`, también podrías usar:

```text
https://velturio.com/.netlify/functions/whatsapp
```

En la configuración de Webhooks/WhatsApp de Meta:

1. Poné esa URL como Callback URL.
2. En Verify token escribí EXACTAMENTE el mismo valor que pusiste en:
   `WHATSAPP_VERIFY_TOKEN`
3. Guardá/verificá.
4. Suscribí el campo/evento `messages` para la cuenta de WhatsApp.

Meta hará un GET de verificación. La función responde con `hub.challenge` automáticamente.

---

# 7. Primera prueba

Usando el número de prueba de Meta:

1. Agregá tu celular como número destinatario permitido si Meta lo solicita.
2. Mandá un mensaje al número de prueba.
3. Ejemplo:

```text
Hola, tengo una despensa y quiero controlar mi stock
```

Flujo esperado:

```text
WhatsApp del cliente
        ↓
Meta Cloud API
        ↓
Webhook en Netlify
        ↓
OpenAI
        ↓
Veli
        ↓
Meta Cloud API
        ↓
WhatsApp del cliente
```

---

# 8. Cuando quieras usar el número real de Velturio

Hacelo DESPUÉS de que el número de prueba funcione.

La vinculación de un número real depende de cómo esté configurada la cuenta de WhatsApp Business de Velturio y de las opciones que Meta muestre en el onboarding. Seguí el flujo de Meta para agregar/migrar/coexistir el número según corresponda.

No borres ni migres el número real a ciegas si actualmente lo usan para atender clientes; primero comprobá qué modalidad ofrece Meta para esa cuenta.

---

# 9. Ventana de WhatsApp

Este bot está pensado para RESPONDER a mensajes que el cliente envía.

Mientras la conversación esté dentro de la ventana de atención de WhatsApp, se pueden enviar respuestas de texto normales.

Si en el futuro querés que Velturio INICIE conversaciones con clientes cuando ya pasó la ventana permitida, necesitás usar plantillas de WhatsApp aprobadas por Meta. Eso es un flujo distinto y no está habilitado por este bot inicial.

---

# 10. Dónde cambiar lo que sabe Veli

Editá:

```text
netlify/lib/velturio-prompt.mjs
```

Ahí están:
- servicios,
- precios,
- características de Stock Básico / Control / Plus,
- tono,
- reglas para no inventar información.

Después hacés commit/push a GitHub y Netlify publica la nueva versión.

---

# 11. Privacidad y memoria

El proyecto guarda un historial corto por número en Netlify Blobs para poder entender mensajes como:

```text
Cliente: ¿Cuánto cuesta Stock Plus?
Veli: ...
Cliente: ¿Y qué incluye además del anterior?
```

Por defecto el historial anterior deja de usarse tras 24 horas de inactividad al recibir otro mensaje. Esto no es un borrado automático por tiempo de los datos guardados.

También el cliente puede escribir:

```text
/reiniciar
```

para empezar una conversación nueva.

El historial está limitado a los últimos 12 mensajes para controlar costo y contexto.

---

# 12. Desactivar el bot sin borrar nada

En Netlify cambiá:

```text
BOT_ENABLED=false
```

y volvé a desplegar.

El webhook seguirá respondiendo a Meta, pero el bot no contestará mensajes.

---

# Próximas mejoras posibles

Cuando la versión básica funcione, se puede agregar:

- derivación real a un asesor y notificación interna;
- panel de conversaciones/leads;
- guardar nombre, empresa e interés del cliente;
- integración con una base de datos;
- respuestas a audios mediante transcripción;
- lectura de imágenes enviadas por WhatsApp;
- catálogo/productos;
- plantillas para seguimientos;
- reglas de horario comercial;
- conexión con CRM.


## Actualización para continuar la configuración

- Stock Plus actualizado a Gs. 400.000 en la web y en las instrucciones de Veli.
- Incorporados los estilos móviles de la última web adjunta.
- Netlify publica solamente `dist`, generado por `npm run build`; el código servidor y la documentación quedan fuera de la carpeta pública.
- El webhook devuelve 503 si falla el procesamiento para permitir reintentos y filtra por el Phone Number ID configurado.
- El endpoint `health` solo comprueba presencia de variables, no su validez ni el saldo o acceso a las APIs.

### Subir a tu repositorio ya conectado

Descomprimí este ZIP y copiá el CONTENIDO de `Velturio_Web_WhatsApp_Bot` a la raíz del repositorio que Netlify ya tiene conectado. Reemplazá los archivos existentes; no subas el ZIP ni dejes otra carpeta contenedora.
En la raíz deben quedar `package.json`, `netlify.toml`, `index.html`, `scripts`, `netlify` y `assets`.
En Netlify, si el proyecto está en la raíz, dejá Base directory vacío, Build command `npm run build` y Publish directory `dist`.
Cargá las variables de la sección 4 para el entorno de producción, con acceso de Functions. Nunca pongas secretos en `netlify.toml` ni en GitHub.
Después de cambiar variables, lanzá un nuevo despliegue. Probá `/.netlify/functions/health` y luego configurá `/.netlify/functions/whatsapp` en Meta.
`WHATSAPP_PHONE_NUMBER_ID` es el identificador del número DE PRUEBA que envió el mensaje, no tu celular receptor ni el WABA ID.
`WHATSAPP_VERIFY_TOKEN` es una cadena aleatoria que elegís vos; debe coincidir en Meta y Netlify. No es el token de acceso generado por Meta.

### Alcance de esta versión

Es un bot inicial de texto para pruebas controladas. La atención humana no se activa automáticamente. Todavía no incluye cola duradera, límites de consumo, limpieza periódica del historial ni ordenamiento de mensajes simultáneos. Antes de abrirlo al público, revisá esos puntos y sustituí el token temporal según la configuración de producción de Meta.
