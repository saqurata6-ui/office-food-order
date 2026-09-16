'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  Edit3,
  RotateCcw,
  Sparkles,
  Calculator,
  X,
  Eye,
  FileText,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EventData, MenuItem, OrderItem, UserOrder, TaxConfig } from '@/types';
import { formatRupiah, calculateOrder, normalizeName } from '@/lib/calculator';

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
  const [previewOrder, setPreviewOrder] = useState<UserOrder | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTaxEstimate, setShowTaxEstimate] = useState(false);

  const [availableEvents, setAvailableEvents] = useState<any[]>([]);

  // Fetch event and orders
  const fetchEventData = async () => {
    if (!eventId || eventId === 'undefined') return;
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        // Cek localStorage browser untuk pemulihan acara
        try {
          const localSaved = localStorage.getItem(`makan_kantor_event_${eventId}`);
          if (localSaved) {
            const restored = JSON.parse(localSaved);
            await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(restored),
            });
            setEvent(restored);
            setError('');
            return;
          }
        } catch (e) {}

        if (json.availableEvents) {
          setAvailableEvents(json.availableEvents);
        }
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
    if (eventId && eventId !== 'undefined') {
      fetchEventData();
    }
  }, [eventId]);

  // Check if typed name matches an existing order (for suggestion prompt)
  const matchingOrderForTypedName = useMemo(() => {
    const clean = normalizeName(userName);
    if (!clean || existingOrder) return null;
    return orders.find((o) => normalizeName(o.userName) === clean) || null;
  }, [userName, existingOrder, orders]);

  // Handler to start editing an existing order
  const handleStartEdit = (user: UserOrder) => {
    setUserName(user.userName);
    setExistingOrder(user);
    setShowTaxEstimate(user.taxAmount > 0);
    const map: Record<string, { quantity: number; notes: string }> = {};
    user.items.forEach((it) => {
      map[it.menuItemId] = {
        quantity: it.quantity,
        notes: it.notes || '',
      };
    });
    setSelectedItems(map);
    setPreviewOrder(null);
  };

  // Reset to empty / new order
  const handleResetToNewOrder = () => {
    setUserName('');
    setExistingOrder(null);
    setSelectedItems({});
  };

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
  // Jika event memiliki PPN, PPN hanya dihitung ke total jika showTaxEstimate aktif
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
    const effectiveTaxConfig: TaxConfig = {
      ...event.taxConfig,
      useTax: event.taxConfig.useTax && showTaxEstimate,
    };
    return calculateOrder(orderItemsList, effectiveTaxConfig);
  }, [orderItemsList, event, showTaxEstimate]);

  // Kalkulasi untuk preview pesanan yang mengikuti centangan showTaxEstimate
  const previewCalculation = useMemo(() => {
    if (!previewOrder || !event) return null;
    const effectiveTaxConfig: TaxConfig = {
      ...event.taxConfig,
      useTax: event.taxConfig.useTax && showTaxEstimate,
    };
    return calculateOrder(previewOrder.items, effectiveTaxConfig);
  }, [previewOrder, event, showTaxEstimate]);

  const totalItemCount = useMemo(() => {
    return orderItemsList.reduce((sum, it) => sum + it.quantity, 0);
  }, [orderItemsList]);

  // Submit Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || event.isLocked) return;

    const cleanName = normalizeName(userName);
    if (!cleanName) {
      alert('Harap masukkan nama Anda terlebih dahulu.');
      return;
    }

    // Validasi nama pemesan tidak boleh sama (mencegah typo spasi / kapitalisasi)
    if (!existingOrder) {
      const duplicate = orders.find((o) => normalizeName(o.userName) === cleanName);
      if (duplicate) {
        alert(
          `Nama "${userName.trim()}" sudah digunakan dalam pesanan (${duplicate.userName}).\n\nJika ini pesanan Anda, silakan klik nama Anda pada daftar pesanan di atas untuk mengubah pesanan, atau tambahkan nama pembeda (misal: divisi / inisial).`
        );
        return;
      }
    } else {
      const duplicateOther = orders.find(
        (o) => o.id !== existingOrder.id && normalizeName(o.userName) === cleanName
      );
      if (duplicateOther) {
        alert(
          `Nama "${userName.trim()}" sudah digunakan oleh orang lain (${duplicateOther.userName}). Harap gunakan nama Anda sendiri atau tambahkan pembeda.`
        );
        return;
      }
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
          includeTax: showTaxEstimate,
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
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Acara Tidak Ditemukan</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          {error || 'Periksa kembali link pesanan yang Anda terima.'}
        </p>

        {availableEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-2">
            <span className="block text-xs font-bold text-slate-800">
              Acara yang Sedang Berlangsung:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {availableEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/order/${ev.id}`}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 text-xs font-semibold text-slate-800 transition flex items-center justify-between group"
                >
                  <div className="overflow-hidden pr-2">
                    <span className="block font-bold text-slate-900 truncate group-hover:text-orange-600">
                      {ev.title}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {ev.restaurantName} • {ev.date}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-orange-600 shrink-0">Pilih Menu ➔</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs"
          >
            Ke Halaman Utama
          </Link>
        </div>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5 mb-5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Nama Pemesan *
          </label>
          {existingOrder && !event.isLocked && (
            <button
              type="button"
              onClick={handleResetToNewOrder}
              className="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg transition"
            >
              <RotateCcw className="w-3 h-3" />
              Pesan sebagai nama baru
            </button>
          )}
        </div>

        <div className="relative">
          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Ketik namamu (misal: Budi Santoso / Sarah IT)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={event.isLocked}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-500 transition ${
              existingOrder
                ? 'border-blue-300 bg-blue-50/40 text-blue-950 font-bold'
                : 'border-slate-300 bg-white text-slate-900'
            }`}
          />
        </div>

        {/* Prompt if typed name matches an existing order */}
        {matchingOrderForTypedName && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 min-w-0">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">
                Nama <strong>{matchingOrderForTypedName.userName}</strong> sudah ada di daftar pesanan.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOrder(matchingOrderForTypedName)}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 transition shadow-2xs flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              Lihat & Edit
            </button>
          </div>
        )}

        {/* Quick select previous order pills */}
        {orders.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700">
                {event.isLocked
                  ? 'Daftar pesanan (klik nama untuk lihat rincian menu):'
                  : 'Sudah pernah pesan? Klik nama untuk lihat & ubah menu:'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {orders.map((ord) => {
                const isCurrentActive =
                  existingOrder?.id === ord.id ||
                  ord.userName.trim().toLowerCase() === userName.trim().toLowerCase();
                
                // Hitung total untuk chip sesuai status centangan PPN
                const chipTaxConfig: TaxConfig = {
                  ...event.taxConfig,
                  useTax: event.taxConfig.useTax && showTaxEstimate,
                };
                const ordCalc = calculateOrder(ord.items, chipTaxConfig);

                return (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => setPreviewOrder(ord)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 border ${
                      isCurrentActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                    }`}
                  >
                    <span>{ord.userName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isCurrentActive
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {formatRupiah(ordCalc.totalAmount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Status banner when editing vs new order */}
        {existingOrder ? (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>Mode Edit Pesanan: {existingOrder.userName}</span>
              </div>
              <span className="text-[11px] font-extrabold bg-blue-200 text-blue-900 px-2 py-0.5 rounded-md">
                Tersimpan: {formatRupiah(
                  calculateOrder(existingOrder.items, {
                    ...event.taxConfig,
                    useTax: event.taxConfig.useTax && showTaxEstimate,
                  }).totalAmount
                )}
              </span>
            </div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              {event.isLocked
                ? 'Pesanan sudah dikunci oleh PIC. Anda hanya dapat melihat rincian pesanan Anda.'
                : 'Porsi dan catatan sebelumnya sudah otomatis terisi di bawah. Silakan tambah/kurang menu, lalu tekan tombol "Simpan Perubahan Pesanan" di bawah.'}
            </p>
          </div>
        ) : (
          userName.trim() && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>
                Pesanan baru untuk <strong>{userName}</strong>. Silakan tentukan menu di bawah:
              </span>
            </p>
          )
        )}
      </div>

      {/* Tax Estimate Toggle & Categories Header */}
      <div className="space-y-2.5 mb-4">
        {event.taxConfig.useTax && (
          <div className="flex items-center justify-between bg-orange-50/70 border border-orange-200 rounded-xl px-3.5 py-2.5 shadow-2xs">
            <label
              htmlFor="tax-toggle"
              className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-slate-800"
            >
              <input
                id="tax-toggle"
                type="checkbox"
                checked={showTaxEstimate}
                onChange={(e) => setShowTaxEstimate(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer accent-orange-600"
              />
              <div>
                <span className="font-bold text-slate-900 block">
                  Hitung tagihan termasuk PPN ({event.taxConfig.taxPercent}%)
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {showTaxEstimate
                    ? 'PPN aktif: harga menu & total tagihan sudah ditambahkan PPN'
                    : 'PPN non-aktif: total tagihan dihitung murni harga asli menu'}
                </span>
              </div>
            </label>
            <span
              className={`text-[11px] px-2.5 py-1 rounded-lg font-bold shrink-0 transition ${
                showTaxEstimate
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {showTaxEstimate ? '+ PPN Aktif' : 'Tanpa PPN'}
            </span>
          </div>
        )}

        {/* Menu Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
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
      </div>

      {/* Menu Items List */}
      {/* Menu Items List - Option 1: Compact List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredMenuItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Tidak ada menu di kategori ini.
          </div>
        ) : (
          filteredMenuItems.map((item) => {
            const current = selectedItems[item.id] || { quantity: 0, notes: '' };
            const isSelected = current.quantity > 0;

            // Hitung estimasi harga + PPN jika fitur dicentang
            const taxMultiplier = event.taxConfig.useTax ? 1 + event.taxConfig.taxPercent / 100 : 1;
            const priceWithTax = Math.round(item.price * taxMultiplier);

            return (
              <div
                key={item.id}
                className={`p-3 sm:px-4 sm:py-3 transition-colors ${
                  isSelected
                    ? 'bg-orange-50/50 border-l-4 border-l-orange-500 pl-2.5 sm:pl-3.5'
                    : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Info Menu */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                        {item.name}
                      </h3>
                      {item.category && (
                        <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xs sm:text-sm font-extrabold text-orange-600">
                        {showTaxEstimate && event.taxConfig.useTax
                          ? formatRupiah(priceWithTax)
                          : formatRupiah(item.price)}
                      </span>
                      {showTaxEstimate && event.taxConfig.useTax && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Asli: {formatRupiah(item.price)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Compact Counter */}
                  <div className="flex items-center gap-1 shrink-0 bg-slate-100/90 border border-slate-200 rounded-xl p-0.5 sm:p-1">
                    <button
                      type="button"
                      onClick={() => handleItemQty(item, -1)}
                      disabled={event.isLocked || current.quantity === 0}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-700 font-bold flex items-center justify-center shadow-xs transition"
                      aria-label="Kurangi porsi"
                    >
                      <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <span className="w-6 sm:w-7 text-center font-extrabold text-xs sm:text-sm text-slate-900">
                      {current.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleItemQty(item, 1)}
                      disabled={event.isLocked}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-30 text-white font-bold flex items-center justify-center shadow-xs transition"
                      aria-label="Tambah porsi"
                    >
                      <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Compact Note input when quantity > 0 */}
                {isSelected && !event.isLocked && (
                  <div className="mt-2 pt-2 border-t border-dashed border-orange-200/80 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <input
                      type="text"
                      placeholder="Catatan khusus (misal: pedas sedang, es sedikit, kuah dipisah)..."
                      value={current.notes}
                      onChange={(e) => handleItemNote(item.id, e.target.value)}
                      className="flex-1 text-xs py-1 px-2.5 rounded-lg bg-white border border-orange-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                )}

                {/* Note readonly when locked */}
                {isSelected && event.isLocked && current.notes && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
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
                ) : existingOrder ? (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span>Simpan Perubahan Pesanan</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Kirim Pesanan</span>
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

      {/* Modal Preview Pesanan Saat Chip Dipilih */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Preview Menu Pilihan
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    {previewOrder.userName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                aria-label="Tutup preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: List Menu */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                <span>Daftar Menu</span>
                <span>{previewOrder.items.reduce((s, i) => s + i.quantity, 0)} Porsi</span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                {previewOrder.items.map((it, idx) => (
                  <div key={idx} className="p-3 text-xs flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 leading-snug">
                        <span className="text-orange-600 mr-1.5 font-extrabold">{it.quantity}x</span>
                        {it.menuItemName}
                      </div>
                      {it.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">
                          Catatan: {it.notes}
                        </p>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        @ {formatRupiah(it.price)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 shrink-0">
                      {formatRupiah(it.price * it.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Toggle Estimasi PPN di dalam Modal Preview */}
              {event.taxConfig.useTax && (
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/70 border border-orange-200 cursor-pointer select-none text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showTaxEstimate}
                      onChange={(e) => setShowTaxEstimate(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer accent-orange-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Hitung tagihan termasuk PPN ({event.taxConfig.taxPercent}%)
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {showTaxEstimate
                          ? 'PPN aktif: total tagihan ditambahkan PPN'
                          : 'PPN non-aktif: total tagihan murni harga menu'}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 transition ${
                      showTaxEstimate
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {showTaxEstimate ? '+ PPN Aktif' : 'Tanpa PPN'}
                  </span>
                </label>
              )}

              {/* Rincian Finansial */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
                <div className="flex justify-between">
                  <span>Subtotal Menu:</span>
                  <span className="font-medium text-slate-800">
                    {formatRupiah(previewCalculation?.subtotal ?? previewOrder.subtotal)}
                  </span>
                </div>
                {showTaxEstimate && event.taxConfig.useTax && (previewCalculation?.taxAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>PPN ({event.taxConfig.taxPercent}%):</span>
                    <span className="font-medium text-slate-800">
                      +{formatRupiah(previewCalculation!.taxAmount)}
                    </span>
                  </div>
                )}
                {(previewCalculation?.serviceAmount ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Charge:</span>
                    <span className="font-medium text-slate-800">
                      +{formatRupiah(previewCalculation!.serviceAmount)}
                    </span>
                  </div>
                )}
                {previewCalculation?.roundingAmount !== 0 && previewCalculation?.roundingAmount !== undefined && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pembulatan:</span>
                    <span className="font-medium text-slate-800">
                      {previewCalculation.roundingAmount > 0
                        ? `+${formatRupiah(previewCalculation.roundingAmount)}`
                        : formatRupiah(previewCalculation.roundingAmount)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-sm text-slate-900">
                  <span>Total Tagihan:</span>
                  <span className="text-orange-600 text-base">
                    {formatRupiah(previewCalculation?.totalAmount ?? previewOrder.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Info Pembayaran */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500 font-medium">Status Bayar:</span>
                {previewOrder.isPaid ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3" /> Lunas ({previewOrder.paymentMethod === 'cash' ? 'Cash' : 'Transfer'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Belum Bayar
                  </span>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Tutup
              </button>
              {!event.isLocked ? (
                <button
                  type="button"
                  onClick={() => {
                    handleStartEdit(previewOrder);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-orange-600/20"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Pesanan Ini
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 py-1">
                  <Lock className="w-3.5 h-3.5" /> Terkunci
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
