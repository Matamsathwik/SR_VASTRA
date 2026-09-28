import { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  Search,
  X,
  Trash2,
  PackagePlus,
  Eye,
  RotateCcw,
  MinusCircle,
} from "lucide-react";
import { generateBarcode } from "../utils/barcode";
import { purchaseService } from "../services/purchaseService";
import { supplierService } from "../services/supplierService";
import { stockService } from "../services/stockService";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const categories = [
  "Pattu",
  "Cotton",
  "Silk",
  "Fancy",
  "Kalamkari",
  "Printed",
  "Linen",
  "Other",
];

const emptyPurchase = {
  supplierId: "",
  discount: "",
  note: "",
};

const emptyItem = {
  itemName: "",
  category: "",
  qty: 1,
  purchasePrice: "",
  sellingPrice: "",
  mrp: "",
  barcode: "",
  hsnCode: "",
  gstRate: 0,
  gstInclusive: true,
};

const emptySupplier = {
  name: "",
  phone: "",
  address: "",
  gstin: "",
  openingDue: "",
};

const emptyPayment = {
  payment_mode: "Cash",
  amount: "",
  reference_no: "",
  note: "",
};

export default function Purchases({ onOpenSupplier }) {
  const [mode, setMode] = useState("history");

  const [suppliers, setSuppliers] = useState([]);
  const [stock, setStock] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplierReturns, setSupplierReturns] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyPurchase);
  const [itemForm, setItemForm] = useState(emptyItem);
  const [items, setItems] = useState([]);

  const [payments, setPayments] = useState([]);

  const [itemSearch, setItemSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);
  const STOCK_PER_PAGE = 10;
  const [showSupplier, setShowSupplier] = useState(false);
  const supplierPickerRef = useRef(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  const [supplierPage, setSupplierPage] = useState(1);
  const SUPPLIERS_PER_PAGE = 10;

  const [showExistingItems, setShowExistingItems] = useState(false);

  const [supplierForm, setSupplierForm] = useState(emptySupplier);

  const [selectedPurchase, setSelectedPurchase] = useState(null);

  const [selectedItems, setSelectedItems] = useState([]);

  const [showSupplierReturn, setShowSupplierReturn] = useState(false);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);

  const load = async () => {
    setLoading(true);

    try {
      const [supplierData, stockData, purchaseData, supplierReturnData] =
        await Promise.all([
          supplierService.getAll(),
          stockService.getAll(),
          purchaseService.getAll(),
          purchaseService.getSupplierReturns(),
        ]);

      setSuppliers(supplierData || []);
      setStock(stockData || []);
      setPurchases(purchaseData || []);
      setSupplierReturns(supplierReturnData || []);
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to load purchase data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        supplierPickerRef.current &&
        !supplierPickerRef.current.contains(event.target)
      ) {
        setShowSupplierPicker(false);
        setSupplierSearch("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const startNewPurchase = () => {
    setMode("entry");
    setForm({ ...emptyPurchase });
    setItemForm({
      ...emptyItem,
      barcode: generateBarcode(),
    });
    setItems([]);
    setPayments([{ ...emptyPayment }]);
    setItemSearch("");
    setSupplierSearch("");
    setSelectedPurchase(null);
    setSelectedItems([]);
    setShowExistingItems(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelPurchase = () => {
    setMode("history");
    setForm({ ...emptyPurchase });
    setItemForm({ ...emptyItem });
    setItems([]);
    setPayments([]);
    setItemSearch("");
    setSupplierSearch("");
  };

  const updateItemForm = (field, value) => {
    setItemForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const addItemToPurchase = () => {
    const name = itemForm.itemName.trim();
    const qty = Number(itemForm.qty);
    const cp = Number(itemForm.purchasePrice);
    const sp = Number(itemForm.sellingPrice);
    const mrp = Number(itemForm.mrp || 0);
    const gstRate = Number(itemForm.gstRate || 0);

    if (!name) {
      alert("Please enter the item name.");
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      alert("Quantity must be a positive whole number.");
      return;
    }

    if (!Number.isFinite(cp) || cp < 0) {
      alert("Please enter a valid purchase price.");
      return;
    }

    if (!Number.isFinite(sp) || sp < 0) {
      alert("Please enter a valid selling price.");
      return;
    }

    if (!Number.isFinite(mrp) || mrp < 0) {
      alert("Please enter a valid MRP.");
      return;
    }

    if (gstRate < 0 || gstRate > 100) {
      alert("GST must be between 0 and 100.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        stockId: null,
        itemName: name,
        stockNo: "Generated on save",
        category: itemForm.category.trim(),
        barcode: itemForm.barcode || generateBarcode(),
        hsnCode: itemForm.hsnCode.trim(),
        qty,
        purchasePrice: cp,
        sellingPrice: sp,
        mrp,
        gstRate,
        gstInclusive: itemForm.gstInclusive !== false,
      },
    ]);

    setItemForm({
      ...emptyItem,
      barcode: generateBarcode(),
    });

    setItemSearch("");
  };

  const addExistingStockItem = (stockItem) => {
    const existingIndex = items.findIndex(
      (item) => item.stockId === stockItem.id,
    );

    if (existingIndex >= 0) {
      setItems((current) =>
        current.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                qty: Number(item.qty || 0) + 1,
              }
            : item,
        ),
      );
    } else {
      setItems((current) => [
        ...current,
        {
          stockId: stockItem.id,
          itemName: stockItem.itemName,
          stockNo: stockItem.stockNo,
          category: stockItem.category || "",
          barcode: stockItem.barcode || "",
          hsnCode: stockItem.hsnCode || "",
          qty: 1,
          purchasePrice: Number(stockItem.purchasePrice || 0),
          sellingPrice: Number(stockItem.sellingPrice || 0),
          mrp: Number(stockItem.mrp || 0),
          gstRate: Number(stockItem.gstRate || 0),
          gstInclusive: stockItem.gstInclusive !== false,
        },
      ]);
    }

    setItemSearch("");
    setShowExistingItems(false);
  };

  const updatePurchaseItem = (index, field, value) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const removePurchaseItem = (index) => {
    setItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + Number(item.qty || 0) * Number(item.purchasePrice || 0),
        0,
      ),
    [items],
  );

  const discount = Math.max(0, Number(form.discount || 0));

  const total = Math.max(0, subtotal - discount);

  const paid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const due = Math.max(0, total - paid);

  const updatePayment = (index, field, value) => {
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, [field]: value } : payment,
      ),
    );
  };

  const removePayment = (index) => {
    setPayments((current) =>
      current.filter((_, paymentIndex) => paymentIndex !== index),
    );
  };

  const savePurchase = async () => {
    if (!form.supplierId) {
      alert("Please select a supplier.");
      return;
    }

    if (!items.length) {
      alert("Please add at least one item.");
      return;
    }

    if (discount > subtotal) {
      alert("Discount cannot exceed the subtotal.");
      return;
    }

    if (paid > total) {
      alert("Paid amount cannot exceed the purchase total.");
      return;
    }

    try {
      setSaving(true);

      await purchaseService.create({
        supplierId: Number(form.supplierId),
        items: items.map((item) => ({
          stock_id: item.stockId,
          item_name: item.itemName,
          category: item.category || null,
          barcode: item.barcode || null,
          hsn_code: item.hsnCode || null,
          qty: Number(item.qty),
          purchase_price: Number(item.purchasePrice),
          selling_price:
            item.sellingPrice === "" ? null : Number(item.sellingPrice),
          mrp: item.mrp === "" ? null : Number(item.mrp),
          gst_rate: Number(item.gstRate || 0),
          gst_inclusive: item.gstInclusive !== false,
        })),
        payments: payments
          .filter((payment) => Number(payment.amount || 0) > 0)
          .map((payment) => ({
            payment_mode: payment.payment_mode,
            amount: Number(payment.amount),
            reference_no: payment.reference_no || null,
            note: payment.note || null,
          })),
        discount,
        notes: form.note || null,
      });

      alert("Purchase saved successfully.");

      await load();

      setMode("history");
      setForm({ ...emptyPurchase });
      setItemForm({ ...emptyItem });
      setItems([]);
      setPayments([]);
    } catch (error) {
      console.error(error);
      alert(error.message || "Purchase could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const createSupplier = async () => {
    if (!supplierForm.name.trim()) {
      alert("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);

      const created = await supplierService.create(supplierForm);

      setSuppliers((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );

      setForm((current) => ({
        ...current,
        supplierId: String(created.id),
      }));

      setSupplierForm({ ...emptySupplier });
      setShowSupplier(false);
    } catch (error) {
      console.error(error);
      alert(error.message || "Supplier could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = async (purchase) => {
    try {
      const data = await purchaseService.getById(purchase.id);

      setSelectedPurchase(data);
      setSelectedItems(data.purchase_items || []);
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not open purchase.");
    }
  };

  const openSupplierReturn = () => {
    if (!selectedPurchase || !selectedItems.length) {
      alert("No purchase items available.");
      return;
    }

    setReturnItems(
      selectedItems.map((item) => ({
        stock_id: item.stock_id,
        item_name: item.item_name,
        stock_no: item.stock_no,
        barcode: item.barcode,
        purchase_price: Number(item.purchase_price || 0),
        purchased_qty: Number(item.qty || 0),
        qty: 0,
      })),
    );

    setReturnReason("");
    setShowSupplierReturn(true);
  };

  const updateReturnQty = (index, value) => {
    const qty = Number(value);

    setReturnItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              qty: Number.isInteger(qty) && qty >= 0 ? qty : 0,
            }
          : item,
      ),
    );
  };

  const saveSupplierReturn = async () => {
    if (!selectedPurchase) {
      alert("Purchase not selected.");
      return;
    }

    const selectedReturnItems = returnItems.filter(
      (item) => Number(item.qty) > 0,
    );

    if (!selectedReturnItems.length) {
      alert("Enter return quantity for at least one item.");
      return;
    }

    for (const item of selectedReturnItems) {
      if (Number(item.qty) > Number(item.purchased_qty)) {
        alert(
          `Return quantity for ${item.item_name} cannot exceed purchased quantity.`,
        );
        return;
      }
    }

    try {
      setReturnSaving(true);

      await purchaseService.createSupplierReturn({
        supplierId: selectedPurchase.supplier_id,
        purchaseId: selectedPurchase.id,
        items: selectedReturnItems.map((item) => ({
          stock_id: item.stock_id,
          qty: Number(item.qty),
        })),
        reason: returnReason.trim() || null,
      });

      alert("Supplier return saved successfully.");

      setShowSupplierReturn(false);
      setReturnItems([]);
      setReturnReason("");
      setSelectedPurchase(null);
      setSelectedItems([]);

      await load();
    } catch (error) {
      console.error(error);

      alert(error.message || "Supplier return could not be saved.");
    } finally {
      setReturnSaving(false);
    }
  };

  const filteredStock = stock.filter((item) =>
    `${item.itemName || ""} ${item.stockNo || ""} ${item.barcode || ""} ${
      item.category || ""
    }`
      .toLowerCase()
      .includes(itemSearch.toLowerCase()),
  );
  const stockTotalPages = Math.max(
    1,
    Math.ceil(filteredStock.length / STOCK_PER_PAGE),
  );

  const paginatedStock = filteredStock.slice(
    (stockPage - 1) * STOCK_PER_PAGE,
    stockPage * STOCK_PER_PAGE,
  );

  const filteredSuppliers = suppliers.filter((supplier) =>
    `${supplier.name || ""} ${supplier.phone || ""}`
      .toLowerCase()
      .includes(supplierSearch.toLowerCase()),
  );

  const supplierTotalPages = Math.max(
    1,
    Math.ceil(suppliers.length / SUPPLIERS_PER_PAGE),
  );

  const paginatedSuppliers = suppliers.slice(
    (supplierPage - 1) * SUPPLIERS_PER_PAGE,
    supplierPage * SUPPLIERS_PER_PAGE,
  );

  const selectedSupplier = suppliers.find(
    (supplier) => String(supplier.id) === String(form.supplierId),
  );

  return (
    <main className="content purchase-page">
      {/* PAGE HEADER */}

      <div className="purchase-header">
        <div>
          <h1>Purchases</h1>
          <p className="muted">Record stock bought from suppliers.</p>
        </div>

        <div className="purchase-header-actions">
          {mode === "entry" && (
            <button
              type="button"
              className="secondary-btn"
              onClick={cancelPurchase}
            >
              Cancel
            </button>
          )}

          <button type="button" className="save-btn" onClick={startNewPurchase}>
            <Plus size={18} />
            New Purchase
          </button>
        </div>
      </div>

      {/* =====================================================
          NEW PURCHASE
      ===================================================== */}

      {mode === "entry" && (
        <div className="purchase-entry">
          {/* SUPPLIER */}

          <section className="customer-card purchase-section">
            <div className="purchase-section-head">
              <div>
                <h2>Supplier</h2>
                <p className="muted">Select the supplier for this purchase.</p>
              </div>

              <button
                type="button"
                className="small-btn"
                onClick={() => setShowSupplier(true)}
              >
                <Plus size={16} />
                Add Supplier
              </button>
            </div>

            <div className="supplier-picker">
              <label>Select Supplier *</label>

              <div className="supplier-combobox" ref={supplierPickerRef}>
                <Search size={18} />

                <input
                  value={
                    showSupplierPicker
                      ? supplierSearch
                      : selectedSupplier?.name || ""
                  }
                  onFocus={() => {
                    setShowSupplierPicker(true);
                    setSupplierSearch("");
                  }}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setShowSupplierPicker(true);
                  }}
                  placeholder="Search supplier by name or phone..."
                  autoComplete="off"
                />

                {selectedSupplier && !supplierSearch && (
                  <button
                    type="button"
                    className="supplier-clear"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        supplierId: "",
                      }));
                      setSupplierSearch("");
                      setShowSupplierPicker(false);
                    }}
                  >
                    <X size={17} />
                  </button>
                )}

                {showSupplierPicker && (
                  <div className="supplier-dropdown">
                    {suppliers
                      .filter((supplier) =>
                        `${supplier.name || ""} ${supplier.phone || ""}`
                          .toLowerCase()
                          .includes(supplierSearch.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((supplier) => (
                        <button
                          type="button"
                          className="supplier-option"
                          key={supplier.id}
                          onClick={() => {
                            setForm((current) => ({
                              ...current,
                              supplierId: String(supplier.id),
                            }));

                            setSupplierSearch("");

                            setShowSupplierPicker(false);
                          }}
                        >
                          <strong>{supplier.name}</strong>

                          {supplier.phone && <span>{supplier.phone}</span>}
                        </button>
                      ))}

                    {suppliers.filter((supplier) =>
                      `${supplier.name || ""} ${supplier.phone || ""}`
                        .toLowerCase()
                        .includes(supplierSearch.toLowerCase()),
                    ).length === 0 && (
                      <div className="supplier-no-results">
                        No supplier found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedSupplier && (
                <div className="selected-supplier-info">
                  <strong>{selectedSupplier.name}</strong>

                  {selectedSupplier.phone && (
                    <span>{selectedSupplier.phone}</span>
                  )}

                  {selectedSupplier.address && (
                    <span>{selectedSupplier.address}</span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ITEM ENTRY */}

          <section className="customer-card purchase-section">
            <div className="purchase-section-head">
              <div>
                <h2>Add Items</h2>
                <p className="muted">
                  Enter what you bought. Barcode and stock number are generated
                  by SR Vastra.
                </p>
              </div>

              <button
                type="button"
                className="small-btn"
                onClick={() => setShowExistingItems((current) => !current)}
              >
                <Search size={16} />
                Existing Item
              </button>
            </div>

            <div className="purchase-item-entry">
              <div className="purchase-field item-name-field">
                <label>Item Name *</label>
                <input
                  value={itemForm.itemName}
                  onChange={(e) => updateItemForm("itemName", e.target.value)}
                  placeholder="Example: Silk Saree"
                  autoComplete="off"
                />
              </div>

              <div className="purchase-field">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={itemForm.qty}
                  onChange={(e) => updateItemForm("qty", e.target.value)}
                />
              </div>

              <div className="purchase-field">
                <label>CP / Buy Price *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.purchasePrice}
                  onChange={(e) =>
                    updateItemForm("purchasePrice", e.target.value)
                  }
                  placeholder="What we paid"
                />
              </div>

              <div className="purchase-field">
                <label>SP / Our Selling Price *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.sellingPrice}
                  onChange={(e) =>
                    updateItemForm("sellingPrice", e.target.value)
                  }
                  placeholder="What we sell for"
                />
              </div>

              <div className="purchase-field">
                <label>MRP</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.mrp}
                  onChange={(e) => updateItemForm("mrp", e.target.value)}
                  placeholder="Brand MRP"
                />
              </div>

              <div className="purchase-field">
                <label>Category</label>
                <select
                  value={itemForm.category}
                  onChange={(e) => updateItemForm("category", e.target.value)}
                >
                  <option value="">Select Category</option>

                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="purchase-field">
                <label>GST %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={itemForm.gstRate}
                  onChange={(e) => updateItemForm("gstRate", e.target.value)}
                />
              </div>

              <div className="purchase-field">
                <label>HSN Code</label>
                <input
                  value={itemForm.hsnCode}
                  onChange={(e) => updateItemForm("hsnCode", e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="purchase-auto-barcode">
                <span>Barcode</span>
                <strong>{itemForm.barcode}</strong>
                <small>Automatically generated</small>
              </div>

              <button
                type="button"
                className="purchase-add-item-btn"
                onClick={addItemToPurchase}
              >
                <Plus size={19} />
                Add Item
              </button>
            </div>

            {/* EXISTING STOCK SEARCH */}

            {showExistingItems && (
              <div className="existing-item-panel">
                <div className="search-wrap">
                  <Search size={18} />
                  <input
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setStockPage(1);
                    }}
                    placeholder="Search existing item, stock no. or barcode"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="search-close"
                    onClick={() => {
                      setShowExistingItems(false);
                      setItemSearch("");
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="stock-pick-grid">
                  {paginatedStock.map((item) => (
                    <button
                      type="button"
                      className="stock-pick"
                      key={item.id}
                      onClick={() => addExistingStockItem(item)}
                    >
                      <strong>{item.itemName}</strong>
                      <span>
                        {item.stockNo} {" · "} Stock {item.currentQty}
                      </span>
                      <b>CP {money(item.purchasePrice)}</b>
                    </button>
                  ))}
                </div>
                <div className="purchase-pagination">
                  <button
                    type="button"
                    className="small-btn"
                    disabled={stockPage === 1}
                    onClick={() =>
                      setStockPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Previous
                  </button>
                  <div className="purchase-page-numbers">
                    {Array.from(
                      { length: stockTotalPages },
                      (_, index) => index + 1,
                    ).map((page) => (
                      <button
                        type="button"
                        key={page}
                        className={
                          stockPage === page ? "page-btn active" : "page-btn"
                        }
                        onClick={() => setStockPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="small-btn"
                    disabled={stockPage === stockTotalPages}
                    onClick={() =>
                      setStockPage((page) =>
                        Math.min(stockTotalPages, page + 1),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ADDED ITEMS */}

          <section className="customer-card purchase-section">
            <div className="purchase-section-head">
              <div>
                <h2>
                  Purchase Items
                  <span className="purchase-count">{items.length}</span>
                </h2>
              </div>
            </div>

            {!items.length ? (
              <div className="purchase-empty">
                <PackagePlus size={34} />
                <strong>No items added yet</strong>
                <span>Enter the item details above and press Add Item.</span>
              </div>
            ) : (
              <div className="purchase-item-list">
                {items.map((item, index) => (
                  <article
                    className="purchase-line-card"
                    key={`${item.stockId || item.barcode}-${index}`}
                  >
                    <div className="purchase-line-head">
                      <div>
                        <strong>{item.itemName}</strong>
                        <span>
                          {item.stockId
                            ? `Stock ${item.stockNo}`
                            : "New stock item"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => removePurchaseItem(index)}
                        aria-label="Remove item"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>

                    <div className="purchase-line-grid">
                      <div>
                        <label>Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={(e) =>
                            updatePurchaseItem(index, "qty", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label>CP</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.purchasePrice}
                          onChange={(e) =>
                            updatePurchaseItem(
                              index,
                              "purchasePrice",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>SP</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.sellingPrice}
                          onChange={(e) =>
                            updatePurchaseItem(
                              index,
                              "sellingPrice",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      <div>
                        <label>MRP</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) =>
                            updatePurchaseItem(index, "mrp", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="purchase-line-bottom">
                      <span>
                        Barcode:{" "}
                        <strong>{item.barcode || "Generated on save"}</strong>
                      </span>

                      <strong>
                        {money(
                          Number(item.qty || 0) *
                            Number(item.purchasePrice || 0),
                        )}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* PAYMENT */}

          <section className="customer-card purchase-section">
            <div className="purchase-section-head">
              <div>
                <h2>Payment</h2>
                <p className="muted">
                  Pay now, pay partly, or keep the amount due to the supplier.
                </p>
              </div>
            </div>

            <div className="purchase-total-grid">
              <div>
                <label>Subtotal</label>
                <strong>{money(subtotal)}</strong>
              </div>

              <div>
                <label>Discount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount: e.target.value,
                    })
                  }
                />
              </div>

              <div className="purchase-grand-total">
                <label>Total</label>
                <strong>{money(total)}</strong>
              </div>

              <div>
                <label>Paying Now</label>
                <strong>{money(paid)}</strong>
              </div>

              <div className="purchase-due">
                <label>Supplier Due</label>
                <strong>{money(due)}</strong>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="purchase-payment-row">
                <div>
                  <label>Payment Mode</label>

                  <select
                    value={payments[0].payment_mode}
                    onChange={(e) =>
                      updatePayment(0, "payment_mode", e.target.value)
                    }
                  >
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Bank</option>
                  </select>
                </div>

                <div>
                  <label>Paying Now</label>

                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    value={payments[0].amount}
                    onChange={(e) => {
                      const value = e.target.value;

                      updatePayment(0, "amount", value);
                    }}
                    placeholder="Amount paying now"
                  />
                </div>

                <div>
                  <label>Reference</label>

                  <input
                    value={payments[0].reference_no}
                    onChange={(e) =>
                      updatePayment(0, "reference_no", e.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            <div className="purchase-note">
              <label>Purchase Note</label>
              <input
                value={form.note}
                onChange={(e) =>
                  setForm({
                    ...form,
                    note: e.target.value,
                  })
                }
                placeholder="Optional note"
              />
            </div>

            <button
              type="button"
              className="purchase-save-main"
              onClick={savePurchase}
              disabled={saving || !form.supplierId || !items.length}
            >
              {saving
                ? "Saving Purchase..."
                : `Save Purchase · ${money(total)}`}
            </button>
          </section>
        </div>
      )}

      {/* =====================================================
          HISTORY
      ===================================================== */}
      {mode === "history" && (
        <>
          {/* =====================================================
        SUPPLIER LIST
    ===================================================== */}

          <section className="table-card supplier-list-section">
            <div className="purchase-section-head">
              <div>
                <h2>Supplier List</h2>
                <p className="muted">
                  Select a supplier to open their profile.
                </p>
              </div>

              <button
                type="button"
                className="small-btn"
                onClick={() => setShowSupplier(true)}
              >
                <Plus size={16} />
                Add Supplier
              </button>
            </div>

            {loading ? (
              <div className="purchase-empty">Loading suppliers...</div>
            ) : !suppliers.length ? (
              <div className="purchase-empty">
                <PackagePlus size={34} />
                <strong>No suppliers yet</strong>
                <span>Add a supplier to start recording purchases.</span>
              </div>
            ) : (
              <>
                <div className="supplier-list-grid">
                  {paginatedSuppliers.map((supplier) => (
                    <button
                      type="button"
                      className="supplier-list-card"
                      key={supplier.id}
                      onClick={() => {
                        if (onOpenSupplier) {
                          onOpenSupplier(supplier);
                        }
                      }}
                    >
                      <div className="supplier-list-card-top">
                        <div>
                          <strong>{supplier.name}</strong>

                          {supplier.phone && <span>📞 {supplier.phone}</span>}
                        </div>

                      </div>

                      {supplier.address && <p>{supplier.address}</p>}

                      <div className="supplier-list-card-footer">
                      
                        <span>View Profile</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Supplier Pagination */}
                {supplierTotalPages > 1 && (
                  <div className="purchase-pagination">
                    <button
                      type="button"
                      className="small-btn"
                      disabled={supplierPage === 1}
                      onClick={() =>
                        setSupplierPage((page) => Math.max(1, page - 1))
                      }
                    >
                      Previous
                    </button>

                    <div className="purchase-page-numbers">
                      {Array.from(
                        {
                          length: supplierTotalPages,
                        },
                        (_, index) => index + 1,
                      ).map((page) => (
                        <button
                          type="button"
                          key={page}
                          className={
                            supplierPage === page
                              ? "page-btn active"
                              : "page-btn"
                          }
                          onClick={() => setSupplierPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="small-btn"
                      disabled={supplierPage === supplierTotalPages}
                      onClick={() =>
                        setSupplierPage((page) =>
                          Math.min(supplierTotalPages, page + 1),
                        )
                      }
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* =====================================================
        PURCHASE HISTORY
    ===================================================== */}

          <section className="table-card purchase-history">
            <div className="purchase-section-head">
              <div>
                <h2>Purchase History</h2>
                <p className="muted">Previous purchases from suppliers.</p>
              </div>

              <button
                type="button"
                className="small-btn"
                onClick={load}
                disabled={loading}
              >
                <RotateCcw size={16} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="purchase-empty">Loading purchases...</div>
            ) : !purchases.length ? (
              <div className="purchase-empty">
                <PackagePlus size={34} />
                <strong>No purchases yet</strong>
                <span>Click New Purchase to record your first purchase.</span>
              </div>
            ) : (
              <div className="purchase-history-list">
                {purchases.map((purchase) => (
                  <div className="purchase-history-card" key={purchase.id}>
                    <div>
                      <strong>{purchase.purchase_no}</strong>

                      <span>
                        {purchase.purchase_date}
                        {" · "}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();

                            const supplier = suppliers.find(
                              (s) =>
                                String(s.id) === String(purchase.supplier_id),
                            );

                            if (supplier && onOpenSupplier) {
                              onOpenSupplier(supplier);
                            }
                          }}
                          style={{
                            border: "none",
                            background: "none",
                            padding: 0,
                            cursor: "pointer",
                            fontWeight: 600,
                            color: "#2563eb",
                          }}
                        >
                          {purchase.suppliers?.name || "Unknown supplier"}
                        </button>
                      </span>
                    </div>

                    <div>
                      <strong>{money(purchase.total)}</strong>

                      <span>
                        Paid {money(purchase.paid)}
                        {" · "}
                        Due {money(purchase.due)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => openDetails(purchase)}
                      aria-label="View purchase"
                    >
                      <Eye size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* =====================================================
          ADD SUPPLIER
      ===================================================== */}

      {showSupplier && (
        <div className="modal-overlay" onClick={() => setShowSupplier(false)}>
          <div
            className="modal-box purchase-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchase-modal-head">
              <div>
                <h2>Add Supplier</h2>
                <p className="muted">Supplier GSTIN is optional.</p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowSupplier(false)}
              >
                <X size={19} />
              </button>
            </div>

            <label>Name *</label>
            <input
              value={supplierForm.name}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  name: e.target.value,
                })
              }
            />

            <label>Phone</label>
            <input
              value={supplierForm.phone}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  phone: e.target.value,
                })
              }
            />

            <label>Address</label>
            <input
              value={supplierForm.address}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  address: e.target.value,
                })
              }
            />

            <label>GSTIN (optional)</label>
            <input
              value={supplierForm.gstin}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  gstin: e.target.value.toUpperCase(),
                })
              }
            />

            <label>Opening Due</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={supplierForm.openingDue}
              onChange={(e) =>
                setSupplierForm({
                  ...supplierForm,
                  openingDue: e.target.value,
                })
              }
            />

            <div className="modal-buttons">
              <button type="button" onClick={() => setShowSupplier(false)}>
                Cancel
              </button>

              <button
                type="button"
                className="save-btn"
                onClick={createSupplier}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Supplier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          PURCHASE DETAILS
      ===================================================== */}

      {selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedPurchase(null)}
        >
          <div
            className="modal-box wide-modal purchase-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchase-modal-head">
              <div>
                <h2>{selectedPurchase.purchase_no}</h2>
                <p className="muted">
                  {selectedPurchase.suppliers?.name}
                  {" · "}
                  {selectedPurchase.purchase_date}
                </p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setSelectedPurchase(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="purchase-detail-items">
              {selectedItems.map((item) => (
                <div className="detail-item" key={item.id}>
                  <div className="detail-item-main">
                    <strong className="detail-item-name">
                      {item.item_name || "Unnamed Item"}
                    </strong>

                    <span className="detail-item-meta">
                      Stock No: {item.stock_no || "-"}
                      {" · "}
                      Barcode: {item.barcode || "-"}
                    </span>
                  </div>

                  <div className="detail-item-values">
                    <div>
                      <span>Qty</span>
                      <strong>{item.qty}</strong>
                    </div>

                    <div>
                      <span>CP</span>
                      <strong>{money(item.purchase_price)}</strong>
                    </div>

                    <div>
                      <span>SP</span>
                      <strong>{money(item.selling_price)}</strong>
                    </div>

                    <div>
                      <span>MRP</span>
                      <strong>{money(item.mrp)}</strong>
                    </div>

                    <div>
                      <span>GST</span>
                      <strong>{Number(item.gst_rate || 0)}%</strong>
                    </div>

                    <div className="detail-item-total">
                      <span>Total</span>
                      <strong>
                        {money(
                          item.line_total ??
                            Number(item.qty || 0) *
                              Number(item.purchase_price || 0),
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="purchase-detail-total">
              <div>
                Total
                <strong>{money(selectedPurchase.total)}</strong>
              </div>

              <div className="purchase-return-action">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={openSupplierReturn}
                >
                  <MinusCircle size={17} />
                  Return to Supplier
                </button>
              </div>

              <div>
                Paid
                <strong>{money(selectedPurchase.paid)}</strong>
              </div>

              <div>
                Due
                <strong>{money(selectedPurchase.due)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSupplierReturn && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!returnSaving) {
              setShowSupplierReturn(false);
            }
          }}
        >
          <div
            className="modal-box wide-modal purchase-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchase-modal-head">
              <div>
                <h2>Return to Supplier</h2>

                <p className="muted">
                  {selectedPurchase?.purchase_no}
                  {" · "}
                  {selectedPurchase?.suppliers?.name || "Unknown supplier"}
                </p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  if (!returnSaving) {
                    setShowSupplierReturn(false);
                  }
                }}
                disabled={returnSaving}
              >
                <X size={19} />
              </button>
            </div>

            <div className="purchase-detail-items">
              {returnItems.map((item, index) => (
                <div className="detail-item" key={`${item.stock_id}-${index}`}>
                  <div>
                    <strong>{item.item_name}</strong>

                    <span>
                      {item.stock_no}
                      {" · Purchased "}
                      {item.purchased_qty}
                    </span>
                  </div>

                  <div>
                    <label>Return Qty</label>

                    <input
                      type="number"
                      min="0"
                      max={item.purchased_qty}
                      step="1"
                      value={item.qty}
                      onChange={(e) => updateReturnQty(index, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="purchase-note">
              <label>Reason</label>

              <input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Example: Damaged item / Wrong item"
              />
            </div>

            <div className="modal-buttons">
              <button
                type="button"
                onClick={() => setShowSupplierReturn(false)}
                disabled={returnSaving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-btn"
                onClick={saveSupplierReturn}
                disabled={returnSaving}
              >
                {returnSaving ? "Processing..." : "Confirm Supplier Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
