import Link from "next/link";
import { useRouter } from "next/router";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Field Intelligence", href: "/field-intelligence" },
  { label: "Seed Intelligence", href: "/seed-intelligence" },
  { label: "Chat", href: "/chat" }
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const router = useRouter();
  const isActive = (label: string, href: string) => {
    if (href === "/chat") return router.pathname === "/chat";
    if (href === "/field-intelligence") return router.pathname === "/field-intelligence";
    if (href === "/seed-intelligence") return router.pathname === "/seed-intelligence";
    if (href === "/dashboard" && label === "Dashboard") return router.pathname === "/dashboard";
    return false;
  };

  const renderNav = (isMobile?: boolean) => (
    <nav className="flex flex-col gap-2 text-sm">
      {navItems.map((item) => {
        const active = isActive(item.label, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={isMobile ? onClose : undefined}
            className={`px-3 py-2 rounded-xl transition ${
              active
                ? "bg-seed-green/15 text-seed-green font-semibold"
                : "text-seed-dark/80 hover:text-seed-green hover:bg-seed-green/10"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const renderLogout = (isMobile?: boolean) => (
    <button
      onClick={() => {
        if (isMobile) onClose?.();
        router.push("/");
      }}
      className="w-full rounded-xl border border-seed-green/20 px-3 py-2 text-sm text-seed-dark/70 hover:bg-seed-green/10 hover:text-seed-green transition"
    >
      Logout
    </button>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white/80 border border-seed-green/10 p-6 gap-8 rounded-3xl shadow-card lg:ml-6 lg:my-6 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <div className="text-lg font-semibold text-seed-green">Subeej</div>
        {renderNav()}
        <div className="mt-auto flex flex-col gap-3">
          {renderLogout()}
          <div className="text-xs text-seed-dark/60 text-center">Powered by Subeej AI</div>
        </div>
      </aside>

      <div className={`lg:hidden fixed inset-0 z-40 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <button
          onClick={onClose}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          aria-label="Close menu"
        />
        <aside
          className={`absolute left-4 top-4 bottom-4 w-72 bg-white/95 border border-seed-green/10 p-6 gap-8 rounded-3xl shadow-card flex flex-col transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-[120%]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-seed-green">Subeej</div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-seed-green/10 text-seed-green flex items-center justify-center"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          {renderNav(true)}
          <div className="mt-auto flex flex-col gap-3">
            {renderLogout(true)}
            <div className="text-xs text-seed-dark/60 text-center">Powered by Subeej AI</div>
          </div>
        </aside>
      </div>
    </>
  );
}
