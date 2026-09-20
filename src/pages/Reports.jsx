import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  Download,
  Package,
  RefreshCcw,
  RefreshCw,
  Search,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import { returnService } from "../services/returnService";
import { stockService } from "../services/stockService";
import {
  exportBillsExcel,
  exportCustomersExcel,
  exportStockExcel,
} from "../utils/exportExcel";

const INR = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPaymentDate = (payment, fallbackDate = "") =>
  String(
    payment?.date ||
      payment?.payment_date ||
      payment?.paymentDate ||
      payment?.created_at ||
      fallbackDate ||
      ""
  ).slice(0, 10);

const getPaymentMode = (payment) => {
  const raw = String(
    payment?.mode ||
      payment?.payment_mode ||
      payment?.paymentMode ||
      "Cash"
  ).trim();

  if (raw.toLowerCase() === "upi") return "UPI";
  if (raw.toLowerCase() === "card") return "Card";
  if (raw.toLowerCase() === "cash") return "Cash";
  return raw || "Cash";
};

const parseBillPayments = (bill) => {
  if (!Array.isArray(bill?.payments)) return [];
  return bill.payments.filter(Boolean);
};

const startOfMonday = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
};

const getDateRange = (period, customStart, customEnd) => {
  const now = new Date();
  const today = getLocalDate(now);

  if (period === "today") {
    return { start: today, end: today };
  }

  if (period === "yesterday") {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    const value = getLocalDate(date);
    return { start: value, end: value };
  }

  if (period === "week") {
    return { start: getLocalDate(startOfMonday(now)), end: today };
  }

  if (period === "lastWeek") {
    const start = startOfMonday(now);
    start.setDate(start.getDate() - 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: getLocalDate(start), end: getLocalDate(end) };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: getLocalDate(start), end: today };
  }

  if (period === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: getLocalDate(start), end: getLocalDate(end) };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    return { start: getLocalDate(start), end: today };
  }

  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { start: getLocalDate(start), end: today };
  }

  if (period === "annual") {
    const financialYearStart =
      now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const start = new Date(financialYearStart, 3, 1);
    const financialYearEnd = new Date(financialYearStart + 1, 2, 31);
    const end = getLocalDate(financialYearEnd) > today
      ? today
      : getLocalDate(financialYearEnd);

    return { start: getLocalDate(start), end };
  }

  if (period === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }

  return { start: today, end: today };
};

const buildDateList = (start, end) => {
  const dates = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (current <= last) {
    dates.push(getLocalDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDate(date);
};

const formatShortDate = (dateString) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const formatLongDate = (dateString) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const aggregateChartData = (bills, returns, start, end) => {
  const dates = buildDateList(start, end);
  const dayCount = dates.length;

  let groups = [];

  if (dayCount <= 14) {
    groups = dates.map((date) => ({
      key: date,
      start: date,
      end: date,
      label: formatShortDate(date),
    }));
  } else if (dayCount <= 62) {
    let cursor = 0;
    while (cursor < dates.length) {
      const weekStart = dates[cursor];
      const weekEnd = dates[Math.min(cursor + 6, dates.length - 1)];
      groups.push({
        key: weekStart,
        start: weekStart,
        end: weekEnd,
        label: `${formatShortDate(weekStart)}–${formatShortDate(weekEnd)}`,
      });
      cursor += 7;
    }
  } else if (dayCount <= 400) {
    let cursor = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);

    while (cursor <= last) {
      const monthStart = getLocalDate(cursor);
      const monthEndDate = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0
      );
      const monthEnd = getLocalDate(monthEndDate);
      groups.push({
        key: monthStart,
        start: monthStart,
        end: monthEnd < end ? monthEnd : end,
        label: cursor.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        }),
      });
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        1
      );
    }
  } else {
    const startYear = Number(start.slice(0, 4));
    const endYear = Number(end.slice(0, 4));

    for (let year = startYear; year <= endYear; year += 1) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      groups.push({
        key: yearStart,
        start: yearStart < start ? start : yearStart,
        end: yearEnd > end ? end : yearEnd,
        label: String(year),
      });
    }
  }

  return groups.map((group) => {
    const sales = bills
      .filter(
        (bill) => bill.billDate >= group.start && bill.billDate <= group.end
      )
      .reduce((sum, bill) => sum + Number(bill.total || 0), 0);

    const returned = returns
      .filter(
        (ret) => ret.returnDate >= group.start && ret.returnDate <= group.end
      )
      .reduce((sum, ret) => sum + Number(ret.amount || 0), 0);

    return {
      ...group,
      sales,
      returns: returned,
    };
  });
};

export default function Reports() {
  const [period, setPeriod] = useState("today");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);

  const CUSTOMER_PAGE_SIZE = 5;

  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [returns, setReturns] = useState([]);
  const [stock, setStock] = useState([]);
  const [customerPayments, setCustomerPayments] = useState([]);
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

      let paymentRows = [];

      try {
        const { data, error } = await supabase
          .from("customer_payments")
          .select("*")
          .order("payment_date", { ascending: false })
          .order("id", { ascending: false });

        if (error) {
          console.warn("Customer payments could not be loaded:", error);
        } else {
          paymentRows = data || [];
        }
      } catch (paymentError) {
        console.warn("Customer payments could not be loaded:", paymentError);
      }

      setBills(billData || []);
      setCustomers(customerData || []);
      setReturns(returnData || []);
      setStock(stockData || []);
      setCustomerPayments(paymentRows);
    } catch (error) {
      console.error("Reports loading error:", error);
      alert(error?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const { start: periodStart, end: periodEnd } = useMemo(
    () => getDateRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const periodBills = useMemo(
    () =>
      bills.filter(
        (bill) => bill.billDate >= periodStart && bill.billDate <= periodEnd
      ),
    [bills, periodStart, periodEnd]
  );

  const periodReturns = useMemo(
    () =>
      returns.filter(
        (ret) =>
          ret.returnDate >= periodStart && ret.returnDate <= periodEnd
      ),
    [returns, periodStart, periodEnd]
  );

  // ------------------------------------------------------------
  // ACCOUNTING: Bill-level balance calculation
  //
  // Never calculate outstanding as Net Sales - Collected.
  // A fully paid bill can later have a return, which creates customer
  // credit instead of negative outstanding.
  //
  // Source of truth:
  //   Bill Total - Actual Bill Payments - Returns against that bill
  // ------------------------------------------------------------
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

  const customerReportData = useMemo(
    () =>
      customers.map((customer) => {
        const customerBills = bills.filter(
          (bill) => Number(bill.customerId) === Number(customer.id)
        );

        const accounting = customerBills.reduce(
          (result, bill) => {
            const billAccounting = getBillAccounting(bill);

            result.purchases += billAccounting.gross;
            result.paid += billAccounting.paid;
            result.returned += billAccounting.returned;
            result.outstanding += billAccounting.outstanding;
            result.credit += billAccounting.credit;

            return result;
          },
          {
            purchases: 0,
            paid: 0,
            returned: 0,
            outstanding: 0,
            credit: 0,
          }
        );

        const previousDue = Number(customer.previous_due || 0);

        // Previous due is an opening balance. Customer credit from a
        // fully-paid returned bill can offset that balance.
        const totalBeforeCredit =
          previousDue + accounting.outstanding;

        const creditUsed = Math.min(
          accounting.credit,
          totalBeforeCredit
        );

        const pending = Math.max(
          0,
          totalBeforeCredit - creditUsed
        );

        const remainingCredit = Math.max(
          0,
          accounting.credit - creditUsed
        );

        return {
          ...customer,
          currentDue: accounting.outstanding,
          previousDue,
          pending,
          purchases: accounting.purchases,
          paid: accounting.paid,
          returned: accounting.returned,
          credit: remainingCredit,
        };
      }),
    [customers, bills, returnsByBill]
  );

  // Outstanding for the selected report period is calculated bill-by-bill.
  // Returns linked to those bills are included even if the return happened
  // later, because the balance of the original bill must remain correct.
  const periodAccounting = useMemo(
    () =>
      periodBills.reduce(
        (result, bill) => {
          const billAccounting = getBillAccounting(bill);

          result.outstanding += billAccounting.outstanding;
          result.credit += billAccounting.credit;

          return result;
        },
        { outstanding: 0, credit: 0 }
      ),
    [periodBills, returnsByBill]
  );

  const periodOutstanding = periodAccounting.outstanding;
  const periodCustomerCredit = periodAccounting.credit;

  const grossSales = useMemo(
    () => periodBills.reduce((sum, bill) => sum + Number(bill.total || 0), 0),
    [periodBills]
  );

  const totalReturns = useMemo(
    () =>
      periodReturns.reduce((sum, returnItem) => sum + Number(returnItem.amount || 0), 0),
    [periodReturns]
  );

  const netSales = grossSales - totalReturns;

  const billPaymentsCollected = useMemo(
    () =>
      periodBills.reduce((sum, bill) => {
        const payments = parseBillPayments(bill);

        return (
          sum +
          payments
            .filter((payment) => {
              const paymentDate = getPaymentDate(payment, bill.billDate);
              return paymentDate >= periodStart && paymentDate <= periodEnd;
            })
            .reduce(
              (paymentSum, payment) =>
                paymentSum + Number(payment.amount || 0),
              0
            )
        );
      }, 0),
    [periodBills, periodStart, periodEnd]
  );

  const customerPaymentsCollected = useMemo(
    () =>
      customerPayments
        .filter((payment) => {
          const paymentDate = getPaymentDate(payment);
          return paymentDate >= periodStart && paymentDate <= periodEnd;
        })
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [customerPayments, periodStart, periodEnd]
  );

  const totalCollected = billPaymentsCollected + customerPaymentsCollected;

  const stockValue = useMemo(
    () =>
      stock.reduce(
        (sum, item) =>
          sum +
          Number(item.currentQty || 0) * Number(item.purchasePrice || 0),
        0
      ),
    [stock]
  );

  const periodBillCount = periodBills.length;
  const uniquePeriodCustomers = new Set(
    periodBills.map((bill) => bill.customerId).filter(Boolean)
  ).size;

  const reportChartData = useMemo(
    () => aggregateChartData(bills, returns, periodStart, periodEnd),
    [bills, returns, periodStart, periodEnd]
  );

  const maxSale = Math.max(
    ...reportChartData.map((item) => item.sales),
    1
  );

  const maxReturn = Math.max(
    ...reportChartData.map((item) => item.returns),
    1
  );

  const topItems = useMemo(() => {
    const itemMap = {};

    periodBills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        const stockNo = String(item.stockNo || "");
        const key = `${item.itemName || "Unknown"}${stockNo ? ` (${stockNo})` : ""}`;
        itemMap[key] = (itemMap[key] || 0) + Number(item.qty || 0);
      });
    });

    return Object.entries(itemMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [periodBills]);

  const topCustomers = useMemo(() => {
    const customerMap = {};

    periodBills.forEach((bill) => {
      if (!bill.customerId) return;
      customerMap[bill.customerId] =
        (customerMap[bill.customerId] || 0) + Number(bill.total || 0);
    });

    return Object.entries(customerMap)
      .map(([id, total]) => {
        const customer = customers.find(
          (item) => Number(item.id) === Number(id)
        );

        return {
          id,
          name: customer?.name || `SR-${id}`,
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [periodBills, customers]);

  const lowStock = useMemo(
    () =>
      stock.filter((item) => {
        const currentQty = Number(item.currentQty || 0);
        const reorderLevel = Number(
          item.reorderLevel ?? item.reorder_level ?? 3
        );
        return currentQty <= reorderLevel;
      }),
    [stock]
  );

  const stockStatus = useMemo(() => {
    const inStock = stock.filter((item) => {
      const qty = Number(item.currentQty || 0);
      const reorderLevel = Number(
        item.reorderLevel ?? item.reorder_level ?? 3
      );
      return qty > reorderLevel;
    }).length;

    const low = stock.filter((item) => {
      const qty = Number(item.currentQty || 0);
      const reorderLevel = Number(
        item.reorderLevel ?? item.reorder_level ?? 3
      );
      return qty > 0 && qty <= reorderLevel;
    }).length;

    const out = stock.filter(
      (item) => Number(item.currentQty || 0) <= 0
    ).length;

    return { inStock, low, out, total: stock.length || 1 };
  }, [stock]);

  const paymentMap = useMemo(() => {
    const map = { Cash: 0, UPI: 0, Card: 0 };

    customerPayments
      .filter((payment) => {
        const paymentDate = getPaymentDate(payment);
        return paymentDate >= periodStart && paymentDate <= periodEnd;
      })
      .forEach((payment) => {
        const mode = getPaymentMode(payment);
        map[mode] = (map[mode] || 0) + Number(payment.amount || 0);
      });

    periodBills.forEach((bill) => {
      parseBillPayments(bill).forEach((payment) => {
        const paymentDate = getPaymentDate(payment, bill.billDate);
        if (paymentDate < periodStart || paymentDate > periodEnd) return;

        const mode = getPaymentMode(payment);
        map[mode] = (map[mode] || 0) + Number(payment.amount || 0);
      });
    });

    return map;
  }, [customerPayments, periodBills, periodStart, periodEnd]);

  const paymentBreakdown = Object.entries(paymentMap);
  const paymentTotal = paymentBreakdown.reduce(
    (sum, [, amount]) => sum + Number(amount || 0),
    0
  );

  const cashDeg = paymentTotal ? (paymentMap.Cash / paymentTotal) * 360 : 0;
  const upiDeg = paymentTotal ? (paymentMap.UPI / paymentTotal) * 360 : 0;
  const cardDeg = paymentTotal ? (paymentMap.Card / paymentTotal) * 360 : 0;

  const paymentGradient = paymentTotal
    ? `conic-gradient(#16a34a 0deg ${cashDeg}deg, #2563eb ${cashDeg}deg ${cashDeg + upiDeg}deg, #f59e0b ${cashDeg + upiDeg}deg ${cashDeg + upiDeg + cardDeg}deg)`
    : "#e2e8f0";

  const pendingBills = useMemo(
    () =>
      periodBills
        .map((bill) => ({
          ...bill,
          accounting: getBillAccounting(bill),
        }))
        .filter((bill) => bill.accounting.outstanding > 0)
        .sort((a, b) => {
          if (a.billDate !== b.billDate) {
            return String(b.billDate).localeCompare(String(a.billDate));
          }
          return Number(b.billNo || 0) - Number(a.billNo || 0);
        })
        .slice(0, 5),
    [periodBills, returnsByBill]
  );

  const filteredCustomerReport = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();

    return customerReportData
      .filter((customer) =>
        !search ||
        String(customer.name || "").toLowerCase().includes(search) ||
        String(customer.phone || "").toLowerCase().includes(search)
      )
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  }, [customerReportData, customerSearch]);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch]);

  const customerTotalPages = Math.max(
    1,
    Math.ceil(filteredCustomerReport.length / CUSTOMER_PAGE_SIZE)
  );

  const safeCustomerPage = Math.min(customerPage, customerTotalPages);

  const paginatedCustomerReport = filteredCustomerReport.slice(
    (safeCustomerPage - 1) * CUSTOMER_PAGE_SIZE,
    safeCustomerPage * CUSTOMER_PAGE_SIZE
  );

  const periodLabel = {
    today: "Today",
    yesterday: "Yesterday",
    week: "This Week",
    lastWeek: "Last Week",
    month: "This Month",
    lastMonth: "Last Month",
    quarter: "This Quarter",
    year: "This Year",
    annual: "Annual Report",
    custom: "Custom Date",
  }[period];

  const handlePeriodSelect = (value) => {
    if (value === "custom") {
      setShowCustomDate(true);
      setShowPeriodMenu(false);
      return;
    }

    setPeriod(value);
    setShowCustomDate(false);
    setShowPeriodMenu(false);
  };

  const applyCustomDate = () => {
    if (!customStart || !customEnd) {
      alert("Please select both From and To dates.");
      return;
    }

    if (customStart > customEnd) {
      alert("From date cannot be after To date.");
      return;
    }

    setPeriod("custom");
    setShowCustomDate(false);
  };

  const cards = [
    {
      title: "Gross Sales",
      value: grossSales,
      icon: CircleDollarSign,
      tone: "#2563eb",
    },
    {
      title: "Net Sales",
      value: netSales,
      icon: ShoppingBag,
      tone: "#7c3aed",
    },
    {
      title: "Returns",
      value: totalReturns,
      icon: RefreshCcw,
      tone: "#ea580c",
    },
    {
      title: "Collected",
      value: totalCollected,
      icon: WalletCards,
      tone: "#16a34a",
    },
    {
      title: "Unpaid / Outstanding",
      value: periodOutstanding,
      icon: AlertTriangle,
      tone: "#dc2626",
    },
    {
      title: "Stock Value",
      value: stockValue,
      icon: Package,
      tone: "#0891b2",
    },
    {
      title: "Bills",
      value: periodBillCount,
      icon: BarChart3,
      money: false,
      tone: "#475569",
    },
    {
      title: "Customers",
      value: uniquePeriodCustomers,
      icon: Users,
      money: false,
      tone: "#9333ea",
    },
  ];

  if (loading) {
    return (
      <main className="content" style={{ paddingBottom: "40px" }}>
        <div
          style={{
            minHeight: "420px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          Loading reports...
        </div>
      </main>
    );
  }

  return (
    <main className="content" style={{ paddingBottom: "50px" }}>
      <style>{`
        .sr-reports-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .sr-reports-chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .sr-reports-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .sr-report-card:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(15,23,42,.07); }
        @media (max-width: 1100px) {
          .sr-reports-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .sr-reports-grid-4, .sr-reports-chart-grid, .sr-reports-detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "15px",
          marginBottom: "22px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Reports
          </h1>
          <p style={{ margin: "5px 0 0", color: "#64748b" }}>
            Business performance, sales, returns, payments and customer insights
          </p>
        </div>

        <button
          type="button"
          onClick={loadReports}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#334155",
            borderRadius: "10px",
            padding: "10px 15px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      {/* Report Period */}
      <section
        style={{
          position: "relative",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "16px 18px",
          marginBottom: "20px",
          boxShadow: "0 4px 16px rgba(15,23,42,.035)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#64748b",
                letterSpacing: "0.8px",
                marginBottom: "9px",
              }}
            >
              REPORT PERIOD
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {[
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["week", "This Week"],
              ].map(([value, label]) => {
                const active = period === value;

                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => handlePeriodSelect(value)}
                    style={{
                      height: "38px",
                      padding: "0 14px",
                      borderRadius: "9px",
                      border: active
                        ? "1px solid #0f172a"
                        : "1px solid #e2e8f0",
                      background: active ? "#0f172a" : "#fff",
                      color: active ? "#fff" : "#334155",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: "13px",
                    }}
                  >
                    {label}
                  </button>
                );
              })}

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowPeriodMenu((value) => !value)}
                  style={{
                    height: "38px",
                    padding: "0 12px",
                    border: "1px solid #e2e8f0",
                    background: showPeriodMenu ? "#f8fafc" : "#fff",
                    borderRadius: "9px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    color: "#334155",
                    fontWeight: 800,
                    fontSize: "13px",
                  }}
                >
                  More
                  <ChevronDown
                    size={16}
                    style={{
                      transform: showPeriodMenu ? "rotate(180deg)" : "none",
                      transition: "transform .2s",
                    }}
                  />
                </button>

                {showPeriodMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      zIndex: 50,
                      width: "220px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "7px",
                      boxShadow: "0 18px 40px rgba(15,23,42,.16)",
                    }}
                  >
                    {[
                      ["lastWeek", "Last Week"],
                      ["month", "This Month"],
                      ["lastMonth", "Last Month"],
                      ["quarter", "This Quarter"],
                      ["year", "This Year"],
                      ["annual", "Annual Report"],
                      ["custom", "Custom Date"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => handlePeriodSelect(value)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: 0,
                          background: period === value ? "#f1f5f9" : "transparent",
                          color: "#334155",
                          padding: "9px 11px",
                          borderRadius: "7px",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "13px",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              textAlign: "right",
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.5,
              minWidth: "190px",
            }}
          >
            <strong style={{ color: "#334155" }}>{periodLabel}</strong>
            <br />
            {formatLongDate(periodStart)} – {formatLongDate(periodEnd)}
          </div>
        </div>

        {showCustomDate && (
          <div
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "end",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569" }}>
                From
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                style={{
                  display: "block",
                  marginTop: "5px",
                  padding: "9px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 800, color: "#475569" }}>
                To
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                style={{
                  display: "block",
                  marginTop: "5px",
                  padding: "9px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              />
            </div>

            <button
              type="button"
              onClick={applyCustomDate}
              style={{
                height: "38px",
                padding: "0 16px",
                border: 0,
                borderRadius: "8px",
                background: "#0f172a",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        )}
      </section>

      {/* KPI Cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
        className="sr-reports-grid-4"
      >
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                padding: "18px",
                boxShadow: "0 4px 15px rgba(15,23,42,.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  {card.title}
                </span>
                <Icon size={20} color={card.tone} />
              </div>

              <div
                style={{
                  marginTop: "12px",
                  fontSize: "24px",
                  fontWeight: 850,
                  color: "#0f172a",
                }}
              >
                {card.money === false ? card.value : INR(card.value)}
              </div>
            </div>
          );
        })}
      </section>

      {/* Sales + Returns */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "18px",
          marginBottom: "20px",
        }}
        className="sr-reports-chart-grid"
      >
        {[
          {
            title: "Gross Sales Overview",
            key: "sales",
            data: reportChartData,
            max: maxSale,
            color: "#2563eb",
          },
          {
            title: "Returns Overview",
            key: "returns",
            data: reportChartData,
            max: maxReturn,
            color: "#f97316",
          },
        ].map((chart) => (
          <div
            key={chart.title}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              padding: "20px",
              boxShadow: "0 4px 16px rgba(15,23,42,.035)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                  {chart.title}
                </h2>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {periodLabel}
                </span>
              </div>
            </div>

            <div
              style={{
                height: "260px",
                display: "flex",
                alignItems: "stretch",
                gap: chart.data.length > 20 ? "4px" : "10px",
                padding: "16px 8px 4px",
                borderBottom: "1px solid #e2e8f0",
                overflowX: "auto",
                borderRadius: "10px",
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #ffffff 0, #ffffff 49px, #f1f5f9 50px)",
              }}
            >
              {chart.data.map((item) => {
                const value = Number(item[chart.key] || 0);
                const height = value > 0
                  ? Math.max(8, (value / chart.max) * 185)
                  : 3;

                return (
                  <div
                    key={`${chart.title}-${item.key}`}
                    style={{
                      minWidth: chart.data.length > 20 ? "30px" : "42px",
                      flex: chart.data.length > 20 ? "0 0 30px" : 1,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "end",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    title={`${item.label}: ${INR(value)}`}
                  >
                    <span
                      style={{
                        fontSize: chart.data.length > 20 ? "8px" : "10px",
                        fontWeight: 800,
                        color: "#334155",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value ? INR(value) : "—"}
                    </span>
                    <div
                      style={{
                        width: chart.data.length > 20 ? "70%" : "70%",
                        maxWidth: "42px",
                        minHeight: `${height}px`,
                        height: `${height}px`,
                        background: chart.color,
                        borderRadius: "7px 7px 2px 2px",
                      }}
                    />
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Payments + Stock */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "18px",
          marginBottom: "20px",
        }}
        className="sr-reports-chart-grid"
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>Payment Breakdown</h2>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "5px 0 0" }}>
            Sales payments + customer due collections
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "28px",
              flexWrap: "wrap",
              padding: "22px 0 10px",
            }}
          >
            <div
              style={{
                width: "155px",
                height: "155px",
                borderRadius: "50%",
                background: paymentGradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "92px",
                  height: "92px",
                  borderRadius: "50%",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: "13px",
                  color: "#0f172a",
                }}
              >
                {INR(paymentTotal)}
              </div>
            </div>

            <div style={{ minWidth: "160px", lineHeight: 2.1 }}>
              <div>🟢 Cash — {INR(paymentMap.Cash)}</div>
              <div>🔵 UPI — {INR(paymentMap.UPI)}</div>
              <div>🟠 Card — {INR(paymentMap.Card)}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>Stock Status</h2>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "5px 0 0" }}>
            Based on each item's reorder level
          </p>

          <div style={{ paddingTop: "18px" }}>
            {[
              ["In Stock", stockStatus.inStock, "#16a34a"],
              ["Low Stock", stockStatus.low, "#f59e0b"],
              ["Out of Stock", stockStatus.out, "#dc2626"],
            ].map(([label, count, color]) => (
              <div key={label} style={{ marginBottom: "18px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "7px",
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  <span>{label}</span>
                  <span>{count}</span>
                </div>

                <div
                  style={{
                    height: "9px",
                    background: "#f1f5f9",
                    borderRadius: "20px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(count / stockStatus.total) * 100}%`,
                      height: "100%",
                      background: color,
                      borderRadius: "20px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Details */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "18px",
          marginBottom: "20px",
        }}
        className="sr-reports-detail-grid"
      >
        <div className="table-card">
          <h2>Top Selling Items</h2>
          {topItems.length === 0 ? (
            <p style={{ color: "#64748b" }}>No sales for this period.</p>
          ) : (
            topItems.map(([name, qty], index) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div style={{ display: "flex", gap: "12px", minWidth: 0 }}>
                  <strong>{index + 1}</strong>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                </div>
                <strong style={{ whiteSpace: "nowrap" }}>{qty} pcs</strong>
              </div>
            ))
          )}
        </div>

        <div className="table-card">
          <h2>Top Customers</h2>
          {topCustomers.length === 0 ? (
            <p style={{ color: "#64748b" }}>No customer sales for this period.</p>
          ) : (
            topCustomers.map((customer, index) => (
              <div
                key={customer.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span>
                  <strong>{index + 1}. </strong>
                  {customer.name}
                </span>
                <strong style={{ whiteSpace: "nowrap" }}>
                  {INR(customer.total)}
                </strong>
              </div>
            ))
          )}
        </div>

        <div className="table-card">
          <h2>Low Stock Alerts</h2>
          {lowStock.length === 0 ? (
            <p style={{ color: "#16a34a" }}>✓ All stock levels are healthy.</p>
          ) : (
            lowStock.slice(0, 8).map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span>{item.itemName}</span>
                <strong style={{ color: Number(item.currentQty || 0) <= 0 ? "#dc2626" : "#f59e0b", whiteSpace: "nowrap" }}>
                  {item.currentQty} left
                </strong>
              </div>
            ))
          )}
        </div>

        <div className="table-card">
          <h2>Pending Bills</h2>
          {pendingBills.length === 0 ? (
            <p style={{ color: "#16a34a" }}>✓ No pending bills in this period.</p>
          ) : (
            pendingBills.map((bill) => {
              const customer = customers.find(
                (item) => Number(item.id) === Number(bill.customerId)
              );

              return (
                <div
                  key={`${bill.billDate}-${bill.billNo}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 0",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <div>
                    <strong>#{bill.billNo}</strong>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        marginTop: "3px",
                      }}
                    >
                      {customer?.name || `SR-${bill.customerId || ""}`}
                    </div>
                  </div>

                  <strong style={{ color: "#dc2626", whiteSpace: "nowrap" }}>
                    {INR(bill.due)}
                  </strong>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Customer Report */}
      <section
        className="table-card"
        style={{
          marginBottom: "20px",
          padding: "22px",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          background: "#fff",
          boxShadow: "0 4px 16px rgba(15,23,42,.035)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Customer Report</h2>
            <p
              style={{
                margin: "5px 0 0",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              Purchases, returns, paid amount and total outstanding by customer
            </p>
            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                fontWeight: 800,
                color: "#475569",
              }}
            >
              {filteredCustomerReport.length} customer{filteredCustomerReport.length === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                placeholder="Search name or phone"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                style={{
                  width: "280px",
                  maxWidth: "100%",
                  padding: "10px 12px 10px 34px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "9px",
                  outline: "none",
                }}
              />
            </div>

          </div>
        </div>

        <div
          style={{
            marginTop: "20px",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              minWidth: "760px",
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1.5fr) repeat(4, 1fr)",
              gap: "12px",
              padding: "12px 16px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            <span>Customer</span>
            <span>Purchases</span>
            <span>Returns</span>
            <span>Paid</span>
            <span>Outstanding</span>
          </div>

          {filteredCustomerReport.length === 0 ? (
            <p style={{ color: "#64748b", padding: "15px 0" }}>
              No customers found.
            </p>
          ) : (
            paginatedCustomerReport.map((customer) => (
              <div
                key={customer.id}
                style={{
                  minWidth: "760px",
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1.5fr) repeat(4, 1fr)",
                  gap: "12px",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <strong>{customer.name}</strong>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      marginTop: "3px",
                    }}
                  >
                    {customer.phone || "No phone"}
                  </div>
                </div>

                <strong>{INR(customer.purchases)}</strong>
                <strong>{INR(customer.returned)}</strong>
                <strong>{INR(customer.paid)}</strong>
                <strong style={{ color: "#dc2626" }}>
                  {INR(customer.pending)}
                </strong>
              </div>
            ))
          )}
        </div>

        {filteredCustomerReport.length > CUSTOMER_PAGE_SIZE && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px solid #e2e8f0",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "#64748b",
                fontWeight: 600,
              }}
            >
              Showing {((safeCustomerPage - 1) * CUSTOMER_PAGE_SIZE) + 1}
              -{Math.min(safeCustomerPage * CUSTOMER_PAGE_SIZE, filteredCustomerReport.length)}
              of {filteredCustomerReport.length} customers
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <button
                type="button"
                disabled={safeCustomerPage === 1}
                onClick={() => setCustomerPage((page) => Math.max(1, page - 1))}
                style={{
                  border: "1px solid #cbd5e1",
                  background: safeCustomerPage === 1 ? "#f8fafc" : "#fff",
                  color: safeCustomerPage === 1 ? "#94a3b8" : "#334155",
                  borderRadius: "8px",
                  padding: "7px 11px",
                  cursor: safeCustomerPage === 1 ? "not-allowed" : "pointer",
                  fontWeight: 700,
                }}
              >
                Previous
              </button>

              <span
                style={{
                  minWidth: "72px",
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#334155",
                }}
              >
                Page {safeCustomerPage} of {customerTotalPages}
              </span>

              <button
                type="button"
                disabled={safeCustomerPage === customerTotalPages}
                onClick={() =>
                  setCustomerPage((page) =>
                    Math.min(customerTotalPages, page + 1)
                  )
                }
                style={{
                  border: "1px solid #cbd5e1",
                  background:
                    safeCustomerPage === customerTotalPages
                      ? "#f8fafc"
                      : "#fff",
                  color:
                    safeCustomerPage === customerTotalPages
                      ? "#94a3b8"
                      : "#334155",
                  borderRadius: "8px",
                  padding: "7px 11px",
                  cursor:
                    safeCustomerPage === customerTotalPages
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 700,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Export */}
      <section className="table-card" style={{ padding: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Export Reports</h2>
            <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: "13px" }}>
              Download the current report data for further analysis.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="save-btn"
              onClick={() => exportBillsExcel(periodBills)}
            >
              <Download size={16} />
              Export Bills
            </button>

            <button
              type="button"
              className="save-btn"
              onClick={() => exportCustomersExcel(customerReportData)}
            >
              <Download size={16} />
              Export Customers
            </button>

            <button
              type="button"
              className="save-btn"
              onClick={() => exportStockExcel(stock)}
            >
              <Download size={16} />
              Export Stock
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
