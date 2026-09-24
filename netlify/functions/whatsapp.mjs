import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { VELTURIO_INSTRUCTIONS } from "../lib/velturio-prompt.mjs";

const OPENAI_URL = "https://api.openai.com/v1/responses";

function env(name, fallback = "") {
  return process.env[name] ?? fallback;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function verifyMetaSignature(rawBody, signature) {
  const secret = env("META_APP_SECRET");
  if (!secret || !signature?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

async function graphRequest(payload) {
  const token = env("WHATSAPP_TOKEN");
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  const version = env("WHATSAPP_GRAPH_VERSION", "v26.0");

  if (!token || !phoneNumberId) {
    throw new Error(
      "Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID."
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `WhatsApp API ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function markReadAndTyping(messageId) {
  try {
    await graphRequest({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    });
  } catch (error) {
    console.warn(
      "No se pudo marcar como leído:",
      error.message
    );
  }
}

async function sendText(to, body) {
  const safeBody = String(body || "").slice(0, 4096);

  return graphRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: safeBody,
    },
  });
}

function extractOpenAIText(data) {
  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  const pieces = [];

  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        pieces.push(content.text);
      }
    }
  }

  return pieces.join("\n").trim();
}

async function getConversation(store, waId) {
  const saved = await store.get(waId, { type: "json" });

  if (!saved?.history || !Array.isArray(saved.history)) {
    return {
      history: [],
      updatedAt: 0,
    };
  }

  const ttlHours =
    Number(env("CONVERSATION_TTL_HOURS", "24")) || 24;

  const expired =
    Date.now() - Number(saved.updatedAt || 0) >
    ttlHours * 3600_000;

  return expired
    ? { history: [], updatedAt: 0 }
    : saved;
}

async function askVeli(history, userText) {
  const apiKey = env("OPENAI_API_KEY");
  const model = env(
    "OPENAI_MODEL",
    "gpt-5.6-luna"
  );

  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY.");
  }

  const input = [
    ...history,
    {
      role: "user",
      content: userText,
    },
  ];

  const response = await fetch(
    OPENAI_URL,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: VELTURIO_INSTRUCTIONS,
        input,
        reasoning: {
          effort: "none",
        },
        max_output_tokens: 450,
        store: false,
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `OpenAI API ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  const reply = extractOpenAIText(data);

  if (!reply) {
    throw new Error(
      "OpenAI devolvió una respuesta vacía."
    );
  }

  return reply;
}

async function processTextMessage(message) {
  const waId = message.from;
  const messageId = message.id;
  const userText =
    message.text?.body?.trim();

  if (!waId || !messageId || !userText) {
    return;
  }

  const dedupe = getStore(
    "velturio-whatsapp-processed"
  );

  const claim = await dedupe.set(
    messageId,
    JSON.stringify({
      startedAt: Date.now(),
    }),
    {
      onlyIfNew: true,
    }
  );

  if (!claim.modified) {
    console.log(
      "Mensaje ya procesado:",
      messageId
    );
    return;
  }

  try {
    await markReadAndTyping(messageId);

    const conversations = getStore({
      name: "velturio-whatsapp-conversations",
      consistency: "strong",
    });

    if (
      userText.toLowerCase() === "/reiniciar"
    ) {
      await conversations.delete(waId);

      await sendText(
        waId,
        "Listo. Reinicié el contexto de esta conversación. ¿En qué puedo ayudarte con Velturio?"
      );

      return;
    }

    const conversation =
      await getConversation(
        conversations,
        waId
      );

    const reply = await askVeli(
      conversation.history,
      userText
    );

    await sendText(waId, reply);

    const newHistory = [
      ...conversation.history,
      {
        role: "user",
        content: userText,
      },
      {
        role: "assistant",
        content: reply,
      },
    ].slice(-12);

    try {
      await conversations.set(
        waId,
        JSON.stringify({
          history: newHistory,
          updatedAt: Date.now(),
        })
      );
    } catch (error) {
      console.error(
        "No se pudo guardar el historial:",
        error.message
      );
    }
  } catch (error) {
    console.error(
      "Error procesando mensaje:",
      error
    );

    try {
      await dedupe.delete(messageId);
    } catch {}

    throw error;
  }
}

export default async (request) => {
  const url = new URL(request.url);

  // =========================
  // GET
  // =========================

  if (request.method === "GET") {
    const mode =
      url.searchParams.get("hub.mode");

    const token =
      url.searchParams.get(
        "hub.verify_token"
      );

    const challenge =
      url.searchParams.get(
        "hub.challenge"
      );

    // Verificación oficial de Meta
    if (
      mode === "subscribe" &&
      token &&
      token ===
        env("WHATSAPP_VERIFY_TOKEN")
    ) {
      return new Response(
        challenge ?? "",
        {
          status: 200,
        }
      );
    }

    // Test manual desde el navegador
    return json({
      ok: true,
      service:
        "Velturio WhatsApp Webhook",
      message:
        "Webhook activo",
      botEnabled:
        env(
          "BOT_ENABLED",
          "true"
        ).toLowerCase() === "true",

      hasWhatsAppToken: Boolean(
        env("WHATSAPP_TOKEN")
      ),

      hasPhoneNumberId: Boolean(
        env(
          "WHATSAPP_PHONE_NUMBER_ID"
        )
      ),

      hasVerifyToken: Boolean(
        env(
          "WHATSAPP_VERIFY_TOKEN"
        )
      ),

      hasMetaAppSecret: Boolean(
        env("META_APP_SECRET")
      ),

      hasOpenAIKey: Boolean(
        env("OPENAI_API_KEY")
      ),

      model: env(
        "OPENAI_MODEL",
        "gpt-5.6-luna"
      ),
    });
  }

  // =========================
  // POST
  // =========================

  if (request.method === "POST") {
    if (
      env(
        "BOT_ENABLED",
        "true"
      ).toLowerCase() !== "true"
    ) {
      return json({
        ok: true,
        bot: "disabled",
      });
    }

    const rawBody =
      await request.text();

    /*
    ==========================================
    DIAGNÓSTICO TEMPORAL
    ==========================================

    Normalmente aquí verificamos:

    x-hub-signature-256

    usando META_APP_SECRET.

    Pero por ahora lo dejamos desactivado
    para comprobar si Meta realmente está
    enviando mensajes a esta función.

    NO DEJAR ASÍ EN PRODUCCIÓN.
    */

    let payload;

    try {
      payload =
        JSON.parse(rawBody);
    } catch {
      return new Response(
        "Invalid JSON",
        {
          status: 400,
        }
      );
    }

    const jobs = [];

    for (
      const entry of payload?.entry ?? []
    ) {
      for (
        const change of
        entry?.changes ?? []
      ) {
        const value =
          change?.value;

        /*
        ==========================================
        DIAGNÓSTICO TEMPORAL
        ==========================================

        También desactivamos temporalmente
        esta comprobación:

        value.metadata.phone_number_id
        === WHATSAPP_PHONE_NUMBER_ID

        para descartar que el problema sea
        un ID incorrecto.
        */

        for (
          const message of
          value?.messages ?? []
        ) {
          if (
            message?.type === "text"
          ) {
            jobs.push(
              sendText(
                message.from,
                "Webhook funcionando. test"
              )
            );
          } else if (
            message?.from &&
            message?.id
          ) {
            jobs.push(
              (async () => {
                const dedupe =
                  getStore(
                    "velturio-whatsapp-processed"
                  );

                const claim =
                  await dedupe.set(
                    message.id,
                    JSON.stringify({
                      startedAt:
                        Date.now(),
                      unsupported: true,
                    }),
                    {
                      onlyIfNew: true,
                    }
                  );

                if (
                  claim.modified
                ) {
                  try {
                    await sendText(
                      message.from,
                      "Por ahora Veli procesa mensajes de texto. Escribime tu consulta y con gusto te ayudo."
                    );
                  } catch (
                    error
                  ) {
                    await dedupe.delete(
                      message.id
                    );

                    throw error;
                  }
                }
              })()
            );
          }
        }
      }
    }

    const results =
      await Promise.allSettled(
        jobs
      );

    if (
      results.some(
        (result) =>
          result.status ===
          "rejected"
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "Processing failed; retry later",
        },
        503
      );
    }

    return json({
      ok: true,
    });
  }

  return new Response(
    "Method not allowed",
    {
      status: 405,
      headers: {
        allow: "GET, POST",
      },
    }
  );
};