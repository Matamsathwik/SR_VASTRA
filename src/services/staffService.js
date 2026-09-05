import { supabase } from "../lib/supabase";

export const staffService = {
  // =========================
  // CREATE STAFF
  // =========================
  async createStaff({ username, email, password }) {
    if (!username?.trim()) {
      throw new Error("Username is required.");
    }

    if (!email?.trim()) {
      throw new Error("Email is required.");
    }

    if (!password || password.length < 6) {
      throw new Error(
        "Password must be at least 6 characters."
      );
    }

    const { data, error } =
      await supabase.functions.invoke(
        "create-staff-user",
        {
          body: {
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password,
          },
        }
      );

    console.log("Create Staff Response:", data);
    console.log("Create Staff Error:", error);

    if (error) {
      let message = error.message;

      if (error.context) {
        try {
          const responseBody =
            await error.context.json();

          message =
            responseBody?.error ||
            responseBody?.message ||
            message;
        } catch {
          // Keep original message
        }
      }

      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "Failed to create staff."
      );
    }

    return data;
  },

  // =========================
  // GET CURRENT STAFF
  // =========================
  async getStaff() {
    const { data, error } = await supabase
      .from("staff")
      .select("id, username, role, active")
      .neq("role", "owner")
      .eq("active", true)
      .order("username");

    if (error) {
      throw error;
    }

    return data || [];
  },

  // =========================
  // REMOVE STAFF
  // =========================
  async removeStaff(id) {
    const { data, error } =
      await supabase.functions.invoke(
        "remove-staff-user",
        {
          body: {
            staffId: id,
          },
        }
      );

    if (error) {
      let message = error.message;

      if (error.context) {
        try {
          const responseBody =
            await error.context.json();

          message =
            responseBody?.error ||
            responseBody?.message ||
            message;
        } catch {
          // Keep original message
        }
      }

      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "Failed to remove staff."
      );
    }

    return data;
  },
    // =========================
  // RESET STAFF PASSWORD
  // =========================
  async resetStaffPassword(staffId, newPassword) {
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

    const { data, error } =
      await supabase.functions.invoke(
        "reset-staff-password",
        {
          body: {
            staffId,
            newPassword,
          },
        }
      );

    console.log(
      "Reset Staff Password Response:",
      data
    );
    console.log(
      "Reset Staff Password Error:",
      error
    );

    if (error) {
      let message = error.message;

      if (error.context) {
        try {
          const responseBody =
            await error.context.json();

          message =
            responseBody?.error ||
            responseBody?.message ||
            message;
        } catch {
          // Keep original error message
        }
      }

      throw new Error(message);
    }

    if (!data?.success) {
      throw new Error(
        data?.error ||
          "Failed to reset staff password."
      );
    }

    return data;
  },
};