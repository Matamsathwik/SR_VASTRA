import {
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  RotateCcw,
  Package,
  ShoppingCart,
  BarChart3,
  LogOut,
  History,
  Settings,
} from "lucide-react";

import { UserCog } from "lucide-react";
import { authService } from "../services/authService";

export default function Sidebar({
  page,
  setPage,
  user,
  setUser,
}) {
  const menus = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Customers", icon: Users },
    { name: "Billing", icon: Receipt },
    { name: "Bills", icon: FileText },
    { name: "Returns", icon: RotateCcw },

    // Owner-only menus
    ...(user?.role?.toLowerCase() === "owner"
      ? [
          { name: "Stock", icon: Package },
          { name: "Purchases", icon: ShoppingCart },
          { name: "Reports", icon: BarChart3 },
          { name: "Staff", icon: UserCog },
          { name: "Activity", icon: History },
        ]
      : []),

    // Everyone gets Settings
    { name: "Settings", icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="logo-section">
        <img src="/logo.png" alt="SR Vastra" className="logo" />
        <h2>SR Vastra</h2>
        <p>Billing</p>

        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            borderRadius: "12px",
            background: "rgba(255,255,255,.08)",
            textAlign: "center",
          }}
        >
          <strong>{user?.username}</strong>
          <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
            {user?.role === "owner" ? "Owner" : "Staff"}
          </p>
        </div>
      </div>

      <nav>
        {menus.map((menu) => {
          const Icon = menu.icon;

          return (
            <button
              key={menu.name}
              className={`menu-btn ${page === menu.name ? "active" : ""}`}
              onClick={() => setPage(menu.name)}
            >
              <Icon size={20} />
              <span>{menu.name}</span>
            </button>
          );
        })}

        <button
  className="menu-btn"
  onClick={async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }}
  style={{ marginTop: "20px" }}
>
  <LogOut size={20} />
  <span>Logout</span>
</button>
      </nav>
    </aside>
  );
}