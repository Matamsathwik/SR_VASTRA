import { supabase } from "../lib/supabase";

export const stockService = {
  async getAll() {
  const { data, error } = await supabase
    .from("stock")
    .select("*")
    .order("id", { ascending: true });

  if (error) throw error;

  // Get supplier-return adjustments only
  const { data: adjustments, error: adjustmentError } =
    await supabase
      .from("stock_adjustments")
      .select("stock_id, adjustment_type, quantity");

  if (adjustmentError) throw adjustmentError;

  // Calculate total quantity sent back to supplier per stock item
  const returnedMap = {};

  (adjustments || []).forEach((a) => {
    if (a.adjustment_type === "Return to Supplier") {
      const stockId = Number(a.stock_id);

      returnedMap[stockId] =
        (returnedMap[stockId] || 0) + Number(a.quantity || 0);
    }
  });

  return data.map((s) => ({
    id: s.id,
    stockNo: s.stock_no
      ? String(s.stock_no).replace(/\D/g, "")
      : "",
    supplier: s.supplier,
    itemName: s.item_name,
    category: s.category,

    purchasePrice: s.purchase_price,
    sellingPrice: s.selling_price,

    totalQty: s.total_qty,
    currentQty: s.current_qty,

    // Total supplier returns
    returnedQty: returnedMap[Number(s.id)] || 0,

    status: s.status || "active",
    statusReason: s.status_reason || "",

    purchaseDate: s.created_at?.split("T")[0],
    statusUpdatedAt: s.status_updated_at,
  }));
},

  async create(item) {
  const { data, error } = await supabase
    .from("stock")
    .insert({
      supplier: item.supplier,
      item_name: item.itemName,
      category: item.category,
      purchase_price: item.purchasePrice,
      selling_price: item.sellingPrice,
      total_qty: item.totalQty,
      current_qty: item.currentQty,
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
      supplier: item.supplier,
      item_name: item.itemName,
      category: item.category,
      purchase_price: item.purchasePrice,
      selling_price: item.sellingPrice,
      total_qty: item.totalQty,
      current_qty: item.currentQty,
    })
    .eq("id", id);

  if (error) throw error;
},

  async adjustStock(id, quantity, type) {
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("Quantity must be a positive whole number.");
  }

  if (!type) {
    throw new Error("Please select an adjustment type.");
  }

  const { data: stock, error: fetchError } = await supabase
    .from("stock")
    .select("id, current_qty, total_qty")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;

  if (!stock) {
    throw new Error("Stock item not found.");
  }

  const currentQty = Number(stock.current_qty || 0);

  if (qty > currentQty) {
    throw new Error(
      `Only ${currentQty} pieces are available.`
    );
  }

  // Record the adjustment
  const { error: adjustmentError } = await supabase
    .from("stock_adjustments")
    .insert({
      stock_id: id,
      adjustment_type: type,
      quantity: qty,
    });

  if (adjustmentError) throw adjustmentError;

  // Reduce available stock
  const newQty = currentQty - qty;

  const { data, error } = await supabase
    .from("stock")
    .update({
      current_qty: newQty,
      status: newQty === 0 ? "out_of_stock" : "active",
      status_reason: null,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
},

async getReturnedQuantity(stockId) {
  const { data, error } = await supabase
    .from("stock_adjustments")
    .select("quantity")
    .eq("stock_id", stockId)
    .eq("adjustment_type", "Return to Supplier");

  if (error) throw error;

  return (data || []).reduce(
    (total, row) => total + Number(row.quantity || 0),
    0
  );
},

};