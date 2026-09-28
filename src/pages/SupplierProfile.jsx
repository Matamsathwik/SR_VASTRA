import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CreditCard, Edit, Plus, RefreshCw, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { supplierService } from "../services/supplierService";

const ITEMS_PER_PAGE = 10;

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numberValue = (value) => Number(value || 0);

const getReturnAmount = (item) =>
  numberValue(
    item.return_value ??
      item.total_amount ??
      item.line_total ??
      item.amount ??
      item.total ??
      numberValue(item.qty) * numberValue(item.purchase_price),
  );

export default function SupplierProfile({ supplier, goBack }) {
  // ============================================================
  // MAIN DATA
  // ============================================================

  const [supplierData, setSupplierData] = useState(supplier || null);
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // DETAIL VIEWS
  // ============================================================

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);

  // ============================================================
  // PAGINATION
  // ============================================================

  const [purchasePage, setPurchasePage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  // ============================================================
  // EDIT SUPPLIER
  // ============================================================

  const [editingSupplier, setEditingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    address: "",
    gstin: "",
    openingDue: "",
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // ============================================================
  // SUPPLIER PAYMENT
  // ============================================================

  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  // ============================================================
  // LOAD PROFILE
  // ============================================================

  const loadProfile = async () => {
    if (!supplier?.id) return;

    try {
      setLoading(true);
      setError("");

      const [supplierResult, purchaseResult, returnResult, paymentResult] =
        await Promise.all([
          supabase
            .from("suppliers")
            .select("*")
            .eq("id", Number(supplier.id))
            .single(),

          supabase
            .from("purchases")
            .select(
              `
            *,
            purchase_items (*)
          `,
            )
            .eq("supplier_id", Number(supplier.id))
            .order("created_at", { ascending: false }),

          supabase
            .from("supplier_returns")
            .select(
              `
            *,
            supplier_return_items (*)
          `,
            )
            .eq("supplier_id", Number(supplier.id))
            .order("created_at", { ascending: false }),

          supabase
            .from("supplier_payments")
            .select("*")
            .eq("supplier_id", Number(supplier.id))
            .order("payment_date", { ascending: false })
            .order("id", { ascending: false }),
        ]);

      if (supplierResult.error) throw supplierResult.error;
      if (purchaseResult.error) throw purchaseResult.error;
      if (returnResult.error) throw returnResult.error;
      if (paymentResult.error) throw paymentResult.error;

      setSupplierData(supplierResult.data || supplier);
      setPurchases(purchaseResult.data || []);
      setReturns(returnResult.data || []);
      setPayments(paymentResult.data || []);
    } catch (err) {
      console.error("Supplier profile error:", err);
      setError(err.message || "Unable to load supplier profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [supplier?.id]);

  // ============================================================
  // REALTIME / WINDOW REFRESH
  // ============================================================

  useEffect(() => {
    if (!supplier?.id) return;

    const refresh = () => {
      loadProfile();
    };

    window.addEventListener("focus", refresh);

    const supplierChannel = supabase
      .channel(`supplier-profile-${supplier.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suppliers",
          filter: `id=eq.${supplier.id}`,
        },
        refresh,
      )
      .subscribe();

    const purchasesChannel = supabase
      .channel(`supplier-purchases-${supplier.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchases",
          filter: `supplier_id=eq.${supplier.id}`,
        },
        refresh,
      )
      .subscribe();

    const returnsChannel = supabase
      .channel(`supplier-returns-${supplier.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supplier_returns",
          filter: `supplier_id=eq.${supplier.id}`,
        },
        refresh,
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel(`supplier-payments-${supplier.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supplier_payments",
          filter: `supplier_id=eq.${supplier.id}`,
        },
        refresh,
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", refresh);
      supabase.removeChannel(supplierChannel);
      supabase.removeChannel(purchasesChannel);
      supabase.removeChannel(returnsChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [supplier?.id]);

  // ============================================================
  // CALCULATIONS
  // ============================================================

  const totalPurchases = useMemo(
    () =>
      purchases.reduce((sum, purchase) => sum + numberValue(purchase.total), 0),
    [purchases],
  );

  const totalReturns = useMemo(
    () =>
      returns.reduce(
        (sum, item) =>
          sum +
          numberValue(
            item.total_amount ??
              item.return_amount ??
              item.amount ??
              item.total,
          ),
        0,
      ),
    [returns],
  );

  /*
   * IMPORTANT:
   * supplier_payments contains:
   * - purchase-time payments
   * - later supplier payments
   *
   * Therefore total paid must come from supplier_payments,
   * not purchases.paid alone.
   */
  const totalPaid = useMemo(
    () =>
      payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0),
    [payments],
  );

  const openingDue = numberValue(
    supplierData?.opening_due ?? supplierData?.openingDue,
  );

  const currentDue = Math.max(
    0,
    openingDue + totalPurchases - totalReturns - totalPaid,
  );

  // ============================================================
  // PAGINATION
  // ============================================================

  const sortedPurchases = useMemo(
    () =>
      [...purchases].sort(
        (a, b) =>
          new Date(b.created_at || b.purchase_date).getTime() -
          new Date(a.created_at || a.purchase_date).getTime(),
      ),
    [purchases],
  );

  const sortedReturns = useMemo(
    () =>
      [...returns].sort(
        (a, b) =>
          new Date(b.created_at || b.return_date).getTime() -
          new Date(a.created_at || a.return_date).getTime(),
      ),
    [returns],
  );

  const sortedPayments = useMemo(
    () =>
      [...payments].sort(
        (a, b) =>
          new Date(b.payment_date || b.created_at).getTime() -
          new Date(a.payment_date || a.created_at).getTime(),
      ),
    [payments],
  );

  const purchaseTotalPages = Math.max(
    1,
    Math.ceil(sortedPurchases.length / ITEMS_PER_PAGE),
  );

  const returnTotalPages = Math.max(
    1,
    Math.ceil(sortedReturns.length / ITEMS_PER_PAGE),
  );

  const paymentTotalPages = Math.max(
    1,
    Math.ceil(sortedPayments.length / ITEMS_PER_PAGE),
  );

  const paginatedPurchases = sortedPurchases.slice(
    (purchasePage - 1) * ITEMS_PER_PAGE,
    purchasePage * ITEMS_PER_PAGE,
  );

  const paginatedReturns = sortedReturns.slice(
    (returnPage - 1) * ITEMS_PER_PAGE,
    returnPage * ITEMS_PER_PAGE,
  );

  const paginatedPayments = sortedPayments.slice(
    (paymentPage - 1) * ITEMS_PER_PAGE,
    paymentPage * ITEMS_PER_PAGE,
  );

  // ============================================================
  // EDIT SUPPLIER
  // ============================================================

  const openEditSupplier = () => {
    setSupplierForm({
      name: supplierData?.name || "",
      phone: supplierData?.phone || "",
      address: supplierData?.address || "",
      gstin: supplierData?.gstin || "",
      openingDue: supplierData?.opening_due ?? "",
    });

    setEditingSupplier(true);
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      alert("Supplier name is required.");
      return;
    }

    const openingDueValue = Number(supplierForm.openingDue || 0);

    if (!Number.isFinite(openingDueValue) || openingDueValue < 0) {
      alert("Opening due must be 0 or more.");
      return;
    }

    try {
      setSavingSupplier(true);

      const { data, error: updateError } = await supabase
        .from("suppliers")
        .update({
          name: supplierForm.name.trim(),
          phone: supplierForm.phone.trim() || null,
          address: supplierForm.address.trim() || null,
          gstin: supplierForm.gstin.trim() || null,
          opening_due: openingDueValue,
        })
        .eq("id", Number(supplier.id))
        .select()
        .single();

      if (updateError) throw updateError;

      setSupplierData(data);
      setEditingSupplier(false);

      await loadProfile();

      alert("Supplier details updated successfully.");
    } catch (err) {
      console.error("Update supplier error:", err);
      alert(err.message || "Unable to update supplier.");
    } finally {
      setSavingSupplier(false);
    }
  };

  // ============================================================
  // PAY SUPPLIER
  // ============================================================

  const openPayment = () => {
    if (currentDue <= 0) {
      alert("This supplier has no pending due.");
      return;
    }

    setPaymentAmount("");
    setPaymentMode("Cash");
    setReferenceNo("");
    setPaymentNote("");
    setShowPayment(true);
  };

  const saveSupplierPayment = async () => {
    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > currentDue) {
      alert(`Maximum pending amount is ${money(currentDue)}.`);
      return;
    }

    try {
      setPaymentSaving(true);

      const { error } = await supabase.rpc("record_supplier_payment", {
        p_supplier_id: Number(supplier.id),
        p_amount: amount,
        p_payment_mode: paymentMode,
        p_reference_no: referenceNo || null,
        p_note: paymentNote || null,
      });

      if (error) throw error;

      setShowPayment(false);
      setPaymentAmount("");
      setPaymentMode("Cash");
      setReferenceNo("");
      setPaymentNote("");

      await loadProfile();

      alert("Supplier payment recorded successfully.");
    } catch (err) {
      console.error("Supplier payment error:", err);
      alert(err.message || "Unable to record supplier payment.");
    } finally {
      setPaymentSaving(false);
    }
  };

  // ============================================================
  // PURCHASE DETAIL VIEW
  // ============================================================

  if (selectedPurchase) {
    return (
      <PurchaseDetailsView
        purchase={selectedPurchase}
        supplier={supplierData}
        goBack={() => setSelectedPurchase(null)}
      />
    );
  }

  // ============================================================
  // RETURN DETAIL VIEW
  // ============================================================

  if (selectedReturn) {
    return (
      <SupplierReturnDetailsView
        returnData={selectedReturn}
        supplier={supplierData}
        goBack={() => setSelectedReturn(null)}
      />
    );
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={smallCardStyle}>Loading supplier profile...</div>
      </main>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error) {
    return (
      <main style={pageStyle}>
        <div style={errorCardStyle}>
          <h2>Unable to load supplier</h2>
          <p>{error}</p>

          <button style={primaryButton} onClick={loadProfile}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </main>
    );
  }

  // ============================================================
  // MAIN PROFILE
  // ============================================================

  return (
    <main style={pageStyle}>
      {/* HEADER */}
      <section style={profileHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>SUPPLIER PROFILE</div>

          <h1 style={pageTitleStyle}>{supplierData?.name || "Supplier"}</h1>

          <div style={supplierInfoRow}>
            <span>
              <strong>Phone:</strong> {supplierData?.phone || "-"}
            </span>

            <span>
              <strong>Address:</strong> {supplierData?.address || "-"}
            </span>

            <span>
              <strong>GSTIN:</strong> {supplierData?.gstin || "-"}
            </span>
          </div>
        </div>

        <div style={headerActionsStyle}>
          <button style={secondaryButton} onClick={openEditSupplier}>
            <Edit size={16} />
            Edit Supplier
          </button>

          <button style={darkButton} onClick={goBack}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </section>

      {/* SUMMARY */}
      <section style={summaryGridStyle}>
        <SummaryCard title="Total Purchases" value={money(totalPurchases)} />

        <SummaryCard title="Total Paid" value={money(totalPaid)} />

        <SummaryCard title="Total Returns" value={money(totalReturns)} />

        <SummaryCard title="Current Due" value={money(currentDue)} danger />
      </section>

      {/* DUE ACTION */}
      <section style={dueActionStyle}>
        <div>
          <span style={mutedText}>Current outstanding due</span>

          <strong
            style={{
              color: currentDue > 0 ? "#dc2626" : "#0f766e",
              marginLeft: 8,
            }}
          >
            {money(currentDue)}
          </strong>
        </div>

        <button
          style={{
            ...darkButton,
            opacity: currentDue > 0 ? 1 : 0.55,
          }}
          disabled={currentDue <= 0}
          onClick={openPayment}
        >
          <CreditCard size={16} />
          Pay Supplier Due
        </button>
      </section>

      {/* PURCHASE HISTORY */}
      <section style={sectionCardStyle}>
        <SectionHeader
          title="Purchase History"
          count={purchases.length}
          onRefresh={loadProfile}
        />

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Purchase No</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Due</th>
                <th style={thStyle}>Payment</th>
              </tr>
            </thead>

            <tbody>
              {paginatedPurchases.length === 0 ? (
                <EmptyRow colSpan={6} text="No purchases yet." />
              ) : (
                paginatedPurchases.map((purchase) => {
                  const total = numberValue(purchase.total);
                  const paid = numberValue(purchase.paid);
                  const due = numberValue(purchase.due);

                  return (
                    <tr
                      key={purchase.id}
                      style={clickableRowStyle}
                      onClick={() => setSelectedPurchase(purchase)}
                    >
                      <td style={tdStyle}>
                        <strong>
                          {purchase.purchase_no || `#${purchase.id}`}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {purchase.purchase_date ||
                          purchase.created_at?.slice(0, 10) ||
                          "-"}
                      </td>

                      <td style={tdStyle}>{money(total)}</td>

                      <td style={tdStyle}>{money(paid)}</td>

                      <td
                        style={{
                          ...tdStyle,
                          color: due > 0 ? "#dc2626" : "#0f766e",
                          fontWeight: 700,
                        }}
                      >
                        {money(due)}
                      </td>

                      <td style={tdStyle}>{purchase.payment_mode || "Due"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={purchasePage}
          totalPages={purchaseTotalPages}
          onPageChange={setPurchasePage}
        />
      </section>

      {/* SUPPLIER RETURN HISTORY */}
      <section style={sectionCardStyle}>
        <SectionHeader
          title="Supplier Return History"
          count={returns.length}
          onRefresh={loadProfile}
        />

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Return ID</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Purchase</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Reason</th>
              </tr>
            </thead>

            <tbody>
              {paginatedReturns.length === 0 ? (
                <EmptyRow colSpan={5} text="No supplier returns yet." />
              ) : (
                paginatedReturns.map((item) => {
                  const amount = numberValue(
                    item.total_amount ??
                      item.return_amount ??
                      item.amount ??
                      item.total,
                  );

                  return (
                    <tr
                      key={item.id}
                      style={clickableRowStyle}
                      onClick={() => setSelectedReturn(item)}
                    >
                      <td style={tdStyle}>
                        <strong>#{item.id}</strong>
                      </td>

                      <td style={tdStyle}>
                        {item.return_date ||
                          item.created_at?.slice(0, 10) ||
                          "-"}
                      </td>

                      <td style={tdStyle}>
                        {item.purchase_id ? `#${item.purchase_id}` : "-"}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          color: "#0f766e",
                          fontWeight: 700,
                        }}
                      >
                        {money(amount)}
                      </td>

                      <td style={tdStyle}>{item.reason || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={returnPage}
          totalPages={returnTotalPages}
          onPageChange={setReturnPage}
        />
      </section>

      {/* PAYMENT HISTORY */}
      <section style={sectionCardStyle}>
        <SectionHeader
          title="Payment History"
          count={payments.length}
          onRefresh={loadProfile}
        />

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Payment ID</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Purchase</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Mode</th>
                <th style={thStyle}>Reference</th>
                <th style={thStyle}>Note</th>
                <th style={thStyle}>Type</th>
              </tr>
            </thead>

            <tbody>
              {paginatedPayments.length === 0 ? (
                <EmptyRow colSpan={8} text="No payment history yet." />
              ) : (
                paginatedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={tdStyle}>#{payment.id}</td>

                    <td style={tdStyle}>
                      {payment.payment_date ||
                        payment.created_at?.slice(0, 10) ||
                        "-"}
                    </td>

                    <td style={tdStyle}>
                      {payment.purchase_id ? `#${payment.purchase_id}` : "-"}
                    </td>

                    <td
                      style={{
                        ...tdStyle,
                        color: "#0f766e",
                        fontWeight: 700,
                      }}
                    >
                      {money(payment.amount)}
                    </td>

                    <td style={tdStyle}>{payment.payment_mode || "-"}</td>

                    <td style={tdStyle}>{payment.reference_no || "-"}</td>

                    <td style={tdStyle}>{payment.note || "-"}</td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          ...typeBadgeStyle,
                          background: payment.purchase_id
                            ? "#fff7ed"
                            : "#ecfdf5",
                          color: payment.purchase_id ? "#9a3412" : "#047857",
                        }}
                      >
                        {payment.purchase_id
                          ? "Purchase Payment"
                          : "Later Payment"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={paymentPage}
          totalPages={paymentTotalPages}
          onPageChange={setPaymentPage}
        />
      </section>

      {/* EDIT SUPPLIER MODAL */}
      {editingSupplier && (
        <ModalOverlay>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>Edit Supplier</h2>
                <p style={modalSubtitleStyle}>Update supplier information.</p>
              </div>

              <button
                style={iconButtonStyle}
                onClick={() => setEditingSupplier(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={formGridStyle}>
              <FormField
                label="Supplier Name *"
                value={supplierForm.name}
                onChange={(value) =>
                  setSupplierForm((prev) => ({
                    ...prev,
                    name: value,
                  }))
                }
              />

              <FormField
                label="Phone"
                value={supplierForm.phone}
                onChange={(value) =>
                  setSupplierForm((prev) => ({
                    ...prev,
                    phone: value,
                  }))
                }
              />

              <FormField
                label="GSTIN"
                value={supplierForm.gstin}
                onChange={(value) =>
                  setSupplierForm((prev) => ({
                    ...prev,
                    gstin: value,
                  }))
                }
              />

              <FormField
                label="Opening Due"
                type="number"
                value={supplierForm.openingDue}
                onChange={(value) =>
                  setSupplierForm((prev) => ({
                    ...prev,
                    openingDue: value,
                  }))
                }
              />

              <div style={{ gridColumn: "1 / -1" }}>
                <FormField
                  label="Address"
                  value={supplierForm.address}
                  onChange={(value) =>
                    setSupplierForm((prev) => ({
                      ...prev,
                      address: value,
                    }))
                  }
                />
              </div>
            </div>

            <div style={modalActionsStyle}>
              <button
                style={secondaryButton}
                onClick={() => setEditingSupplier(false)}
                disabled={savingSupplier}
              >
                Cancel
              </button>

              <button
                style={darkButton}
                onClick={saveSupplier}
                disabled={savingSupplier}
              >
                {savingSupplier ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {showPayment && (
        <ModalOverlay>
          <div style={modalStyleSmall}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>Pay Supplier Due</h2>

                <p style={modalSubtitleStyle}>
                  Current due:{" "}
                  <strong style={{ color: "#dc2626" }}>
                    {money(currentDue)}
                  </strong>
                </p>
              </div>

              <button
                style={iconButtonStyle}
                onClick={() => setShowPayment(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={paymentInfoStyle}>
              <span>Supplier</span>
              <strong>{supplierData?.name || "-"}</strong>
            </div>

            <label style={labelStyle}>Amount *</label>

            <input
              style={inputStyle}
              type="number"
              min="1"
              max={currentDue}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter amount"
            />

            <label style={labelStyle}>Payment Mode *</label>

            <select
              style={inputStyle}
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Bank</option>
            </select>

            <label style={labelStyle}>Reference No</label>

            <input
              style={inputStyle}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Optional"
            />

            <label style={labelStyle}>Note</label>

            <input
              style={inputStyle}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Optional"
            />

            <div style={modalActionsStyle}>
              <button
                style={secondaryButton}
                onClick={() => setShowPayment(false)}
                disabled={paymentSaving}
              >
                Cancel
              </button>

              <button
                style={darkButton}
                onClick={saveSupplierPayment}
                disabled={paymentSaving}
              >
                {paymentSaving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </main>
  );
}

// ============================================================
// PURCHASE DETAILS
// ============================================================

function PurchaseDetailsView({ purchase, supplier, goBack }) {
  const items = purchase.purchase_items || [];

  const subtotal = numberValue(purchase.subtotal);
  const discount = numberValue(purchase.discount);
  const taxable = numberValue(purchase.taxable_amount);
  const cgst = numberValue(purchase.cgst_amount);
  const sgst = numberValue(purchase.sgst_amount);
  const igst = numberValue(purchase.igst_amount);
  const total = numberValue(purchase.total);
  const paid = numberValue(purchase.paid);
  const due = numberValue(purchase.due);

  return (
    <main style={pageStyle}>
      <section style={detailHeaderStyle}>
        <div>
          <button style={backButtonStyle} onClick={goBack}>
            <ArrowLeft size={16} />
            Back to Supplier
          </button>

          <div style={eyebrowStyle}>PURCHASE DETAILS</div>

          <h1 style={pageTitleStyle}>
            {purchase.purchase_no || `Purchase #${purchase.id}`}
          </h1>

          <p style={detailSubText}>
            {purchase.purchase_date || purchase.created_at?.slice(0, 10) || "-"}
            {" · "}
            {supplier?.name || "Supplier"}
          </p>
        </div>
      </section>

      <section style={detailGridStyle}>
        <InfoBox
          label="Purchase No"
          value={purchase.purchase_no || `#${purchase.id}`}
        />

        <InfoBox
          label="Date"
          value={
            purchase.purchase_date || purchase.created_at?.slice(0, 10) || "-"
          }
        />

        <InfoBox label="Supplier" value={supplier?.name || "-"} />

        <InfoBox label="Payment Mode" value={purchase.payment_mode || "Due"} />
      </section>

      <section style={sectionCardStyle}>
        <SectionHeader title="Purchase Items" count={items.length} />

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Stock No</th>
                <th style={thStyle}>Barcode</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>CP</th>
                <th style={thStyle}>SP</th>
                <th style={thStyle}>MRP</th>
                <th style={thStyle}>GST</th>
                <th style={thStyle}>Total</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={9} text="No items found." />
              ) : (
                items.map((item, index) => {
                  const qty = numberValue(item.qty);
                  const cp = numberValue(item.purchase_price);

                  const lineTotal = numberValue(
                    item.line_total ?? item.total ?? qty * cp,
                  );

                  return (
                    <tr key={item.id || `${purchase.id}-${index}`}>
                      <td style={tdStyle}>
                        <strong>{item.item_name || "-"}</strong>
                      </td>

                      <td style={tdStyle}>{item.stock_no || "-"}</td>

                      <td style={tdStyle}>{item.barcode || "-"}</td>

                      <td style={tdStyle}>{qty}</td>

                      <td style={tdStyle}>{money(cp)}</td>

                      <td style={tdStyle}>{money(item.selling_price)}</td>

                      <td style={tdStyle}>{money(item.mrp)}</td>

                      <td style={tdStyle}>
                        {numberValue(item.gst ?? item.gst_percent)}%
                      </td>

                      <td style={tdStyle}>
                        <strong>{money(lineTotal)}</strong>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={totalsCardStyle}>
        <div style={totalsGridStyle}>
          <AmountRow label="Subtotal" value={subtotal} />

          <AmountRow label="Discount" value={discount} />

          <AmountRow label="Taxable Amount" value={taxable} />

          <AmountRow label="CGST" value={cgst} />

          <AmountRow label="SGST" value={sgst} />

          <AmountRow label="IGST" value={igst} />

          <AmountRow label="Total" value={total} strong />

          <AmountRow label="Paid" value={paid} green />

          <AmountRow label="Due" value={due} danger={due > 0} strong />
        </div>

        {purchase.notes && (
          <div style={notesBoxStyle}>
            <strong>Notes</strong>
            <p>{purchase.notes}</p>
          </div>
        )}
      </section>
    </main>
  );
}

// ============================================================
// SUPPLIER RETURN DETAILS
// ============================================================

function SupplierReturnDetailsView({ returnData, supplier, goBack }) {
  const items = returnData.supplier_return_items || [];

  const calculatedTotal = items.reduce(
    (sum, item) => sum + getReturnAmount(item),
    0,
  );

  const headerTotal = numberValue(
    returnData.total_amount ??
      returnData.return_amount ??
      returnData.amount ??
      returnData.total,
  );

  const total = headerTotal > 0 ? headerTotal : calculatedTotal;

  return (
    <main style={pageStyle}>
      <section style={detailHeaderStyle}>
        <div>
          <button style={backButtonStyle} onClick={goBack}>
            <ArrowLeft size={16} />
            Back to Supplier
          </button>

          <div style={eyebrowStyle}>SUPPLIER RETURN DETAILS</div>

          <h1 style={pageTitleStyle}>Return #{returnData.id}</h1>

          <p style={detailSubText}>
            {returnData.return_date ||
              returnData.created_at?.slice(0, 10) ||
              "-"}
            {" · "}
            {supplier?.name || "Supplier"}
          </p>
        </div>
      </section>

      <section style={detailGridStyle}>
        <InfoBox label="Return ID" value={`#${returnData.id}`} />

        <InfoBox
          label="Date"
          value={
            returnData.return_date || returnData.created_at?.slice(0, 10) || "-"
          }
        />

        <InfoBox label="Supplier" value={supplier?.name || "-"} />

        <InfoBox
          label="Purchase"
          value={returnData.purchase_id ? `#${returnData.purchase_id}` : "-"}
        />
      </section>

      <section style={sectionCardStyle}>
        <SectionHeader title="Returned Items" count={items.length} />

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Stock No</th>
                <th style={thStyle}>Barcode</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>CP</th>
                <th style={thStyle}>Return Value</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={6} text="No return items found." />
              ) : (
                items.map((item, index) => {
                  const qty = numberValue(item.qty);
                  const cp = numberValue(item.purchase_price);
                  const returnValue = getReturnAmount(item);

                  return (
                    <tr key={item.id || `${returnData.id}-${index}`}>
                      <td style={tdStyle}>
                        <strong>{item.item_name || item.name || "-"}</strong>
                      </td>

                      <td style={tdStyle}>{item.stock_no || "-"}</td>

                      <td style={tdStyle}>{item.barcode || "-"}</td>

                      <td style={tdStyle}>{qty}</td>

                      <td style={tdStyle}>{money(cp)}</td>

                      <td
                        style={{
                          ...tdStyle,
                          color: "#0f766e",
                          fontWeight: 700,
                        }}
                      >
                        {money(returnValue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={totalsCardStyle}>
        <div style={singleTotalStyle}>
          <span>Total Return Value</span>

          <strong>{money(total)}</strong>
        </div>

        <div style={notesBoxStyle}>
          <strong>Reason</strong>
          <p>{returnData.reason || "No reason provided."}</p>
        </div>
      </section>
    </main>
  );
}

// ============================================================
// COMPONENTS
// ============================================================

function SummaryCard({ title, value, danger = false }) {
  return (
    <div
      style={{
        ...summaryCardStyle,
        borderColor: danger ? "#ef4444" : "#e2e8f0",
      }}
    >
      <span style={summaryLabelStyle}>{title}</span>

      <strong
        style={{
          ...summaryValueStyle,
          color: danger ? "#dc2626" : "#111827",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function SectionHeader({ title, count, onRefresh }) {
  return (
    <div style={sectionHeaderStyle}>
      <div>
        <h2 style={sectionTitleStyle}>{title}</h2>

        <span style={sectionCountStyle}>
          {count} {count === 1 ? "record" : "records"}
        </span>
      </div>

      {onRefresh && (
        <button style={refreshButtonStyle} onClick={onRefresh}>
          <RefreshCw size={15} />
          Refresh
        </button>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={paginationStyle}>
      <button
        style={paginationButtonStyle}
        disabled={page === 1}
        onClick={() => onPageChange((current) => Math.max(1, current - 1))}
      >
        ← Previous
      </button>

      <span style={paginationTextStyle}>
        Page {page} of {totalPages}
      </span>

      <button
        style={paginationButtonStyle}
        disabled={page === totalPages}
        onClick={() =>
          onPageChange((current) => Math.min(totalPages, current + 1))
        }
      >
        Next →
      </button>
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} style={emptyRowStyle}>
        {text}
      </td>
    </tr>
  );
}

function InfoBox({ label, value }) {
  return (
    <div style={infoBoxStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AmountRow({
  label,
  value,
  strong = false,
  green = false,
  danger = false,
}) {
  return (
    <div style={amountRowStyle}>
      <span>{label}</span>

      <strong
        style={{
          color: danger ? "#dc2626" : green ? "#0f766e" : "#111827",
          fontWeight: strong ? 800 : 600,
        }}
      >
        {money(value)}
      </strong>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>

      <input
        style={inputStyle}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ModalOverlay({ children }) {
  return <div style={overlayStyle}>{children}</div>;
}

// ============================================================
// STYLES
// ============================================================

const pageStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "clamp(16px, 2.5vw, 28px)",
  margin: 0,
  background: "#f8fafc",
};

const profileHeaderStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "22px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const detailHeaderStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "22px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  marginBottom: "16px",
};

const eyebrowStyle = {
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  color: "#9a3412",
  marginBottom: "6px",
};

const pageTitleStyle = {
  margin: 0,
  fontSize: "clamp(24px, 2.5vw, 32px)",
  lineHeight: 1.15,
  color: "#111827",
};

const supplierInfoRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "20px",
  marginTop: "12px",
  color: "#475569",
  fontSize: "14px",
};

const headerActionsStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const summaryCardStyle = {
  minWidth: 0,
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  boxSizing: "border-box",
};

const summaryLabelStyle = {
  display: "block",
  color: "#64748b",
  fontSize: "13px",
  marginBottom: "7px",
};

const summaryValueStyle = {
  display: "block",
  fontSize: "23px",
  lineHeight: 1.1,
};

const dueActionStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "16px 18px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const sectionCardStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  marginBottom: "16px",
  overflow: "hidden",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "20px",
  color: "#111827",
};

const sectionCountStyle = {
  display: "block",
  marginTop: "3px",
  fontSize: "13px",
  color: "#64748b",
};

const tableWrapperStyle = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
};

const tableStyle = {
  width: "100%",
  minWidth: "760px",
  borderCollapse: "collapse",
  fontSize: "13px",
};

const thStyle = {
  padding: "11px 12px",
  textAlign: "left",
  background: "#f8fafc",
  color: "#7f1d1d",
  fontWeight: 800,
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "11px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  verticalAlign: "middle",
};

const clickableRowStyle = {
  cursor: "pointer",
};

const emptyRowStyle = {
  padding: "30px",
  textAlign: "center",
  color: "#64748b",
};

const refreshButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "8px",
  cursor: "pointer",
  color: "#334155",
  fontWeight: 600,
};

const paginationStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  marginTop: "14px",
  flexWrap: "wrap",
};

const paginationButtonStyle = {
  minWidth: "95px",
  height: "34px",
  padding: "0 12px",
  border: "1px solid #e2e8f0",
  borderRadius: "7px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
};

const paginationTextStyle = {
  minWidth: "90px",
  textAlign: "center",
  color: "#475569",
  fontSize: "13px",
  fontWeight: 600,
};

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  padding: "9px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#8b0025",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  padding: "9px 14px",
  border: "1px solid #d6b58c",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#7f1d1d",
  fontWeight: 700,
  cursor: "pointer",
};

const darkButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  padding: "9px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  border: "none",
  background: "transparent",
  padding: 0,
  marginBottom: "18px",
  color: "#475569",
  fontWeight: 700,
  cursor: "pointer",
};

const detailSubText = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: "14px",
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginBottom: "16px",
};

const infoBoxStyle = {
  padding: "14px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
};

const infoBoxLabel = {
  display: "block",
  fontSize: "12px",
  color: "#64748b",
  marginBottom: "5px",
};

const totalsCardStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "18px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  marginBottom: "16px",
};

const totalsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px 24px",
};

const amountRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "9px 0",
  borderBottom: "1px solid #f1f5f9",
  color: "#475569",
};

const singleTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  fontSize: "18px",
  fontWeight: 800,
};

const notesBoxStyle = {
  marginTop: "16px",
  padding: "13px",
  background: "#f8fafc",
  borderRadius: "8px",
  color: "#475569",
};

const smallCardStyle = {
  padding: "24px",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
};

const errorCardStyle = {
  padding: "24px",
  background: "#ffffff",
  border: "1px solid #fecaca",
  borderRadius: "14px",
};

const mutedText = {
  color: "#64748b",
  fontSize: "14px",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  boxSizing: "border-box",
};

const modalStyle = {
  width: "min(680px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "22px",
  boxSizing: "border-box",
};

const modalStyleSmall = {
  width: "min(480px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: "14px",
  padding: "22px",
  boxSizing: "border-box",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "15px",
  marginBottom: "20px",
};

const modalTitleStyle = {
  margin: 0,
  fontSize: "21px",
  color: "#111827",
};

const modalSubtitleStyle = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: "13px",
};

const iconButtonStyle = {
  width: "34px",
  height: "34px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: "7px",
  cursor: "pointer",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  color: "#334155",
  marginBottom: "6px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  height: "40px",
  padding: "0 11px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  outline: "none",
  background: "#ffffff",
  color: "#111827",
};

const modalActionsStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "22px",
  flexWrap: "wrap",
};

const paymentInfoStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  padding: "12px",
  background: "#f8fafc",
  borderRadius: "8px",
  marginBottom: "18px",
  color: "#475569",
};

const typeBadgeStyle = {
  display: "inline-flex",
  padding: "4px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 700,
};
