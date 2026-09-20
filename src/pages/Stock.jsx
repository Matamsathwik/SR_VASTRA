import { useEffect, useState } from "react";
import { getStock, saveStock } from "../data/storage";
import { stockService } from "../services/stockService";
import { activityService } from "../services/activityService";
import { authService } from "../services/authService";
import { supplierService } from "../services/supplierService";
import { generateBarcode } from "../utils/barcode";
import { printStockLabel } from "../utils/stockLabel";

const makeBarcode = () => {
  const time = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);

  return `${time}${random}`;
};

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

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [stockPage, setStockPage] = useState(1);
  const STOCK_PER_PAGE = 10;

  const [adjustment, setAdjustment] = useState({
    type: "Return to Supplier",
    quantity: "",
  });

  const [form, setForm] = useState({
    supplier: "",
    category: "",
    itemName: "",
    barcode: "",
    hsnCode: "",
    gstRate: 0,
    gstInclusive: true,
    mrp: "",
    purchasePrice: "",
    sellingPrice: "",
    totalQty: "",
  });

  useEffect(() => {
    loadStock();
    loadSuppliers();
  }, []);

  const loadStock = async () => {
    try {
      const data = await stockService.getAll();

      const Data = [...data].sort(
        (a, b) => Number(b.id) - Number(a.id)
      );

      setStock(Data);
      saveStock(Data);
    } catch (err) {
      console.error(err);

      const cachedStock = getStock();

      const CachedStock = [...cachedStock].sort(
        (a, b) => Number(b.id) - Number(a.id)
    );

      setStock(CachedStock);
    }
  }

  const loadSuppliers = async () => {
    try {
      const data = await supplierService.getAll();
      setSuppliers(data || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    }
  };

  // -----------------------------
  // ADD STOCK
  // -----------------------------

  const saveItem = async () => {
    if (
  !form.supplier ||
  !form.category ||
  !form.itemName ||
  !form.purchasePrice ||
  !form.sellingPrice ||
  !form.totalQty
) {
      alert("Please fill all fields.");
      return;
    }

    if (Number(form.totalQty) <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }

    const item = {
      
      supplier: form.supplier,
      category: form.category,
      itemName: form.itemName,
      barcode: generateBarcode(),

      hsnCode: form.hsnCode.trim() || null,
      gstRate: Number(form.gstRate || 0),
      gstInclusive: form.gstInclusive !== false,
      mrp: Number(form.mrp || 0),

      purchasePrice: Number(form.purchasePrice),
      sellingPrice: Number(form.sellingPrice),
      totalQty: Number(form.totalQty),
      currentQty: Number(form.totalQty),
    };

    try {
      setLoading(true);

      await stockService.create(item);
      await loadStock();

      const user = await authService.currentUser();

      await activityService.add({
        username: user.username,
        role: user.role,
        action: `Added Stock: ${item.itemName} (${item.totalQty})`,
      });

      setForm({
        supplier: "",
        category: "",
        itemName: "",
        barcode: "",
        hsnCode: "",
        gstRate: 0,
        gstInclusive: true,
        mrp: "",
        purchasePrice: "",
        sellingPrice: "",
        totalQty: "",
      });

      alert("Stock added successfully.");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // EDIT STOCK
  // -----------------------------

  const saveEdit = async () => {
    try {
      await stockService.update(editItem.id, editItem);
      await loadStock();

      const user = await authService.currentUser();

      await activityService.add({
        username: user.username,
        role: user.role,
        action: `Updated Stock: ${editItem.itemName}`,
      });

      setEditItem(null);

      alert("Stock updated successfully.");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // -----------------------------
  // STOCK ADJUSTMENT
  // -----------------------------

  const openAdjustment = (item) => {
    setAdjustItem(item);

    setAdjustment({
      type: "Return to Supplier",
      quantity: "",
    });
  };

  const submitAdjustment = async () => {
  if (!adjustment.quantity || Number(adjustment.quantity) <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  if (Number(adjustment.quantity) > adjustItem.currentQty) {
    alert(
      `Quantity cannot exceed available stock (${adjustItem.currentQty}).`
    );
    return;
  }

  try {
    setLoading(true);

    await stockService.adjustStock(
      adjustItem.id,
      Number(adjustment.quantity),
      adjustment.type
    );

    setAdjustItem(null);

    setAdjustment({
      type: "Return to Supplier",
      quantity: "",
    });

    await loadStock();

    alert("Stock adjustment saved successfully.");
  } catch (err) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
};

  // -----------------------------
  // FILTER
  // -----------------------------

  const filteredStock = stock.filter(
    (item) =>
      Number(item.currentQty || 0) > 0 &&
        `${item.stockNo} ${item.itemName} ${item.supplier} ${item.category}`
          .toLowerCase()
          .includes(search.toLowerCase())    
  );

const stockTotalPages = Math.max(
  1,
  Math.ceil(filteredStock.length / STOCK_PER_PAGE)
);

const paginatedStock = filteredStock.slice(
  (stockPage - 1) * STOCK_PER_PAGE,
  stockPage * STOCK_PER_PAGE
);

  // -----------------------------
  // STATUS
  // -----------------------------

  const getStatus = (item) => {
    if (item.currentQty === 0) {
      return "Out of Stock";
    }

    if (item.currentQty <= 3) {
      return "Low Stock";
    }

    return "In Stock";
  };

  return (
    <main className="content">
      <h1>Stock</h1>

      {/* =========================
          DASHBOARD CARDS
      ========================== */}

      <div className="cards">
        <div className="card">
          <h3>{stock.length}</h3>
          <p>Total Items</p>
        </div>

        <div className="card">
          <h3>
            ₹
            {stock.reduce(
              (sum, item) =>
                sum +
                Number(item.currentQty || 0) *
                  Number(item.purchasePrice || 0),
              0
            )}
          </h3>
          <p>Stock Value</p>
        </div>

        <div className="card">
          <h3>
            {stock.filter(
              (item) =>
                item.currentQty > 0 && item.currentQty <= 3
            ).length}
          </h3>
          <p>Low Stock</p>
        </div>
      </div>

      {/* =========================
          ADD STOCK
      ========================== */}

      <div className="customer-card">
        <h2>Add Stock</h2>

        <div className="customer-form">
          <select
  value={form.supplier}
  onChange={(e) =>
    setForm({
      ...form,
      supplier: e.target.value,
    })
  }
>
  <option value="">Select Supplier</option>

  {suppliers.map((supplier) => (
    <option key={supplier.id} value={supplier.name}>
      {supplier.name}
    </option>
  ))}
</select>

          <select
  value={form.category}
  onChange={(e) =>
    setForm({
      ...form,
      category: e.target.value,
    })
  }
>
  <option value="" disabled>
    Select Category
  </option>

  {categories.map((category) => (
    <option key={category} value={category}>
      {category}
    </option>
  ))}
</select>

          <input
          
            placeholder="Item Name"
            value={form.itemName}
            onChange={(e) =>
              setForm({
                ...form,
                itemName: e.target.value,
              })
            }
          />
          <div
  style={{
    display: "flex",
    alignItems: "center",
    minHeight: "52px",
    padding: "0 16px",
    border: "1px solid #ead8b8",
    borderRadius: "12px",
    background: "#fafafa",
    color: "#666",
  }}
>
  Barcode will be generated automatically
</div>

          <input
            placeholder="HSN Code (optional)"
            value={form.hsnCode}
            onChange={(e) =>
              setForm({
                ...form,
                hsnCode: e.target.value,
              })
            }
          />

          <input
            type="number"
            min="0"
            max="100"
            placeholder="GST Rate %"
            value={form.gstRate}
            onChange={(e) =>
              setForm({
              ...form,
              gstRate: e.target.value,
              })
            }
          />

          <select
          value={form.gstInclusive ? "inclusive" : "exclusive"}
          onChange={(e) =>
            setForm({
            ...form,
            gstInclusive: e.target.value === "inclusive",
            })
          }
          >
        <option value="inclusive">GST Inclusive</option>
        <option value="exclusive">GST Exclusive</option>
        </select>

          <input
            type="number"
            min="0"
            placeholder="MRP"
            value={form.mrp}
            onChange={(e) =>
              setForm({
              ...form,
              mrp: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Purchase Price"
            value={form.purchasePrice}
            onChange={(e) =>
              setForm({
                ...form,
                purchasePrice: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Selling Price"
            value={form.sellingPrice}
            onChange={(e) =>
              setForm({
                ...form,
                sellingPrice: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Total Quantity"
            value={form.totalQty}
            onChange={(e) =>
              setForm({
                ...form,
                totalQty: e.target.value,
              })
            }
          />
        </div>

        <button
          className="save-btn"
          style={{ marginTop: 20 }}
          onClick={saveItem}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Stock"}
        </button>
      </div>

      {/* =========================
          STOCK LIST
      ========================== */}

      <div className="table-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
            gap: "20px",
          }}
        >
          <h2>Stock List</h2>

          <input
            placeholder="Search stock..."
            value={search}
            onChange={(e) => {
  setSearch(e.target.value);
  setStockPage(1);
}}
            style={{ width: "240px" }}
          />
        </div>

        <table className="customer-table">
          <thead>
            <tr>
              <th>Stock No</th>
              <th>Barcode</th>
              <th>Item</th>
              <th>Category</th>
              <th>Total Qty</th>
              <th>Available</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredStock.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  style={{ textAlign: "center" }}
                >
                  No stock found.
                </td>
              </tr>
            ) : (
              paginatedStock.map((item) => (
                <tr key={item.id}>
                <td>
                  <strong>{item.stockNo || "-"}</strong>
                </td>

                <td>
                  <strong>{item.barcode || "-"}</strong>
                </td>

                <td>
                  <strong>{item.itemName}</strong>
                </td>

                  <td>{item.category}</td>

                  <td>{item.totalQty}</td>

                  <td>
                    <strong>{item.currentQty}</strong>
                  </td>

                  <td>
                    <strong
                      style={{
                        color:
                          item.currentQty === 0
                            ? "#C0392B"
                            : item.currentQty <= 3
                            ? "#D97706"
                            : "#0F766E",
                      }}
                    >
                      {getStatus(item)}
                    </strong>
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="action-btn edit"
                        onClick={() => setViewItem(item)}
                      >
                        View
                      </button>

                      <button
                        className="action-btn edit"
                        onClick={() =>
                          setEditItem({ ...item })
                        }
                      >
                        Edit
                      </button>

                      <button
                        className="action-btn edit"
                        disabled={item.currentQty === 0}
                        onClick={() =>
                          openAdjustment(item)
                        }
                      >
                        Adjust Stock
                      </button>
                      <button
  className="action-btn edit"
  onClick={() => {
    const copies = Number(
      prompt(
        `How many labels do you want to print?\nAvailable quantity: ${item.currentQty}`,
        item.currentQty
      )
    );

    if (
      Number.isInteger(copies) &&
      copies > 0 &&
      copies <= item.currentQty
    ) {
      printStockLabel(item, copies);
    } else if (copies > item.currentQty) {
      alert(
        `You only have ${item.currentQty} pieces available.`
      );
    }
  }}
>
  Print Label
</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "20px",
  }}
>
  <button
    className="small-btn"
    disabled={stockPage === 1}
    onClick={() =>
      setStockPage((page) => Math.max(1, page - 1))
    }
  >
    Previous
  </button>

  {Array.from(
    { length: stockTotalPages },
    (_, index) => index + 1
  ).map((page) => (
    <button
      key={page}
      className="small-btn"
      onClick={() => setStockPage(page)}
      style={{
        fontWeight: stockPage === page ? "700" : "400",
      }}
    >
      {page}
    </button>
  ))}

  <button
    className="small-btn"
    disabled={stockPage === stockTotalPages}
    onClick={() =>
      setStockPage((page) =>
        Math.min(stockTotalPages, page + 1)
      )
    }
  >
    Next
  </button>
</div>
      </div>

      {/* =========================
          VIEW MODAL
      ========================== */}

      {viewItem && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>{viewItem.itemName}</h2>

            <div className="invoice-box">
              

              <div className="invoice-row">
                <span>Stock No</span>
                <strong>{viewItem.stockNo || "-"}</strong>
              </div>

              <div className="invoice-row">
                <span>Supplier</span>
                <strong>{viewItem.supplier || "-"}</strong>
              </div>

              <div className="invoice-row">
                <span>Category</span>
                <strong>{viewItem.category}</strong>
              </div>

              <div className="invoice-row">
                <span>Purchase Price</span>
                <strong>₹{viewItem.purchasePrice}</strong>
              </div>

              <div className="invoice-row">
                <span>Selling Price</span>
                <strong>₹{viewItem.sellingPrice}</strong>
              </div>

              <div className="invoice-row">
                <span>Total Quantity</span>
                <strong>{viewItem.totalQty}</strong>
              </div>

              <div className="invoice-row">
                <span>Available Quantity</span>
                <strong>{viewItem.currentQty}</strong>
              </div>

              <div className="invoice-row">
                <span>Returned to Supplier</span>
                <strong>{viewItem.returnedQty || 0}</strong>
              </div>

              <div className="invoice-row">
                <span>Status</span>
                <strong>{getStatus(viewItem)}</strong>
              </div>

             

              <div className="invoice-row">
                <span>Purchase Date</span>
                <strong>
                  {viewItem.purchaseDate || "-"}
                </strong>
              </div>
            </div>

            <button
              className="save-btn"
              style={{ width: "100%", marginTop: 15 }}
              onClick={() => setViewItem(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =========================
          EDIT MODAL
      ========================== */}

      {editItem && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2>Edit Stock</h2>

            <p
              style={{
                marginTop: -5,
                marginBottom: 20,
                color: "#666",
              }}
            >
              Product information can be edited here.
              Use Adjust Stock for quantity changes.
            </p>

            <input
              placeholder="Item Name"
              value={editItem.itemName}
              onChange={(e) =>
                setEditItem({
                  ...editItem,
                  itemName: e.target.value,
                })
              }
            />

            <input
              placeholder="Supplier"
              value={editItem.supplier}
              onChange={(e) =>
                setEditItem({
                  ...editItem,
                  supplier: e.target.value,
                })
              }
            />

            <select
              value={editItem.category}
              onChange={(e) =>
                setEditItem({
                  ...editItem,
                  category: e.target.value,
                })
              }
            >
              {categories.map((category) => (
                <option key={category}>
                  {category}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Purchase Price"
              value={editItem.purchasePrice}
              onChange={(e) =>
                setEditItem({
                  ...editItem,
                  purchasePrice: Number(
                    e.target.value
                  ),
                })
              }
            />

            <input
              type="number"
              placeholder="Selling Price"
              value={editItem.sellingPrice}
              onChange={(e) =>
                setEditItem({
                  ...editItem,
                  sellingPrice: Number(
                    e.target.value
                  ),
                })
              }
            />

            <div className="modal-buttons">
              <button
                className="save-btn"
                onClick={saveEdit}
              >
                Save
              </button>

              <button
                className="print-btn"
                onClick={() => setEditItem(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================
    ADJUST STOCK MODAL
========================== */}

{adjustItem && (
  <div className="modal-overlay">
    <div
      className="modal-box"
      style={{
        maxWidth: "520px",
        width: "90%",
        padding: "22px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <h2 style={{ margin: "0 0 12px" }}>
        Stock Adjustment
      </h2>

      {/* STOCK INFORMATION */}

      <div
        className="invoice-box"
        style={{
          marginBottom: 12,
          padding: "4px 12px",
        }}
      >
        <div className="invoice-row">
          <span>Supplier</span>
          <strong>
            {adjustItem.supplier || "-"}
          </strong>
        </div>

        <div className="invoice-row">
          <span>Category</span>
          <strong>
            {adjustItem.category}
          </strong>
        </div>

        <div className="invoice-row">
          <span>Item</span>
          <strong>
            {adjustItem.itemName}
          </strong>
        </div>

        <div className="invoice-row">
          <span>Total Quantity</span>
          <strong>
            {adjustItem.totalQty}
          </strong>
        </div>

        <div className="invoice-row">
          <span>Available Quantity</span>
          <strong>
            {adjustItem.currentQty}
          </strong>
        </div>
      </div>

      {/* ADJUSTMENT TYPE */}

      <label
        style={{
          display: "block",
          fontWeight: 600,
          marginBottom: 5,
          fontSize: 14,
        }}
      >
        Adjustment Type
      </label>

      <select
        value={adjustment.type}
        onChange={(e) =>
          setAdjustment({
            ...adjustment,
            type: e.target.value,
          })
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <option>Return to Supplier</option>
        <option>Damaged</option>
        <option>Not Needed</option>
        <option>Other</option>
      </select>

      {/* QUANTITY */}

      <label
        style={{
          display: "block",
          fontWeight: 600,
          marginTop: 10,
          marginBottom: 5,
          fontSize: 14,
        }}
      >
        Quantity to Adjust
      </label>

      <input
        type="number"
        min="1"
        max={adjustItem.currentQty}
        placeholder={`Maximum ${adjustItem.currentQty}`}
        value={adjustment.quantity}
        onChange={(e) =>
          setAdjustment({
            ...adjustment,
            quantity: e.target.value,
          })
        }
        style={{
          width: "100%",
          boxSizing: "border-box",
        }}
      />

      {/* PREVIEW */}

      {Number(adjustment.quantity) > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "9px 12px",
            borderRadius: 10,
            background: "#faf5e8",
            fontSize: 14,
          }}
        >
          <strong>
            Available after adjustment:
          </strong>{" "}
          {Math.max(
            0,
            adjustItem.currentQty -
              Number(adjustment.quantity)
          )}{" "}
          pieces
        </div>
      )}

      {/* BUTTONS */}

      <div
        className="modal-buttons"
        style={{
          marginTop: 12,
          gap: 8,
        }}
      >
        <button
          className="save-btn"
          onClick={submitAdjustment}
          disabled={loading}
        >
          {loading
            ? "Saving..."
            : "Confirm Adjustment"}
        </button>

        <button
          className="print-btn"
          onClick={() => setAdjustItem(null)}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}