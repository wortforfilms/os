import type { ScheduleItem } from "../types";

const defaultItems: ScheduleItem[] = [
  { day: "D01", unit: "main", location: "studio floor", dependency: "art handoff", risk: "low" },
  { day: "D02", unit: "second", location: "exterior lane", dependency: "traffic lock", risk: "medium" },
  { day: "D03", unit: "main", location: "temple set", dependency: "costume continuity", risk: "low" },
];

export function ScheduleBoard({ items = defaultItems }: { items?: ScheduleItem[] }) {
  return (
    <section className="schedule-board">
      <h2>ScheduleBoard</h2>
      <ol>
        {items.map((item) => (
          <li data-risk={item.risk} key={`${item.day}-${item.unit}`}>
            <strong>{item.day}</strong>
            <span>{item.unit}</span>
            <span>{item.location}</span>
            <em>{item.dependency}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}
