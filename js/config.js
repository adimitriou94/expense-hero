// ===== CONFIGURATION FILE =====
// ⚠️  ΜΗΝ ανεβάσεις αυτό το αρχείο σε GitHub ή οπουδήποτε online
// ⚠️  Πρόσθεσε το "config.js" στο .gitignore αν χρησιμοποιείς Git

const CONFIG = {

  // ===== SUPABASE =====
  // Από: supabase.com → Project Settings → API
  SUPABASE_URL:      'https://gqjejalqoruclppraxus.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_PjKnfKJQKXrsoqW8sQe5Uw_ItxjbraS',

  // ===== CLOUDFLARE WORKER =====
  // Το URL του Worker σου μετά το deploy
  WORKER_URL: 'https://blue-breeze-e6c5.adimitriou94.workers.dev/',

};

// Κάνε freeze ώστε να μην αλλάζει κατά λάθος
Object.freeze(CONFIG);
