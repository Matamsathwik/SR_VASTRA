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
  const [customerPayments, setCustomerPayments] = useState([]);

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

      const { data: customerPaymentData, error: customerPaymentError } =
        await supabase.from("customer_payments").select("*");

      if (!customerPaymentError) {
        setCustomerPayments(customerPaymentData || []);
      }
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

  const returnsByBill = useMemo(() => {
    const map = new Map();

    returns.forEach((returnItem) => {
      const billId = Number(returnItem.billId);
      if (!billId) return;

      map.set(
        billId,
        (map.get(billId) || 0) + Number(returnItem.amount || 0)
      );
    });

    return map;
  }, [returns]);

  // Keep Dashboard accounting consistent with Reports:
  // outstanding = bill total - actual bill payment - returns against that bill.
  const getBillAccounting = (bill) => {
    const gross = Number(bill.total || 0);
    const paid = Number(bill.paid || 0);
    const returned = Number(returnsByBill.get(Number(bill.id)) || 0);

    const netAmount = Math.max(0, gross - returned);
    const balance = netAmount - paid;

    return {
      gross,
      paid,
      returned,
      netAmount,
      outstanding: Math.max(0, balance),
      credit: Math.max(0, -balance),
    };
  };

  const totalGrossSales = filteredBills.reduce(
    (sum, bill) => sum + Number(bill.total || 0),
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
    (sum, returnItem) => sum + Number(returnItem.amount || 0),
    0
  );

  const returnsAgainstPeriodSales = filteredBills.reduce(
    (sum, bill) =>
      sum + Number(returnsByBill.get(Number(bill.id)) || 0),
    0
  );

  const totalSales = Math.max(
    0,
    totalGrossSales - returnsAgainstPeriodSales
  );

  const isInPeriod = (date) => {
    if (period === "today") return date === todayDate;
    if (period === "week") return date >= weekStartDate && date <= todayDate;
    return date >= monthStartDate && date <= todayDate;
  };

  const cashRefundsPaid = filteredReturns
    .filter(
      (returnItem) =>
        String(
          returnItem.settlementType || returnItem.settlement_type || ""
        ).toUpperCase() === "REFUND"
    )
    .reduce((sum, returnItem) => sum + Number(returnItem.amount || 0), 0);

  const billPaymentsCollected = bills.reduce(
    (sum, bill) =>
      sum +
      (bill.payments || [])
        .filter((payment) => isInPeriod(payment.date || bill.billDate))
        .reduce(
          (paymentSum, payment) =>
            paymentSum + Number(payment.amount || 0),
          0
        ),
    0
  );

  const customerPaymentsCollected = customerPayments
    .filter((payment) => isInPeriod(payment.payment_date || payment.created_at))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const netCollected = Math.max(
    0,
    billPaymentsCollected + customerPaymentsCollected - cashRefundsPaid
  );
  const totalBills = filteredBills.length;

  // Pending Due is actual outstanding on the selected period's bills.
  // It is NOT Net Sales - Collected, because returns on paid bills create
  // customer credit rather than negative/incorrect outstanding.
  const pendingDue = filteredBills.reduce(
    (sum, bill) => sum + getBillAccounting(bill).outstanding,
    0
  );

  const paymentMap = { Cash: 0, UPI: 0, Card: 0, "Customer Credit": 0 };

  // Count actual payments made during the selected period.
  bills.forEach((bill) => {
    (bill.payments || []).forEach((payment) => {
      if (!isInPeriod(payment.date || bill.billDate)) return;

      const mode = payment.mode || "Cash";
      if (paymentMap[mode] === undefined) paymentMap[mode] = 0;
      paymentMap[mode] += Number(payment.amount || 0);
    });
  });

  customerPayments.forEach((payment) => {
    if (!isInPeriod(payment.payment_date || payment.created_at)) return;

    const mode = payment.payment_mode || payment.mode || "Cash";
    if (paymentMap[mode] === undefined) paymentMap[mode] = 0;
    paymentMap[mode] += Number(payment.amount || 0);
  });

  // Credit USED at checkout is a payment method.
  // Credit CREATED by a return is a customer liability, not a payment.
  filteredBills.forEach((bill) => {
    const creditUsed = Number(bill.creditUsed || bill.credit_used || 0);
    if (creditUsed > 0) {
      paymentMap["Customer Credit"] += creditUsed;
    }
  });

  const itemMap = {};

  filteredBills.forEach((bill) => {
    (bill.items || []).forEach((item) => {
      const stockNo = String(item.stockNo || "").replace(/\D/g, "");
      const key = `${item.itemName || "Unknown"} (${stockNo})`;

      itemMap[key] = (itemMap[key] || 0) + Number(item.qty || 0);
    });
  });

  const topItems = Object.entries(itemMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lowStock = stock.filter((item) => (item.currentQty || 0) <= 3);

  const getLocalDate = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));

    const date = getLocalDate(d);

    const gross = bills
      .filter((bill) => bill.billDate === date)
      .reduce((sum, bill) => sum + Number(bill.total || 0), 0);

    const returnedAgainstSales = bills
      .filter((bill) => bill.billDate === date)
      .reduce(
        (sum, bill) =>
          sum + Number(returnsByBill.get(Number(bill.id)) || 0),
        0
      );

    const total = Math.max(0, gross - returnedAgainstSales);

    return {
      date,
      label: d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      total,
    };
  });

  const maxSale = Math.max(...last7.map((day) => Math.abs(day.total)), 1);

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

        <div
          className="card"
          style={{
            background: "linear-gradient(135deg,#166534,#22c55e)",
            color: "#fff",
          }}
        >
          <h3 style={{ color: "#fff" }}>₹{netCollected.toLocaleString("en-IN")}</h3>
          <p>Net Collected</p>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 22 }}>
        <h2>7-Day Sales Trend</h2>

        <svg viewBox="0 0 420 180" width="100%" height="220">
          {last7.map((day, i) => {
            const h = (day.total / maxSale) * 120;
            const barHeight = Math.abs(h);

            return (
              <g key={day.date}>
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
                  {day.label}
                </text>

                <text
                  x={41 + i * 55}
                  y={h >= 0 ? 140 - barHeight : 150 + barHeight}
                  textAnchor="middle"
                  fontSize="9"
                >
                  {day.total < 0
                    ? `-₹${Math.abs(day.total)}`
                    : `₹${day.total}`}
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
          <h2>Payment & Credit Breakdown</h2>

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
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background:
                          mode === "Cash"
                            ? "#16a34a"
                            : mode === "UPI"
                            ? "#2563eb"
                            : mode === "Card"
                            ? "#f59e0b"
                            : "#8b5cf6",
                        marginRight: 8,
                      }}
                    />
                    {mode}
                  </td>
                  <td>₹{Number(amount || 0).toLocaleString("en-IN")}</td>
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
                {lowStock.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemName}</td>
                    <td style={{ color: "#C0392B", fontWeight: 700 }}>
                      {item.currentQty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="table-card">
          <h2>Top Selling Items</h2>
          <p style={{ marginTop: -8, color: "#64748b", fontSize: 12 }}>
            Net quantity after returns
          </p>

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
        )}
      </div>
    </main>
  );
}
