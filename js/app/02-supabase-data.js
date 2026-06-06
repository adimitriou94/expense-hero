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
      D={income:0,incomeSources:[],fixedExpenses:[],creditCards:[],months:{},preferences:{budgetCycleType:'fixed_day',budgetCycleStartDay:1,currency:'EUR',language:'el'},budgetCycles:[],budgetCycleIncomes:[]};
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
      budgetCycleType:prefs.budget_cycle_type||'fixed_day',
      budgetCycleStartDay:capvoClampCycleDay(prefs.budget_cycle_start_day||1),
      currency:prefs.currency||'EUR',
      language:prefs.language||'el'
    };

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
    .filter(i=>i.restriction && i.restriction!=='none')
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


async function saveBudgetCyclePreference(){
  const ownerUserId=getFinanceUserId();
  const input=$('settingsBudgetCycleDay');
  const raw=input?input.value:1;
  const day=capvoClampCycleDay(raw);

  if(input)input.value=String(day);
  if(!ownerUserId){
    showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');
    return;
  }

  try{
    const payload={
      user_id:ownerUserId,
      budget_cycle_type:'fixed_day',
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
      budgetCycleType:'fixed_day',
      budgetCycleStartDay:day
    };

    curM=curMK();
    ensM(curM);
    render();
    showMiniToast('✅ Ο οικονομικός κύκλος ενημερώθηκε');
  }catch(e){
    console.error('saveBudgetCyclePreference failed:',e);
    showMiniToast('Δεν μπόρεσα να αποθηκεύσω τον οικονομικό κύκλο.','error');
  }
}

function getNextStandardCycleStartAfter(dateValue){
  const day=getBudgetCycleStartDay();
  const base=capvoParseDateKey(dateValue)||new Date();
  let next=new Date(base.getFullYear(),base.getMonth(),day,12);
  if(next<=base)next=new Date(base.getFullYear(),base.getMonth()+1,day,12);
  return next;
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
    message:`Θα ξεκινήσει νέος οικονομικός κύκλος από σήμερα έως ${formatShortDate(endKey)} και θα χρησιμοποιηθεί το βασικό budget: ${primary.name} (${fmt(primary.amount)}). Τα έξοδά σου δεν θα διαγραφούν.`,
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
  showMiniToast('✅ Η πρόωρη πληρωμή αναιρέθηκε');
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
  const cycleInput=$('settingsBudgetCycleDay');
  if(cycleInput && document.activeElement!==cycleInput)cycleInput.value=String(cycleDay);
  setText('settingsBudgetCycleLabel',cycle.label);
  setText('settingsBudgetCycleNext',cycle.nextStartKey ? formatShortDate(cycle.nextStartKey) : '—');
  const primary=getPrimaryIncomeSource();
  setText('settingsPrimaryIncomeLabel',primary?`${primary.name} · ${fmt(primary.amount)}`:'Δεν έχει οριστεί');
  setText('settingsCycleSourceLabel',cycle.source==='paid_today'?'Πρόωρη πληρωμή':'Κανονικός κανόνας');
  const paidNotice=$('settingsPaidTodayNotice');
  if(paidNotice){
    paidNotice.style.display=cycle.source==='paid_today'?'':'none';
    paidNotice.innerHTML=cycle.source==='paid_today'
      ? `<strong>Ενεργή πρόωρη πληρωμή</strong><span>Ο κύκλος ξεκίνησε ${formatShortDate(cycle.startKey)} και τελειώνει ${formatShortDate(cycle.endKey)}.</span>`
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
