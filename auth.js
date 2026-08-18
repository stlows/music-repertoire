// ============================================
// SUPABASE CONFIGURATION
// ============================================
// Replace these with your actual Supabase credentials
// Get them from: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://evpbzdnuoehvqfbnfxay.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_UTyAgESCJtg9IupDjNI_sw_5irRvA52'

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================
// DOM ELEMENTS
// ============================================
const authStatus = document.getElementById('authStatus')

// ============================================
// AUTH STATE
// ============================================
let currentSession = null

function getRedirectUrl() {
  return window.location.href.split('#')[0].split('?')[0]
}

// ============================================
// GOOGLE LOGIN
// ============================================
function handleGoogleLogin() {
  return async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl()
      }
    })

    if (error) {
      console.error('Google login error:', error.message)
    }
  }
}
// ============================================
// AUTH SUCCESS HANDLER
// ============================================
async function onAuthSuccess() {
  updateAuthStatus()

  // Trigger repertoire sync
  if (window.getPiecesFromSupabase) {
    await window.getPiecesFromSupabase()
    await window.renderPieces()
  }
}

// ============================================
// UPDATE AUTH STATUS
// ============================================
function updateAuthStatus() {
  if (currentSession) {
    const name = currentSession.user.user_metadata?.full_name || 'User'
    authStatus.innerHTML = `
      <div class="user-info">
        <span>${name}</span>
        <button id="logoutBtn" class="ghost-button" type="button">Logout</button>
      </div>
    `
    document.getElementById('logoutBtn').addEventListener('click', logout)
  } else {
    authStatus.innerHTML = `
      <button id="googleLoginBtn" class="google-login-button" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </button>
    `
    document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleLogin())
  }
}

// ============================================
// LOGOUT
// ============================================
async function logout() {
  await supabaseClient.auth.signOut()
  currentSession = null
  updateAuthStatus()

  if (typeof window.renderPieces === 'function') {
    await window.renderPieces()
  }
}

// ============================================
// CHECK SESSION ON LOAD
// ============================================
async function initializeAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession()

  if (session) {
    currentSession = session
    updateAuthStatus()

    // Sync repertoire
    if (window.getPiecesFromSupabase) {
      await window.getPiecesFromSupabase()
    }
  } else {
    updateAuthStatus()
  }
}

// Listen for auth changes
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  currentSession = session

  if (event === 'SIGNED_IN') {
    updateAuthStatus()

    // Sync repertoire after sign in
    if (window.getPiecesFromSupabase) {
      await window.getPiecesFromSupabase()
    }

    if (typeof window.renderPieces === 'function') {
      await window.renderPieces()
    }
  } else if (event === 'SIGNED_OUT') {
    updateAuthStatus()

    if (typeof window.renderPieces === 'function') {
      await window.renderPieces()
    }
  }
})

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeAuth)

// Export for use in other scripts
window.supabaseAuth = {
  isLoggedIn: () => !!currentSession,
  getSession: () => currentSession,
  getUser: () => currentSession?.user,
  supabase: supabaseClient
}
