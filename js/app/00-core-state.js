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



// ===== CAPVO MOBILE UX GUARDS =====
// iOS/PWA does not allow a true hard orientation lock from web code.
// We request portrait where supported and block the UI in landscape so the
// app behaves as portrait-only from the user's point of view.
function capvoSuppressAutoFocus(ms=700){
  try{
    window.CAPVO_SUPPRESS_PROGRAMMATIC_FOCUS = true;
    document.body?.classList.add('capvo-suppress-autofocus');
    clearTimeout(window.__capvoAutoFocusTimer);
    window.__capvoAutoFocusTimer=setTimeout(()=>{
      window.CAPVO_SUPPRESS_PROGRAMMATIC_FOCUS = false;
      document.body?.classList.remove('capvo-suppress-autofocus');
    },ms);
  }catch(_){/* noop */}
}

(function installCapvoFocusGuard(){
  if(window.__capvoFocusGuardInstalled)return;
  window.__capvoFocusGuardInstalled=true;
  const nativeFocus=HTMLElement.prototype.focus;
  HTMLElement.prototype.focus=function(options){
    try{
      const isField=this && this.matches && this.matches('input, textarea, select');
      if(window.CAPVO_SUPPRESS_PROGRAMMATIC_FOCUS && isField){
        return;
      }
    }catch(_){/* fall through */}
    return nativeFocus.call(this,options);
  };
})();

function capvoBlurActiveField(){
  try{
    const el=document.activeElement;
    if(el && el.blur && el.matches && el.matches('input, textarea, select'))el.blur();
  }catch(_){/* noop */}
}

function capvoScrollToTop(){
  const run=()=>{
    try{capvoBlurActiveField();}catch(_){/* noop */}
    try{window.scrollTo({top:0,left:0,behavior:'auto'});}catch(_){window.scrollTo(0,0);}
    try{document.documentElement.scrollTop=0;document.body.scrollTop=0;}catch(_){/* noop */}
    try{
      document.querySelectorAll('.view,.view.active,.app,.app-shell,main,.page,.content,.screen,.modal-body,.mobile-page').forEach(el=>{
        if(el && typeof el.scrollTop==='number')el.scrollTop=0;
      });
    }catch(_){/* noop */}
  };
  run();
  requestAnimationFrame(run);
  setTimeout(run,60);
}

function capvoUpdateOrientationState(){
  try{
    const landscape=window.matchMedia('(orientation: landscape)').matches;
    document.body?.classList.toggle('capvo-landscape-blocked',landscape && window.innerWidth>window.innerHeight);
  }catch(_){/* noop */}
}

window.addEventListener('resize',()=>setTimeout(capvoUpdateOrientationState,80));
window.addEventListener('orientationchange',()=>setTimeout(capvoUpdateOrientationState,160));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',capvoUpdateOrientationState,{once:true});
else capvoUpdateOrientationState();

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
  months:{},
  preferences:{
    budgetCycleType:'fixed_day',
    budgetCycleStartDay:1,
    currency:'EUR',
    language:'el'
  },
  budgetCycles:[],
  budgetCycleIncomes:[]
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

// ===== BUDGET CYCLE HELPERS =====
function capvoPad2(n){return String(n).padStart(2,'0')}
function capvoDateKey(date){
  const d=date instanceof Date?date:new Date(date);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.getFullYear()}-${capvoPad2(d.getMonth()+1)}-${capvoPad2(d.getDate())}`;
}
function capvoParseDateKey(value){
  const s=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
  const [y,m,d]=s.split('-').map(Number);
  const dt=new Date(y,m-1,d,12,0,0,0);
  return Number.isNaN(dt.getTime())?null:dt;
}
function capvoClampCycleDay(value){
  const n=Math.round(Number(value)||1);
  return Math.min(28,Math.max(1,n));
}

// CAPVO v1.1.7.11 compatibility helper.
// 02-supabase-data.js expects normalizeBudgetCycleType to exist.
function normalizeBudgetCycleType(value){
  const raw = String(value || '').trim();
  if(raw === 'last_working_day') return 'last_working_day';
  if(raw === 'fixed_day') return 'fixed_day';
  if(raw === 'last_business_day') return 'last_working_day';
  if(raw === 'specific_day') return 'fixed_day';
  return 'fixed_day';
}


// CAPVO v1.1.7.12 compatibility helpers.
// Some older modules/settings code call these names directly.
function getBudgetCycleType(){
  try{
    return normalizeBudgetCycleType(D?.preferences?.budgetCycleType || D?.preferences?.budget_cycle_type || 'fixed_day');
  }catch(e){
    return 'fixed_day';
  }
}

function getBudgetCycleStartDay(){
  try{
    const raw = D?.preferences?.budgetCycleStartDay ?? D?.preferences?.budget_cycle_start_day ?? 1;
    return capvoClampCycleDay(raw || 1);
  }catch(e){
    return 1;
  }
}

function setBudgetCycleType(value){
  if(!D.preferences)D.preferences={};
  D.preferences.budgetCycleType = normalizeBudgetCycleType(value);
  return D.preferences.budgetCycleType;
}

function setBudgetCycleStartDay(value){
  if(!D.preferences)D.preferences={};
  D.preferences.budgetCycleStartDay = capvoClampCycleDay(value || 1);
  return D.preferences.budgetCycleStartDay;
}

function isLastWorkingDayCycle(){
  return getBudgetCycleType() === 'last_working_day';
}


// CAPVO v1.1.7.13 compatibility helpers for budget-cycle UI.
// These keep 02-supabase-data.js/settings/dashboard rendering stable.
function capvoToDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  }
  if(typeof capvoParseDateKey === 'function'){
    const parsed = capvoParseDateKey(value);
    if(parsed) return parsed;
  }
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
}

function formatGreekFullDate(value){
  const d = capvoToDate(value);
  if(!d) return '—';
  const months = Array.isArray(MG) ? MG : ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
  return `${d.getDate()} ${months[d.getMonth()] || ''} ${d.getFullYear()}`;
}

function formatBudgetCycleDateRange(startValue,endValue){
  const s = capvoToDate(startValue);
  const e = capvoToDate(endValue);
  if(!s || !e) return '—';
  return `${formatGreekFullDate(s)} – ${formatGreekFullDate(e)}`;
}

function getBudgetCycleRuleLabel(){
  const type = getBudgetCycleType();
  if(type === 'last_working_day') return 'Τελευταία εργάσιμη κάθε μήνα';
  return `Κάθε ${getBudgetCycleStartDay()} του μήνα`;
}

function getBudgetCycleRuleShortLabel(){
  const type = getBudgetCycleType();
  if(type === 'last_working_day') return 'Τελευταία εργάσιμη';
  return `${getBudgetCycleStartDay()} κάθε μήνα`;
}

function capvoLastWorkingDayOfMonth(year,monthIndex){
  const d = new Date(year, monthIndex + 1, 0, 12);
  // Safe fallback: weekends only. Holiday-aware logic can override elsewhere when available.
  while(d.getDay() === 0 || d.getDay() === 6){
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function getNextPaydayAfter(dateValue,type){
  const ref = capvoToDate(dateValue) || new Date();
  const normalizedType = normalizeBudgetCycleType(type || getBudgetCycleType());
  const day = getBudgetCycleStartDay();

  let candidate;
  if(normalizedType === 'last_working_day'){
    candidate = capvoLastWorkingDayOfMonth(ref.getFullYear(), ref.getMonth());
    if(candidate <= ref){
      candidate = capvoLastWorkingDayOfMonth(ref.getFullYear(), ref.getMonth() + 1);
    }
    return candidate;
  }

  candidate = new Date(ref.getFullYear(), ref.getMonth(), day, 12);
  if(candidate <= ref){
    candidate = new Date(ref.getFullYear(), ref.getMonth() + 1, day, 12);
  }
  return candidate;
}

function formatNextPaydayMeta(cycle,options={}){
  const prefix = options && options.prefix ? options.prefix : 'Επόμενη πληρωμή';
  const next = cycle?.nextStartKey || cycle?.nextStart || getNextPaydayAfter(new Date(), getBudgetCycleType());
  return `${prefix}: ${formatGreekFullDate(next)}`;
}

function getPendingCycleCarryover(){
  try{
    const cycles = (D?.budgetCycles || [])
      .slice()
      .sort((a,b)=>String(b.startDate || b.start_date || '').localeCompare(String(a.startDate || a.start_date || '')));

    if(cycles.length < 2) return null;

    const current = getCurrentBudgetCycle();
    const previous = cycles.find(c => String(c.endDate || c.end_date || '') < String(current.startKey || current.startDate || ''));
    if(!previous) return null;

    const existing = (D?.budgetCycleCarryovers || D?.budget_cycle_carryovers || []).find(x =>
      String(x.fromCycleKey || x.from_cycle_key || '') === String(previous.cycleKey || previous.cycle_key || previous.startDate || previous.start_date || '') &&
      String(x.toCycleKey || x.to_cycle_key || '') === String(current.startKey || current.startDate || '')
    );
    if(existing) return null;

    return null;
  }catch(e){
    return null;
  }
}

function closeCycleCarryoverSheet(){
  const el = document.getElementById('cycleCarryoverSheet') || document.getElementById('mCycleCarryover');
  if(el) el.classList.remove('active');
}


function getBudgetCycleStartDay(){
  return capvoClampCycleDay(D?.preferences?.budgetCycleStartDay||1);
}
function getStandardBudgetCycle(refDate=new Date()){
  const day=getBudgetCycleStartDay();
  const today=refDate instanceof Date?new Date(refDate.getFullYear(),refDate.getMonth(),refDate.getDate(),12):new Date();
  let start=new Date(today.getFullYear(),today.getMonth(),day,12);
  if(today<start){
    start=new Date(today.getFullYear(),today.getMonth()-1,day,12);
  }
  const nextStart=new Date(start.getFullYear(),start.getMonth()+1,day,12);
  const end=new Date(nextStart);
  end.setDate(end.getDate()-1);
  return {
    id:'standard_'+capvoDateKey(start),
    start,
    end,
    nextStart,
    startKey:capvoDateKey(start),
    endKey:capvoDateKey(end),
    nextStartKey:capvoDateKey(nextStart),
    startDay:day,
    source:'normal',
    note:'',
    isGenerated:false,
    label:formatBudgetCycleLabel(start,end)
  };
}
function getActiveStoredBudgetCycle(refDate=new Date()){
  const today=refDate instanceof Date?new Date(refDate.getFullYear(),refDate.getMonth(),refDate.getDate(),12):new Date();
  const cycles=(D?.budgetCycles||[])
    .map(c=>{
      const start=capvoParseDateKey(c.startDate||c.start_date);
      const end=capvoParseDateKey(c.endDate||c.end_date);
      if(!start||!end)return null;
      return {
        ...c,
        start,
        end,
        nextStart:new Date(end.getFullYear(),end.getMonth(),end.getDate()+1,12),
        startKey:capvoDateKey(start),
        endKey:capvoDateKey(end),
        nextStartKey:capvoDateKey(new Date(end.getFullYear(),end.getMonth(),end.getDate()+1,12)),
        label:formatBudgetCycleLabel(start,end),
        isGenerated:true
      };
    })
    .filter(Boolean)
    .filter(c=>today>=c.start && today<=c.end)
    .sort((a,b)=>b.start-a.start);
  return cycles[0]||null;
}
function getCurrentBudgetCycle(refDate=new Date()){
  return getActiveStoredBudgetCycle(refDate) || getStandardBudgetCycle(refDate);
}
function getPrimaryIncomeSource(){
  // Production rule: never guess the primary budget.
  // The user must explicitly mark exactly one income source as primary.
  const sources=(D?.incomeSources||[]);
  return sources.find(i=>i.isPrimaryIncome) || null;
}
function getCycleIncomesForCycle(cycleId){
  return (D?.budgetCycleIncomes||[]).filter(i=>String(i.cycleId||i.cycle_id)===String(cycleId||''));
}
function formatBudgetCycleLabel(start,end){
  if(!(start instanceof Date)||!(end instanceof Date))return 'Τρέχων κύκλος';
  const s=`${start.getDate()} ${MG[start.getMonth()]?.slice(0,3)||''}`;
  const e=`${end.getDate()} ${MG[end.getMonth()]?.slice(0,3)||''}`;
  return `${s} - ${e}`;
}
function isDateInCurrentBudgetCycle(value){
  const dt=capvoParseDateKey(value);
  if(!dt)return false;
  const c=getCurrentBudgetCycle();
  return dt>=c.start && dt<=c.end;
}
function getAllDailyExpenses(){
  const rows=[];
  Object.values(D.months||{}).forEach(m=>{
    (m.daily||[]).forEach(e=>rows.push(e));
  });
  return rows;
}
function getCurrentCycleDailyExpenses(){
  return getAllDailyExpenses().filter(e=>isDateInCurrentBudgetCycle(e.date));
}
function currentCycleKey(){return getCurrentBudgetCycle().startKey;}
function budgetCycleRemainingDays(){
  const c=getCurrentBudgetCycle();
  const today=new Date();
  const t=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  const ms=24*60*60*1000;
  return Math.max(1,Math.floor((c.end-t)/ms)+1);
}

function ensM(k){if(!D.months[k])D.months[k]={daily:[]}}
function gid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5)}
function capvoMoney(n){
  n=Number(n)||0;
  // Normalize all money values to cents to avoid €1499,99 style float artifacts.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function fmt(n){n=capvoMoney(n);return '€'+n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
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
function fixedTotal(){return capvoMoney((D.fixedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0))}
function dailyTotal(){return capvoMoney(getCurrentCycleDailyExpenses().reduce((s,e)=>s+(Number(e.amount)||0),0))}
function allFixedTotal(){return fixedTotal()+ccPayTotal()}
function incomeSourcesTotal(){
  return (D.incomeSources||[])
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function budgetIncomeTotal(){
  return capvoMoney((D.incomeSources||[])
    .filter(i=>i.includeInBudget)
    .reduce((s,i)=>s+(Number(i.amount)||0),0));
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

  getCurrentCycleDailyExpenses().forEach(exp=>{
    if(allowed.has(exp.category)){
      total+=Number(exp.amount)||0;
    }
  });

  return total;
}

function restrictedCoverageFor(source){
  if(!source?.id)return 0;

  let total=0;

  getCurrentCycleDailyExpenses().forEach(exp=>{
    if(exp.paymentSourceId===source.id){
      total+=Number(exp.amount)||0;
    }
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
  return capvoMoney(getCurrentCycleDailyExpenses()
    .filter(e=>!e.paymentSourceId)
    .reduce((s,e)=>s+(Number(e.amount)||0),0));
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
  D.income = capvoMoney(budgetIncomeTotal());
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
