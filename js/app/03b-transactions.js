// CAPVO app split: 03b-transactions.js
// Transactions/Daily: mobile filters, daily list, search, filters, wallet effects, quick add
// Source: 03-render-dashboard-transactions-income.js lines 1043-2242

let mobileTransactionFilter='all';
let txMobileDailyExpanded=false;
let txMobileFixedExpanded=false;

function setMobileTransactionFilter(filter='all'){
  mobileTransactionFilter=filter;
  txMobileDailyExpanded=false;
  document.querySelectorAll('[data-mobile-transaction-filter]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.mobileTransactionFilter===filter);
  });
  renderDailyList();
}

function mobileTransactionMatchesFilter(e){
  const filter=mobileTransactionFilter||'all';
  if(filter==='all' || filter==='cycle') return true;

  const kind=typeof capvoMovementKind==='function'?capvoMovementKind(e):String(e.movementGroup||'budget');
  if(filter==='budget' || filter==='expenses')return kind==='expenses' || kind==='benefits';
  if(filter==='fixed')return kind==='fixed' || !!(e.isFixedExpensePayment||e.isFixedExpense);
  if(filter==='cards')return kind==='cards' || String(e.paymentAccountType||e.payment_account_type||'').includes('credit_card') || !!(e.isCardPayment||e.isCreditCardPurchase||e.creditCardId||e.installmentPlanId);
  if(filter==='wallets')return kind==='wallets' || !!e.isWalletTransfer;
  if(filter==='savings')return kind==='savings' || !!e.isSavingsMovement;
  if(filter==='income')return kind==='income' || !!e.isIncomeMovement;
  if(filter==='returns')return (typeof capvoMovementBudgetImpact==='function'?capvoMovementBudgetImpact(e):Number(e.amount)||0)<0;

  const dateStr=String(e.date||'');
  if(!dateStr) return true;

  const todayKey=typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
  const today=new Date(todayKey+'T12:00:00');
  const itemDate=new Date(dateStr+'T12:00:00');

  if(filter==='today'){
    return dateStr===todayKey;
  }

  if(filter==='week'){
    const diff=(today-itemDate)/(1000*60*60*24);
    return diff>=0 && diff<=7;
  }

  return true;
}

function mobileTransactionMatchesSearch(e){
  const input=document.getElementById('mobileTransactionSearch');
  const q=(input?.value||'').trim().toLowerCase();
  if(!q)return true;

  const haystack=[
    typeof capvoExpenseSearchText==='function'?capvoExpenseSearchText(e):'',
    typeof capvoCategoryTreeLabel==='function'?capvoCategoryTreeLabel(e):'',
    typeof capvoMovementTypeLabel==='function'?capvoMovementTypeLabel(e):'',
    e.name,e.category,e.merchantName||e.merchant_name,e.notes||e.note,
    e.paymentSourceName,e.paymentAccountType,e.sourceLabel,e.movementType,e.date,
    e.amount
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(q);
}

function getExpenseByTypeAndId(type,id){
  if(type==='fixed') return (D.fixedExpenses||[]).find(x=>x.id===id);
  const m=D.months[curM]||{daily:[]};
  return (m.daily||[]).find(x=>x.id===id);
}

function showMobileTransactionDetail(type,id){
  if(window.innerWidth>768){
    return (type==='fixed') ? editExp(type,id) : undefined;
  }

  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  txCompleteDetailState={type,id};

  const overlay=document.getElementById('mobileTransactionDetail');
  const content=document.getElementById('mobileTransactionDetailContent');
  if(!overlay || !content)return;

  const category=e.category||'Άλλο';
  const icon=CEMO[category]||'📌';
  const payText=txCompletePaymentText(e,type);
  const amount=Number(e.amount)||0;
  const dateLabel=type==='fixed' ? 'Κάθε μήνα' : txCompleteLongDate(e.date);
  const typeLabel=type==='fixed' ? 'Πάγιο έξοδο' : 'Ημερήσια κίνηση';
  const noteText=e.notes || e.note || '';

  content.innerHTML=`
    <div class="tx-v25-detail-hero">
      <button class="tx-v25-close" type="button" onclick="closeMobileTransactionDetail()" aria-label="Κλείσιμο">×</button>
      <div class="tx-v25-icon ${CCLS[category]||'cat-other'}">${icon}</div>
      <div class="tx-v25-kicker">${typeLabel}</div>
      <h3>${esc(e.name)}</h3>
      <div class="tx-v25-amount">-${fmt(amount)}</div>
      <div class="tx-v25-subtitle">${esc(category)} · ${esc(payText)}</div>
    </div>

    <div class="tx-v25-summary">
      <div class="tx-v25-summary-item">
        <span>Ημερομηνία</span>
        <strong>${esc(dateLabel)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Κατηγορία</span>
        <strong>${esc(category)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Πληρωμή</span>
        <strong>${esc(payText)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Τύπος</span>
        <strong>${type==='fixed'?'Σταθερό':'Ημερήσιο'}</strong>
      </div>
    </div>

    ${noteText ? `
      <div class="tx-v25-note">
        <span>Σημείωση</span>
        <p>${esc(noteText)}</p>
      </div>
    ` : ''}

    <div class="tx-v25-actions">
      <button type="button" class="tx-v25-action primary" onclick="txCompleteOpenManualForEdit('${type}','${id}')">
        <span>✎</span>
        Επεξεργασία
      </button>
      <button type="button" class="tx-v25-action secondary" onclick="txCompleteOpenManualForDuplicate('${type}','${id}')">
        <span>⧉</span>
        Αντιγραφή
      </button>
      <button type="button" class="tx-v25-action danger" onclick="txCompleteDeleteWithConfirm('${type}','${id}')">
        <span>🗑</span>
        Διαγραφή
      </button>
    </div>
  `;

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}

function closeMobileTransactionDetail(){
  const overlay=document.getElementById('mobileTransactionDetail');
  overlay?.classList.remove('active');
  document.body.classList.remove('sheet-open');
}

function renderDailyList(){
  // Use the full unified ledger so fixed expenses, card payments, and savings
  // all appear in the Κινήσεις page — not just daily expense rows.
  const allMovements=typeof getCurrentCycleAllMovements==='function'
    ? getCurrentCycleAllMovements()
    : getCurrentCycleDailyExpenses();
  // Keep daily-only count for the selection/bulk-delete toolbar (only real expenses are editable).
  const m={daily:getCurrentCycleDailyExpenses()};

  $('cDaily').innerHTML=`
    ${allMovements.length} κινήσεις μήνα
    <button class="mini-action" onclick="toggleSelectMode('daily')">${selectionMode.daily?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.daily?`
      <button class="mini-action" onclick="selectAllVisible('daily')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('daily')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('daily')">Διαγραφή</button>
    `:''}
  `;

  if(allMovements.length===0){
    $('lDaily').innerHTML=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Δεν υπάρχουν κινήσεις για αυτόν τον κύκλο
      </div>`;
    return;
  }

  const grouped={};

  [...allMovements]
    .filter(e=>mobileTransactionMatchesSearch(e) && mobileTransactionMatchesFilter(e))
    .sort((a,b)=>
      String(b.date||'').localeCompare(String(a.date||'')) ||
      String(b.createdAt||b.created_at||'').localeCompare(String(a.createdAt||a.created_at||'')) ||
      String(b.id||'').localeCompare(String(a.id||''))
    )
    .forEach(e=>{
      if(!grouped[e.date]) grouped[e.date]=[];
      grouped[e.date].push(e);
    });

  if(Object.keys(grouped).length===0){
    $('lDaily').innerHTML=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <path d="M7.5 4.21l4.5 2.6 4.5-2.6"/>
          <path d="M7.5 19.79V14.6L3 12"/>
          <path d="M21 12l-4.5 2.6v5.19"/>
        </svg>
        Δεν υπάρχουν κινήσεις με αυτά τα φίλτρα.
      </div>`;
    return;
  }

  let html='';

  Object.keys(grouped).sort().reverse().forEach(dt=>{
    const d=new Date(dt+'T12:00:00');
    // Show budget impact total per day (excludes credit card purchases, restricted sources etc.)
    const dayBudgetImpact=grouped[dt].reduce((s,e)=>{
      const impact=typeof capvoMovementBudgetImpact==='function'
        ? capvoMovementBudgetImpact(e)
        : (e.affectsBudget!==false ? (Number(e.budgetImpactAmount)||Number(e.amount)||0) : 0);
      return s+impact;
    },0);

    html+=`
      <div class="day-header">
        <span>${DG[d.getDay()]}, ${d.getDate()} ${MG[d.getMonth()]}</span>
        <span class="day-total" title="Επίδραση budget">${fmt(dayBudgetImpact)}</span>
      </div>`;

    grouped[dt].forEach(e=>html+=eRow(e,'daily'));
  });

  $('lDaily').innerHTML=html;
}


function renderMobileCategoryInsights(){
  const donut = $('mobileCategoryDonut');
  const list = $('mobileCategoryList');
  const totalEl = $('mobileCategoryTotal');

  if(!donut || !list || !totalEl) return;

  const dailyRows = typeof getCurrentCycleBudgetMovements==='function'
    ? getCurrentCycleBudgetMovements()
    : (typeof getCurrentCycleBudgetExpenses==='function' ? getCurrentCycleBudgetExpenses() : getCurrentCycleDailyExpenses());
  const totals = {};

  (dailyRows || []).forEach(e=>{
    const cat = e.category || 'Άλλο';
    const value=typeof capvoMovementBudgetImpact==='function'
      ? Math.abs(capvoMovementBudgetImpact(e))
      : Math.abs(Number(e.amount)||0);
    if(value<=0)return;
    totals[cat] = (totals[cat] || 0) + value;
  });

  const rows = Object.entries(totals)
    .map(([category,total])=>({category,total}))
    .filter(x=>x.total>0)
    .sort((a,b)=>b.total-a.total)
    .slice(0,5);

  const total = rows.reduce((s,x)=>s+x.total,0);
  totalEl.textContent = fmt(total);

  if(total<=0 || rows.length===0){
    donut.style.background = 'conic-gradient(#eef2ff 0deg 360deg)';
    list.innerHTML = `
      <div class="mobile-category-empty">
        Δεν υπάρχουν κινήσεις που επηρεάζουν το budget για γράφημα ακόμα.
      </div>
    `;
    return;
  }

  let start = 0;
  const segments = rows.map(row=>{
    const pct = row.total / total;
    const end = start + pct * 360;
    const color = CCLR[row.category] || '#8b5cf6';
    const segment = `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    start = end;
    return segment;
  });

  if(start < 360){
    segments.push(`#e8edf7 ${start.toFixed(2)}deg 360deg`);
  }

  donut.style.background = `conic-gradient(${segments.join(',')})`;

  list.innerHTML = rows.map(row=>{
    const pct = Math.round((row.total / total) * 100);
    const color = CCLR[row.category] || '#8b5cf6';
    return `
      <div class="mobile-category-row">
        <span class="mobile-category-dot" style="background:${color}"></span>
        <span class="mobile-category-name">${esc(row.category)}</span>
        <span class="mobile-category-pct">${pct}%</span>
        <strong>${fmt(row.total)}</strong>
      </div>
    `;
  }).join('');
}

function renderDashboardPreview(){
  const el = $('dashRecentList');
  if(!el)return;

  const sourceRows = typeof getCurrentCycleAllMovements==='function'
    ? getCurrentCycleAllMovements()
    : (typeof getCurrentCycleBudgetMovements==='function'
      ? getCurrentCycleBudgetMovements()
      : getCurrentCycleDailyExpenses());

  const recent = [...(sourceRows||[])]
    .sort((a,b)=>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.createdAt || b.created_at || '').localeCompare(String(a.createdAt || a.created_at || '')) ||
      String(b.id || '').localeCompare(String(a.id || ''))
    )
    .slice(0,5);

  if(recent.length === 0){
    el.innerHTML = `
      <div class="empty mini-empty">
        Δεν υπάρχουν πρόσφατες κινήσεις για αυτόν τον κύκλο.
      </div>
    `;
    return;
  }

  el.innerHTML = recent.map(e => {
    const affects=!!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
    const impact=typeof capvoMovementBudgetImpact==='function'
      ? capvoMovementBudgetImpact(e)
      : (affects?(Number(e.amount)||0):0);
    const rawAmount=Number(e.amount)||0;
    const isReturn=affects && impact<0;
    const amountLabel=!affects
      ? fmt(Math.abs(rawAmount))
      : (isReturn?`+${fmt(Math.abs(impact))}`:`-${fmt(Math.abs(impact))}`);

    const group=String(e.movementGroup||'');
    const isCard=group==='cards' || e.isCardPayment || e.isCreditCardPurchase || e.paymentAccountType==='credit_card';
    const isSavings=group==='savings' || e.isSavingsMovement;
    const isFixed=String(e.movementType||'')==='fixed_expense' || e.isFixedExpense;
    const badges=[];
    if(isFixed)badges.push('Πάγιο');
    if(isCard)badges.push('Κάρτα');
    if(isSavings)badges.push('Στόχος');
    if(!affects)badges.push('Δεν επηρεάζει budget');
    if(affects && isReturn)badges.push('Επιστροφή budget');

    const categoryLabel=typeof capvoCategoryTreeLabel==='function'?capvoCategoryTreeLabel(e):(e.category||'Άλλο');
    const categoryIcon=typeof capvoCategoryIcon==='function'?capvoCategoryIcon(e.category):(CEMO[e.category]||'📌');
    const categoryClass=typeof capvoCategoryCssClass==='function'?capvoCategoryCssClass(e.category):(CCLS[e.category]||'cat-other');
    const displayTitle=typeof capvoMovementDisplayTitle==='function'?capvoMovementDisplayTitle(e):(e.merchantName||e.merchant_name||e.name||'Κίνηση');
    const noteText=String(e.notes||e.note||'').trim();
    const typeLabel=typeof capvoMovementTypeLabel==='function'?capvoMovementTypeLabel(e):'';
    const meta=[
      typeLabel?esc(typeLabel):'',
      esc(categoryLabel),
      e.merchantName||e.merchant_name?esc(e.merchantName||e.merchant_name):'',
      noteText?`📝 ${esc(noteText)}`:'',
      e.sourceLabel?esc(e.sourceLabel):'',
      ...badges.map(esc)
    ].filter(Boolean).join(' · ');

    return `
    <div class="dashboard-preview-row">
      <div class="expense-icon ${categoryClass}">
        ${categoryIcon || (isFixed?'📌':'📌')}
      </div>

      <div class="dashboard-preview-info">
        <strong>${esc(displayTitle)}</strong>
        <span>${meta}</span>
      </div>

      <div class="dashboard-preview-amount ${e.isCardPayment?'is-payment':''} ${isReturn?'is-return':''} ${!affects?'is-neutral':''}">
        ${amountLabel}
      </div>
    </div>`;
  }).join('');
}


function dashboardRemainingDays(){
  return budgetCycleRemainingDays();
}

function ensureDashboardAllowanceStyles(){
  if(document.getElementById('dashboardAllowanceCardsStyles'))return;

  const style=document.createElement('style');
  style.id='dashboardAllowanceCardsStyles';
  style.textContent=`
    .modern-hero-card{
      overflow:hidden !important;
    }

    .dashboard-allowance-cards{
      position:relative !important;
      z-index:3 !important;
      width:100% !important;
      margin:14px 0 0 !important;
      padding:8px !important;
      display:grid !important;
      grid-template-columns:repeat(3,minmax(0,1fr)) !important;
      gap:8px !important;
      border-radius:22px !important;
      background:rgba(255,255,255,.10) !important;
      border:1px solid rgba(255,255,255,.14) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.10),
        0 12px 28px rgba(0,0,0,.08) !important;
      backdrop-filter:blur(12px) saturate(1.15) !important;
      -webkit-backdrop-filter:blur(12px) saturate(1.15) !important;
    }

    .dashboard-allowance-card{
      min-width:0 !important;
      min-height:54px !important;
      padding:9px 6px !important;
      border-radius:16px !important;
      background:rgba(255,255,255,.10) !important;
      border:1px solid rgba(255,255,255,.12) !important;
      display:grid !important;
      align-content:center !important;
      justify-items:center !important;
      text-align:center !important;
      gap:4px !important;
    }

    .dashboard-allowance-card span{
      color:rgba(255,255,255,.62) !important;
      font-size:9px !important;
      line-height:1 !important;
      font-weight:950 !important;
      letter-spacing:.08em !important;
      text-transform:uppercase !important;
      white-space:nowrap !important;
    }

    .dashboard-allowance-card strong{
      color:#ffffff !important;
      font-family:var(--mono,monospace) !important;
      font-size:16px !important;
      line-height:1 !important;
      font-weight:950 !important;
      letter-spacing:-.06em !important;
      white-space:nowrap !important;
    }

    .dashboard-allowance-card small{
      color:rgba(255,255,255,.56) !important;
      font-size:8px !important;
      line-height:1 !important;
      font-weight:800 !important;
      white-space:nowrap !important;
      overflow:hidden !important;
      text-overflow:ellipsis !important;
      max-width:100% !important;
    }

    .dashboard-allowance-card.is-primary{
      background:rgba(255,255,255,.16) !important;
      border-color:rgba(255,255,255,.18) !important;
    }

    .dashboard-allowance-card.is-primary strong{
      color:#ffffff !important;
    }

    .dashboard-allowance-card.is-danger strong{
      color:#fecaca !important;
    }



    .dashboard-budget-start-card{
      display:grid;
      grid-template-columns:28px minmax(0,1fr) auto;
      align-items:center;
      gap:8px;
      margin:8px 8px 8px;
      padding:8px 9px;
      border-radius:18px;
      background:rgba(255,255,255,.92);
      border:1px solid rgba(226,232,240,.92);
      box-shadow:0 8px 20px rgba(15,23,42,.045);
    }

    .dashboard-budget-start-icon{
      width:28px;
      height:28px;
      border-radius:13px;
      display:grid;
      place-items:center;
      background:linear-gradient(135deg,rgba(79,70,229,.10),rgba(34,211,238,.08));
      color:#4f46e5;
      font-size:13px;
      flex-shrink:0;
    }

    .dashboard-budget-start-copy{
      min-width:0;
    }

    .dashboard-budget-start-card strong{
      display:block;
      color:#0f172a;
      font-size:12.5px;
      line-height:1.05;
      font-weight:760;
      letter-spacing:-.014em;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }


    .dashboard-budget-start-actions{
      grid-column:auto;
      display:flex;
      align-items:center;
      gap:6px;
      margin-top:0;
      justify-content:flex-end;
      min-width:max-content;
    }

    .dashboard-budget-start-actions button{
      border:0;
      border-radius:999px;
      padding:8px 10px;
      font-weight:740;
      font-size:10.5px;
      cursor:pointer;
      line-height:1;
      white-space:nowrap;
    }

    .dashboard-budget-start-primary{
      color:#ffffff;
      background:linear-gradient(135deg,#111827,#312e81);
      box-shadow:0 6px 14px rgba(79,70,229,.12);
    }

    .dashboard-budget-start-secondary{
      color:#64748b;
      background:#eef2f7;
    }

    .dashboard-budget-start-card + .mobile-dashboard-insights{
      margin-top:8px !important;
    }

    @media (max-width:390px){
      .dashboard-budget-start-card{
        grid-template-columns:26px minmax(0,1fr);
        margin:7px 6px 8px;
        padding:8px;
        gap:7px;
      }

      .dashboard-budget-start-icon{
        width:26px;
        height:26px;
      }

      .dashboard-budget-start-actions{
        grid-column:1 / -1;
        width:100%;
        display:grid;
        grid-template-columns:1fr auto;
        gap:7px;
      }

      .dashboard-budget-start-actions button{
        padding:8px 10px;
      }
    }

    @media (max-width:768px){
      .modern-hero-card{
        margin-bottom:14px !important;
      }

      .dashboard-allowance-cards{
        margin-top:12px !important;
        padding:6px !important;
        gap:6px !important;
        border-radius:19px !important;
      }

      .dashboard-allowance-card{
        min-height:48px !important;
        padding:7px 4px !important;
        border-radius:14px !important;
      }

      .dashboard-allowance-card span{
        font-size:7.5px !important;
      }

      .dashboard-allowance-card strong{
        font-size:13.2px !important;
      }

      .dashboard-allowance-card small{
        font-size:7px !important;
      }
    }

    @media (max-width:370px){
      .dashboard-allowance-card strong{font-size:12px !important;}
      .dashboard-allowance-card small{display:none !important;}
    }
  `;
  document.head.appendChild(style);
}



function renderFirstUseBudgetPrompt(){
  const hero=document.querySelector('.modern-hero-card');
  if(!hero)return;

  let el=document.getElementById('dashboardBudgetStartCard');
  const legacyDismissed=localStorage.getItem('capvo_budget_start_dismissed')==='1';
  if(legacyDismissed && !localStorage.getItem('capvo_budget_start_dismissed_at')){
    localStorage.setItem('capvo_budget_start_dismissed_at',String(Date.now()));
    localStorage.removeItem('capvo_budget_start_dismissed');
  }

  const dismissedAt=Number(localStorage.getItem('capvo_budget_start_dismissed_at')||0);
  const dismissWindowMs=24*60*60*1000;
  const dismissed=!!dismissedAt && (Date.now()-dismissedAt)<dismissWindowMs;
  const hasBudget=hasBudgetIncomeConfigured();
  const hasAnyData=(D.incomeSources||[]).length>0 || fixedTotal()>0 || dailyTotal()>0 || (D.creditCards||[]).length>0;

  if(hasBudget || dismissed){
    if(el)el.remove();
    return;
  }

  if(!el){
    el=document.createElement('section');
    el.id='dashboardBudgetStartCard';
    el.className='dashboard-budget-start-card';
    hero.insertAdjacentElement('afterend',el);
  }

  el.innerHTML=`
    <div class="dashboard-budget-start-icon" aria-hidden="true">💡</div>
    <div class="dashboard-budget-start-copy">
      <strong>${hasAnyData?'Οργάνωσε το budget σου':'Ξεκίνα με budget'}</strong>
    </div>
    <div class="dashboard-budget-start-actions">
      <button type="button" class="dashboard-budget-start-primary" onclick="go('vWallets',document.querySelector('[data-v=vWallets]'));">Ορισμός βασικού λογαριασμού</button>
      <button type="button" class="dashboard-budget-start-secondary" onclick="localStorage.setItem('capvo_budget_start_dismissed_at',String(Date.now()));localStorage.removeItem('capvo_budget_start_dismissed');document.getElementById('dashboardBudgetStartCard')?.remove();">Αργότερα</button>
    </div>
  `;
}


function renderDashboardAllowanceCards(balanceOverride=null){
  const hero=document.querySelector('.modern-hero-card');
  if(!hero)return;

  ensureDashboardAllowanceStyles();

  let el=document.getElementById('dashboardAllowanceCards');
  if(!el){
    el=document.createElement('section');
    el.id='dashboardAllowanceCards';
    hero.appendChild(el);
  }

  el.className='dashboard-allowance-cards hero-budget-metrics';

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const cashDaily=dailyCashTotal();
  const spent=fxS+ccS+cashDaily;
  const income=Number(D.income)||0;
  const cycleAmount=typeof totalCycleAmount==='function'?totalCycleAmount():income;
  const reserved=typeof budgetLimitReservedAmount==='function'?budgetLimitReservedAmount():0;
  const balance=balanceOverride!==null && balanceOverride!==undefined
    ? Number(balanceOverride)||0
    : income-spent;

  const remainingDays=dashboardRemainingDays();
  const safeBalance=Math.max(0,balance);
  const daily=remainingDays>0?safeBalance/remainingDays:0;
  const weekly=daily*7;
  const limitInfo=reserved>0
    ? `<button type="button" class="dashboard-budget-limit-note compact" onclick="openBudgetLimitInfoSheet()">
        <span>Όριο ${fmt(income)} · Υπόλοιπο ${fmt(balance)} · ${fmt(reserved)} εκτός budget</span>
        <i aria-hidden="true">i</i>
      </button>`
    : '';

  el.innerHTML=`
    ${limitInfo}
    <article class="dashboard-allowance-card is-primary">
      <span>Ημέρα</span>
      <strong>${fmt(daily)}</strong>
      <small>ανά ημέρα</small>
    </article>

    <article class="dashboard-allowance-card">
      <span>Εβδομάδα</span>
      <strong>${fmt(weekly)}</strong>
      <small>ανά 7 ημέρες</small>
    </article>

    <article class="dashboard-allowance-card ${balance<0?'is-danger':''}">
      <span>Μέρες</span>
      <strong>${remainingDays}</strong>
      <small>${balance<0?'υπέρβαση':'ακόμη'}</small>
    </article>
  `;
}


function openBudgetLimitInfoSheet(){
  const income=Number(D.income)||0;
  const cycleAmount=typeof totalCycleAmount==='function'?totalCycleAmount():income;
  const reserved=typeof budgetLimitReservedAmount==='function'?budgetLimitReservedAmount():0;
  const spent=capvoMoney(fixedTotal()+ccPayTotal()+dailyCashTotal());
  const balance=capvoMoney(income-spent);

  let overlay=document.getElementById('budgetLimitInfoSheet');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='budgetLimitInfoSheet';
    overlay.className='budget-limit-sheet-overlay';
    overlay.innerHTML=`
      <div class="budget-limit-sheet" onclick="event.stopPropagation()">
        <div class="budget-limit-handle"></div>
        <div class="budget-limit-sheet-head">
          <div>
            <span>Budget εξόδων</span>
            <h3>Πώς λειτουργεί το όριο;</h3>
          </div>
          <button type="button" onclick="closeBudgetLimitInfoSheet()" aria-label="Κλείσιμο">×</button>
        </div>

        <div class="budget-limit-metrics">
          <div><span>Συνολικό ποσό μήνα</span><strong id="budgetLimitTotalAmount">—</strong></div>
          <div><span>Όριο για έξοδα</span><strong id="budgetLimitSpendingAmount">—</strong></div>
          <div><span>Υπόλοιπο τώρα</span><strong id="budgetLimitRemainingAmount">—</strong></div>
          <div><span>Εκτός budget</span><strong id="budgetLimitReservedAmount">—</strong></div>
        </div>

        <p>
          Το ποσό εκτός budget δεν μετράει στο ημερήσιο διαθέσιμο. Αν ξεπεράσεις το όριο,
          το CAPVO θα σε προειδοποιήσει αλλά δεν θα μπλοκάρει την καταχώρηση.
        </p>

        <button type="button" class="budget-limit-sheet-primary" onclick="closeBudgetLimitInfoSheet()">Το κατάλαβα</button>
      </div>
    `;
    overlay.addEventListener('click',closeBudgetLimitInfoSheet);
    document.body.appendChild(overlay);
  }

  const set=(id,value)=>{
    const el=document.getElementById(id);
    if(el)el.textContent=value;
  };

  set('budgetLimitTotalAmount',fmt(cycleAmount));
  set('budgetLimitSpendingAmount',fmt(income));
  set('budgetLimitRemainingAmount',fmt(balance));
  set('budgetLimitReservedAmount',fmt(reserved));

  document.body.classList.add('modal-open','budget-limit-sheet-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));
}

function closeBudgetLimitInfoSheet(){
  const overlay=document.getElementById('budgetLimitInfoSheet');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('budget-limit-sheet-open');
  setTimeout(()=>{
    if(!document.querySelector('.modal-overlay.active'))document.body.classList.remove('modal-open');
  },180);
}


function paymentSourceExists(id){
  if(!id)return true;

  return (D.incomeSources||[]).some(i=>i.id===id);
}

function eRow(e,t){
  const category=e.category||'Άλλο';
  const c=CCLS[category]||'cat-other';
  const em=CEMO[category]||'📌';
  const isSelected=t==='fixed'?selectedFixed.has(e.id):selectedDaily.has(e.id);
  const showSelect=selectionMode[t];
  const isNonBudgetDaily=t==='daily' && typeof expenseAffectsCashBudget==='function' && !expenseAffectsCashBudget(e);
  const isCreditCardDaily=isNonBudgetDaily && (e.isCreditCardPurchase || e.paymentAccountType==='credit_card' || e.creditCardId || e.installmentPlanId);
  const fixedStatus=t==='fixed' && typeof capvoFixedExpenseStatus==='function'?capvoFixedExpenseStatus(e):null;
  const fixedWallet=t==='fixed' && e.sourceWalletId ? capvoWalletById(e.sourceWalletId) : null;
  const fixedDueLabel=fixedStatus?.nextDueDate ? formatGreekFullDate(fixedStatus.nextDueDate) : '';
  const fixedPaid=!!fixedStatus && fixedStatus.state==='paid';
  const latestFixedPayment=t==='fixed' && typeof capvoLatestFixedExpensePaymentForCurrentCycle==='function'
    ? capvoLatestFixedExpensePaymentForCurrentCycle(e.id)
    : null;
  const fixedCanUndo=t==='fixed' && !!latestFixedPayment && !showSelect;
  const fixedCanPay=t==='fixed' && !fixedCanUndo && !fixedPaid && !showSelect && ['due','overdue'].includes(fixedStatus?.state);
  const rowDetailType=t==='daily' && (e.readOnly || e.isFixedExpensePayment || e.isCardPayment || e.isSavingsMovement) ? 'movement' : t;
  const isFixedPaymentDaily=t==='daily' && (e.isFixedExpensePayment || String(e.movementType||'')==='fixed_expense_payment');

  return `
    <div class="expense-item fadeIn ${isSelected?'selected-row':''} ${t==='fixed'?'scheduled-fixed-row':''}" onclick="${!showSelect?`showMobileTransactionDetail('${rowDetailType}','${e.id}')`:''}">
      ${showSelect?`
        <label class="select-box" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('${t}','${e.id}',this.checked)">
        </label>`:''}

      <div class="expense-icon ${c}">${em}</div>

      <div class="expense-info">
        <div class="expense-name">
          ${esc(e.name)}
          ${fixedStatus?`<span class="fixed-due-pill ${fixedStatus.tone}">${esc(fixedStatus.label)}</span>`:''}
        </div>
        <div class="expense-cat">
          ${esc(category)}
          ${t==='fixed'
            ? latestFixedPayment
              ? ` · Πληρώθηκε ${esc(formatGreekFullDate(latestFixedPayment.paidAt||latestFixedPayment.paidForDate||''))}${fixedWallet?` · ${esc(fixedWallet.name)}`:''}`
              : ` · ${fixedDueLabel?`Πληρωμή ${esc(fixedDueLabel)}`:'Προγραμματισμένο'}${fixedWallet?` · ${esc(fixedWallet.name)}`:''}`
            : ''
          }
          ${isFixedPaymentDaily
            ? ` <span class="payment-badge fixed-payment">🔁 ${esc(e.sourceLabel||'Πληρωμή παγίου')}</span>`
            : (t==='daily' && e.paymentSourceName && !e.isCardPayment && !e.isSavingsMovement
              ? ` <span class="payment-badge ${paymentSourceExists(e.paymentSourceId)?'':'deleted'} ${isCreditCardDaily?'credit-card':''}">
                    💳 ${esc(e.paymentSourceName)}${paymentSourceExists(e.paymentSourceId)?'':' (διαγραμμένο)'}
                  </span>`
              : '')
          }
          ${isNonBudgetDaily
            ? ` <span class="payment-badge no-budget">Δεν επηρεάζει budget</span>`
            : ''
          }
        </div>
      </div>

      <div class="expense-right ${t==='fixed'?'fixed-schedule-right':''}">
        <div class="expense-amount ${t==='fixed'?'is-fixed':'is-daily'} ${isNonBudgetDaily?'is-neutral':''}">${t==='fixed'?fmt(e.amount):'-'+fmt(e.amount)}</div>
        ${fixedCanUndo?`
          <button type="button" class="fixed-pay-btn undo" onclick="event.stopPropagation();capvoUndoFixedExpensePayment('${latestFixedPayment.id}')">
            Αναίρεση
          </button>`:fixedCanPay?`
          <button type="button" class="fixed-pay-btn" onclick="event.stopPropagation();capvoPayFixedExpense('${e.id}')">
            Πληρώθηκε
          </button>`:''}
      </div>
    </div>`;
}

const INCOME_COLORS={
  'Μισθός':'#10b981',
  'Bonus':'#3b82f6',
  'Ενοίκιο':'#8b5cf6',
  'Ticket Restaurant':'#f59e0b',
  'Άυλη κάρτα':'#ef4444',
  'Μερίσματα':'#14b8a6',
  'Freelance':'#6366f1',
  'Δώρο':'#ec4899',
  'Άλλο':'#64748b'
};

const INCOME_ICONS={
  'Bonus':'🎁',
  'Δώρο Πάσχα':'🐣',
  'Δώρο Χριστουγέννων':'🎄',
  'Δώρο αδείας':'🏖️',
  'Ενοίκιο':'🏠',
  'Μερίσματα':'📈',
  'Freelance':'🧑‍💻',
  'Δεύτερη δουλειά':'💼',
  'Επιστροφή χρημάτων':'↩️',
  'Πώληση αντικειμένου':'🏷️',
  'Οικονομική βοήθεια':'🤝',
  'Ticket Restaurant':'🍽️',
  'Άυλη κάρτα':'💳',
  'Άλλο':'💰'
};

function renderIncomePage(){
  const sources=(D.incomeSources||[]).filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true);

  const total=incomeSourcesTotal();
  const budget=budgetIncomeTotal();
  const savings=savingsIncomeTotal();
  const restricted=restrictedIncomeTotal();
  const restrictedCovered=totalRestrictedCoverage();
  const restrictedRemaining=Math.max(0,restricted-restrictedCovered);

  $('incomeTotalBox').textContent=fmt(total);
  $('incomeBudgetBox').textContent=fmt(budget);
  $('incomeSavingsBox').textContent=fmt(savings);
  $('incomeRestrictedBox').textContent= fmt(restrictedRemaining)+' / '+fmt(restricted);
  $('incomeCount').textContent=sources.length+' έξτρα εγγραφές';

  renderIncomeDonut();
  renderIncomeList();
}

function renderIncomeDonut(){
  const sources=(D.incomeSources||[]).filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true);
  const byCat={};

  sources.forEach(i=>{
    byCat[i.category]=(byCat[i.category]||0)+(Number(i.amount)||0);
  });

  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const total=sorted.reduce((s,[_,v])=>s+v,0);

  if(sorted.length===0||total<=0){
    $('incomeDonut').style.background='#eef2f7';
    $('incomeDonutTotal').textContent=fmt(0);
    $('incomeLegend').innerHTML='<p style="text-align:center;color:var(--text3);padding:20px">Δεν υπάρχουν έσοδα</p>';
    return;
  }

  let start=0;

  const parts=sorted.map(([cat,value])=>{
    const pct=value/total*100;
    const end=start+pct;
    const color=INCOME_COLORS[cat]||'#64748b';
    const part=`${color} ${start}% ${end}%`;
    start=end;
    return part;
  });

  $('incomeDonut').style.background=`conic-gradient(${parts.join(',')})`;
  $('incomeDonutTotal').textContent=fmt(total);

  $('incomeLegend').innerHTML=sorted.map(([cat,value])=>{
    const pct=Math.round(value/total*100);
    const color=INCOME_COLORS[cat]||'#64748b';

    return`
      <div class="donut-legend-row">
        <div class="donut-legend-left">
          <span class="donut-dot" style="background:${color}"></span>
          <span>${esc(cat)}</span>
        </div>

        <div class="donut-legend-right">
          <strong>${fmt(value)}</strong>
          <small>${pct}%</small>
        </div>
      </div>`;
  }).join('');
}

function renderIncomeList(){
  const sources=(D.incomeSources||[]).filter(i=>typeof capvoIsExtraIncomeSource==='function'?capvoIsExtraIncomeSource(i):true);

  if(sources.length===0){
    $('incomeList').innerHTML=`
      <div class="empty">
        Δεν έχεις προσθέσει ακόμα πηγές εισοδήματος.
      </div>`;
    return;
  }

  $('incomeList').innerHTML=sources.map(i=>{
    const icon=INCOME_ICONS[i.category]||'💰';

    return`
      <div class="income-source-item">
        <div class="income-source-icon">${icon}</div>

        <div class="income-source-info">
          <div class="income-source-name">${esc(i.name)}</div>
          <div class="income-source-meta">${esc(i.category)} · ${esc(i.incomeType)} · ${i.isRecurring?'Επαναλαμβανόμενο':'One-time'}${i.destinationWalletId?' · προς '+esc(capvoWalletById(i.destinationWalletId)?.name||'wallet'):''}</div>

          <div class="income-badges">
            ${i.destinationWalletId
              ? `<span class="income-badge budget">Προορισμός: ${esc(capvoWalletById(i.destinationWalletId)?.name||'Wallet')}</span>`
              : ''
            }
            ${i.walletDepositApplied?'<span class="income-badge budget">Περάστηκε στο wallet</span>':''}
            ${i.restriction&&i.restriction!=='none'
              ?`<span class="income-badge restricted">
                  Διαθέσιμο ${fmt(paymentSourceRemaining(i))} / ${fmt(i.amount)}
                </span>`
              :''
            }
          </div>
        </div>

        <div class="income-source-amount">
          ${fmt(typeof incomeBudgetAmount==='function'?incomeBudgetAmount(i):i.amount)}
          ${Number(i.spendingLimit)>0 && Number(i.spendingLimit)<Number(i.amount)
            ? `<small>από ${fmt(i.amount)}</small>`
            : ''
          }
        </div>

        <div class="expense-actions" onclick="event.stopPropagation()">
          <button class="edit-btn" onclick="editIncomeSource('${i.id}')">✎</button>
          <button class="del-btn" onclick="deleteIncomeSource('${i.id}')">×</button>
        </div>
      </div>`;
  }).join('');
}

function editIncomeSource(id){
  const i=(D.incomeSources||[]).find(x=>x.id===id);
  if(!i)return;

  closeM();

  $('mIncomeSource').classList.add('active');
  $('mIncomeSourceTitle').textContent='Επεξεργασία πηγής';
  const mode=inferIncomePresetFromSource(i);
  setIncomeWizardMode(mode,{keepAdvanced:true});
  if($('incomeModalKicker'))$('incomeModalKicker').textContent='Επεξεργασία πηγής';
  if($('incomeModalIntro'))$('incomeModalIntro').textContent='Ενημέρωσε το ποσό και τις ρυθμίσεις της πηγής.';

  $('fISName').value=i.name;
  $('fISAmount').value=i.amount;
  if($('fISSpendingLimit'))$('fISSpendingLimit').value=Number(i.spendingLimit)>0?i.spendingLimit:'';
  $('fISCategory').value=i.category;
  $('fISType').value=i.incomeType;
  $('fISRestriction').value=i.restriction;
  $('fISRestrictedCategory').value=i.restrictedCategory||'';
  $('fISIncludeBudget').checked=!!i.includeInBudget;
  $('fISSavings').checked=!!i.isSavings;
  $('fISRecurring').checked=!!i.isRecurring;
  if($('fISPrimary'))$('fISPrimary').checked=!!i.isPrimaryIncome;
  if($('fISDestinationWallet'))fillIncomeDestinationWalletSelect(i.destinationWalletId||'');
  $('fISNotes').value=i.notes||'';
  $('fISID').value=id;

  $('btnIncomeSource').textContent='Ενημέρωση πηγής';
  if(typeof clearIncomeValidation==='function')clearIncomeValidation();
  document.querySelectorAll('#incomeQuickPresets button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.incomePreset===mode);
  });
  document.body.classList.add('modal-open');
  refreshIncomeCustomPickers();
}


function capvoDailyExpenseIsSavingsWallet(wallet){
  if(!wallet)return false;
  const role=typeof capvoWalletBudgetRole==='function'?String(capvoWalletBudgetRole(wallet)||''):String(wallet.budgetRole||wallet.budget_role||'');
  return !!(wallet.isSavings || wallet.is_savings || String(wallet.type||'')==='savings' || role==='savings');
}

function capvoDailyExpenseEligibleWallets(){
  const wallets=typeof capvoActiveWallets==='function'
    ? capvoActiveWallets()
    : (Array.isArray(D.wallets)?D.wallets.filter(w=>w&&w.isActive!==false&&w.is_active!==false):[]);
  // User-facing rule for expenses: every active wallet can pay except savings wallets.
  return wallets.filter(w=>w && w.isActive!==false && w.is_active!==false && !capvoDailyExpenseIsSavingsWallet(w));
}

function capvoIsWalletPaymentSource(source){
  return !!(source && (source.sourceKind==='wallet' || source.type==='wallet' || source.accountType==='wallet' || (source.id && typeof capvoWalletById==='function' && capvoWalletById(source.id))));
}

function availablePaymentSources(){
  const wallets=(typeof capvoDailyExpenseEligibleWallets==='function'?capvoDailyExpenseEligibleWallets():[])
    .map(w=>({
      ...w,
      id:w.id,
      name:w.name,
      type:'wallet',
      sourceKind:'wallet',
      accountType:'wallet',
      incomeType:'wallet',
      currentBalance:Number(w.currentBalance ?? w.current_balance)||0,
      icon:w.icon||'🏦'
    }));

  const benefits=(D.incomeSources||[])
    .filter(i=>(typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(i):(i.restriction && i.restriction!=='none')))
    .map(i=>({
      ...i,
      id:i.id,
      name:i.name,
      type:i.incomeType||'voucher',
      sourceKind:'benefit',
      incomeType:i.incomeType||'voucher'
    }));

  const cards=(D.creditCards||[])
    .filter(c=>c.isActive!==false)
    .map(c=>({
      ...c,
      id:c.id,
      name:c.name,
      type:'credit_card',
      sourceKind:'credit_card',
      incomeType:'card',
      accountType:c.accountType||'credit_card',
      balance:Number(c.balance)||0
    }));

  return wallets.concat(benefits, cards);
}

function paymentSourceById(id){
  if(!id)return null;
  const key=String(id);
  const wallet=typeof capvoWalletById==='function'?capvoWalletById(key):null;
  if(wallet)return {
    ...wallet,
    id:wallet.id,
    name:wallet.name,
    type:'wallet',
    sourceKind:'wallet',
    accountType:'wallet',
    incomeType:'wallet',
    currentBalance:Number(wallet.currentBalance ?? wallet.current_balance)||0,
    icon:wallet.icon||'🏦'
  };
  return (D.incomeSources||[]).find(i=>String(i.id)===key)
    || (D.creditCards||[]).find(c=>String(c.id)===key)
    || null;
}

function fillPaymentSourceSelect(selectedId='',opts={}){
  const el=$('fDPay');
  if(!el)return;

  const sources=availablePaymentSources();
  const selectedSource=sources.find(s=>String(s.id)===String(selectedId));

  if(opts.lockCard && selectedSource){
    el.innerHTML=`<option value="${esc(selectedSource.id)}" selected>${selectedSource.type==='credit_card'?'💳 ':''}${esc(selectedSource.name)}</option>`;
    el.value=selectedSource.id;
    el.disabled=true;
    return;
  }

  el.disabled=false;
  const hasWalletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  const defaultWalletId=hasWalletModel && !selectedId && !opts.preserveBlank ? (typeof capvoDefaultWallet==='function'?capvoDefaultWallet()?.id:'') : '';
  const effectiveSelected=selectedId || defaultWalletId || '';
  const optionRows=sources.map(s=>{
    const isWallet=typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(s);
    const isCard=s.type==='credit_card' || s.accountType==='credit_card';
    const balance=isWallet ? ` · ${fmt(Number(s.currentBalance)||0)}` : '';
    const icon=isCard?'💳 ':(isWallet?`${esc(s.icon||'🏦')} `:'🎫 ');
    return `
      <option value="${esc(s.id)}" ${String(s.id)===String(effectiveSelected)?'selected':''}>
        ${icon}${esc(s.name)}${balance}
      </option>`;
  }).join('');
  el.innerHTML=`
    ${hasWalletModel?'':`<option value="" ${!effectiveSelected?'selected':''}>Κανονικό budget</option>`}
    ${optionRows}
  `;
  if(effectiveSelected)el.value=effectiveSelected;
}



function fillIncomeDestinationWalletSelect(selectedId=''){
  const el=$('fISDestinationWallet');
  if(!el)return;

  const wallets=typeof capvoActiveWallets==='function'?capvoActiveWallets():[];
  const options=wallets.map(w=>{
    const role=typeof capvoWalletCountsInBudget==='function' && capvoWalletCountsInBudget(w) ? 'budget' : 'εκτός budget';
    return `<option value="${esc(w.id)}" ${String(w.id)===String(selectedId||'')?'selected':''}>${esc(w.icon||'🏦')} ${esc(w.name)} · ${role}</option>`;
  }).join('');

  el.innerHTML=`<option value="">Επίλεξε προορισμό...</option>${options}`;
  if(selectedId)el.value=selectedId;
}

function incomeDestinationWallet(){
  const id=$('fISDestinationWallet')?.value||'';
  return id?capvoWalletById(id):null;
}

// ===== END 03b-transactions.js =====
