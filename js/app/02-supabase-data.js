// CAPVO app split: 02-supabase-data.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== SUPABASE DATA OPERATIONS =====
function getFinanceUserId(explicitUserId){
  return String(explicitUserId || getDataOwnerId() || '').trim();
}

function legacyUserChatId(){
  return String((typeof getLegacyOwnerId==='function' ? getLegacyOwnerId() : '') || '').trim();
}

async function fetchAllData(userId){
  const ownerUserId=getFinanceUserId(userId);

  try{
    if(!ownerUserId){
      D={income:0,incomeSources:[],fixedExpenses:[],creditCards:[],months:{},preferences:{budgetCycleType:'fixed_day',budgetCycleStartDay:1,currency:'EUR',language:'el'},budgetCycles:[],budgetCycleIncomes:[],budgetCycleCarryovers:[],holidaysByYear:{},holidaysLoadedYears:{},holidayFetchStatus:'idle'};
      refreshComputedIncome();
      return;
    }

    const {data:prefRows,error:errPrefs}=await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id',ownerUserId)
      .limit(1);

    if(errPrefs)throw errPrefs;

    const prefs=(prefRows||[])[0]||{};
    D.preferences={
      budgetCycleType:normalizeBudgetCycleType(prefs.budget_cycle_type),
      budgetCycleStartDay:capvoClampCycleDay(prefs.budget_cycle_start_day||1),
      currency:prefs.currency||'EUR',
      language:prefs.language||'el'
    };

    if(typeof capvoEnsureBudgetCycleHolidays==='function'){
      await capvoEnsureBudgetCycleHolidays();
    }

    const {data:incomeSources,error:errIncomeSources}=await supabaseClient
      .from('income_sources')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errIncomeSources)throw errIncomeSources;

    D.incomeSources=(incomeSources||[]).map(i=>({
      id:i.id,
      name:i.name,
      amount:Number(i.amount)||0,
      category:i.category||'Άλλο',
      incomeType:i.income_type||'cash',
      includeInBudget:i.include_in_budget,
      isSavings:i.is_savings,
      isRecurring:i.is_recurring,
      restriction:i.restriction||'none',
      restrictedCategory:i.restricted_category||'',
      notes:i.notes||'',
      isPrimaryIncome:!!i.is_primary_income
    }));

    const {data:budgetCycles,error:errBudgetCycles}=await supabaseClient
      .from('budget_cycles')
      .select('*')
      .eq('user_id',ownerUserId)
      .order('start_date',{ascending:false});

    if(errBudgetCycles)throw errBudgetCycles;

    D.budgetCycles=(budgetCycles||[]).map(c=>({
      id:c.id,
      userId:c.user_id,
      startDate:c.start_date,
      endDate:c.end_date,
      cycleKey:c.cycle_key,
      source:c.source||'normal',
      primaryIncomeSourceId:c.primary_income_source_id||'',
      primaryIncomeAmount:Number(c.primary_income_amount)||0,
      note:c.note||'',
      createdAt:c.created_at||'',
      updatedAt:c.updated_at||''
    }));

    const {data:cycleIncomes,error:errCycleIncomes}=await supabaseClient
      .from('budget_cycle_incomes')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errCycleIncomes)throw errCycleIncomes;

    D.budgetCycleIncomes=(cycleIncomes||[]).map(i=>({
      id:i.id,
      userId:i.user_id,
      cycleId:i.cycle_id,
      incomeSourceId:i.income_source_id||'',
      name:i.name||'',
      amount:Number(i.amount)||0,
      incomeType:i.income_type||'',
      createdAt:i.created_at||''
    }));

    try{
      const {data:carryovers,error:errCarryovers}=await supabaseClient
        .from('budget_cycle_carryovers')
        .select('*')
        .eq('user_id',ownerUserId);

      if(errCarryovers)throw errCarryovers;

      D.budgetCycleCarryovers=(carryovers||[]).map(c=>({
        id:c.id,
        userId:c.user_id,
        fromCycleKey:c.from_cycle_key,
        fromCycleStart:c.from_cycle_start,
        fromCycleEnd:c.from_cycle_end,
        toCycleKey:c.to_cycle_key,
        toCycleStart:c.to_cycle_start,
        toCycleEnd:c.to_cycle_end,
        amount:Number(c.amount)||0,
        action:c.action||'skip',
        note:c.note||'',
        createdAt:c.created_at||'',
        updatedAt:c.updated_at||''
      }));
    }catch(errCarryovers){
      D.budgetCycleCarryovers=[];
      console.warn('[CAPVO] budget_cycle_carryovers unavailable. Run v1.1.4.3 SQL migration.',errCarryovers?.message||errCarryovers);
    }



    try{
      const {data:goals,error:errGoals}=await supabaseClient
        .from('savings_goals')
        .select('*')
        .eq('user_id',ownerUserId)
        .order('created_at',{ascending:false});

      if(errGoals)throw errGoals;

      D.savingsGoals=(goals||[]).map(g=>({
        id:g.id,
        userId:g.user_id,
        name:g.name||'Κουμπαράς',
        icon:g.icon||'🏦',
        targetAmount:Number(g.target_amount)||0,
        currentAmount:Number(g.current_amount)||0,
        targetDate:g.target_date||'',
        goalType:g.goal_type||'general',
        isDefault:!!g.is_default,
        isArchived:!!g.is_archived,
        notes:g.notes||'',
        status:g.status||'',
        completedAt:g.completed_at||'',
        createdAt:g.created_at||'',
        updatedAt:g.updated_at||''
      }));

      const {data:txs,error:errTxs}=await supabaseClient
        .from('savings_transactions')
        .select('*')
        .eq('user_id',ownerUserId)
        .order('created_at',{ascending:false});

      if(errTxs)throw errTxs;

      D.savingsTransactions=(txs||[]).map(t=>({
        id:t.id,
        userId:t.user_id,
        goalId:t.goal_id,
        amount:Number(t.amount)||0,
        type:t.type||'deposit',
        source:t.source||'manual',
        note:t.note||'',
        relatedCycleKey:t.related_cycle_key||'',
        createdAt:t.created_at||''
      }));
    }catch(errSavings){
      D.savingsGoals=[];
      D.savingsTransactions=[];
      console.warn('[CAPVO] savings tables unavailable. Run v1.1.5.1 SQL migration.',errSavings?.message||errSavings);
    }

    refreshComputedIncome();

    const {data:fixed,error:errFixed}=await supabaseClient
      .from('fixed_expenses')
      .select('id,user_id,user_chat_id,name,amount,category,created_at')
      .eq('user_id',ownerUserId);

    if(errFixed)throw errFixed;

    D.fixedExpenses=(fixed||[])
      .map(e=>({
        id:e.id,
        name:e.name,
        amount:Number(e.amount)||0,
        category:e.category||'Άλλο',
        createdAt:e.created_at||''
      }))
      .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a));

    const {data:cards,error:errCards}=await supabaseClient
      .from('credit_cards')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errCards)throw errCards;

    D.creditCards=(cards||[]).map(c=>({
      id:c.id,
      name:c.name,
      balance:c.balance||0,
      rate:c.rate||0,
      minPay:c.min_pay||0,
      limit:c.limit_amount||0,
      chosenPay:c.chosen_pay||0
    }));

    const {data:daily,error:errDaily}=await supabaseClient
      .from('expenses')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errDaily)throw errDaily;

    D.months={};

    (daily||[]).forEach(e=>{
      const mk=e.month_key||(e.date?e.date.substring(0,7):curMK());
      if(!D.months[mk])D.months[mk]={daily:[]};
      D.months[mk].daily.push({
        id:e.id,
        name:e.name,
        amount:e.amount,
        category:e.category,
        date:e.date,
        paymentSourceId:e.payment_source_id||'',
        paymentSourceName:e.payment_source_name||'',
        paymentSourceType:e.payment_source_type||''
      });
    });

  }catch(e){
    console.error('Fetch error:',e);
    throw e;
  }
}

async function syncIncomeSources(userId){
  const ownerUserId=getFinanceUserId(userId);
  const legacyOwner=legacyUserChatId() || ownerUserId;

  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  if(!Array.isArray(D.incomeSources)){
    D.incomeSources=[];
  }

  if(D.incomeSources.length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .upsert(
        D.incomeSources.map(i=>({
          id:i.id,
          user_id:ownerUserId,
          user_chat_id:legacyOwner,
          name:i.name,
          amount:i.amount,
          category:i.category,
          income_type:i.incomeType,
          include_in_budget:i.includeInBudget,
          is_savings:i.isSavings,
          is_recurring:i.isRecurring,
          restriction:i.restriction,
          restricted_category:i.restrictedCategory||null,
          notes:i.notes||null,
          is_primary_income:!!i.isPrimaryIncome,
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );

    if(error)throw error;
  }

  const {data:dbRows,error:fetchError}=await supabaseClient
    .from('income_sources')
    .select('id')
    .eq('user_id',ownerUserId);

  if(fetchError)throw fetchError;

  const appIds=new Set(
    D.incomeSources
      .filter(i=>i && i.id)
      .map(i=>i.id)
  );

  const idsToDelete=(dbRows||[])
    .filter(i=>!appIds.has(i.id))
    .map(i=>i.id);

  if(idsToDelete.length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .delete()
      .in('id',idsToDelete);

    if(error)throw error;
  }
}

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
          category:e.category
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
          chosen_pay:c.chosenPay
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
        allDaily.push({
          id:e.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:e.name,
          amount:e.amount,
          category:e.category,
          date:e.date,
          type:'daily',
          month_key:monthKey,
          payment_source_id:e.paymentSourceId||null,
          payment_source_name:e.paymentSourceName||null,
          payment_source_type:e.paymentSourceType||null
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

function renderPaymentSourcesSummary(){
  const el=$('paymentSourcesSummary');
  if(!el)return;

  const widget=el.closest('.payment-sources-widget');
  const titleEl=widget?.querySelector('.section-title');
  const restricted=(D.incomeSources||[])
    .filter(i=>typeof isRestrictedPaymentSource==='function'?isRestrictedPaymentSource(i):(i.restriction && i.restriction!=='none'))
    .map(i=>({
      ...i,
      _remaining:paymentSourceRemaining(i),
      _total:Number(i.amount)||0
    }))
    .sort((a,b)=>(b._remaining||0)-(a._remaining||0));

  if(restricted.length===0){
    if(widget)widget.style.display='none';
    if(titleEl)titleEl.textContent='🎫 Voucher / Ticket';
    el.innerHTML='';
    el.className='payment-sources-grid';
    return;
  }

  const totalAvailable=restricted.reduce((sum,i)=>sum+(Number(i._remaining)||0),0);
  const totalLimit=restricted.reduce((sum,i)=>sum+(Number(i._total)||0),0);
  const countLabel=restricted.length===1?'1 πηγή':`${restricted.length} πηγές`;

  if(widget){
    widget.style.display='block';
    widget.classList.toggle('has-many-payment-sources',restricted.length>1);
  }

  if(titleEl){
    titleEl.innerHTML=`
      <span class="payment-sources-title-main">🎫 Voucher / Ticket</span>
      <small class="payment-sources-title-sub">${countLabel} • ${fmt(totalAvailable)} διαθέσιμα</small>
    `;
  }

  el.className=`payment-sources-grid payment-sources-carousel ${restricted.length===1?'is-single':'is-carousel'}`;

  const cards=restricted.map(i=>{
    const remaining=Number(i._remaining)||0;
    const total=Number(i._total)||0;
    const used=Math.max(0,total-remaining);
    const pct=total>0?Math.min(100,Math.round(used/total*100)):0;
    const remainingPct=total>0?Math.max(0,Math.round(remaining/total*100)):0;
    const icon=i.restriction==='food_only'?'🍽️':'🎫';
    const status=remaining<=0?'empty':(remainingPct<=20?'low':'ok');

    return`
      <article class="payment-source-mini-card payment-source-wallet-card is-${status}">
        <div class="payment-source-card-top">
          <div class="widget-icon teal">${icon}</div>
          <span class="payment-source-chip">${remainingPct}%</span>
        </div>

        <div class="payment-source-mini-content">
          <div class="stat-label">${esc(i.name)}</div>
          <div class="stat-value teal">${fmt(remaining)}</div>
          <div class="payment-mini-meta">διαθέσιμα / ${fmt(total)}</div>

          <div class="payment-mini-bar" aria-label="Χρήση ${pct}%">
            <div class="payment-mini-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  const viewAll=`
    <button type="button" class="payment-source-view-all" onclick="go('vIncome',document.querySelector('[data-v=vIncome]'))">
      <span>Προβολή όλων</span>
      <strong>${fmt(totalAvailable)}</strong>
      <small>σύνολο διαθέσιμο</small>
    </button>
  `;

  el.innerHTML=cards+(restricted.length>1?viewAll:'');
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
    const day=capvoClampCycleDay(input?.value || D?.preferences?.budgetCycleStartDay || 1);
    ruleLabel.textContent=normalized==='last_working_day'
      ? 'Πληρώνομαι την τελευταία εργάσιμη του μήνα'
      : `Πληρώνομαι κάθε ${day} του μήνα`;
  }
  const help=$('cycleManagerRuleHelp');
  if(help){
    help.textContent=normalized==='last_working_day'
      ? `${typeof getHolidayAwareRuleText==='function'?getHolidayAwareRuleText():'Το CAPVO υπολογίζει Σαββατοκύριακα και ελληνικές αργίες.'} Η ημέρα πληρωμής ξεκινά τον επόμενο κύκλο.`
      : 'Η ημέρα που επιλέγεις είναι η πρώτη μέρα του νέου οικονομικού κύκλου.';
  }
}
async function saveBudgetCyclePreference(inputId='settingsBudgetCycleDay'){
  const ownerUserId=getFinanceUserId();
  const input=$(inputId)||$('settingsBudgetCycleDay')||$('cycleManagerBudgetCycleDay');
  const raw=input?input.value:1;
  const day=capvoClampCycleDay(raw);
  const type=getSelectedBudgetCycleType();

  if(input)input.value=String(day);
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
      budgetCycleStartDay:day
    };

    curM=curMK();
    ensM(curM);
    render();
    renderBudgetCycleManager?.();
    showMiniToast(type==='last_working_day'?'✅ Ο κύκλος θα ξεκινά την τελευταία εργάσιμη':'✅ Ο οικονομικός κύκλος ενημερώθηκε');
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
async function createPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const currentCycle=getCurrentBudgetCycle();
  if(currentCycle?.source==='paid_today'){
    showMiniToast('Υπάρχει ήδη ενεργή πρόωρη πληρωμή. Κάνε πρώτα αναίρεση αν έγινε λάθος.','error');
    return;
  }

  const primary=getPrimaryIncomeSource();
  if(!primary){
    showMiniToast('Όρισε πρώτα ποια πηγή είναι το βασικό budget σου.','error');
    go('vIncome',document.querySelector('[data-v=vIncome]'));
    setTimeout(()=>openModal('incomeSource'),120);
    return;
  }

  const today=todayISO();
  const endKey=getPaidTodayCycleEnd(today);
  const already=(D.budgetCycles||[]).find(c=>c.startDate===today && c.source==='paid_today');
  if(already){showMiniToast('Υπάρχει ήδη κύκλος που ξεκίνησε σήμερα.');return;}

  const ok=await showConfirmModal({
    title:'Πληρώθηκες σήμερα;',
    message:`Θα ξεκινήσει νέος οικονομικός κύκλος από σήμερα έως ${formatGreekFullDate(endKey)} και θα χρησιμοποιηθεί το βασικό budget: ${primary.name} (${fmt(primary.amount)}). Τα έξοδά σου δεν θα διαγραφούν.`,
    confirmText:'Ναι, πληρώθηκα'
  });
  if(!ok)return;

  const cyclePayload={
    user_id:ownerUserId,
    start_date:today,
    end_date:endKey,
    cycle_key:today,
    source:'paid_today',
    primary_income_source_id:primary.id,
    primary_income_amount:Number(primary.amount)||0,
    note:'Πληρώθηκα σήμερα',
    updated_at:new Date().toISOString()
  };

  const {data:cycleRows,error:cycleError}=await supabaseClient
    .from('budget_cycles')
    .upsert(cyclePayload,{onConflict:'user_id,cycle_key'})
    .select('*')
    .limit(1);
  if(cycleError){console.error('createPaidTodayCycle failed:',cycleError);showMiniToast('Δεν μπόρεσα να ξεκινήσω νέο κύκλο.','error');return;}

  const cycle=(cycleRows||[])[0];
  if(cycle?.id){
    const incomePayload={
      user_id:ownerUserId,
      cycle_id:cycle.id,
      income_source_id:primary.id,
      name:primary.name,
      amount:Number(primary.amount)||0,
      income_type:primary.incomeType||'bank'
    };
    const {error:incomeError}=await supabaseClient
      .from('budget_cycle_incomes')
      .upsert(incomePayload,{onConflict:'cycle_id,income_source_id'});
    if(incomeError){console.error('create budget_cycle_income failed:',incomeError);showMiniToast('Ο κύκλος δημιουργήθηκε, αλλά δεν αποθηκεύτηκε το income του.','error');}
  }

  await fetchAllData(ownerUserId);
  render();
  renderBudgetCycleManager?.();
  showMiniToast('✅ Ο νέος οικονομικός κύκλος ξεκίνησε');
}
async function undoCurrentPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  const cycle=getCurrentBudgetCycle();
  if(!ownerUserId || !cycle?.id || cycle.source!=='paid_today')return;

  const ok=await showConfirmModal({
    title:'Αναίρεση πρόωρης πληρωμής',
    message:'Ο κύκλος που ξεκίνησε από το “Πληρώθηκα σήμερα” θα διαγραφεί και το Dashboard θα επιστρέψει στον κανονικό οικονομικό κύκλο. Τα έξοδά σου δεν θα διαγραφούν.',
    confirmText:'Αναίρεση'
  });
  if(!ok)return;

  const {error:incomeError}=await supabaseClient
    .from('budget_cycle_incomes')
    .delete()
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycle.id);
  if(incomeError){console.error('undo cycle incomes failed:',incomeError);showMiniToast('Δεν μπόρεσα να διαγράψω τα income του κύκλου.','error');return;}

  const {error:cycleError}=await supabaseClient
    .from('budget_cycles')
    .delete()
    .eq('user_id',ownerUserId)
    .eq('id',cycle.id);
  if(cycleError){console.error('undo cycle failed:',cycleError);showMiniToast('Δεν μπόρεσα να αναιρέσω τον κύκλο.','error');return;}

  await fetchAllData(ownerUserId);
  render();
  renderBudgetCycleManager?.();
  showMiniToast('✅ Η πρόωρη πληρωμή αναιρέθηκε');
}


function buildCarryoverPayload(ownerUserId,pending,action,note){
  const {previous,current,amount}=pending;
  return {
    user_id:ownerUserId,
    from_cycle_key:previous.startKey,
    from_cycle_start:previous.startKey,
    from_cycle_end:previous.endKey,
    to_cycle_key:current.startKey,
    to_cycle_start:current.startKey,
    to_cycle_end:current.endKey,
    amount:Number(amount)||0,
    action,
    note,
    updated_at:new Date().toISOString()
  };
}

async function upsertCycleCarryoverDecision(ownerUserId,pending,action,note){
  const payload=buildCarryoverPayload(ownerUserId,pending,action,note);
  const {error}=await supabaseClient
    .from('budget_cycle_carryovers')
    .upsert(payload,{onConflict:'user_id,from_cycle_key,to_cycle_key'});
  if(error)throw error;
}

async function saveCycleCarryoverDecision(action,options={}){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const pending=getPendingCycleCarryover();
  if(!pending){showMiniToast('Δεν υπάρχει υπόλοιπο προηγούμενου κύκλου για διαχείριση.','info');return;}

  const {previous,current,amount}=pending;
  const normalizedAction=action==='carry_to_next'?'carry_to_next':'skip';

  if(!options?.skipConfirm){
    const ok=await showConfirmModal({
      title:normalizedAction==='carry_to_next'?'Μεταφορά υπολοίπου':'Μην τα προσθέσεις στο budget',
      message:normalizedAction==='carry_to_next'
        ? `Θα μεταφερθούν ${fmt(amount)} από τον προηγούμενο κύκλο (${previous.label}) στον τρέχοντα κύκλο (${current.label}).`
        : `Το υπόλοιπο ${fmt(amount)} από τον προηγούμενο κύκλο δεν θα προστεθεί στο διαθέσιμο budget και δεν θα εμφανιστεί ξανά για αυτόν τον κύκλο.`,
      confirmText:normalizedAction==='carry_to_next'?'Μεταφορά':'Εκτός budget'
    });
    if(!ok)return;
  }

  try{
    await upsertCycleCarryoverDecision(
      ownerUserId,
      pending,
      normalizedAction,
      normalizedAction==='carry_to_next'?'Μεταφορά υπολοίπου προηγούμενου κύκλου':'Δεν προστέθηκε στο διαθέσιμο budget'
    );
  }catch(error){
    console.error('saveCycleCarryoverDecision failed:',error);
    showMiniToast('Δεν αποθηκεύτηκε η επιλογή υπολοίπου. Έλεγξε αν έχει τρέξει το SQL migration.','error');
    return;
  }

  if(typeof closeCycleCarryoverSheet==='function')closeCycleCarryoverSheet();
  await fetchAllData(ownerUserId);
  render();
  renderBudgetCycleManager?.();
  showMiniToast(normalizedAction==='carry_to_next'?'✅ Το υπόλοιπο μεταφέρθηκε στον κύκλο':'Το υπόλοιπο δεν προστέθηκε στο budget');
}

async function movePreviousCycleCarryoverToSavings(options={}){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const pending=getPendingCycleCarryover();
  if(!pending){showMiniToast('Δεν υπάρχει υπόλοιπο προηγούμενου κύκλου για διαχείριση.','info');return;}

  const {previous,current,amount}=pending;
  const safeAmount=Number(amount)||0;
  if(safeAmount<=0){showMiniToast('Δεν υπάρχει θετικό υπόλοιπο για αποταμίευση.','info');return;}

  if(!options?.skipConfirm){
    const ok=await showConfirmModal({
      title:'Μεταφορά σε αποταμίευση',
      message:`Θα δημιουργηθεί locked ποσό αποταμίευσης ${fmt(safeAmount)} από τον κύκλο ${previous.label}. Δεν θα προστεθεί στο διαθέσιμο budget του κύκλου ${current.label}.`,
      confirmText:'Αποταμίευση'
    });
    if(!ok)return;
  }

  const savingsId=`carry_savings_${ownerUserId}_${previous.startKey}_${current.startKey}`.replace(/[^a-zA-Z0-9_-]/g,'_');
  const savingsSource={
    id:savingsId,
    name:`Υπόλοιπο κύκλου ${previous.label}`,
    amount:safeAmount,
    category:'Αποταμίευση',
    incomeType:'bank',
    includeInBudget:false,
    isSavings:true,
    isRecurring:false,
    restriction:'locked',
    restrictedCategory:'',
    notes:`Από υπόλοιπο προηγούμενου κύκλου ${previous.label}`,
    isPrimaryIncome:false
  };

  try{
    if(typeof saveIncomeSourceRow==='function'){
      await saveIncomeSourceRow(ownerUserId,savingsSource);
    }else{
      const legacyOwner=String((typeof getLegacyOwnerId==='function' ? getLegacyOwnerId() : '') || ownerUserId).trim();
      const {error:sourceError}=await supabaseClient.from('income_sources').upsert({
        id:savingsSource.id,
        user_id:ownerUserId,
        user_chat_id:legacyOwner,
        name:savingsSource.name,
        amount:savingsSource.amount,
        category:savingsSource.category,
        income_type:savingsSource.incomeType,
        include_in_budget:false,
        is_savings:true,
        is_recurring:false,
        restriction:'locked',
        restricted_category:null,
        notes:savingsSource.notes,
        is_primary_income:false,
        updated_at:new Date().toISOString()
      },{onConflict:'id'});
      if(sourceError)throw sourceError;
    }

    await upsertCycleCarryoverDecision(
      ownerUserId,
      pending,
      'move_to_savings',
      'Μεταφορά υπολοίπου προηγούμενου κύκλου σε αποταμίευση'
    );
  }catch(error){
    console.error('movePreviousCycleCarryoverToSavings failed:',error);
    showMiniToast('Δεν αποθηκεύτηκε η αποταμίευση. Έλεγξε τα πεδία income_sources και το carryover SQL.','error');
    return;
  }

  if(typeof closeCycleCarryoverSheet==='function')closeCycleCarryoverSheet();
  await fetchAllData(ownerUserId);
  render();
  renderBudgetCycleManager?.();
  showMiniToast('✅ Το υπόλοιπο μεταφέρθηκε σε αποταμίευση');
}
function carryOverPreviousCycle(options={}){return saveCycleCarryoverDecision('carry_to_next',options);}
function skipPreviousCycleCarryover(options={}){return saveCycleCarryoverDecision('skip',options);}


function cycleDaysRemaining(cycle){
  try{
    const today=new Date();
    const todayMid=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
    const end=cycle?.end instanceof Date?cycle.end:capvoParseDateKey(cycle?.endKey||cycle?.endDate);
    if(!end)return 0;
    return Math.max(0,Math.ceil((end-todayMid)/86400000)+1);
  }catch(e){return 0;}
}
function openBudgetCycleManager(){
  closeM();
  document.body.classList.add('modal-open');
  const modal=$('mBudgetCycle');
  if(modal)modal.classList.add('active');
  renderBudgetCycleManager();
}
function renderBudgetCycleManager(){
  const cycle=getCurrentBudgetCycle();
  const primary=getPrimaryIncomeSource();
  const hasBudgetIncome=(D?.incomeSources||[]).some(i=>i.includeInBudget);
  const cycleDay=getBudgetCycleStartDay();
  const cycleType=getBudgetCycleType();
  const remaining=cycleDaysRemaining(cycle);
  const ruleLabel=getBudgetCycleRuleLabel();
  const primaryLabel=primary?`${primary.name} · ${fmt(primary.amount)}`:'Δεν έχει οριστεί';
  const primaryHelp=primary
    ? 'Αυτό είναι το ποσό που θα χρησιμοποιηθεί όταν πατήσεις “Πληρώθηκα σήμερα”. Ορίζεται από τα Έσοδα με την επιλογή “Χρήση ως βασικό budget”.'
    : hasBudgetIncome
      ? 'Έχεις καταχωρημένο εισόδημα, αλλά δεν έχεις επιλέξει ποια πηγή θα χρησιμοποιείται όταν πατήσεις “Πληρώθηκα σήμερα”. Πήγαινε στα Έσοδα και ενεργοποίησε “Χρήση ως βασικό budget”.'
      : 'Δεν υπάρχει ακόμα πηγή budget. Πρόσθεσε πρώτα εισόδημα από τα Έσοδα και όρισέ το ως βασικό budget.';
  const sourceLabel=cycle?.source==='paid_today'?'Πρόωρη πληρωμή':'Κανονικός κανόνας';
  const sourceText=cycle?.source==='paid_today'?'Ο κύκλος ξεκίνησε από το κουμπί “Πληρώθηκα σήμερα”.':'Ο κύκλος ακολουθεί τη μόνιμη ημέρα πληρωμής σου.';
  const isPaid=cycle?.source==='paid_today';
  const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  const goToPrimaryBudget=()=>{
    showMiniToast(primary?'Άνοιγμα εσόδων.':'Όρισε πρώτα ποια πηγή είναι το βασικό budget.','info');
    go('vIncome',document.querySelector('[data-v=vIncome]'));
    closeM();
  };

  setText('dashboardCycleLabel',cycle?.label||'—');
  setText('dashboardCycleMeta',formatNextPaydayMeta(cycle,{prefix:'Πληρωμή'}));
  const dashPaid=$('dashboardPaidTodayBtn');
  if(dashPaid){
    dashPaid.disabled=isPaid;
    dashPaid.classList.toggle('needs-primary',!primary && !isPaid);
    dashPaid.textContent=isPaid?'Πληρώθηκα ✓':primary?'Πληρώθηκα σήμερα':'Ορισμός budget';
    dashPaid.title=isPaid?'Υπάρχει ήδη ενεργή πρόωρη πληρωμή.':primary?'Ξεκίνα νέο κύκλο από σήμερα.':'Πρώτα όρισε βασικό budget από τα Έσοδα.';
    dashPaid.onclick=primary && !isPaid ? createPaidTodayCycle : goToPrimaryBudget;
  }

  setText('cycleManagerCurrentLabel',cycle?.label||'—');
  setText('cycleManagerCurrentMeta',formatNextPaydayMeta(cycle));
  setText('cycleManagerSourceBadge',sourceLabel);
  setText('cycleManagerRuleLabel',ruleLabel);
  setText('cycleManagerPrimaryIncomeLabel',primaryLabel);
  setText('cycleManagerPrimaryIncomeHelp',primaryHelp);

  syncBudgetCycleTypeControls(cycleType);
  const input=$('cycleManagerBudgetCycleDay');
  if(input && document.activeElement!==input)input.value=String(cycleDay);
  if(input)input.disabled=cycleType==='last_working_day';

  const paidNotice=$('cycleManagerPaidTodayNotice');
  if(paidNotice){
    paidNotice.classList.toggle('warning',!primary && !isPaid);
    paidNotice.style.display=(isPaid || !primary)?'':'none';
    paidNotice.innerHTML=isPaid
      ? `<strong>Ενεργή πρόωρη πληρωμή</strong><span>${sourceText} Από ${formatGreekFullDate(cycle.startKey)} έως ${formatGreekFullDate(cycle.endKey)}.</span>`
      : !primary
        ? '<strong>Χρειάζεται βασικό budget</strong><span>Για να ξεκινήσει νέος κύκλος από σήμερα, όρισε πρώτα μία πηγή εισοδήματος ως βασικό budget.</span>'
        : '';
  }

  const paidBtn=$('cycleManagerPaidTodayBtn');
  if(paidBtn){
    paidBtn.disabled=isPaid || !primary;
    paidBtn.textContent=isPaid?'Πληρώθηκα σήμερα ✓':'Πληρώθηκα σήμερα';
    paidBtn.title=!primary?'Πρώτα όρισε βασικό budget από τα Έσοδα.':isPaid?'Υπάρχει ήδη ενεργή πρόωρη πληρωμή.':'Ξεκίνα νέο κύκλο από σήμερα.';
  }
  const undoBtn=$('cycleManagerUndoPaidTodayBtn');
  if(undoBtn)undoBtn.style.display=isPaid?'':'none';

  const history=$('cycleManagerHistory');
  if(history){
    const rows=(D.budgetCycles||[]).slice()
      .sort((a,b)=>String(b.startDate||'').localeCompare(String(a.startDate||'')))
      .slice(0,3);
    history.innerHTML=rows.length?rows.map(c=>{
      const src=c.source==='paid_today'?'Πρόωρη πληρωμή':'Κύκλος';
      return `<div class="budget-cycle-history-row"><span>${esc(formatBudgetCycleDateRange(c.startDate,c.endDate))}</span><strong>${esc(src)}</strong></div>`;
    }).join(''):'<p>Δεν υπάρχουν αποθηκευμένοι ειδικοί κύκλοι ακόμα.</p>';
  }
}

function renderSettingsPage(){
  const root=$('vSettings');
  if(!root)return;

  const chatId=getTelegramChatId();
  const months=Object.keys(D.months||{}).sort();
  const dailyCount=Object.values(D.months||{})
    .reduce((sum,m)=>sum+((m.daily||[]).length),0);
  const fixedCount=(D.fixedExpenses||[]).length;
  const cardCount=(D.creditCards||[]).length;
  const incomeCount=(D.incomeSources||[]).length;
  const totalData=dailyCount+fixedCount+cardCount+incomeCount;
  const email=currentUser?.email||currentSession?.user?.email||'';

  const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  const monthLabel=(mk)=>{
    if(!mk || !mk.includes('-'))return 'Τρέχων μήνας';
    const [y,mo]=mk.split('-');
    return `${MG[(parseInt(mo,10)||1)-1]||''} ${y}`.trim();
  };

  const memberSince=monthLabel(months[0]||curM||curMK());
  const syncKey=chatId && typeof getSyncKey==='function'?getSyncKey():'';
  const lastTelegramId=syncKey?localStorage.getItem(syncKey):'';
  const syncLabel=chatId
    ? (lastTelegramId?'Έχει γίνει sync':'Μετά τον πρώτο συγχρονισμό')
    : 'Σύνδεσε Telegram για sync';

  const cycle=getCurrentBudgetCycle();
  const cycleDay=getBudgetCycleStartDay();
  const cycleType=getBudgetCycleType();
  renderBudgetCycleManager?.();
  const cycleInput=$('settingsBudgetCycleDay');
  if(cycleInput && document.activeElement!==cycleInput)cycleInput.value=String(cycleDay);
  if(cycleInput)cycleInput.disabled=cycleType==='last_working_day';
  setText('settingsBudgetCycleLabel',cycle.label);
  setText('settingsBudgetCycleRuleLabel',getBudgetCycleRuleShortLabel());
  setText('settingsBudgetCycleNext',cycle.nextStartKey ? formatGreekFullDate(cycle.nextStartKey) : '—');
  const primary=getPrimaryIncomeSource();
  setText('settingsPrimaryIncomeLabel',primary?`${primary.name} · ${fmt(primary.amount)}`:'Δεν έχει οριστεί');
  setText('settingsCycleSourceLabel',cycle.source==='paid_today'?'Πρόωρη πληρωμή':'Κανονικός κανόνας');
  const paidNotice=$('settingsPaidTodayNotice');
  if(paidNotice){
    paidNotice.style.display=cycle.source==='paid_today'?'':'none';
    paidNotice.innerHTML=cycle.source==='paid_today'
      ? `<strong>Ενεργή πρόωρη πληρωμή</strong><span>Ο κύκλος ξεκίνησε ${formatGreekFullDate(cycle.startKey)} και τελειώνει ${formatGreekFullDate(cycle.endKey)}.</span>`
      : '';
  }
  const paidTodayBtn=$('settingsPaidTodayBtn');
  if(paidTodayBtn){
    const isPaidCycle=cycle.source==='paid_today';
    paidTodayBtn.disabled=isPaidCycle;
    paidTodayBtn.textContent=isPaidCycle?'Πληρώθηκα σήμερα ✓':'Πληρώθηκα σήμερα';
    paidTodayBtn.title=isPaidCycle?'Υπάρχει ήδη ενεργή πρόωρη πληρωμή. Κάνε αναίρεση αν έγινε λάθος.':'';
  }
  const undoBtn=$('settingsUndoPaidTodayBtn');
  if(undoBtn)undoBtn.style.display=cycle.source==='paid_today'?'':'none';

  setText('settingsTelegramState',chatId?'Συνδεδεμένο':'Δεν έχει συνδεθεί');
  setText('settingsTelegramLabel',chatId?'🟢 Συνδεδεμένο':'⚪ Δεν έχει συνδεθεί');
  setText('settingsChatId',chatId||'—');
  setText('settingsTelegramLastSync',syncLabel);

  const telegramCard=document.querySelector('.settings-telegram-card');
  const telegramDesc=telegramCard?.querySelector('.settings-card-head p');
  const syncBtn=$('syncBtn');
  const switchBtn=$('changeTelegramBtn');

  if(telegramDesc){
    telegramDesc.innerHTML=chatId
      ? 'Τράβα αυτόματα τα έξοδα που έστειλες στο Telegram Bot.'
      : 'Σύνδεσε το Telegram bot για να καταχωρείς έξοδα με μήνυμα ή φωνή, χωρίς να ανοίγεις την εφαρμογή.<br><small>Παραδείγματα: “καφές 3”, “βενζίνη 20”, “σούπερ 25 ticket”</small>';
  }

  if(syncBtn){
    syncBtn.textContent=chatId?'Συγχρονισμός τώρα':'Σύνδεση Telegram';
    syncBtn.onclick=()=>{
      if(chatId){
        if(typeof syncFromTelegram==='function')syncFromTelegram();
      }else{
        switchChatId();
      }
    };
  }

  if(switchBtn){
    switchBtn.style.display=chatId?'':'none';
    switchBtn.textContent='Αλλαγή Telegram';
  }
  setText('settingsDataCount',String(totalData));
  setText('settingsMonthCount',String(months.length));
  setText('settingsTxCount',String(dailyCount));
  setText('settingsFixedCount',String(fixedCount));
  setText('settingsIncomeCount',String(incomeCount));
  setText('settingsCardCount',String(cardCount));
  setText('settingsMemberSince',memberSince);

  const account=$('settingsAccountEmail');
  if(account){
    account.textContent=email||'Google account συνδεδεμένο.';
  }
}
