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
import Purchases from "./pages/Purchases";

import { authService } from "./services/authService";

const pageRoutes = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/billing": "Billing",
  "/bills": "Bills",
  "/returns": "Returns",
  "/stock": "Stock",
  "/purchases": "Purchases",
  "/reports": "Reports",
  "/activity": "Activity",
  "/staff": "Staff",
  "/settings": "Settings",
};

const pagePaths = {
  Dashboard: "/dashboard",
  Customers: "/customers",
  Billing: "/billing",
  Bills: "/bills",
  Returns: "/returns",
  Stock: "/stock",
  Purchases: "/purchases",
  Reports: "/reports",
  Activity: "/activity",
  Staff: "/staff",
  Settings: "/settings",
};

const staffRestrictedPages = [
  "Stock",
  "Purchases",
  "Reports",
  "Activity",
  "Staff",
];

export default function App() {
  const [page, setPage] = useState(() => {
    return pageRoutes[window.location.pathname] || "Dashboard";
  });

  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.currentUser().then(setUser);

    const handlePopState = () => {
      const requestedPage =
        pageRoutes[window.location.pathname] || "Dashboard";

      setPage(requestedPage);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const isOwner =
    user?.role?.toLowerCase() === "owner";

  const navigate = (nextPage) => {
    const path = pagePaths[nextPage] || "/dashboard";

    // Staff cannot access restricted pages
    if (
      user?.role?.toLowerCase() !== "owner" &&
      staffRestrictedPages.includes(nextPage)
    ) {
      setPage("Dashboard");

      if (window.location.pathname !== "/dashboard") {
        window.history.pushState({}, "", "/dashboard");
      }

      return;
    }

    setPage(nextPage);

    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  };

  // If staff directly opens a restricted URL
  useEffect(() => {
    if (!user) return;

    const currentPage =
      pageRoutes[window.location.pathname];

    if (
      user?.role?.toLowerCase() !== "owner" &&
      staffRestrictedPages.includes(currentPage)
    ) {
      setPage("Dashboard");
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [user]);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={navigate}
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

      {page === "Stock" && isOwner && <Stock />}

      {page === "Purchases" && isOwner && (
        <Purchases />
      )}

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