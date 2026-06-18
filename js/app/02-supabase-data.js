// CAPVO app split: 02-supabase-data.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== SUPABASE DATA OPERATIONS =====
function getFinanceUserId(explicitUserId){
  return String(explicitUserId || getDataOwnerId() || '').trim();
}

function legacyUserChatId(){
  return String((typeof getLegacyOwnerId==='function' ? getLegacyOwnerId() : '') || '').trim();
}

async function fetchAllData(userId){
  const ownerUserId=getFinanceUserId(userId);

  try{
    if(!ownerUserId){
      D={income:0,incomeSources:[],fixedExpenses:[],fixedExpenseArchive:[],fixedExpensePayments:[],creditCards:[],creditCardTransactions:[],creditCardInstallmentPlans:[],creditCardInstallmentItems:[],months:{},preferences:{budgetCycleType:'fixed_day',budgetCycleStartDay:1,currency:'EUR',language:'el',onboardingCompleted:false,onboardingDismissed:false,onboardingStep:''},budgetCycles:[],budgetCycleIncomes:[],budgetCycleCarryovers:[],holidaysByYear:{},holidaysLoadedYears:{},holidayFetchStatus:'idle'};
      refreshComputedIncome();
      return;
    }

    const {data:prefRows,error:errPrefs}=await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id',ownerUserId)
      .limit(1);

    if(errPrefs)throw errPrefs;

    const prefs=(prefRows||[])[0]||{};
    D.preferences={
      budgetCycleType:normalizeBudgetCycleType(prefs.budget_cycle_type),
      budgetCycleStartDay:capvoClampCycleDay(prefs.budget_cycle_start_day||1),
      currency:prefs.currency||'EUR',
      language:prefs.language||'el',
      onboardingCompleted:!!prefs.onboarding_completed,
      onboardingDismissed:!!prefs.onboarding_dismissed,
      onboardingStep:prefs.onboarding_step||'',
      onboardingCompletedAt:prefs.onboarding_completed_at||''
    };

    if(typeof capvoEnsureBudgetCycleHolidays==='function'){
      await capvoEnsureBudgetCycleHolidays();
    }

    const {data:incomeSources,error:errIncomeSources}=await supabaseClient
      .from('income_sources')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errIncomeSources)throw errIncomeSources;

    D.incomeSources=(incomeSources||[]).map(i=>{
      const rawNotes=i.notes||'';
      const sourceType=i.source_type || (typeof capvoInferMoneySourceType==='function'?capvoInferMoneySourceType(i):'income');
      const isBenefit=sourceType==='benefit';
      const restriction=i.restriction || (isBenefit?'specific_category':'none');
      const dbLimit=Number(i.spending_limit)||0;

      return {
        id:i.id,
        name:i.name,
        amount:Number(i.amount)||0,
        category:i.category||'Άλλο',
        incomeType:i.income_type||'cash',
        includeInBudget:typeof i.include_in_budget==='boolean'?i.include_in_budget:!isBenefit,
        isSavings:!!i.is_savings,
        isRecurring:typeof i.is_recurring==='boolean'?i.is_recurring:true,
        restriction,
        restrictedCategory:i.restricted_category||'',
        notes:typeof capvoStripSpendingLimitFromNotes==='function'?capvoStripSpendingLimitFromNotes(rawNotes):rawNotes,
        spendingLimit:dbLimit>0?dbLimit:(typeof capvoParseSpendingLimitFromNotes==='function'?capvoParseSpendingLimitFromNotes(rawNotes):0),
        isPrimaryIncome:!!i.is_primary_income,
        sourceType,
        sourceCategory:i.source_category || (typeof capvoInferMoneySourceCategory==='function'?capvoInferMoneySourceCategory(i,sourceType):''),
        restrictionType:i.restriction_type || (isBenefit?'benefit':null),
        isRestricted:typeof i.is_restricted==='boolean'?i.is_restricted:isBenefit,
        allocationTarget:i.allocation_target || (isBenefit?'restricted_balance':((typeof i.include_in_budget==='boolean'?i.include_in_budget:true)?'spending_budget':'outside_budget')),
        destinationWalletId:i.destination_wallet_id||null,
        walletDepositApplied:!!i.wallet_deposit_applied,
        walletDepositAppliedAt:i.wallet_deposit_applied_at||null,
        walletBalanceEffectAmount:Object.prototype.hasOwnProperty.call(i,'wallet_balance_effect_amount') ? Number(i.wallet_balance_effect_amount)||0 : 0
      };
    });

    const {data:budgetCycles,error:errBudgetCycles}=await supabaseClient
      .from('budget_cycles')
      .select('*')
      .eq('user_id',ownerUserId)
      .order('start_date',{ascending:false});

    if(errBudgetCycles)throw errBudgetCycles;

    D.budgetCycles=(budgetCycles||[]).map(c=>({
      id:c.id,
      userId:c.user_id,
      startDate:c.start_date,
      endDate:c.end_date,
      cycleKey:c.cycle_key,
      source:c.source||'normal',
      primaryIncomeSourceId:c.primary_income_source_id||'',
      primaryIncomeAmount:Number(c.primary_income_amount)||0,
      note:c.note||'',
      createdAt:c.created_at||'',
      updatedAt:c.updated_at||''
    }));

    const {data:cycleIncomes,error:errCycleIncomes}=await supabaseClient
      .from('budget_cycle_incomes')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errCycleIncomes)throw errCycleIncomes;

    D.budgetCycleIncomes=(cycleIncomes||[]).map(i=>({
      id:i.id,
      userId:i.user_id,
      cycleId:i.cycle_id,
      incomeSourceId:i.income_source_id||'',
      name:i.name||'',
      amount:Number(i.amount)||0,
      incomeType:i.income_type||'',
      destinationWalletId:i.destination_wallet_id||null,
      walletDepositApplied:!!i.wallet_deposit_applied,
      walletDepositAppliedAt:i.wallet_deposit_applied_at||null,
      walletBalanceBefore:Object.prototype.hasOwnProperty.call(i,'wallet_balance_before')?Number(i.wallet_balance_before)||0:null,
      walletBalanceAfter:Object.prototype.hasOwnProperty.call(i,'wallet_balance_after')?Number(i.wallet_balance_after)||0:null,
      createdAt:i.created_at||''
    }));

    try{
      const {data:carryovers,error:errCarryovers}=await supabaseClient
        .from('budget_cycle_carryovers')
        .select('*')
        .eq('user_id',ownerUserId);

      if(errCarryovers)throw errCarryovers;

      D.budgetCycleCarryovers=(carryovers||[]).map(c=>({
        id:c.id,
        userId:c.user_id,
        fromCycleKey:c.from_cycle_key,
        fromCycleStart:c.from_cycle_start,
        fromCycleEnd:c.from_cycle_end,
        toCycleKey:c.to_cycle_key,
        toCycleStart:c.to_cycle_start,
        toCycleEnd:c.to_cycle_end,
        amount:Number(c.amount)||0,
        action:c.action||'skip',
        note:c.note||'',
        createdAt:c.created_at||'',
        updatedAt:c.updated_at||''
      }));
    }catch(errCarryovers){
      D.budgetCycleCarryovers=[];
      console.warn('[CAPVO] budget_cycle_carryovers unavailable. Run v1.1.4.3 SQL migration.',errCarryovers?.message||errCarryovers);
    }



    try{
      const {data:goals,error:errGoals}=await supabaseClient
        .from('savings_goals')
        .select('*')
        .eq('user_id',ownerUserId)
        .order('created_at',{ascending:false});

      if(errGoals)throw errGoals;

      D.savingsGoals=(goals||[]).map(g=>({
        id:g.id,
        userId:g.user_id,
        name:g.name||'Στόχος',
        icon:g.icon||'🏦',
        targetAmount:Number(g.target_amount)||0,
        currentAmount:Number(g.current_amount)||0,
        targetDate:g.target_date||'',
        goalType:g.goal_type||'general',
        isDefault:!!g.is_default,
        isArchived:!!g.is_archived,
        notes:g.notes||'',
        status:g.status||'',
        completedAt:g.completed_at||'',
        createdAt:g.created_at||'',
        updatedAt:g.updated_at||''
      }));

      const {data:txs,error:errTxs}=await supabaseClient
        .from('savings_transactions')
        .select('*')
        .eq('user_id',ownerUserId)
        .order('created_at',{ascending:false});

      if(errTxs)throw errTxs;

      D.savingsTransactions=(txs||[]).map(t=>({
        id:t.id,
        userId:t.user_id,
        goalId:t.goal_id,
        amount:Number(t.amount)||0,
        type:t.type||'deposit',
        source:t.source||'manual',
        note:t.note||'',
        relatedCycleKey:t.related_cycle_key||'',
        createdAt:t.created_at||''
      }));
    }catch(errSavings){
      D.savingsGoals=[];
      D.savingsTransactions=[];
      console.warn('[CAPVO] savings tables unavailable. Run v1.1.5.1 SQL migration.',errSavings?.message||errSavings);
    }

    refreshComputedIncome();

    const {data:fixed,error:errFixed}=await supabaseClient
      .from('fixed_expenses')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errFixed)throw errFixed;

    const fixedRows=(fixed||[])
      .map(e=>({
        id:e.id,
        name:e.name,
        amount:Number(e.amount)||0,
        category:e.category||'Άλλο',
        effectiveFromDate:e.effective_from_date||'',
        scheduleType:e.schedule_type||'monthly',
        dueDay:e.due_day||null,
        nextDueDate:e.next_due_date||'',
        sourceWalletId:e.source_wallet_id||'',
        autoPay:!!e.auto_pay,
        lastPaidAt:e.last_paid_at||'',
        deletedAt:e.deleted_at||'',
        createdAt:e.created_at||'',
        updatedAt:e.updated_at||''
      }))
      .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a));

    D.fixedExpenseArchive=fixedRows;
    D.fixedExpenses=fixedRows.filter(e=>!e.deletedAt);

    try{
      const {data:fixedPayments,error:errFixedPayments}=await supabaseClient
        .from('fixed_expense_payments')
        .select('*')
        .eq('user_id',ownerUserId)
        .order('paid_at',{ascending:false});
      if(errFixedPayments)throw errFixedPayments;
      D.fixedExpensePayments=(fixedPayments||[]).map(p=>({
        id:p.id,
        userId:p.user_id,
        fixedExpenseId:p.fixed_expense_id,
        walletId:p.wallet_id,
        amount:Number(p.amount)||0,
        paidForDate:p.paid_for_date||'',
        paidAt:p.paid_at||'',
        status:p.status||'paid',
        note:p.note||'',
        walletBalanceBefore:Number(p.wallet_balance_before)||0,
        walletBalanceAfter:Number(p.wallet_balance_after)||0,
        createdAt:p.created_at||''
      }));
    }catch(errFixedPayments){
      D.fixedExpensePayments=[];
      console.warn('[CAPVO] fixed_expense_payments unavailable. Run v1.9.6.0 SQL migration.',errFixedPayments?.message||errFixedPayments);
    }

    const {data:cards,error:errCards}=await supabaseClient
      .from('credit_cards')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errCards)throw errCards;

    D.creditCards=(cards||[]).map(c=>({
      id:c.id,
      name:c.name,
      balance:Number(c.balance)||0,
      rate:Number(c.rate)||0,
      minPay:Number(c.min_pay)||0,
      limit:Number(c.limit_amount)||0,
      chosenPay:Number(c.chosen_pay)||0,
      accountType:c.account_type||'credit_card',
      bankName:c.bank_name||'',
      statementDay:c.statement_day||null,
      paymentDueDay:c.payment_due_day||null,
      paymentDueDate:c.payment_due_date||'',
      isActive:c.is_active!==false,
      notes:c.notes||'',
      lastPaymentDate:c.last_payment_date||'',
      budgetTreatment:c.budget_treatment||'payment_only',
      loanType:c.loan_type||'',
      loanPurpose:c.loan_purpose||'',
      originalAmount:Number(c.original_amount)||0
    }));

    const {data:ccTx,error:errCcTx}=await supabaseClient
      .from('credit_card_transactions')
      .select('*')
      .eq('user_id',ownerUserId)
      .order('transaction_date',{ascending:false});

    if(errCcTx)throw errCcTx;

    D.creditCardTransactions=(ccTx||[]).map(t=>({
      id:t.id,
      cardId:t.card_id,
      expenseId:t.expense_id||'',
      installmentPlanId:t.installment_plan_id||'',
      type:t.type,
      amount:Number(t.amount)||0,
      transactionDate:t.transaction_date,
      description:t.description||'',
      category:t.category||'',
      affectsBudget:!!t.affects_budget,
      budgetEffectType:t.budget_effect_type||'none',
      walletId:t.wallet_id||'',
      walletNameSnapshot:t.wallet_name_snapshot||'',
      walletBalanceBefore:Object.prototype.hasOwnProperty.call(t,'wallet_balance_before') ? Number(t.wallet_balance_before)||0 : null,
      walletBalanceAfter:Object.prototype.hasOwnProperty.call(t,'wallet_balance_after') ? Number(t.wallet_balance_after)||0 : null,
      walletBalanceEffectAmount:Object.prototype.hasOwnProperty.call(t,'wallet_balance_effect_amount') ? Number(t.wallet_balance_effect_amount)||0 : null,
      createdAt:t.created_at||''
    }));

    const {data:plans,error:errPlans}=await supabaseClient
      .from('credit_card_installment_plans')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errPlans)throw errPlans;

    D.creditCardInstallmentPlans=(plans||[]).map(p=>({
      id:p.id,
      cardId:p.card_id,
      originalExpenseId:p.original_expense_id||'',
      originalTransactionId:p.original_transaction_id||'',
      title:p.title,
      category:p.category||'',
      totalAmount:Number(p.total_amount)||0,
      installmentCount:Number(p.installment_count)||1,
      installmentAmount:Number(p.installment_amount)||0,
      paidInstallments:Number(p.paid_installments)||0,
      firstDueDate:p.first_due_date||'',
      nextDueDate:p.next_due_date||'',
      interestFree:p.interest_free!==false,
      interestRate:Number(p.interest_rate)||0,
      affectsBudgetMode:p.affects_budget_mode||'installment_only',
      status:p.status||'active',
      notes:p.notes||''
    }));

    const {data:items,error:errItems}=await supabaseClient
      .from('credit_card_installment_items')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errItems)throw errItems;

    D.creditCardInstallmentItems=(items||[]).map(i=>({
      id:i.id,
      planId:i.plan_id,
      cardId:i.card_id,
      installmentNo:Number(i.installment_no)||1,
      dueDate:i.due_date||'',
      amount:Number(i.amount)||0,
      status:i.status||'pending',
      paidAt:i.paid_at||'',
      paymentTransactionId:i.payment_transaction_id||''
    }));

    const {data:daily,error:errDaily}=await supabaseClient
      .from('expenses')
      .select('*')
      .eq('user_id',ownerUserId);

    if(errDaily)throw errDaily;

    D.months={};

    (daily||[]).forEach(e=>{
      const mk=e.month_key||(e.date?e.date.substring(0,7):curMK());
      if(!D.months[mk])D.months[mk]={daily:[]};
      D.months[mk].daily.push({
        id:e.id,
        name:e.name,
        amount:Number(e.amount)||0,
        category:e.category,
        categoryId:e.category_id||null,
        subcategoryId:e.subcategory_id||null,
        merchantName:e.merchant_name||'',
        notes:e.notes||'',
        date:e.date,
        paymentSourceId:e.payment_source_id||'',
        paymentSourceName:e.payment_source_name||'',
        paymentSourceType:e.payment_source_type||'',
        paymentAccountType:e.payment_account_type||'cash',
        creditCardId:e.credit_card_id||'',
        creditCardTransactionId:e.credit_card_transaction_id||'',
        installmentPlanId:e.installment_plan_id||'',
        affectsCashBudget:e.affects_cash_budget!==false,
        isCreditCardPurchase:!!e.is_credit_card_purchase,
        purchaseMode:e.purchase_mode||'normal',
        installmentCount:e.installment_count||null,
        interestFree:e.interest_free!==false,
        installmentRate:Number(e.installment_rate)||0,
        installmentAmount:Number(e.installment_amount)||0,
        walletId:e.wallet_id||null,
        budgetEffectAmount:Object.prototype.hasOwnProperty.call(e,'budget_effect_amount') ? Number(e.budget_effect_amount)||0 : null,
        walletBalanceEffectAmount:Object.prototype.hasOwnProperty.call(e,'wallet_balance_effect_amount') ? Number(e.wallet_balance_effect_amount)||0 : 0
      });
    });

    // ── Phase 2: Wallets ────────────────────────────────────────────
    const {data:walletsData,error:errWallets}=await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id',ownerUserId)
      .order('sort_order',{ascending:true});

    if(errWallets){
      console.warn('[CAPVO] wallets fetch skipped:',errWallets.message);
      D.wallets=D.wallets||[];
    } else {
      D.wallets=(walletsData||[]).map(w=>({
        id:w.id,
        userId:w.user_id,
        name:w.name,
        type:w.type||'bank',
        color:w.color||'#6547f6',
        icon:w.icon||'🏦',
        currentBalance:Number(w.current_balance)||0,
        includeInTotal:w.include_in_total!==false,
        includeInBudget:Object.prototype.hasOwnProperty.call(w,'include_in_budget') ? w.include_in_budget!==false : undefined,
        isSavings:!!w.is_savings,
        isPrimaryBudget:!!w.is_primary_budget,
        budgetRole:w.budget_role||null,
        cycleIncomeAmount:Object.prototype.hasOwnProperty.call(w,'cycle_income_amount') ? Number(w.cycle_income_amount)||0 : 0,
        isDefault:!!w.is_default,
        sortOrder:Number(w.sort_order)||0,
        isActive:w.is_active!==false,
        notes:w.notes||''
      }));
    }

    // ── Phase 2: Wallet Transfers ───────────────────────────────────
    const {data:transfersData,error:errTransfers}=await supabaseClient
      .from('wallet_transfers')
      .select('*')
      .eq('user_id',ownerUserId)
      .order('date',{ascending:false})
      .limit(200);

    if(errTransfers){
      console.warn('[CAPVO] wallet_transfers fetch skipped:',errTransfers.message);
      D.walletTransfers=D.walletTransfers||[];
    } else {
      D.walletTransfers=(transfersData||[]).map(t=>({
        id:t.id,
        fromWalletId:t.from_wallet_id,
        toWalletId:t.to_wallet_id,
        amount:Number(t.amount)||0,
        date:t.date||'',
        note:t.note||'',
        transferType:t.transfer_type||'transfer',
        budgetImpactAmount:Object.prototype.hasOwnProperty.call(t,'budget_effect_amount') ? Number(t.budget_effect_amount)||0 : null,
        fromCountsInBudgetSnapshot:Object.prototype.hasOwnProperty.call(t,'from_include_in_budget_snapshot') ? !!t.from_include_in_budget_snapshot : null,
        toCountsInBudgetSnapshot:Object.prototype.hasOwnProperty.call(t,'to_include_in_budget_snapshot') ? !!t.to_include_in_budget_snapshot : null,
        createdAt:t.created_at||''
      }));
    }

    // ── Phase 2: Expense Categories ─────────────────────────────────
    const {data:catsData,error:errCats}=await supabaseClient
      .from('expense_categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${ownerUserId}`)
      .eq('is_active',true)
      .order('sort_order',{ascending:true});

    if(errCats){
      console.warn('[CAPVO] expense_categories fetch skipped:',errCats.message);
      D.expenseCategories=D.expenseCategories||[];
    } else {
      D.expenseCategories=(catsData||[]).map(c=>({
        id:c.id,
        userId:c.user_id||null,
        name:c.name,
        icon:c.icon||'📌',
        color:c.color||'#888780',
        cssClass:c.css_class||'cat-other',
        sortOrder:Number(c.sort_order)||0,
        isSystem:!!c.is_system,
        parentId:c.parent_id||null,
        keywords:Array.isArray(c.keywords)?c.keywords:[]
      }));
    }

  }catch(e){
    console.error('Fetch error:',e);
    throw e;
  }
}

async function syncIncomeSources(userId){
  const ownerUserId=getFinanceUserId(userId);
  const legacyOwner=legacyUserChatId() || ownerUserId;

  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  if(!Array.isArray(D.incomeSources)){
    D.incomeSources=[];
  }

  if(D.incomeSources.length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .upsert(
        D.incomeSources.map(i=>({
          id:i.id,
          user_id:ownerUserId,
          user_chat_id:null, // legacy field — nullable after DB migration 2026-06-14
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
          spending_limit:Number(i.spendingLimit)||null,
          source_type:i.sourceType||'income',
          source_category:i.sourceCategory||null,
          restriction_type:i.restrictionType||null,
          is_restricted:!!i.isRestricted,
          allocation_target:i.allocationTarget||null,
          is_primary_income:!!i.isPrimaryIncome,
          destination_wallet_id:i.destinationWalletId||null,
          wallet_deposit_applied:!!i.walletDepositApplied,
          wallet_deposit_applied_at:i.walletDepositAppliedAt||null,
          wallet_balance_effect_amount:Number(i.walletBalanceEffectAmount)||0,
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );

    if(error)throw error;
  }

  const {data:dbRows,error:fetchError}=await supabaseClient
    .from('income_sources')
    .select('id')
    .eq('user_id',ownerUserId);

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
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)return;

  try{
    refreshComputedIncome();

    await syncIncomeSources(ownerUserId);

    if(D.fixedExpenses.length>0){
      const {error}=await supabaseClient.from('fixed_expenses').upsert(
        D.fixedExpenses.map(e=>({
          id:e.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:e.name,
          amount:e.amount,
          category:e.category
        })),
        {onConflict:'id'}
      );
      if(error)throw error;
    }

    const {data:dbFixed,error:fixedFetchError}=await supabaseClient
      .from('fixed_expenses')
      .select('id')
      .eq('user_id',ownerUserId);
    if(fixedFetchError)throw fixedFetchError;

    const fixedIds=new Set(D.fixedExpenses.map(e=>e.id));
    const fixedToDelete=(dbFixed||[]).filter(e=>!fixedIds.has(e.id)).map(e=>e.id);
    if(fixedToDelete.length>0){
      const {error}=await supabaseClient.from('fixed_expenses').delete().in('id',fixedToDelete);
      if(error)throw error;
    }

    if(D.creditCards.length>0){
      const {error}=await supabaseClient.from('credit_cards').upsert(
        D.creditCards.map(c=>({
          id:c.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:c.name,
          balance:c.balance,
          rate:c.rate,
          min_pay:c.minPay,
          limit_amount:c.limit,
          chosen_pay:c.chosenPay,
          account_type:c.accountType||'credit_card',
          bank_name:c.bankName||null,
          statement_day:c.statementDay||null,
          payment_due_day:c.paymentDueDay||null,
          payment_due_date:c.paymentDueDate||null,
          is_active:c.isActive!==false,
          notes:c.notes||null,
          last_payment_date:c.lastPaymentDate||null,
          budget_treatment:c.budgetTreatment||'payment_only',
          loan_type:c.loanType||null,
          loan_purpose:c.loanPurpose||null,
          original_amount:c.originalAmount||null,
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );
      if(error)throw error;
    }

    const {data:dbCards,error:cardsFetchError}=await supabaseClient
      .from('credit_cards')
      .select('id')
      .eq('user_id',ownerUserId);
    if(cardsFetchError)throw cardsFetchError;

    const cardIds=new Set(D.creditCards.map(c=>c.id));
    const cardsToDelete=(dbCards||[]).filter(c=>!cardIds.has(c.id)).map(c=>c.id);
    if(cardsToDelete.length>0){
      const {error}=await supabaseClient.from('credit_cards').delete().in('id',cardsToDelete);
      if(error)throw error;
    }

    const allDaily=[];

    Object.entries(D.months).forEach(([monthKey,m])=>{
      (m.daily||[]).forEach(e=>{
        if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(e);
        allDaily.push({
          id:e.id,
          user_id:ownerUserId,
          user_chat_id:null,
          name:e.name,
          amount:e.amount,
          category:e.category,
          category_id:e.categoryId||e.category_id||null,
          subcategory_id:e.subcategoryId||e.subcategory_id||null,
          merchant_name:e.merchantName||e.merchant_name||null,
          notes:e.notes||null,
          date:e.date,
          type:'daily',
          month_key:monthKey,
          payment_source_id:e.paymentSourceId||null,
          payment_source_name:e.paymentSourceName||null,
          payment_source_type:e.paymentSourceType||null,
          payment_account_type:e.paymentAccountType||'cash',
          credit_card_id:e.creditCardId||null,
          credit_card_transaction_id:e.creditCardTransactionId||null,
          installment_plan_id:e.installmentPlanId||null,
          affects_cash_budget:e.affectsCashBudget!==false,
          is_credit_card_purchase:!!e.isCreditCardPurchase,
          purchase_mode:e.purchaseMode||'normal',
          installment_count:e.installmentCount||null,
          interest_free:e.interestFree!==false,
          installment_rate:e.installmentRate||null,
          installment_amount:e.installmentAmount||null,
          wallet_id:e.walletId||null,
          budget_effect_amount:Object.prototype.hasOwnProperty.call(e,'budgetEffectAmount') ? Number(e.budgetEffectAmount)||0 : null,
          wallet_balance_effect_amount:Object.prototype.hasOwnProperty.call(e,'walletBalanceEffectAmount') ? Number(e.walletBalanceEffectAmount)||0 : 0
        });
      });
    });

    if(allDaily.length>0){
      const {error}=await supabaseClient
        .from('expenses')
        .upsert(allDaily,{onConflict:'id'});
      if(error)throw error;
    }

    const {data:dbExpenses,error:expensesFetchError}=await supabaseClient
      .from('expenses')
      .select('id')
      .eq('user_id',ownerUserId);
    if(expensesFetchError)throw expensesFetchError;

    const dbIds=new Set((dbExpenses||[]).map(e=>e.id));
    const appIds=new Set(allDaily.map(e=>e.id));
    const toDelete=[...dbIds].filter(id=>!appIds.has(id));

    if(toDelete.length>0){
      const {error}=await supabaseClient
        .from('expenses')
        .delete()
        .in('id',toDelete);
      if(error)throw error;
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


function getSelectedBudgetCycleType(){
  const checked=document.querySelector('input[name="cycleManagerBudgetCycleType"]:checked');
  return normalizeBudgetCycleType(checked?.value || D?.preferences?.budgetCycleType || 'fixed_day');
}
function syncBudgetCycleTypeControls(type=getBudgetCycleType()){
  const normalized=normalizeBudgetCycleType(type);
  document.querySelectorAll('input[name="cycleManagerBudgetCycleType"]').forEach(r=>{r.checked=r.value===normalized;});
  const input=$('cycleManagerBudgetCycleDay')||$('settingsBudgetCycleDay');
  if(input)input.disabled=normalized==='last_working_day';
  const row=document.querySelector('.budget-cycle-rule-row');
  if(row)row.classList.toggle('is-last-working-day',normalized==='last_working_day');
  const ruleLabel=$('cycleManagerRuleLabel');
  if(ruleLabel){
    const day=readBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1) || capvoClampCycleDay(D?.preferences?.budgetCycleStartDay || 1);
    ruleLabel.textContent=normalized==='last_working_day'
      ? 'Πληρώνομαι την τελευταία εργάσιμη του μήνα'
      : `Πληρώνομαι κάθε ${day} του μήνα`;
  }
  const help=$('cycleManagerRuleHelp');
  if(help){
    help.textContent=normalized==='last_working_day'
      ? `${typeof getHolidayAwareRuleText==='function'?getHolidayAwareRuleText():'Το CAPVO υπολογίζει Σαββατοκύριακα και ελληνικές αργίες.'} Η ημέρα πληρωμής χρησιμοποιείται για υπενθύμιση μισθού.`
      : 'Η ημέρα που επιλέγεις είναι η ημέρα που περιμένεις τον μισθό σου.';
  }
}
async function saveBudgetCyclePreference(inputId='settingsBudgetCycleDay'){
  const ownerUserId=getFinanceUserId();
  const input=$(inputId)||$('settingsBudgetCycleDay')||$('cycleManagerBudgetCycleDay');
  const raw=input?String(input.value||'').trim():'';
  const type=getSelectedBudgetCycleType();
  let day=capvoClampCycleDay(D?.preferences?.budgetCycleStartDay || 1);
  if(type==='fixed_day'){
    day=finalizeBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1);
    if(day===null){
      showMiniToast('Βάλε ημέρα πληρωμής από 1 έως 31.','error');
      input?.focus?.();
      return;
    }
  }else if(raw!==''){
    day=finalizeBudgetCycleDayInput(input,D?.preferences?.budgetCycleStartDay || 1) || day;
  }
  if(!ownerUserId){
    showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');
    return;
  }

  try{
    const payload={
      user_id:ownerUserId,
      budget_cycle_type:type,
      budget_cycle_start_day:day,
      currency:D.preferences?.currency||'EUR',
      language:D.preferences?.language||'el',
      updated_at:new Date().toISOString()
    };

    const {error}=await supabaseClient
      .from('user_preferences')
      .upsert(payload,{onConflict:'user_id'});

    if(error)throw error;

    D.preferences={
      ...(D.preferences||{}),
      budgetCycleType:type,
      budgetCycleStartDay:day,
      budget_cycle_type:type,
      budget_cycle_start_day:day
    };
    if(typeof setBudgetCycleType==='function')setBudgetCycleType(type);
    if(typeof setBudgetCycleStartDay==='function')setBudgetCycleStartDay(day);
    capvoSaveSalaryRuleLocal(type,day);

    if(type==='last_working_day' && typeof capvoEnsureBudgetCycleHolidays==='function'){
      await capvoEnsureBudgetCycleHolidays();
    }

    curM=curMK();
    ensM(curM);
    render();
    renderBudgetCycleManager?.();
    showMiniToast(type==='last_working_day'?'✅ Η ημέρα μισθού ορίστηκε στην τελευταία εργάσιμη':'✅ Η ημέρα μισθού ενημερώθηκε σε '+day);
  }catch(e){
    console.error('saveBudgetCyclePreference failed:',e);
    showMiniToast('Δεν μπόρεσα να αποθηκεύσω τον οικονομικό κύκλο.','error');
  }
}


function getNextStandardCycleStartAfter(dateValue){
  return getNextPaydayAfter(dateValue,getBudgetCycleType());
}
function getPaidTodayCycleEnd(startKey){
  const start=capvoParseDateKey(startKey)||new Date();
  const nextStart=getNextStandardCycleStartAfter(start);
  const end=new Date(nextStart);
  end.setDate(end.getDate()-1);
  return capvoDateKey(end);
}



function capvoBudgetDateInRange(dateValue,startKey,endKey){
  const d=typeof capvoParseDateKey==='function'?capvoParseDateKey(dateValue):new Date(dateValue);
  const s=typeof capvoParseDateKey==='function'?capvoParseDateKey(startKey):new Date(startKey);
  const e=typeof capvoParseDateKey==='function'?capvoParseDateKey(endKey):new Date(endKey);
  if(!d||!s||!e)return false;
  return d>=s && d<=e;
}

function capvoBudgetExpensesForRange(startKey,endKey){
  return (typeof getAllDailyExpenses==='function'?getAllDailyExpenses():[])
    .filter(e=>capvoBudgetDateInRange(e.date,startKey,endKey))
    .filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true);
}

function capvoActualCardPaymentsForRange(startKey,endKey){
  return (D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .map(t=>{
      const raw=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO();
      return {...t,date:normalizeDateValue(raw)||todayISO()};
    })
    .filter(t=>capvoBudgetDateInRange(t.date,startKey,endKey));
}

function capvoSavingsBudgetMovementsForRange(startKey,endKey){
  return (D.savingsTransactions||[])
    .map(t=>{
      const rawDate=t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date||todayISO();
      const date=normalizeDateValue(rawDate)||todayISO();
      if(!capvoBudgetDateInRange(date,startKey,endKey))return null;

      const type=String(t.type||'').toLowerCase();
      const source=String(t.source||'').toLowerCase();
      const isTransfer=type==='transfer_in' || type==='transfer_out' || source.includes('transfer');
      if(isTransfer)return null;

      const amount=capvoMoney(Number(t.amount)||0);
      if(amount===0)return null;
      const isWithdrawal=type==='withdrawal' || amount<0;
      const abs=Math.abs(amount);
      return {date,amount:capvoMoney(isWithdrawal?-abs:abs)};
    })
    .filter(Boolean);
}


function capvoFixedExpenseActiveForStart(fixed,startKey){
  const effective=fixed?.effectiveFromDate || fixed?.effective_from_date || '';
  if(!effective)return true;
  const effectiveDate=capvoParseDateKey(effective);
  const start=capvoParseDateKey(startKey);
  if(!effectiveDate || !start)return true;
  return start>=effectiveDate;
}

function capvoFixedTotalForCycleStart(startKey){
  return capvoMoney((D.fixedExpenses||[])
    .filter(f=>capvoFixedExpenseActiveForStart(f,startKey))
    .reduce((sum,f)=>sum+(Number(f.amount)||0),0));
}


function capvoProposedCycleSpent(startKey,endKey){
  const fixed=typeof capvoFixedTotalForCycleStart==='function'?capvoFixedTotalForCycleStart(startKey):(typeof fixedTotal==='function'?fixedTotal():0);
  const daily=capvoBudgetExpensesForRange(startKey,endKey).reduce((s,e)=>s+(Number(e.amount)||0),0);
  const card=capvoActualCardPaymentsForRange(startKey,endKey).reduce((s,t)=>s+(Number(t.amount)||0),0);
  const savings=capvoSavingsBudgetMovementsForRange(startKey,endKey).reduce((s,t)=>s+(Number(t.amount)||0),0);
  return {
    fixed:capvoMoney(fixed),
    daily:capvoMoney(daily),
    card:capvoMoney(card),
    savings:capvoMoney(savings),
    total:capvoMoney(fixed+daily+card+savings)
  };
}

function capvoCurrentCycleBalanceSnapshot(){
  const currentIncome=capvoMoney(Number(D.income)||0);
  const currentSpent=capvoMoney(
    (typeof fixedTotal==='function'?fixedTotal():0) +
    (typeof ccPayTotal==='function'?ccPayTotal():0) +
    (typeof dailyCashTotal==='function'?dailyCashTotal():0)
  );
  return {
    currentIncome,
    currentSpent,
    currentBalance:capvoMoney(currentIncome-currentSpent)
  };
}

function capvoBuildPaidTodayPreview(primaryWallet,cycleAmount,startKey,endKey,context={}){
  // v1.9.5.1: payday is a salary deposit inside a monthly period.
  // If payday is overdue, the deposit is still linked to the expected payday month.
  const current=capvoCurrentCycleBalanceSnapshot();
  const proposedSpent={
    fixed:typeof fixedTotal==='function'?fixedTotal():0,
    daily:typeof dailyCashTotal==='function'?dailyCashTotal():0,
    card:typeof ccPayTotal==='function'?ccPayTotal():0,
    savings:0
  };
  proposedSpent.total=capvoMoney(proposedSpent.fixed+proposedSpent.daily+proposedSpent.card+proposedSpent.savings);

  const startingBudget=capvoMoney(current.currentIncome + (Number(cycleAmount)||0));
  const estimatedBalance=capvoMoney(startingBudget - proposedSpent.total);

  return {
    walletId:primaryWallet?.id||'',
    walletName:primaryWallet?.name||'Βασικός λογαριασμός',
    salaryAmount:capvoMoney(Number(cycleAmount)||0),
    previousIncome:current.currentIncome,
    previousSpent:current.currentSpent,
    previousBalance:current.currentBalance,
    startingBudget,
    proposedSpent,
    estimatedBalance,
    startKey,
    endKey,
    paydayKey:context.paydayKey||todayISO(),
    salaryState:context.state||'upcoming',
    isOverdue:!!context.isOverdue,
    createdAt:new Date().toISOString(),
    mode:'monthly_salary_deposit'
  };
}

function capvoEncodePaidTodayMeta(meta){
  const safe={
    walletId:meta.walletId,
    walletName:meta.walletName,
    salaryAmount:capvoMoney(meta.salaryAmount),
    previousIncome:capvoMoney(meta.previousIncome),
    previousSpent:capvoMoney(meta.previousSpent),
    previousBalance:capvoMoney(meta.previousBalance),
    startingBudget:capvoMoney(meta.startingBudget),
    proposedSpent:{
      fixed:capvoMoney(meta.proposedSpent?.fixed),
      daily:capvoMoney(meta.proposedSpent?.daily),
      card:capvoMoney(meta.proposedSpent?.card),
      savings:capvoMoney(meta.proposedSpent?.savings),
      total:capvoMoney(meta.proposedSpent?.total)
    },
    estimatedBalance:capvoMoney(meta.estimatedBalance),
    startKey:meta.startKey,
    endKey:meta.endKey,
    createdAt:meta.createdAt||new Date().toISOString()
  };
  return `[[CAPVO_PAID_TODAY_META:${JSON.stringify(safe)}]]`;
}

function showPaidTodayPreviewModal(preview){
  return new Promise(resolve=>{
    const old=document.getElementById('capvoPaidTodayPreviewOverlay');
    if(old)old.remove();

    const overlay=document.createElement('div');
    overlay.id='capvoPaidTodayPreviewOverlay';
    overlay.className='capvo-paid-preview-overlay';
    overlay.innerHTML=`
      <section class="capvo-paid-preview-sheet" role="dialog" aria-modal="true" aria-label="Προεπισκόπηση μισθού">
        <button type="button" class="capvo-paid-preview-close" aria-label="Κλείσιμο">×</button>
        <div class="capvo-paid-preview-hero">
          <div class="capvo-paid-preview-icon">💸</div>
          <div>
            <span>Καταχώρηση μισθού</span>
            <h3>Δες τι θα αλλάξει πριν συνεχίσεις</h3>
            <p>${esc(formatBudgetCycleDateRange(preview.startKey,preview.endKey))}</p>
            <small class="capvo-paid-preview-payday">${preview.isOverdue?'Εκκρεμεί από ':'Ημερομηνία μισθού: '}${esc(formatGreekFullDate(preview.paydayKey))}</small>
          </div>
        </div>

        <div class="capvo-paid-preview-total">
          <span>Εκτιμώμενο νέο υπόλοιπο μήνα</span>
          <strong>${fmt(preview.estimatedBalance)}</strong>
          <small>Με βάση τα τρέχοντα budget wallets + τον μισθό - τα έξοδα της μηνιαίας περιόδου. Ο μισθός δεν μπαίνει αυτόματα, μόνο μετά την επιβεβαίωσή σου.</small>
        </div>

        <div class="capvo-paid-preview-steps">
          <div class="capvo-paid-preview-row">
            <span>Υπόλοιπο μήνα πριν τον μισθό</span>
            <strong>${fmt(preview.previousBalance)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-plus">
            <span>Μισθός στο ${esc(preview.walletName)}</span>
            <strong>+${fmt(preview.salaryAmount)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-subtotal">
            <span>Νέα budget wallets μετά τον μισθό</span>
            <strong>${fmt(preview.startingBudget)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-minus">
            <span>Πάγια / έξοδα μήνα</span>
            <strong>-${fmt(preview.proposedSpent.total)}</strong>
          </div>
        </div>

        <div class="capvo-paid-preview-breakdown">
          <div><span>Πάγια</span><strong>${fmt(preview.proposedSpent.fixed)}</strong></div>
          <div><span>Ημερήσια μήνα</span><strong>${fmt(preview.proposedSpent.daily)}</strong></div>
          <div><span>Πληρωμές καρτών</span><strong>${fmt(preview.proposedSpent.card)}</strong></div>
          <div><span>Στόχος</span><strong>${fmt(preview.proposedSpent.savings)}</strong></div>
        </div>

        <div class="capvo-paid-preview-note">
          <strong>Σημαντικό</strong>
          <span>Δεν αλλάζει η μηνιαία περίοδος. Απλά καταχωρείται ο μισθός στο primary wallet και συνεχίζεις στον ίδιο μήνα.</span>
        </div>

        <div class="capvo-paid-preview-actions">
          <button type="button" class="capvo-paid-preview-secondary">Άκυρο</button>
          <button type="button" class="capvo-paid-preview-primary">Ναι, καταχώρησε μισθό</button>
        </div>
      </section>`;

    const close=(answer)=>{
      overlay.classList.remove('active');
      setTimeout(()=>overlay.remove(),160);
      resolve(!!answer);
    };

    overlay.addEventListener('click',e=>{ if(e.target===overlay)close(false); });
    overlay.querySelector('.capvo-paid-preview-close')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-secondary')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-primary')?.addEventListener('click',()=>close(true));

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('active'));
  });
}


function capvoPaidTodayPrimaryWallet(){
  return typeof capvoPrimaryBudgetWallet==='function' ? capvoPrimaryBudgetWallet() : (typeof capvoDefaultWallet==='function'?capvoDefaultWallet():null);
}

async function capvoFetchCycleIncomeRow(ownerUserId,cycleId,incomeSourceId){
  if(!ownerUserId || !cycleId || !incomeSourceId)return null;
  try{
    const {data,error}=await supabaseClient
      .from('budget_cycle_incomes')
      .select('*')
      .eq('user_id',ownerUserId)
      .eq('cycle_id',cycleId)
      .eq('income_source_id',incomeSourceId)
      .limit(1);
    if(error)throw error;
    return (data||[])[0]||null;
  }catch(e){
    console.warn('[CAPVO] cycle income row fetch failed:',e?.message||e);
    return null;
  }
}

async function capvoUpsertCycleIncomeWithWallet(payload){
  const {error}=await supabaseClient
    .from('budget_cycle_incomes')
    .upsert(payload,{onConflict:'cycle_id,income_source_id'});
  if(!error)return {error:null,legacy:false};

  if(/destination_wallet_id|wallet_deposit_applied|wallet_balance_before|wallet_balance_after|wallet_deposit_applied_at/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.destination_wallet_id;
    delete legacyPayload.wallet_deposit_applied;
    delete legacyPayload.wallet_deposit_applied_at;
    delete legacyPayload.wallet_balance_before;
    delete legacyPayload.wallet_balance_after;
    const retry=await supabaseClient
      .from('budget_cycle_incomes')
      .upsert(legacyPayload,{onConflict:'cycle_id,income_source_id'});
    return {error:retry.error,legacy:true};
  }

  return {error,legacy:false};
}

async function capvoMarkCycleIncomeWalletDeposit(ownerUserId,cycleId,incomeSourceId,walletId,before,after){
  const {error}=await supabaseClient
    .from('budget_cycle_incomes')
    .update({
      destination_wallet_id:walletId,
      wallet_deposit_applied:true,
      wallet_deposit_applied_at:new Date().toISOString(),
      wallet_balance_before:Number(before)||0,
      wallet_balance_after:Number(after)||0
    })
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycleId)
    .eq('income_source_id',incomeSourceId);
  if(error)throw error;
}

async function capvoApplyCycleAmountToWallet({ownerUserId,cycle,wallet,amount,incomeSourceId,name,incomeType='wallet_salary'}){
  const value=Number(amount)||0;
  if(!ownerUserId || !cycle?.id || !wallet?.id || value<=0)return {applied:false,reason:'invalid'};
  const rowKey=incomeSourceId || `wallet:${wallet.id}:primary_cycle`;

  const existing=await capvoFetchCycleIncomeRow(ownerUserId,cycle.id,rowKey);
  if(existing?.wallet_deposit_applied){
    return {applied:false,reason:'already_applied',wallet,amount:value};
  }

  const incomePayload={
    user_id:ownerUserId,
    cycle_id:cycle.id,
    income_source_id:rowKey,
    name:name||'Βασικός μισθός / κύκλος',
    amount:value,
    income_type:incomeType,
    destination_wallet_id:wallet.id,
    wallet_deposit_applied:false,
    wallet_balance_before:null,
    wallet_balance_after:null
  };
  const upsert=await capvoUpsertCycleIncomeWithWallet(incomePayload);
  if(upsert.error)throw upsert.error;
  if(upsert.legacy)return {applied:false,reason:'migration_missing',wallet,amount:value};

  const current=capvoWalletById(wallet.id)||wallet;
  const before=Number(current.currentBalance)||0;
  const after=capvoMoney(before+value);

  await capvoUpdateWalletBalance(wallet.id,after);
  try{
    await capvoMarkCycleIncomeWalletDeposit(ownerUserId,cycle.id,rowKey,wallet.id,before,after);
  }catch(markError){
    try{ await capvoUpdateWalletBalance(wallet.id,before); }catch(rollbackError){ console.error('cycle wallet rollback failed:',rollbackError); }
    throw markError;
  }

  return {applied:true,wallet,before,after,amount:value};
}

async function capvoReverseCycleIncomeWalletDeposits(ownerUserId,cycle){
  if(!ownerUserId || !cycle?.id)return {reversed:0,total:0};
  const {data,error}=await supabaseClient
    .from('budget_cycle_incomes')
    .select('*')
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycle.id);
  if(error)throw error;

  let reversed=0,total=0;
  for(const row of (data||[])){
    if(!row.wallet_deposit_applied || !row.destination_wallet_id)continue;
    const amount=Number(row.amount)||0;
    if(amount<=0)continue;
    const wallet=capvoWalletById(row.destination_wallet_id);
    if(!wallet)continue;
    await capvoUpdateWalletBalance(wallet.id,capvoMoney((Number(wallet.currentBalance)||0)-amount));
    reversed++;
    total=capvoMoney(total+amount);
  }
  return {reversed,total};
}



function capvoSalaryToDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
  }
  if(typeof value==='string'){
    if(typeof capvoParseDateKey==='function'){
      const parsed=capvoParseDateKey(value);
      if(parsed)return parsed;
    }
    const d=new Date(value);
    if(!Number.isNaN(d.getTime()))return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
    return null;
  }
  if(value && typeof value==='object' && typeof value.getTime==='function' && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
  }
  const d=new Date(value);
  if(!Number.isNaN(d.getTime()))return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);
  return null;
}

function capvoSalaryDateKey(value){
  // v1.9.5.4: Date objects must not go through capvoParseDateKey(String(Date)).
  // That was the reason payday always fell back to today.
  const d=capvoSalaryToDate(value);
  if(!d)return todayISO();
  return typeof capvoDateKey==='function'?capvoDateKey(d):d.toISOString().slice(0,10);
}

function capvoSalaryMonthStartKey(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const start=new Date(safe.getFullYear(),safe.getMonth(),1,12);
  return capvoSalaryDateKey(start);
}

function capvoSalaryMonthEndKey(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const end=new Date(safe.getFullYear(),safe.getMonth()+1,0,12);
  return capvoSalaryDateKey(end);
}


function capvoSalaryRuleStorageKey(){
  const owner=typeof getFinanceUserId==='function' ? getFinanceUserId() : '';
  return `capvo.salaryRule.v1.${owner||'local'}`;
}

function capvoSaveSalaryRuleLocal(type,day){
  try{
    const payload={
      type:normalizeBudgetCycleType(type||'fixed_day'),
      day:capvoClampCycleDay(day||1),
      updatedAt:new Date().toISOString()
    };
    localStorage.setItem(capvoSalaryRuleStorageKey(),JSON.stringify(payload));
  }catch(e){}
}

function capvoReadSalaryRuleLocal(){
  try{
    const raw=localStorage.getItem(capvoSalaryRuleStorageKey());
    if(!raw)return null;
    const parsed=JSON.parse(raw);
    const type=normalizeBudgetCycleType(parsed?.type||'fixed_day');
    const day=capvoClampCycleDay(parsed?.day||1);
    return {type,day};
  }catch(e){
    return null;
  }
}

function capvoGetSalaryRuleForStatus(){
  const localRule=capvoReadSalaryRuleLocal();
  const prefs=D?.preferences||{};
  const prefType=normalizeBudgetCycleType(prefs.budgetCycleType || prefs.budget_cycle_type || 'fixed_day');
  const prefDay=capvoClampCycleDay(prefs.budgetCycleStartDay ?? prefs.budget_cycle_start_day ?? 1);

  // Prefer the local rule right after saving because the dashboard may render
  // before Supabase/fetchAllData has fully refreshed preferences.
  if(localRule && (localRule.type==='last_working_day' || localRule.day>0)){
    return localRule;
  }

  return {type:prefType,day:prefDay};
}


function capvoExpectedPaydayForMonth(dateValue){
  const safe=capvoSalaryToDate(dateValue) || new Date();
  const rule=capvoGetSalaryRuleForStatus();
  const type=rule.type;
  if(type==='last_working_day' && typeof capvoLastWorkingDayOfMonth==='function'){
    return capvoSalaryDateKey(capvoLastWorkingDayOfMonth(safe.getFullYear(),safe.getMonth()));
  }
  const day=capvoClampCycleDay(rule.day||1);
  const lastDay=new Date(safe.getFullYear(),safe.getMonth()+1,0,12).getDate();
  return capvoSalaryDateKey(new Date(safe.getFullYear(),safe.getMonth(),Math.min(day,lastDay),12));
}

function capvoSalaryPeriodFromDate(dateKey){
  return {
    startKey:capvoSalaryMonthStartKey(dateKey),
    endKey:capvoSalaryMonthEndKey(dateKey)
  };
}

function capvoSalaryIsRecorded(walletId,periodStartKey){
  if(!walletId || !periodStartKey)return false;
  if(typeof capvoMonthlySalaryAlreadyRecorded==='function'){
    return capvoMonthlySalaryAlreadyRecorded(walletId,periodStartKey);
  }
  return false;
}

function capvoGetSalaryDepositContext(primaryWallet){
  const today=todayISO();
  const walletId=primaryWallet?.id||'';
  const now=typeof capvoParseDateKey==='function'?capvoParseDateKey(today):new Date();

  const build=(offset)=>{
    const ref=new Date(now.getFullYear(),now.getMonth()+offset,1,12);
    const paydayKey=capvoExpectedPaydayForMonth(ref);
    const period=capvoSalaryPeriodFromDate(paydayKey);
    const recorded=capvoSalaryIsRecorded(walletId,period.startKey);
    return {paydayKey,periodStartKey:period.startKey,periodEndKey:period.endKey,recorded,offset};
  };

  // v1.9.5.2: prefer the current month's payday for normal testing and daily use.
  // Previous month is considered only for a very recent missed payday, so a new
  // user created mid-month does not suddenly see an old unpaid salary from the
  // previous month.
  const current=build(0);
  if(current.recorded){
    return {
      ...current,
      state:'recorded',
      isPending:false,
      isOverdue:false,
      todayKey:today
    };
  }

  if(String(current.paydayKey)<=String(today)){
    return {
      ...current,
      state:String(current.paydayKey)===String(today)?'due':'overdue',
      isPending:true,
      isOverdue:String(current.paydayKey)<String(today),
      todayKey:today
    };
  }

  const previous=build(-1);
  if(!previous.recorded && String(previous.paydayKey)<=String(today)){
    const prevDate=typeof capvoParseDateKey==='function'?capvoParseDateKey(previous.paydayKey):new Date(previous.paydayKey);
    const todayDate=typeof capvoParseDateKey==='function'?capvoParseDateKey(today):new Date();
    const diffDays=Math.round((todayDate-prevDate)/(1000*60*60*24));
    if(diffDays>=0 && diffDays<=7){
      return {
        ...previous,
        state:'overdue',
        isPending:true,
        isOverdue:true,
        todayKey:today
      };
    }
  }

  return {
    ...current,
    state:'upcoming',
    isPending:false,
    isOverdue:false,
    todayKey:today
  };
}


function capvoMonthlySalaryIncomeKey(walletId,periodStartKey){
  return `wallet:${walletId}:salary:${periodStartKey}`;
}

function capvoMonthlySalaryAlreadyRecorded(walletId,periodStartKey){
  const key=capvoMonthlySalaryIncomeKey(walletId,periodStartKey);
  return (D.budgetCycleIncomes||[]).some(row=>
    String(row.incomeSourceId||row.income_source_id||'')===key &&
    (row.walletDepositApplied===true || row.wallet_deposit_applied===true || Number(row.amount)>0)
  );
}

async function createPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const primaryWallet=capvoPaidTodayPrimaryWallet();
  const cycleAmount=Number(primaryWallet?.cycleIncomeAmount)||0;
  if(!primaryWallet || cycleAmount<=0){
    showMiniToast('Όρισε πρώτα βασικό λογαριασμό budget και μισθό/ποσό μήνα.','error');
    go('vWallets',document.querySelector('[data-v="vWallets"]'));
    return;
  }

  const salaryContext=capvoGetSalaryDepositContext(primaryWallet);
  if(salaryContext.state==='recorded'){
    showMiniToast('Ο μισθός έχει ήδη καταχωρηθεί για αυτή τη μηνιαία περίοδο.','info');
    return;
  }

  const periodStartKey=salaryContext.periodStartKey;
  const periodEndKey=salaryContext.periodEndKey;
  const salaryKey=capvoMonthlySalaryIncomeKey(primaryWallet.id,periodStartKey);

  if(capvoMonthlySalaryAlreadyRecorded(primaryWallet.id,periodStartKey)){
    showMiniToast('Ο μισθός έχει ήδη καταχωρηθεί για αυτή τη μηνιαία περίοδο.','info');
    return;
  }

  const preview=capvoBuildPaidTodayPreview(primaryWallet,cycleAmount,periodStartKey,periodEndKey,salaryContext);
  const ok=await showPaidTodayPreviewModal(preview);
  if(!ok)return;

  const opDetail=salaryContext.isOverdue
    ? `Εκκρεμεί από ${formatGreekFullDate(salaryContext.paydayKey)}. Προσθέτω ${fmt(cycleAmount)} στο ${primaryWallet.name}.`
    : `Προσθέτω ${fmt(cycleAmount)} στο ${primaryWallet.name}.`;
  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Καταχωρείται μισθός...',opDetail))return;

  try{
    const cyclePayload={
      user_id:ownerUserId,
      start_date:periodStartKey,
      end_date:periodEndKey,
      cycle_key:periodStartKey,
      source:'normal',
      primary_income_source_id:salaryKey,
      primary_income_amount:cycleAmount,
      note:`Καταχώρηση μισθού μηνιαίας περιόδου · payday ${salaryContext.paydayKey} ${capvoEncodePaidTodayMeta(preview)}`,
      updated_at:new Date().toISOString()
    };

    const {data:cycleRows,error:cycleError}=await supabaseClient
      .from('budget_cycles')
      .upsert(cyclePayload,{onConflict:'user_id,cycle_key'})
      .select('*')
      .limit(1);

    if(cycleError)throw cycleError;

    const cycle=(cycleRows||[])[0];
    let applyResult={applied:false,reason:'no_cycle'};
    if(cycle?.id){
      applyResult=await capvoApplyCycleAmountToWallet({
        ownerUserId,
        cycle,
        wallet:primaryWallet,
        amount:cycleAmount,
        incomeSourceId:salaryKey,
        name:salaryContext.isOverdue?'Εκκρεμής μισθός μηνιαίας περιόδου':'Μισθός μηνιαίας περιόδου',
        incomeType:primaryWallet.type||'wallet'
      });
    }

    await fetchAllData(ownerUserId);
    render();
    renderBudgetCycleManager?.();

    const suffix=applyResult.applied
      ? ` · Προστέθηκαν ${fmt(cycleAmount)} στο ${primaryWallet.name}`
      : applyResult.reason==='already_applied'
        ? ' · Ο μισθός είχε ήδη περαστεί'
        : applyResult.reason==='migration_missing'
          ? ' · Χρειάζεται το νέο SQL για αυτόματη πίστωση'
          : '';

    const msg=`✅ Ο μισθός καταχωρήθηκε${suffix}`;
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',msg);
    showMiniToast(msg);

  }catch(e){
    console.error('createPaidTodayCycle failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να καταχωρήσω τον μισθό.');
    showMiniToast('Δεν μπόρεσα να καταχωρήσω τον μισθό.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

async function capvoFindCurrentSalaryDepositForUndo(ownerUserId,primaryWallet,period){
  if(!ownerUserId || !primaryWallet?.id || !period?.startKey)return null;
  const salaryKey=capvoMonthlySalaryIncomeKey(primaryWallet.id,period.startKey);
  const cycle=(D.budgetCycles||[]).find(c=>String(c.cycleKey||c.cycle_key||'')===String(period.startKey));
  if(!cycle?.id)return null;

  const {data:rows,error}=await supabaseClient
    .from('budget_cycle_incomes')
    .select('*')
    .eq('user_id',ownerUserId)
    .eq('cycle_id',cycle.id)
    .eq('income_source_id',salaryKey)
    .limit(1);
  if(error)throw error;

  return {
    cycle,
    row:(rows||[])[0]||null,
    salaryKey
  };
}

function showSalaryUndoPreviewModal({wallet,amount,before,after,periodLabel}){
  return new Promise(resolve=>{
    const old=document.getElementById('capvoSalaryUndoOverlay');
    if(old)old.remove();

    const negative=Number(after)<0;
    const overlay=document.createElement('div');
    overlay.id='capvoSalaryUndoOverlay';
    overlay.className='capvo-paid-preview-overlay capvo-salary-undo-overlay';
    overlay.innerHTML=`
      <section class="capvo-paid-preview-sheet capvo-salary-undo-sheet" role="dialog" aria-modal="true" aria-label="Αναίρεση μισθού">
        <button type="button" class="capvo-paid-preview-close" aria-label="Κλείσιμο">×</button>

        <div class="capvo-paid-preview-hero">
          <div class="capvo-paid-preview-icon">${negative?'⚠️':'↩️'}</div>
          <div>
            <span>Αναίρεση μισθού</span>
            <h3>${negative?'Το wallet θα πάει αρνητικό':'Έλεγξε τι θα αλλάξει'}</h3>
            <p>${esc(periodLabel||'Τρέχουσα μηνιαία περίοδος')}</p>
          </div>
        </div>

        <div class="capvo-paid-preview-total ${negative?'is-warning':''}">
          <span>Υπόλοιπο μετά την αναίρεση</span>
          <strong>${fmt(after)}</strong>
          <small>Θα αφαιρεθεί μόνο ο μισθός. Οι υπόλοιπες κινήσεις του μήνα δεν θα διαγραφούν.</small>
        </div>

        <div class="capvo-paid-preview-steps">
          <div class="capvo-paid-preview-row">
            <span>Wallet</span>
            <strong>${esc(wallet?.name||'Primary wallet')}</strong>
          </div>
          <div class="capvo-paid-preview-row">
            <span>Τρέχον υπόλοιπο</span>
            <strong>${fmt(before)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-minus">
            <span>Μισθός που θα αφαιρεθεί</span>
            <strong>-${fmt(amount)}</strong>
          </div>
          <div class="capvo-paid-preview-row is-subtotal">
            <span>Νέο υπόλοιπο</span>
            <strong>${fmt(after)}</strong>
          </div>
        </div>

        <div class="capvo-paid-preview-note ${negative?'warning':''}">
          <strong>${negative?'Προσοχή':'Τι θα γίνει'}</strong>
          <span>${negative
            ? 'Το υπόλοιπο του wallet θα γίνει αρνητικό. Συνέχισε μόνο αν όντως ο μισθός είχε καταχωρηθεί λάθος.'
            : 'Θα αφαιρεθεί μόνο η καταχώρηση μισθού από το primary wallet. Έξοδα, μεταφορές, κάρτες και πάγια μένουν όπως είναι.'}</span>
        </div>

        <div class="capvo-paid-preview-actions">
          <button type="button" class="capvo-paid-preview-secondary">Άκυρο</button>
          <button type="button" class="capvo-paid-preview-primary ${negative?'danger':''}">Συνέχεια με αναίρεση</button>
        </div>
      </section>`;

    const close=(answer)=>{
      overlay.classList.remove('active');
      setTimeout(()=>overlay.remove(),160);
      resolve(!!answer);
    };

    overlay.addEventListener('click',e=>{ if(e.target===overlay)close(false); });
    overlay.querySelector('.capvo-paid-preview-close')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-secondary')?.addEventListener('click',()=>close(false));
    overlay.querySelector('.capvo-paid-preview-primary')?.addEventListener('click',()=>close(true));

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('active'));
  });
}


async function undoCurrentPaidTodayCycle(){
  const ownerUserId=getFinanceUserId();
  const primaryWallet=capvoPaidTodayPrimaryWallet();
  const period=getCurrentBudgetCycle();
  if(!ownerUserId || !primaryWallet || !period?.startKey)return;

  try{
    const found=await capvoFindCurrentSalaryDepositForUndo(ownerUserId,primaryWallet,period);
    if(!found?.cycle?.id){
      showMiniToast('Δεν βρέθηκε καταχώρηση μισθού για αυτή την περίοδο.','info');
      return;
    }

    const row=found.row;
    if(!row){
      showMiniToast('Δεν βρέθηκε μισθός για αναίρεση.','info');
      return;
    }

    const amount=capvoMoney(Number(row.amount)||0);
    const wallet=capvoWalletById(row.destination_wallet_id)||primaryWallet;
    const before=capvoMoney(Number(wallet?.currentBalance)||0);
    const after=capvoMoney(before-amount);

    const ok=await showSalaryUndoPreviewModal({
      wallet,
      amount,
      before,
      after,
      periodLabel:period.label
    });
    if(!ok)return;

    if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Γίνεται αναίρεση μισθού...', `Αφαιρώ ${fmt(amount)} από ${wallet?.name||'wallet'}.`))return;

    try{
      if(row.wallet_deposit_applied && row.destination_wallet_id && amount>0){
        if(wallet){
          await capvoUpdateWalletBalance(wallet.id,after);
        }
      }

      const {error:incomeError}=await supabaseClient
        .from('budget_cycle_incomes')
        .delete()
        .eq('user_id',ownerUserId)
        .eq('cycle_id',found.cycle.id)
        .eq('income_source_id',found.salaryKey);
      if(incomeError)throw incomeError;

      await fetchAllData(ownerUserId);
      render();
      renderBudgetCycleManager?.();

      capvoAppOperationSuccess?.('Ολοκληρώθηκε','Ο μισθός της περιόδου αναιρέθηκε. Οι υπόλοιπες κινήσεις έμειναν όπως ήταν.');
      showMiniToast('✅ Ο μισθός της περιόδου αναιρέθηκε');
    }catch(e){
      console.error('undo salary event failed:',e);
      capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αναιρέσω τον μισθό.');
      showMiniToast('Δεν μπόρεσα να αναιρέσω τον μισθό.','error');
    }finally{
      if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    }
  }catch(error){
    console.error('undo salary preview failed:',error);
    showMiniToast('Δεν μπόρεσα να ετοιμάσω την αναίρεση μισθού.','error');
  }
}

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
