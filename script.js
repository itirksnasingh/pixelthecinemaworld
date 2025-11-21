import { searchTitles, fetchById } from "tmdb.js";
import { searchGames, fetchGameById } from "rawg.js";
import { searchMusic, fetchRecordingById, fetchArtistById } from "music.js";
import { fetchQuizQuestions } from "routerAI.js";
import { normalizeLevels, createQuizState, getCurrentLevel, recordAnswer, LEVELS } from "questions.js";
import { determineBadge, saveBadge, getSavedBadges } from "badges.js";

const ui = {
  home: document.getElementById("homeScreen"),
  game: document.getElementById("gameScreen"),
  result: document.getElementById("resultScreen"),
  titleInput: document.getElementById("titleInput"),
  startBtn: document.getElementById("startBtn"),
  nextBtn: document.getElementById("nextBtn"),
  retryBtn: document.getElementById("retryBtn"),
  saveBadgeBtn: document.getElementById("saveBadgeBtn"),
  poster: document.getElementById("poster"),
  title: document.getElementById("title"),
  genre: document.getElementById("genre"),
  year: document.getElementById("year"),
  overview: document.getElementById("overview"),
  options: document.getElementById("options"),
  questionText: document.getElementById("questionText"),
  scoreDisplay: document.getElementById("scoreDisplay"),
  questionCounter: document.getElementById("questionCounter"),
  timer: document.getElementById("timer"),
  progressBar: document.getElementById("progressBar"),
  resultSummary: document.getElementById("resultSummary"),
  badgeDisplay: document.getElementById("badgeDisplay"),
  connectionStatus: document.getElementById("connectionStatus"),
  levelCards: document.querySelectorAll(".level-card"),
  searchResults: document.getElementById("searchResults"),
  classicModeBtn: document.getElementById("classicModeBtn"),
  emojiModeBtn: document.getElementById("emojiModeBtn"),
  rapidFireBtn: document.getElementById("rapidFireBtn"),
  quitBtn: document.getElementById("quitBtn"),
  emojiModePanel: document.getElementById("emojiModePanel"),
  emojiDisplay: document.getElementById("emojiDisplay"),
  emojiGuessInput: document.getElementById("emojiGuessInput"),
  emojiSubmitBtn: document.getElementById("emojiSubmitBtn"),
  emojiFeedback: document.getElementById("emojiFeedback"),
  rapidFirePanel: document.getElementById("rapidFirePanel"),
  rapidTimer: document.getElementById("rapidTimer"),
  rapidQuestionCounter: document.getElementById("rapidQuestionCounter"),
};

const QUESTION_TIME = 20; // seconds
let quizState = null;
let selectedContent = null;
let timerId = null;
let timerValue = QUESTION_TIME;
let pendingBadge = null;
let questionResolved = false;
let pendingResults = [];
let activeQuestion = null;
let pendingAdvanceTimeout = null;
const usedQuestionIds = new Set();
let currentLevel = 0;
let currentQuestionIndex = 0;
let currentMode = "classic"; // classic, emoji, rapid
let emojiModeData = null;
let rapidFireState = null;

function init() {
  ui.startBtn.addEventListener("click", handleStart);
  ui.nextBtn.addEventListener("click", handleNextRequest);
  ui.retryBtn.addEventListener("click", resetToHome);
  ui.saveBadgeBtn.addEventListener("click", handleSaveBadge);
  ui.badgeDisplay.innerHTML = buildSavedBadgesMarkup();
  
  // Mode selection
  ui.classicModeBtn.addEventListener("click", () => setMode("classic"));
  ui.emojiModeBtn.addEventListener("click", () => setMode("emoji"));
  ui.rapidFireBtn.addEventListener("click", () => setMode("rapid"));
  ui.quitBtn.addEventListener("click", quitQuiz);
  
  // Emoji mode
  ui.emojiSubmitBtn.addEventListener("click", checkEmojiAnswer);
  ui.emojiGuessInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkEmojiAnswer();
  });
}

function setMode(mode) {
  currentMode = mode;
  ui.classicModeBtn.classList.toggle("active", mode === "classic");
  ui.emojiModeBtn.classList.toggle("active", mode === "emoji");
  ui.rapidFireBtn.classList.toggle("active", mode === "rapid");
}

async function handleStart() {
  const query = ui.titleInput.value;
  toggleButton(ui.startBtn, true, "Scanning...");
  try {
    pendingResults = await gatherUniversalResults(query);
    if (!pendingResults.length) {
      throw new Error("No matches from TMDB, RAWG, or MusicBrainz.");
    }
    ui.connectionStatus.textContent = `Found ${pendingResults.length} universes`;
    ui.connectionStatus.style.background = "rgba(0, 245, 196, 0.2)";
    renderSearchResults(pendingResults);
  } catch (error) {
    console.error(error);
    alert(error.message || "Something went wrong");
    ui.connectionStatus.textContent = "Offline";
    ui.connectionStatus.style.background = "rgba(255, 79, 129, 0.2)";
  } finally {
    toggleButton(ui.startBtn, false, "Start");
  }
}

/* TMDB SEARCH */
/* RAWG GAME SEARCH */
/* MUSICBRAINZ SEARCH */
/* COMBINED RESULTS */
async function gatherUniversalResults(query) {
  if (!query?.trim()) {
    throw new Error("Please enter a title");
  }

  const [tmdbResults, gameResults, musicResults] = await Promise.all([
    safeSearch(() => searchTitles(query)),
    safeSearch(() => searchGames(query)),
    safeSearch(() => searchMusic(query)),
  ]);

  return [...tmdbResults, ...gameResults, ...musicResults];
}

async function safeSearch(fn) {
  try {
    const data = await fn();
    return data || [];
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function renderSearchResults(results) {
  ui.searchResults.innerHTML = "";
  if (!results.length) {
    ui.searchResults.innerHTML = "<p class=\"hint\">No matches yet – try another title.</p>";
    return;
  }

  results.forEach((item) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <img src="${item.poster}" alt="${item.title}" />
      <div class="result-info">
        <h4>${item.title}</h4>
        <small>${formatTypeLabel(item)} · ${item.year || "N/A"}</small>
      </div>
    `;
    card.addEventListener("click", () => handleResultSelection(item));
    ui.searchResults.appendChild(card);
  });
}

function formatTypeLabel(item) {
  if (!item?.mediaType) return "Unknown";
  const type = item.mediaType.toLowerCase();
  if (type === "tv") return "TV Series";
  if (type === "movie") return "Movie";
  if (type === "game") return "Video Game";
  if (type === "song") return "Song";
  if (type === "artist") return "Artist";
  return item.mediaType;
}

/* CONTENT SELECTION */
async function handleResultSelection(item) {
  toggleResultCards(true, item);
  try {
    selectedContent = await fetchContentDetails(item);
    updateMeta(selectedContent);
    ui.connectionStatus.textContent = "Content Synced";
    await prepareQuiz(selectedContent);
    clearSearchResults();
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not load that title");
  } finally {
    toggleResultCards(false);
  }
}

function toggleResultCards(loading, activeItem) {
  ui.searchResults.querySelectorAll(".result-card").forEach((card, index) => {
    card.style.opacity = loading ? "0.4" : "1";
    card.style.pointerEvents = loading ? "none" : "auto";
    const candidate = pendingResults[index];
    const isActive = loading && candidate?.id === activeItem?.id && candidate?.source === activeItem?.source;
    if (isActive) {
      card.style.borderColor = "rgba(0, 245, 196, 0.6)";
    } else if (!loading) {
      card.style.borderColor = "";
    }
  });
}

function clearSearchResults() {
  ui.searchResults.innerHTML = "";
  pendingResults = [];
}

async function fetchContentDetails(item) {
  if (item.source === "tmdb") {
    return fetchById(item.id, item.mediaType);
  }
  if (item.source === "rawg") {
    return fetchGameById(item.id);
  }
  if (item.source === "music") {
    return item.subType === "artist" ? fetchArtistById(item.id) : fetchRecordingById(item.id);
  }
  throw new Error("Unsupported content type");
}

async function prepareQuiz(metadata) {
  if (currentMode === "emoji") {
    startEmojiMode(metadata);
    return;
  }
  if (currentMode === "rapid") {
    startRapidFire(metadata);
    return;
  }

  // Classic mode
  let rawQuestions = null;
  try {
    rawQuestions = await fetchQuizQuestions(metadata);
    ui.connectionStatus.textContent = "Fully Synced";
  } catch (routerError) {
    console.warn(routerError);
    ui.connectionStatus.textContent = "Fallback Trivia";
  }

  const questionMap = normalizeLevels(rawQuestions, metadata.title);
  quizState = createQuizState(questionMap);
  usedQuestionIds.clear();
  currentLevel = 0;
  currentQuestionIndex = 0;
  quizState.currentLevelIndex = 0;
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  updateLevelLocks();
  enterGame();
}

function updateMeta(data) {
  ui.poster.src = data.poster;
  ui.poster.alt = data.title;
  ui.title.textContent = data.title;
  ui.genre.textContent = data.genre;
  ui.year.textContent = data.year;
  ui.overview.textContent = data.overview;
}

function enterGame() {
  ui.home.classList.add("hidden");
  ui.game.classList.remove("hidden");
  ui.result.classList.add("hidden");
  
  if (currentMode === "emoji") {
    ui.emojiModePanel.classList.remove("hidden");
    ui.questionPanel.classList.add("hidden");
    ui.rapidFirePanel.classList.add("hidden");
  } else if (currentMode === "rapid") {
    ui.rapidFirePanel.classList.remove("hidden");
    ui.questionPanel.classList.remove("hidden");
    ui.emojiModePanel.classList.add("hidden");
  } else {
    ui.emojiModePanel.classList.add("hidden");
    ui.rapidFirePanel.classList.add("hidden");
    ui.questionPanel.classList.remove("hidden");
    loadNextQuestion();
  }
}

function loadNextQuestion() {
  if (!quizState) return;
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  activeQuestion = null;
  const level = getCurrentLevel(quizState);
  const question = pullNextUniqueQuestion(level.id);

  if (!question) {
    const pool = quizState.questionMap[level.id] || [];
    if (pool.length === 0) {
      showMessage("No more questions in this level");
    } else {
      showMessage("No fresh questions available");
    }
    unlockNextLevel();
    return;
  }

  activeQuestion = question;
  usedQuestionIds.add(question.id);
  questionResolved = false;
  ui.nextBtn.disabled = true;
  ui.questionText.textContent = `${level.label}: ${question.question}`;
  ui.questionCounter.textContent = `${quizState.answers.length + 1} / ${quizState.totalQuestions}`;
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  ui.options.innerHTML = "";

  question.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = option;
    btn.addEventListener("click", () => handleAnswer(btn, option, question.answer));
    ui.options.appendChild(btn);
  });

  updateProgress();
  restartTimer();
}

function pullNextUniqueQuestion(levelId) {
  const questions = quizState.questionMap[levelId] || [];
  if (quizState.levelProgress[levelId] === undefined) {
    quizState.levelProgress[levelId] = 0;
  }

  while (quizState.levelProgress[levelId] < questions.length) {
    const candidate = questions[quizState.levelProgress[levelId]];
    quizState.levelProgress[levelId] += 1;
    if (!usedQuestionIds.has(candidate.id)) {
      return candidate;
    }
  }

  return null;
}

function handleAnswer(button, selected, correct) {
  if (questionResolved || !activeQuestion) return;
  const isCorrect = recordAnswer(quizState, selected, correct);
  Array.from(ui.options.children).forEach((child) => {
    child.disabled = true;
    if (child.textContent === correct) child.classList.add("correct");
    if (child !== button) return;
    child.classList.add(isCorrect ? "correct" : "wrong");
  });
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  questionResolved = true;
  stopTimer();

  currentQuestionIndex += 1;
  const levelComplete = currentQuestionIndex >= 3;

  if (levelComplete) {
    pendingAdvanceTimeout = setTimeout(unlockNextLevel, isCorrect ? 300 : 1000);
    return;
  }

  if (isCorrect) {
    ui.nextBtn.disabled = false;
  } else {
    showMessage("Incorrect");
    pendingAdvanceTimeout = setTimeout(loadNextQuestion, 1000);
  }
}

function handleNextRequest() {
  if (!quizState || !questionResolved) return;
  const levelComplete = currentQuestionIndex >= 3;
  if (levelComplete) {
    unlockNextLevel();
    return;
  }
  loadNextQuestion();
}

function updateLevelLocks() {
  ui.levelCards.forEach((card, index) => {
    if (index <= (quizState?.currentLevelIndex ?? 0)) {
      card.classList.remove("locked");
      card.querySelector(".lock").textContent = "Unlocked";
    } else {
      card.classList.add("locked");
      card.querySelector(".lock").textContent = "Locked";
    }
  });
}

function unlockNextLevel() {
  if (!quizState) return;
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  activeQuestion = null;
  currentLevel += 1;
  quizState.currentLevelIndex = currentLevel;
  currentQuestionIndex = 0;

  if (currentLevel >= LEVELS.length) {
    stopTimer();
    showResults();
    return;
  }

  updateLevelLocks();
  showMessage(`${LEVELS[currentLevel].label} unlocked`);
  loadNextQuestion();
}

function showResults() {
  pendingBadge = determineBadge(quizState.score, quizState.totalQuestions);
  ui.resultSummary.textContent = `You scored ${quizState.score} / ${quizState.totalQuestions}`;
  ui.badgeDisplay.innerHTML = renderBadgeToken(pendingBadge) + buildSavedBadgesMarkup();
  ui.game.classList.add("hidden");
  ui.result.classList.remove("hidden");
}

function renderBadgeToken(badge) {
  return `<div class="badge-token" style="border-color:${badge.color}; color:${badge.color}">
    <h3>${badge.label}</h3>
    <p>${badge.description}</p>
    <small>${badge.score} / ${badge.total}</small>
  </div>`;
}

function handleSaveBadge() {
  if (!pendingBadge) return;
  saveBadge(pendingBadge);
  ui.badgeDisplay.innerHTML = renderBadgeToken(pendingBadge) + buildSavedBadgesMarkup();
}

function buildSavedBadgesMarkup() {
  const badges = getSavedBadges();
  if (!badges.length) return "";
  return badges
    .map(
      (badge) =>
        `<div class="badge-token" style="border-color:${badge.color}; color:${badge.color}"><strong>${badge.label}</strong><p>${badge.score}/${badge.total}</p></div>`
    )
    .join("");
}

function resetToHome() {
  stopTimer();
  clearTimeout(pendingAdvanceTimeout);
  quizState = null;
  pendingBadge = null;
  activeQuestion = null;
  emojiModeData = null;
  rapidFireState = null;
  usedQuestionIds.clear();
  currentLevel = 0;
  currentQuestionIndex = 0;
  currentMode = "classic";
  ui.home.classList.remove("hidden");
  ui.game.classList.add("hidden");
  ui.result.classList.add("hidden");
  ui.options.innerHTML = "";
  ui.progressBar.style.width = "0%";
  ui.questionText.textContent = "Question will appear here";
  ui.emojiModePanel.classList.add("hidden");
  ui.rapidFirePanel.classList.add("hidden");
  ui.questionPanel.classList.remove("hidden");
  ui.nextBtn.style.display = "";
  clearSearchResults();
}

function toggleButton(button, disabled, label) {
  button.disabled = disabled;
  if (label) button.textContent = label;
}

function showMessage(message) {
  ui.connectionStatus.textContent = message;
}

function updateProgress() {
  const progress = (quizState.answers.length / quizState.totalQuestions) * 100;
  ui.progressBar.style.width = `${progress}%`;
}

function restartTimer() {
  stopTimer();
  timerValue = QUESTION_TIME;
  ui.timer.textContent = `${timerValue}s`;
  timerId = setInterval(() => {
    timerValue -= 1;
    ui.timer.textContent = `${timerValue}s`;
    if (timerValue <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function handleTimeout() {
  if (!quizState || questionResolved || !activeQuestion) return;
  recordAnswer(quizState, null, activeQuestion.answer);
  Array.from(ui.options.children).forEach((child) => {
    child.disabled = true;
    if (child.textContent === activeQuestion.answer) {
      child.classList.add("correct");
    }
  });
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  questionResolved = true;
  currentQuestionIndex += 1;
  const levelComplete = currentQuestionIndex >= 3;
  if (levelComplete) {
    pendingAdvanceTimeout = setTimeout(unlockNextLevel, 600);
  } else {
    pendingAdvanceTimeout = setTimeout(loadNextQuestion, 800);
  }
}

// EMOJI MODE
function startEmojiMode(data) {
  emojiModeData = {
    title: data.title,
    genre: data.genre || "",
    overview: data.overview || "",
    mediaType: data.mediaType || "",
    score: 0,
    questionIndex: 0,
  };
  
  if (!quizState) {
    quizState = { score: 0, answers: [] };
  }
  quizState.score = 0;
  
  ui.emojiModePanel.classList.remove("hidden");
  ui.questionPanel.classList.add("hidden");
  ui.options.innerHTML = "";
  ui.nextBtn.style.display = "none";
  
  enterGame();
  generateEmojiHints(emojiModeData);
}

function generateEmojiHints(data) {
  const emojiMap = {
    movie: "🎬",
    tv: "📺",
    game: "🎮",
    song: "🎵",
    artist: "🎤",
    action: "💥",
    comedy: "😂",
    drama: "🎭",
    horror: "👻",
    sci: "🚀",
    fantasy: "✨",
    romance: "💕",
    thriller: "🔪",
    adventure: "🗺️",
    mystery: "🔍",
    space: "🌌",
    war: "⚔️",
    family: "👨‍👩‍👧‍👦",
    crime: "🕵️",
    superhero: "🦸",
    zombie: "🧟",
    robot: "🤖",
    alien: "👽",
    magic: "🪄",
    sword: "⚔️",
    gun: "🔫",
    car: "🚗",
    plane: "✈️",
    ship: "🚢",
    train: "🚂",
    city: "🏙️",
    forest: "🌲",
    ocean: "🌊",
    mountain: "⛰️",
    desert: "🏜️",
    love: "❤️",
    heart: "💖",
    star: "⭐",
    moon: "🌙",
    sun: "☀️",
    fire: "🔥",
    water: "💧",
    earth: "🌍",
    time: "⏰",
    clock: "🕐",
    money: "💰",
    crown: "👑",
    trophy: "🏆",
    medal: "🏅",
    flag: "🚩",
    key: "🗝️",
    lock: "🔒",
    door: "🚪",
    window: "🪟",
    house: "🏠",
    castle: "🏰",
    bridge: "🌉",
    tower: "🗼",
  };
  
  const hints = [];
  const titleLower = data.title.toLowerCase();
  const genreLower = (data.genre || "").toLowerCase();
  const overviewLower = (data.overview || "").toLowerCase();
  
  // Media type emoji
  if (data.mediaType) {
    hints.push(emojiMap[data.mediaType] || "📀");
  }
  
  // Genre emojis
  Object.keys(emojiMap).forEach((key) => {
    if (genreLower.includes(key) || overviewLower.includes(key)) {
      hints.push(emojiMap[key]);
    }
  });
  
  // Title keywords
  const titleWords = titleLower.split(/\s+/);
  titleWords.forEach((word) => {
    if (word.length > 3 && emojiMap[word]) {
      hints.push(emojiMap[word]);
    }
  });
  
  // Overview keywords
  const overviewWords = overviewLower.split(/\s+/).slice(0, 10);
  overviewWords.forEach((word) => {
    if (word.length > 4 && emojiMap[word]) {
      hints.push(emojiMap[word]);
    }
  });
  
  // Ensure we have at least 5 emojis
  while (hints.length < 5) {
    hints.push("❓");
  }
  
  ui.emojiDisplay.textContent = hints.slice(0, 8).join(" ");
  ui.emojiGuessInput.value = "";
  ui.emojiFeedback.textContent = "";
  ui.emojiGuessInput.focus();
}

function checkEmojiAnswer() {
  if (!emojiModeData) return;
  
  const guess = ui.emojiGuessInput.value.trim().toLowerCase();
  const correct = emojiModeData.title.toLowerCase();
  
  if (guess === correct || guess.includes(correct) || correct.includes(guess)) {
    emojiModeData.score += 20;
    quizState.score = emojiModeData.score;
    ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
    ui.emojiFeedback.textContent = "✅ Correct! +20 points";
    ui.emojiFeedback.style.color = "var(--accent-2)";
    
    setTimeout(() => {
      emojiModeData.questionIndex += 1;
      if (emojiModeData.questionIndex >= 5) {
        showResults();
      } else {
        generateEmojiHints(emojiModeData);
      }
    }, 1500);
  } else {
    ui.emojiFeedback.textContent = `❌ Wrong! The answer was: ${emojiModeData.title}`;
    ui.emojiFeedback.style.color = "var(--danger)";
    
    setTimeout(() => {
      emojiModeData.questionIndex += 1;
      if (emojiModeData.questionIndex >= 5) {
        showResults();
      } else {
        generateEmojiHints(emojiModeData);
      }
    }, 2000);
  }
}

// RAPID FIRE
function startRapidFire(data) {
  rapidFireState = {
    questions: [],
    currentIndex: 0,
    score: 0,
    timeLeft: 30,
    answered: false,
  };
  
  if (!quizState) {
    quizState = { score: 0, answers: [] };
  }
  quizState.score = 0;
  
  enterGame();
  
  // Generate 5 questions
  Promise.resolve().then(async () => {
    try {
      const rawQuestions = await fetchQuizQuestions(data);
      const questionMap = normalizeLevels(rawQuestions, data.title);
      const allQuestions = [];
      Object.values(questionMap).forEach((levelQs) => {
        allQuestions.push(...levelQs);
      });
      rapidFireState.questions = allQuestions.slice(0, 5);
    } catch (e) {
      // Fallback questions
      rapidFireState.questions = Array(5).fill(null).map((_, i) => ({
        id: `rapid-${i}`,
        question: `Rapid Question ${i + 1} about ${data.title}?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option A",
      }));
    }
    
    loadRapidQuestion();
  });
}

function loadRapidQuestion() {
  if (!rapidFireState || rapidFireState.currentIndex >= rapidFireState.questions.length) {
    showResults();
    return;
  }
  
  const question = rapidFireState.questions[rapidFireState.currentIndex];
  ui.questionText.textContent = question.question;
  ui.rapidQuestionCounter.textContent = `Question ${rapidFireState.currentIndex + 1} / 5`;
  ui.options.innerHTML = "";
  
  question.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = option;
    btn.addEventListener("click", () => submitRapidAnswer(btn, option, question.answer));
    ui.options.appendChild(btn);
  });
  
  rapidFireState.timeLeft = 30;
  startRapidTimer();
}

function submitRapidAnswer(button, selected, correct) {
  if (rapidFireState.answered) return;
  rapidFireState.answered = true;
  
  const isCorrect = selected === correct;
  if (isCorrect) {
    rapidFireState.score += 5;
    quizState.score = rapidFireState.score;
    button.classList.add("correct");
  } else {
    button.classList.add("wrong");
    Array.from(ui.options.children).forEach((child) => {
      if (child.textContent === correct) child.classList.add("correct");
    });
  }
  
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  stopTimer();
  
  setTimeout(() => {
    rapidFireState.currentIndex += 1;
    rapidFireState.answered = false;
    loadRapidQuestion();
  }, 1000);
}

function startRapidTimer() {
  stopTimer();
  ui.rapidTimer.textContent = `${rapidFireState.timeLeft}s`;
  timerId = setInterval(() => {
    rapidFireState.timeLeft -= 1;
    ui.rapidTimer.textContent = `${rapidFireState.timeLeft}s`;
    
    if (rapidFireState.timeLeft <= 0) {
      stopTimer();
      showResults();
    }
  }, 1000);
}

// QUIT BUTTON
function quitQuiz() {
  if (confirm("Are you sure you want to quit? Your progress will be lost.")) {
    stopTimer();
    clearTimeout(pendingAdvanceTimeout);
    quizState = null;
    pendingBadge = null;
    activeQuestion = null;
    emojiModeData = null;
    rapidFireState = null;
    usedQuestionIds.clear();
    currentLevel = 0;
    currentQuestionIndex = 0;
    currentMode = "classic";
    
    ui.emojiModePanel.classList.add("hidden");
    ui.rapidFirePanel.classList.add("hidden");
    ui.questionPanel.classList.remove("hidden");
    ui.nextBtn.style.display = "";
    
    resetToHome();
  }
}

init();
