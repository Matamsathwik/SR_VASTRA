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
      setUsers(data || []);
    } catch (err) {
      console.error("Load Staff Error:", err);
      alert(err.message || "Failed to load staff.");
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // ==================== CREATE STAFF ====================

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
      
      });

      setForm({
        username: "",
        email: "",
        password: "",
      });

      await loadStaff();

      alert("Staff created successfully.");
    } catch (err) {
      console.error("Create Staff Error:", err);
      alert(err.message || "Failed to create staff.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== DISABLE STAFF ====================

  const removeStaff = async (user) => {
  const confirmed = window.confirm(
    `Remove Staff?\n\n` +
      `Are you sure you want to remove this staff: ${user.username}?\n\n` +
      `Their billing login will be deleted and they will no longer be able to access the system.`
  );

  if (!confirmed) {
    return;
  }

  try {
    setLoading(true);

    await staffService.removeStaff(user.id);

    await loadStaff();

    alert("Staff removed successfully.");
  } catch (err) {
    console.error("Remove Staff Error:", err);
    alert(
      err.message ||
        "Staff could not be removed."
    );
  } finally {
    setLoading(false);
  }
};
  // Only active staff should appear in this list.
  const activeStaff = users.filter(
    (user) => user.role === "staff" && user.active === true
  );

  return (
    <main className="content">
      <h1>Staff Management</h1>

      {/* ==================== ADD STAFF ==================== */}

      <div className="customer-card">
        <h2>Add Staff</h2>

        <div className="customer-form">
          <input
            placeholder="Username"
            value={form.username}
            onChange={(e) =>
              setForm({
                ...form,
                username: e.target.value,
              })
            }
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
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

      {/* ==================== ACTIVE STAFF LIST ==================== */}

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
            {activeStaff.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  style={{ textAlign: "center" }}
                >
                  No active staff members.
                </td>
              </tr>
            ) : (
              activeStaff.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>

                  <td>Staff</td>

                  <td>Active</td>

                  <td>
                    <button
                      className="action-btn edit"
                      onClick={() => removeStaff(user)}
                      disabled={loading}
                    >
                      Remove
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