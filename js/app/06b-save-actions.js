// CAPVO app split: 06b-save-actions.js
// Save/Delete actions: validate, save daily/fixed/card expenses, delete
// Source: 06-modals-nav-auth.js lines 1055-2357

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

  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});

  const walletCheck=typeof capvoValidateDailyExpenseWalletBalance==='function'
    ? capvoValidateDailyExpenseWalletBalance(expense,{editing})
    : {ok:true};
  if(!walletCheck.ok){
    return fail(walletCheck.message || 'Το wallet δεν επαρκεί για αυτή την πληρωμή.');
  }

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

  const alreadyAppliedToWallet=!!(expense.walletId && Number(expense.walletBalanceEffectAmount||0)<0);
  if(!alreadyAppliedToWallet && (typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(expense):!expense?.paymentSourceId)){
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
  const date=$('fDD').value||(typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA'));
  const categoryId=$('fDC')?.value||'';
  const rootCategory=(typeof capvoCategoryById==='function'?capvoCategoryById(categoryId):null)
    || (typeof capvoRootCategoryByName==='function'?capvoRootCategoryByName(categoryId):null);
  const category=rootCategory?.name||'Άλλο';
  const subcategoryId=$('fDSubcategory')?.value||'';
  const merchantName=($('fDMerchant')?.value||'').trim();
  const notes=($('fDNotes')?.value||'').trim();
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
      categoryId:categoryId||null,
      subcategoryId:subcategoryId||null,
      merchantName,
      notes,
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
      categoryId:categoryId||null,
      subcategoryId:subcategoryId||null,
      merchantName,
      notes,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    },paymentSource);
  }

  if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(expense);
  const oldExpense=id?getExistingDailyExpenseById(id):null;
  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});

  const limitValidation=validateCreditCardAvailableLimit(expense,oldExpense);
  if(!limitValidation.ok){
    showMiniToast('❌ Το ποσό ξεπερνά το διαθέσιμο όριο της κάρτας ('+fmt(limitValidation.available)+').','error');
    $('fDA')?.focus();
    return;
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

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(id?'Ενημερώνεται κίνηση...':'Αποθηκεύεται κίνηση...', 'Ενημερώνω έξοδα, κάρτες και υπόλοιπα.'))return;

  if(btn){
    btn.disabled=true;
    btn.dataset.saving='1';
    btn.textContent='Αποθήκευση...';
  }

  applyCreditCardPurchaseBalance(expense,oldExpense);

  if(id){
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(e=>e.id!==id);
    });
  }

  D.months[monthKey].daily.push(expense);

  let walletEffect=null;
  try{
    walletEffect=await capvoApplyDailyExpenseWalletEffects(userId,expense,oldExpense);
    await saveDailyExpenseRow(userId,expense);
    await saveCreditCardPurchaseSideEffects(userId,expense);
    await persistCreditCardBalanceForPurchase(userId,expense);

    closeM();
    render();

    const isCardPurchase=!!(expense.isCreditCardPurchase || expense.paymentAccountType==='credit_card' || paymentSource?.accountType==='credit_card');
    const successMsg=isCardPurchase
      ? (id?'✅ Η αγορά κάρτας ενημερώθηκε':'✅ Η αγορά με πιστωτική καταχωρήθηκε')
      : (id?'✅ Η κίνηση ενημερώθηκε':'✅ Η κίνηση καταχωρήθηκε');
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast?.(successMsg);

  }catch(e){
    console.error('saveDaily failed:',e);
    if(walletEffect?.rollback){
      try{await walletEffect.rollback();}catch(rollbackErr){console.error('daily wallet rollback failed:',rollbackErr);}
    }
    try{await fetchAllData(userId);render();}catch(reloadErr){console.error('Reload after saveDaily failure failed:',reloadErr);}
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω την κίνηση.');
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.dataset.saving='0';
      btn.textContent='Αποθήκευση';
    }
  }
}



function capvoFixedDateToGreek(value){
  const iso=normalizeDateValue?.(value)||'';
  const d=typeof capvoParseDateKey==='function'?capvoParseDateKey(iso):null;
  if(!d)return '';
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function capvoFixedGreekDateToISO(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  const iso=normalizeDateValue?.(raw)||'';
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso))return iso;

  const m=raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if(m){
    const day=Number(m[1]);
    const month=Number(m[2]);
    const year=Number(m[3]);
    if(day>=1 && day<=31 && month>=1 && month<=12 && year>=1900){
      const max=typeof capvoDaysInMonth==='function'?capvoDaysInMonth(year,month-1):new Date(year,month,0).getDate();
      if(day<=max)return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  }
  return '';
}

function capvoSetFixedNextDueDateInputValue(value){
  const field=$('fFNextDueDate');
  if(!field)return;
  const iso=capvoFixedGreekDateToISO(value) || (normalizeDateValue?.(value)||'');
  field.value = field.type === 'date' ? iso : capvoFixedDateToGreek(iso);
  field.style.borderColor='';
  delete field.dataset.invalidDate;
}

function capvoFixedNextDateFromRule(scheduleType,dueDay,refDateKey){
  const type=String(scheduleType||'monthly');
  const today=typeof capvoParseDateKey==='function'?(capvoParseDateKey(refDateKey||todayISO?.())||new Date()):new Date();
  const day=typeof capvoClampCycleDay==='function'?capvoClampCycleDay(dueDay||today.getDate()):(Number(dueDay)||today.getDate());

  if(type==='weekly'){
    return typeof capvoLocalDateKey==='function'?capvoLocalDateKey(today):new Date().toLocaleDateString('en-CA');
  }

  if(type==='yearly'){
    const y=today.getFullYear();
    let candidate=new Date(y,today.getMonth(),Math.min(day,capvoDaysInMonth?.(y,today.getMonth())||31),12);
    if(candidate<today)candidate=new Date(y+1,today.getMonth(),Math.min(day,capvoDaysInMonth?.(y+1,today.getMonth())||31),12);
    return capvoLocalDateKey?.(candidate)||'';
  }

  const y=today.getFullYear();
  const m=today.getMonth();
  let candidate=new Date(y,m,Math.min(day,capvoDaysInMonth?.(y,m)||31),12);
  if(candidate<today){
    const ny=m+1;
    candidate=new Date(y,ny,Math.min(day,capvoDaysInMonth?.(y,ny)||31),12);
  }
  return capvoLocalDateKey?.(candidate)||'';
}

function capvoNormalizeFixedNextDueDateInput(options={}){
  const field=$('fFNextDueDate');
  if(!field)return '';
  const raw=String(field.value||'').trim();
  delete field.dataset.invalidDate;
  if(!raw){
    field.style.borderColor='';
    return '';
  }
  const iso=capvoFixedGreekDateToISO(raw);
  if(!iso){
    field.dataset.invalidDate='1';
    field.style.borderColor='var(--red)';
    return '';
  }
  field.style.borderColor='';
  field.value = field.type === 'date' ? iso : capvoFixedDateToGreek(iso);

  if(options.syncDueDay && $('fFDueDay') && String($('fFSchedule')?.value||'monthly')!=='weekly'){
    const d=capvoParseDateKey?.(iso);
    if(d)$('fFDueDay').value=String(d.getDate());
  }
  return iso;
}

function capvoSyncFixedScheduleUI(options={}){
  const type=String($('fFSchedule')?.value||'monthly');
  const dueGroup=$('fixedDueDayGroup');
  const dueLabel=$('fixedDueDayLabel');
  const dueHelp=$('fixedDueDayHelp');
  const nextLabel=$('fixedNextDueLabel');
  const nextHelp=$('fixedNextDueHelp');
  const row=$('fixedRecurringRow');
  const dueInput=$('fFDueDay');
  const dateInput=$('fFNextDueDate');

  row?.classList.toggle('is-weekly',type==='weekly');
  if(dueGroup)dueGroup.hidden=type==='weekly';

  if(type==='weekly'){
    if(nextLabel)nextLabel.textContent='Πρώτη / επόμενη εβδομαδιαία πληρωμή';
    if(nextHelp)nextHelp.textContent='Από αυτή την ημερομηνία θα υπολογίζεται κάθε 7 ημέρες. Οι παλιές πληρωμές δεν αλλάζουν.';
  }else if(type==='yearly'){
    if(dueLabel)dueLabel.textContent='Ημέρα μήνα';
    if(dueHelp)dueHelp.textContent='π.χ. 17 → εμφανίζεται κάθε χρόνο στην ίδια ημέρα του μήνα.';
    if(nextLabel)nextLabel.textContent='Επόμενη ετήσια εμφάνιση';
    if(nextHelp)nextHelp.textContent='Ημερομηνία τύπου date. Η συσκευή τη δείχνει στη δική της μορφή, ενώ στη βάση σώζεται ως ημερομηνία.';
  }else{
    if(dueLabel)dueLabel.textContent='Πληρώνεται κάθε μήνα στις';
    if(dueHelp)dueHelp.textContent='π.χ. 17 → εμφανίζεται κάθε μήνα στις 17. Όταν πληρωθεί, πάει στον επόμενο μήνα την ίδια ημέρα.';
    if(nextLabel)nextLabel.textContent='Επόμενη προγραμματισμένη εμφάνιση';
    if(nextHelp)nextHelp.textContent='Υπολογίζεται από την ημέρα μήνα. Αν το αλλάξεις, αποθηκεύεται ως ημερομηνία και συγχρονίζεται η ημέρα.';
  }

  if(type==='weekly' && dueInput && !dueInput.value){
    dueInput.value=String(new Date().getDate());
  }

  const hasExisting=!!String(dateInput?.value||'').trim();
  if(dateInput && (options.force || options.fromSchedule || options.fromDueDay || !hasExisting || !options.preserveDate)){
    const storedIso=capvoFixedGreekDateToISO(dateInput.value);
    const todayKey=todayISO?.()||new Date().toLocaleDateString('en-CA');

    if(!options.force){
      // When user explicitly changes dueDay or schedule, always recalculate & update the date field
      if(options.fromDueDay || options.fromSchedule){
        const ref=todayKey;
        const next=capvoFixedNextDateFromRule(type,dueInput?.value||new Date().getDate(),ref);
        capvoSetFixedNextDueDateInputValue(next);
        return;
      }
      // Preserve stored date if it's still >= today (don't auto-advance months)
      if(storedIso && storedIso>=todayKey){
        capvoSetFixedNextDueDateInputValue(storedIso);
        return;
      }
      // Only recalculate if stored date is in the past
      const ref=todayKey;
      const next=capvoFixedNextDateFromRule(type,dueInput?.value||new Date().getDate(),ref);
      capvoSetFixedNextDueDateInputValue(next);
      return;
    }
    const ref=todayKey;
    const next=capvoFixedNextDateFromRule(type,dueInput?.value||new Date().getDate(),ref);
    capvoSetFixedNextDueDateInputValue(next);
  }
}

function fillFixedSourceWalletSelect(selectedId=''){
  const select=$('fFWallet');
  if(!select)return;
  const activeWallets=typeof capvoActiveWallets==='function'?capvoActiveWallets():[];
  const wallets=activeWallets.filter(w=>!(typeof capvoFixedPaymentIsSavingsWallet==='function'?capvoFixedPaymentIsSavingsWallet(w):(w?.isSavings||w?.is_savings||String(w?.type||'')==='savings')));
  const defaultWallet=typeof capvoDefaultWallet==='function'?capvoDefaultWallet():null;
  const value=String(selectedId || defaultWallet?.id || '');
  select.innerHTML=[
    '<option value="">Χωρίς συγκεκριμένο wallet</option>',
    ...wallets.map(w=>`<option value="${esc(w.id)}">${esc(w.name||'Wallet')} · ${fmt(Number(w.currentBalance)||0)}</option>`)
  ].join('');
  select.value=value;
}

function readFixedScheduleForm(){
  const type=String($('fFSchedule')?.value||'monthly');
  const typedDate=capvoNormalizeFixedNextDueDateInput({syncDueDay:true});
  const invalidDate=$('fFNextDueDate')?.dataset?.invalidDate==='1';
  const parsed=typedDate && capvoParseDateKey?.(typedDate);
  const dueDay=capvoClampCycleDay($('fFDueDay')?.value || (parsed?parsed.getDate():1));
  const sourceWalletId=String($('fFWallet')?.value||'');
  const autoPay=!!$('fFAutoPay')?.checked;
  const nextDueDate=invalidDate ? '' : (typedDate || capvoFixedNextDateFromRule(type,dueDay,todayISO?.()));
  if(!typedDate && !invalidDate)capvoSetFixedNextDueDateInputValue(nextDueDate);
  return {scheduleType:type,dueDay,sourceWalletId,autoPay,nextDueDate};
}


async function saveFixedExpenseRow(userId,expense){
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();
  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const dueDay=typeof capvoFixedExpenseDueDay==='function'?capvoFixedExpenseDueDay(expense):(Number(expense.dueDay)||1);
  const nextDue=expense.nextDueDate || (typeof capvoFixedExpenseNextDueDate==='function'?capvoFixedExpenseNextDueDate({...expense,dueDay}):'');
  const payload={
    id:expense.id,
    user_id:ownerUserId,
    user_chat_id:null,
    name:expense.name,
    amount:expense.amount,
    category:expense.category,
    ...(expense.effectiveFromDate ? {effective_from_date:expense.effectiveFromDate} : {}),
    schedule_type:expense.scheduleType||'monthly',
    due_day:dueDay,
    next_due_date:nextDue||null,
    source_wallet_id:expense.sourceWalletId||null,
    auto_pay:!!expense.autoPay
  };

  // Reactivate deterministic onboarding-created fixed expenses if the wizard is retried
  // after a previous soft delete. Historical payments remain untouched.
  if(expense.deletedAt===null || expense.deleted_at===null){
    payload.deleted_at=null;
  }

  let {error}=await supabaseClient
    .from('fixed_expenses')
    .upsert(payload,{onConflict:'id'});

  if(error && /(effective_from_date|schedule_type|due_day|next_due_date|source_wallet_id|auto_pay|deleted_at)/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.effective_from_date;
    delete legacyPayload.schedule_type;
    delete legacyPayload.due_day;
    delete legacyPayload.next_due_date;
    delete legacyPayload.source_wallet_id;
    delete legacyPayload.auto_pay;
    delete legacyPayload.deleted_at;
    const retry=await supabaseClient
      .from('fixed_expenses')
      .upsert(legacyPayload,{onConflict:'id'});
    error=retry.error;
  }

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
  const fixedSchedule=typeof readFixedScheduleForm==='function'?readFixedScheduleForm():{scheduleType:'monthly',dueDay:1,sourceWalletId:'',autoPay:false,nextDueDate:''};
  const userId=getDataOwnerId();
  const btn=$('btnFixed');

  if(btn?.dataset?.saving==='1')return;

  if(!n){
    $('fFN').style.borderColor='var(--red)';
    showMiniToast?.('Συμπλήρωσε περιγραφή παγίου.','error');
    return;
  }

  if(!a||a<=0){
    $('fFA').style.borderColor='var(--red)';
    showMiniToast?.('Συμπλήρωσε ποσό μεγαλύτερο από 0€.','error');
    return;
  }

  if(!userId){
    showMiniToast(
      '❌ Δεν υπάρχει ενεργή σύνδεση Google',
      'error'
    );
    return;
  }

  if(!fixedSchedule.nextDueDate){
    $('fFNextDueDate').style.borderColor='var(--red)';
    showMiniToast?.('Συμπλήρωσε σωστή ημερομηνία επόμενης εμφάνισης.','error');
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
      Object.assign(expense,fixedSchedule);
      if(!expense.nextDueDate && typeof capvoFixedExpenseNextDueDate==='function')expense.nextDueDate=capvoFixedExpenseNextDueDate(expense);
    }
  }else{
    expense={
      id:gid(),
      name:n,
      amount:a,
      category,
      ...fixedSchedule,
      createdAt:typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA')
    };
    if(!expense.nextDueDate && typeof capvoFixedExpenseNextDueDate==='function')expense.nextDueDate=capvoFixedExpenseNextDueDate(expense);

    D.fixedExpenses.push(expense);
  }

  if(!expense)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(id?'Ενημερώνεται πάγιο...':'Αποθηκεύεται πάγιο...', 'Ενημερώνω τα σταθερά έξοδα και το budget.'))return;

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

    const successMsg=id?'✅ Το πάγιο ενημερώθηκε':'✅ Το πάγιο αποθηκεύτηκε';
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast?.(successMsg);

  }catch(e){
    console.error('saveFixed failed:',e);
    try{await fetchAllData(userId);render();}catch(reloadErr){console.error('Reload after saveFixed failure failed:',reloadErr);}
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω το πάγιο.');
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.dataset.saving='0';
      btn.textContent=id?'Ενημέρωση':'Αποθήκευση';
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

async function deleteDailyExpenseSideEffects(expense){
  if(!expense)return;
  await deleteCreditCardExpenseSideEffects(expense);
}

async function deleteDailyExpenseSideEffectsForIds(ids){
  for(const id of ids||[]){
    const expense=typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
    if(expense)await deleteDailyExpenseSideEffects(expense);
  }
}

async function deleteExpenseRow(type,id){
  if(type==='fixed'){
    await capvoSoftDeleteFixedExpense(id);
    return;
  }
  let walletRollback=null;
  if(type==='daily'){
    const expense=typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(id) : null;
    try{
      if(expense){
        await deleteDailyExpenseSideEffects(expense);
        walletRollback=await capvoRestoreDailyExpenseWalletEffect(expense);
      }
      await deleteRowsFromTable('expenses',[id]);
      return;
    }catch(e){
      if(walletRollback?.rollback){
        let rollbackOk=false;
        for(let retry=0;retry<3&&!rollbackOk;retry++){
          try{await walletRollback.rollback();rollbackOk=true;}
          catch(rollbackErr){
            console.warn(`delete daily wallet rollback attempt ${retry+1}/3 failed:`,rollbackErr);
            if(retry<2)await new Promise(r=>setTimeout(r,150));
          }
        }
        if(!rollbackOk)console.error('delete daily wallet rollback failed after retries:',walletRollback.rollback);
      }
      throw e;
    }
  }
  await deleteRowsFromTable('expenses',[id]);
}

async function delExp(t,id){

  const confirmed=await showConfirmModal({
    title:t==='fixed'?'Διαγραφή παγίου':'Διαγραφή εξόδου',
    message:t==='fixed'
      ? 'Θα διαγραφεί το πάγιο από τις μελλοντικές υποχρεώσεις. Οι ήδη καταχωρημένες πληρωμές θα μείνουν στο ιστορικό και δεν θα αλλάξει κανένα wallet.'
      : 'Θέλεις να διαγράψεις αυτή την εγγραφή;',
    confirmText:t==='fixed'?'Διαγραφή παγίου':'Διαγραφή'
  });

  if(!confirmed)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Διαγράφεται εγγραφή...', 'Ενημερώνω τα δεδομένα και το budget.'))return;

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

    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Η εγγραφή διαγράφηκε.');
    showMiniToast('✅ Η εγγραφή διαγράφηκε');

    // Invalidate archive cycle cache after delete
    if(typeof capvoInvalidateArchiveCache==='function')capvoInvalidateArchiveCache();
  }catch(e){
    console.error('Delete error:',e);

    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να διαγράψω την εγγραφή.');
    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
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
    else hint.textContent='Π.χ. “καφές 3 μετρητά”, “σούπερ 25 revo” ή “φαγητό 12 ticket”';
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
        categoryId:parsed.categoryId||parsed.category_id||null,
        subcategoryId:parsed.subcategoryId||parsed.subcategory_id||null,
        merchantName:parsed.merchantName||parsed.merchant_name||'',
        notes:parsed.notes||'',
        date:parsed.date||(typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA')),
        paymentSourceId:parsed.paymentSourceId||'',
        paymentSourceName:parsed.paymentSourceName||'',
        paymentSourceType:parsed.paymentSourceType||''
      })
    : {
        id:gid(),
        name:parsed.name || 'Έξοδο',
        amount:Number(parsed.amount)||0,
        category:parsed.category || 'Άλλο',
        categoryId:parsed.categoryId||parsed.category_id||null,
        subcategoryId:parsed.subcategoryId||parsed.subcategory_id||null,
        merchantName:parsed.merchantName||parsed.merchant_name||'',
        notes:parsed.notes||'',
        date:parsed.date||(typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA')),
        paymentSourceId:parsed.paymentSourceId||'',
        paymentSourceName:parsed.paymentSourceName||'',
        paymentSourceType:parsed.paymentSourceType||''
      };

  if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(expense);
  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});

  const monthKey=expense.date.substring(0,7);
  ensM(monthKey);

  const canSave=await validateExpenseBeforeSave(expense,{errorTarget});
  if(!canSave)return false;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Αποθηκεύεται quick add...', 'Καταχωρώ την κίνηση στο budget.'))return false;

  let walletEffect=null;
  try{
    D.months[monthKey].daily.push(expense);

    walletEffect=await capvoApplyDailyExpenseWalletEffects(userId,expense,null);
    await saveDailyExpenseRow(userId,expense);
    if(typeof saveCreditCardPurchaseSideEffects==='function')await saveCreditCardPurchaseSideEffects(userId,expense);
    if(typeof persistCreditCardBalanceForPurchase==='function')await persistCreditCardBalanceForPurchase(userId,expense);

    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    curM=monthKey;

    if(errorTarget) clearQuickAddInlineError(errorTarget);

    render();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Το έξοδο προστέθηκε.');
    showMiniToast('✅ Το έξοδο προστέθηκε');

    return true;

  }catch(e){
    D.months[monthKey].daily=D.months[monthKey].daily.filter(x=>x.id!==expense.id);
    if(walletEffect?.rollback){
      try{await walletEffect.rollback();}catch(rollbackErr){console.error('quick add wallet rollback failed:',rollbackErr);}
    }

    console.error('quickAddExpense failed:',e);

    if(errorTarget){
      setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.',errorTarget);
    }else{
      showMiniToast('❌ Δεν μπόρεσα να αποθηκεύσω το έξοδο','error');
    }
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω το quick add.');

    return false;
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

function doExport(){const b=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='expense_tracker_'+(typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA'))+'.json';a.click();URL.revokeObjectURL(a.href)}

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

// ===== END 06b-save-actions.js =====
