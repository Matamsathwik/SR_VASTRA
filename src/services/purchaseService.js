import { supabase } from "../lib/supabase";

export const purchaseService = {
  async getAll() {
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data || [];
  },

  async getById(id) {
    if (!id) {
      throw new Error("Purchase ID is required.");
    }

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        suppliers (
          id,
          name,
          phone
        ),
        purchase_items (
          id,
          stock_id,
          item_name,
          stock_no,
          barcode,
          category,
          hsn_code,
          qty,
          purchase_price,
          selling_price,
          mrp,
          gst_rate,
          gst_inclusive,
          taxable_amount,
          cgst_amount,
          sgst_amount,
          igst_amount,
          line_total
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return data;
  },

  async create({
    supplierId,
    items,
    payments = [],
    discount = 0,
    notes = null,
  }) {
    if (!supplierId) {
      throw new Error("Please select a supplier.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Please add at least one item.");
    }

    const cleanItems = items.map((item) => {
      const qty = Number(item.qty);
      const purchasePrice = Number(item.purchase_price);

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error(
          "Quantity must be a positive whole number."
        );
      }

      if (
        !Number.isFinite(purchasePrice) ||
        purchasePrice < 0
      ) {
        throw new Error(
          "Purchase price cannot be negative."
        );
      }

      const sellingPrice =
        item.selling_price === "" ||
        item.selling_price === null ||
        item.selling_price === undefined
          ? null
          : Number(item.selling_price);

      const mrp =
        item.mrp === "" ||
        item.mrp === null ||
        item.mrp === undefined
          ? null
          : Number(item.mrp);

      if (
        sellingPrice !== null &&
        (!Number.isFinite(sellingPrice) ||
          sellingPrice < 0)
      ) {
        throw new Error(
          "Selling price cannot be negative."
        );
      }

      if (
        mrp !== null &&
        (!Number.isFinite(mrp) || mrp < 0)
      ) {
        throw new Error("MRP cannot be negative.");
      }

      const gstRate = Number(item.gst_rate || 0);

      if (
        !Number.isFinite(gstRate) ||
        gstRate < 0 ||
        gstRate > 100
      ) {
        throw new Error(
          "GST rate must be between 0 and 100."
        );
      }

      const barcode =
        item.barcode?.trim() || null;

      return {
        stock_id:
          item.stock_id === null ||
          item.stock_id === undefined ||
          item.stock_id === ""
            ? null
            : Number(item.stock_id),

        item_name:
          item.item_name?.trim() || null,

        barcode,

        category:
          item.category?.trim() || null,

        hsn_code:
          item.hsn_code?.trim() || null,

        qty,

        purchase_price: purchasePrice,

        selling_price: sellingPrice,

        mrp,

        gst_rate: gstRate,

        gst_inclusive:
          item.gst_inclusive !== false,
      };
    });

    

    const cleanPayments = (payments || [])
      .filter(
        (payment) =>
          Number(payment.amount || 0) > 0
      )
      .map((payment) => {
        const amount = Number(payment.amount);

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          throw new Error(
            "Payment amount must be greater than zero."
          );
        }

        const allowedModes = [
          "Cash",
          "UPI",
          "Card",
          "Bank",
        ];

        if (
          !allowedModes.includes(
            payment.payment_mode
          )
        ) {
          throw new Error(
            "Invalid payment mode."
          );
        }

        return {
          payment_mode:
            payment.payment_mode,

          amount,

          reference_no:
            payment.reference_no || null,

          note:
            payment.note || null,
        };
      });

    const cleanDiscount = Number(
      discount || 0
    );

    if (
      !Number.isFinite(cleanDiscount) ||
      cleanDiscount < 0
    ) {
      throw new Error(
        "Invalid purchase discount."
      );
    }

    const { data, error } =
      await supabase.rpc(
        "create_purchase",
        {
          p_supplier_id:
            Number(supplierId),

          p_payments:
            cleanPayments,

          p_items:
            cleanItems,

          p_discount:
            cleanDiscount,

          p_notes:
            notes || null,
        }
      );

    if (error) {
      console.error(
        "create_purchase RPC error:",
        error
      );

      throw new Error(
        error.message ||
          "Purchase could not be saved."
      );
    }

    return data;
  },

  async createSupplierReturn({
    supplierId,
    purchaseId,
    items,
    reason = null,
  }) {
    if (!supplierId) {
      throw new Error("Supplier is required.");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Please select at least one item to return.");
    }

    const cleanItems = items.map((item) => {
      const qty = Number(item.qty);

      if (!item.stock_id) {
        throw new Error("Invalid stock item.");
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error(
          "Return quantity must be a positive whole number."
        );
      }

      return {
        stock_id: Number(item.stock_id),
        qty,
      };
    });

    const { data, error } = await supabase.rpc(
      "create_supplier_return",
      {
        p_supplier_id: Number(supplierId),
        p_purchase_id: purchaseId
          ? Number(purchaseId)
          : null,
        p_items: cleanItems,
        p_reason: reason || null,
      }
    );

    if (error) {
      console.error(
        "create_supplier_return RPC error:",
        error
      );

      throw new Error(
        error.message ||
          "Supplier return could not be saved."
      );
    }

    return data;
  },

    async getSupplierReturns() {
  const { data, error } = await supabase
    .from("supplier_returns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      "getSupplierReturns error:",
      error
    );

    throw new Error(
      error.message ||
        "Could not load supplier returns."
    );
  }

  return data || [];
},
  
};
