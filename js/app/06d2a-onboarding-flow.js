// CAPVO app split: 06d2-onboarding.js
// Onboarding: wizard, helpers, onboarding flow
// Source: 06d2-onboarding.js lines 1-863

// CAPVO app split: 06d2-onboarding.js
// Onboarding: wizard, onboarding overlay, step HTML, styles, navigation
// Source: 06d-misc-ui.js lines 346-1792

function capvoHasBasicSetup(){
  const money=typeof capvoMoney==='function'?capvoMoney:(n=>Math.round(((Number(n)||0)+Number.EPSILON)*100)/100);
  if(typeof capvoPrimaryBudgetWallet==='function'){
    const w=capvoPrimaryBudgetWallet();
    if(w && money(Number(w.cycleIncomeAmount)||0)>0)return true;
  }
  const hasExtraBudget=(D.incomeSources||[]).some(s=>
    s && s.includeInBudget && money(Number(s.amount)||0)>0 &&
    (typeof capvoInferMoneySourceType==='function'?capvoInferMoneySourceType(s)!=='budget_cycle':true)
  );
  const hasDaily=Object.values(D.months||{}).some(m=>(m.daily||[]).length>0);
  return hasExtraBudget || hasDaily;
}

function capvoShouldShowOnboarding(){
  const prefs=D.preferences||{};
  if(prefs.onboardingCompleted || prefs.onboardingDismissed)return false;
  return !capvoHasBasicSetup();
}

async function capvoAfterUserDataLoaded(ownerId){
  try{
    if(typeof ensureDefaultGeneralSavingsGoal==='function'){
      await ensureDefaultGeneralSavingsGoal();
    }
  }catch(e){
    console.warn('[CAPVO] default savings bootstrap skipped',e);
  }

  if(capvoShouldShowOnboarding()){
    setTimeout(()=>openCapvoOnboardingWizard(),180);
  }
  setTimeout(()=>updateCapvoDashboardSetupPrompt(),260);
}

function capvoEnsureOnboardingOverlay(){
  let overlay=document.getElementById('capvoOnboardingOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='capvoOnboardingOverlay';
  overlay.className='capvo-onboarding-overlay';
  overlay.onclick=e=>{
    if(e.target===overlay){
      // Do not close by accidental outside tap; onboarding is important.
      const sheet=overlay.querySelector('.capvo-onboarding-sheet');
      if(sheet)sheet.classList.add('shake');
      setTimeout(()=>sheet?.classList.remove('shake'),260);
    }
  };
  document.body.appendChild(overlay);
  return overlay;
}

function capvoWizardDefaultState(){
  const prefs=D.preferences||{};
  const general=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||{};
  return {
    step:0,
    cycleType:prefs.budgetCycleType||'fixed_day',
    cycleDay:prefs.budgetCycleStartDay||1,
    salaryName:'Κύριος λογαριασμός',
    walletType:'bank',
    walletBalance:'',
    spendingLimit:'',
    salaryAmount:'',
    ticketAmount:'',
    voucherAmount:'',
    fixed:[
      {name:'',amount:'',category:'Στέγαση',dueDay:String(prefs.budgetCycleStartDay||1),todayStatus:'unpaid'}
    ],
    savingsName:general.name||'Στόχοι',
    savingsIcon:general.icon||'💰'
  };
}


const CAPVO_WIZARD_FIXED_CATEGORIES=['Στέγαση','Λογαριασμοί','Συνδρομές','Μεταφορά','Δάνεια','Υγεία','Τρόφιμα','Φαγητό έξω','Αποταμίευση','Άλλο'];

function capvoWizardNormalizeFixedCategory(value){
  const raw=String(value||'').trim();
  const legacy={
    'Σπίτι':'Στέγαση',
    'Πάγια':'Άλλο',
    'Λογαριασμός':'Λογαριασμοί',
    'Συνδρομή':'Συνδρομές',
    'Δάνειο':'Δάνεια',
    'Φαγητό':'Φαγητό έξω'
  };
  const normalized=legacy[raw]||raw;
  return CAPVO_WIZARD_FIXED_CATEGORIES.includes(normalized) ? normalized : 'Άλλο';
}

function capvoWizardFixedCategoryOptions(selected){
  const current=capvoWizardNormalizeFixedCategory(selected||'Άλλο');
  return CAPVO_WIZARD_FIXED_CATEGORIES.map(cat=>{
    const icon=(typeof CEMO==='object' && CEMO && CEMO[cat]) ? CEMO[cat] : '📌';
    return `<option value="${esc(cat)}" ${cat===current?'selected':''}>${icon} ${esc(cat)}</option>`;
  }).join('');
}

function openCapvoOnboardingWizard(step){
  capvoEnsureDefaultSavingsQuietly();
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  if(typeof step==='number')window.__capvoOnboarding.step=step;
  renderCapvoOnboardingWizard();
}

function closeCapvoOnboardingWizard(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open','onboarding-open');
}


function capvoWizardMoney(value){
  if(value===null || value===undefined)return 0;
  const raw=String(value).trim().replace(/\s+/g,'').replace(',','.');
  const num=Number(raw);
  return Number.isFinite(num) ? capvoMoney(num) : 0;
}

function capvoWizardBudgetAmount(s){
  return capvoWizardMoney(s?.salaryAmount);
}

function capvoWizardSpendingLimitAmount(s){
  return capvoWizardMoney(s?.spendingLimit);
}

function capvoWizardEffectiveBudgetLimit(s){
  const salary=capvoWizardBudgetAmount(s);
  const limit=capvoWizardSpendingLimitAmount(s);
  if(limit>0 && salary>0)return Math.min(limit,salary);
  return salary;
}

function capvoWizardFixedAmountRaw(row){
  return String(row?.amount ?? '').trim();
}

function capvoWizardFixedAmountValue(row){
  const raw=capvoWizardFixedAmountRaw(row);
  if(!raw)return 0;
  return capvoWizardMoney(raw);
}

function capvoWizardFixedDueDayValue(row,s){
  const raw=String(row?.dueDay ?? '').trim();
  const fallback=capvoWizardDefaultFixedDueDay(s);
  if(!raw)return fallback;
  const parsed=Number(raw.replace(/[^0-9]/g,''));
  if(!Number.isFinite(parsed))return fallback;
  return typeof capvoClampCycleDay==='function'
    ? capvoClampCycleDay(parsed)
    : Math.min(31,Math.max(1,parsed));
}

function capvoWizardTodayDay(){
  return new Date().getDate();
}

function capvoWizardFixedIsDueToday(row,s){
  return capvoWizardFixedDueDayValue(row,s) === capvoWizardTodayDay();
}

function capvoWizardFixedTodayStatus(row){
  const raw=String(row?.todayStatus||'unpaid').trim();
  return raw === 'paid' ? 'paid' : 'unpaid';
}

function capvoWizardFixedRowHasUserInput(row){
  const rawAmount=capvoWizardFixedAmountRaw(row);
  const rawName=String(row?.name ?? '').trim();
  const rawCategory=String(row?.category ?? '').trim();
  return !!rawAmount || !!rawName || !!rawCategory;
}

function capvoWizardFixedRowsForSave(s){
  return (Array.isArray(s?.fixed)?s.fixed:[])
    .map((row,idx)=>({
      idx,
      name:String(row?.name||'').trim(),
      amountRaw:capvoWizardFixedAmountRaw(row),
      amount:capvoWizardFixedAmountValue(row),
      category:capvoWizardNormalizeFixedCategory(row?.category||'Άλλο'),
      dueDay:capvoWizardFixedDueDayValue(row,s),
      todayStatus:capvoWizardFixedTodayStatus(row)
    }))
    .filter(row=>row.amountRaw || row.amount>0 || row.name);
}

function capvoWizardFixedTotal(s){
  return capvoWizardFixedRowsForSave(s)
    .filter(row=>row.amount>0)
    .reduce((sum,row)=>sum+row.amount,0);
}

function capvoWizardMarkFixedRow(idx,field='amount'){
  try{
    const amount=document.getElementById(`obFixed${idx}Amount`);
    const name=document.getElementById(`obFixed${idx}Name`);
    const category=document.getElementById(`obFixed${idx}Category`);
    const dueDay=document.getElementById(`obFixed${idx}DueDay`);
    [amount,name,category,dueDay].forEach(el=>{ if(el)el.style.borderColor=''; });
    const target=field==='name'?name:(field==='category'?category:(field==='dueDay'?dueDay:amount));
    if(target){
      target.style.borderColor='var(--red)';
      target.focus?.();
    }
  }catch(e){}
}


function capvoWizardWalletBalanceAmount(s){
  return capvoWizardMoney(s?.walletBalance);
}

function capvoWizardDeterministicUuid(input){
  const str=String(input||'capvo');
  let h1=0x811c9dc5, h2=0x01000193, h3=0x9e3779b9, h4=0x85ebca6b;
  for(let i=0;i<str.length;i++){
    const c=str.charCodeAt(i);
    h1=Math.imul(h1^c,0x01000193)>>>0;
    h2=Math.imul(h2+c,0x85ebca6b)>>>0;
    h3=Math.imul(h3^((c+i)&255),0xc2b2ae35)>>>0;
    h4=Math.imul(h4+(c<<1),0x27d4eb2d)>>>0;
  }
  const hex=n=>(n>>>0).toString(16).padStart(8,'0');
  const raw=(hex(h1)+hex(h2)+hex(h3)+hex(h4)).slice(0,32).split('');
  raw[12]='4';
  raw[16]=(['8','9','a','b'][parseInt(raw[16]||'0',16)%4]);
  const s=raw.join('');
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20,32)}`;
}

function capvoWizardPrimaryWalletIcon(type){
  return type==='cash'?'💵':'🏦';
}

function capvoWizardPrimaryWalletColor(type){
  return type==='cash'?'#10b981':'#6547f6';
}

function capvoWizardNextCycleStartKey(s){
  // Fixed expenses created during onboarding are only scheduled obligations.
  // They start from next month so the initial wallet balance is never reduced
  // just because the user completed the wizard.
  const today=new Date();
  const candidate=new Date(today.getFullYear(),today.getMonth()+1,1,12);
  return typeof capvoDateKey==='function'
    ? capvoDateKey(candidate)
    : candidate.toISOString().slice(0,10);
}

function capvoWizardDefaultFixedDueDay(s){
  if(String(s?.cycleType||'fixed_day')==='fixed_day'){
    return typeof capvoClampCycleDay==='function'
      ? capvoClampCycleDay(s?.cycleDay||1)
      : Math.min(31,Math.max(1,Number(s?.cycleDay)||1));
  }
  // Last-working-day is supported for salary reminders, not for each fixed expense.
  // Keep onboarding simple: default fixed expenses to the 1st and let the user
  // fine-tune them later from Πάγια & Υποχρεώσεις.
  return 1;
}

function capvoWizardNextMonthlyDueDateKeyForDay(dueDay,options={}){
  const today=new Date();
  const todayKey=typeof capvoDateKey==='function' ? capvoDateKey(today) : today.toISOString().slice(0,10);
  let year=today.getFullYear();
  let month=today.getMonth();

  const build=(y,m)=>{
    const days=typeof capvoDaysInMonth==='function'
      ? capvoDaysInMonth(y,m)
      : new Date(y,m+1,0).getDate();
    const safeDay=Math.min(Math.max(1,Number(dueDay)||1),days);
    return typeof capvoDateKeyFromParts==='function'
      ? capvoDateKeyFromParts(y,m,safeDay)
      : new Date(y,m,safeDay,12).toISOString().slice(0,10);
  };

  let candidate=build(year,month);
  // Wizard setup starts from the user's current reality.
  // Past days go to next month. Future days stay in current month.
  // If the due day is today and the user says it was already paid, start next month.
  if(candidate < todayKey || (candidate === todayKey && options.skipToday)){
    month+=1;
    if(month>11){month=0;year+=1;}
    candidate=build(year,month);
  }
  return candidate;
}

function capvoWizardNextMonthlyDueDateKey(s){
  return capvoWizardNextMonthlyDueDateKeyForDay(capvoWizardDefaultFixedDueDay(s));
}

function capvoWizardFixedDefaults(s,primaryWalletId,row={}){
  const dueDay=capvoWizardFixedDueDayValue(row,s);
  const alreadyPaidToday=capvoWizardFixedIsDueToday(row,s) && capvoWizardFixedTodayStatus(row)==='paid';
  const nextDueDate=capvoWizardNextMonthlyDueDateKeyForDay(dueDay,{skipToday:alreadyPaidToday});

  // The onboarding wizard represents the user's current reality from today onward.
  // A future due day in the current month must appear in the current calendar;
  // a past/already-paid day starts from the next scheduled occurrence.
  return {
    scheduleType:'monthly',
    dueDay,
    nextDueDate,
    effectiveFromDate:nextDueDate,
    sourceWalletId:String(primaryWalletId||''),
    autoPay:false,
    deletedAt:null
  };
}

function capvoWizardFixedStableSuffix(row){
  const raw=`${row?.idx||0}|${row?.name||''}|${row?.category||''}|${row?.dueDay||''}`;
  const hash=capvoWizardDeterministicUuid(raw).replace(/-/g,'').slice(0,12);
  return `fixed_${row?.idx||0}_${hash}`;
}

async function capvoSoftDeleteObsoleteOnboardingFixedExpenses(ownerUserId,keepIds=[]){
  try{
    const keep=new Set((keepIds||[]).map(String));
    const {data,error}=await supabaseClient
      .from('fixed_expenses')
      .select('id,deleted_at')
      .eq('user_id',ownerUserId)
      .like('id','ob_fixed_%');
    if(error)throw error;
    const now=new Date().toISOString();
    const obsolete=(data||[]).filter(r=>!r.deleted_at && !keep.has(String(r.id)));
    for(const row of obsolete){
      const {error:updateError}=await supabaseClient
        .from('fixed_expenses')
        .update({deleted_at:now,updated_at:now})
        .eq('user_id',ownerUserId)
        .eq('id',row.id);
      if(updateError)throw updateError;
    }
  }catch(e){
    console.warn('[CAPVO] onboarding obsolete fixed cleanup skipped',e?.message||e);
  }
}

function capvoWizardValidateBudgetStep(s,{focus=true}={}){
  const amount=capvoWizardBudgetAmount(s);
  const balance=capvoWizardWalletBalanceAmount(s);
  const name=String(s?.salaryName||'').trim();

  if(!name){
    showMiniToast('Βάλε όνομα για τον βασικό λογαριασμό σου.','error');
    if(focus)document.getElementById('obSalaryName')?.focus();
    return false;
  }

  if(balance<0){
    showMiniToast('Το αρχικό υπόλοιπο δεν μπορεί να είναι αρνητικό.','error');
    if(focus)document.getElementById('obWalletBalance')?.focus();
    return false;
  }

  if(amount<=0){
    showMiniToast('Βάλε τον βασικό μισθό / ποσό μήνα για να συνεχίσεις.','error');
    if(focus)document.getElementById('obSalaryAmount')?.focus();
    return false;
  }

  return true;
}

function capvoWizardValidateFixedStep(s,{focus=true}={}){
  const rows=capvoWizardFixedRowsForSave(s);

  for(const row of rows){
    const original=(Array.isArray(s?.fixed)?s.fixed:[])[row.idx]||{};
    const hasExplicitAmount=!!row.amountRaw;
    const nameEdited=String(original?.name||'').trim();

    if(!hasExplicitAmount && !nameEdited){
      continue;
    }

    if(hasExplicitAmount){
      const raw=String(row.amountRaw).replace(',','.');
      const parsed=Number(raw);
      if(!Number.isFinite(parsed)){
        showMiniToast('Βάλε έγκυρο ποσό για το πάγιο ή άφησέ το κενό.','error');
        if(focus)capvoWizardMarkFixedRow(row.idx,'amount');
        return false;
      }
      if(parsed<=0){
        showMiniToast('Το ποσό παγίου πρέπει να είναι μεγαλύτερο από 0 ή να μείνει κενό.','error');
        if(focus)capvoWizardMarkFixedRow(row.idx,'amount');
        return false;
      }
      if(parsed>999999){
        showMiniToast('Το ποσό παγίου φαίνεται υπερβολικά μεγάλο. Έλεγξε την τιμή.','error');
        if(focus)capvoWizardMarkFixedRow(row.idx,'amount');
        return false;
      }
      if(!row.name){
        showMiniToast('Βάλε όνομα για το πάγιο που έχει ποσό.','error');
        if(focus)capvoWizardMarkFixedRow(row.idx,'name');
        return false;
      }
      if(row.dueDay<1 || row.dueDay>31){
        showMiniToast('Η ημέρα πληρωμής παγίου πρέπει να είναι από 1 έως 31.','error');
        if(focus)capvoWizardMarkFixedRow(row.idx,'dueDay');
        return false;
      }
    }
  }

  const base=capvoWizardEffectiveBudgetLimit(s);
  const fixed=capvoWizardFixedTotal(s);
  if(base>0 && fixed>base){
    const availableLabel=typeof fmt==='function'?fmt(base):`€${base.toFixed(2)}`;
    const fixedLabel=typeof fmt==='function'?fmt(fixed):`€${fixed.toFixed(2)}`;
    showMiniToast(`Τα πάγια (${fixedLabel}) ξεπερνούν το διαθέσιμο budget (${availableLabel}).`,'error');
    if(focus){
      const firstPositive=rows.find(row=>row.amount>0);
      capvoWizardMarkFixedRow(firstPositive?.idx ?? 0,'amount');
    }
    return false;
  }
  return true;
}

function capvoEnsureDefaultSavingsQuietly(){
  try{
    if(typeof ensureDefaultGeneralSavingsGoal!=='function')return;
    const owner=getFinanceUserId?.() || getDataOwnerId?.();
    if(!owner)return;
    if(window.__capvoEnsuringDefaultSavings)return;
    if(typeof getDefaultGeneralSavingsGoal==='function' && getDefaultGeneralSavingsGoal())return;
    window.__capvoEnsuringDefaultSavings=true;
    Promise.resolve(ensureDefaultGeneralSavingsGoal())
      .catch(e=>console.warn('[CAPVO] default savings bootstrap skipped',e))
      .finally(()=>{window.__capvoEnsuringDefaultSavings=false;});
  }catch(e){
    window.__capvoEnsuringDefaultSavings=false;
    console.warn('[CAPVO] default savings bootstrap skipped',e);
  }
}

function capvoOnboardingUpdateFromInputs(){
  const s=window.__capvoOnboarding||capvoWizardDefaultState();
  const get=id=>document.getElementById(id);
  if(get('obCycleTypeFixed')||get('obCycleTypeLast')){
    s.cycleType=get('obCycleTypeLast')?.checked?'last_working_day':'fixed_day';
    const cycleDayInput=get('obCycleDay');
    const nextCycleDay=readBudgetCycleDayInput(cycleDayInput,s.cycleDay||1);
    if(nextCycleDay!==null)s.cycleDay=nextCycleDay;
  }
  if(get('obSalaryAmount')){
    s.walletType=get('obPrimaryWalletCash')?.checked?'cash':'bank';
    const fallbackName=s.walletType==='cash'?'Μετρητά':'Κύριος λογαριασμός';
    s.salaryName=(get('obSalaryName')?.value||fallbackName).trim()||fallbackName;
    s.walletBalance=get('obWalletBalance')?.value||'';
    s.salaryAmount=get('obSalaryAmount')?.value||'';
    s.spendingLimit='';
  }
  if(get('obTicketAmount')||get('obVoucherAmount')){
    s.ticketAmount=get('obTicketAmount')?.value||'';
    s.voucherAmount=get('obVoucherAmount')?.value||'';
  }
  if(get('obFixed0Amount')){
    s.fixed=(s.fixed||[]).map((row,idx)=>({
      name:(get(`obFixed${idx}Name`)?.value||row.name||'').trim(),
      amount:get(`obFixed${idx}Amount`)?.value||'',
      category:capvoWizardNormalizeFixedCategory(get(`obFixed${idx}Category`)?.value||row.category||'Άλλο'),
      dueDay:String(readBudgetCycleDayInput(get(`obFixed${idx}DueDay`),row.dueDay||capvoWizardDefaultFixedDueDay(s)) || row.dueDay || capvoWizardDefaultFixedDueDay(s)),
      todayStatus:get(`obFixed${idx}TodayPaid`)?.checked ? 'paid' : 'unpaid'
    }));
  }
  if(get('obSavingsName')){
    s.savingsName=(get('obSavingsName')?.value||'Στόχοι').trim()||'Στόχοι';
    s.savingsIcon=(get('obSavingsIcon')?.value||'💰').trim()||'💰';
  }
  window.__capvoOnboarding=s;
  return s;
}


function capvoOnboardingAddFixedRow(){
  const s=capvoOnboardingUpdateFromInputs();
  s.fixed=Array.isArray(s.fixed)?s.fixed:[];
  s.fixed.push({name:'',amount:'',category:'Άλλο',dueDay:String(capvoWizardDefaultFixedDueDay(s)),todayStatus:'unpaid'});
  window.__capvoOnboarding=s;
  renderCapvoOnboardingWizard();
  setTimeout(()=>{
    const idx=Math.max(0,s.fixed.length-1);
    document.getElementById(`obFixed${idx}Name`)?.focus?.();
  },40);
}

function capvoOnboardingRemoveFixedRow(idx){
  const s=capvoOnboardingUpdateFromInputs();
  s.fixed=Array.isArray(s.fixed)?s.fixed:[];
  const removeIdx=Number(idx);
  if(!Number.isFinite(removeIdx) || removeIdx<0 || removeIdx>=s.fixed.length)return;
  s.fixed.splice(removeIdx,1);
  if(!s.fixed.length){
    s.fixed.push({name:'',amount:'',category:'Στέγαση',dueDay:String(capvoWizardDefaultFixedDueDay(s)),todayStatus:'unpaid'});
  }
  window.__capvoOnboarding=s;
  renderCapvoOnboardingWizard();
}

function capvoPersistOnboardingStep(step){
  const numericStep=Math.max(0,Math.min(5,Number(step)||0));
  if(D.preferences){
    D.preferences.onboardingStep=String(numericStep);
  }
  // Fire-and-forget: step resume should never block UI navigation.
  try{
    capvoUpsertUserPreferencePatch({onboarding_step:String(numericStep)}).catch(e=>{
      console.warn('[CAPVO] onboarding step save skipped',e);
    });
  }catch(e){
    console.warn('[CAPVO] onboarding step save skipped',e);
  }
}



function capvoCurrentCycleLabelSafe(){
  try{
    const cycle = typeof getCurrentBudgetCycle === 'function' ? getCurrentBudgetCycle() : null;
    if(cycle?.startKey && cycle?.endKey){
      if(typeof formatBudgetCycleDateRange === 'function'){
        return formatBudgetCycleDateRange(cycle.startKey, cycle.endKey);
      }
      return `${cycle.startKey} – ${cycle.endKey}`;
    }
  }catch(e){}
  return 'Τρέχουσα περίοδος';
}


function capvoSetWizardStep(step){
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  window.__capvoOnboarding.step=step;
  renderCapvoOnboardingWizard();
}

function showCapvoOnboardingCompletion(){
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  window.__capvoOnboarding.step=5;
  renderCapvoOnboardingWizard();
}

function capvoGoToDashboardAfterOnboarding(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  document.body.classList.add('capvo-wizard-to-dashboard-transition');

  if(overlay){
    overlay.classList.add('capvo-wizard-dashboard-outro');
  }

  setTimeout(()=>{
    closeCapvoOnboardingWizard();
    try{
      go('vDash',document.querySelector('[data-v="vDash"]'));
      window.scrollTo({top:0,left:0,behavior:'auto'});
    }catch(e){}

    document.body.classList.add('capvo-dashboard-soft-enter');

    setTimeout(()=>{
      document.body.classList.remove('capvo-wizard-to-dashboard-transition','capvo-dashboard-soft-enter');
    },520);
  },260);
}

function capvoOnboardingStepHtml(s){
  const step=Math.max(0,Math.min(5,Number(s.step)||0));
  const steps=[
    {label:'Περίοδος', icon:'1'},
    {label:'Wallet', icon:'2'},
    {label:'Πάγια', icon:'3'},
    {label:'Δυνατότητες', icon:'4'},
    {label:'Telegram', icon:'5'},
    {label:'Τέλος', icon:'✓'}
  ];
  const isLast=s.cycleType==='last_working_day';
  const day=Number(s.cycleDay||1);

  const stepper=()=>`<div class="ob-pro-stepper ob-pro-stepper-six" aria-label="CAPVO onboarding progress">${steps.map((item,idx)=>`
    <div class="ob-pro-step ${idx<step?'done':idx===step?'active':'upcoming'}">
      <span>${idx<step?'✓':item.icon}</span>
      ${idx<steps.length-1?'<i></i>':''}
      <small>${item.label}</small>
    </div>`).join('')}</div>`;

  const shell=(title,subtitle,body,actions='',opts={})=>`<section class="capvo-onboarding-sheet ob-stepper-pro ${opts.extraClass||''}" onclick="event.stopPropagation()">
    <div class="ob-pro-header">
      <button type="button" class="ob-pro-back ${step===0||step===5?'is-hidden':''}" onclick="capvoOnboardingPrev()" aria-label="Πίσω">‹</button>
      <div class="ob-pro-brand"><img src="assets/capvo-mark.png" alt="CAPVO" onerror="this.style.display='none'"><strong>CAPVO</strong></div>
      <button type="button" class="ob-pro-skip ${step===5?'is-hidden':''}" onclick="skipCapvoOnboarding()">Παράλειψη</button>
    </div>
    ${stepper()}
    <div class="ob-pro-step-status">Βήμα ${step+1} από ${steps.length} · ${esc(steps[step]?.label||'')}</div>
    <div class="ob-pro-copy">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
    <div class="capvo-onboarding-body ob-pro-body">${body}</div>
    ${actions}
    <div class="ob-pro-footnote">${step===5?'Η ρύθμιση αποθηκεύτηκε στον λογαριασμό σου.':'Μπορείς να επιστρέψεις ή να αλλάξεις τα πάντα αργότερα.'}</div>
  </section>`;

  const triActions=(primaryText='Συνέχεια', primaryAction='capvoOnboardingNext()')=>`<div class="ob-pro-actions two">
      <button type="button" class="ob-pro-secondary" onclick="capvoOnboardingPrev()">Πίσω</button>
      <button type="button" class="ob-pro-primary" onclick="${primaryAction}">${primaryText} <span>→</span></button>
    </div>`;

  if(step===0){
    return shell(
      'Καλωσόρισες στο CAPVO',
      'Πες μας πότε πληρώνεσαι, για να υπολογίζουμε σωστά το διαθέσιμο ποσό μέχρι την επόμενη πληρωμή.',
      `
      <div class="ob-pro-card hero ob-pro-welcome-exact">
        <div class="ob-pro-card-head">
          <div>
            <span>1ο βήμα</span>
            <h3>Ορισμός μηνιαίας περιόδου</h3>
            <p>Τα reports θα γίνονται μήνα-μήνα. Η ημέρα πληρωμής μένει ως υπενθύμιση/μισθός.</p>
          </div>
          <div class="ob-pro-hero-icon premium-cycle" aria-hidden="true"></div>
        </div>

        <div class="ob-pro-benefits">
          <div><i class="premium-mini-icon calendar"></i><strong>Οργανώνει το budget και τα reports ανά μήνα.</strong></div>
          <div><i class="premium-mini-icon chart"></i><strong>Υπολογίζει πόσα μπορείς να ξοδεύεις κάθε μέρα.</strong></div>
          <div><i class="premium-mini-icon target"></i><strong>Δείχνει καθαρά υπόλοιπο, πρόοδο και υπερβάσεις.</strong></div>
        </div>

        <div class="ob-pro-cycle-editor">
          <label class="ob-pro-label">Τρόπος πληρωμής</label>
          <div class="ob-pro-pill-grid two">
            <label class="ob-pro-pill ${!isLast?'selected':''}" data-cycle-type="fixed_day">
              <input type="radio" name="obCycleType" id="obCycleTypeFixed" value="fixed_day" ${!isLast?'checked':''}>
              <strong>Συγκεκριμένη ημέρα</strong>
              <small>π.χ. κάθε 8 του μήνα</small>
            </label>
            <label class="ob-pro-pill ${isLast?'selected':''}" data-cycle-type="last_working_day">
              <input type="radio" name="obCycleType" id="obCycleTypeLast" value="last_working_day" ${isLast?'checked':''}>
              <strong>Τελευταία εργάσιμη</strong>
              <small>με weekends & αργίες</small>
            </label>
          </div>

          <div class="ob-pro-day-input-wrap ${isLast?'is-disabled':''}">
            <label class="ob-pro-label" for="obCycleDay">Ημέρα πληρωμής</label>
            <div class="ob-pro-day-input">
              <input id="obCycleDay" type="text" min="1" max="31" maxlength="2" pattern="[0-9]*" inputmode="numeric" value="${esc(s.cycleDay||1)}" ${isLast?'disabled':''}>
              <span>του μήνα</span>
            </div>
            <div class="ob-pro-inline-note">${isLast?'Δεν χρειάζεται ημέρα. Το CAPVO θα βρίσκει αυτόματα την τελευταία εργάσιμη.':'Γράψε την ημέρα του μήνα από 1 έως 31, π.χ. 8 ή 28.'}</div>
          </div>
        </div>
      </div>`,
      `<div class="ob-pro-actions single"><button type="button" class="ob-pro-primary" onclick="capvoOnboardingNext()">Συνέχεια <span>→</span></button></div>`
    );
  }

  if(step===1){
    const walletType=s.walletType==='cash'?'cash':'bank';
    const isCash=walletType==='cash';
    const walletName=(s.salaryName||'').trim() || (isCash?'Μετρητά':'Κύριος λογαριασμός');
    return shell(
      'Βασικός λογαριασμός & μισθός',
      'Πες μας πού μπαίνει ο βασικός μισθός σου και πόσα χρήματα έχεις ήδη εκεί σήμερα.',
      `
      <div class="ob-pro-card budget ob-wallet-budget-card">
        <div class="ob-wallet-visual">
          <div class="ob-wallet-visual-card ${isCash?'cash':'bank'}">
            <span>${isCash?'💵':'🏦'}</span>
            <strong>${esc(walletName)}</strong>
            <small>${isCash?'Μετρητά':'Τράπεζα / κάρτα'} · primary budget</small>
          </div>
          <div class="ob-wallet-visual-copy">
            <b>Αυτό θα γίνει το βασικό σου budget wallet.</b>
            <span>Ο μισθός θα μπαίνει εδώ όταν κάνεις “Καταχώρηση μισθού”.</span>
          </div>
        </div>

        <label class="ob-pro-small-label">Πού μπαίνει ο βασικός μισθός σου;</label>
        <div class="ob-pro-pill-grid two ob-wallet-type-grid">
          <label class="ob-pro-pill ${!isCash?'selected':''}">
            <input type="radio" name="obPrimaryWalletType" id="obPrimaryWalletBank" value="bank" ${!isCash?'checked':''} onchange="capvoOnboardingUpdateFromInputs();renderCapvoOnboardingWizard();">
            <strong>Τράπεζα / κάρτα</strong>
            <small>π.χ. Alpha, Eurobank, Revolut</small>
          </label>
          <label class="ob-pro-pill ${isCash?'selected':''}">
            <input type="radio" name="obPrimaryWalletType" id="obPrimaryWalletCash" value="cash" ${isCash?'checked':''} onchange="capvoOnboardingUpdateFromInputs();renderCapvoOnboardingWizard();">
            <strong>Μετρητά</strong>
            <small>αν πληρώνεσαι στο χέρι</small>
          </label>
        </div>

        <label class="ob-pro-inline-input">
          <span>Όνομα λογαριασμού</span>
          <input id="obSalaryName" type="text" value="${esc(walletName)}" placeholder="${isCash?'Μετρητά':'π.χ. Alpha, Eurobank, Revolut'}">
        </label>

        <label class="ob-pro-inline-input">
          <span>Τρέχον υπόλοιπο σήμερα <small>πριν τον νέο μισθό</small></span>
          <input id="obWalletBalance" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.walletBalance||'')}" placeholder="π.χ. 150">
        </label>

        <label class="ob-pro-small-label">Μισθός / ποσό μήνα</label>
        <label class="ob-pro-budget-box">
          <div class="ob-pro-currency">€</div>
          <input id="obSalaryAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.salaryAmount||'')}" placeholder="π.χ. 1500">
          <small>Θα προστίθεται στο ${esc(walletName)} όταν κάνεις “Καταχώρηση μισθού”.</small>
        </label>

        <div class="ob-pro-toggle-panel">
          <strong>Primary budget wallet</strong>
          <small>Μετράει στο διαθέσιμο budget και είναι ο βασικός λογαριασμός μήνα.</small>
          <div class="ob-pro-toggle-on"></div>
        </div>

        <div class="ob-pro-optional-card">
          <span>Προαιρετικά Ticket / Voucher</span>
          <div class="ob-pro-inline-two">
            <label><small>Ticket</small><input id="obTicketAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.ticketAmount||'')}" placeholder="0,00"></label>
            <label><small>Voucher</small><input id="obVoucherAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.voucherAmount||'')}" placeholder="0,00"></label>
          </div>
        </div>
      </div>`,
      triActions('Συνέχεια','capvoOnboardingNext()')
    );
  }

  if(step===2){
    const allFixedRows=Array.isArray(s.fixed)?s.fixed:[];
    const rows=allFixedRows.map((row,idx)=>{
      const iconClass=idx===0?'home':idx===1?'wifi':'repeat';
      const category=capvoWizardNormalizeFixedCategory(row.category||'Άλλο');
      const dueDay=esc(String(row.dueDay||capvoWizardDefaultFixedDueDay(s)));
      const isDueToday=capvoWizardFixedIsDueToday(row,s);
      const todayStatus=capvoWizardFixedTodayStatus(row);
      const removeBtn=idx>0 ? `<button type="button" class="ob-pro-fixed-remove" aria-label="Αφαίρεση παγίου" onclick="capvoOnboardingRemoveFixedRow(${idx})">×</button>` : '';
      const todayDecision=isDueToday ? `
          <div class="ob-pro-fixed-today-choice">
            <div class="ob-pro-fixed-today-head">
              <strong>Λήγει σήμερα</strong>
              <span>Τι ισχύει;</span>
            </div>
            <div class="ob-pro-fixed-today-options">
              <label class="${todayStatus!=='paid'?'selected':''}">
                <input type="radio" name="obFixed${idx}TodayStatus" id="obFixed${idx}TodayUnpaid" value="unpaid" ${todayStatus!=='paid'?'checked':''}>
                <span>Όχι ακόμα</span>
              </label>
              <label class="${todayStatus==='paid'?'selected':''}">
                <input type="radio" name="obFixed${idx}TodayStatus" id="obFixed${idx}TodayPaid" value="paid" ${todayStatus==='paid'?'checked':''}>
                <span>Πληρώθηκε</span>
              </label>
            </div>
          </div>` : '';
      return `<div class="ob-pro-fixed-row ob-pro-fixed-row-with-category ob-pro-fixed-row-scheduled">
        ${removeBtn}
        <i class="premium-mini-icon ${iconClass}" aria-hidden="true"></i>
        <div class="ob-pro-fixed-main">
          <input id="obFixed${idx}Name" type="text" value="${esc(row.name||'')}" placeholder="π.χ. Ενοίκιο, Internet, Netflix">
          <div class="ob-pro-fixed-meta">
            <select id="obFixed${idx}Category" class="ob-pro-fixed-category" aria-label="Κατηγορία παγίου">${capvoWizardFixedCategoryOptions(category)}</select>
            <input id="obFixed${idx}Amount" class="ob-pro-fixed-amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(row.amount||'')}" placeholder="Ποσό">
          </div>
          <label class="ob-pro-fixed-due-inline">
            <span>Πληρώνεται κάθε μήνα στις</span>
            <input id="obFixed${idx}DueDay" class="ob-pro-fixed-due-day" type="text" inputmode="numeric" maxlength="2" value="${dueDay}" placeholder="1-31" onchange="capvoOnboardingUpdateFromInputs();renderCapvoOnboardingWizard();" onblur="capvoOnboardingUpdateFromInputs();renderCapvoOnboardingWizard();">
          </label>
          ${todayDecision}
        </div>
      </div>`;
    }).join('');
    return shell(
      'Σταθερές δαπάνες',
      'Προαιρετικό. Βάλε ένα βασικό πάγιο τώρα ή άφησέ το κενό και πρόσθεσε τα υπόλοιπα αργότερα.',
      `
      <div class="ob-pro-card fixed">
        <div class="ob-pro-tip">Τα πάγια είναι προγραμματισμένες υποχρεώσεις. Δεν αφαιρούν χρήματα τώρα. Θα εμφανιστούν στο ημερολόγιο και θα μειώσουν wallet μόνο όταν πατήσεις “Πληρώθηκε”.</div>
        <div class="ob-pro-fixed-stack">${rows}</div>
        <button type="button" class="ob-pro-add-fixed" onclick="capvoOnboardingAddFixedRow()">+ Προσθήκη άλλου παγίου</button>
        <div class="ob-pro-inline-note">Κράτα το wizard απλό: μπορείς να αλλάξεις wallet, ημέρα και συχνότητα μετά από τη σελίδα Πάγια & Υποχρεώσεις.</div>
      </div>`,
      triActions('Συνέχεια','capvoOnboardingNext()')
    );
  }

  if(step===3){
    return shell(
      'Τι άλλο θα βρεις στο CAPVO',
      'Μετά το setup μπορείς να χρησιμοποιήσεις περισσότερα εργαλεία για να ελέγχεις τα χρήματά σου.',
      `
      <div class="ob-pro-card features">
        <div class="ob-feature-grid">
          <div class="ob-feature-item"><i class="premium-mini-icon advisor"></i><strong>Σύμβουλος</strong><span>Δες αν κινείσαι σωστά μέσα στον κύκλο.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon reports"></i><strong>Αναφορές</strong><span>Καθαρή εικόνα για έξοδα και συνήθειες.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon savings"></i><strong>Στόχοι</strong><span>Κράτα χρήματα εκτός budget για στόχους.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon quick"></i><strong>Quick Add</strong><span>Γρήγορη καταχώρηση από κινητό.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon wallet"></i><strong>Πηγές πληρωμής</strong><span>Budget, Ticket, Voucher και κάρτες.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon cycle"></i><strong>Κύκλοι</strong><span>Έλεγχος μέχρι την επόμενη πληρωμή.</span></div>
        </div>
      </div>`,
      triActions('Συνέχεια','capvoOnboardingNext()')
    );
  }

  if(step===4){
    return shell(
      'Προαιρετική σύνδεση Telegram',
      'Σύνδεσε το Telegram Bot για να καταχωρείς έξοδα με μήνυμα ή φωνή, χωρίς να ανοίγεις την εφαρμογή.',
      `
      <div class="ob-pro-card telegram">
        <div class="ob-pro-telegram-orb premium-telegram" aria-hidden="true"></div>
        <p class="ob-pro-telegram-copy">Ιδανικό όταν είσαι έξω και θέλεις να περνάς γρήγορα κινήσεις όπως “καφές 3” ή “βενζίνη 20”. Αν δεν το θες τώρα, μπορείς να το συνδέσεις αργότερα από τις Ρυθμίσεις.</p>
        <div class="ob-pro-benefits three">
          <div><i class="premium-mini-icon chat"></i><strong>Γρήγορη καταχώρηση με μήνυμα</strong></div>
          <div><i class="premium-mini-icon voice"></i><strong>Καταχώρηση με φωνητικό</strong></div>
          <div><i class="premium-mini-icon sync"></i><strong>Αυτόματος συγχρονισμός στο CAPVO</strong></div>
        </div>
      </div>`,
      `<div class="ob-pro-actions telegram">
        <button type="button" class="ob-pro-primary" onclick="finishCapvoOnboarding(true)">Σύνδεση Telegram <span>→</span></button>
        <button type="button" class="ob-pro-secondary" onclick="finishCapvoOnboarding(false)">Παράλειψη και ολοκλήρωση</button>
        <button type="button" class="ob-pro-link wide" onclick="capvoOnboardingPrev()">Πίσω</button>
      </div>`
    );
  }

  return shell(
    'Το CAPVO είναι έτοιμο',
    'Η βασική ρύθμιση ολοκληρώθηκε. Μπορείς τώρα να ξεκινήσεις να καταχωρείς έξοδα και να παρακολουθείς το budget σου.',
    `
    <div class="ob-pro-card complete">
      <div class="ob-complete-mark"><span>✓</span></div>
      <div class="ob-complete-list">
        <div><i class="premium-mini-icon wallet"></i><strong>Ο βασικός λογαριασμός και ο μισθός σου αποθηκεύτηκαν.</strong></div>
        <div><i class="premium-mini-icon cycle"></i><strong>Ο οικονομικός κύκλος είναι έτοιμος.</strong></div>
        <div><i class="premium-mini-icon repeat"></i><strong>Τα πάγια αποθηκεύτηκαν ως προγραμματισμένες υποχρεώσεις, χωρίς να μειώσουν wallet.</strong></div>
        <div><i class="premium-mini-icon quick"></i><strong>Συνέχισε με Quick Add ή πρόσθεσε τα πρώτα σου έξοδα.</strong></div>
      </div>
    </div>`,
    `<div class="ob-pro-actions single">
      <button type="button" class="ob-pro-primary" onclick="capvoGoToDashboardAfterOnboarding()">Άνοιγμα Dashboard <span>→</span></button>
    </div>`,
    {extraClass:'ob-complete-screen'}
  );
}



// ===== END 06d2-onboarding.js =====
