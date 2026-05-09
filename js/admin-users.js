// ================================
// StudioOS Admin Users
// MVP user directory loader
// ================================

(function () {
  "use strict";

  let allUsers = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  }

  function showError(message) {
    const errorBox = document.getElementById("usersError");
    if (!errorBox) return;

    errorBox.textContent = message || "Failed to load users.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    const errorBox = document.getElementById("usersError");
    if (!errorBox) return;

    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat("en-IN").format(number);
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 MB";

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

  function getStorageBytes(row) {
    const bytes = Number(row?.used_storage_bytes || 0);
    return Number.isFinite(bytes) ? bytes : 0;
  }

  function getPlanLabel(row) {
    const plan = String(row?.plan || "free").trim().toLowerCase();
    const isPaid = row?.is_paid === true;

    if (isPaid && (plan === "basic" || plan === "pro")) {
      return plan.toUpperCase();
    }

    return "FREE";
  }

  function getPlanKey(row) {
    return getPlanLabel(row).toLowerCase();
  }

  function getStatusLabel(row) {
    const status = String(row?.subscription_status || "").trim().toLowerCase();

    if (status) {
      return status.toUpperCase();
    }

    if (row?.is_paid === true) {
      return "ACTIVE";
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

  function getStatusBadgeClass(row) {
    const status = getStatusLabel(row).toLowerCase();

    if (status === "active") {
      return "admin-badge admin-badge-success";
    }

    if (status === "free") {
      return "admin-badge admin-badge-muted";
    }

    return "admin-badge admin-badge-warning";
  }

  async function fetchUsers(supabase) {
    try {
      const { data, error } = await supabase
        .from("photographer_settings")
        .select("user_id,plan,is_paid,subscription_status,used_storage_bytes")
        .limit(500);

      if (error) {
        throw error;
      }

      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Admin users fetch failed:", err);
      throw new Error("Unable to load users.");
    }
  }

  function calculateSummary(users) {
    const totalUsers = Array.isArray(users) ? users.length : 0;
    const paidUsers = users.filter((row) => {
      const plan = getPlanKey(row);
      return row?.is_paid === true && (plan === "basic" || plan === "pro");
    }).length;
    const freeUsers = Math.max(totalUsers - paidUsers, 0);
    const storageUsedBytes = users.reduce((sum, row) => sum + getStorageBytes(row), 0);

    return {
      totalUsers,
      paidUsers,
      freeUsers,
      storageUsedBytes
    };
  }

  function renderSummary(users) {
    const summary = calculateSummary(users);

    setText("usersTotalCard", formatNumber(summary.totalUsers));
    setText("usersPaidCard", formatNumber(summary.paidUsers));
    setText("usersFreeCard", formatNumber(summary.freeUsers));
    setText("usersStorageCard", formatBytes(summary.storageUsedBytes));
  }

  function getFilteredUsers() {
    const searchInput = document.getElementById("userSearchInput");
    const planFilter = document.getElementById("userPlanFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(planFilter?.value || "all").trim().toLowerCase();

    return allUsers.filter((user) => {
      const userId = String(user?.user_id || "").toLowerCase();
      const plan = getPlanKey(user);
      const status = getStatusLabel(user).toLowerCase();
      const isPaid = user?.is_paid === true && (plan === "basic" || plan === "pro");

      const matchesSearch =
        !search ||
        userId.includes(search) ||
        plan.includes(search) ||
        status.includes(search);

      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && isPaid) ||
        (filter === "free" && !isPaid) ||
        plan === filter;

      return matchesSearch && matchesFilter;
    });
  }

  function renderUsersList(users) {
    const list = document.getElementById("usersList");
    if (!list) return;

    if (!Array.isArray(users) || users.length === 0) {
      list.innerHTML = `<div class="admin-muted">No users found.</div>`;
      return;
    }

    list.innerHTML = users.map((user) => {
      const userId = String(user?.user_id || "Unknown user");
      const plan = getPlanLabel(user);
      const status = getStatusLabel(user);
      const storage = formatBytes(getStorageBytes(user));

      return `
        <div class="admin-list-item">
          <div>
            <div class="admin-list-title">${userId}</div>
            <div class="admin-list-subtitle">Storage: ${storage}</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="${getPlanBadgeClass(user)}">${plan}</span>
            <span class="${getStatusBadgeClass(user)}">${status}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function render() {
    const filteredUsers = getFilteredUsers();
    renderSummary(allUsers);
    renderUsersList(filteredUsers);
  }

  async function loadUsers() {
    hideError();

    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    const supabase = await window.AdminConfig.getSupabase();
    allUsers = await fetchUsers(supabase);

    render();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("refreshUsersBtn");
    const searchInput = document.getElementById("userSearchInput");
    const planFilter = document.getElementById("userPlanFilter");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadUsers();
        } catch (err) {
          console.error("Admin users refresh failed:", err);
          showError(err?.message || "Failed to refresh users.");
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Refresh";
        }
      });
    }

    if (searchInput && searchInput.dataset.bound !== "true") {
      searchInput.dataset.bound = "true";
      searchInput.addEventListener("input", render);
    }

    if (planFilter && planFilter.dataset.bound !== "true") {
      planFilter.dataset.bound = "true";
      planFilter.addEventListener("change", render);
    }
  }

  async function init() {
    bindEvents();

    try {
      await loadUsers();
    } catch (err) {
      console.error("Admin users load failed:", err);
      showError(err?.message || "Failed to load users.");
      allUsers = [];
      render();
    }
  }

  window.AdminUsers = {
    init,
    loadUsers
  };
})();
