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
  const name = supplier.name?.trim();

  if (!name) {
    throw new Error("Supplier name is required.");
  }

  const { data: existing, error: checkError } = await supabase
    .from("suppliers")
    .select("id, name")
    .ilike("name", name)
    .limit(1);

  if (checkError) throw checkError;

  if (existing?.length > 0) {
    throw new Error(`Supplier "${existing[0].name}" already exists.`);
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name,
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

    async getPurchases(supplierId) {
    if (!supplierId) {
      throw new Error("Supplier ID is required.");
    }

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        purchase_items (
          id,
          stock_id,
          item_name,
          stock_no,
          barcode,
          qty,
          purchase_price,
          selling_price,
          mrp
        )
      `)
      .eq("supplier_id", Number(supplierId))
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  },

  async getReturns(supplierId) {
    if (!supplierId) {
      throw new Error("Supplier ID is required.");
    }

    const { data, error } = await supabase
      .from("supplier_returns")
      .select("*")
      .eq("supplier_id", Number(supplierId))
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  },

  async getPayments(supplierId) {
    if (!supplierId) {
      throw new Error("Supplier ID is required.");
    }

    const { data, error } = await supabase
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", Number(supplierId))
      .order("payment_date", { ascending: false });

    if (error) throw error;

    return data || [];
  },

};