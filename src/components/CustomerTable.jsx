export default function CustomerTable({
  customers,
  onSelect,
  onEdit,
  onDelete
}) {
  return (
    <div className="table-card">
      <h2>Customer List</h2>

      <table className="customer-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              style={{ cursor: "pointer" }}
            >
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.phone || "-"}</td>

              <td onClick={(e) => e.stopPropagation()}>
                <button
                  className="action-btn edit"
                  onClick={() => onEdit(c)}
                >
                  Edit
                </button>

                <button
                  className="action-btn delete"
                  onClick={() => onDelete(c)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}