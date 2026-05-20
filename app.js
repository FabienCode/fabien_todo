const STORAGE_KEY = "personal-todo-state-v1";
const CHANNEL_NAME = "personal-todo-sync";
const CLOUD_MIGRATED_KEY = "personal-todo-cloud-migrated-v1";

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
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>',
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m16 10-3 2 3 2"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>'
};

const now = new Date();
const today = toDateKey(now);
let state = loadState();
let activeFilter = "all";
let searchQuery = "";
let channel;
let supabaseClient = null;
let currentUser = null;
let realtimeChannel = null;
let categoryCache = new Map();
let isApplyingCloudState = false;
let expandedTodoIds = new Set();
let expandedReminderIds = new Set();
let expandedInlineFormScopes = new Set();
let draftSubtasksByScope = new Map();
let selectedDateKey = today;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icons[node.dataset.icon] || "";
  });

  document.getElementById("todayLabel").textContent = formatLongDate(now);
  setupNavigation();
  setupForms();
  setupSidebar();
  setupSync();
  await setupSupabase();
  setupAuth();
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
    note: "",
    subtasks: [],
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

async function persist({ silent = false, skipCloud = false } = {}) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!silent && channel) {
    channel.postMessage({ type: "state", state });
  }
  render();
  if (!skipCloud && currentUser && !isApplyingCloudState) {
    await saveCloudState();
  }
}

function setupSync() {
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type !== "state") return;
      state = event.data.state;
      void persist({ silent: true, skipCloud: true });
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
    document.getElementById("syncText").textContent = "已检测到 Supabase 配置，登录后启用云端读写。";
  }
}

async function setupSupabase() {
  const rawUrl = window.TODO_SUPABASE_URL || "";
  const key = window.TODO_SUPABASE_ANON_KEY || "";
  if (!rawUrl || !key || !window.supabase) {
    updateAuthStatus("未配置 Supabase，当前使用本地模式。");
    return;
  }

  const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  supabaseClient = window.supabase.createClient(url, key);
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    updateAuthStatus(`登录状态检查失败：${error.message}`);
    return;
  }

  currentUser = data.session?.user || null;
  updateAuthUi();
  if (currentUser) {
    await initializeCloudForUser();
  }

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    updateAuthUi();
    if (currentUser) {
      await initializeCloudForUser();
    } else {
      unsubscribeRealtime();
      updateSyncBadge("本地模式", "已退出登录，当前数据保存在本地浏览器。", false);
    }
  });
}

function setupAuth() {
  const form = document.getElementById("authForm");
  const signUp = document.getElementById("authSignUp");
  const signOut = document.getElementById("authSignOut");
  if (!form || !signUp || !signOut) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signInWithPassword();
  });

  signUp.addEventListener("click", async () => {
    await signUpWithPassword();
  });

  signOut.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
  });
}

async function signInWithPassword() {
  if (!supabaseClient) {
    updateAuthStatus("请先填写 Supabase 配置。");
    return;
  }
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  updateAuthStatus(error ? `登录失败：${error.message}` : "登录成功，正在同步云端数据。");
}

async function signUpWithPassword() {
  if (!supabaseClient) {
    updateAuthStatus("请先填写 Supabase 配置。");
    return;
  }
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    updateAuthStatus(`注册失败：${error.message}`);
    return;
  }
  updateAuthStatus(data.session ? "注册成功，正在同步云端数据。" : "注册成功，请先查看邮箱确认邮件，再回来登录。");
}

async function initializeCloudForUser() {
  updateSyncBadge("云端同步", "已登录，正在同步 Supabase 数据。", true);
  const migratedKey = `${CLOUD_MIGRATED_KEY}:${currentUser.id}`;
  if (!localStorage.getItem(migratedKey)) {
    await saveCloudState();
    localStorage.setItem(migratedKey, "1");
  }
  await loadCloudState();
  subscribeRealtime();
  updateSyncBadge("云端同步", `已登录：${currentUser.email || "当前用户"}`, true);
}

function updateAuthUi() {
  const form = document.getElementById("authForm");
  const signOut = document.getElementById("authSignOut");
  if (!form || !signOut) return;
  form.classList.toggle("hidden", Boolean(currentUser));
  signOut.classList.toggle("hidden", !currentUser);
  updateAuthStatus(currentUser ? `已登录：${currentUser.email || currentUser.id}` : "未登录。登录后可跨浏览器和未来 App 同步。");
}

function updateAuthStatus(text) {
  const node = document.getElementById("authStatus");
  if (node) node.textContent = text;
}

function updateSyncBadge(title, text, cloud) {
  document.getElementById("syncTitle").textContent = title;
  document.getElementById("syncText").textContent = text;
  document.getElementById("syncDot").classList.toggle("cloud", cloud);
}

async function saveCloudState() {
  if (!supabaseClient || !currentUser) return;
  try {
    await supabaseClient.from("profiles").upsert({
      id: currentUser.id,
      display_name: currentUser.email?.split("@")[0] || "Todo User",
      avatar_url: null
    });

    categoryCache = await syncCategories(state.todos);
    await syncTodos();
    await syncSubtasks();
    await syncReminders();
    await syncEvents();
    updateSyncBadge("云端同步", `已同步：${currentUser.email || "当前用户"}`, true);
  } catch (error) {
    updateSyncBadge("同步异常", error.message || "云端同步失败，请稍后重试。", false);
  }
}

async function loadCloudState() {
  if (!supabaseClient || !currentUser) return;
  const [categoriesResult, todosResult, subtasksResult, remindersResult, eventsResult] = await Promise.all([
    supabaseClient.from("categories").select("*").eq("user_id", currentUser.id),
    supabaseClient.from("todos").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
    supabaseClient.from("todo_subtasks").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: true }),
    supabaseClient.from("reminders").select("*").eq("user_id", currentUser.id).order("remind_at", { ascending: true }),
    supabaseClient.from("todo_events").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false })
  ]);

  const error = categoriesResult.error || todosResult.error || subtasksResult.error || remindersResult.error || eventsResult.error;
  if (error) {
    updateAuthStatus(`云端读取失败：${error.message}`);
    updateSyncBadge("同步异常", error.message.includes("todo_subtasks") ? "请在 Supabase 执行子事项表 SQL 后刷新页面。" : error.message, false);
    return;
  }

  const categoriesById = new Map((categoriesResult.data || []).map((category) => [category.id, category]));
  categoryCache = new Map((categoriesResult.data || []).map((category) => [category.name, category.id]));
  const subtasksByTodo = (subtasksResult.data || []).reduce((acc, subtask) => {
    const items = acc.get(subtask.todo_id) || [];
    items.push({
      id: subtask.id,
      title: subtask.title,
      done: Boolean(subtask.done),
      createdAt: subtask.created_at,
      completedAt: subtask.completed_at
    });
    acc.set(subtask.todo_id, items);
    return acc;
  }, new Map());

  isApplyingCloudState = true;
  state = {
    todos: (todosResult.data || []).map((todo) => ({
      id: todo.id,
      title: todo.title,
      category: categoriesById.get(todo.category_id)?.name || "其他",
      priority: todo.priority,
      dueAt: todo.due_at,
      note: todo.description || "",
      subtasks: subtasksByTodo.get(todo.id) || [],
      status: todo.status,
      createdAt: todo.created_at,
      completedAt: todo.completed_at
    })),
    reminders: (remindersResult.data || []).map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      remindAt: reminder.remind_at,
      repeat: reminder.repeat_rule,
      channels: mapChannelsFromCloud(reminder.channels),
      notifiedAt: reminder.notified_at,
      createdAt: reminder.created_at
    })),
    events: (eventsResult.data || []).map((event) => ({
      id: event.id,
      type: mapEventTypeFromCloud(event.event_type),
      title: event.title,
      category: event.category_name || "其他",
      createdAt: event.created_at
    })),
    updatedAt: new Date().toISOString()
  };
  await persist({ silent: true, skipCloud: true });
  isApplyingCloudState = false;
}

async function syncCategories(todos) {
  const names = [...new Set(todos.map((todo) => todo.category || "其他"))];
  if (!names.length) return new Map();

  const rows = names.map((name) => ({
    user_id: currentUser.id,
    name,
    color: categoryColor(name)
  }));
  const { data, error } = await supabaseClient
    .from("categories")
    .upsert(rows, { onConflict: "user_id,name" })
    .select("id,name");
  if (error) throw error;
  return new Map((data || []).map((category) => [category.name, category.id]));
}

async function syncTodos() {
  if (!state.todos.length) return;
  const rows = state.todos.map((todo) => normalizeTodo(todo)).map((todo) => ({
    id: todo.id,
    user_id: currentUser.id,
    category_id: categoryCache.get(todo.category || "其他") || null,
    title: todo.title,
    description: todo.note || null,
    status: todo.status === "done" ? "done" : "pending",
    priority: todo.priority || "medium",
    due_at: todo.dueAt || null,
    completed_at: todo.completedAt || null,
    created_at: todo.createdAt || new Date().toISOString()
  }));
  const { error } = await supabaseClient.from("todos").upsert(rows);
  if (error) throw error;
}

async function syncSubtasks() {
  const rows = state.todos.flatMap((todo) =>
    normalizeSubtasks(todo.subtasks).map((subtask) => ({
      id: subtask.id,
      user_id: currentUser.id,
      todo_id: todo.id,
      title: subtask.title,
      done: subtask.done,
      completed_at: subtask.completedAt,
      created_at: subtask.createdAt
    }))
  );
  if (!rows.length) return;
  const { error } = await supabaseClient.from("todo_subtasks").upsert(rows);
  if (error) throw error;
}

async function syncReminders() {
  if (!state.reminders.length) return;
  const rows = state.reminders.map((reminder) => ({
    id: reminder.id,
    user_id: currentUser.id,
    todo_id: null,
    title: reminder.title,
    remind_at: reminder.remindAt,
    repeat_rule: reminder.repeat || "none",
    channels: mapChannelsToCloud(reminder.channels),
    notified_at: reminder.notifiedAt || null,
    created_at: reminder.createdAt || new Date().toISOString()
  }));
  const { error } = await supabaseClient.from("reminders").upsert(rows);
  if (error) throw error;
}

async function syncEvents() {
  if (!state.events.length) return;
  const rows = state.events.map((event) => ({
    id: event.id,
    user_id: currentUser.id,
    todo_id: null,
    event_type: mapEventTypeToCloud(event.type),
    title: event.title,
    category_name: event.category || "其他",
    snapshot: { localType: event.type },
    created_at: event.createdAt || new Date().toISOString()
  }));
  const { error } = await supabaseClient.from("todo_events").upsert(rows);
  if (error) throw error;
}

function subscribeRealtime() {
  if (!supabaseClient || !currentUser) return;
  unsubscribeRealtime();
  realtimeChannel = supabaseClient
    .channel(`todo-user-${currentUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${currentUser.id}` }, loadCloudState)
    .on("postgres_changes", { event: "*", schema: "public", table: "todo_subtasks", filter: `user_id=eq.${currentUser.id}` }, loadCloudState)
    .on("postgres_changes", { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${currentUser.id}` }, loadCloudState)
    .on("postgres_changes", { event: "*", schema: "public", table: "todo_events", filter: `user_id=eq.${currentUser.id}` }, loadCloudState)
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel && supabaseClient) {
    supabaseClient.removeChannel(realtimeChannel);
  }
  realtimeChannel = null;
}

async function deleteCloudTodo(id) {
  if (!supabaseClient || !currentUser) return;
  await supabaseClient.from("todos").delete().eq("id", id).eq("user_id", currentUser.id);
}

async function deleteCloudSubtask(id) {
  if (!supabaseClient || !currentUser) return;
  await supabaseClient.from("todo_subtasks").delete().eq("id", id).eq("user_id", currentUser.id);
}

async function deleteCloudReminder(id) {
  if (!supabaseClient || !currentUser) return;
  await supabaseClient.from("reminders").delete().eq("id", id).eq("user_id", currentUser.id);
}

function mapEventTypeToCloud(type) {
  return {
    新建: "created",
    更新: "updated",
    完成: "completed",
    恢复: "restored",
    延期: "delayed",
    删除: "deleted",
    提醒: "reminder"
  }[type] || "updated";
}

function mapEventTypeFromCloud(type) {
  return {
    created: "新建",
    updated: "更新",
    completed: "完成",
    restored: "恢复",
    delayed: "延期",
    deleted: "删除",
    reminder: "提醒"
  }[type] || "更新";
}

function mapChannelsToCloud(channels = []) {
  return channels.map((channelName) => (channelName === "网页" ? "web" : channelName === "App" ? "app" : channelName));
}

function mapChannelsFromCloud(channels = []) {
  return channels.map((channelName) => (channelName === "web" ? "网页" : channelName === "app" ? "App" : channelName));
}

function categoryColor(name) {
  return {
    生活: "#1976d2",
    学习: "#12b5cb",
    家庭: "#3b82f6",
    健康: "#19a974",
    财务: "#f5a524",
    其他: "#64748b"
  }[name] || "#1976d2";
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

function setupSidebar() {
  const toggle = document.getElementById("sidebarToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    toggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "隐藏侧边栏");
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
  document.getElementById("reminderForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("reminderTitle").value.trim();
    const remindAt = document.getElementById("reminderAt").value;
    if (!title || !remindAt) return;

    state.reminders.unshift(createReminder(title, new Date(remindAt).toISOString(), document.getElementById("reminderRepeat").value));
    state.events.unshift(createEvent("提醒", title, "提醒"));
    event.target.reset();
    await persist();
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
    .map(normalizeTodo)
    .filter((todo) => !query || [todo.title, todo.category, todo.status, todo.note, todo.subtasks.map((item) => item.title).join(" ")].join(" ").toLowerCase().includes(query))
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || new Date(a.dueAt || 8640000000000000) - new Date(b.dueAt || 8640000000000000));
}

function filterByStatus(todos, filter) {
  if (filter === "pending") return todos.filter((todo) => todo.status !== "done");
  if (filter === "done") return todos.filter((todo) => todo.status === "done");
  return todos;
}

function normalizeTodo(todo) {
  return {
    ...todo,
    note: todo.note || todo.description || "",
    subtasks: normalizeSubtasks(todo.subtasks)
  };
}

function normalizeSubtasks(subtasks = []) {
  return subtasks.map((subtask) => ({
    id: subtask.id || crypto.randomUUID(),
    title: subtask.title || "",
    done: Boolean(subtask.done),
    createdAt: subtask.createdAt || new Date().toISOString(),
    completedAt: subtask.completedAt || null
  }));
}

function renderTodos(container, todos) {
  const listHtml = todos
    .map((todo) => {
      todo = normalizeTodo(todo);
      const priorityLabel = { high: "重要", medium: "普通", low: "轻松" }[todo.priority] || "普通";
      const doneSubtasks = todo.subtasks.filter((subtask) => subtask.done).length;
      return `
        <article class="todo-item ${todo.status === "done" ? "done" : ""}">
          <div class="todo-summary">
            <button class="todo-check" data-action="toggle" data-id="${todo.id}" type="button" aria-label="切换完成">${todo.status === "done" ? icons.check : ""}</button>
            <div>
              <button class="todo-title-button" data-action="details" data-id="${todo.id}" type="button">${escapeHtml(todo.title)}</button>
              <div class="todo-meta">
                <span class="chip">${escapeHtml(todo.category)}</span>
                <span class="chip ${todo.priority}">${priorityLabel}</span>
                ${todo.dueAt ? `<span class="chip">${formatDateTime(todo.dueAt)}</span>` : ""}
                ${todo.note ? `<span class="chip">${icons.note} 有备注</span>` : ""}
                ${todo.subtasks.length ? `<span class="chip">${icons.list} ${doneSubtasks}/${todo.subtasks.length} 子任务</span>` : ""}
              </div>
            </div>
            <div class="row-actions">
              <button class="detail-trigger" data-action="details" data-id="${todo.id}" type="button" aria-label="详情">${icons.list}<span>详情</span></button>
              <button data-action="delay" data-id="${todo.id}" type="button" aria-label="延期">${icons.rotate}</button>
              <button data-action="delete" data-id="${todo.id}" type="button" aria-label="删除">${icons.trash}</button>
            </div>
          </div>
          ${renderTodoDetails(todo)}
        </article>
      `;
    })
    .join("");

  container.innerHTML = `
    ${listHtml || '<div class="empty compact-empty">暂无待办，直接在下方添加一个。</div>'}
    ${renderInlineTodoForm(container.id)}
  `;

  container.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleTodoAction(button.dataset.action, button.dataset.id, button.dataset.subtaskId);
    });
  });
  container.querySelectorAll("[data-note]").forEach((textarea) => {
    textarea.addEventListener("change", () => {
      void updateTodoNote(textarea.dataset.note, textarea.value);
    });
  });
  container.querySelectorAll("[data-subtask-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector("input");
      void addSubtask(form.dataset.subtaskForm, input.value);
      input.value = "";
    });
  });
  container.querySelectorAll("[data-inline-todo-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void addInlineTodoFromForm(form);
    });
    form.querySelector('[name="title"]').addEventListener("focus", () => {
      expandedInlineFormScopes.add(form.dataset.inlineTodoForm);
      form.classList.add("is-expanded");
    });
  });
  container.querySelectorAll("[data-draft-subtask-form]").forEach((form) => {
    const input = form.querySelector("input");
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const added = addDraftSubtask(form.dataset.draftSubtaskForm, input.value);
      if (added) {
        const list = form.parentElement.querySelector("[data-draft-subtask-list]");
        list.insertAdjacentHTML("beforeend", `<div class="draft-subtask">${escapeHtml(added)}</div>`);
      }
      input.value = "";
    });
  });
}

function renderInlineTodoForm(scope) {
  const expanded = expandedInlineFormScopes.has(scope);
  const draftSubtasks = draftSubtasksByScope.get(scope) || [];
  return `
    <form class="inline-todo-form ${expanded ? "is-expanded" : ""}" data-inline-todo-form="${scope}">
      <div class="inline-main-row">
        <span class="inline-check"></span>
        <input name="title" maxlength="80" placeholder="添加待办" />
        <button type="submit" aria-label="添加待办">${icons.plus}</button>
      </div>
      <div class="inline-task-details">
        <div class="task-note-row">
          <span data-icon="note"></span>
          <textarea name="note" rows="2" maxlength="800" placeholder="详细信息"></textarea>
        </div>
        <div class="task-subtasks">
          <div class="task-subtask-form draft-subtask-form" data-draft-subtask-form="${scope}">
            <span data-icon="plus"></span>
            <input maxlength="80" placeholder="添加子事项" />
          </div>
          <div class="draft-subtask-list" data-draft-subtask-list="${scope}">
            ${draftSubtasks.map((title) => `<div class="draft-subtask">${escapeHtml(title)}</div>`).join("")}
          </div>
        </div>
      </div>
    </form>
  `;
}

function renderTodoDetails(todo) {
  return `
    <div class="todo-details ${expandedTodoIds.has(todo.id) ? "" : "hidden"}" data-details="${todo.id}">
      <div class="task-note-row">
        <span data-icon="note"></span>
        <textarea data-note="${todo.id}" rows="2" maxlength="800" placeholder="详细信息">${escapeHtml(todo.note || "")}</textarea>
      </div>
      <div class="task-subtasks">
        ${todo.subtasks.length ? todo.subtasks.map((subtask) => `
          <div class="task-subtask ${subtask.done ? "done" : ""}">
            <button data-action="toggle-subtask" data-id="${todo.id}" data-subtask-id="${subtask.id}" type="button" aria-label="切换子事项">${subtask.done ? icons.check : ""}</button>
            <span>${escapeHtml(subtask.title)}</span>
            <button data-action="delete-subtask" data-id="${todo.id}" data-subtask-id="${subtask.id}" type="button" aria-label="删除子事项">${icons.trash}</button>
          </div>
        `).join("") : ""}
        <form class="task-subtask-form" data-subtask-form="${todo.id}">
          <span data-icon="plus"></span>
          <input maxlength="80" placeholder="添加子事项" />
        </form>
      </div>
      <div class="task-date-row">
        <span class="task-pill">今天</span>
        <span class="task-pill">明天</span>
        <span class="task-pill">${todo.dueAt ? formatDate(todo.dueAt) : "未定日期"}</span>
      </div>
    </div>
  `;
}

async function handleTodoAction(action, id, subtaskId) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;

  if (action === "details") {
    if (expandedTodoIds.has(id)) {
      expandedTodoIds.delete(id);
    } else {
      expandedTodoIds.add(id);
    }
    render();
    return;
  }

  if (action === "toggle-subtask") {
    await toggleSubtask(id, subtaskId);
    return;
  }

  if (action === "delete-subtask") {
    await deleteSubtask(id, subtaskId);
    return;
  }

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
    await deleteCloudTodo(id);
  }

  await persist();
}

async function updateTodoNote(id, note) {
  const todo = state.todos.find((item) => item.id === id);
  if (!todo) return;
  todo.note = note.trim();
  state.events.unshift(createEvent("更新", todo.title, todo.category));
  await persist();
}

function addDraftSubtask(scope, title) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return "";
  const items = draftSubtasksByScope.get(scope) || [];
  items.push(cleanTitle);
  draftSubtasksByScope.set(scope, items);
  expandedInlineFormScopes.add(scope);
  return cleanTitle;
}

async function addInlineTodoFromForm(form) {
  const scope = form.dataset.inlineTodoForm;
  const title = form.querySelector('[name="title"]').value;
  const note = form.querySelector('[name="note"]').value;
  const draftSubtasks = draftSubtasksByScope.get(scope) || [];
  await addInlineTodo(title, note, draftSubtasks);
  draftSubtasksByScope.delete(scope);
  expandedInlineFormScopes.delete(scope);
}

async function addInlineTodo(title, note = "", draftSubtasks = []) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  const todo = createTodo(cleanTitle, "生活", "medium", null);
  todo.note = note.trim();
  todo.subtasks = draftSubtasks.map((subtaskTitle) => ({
    id: crypto.randomUUID(),
    title: subtaskTitle,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  }));
  state.todos.unshift(todo);
  expandedTodoIds.add(todo.id);
  state.events.unshift(createEvent("新建", todo.title, todo.category));
  await persist();
}

async function addSubtask(todoId, title) {
  const todo = state.todos.find((item) => item.id === todoId);
  const cleanTitle = title.trim();
  if (!todo || !cleanTitle) return;
  todo.subtasks = normalizeSubtasks(todo.subtasks);
  todo.subtasks.push({
    id: crypto.randomUUID(),
    title: cleanTitle,
    done: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  });
  state.events.unshift(createEvent("更新", todo.title, todo.category));
  await persist();
}

async function toggleSubtask(todoId, subtaskId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  todo.subtasks = normalizeSubtasks(todo.subtasks);
  const subtask = todo.subtasks.find((item) => item.id === subtaskId);
  if (!subtask) return;
  subtask.done = !subtask.done;
  subtask.completedAt = subtask.done ? new Date().toISOString() : null;
  state.events.unshift(createEvent(subtask.done ? "完成" : "恢复", subtask.title, todo.category));
  await persist();
}

async function deleteSubtask(todoId, subtaskId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  todo.subtasks = normalizeSubtasks(todo.subtasks).filter((item) => item.id !== subtaskId);
  state.events.unshift(createEvent("删除", todo.title, todo.category));
  await deleteCloudSubtask(subtaskId);
  await persist();
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
      <article class="reminder-item ${expandedReminderIds.has(reminder.id) ? "is-expanded" : ""}">
        <button class="reminder-time" data-reminder-action="details" data-id="${reminder.id}" type="button">${formatTime(reminder.remindAt)}</button>
        <div>
          <button class="reminder-title" data-reminder-action="details" data-id="${reminder.id}" type="button">${escapeHtml(reminder.title)}</button>
          <div class="reminder-meta">
            <span class="chip">${formatDate(reminder.remindAt)}</span>
            ${reminder.channels.map((channelName) => `<span class="chip">${channelName}</span>`).join("")}
            ${reminder.repeat !== "none" ? `<span class="chip high">${repeatLabel(reminder.repeat)}</span>` : ""}
          </div>
        </div>
        <div class="reminder-actions">
          <button data-reminder-action="details" data-id="${reminder.id}" type="button">编辑</button>
          <button data-reminder-action="delete" data-id="${reminder.id}" type="button" aria-label="删除提醒">${icons.trash}</button>
        </div>
        <div class="reminder-details ${expandedReminderIds.has(reminder.id) ? "" : "hidden"}">
          <input data-reminder-title="${reminder.id}" value="${escapeHtml(reminder.title)}" maxlength="80" />
          <input data-reminder-at="${reminder.id}" type="datetime-local" value="${toDateTimeLocal(reminder.remindAt)}" />
          <select data-reminder-repeat="${reminder.id}">
            <option value="none" ${reminder.repeat === "none" ? "selected" : ""}>不重复</option>
            <option value="daily" ${reminder.repeat === "daily" ? "selected" : ""}>每天</option>
            <option value="weekly" ${reminder.repeat === "weekly" ? "selected" : ""}>每周</option>
            <option value="monthly" ${reminder.repeat === "monthly" ? "selected" : ""}>每月</option>
          </select>
          <button data-reminder-action="save" data-id="${reminder.id}" type="button">保存</button>
          <button data-reminder-action="delete" data-id="${reminder.id}" type="button">${icons.trash} 删除</button>
        </div>
      </article>
    `)
    .join("");

  container.querySelectorAll("[data-reminder-action]").forEach((button) => {
    button.addEventListener("click", () => {
      void handleReminderAction(button.dataset.reminderAction, button.dataset.id, container);
    });
  });
  container.querySelectorAll("[data-reminder-title], [data-reminder-at], [data-reminder-repeat]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.reminderTitle || input.dataset.reminderAt || input.dataset.reminderRepeat;
      void updateReminderFromInputs(container, id);
    });
  });
}

async function handleReminderAction(action, id, container) {
  const reminder = state.reminders.find((item) => item.id === id);
  if (!reminder) return;
  if (action === "details") {
    if (expandedReminderIds.has(id)) {
      expandedReminderIds.delete(id);
    } else {
      expandedReminderIds.add(id);
    }
    render();
    return;
  }
  if (action === "save") {
    await updateReminderFromInputs(container, id);
    return;
  }
  if (action === "delete") {
    state.reminders = state.reminders.filter((item) => item.id !== id);
    state.events.unshift(createEvent("删除", reminder.title, "提醒"));
    await deleteCloudReminder(id);
    await persist();
  }
}

async function updateReminderFromInputs(container, id) {
  const reminder = state.reminders.find((item) => item.id === id);
  if (!reminder) return;
  const titleInput = container.querySelector(`[data-reminder-title="${id}"]`);
  const atInput = container.querySelector(`[data-reminder-at="${id}"]`);
  const repeatInput = container.querySelector(`[data-reminder-repeat="${id}"]`);
  reminder.title = titleInput.value.trim() || reminder.title;
  reminder.remindAt = atInput.value ? new Date(atInput.value).toISOString() : reminder.remindAt;
  reminder.repeat = repeatInput.value;
  state.events.unshift(createEvent("更新", reminder.title, "提醒"));
  await persist();
}

function renderCalendar(container, large) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  ["一", "二", "三", "四", "五", "六", "日"].forEach((day) => {
    cells.push(`<div class="calendar-cell calendar-head">${day}</div>`);
  });

  for (let i = 0; i < startOffset; i += 1) {
    cells.push('<div class="calendar-cell"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const items = state.todos.filter((todo) => todo.dueAt && toDateKey(new Date(todo.dueAt)) === key);
    const reminders = state.reminders.filter((reminder) => reminder.remindAt && toDateKey(new Date(reminder.remindAt)) === key);
    const classes = ["calendar-cell", key === today ? "today" : "", key === selectedDateKey ? "selected" : "", items.length || reminders.length ? "has-items" : ""].join(" ");
    cells.push(`<button class="${classes}" data-calendar-date="${key}" type="button"><span>${day}</span>${large && (items.length || reminders.length) ? `<small>${items.length + reminders.length} 项</small>` : ""}</button>`);
  }

  container.innerHTML = cells.join("");
  container.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDateKey = button.dataset.calendarDate;
      render();
    });
  });
}

function renderAgenda() {
  const selectedTodos = state.todos.filter((todo) => todo.dueAt && toDateKey(new Date(todo.dueAt)) === selectedDateKey);
  const selectedDone = state.events.filter((event) => event.type === "完成" && toDateKey(new Date(event.createdAt)) === selectedDateKey);
  const selectedReminders = state.reminders.filter((reminder) => reminder.remindAt && toDateKey(new Date(reminder.remindAt)) === selectedDateKey);
  const selectedLabel = formatDate(`${selectedDateKey}T00:00:00`);
  document.getElementById("selectedAgenda").innerHTML = `
    <strong>${selectedLabel}</strong>
    <div class="agenda-section">
      <span>待办</span>
      ${selectedTodos.length ? selectedTodos.map((todo) => `<p>${todo.dueAt ? formatTime(todo.dueAt) : ""} ${escapeHtml(todo.title)}</p>`).join("") : "<p>没有待办</p>"}
    </div>
    <div class="agenda-section">
      <span>已完成</span>
      ${selectedDone.length ? selectedDone.map((event) => `<p>${escapeHtml(event.title)}</p>`).join("") : "<p>没有完成记录</p>"}
    </div>
    <div class="agenda-section">
      <span>提醒</span>
      ${selectedReminders.length ? selectedReminders.map((reminder) => `<p>${formatTime(reminder.remindAt)} ${escapeHtml(reminder.title)}</p>`).join("") : "<p>没有提醒</p>"}
    </div>
  `;
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
  if (changed) void persist();
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

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
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
