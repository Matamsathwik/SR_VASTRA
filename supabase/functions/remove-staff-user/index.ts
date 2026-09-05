import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase environment variables are missing."
      );
    }

    // =========================
    // VERIFY CURRENT USER
    // =========================

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Not authenticated.");
    }

    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      throw new Error("Not authenticated.");
    }

    // =========================
    // ADMIN CLIENT
    // =========================

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // =========================
    // VERIFY OWNER
    // =========================

    const { data: owner, error: ownerError } =
      await supabaseAdmin
        .from("staff")
        .select("id, role, active")
        .eq("id", user.id)
        .eq("role", "owner")
        .eq("active", true)
        .maybeSingle();

    if (ownerError) {
      throw ownerError;
    }

    if (!owner) {
      throw new Error(
        "Only an active owner can remove staff."
      );
    }

    // =========================
    // READ REQUEST
    // =========================

    const body = await req.json();
    const staffId = body?.staffId;

    if (!staffId) {
      throw new Error("Staff ID is required.");
    }

    // =========================
    // FIND TARGET STAFF
    // =========================

    const { data: staff, error: staffError } =
      await supabaseAdmin
        .from("staff")
        .select("id, username, role, active")
        .eq("id", staffId)
        .eq("role", "staff")
        .maybeSingle();

    if (staffError) {
      throw staffError;
    }

    if (!staff) {
      throw new Error(
        "Staff member not found."
      );
    }

    // =========================
    // DELETE AUTH USER
    // =========================
    //
    // staff.id references auth.users.id ON DELETE CASCADE.
    //
    // Historical bills/returns now use ON DELETE SET NULL
    // while created_by_name preserves the staff name.
    //

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(
        staff.id
      );

    if (deleteError) {
      throw deleteError;
    }

    return jsonResponse({
      success: true,
      message: `${staff.username} removed successfully.`,
    });
  } catch (error) {
    console.error(
      "Remove Staff Function Error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove staff.",
      },
      400
    );
  }
});