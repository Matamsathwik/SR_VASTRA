import { useState, useEffect } from "react";
import { getBills, getReturns } from "../data/storage";
import { supabase } from "../lib/supabase";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import BillDetails from "./BillDetails";
import ReturnDetails from "./ReturnDetails";
import { returnService } from "../services/returnService";

export default function CustomerProfile({ customer, goBack }) {
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [purchasePage, setPurchasePage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;
  

  // -----------------------------
  // Previous Due
  // -----------------------------

  const [previousDue, setPreviousDue] = useState(
    Number(customer.previous_due || customer.previousDue || 0)
  );

  const [editingPreviousDue, setEditingPreviousDue] = useState(false);

  const [dueInput, setDueInput] = useState(
    Number(customer.previous_due || customer.previousDue || 0)
  );

  // -----------------------------
  // Collect Payment
  // -----------------------------

  const [collectingPayment, setCollectingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // -----------------------------
  // Load returns
  // -----------------------------

  const loadReturns = async () => {
    try {
      const data = await returnService.getAll();
      setReturns(
        data.filter(
          (r) => Number(r.customerId) === Number(customer.id)
        )
      );
    } catch (error) {
      console.error("Customer returns error:", error);
      setReturns(
        getReturns().filter(
          (r) => Number(r.customerId) === Number(customer.id)
        )
      );
    }
  };

  // -----------------------------
  // Load bills
  // -----------------------------

  useEffect(() => {
    const loadBills = async () => {
      try {
        const data = await billService.getByCustomer(customer.id);

        const formatted = data.map((b) => ({
          id: b.id,
          billNo: Number(b.bill_no),
          billDate: b.bill_date,
          customerId: b.customer_id,

          total: Number(b.total || 0),
          discount: Number(b.discount || 0),
          paid: Number(b.paid || 0),

          due: Math.max(
            0,
            Number(
              b.due ??
                Number(b.total || 0) -
                  Number(b.paid || 0)
            )
          ),

          paymentMode: b.payment_mode,
          status: b.status,
          createdBy: b.staff?.username || "Unknown",
          createdAt: b.created_at,
          payments: b.payments || [],
          items: b.bill_items || [],
        }));

        setBills(formatted);
      } catch (error) {
        console.error(error);

        setBills(
          getBills().filter(
            (b) =>
              Number(b.customerId) ===
              Number(customer.id)
          )
        );
      }
    };

    loadBills();
  }, [customer.id]);

  useEffect(() => {
    loadReturns();
    setReturnPage(1);
  }, [customer.id]);

  // Refresh customer profile data when returning to this page or when
  // Supabase sends a change. This prevents needing a manual browser refresh.
  useEffect(() => {
    const refresh = () => {
      // Re-run the loaders so the latest DB data appears without a browser refresh.
      loadReturns();
      (async () => {
        try {
          const [{ data: customerData, error: customerError }, data] =
            await Promise.all([
              supabase
                .from("customers")
                .select("previous_due")
                .eq("id", customer.id)
                .single(),
              billService.getByCustomer(customer.id),
            ]);

          if (!customerError && customerData) {
            const latestPreviousDue = Number(
              customerData.previous_due || 0
            );
            setPreviousDue(latestPreviousDue);
            setDueInput(latestPreviousDue);
          }
          setBills(
            data.map((b) => ({
              id: b.id,
              billNo: Number(b.bill_no),
              billDate: b.bill_date,
              customerId: b.customer_id,
              total: Number(b.total || 0),
              discount: Number(b.discount || 0),
              paid: Number(b.paid || 0),
              due: Math.max(
                0,
                Number(
                  b.due ??
                    Number(b.total || 0) - Number(b.paid || 0)
                )
              ),
              paymentMode: b.payment_mode,
              status: b.status,
              createdBy: b.staff?.username || "Unknown",
              createdAt: b.created_at,
              payments: b.payments || [],
              items: b.bill_items || [],
            }))
          );
        } catch (error) {
          console.error("Customer refresh error:", error);
        }
      })();
    };

    window.addEventListener("focus", refresh);

    const billsChannel = supabase
      .channel(`customer-profile-bills-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
          filter: `customer_id=eq.${customer.id}`,
        },
        refresh
      )
      .subscribe();

    const returnsChannel = supabase
      .channel(`customer-profile-returns-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "returns",
          filter: `customer_id=eq.${customer.id}`,
        },
        refresh
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel(`customer-profile-payments-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_payments",
          filter: `customer_id=eq.${customer.id}`,
        },
        refresh
      )
      .subscribe();

    const customersChannel = supabase
      .channel(`customer-profile-customer-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `id=eq.${customer.id}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", refresh);
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(returnsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [customer.id]);

    // -----------------------------
  // Load Payment History
  // -----------------------------

  const loadPaymentHistory = async () => {
    try {
      // Payments collected later
      const { data: collectedPayments, error } = await supabase
        .from("customer_payments")
        .select("*")
        .eq("customer_id", customer.id)
        .order("payment_date", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;

      const history = [];

      // Payments made when bills were created
      bills.forEach((bill) => {
        (bill.payments || []).forEach((payment) => {
          history.push({
            id: `bill-${bill.id}-${payment.date}-${payment.amount}`,
            date: payment.date || bill.billDate,
            amount: Number(payment.amount || 0),
            mode: payment.mode || bill.paymentMode || "Cash",
            note: payment.note || "",
            type: "Bill Payment",
          });
        });
      });

      // Payments collected later
      (collectedPayments || []).forEach((payment) => {
        history.push({
          id: `payment-${payment.id}`,
          date: payment.payment_date,
          amount: Number(payment.amount || 0),
          mode: payment.payment_mode || "Cash",
          note: payment.note || "",
          type: "Collected Payment",
        });
      });

      // Newest first
      history.sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
      );

      setPaymentHistory(history);
    } catch (error) {
      console.error("Payment history error:", error);
      setPaymentHistory([]);
    }
  };

  useEffect(() => {
    loadPaymentHistory();
  }, [customer.id, bills]);

  // -----------------------------
// Pagination
// -----------------------------

const sortedBills = bills
  .slice()
  .sort(
    (a, b) =>
      new Date(b.billDate).getTime() -
      new Date(a.billDate).getTime()
  );

const purchaseTotalPages = Math.ceil(
  sortedBills.length / ITEMS_PER_PAGE
);

const paginatedBills = sortedBills.slice(
  (purchasePage - 1) * ITEMS_PER_PAGE,
  purchasePage * ITEMS_PER_PAGE
);


const sortedReturns = returns
  .slice()
  .sort(
    (a, b) =>
      new Date(b.returnDate).getTime() -
      new Date(a.returnDate).getTime()
  );

const returnTotalPages = Math.ceil(
  sortedReturns.length / ITEMS_PER_PAGE
);

const paginatedReturns = sortedReturns.slice(
  (returnPage - 1) * ITEMS_PER_PAGE,
  returnPage * ITEMS_PER_PAGE
);


const sortedPayments = paymentHistory
  .slice()
  .sort(
    (a, b) =>
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
  );

const paymentTotalPages = Math.ceil(
  sortedPayments.length / ITEMS_PER_PAGE
);

const paginatedPayments = sortedPayments.slice(
  (paymentPage - 1) * ITEMS_PER_PAGE,
  paymentPage * ITEMS_PER_PAGE
);

  // -----------------------------
  // Amount calculations
  // -----------------------------

  const totalPurchase = bills.reduce(
    (sum, b) => sum + Number(b.total || 0),
    0
  );

  const currentDue = bills.reduce(
    (sum, b) => sum + Number(b.due || 0),
    0
  );

  const totalPending =
    Number(previousDue || 0) +
    Number(currentDue || 0);

  // -----------------------------
  // Add / Update Previous Due
  // -----------------------------

  const handleUpdatePreviousDue = async () => {
    const amount = Number(dueInput);

    if (!Number.isFinite(amount) || amount < 0) {
      alert("Previous due must be 0 or more.");
      return;
    }

    try {
      const updated =
        await customerService.updatePreviousDue(
          customer.id,
          amount
        );

      const newDue = Number(
        updated.previous_due || 0
      );

      setPreviousDue(newDue);
      setDueInput(newDue);
      setEditingPreviousDue(false);

      alert("Previous due updated.");
    } catch (error) {
      alert(error.message);
    }
  };

  // -----------------------------
  // Collect Payment
  // -----------------------------

  const handleCollectPayment = async () => {
    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > totalPending) {
      alert(
        `Maximum pending amount is ₹${totalPending.toLocaleString(
          "en-IN"
        )}.`
      );
      return;
    }

    try {
      setPaymentLoading(true);

      await customerService.collectPayment(
        customer.id,
        amount,
        paymentMode,
        paymentNote
      );

      // -----------------------------
      // Refresh customer
      // -----------------------------

      const updatedCustomers =
        await customerService.getAll();

      const updatedCustomer =
        updatedCustomers.find(
          (c) =>
            Number(c.id) ===
            Number(customer.id)
        );

      if (updatedCustomer) {
        const newPreviousDue = Number(
          updatedCustomer.previous_due || 0
        );

        setPreviousDue(newPreviousDue);
        setDueInput(newPreviousDue);
      }

      // -----------------------------
      // Refresh bills
      // -----------------------------

      const updatedBills =
        await billService.getByCustomer(
          customer.id
        );

      const formatted = updatedBills.map((b) => ({
        id: b.id,
        billNo: Number(b.bill_no),
        billDate: b.bill_date,
        customerId: b.customer_id,

        total: Number(b.total || 0),
        paid: Number(b.paid || 0),

        due: Math.max(
          0,
          Number(
            b.due ??
              Number(b.total || 0) -
                Number(b.paid || 0)
          )
        ),

        paymentMode: b.payment_mode,
        status: b.status,
        createdBy:
          b.staff?.username || "Unknown",
        createdAt: b.created_at,
        payments: b.payments || [],
        items: b.bill_items || [],
      }));

      setBills(formatted);

      // -----------------------------
      // Reset payment form
      // -----------------------------

      setPaymentAmount("");
      setPaymentMode("Cash");
      setPaymentNote("");
      setCollectingPayment(false);

      alert("Payment collected successfully.");
    } catch (error) {
      alert(error.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  // -----------------------------
  // WhatsApp Reminder
  // -----------------------------

  const sendWhatsAppReminder = () => {
    if (!customer.phone) {
      alert(
        "Customer phone number is not available."
      );
      return;
    }

    if (totalPending <= 0) {
      alert(
        "This customer has no pending amount."
      );
      return;
    }

    // Remove spaces, +, -, brackets etc.
    let phone = String(customer.phone).replace(
      /\D/g,
      ""
    );

    // Indian 10-digit number
    if (phone.length === 10) {
      phone = "91" + phone;
    }

    const message = `Hello ${customer.name},

This is a reminder from SR Vastra regarding your pending balance.

Total Pending Amount: ₹${totalPending.toLocaleString(
      "en-IN"
    )}

Please make the payment.

Thank you.`;

    const whatsappUrl =
      `https://wa.me/${phone}?text=` +
      encodeURIComponent(message);

    window.open(whatsappUrl, "_blank");
  };

  // -----------------------------
  // Bill Details
  // -----------------------------

  if (selectedBill) {
    return (
      <BillDetails
        bill={selectedBill}
        customer={customer}
        goBack={() => setSelectedBill(null)}
      />
    );
  }

  // -----------------------------
  // Return Details
  // -----------------------------

  if (selectedReturn) {
    return (
      <ReturnDetails
        returnData={selectedReturn}
        customer={customer}
        goBack={() => setSelectedReturn(null)}
      />
    );
  }

  // -----------------------------
  // Main Profile
  // -----------------------------

  return (
    <main className="content">

      <button
        className="back-btn"
        onClick={goBack}
      >
        ← Back
      </button>

      {/* Customer Information */}

      <div className="profile-card">
        <h1>{customer.name}</h1>

        <p>ID: SR-{customer.id}</p>

        <p>
          Phone: {customer.phone || "-"}
        </p>

        <p>
          Address: {customer.address || "-"}
        </p>
      </div>

      {/* Actions */}

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >

        {/* Add / Update Previous Due */}

        <button
          className="primary-btn"
          onClick={() => {
  if (editingPreviousDue) {
    setEditingPreviousDue(false);
  } else {
    setCollectingPayment(false);
    setDueInput(previousDue);
    setEditingPreviousDue(true);
  }
}}
        >
          Add / Update Previous Due
        </button>

        {/* Collect Payment */}

        <button
  className="primary-btn"
  onClick={() => {
    if (collectingPayment) {
      setCollectingPayment(false);
    } else {
      setEditingPreviousDue(false);
      setCollectingPayment(true);
    }
  }}
  disabled={totalPending <= 0}
>
  Collect Payment
</button>

        {/* WhatsApp */}

        <button
          className="primary-btn"
          onClick={sendWhatsAppReminder}
          disabled={
            totalPending <= 0 ||
            !customer.phone
          }
        >
          WhatsApp Reminder
        </button>

      </div>

      {/* Update Previous Due */}

      {editingPreviousDue && (
        <div
          className="table-card"
          style={{ marginBottom: 18 }}
        >
          <h2>
            Add / Update Previous Due
          </h2>

          <p
            style={{
              color: "#666",
              marginBottom: 15,
            }}
          >
            Current Previous Due:{" "}
            <strong>
              ₹{previousDue.toLocaleString(
                "en-IN"
              )}
            </strong>
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="number"
              min="0"
              value={dueInput}
              onChange={(e) =>
                setDueInput(e.target.value)
              }
              placeholder="Enter previous due amount"
            />

            <div
              className="customer-form-actions"
              style={{
                display: "flex",
                gap: 10,
                marginTop: 18,
                flex: "1 1 100%",
                width: "100%",

              }}
            >
              <button
                className="primary-btn"
                onClick={handleUpdatePreviousDue}
              >
                Save
              </button>

              <button
                className="back-btn"
                style={{ flex: 1 }}
                onClick={() =>
                  setEditingPreviousDue(false)
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment */}

      {collectingPayment && (
        <div
        
          className="table-card"
          style={{
            marginBottom: 18,
            maxWidth: 500,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >

          <h2>Collect Payment</h2>

          <p
            style={{
              color: "#666",
              marginBottom: 18,
            }}
          >
            Total Pending:{" "}
            <strong>
              ₹{totalPending.toLocaleString(
                "en-IN"
              )}
            </strong>
          </p>

          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 7,
            }}
          >
            Amount
          </label>

          <input
            type="number"
            min="1"
            max={totalPending}
            value={paymentAmount}
            onChange={(e) =>
              setPaymentAmount(
                e.target.value
              )
            }
            placeholder="Enter payment amount"
          />

          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginTop: 15,
              marginBottom: 7,
            }}
          >
            Payment Mode
          </label>

          <select
            value={paymentMode}
            onChange={(e) =>
              setPaymentMode(
                e.target.value
              )
            }
          >
            <option>Cash</option>
            <option>UPI</option>
            <option>Card</option>
            <option>Bank Transfer</option>
            <option>Other</option>
          </select>

          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginTop: 15,
              marginBottom: 7,
            }}
          >
            Note
          </label>

          <input
            type="text"
            value={paymentNote}
            onChange={(e) =>
              setPaymentNote(
                e.target.value
              )
            }
            placeholder="Optional"
          />

          <div
  className="customer-form-actions"
  style={{
    display: "flex",
    gap: 10,
    marginTop: 18,
  }}
>
  <button
    className="primary-btn"
    onClick={handleCollectPayment}
    disabled={paymentLoading}
  >
    {paymentLoading
      ? "Saving..."
      : "Save Payment"}
  </button>

  <button
    className="back-btn"
    style={{ flex: 1 }}
    onClick={() => {
      setCollectingPayment(false);
      setPaymentAmount("");
      setPaymentNote("");
    }}
    disabled={paymentLoading}
  >
    Cancel
  </button>
</div>
        </div>
      )}

      {/* Summary */}

      <div className="cards">

        <div className="card">
          <h3>
            ₹{totalPurchase.toLocaleString(
              "en-IN"
            )}
          </h3>
          <p>Total Purchase</p>
        </div>

        <div className="card">
          <h3>
            ₹{currentDue.toLocaleString(
              "en-IN"
            )}
          </h3>
          <p>Current Due</p>
        </div>

        <div className="card">
          <h3>
            ₹{previousDue.toLocaleString(
              "en-IN"
            )}
          </h3>
          <p>Previous Due</p>
        </div>

        <div className="card">
          <h3>
            ₹{totalPending.toLocaleString(
              "en-IN"
            )}
          </h3>
          <p>Total Pending</p>
        </div>

        <div className="card">
          <h3>{bills.length}</h3>
          <p>Bills</p>
        </div>

        <div className="card">
          <h3>{returns.length}</h3>
          <p>Returns</p>
        </div>

      </div>

      {/* Purchase History */}

      <div className="table-card">

        <h2>Purchase History</h2>

        <table className="customer-table">

          <thead>
            <tr>
              <th>Bill</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>

          <tbody>

            {bills.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No purchases yet.
                </td>
              </tr>
            ) : (
              paginatedBills.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() =>
                      setSelectedBill(b)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >

                    <td>
                      <strong>
                        #{b.billNo}
                      </strong>
                    </td>

                    <td>
                      {b.billDate}
                    </td>

                    <td>
                      ₹
                      {Number(
                        b.total
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td>
                      {b.paymentMode ||
                        "Cash"}
                    </td>

                    <td>
                      <span
                        style={{
                          color:
                            b.status ===
                            "Paid"
                              ? "#0F766E"
                              : b.status ===
                                "Partial"
                              ? "#D97706"
                              : "#C0392B",
                          fontWeight: 700,
                        }}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td
                      style={{
                        color:
                          b.due > 0
                            ? "#C0392B"
                            : "#0F766E",
                        fontWeight: 700,
                      }}
                    >
                      ₹
                      {Number(
                        b.due
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                  </tr>
                ))
            )}

          </tbody>

        </table>
        {purchaseTotalPages > 1 && (
  <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
    }}
  >
    <button
      className="back-btn"
      disabled={purchasePage === 1}
      onClick={() =>
        setPurchasePage((page) => Math.max(1, page - 1))
      }
    >
      ← Previous
    </button>

    <span style={{ fontWeight: 600 }}>
      Page {purchasePage} of {purchaseTotalPages}
    </span>

    <button
      className="primary-btn"
      style={{ width: "auto", flex: "0 0 auto" }}
      disabled={purchasePage === purchaseTotalPages}
      onClick={() =>
        setPurchasePage((page) =>
          Math.min(purchaseTotalPages, page + 1)
        )
      }
    >
      Next →
    </button>
  </div>
)}
        

        <p
          style={{
            marginTop: 12,
            color: "#666",
            fontSize: 14,
          }}
        >
          Click any bill to view full invoice.
        </p>

      </div>

      {/* Returns */}

      <div className="table-card">

        <h2>Returns</h2>

        <table className="customer-table">

          <thead>
            <tr>
              <th>Return</th>
              <th>Date</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>

            {returns.length === 0 ? (
              <tr>
                <td
                  colSpan="3"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No returns yet.
                </td>
              </tr>
            ) : (
              paginatedReturns.map((r) => (
                  <tr
                    key={r.returnNo}
                    onClick={() =>
                      setSelectedReturn(r)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >

                    <td>
                      <strong>
                        #{r.returnNo}
                      </strong>
                    </td>

                    <td>
                      {r.returnDate}
                    </td>

                    <td>
                      ₹
                      {Number(
                        r.amount || 0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                  </tr>
                ))
            )}

          </tbody>

        </table>
            {returnTotalPages > 1 && (
  <div
    style={{
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
    }}
  >
    <button
      className="back-btn"
      disabled={returnPage === 1}
      onClick={() =>
        setReturnPage((page) => Math.max(1, page - 1))
      }
    >
      ← Previous
    </button>

    <span style={{ fontWeight: 600 }}>
      Page {returnPage} of {returnTotalPages}
    </span>

    <button
      className="primary-btn"
      style={{ width: "auto", flex: "0 0 auto" }}
      disabled={returnPage === returnTotalPages}
      onClick={() =>
        setReturnPage((page) =>
          Math.min(returnTotalPages, page + 1)
        )
      }
    >
      Next →
    </button>
  </div>
)}
      </div>
            {/* Payment History */}

      <div className="table-card">

        <h2>Payment History</h2>

        <table className="customer-table">

          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Payment Mode</th>
              <th>Type</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>

            {paymentHistory.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No payment history yet.
                </td>
              </tr>
            ) : (
              paginatedPayments.map((payment) => (
                <tr key={payment.id}>

                  <td>
                    {payment.date || "-"}
                  </td>

                  <td
                    style={{
                      color: "#0F766E",
                      fontWeight: 700,
                    }}
                  >
                    ₹
                    {Number(
                      payment.amount || 0
                    ).toLocaleString("en-IN")}
                  </td>

                  <td>
                    {payment.mode || "Cash"}
                  </td>

                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          payment.type ===
                          "Collected Payment"
                            ? "#0F766E"
                            : "#8B5E00",
                      }}
                    >
                      {payment.type}
                    </span>
                  </td>

                  <td>
                    {payment.note || "-"}
                  </td>

                </tr>
              ))
            )}

          </tbody>

        </table>

        {paymentTotalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
            }}
          >
            <button
              className="back-btn"
              disabled={paymentPage === 1}
              onClick={() =>
                setPaymentPage((page) => Math.max(1, page - 1))
              }
            >
              ← Previous
            </button>

            <span style={{ fontWeight: 600 }}>
              Page {paymentPage} of {paymentTotalPages}
            </span>

            <button
              className="primary-btn"
              style={{ width: "auto", flex: "0 0 auto" }}
              disabled={paymentPage === paymentTotalPages}
              onClick={() =>
                setPaymentPage((page) =>
                  Math.min(paymentTotalPages, page + 1)
                )
              }
            >
              Next →
            </button>
          </div>
        )}

      </div>

    </main>
  );
}