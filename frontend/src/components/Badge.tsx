import type { Tone } from "../types";

interface BadgeProps {
  label: string;
  tone: Tone;
  dot?: boolean;
}

export function Badge({ label, tone, dot = true }: BadgeProps) {
  return (
    <span className={`badge tone-${tone}`}>
      {dot && <span className="badge-dot" />}
      {label}
    </span>
  );
}
