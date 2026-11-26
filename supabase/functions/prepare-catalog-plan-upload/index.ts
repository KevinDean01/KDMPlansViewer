import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PrepareRequest = {
  planName: string;
  fileName: string;
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

function sanitizeFileName(fileName: string): string {
  const raw = String(fileName || "").trim();
  const base = raw.replace(/\.[^/.\\]+$/, "");
  const normalized = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${normalized || "plan"}.glb`;
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
  const bucketName = Deno.env.get("PLANS_BUCKET") || "Plans";
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

  let payload: PrepareRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const planName = String(payload.planName || "").trim();
  const fileName = sanitizeFileName(payload.fileName || "");
  if (!planName) {
    return jsonResponse(400, { error: "Missing planName." });
  }

  const storagePath = `catalog/${Date.now()}-${fileName}`;
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(bucketName)
    .createSignedUploadUrl(storagePath);
  if (uploadError || !uploadData?.token) {
    return jsonResponse(500, {
      error: `Failed to create signed upload URL: ${uploadError?.message || "unknown error"}`,
    });
  }

  return jsonResponse(200, {
    planName,
    storagePath,
    uploadToken: uploadData.token,
  });
});
