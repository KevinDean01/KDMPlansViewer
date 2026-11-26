import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RegisterRequest = {
  name: string;
  storagePath: string;
};

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
  const jwt = authHeader.slice("Bearer ".length).trim();

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: callerData, error: callerError } = await adminClient.auth
    .getUser(jwt);
  if (callerError || !callerData.user) {
    return jsonResponse(401, { error: "Caller auth failed." });
  }
  const callerEmail = String(callerData.user.email || "").toLowerCase();
  if (adminEmails.size > 0 && !adminEmails.has(callerEmail)) {
    return jsonResponse(403, { error: "Caller is not an allowed admin." });
  }

  let payload: RegisterRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const name = String(payload.name || "").trim();
  const storagePath = String(payload.storagePath || "").trim().replace(/^\/+/, "");
  if (!name) {
    return jsonResponse(400, { error: "Missing name." });
  }
  if (!storagePath || !storagePath.startsWith("catalog/")) {
    return jsonResponse(400, {
      error: "Invalid storagePath. Must start with catalog/.",
    });
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("plans")
    .insert({
      name,
      storage_path: storagePath,
      active: true,
    })
    .select("id,name,storage_path")
    .single();

  if (insertError || !inserted) {
    return jsonResponse(500, {
      error: `Failed to register plan: ${insertError?.message || "unknown error"}`,
    });
  }

  return jsonResponse(200, {
    planId: inserted.id,
    name: inserted.name,
    storagePath: inserted.storage_path,
  });
});
