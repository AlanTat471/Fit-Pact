import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Authentication failed" }, 401);
    }

    const userId = userData.user.id;
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tables = [
      "user_preferences",
      "custom_macros",
      "tdee_values",
      "journeys",
      "subscriptions",
      "profiles",
    ];

    for (const table of tables) {
      const { error } = await svc.from(table).delete().eq("user_id", userId);
      if (error) {
        console.warn(`[delete-account] ${table}:`, error.message);
      }
    }

    const { error: authDeleteErr } = await svc.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      return json({ error: authDeleteErr.message }, 500);
    }

    return json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    console.error("[delete-account]", msg);
    return json({ error: msg }, 500);
  }
});
