export type TimelineEvent = {
  at: string;
  title: string;
  detail: string;
};

const defaultEvents: TimelineEvent[] = [
  { at: "boot", title: "Kernel ready", detail: "QEMU alpha runtime initialized." },
  { at: "tick 3", title: "Drivers sampled", detail: "Virtual GPIO and power rails sampled." },
];

export function TimelineView({ events = defaultEvents }: { events?: TimelineEvent[] }) {
  return (
    <section className="timeline-view">
      <h2>TimelineView</h2>
      <ol>
        {events.map((event) => (
          <li key={`${event.at}-${event.title}`}>
            <time>{event.at}</time>
            <strong>{event.title}</strong>
            <p>{event.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
