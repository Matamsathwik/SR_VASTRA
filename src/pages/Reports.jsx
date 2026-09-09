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
  const [period, setPeriod] = useState("today");
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

  // ---------- Period Filter ----------

const getPeriodDateRange = () => {
  const now = new Date();

  if (period === "today") {
    return {
      start: today,
      end: today,
    };
  }

  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);

    return {
      start: getLocalDate(start),
      end: today,
    };
  }

  // This Month
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  return {
    start: getLocalDate(start),
    end: today,
  };
};

const { start: periodStart, end: periodEnd } =
  getPeriodDateRange();

const periodBills = bills.filter(
  (bill) =>
    bill.billDate >= periodStart &&
    bill.billDate <= periodEnd
);

const periodReturns = returns.filter(
  (ret) =>
    ret.returnDate >= periodStart &&
    ret.returnDate <= periodEnd
);

// ---------- Summary ----------

const grossSales = periodBills.reduce(
  (sum, bill) => sum + Number(bill.total || 0),
  0
);

const totalReturns = periodReturns.reduce(
  (sum, ret) => sum + Number(ret.amount || 0),
  0
);

const netSales = grossSales - totalReturns;

const totalCollected = periodBills.reduce(
  (sum, bill) => sum + Number(bill.paid || 0),
  0
);

const pendingDue = Math.max(
  0,
  netSales - totalCollected
);

const periodBillCount = periodBills.length;
const periodReturnCount = periodReturns.length;

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

  const gross = bills
    .filter((b) => b.billDate === date)
    .reduce(
      (sum, b) => sum + Number(b.total || 0),
      0
    );

  const returned = returns
    .filter((r) => r.returnDate === date)
    .reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

  const total = gross - returned;

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
    ...last7.map((d) => Math.abs(d.total)),
    1
  );

  // ---------- Top Selling Items ----------
const itemMap = {};

periodBills.forEach((bill) => {
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

  periodBills.forEach((bill) => {
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

periodBills.forEach((bill) => {
  (bill.payments || []).forEach((payment) => {
    const paymentDate = payment.date || bill.billDate;

    if (
      paymentDate < periodStart ||
      paymentDate > periodEnd
    ) {
      return;
    }

    const mode = payment.mode || "Cash";

    if (!paymentMap[mode]) {
      paymentMap[mode] = 0;
    }

    paymentMap[mode] += Number(payment.amount || 0);
  });
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


  return (
  <main className="content">
    <h1>Reports</h1>

    <div className="filter-bar">
      {["today", "week", "month"].map((p) => (
        <button
          key={p}
          className={`filter-chip ${period === p ? "active" : ""}`}
          onClick={() => setPeriod(p)}
        >
          {p === "today"
            ? "Today"
            : p === "week"
            ? "This Week"
            : "This Month"}
        </button>
      ))}
    </div>


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
            ₹{netSales}
          </h3>

          <p style={{ color: "#FDE68A" }}>
            {period === "today"
  ? "Today's Net Sales"
  : period === "week"
  ? "This Week's Net Sales"
  : "This Month's Net Sales"}
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
            {periodBillCount}
          </h3>

          <p style={{ color: "#FFF7CC" }}>
            {period === "today"
              ? "Today's Bills"
              : period === "week"
              ? "This Week's Bills"
              : "This Month's Bills"}
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
            {periodReturnCount}
          </h3>

          <p style={{ color: "#E9D5FF" }}>
            {period === "today"
  ? "Returns Today"
  : period === "week"
  ? "Returns This Week"
  : "Returns This Month"}
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
  viewBox="0 0 420 220"
  width="100%"
  height="220"
>
  {last7.map((d, i) => {
    const chartCenter = 105;
    const chartHeight = 120;
    const scale = chartHeight / maxSale;
    const barHeight = Math.abs(d.total) * scale;

    const x = 25 + i * 55;

    const y =
      d.total >= 0
        ? chartCenter - barHeight
        : chartCenter;

    return (
      <g key={d.date}>
        <rect
          x={x}
          y={y}
          width="32"
          height={barHeight}
          rx="6"
          fill="#A50034"
        />

        <text
          x={41 + i * 55}
          y="135"
          textAnchor="middle"
          fontSize="10"
        >
          {d.label}
        </text>

        <text
          x={41 + i * 55}
          y={
            d.total >= 0
              ? Math.max(12, y - 5)
              : y + barHeight + 14
          }
          textAnchor="middle"
          fontSize="9"
        >
          {d.total < 0 ? `−₹${Math.abs(d.total)}` : `₹${d.total}`}
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