(function () {
  "use strict";

  const STORAGE_KEY = "feeding_sessions";

  // --- State ---
  let sessions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  let selectedSide = null;
  let timerStart = null;
  let timerInterval = null;
  let paused = false;
  let elapsedBeforePause = 0;

  // --- DOM refs ---
  const timerText = document.getElementById("timer-text");
  const timerDisplay = document.querySelector(".timer-display");
  const startBtn = document.getElementById("start-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const stopBtn = document.getElementById("stop-btn");
  const lastFeedingEl = document.getElementById("last-feeding");
  const lastSideHint = document.getElementById("last-side-hint");
  const historyList = document.getElementById("history-list");
  const clearHistoryBtn = document.getElementById("clear-history");
  const patternsContent = document.getElementById("patterns-content");
  const sideBtns = document.querySelectorAll(".side-btn");
  const tabs = document.querySelectorAll(".tab");

  // --- Helpers ---
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function fmtDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function gapText(ms) {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m gap`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m gap` : `${h}h gap`;
  }

  // --- Tabs ---
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.tab);
      target.classList.add("active");

      if (tab.dataset.tab === "history") renderHistory();
      if (tab.dataset.tab === "patterns") renderPatterns();
    });
  });

  // --- Side picker ---
  sideBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sideBtns.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedSide = btn.dataset.side;
    });
  });

  // --- Timer ---
  function getElapsed() {
    if (!timerStart) return elapsedBeforePause;
    return elapsedBeforePause + Math.floor((Date.now() - timerStart) / 1000);
  }

  function updateTimer() {
    timerText.textContent = fmtDuration(getElapsed());
  }

  startBtn.addEventListener("click", () => {
    if (!selectedSide) {
      sideBtns.forEach((b) => {
        b.style.animation = "none";
        b.offsetHeight;
        b.style.animation = "";
        b.style.border = "3px solid #d4645c";
        setTimeout(() => (b.style.border = ""), 1000);
      });
      return;
    }
    timerStart = Date.now();
    paused = false;
    elapsedBeforePause = 0;
    timerDisplay.classList.remove("paused");
    timerInterval = setInterval(updateTimer, 1000);
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    sideBtns.forEach((b) => (b.disabled = true));
  });

  pauseBtn.addEventListener("click", () => {
    if (paused) {
      // Resume
      timerStart = Date.now();
      timerDisplay.classList.remove("paused");
      timerInterval = setInterval(updateTimer, 1000);
      pauseBtn.textContent = "Pause";
    } else {
      // Pause
      elapsedBeforePause = getElapsed();
      timerStart = null;
      clearInterval(timerInterval);
      timerDisplay.classList.add("paused");
      pauseBtn.textContent = "Resume";
    }
    paused = !paused;
  });

  stopBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    const durationSec = getElapsed();

    const session = {
      id: Date.now().toString(),
      side: selectedSide,
      startTime: new Date(Date.now() - durationSec * 1000).toISOString(),
      endTime: new Date().toISOString(),
      durationSec,
    };

    sessions.unshift(session);
    save();

    // Reset
    timerStart = null;
    paused = false;
    elapsedBeforePause = 0;
    timerDisplay.classList.remove("paused");
    timerText.textContent = "00:00";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Pause";
    stopBtn.disabled = true;
    sideBtns.forEach((b) => {
      b.disabled = false;
      b.classList.remove("selected");
    });
    selectedSide = null;

    updateLastFeeding();
    updateLastSideHint();
  });

  // --- Last side hint ---
  function updateLastSideHint() {
    if (sessions.length === 0) {
      lastSideHint.innerHTML = "";
      return;
    }
    const last = sessions[0];
    const opposite = last.side === "left" ? "right" : "left";
    lastSideHint.innerHTML = `Last side: <span class="hint-${last.side}">${last.side}</span> → Try <span class="hint-${opposite}">${opposite}</span> next`;
  }

  updateLastSideHint();

  // --- Last feeding ---
  function updateLastFeeding() {
    if (sessions.length === 0) {
      lastFeedingEl.textContent = "";
      return;
    }
    const last = sessions[0];
    const ago = Math.round((Date.now() - new Date(last.endTime).getTime()) / 60000);
    let agoText;
    if (ago < 1) agoText = "just now";
    else if (ago < 60) agoText = `${ago}m ago`;
    else {
      const h = Math.floor(ago / 60);
      const m = ago % 60;
      agoText = m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
    }
    lastFeedingEl.textContent = `Last feeding: ${last.side} side, ${fmtDuration(last.durationSec)} — ${agoText}`;
  }

  setInterval(updateLastFeeding, 60000);
  updateLastFeeding();

  // --- History ---
  function renderHistory() {
    if (sessions.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No sessions yet. Start tracking!</div>';
      return;
    }

    let currentDate = "";
    let html = "";

    sessions.forEach((s, i) => {
      const date = fmtDate(s.startTime);
      if (date !== currentDate) {
        currentDate = date;
        html += `<div style="font-size:0.75rem;color:#5a5a68;font-weight:600;margin-top:14px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">${date}</div>`;
      }

      let gapHtml = "";
      if (i < sessions.length - 1) {
        const prevEnd = new Date(sessions[i + 1].endTime).getTime();
        const thisStart = new Date(s.startTime).getTime();
        const gap = thisStart - prevEnd;
        if (gap > 0) gapHtml = `<div class="gap-label">${gapText(gap)}</div>`;
      }

      html += `
        <div class="history-item">
          <div class="info">
            <span class="side-label ${s.side}">${s.side.charAt(0).toUpperCase() + s.side.slice(1)}</span>
            <span class="time-info">${fmtTime(s.startTime)} — ${fmtTime(s.endTime)}</span>
          </div>
          <div style="text-align:right">
            <div class="duration">${fmtDuration(s.durationSec)}</div>
            ${gapHtml}
          </div>
          <button class="delete-btn" data-id="${s.id}" title="Delete">✕</button>
        </div>`;
    });

    historyList.innerHTML = html;

    historyList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        sessions = sessions.filter((s) => s.id !== btn.dataset.id);
        save();
        renderHistory();
        updateLastFeeding();
        updateLastSideHint();
      });
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    if (sessions.length === 0) return;
    if (confirm("Clear all feeding history?")) {
      sessions = [];
      save();
      renderHistory();
      updateLastFeeding();
      updateLastSideHint();
    }
  });

  // --- Patterns ---
  function renderPatterns() {
    if (sessions.length < 2) {
      patternsContent.innerHTML =
        '<div class="empty-state">Track a few sessions to see your feeding patterns here.</div>';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = sessions.filter((s) => new Date(s.startTime) >= today);
    const last7 = sessions.filter(
      (s) => Date.now() - new Date(s.startTime).getTime() < 7 * 86400000
    );

    // Average gap
    const gaps = [];
    for (let i = 0; i < sessions.length - 1; i++) {
      const gap =
        new Date(sessions[i].startTime).getTime() -
        new Date(sessions[i + 1].endTime).getTime();
      if (gap > 0 && gap < 12 * 3600000) gaps.push(gap);
    }
    const avgGapMs = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const avgGapMins = Math.round(avgGapMs / 60000);

    // Average duration
    const avgDur =
      sessions.length > 0
        ? Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / sessions.length)
        : 0;

    // Side balance (last 7 days)
    const leftCount = last7.filter((s) => s.side === "left").length;
    const rightCount = last7.filter((s) => s.side === "right").length;
    const total7 = leftCount + rightCount;

    // Gap consistency (std deviation)
    let gapStdDev = 0;
    if (gaps.length > 1) {
      const mean = avgGapMs;
      const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / gaps.length;
      gapStdDev = Math.sqrt(variance) / 60000;
    }

    let html = "";

    // Today's summary
    html += `<div class="stat-card">
      <h3>Today</h3>
      <div class="stat-value">${todaySessions.length} feedings</div>
      <div class="stat-detail">Total: ${fmtDuration(todaySessions.reduce((a, s) => a + s.durationSec, 0))}</div>
    </div>`;

    // Key stats grid
    html += `<div class="stat-grid">
      <div class="stat-card">
        <h3>Avg. Gap</h3>
        <div class="stat-value">${avgGapMins < 60 ? avgGapMins + "m" : Math.floor(avgGapMins / 60) + "h " + (avgGapMins % 60) + "m"}</div>
        <div class="stat-detail">between feedings</div>
      </div>
      <div class="stat-card">
        <h3>Avg. Duration</h3>
        <div class="stat-value">${fmtDuration(avgDur)}</div>
        <div class="stat-detail">per feeding</div>
      </div>
    </div>`;

    // Side balance
    html += `<div class="stat-card">
      <h3>Side Balance (7 days)</h3>
      <div style="display:flex;gap:4px;align-items:center;margin-top:10px;">
        <div style="flex:${leftCount || 1};height:28px;background:#d48cb3;border-radius:8px 0 0 8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:600;letter-spacing:0.5px;">L: ${leftCount}</div>
        <div style="flex:${rightCount || 1};height:28px;background:#7bb8d4;border-radius:0 8px 8px 0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:600;letter-spacing:0.5px;">R: ${rightCount}</div>
      </div>
      <div class="stat-detail">${total7 > 0 ? Math.round((leftCount / total7) * 100) : 0}% left / ${total7 > 0 ? Math.round((rightCount / total7) * 100) : 0}% right</div>
    </div>`;

    // Timeline (today)
    if (todaySessions.length > 0) {
      html += `<div class="stat-card"><h3>Today's Timeline</h3><div class="timeline">`;
      for (let h = 0; h < 24; h++) {
        const hourFeedings = todaySessions.filter((s) => new Date(s.startTime).getHours() === h);
        let bars = "";
        hourFeedings.forEach((s) => {
          const startMin = new Date(s.startTime).getMinutes();
          const leftPct = (startMin / 60) * 100;
          const widthPct = Math.max((s.durationSec / 3600) * 100, 2);
          bars += `<div class="timeline-bar ${s.side}" style="left:${leftPct}%;width:${widthPct}%"></div>`;
        });
        if (bars || h <= new Date().getHours()) {
          html += `<div class="timeline-row">
            <span class="timeline-hour">${h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p"}</span>
            <div class="timeline-bar-container">${bars}</div>
          </div>`;
        }
      }
      html += `</div></div>`;
    }

    // Schedule readiness hint
    html += `<div class="schedule-hint"><h3>📋 Schedule Readiness</h3>`;
    if (avgGapMins > 0 && gapStdDev < 30 && avgGapMins >= 90) {
      html += `<p>Your feeding gaps are fairly consistent (avg ${avgGapMins < 60 ? avgGapMins + " min" : Math.floor(avgGapMins / 60) + "h " + (avgGapMins % 60) + "m"}, ±${Math.round(gapStdDev)} min). You may be ready to start transitioning to a more predictable schedule around every ${Math.round(avgGapMins / 30) * 30 >= 60 ? Math.round(avgGapMins / 30) * 0.5 + " hours" : Math.round(avgGapMins / 30) * 30 + " minutes"}.</p>`;
    } else if (avgGapMins > 0) {
      html += `<p>Feeding gaps vary quite a bit right now (avg ${avgGapMins < 60 ? avgGapMins + " min" : Math.floor(avgGapMins / 60) + "h " + (avgGapMins % 60) + "m"}, ±${Math.round(gapStdDev)} min). Keep tracking to identify when a natural rhythm emerges — you'll see this hint update as patterns stabilize.</p>`;
    } else {
      html += `<p>Keep tracking! More data will help identify your natural feeding rhythm.</p>`;
    }
    html += `</div>`;

    patternsContent.innerHTML = html;
  }
})();
