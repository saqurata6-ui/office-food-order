export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
}

export type RoundingType =
  | 'none'
  | 'floor_1000' // Sesuai Nota: dibulatkan ke bawah ke Rp 1.000 terdekat (minus/potongan)
  | 'floor_500'  // Sesuai Nota: dibulatkan ke bawah ke Rp 500 terdekat
  | 'floor_100'  // Dibulatkan ke bawah ke Rp 100 terdekat
  | 'ceil_1000'  // Dibulatkan ke atas ke Rp 1.000
  | 'ceil_500'   // Dibulatkan ke atas ke Rp 500
  | 'ceil_100'   // Dibulatkan ke atas ke Rp 100
  | 'round_1000' // Pembulatan matematis ke Rp 1.000 terdekat
  | 'round_500'  // Pembulatan matematis ke Rp 500 terdekat
  | '1000'       // Legacy support (alias ceil_1000)
  | '500'        // Legacy support (alias ceil_500)
  | '100';       // Legacy support (alias ceil_100)

export interface TaxConfig {
  useTax: boolean;
  taxPercent: number;
  useServiceCharge: boolean;
  serviceChargePercent: number;
  rounding: RoundingType;
}

export interface EventData {
  id: string;
  adminPin: string;
  title: string;
  picName: string;
  date: string;
  time: string;
  restaurantName: string;
  restaurantAddress: string;
  taxConfig: TaxConfig;
  menuItems: MenuItem[];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  menuItemId: string;
  menuItemName: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface UserOrder {
  id: string;
  eventId: string;
  userName: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  roundingAmount: number;
  totalAmount: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalculationBreakdown {
  subtotal: number;
  taxAmount: number;
  serviceAmount: number;
  rawTotal: number;
  roundingAmount: number;
  totalAmount: number;
}
