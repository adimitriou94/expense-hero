// CAPVO app split: 03c-income.js
// Income sources: wallet effects, CRUD, validation, wizard
// Source: 03c-income.js lines 1-780

// CAPVO app split: 03c-income.js
// Income/Savings: income sources, savings goals, wallet effects for income
// Source: 03-render-dashboard-transactions-income.js lines 2243-3874

function updateIncomeDestinationHelp(){
  const help=$('incomeDestinationHint');
  const wallet=incomeDestinationWallet();
  if(!help)return;
  if(!wallet){
    help.textContent='Το έσοδο θα κατατεθεί στο wallet που θα επιλέξεις. Ο ρόλος budget βγαίνει από το wallet.';
    return;
  }
  const counts=typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(wallet):!wallet.isSavings;
  help.textContent=counts
    ? 'Ο προορισμός μετράει στο budget, άρα το διαθέσιμο budget θα αυξηθεί.'
    : 'Ο προορισμός είναι εκτός budget, άρα θα αυξηθεί μόνο το συνολικό υπόλοιπο.';
}

async function capvoApplyExtraIncomeWalletEffect(userId,obj,previous){
  if(!obj || obj.isRestricted || obj.sourceType==='benefit')return {applied:false,reason:'restricted'};
  if(!obj.destinationWalletId)return {applied:false,reason:'no_wallet'};

  const previousApplied=previous && previous.walletDepositApplied && previous.destinationWalletId && (Number(previous.walletBalanceEffectAmount)||0)>0;
  if(previousApplied){
    const oldWallet=capvoWalletById(previous.destinationWalletId);
    if(oldWallet){
      await capvoUpdateWalletBalance(oldWallet.id,capvoMoney((Number(oldWallet.currentBalance)||0)-(Number(previous.walletBalanceEffectAmount)||0)));
    }
  }

  const wallet=capvoWalletById(obj.destinationWalletId);
  if(!wallet)return {applied:false,reason:'wallet_missing'};

  const amount=Number(obj.amount)||0;
  if(amount<=0)return {applied:false,reason:'invalid_amount'};

  const before=Number(wallet.currentBalance)||0;
  const after=capvoMoney(before+amount);
  await capvoUpdateWalletBalance(wallet.id,after);

  obj.walletDepositApplied=true;
  obj.walletDepositAppliedAt=new Date().toISOString();
  obj.walletBalanceEffectAmount=amount;
  obj.includeInBudget=typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(wallet):!wallet.isSavings;
  obj.isSavings=!obj.includeInBudget;
  obj.allocationTarget=obj.includeInBudget?'spending_budget':'outside_budget';

  return {applied:true,wallet,amount,before,after};
}

async function capvoReverseExtraIncomeWalletEffect(previous){
  if(!previous || !previous.walletDepositApplied || !previous.destinationWalletId)return;
  const amount=Number(previous.walletBalanceEffectAmount)||Number(previous.amount)||0;
  if(amount<=0)return;
  const wallet=capvoWalletById(previous.destinationWalletId);
  if(!wallet)return;
  await capvoUpdateWalletBalance(wallet.id,capvoMoney((Number(wallet.currentBalance)||0)-amount));
}

async function saveIncomeSourceRow(userId,item){
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();

  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const payload={
    id:item.id,
    user_id:ownerUserId,
    user_chat_id:null, // legacy field — nullable after DB migration 2026-06-14
    name:item.name,
    amount:item.amount,
    category:item.category,
    income_type:item.incomeType,
    include_in_budget:item.includeInBudget,
    is_savings:item.isSavings,
    is_recurring:item.isRecurring,
    restriction:item.restriction,
    restricted_category:item.restrictedCategory||null,
    notes:item.notes||null,
    spending_limit:Number(item.spendingLimit)||null,
    source_type:item.sourceType||'income',
    source_category:item.sourceCategory||null,
    restriction_type:item.restrictionType||null,
    is_restricted:!!item.isRestricted,
    allocation_target:item.allocationTarget||null,
    is_primary_income:false,
    destination_wallet_id:item.destinationWalletId||null,
    wallet_deposit_applied:!!item.walletDepositApplied,
    wallet_deposit_applied_at:item.walletDepositAppliedAt||null,
    wallet_balance_effect_amount:Number(item.walletBalanceEffectAmount)||0,
    updated_at:new Date().toISOString()
  };

  let {error}=await supabaseClient
    .from('income_sources')
    .upsert(payload,{onConflict:'id'});

  if(error && /destination_wallet_id|wallet_deposit_applied|wallet_deposit_applied_at|wallet_balance_effect_amount/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.destination_wallet_id;
    delete legacyPayload.wallet_deposit_applied;
    delete legacyPayload.wallet_deposit_applied_at;
    delete legacyPayload.wallet_balance_effect_amount;
    const retry=await supabaseClient
      .from('income_sources')
      .upsert(legacyPayload,{onConflict:'id'});
    error=retry.error;
    if(!error)return {legacy:true};
  }

  if(error)throw error;
  return {legacy:false};
}

async function deleteIncomeSourceRow(id){
  const {error}=await supabaseClient
    .from('income_sources')
    .delete()
    .eq('id',id);

  if(error)throw error;
}

function setIncomeModalFeedback(message,type='error'){
  const el=$('incomeModalFeedback');
  if(!el)return;

  if(!message){
    el.textContent='';
    el.className='income-modal-feedback hidden';
    return;
  }

  el.textContent=message;
  el.className='income-modal-feedback '+type;
}

function clearIncomeValidation(){
  ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory','fISDestinationWallet'].forEach(id=>{
    const el=$(id);
    if(el)el.classList.remove('income-field-error');
  });
  setIncomeModalFeedback('');
}

function markIncomeFieldError(id){
  const el=$(id);
  if(!el)return;
  el.classList.add('income-field-error');
  try{el.focus({preventScroll:false});}catch(e){el.focus();}
}

function parseIncomeAmountValue(value){
  const normalized=String(value||'').trim().replace(',','.');
  if(!normalized)return NaN;
  const n=Number(normalized);
  return Number.isFinite(n)?capvoMoney(n):NaN;
}

function setIncomeSelectValue(id,value){
  const el=$(id);
  if(!el)return;
  el.value=value;
  el.dispatchEvent(new Event('change',{bubbles:true}));
}


function getIncomePresetConfig(type){
  const configs={
    salary:{
      icon:'💼',
      kicker:'Budget μήνα',
      title:'Budget μήνα',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget μήνα',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό μήνα',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget μήνα αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    budget:{
      icon:'💼',
      kicker:'Budget μήνα',
      title:'Budget μήνα',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget μήνα',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό μήνα',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget μήνα αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    other:{
      icon:'🏠',
      kicker:'Άλλο εισόδημα',
      title:'Άλλο εισόδημα',
      intro:'Για έξτρα χρήματα εκτός βασικού μισθού.',
      summaryTitle:'Άλλο εισόδημα',
      summaryText:'Freelance, ενοίκιο που εισπράττεις, επίδομα, bonus ή δεύτερη δουλειά.',
      amountLabel:'Ποσό εισοδήματος',
      amountHint:'Θα προστεθεί στο wallet προορισμού. Το budget impact βγαίνει από το wallet.',
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget μήνα.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό. Αν πληρώνεις ενοίκιο, καταχώρησέ το στα Πάγια.',
      saveText:'Αποθήκευση εσόδου',
      successText:'✅ Το έσοδο προστέθηκε',
      showRestricted:false,
      advancedHint:'Budget / επανάληψη'
    },
    benefit:{
      icon:'🎫',
      kicker:'Περιορισμένο υπόλοιπο',
      title:'Ticket / Voucher / Benefit',
      intro:'Για ποσά που χρησιμοποιούνται μόνο σε συγκεκριμένες αγορές.',
      summaryTitle:'Περιορισμένο υπόλοιπο',
      summaryText:'Ticket, Voucher, fuel card, gift card ή άλλο benefit που παρακολουθείται ξεχωριστά.',
      amountLabel:'Ποσό διαθέσιμο',
      amountHint:'Δεν αυξάνει το ελεύθερο budget. Θα εμφανίζεται ως ξεχωριστή πηγή πληρωμής.',
      spendingLimitHint:'Το όριο εξόδων δεν εφαρμόζεται σε Ticket / Voucher.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Διάλεξε κατηγορία αν χρησιμοποιείται μόνο π.χ. σε τρόφιμα ή μεταφορές.',
      saveText:'Αποθήκευση benefit',
      successText:'✅ Το περιορισμένο υπόλοιπο προστέθηκε',
      showRestricted:true,
      advancedHint:'Τύπος / περιορισμός'
    },
    ticket:{
      icon:'🎫',
      kicker:'Περιορισμένο υπόλοιπο',
      title:'Ticket / Voucher / Benefit',
      intro:'Για ποσά που χρησιμοποιούνται μόνο σε συγκεκριμένες αγορές.',
      summaryTitle:'Περιορισμένο υπόλοιπο',
      summaryText:'Ticket, Voucher, fuel card, gift card ή άλλο benefit που παρακολουθείται ξεχωριστά.',
      amountLabel:'Ποσό διαθέσιμο',
      amountHint:'Δεν αυξάνει το ελεύθερο budget. Θα εμφανίζεται ως ξεχωριστή πηγή πληρωμής.',
      spendingLimitHint:'Το όριο εξόδων δεν εφαρμόζεται σε Ticket / Voucher.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Διάλεξε κατηγορία αν χρησιμοποιείται μόνο π.χ. σε τρόφιμα ή μεταφορές.',
      saveText:'Αποθήκευση benefit',
      successText:'✅ Το περιορισμένο υπόλοιπο προστέθηκε',
      showRestricted:true,
      advancedHint:'Τύπος / περιορισμός'
    },
    voucher:{
      icon:'💳',
      kicker:'Περιορισμένο υπόλοιπο',
      title:'Ticket / Voucher / Benefit',
      intro:'Για ποσά που χρησιμοποιούνται μόνο σε συγκεκριμένες αγορές.',
      summaryTitle:'Περιορισμένο υπόλοιπο',
      summaryText:'Ticket, Voucher, fuel card, gift card ή άλλο benefit που παρακολουθείται ξεχωριστά.',
      amountLabel:'Ποσό διαθέσιμο',
      amountHint:'Δεν αυξάνει το ελεύθερο budget. Θα εμφανίζεται ως ξεχωριστή πηγή πληρωμής.',
      spendingLimitHint:'Το όριο εξόδων δεν εφαρμόζεται σε Ticket / Voucher.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Διάλεξε κατηγορία αν χρησιμοποιείται μόνο π.χ. σε τρόφιμα ή μεταφορές.',
      saveText:'Αποθήκευση benefit',
      successText:'✅ Το περιορισμένο υπόλοιπο προστέθηκε',
      showRestricted:true,
      advancedHint:'Τύπος / περιορισμός'
    },
    extra:{
      icon:'✨',
      kicker:'Έκτακτο ποσό',
      title:'Έκτακτο ποσό',
      intro:'Για χρήματα που λαμβάνεις μία φορά και δεν επαναλαμβάνονται κάθε κύκλο.',
      summaryTitle:'Έκτακτο ποσό',
      summaryText:'Δώρο, επιστροφή χρημάτων, πώληση αντικειμένου ή one-time bonus.',
      amountLabel:'Ποσό',
      amountHint:'Από προεπιλογή μετράει στο budget. Μπορείς να το βγάλεις από τις προχωρημένες ρυθμίσεις.',
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget μήνα.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση ποσού',
      successText:'✅ Το έκτακτο ποσό προστέθηκε',
      showRestricted:false,
      advancedHint:'Budget / επανάληψη'
    }
  };
  // v1.9.3.0: salary/basic budget is configured from the primary wallet,
  // not from the Extra income page. If old buttons/links ask for salary,
  // redirect the modal to an extra-income flow.
  if(type==='salary'||type==='budget')type='extra';
  return configs[type]||configs.extra||configs.other;
}

function setIncomeWizardMode(type,opts={}){
  const modal=document.querySelector('#mIncomeSource .income-source-modal');
  const cfg=getIncomePresetConfig(type);
  if(modal){
    modal.dataset.incomePreset=type;
    if(!opts.keepAdvanced)modal.dataset.advancedOpen='false';
    modal.classList.toggle('income-restricted-mode',!!cfg.showRestricted);
    modal.classList.toggle('income-budget-limit-mode',type==='salary'||type==='budget');
  }

  if($('incomeWizardIcon'))$('incomeWizardIcon').textContent=cfg.icon;
  if($('incomeModalKicker'))$('incomeModalKicker').textContent=cfg.kicker;
  if($('mIncomeSourceTitle'))$('mIncomeSourceTitle').textContent=cfg.title;
  if($('incomeModalIntro'))$('incomeModalIntro').textContent=cfg.intro;
  if($('incomeAmountLabel'))$('incomeAmountLabel').textContent=cfg.amountLabel;
  if($('incomeAmountHint'))$('incomeAmountHint').textContent=cfg.amountHint;
  if($('incomeNameLabel'))$('incomeNameLabel').textContent=cfg.nameLabel;
  if($('incomeSpendingLimitHint'))$('incomeSpendingLimitHint').textContent=cfg.spendingLimitHint||'';
  if($('incomeRestrictedCategoryLabel'))$('incomeRestrictedCategoryLabel').textContent=cfg.restrictedLabel;
  if($('incomeRestrictedHint'))$('incomeRestrictedHint').textContent=cfg.restrictedHint;
  if($('incomeAdvancedToggleHint'))$('incomeAdvancedToggleHint').textContent=cfg.advancedHint;
  if($('btnIncomeSource'))$('btnIncomeSource').textContent=cfg.saveText;
  if($('incomeWizardSummary')){
    $('incomeWizardSummary').innerHTML=`<strong>${esc(cfg.summaryTitle)}</strong><span>${esc(cfg.summaryText)}</span>`;
  }

  if($('incomeDestinationCard'))$('incomeDestinationCard').style.display=cfg.showRestricted?'none':'block';
  fillIncomeDestinationWalletSelect?.($('fISDestinationWallet')?.value||'');
  updateIncomeDestinationHelp?.();

  document.querySelectorAll('#incomeQuickPresets button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.incomePreset===type);
  });
}

function inferIncomePresetFromSource(i){
  if(!i)return 'salary';
  const sourceType=typeof capvoInferMoneySourceType==='function'?capvoInferMoneySourceType(i):(i.sourceType||'income');
  if(sourceType==='budget_cycle')return 'salary';
  if(sourceType==='benefit')return 'benefit';
  if(sourceType==='one_time')return 'extra';
  if(i.restriction==='food_only' || i.category==='Ticket Restaurant')return 'benefit';
  if(i.restriction==='card_only' || i.category==='Άυλη κάρτα')return 'benefit';
  if(i.isRecurring===false)return 'extra';
  return 'other';
}

function getCurrentIncomeWizardMode(){
  return document.querySelector('#mIncomeSource .income-source-modal')?.dataset.incomePreset || 'salary';
}

function toggleIncomeAdvanced(force){
  const modal=document.querySelector('#mIncomeSource .income-source-modal');
  if(!modal)return;
  const next=typeof force==='boolean'?force:modal.dataset.advancedOpen!=='true';
  modal.dataset.advancedOpen=next?'true':'false';
  if($('incomeAdvancedToggle')){
    $('incomeAdvancedToggle').classList.toggle('is-open',next);
  }
  setTimeout(()=>refreshIncomeCustomPickers?.(),30);
}

function applyIncomePreset(type){
  clearIncomeValidation();
  if(type==='salary'||type==='budget')type='extra';

  const presets={
    salary:{
      name:'Μισθός / Budget',
      category:'Μισθός',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:true,
      sourceType:'budget_cycle',
      sourceCategory:'primary_budget',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    budget:{
      name:'Μισθός / Budget',
      category:'Μισθός',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:true,
      sourceType:'budget_cycle',
      sourceCategory:'primary_budget',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    other:{
      name:'Άλλο εισόδημα',
      category:'Άλλο',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'income',
      sourceCategory:'other_income',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    benefit:{
      name:'Ticket / Voucher',
      category:'Ticket Restaurant',
      incomeType:'voucher',
      restriction:'food_only',
      restrictedCategory:'Τρόφιμα',
      includeInBudget:false,
      isSavings:false,
      isRecurring:true,
      notes:'Περιορισμένη πηγή πληρωμής',
      isPrimaryIncome:false,
      sourceType:'benefit',
      sourceCategory:'benefit',
      restrictionType:'benefit',
      isRestricted:true,
      allocationTarget:'restricted_balance'
    },
    ticket:{
      name:'Ticket Restaurant',
      category:'Ticket Restaurant',
      incomeType:'voucher',
      restriction:'food_only',
      restrictedCategory:'Τρόφιμα',
      includeInBudget:false,
      isSavings:false,
      isRecurring:true,
      notes:'Χρήση για φαγητό / τρόφιμα',
      isPrimaryIncome:false,
      sourceType:'benefit',
      sourceCategory:'ticket',
      restrictionType:'ticket',
      isRestricted:true,
      allocationTarget:'restricted_balance'
    },
    voucher:{
      name:'Voucher',
      category:'Άυλη κάρτα',
      incomeType:'voucher',
      restriction:'card_only',
      restrictedCategory:'',
      includeInBudget:false,
      isSavings:false,
      isRecurring:true,
      notes:'Περιορισμένη πηγή πληρωμής',
      isPrimaryIncome:false,
      sourceType:'benefit',
      sourceCategory:'voucher',
      restrictionType:'voucher',
      isRestricted:true,
      allocationTarget:'restricted_balance'
    },
    extra:{
      name:'Bonus / έκτακτο',
      category:'Bonus',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:false,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'one_time',
      sourceCategory:'bonus',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    rent:{
      name:'Ενοίκιο που εισπράττω',
      category:'Ενοίκιο',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'income',
      sourceCategory:'rent_income',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    dividends:{
      name:'Μερίσματα',
      category:'Μερίσματα',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:false,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'one_time',
      sourceCategory:'dividends',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    }
  };

  const preset=presets[type]||presets.extra||presets.other;
  setIncomeWizardMode(type);

  const currentAmount=$('fISAmount')?.value || '';
  $('fISName').value=preset.name;
  if($('fISAmount'))$('fISAmount').value=currentAmount;
  if($('fISSpendingLimit') && type!=='salary' && type!=='budget')$('fISSpendingLimit').value='';
  setIncomeSelectValue('fISCategory',preset.category);
  setIncomeSelectValue('fISType',preset.incomeType);
  setIncomeSelectValue('fISRestriction',preset.restriction);
  setIncomeSelectValue('fISRestrictedCategory',preset.restrictedCategory);
  $('fISIncludeBudget').checked=!!preset.includeInBudget;
  $('fISSavings').checked=!!preset.isSavings;
  $('fISRecurring').checked=!!preset.isRecurring;
  if($('fISPrimary'))$('fISPrimary').checked=!!preset.isPrimaryIncome;
  $('fISNotes').value=preset.notes||'';

  fillIncomeDestinationWalletSelect?.($('fISDestinationWallet')?.value||'');
  updateIncomeDestinationHelp?.();
  refreshIncomeCustomPickers?.();

  // Do not auto-focus amount after preset; keep keyboard closed until user taps a field.
}

function validateIncomeSourceForm(){
  clearIncomeValidation();

  const name=$('fISName').value.trim();
  const rawAmount=$('fISAmount').value;
  const amount=parseIncomeAmountValue(rawAmount);
  const mode=getCurrentIncomeWizardMode();

  if(!name){
    setIncomeModalFeedback('Συμπλήρωσε όνομα, π.χ. Bonus, Ενοίκιο, Μερίσματα.','error');
    showMiniToast('Συμπλήρωσε όνομα πηγής','error');
    markIncomeFieldError('fISName');
    return null;
  }

  if(String(rawAmount||'').trim()===''){
    setIncomeModalFeedback('Συμπλήρωσε ποσό εισοδήματος.','error');
    showMiniToast('Συμπλήρωσε ποσό','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  if(!Number.isFinite(amount) || amount<=0){
    setIncomeModalFeedback('Το ποσό πρέπει να είναι μεγαλύτερο από 0.','error');
    showMiniToast('Το ποσό δεν είναι έγκυρο','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  const incomeType=$('fISType').value;
  const restriction=$('fISRestriction').value;
  const category=$('fISCategory').value;
  const isBenefit=mode==='benefit'||mode==='ticket'||mode==='voucher'||category==='Ticket Restaurant'||category==='Άυλη κάρτα';
  const destinationWalletId=$('fISDestinationWallet')?.value||'';
  const destinationWallet=destinationWalletId?capvoWalletById(destinationWalletId):null;

  if(!isBenefit && !destinationWalletId){
    setIncomeModalFeedback('Επίλεξε σε ποιο wallet μπήκαν αυτά τα χρήματα.','error');
    showMiniToast('Επίλεξε προορισμό','error');
    markIncomeFieldError('fISDestinationWallet');
    return null;
  }

  const sourceType=isBenefit?'benefit':(mode==='extra'||!$('fISRecurring')?.checked?'one_time':'income');
  const sourceCategory=isBenefit
    ? (category==='Ticket Restaurant'?'ticket':category==='Άυλη κάρτα'?'voucher':'benefit')
    : category==='Ενοίκιο'?'rent_income'
      : category==='Μερίσματα'?'dividends'
      : category==='Freelance'?'freelance'
      : category.includes('Δώρο')?'bonus'
      : category==='Bonus'?'bonus'
      : category==='Επιστροφή χρημάτων'?'refund'
      : category==='Πώληση αντικειμένου'?'sale'
      : 'other_income';

  const isRestricted=isBenefit || (restriction&&restriction!=='none');
  const restrictionType=isBenefit?(category==='Ticket Restaurant'?'ticket':category==='Άυλη κάρτα'?'voucher':'benefit'):null;
  const includeInBudget=!isBenefit && destinationWallet ? (typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(destinationWallet):!destinationWallet.isSavings) : false;
  const isSavings=!isBenefit && !includeInBudget;

  return {
    name,
    amount,
    spendingLimit:0,
    incomeType,
    restriction:isBenefit?restriction:'none',
    includeInBudget,
    isSavings,
    isPrimaryIncome:false,
    sourceType,
    sourceCategory,
    restrictionType,
    isRestricted,
    allocationTarget:isBenefit?'restricted_balance':includeInBudget?'spending_budget':'outside_budget',
    destinationWalletId:isBenefit?null:destinationWalletId
  };
}

async function saveIncomeSource(){
  const id=$('fISID').value;
  const validation=validateIncomeSourceForm();
  if(!validation)return;

  const userId=getDataOwnerId();
  const btn=$('btnIncomeSource');

  if(!userId){
    showMiniToast('❌ Δεν υπάρχει ενεργή σύνδεση Google','error');
    return;
  }

  const previous=id?(D.incomeSources||[]).find(x=>String(x.id)===String(id)):null;
  const obj={
    id:id||gid(),
    name:validation.name,
    amount:validation.amount,
    spendingLimit:0,
    category:$('fISCategory').value,
    incomeType:validation.incomeType,
    includeInBudget:validation.includeInBudget,
    isSavings:validation.isSavings,
    isRecurring:$('fISRecurring')?.checked!==false,
    restriction:validation.restriction,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim(),
    isPrimaryIncome:false,
    sourceType:validation.sourceType,
    sourceCategory:validation.sourceCategory,
    restrictionType:validation.restrictionType,
    isRestricted:validation.isRestricted,
    allocationTarget:validation.allocationTarget,
    destinationWalletId:validation.destinationWalletId,
    walletDepositApplied:false,
    walletDepositAppliedAt:null,
    walletBalanceEffectAmount:0
  };

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(id?'Ενημερώνεται έσοδο...':'Αποθηκεύεται έσοδο...', 'Περνάω την κίνηση στο σωστό wallet.'))return;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent=id?'Ενημέρωση...':'Αποθήκευση...';
    }

    if(obj.isRestricted && previous?.walletDepositApplied){
      await capvoReverseExtraIncomeWalletEffect(previous);
    }

    const initialSave=await saveIncomeSourceRow(userId,obj);
    let applyResult={applied:false,reason:'restricted'};
    if(!obj.isRestricted && initialSave?.legacy!==true){
      applyResult=await capvoApplyExtraIncomeWalletEffect(userId,obj,previous);
      await saveIncomeSourceRow(userId,obj);
    }else if(!obj.isRestricted && initialSave?.legacy===true){
      showMiniToast('Το έσοδο αποθηκεύτηκε, αλλά χρειάζεται SQL migration για να περαστεί στο wallet.','error');
    }

    if(id){
      const idx=D.incomeSources.findIndex(x=>x.id===id);
      if(idx>=0)D.incomeSources[idx]=obj;
    }else{
      if(!D.incomeSources)D.incomeSources=[];
      D.incomeSources.push(obj);
    }

    if(typeof fetchAllData==='function')await fetchAllData(userId);
    else refreshComputedIncome();

    closeM();
    render();
    if(typeof updateCapvoDashboardSetupPrompt==='function')updateCapvoDashboardSetupPrompt();

    const suffix=applyResult.applied && applyResult.wallet ? ` · μπήκε στο ${applyResult.wallet.name}` : '';
    const successMsg=id?`✅ Το έσοδο ενημερώθηκε${suffix}`:`✅ Το έσοδο προστέθηκε${suffix}`;
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast(successMsg);

  }catch(e){
    console.error('saveIncomeSource failed:',e);
    setIncomeModalFeedback('Δεν μπόρεσα να αποθηκεύσω το έσοδο. Δοκίμασε ξανά.','error');
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω το έσοδο.');
    showMiniToast('❌ Αποτυχία αποθήκευσης','error');

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.textContent=id?'Ενημέρωση εσόδου':getIncomePresetConfig(getCurrentIncomeWizardMode()).saveText;
    }
  }
}

async function deleteIncomeSource(id){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή εισοδήματος',
    message:'Θέλεις να διαγράψεις αυτή την πηγή εισοδήματος;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Διαγράφεται έσοδο...', 'Ενημερώνω το wallet και τα στοιχεία σου.'))return;

  try{
    const previous=(D.incomeSources||[]).find(i=>String(i.id)===String(id));
    await capvoReverseExtraIncomeWalletEffect(previous);
    await deleteIncomeSourceRow(id);

    D.incomeSources=(D.incomeSources||[]).filter(i=>i.id!==id);

    refreshComputedIncome();
    render();

    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Το έσοδο διαγράφηκε.');
    showMiniToast('✅ Η πηγή εισοδήματος διαγράφηκε');

  }catch(e){
    console.error('deleteIncomeSource failed:',e);

    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να διαγράψω το έσοδο.');
    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

// v1.0.11 — clear inline validation while user edits Add Income/Budget fields
(function setupIncomeSourceValidationCleanup(){
  function bind(){
    ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory','fISDestinationWallet'].forEach(id=>{
      const el=$(id);
      if(!el || el.dataset.incomeValidationCleanup==='1')return;
      el.dataset.incomeValidationCleanup='1';
      el.addEventListener('input',()=>{
        el.classList.remove('income-field-error');
        setIncomeModalFeedback?.('');
      });
      el.addEventListener('change',()=>{
        el.classList.remove('income-field-error');
        setIncomeModalFeedback?.('');
      });
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();

// ===== END 03c-income.js =====
