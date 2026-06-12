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

function syncDailyCategoryUI(category){
  const current=category||$('fDC')?.value||'Άλλο';
  const label=$('dailyCategoryCurrent');
  if(label)label.textContent=current;
  const helper=$('dailyCategoryTriggerLabel');
  if(helper)helper.textContent='Επίλεξε κατηγορία';
  document.querySelectorAll('#dailyCategoryMenu button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.category===current);
  });
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
    $('fDD').value=new Date().toISOString().split('T')[0];
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
    syncDailyCategoryUI('Άλλο');
    toggleDailyCategoryMenu(false);

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
    if(typeof applyIncomePreset==='function')applyIncomePreset('salary');
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
  syncDailyCategoryChips?.(e.category);
  $('fDD').value=e.date;
  $('fDID').value=id;
  $('btnDaily').textContent='Ενημέρωση';

  fillPaymentSourceSelect(e.paymentSourceId||'');
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
    installment_amount:expense.installmentAmount||null
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







function setDailyCategory(category){
  const el=$('fDC');
  if(el)el.value=category;
  syncDailyCategoryUI(category);
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
  if(e.target && e.target.id==='fDC')syncDailyCategoryUI(e.target.value);
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

  if(!isCard)return {
    ...expense,
    paymentAccountType:expense.paymentAccountType || (expense.paymentSourceId?'restricted_balance':'cash'),
    affectsCashBudget:expense.affectsCashBudget!==false && !expense.paymentSourceId,
    isCreditCardPurchase:false
  };

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
  return d.toISOString().split('T')[0];
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
      firstDue=d.toISOString().split('T')[0];
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
  return (D.incomeSources||[]).some(i=>i.includeInBudget && (Number(i.amount)||0)>0);
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

  const restrictedCategoryCheck=validateRestrictedSourceCategory(expense);
  if(!restrictedCategoryCheck.ok){
    return fail(
      `Η πηγή ${restrictedCategoryCheck.source?.name||'πληρωμής'} χρησιμοποιείται μόνο για: ${restrictedCategoryCheck.allowed.join(', ')}.`
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

  if(typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(expense):!expense?.paymentSourceId){
    const projected=projectedNormalBudgetAfterExpense(expense,{editing});

    if(projected<0){
      const proceed=await showConfirmModal({
        title:'Υπέρβαση ορίου εξόδων',
        message:`Με αυτή την καταχώρηση ξεπερνάς το διαθέσιμο budget κατά ${fmt(Math.abs(projected))}. Το όριο είναι προειδοποιητικό, όχι μπλοκάρισμα. Θέλεις να συνεχίσεις;`,
        confirmText:'Συνέχεια καταχώρησης',
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
  const payEl=$('fDPay');
  let paymentSourceId=payEl?.value||'';
  const lockedCardId=payEl?.dataset?.lockedCardId || window.capvoLockedCardPurchaseId || '';
  if(!paymentSourceId && lockedCardId)paymentSourceId=lockedCardId;
  const paymentSource=paymentSourceById(paymentSourceId);
  const userId=getDataOwnerId();
  const btn=$('btnDaily');

  if(btn?.dataset?.saving==='1')return;

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
    expense=makeCreditCardExpensePayload({
      id,
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    },paymentSource);
  }else{
    expense=makeCreditCardExpensePayload({
      id:gid(),
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    },paymentSource);
  }

  const oldExpense=id?getExistingDailyExpenseById(id):null;

  const limitValidation=validateCreditCardAvailableLimit(expense,oldExpense);
  if(!limitValidation.ok){
    showMiniToast('❌ Το ποσό ξεπερνά το διαθέσιμο όριο της κάρτας ('+fmt(limitValidation.available)+').','error');
    $('fDA')?.focus();
    return;
  }

  if(btn){
    btn.disabled=true;
    btn.dataset.saving='1';
    btn.textContent='Αποθήκευση...';
  }

  const canSave=await validateExpenseBeforeSave(expense,{editing:!!id});
  if(!canSave){
    if(btn){
      btn.disabled=false;
      btn.dataset.saving='0';
      btn.textContent='Αποθήκευση';
    }
    return;
  }

  applyCreditCardPurchaseBalance(expense,oldExpense);

  if(id){
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(e=>e.id!==id);
    });
  }

  D.months[monthKey].daily.push(expense);

  try{
    await saveDailyExpenseRow(userId,expense);
    await saveCreditCardPurchaseSideEffects(userId,expense);
    await persistCreditCardBalanceForPurchase(userId,expense);
    await saveDailyExpenseRow(userId,expense);

    closeM();
    render();

    const isCardPurchase=!!(expense.isCreditCardPurchase || expense.paymentAccountType==='credit_card' || paymentSource?.accountType==='credit_card');
    if(isCardPurchase){
      showMiniToast?.(id?'✅ Η αγορά κάρτας ενημερώθηκε':'✅ Η αγορά με πιστωτική καταχωρήθηκε');
    }else{
      showMiniToast?.(id?'✅ Η κίνηση ενημερώθηκε':'✅ Η κίνηση καταχωρήθηκε');
    }

  }catch(e){
    console.error('saveDaily failed:',e);
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.dataset.saving='0';
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


function validateFixedExpenseBudgetLimit(fixedExpenseId,amount){
  const value=capvoMoney(Number(amount)||0);
  const budget=capvoMoney(typeof budgetIncomeTotal==='function' ? budgetIncomeTotal() : (Number(D.income)||0));

  if(budget<=0){
    return {
      ok:false,
      available:0,
      message:'Πρόσθεσε πρώτα διαθέσιμο budget πριν καταχωρήσεις πάγιο έξοδο.'
    };
  }

  const currentId=String(fixedExpenseId||'');
  const otherFixed=capvoMoney((D.fixedExpenses||[])
    .filter(x=>String(x.id||'')!==currentId)
    .reduce((sum,x)=>sum+(Number(x.amount)||0),0));

  const cardPayments=capvoMoney(typeof ccPayTotal==='function' ? ccPayTotal() : 0);
  const budgetMovements=capvoMoney(typeof dailyCashTotal==='function' ? dailyCashTotal() : 0);
  const available=capvoMoney(Math.max(0,budget-otherFixed-cardPayments-budgetMovements));

  if(value>available+0.004){
    return {
      ok:false,
      available,
      message:`Το πάγιο ξεπερνά το διαθέσιμο budget. Διαθέσιμα για πάγια: ${typeof fmt==='function'?fmt(available):available+'€'}.`
    };
  }

  return {ok:true,available};
}

async function saveFixed(){
  const n=$('fFN').value.trim();
  const a=parseFloat($('fFA').value);
  const id=$('fFID').value;
  const category=$('fFC').value;
  const userId=getDataOwnerId();
  const btn=$('btnFixed');

  if(btn?.dataset?.saving==='1')return;

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

  const fixedBudgetCheck=validateFixedExpenseBudgetLimit(id,a);
  if(!fixedBudgetCheck.ok){
    $('fFA').style.borderColor='var(--red)';
    showMiniToast(fixedBudgetCheck.message,'error');
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
      category,
      createdAt:typeof todayISO==='function'?todayISO():new Date().toISOString().split('T')[0]
    };

    D.fixedExpenses.push(expense);
  }

  if(!expense)return;

  try{
    if(btn){
      btn.disabled=true;
      btn.dataset.saving='1';
      btn.textContent='Αποθήκευση...';
    }

    await saveFixedExpenseRow(userId,expense);

    D.fixedExpenses=(D.fixedExpenses||[])
      .slice()
      .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a));

    closeM();
    render();

    showMiniToast?.(id?'✅ Το πάγιο ενημερώθηκε':'✅ Το πάγιο αποθηκεύτηκε');

  }catch(e){
    console.error('saveFixed failed:',e);
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.dataset.saving='0';
      btn.textContent='Αποθήκευση';
    }
  }
}



function findCreditCardExpensePlan(expense){
  if(!expense)return null;
  const planId=expense.installmentPlanId||'';
  if(planId)return (D.creditCardInstallmentPlans||[]).find(p=>String(p.id)===String(planId))||null;
  return (D.creditCardInstallmentPlans||[]).find(p=>String(p.originalExpenseId||'')===String(expense.id))||null;
}


function capvoHasCardPaymentAfterExpense(expense){
  if(!expense)return false;
  const cardId=String(expense.creditCardId||expense.paymentSourceId||'');
  if(!cardId)return false;
  const expenseDate=normalizeDateValue(expense.date||expense.createdAt||expense.created_at||todayISO())||todayISO();

  return (D.creditCardTransactions||[]).some(t=>{
    const txCardId=String(t.cardId||t.card_id||'');
    if(txCardId!==cardId)return false;
    const isPayment=String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment';
    if(!isPayment)return false;
    const txDate=normalizeDateValue(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO())||todayISO();
    return txDate>=expenseDate;
  });
}

function capvoCardDeletionHasReconciliationRisk(expense,plan){
  if(!expense)return false;

  if(plan){
    const paidAmount=typeof capvoPlanPaidAmount==='function'
      ? capvoPlanPaidAmount(plan)
      : (Number(plan.paidInstallments)||0)*(Number(plan.installmentAmount)||0);
    if(paidAmount>0)return true;

    if(typeof capvoLegacyUnallocatedPlanPaymentForCard==='function' && capvoLegacyUnallocatedPlanPaymentForCard(plan.cardId)>0){
      return true;
    }
  }

  return capvoHasCardPaymentAfterExpense(expense);
}

async function deleteCreditCardExpenseSideEffects(expense){
  if(!expense || !(expense.isCreditCardPurchase || expense.paymentAccountType==='credit_card'))return;

  const ownerUserId=String(getDataOwnerId?.()||'').trim();
  const cardId=expense.creditCardId||expense.paymentSourceId||'';
  const card=cardById?.(cardId);
  const isInstallment=expense.purchaseMode==='installment' || !!expense.installmentPlanId;
  const plan=findCreditCardExpensePlan(expense);
  const txId=expense.creditCardTransactionId || plan?.originalTransactionId || ('cc_tx_'+expense.id);

  if(capvoCardDeletionHasReconciliationRisk(expense,plan)){
    throw new Error('Δεν μπορείς να διαγράψεις αγορά κάρτας που έχει ήδη σχετικές πληρωμές. Κάνε πρώτα αναίρεση/διόρθωση της πληρωμής από την κάρτα.');
  }

  if(ownerUserId && typeof supabaseClient!=='undefined'){
    if(plan?.id){
      await supabaseClient.from('credit_card_installment_items').delete().eq('plan_id',plan.id).eq('user_id',ownerUserId);
      await supabaseClient.from('credit_card_installment_plans').delete().eq('id',plan.id).eq('user_id',ownerUserId);
    }else if(expense.installmentPlanId){
      await supabaseClient.from('credit_card_installment_items').delete().eq('plan_id',expense.installmentPlanId).eq('user_id',ownerUserId);
      await supabaseClient.from('credit_card_installment_plans').delete().eq('id',expense.installmentPlanId).eq('user_id',ownerUserId);
    }

    if(txId){
      await supabaseClient.from('credit_card_transactions').delete().eq('id',txId).eq('user_id',ownerUserId);
    }
    await supabaseClient.from('credit_card_transactions').delete().eq('expense_id',expense.id).eq('user_id',ownerUserId);
  }

  if(!isInstallment && card){
    card.balance=capvoMoney(Math.max(0,(Number(card.balance)||0)-(Number(expense.amount)||0)));

    if(ownerUserId && typeof supabaseClient!=='undefined'){
      const {error}=await supabaseClient
        .from('credit_cards')
        .update({balance:Number(card.balance)||0,updated_at:new Date().toISOString()})
        .eq('id',card.id)
        .eq('user_id',ownerUserId);
      if(error)throw error;
    }
  }

  if(plan?.id){
    D.creditCardInstallmentPlans=(D.creditCardInstallmentPlans||[]).filter(p=>String(p.id)!==String(plan.id));
    D.creditCardInstallmentItems=(D.creditCardInstallmentItems||[]).filter(i=>String(i.planId)!==String(plan.id));
  }

  D.creditCardTransactions=(D.creditCardTransactions||[]).filter(t=>{
    if(txId && String(t.id)===String(txId))return false;
    if(String(t.expenseId||'')===String(expense.id))return false;
    if(plan?.id && String(t.installmentPlanId||'')===String(plan.id))return false;
    return true;
  });
}

async function deleteCreditCardExpenseSideEffectsForIds(ids){
  for(const id of ids||[]){
    const expense=typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
    if(expense)await deleteCreditCardExpenseSideEffects(expense);
  }
}

async function deleteExpenseRow(type,id){
  if(type==='daily'){
    const expense=typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
    if(expense)await deleteCreditCardExpenseSideEffects(expense);
  }
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

  const expense=typeof normalizeCreditCardExpensePayload==='function'
    ? normalizeCreditCardExpensePayload({
        id:gid(),
        name:parsed.name || 'Έξοδο',
        amount:Number(parsed.amount)||0,
        category:parsed.category || 'Άλλο',
        date:parsed.date||new Date().toISOString().split('T')[0],
        paymentSourceId:parsed.paymentSourceId||'',
        paymentSourceName:parsed.paymentSourceName||'',
        paymentSourceType:parsed.paymentSourceType||''
      })
    : {
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
    if(typeof saveCreditCardPurchaseSideEffects==='function')await saveCreditCardPurchaseSideEffects(userId,expense);
    if(typeof persistCreditCardBalanceForPurchase==='function')await persistCreditCardBalanceForPurchase(userId,expense);
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
  showAuthLoader();

  const redirectTo=window.location.origin+window.location.pathname;

  const {error}=await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo,
      queryParams:{
        access_type:'offline',
        prompt:'select_account'
      }
    }
  });

  if(error){
    clearAuthLoader();
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


function showAuthLoader(){
  document.body.classList.add('auth-pending');

  const auth=$('authScreen');
  const err=$('authError');

  if(auth){
    auth.classList.remove('auth-hidden');
    auth.classList.add('capvo-auth-loading');
    auth.style.display='flex';
    auth.style.pointerEvents='auto';
    auth.style.opacity='1';
    auth.style.visibility='visible';
    auth.style.zIndex='9999';
  }

  if(err)err.textContent='';
}

function clearAuthLoader(){
  const auth=$('authScreen');
  if(auth)auth.classList.remove('capvo-auth-loading');
}

function showApp(){
  clearAuthLoader();

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


function cancelTelegramLinkFlow(){
  changingTelegramId=false;

  const cameFromWizard=!!window.__capvoTelegramFromWizardFinish;
  window.__capvoTelegramFromWizardFinish=false;

  const chatInput=$('chatIdInput');
  const codeInput=$('telegramCodeInput');
  const err=$('authError');

  if(chatInput)chatInput.value='';
  if(codeInput)codeInput.value='';
  if(err)err.textContent='';

  renderAuthState();
  hideAuth();

  if(cameFromWizard && typeof showCapvoOnboardingCompletion==='function'){
    showCapvoOnboardingCompletion();
    return;
  }

  try{
    if(currentUser){
      go('vDash',document.querySelector('[data-v="vDash"]'));
    }
  }catch(e){}
}

function capvoEnsureTelegramLinkTopbar(){
  const box=$('telegramLinkBox');
  if(!box)return;

  let topbar=box.querySelector('.capvo-telegram-option-b-topbar');
  if(!topbar){
    topbar=document.createElement('div');
    topbar.className='capvo-telegram-option-b-topbar';
    box.prepend(topbar);
  }

  const label=window.__capvoTelegramFromWizardFinish ? 'Πίσω στο τέλος' : 'Ακύρωση';
  topbar.innerHTML=`
    <button type="button" class="capvo-telegram-single-exit-btn" onclick="cancelTelegramLinkFlow()">${label}</button>
  `;
}

function capvoEnsureTelegramOptionBVisual(){
  const box=$('telegramLinkBox');
  if(!box || box.querySelector('.capvo-telegram-option-b-orb'))return;

  const userBox=$('authUserBox');
  const orb=document.createElement('div');
  orb.className='capvo-telegram-option-b-orb';
  orb.setAttribute('aria-hidden','true');
  orb.innerHTML='<span></span>';

  const hero=box.querySelector('.capvo-wizard-hero');
  if(hero){
    hero.parentNode.insertBefore(orb, hero);
  }else if(userBox){
    userBox.insertAdjacentElement('afterend', orb);
  }else{
    box.prepend(orb);
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

  capvoEnsureTelegramLinkTopbar();
  capvoEnsureTelegramOptionBVisual();

  const forceTelegramTop=()=>{
    const auth=$('authScreen');
    const card=auth?.querySelector?.('.capvo-auth-card');
    const box=$('telegramLinkBox');
    try{
      window.scrollTo({top:0,left:0,behavior:'auto'});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      if(auth)auth.scrollTop=0;
      if(card)card.scrollTop=0;
      if(box)box.scrollTop=0;
    }catch(e){}
  };
  requestAnimationFrame(forceTelegramTop);
  setTimeout(forceTelegramTop,80);

  if(userBox){
    userBox.innerHTML=`
      <span>Google λογαριασμός</span>
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
  clearAuthLoader();

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

  // Avoid auto-focus on Telegram linking screens, especially mobile.
  // Focusing the Chat ID field opens the keyboard and scrolls the card to the lower inputs.
  if(input && !changingTelegramId){
    setTimeout(()=>input.focus(),80);
  }
}

function hideAuth(){
  clearAuthLoader();

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


function capvoShouldOpenOnboardingBeforeDashboard(){
  try{
    const prefs=D.preferences||{};
    if(prefs.onboardingCompleted || prefs.onboardingDismissed)return false;
    if(typeof capvoHasBasicSetup==='function' && capvoHasBasicSetup())return false;
    return !!currentUser;
  }catch(e){
    return false;
  }
}

async function loadUserData(userId){
  const ownerId=userId||getDataOwnerId();
  await fetchAllData(ownerId);
  curM=curMK();
  ensM(curM);

  const openWizardFirst=capvoShouldOpenOnboardingBeforeDashboard();

  render();

  if(openWizardFirst){
    document.body.classList.add('capvo-auth-to-wizard-transition');
    hideAuth();
    window.__capvoWizardSmoothIntro=true;

    await new Promise(resolve=>setTimeout(resolve,140));

    if(typeof openCapvoOnboardingWizard==='function'){
      openCapvoOnboardingWizard(0);
    }else if(typeof capvoAfterUserDataLoaded==='function'){
      await capvoAfterUserDataLoaded(ownerId);
    }

    setTimeout(()=>document.body.classList.remove('capvo-auth-to-wizard-transition'),760);
    return;
  }

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
  const codeInput=$('telegramCodeInput');
  if(input)input.value='';
  if(codeInput)codeInput.value='';

  showAuth(getTelegramChatId()?'Σύνδεσε νέο Telegram Chat ID. Μέχρι να ολοκληρωθεί η αλλαγή, η παλιά σύνδεση παραμένει ενεργή.':'Σύνδεσε το Telegram για να ενεργοποιήσεις το Sync.');
  renderAuthState();

  const auth=$('authScreen');
  const card=auth?.querySelector?.('.capvo-auth-card');
  const box=$('telegramLinkBox');

  const forceTelegramTop=()=>{
    try{
      window.scrollTo({top:0,left:0,behavior:'auto'});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      if(auth)auth.scrollTop=0;
      if(card)card.scrollTop=0;
      if(box)box.scrollTop=0;
    }catch(e){}
  };

  requestAnimationFrame(forceTelegramTop);
  setTimeout(forceTelegramTop,80);
  setTimeout(forceTelegramTop,220);

  const btn=$('authSubmitBtn');

  if(btn){
    btn.disabled=false;
    btn.textContent='Σύνδεση Telegram';
  }

  // Do not auto-focus here. The Telegram screen should always open from the top.
  // User can tap the fields manually after reading the instructions.
}



/* CAPVO v1.1.7.35 — Exact Settings Telegram card CTA layout */
function capvoPolishSettingsTelegramCta(){
  try{
    const card=document.querySelector('#vSettings .settings-telegram-card');
    if(!card)return;

    const row=card.querySelector('.settings-actions');
    const syncBtn=card.querySelector('#syncBtn');
    const changeBtn=card.querySelector('#changeTelegramBtn');
    const label=card.querySelector('#settingsTelegramLabel');

    if(!row || !changeBtn)return;

    const labelText=(label?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    const chatIdText=(card.querySelector('#settingsChatId')?.textContent||'').replace(/\s+/g,' ').trim();
    const disconnected =
      labelText.includes('δεν έχει συνδεθεί') ||
      labelText.includes('δεν εχει συνδεθει') ||
      labelText.includes('not connected') ||
      !chatIdText ||
      chatIdText==='—' ||
      chatIdText==='-';

    if(disconnected){
      row.classList.add('telegram-disconnected');
      row.classList.remove('telegram-connected');

      if(syncBtn){
        syncBtn.style.display='none';
        syncBtn.setAttribute('aria-hidden','true');
      }

      changeBtn.style.display='flex';
      changeBtn.style.width='100%';
      changeBtn.style.maxWidth='none';
      changeBtn.style.justifyContent='center';
      changeBtn.style.alignItems='center';
      changeBtn.textContent='Σύνδεση Telegram';
    }else{
      row.classList.remove('telegram-disconnected');
      row.classList.add('telegram-connected');

      if(syncBtn){
        syncBtn.style.display='';
        syncBtn.removeAttribute('aria-hidden');
      }

      changeBtn.style.display='';
      changeBtn.style.width='';
      changeBtn.style.maxWidth='';
      changeBtn.style.justifyContent='';
      changeBtn.style.alignItems='';
      if(!/αλλαγή|αλλαγη/i.test(changeBtn.textContent||'')){
        changeBtn.textContent='Αλλαγή Telegram';
      }
    }
  }catch(e){}
}

function capvoInstallSettingsTelegramCtaPolish(){
  if(window.__capvoSettingsTelegramCtaObserverInstalledV35)return;
  window.__capvoSettingsTelegramCtaObserverInstalledV35=true;

  const run=()=>capvoPolishSettingsTelegramCta();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',run,{once:true});
  }else{
    run();
  }

  const obs=new MutationObserver(()=>{
    if(window.__capvoSettingsTelegramCtaPolishTimer)clearTimeout(window.__capvoSettingsTelegramCtaPolishTimer);
    window.__capvoSettingsTelegramCtaPolishTimer=setTimeout(run,40);
  });

  obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
  setTimeout(run,100);
  setTimeout(run,400);
  setInterval(run,1000);
}

capvoInstallSettingsTelegramCtaPolish();


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

    showAuthLoader();

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
    showAuthLoader();

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
  const money=typeof capvoMoney==='function'?capvoMoney:(n=>Math.round(((Number(n)||0)+Number.EPSILON)*100)/100);
  const hasPrimary=(D.incomeSources||[]).some(s=>s && s.includeInBudget && (s.isPrimaryIncome || s.category==='Μισθός' || s.name==='Μισθός' || s.name==='Μισθός / Budget'));
  const hasBudget=(D.incomeSources||[]).some(s=>s && s.includeInBudget && money(Number(s.amount)||0)>0);
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
    salaryName:'Μισθός / Budget',
    spendingLimit:'',
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
  capvoEnsureDefaultSavingsQuietly();
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  if(typeof step==='number')window.__capvoOnboarding.step=step;
  renderCapvoOnboardingWizard();
}

function closeCapvoOnboardingWizard(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open','onboarding-open');
}


function capvoWizardMoney(value){
  if(value===null || value===undefined)return 0;
  const raw=String(value).trim().replace(/\s+/g,'').replace(',','.');
  const num=Number(raw);
  return Number.isFinite(num) ? capvoMoney(num) : 0;
}

function capvoWizardBudgetAmount(s){
  return capvoWizardMoney(s?.salaryAmount);
}

function capvoWizardSpendingLimitAmount(s){
  return capvoWizardMoney(s?.spendingLimit);
}

function capvoWizardEffectiveBudgetLimit(s){
  const salary=capvoWizardBudgetAmount(s);
  const limit=capvoWizardSpendingLimitAmount(s);
  if(limit>0 && salary>0)return Math.min(limit,salary);
  return salary;
}

function capvoWizardFixedTotal(s){
  return (Array.isArray(s?.fixed)?s.fixed:[]).reduce((sum,row)=>sum+capvoWizardMoney(row?.amount),0);
}

function capvoWizardValidateBudgetStep(s,{focus=true}={}){
  const amount=capvoWizardBudgetAmount(s);
  const limit=capvoWizardSpendingLimitAmount(s);
  if(amount<=0){
    showMiniToast('Βάλε βασικό budget για να συνεχίσεις.','error');
    if(focus)document.getElementById('obSalaryAmount')?.focus();
    return false;
  }
  if(limit>0 && limit>amount){
    showMiniToast('Το όριο εξόδων δεν μπορεί να ξεπερνά το budget κύκλου.','error');
    if(focus)document.getElementById('obSpendingLimit')?.focus();
    return false;
  }
  return true;
}

function capvoWizardValidateFixedStep(s,{focus=true}={}){
  const base=capvoWizardEffectiveBudgetLimit(s);
  const fixed=capvoWizardFixedTotal(s);
  if(base>0 && fixed>base){
    const availableLabel=typeof fmt==='function'?fmt(base):`€${base.toFixed(2)}`;
    const fixedLabel=typeof fmt==='function'?fmt(fixed):`€${fixed.toFixed(2)}`;
    showMiniToast(`Τα πάγια (${fixedLabel}) ξεπερνούν το διαθέσιμο budget (${availableLabel}).`,'error');
    if(focus){
      const rows=Array.isArray(s?.fixed)?s.fixed:[];
      const idx=rows.findIndex(row=>capvoWizardMoney(row?.amount)>0);
      document.getElementById(`obFixed${Math.max(0,idx)}Amount`)?.focus();
    }
    return false;
  }
  return true;
}

function capvoEnsureDefaultSavingsQuietly(){
  try{
    if(typeof ensureDefaultGeneralSavingsGoal!=='function')return;
    const owner=getFinanceUserId?.() || getDataOwnerId?.();
    if(!owner)return;
    if(window.__capvoEnsuringDefaultSavings)return;
    if(typeof getDefaultGeneralSavingsGoal==='function' && getDefaultGeneralSavingsGoal())return;
    window.__capvoEnsuringDefaultSavings=true;
    Promise.resolve(ensureDefaultGeneralSavingsGoal())
      .catch(e=>console.warn('[CAPVO] default savings bootstrap skipped',e))
      .finally(()=>{window.__capvoEnsuringDefaultSavings=false;});
  }catch(e){
    window.__capvoEnsuringDefaultSavings=false;
    console.warn('[CAPVO] default savings bootstrap skipped',e);
  }
}

function capvoOnboardingUpdateFromInputs(){
  const s=window.__capvoOnboarding||capvoWizardDefaultState();
  const get=id=>document.getElementById(id);
  if(get('obCycleTypeFixed')||get('obCycleTypeLast')){
    s.cycleType=get('obCycleTypeLast')?.checked?'last_working_day':'fixed_day';
    const cycleDayInput=get('obCycleDay');
    const nextCycleDay=readBudgetCycleDayInput(cycleDayInput,s.cycleDay||1);
    if(nextCycleDay!==null)s.cycleDay=nextCycleDay;
  }
  if(get('obSalaryAmount')){
    s.salaryName=(get('obSalaryName')?.value||'Μισθός / Budget').trim()||'Μισθός / Budget';
    s.salaryAmount=get('obSalaryAmount')?.value||'';
    s.spendingLimit=get('obSpendingLimit')?.value||'';
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
  const numericStep=Math.max(0,Math.min(5,Number(step)||0));
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


function capvoSetWizardStep(step){
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  window.__capvoOnboarding.step=step;
  renderCapvoOnboardingWizard();
}

function showCapvoOnboardingCompletion(){
  window.__capvoOnboarding=window.__capvoOnboarding||capvoWizardDefaultState();
  window.__capvoOnboarding.step=5;
  renderCapvoOnboardingWizard();
}

function capvoGoToDashboardAfterOnboarding(){
  const overlay=document.getElementById('capvoOnboardingOverlay');
  document.body.classList.add('capvo-wizard-to-dashboard-transition');

  if(overlay){
    overlay.classList.add('capvo-wizard-dashboard-outro');
  }

  setTimeout(()=>{
    closeCapvoOnboardingWizard();
    try{
      go('vDash',document.querySelector('[data-v="vDash"]'));
      window.scrollTo({top:0,left:0,behavior:'auto'});
    }catch(e){}

    document.body.classList.add('capvo-dashboard-soft-enter');

    setTimeout(()=>{
      document.body.classList.remove('capvo-wizard-to-dashboard-transition','capvo-dashboard-soft-enter');
    },520);
  },260);
}

function capvoOnboardingStepHtml(s){
  const step=Math.max(0,Math.min(5,Number(s.step)||0));
  const steps=[
    {label:'Κύκλος', icon:'1'},
    {label:'Budget', icon:'2'},
    {label:'Πάγια', icon:'3'},
    {label:'Δυνατότητες', icon:'4'},
    {label:'Telegram', icon:'5'},
    {label:'Τέλος', icon:'✓'}
  ];
  const isLast=s.cycleType==='last_working_day';
  const day=Number(s.cycleDay||1);

  const stepper=()=>`<div class="ob-pro-stepper ob-pro-stepper-six" aria-label="CAPVO onboarding progress">${steps.map((item,idx)=>`
    <div class="ob-pro-step ${idx<step?'done':idx===step?'active':'upcoming'}">
      <span>${idx<step?'✓':item.icon}</span>
      ${idx<steps.length-1?'<i></i>':''}
      <small>${item.label}</small>
    </div>`).join('')}</div>`;

  const shell=(title,subtitle,body,actions='',opts={})=>`<section class="capvo-onboarding-sheet ob-stepper-pro ${opts.extraClass||''}" onclick="event.stopPropagation()">
    <div class="ob-pro-header">
      <button type="button" class="ob-pro-back ${step===0||step===5?'is-hidden':''}" onclick="capvoOnboardingPrev()" aria-label="Πίσω">‹</button>
      <div class="ob-pro-brand"><img src="assets/capvo-mark.png" alt="CAPVO" onerror="this.style.display='none'"><strong>CAPVO</strong></div>
      <button type="button" class="ob-pro-skip ${step===5?'is-hidden':''}" onclick="skipCapvoOnboarding()">Παράλειψη</button>
    </div>
    ${stepper()}
    <div class="ob-pro-copy">
      <h2>${title}</h2>
      <p>${subtitle}</p>
    </div>
    <div class="capvo-onboarding-body ob-pro-body">${body}</div>
    ${actions}
    <div class="ob-pro-footnote">${step===5?'Η ρύθμιση αποθηκεύτηκε στον λογαριασμό σου.':'Μπορείς να επιστρέψεις ή να αλλάξεις τα πάντα αργότερα.'}</div>
  </section>`;

  const triActions=(primaryText='Συνέχεια', primaryAction='capvoOnboardingNext()')=>`<div class="ob-pro-actions two">
      <button type="button" class="ob-pro-secondary" onclick="capvoOnboardingPrev()">Πίσω</button>
      <button type="button" class="ob-pro-primary" onclick="${primaryAction}">${primaryText} <span>→</span></button>
    </div>`;

  if(step===0){
    return shell(
      'Καλωσόρισες στο CAPVO',
      'Πες μας πότε πληρώνεσαι, για να υπολογίζουμε σωστά το διαθέσιμο ποσό μέχρι την επόμενη πληρωμή.',
      `
      <div class="ob-pro-card hero ob-pro-welcome-exact">
        <div class="ob-pro-card-head">
          <div>
            <span>1ο βήμα</span>
            <h3>Ορισμός οικονομικού κύκλου</h3>
            <p>Ο κύκλος είναι η περίοδος από τη μία πληρωμή μέχρι την επόμενη.</p>
          </div>
          <div class="ob-pro-hero-icon premium-cycle" aria-hidden="true"></div>
        </div>

        <div class="ob-pro-benefits">
          <div><i class="premium-mini-icon calendar"></i><strong>Οργανώνει το budget σου ανά κύκλο πληρωμής.</strong></div>
          <div><i class="premium-mini-icon chart"></i><strong>Υπολογίζει πόσα μπορείς να ξοδεύεις κάθε μέρα.</strong></div>
          <div><i class="premium-mini-icon target"></i><strong>Δείχνει καθαρά υπόλοιπο, πρόοδο και υπερβάσεις.</strong></div>
        </div>

        <div class="ob-pro-cycle-editor">
          <label class="ob-pro-label">Τρόπος πληρωμής</label>
          <div class="ob-pro-pill-grid two">
            <label class="ob-pro-pill ${!isLast?'selected':''}" data-cycle-type="fixed_day">
              <input type="radio" name="obCycleType" id="obCycleTypeFixed" value="fixed_day" ${!isLast?'checked':''}>
              <strong>Συγκεκριμένη ημέρα</strong>
              <small>π.χ. κάθε 8 του μήνα</small>
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
              <input id="obCycleDay" type="text" min="1" max="31" maxlength="2" pattern="[0-9]*" inputmode="numeric" value="${esc(s.cycleDay||1)}" ${isLast?'disabled':''}>
              <span>του μήνα</span>
            </div>
            <div class="ob-pro-inline-note">${isLast?'Δεν χρειάζεται ημέρα. Το CAPVO θα βρίσκει αυτόματα την τελευταία εργάσιμη.':'Γράψε την ημέρα του μήνα από 1 έως 31, π.χ. 8 ή 28.'}</div>
          </div>
        </div>
      </div>`,
      `<div class="ob-pro-actions single"><button type="button" class="ob-pro-primary" onclick="capvoOnboardingNext()">Συνέχεια <span>→</span></button></div>`
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
        <label class="ob-pro-inline-input"><span>Όνομα πηγής</span><input id="obSalaryName" type="text" value="${esc(s.salaryName||'Μισθός / Budget')}" placeholder="Μισθός / Budget"></label>
        <label class="ob-pro-inline-input ob-pro-limit-input"><span>Όριο για έξοδα <small>Προαιρετικό</small></span><input id="obSpendingLimit" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(s.spendingLimit||'')}" placeholder="π.χ. 900"></label>
        <div class="ob-pro-inline-note">Αν αφήσεις το όριο κενό, όλο το ποσό κύκλου θα θεωρηθεί διαθέσιμο.</div>
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
      const iconClass=idx===0?'home':idx===1?'wifi':'repeat';
      return `<label class="ob-pro-fixed-row">
        <i class="premium-mini-icon ${iconClass}"></i>
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

  if(step===3){
    return shell(
      'Τι άλλο θα βρεις στο CAPVO',
      'Μετά το setup μπορείς να χρησιμοποιήσεις περισσότερα εργαλεία για να ελέγχεις τα χρήματά σου.',
      `
      <div class="ob-pro-card features">
        <div class="ob-feature-grid">
          <div class="ob-feature-item"><i class="premium-mini-icon advisor"></i><strong>Σύμβουλος</strong><span>Δες αν κινείσαι σωστά μέσα στον κύκλο.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon reports"></i><strong>Αναφορές</strong><span>Καθαρή εικόνα για έξοδα και συνήθειες.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon savings"></i><strong>Κουμπαράδες</strong><span>Κράτα χρήματα εκτός budget για στόχους.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon quick"></i><strong>Quick Add</strong><span>Γρήγορη καταχώρηση από κινητό.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon wallet"></i><strong>Πηγές πληρωμής</strong><span>Budget, Ticket, Voucher και κάρτες.</span></div>
          <div class="ob-feature-item"><i class="premium-mini-icon cycle"></i><strong>Κύκλοι</strong><span>Έλεγχος μέχρι την επόμενη πληρωμή.</span></div>
        </div>
      </div>`,
      triActions('Συνέχεια','capvoOnboardingNext()')
    );
  }

  if(step===4){
    return shell(
      'Προαιρετική σύνδεση Telegram',
      'Σύνδεσε το Telegram Bot για να καταχωρείς έξοδα με μήνυμα ή φωνή, χωρίς να ανοίγεις την εφαρμογή.',
      `
      <div class="ob-pro-card telegram">
        <div class="ob-pro-telegram-orb premium-telegram" aria-hidden="true"></div>
        <p class="ob-pro-telegram-copy">Ιδανικό όταν είσαι έξω και θέλεις να περνάς γρήγορα κινήσεις όπως “καφές 3” ή “βενζίνη 20”. Αν δεν το θες τώρα, μπορείς να το συνδέσεις αργότερα από τις Ρυθμίσεις.</p>
        <div class="ob-pro-benefits three">
          <div><i class="premium-mini-icon chat"></i><strong>Γρήγορη καταχώρηση με μήνυμα</strong></div>
          <div><i class="premium-mini-icon voice"></i><strong>Καταχώρηση με φωνητικό</strong></div>
          <div><i class="premium-mini-icon sync"></i><strong>Αυτόματος συγχρονισμός στο CAPVO</strong></div>
        </div>
      </div>`,
      `<div class="ob-pro-actions telegram">
        <button type="button" class="ob-pro-primary" onclick="finishCapvoOnboarding(true)">Σύνδεση Telegram <span>→</span></button>
        <button type="button" class="ob-pro-secondary" onclick="finishCapvoOnboarding(false)">Παράλειψη και ολοκλήρωση</button>
        <button type="button" class="ob-pro-link wide" onclick="capvoOnboardingPrev()">Πίσω</button>
      </div>`
    );
  }

  return shell(
    'Το CAPVO είναι έτοιμο',
    'Η βασική ρύθμιση ολοκληρώθηκε. Μπορείς τώρα να ξεκινήσεις να καταχωρείς έξοδα και να παρακολουθείς το budget σου.',
    `
    <div class="ob-pro-card complete">
      <div class="ob-complete-mark"><span>✓</span></div>
      <div class="ob-complete-list">
        <div><i class="premium-mini-icon wallet"></i><strong>Το βασικό budget σου αποθηκεύτηκε.</strong></div>
        <div><i class="premium-mini-icon cycle"></i><strong>Ο οικονομικός κύκλος είναι έτοιμος.</strong></div>
        <div><i class="premium-mini-icon quick"></i><strong>Συνέχισε με Quick Add ή πρόσθεσε τα πρώτα σου έξοδα.</strong></div>
      </div>
    </div>`,
    `<div class="ob-pro-actions single">
      <button type="button" class="ob-pro-primary" onclick="capvoGoToDashboardAfterOnboarding()">Άνοιγμα Dashboard <span>→</span></button>
    </div>`,
    {extraClass:'ob-complete-screen'}
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

function capvoEnsureWizardMobileScrollFixStyles(){
  if(document.getElementById('capvoWizardMobileScrollFixStyles'))return;
  const style=document.createElement('style');
  style.id='capvoWizardMobileScrollFixStyles';
  style.textContent=`
    #capvoOnboardingOverlay.capvo-onboarding-overlay{
      overflow:hidden !important;
    }

    #capvoOnboardingOverlay .ob-stepper-pro{
      overflow-y:auto !important;
      overflow-x:hidden !important;
      -webkit-overflow-scrolling:touch !important;
      overscroll-behavior:contain !important;
      grid-template-rows:auto auto auto auto auto auto !important;
      align-content:start !important;
      height:100dvh !important;
      max-height:100dvh !important;
      padding-bottom:calc(20px + env(safe-area-inset-bottom)) !important;
    }

    #capvoOnboardingOverlay .ob-pro-body{
      overflow:visible !important;
      min-height:auto !important;
      max-height:none !important;
      padding-right:0 !important;
    }

    #capvoOnboardingOverlay .ob-pro-actions{
      position:relative !important;
      margin-top:2px !important;
    }

    #capvoOnboardingOverlay .ob-pro-footnote{
      padding-bottom:4px !important;
    }

    #capvoOnboardingOverlay .ob-pro-card.hero{
      margin-bottom:2px !important;
    }

    @media (max-width:420px){
      #capvoOnboardingOverlay .ob-stepper-pro{
        padding-left:14px !important;
        padding-right:14px !important;
        gap:13px !important;
      }
      #capvoOnboardingOverlay .ob-pro-copy h2{
        font-size:26px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card{
        padding:16px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card-head h3{
        font-size:23px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card-head p{
        font-size:12.5px !important;
      }
      #capvoOnboardingOverlay .ob-pro-benefits strong{
        font-size:12px !important;
      }
      #capvoOnboardingOverlay .ob-pro-cycle-editor{
        padding-top:10px !important;
        gap:9px !important;
      }
      #capvoOnboardingOverlay .ob-pro-day-input{
        min-height:52px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderCapvoOnboardingWizard(){
  capvoEnsureOnboardingProStyles();
  capvoEnsureOnboardingPremiumStyles();
  capvoEnsureWizardMobileScrollFixStyles();
  const overlay=capvoEnsureOnboardingOverlay();
  const s=window.__capvoOnboarding||capvoWizardDefaultState();
  overlay.innerHTML=capvoOnboardingStepHtml(s);
  overlay.classList.add('active');

  if(window.__capvoWizardSmoothIntro){
    overlay.classList.add('capvo-wizard-smooth-intro');
    window.__capvoWizardSmoothIntro=false;
    setTimeout(()=>overlay.classList.remove('capvo-wizard-smooth-intro'),720);
  }

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
        : 'Γράψε την ημέρα του μήνα από 1 έως 31, π.χ. 8 ή 28.';
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
  day?.addEventListener('input',()=>handleBudgetCycleDayInput(day));
  day?.addEventListener('blur',()=>finalizeBudgetCycleDayInput(day,s.cycleDay||1));
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

  if(s.step===0 && s.cycleType==='fixed_day'){
    const dayInput=document.getElementById('obCycleDay');
    if(dayInput && String(dayInput.value||'').trim()===''){
      showMiniToast('Βάλε ημέρα πληρωμής από 1 έως 31.','error');
      dayInput.focus();
      return;
    }
    s.cycleDay=finalizeBudgetCycleDayInput(dayInput,s.cycleDay||1);
  }

  if(s.step===1){
    if(!capvoWizardValidateBudgetStep(s))return;
  }

  if(s.step===2){
    if(!capvoWizardValidateFixedStep(s))return;
  }

  s.step=Math.min(5,(s.step||0)+1);
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
  const btn=overlay?.querySelector('.ob-pro-skip, .ob-skip-top, .capvo-onboarding-top button');
  try{
    const s=capvoOnboardingUpdateFromInputs();
    if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
    await capvoUpsertUserPreferencePatch({
      onboarding_dismissed:true,
      onboarding_step:String(Math.max(0,Math.min(4,Number(s.step)||0)))
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

  const salaryAmount=capvoWizardBudgetAmount(s);
  const spendingLimit=capvoWizardSpendingLimitAmount(s);
  if(!capvoWizardValidateBudgetStep(s,{focus:false})){
    s.step=1;
    renderCapvoOnboardingWizard();
    return;
  }

  if(!capvoWizardValidateFixedStep(s,{focus:false})){
    s.step=2;
    renderCapvoOnboardingWizard();
    return;
  }

  const btn=document.querySelector('#capvoOnboardingOverlay .ob-pro-primary, #capvoOnboardingOverlay .ob-primary');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    if(typeof ensureDefaultGeneralSavingsGoal==='function'){
      try{await ensureDefaultGeneralSavingsGoal();}catch(e){console.warn('[CAPVO] default savings bootstrap skipped',e);}
    }

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
      name:s.salaryName||'Μισθός / Budget',
      amount:salaryAmount,
      spendingLimit:(spendingLimit>0 && spendingLimit<salaryAmount)?capvoMoney(spendingLimit):0,
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

    await fetchAllData(ownerUserId);
    curM=curMK();
    ensM(curM);
    render();

    if(openTelegramAfter){
      closeCapvoOnboardingWizard();
      window.__capvoTelegramFromWizardFinish=true;
      switchChatId?.();
      return;
    }

    showCapvoOnboardingCompletion();

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
  const resumeStep=Number.isFinite(savedStep)?Math.max(0,Math.min(5,savedStep)):0;
  window.__capvoOnboarding.step=resumeStep;

  window.__capvoWizardSmoothIntro=true;
  document.body.classList.add('capvo-dashboard-to-wizard-transition');

  setTimeout(()=>{
    openCapvoOnboardingWizard(resumeStep);
    setTimeout(()=>document.body.classList.remove('capvo-dashboard-to-wizard-transition'),760);
  },90);
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


document.addEventListener('click',e=>{
  const picker=$('dailyCategoryPicker');
  if(!picker)return;
  if(!picker.contains(e.target))toggleDailyCategoryMenu(false);
});
