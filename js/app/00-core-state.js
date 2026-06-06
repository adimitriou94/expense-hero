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


// ===== MOBILE ORIENTATION LOCK (best effort) =====
// The PWA manifest already requests portrait-primary. This helper covers
// browsers/platforms that also support the Screen Orientation API.
function lockCapvoPortraitOrientation(){
  try{
    if(screen && screen.orientation && typeof screen.orientation.lock==='function'){
      screen.orientation.lock('portrait').catch(()=>{});
    }
  }catch(_){/* Some browsers/iOS ignore programmatic orientation locking. */}
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',lockCapvoPortraitOrientation,{once:true});
}else{
  lockCapvoPortraitOrientation();
}
window.addEventListener('orientationchange',()=>setTimeout(lockCapvoPortraitOrientation,250));
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) lockCapvoPortraitOrientation(); });

// ===== CONSTANTS & STATE =====
const SK = 'current_chat_id';

const MG = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
const DG = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];

const CCLR = {
  'Τρόφιμα':'#e6960a','Καφέδες':'#8b6914','Μεταφορά':'#2471a3','Ψυχαγωγία':'#7d3c98',
  'Φαγητό έξω':'#c0392b','Στέγαση':'#1d9e75','Λογαριασμοί':'#d4a012','Υγεία':'#148f77',
  'Ρούχα':'#993556','Συνδρομές':'#3f51b5','Δάνεια':'#34495e','Πιστωτικές':'#2471a3','Άλλο':'#888780'
};

const CCLS = {
  'Τρόφιμα':'cat-food','Καφέδες':'cat-coffee','Μεταφορά':'cat-transport','Ψυχαγωγία':'cat-entertainment',
  'Φαγητό έξω':'cat-eating','Στέγαση':'cat-housing','Λογαριασμοί':'cat-bills','Υγεία':'cat-health',
  'Ρούχα':'cat-clothes','Συνδρομές':'cat-sub','Δάνεια':'cat-loans','Πιστωτικές':'cat-cc','Άλλο':'cat-other'
};

const CEMO = {
  'Τρόφιμα':'🛒','Καφέδες':'☕','Μεταφορά':'🚗','Ψυχαγωγία':'🎭','Φαγητό έξω':'🍕','Στέγαση':'🏠',
  'Λογαριασμοί':'💡','Υγεία':'🏥','Ρούχα':'👕','Συνδρομές':'📱','Δάνεια':'🏦','Πιστωτικές':'💳','Άλλο':'📌'
};

let D = {
  income:0,
  incomeSources:[],
  fixedExpenses:[],
  creditCards:[],
  months:{}
};
let curM;

let currentSession=null;
let currentUser=null;
let currentProfile=null;
let authBooting=false;
let appInitStarted=false;
let changingTelegramId=false;
let pendingAuthEvent=null;
let selectionMode = { fixed:false, daily:false };
let selectedFixed = new Set();
let selectedDaily = new Set();

function isRealTelegramChatId(value){
  return /^\d+$/.test(String(value||'').trim());
}

function getSyntheticOwnerId(user=currentUser||currentSession?.user){
  const id=user?.id||'';
  return id?`capvo_${id}`:'';
}

function getAppUserId(){
  return String(currentUser?.id || currentSession?.user?.id || '').trim();
}

function getProfileOwnerId(){
  return String(currentProfile?.telegram_chat_id||'').trim();
}

function getTelegramChatId(){
  const profileChatId=getProfileOwnerId();
  if(isRealTelegramChatId(profileChatId))return profileChatId;

  const storedChatId=String(localStorage.getItem(SK)||'').trim();
  return isRealTelegramChatId(storedChatId)?storedChatId:'';
}

function hasTelegramConnection(){
  return !!getTelegramChatId();
}

function getLegacyOwnerId(){
  // Legacy compatibility only. Finance ownership is now user_id.
  const telegramChatId=getTelegramChatId();
  if(telegramChatId)return telegramChatId;

  const syntheticOwnerId=getSyntheticOwnerId();
  if(syntheticOwnerId)return syntheticOwnerId;

  return getAppUserId();
}

function getDataOwnerId(){
  // Production ownership: the Supabase authenticated user owns finance data.
  return getAppUserId();
}

function getTelegramOptionalMessage(){
  return 'Για να χρησιμοποιήσεις Telegram Sync, σύνδεσε πρώτα το Telegram bot.';
}

// ===== HELPERS =====
function curMK(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function ensM(k){if(!D.months[k])D.months[k]={daily:[]}}
function gid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5)}
function fmt(n){n=Number(n)||0;return '€'+n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function esc(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML}
function $(id){return document.getElementById(id)}
function todayISO(){return new Date().toISOString().split('T')[0]}
function normalizeDateValue(value){
  if(!value)return '';
  const raw=String(value);
  if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
  const d=new Date(raw);
  if(Number.isNaN(d.getTime()))return '';
  return d.toISOString().slice(0,10);
}
function fixedExpenseCreatedAt(e){
  return e?.createdAt || e?.created_at || '';
}
function fixedExpenseSortTime(e){
  const created=fixedExpenseCreatedAt(e);
  const t=created?new Date(created).getTime():0;
  if(Number.isFinite(t) && t>0)return t;
  // Fallback for old local rows: gid() starts with a base36 timestamp.
  const idPart=String(e?.id||'').slice(0,8);
  const fromId=parseInt(idPart,36);
  return Number.isFinite(fromId)?fromId:0;
}
function formatShortDate(value){
  const normalized=normalizeDateValue(value);
  if(!normalized)return '';
  const [y,m,d]=normalized.split('-');
  return `${d}/${m}/${y}`;
}
function effectiveCardMinPay(c){
  const balance=Number(c?.balance)||0;
  const enteredMin=Number(c?.minPay)||0;

  if(enteredMin>0)return enteredMin;
  if(balance<=0)return 0;

  // Greek-market fallback: around 2% of balance, with a practical €15 floor.
  return Math.max(balance*0.02,15);
}
function effectiveCardPayment(c){
  const chosen=Number(c?.chosenPay)||0;
  return chosen>0?chosen:effectiveCardMinPay(c);
}
function ccPayTotal(){return(D.creditCards||[]).filter(c=>c.balance>0).reduce((s,c)=>s+effectiveCardPayment(c),0)}
function fixedTotal(){return(D.fixedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0)}
function dailyTotal(){return((D.months[curM]||{daily:[]}).daily).reduce((s,e)=>s+(Number(e.amount)||0),0)}
function allFixedTotal(){return fixedTotal()+ccPayTotal()}
function incomeSourcesTotal(){
  return (D.incomeSources||[])
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function budgetIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.includeInBudget)
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function savingsIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.isSavings || !i.includeInBudget)
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedCategoriesFor(source){
  if(!source?.restriction || source.restriction==='none'){
    return [];
  }

  if(source.restriction==='food_only'){
    return ['Τρόφιμα','Καφέδες','Φαγητό έξω'];
  }

  if(source.restriction==='specific_category'){
    return [source.restrictedCategory].filter(Boolean);
  }

  return [];
}

function categoryExpensesTotal(categories){
  if(!Array.isArray(categories) || categories.length===0){
    return 0;
  }

  const allowed=new Set(categories);

  let total=0;

  Object.values(D.months||{}).forEach(month=>{
    (month.daily||[]).forEach(exp=>{
      if(allowed.has(exp.category)){
        total+=Number(exp.amount)||0;
      }
    });
  });

  return total;
}

function restrictedCoverageFor(source){
  if(!source?.id)return 0;

  let total=0;

  Object.values(D.months||{}).forEach(month=>{
    (month.daily||[]).forEach(exp=>{
      if(exp.paymentSourceId===source.id){
        total+=Number(exp.amount)||0;
      }
    });
  });

  return Math.min(
    Number(source.amount)||0,
    total
  );
}

function paymentSourceRemaining(source){
  return Math.max(
    0,
    (Number(source.amount)||0)-restrictedCoverageFor(source)
  );
}

function dailyCashTotal(){
  const m=D.months[curM]||{daily:[]};

  return (m.daily||[])
    .filter(e=>!e.paymentSourceId)
    .reduce((s,e)=>s+(Number(e.amount)||0),0);
}

function totalRestrictedCoverage(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .reduce((sum,i)=>sum+restrictedCoverageFor(i),0);
}

function remainingRestrictedAmount(source){
  return Math.max(
    0,
    (Number(source.amount)||0)-restrictedCoverageFor(source)
  );
}

function refreshComputedIncome(){
  D.income = budgetIncomeTotal();
}

function save(){return saveToSupabase()}

function copyTelegramCommand(command='/id'){
  navigator.clipboard.writeText(command)
    .then(()=>{
      showMiniToast(`✅ Το ${command} αντιγράφηκε`);
    })
    .catch(()=>{
      showMiniToast('❌ Δεν έγινε αντιγραφή','error');
    });
}
