// QUIZ ENGINE
export const LEVELS = [
  { id: "beginner", label: "Beginner", requirement: 0 },
  { id: "intermediate", label: "Intermediate", requirement: 3 },
  { id: "master", label: "Master", requirement: 6 },
];

export function normalizeLevels(data, fallbackSubject = "the title") {
  if (!data?.levels?.length) {
    return buildFallback(fallbackSubject);
  }

  const map = new Map();
  data.levels.forEach((lvl) => {
    const id = lvl.id?.toLowerCase();
    if (!LEVELS.some((l) => l.id === id)) return;
    const questions = (lvl.questions || []).slice(0, 3).map(normalizeQuestion);
    if (questions.length === 3) {
      map.set(id, questions);
    }
  });

  if (map.size !== LEVELS.length) {
    return buildFallback(fallbackSubject);
  }

  return Object.fromEntries(map);
}

function normalizeQuestion(q) {
  return {
    question: q.question?.trim() || "Question missing",
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
    answer: q.answer || q.options?.[0] || "Option A",
  };
}

function buildFallback(subject) {
  const template = [
    {
      question: `Which aspect best defines ${subject}?`,
      options: ["Iconic characters", "Groundbreaking visuals", "Soundtrack", "Humor"],
      answer: "Iconic characters",
    },
    {
      question: `In what era is ${subject} mainly set?`,
      options: ["Past", "Present", "Near Future", "Distant Future"],
      answer: "Past",
    },
    {
      question: `What emotion captures ${subject}?`,
      options: ["Hope", "Mystery", "Chaos", "Romance"],
      answer: "Mystery",
    },
  ];

  return LEVELS.reduce((acc, lvl, index) => {
    acc[lvl.id] = template.map((t, i) => ({ ...t, question: `${t.question} (Q${i + 1 + index * 3})` }));
    return acc;
  }, {});
}

export function createQuizState(questionMap) {
  return {
    questionMap,
    currentLevelIndex: 0,
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: LEVELS.length * 3,
    answers: [],
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
