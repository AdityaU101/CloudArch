import { Link, useLocation } from "wouter";
import { Server, Grid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background dark text-foreground">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Server className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">CloudArch</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/" className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", location === "/" ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
            <Plus className="h-4 w-4" />
            Generate New
          </Link>
          <Link href="/architectures" className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors", location.startsWith("/architectures") ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground")}>
            <Grid className="h-4 w-4" />
            Saved Architectures
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
