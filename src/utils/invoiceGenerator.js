import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateInvoice = (bill, customer) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [200, 80], // 80mm thermal receipt
  });

  const logo = new Image();
  logo.src = "/logo.png";

  logo.onload = () => {
    let y = 6;

    // ---------- LOGO ----------
    doc.addImage(logo, "PNG", 28, y, 24, 24);
    y += 28;

    // ---------- SHOP NAME ----------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(74, 0, 18);
    doc.text("SR VASTRA", 40, y, { align: "center" });

    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("Premium Sarees & Ethnic Wear", 40, y, { align: "center" });

    y += 4;
    doc.text("Narayankhed, Telangana", 40, y, { align: "center" });

    y += 4;
    doc.setDrawColor(212, 175, 55);
    doc.line(5, y, 75, y);

    // ---------- BILL INFO ----------
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(`Bill No: ${bill.billNo}`, 5, y);
    doc.text(`Date: ${bill.billDate}`, 45, y);

    y += 5;

    const customerName =
  typeof customer === "string"
    ? customer
    : customer?.name || "-";

const customerId =
  typeof customer === "object"
    ? customer?.id || bill.customerId || "-"
    : bill.customerId || "-";

doc.setFont("helvetica", "normal");
doc.text(`Customer: ${customerName}`, 5, y);

y += 5;
doc.text(`Customer ID: SR-${customerId}`, 5, y);

    // ---------- ITEMS ----------
    y += 5;

    autoTable(doc, {
      startY: y,
      theme: "grid",
      margin: { left: 5, right: 5 },
      head: [["Item", "Qty", "Rate", "Amt"]],
      body: (bill.items || []).map((item) => [
  item.itemName || item.category,
  String(item.qty),
  String(item.price),
  String(item.qty * item.price),
]),
      headStyles: {
        fillColor: [74, 0, 18],
        textColor: 255,
        halign: "center",
        fontSize: 8,
      },
      styles: {
  font: "helvetica",
  fontStyle: "normal",
  fontSize: 7,
  cellPadding: 2,
  halign: "center",
  valign: "middle",
},
      columnStyles: {
  0: { cellWidth: 32, halign: "left" },
  1: { cellWidth: 10, halign: "center" },
  2: { cellWidth: 14, halign: "right" },
  3: { cellWidth: 14, halign: "right" },
},
    });

    y = doc.lastAutoTable.finalY + 5;

    doc.setDrawColor(212, 175, 55);
    doc.line(5, y, 75, y);

    // ---------- TOTALS ----------
y += 5;

const discount = Number(bill.discount || 0);
const subtotal = Number(bill.total) + discount;

doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(0, 0, 0);

// Show only if discount exists
if (discount > 0) {
  doc.text("Subtotal", 5, y);
  doc.text(`${subtotal}`, 75, y, { align: "right" });

  y += 5;
  doc.setTextColor(180, 120, 0);
  doc.text("Discount", 5, y);
  doc.text(`-${discount}`, 75, y, { align: "right" });

  y += 5;
}

doc.setTextColor(74, 0, 18);
doc.text("Total", 5, y);
doc.text(`${bill.total}`, 75, y, { align: "right" });

y += 5;
doc.setTextColor(0, 0, 0);
doc.text("Paid", 5, y);
doc.text(`${bill.paid}`, 75, y, { align: "right" });

y += 5;
doc.setTextColor(180, 0, 0);
doc.text("Due", 5, y);
doc.text(`${bill.due}`, 75, y, { align: "right" });

    // ---------- FOOTER ----------
    y += 8;

    doc.setDrawColor(212, 175, 55);
    doc.line(5, y - 3, 75, y - 3);

    doc.setTextColor(74, 0, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text("Cashier: SR Vastra", 40, y, {
      align: "center",
    });

    y += 5;
    doc.text("Thank You • Visit Again", 40, y, {
      align: "center",
    });

    y += 4;
    doc.setFontSize(7);
    doc.text("Narayankhed • Telangana", 40, y, {
      align: "center",
    });

    doc.save(`SR_Vastra_Bill_${bill.billNo}.pdf`);
  };
};