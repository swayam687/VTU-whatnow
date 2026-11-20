import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#08090a] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 font-mono text-sm font-bold mb-4">
        404
      </div>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">Page Not Found</h1>
      <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
        The requested results view or resource could not be found or has moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl text-xs font-medium bg-white text-slate-950 hover:bg-slate-100 transition-colors shadow-sm"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
