import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const { isLocked, menuItems, taxConfig, adminPin } = body;

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
    if (taxConfig) {
      updatedEvent.taxConfig = taxConfig;
    }
    await db.saveEvent(updatedEvent);

    return NextResponse.json({
      success: true,
      data: updatedEvent,
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
