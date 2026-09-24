import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateOrder } from '@/lib/calculator';

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
      updatedEvent.menuItems = menuItems;
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
