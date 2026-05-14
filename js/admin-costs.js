// ================================
// StudioOS Admin Costs & Profit
// Estimated costs + alerts
// ================================
(function () {
  "use strict";
  let costOverview = null;
  let costAlerts = [];
  function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
  function showError(message) { const box = document.getElementById("costsError"); if (!box) return; box.textContent = message || "Failed to load costs."; box.classList.remove("hidden"); }
  function hideError() { const box = document.getElementById("costsError"); if (!box) return; box.textContent = ""; box.classList.add("hidden"); }
  function escapeHtml(v) { return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function safeText(v, f="—") { const t = String(v || "").trim(); return t || f; }
  function formatNumber(v) { const n = Number(v || 0); return Number.isFinite(n) ? new Intl.NumberFormat("en-IN").format(n) : "0"; }
  function formatCurrency(v) { const n = Number(v || 0); return Number.isFinite(n) ? new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",maximumFractionDigits:0}).format(n) : "₹0"; }
  function formatDecimal(v, d=2) { const n = Number(v || 0); return Number.isFinite(n) ? n.toFixed(d) : "0"; }
  function formatBytes(bytes) { const value = Number(bytes || 0); if (!Number.isFinite(value) || value <= 0) return "0 MB"; const units=["B","KB","MB","GB","TB"]; let size=value, i=0; while(size>=1024 && i<units.length-1){ size/=1024; i++; } return `${size.toFixed(i>=3?2:1)} ${units[i]}`; }
  function formatDate(v) { if (!v) return "—"; const d = new Date(v); if (Number.isNaN(d.getTime())) return "—"; return d.toLocaleString("en-IN", {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
  async function getSupabaseClient() { if (!window.AdminConfig || typeof window.AdminConfig.getSupabase !== "function") throw new Error("Admin config module is not loaded."); return await window.AdminConfig.getSupabase(); }
  async function fetchCosts(supabase) {
    const [{data: overviewRows, error: overviewError}, {data: alertRows, error: alertsError}] = await Promise.all([supabase.rpc("admin_get_cost_overview"), supabase.rpc("admin_get_cost_alerts")]);
    if (overviewError) { console.error("Admin cost overview fetch failed:", overviewError); throw new Error("Unable to load cost overview."); }
    if (alertsError) { console.error("Admin cost alerts fetch failed:", alertsError); throw new Error("Unable to load cost alerts."); }
    costOverview = Array.isArray(overviewRows) ? overviewRows[0] || null : overviewRows || null;
    costAlerts = Array.isArray(alertRows) ? alertRows : [];
  }
  function badge(severity, resolved) { if (resolved) return "admin-badge admin-badge-muted"; const s=String(severity||"").toLowerCase(); return (s==="critical"||s==="warning") ? "admin-badge admin-badge-warning" : "admin-badge admin-badge-muted"; }
  function metricRow(label, value, subtitle, badgeText, badgeClass="admin-badge admin-badge-muted") { return `<div class="admin-list-item" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.85rem;align-items:center;"><div style="min-width:0;"><div class="admin-list-title">${escapeHtml(label)}</div><div class="admin-list-subtitle">${escapeHtml(subtitle)}</div></div><div style="text-align:right;"><div style="font-weight:900;color:#fff;white-space:nowrap;">${escapeHtml(value)}</div>${badgeText?`<div style="margin-top:.35rem;"><span class="${badgeClass}">${escapeHtml(badgeText)}</span></div>`:""}</div></div>`; }
  function renderSummary() { setText("costRevenueCard", formatCurrency(costOverview?.total_studioos_revenue)); setText("estimatedCostCard", formatCurrency(costOverview?.estimated_total_cost)); setText("estimatedProfitCard", formatCurrency(costOverview?.estimated_profit)); setText("openAlertsCard", formatNumber(costOverview?.open_alerts_count)); }
  function renderCostBreakdown() {
    const list=document.getElementById("costBreakdownList"); if(!list) return; if(!costOverview){ list.innerHTML='<div class="admin-muted">No cost overview found.</div>'; return; }
    list.innerHTML = [
      metricRow("Storage Cost", formatCurrency(costOverview.estimated_storage_cost), `${formatBytes(costOverview.total_storage_bytes)} stored · Rate ${formatCurrency(costOverview.storage_rate)} / GB-month`, "Estimated"),
      metricRow("AI / Face Recognition Cost", formatCurrency(costOverview.estimated_ai_cost), `${formatNumber(costOverview.total_ai_processed)} AI processed · Rate ${formatCurrency(costOverview.ai_rate)} / 1000 images`, "Estimated"),
      metricRow(
        "CDN / Download Cost",
        formatCurrency(costOverview.estimated_cdn_cost),
        `${formatBytes(costOverview.total_download_bytes)} delivery tracked · Rate ${formatCurrency(costOverview.cdn_rate)} / GB`,
        Number(costOverview.total_download_bytes || 0) > 0 ? "Tracked" : "Ready",
        Number(costOverview.total_download_bytes || 0) > 0 ? "admin-badge admin-badge-success" : "admin-badge admin-badge-muted"
      ),
      metricRow(
        "Gateway Fees",
        formatCurrency(costOverview.estimated_gateway_fees),
        `Photo actual: ${formatCurrency(costOverview.actual_photo_gateway_fees)} · Subscription actual: ${formatCurrency(costOverview.actual_subscription_gateway_fees)} · Template actual: ${formatCurrency(costOverview.actual_template_gateway_fees)} · Missing estimated: ${formatCurrency(costOverview.estimated_missing_gateway_fees)}`,
        Number(costOverview.estimated_missing_gateway_fees || 0) > 0 ? "Mixed" : "Actual",
        Number(costOverview.estimated_missing_gateway_fees || 0) > 0 ? "admin-badge admin-badge-warning" : "admin-badge admin-badge-success"
      )
    ].join("");
  }
  function renderUsageSnapshot() {
    const list=document.getElementById("usageSnapshotList"); if(!list) return; if(!costOverview){ list.innerHTML='<div class="admin-muted">No usage overview found.</div>'; return; }
    const profit=Number(costOverview.estimated_profit||0);
    list.innerHTML = [
      metricRow("Estimated Profit", formatCurrency(costOverview.estimated_profit), `Revenue ${formatCurrency(costOverview.total_studioos_revenue)} - Cost ${formatCurrency(costOverview.estimated_total_cost)}`, profit>=0?"Profit":"Loss", profit>=0?"admin-badge admin-badge-success":"admin-badge admin-badge-warning"),
      metricRow("Profit Margin", `${formatDecimal(costOverview.profit_margin_percent)}%`, "Estimated business margin from current tracked data", "Estimated"),
      metricRow("Open Alerts", formatNumber(costOverview.open_alerts_count), `Critical ${formatNumber(costOverview.critical_alerts_count)} · Warning ${formatNumber(costOverview.warning_alerts_count)}`, "Monitor", Number(costOverview.open_alerts_count||0)>0?"admin-badge admin-badge-warning":"admin-badge admin-badge-success"),
      metricRow("Gateway Fee Rate", `${formatDecimal(costOverview.gateway_fee_percent)}%`, `Fixed fee ${formatCurrency(costOverview.gateway_fee_fixed)} per transaction`, "Setting"),
      metricRow("Download Usage", formatBytes(costOverview.total_download_bytes), `CDN cost ${formatCurrency(costOverview.estimated_cdn_cost)} · ${formatDecimal(costOverview.total_download_gb, 4)} GB tracked`, "Tracked"),
      metricRow("Gateway Fee Source", Number(costOverview.estimated_missing_gateway_fees || 0) > 0 ? "Mixed" : "Actual", `Missing estimated ${formatCurrency(costOverview.estimated_missing_gateway_fees)} · Actual subscription ${formatCurrency(costOverview.actual_subscription_gateway_fees)} · Actual template ${formatCurrency(costOverview.actual_template_gateway_fees)}`, Number(costOverview.estimated_missing_gateway_fees || 0) > 0 ? "Review" : "Clean", Number(costOverview.estimated_missing_gateway_fees || 0) > 0 ? "admin-badge admin-badge-warning" : "admin-badge admin-badge-success")
    ].join("");
  }
  function filteredAlerts() {
    const search=String(document.getElementById("costAlertSearchInput")?.value||"").toLowerCase().trim();
    const filter=String(document.getElementById("costAlertFilter")?.value||"open").toLowerCase().trim();
    return costAlerts.filter(a=>{ const resolved=a?.resolved===true; const sev=String(a?.severity||"").toLowerCase(); const text=[a?.alert_type,a?.severity,a?.studio_name,a?.owner_name,a?.email,a?.message,a?.metric_unit,a?.current_value,a?.threshold_value].map(v=>String(v||"").toLowerCase()).join(" "); return (!search||text.includes(search)) && (filter==="all"||(filter==="open"&&!resolved)||(filter==="resolved"&&resolved)||(filter==="critical"&&sev==="critical")||(filter==="warning"&&sev==="warning")); });
  }
  function renderAlerts() {
    const list=document.getElementById("costAlertsList"); if(!list) return; const alerts=filteredAlerts(); if(!alerts.length){ list.innerHTML='<div class="admin-muted">No cost alerts found.</div>'; return; }
    const header='<div style="display:grid;grid-template-columns:110px minmax(0,1fr) 112px 104px;gap:.8rem;align-items:center;padding:0 .95rem .5rem;color:#cbd5e1;font-size:.72rem;line-height:1rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase;"><div>Severity</div><div>Alert</div><div style="text-align:right;">Value</div><div style="text-align:right;">Action</div></div>';
    const rows=alerts.map(a=>{ const id=String(a?.alert_id||""); const resolved=a?.resolved===true; const val=`${safeText(a?.current_value,"0")} / ${safeText(a?.threshold_value,"0")} ${safeText(a?.metric_unit,"")}`.trim(); const title=safeText(a?.message, safeText(a?.alert_type,"Cost alert")); const sub=[safeText(a?.studio_name||a?.owner_name||a?.email,"System alert"), safeText(a?.alert_type), formatDate(a?.created_at)].filter(Boolean).join(" · "); const action=resolved?'<span class="admin-badge admin-badge-muted">Resolved</span>':`<button type="button" data-resolve-cost-alert="${escapeHtml(id)}" style="border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);padding:.45rem .65rem;color:#fff;font-size:.75rem;font-weight:900;cursor:pointer;">Resolve</button>`; return `<div class="admin-list-item" style="display:grid;grid-template-columns:110px minmax(0,1fr) 112px 104px;gap:.8rem;align-items:center;"><div><span class="${badge(a?.severity,resolved)}">${escapeHtml(safeText(a?.severity,"info").toUpperCase())}</span></div><div style="min-width:0;"><div class="admin-list-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</div><div class="admin-list-subtitle" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(sub)}</div></div><div style="text-align:right;font-weight:900;color:#fff;white-space:nowrap;">${escapeHtml(val)}</div><div style="text-align:right;">${action}</div></div>`; }).join("");
    list.innerHTML = header + rows;
    list.querySelectorAll("[data-resolve-cost-alert]").forEach(b=>b.addEventListener("click",()=>resolveCostAlert(b.getAttribute("data-resolve-cost-alert"))));
  }
  async function resolveCostAlert(alertId) { const safe=String(alertId||"").trim(); if(!safe) return; try{ const supabase=await getSupabaseClient(); const {error}=await supabase.rpc("admin_resolve_cost_alert", {target_alert_id:safe}); if(error) throw error; await loadCosts(); }catch(err){ console.error("Resolve cost alert failed:",err); showError(err?.message||"Failed to resolve alert."); } }
  function showCostsActionMessage(message, type = "info") {
    const box = document.getElementById("costsError");
    if (!box) return;

    box.textContent = message || "";
    box.classList.remove("hidden");

    if (type === "success") {
      box.style.borderColor = "rgba(34,197,94,0.28)";
      box.style.background = "rgba(34,197,94,0.10)";
      box.style.color = "#bbf7d0";
    } else {
      box.style.borderColor = "";
      box.style.background = "";
      box.style.color = "";
    }

    if (message) {
      window.clearTimeout(window.__studioosCostMessageTimer);
      window.__studioosCostMessageTimer = window.setTimeout(() => {
        if (box.textContent === message) {
          hideError();
          box.style.borderColor = "";
          box.style.background = "";
          box.style.color = "";
        }
      }, 3500);
    }
  }

  async function generateCostAlerts() {
    const beforeOpenCount = Number(costOverview?.open_alerts_count || 0);
    const supabase=await getSupabaseClient();
    const {error}=await supabase.rpc("admin_generate_cost_alerts");
    if(error) throw error;
    await loadCosts();

    const afterOpenCount = Number(costOverview?.open_alerts_count || 0);
    const createdCount = Math.max(0, afterOpenCount - beforeOpenCount);

    if (afterOpenCount > 0) {
      showCostsActionMessage(
        createdCount > 0
          ? `${createdCount} new cost alert${createdCount === 1 ? "" : "s"} generated.`
          : `${afterOpenCount} open cost alert${afterOpenCount === 1 ? "" : "s"} found.`,
        "success"
      );
    } else {
      showCostsActionMessage("Cost check completed. No risk alerts found.", "success");
    }
  }
  function render(){ renderSummary(); renderCostBreakdown(); renderUsageSnapshot(); renderAlerts(); }
  async function loadCosts(){ hideError(); const supabase=await getSupabaseClient(); await fetchCosts(supabase); render(); }
  function bindEvents(){
    const refreshBtn=document.getElementById("refreshCostsBtn"), generateBtn=document.getElementById("generateCostAlertsBtn"), search=document.getElementById("costAlertSearchInput"), filter=document.getElementById("costAlertFilter");
    if(refreshBtn&&refreshBtn.dataset.bound!=="true"){ refreshBtn.dataset.bound="true"; refreshBtn.addEventListener("click",async()=>{ try{ refreshBtn.disabled=true; refreshBtn.textContent="Refreshing..."; await loadCosts(); }catch(e){ showError(e?.message||"Failed to refresh costs."); }finally{ refreshBtn.disabled=false; refreshBtn.textContent="Refresh"; } }); }
    if(generateBtn&&generateBtn.dataset.bound!=="true"){ generateBtn.dataset.bound="true"; generateBtn.addEventListener("click",async()=>{ try{ generateBtn.disabled=true; generateBtn.textContent="Checking..."; await generateCostAlerts(); generateBtn.textContent="Checked"; window.setTimeout(()=>{ generateBtn.textContent="Generate Alerts"; }, 1200); }catch(e){ showError(e?.message||"Failed to generate alerts."); generateBtn.textContent="Generate Alerts"; }finally{ generateBtn.disabled=false; } }); }
    if(search&&search.dataset.bound!=="true"){ search.dataset.bound="true"; search.addEventListener("input", renderAlerts); }
    if(filter&&filter.dataset.bound!=="true"){ filter.dataset.bound="true"; filter.addEventListener("change", renderAlerts); }
  }
  async function init(){ bindEvents(); try{ await loadCosts(); }catch(err){ console.error("Admin costs load failed:", err); showError(err?.message||"Failed to load costs."); costOverview=null; costAlerts=[]; render(); } }
  window.AdminCosts={init, loadCosts, generateCostAlerts};
})();
