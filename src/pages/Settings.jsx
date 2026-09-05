import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  exportBackup,
  importBackup,
  getCustomers,
} from "../data/storage";
import { customerService } from "../services/customerService";
import { staffService } from "../services/staffService";

export default function Settings({ user }) {
  const isOwner = user?.role?.toLowerCase() === "owner";

  // ==================== MY PASSWORD ====================

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ==================== STAFF PASSWORD RESET ====================

  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffConfirmPassword, setStaffConfirmPassword] = useState("");
  const [staffResetLoading, setStaffResetLoading] = useState(false);

  // ==================== LOAD ACTIVE STAFF ====================

  useEffect(() => {
    if (!isOwner) return;

    const loadStaff = async () => {
      try {
        const { data, error } = await supabase
          .from("staff")
          .select("id, username, role")
          .eq("active", true)
          .neq("role", "owner")
          .order("username");

        if (error) throw error;

        setStaffList(data || []);
      } catch (err) {
        console.error("Staff Load Error:", err);
        alert(err.message || "Failed to load staff.");
      }
    };

    loadStaff();
  }, [isOwner]);

  // ==================== CHANGE MY PASSWORD ====================

  const changePassword = async () => {
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      alert("Password updated successfully.");

      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Change Password Error:", err);
      alert(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== RESET STAFF PASSWORD ====================

  const resetStaffPassword = async () => {
  if (!selectedStaff) {
    alert("Select a staff member.");
    return;
  }

  if (staffPassword.length < 6) {
    alert("Password must be at least 6 characters.");
    return;
  }

  if (staffPassword !== staffConfirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  const selectedUser = staffList.find(
    (staff) => staff.id === selectedStaff
  );

  if (!selectedUser) {
    alert("Staff member not found.");
    return;
  }

  const confirmed = window.confirm(
    `Reset password for ${selectedUser.username}?`
  );

  if (!confirmed) {
    return;
  }

  try {
    setLoading(true);

    await staffService.resetStaffPassword(
      selectedStaff,
      staffPassword
    );

    alert("Staff password updated successfully.");

    setSelectedStaff("");
    setStaffPassword("");
    setStaffConfirmPassword("");
  } catch (err) {
    console.error("Staff password reset error:", err);

    alert(
      err?.message ||
        "Failed to reset staff password."
    );
  } finally {
    setLoading(false);
  }
};

  // ==================== IMPORT CUSTOMERS ====================

  const importCustomers = async () => {
    const customers = getCustomers();

    if (customers.length === 0) {
      alert("No local customers found.");
      return;
    }

    let uploaded = 0;

    for (const customer of customers) {
      try {
        await customerService.create(customer);
        uploaded++;
      } catch (err) {
        console.log(
          "Skipped:",
          customer.name,
          err.message
        );
      }
    }

    alert(
      `Upload completed.\n${uploaded} customers uploaded.`
    );
  };

  // ==================== RESTORE BACKUP ====================

  const restore = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);

        if (
          !window.confirm(
            "Restore backup? Current data will be replaced."
          )
        ) {
          return;
        }

        importBackup(backup);

        alert("Backup restored. Refresh the app.");
      } catch {
        alert("Invalid backup file.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <main className="content">
      <h1>Settings</h1>

      {/* ==================== OWNER: BACKUP ==================== */}

      {isOwner && (
        <div className="customer-card">
          <h2>Backup & Restore</h2>

          <p style={{ marginBottom: 20 }}>
            Export local data or upload customers to Supabase.
          </p>

          <button
            className="save-btn"
            onClick={exportBackup}
          >
            📤 Export Backup
          </button>

          <button
            className="save-btn"
            style={{ marginTop: 16 }}
            onClick={importCustomers}
          >
            ☁️ Upload Customers to Cloud
          </button>

          <div style={{ marginTop: 20 }}>
            <label
              className="save-btn"
              style={{
                display: "inline-block",
                cursor: "pointer",
              }}
            >
              📥 Restore Backup

              <input
                type="file"
                accept=".json"
                hidden
                onChange={restore}
              />
            </label>
          </div>
        </div>
      )}

      {/* ==================== MY PASSWORD ==================== */}

      <div
        className="customer-card"
        style={{ marginTop: 24 }}
      >
        <h2>Security</h2>

        <div className="customer-form">
          <div>
            <label>New Password</label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)
              }
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label>Confirm Password</label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Confirm password"
            />
          </div>
        </div>

        <button
          className="save-btn"
          onClick={changePassword}
          disabled={loading}
          style={{ marginTop: 16 }}
        >
          {loading
            ? "Updating..."
            : "🔒 Change My Password"}
        </button>
      </div>

      {/* ==================== OWNER: STAFF PASSWORD RESET ==================== */}

      {isOwner && (
        <div
          className="customer-card"
          style={{ marginTop: 24 }}
        >
          <h2>Staff Password Reset</h2>

          <p style={{ marginBottom: 16 }}>
            Reset password for any active staff member.
          </p>

          <div className="customer-form">
            <div>
              <label>Select Staff</label>

              <select
                value={selectedStaff}
                onChange={(e) =>
                  setSelectedStaff(e.target.value)
                }
              >
                <option value="">
                  Select Staff
                </option>

                {staffList.map((staff) => (
                  <option
                    key={staff.id}
                    value={staff.id}
                  >
                    {staff.username}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>New Password</label>

              <input
                type="password"
                value={staffPassword}
                onChange={(e) =>
                  setStaffPassword(e.target.value)
                }
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label>Confirm Password</label>

              <input
                type="password"
                value={staffConfirmPassword}
                onChange={(e) =>
                  setStaffConfirmPassword(e.target.value)
                }
                placeholder="Confirm password"
              />
            </div>
          </div>

          <button
  className="save-btn"
  style={{ marginTop: 16 }}
  onClick={resetStaffPassword}
  disabled={loading}
>
  {loading ? "Resetting..." : "🔑 Reset Staff Password"}
</button>
        </div>
      )}
    </main>
  );
}