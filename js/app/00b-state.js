// CAPVO app split: 00b-state.js
// Constants, D state, wallet helpers, category helpers, auth state
// Source: 00-core-state.js lines 38-372

// ===== DEBOUNCE UTILITY =====
function capvoDebounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
window.capvoDebouncedRenderDailyList = capvoDebounce(() => {
  if (typeof renderDailyList === 'function') renderDailyList();
}, 250);

// ===== SPA NAVIGATION CLEANUP =====
window.addEventListener('popstate', () => {
  if (typeof addCenterEditState !== 'undefined') addCenterEditState = null;
});

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
  fixedExpenseArchive:[],
  fixedExpensePayments:[],
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
  // Phase 2: Wallet model
  wallets:[],
  walletTransfers:[],
  expenseCategories:[]
};

// ===== WALLET HELPERS =====
function capvoWallets(){ return Array.isArray(D.wallets)?D.wallets:[]; }
function capvoActiveWallets(){ return capvoWallets().filter(w=>w.isActive!==false); }
function capvoDefaultWallet(){ return (typeof capvoPrimaryBudgetWallet==='function'?capvoPrimaryBudgetWallet():null) || capvoActiveWallets().find(w=>w.isDefault) || capvoActiveWallets()[0] || null; }
function capvoWalletById(id){ return capvoWallets().find(w=>String(w.id)===String(id))||null; }
function capvoWalletTotalBalance(){
  if(typeof capvoGetSpendableWalletTotal==='function'){
    return capvoMoney(capvoGetSpendableWalletTotal());
  }
  return capvoMoney(capvoActiveWallets()
    .filter(w=>w.includeInTotal!==false && !w.isSavings)
    .reduce((s,w)=>s+(Number(w.currentBalance)||0),0));
}
function capvoWalletHasAny(){ return capvoActiveWallets().length>0; }

function capvoPrimaryWalletCycleAmount(){
  const w=typeof capvoPrimaryBudgetWallet==='function'?capvoPrimaryBudgetWallet():capvoDefaultWallet();
  return capvoMoney(Number(w?.cycleIncomeAmount)||0);
}

function capvoHasWalletBudgetModel(){
  return typeof capvoActiveWallets==='function' && capvoActiveWallets().length>0;
}


// Wallet type config
const CAPVO_WALLET_TYPES = {
  bank:     { label:'Τράπεζα',    icon:'🏦', color:'#6547f6' },
  cash:     { label:'Μετρητά',    icon:'💵', color:'#10b981' },
  savings:  { label:'Αποταμίευση',icon:'💰', color:'#f59e0b' },
  prepaid:  { label:'Prepaid',    icon:'💳', color:'#3b82f6' },
  investment:{ label:'Επένδυση', icon:'📈', color:'#8b5cf6' },
  other:    { label:'Άλλο',       icon:'💼', color:'#94a3b8' }
};

// ===== CATEGORY HELPERS =====
function capvoCategories(){
  // Returns merged: DB categories (user + system) falling back to hardcoded CEMO
  if(Array.isArray(D.expenseCategories) && D.expenseCategories.length>0){
    return D.expenseCategories;
  }
  // Fallback to hardcoded while DB loads
  return Object.keys(CEMO).map((name,i)=>({
    id:name, name, icon:CEMO[name]||'📌',
    color:CCLR[name]||'#888780', cssClass:CCLS[name]||'cat-other',
    sortOrder:i, isSystem:true
  }));
}
function capvoCategoryByName(name){
  return capvoCategories().find(c=>c.name===name)||null;
}
function capvoCategoryIcon(name){
  const c=capvoCategoryByName(name);
  return c?c.icon:(CEMO[name]||'📌');
}
function capvoCategoryColor(name){
  const c=capvoCategoryByName(name);
  return c?c.color:(CCLR[name]||'#888780');
}
function capvoCategoryCssClass(name){
  const c=capvoCategoryByName(name);
  return c?c.cssClass:(CCLS[name]||'cat-other');
}

function capvoCategoryById(id){
  if(!id)return null;
  return capvoCategories().find(c=>String(c.id)===String(id))||null;
}
function capvoNormalizeTextKey(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}
function capvoRootCategories(){
  return capvoCategories()
    .filter(c=>!c.parentId)
    .sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0) || String(a.name||'').localeCompare(String(b.name||''),'el'));
}
function capvoSubcategories(parentId){
  if(!parentId)return [];
  return capvoCategories()
    .filter(c=>String(c.parentId||'')===String(parentId))
    .sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0) || String(a.name||'').localeCompare(String(b.name||''),'el'));
}
function capvoRootCategoryByName(name){
  const key=capvoNormalizeTextKey(name);
  return capvoRootCategories().find(c=>capvoNormalizeTextKey(c.name)===key)||null;
}
function capvoDefaultRootCategory(){
  return capvoRootCategoryByName('Τρόφιμα') || capvoRootCategoryByName('Άλλο') || capvoRootCategories()[0] || null;
}
function capvoCategoryTreeLabel(expense){
  const root=capvoCategoryById(expense?.categoryId||expense?.category_id)||capvoRootCategoryByName(expense?.category)||null;
  const sub=capvoCategoryById(expense?.subcategoryId||expense?.subcategory_id)||null;
  const rootName=root?.name||expense?.category||'Άλλο';
  if(sub && String(sub.parentId||'')===String(root?.id||''))return `${rootName} › ${sub.name}`;
  return rootName;
}
function capvoExpenseTitle(expense){
  const merchant=String(expense?.merchantName||expense?.merchant_name||'').trim();
  return merchant || expense?.name || 'Έξοδο';
}
function capvoExpenseSearchText(expense){
  return [
    expense?.name,
    expense?.merchantName||expense?.merchant_name,
    expense?.notes||expense?.note,
    capvoCategoryTreeLabel(expense),
    expense?.paymentSourceName||expense?.payment_source_name
  ].filter(Boolean).join(' ');
}
function capvoResolveExpenseCategoryMeta(expense){
  const rootById=capvoCategoryById(expense?.categoryId||expense?.category_id);
  const rootByName=capvoRootCategoryByName(expense?.category);
  let root=rootById && !rootById.parentId ? rootById : rootByName;
  if(!root)root=capvoDefaultRootCategory();

  let sub=capvoCategoryById(expense?.subcategoryId||expense?.subcategory_id);
  if(sub && root && String(sub.parentId||'')!==String(root.id||''))sub=null;

  return {
    categoryId:root?.id||null,
    categoryName:root?.name||expense?.category||'Άλλο',
    subcategoryId:sub?.id||null,
    subcategoryName:sub?.name||''
  };
}
function capvoApplyExpenseCategoryMeta(expense){
  if(!expense)return expense;
  const meta=capvoResolveExpenseCategoryMeta(expense);
  expense.categoryId=meta.categoryId;
  expense.category_id=meta.categoryId;
  expense.subcategoryId=meta.subcategoryId;
  expense.subcategory_id=meta.subcategoryId;
  expense.category=meta.categoryName;
  return expense;
}
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

// ===== END 00b-state.js =====
