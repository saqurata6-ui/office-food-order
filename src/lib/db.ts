import fs from 'fs';
import path from 'path';
import { EventData, UserOrder } from '@/types';

interface DatabaseSchema {
  events: Record<string, EventData>;
  orders: Record<string, UserOrder[]>; // eventId -> UserOrder[]
}

const DB_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

function ensureDbFile(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.events === 'object' && typeof parsed.orders === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading db file, initializing empty db:', err);
  }

  const initialDb: DatabaseSchema = {
    events: {},
    orders: {},
  };

  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error creating db file:', err);
  }

  return initialDb;
}

function saveDb(data: DatabaseSchema): void {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db file:', err);
  }
}

export const db = {
  getEvent(id: string): EventData | null {
    if (!id || id === 'undefined') return null;
    const data = ensureDbFile();
    const cleanId = decodeURIComponent(id).trim().toLowerCase();

    // 1. Direct match
    if (data.events[id]) return data.events[id];
    if (data.events[cleanId]) return data.events[cleanId];

    // 2. Case-insensitive or slug match
    const entries = Object.entries(data.events);
    for (const [key, ev] of entries) {
      if (key.toLowerCase() === cleanId || ev.id.toLowerCase() === cleanId) {
        return ev;
      }
    }

    // 3. Substring match
    for (const [key, ev] of entries) {
      if (key.toLowerCase().includes(cleanId) || cleanId.includes(key.toLowerCase())) {
        return ev;
      }
    }

    return null;
  },

  getAllEvents(): EventData[] {
    const data = ensureDbFile();
    return Object.values(data.events).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  saveEvent(event: EventData): EventData {
    const data = ensureDbFile();
    const cleanId = event.id.trim().toLowerCase();
    const eventToSave: EventData = {
      ...event,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    };
    data.events[cleanId] = eventToSave;
    if (!data.orders[cleanId]) {
      data.orders[cleanId] = [];
    }
    saveDb(data);
    return eventToSave;
  },

  updateEventLock(id: string, isLocked: boolean): EventData | null {
    const data = ensureDbFile();
    const event = this.getEvent(id);
    if (!event) return null;
    
    data.events[event.id].isLocked = isLocked;
    data.events[event.id].updatedAt = new Date().toISOString();
    saveDb(data);
    return data.events[event.id];
  },

  getOrders(eventId: string): UserOrder[] {
    if (!eventId || eventId === 'undefined') return [];
    const data = ensureDbFile();
    const cleanId = decodeURIComponent(eventId).trim().toLowerCase();
    return data.orders[cleanId] || data.orders[eventId] || [];
  },

  saveOrder(order: UserOrder): UserOrder {
    const data = ensureDbFile();
    const cleanEventId = order.eventId.trim().toLowerCase();

    if (!data.orders[cleanEventId]) {
      data.orders[cleanEventId] = [];
    }

    const existingIndex = data.orders[cleanEventId].findIndex(
      (o) => o.userName.trim().toLowerCase() === order.userName.trim().toLowerCase() || o.id === order.id
    );

    const now = new Date().toISOString();
    if (existingIndex >= 0) {
      const existing = data.orders[cleanEventId][existingIndex];
      data.orders[cleanEventId][existingIndex] = {
        ...order,
        id: existing.id,
        eventId: cleanEventId,
        isPaid: existing.isPaid,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      saveDb(data);
      return data.orders[cleanEventId][existingIndex];
    } else {
      const newOrder: UserOrder = {
        ...order,
        eventId: cleanEventId,
        createdAt: now,
        updatedAt: now,
      };
      data.orders[cleanEventId].push(newOrder);
      saveDb(data);
      return newOrder;
    }
  },

  updateOrderStatus(eventId: string, orderId: string, isPaid: boolean): boolean {
    const data = ensureDbFile();
    const cleanEventId = eventId.trim().toLowerCase();
    const list = data.orders[cleanEventId] || data.orders[eventId];
    if (!list) return false;
    const order = list.find((o) => o.id === orderId);
    if (!order) return false;
    order.isPaid = isPaid;
    order.updatedAt = new Date().toISOString();
    saveDb(data);
    return true;
  },

  deleteOrder(eventId: string, orderId: string): boolean {
    const data = ensureDbFile();
    const cleanEventId = eventId.trim().toLowerCase();
    const list = data.orders[cleanEventId] || data.orders[eventId];
    if (!list) return false;
    data.orders[cleanEventId] = list.filter((o) => o.id !== orderId);
    saveDb(data);
    return true;
  }
};
