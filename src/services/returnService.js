import { supabase } from "../lib/supabase";

export const returnService = {
  async create(payload) {
  if (!payload.billId) {
    throw new Error("Bill is required.");
  }

  if (!payload.customerId) {
    throw new Error("Customer is required.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("No items selected for return.");
  }

  const cleanItems = payload.items.map((item) => {
    const qty = Number(item.qty);

    if (!item.stockId) {
      throw new Error("Invalid stock item.");
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error(
        "Return quantity must be a positive whole number."
      );
    }

    return {
      stock_id: Number(item.stockId),
      qty,
    };
  });

  const { data, error } = await supabase.rpc("create_customer_return", {
    p_bill_id: Number(payload.billId),
    p_customer_id: Number(payload.customerId),
    p_items: cleanItems,
    p_reason: payload.reason || "Other",
    p_refund_amount: Number(payload.refundAmount || 0),
    p_created_by: payload.createdBy || null,
    p_settlement_type: payload.settlementType || "CREDIT",
  });

  if (error) {
    console.error(
      "create_customer_return RPC error:",
      error
    );

    throw new Error(
      error.message ||
        "Return could not be saved."
    );
  }

  // RPC returns the newly created return ID.
  // Fetch the complete return record for the existing UI.
  const { data: returnData, error: fetchError } =
    await supabase
      .from("returns")
      .select("*")
      .eq("id", data)
      .single();

  if (fetchError) {
    throw fetchError;
  }

  return returnData;
},

  // --------------------------------------------------
  // GET ALL RETURNS
  // --------------------------------------------------

  async getAll() {
    const { data, error } = await supabase
      .from("returns")
      .select(`
        *,
        customers(name, phone),
        bills!returns_bill_id_fkey(
          bill_no,
          total,
          discount
        ),
        return_items(*)
      `)
      .order("id", { ascending: false });

    if (error) throw error;

    return (data || []).map((r) => ({
      id: r.id,

      returnNo: r.return_no,

      returnDate: r.created_at
        ? new Date(r.created_at).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        })
      : "",

      billId: r.bill_id,

      billNo: r.bills?.bill_no || "-",

      customerId: r.customer_id,

      customerName: r.customers?.name || "-",

      customerPhone: r.customers?.phone || "",

      amount: Number(r.refund_amount || 0),

      reason: r.reason || "Other",

      originalTotal: Number(r.bills?.total || 0),

      discount: Number(r.bills?.discount || 0),

      createdBy: r.created_by,

      createdAt: r.created_at,

      items: (r.return_items || []).map((item) => ({
  id: item.id,
  stockId: item.stock_id,
  itemName: item.item_name,
  stockNo: item.stock_no,
  category: item.category || "Item",
  qty: Number(item.qty || 0),
  returnQty: Number(item.qty || 0),
  price: Number(item.price || 0),
})),
    }));
  },

  // --------------------------------------------------
  // GET RETURNS FOR ONE CUSTOMER
  // --------------------------------------------------

  async getByCustomer(customerId) {
    const { data, error } = await supabase
      .from("returns")
      .select(`
        *,
        bills!returns_bill_id_fkey(
          bill_no,
          total,
          discount
        ),
        return_items(*)
      `)
      .eq("customer_id", customerId)
      .order("id", { ascending: false });

    if (error) throw error;

    return (data || []).map((r) => ({
      id: r.id,

      returnNo: r.return_no,

      returnDate: r.created_at
        ? new Date(r.created_at).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        })
      : "",
      billId: r.bill_id,

      billNo: r.bills?.bill_no || "-",

      customerId: r.customer_id,

      amount: Number(r.refund_amount || 0),

      reason: r.reason || "Other",

      originalTotal: Number(r.bills?.total || 0),

      discount: Number(r.bills?.discount || 0),

      createdBy: r.created_by,

      createdAt: r.created_at,

      items: (r.return_items || []).map((item) => ({
  id: item.id,
  stockId: item.stock_id,
  itemName: item.item_name,
  stockNo: item.stock_no,
  category: item.category || "Item",
  qty: Number(item.qty || 0),
  returnQty: Number(item.qty || 0),
  price: Number(item.price || 0),
})),
    }));
  },
};