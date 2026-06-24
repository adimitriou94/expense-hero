// CAPVO app split: 07b-add-center-txcomplete.js
// txComplete: mobile transaction detail, edit/duplicate/delete, save function
// Source: 07-add-center.js lines 503-1213

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
  if(e?.isSavingsMovement)return e?.isSavingsTransfer?'Εσωτερική μεταφορά στόχου':'Στόχος';
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
  if(typeof capvoMovementTypeLabel==='function')return capvoMovementTypeLabel(e);
  const mt=String(e?.movementType||'');
  if(mt==='salary_deposit' || mt==='income_deposit')return 'Εισόδημα';
  if(mt==='fixed_expense_payment')return 'Πληρωμή παγίου';
  if(mt==='card_payment')return 'Πληρωμή κάρτας';
  if(mt==='credit_card_purchase')return 'Αγορά με πιστωτική';
  if(mt==='wallet_transfer')return 'Μεταφορά wallet';
  if(mt==='savings_deposit')return 'Αποταμίευση';
  if(mt==='savings_withdrawal')return 'Επιστροφή από στόχο';
  if(mt==='savings_transfer_in' || mt==='savings_transfer_out')return 'Εσωτερική μεταφορά';
  if(mt==='restricted_expense')return 'Κίνηση παροχής';
  return 'Κίνηση budget';
}

function txCompleteFillManualForm(e,{edit=false}={}){
  if(!e)return;

  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const subcatEl=document.getElementById('acDSubcategory');
  const merchantEl=document.getElementById('acDMerchant');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const notesEl=document.getElementById('acDNotes');
  const submit=document.getElementById('addCenterManualSubmit');

  if(nameEl)nameEl.value=e.name||'';
  if(amountEl)amountEl.value=Number(e.amount||0);
  if(typeof setAddCenterCategoryFromExpense==='function')setAddCenterCategoryFromExpense(e);
  else if(catEl)catEl.value=e.category||'Άλλο';
  if(subcatEl)subcatEl.value=e.subcategoryId||e.subcategory_id||'';
  if(merchantEl)merchantEl.value=e.merchantName||e.merchant_name||'';
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


async function txCompleteUndoCardPayment(txId){
  const cleanId=String(txId||'').replace(/^card_payment_/,'');
  if(!cleanId)return;
  closeMobileTransactionDetail();
  if(typeof undoCardPayment==='function')await undoCardPayment(cleanId);
  else showMiniToast?.('Η αναίρεση πληρωμής κάρτας δεν είναι διαθέσιμη.','error');
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
  const categoryLabel=typeof capvoCategoryTreeLabel==='function'?capvoCategoryTreeLabel(e):category;
  const icon=typeof capvoCategoryIcon==='function'?capvoCategoryIcon(category):(CEMO[category]||'📌');
  const payText=txCompletePaymentText(e,type);
  const dateLabel=type==='fixed' ? 'Κάθε μήνα' : txCompleteLongDate(e.date);
  const typeLabel=txCompleteMovementTypeLabel(e,type);
  const amountLabel=typeof capvoMovementSignedAmountLabel==='function'?capvoMovementSignedAmountLabel(e):txCompleteFormatMovementAmount(e,type);
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(e.affectsBudget===false?0:Number(e.amount)||0);
  const affects=!!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
  const noteText=e.notes || e.note || '';
  const merchantText=e.merchantName||e.merchant_name||'';
  const displayTitle=typeof capvoMovementDisplayTitle==='function'?capvoMovementDisplayTitle(e):(merchantText||e.name||'Κίνηση');
  const canEdit=type!=='movement' && e.canEdit!==false;
  const canDelete=type!=='movement' && e.canDelete!==false;
  const canUndoCardPayment=!!(e.isCardPayment && (e.sourceId || String(id||'').replace(/^card_payment_/,'')));
  const cardPaymentTxId=e.sourceId || String(id||'').replace(/^card_payment_/,'');
  const actions=(canEdit||canDelete||canUndoCardPayment)?`
    <div class="tx-v25-actions">
      ${canEdit?`<button type="button" class="tx-v25-action primary" onclick="txCompleteOpenManualForEdit('${type}','${id}')"><span>✎</span>Επεξεργασία</button>`:''}
      ${canEdit?`<button type="button" class="tx-v25-action secondary" onclick="txCompleteOpenManualForDuplicate('${type}','${id}')"><span>⧉</span>Αντιγραφή</button>`:''}
      ${canUndoCardPayment?`<button type="button" class="tx-v25-action secondary" onclick="txCompleteUndoCardPayment('${cardPaymentTxId}')"><span>↺</span>Αναίρεση</button>`:''}
      ${canDelete?`<button type="button" class="tx-v25-action danger" onclick="txCompleteDeleteWithConfirm('${type}','${id}')"><span>🗑</span>Διαγραφή</button>`:''}
    </div>`:`
    <div class="tx-v25-readonly-note">
      Αυτή η κίνηση προέρχεται από κάρτα ή στόχο και εμφανίζεται εδώ πληροφοριακά. Η διαχείρισή της γίνεται από την αντίστοιχη ενότητα.
    </div>`;

  const sourceText=e.paymentSourceName||payText;
  const budgetText=affects?(impact<0?'Επιστρέφει budget':'Επηρεάζει budget'):'Δεν επηρεάζει budget';
  const secondaryTitle=(merchantText && e.name && String(e.name)!==String(merchantText)) ? String(e.name) : '';
  const hasMemo=!!(merchantText || secondaryTitle || noteText);

  content.innerHTML=`
    <div class="tx-v26-detail-hero">
      <button class="tx-v25-close" type="button" onclick="closeMobileTransactionDetail()" aria-label="Κλείσιμο">×</button>
      <div class="tx-v26-identity">
        <div class="tx-v25-icon ${CCLS[category]||'cat-other'}">${icon}</div>
        <div class="tx-v26-headline">
          <div class="tx-v25-kicker">${esc(typeLabel)}</div>
          <h3>${esc(displayTitle)}</h3>
          <div class="tx-v26-mini-path">${esc(categoryLabel)}</div>
        </div>
      </div>
      <div class="tx-v25-amount ${!affects?'is-neutral':''} ${impact<0?'is-return':''}">${amountLabel}</div>
      <div class="tx-v26-source-chip">${esc(sourceText)}</div>
    </div>

    ${hasMemo ? `<div class="tx-v26-memo-card">
      ${merchantText ? `<div class="tx-v26-memo-row"><span>Κατάστημα / Λεπτομέρεια</span><strong>${esc(merchantText)}</strong></div>` : ''}
      ${secondaryTitle ? `<div class="tx-v26-memo-row"><span>Τίτλος</span><strong>${esc(secondaryTitle)}</strong></div>` : ''}
      ${noteText ? `<div class="tx-v26-note-block"><span>Σημείωση</span><p>${esc(noteText)}</p></div>` : ''}
    </div>` : ''}

    <div class="tx-v26-meta-list">
      <div class="tx-v26-meta-row"><span>Ημερομηνία</span><strong>${esc(dateLabel)}</strong></div>
      <div class="tx-v26-meta-row"><span>Κατηγορία</span><strong>${esc(categoryLabel)}</strong></div>
      <div class="tx-v26-meta-row"><span>Πηγή</span><strong>${esc(sourceText)}</strong></div>
      <div class="tx-v26-meta-row"><span>Budget</span><strong>${esc(budgetText)}</strong></div>
    </div>

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
  const categoryLabel=typeof capvoCategoryTreeLabel==='function'?capvoCategoryTreeLabel(e):category;
  const c=typeof capvoCategoryCssClass==='function'?capvoCategoryCssClass(category):(CCLS[category]||'cat-other');
  const em=typeof capvoCategoryIcon==='function'?capvoCategoryIcon(category):(CEMO[category]||'📌');
  const isSelected=selectedDaily.has(e.sourceId||e.id);
  const showSelect=selectionMode.daily && e.canDelete!==false && e.movementType==='daily_expense';
  const affects=!!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
  const impact=typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):(affects?(Number(e.amount)||0):0);
  const detailType=String(e.movementType||'')==='fixed_expense'
    ? 'fixed'
    : (e.readOnly || e.canEdit===false ? 'movement' : 'daily');
  const detailId=detailType==='movement'?e.id:(e.sourceId||e.id);
  const kind=typeof capvoMovementKind==='function'?capvoMovementKind(e):String(e.movementGroup||'budget');
  const typeLabel=txCompleteMovementTypeLabel(e,'daily');
  const isCard=kind==='cards' || String(e.movementGroup||'')==='cards' || e.isCardPayment || e.isCreditCardPurchase || e.paymentAccountType==='credit_card';
  const isSavings=kind==='savings' || String(e.movementGroup||'')==='savings' || e.isSavingsMovement;
  const isIncome=kind==='income' || e.isIncomeMovement;
  const isWallet=kind==='wallets' || e.isWalletTransfer;
  const isFixed=kind==='fixed' || e.isFixedExpensePayment || e.isFixedExpense;
  const amountLabel=typeof capvoMovementSignedAmountLabel==='function'
    ? capvoMovementSignedAmountLabel(e)
    : (!affects ? fmt(Math.abs(Number(e.amount)||0)) : (impact<0 ? '+'+fmt(Math.abs(impact)) : '-'+fmt(Math.abs(impact))));
  const displayTitle=typeof capvoMovementDisplayTitle==='function'?capvoMovementDisplayTitle(e):(e.merchantName||e.merchant_name||e.name||'Κίνηση');
  const noteText=String(e.notes||e.note||'').trim();
  const merchant=String(e.merchantName||e.merchant_name||'').trim();

  const badges=[`<span class="tx-type-badge tx-type-${esc(kind)}">${esc(typeLabel)}</span>`];
  if(isFixed && typeLabel!=='Πληρωμή παγίου')badges.push(`<span class="payment-badge fixed-payment">Πάγιο</span>`);
  if(isCard)badges.push(`<span class="payment-badge credit-card">Κάρτα</span>`);
  if(isSavings)badges.push(`<span class="payment-badge savings">Στόχος</span>`);
  if(isIncome)badges.push(`<span class="payment-badge budget-return">Income</span>`);
  if(isWallet)badges.push(`<span class="payment-badge no-budget">Transfer</span>`);
  if(!affects)badges.push(`<span class="payment-badge no-budget">Δεν επηρεάζει budget</span>`);
  if(affects && impact<0 && !isIncome)badges.push(`<span class="payment-badge budget-return">Επιστροφή budget</span>`);

  const metaParts=[categoryLabel,merchant&&merchant!==displayTitle?merchant:'',e.paymentSourceName||'',e.sourceLabel||'']
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
        <div class="expense-name">${esc(displayTitle)}</div>
        <div class="expense-cat">${meta}${badges.join('')}</div>
        ${noteText?`<div class="tx-row-note">📝 ${esc(noteText)}</div>`:''}
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

  const visibleFilterLabel=(document.querySelector('[data-mobile-transaction-filter].active')?.textContent||'Όλα').trim();
  countEl.innerHTML=`${movementRows.length} κινήσεις κύκλου · ${esc(visibleFilterLabel)}`;

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
  const subcatEl=document.getElementById('acDSubcategory');
  const merchantEl=document.getElementById('acDMerchant');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const notesEl=document.getElementById('acDNotes');
  const btn=document.getElementById('addCenterManualSubmit');

  clearQuickAddInlineError('addCenterManualError');

  const name=(nameEl?.value||'').trim();
  const amount=parseFloat(String(amountEl?.value||'').replace(',','.'));
  const categoryId=catEl?.value||'';
  const rootCategory=(typeof capvoCategoryById==='function'?capvoCategoryById(categoryId):null)
    || (typeof capvoRootCategoryByName==='function'?capvoRootCategoryByName(categoryId):null);
  const category=rootCategory?.name||'Άλλο';
  let subcategoryId=subcatEl?.value||'';
  const customSubcategoryName=addCenterSelectedCustomSubcategoryName();
  const saveCustomSubcategory=!!document.getElementById('acDSaveCustomSubcategory')?.checked;
  const merchantName=(merchantEl?.value||'').trim();
  let notes=(notesEl?.value||'').trim();
  const paymentSourceId=payEl?.value||'';
  const paymentSource=typeof paymentSourceById==='function' ? paymentSourceById(paymentSourceId) : null;
  const date=dateEl?.value||addCenterToday();
  const userId=getDataOwnerId();
  const editing=addCenterEditState?.type==='daily';
  const id=editing ? addCenterEditState.id : gid();

  if(!name){
    addCenterManualSaveToast('Συμπλήρωσε τίτλο εξόδου.');
    nameEl?.focus();
    return false;
  }

  if(!amount || amount<=0){
    addCenterManualSaveToast('Συμπλήρωσε έγκυρο ποσό.');
    amountEl?.focus();
    return false;
  }

  if(!userId){
    addCenterManualSaveToast('Δεν υπάρχει ενεργή σύνδεση.');
    return false;
  }

  if(subcategoryId===addCenterCustomCategoryValue()){
    if(!customSubcategoryName){
      addCenterManualSaveToast('Γράψε τη δική σου υποκατηγορία ή διάλεξε υπάρχουσα.');
      document.getElementById('acDCustomSubcategoryName')?.focus();
      return false;
    }
    if(saveCustomSubcategory){
      try{
        const customCategory=await capvoEnsureCustomSubcategory(rootCategory?.id,customSubcategoryName);
        if(customCategory){
          subcategoryId=customCategory.id;
          renderAddCenterSubcategoryOptions(subcategoryId,rootCategory?.id||'');
        }else{
          subcategoryId='';
        }
      }catch(categoryError){
        console.error('custom subcategory create failed:',categoryError);
        addCenterManualSaveToast('Δεν μπόρεσα να αποθηκεύσω τη δική σου υποκατηγορία. Δοκίμασε ξανά.');
        return false;
      }
    }else{
      subcategoryId='';
      notes=[`Είδος: ${customSubcategoryName}`,notes].filter(Boolean).join('\n');
    }
  }

  const expense=typeof makeCreditCardExpensePayload==='function'
    ? makeCreditCardExpensePayload({
        id,
        name,
        amount,
        category,
        categoryId:categoryId||null,
        subcategoryId:subcategoryId||null,
        merchantName,
        notes,
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
        categoryId:categoryId||null,
        subcategoryId:subcategoryId||null,
        merchantName,
        notes,
        date,
        paymentSourceId,
        paymentSourceName:paymentSource?.name||'',
        paymentSourceType:paymentSource?.incomeType||''
      };

  const monthKey=date.substring(0,7);
  ensM(monthKey);

  if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(expense);
  const oldExpense=editing && typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});

  const canSave=await validateExpenseBeforeSave(expense,{editing});
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
    addCenterManualSaveToast('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.');
    return false;

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.textContent=addCenterEditState?'Ενημέρωση εξόδου':'Αποθήκευση εξόδου';
    }
  }
}



// ===== END 07b-add-center-txcomplete.js =====
