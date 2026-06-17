// ============================================================
// CAPVO Wallet Financial Engine — v1.9.1.0 foundation
// Centralized wallet/account budget rules.
// This file is intentionally backward-compatible with the current DB.
// New DB fields are optional until the migration is applied.
// ============================================================

(function(){
  function n(value){ return Number(value)||0; }

  function hasOwn(obj,key){
    return !!obj && Object.prototype.hasOwnProperty.call(obj,key);
  }

  function pickBool(obj, camelKey, snakeKey, fallback){
    if(hasOwn(obj,camelKey)) return obj[camelKey] !== false;
    if(hasOwn(obj,snakeKey)) return obj[snakeKey] !== false;
    return !!fallback;
  }

  function isSavingsWallet(wallet){
    return !!(wallet && (wallet.isSavings || wallet.is_savings || wallet.type === 'savings'));
  }


  function inferWalletBudgetRole(wallet){
    if(!wallet) return 'unknown';
    if(wallet.budgetRole || wallet.budget_role) return wallet.budgetRole || wallet.budget_role;
    if(isSavingsWallet(wallet)) return 'savings';
    if(wallet.type === 'investment') return 'investment';
    if(wallet.type === 'cash') return 'cash';
    if(wallet.type === 'restricted') return 'restricted';
    return 'spending';
  }

  function inferWalletIncludeInBudget(wallet){
    const role = inferWalletBudgetRole(wallet);
    return !['savings','investment','outside','restricted'].includes(role);
  }

  window.capvoInferWalletBudgetRole = inferWalletBudgetRole;
  window.capvoInferWalletIncludeInBudget = inferWalletIncludeInBudget;

  function walletRole(wallet){
    return inferWalletBudgetRole(wallet);
  }

  window.capvoWalletBudgetRole = walletRole;

  window.capvoWalletCountsInTotal = function(wallet){
    if(!wallet || wallet.isActive === false || wallet.is_active === false) return false;
    return pickBool(wallet,'includeInTotal','include_in_total',true);
  };

  window.capvoWalletCountsInBudget = function(wallet){
    if(!wallet || wallet.isActive === false || wallet.is_active === false) return false;

    // Savings / investment-like wallets never count in spendable budget.
    const role = inferWalletBudgetRole(wallet);
    if(['savings','investment','outside','restricted'].includes(role)) return false;
    if(isSavingsWallet(wallet)) return false;

    if(hasOwn(wallet,'includeInBudget') && wallet.includeInBudget != null) return wallet.includeInBudget !== false;
    if(hasOwn(wallet,'include_in_budget') && wallet.include_in_budget != null) return wallet.include_in_budget !== false;

    return inferWalletIncludeInBudget(wallet);
  };

  window.capvoIsPrimaryBudgetWallet = function(wallet){
    return !!(wallet && (
      wallet.isPrimaryBudget ||
      wallet.is_primary_budget ||
      wallet.isDefault ||
      wallet.is_default
    ));
  };


  window.capvoPrimaryBudgetWallet = function(){
    const wallets = typeof capvoActiveWallets === 'function'
      ? capvoActiveWallets()
      : ((window.D && Array.isArray(D.wallets)) ? D.wallets.filter(w=>w.isActive!==false && w.is_active!==false) : []);
    return wallets.find(w=>window.capvoWalletCountsInBudget(w) && (w.isPrimaryBudget || w.is_primary_budget)) ||
      wallets.find(w=>window.capvoWalletCountsInBudget(w) && (w.isDefault || w.is_default)) ||
      wallets.find(w=>window.capvoWalletCountsInBudget(w)) ||
      null;
  };

  window.capvoGetBudgetWallets = function(){
    const wallets = typeof capvoActiveWallets === 'function'
      ? capvoActiveWallets()
      : ((window.D && Array.isArray(D.wallets)) ? D.wallets.filter(w=>w.isActive!==false && w.is_active!==false) : []);
    return wallets.filter(w=>window.capvoWalletCountsInBudget(w));
  };

  window.capvoGetNonBudgetWallets = function(){
    const wallets = typeof capvoActiveWallets === 'function'
      ? capvoActiveWallets()
      : ((window.D && Array.isArray(D.wallets)) ? D.wallets.filter(w=>w.isActive!==false && w.is_active!==false) : []);
    return wallets.filter(w=>window.capvoWalletCountsInTotal(w) && !window.capvoWalletCountsInBudget(w));
  };

  window.capvoGetSpendableWalletTotal = function(){
    return window.capvoGetBudgetWallets().reduce((sum,w)=>sum+n(w.currentBalance ?? w.current_balance),0);
  };

  window.capvoGetTotalWalletAssets = function(){
    const wallets = typeof capvoActiveWallets === 'function'
      ? capvoActiveWallets()
      : ((window.D && Array.isArray(D.wallets)) ? D.wallets.filter(w=>w.isActive!==false && w.is_active!==false) : []);
    return wallets
      .filter(w=>window.capvoWalletCountsInTotal(w))
      .reduce((sum,w)=>sum+n(w.currentBalance ?? w.current_balance),0);
  };

  window.capvoTransferBudgetImpact = function(fromWallet, toWallet, amount){
    const value = n(amount);
    return (
      (window.capvoWalletCountsInBudget(fromWallet) ? -value : 0) +
      (window.capvoWalletCountsInBudget(toWallet) ? value : 0)
    );
  };

  window.capvoDescribeTransferBudgetImpact = function(fromWallet, toWallet, amount){
    const impact = window.capvoTransferBudgetImpact(fromWallet,toWallet,amount);
    if(impact === 0) return 'Δεν αλλάζει το διαθέσιμο budget.';
    if(impact < 0) return `Μειώνει το διαθέσιμο budget κατά ${typeof fmt==='function'?fmt(Math.abs(impact)):Math.abs(impact)+'€'}.`;
    return `Αυξάνει το διαθέσιμο budget κατά ${typeof fmt==='function'?fmt(impact):impact+'€'}.`;
  };

  window.capvoBuildWalletTransferEffects = function(fromWallet, toWallet, amount){
    const budgetImpact = window.capvoTransferBudgetImpact(fromWallet,toWallet,amount);
    return {
      budgetImpactAmount: budgetImpact,
      fromCountsInBudget: window.capvoWalletCountsInBudget(fromWallet),
      toCountsInBudget: window.capvoWalletCountsInBudget(toWallet),
      fromCountsInTotal: window.capvoWalletCountsInTotal(fromWallet),
      toCountsInTotal: window.capvoWalletCountsInTotal(toWallet),
      fromRole: walletRole(fromWallet),
      toRole: walletRole(toWallet)
    };
  };

  window.capvoExpenseBudgetImpact = function(expense){
    if(!expense) return 0;
    const amount = n(expense.amount);
    if(expense.paymentAccountType === 'credit_card' || expense.payment_account_type === 'credit_card') return 0;
    if(expense.affectsCashBudget === false || expense.affects_cash_budget === false) return 0;

    const walletId = expense.walletId || expense.wallet_id;
    const wallet = walletId && typeof capvoWalletById === 'function' ? capvoWalletById(walletId) : null;
    if(wallet) return window.capvoWalletCountsInBudget(wallet) ? -amount : 0;

    return -amount;
  };
})();
