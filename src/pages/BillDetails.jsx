import { useState, useEffect } from "react";
import { billService } from "../services/billService";
import { getBills, saveBills, addActivity } from "../data/storage";
import { generateInvoice } from "../utils/invoiceGenerator";
const formatDateTime = (value) => {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return value;
  }
};
export default function BillDetails({ bill, customer, goBack }) {
  
  // Normalize both LocalStorage + Supabase fields
  const normalizeBill = (b) => ({
    ...b,
    id: b.id,
    billNo: b.billNo ?? b.bill_no,
    billDate: b.billDate ?? b.bill_date,
    customerId: b.customerId ?? b.customer_id,
    total: b.total ?? 0,
    discount: b.discount ?? 0,
    paid: b.paid ?? 0,
    due: b.due ?? 0,
    paymentMode: b.paymentMode ?? b.payment_mode ?? "Cash",
    status: b.status ?? (b.due === 0 ? "Paid" : "Pending"),
    createdBy:
      b.staff?.username ??
      b.createdBy ??
      b.created_by ??
      "Unknown",
    createdAt:
      b.createdAt ??
      (b.created_at
        ? new Date(b.created_at).toLocaleString("en-IN")
        : "-"),
    items: b.items ?? b.bill_items ?? [],
    payments: b.payments ?? [],
  });

  const [currentBill, setCurrentBill] = useState(normalizeBill(bill));
  const [amount, setAmount] = useState(currentBill.due);
  const [mode, setMode] = useState("Cash");

  const status =
    currentBill.due === 0
      ? "Paid"
      : currentBill.paid === 0
      ? "Unpaid"
      : "Partial";

  const collectPayment = async () => {
  const receive = Number(amount);

  if (receive <= 0) {
    alert("Enter valid amount.");
    return;
  }

  if (receive > currentBill.due) {
    alert("Amount cannot exceed due.");
    return;
  }

  const updatedPayments = [
    ...(currentBill.payments || []),
    {
      amount: receive,
      mode,
      date: new Date().toISOString().split("T")[0],
      time: new Date().toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      }),
    },
  ];

  const newPaid = currentBill.paid + receive;
  const newDue = currentBill.due - receive;
  const newStatus = newDue === 0 ? "Paid" : "Partial";

  try {
    await billService.update(currentBill.id, {
      paid: newPaid,
      due: newDue,
      status: newStatus,
      payment_mode: mode,
      payments: updatedPayments,
    });

    const updatedBill = {
      ...currentBill,
      paid: newPaid,
      due: newDue,
      status: newStatus,
      paymentMode: mode,
      payments: updatedPayments,
    };

    setCurrentBill(updatedBill);

    saveBills(
      getBills().map((b) =>
        (b.id || b.billNo) === currentBill.id ? updatedBill : b
      )
    );

    addActivity(
      customer?.name || "Customer",
      `Collected ₹${receive} for Bill #${currentBill.billNo}`
    );

    setAmount(newDue);
    alert("Payment updated successfully.");
  } catch (err) {
    alert(err.message);
  }
};

  return (
    <main className="content">
      <button className="back-btn" onClick={goBack}>
        ← Back
      </button>

      <div className="bill-card premium-bill">
        <div className="bill-top">
          <div>
            <h1>Bill #{currentBill.billNo}</h1>
            <p>{currentBill.billDate}</p>
          </div>

          <div
            style={{
              padding: "10px 18px",
              borderRadius: "999px",
              fontWeight: 700,
              color:
                status === "Paid"
                  ? "#0F766E"
                  : status === "Partial"
                  ? "#D97706"
                  : "#C0392B",
              background:
                status === "Paid"
                  ? "#DCFCE7"
                  : status === "Partial"
                  ? "#FEF3C7"
                  : "#FEE2E2",
            }}
          >
            {status}
          </div>
        </div>

        <div
  className="customer-info"
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: "28px",
    padding: "26px",
    background: "#F8F3E8",
    borderRadius: "22px",
    marginTop: "26px",
  }}
>
  <div>
    <span
      style={{
        display: "block",
        color: "#6B7280",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      Created By
    </span>

    <strong
      style={{
        color: "#7A0026",
        fontSize: 20,
      }}
    >
      {currentBill.createdBy || currentBill.staff?.username || "matam"}
    </strong>
  </div>

  <div>
    <span
      style={{
        display: "block",
        color: "#6B7280",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      Created At
    </span>

    <strong
      style={{
        color: "#7A0026",
        fontSize: 20,
        lineHeight: 1.3,
      }}
    >
      {formatDateTime(currentBill.createdAt || currentBill.created_at)}
    </strong>
  </div>

  <div>
    <span
      style={{
        display: "block",
        color: "#6B7280",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      Customer
    </span>

    <strong
      style={{
        color: "#7A0026",
        fontSize: 20,
      }}
    >
      {customer?.name || "Unknown"}
    </strong>
  </div>

  <div>
    <span
      style={{
        display: "block",
        color: "#6B7280",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      Customer ID
    </span>

    <strong
      style={{
        color: "#7A0026",
        fontSize: 20,
      }}
    >
      SR-{currentBill.customerId || currentBill.customer_id}
    </strong>
  </div>

  <div>
    <span
      style={{
        display: "block",
        color: "#6B7280",
        fontSize: 15,
        marginBottom: 6,
      }}
    >
      Phone
    </span>

    <strong
      style={{
        color: "#7A0026",
        fontSize: 20,
      }}
    >
      {customer?.phone || "-"}
    </strong>
  </div>
</div>

        <div className="bill-summary-grid">
  <div className="summary-card">
    <span>Subtotal</span>
    <h2>₹{currentBill.total + (currentBill.discount || 0)}</h2>
  </div>

  <div className="summary-card">
    <span>Discount</span>
    <h2 style={{ color: "#D97706" }}>
      -₹{currentBill.discount || 0}
    </h2>
  </div>

  <div className="summary-card">
    <span>Total</span>
    <h2>₹{currentBill.total}</h2>
  </div>

  <div className="summary-card">
    <span>Paid</span>
    <h2>₹{currentBill.paid}</h2>
  </div>

  <div className="summary-card due-card">
    <span>Pending</span>
    <h2>₹{currentBill.due}</h2>
  </div>
</div>

        <div className="table-card">
          <h2>Purchased Items</h2>

          <table className="customer-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {currentBill.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.itemName || item.category}</td>
                  <td>{item.qty}</td>
                  <td>₹{item.price}</td>
                  <td>₹{item.qty * item.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentBill.due > 0 && (
          <div className="customer-card">
            <h2>Collect Payment</h2>

            <div className="customer-form">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
              </select>

              <button className="save-btn" onClick={collectPayment}>
                Collect Payment
              </button>
            </div>
          </div>
        )}

        <div className="table-card">
          <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  }}
>
            <h2>Payment History</h2>

            <button
              className="save-btn"
              onClick={() =>
                generateInvoice(currentBill, customer)
              }
            >
              Download Invoice
            </button>
          </div>

          {currentBill.payments.length ? (
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {currentBill.payments.map((p, i) => (
                  <tr key={i}>
                    <td>{p.date}</td>
                    <td>{p.mode || "-"}</td>
                    <td
                      style={{
                        color: "#0F766E",
                        fontWeight: 700,
                      }}
                    >
                      ₹{p.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            bill.payments?.length ? (
  <table className="customer-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Mode</th>
        <th>Amount</th>
      </tr>
    </thead>

    <tbody>
      {bill.payments.map((p, i) => (
        <tr key={i}>
          <td>{p.date}</td>
          <td>{p.time}</td>
          <td>{p.mode}</td>
          <td>₹{p.amount}</td>
        </tr>
      ))}
    </tbody>
  </table>
) : (
  <p>No payment history yet.</p>
))}

        </div>
      </div>
    </main>
  );
}