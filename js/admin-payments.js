// ================================
// StudioOS Admin Payments
// Combined payments overview + details
// ================================

(function () {
  "use strict";

  let allPayments = [];

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function showError(message) {
    const errorBox = document.getElementById("paymentsError");
    if (!errorBox) return;
    errorBox.textContent = message || "Failed to load payments.";
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

  function getPaymentId(row) {
    return String(row?.payment_id || "");
  }

  function getAmount(row) {
    const amount = Number(row?.amount || row?.gross_amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getGrossAmount(row) {
    const amount = Number(row?.gross_amount || row?.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getPhotographerAmount(row) {
    const amount = Number(row?.photographer_amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getPlatformAmount(row) {
    const amount = Number(row?.platform_amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getGatewayFee(row) {
    const amount = Number(row?.gateway_fee || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getNetAmount(row) {
    const amount = Number(row?.net_amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function getTypeLabel(row) {
    const type = String(row?.payment_type || "").trim();

    if (type === "template_purchase") return "TEMPLATE";
    if (type === "photo_purchase") return "PHOTO";
    if (type === "photo_transaction") return "TRANSACTION";

    return "PAYMENT";
  }

  function getTypeBadgeClass(row) {
    const type = String(row?.payment_type || "").trim();

    if (type === "template_purchase") return "admin-badge admin-badge-success";
    if (type === "photo_purchase") return "admin-badge admin-badge-muted";
    if (type === "photo_transaction") return "admin-badge admin-badge-warning";

    return "admin-badge admin-badge-muted";
  }

  function getStatusLabel(row) {
    return String(row?.status || "unknown").trim().toUpperCase();
  }

  function getStatusBadgeClass(row) {
    const status = getStatusLabel(row).toLowerCase();

    if (status === "success" || status === "paid" || status === "captured" || status === "completed" || status === "verified") {
      return "admin-badge admin-badge-success";
    }

    if (status === "created" || status === "pending") {
      return "admin-badge admin-badge-warning";
    }

    return "admin-badge admin-badge-muted";
  }

  function getDisplayName(row) {
    const ownerName = String(row?.owner_name || "").trim();
    const studioName = String(row?.studio_name || "").trim();
    const buyerName = String(row?.buyer_name || "").trim();

    if (ownerName) return ownerName;
    if (studioName) return studioName;
    if (buyerName) return buyerName;

    return "Unknown User";
  }

  function getDisplaySubtitle(row) {
    const parts = [];
    const studioName = String(row?.studio_name || "").trim();
    const buyerName = String(row?.buyer_name || "").trim();
    const itemName = String(row?.item_name || "").trim();
    const sourceTable = String(row?.source_table || "").replace(/_/g, " ");

    if (studioName) parts.push(studioName);
    if (buyerName) parts.push(`Buyer: ${buyerName}`);
    if (itemName) parts.push(itemName);
    if (sourceTable) parts.push(sourceTable);

    return parts.join(" · ") || "Payment record";
  }

  async function fetchPayments(supabase) {
    try {
      const { data, error } = await supabase.rpc("admin_get_payments_overview");

      if (error) {
        throw error;
      }

      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Admin payments fetch failed:", err);
      throw new Error("Unable to load payments.");
    }
  }

  function calculateSummary(payments) {
    const totalPayments = Array.isArray(payments) ? payments.length : 0;

    const grossRevenue = payments.reduce((sum, row) => sum + getGrossAmount(row), 0);
    const photographerShare = payments.reduce((sum, row) => sum + getPhotographerAmount(row), 0);
    const platformShare = payments.reduce((sum, row) => sum + getPlatformAmount(row), 0);

    return {
      totalPayments,
      grossRevenue,
      photographerShare,
      platformShare
    };
  }

  function renderSummary(payments) {
    const summary = calculateSummary(payments);

    setText("paymentsTotalCard", formatNumber(summary.totalPayments));
    setText("paymentsGrossCard", formatCurrency(summary.grossRevenue));
    setText("paymentsPhotographerCard", formatCurrency(summary.photographerShare));
    setText("paymentsPlatformCard", formatCurrency(summary.platformShare));
  }

  function getFilteredPayments() {
    const searchInput = document.getElementById("paymentSearchInput");
    const typeFilter = document.getElementById("paymentTypeFilter");

    const search = String(searchInput?.value || "").trim().toLowerCase();
    const filter = String(typeFilter?.value || "all").trim().toLowerCase();

    return allPayments.filter((payment) => {
      const paymentType = String(payment?.payment_type || "").toLowerCase();

      const searchable = [
        payment?.payment_id,
        payment?.source_table,
        payment?.payment_type,
        payment?.studio_name,
        payment?.owner_name,
        payment?.user_email,
        payment?.buyer_name,
        payment?.buyer_upi_id,
        payment?.buyer_upi_name,
        payment?.item_name,
        payment?.status,
        payment?.payment_provider,
        payment?.razorpay_order_id,
        payment?.razorpay_payment_id
      ].map((value) => String(value || "").toLowerCase()).join(" ");

      const matchesSearch = !search || searchable.includes(search);
      const matchesFilter = filter === "all" || paymentType === filter;

      return matchesSearch && matchesFilter;
    });
  }

  function findPaymentById(paymentId) {
    const safeId = String(paymentId || "").trim();
    if (!safeId) return null;
    return allPayments.find((payment) => String(payment?.payment_id || "") === safeId) || null;
  }

  function createDetailRow(label, value) {
    return `
      <div style="padding:0.85rem;border-radius:1rem;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.07);">
        <div style="font-size:0.7rem;line-height:0.95rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</div>
        <div style="margin-top:0.35rem;font-size:0.92rem;line-height:1.35rem;font-weight:700;color:#ffffff;word-break:break-word;">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function closePaymentDetailsModal() {
    const modal = document.getElementById("adminPaymentDetailsModal");
    if (modal) modal.remove();
    document.body.style.overflow = "";
  }

  function openPaymentDetailsModal(paymentId) {
    const payment = findPaymentById(paymentId);
    if (!payment) return;

    closePaymentDetailsModal();

    const modal = document.createElement("div");
    modal.id = "adminPaymentDetailsModal";
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
            <div style="display:inline-flex;align-items:center;padding:0.32rem 0.6rem;border-radius:999px;font-size:0.68rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;background:rgba(99,102,241,0.16);border:1px solid rgba(129,140,248,0.30);">Payment Details</div>
            <div style="margin-top:0.75rem;font-size:1.35rem;font-weight:900;line-height:1.65rem;">${escapeHtml(getDisplayName(payment))}</div>
            <div style="margin-top:0.25rem;font-size:0.88rem;color:#94a3b8;">${escapeHtml(getDisplaySubtitle(payment))}</div>
          </div>
          <button id="closePaymentDetailsModalBtn" type="button" style="width:2.2rem;height:2.2rem;border-radius:999px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.06);color:#ffffff;font-size:1.35rem;line-height:1;cursor:pointer;">×</button>
        </div>

        <div style="padding:1.2rem;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-bottom:1rem;">
            <span class="${getTypeBadgeClass(payment)}">${escapeHtml(getTypeLabel(payment))}</span>
            <span class="${getStatusBadgeClass(payment)}">${escapeHtml(getStatusLabel(payment))}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:0.75rem;">
            ${createDetailRow("Amount", formatCurrency(getAmount(payment)))}
            ${createDetailRow("Gross Amount", formatCurrency(getGrossAmount(payment)))}
            ${createDetailRow("Gateway Fee", formatCurrency(getGatewayFee(payment)))}
            ${createDetailRow("Net Amount", formatCurrency(getNetAmount(payment)))}
            ${createDetailRow("Photographer Share", formatCurrency(getPhotographerAmount(payment)))}
            ${createDetailRow("Platform Share", formatCurrency(getPlatformAmount(payment)))}
            ${createDetailRow("Studio Name", safeText(payment?.studio_name))}
            ${createDetailRow("Owner Name", safeText(payment?.owner_name))}
            ${createDetailRow("User Email", safeText(payment?.user_email))}
            ${createDetailRow("Buyer Name", safeText(payment?.buyer_name))}
            ${createDetailRow("Buyer UPI", safeText(payment?.buyer_upi_id))}
            ${createDetailRow("Buyer UPI Name", safeText(payment?.buyer_upi_name))}
            ${createDetailRow("Item", safeText(payment?.item_name))}
            ${createDetailRow("Payment Type", safeText(payment?.payment_type))}
            ${createDetailRow("Source Table", safeText(payment?.source_table))}
            ${createDetailRow("Payment Provider", safeText(payment?.payment_provider))}
            ${createDetailRow("Razorpay Order ID", safeText(payment?.razorpay_order_id))}
            ${createDetailRow("Razorpay Payment ID", safeText(payment?.razorpay_payment_id))}
            ${createDetailRow("Payment ID", safeText(payment?.payment_id))}
            ${createDetailRow("Image Purchase ID", safeText(payment?.image_purchase_id))}
            ${createDetailRow("Event ID", safeText(payment?.event_id))}
            ${createDetailRow("Photo ID", safeText(payment?.photo_id))}
            ${createDetailRow("Created At", formatDate(payment?.created_at))}
            ${createDetailRow("Updated At", formatDate(payment?.updated_at))}
          </div>
        </div>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closePaymentDetailsModal();
    });

    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    const closeBtn = document.getElementById("closePaymentDetailsModalBtn");
    if (closeBtn) closeBtn.onclick = closePaymentDetailsModal;
  }

  function renderPaymentsList(payments) {
    const list = document.getElementById("paymentsList");
    if (!list) return;

    if (!Array.isArray(payments) || payments.length === 0) {
      list.innerHTML = `<div class="admin-muted">No payments found.</div>`;
      return;
    }

    const headerRow = `
      <div style="display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto;gap:0.65rem;align-items:center;padding:0 0.85rem 0.45rem;color:#cbd5e1;font-size:0.72rem;line-height:1rem;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
        <div>Payment</div>
        <div style="min-width:6.4rem;text-align:center;">Type</div>
        <div style="min-width:6.4rem;text-align:center;">Status</div>
        <div style="min-width:6.4rem;text-align:right;">Amount</div>
      </div>
    `;

    const rowsHtml = payments.map((payment) => {
      const paymentId = getPaymentId(payment);
      const displayName = getDisplayName(payment);
      const subtitle = `${getDisplaySubtitle(payment)} · ${formatDate(payment?.created_at)}`;
      const amount = formatCurrency(getAmount(payment));

      return `
        <div class="admin-list-item" data-admin-payment-id="${escapeHtml(paymentId)}" style="cursor:pointer;display:grid;grid-template-columns:minmax(0, 1fr) auto auto auto;gap:0.65rem;align-items:center;">
          <div>
            <button type="button" class="admin-list-title" style="background:transparent;border:0;padding:0;color:#ffffff;font:inherit;font-weight:800;text-align:left;cursor:pointer;">${escapeHtml(displayName)}</button>
            <div class="admin-list-subtitle">${escapeHtml(subtitle)}</div>
          </div>
          <div style="min-width:6.4rem;text-align:center;">
            <span class="${getTypeBadgeClass(payment)}">${escapeHtml(getTypeLabel(payment))}</span>
          </div>
          <div style="min-width:6.4rem;text-align:center;">
            <span class="${getStatusBadgeClass(payment)}">${escapeHtml(getStatusLabel(payment))}</span>
          </div>
          <div style="min-width:6.4rem;text-align:right;font-weight:900;color:#ffffff;">
            ${escapeHtml(amount)}
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = headerRow + rowsHtml;

    list.querySelectorAll("[data-admin-payment-id]").forEach((card) => {
      card.addEventListener("click", () => openPaymentDetailsModal(card.getAttribute("data-admin-payment-id")));
    });
  }

  function render() {
    const filteredPayments = getFilteredPayments();
    renderSummary(allPayments);
    renderPaymentsList(filteredPayments);
  }

  async function loadPayments() {
    hideError();

    if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") {
      throw new Error("Admin config module is not loaded.");
    }

    const supabase = await window.AdminConfig.getSupabase();
    allPayments = await fetchPayments(supabase);

    render();
  }

  function bindEvents() {
    const refreshBtn = document.getElementById("refreshPaymentsBtn");
    const searchInput = document.getElementById("paymentSearchInput");
    const typeFilter = document.getElementById("paymentTypeFilter");

    if (refreshBtn && refreshBtn.dataset.bound !== "true") {
      refreshBtn.dataset.bound = "true";
      refreshBtn.addEventListener("click", async () => {
        try {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "Refreshing...";
          await loadPayments();
        } catch (err) {
          console.error("Admin payments refresh failed:", err);
          showError(err?.message || "Failed to refresh payments.");
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
      if (event.key === "Escape") closePaymentDetailsModal();
    });
  }

  async function init() {
    bindEvents();

    try {
      await loadPayments();
    } catch (err) {
      console.error("Admin payments load failed:", err);
      showError(err?.message || "Failed to load payments.");
      allPayments = [];
      render();
    }
  }

  window.AdminPayments = {
    init,
    loadPayments,
    openPaymentDetailsModal
  };
})();
