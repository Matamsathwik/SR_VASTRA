import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerProfile from "./pages/CustomerProfile";
import { billService } from "./services/billService";
import Billing from "./pages/Billing";
import Bills from "./pages/Bills";
import BillDetails from "./pages/BillDetails";
import Returns from "./pages/Returns";
import ReturnDetails from "./pages/ReturnDetails";
import { returnService } from "./services/returnService";
import Stock from "./pages/Stock";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import StaffManagement from "./pages/StaffManagement";
import Activity from "./pages/Activity";
import Settings from "./pages/Settings";
import SupplierProfile from "./pages/SupplierProfile";
import { supplierService } from "./services/supplierService";
import Purchases from "./pages/Purchases";

import { authService } from "./services/authService";
import { customerService } from "./services/customerService";
import { stockService } from "./services/stockService";
import StockDetails from "./pages/StockDetails";

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
  "StockItem",
  "Purchases",
  "PurchaseDetails",
  "Reports",
  "Activity",
  "Staff",
];

function getRoute() {
  const path = window.location.pathname;

  // Customer profile
  const customerMatch = path.match(/^\/customers\/([^/]+)$/);

  if (customerMatch) {
    return {
      page: "CustomerProfile",
      customerId: customerMatch[1],
    };
  }

  // Bill details
  const billMatch = path.match(/^\/bills\/([^/]+)$/);

  if (billMatch) {
    return {
      page: "BillDetails",
      billId: billMatch[1],
    };
  }

  // Return details
  const returnMatch = path.match(/^\/returns\/([^/]+)$/);

  if (returnMatch) {
    return {
      page: "ReturnDetails",
      returnId: returnMatch[1],
    };
  }

  // Stock item
  const stockMatch = path.match(/^\/stock\/([^/]+)$/);

  if (stockMatch) {
    return {
      page: "StockItem",
      stockId: stockMatch[1],
    };
  }

  // Purchase details
  // Purchase details
const purchaseMatch = path.match(/^\/purchases\/([^/]+)$/);

if (purchaseMatch) {
  return {
    page: "PurchaseDetails",
    purchaseId: purchaseMatch[1],
  };
}

// Supplier profile
const supplierMatch = path.match(/^\/suppliers\/([^/]+)$/);

if (supplierMatch) {
  return {
    page: "SupplierProfile",
    supplierId: supplierMatch[1],
  };
}

return {
  page: pageRoutes[path] || "Dashboard",
};
}

export default function App() {
  const initialRoute = getRoute();

  const [page, setPage] = useState(initialRoute.page);
  const [routeId, setRouteId] = useState(
    initialRoute.customerId ||
      initialRoute.billId ||
      initialRoute.returnId ||
      initialRoute.stockId ||
      initialRoute.purchaseId ||
      initialRoute.supplierId ||
      null,
  );

  const [user, setUser] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  useEffect(() => {
    authService.currentUser().then(setUser);

    const handlePopState = () => {
      const route = getRoute();

      setPage(route.page);

      setRouteId(
        route.customerId ||
          route.billId ||
          route.returnId ||
          route.stockId ||
          route.purchaseId ||
          route.supplierId ||
          null,
      );
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const isOwner = user?.role?.toLowerCase() === "owner";

  const navigate = (nextPage) => {
    const path = pagePaths[nextPage] || "/dashboard";

    // Staff cannot access restricted pages
    if (
      user?.role?.toLowerCase() !== "owner" &&
      staffRestrictedPages.includes(nextPage)
    ) {
      setPage("Dashboard");
      setRouteId(null);

      if (window.location.pathname !== "/dashboard") {
        window.history.pushState({}, "", "/dashboard");
      }

      return;
    }

    setPage(nextPage);
    setRouteId(null);

    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  };

  const openCustomer = (customer) => {
    setSelectedCustomer(customer);
    setPage("CustomerProfile");
    setRouteId(customer.id);

    window.history.pushState({}, "", `/customers/${customer.id}`);
  };

  const openBill = (bill) => {
    setSelectedBill(bill);
    setPage("BillDetails");
    setRouteId(bill.id);

    window.history.pushState({}, "", `/bills/${bill.id}`);
  };

  const goBackToBills = () => {
    setSelectedBill(null);
    setPage("Bills");
    setRouteId(null);

    window.history.pushState({}, "", "/bills");
  };

  const openReturn = (returnData) => {
    setSelectedReturn(returnData);
    setPage("ReturnDetails");
    setRouteId(returnData.id);

    window.history.pushState({}, "", `/returns/${returnData.id}`);
  };

  const goBackToReturns = () => {
    setSelectedReturn(null);
    setPage("Returns");
    setRouteId(null);

    window.history.pushState({}, "", "/returns");
  };

  const openStock = (stock) => {
    setSelectedStock(stock);
    setPage("StockItem");
    setRouteId(stock.stockNo || stock.id);

    window.history.pushState({}, "", `/stock/${stock.stockNo || stock.id}`);
  };

  const goBackToStock = () => {
    setSelectedStock(null);
    setPage("Stock");
    setRouteId(null);

    window.history.pushState({}, "", "/stock");
  };

  const goBackToCustomers = () => {
    setSelectedCustomer(null);
    setPage("Customers");
    setRouteId(null);

    window.history.pushState({}, "", "/customers");
  };

  const openSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setPage("SupplierProfile");
    setRouteId(supplier.id);

    window.history.pushState({}, "", `/suppliers/${supplier.id}`);
  };

  const goBackToPurchases = () => {
    setSelectedSupplier(null);
    setPage("Purchases");
    setRouteId(null);

    window.history.pushState({}, "", "/purchases");
  };

  // If staff directly opens a restricted URL
  useEffect(() => {
    if (!user) return;

    const route = getRoute();

    if (
      user?.role?.toLowerCase() !== "owner" &&
      staffRestrictedPages.includes(route.page)
    ) {
      setPage("Dashboard");
      setRouteId(null);

      window.history.replaceState({}, "", "/dashboard");
    }
  }, [user]);

  // Load customer when directly opening /customers/:id
  useEffect(() => {
    const route = getRoute();

    if (route.page !== "CustomerProfile" || !route.customerId) {
      return;
    }

    const loadCustomer = async () => {
      try {
        const customers = await customerService.getAll();

        const customer = customers.find(
          (c) => String(c.id) === String(route.customerId),
        );

        if (customer) {
          setSelectedCustomer(customer);
        } else {
          window.history.replaceState({}, "", "/customers");

          setPage("Customers");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Customer profile load failed:", error);

        window.history.replaceState({}, "", "/customers");

        setPage("Customers");
        setRouteId(null);
      }
    };

    loadCustomer();
  }, []);

  useEffect(() => {
    const route = getRoute();

    if (route.page !== "BillDetails" || !route.billId) {
      return;
    }

    const loadBill = async () => {
      try {
        const bills = await billService.getAll();

        const bill = bills.find((b) => String(b.id) === String(route.billId));

        if (bill) {
          setSelectedBill(bill);
        } else {
          window.history.replaceState({}, "", "/bills");

          setPage("Bills");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Bill details load failed:", error);

        window.history.replaceState({}, "", "/bills");

        setPage("Bills");
        setRouteId(null);
      }
    };

    loadBill();
  }, []);

  useEffect(() => {
    const route = getRoute();

    if (route.page !== "ReturnDetails" || !route.returnId) {
      return;
    }

    const loadReturn = async () => {
      try {
        const returns = await returnService.getAll();

        const returnData = returns.find(
          (r) => String(r.id) === String(route.returnId),
        );

        if (returnData) {
          setSelectedReturn(returnData);
        } else {
          window.history.replaceState({}, "", "/returns");

          setPage("Returns");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Return details load failed:", error);

        window.history.replaceState({}, "", "/returns");

        setPage("Returns");
        setRouteId(null);
      }
    };

    loadReturn();
  }, []);

  useEffect(() => {
    const route = getRoute();

    if (route.page !== "StockItem" || !route.stockId) {
      return;
    }

    const loadStockItem = async () => {
      try {
        const stock = await stockService.getAll();

        const item = stock.find(
          (s) =>
            String(s.stockNo) === String(route.stockId) ||
            String(s.id) === String(route.stockId),
        );

        if (item) {
          setSelectedStock(item);
        } else {
          window.history.replaceState({}, "", "/stock");

          setPage("Stock");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Stock details load failed:", error);

        window.history.replaceState({}, "", "/stock");

        setPage("Stock");
        setRouteId(null);
      }
    };

    loadStockItem();
  }, []);

  useEffect(() => {
    const route = getRoute();

    if (route.page !== "StockItem" || !route.stockId) {
      return;
    }

    const loadStockItem = async () => {
      try {
        const stock = await stockService.getAll();

        const item = stock.find(
          (s) =>
            String(s.stockNo) === String(route.stockId) ||
            String(s.id) === String(route.stockId),
        );

        if (item) {
          setSelectedStock(item);
        } else {
          window.history.replaceState({}, "", "/stock");

          setPage("Stock");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Stock details load failed:", error);

        window.history.replaceState({}, "", "/stock");

        setPage("Stock");
        setRouteId(null);
      }
    };

    loadStockItem();
  }, []);

  useEffect(() => {
    const route = getRoute();

    if (route.page !== "StockItem" || !route.stockId) {
      return;
    }

    const loadStockItem = async () => {
      try {
        const stock = await stockService.getAll();

        const item = stock.find(
          (s) =>
            String(s.stockNo) === String(route.stockId) ||
            String(s.id) === String(route.stockId),
        );

        if (item) {
          setSelectedStock(item);
        } else {
          window.history.replaceState({}, "", "/stock");

          setPage("Stock");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Stock details load failed:", error);

        window.history.replaceState({}, "", "/stock");

        setPage("Stock");
        setRouteId(null);
      }
    };

    loadStockItem();
  }, []);


  useEffect(() => {
    const route = getRoute();

    if (route.page !== "SupplierProfile" || !route.supplierId) {
      return;
    }

    const loadSupplier = async () => {
      try {
        const suppliers = await supplierService.getAll();

        const supplier = suppliers.find(
          (s) => String(s.id) === String(route.supplierId),
        );

        if (supplier) {
          setSelectedSupplier(supplier);
        } else {
          window.history.replaceState({}, "", "/purchases");

          setPage("Purchases");
          setRouteId(null);
        }
      } catch (error) {
        console.error("Supplier profile load failed:", error);

        window.history.replaceState({}, "", "/purchases");

        setPage("Purchases");
        setRouteId(null);
      }
    };

    loadSupplier();
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app">
      <Sidebar
        page={page === "CustomerProfile" ? "Customers" : page}
        setPage={navigate}
        user={user}
        setUser={setUser}
      />

      {page === "Dashboard" && <Dashboard user={user} />}

      {page === "Customers" && <Customers onOpenCustomer={openCustomer} />}

      {page === "CustomerProfile" && selectedCustomer && (
        <CustomerProfile
          customer={selectedCustomer}
          goBack={goBackToCustomers}
        />
      )}

      {page === "Billing" && <Billing user={user} />}

      {page === "Bills" && <Bills onOpenBill={openBill} />}
      {page === "BillDetails" && selectedBill && (
        <BillDetails bill={selectedBill} goBack={goBackToBills} />
      )}

      {page === "Returns" && <Returns onOpenReturn={openReturn} />}

      {page === "ReturnDetails" && selectedReturn && (
        <ReturnDetails returnData={selectedReturn} goBack={goBackToReturns} />
      )}

      {page === "Stock" && isOwner && <Stock onOpenStock={openStock} />}

      {page === "StockItem" && isOwner && selectedStock && (
        <StockDetails stock={selectedStock} goBack={goBackToStock} />
      )}

      {page === "Purchases" && isOwner && (
        <Purchases onOpenSupplier={openSupplier} />
      )}

      {page === "SupplierProfile" && isOwner && selectedSupplier && (
        <SupplierProfile
          supplier={selectedSupplier}
          goBack={goBackToPurchases}
        />
      )}

      {page === "Reports" && isOwner && <Reports />}

      {page === "Staff" && isOwner && <StaffManagement />}

      {page === "Activity" && isOwner && <Activity />}

      {page === "Settings" && <Settings user={user} />}
    </div>
  );
}
