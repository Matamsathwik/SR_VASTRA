import { useEffect, useState } from "react";

import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import { returnService } from "../services/returnService";
import { stockService } from "../services/stockService";

import {
  exportBillsExcel,
  exportCustomersExcel,
  exportStockExcel,
} from "../utils/exportExcel";

export default function Reports() {
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [returns, setReturns] = useState([]);
  const [stock, setStock] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);

      const [billData, customerData, returnData, stockData] =
        await Promise.all([
          billService.getAll(),
          customerService.getAll(),
          returnService.getAll(),
          stockService.getAll(),
        ]);

      setBills(billData || []);
      setCustomers(customerData || []);
      setReturns(returnData || []);
      setStock(stockData || []);
    } catch (err) {
      console.error("Reports loading error:", err);
      alert("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Local Date ----------
  const getLocalDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = getLocalDate();

  // ---------- Summary ----------
  const todayBills = bills.filter(
    (b) => b.billDate === today
  );

  const todaySales = todayBills.reduce(
    (sum, b) => sum + Number(b.total || 0),
    0
  );

  const pendingDue = bills.reduce(
    (sum, b) => sum + Number(b.due || 0),
    0
  );

  const stockValue = stock.reduce(
    (sum, item) =>
      sum +
      Number(item.currentQty || 0) *
        Number(item.purchasePrice || 0),
    0
  );

  const todayReturns = returns.filter(
    (r) => r.returnDate === today
  );

  // ---------- Last 7 Days ----------
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();

    d.setDate(d.getDate() - (6 - i));

    const date = getLocalDate(d);

    const total = bills
      .filter((b) => b.billDate === date)
      .reduce(
        (sum, b) => sum + Number(b.total || 0),
        0
      );

    return {
      date,
      label: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      total,
    };
  });

  const maxSale = Math.max(
    ...last7.map((d) => d.total),
    1
  );

  // ---------- Top Selling Items ----------
const itemMap = {};

bills.forEach((bill) => {
  (bill.items || []).forEach((item) => {
    const stockNo = String(item.stockNo || "").replace(/\D/g, "");
    const key = `${item.itemName || "Unknown"} (${stockNo})`;

    itemMap[key] =
      (itemMap[key] || 0) + Number(item.qty || 0);
  });
});

const topItems = Object.entries(itemMap)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

  // ---------- Top Customers ----------
  const customerMap = {};

  bills.forEach((bill) => {
    const customerId = bill.customerId;

    if (!customerId) return;

    customerMap[customerId] =
      (customerMap[customerId] || 0) +
      Number(bill.total || 0);
  });

  const topCustomers = Object.entries(customerMap)
    .map(([id, total]) => {
      const customer = customers.find(
        (c) => Number(c.id) === Number(id)
      );

      return {
        id,
        name:
          customer?.name ||
          `SR-${id}`,
        total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ---------- Low Stock ----------
  const lowStock = stock.filter(
    (s) => Number(s.currentQty || 0) <= 3
  );

  // ---------- Payment Breakdown ----------
  const paymentMap = {
    Cash: 0,
    UPI: 0,
    Card: 0,
  };

  bills.forEach((bill) => {
    const mode = bill.paymentMode || "Cash";

    if (!paymentMap[mode]) {
      paymentMap[mode] = 0;
    }

    paymentMap[mode] += Number(bill.paid || 0);
  });

  const paymentBreakdown = Object.entries(paymentMap);

  // ---------- Pending Bills ----------
  const pendingBills = bills
    .filter((b) => Number(b.due || 0) > 0)
    .sort((a, b) => {
      if (a.billDate !== b.billDate) {
        return b.billDate.localeCompare(a.billDate);
      }

      return Number(b.billNo) - Number(a.billNo);
    })
    .slice(0, 5);

  if (loading) {
    return (
      <main className="content">
        <h1>Reports</h1>

        <div className="table-card">
          <p>Loading reports...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="content">
      <h1>Reports</h1>

      {/* ================= SUMMARY ================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "18px",
          marginBottom: "24px",
        }}
      >
        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#7A0026,#A50034)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            ₹{todaySales}
          </h3>

          <p style={{ color: "#FDE68A" }}>
            Today's Sales
          </p>
        </div>

        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#A66B00,#D4AF37)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            {todayBills.length}
          </h3>

          <p style={{ color: "#FFF7CC" }}>
            Today's Bills
          </p>
        </div>

        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#C0392B,#E67E22)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            ₹{pendingDue}
          </h3>

          <p style={{ color: "#FFE5D0" }}>
            Pending Due
          </p>
        </div>

        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#0F766E,#20B2AA)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            ₹{stockValue}
          </h3>

          <p style={{ color: "#D1FAE5" }}>
            Stock Value
          </p>
        </div>

        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#9333EA,#7C3AED)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            {todayReturns.length}
          </h3>

          <p style={{ color: "#E9D5FF" }}>
            Returns Today
          </p>
        </div>

        <div
          className="card"
          style={{
            background:
              "linear-gradient(135deg,#2563EB,#1D4ED8)",
            color: "white",
          }}
        >
          <h3 style={{ color: "white" }}>
            {customers.length}
          </h3>

          <p style={{ color: "#DBEAFE" }}>
            Total Customers
          </p>
        </div>
      </div>

      {/* ================= 7 DAY SALES ================= */}

      <div className="table-card">
        <h2>7-Day Sales Trend</h2>

        <svg
          viewBox="0 0 420 180"
          width="100%"
          height="220"
        >
          {last7.map((d, i) => {
            const h =
              (d.total / maxSale) * 120;

            return (
              <g key={d.date}>
                <rect
                  x={25 + i * 55}
                  y={145 - h}
                  width="32"
                  height={h}
                  rx="6"
                  fill="#A50034"
                />

                <text
                  x={41 + i * 55}
                  y="168"
                  textAnchor="middle"
                  fontSize="10"
                >
                  {d.label}
                </text>

                <text
                  x={41 + i * 55}
                  y={140 - h}
                  textAnchor="middle"
                  fontSize="9"
                >
                  ₹{d.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ================= EXPORT ================= */}

      <div
        className="table-card"
        style={{ marginTop: 20 }}
      >
        <h2>Export Reports</h2>

        <div className="cards">
          <button
            className="save-btn"
            onClick={() =>
              exportBillsExcel(bills)
            }
          >
            Export Bills
          </button>

          <button
            className="save-btn"
            onClick={() =>
              exportCustomersExcel(customers)
            }
          >
            Export Customers
          </button>

          <button
            className="save-btn"
            onClick={() =>
              exportStockExcel(stock)
            }
          >
            Export Stock
          </button>
        </div>
      </div>

      {/* ================= REPORT TABLES ================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(320px,1fr))",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        {/* TOP CATEGORIES */}

        <div className="table-card">
          <h2>Top Selling Items</h2>

<table className="customer-table">
  <thead>
    <tr>
      <th>Item</th>
      <th>Pieces</th>
    </tr>
  </thead>

  <tbody>
    {topItems.length === 0 ? (
      <tr>
        <td colSpan="2" style={{ textAlign: "center" }}>
          No sales yet.
        </td>
      </tr>
    ) : (
      topItems.map(([name, qty]) => (
        <tr key={name}>
          <td>{name}</td>
          <td>{qty}</td>
        </tr>
      ))
    )}
  </tbody>
</table>
        </div>

        {/* LOW STOCK */}

        <div className="table-card">
          <h2>Low Stock Alert</h2>

          {lowStock.length === 0 ? (
            <p>No low stock items.</p>
          ) : (
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Left</th>
                </tr>
              </thead>

              <tbody>
                {lowStock.map((s) => (
                  <tr key={s.id}>
                    <td>{s.itemName}</td>

                    <td
                      style={{
                        color: "#C0392B",
                        fontWeight: 700,
                      }}
                    >
                      {s.currentQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* TOP CUSTOMERS */}

        <div className="table-card">
          <h2>Top Customers</h2>

          <table className="customer-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {topCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan="2"
                    style={{
                      textAlign: "center",
                    }}
                  >
                    No customers yet.
                  </td>
                </tr>
              ) : (
                topCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>₹{c.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAYMENT BREAKDOWN */}

        <div className="table-card">
          <h2>Payment Breakdown</h2>

          <table className="customer-table">
            <thead>
              <tr>
                <th>Mode</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {paymentBreakdown.map(
                ([mode, amount]) => (
                  <tr key={mode}>
                    <td>{mode}</td>
                    <td>₹{amount}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* PENDING BILLS */}

        <div className="table-card">
          <h2>Recent Pending Bills</h2>

          <table className="customer-table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Customer</th>
                <th>Due</th>
              </tr>
            </thead>

            <tbody>
              {pendingBills.length === 0 ? (
                <tr>
                  <td
                    colSpan="3"
                    style={{
                      textAlign: "center",
                    }}
                  >
                    No pending bills.
                  </td>
                </tr>
              ) : (
                pendingBills.map((b) => {
                  const customer =
                    customers.find(
                      (c) =>
                        Number(c.id) ===
                        Number(b.customerId)
                    );

                  return (
                    <tr
                      key={`${b.billDate}-${b.billNo}`}
                    >
                      <td>#{b.billNo}</td>

                      <td>
                        {customer?.name ||
                          `SR-${b.customerId}`}
                      </td>

                      <td
                        style={{
                          color: "#C0392B",
                          fontWeight: 700,
                        }}
                      >
                        ₹{b.due}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}