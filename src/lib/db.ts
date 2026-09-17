import fs from 'fs';
import path from 'path';
import os from 'os';
import { EventData, UserOrder } from '@/types';
import { supabase } from './supabase';

interface DatabaseSchema {
  events: Record<string, EventData>;
  orders: Record<string, UserOrder[]>;
}

// In serverless environments like Vercel, the project folder is read-only.
function getDbFilePath(): string {
  if (process.env.VERCEL) {
    return path.join('/tmp', 'makan_kantor_db.json');
  }
  // For local development or non-Vercel environments:
  return path.join(process.cwd(), 'src', 'data', 'db.json');
}

function ensureDbFile(): DatabaseSchema {
  const filePath = getDbFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.events === 'object') {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading db file:', err);
  }

  // Also check standard project file as backup source
  const fallbackPath = path.join(process.cwd(), 'src', 'data', 'db.json');
  try {
    if (fs.existsSync(fallbackPath)) {
      const data = fs.readFileSync(fallbackPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.events === 'object') {
        return parsed;
      }
    }
  } catch (e) {}

  const initialDb: DatabaseSchema = {
    events: {},
    orders: {},
  };

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(initialDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error creating db file at primary path, trying os.tmpdir():', err);
    try {
      const tmpPath = path.join(os.tmpdir(), 'makan_kantor_db.json');
      fs.writeFileSync(tmpPath, JSON.stringify(initialDb, null, 2), 'utf-8');
    } catch (tmpErr) {
      console.error('Error creating db file in os.tmpdir():', tmpErr);
    }
  }

  return initialDb;
}

function saveDb(data: DatabaseSchema): void {
  const filePath = getDbFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db file to primary path:', err);
    // Fallback to os.tmpdir() if write failed
    try {
      const tmpPath = path.join(os.tmpdir(), 'makan_kantor_db.json');
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (tmpErr) {
      console.error('Error saving db file to os.tmpdir():', tmpErr);
    }
  }
}

// In-memory cache for fast response across lambda hot-starts
let memoryCache: DatabaseSchema | null = null;

function getCache(): DatabaseSchema {
  if (!memoryCache) {
    memoryCache = ensureDbFile();
  }
  return memoryCache;
}

export const db = {
  async getEvent(id: string): Promise<EventData | null> {
    if (!id || id === 'undefined') return null;
    const cleanId = decodeURIComponent(id).trim().toLowerCase();

    // 1. Check Supabase if configured
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .ilike('id', cleanId)
          .maybeSingle();

        if (data && !error) {
          return {
            id: data.id,
            adminPin: data.admin_pin,
            title: data.title,
            picName: data.pic_name,
            date: data.date,
            time: data.time,
            restaurantName: data.restaurant_name,
            restaurantAddress: data.restaurant_address || '',
            taxConfig: data.tax_config,
            menuItems: data.menu_items || [],
            isLocked: data.is_locked,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (sbErr) {
        console.error('Supabase getEvent error:', sbErr);
      }
    }

    // 2. Local memory / file lookup
    const cache = getCache();
    if (cache.events[id]) return cache.events[id];
    if (cache.events[cleanId]) return cache.events[cleanId];

    const entries = Object.entries(cache.events);
    for (const [key, ev] of entries) {
      if (key.toLowerCase() === cleanId || ev.id.toLowerCase() === cleanId) {
        return ev;
      }
    }

    for (const [key, ev] of entries) {
      if (key.toLowerCase().includes(cleanId) || cleanId.includes(key.toLowerCase())) {
        return ev;
      }
    }

    return null;
  },

  async getAllEvents(): Promise<EventData[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && !error) {
          return data.map((d: any) => ({
            id: d.id,
            adminPin: d.admin_pin,
            title: d.title,
            picName: d.pic_name,
            date: d.date,
            time: d.time,
            restaurantName: d.restaurant_name,
            restaurantAddress: d.restaurant_address || '',
            taxConfig: d.tax_config,
            menuItems: d.menu_items || [],
            isLocked: d.is_locked,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (sbErr) {
        console.error('Supabase getAllEvents error:', sbErr);
      }
    }

    const cache = getCache();
    return Object.values(cache.events).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async saveEvent(event: EventData): Promise<EventData> {
    const cleanId = event.id.trim().toLowerCase();
    const eventToSave: EventData = {
      ...event,
      id: cleanId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Supabase Cloud Sync
    if (supabase) {
      try {
        const { error } = await supabase.from('events').upsert({
          id: cleanId,
          admin_pin: eventToSave.adminPin,
          title: eventToSave.title,
          pic_name: eventToSave.picName,
          date: eventToSave.date,
          time: eventToSave.time,
          restaurant_name: eventToSave.restaurantName,
          restaurant_address: eventToSave.restaurantAddress,
          tax_config: eventToSave.taxConfig,
          menu_items: eventToSave.menuItems,
          is_locked: eventToSave.isLocked,
          created_at: eventToSave.createdAt,
          updated_at: eventToSave.updatedAt,
        });

        if (error) {
          console.error('Supabase upsert error:', error);
        }
      } catch (sbErr) {
        console.error('Supabase saveEvent error:', sbErr);
      }
    }

    // 2. Cache & File Save
    const cache = getCache();
    cache.events[cleanId] = eventToSave;
    if (!cache.orders[cleanId]) {
      cache.orders[cleanId] = [];
    }
    saveDb(cache);

    return eventToSave;
  },

  async updateEventLock(id: string, isLocked: boolean): Promise<EventData | null> {
    const event = await this.getEvent(id);
    if (!event) return null;

    if (supabase) {
      try {
        await supabase
          .from('events')
          .update({ is_locked: isLocked, updated_at: new Date().toISOString() })
          .eq('id', event.id);
      } catch (sbErr) {
        console.error('Supabase updateEventLock error:', sbErr);
      }
    }

    const cache = getCache();
    if (cache.events[event.id]) {
      cache.events[event.id].isLocked = isLocked;
      cache.events[event.id].updatedAt = new Date().toISOString();
      saveDb(cache);
    }

    return { ...event, isLocked };
  },

  async getOrders(eventId: string): Promise<UserOrder[]> {
    if (!eventId || eventId === 'undefined') return [];
    const cleanId = decodeURIComponent(eventId).trim().toLowerCase();
    const cache = getCache();
    const localOrders = cache.orders[cleanId] || cache.orders[eventId] || [];

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('event_id', cleanId)
          .order('created_at', { ascending: true });

        if (data && !error) {
          const sbOrders: UserOrder[] = data.map((d: any) => ({
            id: d.id,
            eventId: d.event_id,
            userName: d.user_name,
            items: d.items,
            subtotal: Number(d.subtotal),
            taxAmount: Number(d.tax_amount),
            serviceAmount: Number(d.service_amount),
            roundingAmount: Number(d.rounding_amount),
            totalAmount: Number(d.total_amount),
            isPaid: Boolean(d.is_paid),
            paymentMethod: d.payment_method || undefined,
            paidAmount: d.paid_amount != null ? Number(d.paid_amount) : undefined,
            changeAmount: d.change_amount != null ? Number(d.change_amount) : undefined,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));

          if (sbOrders.length > 0) {
            cache.orders[cleanId] = sbOrders;
            saveDb(cache);
            return sbOrders;
          } else if (localOrders.length > 0) {
            // Supabase is empty but local cache has orders:
            // Sync local orders to Supabase so they don't get lost
            for (const ord of localOrders) {
              this.saveOrder(ord).catch(() => {});
            }
            return localOrders;
          }
          return [];
        }
      } catch (sbErr) {
        console.error('Supabase getOrders error:', sbErr);
      }
    }

    return localOrders;
  },

  async saveOrder(order: UserOrder): Promise<UserOrder> {
    const cleanEventId = order.eventId.trim().toLowerCase();
    const now = new Date().toISOString();

    const orderToSave: UserOrder = {
      ...order,
      eventId: cleanEventId,
      updatedAt: now,
    };

    if (supabase) {
      try {
        // Check if there's an existing order in Supabase with matching name & event
        const { data: existingRow } = await supabase
          .from('orders')
          .select('id')
          .eq('event_id', cleanEventId)
          .ilike('user_name', orderToSave.userName.trim())
          .maybeSingle();

        if (existingRow?.id) {
          orderToSave.id = existingRow.id;
        }

        const basePayload: Record<string, any> = {
          id: orderToSave.id,
          event_id: cleanEventId,
          user_name: orderToSave.userName.trim(),
          items: orderToSave.items,
          subtotal: orderToSave.subtotal,
          tax_amount: orderToSave.taxAmount,
          service_amount: orderToSave.serviceAmount,
          rounding_amount: orderToSave.roundingAmount,
          total_amount: orderToSave.totalAmount,
          is_paid: orderToSave.isPaid,
          created_at: orderToSave.createdAt || now,
          updated_at: now,
        };

        const fullPayload = {
          ...basePayload,
          payment_method: orderToSave.paymentMethod || null,
          paid_amount: orderToSave.paidAmount ?? null,
          change_amount: orderToSave.changeAmount ?? null,
        };

        let { error: upsertErr } = await supabase
          .from('orders')
          .upsert(fullPayload, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('Supabase full upsert failed, retrying with base payload:', upsertErr.message);
          const { error: baseErr } = await supabase
            .from('orders')
            .upsert(basePayload, { onConflict: 'id' });

          if (baseErr) {
            console.error('Supabase base upsert error:', baseErr);
          }
        }
      } catch (sbErr) {
        console.error('Supabase saveOrder exception:', sbErr);
      }
    }

    const cache = getCache();
    if (!cache.orders[cleanEventId]) {
      cache.orders[cleanEventId] = [];
    }

    const existingIndex = cache.orders[cleanEventId].findIndex(
      (o) => o.userName.trim().toLowerCase() === order.userName.trim().toLowerCase() || o.id === order.id
    );

    if (existingIndex >= 0) {
      cache.orders[cleanEventId][existingIndex] = orderToSave;
    } else {
      cache.orders[cleanEventId].push(orderToSave);
    }
    saveDb(cache);

    return orderToSave;
  },

  async updateOrderStatus(
    eventId: string,
    orderId: string,
    isPaid: boolean,
    paymentDetails?: {
      paymentMethod?: 'cash' | 'transfer';
      paidAmount?: number;
      changeAmount?: number;
    }
  ): Promise<boolean> {
    const cleanEventId = eventId.trim().toLowerCase();
    const now = new Date().toISOString();

    const paymentMethod = paymentDetails?.paymentMethod || (isPaid ? 'transfer' : undefined);
    const paidAmount = paymentDetails?.paidAmount;
    const changeAmount = paymentDetails?.changeAmount;

    if (supabase) {
      try {
        const baseUpdate: Record<string, any> = {
          is_paid: isPaid,
          updated_at: now,
        };
        const fullUpdate = {
          ...baseUpdate,
          payment_method: isPaid ? paymentMethod : null,
          paid_amount: isPaid ? paidAmount : null,
          change_amount: isPaid ? changeAmount : null,
        };

        const { error: patchErr } = await supabase
          .from('orders')
          .update(fullUpdate)
          .eq('id', orderId);

        if (patchErr) {
          await supabase.from('orders').update(baseUpdate).eq('id', orderId);
        }
      } catch (sbErr) {
        console.error('Supabase updateOrderStatus error:', sbErr);
      }
    }

    const cache = getCache();
    const list = cache.orders[cleanEventId] || cache.orders[eventId];
    if (list) {
      const ord = list.find((o) => o.id === orderId);
      if (ord) {
        ord.isPaid = isPaid;
        ord.paymentMethod = isPaid ? paymentMethod : undefined;
        ord.paidAmount = isPaid ? paidAmount : undefined;
        ord.changeAmount = isPaid ? changeAmount : undefined;
        ord.updatedAt = now;
        saveDb(cache);
        return true;
      }
    }

    return true;
  },

  async deleteOrder(eventId: string, orderId: string): Promise<boolean> {
    const cleanEventId = eventId.trim().toLowerCase();

    if (supabase) {
      try {
        await supabase.from('orders').delete().eq('id', orderId);
      } catch (sbErr) {
        console.error('Supabase deleteOrder error:', sbErr);
      }
    }

    const cache = getCache();
    const list = cache.orders[cleanEventId] || cache.orders[eventId];
    if (list) {
      cache.orders[cleanEventId] = list.filter((o) => o.id !== orderId);
      saveDb(cache);
    }

    return true;
  }
};
