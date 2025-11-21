import { searchTitles, fetchById } from "tmdb.js";
import { searchGames, fetchGameById } from "rawg.js";
import { searchMusic, fetchRecordingById, fetchArtistById } from "music.js";
import { fetchQuizQuestions } from "routerAI.js";
import { normalizeLevels, createQuizState, getCurrentLevel, recordAnswer, LEVELS, markQuestionUsed, isQuestionUsed, resetUsedQuestions } from "questions.js";
import { determineBadge, saveBadge, getSavedBadges } from "badges.js";
import { generateEmojiHints, checkEmojiAnswer, markEmojiTitleUsed, isEmojiTitleUsed, resetEmojiUsed } from "emoji.js";
import { prepareRapidQuestion, checkRapidAnswer, shuffleArray } from "rapidfire.js";

const ui = {};
let uiInitialized = false;

function safeGetElement(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`Element with id "${id}" not found`);
  }
  return el;
}

function safeQuerySelector(selector) {
  try {
    return document.querySelectorAll(selector);
  } catch (e) {
    console.warn(`Selector "${selector}" failed:`, e);
    return [];
  }
}

function safeClassList(el, method, ...args) {
  if (!el || !el.classList) {
    if (el) console.warn("Element missing classList:", el);
    return false;
  }
  try {
    el.classList[method](...args);
    return true;
  } catch (e) {
    console.warn("classList operation failed:", e);
    return false;
  }
}

function initUI() {
  if (uiInitialized) return;
  
  ui.home = safeGetElement("homeScreen");
  ui.game = safeGetElement("gameScreen");
  ui.result = safeGetElement("resultScreen");
  ui.titleInput = safeGetElement("titleInput");
  ui.startBtn = safeGetElement("startBtn");
  ui.nextBtn = safeGetElement("nextBtn");
  ui.retryBtn = safeGetElement("retryBtn");
  ui.saveBadgeBtn = safeGetElement("saveBadgeBtn");
  ui.poster = safeGetElement("poster");
  ui.title = safeGetElement("title");
  ui.genre = safeGetElement("genre");
  ui.year = safeGetElement("year");
  ui.overview = safeGetElement("overview");
  ui.options = safeGetElement("options");
  ui.questionText = safeGetElement("questionText");
  ui.scoreDisplay = safeGetElement("scoreDisplay");
  ui.questionCounter = safeGetElement("questionCounter");
  ui.timer = safeGetElement("timer");
  ui.progressBar = safeGetElement("progressBar");
  ui.resultSummary = safeGetElement("resultSummary");
  ui.badgeDisplay = safeGetElement("badgeDisplay");
  ui.connectionStatus = safeGetElement("connectionStatus");
  ui.levelCards = safeQuerySelector(".level-card");
  ui.searchResults = safeGetElement("searchResults");
  ui.classicModeBtn = safeGetElement("classicModeBtn");
  ui.emojiModeBtn = safeGetElement("emojiModeBtn");
  ui.rapidFireBtn = safeGetElement("rapidFireBtn");
  ui.quitBtn = safeGetElement("quitBtn");
  ui.emojiModePanel = safeGetElement("emojiModePanel");
  ui.emojiDisplay = safeGetElement("emojiDisplay");
  ui.emojiGuessInput = safeGetElement("emojiGuessInput");
  ui.emojiSubmitBtn = safeGetElement("emojiSubmitBtn");
  ui.emojiFeedback = safeGetElement("emojiFeedback");
  ui.rapidFirePanel = safeGetElement("rapidFirePanel");
  ui.rapidTimer = safeGetElement("rapidTimer");
  ui.rapidQuestionCounter = safeGetElement("rapidQuestionCounter");
  ui.questionPanel = safeQuerySelector(".question-panel")[0];
  
  uiInitialized = true;
}

const QUESTION_TIME = 20;
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
let currentMode = "classic";
let emojiModeData = null;
let rapidFireState = null;
let selectedItemId = null;
let emojiSubmitted = false;
let rapidAnswered = false;

function init() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
    return;
  }
  
  initUI();
  
  if (ui.startBtn) ui.startBtn.addEventListener("click", handleStart);
  if (ui.nextBtn) ui.nextBtn.addEventListener("click", handleNextRequest);
  if (ui.retryBtn) ui.retryBtn.addEventListener("click", resetToHome);
  if (ui.saveBadgeBtn) ui.saveBadgeBtn.addEventListener("click", handleSaveBadge);
  if (ui.badgeDisplay) ui.badgeDisplay.innerHTML = buildSavedBadgesMarkup();
  
  if (ui.classicModeBtn) ui.classicModeBtn.addEventListener("click", () => setMode("classic"));
  if (ui.emojiModeBtn) ui.emojiModeBtn.addEventListener("click", () => setMode("emoji"));
  if (ui.rapidFireBtn) ui.rapidFireBtn.addEventListener("click", () => setMode("rapid"));
  if (ui.quitBtn) ui.quitBtn.addEventListener("click", quitQuiz);
  
  if (ui.emojiSubmitBtn) ui.emojiSubmitBtn.addEventListener("click", handleEmojiSubmit);
  if (ui.emojiGuessInput) {
    ui.emojiGuessInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleEmojiSubmit();
    });
  }
}

function setMode(mode) {
  currentMode = mode;
  if (ui.classicModeBtn) safeClassList(ui.classicModeBtn, "toggle", "active", mode === "classic");
  if (ui.emojiModeBtn) safeClassList(ui.emojiModeBtn, "toggle", "active", mode === "emoji");
  if (ui.rapidFireBtn) safeClassList(ui.rapidFireBtn, "toggle", "active", mode === "rapid");
}

async function handleStart() {
  if (!ui.titleInput) return;
  const query = ui.titleInput.value;
  toggleButton(ui.startBtn, true, "Scanning...");
  try {
    pendingResults = await gatherUniversalResults(query);
    if (!pendingResults.length) {
      throw new Error("No matches from TMDB, RAWG, or MusicBrainz.");
    }
    if (ui.connectionStatus) {
      ui.connectionStatus.textContent = `Found ${pendingResults.length} universes`;
      if (ui.connectionStatus.style) ui.connectionStatus.style.background = "rgba(0, 245, 196, 0.2)";
    }
    renderSearchResults(pendingResults);
  } catch (error) {
    console.error(error);
    alert(error.message || "Something went wrong");
    if (ui.connectionStatus) {
      ui.connectionStatus.textContent = "Offline";
      if (ui.connectionStatus.style) ui.connectionStatus.style.background = "rgba(255, 79, 129, 0.2)";
    }
  } finally {
    toggleButton(ui.startBtn, false, "Start");
  }
}

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
  if (!ui.searchResults) return;
  ui.searchResults.innerHTML = "";
  if (!results.length) {
    ui.searchResults.innerHTML = "<p class=\"hint\">No matches yet – try another title.</p>";
    return;
  }

  results.forEach((item) => {
    const card = document.createElement("div");
    card.className = "result-card";
    const uniqueId = `${item.source}-${item.id}`;
    card.dataset.itemId = uniqueId;
    card.innerHTML = `
      <img src="${item.poster}" alt="${item.title}" />
      <div class="result-info">
        <h4>${item.title}</h4>
        <small>${formatTypeLabel(item)} · ${item.year || "N/A"}</small>
      </div>
    `;
    card.addEventListener("click", () => handleResultSelection(item, uniqueId));
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

async function handleResultSelection(item, uniqueId) {
  selectedItemId = uniqueId;
  toggleResultCards(true, uniqueId);
  try {
    selectedContent = await fetchContentDetails(item);
    if (selectedContent.title !== item.title) {
      console.warn("Title mismatch detected");
    }
    updateMeta(selectedContent);
    if (ui.connectionStatus) ui.connectionStatus.textContent = "Content Synced";
    await prepareQuiz(selectedContent);
    clearSearchResults();
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not load that title");
  } finally {
    toggleResultCards(false);
  }
}

function toggleResultCards(loading, activeId) {
  if (!ui.searchResults) return;
  ui.searchResults.querySelectorAll(".result-card").forEach((card) => {
    if (loading) {
      if (card.dataset.itemId === activeId) {
        if (card.style) card.style.borderColor = "rgba(0, 245, 196, 0.6)";
      } else {
        if (card.style) {
          card.style.opacity = "0.4";
          card.style.pointerEvents = "none";
        }
      }
    } else {
      if (card.style) {
        card.style.opacity = "1";
        card.style.pointerEvents = "auto";
        card.style.borderColor = "";
      }
    }
  });
}

function clearSearchResults() {
  if (ui.searchResults) ui.searchResults.innerHTML = "";
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

  let rawQuestions = null;
  try {
    rawQuestions = await fetchQuizQuestions(metadata);
    if (ui.connectionStatus) ui.connectionStatus.textContent = "Fully Synced";
  } catch (routerError) {
    console.warn(routerError);
    if (ui.connectionStatus) ui.connectionStatus.textContent = "Fallback Trivia";
  }

  const questionMap = normalizeLevels(rawQuestions, metadata.title);
  quizState = createQuizState(questionMap);
  usedQuestionIds.clear();
  resetUsedQuestions();
  resetEmojiUsed();
  currentLevel = 0;
  currentQuestionIndex = 0;
  quizState.currentLevelIndex = 0;
  quizState.levelProgress = Object.fromEntries(LEVELS.map((lvl) => [lvl.id, 0]));
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  updateLevelLocks();
  enterGame();
}

function updateMeta(data) {
  if (ui.poster) {
    ui.poster.src = data.poster;
    ui.poster.alt = data.title;
  }
  if (ui.title) ui.title.textContent = data.title;
  if (ui.genre) ui.genre.textContent = data.genre;
  if (ui.year) ui.year.textContent = data.year;
  if (ui.overview) ui.overview.textContent = data.overview;
}

function enterGame() {
  safeClassList(ui.home, "add", "hidden");
  safeClassList(ui.game, "remove", "hidden");
  safeClassList(ui.result, "add", "hidden");
  
  if (currentMode === "emoji") {
    safeClassList(ui.emojiModePanel, "remove", "hidden");
    if (ui.questionPanel) safeClassList(ui.questionPanel, "add", "hidden");
    safeClassList(ui.rapidFirePanel, "add", "hidden");
  } else if (currentMode === "rapid") {
    safeClassList(ui.rapidFirePanel, "remove", "hidden");
    if (ui.questionPanel) safeClassList(ui.questionPanel, "remove", "hidden");
    safeClassList(ui.emojiModePanel, "add", "hidden");
  } else {
    safeClassList(ui.emojiModePanel, "add", "hidden");
    safeClassList(ui.rapidFirePanel, "add", "hidden");
    if (ui.questionPanel) safeClassList(ui.questionPanel, "remove", "hidden");
    loadNextQuestion();
  }
}

function loadNextQuestion() {
  if (!quizState) return;
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  activeQuestion = null;
  questionResolved = false;
  
  if (ui.questionPanel) {
    ui.questionPanel.style.opacity = "0";
    setTimeout(() => {
      if (ui.questionPanel) ui.questionPanel.style.opacity = "1";
    }, 200);
  }
  
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
  markQuestionUsed(question.id);
  
  if (ui.nextBtn) ui.nextBtn.disabled = true;
  if (ui.questionText) {
    ui.questionText.style.opacity = "0";
    setTimeout(() => {
      if (ui.questionText) {
        ui.questionText.textContent = `${level.label}: ${question.question}`;
        ui.questionText.style.opacity = "1";
      }
    }, 150);
  }
  if (ui.questionCounter) ui.questionCounter.textContent = `${quizState.answers.length + 1} / ${quizState.totalQuestions}`;
  if (ui.scoreDisplay) ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  if (ui.options) {
    ui.options.innerHTML = "";
    ui.options.style.opacity = "0";
  }

  if (ui.options && question.options) {
    setTimeout(() => {
      if (!ui.options) return;
      question.options.forEach((option, idx) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = option;
        btn.style.opacity = "0";
        btn.style.transition = "opacity 0.3s ease";
        btn.addEventListener("click", () => handleAnswer(btn, option, question.answer));
        ui.options.appendChild(btn);
        setTimeout(() => {
          btn.style.opacity = "1";
        }, idx * 50);
      });
      if (ui.options) ui.options.style.opacity = "1";
    }, 150);
  }

  updateProgress();
  restartTimer();
}

function pullNextUniqueQuestion(levelId) {
  const questions = quizState.questionMap[levelId] || [];
  if (quizState.levelProgress[levelId] === undefined) {
    quizState.levelProgress[levelId] = 0;
  }

  const startIndex = quizState.levelProgress[levelId];
  for (let i = startIndex; i < questions.length; i++) {
    const candidate = questions[i];
    if (!usedQuestionIds.has(candidate.id) && !isQuestionUsed(candidate.id)) {
      quizState.levelProgress[levelId] = i + 1;
      return candidate;
    }
  }

  for (let i = 0; i < startIndex; i++) {
    const candidate = questions[i];
    if (!usedQuestionIds.has(candidate.id) && !isQuestionUsed(candidate.id)) {
      quizState.levelProgress[levelId] = i + 1;
      return candidate;
    }
  }

  return null;
}

function handleAnswer(button, selected, correct) {
  if (questionResolved || !activeQuestion) return;
  
  questionResolved = true;
  
  if (ui.options) {
    Array.from(ui.options.children).forEach((child) => {
      child.disabled = true;
      child.style.pointerEvents = "none";
    });
  }
  
  const isCorrect = recordAnswer(quizState, selected, correct);
  console.log("✅ Answer validated");
  
  if (ui.options) {
    Array.from(ui.options.children).forEach((child) => {
      if (child.textContent === correct) {
        safeClassList(child, "add", "correct");
      }
      if (child === button) {
        safeClassList(child, "add", isCorrect ? "correct" : "wrong");
      }
    });
  }
  
  if (isCorrect) {
    console.log("✅ Score updated");
  }
  
  if (ui.scoreDisplay) ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  stopTimer();

  currentQuestionIndex += 1;
  const levelComplete = currentQuestionIndex >= 3;

  if (levelComplete) {
    pendingAdvanceTimeout = setTimeout(unlockNextLevel, isCorrect ? 300 : 1000);
    return;
  }

  if (isCorrect) {
    if (ui.nextBtn) ui.nextBtn.disabled = false;
  } else {
    showMessage("Incorrect");
    pendingAdvanceTimeout = setTimeout(() => {
      loadNextQuestion();
    }, 1500);
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
  if (!ui.levelCards || !quizState) return;
  ui.levelCards.forEach((card, index) => {
    const lockEl = card.querySelector(".lock");
    if (index <= (quizState.currentLevelIndex || 0)) {
      safeClassList(card, "remove", "locked");
      if (lockEl) lockEl.textContent = "Unlocked";
    } else {
      safeClassList(card, "add", "locked");
      if (lockEl) lockEl.textContent = "Locked";
    }
  });
}

function unlockNextLevel() {
  if (!quizState) return;
  clearTimeout(pendingAdvanceTimeout);
  pendingAdvanceTimeout = null;
  activeQuestion = null;
  questionResolved = false;
  currentLevel += 1;
  quizState.currentLevelIndex = currentLevel;
  currentQuestionIndex = 0;
  quizState.levelProgress = Object.fromEntries(LEVELS.map((lvl) => [lvl.id, 0]));

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
  if (!quizState) return;
  pendingBadge = determineBadge(quizState.score, quizState.totalQuestions);
  if (ui.resultSummary) ui.resultSummary.textContent = `You scored ${quizState.score} / ${quizState.totalQuestions}`;
  if (ui.badgeDisplay) ui.badgeDisplay.innerHTML = renderBadgeToken(pendingBadge) + buildSavedBadgesMarkup();
  safeClassList(ui.game, "add", "hidden");
  safeClassList(ui.result, "remove", "hidden");
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
  if (ui.badgeDisplay) ui.badgeDisplay.innerHTML = renderBadgeToken(pendingBadge) + buildSavedBadgesMarkup();
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
  resetUsedQuestions();
  resetEmojiUsed();
  emojiSubmitted = false;
  rapidAnswered = false;
  currentLevel = 0;
  currentQuestionIndex = 0;
  currentMode = "classic";
  selectedItemId = null;
  safeClassList(ui.home, "remove", "hidden");
  safeClassList(ui.game, "add", "hidden");
  safeClassList(ui.result, "add", "hidden");
  if (ui.options) ui.options.innerHTML = "";
  if (ui.progressBar && ui.progressBar.style) ui.progressBar.style.width = "0%";
  if (ui.questionText) {
    ui.questionText.textContent = "Question will appear here";
    if (ui.questionText.style) ui.questionText.style.opacity = "1";
  }
  safeClassList(ui.emojiModePanel, "add", "hidden");
  safeClassList(ui.rapidFirePanel, "add", "hidden");
  if (ui.questionPanel) {
    safeClassList(ui.questionPanel, "remove", "hidden");
    if (ui.questionPanel.style) ui.questionPanel.style.opacity = "1";
  }
  if (ui.nextBtn) {
    ui.nextBtn.style.display = "";
    ui.nextBtn.disabled = false;
  }
  clearSearchResults();
}

function toggleButton(button, disabled, label) {
  if (!button) return;
  button.disabled = disabled;
  if (label) button.textContent = label;
}

function showMessage(message) {
  if (ui.connectionStatus) ui.connectionStatus.textContent = message;
}

function updateProgress() {
  if (!quizState || !ui.progressBar) return;
  const progress = (quizState.answers.length / quizState.totalQuestions) * 100;
  if (ui.progressBar.style) ui.progressBar.style.width = `${progress}%`;
}

function restartTimer() {
  stopTimer();
  timerValue = QUESTION_TIME;
  if (ui.timer) ui.timer.textContent = `${timerValue}s`;
  timerId = setInterval(() => {
    timerValue -= 1;
    if (ui.timer) ui.timer.textContent = `${timerValue}s`;
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
  questionResolved = true;
  recordAnswer(quizState, null, activeQuestion.answer);
  if (ui.options) {
    Array.from(ui.options.children).forEach((child) => {
      child.disabled = true;
      if (child.textContent === activeQuestion.answer) {
        safeClassList(child, "add", "correct");
      }
    });
  }
  if (ui.scoreDisplay) ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  updateProgress();
  currentQuestionIndex += 1;
  const levelComplete = currentQuestionIndex >= 3;
  if (levelComplete) {
    pendingAdvanceTimeout = setTimeout(unlockNextLevel, 600);
  } else {
    pendingAdvanceTimeout = setTimeout(loadNextQuestion, 800);
  }
}

function startEmojiMode(data) {
  console.log("✅ Emoji round active");
  resetEmojiUsed();
  emojiModeData = {
    title: data.title,
    genre: data.genre || "",
    overview: data.overview || "",
    mediaType: data.mediaType || "",
    score: 0,
    questionIndex: 0,
    usedTitles: new Set(),
  };
  
  if (!quizState) {
    quizState = { score: 0, answers: [] };
  }
  quizState.score = 0;
  
  safeClassList(ui.emojiModePanel, "remove", "hidden");
  if (ui.questionPanel) safeClassList(ui.questionPanel, "add", "hidden");
  safeClassList(ui.rapidFirePanel, "add", "hidden");
  if (ui.nextBtn) ui.nextBtn.style.display = "none";
  
  enterGame();
  loadNextEmojiQuestion();
}

function loadNextEmojiQuestion() {
  if (!emojiModeData || emojiModeData.questionIndex >= 5) {
    showResults();
    return;
  }
  
  emojiSubmitted = false;
  if (ui.emojiSubmitBtn) ui.emojiSubmitBtn.disabled = false;
  
  const emojiString = generateEmojiHints(emojiModeData);
  if (ui.emojiDisplay) {
    ui.emojiDisplay.style.opacity = "0";
    setTimeout(() => {
      if (ui.emojiDisplay) {
        ui.emojiDisplay.textContent = emojiString;
        ui.emojiDisplay.style.opacity = "1";
      }
    }, 200);
  }
  if (ui.emojiGuessInput) {
    ui.emojiGuessInput.value = "";
    ui.emojiGuessInput.focus();
  }
  if (ui.emojiFeedback) ui.emojiFeedback.textContent = "";
}

function handleEmojiSubmit() {
  if (!emojiModeData || emojiSubmitted) return;
  
  const guess = ui.emojiGuessInput ? ui.emojiGuessInput.value.trim() : "";
  const result = checkEmojiAnswer(guess, emojiModeData.title);
  
  if (!result.valid) {
    if (ui.emojiFeedback) {
      ui.emojiFeedback.textContent = result.error || "Enter your answer first";
      if (ui.emojiFeedback.style) ui.emojiFeedback.style.color = "var(--danger)";
    }
    return;
  }
  
  emojiSubmitted = true;
  if (ui.emojiSubmitBtn) ui.emojiSubmitBtn.disabled = true;
  console.log("✅ Answer validated");
  
  if (result.correct) {
    emojiModeData.score += 20;
    quizState.score = emojiModeData.score;
    console.log("✅ Score updated");
    if (ui.scoreDisplay) ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
    if (ui.emojiFeedback) {
      ui.emojiFeedback.textContent = "✅ Correct! +20 points";
      if (ui.emojiFeedback.style) ui.emojiFeedback.style.color = "var(--accent-2)";
    }
  } else {
    if (ui.emojiFeedback) {
      ui.emojiFeedback.textContent = `❌ Wrong! The answer was: ${emojiModeData.title}`;
      if (ui.emojiFeedback.style) ui.emojiFeedback.style.color = "var(--danger)";
    }
  }
  
  markEmojiTitleUsed(emojiModeData.title);
  emojiModeData.usedTitles.add(emojiModeData.title.toLowerCase());
  
  setTimeout(() => {
    emojiModeData.questionIndex += 1;
    loadNextEmojiQuestion();
  }, result.correct ? 1500 : 2000);
}

function startRapidFire(data) {
  console.log("✅ Rapid Fire active");
  rapidFireState = {
    questions: [],
    currentIndex: 0,
    score: 0,
    timeLeft: 30,
    answered: false,
    metadata: data,
  };
  
  if (!quizState) {
    quizState = { score: 0, answers: [] };
  }
  quizState.score = 0;
  
  enterGame();
  
  Promise.resolve().then(async () => {
    try {
      const rawQuestions = await fetchQuizQuestions(data);
      const questionMap = normalizeLevels(rawQuestions, data.title);
      const allQuestions = [];
      Object.values(questionMap).forEach((levelQs) => {
        allQuestions.push(...levelQs);
      });
      rapidFireState.questions = allQuestions.slice(0, 5).map(q => 
        prepareRapidQuestion(q, data.title, data.genre || "", data.overview || "")
      );
    } catch (e) {
      rapidFireState.questions = Array(5).fill(null).map((_, i) => {
        const fallback = prepareRapidQuestion({
          id: `rapid-${i}`,
          question: `Rapid Question ${i + 1} about ${data.title}?`,
          options: [],
          answer: "Iconic characters",
        }, data.title, data.genre || "", data.overview || "");
        return fallback;
      });
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
  rapidAnswered = false;
  
  if (ui.questionText) {
    ui.questionText.style.opacity = "0";
    setTimeout(() => {
      if (ui.questionText) {
        ui.questionText.textContent = question.question;
        ui.questionText.style.opacity = "1";
      }
    }, 150);
  }
  if (ui.rapidQuestionCounter) ui.rapidQuestionCounter.textContent = `Question ${rapidFireState.currentIndex + 1} / 5`;
  if (ui.options) {
    ui.options.innerHTML = "";
    ui.options.style.opacity = "0";
  }
  
  if (ui.options && question.options && question.options.length >= 4) {
    setTimeout(() => {
      if (!ui.options) return;
      question.options.forEach((option, idx) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = option;
        btn.style.opacity = "0";
        btn.style.transition = "opacity 0.3s ease";
        btn.addEventListener("click", () => submitRapidAnswer(btn, option, question.answer));
        ui.options.appendChild(btn);
        setTimeout(() => {
          btn.style.opacity = "1";
        }, idx * 50);
      });
      if (ui.options) ui.options.style.opacity = "1";
    }, 150);
  }
  
  rapidFireState.timeLeft = 30;
  startRapidTimer();
}

function submitRapidAnswer(button, selected, correct) {
  if (rapidAnswered || !rapidFireState) return;
  rapidAnswered = true;
  console.log("✅ Answer validated");
  
  if (ui.options) {
    Array.from(ui.options.children).forEach((child) => {
      child.disabled = true;
      child.style.pointerEvents = "none";
    });
  }
  
  const isCorrect = checkRapidAnswer(selected, correct);
  if (isCorrect) {
    rapidFireState.score += 5;
    quizState.score = rapidFireState.score;
    console.log("✅ Score updated");
    safeClassList(button, "add", "correct");
  } else {
    safeClassList(button, "add", "wrong");
    if (ui.options) {
      Array.from(ui.options.children).forEach((child) => {
        if (checkRapidAnswer(child.textContent, correct)) {
          safeClassList(child, "add", "correct");
        }
      });
    }
  }
  
  if (ui.scoreDisplay) ui.scoreDisplay.textContent = `Score: ${quizState.score}`;
  stopTimer();
  
  setTimeout(() => {
    rapidFireState.currentIndex += 1;
    loadRapidQuestion();
  }, 1500);
}

function startRapidTimer() {
  stopTimer();
  if (ui.rapidTimer) ui.rapidTimer.textContent = `${rapidFireState.timeLeft}s`;
  timerId = setInterval(() => {
    rapidFireState.timeLeft -= 1;
    if (ui.rapidTimer) ui.rapidTimer.textContent = `${rapidFireState.timeLeft}s`;
    
    if (rapidFireState.timeLeft <= 0) {
      stopTimer();
      showResults();
    }
  }, 1000);
}

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
    selectedItemId = null;
    
    safeClassList(ui.emojiModePanel, "add", "hidden");
    safeClassList(ui.rapidFirePanel, "add", "hidden");
    if (ui.questionPanel) safeClassList(ui.questionPanel, "remove", "hidden");
    if (ui.nextBtn) ui.nextBtn.style.display = "";
    
    resetToHome();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
