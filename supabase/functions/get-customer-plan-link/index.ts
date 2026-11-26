import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LinkRequest = {
  planId: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const callerId = callerData.user.id;

  let payload: LinkRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }
  const planId = String(payload.planId || "").trim();
  if (!planId) {
    return jsonResponse(400, { error: "Missing planId." });
  }

  const { data: accessRows, error: accessError } = await adminClient
    .from("customer_plan_access")
    .select("plan_id,active,expires_at,plans:plan_id(id,name,storage_path,active)")
    .eq("customer_user_id", callerId)
    .eq("plan_id", planId)
    .eq("active", true)
    .limit(1);

  if (accessError) {
    return jsonResponse(500, {
      error: `Failed to read access rows: ${accessError.message}`,
    });
  }
  if (!accessRows || accessRows.length === 0) {
    return jsonResponse(403, {
      error: "You do not have access to this plan.",
    });
  }

  const accessRow = accessRows[0] as {
    expires_at: string | null;
    plans: { id: string; name: string; storage_path: string; active: boolean } | null;
  };
  if (accessRow.expires_at) {
    const expiresAt = new Date(accessRow.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return jsonResponse(403, { error: "Your access has expired." });
    }
  }
  if (!accessRow.plans || !accessRow.plans.active) {
    return jsonResponse(404, { error: "Plan is unavailable." });
  }

  const { data: signedData, error: signedError } = await adminClient.storage
    .from(bucketName)
    .createSignedUrl(accessRow.plans.storage_path, 60 * 15);
  if (signedError || !signedData?.signedUrl) {
    return jsonResponse(500, {
      error: `Failed to create plan URL: ${signedError?.message || "unknown error"}`,
    });
  }

  return jsonResponse(200, {
    planId: accessRow.plans.id,
    planName: accessRow.plans.name,
    modelPath: accessRow.plans.storage_path,
    fileName: accessRow.plans.storage_path.split("/").pop() || accessRow.plans.name,
    signedUrl: signedData.signedUrl,
  });
});
