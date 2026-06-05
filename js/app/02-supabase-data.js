// CAPVO app split: 02-supabase-data.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== SUPABASE DATA OPERATIONS =====
async function fetchAllData(userId){
  try{
    if(!userId){
      D={income:0,incomeSources:[],fixedExpenses:[],creditCards:[],months:{}};
      refreshComputedIncome();
      return;
    }
    let {data:user,error:errUser}=await supabaseClient.from('users').select('income').eq('chat_id',userId).single();

    if(errUser&&errUser.code==='PGRST116'){
      const {error:createUserError}=await supabaseClient
        .from('users')
        .upsert({chat_id:userId,income:0},{onConflict:'chat_id'});

      if(createUserError){
        console.warn('User income row create skipped:',createUserError);
      }

      user={income:0};
    }else if(errUser){
      console.warn('User income row fetch skipped:',errUser);
      user={income:0};
    }

    D.income=user?.income||0;

    const {data:incomeSources,error:errIncomeSources}=await supabaseClient
    .from('income_sources')
    .select('*')
    .eq('user_chat_id',userId);
  
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
    notes:i.notes||''
  }));
  
  refreshComputedIncome();

    const {data:fixed,error:errFixed}=await supabaseClient
      .from('fixed_expenses')
      .select('id,user_chat_id,name,amount,category')
      .eq('user_chat_id',userId);

    if(errFixed) throw errFixed;

    D.fixedExpenses=(fixed||[])
      .map(e=>({
        id:e.id,
        name:e.name,
        amount:Number(e.amount)||0,
        category:e.category||'Άλλο'
      }))
      .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a));

    const {data:cards,error:errCards}=await supabaseClient.from('credit_cards').select('*').eq('user_chat_id',userId);
    if(errCards) throw errCards;

    D.creditCards=(cards||[]).map(c=>({
      id:c.id,
      name:c.name,
      balance:c.balance||0,
      rate:c.rate||0,
      minPay:c.min_pay||0,
      limit:c.limit_amount||0,
      chosenPay:c.chosen_pay||0
    }));

    const {data:daily,error:errDaily}=await supabaseClient.from('expenses').select('*').eq('user_chat_id',userId);
    if(errDaily) throw errDaily;

    D.months={};

    (daily||[]).forEach(e=>{
      const mk=e.month_key||(e.date?e.date.substring(0,7):curMK());
      if(!D.months[mk]) D.months[mk]={daily:[]};
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
  if((D.incomeSources||[]).length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .upsert(
        D.incomeSources.map(i=>({
          id:i.id,
          user_chat_id:userId,
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
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );

    if(error)throw error;
  }

  if(!Array.isArray(D.incomeSources)){
    D.incomeSources=[];
  }

  const {data:dbRows,error:fetchError}=await supabaseClient
    .from('income_sources')
    .select('id')
    .eq('user_chat_id',userId);

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
  const userId=getDataOwnerId();
  if(!userId) return;

  try{
    refreshComputedIncome();

    const {error:userSaveError}=await supabaseClient
      .from('users')
      .upsert({chat_id:userId,income:D.income},{onConflict:'chat_id'});

    if(userSaveError){
      console.warn('User income row save skipped:',userSaveError);
    }

    await syncIncomeSources(userId);

    if(D.fixedExpenses.length>0){
      await supabaseClient.from('fixed_expenses').upsert(
        D.fixedExpenses.map(e=>({id:e.id,name:e.name,amount:e.amount,category:e.category,user_chat_id:userId})),
        {onConflict:'id'}
      );
    }

    const {data:dbFixed}=await supabaseClient.from('fixed_expenses').select('id').eq('user_chat_id',userId);
    const fixedIds=new Set(D.fixedExpenses.map(e=>e.id));
    const fixedToDelete=(dbFixed||[]).filter(e=>!fixedIds.has(e.id)).map(e=>e.id);
    if(fixedToDelete.length>0) await supabaseClient.from('fixed_expenses').delete().in('id',fixedToDelete);

    if(D.creditCards.length>0){
      await supabaseClient.from('credit_cards').upsert(
        D.creditCards.map(c=>({
          id:c.id,name:c.name,balance:c.balance,rate:c.rate,
          min_pay:c.minPay,limit_amount:c.limit,chosen_pay:c.chosenPay,user_chat_id:userId
        })),
        {onConflict:'id'}
      );
    }

    const {data:dbCards}=await supabaseClient.from('credit_cards').select('id').eq('user_chat_id',userId);
    const cardIds=new Set(D.creditCards.map(c=>c.id));
    const cardsToDelete=(dbCards||[]).filter(c=>!cardIds.has(c.id)).map(c=>c.id);
    if(cardsToDelete.length>0) await supabaseClient.from('credit_cards').delete().in('id',cardsToDelete);

    const allDaily=[];

    Object.entries(D.months).forEach(([monthKey,m])=>{
      m.daily.forEach(e=>{
        allDaily.push({
          id:e.id,
          name:e.name,
          amount:e.amount,
          category:e.category,
          date:e.date,
          type:'daily',
          month_key:monthKey,
          user_chat_id:userId,
          payment_source_id:e.paymentSourceId||null,
          payment_source_name:e.paymentSourceName||null,
          payment_source_type:e.paymentSourceType||null
        });
      });
    });
    
    if(allDaily.length>0){
      await supabaseClient
        .from('expenses')
        .upsert(allDaily,{onConflict:'id'});
    }
    
    const {data:dbExpenses}=await supabaseClient
      .from('expenses')
      .select('id')
      .eq('user_chat_id',userId);
    
    const dbIds=new Set((dbExpenses||[]).map(e=>e.id));
    const appIds=new Set(allDaily.map(e=>e.id));
    
    const toDelete=[...dbIds].filter(id=>!appIds.has(id));
    
    if(toDelete.length>0){
      await supabaseClient
        .from('expenses')
        .delete()
        .in('id',toDelete);
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

  const restricted=(D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none');

  if(restricted.length===0){
    el.closest('.payment-sources-widget').style.display='none';
    el.innerHTML='';
    return;
  }

  el.closest('.payment-sources-widget').style.display='block';

  el.innerHTML=restricted.map(i=>{
    const remaining=paymentSourceRemaining(i);
    const total=Number(i.amount)||0;
    const used=Math.max(0,total-remaining);
    const pct=total>0?Math.round(used/total*100):0;

    return`
      <div class="payment-source-mini-card">
        <div class="widget-icon teal">🎫</div>

        <div class="payment-source-mini-content">
          <div class="stat-label">${esc(i.name)}</div>
          <div class="stat-value teal">${fmt(remaining)}</div>
          <div class="payment-mini-meta">διαθέσιμα / ${fmt(total)}</div>

          <div class="payment-mini-bar">
            <div class="payment-mini-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
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
