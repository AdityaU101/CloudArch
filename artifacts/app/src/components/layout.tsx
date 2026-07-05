import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Server, LayoutGrid, Plus, ShieldCheck, Sparkles, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Generate", icon: Plus, match: (l: string) => l === "/" },
  { href: "/validate", label: "Validate", icon: ShieldCheck, match: (l: string) => l === "/validate" },
  { href: "/architectures", label: "Library", icon: LayoutGrid, match: (l: string) => l.startsWith("/architectures") },
];

const STORAGE_KEY = "cloudarch:sidebar-collapsed";

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Plus;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors",
        collapsed ? "justify-center px-2" : "px-3",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-lg border border-primary/20 bg-primary/10"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <Icon className={cn("relative z-10 h-4 w-4 shrink-0", active && "text-primary")} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 overflow-hidden whitespace-nowrap font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="dark flex h-screen bg-background text-foreground">
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="flex shrink-0 flex-col overflow-hidden border-r border-border bg-card/40"
      >
        <div className={cn("flex items-center py-4", collapsed ? "justify-center px-2" : "gap-2.5 px-5")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Server className="h-[18px] w-[18px]" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap leading-tight"
              >
                <div className="text-sm font-semibold tracking-tight">CloudArch</div>
                <div className="text-[11px] text-muted-foreground">Architecture Studio</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {!collapsed && (
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Workspace
            </div>
          )}
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} active={item.match(location)} collapsed={collapsed} />
          ))}
        </nav>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="m-3 rounded-xl border border-border bg-gradient-to-b from-primary/[0.07] to-transparent p-3.5"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI Architect
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Describe your system in plain English and get a costed, editable AWS, Azure, or Google Cloud design.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hover-elevate m-3 mt-0 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </motion.aside>

      <main className="relative flex-1 overflow-auto bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
