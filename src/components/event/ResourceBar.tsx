// ResourceBar.tsx — lucide-react icons version with optional budget pill
import { Hourglass, Coins } from "lucide-react";

type Props = {
  daysLeft: number;
  budget: number;
  showBudget?: boolean; // ← NEW: defaults to true
};

export default function ResourceBar({ daysLeft, budget, showBudget = true }: Props) {
  return (
    <div className="w-full flex items-center justify-between gap-3">
      <ResourcePill
        icon={<Hourglass className="w-4 h-4" />}
        label="Days Left"
        value={String(daysLeft)}
        iconBgClass="bg-sky-500/20"
        iconTextClass="text-sky-200"
      />
      {showBudget && (
        <ResourcePill
          icon={<Coins className="w-4 h-4" />}
          label="Budget"
          value={formatMoney(budget)}
          iconBgClass="bg-amber-500/25"
          iconTextClass="text-amber-200"
        />
      )}
    </div>
  );
}

function ResourcePill({
  icon,
  label,
  value,
  iconBgClass = "bg-white/10",
  iconTextClass = "text-white/90",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBgClass?: string;
  iconTextClass?: string;
}) {
  return (
    <div
      className={[
        "flex-1 min-w-0",
        "px-3 py-2 rounded-2xl",
        "bg-white/10 border border-white/15 shadow-sm",
        "backdrop-blur-sm",
        "text-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "inline-flex items-center justify-center shrink-0 rounded-lg p-1",
            iconBgClass,
            iconTextClass,
          ].join(" ")}
        >
          {icon}
        </span>
        <div className="truncate">
          <div className="text-[11px] leading-none text-white/80">{label}</div>
          <div className="text-base font-semibold leading-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}
