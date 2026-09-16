import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EventData } from '@/types';
import { nanoid } from 'nanoid';
import { normalizeName } from '@/lib/calculator';

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

    // Validasi duplikasi acara: judul sama & tanggal sama, atau judul sama & restoran sama
    const existingEvents = await db.getAllEvents();
    const normalizedNewTitle = normalizeName(title);
    const normalizedNewResto = normalizeName(restaurantName);
    const normalizedNewDate = (date || new Date().toISOString().split('T')[0]).trim();

    const duplicateEvent = existingEvents.find((e) => {
      const eTitle = normalizeName(e.title);
      const eResto = normalizeName(e.restaurantName);
      const eDate = (e.date || '').trim();
      return (
        (eTitle === normalizedNewTitle && eDate === normalizedNewDate) ||
        (eTitle === normalizedNewTitle && eResto === normalizedNewResto)
      );
    });

    if (duplicateEvent) {
      return NextResponse.json(
        {
          success: false,
          message: `Acara dengan judul "${title.trim()}" sudah ada di tanggal/tempat tersebut (${duplicateEvent.title}). Silakan gunakan nama acara lain atau buka acara yang sudah ada.`,
          existingEventId: duplicateEvent.id,
        },
        { status: 409 }
      );
    }

    // Jika customSlug diisi, pastikan slug tidak bentrok
    if (customSlug) {
      const cleanSlug = customSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const slugExists = existingEvents.some((e) => e.id.toLowerCase() === cleanSlug);
      if (slugExists) {
        return NextResponse.json(
          {
            success: false,
            message: `Link / ID acara "${cleanSlug}" sudah dipakai oleh acara lain. Silakan gunakan link ID lain.`,
          },
          { status: 409 }
        );
      }
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
