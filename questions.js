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
const globalUsedQuestionIds = new Set();

export function markQuestionUsed(questionId) {
  if (questionId) globalUsedQuestionIds.add(questionId);
}

export function isQuestionUsed(questionId) {
  return questionId ? globalUsedQuestionIds.has(questionId) : false;
}

export function resetUsedQuestions() {
  globalUsedQuestionIds.clear();
}

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
  const questionId = q.id || `${difficulty}-${questionSeed++}-${Date.now()}`;
  return {
    id: questionId,
    question: q.question?.trim() || "Question missing",
    options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
    answer: q.answer || (Array.isArray(q.options) && q.options[0]) || "Option A",
    difficulty,
    genre: q.genre || "",
  };
}

function buildFallback(subject) {
  const easyQuestions = [
    { question: `Which aspect best defines ${subject}?`, options: ["Iconic characters", "Groundbreaking visuals", "Soundtrack", "Humor"], answer: "Iconic characters" },
    { question: `What genre category fits ${subject}?`, options: ["Action", "Comedy", "Drama", "Thriller"], answer: "Action" },
    { question: `What makes ${subject} memorable?`, options: ["Plot twists", "Visual effects", "Character development", "Music"], answer: "Character development" },
  ];
  
  const mediumQuestions = [
    { question: `In what era is ${subject} mainly set?`, options: ["Past", "Present", "Near Future", "Distant Future"], answer: "Past" },
    { question: `What theme drives ${subject}?`, options: ["Redemption", "Discovery", "Conflict", "Transformation"], answer: "Conflict" },
    { question: `What element is central to ${subject}?`, options: ["Technology", "Nature", "Society", "Individual"], answer: "Individual" },
  ];
  
  const hardQuestions = [
    { question: `What emotion captures ${subject}?`, options: ["Hope", "Mystery", "Chaos", "Romance"], answer: "Mystery" },
    { question: `What philosophical question does ${subject} explore?`, options: ["Identity", "Morality", "Existence", "Purpose"], answer: "Identity" },
    { question: `What hidden meaning does ${subject} convey?`, options: ["Social commentary", "Personal growth", "Historical reflection", "Future warning"], answer: "Social commentary" },
  ];

  const buckets = {
    beginner: easyQuestions.map((q, i) => normalizeQuestion({ ...q, id: `fallback-easy-${i}` }, "easy")),
    intermediate: mediumQuestions.map((q, i) => normalizeQuestion({ ...q, id: `fallback-medium-${i}` }, "medium")),
    master: hardQuestions.map((q, i) => normalizeQuestion({ ...q, id: `fallback-hard-${i}` }, "hard")),
  };

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
