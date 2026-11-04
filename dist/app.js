import { ReadingPlayer, pronunciationKey } from "./reading-audio.js?v=reading-2";

const STORAGE_KEY = "hanzi-path-state-v1";
const APP_VERSION = "0.5.0";
const INTEREST_TOPICS = [["cars", "JDM & cars", "车"], ["anime", "Anime", "画"], ["technology", "Technology", "芯"], ["engineering", "Engineering", "工"], ["arts", "Creative arts", "艺"], ["slang", "Internet slang", "梗"]];
const TOPICS = [...INTEREST_TOPICS.map(([id, label]) => [id, label]), ["pinyin", "Pinyin"], ["conversation", "Conversations"], ["daily-life", "Daily life"], ["food", "Food"], ["travel", "Travel"], ["shopping", "Shopping"]];

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
let audioState = { status: "idle", text: "", key: "", message: "Tap a speaker to hear Mandarin with the reading voice." };
const audio = new ReadingPlayer({
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
    const [response, audioResponse] = await Promise.all([fetch("./data/stories.json?v=human-2"), fetch("./audio/manifest.json?v=human-2")]);
    if (!response.ok) throw new Error("Story library could not be loaded");
    stories = (await response.json()).stories;
    if (!audioResponse.ok) throw new Error("Audio library could not be loaded");
    const audioManifest = await audioResponse.json();
    if (audioManifest.mode !== "human-only") throw new Error("Please refresh to load the human-recording library");
    audio.setClips(audioManifest.clips);
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
  window.addEventListener("pagehide", () => { audio.stop(); audio.voice.unload(); });

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
  document.body.classList.toggle("reader-open", Boolean(activeStoryId));
  updateNav();

  if (activeStoryId) {
    renderReader();
    resetPageScroll();
    return;
  }

  if (currentView === "library") renderLibrary();
  else if (currentView === "words") renderWords();
  else if (currentView === "profile") renderProfile();
  else renderHome();

  updateAudioControls();
  resetPageScroll();
}

function resetPageScroll() {
  // Let Safari commit the new layout before moving its composited scroll layers.
  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
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

    ${interestPaths()}
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

function interestPaths() {
  return `<section class="page-shell section-block"><div class="section-heading"><div><span class="eyebrow">Made for your interests</span><h2>Learn something new</h2></div></div><div class="study-paths">${INTEREST_TOPICS.map(([id, label, glyph]) => `<button class="study-path" type="button" data-open-topic="${id}"><span class="path-symbol" aria-hidden="true">${glyph}</span><strong>${escapeHtml(label)}</strong><small>${stories.filter((story) => story.topic === id).length} conversations & reads</small><span class="path-arrow" aria-hidden="true">→</span></button>`).join("")}</div></section>`;
}

function entryFormat(story) {
  return story.format || (story.topic === "pinyin" ? "Practice" : story.topic === "conversation" ? "Conversation" : "Story");
}

function learningFocus(story) {
  if (!story.coach) return "";
  return `<section class="learning-focus" aria-label="Learning focus">
    <span class="eyebrow">${story.topic === "pinyin" ? "Pinyin lab" : story.format === "Article" ? "Ideas & useful language" : story.topic === "slang" ? "Casual language in context" : "Say it in real life"}</span>
    <h2>${escapeHtml(story.coach.title)}</h2>
    <ul>${story.coach.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    <p class="practice-hint">Listen to the examples, then repeat aloud.</p>
    <div class="practice-grid">${story.coach.practice.map((word) => `<button type="button" class="practice-sound" data-speak-word="${escapeAttr(word.h)}" data-speak-pinyin="${escapeAttr(word.p)}" data-audio-source="${story.topic === "pinyin" ? "human" : "tts"}" aria-label="Hear ${escapeAttr(word.h)}" ${audio.canPlay(word.h, word.p, story.topic === "pinyin" ? "human" : "tts") ? "" : "disabled"}><span class="practice-hanzi" lang="zh-Hans">${escapeHtml(word.h)}</span><strong>${escapeHtml(word.p)}</strong><small>${escapeHtml(word.e)}</small><span class="listen-label" aria-hidden="true">${story.topic === "pinyin" ? "▷ Human recording" : "▷ Listen"}</span></button>`).join("")}</div>
  </section>`;
}

function renderLibrary() {
  const topics = [["all", "All"], ...TOPICS];
  const visible = stories.filter((story) => libraryFilter === "all" || story.topic === libraryFilter);

  app.innerHTML = `
    <section class="page-shell page-title"><span class="eyebrow">Your reading shelf</span><h1>Your library</h1><p>${stories.length} conversations, articles, stories and guided lessons. Find a topic, listen, and learn something new.</p></section>
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
      <p class="audio-status" data-audio-status role="status"></p>
      <button class="secondary-button voice-download" type="button" data-prepare-voice data-voice-download hidden>Download reading voice · 147 MB</button>
      ${words.length ? `<div class="word-list">${words.map((word) => `
        <article class="saved-word">
          <button class="saved-word-main" type="button" data-speak-word="${escapeAttr(word.h)}" data-speak-pinyin="${escapeAttr(word.p)}" aria-label="Hear ${escapeAttr(word.h)}"><span class="hanzi">${escapeHtml(word.h)}</span><span><strong>${escapeHtml(word.p)}</strong><small>${escapeHtml(word.e)} · Reading voice</small></span></button>
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
      <div class="settings-card"><span class="field-label">Reading voice · wasmtts</span><p class="muted">The default voice for articles, conversations and words. It runs on this device and reuses saved audio. A one-time 147 MB download is needed; an existing speech-lab download is reused.</p><button class="secondary-button full-width" type="button" data-prepare-voice>Prepare reading voice</button><p class="audio-status" data-audio-status role="status"></p><p class="muted">Pinyin sound exercises use human recordings.</p><a class="text-link" href="./tts-lab/credits.html">Voice credits & licences ↗</a></div>
      <div class="settings-card"><span class="field-label">Explore the reading voice</span><a class="text-link" href="./tts-lab/">Open the speech lab ↗</a></div>
      <div class="settings-card"><span class="field-label">App version ${APP_VERSION}</span><button class="secondary-button full-width" type="button" data-check-update>Check for updates</button><p class="muted">Refresh the app without changing your learning progress.</p></div>
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
      <div class="reader-toolbar ${story.accent}" role="group" aria-label="Lesson controls">
        <button class="reader-back" type="button" data-reader-back aria-label="Return to previous page">←</button>
        <div class="reader-actions">
          <button class="reader-tool ${state.showPinyin ? "active" : ""}" type="button" data-toggle-pinyin aria-pressed="${state.showPinyin}">拼音</button>
          <button class="reader-tool ${state.showTranslation ? "active" : ""}" type="button" data-toggle-translation aria-pressed="${state.showTranslation}">EN</button>
          <button class="reader-tool" type="button" data-speak-story="${escapeAttr(story.id)}" aria-label="Read entry aloud" aria-pressed="false">▷ Listen</button>
        </div>
      </div>
      <header class="reader-header ${story.accent}">
        <div class="story-meta"><span>${story.level}</span><span>${story.topicLabel}</span><span>${entryFormat(story)}</span><span>${story.minutes} min</span></div>
        <h1>${story.title}</h1><p>${story.englishTitle}</p>
      </header>

      <div class="reader-body">
        <p class="reader-hint">Tap a word for its meaning and pronunciation. Use Listen to hear the full entry.</p>
        <p class="audio-status" data-audio-status role="status"></p>
        <button class="secondary-button voice-download" type="button" data-prepare-voice data-voice-download hidden>Download reading voice · 147 MB</button>
        ${learningFocus(story)}
        <div class="story-copy ${state.showPinyin ? "show-pinyin" : "hide-pinyin"}">
          ${story.paragraphs.map((paragraph) => `
            <section class="story-paragraph">
              ${paragraph.speaker ? `<p class="speaker-tag">${escapeHtml(paragraph.speaker)}</p>` : ""}
              <p class="chinese-copy">${paragraph.tokens.map((token) => tokenMarkup(token)).join("")}</p>
              <p class="paragraph-translation" ${state.showTranslation ? "" : "hidden"}>${paragraph.translation}</p>
            </section>`).join("")}
        </div>

        ${story.sources?.length ? `<aside class="entry-sources"><h2>Explore further</h2><p>Background reading for this entry. The Mandarin text is original.</p><ul>${story.sources.map((source) => `<li><a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)} ↗</a></li>`).join("")}</ul></aside>` : ""}
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

function updateReaderPreferences() {
  const copy = document.querySelector(".story-copy");
  copy.classList.toggle("show-pinyin", state.showPinyin);
  copy.classList.toggle("hide-pinyin", !state.showPinyin);
  document.querySelectorAll(".paragraph-translation").forEach((paragraph) => { paragraph.hidden = !state.showTranslation; });
  for (const [selector, enabled] of [["[data-toggle-pinyin]", state.showPinyin], ["[data-toggle-translation]", state.showTranslation]]) {
    const button = document.querySelector(selector);
    button.classList.toggle("active", enabled);
    button.setAttribute("aria-pressed", String(enabled));
  }
}

function storyCard(story, featured) {
  const completed = state.completed.includes(story.id);
  return `<article class="story-card ${story.accent} ${featured ? "featured" : ""}">
    <div class="story-card-top"><span class="story-level">${story.level} · ${story.topicLabel}</span><span>${entryFormat(story)} · ${story.minutes} min${completed ? " · ✓ Read" : ""}</span></div>
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
  if (event.target.closest("[data-check-update]")) {
    const url = new URL(location.href);
    url.searchParams.set("update", Date.now());
    location.replace(url.href);
    return;
  }
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
    saveState(); updateReaderPreferences(); return;
  }

  if (event.target.closest("[data-toggle-translation]")) {
    state.showTranslation = !state.showTranslation;
    saveState(); updateReaderPreferences(); return;
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
    speak(speakWord.dataset.speakWord, speakWord.dataset.speakPinyin, speakWord.dataset.audioSource || "tts");
    return;
  }
  const speakStory = event.target.closest("[data-speak-story]");
  if (speakStory) {
    const story = stories.find(item => item.id === speakStory.dataset.speakStory);
    audio.play(storySpeech(story), "", { kind: "story" }); return;
  }
  if (event.target.closest("[data-prepare-voice]")) { audio.prepareVoice(); return; }

  const removeWord = event.target.closest("[data-remove-word]");
  if (removeWord) {
    audio.stop();
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
      <button class="word-sound" type="button" data-speak-word="${escapeAttr(word.h)}" data-speak-pinyin="${escapeAttr(word.p)}" aria-label="Hear pronunciation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9zm12-1a6 6 0 0 1 0 8" /></svg></button>
      <span class="word-hanzi">${escapeHtml(word.h)}</span><span class="word-pinyin">${escapeHtml(word.p)}</span><span class="word-meaning">${escapeHtml(word.e)}</span>
      <p class="audio-status" data-audio-status data-audio-word="${escapeAttr(word.h)}" data-audio-pinyin="${escapeAttr(word.p)}" role="status">${audioDescription(word.h, word.p)}</p>
      <button class="secondary-button full-width" type="button" data-prepare-voice data-voice-download hidden>Download reading voice · 147 MB</button>
      <button class="${saved ? "secondary-button" : "primary-button"} full-width" type="button" data-save-word='${escapeAttr(payload)}'>${saved ? "Remove from saved words" : "Save word"}</button>
    </div>`;
  wordDialog.showModal();
  updateAudioControls();
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

function speak(text, pinyin, source = "tts") {
  audio.play(text, pinyin, { source });
}

function storySpeech(story) { return story.paragraphs.map(paragraph => paragraph.tokens.map(token => token.h).join("")).join("\n"); }

function audioDescription(text, pinyin) {
  return "The reading voice generates audio on this device and saves it for reuse.";
}

function updateAudioControls() {
  const active = ["playing", "loading"].includes(audioState.status);
  document.querySelectorAll("[data-audio-status]").forEach((element) => {
    const word = element.dataset.audioWord;
    element.textContent = word && audioState.kind !== "setup" && audioState.key !== pronunciationKey(word, element.dataset.audioPinyin) ? audioDescription(word, element.dataset.audioPinyin) : audioState.message;
    element.dataset.state = audioState.status;
    element.classList.toggle("audio-error", audioState.status === "error");
  });
  document.querySelectorAll("[data-speak-word]").forEach((button) => {
    const source = button.dataset.audioSource || "tts";
    const available = audio.canPlay(button.dataset.speakWord, button.dataset.speakPinyin, source);
    const selected = available && active && source === audioState.source && pronunciationKey(button.dataset.speakWord, button.dataset.speakPinyin) === audioState.key;
    button.disabled = !available;
    button.classList.toggle("audio-playing", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", selected ? "Stop audio" : available ? `Hear ${button.dataset.speakWord}` : `No human recording for ${button.dataset.speakWord}`);
  });
  document.querySelectorAll("[data-speak-story]").forEach(button => {
    const selected = active && audioState.kind === "story" && pronunciationKey(storySpeech(stories.find(story => story.id === button.dataset.speakStory)), "") === audioState.key;
    button.classList.toggle("audio-playing", selected); button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", selected ? "Stop narration" : "Read entry aloud"); button.textContent = selected ? "■ Stop" : "▷ Listen";
  });
  document.querySelectorAll("[data-voice-download]").forEach(button => { const preparing = active && audioState.kind === "setup"; button.hidden = !audioState.needsDownload && !preparing; button.textContent = preparing ? "Cancel voice setup" : "Download reading voice · 147 MB"; });
  document.querySelectorAll("[data-prepare-voice]").forEach(button => { if (!button.hasAttribute("data-voice-download")) button.textContent = active && audioState.kind === "setup" ? "Cancel voice setup" : "Prepare reading voice"; });
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
}

function wordKey(word) { return `${word.h}|${word.p}|${word.e}`; }
function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate() { return new Intl.DateTimeFormat("en-NZ", { weekday: "long", month: "long", day: "numeric" }).format(new Date()); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
