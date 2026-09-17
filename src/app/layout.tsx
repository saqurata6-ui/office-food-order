import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "MakanKantor - Web Pesanan Makan Kantor & Split Bill Otomatis",
  description: "Aplikasi koordinasi makan kantor: input menu manual/OCR AI gambar & PDF, share link pesanan, lock order, dan rekap split-bill otomatis.",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full light" style={{ colorScheme: 'light' }}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-orange-500 selection:text-white">
        <Navbar />
        <main className="flex-1 pb-16">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MakanKantor • Dibuat untuk memudahkan koordinasi makan-makan kantor.</p>
        </footer>
      </body>
    </html>
  );
}
