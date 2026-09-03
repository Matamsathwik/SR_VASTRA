import { supabase } from "../lib/supabase";
import { getCustomers, saveCustomers } from "../data/storage";

export const customerService = {
  // --------------------------------------------------
  // Get all customers
  // --------------------------------------------------
  async getAll() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("id");

    if (error) throw error;

    saveCustomers(data);

    return data;
  },

  // --------------------------------------------------
  // Create customer
  // --------------------------------------------------
  async create(customer) {
    const payload = {
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
      previous_due: Number(customer.previousDue || 0),
    };

    const { data, error } = await supabase
      .from("customers")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    const localCustomers = getCustomers();

    saveCustomers([...localCustomers, data]);

    return data;
  },

  // --------------------------------------------------
  // Update customer
  // --------------------------------------------------
  async update(id, customer) {
    const { data, error } = await supabase
      .from("customers")
      .update({
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || "",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const localCustomers = getCustomers();

    saveCustomers(
      localCustomers.map((c) =>
        Number(c.id) === Number(id) ? data : c
      )
    );

    return data;
  },

  // --------------------------------------------------
  // Update previous due
  // --------------------------------------------------
  async updatePreviousDue(id, amount) {
    const due = Number(amount);

    if (!Number.isFinite(due) || due < 0) {
      throw new Error("Previous due must be 0 or more.");
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        previous_due: due,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const localCustomers = getCustomers();

    saveCustomers(
      localCustomers.map((c) =>
        Number(c.id) === Number(id) ? data : c
      )
    );

    return data;
  },

  // --------------------------------------------------
  // Collect customer payment
  // --------------------------------------------------
  async collectPayment(
    customerId,
    amount,
    paymentMode = "Cash",
    note = ""
  ) {
    const payment = Number(amount);

    if (!Number.isFinite(payment) || payment <= 0) {
      throw new Error("Payment amount must be greater than 0.");
    }

    const { error } = await supabase.rpc(
      "collect_customer_payment",
      {
        p_customer_id: Number(customerId),
        p_amount: payment,
        p_payment_mode: paymentMode,
        p_note: note || null,
      }
    );

    if (error) throw error;

    // Get the latest customer data from Supabase
    const { data, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError) throw customerError;

    // Keep local cache synchronized
    const localCustomers = getCustomers();

    saveCustomers(
      localCustomers.map((c) =>
        Number(c.id) === Number(customerId) ? data : c
      )
    );

    return data;
  },

  // --------------------------------------------------
  // Delete customer
  // --------------------------------------------------
  async delete(id) {
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    const localCustomers = getCustomers();

    saveCustomers(
      localCustomers.filter(
        (c) => Number(c.id) !== Number(id)
      )
    );
  },
};