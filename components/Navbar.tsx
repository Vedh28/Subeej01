interface NavbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export default function Navbar({ title = "Subeej Dashboard", onMenuClick }: NavbarProps) {
  return (
    <div className="px-6 pt-6">
      <div className="flex items-center justify-between px-6 py-4 bg-white/80 border border-seed-green/10 rounded-3xl shadow-card sticky top-6 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden h-10 w-10 rounded-full bg-seed-green/10 text-seed-green flex items-center justify-center"
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="font-semibold text-seed-dark">{title}</div>
        </div>
        <div className="flex items-center gap-3">
        <div className="text-xs text-seed-dark/60">Demo User</div>
          <div className="h-10 w-10 rounded-full bg-seed-green/20 border border-seed-green/30 flex items-center justify-center text-seed-green font-semibold">
            D
          </div>
        </div>
      </div>
    </div>
  );
}
