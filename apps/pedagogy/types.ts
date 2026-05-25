export type LearningPath = {
  id: string;
  title: string;
  focus: string;
  lessons: number;
};

export type Assessment = {
  id: string;
  skill: string;
  mode: "recitation" | "translation" | "practice";
  threshold: number;
};
