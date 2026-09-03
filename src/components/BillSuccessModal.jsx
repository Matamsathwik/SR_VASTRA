import InvoicePrint from "./InvoicePrint";
import { generateInvoice } from "../utils/invoiceGenerator";

export default function BillSuccessModal({
  open,
  bill,
  customer,
  phone,
  onClose
}) {

  if(!open || !bill) return null;

  const handlePrint = () => {
  const invoice = document
    .getElementById("invoice-print")
    .cloneNode(true);

  // Force absolute logo path
  const logo = invoice.querySelector("img");
  if (logo) {
    logo.src = `${window.location.origin}/logo.png`;
  }

  const win = window.open("", "_blank");
  const base = window.location.origin;

  win.document.write(`
    <html>
      <head>
        <base href="${base}/">
        <title>Bill ${bill.billNo}</title>
        <style>
          body{
  font-family: Arial, sans-serif;
  margin:0;
  padding:12px;
}

#invoice-print{
  width:80mm;
  margin:auto;
}

table{
  width:100%;
  border-collapse:collapse;
}

th,td{
  border:1px solid #ddd;
  padding:6px;
  font-size:12px;
}

@page{
  size:80mm auto;
  margin:5mm;
}
        </style>
      </head>

      <body>${invoice.outerHTML}</body>
    </html>
  `);

  win.document.close();

  win.onload = () => {
    win.focus();
    win.print();
    win.close();
  };
};

  return (
    <div className="modal-overlay">

      <div className="modal-box">

        <div className="success-icon">✓</div>

        <h2>Bill Saved Successfully</h2>

        <div className="invoice-box">

          <div className="invoice-row">
            <span>Bill No</span>
            <strong>{bill.billNo}</strong>
          </div>

          <div className="invoice-row">
            <span>Customer</span>
            <strong>{customer}</strong>
          </div>

          <div className="invoice-row">
            <span>Total</span>
            <strong>₹{bill.total}</strong>
          </div>

          <div className="invoice-row due">
            <span>Pending</span>
            <strong>₹{bill.due}</strong>
          </div>

        </div>

        <div className="modal-buttons">

          <button
            className="print-btn"
            onClick={handlePrint}
          >
            Print Invoice
          </button>

          <button
            className="save-btn"
            onClick={onClose}
          >
            Done
          </button>

        </div>
        <div className="modal-actions">

  <button
    className="save-btn"
    onClick={() =>
  generateInvoice(bill, {
    name: customer,
    customerId: bill.customerId,
  })
}
  >
    Download PDF
  </button>

  <button
    className="save-btn"
    onClick={handlePrint}
  >
    Print
  </button>

  <button
  className="save-btn"
  onClick={() => {
  const discount = Number(bill.discount || 0);
const subtotal = Number(bill.total) + discount;

const message = `🛍️ *SR Vastra*

Dear ${customer || "Customer"},

Thank you for shopping with us.

🧾 *Invoice #${bill.billNo}*

Date: ${bill.billDate}
Customer ID: ${bill.customerId || "-"}

${discount > 0 ? `Subtotal: ${subtotal}
Discount: -${discount}
` : ""}Total: ${bill.total}
Paid: ${bill.paid}
Due: ${bill.due}

📍 Narayankhed

Thank You • Visit Again`;

  const cleanPhone = (phone || "").replace(/\D/g, "");

  const whatsappNumber =
    cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  if (whatsappNumber) {
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  } else {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }
}}
>
  WhatsApp
</button>

</div>
        <div style={{display:"none"}}>
          <InvoicePrint
            bill={bill}
            customer={customer}
          />
        </div>

      </div>

    </div>
  );
}