import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'ระบบลงเวลาเข้างานร้านผมขอทอด - PKT Staff Clock-In',
  description: 'ระบบ Clock In / Clock Out ผ่าน LINE + Geofence GPS + โบนัสยอดขาย + เบี้ยขยัน ร้านผมขอทอด',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-100 text-slate-900 font-sans p-2 md:p-6 flex flex-col items-center">
        {/* Main Light Mode Dashboard Container */}
        <div className="w-full max-w-6xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[90vh]">
          {/* Light Header */}
          <header className="bg-slate-900 text-white px-4 md:px-6 py-3.5 flex justify-between items-center sticky top-0 z-50 shadow-md">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 relative flex-shrink-0 bg-white rounded-xl p-1 shadow border border-amber-500/40 group-hover:scale-105 transition-transform duration-300">
                {/* eslint-disable-next-html-extension/no-img-element */}
                <img
                  src="/logo.png"
                  alt="ร้านผมขอทอด Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg md:text-xl tracking-tight text-white group-hover:text-red-400 transition-colors">
                    ร้านผมขอทอด
                  </span>
                  <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase shadow">
                    4 สาขา
                  </span>
                </div>
                <p className="text-[10px] text-amber-400 font-bold tracking-wide">
                  "ที่มันอร่อยเกินไป" • Staff Clock-In & Incentive System
                </p>
              </div>
            </Link>

            <nav className="flex gap-2">
              <Link
                href="/"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs md:text-sm font-bold text-slate-100 hover:text-white transition-all duration-300 flex items-center gap-1.5 shadow"
              >
                <span>📱 เข้างาน (Staff)</span>
              </Link>
              <Link
                href="/admin"
                className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs md:text-sm transition-all duration-300 flex items-center gap-1.5 shadow-lg shadow-red-950/40"
              >
                <span>⚙️ ผู้จัดการ (Admin)</span>
              </Link>
            </nav>
          </header>

          {/* Main Body */}
          <main className="flex-1 p-4 md:p-6 space-y-6 bg-slate-50/60">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-3.5 text-center text-xs">
            <p>© 2026 ร้านผมขอทอด "ที่มันอร่อยเกินไป" • Multi-Branch Staff Incentive Platform</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
