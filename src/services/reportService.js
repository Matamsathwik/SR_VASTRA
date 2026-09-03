import * as XLSX from "xlsx";

export const reportService = {
  exportExcel(filename, rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Report");

    XLSX.writeFile(wb, `${filename}.xlsx`);
  },
};