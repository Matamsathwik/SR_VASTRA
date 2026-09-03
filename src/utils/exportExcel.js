import * as XLSX from "xlsx";

const downloadSheet = (data, sheetName, fileName) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportBillsExcel = (bills) => {
  downloadSheet(
    bills.map((b) => ({
      "Bill No": b.billNo || b.bill_no,
      Date: b.billDate || b.bill_date,
      Customer: b.customerName || b.customerId,
      Total: b.total,
      Paid: b.paid,
      Due: b.due,
      Status: b.status,
      "Payment Mode": b.paymentMode || b.payment_mode,
    })),
    "Bills",
    `Bills_${new Date().toISOString().split("T")[0]}`
  );
};

export const exportCustomersExcel = (customers) => {
  downloadSheet(
    customers.map((c) => ({
      ID: `SR-${c.id}`,
      Name: c.name,
      Phone: c.phone || "-",
      Address: c.address || "-",
    })),
    "Customers",
    `Customers_${new Date().toISOString().split("T")[0]}`
  );
};

export const exportStockExcel = (stock) => {
  downloadSheet(
    stock.map((s) => ({
      "Stock ID": s.stockId,
      Item: s.itemName,
      Category: s.category,
      Available: s.currentQty,
      Price: s.price,
    })),
    "Stock",
    `Stock_${new Date().toISOString().split("T")[0]}`
  );
};