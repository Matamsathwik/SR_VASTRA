import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
  });
}

  try {
    const supabaseUrl = Deno.env.get(
      "SUPABASE_URL"
    );

    const supabaseAnonKey = Deno.env.get(
      "SUPABASE_ANON_KEY"
    );

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

    // ==================== VERIFY CURRENT USER ====================

    const authHeader =
      req.headers.get("Authorization");

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

    // ==================== VERIFY OWNER ====================

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

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
        "Only an active owner can reset staff passwords."
      );
    }

    // ==================== READ REQUEST ====================

    const body = await req.json();

    const staffId = body?.staffId;
    const newPassword = body?.newPassword;

    if (!staffId) {
      throw new Error("Staff ID is required.");
    }

    if (
      typeof newPassword !== "string" ||
      newPassword.length < 6
    ) {
      throw new Error(
        "Password must be at least 6 characters."
      );
    }

    // ==================== VERIFY TARGET STAFF ====================

    const { data: staff, error: staffError } =
      await supabaseAdmin
        .from("staff")
        .select("id, username, role, active")
        .eq("id", staffId)
        .eq("role", "staff")
        .eq("active", true)
        .maybeSingle();

    if (staffError) {
      throw staffError;
    }

    if (!staff) {
      throw new Error(
        "Active staff member not found."
      );
    }

    // ==================== RESET AUTH PASSWORD ====================

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(
        staff.id,
        {
          password: newPassword,
        }
      );

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Staff password reset successfully.",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Reset Staff Password Error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset staff password.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});