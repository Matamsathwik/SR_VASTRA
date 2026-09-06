import { useEffect, useRef, useState } from "react";

export default function BillItemRow({
  item,
  stock = [],
  index,
  onChange,
  onDelete,
}) {
  const [itemSearch, setItemSearch] = useState("");
  const [showItemList, setShowItemList] = useState(false);
  const itemSearchRef = useRef(null);

  const availableStock = stock.filter(
    (s) => s.currentQty > 0 && s.status === "active"
  );
  useEffect(() => {
  const handleClickOutside = (event) => {
    if (
      itemSearchRef.current &&
      !itemSearchRef.current.contains(event.target)
    ) {
      setShowItemList(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener(
      "mousedown",
      handleClickOutside
    );
  };
}, []);
  const selectedStock = availableStock.find(
    (s) => Number(s.id) === Number(item.stockId)
  );

  const filteredStock = availableStock.filter((s) => {
    const search = itemSearch.toLowerCase();

    return (
      s.itemName?.toLowerCase().includes(search) ||
      s.category?.toLowerCase().includes(search) ||
      String(s.stockNo || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="bill-row">
      {/* ITEM SEARCH */}
      <div
  ref={itemSearchRef}
  className="search-wrap"
>
        <input
          type="text"
          placeholder="Search item..."
          value={itemSearch}
          onChange={(e) => {
            setItemSearch(e.target.value);
            setShowItemList(true);

            if (item.stockId) {
              onChange(index, {
                ...item,
                stockId: "",
                stockNo: "",
                itemName: "",
                category: "",
                price: 0,
                qty: 1,
              });
            }
          }}
          onFocus={() => setShowItemList(true)}
        />

        {showItemList && (
          <div className="search-dropdown">
            {filteredStock.length > 0 ? (
              filteredStock.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className="search-option"
                  onClick={() => {
                    onChange(index, {
                      ...item,
                      stockId: s.id,
                      stockNo: s.stockNo,
                      category: s.category,
                      itemName: s.itemName,
                      price: Number(s.sellingPrice || 0),
                      qty: 1,
                    });

                    setItemSearch(
                      `${s.itemName} (${s.currentQty})`
                    );

                    setShowItemList(false);
                  }}
                >
                  <strong>{s.itemName}</strong>
                  <span>
                    {" "}
                    ({s.currentQty}){" "}
                  </span>
                  <small>
                    {s.category} • Stock #{s.stockNo}
                  </small>
                </button>
              ))
            ) : (
              <div className="search-empty">
                No items found
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUANTITY */}
      <input
        type="number"
        min="1"
        max={selectedStock?.currentQty || 1}
        value={item.qty}
        disabled={!item.stockId}
        onChange={(e) => {
          const qty = Number(e.target.value);

          if (
            selectedStock &&
            qty > Number(selectedStock.currentQty)
          ) {
            return;
          }

          onChange(index, {
            ...item,
            qty,
          });
        }}
      />

      {/* PRICE */}
      <input
        type="number"
        value={item.price || 0}
        readOnly
      />

      {/* TOTAL */}
      <div className="bill-total">
        ₹{Number(item.qty || 0) * Number(item.price || 0)}
      </div>

      {/* DELETE */}
      <button
        type="button"
        className="delete-btn"
        onClick={() => onDelete(index)}
      >
        ✕
      </button>
    </div>
  );
}