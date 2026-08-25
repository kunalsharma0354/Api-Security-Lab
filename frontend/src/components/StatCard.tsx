import { Icon } from "./icons";
import type { StatItem } from "../types";

export function StatCard({ stat }: { stat: StatItem }) {
  const toneClass =
    stat.tone === "default" ? "" : ` tone-${stat.tone}`;

  return (
    <div className="card stat-card">
      <div className="stat-top">
        <span className="stat-label">{stat.label}</span>
        <span className={`stat-icon${toneClass}`}>
          <Icon name={stat.icon} size={15} />
        </span>
      </div>
      <div className="stat-value">
        {stat.value}
        {stat.unit && <span className="stat-unit">{stat.unit}</span>}
      </div>
      <div className="stat-hint">{stat.hint}</div>
    </div>
  );
}
