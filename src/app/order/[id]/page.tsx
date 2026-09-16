'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Utensils,
  Plus,
  Minus,
  Lock,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  ShoppingBag,
  Clock,
  MapPin,
  Calendar,
  User,
  Share2,
  Check,
  Store,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EventData, MenuItem, OrderItem, UserOrder } from '@/types';
import { formatRupiah, calculateOrder } from '@/lib/calculator';

export default function OrderPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Current user order form state
  const [userName, setUserName] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, { quantity: number; notes: string }>>({});
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [existingOrder, setExistingOrder] = useState<UserOrder | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch event and orders
  const fetchEventData = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        setError(json.message || 'Acara tidak ditemukan.');
      } else {
        setEvent(json.data);
        setOrders(json.orders || []);
      }
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data acara. Coba segarkan halaman.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchEventData();
    }
  }, [eventId]);

  // Load saved user name from localStorage if available
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('makan_kantor_user_name');
      if (savedName) {
        setUserName(savedName);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // When userName changes or orders reload, check if this user already placed an order
  useEffect(() => {
    if (!userName.trim() || !orders.length) {
      setExistingOrder(null);
      return;
    }

    const found = orders.find(
      (o) => o.userName.trim().toLowerCase() === userName.trim().toLowerCase()
    );

    if (found) {
      setExistingOrder(found);
      // Pre-fill selected items from existing order
      const map: Record<string, { quantity: number; notes: string }> = {};
      found.items.forEach((it) => {
        map[it.menuItemId] = {
          quantity: it.quantity,
          notes: it.notes || '',
        };
      });
      setSelectedItems(map);
    } else {
      setExistingOrder(null);
    }
  }, [userName, orders]);

  // Categories list
  const categories = useMemo(() => {
    if (!event) return ['Semua'];
    const cats = new Set(event.menuItems.map((it) => it.category || 'Makanan'));
    return ['Semua', ...Array.from(cats)];
  }, [event]);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    if (!event) return [];
    if (activeCategory === 'Semua') return event.menuItems;
    return event.menuItems.filter((it) => (it.category || 'Makanan') === activeCategory);
  }, [event, activeCategory]);

  // Handle Qty change
  const handleItemQty = (item: MenuItem, delta: number) => {
    if (event?.isLocked) return;

    setSelectedItems((prev) => {
      const current = prev[item.id] || { quantity: 0, notes: '' };
      const newQty = Math.max(0, current.quantity + delta);

      if (newQty === 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      return {
        ...prev,
        [item.id]: {
          ...current,
          quantity: newQty,
        },
      };
    });
  };

  // Handle Note change
  const handleItemNote = (itemId: string, notes: string) => {
    if (event?.isLocked) return;

    setSelectedItems((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          notes,
        },
      };
    });
  };

  // Format order items for calculation
  const orderItemsList: OrderItem[] = useMemo(() => {
    if (!event) return [];
    return Object.entries(selectedItems)
      .filter(([_, data]) => data.quantity > 0)
      .map(([itemId, data]) => {
        const menu = event.menuItems.find((m) => m.id === itemId);
        return {
          menuItemId: itemId,
          menuItemName: menu ? menu.name : 'Menu',
          price: menu ? menu.price : 0,
          quantity: data.quantity,
          notes: data.notes,
        };
      });
  }, [selectedItems, event]);

  // Total calculations
  const calculation = useMemo(() => {
    if (!event) {
      return {
        subtotal: 0,
        taxAmount: 0,
        serviceAmount: 0,
        rawTotal: 0,
        roundingAmount: 0,
        totalAmount: 0,
      };
    }
    return calculateOrder(orderItemsList, event.taxConfig);
  }, [orderItemsList, event]);

  const totalItemCount = useMemo(() => {
    return orderItemsList.reduce((sum, it) => sum + it.quantity, 0);
  }, [orderItemsList]);

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || event.isLocked) return;

    if (!userName.trim()) {
      alert('Harap masukkan nama Anda terlebih dahulu.');
      return;
    }

    if (orderItemsList.length === 0) {
      alert('Silakan pilih minimal satu menu makanan atau minuman.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/events/${eventId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: userName.trim(),
          items: orderItemsList,
          orderId: existingOrder?.id,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        alert(json.message || 'Gagal menyimpan pesanan.');
        return;
      }

      // Save user name locally
      try {
        localStorage.setItem('makan_kantor_user_name', userName.trim());

        // Update history
        const historyRaw = localStorage.getItem('makan_kantor_history');
        const list = historyRaw ? JSON.parse(historyRaw) : [];
        if (!list.some((h: any) => h.id === event.id)) {
          list.unshift({
            id: event.id,
            title: event.title,
            restaurantName: event.restaurantName,
            date: event.date,
            role: 'participant',
          });
          localStorage.setItem('makan_kantor_history', JSON.stringify(list.slice(0, 15)));
        }
      } catch (e) {
        console.error(e);
      }

      setSubmitSuccess(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.8 },
      });

      // Refresh orders
      await fetchEventData();

      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Memuat menu makanan...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Acara Tidak Ditemukan</h2>
        <p className="text-xs text-slate-600">{error || 'Periksa kembali link yang diberikan oleh PIC.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-32">
      {/* Event Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5 mb-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
              <Store className="w-3.5 h-3.5" />
              {event.restaurantName}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              {event.title}
            </h1>
          </div>

          {/* Locked Badge */}
          {event.isLocked ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
              <Lock className="w-3.5 h-3.5" /> Dikunci
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Buka
            </span>
          )}
        </div>

        {/* Event details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">PIC: <strong>{event.picName}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{event.time} WIB</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{event.date}</span>
          </div>
        </div>

        {event.restaurantAddress && (
          <div className="flex items-start gap-1.5 text-xs text-slate-500 pt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{event.restaurantAddress}</span>
          </div>
        )}
      </div>

      {/* Locked Alert Warning */}
      {event.isLocked && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5">
          <Lock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold block">Pesanan Telah Dikunci oleh PIC</strong>
            <p className="text-xs text-red-700 mt-0.5">
              PIC telah menutup pemesanan untuk diserahkan ke restoran. Anda tidak dapat mengubah atau menambah pesanan lagi. Di bawah ini adalah rincian tagihan Anda.
            </p>
          </div>
        </div>
      )}

      {/* User Name Input Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 mb-5">
        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
          Nama Lengkap / Panggilan Kamu *
        </label>
        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Masukkan namamu (misal: Budi Santoso / Sarah IT)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={event.isLocked}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        {existingOrder ? (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-between">
            <div>
              <span className="font-bold">Pesanan sebelumnya ditemukan!</span>
              <p className="text-[11px] text-blue-600">
                {event.isLocked
                  ? 'Berikut adalah rincian pesanan yang telah Anda simpan.'
                  : 'Anda dapat menyesuaikan menu di bawah dan klik "Simpan Perubahan".'}
              </p>
            </div>
            <span className="font-bold text-blue-900 bg-blue-100 px-2 py-1 rounded">
              {formatRupiah(existingOrder.totalAmount)}
            </span>
          </div>
        ) : (
          userName.trim() && (
            <p className="text-[11px] text-slate-500">
              Halo <strong>{userName}</strong>, silakan pilih menu makanan & minumanmu di bawah ini:
            </p>
          )
        )}
      </div>

      {/* Menu Categories Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              activeCategory === cat
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items List */}
      <div className="space-y-3">
        {filteredMenuItems.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            Tidak ada menu di kategori ini.
          </div>
        ) : (
          filteredMenuItems.map((item) => {
            const current = selectedItems[item.id] || { quantity: 0, notes: '' };
            const isSelected = current.quantity > 0;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-4 transition ${
                  isSelected
                    ? 'border-orange-500 ring-1 ring-orange-500 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 pr-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 leading-snug">{item.name}</h3>
                      {item.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <span className="block text-sm font-extrabold text-orange-600 mt-2">
                      {formatRupiah(item.price)}
                    </span>
                  </div>

                  {/* Quantity Counter Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => handleItemQty(item, -1)}
                      disabled={event.isLocked || current.quantity === 0}
                      className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-30 text-slate-700 flex items-center justify-center shadow-xs transition"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-bold text-sm text-slate-900">
                      {current.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleItemQty(item, 1)}
                      disabled={event.isLocked}
                      className="w-8 h-8 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-30 text-white flex items-center justify-center shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Notes Input (if item is selected) */}
                {isSelected && !event.isLocked && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <input
                      type="text"
                      placeholder="Catatan khusus (misal: pedas sedang, es sedikit, sambal dipisah)..."
                      value={current.notes}
                      onChange={(e) => handleItemNote(item.id, e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                )}

                {/* Notes Readonly (if locked and note exists) */}
                {isSelected && event.isLocked && current.notes && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    Catatan: <span className="italic text-slate-700 font-medium">{current.notes}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl safe-area-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          {/* Detailed breakdown expandable drawer */}
          {showBreakdown && totalItemCount > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1.5 mb-2 animate-in slide-in-from-bottom duration-150">
              <div className="font-bold text-slate-800 pb-1 border-b border-slate-200 flex justify-between">
                <span>Rincian Tagihan {userName ? `(${userName})` : ''}</span>
                <span>{totalItemCount} porsi</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal Menu:</span>
                <span className="font-medium">{formatRupiah(calculation.subtotal)}</span>
              </div>

              {event.taxConfig.useTax && (
                <div className="flex justify-between text-slate-600">
                  <span>PPN / Pajak Resto ({event.taxConfig.taxPercent}%):</span>
                  <span className="font-medium">+{formatRupiah(calculation.taxAmount)}</span>
                </div>
              )}

              {event.taxConfig.useServiceCharge && (
                <div className="flex justify-between text-slate-600">
                  <span>Service Charge ({event.taxConfig.serviceChargePercent}%):</span>
                  <span className="font-medium">+{formatRupiah(calculation.serviceAmount)}</span>
                </div>
              )}

              {calculation.roundingAmount !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Pembulatan {calculation.roundingAmount < 0 ? '(Sesuai Nota Resto)' : ''}:</span>
                  <span className={`font-medium ${calculation.roundingAmount < 0 ? 'text-emerald-600 font-semibold' : ''}`}>
                    {calculation.roundingAmount > 0 ? `+${formatRupiah(calculation.roundingAmount)}` : formatRupiah(calculation.roundingAmount)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
                <span>Total Harus Dibayar:</span>
                <span className="text-orange-600">{formatRupiah(calculation.totalAmount)}</span>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowBreakdown(!showBreakdown)}
              disabled={totalItemCount === 0}
              className="flex items-center gap-1.5 text-left disabled:opacity-40"
            >
              <div>
                <span className="block text-[11px] text-slate-500 font-medium">
                  {totalItemCount} Menu Dipilih
                </span>
                <span className="block text-base font-extrabold text-slate-900 leading-tight">
                  {formatRupiah(calculation.totalAmount)}
                </span>
              </div>
              {showBreakdown ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {event.isLocked ? (
              <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Pesanan Terkunci
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting || totalItemCount === 0}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>{existingOrder ? 'Simpan Perubahan' : 'Kirim Pesanan'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {submitSuccess && (
        <div className="fixed top-5 left-4 right-4 max-w-md mx-auto z-50 p-4 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top duration-200">
          <CheckCircle className="w-6 h-6 shrink-0" />
          <div className="flex-1 text-xs">
            <strong className="block text-sm font-bold">Pesanan Berhasil Disimpan!</strong>
            <span>Total tagihanmu: <strong>{formatRupiah(calculation.totalAmount)}</strong>. Kamu bisa mengedit pesanan ini kapan saja sebelum PIC mengunci pesanan.</span>
          </div>
        </div>
      )}
    </div>
  );
}
