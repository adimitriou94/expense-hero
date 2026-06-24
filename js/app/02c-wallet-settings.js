// CAPVO app split: 02c-wallet-settings.js
// Wallet CRUD + Settings: wallet operations, fixed expense payments, settings page
// Source: 02-supabase-data.js lines 1652-2523

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
  if(!pending){showMiniToast('Δεν υπάρχει υπόλοιπο προηγούμενου μήνα για διαχείριση.','info');return;}

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
      normalizedAction==='carry_to_next'?'Μεταφορά υπολοίπου προηγούμενου μήνα':'Δεν προστέθηκε στο διαθέσιμο budget'
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
  if(!pending){showMiniToast('Δεν υπάρχει υπόλοιπο προηγούμενου μήνα για διαχείριση.','info');return;}

  const {previous,current,amount}=pending;
  const safeAmount=Number(amount)||0;
  if(safeAmount<=0){showMiniToast('Δεν υπάρχει θετικό υπόλοιπο για αποταμίευση.','info');return;}

  if(!options?.skipConfirm){
    const ok=await showConfirmModal({
      title:'Μεταφορά σε αποταμίευση',
      message:`Θα δημιουργηθεί locked ποσό αποταμίευσης ${fmt(safeAmount)} από τον κύκλο ${previous.label}. Δεν θα προστεθεί στο διαθέσιμο budget του μήνα ${current.label}.`,
      confirmText:'Αποταμίευση'
    });
    if(!ok)return;
  }

  const savingsId=`carry_savings_${ownerUserId}_${previous.startKey}_${current.startKey}`.replace(/[^a-zA-Z0-9_-]/g,'_');
  const savingsSource={
    id:savingsId,
    name:`Υπόλοιπο μήνα ${previous.label}`,
    amount:safeAmount,
    category:'Αποταμίευση',
    incomeType:'bank',
    includeInBudget:false,
    isSavings:true,
    isRecurring:false,
    restriction:'locked',
    restrictedCategory:'',
    notes:`Από υπόλοιπο προηγούμενου μήνα ${previous.label}`,
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
        user_chat_id:null, // legacy field — nullable after DB migration 2026-06-14
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
        spending_limit:null,
        source_type:'transfer',
        source_category:'carryover_savings',
        restriction_type:null,
        include_in_budget:false,
        is_restricted:false,
        allocation_target:'savings',
        is_primary_income:false,
        updated_at:new Date().toISOString()
      },{onConflict:'id'});
      if(sourceError)throw sourceError;
    }

    await upsertCycleCarryoverDecision(
      ownerUserId,
      pending,
      'move_to_savings',
      'Μεταφορά υπολοίπου προηγούμενου μήνα σε αποταμίευση'
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
  const primaryWallet=typeof capvoPaidTodayPrimaryWallet==='function'
    ? capvoPaidTodayPrimaryWallet()
    : (typeof capvoPrimaryBudgetWallet==='function'?capvoPrimaryBudgetWallet():null);
  const primaryWalletAmount=Number(primaryWallet?.cycleIncomeAmount)||0;
  const hasPrimaryWalletBudget=!!primaryWallet && primaryWalletAmount>0;
  const salaryContext=hasPrimaryWalletBudget && typeof capvoGetSalaryDepositContext==='function'
    ? capvoGetSalaryDepositContext(primaryWallet)
    : null;
  const salaryRecorded=salaryContext?.state==='recorded';
  const salaryPending=salaryContext?.state==='due' || salaryContext?.state==='overdue';
  const salaryOverdue=salaryContext?.state==='overdue';
  const salaryDue=salaryContext?.state==='due';
  const primaryReady=hasPrimaryWalletBudget;

  const salaryRule=typeof capvoGetSalaryRuleForStatus==='function'?capvoGetSalaryRuleForStatus():{type:getBudgetCycleType(),day:getBudgetCycleStartDay()};
  const cycleDay=salaryRule.day;
  const cycleType=salaryRule.type;
  const ruleLabel=cycleType==='last_working_day'
    ? 'Πληρώνομαι την τελευταία εργάσιμη του μήνα'
    : `Πληρώνομαι κάθε ${cycleDay} του μήνα`;
  const paydayKey=salaryContext?.paydayKey || (typeof getNextPaydayAfter==='function'
    ? capvoDateKey(getNextPaydayAfter(new Date(),cycleType))
    : todayISO());

  const primaryLabel=hasPrimaryWalletBudget
    ? `${primaryWallet.name} · ${fmt(primaryWalletAmount)}`
    : 'Δεν έχει οριστεί';

  const primaryHelp=hasPrimaryWalletBudget
    ? 'Ο μισθός είναι event που καταχωρείται στο primary wallet. Η περίοδος αναφορών παραμένει μηνιαία.'
    : 'Όρισε έναν λογαριασμό ως Βασικός λογαριασμός budget και βάλε Μισθός / ποσό μήνα.';

  const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};

  const goToPrimaryBudget=()=>{
    showMiniToast('Όρισε βασικό λογαριασμό budget και ποσό μισθού/μήνα.','info');
    go('vWallets',document.querySelector('[data-v="vWallets"]'));
    closeM();
  };

  const salaryState=!primaryReady
    ? 'setup'
    : salaryRecorded
      ? 'recorded'
      : salaryOverdue
        ? 'overdue'
        : salaryDue
          ? 'due'
          : 'upcoming';

  const salaryUi={
    setup:{
      badge:'SETUP',
      icon:'🏦',
      title:'Χρειάζεται βασικός λογαριασμός',
      subtitle:'Όρισε primary wallet και μισθό/ποσό μήνα.',
      button:'Ορισμός μισθού'
    },
    upcoming:{
      badge:'ΕΠΟΜΕΝΟΣ',
      icon:'🕒',
      title:'Επόμενος μισθός',
      subtitle:`${formatGreekFullDate(paydayKey)} · ${fmt(primaryWalletAmount)} στο ${primaryWallet?.name||'primary wallet'}`,
      button:'Καταχώρηση νωρίτερα'
    },
    due:{
      badge:'ΣΗΜΕΡΑ',
      icon:'💸',
      title:'Σήμερα αναμένεται μισθός',
      subtitle:`${fmt(primaryWalletAmount)} στο ${primaryWallet?.name||'primary wallet'}`,
      button:'Καταχώρηση μισθού'
    },
    overdue:{
      badge:'ΕΚΚΡΕΜΕΙ',
      icon:'⚠️',
      title:`Εκκρεμεί μισθός από ${formatGreekFullDate(paydayKey)}`,
      subtitle:`${fmt(primaryWalletAmount)} στο ${primaryWallet?.name||'primary wallet'}`,
      button:'Καταχώρηση εκκρεμούς μισθού'
    },
    recorded:{
      badge:'ΚΑΤΑΧΩΡΗΘΗΚΕ',
      icon:'✅',
      title:'Μισθός καταχωρήθηκε',
      subtitle:`${fmt(primaryWalletAmount)} προστέθηκαν στο ${primaryWallet?.name||'primary wallet'}`,
      button:'Διαχείριση'
    }
  }[salaryState];

  const metaText=!primaryReady
    ? 'Όρισε primary wallet για να παρακολουθείς μισθό.'
    : salaryRecorded
      ? `Μισθός καταχωρημένος για ${cycle.label}`
      : salaryOverdue
        ? `Εκκρεμεί μισθός από ${formatGreekFullDate(paydayKey)}`
        : salaryDue
          ? `Σήμερα αναμένεται μισθός: ${formatGreekFullDate(paydayKey)}`
          : `Επόμενος μισθός: ${formatGreekFullDate(paydayKey)}`;

  const dashCard=$('dashboardCycleSummaryCard');
  if(dashCard){
    dashCard.classList.remove('salary-state-setup','salary-state-upcoming','salary-state-due','salary-state-overdue','salary-state-recorded');
    dashCard.classList.add(`salary-state-${salaryState}`);
  }

  setText('dashboardCycleLabel',cycle?.label||'—');
  setText('dashboardCycleMeta',metaText);
  setText('dashboardSalaryBadge',salaryUi.badge);
  setText('dashboardSalaryIcon',salaryUi.icon);
  setText('dashboardSalaryTitle',salaryUi.title);
  setText('dashboardSalarySubtitle',salaryUi.subtitle);

  const dashPaid=$('dashboardPaidTodayBtn');
  if(dashPaid){
    dashPaid.disabled=false;
    dashPaid.classList.remove('needs-primary','salary-overdue','salary-due','salary-recorded','salary-upcoming','salary-setup');
    dashPaid.classList.add(`salary-${salaryState}`);
    dashPaid.classList.toggle('needs-primary',!primaryReady && !salaryRecorded);
    dashPaid.classList.toggle('salary-overdue',!!salaryOverdue);
    dashPaid.textContent=salaryUi.button;
    dashPaid.title=salaryRecorded
      ? 'Άνοιξε τη διαχείριση μισθού/περιόδου.'
      : primaryReady
        ? 'Καταχώρησε τον μισθό στο primary wallet. Δεν γίνεται αυτόματα.'
        : 'Πρώτα όρισε primary budget λογαριασμό και μισθό/ποσό μήνα.';
    dashPaid.onclick=salaryRecorded
      ? openBudgetCycleManager
      : primaryReady
        ? createPaidTodayCycle
        : goToPrimaryBudget;
  }

  const dashManage=$('dashboardCycleManageBtn');
  if(dashManage){
    // v1.9.5.7: when salary is already recorded there must be only one visible
    // action on the dashboard, because the main CTA already opens management.
    // When salary is not recorded, keep two actions: register salary + management.
    dashManage.style.display=salaryRecorded?'none':'';
    dashManage.setAttribute('aria-hidden',salaryRecorded?'true':'false');
  }

  setText('cycleManagerCurrentLabel',cycle?.label||'—');
  setText('cycleManagerCurrentMeta',`Μηνιαία περίοδος · ${metaText}`);
  setText('cycleManagerSourceBadge','Μηνιαία περίοδος');
  setText('cycleManagerRuleLabel',ruleLabel);
  setText('cycleManagerPrimaryIncomeLabel',primaryLabel);
  setText('cycleManagerPrimaryIncomeHelp',primaryHelp);

  syncBudgetCycleTypeControls(cycleType);
  const input=$('cycleManagerBudgetCycleDay');
  if(input && document.activeElement!==input)input.value=String(cycleDay);
  if(input)input.disabled=cycleType==='last_working_day';

  const paidNotice=$('cycleManagerPaidTodayNotice');
  if(paidNotice){
    paidNotice.classList.toggle('warning',!primaryReady || salaryOverdue);
    paidNotice.style.display=(salaryRecorded || salaryPending || !primaryReady)?'':'none';
    paidNotice.innerHTML=salaryRecorded
      ? `<strong>Μισθός καταχωρημένος</strong><span>Έχει περαστεί ${fmt(primaryWalletAmount)} στο ${esc(primaryWallet.name)} για τη μηνιαία περίοδο ${esc(cycle.label)}.</span>`
      : salaryOverdue
        ? `<strong>Εκκρεμεί μισθός</strong><span>Η προγραμματισμένη ημερομηνία ήταν ${formatGreekFullDate(paydayKey)}. Μπορείς να τον καταχωρήσεις τώρα, χωρίς να αλλάξει η μηνιαία περίοδος.</span>`
        : salaryPending
          ? `<strong>Σήμερα είναι ημέρα μισθού</strong><span>Ο μισθός δεν μπαίνει αυτόματα. Πάτησε καταχώρηση όταν επιβεβαιώσεις ότι μπήκε.</span>`
          : !primaryReady
            ? '<strong>Χρειάζεται βασικός λογαριασμός</strong><span>Για να καταχωρηθεί μισθός, όρισε primary budget λογαριασμό και Μισθός / ποσό μήνα.</span>'
            : '';
  }

  const paidBtn=$('cycleManagerPaidTodayBtn');
  if(paidBtn){
    paidBtn.disabled=!!salaryRecorded || !primaryReady;
    paidBtn.textContent=salaryRecorded
      ? 'Μισθός καταχωρήθηκε ✓'
      : salaryOverdue
        ? 'Καταχώρηση εκκρεμούς μισθού'
        : salaryPending
          ? 'Καταχώρηση μισθού'
          : 'Καταχώρηση νωρίτερα';
    paidBtn.title=!primaryReady?'Πρώτα όρισε primary budget λογαριασμό και ποσό μισθού/μήνα.':salaryRecorded?'Ο μισθός έχει ήδη καταχωρηθεί για αυτή την περίοδο.':'Καταχώρησε τον μισθό στο primary wallet.';
  }
  const undoBtn=$('cycleManagerUndoPaidTodayBtn');
  if(undoBtn)undoBtn.style.display=salaryRecorded?'':'none';

  const history=$('cycleManagerHistory');
  if(history){
    const rows=(D.budgetCycleIncomes||[])
      .filter(r=>String(r.incomeSourceId||'').includes(':salary:'))
      .slice()
      .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))
      .slice(0,3);
    history.innerHTML=rows.length?rows.map(r=>{
      return `<div class="budget-cycle-history-row"><span>${esc(r.name||'Μισθός')}</span><strong>${fmt(r.amount)}</strong></div>`;
    }).join(''):'<p>Δεν υπάρχουν καταχωρήσεις μισθού ακόμα.</p>';
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
  const settingsPrimaryWallet=typeof capvoPaidTodayPrimaryWallet==='function'
    ? capvoPaidTodayPrimaryWallet()
    : (typeof capvoPrimaryBudgetWallet==='function'?capvoPrimaryBudgetWallet():null);
  const settingsPrimaryAmount=Number(settingsPrimaryWallet?.cycleIncomeAmount)||0;
  setText('settingsPrimaryIncomeLabel',settingsPrimaryWallet&&settingsPrimaryAmount>0?`${settingsPrimaryWallet.name} · ${fmt(settingsPrimaryAmount)}`:'Δεν έχει οριστεί');
  setText('settingsCycleSourceLabel','Μηνιαία περίοδος');
  const paidNotice=$('settingsPaidTodayNotice');
  if(paidNotice){
    paidNotice.style.display='none';
    paidNotice.innerHTML=cycle.source==='paid_today'
      ? `<strong>Ενεργή πρόωρη πληρωμή</strong><span>Ο κύκλος ξεκίνησε ${formatGreekFullDate(cycle.startKey)} και τελειώνει ${formatGreekFullDate(cycle.endKey)}.</span>`
      : '';
  }
  const paidTodayBtn=$('settingsPaidTodayBtn');
  if(paidTodayBtn){
    const isPaidCycle=cycle.source==='paid_today';
    paidTodayBtn.disabled=isPaidCycle;
    paidTodayBtn.textContent=isPaidCycle?'Καταχώρηση μισθού ✓':'Καταχώρηση μισθού';
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
      : 'Σύνδεσε το Telegram Bot για να περνάς έξοδα με μήνυμα ή φωνή τη στιγμή που γίνονται, χωρίς να ανοίγεις το CAPVO.<br><small>Π.χ. “καφές 3”, “βενζίνη 20” ή “σούπερ 25 ticket”.</small>';
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

// ============================================================
// CAPVO Phase 2: Wallet CRUD operations
// ============================================================

async function capvoSaveWallet(walletData){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  const isNew=!walletData.id;
  const id=walletData.id||crypto.randomUUID();

  // If setting as default / primary, clear the previous flags first.
  if(walletData.isDefault || walletData.isPrimaryBudget){
    await supabaseClient
      .from('wallets')
      .update({
        ...(walletData.isDefault ? {is_default:false} : {}),
        ...(walletData.isPrimaryBudget ? {is_primary_budget:false} : {})
      })
      .eq('user_id',ownerUserId);
  }

  const payload={
    id,
    user_id:ownerUserId,
    name:String(walletData.name||'').trim(),
    type:walletData.type||'bank',
    color:walletData.color||'#6547f6',
    icon:walletData.icon||'🏦',
    current_balance:Number(walletData.currentBalance)||0,
    include_in_total:walletData.includeInTotal!==false,
    include_in_budget:walletData.includeInBudget!==false,
    is_savings:!!walletData.isSavings,
    is_primary_budget:!!walletData.isPrimaryBudget,
    budget_role:walletData.budgetRole || (walletData.isSavings ? 'savings' : (walletData.type==='cash' ? 'cash' : 'spending')),
    cycle_income_amount:Number(walletData.cycleIncomeAmount)||0,
    is_default:!!walletData.isDefault,
    sort_order:Number(walletData.sortOrder)||0,
    is_active:walletData.isActive!==false,
    notes:walletData.notes||null,
    updated_at:new Date().toISOString()
  };

  let {error}=await supabaseClient
    .from('wallets')
    .upsert(payload,{onConflict:'id'});

  // Backward-safe fallback if cycle_income_amount column has not been created yet.
  if(error && /cycle_income_amount/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.cycle_income_amount;
    const retry=await supabaseClient
      .from('wallets')
      .upsert(legacyPayload,{onConflict:'id'});
    error=retry.error;
  }

  if(error)throw error;
  return id;
}

async function capvoDeleteWallet(walletId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  // Soft delete (set inactive) instead of hard delete to preserve history
  const {error}=await supabaseClient
    .from('wallets')
    .update({is_active:false, updated_at:new Date().toISOString()})
    .eq('id',walletId)
    .eq('user_id',ownerUserId);

  if(error)throw error;
}

async function capvoRestoreWallet(walletId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  // Restore archived wallet. History remains linked to the same wallet id.
  const {error}=await supabaseClient
    .from('wallets')
    .update({is_active:true, updated_at:new Date().toISOString()})
    .eq('id',walletId)
    .eq('user_id',ownerUserId);

  if(error)throw error;
}


async function capvoPayFixedExpense(fixedExpenseId,options={}){
  const flowOptions=options && typeof options==='object'?options:{};
  if(!flowOptions.skipPreview && typeof capvoOpenFixedPaymentPreview==='function'){
    return capvoOpenFixedPaymentPreview(fixedExpenseId);
  }

  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const expense=(D.fixedExpenses||[]).find(x=>String(x.id)===String(fixedExpenseId));
  if(!expense){showMiniToast('Δεν βρέθηκε το πάγιο.','error');return;}

  const dueDate=typeof capvoFixedExpenseNextDueDate==='function'?capvoFixedExpenseNextDueDate(expense):todayISO();
  if(typeof capvoFixedExpensePaymentForDueDate==='function' && capvoFixedExpensePaymentForDueDate(expense.id,dueDate)){
    showMiniToast('Το πάγιο έχει ήδη πληρωθεί για αυτή την ημερομηνία.','info');
    return;
  }

  const activeWallets=typeof capvoActiveWallets==='function'
    ? capvoActiveWallets()
    : (Array.isArray(D.wallets)?D.wallets.filter(w=>w&&w.isActive!==false&&w.is_active!==false):[]);
  const isSavingsWallet=w=>{
    const role=typeof capvoWalletBudgetRole==='function'?String(capvoWalletBudgetRole(w)||''):String(w?.budgetRole||w?.budget_role||'');
    return !!(w && (w.isSavings || w.is_savings || String(w.type||'')==='savings' || role==='savings'));
  };
  const eligibleWallets=activeWallets.filter(w=>w && !isSavingsWallet(w));
  const requestedWalletId=flowOptions.walletId || expense.sourceWalletId || '';
  let wallet=requestedWalletId ? eligibleWallets.find(w=>String(w.id)===String(requestedWalletId)) : null;
  wallet=wallet || eligibleWallets.find(w=>String(w.id)===String(capvoDefaultWallet?.()?.id)) || eligibleWallets[0] || null;
  if(!wallet){
    showMiniToast('Δεν υπάρχει διαθέσιμο wallet πληρωμής. Τα αποταμιευτικά wallets δεν μπορούν να πληρώσουν πάγια.','error');
    return;
  }

  const amount=capvoMoney(Number(expense.amount)||0);
  const before=capvoMoney(Number(wallet.currentBalance)||0);
  const after=capvoMoney(before-amount);

  if(after<0){
    showMiniToast(`Δεν υπάρχει αρκετό υπόλοιπο στο wallet "${wallet.name||'Wallet'}". Διάλεξε άλλο wallet ή μετέφερε χρήματα.`, 'error');
    return;
  }

  if(!flowOptions.skipLegacyConfirm){
    const ok=await showConfirmModal({
    title:'Πληρωμή παγίου',
    message:`Θα πληρωθεί "${expense.name}" για ${formatGreekFullDate(dueDate)} από ${wallet.name}.\\n\\n${fmt(before)} - ${fmt(amount)} = ${fmt(after)}.`,
    confirmText:'Πληρώθηκε',
    cancelText:'Άκυρο'
    });
    if(!ok)return;
  }

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Καταχώρηση πληρωμής...', `Πληρώνω ${expense.name} από ${wallet.name}.`))return;

  try{
    const paymentId=gid();
    const now=new Date().toISOString();
    const nextDue=typeof capvoAdvanceFixedExpenseDueDate==='function'?capvoAdvanceFixedExpenseDueDate(expense,dueDate):'';

    const paymentPayload={
      id:paymentId,
      user_id:ownerUserId,
      fixed_expense_id:expense.id,
      wallet_id:wallet.id,
      amount,
      paid_for_date:dueDate,
      paid_at:todayISO(),
      status:'paid',
      note:`Πληρωμή παγίου: ${expense.name}`,
      wallet_balance_before:before,
      wallet_balance_after:after,
      created_at:now
    };

    const {error:paymentError}=await supabaseClient
      .from('fixed_expense_payments')
      .insert(paymentPayload);
    if(paymentError)throw paymentError;

    await capvoUpdateWalletBalance(wallet.id,after);

    const updatePayload={
      next_due_date:nextDue||null,
      last_paid_at:now,
      updated_at:now
    };

    const {error:updateError}=await supabaseClient
      .from('fixed_expenses')
      .update(updatePayload)
      .eq('id',expense.id)
      .eq('user_id',ownerUserId);
    if(updateError)throw updateError;

    await fetchAllData(ownerUserId);
    render();
    renderBudgetCycleManager?.();

    capvoAppOperationSuccess?.('Ολοκληρώθηκε',`Το πάγιο "${expense.name}" πληρώθηκε.`);
    showMiniToast('✅ Το πάγιο πληρώθηκε');
  }catch(e){
    console.error('capvoPayFixedExpense failed:',e);
    const duplicatePayment=String(e?.code||'')==='23505' || /fixed_expense_payments_unique_paid_due|duplicate key|already exists/i.test(String(e?.message||e?.details||e||''));
    if(duplicatePayment){
      capvoAppOperationError?.('Ήδη πληρωμένο','Το πάγιο έχει ήδη πληρωθεί για αυτή την ημερομηνία.');
      showMiniToast('Το πάγιο έχει ήδη πληρωθεί για αυτή την ημερομηνία.','info');
    }else{
      capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να καταχωρήσω την πληρωμή παγίου.');
      showMiniToast('Δεν μπόρεσα να καταχωρήσω την πληρωμή. Έλεγξε αν έτρεξες τα SQL migrations.','error');
    }
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}


async function capvoUndoFixedExpensePayment(paymentId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const payment=(D.fixedExpensePayments||[]).find(p=>String(p.id)===String(paymentId));
  if(!payment){showMiniToast('Δεν βρέθηκε η πληρωμή παγίου.','error');return;}

  const expense=typeof capvoFixedExpenseById==='function'
    ? capvoFixedExpenseById(payment.fixedExpenseId||payment.fixed_expense_id)
    : (D.fixedExpenses||[]).find(x=>String(x.id)===String(payment.fixedExpenseId||payment.fixed_expense_id));
  const wallet=capvoWalletById(payment.walletId||payment.wallet_id);
  const amount=capvoMoney(Number(payment.amount)||0);
  const before=capvoMoney(Number(wallet?.currentBalance)||0);
  const after=capvoMoney(before+amount);
  const paidForDate=String(payment.paidForDate||payment.paid_for_date||'').slice(0,10);
  const expenseDeleted=!!expense?.deletedAt;

  const ok=await showConfirmModal({
    title:'Αναίρεση πληρωμής παγίου',
    message:`Θα αναιρεθεί μόνο η πληρωμή "${expense?.name||'Πάγιο'}" (${fmt(amount)}).\\n\\nΤο ποσό θα επιστρέψει στο wallet ${wallet?.name||'—'}.\\n${fmt(before)} + ${fmt(amount)} = ${fmt(after)}.\\n\\n${expenseDeleted?'Το πάγιο έχει διαγραφεί από τις μελλοντικές υποχρεώσεις και δεν θα επανέλθει.':'Το πρόγραμμα του παγίου θα γυρίσει στην ημερομηνία αυτής της πληρωμής.'}\\nΔεν θα διαγραφούν άλλες κινήσεις.`,
    confirmText:'Αναίρεση πληρωμής',
    cancelText:'Άκυρο'
  });
  if(!ok)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Αναίρεση πληρωμής...', `Επιστρέφω ${fmt(amount)} στο ${wallet?.name||'wallet'}.`))return;

  try{
    if(wallet && amount>0){
      await capvoUpdateWalletBalance(wallet.id,after);
    }

    const {error:paymentError}=await supabaseClient
      .from('fixed_expense_payments')
      .update({
        status:'reversed',
        updated_at:new Date().toISOString()
      })
      .eq('id',payment.id)
      .eq('user_id',ownerUserId);
    if(paymentError)throw paymentError;

    if(expense && !expenseDeleted && paidForDate){
      const {error:fixedError}=await supabaseClient
        .from('fixed_expenses')
        .update({
          next_due_date:paidForDate,
          last_paid_at:null,
          updated_at:new Date().toISOString()
        })
        .eq('id',expense.id)
        .eq('user_id',ownerUserId);
      if(fixedError)throw fixedError;
    }

    await fetchAllData(ownerUserId);
    render();
    renderBudgetCycleManager?.();

    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Η πληρωμή παγίου αναιρέθηκε.');
    showMiniToast('✅ Η πληρωμή παγίου αναιρέθηκε');
  }catch(e){
    console.error('capvoUndoFixedExpensePayment failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αναιρέσω την πληρωμή.');
    showMiniToast('Δεν μπόρεσα να αναιρέσω την πληρωμή παγίου.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}


async function capvoSoftDeleteFixedExpense(fixedExpenseId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  const expense=typeof capvoFixedExpenseById==='function'
    ? capvoFixedExpenseById(fixedExpenseId)
    : (D.fixedExpenses||[]).find(x=>String(x.id)===String(fixedExpenseId));
  if(!expense)throw new Error('Δεν βρέθηκε το πάγιο.');
  if(expense.deletedAt)return;

  const now=new Date().toISOString();
  const {error}=await supabaseClient
    .from('fixed_expenses')
    .update({deleted_at:now, updated_at:now})
    .eq('id',fixedExpenseId)
    .eq('user_id',ownerUserId);
  if(error)throw error;

  D.fixedExpenses=(D.fixedExpenses||[]).filter(e=>String(e.id)!==String(fixedExpenseId));
  const archived=(D.fixedExpenseArchive||[]).find(e=>String(e.id)===String(fixedExpenseId));
  if(archived)archived.deletedAt=now;
}


async function capvoUpdateWalletBalance(walletId, newBalance){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  const {error}=await supabaseClient
    .from('wallets')
    .update({
      current_balance:Number(newBalance)||0,
      updated_at:new Date().toISOString()
    })
    .eq('id',walletId)
    .eq('user_id',ownerUserId);

  if(error)throw error;

  // Update local state
  const w=capvoWalletById(walletId);
  if(w)w.currentBalance=Number(newBalance)||0;
}

async function capvoSaveWalletTransfer(transferData){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)throw new Error('Missing user');

  if(!transferData.fromWalletId || !transferData.toWalletId){
    throw new Error('Επίλεξε λογαριασμό αποστολής και παραλαβής.');
  }
  if(transferData.fromWalletId===transferData.toWalletId){
    throw new Error('Ο λογαριασμός αποστολής και παραλαβής δεν μπορεί να είναι ο ίδιος.');
  }
  const amount=Number(transferData.amount)||0;
  if(amount<=0)throw new Error('Βάλε έγκυρο ποσό μεταφοράς.');

  const fromWallet=capvoWalletById(transferData.fromWalletId);
  const toWallet=capvoWalletById(transferData.toWalletId);
  if(fromWallet && fromWallet.currentBalance<amount){
    throw new Error(`Ανεπαρκές υπόλοιπο. Διαθέσιμο: ${typeof fmt==='function'?fmt(fromWallet.currentBalance):fromWallet.currentBalance+'€'}`);
  }

  const effects=typeof capvoBuildWalletTransferEffects==='function'
    ? capvoBuildWalletTransferEffects(fromWallet,toWallet,amount)
    : {budgetImpactAmount:0};

  const payload={
    id:crypto.randomUUID(),
    user_id:ownerUserId,
    from_wallet_id:transferData.fromWalletId,
    to_wallet_id:transferData.toWalletId,
    amount,
    date:transferData.date||(typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA')),
    note:transferData.note||null,
    transfer_type:transferData.transferType||'transfer'
  };

  // v1.9.1.0: budget effects are calculated here but not sent to DB yet.
  // The SQL migration shipped with this patch adds the columns for the next step.
  payload._localBudgetEffects=effects;

  const dbPayload={
    ...payload,
    budget_effect_amount:Number(effects.budgetImpactAmount)||0,
    from_include_in_budget_snapshot:!!effects.fromCountsInBudget,
    to_include_in_budget_snapshot:!!effects.toCountsInBudget,
    from_budget_role_snapshot:effects.fromRole||null,
    to_budget_role_snapshot:effects.toRole||null
  };
  delete dbPayload._localBudgetEffects;

  let {error}=await supabaseClient
    .from('wallet_transfers')
    .insert(dbPayload);

  // Backward-safe fallback if the SQL migration has not been applied yet.
  if(error && /budget_effect_amount|from_include_in_budget_snapshot|to_include_in_budget_snapshot|from_budget_role_snapshot|to_budget_role_snapshot/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload._localBudgetEffects;
    const retry=await supabaseClient
      .from('wallet_transfers')
      .insert(legacyPayload);
    error=retry.error;
  }

  if(error)throw error;

  // Update balances locally + in DB
  const newFromBalance=(fromWallet?.currentBalance||0)-amount;
  const newToBalance=(toWallet?.currentBalance||0)+amount;

  await Promise.all([
    capvoUpdateWalletBalance(transferData.fromWalletId, newFromBalance),
    capvoUpdateWalletBalance(transferData.toWalletId, newToBalance)
  ]);

  return payload.id;
}
// ===== END 02c-wallet-settings.js =====
