import { useEffect, useMemo, useState } from "react";
import { activityService } from "../services/activityService";

export default function Activity() {
  const today = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    try {
      const data = await activityService.getAll();
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredActivities = useMemo(() => {
    return logs.filter((log) => {
      return log.created_at?.split("T")[0] === selectedDate;
    });
  }, [logs, selectedDate]);

  return (
    <main className="content">
      <h1>Activity Log</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        {selectedDate !== today && (
          <button
            className="filter-chip"
            onClick={() => setSelectedDate(today)}
          >
            Today
          </button>
        )}
      </div>

      <div className="table-card">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredActivities.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No activity yet.
                </td>
              </tr>
            ) : (
              filteredActivities.map((log) => (
                <tr key={log.id}>
                  <td>
                    {new Date(log.created_at).toLocaleDateString("en-IN")} •{" "}
                    {new Date(log.created_at).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>

                  <td>{log.username}</td>

                  <td>{log.role}</td>

                  <td>{log.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}