import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { specFor, CATEGORIES } from "@/lib/aws-catalog";

export interface ServiceNodeData extends Record<string, unknown> {
  type: string;
  label: string;
}

/**
 * A single cloud component on the canvas. Category drives a left accent bar and
 * the icon tint so families of services read at a glance. Handles on both sides
 * let the user wire dependencies.
 */
export const ServiceNode = memo(function ServiceNode({ data, selected }: NodeProps) {
  const d = data as ServiceNodeData;
  const spec = specFor(d.type);
  const cat = spec ? CATEGORIES[spec.category] : undefined;
  const hue = cat?.hue ?? "190 12% 60%";
  const Icon = spec?.icon;

  return (
    <div
      className="group relative flex w-[216px] items-center gap-3 overflow-hidden rounded-xl border bg-card/95 px-3.5 py-3 backdrop-blur-sm transition-shadow duration-200"
      style={{
        borderColor: selected ? `hsl(${hue})` : "hsl(var(--card-border))",
        boxShadow: selected
          ? `0 0 0 1px hsl(${hue}), 0 8px 28px -8px hsl(${hue} / 0.5)`
          : "0 1px 2px hsl(0 0% 0% / 0.3)",
      }}
    >
      {/* category accent bar */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${hue})` }} />

      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `hsl(${hue} / 0.14)`, color: `hsl(${hue})` }}
      >
        {Icon ? <Icon className="h-5 w-5" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight text-foreground">{d.label}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span style={{ color: `hsl(${hue})` }}>{cat?.label ?? "Service"}</span>
          {spec && spec.monthly > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="tabular-nums">${spec.monthly}/mo</span>
            </>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-background"
        style={{ background: `hsl(${hue})` }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-background"
        style={{ background: `hsl(${hue})` }}
      />
    </div>
  );
});
