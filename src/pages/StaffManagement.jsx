import { useEffect, useState } from "react";
import { staffService } from "../services/staffService";

export default function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const loadStaff = async () => {
    try {
      const data = await staffService.getStaff();
      setUsers(data);
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const addStaff = async () => {
    if (!form.username || !form.email || !form.password) {
      alert("Fill all fields.");
      return;
    }

    try {
      setLoading(true);

      await staffService.createStaff({
        username: form.username,
        email: form.email,
        password: form.password,
        role: "staff",
      });

      setForm({
        username: "",
        email: "",
        password: "",
      });

      await loadStaff();

      alert("Staff created successfully.");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = async (u) => {
    try {
      await staffService.toggleStaff(u.id, !u.active);
      await loadStaff();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <main className="content">
      <h1>Staff Management</h1>

      <div className="customer-card">
        <h2>Add Staff</h2>

        <div className="customer-form">
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({ ...form, username: e.target.value })
            }
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />
        </div>

        <button
          className="save-btn"
          style={{ marginTop: 18 }}
          onClick={addStaff}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Staff"}
        </button>
      </div>

      <div className="table-card">
        <h2>Staff List</h2>

        <table className="customer-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
  {users.filter((u) => u.role === "staff").length === 0 ? (
    <tr>
      <td
        colSpan="4"
        style={{ textAlign: "center" }}
      >
        No staff members yet.
      </td>
    </tr>
  ) : (
    users
      .filter((u) => u.role === "staff")
      .map((u) => (
        <tr key={u.id}>
          <td>{u.username}</td>

          <td>Staff</td>

          <td>
            {u.active ? "Active" : "Disabled"}
          </td>

          <td>
            <button
              className="action-btn edit"
              onClick={() => toggleUser(u)}
            >
              {u.active ? "Disable" : "Enable"}
            </button>
          </td>
        </tr>
      ))
  )}
</tbody>
        </table>
      </div>
    </main>
  );
}