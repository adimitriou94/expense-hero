// CAPVO app split: 07c-add-center-v4v5.js
// V4 Premium overrides + V5 Hotfix stable state (IIFEs)
// Source: 07-add-center.js lines 1214-1591

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

    const icon=typeof capvoCategoryIcon==='function' ? capvoCategoryIcon(parsed.category) : ((typeof CEMO!=='undefined' && CEMO[parsed.category]) ? CEMO[parsed.category] : '📌');
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
          <div class="smart-preview-line"><span>Κατηγορία</span><strong>${esc(typeof capvoCategoryTreeLabel==='function'?capvoCategoryTreeLabel(parsed):(parsed.category || 'Άλλο'))}</strong></div>
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

  // NOTE: closeAddCenterSheet consolidated in 07a-add-center-core.js — no override here
  // This file intentionally does not redefine it to preserve the single authoritative version.

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

  // NOTE: closeAddCenterSheet consolidated in 07a-add-center-core.js — no override here
  // closeQuickAddSheet delegates to the consolidated closeAddCenterSheet

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
// ===== END 07c-add-center-v4v5.js =====
