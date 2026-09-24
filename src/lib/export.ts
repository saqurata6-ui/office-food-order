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

// Rekap PDF Format 1/2 A4 Landscape (210mm x 148.5mm / A5 Landscape, Kiri-Kanan)
// Didesain sangat rapi, bersih, hemat kertas, dan membagi kategori secara seimbang
export function exportToLandscapeHalfA4Pdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [148.5, 210], // 210mm x 148.5mm
  });

  const pageWidth = 210;
  const pageHeight = 148.5;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm
  const colGap = 8;
  const colWidth = (contentWidth - colGap) / 2; // 91mm

  // 1. Kumpulkan data menu & kelompokkan per kategori
  const knownCategories: string[] = [];
  if (event.menuItems && Array.isArray(event.menuItems)) {
    event.menuItems.forEach((m) => {
      const cat = (m.category || '').trim();
      if (cat && !knownCategories.includes(cat)) {
        knownCategories.push(cat);
      }
    });
  }

  const categoryMap: Record<string, Record<string, { name: string; totalQty: number; notes: string[] }>> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const foundMenuItem = event.menuItems?.find(
        (m) => m.id === item.menuItemId || m.name.toLowerCase().trim() === item.menuItemName.toLowerCase().trim()
      );

      let category = (foundMenuItem?.category || '').trim();
      if (!category) {
        category = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || [])
          ? 'Minuman'
          : 'Makanan';
      }

      if (!categoryMap[category]) {
        categoryMap[category] = {};
        if (!knownCategories.includes(category)) {
          knownCategories.push(category);
        }
      }

      const catGroup = categoryMap[category];
      if (!catGroup[item.menuItemId]) {
        catGroup[item.menuItemId] = {
          name: item.menuItemName,
          totalQty: 0,
          notes: [],
        };
      }

      catGroup[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        const trimmed = item.notes.trim();
        if (!catGroup[item.menuItemId].notes.includes(trimmed)) {
          catGroup[item.menuItemId].notes.push(trimmed);
        }
      }
    });
  });

  const activeCategories = knownCategories.filter(
    (cat) => categoryMap[cat] && Object.keys(categoryMap[cat]).length > 0
  );
  Object.keys(categoryMap).forEach((cat) => {
    if (!activeCategories.includes(cat) && Object.keys(categoryMap[cat]).length > 0) {
      activeCategories.push(cat);
    }
  });

  let grandTotalQty = 0;
  activeCategories.forEach((cat) => {
    Object.values(categoryMap[cat]).forEach((it) => {
      grandTotalQty += it.totalQty;
    });
  });

  // 2. Bagi kategori ke Kolom Kiri dan Kolom Kanan
  // Prioritas: kategori minuman ditaruh di kanan, kategori makanan/lainnya di kiri.
  // Jika tidak seimbang atau semua jenis sama, bagi rata secara proporsional.
  let leftCategories: string[] = [];
  let rightCategories: string[] = [];

  const beverageCategories = activeCategories.filter((cat) => {
    const c = cat.toLowerCase();
    return c.includes('minum') || c.includes('drink') || c.includes('beverage') || c.includes('kopi') || c.includes('jus') || c.includes('tea') || c.includes('teh');
  });
  const foodCategories = activeCategories.filter((cat) => !beverageCategories.includes(cat));

  if (beverageCategories.length > 0 && foodCategories.length > 0) {
    leftCategories = foodCategories;
    rightCategories = beverageCategories;
  } else {
    // Bagi seimbang berdasarkan estimasi bobot baris
    let leftWeight = 0;
    let rightWeight = 0;
    activeCategories.forEach((cat) => {
      const weight = Object.keys(categoryMap[cat]).length + 2;
      if (leftWeight <= rightWeight) {
        leftCategories.push(cat);
        leftWeight += weight;
      } else {
        rightCategories.push(cat);
        rightWeight += weight;
      }
    });
  }

  // 3. Header Utama (Landscape 1/2 A4)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('REKAP PESANAN', margin, 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const restoTitle = event.restaurantName ? event.restaurantName.toUpperCase() : event.title;
  doc.text(restoTitle, margin + 48, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const subInfo = `${formatIndonesianDate(event.date)} pk ${event.time} WIB`;
  doc.text(subInfo, pageWidth - margin, 11, { align: 'right' });

  // Garis pemisah header
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, 14, pageWidth - margin, 14);

  // Garis vertikal pemisah kolom kiri & kanan di tengah
  const colDividerX = margin + colWidth + colGap / 2; // 105mm
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(colDividerX, 17, colDividerX, pageHeight - 16);

  // Helper untuk merender kelompok kategori pada satu kolom (kiri atau kanan)
  const renderColumn = (colCats: string[], startX: number) => {
    let colY = 17;

    if (colCats.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('(Tidak ada pesanan)', startX + 2, colY + 6);
      return;
    }

    colCats.forEach((catName) => {
      const items = Object.values(categoryMap[catName]);
      const catTotal = items.reduce((sum, it) => sum + it.totalQty, 0);

      const isDrink = catName.toLowerCase().includes('minum') || catName.toLowerCase().includes('drink') || catName.toLowerCase().includes('teh') || catName.toLowerCase().includes('kopi');
      const headerColor: [number, number, number] = isDrink ? [3, 105, 161] : [30, 41, 59];

      const tableRows = items.map((item) => {
        let text = item.name;
        if (item.notes.length > 0) {
          text += '\n' + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
        }
        return [text, `${item.totalQty}`];
      });

      autoTable(doc, {
        startY: colY,
        margin: { left: startX, right: pageWidth - startX - colWidth },
        tableWidth: colWidth,
        head: [[
          { content: catName.toUpperCase(), styles: { halign: 'left' } },
          { content: '', styles: { halign: 'center' } },
        ]],
        body: tableRows,
        foot: [[
          { content: `Total ${catName}`, styles: { halign: 'left', fontStyle: 'bold' } },
          { content: `${catTotal}`, styles: { halign: 'center', fontStyle: 'bold', textColor: [15, 23, 42] } },
        ]],
        theme: 'plain',
        headStyles: {
          fillColor: headerColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
          lineColor: [241, 245, 249],
          lineWidth: { bottom: 0.2 },
        },
        footStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
          lineColor: [226, 232, 240],
          lineWidth: { top: 0.3 },
        },
        columnStyles: {
          0: { cellWidth: colWidth - 20, halign: 'left', valign: 'top' },
          1: { cellWidth: 20, halign: 'center', valign: 'top', fontStyle: 'bold' },
        },
        didDrawCell: (data) => {
          // Format kolom jumlah: badge kotak rapi dengan teks terpusat
          if (data.section === 'body' && data.column.index === 1) {
            const rawVal = String(data.cell.raw || '');
            const x = data.cell.x + 2.5;
            const y = data.cell.y + 1;
            const w = data.cell.width - 5;
            const h = Math.min(data.cell.height - 2, 5.5);

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.roundedRect(x, y, w, h, 0.8, 0.8, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.text(rawVal, data.cell.x + data.cell.width / 2, y + h / 2 + 1, {
              align: 'center',
            });
          }
        },
      });

      colY = (doc as any).lastAutoTable.finalY + 4;
    });
  };

  // Render Kolom Kiri
  renderColumn(leftCategories, margin);

  // Render Kolom Kanan
  const rightColX = margin + colWidth + colGap; // 109mm
  renderColumn(rightCategories, rightColX);

  // 4. Footer Grand Total di Bagian Bawah
  const footerY = pageHeight - 12;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  const badgeW = 24;
  const badgeH = 6;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = footerY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL PESANAN:', badgeX - 3, footerY + 4.2, { align: 'right' });

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`${grandTotalQty} Porsi`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1, {
    align: 'center',
  });

  const cleanResto = (event.restaurantName || event.title || 'Pesanan').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_1-2_A4_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
}

export function exportToCategoryPdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  // 1. Kumpulkan urutan kategori dari master menu event
  const knownCategories: string[] = [];
  if (event.menuItems && Array.isArray(event.menuItems)) {
    event.menuItems.forEach((m) => {
      const cat = (m.category || '').trim();
      if (cat && !knownCategories.includes(cat)) {
        knownCategories.push(cat);
      }
    });
  }

  // 2. Kelompokkan pesanan berdasarkan kategori sebenarnya dari menu item
  // Map: categoryName -> Map of (menuItemId -> { name, totalQty, notes })
  const categoryMap: Record<string, Record<string, { name: string; totalQty: number; notes: string[] }>> = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      // Cari data menu asli untuk mendapatkan kategori resmi
      const foundMenuItem = event.menuItems?.find(
        (m) => m.id === item.menuItemId || m.name.toLowerCase().trim() === item.menuItemName.toLowerCase().trim()
      );

      let category = (foundMenuItem?.category || '').trim();
      if (!category) {
        // Fallback deteksi pintar jika kategori di database kosong
        category = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || [])
          ? 'Minuman'
          : 'Makanan';
      }

      if (!categoryMap[category]) {
        categoryMap[category] = {};
        if (!knownCategories.includes(category)) {
          knownCategories.push(category);
        }
      }

      const catGroup = categoryMap[category];
      if (!catGroup[item.menuItemId]) {
        catGroup[item.menuItemId] = {
          name: item.menuItemName,
          totalQty: 0,
          notes: [],
        };
      }

      catGroup[item.menuItemId].totalQty += item.quantity;
      if (item.notes && item.notes.trim()) {
        const trimmedNote = item.notes.trim();
        if (!catGroup[item.menuItemId].notes.includes(trimmedNote)) {
          catGroup[item.menuItemId].notes.push(trimmedNote);
        }
      }
    });
  });

  // Filter hanya kategori yang memiliki pesanan
  const activeCategories = knownCategories.filter(
    (cat) => categoryMap[cat] && Object.keys(categoryMap[cat]).length > 0
  );

  // Jika ada kategori lain di categoryMap yang belum masuk activeCategories
  Object.keys(categoryMap).forEach((cat) => {
    if (!activeCategories.includes(cat) && Object.keys(categoryMap[cat]).length > 0) {
      activeCategories.push(cat);
    }
  });

  // Hitung grand total seluruh pesanan
  let grandTotalQty = 0;
  activeCategories.forEach((cat) => {
    const items = Object.values(categoryMap[cat]);
    items.forEach((it) => {
      grandTotalQty += it.totalQty;
    });
  });

  // 3. Render Header Dokumen (Clean & Minimalist)
  let currentY = 18;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('REKAP PESANAN MENU', margin, currentY);

  // Subtitle / Label Kanan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateStr = formatIndonesianDate(event.date);
  doc.text(`${dateStr} • ${event.time} WIB`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 7;

  // Informasi Acara & Restoran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(event.restaurantName ? event.restaurantName.toUpperCase() : event.title, margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // slate-600
  const headerSub = event.title ? `Acara: ${event.title}` : '';
  doc.text(headerSub, pageWidth - margin, currentY, { align: 'right' });

  currentY += 4;

  // Garis horizontal pembatas header yang elegan
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 6;

  // 4. Render Tabel untuk Setiap Kategori Menu
  if (activeCategories.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('(Belum ada pesanan yang masuk)', margin, currentY + 10);
  } else {
    activeCategories.forEach((catName, catIdx) => {
      const items = Object.values(categoryMap[catName]);
      const catTotalQty = items.reduce((sum, it) => sum + it.totalQty, 0);

      // Siapkan baris data tabel
      const tableRows = items.map((item, idx) => {
        let menuDisplay = item.name;
        if (item.notes.length > 0) {
          menuDisplay += '\n' + item.notes.map((n) => `↳ Catatan: ${n}`).join('\n');
        }
        return [
          idx + 1,
          menuDisplay,
          `${item.totalQty}`,
        ];
      });

      // Cek apakah sisa halaman masih cukup untuk header + tabel (minimal ~40mm)
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 18;
      }

      // Title Kategori
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`${catIdx + 1}. ${catName.toUpperCase()}`, margin, currentY);

      currentY += 2.5;

      // Buat Tabel AutoTable
      autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
        head: [['No', 'Nama Menu & Catatan', 'Jumlah']],
        body: tableRows,
        foot: [['', `Subtotal ${catName}`, `${catTotalQty}`]],
        theme: 'plain',
        headStyles: {
          fillColor: [241, 245, 249], // slate-100 lembut
          textColor: [51, 65, 85], // slate-700
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          lineColor: [203, 213, 225],
          lineWidth: { bottom: 0.4 },
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 41, 59], // slate-800
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          lineColor: [241, 245, 249],
          lineWidth: { bottom: 0.3 },
        },
        footStyles: {
          fillColor: [248, 250, 252], // slate-50
          textColor: [71, 85, 105], // slate-600
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
          lineColor: [226, 232, 240],
          lineWidth: { top: 0.4 },
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', valign: 'top' },
          1: { cellWidth: contentWidth - 12 - 28, halign: 'left', valign: 'top' },
          2: { cellWidth: 28, halign: 'center', valign: 'top', fontStyle: 'bold' },
        },
        didDrawCell: (data) => {
          // Format kolom jumlah agar terlihat rapi dan elegan (kotak badge minimalis)
          if (data.section === 'body' && data.column.index === 2) {
            const rawVal = String(data.cell.raw || '');
            const x = data.cell.x + 4;
            const y = data.cell.y + 1.8;
            const w = data.cell.width - 8;
            const h = Math.min(data.cell.height - 3.6, 6.5);

            // Kotak badge lembut
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.25);
            doc.roundedRect(x, y, w, h, 1, 1, 'FD');

            // Teks jumlah tebal dan terpusat presisi
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text(rawVal, data.cell.x + data.cell.width / 2, y + h / 2 + 1.2, {
              align: 'center',
            });
          }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    // 5. Ringkasan Grand Total di Bagian Bawah
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = 18;
    }

    // Box Grand Total
    const boxHeight = 14;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(15, 23, 42); // slate-900
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    // Label Grand Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('TOTAL KESELURUHAN PESANAN', margin + 5, currentY + 8.5);

    // Badge Angka Grand Total
    const badgeW = 28;
    const badgeH = 8.5;
    const badgeX = margin + contentWidth - badgeW - 4;
    const badgeY = currentY + 2.75;

    doc.setFillColor(15, 23, 42); // solid dark slate
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`${grandTotalQty} Porsi`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.2, {
      align: 'center',
    });
  }

  // Simpan file
  const cleanResto = (event.restaurantName || event.title || 'Pesanan').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_Pesanan_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
}

// Rekap PDF Format Slip Order / Form Checklist 1/2 A4 (Ukuran 210mm x 148.5mm / Half A4 Landscape)
// Sesuai contoh nota/slip checklist restoran fisik: 2 kolom kisi kotak bergaris, pas 1/2 A4, TANPA nomor meja, TANPA centangan dimakan/bungkus
export function exportToSlipOrderHalfA4Pdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [148.5, 210], // Lebar 210mm, Tinggi 148.5mm (1/2 A4 Landscape)
  });

  const pageWidth = 210;
  const pageHeight = 148.5;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194mm
  const colGap = 6;
  const colWidth = (contentWidth - colGap) / 2; // 94mm

  // 1. Kumpulkan data pesanan yang masuk
  const orderQtyMap: Record<string, number> = {};
  const orderNotesMap: Record<string, string[]> = {};
  let grandTotalQty = 0;

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.menuItemId || item.menuItemName.toLowerCase().trim();
      orderQtyMap[key] = (orderQtyMap[key] || 0) + item.quantity;
      grandTotalQty += item.quantity;

      if (item.notes && item.notes.trim()) {
        if (!orderNotesMap[key]) orderNotesMap[key] = [];
        const n = item.notes.trim();
        if (!orderNotesMap[key].includes(n)) {
          orderNotesMap[key].push(n);
        }
      }
    });
  });

  // 2. Kumpulkan master kategori & menu
  const categoryGroups: Record<string, Array<{ id: string; name: string; qty: number; notes: string[] }>> = {};
  const knownCategories: string[] = [];

  // Ambil dari master menu event jika ada
  if (event.menuItems && Array.isArray(event.menuItems) && event.menuItems.length > 0) {
    event.menuItems.forEach((m) => {
      let cat = (m.category || '').trim();
      if (!cat) {
        cat = isBeverageItem(m.id, m.name, event.menuItems || []) ? 'Minuman' : 'Makanan';
      }
      if (!categoryGroups[cat]) {
        categoryGroups[cat] = [];
        knownCategories.push(cat);
      }

      const keyById = m.id;
      const keyByName = m.name.toLowerCase().trim();
      const qty = orderQtyMap[keyById] || orderQtyMap[keyByName] || 0;
      const notes = orderNotesMap[keyById] || orderNotesMap[keyByName] || [];

      categoryGroups[cat].push({
        id: m.id,
        name: m.name,
        qty,
        notes,
      });
    });
  }

  // Tambahkan item dari orders yang mungkin belum ada di master menu
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const keyById = item.menuItemId;
      const keyByName = item.menuItemName.toLowerCase().trim();

      let alreadyExists = false;
      Object.values(categoryGroups).forEach((list) => {
        if (list.some((it) => it.id === keyById || it.name.toLowerCase().trim() === keyByName)) {
          alreadyExists = true;
        }
      });

      if (!alreadyExists) {
        let cat = isBeverageItem(item.menuItemId, item.menuItemName, event.menuItems || []) ? 'Minuman' : 'Makanan';
        if (!categoryGroups[cat]) {
          categoryGroups[cat] = [];
          knownCategories.push(cat);
        }
        categoryGroups[cat].push({
          id: item.menuItemId,
          name: item.menuItemName,
          qty: orderQtyMap[keyById] || orderQtyMap[keyByName] || item.quantity,
          notes: orderNotesMap[keyById] || orderNotesMap[keyByName] || [],
        });
      }
    });
  });

  // Jika master menu banyak (>35 item), prioritaskan hanya menu yang dipesan agar pas 1 lembar
  const totalMenuItemsCount = Object.values(categoryGroups).reduce((sum, list) => sum + list.length, 0);
  const filterOnlyOrdered = totalMenuItemsCount > 35;

  const finalCategoryList: string[] = [];
  knownCategories.forEach((cat) => {
    if (filterOnlyOrdered) {
      categoryGroups[cat] = categoryGroups[cat].filter((it) => it.qty > 0);
    }
    if (categoryGroups[cat] && categoryGroups[cat].length > 0) {
      finalCategoryList.push(cat);
    }
  });

  // 3. Bagi Kategori ke Kolom Kiri dan Kolom Kanan
  let leftCategories: string[] = [];
  let rightCategories: string[] = [];

  const beverageCategories = finalCategoryList.filter((cat) => {
    const c = cat.toLowerCase();
    return c.includes('minum') || c.includes('drink') || c.includes('beverage') || c.includes('kopi') || c.includes('jus') || c.includes('teh');
  });
  const foodCategories = finalCategoryList.filter((cat) => !beverageCategories.includes(cat));

  if (beverageCategories.length > 0 && foodCategories.length > 0) {
    leftCategories = foodCategories;
    rightCategories = beverageCategories;
  } else {
    let leftWeight = 0;
    let rightWeight = 0;
    finalCategoryList.forEach((cat) => {
      const weight = categoryGroups[cat].length + 2;
      if (leftWeight <= rightWeight) {
        leftCategories.push(cat);
        leftWeight += weight;
      } else {
        rightCategories.push(cat);
        rightWeight += weight;
      }
    });
  }

  // 4. Render Header Form Bersih (Tanpa Centangan Dimakan/Bungkus)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const titleText = (event.restaurantName || event.title).toUpperCase();
  doc.text(titleText, margin, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`${formatIndonesianDate(event.date)} pk ${event.time} WIB`, pageWidth - margin, 9, { align: 'right' });

  // Garis pemisah header tipis
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, 12, pageWidth - margin, 12);

  const startY = 14.5;

  // 5. Render Kolom Tabel Kisi (Grid Bergaris Kotak ala Slip Nota Fisik)
  const renderSlipColumn = (catNames: string[], startX: number) => {
    let currentY = startY;

    catNames.forEach((catName) => {
      const items = categoryGroups[catName] || [];
      if (items.length === 0) return;

      const rows = items.map((it, idx) => {
        let menuDisplay = it.name;
        if (it.notes.length > 0) {
          menuDisplay += '\n' + it.notes.map((n) => `↳ ${n}`).join('\n');
        }
        return [
          idx + 1,
          menuDisplay,
          it.qty > 0 ? `${it.qty}` : '',
        ];
      });

      autoTable(doc, {
        startY: currentY,
        margin: { left: startX, right: pageWidth - startX - colWidth },
        tableWidth: colWidth,
        head: [[
          { content: 'NO', styles: { cellWidth: 8, halign: 'center' } },
          { content: catName.toUpperCase(), styles: { cellWidth: colWidth - 8 - 16, halign: 'left' } },
          { content: 'JUMLAH', styles: { cellWidth: 16, halign: 'center' } },
        ]],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          cellPadding: { top: 1.4, bottom: 1.4, left: 1.5, right: 1.5 },
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', valign: 'middle' },
          1: { cellWidth: colWidth - 8 - 16, halign: 'left', valign: 'middle' },
          2: { cellWidth: 16, halign: 'center', fontStyle: 'bold', valign: 'middle' },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 2.5;
    });
  };

  // Render Kiri & Kanan
  renderSlipColumn(leftCategories, margin);
  const rightColX = margin + colWidth + colGap;
  renderSlipColumn(rightCategories, rightColX);

  // 6. Footer Pas di Batas 1/2 A4 (Tinggi ~140mm, TANPA NOMOR MEJA)
  const footerY = pageHeight - 8; // Y = 140.5 mm
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('SLIP CHECKLIST PESANAN', margin, footerY + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`TOTAL: ${grandTotalQty} PORSI`, pageWidth - margin, footerY + 2, { align: 'right' });

  // Simpan file
  const cleanResto = (event.restaurantName || event.title || 'Slip_Pesanan').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Slip_Checklist_1-2_A4_${cleanResto}_${event.date}.pdf`;
  doc.save(filename);
}

// Rekap PDF Format Distribusi per Orang (1/2 A4 Landscape: 210mm x 148.5mm, 2 Kolom Sejajar)
// Menampilkan siapa yang memesan dan pesanan apa saja (tanpa harga), ideal untuk pembagian makanan kantor
export function exportToPersonOrderHalfA4Pdf(event: EventData, orders: UserOrder[]) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [148.5, 210], // 210mm x 148.5mm (1/2 A4 Landscape)
  });

  const pageWidth = 210;
  const pageHeight = 148.5;
  const margin = 8;
  const contentWidth = pageWidth - margin * 2; // 194mm
  const colGap = 6;
  const colWidth = (contentWidth - colGap) / 2; // 94mm

  // Hitung total porsi keseluruhan
  let totalPortions = 0;
  orders.forEach((o) => {
    o.items.forEach((it) => {
      totalPortions += it.quantity;
    });
  });

  // Bagi daftar order menjadi 2 kolom (Kiri dan Kanan) seimbang berdasarkan perkiraan jumlah baris
  const leftOrders: Array<{ order: UserOrder; originalIndex: number }> = [];
  const rightOrders: Array<{ order: UserOrder; originalIndex: number }> = [];

  let leftWeight = 0;
  let rightWeight = 0;

  orders.forEach((order, idx) => {
    const weight = Math.max(order.items.length, 1);
    if (leftWeight <= rightWeight) {
      leftOrders.push({ order, originalIndex: idx + 1 });
      leftWeight += weight;
    } else {
      rightOrders.push({ order, originalIndex: idx + 1 });
      rightWeight += weight;
    }
  });

  // 1. Header Atas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  const titleText = `DISTRIBUSI PESANAN • ${(event.restaurantName || event.title).toUpperCase()}`;
  doc.text(titleText, margin, 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`${formatIndonesianDate(event.date)} pk ${event.time} WIB`, pageWidth - margin, 9, { align: 'right' });

  // Garis pemisah header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, 12, pageWidth - margin, 12);

  const startY = 14.5;

  // 2. Helper Render Kolom Tabel
  const renderOrdersTable = (
    orderList: Array<{ order: UserOrder; originalIndex: number }>,
    startX: number
  ) => {
    if (orderList.length === 0) return;

    const rows = orderList.map((entry) => {
      const { order, originalIndex } = entry;
      const itemsText = order.items
        .map((it) => {
          let str = `${it.quantity}x ${it.menuItemName}`;
          if (it.notes && it.notes.trim()) {
            str += `\n   ↳ ${it.notes.trim()}`;
          }
          return str;
        })
        .join('\n');

      return [
        originalIndex,
        order.userName,
        itemsText,
      ];
    });

    autoTable(doc, {
      startY,
      margin: { left: startX, right: pageWidth - startX - colWidth },
      tableWidth: colWidth,
      head: [[
        { content: 'NO', styles: { cellWidth: 8, halign: 'center' } },
        { content: 'NAMA', styles: { cellWidth: 26, halign: 'left' } },
        { content: 'PESANAN', styles: { cellWidth: colWidth - 8 - 26, halign: 'left' } },
      ]],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 },
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: { top: 1.6, bottom: 1.6, left: 1.5, right: 1.5 },
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', fontStyle: 'bold', valign: 'top' },
        1: { cellWidth: 26, halign: 'left', fontStyle: 'bold', valign: 'top' },
        2: { cellWidth: colWidth - 8 - 26, halign: 'left', valign: 'top' },
      },
    });
  };

  // Render Kiri & Kanan
  renderOrdersTable(leftOrders, margin);
  const rightColX = margin + colWidth + colGap;
  renderOrdersTable(rightOrders, rightColX);

  // 3. Footer Pas di Batas 1/2 A4 (Y = 140.5mm)
  const footerY = pageHeight - 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.text('CHECKLIST PEMBAGIAN MAKANAN', margin, footerY + 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`TOTAL: ${orders.length} ORANG • ${totalPortions} PORSI`, pageWidth - margin, footerY + 2, { align: 'right' });

  // Simpan file
  const cleanResto = (event.restaurantName || event.title || 'Pesanan').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Distribusi_Pesanan_${cleanResto}_${event.date}.pdf`;
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

/**
 * Format dokumen HTML struk nota kasir thermal (58mm / 80mm)
 * Berisi informasi atas: Tanggal & Pemesan, tanpa footer kritik/saran.
 */
export function getThermalReceiptHtmlDocument(event: EventData, orders: UserOrder[]): string {
  const dateStr = event.date + (event.time ? ` ${event.time}` : '');
  const brandName = (event.restaurantName || event.title || 'NOTA PESANAN').toUpperCase();

  const receiptsHtml = orders.map((order) => {
    const itemsHtml = order.items
      .map(
        (it) => `
        <div class="item-block">
          <div class="item-name">${it.menuItemName}</div>
          ${it.notes && event.allowItemNotes !== false ? `<div class="item-notes">* Catatan: ${it.notes}</div>` : ''}
          <div class="item-calc">
            <span>${it.quantity} x @${it.price.toLocaleString('id-ID')}</span>
            <span>${(it.quantity * it.price).toLocaleString('id-ID')}</span>
          </div>
        </div>
      `
      )
      .join('');

    const calcLinesHtml = `
      <div class="row">
        <span>Subtotal:</span>
        <span>${order.subtotal.toLocaleString('id-ID')}</span>
      </div>
      ${
        order.taxAmount > 0
          ? `<div class="row">
              <span>PB1 (${event.taxConfig.taxPercent}%):</span>
              <span>${order.taxAmount.toLocaleString('id-ID')}</span>
            </div>`
          : ''
      }
      ${
        order.serviceAmount > 0
          ? `<div class="row">
              <span>Service (${event.taxConfig.serviceChargePercent}%):</span>
              <span>${order.serviceAmount.toLocaleString('id-ID')}</span>
            </div>`
          : ''
      }
      ${
        order.roundingAmount !== 0
          ? `<div class="row">
              <span>Pembulatan:</span>
              <span>${order.roundingAmount > 0 ? `+${order.roundingAmount.toLocaleString('id-ID')}` : order.roundingAmount.toLocaleString('id-ID')}</span>
            </div>`
          : ''
      }
    `;

    let paymentHtml = '';
    if (order.isPaid) {
      if (order.paymentMethod === 'cash') {
        paymentHtml = `
          <div class="row bold">
            <span>CASH</span>
            <span>${(order.paidAmount || order.totalAmount).toLocaleString('id-ID')}</span>
          </div>
          ${
            order.changeAmount && order.changeAmount > 0
              ? `<div class="row bold">
                  <span>Cash Change:</span>
                  <span>${order.changeAmount.toLocaleString('id-ID')}</span>
                </div>`
              : ''
          }
        `;
      } else {
        paymentHtml = `
          <div class="row bold">
            <span>TRANSFER / QRIS</span>
            <span>${order.totalAmount.toLocaleString('id-ID')}</span>
          </div>
          <div class="row">
            <span>Status:</span>
            <span class="badge">LUNAS</span>
          </div>
        `;
      }
    } else {
      paymentHtml = `
        <div class="row">
          <span>Status:</span>
          <span class="badge">BELUM BAYAR</span>
        </div>
      `;
    }

    return `
      <div class="receipt-card">
        <div class="brand">${brandName}</div>
        <div class="divider-dash"></div>
        <table class="meta-table">
          <tr>
            <td class="lbl">Date</td>
            <td>: ${dateStr}</td>
          </tr>
          <tr>
            <td class="lbl">Guest</td>
            <td>: <strong>${order.userName}</strong></td>
          </tr>
        </table>
        <div class="divider-double"></div>

        <div class="items-wrap">
          ${itemsHtml}
        </div>

        <div class="divider-dash"></div>
        ${calcLinesHtml}
        <div class="divider-double"></div>

        <div class="row grand-total">
          <span>Grand Total:</span>
          <span>${order.totalAmount.toLocaleString('id-ID')}</span>
        </div>
        <div class="divider-dash"></div>

        ${paymentHtml}
        <div class="divider-dash"></div>

        <div class="footer">
          *** TERIMA KASIH ***
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Cetak Nota Pesanan - ${brandName}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Courier New', Courier, 'Lucida Console', monospace;
          background: #f8fafc;
          color: #000;
        }
        .receipt-card {
          width: 78mm;
          max-width: 100%;
          margin: 0 auto;
          padding: 4mm 2mm;
          background: #fff;
          font-size: 12px;
          line-height: 1.3;
          page-break-after: always;
          page-break-inside: avoid;
        }
        .brand {
          text-align: center;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .divider-dash {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .divider-double {
          border-top: 2px dashed #000;
          margin: 6px 0;
        }
        .meta-table {
          width: 100%;
          font-size: 11.5px;
        }
        .meta-table td {
          padding: 1px 0;
        }
        .meta-table .lbl {
          width: 55px;
        }
        .items-wrap {
          margin: 4px 0;
        }
        .item-block {
          margin-bottom: 6px;
        }
        .item-name {
          font-weight: bold;
          font-size: 12px;
        }
        .item-notes {
          font-size: 10.5px;
          color: #333;
          font-style: italic;
          padding-left: 10px;
          margin-top: 1px;
        }
        .item-calc {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          padding-left: 10px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          font-size: 11.5px;
          padding: 1px 0;
        }
        .row.bold {
          font-weight: bold;
          font-size: 12px;
        }
        .row.grand-total {
          font-size: 14px;
          font-weight: 900;
          padding: 3px 0;
        }
        .badge {
          font-weight: bold;
          border: 1px solid #000;
          padding: 0 4px;
          font-size: 10px;
        }
        .footer {
          text-align: center;
          margin-top: 8px;
          font-size: 10.5px;
          letter-spacing: 1px;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            background: #fff;
          }
          .receipt-card {
            box-shadow: none;
            border: none;
            padding: 3mm 2mm;
          }
        }
        @media screen {
          body {
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .receipt-card {
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          }
        }
      </style>
    </head>
    <body>
      ${receiptsHtml}
    </body>
    </html>
  `;
}

/**
 * Cetak satu struk nota pemesan langsung via print dialog (format thermal receipt)
 */
export function printIndividualThermalReceipt(event: EventData, order: UserOrder) {
  const printWindow = window.open('', '_blank', 'width=420,height=650');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser Anda. Mohon izinkan pop-up untuk mencetak nota.');
    return;
  }
  printWindow.document.write(getThermalReceiptHtmlDocument(event, [order]));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

/**
 * Cetak seluruh struk nota pemesan sekaligus (batch print thermal)
 */
export function printAllIndividualThermalReceipts(event: EventData, orders: UserOrder[]) {
  if (orders.length === 0) {
    alert('Tidak ada pesanan untuk dicetak.');
    return;
  }
  const printWindow = window.open('', '_blank', 'width=420,height=650');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser Anda. Mohon izinkan pop-up untuk mencetak nota.');
    return;
  }
  printWindow.document.write(getThermalReceiptHtmlDocument(event, orders));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}

/**
 * Download PDF struk kasir thermal 80mm untuk 1 karyawan
 */
export function exportSingleOrderToReceiptPdf(event: EventData, order: UserOrder) {
  const itemsHeight = order.items.reduce((acc, it) => acc + (it.notes ? 13 : 8.5), 0);
  const totalHeightMm = Math.max(115, 52 + itemsHeight + 48);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, totalHeightMm],
  });

  const pageWidth = 80;
  const margin = 4;
  let y = 8;

  // Nama Brand Resto
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  const brand = (event.restaurantName || event.title || 'NOTA PESANAN').toUpperCase();
  doc.text(brand, pageWidth / 2, y, { align: 'center', maxWidth: 72 });
  y += 5.5;

  // Divider dash
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text('----------------------------------------', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  // Meta: Date & Guest
  const dateStr = event.date + (event.time ? ` ${event.time}` : '');
  doc.text(`Date : ${dateStr}`, margin, y);
  y += 4;
  doc.setFont('courier', 'bold');
  doc.text(`Guest: ${order.userName}`, margin, y);
  doc.setFont('courier', 'normal');
  y += 4;

  // Divider double
  doc.text('========================================', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  // Menu Items
  order.items.forEach((it) => {
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(it.menuItemName, margin, y, { maxWidth: 72 });
    y += 4;

    if (it.notes && event.allowItemNotes !== false) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.text(`* ${it.notes}`, margin + 3, y, { maxWidth: 68 });
      y += 3.5;
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.text(`  ${it.quantity} x @${it.price.toLocaleString('id-ID')}`, margin, y);
    doc.text((it.quantity * it.price).toLocaleString('id-ID'), pageWidth - margin, y, { align: 'right' });
    y += 4.5;
  });

  // Divider
  doc.text('----------------------------------------', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  const printCalcLine = (label: string, val: string, isBold: boolean = false, fontSize: number = 8.5) => {
    doc.setFont('courier', isBold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.text(label, margin, y);
    doc.text(val, pageWidth - margin, y, { align: 'right' });
    y += 4.5;
  };

  printCalcLine('Subtotal:', order.subtotal.toLocaleString('id-ID'));
  if (order.taxAmount > 0) {
    printCalcLine(`PB1 (${event.taxConfig.taxPercent}%):`, order.taxAmount.toLocaleString('id-ID'));
  }
  if (order.serviceAmount > 0) {
    printCalcLine(`Service (${event.taxConfig.serviceChargePercent}%):`, order.serviceAmount.toLocaleString('id-ID'));
  }
  if (order.roundingAmount !== 0) {
    printCalcLine(
      'Pembulatan:',
      order.roundingAmount > 0 ? `+${order.roundingAmount.toLocaleString('id-ID')}` : order.roundingAmount.toLocaleString('id-ID')
    );
  }

  // Divider double
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text('========================================', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  // Grand Total
  printCalcLine('Grand Total:', order.totalAmount.toLocaleString('id-ID'), true, 10.5);

  // Divider dash
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text('----------------------------------------', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  // Payment
  if (order.isPaid) {
    if (order.paymentMethod === 'cash') {
      printCalcLine('CASH', (order.paidAmount || order.totalAmount).toLocaleString('id-ID'), true);
      if (order.changeAmount && order.changeAmount > 0) {
        printCalcLine('Cash Change:', order.changeAmount.toLocaleString('id-ID'), true);
      }
    } else {
      printCalcLine('TRANSFER / QRIS', order.totalAmount.toLocaleString('id-ID'), true);
      printCalcLine('Status:', 'LUNAS', true);
    }
  } else {
    printCalcLine('Status:', 'BELUM BAYAR', true);
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text('----------------------------------------', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.text('*** TERIMA KASIH ***', pageWidth / 2, y, { align: 'center' });

  const cleanName = order.userName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Nota_${cleanName}_${event.date}.pdf`);
}
