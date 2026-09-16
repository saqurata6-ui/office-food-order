import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventData } from '@/types';
import { nanoid } from 'nanoid';

export async function GET() {
  try {
    const events = await db.getAllEvents();
    // Return sanitized list for privacy (hide adminPin)
    const sanitized = events.map((e) => ({
      id: e.id,
      title: e.title,
      picName: e.picName,
      date: e.date,
      time: e.time,
      restaurantName: e.restaurantName,
      isLocked: e.isLocked,
      createdAt: e.createdAt,
    }));
    return NextResponse.json({ success: true, data: sanitized });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data acara' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      title,
      picName,
      date,
      time,
      restaurantName,
      restaurantAddress,
      taxConfig,
      menuItems,
      customSlug,
    } = body;

    if (!title || !picName || !restaurantName) {
      return NextResponse.json(
        { success: false, message: 'Mohon lengkapi judul acara, nama PIC, dan nama restoran' },
        { status: 400 }
      );
    }

    // Generate unique slug
    const cleanTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const shortId = nanoid(5).toLowerCase();
    const eventId = customSlug ? customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '') : `${cleanTitle}-${shortId}`;

    // Admin PIN (4-digit)
    const adminPin = Math.floor(1000 + Math.random() * 9000).toString();

    const newEvent: EventData = {
      id: eventId,
      adminPin,
      title,
      picName,
      date: date || new Date().toISOString().split('T')[0],
      time: time || '12:00',
      restaurantName,
      restaurantAddress: restaurantAddress || '',
      taxConfig: taxConfig || {
        useTax: true,
        taxPercent: 10,
        useServiceCharge: false,
        serviceChargePercent: 0,
        rounding: 'none',
      },
      menuItems: menuItems || [],
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveEvent(newEvent);

    return NextResponse.json({
      success: true,
      data: saved,
      adminPin,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal membuat acara' },
      { status: 500 }
    );
  }
}
