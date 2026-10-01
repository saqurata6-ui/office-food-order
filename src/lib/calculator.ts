import { OrderItem, TaxConfig, CalculationBreakdown } from '@/types';

export function formatRupiah(amount: number): string {
  const isNegative = amount < 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Normalisasi nama untuk mencegah duplikasi (menghapus spasi berlebih, spasi di awal/akhir, dan case-insensitive)
 * Contoh: " Budi  Santoso " -> "budi santoso", "budi " -> "budi", "  budi" -> "budi"
 */
export function normalizeName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function calculateOrder(
  items: OrderItem[],
  taxConfig: TaxConfig
): CalculationBreakdown {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const taxAmount = taxConfig.useTax
    ? Math.round(subtotal * (taxConfig.taxPercent / 100))
    : 0;

  const serviceAmount = taxConfig.useServiceCharge
    ? Math.round(subtotal * (taxConfig.serviceChargePercent / 100))
    : 0;

  const rawTotal = subtotal + taxAmount + serviceAmount;

  let roundingAmount = 0;
  const mode = taxConfig.rounding || 'none';

  if (mode === 'floor_1000' || mode === 'floor_500') {
    // Sesuai Nota Resto: dibulatkan ke bawah ke kelipatan Rp 500 terdekat (diskon sisa pecahan)
    // Contoh di nota kasir resto:
    // - Rp 206.250 ➔ Rp 206.000 (diskon sisa Rp 250)
    // - Rp 17.600 ➔ Rp 17.500 (diskon sisa Rp 100)
    const remainder = rawTotal % 500;
    if (remainder > 0) {
      roundingAmount = -remainder;
    }
  } else if (mode === 'floor_100') {
    // Dibulatkan ke bawah ke 100 terdekat
    const remainder = rawTotal % 100;
    if (remainder > 0) {
      roundingAmount = -remainder;
    }
  } else if (mode === 'ceil_1000' || mode === '1000') {
    // Dibulatkan ke atas ke 1000 terdekat
    const remainder = rawTotal % 1000;
    if (remainder > 0) {
      roundingAmount = 1000 - remainder;
    }
  } else if (mode === 'ceil_500' || mode === '500') {
    // Dibulatkan ke atas ke 500 terdekat
    const remainder = rawTotal % 500;
    if (remainder > 0) {
      roundingAmount = 500 - remainder;
    }
  } else if (mode === 'ceil_100' || mode === '100') {
    // Dibulatkan ke atas ke 100 terdekat
    const remainder = rawTotal % 100;
    if (remainder > 0) {
      roundingAmount = 100 - remainder;
    }
  } else if (mode === 'round_1000') {
    // Pembulatan matematis ke 1000 terdekat
    const rounded = Math.round(rawTotal / 1000) * 1000;
    roundingAmount = rounded - rawTotal;
  } else if (mode === 'round_500') {
    // Pembulatan matematis ke 500 terdekat
    const rounded = Math.round(rawTotal / 500) * 500;
    roundingAmount = rounded - rawTotal;
  }

  const totalAmount = rawTotal + roundingAmount;

  return {
    subtotal,
    taxAmount,
    serviceAmount,
    rawTotal,
    roundingAmount,
    totalAmount,
  };
}

/**
 * Format string tanggal (YYYY-MM-DD) ke format hari & tanggal bahasa Indonesia
 * Contoh: "2026-09-17" -> "Kamis, 17 September 2026"
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${dayNames[d.getDay()]}, ${day} ${monthNames[d.getMonth()]} ${year}`;
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  } catch (e) {
    console.error(e);
  }
  return dateStr;
}

export const STANDARD_CATEGORY_ORDER = ['Makanan', 'Minuman', 'Sate & Gorengan'];

/**
 * Normalisasi kategori menu agar konsisten, rapi, dan terstandarisasi.
 * Menghilangkan duplikasi seperti "MAKANAN" vs "Makanan",
 * serta menggabungkan kategori sate, gorengan, dan lauk pelengkap menjadi "Sate & Gorengan".
 */
export function normalizeMenuCategory(rawCategory?: string, itemName?: string): string {
  const cat = (rawCategory || '').trim();
  const catLower = cat.toLowerCase();
  const nameLower = (itemName || '').toLowerCase();

  // 1. Minuman (Wedhang, Teh, Kopi, Es, Jus, Air Mineral, dsb)
  if (
    catLower.includes('minum') ||
    catLower.includes('drink') ||
    catLower.includes('beverage') ||
    catLower.includes('wedhang') ||
    catLower.includes('kopi') ||
    catLower.includes('teh') ||
    catLower.includes('jus') ||
    catLower.includes('juice') ||
    catLower.includes('es ') ||
    nameLower.startsWith('es ') ||
    nameLower.includes('es teh') ||
    nameLower.includes('es jeruk') ||
    nameLower.includes('wedhang') ||
    nameLower.includes('teh tawar') ||
    nameLower.includes('teh manis') ||
    nameLower.includes('kopi') ||
    nameLower.includes('mineral') ||
    nameLower.includes('kacang kuah') ||
    nameLower.includes('ronde') ||
    nameLower.includes('angsle') ||
    nameLower.includes('jahe') ||
    nameLower.includes('uwuh') ||
    nameLower.includes('jus ') ||
    nameLower.includes('jeruk nipis') ||
    nameLower.includes('air mineral')
  ) {
    return 'Minuman';
  }

  // 2. Sate & Gorengan (Aneka Sate, Gorengan, Telur, Ceker, Jeroan, Kerupuk, Lauk Pendamping)
  if (
    catLower.includes('sate') ||
    catLower.includes('gorengan') ||
    catLower.includes('side dish') ||
    catLower.includes('pelengkap') ||
    catLower.includes('lauk') ||
    catLower.includes('aneka') ||
    nameLower.includes('sate') ||
    nameLower.includes('cecek') ||
    nameLower.includes('rempelo') ||
    nameLower.includes('ati') ||
    nameLower.includes('usus') ||
    nameLower.includes('paru') ||
    nameLower.includes('kulit') ||
    nameLower.includes('ceker') ||
    nameLower.includes('telor') ||
    nameLower.includes('telur') ||
    nameLower.includes('puyuh') ||
    nameLower.includes('dadar jagung') ||
    nameLower.includes('perkedel') ||
    nameLower.includes('mendoan') ||
    nameLower.includes('ote - ote') ||
    nameLower.includes('ote-ote') ||
    nameLower.includes('ote ote') ||
    nameLower.includes('tahu baso') ||
    nameLower.includes('tahu bakso') ||
    nameLower.includes('tahu goreng') ||
    nameLower.includes('tempe mendoan') ||
    nameLower.includes('tempe kering') ||
    nameLower.includes('kerupuk') ||
    nameLower.includes('krupuk') ||
    nameLower.includes('emping') ||
    nameLower.includes('peyek') ||
    nameLower.includes('bakwan') ||
    nameLower.includes('tahu petis')
  ) {
    return 'Sate & Gorengan';
  }

  // 3. Makanan Utama (Soto, Nasi Pecel, Rawon, Mie, Ayam, Daging, Makanan)
  if (
    catLower.includes('makan') ||
    catLower.includes('food') ||
    catLower.includes('utama') ||
    catLower.includes('soto') ||
    catLower.includes('pecel') ||
    catLower.includes('nasi') ||
    catLower.includes('mie') ||
    catLower.includes('rawon') ||
    catLower.includes('ayam') ||
    catLower.includes('daging') ||
    nameLower.includes('soto') ||
    nameLower.includes('pecel') ||
    nameLower.includes('nasi') ||
    nameLower.includes('rawon')
  ) {
    return 'Makanan';
  }

  // Fallback untuk "Lainnya" atau string kosong
  if (catLower === 'lainnya' || !cat) {
    return 'Makanan';
  }

  // Format Title Case jika kategori khusus lain (misal: "Paket", "A La Carte")
  return cat
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Urutkan daftar nama kategori dengan prioritas: Makanan, Minuman, Sate & Gorengan, lalu lainnya secara alfabetis
 */
export function sortCategories(categories: string[]): string[] {
  const result = [...categories];
  return result.sort((a, b) => {
    const idxA = STANDARD_CATEGORY_ORDER.indexOf(a);
    const idxB = STANDARD_CATEGORY_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}
