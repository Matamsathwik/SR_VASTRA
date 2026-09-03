import { supabase } from "../lib/supabase";
import { stockService } from "./stockService";

export const returnService = {
  async create(payload) {
    if (!payload.billId) {
      throw new Error("Bill is required.");
    }

    if (!payload.customerId) {
      throw new Error("Customer is required.");
    }

    if (!payload.items || payload.items.length === 0) {
      throw new Error("No items selected for return.");
    }

    // --------------------------------------------------
    // 1. CHECK PREVIOUS RETURNS FOR THIS BILL
    // --------------------------------------------------

    const { data: previousReturns, error: previousReturnError } =
      await supabase
        .from("returns")
        .select(`
          id,
          return_items(
            stock_id,
            qty
          )
        `)
        .eq("bill_id", payload.billId);

    if (previousReturnError) throw previousReturnError;

    // Calculate how many of each stock item were already returned
    const alreadyReturned = {};

    for (const ret of previousReturns || []) {
      for (const item of ret.return_items || []) {
        const stockId = Number(item.stock_id);
        alreadyReturned[stockId] =
          (alreadyReturned[stockId] || 0) + Number(item.qty || 0);
      }
    }

    // --------------------------------------------------
    // 2. CHECK REQUESTED RETURN QUANTITY
    // --------------------------------------------------

    for (const item of payload.items) {
      const stockId = Number(item.stockId);
      const requestedQty = Number(item.qty || 0);
      const returnedQty = alreadyReturned[stockId] || 0;

      if (requestedQty <= 0) {
        throw new Error("Return quantity must be greater than 0.");
      }

      // Get original purchased quantity from payload
      const purchasedQty = Number(
        item.purchasedQty ??
        item.boughtQty ??
        item.originalQty ??
        item.qty
      );

      const remainingQty = purchasedQty - returnedQty;

      if (requestedQty > remainingQty) {
        throw new Error(
          `Cannot return ${requestedQty} item(s). Only ${remainingQty} remaining for return.`
        );
      }
    }

    // --------------------------------------------------
    // 3. CREATE RETURN
    // --------------------------------------------------

    const { data: ret, error: returnError } = await supabase
      .from("returns")
      .insert({
        bill_id: payload.billId,
        customer_id: payload.customerId,
        reason: payload.reason,
        refund_amount: Number(payload.refundAmount || 0),
        created_by: payload.createdBy,
      })
      .select()
      .single();

    if (returnError) throw returnError;

    // --------------------------------------------------
    // 4. SAVE RETURN ITEMS
    // --------------------------------------------------

    const items = payload.items.map((item) => ({
      return_id: ret.id,
      stock_id: item.stockId,
      category: item.category || "Item",
      qty: Number(item.qty),
      price: Number(item.price || 0),
    }));

    const { error: itemError } = await supabase
      .from("return_items")
      .insert(items);

    if (itemError) throw itemError;

    // --------------------------------------------------
    // 5. RESTORE STOCK
    // --------------------------------------------------

    const stock = await stockService.getAll();

    for (const returned of payload.items) {
      const stockItem = stock.find(
        (s) => Number(s.id) === Number(returned.stockId)
      );

      if (!stockItem) continue;

      await stockService.update(stockItem.id, {
        ...stockItem,
        currentQty:
          Number(stockItem.currentQty || 0) +
          Number(returned.qty),
      });
    }

    return ret;
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
        bills(
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

      returnNo: r.id,

      returnDate: r.created_at
        ? r.created_at.split("T")[0]
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
        bills(
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

      returnNo: r.id,

      returnDate: r.created_at
        ? r.created_at.split("T")[0]
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
        category: item.category || "Item",
        qty: Number(item.qty || 0),
        returnQty: Number(item.qty || 0),
        price: Number(item.price || 0),
      })),
    }));
  },
};