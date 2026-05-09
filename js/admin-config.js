// ================================
// StudioOS Admin Panel - Supabase Config
// ================================

const ADMIN_SUPABASE_URL =
"https://gnnaaagvlrmdveqxicob.supabase.co"

const ADMIN_SUPABASE_ANON_KEY =
"sb_publishable_TnjoiedXWPbSjjqh2tmfsQ_kpiIMaND"

window.ADMIN_SUPABASE_URL = ADMIN_SUPABASE_URL
window.ADMIN_SUPABASE_ANON_KEY = ADMIN_SUPABASE_ANON_KEY
window.SUPABASE_ANON_KEY = ADMIN_SUPABASE_ANON_KEY

// ================================
// INTERNAL STATE
// ================================

let adminSupabaseClient = null
let adminSupabaseInitPromise = null

// ================================
// WAIT FOR SUPABASE CDN
// ================================

function waitForAdminSupabaseCDN(timeoutMs = 10000){

return new Promise((resolve, reject)=>{

const start = Date.now()

const check = () => {

if(window.supabase && typeof window.supabase.createClient === "function"){
resolve()
return
}

if(Date.now() - start >= timeoutMs){
reject(new Error("Supabase CDN not loaded"))
return
}

setTimeout(check, 50)

}

check()

})

}

// ================================
// CREATE ADMIN SUPABASE CLIENT
// ================================

async function initializeAdminSupabase(){

if(window.adminSupabaseClient){
return window.adminSupabaseClient
}

if(adminSupabaseInitPromise){
return adminSupabaseInitPromise
}

adminSupabaseInitPromise = (async ()=>{

try{

await waitForAdminSupabaseCDN()

if(window.adminSupabaseClient){
return window.adminSupabaseClient
}

adminSupabaseClient = window.supabase.createClient(
ADMIN_SUPABASE_URL,
ADMIN_SUPABASE_ANON_KEY,
{
auth:{
persistSession:true,
autoRefreshToken:true,
detectSessionInUrl:true
}
}
)

window.adminSupabaseClient = adminSupabaseClient
return adminSupabaseClient

}catch(err){

adminSupabaseInitPromise = null
console.error("Admin Supabase initialization failed:", err)
throw err

}

})()

return adminSupabaseInitPromise

}

// ================================
// SAFE ADMIN SUPABASE ACCESS
// ================================

window.getAdminSupabase = async function(){

if(window.adminSupabaseClient){
return window.adminSupabaseClient
}

return await initializeAdminSupabase()

}

// ================================
// SAFE ADMIN SESSION
// ================================

window.getAdminSession = async function(){

try{

const supabase = await window.getAdminSupabase()
if(!supabase) return null

const { data, error } = await supabase.auth.getSession()

if(error){
console.error("Admin session fetch error:", error)
return null
}

return data?.session || null

}catch(err){
console.error("Admin session fetch failed:", err)
return null
}

}

// ================================
// SAFE ADMIN USER
// ================================

window.getAdminUser = async function(){

try{

const supabase = await window.getAdminSupabase()
if(!supabase) return null

const { data, error } = await supabase.auth.getUser()

if(error){
console.error("Admin user fetch error:", error)
return null
}

return data?.user || null

}catch(err){
console.error("Admin user fetch failed:", err)
return null
}

}

// ================================
// ADMIN PROFILE / ROLE CHECK
// ================================

window.getAdminProfile = async function(){

try{

const supabase = await window.getAdminSupabase()
const user = await window.getAdminUser()

if(!supabase || !user){
return null
}

const { data, error } = await supabase
.from("admin_users")
.select("id,user_id,email,role,is_active,created_at,updated_at")
.eq("user_id", user.id)
.eq("is_active", true)
.maybeSingle()

if(error){
console.error("Admin profile fetch error:", error)
return null
}

return data || null

}catch(err){
console.error("Admin profile fetch failed:", err)
return null
}

}

window.requireAdminAccess = async function(){

const session = await window.getAdminSession()

if(!session?.access_token){
return {
allowed:false,
reason:"not_authenticated",
session:null,
user:null,
profile:null
}
}

const user = await window.getAdminUser()
const profile = await window.getAdminProfile()

if(!user || !profile || profile.is_active !== true){
return {
allowed:false,
reason:"not_admin",
session,
user,
profile:null
}
}

return {
allowed:true,
reason:"admin_allowed",
session,
user,
profile
}

}

// ================================
// PRELOAD
// ================================

initializeAdminSupabase().catch(err=>{
console.error("Admin Supabase preload failed:", err)
})
