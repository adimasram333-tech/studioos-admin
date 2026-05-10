// ================================
// StudioOS Admin Revenue
// StudioOS company revenue only
// ================================

(function () {
  "use strict";

  let revenueRows = [];
  let revenueSummary = null;

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError(message) {
    const errorBox = document.getElementById("revenueError");
    if (!errorBox) return;

    errorBox.textContent = message || "Failed to load revenue.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    const errorBox = document.getElementById("revenueError");
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

  function formatCurrency(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return "₹0";

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(number);
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getRevenueTypeLabel(row) {
    const type = String(row?.revenue_type || "").trim();

    if (type === "photo_commission") return "PHOTO COMMISSION";
    if (type === "template_revenue") return "TEMPLATE";
    if (type === "subscription_revenue") return "SUBSCRIPTION";

    return "REVENUE";
  }

  function getRevenueBadgeClass(row) {
    const type = String(row?.revenue_type || "").trim();

    if (type === "photo_commission") return "admin-badge admin-badge-warning";
    if (type === "template_revenue") return "admin-badge admin-badge-success";
    if (type === "subscription_revenue") return "admin-badge admin-badge-muted";

    return "admin-badge admin-badge-muted";
  }

  function getDisplayName(row) {
    const ownerName = String(row?.owner_name || "").trim();
    const studioName = String(row?.studio_name || "").trim();
    const email = String(row?.email || "").trim();

    if (ownerName) return ownerName;
    if (studioName) return studioName;
    if (email) return email;

    return "StudioOS Revenue";
  }

  function getDisplaySubtitle(row) {
    const parts = [];
    const studioName = String(row?.studio_name || "").trim();
    const description = String(row?.description || "").trim();
    const plan = String(row?.plan_code || "").trim();
    const billing = String(row?.billing_cycle || "").trim();

    if (studioName) parts.push(studioName);
    if (description) parts.push(description);
    if (plan || billing) parts.push(`${plan.toUpperCase()} ${billing.toUpperCase()}`.trim());

    return parts.join(" · ") || "Revenue record";
  }

  async function getSupabaseClient() {
    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    return await window.AdminConfig.getSupabase();
  }

  async function fetchRevenue(supabase) {
    const [{ data: rows, error: rowsError }, { data: summaryRows, error: summaryError }] = await Promise.all([
      supabase.rpc("admin_get_revenue_overview"),
      supabase.rpc("admin_get_revenue_summary")
    ]);

    if (rowsError) {
      console.error("Admin revenue overview fetch failed:", rowsError);
      throw new Error("Unable to load revenue records.");
    }

    if (summaryError) {
      console.error("Admin revenue summary fetch failed:", summaryError);
      throw new Error("Unable to load revenue summary.");
    }

    revenueRows = Array.isArray(rows) ? rows : [];
    revenueSummary = Array.isArray(summaryRows) ? summaryRows[0] || null : summaryRows || null;
  }

  function renderSummary() {
    setText("totalStudioOSRevenueCard", formatCurrency(revenueSummary?.total_studioos_revenue || 0));
    setText("photoCommissionRevenueCard", formatCurrency(revenueSummary?.photo_commission_revenue || 0));
    setText("templateRevenueCard", formatCurrency(revenueSummary?.template_revenue || 0));
    setText("subscriptionRevenueCard", formatCurrency(revenueSummary?.subscription_revenue || 0));
  }

  function getFilteredRevenueRows() {
    const searchInput = document.getElementById("revenueSearchInput");
    const typeFilter = document.getElementById("revenueTypeFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(typeFilter?.value || "all").trim().toLowerCase();

    return revenueRows.filter((row) => {
      const type = String(row?.revenue_type || "").toLowerCase();

      const searchable = [
        row?.revenue_id,
        row?.revenue_type,
        row?.source_table,
        row?.studio_name,
        row?.owner_name,
        row?.email,
        row?.description,
        row?.plan_code,
        row?.billing_cycle,
        row?.payment_provider,
        row?.razorpay_order_id,
        row?.razorpay_payment_id
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      const matchesSearch = !search || searchable.includes(search);
      const matchesFilter = filter === "all" || type === filter;

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

  function closeRevenueModal() {
    const modal = document.getElementById("adminRevenueDetailsModal");
    if (modal) modal.remove();

    document.body.style.overflow = "";
  }

  function findRevenueById(revenueId) {
    const safeId = String(revenueId || "").trim();
    if (!safeId) return null;

    return revenueRows.find((row) => String(row?.revenue_id || "") === safeId) || null;
  }

  function openRevenueDetailsModal(revenueId) {
    const row = findRevenueById(revenueId);
    if (!row) return;

    closeRevenueModal();

    const modal = document.createElement("div");
    modal.id = "adminRevenueDetailsModal";
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
            <div style="display:inline-flex;align-items:center;padding:0.32rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;background:rgba(99,102,241,0.16);border:1px solid rgba(129,140,248,0.30);">Revenue Details</div>
            <div style="margin-top:0.75rem;font-size:1.35rem;font-weight:900;line-height:1.65rem;">${escapeHtml(formatCurrency(row?.amount))}</div>
            <div style="margin-top:0.25rem;font-size:0.88rem;color:#94a3b8;">${escapeHtml(getDisplaySubtitle(row))}</div>
          </div>
          <button id="closeRevenueDetailsModalBtn" type="button" style="width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);color:#ffffff;font-size:1.35rem;line-height:1;cursor:pointer;">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span class="${getRevenueBadgeClass(row)}">${escapeHtml(getRevenueTypeLabel(row))}</span>
            <span class="admin-badge admin-badge-success">${escapeHtml(safeText(row?.status, "earned").toUpperCase())}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem;">
            ${createDetailRow("Revenue Amount", formatCurrency(row?.amount))}
            ${createDetailRow("Revenue Type", getRevenueTypeLabel(row))}
            ${createDetailRow("Source Table", safeText(row?.source_table))}
            ${createDetailRow("Description", safeText(row?.description))}
            ${createDetailRow("Studio Name", safeText(row?.studio_name))}
            ${createDetailRow("Owner Name", safeText(row?.owner_name))}
            ${createDetailRow("Email", safeText(row?.email))}
            ${createDetailRow("Plan", safeText(row?.plan_code))}
            ${createDetailRow("Billing Cycle", safeText(row?.billing_cycle))}
            ${createDetailRow("Payment Provider", safeText(row?.payment_provider))}
            ${createDetailRow("Razorpay Order ID", safeText(row?.razorpay_order_id))}
            ${createDetailRow("Razorpay Payment ID", safeText(row?.razorpay_payment_id))}
            ${createDetailRow("Created At", formatDate(row?.created_at))}
            ${createDetailRow("User ID", safeText(row?.user_id))}
            ${createDetailRow("Source ID", safeText(row?.source_id))}
            ${createDetailRow("Revenue ID", safeText(row?.revenue_id))}
          </div>
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeRevenueModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = document.getElementById("closeRevenueDetailsModalBtn");
    if (closeBtn) closeBtn.onclick = closeRevenueModal;
  }

  function getRevenueTypeCount(type) {
    return revenueRows.filter((row) => String(row?.revenue_type || "").trim() === type).length;
  }

  function createBreakdownRow(label, amount, recordsCount, badgeClass) {
    return `
      <div class="admin-list-item" style="display:grid;grid-template-columns:minmax(0, 1fr) 140px 120px;gap:0.8rem;align-items:center;">
        <div style="min-width:0;">
          <div class="admin-list-title">${escapeHtml(label)}</div>
          <div class="admin-list-subtitle">StudioOS company revenue source</div>
        </div>
        <div style="text-align:right;font-weight:900;color:#ffffff;white-space:nowrap;">${escapeHtml(formatCurrency(amount))}</div>
        <div style="text-align:center;">
          <span class="${badgeClass}">${escapeHtml(String(recordsCount || 0))} records</span>
        </div>
      </div>
    `;
  }

  function renderRevenueBreakdown() {
    const total = Number(revenueSummary?.total_studioos_revenue || 0);
    const photoCommission = Number(revenueSummary?.photo_commission_revenue || 0);
    const templateRevenue = Number(revenueSummary?.template_revenue || 0);
    const subscriptionRevenue = Number(revenueSummary?.subscription_revenue || 0);

    const totalRecords = Number(revenueSummary?.revenue_records_count || revenueRows.length || 0);
    const photoRecords = getRevenueTypeCount("photo_commission");
    const templateRecords = getRevenueTypeCount("template_revenue");
    const subscriptionRecords = getRevenueTypeCount("subscription_revenue");

    return `
      <div style="margin-bottom:1rem;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:0.75rem;">
          <div>
            <div class="admin-panel-title">Revenue Breakdown</div>
            <div class="admin-panel-subtitle">Grouped summary only. Photographer earnings are excluded.</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0, 1fr) 140px 120px;gap:0.8rem;align-items:center;padding:0 0.95rem 0.5rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
          <div>Source</div>
          <div style="text-align:right;">Amount</div>
          <div style="text-align:center;">Records</div>
        </div>

        ${createBreakdownRow("Total StudioOS Revenue", total, totalRecords, "admin-badge admin-badge-success")}
        ${createBreakdownRow("Photo Commission", photoCommission, photoRecords, "admin-badge admin-badge-warning")}
        ${createBreakdownRow("Template Revenue", templateRevenue, templateRecords, "admin-badge admin-badge-success")}
        ${createBreakdownRow("Subscription Revenue", subscriptionRevenue, subscriptionRecords, "admin-badge admin-badge-muted")}
      </div>
    `;
  }

  function renderRecentRevenueActivity(rows) {
    const recentRows = Array.isArray(rows) ? rows.slice(0, 8) : [];

    if (recentRows.length === 0) {
      return `
        <div style="margin-top:1.25rem;">
          <div class="admin-panel-title">Recent Revenue Activity</div>
          <div class="admin-muted" style="margin-top:0.75rem;">No recent StudioOS revenue records found.</div>
        </div>
      `;
    }

    const headerRow = `
      <div style="display:grid;grid-template-columns:minmax(0, 1fr) 132px 118px 112px;gap:0.8rem;align-items:center;padding:0 0.95rem 0.5rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
        <div>Revenue</div>
        <div style="text-align:center;">Type</div>
        <div style="text-align:right;">Amount</div>
        <div style="text-align:right;">Date</div>
      </div>
    `;

    const rowsHtml = recentRows.map((row) => {
      const revenueId = String(row?.revenue_id || "");
      const date = row?.created_at ? new Date(row.created_at) : null;
      const shortDate = date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "—";

      return `
        <div class="admin-list-item" data-admin-revenue-id="${escapeHtml(revenueId)}" style="cursor:pointer;display:grid;grid-template-columns:minmax(0, 1fr) 132px 118px 112px;gap:0.8rem;align-items:center;">
          <div style="min-width:0;">
            <button type="button" class="admin-list-title" style="background:transparent;border:0;padding:0;max-width:100%;color:#ffffff;font:inherit;font-weight:800;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(getDisplayName(row))}</button>
            <div class="admin-list-subtitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(getDisplaySubtitle(row))}</div>
          </div>
          <div style="text-align:center;">
            <span class="${getRevenueBadgeClass(row)}">${escapeHtml(getRevenueTypeLabel(row))}</span>
          </div>
          <div style="text-align:right;font-weight:900;color:#ffffff;white-space:nowrap;">${escapeHtml(formatCurrency(row?.amount))}</div>
          <div style="text-align:right;font-weight:800;color:#cbd5e1;white-space:nowrap;">${escapeHtml(shortDate)}</div>
        </div>
      `;
    }).join("");

    return `
      <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;margin-bottom:0.75rem;">
          <div>
            <div class="admin-panel-title">Recent Revenue Activity</div>
            <div class="admin-panel-subtitle">Latest 8 records only, to keep this page clean.</div>
          </div>
        </div>
        ${headerRow}
        ${rowsHtml}
      </div>
    `;
  }

  function renderRevenueList(rows) {
    const list = document.getElementById("revenueList");
    if (!list) return;

    const filteredRows = Array.isArray(rows) ? rows : [];

    if (!Array.isArray(revenueRows) || revenueRows.length === 0) {
      list.innerHTML = `
        ${renderRevenueBreakdown()}
        <div class="admin-muted">No StudioOS revenue records found.</div>
      `;
      return;
    }

    list.innerHTML = renderRevenueBreakdown() + renderRecentRevenueActivity(filteredRows);

    list.querySelectorAll("[data-admin-revenue-id]").forEach((card) => {
      card.addEventListener("click", () => openRevenueDetailsModal(card.getAttribute("data-admin-revenue-id")));
    });
  }

  function render() {
    renderSummary();
    renderRevenueList(getFilteredRevenueRows());
  }

  async function loadRevenue() {
    hideError();

    const supabase = await getSupabaseClient();
    await fetchRevenue(supabase);

    render();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("refreshRevenueBtn");
    const searchInput = document.getElementById("revenueSearchInput");
    const typeFilter = document.getElementById("revenueTypeFilter");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadRevenue();
        } catch (err) {
          console.error("Admin revenue refresh failed:", err);
          showError(err?.message || "Failed to refresh revenue.");
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

    if (typeFilter && typeFilter.dataset.bound !== "true") {
      typeFilter.dataset.bound = "true";
      typeFilter.addEventListener("change", render);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeRevenueModal();
    });
  }

  async function init() {
    bindEvents();

    try {
      await loadRevenue();
    } catch (err) {
      console.error("Admin revenue load failed:", err);
      showError(err?.message || "Failed to load revenue.");
      revenueRows = [];
      revenueSummary = null;
      render();
    }
  }

  window.AdminRevenue = {
    init,
    loadRevenue,
    openRevenueDetailsModal
  };
})();
