import { supabase } from "../lib/supabase";

export const activityService = {
  async getAll() {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async add({ username, role, action }) {
    const { error } = await supabase
      .from("activity_logs")
      .insert({
        username,
        role,
        action,
      });

    if (error) throw error;
  },
};