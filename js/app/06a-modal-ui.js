// CAPVO app split: 06a-modal-ui.js
// Modal UI: open/close, category menus, card purchase helpers, wallet helpers
// Source: 06-modals-nav-auth.js lines 1-1054

// CAPVO app split: 06-modals-nav-auth.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== MODALS / SAVE ACTIONS / NAV / AUTH =====
function closeM(){
  document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active'));
  closeIncomeCustomPickers?.();
  document.body.classList.remove('modal-open');
}


function ensureCardByIdHelper(){
  if(typeof window.cardById!=='function'){
    window.cardById=function(id){
      return (D?.creditCards||[]).find(c=>String(c.id)===String(id))||null;
    };
  }
}
ensureCardByIdHelper();

function toggleDailyCategoryMenu(forceState){
  const picker=$('dailyCategoryPicker');
  if(!picker)return;
  const shouldOpen=typeof forceState==='boolean'?forceState:!picker.classList.contains('is-open');
  picker.classList.toggle('is-open',shouldOpen);
}

function renderDailyCategoryOptions(selectedIdOrName=''){
  const select=$('fDC');
  const menu=$('dailyCategoryMenu');
  if(!select || !menu)return;
  const roots=typeof capvoRootCategories==='function'?capvoRootCategories():[];
  if(!roots.length)return;
  let selected=(typeof capvoCategoryById==='function'?capvoCategoryById(selectedIdOrName):null)
    || (typeof capvoRootCategoryByName==='function'?capvoRootCategoryByName(selectedIdOrName):null)
    || roots[0];
  select.innerHTML=roots.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  select.value=selected.id;
  menu.innerHTML=roots.map(c=>`<button type="button" data-category-id="${esc(c.id)}" onclick="setDailyCategory('${esc(c.id)}')">${esc(c.icon||'📌')} ${esc(c.name)}</button>`).join('');
  renderDailySubcategoryOptions('',selected.id);
  syncDailyCategoryUI(selected.id);
}
function renderDailySubcategoryOptions(selectedId='',parentId=''){
  const select=$('fDSubcategory');
  if(!select)return;
  const root=parentId ? (typeof capvoCategoryById==='function'?capvoCategoryById(parentId):null) : (typeof capvoCategoryById==='function'?capvoCategoryById($('fDC')?.value):null);
  const children=(typeof capvoSubcategories==='function' && root?.id)?capvoSubcategories(root.id):[];
  select.innerHTML='<option value="">Χωρίς υποκατηγορία</option>'+children.map(c=>`<option value="${esc(c.id)}">${esc(c.icon||'📌')} ${esc(c.name)}</option>`).join('');
  select.value=(selectedId && [...select.options].some(o=>String(o.value)===String(selectedId)))?selectedId:'';
}
function syncDailySubcategoryUI(){}

function syncDailyCategoryUI(category){
  const select=$('fDC');
  const current=category||select?.value||'';
  const c=(typeof capvoCategoryById==='function'?capvoCategoryById(current):null)
    || (typeof capvoRootCategoryByName==='function'?capvoRootCategoryByName(current):null)
    || (typeof capvoDefaultRootCategory==='function'?capvoDefaultRootCategory():null);
  if(select && c && select.value!==c.id)select.value=c.id;
  const label=$('dailyCategoryCurrent');
  if(label)label.textContent=c?.name||'Άλλο';
  const helper=$('dailyCategoryTriggerLabel');
  if(helper)helper.textContent='Επίλεξε κατηγορία';
  document.querySelectorAll('#dailyCategoryMenu button').forEach(btn=>{
    btn.classList.toggle('active',String(btn.dataset.categoryId||'')===String(c?.id||''));
  });
  renderDailySubcategoryOptions($('fDSubcategory')?.value||'',c?.id||'');
}

function getSelectedCreditCardRate(){
  const pay=$('fDPay')?.value||'';
  const source=typeof paymentSourceById==='function' ? paymentSourceById(pay) : null;
  const card=window.cardById?.(source?.id||pay)||null;
  return Number(card?.rate)||0;
}

function validateCreditCardAvailableLimit(expense,oldExpense=null){
  const source=typeof paymentSourceById==='function' ? paymentSourceById(expense?.paymentSourceId||'') : null;
  const isCard=typeof isCreditCardPaymentSource==='function' ? isCreditCardPaymentSource(source) : (source?.type==='credit_card');
  if(!isCard)return {ok:true};
  const card=window.cardById?.(expense.creditCardId||expense.paymentSourceId);
  if(!card || !(Number(card.limit)>0))return {ok:true};

  const activePlans=(D.creditCardInstallmentPlans||[])
    .filter(p=>String(p.cardId)===String(card.id) && (p.status||'active')==='active');

  const planDebt=activePlans.reduce((sum,p)=>{
    const total=Number(p.totalAmount)||0;
    const count=Math.max(1,Number(p.installmentCount)||1);
    const paid=Number(p.paidInstallments)||0;
    const paidAmount=(total/count)*paid;
    return sum+Math.max(0,total-paidAmount);
  },0);

  let baseBalance=(Number(card.balance)||0)+planDebt;

  const oldIsSameCard=oldExpense && (oldExpense.isCreditCardPurchase || oldExpense.paymentAccountType==='credit_card') && String(oldExpense.creditCardId||oldExpense.paymentSourceId)===String(card.id);
  if(oldIsSameCard)baseBalance=Math.max(0,baseBalance-(Number(oldExpense.amount)||0));

  const projected=baseBalance+(Number(expense.amount)||0);
  const available=Math.max(0,(Number(card.limit)||0)-baseBalance);
  return {ok:projected<=(Number(card.limit)||0)+0.0001,available};
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
    $('fDD').value=typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
    $('fDID').value='';
    $('btnDaily').textContent='Αποθήκευση';

    window.capvoLockedCardPurchaseId='';
    fillPaymentSourceSelect('');
    const pay=$('fDPay');
    if(pay){
      pay.disabled=false;
      delete pay.dataset.lockedCardId;
    }
    if($('lockedCardSource'))$('lockedCardSource').style.display='none';
    setCardPurchaseMode('normal');
    if($('fDInstallments'))$('fDInstallments').value='';
    if($('fDInstallmentRate'))$('fDInstallmentRate').value='';
    if($('fDInterestFree'))$('fDInterestFree').checked=true;
    if($('interestFreeToggle'))$('interestFreeToggle').classList.add('active');
    if($('fDInstallmentRateGroup'))$('fDInstallmentRateGroup').style.display='none';
    updateDailyCreditCardOptions();
    if(typeof renderDailyCategoryOptions==='function')renderDailyCategoryOptions('Άλλο');
    else syncDailyCategoryUI('Άλλο');
    if($('fDSubcategory'))$('fDSubcategory').value='';
    if($('fDMerchant'))$('fDMerchant').value='';
    if($('fDNotes'))$('fDNotes').value='';
    toggleDailyCategoryMenu(false);

    // autofocus disabled: user taps the field when ready;
  }

  if(t==='fixed'){
    $('mFixed').classList.add('active');
    $('mFixed').classList.remove('is-edit');
    $('mFixed').classList.add('is-create');
    $('mFixedTitle').innerHTML='🔒 Νέο πάγιο<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value='';
    $('fFA').value='';
    $('fFID').value='';
    $('fFC').value='Στέγαση';
    if(typeof syncFixedCategoryPicker==='function')syncFixedCategoryPicker('Στέγαση');
    if($('fFSchedule'))$('fFSchedule').value='monthly';
    if($('fFDueDay'))$('fFDueDay').value=String(new Date().getDate());
    capvoSetFixedNextDueDateInputValue(todayISO?.()||new Date().toLocaleDateString('en-CA'));
    capvoSyncFixedScheduleUI({force:true});
    if($('fFAutoPay'))$('fFAutoPay').checked=false;
    fillFixedSourceWalletSelect('');
    $('btnFixed').textContent='Αποθήκευση';
    syncFixedEditSafetyUI('');
    // autofocus disabled: user taps the field when ready;
  }

  if(t==='cc'){
    $('mCC').classList.add('active');
    $('fCCID').value='';
    $('fCCN').value='';
    $('fCCB').value='';
    $('fCCR').value='18.5';
    $('fCCM').value='';
    $('fCCL').value='';
    if($('fCCBank'))$('fCCBank').value='';
    if($('fCCDueDay'))$('fCCDueDay').value='';
    if($('fCCLoanType'))$('fCCLoanType').value='consumer';
    if(typeof setLoanType==='function')setLoanType('consumer');
    if($('fCCLoanPurpose'))$('fCCLoanPurpose').value='other';
    if(typeof setLoanPurpose==='function')setLoanPurpose('other');
    if(typeof resetCCFormUI==='function') resetCCFormUI('credit_card');
    // autofocus disabled: user taps the field when ready;
  }

  if(t==='incomeSource'){
    $('mIncomeSource').classList.add('active');
    $('mIncomeSourceTitle').textContent='Προσθήκη έξτρα εσόδου';
    if($('incomeModalKicker'))$('incomeModalKicker').textContent='Έξτρα εισόδημα';
    if($('incomeModalIntro'))$('incomeModalIntro').textContent='Καταχώρησε bonus, ενοίκιο, μερίσματα ή άλλο ποσό και διάλεξε σε ποιο wallet μπήκαν τα χρήματα.';

    $('fISName').value='';
    $('fISAmount').value='';
    $('fISCategory').value='Bonus';
    $('fISType').value='bank';
    $('fISRestriction').value='none';
    $('fISRestrictedCategory').value='';
    if($('fISIncludeBudget'))$('fISIncludeBudget').checked=true;
    if($('fISSavings'))$('fISSavings').checked=false;
    $('fISRecurring').checked=false;
    if($('fISPrimary'))$('fISPrimary').checked=false;
    if($('fISDestinationWallet'))fillIncomeDestinationWalletSelect('');
    $('fISNotes').value='';
    $('fISID').value='';
    $('btnIncomeSource').textContent='Αποθήκευση εσόδου';
    if(typeof clearIncomeValidation==='function')clearIncomeValidation();
    if(typeof applyIncomePreset==='function')applyIncomePreset('extra');
    else refreshIncomeCustomPickers();
    // autofocus disabled: user taps the field when ready;
  }
}

function fixedExpenseHasPayments(fixedExpenseId){
  const key=String(fixedExpenseId||'');
  if(!key)return false;
  return (D.fixedExpensePayments||[]).some(p=>String(p.fixedExpenseId||p.fixed_expense_id||'')===key);
}

function syncFixedEditSafetyUI(fixedExpenseId=''){
  const notice=$('fixedEditHistoryNotice');
  const danger=$('fixedEditDangerZone');
  const isEdit=!!fixedExpenseId;
  const showNotice=!!(isEdit && fixedExpenseHasPayments(fixedExpenseId));
  if(notice){
    notice.hidden=!showNotice;
    notice.style.display=showNotice?'flex':'none';
  }
  if(danger){
    danger.hidden=!isEdit;
    danger.style.display=isEdit?'flex':'none';
  }
}

async function capvoConfirmDeleteFixedExpense(fixedExpenseId){
  const expense=typeof capvoFixedExpenseById==='function'
    ? capvoFixedExpenseById(fixedExpenseId)
    : (D.fixedExpenses||[]).find(x=>String(x.id)===String(fixedExpenseId));
  if(!expense){showMiniToast?.('Δεν βρέθηκε το πάγιο.','error');return;}

  const hasPayments=fixedExpenseHasPayments(fixedExpenseId);
  const ok=await showConfirmModal({
    title:'Διαγραφή παγίου',
    message:`Θα διαγραφεί το πάγιο "${expense.name||'Πάγιο'}" από τις μελλοντικές υποχρεώσεις.\n\n${hasPayments?'Οι πληρωμές που έχουν ήδη γίνει θα μείνουν στο ιστορικό. Αν αναιρέσεις κάποια πληρωμή αργότερα, θα επιστραφούν τα χρήματα στο wallet αλλά το πάγιο δεν θα επανέλθει.':'Δεν υπάρχουν πληρωμές για αυτό το πάγιο. Δεν θα αλλάξει κανένα wallet.'}`,
    confirmText:'Διαγραφή παγίου',
    cancelText:'Άκυρο'
  });
  if(!ok)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Διαγράφεται πάγιο...', 'Αφαιρώ το πάγιο από τις μελλοντικές υποχρεώσεις.'))return;

  try{
    await capvoSoftDeleteFixedExpense(fixedExpenseId);
    closeM?.();
    await fetchAllData?.(getFinanceUserId?.());
    render?.();
    renderBudgetCycleManager?.();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Το πάγιο διαγράφηκε από τις μελλοντικές υποχρεώσεις.');
    showMiniToast?.('✅ Το πάγιο διαγράφηκε');
  }catch(e){
    console.error('capvoConfirmDeleteFixedExpense failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να διαγράψω το πάγιο.');
    showMiniToast?.('❌ Δεν μπόρεσα να διαγράψω το πάγιο.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

function capvoConfirmDeleteFixedExpenseFromModal(){
  const id=$('fFID')?.value||'';
  if(!id){showMiniToast?.('Δεν υπάρχει πάγιο για διαγραφή.','error');return;}
  return capvoConfirmDeleteFixedExpense(id);
}

function editExp(t,id){
  capvoSuppressAutoFocus?.(900);
  closeM();

  if(t==='fixed'){
    const e=D.fixedExpenses.find(x=>x.id===id);
    if(!e)return;

    $('mFixed').classList.add('active');
    $('mFixed').classList.remove('is-create');
    $('mFixed').classList.add('is-edit');
    $('mFixedTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value=e.name;
    $('fFA').value=e.amount;
    $('fFC').value=e.category;
    if(typeof syncFixedCategoryPicker==='function')syncFixedCategoryPicker(e.category||'Άλλο');
    $('fFID').value=id;
    if($('fFSchedule'))$('fFSchedule').value=e.scheduleType||'monthly';
    if($('fFDueDay'))$('fFDueDay').value=capvoFixedExpenseDueDay?.(e)||e.dueDay||1;
    const fixedEditNextDue=capvoFixedExpenseNextDueDate?.(e)||e.nextDueDate||'';
    capvoSetFixedNextDueDateInputValue(fixedEditNextDue);
    capvoSyncFixedScheduleUI({preserveDate:true});
    if($('fFAutoPay'))$('fFAutoPay').checked=!!e.autoPay;
    fillFixedSourceWalletSelect(e.sourceWalletId||'');
    $('btnFixed').textContent='Ενημέρωση';
    syncFixedEditSafetyUI(id);
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
  const dailyMeta=typeof capvoResolveExpenseCategoryMeta==='function'?capvoResolveExpenseCategoryMeta(e):null;
  if(typeof renderDailyCategoryOptions==='function')renderDailyCategoryOptions(dailyMeta?.categoryId||e.category||'Άλλο');
  else {$('fDC').value=e.category;syncDailyCategoryChips?.(e.category);}
  if($('fDSubcategory')){
    renderDailySubcategoryOptions?.(dailyMeta?.subcategoryId||'',dailyMeta?.categoryId||'');
    $('fDSubcategory').value=dailyMeta?.subcategoryId||'';
  }
  if($('fDMerchant'))$('fDMerchant').value=e.merchantName||e.merchant_name||'';
  if($('fDNotes'))$('fDNotes').value=e.notes||'';
  $('fDD').value=e.date;
  $('fDID').value=id;
  $('btnDaily').textContent='Ενημέρωση';

  fillPaymentSourceSelect(e.walletId||e.paymentSourceId||'', {preserveBlank:!e.walletId&&!e.paymentSourceId});
  updateDailyCreditCardOptions();
  setCardPurchaseMode(e.purchaseMode||'normal');
  const countEl=$('fDInstallments');if(countEl)countEl.value=e.installmentCount||'';
  const freeEl=$('fDInterestFree');if(freeEl)freeEl.checked=e.interestFree!==false;
  const toggle=$('interestFreeToggle');if(toggle)toggle.classList.toggle('active',e.interestFree!==false);
  const rateGroup=$('fDInstallmentRateGroup');if(rateGroup)rateGroup.style.display=(e.interestFree!==false)?'none':'block';
  updateInstallmentEstimate();

  $('fDN').focus();
}

async function saveDailyExpenseRow(userId,expense){
  const token=currentSession?.access_token;
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();

  if(!token)throw new Error('Δεν υπάρχει ενεργό session.');
  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  expense=typeof normalizeCreditCardExpensePayload==='function' ? normalizeCreditCardExpensePayload(expense) : expense;
  if(typeof capvoApplyExpenseCategoryMeta==='function')expense=capvoApplyExpenseCategoryMeta(expense);

  const row={
    id:expense.id,
    user_id:ownerUserId,
    user_chat_id:null,
    name:expense.name,
    amount:expense.amount,
    category:expense.category,
    category_id:expense.categoryId||expense.category_id||null,
    subcategory_id:expense.subcategoryId||expense.subcategory_id||null,
    merchant_name:expense.merchantName||expense.merchant_name||null,
    notes:expense.notes||null,
    date:expense.date,
    type:'daily',
    month_key:expense.date.substring(0,7),
    payment_source_id:expense.paymentSourceId||null,
    payment_source_name:expense.paymentSourceName||null,
    payment_source_type:expense.paymentSourceType||null,
    payment_account_type:expense.paymentAccountType||'cash',
    credit_card_id:expense.creditCardId||null,
    credit_card_transaction_id:expense.creditCardTransactionId||null,
    installment_plan_id:expense.installmentPlanId||null,
    affects_cash_budget:expense.affectsCashBudget!==false,
    is_credit_card_purchase:!!expense.isCreditCardPurchase,
    purchase_mode:expense.purchaseMode||'normal',
    installment_count:expense.installmentCount||null,
    interest_free:expense.interestFree!==false,
    installment_rate:expense.installmentRate||null,
    installment_amount:expense.installmentAmount||null,
    wallet_id:expense.walletId||null,
    budget_effect_amount:Object.prototype.hasOwnProperty.call(expense,'budgetEffectAmount') ? Number(expense.budgetEffectAmount)||0 : null,
    wallet_balance_effect_amount:Object.prototype.hasOwnProperty.call(expense,'walletBalanceEffectAmount') ? Number(expense.walletBalanceEffectAmount)||0 : 0
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







function setDailyCategory(categoryId){
  const el=$('fDC');
  if(el)el.value=categoryId;
  renderDailySubcategoryOptions('',categoryId);
  syncDailyCategoryUI(categoryId);
  toggleDailyCategoryMenu(false);
}


function syncDailyCategoryChips(category){
  syncDailyCategoryUI(category);
}


function updateDailyCreditCardOptions(){
  const pay=$('fDPay');
  const box=$('creditCardPurchaseOptions');
  const locked=$('lockedCardSource');
  const lockedName=$('lockedCardSourceName');
  if(!pay || !box)return;

  const source=paymentSourceById(pay.value||'');
  const isCard=typeof isCreditCardPaymentSource==='function'?isCreditCardPaymentSource(source):(source?.type==='credit_card');

  box.style.display=isCard?'grid':'none';
  box.setAttribute('aria-hidden',String(!isCard));

  if(!isCard){
    setCardPurchaseMode('normal');
  }

  if(locked && pay.disabled && isCard){
    locked.style.display='flex';
    if(lockedName)lockedName.textContent=source?.name||'Πιστωτική';
  }else if(locked){
    locked.style.display='none';
  }

  updateInstallmentEstimate();
}

function setCardPurchaseMode(mode){
  mode=mode==='installment'?'installment':'normal';
  const hidden=$('fDPurchaseMode');
  if(hidden)hidden.value=mode;

  document.querySelectorAll('#cardPurchaseTypeTabs button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.purchaseMode===mode);
  });

  const fields=$('cardInstallmentFields');
  if(fields){
    const show=mode==='installment';
    fields.hidden=!show;
    fields.classList.toggle('is-hidden',!show);
    fields.setAttribute('aria-hidden',String(!show));
    fields.style.display=show?'grid':'none';
  }

  updateInstallmentEstimate();
}

function toggleInterestFree(){
  const cb=$('fDInterestFree');
  if(!cb)return;
  cb.checked=!cb.checked;
  const btn=$('interestFreeToggle');
  if(btn)btn.classList.toggle('active',cb.checked);
  updateInstallmentEstimate();
}


function calculateInstallmentPayment(amount,count,annualRate,interestFree){
  amount=Number(amount)||0;
  count=Math.max(1,Number(count)||1);
  annualRate=Number(annualRate)||0;
  if(!amount || count<=0)return 0;
  if(interestFree || !annualRate)return capvoMoney(amount/count);
  const monthlyRate=(annualRate/100)/12;
  const payment=amount*(monthlyRate*Math.pow(1+monthlyRate,count))/(Math.pow(1+monthlyRate,count)-1);
  return capvoMoney(payment || (amount/count));
}


function updateInstallmentEstimate(){
  const mode=$('fDPurchaseMode')?.value||'normal';
  const estimate=$('installmentEstimate');
  const rateNote=$('fDInstallmentRateAutoNote');
  const rateInput=$('fDInstallmentRate');
  if(!estimate)return;

  if(mode!=='installment'){
    estimate.style.display='none';
    if(rateNote)rateNote.style.display='none';
    return;
  }

  const amount=Number($('fDA')?.value)||0;
  const count=Number($('fDInstallments')?.value)||0;
  const interestFree=$('fDInterestFree')?.checked!==false;
  const autoRate=getSelectedCreditCardRate();
  if(rateInput)rateInput.value=String(autoRate||0);

  if(rateNote){
    rateNote.textContent=interestFree
      ? 'Άτοκες δόσεις: το ποσό μοιράζεται ισόποσα ανά μήνα.'
      : 'Η εκτίμηση γίνεται αυτόματα με το επιτόκιο της κάρτας ('+(autoRate||0)+'%).';
    rateNote.style.display='block';
  }

  if(!amount || !count){
    estimate.style.display='none';
    return;
  }

  const value=calculateInstallmentPayment(amount,count,autoRate,interestFree);
  const el=$('installmentEstimateValue');
  if(el)el.textContent=fmt(value)+' / μήνα';
  estimate.style.display='flex';
}


document.addEventListener('change',e=>{
  if(e.target && e.target.id==='fDPay')updateDailyCreditCardOptions();
  if(e.target && ['fDInstallments','fDInstallmentRate'].includes(e.target.id))updateInstallmentEstimate();
  if(e.target && e.target.id==='fDC'){renderDailySubcategoryOptions('',e.target.value);syncDailyCategoryUI(e.target.value);}
});

document.addEventListener('input',e=>{
  if(e.target && ['fDA','fDInstallments','fDInstallmentRate'].includes(e.target.id))updateInstallmentEstimate();
});


function makeCreditCardExpensePayload(base,paymentSource){
  const isCard=typeof isCreditCardPaymentSource==='function'?isCreditCardPaymentSource(paymentSource):(paymentSource?.type==='credit_card');
  const mode=$('fDPurchaseMode')?.value||'normal';
  const installments=Math.max(1,Number($('fDInstallments')?.value)||1);
  const interestFree=$('fDInterestFree')?.checked!==false;
  const cardRate=isCard ? (Number(window.cardById?.(paymentSource?.id||base.paymentSourceId)?.rate)||0) : 0;
  const installmentRate=!interestFree?cardRate:0;
  const installmentAmount=isCard && mode==='installment'
    ? calculateInstallmentPayment(base.amount,installments,installmentRate,interestFree)
    : null;

  return normalizeCreditCardExpensePayload({
    ...base,
    paymentAccountType:isCard?'credit_card':(base.paymentSourceId?'restricted_balance':'cash'),
    creditCardId:isCard?paymentSource.id:'',
    affectsCashBudget:!isCard && !base.paymentSourceId,
    isCreditCardPurchase:!!isCard,
    purchaseMode:isCard?mode:'normal',
    installmentCount:isCard && mode==='installment'?installments:null,
    interestFree:isCard?interestFree:true,
    installmentRate:isCard && mode==='installment' && !interestFree?installmentRate:0,
    installmentAmount
  });
}

function normalizeCreditCardExpensePayload(expense){
  if(!expense)return expense;
  const source=typeof paymentSourceById==='function' ? paymentSourceById(expense.paymentSourceId||expense.creditCardId||'') : null;
  const isCard=typeof isCreditCardPaymentSource==='function'
    ? isCreditCardPaymentSource(source)
    : (source?.type==='credit_card' || source?.accountType==='credit_card');

  if(!isCard){
    const isWallet=!!(expense.walletId || (source && typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source)));
    return {
      ...expense,
      paymentAccountType:isWallet?'cash':(expense.paymentAccountType || (expense.paymentSourceId?'restricted_balance':'cash')),
      affectsCashBudget:isWallet?(expense.affectsCashBudget!==false):(expense.affectsCashBudget!==false && !expense.paymentSourceId),
      isCreditCardPurchase:false
    };
  }

  const cardId=source?.id || expense.creditCardId || expense.paymentSourceId;
  const mode=expense.purchaseMode==='installment'?'installment':'normal';
  return {
    ...expense,
    paymentSourceId:expense.paymentSourceId || cardId,
    paymentSourceName:expense.paymentSourceName || source?.name || '',
    paymentSourceType:expense.paymentSourceType || 'card',
    paymentAccountType:'credit_card',
    creditCardId:cardId,
    affectsCashBudget:false,
    isCreditCardPurchase:true,
    purchaseMode:mode,
    interestFree:expense.interestFree!==false
  };
}


function applyCreditCardPurchaseBalance(expense,oldExpense=null){
  const oldIsCard=!!(oldExpense && (oldExpense.isCreditCardPurchase || oldExpense.paymentAccountType==='credit_card'));
  const newIsCard=!!(expense && (expense.isCreditCardPurchase || expense.paymentAccountType==='credit_card'));

  if(oldIsCard && oldExpense.purchaseMode!=='installment'){
    const oldCard=cardById(oldExpense.creditCardId||oldExpense.paymentSourceId);
    if(oldCard)oldCard.balance=capvoMoney(Math.max(0,(Number(oldCard.balance)||0)-(Number(oldExpense.amount)||0)));
  }

  if(newIsCard && expense.purchaseMode!=='installment'){
    const card=cardById(expense.creditCardId||expense.paymentSourceId);
    if(card)card.balance=capvoMoney((Number(card.balance)||0)+(Number(expense.amount)||0));
  }
}

function capvoAddMonths(dateStr,months){
  const d=dateStr?new Date(dateStr+'T00:00:00'):new Date();
  d.setMonth(d.getMonth()+months);
  return typeof capvoLocalDateKey==='function'?capvoLocalDateKey(d):d.toLocaleDateString('en-CA');
}

async function persistCreditCardBalanceForPurchase(userId,expense){
  if(!expense?.isCreditCardPurchase || expense.purchaseMode==='installment')return;
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();
  if(!ownerUserId)return;

  const card=cardById(expense.creditCardId||expense.paymentSourceId);
  if(!card)return;

  const {error}=await supabaseClient
    .from('credit_cards')
    .update({
      balance:Number(card.balance)||0,
      updated_at:new Date().toISOString()
    })
    .eq('id',card.id)
    .eq('user_id',ownerUserId);

  if(error)throw error;
}

async function saveCreditCardPurchaseSideEffects(userId,expense){
  expense=normalizeCreditCardExpensePayload(expense);
  if(!expense?.isCreditCardPurchase)return;

  const ownerUserId=String(userId || getDataOwnerId() || '').trim();
  if(!ownerUserId)return;

  const cardId=expense.creditCardId||expense.paymentSourceId;
  const txId=expense.creditCardTransactionId || ('cc_tx_'+expense.id);
  const isInstallment=expense.purchaseMode==='installment';

  let planId=expense.installmentPlanId||'';
  if(isInstallment && !planId){
    planId='cc_plan_'+expense.id;
    expense.installmentPlanId=planId;
  }

  const tx={
    id:txId,
    user_id:ownerUserId,
    card_id:cardId,
    expense_id:expense.id,
    installment_plan_id:planId||null,
    type:isInstallment?'installment_purchase':'purchase',
    amount:expense.amount,
    transaction_date:expense.date,
    description:expense.name,
    category:expense.category,
    affects_budget:false,
    budget_effect_type:'card_purchase_tracked',
    updated_at:new Date().toISOString()
  };

  const {error:txErr}=await supabaseClient
    .from('credit_card_transactions')
    .upsert(tx,{onConflict:'id'});
  if(txErr)throw txErr;

  expense.creditCardTransactionId=txId;

  if(!Array.isArray(D.creditCardTransactions))D.creditCardTransactions=[];
  const txLocal={
    id:txId,
    cardId,
    expenseId:expense.id,
    installmentPlanId:planId,
    type:tx.type,
    amount:Number(expense.amount)||0,
    transactionDate:expense.date,
    description:expense.name,
    category:expense.category,
    affectsBudget:false,
    budgetEffectType:'card_purchase_tracked'
  };
  const ix=D.creditCardTransactions.findIndex(x=>x.id===txId);
  if(ix>=0)D.creditCardTransactions[ix]=txLocal;else D.creditCardTransactions.unshift(txLocal);

  if(isInstallment){
    const count=Math.max(1,Number(expense.installmentCount)||1);
    const card=cardById(cardId);
    const installmentAmount=expense.installmentAmount || calculateInstallmentPayment(expense.amount,count,expense.installmentRate||0,expense.interestFree!==false);
    let firstDue=capvoAddMonths(expense.date,1);
    const dueDay=Number(card?.paymentDueDay)||0;
    if(dueDay>=1 && dueDay<=31){
      const d=new Date(firstDue+'T00:00:00');
      d.setDate(Math.min(dueDay,28));
      firstDue=typeof capvoLocalDateKey==='function'?capvoLocalDateKey(d):d.toLocaleDateString('en-CA');
    }

    const plan={
      id:planId,
      user_id:ownerUserId,
      card_id:cardId,
      original_expense_id:expense.id,
      original_transaction_id:txId,
      title:expense.name,
      category:expense.category,
      total_amount:expense.amount,
      installment_count:count,
      installment_amount:installmentAmount,
      paid_installments:0,
      first_due_date:firstDue,
      next_due_date:firstDue,
      interest_free:expense.interestFree!==false,
      interest_rate:expense.interestFree===false ? (Number(expense.installmentRate)||Number(cardById(cardId)?.rate)||0) : null,
      affects_budget_mode:'installment_only',
      status:'active',
      updated_at:new Date().toISOString()
    };

    const {error:planErr}=await supabaseClient
      .from('credit_card_installment_plans')
      .upsert(plan,{onConflict:'id'});
    if(planErr)throw planErr;

    const items=[];
    for(let i=1;i<=count;i++){
      items.push({
        id:`${planId}_item_${i}`,
        user_id:ownerUserId,
        plan_id:planId,
        card_id:cardId,
        installment_no:i,
        due_date:capvoAddMonths(firstDue,i-1),
        amount:installmentAmount,
        status:'pending',
        updated_at:new Date().toISOString()
      });
    }

    const {error:itemsErr}=await supabaseClient
      .from('credit_card_installment_items')
      .upsert(items,{onConflict:'id'});
    if(itemsErr)throw itemsErr;

    if(!Array.isArray(D.creditCardInstallmentPlans))D.creditCardInstallmentPlans=[];
    if(!Array.isArray(D.creditCardInstallmentItems))D.creditCardInstallmentItems=[];
    const localPlan={
      id:planId,cardId,originalExpenseId:expense.id,originalTransactionId:txId,
      title:expense.name,category:expense.category,totalAmount:Number(expense.amount)||0,
      installmentCount:count,installmentAmount,paidInstallments:0,
      firstDueDate:firstDue,nextDueDate:firstDue,interestFree:expense.interestFree!==false,
      interestRate:expense.interestFree===false ? (Number(expense.installmentRate)||Number(cardById(cardId)?.rate)||0) : 0,
      affectsBudgetMode:'installment_only',status:'active'
    };
    const pix=D.creditCardInstallmentPlans.findIndex(x=>x.id===planId);
    if(pix>=0)D.creditCardInstallmentPlans[pix]=localPlan;else D.creditCardInstallmentPlans.push(localPlan);

    D.creditCardInstallmentItems=D.creditCardInstallmentItems.filter(x=>x.planId!==planId)
      .concat(items.map(i=>({
        id:i.id,planId,cardId,installmentNo:i.installment_no,dueDate:i.due_date,amount:Number(i.amount)||0,status:'pending'
      })));
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
  if(typeof capvoPrimaryBudgetWallet==='function'){
    const w=capvoPrimaryBudgetWallet();
    if(w && (Number(w.cycleIncomeAmount)||0)>0)return true;
  }
  return (D.incomeSources||[]).some(i=>i.includeInBudget && (Number(i.amount)||0)>0 && (typeof capvoInferMoneySourceType==='function'?capvoInferMoneySourceType(i)!=='budget_cycle':true));
}

function expenseUsesRestrictedSource(expense){
  const source=paymentSourceById(expense?.paymentSourceId||'');
  if(typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source))return false;
  return !!(source && source.restriction && source.restriction!=='none');
}

function projectedRestrictedRemainingAfterExpense(expense,{editing=false}={}){
  const source=paymentSourceById(expense?.paymentSourceId||'');

  if(!source || (typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source)) || !source.restriction || source.restriction==='none'){
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
    if(old && (typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(old):!old.paymentSourceId)){
      currentCashDaily-=Number(old.amount)||0;
    }
  }

  const newCashDaily=(typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(expense):!expense?.paymentSourceId)
    ? currentCashDaily+(Number(expense.amount)||0)
    : currentCashDaily;

  return (Number(D.income)||0)-fixedTotal()-ccPayTotal()-newCashDaily;
}


function capvoNormalizeCategoryValue(value){
  return String(value||'')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');
}

function validateRestrictedSourceCategory(expense){
  const source=typeof paymentSourceById==='function'
    ? paymentSourceById(expense?.paymentSourceId||'')
    : null;

  if(!source)return {ok:true,source:null,allowed:[]};
  if(typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source))return {ok:true,source,allowed:[]};
  if(!(typeof isRestrictedPaymentSource==='function'
    ? isRestrictedPaymentSource(source)
    : (source.restriction && source.restriction!=='none'))){
    return {ok:true,source,allowed:[]};
  }

  const allowed=typeof restrictedCategoriesFor==='function'
    ? restrictedCategoriesFor(source)
    : [];

  // Some restricted sources, such as card_only/voucher balances, do not have a
  // category restriction yet; they are only limited by their available balance.
  if(!Array.isArray(allowed) || allowed.length===0)return {ok:true,source,allowed:[]};

  const categoryKey=capvoNormalizeCategoryValue(expense?.category||'');
  const allowedKeys=allowed.map(capvoNormalizeCategoryValue);
  const ok=allowedKeys.includes(categoryKey);

  return {ok,source,allowed};
}


function capvoDailyExpenseSourceFor(expense){
  return typeof paymentSourceById==='function' ? paymentSourceById(expense?.paymentSourceId||expense?.walletId||'') : null;
}

function capvoDailyExpenseDefaultWallet(){
  const wallets=typeof capvoDailyExpenseEligibleWallets==='function' ? capvoDailyExpenseEligibleWallets() : [];
  const def=typeof capvoDefaultWallet==='function'?capvoDefaultWallet():null;
  return (def && wallets.find(w=>String(w.id)===String(def.id))) || wallets[0] || null;
}

function capvoExpenseIsCreditCardLike(expense,source=null){
  return !!(
    (source && typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source)) ||
    expense?.isCreditCardPurchase || expense?.is_credit_card_purchase ||
    expense?.paymentAccountType==='credit_card' || expense?.payment_account_type==='credit_card' ||
    expense?.creditCardId || expense?.credit_card_id || expense?.installmentPlanId || expense?.installment_plan_id
  );
}

function capvoPrepareDailyExpenseFunding(expense,{preserveBlank=false}={}){
  if(!expense)return expense;
  let source=capvoDailyExpenseSourceFor(expense);
  const hasWalletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();

  // New cash/manual expenses should use a real wallet by default when wallets exist.
  if(!source && !expense.paymentSourceId && !expense.walletId && hasWalletModel && !preserveBlank){
    source=capvoDailyExpenseDefaultWallet();
    if(source){
      expense.paymentSourceId=source.id;
    }
  }

  if(source && typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source)){
    const wallet=typeof capvoWalletById==='function'?capvoWalletById(source.id):source;
    expense.walletId=wallet?.id||source.id;
    expense.paymentSourceId=wallet?.id||source.id;
    expense.paymentSourceName=wallet?.name||source.name||'Wallet';
    expense.paymentSourceType='wallet';
    expense.paymentAccountType='cash';
    expense.affectsCashBudget=true;
    expense.isCreditCardPurchase=false;
    expense.creditCardId='';
    expense.walletBalanceEffectAmount=-(Number(expense.amount)||0);
    expense.budgetEffectAmount=Number(expense.amount)||0;
    return expense;
  }

  if(capvoExpenseIsCreditCardLike(expense,source)){
    expense.walletId=null;
    expense.walletBalanceEffectAmount=0;
    expense.budgetEffectAmount=0;
    return expense;
  }

  if(source){
    // Ticket/Voucher/income-source balances are virtual restricted sources for now.
    expense.walletId=null;
    expense.paymentSourceId=source.id;
    expense.paymentSourceName=source.name||expense.paymentSourceName||'';
    expense.paymentSourceType=source.incomeType||expense.paymentSourceType||'';
    expense.paymentAccountType='restricted_balance';
    expense.affectsCashBudget=false;
    expense.walletBalanceEffectAmount=0;
    expense.budgetEffectAmount=0;
    return expense;
  }

  expense.walletId=null;
  expense.paymentAccountType='cash';
  expense.affectsCashBudget=true;
  expense.walletBalanceEffectAmount=0;
  expense.budgetEffectAmount=Number(expense.amount)||0;
  return expense;
}

function capvoDailyExpenseAppliedWalletAmount(expense){
  const effect=Number(expense?.walletBalanceEffectAmount ?? expense?.wallet_balance_effect_amount)||0;
  return effect<0 ? Math.abs(effect) : 0;
}

function capvoValidateDailyExpenseWalletBalance(expense,{editing=false}={}){
  if(!expense || capvoExpenseIsCreditCardLike(expense))return {ok:true};
  const walletId=expense.walletId||'';
  if(!walletId)return {ok:true};
  const wallet=typeof capvoWalletById==='function'?capvoWalletById(walletId):null;
  if(!wallet)return {ok:false,message:'Δεν βρέθηκε το wallet πληρωμής.'};
  if(typeof capvoDailyExpenseIsSavingsWallet==='function' && capvoDailyExpenseIsSavingsWallet(wallet)){
    return {ok:false,message:'Δεν μπορείς να πληρώσεις έξοδο από αποταμιευτικό wallet.'};
  }

  const amount=Number(expense.amount)||0;
  let available=Number(wallet.currentBalance)||0;

  if(editing){
    const old=typeof getExistingDailyExpenseById==='function'?getExistingDailyExpenseById(expense.id):null;
    if(old && String(old.walletId||'')===String(walletId)){
      available+=capvoDailyExpenseAppliedWalletAmount(old);
    }
  }

  if(available-amount<0){
    const missing=Math.abs(available-amount);
    return {
      ok:false,
      message:`Το wallet "${wallet.name||'Wallet'}" δεν έχει αρκετά χρήματα. Διαθέσιμο: ${fmt(available)}. Λείπουν ${fmt(missing)}.`
    };
  }

  return {ok:true,wallet,available};
}

async function capvoApplyDailyExpenseWalletEffects(userId,newExpense=null,oldExpense=null){
  const ownerUserId=String(userId || getDataOwnerId?.() || '').trim();
  if(!ownerUserId)return {applied:false,rollback:async()=>{}};

  const deltas=new Map();
  const addDelta=(walletId,delta)=>{
    if(!walletId || !delta)return;
    deltas.set(String(walletId),(deltas.get(String(walletId))||0)+Number(delta));
  };

  if(oldExpense){
    const oldAmount=capvoDailyExpenseAppliedWalletAmount(oldExpense);
    if(oldAmount>0)addDelta(oldExpense.walletId,oldAmount);
  }

  if(newExpense && newExpense.walletId && !capvoExpenseIsCreditCardLike(newExpense)){
    const amount=Number(newExpense.amount)||0;
    if(amount>0)addDelta(newExpense.walletId,-amount);
  }

  const ops=[...deltas.entries()].filter(([,delta])=>Math.abs(delta)>0.0001);
  if(!ops.length)return {applied:false,rollback:async()=>{}};

  const before=new Map();
  for(const [walletId,delta] of ops){
    const wallet=typeof capvoWalletById==='function'?capvoWalletById(walletId):null;
    if(!wallet)throw new Error('Δεν βρέθηκε wallet για την κίνηση.');
    if(typeof capvoDailyExpenseIsSavingsWallet==='function' && capvoDailyExpenseIsSavingsWallet(wallet)){
      throw new Error('Δεν μπορείς να πληρώσεις έξοδο από αποταμιευτικό wallet.');
    }
    const current=Number(wallet.currentBalance)||0;
    const next=capvoMoney(current+delta);
    if(next<0){
      throw new Error(`Το wallet "${wallet.name||'Wallet'}" δεν έχει αρκετά χρήματα. Διαθέσιμο: ${fmt(current)}.`);
    }
    before.set(walletId,current);
  }

  const updated=[];
  try{
    for(const [walletId,delta] of ops){
      const current=before.get(walletId);
      const next=capvoMoney(current+delta);
      await capvoUpdateWalletBalance(walletId,next);
      updated.push(walletId);
    }
  }catch(e){
    for(const walletId of updated.reverse()){
      try{await capvoUpdateWalletBalance(walletId,before.get(walletId));}catch(rollbackErr){console.error('daily wallet rollback failed:',rollbackErr);}
    }
    throw e;
  }

  return {
    applied:true,
    rollback:async()=>{
      for(const walletId of updated.reverse()){
        try{await capvoUpdateWalletBalance(walletId,before.get(walletId));}catch(rollbackErr){console.error('daily wallet rollback failed:',rollbackErr);}
      }
    }
  };
}

async function capvoRestoreDailyExpenseWalletEffect(expense){
  return capvoApplyDailyExpenseWalletEffects(getDataOwnerId?.(),null,expense);
}

