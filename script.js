const storageKeys = {
  settings: 'numberRecallSettings',
  theme: 'numberRecallTheme',
};

const defaultSettings = {
  digits: 6,
  showTime: 3,
  pauseTime: 1,
  rounds: 5,
  allowLeadingZero: false,
  soundEnabled: true,
};

const state = {
  settings: { ...defaultSettings },
  session: null,
  theme: 'light',
  awaitingInput: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const elements = {
  app: document.querySelector('.app'),
  inputs: {
    digits: document.getElementById('digitsInput'),
    showTime: document.getElementById('showTimeInput'),
    pauseTime: document.getElementById('pauseTimeInput'),
    rounds: document.getElementById('roundsInput'),
    allowLeadingZero: document.getElementById('leadingZeroInput'),
    soundEnabled: document.getElementById('soundInput'),
    themeToggle: document.getElementById('themeToggle'),
  },
  startButton: document.getElementById('startButton'),
  roundStatus: document.getElementById('roundStatus'),
  scoreStatus: document.getElementById('scoreStatus'),
  streakStatus: document.getElementById('streakStatus'),
  stageContent: document.getElementById('stageContent'),
  inputArea: document.getElementById('inputArea'),
  answerInput: document.getElementById('answerInput'),
  inputHint: document.getElementById('inputHint'),
  feedbackArea: document.getElementById('feedbackArea'),
  summary: document.getElementById('summary'),
  summaryRounds: document.getElementById('summaryRounds'),
  summaryCorrect: document.getElementById('summaryCorrect'),
  summaryPercent: document.getElementById('summaryPercent'),
  summaryStreak: document.getElementById('summaryStreak'),
  restartButton: document.getElementById('restartButton'),
  debugTools: document.getElementById('debugTools'),
  successSound: document.getElementById('successSound'),
  errorSound: document.getElementById('errorSound'),
};

const storage = {
  loadSettings() {
    try {
      const raw = localStorage.getItem(storageKeys.settings);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state.settings = { ...state.settings, ...parsed };
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  },
  saveSettings() {
    try {
      localStorage.setItem(storageKeys.settings, JSON.stringify(state.settings));
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  },
  loadTheme() {
    try {
      const saved = localStorage.getItem(storageKeys.theme);
      if (saved) {
        state.theme = saved;
      }
    } catch (err) {
      console.error('Failed to load theme', err);
    }
  },
  saveTheme() {
    try {
      localStorage.setItem(storageKeys.theme, state.theme);
    } catch (err) {
      console.error('Failed to save theme', err);
    }
  },
};

const numberGenerator = {
  generate(length, allowLeadingZero) {
    if (length <= 0) return '0';
    if (allowLeadingZero) {
      const max = 10 ** length;
      const value = Math.floor(Math.random() * max);
      return value.toString().padStart(length, '0');
    }
    let digits = '';
    const first = Math.floor(Math.random() * 9) + 1;
    digits += first.toString();
    for (let i = 1; i < length; i += 1) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    return digits;
  },
};

const timers = {
  delay(ms) {
    if (state.reducedMotion) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const step = (now) => {
        if (now - start >= ms) {
          resolve();
        } else {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    });
  },
};

const renderer = {
  reset() {
    elements.stageContent.textContent = 'Ready to begin';
    elements.stageContent.className = 'stage-content';
    elements.inputArea.hidden = true;
    elements.feedbackArea.hidden = true;
    elements.feedbackArea.innerHTML = '';
    elements.summary.hidden = true;
    elements.inputHint.textContent = '';
    setTimeout(() => {
      elements.startButton.focus({ preventScroll: true });
    }, 0);
  },
  setStageMessage(message, options = {}) {
    elements.stageContent.textContent = message;
    elements.stageContent.className = 'stage-content';
    if (options.className) {
      elements.stageContent.classList.add(options.className);
    }
  },
  showCountdown(value) {
    this.clearFeedback();
    elements.inputArea.hidden = true;
    elements.summary.hidden = true;
    this.setStageMessage(String(value));
  },
  showNumber(number) {
    this.setStageMessage(number, { className: 'show-number' });
  },
  showPause() {
    this.setStageMessage('•', { className: 'pause-dot' });
  },
  showPrompt(length) {
    this.clearFeedback();
    elements.inputArea.hidden = false;
    elements.summary.hidden = true;
    elements.stageContent.textContent = '';
    elements.stageContent.className = 'stage-content';
    elements.inputHint.textContent = `Type ${length} digits and press Enter.`;
    elements.answerInput.maxLength = length;
    elements.answerInput.value = '';
    elements.answerInput.setAttribute('pattern', `\\d{${length}}`);
    elements.answerInput.setAttribute('aria-label', `${length} digit answer`);
    setTimeout(() => {
      elements.answerInput.focus({ preventScroll: true });
      elements.answerInput.select();
    }, 0);
  },
  showFeedback({ correct, generated, entry, perDigit }) {
    elements.feedbackArea.hidden = false;
    elements.feedbackArea.className = `feedback ${correct ? 'correct' : 'wrong'}`;
    const container = elements.feedbackArea;
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = correct ? 'Correct' : 'Wrong';
    container.appendChild(title);

    const correctLine = this.buildDigitLine('Correct', generated, perDigit);
    const entryLine = this.buildDigitLine('Yours', entry.padEnd(generated.length, ' '), perDigit);
    container.append(correctLine, entryLine);
  },
  buildDigitLine(label, value, perDigit) {
    const wrapper = document.createElement('div');
    wrapper.className = 'feedback-block';
    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const line = document.createElement('div');
    line.className = 'feedback-line';

    for (let i = 0; i < value.length; i += 1) {
      const span = document.createElement('span');
      const status = perDigit[i];
      const isCorrect = status === true;
      span.textContent = value[i] ?? '';
      span.className = isCorrect ? 'digit-correct' : 'digit-wrong';
      line.appendChild(span);
    }

    wrapper.append(labelEl, line);
    return wrapper;
  },
  clearFeedback() {
    elements.feedbackArea.hidden = true;
    elements.feedbackArea.innerHTML = '';
  },
  updateScoreboard(session) {
    if (!session) {
      elements.roundStatus.textContent = 'Round: 0 / 0';
      elements.scoreStatus.textContent = 'Score: 0';
      elements.streakStatus.textContent = 'Streak: 0 | Best: 0';
      return;
    }
    elements.roundStatus.textContent = `Round: ${session.currentRound} / ${session.totalRounds}`;
    elements.scoreStatus.textContent = `Score: ${session.correct}`;
    elements.streakStatus.textContent = `Streak: ${session.currentStreak} | Best: ${session.bestStreak}`;
  },
  showSummary(session) {
    elements.summary.hidden = false;
    elements.summaryRounds.textContent = `Rounds: ${session.totalRounds}`;
    elements.summaryCorrect.textContent = `Correct: ${session.correct}`;
    const percent = session.totalRounds ? Math.round((session.correct / session.totalRounds) * 100) : 0;
    elements.summaryPercent.textContent = `Accuracy: ${percent}%`;
    elements.summaryStreak.textContent = `Longest streak: ${session.bestStreak}`;
    elements.stageContent.textContent = 'Nice work!';
    setTimeout(() => {
      elements.restartButton.focus({ preventScroll: true });
    }, 0);
  },
};

const sounds = {
  playSuccess() {
    if (!state.settings.soundEnabled) return;
    try {
      elements.successSound.currentTime = 0;
      elements.successSound.play();
    } catch (err) {
      /* ignore playback errors */
    }
  },
  playError() {
    if (!state.settings.soundEnabled) return;
    try {
      elements.errorSound.currentTime = 0;
      elements.errorSound.play();
    } catch (err) {
      /* ignore playback errors */
    }
  },
};

const sessionManager = {
  start() {
    if (state.session) return;
    const { digits, rounds, showTime, pauseTime, allowLeadingZero, soundEnabled } = state.settings;
    state.session = {
      totalRounds: rounds,
      digits,
      showTime,
      pauseTime,
      allowLeadingZero,
      soundEnabled,
      currentRound: 0,
      correct: 0,
      currentStreak: 0,
      bestStreak: 0,
      awaitingInput: false,
      active: true,
      pendingNumber: '',
    };
    elements.summary.hidden = true;
    disableControls(true);
    renderer.clearFeedback();
    renderer.updateScoreboard(state.session);
    renderer.setStageMessage('Get ready');
    runNextRound();
  },
  finish() {
    if (!state.session) return;
    const completed = state.session;
    completed.active = false;
    renderer.showSummary(completed);
    disableControls(false);
    state.session = null;
    state.awaitingInput = false;
  },
};

async function runNextRound() {
  const session = state.session;
  if (!session || !session.active) return;
  if (session.currentRound >= session.totalRounds) {
    sessionManager.finish();
    return;
  }

  session.currentRound += 1;
  renderer.updateScoreboard(session);

  const generated = numberGenerator.generate(session.digits, session.allowLeadingZero);
  session.pendingNumber = generated;

  await runCountdown(3);
  if (!session.active) return;
  renderer.showNumber(generated);
  await timers.delay(session.showTime * 1000);
  if (!session.active) return;
  renderer.showPause();
  await timers.delay(session.pauseTime * 1000);
  if (!session.active) return;
  renderer.showPrompt(session.digits);
  state.awaitingInput = true;
}

async function runCountdown(length) {
  for (let value = length; value > 0; value -= 1) {
    renderer.showCountdown(value);
    await timers.delay(1000);
  }
}

function disableControls(shouldDisable) {
  Object.entries(elements.inputs).forEach(([key, input]) => {
    if (key === 'themeToggle') return;
    input.disabled = shouldDisable;
  });
  elements.startButton.disabled = shouldDisable;
}

function applyTheme(theme) {
  state.theme = theme;
  elements.app.dataset.theme = theme;
  storage.saveTheme();
  elements.inputs.themeToggle.checked = theme === 'dark';
}

function restoreSettingsToInputs() {
  elements.inputs.digits.value = state.settings.digits;
  elements.inputs.showTime.value = state.settings.showTime;
  elements.inputs.pauseTime.value = state.settings.pauseTime;
  elements.inputs.rounds.value = state.settings.rounds;
  elements.inputs.allowLeadingZero.checked = state.settings.allowLeadingZero;
  elements.inputs.soundEnabled.checked = state.settings.soundEnabled;
}

function handleAnswerSubmit() {
  if (!state.session || !state.awaitingInput) return;
  const { digits } = state.session;
  const rawValue = elements.answerInput.value.trim();
  const sanitized = rawValue.replace(/\D/g, '');
  if (sanitized.length !== digits) {
    elements.inputHint.textContent = `Please enter exactly ${digits} digits.`;
    elements.answerInput.focus({ preventScroll: true });
    elements.answerInput.select();
    return;
  }
  state.awaitingInput = false;
  evaluateAnswer(sanitized);
}

function evaluateAnswer(entry) {
  const session = state.session;
  if (!session) return;
  const generated = session.pendingNumber;
  const perDigit = [];
  let allCorrect = true;
  for (let i = 0; i < generated.length; i += 1) {
    const correctDigit = generated[i];
    const entryDigit = entry[i] ?? '';
    const match = correctDigit === entryDigit;
    perDigit.push(match);
    if (!match) {
      allCorrect = false;
    }
  }

  if (allCorrect) {
    session.correct += 1;
    session.currentStreak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.currentStreak);
    sounds.playSuccess();
  } else {
    session.currentStreak = 0;
    sounds.playError();
  }

  renderer.updateScoreboard(session);
  renderer.showFeedback({
    correct: allCorrect,
    generated,
    entry,
    perDigit,
  });

  elements.inputArea.hidden = true;

  timers.delay(2000).then(() => {
    if (!state.session || !session.active) return;
    runNextRound();
  });
}

function bindEvents() {
  const { digits, showTime, pauseTime, rounds, allowLeadingZero, soundEnabled, themeToggle } = elements.inputs;

  digits.addEventListener('change', () => updateSetting('digits', digits.valueAsNumber, 2, 20));
  showTime.addEventListener('change', () => updateSetting('showTime', showTime.valueAsNumber, 1, 10));
  pauseTime.addEventListener('change', () => updateSetting('pauseTime', pauseTime.valueAsNumber, 0, 5));
  rounds.addEventListener('change', () => updateSetting('rounds', rounds.valueAsNumber, 1, 20));
  allowLeadingZero.addEventListener('change', () => updateSetting('allowLeadingZero', allowLeadingZero.checked));
  soundEnabled.addEventListener('change', () => updateSetting('soundEnabled', soundEnabled.checked));

  themeToggle.addEventListener('change', () => {
    applyTheme(themeToggle.checked ? 'dark' : 'light');
  });

  elements.startButton.addEventListener('click', () => {
    sessionManager.start();
  });

  elements.answerInput.addEventListener('input', () => {
    const digitsOnly = elements.answerInput.value.replace(/\D/g, '');
    if (digitsOnly !== elements.answerInput.value) {
      const position = elements.answerInput.selectionStart ?? digitsOnly.length;
      elements.answerInput.value = digitsOnly;
      const caret = Math.max(0, position - 1);
      requestAnimationFrame(() => {
        elements.answerInput.setSelectionRange(caret, caret);
      });
    }
  });

  elements.answerInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAnswerSubmit();
    }
  });

  elements.restartButton.addEventListener('click', () => {
    renderer.reset();
    renderer.updateScoreboard(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'text') {
      return;
    }
    if ((event.key === 's' || event.key === 'S') && !state.session) {
      event.preventDefault();
      sessionManager.start();
    }
    if ((event.key === 'r' || event.key === 'R') && !state.session && !elements.summary.hidden) {
      event.preventDefault();
      renderer.reset();
      renderer.updateScoreboard(null);
    }
  });

  elements.restartButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      renderer.reset();
      renderer.updateScoreboard(null);
    }
  });

  setupDebugTools();
}

function updateSetting(key, value, min, max) {
  if (typeof min === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    value = Math.min(Math.max(value, min), max);
  }
  state.settings[key] = value;
  storage.saveSettings();
  restoreSettingsToInputs();
}

function setupDebugTools() {
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('debug');
  if (debug !== '1') return;
  elements.debugTools.hidden = false;
  elements.debugTools.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const type = target.dataset.debug;
    const generated = '123456';
    const entry = type === 'correct' ? '123456' : '153476';
    const perDigit = entry.split('').map((digit, index) => digit === generated[index]);
    renderer.showFeedback({
      correct: type === 'correct',
      generated,
      entry,
      perDigit,
    });
  });
}

function init() {
  storage.loadSettings();
  storage.loadTheme();
  restoreSettingsToInputs();
  applyTheme(state.theme);
  renderer.reset();
  renderer.updateScoreboard(null);
  bindEvents();
}

init();
