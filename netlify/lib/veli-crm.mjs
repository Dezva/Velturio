// Velturio/Veli -> CRM. Solo funciona en el servidor de Netlify.
// Nunca enviar la clave sb_secret_ al navegador, GitHub o mensajes de WhatsApp.

export function crmEnabled() {
  const url = process.env.VELI_CRM_SUPABASE_URL || "";
  const secret = process.env.VELI_CRM_SUPABASE_SECRET_KEY || "";
  return process.env.VELI_CRM_ENABLED === "true" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) &&
    /^sb_secret_[A-Za-z0-9_-]+$/.test(secret);
}

function normalized(value) {
  return String(value || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

// Pedimos consentimiento solo si se reconoce un interés comercial explícito.
// No captamos automáticamente a quien simplemente saluda o pregunta un precio.
export function commercialInterest(text) {
  const s = normalized(text);
  if (!s || /\b(no quiero|no necesito|no me interesa|no voy a)\b/.test(s)) return false;
  return /\b(cotizacion|cotizar|presupuesto|presupuestar|contratar|contratacion|comprar|adquirir|encargar)\b/.test(s) ||
    /\b(quiero|quisiera|necesito|busco|me interesa|estoy interesado|estoy interesada)\b.{0,90}\b(stock|sistema|pagina|web|sitio|chatbot|bot|automatizacion|diseno|marketing|publicidad|video|logo|mascota|jingle|aplicacion|app)\b/.test(s) ||
    /\b(quiero|quisiera|necesito|me gustaria|pueden|podrian|podrias)\b.{0,60}\b(que me contacten|que me llamen|que me escriban|seguimiento|hablar con un asesor|hablar con una persona)\b/.test(s);
}

// La aprobación exige la frase explícita solicitada. Un "sí" genérico no basta.
export function consentAnswer(text) {
  const s = normalized(text).replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  if (["si autorizo", "si doy mi autorizacion", "autorizo guardar mis datos", "acepto guardar mis datos"].includes(s)) return "yes";
  if (["no autorizo", "no doy mi autorizacion", "no guardar mis datos", "no gracias"].includes(s)) return "no";
  return null;
}

const SERVICES = [
  [/\bstock plus\b/, "Stock Plus"],
  [/\bstock control\b/, "Stock Control"],
  [/\bstock basico\b/, "Stock Básico"],
  [/\b(web basica|pagina basica)\b/, "Web Básica"],
  [/\bweb negocio\b/, "Web Negocio"],
  [/\bweb pro\b/, "Web Pro"],
  [/\b(pagina web|paginas web|sitio web|sitios web|landing|pagina para mi negocio|web|paginas|pagina|sitios|sitio)\b/, "Páginas web"],
  [/\b(chatbot|chat bot|asistente virtual|bot de whatsapp|bot)\b/, "Chatbot con IA"],
  [/\b(automatizacion|automatizar)\b/, "Automatización Básica"],
  [/\b(sistema a medida|software a medida|sistema personalizado|programa personalizado)\b/, "Sistemas a medida"],
  [/\b(aplicacion|app movil)\b/, "Aplicaciones"],
  [/\b(videojuego|juego)\b/, "Videojuegos"],
  [/\b(feed|redes sociales|instagram)\b/, "Feed Profesional"],
  [/\b(videos? publicitarios?|reels?|publicidad en video)\b/, "Un video de hasta 30 segundos"],
  [/\b(mascota de marca|mascota para mi marca)\b/, "Creación de mascota"],
  [/\b(jingle|musica publicitaria)\b/, "Jingle corto"]
];

export function detectService(text, history = []) {
  const candidates = [text, ...history.filter(x => x?.role === "user").slice(-5).reverse().map(x => x.content)];
  for (const candidate of candidates) {
    const s = normalized(candidate);
    const found = SERVICES.find(([re]) => re.test(s));
    if (found) return found[1];
  }
  return "Otro servicio";
}

export const CONSENT_PROMPT =
  "Si querés que el equipo de Velturio te dé seguimiento o prepare un presupuesto, " +
  "¿nos autorizás a guardar tu nombre de perfil (si está disponible), tu número de WhatsApp " +
  "y el servicio consultado en nuestro CRM? No guardaremos la conversación completa en el CRM.\n\n" +
  "Respondé exactamente *SI AUTORIZO* o *NO AUTORIZO*. Podés seguir consultando aunque no autorices.";

export const CONSENT_REJECTED =
  "Entendido, no registraré tus datos en el CRM. Podés seguir consultándome normalmente.";

export async function registerLead({ waId, profileName, service, consentMessageId }) {
  if (!crmEnabled()) throw new Error("La integración CRM no está habilitada");
  if (!/^[0-9]{8,15}$/.test(String(waId || ""))) throw new Error("Identificador de WhatsApp inválido");
  if (!/^.{3,255}$/.test(String(consentMessageId || ""))) throw new Error("Consentimiento sin identificador");
  const url = process.env.VELI_CRM_SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(url + "/rest/v1/rpc/veli_register_lead", {
    method: "POST",
    headers: {
      "apikey": process.env.VELI_CRM_SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      p_whatsapp_id: waId,
      p_profile_name: String(profileName || "").trim().slice(0, 120),
      p_service: String(service || "Otro servicio").trim().slice(0, 120),
      p_consent_message_id: consentMessageId
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    // No registrar respuesta del servidor: puede contener datos personales.
    throw new Error("Error de Supabase RPC (" + response.status + ")");
  }
  return response.json();
}
