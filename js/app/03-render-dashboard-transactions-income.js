// CAPVO app split: 03-render-dashboard-transactions-income.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.


function capvoDashboardFirstName(){
  try{
    const meta=currentUser?.user_metadata||{};
    const raw=(currentProfile?.full_name||meta.full_name||meta.name||currentUser?.email||'').trim();
    if(!raw)return 'σου';
    if(/andreas|adimitriou/i.test(raw))return 'Ανδρέα';
    const clean=raw.includes('@')?raw.split('@')[0]:raw;
    const first=clean.split(/[\s._-]+/).filter(Boolean)[0]||'σου';
    return first.charAt(0).toUpperCase()+first.slice(1);
  }catch(e){
    return 'σου';
  }
}

function renderDashboardGreeting(){
  const title=$('capvoGreetingTitle');
  const sub=$('capvoGreetingSub');
  if(!title&&!sub)return;
  const name=capvoDashboardFirstName();
  if(title)title.textContent=name==='σου'?'Γεια σου 👋':`Γεια σου, ${name} 👋`;
  if(sub){
    const cycle=getCurrentBudgetCycle();
    sub.textContent=`Ο κύκλος ${cycle.label} είναι ενημερωμένος.`;
  }
}

// ===== MAIN RENDER =====
function render(){
  refreshComputedIncome();

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const dlS=dailyTotal();
  const cashDaily=dailyCashTotal();
  
  const tot=capvoMoney(fxS+ccS+cashDaily);
  const bal=capvoMoney(D.income-tot);

  const pct=D.income>0?Math.min(100,Math.round(tot/D.income*100)):0;
  const cycle=getCurrentBudgetCycle();

  $('mLabel').textContent=cycle.label;
  const eyebrow=document.querySelector('.modern-hero-card .eyebrow');
  if(eyebrow)eyebrow.textContent='Υπόλοιπο κύκλου';
  const heroCaption=document.querySelector('.modern-hero-caption');
  if(heroCaption)heroCaption.textContent=`Τρέχων οικονομικός κύκλος: ${cycle.label}.`;
  renderDashboardGreeting();
  $('dIncome').textContent=fmt(D.income);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  $('dSpent').textContent=fmt(tot)+' / '+fmt(D.income);
  renderDashboardAllowanceCards(bal);
  renderFirstUseBudgetPrompt();

  $('sFixed').textContent=fmt(fxS);
  $('sCC').textContent=fmt(ccS);
  $('sDaily').textContent=fmt(cashDaily);
  renderDashboardAdvisorSnapshot(pct,bal);

  renderFixedList();
  renderDailyList();
  renderDashboardPreview();
  renderMobileCategoryInsights();
  if(typeof renderQuickRepeatChips==='function') renderQuickRepeatChips();
  if($('incomeList')) renderIncomePage();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof renderSavingsPage==='function') renderSavingsPage();
  if(typeof rAdv==='function') rAdv();

  renderPaymentSourcesSummary();
  renderSettingsPage();
}



function renderDashboardAdvisorSnapshot(pct,bal){
  const valueEl=$('sAdvisor');
  const iconEl=$('sAdvisorIcon');
  if(!valueEl)return;

  let label='OK';
  let tone='teal';
  let icon='✅';

  if(D.income<=0){
    label='Setup';
    tone='amber';
    icon='💡';
  }else if(bal<0 || pct>100){
    label='Υπέρβαση';
    tone='red';
    icon='🚨';
  }else if(pct>=70){
    label='Προσοχή';
    tone='amber';
    icon='⚠️';
  }

  valueEl.textContent=label;
  valueEl.className='stat-value '+tone;
  if(iconEl)iconEl.textContent=icon;
}

function renderFixedList(){
  const fixedItems=(D.fixedExpenses||[])
    .slice()
    .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a))
    .map(e=>({kind:'fixed',data:e}));

  const count=fixedItems.length;
  const countEl=$('cFixed');
  const listEl=$('lFixed');
  if(!countEl || !listEl)return;

  countEl.innerHTML=`
    ${count} εγγραφές
    <button class="mini-action" onclick="toggleSelectMode('fixed')">${selectionMode.fixed?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.fixed?`
      <button class="mini-action" onclick="selectAllVisible('fixed')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('fixed')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('fixed')">Διαγραφή</button>
    `:''}
  `;

  if(count===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty tx-v25-fixed-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
        </svg>
        Δεν έχεις πάγια έξοδα ακόμα. Πρόσθεσε νέο πάγιο.
      </div>`;
    return;
  }

  const isMobile=window.innerWidth<=768;
  const visibleLimit=isMobile && !txMobileFixedExpanded ? 5 : fixedItems.length;
  const visibleItems=fixedItems.slice(0,visibleLimit);

  let html='';

  visibleItems.forEach(item=>{
    html+=eRow(item.data,'fixed');
  });

  if(isMobile && fixedItems.length>5){
    html+=`
      <button type="button" class="tx-v25-more-btn tx-v25-fixed-more" onclick="toggleTxMobileFixedExpanded()">
        ${txMobileFixedExpanded?'Λιγότερα':'Προβολή όλων των πάγιων'}
        <span>${txMobileFixedExpanded?'⌃':'⌄'}</span>
      </button>`;
  }

  listEl.innerHTML=html;
}

function toggleTxMobileFixedExpanded(){
  txMobileFixedExpanded=!txMobileFixedExpanded;
  renderFixedList();
}

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

  if(filter==='budget')return !!(e.affectsBudget ?? e.affectsCashBudget ?? e.affects_cash_budget);
  if(filter==='cards')return String(e.movementGroup||'')==='cards' || String(e.paymentAccountType||e.payment_account_type||'').includes('credit_card') || !!(e.isCardPayment||e.isCreditCardPurchase||e.creditCardId||e.installmentPlanId);
  if(filter==='savings')return String(e.movementGroup||'')==='savings' || !!e.isSavingsMovement;

  const dateStr=String(e.date||'');
  if(!dateStr) return true;

  const todayKey=typeof todayISO==='function'?todayISO():new Date().toISOString().slice(0,10);
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

  return [e.name,e.category,e.paymentSourceName,e.paymentAccountType,e.sourceLabel,e.movementType,e.date]
    .filter(Boolean)
    .some(v=>String(v).toLowerCase().includes(q));
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
  const m={daily:getCurrentCycleDailyExpenses()};

  $('cDaily').innerHTML=`
    ${m.daily.length} εγγραφές κύκλου
    <button class="mini-action" onclick="toggleSelectMode('daily')">${selectionMode.daily?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.daily?`
      <button class="mini-action" onclick="selectAllVisible('daily')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('daily')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('daily')">Διαγραφή</button>
    `:''}
  `;

  if(m.daily.length===0){
    $('lDaily').innerHTML=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Κανένα ημερήσιο έξοδο ακόμα
      </div>`;
    return;
  }

  const grouped={};

  [...m.daily]
    .filter(e=>mobileTransactionMatchesSearch(e) && mobileTransactionMatchesFilter(e))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')))
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
    const dayTotal=grouped[dt].reduce((s,e)=>s+e.amount,0);

    html+=`
      <div class="day-header">
        <span>${DG[d.getDay()]}, ${d.getDate()} ${MG[d.getMonth()]}</span>
        <span class="day-total">${fmt(dayTotal)}</span>
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
    totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
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

  const sourceRows = typeof getCurrentCycleBudgetMovements==='function'
    ? getCurrentCycleBudgetMovements()
    : getCurrentCycleDailyExpenses();
  const recent = [...sourceRows]
    .sort((a,b)=>
      String(b.date || '').localeCompare(String(a.date || '')) ||
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
    const amount=Number(e.amount)||0;
    const isReturn=amount<0;
    const amountLabel=isReturn?`+${fmt(Math.abs(amount))}`:`-${fmt(amount)}`;
    const meta=[
      esc(e.category),
      e.date||'',
      e.isCardPayment?'Πληρωμή κάρτας':'',
      e.isSavingsMovement?(isReturn?'επιστροφή από κουμπαρά':'μεταφορά σε κουμπαρά'):''
    ].filter(Boolean).join(' · ');

    return `
    <div class="dashboard-preview-row">
      <div class="expense-icon ${CCLS[e.category] || 'cat-other'}">
        ${CEMO[e.category] || '📌'}
      </div>

      <div class="dashboard-preview-info">
        <strong>${esc(e.name)}</strong>
        <span>${meta}</span>
      </div>

      <div class="dashboard-preview-amount ${e.isCardPayment?'is-payment':''} ${isReturn?'is-return':''}">
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
      <button type="button" class="dashboard-budget-start-primary" onclick="go('vIncome',document.querySelector('[data-v=vIncome]'));setTimeout(()=>openModal('incomeSource'),120);">Προσθήκη budget</button>
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
          <div><span>Συνολικό ποσό κύκλου</span><strong id="budgetLimitTotalAmount">—</strong></div>
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

  return `
    <div class="expense-item fadeIn ${isSelected?'selected-row':''}" onclick="${!showSelect?`showMobileTransactionDetail('${t}','${e.id}')`:''}">
      ${showSelect?`
        <label class="select-box" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('${t}','${e.id}',this.checked)">
        </label>`:''}

      <div class="expense-icon ${c}">${em}</div>

      <div class="expense-info">
        <div class="expense-name">${esc(e.name)}</div>
        <div class="expense-cat">
          ${esc(category)}
          ${t==='fixed' && fixedExpenseCreatedAt(e)
            ? ` · Καταχώρηση ${esc(formatShortDate(fixedExpenseCreatedAt(e)))}`
            : ''
          }
          ${t==='daily' && e.paymentSourceName
            ? ` <span class="payment-badge ${paymentSourceExists(e.paymentSourceId)?'':'deleted'} ${isCreditCardDaily?'credit-card':''}">
                  💳 ${esc(e.paymentSourceName)}${paymentSourceExists(e.paymentSourceId)?'':' (διαγραμμένο)'}
                </span>`
            : ''
          }
          ${isNonBudgetDaily
            ? ` <span class="payment-badge no-budget">Δεν επηρεάζει budget</span>`
            : ''
          }
        </div>
      </div>

      <div class="expense-amount ${t==='fixed'?'is-fixed':'is-daily'} ${isNonBudgetDaily?'is-neutral':''}">${t==='fixed'?fmt(e.amount):'-'+fmt(e.amount)}</div>
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
  'Μισθός':'💼',
  'Bonus':'🎁',
  'Ενοίκιο':'🏠',
  'Ticket Restaurant':'🍽️',
  'Άυλη κάρτα':'💳',
  'Μερίσματα':'📈',
  'Freelance':'🧑‍💻',
  'Δώρο':'🎉',
  'Άλλο':'💰'
};

function renderIncomePage(){
  const sources=D.incomeSources||[];

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
  $('incomeCount').textContent=sources.length+' εγγραφές';

  renderIncomeDonut();
  renderIncomeList();
}

function renderIncomeDonut(){
  const sources=D.incomeSources||[];
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
  const sources=D.incomeSources||[];

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
          <div class="income-source-meta">${esc(i.category)} · ${esc(i.incomeType)} · ${i.isRecurring?'Μηνιαίο':'One-time'}</div>

          <div class="income-badges">
            ${i.isPrimaryIncome?'<span class="income-badge budget">Βασικό budget</span>':''}
            ${Number(i.spendingLimit)>0 && Number(i.spendingLimit)<Number(i.amount)
              ? `<span class="income-badge budget">Όριο ${fmt(i.spendingLimit)}</span>`
              : ''
            }
            ${i.includeInBudget?'<span class="income-badge budget">Στο budget</span>':'<span class="income-badge savings">Εκτός budget</span>'}
            ${i.isSavings?'<span class="income-badge savings">Αποταμίευση</span>':''}
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


function availablePaymentSources(){
  const benefits=(D.incomeSources||[])
    .filter(i=>(typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(i):(i.restriction && i.restriction!=='none')))
    .map(i=>({
      id:i.id,
      name:i.name,
      type:i.incomeType||'voucher',
      incomeType:i.incomeType||'voucher'
    }));

  const cards=(D.creditCards||[])
    .filter(c=>c.isActive!==false)
    .map(c=>({
      id:c.id,
      name:c.name,
      type:'credit_card',
      incomeType:'card',
      accountType:c.accountType||'credit_card',
      balance:Number(c.balance)||0
    }));

  return benefits.concat(cards);
}

function paymentSourceById(id){
  if(!id)return null;
  return (D.incomeSources||[]).find(i=>String(i.id)===String(id))
    || (D.creditCards||[]).find(c=>String(c.id)===String(id))
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
  el.innerHTML=`
    <option value="">Κανονικό budget</option>
    ${sources.map(s=>`
      <option value="${s.id}" ${String(s.id)===String(selectedId)?'selected':''}>
        ${s.type==='credit_card'?'💳 ':''}${esc(s.name)}
      </option>
    `).join('')}
  `;
}


async function saveIncomeSourceRow(userId,item){
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();
  const legacyOwner=String((typeof getLegacyOwnerId==='function' ? getLegacyOwnerId() : '') || ownerUserId).trim();

  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const {error}=await supabaseClient
    .from('income_sources')
    .upsert({
      id:item.id,
      user_id:ownerUserId,
      user_chat_id:legacyOwner,
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
      is_primary_income:!!item.isPrimaryIncome,
      updated_at:new Date().toISOString()
    },{onConflict:'id'});

  if(error)throw error;
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
  ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>{
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
      kicker:'Budget κύκλου',
      title:'Budget κύκλου',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget κύκλου',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό κύκλου',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget κύκλου αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    budget:{
      icon:'💼',
      kicker:'Budget κύκλου',
      title:'Budget κύκλου',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget κύκλου',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό κύκλου',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget κύκλου αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    other:{
      icon:'🏠',
      kicker:'Άλλο εισόδημα',
      title:'Άλλο εισόδημα',
      intro:'Για χρήματα που λαμβάνεις πέρα από το βασικό budget σου.',
      summaryTitle:'Άλλο εισόδημα',
      summaryText:'Freelance, ενοίκιο που εισπράττεις, επίδομα, bonus ή δεύτερη δουλειά.',
      amountLabel:'Ποσό εισοδήματος',
      amountHint:'Μετράει στο διαθέσιμο budget, εκτός αν το βγάλεις από τις προχωρημένες ρυθμίσεις.',
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget κύκλου.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό. Αν πληρώνεις ενοίκιο, καταχώρησέ το στα Πάγια.',
      saveText:'Αποθήκευση εισοδήματος',
      successText:'✅ Το εισόδημα προστέθηκε',
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
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget κύκλου.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση ποσού',
      successText:'✅ Το έκτακτο ποσό προστέθηκε',
      showRestricted:false,
      advancedHint:'Budget / επανάληψη'
    }
  };
  return configs[type]||configs.salary;
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
      name:'Έκτακτο ποσό',
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
      sourceCategory:'one_time',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    }
  };

  const preset=presets[type]||presets.salary;
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

  refreshIncomeCustomPickers?.();

  // Do not auto-focus amount after preset; keep keyboard closed until user taps a field.
}

function validateIncomeSourceForm(){
  clearIncomeValidation();

  const name=$('fISName').value.trim();
  const rawAmount=$('fISAmount').value;
  const amount=parseIncomeAmountValue(rawAmount);
  const rawSpendingLimit=$('fISSpendingLimit')?.value||'';
  const spendingLimit=String(rawSpendingLimit||'').trim()===''?0:parseIncomeAmountValue(rawSpendingLimit);
  const mode=getCurrentIncomeWizardMode();

  if(!name){
    setIncomeModalFeedback('Συμπλήρωσε όνομα πηγής, π.χ. Μισθός / Budget.','error');
    showMiniToast('Συμπλήρωσε όνομα πηγής','error');
    markIncomeFieldError('fISName');
    return null;
  }

  if(String(rawAmount||'').trim()===''){
    setIncomeModalFeedback('Συμπλήρωσε ποσό για το budget / εισόδημα.','error');
    showMiniToast('Συμπλήρωσε ποσό','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  if(!Number.isFinite(amount)){
    setIncomeModalFeedback('Το ποσό δεν είναι έγκυρο. Γράψε π.χ. 1200 ή 1200,50.','error');
    showMiniToast('Το ποσό δεν είναι έγκυρο','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  if(amount<=0){
    setIncomeModalFeedback('Το ποσό πρέπει να είναι μεγαλύτερο από 0.','error');
    showMiniToast('Το ποσό πρέπει να είναι μεγαλύτερο από 0','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  if(String(rawSpendingLimit||'').trim()!=='' && !Number.isFinite(spendingLimit)){
    setIncomeModalFeedback('Το όριο δεν είναι έγκυρο. Γράψε π.χ. 900 ή άφησέ το κενό.','error');
    showMiniToast('Το όριο δεν είναι έγκυρο','error');
    markIncomeFieldError('fISSpendingLimit');
    return null;
  }

  if(spendingLimit<0){
    setIncomeModalFeedback('Το όριο δεν μπορεί να είναι αρνητικό.','error');
    showMiniToast('Το όριο δεν μπορεί να είναι αρνητικό','error');
    markIncomeFieldError('fISSpendingLimit');
    return null;
  }

  if(spendingLimit>0 && spendingLimit>amount){
    setIncomeModalFeedback('Το όριο εξόδων δεν μπορεί να είναι μεγαλύτερο από το ποσό κύκλου.','error');
    showMiniToast('Το όριο δεν μπορεί να ξεπερνά το ποσό','error');
    markIncomeFieldError('fISSpendingLimit');
    return null;
  }

  const incomeType=$('fISType').value;
  const restriction=$('fISRestriction').value;
  const includeInBudget=$('fISIncludeBudget').checked;
  const isSavings=$('fISSavings').checked;

  if((restriction==='locked' || restriction==='investment') && includeInBudget && !isSavings){
    setIncomeModalFeedback('Αν η πηγή είναι locked/επένδυση, βάλε την εκτός ελεύθερου budget ή ως αποταμίευση.','error');
    showMiniToast('Έλεγξε τον περιορισμό της πηγής','error');
    markIncomeFieldError('fISRestriction');
    return null;
  }

  const sourceType=mode==='salary'||mode==='budget'?'budget_cycle':mode==='benefit'||mode==='ticket'||mode==='voucher'?'benefit':mode==='extra'?'one_time':'income';
  const sourceCategory=sourceType==='budget_cycle'?'primary_budget':sourceType==='benefit'?($('fISCategory').value==='Ticket Restaurant'?'ticket':$('fISCategory').value==='Άυλη κάρτα'?'voucher':'benefit'):sourceType==='one_time'?'one_time':($('fISCategory').value==='Ενοίκιο'?'rent_income':$('fISCategory').value==='Freelance'?'freelance':'other_income');
  const isRestricted=sourceType==='benefit' || (restriction&&restriction!=='none');
  const restrictionType=sourceType==='benefit'?($('fISCategory').value==='Ticket Restaurant'?'ticket':$('fISCategory').value==='Άυλη κάρτα'?'voucher':'benefit'):null;
  const allocationTarget=sourceType==='benefit'?'restricted_balance':includeInBudget?'spending_budget':isSavings?'savings':'outside_budget';

  return {name,amount,spendingLimit:sourceType==='budget_cycle'?capvoMoney(spendingLimit):0,incomeType,restriction,includeInBudget:sourceType==='benefit'?false:includeInBudget,isSavings,isPrimaryIncome:sourceType==='budget_cycle'?!!$('fISPrimary')?.checked:false,sourceType,sourceCategory,restrictionType,isRestricted,allocationTarget};
}

async function saveIncomeSource(){
  const id=$('fISID').value;
  const validation=validateIncomeSourceForm();
  if(!validation)return;

  const userId=getDataOwnerId();
  const btn=$('btnIncomeSource');

  if(!userId){
    showMiniToast(
      '❌ Δεν υπάρχει ενεργή σύνδεση Google',
      'error'
    );
    return;
  }

  const obj={
    id:id||gid(),
    name:validation.name,
    amount:validation.amount,
    spendingLimit:validation.spendingLimit||0,
    category:$('fISCategory').value,
    incomeType:validation.incomeType,
    includeInBudget:validation.includeInBudget,
    isSavings:validation.isSavings,
    isRecurring:$('fISRecurring').checked,
    restriction:validation.restriction,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim(),
    isPrimaryIncome:!!validation.isPrimaryIncome,
    sourceType:validation.sourceType,
    sourceCategory:validation.sourceCategory,
    restrictionType:validation.restrictionType,
    isRestricted:validation.isRestricted,
    allocationTarget:validation.allocationTarget
  };

  try{
    if(obj.isPrimaryIncome){
      // Keep one primary budget source per user in local state; DB unique index enforces this too.
      (D.incomeSources||[]).forEach(src=>{ if(src.id!==obj.id)src.isPrimaryIncome=false; });
      await supabaseClient.from('income_sources').update({is_primary_income:false}).eq('user_id',userId).neq('id',obj.id);
    }

    if(btn){
      btn.disabled=true;
      btn.textContent=id?'Ενημέρωση...':'Αποθήκευση...';
    }

    await saveIncomeSourceRow(userId,obj);

    if(obj.includeInBudget && obj.isPrimaryIncome && typeof capvoUpsertUserPreferencePatch==='function'){
      // Manual primary budget completes the required setup path enough to remove setup prompts.
      await capvoUpsertUserPreferencePatch({
        onboarding_dismissed:true,
        onboarding_step:'budget_manual_done'
      });
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

    const cfg=getIncomePresetConfig(getCurrentIncomeWizardMode());
    showMiniToast(id?'✅ Η πηγή ενημερώθηκε':cfg.successText);

  }catch(e){
    console.error('saveIncomeSource failed:',e);
    setIncomeModalFeedback('Δεν μπόρεσα να αποθηκεύσω την πηγή. Δοκίμασε ξανά.','error');
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=id?'Ενημέρωση πηγής':getIncomePresetConfig(getCurrentIncomeWizardMode()).saveText;
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

  try{
    await deleteIncomeSourceRow(id);

    D.incomeSources=(D.incomeSources||[]).filter(i=>i.id!==id);

    refreshComputedIncome();
    render();

    showMiniToast('✅ Η πηγή εισοδήματος διαγράφηκε');

  }catch(e){
    console.error('deleteIncomeSource failed:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

// v1.0.11 — clear inline validation while user edits Add Income/Budget fields
(function setupIncomeSourceValidationCleanup(){
  function bind(){
    ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>{
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


/* ============================================================
   CAPVO v1.8.5.18 — Restore Savings / Koumparas functions
   Scope: restore missing button handlers and page rendering only.
   ============================================================ */

function activeSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>!g.isArchived && (g.status||'active')!=='archived');
}

function archivedSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>g.isArchived || (g.status||'').toLowerCase()==='archived');
}

function savingsGoalKind(goal){
  const t=(goal?.goalType||goal?.goal_type||'target').toLowerCase();
  return t==='general'?'general':'target';
}

function savingsGoalStatus(goal){
  return (goal?.status||'active').toLowerCase();
}

function generalSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='general');
}
function getDefaultGeneralSavingsGoal(){
  const goals=generalSavingsGoals();
  if(!goals.length)return null;
  return goals.find(g=>g.isDefault) ||
    goals.find(g=>String(g.name||'').toLowerCase().includes('γενική')) ||
    goals[0];
}

function mapSavingsGoalRow(row){
  if(!row)return null;
  return {
    id:row.id,
    userId:row.user_id,
    name:row.name||'Γενική αποταμίευση',
    icon:row.icon||'💰',
    targetAmount:Number(row.target_amount)||0,
    currentAmount:Number(row.current_amount)||0,
    targetDate:row.target_date||'',
    goalType:row.goal_type||'general',
    isDefault:!!row.is_default,
    isArchived:!!row.is_archived,
    notes:row.notes||'',
    status:row.status||'active',
    completedAt:row.completed_at||'',
    createdAt:row.created_at||'',
    updatedAt:row.updated_at||''
  };
}

async function ensureDefaultGeneralSavingsGoal(){
  const ownerUserId=getFinanceUserId?.();
  if(!ownerUserId || typeof supabaseClient==='undefined')return getDefaultGeneralSavingsGoal();

  const existing=getDefaultGeneralSavingsGoal();
  if(existing){
    if(!existing.isDefault || savingsGoalKind(existing)!=='general' || existing.isArchived || savingsGoalStatus(existing)!=='active'){
      try{
        await supabaseClient.from('savings_goals').update({
          goal_type:'general',
          is_default:true,
          is_archived:false,
          status:'active',
          target_amount:0,
          target_date:null,
          updated_at:new Date().toISOString()
        }).eq('user_id',ownerUserId).eq('id',existing.id);
        existing.goalType='general';
        existing.isDefault=true;
        existing.isArchived=false;
        existing.status='active';
        existing.targetAmount=0;
        existing.targetDate='';
      }catch(e){
        console.warn('[CAPVO] default general savings normalize skipped',e?.message||e);
      }
    }
    return existing;
  }

  const payload={
    id:crypto.randomUUID(),
    user_id:ownerUserId,
    name:'Γενική αποταμίευση',
    icon:'💰',
    target_amount:0,
    current_amount:0,
    target_date:null,
    goal_type:'general',
    is_default:true,
    is_archived:false,
    notes:'Αυτόματος βασικός κουμπαράς CAPVO',
    status:'active',
    updated_at:new Date().toISOString()
  };

  const {data,error}=await supabaseClient
    .from('savings_goals')
    .insert(payload)
    .select('*')
    .single();
  if(error)throw error;

  const mapped=mapSavingsGoalRow(data||payload);
  D.savingsGoals=[mapped,...(D.savingsGoals||[]).filter(g=>g.id!==mapped.id)];
  return mapped;
}


function targetSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='target');
}

function savingsGoalsTotal(){
  return activeSavingsGoals().reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
}

function savingsCycleStats(){
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=cycle?.startKey||'';
  const endKey=cycle?.endKey||'';
  let deposits=0;
  let withdrawals=0;

  (D.savingsTransactions||[]).forEach(t=>{
    const day=(t.createdAt||'').slice(0,10);
    if(day && ((startKey && day<startKey) || (endKey && day>endKey)))return;

    const type=String(t.type||'').toLowerCase();
    const source=String(t.source||'').toLowerCase();
    if(type==='transfer_in' || type==='transfer_out' || source.includes('transfer'))return;

    const amount=Number(t.amount)||0;
    if(type==='withdrawal' || amount<0)withdrawals+=Math.abs(amount);
    else if(type==='deposit' || amount>0)deposits+=Math.abs(amount);
  });

  return {deposits,withdrawals,net:deposits-withdrawals};
}

function ensureSavingsSheet(){
  let overlay=$('savingsSheetOverlay');
  if(overlay)return overlay;

  overlay=document.createElement('div');
  overlay.id='savingsSheetOverlay';
  overlay.className='savings-sheet-overlay';
  overlay.onclick=e=>{
    if(e.target===overlay)closeSavingsSheet();
  };
  document.body.appendChild(overlay);
  return overlay;
}

function closeSavingsSheet(){
  const overlay=$('savingsSheetOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open');
}

function renderSavingsSummaryCards(goals,total,stats){
  return `
    <article class="savings-summary-card savings-summary-hero-card bento-card primary">
      <span>Στην άκρη</span>
      <strong>${fmt(total)}</strong>
      <small>${goals.length} ενεργοί κουμπαράδες</small>
    </article>
    <article class="savings-summary-card bento-card ${stats.net<0?'warning':''}">
      <span>Αυτόν τον κύκλο</span>
      <strong>${stats.net<0?'-':''}${fmt(Math.abs(stats.net))}</strong>
      <small>+${fmt(stats.deposits)} μέσα · -${fmt(stats.withdrawals)} έξω</small>
    </article>
  `;
}

function renderSavingsProgress(goal){
  const current=Number(goal.currentAmount)||0;
  const target=Number(goal.targetAmount)||0;
  return target>0?Math.min(100,Math.round(current/target*100)):0;
}

function renderGeneralSavingsSection(goals){
  const general=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||goals[0];

  if(!general){
    return `<section class="savings-production-section bento-card savings-general-empty savings-wallet-section">
      <div class="savings-section-head with-action">
        <div>
          <small>Αποταμίευση</small>
          <h3>Γενική αποταμίευση</h3>
          <p>Χρήματα που κρατάς εκτός budget χωρίς συγκεκριμένο στόχο.</p>
        </div>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'general')">Δημιουργία</button>
      </div>
    </section>`;
  }

  return `<section class="savings-production-section bento-card savings-wallet-section">
    <div class="savings-section-head">
      <div>
        <small>Αποταμίευση</small>
        <h3>Γενική αποταμίευση</h3>
        <p>Λεφτά που έχεις βγάλει από το διαθέσιμο budget.</p>
      </div>
    </div>
    <article class="savings-wallet-card">
      <div class="savings-wallet-icon">${esc(general.icon||'💰')}</div>
      <div class="savings-wallet-main">
        <strong>${esc(general.name||'Γενική αποταμίευση')}</strong>
        <small>${esc(general.notes||'Χωρίς συγκεκριμένο στόχο')}</small>
        <em>${fmt(general.currentAmount||0)}</em>
      </div>
      <button type="button" onclick="openSavingsDepositSheet('${esc(general.id)}','deposit')">+ Ποσό</button>
      <button type="button" onclick="openSavingsDepositSheet('${esc(general.id)}','withdrawal')">Αφαίρεση</button>
    </article>
  </section>`;
}

function renderSavingsGoalCompactCard(g){
  const current=Number(g.currentAmount)||0;
  const target=Number(g.targetAmount)||0;
  const completed=savingsGoalStatus(g)==='completed';
  const progress=renderSavingsProgress(g);
  const remaining=Math.max(0,target-current);
  const targetMeta=g.targetDate?`Στόχος: ${formatGreekFullDate(g.targetDate)}`:'Χωρίς ημερομηνία στόχου';

  return `<button type="button" class="savings-target-row ${completed?'is-completed':''}" onclick="openSavingsGoalDetailsSheet('${esc(g.id)}')">
    <span class="savings-goal-icon">${esc(g.icon||'🎯')}</span>
    <span class="savings-target-copy">
      <strong>${esc(g.name||'Στόχος')}</strong>
      <small>${completed?'Ολοκληρώθηκε':esc(targetMeta)}</small>
      <i><b style="width:${progress}%"></b></i>
      <em>${target>0?fmt(current)+' / '+fmt(target)+' · μένουν '+fmt(remaining):fmt(current)+' αποταμιευμένα'}</em>
    </span>
    <span class="savings-target-arrow">›</span>
  </button>`;
}

function renderTargetSavingsSection(goals){
  if(goals.length===0){
    return `<section class="savings-production-section bento-card savings-empty compact savings-targets-section">
      <div class="savings-empty-icon">🎯</div>
      <h3>Βάλε τον πρώτο σου στόχο</h3>
      <p>Φτιάξε στόχο για αγορά, ταξίδι ή κάτι συγκεκριμένο και παρακολούθησε την πρόοδό του.</p>
      <button type="button" class="section-add primary-add" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  }

  return `<section class="savings-production-section bento-card savings-targets-section">
    <div class="savings-section-head with-action">
      <div>
        <small>Στόχοι</small>
        <h3>Στόχοι αποταμίευσης</h3>
        <p>Αγορές, ταξίδια και ποσά που θέλεις να πετύχεις.</p>
      </div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Στόχος</button>
    </div>
    <div class="savings-compact-list">
      ${goals.map(g=>renderSavingsGoalCompactCard(g)).join('')}
    </div>
  </section>`;
}

function renderArchivedSavingsSection(goals){
  if(!goals.length)return '';
  return `<section class="savings-production-section bento-card savings-archived-section">
    <details>
      <summary><span>Αρχειοθετημένα</span><em>${goals.length}</em></summary>
      <div class="savings-archived-list">
        ${goals.map(g=>`<article>
          <span>${esc(g.icon||'🏦')}</span>
          <strong>${esc(g.name||'Κουμπαράς')}</strong>
          <small>${fmt(g.currentAmount||0)}</small>
          <button type="button" onclick="restoreSavingsGoal('${esc(g.id)}')">Επαναφορά</button>
        </article>`).join('')}
      </div>
    </details>
  </section>`;
}

function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;

  const active=activeSavingsGoals();
  const general=generalSavingsGoals();
  const targets=targetSavingsGoals();
  const archived=archivedSavingsGoals();
  const total=savingsGoalsTotal();
  const stats=savingsCycleStats();

  summary.innerHTML=renderSavingsSummaryCards(active,total,stats);
  list.innerHTML=`
    ${renderGeneralSavingsSection(general)}
    ${renderTargetSavingsSection(targets)}
    ${renderArchivedSavingsSection(archived)}
  `;
}

function openGeneralSavingsFlow(){
  const general=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||generalSavingsGoals()[0];
  if(general){
    openSavingsDepositSheet(general.id,'deposit');
    return;
  }
  openSavingsGoalSheet('', 'general');
}

function openSavingsGoalSheet(goalId='',kind='target'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const goalKind=goal.id?savingsGoalKind(goal):kind;
  const isGeneral=goalKind==='general';
  const existingGeneral=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||generalSavingsGoals()[0];

  if(isGeneral && !goal.id && existingGeneral){
    showMiniToast('Υπάρχει ήδη γενική αποταμίευση. Πρόσθεσε ποσό εκεί.','info');
    openSavingsDepositSheet(existingGeneral.id,'deposit');
    return;
  }

  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${isGeneral?'💰':'🎯'}</span>
        <div>
          <small>${isGeneral?'Αποταμίευση':'Στόχος'}</small>
          <h2>${goal.id?'Επεξεργασία':'Νέος '+(isGeneral?'κουμπαράς':'στόχος')}</h2>
          <p>${isGeneral?'Μία γενική αποταμίευση, χωρίς ποσό στόχο.':'Δώσε ποσό στόχο και προαιρετικά ημερομηνία.'}</p>
        </div>
      </div>

      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <input type="hidden" id="savingsGoalKind" value="${esc(goalKind)}">

      <div class="savings-form-stack">
        <label class="full">Όνομα
          <input id="savingsGoalName" type="text" value="${esc(goal.name||'')}" placeholder="${isGeneral?'π.χ. Γενική αποταμίευση':'π.χ. Ταξίδι'}">
        </label>
        <div class="savings-inline-grid ${isGeneral?'is-general-only':''}">
          <label class="savings-icon-field">Εικονίδιο
            <input id="savingsGoalIcon" type="text" value="${esc(goal.icon||(isGeneral?'💰':'🎯'))}" maxlength="4" inputmode="text">
          </label>
          ${isGeneral?'':`<label>Ποσό στόχος
            <input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00">
          </label>`}
        </div>
        ${isGeneral?'':`<label class="full">Ημερομηνία στόχου
          <input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}">
        </label>`}
        <label class="full">Σημείωση
          <textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea>
        </label>
      </div>

      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση</button>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const existingId=$('savingsGoalId')?.value||'';
  const existing=(D.savingsGoals||[]).find(g=>g.id===existingId)||{};
  const kind=$('savingsGoalKind')?.value||'target';
  const isGeneral=kind==='general';
  const existingDefaultGeneral=isGeneral && !existingId && typeof getDefaultGeneralSavingsGoal==='function' ? getDefaultGeneralSavingsGoal() : null;
  const id=existingId || existingDefaultGeneral?.id || crypto.randomUUID();
  const name=($('savingsGoalName')?.value||'').trim();

  if(!name){showMiniToast('Βάλε όνομα.','error');return;}

  const target=isGeneral?0:(Number($('savingsGoalTarget')?.value)||0);
  if(!isGeneral && target<=0){showMiniToast('Για στόχο χρειάζεται ποσό στόχος.','error');return;}

  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||(isGeneral?'💰':'🎯')).trim()||(isGeneral?'💰':'🎯'),
    target_amount:target,
    current_amount:Number((existingDefaultGeneral||existing).currentAmount)||0,
    target_date:isGeneral?null:($('savingsGoalDate')?.value||null),
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:isGeneral?'general':'target',
    is_default:isGeneral,
    is_archived:false,
    status:existing.status||'active',
    updated_at:new Date().toISOString()
  };

  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
    if(error)throw error;
    closeSavingsSheet();
    await fetchAllData(ownerUserId);
    render();
    showMiniToast('✅ Αποθηκεύτηκε');
  }catch(error){
    console.error('saveSavingsGoal failed',error);
    showMiniToast('Δεν αποθηκεύτηκε ο κουμπαράς.','error');
    if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}
  }
}

function openSavingsGoalDetailsSheet(goalId){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;

  const current=Number(goal.currentAmount)||0;
  const target=Number(goal.targetAmount)||0;
  const completed=savingsGoalStatus(goal)==='completed';
  const progress=renderSavingsProgress(goal);

  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet savings-details-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🎯')}</span>
        <div>
          <small>${completed?'Ολοκληρωμένος στόχος':'Στόχος αποταμίευσης'}</small>
          <h2>${esc(goal.name||'Στόχος')}</h2>
          <p>${goal.targetDate?'Στόχος: '+formatGreekFullDate(goal.targetDate):'Χωρίς ημερομηνία στόχου'}</p>
        </div>
      </div>

      <div class="savings-details-amount">
        <strong>${fmt(current)}</strong>${target>0?'<span>/ '+fmt(target)+'</span>':''}
      </div>
      ${target>0?`<div class="savings-progress-track"><i style="width:${progress}%"></i></div>`:''}

      <div class="savings-sheet-actions">
        <button type="button" class="savings-primary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','deposit')">+ Προσθήκη ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','withdrawal')">Αφαίρεση ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('${esc(goal.id)}','${savingsGoalKind(goal)}')">Επεξεργασία</button>
        <button type="button" class="savings-archive-action" onclick="archiveSavingsGoal('${esc(goal.id)}')">Αρχειοθέτηση</button>
      </div>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

function savingsCurrentBudgetBalance(){
  const income=Number(D?.income)||0;
  const fixed=typeof fixedTotal==='function'?fixedTotal():0;
  const cardPayments=typeof ccPayTotal==='function'?ccPayTotal():0;
  const budgetMovements=typeof dailyCashTotal==='function'?dailyCashTotal():0;
  return capvoMoney(income-fixed-cardPayments-budgetMovements);
}

function savingsTxMapRow(row){
  if(!row)return null;
  return {
    id:row.id,
    userId:row.user_id,
    goalId:row.goal_id,
    amount:Number(row.amount)||0,
    type:row.type||'deposit',
    source:row.source||'manual',
    note:row.note||'',
    relatedCycleKey:row.related_cycle_key||'',
    createdAt:row.created_at||new Date().toISOString()
  };
}

function savingsApplyGoalLocal(goalId,patch){
  const goal=(D.savingsGoals||[]).find(g=>String(g.id)===String(goalId));
  if(!goal)return null;
  if(Object.prototype.hasOwnProperty.call(patch,'currentAmount'))goal.currentAmount=capvoMoney(Number(patch.currentAmount)||0);
  if(Object.prototype.hasOwnProperty.call(patch,'status'))goal.status=patch.status||'active';
  if(Object.prototype.hasOwnProperty.call(patch,'completedAt'))goal.completedAt=patch.completedAt||'';
  goal.updatedAt=new Date().toISOString();
  return goal;
}

function savingsGoalCompletionPatch(goal,nextAmount){
  const target=Number(goal?.targetAmount)||0;
  if(savingsGoalKind(goal)==='target' && target>0 && nextAmount>=target){
    return {status:'completed',completedAt:new Date().toISOString()};
  }
  return {status:'active',completedAt:''};
}

function savingsBuildGoalUpdate(goal,nextAmount){
  const completion=savingsGoalCompletionPatch(goal,nextAmount);
  return {
    current_amount:capvoMoney(nextAmount),
    status:completion.status,
    completed_at:completion.completedAt||null,
    updated_at:new Date().toISOString()
  };
}

function savingsSourceChoiceMarkup(goal,mode){
  const isTarget=savingsGoalKind(goal)==='target';
  const isWithdrawal=mode==='withdrawal';
  const general=typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null;
  const generalAvailable=general && String(general.id)!==String(goal.id) && Number(general.currentAmount)>0;
  const availableBudget=Math.max(0,savingsCurrentBudgetBalance());

  if(!isTarget){
    return `<input type="hidden" id="savingsTxSource" value="budget"><input type="hidden" id="savingsTxDestination" value="budget">`;
  }

  if(!isWithdrawal){
    const generalOption=generalAvailable?`
      <label class="savings-source-option">
        <input type="radio" name="savingsTxSourceChoice" value="general_savings">
        <span>
          <strong>Από Γενική αποταμίευση</strong>
          <small>Διαθέσιμα: ${fmt(general.currentAmount||0)} · Δεν επηρεάζει budget</small>
        </span>
      </label>`:'';
    return `
      <div class="savings-transfer-choice">
        <p>Από πού θα μπει το ποσό;</p>
        <label class="savings-source-option">
          <input type="radio" name="savingsTxSourceChoice" value="budget" checked>
          <span>
            <strong>Από διαθέσιμο budget</strong>
            <small>Διαθέσιμο τώρα: ${fmt(availableBudget)}</small>
          </span>
        </label>
        ${generalOption}
      </div>
      <input type="hidden" id="savingsTxDestination" value="goal">`;
  }

  const generalDestination=general?`
    <label class="savings-source-option">
      <input type="radio" name="savingsTxDestinationChoice" value="general_savings">
      <span>
        <strong>Στη Γενική αποταμίευση</strong>
        <small>Εσωτερική μεταφορά · Δεν επηρεάζει budget</small>
      </span>
    </label>`:'';

  return `
    <div class="savings-transfer-choice">
      <p>Πού θα επιστρέψει το ποσό;</p>
      <label class="savings-source-option">
        <input type="radio" name="savingsTxDestinationChoice" value="budget" checked>
        <span>
          <strong>Στο διαθέσιμο budget</strong>
          <small>Θα αυξήσει το υπόλοιπο κύκλου</small>
        </span>
      </label>
      ${generalDestination}
    </div>
    <input type="hidden" id="savingsTxSource" value="goal">`;
}

function openSavingsDepositSheet(goalId,mode='deposit'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;

  const isWithdrawal=mode==='withdrawal';
  const overlay=ensureSavingsSheet();
  const sourceMarkup=savingsSourceChoiceMarkup(goal,mode);

  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'💰')}</span>
        <div>
          <small>${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</small>
          <h2>${esc(goal.name||'Κουμπαράς')}</h2>
          <p>Τρέχον ποσό: <strong>${fmt(goal.currentAmount||0)}</strong></p>
        </div>
      </div>

      <input type="hidden" id="savingsTxGoalId" value="${esc(goal.id)}">
      <input type="hidden" id="savingsTxMode" value="${isWithdrawal?'withdrawal':'deposit'}">

      <div class="savings-form-stack compact">
        ${sourceMarkup}
        <label class="full">Ποσό
          <input id="savingsTxAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00">
        </label>
        <label class="full">Σημείωση
          <input id="savingsTxNote" type="text" placeholder="προαιρετικά">
        </label>
      </div>

      <button type="button" class="savings-primary-btn" onclick="saveSavingsTransactionFromSheet()">${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</button>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function addSavingsTransaction(goalId,amount,type='deposit',source='manual',note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)throw new Error('Missing savings goal');

  const safeAmount=capvoMoney(Number(amount)||0);
  if(safeAmount<=0)throw new Error('Invalid savings amount');

  const current=capvoMoney(Number(goal.currentAmount)||0);
  if(type==='withdrawal' && safeAmount>current){
    const err=new Error('Withdrawal exceeds current amount');
    err.code='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE';
    throw err;
  }

  if(type==='deposit' && String(source||'')==='budget'){
    const available=savingsCurrentBudgetBalance();
    if(safeAmount>available+0.004){
      const err=new Error('Deposit exceeds available budget');
      err.code='CAPVO_SAVINGS_BUDGET_EXCEEDS_AVAILABLE';
      throw err;
    }
  }

  const signed=type==='withdrawal'?-safeAmount:safeAmount;
  const nextAmount=Math.max(0,capvoMoney(current+signed));

  const txPayload={
    user_id:ownerUserId,
    goal_id:goalId,
    amount:signed,
    type,
    source,
    note,
    related_cycle_key:relatedCycleKey||null
  };

  const {data:inserted,error:txError}=await supabaseClient
    .from('savings_transactions')
    .insert(txPayload)
    .select('*');
  if(txError)throw txError;

  const goalUpdate=savingsBuildGoalUpdate(goal,nextAmount);
  const {error:gError}=await supabaseClient
    .from('savings_goals')
    .update(goalUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',goalId);

  if(gError)throw gError;

  const completion=savingsGoalCompletionPatch(goal,nextAmount);
  savingsApplyGoalLocal(goalId,{currentAmount:nextAmount,status:completion.status,completedAt:completion.completedAt});

  const txRows=(inserted||[txPayload]).map(savingsTxMapRow).filter(Boolean);
  D.savingsTransactions=[...txRows,...(D.savingsTransactions||[])];
  return {transactions:txRows,goal:savingsGoalById?.(goalId)||goal};
}

async function addSavingsTransfer(fromGoalId,toGoalId,amount,note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId();
  const fromGoal=(D.savingsGoals||[]).find(g=>String(g.id)===String(fromGoalId));
  const toGoal=(D.savingsGoals||[]).find(g=>String(g.id)===String(toGoalId));
  if(!ownerUserId||!fromGoal||!toGoal)throw new Error('Missing savings transfer goal');

  const safeAmount=capvoMoney(Number(amount)||0);
  if(safeAmount<=0)throw new Error('Invalid savings amount');

  const fromCurrent=capvoMoney(Number(fromGoal.currentAmount)||0);
  const toCurrent=capvoMoney(Number(toGoal.currentAmount)||0);
  if(safeAmount>fromCurrent){
    const err=new Error('Transfer exceeds source amount');
    err.code='CAPVO_SAVINGS_TRANSFER_EXCEEDS_BALANCE';
    throw err;
  }

  const txPayloads=[
    {
      user_id:ownerUserId,
      goal_id:fromGoalId,
      amount:-safeAmount,
      type:'transfer_out',
      source:'transfer',
      note:note||`Μεταφορά προς ${toGoal.name||'στόχο'}`,
      related_cycle_key:relatedCycleKey||null
    },
    {
      user_id:ownerUserId,
      goal_id:toGoalId,
      amount:safeAmount,
      type:'transfer_in',
      source:'transfer',
      note:note||`Μεταφορά από ${fromGoal.name||'κουμπαρά'}`,
      related_cycle_key:relatedCycleKey||null
    }
  ];

  const {data:inserted,error:txError}=await supabaseClient
    .from('savings_transactions')
    .insert(txPayloads)
    .select('*');
  if(txError)throw txError;

  const fromNext=Math.max(0,capvoMoney(fromCurrent-safeAmount));
  const toNext=capvoMoney(toCurrent+safeAmount);
  const toUpdate=savingsBuildGoalUpdate(toGoal,toNext);
  const fromUpdate=savingsBuildGoalUpdate(fromGoal,fromNext);

  const {error:fromError}=await supabaseClient
    .from('savings_goals')
    .update(fromUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',fromGoalId);
  if(fromError)throw fromError;

  const {error:toError}=await supabaseClient
    .from('savings_goals')
    .update(toUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',toGoalId);
  if(toError)throw toError;

  const fromCompletion=savingsGoalCompletionPatch(fromGoal,fromNext);
  const toCompletion=savingsGoalCompletionPatch(toGoal,toNext);
  savingsApplyGoalLocal(fromGoalId,{currentAmount:fromNext,status:fromCompletion.status,completedAt:fromCompletion.completedAt});
  savingsApplyGoalLocal(toGoalId,{currentAmount:toNext,status:toCompletion.status,completedAt:toCompletion.completedAt});

  const txRows=(inserted||txPayloads).map(savingsTxMapRow).filter(Boolean);
  D.savingsTransactions=[...txRows,...(D.savingsTransactions||[])];
  return {transactions:txRows,fromGoal:savingsGoalById?.(fromGoalId)||fromGoal,toGoal:savingsGoalById?.(toGoalId)||toGoal};
}

function savingsErrorMessage(error){
  const code=error?.code||'';
  if(code==='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE')return 'Δεν μπορείς να αφαιρέσεις περισσότερα από όσα έχει ο κουμπαράς.';
  if(code==='CAPVO_SAVINGS_TRANSFER_EXCEEDS_BALANCE')return 'Δεν υπάρχουν αρκετά χρήματα στην επιλεγμένη πηγή.';
  if(code==='CAPVO_SAVINGS_BUDGET_EXCEEDS_AVAILABLE')return 'Το ποσό είναι μεγαλύτερο από το διαθέσιμο budget σου.';
  return 'Δεν αποθηκεύτηκε η κίνηση.';
}

async function saveSavingsTransactionFromSheet(){
  const goalId=$('savingsTxGoalId')?.value;
  const mode=$('savingsTxMode')?.value||'deposit';
  const amount=Number($('savingsTxAmount')?.value)||0;
  const note=($('savingsTxNote')?.value||'').trim();
  const goal=(D.savingsGoals||[]).find(g=>String(g.id)===String(goalId));

  if(amount<=0){showMiniToast('Βάλε ποσό.','error');return;}
  if(!goal){showMiniToast('Δεν βρέθηκε ο κουμπαράς.','error');return;}

  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn?.dataset.saving==='true')return;
  if(btn){btn.dataset.saving='true';btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    const cycleKey=currentCycleKey?.()||'';
    const isTarget=savingsGoalKind(goal)==='target';
    const general=typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null;

    if(mode==='deposit'){
      const sourceChoice=document.querySelector('input[name="savingsTxSourceChoice"]:checked')?.value || $('savingsTxSource')?.value || 'budget';
      if(isTarget && sourceChoice==='general_savings'){
        if(!general || String(general.id)===String(goal.id))throw new Error('Missing general savings');
        await addSavingsTransfer(general.id,goal.id,amount,note,cycleKey);
        closeSavingsSheet();
        render();
        showMiniToast('✅ Μεταφέρθηκε στον στόχο');
        return;
      }
      await addSavingsTransaction(goalId,amount,'deposit','budget',note,cycleKey);
    }else{
      const destinationChoice=document.querySelector('input[name="savingsTxDestinationChoice"]:checked')?.value || $('savingsTxDestination')?.value || 'budget';
      if(isTarget && destinationChoice==='general_savings'){
        if(!general || String(general.id)===String(goal.id))throw new Error('Missing general savings');
        await addSavingsTransfer(goal.id,general.id,amount,note,cycleKey);
        closeSavingsSheet();
        render();
        showMiniToast('✅ Μεταφέρθηκε στη Γενική αποταμίευση');
        return;
      }
      await addSavingsTransaction(goalId,amount,'withdrawal','budget_return',note,cycleKey);
    }

    closeSavingsSheet();
    render();
    showMiniToast(mode==='withdrawal'?'✅ Το ποσό αφαιρέθηκε':'✅ Το ποσό προστέθηκε');
  }catch(error){
    console.error('saveSavingsTransaction failed',error);
    showMiniToast(savingsErrorMessage(error),'error');
    if(btn){btn.dataset.saving='false';btn.disabled=false;btn.textContent=mode==='withdrawal'?'Αφαίρεση ποσού':'Προσθήκη ποσού';}
  }
}

async function archiveSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;

  if(Number(goal.currentAmount)>0){
    showMiniToast('Πρώτα αφαίρεσε το ποσό από τον κουμπαρά.','error');
    return;
  }

  const confirmFn=typeof showConfirmModal==='function'
    ?()=>showConfirmModal({title:'Αρχειοθέτηση κουμπαρά',message:'Θέλεις να αρχειοθετήσεις αυτόν τον κουμπαρά;',confirmText:'Αρχειοθέτηση'})
    :()=>Promise.resolve(window.confirm('Αρχειοθέτηση κουμπαρά;'));

  const ok=await confirmFn();
  if(!ok)return;

  try{
    const {error}=await supabaseClient.from('savings_goals')
      .update({is_archived:true,status:'archived',updated_at:new Date().toISOString()})
      .eq('user_id',ownerUserId)
      .eq('id',goalId);
    if(error)throw error;
    closeSavingsSheet();
    await fetchAllData(ownerUserId);
    render();
    showMiniToast('Ο κουμπαράς αρχειοθετήθηκε.');
  }catch(error){
    console.error('archiveSavingsGoal failed',error);
    showMiniToast('Δεν έγινε αρχειοθέτηση.','error');
  }
}

async function restoreSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)return;

  try{
    const {error}=await supabaseClient.from('savings_goals')
      .update({is_archived:false,status:'active',updated_at:new Date().toISOString()})
      .eq('user_id',ownerUserId)
      .eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId);
    render();
    showMiniToast('Ο κουμπαράς επανήλθε στους ενεργούς.');
  }catch(error){
    console.error('restoreSavingsGoal failed',error);
    showMiniToast('Δεν έγινε επαναφορά.','error');
  }
}
