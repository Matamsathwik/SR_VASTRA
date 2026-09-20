import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateReturnInvoice = (returnData, customer) => {
  const items = returnData.items || [];

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 180],
  });

  // Professional SR Vastra colours
  const navy = [31, 45, 61];
  const gold = [196, 154, 61];
  const lightGold = [247, 242, 226];
  const grey = [105, 105, 105];
  const lightGrey = [235, 235, 235];
  const black = [25, 25, 25];

  const logo = new Image();
  logo.src = `${window.location.origin}/logo.png`;

  logo.onload = () => createPDF(true);
  logo.onerror = () => createPDF(false);

  function createPDF(showLogo) {
    let y = 5;

    // ==================================================
    // HEADER - LOGO LEFT + BUSINESS DETAILS RIGHT
    // ==================================================

    if (showLogo) {
      doc.addImage(logo, "PNG", 5, y, 19, 19);
    }

    const headerX = showLogo ? 48 : 40;

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text("SR VASTRA", headerX, y + 6, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    doc.text(
      "Premium Sarees & Ethnic Wear",
      headerX,
      y + 11,
      {
        align: "center",
      }
    );

    doc.text(
      "Narayankhed, Telangana",
      headerX,
      y + 15,
      {
        align: "center",
      }
    );

    y += 23;

    // Gold separator
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.6);
    doc.line(4, y, 76, y);

    // ==================================================
    // RETURN TITLE
    // ==================================================

    y += 7;

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text("RETURN", 40, y, {
      align: "center",
    });

    // Small gold underline
    y += 2;

    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    doc.line(30, y, 50, y);

    // ==================================================
    // CUSTOMER + DATE
    // ==================================================

    y += 7;

    doc.setTextColor(...black);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    const customerName =
      customer?.name || "-";

    const customerAddress =
      customer?.address ||
      customer?.location ||
      "";

    const customerText = customerAddress
      ? `Customer : ${customerName}, ${customerAddress}`
      : `Customer : ${customerName}`;

    doc.text(customerText, 4, y);

    y += 5;

    doc.text(
      `Return No : ${returnData.returnNo || "-"}`,
      4,
      y
    );

    doc.text(
      `Date : ${returnData.returnDate || "-"}`,
      76,
      y,
      {
        align: "right",
      }
    );

    // ==================================================
    // ITEM TABLE
    // ==================================================

    y += 5;

    autoTable(doc, {
      startY: y,

      margin: {
        left: 4,
        right: 4,
      },

      theme: "grid",

      head: [
        ["S.No", "Description", "Qty", "Rate", "Amt"],
      ],

      body: items.map((item, index) => {
        const qty = Number(
          item.returnQty || item.qty || 0
        );

        const rate = Number(
          item.price || 0
        );

        const amount = qty * rate;

        const stockNo = item.stockNo
          ? ` (${String(item.stockNo).replace(/\D/g, "")})`
          : "";

        return [
          String(index + 1),

          `${item.itemName || item.category || "Item"}${stockNo}`,

          String(qty),

          rate.toFixed(2),

          amount.toFixed(2),
        ];
      }),

      styles: {
        font: "helvetica",
        fontSize: 6.5,
        cellPadding: 1.7,
        valign: "middle",

        textColor: black,

        lineColor: [150, 150, 150],
        lineWidth: 0.15,
      },

      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],

        fontStyle: "bold",
        fontSize: 6.5,

        halign: "center",
      },

      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },

      columnStyles: {
        0: {
          cellWidth: 7,
          halign: "center",
        },

        1: {
          cellWidth: 31,
          halign: "left",
        },

        2: {
          cellWidth: 8,
          halign: "center",
        },

        3: {
          cellWidth: 11,
          halign: "right",
        },

        4: {
          cellWidth: 13,
          halign: "right",
        },
      },
    });

    y = doc.lastAutoTable.finalY + 5;

    // ==================================================
    // TOTAL AMOUNT
    // ==================================================

    const itemTotal = items.reduce(
      (sum, item) => {
        const qty = Number(
          item.returnQty || item.qty || 0
        );

        const price = Number(
          item.price || 0
        );

        return sum + qty * price;
      },
      0
    );

    const totalAmount = Number(
      returnData.amount || itemTotal
    );

    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(4, y, 76, y);

    y += 6;

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(
      "Total Amount :",
      4,
      y
    );

    // Use Rs. instead of ₹
    // Prevents the strange "¹" rendering issue
    doc.text(
      `Rs. ${totalAmount.toFixed(2)}`,
      76,
      y,
      {
        align: "right",
      }
    );

    // ==================================================
    // CUSTOMER ACCOUNT BALANCE
    // ==================================================

    /*
      Prefer the actual total pending value from
      the customer profile.

      Multiple fallbacks are supported so existing
      customer data can be used without changing
      the database.
    */

    const pendingBalance = Number(
      customer?.totalPending ??
      customer?.total_pending ??
      customer?.pendingBalance ??
      customer?.pending_balance ??
      customer?.due ??
      customer?.balance ??
      0
    );

    y += 8;

    // Light coloured balance box
    doc.setFillColor(...lightGold);
    doc.roundedRect(
      4,
      y - 4,
      72,
      12,
      1.5,
      1.5,
      "F"
    );

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    doc.text(
      "Your A/c Balance is :",
      7,
      y + 3
    );

    doc.setTextColor(...navy);
    doc.setFontSize(8.5);

    doc.text(
      `Rs. ${pendingBalance.toFixed(2)}`,
      73,
      y + 3,
      {
        align: "right",
      }
    );

    // ==================================================
    // FOOTER
    // ==================================================

    y += 18;

    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(4, y, 76, y);

    y += 6;

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    doc.text(
      "Thank You • Visit Again",
      40,
      y,
      {
        align: "center",
      }
    );

    // ==================================================
    // SAVE
    // ==================================================

    doc.save(
      `SR_Vastra_Return_${returnData.returnNo}.pdf`
    );
  }
};