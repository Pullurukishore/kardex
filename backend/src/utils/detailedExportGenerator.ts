import { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface DayData {
  date: string;
  dayName: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: string;
  activities: number;
  activitiesDetail: Array<{
    type: string;
    title: string;
    time: string;
  }>;
  flags: string;
}

interface ReportData {
  person: {
    name: string;
    email: string;
    phone: string | null;
    zones: string;
  };
  period: {
    from: string;
    to: string;
  };
  summary: {
    totalDays: number;
    presentDays: number;
    totalHours: string;
    totalActivities: number;
  };
  dailyBreakdown: DayData[];
}

export async function generateDetailedPersonExcel(res: Response, data: ReportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Details');

  // Add logo if available
  try {
    const logoPath = path.join(__dirname, '../../../frontend/public/kardex-only.png');
    if (fs.existsSync(logoPath)) {
      const logoImageId = workbook.addImage({
        filename: logoPath,
        extension: 'png',
      });
      
      worksheet.addImage(logoImageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 40 },
        editAs: 'oneCell'
      });
    }
  } catch (error) {
    }

  // Set column widths
  worksheet.columns = [
    { key: 'date', width: 12 },
    { key: 'day', width: 10 },
    { key: 'checkIn', width: 10 },
    { key: 'checkOut', width: 10 },
    { key: 'hours', width: 8 },
    { key: 'status', width: 12 },
    { key: 'activities', width: 10 },
    { key: 'flags', width: 15 }
  ];

  // Adjust for logo space
  worksheet.getRow(1).height = 40;
  worksheet.getRow(2).height = 10;
  
  // Title (row 3)
  worksheet.mergeCells('A3:H3');
  const titleRow = worksheet.getCell('A3');
  titleRow.value = `Service Person Attendance Report - ${data.person.name}`;
  titleRow.font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0F2FE' }
  };
  worksheet.getRow(3).height = 30;

  // Person Info
  worksheet.addRow([]);
  worksheet.addRow(['Email:', data.person.email]);
  if (data.person.phone) {
    worksheet.addRow(['Phone:', data.person.phone]);
  }
  worksheet.addRow(['Zones:', data.person.zones]);
  worksheet.addRow(['Period:', `${data.period.from} to ${data.period.to}`]);
  worksheet.addRow([]);

  // Summary
  worksheet.addRow(['SUMMARY']);
  if (worksheet.lastRow) {
    worksheet.getCell(`A${worksheet.lastRow.number}`).font = { bold: true, size: 12 };
  }
  worksheet.addRow(['Total Working Days:', data.summary.totalDays]);
  worksheet.addRow(['Present Days:', data.summary.presentDays]);
  worksheet.addRow(['Total Hours:', `${data.summary.totalHours}h`]);
  worksheet.addRow(['Total Activities:', data.summary.totalActivities]);
  worksheet.addRow([]);

  // Daily Breakdown Header
  worksheet.addRow(['DAILY BREAKDOWN']);
  if (worksheet.lastRow) {
    worksheet.getCell(`A${worksheet.lastRow.number}`).font = { bold: true, size: 12 };
  }
  worksheet.addRow([]);

  // Table Headers
  const headerRow = worksheet.addRow([
    'Date',
    'Day',
    'Check-In',
    'Check-Out',
    'Hours',
    'Status',
    'Activities',
    'Flags'
  ]);
  
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // Data Rows
  data.dailyBreakdown.forEach((day) => {
    const row = worksheet.addRow([
      day.date,
      day.dayName,
      day.checkIn,
      day.checkOut,
      `${day.hours}h`,
      day.status,
      day.activities,
      day.flags
    ]);

    // Color coding for status
    const statusCell = row.getCell(6);
    if (day.status === 'Present') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' }
      };
      statusCell.font = { color: { argb: 'FF065F46' } };
    } else if (day.status === 'Absent') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' }
      };
      statusCell.font = { color: { argb: 'FF991B1B' } };
    }

    row.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Add Activities Detail Section
  worksheet.addRow([]);
  worksheet.addRow(['ACTIVITIES DETAILS']);
  if (worksheet.lastRow) {
    worksheet.getCell(`A${worksheet.lastRow.number}`).font = { bold: true, size: 12 };
  }
  worksheet.addRow([]);

  // Activities Header
  const activityHeaderRow = worksheet.addRow(['Date', 'Time', 'Type', 'Title']);
  activityHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  activityHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' }
  };

  // Activities Data
  data.dailyBreakdown.forEach((day) => {
    if (day.activitiesDetail && day.activitiesDetail.length > 0) {
      day.activitiesDetail.forEach((activity) => {
        worksheet.addRow([
          day.date,
          activity.time,
          activity.type,
          activity.title
        ]);
      });
    }
  });

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${data.person.name.replace(/\s+/g, '_')}_Detailed_Attendance.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}

export async function generateDetailedPersonPdf(res: Response, data: ReportData) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.person.name.replace(/\s+/g, '_')}_Detailed_Attendance.pdf"`);

  doc.pipe(res);

  // Add logo if available
  try {
    const logoPath = path.join(__dirname, '../../../frontend/public/kardex-only.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }
  } catch (error) {
    }

  // Title (adjust position if logo exists)
  doc.fontSize(18).fillColor('#2563EB').text(`Service Person Attendance Report`, 160, 50, { align: 'left' });
  doc.fontSize(16).fillColor('#000000').text(data.person.name, { align: 'center' });
  doc.moveDown();

  // Person Info
  doc.fontSize(10);
  doc.text(`Email: ${data.person.email}`);
  if (data.person.phone) {
    doc.text(`Phone: ${data.person.phone}`);
  }
  doc.text(`Zones: ${data.person.zones}`);
  doc.text(`Period: ${data.period.from} to ${data.period.to}`);
  doc.moveDown();

  // Summary Box
  doc.fillColor('#2563EB').fontSize(12).text('SUMMARY', { underline: true });
  doc.fillColor('#000000').fontSize(10);
  doc.text(`Total Working Days: ${data.summary.totalDays}`);
  doc.text(`Present Days: ${data.summary.presentDays}`);
  doc.text(`Total Hours: ${data.summary.totalHours}h`);
  doc.text(`Total Activities: ${data.summary.totalActivities}`);
  doc.moveDown();

  // Daily Breakdown
  doc.fillColor('#2563EB').fontSize(12).text('DAILY BREAKDOWN', { underline: true });
  doc.moveDown(0.5);

  // Table
  const tableTop = doc.y;
  const rowHeight = 20;
  let y = tableTop;

  // Header
  doc.fillColor('#2563EB').fontSize(9);
  doc.text('Date', 50, y, { width: 70 });
  doc.text('Day', 120, y, { width: 40 });
  doc.text('In', 160, y, { width: 40 });
  doc.text('Out', 200, y, { width: 40 });
  doc.text('Hrs', 240, y, { width: 35 });
  doc.text('Status', 275, y, { width: 60 });
  doc.text('Act', 335, y, { width: 30 });
  doc.text('Flags', 365, y, { width: 150 });
  
  y += rowHeight;
  doc.moveTo(50, y).lineTo(550, y).stroke();

  // Data Rows
  doc.fillColor('#000000').fontSize(8);
  data.dailyBreakdown.slice(0, 25).forEach((day) => { // Limit to fit page
    y += rowHeight;
    
    doc.text(day.date, 50, y, { width: 70 });
    doc.text(day.dayName, 120, y, { width: 40 });
    doc.text(day.checkIn, 160, y, { width: 40 });
    doc.text(day.checkOut, 200, y, { width: 40 });
    doc.text(day.hours, 240, y, { width: 35 });
    
    // Color status
    if (day.status === 'Present') {
      doc.fillColor('#065F46');
    } else if (day.status === 'Absent') {
      doc.fillColor('#991B1B');
    }
    doc.text(day.status, 275, y, { width: 60 });
    doc.fillColor('#000000');
    
    doc.text(day.activities.toString(), 335, y, { width: 30 });
    doc.text(day.flags, 365, y, { width: 150 });

    if (y > 700) { // Page break
      doc.addPage();
      y = 50;
    }
  });

  // Note if more data exists
  if (data.dailyBreakdown.length > 25) {
    doc.moveDown();
    doc.fontSize(8).fillColor('#666666').text(`Note: Showing first 25 days. Download Excel for complete data.`);
  }

  doc.end();
}
