"use strict";

(function initStudyArcade() {
  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 690;
  const LANE_COUNT = 3;
  const CITY_LINE_Y = 662;
  const INVADER_WIDTH = 250;
  const INVADER_HEIGHT = 132;
  const START_Y = -INVADER_HEIGHT - 10;

  const SETTINGS_KEY = "studyArcadeSettings";
  const SCOREBOARD_KEY = "studyArcadeScoreboard";
  const DEFAULT_FALL_SPEED = "normal";
  const DEFAULT_GAME_MODE = "classic";
  const DEFAULT_CHOICES_PER_ROUND = 3;
  const DEFAULT_CLASSIC_START_LANE = Math.floor(LANE_COUNT / 2);

  const FALL_SPEED_MULTIPLIER = {
    slow: 0.7,
    normal: 1.0,
    fast: 2.0,
    super_fast: 3.6
  };
  const BANNER_SPEED_BOOST = 2.2;

  const ROUND_CONFIG = {
    wrongScorePenalty: 25,
    missScorePenalty: 8,
    skipScorePenalty: 6,
    breachIntegrityPenalty: 10,
    roundSettleMs: 420
  };

  const els = {
    initials: document.getElementById("initials"),
    helpBtn: document.getElementById("help-btn"),
    helpModal: document.getElementById("help-modal"),
    helpCloseBtn: document.getElementById("help-close-btn"),
    termsFileInput: document.getElementById("terms-file-input"),
    topicList: document.getElementById("topic-list"),
    selectAllTopicsBtn: document.getElementById("select-all-topics-btn"),
    clearTopicsBtn: document.getElementById("clear-topics-btn"),
    gameMode: document.getElementById("game-mode"),
    choicesPerRound: document.getElementById("choices-per-round"),
    fallSpeed: document.getElementById("fall-speed"),
    reduceMotion: document.getElementById("reduce-motion"),
    highContrast: document.getElementById("high-contrast"),
    startBtn: document.getElementById("start-btn"),
    pauseBtn: document.getElementById("pause-btn"),
    skipBtn: document.getElementById("skip-btn"),
    leftBtn: document.getElementById("left-btn"),
    rightBtn: document.getElementById("right-btn"),
    fireBtn: document.getElementById("fire-btn"),
    laneControlsSection: document.getElementById("lane-controls-section"),
    helpText: document.getElementById("help-text"),
    scoreText: document.getElementById("score-text"),
    cityHudItem: document.getElementById("city-hud-item"),
    cityText: document.getElementById("city-text"),
    remainingText: document.getElementById("remaining-text"),
    definitionText: document.getElementById("definition-text"),
    canvas: document.getElementById("game-canvas"),
    scoresList: document.getElementById("scores-list"),
    clearScoresBtn: document.getElementById("clear-scores-btn"),
    correctTermsList: document.getElementById("correct-terms-list"),
    termsSourceIndicator: document.getElementById("terms-source-indicator"),
    scoreStorageNote: document.getElementById("score-storage-note"),
    liveRegion: document.getElementById("live-region")
  };

  const ctx = els.canvas.getContext("2d");
  const laneCenters = buildLaneCenters();
  const storage = { enabled: canUseLocalStorage() };

  const state = {
    topicsMap: {},
    selectedTopics: new Set(),
    settings: loadSettings(),
    scoreboard: loadScoreboard(),
    helpOpen: false,
    helpAutoPaused: false,
    lastFocusedElement: null,
    game: createGameState()
  };

  initializeSettingsUI();
  bindEvents();
  updateStorageNote();
  renderScoreboard();
  renderCorrectTerms();
  renderTopicList();
  setTermsSourceIndicator("none");
  setDefinitionText("Load a terms .txt file, then press Start Mission.");
  updateStartAvailability();
  requestAnimationFrame(loop);

  function createGameState() {
    return {
      running: false,
      paused: false,
      gameOver: false,
      won: false,
      selectedLane: DEFAULT_CLASSIC_START_LANE,
      score: 0,
      cityIntegrity: 100,
      roundsCompleted: 0,
      activeTerms: [],
      currentTarget: null,
      allPairs: [],
      remainingTargets: [],
      correctTerms: [],
      mode: DEFAULT_GAME_MODE,
      leftPressed: false,
      rightPressed: false,
      car: null,
      activeBannerSets: [],
      lastBannerSpawnAt: 0,
      beam: null,
      pulseAt: 0,
      modeChangeRestartRequired: false,
      nextRoundAt: 0,
      lastNow: performance.now()
    };
  }

  function buildLaneCenters() {
    const padding = Math.ceil(INVADER_WIDTH / 2) + 24;
    const width = CANVAS_WIDTH - padding * 2;
    const step = width / (LANE_COUNT - 1);
    return Array.from({ length: LANE_COUNT }, (_, lane) => padding + lane * step);
  }

  function bindEvents() {
    els.selectAllTopicsBtn.addEventListener("click", () => {
      state.selectedTopics = new Set(Object.keys(state.topicsMap));
      renderTopicList();
    });

    els.helpBtn.addEventListener("click", openHelpModal);
    els.helpCloseBtn.addEventListener("click", () => closeHelpModal(true));
    els.helpModal.addEventListener("click", (event) => {
      if (event.target === els.helpModal) {
        closeHelpModal(true);
      }
    });

    els.clearTopicsBtn.addEventListener("click", () => {
      state.selectedTopics.clear();
      renderTopicList();
    });

    els.termsFileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      await loadTermsFromUserFile(file);
      event.target.value = "";
    });

    [els.gameMode, els.choicesPerRound, els.fallSpeed, els.reduceMotion, els.highContrast].forEach((control) => {
      control.addEventListener("focus", () => {
        pauseForSettingsEdit();
      });
    });

    els.gameMode.addEventListener("change", () => {
      const activeMission = state.game.running && !state.game.gameOver;
      if (activeMission) {
        pauseForSettingsEdit();
        const selectedMode = els.gameMode.value || DEFAULT_GAME_MODE;
        persistSettings();
        if (selectedMode !== state.game.mode) {
          setModeChangeRestartRequired(true);
          // Keep current mission HUD/help aligned to the active mode while restart is required.
          updateModeUI(state.game.mode);
          announce("Game paused. Game mode change requires starting a new mission. Press Start Mission to restart, or switch back to the current mode to unlock Resume.");
          return;
        }

        if (state.game.modeChangeRestartRequired) {
          setModeChangeRestartRequired(false);
          restoreDefinitionForCurrentMission();
          announce("Game mode switch canceled. Press Resume to continue current mission.");
          return;
        }

        updateModeUI(state.game.mode);
        announce("Game paused. Current mission mode is unchanged.");
        return;
      }
      updateModeUI(els.gameMode.value);
      persistSettings();
    });

    els.choicesPerRound.addEventListener("change", () => {
      const activeMission = state.game.running && !state.game.gameOver;
      if (activeMission) {
        pauseForSettingsEdit();
        const resetNow = resetWaveForMidMissionSettingsChange();
        announce(resetNow
          ? "Game paused. Choices per round updated and current wave reset. Press Resume to continue."
          : "Game paused. Choices per round updated for upcoming rounds.");
      }
      persistSettings();
    });

    els.fallSpeed.addEventListener("change", () => {
      const activeMission = state.game.running && !state.game.gameOver;
      if (activeMission) {
        pauseForSettingsEdit();
        const resetNow = resetWaveForMidMissionSettingsChange();
        announce(resetNow
          ? "Game paused. Speed updated and current wave reset. Press Resume to continue."
          : "Game paused. Speed updated for upcoming terms.");
      }
      persistSettings();
    });

    els.initials.addEventListener("blur", () => {
      els.initials.value = sanitizeInitials(els.initials.value);
      persistSettings();
    });

    els.reduceMotion.addEventListener("change", () => {
      const activeMission = state.game.running && !state.game.gameOver;
      if (activeMission) {
        pauseForSettingsEdit();
        announce("Game paused. Reduced Motion setting updated.");
      }
      persistSettings();
    });

    els.highContrast.addEventListener("change", () => {
      const activeMission = state.game.running && !state.game.gameOver;
      if (activeMission) {
        pauseForSettingsEdit();
        announce("Game paused. High Contrast setting updated.");
      }
      document.body.classList.toggle("high-contrast", els.highContrast.checked);
      persistSettings();
    });

    els.startBtn.addEventListener("click", startMission);
    els.pauseBtn.addEventListener("click", togglePause);
    els.skipBtn.addEventListener("click", skipDefinition);
    els.leftBtn.addEventListener("click", moveLeftControl);
    els.rightBtn.addEventListener("click", moveRightControl);
    els.fireBtn.addEventListener("click", fireAtSelectedLane);
    els.clearScoresBtn.addEventListener("click", clearScores);
    els.canvas.addEventListener("click", handleCanvasClick);

    document.addEventListener("keydown", (event) => {
      if (state.helpOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeHelpModal(true);
          return;
        }
        if (event.key === "Tab") {
          trapHelpFocus(event);
          return;
        }
        return;
      }

      const openHelpShortcut = !isTypingElement(event.target) && (event.key === "F1" || (event.key === "?" && event.shiftKey));
      if (openHelpShortcut) {
        event.preventDefault();
        openHelpModal();
        return;
      }

      if (!state.game.running || state.game.gameOver || isTypingElement(event.target)) {
        return;
      }
      const key = event.key;
      if (key >= "1" && key <= "3" && state.game.mode === "classic") {
        event.preventDefault();
        selectLane(Number(key) - 1);
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        moveLeftControl(true);
      } else if (key === "ArrowRight") {
        event.preventDefault();
        moveRightControl(true);
      } else if (key === " " || key === "Enter") {
        if (state.game.mode === "classic") {
          event.preventDefault();
          fireAtSelectedLane();
        }
      } else if (key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
      } else if (key.toLowerCase() === "k") {
        event.preventDefault();
        skipDefinition();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (state.game.mode !== "banner_drive") {
        return;
      }
      if (event.key === "ArrowLeft") {
        state.game.leftPressed = false;
      } else if (event.key === "ArrowRight") {
        state.game.rightPressed = false;
      }
    });
  }

  function openHelpModal() {
    if (state.helpOpen || !els.helpModal) {
      return;
    }
    state.helpAutoPaused = false;
    if (state.game.running && !state.game.gameOver && !state.game.paused) {
      state.game.paused = true;
      state.helpAutoPaused = true;
      els.pauseBtn.textContent = "Resume";
    }
    state.helpOpen = true;
    state.lastFocusedElement = document.activeElement;
    els.helpModal.classList.remove("hidden");
    if (els.helpBtn) {
      els.helpBtn.setAttribute("aria-expanded", "true");
    }
    document.body.style.overflow = "hidden";
    if (els.helpCloseBtn) {
      els.helpCloseBtn.focus();
    }
    announce("Help opened.");
  }

  function closeHelpModal(restoreFocus) {
    if (!state.helpOpen || !els.helpModal) {
      return;
    }
    state.helpOpen = false;
    els.helpModal.classList.add("hidden");
    if (els.helpBtn) {
      els.helpBtn.setAttribute("aria-expanded", "false");
    }
    document.body.style.overflow = "";
    if (state.helpAutoPaused && state.game.running && !state.game.gameOver) {
      state.game.paused = false;
      state.game.lastNow = performance.now();
      els.pauseBtn.textContent = "Pause";
    }
    state.helpAutoPaused = false;
    if (restoreFocus && state.lastFocusedElement && typeof state.lastFocusedElement.focus === "function") {
      state.lastFocusedElement.focus();
    }
    announce("Help closed.");
  }

  function trapHelpFocus(event) {
    const focusables = els.helpModal.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (!focusables.length) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initializeSettingsUI() {
    const reduceBySystem = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    els.reduceMotion.checked = state.settings.reduceMotion ?? reduceBySystem;
    els.highContrast.checked = true;
    els.gameMode.value = state.settings.gameMode || DEFAULT_GAME_MODE;
    els.choicesPerRound.value = String(state.settings.choicesPerRound || DEFAULT_CHOICES_PER_ROUND);
    els.fallSpeed.value = state.settings.fallSpeed || DEFAULT_FALL_SPEED;
    if (state.settings.initials) {
      els.initials.value = state.settings.initials;
    }
    document.body.classList.toggle("high-contrast", true);
    updateModeUI(els.gameMode.value);
  }

  function updateModeUI(mode) {
    const selectedMode = mode || DEFAULT_GAME_MODE;
    const isClassic = selectedMode === "classic";
    els.laneControlsSection.classList.toggle("hidden", false);
    els.cityHudItem.classList.toggle("hidden", !isClassic);
    els.fireBtn.disabled = !state.game.running || !isClassic;
    if (isClassic) {
      els.helpText.innerHTML = "Use Left/Right controls, <kbd>1</kbd> to <kbd>3</kbd>, or arrow keys to select a lane. Press Fire, <kbd>Enter</kbd>, or <kbd>Space</kbd> to shoot. Use <kbd>P</kbd> to pause and <kbd>K</kbd> to skip definition.";
    } else {
      els.helpText.innerHTML = "Use Left/Right controls or <kbd>Left</kbd>/<kbd>Right</kbd> arrows to steer smoothly. Guide the car under the correct banner. Use <kbd>P</kbd> to pause and <kbd>K</kbd> to skip current set.";
    }
  }

  async function loadTermsFromUserFile(file) {
    let text = "";
    try {
      text = await file.text();
    } catch {
      announce("Could not read that file. Please choose a valid .txt file.", true);
      setTermsSourceIndicator("error");
      return;
    }

    const parsed = parseTermsText(text);
    if (!Object.keys(parsed.topics).length) {
      announce("No valid topics found in that file. Check #Topic and Term: Definition format.", true);
      setTermsSourceIndicator("error");
      return;
    }

    state.topicsMap = parsed.topics;
    const topics = Object.keys(parsed.topics);
    state.selectedTopics = new Set(topics.length ? [topics[0]] : []);
    renderTopicList();
    updateStartAvailability();
    setTermsSourceIndicator("file", file.name || "custom_terms.txt");
    announce(`Loaded ${topics.length} topics from ${file.name || "selected file"}. First topic preselected.`);
  }

  function setTermsSourceIndicator(sourceType, label) {
    if (!els.termsSourceIndicator) {
      return;
    }
    if (sourceType === "error") {
      els.termsSourceIndicator.textContent = "Term Source: load failed (choose a valid .txt file)";
      els.termsSourceIndicator.dataset.source = "error";
      return;
    }
    if (sourceType === "none") {
      els.termsSourceIndicator.textContent = "Term Source: no terms file loaded";
      els.termsSourceIndicator.dataset.source = "none";
      return;
    }
    els.termsSourceIndicator.textContent = `Term Source: loaded file (${label || "terms.txt"})`;
    els.termsSourceIndicator.dataset.source = "file";
  }

  function updateStartAvailability() {
    if (state.game.running) {
      return;
    }
    const hasTerms = Object.keys(state.topicsMap).length > 0;
    els.startBtn.disabled = !hasTerms;
  }

  function parseTermsText(text) {
    const topics = {};
    let currentTopic = "";
    const lines = text.replace(/\r\n/g, "\n").split("\n");

    for (const rawLine of lines) {
      const cleaned = repairMojibake(rawLine).trim();
      if (!cleaned) {
        continue;
      }
      if (cleaned.startsWith("#")) {
        currentTopic = cleaned.slice(1).trim();
        if (currentTopic && !topics[currentTopic]) {
          topics[currentTopic] = [];
        }
        continue;
      }
      if (!currentTopic) {
        continue;
      }
      const splitIndex = cleaned.indexOf(":");
      if (splitIndex <= 0) {
        continue;
      }
      const term = repairMojibake(cleaned.slice(0, splitIndex).trim());
      const definition = repairMojibake(cleaned.slice(splitIndex + 1).trim());
      if (!term || !definition) {
        continue;
      }
      topics[currentTopic].push({ topic: currentTopic, term, definition });
    }

    for (const topic of Object.keys(topics)) {
      if (!topics[topic].length) {
        delete topics[topic];
      }
    }
    return { topics };
  }
  function repairMojibake(text) {
    let value = String(text || "");
    if (/[ÃâÂ]/.test(value)) {
      try {
        value = decodeURIComponent(escape(value));
      } catch {
        // keep original
      }
    }
    return value
      .replace(/â€“/g, "–")
      .replace(/â€”/g, "—")
      .replace(/â€˜/g, "‘")
      .replace(/â€™/g, "’")
      .replace(/â€œ/g, "“")
      .replace(/â€�/g, "”")
      .replace(/Â©/g, "©")
      .replace(/Â/g, "");
  }

  function renderTopicList() {
    els.topicList.innerHTML = "";
    const topicNames = Object.keys(state.topicsMap);
    if (!topicNames.length) {
      const p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No topics loaded yet.";
      els.topicList.appendChild(p);
      return;
    }

    topicNames.forEach((topicName, index) => {
      const id = `topic-${index}`;
      const label = document.createElement("label");
      label.className = "topic-item";
      label.setAttribute("for", id);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = state.selectedTopics.has(topicName);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selectedTopics.add(topicName);
        } else {
          state.selectedTopics.delete(topicName);
        }
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${topicName} (${state.topicsMap[topicName].length} terms)`));
      els.topicList.appendChild(label);
    });
  }

  function selectLane(lane) {
    state.game.selectedLane = Math.max(0, Math.min(LANE_COUNT - 1, lane));
  }

  function moveLeftControl(fromKeyboard) {
    if (!state.game.running || state.game.gameOver || state.game.paused) {
      return;
    }
    if (state.game.mode === "classic") {
      selectLane(Math.max(0, state.game.selectedLane - 1));
      return;
    }
    if (fromKeyboard) {
      state.game.leftPressed = true;
      return;
    }
    if (state.game.car) {
      state.game.car.x -= 92;
      state.game.car.vx = 0;
      state.game.car.x = Math.max(state.game.car.width / 2 + 12, state.game.car.x);
    }
  }

  function moveRightControl(fromKeyboard) {
    if (!state.game.running || state.game.gameOver || state.game.paused) {
      return;
    }
    if (state.game.mode === "classic") {
      selectLane(Math.min(LANE_COUNT - 1, state.game.selectedLane + 1));
      return;
    }
    if (fromKeyboard) {
      state.game.rightPressed = true;
      return;
    }
    if (state.game.car) {
      state.game.car.x += 92;
      state.game.car.vx = 0;
      state.game.car.x = Math.min(CANVAS_WIDTH - state.game.car.width / 2 - 12, state.game.car.x);
    }
  }

  function startMission() {
    if (!Object.keys(state.topicsMap).length) {
      announce("Load a terms .txt file before starting a mission.", true);
      return;
    }
    const pairs = buildSelectedPairs();
    if (!pairs.length) {
      announce("Select at least one topic with terms before starting.", true);
      return;
    }

    els.initials.value = sanitizeInitials(els.initials.value);
    persistSettings();

    state.game = createGameState();
    state.game.running = true;
    state.game.mode = els.gameMode.value || DEFAULT_GAME_MODE;
    state.game.selectedLane = DEFAULT_CLASSIC_START_LANE;
    state.game.lastNow = performance.now();
    state.game.allPairs = pairs.slice();
    state.game.remainingTargets = shuffle(pairs.slice());
    state.game.nextRoundAt = performance.now();
    state.game.correctTerms = [];
    state.game.leftPressed = false;
    state.game.rightPressed = false;
    state.game.activeBannerSets = [];
    state.game.lastBannerSpawnAt = 0;
    state.game.car = null;

    if (state.game.mode === "classic") {
      setDefinitionText("Preparing first wave...");
    } else {
      state.game.car = {
        x: laneCenters[DEFAULT_CLASSIC_START_LANE],
        y: Math.round(CANVAS_HEIGHT * 0.7),
        width: 58,
        height: 102,
        vx: 0,
        accel: 1400,
        maxSpeed: 720
      };
      state.game.lastBannerSpawnAt = performance.now() - getBannerSpawnInterval();
      setDefinitionText("Preparing first banner set...");
    }

    toggleGameButtons(true);
    selectLane(DEFAULT_CLASSIC_START_LANE);
    updateModeUI(state.game.mode);
    if (state.game.mode === "classic") {
      startNextRound(performance.now());
    } else {
      spawnBannerSet(performance.now());
    }
    updateHud();
    renderCorrectTerms();
    announce("Mission started. Match the definition to the correct term.");
    els.canvas.focus();
  }

  function buildSelectedPairs() {
    const selected = Array.from(state.selectedTopics);
    const pairs = [];
    selected.forEach((topic) => {
      (state.topicsMap[topic] || []).forEach((pair) => pairs.push(pair));
    });
    return pairs;
  }

  function pauseForSettingsEdit() {
    if (!state.game.running || state.game.gameOver || state.game.paused) {
      return false;
    }
    state.game.paused = true;
    els.pauseBtn.textContent = "Resume";
    return true;
  }

  function setModeChangeRestartRequired(isRequired) {
    state.game.modeChangeRestartRequired = !!isRequired;
    if (!state.game.running || state.game.gameOver) {
      return;
    }
    if (state.game.modeChangeRestartRequired) {
      state.game.paused = true;
      els.pauseBtn.disabled = true;
      els.pauseBtn.textContent = "Restart Required";
      setDefinitionText("Mode change selected. Start Mission to switch modes, or switch back to continue this mission.");
      return;
    }
    els.pauseBtn.disabled = false;
    els.pauseBtn.textContent = state.game.paused ? "Resume" : "Pause";
  }

  function restoreDefinitionForCurrentMission() {
    if (state.game.mode === "banner_drive") {
      updateBannerDefinition();
      return;
    }
    if (state.game.currentTarget && state.game.currentTarget.definition) {
      setDefinitionText(state.game.currentTarget.definition);
      return;
    }
    if (state.game.activeTerms.length) {
      setNextClassicTargetFromActiveTerms();
      return;
    }
    setDefinitionText("Loading next wave...");
  }

  function resetWaveForMidMissionSettingsChange() {
    if (!state.game.running || state.game.gameOver) {
      return false;
    }
    if (state.game.mode === "classic") {
      if (!state.game.activeTerms.length) {
        return false;
      }
      const unresolvedTerms = state.game.activeTerms.filter((term) => term.state !== "correct_flash");
      if (!unresolvedTerms.length) {
        return false;
      }
      unresolvedTerms.forEach((term) => reinsertTarget(term.pair));
      state.game.activeTerms = [];
      state.game.currentTarget = null;
      state.game.nextRoundAt = performance.now();
      setDefinitionText("Settings updated. Wave will restart when you resume.");
      updateHud();
      return true;
    }

    const unresolvedSets = state.game.activeBannerSets.filter((set) => !set.evaluated);
    if (!unresolvedSets.length) {
      return false;
    }
    unresolvedSets.forEach((set) => reinsertTarget(set.target));
    state.game.activeBannerSets = state.game.activeBannerSets.filter((set) => set.evaluated);
    state.game.currentTarget = null;
    state.game.lastBannerSpawnAt = performance.now() - getBannerSpawnInterval();
    updateBannerDefinition();
    updateHud();
    return true;
  }

  function togglePause() {
    if (!state.game.running || state.game.gameOver) {
      return;
    }
    if (state.game.modeChangeRestartRequired) {
      announce("Resume is locked because game mode changed. Press Start Mission to switch modes, or switch back to the current mode to resume.");
      return;
    }
    state.game.paused = !state.game.paused;
    els.pauseBtn.textContent = state.game.paused ? "Resume" : "Pause";
    announce(state.game.paused ? "Game paused." : "Game resumed.");
    if (!state.game.paused) {
      state.game.lastNow = performance.now();
      els.canvas.focus();
    }
  }

  function skipDefinition() {
    if (!state.game.running || state.game.gameOver || state.game.paused) {
      return;
    }
    if (state.game.mode === "classic") {
      if (!state.game.currentTarget) {
        return;
      }
      state.game.score = Math.max(0, state.game.score - ROUND_CONFIG.skipScorePenalty);
      endCurrentRound("skipped");
      updateHud();
      announce("Wave skipped. New wave starting.");
      return;
    }
    // Banner Drive: skip nearest unresolved banner set and keep its definition in play.
    const leadSet = getLeadBannerSet();
    if (!leadSet) {
      return;
    }
    state.game.score = Math.max(0, state.game.score - ROUND_CONFIG.skipScorePenalty);
    reinsertTarget(leadSet.target);
    leadSet.evaluated = true;
    leadSet.evaluatedAt = performance.now();
    leadSet.result = "miss";
    leadSet.chosenBannerIndex = -1;
    updateHud();
    updateBannerDefinition();
    announce("Current banner set skipped.");
  }

  function fireAtSelectedLane() {
    if (state.game.mode !== "classic") {
      return;
    }
    if (!state.game.running || state.game.gameOver || state.game.paused || !state.game.currentTarget) {
      return;
    }

    const lane = state.game.selectedLane;
    const term = state.game.activeTerms.find((item) => item.lane === lane);
    if (!term) {
      createBeam(lane, false);
      state.game.score = Math.max(0, state.game.score - ROUND_CONFIG.missScorePenalty);
      updateHud();
      announce(`No term in lane ${lane + 1}.`);
      return;
    }

    if (term.state !== "active" || state.game.currentTarget.state !== "active") {
      return;
    }

    const now = performance.now();
    const isCorrect = term.id === state.game.currentTarget.id;
    createBeam(lane, isCorrect);
    if (isCorrect) {
      state.game.score += 100;
      state.game.roundsCompleted += 1;
      state.game.correctTerms.push(term.term);
      state.game.pulseAt = now;
      renderCorrectTerms();
      term.state = "correct_flash";
      term.stateUntil = now + 500;
      updateHud();
      announce("Correct match.");
      return;
    }

    state.game.score = Math.max(0, state.game.score - ROUND_CONFIG.wrongScorePenalty);
    term.state = "wrong_flash";
    term.stateUntil = now + 500;
    updateHud();
    announce("Incorrect term. Try again.");
  }

  function endCurrentRound(reason, options) {
    const unresolvedTerms = state.game.activeTerms.filter((term) => term.state !== "correct_flash");
    state.game.activeTerms = [];
    state.game.currentTarget = null;
    const delay = els.reduceMotion.checked ? 80 : ROUND_CONFIG.roundSettleMs;
    state.game.nextRoundAt = performance.now() + delay;
    if (reason !== "correct") {
      // Keep unanswered definitions in the pool for later waves.
      unresolvedTerms.forEach((term) => reinsertTarget(term.pair));
    }
    if (reason === "breach") {
      const breaches = Math.max(1, Number(options && options.breachCount) || 1);
      state.game.cityIntegrity = Math.max(0, state.game.cityIntegrity - ROUND_CONFIG.breachIntegrityPenalty * breaches);
    }
    setDefinitionText(reason === "breach" ? "Wave missed. New set incoming..." : "Loading next wave...");
    checkForGameEnd();
  }

  function startNextRound(now) {
    if (!state.game.running || state.game.gameOver || state.game.paused || state.game.activeTerms.length) {
      return;
    }
    if (now < state.game.nextRoundAt) {
      return;
    }
    if (!state.game.remainingTargets.length) {
      finishMission(true);
      return;
    }

    const choiceCount = Math.max(2, Math.min(3, Number(els.choicesPerRound.value) || DEFAULT_CHOICES_PER_ROUND));
    const waveSize = Math.min(choiceCount, state.game.remainingTargets.length);
    const wavePairs = [];
    for (let i = 0; i < waveSize; i += 1) {
      wavePairs.push(state.game.remainingTargets.pop());
    }
    const lanes = shuffle([0, 1, 2]).slice(0, wavePairs.length);
    const speed = scaledFallSpeed();

    state.game.activeTerms = wavePairs.map((pair, idx) => ({
      id: cryptoRandomId(),
      lane: lanes[idx],
      pair,
      term: pair.term,
      definition: pair.definition,
      y: START_Y,
      speed,
      state: "active",
      stateUntil: 0
    }));

    setNextClassicTargetFromActiveTerms();
    updateHud();
  }

  function setNextClassicTargetFromActiveTerms() {
    if (!state.game.activeTerms.length) {
      state.game.currentTarget = null;
      setDefinitionText("Loading next wave...");
      return;
    }
    const targetIndex = Math.floor(Math.random() * state.game.activeTerms.length);
    state.game.currentTarget = state.game.activeTerms[targetIndex];
    setDefinitionText(state.game.currentTarget.definition);
  }

  function buildDistractors(target, needed) {
    const pool = state.game.allPairs.filter((pair) => pair.term !== target.term);
    const picked = [];
    const usedTerms = new Set([target.term]);
    const shuffled = shuffle(pool.slice());
    for (const pair of shuffled) {
      if (picked.length >= needed) {
        break;
      }
      if (usedTerms.has(pair.term)) {
        continue;
      }
      picked.push(pair);
      usedTerms.add(pair.term);
    }
    return picked;
  }

  function getBannerSpawnInterval() {
    const speed = scaledBannerSpeed();
    return Math.max(280, 860 - speed * 11);
  }

  function spawnBannerSet(now) {
    if (!state.game.running || state.game.gameOver || state.game.paused) {
      return false;
    }
    if (!state.game.remainingTargets.length) {
      return false;
    }
    // Spawn a new set once all on-screen sets have been judged.
    const unresolvedOnScreen = state.game.activeBannerSets.some((set) => !set.evaluated);
    if (unresolvedOnScreen) {
      return false;
    }
    if (now - state.game.lastBannerSpawnAt < getBannerSpawnInterval()) {
      return false;
    }

    const target = state.game.remainingTargets.pop();
    const choiceCount = Math.max(2, Math.min(3, Number(els.choicesPerRound.value) || DEFAULT_CHOICES_PER_ROUND));
    const distractors = buildDistractors(target, choiceCount - 1);
    const roundPairs = shuffle([target, ...distractors]);
    const lanePool = shuffle([0, 1, 2]).slice(0, roundPairs.length);
    const gateY = state.game.car
      ? state.game.car.y - state.game.car.height / 2 + 14
      : Math.round(CANVAS_HEIGHT * 0.58);
    const speed = scaledBannerSpeed();

    const set = {
      id: cryptoRandomId(),
      target,
      definition: target.definition,
      y: -160,
      prevY: -160,
      gateY,
      speed,
      evaluated: false,
      evaluatedAt: 0,
      result: "pending",
      chosenBannerIndex: -1,
      banners: roundPairs.map((pair, index) => {
        const lane = lanePool[index];
        const center = laneCenters[lane];
        const width = 220;
        return {
          lane,
          term: pair.term,
          isCorrect: pair.term === target.term,
          left: center - width / 2,
          right: center + width / 2
        };
      })
    };

    state.game.activeBannerSets.push(set);
    state.game.lastBannerSpawnAt = now;
    updateBannerDefinition();
    updateHud();
    return true;
  }

  function getLeadBannerSet() {
    const unresolved = state.game.activeBannerSets.filter((set) => !set.evaluated);
    if (!unresolved.length) {
      return null;
    }
    return unresolved.sort((a, b) => b.y - a.y)[0];
  }

  function updateBannerDefinition() {
    const leadSet = getLeadBannerSet();
    if (!leadSet) {
      state.game.currentTarget = null;
      if (state.game.remainingTargets.length) {
        setDefinitionText("Waiting for next banner set...");
      } else {
        setDefinitionText("No remaining definitions.");
      }
      return;
    }
    state.game.currentTarget = leadSet.target;
    setDefinitionText(leadSet.definition);
  }

  function reinsertTarget(target) {
    if (!target) {
      return;
    }
    const insertAt = Math.floor(Math.random() * (state.game.remainingTargets.length + 1));
    state.game.remainingTargets.splice(insertAt, 0, target);
  }

  function evaluateBannerSet(set) {
    if (set.evaluated || !state.game.car) {
      return;
    }
    set.evaluated = true;
    set.evaluatedAt = performance.now();
    const carX = state.game.car.x;
    const bannerIndex = set.banners.findIndex((banner) => carX >= banner.left && carX <= banner.right);
    set.chosenBannerIndex = bannerIndex;
    const bannerUnderCar = bannerIndex >= 0 ? set.banners[bannerIndex] : null;

    if (bannerUnderCar && bannerUnderCar.isCorrect) {
      set.result = "correct";
      state.game.score += 100;
      state.game.roundsCompleted += 1;
      state.game.correctTerms.push(set.target.term);
      state.game.pulseAt = performance.now();
      renderCorrectTerms();
      announce("Correct banner gate.");
    } else {
      set.result = bannerUnderCar ? "wrong" : "miss";
      const penalty = bannerUnderCar ? ROUND_CONFIG.wrongScorePenalty : ROUND_CONFIG.missScorePenalty;
      state.game.score = Math.max(0, state.game.score - penalty);
      reinsertTarget(set.target);
      if (bannerUnderCar) {
        announce("Wrong banner gate.");
      } else {
        announce("Missed all banners.");
      }
    }
    updateHud();
    updateBannerDefinition();
  }

  function scaledFallSpeed() {
    const selected = els.fallSpeed.value || DEFAULT_FALL_SPEED;
    const multiplier = FALL_SPEED_MULTIPLIER[selected] || FALL_SPEED_MULTIPLIER.normal;
    return 18 * multiplier;
  }

  function scaledBannerSpeed() {
    return scaledFallSpeed() * BANNER_SPEED_BOOST;
  }

  function checkForGameEnd() {
    if (state.game.cityIntegrity <= 0) {
      finishMission(false);
    }
  }

  function finishMission(won) {
    if (state.game.gameOver) {
      return;
    }
    state.game.gameOver = true;
    state.game.running = false;
    state.game.won = won;
    state.game.activeTerms = [];
    state.game.currentTarget = null;
    toggleGameButtons(false);
    saveScore();
    announce(`${won ? "Mission complete" : "City overrun"}. Final score ${state.game.score}.`, true);
  }

  function saveScore() {
    const entry = {
      initials: sanitizeInitials(els.initials.value),
      score: state.game.score,
      topics: Array.from(state.selectedTopics).sort().join(" | ").slice(0, 100) || "No topic",
      result: state.game.won ? "Win" : "Loss",
      date: new Date().toISOString()
    };
    state.scoreboard.unshift(entry);
    state.scoreboard.sort((a, b) => b.score - a.score);
    state.scoreboard = state.scoreboard.slice(0, 3);
    storageSet(SCOREBOARD_KEY, JSON.stringify(state.scoreboard));
    renderScoreboard();
  }

  function clearScores() {
    state.scoreboard = [];
    storageSet(SCOREBOARD_KEY, JSON.stringify([]));
    renderScoreboard();
    announce("Scores cleared.");
  }

  function renderScoreboard() {
    els.scoresList.innerHTML = "";
    if (!state.scoreboard.length) {
      const li = document.createElement("li");
      li.className = "scores-empty";
      li.textContent = "No scores yet.";
      els.scoresList.appendChild(li);
      return;
    }
    state.scoreboard.forEach((entry) => {
      const li = document.createElement("li");
      const date = new Date(entry.date);
      const dateText = Number.isNaN(date.getTime()) ? "" : ` on ${date.toLocaleDateString()}`;
      li.textContent = `${entry.initials} - ${entry.score} (${entry.result}) [${entry.topics}]${dateText}`;
      els.scoresList.appendChild(li);
    });
  }

  function renderCorrectTerms() {
    els.correctTermsList.innerHTML = "";
    if (!state.game.correctTerms.length) {
      const li = document.createElement("li");
      li.className = "scores-empty";
      li.textContent = "No correct terms yet this mission.";
      els.correctTermsList.appendChild(li);
      return;
    }
    state.game.correctTerms.forEach((term) => {
      const li = document.createElement("li");
      li.textContent = term;
      els.correctTermsList.appendChild(li);
    });
  }

  function updateStorageNote() {
    if (!els.scoreStorageNote) {
      return;
    }
    els.scoreStorageNote.textContent = storage.enabled
      ? "Scores are stored in this browser only."
      : "Local storage is blocked by browser privacy settings. Scores will not persist after closing.";
  }

  function updateHud() {
    const unresolvedActive = state.game.activeTerms.filter((term) => term.state !== "correct_flash").length;
    let targetsLeft = state.game.remainingTargets.length + unresolvedActive;
    if (state.game.mode === "banner_drive") {
      const unresolvedSets = state.game.activeBannerSets.filter((set) => !set.evaluated).length;
      targetsLeft = state.game.remainingTargets.length + unresolvedSets;
    }
    els.scoreText.textContent = String(state.game.score);
    els.cityText.textContent = `${Math.round(state.game.cityIntegrity)}%`;
    els.cityText.style.color = getCityIntegrityColor(state.game.cityIntegrity);
    els.remainingText.textContent = String(targetsLeft);
  }

  function getCityIntegrityColor(integrity) {
    if (integrity > 66) {
      return "#3adf7d";
    }
    if (integrity > 33) {
      return "#ffbf4d";
    }
    return "#ff677d";
  }

  function setDefinitionText(text) {
    els.definitionText.textContent = text;
  }

  function toggleGameButtons(isRunning) {
    els.pauseBtn.disabled = !isRunning;
    els.skipBtn.disabled = !isRunning;
    els.leftBtn.disabled = !isRunning;
    els.rightBtn.disabled = !isRunning;
    els.fireBtn.disabled = !isRunning || state.game.mode !== "classic";
    els.pauseBtn.textContent = "Pause";
  }

  function announce(message, assertive) {
    if (!message) {
      return;
    }
    if (assertive) {
      els.liveRegion.textContent = "";
      setTimeout(() => {
        els.liveRegion.textContent = message;
      }, 20);
      return;
    }
    els.liveRegion.textContent = message;
  }

  function loop(now) {
    const deltaMs = now - state.game.lastNow;
    state.game.lastNow = now;

    if (state.game.running && !state.game.paused && !state.game.gameOver) {
      updateGame(now, deltaMs);
    }
    drawGame(now);
    requestAnimationFrame(loop);
  }

  function updateGame(now, deltaMs) {
    if (state.game.mode === "banner_drive") {
      updateBannerDriveGame(now, deltaMs);
      return;
    }

    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));
    const breachY = CITY_LINE_Y - INVADER_HEIGHT;

    if (state.game.activeTerms.length) {
      state.game.activeTerms.forEach((term) => {
        if (term.state !== "correct_flash") {
          term.y += term.speed * deltaSeconds;
        }
        if (term.state === "wrong_flash" && now >= term.stateUntil) {
          term.state = "active";
          term.stateUntil = 0;
        }
      });

      const resolvedNow = state.game.activeTerms.filter((term) => term.state === "correct_flash" && now >= term.stateUntil);
      if (resolvedNow.length) {
        const resolvedIds = new Set(resolvedNow.map((term) => term.id));
        state.game.activeTerms = state.game.activeTerms.filter((term) => !resolvedIds.has(term.id));
        if (!state.game.activeTerms.length) {
          announce("Wave cleared.");
          endCurrentRound("correct");
          updateHud();
          return;
        }
        setNextClassicTargetFromActiveTerms();
        updateHud();
      }

      const breachedCount = state.game.activeTerms.filter((term) => term.state !== "correct_flash" && term.y >= breachY).length;
      if (breachedCount > 0) {
        announce("Wave missed. Terms reached the city.", true);
        endCurrentRound("breach", { breachCount: breachedCount });
        updateHud();
        return;
      }
    }

    if (!state.game.activeTerms.length) {
      startNextRound(now);
    }
  }

  function updateBannerDriveGame(now, deltaMs) {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));

    if (state.game.car) {
      const car = state.game.car;
      if (state.game.leftPressed) {
        car.vx -= car.accel * deltaSeconds;
      }
      if (state.game.rightPressed) {
        car.vx += car.accel * deltaSeconds;
      }
      if (!state.game.leftPressed && !state.game.rightPressed) {
        car.vx *= Math.max(0, 1 - 7 * deltaSeconds);
      }
      car.vx = Math.max(-car.maxSpeed, Math.min(car.maxSpeed, car.vx));
      car.x += car.vx * deltaSeconds;
      const minX = car.width / 2 + 12;
      const maxX = CANVAS_WIDTH - car.width / 2 - 12;
      car.x = Math.max(minX, Math.min(maxX, car.x));
      if (car.x === minX || car.x === maxX) {
        car.vx = 0;
      }
    }

    for (const set of state.game.activeBannerSets) {
      set.prevY = set.y;
      set.y += set.speed * deltaSeconds;
      if (!set.evaluated && set.prevY < set.gateY && set.y >= set.gateY) {
        evaluateBannerSet(set);
      }
    }

    state.game.activeBannerSets = state.game.activeBannerSets.filter((set) => set.y < CANVAS_HEIGHT + 220);

    spawnBannerSet(now);

    if (state.game.remainingTargets.length === 0 && state.game.activeBannerSets.length === 0) {
      finishMission(true);
      return;
    }

    if (state.game.cityIntegrity <= 0) {
      finishMission(false);
    }
  }

  function drawGame(now) {
    drawArenaBackground();
    if (state.game.mode === "classic") {
      drawLaneHighlights();
      drawLaneGuides();
      drawCity();
      drawCannon();
    } else {
      drawBannerRoadMarks();
    }
    if (state.game.mode === "classic") {
      drawTerms(now);
      drawBeam(now);
    } else {
      drawBannerSets(now);
      drawCar();
    }
    drawTopOverlay(now);
    if (state.game.paused) {
      drawPausedOverlay();
    }
    if (state.game.gameOver) {
      drawGameOverOverlay();
    }
  }

  function drawArenaBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#050d18");
    gradient.addColorStop(0.5, "#0d1f33");
    gradient.addColorStop(1, "#152638");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 197) % CANVAS_WIDTH;
      const y = (i * 113) % 300;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawBannerRoadMarks() {
    ctx.save();
    ctx.fillStyle = "rgba(7, 16, 30, 0.55)";
    ctx.fillRect(0, 45, CANVAS_WIDTH, CANVAS_HEIGHT - 90);
    ctx.strokeStyle = "rgba(90,153,210,0.35)";
    ctx.lineWidth = 1.5;
    laneCenters.forEach((center, index) => {
      if (index > 0) {
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo((laneCenters[index - 1] + center) / 2, 45);
        ctx.lineTo((laneCenters[index - 1] + center) / 2, CANVAS_HEIGHT - 20);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
    if (state.game.car) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, state.game.car.y - 6);
      ctx.lineTo(CANVAS_WIDTH, state.game.car.y - 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLaneHighlights() {
    const center = laneCenters[state.game.selectedLane];
    ctx.fillStyle = "rgba(0, 225, 143, 0.11)";
    ctx.fillRect(center - 130, 40, 260, CITY_LINE_Y - 25);
  }

  function drawLaneGuides() {
    ctx.save();
    laneCenters.forEach((center, lane) => {
      ctx.strokeStyle = lane === state.game.selectedLane ? "rgba(136,255,225,0.8)" : "rgba(90,153,210,0.35)";
      ctx.lineWidth = lane === state.game.selectedLane ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(center, 45);
      ctx.lineTo(center, CITY_LINE_Y - 8);
      ctx.stroke();
      ctx.fillStyle = "#cde9ff";
      ctx.font = "16px 'Lucida Console', 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(lane + 1), center, 30);
    });
    ctx.restore();
  }

  function drawCity() {
    const integrity = state.game.cityIntegrity / 100;
    const red = Math.round(255 - integrity * 120);
    const green = Math.round(60 + integrity * 165);
    ctx.fillStyle = `rgb(${red},${green},90)`;
    ctx.fillRect(0, CITY_LINE_Y, CANVAS_WIDTH, CANVAS_HEIGHT - CITY_LINE_Y);
    ctx.fillStyle = "#f3f6ff";
    ctx.fillRect(0, CITY_LINE_Y, CANVAS_WIDTH, 5);

    for (let x = 10; x < CANVAS_WIDTH; x += 48) {
      const h = 20 + ((x * 7) % 28);
      ctx.fillStyle = "#1f2f46";
      ctx.fillRect(x, CITY_LINE_Y - h, 28, h);
      ctx.fillStyle = "#f8d673";
      ctx.fillRect(x + 4, CITY_LINE_Y - h + 5, 5, 6);
      ctx.fillRect(x + 14, CITY_LINE_Y - h + 14, 5, 6);
    }
  }

  function drawCannon() {
    const x = laneCenters[state.game.selectedLane];
    const baseY = CITY_LINE_Y - 28;
    ctx.save();
    ctx.fillStyle = "#22344c";
    ctx.fillRect(x - 34, baseY, 68, 24);
    ctx.strokeStyle = "#90b8df";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 34, baseY, 68, 24);

    ctx.fillStyle = "#2f4e72";
    ctx.fillRect(x - 12, baseY - 18, 24, 20);
    ctx.strokeRect(x - 12, baseY - 18, 24, 20);

    ctx.fillStyle = "#7f97b0";
    ctx.fillRect(x - 6, baseY - 44, 12, 28);
    ctx.strokeRect(x - 6, baseY - 44, 12, 28);
    ctx.restore();
  }

  function drawTerms(now) {
    ctx.save();
    state.game.activeTerms.forEach((term) => {
      const x = laneCenters[term.lane] - INVADER_WIDTH / 2;
      const y = term.y;
      ctx.fillStyle = "#f3f7ff";
      ctx.fillRect(x, y, INVADER_WIDTH, INVADER_HEIGHT);
      if (term.state === "correct_flash") {
        ctx.strokeStyle = "#28e67e";
        ctx.lineWidth = 5;
      } else if (term.state === "wrong_flash") {
        ctx.strokeStyle = "#ff5d73";
        ctx.lineWidth = 5;
      } else {
        ctx.strokeStyle = "#1f3d5a";
        ctx.lineWidth = 2;
      }
      ctx.strokeRect(x, y, INVADER_WIDTH, INVADER_HEIGHT);

      ctx.fillStyle = "#0f2237";
      ctx.font = "bold 22px 'Trebuchet MS', 'Verdana', sans-serif";
      ctx.textAlign = "center";
      drawWrappedCenteredText(term.term, x + INVADER_WIDTH / 2, y + 30, INVADER_WIDTH - 24, 24, 4);
    });
    ctx.restore();
  }

  function drawBannerSets(now) {
    ctx.save();
    state.game.activeBannerSets.forEach((set) => {
      const alpha = 1;
      const bannerTop = set.y;
      const bannerHeight = 58;
      const poleHeight = 78;

      set.banners.forEach((banner) => {
        const leftPoleX = banner.left + 6;
        const rightPoleX = banner.right - 6;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#8d6930";
        ctx.fillRect(leftPoleX - 4, bannerTop - 8, 8, poleHeight);
        ctx.fillRect(rightPoleX - 4, bannerTop - 8, 8, poleHeight);

        let fill = "#eef4ff";
        if (set.evaluated && set.chosenBannerIndex >= 0 && set.banners[set.chosenBannerIndex] === banner) {
          fill = set.result === "correct" ? "#9cf7b4" : "#ff9fa9";
        }
        ctx.fillStyle = fill;
        ctx.fillRect(banner.left, bannerTop, banner.right - banner.left, bannerHeight);
        ctx.strokeStyle = "#1f3d5a";
        ctx.lineWidth = 2;
        ctx.strokeRect(banner.left, bannerTop, banner.right - banner.left, bannerHeight);

        ctx.fillStyle = "#11253b";
        ctx.font = "bold 20px 'Trebuchet MS', 'Verdana', sans-serif";
        ctx.textAlign = "center";
        drawWrappedCenteredText(
          banner.term,
          (banner.left + banner.right) / 2,
          bannerTop + 22,
          banner.right - banner.left - 16,
          20,
          2
        );
      });
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCar() {
    if (!state.game.car) {
      return;
    }
    const car = state.game.car;
    const x = car.x - car.width / 2;
    const y = car.y - car.height / 2;
    const tailY = y + car.height;
    ctx.save();
    // Top-down car: hood, roof, trunk, plus side wheels.
    ctx.fillStyle = "#f0b449";
    ctx.fillRect(x + 8, y + 6, car.width - 16, car.height - 12);

    ctx.fillStyle = "#e0a53d";
    ctx.fillRect(x + 12, y + 10, car.width - 24, 20);

    ctx.fillStyle = "#1d3652";
    ctx.fillRect(x + 14, y + 34, car.width - 28, 34);

    ctx.fillStyle = "#d49335";
    ctx.fillRect(x + 12, y + 72, car.width - 24, 20);

    ctx.fillStyle = "#0a1422";
    ctx.fillRect(x + 2, y + 20, 7, 18);
    ctx.fillRect(x + car.width - 9, y + 20, 7, 18);
    ctx.fillRect(x + 2, y + 66, 7, 18);
    ctx.fillRect(x + car.width - 9, y + 66, 7, 18);

    ctx.strokeStyle = "#10243a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 8, y + 6, car.width - 16, car.height - 12);

    ctx.fillStyle = "#ffd47d";
    ctx.fillRect(car.x - 10, y + 12, 20, 3);
    ctx.fillStyle = "#6f101a";
    ctx.fillRect(car.x - 10, tailY - 12, 20, 3);
    ctx.restore();
  }

  function drawWrappedCenteredText(text, centerX, topY, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) {
          lines.push(current);
        }
        current = word;
      }
    });
    if (current) {
      lines.push(current);
    }
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let trimmed = lines[maxLines - 1];
      while (trimmed.length > 4 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      lines[maxLines - 1] = `${trimmed}...`;
    }
    lines.forEach((line, index) => {
      ctx.fillText(line, centerX, topY + index * lineHeight);
    });
  }

  function createBeam(lane, success) {
    if (els.reduceMotion.checked) {
      state.game.beam = null;
      return;
    }
    const now = performance.now();
    state.game.beam = {
      lane,
      success,
      startsAt: now,
      endsAt: now + 500
    };
  }

  function drawBeam(now) {
    const beam = state.game.beam;
    if (!beam) {
      return;
    }
    if (now > beam.endsAt) {
      state.game.beam = null;
      return;
    }
    const progress = Math.min(1, (now - beam.startsAt) / (beam.endsAt - beam.startsAt || 1));
    const x = laneCenters[beam.lane];
    const cannonBaseY = CITY_LINE_Y - 28;
    const cannonTipY = cannonBaseY - 44;
    const fromY = cannonTipY;
    const toY = fromY - 92 * progress;
    ctx.save();
    ctx.strokeStyle = beam.success ? "rgba(0,255,145,0.95)" : "rgba(255,90,110,0.95)";
    ctx.lineWidth = beam.success ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(x, fromY);
    ctx.lineTo(x, toY);
    ctx.stroke();
    ctx.restore();
  }

  function drawTopOverlay(now) {
    ctx.save();
    if (!els.reduceMotion.checked && state.game.pulseAt && now - state.game.pulseAt < 340) {
      const alpha = 1 - (now - state.game.pulseAt) / 340;
      ctx.fillStyle = `rgba(0,255,145,${alpha * 0.3})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    ctx.restore();
  }

  function drawPausedOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#f7faff";
    ctx.textAlign = "center";
    ctx.font = "bold 52px 'Lucida Console', 'Courier New', monospace";
    ctx.fillText("PAUSED", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.font = "20px 'Trebuchet MS', 'Verdana', sans-serif";
    if (state.game.modeChangeRestartRequired) {
      ctx.fillText("Mode changed. Press Start Mission to switch modes.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 18);
      ctx.fillText("Or switch back to current mode to unlock Resume.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 48);
    } else {
      ctx.fillText("Press P or Resume to continue", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
    }
    ctx.restore();
  }

  function drawGameOverOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = state.game.won ? "#7cffc8" : "#ff9ba8";
    ctx.textAlign = "center";
    ctx.font = "bold 50px 'Lucida Console', 'Courier New', monospace";
    ctx.fillText(state.game.won ? "MISSION COMPLETE" : "CITY OVERRUN", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);
    ctx.fillStyle = "#f7fbff";
    ctx.font = "20px 'Trebuchet MS', 'Verdana', sans-serif";
    ctx.fillText(`Final score: ${state.game.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 24);
    ctx.fillText("Press Start Mission to play again.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 56);
    ctx.restore();
  }

  function handleCanvasClick(event) {
    if (!state.game.running || state.game.paused || state.game.gameOver) {
      return;
    }
    const rect = els.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    if (state.game.mode === "banner_drive" && state.game.car) {
      state.game.car.x = Math.max(state.game.car.width / 2 + 12, Math.min(CANVAS_WIDTH - state.game.car.width / 2 - 12, x));
      return;
    }
    const closestLane = laneCenters.reduce((best, center, lane) => {
      const dist = Math.abs(center - x);
      return dist < best.dist ? { lane, dist } : best;
    }, { lane: 0, dist: Infinity }).lane;
    selectLane(closestLane);
  }

  function sanitizeInitials(value) {
    const stripped = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    return stripped || "AAA";
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function isTypingElement(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  function cryptoRandomId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }

  function canUseLocalStorage() {
    try {
      localStorage.setItem("__lane_defense_test__", "1");
      localStorage.removeItem("__lane_defense_test__");
      return true;
    } catch {
      return false;
    }
  }

  function storageGet(key) {
    if (!storage.enabled) {
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    if (!storage.enabled) {
      return false;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function loadSettings() {
    const raw = storageGet(SETTINGS_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistSettings() {
    const settings = {
      gameMode: els.gameMode.value || DEFAULT_GAME_MODE,
      choicesPerRound: Number(els.choicesPerRound.value) || DEFAULT_CHOICES_PER_ROUND,
      fallSpeed: els.fallSpeed.value || DEFAULT_FALL_SPEED,
      reduceMotion: !!els.reduceMotion.checked,
      highContrast: !!els.highContrast.checked,
      initials: sanitizeInitials(els.initials.value)
    };
    state.settings = settings;
    storageSet(SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadScoreboard() {
    const raw = storageGet(SCOREBOARD_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
})();

