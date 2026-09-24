export default async () => {
  const required = [
    "OPENAI_API_KEY",
    "WHATSAPP_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_VERIFY_TOKEN",
    "META_APP_SECRET",
  ];

  const missing = required.filter((name) => !process.env[name]);

  return Response.json({
    ok: missing.length === 0,
    service: "Velturio WhatsApp Bot",
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v26.0",
    missing,
  }, { status: missing.length === 0 ? 200 : 503 });
};
