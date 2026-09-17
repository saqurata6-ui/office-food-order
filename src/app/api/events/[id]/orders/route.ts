import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateOrder, normalizeName } from '@/lib/calculator';
import { UserOrder, OrderItem } from '@/types';
import { nanoid } from 'nanoid';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const event = await db.getEvent(cleanId);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Acara tidak ditemukan' }, { status: 404 });
    }
    const orders = await db.getOrders(event.id);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ success: false, message: 'Gagal mengambil data pesanan' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const event = await db.getEvent(cleanId);

    if (!event) {
      return NextResponse.json({ success: false, message: 'Acara tidak ditemukan' }, { status: 404 });
    }

    if (event.isLocked) {
      return NextResponse.json(
        {
          success: false,
          message: 'Maaf, pesanan sudah dikunci oleh PIC. Anda tidak dapat menambah atau mengubah pesanan.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userName, items, orderId, includeTax } = body;

    const cleanNormalizedName = normalizeName(userName);
    if (!cleanNormalizedName) {
      return NextResponse.json({ success: false, message: 'Nama pemesan wajib diisi' }, { status: 400 });
    }

    // Validasi nama pemesan tidak boleh sama (mencegah typo spasi / kapitalisasi)
    const existingOrders = await db.getOrders(event.id);
    const duplicateOrder = existingOrders.find((o) => {
      if (orderId && o.id === orderId) {
        return false;
      }
      return normalizeName(o.userName) === cleanNormalizedName;
    });

    if (duplicateOrder) {
      return NextResponse.json(
        {
          success: false,
          message: `Nama "${userName.trim()}" sudah ada di daftar pesanan (${duplicateOrder.userName}). Jika ini pesanan Anda, silakan pilih nama Anda untuk mengedit, atau tambahkan nama pembeda (misal: divisi / inisial).`,
        },
        { status: 409 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Pilih minimal satu menu' }, { status: 400 });
    }

    const validItems: OrderItem[] = items
      .filter((it: OrderItem) => it.quantity > 0)
      .map((it: OrderItem) => ({
        menuItemId: it.menuItemId,
        menuItemName: it.menuItemName,
        price: Number(it.price) || 0,
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        notes: it.notes?.trim() || '',
      }));

    if (validItems.length === 0) {
      return NextResponse.json({ success: false, message: 'Pilih minimal satu menu dengan jumlah valid' }, { status: 400 });
    }

    const effectiveTaxConfig = {
      ...event.taxConfig,
      useTax: event.taxConfig.useTax && includeTax === true,
    };

    const calc = calculateOrder(validItems, effectiveTaxConfig);

    const userOrder: UserOrder = {
      id: orderId || `ord_${nanoid(8)}`,
      eventId: event.id,
      userName: userName.trim(),
      items: validItems,
      subtotal: calc.subtotal,
      taxAmount: calc.taxAmount,
      serviceAmount: calc.serviceAmount,
      roundingAmount: calc.roundingAmount,
      totalAmount: calc.totalAmount,
      isPaid: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveOrder(userOrder);
    const updatedOrders = await db.getOrders(event.id);

    return NextResponse.json({
      success: true,
      data: saved,
      orders: updatedOrders,
      message: 'Pesanan berhasil disimpan!',
    });
  } catch (error) {
    console.error('Error saving order:', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan pesanan' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const body = await req.json();
    const { orderId, isPaid, action, paymentMethod, paidAmount, changeAmount } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID dibutuhkan' }, { status: 400 });
    }

    if (action === 'delete') {
      const deleted = await db.deleteOrder(cleanId, orderId);
      const remainingOrders = await db.getOrders(cleanId);
      return NextResponse.json({
        success: deleted,
        orders: remainingOrders,
        message: deleted ? 'Pesanan dihapus' : 'Gagal menghapus',
      });
    }

    if (typeof isPaid === 'boolean') {
      const updated = await db.updateOrderStatus(cleanId, orderId, isPaid, {
        paymentMethod: paymentMethod || undefined,
        paidAmount: paidAmount != null ? Number(paidAmount) : undefined,
        changeAmount: changeAmount != null ? Number(changeAmount) : undefined,
      });
      const currentOrders = await db.getOrders(cleanId);
      return NextResponse.json({
        success: updated,
        orders: currentOrders,
        message: 'Status pembayaran diperbarui',
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui status' }, { status: 500 });
  }
}
