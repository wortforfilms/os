import type { Assessment, LearningPath } from "./types";

const learningPaths: LearningPath[] = [
  { id: "lp-script", title: "Script Foundations", focus: "Brahmi, Kharosthi, Siddham", lessons: 18 },
  { id: "lp-recitation", title: "Recitation Practice", focus: "meter, breath, memory", lessons: 12 },
  { id: "lp-meaning", title: "Meaning Layers", focus: "translation and commentary", lessons: 9 },
];

const assessments: Assessment[] = [
  { id: "as-glyph", skill: "glyph recognition", mode: "translation", threshold: 85 },
  { id: "as-meter", skill: "meter stability", mode: "recitation", threshold: 80 },
  { id: "as-sadhana", skill: "practice continuity", mode: "practice", threshold: 90 },
];

export function PedagogyApp() {
  return (
    <main className="pedagogy-app">
      <h1>Pedagogy</h1>
      <section>
        <h2>Learning Paths</h2>
        <ul>
          {learningPaths.map((path) => (
            <li key={path.id}>
              <strong>{path.title}</strong>
              <span>{path.focus}</span>
              <em>{path.lessons} lessons</em>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Assessments</h2>
        <ul>
          {assessments.map((assessment) => (
            <li key={assessment.id}>
              <strong>{assessment.skill}</strong>
              <span>{assessment.mode}</span>
              <em>{assessment.threshold}% threshold</em>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export * from "./types";
