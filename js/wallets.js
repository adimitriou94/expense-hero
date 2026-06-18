// ============================================================
// CAPVO Wallets — Phase 2
// js/wallets.js
// Wallet rendering, sheets, transfers UI
// ============================================================

// ── State ────────────────────────────────────────────────────
let walletSheetMode = null; // 'add' | 'edit'
let walletSheetEditId = null;
let walletTransferSubmitting = false;
let walletSheetSubmitting = false;

// ── Navigation ───────────────────────────────────────────────
function openWalletsPage(){
  go('vWallets', document.querySelector('[data-v="vWallets"]'));
  renderWalletsPage();
}

// ── Dashboard money hub (Approved Option 4: premium light/dark) ──────────────
function renderWalletCards(){
  const container = document.getElementById('dashWalletCards');
  const section = document.getElementById('dashWalletsSection');
  const totalLabel = document.getElementById('dashWalletsTotalLabel');
  if(!container) return;

  container.classList.add('capvo-wallet-dashboard-v2','capvo-money-hub-approved');

  const wallets = capvoActiveWallets().filter(w=>typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(w):!w.isSavings);
  const budgetSources = (D?.incomeSources||[])
    .filter(s=>s && (typeof capvoCountsInSpendingBudget==='function'?capvoCountsInSpendingBudget(s):s.includeInBudget!==false))
    .filter(s=>!(typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(s):(s.restriction&&s.restriction!=='none')))
    .filter(s=>(Number(s.amount)||0)>0);
  const restrictedSources = (D?.incomeSources||[])
    .filter(s=>s && (typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(s):(s.restriction&&s.restriction!=='none')))
    .filter(s=>(Number(s.amount)||0)>0 || s.isRestricted || s.restrictionType || s.restriction_type);
  const cards = (D?.creditCards||[]).filter(c=>c && c.isActive!==false);

  const hasAny = wallets.length>0 || budgetSources.length>0 || restrictedSources.length>0 || cards.length>0;
  if(!hasAny){
    section && (section.style.display = 'none');
    return;
  }
  section && (section.style.display = '');

  const budgetTotal = wallets.length>0
    ? (typeof capvoGetSpendableWalletTotal==='function'?capvoGetSpendableWalletTotal():(typeof capvoWalletTotalBalance==='function'?capvoWalletTotalBalance():wallets.reduce((s,w)=>s+(Number(w.currentBalance)||0),0)))
    : (typeof budgetIncomeTotal==='function'?budgetIncomeTotal():budgetSources.reduce((s,w)=>s+(Number(w.amount)||0),0));
  const restrictedSummary = restrictedSources.reduce((acc,x)=>{
    const total = Number(x.amount)||0;
    const used = typeof restrictedCoverageFor==='function' ? (Number(restrictedCoverageFor(x))||0) : 0;
    const remaining = typeof paymentSourceRemaining==='function' ? (Number(paymentSourceRemaining(x))||0) : Math.max(0,total-used);
    acc.total += total;
    acc.used += Math.max(0,Math.min(total,used));
    acc.remaining += Math.max(0,remaining);
    return acc;
  },{total:0,used:0,remaining:0});
  const restrictedTotal = restrictedSummary.remaining;
  const restrictedInitialTotal = restrictedSummary.total;
  const cardDebtTotal = cards.reduce((s,c)=>s+(typeof cardDisplayDebt==='function'?cardDisplayDebt(c):(Number(c.balance)||0)),0);
  const moneyFmt = v => typeof fmt==='function'?fmt(v):(Number(v||0).toFixed(2)+'€');

  if(totalLabel){
    const parts=[];
    if(wallets.length>0) parts.push(`${wallets.length} ${wallets.length===1?'λογαριασμός':'λογαριασμοί'}`);
    if(restrictedSources.length>0) parts.push(`${restrictedSources.length} περιορισμένα`);
    if(cards.length>0) parts.push(`${cards.length} ${cards.length===1?'κάρτα/οφειλή':'κάρτες/οφειλές'}`);
    totalLabel.textContent = parts.join(' · ') || 'Καθαρή εικόνα χρημάτων';
  }

  const primaryWallet = wallets.find(w=>w.isPrimaryBudget) || wallets.find(w=>w.isDefault) || wallets[0] || null;
  const primaryName = primaryWallet?.name || (budgetSources.find(s=>s.isPrimaryIncome)?.name) || 'Κύριος λογαριασμός';
  const primaryType = primaryWallet
    ? ((typeof CAPVO_WALLET_TYPES!=='undefined'?CAPVO_WALLET_TYPES[primaryWallet.type]:null)?.label || 'Πηγή budget')
    : 'Πηγή budget';
  const primaryId = primaryWallet?.id ? String(primaryWallet.id) : '';
  const primaryColor = primaryWallet?.color || '#7c6dff';
  const primaryClick = primaryWallet ? `openEditWalletSheet('${esc(primaryId)}')` : `openWalletsPage()`;

  const budgetRows = wallets.length>0
    ? wallets.map(w=>capvoDashboardWalletRow(w,moneyFmt)).join('')
    : budgetSources.map(s=>capvoDashboardIncomeRow(s,moneyFmt)).join('');

  const restrictedRows = restrictedSources.map(s=>capvoDashboardRestrictedRow(s,moneyFmt)).join('');
  const cardRows = cards.map(c=>capvoDashboardCardRow(c,moneyFmt)).join('');

  container.innerHTML = `
    <button type="button" class="capvo-money-primary-card" style="--primary-wallet-color:${esc(primaryColor)}" onclick="${primaryClick}" aria-label="Άνοιγμα κύριου λογαριασμού">
      <span class="capvo-primary-card-copy">
        <span class="capvo-primary-kicker">Κύριος λογαριασμός <em>Primary</em></span>
        <span class="capvo-primary-label">Διαθέσιμα χρήματα</span>
        <strong>${moneyFmt(budgetTotal)}</strong>
        <small>${wallets.length>0?`Σε πηγές budget · ${esc(primaryName)}`:'Βασικό budget κύκλου'}</small>
      </span>
      <span class="capvo-primary-card-art" aria-hidden="true">
        <span class="capvo-wallet-3d"></span>
        <span class="capvo-card-last4">•••• ${primaryWallet?'2468':'0000'}</span>
        <span class="capvo-card-network"><i></i><i></i></span>
      </span>
      <span class="capvo-primary-arrow" aria-hidden="true">›</span>
    </button>

    <div class="capvo-money-groups">
      <details class="capvo-money-group is-budget capvo-money-group-approved" open>
        <summary>
          <span class="capvo-group-title"><i class="capvo-group-icon">🏦</i><span><strong>Πηγές Budget</strong><small>${wallets.length>0?'Τράπεζα, μετρητά, ψηφιακά πορτοφόλια':'Μισθός και διαθέσιμο budget'}</small></span></span>
          <b>${moneyFmt(budgetTotal)}</b>
        </summary>
        <div class="capvo-money-rows">
          ${budgetRows || '<div class="capvo-money-empty-row">Δεν υπάρχουν ακόμα πηγές budget.</div>'}
          <button type="button" class="capvo-money-row capvo-money-add-row" onclick="openAddWalletSheet()"><span class="capvo-money-add-plus">+</span><span><strong>Προσθήκη λογαριασμού</strong><small>Τράπεζα, μετρητά ή ψηφιακό πορτοφόλι</small></span></button>
        </div>
      </details>

      ${restrictedSources.length>0?`
        <details class="capvo-money-group is-restricted capvo-money-group-approved" open>
          <summary>
            <span class="capvo-group-title"><i class="capvo-group-icon">🔐</i><span><strong>Περιορισμένα υπόλοιπα</strong><small>Ticket, Voucher και παροχές · διαθέσιμο / σύνολο</small></span></span>
            <b title="Υπόλοιπο / συνολική παροχή">${moneyFmt(restrictedTotal)} / ${moneyFmt(restrictedInitialTotal)}</b>
          </summary>
          <div class="capvo-money-rows">${restrictedRows}</div>
        </details>`:''}

      ${cards.length>0?`
        <details class="capvo-money-group is-debt capvo-money-group-approved" open>
          <summary>
            <span class="capvo-group-title"><i class="capvo-group-icon">💳</i><span><strong>Κάρτες / Οφειλές</strong><small>Χρέος, όριο και πληρωμές</small></span></span>
            <b>${moneyFmt(cardDebtTotal)}</b>
          </summary>
          <div class="capvo-money-rows">${cardRows}</div>
        </details>`:''}
    </div>
  `;

  // Subtle realistic reveal animation, no drag/3D behavior.
  requestAnimationFrame(()=>{
    container.querySelectorAll('.capvo-money-primary-card,.capvo-money-group').forEach((el,i)=>{
      setTimeout(()=>el.classList.add('is-visible'),i*55);
    });
  });
}

function capvoDashboardWalletRow(w,moneyFmt){
  const typeInfo = (typeof CAPVO_WALLET_TYPES!=='undefined'?CAPVO_WALLET_TYPES[w.type]:null)||{label:w.type||'Λογαριασμός',icon:'🏦'};
  const bal = Number(w.currentBalance)||0;
  const balClass = bal<0?'is-negative':bal===0?'is-zero':'';
  return `
    <button type="button" class="capvo-money-row is-wallet" style="--row-color:${esc(w.color||typeInfo.color||'#6547f6')}" onclick="openEditWalletSheet('${esc(w.id)}')">
      <span class="capvo-money-row-icon">${esc(w.icon||typeInfo.icon||'🏦')}</span>
      <span class="capvo-money-row-main"><strong>${esc(w.name)}</strong><small>${esc(typeInfo.label)}${w.isDefault?' · Κύριος':''}</small></span>
      <span class="capvo-money-row-side"><strong class="${balClass}">${moneyFmt(bal)}</strong><small>Διαθέσιμα</small></span>
      <span class="capvo-money-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function capvoDashboardIncomeRow(s,moneyFmt){
  const amount = Number(s.amount)||0;
  const label = s.isPrimaryIncome?'Βασικό budget':(s.category||'Πηγή εισοδήματος');
  return `
    <button type="button" class="capvo-money-row is-income" style="--row-color:#7c6dff" onclick="typeof editIncomeSource==='function'?editIncomeSource('${esc(s.id)}'):go('vIncome',document.querySelector('[data-v=vIncome]'))">
      <span class="capvo-money-row-icon">💶</span>
      <span class="capvo-money-row-main"><strong>${esc(s.name||'Budget')}</strong><small>${esc(label)}</small></span>
      <span class="capvo-money-row-side"><strong>${moneyFmt(amount)}</strong><small>Κύκλος</small></span>
      <span class="capvo-money-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function capvoDashboardRestrictedRow(s,moneyFmt){
  const total = Number(s.amount)||0;
  const usedRaw = typeof restrictedCoverageFor==='function' ? (Number(restrictedCoverageFor(s))||0) : 0;
  const used = Math.max(0,Math.min(total,usedRaw));
  const remaining = typeof paymentSourceRemaining==='function' ? (Number(paymentSourceRemaining(s))||0) : Math.max(0,total-used);
  const rawType = String(s.restrictionType||s.restriction_type||s.sourceCategory||s.source_category||s.category||s.name||'').toLowerCase();
  const isTicket = rawType.includes('ticket');
  const isVoucher = rawType.includes('voucher') || rawType.includes('άυλη');
  const icon = isTicket?'🎫':isVoucher?'🎁':'🔒';
  const baseMeta = isTicket?'Ticket / φαγητό':isVoucher?'Voucher / άυλη':'Περιορισμένη χρήση';
  const usageMeta = total>0 ? `Χρήση ${moneyFmt(used)} / ${moneyFmt(total)}` : 'Χρήση περιορισμένης παροχής';
  const color = isTicket?'#f59e0b':isVoucher?'#8b5cf6':'#64748b';
  return `
    <button type="button" class="capvo-money-row is-restricted" style="--row-color:${color}" onclick="typeof editIncomeSource==='function'?editIncomeSource('${esc(s.id)}'):go('vIncome',document.querySelector('[data-v=vIncome]'))">
      <span class="capvo-money-row-icon">${icon}</span>
      <span class="capvo-money-row-main"><strong>${esc(s.name)}</strong><small>${esc(baseMeta)} · ${esc(usageMeta)}</small></span>
      <span class="capvo-money-row-side"><strong>${moneyFmt(remaining)}</strong><small>από ${moneyFmt(total)}</small></span>
      <span class="capvo-money-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

function capvoDashboardCardRow(c,moneyFmt){
  const debt = typeof cardDisplayDebt==='function'?cardDisplayDebt(c):(Number(c.balance)||0);
  const limit = Number(c.limit||c.limitAmount||0)||0;
  const available = typeof cardAvailableLimit==='function'?cardAvailableLimit(c):Math.max(0,limit-debt);
  const type = c.accountType||'credit_card';
  const icon = type==='loan'?'🏦':type==='bnpl'?'🧾':'💳';
  const meta = type==='loan'?'Δάνειο':type==='bnpl'?'Πλάνο δόσεων':'Πιστωτική κάρτα';
  const pct = limit>0?Math.min(100,Math.round((debt/limit)*100)):0;
  return `
    <button type="button" class="capvo-money-row is-card" style="--row-color:#6d63ff" onclick="typeof editCC==='function'?editCC('${esc(c.id)}'):go('vCards',document.querySelector('[data-v=vCards]'))">
      <span class="capvo-money-row-icon">${icon}</span>
      <span class="capvo-money-row-main"><strong>${esc(c.name)}</strong><small>${meta}${limit>0?' · Διαθέσιμο '+moneyFmt(available):''}</small>${limit>0?`<em class="capvo-card-limit-line"><i style="width:${pct}%"></i></em>`:''}</span>
      <span class="capvo-money-row-side"><strong class="is-debt">${moneyFmt(debt)}</strong><small>Οφειλή</small></span>
      <span class="capvo-money-row-chevron" aria-hidden="true">›</span>
    </button>`;
}

// ── Wallets page ─────────────────────────────────────────────
function renderWalletsPage(){
  renderWalletsTotalCard();
  renderWalletsList();
  renderWalletTransferHistory();
}

function renderWalletsTotalCard(){
  const totalEl = document.getElementById('walletsTotalAmount');
  const subEl = document.getElementById('walletsTotalSub');
  const countEl = document.getElementById('walletsCountAmount');
  const countSubEl = document.getElementById('walletsCountSub');
  const budgetEl = document.getElementById('walletsBudgetAmount');
  const defaultEl = document.getElementById('walletsDefaultName');
  const listCountEl = document.getElementById('walletsListCount');
  if(!totalEl) return;

  const wallets = capvoActiveWallets();
  const regular = wallets.filter(w=>typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(w):!w.isSavings);
  const savingsWallets = wallets.filter(w=>typeof capvoWalletCountsInBudget==='function'?!capvoWalletCountsInBudget(w):w.isSavings);
  const total = typeof capvoGetTotalWalletAssets==='function'?capvoGetTotalWalletAssets():capvoWalletTotalBalance();
  const budgetTotal = typeof capvoGetSpendableWalletTotal==='function'
    ? capvoGetSpendableWalletTotal()
    : regular.filter(w=>w.includeInTotal!==false).reduce((s,w)=>s+(Number(w.currentBalance)||0),0);
  const savings = savingsWallets.reduce((s,w)=>s+(Number(w.currentBalance)||0),0);
  const def = wallets.find(w=>w.isPrimaryBudget) || wallets.find(w=>w.isDefault) || regular[0] || wallets[0];

  totalEl.textContent = typeof fmt==='function'?fmt(total):total+'€';
  if(subEl){
    const parts = [];
    if(savings>0) parts.push(`${typeof fmt==='function'?fmt(savings):savings+'€'} αποταμίευση`);
    parts.push(`${wallets.length} ${wallets.length===1?'λογαριασμός':'λογαριασμοί'}`);
    subEl.textContent = parts.join(' · ');
  }

  if(countEl)countEl.textContent = String(wallets.length);
  if(countSubEl)countSubEl.textContent = wallets.length===1?'ενεργός':'ενεργοί';
  if(budgetEl)budgetEl.textContent = typeof fmt==='function'?fmt(budgetTotal):budgetTotal+'€';
  if(defaultEl)defaultEl.textContent = def ? (def.name || '—') : '—';
  if(listCountEl)listCountEl.textContent = `${wallets.length} ${wallets.length===1?'εγγραφή':'εγγραφές'}`;
}

function renderWalletsList(){
  const container = document.getElementById('walletsListContainer');
  if(!container) return;

  const wallets = capvoActiveWallets();

  if(wallets.length === 0){
    container.innerHTML = `
      <div class="wallets-empty">
        <div class="wallets-empty-icon">🏦</div>
        <p>Δεν έχεις λογαριασμούς ακόμα.</p>
        <p>Πρόσθεσε τους τραπεζικούς λογαριασμούς σου για να παρακολουθείς το συνολικό σου υπόλοιπο.</p>
      </div>`;
    return;
  }

  // Group: spendable budget wallets first, then savings / outside-budget wallets
  const regular = wallets.filter(w=>typeof capvoWalletCountsInBudget==='function' ? capvoWalletCountsInBudget(w) : !w.isSavings);
  const savingsWallets = wallets.filter(w=>typeof capvoWalletCountsInBudget==='function' ? !capvoWalletCountsInBudget(w) : w.isSavings);

  let html = '';

  if(regular.length>0){
    html += `<div class="wallets-group-label">Λογαριασμοί</div>`;
    html += regular.map(w=>walletRowHtml(w)).join('');
  }
  if(savingsWallets.length>0){
    html += `<div class="wallets-group-label">Αποταμίευση</div>`;
    html += savingsWallets.map(w=>walletRowHtml(w)).join('');
  }

  container.innerHTML = html;
}

function walletRowHtml(w){
  const typeInfo = CAPVO_WALLET_TYPES[w.type]||{label:'Άλλο',icon:'💼'};
  const bal = Number(w.currentBalance)||0;
  const balClass = bal < 0 ? 'is-negative' : bal === 0 ? 'is-zero' : '';
  return `
    <div class="wallet-row wallets-row-v2" data-wallet-id="${esc(w.id)}">
      <div class="wallet-row-icon" style="background:${esc(w.color||'#6547f6')}18;color:${esc(w.color||'#6547f6')}">
        ${esc(w.icon||typeInfo.icon||'🏦')}
      </div>
      <div class="wallet-row-info">
        <strong>${esc(w.name)}</strong>
        <small>${esc(typeInfo.label)}${w.isPrimaryBudget?' · Βασικός budget'+((Number(w.cycleIncomeAmount)||0)>0?' · μισθός '+(typeof fmt==='function'?fmt(w.cycleIncomeAmount):w.cycleIncomeAmount+'€'):''):w.isDefault?' · Προεπιλογή':''}${(typeof capvoWalletCountsInBudget==='function'&&!capvoWalletCountsInBudget(w))?' · εκτός budget':''}${w.includeInTotal===false?' · εκτός συνόλου':''}</small>
      </div>
      <div class="wallet-row-right">
        <div class="wallet-row-balance ${balClass}">${typeof fmt==='function'?fmt(bal):bal+'€'}</div>
        <div class="wallet-row-actions">
          <button type="button" class="wallet-action-btn" onclick="openWalletTransferSheet('${esc(w.id)}')" title="Μεταφορά">⇄</button>
          <button type="button" class="wallet-action-btn" onclick="openEditWalletSheet('${esc(w.id)}')" title="Επεξεργασία">✎</button>
        </div>
      </div>
    </div>`;
}

function renderWalletTransferHistory(){
  const container = document.getElementById('walletsTransferHistory');
  if(!container) return;

  const transfers = (D.walletTransfers||[]).slice(0,10);

  if(transfers.length===0){
    container.innerHTML = `<div class="wallets-transfer-empty">Δεν υπάρχουν μεταφορές ακόμα.</div>`;
    return;
  }

  container.innerHTML = transfers.map(t=>{
    const from = capvoWalletById(t.fromWalletId);
    const to = capvoWalletById(t.toWalletId);
    return `
      <div class="wallet-transfer-row">
        <div class="wallet-transfer-icon">⇄</div>
        <div class="wallet-transfer-info">
          <strong>${esc(from?.name||'—')} → ${esc(to?.name||'—')}</strong>
          <small>${esc(t.date||'')}${t.note?' · '+esc(t.note):''}</small>
        </div>
        <div class="wallet-transfer-amount">${typeof fmt==='function'?fmt(t.amount):t.amount+'€'}</div>
      </div>`;
  }).join('');
}

// ── Add / Edit Wallet Sheet ───────────────────────────────────
function openAddWalletSheet(){
  walletSheetMode='add';
  walletSheetEditId=null;
  renderWalletSheet(null);
}

function openEditWalletSheet(walletId){
  walletSheetMode='edit';
  walletSheetEditId=walletId;
  const wallet=capvoWalletById(walletId);
  renderWalletSheet(wallet);
}

function renderWalletSheet(wallet){
  const existingOverlay=document.getElementById('capvoWalletSheetOverlay');
  if(existingOverlay)existingOverlay.remove();

  const selectedType=wallet?.type||'bank';
  const selectedColor=wallet?.color||'#6547f6';
  const selectedIncludeInBudget = wallet
    ? (typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(wallet):wallet.includeInBudget!==false && !wallet.isSavings)
    : (typeof capvoInferWalletIncludeInBudget==='function'?capvoInferWalletIncludeInBudget({type:selectedType,isSavings:selectedType==='savings'}):selectedType!=='savings');
  const selectedIsPrimaryBudget = !!(wallet?.isPrimaryBudget || wallet?.isDefault);
  const selectedCycleIncomeAmount = wallet ? (Number(wallet.cycleIncomeAmount)||0) : 0;

  const typeOptions=Object.entries(CAPVO_WALLET_TYPES).map(([key,t])=>`
    <button type="button" class="wsheet-type-pill ${selectedType===key?'is-selected':''}"
      data-type="${key}" onclick="selectWalletType('${key}')">
      <span>${t.icon}</span> ${t.label}
    </button>`).join('');

  const colors=['#6547f6','#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];
  const colorOptions=colors.map(c=>`
    <button type="button" class="wsheet-color-dot ${selectedColor===c?'is-selected':''}"
      data-color="${c}" style="background:${c}" onclick="selectWalletColor('${c}')" aria-label="${c}"></button>`).join('');

  const overlay=document.createElement('div');
  overlay.id='capvoWalletSheetOverlay';
  overlay.className='add-center-overlay';
  overlay.onclick=(e)=>{if(e.target===overlay)closeWalletSheet();};
  overlay.innerHTML=`
    <section class="add-center-v4 capvo-wallet-sheet-v5" role="dialog" aria-label="${walletSheetMode==='add'?'Νέος λογαριασμός':'Επεξεργασία λογαριασμού'}">

      <div class="wsheet-premium-topbar">
        <button type="button" class="wsheet-close-btn" onclick="closeWalletSheet()" aria-label="Κλείσιμο">×</button>
        <div class="wsheet-title-block">
          <div class="wsheet-kicker">${walletSheetMode==='add'?'ΝΕΟΣ ΛΟΓΑΡΙΑΣΜΟΣ':'ΕΠΕΞΕΡΓΑΣΙΑ'}</div>
          <h2>${walletSheetMode==='add'?'Προσθήκη λογαριασμού':'Επεξεργασία λογαριασμού'}</h2>
          <p>${walletSheetMode==='add'?'Δημιούργησε νέα πηγή budget ή ψηφιακό πορτοφόλι.':'Άλλαξε υπόλοιπο, τύπο και εμφάνιση χωρίς να χαθούν κινήσεις.'}</p>
        </div>
      </div>

      <div class="wsheet-body">

        <div class="wsheet-preview-wrap">
          <div class="wsheet-preview-card" id="walletPreviewCard" style="--wallet-color:${selectedColor}">
            <div class="wsheet-preview-card-inner">
              <div class="wsheet-preview-top">
                <span class="wsheet-preview-icon" id="walletPreviewIcon">${wallet?.icon||'🏦'}</span>
                <span class="wsheet-preview-type">${(CAPVO_WALLET_TYPES[selectedType]||{}).label||''}</span>
              </div>
              <div class="wsheet-preview-main">
                <div>
                  <div class="wsheet-preview-label">Τρέχον υπόλοιπο</div>
                  <div class="wsheet-preview-balance" id="walletPreviewBalance">${typeof fmt==='function'?fmt(wallet?.currentBalance||0):'€0,00'}</div>
                  <div class="wsheet-preview-name" id="walletPreviewName">${esc(wallet?.name||'Νέος λογαριασμός')}</div>
                </div>
                <span class="wsheet-preview-orb" aria-hidden="true"></span>
              </div>
            </div>
          </div>
        </div>

        <div class="wsheet-section-card">
          <div class="wsheet-section-head">
            <span class="wsheet-section-icon">✦</span>
            <div>
              <strong>Βασικά στοιχεία</strong>
              <small>Το όνομα και το υπόλοιπο που θα φαίνονται στο dashboard.</small>
            </div>
          </div>

          <div class="wsheet-field">
            <label class="wsheet-label">Όνομα</label>
            <input type="text" id="walletSheetName" class="wsheet-input"
              placeholder="π.χ. Alpha Bank, Revolut, Μετρητά"
              value="${esc(wallet?.name||'')}"
              oninput="updateWalletPreview()"
              maxlength="40"
              autocomplete="off">
          </div>

          <div class="wsheet-field is-last">
            <label class="wsheet-label">Τρέχον υπόλοιπο</label>
            <div class="wsheet-amount-row">
              <span class="wsheet-currency">€</span>
              <input type="number" id="walletSheetBalance" class="wsheet-input wsheet-amount-input"
                placeholder="0,00" step="0.01" min="0" inputmode="decimal"
                value="${wallet?.currentBalance||''}"
                oninput="updateWalletPreview()">
            </div>
          </div>
        </div>

        <div class="wsheet-section-card">
          <div class="wsheet-section-head">
            <span class="wsheet-section-icon">▦</span>
            <div>
              <strong>Τύπος λογαριασμού</strong>
              <small>Βοηθάει την εφαρμογή να ξεχωρίζει τράπεζα, μετρητά και αποταμίευση.</small>
            </div>
          </div>
          <div class="wsheet-type-grid" id="walletTypePills">
            ${typeOptions}
          </div>
        </div>

        <div class="wsheet-section-card">
          <div class="wsheet-section-head">
            <span class="wsheet-section-icon">◐</span>
            <div>
              <strong>Εμφάνιση κάρτας</strong>
              <small>Χρώμα και εικονίδιο για να ξεχωρίζει εύκολα στο dashboard.</small>
            </div>
          </div>

          <div class="wsheet-field">
            <label class="wsheet-label">Χρώμα</label>
            <div class="wsheet-colors">
              ${colorOptions}
            </div>
          </div>

          <div class="wsheet-field is-last">
            <label class="wsheet-label">Εικονίδιο</label>
            <input type="text" id="walletSheetIcon" class="wsheet-input wsheet-icon-input"
              placeholder="🏦" value="${esc(wallet?.icon||'🏦')}" maxlength="4"
              oninput="updateWalletPreview()">
          </div>
        </div>

        <div class="wsheet-section-card">
          <div class="wsheet-section-head">
            <span class="wsheet-section-icon">⚙</span>
            <div>
              <strong>Budget ρυθμίσεις</strong>
              <small>Όρισε αν αυτός ο λογαριασμός επηρεάζει το διαθέσιμο budget.</small>
            </div>
          </div>
          <div class="wsheet-toggles">
            <label class="wsheet-toggle">
              <div>
                <strong>Συμπερίληψη στο συνολικό υπόλοιπο</strong>
                <small>Μετράει στη συνολική εικόνα των χρημάτων σου.</small>
              </div>
              <input type="checkbox" id="walletSheetIncludeInTotal" ${(wallet?.includeInTotal!==false)?'checked':''}>
            </label>
            <label class="wsheet-toggle" id="walletSheetBudgetToggleRow">
              <div>
                <strong>Μετράει στο διαθέσιμο budget</strong>
                <small id="walletSheetBudgetHelp">Τράπεζα/μετρητά μειώνονται με έξοδα. Αποταμίευση μένει εκτός.</small>
              </div>
              <input type="checkbox" id="walletSheetIncludeInBudget" ${selectedIncludeInBudget?'checked':''}>
            </label>
            <label class="wsheet-toggle" id="walletSheetPrimaryBudgetRow">
              <div>
                <strong>Βασικός λογαριασμός budget</strong>
                <small>Εδώ μπαίνει ο μισθός/κύριο διαθέσιμο χρήμα.</small>
              </div>
              <input type="checkbox" id="walletSheetIsPrimaryBudget" ${selectedIsPrimaryBudget?'checked':''} onchange="updateWalletBudgetSettingsState()">
            </label>
            <div class="wsheet-field capvo-cycle-income-field" id="walletSheetCycleIncomeRow">
              <label class="wsheet-label">Μισθός / ποσό κύκλου</label>
              <div class="wsheet-amount-row">
                <span class="wsheet-currency">€</span>
                <input type="number" id="walletSheetCycleIncomeAmount" class="wsheet-input wsheet-amount-input"
                  placeholder="π.χ. 1500" step="0.01" min="0" inputmode="decimal"
                  value="${selectedCycleIncomeAmount>0?selectedCycleIncomeAmount:''}">
              </div>
              <small class="wsheet-inline-help">Προστίθεται σε αυτόν τον λογαριασμό όταν πατάς “Πληρώθηκα σήμερα”. Δεν μηδενίζει τα υπάρχοντα υπόλοιπα.</small>
            </div>
          </div>
        </div>

      </div>

      <div class="wsheet-sticky-actions">
        ${walletSheetMode==='edit'?`
          <button type="button" class="wsheet-btn-danger" onclick="confirmDeleteWallet('${esc(wallet?.id||'')}')">
            Αρχειοθέτηση
          </button>
        `:''}
        <button type="button" class="wsheet-btn-primary" id="walletSheetSaveBtn" onclick="saveWalletFromSheet()">
          ${walletSheetMode==='add'?'Προσθήκη λογαριασμού':'Αποθήκευση αλλαγών'}
        </button>
      </div>
    </section>`;

  document.body.appendChild(overlay);
  document.body.classList.add('modal-open','add-center-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));

  // Avoid auto-opening the mobile keyboard; keep the sheet visually stable on open.
  updateWalletBudgetSettingsState();
  if(window.matchMedia && window.matchMedia('(pointer:fine)').matches){
    setTimeout(()=>document.getElementById('walletSheetName')?.focus(),150);
  }
}

function closeWalletSheet(){
  const overlay=document.getElementById('capvoWalletSheetOverlay');
  if(!overlay)return;

  // Remove body locks immediately so the bottom navigation returns without a visible delay.
  document.body.classList.remove('modal-open','add-center-open');
  overlay.style.pointerEvents='none';
  overlay.classList.remove('active');

  setTimeout(()=>{
    overlay.remove();
    walletSheetSubmitting=false;
  },180);
}

function updateWalletPreview(){
  const name=document.getElementById('walletSheetName')?.value||'Νέος λογαριασμός';
  const balance=parseFloat(document.getElementById('walletSheetBalance')?.value)||0;
  const icon=document.getElementById('walletSheetIcon')?.value||'🏦';

  const previewName=document.getElementById('walletPreviewName');
  const previewBal=document.getElementById('walletPreviewBalance');
  const previewIcon=document.getElementById('walletPreviewIcon');

  if(previewName)previewName.textContent=name||'Νέος λογαριασμός';
  if(previewBal)previewBal.textContent=typeof fmt==='function'?fmt(balance):'€'+balance.toFixed(2);
  if(previewIcon)previewIcon.textContent=icon||'🏦';
}

function selectWalletType(type){
  document.querySelectorAll('#capvoWalletSheetOverlay .wsheet-type-pill').forEach(b=>{
    b.classList.toggle('is-selected',b.dataset.type===type);
  });
  updateWalletBudgetSettingsState();
}

function selectWalletColor(color){
  document.querySelectorAll('#capvoWalletSheetOverlay .wsheet-color-dot').forEach(b=>{
    b.classList.toggle('is-selected',b.dataset.color===color);
  });
  const card=document.getElementById('walletPreviewCard');
  if(card)card.style.setProperty('--wallet-color',color);
}


function updateWalletBudgetSettingsState(){
  const type=document.querySelector('#capvoWalletSheetOverlay .wsheet-type-pill.is-selected')?.dataset.type||'bank';
  const includeBudget=document.getElementById('walletSheetIncludeInBudget');
  const primary=document.getElementById('walletSheetIsPrimaryBudget');
  const budgetRow=document.getElementById('walletSheetBudgetToggleRow');
  const primaryRow=document.getElementById('walletSheetPrimaryBudgetRow');
  const help=document.getElementById('walletSheetBudgetHelp');

  const isForcedOutside=['savings','investment'].includes(type);
  const defaultCounts=typeof capvoInferWalletIncludeInBudget==='function'
    ? capvoInferWalletIncludeInBudget({type,isSavings:type==='savings'})
    : !isForcedOutside;

  if(includeBudget){
    if(isForcedOutside)includeBudget.checked=false;
    else if(!includeBudget.dataset.touched)includeBudget.checked=defaultCounts;
    includeBudget.disabled=isForcedOutside;
  }
  if(primary){
    if(includeBudget && !includeBudget.checked)primary.checked=false;
    primary.disabled=!!includeBudget && !includeBudget.checked;
  }

  const cycleRow=document.getElementById('walletSheetCycleIncomeRow');
  if(cycleRow)cycleRow.style.display=(primary && primary.checked && !primary.disabled)?'block':'none';

  if(budgetRow)budgetRow.classList.toggle('is-disabled',isForcedOutside);
  if(primaryRow)primaryRow.classList.toggle('is-disabled',!!includeBudget && !includeBudget.checked);
  if(help){
    help.textContent=isForcedOutside
      ? 'Αποταμίευση/επένδυση μένει εκτός διαθέσιμου budget αλλά μετράει στο συνολικό υπόλοιπο.'
      : 'Μετράει στο καθημερινό διαθέσιμο budget και επηρεάζεται από έξοδα/μεταφορές.';
  }

  if(includeBudget){
    includeBudget.onchange=()=>{
      includeBudget.dataset.touched='1';
      if(primary && !includeBudget.checked)primary.checked=false;
      updateWalletBudgetSettingsState();
    };
  }
}


function getSelectedWalletType(){
  return document.querySelector('#capvoWalletSheetOverlay .wsheet-type-pill.is-selected')?.dataset.type||'bank';
}
function getSelectedWalletColor(){
  return document.querySelector('#capvoWalletSheetOverlay .wsheet-color-dot.is-selected')?.dataset.color||'#6547f6';
}


function capvoSheetStatus(el,msg,type='info'){
  if(!el)return;
  el.textContent=msg;
  el.style.display='block';
  el.classList.remove('is-success','is-error','is-info');
  el.classList.add(type==='success'?'is-success':type==='error'?'is-error':'is-info');
}

async function saveWalletFromSheet(){
  if(walletSheetSubmitting)return;

  const name=(document.getElementById('walletSheetName')?.value||'').trim();
  const balance=parseFloat(document.getElementById('walletSheetBalance')?.value)||0;
  const icon=(document.getElementById('walletSheetIcon')?.value||'🏦').trim()||'🏦';
  const includeInTotal=document.getElementById('walletSheetIncludeInTotal')?.checked!==false;
  const type=getSelectedWalletType();
  const includeInBudget=document.getElementById('walletSheetIncludeInBudget')?.checked!==false && !['savings','investment'].includes(type);
  const isPrimaryBudget=!!document.getElementById('walletSheetIsPrimaryBudget')?.checked && includeInBudget;
  const isDefault=isPrimaryBudget;
  const cycleIncomeAmount=isPrimaryBudget ? (parseFloat(document.getElementById('walletSheetCycleIncomeAmount')?.value)||0) : 0;
  const color=getSelectedWalletColor();
  const clearWalletValidationState=()=>{
    const legacyError=document.getElementById('walletSheetError');
    if(legacyError){
      legacyError.textContent='';
      legacyError.style.display='none';
      legacyError.classList.remove('is-success','is-error','is-info');
    }
  };

  const showError=(msg)=>{
    clearWalletValidationState();
    if(typeof showMiniToast==='function') showMiniToast(msg,'error');
  };

  clearWalletValidationState();

  if(!name){showError('Βάλε όνομα λογαριασμού.');document.getElementById('walletSheetName')?.focus();return;}
  if(balance<0){showError('Το υπόλοιπο δεν μπορεί να είναι αρνητικό.');return;}
  if(isPrimaryBudget && cycleIncomeAmount<0){showError('Το ποσό κύκλου δεν μπορεί να είναι αρνητικό.');return;}

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(walletSheetMode==='add'?'Προστίθεται λογαριασμός...':'Αποθηκεύεται λογαριασμός...', 'Ενημερώνω τα στοιχεία και το budget model.'))return;

  walletSheetSubmitting=true;
  const btn=document.getElementById('walletSheetSaveBtn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
  clearWalletValidationState();

  try{
    const walletData={
      id:walletSheetEditId||undefined,
      name,
      type,
      color,
      icon,
      currentBalance:balance,
      includeInTotal,
      includeInBudget,
      cycleIncomeAmount,
      budgetRole:typeof capvoInferWalletBudgetRole==='function' ? capvoInferWalletBudgetRole({type,isSavings:type==='savings'}) : (type==='savings'?'savings':'spending'),
      isSavings:type==='savings',
      isPrimaryBudget,
      isDefault,
      sortOrder:walletSheetEditId
        ? (capvoWalletById(walletSheetEditId)?.sortOrder||0)
        : capvoActiveWallets().length
    };

    await capvoSaveWallet(walletData);

    const userId=getFinanceUserId?.();
    if(userId){
      await fetchAllData(userId);
      render();
    }

    const successMsg=walletSheetMode==='add'?'✅ Προστέθηκε λογαριασμός':'✅ Ο λογαριασμός αποθηκεύτηκε';
    clearWalletValidationState();
    if(btn){btn.disabled=true;btn.textContent='Ολοκληρώθηκε ✓';}
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    if(typeof showMiniToast==='function') showMiniToast(successMsg,'success');

    if(document.getElementById('vWallets')?.classList.contains('active')){
      renderWalletsPage();
    }

    setTimeout(()=>closeWalletSheet(),260);

  }catch(e){
    console.error('saveWalletFromSheet failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω τον λογαριασμό.');
    showError(e.message||'Δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
    if(btn){btn.disabled=false;btn.textContent=walletSheetMode==='add'?'Προσθήκη':'Αποθήκευση';}
    walletSheetSubmitting=false;
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

async function confirmDeleteWallet(walletId){
  if(!walletId)return;
  const wallet=capvoWalletById(walletId);
  const confirmed=await showConfirmModal({
    title:'Αρχειοθέτηση λογαριασμού',
    message:`Ο λογαριασμός "${wallet?.name||'Άγνωστος'}" θα αρχειοθετηθεί. Οι κινήσεις που έχουν καταχωρηθεί δεν θα διαγραφούν.`,
    confirmText:'Αρχειοθέτηση'
  });
  if(!confirmed)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Αρχειοθετείται λογαριασμός...', 'Κρατάω τις κινήσεις και ενημερώνω τα δεδομένα.'))return;

  try{
    await capvoDeleteWallet(walletId);
    closeWalletSheet();
    const userId=getFinanceUserId?.();
    if(userId){await fetchAllData(userId);render();}
    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Ο λογαριασμός αρχειοθετήθηκε.');
    showMiniToast('✅ Αρχειοθετήθηκε');
    if(document.getElementById('vWallets')?.classList.contains('active')) renderWalletsPage();
  }catch(e){
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αρχειοθετήσω τον λογαριασμό.');
    showMiniToast(e.message||'Σφάλμα αρχειοθέτησης','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

// ── Transfer Sheet ────────────────────────────────────────────
function openWalletTransferSheet(fromWalletId=null){
  const existingOverlay=document.getElementById('capvoTransferSheetOverlay');
  if(existingOverlay)existingOverlay.remove();

  const wallets=capvoActiveWallets();
  const fromWallet=fromWalletId?capvoWalletById(fromWalletId):null;
  const walletOptions=(selected)=>wallets.map(w=>`
    <option value="${esc(w.id)}" ${String(w.id)===String(selected||'')?'selected':''}>
      ${esc(w.icon||'🏦')} ${esc(w.name)} (${typeof fmt==='function'?fmt(w.currentBalance):w.currentBalance+'€'})
    </option>`).join('');

  const overlay=document.createElement('div');
  overlay.id='capvoTransferSheetOverlay';
  overlay.className='reports-sheet-overlay capvo-transfer-overlay-v2';
  overlay.onclick=(e)=>{if(e.target===overlay)closeTransferSheet();};
  overlay.innerHTML=`
    <div class="reports-sheet capvo-transfer-sheet capvo-transfer-sheet-v2" role="dialog" aria-label="Μεταφορά μεταξύ λογαριασμών">
      <div class="transfer-premium-handle"></div>

      <div class="transfer-premium-header">
        <div class="transfer-premium-title">
          <span class="transfer-premium-kicker">ΜΕΤΑΦΟΡΑ</span>
          <strong>Μεταφορά χρημάτων</strong>
          <small>Μετακίνησε ποσό μεταξύ των λογαριασμών σου χωρίς να επηρεαστεί το budget.</small>
        </div>
        <button type="button" class="transfer-premium-close" onclick="closeTransferSheet()" aria-label="Κλείσιμο">×</button>
      </div>

      <div class="transfer-premium-card">
        <div class="transfer-premium-icon">⇄</div>
        <div>
          <span>Από</span>
          <strong id="transferPreviewFrom">${esc(fromWallet?.name||'Επίλεξε λογαριασμό')}</strong>
        </div>
        <em>προς</em>
        <div>
          <span>Προς</span>
          <strong id="transferPreviewTo">Επίλεξε λογαριασμό</strong>
        </div>
      </div>

      <div class="transfer-budget-impact" id="transferBudgetImpact">
        Δεν αλλάζει το διαθέσιμο budget.
      </div>

      <div class="transfer-sheet-body transfer-sheet-body-v2">
        <div class="transfer-field-group transfer-field-card">
          <label>Από</label>
          <select id="transferFromWallet" class="wallet-input" onchange="updateTransferAvailable();updateTransferPreview();">
            <option value="">Επίλεξε λογαριασμό...</option>
            ${walletOptions(fromWalletId)}
          </select>
          <small id="transferAvailableLabel" class="transfer-available-hint"></small>
        </div>

        <div class="transfer-field-group transfer-field-card">
          <label>Προς</label>
          <select id="transferToWallet" class="wallet-input" onchange="updateTransferPreview()">
            <option value="">Επίλεξε λογαριασμό...</option>
            ${walletOptions(null)}
          </select>
        </div>

        <div class="transfer-field-group transfer-field-card">
          <label>Ποσό</label>
          <div class="transfer-amount-row">
            <span class="transfer-currency">€</span>
            <input type="number" id="transferAmount" class="wallet-input transfer-amount-input"
              placeholder="0,00" step="0.01" min="0.01" oninput="updateTransferPreview()">
          </div>
        </div>

        <div class="transfer-field-group transfer-field-card">
          <label>Σημείωση (προαιρετικό)</label>
          <input type="text" id="transferNote" class="wallet-input" placeholder="π.χ. Ανάληψη ATM" maxlength="100">
        </div>

        <div id="transferSheetError" class="wallet-sheet-error" style="display:none"></div>
      </div>

      <div class="transfer-premium-actions">
        <button type="button" class="wallet-btn-primary transfer-submit-btn" id="transferSubmitBtn" onclick="submitWalletTransfer()">
          Εκτέλεση μεταφοράς
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));

  if(fromWalletId)updateTransferAvailable();
  updateTransferPreview();
}

function closeTransferSheet(){
  const overlay=document.getElementById('capvoTransferSheetOverlay');
  if(!overlay)return;

  // Remove body lock immediately so the bottom navigation returns without waiting for the sheet animation.
  document.body.classList.remove('modal-open');
  overlay.style.pointerEvents='none';
  overlay.classList.remove('active');

  setTimeout(()=>{
    overlay.remove();
    walletTransferSubmitting=false;
  },180);
}

function updateTransferAvailable(){
  const fromId=document.getElementById('transferFromWallet')?.value;
  const hintEl=document.getElementById('transferAvailableLabel');
  if(!hintEl)return;
  const w=fromId?capvoWalletById(fromId):null;
  hintEl.textContent=w?`Διαθέσιμο: ${typeof fmt==='function'?fmt(w.currentBalance):w.currentBalance+'€'}`:'';
}

function updateTransferPreview(){
  const fromId=document.getElementById('transferFromWallet')?.value;
  const toId=document.getElementById('transferToWallet')?.value;
  const amount=parseFloat(document.getElementById('transferAmount')?.value)||0;
  const from=fromId?capvoWalletById(fromId):null;
  const to=toId?capvoWalletById(toId):null;
  const fromEl=document.getElementById('transferPreviewFrom');
  const toEl=document.getElementById('transferPreviewTo');
  const impactEl=document.getElementById('transferBudgetImpact');
  if(fromEl)fromEl.textContent=from?.name||'Επίλεξε λογαριασμό';
  if(toEl)toEl.textContent=to?.name||'Επίλεξε λογαριασμό';
  if(impactEl){
    const text=(from&&to&&amount>0&&typeof capvoDescribeTransferBudgetImpact==='function')
      ? capvoDescribeTransferBudgetImpact(from,to,amount)
      : 'Δεν αλλάζει το διαθέσιμο budget.';
    impactEl.textContent=text;
    const impact=(from&&to&&amount>0&&typeof capvoTransferBudgetImpact==='function')?capvoTransferBudgetImpact(from,to,amount):0;
    impactEl.classList.toggle('is-negative',impact<0);
    impactEl.classList.toggle('is-positive',impact>0);
  }
}

async function submitWalletTransfer(){
  if(walletTransferSubmitting)return;

  const fromWalletId=document.getElementById('transferFromWallet')?.value;
  const toWalletId=document.getElementById('transferToWallet')?.value;
  const amount=parseFloat(document.getElementById('transferAmount')?.value)||0;
  const note=(document.getElementById('transferNote')?.value||'').trim();
  const errorEl=document.getElementById('transferSheetError');
  const clearTransferValidationState=()=>{
    if(errorEl){
      errorEl.textContent='';
      errorEl.style.display='none';
      errorEl.classList.remove('is-success','is-error','is-info');
    }
  };

  const showError=(msg)=>{
    clearTransferValidationState();
    if(typeof showMiniToast==='function')showMiniToast(msg,'error');
  };

  clearTransferValidationState();

  if(!fromWalletId){showError('Επίλεξε λογαριασμό αποστολής.');return;}
  if(!toWalletId){showError('Επίλεξε λογαριασμό παραλαβής.');return;}
  if(fromWalletId===toWalletId){showError('Επίλεξε δύο διαφορετικούς λογαριασμούς.');return;}
  if(amount<=0){showError('Βάλε έγκυρο ποσό μεταφοράς.');return;}

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Εκτελείται μεταφορά...', 'Ενημερώνω τα υπόλοιπα των λογαριασμών.'))return;

  walletTransferSubmitting=true;
  const btn=document.getElementById('transferSubmitBtn');
  if(btn){btn.disabled=true;btn.textContent='Εκτέλεση...';}

  try{
    await capvoSaveWalletTransfer({fromWalletId,toWalletId,amount,note});

    const userId=getFinanceUserId?.();
    if(userId){await fetchAllData(userId);render();}

    const successMsg=`✅ Μεταφορά ${typeof fmt==='function'?fmt(amount):amount+'€'} ολοκληρώθηκε`;
    clearTransferValidationState();
    if(btn){btn.disabled=true;btn.textContent='Ολοκληρώθηκε ✓';}
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast(successMsg);

    if(document.getElementById('vWallets')?.classList.contains('active')) renderWalletsPage();

    setTimeout(()=>closeTransferSheet(),260);

  }catch(e){
    console.error('submitWalletTransfer failed:',e);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Η μεταφορά απέτυχε.');
    showError(e.message||'Η μεταφορά απέτυχε. Δοκίμασε ξανά.');
    if(btn){btn.disabled=false;btn.textContent='Εκτέλεση μεταφοράς';}
    walletTransferSubmitting=false;
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}
