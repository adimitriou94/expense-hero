// CAPVO app split: 02b-data-save.js
// Data save: saveToSupabase, budget cycle, salary/payday, carryovers
// Source: 02-supabase-data.js lines 582-1651

async function saveToSupabase(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)return;

  try{
    refreshComputedIncome();

    await syncIncomeSources(ownerUserId);

    if(D.fixedExpenses.length>0){
      const {error}=await supabaseClient.from('fixed_expenses').upsert(
        D.fixedExpenses.map(e=>({
          id:e.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:e.name,
          amount:e.amount,
          category:e.category,
          schedule_type:e.scheduleType||'monthly',
          due_day:e.dueDay||e.due_day||null,
          next_due_date:e.nextDueDate||e.next_due_date||null,
          source_wallet_id:e.sourceWalletId||e.source_wallet_id||null,
          auto_pay:!!(e.autoPay||e.auto_pay),
          effective_from_date:e.effectiveFromDate||e.effective_from_date||null,
          deleted_at:e.deletedAt||e.deleted_at||null,
          last_paid_at:e.lastPaidAt||e.last_paid_at||null
        })),
        {onConflict:'id'}
      );
      if(error)throw error;
    }

    const {data:dbFixed,error:fixedFetchError}=await supabaseClient
      .from('fixed_expenses')
      .select('id')
      .eq('user_id',ownerUserId);
    if(fixedFetchError)throw fixedFetchError;

    const fixedIds=new Set(D.fixedExpenses.map(e=>e.id));
    const fixedToDelete=(dbFixed||[]).filter(e=>!fixedIds.has(e.id)).map(e=>e.id);
    if(fixedToDelete.length>0){
      const {error}=await supabaseClient.from('fixed_expenses').delete().in('id',fixedToDelete);
      if(error)throw error;
    }

    if(D.creditCards.length>0){
      const {error}=await supabaseClient.from('credit_cards').upsert(
        D.creditCards.map(c=>({
          id:c.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:c.name,
          balance:c.balance,
          rate:c.rate,
          min_pay:c.minPay,
          limit_amount:c.limit,
          chosen_pay:c.chosenPay,
          account_type:c.accountType||'credit_card',
          bank_name:c.bankName||null,
          statement_day:c.statementDay||null,
          payment_due_day:c.paymentDueDay||null,
          payment_due_date:c.paymentDueDate||null,
          is_active:c.isActive!==false,
          notes:c.notes||null,
          last_payment_date:c.lastPaymentDate||null,
          budget_treatment:c.budgetTreatment||'payment_only',
          loan_type:c.loanType||null,
          loan_purpose:c.loanPurpose||null,
          original_amount:c.originalAmount||null,
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );
      if(error)throw error;
    }

    const {data:dbCards,error:cardsFetchError}=await supabaseClient
      .from('credit_cards')
      .select('id')
      .eq('user_id',ownerUserId);
    if(cardsFetchError)throw cardsFetchError;

    const cardIds=new Set(D.creditCards.map(c=>c.id));
    const cardsToDelete=(dbCards||[]).filter(c=>!cardIds.has(c.id)).map(c=>c.id);
    if(cardsToDelete.length>0){
      const {error}=await supabaseClient.from('credit_cards').delete().in('id',cardsToDelete);
      if(error)throw error;
    }

    const allDaily=[];

    Object.entries(D.months).forEach(([monthKey,m])=>{
      (m.daily||[]).forEach(e=>{
        if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(e);
        allDaily.push({
          id:e.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:e.name,
          amount:e.amount,
          category:e.category,
          category_id:e.categoryId||e.category_id||null,
          subcategory_id:e.subcategoryId||e.subcategory_id||null,
          merchant_name:e.merchantName||e.merchant_name||null,
          notes:e.notes||null,
          date:e.date,
          type:'daily',
          month_key:monthKey,
          payment_source_id:e.paymentSourceId||null,
          payment_source_name:e.paymentSourceName||null,
          payment_source_type:e.paymentSourceType||null,
          payment_account_type:e.paymentAccountType||'cash',
          credit_card_id:e.creditCardId||null,
          credit_card_transaction_id:e.creditCardTransactionId||null,
          installment_plan_id:e.installmentPlanId||null,
          affects_cash_budget:e.affectsCashBudget!==false,
          is_credit_card_purchase:!!e.isCreditCardPurchase,
          purchase_mode:e.purchaseMode||'normal',
          installment_count:e.installmentCount||null,
          interest_free:e.interestFree!==false,
          installment_rate:e.installmentRate||null,
          installment_amount:e.installmentAmount||null,
          wallet_id:e.walletId||null,
          budget_effect_amount:Object.prototype.hasOwnProperty.call(e,'budgetEffectAmount') ? Number(e.budgetEffectAmount)||0 : null,
          wallet_balance_effect_amount:Object.prototype.hasOwnProperty.call(e,'walletBalanceEffectAmount') ? Number(e.walletBalanceEffectAmount)||0 : 0
        });
      });
    });

    if(allDaily.length>0){
      const {error}=await supabaseClient
        .from('expenses')
        .upsert(allDaily,{onConflict:'id'});
      if(error)throw error;
    }

    const {data:dbExpenses,error:expensesFetchError}=await supabaseClient
      .from('expenses')
      .select('id')
      .eq('user_id',ownerUserId);
    if(expensesFetchError)throw expensesFetchError;

    const dbIds=new Set((dbExpenses||[]).map(e=>e.id));
    const appIds=new Set(allDaily.map(e=>e.id));
    const toDelete=[...dbIds].filter(id=>!appIds.has(id));

    if(toDelete.length>0){
      const {error}=await supabaseClient
        .from('expenses')
        .delete()
        .in('id',toDelete);
      if(error)throw error;
    }

  }catch(e){
    console.error('Save error:',e);
    showMiniToast(
      '❌ Σφάλμα αποθήκευσης',
      'error'
    );
    throw e;
  }
}


function getSelectedBudgetCycleType(){
  const checked=document.querySelector('input[name="cycleManagerBudgetCycleType"]:checked');
  return normalizeBudgetCycleType(checked?.value || D?.preferences?.budgetCycleType || 'fixed_day');
}
function syncBudgetCycleTypeControls(type=getBudgetCycleType()){
  const normalized=normalizeBudgetCycleType(type);
  document.querySelectorAll('input[name="cycleManagerBudgetCycleType"]').forEach(r=>{r.checked=r.value===normalized;});
  const input=$('cycleManagerBudgetCycleDay')||$('settingsBudgetCycleDay');
  if(input)input.disabled=normalized==='last_working_day';
  const row=document.querySelector('.budget-cycle-rule-row');
  if(row)row.classList.toggle('is-last-working-day',normalized==='last_working_day');
  const ruleLabel=$('cycleManagerRuleLabel');
  if(ruleLabel){
    const day=readBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1) || capvoClampCycleDay(D?.preferences?.budgetCycleStartDay || 1);
    ruleLabel.textContent=normalized==='last_working_day'
      ? 'Πληρώνομαι την τελευταία εργάσιμη του μήνα'
      : `Πληρώνομαι κάθε ${day} του μήνα`;
  }
  const help=$('cycleManagerRuleHelp');
  if(help){
    help.textContent=normalized==='last_working_day'
      ? `${typeof getHolidayAwareRuleText==='function'?getHolidayAwareRuleText():'Το CAPVO υπολογίζει Σαββατοκύριακα και ελληνικές αργίες.'} Η ημέρα πληρωμής χρησιμοποιείται για υπενθύμιση μισθού.`
      : 'Η ημέρα που επιλέγεις είναι η ημέρα που περιμένεις τον μισθό σου.';
  }
}
async function saveBudgetCyclePreference(inputId='settingsBudgetCycleDay'){
  const ownerUserId=getFinanceUserId();
  const input=$(inputId)||$('settingsBudgetCycleDay')||$('cycleManagerBudgetCycleDay');
  const raw=input?String(input.value||'').trim():'';
  const type=getSelectedBudgetCycleType();
  let day=capvoClampCycleDay(D?.preferences?.budgetCycleStartDay || 1);
  if(type==='fixed_day'){
    day=finalizeBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1);
    if(day===null){
      showMiniToast('Βάλε ημέρα πληρωμής από 1 έως 31.','error');
      input?.focus?.();
      return;
    }
  }else if(raw!==''){
    day=finalizeBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1) || day;
  }
  if(!ownerUserId){
    showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');
    return;
  }

  try{
    const payload={
      user_id:ownerUserId,
      budget_cycle_type:type,
      budget_cycle_start_day:day,
      currency:D.preferences?.currency||'EUR',
      language:D.preferences?.language||'el',
      updated_at:new Date().toISOString()
    };

    const {error}=await supabaseClient
      .from('user_preferences')
      .upsert(payload,{onConflict:'user_id'});

    if(error)throw error;

    D.preferences={
      ...(D.preferences||{}),
      budgetCycleType:type,
      budgetCycleStartDay:day,
      budget_cycle_type:type,
      budget_cycle_start_day:day
    };
    if(typeof setBudgetCycleType==='function')setBudgetCycleType(type);
    if(typeof setBudgetCycleStartDay==='function')setBudgetCycleStartDay(day);
    capvoSaveSalaryRuleLocal(type,day);

    if(type==='last_working_day' && typeof capvoEnsureBudgetCycleHolidays==='function'){
      await capvoEnsureBudgetCycleHolidays();
    }

    curM=curMK();
    ensM(curM);
    render();
    renderBudgetCycleManager?.();
    showMiniToast(type==='last_working_day'?'✅ Η ημέρα μισθού ορίστηκε στην τελευταία εργάσιμη':'✅ Η ημέρα μισθού ενημερώθηκε σε '+day);
  }catch(e){
    console.error('saveBudgetCyclePreference failed:',e);
    showMiniToast('Δεν μπόρεσα να αποθηκεύσω τον οικονομικό κύκλο.','error');
  }
}


function getNextStandardCycleStartAfter(dateValue){
  return getNextPaydayAfter(dateValue,getBudgetCycleType());
}
function getPaidTodayCycleEnd(startKey){
  const start=capvoParseDateKey(startKey)||new Date();
  const nextStart=getNextStandardCycleStartAfter(start);
  const end=new Date(nextStart);
  end.setDate(end.getDate()-1);
  return capvoDateKey(end);
}



function capvoBudgetDateInRange(dateValue,startKey,endKey){
  const d=typeof capvoParseDateKey==='function'?capvoParseDateKey(dateValue):new Date(dateValue);
  const s=typeof capvoParseDateKey==='function'?capvoParseDateKey(startKey):new Date(startKey);
  const e=typeof capvoParseDateKey==='function'?capvoParseDateKey(endKey):new Date(endKey);
  if(!d||!s||!e)return false;
  return d>=s && d<=e;
}

function capvoBudgetExpensesForRange(startKey,endKey){
  return (typeof getAllDailyExpenses==='function'?getAllDailyExpenses():[])
    .filter(e=>capvoBudgetDateInRange(e.date,startKey,endKey))
    .filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true);
}

function capvoActualCardPaymentsForRange(startKey,endKey){
  return (D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .map(t=>{
      const raw=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO();
      return {...t,date:normalizeDateValue(raw)||todayISO()};
    })
    .filter(t=>capvoBudgetDateInRange(t.date,startKey,endKey));
}

function capvoSavingsBudgetMovementsForRange(startKey,endKey){
  return (D.savingsTransactions||[])
    .map(t=>{
      const rawDate=t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date||todayISO();
      const date=normalizeDateValue(rawDate)||todayISO();
      if(!capvoBudgetDateInRange(date,startKey,endKey))return null;

      const type=String(t.type||'').toLowerCase();
      const source=String(t.source||'').toLowerCase();
      const isTransfer=type==='transfer_in' || type==='transfer_out' || source.includes('transfer');
      if(isTransfer)return null;

      const amount=capvoMoney(Number(t.amount)||0);
      if(amount===0)return null;
      const isWithdrawal=type==='withdrawal' || amount<0;
      const abs=Math.abs(amount);
      return {date,amount:capvoMoney(isWithdrawal?-abs:abs)};
    })
    .filter(Boolean);
}


function capvoFixedExpenseActiveForStart(fixed,startKey){
  const effective=fixed?.effectiveFromDate || fixed?.effective_from_date || '';
  if(!effective)return true;
  const effectiveDate=capvoParseDateKey(effective);
  const start=capvoParseDateKey(startKey);
  if(!effectiveDate || !start)return true;
  return start>=effectiveDate;
}

function capvoFixedTotalForCycleStart(startKey){
  return capvoMoney((D.fixedExpenses||[])
    .filter(f=>capvoFixedExpenseActiveForStart(f,startKey))
    .reduce((sum,f)=>sum+(Number(f.amount)||0),0));
}


function capvoProposedCycleSpent(startKey,endKey){
  const fixed=typeof capvoFixedTotalForCycleStart==='function'?capvoFixedTotalForCycleStart(startKey):(typeof fixedTotal==='function'?fixedTotal():0);
  const daily=capvoBudgetExpensesForRange(startKey,endKey).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const card=capvoActualCardPaymentsForRange(startKey,endKey).reduce((s,t)=>s+(Number(t.amount)||0),0);
  const savings=capvoSavingsBudgetMovementsForRange(startKey,endKey).reduce((s,t)=>s+(Number(t.amount)||0),0);
  return {
    fixed:capvoMoney(fixed),
    daily:capvoMoney(daily),
    card:capvoMoney(card),
    savings:capvoMoney(savings),
    total:capvoMoney(fixed+daily+card+savings)
  };
}

function capvoCurrentCycleBalanceSnapshot(){
  const currentIncome=capvoMoney(Number(D.income)||0);
  const currentSpent=capvoMoney(
    (typeof fixedTotal==='function'?fixedTotal():0) +
    (typeof ccPayTotal==='function'?ccPayTotal():0) +
    (typeof dailyCashTotal==='function'?dailyCashTotal():0)
  );
  return {
    currentIncome,
    currentSpent,
    currentBalance:capvoMoney(currentIncome-currentSpent)
  };
}

function capvoBuildPaidTodayPreview(primaryWallet,cycleAmount,startKey,endKey,context={}){
  // v1.9.5.1: payday is a salary deposit inside a monthly period.
  // If payday is overdue, the deposit is still linked to the expected payday month.
  const current=capvoCurrentCycleBalanceSnapshot();
  const proposedSpent={
    fixed:typeof fixedTotal==='function'?fixedTotal():0,
    daily:typeof dailyCashTotal==='function'?dailyCashTotal():0,
    card:typeof ccPayTotal==='function'?ccPayTotal():0,
    savings:0
  };
  proposedSpent.total=capvoMoney(proposedSpent.fixed+proposedSpent.daily+proposedSpent.card+proposedSpent.savings);

  const startingBudget=capvoMoney(current.currentIncome + (Number(cycleAmount)||0));
  const estimatedBalance=capvoMoney(startingBudget - proposedSpent.total);

  return {
    walletId:primaryWallet?.id||'',
    walletName:primaryWallet?.name||'Βασικός λογαριασμός',
    salaryAmount:capvoMoney(Number(cycleAmount)||0),
    previousIncome:current.currentIncome,
    previousSpent:current.currentSpent,
    previousBalance:current.currentBalance,
    startingBudget,
    proposedSpent,
    estimatedBalance,
    startKey,
    endKey,
    paydayKey:context.paydayKey||todayISO(),
    salaryState:context.state||'upcoming',
    isOverdue:!!context.isOverdue,
    createdAt:new Date().toISOString(),
    mode:'monthly_salary_deposit'
  };
}

function capvoEncodePaidTodayMeta(meta){
  const safe={
    walletId:meta.walletId,
    walletName:meta.walletName,
    salaryAmount:capvoMoney(meta.salaryAmount),
    previousIncome:capvoMoney(meta.previousIncome),
    previousSpent:capvoMoney(meta.previousSpent),
    previousBalance:capvoMoney(meta.previousBalance),
    startingBudget:capvoMoney(meta.startingBudget),
    proposedSpent:{
      fixed:capvoMoney(meta.proposedSpent?.fixed),
      daily:capvoMoney(meta.proposedSpent?.daily),
      card:capvoMoney(meta.proposedSpent?.card),
      savings:capvoMoney(meta.proposedSpent?.savings),
      total:capvoMoney(meta.proposedSpent?.total)
    },
    estimatedBalance:capvoMoney(meta.estimatedBalance),
    startKey:meta.startKey,
    endKey:meta.endKey,
    createdAt:meta.createdAt||new Date().toISOString()
  };
  return `[[CAPVO_PAID_TODAY_META:${JSON.stringify(safe)}]]`;
}

function showPaidTodayPreviewModal(preview){
  return new Promise(resolve=>{
    const old=document.getElementById('capvoPaidTodayPreviewOverlay');
    if(old)old.remove();

    const overlay=document.createElement('div');
    overlay.id='capvoPaidTodayPreviewOverlay';
    overlay.className='capvo-paid-preview-overlay';
    overlay.innerHTML=`
      <section class="capvo-paid-preview-sheet" role="dialog" aria-modal="true" aria-label="Προεπισκόπηση μισθού">
        <button type="button" class="capvo-paid-preview-close" aria-label="Κλείσιμο">×</button>
        <div class="capvo-paid-preview-hero">
          <div class="capvo-paid-preview-icon">💸</div>
          <div>
            <span>Καταχώρηση μισθού</span>
            <h3>Δες τι θα αλλάξει πριν συνεχίσεις</h3>
            <p>${esc(formatBudgetCycleDateRange(preview.startKey,preview.endKey))}</p>
            <small class="capvo-paid-preview-payday">${preview.isOverdue?'Εκκρεμεί από ':'Ημερομηνία μισθού: '}${esc(formatGreekFullDate(preview.paydayKey))}</small>
          </div>
        </div>

        <div class="capvo-paid-preview-total">
          <span>Εκτιμώμενο νέο υπόλοιπο μήνα</span>
          <strong>${fmt(preview.estimatedBalance)}</strong>
          <small>Με βάση τα τρέχοντα budget wallets + τον μισθό - τα έξοδα της μηνιαίας περιόδου. Ο μισθός δεν μπαίνει αυτόματα, μόνο μετά την επιβεβαίωσή σου.</small>
        </div>

        <div class="capvo-paid-preview-steps">
          <div class="capvo-paid-preview-row">
            <span>Υπόλοιπο μήνα πριν τον μισθό</span>
            <strong>${fmt(preview.previousBalance)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-plus">
            <span>Μισθός στο ${esc(preview.walletName)}</span>
            <strong>+${fmt(preview.salaryAmount)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-subtotal">
            <span>Νέα budget wallets μετά τον μισθό</span>
            <strong>${fmt(preview.startingBudget)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-minus">
            <span>Πάγια / έξοδα μήνα</span>
            <strong>-${fmt(preview.proposedSpent.total)}</strong>
          </div>
        </div>

        <div class="capvo-paid-preview-breakdown">
          <div><span>Πάγια</span><strong>${fmt(preview.proposedSpent.fixed)}</strong></div>
          <div><span>Ημερήσια μήνα</span><strong>${fmt(preview.proposedSpent.daily)}</strong></div>
          <div><span>Πληρωμές καρτών</span><strong>${fmt(preview.proposedSpent.card)}</strong></div>
          <div><span>Στόχος</span><strong>${fmt(preview.proposedSpent.savings)}</strong></div>
        </div>

        <div class="capvo-paid-preview-note">
          <strong>Σημαντικό</strong>
          <span>Δεν αλλάζει η μηνιαία περίοδος. Απλά καταχωρείται ο μισθός στο primary wallet και συνεχίζεις στον ίδιο μήνα.</span>
        </div>

        <div class="capvo-paid-preview-actions">
          <button type="button" class="capvo-paid-preview-secondary">Άκυρο</button>
          <button type="button" class="capvo-paid-preview-primary">Ναι, καταχώρησε μισθό</button>
        </div>
      </section>`;

    const close=(answer)=>{
      overlay.classList.remove('active');
      setTimeout(()=>overlay.remove(),160);
      resolve(!!answer);
    };

    overlay.addEventListener('click',e=>{ if(e.target===overlay)close(false); });
    overlay.querySelector('.capvo-paid-preview-close')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-secondary')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-primary')?.addEventListener('click',()=>close(true));

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('active'));
  });
}


function capvoPaidTodayPrimaryWallet(){
  return typeof capvoPrimaryBudgetWallet==='function' ? capvoPrimaryBudgetWallet() : (typeof capvoDefaultWallet==='function'?capvoDefaultWallet():null);
}

async function capvoFetchCycleIncomeRow(ownerUserId,cycleId,incomeSourceId){
  if(!ownerUserId || !cycleId || !incomeSourceId)return null;
  try{
    const {data,error}=await supabaseClient
      .from('budget_cycle_incomes')
      .select('*')
      .eq('user_id',ownerUserId)
      .eq('cycle_id',cycleId)
      .eq('income_source_id',incomeSourceId)
      .limit(1);
    if(error)throw error;
    return (data||[])[0]||null;
  }catch(e){
    console.warn('[CAPVO] cycle income row fetch failed:',e?.message||e);
    return null;
  }
}

async function capvoUpsertCycleIncomeWithWallet(payload){
  const {error}=await supabaseClient
    .from('budget_cycle_incomes')
    .upsert(payload,{onConflict:'cycle_id,income_source_id'});
  if(!error)return {error:null,legacy:false};

  if(/destination_wallet_id|wallet_deposit_applied|wallet_balance_before|wallet_balance_after|wallet_deposit_applied_at/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.destination_wallet_id;
    delete legacyPayload.wallet_deposit_applied;
    delete legacyPayload.wallet_deposit_applied_at;
    delete legacyPayload.wallet_balance_before;
    delete legacyPayload.wallet_balance_after;
    const retry=await supabaseClient
      .from('budget_cycle_incomes')
      .upsert(legacyPayload,{onConflict:'cycle_id,income_source_id'});
    return {error:retry.error,legacy:true};
  }

  return {error,legacy:false};
}

async function capvoMarkCycleIncomeWalletDeposit(ownerUserId,cycleId,incomeSourceId,walletId,before,after){
  const {error}=await supabaseClient
    .from('budget_cycle_incomes')
    .update({
      destination_wallet_id:walletId,
      wallet_deposit_applied:true,
      wallet_deposit_applied_at:new Date().toISOString(),
      wallet_balance_before:Number(before)||0,
      wallet_balance_after:Number(after)||0
    })
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycleId)
    .eq('income_source_id',incomeSourceId);
  if(error)throw error;
}

async function capvoApplyCycleAmountToWallet({ownerUserId,cycle,wallet,amount,incomeSourceId,name,incomeType='wallet_salary'}){
  const value=Number(amount)||0;
  if(!ownerUserId || !cycle?.id || !wallet?.id || value<=0)return {applied:false,reason:'invalid'};
  const rowKey=incomeSourceId || `wallet:${wallet.id}:primary_cycle`;

  const existing=await capvoFetchCycleIncomeRow(ownerUserId,cycle.id,rowKey);
  if(existing?.wallet_deposit_applied){
    return {applied:false,reason:'already_applied',wallet,amount:value};
  }

  const incomePayload={
    user_id:ownerUserId,
    cycle_id:cycle.id,
    income_source_id:rowKey,
    name:name||'Βασικός μισθός / κύκλος',
    amount:value,
    income_type:incomeType,
    destination_wallet_id:wallet.id,
    wallet_deposit_applied:false,
    wallet_balance_before:null,
    wallet_balance_after:null
  };
  const upsert=await capvoUpsertCycleIncomeWithWallet(incomePayload);
  if(upsert.error)throw upsert.error;
  if(upsert.legacy)return {applied:false,reason:'migration_missing',wallet,amount:value};

  const current=capvoWalletById(wallet.id)||wallet;
  const before=Number(current.currentBalance)||0;
  const after=capvoMoney(before+value);

  await capvoUpdateWalletBalance(wallet.id,after);
  try{
    await capvoMarkCycleIncomeWalletDeposit(ownerUserId,cycle.id,rowKey,wallet.id,before,after);
  }catch(markError){
    try{ await capvoUpdateWalletBalance(wallet.id,before); }catch(rollbackError){ console.error('cycle wallet rollback failed:',rollbackError); }
    throw markError;
  }

  return {applied:true,wallet,before,after,amount:value};
}

async function capvoReverseCycleIncomeWalletDeposits(ownerUserId,cycle){
  if(!ownerUserId || !cycle?.id)return {reversed:0,total:0};
  const {data,error}=await supabaseClient
    .from('budget_cycle_incomes')
    .select('*')
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycle.id);
  if(error)throw error;

  let reversed=0,total=0;
  for(const row of (data||[])){
    if(!row.wallet_deposit_applied || !row.destination_wallet_id)continue;
    const amount=Number(row.amount)||0;
    if(amount<=0)continue;
    const wallet=capvoWalletById(row.destination_wallet_id);
    if(!wallet)continue;
    await capvoUpdateWalletBalance(wallet.id,capvoMoney((Number(wallet.currentBalance)||0)-amount));
    reversed++;
    total=capvoMoney(total+amount);
  }
  return {reversed,total};
}



function capvoSalaryToDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
  }
  if(typeof value==='string'){
    if(typeof capvoParseDateKey==='function'){
      const parsed=capvoParseDateKey(value);
      if(parsed)return parsed;
    }
    const d=new Date(value);
    if(!Number.isNaN(d.getTime()))return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
    return null;
  }
  if(value && typeof value==='object' && typeof value.getTime==='function' && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
  }
  const d=new Date(value);
  if(!Number.isNaN(d.getTime()))return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
  return null;
}

function capvoSalaryDateKey(value){
  // v1.9.5.4: Date objects must not go through capvoParseDateKey(String(Date)).
  // That was the reason payday always fell back to today.
  const d=capvoSalaryToDate(value);
  if(!d)return todayISO();
  return typeof capvoDateKey==='function'?capvoDateKey(d):d.toISOString().slice(0,10);
}

function capvoSalaryMonthStartKey(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const start=new Date(safe.getFullYear(),safe.getMonth(),1,12);
  return capvoSalaryDateKey(start);
}

function capvoSalaryMonthEndKey(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const end=new Date(safe.getFullYear(),safe.getMonth()+1,0,12);
  return capvoSalaryDateKey(end);
}


function capvoSalaryRuleStorageKey(){
  const owner=typeof getFinanceUserId==='function' ? getFinanceUserId() : '';
  return `capvo.salaryRule.v1.${owner||'local'}`;
}

function capvoSaveSalaryRuleLocal(type,day){
  try{
    const payload={
      type:normalizeBudgetCycleType(type||'fixed_day'),
      day:capvoClampCycleDay(day||1),
      updatedAt:new Date().toISOString()
    };
    localStorage.setItem(capvoSalaryRuleStorageKey(),JSON.stringify(payload));
  }catch(e){}
}

function capvoReadSalaryRuleLocal(){
  try{
    const raw=localStorage.getItem(capvoSalaryRuleStorageKey());
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    const type=normalizeBudgetCycleType(parsed?.type||'fixed_day');
    const day=capvoClampCycleDay(parsed?.day||1);
    return {type,day};
  }catch(e){
    return null;
  }
}

function capvoGetSalaryRuleForStatus(){
  const localRule=capvoReadSalaryRuleLocal();
  const prefs=D?.preferences||{};
  const prefType=normalizeBudgetCycleType(prefs.budgetCycleType || prefs.budget_cycle_type || 'fixed_day');
  const prefDay=capvoClampCycleDay(prefs.budgetCycleStartDay ?? prefs.budget_cycle_start_day ?? 1);

  // Prefer the local rule right after saving because the dashboard may render
  // before Supabase/fetchAllData has fully refreshed preferences.
  if(localRule && (localRule.type==='last_working_day' || localRule.day>0)){
    return localRule;
  }

  return {type:prefType,day:prefDay};
}


function capvoExpectedPaydayForMonth(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const rule=capvoGetSalaryRuleForStatus();
  const type=rule.type;
  if(type==='last_working_day' && typeof capvoLastWorkingDayOfMonth==='function'){
    return capvoSalaryDateKey(capvoLastWorkingDayOfMonth(safe.getFullYear(),safe.getMonth()));
  }
  const day=capvoClampCycleDay(rule.day||1);
  const lastDay=new Date(safe.getFullYear(),safe.getMonth()+1,0,12).getDate();
  return capvoSalaryDateKey(new Date(safe.getFullYear(),safe.getMonth(),Math.min(day,lastDay),12));
}

function capvoSalaryPeriodFromDate(dateKey){
  return {
    startKey:capvoSalaryMonthStartKey(dateKey),
    endKey:capvoSalaryMonthEndKey(dateKey)
  };
}

function capvoSalaryIsRecorded(walletId,periodStartKey){
  if(!walletId || !periodStartKey)return false;
  if(typeof capvoMonthlySalaryAlreadyRecorded==='function'){
    return capvoMonthlySalaryAlreadyRecorded(walletId,periodStartKey);
  }
  return false;
}

function capvoGetSalaryDepositContext(primaryWallet){
  const today=todayISO();
  const walletId=primaryWallet?.id||'';
  const now=typeof capvoParseDateKey==='function'?capvoParseDateKey(today):new Date();

  const build=(offset)=>{
    const ref=new Date(now.getFullYear(),now.getMonth()+offset,1,12);
    const paydayKey=capvoExpectedPaydayForMonth(ref);
    const period=capvoSalaryPeriodFromDate(paydayKey);
    const recorded=capvoSalaryIsRecorded(walletId,period.startKey);
    return {paydayKey,periodStartKey:period.startKey,periodEndKey:period.endKey,recorded,offset};
  };

  // v1.9.5.2: prefer the current month's payday for normal testing and daily use.
  // Previous month is considered only for a very recent missed payday, so a new
  // user created mid-month does not suddenly see an old unpaid salary from the
  // previous month.
  const current=build(0);
  if(current.recorded){
    return {
      ...current,
      state:'recorded',
      isPending:false,
      isOverdue:false,
      todayKey:today
    };
  }

  if(String(current.paydayKey)<=String(today)){
    return {
      ...current,
      state:String(current.paydayKey)===String(today)?'due':'overdue',
      isPending:true,
      isOverdue:String(current.paydayKey)<String(today),
      todayKey:today
    };
  }

  const previous=build(-1);
  if(!previous.recorded && String(previous.paydayKey)<=String(today)){
    const prevDate=typeof capvoParseDateKey==='function'?capvoParseDateKey(previous.paydayKey):new Date(previous.paydayKey);
    const todayDate=typeof capvoParseDateKey==='function'?capvoParseDateKey(today):new Date();
    const diffDays=Math.round((todayDate-prevDate)/(1000*60*60*24));
    if(diffDays>=0 && diffDays<=7){
      return {
        ...previous,
        state:'overdue',
        isPending:true,
        isOverdue:true,
        todayKey:today
      };
    }
  }

  return {
    ...current,
    state:'upcoming',
    isPending:false,
    isOverdue:false,
    todayKey:today
  };
}


function capvoMonthlySalaryIncomeKey(walletId,periodStartKey){
  return `wallet:${walletId}:salary:${periodStartKey}`;
}

function capvoMonthlySalaryAlreadyRecorded(walletId,periodStartKey){
  const key=capvoMonthlySalaryIncomeKey(walletId,periodStartKey);
  return (D.budgetCycleIncomes||[]).some(row=>
    String(row.incomeSourceId||row.income_source_id||'')===key &&
    (row.walletDepositApplied===true || row.wallet_deposit_applied===true || Number(row.amount)>0)
  );
}

async function createPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const primaryWallet=capvoPaidTodayPrimaryWallet();
  const cycleAmount=Number(primaryWallet?.cycleIncomeAmount)||0;
  if(!primaryWallet || cycleAmount<=0){
    showMiniToast('Όρισε πρώτα βασικό λογαριασμό budget και μισθό/ποσό μήνα.','error');
    go('vWallets',document.querySelector('[data-v="vWallets"]'));
    return;
  }

  const salaryContext=capvoGetSalaryDepositContext(primaryWallet);
  if(salaryContext.state==='recorded'){
    showMiniToast('Ο μισθός έχει ήδη καταχωρηθεί για αυτή τη μηνιαία περίοδο.','info');
    return;
  }

  const periodStartKey=salaryContext.periodStartKey;
  const periodEndKey=salaryContext.periodEndKey;
  const salaryKey=capvoMonthlySalaryIncomeKey(primaryWallet.id,periodStartKey);

  if(capvoMonthlySalaryAlreadyRecorded(primaryWallet.id,periodStartKey)){
    showMiniToast('Ο μισθός έχει ήδη καταχωρηθεί για αυτή τη μηνιαία περίοδο.','info');
    return;
  }

  const preview=capvoBuildPaidTodayPreview(primaryWallet,cycleAmount,periodStartKey,periodEndKey,salaryContext);
  const ok=await showPaidTodayPreviewModal(preview);
  if(!ok)return;

  const opDetail=salaryContext.isOverdue
    ? `Εκκρεμεί από ${formatGreekFullDate(salaryContext.paydayKey)}. Προσθέτω ${fmt(cycleAmount)} στο ${primaryWallet.name}.`
    : `Προσθέτω ${fmt(cycleAmount)} στο ${primaryWallet.name}.`;
  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Καταχωρείται μισθός...',opDetail))return;

  try{
    const cyclePayload={
      user_id:ownerUserId,
      start_date:periodStartKey,
      end_date:periodEndKey,
      cycle_key:periodStartKey,
      source:'normal',
      primary_income_source_id:salaryKey,
      primary_income_amount:cycleAmount,
      note:`Καταχώρηση μισθού μηνιαίας περιόδου · payday ${salaryContext.paydayKey} ${capvoEncodePaidTodayMeta(preview)}`,
      updated_at:new Date().toISOString()
    };

    const {data:cycleRows,error:cycleError}=await supabaseClient
      .from('budget_cycles')
      .upsert(cyclePayload,{onConflict:'user_id,cycle_key'})
      .select('*')
      .limit(1);

    if(cycleError)throw cycleError;

    const cycle=(cycleRows||[])[0];
    let applyResult={applied:false,reason:'no_cycle'};
    if(cycle?.id){
      applyResult=await capvoApplyCycleAmountToWallet({
        ownerUserId,
        cycle,
        wallet:primaryWallet,
        amount:cycleAmount,
        incomeSourceId:salaryKey,
        name:salaryContext.isOverdue?'Εκκρεμής μισθός μηνιαίας περιόδου':'Μισθός μηνιαίας περιόδου',
        incomeType:primaryWallet.type||'wallet'
      });
    }

    await fetchAllData(ownerUserId);
    render();
    renderBudgetCycleManager?.();

    const suffix=applyResult.applied
      ? ` · Προστέθηκαν ${fmt(cycleAmount)} στο ${primaryWallet.name}`
      : applyResult.reason==='already_applied'
        ? ' · Ο μισθός είχε ήδη περαστεί'
        : applyResult.reason==='migration_missing'
          ? ' · Χρειάζεται το νέο SQL για αυτόματη πίστωση'
          : '';

    const msg=`✅ Ο μισθός καταχωρήθηκε${suffix}`;
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',msg);
    showMiniToast(msg);

  }catch(e){
    console.error('createPaidTodayCycle failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να καταχωρήσω τον μισθό.');
    showMiniToast('Δεν μπόρεσα να καταχωρήσω τον μισθό.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

async function capvoFindCurrentSalaryDepositForUndo(ownerUserId,primaryWallet,period){
  if(!ownerUserId || !primaryWallet?.id || !period?.startKey)return null;
  const salaryKey=capvoMonthlySalaryIncomeKey(primaryWallet.id,period.startKey);
  const cycle=(D.budgetCycles||[]).find(c=>String(c.cycleKey||c.cycle_key||'')===String(period.startKey));
  if(!cycle?.id)return null;

  const {data:rows,error}=await supabaseClient
    .from('budget_cycle_incomes')
    .select('*')
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycle.id)
    .eq('income_source_id',salaryKey)
    .limit(1);
  if(error)throw error;

  return {
    cycle,
    row:(rows||[])[0]||null,
    salaryKey
  };
}

function showSalaryUndoPreviewModal({wallet,amount,before,after,periodLabel}){
  return new Promise(resolve=>{
    const old=document.getElementById('capvoSalaryUndoOverlay');
    if(old)old.remove();

    const negative=Number(after)<0;
    const overlay=document.createElement('div');
    overlay.id='capvoSalaryUndoOverlay';
    overlay.className='capvo-paid-preview-overlay capvo-salary-undo-overlay';
    overlay.innerHTML=`
      <section class="capvo-paid-preview-sheet capvo-salary-undo-sheet" role="dialog" aria-modal="true" aria-label="Αναίρεση μισθού">
        <button type="button" class="capvo-paid-preview-close" aria-label="Κλείσιμο">×</button>

        <div class="capvo-paid-preview-hero">
          <div class="capvo-paid-preview-icon">${negative?'⚠️':'↩️'}</div>
          <div>
            <span>Αναίρεση μισθού</span>
            <h3>${negative?'Το wallet θα πάει αρνητικό':'Έλεγξε τι θα αλλάξει'}</h3>
            <p>${esc(periodLabel||'Τρέχουσα μηνιαία περίοδος')}</p>
          </div>
        </div>

        <div class="capvo-paid-preview-total ${negative?'is-warning':''}">
          <span>Υπόλοιπο μετά την αναίρεση</span>
          <strong>${fmt(after)}</strong>
          <small>Θα αφαιρεθεί μόνο ο μισθός. Οι υπόλοιπες κινήσεις του μήνα δεν θα διαγραφούν.</small>
        </div>

        <div class="capvo-paid-preview-steps">
          <div class="capvo-paid-preview-row">
            <span>Wallet</span>
            <strong>${esc(wallet?.name||'Primary wallet')}</strong>
          </div>
          <div class="capvo-paid-preview-row">
            <span>Τρέχον υπόλοιπο</span>
            <strong>${fmt(before)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-minus">
            <span>Μισθός που θα αφαιρεθεί</span>
            <strong>-${fmt(amount)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-subtotal">
            <span>Νέο υπόλοιπο</span>
            <strong>${fmt(after)}</strong>
          </div>
        </div>

        <div class="capvo-paid-preview-note ${negative?'warning':''}">
          <strong>${negative?'Προσοχή':'Τι θα γίνει'}</strong>
          <span>${negative
            ? 'Το υπόλοιπο του wallet θα γίνει αρνητικό. Συνέχισε μόνο αν όντως ο μισθός είχε καταχωρηθεί λάθος.'
            : 'Θα αφαιρεθεί μόνο η καταχώρηση μισθού από το primary wallet. Έξοδα, μεταφορές, κάρτες και πάγια μένουν όπως είναι.'}</span>
        </div>

        <div class="capvo-paid-preview-actions">
          <button type="button" class="capvo-paid-preview-secondary">Άκυρο</button>
          <button type="button" class="capvo-paid-preview-primary ${negative?'danger':''}">Συνέχεια με αναίρεση</button>
        </div>
      </section>`;

    const close=(answer)=>{
      overlay.classList.remove('active');
      setTimeout(()=>overlay.remove(),160);
      resolve(!!answer);
    };

    overlay.addEventListener('click',e=>{ if(e.target===overlay)close(false); });
    overlay.querySelector('.capvo-paid-preview-close')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-secondary')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-primary')?.addEventListener('click',()=>close(true));

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('active'));
  });
}


async function undoCurrentPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  const primaryWallet=capvoPaidTodayPrimaryWallet();
  const period=getCurrentBudgetCycle();
  if(!ownerUserId || !primaryWallet || !period?.startKey)return;

  try{
    const found=await capvoFindCurrentSalaryDepositForUndo(ownerUserId,primaryWallet,period);
    if(!found?.cycle?.id){
      showMiniToast('Δεν βρέθηκε καταχώρηση μισθού για αυτή την περίοδο.','info');
      return;
    }

    const row=found.row;
    if(!row){
      showMiniToast('Δεν βρέθηκε μισθός για αναίρεση.','info');
      return;
    }

    const amount=capvoMoney(Number(row.amount)||0);
    const wallet=capvoWalletById(row.destination_wallet_id)||primaryWallet;
    const before=capvoMoney(Number(wallet?.currentBalance)||0);
    const after=capvoMoney(before-amount);

    const ok=await showSalaryUndoPreviewModal({
      wallet,
      amount,
      before,
      after,
      periodLabel:period.label
    });
    if(!ok)return;

    if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Γίνεται αναίρεση μισθού...', `Αφαιρώ ${fmt(amount)} από ${wallet?.name||'wallet'}.`))return;

    try{
      if(row.wallet_deposit_applied && row.destination_wallet_id && amount>0){
        if(wallet){
          await capvoUpdateWalletBalance(wallet.id,after);
        }
      }

      const {error:incomeError}=await supabaseClient
        .from('budget_cycle_incomes')
        .delete()
        .eq('user_id',ownerUserId)
        .eq('cycle_id',found.cycle.id)
        .eq('income_source_id',found.salaryKey);
      if(incomeError)throw incomeError;

      await fetchAllData(ownerUserId);
      render();
      renderBudgetCycleManager?.();

      capvoAppOperationSuccess?.('Ολοκληρώθηκε','Ο μισθός της περιόδου αναιρέθηκε. Οι υπόλοιπες κινήσεις έμειναν όπως ήταν.');
      showMiniToast('✅ Ο μισθός της περιόδου αναιρέθηκε');
    }catch(e){
      console.error('undo salary event failed:',e);
      capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αναιρέσω τον μισθό.');
      showMiniToast('Δεν μπόρεσα να αναιρέσω τον μισθό.','error');
    }finally{
      if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    }
  }catch(error){
    console.error('undo salary preview failed:',error);
    showMiniToast('Δεν μπόρεσα να ετοιμάσω την αναίρεση μισθού.','error');
  }
}


// ===== END 02b-data-save.js =====
