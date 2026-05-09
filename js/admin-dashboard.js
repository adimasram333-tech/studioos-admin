// ================================
// StudioOS Admin Dashboard
// MVP overview data loader
// ================================

(function () {
  "use strict";

  const DEFAULT_DASHBOARD_STATE = {
    totalUsers: 0,
    paidUsers: 0,
    totalEvents: 0,
    totalPhotos: 0,
    publishedWebsites: 0,
    photoSales: 0,
    pendingPayouts: 0,
    storageUsedBytes: 0,
    recentUsers: [],
    recentPayments: []
  };

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function showError(message) {
    const errorBox = document.getElementById("dashboardError");
    if (!errorBox) return;

    errorBox.textContent = message || "Failed to load dashboard.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    const errorBox = document.getElementById("dashboardError");
    if (!errorBox) return;

    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat("en-IN").format(number);
  }

  function formatCurrency(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "₹0";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(number);
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 GB";

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size = size / 1024;
      unitIndex += 1;
    }

    const decimals = unitIndex >= 3 ? 2 : 1;
    return `${size.toFixed(decimals)} ${units[unitIndex]}`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getPlanLabel(row) {
    const plan = String(row?.plan || "free").trim().toLowerCase();
    const isPaid = row?.is_paid === true;

    if (isPaid && (plan === "basic" || plan === "pro")) {
      return plan.toUpperCase();
    }

    return "FREE";
  }

  function getPlanBadgeClass(row) {
    const plan = getPlanLabel(row);

    if (plan === "BASIC" || plan === "PRO") {
      return "admin-badge admin-badge-success";
    }

    return "admin-badge admin-badge-muted";
  }

  async function safeCount(supabase, table, options = {}) {
    try {
      let query = supabase
        .from(table)
        .select(options.select || "id", { count: "exact", head: true });

      if (Array.isArray(options.filters)) {
        options.filters.forEach((filter) => {
          if (!filter || !filter.column || !filter.operator) return;

          if (filter.operator === "eq") query = query.eq(filter.column, filter.value);
          if (filter.operator === "neq") query = query.neq(filter.column, filter.value);
          if (filter.operator === "gt") query = query.gt(filter.column, filter.value);
          if (filter.operator === "gte") query = query.gte(filter.column, filter.value);
          if (filter.operator === "lt") query = query.lt(filter.column, filter.value);
          if (filter.operator === "lte") query = query.lte(filter.column, filter.value);
        });
      }

      const { count, error } = await query;

      if (error) {
        console.warn(`Dashboard count skipped for ${table}:`, error);
        return 0;
      }

      return Number(count || 0);
    } catch (err) {
      console.warn(`Dashboard count failed for ${table}:`, err);
      return 0;
    }
  }

  async function fetchPaidUsersCount(supabase) {
    try {
      const { count, error } = await supabase
        .from("photographer_settings")
        .select("user_id", { count: "exact", head: true })
        .eq("is_paid", true)
        .eq("subscription_status", "active");

      if (error) {
        console.warn("Paid users count skipped:", error);
        return 0;
      }

      return Number(count || 0);
    } catch (err) {
      console.warn("Paid users count failed:", err);
      return 0;
    }
  }

  async function fetchStorageUsedBytes(supabase) {
    try {
      const { data, error } = await supabase
        .from("photographer_settings")
        .select("used_storage_bytes");

      if (error || !Array.isArray(data)) {
        console.warn("Storage usage fetch skipped:", error);
        return 0;
      }

      return data.reduce((sum, row) => {
        const bytes = Number(row?.used_storage_bytes || 0);
        return sum + (Number.isFinite(bytes) ? bytes : 0);
      }, 0);
    } catch (err) {
      console.warn("Storage usage fetch failed:", err);
      return 0;
    }
  }

  async function fetchPhotoSalesRevenue(supabase) {
    try {
      const { data, error } = await supabase
        .from("image_purchases")
        .select("amount, price, photographer_amount, platform_amount, status, payment_status");

      if (error || !Array.isArray(data)) {
        console.warn("Photo sales fetch skipped:", error);
        return 0;
      }

      return data.reduce((sum, row) => {
        const status = String(row?.status || row?.payment_status || "").toLowerCase();
        const isSuccess =
          !status ||
          status === "success" ||
          status === "paid" ||
          status === "captured" ||
          status === "completed";

        if (!isSuccess) return sum;

        const amount =
          Number(row?.amount) ||
          Number(row?.price) ||
          Number(row?.photographer_amount) + Number(row?.platform_amount) ||
          0;

        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    } catch (err) {
      console.warn("Photo sales revenue failed:", err);
      return 0;
    }
  }

  async function fetchPendingPayoutsCount(supabase) {
    const candidateTables = ["payout_requests", "withdrawal_requests", "payouts"];

    for (const table of candidateTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        if (!error) {
          return Number(count || 0);
        }
      } catch (_) {
        // Try next table name.
      }
    }

    return 0;
  }

  async function fetchRecentUsers(supabase) {
    try {
      const { data, error } = await supabase
        .from("photographer_settings")
        .select("user_id, plan, is_paid, subscription_status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error || !Array.isArray(data)) {
        console.warn("Recent users fetch skipped:", error);
        return [];
      }

      return data;
    } catch (err) {
      console.warn("Recent users fetch failed:", err);
      return [];
    }
  }

  async function fetchRecentPayments(supabase) {
    const candidates = [
      {
        table: "subscription_payments",
        select: "id, user_id, amount, status, payment_status, created_at"
      },
      {
        table: "template_purchases",
        select: "id, user_id, amount, price, status, payment_status, created_at"
      },
      {
        table: "image_purchases",
        select: "id, user_id, amount, price, status, payment_status, created_at"
      }
    ];

    for (const candidate of candidates) {
      try {
        const { data, error } = await supabase
          .from(candidate.table)
          .select(candidate.select)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!error && Array.isArray(data)) {
          return data.map((row) => ({
            ...row,
            source_table: candidate.table
          }));
        }
      } catch (_) {
        // Try next payment table.
      }
    }

    return [];
  }

  function renderRecentUsers(users) {
    const list = document.getElementById("recentUsersList");
    if (!list) return;

    if (!Array.isArray(users) || users.length === 0) {
      list.innerHTML = `<div class="admin-muted">No recent users found.</div>`;
      return;
    }

    list.innerHTML = users.map((user) => {
      const userId = String(user?.user_id || "Unknown user");
      const plan = getPlanLabel(user);

      return `
        <div class="admin-list-item">
          <div>
            <div class="admin-list-title">${userId}</div>
            <div class="admin-list-subtitle">Joined ${formatDate(user?.created_at || user?.updated_at)}</div>
          </div>
          <span class="${getPlanBadgeClass(user)}">${plan}</span>
        </div>
      `;
    }).join("");
  }

  function renderRecentPayments(payments) {
    const list = document.getElementById("recentPaymentsList");
    if (!list) return;

    if (!Array.isArray(payments) || payments.length === 0) {
      list.innerHTML = `<div class="admin-muted">No recent payments found.</div>`;
      return;
    }

    list.innerHTML = payments.map((payment) => {
      const amount = Number(payment?.amount || payment?.price || 0);
      const status = String(payment?.status || payment?.payment_status || "unknown").toUpperCase();
      const source = String(payment?.source_table || "payments").replace(/_/g, " ");

      return `
        <div class="admin-list-item">
          <div>
            <div class="admin-list-title">${formatCurrency(amount)}</div>
            <div class="admin-list-subtitle">${source} · ${formatDate(payment?.created_at)}</div>
          </div>
          <span class="admin-badge ${status === "SUCCESS" || status === "PAID" || status === "CAPTURED" ? "admin-badge-success" : "admin-badge-warning"}">${status}</span>
        </div>
      `;
    }).join("");
  }

  function renderDashboard(state) {
    setText("totalUsersCard", formatNumber(state.totalUsers));
    setText("paidUsersCard", formatNumber(state.paidUsers));
    setText("totalEventsCard", formatNumber(state.totalEvents));
    setText("totalPhotosCard", formatNumber(state.totalPhotos));
    setText("publishedWebsitesCard", formatNumber(state.publishedWebsites));
    setText("photoSalesCard", formatCurrency(state.photoSales));
    setText("pendingPayoutsCard", formatNumber(state.pendingPayouts));
    setText("storageUsedCard", formatBytes(state.storageUsedBytes));

    renderRecentUsers(state.recentUsers);
    renderRecentPayments(state.recentPayments);
  }

  async function loadDashboard() {
    hideError();

    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    const supabase = await window.AdminConfig.getSupabase();

    const state = { ...DEFAULT_DASHBOARD_STATE };

    const [
      totalUsers,
      paidUsers,
      totalEvents,
      totalPhotos,
      publishedWebsites,
      photoSales,
      pendingPayouts,
      storageUsedBytes,
      recentUsers,
      recentPayments
    ] = await Promise.all([
      safeCount(supabase, "photographer_settings", { select: "user_id" }),
      fetchPaidUsersCount(supabase),
      safeCount(supabase, "events"),
      safeCount(supabase, "gallery_photos"),
      safeCount(supabase, "user_websites", {
        filters: [{ column: "is_published", operator: "eq", value: true }]
      }),
      fetchPhotoSalesRevenue(supabase),
      fetchPendingPayoutsCount(supabase),
      fetchStorageUsedBytes(supabase),
      fetchRecentUsers(supabase),
      fetchRecentPayments(supabase)
    ]);

    state.totalUsers = totalUsers;
    state.paidUsers = paidUsers;
    state.totalEvents = totalEvents;
    state.totalPhotos = totalPhotos;
    state.publishedWebsites = publishedWebsites;
    state.photoSales = photoSales;
    state.pendingPayouts = pendingPayouts;
    state.storageUsedBytes = storageUsedBytes;
    state.recentUsers = recentUsers;
    state.recentPayments = recentPayments;

    renderDashboard(state);
  }

  async function init() {
    const refreshBtn = document.getElementById("refreshDashboardBtn");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadDashboard();
        } catch (err) {
          console.error("Dashboard refresh failed:", err);
          showError(err?.message || "Failed to refresh dashboard.");
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Refresh";
        }
      });
    }

    try {
      await loadDashboard();
    } catch (err) {
      console.error("Dashboard load failed:", err);
      showError(err?.message || "Failed to load dashboard.");
      renderDashboard(DEFAULT_DASHBOARD_STATE);
    }
  }

  window.AdminDashboard = {
    init,
    loadDashboard
  };
})();
