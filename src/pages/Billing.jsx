import { useEffect, useMemo, useRef, useState } from "react";
import BillItemRow from "../components/BillItemRow";
import BillSuccessModal from "../components/BillSuccessModal";
import { stockService } from "../services/stockService";
import { customerService } from "../services/customerService";
import { activityService } from "../services/activityService";
import { billService } from "../services/billService";

export default function Billing({ user }) {
  const currentUser = user;

  const [stock, setStock] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [customerType, setCustomerType] = useState("existing");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const customerSearchRef = useRef(null);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
  });

  const [received, setReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");

  const [showModal, setShowModal] = useState(false);
  const [savedBill, setSavedBill] = useState(null);
  const [savedCustomer, setSavedCustomer] = useState("");

  const [items, setItems] = useState([
    {
      category: "Pattu",
      qty: 1,
      price: 0,
    },
  ]);

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
  };

  document.addEventListener("pointerdown", handleOutsideClick);

  return () => {
    document.removeEventListener(
      "pointerdown",
      handleOutsideClick
    );
  };
}, []);

  const loadData = async () => {
    try {
      const [customerData, stockData] = await Promise.all([
        customerService.getAll(),
        stockService.getAll(),
      ]);

      setCustomers(customerData);
      setStock(stockData);

      
    } catch (err) {
      console.error(err);
    }
  };

  const updateItem = (index, updated) => {
    const copy = [...items];
    copy[index] = updated;
    setItems(copy);
  };

  const deleteItem = (index) => {
    if (items.length === 1) return;

    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        category: "Cotton",
        qty: 1,
        price: 0,
      },
    ]);
  };

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + item.qty * item.price,
      0
    );
  }, [items]);

  const finalTotal = Math.max(0, total - discount);
  const due = Math.max(0, finalTotal - Number(received));

  const saveBill = async () => {
    if (!currentUser) {
      alert("User not loaded.");
      return;
    }

    if (customerType === "existing" && !selectedCustomer) {
      alert("Select a customer.");
      return;
    }

    let customerId = selectedCustomer;
    let updatedCustomers = [...customers];

    const billPayload = {
      customerId,
      billDate: new Date().toISOString().split("T")[0],
      total: finalTotal,
      discount,
      paid: Number(received),
      due,
      paymentMode,
      status: due === 0 ? "Paid" : "Pending",
      createdBy: currentUser.id,
      items,
    };
    const customerSearchRef = useRef(null);
    try {
      // Create new customer if selected
      if (customerType === "new") {
        if (!newCustomer.name.trim()) {
          alert("Customer name is required.");
          return;
        }

        const exists = customers.find(
          (c) =>
            c.name.toLowerCase() ===
            newCustomer.name.toLowerCase()
        );

        if (exists) {
          alert("Customer already exists.");
          return;
        }

        const createdCustomer = await customerService.create({
          name: newCustomer.name,
          phone: newCustomer.phone,
          address: "",
        });

        customerId = createdCustomer.id;
        updatedCustomers = [...customers, createdCustomer];

        setCustomers(updatedCustomers);
        setSelectedCustomer(createdCustomer.id);

        billPayload.customerId = createdCustomer.id;
      }

      // Create bill
      const bill = await billService.create(billPayload);

      // Record activity
      await activityService.add({
        username: currentUser.username || currentUser.email,
        role: currentUser.role,
        action: `Created Bill #${bill.bill_no}`,
      });

      // Reduce stock
      const updatedStock = await stockService.getAll();

      for (const sold of items) {
        if (!sold.stockId) continue;

        const index = updatedStock.findIndex(
          (s) => s.id === sold.stockId
        );

        if (index === -1) continue;

        const stockItem = updatedStock[index];

        const newQty = Math.max(
          0,
          Number(stockItem.currentQty || 0) -
            Number(sold.qty)
        );

        if (!stockItem.id) {
          console.error("Missing stock ID", stockItem);
          continue;
        }

        // Update Supabase
        await stockService.update(stockItem.id, {
          stockNo: stockItem.stockNo,
          supplier: stockItem.supplier,
          itemName: stockItem.itemName,
          category: stockItem.category,
          purchasePrice: stockItem.purchasePrice,
          sellingPrice: stockItem.sellingPrice,
          currentQty: newQty,
        });

        // Update local array
        updatedStock[index] = {
          ...stockItem,
          currentQty: newQty,
        };
      }

      // Keep Billing page state synchronized immediately
      setStock(updatedStock);

      const customerName =
        updatedCustomers.find(
          (c) => c.id === customerId
        )?.name || newCustomer.name;

      setSavedBill({
        id: bill.id,
        billNo: bill.bill_no,
        billDate: bill.bill_date,
        discount: bill.discount,
        total: bill.total,
        paid: bill.paid,
        due: bill.due,
        paymentMode: bill.payment_mode,
        status: bill.status,
        items,
        customerId,
        createdBy:
          currentUser.username || currentUser.email,
        createdAt: new Date().toLocaleString("en-IN"),
      });

      setSavedCustomer(customerName);
      setShowModal(true);

      // Reset
      setItems([
        {
          category: "Pattu",
          qty: 1,
          price: 0,
        },
      ]);

      setReceived(0);
      setDiscount(0);
      setPaymentMode("Cash");

      setNewCustomer({
        name: "",
        phone: "",
      });

      setCustomerType("existing");
    } catch (err) {
      console.error("Bill Save Error:", err);
      alert(err.message);
    }
  };

  return (
    <main className="content">
      <h1 className="customer-title">Billing</h1>

      <div className="bill-card">
        <div className="customer-form">
          <div>
            <label>Customer Type</label>

            <select
              value={customerType}
              onChange={(e) => {
  setCustomerType(e.target.value);

  if (e.target.value === "new") {
    setSelectedCustomer("");
    setCustomerSearch("");
    setShowCustomerList(false);
  }
}}
            >
              <option value="existing">
                Existing Customer
              </option>
              <option value="new">New Customer</option>
            </select>
          </div>

          <div>
            <label>Date</label>

            <input
              type="date"
              value={new Date()
                .toISOString()
                .split("T")[0]}
              readOnly
            />
          </div>
        </div>

       <div
  ref={customerSearchRef}
  style={{ marginTop: 20, position: "relative" }}
>
  <label>Select Customer</label>

  <input
    type="text"
    placeholder="Search customer..."
    value={
      selectedCustomer
        ? customers.find(
            (c) => Number(c.id) === Number(selectedCustomer)
          )?.name || customerSearch
        : customerSearch
    }
    onChange={(e) => {
      setCustomerSearch(e.target.value);
      setSelectedCustomer("");
      setShowCustomerList(true);
    }}
    onFocus={() => setShowCustomerList(true)}
  />

  {showCustomerList && (
    <div className="search-dropdown">
      {customers
        .filter((c) => {
          const search = customerSearch.toLowerCase();

          return (
            c.name?.toLowerCase().includes(search) ||
            String(c.id).includes(search) ||
            c.phone?.includes(search)
          );
        })
        .map((c) => (
          <button
            type="button"
            key={c.id}
            className="search-option"
            onClick={() => {
              setSelectedCustomer(c.id);
              setCustomerSearch(c.name);
              setShowCustomerList(false);
            }}
          >
            SR-{c.id} • {c.name}
            {c.phone ? ` • ${c.phone}` : ""}
          </button>
        ))}
    </div>
  )}
</div>

        {customerType === "new" && (
          <div
            className="customer-form"
            style={{ marginTop: 20 }}
          >
            <input
              placeholder="Customer Name"
              value={newCustomer.name}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  name: e.target.value,
                })
              }
            />

            <input
              placeholder="Phone"
              value={newCustomer.phone}
              onChange={(e) =>
                setNewCustomer({
                  ...newCustomer,
                  phone: e.target.value,
                })
              }
            />
          </div>
        )}

        <div style={{ marginTop: 30 }}>
          <h2>Items</h2>

          {items.map((item, index) => (
            <BillItemRow
              key={index}
              item={item}
              stock={stock}
              index={index}
              onChange={updateItem}
              onDelete={deleteItem}
            />
          ))}

          <button
            className="add-item-btn"
            onClick={addItem}
          >
            + Add Item
          </button>
        </div>

        <div className="summary-box">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{total}</span>
          </div>

          <div className="summary-row">
            <span>Discount</span>

            <input
              type="number"
              value={discount}
              onChange={(e) =>
                setDiscount(Number(e.target.value))
              }
              style={{ width: 140 }}
            />
          </div>

          <div className="summary-row">
            <span>Final Total</span>
            <span>₹{finalTotal}</span>
          </div>

          <div className="summary-row">
            <span>Payment Mode</span>

            <select
              value={paymentMode}
              onChange={(e) =>
                setPaymentMode(e.target.value)
              }
              style={{ width: 140 }}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
            </select>
          </div>

          <div className="summary-row">
            <span>Amount Received</span>

            <input
              type="number"
              value={received}
              onChange={(e) =>
                setReceived(Number(e.target.value))
              }
              style={{ width: 140 }}
            />
          </div>

          <div className="summary-row">
            <span>Pending Due</span>
            <span className="grand-total">₹{due}</span>
          </div>

          <button
            className="save-btn"
            style={{ marginTop: 20 }}
            onClick={saveBill}
          >
            Save Bill
          </button>
        </div>
      </div>

      <BillSuccessModal
        open={showModal}
        bill={savedBill}
        customer={savedCustomer}
        phone={
          customers.find(
            (c) => c.id === savedBill?.customerId
          )?.phone || ""
        }
        onClose={() => setShowModal(false)}
      />
    </main>
  );
}
