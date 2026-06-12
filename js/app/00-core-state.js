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
const MG_GEN = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
const DG = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];

const CCLR = {
  'Τρόφιμα':'#e6960a','Καφέδες':'#8b6914','Μεταφορά':'#2471a3','Ψυχαγωγία':'#7d3c98',
  'Φαγητό έξω':'#c0392b','Στέγαση':'#1d9e75','Λογαριασμοί':'#d4a012','Υγεία':'#148f77',
  'Ρούχα':'#993556','Συνδρομές':'#3f51b5','Δάνεια':'#34495e','Πιστωτικές':'#2471a3','Αποταμίευση':'#10b981','Άλλο':'#888780'
};

const CCLS = {
  'Τρόφιμα':'cat-food','Καφέδες':'cat-coffee','Μεταφορά':'cat-transport','Ψυχαγωγία':'cat-entertainment',
  'Φαγητό έξω':'cat-eating','Στέγαση':'cat-housing','Λογαριασμοί':'cat-bills','Υγεία':'cat-health',
  'Ρούχα':'cat-clothes','Συνδρομές':'cat-sub','Δάνεια':'cat-loans','Πιστωτικές':'cat-cc','Αποταμίευση':'cat-savings','Άλλο':'cat-other'
};

const CEMO = {
  'Τρόφιμα':'🛒','Καφέδες':'☕','Μεταφορά':'🚗','Ψυχαγωγία':'🎭','Φαγητό έξω':'🍕','Στέγαση':'🏠',
  'Λογαριασμοί':'💡','Υγεία':'🏥','Ρούχα':'👕','Συνδρομές':'📱','Δάνεια':'🏦','Πιστωτικές':'💳','Αποταμίευση':'🏦','Άλλο':'📌'
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
  return Math.min(31,Math.max(1,n));
}

function capvoDaysInMonth(year,monthIndex){
  return new Date(Number(year),Number(monthIndex)+1,0).getDate();
}

function capvoCycleDayDate(year,monthIndex,day){
  const safeDay=Math.min(capvoClampCycleDay(day),capvoDaysInMonth(year,monthIndex));
  return new Date(Number(year),Number(monthIndex),safeDay,12);
}

function capvoCleanCycleDayInputValue(value){
  const digits=String(value ?? '').replace(/\D/g,'').slice(0,2);
  if(!digits)return '';
  const n=Number(digits);
  if(n>31)return '31';
  return digits;
}

function handleBudgetCycleDayInput(input){
  const el=typeof input==='string'?document.getElementById(input):input;
  if(!el)return '';
  const cleaned=capvoCleanCycleDayInputValue(el.value);
  if(el.value!==cleaned)el.value=cleaned;
  return cleaned;
}

function capvoParseCycleDayInput(input){
  const el=typeof input==='string'?document.getElementById(input):input;
  const raw=String(el?.value ?? '').trim();
  if(raw==='')return null;
  if(!/^\d{1,2}$/.test(raw))return null;
  const n=Number(raw);
  if(!Number.isFinite(n) || n<1 || n>31)return null;
  return Math.round(n);
}

function capvoMarkCycleDayInputValidity(input,isValid){
  const el=typeof input==='string'?document.getElementById(input):input;
  if(!el)return;
  el.classList.toggle('is-invalid',!isValid);
  el.setAttribute('aria-invalid',isValid?'false':'true');
}

function finalizeBudgetCycleDayInput(input,fallback){
  const el=typeof input==='string'?document.getElementById(input):input;
  const day=capvoParseCycleDayInput(el);
  if(day===null){
    capvoMarkCycleDayInputValidity(el,false);
    return null;
  }
  if(el)el.value=String(day);
  capvoMarkCycleDayInputValidity(el,true);
  return day;
}

function readBudgetCycleDayInput(input,fallback){
  return capvoParseCycleDayInput(input);
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

function formatGreekDayMonth(value){
  const d = capvoToDate(value);
  if(!d) return '—';
  const months = Array.isArray(MG_GEN) ? MG_GEN : ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
  return `${d.getDate()} ${months[d.getMonth()] || ''}`;
}

function formatGreekFullDate(value){
  const d = capvoToDate(value);
  if(!d) return '—';
  return `${formatGreekDayMonth(d)} ${d.getFullYear()}`;
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

// ===== HOLIDAY-AWARE BUDGET CYCLES =====
// The standard generated cycle must follow the user's real payday rule.
// For last_working_day we use weekends + Greek holidays, with Worker-loaded
// holidays when available and a deterministic local fallback when offline.
function capvoAddDays(date,days){
  const d=capvoToDate(date) || new Date();
  d.setDate(d.getDate()+Number(days||0));
  return d;
}

function capvoGreekOrthodoxEasterDate(year){
  // Meeus Julian algorithm converted to Gregorian calendar.
  const a=year%4;
  const b=year%7;
  const c=year%19;
  const d=(19*c+15)%30;
  const e=(2*a+4*b-d+34)%7;
  const month=Math.floor((d+e+114)/31);
  const day=((d+e+114)%31)+1;
  const julian=new Date(year,month-1,day,12);
  julian.setDate(julian.getDate()+13);
  return julian;
}

function capvoStaticGreekHolidayKeys(year){
  const y=Number(year);
  if(!Number.isInteger(y))return new Set();
  const keys=new Set([
    `${y}-01-01`,
    `${y}-01-06`,
    `${y}-03-25`,
    `${y}-05-01`,
    `${y}-08-15`,
    `${y}-10-28`,
    `${y}-12-25`,
    `${y}-12-26`
  ]);
  const easter=capvoGreekOrthodoxEasterDate(y);
  [-48,-2,1,50].forEach(offset=>keys.add(capvoDateKey(capvoAddDays(easter,offset))));
  return keys;
}

function capvoHolidayKeysForYear(year){
  const y=Number(year);
  const keys=capvoStaticGreekHolidayKeys(y);
  try{
    const loaded=D?.holidaysByYear?.[String(y)] || D?.holidaysByYear?.[y] || [];
    if(Array.isArray(loaded)){
      loaded.forEach(item=>{
        const key=typeof item==='string'?item:(item?.date||item?.key||'');
        if(/^\d{4}-\d{2}-\d{2}$/.test(String(key)))keys.add(String(key));
      });
    }
  }catch(_){/* keep local fallback */}
  return keys;
}

function capvoIsGreekHoliday(dateValue){
  const d=capvoToDate(dateValue);
  if(!d)return false;
  return capvoHolidayKeysForYear(d.getFullYear()).has(capvoDateKey(d));
}

function capvoIsNonWorkingDay(dateValue){
  const d=capvoToDate(dateValue);
  if(!d)return false;
  return d.getDay()===0 || d.getDay()===6 || capvoIsGreekHoliday(d);
}

function capvoLastWorkingDayOfMonth(year,monthIndex){
  const d = new Date(year, monthIndex + 1, 0, 12);
  while(capvoIsNonWorkingDay(d)){
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function getHolidayAwareRuleText(){
  return 'Το CAPVO υπολογίζει Σαββατοκύριακα και ελληνικές αργίες.';
}

async function capvoFetchHolidayYear(year){
  const y=Number(year);
  if(!Number.isInteger(y))return [];
  const loaded=D?.holidaysLoadedYears||{};
  if(loaded[String(y)])return D?.holidaysByYear?.[String(y)]||[];

  if(!D.holidaysByYear)D.holidaysByYear={};
  if(!D.holidaysLoadedYears)D.holidaysLoadedYears={};

  const fallback=[...capvoStaticGreekHolidayKeys(y)].map(date=>({date,source:'static-fallback'}));
  let rows=fallback;

  try{
    const workerUrl=String(CONFIG?.WORKER_URL||'').trim();
    if(workerUrl){
      const url=new URL(workerUrl);
      url.pathname='/holidays';
      url.searchParams.set('country','GR');
      url.searchParams.set('year',String(y));
      const res=await fetch(url.toString(),{headers:{Accept:'application/json'}});
      if(res.ok){
        const data=await res.json();
        if(Array.isArray(data?.holidays) && data.holidays.length){
          rows=data.holidays
            .filter(h=>/^\d{4}-\d{2}-\d{2}$/.test(String(h?.date||'')))
            .map(h=>({date:String(h.date),name:h.localName||h.name||'',source:data.source||'worker'}));
        }
      }
    }
  }catch(e){
    console.warn('[CAPVO] Holiday fetch failed, using local fallback:',e?.message||e);
  }

  D.holidaysByYear[String(y)]=rows;
  D.holidaysLoadedYears[String(y)]=true;
  return rows;
}

async function capvoEnsureBudgetCycleHolidays(refDate=new Date()){
  const type=typeof getBudgetCycleType==='function'?getBudgetCycleType():'fixed_day';
  if(type!=='last_working_day')return;
  const ref=capvoToDate(refDate)||new Date();
  const years=new Set([ref.getFullYear()-1,ref.getFullYear(),ref.getFullYear()+1]);
  await Promise.all([...years].map(y=>capvoFetchHolidayYear(y)));
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
  const type=getBudgetCycleType();
  const day=getBudgetCycleStartDay();
  const today=refDate instanceof Date?new Date(refDate.getFullYear(),refDate.getMonth(),refDate.getDate(),12):new Date();

  let start;
  let nextStart;

  if(type==='last_working_day'){
    const thisMonthStart=capvoLastWorkingDayOfMonth(today.getFullYear(),today.getMonth());
    if(today<thisMonthStart){
      start=capvoLastWorkingDayOfMonth(today.getFullYear(),today.getMonth()-1);
      nextStart=thisMonthStart;
    }else{
      start=thisMonthStart;
      nextStart=capvoLastWorkingDayOfMonth(today.getFullYear(),today.getMonth()+1);
    }
  }else{
    start=capvoCycleDayDate(today.getFullYear(),today.getMonth(),day);
    if(today<start){
      start=capvoCycleDayDate(today.getFullYear(),today.getMonth()-1,day);
    }
    nextStart=capvoCycleDayDate(start.getFullYear(),start.getMonth()+1,day);
  }

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
    startDay:type==='last_working_day'?start.getDate():day,
    source:'normal',
    note:type==='last_working_day'?'last_working_day':'',
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
  const s=capvoToDate(start);
  const e=capvoToDate(end);
  if(!s||!e)return 'Τρέχων κύκλος';
  if(s.getFullYear()!==e.getFullYear())return `${formatGreekFullDate(s)} – ${formatGreekFullDate(e)}`;
  return `${formatGreekDayMonth(s)} – ${formatGreekDayMonth(e)}`;
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
function getCurrentCycleBudgetExpenses(){
  const rows=typeof getCurrentCycleDailyExpenses==='function' ? getCurrentCycleDailyExpenses() : [];
  return rows.filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true);
}
function getCurrentCycleActualCardPayments(){
  const txs=Array.isArray(D?.creditCardTransactions)?D.creditCardTransactions:[];
  return txs
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .filter(t=>isDateInCurrentBudgetCycle(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at))
    .map(t=>{
      const card=typeof cardById==='function'?cardById(t.cardId||t.card_id):null;
      const rawDate=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO();
      return {
        id:t.id||('cc_payment_'+gid()),
        name:t.description||('Πληρωμή '+(card?.name||'κάρτας')),
        amount:Number(t.amount)||0,
        category:t.category||'Πιστωτικές',
        date:normalizeDateValue(rawDate)||todayISO(),
        paymentSourceId:t.cardId||t.card_id||'',
        paymentSourceName:card?.name||'Πιστωτική κάρτα',
        paymentAccountType:'credit_card_payment',
        isCardPayment:true,
        affectsCashBudget:true
      };
    });
}
function savingsGoalById(goalId){
  if(!goalId)return null;
  return (D?.savingsGoals||[]).find(g=>String(g.id)===String(goalId))||null;
}
function getCurrentCycleSavingsBudgetMovements(){
  const txs=Array.isArray(D?.savingsTransactions)?D.savingsTransactions:[];
  return txs
    .map(t=>{
      const rawDate=t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date||todayISO();
      const date=normalizeDateValue(rawDate)||todayISO();
      if(!isDateInCurrentBudgetCycle(date))return null;

      const type=String(t.type||'').toLowerCase();
      const source=String(t.source||'').toLowerCase();
      const isTransfer=type==='transfer_in' || type==='transfer_out' || source.includes('transfer');
      if(isTransfer)return null;

      const amount=capvoMoney(Number(t.amount)||0);
      if(amount===0)return null;

      const isWithdrawal=type==='withdrawal' || amount<0;
      const isDeposit=type==='deposit' || (!isWithdrawal && amount>0);
      if(!isWithdrawal && !isDeposit)return null;

      const goal=savingsGoalById(t.goalId||t.goal_id);
      const abs=Math.abs(amount);
      const goalName=goal?.name||'Κουμπαράς';

      return {
        id:t.id||('savings_'+gid()),
        name:isWithdrawal
          ? `Επιστροφή από ${goalName}`
          : `Μεταφορά σε ${goalName}`,
        amount:capvoMoney(isWithdrawal?-abs:abs),
        category:'Αποταμίευση',
        date,
        paymentSourceId:t.goalId||t.goal_id||'',
        paymentSourceName:goalName,
        paymentAccountType:'savings',
        isSavingsMovement:true,
        isSavingsWithdrawal:isWithdrawal,
        affectsCashBudget:true
      };
    })
    .filter(Boolean);
}
function getCurrentCycleBudgetMovements(){
  const rows=[
    ...(typeof getCurrentCycleBudgetExpenses==='function'?getCurrentCycleBudgetExpenses():[]),
    ...(typeof getCurrentCycleActualCardPayments==='function'?getCurrentCycleActualCardPayments():[]),
    ...(typeof getCurrentCycleSavingsBudgetMovements==='function'?getCurrentCycleSavingsBudgetMovements():[])
  ];
  return rows.sort((a,b)=>
    String(b.date||'').localeCompare(String(a.date||'')) ||
    String(b.id||'').localeCompare(String(a.id||''))
  );
}

function capvoMovementSortKey(row){
  return String(row?.createdAt||row?.created_at||row?.transactionDate||row?.transaction_date||row?.date||'');
}

function capvoMovementDate(row){
  const raw=row?.date||row?.transactionDate||row?.transaction_date||row?.createdAt||row?.created_at||todayISO();
  return normalizeDateValue(raw)||todayISO();
}

function capvoMovementBudgetImpact(row){
  if(!row)return 0;
  if(row.affectsBudget===false || row.affectsCashBudget===false || row.affects_cash_budget===false)return 0;
  if(Object.prototype.hasOwnProperty.call(row,'budgetImpactAmount'))return capvoMoney(Number(row.budgetImpactAmount)||0);
  if(Object.prototype.hasOwnProperty.call(row,'budget_impact_amount'))return capvoMoney(Number(row.budget_impact_amount)||0);
  return capvoMoney(Number(row.amount)||0);
}

function getCurrentCycleSavingsAllMovements(){
  const txs=Array.isArray(D?.savingsTransactions)?D.savingsTransactions:[];
  return txs
    .map(t=>{
      const date=capvoMovementDate(t);
      if(!isDateInCurrentBudgetCycle(date))return null;

      const type=String(t.type||'deposit').toLowerCase();
      const source=String(t.source||'manual').toLowerCase();
      const goal=savingsGoalById(t.goalId||t.goal_id);
      const amount=capvoMoney(Number(t.amount)||0);
      const abs=Math.abs(amount);
      const isTransfer=type==='transfer_in' || type==='transfer_out' || source.includes('transfer');
      const isWithdrawal=type==='withdrawal' || (!isTransfer && amount<0);
      const affectsBudget=!isTransfer;
      const budgetImpactAmount=affectsBudget ? (isWithdrawal ? -abs : abs) : 0;
      const goalName=goal?.name||'Κουμπαράς';

      let name='Κίνηση κουμπαρά';
      let subtitle='Κουμπαράς';
      let movementType='savings_movement';

      if(isTransfer){
        movementType=type==='transfer_out'?'savings_transfer_out':'savings_transfer_in';
        name=type==='transfer_out' ? `Μεταφορά από ${goalName}` : `Μεταφορά σε ${goalName}`;
        subtitle='Εσωτερική μεταφορά · Δεν επηρεάζει budget';
      }else if(isWithdrawal){
        movementType='savings_withdrawal';
        name=`Επιστροφή από ${goalName}`;
        subtitle='Επιστροφή στο budget';
      }else{
        movementType='savings_deposit';
        name=`Μεταφορά σε ${goalName}`;
        subtitle='Αποταμίευση · Επηρεάζει budget';
      }

      return {
        id:`savings_${t.id||gid()}`,
        sourceId:t.id||'',
        movementType,
        movementGroup:'savings',
        name,
        amount:amount===0?abs:amount,
        budgetImpactAmount,
        affectsBudget,
        affectsCashBudget:affectsBudget,
        category:'Αποταμίευση',
        date,
        createdAt:t.createdAt||t.created_at||date,
        paymentSourceId:t.goalId||t.goal_id||'',
        paymentSourceName:goalName,
        paymentAccountType:'savings',
        sourceLabel:subtitle,
        note:t.note||'',
        canEdit:false,
        canDelete:false,
        readOnly:true,
        isSavingsMovement:true,
        isSavingsTransfer:isTransfer,
        isSavingsWithdrawal:isWithdrawal
      };
    })
    .filter(Boolean);
}

function fixedExpenseMovementDate(e){
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const cycleStart=cycle?.startKey || todayISO();
  const created=typeof normalizeDateValue==='function' ? normalizeDateValue(fixedExpenseCreatedAt(e)) : String(fixedExpenseCreatedAt(e)||'').slice(0,10);

  // A new fixed expense created during the current cycle should appear in the
  // Transactions ledger on the day it was created. Older recurring fixed
  // expenses still represent this cycle from the cycle start.
  if(created && typeof isDateInCurrentBudgetCycle==='function' && isDateInCurrentBudgetCycle(created)){
    return created;
  }

  return cycleStart;
}

function getCurrentCycleFixedExpenseMovements(){
  return (Array.isArray(D?.fixedExpenses)?D.fixedExpenses:[])
    .map(e=>{
      const amount=capvoMoney(Number(e.amount)||0);
      if(amount<=0)return null;
      const date=fixedExpenseMovementDate(e);
      return {
        id:`fixed_${e.id||gid()}`,
        sourceId:e.id||'',
        movementType:'fixed_expense',
        movementGroup:'budget',
        name:e.name||'Πάγιο έξοδο',
        amount,
        budgetImpactAmount:amount,
        affectsBudget:true,
        affectsCashBudget:true,
        category:e.category||'Πάγια',
        date,
        createdAt:e.createdAt||e.created_at||date,
        paymentSourceId:'fixed',
        paymentSourceName:'Πάγιο έξοδο',
        paymentAccountType:'fixed_expense',
        sourceLabel:'Πάγιο έξοδο · Επηρεάζει budget',
        canEdit:true,
        canDelete:true,
        readOnly:false,
        isFixedExpense:true
      };
    })
    .filter(Boolean);
}

function getCurrentCycleAllMovements(){
  const daily=(typeof getCurrentCycleDailyExpenses==='function'?getCurrentCycleDailyExpenses():[])
    .map(e=>{
      const affects=typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true;
      const isCard=!!(e.isCreditCardPurchase || e.is_credit_card_purchase || e.paymentAccountType==='credit_card' || e.payment_account_type==='credit_card' || e.creditCardId || e.credit_card_id || e.installmentPlanId || e.installment_plan_id);
      const isBenefit=!affects && !isCard && !!(e.paymentSourceId || e.payment_source_id);
      const amount=capvoMoney(Number(e.amount)||0);
      return {
        ...e,
        id:e.id,
        sourceId:e.id,
        movementType:isCard?'credit_card_purchase':(isBenefit?'restricted_expense':'daily_expense'),
        movementGroup:isCard?'cards':(isBenefit?'benefits':'budget'),
        amount,
        budgetImpactAmount:affects?amount:0,
        affectsBudget:affects,
        affectsCashBudget:affects,
        sourceLabel:isCard?'Αγορά με πιστωτική · Δεν επηρεάζει budget':(isBenefit?'Παροχή / περιορισμένη πηγή · Δεν επηρεάζει cash budget':'Budget'),
        canEdit:true,
        canDelete:true,
        readOnly:false
      };
    });

  const cardPayments=(Array.isArray(D?.creditCardTransactions)?D.creditCardTransactions:[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .map(t=>{
      const date=capvoMovementDate(t);
      if(!isDateInCurrentBudgetCycle(date))return null;
      const card=typeof cardById==='function'?cardById(t.cardId||t.card_id):null;
      const amount=capvoMoney(Number(t.amount)||0);
      return {
        id:`card_payment_${t.id||gid()}`,
        sourceId:t.id||'',
        movementType:'card_payment',
        movementGroup:'cards',
        name:t.description||`Πληρωμή ${card?.name||'κάρτας'}`,
        amount,
        budgetImpactAmount:amount,
        affectsBudget:true,
        affectsCashBudget:true,
        category:t.category||'Πιστωτικές',
        date,
        createdAt:t.createdAt||t.created_at||t.transactionDate||t.transaction_date||date,
        paymentSourceId:t.cardId||t.card_id||'',
        paymentSourceName:card?.name||'Πιστωτική κάρτα',
        paymentAccountType:'credit_card_payment',
        sourceLabel:'Πληρωμή κάρτας · Επηρεάζει budget',
        canEdit:false,
        canDelete:false,
        readOnly:true,
        isCardPayment:true
      };
    })
    .filter(Boolean);

  const savings=typeof getCurrentCycleSavingsAllMovements==='function'?getCurrentCycleSavingsAllMovements():[];
  const fixed=typeof getCurrentCycleFixedExpenseMovements==='function'?getCurrentCycleFixedExpenseMovements():[];

  return [...fixed,...daily,...cardPayments,...savings].sort((a,b)=>
    String(b.date||'').localeCompare(String(a.date||'')) ||
    String(capvoMovementSortKey(b)).localeCompare(String(capvoMovementSortKey(a))) ||
    String(b.id||'').localeCompare(String(a.id||''))
  );
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
function capvoLocalDateKey(date=new Date()){
  const d=date instanceof Date?date:new Date(date);
  if(Number.isNaN(d.getTime()))return new Date().toISOString().slice(0,10);
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayISO(){return capvoLocalDateKey(new Date())}
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
function cardById(id){
  if(!id)return null;
  return (D.creditCards||[]).find(c=>String(c.id)===String(id))||null;
}
function isCreditCardPaymentSource(source){
  return !!(source && (source.type==='credit_card' || source.paymentAccountType==='credit_card' || source.accountType==='credit_card'));
}
function expenseAffectsCashBudget(e){
  if(!e)return true;

  const explicit=e.affectsCashBudget ?? e.affects_cash_budget ?? e.affectsBudget ?? e.affects_budget;
  if(explicit===false || String(explicit).toLowerCase()==='false')return false;
  if(explicit===true || String(explicit).toLowerCase()==='true')return true;

  const accountType=String(e.paymentAccountType||e.payment_account_type||'').toLowerCase();
  if(accountType==='credit_card')return false;

  if(e.isCreditCardPurchase || e.is_credit_card_purchase)return false;
  if(e.creditCardId || e.credit_card_id || e.creditCardTransactionId || e.credit_card_transaction_id)return false;
  if(e.installmentPlanId || e.installment_plan_id)return false;

  if(e.paymentSourceId || e.payment_source_id)return false;
  return true;
}
function plannedCardPaymentTotal(){
  return capvoMoney((D.creditCards||[])
    .filter(c=>(Number(c.balance)||0)>0 || (Number(c.chosenPay)||0)>0)
    .reduce((s,c)=>s+effectiveCardPayment(c),0));
}
function actualCardPaymentTotal(){
  return capvoMoney((D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .filter(t=>isDateInCurrentBudgetCycle(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at))
    .reduce((s,t)=>s+(Number(t.amount)||0),0));
}
function ccPayTotal(){
  // Budget impact from cards must represent actual payments only.
  // Planned/minimum card payments stay in the Cards planner and do not reduce dashboard cash.
  return actualCardPaymentTotal();
}
function fixedTotal(){return capvoMoney((D.fixedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0))}
function dailyTotal(){return capvoMoney(getCurrentCycleDailyExpenses().reduce((s,e)=>s+(Number(e.amount)||0),0))}
function allFixedTotal(){return fixedTotal()+ccPayTotal()}
function incomeSourcesTotal(){
  return (D.incomeSources||[])
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

/* CAPVO v1.8.1 — Salary/Budget + optional soft spending limit.
   amount = total cycle amount.
   spendingLimit = optional amount available for expenses.
   Stored in notes metadata for this patch, so no DB migration is required yet. */
const CAPVO_SPENDING_LIMIT_RE=/\[\[CAPVO_SPENDING_LIMIT:([0-9]+(?:\.[0-9]+)?)\]\]/;

function capvoParseSpendingLimitFromNotes(notes){
  const match=String(notes||'').match(CAPVO_SPENDING_LIMIT_RE);
  const value=match?Number(match[1]):0;
  return Number.isFinite(value)&&value>0?capvoMoney(value):0;
}

function capvoStripSpendingLimitFromNotes(notes){
  return String(notes||'')
    .replace(CAPVO_SPENDING_LIMIT_RE,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function capvoEncodeIncomeNotes(notes,spendingLimit){
  const clean=capvoStripSpendingLimitFromNotes(notes);
  const limit=capvoMoney(Number(spendingLimit)||0);
  if(limit>0){
    return `${clean}${clean?' ':''}[[CAPVO_SPENDING_LIMIT:${limit}]]`.trim();
  }
  return clean||null;
}

function capvoInferMoneySourceType(source){
  const name=String(source?.name||'').toLowerCase();
  const category=String(source?.category||'').toLowerCase();

  if(source?.sourceType)return source.sourceType;
  if(source?.source_type)return source.source_type;
  if(source?.isPrimaryIncome || source?.is_primary_income || category==='μισθός' || name==='μισθός / budget' || name==='budget μήνα')return 'budget_cycle';
  if(category.includes('ticket') || category.includes('άυλη') || name.includes('ticket') || name.includes('voucher') || source?.isRestricted || source?.is_restricted)return 'benefit';
  if(source?.isRecurring===false || source?.is_recurring===false || category==='bonus' || category==='δώρο' || name.includes('έκτακτο'))return 'one_time';
  return 'income';
}

function capvoInferMoneySourceCategory(source,type){
  const category=String(source?.category||'').toLowerCase();
  const name=String(source?.name||'').toLowerCase();

  if(source?.sourceCategory)return source.sourceCategory;
  if(source?.source_category)return source.source_category;
  if(type==='budget_cycle')return 'primary_budget';
  if(type==='benefit'){
    if(category.includes('ticket') || name.includes('ticket'))return 'ticket';
    if(category.includes('voucher') || category.includes('άυλη') || name.includes('voucher'))return 'voucher';
    return 'benefit';
  }
  if(type==='one_time')return 'one_time';
  if(category.includes('ενοίκιο') || name.includes('ενοίκιο'))return 'rent_income';
  if(category.includes('freelance') || name.includes('freelance'))return 'freelance';
  return 'other_income';
}

function capvoIsBenefitSource(source){
  return capvoInferMoneySourceType(source)==='benefit' || !!source?.isRestricted || (source?.restriction&&source.restriction!=='none');
}

function capvoCountsInSpendingBudget(source){
  if(!source || source.isSavings)return false;
  if(capvoIsBenefitSource(source))return false;
  return source.includeInBudget!==false;
}

function incomeBudgetAmount(source){
  const amount=capvoMoney(Number(source?.amount)||0);
  const limit=capvoMoney(Number(source?.spendingLimit)||0);
  if(limit>0&&limit<amount)return limit;
  return amount;
}

function primaryBudgetSource(){
  return (D.incomeSources||[]).find(i=>
    i &&
    capvoCountsInSpendingBudget(i) &&
    i.isPrimaryIncome &&
    capvoInferMoneySourceType(i)==='budget_cycle' &&
    (Number(i.amount)||0)>0
  ) || (D.incomeSources||[]).find(i=>
    i &&
    capvoCountsInSpendingBudget(i) &&
    i.isPrimaryIncome &&
    (Number(i.amount)||0)>0
  ) || null;
}

function budgetIncomeTotal(){
  const sources=(D.incomeSources||[]).filter(i=>i&&capvoCountsInSpendingBudget(i));
  const primary=primaryBudgetSource();

  if(primary){
    const extras=sources
      .filter(i=>i.id!==primary.id)
      .filter(i=>['income','one_time','carryover'].includes(capvoInferMoneySourceType(i)))
      .reduce((sum,i)=>sum+(Number(i.amount)||0),0);

    return capvoMoney(incomeBudgetAmount(primary)+extras);
  }

  return capvoMoney(sources.reduce((sum,i)=>sum+incomeBudgetAmount(i),0));
}

function totalCycleAmount(){
  const sources=(D.incomeSources||[]).filter(i=>i&&capvoCountsInSpendingBudget(i));
  const primary=primaryBudgetSource();

  if(primary){
    const extras=sources
      .filter(i=>i.id!==primary.id)
      .filter(i=>['income','one_time','carryover'].includes(capvoInferMoneySourceType(i)))
      .reduce((sum,i)=>sum+(Number(i.amount)||0),0);
    return capvoMoney((Number(primary.amount)||0)+extras);
  }

  return capvoMoney(sources.reduce((sum,i)=>sum+(Number(i.amount)||0),0));
}

function budgetLimitReservedAmount(){
  const primary=primaryBudgetSource();
  if(!primary)return 0;
  const amount=capvoMoney(Number(primary.amount)||0);
  const effective=incomeBudgetAmount(primary);
  return capvoMoney(Math.max(0,amount-effective));
}

function savingsIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.isSavings || i.allocationTarget==='savings')
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>capvoIsBenefitSource(i))
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedCategoriesFor(source){
  if(!source?.restriction || source.restriction==='none'){
    if(source?.isRestricted && source?.restrictedCategory)return [source.restrictedCategory];
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

  const rows=typeof getCurrentCycleBudgetExpenses==='function' ? getCurrentCycleBudgetExpenses() : getCurrentCycleDailyExpenses();
  rows.forEach(exp=>{
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
  const rows=[
    ...(typeof getCurrentCycleBudgetExpenses==='function'
      ? getCurrentCycleBudgetExpenses()
      : getCurrentCycleDailyExpenses().filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):!e.paymentSourceId)),
    ...(typeof getCurrentCycleSavingsBudgetMovements==='function'?getCurrentCycleSavingsBudgetMovements():[])
  ];
  return capvoMoney(rows.reduce((s,e)=>s+(Number(e.amount)||0),0));
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
