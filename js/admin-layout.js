// ================================
// StudioOS Admin Layout
// Shared layout helpers only
// ================================

(function () {
  "use strict";

  function safeText(value, fallback = "") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function formatRole(role) {
    const cleanRole = safeText(role, "admin").toLowerCase();

    if (cleanRole === "owner") return "Owner";
    if (cleanRole === "admin") return "Admin";
    if (cleanRole === "finance") return "Finance";
    if (cleanRole === "support") return "Support";

    return "Admin";
  }

  function renderAdminProfile(profile) {
    const emailLabel = document.getElementById("adminEmailLabel");
    const roleLabel = document.getElementById("adminRoleLabel");

    if (emailLabel) {
      emailLabel.textContent = safeText(profile?.email, "Admin");
    }

    if (roleLabel) {
      roleLabel.textContent = formatRole(profile?.role);
    }
  }

  function bindLogout() {
    const logoutBtn = document.getElementById("adminLogoutBtn");

    if (!logoutBtn || logoutBtn.dataset.bound === "true") {
      return;
    }

    logoutBtn.dataset.bound = "true";

    logoutBtn.addEventListener("click", async () => {
      try {
        logoutBtn.disabled = true;
        logoutBtn.textContent = "Logging out...";

        if (window.AdminAuth && typeof window.AdminAuth.signOutAdmin === "function") {
          await window.AdminAuth.signOutAdmin("admin-login.html");
          return;
        }

        if (window.AdminConfig && typeof window.AdminConfig.getSupabase === "function") {
          const supabase = await window.AdminConfig.getSupabase();
          await supabase.auth.signOut();
        }

        window.location.href = "admin-login.html";
      } catch (err) {
        console.error("Admin logout failed:", err);
        alert("Logout failed. Please try again.");
        logoutBtn.disabled = false;
        logoutBtn.textContent = "Logout";
      }
    });
  }

  function init() {
    bindLogout();
  }

  window.AdminLayout = {
    init,
    renderAdminProfile,
    bindLogout,
    formatRole
  };

  document.addEventListener("DOMContentLoaded", init);
})();
