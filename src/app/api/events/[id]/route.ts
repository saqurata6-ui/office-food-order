import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateOrder, normalizeMenuCategory } from '@/lib/calculator';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const event = await db.getEvent(cleanId);

    if (!event) {
      const allEvents = (await db.getAllEvents()).map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        restaurantName: e.restaurantName,
        adminPin: e.adminPin,
      }));
      return NextResponse.json(
        { success: false, message: 'Acara tidak ditemukan', availableEvents: allEvents },
        { status: 404 }
      );
    }

    // Auto-normalisasi kategori menu yang belum standar (tanpa menyentuh atau menghapus data pesanan)
    let hasCategoryFix = false;
    if (event.menuItems && Array.isArray(event.menuItems)) {
      event.menuItems = event.menuItems.map((m) => {
        const cleanCat = normalizeMenuCategory(m.category, m.name);
        if (cleanCat !== m.category) {
          hasCategoryFix = true;
        }
        return {
          ...m,
          category: cleanCat,
        };
      });
    }

    if (hasCategoryFix) {
      // Simpan perubahan kategori ke database secara aman tanpa mengubah pesanan
      db.saveEvent(event).catch((e) => console.error('Error auto-persisting normalized categories:', e));
    }

    const orders = await db.getOrders(event.id);

    const url = new URL(req.url);
    const pin = url.searchParams.get('pin');
    const isAdmin = pin === event.adminPin;

    return NextResponse.json({
      success: true,
      data: {
        ...event,
        adminPin: isAdmin ? event.adminPin : undefined,
      },
      orders,
      isAdmin,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data acara' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const event = await db.getEvent(cleanId);

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Acara tidak ditemukan' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { isLocked, menuItems, taxConfig, recalculateOrders = true, adminPin, allowItemNotes } = body;

    if (adminPin && adminPin !== event.adminPin) {
      return NextResponse.json(
        { success: false, message: 'PIN PIC tidak sesuai' },
        { status: 403 }
      );
    }

    if (typeof isLocked === 'boolean') {
      await db.updateEventLock(event.id, isLocked);
    }

    const updatedEvent = (await db.getEvent(event.id))!;
    if (menuItems && Array.isArray(menuItems)) {
      updatedEvent.menuItems = menuItems.map((m: any) => ({
        ...m,
        category: normalizeMenuCategory(m.category, m.name),
      }));
    }

    if (allowItemNotes !== undefined) {
      updatedEvent.allowItemNotes = Boolean(allowItemNotes);
    }

    let updatedOrders = await db.getOrders(event.id);

    if (taxConfig) {
      const effectiveAllowNotes = allowItemNotes !== undefined
        ? Boolean(allowItemNotes)
        : (taxConfig.allowItemNotes !== undefined ? Boolean(taxConfig.allowItemNotes) : (updatedEvent.allowItemNotes ?? true));
      
      updatedEvent.allowItemNotes = effectiveAllowNotes;
      updatedEvent.taxConfig = {
        useTax: Boolean(taxConfig.useTax),
        taxPercent: Number(taxConfig.taxPercent) || 0,
        useServiceCharge: Boolean(taxConfig.useServiceCharge),
        serviceChargePercent: Number(taxConfig.serviceChargePercent) || 0,
        rounding: taxConfig.rounding || 'none',
        allowItemNotes: effectiveAllowNotes,
      };

      if (recalculateOrders && updatedOrders.length > 0) {
        for (const ord of updatedOrders) {
          const effectiveTaxConfig = {
            ...updatedEvent.taxConfig,
            useTax: updatedEvent.taxConfig.useTax,
          };
          const calc = calculateOrder(ord.items, effectiveTaxConfig);
          ord.subtotal = calc.subtotal;
          ord.taxAmount = calc.taxAmount;
          ord.serviceAmount = calc.serviceAmount;
          ord.roundingAmount = calc.roundingAmount;
          ord.totalAmount = calc.totalAmount;

          if (ord.paymentMethod === 'cash' && ord.paidAmount != null) {
            ord.changeAmount = Math.max(0, ord.paidAmount - ord.totalAmount);
          }

          await db.saveOrder(ord);
        }
        updatedOrders = await db.getOrders(event.id);
      }
    }

    await db.saveEvent(updatedEvent);

    return NextResponse.json({
      success: true,
      data: updatedEvent,
      orders: updatedOrders,
      message: 'Acara berhasil diperbarui',
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui acara' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || '').trim();
    const event = await db.getEvent(cleanId);

    if (!event) {
      return NextResponse.json(
        { success: false, message: 'Acara tidak ditemukan' },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const pin = url.searchParams.get('pin');

    let requestPin = pin;
    if (!requestPin) {
      try {
        const body = await req.json();
        requestPin = body.pin || body.adminPin;
      } catch (e) {}
    }

    if (!requestPin || requestPin.trim() !== event.adminPin.trim()) {
      return NextResponse.json(
        { success: false, message: 'PIN PIC salah. Tidak diizinkan menghapus acara.' },
        { status: 403 }
      );
    }

    await db.deleteEvent(event.id);

    return NextResponse.json({
      success: true,
      message: 'Acara berhasil dihapus permanen',
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus acara' },
      { status: 500 }
    );
  }
}
