import { supabase } from "../lib/supabase";

export const stockService = {
  async getAll() {
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    return data.map((s) => ({
      id: s.id,

      stockNo: s.stock_no
        ? String(s.stock_no).replace(/\D/g, "")
        : "",

      supplier: s.supplier || "",
      itemName: s.item_name || "",
      category: s.category || "",

      barcode: s.barcode || "",
      hsnCode: s.hsn_code || "",

      gstRate: Number(s.gst_rate || 0),
      gstInclusive: s.gst_inclusive !== false,

      mrp: Number(s.mrp || 0),

      purchasePrice: Number(s.purchase_price || 0),
      sellingPrice: Number(s.selling_price || 0),

      totalQty: Number(s.total_qty || 0),
      currentQty: Number(s.current_qty || 0),

      reorderLevel: Number(s.reorder_level || 0),

      status: s.status || "active",
      statusReason: s.status_reason || "",
      statusUpdatedAt: s.status_updated_at || null,

      purchaseDate: s.created_at
        ? s.created_at.split("T")[0]
        : "",
    }));
  },

  async create(item) {
    const { data, error } = await supabase
      .from("stock")
      .insert({
        supplier: item.supplier || null,
        item_name: item.itemName,
        barcode: item.barcode || null,
        category: item.category || null,

        purchase_price: Number(item.purchasePrice || 0),
        selling_price: Number(item.sellingPrice || 0),
        mrp: Number(item.mrp || 0),

        hsn_code: item.hsnCode || null,
        gst_rate: Number(item.gstRate || 0),
        gst_inclusive: item.gstInclusive !== false,

        total_qty: Number(item.totalQty || 0),
        current_qty: Number(
          item.currentQty ?? item.totalQty ?? 0
        ),

        status: "active",
        status_reason: null,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },

  async update(id, item) {
    const { error } = await supabase
      .from("stock")
      .update({
        supplier: item.supplier || null,
        item_name: item.itemName,
        barcode: item.barcode || null,
        category: item.category || null,

        purchase_price: Number(item.purchasePrice || 0),
        selling_price: Number(item.sellingPrice || 0),
        mrp: Number(item.mrp || 0),

        hsn_code: item.hsnCode || null,
        gst_rate: Number(item.gstRate || 0),
        gst_inclusive: item.gstInclusive !== false,

        total_qty: Number(item.totalQty || 0),
        current_qty: Number(item.currentQty || 0),
      })
      .eq("id", id);

    if (error) throw error;
  },

  async adjustStock(id, quantity, type) {
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Invalid adjustment quantity.");
    }

    // Get the latest quantity directly from Supabase
    const { data: item, error: fetchError } = await supabase
      .from("stock")
      .select("id, item_name, current_qty, total_qty")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    const currentQty = Number(item.current_qty || 0);

    if (qty > currentQty) {
      throw new Error(
        `Quantity cannot exceed available stock (${currentQty}).`
      );
    }

    const newCurrentQty = currentQty - qty;

    const { error: updateError } = await supabase
      .from("stock")
      .update({
        current_qty: newCurrentQty,
        status: "active",
        status_reason: type || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return {
      id: item.id,
      itemName: item.item_name,
      quantity: qty,
      type,
      previousQty: currentQty,
      currentQty: newCurrentQty,
    };
  },
};