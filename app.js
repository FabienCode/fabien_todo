const STORAGE_KEY = "personal-todo-state-v1";
const CHANNEL_NAME = "personal-todo-sync";

const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m20 6-11 11-5-5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1A1.7 1.7 0 0 0 19.4 9c.2.6.8 1 1.5 1h.1a2 2 0 1 1 0 4h-.1c-.7 0-1.3.4-1.5 1Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>'
};

const now = new Date();
const today = toDateKey(now);
let state = loadState();
let activeFilter = "all";
let searchQuery = "";
let channel;

document.addEventListener("DOMContentLoaded", init);

function init() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icons[node.dataset.icon] || "";
  });

  document.getElementById("todayLabel").textContent = formatLongDate(now);
  setupNavigation();
  setupForms();
  setupSync();
  setupNotifications();
  render();
  window.setInterval(checkDueReminders, 30_000);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const sample = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
  return sample;
}

function seedState() {
  const plusHours = (hours) => {
    const date = new Date();
    date.setHours(date.getHours() + hours, 0, 0, 0);
    return date.toISOString();
  };

  const doneYesterday = new Date();
  doneYesterday.setDate(doneYesterday.getDate() - 1);

  return {
    todos: [
      createTodo("预约体检", "健康", "high", plusHours(3)),
      createTodo("整理发票", "财务", "medium", plusHours(6)),
      createTodo("阅读一章书", "学习", "low", plusHours(8)),
      createTodo("晚上跑步", "健康", "medium", plusHours(10)),
      createTodo("给家人回电话", "家庭", "high", plusHours(9)),
      { ...createTodo("更新购物清单", "生活", "medium", plusHours(2)), status: "done", completedAt: new Date().toISOString() }
    ],
    reminders: [
      createReminder("取快递", plusHours(1), "none"),
      createReminder("给家人回电话", plusHours(4), "none"),
      createReminder("晚间跑步", plusHours(8), "daily")
    ],
    events: [
      createEvent("完成", "更新购物清单", "生活", new Date().toISOString()),
      createEvent("完成", "清理下载文件夹", "生活", doneYesterday.toISOString()),
      createEvent("完成", "复习英语单词", "学习", doneYesterday.toISOString())
    ],
    updatedAt: new Date().toISOString()
  };
}

function createTodo(title, category, priority, dueAt) {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    priority,
    dueAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

function createReminder(title, remindAt, repeat) {
  return {
    id: crypto.randomUUID(),
    title,
    remindAt,
    repeat,
    channels: ["网页", "App"],
    notifiedAt: null,
    createdAt: new Date().toISOString()
  };
}

function createEvent(type, title, category, createdAt = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    category,
    createdAt
  };
}

function persist({ silent = false } = {}) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!silent && channel) {
    channel.postMessage({ type: "state", state });
  }
  render();
}

function setupSync() {
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type !== "state") return;
      state = event.data.state;
      persist({ silent: true });
    };
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    state = JSON.parse(event.newValue);
    render();
  });

  const hasSupabaseConfig = Boolean(window.TODO_SUPABASE_URL && window.TODO_SUPABASE_ANON_KEY);
  if (hasSupabaseConfig) {
    document.getElementById("syncDot").classList.add("cloud");
    document.getElementById("syncTitle").textContent = "云端同步";
    document.getElementById("syncText").textContent = "已检测到 Supabase 配置，可继续接入云端数据。";
  }
}

function setupNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-shortcut]").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.viewShortcut));
  });
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  document.getElementById("searchInput").addEventListener("input", (event) => {
    searchQuery = event.target.value.trim().toLowerCase();
    render();
  });
}

function activateView(view) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  const titleMap = {
    home: "首页",
    todos: "待办清单",
    reminders: "提醒事项",
    calendar: "日历",
    review: "回顾",
    settings: "设置"
  };
  document.getElementById("viewTitle").textContent = titleMap[view] || "首页";
}

function setupForms() {
  document.getElementById("todoForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("todoTitle").value.trim();
    if (!title) return;

    const todo = createTodo(
      title,
      document.getElementById("todoCategory").value,
      document.getElementById("todoPriority").value,
      document.getElementById("todoDue").value ? new Date(document.getElementById("todoDue").value).toISOString() : null
    );
    state.todos.unshift(todo);
    state.events.unshift(createEvent("新建", todo.title, todo.category));
    event.target.reset();
    persist();
  });

  document.getElementById("reminderForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = document.getElementById("reminderTitle").value.trim();
    const remindAt = document.getElementById("reminderAt").value;
    if (!title || !remindAt) return;

    state.reminders.unshift(createReminder(title, new Date(remindAt).toISOString(), document.getElementById("reminderRepeat").value));
    state.events.unshift(createEvent("提醒", title, "提醒"));
    event.target.reset();
    persist();
  });

  document.getElementById("openReminderForm").addEventListener("click", () => {
    activateView("reminders");
    document.getElementById("reminderTitle").focus();
  });
}

function setupNotifications() {
  document.getElementById("notificationButton").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  });
}

function render() {
  const todos = getFilteredTodos(state.todos);
  const todayTodos = todos.filter((todo) => isToday(todo.dueAt) || todo.status === "pending").slice(0, 8);
  renderTodos(document.getElementById("todayTodos"), filterByStatus(todayTodos, activeFilter));
  renderTodos(document.getElementById("allTodos"), todos);
  renderReminders(document.getElementById("upcomingReminders"), getUpcomingReminders().slice(0, 5));
  renderReminders(document.getElementById("allReminders"), getUpcomingReminders());
  renderCalendar(document.getElementById("miniCalendar"), false);
  renderCalendar(document.getElementById("calendarBoard"), true);
  renderAgenda();
  renderReview();
}

function getFilteredTodos(todos) {
  const query = searchQuery;
  return [...todos]
    .filter((todo) => !query || [todo.title, todo.category, todo.status].join(" ").toLowerCase().includes(query))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || new Date(a.dueAt || 8640000000000000) - new Date(b.dueAt || 8640000000000000));
}

function filterByStatus(todos, filter) {
  if (filter === "pending") return todos.filter((todo) => todo.status !== "done");
  if (filter === "done") return todos.filter((todo) => todo.status === "done");
  return todos;
}

function renderTodos(container, todos) {
  if (!todos.length) {
    container.innerHTML = '<div class="empty">暂无待办，添加一个接下来要做的小事。</div>';
    return;
  }

  container.innerHTML = todos
    .map((todo) => {
      const priorityLabel = { high: "重要", medium: "普通", low: "轻松" }[todo.priority] || "普通";
      return `
        <article class="todo-item ${todo.status === "done" ? "done" : ""}">
          <button class="todo-check" data-action="toggle" data-id="${todo.id}" type="button" aria-label="切换完成">${todo.status === "done" ? icons.check : ""}</button>
          <div>
            <p class="todo-title">${escapeHtml(todo.title)}</p>
            <div class="todo-meta">
              <span class="chip">${escapeHtml(todo.category)}</span>
              <span class="chip ${todo.priority}">${priorityLabel}</span>
              ${todo.dueAt ? `<span class="chip">${formatDateTime(todo.dueAt)}</span>` : ""}
            </div>
          </div>
          <div class="row-actions">
            <button data-action="delay" data-id="${todo.id}" type="button" aria-label="延期">${icons.rotate}</button>
            <button data-action="delete" data-id="${todo.id}" type="button" aria-label="删除">${icons.trash}</button>
          </div>
        </article>
      `;
    })
    .join("");

  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTodoAction(button.dataset.action, button.dataset.id));
  });
}

function handleTodoAction(action, id) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  if (action === "toggle") {
    todo.status = todo.status === "done" ? "pending" : "done";
    todo.completedAt = todo.status === "done" ? new Date().toISOString() : null;
    state.events.unshift(createEvent(todo.status === "done" ? "完成" : "恢复", todo.title, todo.category));
  }

  if (action === "delay") {
    const due = todo.dueAt ? new Date(todo.dueAt) : new Date();
    due.setDate(due.getDate() + 1);
    todo.dueAt = due.toISOString();
    state.events.unshift(createEvent("延期", todo.title, todo.category));
  }

  if (action === "delete") {
    state.todos = state.todos.filter((item) => item.id !== id);
    state.events.unshift(createEvent("删除", todo.title, todo.category));
  }

  persist();
}

function getUpcomingReminders() {
  return [...state.reminders]
    .filter((reminder) => !searchQuery || reminder.title.toLowerCase().includes(searchQuery))
    .sort((a, b) => new Date(a.remindAt) - new Date(b.remindAt));
}

function renderReminders(container, reminders) {
  if (!reminders.length) {
    container.innerHTML = '<div class="empty">暂无提醒，可以为重要事项设置一个时间。</div>';
    return;
  }

  container.innerHTML = reminders
    .map((reminder) => `
      <article class="reminder-item">
        <div class="reminder-time">${formatTime(reminder.remindAt)}</div>
        <div>
          <p class="reminder-title">${escapeHtml(reminder.title)}</p>
          <div class="reminder-meta">
            <span class="chip">${formatDate(reminder.remindAt)}</span>
            ${reminder.channels.map((channelName) => `<span class="chip">${channelName}</span>`).join("")}
            ${reminder.repeat !== "none" ? `<span class="chip high">${repeatLabel(reminder.repeat)}</span>` : ""}
          </div>
        </div>
      </article>
    `)
    .join("");
}

function renderCalendar(container, large) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  ["一", "二", "三", "四", "五", "六", "日"].forEach((day) => {
    cells.push(`<div class="calendar-cell">${day}</div>`);
  });

  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="calendar-cell"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const items = state.todos.filter((todo) => todo.dueAt && toDateKey(new Date(todo.dueAt)) === key);
    const classes = ["calendar-cell", key === today ? "today" : "", items.length ? "has-items" : ""].join(" ");
    cells.push(`<div class="${classes}"><span>${day}</span>${large && items.length ? `<small>${items.length} 项</small>` : ""}</div>`);
  }

  container.innerHTML = cells.join("");
}

function renderAgenda() {
  const todayItems = state.todos.filter((todo) => todo.dueAt && isToday(todo.dueAt));
  document.getElementById("selectedAgenda").innerHTML = todayItems.length
    ? todayItems.slice(0, 3).map((todo) => `<strong>${formatTime(todo.dueAt)}</strong> ${escapeHtml(todo.title)}`).join("<br>")
    : "今天还没有设置具体时间的事项。";
}

function renderReview() {
  const weekEvents = state.events.filter((event) => isThisWeek(event.createdAt));
  const completed = weekEvents.filter((event) => event.type === "完成");
  const delayed = weekEvents.filter((event) => event.type === "延期");
  const topCategory = getTopCategory(completed);

  document.getElementById("doneCount").textContent = completed.length;
  document.getElementById("delayedCount").textContent = delayed.length;
  document.getElementById("topCategory").textContent = topCategory;
  document.getElementById("streakCount").textContent = `${getStreak()} 天`;
  renderBars();

  const history = [...state.events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderHistory(document.getElementById("weeklyFeed"), history.slice(0, 5));
  renderHistory(document.getElementById("recentDone"), history.filter((event) => event.type === "完成").slice(0, 4));
  renderHistory(document.getElementById("reviewFeed"), history);
}

function renderBars() {
  const labels = ["一", "二", "三", "四", "五", "六", "日"];
  const counts = labels.map((_, index) => {
    const date = startOfWeek(new Date());
    date.setDate(date.getDate() + index);
    const key = toDateKey(date);
    return state.events.filter((event) => event.type === "完成" && toDateKey(new Date(event.createdAt)) === key).length;
  });
  const max = Math.max(...counts, 1);
  document.getElementById("completionChart").innerHTML = counts
    .map((count, index) => `
      <div class="bar">
        <span style="height:${Math.max(8, (count / max) * 100)}%"></span>
        <span>周${labels[index]}</span>
      </div>
    `)
    .join("");
}

function renderHistory(container, events) {
  if (!events.length) {
    container.innerHTML = '<div class="empty">还没有回顾记录。完成一个待办后，这里会自动出现。</div>';
    return;
  }

  container.innerHTML = events
    .map((event) => `
      <article class="history-item">
        <strong>${escapeHtml(event.type)}：${escapeHtml(event.title)}</strong>
        <div class="history-meta">
          <span class="chip">${escapeHtml(event.category)}</span>
          <span class="chip">${formatDateTime(event.createdAt)}</span>
        </div>
      </article>
    `)
    .join("");
}

function checkDueReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const current = Date.now();
  let changed = false;
  state.reminders.forEach((reminder) => {
    const remindTime = new Date(reminder.remindAt).getTime();
    const alreadyNotified = reminder.notifiedAt && new Date(reminder.notifiedAt).getTime() >= remindTime;
    if (!alreadyNotified && remindTime <= current) {
      new Notification("今日待办提醒", { body: reminder.title });
      reminder.notifiedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) persist();
}

function getTopCategory(events) {
  if (!events.length) return "-";
  const counts = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getStreak() {
  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < 30; i += 1) {
    const key = toDateKey(cursor);
    const hasEvent = state.events.some((event) => toDateKey(new Date(event.createdAt)) === key);
    if (!hasEvent) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function isToday(value) {
  if (!value) return false;
  return toDateKey(new Date(value)) === today;
}

function isThisWeek(value) {
  const date = new Date(value);
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return date >= start && date < end;
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - day);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatDateTime(value) {
  return `${formatDate(value)} ${formatTime(value)}`;
}

function repeatLabel(value) {
  return { daily: "每天", weekly: "每周", monthly: "每月" }[value] || "不重复";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
