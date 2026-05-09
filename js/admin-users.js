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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeText(value, fallback = "Not added") {
    const text = String(value || "").trim();
    return text || fallback;
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

  function getDisplayName(user) {
    const ownerName = String(user?.owner_name || "").trim();
    const studioName = String(user?.studio_name || "").trim();

    if (ownerName) return ownerName;
    if (studioName) return studioName;

    return "Unnamed User";
  }

  function getDisplaySubtitle(user) {
    const studioName = String(user?.studio_name || "").trim();
    const phone = String(user?.phone || "").trim();

    if (studioName && phone) return `${studioName} · ${phone}`;
    if (studioName) return studioName;
    if (phone) return phone;

    return "No studio/phone added";
  }

  function findUserById(userId) {
    const safeUserId = String(userId || "").trim();
    if (!safeUserId) return null;

    return allUsers.find((user) => String(user?.user_id || "") === safeUserId) || null;
  }

  async function fetchUsers(supabase) {
    try {
      const { data, error } = await supabase
        .from("photographer_settings")
        .select("user_id,studio_name,owner_name,phone,upi,plan,is_paid,subscription_status,used_storage_bytes")
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
      const ownerName = String(user?.owner_name || "").toLowerCase();
      const studioName = String(user?.studio_name || "").toLowerCase();
      const phone = String(user?.phone || "").toLowerCase();
      const upi = String(user?.upi || "").toLowerCase();
      const plan = getPlanKey(user);
      const status = getStatusLabel(user).toLowerCase();
      const isPaid = user?.is_paid === true && (plan === "basic" || plan === "pro");

      const matchesSearch =
        !search ||
        userId.includes(search) ||
        ownerName.includes(search) ||
        studioName.includes(search) ||
        phone.includes(search) ||
        upi.includes(search) ||
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

  function createDetailRow(label, value) {
    return `
      <div style="
        padding:0.85rem;
        border-radius:1rem;
        background:rgba(255,255,255,0.045);
        border:1px solid rgba(255,255,255,0.07);
      ">
        <div style="
          font-size:0.7rem;
          line-height:0.95rem;
          font-weight:800;
          letter-spacing:0.12em;
          text-transform:uppercase;
          color:#94a3b8;
        ">${escapeHtml(label)}</div>
        <div style="
          margin-top:0.35rem;
          font-size:0.92rem;
          line-height:1.35rem;
          font-weight:700;
          color:#ffffff;
          word-break:break-word;
        ">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function closeUserDetailsModal() {
    const modal = document.getElementById("adminUserDetailsModal");
    if (modal) {
      modal.remove();
    }

    document.body.style.overflow = "";
  }

  function openUserDetailsModal(userId) {
    const user = findUserById(userId);
    if (!user) return;

    closeUserDetailsModal();

    const plan = getPlanLabel(user);
    const status = getStatusLabel(user);
    const storage = formatBytes(getStorageBytes(user));

    const modal = document.createElement("div");
    modal.id = "adminUserDetailsModal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "9999";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "1rem";
    modal.style.background = "rgba(2,6,23,0.78)";
    modal.style.backdropFilter = "blur(10px)";

    modal.innerHTML = `
      <div style="
        width:min(100%, 560px);
        max-height:90vh;
        overflow:auto;
        border-radius:1.5rem;
        background:rgba(15,23,42,0.98);
        border:1px solid rgba(255,255,255,0.10);
        box-shadow:0 26px 80px rgba(0,0,0,0.45);
        color:#ffffff;
      ">
        <div style="
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:1rem;
          padding:1.2rem;
          border-bottom:1px solid rgba(255,255,255,0.08);
        ">
          <div>
            <div style="
              display:inline-flex;
              align-items:center;
              padding:0.32rem 0.6rem;
              border-radius:999px;
              font-size:0.68rem;
              font-weight:900;
              letter-spacing:0.14em;
              text-transform:uppercase;
              color:#c7d2fe;
              background:rgba(99,102,241,0.16);
              border:1px solid rgba(129,140,248,0.30);
            ">User Details</div>
            <div style="margin-top:0.75rem; font-size:1.35rem; font-weight:900; line-height:1.65rem;">
              ${escapeHtml(getDisplayName(user))}
            </div>
            <div style="margin-top:0.25rem; font-size:0.88rem; color:#94a3b8;">
              ${escapeHtml(getDisplaySubtitle(user))}
            </div>
          </div>

          <button id="closeUserDetailsModalBtn" type="button" style="
            width:2.2rem;
            height:2.2rem;
            border-radius:999px;
            border:1px solid rgba(255,255,255,0.10);
            background:rgba(255,255,255,0.06);
            color:#ffffff;
            font-size:1.35rem;
            line-height:1;
            cursor:pointer;
          ">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
            <span class="${getPlanBadgeClass(user)}">${escapeHtml(plan)}</span>
            <span class="${getStatusBadgeClass(user)}">${escapeHtml(status)}</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:0.75rem;">
            ${createDetailRow("Studio Name", safeText(user?.studio_name))}
            ${createDetailRow("Owner Name", safeText(user?.owner_name))}
            ${createDetailRow("Phone", safeText(user?.phone))}
            ${createDetailRow("UPI", safeText(user?.upi))}
            ${createDetailRow("User ID", safeText(user?.user_id))}
            ${createDetailRow("Plan", plan)}
            ${createDetailRow("Subscription Status", status)}
            ${createDetailRow("Storage Used", storage)}
          </div>
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeUserDetailsModal();
      }
    });

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = document.getElementById("closeUserDetailsModalBtn");
    if (closeBtn) {
      closeBtn.onclick = closeUserDetailsModal;
    }
  }

  function renderUsersList(users) {
    const list = document.getElementById("usersList");
    if (!list) return;

    if (!Array.isArray(users) || users.length === 0) {
      list.innerHTML = `<div class="admin-muted">No users found.</div>`;
      return;
    }

    list.innerHTML = users.map((user) => {
      const userId = String(user?.user_id || "");
      const plan = getPlanLabel(user);
      const status = getStatusLabel(user);
      const storage = formatBytes(getStorageBytes(user));
      const displayName = getDisplayName(user);
      const subtitle = getDisplaySubtitle(user);

      return `
        <div class="admin-list-item" data-admin-user-id="${escapeHtml(userId)}" style="cursor:pointer;">
          <div>
            <button
              type="button"
              class="admin-list-title"
              data-open-admin-user="${escapeHtml(userId)}"
              style="background:transparent; border:0; padding:0; color:#ffffff; font:inherit; font-weight:800; text-align:left; cursor:pointer;"
            >${escapeHtml(displayName)}</button>
            <div class="admin-list-subtitle">${escapeHtml(subtitle)} · Storage: ${escapeHtml(storage)}</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="${getPlanBadgeClass(user)}">${escapeHtml(plan)}</span>
            <span class="${getStatusBadgeClass(user)}">${escapeHtml(status)}</span>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-admin-user-id]").forEach((card) => {
      card.addEventListener("click", () => {
        openUserDetailsModal(card.getAttribute("data-admin-user-id"));
      });
    });
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

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeUserDetailsModal();
      }
    });
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
    loadUsers,
    openUserDetailsModal
  };
})();
