// CAPVO app split: 02a-data-fetch.js
// Data fetch: fetchAllData, syncIncomeSources, budget cycle fetching
// Source: 02-supabase-data.js lines 1-581

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
      .eq('is_active',true)
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


// ===== END 02a-data-fetch.js =====
