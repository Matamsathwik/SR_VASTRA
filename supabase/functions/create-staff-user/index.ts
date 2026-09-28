import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_USER_AGENT = "SR Vastra Billing Software/1.0";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isPasswordCompromised(password: string): Promise<boolean> {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-1", encoded);
  const hash = toHex(digest).toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(HIBP_RANGE_URL + prefix, {
    headers: {
      "user-agent": HIBP_USER_AGENT,
      "Add-Padding": "true",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to verify password security. Please try again.");
  }

  const text = await response.text();
  return text.split(/\r?\n/).some((line) => {
    const [returnedSuffix, countText] = line.trim().split(":");
    return returnedSuffix?.toUpperCase() === suffix && Number(countText) > 0;
  });
}

function validatePasswordLength(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

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
    // =========================
    // ENVIRONMENT
    // =========================

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
    // VERIFY LOGGED-IN USER
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
        .select("id, username, role, active")
        .eq("id", user.id)
        .eq("role", "owner")
        .eq("active", true)
        .maybeSingle();

    if (ownerError) {
      throw ownerError;
    }

    if (!owner) {
      throw new Error(
        "Only an active owner can create staff."
      );
    }

    // =========================
    // READ REQUEST
    // =========================

    const body = await req.json();

    const username =
      typeof body?.username === "string"
        ? body.username.trim()
        : "";

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password = body?.password;

    if (!username) {
      throw new Error("Username is required.");
    }

    if (!email) {
      throw new Error("Email is required.");
    }

    validatePasswordLength(password);

    const passwordCompromised =
      await isPasswordCompromised(password);

    if (passwordCompromised) {
      throw new Error(
        "This password has appeared in known data breaches. Please choose a different password."
      );
    }

    // =========================
    // CHECK USERNAME
    // =========================

    const {
      data: existingUsername,
      error: usernameError,
    } = await supabaseAdmin
      .from("staff")
      .select("id, username, role, active")
      .ilike("username", username)
      .maybeSingle();

    if (usernameError) {
      throw usernameError;
    }

    // =========================
    // FIND AUTH USER BY EMAIL
    // =========================

    let existingAuthUser = null;
    let page = 1;

    while (true) {
      const {
        data: usersData,
        error: usersError,
      } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (usersError) {
        throw usersError;
      }

      const users = usersData?.users ?? [];

      const foundUser = users.find(
        (authUser) =>
          authUser.email?.toLowerCase() === email
      );

      if (foundUser) {
        existingAuthUser = foundUser;
        break;
      }

      if (users.length < 1000) {
        break;
      }

      page++;
    }

    // ==================================================
    // EXISTING AUTH USER
    // ==================================================

    if (existingAuthUser) {
      const authUserId = existingAuthUser.id;

      const {
        data: existingStaff,
        error: existingStaffError,
      } = await supabaseAdmin
        .from("staff")
        .select("id, username, role, active")
        .eq("id", authUserId)
        .maybeSingle();

      if (existingStaffError) {
        throw existingStaffError;
      }

      // Owner email cannot be used for staff
      if (existingStaff?.role === "owner") {
        throw new Error(
          "This email belongs to the owner and cannot be used for staff."
        );
      }

      // ==================================================
      // MIGRATION SUPPORT
      //
      // If an old disabled account still exists from the
      // previous active=false system, remove that old
      // account first so the staff member can rejoin with
      // a completely fresh account.
      // ==================================================

      if (
        existingStaff &&
        existingStaff.role === "staff" &&
        existingStaff.active === false
      ) {
        console.log(
          "Removing legacy disabled staff account:",
          authUserId
        );

        const { error: deleteOldUserError } =
          await supabaseAdmin.auth.admin.deleteUser(
            authUserId
          );

        if (deleteOldUserError) {
          throw deleteOldUserError;
        }

        existingAuthUser = null;
      } else {
        throw new Error(
          "This email is already registered to an active user."
        );
      }
    }

    // ==================================================
    // USERNAME CHECK
    // ==================================================

    if (existingUsername) {
      // If this is an old disabled staff record, the
      // migration above deleted it. Otherwise username
      // belongs to someone currently registered.
      throw new Error(
        "This username is already registered."
      );
    }

    // ==================================================
    // CREATE NEW AUTH USER
    // ==================================================

    const {
      data: newUserData,
      error: createUserError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError) {
      throw createUserError;
    }

    if (!newUserData?.user) {
      throw new Error(
        "Failed to create authentication user."
      );
    }

    const newUser = newUserData.user;

    // ==================================================
    // CREATE STAFF RECORD
    // ==================================================

    const {
      data: newStaff,
      error: staffInsertError,
    } = await supabaseAdmin
      .from("staff")
      .insert({
        id: newUser.id,
        username,
        role: "staff",
        active: true,
      })
      .select()
      .single();

    // ==================================================
    // ROLLBACK AUTH USER IF STAFF INSERT FAILS
    // ==================================================

    if (staffInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(
        newUser.id
      );

      throw staffInsertError;
    }

    return jsonResponse({
      success: true,
      message: "Staff created successfully.",
      staff: newStaff,
    });
  } catch (error) {
    console.error(
      "Create Staff Function Error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create staff.",
      },
      400
    );
  }
});