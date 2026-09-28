export default function StockDetails({ stock, goBack }) {
  if (!stock) {
    return null;
  }

  const getStatus = () => {
    const qty = Number(stock.currentQty || 0);

    if (qty === 0) return "Out of Stock";
    if (qty <= 3) return "Low Stock";
    return "In Stock";
  };

  const status = getStatus();

  return (
    <main className="content">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 15,
        }}
      >
        <div>
          <h1>Stock Details</h1>

          <p style={{ color: "#130d0d", marginTop: 5 }}>
            {stock.itemName || "Stock Item"}
          </p>
        </div>

        <button
          className="print-btn"
            onClick={goBack}
            style={{ backgroundColor: "#12c7b5" }}
            
        >
          ← Back to Stock
        </button>
      </div>

      <div className="customer-card">
        <h2>{stock.itemName}</h2>

        <div
          className="invoice-box"
          style={{ marginTop: 15 }}
        >
          <div className="invoice-row">
            <span>Stock No</span>
            <strong>{stock.stockNo || "-"}</strong>
          </div>

          <div className="invoice-row">
            <span>Barcode</span>
            <strong>{stock.barcode || "-"}</strong>
          </div>

          <div className="invoice-row">
            <span>Supplier</span>
            <strong>{stock.supplier || "-"}</strong>
          </div>

          <div className="invoice-row">
            <span>Category</span>
            <strong>{stock.category || "-"}</strong>
          </div>

          <div className="invoice-row">
            <span>HSN Code</span>
            <strong>{stock.hsnCode || "-"}</strong>
          </div>

          <div className="invoice-row">
            <span>GST Rate</span>
            <strong>
              {Number(stock.gstRate || 0)}%
            </strong>
          </div>

          <div className="invoice-row">
            <span>GST Type</span>
            <strong>
              {stock.gstInclusive
                ? "GST Inclusive"
                : "GST Exclusive"}
            </strong>
          </div>

          <div className="invoice-row">
            <span>MRP</span>
            <strong>
              ₹{Number(stock.mrp || 0).toFixed(2)}
            </strong>
          </div>

          <div className="invoice-row">
            <span>Purchase Price</span>
            <strong>
              ₹{Number(stock.purchasePrice || 0).toFixed(2)}
            </strong>
          </div>

          <div className="invoice-row">
            <span>Selling Price</span>
            <strong>
              ₹{Number(stock.sellingPrice || 0).toFixed(2)}
            </strong>
          </div>

          <div className="invoice-row">
            <span>Total Quantity</span>
            <strong>{stock.totalQty || 0}</strong>
          </div>

          <div className="invoice-row">
            <span>Available Quantity</span>
            <strong>{stock.currentQty || 0}</strong>
          </div>

          <div className="invoice-row">
            <span>Returned to Supplier</span>
            <strong>{stock.returnedQty || 0}</strong>
          </div>

          <div className="invoice-row">
            <span>Status</span>
            <strong
              style={{
                color:
                  status === "Out of Stock"
                    ? "#C0392B"
                    : status === "Low Stock"
                    ? "#D97706"
                    : "#0F766E",
              }}
            >
              {status}
            </strong>
          </div>

          <div className="invoice-row">
            <span>Purchase Date</span>
            <strong>
              {stock.purchaseDate || "-"}
            </strong>
          </div>
        </div>
      </div>
    </main>
  );
}