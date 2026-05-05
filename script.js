(() => {
  'use strict';

  const STORAGE_KEY = 'pomodoro_v6';
  const THEME_STORAGE_KEY = 'pomodoro_theme';
  const circumference = 2 * Math.PI * 140;
  let isEditingTime = false;

  const state = {
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    isRunning: false,
    sessions: 0,
    currentMode: 'work',
    task: '',
    timerId: null,
    durations: { work: 25, short: 5, long: 15 }
  };

  const el = {
    time: document.getElementById('time'),
    startBtn: document.getElementById('start-btn'),
    resetBtn: document.getElementById('reset-btn'),
    modeBtns: document.querySelectorAll('.mode-btn'),
    sessionCount: document.getElementById('session-count'),
    progressRing: document.querySelector('.progress-ring__progress'),
    alarm: document.getElementById('alarm-sound'),
    notifBtn: document.getElementById('notif-btn'),
    taskInput: document.getElementById('task-input'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    saveSettingsBtn: document.getElementById('save-settings'),
    closeSettingsBtn: document.getElementById('close-settings'),
    workInput: document.getElementById('work-time'),
    shortInput: document.getElementById('short-time'),
    longInput: document.getElementById('long-time'),
    themeToggle: document.getElementById('theme-toggle')
  };

  function init() {
    loadTheme();
    loadState();
    updateDisplay();
    updateModeButtons();
    bindEvents();
    el.progressRing.style.strokeDasharray = circumference;
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    el.themeToggle.textContent = isDark ? '☀️' : '🌙';
  }

  function saveTheme(isDark) {
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newIsDark = !isDark;

    document.documentElement.setAttribute('data-theme', newIsDark ? 'dark' : 'light');
    el.themeToggle.textContent = newIsDark ? '🌙' : '☀️';
    saveTheme(newIsDark);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        state.sessions = saved.sessions || 0;
        state.task = saved.task || '';
        state.currentMode = saved.currentMode || 'work';
        state.durations = saved.durations || { work: 25, short: 5, long: 15 };
        state.totalTime = state.durations[state.currentMode] * 60;
        state.timeLeft = saved.timeLeft || state.totalTime;
        el.taskInput.value = state.task;
        el.workInput.value = state.durations.work;
        el.shortInput.value = state.durations.short;
        el.longInput.value = state.durations.long;
      }
    } catch (e) {
      console.warn('Load error', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessions: state.sessions,
        task: state.task,
        currentMode: state.currentMode,
        timeLeft: state.timeLeft,
        durations: state.durations
      }));
    } catch (e) {}
  }

  function updateDisplay() {
    if (isEditingTime) return;
    const m = Math.floor(state.timeLeft / 60);
    const s = state.timeLeft % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    el.time.textContent = timeStr;
    document.title = `${timeStr} • ${state.task || 'Помидорный Таймер'}`;
    el.progressRing.style.strokeDashoffset = circumference * (1 - state.timeLeft / state.totalTime);
    el.sessionCount.textContent = `Завершено: ${state.sessions}`;
    el.startBtn.classList.toggle('running', state.isRunning);
  }

  function playSound() {
    if (el.alarm) {
      el.alarm.currentTime = 0;
      el.alarm.volume = 0.7;
      el.alarm.play().catch(e => {
        console.warn('🔇 Звук заблокирован браузером:', e.message);
      });
    }
  }

  function start() {
    if (state.isRunning) return;
    state.isRunning = true;
    el.startBtn.textContent = '⏸ Пауза';

    state.timerId = setInterval(() => {
      if (state.timeLeft > 0) {
        state.timeLeft--;
        updateDisplay();
        if (state.timeLeft % 5 === 0) saveState();
      } else {
        completeCycle();
      }
    }, 1000);
  }

  function pause() {
    clearInterval(state.timerId);
    state.isRunning = false;
    el.startBtn.textContent = '▶ Старт';
    saveState();
  }

  function reset() {
    pause();
    state.timeLeft = state.totalTime;
    updateDisplay();
  }

  function completeCycle() {
    pause();
    state.sessions++;
    saveState();
    playSound();
    sendNotification();
    switchMode(state.currentMode === 'work' ? 'short' : 'work');
  }

  function sendNotification() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const msg = state.currentMode === 'work' ? '🎉 Время отдыхать!' : '⏰ Пора работать!';
      try {
        new Notification('Помидорный Таймер', { body: msg, tag: 'pomodoro', icon: '🍅' });
      } catch (e) {
        console.warn('Notification error', e);
      }
    }
  }

  function updateModeButtons() {
    el.modeBtns.forEach(btn => {
      const mode = btn.dataset.mode;
      const isActive = mode === state.currentMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
      const labels = {
        work: `Работа (${state.durations.work})`,
        short: `Короткий (${state.durations.short})`,
        long: `Длинный (${state.durations.long})`
      };
      btn.textContent = labels[mode];
    });
  }

  function switchMode(modeName) {
    pause();
    state.currentMode = modeName;
    state.totalTime = state.durations[modeName] * 60;
    state.timeLeft = state.totalTime;
    updateModeButtons();
    updateDisplay();
    saveState();
  }

  // 🔔 Функция для включения/выключения уведомлений
  function toggleNotifications() {
    if (!('Notification' in window)) {
      alert('Уведомления не поддерживаются браузером');
      return;
    }

    if (Notification.permission === 'granted') {
      // Если уже разрешены — отключаем
      el.notifBtn.textContent = '🔔';
      el.notifBtn.title = 'Уведомления отключены';
      Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
          console.log('Уведомления отключены пользователем.');
        }
      });
    } else if (Notification.permission === 'denied') {
      // Если запрещены — просим разрешить снова
      alert('Чтобы включить уведомления, разрешите их в настройках браузера.');
      Notification.requestPermission();
    } else {
      // Если не спрашивали — спрашиваем
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          el.notifBtn.textContent = '✅';
          el.notifBtn.title = 'Уведомления включены';
          // Пример отправки тестового уведомления
          try {
            new Notification('Уведомления включены!');
          } catch (e) {
            console.warn('Test notification failed:', e);
          }
        } else {
          el.notifBtn.textContent = '🔔';
          el.notifBtn.title = 'Уведомления отключены';
        }
      });
    }
  }


  function openSettings() { el.settingsModal.classList.remove('hidden'); }
  function closeSettings() { el.settingsModal.classList.add('hidden'); }

  function saveSettings() {
    const clamp = (val, min, max) => Math.max(min, Math.min(max, parseInt(val) || min));
    state.durations.work = clamp(el.workInput.value, 1, 120);
    state.durations.short = clamp(el.shortInput.value, 1, 60);
    state.durations.long = clamp(el.longInput.value, 1, 60);

    el.workInput.value = state.durations.work;
    el.shortInput.value = state.durations.short;
    el.longInput.value = state.durations.long;

    state.totalTime = state.durations[state.currentMode] * 60;
    state.timeLeft = state.totalTime;
    updateModeButtons(); updateDisplay(); saveState(); closeSettings();
  }

  function enableTimeEdit() {
    if (state.isRunning || isEditingTime) return;
    isEditingTime = true;
    el.time.classList.add('editing');

    const current = el.time.textContent;
    el.time.innerHTML = `<input type="text" class="time-edit-input" value="${current}" inputmode="numeric" placeholder="MM:SS" autocomplete="off">`;
    const input = el.time.querySelector('input');
    input.focus();
    input.select();

    const commitEdit = () => {
      let val = input.value.replace(/[^0-9:]/g, '');
      let totalSec = 0;

      if (val.includes(':')) {
        const [m, s] = val.split(':').map(Number);
        totalSec = (!isNaN(m) ? m : 0) * 60 + (!isNaN(s) ? s : 0);
      } else {
        const num = parseInt(val, 10);
        totalSec = num > 100 ? num : num * 60;
      }

      totalSec = Math.max(1, Math.min(36000, totalSec || 25 * 60));
      state.timeLeft = totalSec;
      state.totalTime = totalSec;
      saveState();

      isEditingTime = false;
      el.time.classList.remove('editing');
      updateDisplay();
    };

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') {
        isEditingTime = false;
        el.time.classList.remove('editing');
        updateDisplay();
      }
    });
  }

  function bindEvents() {
    el.startBtn.addEventListener('click', () => state.isRunning ? pause() : start());
    el.resetBtn.addEventListener('click', reset);
    el.modeBtns.forEach(btn => btn.addEventListener('click', () => switchMode(btn.dataset.mode)));
    el.taskInput.addEventListener('input', (e) => { state.task = e.target.value.trim(); saveState(); updateDisplay(); });
    el.notifBtn.addEventListener('click', toggleNotifications); // Теперь вызывает toggleNotifications
    el.settingsBtn.addEventListener('click', openSettings);
    el.themeToggle.addEventListener('click', toggleTheme); // Теперь вызывает toggleTheme
    el.saveSettingsBtn.addEventListener('click', saveSettings);
    el.closeSettingsBtn.addEventListener('click', closeSettings);
    el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) closeSettings(); });
    el.time.addEventListener('click', enableTimeEdit);

    // Убраны горячие клавиши
  }

  init();
})();