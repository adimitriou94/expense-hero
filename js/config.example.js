// ===== CONFIGURATION FILE =====
// ⚠️  ΜΗΝ ανεβάσεις αυτό το αρχείο σε GitHub ή οπουδήποτε online
// ⚠️  Πρόσθεσε το "config.js" στο .gitignore αν χρησιμοποιείς Git

const CONFIG = {

  // ===== SUPABASE =====
  // Από: supabase.com → Project Settings → API
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY',

  // ===== CLOUDFLARE WORKER =====
  // Το URL του Worker σου μετά το deploy
  WORKER_URL: 'https://YOUR_WORKER.workers.dev/',

};

// Κάνε freeze ώστε να μην αλλάζει κατά λάθος
Object.freeze(CONFIG);
