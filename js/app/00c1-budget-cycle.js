// CAPVO app split: 00c-budget-engine.js
// Part 1: Helpers + Budget Cycle helpers
// Source: 00c-budget-engine.js lines 1-175

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


// ===== END 00c-budget-engine.js =====
