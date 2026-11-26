import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type AssignRequest = {
  customerEmail: string;
  planId: string;
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
  const viewerUrl = Deno.env.get("VIEWER_URL");
  const adminEmails = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
  if (!projectUrl || !serviceRoleKey || !viewerUrl) {
    return jsonResponse(500, {
      error:
        "Missing required function secrets PROJECT_URL/SERVICE_ROLE_KEY/VIEWER_URL.",
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

  let payload: AssignRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const customerEmail = String(payload.customerEmail || "").trim().toLowerCase();
  const planId = String(payload.planId || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return jsonResponse(400, { error: "Invalid customerEmail." });
  }
  if (!planId) {
    return jsonResponse(400, { error: "Missing planId." });
  }

  const { data: planData, error: planError } = await adminClient
    .from("plans")
    .select("id,name,active")
    .eq("id", planId)
    .single();
  if (planError || !planData) {
    return jsonResponse(400, { error: "Unknown planId." });
  }
  if (!planData.active) {
    return jsonResponse(400, { error: "Plan is inactive." });
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

  const { error: accessError } = await adminClient
    .from("customer_plan_access")
    .upsert(
      {
        customer_user_id: customerUserId,
        plan_id: planData.id,
        active: true,
        expires_at: null,
      },
      {
        onConflict: "customer_user_id,plan_id",
      },
    );
  if (accessError) {
    return jsonResponse(500, {
      error: `Failed to write access row: ${accessError.message}`,
    });
  }

  const viewerLink = `${viewerUrl}?model=${encodeURIComponent(planData.id)}`;
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

  return jsonResponse(200, {
    customerEmail,
    customerUserId,
    planId: planData.id,
    planName: planData.name,
    viewerLink,
    magicLink: magicData.properties?.action_link || "",
  });
});
