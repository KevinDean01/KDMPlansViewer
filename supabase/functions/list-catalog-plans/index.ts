import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const projectUrl = Deno.env.get("PROJECT_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  const adminEmails = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
  if (!projectUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "Missing required function secrets PROJECT_URL/SERVICE_ROLE_KEY.",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing bearer token." });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const jwt = authHeader.slice("Bearer ".length).trim();
  const { data: callerData, error: callerError } = await adminClient.auth
    .getUser(jwt);
  if (callerError || !callerData.user) {
    return jsonResponse(401, { error: "Caller auth failed." });
  }
  const callerEmail = String(callerData.user.email || "").toLowerCase();
  if (adminEmails.size > 0 && !adminEmails.has(callerEmail)) {
    return jsonResponse(403, { error: "Caller is not an allowed admin." });
  }

  const { data: plans, error: plansError } = await adminClient
    .from("plans")
    .select("id,name,storage_path,active")
    .eq("active", true)
    .order("name", { ascending: true });

  if (plansError) {
    return jsonResponse(500, {
      error: `Failed to read plans: ${plansError.message}`,
    });
  }

  return jsonResponse(200, {
    plans: plans || [],
  });
});
