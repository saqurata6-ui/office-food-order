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

  if (mode === 'floor_1000') {
    // Sesuai Nota Resto: dibulatkan ke bawah ke 1000 terdekat (diskon/potongan minus)
    // Contoh di nota: 206.250 -> 206.000, rounding = -250
    const remainder = rawTotal % 1000;
    if (remainder > 0) {
      roundingAmount = -remainder;
    }
  } else if (mode === 'floor_500') {
    // Dibulatkan ke bawah ke 500 terdekat
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
