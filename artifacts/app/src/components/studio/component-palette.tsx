import { useMemo, useState } from "react";
import { resolveCatalog, CATEGORIES, type CategoryId } from "@/lib/cloud-catalog";
import { useStudioProvider } from "./provider-context";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ComponentPaletteProps {
  /** Fired when a palette item is clicked (adds to canvas center). */
  onAdd: (type: string) => void;
}

const CATEGORY_ORDER: CategoryId[] = ["compute", "network", "database", "storage", "security", "integration"];

/**
 * The left rail of draggable/clickable building blocks. Drag onto the canvas to
 * place, or click to drop one at the center — both add the same component.
 */
export function ComponentPalette({ onAdd }: ComponentPaletteProps) {
  const [query, setQuery] = useState("");
  const provider = useStudioProvider();

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const catalog = resolveCatalog(provider);
    return CATEGORY_ORDER.map((catId) => ({
      cat: CATEGORIES[catId],
      items: catalog.filter(
        (c) => c.category === catId && (!q || c.label.toLowerCase().includes(q) || c.blurb.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query, provider]);

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components"
            className="h-8 border-0 bg-muted/60 pl-8 text-xs focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {grouped.map(({ cat, items }) => (
          <div key={cat.id}>
            <div className="mb-1.5 flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${cat.hue})` }} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/cloudarch-node", item.type);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => onAdd(item.type)}
                    title={item.blurb}
                    className="hover-elevate flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors active:cursor-grabbing"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ background: `hsl(${cat.hue} / 0.14)`, color: `hsl(${cat.hue})` }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">{item.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.monthly > 0 ? `$${item.monthly}/mo` : "usage-based"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
