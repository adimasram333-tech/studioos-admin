// ================================
// StudioOS Admin Earnings + Payout Requests
// Photographer earnings overview + payout approvals
// ================================

(function () {
  "use strict";

  let allEarnings = [];
  let allPayoutRequests = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError(message) {
    const errorBox = document.getElementById("paymentsError");
    if (!errorBox) return;
    errorBox.textContent = message || "Failed to load earnings.";
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    const errorBox = document.getElementById("paymentsError");
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

  function getAmount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function getDisplayName(row) {
    const ownerName = String(row?.owner_name || "").trim();
    const studioName = String(row?.studio_name || "").trim();
    const email = String(row?.email || "").trim();

    if (ownerName) return ownerName;
    if (studioName) return studioName;
    if (email) return email;

    return "Unknown Photographer";
  }

  function getDisplaySubtitle(row) {
    const parts = [];
    const studioName = String(row?.studio_name || "").trim();
    const phone = String(row?.phone || "").trim();
    const email = String(row?.email || "").trim();
    const upi = String(row?.upi || "").trim();

    if (studioName) parts.push(studioName);
    if (phone) parts.push(phone);
    else if (email) parts.push(email);
    if (upi) parts.push(`UPI: ${upi}`);

    return parts.join(" · ") || "Photographer account";
  }

  function getStatusBadgeClass(status) {
    const safeStatus = String(status || "").trim().toLowerCase();

    if (safeStatus === "approved" || safeStatus === "paid" || safeStatus === "completed") {
      return "admin-badge admin-badge-success";
    }

    if (safeStatus === "pending") {
      return "admin-badge admin-badge-warning";
    }

    if (safeStatus === "rejected") {
      return "admin-badge admin-badge-muted";
    }

    return "admin-badge admin-badge-muted";
  }

  function getStatusLabel(status) {
    return String(status || "unknown").trim().toUpperCase();
  }

  async function getSupabaseClient() {
    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    return await window.AdminConfig.getSupabase();
  }

  async function fetchEarnings(supabase) {
    const { data, error } = await supabase.rpc("admin_get_earnings_overview");

    if (error) {
      console.error("Admin earnings fetch failed:", error);
      throw new Error("Unable to load earnings.");
    }

    return Array.isArray(data) ? data : [];
  }

  async function fetchPayoutRequests(supabase) {
    const { data, error } = await supabase.rpc("admin_get_payout_requests");

    if (error) {
      console.error("Admin payout requests fetch failed:", error);
      throw new Error("Unable to load payout requests.");
    }

    return Array.isArray(data) ? data : [];
  }

  function calculateSummary() {
    const grossPhotoSales = allEarnings.reduce((sum, row) => sum + getAmount(row?.gross_photo_sales), 0);
    const photographerEarnings = allEarnings.reduce((sum, row) => sum + getAmount(row?.photographer_earnings), 0);
    const platformEarnings = allEarnings.reduce((sum, row) => sum + getAmount(row?.platform_earnings), 0);
    const pendingPayouts = allEarnings.reduce((sum, row) => sum + getAmount(row?.pending_payout_total), 0);

    return {
      grossPhotoSales,
      photographerEarnings,
      platformEarnings,
      pendingPayouts
    };
  }

  function renderSummary() {
    const summary = calculateSummary();

    setText("paymentsGrossCard", formatCurrency(summary.grossPhotoSales));
    setText("paymentsPhotographerCard", formatCurrency(summary.photographerEarnings));
    setText("paymentsPlatformCard", formatCurrency(summary.platformEarnings));
    setText("paymentsPendingPayoutCard", formatCurrency(summary.pendingPayouts));
  }

  function getFilteredEarnings() {
    const searchInput = document.getElementById("earningSearchInput");
    const filterInput = document.getElementById("earningFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(filterInput?.value || "all").trim().toLowerCase();

    return allEarnings.filter((row) => {
      const searchable = [
        row?.photographer_id,
        row?.studio_name,
        row?.owner_name,
        row?.email,
        row?.phone,
        row?.upi
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      const matchesSearch = !search || searchable.includes(search);

      const hasEarnings = getAmount(row?.photographer_earnings) > 0;
      const hasBalance = getAmount(row?.available_balance) > 0;
      const hasPending = getAmount(row?.pending_payout_total) > 0;

      const matchesFilter =
        filter === "all" ||
        (filter === "has_earnings" && hasEarnings) ||
        (filter === "has_balance" && hasBalance) ||
        (filter === "pending_payout" && hasPending);

      return matchesSearch && matchesFilter;
    });
  }

  function getFilteredPayoutRequests() {
    const searchInput = document.getElementById("payoutSearchInput");
    const filterInput = document.getElementById("payoutStatusFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(filterInput?.value || "all").trim().toLowerCase();

    return allPayoutRequests.filter((row) => {
      const status = String(row?.status || "pending").trim().toLowerCase();

      const searchable = [
        row?.payout_request_id,
        row?.photographer_id,
        row?.studio_name,
        row?.owner_name,
        row?.email,
        row?.phone,
        row?.upi,
        row?.requested_upi,
        row?.requested_name,
        row?.status
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      const matchesSearch = !search || searchable.includes(search);
      const matchesFilter = filter === "all" || status === filter;

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

  function closeModalById(id) {
    const modal = document.getElementById(id);
    if (modal) modal.remove();
    document.body.style.overflow = "";
  }

  function openEarningDetailsModal(photographerId) {
    const row = allEarnings.find((item) => String(item?.photographer_id || "") === String(photographerId || ""));
    if (!row) return;

    closeModalById("adminEarningDetailsModal");

    const modal = document.createElement("div");
    modal.id = "adminEarningDetailsModal";
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
            <div style="display:inline-flex;align-items:center;padding:0.32rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;background:rgba(99,102,241,0.16);border:1px solid rgba(129,140,248,0.30);">Earning Details</div>
            <div style="margin-top:0.75rem;font-size:1.35rem;font-weight:900;line-height:1.65rem;">${escapeHtml(getDisplayName(row))}</div>
            <div style="margin-top:0.25rem;font-size:0.88rem;color:#94a3b8;">${escapeHtml(getDisplaySubtitle(row))}</div>
          </div>
          <button id="closeEarningDetailsModalBtn" type="button" style="width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);color:#ffffff;font-size:1.35rem;line-height:1;cursor:pointer;">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem;">
            ${createDetailRow("Gross Photo Sales", formatCurrency(row?.gross_photo_sales))}
            ${createDetailRow("Gateway Fees", formatCurrency(row?.gateway_fees))}
            ${createDetailRow("Net Photo Sales", formatCurrency(row?.net_photo_sales))}
            ${createDetailRow("Photographer Earnings", formatCurrency(row?.photographer_earnings))}
            ${createDetailRow("Platform Earnings", formatCurrency(row?.platform_earnings))}
            ${createDetailRow("Available Balance", formatCurrency(row?.available_balance))}
            ${createDetailRow("Pending Payout", formatCurrency(row?.pending_payout_total))}
            ${createDetailRow("Approved Payout", formatCurrency(row?.approved_payout_total))}
            ${createDetailRow("Rejected Payout", formatCurrency(row?.rejected_payout_total))}
            ${createDetailRow("Photo Sales Count", formatNumber(row?.total_photo_sales_count))}
            ${createDetailRow("Last Sale At", formatDate(row?.last_sale_at))}
            ${createDetailRow("Photographer ID", safeText(row?.photographer_id))}
            ${createDetailRow("Studio Name", safeText(row?.studio_name))}
            ${createDetailRow("Owner Name", safeText(row?.owner_name))}
            ${createDetailRow("Email", safeText(row?.email))}
            ${createDetailRow("Phone", safeText(row?.phone))}
            ${createDetailRow("UPI", safeText(row?.upi))}
          </div>
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModalById("adminEarningDetailsModal");
    });

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = document.getElementById("closeEarningDetailsModalBtn");
    if (closeBtn) closeBtn.onclick = () => closeModalById("adminEarningDetailsModal");
  }

  function openPayoutDecisionModal(requestId, nextStatus) {
    const request = allPayoutRequests.find((item) => String(item?.payout_request_id || "") === String(requestId || ""));
    if (!request) return;

    const safeNextStatus = String(nextStatus || "").trim().toLowerCase();
    if (safeNextStatus !== "approved" && safeNextStatus !== "rejected") return;

    closeModalById("adminPayoutDecisionModal");

    const modal = document.createElement("div");
    modal.id = "adminPayoutDecisionModal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.zIndex = "10000";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "1rem";
    modal.style.background = "rgba(2,6,23,0.78)";
    modal.style.backdropFilter = "blur(10px)";

    const actionTitle = safeNextStatus === "approved" ? "Approve Payout" : "Reject Payout";
    const actionButton = safeNextStatus === "approved" ? "Approve Request" : "Reject Request";

    modal.innerHTML = `
      <div style="width:min(100%, 520px);border-radius:1.5rem;background:rgba(15,23,42,0.98);border:1px solid rgba(255,255,255,0.10);box-shadow:0 26px 80px rgba(0,0,0,0.45);color:#ffffff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;padding:1.2rem;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div>
            <div style="font-size:1.25rem;font-weight:900;">${escapeHtml(actionTitle)}</div>
            <div style="margin-top:0.35rem;font-size:0.88rem;color:#94a3b8;">${escapeHtml(getDisplayName(request))} · ${escapeHtml(formatCurrency(request?.amount))}</div>
          </div>
          <button id="closePayoutDecisionModalBtn" type="button" style="width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);color:#ffffff;font-size:1.35rem;line-height:1;cursor:pointer;">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="padding:0.95rem;border-radius:1rem;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);font-size:0.85rem;line-height:1.35rem;color:#cbd5e1;">
            <strong style="color:#fff;">Important:</strong>
            Approve only after the manual UPI/bank payout is completed and verified outside StudioOS.
          </div>

          <label style="display:block;margin-top:1rem;font-size:0.75rem;font-weight:800;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.08em;">Admin note</label>
          <textarea id="payoutDecisionNote" rows="4" placeholder="Add optional note..." style="margin-top:0.5rem;width:100%;border-radius:1rem;background:rgba(2,6,23,0.75);border:1px solid rgba(255,255,255,0.10);color:#fff;padding:0.8rem;outline:none;"></textarea>

          <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1rem;">
            <button id="cancelPayoutDecisionBtn" type="button" style="padding:0.7rem 1rem;border-radius:0.9rem;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-weight:800;cursor:pointer;">Cancel</button>
            <button id="confirmPayoutDecisionBtn" type="button" style="padding:0.7rem 1rem;border-radius:0.9rem;border:1px solid ${safeNextStatus === "approved" ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)"};background:${safeNextStatus === "approved" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"};color:${safeNextStatus === "approved" ? "#bbf7d0" : "#fecaca"};font-weight:900;cursor:pointer;">${escapeHtml(actionButton)}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const close = () => closeModalById("adminPayoutDecisionModal");

    const closeBtn = document.getElementById("closePayoutDecisionModalBtn");
    const cancelBtn = document.getElementById("cancelPayoutDecisionBtn");
    const confirmBtn = document.getElementById("confirmPayoutDecisionBtn");

    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const noteInput = document.getElementById("payoutDecisionNote");
        const note = String(noteInput?.value || "").trim();
        await updatePayoutRequestStatus(requestId, safeNextStatus, note);
        close();
      };
    }
  }

  async function updatePayoutRequestStatus(requestId, nextStatus, note) {
    try {
      const supabase = await getSupabaseClient();

      const { error } = await supabase.rpc("admin_update_payout_request_status", {
        target_payout_request_id: requestId,
        next_status: nextStatus,
        note: note || null
      });

      if (error) throw error;

      await loadAll();
    } catch (err) {
      console.error("Payout request update failed:", err);
      alert(err?.message || "Failed to update payout request.");
    }
  }

  function renderEarningsList(rows) {
    const list = document.getElementById("earningsList");
    if (!list) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = `<div class="admin-muted">No photographer earnings found.</div>`;
      return;
    }

    const headerRow = `
      <div style="display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto auto;gap:0.65rem;align-items:center;padding:0 0.85rem 0.45rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
        <div>Photographer</div>
        <div style="min-width:6.5rem;text-align:right;">Sales</div>
        <div style="min-width:7.5rem;text-align:right;">Earnings</div>
        <div style="min-width:7.5rem;text-align:right;">Platform</div>
        <div style="min-width:7.5rem;text-align:right;">Available</div>
      </div>
    `;

    const rowsHtml = rows.map((row) => {
      const photographerId = String(row?.photographer_id || "");

      return `
        <div class="admin-list-item" data-admin-earning-id="${escapeHtml(photographerId)}" style="cursor:pointer;display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto auto;gap:0.65rem;align-items:center;">
          <div>
            <button type="button" class="admin-list-title" style="background:transparent;border:0;padding:0;color:#ffffff;font:inherit;font-weight:800;text-align:left;cursor:pointer;">${escapeHtml(getDisplayName(row))}</button>
            <div class="admin-list-subtitle">${escapeHtml(getDisplaySubtitle(row))} · Sales Count: ${escapeHtml(formatNumber(row?.total_photo_sales_count))}</div>
          </div>
          <div style="min-width:6.5rem;text-align:right;font-weight:900;color:#ffffff;">${escapeHtml(formatCurrency(row?.gross_photo_sales))}</div>
          <div style="min-width:7.5rem;text-align:right;font-weight:900;color:#ffffff;">${escapeHtml(formatCurrency(row?.photographer_earnings))}</div>
          <div style="min-width:7.5rem;text-align:right;font-weight:900;color:#ffffff;">${escapeHtml(formatCurrency(row?.platform_earnings))}</div>
          <div style="min-width:7.5rem;text-align:right;font-weight:900;color:#ffffff;">${escapeHtml(formatCurrency(row?.available_balance))}</div>
        </div>
      `;
    }).join("");

    list.innerHTML = headerRow + rowsHtml;

    list.querySelectorAll("[data-admin-earning-id]").forEach((card) => {
      card.addEventListener("click", () => openEarningDetailsModal(card.getAttribute("data-admin-earning-id")));
    });
  }

  function renderPayoutRequestsList(rows) {
    const list = document.getElementById("payoutRequestsList");
    if (!list) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = `<div class="admin-muted">No payout requests found.</div>`;
      return;
    }

    const headerRow = `
      <div style="display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto;gap:0.65rem;align-items:center;padding:0 0.85rem 0.45rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
        <div>Request</div>
        <div style="min-width:6.5rem;text-align:right;">Amount</div>
        <div style="min-width:6.5rem;text-align:center;">Status</div>
        <div style="min-width:10rem;text-align:right;">Action</div>
      </div>
    `;

    const rowsHtml = rows.map((row) => {
      const requestId = String(row?.payout_request_id || "");
      const status = String(row?.status || "pending").trim().toLowerCase();
      const requestedUpi = safeText(row?.requested_upi || row?.upi);
      const requestedName = safeText(row?.requested_name || row?.owner_name);
      let actionButtons = "";

      if (status === "pending") {
        actionButtons = `
          <button type="button" data-approve-payout="${escapeHtml(requestId)}" style="padding:0.45rem 0.65rem;border-radius:0.75rem;background:rgba(34,197,94,0.14);border:1px solid rgba(34,197,94,0.28);color:#bbf7d0;font-size:0.75rem;font-weight:900;cursor:pointer;">Approve</button>
          <button type="button" data-reject-payout="${escapeHtml(requestId)}" style="padding:0.45rem 0.65rem;border-radius:0.75rem;background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.28);color:#fecaca;font-size:0.75rem;font-weight:900;cursor:pointer;">Reject</button>
        `;
      } else if (status === "approved" || status === "paid" || status === "completed") {
        actionButtons = `<span style="display:inline-flex;align-items:center;justify-content:center;padding:0.45rem 0.7rem;border-radius:0.75rem;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.24);color:#bbf7d0;font-size:0.75rem;font-weight:900;">Completed</span>`;
      } else if (status === "rejected") {
        actionButtons = `<span style="display:inline-flex;align-items:center;justify-content:center;padding:0.45rem 0.7rem;border-radius:0.75rem;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.20);color:#cbd5e1;font-size:0.75rem;font-weight:900;">Rejected</span>`;
      } else {
        actionButtons = `<span class="admin-muted">Closed</span>`;
      }

      return `
        <div class="admin-list-item" style="display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto;gap:0.65rem;align-items:center;">
          <div>
            <div class="admin-list-title">${escapeHtml(getDisplayName(row))}</div>
            <div class="admin-list-subtitle">UPI: ${escapeHtml(requestedUpi)} · Name: ${escapeHtml(requestedName)} · ${escapeHtml(formatDate(row?.created_at))}</div>
          </div>
          <div style="min-width:6.5rem;text-align:right;font-weight:900;color:#ffffff;">${escapeHtml(formatCurrency(row?.amount))}</div>
          <div style="min-width:6.5rem;text-align:center;">
            <span class="${getStatusBadgeClass(status)}">${escapeHtml(getStatusLabel(status))}</span>
          </div>
          <div style="min-width:10rem;text-align:right;display:flex;justify-content:flex-end;gap:0.45rem;">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = headerRow + rowsHtml;

    list.querySelectorAll("[data-approve-payout]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openPayoutDecisionModal(button.getAttribute("data-approve-payout"), "approved");
      });
    });

    list.querySelectorAll("[data-reject-payout]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openPayoutDecisionModal(button.getAttribute("data-reject-payout"), "rejected");
      });
    });
  }

  function render() {
    renderSummary();
    renderEarningsList(getFilteredEarnings());
    renderPayoutRequestsList(getFilteredPayoutRequests());
  }

  async function loadAll() {
    hideError();

    const supabase = await getSupabaseClient();
    const [earnings, payoutRequests] = await Promise.all([
      fetchEarnings(supabase),
      fetchPayoutRequests(supabase)
    ]);

    allEarnings = earnings;
    allPayoutRequests = payoutRequests;

    render();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("refreshPaymentsBtn");
    const earningSearchInput = document.getElementById("earningSearchInput");
    const earningFilter = document.getElementById("earningFilter");
    const payoutSearchInput = document.getElementById("payoutSearchInput");
    const payoutStatusFilter = document.getElementById("payoutStatusFilter");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadAll();
        } catch (err) {
          console.error("Admin earnings refresh failed:", err);
          showError(err?.message || "Failed to refresh earnings.");
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "Refresh";
        }
      });
    }

    if (earningSearchInput && earningSearchInput.dataset.bound !== "true") {
      earningSearchInput.dataset.bound = "true";
      earningSearchInput.addEventListener("input", render);
    }

    if (earningFilter && earningFilter.dataset.bound !== "true") {
      earningFilter.dataset.bound = "true";
      earningFilter.addEventListener("change", render);
    }

    if (payoutSearchInput && payoutSearchInput.dataset.bound !== "true") {
      payoutSearchInput.dataset.bound = "true";
      payoutSearchInput.addEventListener("input", render);
    }

    if (payoutStatusFilter && payoutStatusFilter.dataset.bound !== "true") {
      payoutStatusFilter.dataset.bound = "true";
      payoutStatusFilter.addEventListener("change", render);
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModalById("adminEarningDetailsModal");
        closeModalById("adminPayoutDecisionModal");
      }
    });
  }

  async function init() {
    bindEvents();

    try {
      await loadAll();
    } catch (err) {
      console.error("Admin earnings load failed:", err);
      showError(err?.message || "Failed to load earnings.");
      allEarnings = [];
      allPayoutRequests = [];
      render();
    }
  }

  window.AdminPayments = {
    init,
    loadPayments: loadAll,
    loadAll,
    openEarningDetailsModal
  };
})();
