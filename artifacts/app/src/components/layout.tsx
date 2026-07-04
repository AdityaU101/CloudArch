import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Server, LayoutGrid, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Generate", icon: Plus, match: (l: string) => l === "/" },
  { href: "/architectures", label: "Library", icon: LayoutGrid, match: (l: string) => l.startsWith("/architectures") },
];

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Plus; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
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
      <Icon className={cn("relative z-10 h-4 w-4", active && "text-primary")} />
      <span className="relative z-10 font-medium">{label}</span>
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="dark flex h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Server className="h-[18px] w-[18px]" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">CloudArch</div>
            <div className="text-[11px] text-muted-foreground">Architecture Studio</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Workspace</div>
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} active={item.match(location)} />
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-border bg-gradient-to-b from-primary/[0.07] to-transparent p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI Architect
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Describe your system in plain English and get a costed, editable AWS design.
          </p>
        </div>
      </aside>

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
