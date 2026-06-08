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
  budgetCycleIncomes:[],
  budgetCycleCarryovers:[],
  savingsGoals:[],
  savingsTransactions:[],
  holidaysByYear:{},
  holidaysLoadedYears:{},
  holidayFetchStatus:'idle'
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
function normalizeBudgetCycleType(value){
  return String(value||'fixed_day')==='last_working_day'?'last_working_day':'fixed_day';
}
function getBudgetCycleType(){
  return normalizeBudgetCycleType(D?.preferences?.budgetCycleType);
}
function isLastWorkingDayRule(){
  return getBudgetCycleType()==='last_working_day';
}
function getBudgetCycleStartDay(){
  return capvoClampCycleDay(D?.preferences?.budgetCycleStartDay||1);
}
function capvoAsMiddayDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime()))return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12,0,0,0);
  const parsed=capvoParseDateKey(value);
  if(parsed)return parsed;
  const d=new Date(value||Date.now());
  return Number.isNaN(d.getTime())?new Date():new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0,0);
}
function capvoHolidayStorageKey(year){return `capvo_holidays_GR_${year}`;}
function capvoNormalizeHolidayRows(rows){
  const set=new Set();
  (Array.isArray(rows)?rows:[]).forEach(row=>{
    const raw=typeof row==='string'?row:(row?.date||row?.localDate||'');
    const key=String(raw||'').slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(key))set.add(key);
  });
  return set;
}
function capvoLoadHolidayYearFromStorage(year){
  try{
    const raw=localStorage.getItem(capvoHolidayStorageKey(year));
    if(!raw)return false;
    const parsed=JSON.parse(raw);
    const rows=Array.isArray(parsed?.holidays)?parsed.holidays:[];
    const set=capvoNormalizeHolidayRows(rows);
    if(set.size){
      D.holidaysByYear=D.holidaysByYear||{};
      D.holidaysByYear[year]=set;
      D.holidaysLoadedYears=D.holidaysLoadedYears||{};
      D.holidaysLoadedYears[year]='storage';
      return true;
    }
  }catch(_){/* ignore stale cache */}
  return false;
}
function capvoStoreHolidayYear(year,holidays){
  try{
    localStorage.setItem(capvoHolidayStorageKey(year),JSON.stringify({
      country:'GR',
      year:Number(year),
      cachedAt:new Date().toISOString(),
      holidays:(holidays||[]).map(h=>({date:h.date,name:h.name||h.localName||h.local_name||''}))
    }));
  }catch(_){/* storage can be full/blocked */}
}
async function capvoFetchHolidayYear(year){
  const workerUrl=String(CONFIG?.WORKER_URL||'').trim();
  if(!workerUrl)throw new Error('Missing worker URL');
  const url=new URL(workerUrl);
  url.pathname='/holidays';
  url.searchParams.set('country','GR');
  url.searchParams.set('year',String(year));
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),6000):null;
  let res;
  try{
    res=await fetch(url.toString(),{method:'GET',headers:{'Accept':'application/json'},signal:controller?.signal});
  }finally{
    if(timer)clearTimeout(timer);
  }
  if(!res.ok)throw new Error('Holiday API failed: '+res.status);
  const data=await res.json();
  const holidays=Array.isArray(data?.holidays)?data.holidays:[];
  capvoStoreHolidayYear(year,holidays);
  D.holidaysByYear=D.holidaysByYear||{};
  D.holidaysByYear[year]=capvoNormalizeHolidayRows(holidays);
  D.holidaysLoadedYears=D.holidaysLoadedYears||{};
  D.holidaysLoadedYears[year]=data?.source||'api';
  return D.holidaysByYear[year];
}
async function capvoEnsureGreekHolidayYears(years){
  const unique=[...new Set((years||[]).map(y=>Number(y)).filter(y=>Number.isFinite(y)))];
  if(!unique.length)return;
  D.holidayFetchStatus='loading';
  await Promise.all(unique.map(async year=>{
    if(D?.holidaysByYear?.[year])return;
    if(capvoLoadHolidayYearFromStorage(year))return;
    try{
      await capvoFetchHolidayYear(year);
    }catch(err){
      console.warn('[CAPVO] Greek holidays unavailable for',year,err?.message||err);
      D.holidaysByYear=D.holidaysByYear||{};
      if(!D.holidaysByYear[year])D.holidaysByYear[year]=new Set();
      D.holidaysLoadedYears=D.holidaysLoadedYears||{};
      D.holidaysLoadedYears[year]='fallback_weekend_only';
    }
  }));
  D.holidayFetchStatus='ready';
}
async function capvoEnsureBudgetCycleHolidays(){
  const today=new Date();
  const y=today.getFullYear();
  await capvoEnsureGreekHolidayYears([y-1,y,y+1]);
}
function capvoIsWeekend(date){return date.getDay()===0 || date.getDay()===6;}
function capvoIsGreekHoliday(date){
  const key=capvoDateKey(date);
  const year=date.getFullYear();
  return !!(D?.holidaysByYear?.[year]?.has?.(key));
}
function capvoIsNonWorkingDay(date){
  return capvoIsWeekend(date) || capvoIsGreekHoliday(date);
}
function capvoLastWorkingDayOfMonth(year,monthIndex){
  const d=new Date(year,monthIndex+1,0,12,0,0,0);
  while(capvoIsNonWorkingDay(d)){
    d.setDate(d.getDate()-1);
  }
  return d;
}
function getHolidayAwareRuleText(){
  const years=D?.holidaysLoadedYears||{};
  const hasAny=Object.keys(years).some(y=>years[y] && years[y]!=='fallback_weekend_only');
  return hasAny
    ? 'Το CAPVO υπολογίζει Σαββατοκύριακα και επίσημες ελληνικές αργίες.'
    : 'Το CAPVO υπολογίζει Σαββατοκύριακα. Αν δεν φορτωθούν οι αργίες, χρησιμοποιείται προσωρινά ο κανόνας Δευτέρα-Παρασκευή.';
}
function capvoPaydayForMonth(year,monthIndex,type=getBudgetCycleType()){
  if(normalizeBudgetCycleType(type)==='last_working_day')return capvoLastWorkingDayOfMonth(year,monthIndex);
  const lastDay=new Date(year,monthIndex+1,0,12,0,0,0).getDate();
  const day=Math.min(getBudgetCycleStartDay(),lastDay);
  return new Date(year,monthIndex,day,12,0,0,0);
}
function getPreviousPaydayOnOrBefore(refDate=new Date(),type=getBudgetCycleType()){
  const base=capvoAsMiddayDate(refDate);
  let payday=capvoPaydayForMonth(base.getFullYear(),base.getMonth(),type);
  if(base<payday)payday=capvoPaydayForMonth(base.getFullYear(),base.getMonth()-1,type);
  return payday;
}
function getNextPaydayAfter(refDate=new Date(),type=getBudgetCycleType()){
  const base=capvoAsMiddayDate(refDate);
  let payday=capvoPaydayForMonth(base.getFullYear(),base.getMonth(),type);
  if(payday<=base)payday=capvoPaydayForMonth(base.getFullYear(),base.getMonth()+1,type);
  return payday;
}
function getBudgetCycleRuleLabel(){
  return isLastWorkingDayRule()
    ? 'Πληρώνομαι την τελευταία εργάσιμη του μήνα'
    : `Πληρώνομαι κάθε ${getBudgetCycleStartDay()} του μήνα`;
}
function getBudgetCycleRuleShortLabel(){
  return isLastWorkingDayRule()?'Τελευταία εργάσιμη':'Συγκεκριμένη ημέρα';
}
function getStandardBudgetCycle(refDate=new Date()){
  const type=getBudgetCycleType();
  const start=getPreviousPaydayOnOrBefore(refDate,type);
  const nextStart=getNextPaydayAfter(start,type);
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
    startDay:getBudgetCycleStartDay(),
    budgetCycleType:type,
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
function capvoCycleKey(cycle){
  if(!cycle)return '';
  return String(cycle.startKey||cycle.cycleKey||cycle.cycle_key||cycle.startDate||cycle.start_date||'').slice(0,10);
}
function getCycleCarryovers(){
  return Array.isArray(D?.budgetCycleCarryovers)?D.budgetCycleCarryovers:[];
}
function getCarryoverDecision(fromCycle,toCycle){
  const fromKey=capvoCycleKey(fromCycle);
  const toKey=capvoCycleKey(toCycle);
  if(!fromKey || !toKey)return null;
  return getCycleCarryovers().find(c=>String(c.fromCycleKey)===fromKey && String(c.toCycleKey)===toKey) || null;
}
function getCarryInForCycle(cycle){
  const toKey=capvoCycleKey(cycle);
  if(!toKey)return 0;
  return getCycleCarryovers()
    .filter(c=>String(c.toCycleKey)===toKey && c.action==='carry_to_next')
    .reduce((sum,c)=>sum+(Number(c.amount)||0),0);
}
function getBaseIncomeForCycle(cycle){
  const cycleId=String(cycle?.id||'');
  const storedIncomes=cycleId && !String(cycleId).startsWith('standard_') && !String(cycleId).startsWith('normal_')
    ? getCycleIncomesForCycle(cycleId)
    : [];
  const storedTotal=storedIncomes.reduce((s,i)=>s+(Number(i.amount)||0),0);
  if(storedTotal>0)return storedTotal;
  if(Number(cycle?.primaryIncomeAmount)>0)return Number(cycle.primaryIncomeAmount)||0;
  return budgetIncomeTotal();
}
function getCycleIncomeTotal(cycle){
  return getBaseIncomeForCycle(cycle)+getCarryInForCycle(cycle);
}
function getExpensesForCycle(cycle){
  if(!cycle)return [];
  const start=cycle.start instanceof Date?cycle.start:capvoParseDateKey(cycle.startKey||cycle.startDate||cycle.start_date);
  const end=cycle.end instanceof Date?cycle.end:capvoParseDateKey(cycle.endKey||cycle.endDate||cycle.end_date);
  if(!start||!end)return [];
  return getAllDailyExpenses().filter(e=>{
    const d=capvoParseDateKey(e.date);
    return d && d>=start && d<=end;
  });
}
function getCycleSpentTotal(cycle){
  const daily=getExpensesForCycle(cycle).reduce((s,e)=>s+(Number(e.amount)||0),0);
  return fixedTotal()+ccPayTotal()+daily;
}
function getCycleBalance(cycle){
  return getCycleIncomeTotal(cycle)-getCycleSpentTotal(cycle);
}
function getPreviousBudgetCycleFor(cycle){
  if(!cycle?.start)return null;
  const prevRef=new Date(cycle.start.getFullYear(),cycle.start.getMonth(),cycle.start.getDate()-1,12);
  return getActiveStoredBudgetCycle(prevRef) || getStandardBudgetCycle(prevRef);
}
function getPendingCycleCarryover(){
  const current=getCurrentBudgetCycle();
  if(!current?.startKey)return null;
  const previous=getPreviousBudgetCycleFor(current);
  if(!previous?.startKey || !previous?.endKey)return null;

  const today=new Date();
  const todayMid=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
  const currentStart=current.start instanceof Date?current.start:capvoParseDateKey(current.startKey);
  if(!currentStart || todayMid<currentStart)return null;

  const existing=getCarryoverDecision(previous,current);
  if(existing)return null;

  const amount=Math.round(Math.max(0,getCycleBalance(previous))*100)/100;
  if(amount<=0.009)return null;

  return {previous,current,amount};
}
function getCurrentCycleAvailableIncome(){
  return getCycleIncomeTotal(getCurrentBudgetCycle());
}
function formatGreekCycleDate(date,{withYear=false}={}){
  if(!(date instanceof Date) || Number.isNaN(date.getTime()))return '';
  const month=MG_GEN[date.getMonth()]||'';
  const year=withYear?` ${date.getFullYear()}`:'';
  return `${date.getDate()} ${month}${year}`.trim();
}
function formatBudgetCycleLabel(start,end,{withYear=false}={}){
  if(!(start instanceof Date)||!(end instanceof Date))return 'Τρέχων κύκλος';
  const s=formatGreekCycleDate(start,{withYear});
  const e=formatGreekCycleDate(end,{withYear});
  return `${s} - ${e}`;
}
function formatBudgetCycleDateRange(startValue,endValue,{withYear=false}={}){
  const start=startValue instanceof Date?startValue:capvoParseDateKey(startValue);
  const end=endValue instanceof Date?endValue:capvoParseDateKey(endValue);
  return formatBudgetCycleLabel(start,end,{withYear});
}
function formatGreekFullDate(value,{withYear=false}={}){
  const dt=value instanceof Date?value:capvoParseDateKey(value);
  return formatGreekCycleDate(dt,{withYear});
}
function formatNextPaydayMeta(cycle,{prefix='Επόμενη πληρωμή',includeRemaining=true}={}){
  const next=cycle?.nextStartKey||cycle?.nextStartDate||cycle?.nextStart;
  const nextLabel=next?formatGreekFullDate(next):'';
  const remaining=cycleDaysRemaining(cycle);
  const parts=[];
  if(nextLabel)parts.push(`${prefix}: ${nextLabel}`);
  if(includeRemaining)parts.push(`${remaining} ${remaining===1?'μέρα':'μέρες'} ακόμα`);
  return parts.join(' · ');
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
function dailyTotal(){return getCurrentCycleDailyExpenses().reduce((s,e)=>s+(Number(e.amount)||0),0)}
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

function isSavingsSource(source){
  if(!source)return false;
  return !!source.isSavings || source.restriction==='locked' || source.restriction==='investment' || source.category==='Αποταμίευση';
}

function isRestrictedPaymentSource(source){
  if(!source)return false;
  if(isSavingsSource(source))return false;
  return !!(source.restriction && source.restriction!=='none');
}

function savingsIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>isSavingsSource(i))
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>isRestrictedPaymentSource(i))
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
  return getCurrentCycleDailyExpenses()
    .filter(e=>!e.paymentSourceId)
    .reduce((s,e)=>s+(Number(e.amount)||0),0);
}

function totalRestrictedCoverage(){
  return (D.incomeSources||[])
    .filter(i=>isRestrictedPaymentSource(i))
    .reduce((sum,i)=>sum+restrictedCoverageFor(i),0);
}

function remainingRestrictedAmount(source){
  return Math.max(
    0,
    (Number(source.amount)||0)-restrictedCoverageFor(source)
  );
}

function refreshComputedIncome(){
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  D.income = cycle?getCycleIncomeTotal(cycle):budgetIncomeTotal();
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
