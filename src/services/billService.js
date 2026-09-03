import { supabase } from "../lib/supabase";

export const billService = {
  // Get all bills
  async getAll() {
    const { data, error } = await supabase
      .from("bills")
      .select(`
        *,
        bill_items(*),
        staff:created_by(username)
      `)
      .order("bill_date", { ascending: false })
      .order("bill_no", { ascending: false });

    if (error) throw error;

    return data.map((b) => {
      const total = Number(b.total || 0);
      const paid = Number(b.paid || 0);

      return {
        id: b.id,

        billNo: Number(b.bill_no),
        billDate: b.bill_date,

        customerId: Number(b.customer_id),

        total,
        discount: Number(b.discount || 0),
        paid,

        // Keep due numeric and prevent negative due
        due: Math.max(
          0,
          Number(
            b.due ?? (total - paid)
          )
        ),

        paymentMode: b.payment_mode,
        status: b.status,

        createdBy: b.staff?.username || "Unknown",
        createdAt: b.created_at,

        // Payment history stored with the bill
        payments: Array.isArray(b.payments)
          ? b.payments
          : [],

        // Purchased items
        items: (b.bill_items || []).map((i) => ({
          stockId: i.stock_id,
          category: i.category,
          qty: Number(i.qty || 0),
          price: Number(i.price || 0),
        })),
      };
    });
  },

  // Get bills for one customer
  async getByCustomer(customerId) {
    const { data, error } = await supabase
      .from("bills")
      .select(`
        *,
        bill_items(*),
        staff:created_by(username)
      `)
      .eq("customer_id", Number(customerId))
      .order("bill_date", { ascending: false })
      .order("bill_no", { ascending: false });

    if (error) throw error;

    return data;
  },

  // Create a new bill
  async create(bill) {
    const paid = Number(bill.paid || 0);

    const { data, error } = await supabase
      .from("bills")
      .insert({
        bill_date: bill.billDate,
        customer_id: Number(bill.customerId),

        total: Number(bill.total || 0),
        discount: Number(bill.discount || 0),
        paid,

        due: Number(bill.due || 0),

        payment_mode: bill.paymentMode,
        status: bill.status,
        created_by: bill.createdBy,

        // Save first payment in payment history
        payments:
          paid > 0
            ? [
                {
                  amount: paid,
                  mode: bill.paymentMode,
                  date: bill.billDate,
                  time: new Date().toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  }),
                },
              ]
            : [],
      })
      .select()
      .single();

    if (error) throw error;

    // Save bill items
    const items = (bill.items || []).map((i) => ({
      bill_id: data.id,
      stock_id: i.stockId,
      category: i.category,
      qty: Number(i.qty || 0),
      price: Number(i.price || 0),
    }));

    if (items.length > 0) {
      const { error: itemError } = await supabase
        .from("bill_items")
        .insert(items);

      if (itemError) throw itemError;
    }

    return data;
  },

  // Update a bill
  async update(id, values) {
    const { data, error } = await supabase
      .from("bills")
      .update(values)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return data;
  },
};