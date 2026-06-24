// CAPVO app split: 00c-budget-engine.js
// Part 2: Holiday-aware cycles + salary + card + income calculations
// Source: 00c-budget-engine.js lines 176-1104

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


// getBudgetCycleStartDay v1 (duplicate) removed — v1.8.6.20.
// The version with try/catch and budget_cycle_start_day fallback above is canonical.

function getMonthlyBudgetPeriod(refDate=new Date()){
  const today=refDate instanceof Date?new Date(refDate.getFullYear(),refDate.getMonth(),refDate.getDate(),12):new Date();
  const start=new Date(today.getFullYear(),today.getMonth(),1,12);
  const nextStart=new Date(today.getFullYear(),today.getMonth()+1,1,12);
  const end=new Date(nextStart);
  end.setDate(end.getDate()-1);
  return {
    id:'month_'+capvoDateKey(start),
    start,
    end,
    nextStart,
    startKey:capvoDateKey(start),
    endKey:capvoDateKey(end),
    nextStartKey:capvoDateKey(nextStart),
    startDay:1,
    source:'month',
    note:'calendar_month',
    isGenerated:true,
    label:formatBudgetCycleLabel(start,end),
    periodType:'month'
  };
}


function getStandardBudgetCycle(refDate=new Date()){
  // v1.9.5.0: reporting period is calendar-month based.
  // Payday remains an income/deposit event, not the boundary of reports.
  return getMonthlyBudgetPeriod(refDate);
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
  // v1.9.5.0: active dashboard/reporting period is always the current month.
  // Stored budget_cycles remain only as event ledger rows for salary deposits/history.
  return getMonthlyBudgetPeriod(refDate);
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
  if(!s||!e)return 'Τρέχουσα περίοδος';
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
      const wallet=typeof capvoWalletById==='function'?capvoWalletById(t.walletId||t.wallet_id):null;
      const rawDate=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO();
      return {
        id:t.id||('cc_payment_'+gid()),
        name:t.description||('Πληρωμή '+(card?.name||'κάρτας')),
        amount:Number(t.amount)||0,
        category:t.category||'Πιστωτικές',
        date:normalizeDateValue(rawDate)||todayISO(),
        paymentSourceId:t.walletId||t.wallet_id||'',
        paymentSourceName:wallet?.name||t.walletNameSnapshot||t.wallet_name_snapshot||'Wallet',
        cardId:t.cardId||t.card_id||'',
        cardName:card?.name||'Πιστωτική κάρτα',
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
      const isVirtualGoal=source==='goal_manual' || source==='goal_manual_return';
      if(isTransfer || isVirtualGoal)return null;

      const amount=capvoMoney(Number(t.amount)||0);
      if(amount===0)return null;

      const isWithdrawal=type==='withdrawal' || amount<0;
      const isDeposit=type==='deposit' || (!isWithdrawal && amount>0);
      if(!isWithdrawal && !isDeposit)return null;

      const goal=savingsGoalById(t.goalId||t.goal_id);
      const abs=Math.abs(amount);
      const goalName=goal?.name||'Στόχος';

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
    ...(typeof getCurrentCycleFixedExpenseMovements==='function'?getCurrentCycleFixedExpenseMovements():[]),
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

function capvoBudgetCycleById(id){
  if(!id)return null;
  return (D?.budgetCycles||[]).find(c=>String(c.id)===String(id))||null;
}

function capvoMovementKind(row){
  const mt=String(row?.movementType||row?.movement_type||'').toLowerCase();
  const group=String(row?.movementGroup||row?.movement_group||'').toLowerCase();
  if(group==='income' || mt.includes('income') || mt.includes('salary'))return 'income';
  if(group==='fixed' || mt.includes('fixed'))return 'fixed';
  if(group==='cards' || mt.includes('card') || String(row?.paymentAccountType||row?.payment_account_type||'').includes('credit_card'))return 'cards';
  if(group==='wallets' || mt.includes('wallet_transfer'))return 'wallets';
  if(group==='savings' || mt.includes('savings') || row?.isSavingsMovement)return 'savings';
  if(group==='benefits' || mt.includes('restricted'))return 'benefits';
  return 'expenses';
}

function capvoMovementTypeLabel(row){
  const kind=capvoMovementKind(row);
  const mt=String(row?.movementType||row?.movement_type||'').toLowerCase();
  if(mt==='salary_deposit' || mt==='income_deposit')return 'Εισόδημα';
  if(mt==='fixed_expense_payment')return 'Πληρωμή παγίου';
  if(mt==='card_payment')return 'Πληρωμή κάρτας';
  if(mt==='credit_card_purchase')return 'Αγορά με κάρτα';
  if(mt==='wallet_transfer')return 'Μεταφορά wallet';
  if(mt==='savings_deposit')return 'Αποταμίευση';
  if(mt==='savings_withdrawal')return 'Αφαίρεση στόχου';
  if(mt==='restricted_expense')return 'Παροχή';
  if(kind==='income')return 'Εισόδημα';
  if(kind==='fixed')return 'Πάγιο';
  if(kind==='cards')return 'Κάρτα';
  if(kind==='wallets')return 'Wallet';
  if(kind==='savings')return 'Στόχος';
  if(kind==='benefits')return 'Παροχή';
  return 'Έξοδο';
}

function capvoMovementSignedAmountLabel(row){
  const amount=Number(row?.amount)||0;
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(row):(row?.affectsBudget===false?0:amount);
  const affects=!!(row?.affectsBudget ?? row?.affectsCashBudget ?? row?.affects_cash_budget);
  const kind=capvoMovementKind(row);
  if(kind==='income')return '+'+fmt(Math.abs(amount));
  if(!affects)return fmt(Math.abs(amount));
  if(impact<0)return '+'+fmt(Math.abs(impact));
  return '-'+fmt(Math.abs(impact));
}

function capvoMovementDisplayTitle(row){
  const merchant=String(row?.merchantName||row?.merchant_name||'').trim();
  if(merchant)return merchant;
  return row?.name || row?.description || capvoMovementTypeLabel(row) || 'Κίνηση';
}

function getCurrentCycleIncomeMovements(){
  const rows=Array.isArray(D?.budgetCycleIncomes)?D.budgetCycleIncomes:[];
  return rows
    .map(i=>{
      if(i.walletDepositApplied===false && i.wallet_deposit_applied===false)return null;
      const amount=capvoMoney(Number(i.amount)||0);
      if(amount<=0)return null;
      const cycle=capvoBudgetCycleById(i.cycleId||i.cycle_id);
      const rawDate=i.walletDepositAppliedAt||i.wallet_deposit_applied_at||i.createdAt||i.created_at||cycle?.startDate||cycle?.start_date||todayISO();
      const date=normalizeDateValue(rawDate)||todayISO();
      if(!isDateInCurrentBudgetCycle(date))return null;
      const wallet=typeof capvoWalletById==='function'?capvoWalletById(i.destinationWalletId||i.destination_wallet_id):null;
      return {
        id:`income_${i.id||gid()}`,
        sourceId:i.id||'',
        movementType:'salary_deposit',
        movementGroup:'income',
        name:i.name||'Εισόδημα',
        amount,
        budgetImpactAmount:-amount,
        affectsBudget:true,
        affectsCashBudget:true,
        category:'Εισόδημα',
        date,
        createdAt:i.createdAt||i.created_at||date,
        paymentSourceId:i.destinationWalletId||i.destination_wallet_id||'',
        paymentSourceName:wallet?.name||'Wallet',
        paymentAccountType:'income_deposit',
        sourceLabel:`Κατάθεση${wallet?.name?' · '+wallet.name:''}`,
        note:i.note||'',
        canEdit:false,
        canDelete:false,
        readOnly:true,
        isIncomeMovement:true
      };
    })
    .filter(Boolean);
}

function getCurrentCycleWalletTransferMovements(){
  const rows=Array.isArray(D?.walletTransfers)?D.walletTransfers:[];
  return rows
    .map(t=>{
      const date=normalizeDateValue(t.date||t.createdAt||t.created_at)||todayISO();
      if(!isDateInCurrentBudgetCycle(date))return null;
      const amount=capvoMoney(Number(t.amount)||0);
      if(amount<=0)return null;
      const from=typeof capvoWalletById==='function'?capvoWalletById(t.fromWalletId||t.from_wallet_id):null;
      const to=typeof capvoWalletById==='function'?capvoWalletById(t.toWalletId||t.to_wallet_id):null;
      const impact=capvoMoney(Number(t.budgetImpactAmount||t.budget_effect_amount)||0);
      return {
        id:`wallet_transfer_${t.id||gid()}`,
        sourceId:t.id||'',
        movementType:'wallet_transfer',
        movementGroup:'wallets',
        name:`${from?.name||'Wallet'} → ${to?.name||'Wallet'}`,
        amount,
        budgetImpactAmount:impact,
        affectsBudget:impact!==0,
        affectsCashBudget:impact!==0,
        category:'Wallets',
        date,
        createdAt:t.createdAt||t.created_at||date,
        paymentSourceId:t.fromWalletId||t.from_wallet_id||'',
        paymentSourceName:from&&to?`${from.name} → ${to.name}`:(from?.name||to?.name||'Wallet transfer'),
        paymentAccountType:'wallet_transfer',
        sourceLabel:'Μεταφορά wallet',
        note:t.note||'',
        notes:t.note||'',
        canEdit:false,
        canDelete:false,
        readOnly:true,
        isWalletTransfer:true
      };
    })
    .filter(Boolean);
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
      const isVirtualGoal=source==='goal_manual' || source==='goal_manual_return';
      const isWithdrawal=type==='withdrawal' || (!isTransfer && amount<0);
      const affectsBudget=!isTransfer && !isVirtualGoal;
      const budgetImpactAmount=affectsBudget ? (isWithdrawal ? -abs : abs) : 0;
      const goalName=goal?.name||'Στόχος';

      let name='Κίνηση στόχου';
      let subtitle='Στόχος';
      let movementType='savings_movement';

      if(isTransfer){
        movementType=type==='transfer_out'?'savings_transfer_out':'savings_transfer_in';
        name=type==='transfer_out' ? `Μεταφορά από ${goalName}` : `Μεταφορά σε ${goalName}`;
        subtitle='Εσωτερική μεταφορά · Δεν επηρεάζει budget';
      }else if(isWithdrawal){
        movementType='savings_withdrawal';
        name=`Επιστροφή από ${goalName}`;
        subtitle=isVirtualGoal?'Αφαίρεση από στόχο · Δεν επηρεάζει budget':'Επιστροφή στο budget';
      }else{
        movementType='savings_deposit';
        name=`Μεταφορά σε ${goalName}`;
        subtitle=isVirtualGoal?'Προσθήκη σε στόχο · Δεν επηρεάζει budget':'Αποταμίευση · Επηρεάζει budget';
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

function capvoFixedExpenseById(id){
  const key=String(id||'');
  return (D.fixedExpenses||[]).find(e=>String(e.id)===key)
    || (D.fixedExpenseArchive||[]).find(e=>String(e.id)===key)
    || null;
}

function capvoFixedExpensePaymentExpense(payment){
  if(!payment)return null;
  const fxId=payment.fixedExpenseId||payment.fixed_expense_id;
  return typeof capvoFixedExpenseById==='function' ? capvoFixedExpenseById(fxId) : null;
}

function capvoFixedExpensePaymentIsCountable(payment){
  if(!payment || String(payment.status||'paid')==='reversed')return false;
  // If the parent fixed expense is missing, the payment is an orphan/stale row.
  // With the current soft-delete model, valid history still has a parent in
  // D.fixedExpenseArchive. Orphans should not pollute Dashboard/Snapshot.
  return !!capvoFixedExpensePaymentExpense(payment);
}

function capvoFixedExpensePaymentMovement(payment){
  if(!payment)return null;
  const fx=capvoFixedExpensePaymentExpense(payment);
  if(!fx)return null;
  const amount=capvoMoney(Number(payment.amount)||0);
  if(amount<=0)return null;

  const date=normalizeDateValue(payment.paidAt||payment.paid_at||payment.paidForDate||payment.paid_for_date||payment.createdAt||payment.created_at)||todayISO();
  const wallet=typeof capvoWalletById==='function'?capvoWalletById(payment.walletId||payment.wallet_id):null;

  return {
    id:`fixed_payment_${payment.id||gid()}`,
    sourceId:payment.id||'',
    fixedExpenseId:payment.fixedExpenseId||payment.fixed_expense_id||'',
    movementType:'fixed_expense_payment',
    movementGroup:'fixed',
    name:fx?.name||'Πληρωμή παγίου',
    amount,
    budgetImpactAmount:amount,
    affectsBudget:true,
    affectsCashBudget:true,
    category:fx?.category||'Πάγια',
    date,
    createdAt:payment.createdAt||payment.created_at||payment.paidAt||payment.paid_at||date,
    paymentSourceId:payment.walletId||payment.wallet_id||'',
    paymentSourceName:wallet?.name||'Wallet',
    paymentAccountType:'fixed_expense_payment',
    sourceLabel:`Πληρωμή παγίου${wallet?.name?' · '+wallet.name:''}`,
    paidForDate:payment.paidForDate||payment.paid_for_date||'',
    canEdit:false,
    canDelete:false,
    readOnly:true,
    isFixedExpense:true,
    isFixedExpensePayment:true
  };
}

function getCurrentCycleFixedExpenseMovements(){
  // v1.9.6.2: use real fixed-expense payments, not planned obligations.
  // Planned fixed expenses stay in the fixed list; analytics/movements use payments.
  const rows=typeof fixedExpensePaymentsForCurrentCycle==='function'
    ? fixedExpensePaymentsForCurrentCycle()
    : (D.fixedExpensePayments||[]).filter(p=>String(p.status||'paid')!=='reversed');

  return rows
    .map(capvoFixedExpensePaymentMovement)
    .filter(Boolean);
}

function getCurrentCycleAllMovements(){
  const daily=(typeof getCurrentCycleDailyExpenses==='function'?getCurrentCycleDailyExpenses():[])
    .map(e=>{
      const affects=typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true;
      const isCard=!!(e.isCreditCardPurchase || e.is_credit_card_purchase || e.paymentAccountType==='credit_card' || e.payment_account_type==='credit_card' || e.creditCardId || e.credit_card_id || e.installmentPlanId || e.installment_plan_id);
      const isWallet=!!(e.walletId || e.wallet_id);
      const isBenefit=!affects && !isCard && !!(e.paymentSourceId || e.payment_source_id) && !isWallet;
      const wallet=isWallet && typeof capvoWalletById==='function' ? capvoWalletById(e.walletId||e.wallet_id) : null;
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
        sourceLabel:isCard?'Αγορά με πιστωτική · Δεν επηρεάζει budget':(isBenefit?'Παροχή / περιορισμένη πηγή · Δεν επηρεάζει cash budget':(wallet?'Wallet':'Budget')),
        paymentSourceName:e.paymentSourceName || e.payment_source_name || wallet?.name || '',
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
      const wallet=typeof capvoWalletById==='function'?capvoWalletById(t.walletId||t.wallet_id):null;
      const amount=capvoMoney(Number(t.amount)||0);
      const walletName=wallet?.name||t.walletNameSnapshot||t.wallet_name_snapshot||'Wallet';
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
        paymentSourceId:t.walletId||t.wallet_id||'',
        paymentSourceName:walletName,
        cardId:t.cardId||t.card_id||'',
        cardName:card?.name||'Πιστωτική κάρτα',
        paymentAccountType:'credit_card_payment',
        sourceLabel:`Πληρωμή κάρτας · ${walletName} → ${card?.name||'κάρτα'}`,
        canEdit:false,
        canDelete:false,
        readOnly:true,
        isCardPayment:true
      };
    })
    .filter(Boolean);

  const savings=typeof getCurrentCycleSavingsAllMovements==='function'?getCurrentCycleSavingsAllMovements():[];
  const fixed=typeof getCurrentCycleFixedExpenseMovements==='function'?getCurrentCycleFixedExpenseMovements():[];
  const income=typeof getCurrentCycleIncomeMovements==='function'?getCurrentCycleIncomeMovements():[];
  const transfers=typeof getCurrentCycleWalletTransferMovements==='function'?getCurrentCycleWalletTransferMovements():[];

  return [...fixed,...daily,...cardPayments,...savings,...income,...transfers].sort((a,b)=>
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
  if(Number.isNaN(d.getTime())){
    const now=new Date();
    const y=now.getFullYear();
    const m=String(now.getMonth()+1).padStart(2,'0');
    const day=String(now.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayISO(){return capvoLocalDateKey(new Date())}
function capvoDateKeyFromParts(year,monthIndex,day){
  return capvoLocalDateKey(new Date(Number(year)||new Date().getFullYear(),Number(monthIndex)||0,Number(day)||1,12));
}
function capvoAddDaysKey(value,days){
  const base=capvoParseDateKey(value)||new Date();
  const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()+Number(days||0),12);
  return capvoLocalDateKey(d);
}
function capvoAddMonthsKey(value,months){
  const base=capvoParseDateKey(value)||new Date();
  const d=new Date(base.getFullYear(),base.getMonth()+Number(months||0),base.getDate(),12);
  return capvoLocalDateKey(d);
}
function normalizeDateValue(value){
  if(!value)return '';
  const raw=String(value).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;
  if(/^\d{4}-\d{2}-\d{2}T/.test(raw)){
    const d=new Date(raw);
    return Number.isNaN(d.getTime())?'':capvoLocalDateKey(d);
  }
  if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
  const d=new Date(raw);
  if(Number.isNaN(d.getTime()))return '';
  return capvoLocalDateKey(d);
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

  // paymentSourceId indicates a restricted/benefit source (Ticket, Voucher etc.).
  // Look up the source to confirm it's non-cash; fall back to non-budget if source not found
  // so legacy rows without explicit flags stay correct. Future wallet sources must set
  // affectsCashBudget=true explicitly to be counted in budget.
  const sourceId = e.paymentSourceId || e.payment_source_id;
  if(sourceId){
    const src = (D?.incomeSources||[]).find(i=>String(i.id)===String(sourceId));
    if(!src) return false; // unknown source → treat as restricted (safe default)
    // A source that counts in spending budget (non-restricted) and is NOT a benefit
    // means the payment came from regular income (future: cash wallet). Count it.
    if(capvoCountsInSpendingBudget && capvoCountsInSpendingBudget(src) && !capvoIsBenefitSource(src)) return true;
    return false; // restricted / benefit source
  }
  return true;
}
function plannedCardPaymentTotal(){
  return capvoMoney((D.creditCards||[])
    .filter(c=>(Number(c.balance)||0)>0 || (Number(c.chosenPay)||0)>0)
    .reduce((s,c)=>s+effectiveCardPayment(c),0));
}
function capvoIsCardPaymentTransaction(t){
  return !!(t && (String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment'));
}
function capvoCardPaymentHasWalletEffect(t){
  if(!t)return false;
  const walletId=t.walletId||t.wallet_id||'';
  const effect=Number(t.walletBalanceEffectAmount ?? t.wallet_balance_effect_amount)||0;
  return !!walletId && effect<0;
}
function capvoCardPaymentNeedsBudgetSubtract(t){
  // In the wallet model, a card payment that already reduced a wallet must not
  // be subtracted again from dashboard available cash. Legacy payments without
  // wallet effect still need to be counted here for backward compatibility.
  const walletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  if(walletModel && capvoCardPaymentHasWalletEffect(t))return false;
  return true;
}
function actualCardPaymentTotal(){
  return capvoMoney((D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>capvoIsCardPaymentTransaction(t))
    .filter(t=>isDateInCurrentBudgetCycle(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at))
    .reduce((s,t)=>s+(Number(t.amount)||0),0));
}
function actualCardPaymentBudgetAdjustmentTotal(){
  return capvoMoney((D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>capvoIsCardPaymentTransaction(t))
    .filter(t=>isDateInCurrentBudgetCycle(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at))
    .filter(t=>capvoCardPaymentNeedsBudgetSubtract(t))
    .reduce((s,t)=>s+(Number(t.amount)||0),0));
}

function capvoFixedExpenseEffectiveDate(expense){
  return expense?.effectiveFromDate || expense?.effective_from_date || '';
}

function capvoFixedExpenseIsActiveForCycle(expense,cycle=getCurrentBudgetCycle()){
  const effective=capvoFixedExpenseEffectiveDate(expense);
  if(!effective)return true;
  const effectiveDate=capvoParseDateKey(effective);
  const cycleStart=cycle?.start || capvoParseDateKey(cycle?.startKey||cycle?.startDate||cycle?.start_date);
  if(!effectiveDate || !cycleStart)return true;
  return cycleStart>=effectiveDate;
}

function activeFixedExpensesForCurrentCycle(){
  const cycle=getCurrentBudgetCycle();
  return (D.fixedExpenses||[]).filter(e=>capvoFixedExpenseIsActiveForCycle(e,cycle));
}




// ===== END 00c-budget-engine.js =====
