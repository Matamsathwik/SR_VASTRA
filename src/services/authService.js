import { supabase } from "../lib/supabase";

export const authService = {
  async login(email, password) {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) throw error;

    const { data: staff, error: staffError } =
      await supabase
        .from("staff")
        .select("id, username, role, active")
        .eq("id", data.user.id)
        .maybeSingle();

    if (
      staffError ||
      !staff ||
      staff.active !== true
    ) {
      await supabase.auth.signOut();

      throw new Error(
        "You do not have access to the SR Vastra billing system."
      );
    }

    return {
      id: data.user.id,
      email: data.user.email,
      username: staff.username,
      role: staff.role,
    };
  },

  async currentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // No active session
    if (error) {
      if (error.name === "AuthSessionMissingError") {
        return null;
      }

      throw error;
    }

    if (!user) {
      return null;
    }

    const {
      data: staff,
      error: staffError,
    } = await supabase
      .from("staff")
      .select("id, username, role, active")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Auth UID:", user.id);
    console.log("Staff Row:", staff);
    console.log("Staff Error:", staffError);

    // Auth account exists but has no active staff record
    if (
      staffError ||
      !staff ||
      staff.active !== true
    ) {
      await supabase.auth.signOut();
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: staff.username,
      role: staff.role,
    };
  } catch (error) {
    // No session is a normal state when the app starts
    if (error?.name === "AuthSessionMissingError") {
      return null;
    }

    console.error("Current User Error:", error);
    throw error;
  }
},

  async logout() {
    await supabase.auth.signOut();
  },
};