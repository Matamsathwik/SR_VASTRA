import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Billing from "./pages/Billing";
import Bills from "./pages/Bills";
import Returns from "./pages/Returns";
import Stock from "./pages/Stock";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import StaffManagement from "./pages/StaffManagement";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";

import { authService } from "./services/authService";

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.currentUser().then(setUser);
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isOwner =
    user?.role?.toLowerCase() === "owner";

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        user={user}
        setUser={setUser}
      />

      {page === "Dashboard" && (
        <Dashboard user={user} />
      )}

      {page === "Customers" && <Customers />}

      {page === "Billing" && (
        <Billing user={user} />
      )}

      {page === "Bills" && <Bills />}

      {page === "Returns" && <Returns />}

      {page === "Stock" && <Stock />}

      {page === "Reports" && isOwner && (
        <Reports />
      )}

      {page === "Staff" && isOwner && (
        <StaffManagement />
      )}

      {page === "Activity" && isOwner && (
        <Activity />
      )}

      {page === "Settings" && (
        <Settings user={user} />
      )}
    </div>
  );
}