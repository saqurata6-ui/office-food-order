import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventData, UserOrder, MenuItem } from '@/types';
import { formatRupiah, formatIndonesianDate } from './calculator';

export function getGroupedRestaurantOrders(
  orders: UserOrder[],
  sortBy: 'first_added' | 'latest_added' | 'qty_desc' | 'name_asc' = 'first_added'
) {
  const menuMap: Record<
    string,
    {
      menuItemId: string;
      name: string;
      totalQty: number;
      price: number;
      notes: string[];
      firstAddedTime: number;
      latestAddedTime: number;
    }
  > = {};

  orders.forEach((order) => {
    const orderTime = new Date(order.createdAt || order.updatedAt || Date.now()).getTime();
    order.items.forEach((item) => {
      if (!menuMap[item.menuItemId]) {
        menuMap[item.menuItemId] = {
          menuItemId: item.menuItemId,
          name: item.menuItemName,
          totalQty: 0,
          price: item.price,
          notes: [],
          firstAddedTime: orderTime,
          latestAddedTime: orderTime,
        };
      } else {
        menuMap[item.menuItemId].firstAddedTime = Math.min(
          menuMap[item.menuItemId].firstAddedTime,
          orderTime
        );
        menuMap[item.menuItemId].latestAddedTime = Math.max(
          menuMap[item.menuItemId].latestAddedTime,
          orderTime
        );
      }
      menuMap[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        menuMap[item.menuItemId].notes.push(
          `${item.quantity > 1 ? `${item.quantity}x ` : ''}${order.userName}: "${item.notes.trim()}"`
        );
      }
    });
  });

  const list = Object.values(menuMap);

  if (sortBy === 'first_added') {
    // Urut berdasarkan menu yang pertama kali dipesan/masuk list
    return list.sort((a, b) => a.firstAddedTime - b.firstAddedTime);
  }
  if (sortBy === 'latest_added') {
    // Urut berdasarkan waktu penambahan terakhir (terbaru di atas)
    return list.sort((a, b) => b.latestAddedTime - a.latestAddedTime);
  }
  if (sortBy === 'name_asc') {
    // Urut berdasarkan nama menu abjad A-Z
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  // Default qty_desc: terbanyak di atas
  return list.sort((a, b) => b.totalQty - a.totalQty);
}

export function exportToExcel(event: EventData, orders: UserOrder[]) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Rekap Resto
  const grouped = getGroupedRestaurantOrders(orders);
  const restoData = [
    ['REKAP PESANAN RESTORAN'],
    [`Acara: ${event.title}`],
    [`PIC: ${event.picName}`],
    [`Tempat: ${event.restaurantName} (${event.restaurantAddress})`],
    [`Waktu: ${event.date} - ${event.time}`],
    [],
    ['No', 'Nama Menu', 'Jumlah Porsi', 'Harga Satuan', 'Subtotal', 'Catatan Khusus'],
    ...grouped.map((item, idx) => [
      idx + 1,
      item.name,
      item.totalQty,
      item.price,
      item.totalQty * item.price,
      item.notes.join('; ') || '-',
    ]),
    [],
    [
      'TOTAL PORSI',
      grouped.reduce((sum, it) => sum + it.totalQty, 0),
      '',
      'TOTAL BIAYA',
      grouped.reduce((sum, it) => sum + (it.totalQty * it.price), 0),
      '',
    ],
  ];
  const wsResto = XLSX.utils.aoa_to_sheet(restoData);
  XLSX.utils.book_append_sheet(wb, wsResto, 'Rekap Restoran');

  // 2. Sheet Split Bill per Nama
  const splitBillData = [
    ['REKAP TAGIHAN PER NAMA (SPLIT BILL)'],
    [`Acara: ${event.title}`],
    [`PPN: ${event.taxConfig.useTax ? `${event.taxConfig.taxPercent}%` : 'Tidak'}`],
    [`Pembulatan: ${event.taxConfig.rounding === 'none' ? 'Tidak Ada' : `Rp ${event.taxConfig.rounding}`}`],
    [],
    ['No', 'Nama', 'Rincian Menu', 'Subtotal', 'PPN', 'Pembulatan', 'Total Bayar', 'Status Bayar', 'Metode Bayar', 'Uang Diterima', 'Kembalian'],
    ...orders.map((order, idx) => [
      idx + 1,
      order.userName,
      order.items.map((it) => `${it.quantity}x ${it.menuItemName}${it.notes ? ` (${it.notes})` : ''}`).join(', '),
      order.subtotal,
      order.taxAmount,
      order.roundingAmount,
      order.totalAmount,
      order.isPaid ? 'Lunas' : 'Belum Bayar',
      order.isPaid ? (order.paymentMethod === 'cash' ? 'Cash' : 'Transfer') : '-',
      order.paidAmount ? order.paidAmount : (order.isPaid ? order.totalAmount : '-'),
      order.changeAmount != null ? order.changeAmount : (order.isPaid ? 0 : '-'),
    ]),
    [],
    [
      '',
      'TOTAL KESELURUHAN',
      '',
      orders.reduce((sum, o) => sum + o.subtotal, 0),
      orders.reduce((sum, o) => sum + o.taxAmount, 0),
      orders.reduce((sum, o) => sum + o.roundingAmount, 0),
      orders.reduce((sum, o) => sum + o.totalAmount, 0),
      `Lunas: ${orders.filter((o) => o.isPaid).length} / ${orders.length}`,
    ],
  ];
  const wsSplit = XLSX.utils.aoa_to_sheet(splitBillData);
  XLSX.utils.book_append_sheet(wb, wsSplit, 'Split Bill Per Nama');

  const filename = `Rekap_Pesanan_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${event.date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF();
  const grouped = getGroupedRestaurantOrders(orders);

  // Title & Header
  doc.setFontSize(18);
  doc.text('REKAP PESANAN KANTOR', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Acara: ${event.title}`, 14, 25);
  doc.text(`PIC: ${event.picName} | Tanggal: ${event.date} pk ${event.time}`, 14, 31);
  doc.text(`Lokasi: ${event.restaurantName} - ${event.restaurantAddress}`, 14, 37);
  doc.text(`Status: ${event.isLocked ? 'TERKUNCI (SELESAI)' : 'BUKA'}`, 14, 43);

  // Table 1: Resto Orders
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text('1. Daftar Pesanan untuk Restoran / Dapur', 14, 52);

  const restoRows = grouped.map((item, idx) => [
    idx + 1,
    item.name,
    `${item.totalQty} porsi`,
    formatRupiah(item.price),
    formatRupiah(item.totalQty * item.price),
    item.notes.join('\n') || '-',
  ]);

  const totalPorsi = grouped.reduce((sum, it) => sum + it.totalQty, 0);
  const totalBiayaResto = grouped.reduce((sum, it) => sum + (it.totalQty * it.price), 0);

  restoRows.push([
    '',
    'TOTAL',
    `${totalPorsi} porsi`,
    '',
    formatRupiah(totalBiayaResto),
    '',
  ]);

  autoTable(doc, {
    startY: 56,
    head: [['No', 'Menu', 'Jumlah', 'Harga', 'Subtotal', 'Catatan']],
    body: restoRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Table 2: Split Bill
  const nextY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFontSize(13);
  doc.text('2. Rekap Tagihan per Karyawan (Split Bill)', 14, nextY);

  const splitRows = orders.map((order, idx) => {
    let statusText = 'Belum';
    if (order.isPaid) {
      if (order.paymentMethod === 'cash') {
        statusText = order.changeAmount && order.changeAmount > 0
          ? `Lunas (Cash, Kemb: ${formatRupiah(order.changeAmount)})`
          : 'Lunas (Cash)';
      } else {
        statusText = 'Lunas (TF)';
      }
    }
    return [
      idx + 1,
      order.userName,
      order.items.map((it) => `${it.quantity}x ${it.menuItemName}`).join(', '),
      formatRupiah(order.subtotal),
      formatRupiah(order.taxAmount),
      formatRupiah(order.roundingAmount),
      formatRupiah(order.totalAmount),
      statusText,
    ];
  });

  const totalAll = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  splitRows.push([
    '',
    'TOTAL SEMUA',
    '',
    '',
    '',
    '',
    formatRupiah(totalAll),
    `${orders.filter((o) => o.isPaid).length}/${orders.length} Lunas`,
  ]);

  autoTable(doc, {
    startY: nextY + 4,
    head: [['No', 'Nama', 'Pesanan', 'Subtotal', 'PPN', 'Bulat', 'Total', 'Status']],
    body: splitRows,
    theme: 'grid',
    headStyles: { fillColor: [39, 174, 96], textColor: 255 },
    styles: { fontSize: 8.5 },
  });

  const filename = `Rekap_Pesanan_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_${event.date}.pdf`;
  doc.save(filename);
}

// Rekap PDF Dapur / Resto Ringkas: Hanya Menu, Jumlah (x), dan Catatan (Dipisahkan Makanan & Minuman)
export function exportToKitchenPdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF();

  // Kumpulkan pesanan makanan & minuman menggunakan isBeverageItem yang akurat
  const foodMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};
  const drinkMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const isBeverage = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || []);
      const targetMap = isBeverage ? drinkMap : foodMap;

      if (!targetMap[item.menuItemId]) {
        targetMap[item.menuItemId] = {
          name: item.menuItemName,
          totalQty: 0,
          notes: [],
        };
      }
      targetMap[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        targetMap[item.menuItemId].notes.push(item.notes.trim());
      }
    });
  });

  const foodList = Object.values(foodMap);
  const drinkList = Object.values(drinkMap);

  // Title Utama
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 24, 33);
  doc.text('DAFTAR PESANAN MENU', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Restoran: ${event.restaurantName || '-'}`, 14, 25);

  let currentY = 32;

  // 1. Bagian Makanan
  if (foodList.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('MAKANAN', 14, currentY);

    const foodRows = foodList.map((item, idx) => [
      idx + 1,
      item.name,
      `${item.totalQty}x`,
      item.notes.length > 0 ? item.notes.map((n) => `• ${n}`).join('\n') : '-',
    ]);

    const totalFoodQty = foodList.reduce((sum, it) => sum + it.totalQty, 0);
    foodRows.push([
      '',
      'TOTAL MAKANAN',
      `${totalFoodQty}x`,
      '',
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['No', 'Nama Menu', 'Jumlah', 'Catatan']],
      body: foodRows,
      theme: 'grid',
      headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
      bodyStyles: { fontSize: 9, textColor: 30 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        3: { textColor: [71, 85, 105] },
      },
      styles: { cellPadding: 3 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 2. Bagian Minuman
  if (drinkList.length > 0) {
    // Jika posisi mendekati batas bawah halaman, buat halaman baru
    if (currentY > 230) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('MINUMAN', 14, currentY);

    const drinkRows = drinkList.map((item, idx) => [
      idx + 1,
      item.name,
      `${item.totalQty}x`,
      item.notes.length > 0 ? item.notes.map((n) => `• ${n}`).join('\n') : '-',
    ]);

    const totalDrinkQty = drinkList.reduce((sum, it) => sum + it.totalQty, 0);
    drinkRows.push([
      '',
      'TOTAL MINUMAN',
      `${totalDrinkQty}x`,
      '',
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['No', 'Nama Menu', 'Jumlah', 'Catatan']],
      body: drinkRows,
      theme: 'grid',
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
      bodyStyles: { fontSize: 9, textColor: 30 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { fontStyle: 'bold' },
        2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        3: { textColor: [71, 85, 105] },
      },
      styles: { cellPadding: 3 },
    });
  }

  const cleanResto = (event.restaurantName || 'Resto').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Daftar_Pesanan_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
}

// Helper universal untuk mendeteksi apakah suatu item tergolong Minuman atau Makanan
// Prioritas: 1) Kategori resmi di menuItem, 2) Kata kunci kategori, 3) Kata kunci nama item
export function isBeverageItem(menuItemId: string, menuName: string, menuItems: MenuItem[] = []): boolean {
  // 1. Cek dari daftar menu acara berdasarkan ID atau kecocokan nama
  const foundItem = menuItems.find(
    (m) => m.id === menuItemId || m.name.toLowerCase().trim() === menuName.toLowerCase().trim()
  );
  const cat = (foundItem?.category || '').toLowerCase().trim();
  const name = (menuName || foundItem?.name || '').toLowerCase().trim();

  // Jika kategorinya jelas menyebut Minuman / Drink / Beverage
  if (cat.includes('minum') || cat.includes('drink') || cat.includes('beverage')) {
    return true;
  }
  // Jika kategorinya jelas menyebut Makanan / Sate / Gorengan / Snack / Cemilan / Paket / Lauk / Nasi
  if (
    cat.includes('makan') ||
    cat.includes('sate') ||
    cat.includes('goreng') ||
    cat.includes('snack') ||
    cat.includes('cemil') ||
    cat.includes('paket') ||
    cat.includes('lauk') ||
    cat.includes('nasi') ||
    cat.includes('mie') ||
    cat.includes('soto')
  ) {
    return false;
  }

  // 2. Fallback deteksi dari kata kunci nama menu (hanya jika kategorinya 'Lainnya' atau kosong)
  const drinkKeywords = [
    'es ', 'es-', 'es.', ' ice ', 'ice ', 'teh', 'tea', 'kopi', 'coffee',
    'jeruk', 'lemon', 'air mineral', 'mineral', 'aqua', 'le minerale',
    'juice', 'jus', 'susu', 'milk', 'boba', 'latte', 'cappuccino', 'syrup',
    'sirup', 'wedang', 'jahe', 'liang teh', 'soda', 'coca', 'fanta', 'sprite'
  ];
  return drinkKeywords.some((kw) => name.includes(kw));
}

// Rekap PDF Format Sejajar 1/2 A4 Landscape (Ukuran 210mm x 148.5mm / A5 Landscape)
// Didesain bersih, tajam, dan presisi tinggi sesuai template HTML cetak
export function exportToLandscapeHalfA4Pdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [148.5, 210], // height: 148.5mm, width: 210mm
  });

  // Kelompokkan menu makanan & minuman menggunakan isBeverageItem yang akurat
  const foodMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};
  const drinkMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const isBeverage = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || []);
      const targetMap = isBeverage ? drinkMap : foodMap;

      if (!targetMap[item.menuItemId]) {
        targetMap[item.menuItemId] = {
          name: item.menuItemName,
          totalQty: 0,
          notes: [],
        };
      }
      targetMap[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        targetMap[item.menuItemId].notes.push(item.notes.trim());
      }
    });
  });

  const foodList = Object.values(foodMap);
  const drinkList = Object.values(drinkMap);

  const totalFoodQty = foodList.reduce((sum, it) => sum + it.totalQty, 0);
  const totalDrinkQty = drinkList.reduce((sum, it) => sum + it.totalQty, 0);
  const grandTotalQty = totalFoodQty + totalDrinkQty;

  const pageWidth = 210;
  const pageHeight = 148.5;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm
  const colGap = 8;
  const colWidth = (contentWidth - colGap) / 2; // 91mm

  // 1. Header Utama
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text('REKAP PESANAN', margin, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748b
  const subtitle = event.restaurantName
    ? `FORMAT KATEGORI SEJAJAR • ${event.restaurantName.toUpperCase()}`
    : 'FORMAT KATEGORI SEJAJAR';
  doc.text(subtitle, pageWidth - margin, 13, { align: 'right' });

  // Border garis bawah header
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, 16, pageWidth - margin, 16);

  const tableStartY = 19;

  // Format data baris makanan
  const foodBody = foodList.map((item) => {
    let text = item.name;
    if (item.notes && item.notes.length > 0) {
      text += '\n' + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
    }
    return [text, `${item.totalQty}`];
  });
  if (foodBody.length === 0) {
    foodBody.push(['(Tidak ada pesanan makanan)', '-']);
  }

  // Format data baris minuman
  const drinkBody = drinkList.map((item) => {
    let text = item.name;
    if (item.notes && item.notes.length > 0) {
      text += '\n' + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
    }
    return [text, `${item.totalQty}`];
  });
  if (drinkBody.length === 0) {
    drinkBody.push(['(Tidak ada pesanan minuman)', '-']);
  }

  // Tabel Kolom 1: MAKANAN
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: pageWidth - margin - colWidth },
    tableWidth: colWidth,
    head: [['MAKANAN', 'JUMLAH']],
    body: foodBody,
    foot: [['TOTAL MAKANAN', `${totalFoodQty}`]],
    theme: 'plain',
    headStyles: {
      fillColor: [30, 41, 59], // #1e293b
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.2 },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.5 },
    },
    columnStyles: {
      0: { cellWidth: colWidth - 16, halign: 'left' },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      // Style badge kotak jumlah rapi
      if (data.section === 'body' && data.column.index === 1 && data.cell.raw !== '-') {
        const x = data.cell.x + 2.5;
        const y = data.cell.y + 1;
        const w = data.cell.width - 5;
        const h = data.cell.height - 2;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, w, h, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(data.cell.raw), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.2, {
          align: 'center',
        });
      }
    },
  });

  const finalYFood = (doc as any).lastAutoTable.finalY || 100;

  // Garis vertikal pembatas kolom
  const col2Left = margin + colWidth + colGap;
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.line(col2Left - colGap / 2, tableStartY, col2Left - colGap / 2, Math.max(finalYFood, 125));

  // Tabel Kolom 2: MINUMAN
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: col2Left, right: margin },
    tableWidth: colWidth,
    head: [['MINUMAN', 'JUMLAH']],
    body: drinkBody,
    foot: [['TOTAL MINUMAN', `${totalDrinkQty}`]],
    theme: 'plain',
    headStyles: {
      fillColor: [3, 105, 161], // #0369a1
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.2 },
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.5 },
    },
    columnStyles: {
      0: { cellWidth: colWidth - 16, halign: 'left' },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1 && data.cell.raw !== '-') {
        const x = data.cell.x + 2.5;
        const y = data.cell.y + 1;
        const w = data.cell.width - 5;
        const h = data.cell.height - 2;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, w, h, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(data.cell.raw), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.2, {
          align: 'center',
        });
      }
    },
  });

  // Footer Grand Total
  const footerY = pageHeight - 12;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REKAPITULASI AKHIR PESANAN', margin, footerY + 2.5);

  const totalLabel = 'TOTAL ITEM:';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const badgeX = pageWidth - margin - 16;
  doc.text(totalLabel, badgeX - 3, footerY + 2.5, { align: 'right' });

  // Dark badge
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(badgeX, footerY - 1.5, 16, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${grandTotalQty}`, badgeX + 8, footerY + 2.7, { align: 'center' });

  const cleanResto = (event.restaurantName || 'Resto').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Sejajar_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
}

// Fitur Cetak / Preview HTML Landscape 1/2 A4 (100% Presisi Pixel Sesuai Template Desain)
export function printLandscapeHalfA4Html(event: EventData, orders: UserOrder[]) {
  const foodMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};
  const drinkMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const isBeverage = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || []);
      const targetMap = isBeverage ? drinkMap : foodMap;

      if (!targetMap[item.menuItemId]) {
        targetMap[item.menuItemId] = {
          name: item.menuItemName,
          totalQty: 0,
          notes: [],
        };
      }
      targetMap[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        targetMap[item.menuItemId].notes.push(item.notes.trim());
      }
    });
  });

  const foodList = Object.values(foodMap);
  const drinkList = Object.values(drinkMap);
  const totalFoodQty = foodList.reduce((sum, it) => sum + it.totalQty, 0);
  const totalDrinkQty = drinkList.reduce((sum, it) => sum + it.totalQty, 0);
  const grandTotalQty = totalFoodQty + totalDrinkQty;

  const foodRowsHtml = foodList.length > 0
    ? foodList.map((it) => `
      <tr>
        <td class="col-name">
          <div class="item-name">${it.name}</div>
          ${it.notes.length > 0 ? it.notes.map((n) => `<div class="item-note"><span class="arrow">↳</span>Catatan: <em>${n}</em></div>`).join('') : ''}
        </td>
        <td class="col-qty">
          <span class="qty-badge">${it.totalQty}</span>
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="2" style="padding: 10px 0; color: #94a3b8; text-align: center;">(Tidak ada pesanan makanan)</td></tr>`;

  const drinkRowsHtml = drinkList.length > 0
    ? drinkList.map((it) => `
      <tr>
        <td class="col-name">
          <div class="item-name">${it.name}</div>
          ${it.notes.length > 0 ? it.notes.map((n) => `<div class="item-note"><span class="arrow">↳</span>Catatan: <em>${n}</em></div>`).join('') : ''}
        </td>
        <td class="col-qty">
          <span class="qty-badge">${it.totalQty}</span>
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="2" style="padding: 10px 0; color: #94a3b8; text-align: center;">(Tidak ada pesanan minuman)</td></tr>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Pesanan - ${event.restaurantName || event.title}</title>
  <style>
    @page {
      size: 210mm 148.5mm;
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      padding: 15px;
    }
    .rekap-sheet {
      width: 210mm;
      min-height: 148.5mm;
      max-width: 100%;
      background: #ffffff;
      margin: 0 auto;
      padding: 16px 20px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #0f172a;
    }
    .header-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .category-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .col-makanan {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .col-minuman {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-left: 1px solid #e2e8f0;
      padding-left: 20px;
    }
    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
      color: #ffffff;
    }
    .bg-makanan { background-color: #1e293b; }
    .bg-minuman { background-color: #0369a1; }
    .item-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 12px;
    }
    .item-table tr { border-bottom: 1px solid #f1f5f9; }
    .item-table td { padding: 6px 0; vertical-align: top; }
    .col-name { width: auto; padding-right: 8px; }
    .col-qty { width: 50px; text-align: center; }
    .item-name {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      line-height: 1.3;
    }
    .item-note {
      font-size: 10.5px;
      color: #78350f;
      font-weight: 500;
      margin-top: 2px;
      line-height: 1.2;
    }
    .item-note span.arrow {
      color: #d97706;
      font-weight: bold;
      margin-right: 2px;
    }
    .qty-badge {
      display: inline-block;
      width: 32px;
      padding: 2px 0;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 800;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .subtotal-bar {
      margin-top: 8px;
      padding: 5px 10px;
      background: #f8fafc;
      border-top: 2px solid #cbd5e1;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .subtotal-val {
      width: 50px;
      text-align: center;
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 2px solid #0f172a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grand-total-box {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grand-total-text {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
    }
    .grand-total-badge {
      background: #0f172a;
      color: #ffffff;
      font-size: 12px;
      font-weight: 900;
      padding: 3px 12px;
      border-radius: 4px;
      font-variant-numeric: tabular-nums;
    }
    @media print {
      body { background: transparent !important; padding: 0 !important; }
      .rekap-sheet {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="rekap-sheet">
    <div>
      <div class="header">
        <div class="header-title">REKAP PESANAN</div>
        <div class="header-subtitle">${event.restaurantName ? event.restaurantName.toUpperCase() : 'FORMAT KATEGORI SEJAJAR'}</div>
      </div>
      <div class="category-grid">
        <div class="col-makanan">
          <div>
            <div class="category-header bg-makanan">
              <span>MAKANAN</span>
              <span style="width: 50px; text-align: center;">JUMLAH</span>
            </div>
            <table class="item-table">
              <tbody>
                ${foodRowsHtml}
              </tbody>
            </table>
          </div>
          <div class="subtotal-bar">
            <span>Total Makanan</span>
            <span class="subtotal-val">${totalFoodQty}</span>
          </div>
        </div>
        <div class="col-minuman">
          <div>
            <div class="category-header bg-minuman">
              <span>MINUMAN</span>
              <span style="width: 50px; text-align: center;">JUMLAH</span>
            </div>
            <table class="item-table">
              <tbody>
                ${drinkRowsHtml}
              </tbody>
            </table>
          </div>
          <div class="subtotal-bar">
            <span>Total Minuman</span>
            <span class="subtotal-val">${totalDrinkQty}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span class="footer-label">Rekapitulasi Akhir Pesanan</span>
      <div class="grand-total-box">
        <span class="grand-total-text">TOTAL ITEM:</span>
        <span class="grand-total-badge">${grandTotalQty}</span>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`;

  // Buka tab/window baru yang otomatis memicu print browser (dengan layout CSS asli 100%)
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

export function generateWhatsAppMessage(event: EventData, baseUrl: string) {
  const url = `${baseUrl}/order/${event.id}`;
  return `🍱 *Pesanan Makan Kantor: ${event.title}*
👤 *PIC:* ${event.picName}
📍 *Tempat:* ${event.restaurantName}${event.restaurantAddress ? ` (${event.restaurantAddress})` : ''}
⏰ *Waktu:* ${formatIndonesianDate(event.date)} jam ${event.time} WIB

Yuk langsung pilih menu makanan & minuman masing-masing di link berikut:
👉 ${url}

ℹ️ *Catatan:*
- Total tagihan per orang sudah otomatis dihitung termasuk ${event.taxConfig.useTax ? `PPN ${event.taxConfig.taxPercent}%` : 'tanpa PPN'}.
- Kamu masih bisa mengubah pesanan sebelum status dikunci oleh PIC.

Terima kasih! 🙏`;
}
