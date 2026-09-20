import logo from "/logo.png";
export default function InvoicePrint({ bill, customer }) {
  if (!bill) return null;

  return (
    <div
      id="invoice-print"
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "20px",
        maxWidth: "700px",
        margin: "0 auto",
        color: "#222",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          marginBottom: "15px",
        }}
      >
        <img
  src={logo}
  alt="SR Vastra"
  style={{
    width: "60px",
    height: "60px",
    objectFit: "contain",
  }}
/>
        

        <div>
          <h1 style={{ margin: 0, color: "#4A0012", fontSize: "28px" }}>
            SR Vastra
          </h1>

          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "12px" }}>
            Sarees That Speak Tradition
          </p>
        </div>
      </div>

      <hr style={{ border: "1px solid #d4af37", marginBottom: "15px" }} />

      {/* Bill Info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 20px",
          fontSize: "13px",
          marginBottom: "15px",
        }}
      >
        <div><strong>Bill No:</strong> {bill.billNo}</div>
        <div><strong>Date:</strong> {bill.billDate}</div>
        <div><strong>Customer:</strong> {customer || "-"}</div>
        <div><strong>Customer ID:</strong> {bill.customerId || "-"}</div>
      </div>

      {/* Items Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "18px",
          fontSize: "13px",
        }}
      >
        <thead>
          <tr style={{ background: "#4A0012", color: "#fff" }}>
            <th style={{ padding: "8px", border: "1px solid #ddd" }}>Item</th>
            <th style={{ padding: "8px", border: "1px solid #ddd" }}>Qty</th>
            <th style={{ padding: "8px", border: "1px solid #ddd" }}>Rate</th>
            <th style={{ padding: "8px", border: "1px solid #ddd" }}>Amt</th>
          </tr>
        </thead>

        <tbody>
          {bill.items.map((item, index) => (
            <tr key={index}>
              <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                {item.itemName || item.category || "-"}
                {item.stockNo ? ` (${item.stockNo.replace("ST-", "")})` : ""}
              </td>
              <td
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "center",
                }}
              >
                {item.qty}
              </td>
              <td
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "right",
                }}
              >
                {item.price}
              </td>
              <td
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  textAlign: "right",
                }}
              >
                {item.qty * item.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      

      {/* Summary */}
      {/* Summary */}
<div
  style={{
    borderTop: "2px solid #d4af37",
    borderBottom: "2px solid #d4af37",
    padding: "10px 0",
    marginBottom: "18px",
  }}
>
  {(bill.discount || 0) > 0 && (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <strong>Subtotal</strong>
        <strong>{bill.total + bill.discount}</strong>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#B8860B" }}>
        <strong>Discount</strong>
        <strong>-{bill.discount}</strong>
      </div>
    </>
  )}

  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
    <strong>Total</strong>
    <strong>{bill.total}</strong>
  </div>

  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
    <strong>Paid</strong>
    <strong>{bill.paid}</strong>
  </div>

  <div style={{ display: "flex", justifyContent: "space-between", color: "#B00020", fontWeight: "bold" }}>
    <span>Due</span>
    <span>{bill.due}</span>
  </div>
</div>

      {/* Footer */}
      <div
        style={{
          textAlign: "center",
          fontSize: "12px",
          color: "#555",
        }}
      >
        <strong>Cashier:</strong> SR Vastra
        <br />
        Thank You • Visit Again
      </div>
    </div>
  );
}