// ================================
// StudioOS Admin Subscriptions
// Read-only subscription monitoring
// ================================

(function () {
  "use strict";

  let allSubscriptions = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError(message) {
    const errorBox = document.getElementById("subscriptionsError");
    if (!errorBox) return;
    errorBox.textContent = message || "Failed to load subscriptions.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    const errorBox = document.getElementById("subscriptionsError");
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

  function safeText(value, fallback = "—") {
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

  function formatStorageLimit(gb) {
    const value = Number(gb || 0);
    if (!Number.isFinite(value) || value <= 0) return "0 GB";
    return `${formatNumber(value)} GB`;
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

  function getDisplayName(row) {
    const ownerName = String(row?.owner_name || "").trim();
    const studioName = String(row?.studio_name || "").trim();
    const email = String(row?.email || "").trim();

    if (ownerName) return ownerName;
    if (studioName) return studioName;
    if (email) return email;

    return "Unnamed User";
  }

  function getDisplaySubtitle(row) {
    const studioName = String(row?.studio_name || "").trim();
    const phone = String(row?.phone || "").trim();
    const email = String(row?.email || "").trim();

    const parts = [];
    if (studioName) parts.push(studioName);
    if (phone) parts.push(phone);
    else if (email) parts.push(email);

    return parts.join(" · ") || "No studio/phone added";
  }

  function getPlanLabel(row) {
    return String(row?.plan || "free").trim().toUpperCase() || "FREE";
  }

  function getBillingLabel(row) {
    const billing = String(row?.billing_cycle || "").trim();
    return billing ? billing.toUpperCase() : "—";
  }

  function getStatusLabel(row) {
    return String(row?.subscription_status || "inactive").trim().toUpperCase();
  }

  function getAccountLabel(row) {
    return row?.is_blocked === true ? "BLOCKED" : "ACTIVE";
  }

  function getPlanBadgeClass(row) {
    const plan = String(row?.plan || "free").trim().toLowerCase();
    const isPaid = row?.is_paid === true;

    if (isPaid && (plan === "basic" || plan === "pro")) {
      return "admin-badge admin-badge-success";
    }

    return "admin-badge admin-badge-muted";
  }

  function getStatusBadgeClass(row) {
    const status = String(row?.subscription_status || "inactive").trim().toLowerCase();

    if (status === "active" || status === "trialing") {
      return "admin-badge admin-badge-success";
    }

    if (status === "inactive" || status === "expired" || status === "cancelled") {
      return "admin-badge admin-badge-warning";
    }

    return "admin-badge admin-badge-muted";
  }

  function getAccountBadgeClass(row) {
    return row?.is_blocked === true ? "admin-badge admin-badge-warning" : "admin-badge admin-badge-success";
  }

  function getStorageText(row) {
    return `${formatBytes(row?.used_storage_bytes)} / ${formatStorageLimit(row?.storage_limit_gb)}`;
  }

  function getAiText(row) {
    return `${formatNumber(row?.ai_processed_this_month)} / ${formatNumber(row?.ai_quota_monthly)}`;
  }

  async function getSupabaseClient() {
    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    return await window.AdminConfig.getSupabase();
  }

  async function fetchSubscriptions(supabase) {
    const { data, error } = await supabase.rpc("admin_get_subscriptions_overview");

    if (error) {
      console.error("Admin subscriptions fetch failed:", error);
      throw new Error("Unable to load subscriptions.");
    }

    return Array.isArray(data) ? data : [];
  }

  function calculateSummary(rows) {
    const totalStorageBytes = rows.reduce((sum, row) => {
      const bytes = Number(row?.used_storage_bytes || 0);
      return sum + (Number.isFinite(bytes) ? bytes : 0);
    }, 0);

    const activePaid = rows.filter((row) => {
      const status = String(row?.subscription_status || "").trim().toLowerCase();
      return row?.is_paid === true && status === "active";
    }).length;

    const freeUsers = rows.filter((row) => {
      const plan = String(row?.plan || "free").trim().toLowerCase();
      return row?.is_paid !== true || plan === "free";
    }).length;

    const inactiveUsers = rows.filter((row) => {
      const status = String(row?.subscription_status || "").trim().toLowerCase();
      return status !== "active";
    }).length;

    return {
      activePaid,
      freeUsers,
      inactiveUsers,
      totalStorageBytes
    };
  }

  function renderSummary() {
    const summary = calculateSummary(allSubscriptions);

    setText("activePaidCard", formatNumber(summary.activePaid));
    setText("freeUsersCard", formatNumber(summary.freeUsers));
    setText("inactiveUsersCard", formatNumber(summary.inactiveUsers));
    setText("subscriptionStorageCard", formatBytes(summary.totalStorageBytes));
  }

  function getFilteredSubscriptions() {
    const searchInput = document.getElementById("subscriptionSearchInput");
    const filterInput = document.getElementById("subscriptionFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(filterInput?.value || "all").trim().toLowerCase();

    return allSubscriptions.filter((row) => {
      const searchable = [
        row?.user_id,
        row?.studio_name,
        row?.owner_name,
        row?.email,
        row?.phone,
        row?.upi,
        row?.plan,
        row?.billing_cycle,
        row?.subscription_status
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      const status = String(row?.subscription_status || "inactive").trim().toLowerCase();
      const plan = String(row?.plan || "free").trim().toLowerCase();
      const isPaid = row?.is_paid === true;

      const matchesSearch = !search || searchable.includes(search);

      const matchesFilter =
        filter === "all" ||
        (filter === "active_paid" && isPaid && status === "active") ||
        (filter === "free" && (!isPaid || plan === "free")) ||
        (filter === "inactive" && status !== "active") ||
        (filter === "blocked" && row?.is_blocked === true);

      return matchesSearch && matchesFilter;
    });
  }

  function createDetailRow(label, value) {
    return `
      <div style="padding:0.85rem;border-radius:1rem;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:0.7rem;line-height:0.95rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</div>
        <div style="margin-top:0.35rem;font-size:0.92rem;line-height:1.35rem;font-weight:700;color:#ffffff;word-break:break-word;">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function closeSubscriptionDetailsModal() {
    const modal = document.getElementById("adminSubscriptionDetailsModal");
    if (modal) modal.remove();
    document.body.style.overflow = "";
  }

  function findSubscriptionById(userId) {
    return allSubscriptions.find((row) => String(row?.user_id || "") === String(userId || "")) || null;
  }

  function openSubscriptionDetailsModal(userId) {
    const row = findSubscriptionById(userId);
    if (!row) return;

    closeSubscriptionDetailsModal();

    const modal = document.createElement("div");
    modal.id = "adminSubscriptionDetailsModal";
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
      <div style="width:min(100%, 680px);max-height:90vh;overflow:auto;border-radius:1.5rem;background:rgba(15,23,42,0.98);border:1px solid rgba(255,255,255,0.10);box-shadow:0 26px 80px rgba(0,0,0,0.45);color:#ffffff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.2rem;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div>
            <div style="display:inline-flex;align-items:center;padding:0.32rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;background:rgba(99,102,241,0.16);border:1px solid rgba(129,140,248,0.30);">Subscription Details</div>
            <div style="margin-top:0.75rem;font-size:1.35rem;font-weight:900;line-height:1.65rem;">${escapeHtml(getDisplayName(row))}</div>
            <div style="margin-top:0.25rem;font-size:0.88rem;color:#94a3b8;">${escapeHtml(getDisplaySubtitle(row))}</div>
          </div>
          <button id="closeSubscriptionDetailsModalBtn" type="button" style="width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);color:#ffffff;font-size:1.35rem;line-height:1;cursor:pointer;">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span class="${getPlanBadgeClass(row)}">${escapeHtml(getPlanLabel(row))}</span>
            <span class="${getStatusBadgeClass(row)}">${escapeHtml(getStatusLabel(row))}</span>
            <span class="${getAccountBadgeClass(row)}">${escapeHtml(getAccountLabel(row))}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem;">
            ${createDetailRow("Studio Name", safeText(row?.studio_name))}
            ${createDetailRow("Owner Name", safeText(row?.owner_name))}
            ${createDetailRow("Email", safeText(row?.email))}
            ${createDetailRow("Phone", safeText(row?.phone))}
            ${createDetailRow("UPI", safeText(row?.upi))}
            ${createDetailRow("Plan", getPlanLabel(row))}
            ${createDetailRow("Billing Cycle", getBillingLabel(row))}
            ${createDetailRow("Subscription Status", getStatusLabel(row))}
            ${createDetailRow("Plan Started", formatDate(row?.plan_started_at))}
            ${createDetailRow("Plan Expires", formatDate(row?.plan_expires_at))}
            ${createDetailRow("Days Until Expiry", row?.days_until_expiry === null || row?.days_until_expiry === undefined ? "—" : formatNumber(row?.days_until_expiry))}
            ${createDetailRow("Storage Used", getStorageText(row))}
            ${createDetailRow("Storage Used %", `${safeText(row?.storage_used_percent, "0")}%`)}
            ${createDetailRow("Reserved Storage", formatBytes(row?.reserved_storage_bytes))}
            ${createDetailRow("AI Usage", getAiText(row))}
            ${createDetailRow("AI Used %", `${safeText(row?.ai_used_percent, "0")}%`)}
            ${createDetailRow("AI Cycle Start", formatDate(row?.ai_cycle_start_at))}
            ${createDetailRow("Account Status", getAccountLabel(row))}
            ${createDetailRow("User ID", safeText(row?.user_id))}
          </div>
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeSubscriptionDetailsModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = document.getElementById("closeSubscriptionDetailsModalBtn");
    if (closeBtn) closeBtn.onclick = closeSubscriptionDetailsModal;
  }

  function renderSubscriptionsList(rows) {
    const list = document.getElementById("subscriptionsList");
    if (!list) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = `<div class="admin-muted">No subscriptions found.</div>`;
      return;
    }

    const gridStyle =
      "display:grid;" +
      "grid-template-columns:minmax(280px, 1fr) 78px 92px 104px minmax(132px, 154px) minmax(112px, 132px);" +
      "gap:0.8rem;" +
      "align-items:center;";

    const headerRow = `
      <div style="${gridStyle}padding:0 0.95rem 0.5rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
        <div>User</div>
        <div style="text-align:center;">Plan</div>
        <div style="text-align:center;">Billing</div>
        <div style="text-align:center;">Status</div>
        <div style="text-align:right;">Storage</div>
        <div style="text-align:right;">Expiry</div>
      </div>
    `;

    const rowsHtml = rows.map((row) => {
      const userId = String(row?.user_id || "");
      const expiry = row?.plan_expires_at ? formatDate(row?.plan_expires_at) : "—";

      return `
        <div class="admin-list-item" data-admin-subscription-id="${escapeHtml(userId)}" style="cursor:pointer;${gridStyle}">
          <div style="min-width:0;">
            <button type="button" class="admin-list-title" style="background:transparent;border:0;padding:0;max-width:100%;color:#ffffff;font:inherit;font-weight:800;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(getDisplayName(row))}</button>
            <div class="admin-list-subtitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(getDisplaySubtitle(row))} · AI: ${escapeHtml(getAiText(row))}</div>
          </div>
          <div style="text-align:center;">
            <span class="${getPlanBadgeClass(row)}">${escapeHtml(getPlanLabel(row))}</span>
          </div>
          <div style="text-align:center;font-weight:800;color:#cbd5e1;">${escapeHtml(getBillingLabel(row))}</div>
          <div style="text-align:center;">
            <span class="${getStatusBadgeClass(row)}">${escapeHtml(getStatusLabel(row))}</span>
          </div>
          <div style="text-align:right;font-weight:900;color:#ffffff;white-space:nowrap;">${escapeHtml(getStorageText(row))}</div>
          <div style="text-align:right;font-weight:900;color:#ffffff;white-space:nowrap;">${escapeHtml(expiry)}</div>
        </div>
      `;
    }).join("");

    list.innerHTML = headerRow + rowsHtml;

    list.querySelectorAll("[data-admin-subscription-id]").forEach((card) => {
      card.addEventListener("click", () => openSubscriptionDetailsModal(card.getAttribute("data-admin-subscription-id")));
    });
  }

  function render() {
    renderSummary();
    renderSubscriptionsList(getFilteredSubscriptions());
  }

  async function loadSubscriptions() {
    hideError();

    const supabase = await getSupabaseClient();
    allSubscriptions = await fetchSubscriptions(supabase);

    render();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("refreshSubscriptionsBtn");
    const searchInput = document.getElementById("subscriptionSearchInput");
    const filterInput = document.getElementById("subscriptionFilter");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadSubscriptions();
        } catch (err) {
          console.error("Admin subscriptions refresh failed:", err);
          showError(err?.message || "Failed to refresh subscriptions.");
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

    if (filterInput && filterInput.dataset.bound !== "true") {
      filterInput.dataset.bound = "true";
      filterInput.addEventListener("change", render);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSubscriptionDetailsModal();
    });
  }

  async function init() {
    bindEvents();

    try {
      await loadSubscriptions();
    } catch (err) {
      console.error("Admin subscriptions load failed:", err);
      showError(err?.message || "Failed to load subscriptions.");
      allSubscriptions = [];
      render();
    }
  }

  window.AdminSubscriptions = {
    init,
    loadSubscriptions,
    openSubscriptionDetailsModal
  };
})();
