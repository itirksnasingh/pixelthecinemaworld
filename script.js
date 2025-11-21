import { searchTitles, fetchById } from "./tmdb.js";
import { searchGames, fetchGameById } from "./rawg.js";
import { searchMusic, fetchRecordingById, fetchArtistById } from "./music.js";
import { fetchQuizQuestions } from "./routerAI.js";
import { normalizeLevels, createQuizState, getCurrentQuestion, getCurrentLevel, recordAnswer, advance } from "./questions.js";
import { determineBadge, saveBadge, getSavedBadges } from "./badges.js";

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
};

const QUESTION_TIME = 20; // seconds
let quizState = null;
let selectedContent = null;
let timerId = null;
let timerValue = QUESTION_TIME;
let pendingBadge = null;
let questionResolved = false;
let pendingResults = [];

function init() {
  ui.startBtn.addEventListener("click", handleStart);
  ui.nextBtn.addEventListener("click", nextStep);
  ui.retryBtn.addEventListener("click", resetToHome);
  ui.saveBadgeBtn.addEventListener("click", handleSaveBadge);
  ui.badgeDisplay.innerHTML = buildSavedBadgesMarkup();
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
  updateQuestionUI();
}

function updateQuestionUI() {
  if (!quizState) return;
  const currentLevel = getCurrentLevel(quizState);
  const currentQuestion = getCurrentQuestion(quizState);
  ui.questionText.textContent = `${currentLevel.label}: ${currentQuestion.question}`;
  ui.questionCounter.textContent = `${quizState.answers.length + 1} / ${quizState.totalQuestions}`;
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  ui.options.innerHTML = "";
  ui.nextBtn.disabled = true;
  questionResolved = false;

  currentQuestion.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = option;
    btn.addEventListener("click", () => handleAnswer(btn, option, currentQuestion.answer));
    ui.options.appendChild(btn);
  });

  updateProgress();
  restartTimer();
}

function handleAnswer(button, selected, correct) {
  if (questionResolved) return;
  const isCorrect = recordAnswer(quizState, selected, correct);
  Array.from(ui.options.children).forEach((child) => {
    child.disabled = true;
    if (child.textContent === correct) child.classList.add("correct");
    if (child !== button) return;
    child.classList.add(isCorrect ? "correct" : "wrong");
  });
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  ui.nextBtn.disabled = false;
  stopTimer();
  questionResolved = true;
}

function nextStep() {
  if (!quizState) return;
  const finished = advance(quizState);
  if (finished) {
    stopTimer();
    showResults();
  } else {
    updateLevelLocks();
    updateQuestionUI();
  }
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
  quizState = null;
  pendingBadge = null;
  ui.home.classList.remove("hidden");
  ui.game.classList.add("hidden");
  ui.result.classList.add("hidden");
  ui.options.innerHTML = "";
  ui.progressBar.style.width = "0%";
  ui.questionText.textContent = "Question will appear here";
  clearSearchResults();
}

function toggleButton(button, disabled, label) {
  button.disabled = disabled;
  if (label) button.textContent = label;
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
  if (!quizState || questionResolved) return;
  const currentQuestion = getCurrentQuestion(quizState);
  recordAnswer(quizState, null, currentQuestion.answer);
  Array.from(ui.options.children).forEach((child) => {
    child.disabled = true;
    if (child.textContent === currentQuestion.answer) {
      child.classList.add("correct");
    }
  });
  ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  ui.nextBtn.disabled = false;
  questionResolved = true;
}

init();
