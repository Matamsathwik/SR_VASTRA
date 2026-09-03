import { supabase } from "../lib/supabase";

export const staffService = {
  // ==================== CREATE STAFF ====================

  async createStaff(staff) {
    const { data, error } = await supabase.functions.invoke(
      "create-staff-user",
      {
        body: staff,
      }
    );

    if (error) throw error;

    return data;
  },

  // ==================== GET STAFF ====================

  async getStaff() {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return data || [];
  },

  // ==================== ENABLE / DISABLE STAFF ====================

  async toggleStaff(id, active) {
    const { data, error } = await supabase
      .from("staff")
      .update({
        active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;
  },
};