// CAPVO app split: 06d3-finishing.js
// Finishing: user preference patch, skip onboarding, finish onboarding, setup prompt
// Source: 06d-misc-ui.js lines 1793-2301

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

// ============================================================
// finishCapvoOnboarding — idempotent, double-submit-safe
// v1.8.6.21 fixes:
//   1. Global guard window.__capvoFinishingOnboarding prevents double-submit
//   2. Already-completed guard prevents accidental re-run
//   3. Deterministic IDs for salary/ticket/voucher/fixed rows
//      → upsert(onConflict:'id') now truly deduplicates on retry
//   4. ALL overlay buttons disabled immediately (not just primary)
//   5. Existing primary income reused on retry (no duplicate rows)
// ============================================================
function capvoWizardDeterministicId(userId, suffix){
  // Stable text ID from suffix+userId. Safe for income_sources.id and fixed_expenses.id (text PK).
  // CRITICAL: suffix goes FIRST so the unique part is never truncated.
  // e.g. userId UUID is 36 chars; if userId went first and we sliced,
  //      'fixed_0', 'fixed_1', 'fixed_2' would all get the same ID.
  const uidShort = String(userId||'u').replace(/-/g,'').slice(0,16);
  const raw = 'ob_' + String(suffix||'x') + '_' + uidShort;
  return raw.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,60);
}

async function finishCapvoOnboarding(openTelegramAfter=false){
  // ── Guard 1: double-submit prevention ──────────────────────────────────
  if(window.__capvoFinishingOnboarding){
    console.warn('[CAPVO] finishCapvoOnboarding already in progress — ignoring duplicate call.');
    return;
  }
  window.__capvoFinishingOnboarding=true;

  const s=capvoOnboardingUpdateFromInputs();
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();

  // Disable ALL buttons in the overlay immediately to prevent any second tap.
  const overlayBtns=[...document.querySelectorAll('#capvoOnboardingOverlay button')];
  overlayBtns.forEach(b=>{b.disabled=true;});
  const primaryBtn=document.querySelector('#capvoOnboardingOverlay .ob-pro-primary, #capvoOnboardingOverlay .ob-primary');
  if(primaryBtn)primaryBtn.textContent='Αποθήκευση...';

  const resetButtons=()=>{
    overlayBtns.forEach(b=>{b.disabled=false;});
    if(primaryBtn)primaryBtn.textContent='Ολοκλήρωση';
    window.__capvoFinishingOnboarding=false;
  };

  if(!ownerUserId){
    showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');
    resetButtons();
    return;
  }

  const salaryAmount=capvoWizardBudgetAmount(s);
  const spendingLimit=capvoWizardSpendingLimitAmount(s);
  if(!capvoWizardValidateBudgetStep(s,{focus:false})){
    s.step=1;
    resetButtons();
    renderCapvoOnboardingWizard();
    return;
  }

  if(!capvoWizardValidateFixedStep(s,{focus:false})){
    s.step=2;
    resetButtons();
    renderCapvoOnboardingWizard();
    return;
  }

  // ── Guard 2: already completed ─────────────────────────────────────────
  // Allow re-run only if explicitly needed (e.g. settings update).
  // On normal flow, onboardingCompleted is false until the very end.
  // If somehow it's already true (double open), skip silently to completion.
  if(D?.preferences?.onboardingCompleted){
    console.warn('[CAPVO] onboarding already completed — skipping re-save, going to completion screen.');
    window.__capvoFinishingOnboarding=false;
    overlayBtns.forEach(b=>{b.disabled=false;});
    showCapvoOnboardingCompletion();
    return;
  }

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Ολοκληρώνεται ρύθμιση...', 'Αποθηκεύω budget, πάγια και αρχικά στοιχεία.')){
    resetButtons();
    return;
  }

  try{
    if(typeof ensureDefaultGeneralSavingsGoal==='function'){
      try{await ensureDefaultGeneralSavingsGoal();}catch(e){console.warn('[CAPVO] default savings bootstrap skipped',e);}
    }

    await capvoUpsertUserPreferencePatch({
      budget_cycle_type:s.cycleType||'fixed_day',
      budget_cycle_start_day:capvoClampCycleDay(s.cycleDay||1),
      onboarding_dismissed:false,
      onboarding_step:String(Math.max(0,Math.min(5,Number(s.step)||0)))
    });

    // ── Primary wallet: deterministic id, upsert deduplicates ───────────────
    // Salary is no longer an income source. It belongs to the primary budget wallet.
    const walletType=s.walletType==='cash'?'cash':'bank';
    const walletName=(s.salaryName||'').trim() || (walletType==='cash'?'Μετρητά':'Κύριος λογαριασμός');
    const walletBalance=capvoWizardWalletBalanceAmount(s);
    const walletId=capvoWizardDeterministicUuid(`${ownerUserId}:primary_wallet`);

    await capvoSaveWallet({
      id:walletId,
      name:walletName,
      type:walletType,
      color:capvoWizardPrimaryWalletColor(walletType),
      icon:capvoWizardPrimaryWalletIcon(walletType),
      currentBalance:walletBalance,
      includeInTotal:true,
      includeInBudget:true,
      cycleIncomeAmount:salaryAmount,
      budgetRole:walletType==='cash'?'cash':'spending',
      isSavings:false,
      isPrimaryBudget:true,
      isDefault:true,
      sortOrder:0,
      notes:'Δημιουργήθηκε από το onboarding'
    });

    // Clear old legacy primary salary flags if they exist from older versions.
    try{
      await supabaseClient
        .from('income_sources')
        .update({is_primary_income:false})
        .eq('user_id',ownerUserId)
        .eq('is_primary_income',true);
    }catch(e){
      console.warn('[CAPVO] legacy primary income cleanup skipped',e?.message||e);
    }

    // ── Ticket: deterministic id, upsert deduplicates ──────────────────────
    const ticketAmount=Number(String(s.ticketAmount||'').replace(',','.'))||0;
    if(ticketAmount>0){
      const existingTicket=(D?.incomeSources||[]).find(i=>
        !i.isPrimaryIncome &&
        (String(i.restriction||'')==='food_only' || String(i.incomeType||'')==='voucher') &&
        String(i.name||'').toLowerCase().includes('ticket')
      );
      await saveIncomeSourceRow(ownerUserId,{
        id:existingTicket?.id || capvoWizardDeterministicId(ownerUserId,'ticket_restaurant'),
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
        isPrimaryIncome:false,
        sourceType:'benefit',
        sourceCategory:'voucher',
        restrictionType:'voucher',
        isRestricted:true,
        allocationTarget:'restricted_balance',
        sourceType:'benefit',
        sourceCategory:'ticket',
        restrictionType:'ticket',
        isRestricted:true,
        allocationTarget:'restricted_balance'
      });
    }

    // ── Voucher: deterministic id, upsert deduplicates ─────────────────────
    const voucherAmount=Number(String(s.voucherAmount||'').replace(',','.'))||0;
    if(voucherAmount>0){
      const existingVoucher=(D?.incomeSources||[]).find(i=>
        !i.isPrimaryIncome &&
        String(i.restriction||'')==='card_only' &&
        String(i.name||'').toLowerCase().includes('voucher')
      );
      await saveIncomeSourceRow(ownerUserId,{
        id:existingVoucher?.id || capvoWizardDeterministicId(ownerUserId,'voucher_card'),
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

    // ── Fixed expenses: position-based deterministic ids ───────────────────
    // Wizard fixed expenses are scheduled obligations, not actual payments.
    // They do NOT reduce any wallet here. They get a sensible default schedule
    // and the primary wallet as a suggested payment source for the later
    // “Πληρώθηκε” action. Existing fixed expenses NOT from onboarding are untouched.
    const wizardFixedRows=capvoWizardFixedRowsForSave(s).filter(row=>row.amount>0 && row.name);
    const wizardFixedIds=wizardFixedRows.map(row=>capvoWizardDeterministicId(ownerUserId,capvoWizardFixedStableSuffix(row)));
    await capvoSoftDeleteObsoleteOnboardingFixedExpenses(ownerUserId,wizardFixedIds);

    for(const row of wizardFixedRows){
      const fixedId=capvoWizardDeterministicId(ownerUserId,capvoWizardFixedStableSuffix(row));
      const rowDefaults=capvoWizardFixedDefaults(s,walletId,row);
      await saveFixedExpenseRow(ownerUserId,{
        id:fixedId,
        name:row.name,
        amount:row.amount,
        category:row.category,
        ...rowDefaults,
        createdAt:typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA')
      });
    }

    // ── Savings goal name/icon update (idempotent by design) ──────────────
    let general=typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null;
    if(!general && typeof ensureDefaultGeneralSavingsGoal==='function'){
      general=await ensureDefaultGeneralSavingsGoal();
    }
    if(general){
      await supabaseClient.from('savings_goals').update({
        name:s.savingsName||'Στόχοι',
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

    // ── Mark onboarding as completed (last step — safe checkpoint) ─────────
    await capvoUpsertUserPreferencePatch({
      budget_cycle_type:s.cycleType||'fixed_day',
      budget_cycle_start_day:capvoClampCycleDay(s.cycleDay||1),
      onboarding_completed:true,
      onboarding_completed_at:new Date().toISOString(),
      onboarding_dismissed:false,
      onboarding_step:'completed'
    });

    await fetchAllData(ownerUserId);
    curM=curMK();
    ensM(curM);
    render();

    window.__capvoFinishingOnboarding=false;

    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Η αρχική ρύθμιση αποθηκεύτηκε. Τα πάγια μπήκαν ως υποχρεώσεις, όχι ως πληρωμές.');

    if(openTelegramAfter){
      if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(420);
      closeCapvoOnboardingWizard();
      window.__capvoTelegramFromWizardFinish=true;
      switchChatId?.();
      return;
    }

    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(420);
    showCapvoOnboardingCompletion();

  }catch(e){
    console.error('finish onboarding failed',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να ολοκληρώσω τη ρύθμιση.');
    showMiniToast('Δεν ολοκληρώθηκε η ρύθμιση. Δοκίμασε ξανά σε λίγο.','error');
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    resetButtons();
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
      <p>Βάλε βασικό λογαριασμό και μισθό για να δεις πόσα μπορείς να ξοδέψεις μέχρι την επόμενη πληρωμή.</p>
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
// ===== END 06d-misc-ui.js =====
// ===== END 06d3-finishing.js =====
