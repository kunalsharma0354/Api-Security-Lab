import { Icon } from "../components/icons";
import { Badge } from "../components/Badge";

interface PlaceholderPageProps {
  icon: "analytics" | "info";
  title: string;
  kicker: string;
  description: string;
}

export function AnalyticsPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-kicker">Monitoring</div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-desc">
            Aggregated traffic charts, latency distribution and protection hit
            rates will appear here.
          </p>
        </div>
      </div>

      <PlaceholderBlock
        icon="analytics"
        title="Analytics arrive with real data"
        description="This view populates automatically once the backend records request metrics in Part 2. No synthetic data is shown before then."
      />
    </>
  );
}

function PlaceholderBlock({
  icon,
  title,
  description,
}: Omit<PlaceholderPageProps, "kicker">) {
  return (
    <section className="card placeholder-card" aria-label={`${title} placeholder`}>
      <span className="placeholder-icon">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="placeholder-title">{title}</h2>
      <p className="placeholder-text">{description}</p>
      <div className="placeholder-steps">
        <Badge label="Part 2 · Backend" tone="warning" dot={false} />
        <Badge label="No fake data" tone="off" dot={false} />
      </div>
    </section>
  );
}
