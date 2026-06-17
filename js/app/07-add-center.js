// CAPVO app split: 07-add-center.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== ADD CENTER V1 — Quick / Αναλυτικό tabs =====
function addCenterToday(){
  return typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
}

function fillAddCenterPaymentSources(selectedId='',opts={}){
  const el=document.getElementById('acDPay');
  if(!el)return;

  const sources=(typeof availablePaymentSources==='function')
    ? availablePaymentSources()
    : [];
  const hasWalletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  const defaultWalletId=hasWalletModel && !selectedId && !opts.preserveBlank
    ? (typeof capvoDefaultWallet==='function'?capvoDefaultWallet()?.id:'')
    : '';
  const effectiveSelected=selectedId || defaultWalletId || '';

  el.innerHTML=`
    ${hasWalletModel?'':`<option value="" ${!effectiveSelected?'selected':''}>Κανονικό budget</option>`}
    ${sources.map(s=>{
      const isWallet=typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(s);
      const isCard=s.type==='credit_card' || s.accountType==='credit_card';
      const balance=isWallet ? ` · ${fmt(Number(s.currentBalance)||0)}` : '';
      // Keep the native option text clean. The custom picker renders the icon separately,
      // so including it here creates duplicate icons in the visible mobile UI.
      return `<option value="${esc(s.id)}" ${String(s.id)===String(effectiveSelected)?'selected':''}>${esc(s.name)}${balance}</option>`;
    }).join('')}
  `;

  if(effectiveSelected){
    el.value=effectiveSelected;
  }

  renderAddCenterPaymentPicker();
  syncAddCenterPaymentPicker();
}

function paymentSourceLabelById(id){
  if(!id)return (typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel())?'Επίλεξε wallet':'Κανονικό budget';

  const source=(typeof paymentSourceById==='function')
    ? paymentSourceById(id)
    : (D.incomeSources||[]).find(s=>s.id===id);

  if(source && typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source)){
    const bal=Number(source.currentBalance)||0;
    return `${source.name||'Wallet'} · ${typeof fmt==='function'?fmt(bal):bal+'€'}`;
  }
  return source?.name || 'Πηγή πληρωμής';
}

function paymentSourceIconById(id){
  if(!id)return '💶';

  const source=(typeof paymentSourceById==='function')
    ? paymentSourceById(id)
    : (D.incomeSources||[]).find(s=>s.id===id);

  if(typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source))return '💳';
  if(typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source))return source?.icon||'🏦';
  if(source?.restriction && source.restriction!=='none')return '🎫';
  if(source?.isSavings)return '🏦';
  if(source?.incomeType==='card')return '💳';
  return '💰';
}

function closeAddCenterPaymentPicker(){
  const list=document.getElementById('acDPayCustomList');
  const btn=document.getElementById('acDPayCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}

function renderAddCenterPaymentPicker(){
  const list=document.getElementById('acDPayCustomList');
  const select=document.getElementById('acDPay');
  if(!list || !select)return;

  const options=[...select.options].map(option=>({
    id:option.value,
    label:option.textContent || 'Πηγή πληρωμής'
  }));

  list.innerHTML=options.map(option=>`
    <button type="button" data-payment-id="${esc(option.id)}" onclick="selectAddCenterPaymentSource('${esc(option.id)}')">
      <span>${paymentSourceIconById(option.id)}</span>
      <strong>${esc(option.label)}</strong>
    </button>
  `).join('');
}

function syncAddCenterPaymentPicker(){
  const select=document.getElementById('acDPay');
  const text=document.getElementById('acDPayCustomText');
  const icon=document.getElementById('acDPayCustomIcon');
  const list=document.getElementById('acDPayCustomList');
  if(!select)return;

  const value=select.value || '';
  if(text)text.textContent=paymentSourceLabelById(value);
  if(icon)icon.textContent=paymentSourceIconById(value);

  list?.querySelectorAll('button').forEach(btn=>{
    btn.classList.toggle('active',(btn.dataset.paymentId||'')===value);
  });
}

function toggleAddCenterPaymentPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();

  closeAddCenterCategoryPicker();

  const list=document.getElementById('acDPayCustomList');
  const btn=document.getElementById('acDPayCustom');
  if(!list || !btn)return;

  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}

function selectAddCenterPaymentSource(id=''){
  const select=document.getElementById('acDPay');
  if(!select)return;

  select.value=id;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  syncAddCenterPaymentPicker();
  closeAddCenterPaymentPicker();
  clearQuickAddInlineError('addCenterManualError');
}

function addCenterCategoryEmoji(category){
  if(typeof CEMO!=='undefined' && CEMO[category])return CEMO[category];

  return {
    'Τρόφιμα':'🛒',
    'Καφέδες':'☕',
    'Μεταφορά':'🚗',
    'Ψυχαγωγία':'🎭',
    'Φαγητό έξω':'🍕',
    'Λογαριασμοί':'💡',
    'Υγεία':'🏥',
    'Ρούχα':'👕',
    'Δάνεια':'🏦',
    'Συνδρομές':'📱',
    'Άλλο':'📌'
  }[category] || '📌';
}

function closeAddCenterCategoryPicker(){
  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}

function syncAddCenterCategoryPicker(){
  const select=document.getElementById('acDC');
  const text=document.getElementById('acDCCustomText');
  const icon=document.getElementById('acDCCustomIcon');
  const list=document.getElementById('acDCCustomList');
  if(!select)return;

  const value=select.value || 'Τρόφιμα';
  if(text)text.textContent=value;
  if(icon)icon.textContent=addCenterCategoryEmoji(value);

  list?.querySelectorAll('button').forEach(btn=>{
    const isActive=(btn.textContent || '').includes(value);
    btn.classList.toggle('active',isActive);
  });
}

function toggleAddCenterCategoryPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();

  closeAddCenterPaymentPicker();

  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  if(!list || !btn)return;

  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}

function selectAddCenterCategory(category){
  const select=document.getElementById('acDC');
  if(!select)return;

  select.value=category;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  syncAddCenterCategoryPicker();
  closeAddCenterCategoryPicker();
  clearQuickAddInlineError('addCenterManualError');
}

function resetAddCenterManualForm(){
  const name=document.getElementById('acDN');
  const amount=document.getElementById('acDA');
  const cat=document.getElementById('acDC');
  const date=document.getElementById('acDD');
  const notes=document.getElementById('acDNotes');

  if(name)name.value='';
  if(amount)amount.value='';
  if(cat)cat.value='Τρόφιμα';
  syncAddCenterCategoryPicker();
  closeAddCenterCategoryPicker();
  closeAddCenterPaymentPicker();
  if(date)date.value=addCenterToday();
  if(notes)notes.value='';

  fillAddCenterPaymentSources('');
  clearQuickAddInlineError('addCenterManualError');
}

function switchAddCenterTab(tab='quick'){
  capvoSuppressAutoFocus?.(600);
  const quickTab=document.getElementById('addCenterQuickTab');
  const manualTab=document.getElementById('addCenterManualTab');
  const quickPanel=document.getElementById('addCenterQuickPanel');
  const manualPanel=document.getElementById('addCenterManualPanel');
  const isManual=tab==='manual';

  quickTab?.classList.toggle('active',!isManual);
  manualTab?.classList.toggle('active',isManual);
  quickPanel?.classList.toggle('active',!isManual);
  manualPanel?.classList.toggle('active',isManual);

  quickTab?.setAttribute('aria-selected',String(!isManual));
  manualTab?.setAttribute('aria-selected',String(isManual));

  setTimeout(()=>{
    // autofocus disabled: user taps the field when ready;
  },80);
}

function renderAddCenterRecentChips(){
  const el=document.getElementById('addCenterRecentChips');
  if(!el || typeof D==='undefined' || typeof curM==='undefined')return;

  const daily=(D.months?.[curM]?.daily || [])
    .slice()
    .sort((a,b)=>String(b.id||'').localeCompare(String(a.id||'')))
    .slice(0,3);

  if(daily.length===0){
    el.innerHTML='<span class="add-center-empty-chip">Δεν υπάρχουν πρόσφατα</span>';
    return;
  }

  el.innerHTML=daily.map(e=>{
    const amountText=String(Number(e.amount)||0).replace('.',',');
    const text=`${e.name} ${amountText}`;
    return `<button type="button" onclick="fillQuickAddSheet('${esc(text)}')">+ ${esc(e.name)} ${fmt(e.amount)}</button>`;
  }).join('');
}

function openAddCenterSheet(tab='quick',prefill='',errorMessage=''){
  capvoSuppressAutoFocus?.(900);
  const sheet=document.getElementById('addCenterSheet') || document.getElementById('quickAddSheet');
  const input=document.getElementById('quickAddSheetInput');
  if(!sheet)return;

  sheet.classList.add('active');
  document.body.classList.add('quick-sheet-open','add-center-open');

  resetAddCenterManualForm();
  renderAddCenterRecentChips();
  switchAddCenterTab(tab==='manual'?'manual':'quick');

  if(input && typeof prefill==='string' && prefill.trim()){
    input.value=prefill.trim();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  clearQuickAddInlineError('quickAddSheetError');

  if(errorMessage){
    setQuickAddInlineError(errorMessage,'quickAddSheetError');
  }

  setTimeout(()=>{
    // autofocus disabled: user taps the field when ready;
  },140);
}

function closeAddCenterSheet(event){
  if(event && event.target && event.target.id!=='addCenterSheet')return;

  const sheet=document.getElementById('addCenterSheet');
  sheet?.classList.remove('active');
  closeAddCenterCategoryPicker();
  closeAddCenterPaymentPicker();
  document.body.classList.remove('quick-sheet-open','add-center-open');
}

// Backwards compatibility: old calls still open the new Add Center on Quick tab.
function openQuickAddSheet(prefill='',errorMessage=''){
  openAddCenterSheet('quick',prefill,errorMessage);
}

function closeQuickAddSheet(event){
  closeAddCenterSheet(event);
}

// saveAddCenterManualExpense v1 removed — superseded by v3 below (Add Center V4 section).
// v3 adds: edit mode, makeCreditCardExpensePayload, proper error recovery via fetchAllData.

function setupAddCenterState(){
  syncAddCenterCategoryPicker();

  const manualFields=['acDN','acDA','acDC','acDPay','acDD','acDNotes'];
  manualFields.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',()=>clearQuickAddInlineError('addCenterManualError'));
    el.addEventListener('change',()=>clearQuickAddInlineError('addCenterManualError'));
  });

  document.addEventListener('click',e=>{
    const list=document.getElementById('acDCCustomList');
    const btn=document.getElementById('acDCCustom');
    if(!list?.classList.contains('active'))return;
    if(list.contains(e.target) || btn?.contains(e.target))return;
    closeAddCenterCategoryPicker();
    closeAddCenterPaymentPicker();
  });

  document.addEventListener('keydown',e=>{
    const sheet=document.getElementById('addCenterSheet');
    if(e.key==='Escape' && sheet?.classList.contains('active')){
      closeAddCenterSheet();
    }
  });
}

document.addEventListener('DOMContentLoaded', setupAddCenterState);


// Compatibility helpers: any page-level add button should open the shared Add Center.
function openAddCenter(tab='quick', prefill='', errorMessage=''){
  return openAddCenterSheet(tab, prefill, errorMessage);
}

function openDailyAddCenter(){
  return openAddCenterSheet('manual');
}


/* ============================================================
   TRANSACTIONS COMPLETE V3 — mobile management layer
   - Details sheet actions
   - Edit through shared Add Center
   - Duplicate prefill
   - Premium delete confirmation
   - Better mobile date grouping
   ============================================================ */

let txCompleteDetailState = null;
let addCenterEditState = null;

function txCompleteTodayISO(){
  return typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
}

function txCompleteDateLabel(dateStr){
  if(!dateStr)return 'Χωρίς ημερομηνία';
  const d=new Date(dateStr+'T12:00:00');
  const today=txCompleteTodayISO();
  const y=new Date();
  y.setDate(y.getDate()-1);
  const yesterday=typeof capvoLocalDateKey==='function'?capvoLocalDateKey(y):y.toLocaleDateString('en-CA');

  if(dateStr===today)return 'Σήμερα';
  if(dateStr===yesterday)return 'Χθες';

  return d.toLocaleDateString('el-GR',{
    weekday:'long',
    day:'2-digit',
    month:'long'
  });
}

function txCompleteLongDate(dateStr){
  if(!dateStr)return '-';
  return new Date(dateStr+'T12:00:00').toLocaleDateString('el-GR',{
    weekday:'long',
    day:'2-digit',
    month:'long',
    year:'numeric'
  });
}

function txCompleteFindDailyById(id){
  let found=null;
  Object.values(D.months||{}).forEach(m=>{
    const x=(m.daily||[]).find(e=>e.id===id);
    if(x)found=x;
  });
  return found;
}

function txCompleteFindMovementById(id){
  if(typeof getCurrentCycleAllMovements!=='function')return null;
  return (getCurrentCycleAllMovements()||[]).find(e=>String(e.id)===String(id))||null;
}

function txCompleteFindByTypeAndId(type,id){
  if(type==='fixed')return (D.fixedExpenses||[]).find(e=>e.id===id)||null;
  if(type==='movement')return txCompleteFindMovementById(id);
  return txCompleteFindDailyById(id);
}

function txCompletePaymentText(e,type){
  if(type==='fixed')return 'Σταθερό έξοδο';
  if(e?.sourceLabel)return e.sourceLabel;
  if(e?.isCardPayment || e?.paymentAccountType==='credit_card_payment')return 'Πληρωμή κάρτας · Επηρεάζει budget';
  if(e?.isCreditCardPurchase || e?.paymentAccountType==='credit_card')return 'Αγορά με πιστωτική · Δεν επηρεάζει budget';
  if(e?.isSavingsMovement)return e?.isSavingsTransfer?'Εσωτερική μεταφορά κουμπαρά':'Κουμπαράς';
  if(e?.paymentSourceName)return e.paymentSourceName;
  return 'Budget / Μετρητά';
}

function txCompleteFormatMovementAmount(e,type){
  const amount=Number(e?.amount)||0;
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(e?.affectsBudget===false?0:amount);
  const affects=!!(e?.affectsBudget ?? e?.affectsCashBudget ?? e?.affects_cash_budget);
  if(!affects)return fmt(Math.abs(amount));
  if(impact<0)return '+'+fmt(Math.abs(impact));
  return '-'+fmt(Math.abs(impact));
}

function txCompleteMovementTypeLabel(e,type){
  if(type==='fixed')return 'Πάγιο έξοδο';
  const mt=String(e?.movementType||'');
  if(mt==='card_payment')return 'Πληρωμή κάρτας';
  if(mt==='credit_card_purchase')return 'Αγορά με πιστωτική';
  if(mt==='savings_deposit')return 'Αποταμίευση';
  if(mt==='savings_withdrawal')return 'Επιστροφή από κουμπαρά';
  if(mt==='savings_transfer_in' || mt==='savings_transfer_out')return 'Εσωτερική μεταφορά';
  if(mt==='restricted_expense')return 'Κίνηση παροχής';
  return 'Κίνηση budget';
}

function txCompleteFillManualForm(e,{edit=false}={}){
  if(!e)return;

  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const notesEl=document.getElementById('acDNotes');
  const submit=document.getElementById('addCenterManualSubmit');

  if(nameEl)nameEl.value=e.name||'';
  if(amountEl)amountEl.value=Number(e.amount||0);
  if(catEl)catEl.value=e.category||'Άλλο';
  if(payEl)payEl.value=e.walletId||e.paymentSourceId||'';
  if(dateEl)dateEl.value=e.date||addCenterToday();
  if(notesEl)notesEl.value=e.notes||'';

  if(typeof syncAddCenterCategoryPicker==='function')syncAddCenterCategoryPicker();
  if(typeof syncAddCenterPaymentPicker==='function')syncAddCenterPaymentPicker();

  if(submit){
    submit.textContent=edit?'Ενημέρωση εξόδου':'Αποθήκευση εξόδου';
  }
}

function txCompleteOpenManualForEdit(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  closeMobileTransactionDetail();

  if(type==='fixed'){
    // Fixed expenses keep the existing fixed-expense edit modal for now.
    return txCompleteLegacyEditExp ? txCompleteLegacyEditExp(type,id) : undefined;
  }

  addCenterEditState={type,id};
  openAddCenterSheet('manual');

  setTimeout(()=>{
    txCompleteFillManualForm(e,{edit:true});
    // autofocus disabled: user taps the field when ready;
  },80);
}

function txCompleteOpenManualForDuplicate(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  closeMobileTransactionDetail();

  const copy={
    ...e,
    id:'',
    date:txCompleteTodayISO()
  };

  addCenterEditState=null;
  openAddCenterSheet('manual');

  setTimeout(()=>{
    txCompleteFillManualForm(copy,{edit:false});
    showMiniToast('Έτοιμο αντίγραφο για αποθήκευση');
    // autofocus disabled: user taps the field when ready;
  },80);
}

async function txCompleteDeleteWithConfirm(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  const confirmed=await showConfirmModal({
    title:'Διαγραφή κίνησης',
    message:`Θέλεις να διαγράψεις το «${e.name}»;`,
    confirmText:'Διαγραφή',
    cancelText:'Άκυρο'
  });

  if(!confirmed)return;

  closeMobileTransactionDetail();

  try{
    await deleteExpenseRow(type,id);

    if(type==='fixed'){
      D.fixedExpenses=(D.fixedExpenses||[]).filter(x=>x.id!==id);
    }else{
      Object.values(D.months||{}).forEach(m=>{
        m.daily=(m.daily||[]).filter(x=>x.id!==id);
      });
    }

    render();
    showMiniToast('✅ Η κίνηση διαγράφηκε');
  }catch(err){
    console.error('txCompleteDeleteWithConfirm failed:',err);
    showMiniToast('❌ Δεν έγινε διαγραφή','error');
  }
}

function showMobileTransactionDetail(type,id){
  if(window.innerWidth>768){
    return (type==='fixed') ? editExp(type,id) : undefined;
  }

  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  txCompleteDetailState={type,id};

  const overlay=document.getElementById('mobileTransactionDetail');
  const content=document.getElementById('mobileTransactionDetailContent');
  if(!overlay || !content)return;

  const category=e.category||'Άλλο';
  const icon=CEMO[category]||'📌';
  const payText=txCompletePaymentText(e,type);
  const dateLabel=type==='fixed' ? 'Κάθε μήνα' : txCompleteLongDate(e.date);
  const typeLabel=txCompleteMovementTypeLabel(e,type);
  const amountLabel=txCompleteFormatMovementAmount(e,type);
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(e.affectsBudget===false?0:Number(e.amount)||0);
  const affects=!!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
  const noteText=e.notes || e.note || '';
  const canEdit=type!=='movement' && e.canEdit!==false;
  const canDelete=type!=='movement' && e.canDelete!==false;
  const actions=(canEdit||canDelete)?`
    <div class="tx-v25-actions">
      ${canEdit?`<button type="button" class="tx-v25-action primary" onclick="txCompleteOpenManualForEdit('${type}','${id}')"><span>✎</span>Επεξεργασία</button>`:''}
      ${canEdit?`<button type="button" class="tx-v25-action secondary" onclick="txCompleteOpenManualForDuplicate('${type}','${id}')"><span>⧉</span>Αντιγραφή</button>`:''}
      ${canDelete?`<button type="button" class="tx-v25-action danger" onclick="txCompleteDeleteWithConfirm('${type}','${id}')"><span>🗑</span>Διαγραφή</button>`:''}
    </div>`:`
    <div class="tx-v25-readonly-note">
      Αυτή η κίνηση προέρχεται από κάρτα ή κουμπαρά και εμφανίζεται εδώ πληροφοριακά. Η διαχείρισή της γίνεται από την αντίστοιχη ενότητα.
    </div>`;

  content.innerHTML=`
    <div class="tx-v25-detail-hero">
      <button class="tx-v25-close" type="button" onclick="closeMobileTransactionDetail()" aria-label="Κλείσιμο">×</button>
      <div class="tx-v25-icon ${CCLS[category]||'cat-other'}">${icon}</div>
      <div class="tx-v25-kicker">${esc(typeLabel)}</div>
      <h3>${esc(e.name)}</h3>
      <div class="tx-v25-amount ${!affects?'is-neutral':''} ${impact<0?'is-return':''}">${amountLabel}</div>
      <div class="tx-v25-subtitle">${esc(category)} · ${esc(payText)}</div>
    </div>

    <div class="tx-v25-summary">
      <div class="tx-v25-summary-item"><span>Ημερομηνία</span><strong>${esc(dateLabel)}</strong></div>
      <div class="tx-v25-summary-item"><span>Κατηγορία</span><strong>${esc(category)}</strong></div>
      <div class="tx-v25-summary-item"><span>Πηγή</span><strong>${esc(e.paymentSourceName||payText)}</strong></div>
      <div class="tx-v25-summary-item"><span>Budget</span><strong>${affects?(impact<0?'Επιστρέφει budget':'Επηρεάζει budget'):'Δεν επηρεάζει budget'}</strong></div>
    </div>

    ${noteText ? `<div class="tx-v25-note"><span>Σημείωση</span><p>${esc(noteText)}</p></div>` : ''}
    ${actions}
  `;

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}
function closeMobileTransactionDetail(){
  const overlay=document.getElementById('mobileTransactionDetail');
  overlay?.classList.remove('active');
  document.body.classList.remove('sheet-open');
  txCompleteDetailState=null;
}

function txCompleteDailyRow(e){
  const category=e.category||'Άλλο';
  const c=CCLS[category]||'cat-other';
  const em=CEMO[category]||'📌';
  const isSelected=selectedDaily.has(e.sourceId||e.id);
  const showSelect=selectionMode.daily && e.canDelete!==false && e.movementType==='daily_expense';
  const affects=!!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(affects?(Number(e.amount)||0):0);
  const detailType=String(e.movementType||'')==='fixed_expense'
    ? 'fixed'
    : (e.readOnly || e.canEdit===false ? 'movement' : 'daily');
  const detailId=detailType==='movement'?e.id:(e.sourceId||e.id);
  const isCard=String(e.movementGroup||'')==='cards' || e.isCardPayment || e.isCreditCardPurchase || e.paymentAccountType==='credit_card';
  const isSavings=String(e.movementGroup||'')==='savings' || e.isSavingsMovement;
  const amountLabel=!affects
    ? fmt(Math.abs(Number(e.amount)||0))
    : (impact<0 ? '+'+fmt(Math.abs(impact)) : '-'+fmt(Math.abs(impact)));

  const badges=[];
  if(isCard)badges.push(`<span class="payment-badge credit-card">Κάρτα</span>`);
  if(isSavings)badges.push(`<span class="payment-badge savings">Κουμπαράς</span>`);
  if(!affects)badges.push(`<span class="payment-badge no-budget">Δεν επηρεάζει budget</span>`);
  if(affects && impact<0)badges.push(`<span class="payment-badge budget-return">Επιστροφή budget</span>`);

  const metaParts=[category,e.paymentSourceName||'',e.sourceLabel||'']
    .map(x=>String(x||'').trim())
    .filter(Boolean)
    .filter((part,idx,arr)=>arr.findIndex(other=>other.toLowerCase()===part.toLowerCase())===idx);
  const meta=metaParts.map(esc).join(' · ');

  return `
    <div class="expense-item tx-v3-row fadeIn ${isSelected?'selected-row':''}" onclick="${!showSelect?`showMobileTransactionDetail('${detailType}','${detailId}')`:''}">
      ${showSelect?`
        <label class="select-box" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('daily','${e.sourceId||e.id}',this.checked)">
        </label>`:''}
      <div class="expense-icon ${c}">${em}</div>
      <div class="expense-info">
        <div class="expense-name">${esc(e.name)}</div>
        <div class="expense-cat">${meta}${badges.join('')}</div>
      </div>
      <div class="tx-v3-row-right">
        <div class="expense-amount is-daily ${!affects?'is-neutral':''} ${impact<0?'is-return':''}">${amountLabel}</div>
      </div>
    </div>`;
}

function txFormatBudgetImpactTotal(total){
  const value=capvoMoney(Number(total)||0);
  if(value<0)return '+'+fmt(Math.abs(value));
  if(value>0)return '-'+fmt(value);
  return fmt(0);
}

function renderDailyList(){
  const movementRows=typeof getCurrentCycleAllMovements==='function'
    ? getCurrentCycleAllMovements()
    : (typeof getCurrentCycleDailyExpenses==='function' ? getCurrentCycleDailyExpenses() : ((D.months[curM]||{daily:[]}).daily||[]));
  const countEl=$('cDaily');
  const listEl=$('lDaily');
  if(!countEl || !listEl)return;

  countEl.innerHTML=`${movementRows.length} κινήσεις κύκλου`;

  if((movementRows||[]).length===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Δεν έχεις κινήσεις ακόμα. Πάτα το + για νέα καταχώρηση.
      </div>`;
    return;
  }

  const filtered=[...(movementRows||[])]
    .filter(e=>mobileTransactionMatchesSearch(e) && mobileTransactionMatchesFilter(e))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')) || String(b.id||'').localeCompare(String(a.id||'')));

  if(filtered.length===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        Δεν υπάρχουν κινήσεις με αυτά τα φίλτρα.
      </div>`;
    return;
  }

  const grouped={};
  filtered.forEach(e=>{
    const key=e.date||'no-date';
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(e);
  });

  const isMobile=window.innerWidth<=768;
  const visibleLimit=isMobile && !txMobileDailyExpanded ? 8 : filtered.length;
  const visibleItems=filtered.slice(0, visibleLimit);
  const visibleGrouped={};
  visibleItems.forEach(e=>{
    const key=e.date||'no-date';
    if(!visibleGrouped[key])visibleGrouped[key]=[];
    visibleGrouped[key].push(e);
  });

  let html='';
  Object.keys(visibleGrouped).sort().reverse().forEach(dt=>{
    const allForDay=grouped[dt]||[];
    const dayImpact=allForDay.reduce((s,e)=>s+(typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(e.affectsBudget===false?0:Number(e.amount)||0)),0);
    html+=`
      <div class="day-header tx-v3-day-header tx-ledger-day-header">
        <div>
          <span>${txCompleteDateLabel(dt)}</span>
          <small>${allForDay.length} κινήσεις · Επίδραση budget</small>
        </div>
        <span class="day-total ${dayImpact<0?'is-return':''}">${txFormatBudgetImpactTotal(dayImpact)}</span>
      </div>`;
    visibleGrouped[dt].forEach(e=>html+=txCompleteDailyRow(e));
  });

  if(isMobile && filtered.length>visibleLimit){
    html+=`
      <button type="button" class="tx-mobile-more-btn" onclick="toggleTxMobileDailyExpanded()">
        ${txMobileDailyExpanded?'Προβολή λιγότερων':'Προβολή περισσότερων'}
        <span>${txMobileDailyExpanded?'⌃':'⌄'}</span>
      </button>`;
  }

  listEl.innerHTML=html;
}

function toggleTxMobileDailyExpanded(){
  txMobileDailyExpanded=!txMobileDailyExpanded;
  renderDailyList();
}

const txCompleteLegacyEditExp = (typeof window!=='undefined' && typeof window.editExp==='function')
  ? window.editExp.bind(window)
  : null;
window.editExp=function(t,id){
  if(t==='daily' && window.innerWidth<=768){
    return txCompleteOpenManualForEdit(t,id);
  }
  return txCompleteLegacyEditExp ? txCompleteLegacyEditExp(t,id) : undefined;
};

function closeAddCenterSheet(event){
  if(event && event.target && event.target.id!=='addCenterSheet')return;

  addCenterEditState=null;

  const submit=document.getElementById('addCenterManualSubmit');
  if(submit)submit.textContent='Αποθήκευση εξόδου';

  const sheet=document.getElementById('addCenterSheet');
  sheet?.classList.remove('active');

  if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
  if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();

  document.body.classList.remove('quick-sheet-open','add-center-open');
}

async function saveAddCenterManualExpense(){
  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const btn=document.getElementById('addCenterManualSubmit');

  clearQuickAddInlineError('addCenterManualError');

  const name=(nameEl?.value||'').trim();
  const amount=parseFloat(String(amountEl?.value||'').replace(',','.'));
  const category=catEl?.value||'Άλλο';
  const paymentSourceId=payEl?.value||'';
  const paymentSource=typeof paymentSourceById==='function' ? paymentSourceById(paymentSourceId) : null;
  const date=dateEl?.value||addCenterToday();
  const userId=getDataOwnerId();
  const editing=addCenterEditState?.type==='daily';
  const id=editing ? addCenterEditState.id : gid();

  if(!name){
    setQuickAddInlineError('Συμπλήρωσε τίτλο εξόδου.','addCenterManualError');
    nameEl?.focus();
    return false;
  }

  if(!amount || amount<=0){
    setQuickAddInlineError('Συμπλήρωσε έγκυρο ποσό.','addCenterManualError');
    amountEl?.focus();
    return false;
  }

  if(!userId){
    setQuickAddInlineError('Δεν υπάρχει ενεργή σύνδεση.','addCenterManualError');
    return false;
  }

  const expense=typeof makeCreditCardExpensePayload==='function'
    ? makeCreditCardExpensePayload({
        id,
        name,
        amount,
        category,
        date,
        paymentSourceId,
        paymentSourceName:paymentSource?.name||'',
        paymentSourceType:paymentSource?.incomeType||''
      },paymentSource)
    : {
        id,
        name,
        amount,
        category,
        date,
        paymentSourceId,
        paymentSourceName:paymentSource?.name||'',
        paymentSourceType:paymentSource?.incomeType||''
      };

  const monthKey=date.substring(0,7);
  ensM(monthKey);

  const oldExpense=editing && typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});

  const canSave=await validateExpenseBeforeSave(expense,{editing,errorTarget:'addCenterManualError'});
  if(!canSave)return false;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(editing?'Ενημερώνεται έξοδο...':'Αποθηκεύεται έξοδο...', 'Ενημερώνω κινήσεις, κάρτες και υπόλοιπα.'))return false;

  if(typeof applyCreditCardPurchaseBalance==='function')applyCreditCardPurchaseBalance(expense,oldExpense);

  // Optimistic local update. For edits, remove the old copy from every month first.
  if(editing){
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(x=>x.id!==id);
    });
  }

  D.months[monthKey].daily.push(expense);

  let walletEffect=null;
  try{
    if(btn){
      btn.disabled=true;
      btn.textContent=editing?'Ενημέρωση...':'Αποθήκευση...';
    }

    walletEffect=await capvoApplyDailyExpenseWalletEffects(userId,expense,oldExpense);
    await saveDailyExpenseRow(userId,expense);
    if(typeof saveCreditCardPurchaseSideEffects==='function')await saveCreditCardPurchaseSideEffects(userId,expense);
    if(typeof persistCreditCardBalanceForPurchase==='function')await persistCreditCardBalanceForPurchase(userId,expense);
    // NOTE: saveDailyExpenseRow called ONCE only. Second call was a bug (double-write). Fixed v1.8.6.20.
    curM=monthKey;
    addCenterEditState=null;
    render();
    closeAddCenterSheet();
    const successMsg=editing?'✅ Η κίνηση ενημερώθηκε':'✅ Το έξοδο αποθηκεύτηκε';
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast(successMsg);
    return true;

  }catch(e){
    console.error('saveAddCenterManualExpense v3 failed:',e);
    if(walletEffect?.rollback){
      try{await walletEffect.rollback();}catch(rollbackErr){console.error('manual wallet rollback failed:',rollbackErr);}
    }
    // Safest recovery: reload canonical data if possible.
    try{
      await fetchAllData(userId);
      render();
    }catch(reloadErr){
      console.error('Reload after save failure failed:',reloadErr);
    }
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω το έξοδο.');
    setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.','addCenterManualError');
    return false;

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.textContent=addCenterEditState?'Ενημέρωση εξόδου':'Αποθήκευση εξόδου';
    }
  }
}


// ============================================================
// ADD CENTER V4 — Premium Quick Add overrides
// Kept at the end on purpose so it safely overrides older patch functions.
// ============================================================
(function(){
  function acEl(id){return document.getElementById(id);}

  window.renderSmartQuickPreview=function(targetId,text){
    const el=acEl(targetId);
    if(!el)return;

    const value=(text||'').trim();
    const parsed=quickAddPreviewData(value);

    if(!value){
      el.classList.remove('visible','invalid','is-visible');
      el.innerHTML='';
      return;
    }

    if(!parsed){
      el.classList.add('visible','invalid','is-visible');
      el.innerHTML=`
        <div class="smart-preview-card">
          <div class="smart-preview-top">
            <div>
              <div class="smart-preview-amount-big">?</div>
              <div class="smart-preview-name">Δεν βρήκα ποσό</div>
            </div>
            <div class="smart-preview-chip">💬</div>
          </div>
          <div class="smart-preview-lines">
            <div class="smart-preview-line"><span>Παράδειγμα</span><strong>καφές 3 μετρητά</strong></div>
          </div>
        </div>`;
      return;
    }

    const icon=(typeof CEMO!=='undefined' && CEMO[parsed.category]) ? CEMO[parsed.category] : '📌';
    const amount=(typeof fmt==='function') ? fmt(parsed.amount) : `€${Number(parsed.amount||0).toFixed(2)}`;
    const payment=parsed.paymentSourceName || 'Κανονικό budget';
    const today=typeof addCenterToday==='function' ? addCenterToday() : (typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA'));

    el.classList.add('visible','is-visible');
    el.classList.remove('invalid');
    el.innerHTML=`
      <div class="smart-preview-card">
        <div class="smart-preview-top">
          <div>
            <div class="smart-preview-amount-big">${amount}</div>
            <div class="smart-preview-name">${esc(parsed.name || 'Έξοδο')}</div>
          </div>
          <div class="smart-preview-chip">${icon}</div>
        </div>
        <div class="smart-preview-lines">
          <div class="smart-preview-line"><span>Κατηγορία</span><strong>${esc(parsed.category || 'Άλλο')}</strong></div>
          <div class="smart-preview-line"><span>Πληρωμή</span><strong>${esc(payment)}</strong></div>
          <div class="smart-preview-line"><span>Ημερομηνία</span><strong>${esc(today)}</strong></div>
        </div>
      </div>`;
  };

  window.switchAddCenterTab=function(tab='quick'){
    capvoSuppressAutoFocus?.(600);
    const quickTab=acEl('addCenterQuickTab');
    const manualTab=acEl('addCenterManualTab');
    const quickPanel=acEl('addCenterQuickPanel');
    const manualPanel=acEl('addCenterManualPanel');
    const success=acEl('addCenterSuccess');
    const isManual=tab==='manual';

    document.body.classList.toggle('add-center-manual-active',isManual);
    document.body.classList.remove('add-center-success-active');
    success?.classList.remove('active');

    quickTab?.classList.toggle('active',!isManual);
    manualTab?.classList.toggle('active',isManual);
    quickPanel?.classList.toggle('active',!isManual);
    manualPanel?.classList.toggle('active',isManual);

    quickTab?.setAttribute('aria-selected',String(!isManual));
    manualTab?.setAttribute('aria-selected',String(isManual));

    // Keep Add Center tabs predictable on mobile:
    // every tab switch starts from the top of its own panel and never auto-focuses inputs.
    try{
      quickPanel && (quickPanel.scrollTop=0);
      manualPanel && (manualPanel.scrollTop=0);
      const sheet=document.querySelector('#addCenterSheet .add-center-sheet');
      sheet && (sheet.scrollTop=0);
      document.activeElement?.blur?.();
    }catch(_){}

    setTimeout(()=>{
      // autofocus disabled: user taps the field when ready;
    },80);
  };

  window.openAddCenterSheet=function(tab='quick',prefill='',errorMessage=''){
    capvoSuppressAutoFocus?.(900);
    const sheet=acEl('addCenterSheet');
    const input=acEl('quickAddSheetInput');
    if(!sheet)return;

    sheet.classList.add('active');
    document.body.classList.add('quick-sheet-open','add-center-open');
    document.body.classList.remove('add-center-success-active');

    if(typeof resetAddCenterManualForm==='function')resetAddCenterManualForm();
    if(typeof renderAddCenterRecentChips==='function')renderAddCenterRecentChips();
    switchAddCenterTab(tab==='manual'?'manual':'quick');

    if(input){
      if(typeof prefill==='string' && prefill.trim())input.value=prefill.trim();
      else if(tab!=='manual')input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    clearQuickAddInlineError('quickAddSheetError');
    clearQuickAddInlineError('addCenterManualError');

    if(errorMessage)setQuickAddInlineError(errorMessage,'quickAddSheetError');

    setTimeout(()=>{
      // autofocus disabled: user taps the field when ready;
    },180);
  };

  window.closeAddCenterSheet=function(event){
    if(event && event.target && event.target.id!=='addCenterSheet')return;

    addCenterEditState=null;
    document.body.classList.remove('quick-sheet-open','add-center-open','add-center-manual-active','add-center-success-active');
    acEl('addCenterSheet')?.classList.remove('active');
    acEl('addCenterSuccess')?.classList.remove('active');

    const submit=acEl('addCenterManualSubmit');
    if(submit)submit.textContent='Αποθήκευση εξόδου';

    if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
    if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();
  };

  window.openQuickAddSheet=function(prefill='',errorMessage=''){
    return openAddCenterSheet('quick',prefill,errorMessage);
  };

  window.closeQuickAddSheet=function(event){
    return closeAddCenterSheet(event);
  };

  window.fillQuickAddSheet=function(text){
    const input=acEl('quickAddSheetInput');
    if(!input)return;
    input.value=text;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    // keep keyboard closed after suggestion tap; user can tap input to edit;
  };

  window.showAddCenterSuccess=function(){
    acEl('addCenterSuccess')?.classList.add('active');
    document.body.classList.add('add-center-success-active');
  };

  window.submitQuickAddSheet=async function(){
    const sheetInput=acEl('quickAddSheetInput');
    const btn=acEl('quickAddSheetSubmit');
    clearQuickAddInlineError('quickAddSheetError');

    const text=(sheetInput?.value || '').trim();
    if(!text){
      setQuickAddInlineError('Γράψε κάτι όπως “καφές 3”.','quickAddSheetError');
      sheetInput?.focus();
      return false;
    }

    if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

    const saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});

    if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}

    if(!saved)return false;

    if(sheetInput){
      sheetInput.value='';
      sheetInput.dispatchEvent(new Event('input',{bubbles:true}));
    }

    showAddCenterSuccess();
    setTimeout(()=>closeAddCenterSheet(),700);
    return true;
  };

  const previousSetup=window.setupAddCenterState;
  window.setupAddCenterState=function(){
    if(typeof previousSetup==='function')previousSetup();

    const sheetInput=acEl('quickAddSheetInput');
    const submit=acEl('quickAddSheetSubmit');

    if(sheetInput && !sheetInput.dataset.v4Bound){
      sheetInput.dataset.v4Bound='1';
      const sync=()=>{
        const hasValue=sheetInput.value.trim().length>0;
        if(submit)submit.disabled=!hasValue;
        renderSmartQuickPreview('quickAddSheetPreview',sheetInput.value);
        if(hasValue)clearQuickAddInlineError('quickAddSheetError');
      };
      sheetInput.addEventListener('input',sync);
      sheetInput.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          e.stopPropagation();
          submitQuickAddSheet();
        }
      });
      sync();
    }
  };

  // Bind once for pages where DOMContentLoaded already fired before this override is parsed.
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setupAddCenterState(),{once:true});
  }else{
    setupAddCenterState();
  }
})();

// ============================================================
// QUICK ADD V5 HOTFIX — stable open/close/save state
// Keeps the existing V4 HTML, but prevents broken success/duplicate button state.
// ============================================================
(function(){
  function qav5(id){return document.getElementById(id);}

  function qav5CleanState(){
    document.body.classList.remove('add-center-success-active');
    qav5('addCenterSuccess')?.classList.remove('active');

    const quickBtn=qav5('quickAddSheetSubmit');
    const manualBtn=qav5('addCenterManualSubmit');

    if(quickBtn){
      quickBtn.disabled=!((qav5('quickAddSheetInput')?.value || '').trim());
      quickBtn.textContent='Αποθήκευση';
    }

    if(manualBtn){
      manualBtn.disabled=false;
      manualBtn.textContent='Αποθήκευση εξόδου';
    }
  }

  const previousOpenAddCenterSheet=window.openAddCenterSheet;
  window.openAddCenterSheet=function(tab='quick',prefill='',errorMessage=''){
    capvoSuppressAutoFocus?.(900);
    if(typeof previousOpenAddCenterSheet==='function'){
      previousOpenAddCenterSheet(tab,prefill,errorMessage);
    }else{
      qav5('addCenterSheet')?.classList.add('active');
      document.body.classList.add('quick-sheet-open','add-center-open');
    }

    qav5CleanState();

    const isManual=tab==='manual';
    document.body.classList.toggle('add-center-manual-active',isManual);

    qav5('addCenterQuickTab')?.classList.toggle('active',!isManual);
    qav5('addCenterManualTab')?.classList.toggle('active',isManual);
    qav5('addCenterQuickPanel')?.classList.toggle('active',!isManual);
    qav5('addCenterManualPanel')?.classList.toggle('active',isManual);

    const input=qav5('quickAddSheetInput');
    if(input && !isManual){
      if(prefill && String(prefill).trim())input.value=String(prefill).trim();
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    setTimeout(()=>{
      // autofocus disabled: user taps the field when ready;
    },120);
  };

  window.closeAddCenterSheet=function(event){
    const overlay=qav5('addCenterSheet');
    // Close only when tapping the overlay background.
    // Previously, clicks on suggestion chips/buttons bubbled here and closed the sheet.
    if(event && event.target !== overlay)return;

    if(typeof addCenterEditState!=='undefined')addCenterEditState=null;

    qav5CleanState();
    document.body.classList.remove('quick-sheet-open','add-center-open','add-center-manual-active','add-center-success-active');
    qav5('addCenterSheet')?.classList.remove('active');

    if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
    if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();
  };

  window.closeQuickAddSheet=function(event){
    return window.closeAddCenterSheet(event);
  };

  window.openQuickAddSheet=function(prefill='',errorMessage=''){
    return window.openAddCenterSheet('quick',prefill,errorMessage);
  };

  window.showAddCenterSuccess=function(){
    // No inline success state for now. It caused duplicate/broken visual state.
    // We keep user feedback through toast and close the sheet.
    if(typeof showMiniToast==='function')showMiniToast('✅ Το έξοδο αποθηκεύτηκε');
    setTimeout(()=>window.closeAddCenterSheet(),120);
  };

  window.submitQuickAddSheet=async function(){
    const input=qav5('quickAddSheetInput');
    const btn=qav5('quickAddSheetSubmit');

    if(typeof clearQuickAddInlineError==='function')clearQuickAddInlineError('quickAddSheetError');

    const text=(input?.value || '').trim();
    if(!text){
      if(typeof setQuickAddInlineError==='function')setQuickAddInlineError('Γράψε κάτι όπως “καφές 3”.','quickAddSheetError');
      input?.focus();
      return false;
    }

    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    let saved=false;
    try{
      saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});
    }finally{
      if(btn){
        btn.disabled=false;
        btn.textContent='Αποθήκευση';
      }
    }

    if(!saved)return false;

    if(input){
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    if(typeof showMiniToast==='function')showMiniToast('✅ Το έξοδο αποθηκεύτηκε');
    window.closeAddCenterSheet();
    return true;
  };

  const previousSetup=window.setupAddCenterState;
  window.setupAddCenterState=function(){
    if(typeof previousSetup==='function')previousSetup();

    qav5CleanState();

    const input=qav5('quickAddSheetInput');
    const submit=qav5('quickAddSheetSubmit');
    if(input && !input.dataset.v5Bound){
      input.dataset.v5Bound='1';
      input.addEventListener('input',()=>{
        if(submit)submit.disabled=!input.value.trim();
      });
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>window.setupAddCenterState(),{once:true});
  }else{
    window.setupAddCenterState();
  }
})();
