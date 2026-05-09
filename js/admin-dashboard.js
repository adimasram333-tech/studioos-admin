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

  const DASHBOARD_CONFIRMED_SELECTS = {
    photographer_settings: {
      recentUsers: [
        "user_id,plan,is_paid,subscription_status"
      ],
      storage: [
        "used_storage_bytes"
      ]
    },
    image_purchases: {
      photoSales: [
        "amount"
      ],
      recentPayments: [
        "id,user_id,amount"
      ]
    },
    template_purchases: {
      recentPayments: [
        "id,user_id,amount,status,created_at"
      ]
    }
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

  function getFirstValue(row, keys) {
    if (!row || !Array.isArray(keys)) return null;

    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key];
      }
    }

    return null;
  }

  function getPaymentAmount(row) {
    const directAmount = Number(getFirstValue(row, [
      "amount",
      "price",
      "total_amount",
      "paid_amount",
      "payment_amount",
      "template_price",
      "photo_price"
    ]) || 0);

    if (Number.isFinite(directAmount) && directAmount > 0) {
      return directAmount;
    }

    const photographerAmount = Number(row?.photographer_amount || 0);
    const platformAmount = Number(row?.platform_amount || 0);
    const combinedAmount = photographerAmount + platformAmount;

    return Number.isFinite(combinedAmount) && combinedAmount > 0 ? combinedAmount : 0;
  }

  function getPaymentStatus(row) {
    return String(getFirstValue(row, [
      "status",
      "payment_status",
      "razorpay_status",
      "purchase_status"
    ]) || "unknown").toUpperCase();
  }

  function isSuccessfulPayment(row) {
    const status = getPaymentStatus(row).toLowerCase();

    return (
      status === "unknown" ||
      status === "success" ||
      status === "paid" ||
      status === "captured" ||
      status === "completed" ||
      status === "verified"
    );
  }

  function sortRowsByBestDate(rows) {
    return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
      const dateA = new Date(getFirstValue(a, ["created_at", "updated_at", "paid_at", "purchased_at"]) || 0).getTime();
      const dateB = new Date(getFirstValue(b, ["created_at", "updated_at", "paid_at", "purchased_at"]) || 0).getTime();

      const safeA = Number.isFinite(dateA) ? dateA : 0;
      const safeB = Number.isFinite(dateB) ? dateB : 0;

      return safeB - safeA;
    });
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
        return 0;
      }

      return Number(count || 0);
    } catch (err) {
      return 0;
    }
  }

  async function fetchRowsWithSelectFallbacks(supabase, table, selectVariants, options = {}) {
    if (!supabase || !table || !Array.isArray(selectVariants)) return [];

    /*
      Production-safe rule:
      This helper is kept to preserve the original dashboard structure, but it must not
      blindly probe guessed columns. Callers now pass only confirmed schema-safe selects.
      This prevents Supabase/PostgREST 400 noise while keeping the same function flow.
    */

    for (const selectClause of selectVariants) {
      try {
        let query = supabase
          .from(table)
          .select(selectClause);

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

        if (Number.isFinite(Number(options.limit)) && Number(options.limit) > 0) {
          query = query.limit(Number(options.limit));
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          return data;
        }
      } catch (_err) {
        // Schema-safe callers should not reach this path. Return empty on unexpected failure.
      }
    }

    return [];
  }

  async function fetchPaidUsersCount(supabase) {
    try {
      const { count, error } = await supabase
        .from("photographer_settings")
        .select("user_id", { count: "exact", head: true })
        .eq("is_paid", true)
        .eq("subscription_status", "active");

      if (error) {
        return 0;
      }

      return Number(count || 0);
    } catch (err) {
      return 0;
    }
  }

  async function fetchStorageUsedBytes(supabase) {
    const rows = await fetchRowsWithSelectFallbacks(
      supabase,
      "photographer_settings",
      DASHBOARD_CONFIRMED_SELECTS.photographer_settings.storage
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    return rows.reduce((sum, row) => {
      const bytes = Number(getFirstValue(row, [
        "used_storage_bytes",
        "storage_used_bytes",
        "total_storage_used"
      ]) || 0);

      return sum + (Number.isFinite(bytes) ? bytes : 0);
    }, 0);
  }

  async function fetchPhotoSalesRevenue(supabase) {
    const rows = await fetchRowsWithSelectFallbacks(
      supabase,
      "image_purchases",
      DASHBOARD_CONFIRMED_SELECTS.image_purchases.photoSales
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return 0;
    }

    return rows.reduce((sum, row) => {
      if (!isSuccessfulPayment(row)) return sum;

      const amount = getPaymentAmount(row);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  async function fetchPendingPayoutsCount(supabase) {
    /*
      Payout module is not wired yet. Keeping this function in place preserves the
      dashboard architecture without probing optional payout tables and creating
      production console 400 errors.
    */
    void supabase;
    return 0;
  }

  async function fetchRecentUsers(supabase) {
    const rows = await fetchRowsWithSelectFallbacks(
      supabase,
      "photographer_settings",
      DASHBOARD_CONFIRMED_SELECTS.photographer_settings.recentUsers,
      {
        limit: 5
      }
    );

    return Array.isArray(rows) ? rows.slice(0, 5) : [];
  }

  async function fetchPaymentRowsFromTable(supabase, table) {
    const safeTable = String(table || "").trim();
    const confirmedSelects =
      safeTable === "template_purchases"
        ? DASHBOARD_CONFIRMED_SELECTS.template_purchases.recentPayments
        : safeTable === "image_purchases"
          ? DASHBOARD_CONFIRMED_SELECTS.image_purchases.recentPayments
          : [];

    if (!confirmedSelects.length) {
      return [];
    }

    const rows = await fetchRowsWithSelectFallbacks(supabase, safeTable, confirmedSelects, {
      limit: 5
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    return rows.map((row) => ({
      ...row,
      source_table: safeTable
    }));
  }

  async function fetchRecentPayments(supabase) {
    const candidateTables = [
      "template_purchases",
      "image_purchases"
    ];

    let allPayments = [];

    for (const table of candidateTables) {
      const rows = await fetchPaymentRowsFromTable(supabase, table);
      if (Array.isArray(rows) && rows.length > 0) {
        allPayments = allPayments.concat(rows);
      }
    }

    return sortRowsByBestDate(allPayments).slice(0, 5);
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
      const status = String(user?.subscription_status || (user?.is_paid ? "active" : "free")).toUpperCase();

      return `
        <div class="admin-list-item">
          <div>
            <div class="admin-list-title">${userId}</div>
            <div class="admin-list-subtitle">Status: ${status}</div>
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
      const amount = getPaymentAmount(payment);
      const status = getPaymentStatus(payment);
      const source = String(payment?.source_table || "payments").replace(/_/g, " ");
      const dateValue = getFirstValue(payment, ["created_at", "updated_at", "paid_at", "purchased_at"]);

      return `
        <div class="admin-list-item">
          <div>
            <div class="admin-list-title">${formatCurrency(amount)}</div>
            <div class="admin-list-subtitle">${source} · ${formatDate(dateValue)}</div>
          </div>
          <span class="admin-badge ${isSuccessfulPayment(payment) ? "admin-badge-success" : "admin-badge-warning"}">${status}</span>
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
