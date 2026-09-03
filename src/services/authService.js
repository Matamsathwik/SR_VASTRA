import { supabase } from "../lib/supabase";

export const authService = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const { data: staff } = await supabase
      .from("staff")
      .select("username, role")
      .eq("id", data.user.id)
      .single();

    return {
      id: data.user.id,
      email: data.user.email,
      username: staff?.username || data.user.email,
      role: staff?.role || "staff",
    };
  },

  async currentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) return null;

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, username, role")
      .eq("id", user.id)
      .single();

    console.log("Auth UID:", user.id);
    console.log("Staff Row:", staff);
    console.log("Staff Error:", staffError);

    return {
      id: user.id,
      email: user.email,
      username: staff?.username || user.email,
      role: staff?.role || "staff",
    };
  },

  async logout() {
    await supabase.auth.signOut();
  },
};