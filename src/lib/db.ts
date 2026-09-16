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
      return JSON.parse(data);
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
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db file:', err);
  }
}

export const db = {
  getEvent(id: string): EventData | null {
    const data = ensureDbFile();
    return data.events[id] || null;
  },

  getAllEvents(): EventData[] {
    const data = ensureDbFile();
    return Object.values(data.events).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  saveEvent(event: EventData): EventData {
    const data = ensureDbFile();
    data.events[event.id] = {
      ...event,
      updatedAt: new Date().toISOString(),
    };
    if (!data.orders[event.id]) {
      data.orders[event.id] = [];
    }
    saveDb(data);
    return data.events[event.id];
  },

  updateEventLock(id: string, isLocked: boolean): EventData | null {
    const data = ensureDbFile();
    if (!data.events[id]) return null;
    data.events[id].isLocked = isLocked;
    data.events[id].updatedAt = new Date().toISOString();
    saveDb(data);
    return data.events[id];
  },

  getOrders(eventId: string): UserOrder[] {
    const data = ensureDbFile();
    return data.orders[eventId] || [];
  },

  saveOrder(order: UserOrder): UserOrder {
    const data = ensureDbFile();
    if (!data.orders[order.eventId]) {
      data.orders[order.eventId] = [];
    }

    const existingIndex = data.orders[order.eventId].findIndex(
      (o) => o.userName.trim().toLowerCase() === order.userName.trim().toLowerCase() || o.id === order.id
    );

    const now = new Date().toISOString();
    if (existingIndex >= 0) {
      const existing = data.orders[order.eventId][existingIndex];
      data.orders[order.eventId][existingIndex] = {
        ...order,
        id: existing.id,
        isPaid: existing.isPaid,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      saveDb(data);
      return data.orders[order.eventId][existingIndex];
    } else {
      const newOrder: UserOrder = {
        ...order,
        createdAt: now,
        updatedAt: now,
      };
      data.orders[order.eventId].push(newOrder);
      saveDb(data);
      return newOrder;
    }
  },

  updateOrderStatus(eventId: string, orderId: string, isPaid: boolean): boolean {
    const data = ensureDbFile();
    const list = data.orders[eventId];
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
    const list = data.orders[eventId];
    if (!list) return false;
    data.orders[eventId] = list.filter((o) => o.id !== orderId);
    saveDb(data);
    return true;
  }
};
