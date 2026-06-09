// CAPVO app split: 06-modals-nav-auth.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== MODALS / SAVE ACTIONS / NAV / AUTH =====
function closeM(){
  document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active'));
  closeIncomeCustomPickers?.();
  document.body.classList.remove('modal-open');
}

function openModal(t){
  capvoSuppressAutoFocus?.(900);
  closeM();
  document.body.classList.add('modal-open');

  if(t==='daily'){
    $('mDaily').classList.add('active');
    $('mDailyTitle').innerHTML='Νέο ημερήσιο έξοδο<button class="modal-close" onclick="closeM()">×</button>';
    $('fDN').value='';
    $('fDA').value='';
    $('fDD').value=new Date().toISOString().split('T')[0];
    $('fDID').value='';
    $('btnDaily').textContent='Αποθήκευση';

    fillPaymentSourceSelect('');

    // autofocus disabled: user taps the field when ready;
  }

  if(t==='fixed'){
    $('mFixed').classList.add('active');
    $('mFixedTitle').innerHTML='🔒 Νέο πάγιο<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value='';
    $('fFA').value='';
    $('fFID').value='';
    $('fFC').value='Στέγαση';
    if(typeof syncFixedCategoryPicker==='function')syncFixedCategoryPicker('Στέγαση');
    $('btnFixed').textContent='Αποθήκευση';
    // autofocus disabled: user taps the field when ready;
  }

  if(t==='cc'){
    $('mCC').classList.add('active');
    $('mCCTitle').textContent='Νέα κάρτα';
    $('fCCN').value='';
    $('fCCB').value='';
    $('fCCR').value='18.5';
    $('fCCM').value='';
    $('fCCL').value='';
    $('fCCID').value='';
    $('btnCC').textContent='Αποθήκευση κάρτας';
    if(typeof resetCCFormUI==='function') resetCCFormUI('credit');
    // autofocus disabled: user taps the field when ready;
  }

  if(t==='incomeSource'){
    $('mIncomeSource').classList.add('active');
    $('mIncomeSourceTitle').textContent='Προσθήκη budget';
    if($('incomeModalKicker'))$('incomeModalKicker').textContent='Budget setup';
    if($('incomeModalIntro'))$('incomeModalIntro').textContent='Πρόσθεσε το βασικό σου εισόδημα ή ένα διαθέσιμο μηνιαίο budget για να υπολογίζεται σωστά το υπόλοιπο.';

    $('fISName').value='';
    $('fISAmount').value='';
    $('fISCategory').value='Μισθός';
    $('fISType').value='bank';
    $('fISRestriction').value='none';
    $('fISRestrictedCategory').value='';
    $('fISIncludeBudget').checked=true;
    $('fISSavings').checked=false;
    $('fISRecurring').checked=true;
    if($('fISPrimary'))$('fISPrimary').checked=false;
    $('fISNotes').value='';
    $('fISID').value='';
    $('btnIncomeSource').textContent='Αποθήκευση budget';
    if(typeof clearIncomeValidation==='function')clearIncomeValidation();
    if(typeof applyIncomePreset==='function')applyIncomePreset('budget');
    else refreshIncomeCustomPickers();
    // autofocus disabled: user taps the field when ready;
  }
}

function editExp(t,id){
  capvoSuppressAutoFocus?.(900);
  closeM();

  if(t==='fixed'){
    const e=D.fixedExpenses.find(x=>x.id===id);
    if(!e)return;

    $('mFixed').classList.add('active');
    $('mFixedTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value=e.name;
    $('fFA').value=e.amount;
    $('fFC').value=e.category;
    if(typeof syncFixedCategoryPicker==='function')syncFixedCategoryPicker(e.category||'Άλλο');
    $('fFID').value=id;
    $('btnFixed').textContent='Ενημέρωση';
    // autofocus disabled: user taps the field when ready;

    return;
  }

  ensM(curM);

  let e=null;

  Object.values(D.months||{}).forEach(m=>{
    const found=(m.daily||[]).find(x=>x.id===id);
    if(found)e=found;
  });

  if(!e)return;

  $('mDaily').classList.add('active');
  $('mDailyTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';
  $('fDN').value=e.name;
  $('fDA').value=e.amount;
  $('fDC').value=e.category;
  $('fDD').value=e.date;
  $('fDID').value=id;
  $('btnDaily').textContent='Ενημέρωση';

  fillPaymentSourceSelect(e.paymentSourceId||'');

  $('fDN').focus();
}

async function saveDailyExpenseRow(userId,expense){
  const token=currentSession?.access_token;
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();

  if(!token)throw new Error('Δεν υπάρχει ενεργό session.');
  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const row={
    id:expense.id,
    user_id:ownerUserId,
    user_chat_id:null,
    name:expense.name,
    amount:expense.amount,
    category:expense.category,
    date:expense.date,
    type:'daily',
    month_key:expense.date.substring(0,7),
    payment_source_id:expense.paymentSourceId||null,
    payment_source_name:expense.paymentSourceName||null,
    payment_source_type:expense.paymentSourceType||null
  };

  const res=await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/expenses`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      apikey:CONFIG.SUPABASE_ANON_KEY,
      Authorization:'Bearer '+token,
      Prefer:'resolution=merge-duplicates'
    },
    body:JSON.stringify(row)
  });

  if(!res.ok){
    const txt=await res.text();
    throw new Error(txt);
  }
}





function getExistingDailyExpenseById(id){
  if(!id)return null;

  for(const month of Object.values(D.months||{})){
    const found=(month.daily||[]).find(e=>e.id===id);
    if(found)return found;
  }

  return null;
}

function hasBudgetIncomeConfigured(){
  return (D.incomeSources||[]).some(i=>i.includeInBudget && (Number(i.amount)||0)>0);
}

function expenseUsesRestrictedSource(expense){
  const source=paymentSourceById(expense?.paymentSourceId||'');
  return !!(source && source.restriction && source.restriction!=='none');
}

function projectedRestrictedRemainingAfterExpense(expense,{editing=false}={}){
  const source=paymentSourceById(expense?.paymentSourceId||'');

  if(!source || !source.restriction || source.restriction==='none'){
    return {source:null,remainingAfter:null,available:null};
  }

  let available=paymentSourceRemaining(source);

  if(editing){
    const old=getExistingDailyExpenseById(expense.id);
    if(old && old.paymentSourceId===source.id){
      available+=(Number(old.amount)||0);
    }
  }

  const remainingAfter=available-(Number(expense.amount)||0);
  return {source,remainingAfter,available};
}

function projectedNormalBudgetAfterExpense(expense,{editing=false}={}){
  let currentCashDaily=dailyCashTotal();

  if(editing){
    const old=getExistingDailyExpenseById(expense.id);
    if(old && !old.paymentSourceId){
      currentCashDaily-=Number(old.amount)||0;
    }
  }

  const newCashDaily=expense?.paymentSourceId
    ? currentCashDaily
    : currentCashDaily+(Number(expense.amount)||0);

  return (Number(D.income)||0)-fixedTotal()-ccPayTotal()-newCashDaily;
}

async function validateExpenseBeforeSave(expense,{editing=false,errorTarget=null}={}){
  const amount=Number(expense?.amount)||0;

  const fail=(message)=>{
    if(errorTarget && typeof setQuickAddInlineError==='function'){
      setQuickAddInlineError(message,errorTarget);
    }else if(typeof showMiniToast==='function'){
      showMiniToast(message,'error');
    }
    return false;
  };

  const restrictedCheck=projectedRestrictedRemainingAfterExpense(expense,{editing});

  if(restrictedCheck.source && restrictedCheck.remainingAfter<0){
    return fail(
      `Το υπόλοιπο ${restrictedCheck.source.name} δεν επαρκεί. Διαθέσιμο: ${fmt(restrictedCheck.available)}.`
    );
  }

  if(!hasBudgetIncomeConfigured()){
    const proceed=await showConfirmModal({
      title:'Δεν έχεις ορίσει budget',
      message:'Μπορείς να καταχωρίσεις το έξοδο, αλλά το CAPVO δεν θα μπορεί να υπολογίσει σωστά το υπόλοιπο του μήνα. Θέλεις να συνεχίσεις;',
      confirmText:'Καταχώρηση εξόδου',
      cancelText:'Προσθήκη εισοδήματος'
    });

    if(!proceed){
      if(typeof go==='function'){
        go('vIncome',document.querySelector('[data-v=vIncome]'));
      }
      setTimeout(()=>{
        try{openModal('incomeSource');}catch(e){}
      },120);
      return false;
    }

    return true;
  }

  if(!expense?.paymentSourceId){
    const projected=projectedNormalBudgetAfterExpense(expense,{editing});

    if(projected<0){
      const proceed=await showConfirmModal({
        title:'Υπέρβαση budget',
        message:`Με αυτή την καταχώρηση το διαθέσιμο budget θα πάει στα ${fmt(projected)}. Θέλεις να συνεχίσεις;`,
        confirmText:'Καταχώρηση anyway',
        cancelText:'Ακύρωση'
      });

      if(!proceed)return false;
    }
  }

  return true;
}


async function saveDaily(){
  const n=$('fDN').value.trim();
  const a=parseFloat($('fDA').value);
  const id=$('fDID').value;
  const date=$('fDD').value||new Date().toISOString().split('T')[0];
  const category=$('fDC').value;
  const paymentSourceId=$('fDPay')?.value||'';
  const paymentSource=paymentSourceById(paymentSourceId);
  const userId=getDataOwnerId();
  const btn=$('btnDaily');

  if(!n){
    $('fDN').style.borderColor='var(--red)';
    return;
  }

  if(!a||a<=0){
    $('fDA').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    showMiniToast(
      '❌ Δεν υπάρχει ενεργή σύνδεση Google',
      'error'
    );
    return;
  }

  const monthKey=date.substring(0,7);
  ensM(monthKey);

  let expense;

  if(id){
    expense={
      id,
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };
  }else{
    expense={
      id:gid(),
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };
  }

  const canSave=await validateExpenseBeforeSave(expense,{editing:!!id});
  if(!canSave)return;

  if(id){
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(e=>e.id!==id);
    });
  }

  D.months[monthKey].daily.push(expense);

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveDailyExpenseRow(userId,expense);

    closeM();
    render();

  }catch(e){
    console.error('saveDaily failed:',e);
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}

async function saveFixedExpenseRow(userId,expense){
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();
  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const {error}=await supabaseClient
    .from('fixed_expenses')
    .upsert({
      id:expense.id,
      user_id:ownerUserId,
      user_chat_id:null,
      name:expense.name,
      amount:expense.amount,
      category:expense.category
    },{onConflict:'id'});

  if(error)throw error;
}

async function saveFixed(){
  const n=$('fFN').value.trim();
  const a=parseFloat($('fFA').value);
  const id=$('fFID').value;
  const category=$('fFC').value;
  const userId=getDataOwnerId();
  const btn=$('btnFixed');

  if(!n){
    $('fFN').style.borderColor='var(--red)';
    return;
  }

  if(!a||a<=0){
    $('fFA').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    showMiniToast(
      '❌ Δεν υπάρχει ενεργή σύνδεση Google',
      'error'
    );
    return;
  }

  let expense;

  if(id){
    expense=D.fixedExpenses.find(x=>x.id===id);

    if(expense){
      expense.name=n;
      expense.amount=a;
      expense.category=category;
    }
  }else{
    expense={
      id:gid(),
      name:n,
      amount:a,
      category
    };

    D.fixedExpenses.push(expense);
  }

  if(!expense)return;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveFixedExpenseRow(userId,expense);

    D.fixedExpenses=(D.fixedExpenses||[])
      .slice()
      .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a));

    closeM();
    render();

  }catch(e){
    console.error('saveFixed failed:',e);
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}


async function deleteExpenseRow(type,id){
  const table=type==='fixed'?'fixed_expenses':'expenses';
  await deleteRowsFromTable(table,[id]);
}

async function delExp(t,id){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή εξόδου',
    message:'Θέλεις να διαγράψεις αυτή την εγγραφή;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  try{
    await deleteExpenseRow(t,id);

    if(t==='fixed'){
      D.fixedExpenses=D.fixedExpenses.filter(e=>e.id!==id);
    }else{
      Object.values(D.months||{}).forEach(m=>{
        m.daily=(m.daily||[]).filter(e=>e.id!==id);
      });
    }

    render();

    showMiniToast('✅ Η εγγραφή διαγράφηκε');

  }catch(e){
    console.error('Delete error:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

let quickVoiceRecognition=null;
let quickVoiceListening=false;
let quickVoiceHadResult=false;
let quickVoiceHadError=false;
let quickVoiceResetTimer=null;
let quickVoiceLastTargetId='quickAddInput';

function getSpeechRecognition(){
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function clearQuickVoiceResetTimer(){
  if(quickVoiceResetTimer){
    clearTimeout(quickVoiceResetTimer);
    quickVoiceResetTimer=null;
  }
}

function setQuickVoiceState(isListening,stateText='idle',customHint){
  quickVoiceListening=isListening;

  const btn=$('quickVoiceBtn');
  if(btn){
    btn.textContent=isListening?'⏹️':'🎤';
    btn.classList.toggle('listening',isListening);
  }

  const inlineBtn=document.querySelector('.add-center-voice-inline');
  if(inlineBtn){
    inlineBtn.textContent=isListening?'⏹️':'🎤';
    inlineBtn.classList.toggle('listening',isListening);
  }

  const orb=$('addCenterVoiceOrb');
  const title=$('addCenterVoiceTitle');
  const hint=$('addCenterVoiceHint');
  const retry=$('addCenterVoiceRetry');

  if(orb){
    orb.classList.toggle('is-listening',isListening);
    orb.classList.toggle('is-processing',stateText==='processing');
    orb.classList.toggle('is-error',stateText==='error');
    orb.classList.toggle('is-success',stateText==='success');
  }

  if(title){
    if(isListening) title.textContent='Ακούω...';
    else if(stateText==='processing') title.textContent='Επεξεργασία...';
    else if(stateText==='success') title.textContent='Το βρήκα';
    else if(stateText==='error') title.textContent='Δεν άκουσα καθαρά';
    else title.textContent='Πες το έξοδο';
  }

  if(hint){
    if(customHint) hint.textContent=customHint;
    else if(isListening) hint.textContent='Πες “καφές 3” ή πάτα ξανά για stop';
    else if(stateText==='processing') hint.textContent='Μετατρέπω τη φωνή σε έξοδο...';
    else if(stateText==='success') hint.textContent='Συμπλήρωσα το πεδίο. Έλεγξε το preview και αποθήκευσε.';
    else if(stateText==='error') hint.textContent='Πάτα “Ξανά” ή γράψε το έξοδο με λέξεις.';
    else hint.textContent='Π.χ. “καφές 3” ή “σούπερ 25 ticket”';
  }

  if(retry){
    retry.classList.toggle('hidden',stateText!=='error');
  }
}

function startQuickVoice(targetInputId='quickAddInput'){
  const Recognition=getSpeechRecognition();
  quickVoiceLastTargetId=targetInputId || quickVoiceLastTargetId || 'quickAddInput';

  if(!Recognition){
    setQuickVoiceState(false,'error','Ο browser δεν υποστηρίζει φωνητική καταχώρηση.');
    showMiniToast(
      '❌ Ο browser δεν υποστηρίζει voice input',
      'error'
    );
    return;
  }

  if(quickVoiceListening && quickVoiceRecognition){
    quickVoiceRecognition.stop();
    return;
  }

  clearQuickVoiceResetTimer();
  quickVoiceHadResult=false;
  quickVoiceHadError=false;

  const input=$(quickVoiceLastTargetId) || $('quickAddInput');

  quickVoiceRecognition=new Recognition();
  quickVoiceRecognition.lang='el-GR';
  quickVoiceRecognition.interimResults=false;
  quickVoiceRecognition.maxAlternatives=3;
  quickVoiceRecognition.continuous=false;

  quickVoiceRecognition.onstart=()=>{
    setQuickVoiceState(true);
  };

  quickVoiceRecognition.onresult=e=>{
    const text=e.results?.[0]?.[0]?.transcript||'';
    const normalized=(typeof normalizeQuickExpenseText==='function') ? normalizeQuickExpenseText(text) : text;
    quickVoiceHadResult=Boolean(normalized && normalized.trim());

    if(!quickVoiceHadResult){
      setQuickVoiceState(false,'error','Δεν έπιασα καθαρή φράση. Πάτα “Ξανά”.');
      return;
    }

    setQuickVoiceState(false,'processing');

    window.setTimeout(()=>{
      if(input && normalized){
        input.value=normalized.trim();
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.focus();
      }
      setQuickVoiceState(false,'success');
      clearQuickVoiceResetTimer();
      quickVoiceResetTimer=window.setTimeout(()=>setQuickVoiceState(false),1400);
    },180);
  };

  quickVoiceRecognition.onerror=e=>{
    console.warn('Voice recognition error:',e.error);
    quickVoiceHadError=true;

    if(e.error==='not-allowed' || e.error==='service-not-allowed'){
      setQuickVoiceState(false,'error','Δώσε άδεια μικροφώνου από τις ρυθμίσεις του browser/PWA.');
      showMiniToast(
        '❌ Δεν δόθηκε άδεια μικροφώνου',
        'error'
      );
    }else if(e.error==='no-speech'){
      setQuickVoiceState(false,'error','Δεν άκουσα κάτι. Πάτα “Ξανά” και πες π.χ. “καφές 3”.');
    }else if(e.error==='audio-capture'){
      setQuickVoiceState(false,'error','Δεν βρέθηκε μικρόφωνο ή δεν είναι διαθέσιμο.');
    }else{
      setQuickVoiceState(false,'error','Δεν μπόρεσα να ακούσω καθαρά. Πάτα “Ξανά”.');
      showMiniToast(
        '❌ Δεν μπόρεσα να ακούσω καθαρά',
        'error'
      );
    }
  };

  quickVoiceRecognition.onend=()=>{
    if(quickVoiceHadResult || quickVoiceHadError){
      quickVoiceListening=false;
      return;
    }
    setQuickVoiceState(false,'error','Δεν άκουσα κάτι. Πάτα “Ξανά” και πες π.χ. “καφές 3”.');
  };

  try{
    quickVoiceRecognition.start();
  }catch(e){
    console.warn('Voice recognition start failed:',e);
    setQuickVoiceState(false,'error','Δεν μπόρεσα να ανοίξω το μικρόφωνο. Δοκίμασε ξανά.');
  }
}

function retryQuickVoice(){
  startQuickVoice(quickVoiceLastTargetId || 'quickAddSheetInput');
}

function setQuickAddInlineError(message,targetId='quickAddError'){
  const el=document.getElementById(targetId);
  if(!el)return;

  el.classList.add('visible');
  el.classList.remove('hidden');

  el.innerHTML=`
    <span class="quick-add-error-icon">⚠️</span>
    <span>${esc(message)}</span>
  `;
}

function clearQuickAddInlineError(targetId='quickAddError'){
  const el=document.getElementById(targetId);
  if(!el)return;

  el.classList.remove('visible');
  el.classList.add('hidden');
  el.innerHTML='';
}


// CAPVO v1.0.10 — normalize common Greek speech numbers for Quick Add.
// Web Speech often returns “καφές τρία” instead of “καφές 3”.
function normalizeQuickExpenseText(text){
  let value=String(text||'').toLowerCase().trim();
  if(!value)return '';

  value=value
    .replace(/[άὰᾶ]/g,'α')
    .replace(/[έὲ]/g,'ε')
    .replace(/[ήὴ]/g,'η')
    .replace(/[ίϊΐὶ]/g,'ι')
    .replace(/[όὸ]/g,'ο')
    .replace(/[ύϋΰὺ]/g,'υ')
    .replace(/[ώὼ]/g,'ω')
    .replace(/\s+/g,' ');

  const units={
    'μηδεν':0,'μηδενικο':0,
    'ενα':1,'ενας':1,'μια':1,'μιαν':1,'εναμιση':1.5,'ενάμιση':1.5,
    'δυο':2,'δυομισι':2.5,'δυόμισι':2.5,
    'τρια':3,'τρεις':3,
    'τεσσερα':4,'τεσσερις':4,
    'πεντε':5,
    'εξι':6,
    'επτα':7,'εφτα':7,
    'οκτω':8,'οχτω':8,
    'εννεα':9,'εννια':9,
    'δεκα':10,
    'εντεκα':11,
    'δωδεκα':12,
    'δεκατρια':13,'δεκατρεις':13,
    'δεκατεσσερα':14,'δεκατεσσερις':14,
    'δεκαπεντε':15,
    'δεκαεξι':16,
    'δεκαεπτα':17,'δεκαεφτα':17,
    'δεκαοκτω':18,'δεκαοχτω':18,
    'δεκαεννεα':19,'δεκαεννια':19
  };
  const tens={
    'εικοσι':20,'εικοσιν':20,
    'τριαντα':30,
    'σαραντα':40,
    'πενηντα':50,
    'εξηντα':60,
    'εβδομηντα':70,
    'ογδοντα':80,
    'ενενηντα':90
  };

  const tokens=value.split(' ');
  const out=[];

  for(let i=0;i<tokens.length;i++){
    const token=tokens[i].replace(/[.,;:!?]/g,'');
    const next=(tokens[i+1]||'').replace(/[.,;:!?]/g,'');

    if(tens[token]!==undefined && units[next]!==undefined && units[next] < 10){
      out.push(String(tens[token]+units[next]));
      i++;
      continue;
    }

    if(tens[token]!==undefined){
      out.push(String(tens[token]));
      continue;
    }

    if(units[token]!==undefined){
      out.push(String(units[token]).replace('.',','));
      continue;
    }

    out.push(tokens[i]);
  }

  return out.join(' ').replace(/\s+/g,' ').trim();
}

window.normalizeQuickExpenseText=window.normalizeQuickExpenseText || normalizeQuickExpenseText;

function getQuickAddParsed(text){
  const value=(typeof normalizeQuickExpenseText==='function' ? normalizeQuickExpenseText(text) : (text||'')).trim();
  if(!value)return null;

  if(typeof quickAddPreviewData==='function'){
    return quickAddPreviewData(value);
  }

  if(typeof parseExpense==='function'){
    try{
      return parseExpense(value);
    }catch(e){
      console.warn('quick add parser failed',e);
      return null;
    }
  }

  return null;
}

async function quickAddExpense(sourceInputId='quickAddInput',options={}){
  const input=$(sourceInputId) || $('quickAddInput');
  const text=(input?.value||'').trim();
  const isSheet=sourceInputId==='quickAddSheetInput';
  const errorTarget=options.errorTarget || (isSheet ? 'quickAddSheetError' : null);
  const fallbackToSheet=!!options.fallbackToSheet;

  if(errorTarget) clearQuickAddInlineError(errorTarget);

  if(!text){
    input?.focus();
    return false;
  }

  const parsed=getQuickAddParsed(text);
  const invalidMessage='Δεν βρέθηκε έγκυρο ποσό. Δοκίμασε π.χ. “καφές 3”.';

  if(!parsed || !Number(parsed.amount)){
    if(fallbackToSheet && !isSheet && typeof openQuickAddSheet==='function'){
      openQuickAddSheet(text,invalidMessage);
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return false;
    }

    if(errorTarget){
      setQuickAddInlineError(invalidMessage,errorTarget);
    }else{
      showMiniToast('⚠️ Γράψε ποσό, π.χ. καφές 3','error');
    }

    input?.focus();
    return false;
  }

  const userId=getDataOwnerId();

  if(!userId){
    const message='Δεν υπάρχει ενεργή σύνδεση Google για να αποθηκευτεί το έξοδο.';

    if(errorTarget){
      setQuickAddInlineError(message,errorTarget);
    }else{
      showMiniToast('❌ Δεν υπάρχει ενεργή σύνδεση','error');
    }

    return false;
  }

  const expense={
    id:gid(),
    name:parsed.name || 'Έξοδο',
    amount:Number(parsed.amount)||0,
    category:parsed.category || 'Άλλο',
    date:parsed.date||new Date().toISOString().split('T')[0],
    paymentSourceId:parsed.paymentSourceId||'',
    paymentSourceName:parsed.paymentSourceName||'',
    paymentSourceType:parsed.paymentSourceType||''
  };

  const monthKey=expense.date.substring(0,7);
  ensM(monthKey);

  const canSave=await validateExpenseBeforeSave(expense,{errorTarget});
  if(!canSave)return false;

  try{
    D.months[monthKey].daily.push(expense);

    await saveDailyExpenseRow(userId,expense);

    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    curM=monthKey;

    if(errorTarget) clearQuickAddInlineError(errorTarget);

    render();
    showMiniToast('✅ Το έξοδο προστέθηκε');

    return true;

  }catch(e){
    D.months[monthKey].daily=D.months[monthKey].daily.filter(x=>x.id!==expense.id);

    console.error('quickAddExpense failed:',e);

    if(errorTarget){
      setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.',errorTarget);
    }else{
      showMiniToast('❌ Δεν μπόρεσα να αποθηκεύσω το έξοδο','error');
    }

    return false;
  }
}

function doExport(){const b=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='expense_tracker_'+new Date().toISOString().split('T')[0]+'.json';a.click();URL.revokeObjectURL(a.href)}

function doImport(ev){
  const f=ev.target.files[0];
  if(!f)return;

  const r=new FileReader();

  r.onload=async e=>{
    try{
      const d=JSON.parse(e.target.result);

      if(!d.months && !d.fixedExpenses){
        showMiniToast(
          '❌ Μη έγκυρο αρχείο',
          'error'
        );
        return;
      }

      D=d;

      if(!D.incomeSources)D.incomeSources=[];
      if(!D.fixedExpenses)D.fixedExpenses=[];
      if(!D.creditCards)D.creditCards=[];
      if(!D.months)D.months={};

      refreshComputedIncome();

      await saveToSupabase();

      render();
      showMiniToast('✅ Η εισαγωγή ολοκληρώθηκε');

    }catch(err){
      console.error('Import error:',err);
      showMiniToast(
        '❌ Σφάλμα εισαγωγής',
        'error'
      );
    }
  };

  r.readAsText(f);
  ev.target.value='';
}

async function doReset(){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή δεδομένων',
    message:'Θέλεις να διαγράψεις όλα τα δεδομένα σου;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  const doubleConfirmed=await showConfirmModal({
    title:'Τελική επιβεβαίωση',
    message:'Η ενέργεια δεν αναιρείται.',
    confirmText:'Οριστική διαγραφή'
  });

  if(!doubleConfirmed)return;

  try{

    localStorage.removeItem(SK);

    showMiniToast('✅ Τα δεδομένα διαγράφηκαν');

    setTimeout(()=>{
      location.reload();
    },900);

  }catch(e){

    console.error('Reset failed:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeM();

  if(e.key==='Enter'){

    if(document.activeElement&&document.activeElement.id==='quickAddInput'){
      quickAddExpense('quickAddInput',{fallbackToSheet:true});
      return;
    }

    if($('authScreen')&&document.body.classList.contains('auth-pending')){
      if(document.activeElement&&document.activeElement.id==='chatIdInput'){
        connectWithChatId(e);
      }
      return;
    }

    if($('mDaily').classList.contains('active'))saveDaily();
    if($('mFixed').classList.contains('active'))saveFixed();
    if($('mCC').classList.contains('active'))saveCC();
  }
});

document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeM()}));
['fDN','fDA','fFN','fFA','fCCN'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',function(){this.style.borderColor=''})});

function go(v,b){
  capvoBlurActiveField?.();
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));

  const target=$(v);
  if(target)target.classList.add('active');

  const mobileMoreViews=new Set(['vCards','vSavings','vAdvisor','vStats','vArchive','vSettings']);
  const activeNavView=mobileMoreViews.has(v) ? 'vMore' : v;

  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll(`.nav-btn[data-v="${activeNavView}"]`).forEach(el=>el.classList.add('active'));

  if(b && b.classList && b.classList.contains('nav-btn')){
    b.classList.add('active');
  }

  capvoScrollToTop?.();
}
function chMonth(d){const[y,mo]=curM.split('-').map(Number);let nm=mo+d,ny=y;if(nm>12){nm=1;ny++}if(nm<1){nm=12;ny--}curM=ny+'-'+String(nm).padStart(2,'0');ensM(curM);render()}
function goM(k){curM=k;ensM(k);go('vDash',document.querySelector('[data-v="vDash"]'));render()}

async function signInWithGoogle(){
  const redirectTo=window.location.origin+window.location.pathname;

  const {error}=await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo,
      queryParams:{
        access_type:'offline'
      }
    }
  });

  if(error){
    const err=$('authError');
    if(err)err.textContent='Σφάλμα Google login: '+error.message;
  }
}

async function signOutUser(){
  try{
    await supabaseClient.auth.signOut({
      scope:'global'
    });
  }catch(e){
    console.warn('Supabase signOut failed:',e);
  }

  try{
    localStorage.removeItem(SK);
    localStorage.removeItem('expense-hero-auth');
    localStorage.removeItem('expense-hero-auth-code-verifier');

    Object.keys(localStorage)
      .filter(k=>k.startsWith('sb-') || k.includes('supabase'))
      .forEach(k=>localStorage.removeItem(k));

    sessionStorage.clear();

  }catch(e){
    console.warn('Storage cleanup failed:',e);
  }

  currentSession=null;
  currentUser=null;
  currentProfile=null;

  window.location.href=window.location.origin+window.location.pathname;
}

async function getOrCreateProfile(user){
  const metadata=user.user_metadata||{};

  const metadataPayload={
    user_id:user.id,
    email:user.email||'',
    full_name:metadata.full_name||metadata.name||'',
    avatar_url:metadata.avatar_url||metadata.picture||'',
    updated_at:new Date().toISOString()
  };

  const {data:existing,error:selectError}=await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id',user.id)
    .maybeSingle();

  if(selectError)throw selectError;

  if(existing){
    const updatePayload={...metadataPayload};

    // Production ownership now uses auth user_id. Older MVP builds stored
    // synthetic values like capvo_<user_id> in telegram_chat_id only to satisfy
    // Telegram-first RLS. Clear those values so Telegram remains a real optional link.
    if(existing.telegram_chat_id && !isRealTelegramChatId(existing.telegram_chat_id)){
      updatePayload.telegram_chat_id=null;
    }

    const {data,error}=await supabaseClient
      .from('profiles')
      .update(updatePayload)
      .eq('user_id',user.id)
      .select('*')
      .single();

    if(error){
      console.warn('Profile metadata update failed, using existing profile:',error);
      return {...existing,...updatePayload};
    }

    return data;
  }

  const insertPayload={
    ...metadataPayload,
    telegram_chat_id:null
  };

  const {data,error}=await supabaseClient
    .from('profiles')
    .insert(insertPayload)
    .select('*')
    .single();

  if(error)throw error;

  return data;
}


async function migrateLocalOwnerDataToTelegram(previousOwnerId,newTelegramChatId){
  // No-op after production ownership migration.
  // Finance data belongs to auth user_id; Telegram is only a linked input channel.
  return;
}


async function saveTelegramChatId(ev){
  if(ev)ev.preventDefault();

  const input=$('chatIdInput');
  const codeInput=$('telegramCodeInput');
  const err=$('authError');

  const chatId=(input?.value||'').trim();
  const code=(codeInput?.value||'').trim();
  const previousOwnerId=getDataOwnerId();

  if(err)err.textContent='';

  if(!currentUser){
    if(err)err.textContent='Πρέπει πρώτα να συνδεθείς με Google.';
    return;
  }

  if(!chatId){
    if(err)err.textContent='Βάλε το Telegram Chat ID σου.';
    input?.focus();
    return;
  }

  if(!/^\d+$/.test(chatId)){
    if(err)err.textContent='Το Chat ID πρέπει να περιέχει μόνο αριθμούς.';
    input?.focus();
    return;
  }

  if(!code){
    if(err)err.textContent='Βάλε τον κωδικό σύνδεσης από το Telegram.';
    codeInput?.focus();
    return;
  }

  if(!/^\d{6}$/.test(code)){
    if(err)err.textContent='Ο κωδικός πρέπει να είναι 6 ψηφία.';
    codeInput?.focus();
    return;
  }

  setAuthLoading(true);

  try{
    const token=currentSession?.access_token;

    if(!token){
      throw new Error('Δεν υπάρχει ενεργό session.');
    }

    const workerUrl=(CONFIG.WORKER_URL||'').replace(/\/+$/,'');
    const verifyUrl=`${workerUrl}/verify-link`;

    console.log('verify-link url:', `${workerUrl}/verify-link`);

    const res=await fetch(verifyUrl,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+token
      },
      body:JSON.stringify({
        chat_id:chatId,
        code
      })
    });

    let data={};

    try{
      data=await res.json();
    }catch(jsonError){
      data={
        error:'Verification response was not JSON',
        message:'Δεν μπορέσαμε να διαβάσουμε την απάντηση επιβεβαίωσης. Δοκίμασε ξανά.'
      };
    }

    if(!res.ok || data.error){
      const verificationError=new Error(data.message||data.error||'Verification failed');
      verificationError.code=data.code||'';
      verificationError.status=res.status;
      verificationError.detail=data.detail||'';
      throw verificationError;
    }

    let verifiedProfile=data.profile||null;

    // Telegram linking is a privileged operation and must be completed by the
    // Worker after validating the Telegram /code. The frontend must not update
    // profiles.telegram_chat_id directly.
    currentProfile={
      ...(currentProfile||{}),
      ...(verifiedProfile||{}),
      telegram_chat_id:chatId
    };

    changingTelegramId=false;
    localStorage.setItem(SK,chatId);

    const btn=$('authSubmitBtn');

    if(btn){
      btn.disabled=true;
      btn.innerHTML='⏳ Φόρτωση...';
    }

    showMiniToast('✅ Το Telegram συνδέθηκε');

    await loadUserData();

    return;

  }catch(e){
    console.error('saveTelegramChatId error:',e);

    if(err){
      const code=e?.code||'';
      let message=e?.message||'Δεν έγινε επιβεβαίωση. Έλεγξε Chat ID και κωδικό.';

      if(code==='TELEGRAM_ALREADY_LINKED_TO_OTHER_ACCOUNT'){
        message='Αυτό το Telegram είναι ήδη συνδεδεμένο με άλλο λογαριασμό. Για test, καθάρισε πρώτα το telegram_chat_id από το παλιό profile ή μπες με τον παλιό λογαριασμό.';
      }else if(code==='TELEGRAM_LINK_CODE_INVALID_OR_EXPIRED'){
        message='Ο κωδικός δεν είναι σωστός ή έχει λήξει. Στείλε ξανά /code στο Telegram bot και δοκίμασε ξανά.';
      }else if(code==='TELEGRAM_LINK_INVALID_FORMAT'){
        message='Το Chat ID πρέπει να είναι αριθμός και ο κωδικός πρέπει να είναι 6 ψηφία.';
      }else if(code==='TELEGRAM_LINK_PROFILE_UPDATE_FAILED'){
        message='Ο κωδικός επιβεβαιώθηκε, αλλά δεν μπορέσαμε να συνδέσουμε το Telegram στο profile. Δοκίμασε ξανά.';
      }else if(!message || message==='Verification failed' || message==='Profile update failed'){
        message='Δεν έγινε επιβεβαίωση. Έλεγξε Chat ID και κωδικό.';
      }

      err.textContent=message;
    }
  }finally{
    setAuthLoading(false);
  }
}

function showApp(){
  document.body.classList.remove('auth-pending');

  const auth=$('authScreen');

  if(auth){
    auth.classList.add('auth-hidden');
    auth.style.display='none';
    auth.style.pointerEvents='none';
    auth.style.opacity='0';
    auth.style.visibility='hidden';
  }
}

function renderAuthState(){
  const googleBox=$('googleLoginBox');
  const telegramBox=$('telegramLinkBox');
  const userBox=$('authUserBox');
  const err=$('authError');

  if(err)err.textContent='';

  if(!currentUser){
    if(googleBox)googleBox.style.display='block';
    if(telegramBox)telegramBox.style.display='none';
    return;
  }

  if(googleBox)googleBox.style.display='none';

  // CAPVO v1.1.7.4
  // Telegram linking is no longer part of the mandatory post-Google-login flow.
  // After Google auth, the user should go to onboarding/dashboard. The Telegram
  // screen must be shown only from an explicit action, e.g. Settings -> connect/change Telegram,
  // or an onboarding CTA that intentionally sets changingTelegramId=true.
  const shouldShowTelegramLink = !!changingTelegramId;
  if(telegramBox)telegramBox.style.display = shouldShowTelegramLink ? 'block' : 'none';

  if(!shouldShowTelegramLink){
    return;
  }

  if(userBox){
    userBox.innerHTML=`
      Συνδέθηκες ως:<br>
      <strong>${esc(currentUser.email||'Google user')}</strong>
    `;
  }

  const realTelegramChatId=getTelegramChatId();

  if(realTelegramChatId && !changingTelegramId){
    const input=$('chatIdInput');
    if(input)input.value=realTelegramChatId;
  }
}

function setAuthLoading(isLoading){const btn=$('authSubmitBtn');if(!btn)return;btn.disabled=isLoading;btn.textContent=isLoading?'Σύνδεση...':'Σύνδεση'}

function showAuth(message){
  document.body.classList.add('auth-pending');

  const auth=$('authScreen');
  const input=$('chatIdInput');
  const err=$('authError');

  if(auth){
    auth.classList.remove('auth-hidden');
    auth.style.display='flex';
    auth.style.pointerEvents='auto';
    auth.style.opacity='1';
    auth.style.visibility='visible';
    auth.style.zIndex='9999';
  }

  if(err)err.textContent=message||'';
  if(input)setTimeout(()=>input.focus(),80);
}

function hideAuth(){
  document.body.classList.remove('auth-pending');

  const auth=$('authScreen');

  if(auth){
    auth.classList.add('auth-hidden');
    auth.style.display='none';
    auth.style.pointerEvents='none';
    auth.style.opacity='0';
    auth.style.visibility='hidden';
    auth.style.zIndex='-1';
  }
}

async function loadUserData(userId){
  const ownerId=userId||getDataOwnerId();
  await fetchAllData(ownerId);
  curM=curMK();
  ensM(curM);
  render();
  go('vDash',document.querySelector('[data-v="vDash"]'));
  hideAuth();
  if(typeof capvoAfterUserDataLoaded==='function'){
    await capvoAfterUserDataLoaded(ownerId);
  }
}

async function connectWithChatId(ev){
  return saveTelegramChatId(ev);
}

function switchChatId(){

  changingTelegramId=true;

  closeM();

  const input=$('chatIdInput');
  if(input)input.value='';

  showAuth(getTelegramChatId()?'Σύνδεσε νέο Telegram Chat ID. Μέχρι να ολοκληρωθεί η αλλαγή, η παλιά σύνδεση παραμένει ενεργή.':'Σύνδεσε το Telegram για να ενεργοποιήσεις το Sync.');
  renderAuthState();

  const btn=$('authSubmitBtn');

  if(btn){
    btn.disabled=false;
    btn.textContent='Σύνδεση Telegram';
  }

  setTimeout(()=>{
    input?.focus();
  },100);
}

function cleanOAuthUrl(){
  if(window.location.search.includes('code=')){
    window.history.replaceState(
      {},
      document.title,
      window.location.origin + window.location.pathname
    );
  }
}

async function handleOAuthCallback(){
  const url=new URL(window.location.href);
  const code=url.searchParams.get('code');

  if(!code)return null;

  try{
    const {data,error}=await supabaseClient.auth.exchangeCodeForSession(code);

    cleanOAuthUrl();

    if(error){
      console.error('OAuth exchange failed:',error);
      return null;
    }

    return data?.session||null;

  }catch(e){
    console.error('OAuth exchange failed:',e);

    cleanOAuthUrl();

    return null;
  }
}

async function saveTelegramLinkRequest(row, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/telegram_link_requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        chat_id: row.chat_id,
        code: row.code
      })
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Telegram link request insert failed: ' + txt);
  }
}

async function initApp(){
  if(appInitStarted){
    return;
  }

  appInitStarted=true;
  authBooting=true;

  try{
    const callbackSession=await handleOAuthCallback();

    let session=callbackSession;

    if(!session){
      const result=await supabaseClient.auth.getSession();

      if(result.error)throw result.error;

      session=result.data?.session||null;
    }

    currentSession=session;
    currentUser=session?.user||null;

    if(!currentUser){
      showAuth();
      renderAuthState();
      return;
    }

    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=getTelegramChatId();

    if(chatId){
      if(!isRealTelegramChatId(currentProfile?.telegram_chat_id)){
        currentProfile={...(currentProfile||{}),telegram_chat_id:chatId};
      }
      localStorage.setItem(SK,chatId);
    }else{
      localStorage.removeItem(SK);
    }

    await loadUserData();

  }catch(e){
    console.error('Init error:',e);
    showAuth('Σφάλμα φόρτωσης: '+e.message);
    renderAuthState();

  }finally{
    authBooting=false;
  }
}

supabaseClient.auth.onAuthStateChange(async (event,session)=>{
  // During the manual PKCE callback (?code=...), initApp() is responsible for
  // exchanging the code. Supabase may emit a temporary null INITIAL_SESSION before
  // the exchange completes; do not show the login screen from that transient event.
  if(authBooting || window.location.search.includes('code='))return;

  currentSession=session;
  currentUser=session?.user||null;

  if(event==='SIGNED_IN' || event==='INITIAL_SESSION'){
    cleanOAuthUrl();
  }

  if(!currentUser){
    currentProfile=null;

    // Only clear the linked chat id on an explicit sign out.
    // Other transient auth events can momentarily have no user/session and
    // should not wipe the Telegram link.
    if(event==='SIGNED_OUT'){
      localStorage.removeItem(SK);
    }

    showAuth();
    renderAuthState();
    return;
  }

  try{
    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=getTelegramChatId();

    if(chatId){
      if(!isRealTelegramChatId(currentProfile?.telegram_chat_id)){
        currentProfile={...(currentProfile||{}),telegram_chat_id:chatId};
      }
      localStorage.setItem(SK,chatId);
    }else{
      localStorage.removeItem(SK);
    }

    await loadUserData();

  }catch(e){
    console.error('Auth state error:',e);
    showAuth('Σφάλμα authentication: '+e.message);
    renderAuthState();
  }
});

function quickAddFallbackParse(text){
  const raw=(text||'').trim();
  const amountMatch=raw.match(/(\d+[,.]?\d*)/);
  if(!amountMatch)return null;

  const amount=Number(amountMatch[1].replace(',','.'))||0;
  if(amount<=0)return null;

  const name=raw.replace(amountMatch[0],'').replace(/\b(ticket|voucher|κάρτα|card|μετρητά|cash)\b/gi,'').trim() || 'Έξοδο';
  const lower=raw.toLowerCase();

  let category='Άλλο';
  if(/καφ|coffee/.test(lower)) category='Καφέδες';
  else if(/σουπερ|super|market|μάρκετ|ψώνια/.test(lower)) category='Τρόφιμα';
  else if(/φαγη|food|burger|pizza|πίτσα|σουβλ/.test(lower)) category='Φαγητό έξω';
  else if(/βενζ|καυσ|ταξι|taxi|μεταφ/.test(lower)) category='Μεταφορά';

  let paymentSourceName='';
  if(/ticket|voucher/.test(lower)) paymentSourceName='Ticket';
  else if(/καρτα|κάρτα|card/.test(lower)) paymentSourceName='Κάρτα';
  else if(/cash|μετρη/.test(lower)) paymentSourceName='Μετρητά';

  return {name,amount,category,paymentSourceName};
}

function quickAddPreviewData(text){
  const value=(typeof normalizeQuickExpenseText==='function' ? normalizeQuickExpenseText(text) : (text||'')).trim();
  if(!value)return null;

  if(typeof parseExpense==='function'){
    try{
      const parsed=parseExpense(value);
      if(parsed)return parsed;
    }catch(e){
      console.warn('quick preview parser failed',e);
    }
  }

  return quickAddFallbackParse(value);
}

function renderSmartQuickPreview(targetId,text){
  const el=document.getElementById(targetId);
  if(!el)return;

  const value=(text||'').trim();
  const parsed=quickAddPreviewData(value);

  if(!value){
    el.classList.remove('visible','invalid');
    el.innerHTML='';
    return;
  }

  if(!parsed){
    el.classList.add('visible','invalid');
    el.innerHTML=`
      <div class="smart-preview-icon">?</div>
      <div class="smart-preview-main">
        <strong>Δεν βρήκα ποσό</strong>
        <span>Δοκίμασε κάτι σαν “καφές 3”</span>
      </div>
    `;
    return;
  }

  const icon=(typeof CEMO!=='undefined' && CEMO[parsed.category]) ? CEMO[parsed.category] : '📌';
  const amount=(typeof fmt==='function') ? fmt(parsed.amount) : `€${Number(parsed.amount||0).toFixed(2)}`;
  const payment=parsed.paymentSourceName || 'Budget';

  el.classList.add('visible');
  el.classList.remove('invalid');
  el.innerHTML=`
    <div class="smart-preview-icon">${icon}</div>
    <div class="smart-preview-main">
      <strong>${esc(parsed.name || 'Έξοδο')}</strong>
      <span>${esc(parsed.category || 'Άλλο')} · ${esc(payment)}</span>
    </div>
    <div class="smart-preview-amount">-${amount}</div>
  `;
}

function renderQuickRepeatChips(){
  const el=document.getElementById('quickRepeatChips');
  if(!el || typeof D==='undefined' || typeof curM==='undefined')return;

  const daily=(D.months[curM]?.daily || [])
    .slice()
    .sort((a,b)=>String(b.id||'').localeCompare(String(a.id||'')))
    .slice(0,3);

  if(daily.length===0){
    el.innerHTML='';
    return;
  }

  el.innerHTML=daily.map(e=>{
    const text=`${e.name} ${String(Number(e.amount)||0).replace('.',',')}`;
    return `<button type="button" onclick="fillQuickAdd('${esc(text)}')">+ ${esc(e.name)} ${fmt(e.amount)}</button>`;
  }).join('');
}

function fillQuickAdd(text){
  const input=document.getElementById('quickAddInput');
  if(!input)return;
  input.value=text;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus();
}

function setupQuickAddMobileState(){
  const input=document.getElementById('quickAddInput');

  if(input){
    const sync=()=>{
      // Dashboard quick add is intentionally minimal:
      // input + voice + chips only. No preview, no inline error, no large submit button.
    };

    input.addEventListener('input',sync);
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        quickAddExpense('quickAddInput',{fallbackToSheet:true});
      }
    });
    sync();
  }

  const sheetInput=document.getElementById('quickAddSheetInput');
  const sheetSubmit=document.getElementById('quickAddSheetSubmit');

  if(sheetInput){
    const syncSheet=()=>{
      const hasValue=sheetInput.value.trim().length>0;
      sheetSubmit?.classList.toggle('is-visible',hasValue);
      renderSmartQuickPreview('quickAddSheetPreview',sheetInput.value);
      if(hasValue) clearQuickAddInlineError('quickAddSheetError');
    };

    sheetInput.addEventListener('input',syncSheet);
    sheetInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        submitQuickAddSheet();
      }
    });
    syncSheet();
  }

  renderQuickRepeatChips();
}

function openQuickAddSheet(prefill='',errorMessage=''){
  const sheet=document.getElementById('quickAddSheet');
  const input=document.getElementById('quickAddSheetInput');
  if(!sheet)return;

  sheet.classList.add('active');
  document.body.classList.add('quick-sheet-open');

  if(input && typeof prefill==='string' && prefill.trim()){
    input.value=prefill.trim();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  clearQuickAddInlineError('quickAddSheetError');

  if(errorMessage){
    setQuickAddInlineError(errorMessage,'quickAddSheetError');
  }

  setTimeout(()=>input?.focus(),120);
}

function closeQuickAddSheet(event){
  if(event && event.target && event.target.id!=='quickAddSheet')return;

  const sheet=document.getElementById('quickAddSheet');
  sheet?.classList.remove('active');
  document.body.classList.remove('quick-sheet-open');
}

function fillQuickAddSheet(text){
  const input=document.getElementById('quickAddSheetInput');
  if(!input)return;
  input.value=text;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus();
}

async function submitQuickAddSheet(){
  const sheetInput=document.getElementById('quickAddSheetInput');

  clearQuickAddInlineError('quickAddSheetError');

  const text=(sheetInput?.value || '').trim();

  if(!text){
    sheetInput?.focus();
    return false;
  }

  const saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});

  if(!saved){
    return false;
  }

  if(sheetInput){
    sheetInput.value='';
    sheetInput.dispatchEvent(new Event('input',{bubbles:true}));
  }

  closeQuickAddSheet();
  return true;
}

document.addEventListener('DOMContentLoaded', setupQuickAddMobileState);
// initApp() is called from advisor.js


/* ============================================================
   CAPVO v1.1.7 - First-use Wizard / Onboarding
   ============================================================ */
function capvoHasBasicSetup(){
  const hasPrimary=(D.incomeSources||[]).some(s=>s && s.includeInBudget && (s.isPrimaryIncome || s.category==='Μισθός' || s.name==='Μισθός'));
  const hasBudget=(D.incomeSources||[]).some(s=>s && s.includeInBudget && capvoMoney(Number(s.amount)||0)>0);
  const hasDaily=Object.values(D.months||{}).some(m=>(m.daily||[]).length>0);
  return hasPrimary || hasBudget || hasDaily;
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
    salaryName:'Μισθός',
    salaryAmount:'',
    ticketAmount:'',
    voucherAmount:'',
    fixed:[
      {name:'Ενοίκιο / Δάνειο',amount:'',category:'Σπίτι'},
      {name:'Internet / Τηλέφωνο',amount:'',category:'Λογαριασμοί'},
      {name:'Συνδρομές',amount:'',category:'Συνδρομές'}
    ],
    savingsName:general.name||'Γενική αποταμίευση',
    savingsIcon:general.icon||'💰'
  };
}

function openCapvoOnboardingWizard(step){
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  if(typeof step==='number')window.__capvoOnboarding.step=step;
  renderCapvoOnboardingWizard();
}

function closeCapvoOnboardingWizard(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open','onboarding-open');
}

function capvoOnboardingUpdateFromInputs(){
  const s=window.__capvoOnboarding||capvoWizardDefaultState();
  const get=id=>document.getElementById(id);
  if(get('obCycleTypeFixed')||get('obCycleTypeLast')){
    s.cycleType=get('obCycleTypeLast')?.checked?'last_working_day':'fixed_day';
    s.cycleDay=Math.max(1,Math.min(31,Number(get('obCycleDay')?.value)||1));
  }
  if(get('obSalaryAmount')){
    s.salaryName=(get('obSalaryName')?.value||'Μισθός').trim()||'Μισθός';
    s.salaryAmount=get('obSalaryAmount')?.value||'';
  }
  if(get('obTicketAmount')||get('obVoucherAmount')){
    s.ticketAmount=get('obTicketAmount')?.value||'';
    s.voucherAmount=get('obVoucherAmount')?.value||'';
  }
  if(get('obFixed0Amount')){
    s.fixed=(s.fixed||[]).map((row,idx)=>({
      name:(get(`obFixed${idx}Name`)?.value||row.name||'Πάγιο').trim(),
      amount:get(`obFixed${idx}Amount`)?.value||'',
      category:row.category||'Πάγια'
    }));
  }
  if(get('obSavingsName')){
    s.savingsName=(get('obSavingsName')?.value||'Γενική αποταμίευση').trim()||'Γενική αποταμίευση';
    s.savingsIcon=(get('obSavingsIcon')?.value||'💰').trim()||'💰';
  }
  window.__capvoOnboarding=s;
  return s;
}

function capvoPersistOnboardingStep(step){
  const numericStep=Math.max(0,Math.min(3,Number(step)||0));
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
  return 'Τρέχων κύκλος';
}

function capvoOnboardingStepHtml(s){
  const step=Math.max(0,Math.min(3,Number(s.step)||0));
  const steps=[
    {label:'Κύκλος', icon:'1'},
    {label:'Budget', icon:'2'},
    {label:'Πάγια', icon:'3'},
    {label:'Telegram', icon:'4'}
  ];
  const isLast=s.cycleType==='last_working_day';
  const day=Number(s.cycleDay||1);

  const stepper=()=>`<div class="ob-pro-stepper" aria-label="CAPVO onboarding progress">${steps.map((item,idx)=>`
    <div class="ob-pro-step ${idx<step?'done':idx===step?'active':'upcoming'}">
      <span>${idx<step?'✓':item.icon}</span>
      ${idx<steps.length-1?'<i></i>':''}
      <small>${item.label}</small>
    </div>`).join('')}</div>`;

  const shell=(title,subtitle,body,actions='')=>`<section class="capvo-onboarding-sheet ob-stepper-pro" onclick="event.stopPropagation()">
    <div class="ob-pro-header">
      <button type="button" class="ob-pro-back ${step===0?'is-hidden':''}" onclick="capvoOnboardingPrev()" aria-label="Πίσω">‹</button>
      <div class="ob-pro-brand"><img src="assets/capvo-mark.png" alt="CAPVO" onerror="this.style.display='none'"><strong>CAPVO</strong></div>
      <button type="button" class="ob-pro-skip" onclick="skipCapvoOnboarding()">Παράλειψη</button>
    </div>
    ${stepper()}
    <div class="ob-pro-copy">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
    <div class="capvo-onboarding-body ob-pro-body">${body}</div>
    ${actions}
    <div class="ob-pro-footnote">Μπορείς να επιστρέψεις ή να αλλάξεις τα πάντα αργότερα.</div>
  </section>`;

  const triActions=(primaryText='Συνέχεια', primaryAction='capvoOnboardingNext()', tertiary='')=>`<div class="ob-pro-actions three">
      <button type="button" class="ob-pro-link" onclick="skipCapvoOnboarding()">Παράλειψη</button>
      <button type="button" class="ob-pro-secondary" onclick="capvoOnboardingPrev()">Πίσω</button>
      <button type="button" class="ob-pro-primary" onclick="${primaryAction}">${primaryText} <span>→</span></button>
      ${tertiary}
    </div>`;

  if(step===0){
    return shell(
      'Καλωσόρισες στο CAPVO',
      'Ας ρυθμίσουμε τον κύκλο σου σε λίγα βήματα.',
      `
      <div class="ob-pro-card hero ob-pro-welcome-exact">
        <div class="ob-pro-card-head">
          <div>
            <span>1ο βήμα</span>
            <h3>Οικονομικός κύκλος</h3>
            <p>Επίλεξε τη διάρκεια του οικονομικού σου κύκλου για να ξεκινήσουμε.</p>
          </div>
          <div class="ob-pro-hero-icon premium-cycle" aria-hidden="true"></div>
        </div>

        <div class="ob-pro-benefits">
          <div><i class="premium-mini-icon calendar"></i><strong>Παρακολούθησε τον κύκλο σου με ακρίβεια.</strong></div>
          <div><i class="premium-mini-icon chart"></i><strong>Έλεγξε έσοδα και έξοδα σε πραγματικό χρόνο.</strong></div>
          <div><i class="premium-mini-icon target"></i><strong>Πάρε καλύτερες αποφάσεις με ξεκάθαρα δεδομένα.</strong></div>
        </div>

        <div class="ob-pro-cycle-editor">
          <label class="ob-pro-label">Τύπος κύκλου</label>
          <div class="ob-pro-pill-grid two">
            <label class="ob-pro-pill ${!isLast?'selected':''}" data-cycle-type="fixed_day">
              <input type="radio" name="obCycleType" id="obCycleTypeFixed" value="fixed_day" ${!isLast?'checked':''}>
              <strong>Συγκεκριμένη ημέρα</strong>
              <small>π.χ. κάθε 1 του μήνα</small>
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
              <input id="obCycleDay" type="number" min="1" max="31" inputmode="numeric" value="${esc(s.cycleDay||1)}" ${isLast?'disabled':''}>
              <span>του μήνα</span>
            </div>
            <div class="ob-pro-inline-note">${isLast?'Δεν χρειάζεται ημέρα. Το CAPVO θα βρίσκει αυτόματα την τελευταία εργάσιμη.':'Γράψε οποιαδήποτε ημέρα από 1 έως 31, π.χ. 8 ή 28.'}</div>
          </div>
        </div>
      </div>`,
      `<div class="ob-pro-actions single"><button type="button" class="ob-pro-primary" onclick="capvoOnboardingNext()">Ξεκίνα το setup <span>→</span></button></div>`
    );
  }

  if(step===1){
    return shell(
      'Βασικό budget',
      'Όρισε το ποσό που έχεις διαθέσιμο για αυτόν τον κύκλο.',
      `
      <div class="ob-pro-card budget">
        <label class="ob-pro-small-label">Προτεινόμενο βασικό budget</label>
        <label class="ob-pro-budget-box">
          <div class="ob-pro-currency">€</div>
          <input id="obSalaryAmount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.salaryAmount||'')}" placeholder="800,00">
          <small>${esc(capvoCurrentCycleLabelSafe())}</small>
        </label>
        <label class="ob-pro-inline-input"><span>Όνομα πηγής</span><input id="obSalaryName" type="text" value="${esc(s.salaryName||'Μισθός')}" placeholder="Μισθός"></label>
        <div class="ob-pro-toggle-panel">
          <strong>Χρήση ως βασικό budget</strong>
          <small>Θα χρησιμοποιείται ως σημείο αναφοράς σε όλη την εφαρμογή.</small>
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
    const rows=(s.fixed||[]).map((row,idx)=>{
      const icon=idx===0?'🏠':idx===1?'📶':'▶️';
      return `<label class="ob-pro-fixed-row">
        <i>${icon}</i>
        <input id="obFixed${idx}Name" type="text" value="${esc(row.name||'')}" placeholder="Πάγιο">
        <input id="obFixed${idx}Amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(row.amount||'')}" placeholder="0,00">
      </label>`;
    }).join('');
    return shell(
      'Σταθερές δαπάνες',
      'Προαιρετικό. Μπορείς να τις προσθέσεις τώρα ή αργότερα.',
      `
      <div class="ob-pro-card fixed">
        <div class="ob-pro-tip">Πρόταση: ξεκίνα με 1–2 βασικές υποχρεώσεις και συμπλήρωσε τα υπόλοιπα αργότερα.</div>
        <div class="ob-pro-fixed-stack">${rows}</div>
      </div>`,
      triActions('Συνέχεια','capvoOnboardingNext()')
    );
  }

  return shell(
    'Σύνδεση Telegram',
    'Προαιρετικό. Το CAPVO δουλεύει κανονικά χωρίς Telegram και μπορείς να το συνδέσεις αργότερα από τις Ρυθμίσεις.',
    `
    <div class="ob-pro-card telegram">
      <div class="ob-pro-telegram-orb premium-telegram" aria-hidden="true"></div>
      <div class="ob-pro-benefits three">
        <div><i class="premium-mini-icon chat"></i><strong>“καφές 3”</strong></div>
        <div><i class="premium-mini-icon voice"></i><strong>φωνητικά</strong></div>
        <div><i class="premium-mini-icon sync"></i><strong>optional sync</strong></div>
      </div>
    </div>`,
    `<div class="ob-pro-actions telegram">
      <button type="button" class="ob-pro-secondary" onclick="capvoOnboardingPrev()">Πίσω στο wizard</button>
      <button type="button" class="ob-pro-primary" onclick="finishCapvoOnboarding(true)">Σύνδεση Telegram <span>→</span></button>
      <button type="button" class="ob-pro-link wide" onclick="finishCapvoOnboarding()">Θα το κάνω αργότερα</button>
    </div>`
  );
}



function capvoEnsureOnboardingProStyles(){
  if(document.getElementById('capvoOnboardingProStyles'))return;
  const style=document.createElement('style');
  style.id='capvoOnboardingProStyles';
  style.textContent=`
    #capvoOnboardingOverlay.capvo-onboarding-overlay{
      position:fixed !important; inset:0 !important; z-index:13000 !important;
      display:none !important; align-items:center !important; justify-content:center !important;
      padding:0 !important; background:#f7f8fe !important; overflow:hidden !important;
    }
    #capvoOnboardingOverlay.capvo-onboarding-overlay.active{display:flex !important;}
    #capvoOnboardingOverlay, #capvoOnboardingOverlay *{box-sizing:border-box !important;}
    #capvoOnboardingOverlay .ob-stepper-pro{
      width:min(100%,430px) !important; height:100dvh !important; max-height:100dvh !important;
      overflow:hidden !important; border:0 !important; border-radius:0 !important;
      background:radial-gradient(circle at 86% 2%,rgba(124,58,237,.09),transparent 34%),linear-gradient(180deg,#ffffff 0%,#fbfbff 100%) !important;
      box-shadow:none !important; padding:18px 17px calc(18px + env(safe-area-inset-bottom)) !important;
      display:grid !important; grid-template-rows:auto auto auto minmax(0,1fr) auto auto !important;
      gap:14px !important; font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; color:#111827 !important;
    }
    #capvoOnboardingOverlay .ob-pro-header{display:grid !important;grid-template-columns:40px minmax(0,1fr) auto !important;align-items:center !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-back,#capvoOnboardingOverlay .ob-pro-skip{border:0 !important;cursor:pointer !important;font-family:inherit !important;}
    #capvoOnboardingOverlay .ob-pro-back{width:40px !important;height:40px !important;border-radius:999px !important;background:transparent !important;color:#7b8497 !important;font-size:28px !important;line-height:1 !important;display:grid !important;place-items:center !important;padding:0 !important;}
    #capvoOnboardingOverlay .ob-pro-back.is-hidden{visibility:hidden !important;}
    #capvoOnboardingOverlay .ob-pro-brand{display:flex !important;align-items:center !important;justify-content:flex-start !important;gap:10px !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-brand img{display:block !important;width:28px !important;height:28px !important;min-width:28px !important;border-radius:9px !important;object-fit:cover !important;box-shadow:0 8px 20px rgba(28,31,74,.18) !important;}
    #capvoOnboardingOverlay .ob-pro-brand-mark{display:none !important;
width:28px !important;height:28px !important;min-width:28px !important;border-radius:10px !important;display:grid !important;place-items:center !important;background:linear-gradient(135deg,#191f43,#6547f6) !important;color:#c9b8ff !important;font-size:13px !important;box-shadow:0 6px 18px rgba(15,23,42,.12) !important;}
    #capvoOnboardingOverlay .ob-pro-brand strong{display:block !important;margin:0 !important;color:#162033 !important;font-size:14px !important;line-height:1 !important;font-weight:950 !important;letter-spacing:.16em !important;}
    #capvoOnboardingOverlay .ob-pro-skip{justify-self:end !important;min-height:34px !important;padding:0 12px !important;border-radius:999px !important;background:#f4f5fb !important;color:#667085 !important;font-size:12px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-stepper{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:0 !important;align-items:start !important;padding:0 8px !important;margin:0 !important;list-style:none !important;}
    #capvoOnboardingOverlay .ob-pro-step{position:relative !important;display:grid !important;justify-items:center !important;gap:6px !important;color:#98a2b3 !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-step span{position:relative !important;z-index:2 !important;width:28px !important;height:28px !important;border-radius:999px !important;border:1px solid #e6e8f1 !important;display:grid !important;place-items:center !important;background:#fff !important;color:#7d8799 !important;font-size:12px !important;font-weight:950 !important;line-height:1 !important;}
    #capvoOnboardingOverlay .ob-pro-step i{position:absolute !important;top:13px !important;left:50% !important;width:100% !important;height:2px !important;background:#eceef6 !important;z-index:1 !important;}
    #capvoOnboardingOverlay .ob-pro-step.done i,#capvoOnboardingOverlay .ob-pro-step.active i{background:linear-gradient(90deg,#d9d1ff,#b9a6ff) !important;}
    #capvoOnboardingOverlay .ob-pro-step.done span,#capvoOnboardingOverlay .ob-pro-step.active span{background:linear-gradient(135deg,#6547f6,#7c3aed) !important;border-color:transparent !important;color:#fff !important;box-shadow:0 10px 22px rgba(101,71,246,.28) !important;}
    #capvoOnboardingOverlay .ob-pro-step small{display:block !important;max-width:72px !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;margin:0 !important;color:inherit !important;font-size:10.5px !important;font-weight:850 !important;letter-spacing:-.02em !important;line-height:1.1 !important;text-align:center !important;}
    #capvoOnboardingOverlay .ob-pro-step.active small{color:#6547f6 !important;}
    #capvoOnboardingOverlay .ob-pro-copy{display:grid !important;gap:6px !important;text-align:center !important;padding:0 10px !important;}
    #capvoOnboardingOverlay .ob-pro-copy h2{margin:0 !important;color:#101828 !important;font-size:clamp(21px,5.8vw,28px) !important;line-height:1.08 !important;letter-spacing:-.045em !important;font-weight:950 !important;}
    #capvoOnboardingOverlay .ob-pro-copy p{margin:0 auto !important;max-width:330px !important;color:#6b7280 !important;font-size:13.5px !important;line-height:1.42 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-body{min-height:0 !important;overflow:auto !important;padding:0 2px !important;display:grid !important;gap:12px !important;align-content:start !important;scrollbar-width:thin !important;}
    #capvoOnboardingOverlay .ob-pro-card{border:1px solid #e8eaf3 !important;border-radius:28px !important;background:linear-gradient(180deg,#ffffff,#fbfbff) !important;padding:18px !important;box-shadow:0 16px 34px rgba(15,23,42,.06) !important;display:grid !important;gap:14px !important;overflow:hidden !important;}
    #capvoOnboardingOverlay .ob-pro-card.hero{background:radial-gradient(circle at 92% 12%,rgba(101,71,246,.16),transparent 28%),linear-gradient(180deg,#ffffff,#fbfbff) !important;}
    #capvoOnboardingOverlay .ob-pro-card-head{display:grid !important;grid-template-columns:minmax(0,1fr) 74px !important;align-items:start !important;gap:14px !important;}
    #capvoOnboardingOverlay .ob-pro-card-head span{display:block !important;margin:0 0 7px !important;color:#6547f6 !important;font-size:12px !important;font-weight:950 !important;}
    #capvoOnboardingOverlay .ob-pro-card-head h3{margin:0 0 6px !important;color:#111827 !important;font-size:25px !important;line-height:1.08 !important;font-weight:950 !important;letter-spacing:-.04em !important;}
    #capvoOnboardingOverlay .ob-pro-card-head p{margin:0 !important;color:#6b7280 !important;font-size:13px !important;line-height:1.4 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-hero-icon{width:74px !important;height:74px !important;border-radius:26px !important;display:grid !important;place-items:center !important;background:linear-gradient(135deg,rgba(101,71,246,.12),rgba(124,58,237,.04)) !important;font-size:34px !important;box-shadow:0 16px 36px rgba(101,71,246,.14) !important;}
    #capvoOnboardingOverlay .ob-pro-benefits{display:grid !important;gap:9px !important;}
    #capvoOnboardingOverlay .ob-pro-benefits div{display:grid !important;grid-template-columns:32px 1fr !important;gap:10px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-benefits i{width:32px !important;height:32px !important;border-radius:12px !important;display:grid !important;place-items:center !important;background:#f3efff !important;font-style:normal !important;}
    #capvoOnboardingOverlay .ob-pro-benefits strong{color:#4b5563 !important;font-size:12.5px !important;line-height:1.35 !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-cycle-editor{border-top:1px solid #eef0f7 !important;padding-top:12px !important;display:grid !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-label,#capvoOnboardingOverlay .ob-pro-small-label{display:block !important;color:#6b7280 !important;font-size:12px !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-pill-grid.two,#capvoOnboardingOverlay .ob-pro-inline-two{display:grid !important;grid-template-columns:1fr 1fr !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-pill{position:relative !important;border:1px solid #e7e8f0 !important;border-radius:18px !important;padding:14px !important;display:grid !important;gap:4px !important;background:#fff !important;cursor:pointer !important;user-select:none !important;}
    #capvoOnboardingOverlay .ob-pro-pill.selected{border-color:#8f78ff !important;background:#f8f5ff !important;box-shadow:0 10px 22px rgba(101,71,246,.08) !important;}
    #capvoOnboardingOverlay .ob-pro-pill input{position:absolute !important;opacity:0 !important;pointer-events:none !important;}
    #capvoOnboardingOverlay .ob-pro-pill strong{font-size:13px !important;color:#111827 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-pill small{font-size:11px !important;color:#6b7280 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-day-row{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:8px !important;}
    #capvoOnboardingOverlay .ob-pro-day-row button{min-height:42px !important;border-radius:14px !important;border:1px solid #e7e8f0 !important;background:#fff !important;color:#4b5563 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-day-row button.active{background:linear-gradient(135deg,#6547f6,#7c3aed) !important;color:#fff !important;border-color:transparent !important;}
    #capvoOnboardingOverlay .ob-pro-hidden-field{display:none !important;}
    #capvoOnboardingOverlay .ob-pro-inline-note,#capvoOnboardingOverlay .ob-pro-tip{border:1px solid #ece8ff !important;background:#f7f4ff !important;color:#6b7280 !important;border-radius:16px !important;padding:11px 13px !important;font-size:12px !important;line-height:1.4 !important;font-weight:800 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box{border:1px solid #ebeef5 !important;background:#fff !important;border-radius:24px !important;padding:16px !important;display:grid !important;place-items:center !important;gap:8px !important;text-align:center !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box .ob-pro-currency{font-size:26px !important;font-weight:900 !important;color:#111827 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box input{border:0 !important;outline:none !important;text-align:center !important;width:100% !important;color:#111827 !important;font-size:46px !important;line-height:1 !important;letter-spacing:-.06em !important;font-weight:950 !important;background:transparent !important;padding:0 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box small{color:#8c95a7 !important;font-size:13px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input{display:grid !important;gap:7px !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input span,#capvoOnboardingOverlay .ob-pro-inline-two small{font-size:11.5px !important;font-weight:850 !important;color:#6b7280 !important;}
    #capvoOnboardingOverlay input{font-family:inherit !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input input,#capvoOnboardingOverlay .ob-pro-inline-two input,#capvoOnboardingOverlay .ob-pro-fixed-row input{width:100% !important;min-height:46px !important;border-radius:16px !important;border:1px solid #e7e8f0 !important;background:#fff !important;padding:0 13px !important;color:#111827 !important;font-size:14px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel,#capvoOnboardingOverlay .ob-pro-optional-card{position:relative !important;border:1px solid #eceef6 !important;background:#f9faff !important;border-radius:18px !important;padding:14px !important;display:grid !important;gap:5px !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel strong,#capvoOnboardingOverlay .ob-pro-optional-card > span{font-size:13px !important;color:#111827 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel small{font-size:12px !important;color:#6b7280 !important;font-weight:700 !important;padding-right:48px !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-on{position:absolute !important;right:14px !important;top:16px !important;width:38px !important;height:22px !important;border-radius:999px !important;background:linear-gradient(135deg,#6547f6,#7c3aed) !important;box-shadow:0 8px 18px rgba(101,71,246,.22) !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-on::after{content:'' !important;position:absolute !important;right:3px !important;top:3px !important;width:16px !important;height:16px !important;border-radius:999px !important;background:#fff !important;}
    #capvoOnboardingOverlay .ob-pro-inline-two label{display:grid !important;gap:6px !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-stack{display:grid !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-row{display:grid !important;grid-template-columns:34px 1fr 105px !important;gap:10px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-row i{width:34px !important;height:34px !important;border-radius:12px !important;display:grid !important;place-items:center !important;background:#f4f5fb !important;font-style:normal !important;}
    #capvoOnboardingOverlay .ob-pro-telegram-orb{width:86px !important;height:86px !important;margin:2px auto 6px !important;border-radius:999px !important;display:grid !important;place-items:center !important;background:linear-gradient(180deg,#f7f3ff,#ffffff) !important;color:#6d4df7 !important;font-size:42px !important;box-shadow:0 18px 40px rgba(101,71,246,.14) !important;}
    #capvoOnboardingOverlay .ob-pro-actions{display:grid !important;gap:10px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-actions.single,#capvoOnboardingOverlay .ob-pro-actions.telegram{grid-template-columns:1fr !important;}
    #capvoOnboardingOverlay .ob-pro-actions.three{grid-template-columns:auto 1fr 1fr !important;}
    #capvoOnboardingOverlay .ob-pro-primary,#capvoOnboardingOverlay .ob-pro-secondary,#capvoOnboardingOverlay .ob-pro-link{min-height:50px !important;border-radius:18px !important;font-weight:950 !important;font-family:inherit !important;cursor:pointer !important;padding:0 14px !important;}
    #capvoOnboardingOverlay .ob-pro-primary{border:0 !important;background:linear-gradient(135deg,#6547f6,#7c3aed) !important;color:#fff !important;box-shadow:0 18px 34px rgba(101,71,246,.28) !important;display:flex !important;align-items:center !important;justify-content:center !important;gap:8px !important;}
    #capvoOnboardingOverlay .ob-pro-secondary{border:1px solid #e5e7ef !important;background:#fff !important;color:#667085 !important;}
    #capvoOnboardingOverlay .ob-pro-link{border:0 !important;background:transparent !important;color:#667085 !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-link.wide{width:100% !important;}
    #capvoOnboardingOverlay .ob-pro-footnote{text-align:center !important;color:#98a2b3 !important;font-size:11px !important;line-height:1.35 !important;font-weight:750 !important;padding-bottom:2px !important;}
    @media (min-width:721px){
      #capvoOnboardingOverlay.capvo-onboarding-overlay{padding:22px !important;background:rgba(15,23,42,.55) !important;}
      #capvoOnboardingOverlay .ob-stepper-pro{height:min(840px,calc(100dvh - 44px)) !important;border-radius:34px !important;border:1px solid #e8eaf3 !important;box-shadow:0 24px 70px rgba(15,23,42,.22) !important;}
    }
    @media (max-width:400px){
      #capvoOnboardingOverlay .ob-stepper-pro{padding:14px 14px calc(16px + env(safe-area-inset-bottom)) !important;gap:12px !important;}
      #capvoOnboardingOverlay .ob-pro-copy h2{font-size:26px !important;}
      #capvoOnboardingOverlay .ob-pro-card-head{grid-template-columns:1fr !important;}
      #capvoOnboardingOverlay .ob-pro-hero-icon{display:none !important;}
      #capvoOnboardingOverlay .ob-pro-pill-grid.two,#capvoOnboardingOverlay .ob-pro-inline-two{grid-template-columns:1fr !important;}
      #capvoOnboardingOverlay .ob-pro-fixed-row{grid-template-columns:34px 1fr !important;}
      #capvoOnboardingOverlay .ob-pro-fixed-row input:last-of-type{grid-column:1/-1 !important;}
      #capvoOnboardingOverlay .ob-pro-actions.three{grid-template-columns:1fr 1fr !important;}
      #capvoOnboardingOverlay .ob-pro-actions.three .ob-pro-link{grid-column:1/-1 !important;order:3 !important;}
    }
  `;
  document.head.appendChild(style);
}


function capvoEnsureOnboardingPremiumStyles(){
  if(document.getElementById('capvoOnboardingPremiumStyles'))return;
  const style=document.createElement('style');
  style.id='capvoOnboardingPremiumStyles';
  style.textContent=`
    #capvoOnboardingOverlay .ob-stepper-pro{
      background:
        radial-gradient(circle at 86% 4%,rgba(101,71,246,.075),transparent 32%),
        radial-gradient(circle at 12% 96%,rgba(79,70,229,.045),transparent 30%),
        linear-gradient(180deg,#ffffff 0%,#fbfbff 58%,#f8f8ff 100%) !important;
    }

    #capvoOnboardingOverlay .ob-pro-brand-mark{display:none !important;

      position:relative !important;
      width:28px !important;
      height:28px !important;
      min-width:28px !important;
      border-radius:9px !important;
      display:grid !important;
      place-items:center !important;
      overflow:hidden !important;
      background:
        radial-gradient(circle at 28% 22%,rgba(167,139,250,.95),transparent 22%),
        linear-gradient(135deg,#111827 0%,#24294f 58%,#6547f6 100%) !important;
      box-shadow:0 8px 20px rgba(28,31,74,.18) !important;
    }
    #capvoOnboardingOverlay .ob-pro-brand-mark::before{
      content:'' !important;
      width:13px !important;
      height:13px !important;
      border-radius:4px !important;
      border:2px solid rgba(255,255,255,.72) !important;
      transform:rotate(45deg) !important;
      box-shadow:inset 0 0 0 999px rgba(255,255,255,.06) !important;
    }
    #capvoOnboardingOverlay .ob-pro-brand-mark::after{
      content:'' !important;
      position:absolute !important;
      right:5px !important;
      bottom:5px !important;
      width:5px !important;
      height:5px !important;
      border-radius:999px !important;
      background:#7dd3fc !important;
      box-shadow:0 0 0 3px rgba(125,211,252,.12) !important;
    }

    #capvoOnboardingOverlay .ob-pro-copy h2{
      font-weight:920 !important;
      letter-spacing:-.05em !important;
      text-wrap:balance !important;
    }
    #capvoOnboardingOverlay .ob-pro-copy p{
      color:#6f7a8d !important;
      font-weight:680 !important;
    }

    #capvoOnboardingOverlay .ob-pro-card{
      background:
        linear-gradient(180deg,rgba(255,255,255,.96),rgba(252,252,255,.94)) !important;
      border-color:rgba(226,229,241,.92) !important;
      box-shadow:
        0 18px 40px rgba(17,24,39,.055),
        inset 0 1px 0 rgba(255,255,255,.88) !important;
    }
    #capvoOnboardingOverlay .ob-pro-card.hero{
      background:
        radial-gradient(circle at 90% 11%,rgba(101,71,246,.105),transparent 30%),
        linear-gradient(180deg,#ffffff,#fbfbff) !important;
    }

    #capvoOnboardingOverlay .ob-pro-hero-icon{
      position:relative !important;
      width:74px !important;
      height:74px !important;
      border-radius:25px !important;
      background:
        radial-gradient(circle at 30% 22%,rgba(255,255,255,.9),transparent 22%),
        linear-gradient(135deg,rgba(101,71,246,.15),rgba(79,70,229,.055)) !important;
      box-shadow:
        0 18px 42px rgba(101,71,246,.13),
        inset 0 1px 0 rgba(255,255,255,.95) !important;
      display:block !important;
      font-size:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-hero-icon.premium-cycle::before{
      content:'' !important;
      position:absolute !important;
      inset:18px 18px 24px 18px !important;
      border-radius:10px !important;
      border:2px solid rgba(101,71,246,.42) !important;
      background:
        linear-gradient(90deg,transparent 28%,rgba(101,71,246,.20) 29%,rgba(101,71,246,.20) 31%,transparent 32%),
        linear-gradient(180deg,rgba(101,71,246,.16),rgba(255,255,255,.25)) !important;
    }
    #capvoOnboardingOverlay .ob-pro-hero-icon.premium-cycle::after{
      content:'' !important;
      position:absolute !important;
      left:21px !important;
      right:19px !important;
      bottom:21px !important;
      height:15px !important;
      border-left:3px solid rgba(101,71,246,.75) !important;
      border-bottom:3px solid rgba(101,71,246,.75) !important;
      transform:skew(-18deg) !important;
      border-radius:2px !important;
      box-shadow:13px -7px 0 -2px rgba(101,71,246,.55),25px -14px 0 -3px rgba(101,71,246,.35) !important;
    }

    #capvoOnboardingOverlay .ob-pro-benefits i.premium-mini-icon,
    #capvoOnboardingOverlay .premium-mini-icon{
      position:relative !important;
      width:32px !important;
      height:32px !important;
      min-width:32px !important;
      border-radius:12px !important;
      display:grid !important;
      place-items:center !important;
      background:
        linear-gradient(180deg,rgba(247,244,255,.96),rgba(255,255,255,.96)) !important;
      border:1px solid rgba(228,222,255,.82) !important;
      font-size:0 !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9) !important;
    }
    #capvoOnboardingOverlay .premium-mini-icon::before,
    #capvoOnboardingOverlay .premium-mini-icon::after{
      content:'' !important;
      position:absolute !important;
      display:block !important;
    }
    #capvoOnboardingOverlay .premium-mini-icon.calendar::before{
      width:15px;height:14px;border:2px solid rgba(101,71,246,.68);border-radius:4px;top:8px;left:8px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.calendar::after{
      width:15px;height:2px;background:rgba(101,71,246,.58);top:12px;left:8px;border-radius:4px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chart::before{
      width:3px;height:12px;background:rgba(101,71,246,.70);bottom:8px;left:9px;border-radius:4px;
      box-shadow:6px -4px 0 rgba(101,71,246,.52),12px -8px 0 rgba(101,71,246,.36);
    }
    #capvoOnboardingOverlay .premium-mini-icon.target::before{
      width:16px;height:16px;border:2px solid rgba(101,71,246,.60);border-radius:999px;top:7px;left:7px;
      box-shadow:inset 0 0 0 4px rgba(101,71,246,.12);
    }
    #capvoOnboardingOverlay .premium-mini-icon.target::after{
      width:5px;height:5px;background:rgba(101,71,246,.76);border-radius:999px;top:13px;left:13px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chat::before{
      width:16px;height:12px;border:2px solid rgba(101,71,246,.62);border-radius:6px;top:8px;left:7px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chat::after{
      width:6px;height:6px;border-left:2px solid rgba(101,71,246,.62);border-bottom:2px solid rgba(101,71,246,.62);transform:rotate(-22deg);top:17px;left:11px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.voice::before{
      width:8px;height:15px;border:2px solid rgba(101,71,246,.62);border-radius:999px;top:6px;left:11px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.voice::after{
      width:16px;height:10px;border-bottom:2px solid rgba(101,71,246,.62);border-radius:0 0 999px 999px;top:13px;left:7px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.sync::before{
      width:16px;height:16px;border:2px solid rgba(101,71,246,.62);border-left-color:transparent;border-bottom-color:transparent;border-radius:999px;top:7px;left:7px;transform:rotate(35deg);
    }
    #capvoOnboardingOverlay .premium-mini-icon.sync::after{
      width:0;height:0;border-left:5px solid rgba(101,71,246,.62);border-top:4px solid transparent;border-bottom:4px solid transparent;top:7px;right:7px;transform:rotate(35deg);
    }

    #capvoOnboardingOverlay .ob-pro-pill{
      transition:border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease !important;
    }
    #capvoOnboardingOverlay .ob-pro-pill:active{
      transform:scale(.985) !important;
    }
    #capvoOnboardingOverlay .ob-pro-pill.selected{
      background:linear-gradient(180deg,#fbf9ff,#ffffff) !important;
      border-color:rgba(101,71,246,.48) !important;
      box-shadow:
        0 12px 26px rgba(101,71,246,.08),
        inset 0 1px 0 rgba(255,255,255,.9) !important;
    }

    #capvoOnboardingOverlay .ob-pro-budget-box{
      background:
        radial-gradient(circle at 50% 0%,rgba(101,71,246,.055),transparent 42%),
        #fff !important;
    }

    #capvoOnboardingOverlay .ob-pro-telegram-orb{
      position:relative !important;
      width:86px !important;
      height:86px !important;
      border-radius:999px !important;
      background:
        radial-gradient(circle at 36% 26%,rgba(255,255,255,.95),transparent 28%),
        linear-gradient(135deg,rgba(101,71,246,.14),rgba(79,70,229,.055)) !important;
      box-shadow:
        0 18px 42px rgba(101,71,246,.13),
        inset 0 1px 0 rgba(255,255,255,.95) !important;
      display:block !important;
      font-size:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-telegram-orb::before{
      content:'' !important;
      position:absolute !important;
      left:27px !important;
      top:30px !important;
      width:34px !important;
      height:24px !important;
      background:linear-gradient(135deg,#6547f6,#7c3aed) !important;
      clip-path:polygon(0 48%,100% 0,74% 100%,47% 66%,29% 83%) !important;
      filter:drop-shadow(0 8px 16px rgba(101,71,246,.22)) !important;
    }

    #capvoOnboardingOverlay .ob-pro-footnote{
      color:#a0a8b8 !important;
      letter-spacing:-.01em !important;
    }
    #capvoOnboardingOverlay .ob-pro-actions .ob-pro-primary{
      box-shadow:
        0 16px 30px rgba(101,71,246,.26),
        inset 0 1px 0 rgba(255,255,255,.22) !important;
    }

    #capvoOnboardingOverlay .ob-pro-day-input-wrap{
      display:grid !important;
      gap:8px !important;
      transition:opacity .16s ease, filter .16s ease !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input{
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto !important;
      align-items:center !important;
      gap:10px !important;
      min-height:54px !important;
      border:1px solid #e7e8f0 !important;
      border-radius:18px !important;
      background:#fff !important;
      padding:0 14px !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9) !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input input{
      width:100% !important;
      height:52px !important;
      border:0 !important;
      outline:0 !important;
      background:transparent !important;
      color:#111827 !important;
      font-size:26px !important;
      line-height:1 !important;
      font-weight:950 !important;
      letter-spacing:-.04em !important;
      padding:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input span{
      color:#8a94a6 !important;
      font-size:13px !important;
      font-weight:850 !important;
      white-space:nowrap !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled{
      opacity:.52 !important;
      filter:grayscale(.08) !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled .ob-pro-day-input{
      background:#f6f7fb !important;
      border-style:dashed !important;
      box-shadow:none !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled .ob-pro-day-input input{
      color:#98a2b3 !important;
      cursor:not-allowed !important;
    }

  `;
  document.head.appendChild(style);
}


function renderCapvoOnboardingWizard(){
  capvoEnsureOnboardingProStyles();
  capvoEnsureOnboardingPremiumStyles();
  const overlay=capvoEnsureOnboardingOverlay();
  const s=window.__capvoOnboarding||capvoWizardDefaultState();
  overlay.innerHTML=capvoOnboardingStepHtml(s);
  overlay.classList.add('active');
  document.body.classList.add('modal-open','onboarding-open');

  if(s && Number.isFinite(Number(s.step))){
    setTimeout(()=>capvoPersistOnboardingStep(s.step),0);
  }

  const fixed=document.getElementById('obCycleTypeFixed');
  const last=document.getElementById('obCycleTypeLast');
  const day=document.getElementById('obCycleDay');
  const dayWrap=day?.closest?.('.ob-pro-day-input-wrap');
  const note=dayWrap?.querySelector?.('.ob-pro-inline-note');
  const syncDay=()=>{
    const isLast=!!last?.checked;
    if(day)day.disabled=isLast;
    dayWrap?.classList.toggle('is-disabled',isLast);
    if(note){
      note.textContent=isLast
        ? 'Δεν χρειάζεται ημέρα. Το CAPVO θα βρίσκει αυτόματα την τελευταία εργάσιμη.'
        : 'Γράψε οποιαδήποτε ημέρα από 1 έως 31, π.χ. 8 ή 28.';
    }
    const fixedCard=fixed?.closest?.('.ob-pro-pill, .ob-pill-choice');
    const lastCard=last?.closest?.('.ob-pro-pill, .ob-pill-choice');
    fixedCard?.classList.toggle('selected',!!fixed?.checked);
    lastCard?.classList.toggle('selected',!!last?.checked);
  };
  document.querySelectorAll('#capvoOnboardingOverlay [data-cycle-type]').forEach(card=>{
    card.addEventListener('click',()=>{
      const type=card.dataset.cycleType;
      if(type==='last_working_day' && last){
        last.checked=true;
      }else if(fixed){
        fixed.checked=true;
      }
      syncDay();
    });
  });
  day?.addEventListener('input',()=>{
    const v=Math.max(1,Math.min(31,Number(day.value)||1));
    if(String(day.value)!==String(v))day.value=String(v);
  });
  fixed?.addEventListener('change',syncDay);
  last?.addEventListener('change',syncDay);
  syncDay();
}

function capvoOnboardingPrev(){
  const s=capvoOnboardingUpdateFromInputs();
  s.step=Math.max(0,(s.step||0)-1);
  renderCapvoOnboardingWizard();
}

function capvoOnboardingNext(){
  const s=capvoOnboardingUpdateFromInputs();

  if(s.step===2){
    const amount=Number(String(s.salaryAmount||'').replace(',','.'))||0;
    if(amount<=0){
      showMiniToast('Βάλε βασικό budget για να συνεχίσεις.','error');
      document.getElementById('obSalaryAmount')?.focus();
      return;
    }
  }

  s.step=Math.min(6,(s.step||0)+1);
  renderCapvoOnboardingWizard();
}

async function capvoUpsertUserPreferencePatch(patch){
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
  if(!ownerUserId)throw new Error('Missing user');
  const payload={
    user_id:ownerUserId,
    currency:D.preferences?.currency||'EUR',
    language:D.preferences?.language||'el',
    budget_cycle_type:D.preferences?.budgetCycleType||'fixed_day',
    budget_cycle_start_day:D.preferences?.budgetCycleStartDay||1,
    ...patch,
    updated_at:new Date().toISOString()
  };
  const {error}=await supabaseClient.from('user_preferences').upsert(payload,{onConflict:'user_id'});
  if(error)throw error;
  D.preferences={...(D.preferences||{}),...{
    onboardingCompleted: payload.onboarding_completed !== undefined ? !!payload.onboarding_completed : !!D.preferences?.onboardingCompleted,
    onboardingDismissed: payload.onboarding_dismissed !== undefined ? !!payload.onboarding_dismissed : !!D.preferences?.onboardingDismissed,
    onboardingStep: payload.onboarding_step !== undefined ? (payload.onboarding_step||'') : (D.preferences?.onboardingStep||''),
    budgetCycleType:normalizeBudgetCycleType(payload.budget_cycle_type),
    budgetCycleStartDay:capvoClampCycleDay(payload.budget_cycle_start_day||1)
  }};
}

async function skipCapvoOnboarding(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  const btn=overlay?.querySelector('.ob-skip-top, .capvo-onboarding-top button');
  try{
    const s=capvoOnboardingUpdateFromInputs();
    if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
    await capvoUpsertUserPreferencePatch({
      onboarding_dismissed:true,
      onboarding_step:String(Math.max(0,Math.min(3,Number(s.step)||0)))
    });
    closeCapvoOnboardingWizard();
    requestAnimationFrame(()=>{
      try{updateCapvoDashboardSetupPrompt();}catch(e){console.warn('[CAPVO] setup prompt update skipped',e);}
    });
    showMiniToast('Μπορείς να συνεχίσεις τη ρύθμιση από το Dashboard.');
  }catch(e){
    console.error('skip onboarding failed',e);
    if(btn){btn.disabled=false;btn.textContent='Παράλειψη';}
    showMiniToast('Δεν αποθηκεύτηκε η παράλειψη.','error');
  }
}

async function finishCapvoOnboarding(openTelegramAfter=false){
  const s=capvoOnboardingUpdateFromInputs();
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();

  if(!ownerUserId){
    showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');
    return;
  }

  const salaryAmount=Number(String(s.salaryAmount||'').replace(',','.'))||0;
  if(salaryAmount<=0){
    s.step=1;
    renderCapvoOnboardingWizard();
    showMiniToast('Βάλε βασικό budget για να ολοκληρώσεις.','error');
    return;
  }

  const btn=document.querySelector('#capvoOnboardingOverlay .ob-primary');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    await capvoUpsertUserPreferencePatch({
      budget_cycle_type:s.cycleType||'fixed_day',
      budget_cycle_start_day:capvoClampCycleDay(s.cycleDay||1),
      onboarding_completed:true,
      onboarding_completed_at:new Date().toISOString(),
      onboarding_dismissed:false,
      onboarding_step:'completed'
    });

    const salaryObj={
      id:gid(),
      name:s.salaryName||'Μισθός',
      amount:salaryAmount,
      category:'Μισθός',
      incomeType:'bank',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      restriction:'none',
      restrictedCategory:'',
      notes:'Δημιουργήθηκε από το onboarding',
      isPrimaryIncome:true
    };

    await supabaseClient.from('income_sources').update({is_primary_income:false}).eq('user_id',ownerUserId);
    await saveIncomeSourceRow(ownerUserId,salaryObj);

    const ticketAmount=Number(String(s.ticketAmount||'').replace(',','.'))||0;
    if(ticketAmount>0){
      await saveIncomeSourceRow(ownerUserId,{
        id:gid(),
        name:'Ticket Restaurant',
        amount:ticketAmount,
        category:'Ticket Restaurant',
        incomeType:'voucher',
        includeInBudget:false,
        isSavings:false,
        isRecurring:true,
        restriction:'food_only',
        restrictedCategory:'Τρόφιμα',
        notes:'Δημιουργήθηκε από το onboarding',
        isPrimaryIncome:false
      });
    }

    const voucherAmount=Number(String(s.voucherAmount||'').replace(',','.'))||0;
    if(voucherAmount>0){
      await saveIncomeSourceRow(ownerUserId,{
        id:gid(),
        name:'Voucher',
        amount:voucherAmount,
        category:'Άυλη κάρτα',
        incomeType:'voucher',
        includeInBudget:false,
        isSavings:false,
        isRecurring:true,
        restriction:'card_only',
        restrictedCategory:'',
        notes:'Δημιουργήθηκε από το onboarding',
        isPrimaryIncome:false
      });
    }

    for(const row of (s.fixed||[])){
      const amount=Number(String(row.amount||'').replace(',','.'))||0;
      if(amount>0 && row.name){
        const legacyOwner=String((typeof getLegacyOwnerId==='function' ? getLegacyOwnerId() : '') || ownerUserId).trim();
        await supabaseClient.from('fixed_expenses').insert({
          id:gid(),
          user_id:ownerUserId,
          user_chat_id:legacyOwner,
          name:row.name,
          amount,
          category:row.category||'Πάγια'
        });
      }
    }

    let general=typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null;
    if(!general && typeof ensureDefaultGeneralSavingsGoal==='function'){
      general=await ensureDefaultGeneralSavingsGoal();
    }
    if(general){
      await supabaseClient.from('savings_goals').update({
        name:s.savingsName||'Γενική αποταμίευση',
        icon:s.savingsIcon||'💰',
        target_amount:0,
        target_date:null,
        goal_type:'general',
        is_default:true,
        is_archived:false,
        status:'active',
        updated_at:new Date().toISOString()
      }).eq('user_id',ownerUserId).eq('id',general.id);
    }

    closeCapvoOnboardingWizard();
    await fetchAllData(ownerUserId);
    curM=curMK();
    ensM(curM);
    render();
    go('vDash',document.querySelector('[data-v="vDash"]'));
    showMiniToast('✅ Το CAPVO είναι έτοιμο');

    if(openTelegramAfter){
      setTimeout(()=>switchChatId?.(),450);
    }

  }catch(e){
    console.error('finish onboarding failed',e);
    showMiniToast('Δεν ολοκληρώθηκε η ρύθμιση. Έλεγξε το SQL του v1.1.7.','error');
    if(btn){btn.disabled=false;btn.textContent='Ολοκλήρωση';}
  }
}


/* ============================================================
   CAPVO v1.1.7.5 - Onboarding setup prompt after skip
   ============================================================ */
function capvoShouldShowSetupPrompt(){
  const prefs=D.preferences||{};
  return !prefs.onboardingCompleted && !!prefs.onboardingDismissed && !capvoHasBasicSetup();
}

function openCapvoSetupFromDashboard(){
  const prefs=D.preferences||{};
  window.__capvoOnboarding=capvoWizardDefaultState();
  const savedStep=Number(prefs.onboardingStep);
  const resumeStep=Number.isFinite(savedStep)?Math.max(0,Math.min(3,savedStep)):0;
  window.__capvoOnboarding.step=resumeStep;
  openCapvoOnboardingWizard(resumeStep);
}

function capvoEnsureDashboardSetupPrompt(){
  const dashMain=document.querySelector('#vDash .modern-dashboard-main');
  if(!dashMain)return null;
  let card=document.getElementById('capvoDashboardSetupPrompt');
  if(card)return card;
  const anchor=document.getElementById('dashboardCycleSummaryCard') || dashMain.firstElementChild;
  card=document.createElement('section');
  card.id='capvoDashboardSetupPrompt';
  card.className='capvo-dashboard-setup-prompt';
  card.innerHTML=`
    <div class="capvo-setup-icon" aria-hidden="true">↻</div>
    <div class="capvo-setup-content">
      <span>Ρύθμιση CAPVO</span>
      <strong>Δεν έχεις ορίσει ακόμα βασικό budget.</strong>
      <p>Βάλε μισθό ή budget για να δεις πόσα μπορείς να ξοδέψεις μέχρι την επόμενη πληρωμή.</p>
    </div>
    <button type="button" onclick="openCapvoSetupFromDashboard()">Συνέχεια ρύθμισης</button>
  `;
  if(anchor && anchor.parentNode){
    anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }else{
    dashMain.prepend(card);
  }
  return card;
}

function capvoRestoreSetupDuplicateCtas(){
  document.querySelectorAll('[data-capvo-setup-dedupe-hidden="1"]').forEach(el=>{
    el.style.display=el.dataset.capvoPrevDisplay||'';
    delete el.dataset.capvoSetupDedupeHidden;
    delete el.dataset.capvoPrevDisplay;
  });
  document.querySelectorAll('[data-capvo-setup-dedupe-soft="1"]').forEach(el=>{
    el.style.visibility=el.dataset.capvoPrevVisibility||'';
    el.style.pointerEvents=el.dataset.capvoPrevPointerEvents||'';
    delete el.dataset.capvoSetupDedupeSoft;
    delete el.dataset.capvoPrevVisibility;
    delete el.dataset.capvoPrevPointerEvents;
  });
}

function capvoHideSetupElement(el){
  if(!el || el.id==='capvoDashboardSetupPrompt' || el.closest?.('#capvoDashboardSetupPrompt'))return;
  if(el.dataset.capvoSetupDedupeHidden==='1')return;
  el.dataset.capvoPrevDisplay=el.style.display||'';
  el.dataset.capvoSetupDedupeHidden='1';
  el.style.display='none';
}

function capvoNodeText(el){
  return (el?.textContent||'').replace(/\s+/g,' ').trim();
}

function capvoFindCardByText(textNeedles){
  const dash=document.querySelector('#vDash');
  if(!dash)return null;

  const nodes=Array.from(dash.querySelectorAll('section,article,div'));
  let best=null;

  for(const node of nodes){
    if(node.id==='capvoDashboardSetupPrompt' || node.closest?.('#capvoDashboardSetupPrompt'))continue;
    const txt=capvoNodeText(node);
    if(!txt)continue;

    const ok=textNeedles.every(n=>txt.includes(n));
    if(!ok)continue;

    // Prefer a medium-size card/container, not the whole dashboard.
    if(txt.length>650)continue;

    const rect=node.getBoundingClientRect?.();
    if(rect && rect.height>0 && rect.width>0){
      if(!best || txt.length < capvoNodeText(best).length) best=node;
    }
  }

  return best;
}

function capvoHideButtonByText(text){
  const dash=document.querySelector('#vDash');
  if(!dash)return;
  Array.from(dash.querySelectorAll('button,a')).forEach(el=>{
    if(el.closest?.('#capvoDashboardSetupPrompt'))return;
    if(capvoNodeText(el)===text)capvoHideSetupElement(el);
  });
}

function capvoApplySetupPromptDedupe(show){
  const dash=document.querySelector('#vDash');
  if(!dash)return;

  document.body.classList.toggle('capvo-setup-required',!!show);
  capvoRestoreSetupDuplicateCtas();

  if(!show)return;

  // 1) Hide compact top budget nudge:
  // "Ξεκίνα με budget / Προσθήκη budget / Αργότερα"
  const budgetNudge=capvoFindCardByText(['Ξεκίνα με budget','Προσθήκη budget']);
  if(budgetNudge)capvoHideSetupElement(budgetNudge);

  // Fallback for small row if text wrapping/structure changes.
  const fallbackNudge=capvoFindCardByText(['Ξεκίνα με budget','Αργότερα']);
  if(fallbackNudge)capvoHideSetupElement(fallbackNudge);

  // 2) Hide budget CTA inside cycle summary card, but keep the cycle card itself.
  capvoHideButtonByText('Ορισμός budget');
  capvoHideButtonByText('Προσθήκη budget');

  // 3) Run a delayed pass because parts of dashboard are rendered async.
  if(!window.__capvoSetupDedupeDelayed){
    window.__capvoSetupDedupeDelayed=true;
    setTimeout(()=>{
      window.__capvoSetupDedupeDelayed=false;
      try{capvoApplySetupPromptDedupe(capvoShouldShowSetupPrompt());}catch(e){}
    },180);
  }
}

(function capvoSetupPromptMutationObserver(){
  if(window.__capvoSetupPromptMutationObserver)return;
  window.__capvoSetupPromptMutationObserver=true;

  document.addEventListener('DOMContentLoaded',()=>{
    const dash=document.querySelector('#vDash');
    if(!dash)return;
    let t=null;
    const obs=new MutationObserver(()=>{
      if(!capvoShouldShowSetupPrompt())return;
      clearTimeout(t);
      t=setTimeout(()=>{
        try{capvoApplySetupPromptDedupe(true);}catch(e){}
      },80);
    });
    obs.observe(dash,{childList:true,subtree:true});
  },{once:true});
})();

function updateCapvoDashboardSetupPrompt(){
  const card=capvoEnsureDashboardSetupPrompt();
  if(!card)return;
  const show=capvoShouldShowSetupPrompt();
  card.style.display=show?'grid':'none';
  try{capvoApplySetupPromptDedupe(show);}catch(e){console.warn('[CAPVO] setup prompt dedupe skipped',e);}
}

(function patchCapvoRenderForSetupPrompt(){
  if(window.__capvoSetupPromptRenderPatched)return;
  window.__capvoSetupPromptRenderPatched=true;
  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){
      const result=originalRender.apply(this,arguments);
      try{updateCapvoDashboardSetupPrompt();}catch(e){console.warn('[CAPVO] setup prompt render skipped',e);}
      return result;
    };
  }
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{try{updateCapvoDashboardSetupPrompt();}catch(e){}},250);
  },{once:true});
})();
