// ================================
// StudioOS Admin Auth
// File: js/admin-auth.js
// Purpose: Admin-only authentication guard for separate StudioOS Admin Panel
// ================================

async function adminGetSupabaseSafe(){
  if(typeof window.getAdminSupabase === "function"){
    return await window.getAdminSupabase()
  }

  if(typeof window.getSupabase === "function"){
    return await window.getSupabase()
  }

  if(window.adminSupabaseClient){
    return window.adminSupabaseClient
  }

  console.error("Admin Supabase client not found")
  return null
}

async function adminGetSessionSafe(){
  try{
    if(typeof window.getAdminSession === "function"){
      return await window.getAdminSession()
    }

    const supabase = await adminGetSupabaseSafe()
    if(!supabase) return null

    const { data, error } = await supabase.auth.getSession()

    if(error){
      console.error("Admin session fetch failed:", error)
      return null
    }

    return data?.session || null
  }catch(err){
    console.error("Admin session error:", err)
    return null
  }
}

async function adminGetUserSafe(){
  try{
    if(typeof window.getAdminUser === "function"){
      return await window.getAdminUser()
    }

    const supabase = await adminGetSupabaseSafe()
    if(!supabase) return null

    const { data, error } = await supabase.auth.getUser()

    if(error){
      console.error("Admin user fetch failed:", error)
      return null
    }

    return data?.user || null
  }catch(err){
    console.error("Admin user error:", err)
    return null
  }
}

async function adminGetProfileSafe(){
  try{
    if(typeof window.getAdminProfile === "function"){
      return await window.getAdminProfile()
    }

    const supabase = await adminGetSupabaseSafe()
    const user = await adminGetUserSafe()

    if(!supabase || !user) return null

    const { data, error } = await supabase
      .from("admin_users")
      .select("id,user_id,email,role,is_active,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if(error){
      console.error("Admin profile fetch failed:", error)
      return null
    }

    return data || null
  }catch(err){
    console.error("Admin profile error:", err)
    return null
  }
}

function adminRedirectToLogin(){
  const currentPath = window.location.pathname || ""
  const isLoginPage = currentPath.endsWith("admin-login.html") || currentPath.endsWith("/")

  if(isLoginPage) return

  window.location.href = "admin-login.html"
}

function adminRedirectToDashboard(){
  window.location.href = "admin-dashboard.html"
}

function adminSetAuthMessage(message, type = "error"){
  const box = document.getElementById("adminAuthMessage")
  if(!box) return

  box.innerText = message || ""
  box.classList.remove("hidden")

  if(type === "success"){
    box.className = "mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
    return
  }

  box.className = "mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
}

function adminSetButtonBusy(button, isBusy, text){
  if(!button) return

  if(isBusy){
    button.dataset.originalText = button.dataset.originalText || button.innerText
    button.innerText = text || "Please wait..."
    button.disabled = true
    button.style.opacity = "0.7"
    button.style.pointerEvents = "none"
  }else{
    button.innerText = button.dataset.originalText || button.innerText
    button.disabled = false
    button.style.opacity = "1"
    button.style.pointerEvents = "auto"
  }
}

async function requireAdminPageAccess(){
  const session = await adminGetSessionSafe()

  if(!session?.access_token){
    adminRedirectToLogin()
    return null
  }

  const profile = await adminGetProfileSafe()

  if(!profile?.id || profile.is_active !== true){
    try{
      const supabase = await adminGetSupabaseSafe()
      await supabase?.auth?.signOut()
    }catch(_err){}

    adminRedirectToLogin()
    return null
  }

  window.STUDIOOS_ADMIN_PROFILE = profile
  return profile
}

async function blockLoggedInAdminFromLogin(){
  const session = await adminGetSessionSafe()

  if(!session?.access_token){
    return false
  }

  const profile = await adminGetProfileSafe()

  if(profile?.id && profile.is_active === true){
    adminRedirectToDashboard()
    return true
  }

  return false
}

async function handleAdminLogin(email, password){
  const safeEmail = String(email || "").trim().toLowerCase()
  const safePassword = String(password || "")

  if(!safeEmail || !safePassword){
    return {
      success:false,
      error:"Please enter admin email and password."
    }
  }

  const supabase = await adminGetSupabaseSafe()

  if(!supabase){
    return {
      success:false,
      error:"Admin system is not initialized."
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email:safeEmail,
    password:safePassword
  })

  if(error || !data?.session){
    console.error("Admin login failed:", error)
    return {
      success:false,
      error:"Invalid email or password."
    }
  }

  const profile = await adminGetProfileSafe()

  if(!profile?.id || profile.is_active !== true){
    await supabase.auth.signOut()

    return {
      success:false,
      error:"This account does not have admin access."
    }
  }

  window.STUDIOOS_ADMIN_PROFILE = profile

  return {
    success:true,
    profile
  }
}

async function handleAdminLogout(){
  try{
    const supabase = await adminGetSupabaseSafe()
    await supabase?.auth?.signOut()
  }catch(err){
    console.error("Admin logout failed:", err)
  }

  window.location.href = "admin-login.html"
}

window.adminGetSupabaseSafe = adminGetSupabaseSafe
window.adminGetSessionSafe = adminGetSessionSafe
window.adminGetUserSafe = adminGetUserSafe
window.adminGetProfileSafe = adminGetProfileSafe
window.requireAdminPageAccess = requireAdminPageAccess
window.blockLoggedInAdminFromLogin = blockLoggedInAdminFromLogin
window.handleAdminLogin = handleAdminLogin
window.handleAdminLogout = handleAdminLogout
window.adminSetAuthMessage = adminSetAuthMessage
window.adminSetButtonBusy = adminSetButtonBusy
