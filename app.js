// App State Variables
let timerInterval = null;
let timerState = 'idle'; // 'idle', 'running', 'paused'
let currentMode = 'work'; // 'work', 'short', 'long'

// Timer Configs (initialized from settings/localStorage)
let configs = {
  work: 25,
  short: 5,
  long: 15,
  targetRounds: 4,
  volume: 0.8
};

// Tracking Stats
let currentRound = 1;
let totalFocusMinutes = 0;
let timeRemaining = 0; // seconds
let maxDuration = 0; // seconds

// Tasks State
let tasks = [];
let activeTaskId = null;

// HTML Elements
const timerText = document.getElementById('timer-text');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const resetBtn = document.getElementById('reset-btn');
const skipBtn = document.getElementById('skip-btn');
const modeButtons = {
  work: document.getElementById('mode-work'),
  short: document.getElementById('mode-short'),
  long: document.getElementById('mode-long')
};
const sessionRounds = document.getElementById('session-rounds');
const totalFocusTimeText = document.getElementById('total-focus-time');
const progressCircle = document.querySelector('.progress-ring-circle');

// Tasks Elements
const taskForm = document.getElementById('add-task-form');
const taskInput = document.getElementById('new-task-input');
const tasksList = document.getElementById('tasks-list');
const taskCompletionBadge = document.getElementById('task-completion');
const focusTaskContainer = document.getElementById('focus-task-container');
const focusTaskTitle = document.getElementById('focus-task-title');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');
const testSoundBtn = document.getElementById('test-sound-btn');

const inputs = {
  work: document.getElementById('input-work'),
  short: document.getElementById('input-short'),
  long: document.getElementById('input-long'),
  targetRounds: document.getElementById('input-target-rounds'),
  volume: document.getElementById('input-volume'),
  volumeVal: document.getElementById('volume-val')
};

// SVG Dash Array Details
const ringCircumference = 2 * Math.PI * 88; // 552.92

// Initialize App
function initApp() {
  loadLocalStorage();
  setMode(currentMode);
  updateStatsDisplay();
  renderTasks();
  setupEventListeners();
  
  // Set initial SVG stroke properties
  progressCircle.style.strokeDasharray = ringCircumference;
  updateProgressRing();
}

// Load configurations and tasks from LocalStorage
function loadLocalStorage() {
  const savedConfigs = localStorage.getItem('xorneo_pomo_configs');
  if (savedConfigs) {
    configs = { ...configs, ...JSON.parse(savedConfigs) };
  }

  const savedTasks = localStorage.getItem('xorneo_pomo_tasks');
  if (savedTasks) {
    tasks = JSON.parse(savedTasks);
  }

  const savedStats = localStorage.getItem('xorneo_pomo_stats');
  if (savedStats) {
    const stats = JSON.parse(savedStats);
    totalFocusMinutes = stats.totalFocusMinutes || 0;
    currentRound = stats.currentRound || 1;
  }
}

// Save config, tasks, and stats to LocalStorage
function saveConfigs() {
  localStorage.setItem('xorneo_pomo_configs', JSON.stringify(configs));
}

function saveTasksToStorage() {
  localStorage.setItem('xorneo_pomo_tasks', JSON.stringify(tasks));
}

function saveStatsToStorage() {
  const stats = { totalFocusMinutes, currentRound };
  localStorage.setItem('xorneo_pomo_stats', JSON.stringify(stats));
}

// Event Listeners Configuration
function setupEventListeners() {
  // Timer Controls
  playPauseBtn.addEventListener('click', toggleTimer);
  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', skipSession);

  // Mode Selection
  Object.keys(modeButtons).forEach(mode => {
    modeButtons[mode].addEventListener('click', () => {
      if (timerState !== 'idle') {
        if (confirm('A session is currently active. Switch modes and discard current progress?')) {
          setMode(mode);
        }
      } else {
        setMode(mode);
      }
    });
  });

  // Task Events
  taskForm.addEventListener('submit', handleAddTask);
  
  // Settings Modal Events
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  saveSettingsBtn.addEventListener('click', saveSettings);
  resetSettingsBtn.addEventListener('click', resetSettingsToDefault);
  testSoundBtn.addEventListener('click', playAlertSound);

  inputs.volume.addEventListener('input', (e) => {
    inputs.volumeVal.textContent = `${e.target.value}%`;
  });

  // Close modal when clicking on overlay background
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });

  // Page Visibility Change (timer consistency)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// Visibility change handler — the interval already uses wall-clock math,
// so we just need to trigger an immediate update on re-show to catch drift.
let lastActiveTime = null;
function handleVisibilityChange() {
  if (document.hidden) {
    lastActiveTime = Date.now();
  } else {
    // Just re-render; the next interval tick will compute the correct value
    updateTimerText();
    updateProgressRing();
    lastActiveTime = null;
  }
}

// State Machine - Set Mode
function setMode(mode) {
  stopTimer();
  currentMode = mode;
  document.documentElement.setAttribute('data-theme', mode);
  
  // Highlight mode buttons
  Object.keys(modeButtons).forEach(m => {
    modeButtons[m].classList.toggle('active', m === mode);
  });

  // Configure durations
  maxDuration = configs[mode] * 60;
  timeRemaining = maxDuration;
  
  updateTimerText();
  updateProgressRing();
  timerState = 'idle';
  updateControlButtonsUI();
}

// Start / Pause toggle
function toggleTimer() {
  if (timerState === 'running') {
    pauseTimer();
  } else if (timerState === 'paused') {
    resumeTimer();
  } else {
    startTimer();
  }
}

// Start countdown
function startTimer() {
  if (timerState === 'idle') {
    maxDuration = configs[currentMode] * 60;
    timeRemaining = maxDuration;
  }

  timerState = 'running';
  updateControlButtonsUI();

  // Record real wall-clock start
  const startedAt = Date.now();
  const initialRemaining = timeRemaining;

  timerInterval = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    timeRemaining = Math.max(0, initialRemaining - elapsedSeconds);
    updateTimerText();
    updateProgressRing();

    if (timeRemaining <= 0) {
      handleTimerEnd();
    }
  }, 200); // Check more frequently for accuracy, but compute from wall clock
}

// Pause countdown
function pauseTimer() {
  clearInterval(timerInterval);
  timerState = 'paused';
  updateControlButtonsUI();
}

// Resume countdown — re-baseline on the paused amount so wall-clock math starts fresh
function resumeTimer() {
  timerState = 'running';
  updateControlButtonsUI();

  const startedAt = Date.now();
  const initialRemaining = timeRemaining;

  timerInterval = setInterval(() => {
    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    timeRemaining = Math.max(0, initialRemaining - elapsedSeconds);
    updateTimerText();
    updateProgressRing();

    if (timeRemaining <= 0) {
      handleTimerEnd();
    }
  }, 200);
}

// Stop countdown (full reset to active mode defaults)
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  if (timerState !== 'idle') {
    if (confirm('Are you sure you want to reset the current timer?')) {
      setMode(currentMode);
    }
  }
}

// Handle session skip
function skipSession() {
  if (confirm('Skip this session? No focus minutes will be recorded.')) {
    transitionToNextMode(false);
  }
}

// Transition modes upon timer expiration or skip
function transitionToNextMode(recordStats = true) {
  if (recordStats && currentMode === 'work') {
    totalFocusMinutes += configs.work;
    saveStatsToStorage();
    updateStatsDisplay();
  }

  if (currentMode === 'work') {
    if (currentRound >= configs.targetRounds) {
      // Completed full cycle of rounds -> Long Break
      currentRound = 1;
      saveStatsToStorage();
      setMode('long');
    } else {
      // Completed one round -> Short Break
      currentRound++;
      saveStatsToStorage();
      setMode('short');
    }
  } else {
    // Break completed -> Back to Work
    setMode('work');
  }
  updateStatsDisplay();
}

// When countdown hits 0
function handleTimerEnd() {
  stopTimer();
  playAlertSound();
  
  // Alert visual indicator in title bar
  let alertsCount = 0;
  const originalTitle = document.title;
  const alertInterval = setInterval(() => {
    document.title = alertsCount % 2 === 0 ? '🔔 Time\'s Up! | Xorneo' : originalTitle;
    alertsCount++;
    if (alertsCount > 10) {
      clearInterval(alertInterval);
      document.title = originalTitle;
    }
  }, 1000);

  // Auto transition
  setTimeout(() => {
    alert(`Time's up! Transitioning to next session.`);
    transitionToNextMode(true);
  }, 100);
}

// Synthesize pleasant sound chime using Web Audio API
function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const volume = configs.volume;
    
    // Play a dual-tone chord
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Decay envelope
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Play musical arpeggio (C5 -> E5 -> G5)
    playTone(523.25, now, 1.2);       // C5
    playTone(659.25, now + 0.15, 1.2); // E5
    playTone(783.99, now + 0.3, 1.5);  // G5
  } catch (e) {
    console.error('Audio Synthesis failed: ', e);
  }
}

// UI Updating functions
function updateTimerText() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  
  const displayMins = mins < 10 ? '0' + mins : mins;
  const displaySecs = secs < 10 ? '0' + secs : secs;
  
  const timeStr = `${displayMins}:${displaySecs}`;
  timerText.textContent = timeStr;

  // Sync window browser title
  const modeText = currentMode === 'work' ? 'Focus' : 'Break';
  document.title = `(${timeStr}) ${modeText} | Xorneo`;
}

function updateProgressRing() {
  if (maxDuration <= 0) return;
  const fraction = timeRemaining / maxDuration;
  const offset = ringCircumference * (1 - fraction);
  progressCircle.style.strokeDashoffset = offset;
}

function updateControlButtonsUI() {
  if (timerState === 'running') {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    playPauseBtn.setAttribute('aria-label', 'Pause');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    playPauseBtn.setAttribute('aria-label', 'Play');
  }
}

function updateStatsDisplay() {
  sessionRounds.textContent = `${currentRound}/${configs.targetRounds}`;
  totalFocusTimeText.textContent = `${totalFocusMinutes} min`;
}

// Tasks Functions
function renderTasks() {
  tasksList.innerHTML = '';
  
  if (tasks.length === 0) {
    tasksList.innerHTML = '<li class="empty-state">No tasks yet. Add one to start focusing!</li>';
    taskCompletionBadge.textContent = '0/0';
    updateFocusTaskUI();
    return;
  }

  const completedCount = tasks.filter(t => t.completed).length;
  taskCompletionBadge.textContent = `${completedCount}/${tasks.length}`;

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} ${activeTaskId === task.id ? 'active-focus' : ''}`;
    li.dataset.id = task.id;
    
    // Toggle active task on double click or simple select click
    li.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        selectActiveTask(task.id);
      }
    });

    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'task-checkbox-container';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
    
    checkboxContainer.appendChild(checkbox);

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text';
    textSpan.textContent = task.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-task-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    li.appendChild(checkboxContainer);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);
    tasksList.appendChild(li);
  });

  updateFocusTaskUI();
}

function handleAddTask(e) {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;

  const newTask = {
    id: Date.now().toString(),
    text,
    completed: false
  };

  tasks.push(newTask);
  saveTasksToStorage();
  taskInput.value = '';
  renderTasks();

  // If it's the only task, auto-focus it
  if (tasks.length === 1) {
    selectActiveTask(newTask.id);
  }
}

function toggleTaskComplete(id) {
  tasks = tasks.map(task => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });
  
  // If the active task is completed, remove focus task banner
  if (activeTaskId === id) {
    const task = tasks.find(t => t.id === id);
    if (task && task.completed) {
      activeTaskId = null;
    }
  }

  saveTasksToStorage();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  if (activeTaskId === id) {
    activeTaskId = null;
  }
  saveTasksToStorage();
  renderTasks();
}

function selectActiveTask(id) {
  // Toggle selection
  if (activeTaskId === id) {
    activeTaskId = null;
  } else {
    const task = tasks.find(t => t.id === id);
    if (task && !task.completed) {
      activeTaskId = id;
    }
  }
  renderTasks();
}

function updateFocusTaskUI() {
  if (activeTaskId) {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    if (activeTask) {
      focusTaskTitle.textContent = activeTask.text;
      focusTaskContainer.classList.remove('hidden');
      return;
    }
  }
  focusTaskContainer.classList.add('hidden');
}

// Settings Modal Management
function openSettings() {
  inputs.work.value = configs.work;
  inputs.short.value = configs.short;
  inputs.long.value = configs.long;
  inputs.targetRounds.value = configs.targetRounds;
  inputs.volume.value = Math.round(configs.volume * 100);
  inputs.volumeVal.textContent = `${Math.round(configs.volume * 100)}%`;
  
  settingsModal.classList.remove('hidden');
}

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function saveSettings() {
  const newWork = parseInt(inputs.work.value);
  const newShort = parseInt(inputs.short.value);
  const newLong = parseInt(inputs.long.value);
  const newTargetRounds = parseInt(inputs.targetRounds.value);
  const newVolume = parseInt(inputs.volume.value) / 100;

  if (isNaN(newWork) || newWork < 1 || newWork > 99 ||
      isNaN(newShort) || newShort < 1 || newShort > 99 ||
      isNaN(newLong) || newLong < 1 || newLong > 99 ||
      isNaN(newTargetRounds) || newTargetRounds < 1 || newTargetRounds > 12) {
    alert('Please enter valid durations and rounds settings (between 1 and 99 minutes/rounds).');
    return;
  }

  configs.work = newWork;
  configs.short = newShort;
  configs.long = newLong;
  configs.targetRounds = newTargetRounds;
  configs.volume = newVolume;

  saveConfigs();
  closeSettings();
  
  // Re-apply setting timers
  setMode(currentMode);
  updateStatsDisplay();
}

function resetSettingsToDefault() {
  configs.work = 25;
  configs.short = 5;
  configs.long = 15;
  configs.targetRounds = 4;
  configs.volume = 0.8;

  inputs.work.value = 25;
  inputs.short.value = 5;
  inputs.long.value = 15;
  inputs.targetRounds = 4;
  inputs.volume.value = 80;
  inputs.volumeVal.textContent = '80%';
}

// Run initializer on load
window.addEventListener('DOMContentLoaded', initApp);
