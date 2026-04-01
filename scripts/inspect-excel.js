/**
 * Inspect Excel file structure - sheet names and column headers
 * Run: node scripts/inspect-excel.js "C:\Users\User\Downloads\MONZA_CRM_Import (1).xlsx"
 */
const XLSX = require("xlsx");
const path = process.argv[2] || "MONZA_CRM_Import (1).xlsx";

const wb = XLSX.readFile(path);
console.log("Sheet names:", wb.SheetNames);
console.log("");

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  console.log(`=== Sheet: ${name} ===`);
  console.log("First 4 rows (headers/data):");
  (json.slice(0, 4) || []).forEach((row, i) => console.log(`  ${i}:`, JSON.stringify(row)));
  console.log(`  Total rows: ${json.length}`);
  console.log("");
}
