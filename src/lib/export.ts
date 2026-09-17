import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventData, UserOrder } from '@/types';
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

  // Helper untuk deteksi minuman berdasarkan kategori atau nama menu
  const isDrink = (menuItemId: string, menuName: string): boolean => {
    const foundItem = event.menuItems?.find((m) => m.id === menuItemId);
    const category = (foundItem?.category || '').toLowerCase();
    const name = (menuName || foundItem?.name || '').toLowerCase();

    if (category.includes('minum') || category.includes('drink') || category.includes('beverage')) {
      return true;
    }
    // Fallback deteksi dari kata kunci nama menu jika kategorinya tidak spesifik
    const drinkKeywords = [
      'es ', 'es-', 'es.', 'teh', 'kopi', 'coffee', 'jeruk', 'lemon', 'air mineral', 'mineral',
      'juice', 'jus', 'susu', 'boba', 'latte', 'cappuccino', 'syrup', 'sirup', 'wedang', 'jahe', 'liang teh'
    ];
    return drinkKeywords.some((kw) => name.includes(kw));
  };

  // Kumpulkan pesanan makanan & minuman
  const foodMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};
  const drinkMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const isBeverage = isDrink(item.menuItemId, item.menuItemName);
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

// Rekap PDF Format Sejajar 1/2 A4 Landscape (Ukuran 210mm x 148.5mm / A5 Landscape)
// 2 Kolom Sejajar: Kolom Kiri Makanan & Kolom Kanan Minuman, Subtotal masing-masing, dan Grand Total Item
export function exportToLandscapeHalfA4Pdf(event: EventData, orders: UserOrder[]) {
  // Ukuran 1/2 A4 Landscape = 210mm x 148.5mm (A5 Landscape)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [148.5, 210], // height: 148.5mm, width: 210mm
  });

  // Helper untuk deteksi minuman berdasarkan kategori atau nama menu
  const isDrink = (menuItemId: string, menuName: string): boolean => {
    const foundItem = event.menuItems?.find((m) => m.id === menuItemId);
    const category = (foundItem?.category || '').toLowerCase();
    const name = (menuName || foundItem?.name || '').toLowerCase();

    if (category.includes('minum') || category.includes('drink') || category.includes('beverage')) {
      return true;
    }
    const drinkKeywords = [
      'es ', 'es-', 'es.', 'teh', 'kopi', 'coffee', 'jeruk', 'lemon', 'air mineral', 'mineral',
      'juice', 'jus', 'susu', 'boba', 'latte', 'cappuccino', 'syrup', 'sirup', 'wedang', 'jahe', 'liang teh'
    ];
    return drinkKeywords.some((kw) => name.includes(kw));
  };

  // Kelompokkan menu makanan & minuman
  const foodMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};
  const drinkMap: Record<string, { name: string; totalQty: number; notes: string[] }> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const isBeverage = isDrink(item.menuItemId, item.menuItemName);
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
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194mm
  const colGap = 6;
  const colWidth = (contentWidth - colGap) / 2; // 94mm

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text('REKAP PESANAN', margin, 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748b
  const subtitle = event.restaurantName ? `FORMAT KATEGORI SEJAJAR • ${event.restaurantName.toUpperCase()}` : 'FORMAT KATEGORI SEJAJAR';
  doc.text(subtitle, pageWidth - margin, 13, { align: 'right' });

  // Border garis bawah header (2px ≈ 0.6mm)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(margin, 16, pageWidth - margin, 16);

  const tableStartY = 19;

  // Format baris makanan
  const foodBody = foodList.map((item) => {
    let text = item.name;
    if (item.notes && item.notes.length > 0) {
      text += `\n` + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
    }
    return [text, `${item.totalQty}`];
  });

  if (foodBody.length === 0) {
    foodBody.push(['(Tidak ada pesanan makanan)', '-']);
  }

  // Format baris minuman
  const drinkBody = drinkList.map((item) => {
    let text = item.name;
    if (item.notes && item.notes.length > 0) {
      text += `\n` + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
    }
    return [text, `${item.totalQty}`];
  });

  if (drinkBody.length === 0) {
    drinkBody.push(['(Tidak ada pesanan minuman)', '-']);
  }

  // AutoTable Kolom 1: MAKANAN
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: pageWidth - margin - colWidth },
    tableWidth: colWidth,
    head: [['MAKANAN', 'JUMLAH']],
    body: foodBody,
    foot: [['TOTAL MAKANAN', `${totalFoodQty}`]],
    theme: 'plain',
    headStyles: {
      fillColor: [30, 41, 59], // #1e293b Dark Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.2 },
    },
    footStyles: {
      fillColor: [248, 250, 252], // #f8fafc
      textColor: [71, 85, 105], // #475569
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: colWidth - 16, halign: 'left' },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      // Highlight Qty badge style in body
      if (data.section === 'body' && data.column.index === 1 && data.cell.raw !== '-') {
        // Draw small badge background box
        const x = data.cell.x + 2.5;
        const y = data.cell.y + 1;
        const w = data.cell.width - 5;
        const h = data.cell.height - 2;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, w, h, 1, 1, 'FD');
        // Redraw text over the badge
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

  // Garis pemisah vertikal antar 2 kolom
  const col2Left = margin + colWidth + colGap;
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.line(col2Left - colGap / 2, tableStartY, col2Left - colGap / 2, Math.max(finalYFood, 128));

  // AutoTable Kolom 2: MINUMAN
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: col2Left, right: margin },
    tableWidth: colWidth,
    head: [['MINUMAN', 'JUMLAH']],
    body: drinkBody,
    foot: [['TOTAL MINUMAN', `${totalDrinkQty}`]],
    theme: 'plain',
    headStyles: {
      fillColor: [3, 105, 161], // #0369a1 Sky Blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 },
      lineColor: [241, 245, 249],
      lineWidth: { bottom: 0.2 },
    },
    footStyles: {
      fillColor: [248, 250, 252], // #f8fafc
      textColor: [71, 85, 105], // #475569
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: colWidth - 16, halign: 'left' },
      1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      // Highlight Qty badge style in body
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

  // 3. Footer Grand Total di bagian bawah
  const footerY = pageHeight - 11;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text('REKAPITULASI AKHIR PESANAN', margin, footerY + 2.5);

  const totalLabel = 'TOTAL ITEM:';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const badgeX = pageWidth - margin - 16;
  doc.text(totalLabel, badgeX - 3, footerY + 2.5, { align: 'right' });

  // Dark badge for grand total number
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.roundedRect(badgeX, footerY - 1.5, 16, 6, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${grandTotalQty}`, badgeX + 8, footerY + 2.7, { align: 'center' });

  const cleanResto = (event.restaurantName || 'Resto').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Sejajar_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
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
