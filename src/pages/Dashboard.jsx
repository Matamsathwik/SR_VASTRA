import { useMemo, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  getBills,
  getCustomers,
  getStock,
  saveStock,
  saveCustomers,
  saveBills,
} from "../data/storage";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import { stockService } from "../services/stockService";
import { activityService } from "../services/activityService";


export default function Dashboard() {
  const [period, setPeriod] = useState("today");

  const [bills, setBills] = useState(getBills());
  const [customers, setCustomers] = useState(getCustomers());
  const [stock, setStock] = useState(getStock());
  const [activity, setActivity] = useState([]);

  const today = new Date();

  const loadDashboard = async () => {
    try {
      const [billData, customerData, stockData, activityData] =
        await Promise.all([
          billService.getAll(),
          customerService.getAll(),
          stockService.getAll(),
          activityService.getAll(),
  ]);

      const formattedBills = billData;

      saveBills(formattedBills);
      saveCustomers(customerData);
      saveStock(stockData);

      setBills(formattedBills);
      setCustomers(customerData);
      setStock(stockData);
      setActivity(activityData);
    } catch (err) {
      console.error("Dashboard sync failed:", err);

      setBills(getBills());
      setCustomers(getCustomers());
      setStock(getStock());
    }
  };

  useEffect(() => {
  loadDashboard();

  const billsChannel = supabase
    .channel("dashboard-bills")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "bills",
      },
      loadDashboard
    )
    .subscribe();

  const stockChannel = supabase
    .channel("dashboard-stock")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "stock",
      },
      loadDashboard
    )
    .subscribe();

  const customerChannel = supabase
    .channel("dashboard-customers")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "customers",
      },
      loadDashboard
    )
    .subscribe();

  const activityChannel = supabase
    .channel("dashboard-activity")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "activity_logs",
      },
      loadDashboard
    )
    .subscribe();

  return () => {
    supabase.removeChannel(billsChannel);
    supabase.removeChannel(stockChannel);
    supabase.removeChannel(customerChannel);
    supabase.removeChannel(activityChannel);
  };
}, []);

  

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      const d = new Date(bill.billDate);

      if (period === "today") {
        return bill.billDate === today.toISOString().split("T")[0];
      }

      if (period === "week") {
        const diff = (today - d) / (1000 * 60 * 60 * 24);
        return diff <= 6 && diff >= 0;
      }

      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    });
  }, [period, bills]);

  const totalSales = filteredBills.reduce(
  (s, b) => s + Number(b.total || 0),
  0
);
  const totalBills = filteredBills.length;
  const pendingDue = filteredBills.reduce((s, b) => s + Number(b.due || 0),0);

  const paymentMap = { Cash: 0, UPI: 0, Card: 0 };

  filteredBills.forEach((b) => {
    paymentMap[b.paymentMode || "Cash"] += b.paid;
  });

  const categoryMap = {};

  filteredBills.forEach((bill) =>
    (bill.items || []).forEach((item) => {
      categoryMap[item.category] =
        (categoryMap[item.category] || 0) + item.qty;
    })
  );

  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lowStock = stock.filter((s) => (s.currentQty || 0) <= 3);

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));

    const date = d.toISOString().split("T")[0];

    const total = bills
      .filter((b) => b.billDate === date)
      .reduce((s, b) => s + b.total, 0);

    return {
      label: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      total,
    };
  });

  const maxSale = Math.max(...last7.map((d) => d.total), 1);

  return (
    <main className="content">
      <h1>Dashboard</h1>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 18,
          marginTop: 20,
        }}
      >
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg,#7A0026,#A50034)",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#fff" }}>₹{totalSales}</h3>
          <p>Total Sales</p>
        </div>

        <div
          className="card"
          style={{
            background: "linear-gradient(135deg,#A66B00,#D4AF37)",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#fff" }}>{totalBills}</h3>
          <p>Bills</p>
        </div>

        <div
          className="card"
          style={{
            background: "linear-gradient(135deg,#0F766E,#20B2AA)",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#fff" }}>{customers.length}</h3>
          <p>Customers</p>
        </div>

        <div
          className="card"
          style={{
            background: "linear-gradient(135deg,#C0392B,#E67E22)",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#fff" }}>₹{pendingDue}</h3>
          <p>Pending Due</p>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 22 }}>
        <h2>7-Day Sales Trend</h2>

        <svg viewBox="0 0 420 180" width="100%" height="220">
          {last7.map((d, i) => {
            const h = (d.total / maxSale) * 120;

            return (
              <g key={i}>
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
                  {d.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
          gap: 20,
          marginTop: 20,
        }}
      >
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
              {Object.entries(paymentMap).map(([mode, amount]) => (
                <tr key={mode}>
                  <td>{mode}</td>
                  <td>₹{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                  <tr key={s.stockId}>
                    <td>{s.itemName}</td>
                    <td style={{ color: "#C0392B", fontWeight: 700 }}>
                      {s.currentQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-card">
          <h2>Top Selling Categories</h2>

          <table className="customer-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Pieces</th>
              </tr>
            </thead>

            <tbody>
              {topCategories.length === 0 ? (
                <tr>
                  <td colSpan="2" style={{ textAlign: "center" }}>
                    No sales yet.
                  </td>
                </tr>
              ) : (
                topCategories.map(([name, qty]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-card">
  <h2>Recent Activity</h2>

  {activity.length === 0 ? (
    <p>No activity yet.</p>
  ) : (
    <table className="customer-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Action</th>
          <th>Time</th>
        </tr>
      </thead>

      <tbody>
        {activity
  .filter((a) => {
    const activityDate = new Date(a.created_at);
    const todayDate = new Date();

    return (
      activityDate.getFullYear() === todayDate.getFullYear() &&
      activityDate.getMonth() === todayDate.getMonth() &&
      activityDate.getDate() === todayDate.getDate()
    );
  })
  .slice(0, 6)
  .map((a) => (
            <tr key={a.id}>
              <td>{a.username}</td>

              <td>{a.action}</td>

              <td>
                {new Date(a.created_at).toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  )}
</div>
      </div>
    </main>
  );
}