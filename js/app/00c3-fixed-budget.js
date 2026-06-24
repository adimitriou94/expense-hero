// CAPVO app split: 00c-budget-engine.js
// Part 3: Scheduled fixed expense helpers + budget totals
// Source: 00c-budget-engine.js lines 1105-1678

// ===== SCHEDULED FIXED EXPENSE HELPERS =====
// v1.9.6.0 foundation: fixed expenses become scheduled obligations.
// They do not reduce budget/wallet just by existing. They affect real money
// when a payment row is recorded.
function capvoFixedExpenseScheduleType(expense){
  const raw=String(expense?.scheduleType||expense?.schedule_type||'monthly').trim();
  if(['monthly','weekly','yearly','custom'].includes(raw))return raw;
  return 'monthly';
}

function capvoFixedExpenseDueDay(expense){
  const raw=expense?.dueDay ?? expense?.due_day;
  const n=Math.round(Number(raw)||0);
  if(n>=1 && n<=31)return n;
  const next=normalizeDateValue(expense?.nextDueDate||expense?.next_due_date||'');
  if(next){
    const d=capvoParseDateKey(next);
    if(d)return d.getDate();
  }
  return 1;
}

function capvoFixedExpenseNextDueDate(expense,refDate=todayISO()){
  const existing=normalizeDateValue(expense?.nextDueDate||expense?.next_due_date||'');
  if(existing)return existing;

  const type=capvoFixedExpenseScheduleType(expense);
  const today=capvoParseDateKey(refDate)||new Date();
  const dueDay=capvoFixedExpenseDueDay(expense);

  if(type==='weekly'){
    return capvoLocalDateKey(new Date(today.getFullYear(),today.getMonth(),today.getDate(),12));
  }

  if(type==='yearly'){
    return capvoDateKeyFromParts(today.getFullYear(),today.getMonth(),dueDay);
  }

  const candidate=new Date(today.getFullYear(),today.getMonth(),Math.min(dueDay,capvoDaysInMonth(today.getFullYear(),today.getMonth())),12);
  if(candidate<today){
    const y=today.getFullYear();
    const m=today.getMonth()+1;
    return capvoDateKeyFromParts(y,m,Math.min(dueDay,capvoDaysInMonth(y,m)));
  }
  return capvoLocalDateKey(candidate);
}

function capvoAdvanceFixedExpenseDueDate(expense,fromDateKey){
  const type=capvoFixedExpenseScheduleType(expense);
  const base=capvoParseDateKey(fromDateKey||capvoFixedExpenseNextDueDate(expense)||todayISO())||new Date();
  const dueDay=capvoFixedExpenseDueDay(expense);

  if(type==='weekly'){
    const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()+7,12);
    return capvoLocalDateKey(d);
  }

  if(type==='yearly'){
    const d=new Date(base.getFullYear()+1,base.getMonth(),Math.min(dueDay,capvoDaysInMonth(base.getFullYear()+1,base.getMonth())),12);
    return capvoLocalDateKey(d);
  }

  const nextMonth=new Date(base.getFullYear(),base.getMonth()+1,1,12);
  const d=new Date(nextMonth.getFullYear(),nextMonth.getMonth(),Math.min(dueDay,capvoDaysInMonth(nextMonth.getFullYear(),nextMonth.getMonth())),12);
  return capvoLocalDateKey(d);
}

function capvoFixedExpensePaymentForDueDate(expenseId,dueDate){
  return (D.fixedExpensePayments||[]).find(p=>
    String(p.fixedExpenseId||p.fixed_expense_id||'')===String(expenseId) &&
    String(p.paidForDate||p.paid_for_date||'').slice(0,10)===String(dueDate||'').slice(0,10) &&
    String(p.status||'paid')!=='reversed'
  )||null;
}

function capvoFixedExpenseIsPaidForDueDate(expense,dueDate){
  return !!capvoFixedExpensePaymentForDueDate(expense?.id,dueDate||capvoFixedExpenseNextDueDate(expense));
}

function capvoFixedExpenseStatus(expense,refDate=todayISO()){
  const nextDue=capvoFixedExpenseNextDueDate(expense,refDate);
  const paid=capvoFixedExpenseIsPaidForDueDate(expense,nextDue);
  if(paid)return {state:'paid',label:'Πληρώθηκε',tone:'green',nextDueDate:nextDue};
  const today=String(refDate||todayISO()).slice(0,10);
  if(String(nextDue)<today)return {state:'overdue',label:'Εκκρεμεί',tone:'orange',nextDueDate:nextDue};
  if(String(nextDue)===today)return {state:'due',label:'Σήμερα',tone:'purple',nextDueDate:nextDue};
  return {state:'upcoming',label:'Προσεχώς',tone:'slate',nextDueDate:nextDue};
}

function fixedExpensePaymentsForCurrentCycle(){
  const cycle=getCurrentBudgetCycle();
  const start=String(cycle?.startKey||'');
  const end=String(cycle?.endKey||'');
  return (D.fixedExpensePayments||[]).filter(p=>{
    if(typeof capvoFixedExpensePaymentIsCountable==='function' && !capvoFixedExpensePaymentIsCountable(p))return false;
    const d=String(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||'').slice(0,10);
    return d && (!start || d>=start) && (!end || d<=end);
  });
}

function fixedExpensePaymentsTotalForCurrentCycle(){
  return capvoMoney(fixedExpensePaymentsForCurrentCycle().reduce((s,p)=>s+(Number(p.amount)||0),0));
}

function capvoLatestFixedExpensePaymentForCurrentCycle(expenseId){
  const rows=typeof fixedExpensePaymentsForCurrentCycle==='function'
    ? fixedExpensePaymentsForCurrentCycle()
    : (D.fixedExpensePayments||[]);
  return rows
    .filter(p=>String(p.fixedExpenseId||p.fixed_expense_id||'')===String(expenseId))
    .sort((a,b)=>String(b.paidAt||b.paid_at||b.createdAt||b.created_at||'').localeCompare(String(a.paidAt||a.paid_at||a.createdAt||a.created_at||'')))[0]||null;
}



function ccPayTotal(){
  // Budget formula impact from cards must represent actual payments only.
  // Wallet-based card payments already reduce wallet balances, so only legacy
  // payments without wallet effect are subtracted here. Snapshot/statistics can
  // still use actualCardPaymentTotal() to show all card payments.
  return typeof actualCardPaymentBudgetAdjustmentTotal==='function'
    ? actualCardPaymentBudgetAdjustmentTotal()
    : actualCardPaymentTotal();
}
function fixedTotal(){
  // v1.9.6.1: In the wallet model, a fixed-expense payment already reduces
  // the source wallet. Since D.income is derived from wallet balances, counting
  // the same paid fixed expense again here double-subtracts it on the dashboard.
  if(typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel())return 0;
  return typeof fixedExpensePaymentsTotalForCurrentCycle==='function'
    ? fixedExpensePaymentsTotalForCurrentCycle()
    : capvoMoney((D.fixedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0));
}
function dailyTotal(){return capvoMoney(getCurrentCycleDailyExpenses().reduce((s,e)=>s+(Number(e.amount)||0),0))}
function allFixedTotal(){return fixedTotal()+ccPayTotal()}

function capvoIsExtraIncomeSource(source){
  const type=typeof capvoInferMoneySourceType==='function'?capvoInferMoneySourceType(source):(source?.sourceType||'income');
  return type!=='budget_cycle';
}

function incomeSourcesTotal(){
  return (D.incomeSources||[])
    .filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true)
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


function capvoPaidTodayMetaFromCycle(cycle){
  try{
    const note=String(cycle?.note||'');
    const marker='[[CAPVO_PAID_TODAY_META:';
    const start=note.indexOf(marker);
    if(start<0)return null;
    const from=start+marker.length;
    const end=note.indexOf(']]',from);
    if(end<0)return null;
    const raw=note.slice(from,end);
    const meta=JSON.parse(raw);
    return meta && typeof meta==='object' ? meta : null;
  }catch(e){
    return null;
  }
}


function capvoDateInRangeForBudget(value,startKey,endKey){
  const d=capvoParseDateKey(value);
  const s=capvoParseDateKey(startKey);
  const e=capvoParseDateKey(endKey);
  if(!d||!s||!e)return false;
  return d>=s && d<=e;
}

function capvoBudgetSpentForRange(startKey,endKey){
  try{
    const fixed=typeof fixedTotal==='function'?fixedTotal():0;

    const daily=(typeof getAllDailyExpenses==='function'?getAllDailyExpenses():[])
      .filter(e=>capvoDateInRangeForBudget(e.date,startKey,endKey))
      .filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true)
      .reduce((s,e)=>s+(Number(e.amount)||0),0);

    const card=(D.creditCardTransactions||[])
      .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
      .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
      .filter(t=>{
        const raw=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at;
        return capvoDateInRangeForBudget(normalizeDateValue(raw)||raw,startKey,endKey);
      })
      .reduce((s,t)=>s+(Number(t.amount)||0),0);

    const savings=(D.savingsTransactions||[])
      .filter(t=>{
        const raw=t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date;
        return capvoDateInRangeForBudget(normalizeDateValue(raw)||raw,startKey,endKey);
      })
      .filter(t=>{
        const type=String(t.type||'').toLowerCase();
        const source=String(t.source||'').toLowerCase();
        return !(type==='transfer_in' || type==='transfer_out' || source.includes('transfer'));
      })
      .reduce((s,t)=>{
        const amount=Number(t.amount)||0;
        const type=String(t.type||'').toLowerCase();
        const isWithdrawal=type==='withdrawal' || amount<0;
        return s+(isWithdrawal?-Math.abs(amount):Math.abs(amount));
      },0);

    return capvoMoney(fixed+daily+card+savings);
  }catch(e){
    return 0;
  }
}

function capvoPaidTodayFallbackBudget(cycle){
  try{
    if(!cycle || cycle.source!=='paid_today')return null;
    const salary=capvoMoney(Number(cycle.primaryIncomeAmount||cycle.primary_income_amount)||0);
    if(salary<=0)return null;

    const raw=capvoMoney(typeof capvoGetSpendableWalletTotal==='function'
      ? capvoGetSpendableWalletTotal()
      : capvoWalletTotalBalance());

    const startKey=cycle.startKey||cycle.startDate||cycle.start_date;
    const start=capvoParseDateKey(startKey);
    if(!start)return null;

    const previousEnd=new Date(start);
    previousEnd.setDate(previousEnd.getDate()-1);
    const previousEndKey=capvoDateKey(previousEnd);
    const previousCycle=getStandardBudgetCycle(previousEnd);
    const previousStartKey=previousCycle?.startKey || capvoDateKey(previousCycle?.start) || previousEndKey;

    const previousSpent=capvoBudgetSpentForRange(previousStartKey,previousEndKey);
    const value=capvoMoney(raw-previousSpent);

    return value>0?value:null;
  }catch(e){
    return null;
  }
}


function capvoPaidTodayBudgetOverride(){
  try{
    const cycle=getCurrentBudgetCycle();
    if(!cycle || cycle.source!=='paid_today')return null;
    const meta=capvoPaidTodayMetaFromCycle(cycle);
    const value=capvoMoney(Number(meta?.startingBudget)||0);
    if(value>0)return value;

    // Backward safety for a paid-today cycle created before v1.9.3.3.
    return capvoPaidTodayFallbackBudget(cycle);
  }catch(e){
    return null;
  }
}


function budgetIncomeTotal(){
  // v1.9.3.3: if an old manual paid-today cycle is active, use the
  // captured carryover baseline instead of raw wallet balances. This prevents
  // old-cycle expenses from being counted back into the new cycle budget.
  const paidTodayOverride=typeof capvoPaidTodayBudgetOverride==='function'?capvoPaidTodayBudgetOverride():null;
  if(paidTodayOverride!==null && paidTodayOverride!==undefined)return capvoMoney(paidTodayOverride);

  // v1.9.3.0: the real available budget is the sum of wallet balances
  // that are marked as budget wallets. Income sources are now extra-income
  // rules/events that fill wallets, not an additional abstract budget bucket.
  if(typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel()){
    return capvoMoney(typeof capvoGetSpendableWalletTotal==='function'
      ? capvoGetSpendableWalletTotal()
      : capvoWalletTotalBalance());
  }

  // Backward fallback for users who have not created wallets yet.
  const sources=(D.incomeSources||[]).filter(i=>i&&capvoCountsInSpendingBudget(i));
  return capvoMoney(sources.reduce((sum,i)=>sum+incomeBudgetAmount(i),0));
}

function totalCycleAmount(){
  if(typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel()){
    return capvoMoney(typeof capvoPrimaryWalletCycleAmount==='function'?capvoPrimaryWalletCycleAmount():0);
  }

  const sources=(D.incomeSources||[]).filter(i=>i&&capvoCountsInSpendingBudget(i));
  return capvoMoney(sources.reduce((sum,i)=>sum+(Number(i.amount)||0),0));
}

function budgetLimitReservedAmount(){
  if(typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel()){
    return 0;
  }
  const primary=primaryBudgetSource();
  if(!primary)return 0;
  const amount=capvoMoney(Number(primary.amount)||0);
  const effective=incomeBudgetAmount(primary);
  return capvoMoney(Math.max(0,amount-effective));
}

function savingsIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true)
    .filter(i=>i.isSavings || i.allocationTarget==='savings')
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true)
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

  const rows=typeof getCurrentCycleBudgetMovements==='function'
    ? getCurrentCycleBudgetMovements()
    : (typeof getCurrentCycleBudgetExpenses==='function' ? getCurrentCycleBudgetExpenses() : getCurrentCycleDailyExpenses());
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

function capvoDailyExpenseAlreadyAppliedToWallet(e){
  if(!e)return false;
  const effect=Number(e.walletBalanceEffectAmount ?? e.wallet_balance_effect_amount)||0;
  return !!(e.walletId || e.wallet_id) && effect<0;
}

function dailyCashTotal(){
  const walletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  const budgetRows=typeof getCurrentCycleBudgetExpenses==='function'
    ? getCurrentCycleBudgetExpenses()
    : getCurrentCycleDailyExpenses().filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):!e.paymentSourceId);
  const rows=[
    ...budgetRows.filter(e=>!(walletModel && capvoDailyExpenseAlreadyAppliedToWallet(e))),
    ...(typeof getCurrentCycleSavingsBudgetMovements==='function'?getCurrentCycleSavingsBudgetMovements():[])
  ];
  return capvoMoney(rows.reduce((s,e)=>s+(Number(e.amount)||0),0));
}


function capvoDashboardActualFixedTotal(){
  // Snapshot/display value only: fixed payments are actual movements for the
  // current cycle. Do not use this in the dashboard balance formula because
  // wallet-based fixed payments have already reduced the wallet balance.
  return capvoMoney(typeof fixedExpensePaymentsTotalForCurrentCycle==='function'
    ? fixedExpensePaymentsTotalForCurrentCycle()
    : 0);
}

function capvoDashboardActualCardPaymentTotal(){
  // Snapshot/display value only. Future wallet-based card payments should still
  // show here as actual payments, but must not be double-subtracted from wallet
  // based balances.
  return capvoMoney(typeof actualCardPaymentTotal==='function'
    ? actualCardPaymentTotal()
    : 0);
}

function capvoDashboardActualDailyBudgetTotal(){
  // Snapshot/display value only: show actual daily/manual expenses that affect
  // the budget, even when they have already been applied to wallet balance.
  // This fixes the dashboard Snapshot cards showing €0 after the wallet-based
  // manual expense flow, while keeping the balance/double-count guard intact.
  const rows=typeof getCurrentCycleBudgetExpenses==='function'
    ? getCurrentCycleBudgetExpenses()
    : (typeof getCurrentCycleDailyExpenses==='function'?getCurrentCycleDailyExpenses():[]);

  return capvoMoney((rows||[])
    .filter(e=>{
      if(!e)return false;
      const accountType=String(e.paymentAccountType||e.payment_account_type||'').toLowerCase();
      if(e.isFixedExpense || e.isFixedExpensePayment)return false;
      if(e.isSavingsMovement)return false;
      if(e.isCardPayment)return false;
      if(e.isCreditCardPurchase || e.is_credit_card_purchase)return false;
      if(accountType==='credit_card' || accountType==='credit_card_payment')return false;
      return typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true;
    })
    .reduce((sum,e)=>{
      const impact=typeof capvoMovementBudgetImpact==='function'
        ? capvoMovementBudgetImpact(e)
        : (Number(e.amount)||0);
      return sum+Math.abs(Number(impact)||0);
    },0));
}

function capvoDashboardSnapshotTotals(){
  return {
    fixed:capvoDashboardActualFixedTotal(),
    cards:capvoDashboardActualCardPaymentTotal(),
    daily:capvoDashboardActualDailyBudgetTotal()
  };
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

// ===== END 00c-budget-engine.js =====
