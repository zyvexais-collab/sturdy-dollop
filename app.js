
const STORAGE_KEYS = {
  logs: 'migraineHelper.logs.v5',
  daily: 'migraineHelper.daily.v5',
  attack: 'migraineHelper.attack.v5'
};

const LEGACY_KEYS = {
  logs: ['migraineHelper.logs.v4', 'migraineHelper.logs.v3'],
  daily: ['migraineHelper.daily.v4', 'migraineHelper.daily.v3'],
  attack: ['migraineHelper.attack.v4', 'migraineHelper.attack.v3']
};

const DAILY_ITEMS = [
  'Morning water',
  'Breakfast',
  'Caffeine around 10 AM',
  'Lunch',
  'Dinner',
  'Topiramate at night',
  'Magnesium at night'
];

const ATTACK_ITEMS = [
  'Drink water',
  'Small caffeine if early',
  'Ice pack',
  'Dark quiet room',
  'Rest eyes'
];

let timerInterval = null;
let timerRemaining = 20 * 60;

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  migrateLegacyData();
  seedToday();
  wireNavigation();
  wireLogForm();
  wireLogActions();
  wireBackupTools();
  wireDailyChecklist();
  wireAttackChecklist();
  wireTimer();
  setDirectScreen();
  updateAllViews();
  installHint();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

function migrateLegacyData() {
  for (const [targetKey, legacyKeys] of Object.entries(LEGACY_KEYS)) {
    if (localStorage.getItem(STORAGE_KEYS[targetKey])) continue;
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem(STORAGE_KEYS[targetKey], value);
        break;
      }
    }
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function prettyDate(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function seedToday() {
  const dateInput = document.getElementById('logDate');
  if (dateInput) dateInput.value = todayKey();
}

function getLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.logs)) || [];
  } catch {
    return [];
  }
}

function setLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
}

function emptyDailyState() {
  const fresh = { date: todayKey(), items: {} };
  DAILY_ITEMS.forEach(item => fresh.items[item] = false);
  return fresh;
}

function getDailyState() {
  const raw = localStorage.getItem(STORAGE_KEYS.daily);
  const fresh = emptyDailyState();

  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
    return fresh;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) {
      localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
      return fresh;
    }
    DAILY_ITEMS.forEach(item => {
      if (typeof parsed.items?.[item] !== 'boolean') parsed.items[item] = false;
    });
    return parsed;
  } catch {
    localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(fresh));
    return fresh;
  }
}

function setDailyState(state) {
  localStorage.setItem(STORAGE_KEYS.daily, JSON.stringify(state));
}

function getAttackState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.attack)) || {};
    const state = {};
    ATTACK_ITEMS.forEach(item => state[item] = !!parsed[item]);
    return state;
  } catch {
    const state = {};
    ATTACK_ITEMS.forEach(item => state[item] = false);
    return state;
  }
}

function setAttackState(state) {
  localStorage.setItem(STORAGE_KEYS.attack, JSON.stringify(state));
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function wireNavigation() {
  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });
  document.querySelectorAll('[data-home]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen('home'));
  });
}

function switchScreen(screen) {
  document.querySelectorAll('.screen').forEach(section => section.classList.remove('active'));
  const active = document.getElementById(`screen-${screen}`);
  if (active) active.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screen);
  });
}

function setDirectScreen() {
  const direct = document.body.dataset.directScreen;
  if (direct) switchScreen(direct);
}

function wireLogForm() {
  const form = document.getElementById('logForm');
  const severityRange = document.getElementById('severityRange');
  const severityValue = document.getElementById('severityValue');
  const resetBtn = document.getElementById('resetFormBtn');

  if (severityRange && severityValue) {
    severityRange.addEventListener('input', () => {
      severityValue.textContent = severityRange.value;
    });
  }

  if (resetBtn && form) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      seedToday();
      if (severityRange) severityRange.value = '5';
      if (severityValue) severityValue.textContent = '5';
      const yes = document.getElementById('migraineYes');
      if (yes) yes.checked = true;
    });
  }

  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const logs = getLogs();
    const hadMigraine = document.querySelector('input[name="hadMigraine"]:checked')?.value || 'Yes';

    logs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: document.getElementById('logDate').value || todayKey(),
      hadMigraine,
      severity: Number(document.getElementById('severityRange').value || 5),
      trigger: document.getElementById('logTrigger').value.trim(),
      notes: document.getElementById('logNotes').value.trim(),
      savedAt: new Date().toISOString()
    });

    setLogs(logs);
    form.reset();
    seedToday();
    document.getElementById('severityRange').value = '5';
    document.getElementById('severityValue').textContent = '5';
    document.getElementById('migraineYes').checked = true;
    updateAllViews();
    showToast('Log saved for little one');
    switchScreen('log');
  });
}

function renderLogs() {
  const logs = getLogs();
  const list = document.getElementById('logList');
  const count = document.getElementById('recentLogCount');
  if (count) count.textContent = String(logs.length);

  if (!list) return;
  if (!logs.length) {
    list.className = 'list-stack empty-state';
    list.textContent = 'No logs yet.';
    return;
  }

  list.className = 'list-stack';
  list.innerHTML = logs.slice(0, 20).map(log => `
    <article class="log-item">
      <div class="log-item-top">
        <strong>${prettyDate(log.date)}</strong>
        <span class="pill">${log.hadMigraine === 'Yes' ? `Severity ${log.severity}/10` : 'No migraine'}</span>
      </div>
      <div class="log-meta">
        ${log.trigger ? `<span>Trigger: ${escapeHtml(log.trigger)}</span>` : '<span>No trigger added</span>'}
      </div>
      ${log.notes ? `<p>${escapeHtml(log.notes)}</p>` : ''}
    </article>
  `).join('');
}

function wireLogActions() {
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJson);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      if (!confirm('Clear all saved migraine logs on this device?')) return;
      setLogs([]);
      updateAllViews();
      showToast('Logs cleared');
    });
  }
}

function exportJson() {
  const logs = getLogs();
  downloadFile('migraine-logs.json', JSON.stringify(logs, null, 2), 'application/json');
}

function exportCsv() {
  const logs = getLogs();
  const rows = [
    ['date', 'hadMigraine', 'severity', 'trigger', 'notes', 'savedAt'],
    ...logs.map(log => [log.date, log.hadMigraine, String(log.severity), log.trigger || '', log.notes || '', log.savedAt || ''])
  ];
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  downloadFile('migraine-logs.csv', csv, 'text/csv');
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${filename} exported`);
}

function wireDailyChecklist() {
  const container = document.getElementById('dailyChecklist');
  const resetDailyBtn = document.getElementById('resetDailyBtn');
  if (!container) return;

  container.querySelectorAll('input[type="checkbox"]').forEach(box => {
    box.addEventListener('change', () => {
      const state = getDailyState();
      state.items[box.dataset.dailyItem] = box.checked;
      setDailyState(state);
      updateDailyView();
      updateHomeSummary();
      updateInsights();
      showToast(box.checked ? 'Checked off' : 'Unchecked');
    });
  });

  if (resetDailyBtn) {
    resetDailyBtn.addEventListener('click', () => {
      const state = emptyDailyState();
      setDailyState(state);
      updateDailyView();
      updateHomeSummary();
      updateInsights();
      showToast('Daily reset');
    });
  }
}

function updateDailyView() {
  const state = getDailyState();
  const label = document.getElementById('dailyDateLabel');
  if (label) label.textContent = `Checklist for ${prettyDate(state.date)}`;

  let complete = 0;
  document.querySelectorAll('#dailyChecklist input[type="checkbox"]').forEach(box => {
    const checked = !!state.items[box.dataset.dailyItem];
    box.checked = checked;
    box.closest('.check-item')?.classList.toggle('done', checked);
    if (checked) complete += 1;
  });

  const pill = document.getElementById('dailyProgressPill');
  const summary = document.getElementById('dailySummary');
  if (pill) pill.textContent = `${complete} / ${DAILY_ITEMS.length}`;
  if (summary) {
    summary.textContent = complete === 0
      ? 'No items checked yet today.'
      : complete === DAILY_ITEMS.length
        ? 'Everything is checked off for today.'
        : `${complete} routine item${complete === 1 ? '' : 's'} done today.`;
  }
}

function wireAttackChecklist() {
  const state = getAttackState();
  document.querySelectorAll('#attackChecklist input[type="checkbox"]').forEach(box => {
    const key = box.dataset.attackItem;
    box.checked = !!state[key];
    box.closest('.check-item')?.classList.toggle('done', box.checked);
    box.addEventListener('change', () => {
      const next = getAttackState();
      next[key] = box.checked;
      setAttackState(next);
      box.closest('.check-item')?.classList.toggle('done', box.checked);
      updateHomeSummary();
    });
  });
}

function wireTimer() {
  const display = document.getElementById('timerDisplay');
  const startBtn = document.getElementById('timerStartBtn');
  const resetBtn = document.getElementById('timerResetBtn');
  if (!display || !startBtn || !resetBtn) return;

  const render = () => {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  render();

  startBtn.addEventListener('click', () => {
    if (timerInterval) return;
    showToast('Timer started');
    timerInterval = setInterval(() => {
      timerRemaining -= 1;
      render();
      if (timerRemaining <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerRemaining = 0;
        render();
        showToast('20 minutes done');
      }
    }, 1000);
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRemaining = 20 * 60;
    render();
    showToast('Timer reset');
  });
}

function updateHomeSummary() {
  const logs = getLogs();
  const daily = getDailyState();
  const totalDone = Object.values(daily.items).filter(Boolean).length;
  const attack = getAttackState();
  const attackDone = Object.values(attack).filter(Boolean).length;

  const title = document.getElementById('welcomeTitle');
  const trackerSummary = document.getElementById('trackerSummary');
  const subtitle = document.getElementById('welcomeSubtitle');
  const quickHelpText = document.getElementById('quickHelpText');

  if (title) title.textContent = totalDone >= 5 ? 'Little one is doing really well today.' : 'One gentle step at a time, little one.';
  if (subtitle) subtitle.textContent = logs.length
    ? `Little one has ${logs.length} saved log${logs.length === 1 ? '' : 's'} on this device.`
    : 'Track symptoms, check routines, and keep quick relief one tap away.';

  const trackerCountPill = document.getElementById('trackerCountPill');
  if (trackerCountPill) trackerCountPill.textContent = `${logs.length} log${logs.length === 1 ? '' : 's'}`;

  if (trackerSummary) {
    if (!logs.length) {
      trackerSummary.textContent = 'No migraine logs yet.';
    } else {
      const recent = logs.slice(0, 7);
      const migraineDays = recent.filter(l => l.hadMigraine === 'Yes').length;
      const severityLogs = recent.filter(l => l.hadMigraine === 'Yes');
      const avgSeverity = severityLogs.reduce((sum, l) => sum + Number(l.severity || 0), 0) / Math.max(severityLogs.length, 1);
      trackerSummary.textContent = migraineDays
        ? `${migraineDays} migraine day${migraineDays === 1 ? '' : 's'} in the last ${recent.length} log${recent.length === 1 ? '' : 's'}. Avg severity ${avgSeverity.toFixed(1)}.`
        : `No migraine days in the last ${recent.length} log${recent.length === 1 ? '' : 's'}.`;
    }
  }

  if (quickHelpText) {
    quickHelpText.textContent = attackDone >= 3
      ? `${attackDone} quick-help steps are checked right now for little one.`
      : 'Water, dim room, rest eyes, ice pack, and a small caffeine only if it’s early.';
  }
}

function wireBackupTools() {
  const exportBackupBtn = document.getElementById('exportBackupBtn');
  const importBackupInput = document.getElementById('importBackupInput');

  if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', () => {
      const payload = {
        version: 5,
        exportedAt: new Date().toISOString(),
        logs: getLogs(),
        daily: getDailyState(),
        attack: getAttackState()
      };
      downloadFile(`migraine-helper-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    });
  }

  if (importBackupInput) {
    importBackupInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.logs) || !parsed.daily || !parsed.attack) throw new Error('Bad backup');
        setLogs(parsed.logs);
        setDailyState(parsed.daily);
        setAttackState(parsed.attack);
        updateAllViews();
        showToast('Backup imported');
      } catch {
        showToast('Import failed');
      }
      event.target.value = '';
    });
  }
}

function buildInsights(logs, dailyState) {
  const migraineLogs = logs.filter(log => log.hadMigraine === 'Yes');
  const insights = [];

  if (!logs.length) {
    insights.push({ title: 'Start with a few logs', body: 'Once little one logs a few days, this screen will start spotting patterns.' });
    return insights;
  }

  const recent = logs.slice(0, 7);
  const recentMigraineCount = recent.filter(log => log.hadMigraine === 'Yes').length;
  if (recentMigraineCount >= 4) {
    insights.push({ title: 'Busy migraine streak', body: `Little one logged ${recentMigraineCount} migraine days in the last ${recent.length} entries.` });
  } else if (recentMigraineCount === 0 && recent.length >= 3) {
    insights.push({ title: 'Gentler stretch', body: `No migraine days in the last ${recent.length} entries.` });
  }

  if (migraineLogs.length) {
    const avgSeverity = migraineLogs.reduce((sum, log) => sum + Number(log.severity || 0), 0) / migraineLogs.length;
    insights.push({ title: 'Severity trend', body: `Average logged migraine severity is ${avgSeverity.toFixed(1)} / 10.` });
  }

  const triggerCounts = {};
  migraineLogs.forEach(log => {
    const trigger = (log.trigger || '').trim().toLowerCase();
    if (trigger) triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
  });
  const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  if (topTrigger && topTrigger[1] >= 2) {
    insights.push({ title: 'Possible repeat trigger', body: `“${titleCase(topTrigger[0])}” showed up ${topTrigger[1]} times in migraine logs.` });
  }

  const highSeverity = migraineLogs.filter(log => Number(log.severity) >= 7).length;
  if (highSeverity >= 2) {
    insights.push({ title: 'Higher pain days', body: `${highSeverity} saved migraine logs were severity 7 or above.` });
  }

  const notesText = migraineLogs.map(log => `${log.trigger || ''} ${log.notes || ''}`.toLowerCase()).join(' ');
  const keywords = [
    ['sleep', 'Sleep may be involved more than once in saved notes or triggers.'],
    ['stress', 'Stress shows up in saved notes or triggers more than once.'],
    ['meal', 'Skipped meals or food timing may be worth watching.'],
    ['caffeine', 'Caffeine appears in saved notes or triggers, so timing may matter.'],
    ['period', 'Cycle-related migraines may be worth tracking more closely.'],
    ['weather', 'Weather appears in notes or triggers more than once.']
  ];
  for (const [keyword, body] of keywords) {
    const count = notesText.split(keyword).length - 1;
    if (count >= 2) {
      insights.push({ title: 'Keyword pattern', body });
      break;
    }
  }

  const doneCount = Object.values(dailyState.items).filter(Boolean).length;
  if (doneCount <= 2) {
    insights.push({ title: 'Gentle routine nudge', body: 'Only a few daily items are checked today. Small routine consistency may help little one feel steadier.' });
  } else if (doneCount === DAILY_ITEMS.length) {
    insights.push({ title: 'Routine win', body: 'All daily routine items are checked off today.' });
  }

  return insights.slice(0, 4);
}

function updateInsights() {
  const insightsEl = document.getElementById('insightsList');
  if (!insightsEl) return;
  const insights = buildInsights(getLogs(), getDailyState());
  if (!insights.length) {
    insightsEl.className = 'insight-list empty-state';
    insightsEl.textContent = 'No insights yet.';
    return;
  }
  insightsEl.className = 'insight-list';
  insightsEl.innerHTML = insights.map(item => `
    <article class="insight-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.body)}</span>
    </article>
  `).join('');
}

function updateAllViews() {
  renderLogs();
  updateDailyView();
  updateHomeSummary();
  updateInsights();
}

function titleCase(value) {
  return String(value).replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function installHint() {
  const btn = document.getElementById('installHintBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    showToast('Safari → Share → Add to Home Screen');
  });
}
