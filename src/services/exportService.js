// ── Export Service ─────────────────────────────────────
// Generates Excel (.xlsx) files from ticket data using ExcelJS.

const ExcelJS = require('exceljs');

/**
 * Creates an Excel workbook from an array of ticket objects.
 * Returns a Buffer containing the .xlsx file.
 */
async function generateExcelExport(tickets) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Support Portal';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Support Tickets', {
    properties: { defaultColWidth: 18 },
    views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
  });

  // ── Define Columns ────────────────────────────────
  sheet.columns = [
    { header: 'Ticket ID', key: 'ticket_id', width: 38 },
    { header: 'Customer Name', key: 'customer_name', width: 22 },
    { header: 'Email', key: 'customer_email', width: 28 },
    { header: 'Company', key: 'customer_company', width: 22 },
    { header: 'Device Number', key: 'device_number', width: 18 },
    { header: 'Order Number', key: 'order_number', width: 18 },
    { header: 'Purchase Date', key: 'purchase_date', width: 14 },
    { header: 'Subject', key: 'issue_subject', width: 30 },
    { header: 'Description', key: 'issue_description', width: 40 },
    { header: 'Priority', key: 'priority', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Created', key: 'created_at', width: 20 },
    { header: 'Last Updated', key: 'last_updated_at', width: 20 },
  ];

  // ── Style Header Row ──────────────────────────────
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' }, // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // ── Add Data Rows ─────────────────────────────────
  const priorityColors = {
    Critical: 'FFFEF2F2',
    High: 'FFFFF7ED',
    Medium: 'FFF0F9FF',
    Low: 'FFF0FDF4',
  };

  const priorityTextColors = {
    Critical: 'FFDC2626',
    High: 'FFEA580C',
    Medium: 'FF2563EB',
    Low: 'FF16A34A',
  };

  tickets.forEach((ticket) => {
    const row = sheet.addRow(ticket);
    row.alignment = { vertical: 'middle', wrapText: true };

    // Color-code priority cell
    const priorityCell = row.getCell('priority');
    priorityCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: priorityColors[ticket.priority] || 'FFFFFFFF' },
    };
    priorityCell.font = {
      bold: true,
      color: { argb: priorityTextColors[ticket.priority] || 'FF000000' },
    };

    // Alternate row shading
    if (row.number % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.column !== sheet.getColumn('priority').number) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' },
          };
        }
      });
    }
  });

  // ── Add borders ───────────────────────────────────
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  };

  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = borderStyle;
    });
  });

  // ── Auto-filter ───────────────────────────────────
  sheet.autoFilter = {
    from: 'A1',
    to: `M${tickets.length + 1}`,
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generateExcelExport };
