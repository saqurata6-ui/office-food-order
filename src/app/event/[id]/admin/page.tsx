'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Unlock,
  Share2,
  FileSpreadsheet,
  FileText,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Users,
  Utensils,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  MessageCircle,
  Edit2,
  Edit3,
  ArrowUpDown,
} from 'lucide-react';
import { EventData, UserOrder, MenuItem } from '@/types';
import { formatRupiah } from '@/lib/calculator';
import {
  exportToExcel,
  exportToPdf,
  generateWhatsAppMessage,
  getGroupedRestaurantOrders,
} from '@/lib/export';
import { nanoid } from 'nanoid';

export default function EventAdminPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const initialPin = searchParams.get('pin') || '';

  const [event, setEvent] = useState<EventData | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // PIN authentication state
  const [adminPin, setAdminPin] = useState(initialPin);
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(!!initialPin);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'resto' | 'splitbill' | 'menu'>('resto');
  const [searchName, setSearchName] = useState('');
  const [restoSortBy, setRestoSortBy] = useState<'first_added' | 'latest_added' | 'qty_desc' | 'name_asc'>('first_added');

  // Copy / Share Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);

  // Add / Edit menu form state
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Makanan');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [availableEvents, setAvailableEvents] = useState<any[]>([]);

  const fetchEventAndOrders = async (pinToUse?: string) => {
    if (!eventId || eventId === 'undefined') return;
    try {
      const pinParam = pinToUse || adminPin;
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}${pinParam ? `?pin=${pinParam}` : ''}`);
      const json = await res.json();

      if (!json.success || !json.data) {
        // Cek apakah data acara tersimpan di localStorage browser ini untuk auto-restore
        try {
          const localSaved = localStorage.getItem(`makan_kantor_event_${eventId}`);
          const historyRaw = localStorage.getItem('makan_kantor_history');
          let foundInHistory = null;
          if (historyRaw) {
            const hList = JSON.parse(historyRaw);
            foundInHistory = hList.find((h: any) => h.id === eventId || h.id?.toLowerCase() === eventId?.toLowerCase());
          }

          if (localSaved) {
            const restored = JSON.parse(localSaved);
            // Sinkronkan kembali ke database server
            await fetch('/api/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(restored),
            });
            setEvent(restored);
            setIsPinAuthenticated(true);
            setError('');
            return;
          }
        } catch (localErr) {
          console.error('Error in local recovery:', localErr);
        }

        if (json.availableEvents) {
          setAvailableEvents(json.availableEvents);
        }
        setError(json.message || 'Acara tidak ditemukan.');
        return;
      }

      setEvent(json.data);
      setOrders(json.orders || []);

      if (json.isAdmin || pinParam === json.data.adminPin) {
        setIsPinAuthenticated(true);
      }
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId && eventId !== 'undefined') {
      fetchEventAndOrders();
    }
  }, [eventId]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin.trim()) return;
    if (event && inputPin.trim() === event.adminPin) {
      setAdminPin(inputPin.trim());
      setIsPinAuthenticated(true);
      setPinError('');
    } else {
      setPinError('PIN PIC salah. Silakan periksa kembali PIN Anda.');
    }
  };

  // Toggle Lock
  const handleToggleLock = async () => {
    if (!event) return;
    const newLockState = !event.isLocked;

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLocked: newLockState,
          adminPin,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEvent((prev) => (prev ? { ...prev, isLocked: newLockState } : null));
      } else {
        alert(json.message || 'Gagal mengubah status kunci.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi.');
    }
  };

  // Toggle isPaid for an order
  const handleTogglePaid = async (orderId: string, currentPaid: boolean) => {
    try {
      const res = await fetch(`/api/events/${eventId}/orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          isPaid: !currentPaid,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, isPaid: !currentPaid } : o))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete an order
  const handleDeleteOrder = async (orderId: string, userName: string) => {
    if (!confirm(`Hapus pesanan atas nama "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/events/${eventId}/orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'delete',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Start editing existing menu item
  const handleStartEditMenuItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setNewMenuName(item.name);
    setNewMenuPrice(item.price.toString());
    setNewMenuCategory(item.category || 'Makanan');
    // Scroll smoothly to form
    const formElement = document.getElementById('menu-item-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Cancel editing
  const handleCancelEditMenuItem = () => {
    setEditingItemId(null);
    setNewMenuName('');
    setNewMenuPrice('');
    setNewMenuCategory('Makanan');
  };

  // Add or update menu item from admin
  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName.trim() || !newMenuPrice || !event) return;

    const price = parseInt(newMenuPrice.toString().replace(/\D/g, ''), 10);
    if (isNaN(price) || price <= 0) return;

    let updatedMenuItems: MenuItem[];

    if (editingItemId) {
      // Update existing item
      updatedMenuItems = event.menuItems.map((it) =>
        it.id === editingItemId
          ? {
              ...it,
              name: newMenuName.trim(),
              price,
              category: newMenuCategory,
            }
          : it
      );
    } else {
      // Add new item
      const newItem: MenuItem = {
        id: `item_${nanoid(6)}`,
        name: newMenuName.trim(),
        price,
        category: newMenuCategory,
      };
      updatedMenuItems = [...event.menuItems, newItem];
    }

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItems: updatedMenuItems,
          adminPin,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEvent((prev) => (prev ? { ...prev, menuItems: updatedMenuItems } : null));
        handleCancelEditMenuItem();
      } else {
        alert(json.message || 'Gagal menyimpan perubahan menu.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan menu.');
    }
  };

  // Delete menu item from admin
  const handleDeleteMenuItem = async (itemId: string, itemName: string) => {
    if (!event) return;
    if (!confirm(`Hapus menu "${itemName}" dari daftar acara?`)) return;

    const updatedMenuItems = event.menuItems.filter((it) => it.id !== itemId);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItems: updatedMenuItems,
          adminPin,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEvent((prev) => (prev ? { ...prev, menuItems: updatedMenuItems } : null));
        if (editingItemId === itemId) {
          handleCancelEditMenuItem();
        }
      } else {
        alert(json.message || 'Gagal menghapus menu.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghapus menu.');
    }
  };

  // Grouped Resto Orders
  const groupedOrders = useMemo(() => {
    return getGroupedRestaurantOrders(orders, restoSortBy);
  }, [orders, restoSortBy]);

  // Statistics
  const totalPortions = useMemo(() => {
    return groupedOrders.reduce((sum, it) => sum + it.totalQty, 0);
  }, [groupedOrders]);

  const totalRestoBill = useMemo(() => {
    return groupedOrders.reduce((sum, it) => sum + it.totalQty * it.price, 0);
  }, [groupedOrders]);

  const totalCollectedBills = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const paidOrdersCount = useMemo(() => {
    return orders.filter((o) => o.isPaid).length;
  }, [orders]);

  const totalPaidAmount = useMemo(() => {
    return orders.filter((o) => o.isPaid).reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  // Filtered orders in split-bill tab
  const filteredOrders = useMemo(() => {
    if (!searchName.trim()) return orders;
    return orders.filter((o) =>
      o.userName.toLowerCase().includes(searchName.toLowerCase().trim())
    );
  }, [orders, searchName]);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/order/${eventId}` : '';

  const copyPublicLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyWhatsAppText = () => {
    if (!event) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = generateWhatsAppMessage(event, origin);
    navigator.clipboard.writeText(text);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  };

  const openWhatsApp = () => {
    if (!event) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = encodeURIComponent(generateWhatsAppMessage(event, origin));
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Memuat Dashboard PIC...</p>
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
          {error || 'Periksa kembali ID acara atau link yang Anda buka.'}
        </p>

        {availableEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-2">
            <span className="block text-xs font-bold text-slate-800">
              Acara yang Tersedia di Sistem:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {availableEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/event/${ev.id}/admin?pin=${ev.adminPin || ''}`}
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
                  <span className="text-[11px] font-bold text-orange-600 shrink-0">Buka ➔</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 flex items-center justify-center gap-2">
          <Link
            href="/create"
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
          >
            + Buat Acara Baru
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  // If not authenticated via PIN yet
  if (!isPinAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Verifikasi PIC (Admin)</h2>
            <p className="text-xs text-slate-600">
              Masukkan 4-digit PIN PIC yang dibuat saat awal pendaftaran acara <strong>{event.title}</strong>.
            </p>
          </div>

          {pinError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
              {pinError}
            </div>
          )}

          <form onSubmit={handleVerifyPin} className="space-y-4">
            <div>
              <input
                type="password"
                maxLength={6}
                autoFocus
                placeholder="Masukkan PIN PIC (contoh: 1234)"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                className="w-full text-center text-xl tracking-widest font-mono py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md transition"
            >
              Buka Dashboard PIC
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href={`/order/${event.id}`} className="text-xs text-slate-500 hover:text-slate-800">
              ← Kembali ke Halaman Pemesanan Karyawan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner: Status & Quick Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold">
                Dashboard PIC Admin
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">PIC: <strong>{event.picName}</strong></span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {event.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                📍 {event.restaurantName} {event.restaurantAddress && `(${event.restaurantAddress})`}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> {event.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> {event.time} WIB
              </span>
            </div>
          </div>

          {/* Lock / Unlock Toggle Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleLock}
              className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm ${
                event.isLocked
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {event.isLocked ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Buka Kunci Pesanan</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Kunci Pesanan Sekarang (Lock)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lock Status Alert */}
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            event.isLocked
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {event.isLocked ? <Lock className="w-4 h-4 text-red-600" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
            <span>
              Status: <strong>{event.isLocked ? 'TERKUNCI' : 'DIBUKA'}</strong> —{' '}
              {event.isLocked
                ? 'Anggota kantor tidak dapat mengubah atau menambah pesanan lagi.'
                : 'Anggota kantor masih dapat memilih & mengubah pesanan masing-masing.'}
            </span>
          </div>

          <Link
            href={`/order/${event.id}`}
            target="_blank"
            className="text-xs font-semibold underline flex items-center gap-1 shrink-0"
          >
            Lihat Form Pemesan <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Share & Export Action Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Share buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyPublicLink}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Tersalin!' : 'Salin Public Link'}</span>
            </button>

            <button
              type="button"
              onClick={copyWhatsAppText}
              className="px-3.5 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copiedWA ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <MessageCircle className="w-3.5 h-3.5" />}
              <span>{copiedWA ? 'Teks WA Tersalin!' : 'Salin Teks WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={openWhatsApp}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Kirim ke WhatsApp</span>
            </button>
          </div>

          {/* Export buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportToExcel(event, orders)}
              disabled={orders.length === 0}
              className="px-3.5 py-2 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              onClick={() => exportToPdf(event, orders)}
              disabled={orders.length === 0}
              className="px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={orders.length === 0}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Karyawan Pesan</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{orders.length} <span className="text-xs font-normal text-slate-500">orang</span></p>
          <p className="text-[11px] text-slate-500">
            {paidOrdersCount} lunas • {orders.length - paidOrdersCount} belum
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Porsi Menu</span>
            <Utensils className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totalPortions} <span className="text-xs font-normal text-slate-500">porsi</span></p>
          <p className="text-[11px] text-slate-500">Dari {groupedOrders.length} jenis menu</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Biaya Tagihan Resto</span>
            <CreditCard className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate">{formatRupiah(totalRestoBill)}</p>
          <p className="text-[11px] text-slate-500">Belum termasuk pajak resto</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Tagihan Split-Bill</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 truncate">{formatRupiah(totalCollectedBills)}</p>
          <p className="text-[11px] text-emerald-700 font-medium truncate">
            Terkumpul: {formatRupiah(totalPaidAmount)}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('resto')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'resto'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Rekap Pesanan Restoran</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
            {groupedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('splitbill')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'splitbill'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tagihan per Nama (Split Bill)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('menu')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'menu'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Kelola Menu</span>
        </button>
      </div>

      {/* TAB 1: REKAP RESTORAN (KITCHEN VIEW) */}
      {activeTab === 'resto' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Daftar Ringkasan Pesanan untuk Restoran
              </h2>
              <p className="text-xs text-slate-500">
                Gunakan daftar ini saat memesan atau menyerahkan list ke pelayan/kasir resto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Urutan selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-600">Urutkan:</span>
                <select
                  value={restoSortBy}
                  onChange={(e) => setRestoSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="first_added">Waktu Masuk Pertama (Awal Pesan)</option>
                  <option value="latest_added">Waktu Tambah Terbaru</option>
                  <option value="qty_desc">Porsi Terbanyak (Best Seller)</option>
                  <option value="name_asc">Nama Menu (A - Z)</option>
                </select>
              </div>

              <span className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                Total {totalPortions} Porsi
              </span>
            </div>
          </div>

          {groupedOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Belum ada pesanan yang masuk dari karyawan. Sebarkan public link di atas ke rekan kantor!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Menu</th>
                    <th className="py-3 px-4 text-center">Jumlah Porsi</th>
                    <th className="py-3 px-4 text-right">Harga Satuan</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4">Catatan Khusus dari Pemesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedOrders.map((item, idx) => (
                    <tr key={item.menuItemId} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">{item.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-extrabold text-xs">
                          {item.totalQty} porsi
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">{formatRupiah(item.price)}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatRupiah(item.totalQty * item.price)}
                      </td>
                      <td className="py-3 px-4">
                        {item.notes.length > 0 ? (
                          <div className="space-y-1">
                            {item.notes.map((n, nIdx) => (
                              <div key={nIdx} className="bg-amber-50 text-amber-900 px-2 py-1 rounded text-[11px] font-medium border border-amber-200/60">
                                {n}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Tidak ada catatan</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td colSpan={2} className="py-3 px-4 text-right">TOTAL PORSI:</td>
                    <td className="py-3 px-4 text-center text-orange-600 text-sm">{totalPortions} Porsi</td>
                    <td className="py-3 px-4 text-right">TOTAL:</td>
                    <td className="py-3 px-4 text-right text-sm text-slate-900">{formatRupiah(totalRestoBill)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SPLIT BILL PER NAMA */}
      {activeTab === 'splitbill' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Rekap Tagihan per Karyawan (Split Bill)
              </h2>
              <p className="text-xs text-slate-500">
                Centang kotak saat anggota sudah mentransfer atau membayar ke PIC.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama karyawan..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {searchName ? 'Tidak ditemukan karyawan dengan nama tersebut.' : 'Belum ada pesanan yang masuk.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                    <th className="py-3 px-3 w-10 text-center">No</th>
                    <th className="py-3 px-4">Nama Pemesan</th>
                    <th className="py-3 px-4">Menu Dipesan</th>
                    <th className="py-3 px-3 text-right">Subtotal</th>
                    <th className="py-3 px-3 text-right">PPN</th>
                    <th className="py-3 px-3 text-right">Bulat</th>
                    <th className="py-3 px-4 text-right">Total Bayar</th>
                    <th className="py-3 px-4 text-center">Status Bayar</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order, idx) => (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50 transition ${order.isPaid ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        {order.userName}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="space-y-1">
                          {order.items.map((it, itIdx) => (
                            <div key={itIdx} className="text-slate-700">
                              <span className="font-semibold">{it.quantity}x</span> {it.menuItemName}
                              {it.notes && (
                                <span className="text-[10px] text-amber-700 italic ml-1">({it.notes})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">{formatRupiah(order.subtotal)}</td>
                      <td className="py-3 px-3 text-right text-slate-600">+{formatRupiah(order.taxAmount)}</td>
                      <td className={`py-3 px-3 text-right ${order.roundingAmount < 0 ? 'text-emerald-700 font-semibold' : 'text-slate-600'}`}>
                        {order.roundingAmount > 0 ? `+${formatRupiah(order.roundingAmount)}` : formatRupiah(order.roundingAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-sm text-slate-900">
                        {formatRupiah(order.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(order.id, order.isPaid)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] transition ${
                            order.isPaid
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {order.isPaid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Lunas</span>
                            </>
                          ) : (
                            <>
                              <div className="w-3.5 h-3.5 rounded-full border border-slate-400" />
                              <span>Belum Bayar</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id, order.userName)}
                          className="text-slate-400 hover:text-red-600 p-1 transition"
                          title="Hapus pesanan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td colSpan={3} className="py-3 px-4 text-right">TOTAL TAGIHAN:</td>
                    <td className="py-3 px-3 text-right text-xs">
                      {formatRupiah(orders.reduce((sum, o) => sum + o.subtotal, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-xs">
                      {formatRupiah(orders.reduce((sum, o) => sum + o.taxAmount, 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-xs">
                      {formatRupiah(orders.reduce((sum, o) => sum + o.roundingAmount, 0))}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-emerald-600">
                      {formatRupiah(totalCollectedBills)}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center text-xs text-slate-600">
                      {paidOrdersCount} / {orders.length} Orang Lunas
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KELOLA MENU */}
      {activeTab === 'menu' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
          <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Kelola Menu Makanan & Minuman</h2>
              <p className="text-xs text-slate-500">
                Tambah, ubah nama/harga/kategori, atau hapus menu restoran untuk acara ini.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full shrink-0">
              Total: {event.menuItems.length} Menu
            </span>
          </div>

          {/* Form Add or Edit Menu Item */}
          <form
            id="menu-item-form"
            onSubmit={handleSaveMenuItem}
            className={`p-4 rounded-xl border transition space-y-3 ${
              editingItemId
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-300/50'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                {editingItemId ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-900">Edit Menu</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-orange-600" />
                    <span>Tambah Menu Baru</span>
                  </>
                )}
              </span>

              {editingItemId && (
                <button
                  type="button"
                  onClick={handleCancelEditMenuItem}
                  className="text-xs text-slate-500 hover:text-slate-700 underline font-medium"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Menu</label>
                <input
                  type="text"
                  placeholder="Contoh: Soto Ayam Campur"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  placeholder="Contoh: 15000"
                  value={newMenuPrice}
                  onChange={(e) => setNewMenuPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kategori</label>
                <select
                  value={newMenuCategory}
                  onChange={(e) => setNewMenuCategory(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Cemilan">Cemilan</option>
                  <option value="Paket">Paket</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="sm:col-span-2 flex items-end gap-1.5">
                <button
                  type="submit"
                  disabled={!newMenuName.trim() || !newMenuPrice}
                  className={`w-full py-2 px-3 rounded-lg disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs ${
                    editingItemId
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }`}
                >
                  {editingItemId ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Simpan
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Tambah
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Existing Menu Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Daftar Menu ({event.menuItems.length}):
              </span>
              <p className="text-[11px] text-slate-400">
                Klik ikon pensil ✏️ untuk mengedit atau tempat sampah 🗑️ untuk menghapus menu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {event.menuItems.map((item) => {
                const isItemBeingEdited = editingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between text-xs ${
                      isItemBeingEdited
                        ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-400'
                        : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="pr-2 overflow-hidden">
                      <span className="font-bold text-slate-900 block truncate text-sm">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-medium">
                          {item.category || 'Makanan'}
                        </span>
                        <span className="font-extrabold text-orange-600">
                          {formatRupiah(item.price)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditMenuItem(item)}
                        className={`p-1.5 rounded-lg border transition ${
                          isItemBeingEdited
                            ? 'bg-amber-200 border-amber-400 text-amber-900'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-orange-600'
                        }`}
                        title="Edit nama atau harga menu ini"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMenuItem(item.id, item.name)}
                        className="p-1.5 rounded-lg border bg-white hover:bg-red-50 border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-600 transition"
                        title="Hapus menu ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
