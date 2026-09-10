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
import { returnService } from "../services/returnService";


export default function Dashboard({ user }) {
  const [period, setPeriod] = useState("today");

  const [bills, setBills] = useState(getBills());
  const [customers, setCustomers] = useState(getCustomers());
  const [stock, setStock] = useState(getStock());
  const [activity, setActivity] = useState([]);
  const [returns, setReturns] = useState([]);

  const today = new Date();

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayDate = formatLocalDate(today);
  const weekStartDate = formatLocalDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
  );
  const monthStartDate = formatLocalDate(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const loadDashboard = async () => {
    try {
      const [billData, customerData, stockData, activityData, returnData] =
        await Promise.all([
          billService.getAll(),
          customerService.getAll(),
          stockService.getAll(),
          activityService.getAll(),
          returnService.getAll(),
  ]);

      const formattedBills = billData;

      saveBills(formattedBills);
      saveCustomers(customerData);
      saveStock(stockData);

      setBills(formattedBills);
      setCustomers(customerData);
      setStock(stockData);
      setActivity(activityData);
      setReturns(returnData || []);
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

  const returnsChannel = supabase
    .channel("dashboard-returns")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "returns",
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
    supabase.removeChannel(returnsChannel);
  };
}, []);

  

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (period === "today") {
        return bill.billDate === todayDate;
      }

      if (period === "week") {
        return bill.billDate >= weekStartDate && bill.billDate <= todayDate;
      }

      return bill.billDate >= monthStartDate && bill.billDate <= todayDate;
    });
  }, [period, bills, todayDate, weekStartDate, monthStartDate]);

  const totalGrossSales = filteredBills.reduce(
    (s, b) => s + Number(b.total || 0),
    0
  );

  const filteredReturns = returns.filter((ret) => {
    if (period === "today") {
      return ret.returnDate === todayDate;
    }

    if (period === "week") {
      return ret.returnDate >= weekStartDate && ret.returnDate <= todayDate;
    }

    return ret.returnDate >= monthStartDate && ret.returnDate <= todayDate;
  });

  const totalReturns = filteredReturns.reduce(
    (s, r) => s + Number(r.amount || 0),
    0
  );

  const totalSales = Math.max(0, totalGrossSales - totalReturns);
  const totalBills = filteredBills.length;

  const totalCollected = filteredBills.reduce(
    (s, b) => s + Number(b.paid || 0),
    0
  );

  const pendingDue = Math.max(0, totalSales - totalCollected);

  const paymentMap = { Cash: 0, UPI: 0, Card: 0 };

  // Count actual payments made during the selected period.
  bills.forEach((bill) => {
    (bill.payments || []).forEach((payment) => {
      const paymentDate = payment.date || bill.billDate;
      let inPeriod = false;

      if (period === "today") {
        inPeriod = paymentDate === todayDate;
      } else if (period === "week") {
        inPeriod = paymentDate >= weekStartDate && paymentDate <= todayDate;
      } else {
        inPeriod = paymentDate >= monthStartDate && paymentDate <= todayDate;
      }

      if (!inPeriod) return;

      const mode = payment.mode || "Cash";
      if (paymentMap[mode] === undefined) paymentMap[mode] = 0;
      paymentMap[mode] += Number(payment.amount || 0);
    });
  });

  const itemMap = {};

filteredBills.forEach((bill) => {
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

  const lowStock = stock.filter((s) => (s.currentQty || 0) <= 3);

  const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
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
          <p>Net Sales</p>
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

        <svg
  viewBox="0 0 420 180"
  width="100%"
  height="220"
>
  {last7.map((d, i) => {
    const h = (d.total / maxSale) * 120;
    const barHeight = Math.abs(h);

    return (
      <g key={d.date}>
        <rect
          x={25 + i * 55}
          y={h >= 0 ? 145 - barHeight : 145}
          width="32"
          height={barHeight}
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
          y={
            h >= 0
              ? 140 - barHeight
              : 150 + barHeight
          }
          textAnchor="middle"
          fontSize="9"
        >
          {d.total < 0
            ? `-₹${Math.abs(d.total)}`
            : `₹${d.total}`}
        </text>
      </g>
    );
  })}
</svg>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
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
                  <tr key={s.id}>
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
{user?.role?.toLowerCase() === "owner" && (

        <div className="table-card">
  <h2>Recent Activity</h2>

  {activity.filter((a) => {
    const activityDate = new Date(a.created_at);
    const activityLocalDate = formatLocalDate(activityDate);

    if (period === "today") {
      return activityLocalDate === todayDate;
    }

    if (period === "week") {
      return (
        activityLocalDate >= weekStartDate &&
        activityLocalDate <= todayDate
      );
    }

    return (
      activityLocalDate >= monthStartDate &&
      activityLocalDate <= todayDate
    );
  }).length === 0 ? (
    <p>No activity for this period.</p>
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
            const activityLocalDate =
              formatLocalDate(activityDate);

            if (period === "today") {
              return activityLocalDate === todayDate;
            }

            if (period === "week") {
              return (
                activityLocalDate >= weekStartDate &&
                activityLocalDate <= todayDate
              );
            }

            return (
              activityLocalDate >= monthStartDate &&
              activityLocalDate <= todayDate
            );
          })
          .slice(0, 6)
          .map((a) => (
            <tr key={a.id}>
              <td>{a.username}</td>
              <td>{a.action}</td>
              <td>
                {new Date(a.created_at).toLocaleTimeString(
                  "en-IN",
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  }
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  )}
</div>
)}
      </div>
    </main>
  );
}