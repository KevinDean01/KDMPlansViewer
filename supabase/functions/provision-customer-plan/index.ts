import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProvisionRequest = {
  customerEmail: string;
  fileName: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function parseAdminEmails(value: string | undefined): Set<string> {
  const list = String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return new Set(list);
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const viewerUrl = Deno.env.get("VIEWER_URL");
  const bucketName = Deno.env.get("PLANS_BUCKET") || "Plans";
  const adminEmails = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));

  if (!supabaseUrl || !serviceRoleKey || !viewerUrl) {
    return jsonResponse(500, {
      error:
        "Missing required function secrets. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VIEWER_URL.",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing bearer token." });
  }
  const jwt = authHeader.slice("Bearer ".length).trim();

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
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

  let payload: ProvisionRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const customerEmail = String(payload.customerEmail || "").trim().toLowerCase();
  const fileName = sanitizeFileName(payload.fileName || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return jsonResponse(400, { error: "Invalid customerEmail." });
  }

  let customerUserId = "";
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data: usersData, error: usersError } =
      await adminClient.auth.admin.listUsers({ page, perPage });
    if (usersError) {
      return jsonResponse(500, {
        error: `Failed to list auth users: ${usersError.message}`,
      });
    }
    const users = usersData.users || [];
    const matched = users.find(
      (user) => String(user.email || "").toLowerCase() === customerEmail,
    );
    if (matched) {
      customerUserId = matched.id;
      break;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  if (!customerUserId) {
    const { data: createdData, error: createdError } =
      await adminClient.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
      });
    if (createdError || !createdData.user) {
      return jsonResponse(500, {
        error: `Failed to create customer user: ${createdError?.message || "unknown error"}`,
      });
    }
    customerUserId = createdData.user.id;
  }

  const modelPath = `${customerUserId}/${Date.now()}-${fileName}`;
  const viewerLink = `${viewerUrl}?model=${encodeURIComponent(modelPath)}`;

  const { data: magicData, error: magicError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: customerEmail,
      options: { redirectTo: viewerLink },
    });
  if (magicError) {
    return jsonResponse(500, {
      error: `Failed to generate magic link: ${magicError.message}`,
    });
  }

  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(bucketName)
    .createSignedUploadUrl(modelPath);
  if (uploadError || !uploadData?.token) {
    return jsonResponse(500, {
      error: `Failed to create signed upload URL: ${uploadError?.message || "unknown error"}`,
    });
  }

  return jsonResponse(200, {
    customerEmail,
    customerUserId,
    modelPath,
    uploadToken: uploadData.token,
    viewerLink,
    magicLink: magicData.properties?.action_link || "",
  });
});
