import { supabase } from "../lib/supabase";

export const supplierService = {
  async getAll() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return data || [];
  },

  async create(supplier) {
    if (!supplier.name?.trim()) {
      throw new Error("Supplier name is required.");
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name: supplier.name.trim(),
        phone: supplier.phone?.trim() || null,
        address: supplier.address?.trim() || null,
        gstin: supplier.gstin?.trim() || null,
        opening_due: Number(supplier.openingDue || 0),
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },
};