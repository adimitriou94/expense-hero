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
    const parts=String(curM||curMK()).split('-');
    const monthName=MG[(parseInt(parts[1]||'1',10)-1)]||'μήνας';
    sub.textContent=`Ο ${monthName} είναι ενημερωμένος.`;
  }
}

// ===== MAIN RENDER =====
function render(){
  refreshComputedIncome();

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const dlS=dailyTotal();
  const cashDaily=dailyCashTotal();
  
  const tot=fxS+ccS+cashDaily;
  const bal=D.income-tot;

  const pct=D.income>0?Math.min(100,Math.round(tot/D.income*100)):0;
  const[y,mo]=curM.split('-');

  $('mLabel').textContent=MG[parseInt(mo)-1]+' '+y;
  renderDashboardGreeting();
  $('dIncome').textContent=fmt(D.income);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  $('dSpent').textContent=fmt(tot)+' / '+fmt(D.income);
  renderDashboardAllowanceCards(bal);

  $('sFixed').textContent=fmt(fxS);
  $('sCC').textContent=fmt(ccS);
  $('sDaily').textContent=fmt(dlS);
  $('sRemain').textContent=fmt(bal);
  $('sRemain').className='stat-value '+(bal>=0?'teal':'red');

  renderFixedList();
  renderDailyList();
  renderDashboardPreview();
  renderMobileCategoryInsights();
  if(typeof renderQuickRepeatChips==='function') renderQuickRepeatChips();
  if($('incomeList')) renderIncomePage();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof rAdv==='function') rAdv();

  renderPaymentSourcesSummary();
  renderSettingsPage();
}


function renderFixedList(){
  const ccCards=(D.creditCards||[]).filter(c=>c.balance>0);
  const fixedItems=(D.fixedExpenses||[])
    .slice()
    .sort((a,b)=>fixedExpenseSortTime(b)-fixedExpenseSortTime(a))
    .map(e=>({kind:'fixed',data:e}))
    .concat(ccCards.map(c=>({kind:'cc',data:c})));

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
    if(item.kind==='fixed'){
      html+=eRow(item.data,'fixed');
      return;
    }

    const c=item.data;
    const pay=effectiveCardPayment(c);
    html+=`
      <div class="expense-item fadeIn tx-v25-credit-row" onclick="go('vCards',document.querySelector('[data-v=vCards]'))">
        <div class="expense-icon cat-cc">💳</div>
        <div class="expense-info">
          <div class="expense-name">${esc(c.name)} <span class="auto-badge">από Κάρτες</span></div>
          <div class="expense-cat">Δόση πιστωτικής · Χρέος: ${fmt(c.balance)}</div>
        </div>
        <div class="expense-amount is-fixed" style="color:var(--blue)">${fmt(pay)}</div>
      </div>`;
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
  if(filter==='all' || filter==='expense') return true;

  const dateStr=String(e.date||'');
  if(!dateStr) return true;

  const today=new Date();
  const itemDate=new Date(dateStr+'T12:00:00');

  if(filter==='today'){
    return dateStr===today.toISOString().split('T')[0];
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

  return [e.name,e.category,e.paymentSourceName,e.date]
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
  const m=D.months[curM]||{daily:[]};

  $('cDaily').innerHTML=`
    ${m.daily.length} εγγραφές
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

  const m = D.months[curM] || {daily:[]};
  const totals = {};

  (m.daily || []).forEach(e=>{
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
        Δεν υπάρχουν ημερήσια έξοδα για γράφημα ακόμα.
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

  const m = D.months[curM] || {daily:[]};
  const recent = [...(m.daily || [])]
    .sort((a,b)=>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.id || '').localeCompare(String(a.id || ''))
    )
    .slice(0,5);

  if(recent.length === 0){
    el.innerHTML = `
      <div class="empty mini-empty">
        Δεν υπάρχουν πρόσφατες κινήσεις για αυτόν τον μήνα.
      </div>
    `;
    return;
  }

  el.innerHTML = recent.map(e => `
    <div class="dashboard-preview-row">
      <div class="expense-icon ${CCLS[e.category] || 'cat-other'}">
        ${CEMO[e.category] || '📌'}
      </div>

      <div class="dashboard-preview-info">
        <strong>${esc(e.name)}</strong>
        <span>${esc(e.category)} · ${e.date || ''}</span>
      </div>

      <div class="dashboard-preview-amount">
        -${fmt(e.amount)}
      </div>
    </div>
  `).join('');
}


function dashboardRemainingDays(){
  const key=curM||curMK();
  const [y,m]=String(key).split('-').map(Number);
  const daysInMonth=new Date(y,(m||1),0).getDate();
  const today=new Date();

  if(key===curMK()){
    return Math.max(1,daysInMonth-today.getDate()+1);
  }

  return daysInMonth;
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
  const balance=balanceOverride!==null && balanceOverride!==undefined
    ? Number(balanceOverride)||0
    : income-spent;

  const remainingDays=dashboardRemainingDays();
  const safeBalance=Math.max(0,balance);
  const daily=remainingDays>0?safeBalance/remainingDays:0;
  const weekly=daily*7;

  el.innerHTML=`
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
            ? ` <span class="payment-badge ${paymentSourceExists(e.paymentSourceId)?'':'deleted'}">
                  💳 ${esc(e.paymentSourceName)}${paymentSourceExists(e.paymentSourceId)?'':' (διαγραμμένο)'}
                </span>`
            : ''
          }
        </div>
      </div>

      <div class="expense-amount ${t==='fixed'?'is-fixed':'is-daily'}">${t==='fixed'?fmt(e.amount):'-'+fmt(e.amount)}</div>
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

        <div class="income-source-amount">${fmt(i.amount)}</div>

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
  $('mIncomeSourceTitle').textContent='Επεξεργασία πηγής εισοδήματος';

  $('fISName').value=i.name;
  $('fISAmount').value=i.amount;
  $('fISCategory').value=i.category;
  $('fISType').value=i.incomeType;
  $('fISRestriction').value=i.restriction;
  $('fISRestrictedCategory').value=i.restrictedCategory||'';
  $('fISIncludeBudget').checked=!!i.includeInBudget;
  $('fISSavings').checked=!!i.isSavings;
  $('fISRecurring').checked=!!i.isRecurring;
  $('fISNotes').value=i.notes||'';
  $('fISID').value=id;

  $('btnIncomeSource').textContent='Ενημέρωση πηγής';
  document.body.classList.add('modal-open');
  refreshIncomeCustomPickers();
}


function availablePaymentSources(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .map(i=>({
      id:i.id,
      name:i.name,
      type:i.incomeType||'voucher'
    }));
}

function paymentSourceById(id){
  return (D.incomeSources||[]).find(i=>i.id===id)||null;
}

function fillPaymentSourceSelect(selectedId=''){
  const el=$('fDPay');
  if(!el)return;

  const sources=availablePaymentSources();

  el.innerHTML=`
    <option value="">Κανονικό budget</option>
    ${sources.map(s=>`
      <option value="${s.id}" ${s.id===selectedId?'selected':''}>
        ${esc(s.name)}
      </option>
    `).join('')}
  `;
}


async function saveIncomeSourceRow(userId,item){
  const {error}=await supabaseClient
    .from('income_sources')
    .upsert({
      id:item.id,
      user_chat_id:userId,
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

async function saveIncomeSource(){
  const id=$('fISID').value;
  const name=$('fISName').value.trim();
  const amount=parseFloat($('fISAmount').value)||0;
  const userId=getDataOwnerId();
  const btn=$('btnIncomeSource');

  if(!name){
    $('fISName').style.borderColor='var(--red)';
    return;
  }

  if(amount<=0){
    $('fISAmount').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    showMiniToast(
      '❌ Δεν υπάρχει ενεργή σύνδεση Google',
      'error'
    );
    return;
  }

  const obj={
    id:id||gid(),
    name,
    amount,
    category:$('fISCategory').value,
    incomeType:$('fISType').value,
    includeInBudget:$('fISIncludeBudget').checked,
    isSavings:$('fISSavings').checked,
    isRecurring:$('fISRecurring').checked,
    restriction:$('fISRestriction').value,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim()
  };

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveIncomeSourceRow(userId,obj);

    if(id){
      const idx=D.incomeSources.findIndex(x=>x.id===id);
      if(idx>=0)D.incomeSources[idx]=obj;
    }else{
      if(!D.incomeSources)D.incomeSources=[];
      D.incomeSources.push(obj);
    }

    refreshComputedIncome();
    closeM();
    render();

  }catch(e){
    console.error('saveIncomeSource failed:',e);
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
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
