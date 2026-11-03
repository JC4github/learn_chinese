import { MandarinPlayer } from "./speech.js?v=recordings-1";

const STORAGE_KEY = "hanzi-path-state-v1";
const TOPICS = [["pinyin", "Pinyin"], ["conversation", "Conversations"], ["daily-life", "Daily life"], ["food", "Food"], ["travel", "Travel"], ["shopping", "Shopping"]];

const defaultState = {
  name: "Learner",
  level: "Beginner 1",
  topics: ["daily-life", "food"],
  dailyMinutes: 10,
  showPinyin: true,
  showTranslation: false,
  completed: [],
  savedWords: [],
  streak: 0,
  totalMinutes: 0,
  lastStudyDate: null,
};

let state = loadState();
let stories = [];
let currentView = getRoute();
let activeStoryId = null;
let quizSelection = null;
let libraryFilter = "all";
let deferredInstallPrompt = null;
let audioState = { status: "idle", text: "", message: "Tap the speaker to hear Mandarin." };
const audio = new MandarinPlayer({
  Howl: window.Howl,
  onChange: (value) => { audioState = value; updateAudioControls(); },
});

const app = document.querySelector("#app");
const wordDialog = document.querySelector("#word-dialog");
const installDialog = document.querySelector("#install-dialog");
const toast = document.querySelector("#toast");

init();

async function init() {
  try {
    const [response, audioResponse] = await Promise.all([fetch("./data/stories.json?v=lessons-1"), fetch("./audio/manifest.json?v=lessons-1")]);
    if (!response.ok) throw new Error("Story library could not be loaded");
    stories = (await response.json()).stories;
    if (!audioResponse.ok) throw new Error("Audio library could not be loaded");
    audio.setClips((await audioResponse.json()).clips);
    bindGlobalEvents();
    render();
    registerServiceWorker();
  } catch (error) {
    app.innerHTML = `<section class="empty-state"><span class="seal">!</span><h1>We couldn’t open the library</h1><p>${escapeHtml(error.message)}</p><button class="primary-button" onclick="location.reload()">Try again</button></section>`;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const result = structuredClone(defaultState);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return result;
    if (typeof saved.name === "string") result.name = saved.name.trim().slice(0, 24) || "Learner";
    if (["Beginner 1", "Beginner 2"].includes(saved.level)) result.level = saved.level;
    if ([5, 10, 15, 20, 25, 30].includes(saved.dailyMinutes)) result.dailyMinutes = saved.dailyMinutes;
    for (const key of ["showPinyin", "showTranslation"]) if (typeof saved[key] === "boolean") result[key] = saved[key];
    for (const key of ["streak", "totalMinutes"]) if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) result[key] = saved[key];
    if (typeof saved.lastStudyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastStudyDate)) result.lastStudyDate = saved.lastStudyDate;
    if (Array.isArray(saved.completed)) result.completed = [...new Set(saved.completed.filter((value) => typeof value === "string"))];
    if (Array.isArray(saved.topics)) result.topics = [...new Set(saved.topics.filter((value) => TOPICS.some(([id]) => id === value)))];
    if (Array.isArray(saved.savedWords)) result.savedWords = saved.savedWords.filter((word) => word && ["h", "p", "e", "key"].every((key) => typeof word[key] === "string"));
    return result;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast("Progress could not be saved. Check available storage or private browsing settings."); }
}

function getRoute() {
  const route = location.hash.replace("#", "");
  return ["home", "library", "words", "profile"].includes(route) ? route : "home";
}

function bindGlobalEvents() {
  window.addEventListener("hashchange", () => {
    if (location.hash === "#app") return;
    audio.stop();
    activeStoryId = null;
    quizSelection = null;
    currentView = getRoute();
    render();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  document.querySelector("#install-button").addEventListener("click", handleInstall);

  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close-dialog]");
    if (close) close.closest("dialog")?.close();
  });

  document.addEventListener("click", handleAppClick);
  app.addEventListener("change", handleAppChange);
  wordDialog.addEventListener("close", () => audio.stop());
  window.addEventListener("pagehide", () => audio.stop());
  document.addEventListener("visibilitychange", () => { if (document.hidden) audio.stop(); });
}

function render() {
  document.documentElement.classList.toggle("reader-open", Boolean(activeStoryId));
  document.body.classList.toggle("reader-open", Boolean(activeStoryId));
  updateNav();

  if (activeStoryId) {
    renderReader();
    app.scrollTo({ top: 0, behavior: "instant" });
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }

  if (currentView === "library") renderLibrary();
  else if (currentView === "words") renderWords();
  else if (currentView === "profile") renderProfile();
  else renderHome();

  app.scrollTo({ top: 0, behavior: "instant" });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderHome() {
  const recommended = getRecommendedStory();
  const readToday = state.lastStudyDate === localDateKey();
  const progress = Math.min(100, Math.round((state.completed.length / Math.max(stories.length, 1)) * 100));

  app.innerHTML = `
    <section class="welcome-section page-shell">
      <div class="eyebrow">${formatDate()}</div>
      <div class="welcome-row">
        <div><p class="muted greeting">你好，${escapeHtml(state.name)}</p><h1>Your next few minutes<br><em>in Chinese.</em></h1></div>
        <div class="progress-orbit" style="--progress:${progress * 3.6}deg" aria-label="${progress}% of starter library complete"><span>${progress}%</span></div>
      </div>
    </section>

    <section class="page-shell daily-grid" aria-label="Daily learning summary">
      <article class="stat-card"><span class="stat-icon flame">火</span><strong>${state.streak}</strong><small>day streak</small></article>
      <article class="stat-card"><span class="stat-icon">字</span><strong>${state.savedWords.length}</strong><small>saved words</small></article>
      <article class="stat-card"><span class="stat-icon">分</span><strong>${state.totalMinutes}</strong><small>minutes read</small></article>
    </section>

    <section class="page-shell section-block">
      <div class="section-heading"><div><span class="eyebrow">For you today</span><h2>${readToday ? "Keep the rhythm" : `${state.dailyMinutes} minute goal`}</h2></div><span class="status-pill">${readToday ? "Goal started" : "Ready"}</span></div>
      ${storyCard(recommended, true)}
    </section>

    ${studyPaths()}
    <section class="page-shell section-block compact-bottom">
      <div class="section-heading"><div><span class="eyebrow">Continue exploring</span><h2>Short reads</h2></div><a href="#library" class="text-link">See all</a></div>
      <div class="horizontal-stories">
        ${stories.filter((story) => story.id !== recommended.id).slice(0, 3).map((story) => storyMiniCard(story)).join("")}
      </div>
    </section>
  `;
}

function studyPaths() {
  return `<section class="page-shell section-block"><div class="section-heading"><div><span class="eyebrow">Listen, then try it</span><h2>Build your basics</h2></div></div><div class="study-paths">
    <button class="study-path" type="button" data-open-topic="pinyin"><span class="path-symbol" aria-hidden="true">ā</span><strong>Pinyin practice</strong><small>4 sound-focused lessons</small><span class="path-arrow" aria-hidden="true">→</span></button>
    <button class="study-path" type="button" data-open-topic="conversation"><span class="path-symbol" aria-hidden="true">说</span><strong>Daily conversations</strong><small>6 useful everyday exchanges</small><span class="path-arrow" aria-hidden="true">→</span></button>
  </div></section>`;
}

function learningFocus(story) {
  if (!story.coach) return "";
  return `<section class="learning-focus" aria-label="Learning focus">
    <span class="eyebrow">${story.topic === "pinyin" ? "Pinyin lab" : "Say it in real life"}</span>
    <h2>${escapeHtml(story.coach.title)}</h2>
    <ul>${story.coach.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    <p class="practice-hint">Tap a sound, listen, then repeat aloud.</p>
    <div class="practice-grid">${story.coach.practice.map((word) => `<button type="button" class="practice-sound" data-speak-word="${escapeAttr(word.h)}" aria-label="Hear ${escapeAttr(word.h)}"><span class="practice-hanzi" lang="zh-Hans">${escapeHtml(word.h)}</span><strong>${escapeHtml(word.p)}</strong><small>${escapeHtml(word.e)}</small><span class="listen-label" aria-hidden="true">▷ Listen</span></button>`).join("")}</div>
  </section>`;
}

function renderLibrary() {
  const topics = [["all", "All"], ...TOPICS];
  const visible = stories.filter((story) => libraryFilter === "all" || story.topic === libraryFilter);

  app.innerHTML = `
    <section class="page-shell page-title"><span class="eyebrow">Your reading shelf</span><h1>Story library</h1><p>${stories.length} short reads and guided lessons. Listen, repeat, then try the quick check.</p></section>
    <section class="page-shell">
      <div class="filter-row" role="group" aria-label="Filter stories by topic">
        ${topics.map(([value, label]) => `<button class="filter-chip ${libraryFilter === value ? "active" : ""}" type="button" data-filter="${value}">${label}</button>`).join("")}
      </div>
      <div class="story-list">${visible.map((story) => storyCard(story, false)).join("")}</div>
    </section>
  `;
}

function renderWords() {
  const words = state.savedWords;
  app.innerHTML = `
    <section class="page-shell page-title"><span class="eyebrow">Your collection</span><h1>Saved words</h1><p>${words.length ? `${words.length} word${words.length === 1 ? "" : "s"} ready for another look.` : "Tap words while reading to build your personal list."}</p></section>
    <section class="page-shell">
      ${words.length ? `<div class="word-list">${words.map((word) => `
        <article class="saved-word">
          <button class="saved-word-main" type="button" data-speak-word="${escapeAttr(word.h)}" aria-label="Hear ${escapeAttr(word.h)}"><span class="hanzi">${escapeHtml(word.h)}</span><span><strong>${escapeHtml(word.p)}</strong><small>${escapeHtml(word.e)}</small></span></button>
          <button class="remove-word" type="button" data-remove-word="${escapeAttr(word.key)}" aria-label="Remove ${escapeAttr(word.h)}">×</button>
        </article>`).join("")}</div>` : `
        <div class="empty-state"><span class="seal">字</span><h2>Your word garden is empty</h2><p>Open a story, tap a word, and choose “Save word”.</p><a class="primary-button" href="#library">Find a story</a></div>`}
    </section>
  `;
}

function renderProfile() {
  const topicOptions = TOPICS;

  app.innerHTML = `
    <section class="page-shell page-title"><span class="eyebrow">Make it yours</span><h1>Your path</h1><p>These preferences stay on this device.</p></section>
    <section class="page-shell settings-stack">
      <div class="settings-card">
        <label class="field-label" for="learner-name">What should we call you?</label>
        <input id="learner-name" class="text-input" value="${escapeAttr(state.name)}" maxlength="24" autocomplete="nickname" />
      </div>
      <div class="settings-card">
        <span class="field-label">Reading level</span>
        <div class="segmented-control">
          ${["Beginner 1", "Beginner 2"].map((level) => `<button type="button" data-level="${level}" class="${state.level === level ? "active" : ""}">${level}</button>`).join("")}
        </div>
      </div>
      <div class="settings-card">
        <span class="field-label">Topics you enjoy</span>
        <div class="topic-grid">
          ${topicOptions.map(([value, label]) => `<label class="check-chip"><input type="checkbox" value="${value}" data-topic ${state.topics.includes(value) ? "checked" : ""}/><span>${label}</span></label>`).join("")}
        </div>
      </div>
      <div class="settings-card">
        <label class="field-label" for="daily-minutes">Daily reading goal <strong><span id="minute-output">${state.dailyMinutes}</span> min</strong></label>
        <input id="daily-minutes" type="range" min="5" max="30" step="5" value="${state.dailyMinutes}" />
      </div>
      <div class="settings-card toggle-card">
        <span><strong>Show pinyin by default</strong><small>You can still change this inside a story.</small></span>
        <label class="switch"><input type="checkbox" aria-label="Show pinyin by default" data-setting="showPinyin" ${state.showPinyin ? "checked" : ""}/><span></span></label>
      </div>
      <button class="secondary-button full-width" type="button" data-install>Install on this device</button>
      <button class="danger-link" type="button" data-reset>Reset all progress</button>
      <p class="privacy-note">No account. No advertising. Your learning data stays in this browser.</p>
    </section>
  `;
}

function renderReader() {
  const story = stories.find((item) => item.id === activeStoryId);
  if (!story) return;
  const completed = state.completed.includes(story.id);

  app.innerHTML = `
    <article class="reader-shell">
      <header class="reader-header ${story.accent}">
        <button class="reader-back" type="button" data-reader-back aria-label="Return to previous page">←</button>
        <div class="reader-actions">
          <button class="reader-tool ${state.showPinyin ? "active" : ""}" type="button" data-toggle-pinyin aria-pressed="${state.showPinyin}">拼音</button>
          <button class="reader-tool ${state.showTranslation ? "active" : ""}" type="button" data-toggle-translation aria-pressed="${state.showTranslation}">EN</button>
          <button class="reader-tool sound-tool" type="button" data-speak-story="${escapeAttr(story.paragraphs.flatMap((paragraph) => paragraph.tokens).map((token) => token.h).join(""))}" aria-label="Read story aloud"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9zm12-1a6 6 0 0 1 0 8m2.5-11a10 10 0 0 1 0 14" /></svg></button>
        </div>
        <div class="story-meta"><span>${story.level}</span><span>${story.topicLabel}</span><span>${story.minutes} min</span></div>
        <h1>${story.title}</h1><p>${story.englishTitle}</p>
      </header>

      <div class="reader-body">
        <p class="reader-hint">Tap any word for its meaning.</p>
        <p class="audio-status" data-audio-status role="status"></p>
        ${learningFocus(story)}
        <div class="story-copy ${state.showPinyin ? "show-pinyin" : "hide-pinyin"}">
          ${story.paragraphs.map((paragraph) => `
            <section class="story-paragraph">
              ${paragraph.speaker ? `<p class="speaker-tag">${escapeHtml(paragraph.speaker)}</p>` : ""}
              <p class="chinese-copy">${paragraph.tokens.map((token) => tokenMarkup(token)).join("")}</p>
              ${state.showTranslation ? `<p class="paragraph-translation">${paragraph.translation}</p>` : ""}
            </section>`).join("")}
        </div>

        <section class="quiz-card">
          <span class="eyebrow">Quick check</span>
          <h2>${story.quiz.question}</h2>
          <div class="quiz-options">
            ${story.quiz.options.map((option, index) => {
              let className = "";
              if (quizSelection !== null && index === story.quiz.answer) className = "correct";
              else if (quizSelection === index) className = "incorrect";
              return `<button type="button" class="quiz-option ${className}" data-quiz-answer="${index}" ${quizSelection !== null ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${option}</button>`;
            }).join("")}
          </div>
          ${quizSelection !== null ? `<div class="quiz-feedback ${quizSelection === story.quiz.answer ? "success" : "try-again"}"><strong>${quizSelection === story.quiz.answer ? "答对了 — that’s right." : "Not quite — keep the clue."}</strong><p>${story.quiz.explanation}</p></div>` : ""}
          ${quizSelection !== null ? `<button class="primary-button full-width" type="button" data-finish-story>${completed ? "Back to today" : "Complete story"}</button>` : ""}
        </section>
      </div>
    </article>
  `;
  updateAudioControls();
}

function storyCard(story, featured) {
  const completed = state.completed.includes(story.id);
  return `<article class="story-card ${story.accent} ${featured ? "featured" : ""}">
    <div class="story-card-top"><span class="story-level">${story.level} · ${story.topicLabel}</span>${completed ? `<span class="complete-mark">✓ Read</span>` : `<span>${story.minutes} min</span>`}</div>
    <div class="story-card-copy"><span class="story-glyph" aria-hidden="true">${story.title.charAt(0)}</span><div><h3>${story.title}</h3><p>${story.englishTitle}</p><small>${story.summary}</small></div></div>
    <button class="story-open" type="button" data-open-story="${story.id}">${completed ? "Read again" : "Start reading"}<span aria-hidden="true">→</span></button>
  </article>`;
}

function storyMiniCard(story) {
  return `<button class="mini-story ${story.accent}" type="button" data-open-story="${story.id}"><span class="mini-glyph">${story.title.charAt(0)}</span><span class="story-level">${story.level}</span><strong>${story.title}</strong><small>${story.englishTitle}</small></button>`;
}

function tokenMarkup(token) {
  if (token.punct) return `<span class="punctuation">${token.h}</span>`;
  return `<button class="word-token" type="button" data-word='${escapeAttr(JSON.stringify(token))}'><ruby>${token.h}<rt>${token.p}</rt></ruby></button>`;
}

function handleAppClick(event) {
  const topic = event.target.closest("[data-open-topic]");
  if (topic) {
    libraryFilter = topic.dataset.openTopic;
    currentView = "library";
    if (location.hash === "#library") render();
    else location.hash = "library";
    return;
  }
  const openStory = event.target.closest("[data-open-story]");
  if (openStory) {
    audio.stop();
    activeStoryId = openStory.dataset.openStory;
    quizSelection = null;
    render();
    return;
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    libraryFilter = filter.dataset.filter;
    renderLibrary();
    return;
  }

  const tokenButton = event.target.closest("[data-word]");
  if (tokenButton) {
    showWord(JSON.parse(tokenButton.dataset.word));
    return;
  }

  if (event.target.closest("[data-reader-back]")) {
    audio.stop();
    activeStoryId = null;
    quizSelection = null;
    render();
    return;
  }

  if (event.target.closest("[data-toggle-pinyin]")) {
    state.showPinyin = !state.showPinyin;
    saveState(); renderReader(); return;
  }

  if (event.target.closest("[data-toggle-translation]")) {
    state.showTranslation = !state.showTranslation;
    saveState(); renderReader(); return;
  }

  if (event.target.closest("[data-speak-story]")) {
    const story = stories.find((item) => item.id === activeStoryId);
    speak(story.paragraphs.flatMap((paragraph) => paragraph.tokens).map((token) => token.h).join(""));
    return;
  }

  const answer = event.target.closest("[data-quiz-answer]");
  if (answer) {
    quizSelection = Number(answer.dataset.quizAnswer);
    renderReader();
    return;
  }

  if (event.target.closest("[data-finish-story]")) {
    completeStory();
    return;
  }

  const saveWord = event.target.closest("[data-save-word]");
  if (saveWord) {
    const word = JSON.parse(saveWord.dataset.saveWord);
    toggleSavedWord(word);
    wordDialog.close();
    return;
  }

  const speakWord = event.target.closest("[data-speak-word]");
  if (speakWord) {
    speak(speakWord.dataset.speakWord);
    return;
  }

  const removeWord = event.target.closest("[data-remove-word]");
  if (removeWord) {
    state.savedWords = state.savedWords.filter((word) => word.key !== removeWord.dataset.removeWord);
    saveState(); renderWords(); showToast("Word removed"); return;
  }

  const level = event.target.closest("[data-level]");
  if (level) {
    state.level = level.dataset.level;
    saveState(); renderProfile(); showToast("Level updated"); return;
  }

  if (event.target.closest("[data-install]")) {
    handleInstall(); return;
  }

  if (event.target.closest("[data-reset]")) {
    if (confirm("Reset your saved words, story progress, streak, and preferences?")) {
      audio.stop();
      state = structuredClone(defaultState);
      saveState(); renderProfile(); showToast("Progress reset");
    }
  }
}

function handleAppChange(event) {
  if (event.target.id === "learner-name") {
    state.name = event.target.value.trim() || "Learner";
    saveState(); showToast("Name saved");
  }
  if (event.target.id === "daily-minutes") {
    state.dailyMinutes = Number(event.target.value);
    document.querySelector("#minute-output").textContent = state.dailyMinutes;
    saveState();
  }
  if (event.target.matches("[data-topic]")) {
    const selected = [...app.querySelectorAll("[data-topic]:checked")].map((input) => input.value);
    state.topics = selected;
    saveState();
  }
  if (event.target.matches("[data-setting]")) {
    state[event.target.dataset.setting] = event.target.checked;
    saveState();
  }
}

function getRecommendedStory() {
  const unread = stories.filter((story) => !state.completed.includes(story.id));
  const pool = unread.length ? unread : stories;
  return pool.find((story) => story.level === state.level && state.topics.includes(story.topic))
    || pool.find((story) => story.level === state.level)
    || pool[0];
}

function showWord(word) {
  audio.stop();
  const key = wordKey(word);
  const saved = state.savedWords.some((item) => item.key === key);
  const payload = JSON.stringify({ ...word, key });
  document.querySelector("#word-dialog-content").innerHTML = `
    <div class="word-detail">
      <button class="word-sound" type="button" data-speak-word="${escapeAttr(word.h)}" aria-label="Hear pronunciation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9zm12-1a6 6 0 0 1 0 8" /></svg></button>
      <span class="word-hanzi">${escapeHtml(word.h)}</span><span class="word-pinyin">${escapeHtml(word.p)}</span><span class="word-meaning">${escapeHtml(word.e)}</span>
      <p class="audio-status" data-audio-status role="status">Tap the speaker to hear Mandarin.</p>
      <button class="${saved ? "secondary-button" : "primary-button"} full-width" type="button" data-save-word='${escapeAttr(payload)}'>${saved ? "Remove from saved words" : "Save word"}</button>
    </div>`;
  wordDialog.showModal();
}

function toggleSavedWord(word) {
  const exists = state.savedWords.some((item) => item.key === word.key);
  state.savedWords = exists ? state.savedWords.filter((item) => item.key !== word.key) : [...state.savedWords, word];
  saveState();
  showToast(exists ? "Removed from saved words" : "Saved for later");
}

function completeStory() {
  audio.stop();
  const story = stories.find((item) => item.id === activeStoryId);
  if (!state.completed.includes(story.id)) {
    state.completed.push(story.id);
    state.totalMinutes += story.minutes;
  }
  updateStreak();
  saveState();
  activeStoryId = null;
  currentView = "home";
  history.replaceState(null, "", "#home");
  render();
  showToast("Story complete — 做得好!");
}

function updateStreak() {
  const today = localDateKey();
  if (state.lastStudyDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  state.streak = state.lastStudyDate === yesterdayKey ? state.streak + 1 : 1;
  state.lastStudyDate = today;
}

function speak(text) {
  audio.play(text);
}

function updateAudioControls() {
  const active = ["playing", "loading"].includes(audioState.status);
  document.querySelectorAll("[data-audio-status]").forEach((element) => {
    element.textContent = audioState.message;
    element.dataset.state = audioState.status;
    element.classList.toggle("audio-error", audioState.status === "error");
  });
  document.querySelectorAll("[data-speak-word], [data-speak-story]").forEach((button) => {
    const selected = active && (button.hasAttribute("data-speak-story") ? button.dataset.speakStory === audioState.text : button.dataset.speakWord === audioState.text);
    button.classList.toggle("audio-playing", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", selected ? "Stop audio" : button.hasAttribute("data-speak-story") ? "Read story aloud" : `Hear ${button.dataset.speakWord}`);
  });
}

async function handleInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    installDialog.showModal();
  }
}

function updateNav() {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const active = link.dataset.nav === currentView && !activeStoryId;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function wordKey(word) { return `${word.h}|${word.p}|${word.e}`; }
function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate() { return new Intl.DateTimeFormat("en-NZ", { weekday: "long", month: "long", day: "numeric" }).format(new Date()); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
