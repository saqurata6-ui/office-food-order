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

export const STANDARD_CATEGORY_ORDER = ['Makanan', 'Minuman', 'Sate & Gorengan', 'Gorengan', 'Sate', 'Snack', 'Cemilan', 'Dessert'];

/**
 * Normalisasi nama kategori menu agar konsisten & rapi (Title Case, trim whitespace, bersihkan duplikasi huruf besar/kecil).
 * HANYA memproses string nama kategori (tidak pernah memaksakan atau menebak kategori berdasarkan nama item makanan).
 */
export function normalizeMenuCategory(rawCategory?: string, _itemName?: string): string {
  const cat = (rawCategory || '').trim();
  if (!cat) return 'Makanan';

  const catLower = cat.toLowerCase();

  // Standarisasi kapitalisasi untuk kategori umum
  if (
    catLower === 'makanan' ||
    catLower === 'makan' ||
    catLower === 'food' ||
    catLower === 'foods' ||
    catLower === 'makanan utama' ||
    catLower === 'main course'
  ) {
    return 'Makanan';
  }

  if (
    catLower === 'minuman' ||
    catLower === 'minum' ||
    catLower === 'drink' ||
    catLower === 'drinks' ||
    catLower === 'beverage' ||
    catLower === 'beverages'
  ) {
    return 'Minuman';
  }

  // Jika nama kategori di menu memang menyebutkan gabungan sate & gorengan
  if (
    catLower === 'sate & gorengan' ||
    catLower === 'aneka sate & gorengan' ||
    catLower === 'sate dan gorengan' ||
    catLower === 'aneka sate dan gorengan'
  ) {
    return 'Sate & Gorengan';
  }

  // Title Case untuk kategori apa pun (misal: "Dimsum", "Appetizer", "Snack", "Dessert", "Gorengan", "Sate", "Paket", dll)
  return cat
    .split(/\s+/)
    .map((w) => {
      if (w === '&') return '&';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Urutkan daftar nama kategori dengan prioritas: Makanan, Minuman, Sate & Gorengan (jika ada), lalu lainnya secara alfabetis
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
