export default function BillItemRow({
  item,
  stock = [],
  index,
  onChange,
  onDelete,
}) {
  const availableStock = stock.filter(
  (s) => s.currentQty > 0 && s.status === "active"
);

  const selectedStock = availableStock.find(
    (s) => Number(s.id) === Number(item.stockId)
  );

  return (
    <div className="bill-row">
      <select
        value={item.stockId || ""}
        onChange={(e) => {
          const selected = availableStock.find(
            (s) => Number(s.id) === Number(e.target.value)
          );

          if (!selected) return;

          onChange(index, {
            ...item,
            stockId: selected.id,
            stockNo: selected.stockNo,
            category: selected.category,
            itemName: selected.itemName,
            price: Number(selected.sellingPrice || 0),
            qty: 1,
          });
        }}
      >
        <option value="">Select Saree</option>

        {availableStock.map((s) => (
          <option key={s.id} value={s.id}>
            {s.itemName} ({s.currentQty})
          </option>
        ))}
      </select>

      <input
        type="number"
        min="1"
        max={selectedStock?.currentQty || 1}
        value={item.qty || 1}
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

      <input
        type="number"
        value={item.price || 0}
        readOnly
      />

      <div className="bill-total">
        ₹{Number(item.qty || 0) * Number(item.price || 0)}
      </div>

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