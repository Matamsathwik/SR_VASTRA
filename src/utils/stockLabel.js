import JsBarcode from "jsbarcode";

export const printStockLabel = (item, copies = 1) => {
  if (!item?.barcode) {
    alert("This item does not have a barcode.");
    return;
  }

  const labels = Array.from({ length: copies }, () => {
    const svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    JsBarcode(svg, String(item.barcode), {
      format: "CODE128",
      width: 1.05,
      height: 25,
      displayValue: true,
      fontSize: 7,
      margin: 0,
    });

    return `
      <div class="card">

        <!-- BRANDING HALF -->
        <div class="branding-panel">
          <img
            src="${window.location.origin}/label.png"
            class="branding-image"
            alt="SR Vastra"
          />
        </div>


        <!-- PRICE / DETAILS HALF -->
        <div class="details-panel">

          <div class="price-label">
            SELLING PRICE
          </div>

          <div class="price">
            ₹${Number(item.sellingPrice || 0).toLocaleString("en-IN")}
          </div>

          <div class="gold-line"></div>

          <div class="product-info">

            <div class="info-block">
              <div class="info-label">ITEM</div>

              <div class="item-name">
                ${item.itemName || "-"}
              </div>
            </div>

            <div class="info-block">
              <div class="info-label">STOCK NO.</div>

              <div class="stock-number">
                ${item.stockNo || "-"}
              </div>
            </div>

          </div>

          <div class="barcode">
            ${svg.outerHTML}
          </div>

        </div>


        <!-- HORIZONTAL FOLD -->
        <div class="fold-line">
          <span>FOLD</span>
        </div>

      </div>
    `;
  }).join("");


  const win = window.open("", "_blank");

  if (!win) {
    alert("Please allow pop-ups to print labels.");
    return;
  }


  win.document.write(`
    <!DOCTYPE html>

    <html>

      <head>

        <title>SR Vastra Card</title>

        <style>

          @page {
            size: 3.5in 4in;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 3.5in;
            height: 4in;

            margin: 0;
            padding: 0;

            background: white;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
          }


          /* =================================
             FLAT CARD
             3.5 × 4 INCH
          ================================= */

          .card {
            position: relative;

            width: 3.5in;
            height: 4in;

            display: flex;
            flex-direction: column;

            page-break-after: always;

            overflow: hidden;

            background: white;
          }


          /* =================================
             BRANDING
             3.5 × 2 INCH
          ================================= */

          .branding-panel {
            width: 3.5in;
            height: 2in;

            flex-shrink: 0;

            padding: 0.08in;

            background: #4b000d;

            display: flex;

            align-items: center;
            justify-content: center;
          }


          .branding-image {
            width: 100%;
            height: 100%;

            object-fit: cover;

            display: block;
          }


          /* =================================
             DETAILS
             3.5 × 2 INCH
          ================================= */

          .details-panel {
            width: 3.5in;
            height: 2in;

            flex-shrink: 0;

            background: #fffaf0;

            border-left: 1px solid #c79a34;
            border-right: 1px solid #c79a34;
            border-bottom: 1px solid #c79a34;

            display: flex;

            flex-direction: column;

            align-items: center;

            padding-top: 0.09in;
          }


          /* =================================
             PRICE
          ================================= */

          .price-label {
            font-size: 6px;

            letter-spacing: 1.5px;

            color: #777;

            margin-bottom: 0.015in;
          }


          .price {
            font-size: 23px;

            line-height: 1;

            font-weight: bold;

            color: #650b1b;
          }


          .gold-line {
            width: 0.85in;

            height: 1px;

            background: #c79a34;

            margin: 0.07in 0 0.08in;
          }


          /* =================================
             ITEM + STOCK
          ================================= */

          .product-info {
            width: 2.5in;

            display: flex;

            justify-content: center;

            align-items: flex-start;

            gap: 0.55in;

            text-align: center;
          }


          .info-block {
            min-width: 0.65in;

            max-width: 1.2in;
          }


          .info-label {
            font-size: 5.5px;

            color: #999;

            letter-spacing: 0.9px;

            margin-bottom: 0.025in;
          }


          .item-name {
            font-family: Georgia, serif;

            font-size: 9px;

            font-weight: bold;

            color: #222;

            max-width: 1.2in;

            overflow-wrap: anywhere;
          }


          .stock-number {
            font-size: 8px;

            font-weight: bold;

            color: #650b1b;
          }


          /* =================================
             BARCODE
          ================================= */

          .barcode {
            width: 2.0in;

            margin-top: 0.065in;

            text-align: center;
          }


          .barcode svg {
            width: 100%;

            max-width: 2.0in;

            height: auto;

            display: block;
          }


          /* =================================
             HORIZONTAL FOLD
          ================================= */

          .fold-line {
            position: absolute;

            left: 0;

            top: 2in;

            width: 3.5in;

            border-top: 1px dashed #777;

            z-index: 20;

            text-align: center;

            pointer-events: none;
          }


          .fold-line span {
            position: relative;

            top: -0.065in;

            padding: 0 0.05in;

            background: #fffaf0;

            color: #888;

            font-size: 5px;

            letter-spacing: 0.5px;
          }

        </style>

      </head>


      <body>

        ${labels}

        <script>

          window.onload = function () {

            setTimeout(function () {
              window.print();
            }, 500);

          };

        </script>

      </body>

    </html>
  `);

  win.document.close();
};