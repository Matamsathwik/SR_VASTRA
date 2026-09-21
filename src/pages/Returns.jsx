import { useEffect, useMemo, useRef, useState } from "react";
import ReturnDetails from "./ReturnDetails";
import { returnService } from "../services/returnService";
import { billService } from "../services/billService";
import { customerService } from "../services/customerService";
import { activityService } from "../services/activityService";
import { stockService } from "../services/stockService";
import { authService } from "../services/authService";
import { Html5Qrcode } from "html5-qrcode";

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
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [billSearch, setBillSearch] = useState("");
  const [showBillList, setShowBillList] = useState(false);
  const [stock, setStock] = useState([]);

  const [reason, setReason] = useState("Exchange");
  const [settlementType, setSettlementType] = useState("CREDIT");
  const [returnQty, setReturnQty] = useState({});

  const [showScanner, setShowScanner] = useState(false);
  const [scannedItem, setScannedItem] = useState(null);
  const [savingReturn, setSavingReturn] = useState(false);
  const scannerRef = useRef(null);

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
      const [billData, customerData, returnData, stockData] =
        await Promise.all([
          billService.getAll(),
          customerService.getAll(),
          returnService.getAll(),
          stockService.getAll(),
        ]);

      setBills(billData);
      setCustomers(customerData);
      setReturns(returnData);
      setStock(stockData);

      
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

  const bill = selectedBillId
    ? bills.find((b) => Number(b.id) === Number(selectedBillId))
    : null;

  const customer = customers.find(
    (c) => Number(c.id) === Number(selectedCustomer)
  );

  const customerCurrentDue = customer
    ? bills
        .filter(
          (b) => Number(b.customerId) === Number(customer.id)
        )
        .reduce(
          (sum, b) => sum + Number(b.due || 0),
          0
        )
    : 0;

  const customerPreviousDue = Number(
    customer?.previous_due || 0
  );

  const customerTotalPending =
    customerCurrentDue + customerPreviousDue;

  const returnCustomer = customer
    ? {
        ...customer,
        totalPending: customerTotalPending,
      }
    : null;

  const todayReturns = returns.filter(
    (r) => r.returnDate === selectedDate
  );

  const todayRefund = todayReturns
    .filter((r) => r.settlementType === "REFUND")
    .reduce(
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

  const stopBarcodeScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (error) {
        console.error("Return scanner stop error:", error);
      }
      scannerRef.current = null;
    }

    setShowScanner(false);
  };

  const handleBarcodeScan = async (code) => {
    const cleanCode = String(code || "").trim();

    if (!cleanCode) return;

    if (!selectedCustomer) {
      alert("Select a customer first.");
      return;
    }

    try {
      const stockItem = stock.find(
        (item) =>
          String(item.barcode || "").trim() === cleanCode
      );

      if (!stockItem) {
        alert("Barcode not found in stock.");
        return;
      }

      const customerBillsForItem = bills
        .filter(
          (b) =>
            Number(b.customerId) === Number(selectedCustomer) &&
            Array.isArray(b.items)
        )
        .sort((a, b) => {
          const dateA = new Date(
            `${a.billDate}T00:00:00`
          ).getTime();
          const dateB = new Date(
            `${b.billDate}T00:00:00`
          ).getTime();

          if (dateB !== dateA) return dateB - dateA;

          return Number(b.billNo) - Number(a.billNo);
        });

      // Find the newest bill where this exact stock item
      // still has quantity available for return.
      const matchingBill = customerBillsForItem.find((b) => {
        const item = b.items.find(
          (saleItem) =>
            Number(saleItem.stockId) === Number(stockItem.id) ||
            String(saleItem.barcode || "").trim() === cleanCode
        );

        if (!item) return false;

        const purchasedQty = Number(item.qty || 0);

        const alreadyReturnedQty = returns
          .filter(
            (r) =>
              Number(r.billId) === Number(b.id) &&
              Number(r.customerId) === Number(selectedCustomer)
          )
          .reduce((total, r) => {
            const returnItems =
              r.items || r.returnItems || r.return_items || [];

            return (
              total +
              returnItems.reduce((itemTotal, returnedItem) => {
                const sameItem =
                  Number(returnedItem.stockId) === Number(stockItem.id) ||
                  String(returnedItem.barcode || "").trim() === cleanCode;

                return sameItem
                  ? itemTotal + Number(returnedItem.qty || 0)
                  : itemTotal;
              }, 0)
            );
          }, 0);

        const remainingQty = purchasedQty - alreadyReturnedQty;

        return remainingQty > 0;
      });

      if (!matchingBill) {
        alert(
          "No remaining quantity is available for return for this item."
        );
        return;
      }

      const itemIndex = matchingBill.items.findIndex(
        (item) =>
          Number(item.stockId) === Number(stockItem.id) ||
          String(item.barcode || "").trim() === cleanCode
      );

      if (itemIndex === -1) {
        alert("Original sale item not found.");
        return;
      }

      const originalItem = matchingBill.items[itemIndex];

      setSelectedBillId(matchingBill.id);
      setBillNo(matchingBill.billNo);
      setBillSearch(
        `#${matchingBill.billNo} • ${matchingBill.billDate}`
      );

      setScannedItem({
        ...originalItem,
        billId: matchingBill.id,
        billNo: matchingBill.billNo,
        billDate: matchingBill.billDate,
        billDiscount: Number(matchingBill.discount || 0),
        billTotal: Number(matchingBill.total || 0),
        billPaid: Number(matchingBill.paid || 0),
        billDue: Number(matchingBill.due || 0),
        paymentMode: matchingBill.paymentMode,
        itemIndex,
        barcode: cleanCode,
      });

      setReturnQty({ [itemIndex]: 1 });

      await stopBarcodeScanner();
    } catch (error) {
      console.error("Return barcode error:", error);
      alert(error.message || "Unable to process barcode.");
      await stopBarcodeScanner();
    }
  };

  const startBarcodeScanner = async () => {
    const reader = document.getElementById("return-barcode-reader");

    if (!reader) return;

    try {
      const scanner = new Html5Qrcode("return-barcode-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 300, height: 120 },
        },
        
        async (decodedText) => {
          console.log("RETURN BARCODE:", decodedText);
          await stopBarcodeScanner();
          await handleBarcodeScan(decodedText);
        },
        () => {}
      );
    } catch (error) {
      console.error("Return camera error:", error);
      alert("Unable to open camera. Please allow camera permission.");
      await stopBarcodeScanner();
    }
  };

  useEffect(() => {
    if (!showScanner) return;

    const timer = setTimeout(() => {
      startBarcodeScanner();
    }, 300);

    return () => clearTimeout(timer);
  }, [showScanner]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, []);

  const saveReturn = async () => {
    if (savingReturn) return;

    if (!selectedCustomer) {
      alert("Select a customer.");
      return;
    }

    if (!bill) {
      alert("Scan the item's barcode first.");
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

    // Check each item against the quantity already returned
    // from this exact bill.
    for (const item of returnedItems) {
      const alreadyReturnedQty = returns
        .filter(
          (r) =>
            Number(r.billId) === Number(bill.id) &&
            Number(r.customerId) === Number(selectedCustomer)
        )
        .reduce((total, r) => {
          const returnItems =
            r.items || r.returnItems || r.return_items || [];

          return (
            total +
            returnItems.reduce((itemTotal, returnedItem) => {
              const sameItem =
                Number(returnedItem.stockId) === Number(item.stockId) ||
                (
                  item.barcode &&
                  String(returnedItem.barcode || "").trim() ===
                    String(item.barcode || "").trim()
                );

              return sameItem
                ? itemTotal + Number(returnedItem.qty || 0)
                : itemTotal;
            }, 0)
          );
        }, 0);

      const remainingQty =
        Number(item.qty || 0) - alreadyReturnedQty;

      if (item.returnQty > remainingQty) {
        alert(
          `Cannot return ${item.returnQty} item(s). Only ${Math.max(
            0,
            remainingQty
          )} remaining for return.`
        );
        return;
      }
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

    setSavingReturn(true);

    try {
      const currentUser =
        await authService.currentUser();

      await returnService.create({
        billId: bill.id,
        customerId: customer.id,
        reason,
        refundAmount: finalReturnAmount,
        settlementType,
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
            settlementType === "CREDIT"
              ? `Created Return for Bill #${bill.billNo} - Customer Credit ₹${finalReturnAmount}`
              : `Created Return for Bill #${bill.billNo} - Refund Paid ₹${finalReturnAmount}`,
        });
      }

      await loadData();

      alert(
        settlementType === "CREDIT"
        ? `Return saved successfully.\nCustomer Credit: ₹${finalReturnAmount}`
        : `Return saved successfully.\nRefund Paid: ₹${finalReturnAmount}`
      );

      setReturnQty({});
      setBillNo("");
      setSelectedBillId(null);
      setBillSearch("");
      setScannedItem(null);
      setSelectedCustomer("");
      setCustomerSearch("");
      setShowCustomerList(false);
      setShowBillList(false);
      setReason("Exchange");
      setSettlementType("CREDIT");
    } catch (err) {
      console.error("Return save error:", err);
      alert(err.message || "Failed to save return.");
    } finally {
      setSavingReturn(false);
    }
  };

  if (selectedReturn) {
  const returnCustomer =
    customers.find(
      (c) =>
        Number(c.id) ===
        Number(selectedReturn.customerId)
    ) || null;

  const returnCustomerCurrentDue = returnCustomer
    ? bills
        .filter(
          (b) =>
            Number(b.customerId) ===
            Number(returnCustomer.id)
        )
        .reduce(
          (sum, b) =>
            sum + Number(b.due || 0),
          0
        )
    : 0;

  const returnCustomerPreviousDue = Number(
    returnCustomer?.previous_due || 0
  );

  const returnCustomerTotalPending =
    returnCustomerCurrentDue +
    returnCustomerPreviousDue;

  const customerForInvoice = returnCustomer
    ? {
        ...returnCustomer,
        totalPending:
          returnCustomerTotalPending,
      }
    : null;

  return (
    <ReturnDetails
      returnData={selectedReturn}
      customer={customerForInvoice}
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
          <p>Today's Refund Paid</p>
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
              setSelectedBillId(null);
              setBillSearch("");
              setReturnQty({});
              setScannedItem(null);
              setShowBillList(false);
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
                      setSelectedBillId(null);
                      setReturnQty({});
                      setScannedItem(null);
                      setShowBillList(true);
                    }}
                    onFocus={() => {
                      setShowBillList(true);
                      setShowCustomerList(false);
                    }}
                  />

                  {showBillList && selectedCustomer && (
                    <div className="search-dropdown">
                      {customerBills
                        .filter((b) => {
                          const term = billSearch.toLowerCase().trim();
                          return (
                            !term ||
                            String(b.billNo).includes(term) ||
                            String(b.billDate).toLowerCase().includes(term)
                          );
                        })
                        .map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            className="search-option"
                            onClick={() => {
                              setSelectedBillId(b.id);
                              setBillNo(b.billNo);
                              setBillSearch(`#${b.billNo} • ${b.billDate}`);
                              setReturnQty({});
                              setScannedItem(null);
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

                <button
                  type="button"
                  className="scan-barcode-btn"
                  disabled={!selectedCustomer}
                  onClick={() => setShowScanner(true)}
                  style={{ marginTop: 10 }}
                >
                  📷 Scan Barcode
                </button>

                {!selectedCustomer && (
                  <small style={{ color: "#777", display: "block", marginTop: 6 }}>
                    Select customer first
                  </small>
                )}
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
              {/* SETTLEMENT */}
              <div>
                <label>Settlement</label>

                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value)}
                >
                  <option value="CREDIT">
                    Customer Credit
                  </option>

                  <option value="REFUND">
                    Refund Paid
                  </option>
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
                disabled={savingReturn}
              >
                {savingReturn ? "Saving..." : "Save Return"}
              </button>
            </div>
          )}
        </>
      )}

      {showScanner && (
  <>
    <style>{`
      #return-barcode-reader {
        width: 360px !important;
        height: 220px !important;
        max-width: 100% !important;
        margin: 0 auto !important;
        padding: 0 !important;
        overflow: hidden !important;
        position: relative !important;
        background: #000 !important;
        border-radius: 10px !important;
      }

      #return-barcode-reader > div {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #return-barcode-reader__scan_region {
        width: 360px !important;
        height: 220px !important;
        max-width: 100% !important;
        position: relative !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      #return-barcode-reader__scan_region video {
        width: 360px !important;
        height: 220px !important;
        max-width: 100% !important;
        max-height: 220px !important;
        object-fit: cover !important;
        display: block !important;
        margin: 0 !important;
      }

      #return-barcode-reader__dashboard_section,
      #return-barcode-reader__dashboard_section_csr {
        display: none !important;
      }
    `}</style>

    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "420px",
          maxWidth: "95vw",
          background: "#fff",
          borderRadius: "16px",
          padding: "20px",
          boxSizing: "border-box",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: "21px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          Scan Return Barcode
        </h3>

        <div
          id="return-barcode-reader"
          style={{
            width: "360px",
            height: "220px",
            maxWidth: "100%",
            margin: "0 auto",
            overflow: "hidden",
            borderRadius: "10px",
            background: "#000",
          }}
        />

        

        <button
          type="button"
          onClick={stopBarcodeScanner}
          style={{
            display: "block",
            width: "150px",
            margin: "15px auto 0",
            padding: "11px 20px",
            border: "none",
            borderRadius: "8px",
            background: "#e22f2f",
            color: "#fff",
            fontSize: "15px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
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