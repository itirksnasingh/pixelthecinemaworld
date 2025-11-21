// QUIZ ENGINE
export const LEVELS = [
  { id: "beginner", label: "Beginner", requirement: 0, difficulty: "easy" },
  { id: "intermediate", label: "Intermediate", requirement: 3, difficulty: "medium" },
  { id: "master", label: "Master", requirement: 6, difficulty: "hard" },
];

const DIFFICULTY_PIPELINE = {
  beginner: "easy",
  easy: "easy",
  intermediate: "medium",
  medium: "medium",
  master: "hard",
  hard: "hard",
};

let questionSeed = 0;

export function normalizeLevels(data, fallbackSubject = "the title") {
  if (!data?.levels?.length) {
    return buildFallback(fallbackSubject);
  }

  const buckets = {
    easy: [],
    medium: [],
    hard: [],
  };

  data.levels.forEach((lvl) => {
    const assumedDifficulty = DIFFICULTY_PIPELINE[lvl.id?.toLowerCase()] || "easy";
    (lvl.questions || []).forEach((question) => {
      const normalized = normalizeQuestion(question, assumedDifficulty);
      buckets[normalized.difficulty].push(normalized);
    });
  });

  if (buckets.easy.length < 3 || buckets.medium.length < 3 || buckets.hard.length < 3) {
    return buildFallback(fallbackSubject);
  }

  return {
    beginner: buckets.easy.slice(0, 3),
    intermediate: buckets.medium.slice(0, 3),
    master: buckets.hard.slice(0, 3),
  };
}

function normalizeQuestion(q, fallbackDifficulty = "easy") {
  const difficulty = DIFFICULTY_PIPELINE[q.difficulty?.toLowerCase()] || fallbackDifficulty;
  return {
    id: q.id || `${difficulty}-${questionSeed++}`,
    question: q.question?.trim() || "Question missing",
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
    answer: q.answer || q.options?.[0] || "Option A",
    difficulty,
    genre: q.genre || "",
  };
}

function buildFallback(subject) {
  const template = [
    {
      difficulty: "easy",
      question: `Which aspect best defines ${subject}?`,
      options: ["Iconic characters", "Groundbreaking visuals", "Soundtrack", "Humor"],
      answer: "Iconic characters",
    },
    {
      difficulty: "medium",
      question: `In what era is ${subject} mainly set?`,
      options: ["Past", "Present", "Near Future", "Distant Future"],
      answer: "Past",
    },
    {
      difficulty: "hard",
      question: `What emotion captures ${subject}?`,
      options: ["Hope", "Mystery", "Chaos", "Romance"],
      answer: "Mystery",
    },
  ];

  const buckets = {
    beginner: [],
    intermediate: [],
    master: [],
  };

  template.forEach((entry, idx) => {
    const normalized = normalizeQuestion({ ...entry, id: `fallback-${idx}` }, entry.difficulty);
    if (entry.difficulty === "easy") buckets.beginner.push(normalized);
    if (entry.difficulty === "medium") buckets.intermediate.push(normalized);
    if (entry.difficulty === "hard") buckets.master.push(normalized);
  });

  while (buckets.beginner.length < 3) {
    buckets.beginner.push({ ...buckets.beginner[0], id: `fallback-e-${buckets.beginner.length}` });
  }
  while (buckets.intermediate.length < 3) {
    buckets.intermediate.push({ ...buckets.intermediate[0], id: `fallback-m-${buckets.intermediate.length}` });
  }
  while (buckets.master.length < 3) {
    buckets.master.push({ ...buckets.master[0], id: `fallback-h-${buckets.master.length}` });
  }

  return buckets;
}

export function createQuizState(questionMap) {
  return {
    questionMap,
    currentLevelIndex: 0,
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: Object.values(questionMap).reduce((total, stack) => total + stack.length, 0),
    answers: [],
    levelProgress: Object.fromEntries(LEVELS.map((lvl) => [lvl.id, 0])),
  };
}

export function getCurrentLevel(state) {
  return LEVELS[state.currentLevelIndex];
}

export function getCurrentQuestion(state) {
  const level = getCurrentLevel(state);
  const questions = state.questionMap[level.id];
  return questions[state.currentQuestionIndex];
}

export function recordAnswer(state, selected, correct) {
  const isCorrect = selected === correct;
  if (isCorrect) state.score += 1;
  state.answers.push({ level: getCurrentLevel(state).id, selected, correct });
  return isCorrect;
}

export function advance(state) {
  state.currentQuestionIndex += 1;
  if (state.currentQuestionIndex >= 3) {
    state.currentQuestionIndex = 0;
    state.currentLevelIndex += 1;
  }
  return state.currentLevelIndex >= LEVELS.length;
}
