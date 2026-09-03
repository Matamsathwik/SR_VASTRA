import { useEffect, useMemo, useState } from "react";
import { billService } from "../services/billService";
import BillDetails from "./BillDetails";
import { supabase } from "../lib/supabase";
import { customerService } from "../services/customerService";

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const [customers, setCustomers] = useState([]);

  // --------------------------------------------------
  // Load bills and customers
  // --------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [billData, customerData] = await Promise.all([
          billService.getAll(),
          customerService.getAll(),
        ]);

        if (!isMounted) return;

        // Keep newest bills first
        const sortedBills = [...billData].sort((a, b) => {
          if (a.billDate !== b.billDate) {
            return b.billDate.localeCompare(a.billDate);
          }

          return Number(b.billNo) - Number(a.billNo);
        });

        setBills(sortedBills);
        setCustomers(customerData);
      } catch (err) {
        console.error("Failed to load bills:", err);

        if (isMounted) {
          alert("Failed to load bills.");
        }
      }
    };

    loadData();

    // --------------------------------------------------
    // Realtime bill updates
    // --------------------------------------------------
    const channel = supabase
      .channel("bills-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bills",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // --------------------------------------------------
  // Filter bills
  // --------------------------------------------------
  const filtered = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return bills.filter((bill) => {
      const customer = customers.find(
        (c) =>
          Number(c.id) === Number(bill.customerId)
      );

      const status =
        Number(bill.due) === 0
          ? "paid"
          : Number(bill.paid) === 0
          ? "unpaid"
          : "partial";

      const matchSearch =
        String(bill.billNo)
          .toLowerCase()
          .includes(searchText) ||
        String(bill.customerId)
          .toLowerCase()
          .includes(searchText) ||
        customer?.name
          ?.toLowerCase()
          .includes(searchText);

      const matchFilter =
        filter === "all" || filter === status;

      const matchDate =
        bill.billDate === selectedDate;

      return (
        matchSearch &&
        matchFilter &&
        matchDate
      );
    });
  }, [
    bills,
    customers,
    search,
    filter,
    selectedDate,
  ]);

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  const collection = filtered.reduce(
    (sum, bill) =>
      sum + Number(bill.paid || 0),
    0
  );

  const outstanding = filtered.reduce(
    (sum, bill) =>
      sum + Number(bill.due || 0),
    0
  );

  // --------------------------------------------------
  // Bill Details
  // --------------------------------------------------
  if (selectedBill) {
    return (
      <BillDetails
        bill={selectedBill}
        customer={customers.find(
          (c) =>
            Number(c.id) ===
            Number(selectedBill.customerId)
        )}
        goBack={() => setSelectedBill(null)}
      />
    );
  }

  return (
    <main className="content">
      <h1>Bills</h1>

      {/* Summary */}
      <div className="cards">
        <div className="card">
          <h3>{filtered.length}</h3>
          <p>Bills</p>
        </div>

        <div className="card">
          <h3>₹{collection}</h3>
          <p>Collection</p>
        </div>

        <div className="card">
          <h3>₹{outstanding}</h3>
          <p>Outstanding Due</p>
        </div>
      </div>

      {/* Search + Date */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <input
          className="search-box"
          placeholder="Search Bill No, Customer or Customer ID"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{ flex: 1 }}
        />

        <input
          type="date"
          value={selectedDate}
          onChange={(e) =>
            setSelectedDate(e.target.value)
          }
          style={{ minWidth: 170 }}
        />
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {[
          "all",
          "unpaid",
          "partial",
          "paid",
        ].map((f) => (
          <button
            key={f}
            className={`filter-chip ${
              filter === f ? "active" : ""
            }`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() +
              f.slice(1)}
          </button>
        ))}

        {selectedDate !== today && (
          <button
            className="filter-chip"
            onClick={() =>
              setSelectedDate(today)
            }
          >
            Today
          </button>
        )}
      </div>

      {/* Bills Table */}
      <div className="table-card">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No bills found.
                </td>
              </tr>
            ) : (
              filtered.map((bill) => {
                const customer =
                  customers.find(
                    (c) =>
                      Number(c.id) ===
                      Number(bill.customerId)
                  );

                return (
                  <tr
                    key={`${bill.billDate}-${bill.billNo}-${bill.id}`}
                    onClick={() =>
                      setSelectedBill(bill)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <td>
                      <strong>
                        #{bill.billNo}
                      </strong>
                    </td>

                    <td>{bill.billDate}</td>

                    <td>
                      {customer?.name ||
                        "Unknown"}
                    </td>

                    <td>
                      ₹{bill.total}
                    </td>

                    <td>
                      {bill.paymentMode ||
                        "Cash"}
                    </td>

                    <td>
                      ₹{bill.due}
                    </td>

                    <td>
                      <span
                        style={{
                          color:
                            bill.status ===
                            "Paid"
                              ? "#0F766E"
                              : bill.status ===
                                "Partial"
                              ? "#D97706"
                              : "#C0392B",
                          fontWeight: 700,
                        }}
                      >
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}