import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  exportBackup,
  importBackup,
  getCustomers,
} from "../data/storage";
import { customerService } from "../services/customerService";

export default function Settings({ user }) {
  const isOwner = user?.role?.toLowerCase() === "owner";

  // My password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Staff reset (Owner only)
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffConfirmPassword, setStaffConfirmPassword] = useState("");

  useEffect(() => {
    if (!isOwner) return;

    const loadStaff = async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, username, role")
        .eq("active", true)
        .neq("role", "owner")
        .order("username");

      if (!error) setStaffList(data || []);
    };

    loadStaff();
  }, [isOwner]);
  console.log("Settings user:", user);
console.log("Role:", user?.role);
console.log("isOwner:", isOwner);
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
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

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

    // Edge Function will be connected next
    alert("Staff Password Reset UI is ready. We'll connect the secure Supabase Admin API next.");

    setSelectedStaff("");
    setStaffPassword("");
    setStaffConfirmPassword("");
  };

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
        console.log("Skipped:", customer.name, err.message);
      }
    }

    alert(`Upload completed.\n${uploaded} customers uploaded.`);
  };

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

      {/* Owner Only */}
      {isOwner && (
        <div className="customer-card">
          <h2>Backup & Restore</h2>

          <p style={{ marginBottom: 20 }}>
            Export local data or upload customers to Supabase.
          </p>

          <button className="save-btn" onClick={exportBackup}>
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

      {/* Everyone */}
      <div className="customer-card" style={{ marginTop: 24 }}>
        <h2>Security</h2>

        <div className="customer-form">
          <div>
            <label>New Password</label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label>Confirm Password</label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Updating..." : "🔒 Change My Password"}
        </button>
      </div>

      {/* Owner Only */}
      {isOwner && (
        <div className="customer-card" style={{ marginTop: 24 }}>
          <h2>Staff Password Reset</h2>

          <p style={{ marginBottom: 16 }}>
            Reset password for any staff member.
          </p>

          <div className="customer-form">
            <div>
              <label>Select Staff</label>

              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
              >
                <option value="">Select Staff</option>

                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
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
                onChange={(e) => setStaffPassword(e.target.value)}
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
          >
            🔑 Reset Staff Password
          </button>
        </div>
      )}
    </main>
  );
}