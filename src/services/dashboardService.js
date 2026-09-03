import { billService } from "./billService";
import { customerService } from "./customerService";
import { stockService } from "./stockService";
import { getActivity } from "../data/storage";

export const dashboardService = {
  // Get all data required by Dashboard.jsx
  async getData() {
    const [bills, customers, stock] = await Promise.all([
      billService.getAll(),
      customerService.getAll(),
      stockService.getAll(),
    ]);

    const activity = (getActivity() || [])
      .slice()
      .reverse()
      .slice(0, 5);

    return {
      bills: Array.isArray(bills) ? bills : [],
      customers: Array.isArray(customers) ? customers : [],
      stock: Array.isArray(stock) ? stock : [],
      activity: Array.isArray(activity) ? activity : [],
    };
  },

  // Keep getStats() so other parts of the project
  // can continue using it if required.
  async getStats() {
    const data = await this.getData();

    const bills = data.bills;
    const customers = data.customers;
    const stock = data.stock;

    const today = new Date()
      .toISOString()
      .split("T")[0];

    const month = today.slice(0, 7);

    // Today's sales
    const todaySales = bills
      .filter((bill) => bill.billDate === today)
      .reduce(
        (sum, bill) =>
          sum + Number(bill.total || 0),
        0
      );

    // Current month's sales
    const monthSales = bills
      .filter((bill) =>
        String(bill.billDate || "").startsWith(month)
      )
      .reduce(
        (sum, bill) =>
          sum + Number(bill.total || 0),
        0
      );

    // Total pending due
    const pendingDue = bills.reduce(
      (sum, bill) =>
        sum + Number(bill.due || 0),
      0
    );

    // Category-wise quantity sold
    const categoryCount = {};

    bills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        const category =
          item.category || "Other";

        categoryCount[category] =
          (categoryCount[category] || 0) +
          Number(item.qty || 0);
      });
    });

    // Top-selling category
    const topCategory =
      Object.entries(categoryCount).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || "No Sales";

    // Low-stock items
    const lowStock = stock.filter(
      (item) =>
        Number(item.currentQty || 0) <= 3
    );

    return {
      todaySales,
      monthSales,
      pendingDue,
      totalCustomers: customers.length,
      topCategory,
      lowStock,
      activity: data.activity,
    };
  },
};