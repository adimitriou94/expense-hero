// CAPVO app split: 00a-supabase.js
// Supabase client + mobile orientation lock + UX guards
// Source: 00-core-state.js lines 1-37

// CAPVO app split: 00-core-state.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== SUPABASE & CONFIG =====
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;


const authStorage={
  getItem:(key)=>{
    return window.localStorage.getItem(key);
  },
  setItem:(key,value)=>{
    window.localStorage.setItem(key,value);
  },
  removeItem:(key)=>{
    window.localStorage.removeItem(key);
  }
};

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
      storage:authStorage,
      storageKey:'expense-hero-auth',
      flowType:'pkce'
    }
  }
);


// ===== END 00a-supabase.js =====
