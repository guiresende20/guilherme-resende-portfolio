import type { Handler, HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  try {
    const { ai_response, user_message } = JSON.parse(event.body || "{}");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase não configurado" }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("chat_logs").insert({
      user_message: user_message || "[voz]",
      ai_response,
      voice: "voice",
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return { statusCode: 500, headers, body: JSON.stringify({ error: message }) };
  }
};

export { handler };
