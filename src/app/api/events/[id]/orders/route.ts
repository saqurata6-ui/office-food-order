import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateOrder } from '@/lib/calculator';
import { UserOrder, OrderItem } from '@/types';
import { nanoid } from 'nanoid';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const event = db.getEvent(id);
    if (!event) {
      return NextResponse.json({ success: false, message: 'Acara tidak ditemukan' }, { status: 404 });
    }
    const orders = db.getOrders(id);
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
    const event = db.getEvent(id);

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
    const { userName, items, orderId } = body;

    if (!userName || !userName.trim()) {
      return NextResponse.json({ success: false, message: 'Nama pemesan wajib diisi' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Pilih minimal satu menu' }, { status: 400 });
    }

    // Filter valid quantity
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

    const calc = calculateOrder(validItems, event.taxConfig);

    const userOrder: UserOrder = {
      id: orderId || `ord_${nanoid(8)}`,
      eventId: id,
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

    const saved = db.saveOrder(userOrder);

    return NextResponse.json({
      success: true,
      data: saved,
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
    const body = await req.json();
    const { orderId, isPaid, action } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID dibutuhkan' }, { status: 400 });
    }

    if (action === 'delete') {
      const deleted = db.deleteOrder(id, orderId);
      return NextResponse.json({ success: deleted, message: deleted ? 'Pesanan dihapus' : 'Gagal menghapus' });
    }

    if (typeof isPaid === 'boolean') {
      const updated = db.updateOrderStatus(id, orderId, isPaid);
      return NextResponse.json({ success: updated, message: 'Status pembayaran diperbarui' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui status' }, { status: 500 });
  }
}
