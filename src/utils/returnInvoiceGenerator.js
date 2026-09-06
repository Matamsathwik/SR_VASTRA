import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateReturnInvoice = (returnData, customer) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [200, 80],
  });

  const logo = new Image();
  logo.src = `${window.location.origin}/logo.png`;

  logo.onload = () => createPDF(true);
  logo.onerror = () => createPDF(false);

  function createPDF(showLogo) {
    let y = 6;

    if (showLogo) {
      doc.addImage(logo, "PNG", 28, y, 24, 24);
      y += 28;
    }

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

    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(`Return #${returnData.returnNo}`, 5, y);
    doc.text(returnData.returnDate, 75, y, { align: "right" });

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${customer?.name || "-"}`, 5, y);

y += 5;
doc.text(`Customer ID: ${customer?.id || "-"}`, 5, y);

y += 5;
doc.text(`Original Bill: #${returnData.billNo}`, 5, y);

y += 5;
doc.text(`Reason: ${returnData.reason}`, 5, y);

y += 5;
doc.text(`Staff: SR Vastra`, 5, y);

    y += 4;

    autoTable(doc, {
  startY: y,
  theme: "grid",
  margin: { left: 5, right: 5 },

  head: [["S.No", "Item", "Qty", "Rate", "Amt"]],

  body: (returnData.items || []).map((item, index) => [
  String(index + 1),

  `${item.itemName || item.category || "Item"}${
    item.stockNo
      ? ` (${String(item.stockNo).replace(/\D/g, "")})`
      : ""
  }`,

  String(item.returnQty || item.qty),
  String(item.price),
  String(
    (item.returnQty || item.qty) * Number(item.price || 0)
  ),
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
    valign: "middle",
  },

  columnStyles: {
    0: { cellWidth: 8, halign: "center" },  // S.No
    1: { cellWidth: 28, halign: "left" },   // Item
    2: { cellWidth: 9, halign: "center" },  // Qty
    3: { cellWidth: 12, halign: "right" },  // Rate
    4: { cellWidth: 13, halign: "right" },  // Amt
  },
});

    y = doc.lastAutoTable.finalY + 5;

    doc.setDrawColor(212, 175, 55);
    doc.line(5, y, 75, y);

    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    const discount = Number(returnData.discount || 0);
const originalBillTotal =
  Number(returnData.originalTotal || returnData.amount + discount);

doc.setTextColor(0, 0, 0);

doc.text("Original Bill", 5, y);
doc.text(String(originalBillTotal), 75, y, {
  align: "right",
});

if (discount > 0) {
  y += 5;
  doc.setTextColor(180, 120, 0);
  doc.text("Discount", 5, y);
  doc.text(`-${discount}`, 75, y, {
    align: "right",
  });
}

y += 6;

doc.setTextColor(74, 0, 18);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("Refund Adjusted", 5, y);
doc.text(String(returnData.amount), 75, y, {
  align: "right",
});

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

    doc.save(`SR_Vastra_Return_${returnData.returnNo}.pdf`);
  }
};