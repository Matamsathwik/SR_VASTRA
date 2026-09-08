import { useEffect, useMemo, useRef, useState } from "react";
import ReturnDetails from "./ReturnDetails";
import { returnService } from "../services/returnService";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import { activityService } from "../services/activityService";
import { stockService } from "../services/stockService";
import { authService } from "../services/authService";

const reasons = ["Exchange", "Damaged", "Wrong Item", "Other"];

export default function Returns() {
  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);

  const [selectedReturn, setSelectedReturn] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);

  const customerSearchRef = useRef(null);
  const billSearchRef = useRef(null);

  const [billNo, setBillNo] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [showBillList, setShowBillList] = useState(false);

  const [reason, setReason] = useState("Exchange");
  const [returnQty, setReturnQty] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
  const handleOutsideClick = (event) => {
    if (
      customerSearchRef.current &&
      !customerSearchRef.current.contains(event.target)
    ) {
      setShowCustomerList(false);
    }

    if (
      billSearchRef.current &&
      !billSearchRef.current.contains(event.target)
    ) {
      setShowBillList(false);
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener(
      "mousedown",
      handleOutsideClick
    );
  };
}, []);

  const loadData = async () => {
    try {
      const [billData, customerData, returnData] =
        await Promise.all([
          billService.getAll(),
          customerService.getAll(),
          returnService.getAll(),
        ]);

      setBills(billData);
      setCustomers(customerData);
      setReturns(returnData);

      
    } catch (err) {
      console.error("Returns load error:", err);
      alert("Failed to load return data.");
    }
  };

  const customerBills = useMemo(() => {
  return bills
    .filter(
      (bill) =>
        Number(bill.customerId) ===
        Number(selectedCustomer)
    )
    .sort((a, b) => {
      const dateA = new Date(
        `${a.billDate}T00:00:00`
      ).getTime();

      const dateB = new Date(
        `${b.billDate}T00:00:00`
      ).getTime();

      return dateB - dateA;
    });
}, [bills, selectedCustomer]);

  const bill = customerBills.find(
    (b) => Number(b.billNo) === Number(billNo)
  );

  const customer = customers.find(
    (c) => Number(c.id) === Number(selectedCustomer)
  );

  const todayReturns = returns.filter(
    (r) => r.returnDate === selectedDate
  );

  const todayRefund = todayReturns.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  const filteredReturns = useMemo(() => {
    const term = search.toLowerCase().trim();

    return returns
      .filter((r) => {
        const matchDate =
          r.returnDate === selectedDate;

        const matchSearch =
          !term ||
          String(r.returnNo)
            .toLowerCase()
            .includes(term) ||
          String(r.billNo)
            .toLowerCase()
            .includes(term) ||
          String(r.customerId)
            .toLowerCase()
            .includes(term) ||
          String(r.customerName || "")
            .toLowerCase()
            .includes(term);

        return matchDate && matchSearch;
      })
      .sort(
        (a, b) =>
          Number(b.returnNo) - Number(a.returnNo)
      );
  }, [returns, selectedDate, search]);

  const saveReturn = async () => {
    if (!bill) {
      alert("Select a bill.");
      return;
    }

    const returnedItems = bill.items
      .map((item, index) => ({
        ...item,
        returnQty: Number(returnQty[index] || 0),
      }))
      .filter((item) => item.returnQty > 0);

    if (returnedItems.length === 0) {
      alert("Select at least one item.");
      return;
    }

    // Prevent returning more than purchased quantity
    const invalidItem = returnedItems.find(
      (item) =>
        item.returnQty > Number(item.qty)
    );

    if (invalidItem) {
      alert(
        `Return quantity cannot exceed bought quantity for ${invalidItem.category}.`
      );
      return;
    }

    const subtotal = bill.items.reduce(
      (sum, item) =>
        sum +
        Number(item.qty) *
          Number(item.price),
      0
    );

    const discountRatio =
      subtotal > 0
        ? Number(bill.discount || 0) /
          subtotal
        : 0;

    const returnAmount =
      returnedItems.reduce(
        (sum, item) => {
          const effectivePrice =
            Number(item.price) *
            (1 - discountRatio);

          return (
            sum +
            Number(item.returnQty) *
              effectivePrice
          );
        },
        0
      );

    const finalReturnAmount =
      Math.round(returnAmount);

    try {
      const currentUser =
        await authService.currentUser();

      await returnService.create({
        billId: bill.id,
        customerId: customer.id,
        reason,
        refundAmount: finalReturnAmount,
        createdBy: currentUser?.id || null,

        items: returnedItems.map((item) => ({
  stockId: item.stockId,
  stockNo: item.stockNo,
  itemName: item.itemName,
  category: item.category || "Item",
  qty: item.returnQty,
  price: item.price,
})),
      });

      // Adjust bill due
      // Adjust bill due and status after return
const newDue = Math.max(
  0,
  Number(bill.due || 0) - finalReturnAmount
);

const paidAmount = Number(bill.paid || 0);

const newStatus =
  newDue === 0
    ? paidAmount > 0
      ? "Paid"
      : "Returned"
    : paidAmount > 0
    ? "Partial"
    : "Pending";

await billService.update(bill.id, {
  due: newDue,
  status: newStatus,
});

      // Activity log
      if (currentUser) {
        await activityService.add({
          username:
            currentUser.username ||
            currentUser.email ||
            "Unknown",
          role:
            currentUser.role || "staff",
          action:
            `Created Return for Bill #${bill.billNo} - Refund ₹${finalReturnAmount}`,
        });
      }

      await loadData();

      alert(
        `Return saved successfully.\nRefund: ₹${finalReturnAmount}`
      );

      setReturnQty({});
      setBillNo("");
      setBillSearch("");
      setSelectedCustomer("");
      setCustomerSearch("");
      setShowCustomerList(false);
      setShowBillList(false);
      setReason("Exchange");
    } catch (err) {
      console.error("Return save error:", err);
      alert(err.message || "Failed to save return.");
    }
  };

  if (selectedReturn) {
    const returnCustomer =
      customers.find(
        (c) =>
          Number(c.id) ===
          Number(selectedReturn.customerId)
      ) || customer;

    return (
      <ReturnDetails
        returnData={selectedReturn}
        customer={returnCustomer}
        goBack={() =>
          setSelectedReturn(null)
        }
      />
    );
  }

  return (
    <main className="content">
      <h1>Returns</h1>

      {/* SUMMARY */}
      <div className="cards">
        <div className="card">
          <h3>{todayReturns.length}</h3>
          <p>Today's Returns</p>
        </div>

        <div className="card">
          <h3>₹{todayRefund}</h3>
          <p>Today's Refund</p>
        </div>
      </div>

      {/* CREATE RETURN */}
      {customers.length === 0 ? (
        <div className="customer-card">
          <h2>No Customers Found</h2>
          <p>Create a customer first.</p>
        </div>
      ) : (
        <>
          <div className="customer-card">
            <div className="customer-form">

              {/* CUSTOMER */}
              <div>
                <label>Select Customer</label>

                <div
  className="search-wrap"
  ref={customerSearchRef}
>
  <input
    type="text"
    placeholder="Search customer..."
    value={customerSearch}
    onChange={(e) => {
      setCustomerSearch(e.target.value);
      setSelectedCustomer("");
      setBillNo("");
      setBillSearch("");
      setReturnQty({});
      setShowCustomerList(true);
      setShowBillList(false);
    }}
    onFocus={() => setShowCustomerList(true)}
  />

  {showCustomerList && (
    <div className="search-dropdown">
      {customers
        .filter((c) => {
          const term = customerSearch
            .toLowerCase()
            .trim();

          return (
            !term ||
            c.name?.toLowerCase().includes(term) ||
            String(c.id).includes(term) ||
            c.phone?.includes(term)
          );
        })
        .map((c) => (
          <button
            type="button"
            key={c.id}
            className="search-option"
            onClick={() => {
              setSelectedCustomer(Number(c.id));
              setCustomerSearch(c.name);
              setBillNo("");
              setBillSearch("");
              setReturnQty({});
              setShowCustomerList(false);
            }}
          >
            SR-{c.id} • {c.name}
            {c.phone ? ` • ${c.phone}` : ""}
          </button>
        ))}

      {customers.length === 0 && (
        <div className="search-empty">
          No customers found
        </div>
      )}
    </div>
  )}
</div>
              </div>

              {/* BILL */}
              <div>
                <label>Select Bill</label>

                <div
  className="search-wrap"
  ref={billSearchRef}
>
  <input
    type="text"
    placeholder="Search bill..."
    value={billSearch}
    onChange={(e) => {
      setBillSearch(e.target.value);
      setBillNo("");
      setReturnQty({});
      setShowBillList(true);
    }}
    onFocus={() => {
  setShowBillList(true);
  setShowCustomerList(false);
}}
  />

  {showBillList && (
    <div className="search-dropdown">
      {customerBills
        .filter((b) => {
          const term = billSearch.toLowerCase().trim();

          return (
            !term ||
            String(b.billNo).includes(term) ||
            String(b.billDate)
              .toLowerCase()
              .includes(term)
          );
        })
        .map((b) => (
          <button
            type="button"
            key={b.id}
            className="search-option"
            onClick={() => {
              setBillNo(Number(b.billNo));
              setBillSearch(
                `#${b.billNo} • ${b.billDate}`
              );
              setReturnQty({});
              setShowBillList(false);
            }}
          >
            #{b.billNo} • {b.billDate}
          </button>
        ))}

      {customerBills.length === 0 && (
        <div className="search-empty">
          No bills found for this customer
        </div>
      )}
    </div>
  )}
</div>
              </div>

              {/* REASON */}
              <div>
                <label>Reason</label>

                <select
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                >
                  {reasons.map((r) => (
                    <option key={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* BILL ITEMS */}
          {bill && (
            <div className="bill-card">
              <h2>
                Bill #{bill.billNo} •{" "}
                {customer?.name}
              </h2>

              <p>
                Customer ID: SR-
                {customer?.id}
              </p>

              <p>
                Current Due: ₹{Number(bill.due || 0)}
              </p>

              <table className="customer-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Bought</th>
                    <th>Return Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {bill.items.map(
                    (item, index) => (
                      <tr key={index}>
                        <td>
  {item.itemName || item.category || "Item"}
  {item.stockNo &&
    ` (${String(item.stockNo).replace(/\D/g, "")})`}
</td>

                        <td>
                          {item.qty}
                        </td>

                        <td>
                          <input
                            type="number"
                            min="0"
                            max={item.qty}
                            value={
                              returnQty[index] ||
                              ""
                            }
                            onChange={(e) => {
                              const value =
                                Number(
                                  e.target.value
                                );

                              if (
                                value >
                                Number(item.qty)
                              ) {
                                return;
                              }

                              setReturnQty({
                                ...returnQty,
                                [index]: value,
                              });
                            }}
                            style={{
                              width: 80,
                            }}
                          />
                        </td>

                        <td>
                          ₹
                          {Number(
                            returnQty[index] ||
                              0
                          ) *
                            Number(
                              item.price || 0
                            )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              <button
                className="save-btn"
                onClick={saveReturn}
              >
                Save Return
              </button>
            </div>
          )}
        </>
      )}

      {/* SEARCH */}
      <div
        style={{
          display: "flex",
          gap: 12,
          margin: "20px 0",
          flexWrap: "wrap",
        }}
      >
        <input
          type="date"
          className="search-box"
          value={selectedDate}
          onChange={(e) =>
            setSelectedDate(e.target.value)
          }
        />

        <input
          className="search-box"
          placeholder="Search Return, Bill, Customer or ID"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{ flex: 1 }}
        />
      </div>

      {/* RETURN LIST */}
      <div className="table-card">
        <h2>Recent Returns</h2>

        <table className="customer-table">
          <thead>
            <tr>
              <th>Return</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Bill</th>
              <th>Amount</th>
            </tr>
          </thead>

          <tbody>
            {filteredReturns.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    textAlign: "center",
                  }}
                >
                  No returns found.
                </td>
              </tr>
            ) : (
              filteredReturns.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    setSelectedReturn(r)
                  }
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <td>
                    <strong>
                      #{r.returnNo}
                    </strong>
                  </td>

                  <td>
                    {r.returnDate}
                  </td>

                  <td>
                    {r.customerName}
                  </td>

                  <td>
                    #{r.billNo}
                  </td>

                  <td>
                    ₹{r.amount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p
          style={{
            marginTop: 12,
            color: "#666",
            fontSize: 14,
          }}
        >
          Click any return to view complete
          return details.
        </p>
      </div>
    </main>
  );
}