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

    $('fDN').focus();
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
    $('fFN').focus();
  }

  if(t==='cc'){
    $('mCC').classList.add('active');
    $('mCCTitle').textContent='Νέα κάρτα';
    $('fCCN').value='';
    $('fCCB').value='';
    $('fCCR').value='';
    $('fCCM').value='';
    $('fCCL').value='';
    $('fCCID').value='';
    $('btnCC').textContent='Αποθήκευση';
    $('fCCN').focus();
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
    $('fISNotes').value='';
    $('fISID').value='';
    $('btnIncomeSource').textContent='Αποθήκευση budget';
    if(typeof clearIncomeValidation==='function')clearIncomeValidation();
    document.querySelectorAll('#incomeQuickPresets button').forEach(btn=>btn.classList.remove('active'));

    refreshIncomeCustomPickers();
    $('fISAmount').focus();
  }
}

function editExp(t,id){
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
    $('fFN').focus();

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
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));

  const target=$(v);
  if(target)target.classList.add('active');

  const mobileMoreViews=new Set(['vCards','vAdvisor','vStats','vArchive','vSettings']);
  const activeNavView=mobileMoreViews.has(v) ? 'vMore' : v;

  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll(`.nav-btn[data-v="${activeNavView}"]`).forEach(el=>el.classList.add('active'));

  if(b && b.classList && b.classList.contains('nav-btn')){
    b.classList.add('active');
  }
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
  if(telegramBox)telegramBox.style.display='block';

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

async function loadUserData(userId){const ownerId=userId||getDataOwnerId();await fetchAllData(ownerId);curM=curMK();ensM(curM);render();go('vDash',document.querySelector('[data-v="vDash"]'));hideAuth()}

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
