import { generateReturnInvoice } from "../utils/returnInvoiceGenerator";

export default function ReturnDetails({
  returnData,
  customer,
  goBack,
}) {
  const discount = Number(returnData.discount || 0);
  const subtotal = Number(returnData.originalTotal || returnData.amount + discount);

  const phone = (customer?.phone || "").replace(/\D/g, "");
  const number = phone.length === 10 ? `91${phone}` : phone;

  const message = `🛍️ *SR Vastra – Return Receipt*

Dear *${customer?.name || "Customer"}*,

Your return has been processed successfully.

🧾 *Return Receipt #${returnData.returnNo}*

• Original Bill: #${returnData.billNo}
• Date: ${returnData.returnDate}
• Customer ID: ${customer?.id || "-"}
• Reason: ${returnData.reason}
• Item Returned: ${returnData.items?.map(i => `${i.itemName || i.category} × ${i.returnQty || i.qty}`).join(", ")}

${discount > 0 ? `• Discount Applied: ${discount}\n` : ""}• Refund Adjusted: *${returnData.amount}*

Thank you for shopping with *SR Vastra*.

📍 Narayankhed, Telangana`;

  return (
    <main className="content">
      <button className="back-btn" onClick={goBack}>
        ← Back
      </button>

      <h1>Return #{returnData.returnNo}</h1>

      <div className="profile-card">
        <p><strong>Customer:</strong> {customer?.name}</p>
        <p><strong>Customer ID:</strong> {customer?.id || "-"}</p>
        <p><strong>Original Bill:</strong> #{returnData.billNo}</p>
        <p><strong>Date:</strong> {returnData.returnDate}</p>
        <p><strong>Reason:</strong> {returnData.reason}</p>
      </div>

      <div className="table-card">
        <div
  className="modal-actions"
  style={{ marginBottom: 20, }}
>
  <button
    className="save-btn"
    onClick={() => generateReturnInvoice(returnData, customer)}
  >
    Download PDF
  </button>

  <button
    className="save-btn"
    style={{ marginTop: "4px" }}
    onClick={() =>
      window.open(
        number
          ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank"
      )
    }
  >
    WhatsApp
  </button>
</div>

<h2>Returned Items</h2>

<table className="customer-table">
  <thead>
    <tr>
      <th>Item</th>
      <th>Qty</th>
      <th>Refund</th>
    </tr>
  </thead>

  <tbody>
    {returnData.items?.map((i, idx) => (
      <tr key={idx}>
        <td>
          {i.itemName || i.category || "Item"}
          {i.stockNo &&
            ` (${String(i.stockNo).replace(/\D/g, "")})`}
        </td>
        <td>{i.returnQty || i.qty}</td>
        <td>{(i.returnQty || i.qty) * i.price}</td>
      </tr>
    ))}
  </tbody>
</table>

        <div
          style={{
            borderTop: "2px solid #d4af37",
            borderBottom: "2px solid #d4af37",
            padding: "12px 0",
            marginTop: "18px",
          }}
        >
          {discount > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <strong>Original Bill Total</strong>
                <strong>{subtotal}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#B8860B" }}>
                <strong>Discount Applied</strong>
                <strong>-{discount}</strong>
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", color: "#4A0012", fontSize: 18 }}>
            <strong>Refund Adjusted</strong>
            <strong>{returnData.amount}</strong>
          </div>
        </div>
      </div>
    </main>
  );
}