// CAPVO app split: 03-render-dashboard-transactions-income.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.
// CAPVO v1.1.5: savings / locked wallets and carryover wording polish.


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
    sub.textContent=`${cycle.label} · ${formatNextPaydayMeta(cycle)}`;
  }
}

// ===== MAIN RENDER =====
function render(){
  refreshComputedIncome();

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const dlS=dailyTotal();
  const cashDaily=dailyCashTotal();
  const savingsImpact=typeof savingsBudgetImpactTotal==='function'?savingsBudgetImpactTotal():0;
  
  const tot=fxS+ccS+cashDaily+savingsImpact;
  const bal=D.income-tot;

  const pct=D.income>0?Math.min(100,Math.round(tot/D.income*100)):0;
  const cycle=getCurrentBudgetCycle();

  $('mLabel').textContent=cycle.label;
  const eyebrow=document.querySelector('.modern-hero-card .eyebrow');
  if(eyebrow)eyebrow.textContent='Υπόλοιπο κύκλου';
  const heroCaption=document.querySelector('.modern-hero-caption');
  if(heroCaption)heroCaption.textContent=`Τρέχων οικονομικός κύκλος: ${cycle.label}. ${formatNextPaydayMeta(cycle)}.`;
  renderDashboardGreeting();
  $('dIncome').textContent=fmt(D.income);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  $('dSpent').textContent=fmt(tot)+' / '+fmt(D.income);
  renderDashboardAllowanceCards(bal);
  renderFirstUseBudgetPrompt();
  renderCycleCarryoverPrompt();

  $('sFixed').textContent=fmt(fxS);
  $('sCC').textContent=fmt(ccS);
  $('sDaily').textContent=fmt(dlS);
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
  if(typeof rAdv==='function') rAdv();

  renderPaymentSourcesSummary();
  renderSettingsPage();
  if(typeof renderSavingsPage==='function') renderSavingsPage();
}



function renderCycleCarryoverPrompt(){
  const anchor=document.getElementById('dashboardCycleSummaryCard');
  if(!anchor)return;

  const oldCard=document.getElementById('dashboardCarryoverCard');
  if(oldCard)oldCard.remove();

  let notice=document.getElementById('dashboardCarryoverNotice');
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;

  // Applied carryover already affects the cycle totals. Do not keep a permanent dashboard card.
  // Pending carryover belongs to the current cycle card, because it is a cycle decision.
  if(!pending){
    if(notice)notice.remove();
    anchor.classList.remove('has-cycle-task');
    const sheet=document.getElementById('cycleCarryoverSheet');
    if(sheet)sheet.classList.remove('active');
    return;
  }

  anchor.classList.add('has-cycle-task');

  if(!notice){
    notice=document.createElement('button');
    notice.type='button';
    notice.id='dashboardCarryoverNotice';
    notice.onclick=openCycleCarryoverSheet;
  }

  notice.className='dashboard-carryover-notice dashboard-cycle-task';
  if(notice.parentElement!==anchor){
    const actions=anchor.querySelector('.dashboard-cycle-summary-actions');
    if(actions)actions.insertAdjacentElement('beforebegin',notice);
    else anchor.appendChild(notice);
  }

  notice.innerHTML=`
    <span class="dashboard-carryover-notice-icon" aria-hidden="true">💡</span>
    <span class="dashboard-carryover-notice-copy">
      <strong>Εκκρεμεί υπόλοιπο ${fmt(pending.amount)}</strong>
    </span>
    <span class="dashboard-carryover-notice-action">Άνοιγμα ›</span>
  `;

  renderCycleCarryoverSheet(pending);
}

function ensureCycleCarryoverSheet(){
  let overlay=document.getElementById('cycleCarryoverSheet');
  if(overlay)return overlay;

  overlay=document.createElement('div');
  overlay.id='cycleCarryoverSheet';
  overlay.className='cycle-carryover-sheet-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Υπόλοιπο προηγούμενου κύκλου');
  overlay.onclick=function(event){
    if(event.target===overlay)closeCycleCarryoverSheet();
  };
  document.body.appendChild(overlay);
  return overlay;
}

function renderCycleCarryoverSheet(pending){
  const overlay=ensureCycleCarryoverSheet();
  if(!pending){
    overlay.innerHTML='';
    return;
  }

  overlay.innerHTML=`
    <section class="cycle-carryover-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeCycleCarryoverSheet()" aria-label="Κλείσιμο">×</button>

      <div class="cycle-carryover-hero">
        <div class="cycle-carryover-icon" aria-hidden="true">💡</div>
        <div>
          <span>Cycle review</span>
          <h2>Υπόλοιπο προηγούμενου κύκλου</h2>
          <p>Περίσσεψαν <strong>${fmt(pending.amount)}</strong> από τον κύκλο ${esc(pending.previous.label)}.</p>
        </div>
      </div>

      <div class="cycle-carryover-question">
        <strong>Τι θέλεις να γίνει;</strong>
        <span>Διάλεξε αν το ποσό θα μπει στο διαθέσιμο budget, θα πάει σε αποταμίευση ή θα μείνει εκτός budget για αυτόν τον κύκλο.</span>
      </div>

      <div class="cycle-carryover-options">
        <button type="button" class="cycle-carryover-option primary" onclick="carryOverPreviousCycle({skipConfirm:true})">
          <span class="cycle-carryover-option-icon">➕</span>
          <span>
            <strong>Μεταφορά στον νέο κύκλο</strong>
            <small>Πρόσθεσέ τα στο διαθέσιμο budget του τρέχοντος κύκλου.</small>
          </span>
        </button>

        <button type="button" class="cycle-carryover-option" onclick="movePreviousCycleCarryoverToSavings({skipConfirm:true})">
          <span class="cycle-carryover-option-icon">🏦</span>
          <span>
            <strong>Μεταφορά σε κουμπαρά</strong>
            <small>Διάλεξε στόχο αποταμίευσης. Δεν θα αυξήσει το διαθέσιμο budget.</small>
          </span>
        </button>

        <button type="button" class="cycle-carryover-option" onclick="skipPreviousCycleCarryover({skipConfirm:true})">
          <span class="cycle-carryover-option-icon">🚫</span>
          <span>
            <strong>Μην τα προσθέσεις στο budget</strong>
            <small>Θα μείνουν εκτός διαθέσιμου ποσού και δεν θα σε ξαναρωτήσω για αυτόν τον κύκλο.</small>
          </span>
        </button>

        <button type="button" class="cycle-carryover-later" onclick="closeCycleCarryoverSheet()">
          Αργότερα
        </button>
      </div>
    </section>
  `;
}

function openCycleCarryoverSheet(){
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  if(!pending){
    showMiniToast?.('Δεν υπάρχει εκκρεμές υπόλοιπο κύκλου.','info');
    return;
  }
  renderCycleCarryoverSheet(pending);
  const overlay=document.getElementById('cycleCarryoverSheet');
  overlay?.classList.add('active');
  document.body.classList.add('modal-open');
}

function closeCycleCarryoverSheet(){
  const overlay=document.getElementById('cycleCarryoverSheet');
  overlay?.classList.remove('active');
  document.body.classList.remove('modal-open');
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

  const dailyRows = getCurrentCycleDailyExpenses();
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

  const recent = [...getCurrentCycleDailyExpenses()]
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
  const savingsImpact=typeof savingsBudgetImpactTotal==='function'?savingsBudgetImpactTotal():0;
  const spent=fxS+ccS+cashDaily+savingsImpact;
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
  'Αποταμίευση':'#10b981',
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
  'Αποταμίευση':'🔒',
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

function incomeSourceBucket(source){
  if(typeof isSavingsSource==='function' && isSavingsSource(source))return 'savings';
  if(typeof isRestrictedPaymentSource==='function' && isRestrictedPaymentSource(source))return 'restricted';
  if(source?.includeInBudget)return 'budget';
  return 'other';
}

function incomeSourceTypeLabel(source){
  if(typeof isSavingsSource==='function' && isSavingsSource(source))return 'Αποταμίευση / locked';
  if(typeof isRestrictedPaymentSource==='function' && isRestrictedPaymentSource(source))return 'Restricted πηγή';
  if(source?.includeInBudget)return 'Budget';
  return 'Εκτός budget';
}

function renderIncomeSourceItem(i){
  const icon=INCOME_ICONS[i.category]||'💰';
  const savings=typeof isSavingsSource==='function' && isSavingsSource(i);
  const restricted=typeof isRestrictedPaymentSource==='function' && isRestrictedPaymentSource(i);

  return`
    <div class="income-source-item ${savings?'is-savings-source':''} ${restricted?'is-restricted-source':''}">
      <div class="income-source-icon">${icon}</div>

      <div class="income-source-info">
        <div class="income-source-name">${esc(i.name)}</div>
        <div class="income-source-meta">${esc(i.category)} · ${esc(incomeSourceTypeLabel(i))} · ${i.isRecurring?'Μηνιαίο':'One-time'}</div>

        <div class="income-badges">
          ${i.isPrimaryIncome?'<span class="income-badge budget">Βασικό budget</span>':''}
          ${i.includeInBudget?'<span class="income-badge budget">Στο budget</span>':'<span class="income-badge savings">Εκτός budget</span>'}
          ${savings?'<span class="income-badge savings">Αποταμίευση</span>':''}
          ${restricted
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

  const groups=[
    {
      key:'budget',
      title:'Budget',
      subtitle:'Πηγές που αυξάνουν το διαθέσιμο budget του κύκλου.',
      items:sources.filter(i=>incomeSourceBucket(i)==='budget')
    },
    {
      key:'restricted',
      title:'Restricted / Ticket',
      subtitle:'Πηγές που χρησιμοποιούνται μόνο για συγκεκριμένα έξοδα.',
      items:sources.filter(i=>incomeSourceBucket(i)==='restricted')
    },
    {
      key:'savings',
      title:'Αποταμίευση',
      subtitle:'Locked ποσά που μένουν εκτός διαθέσιμου budget.',
      items:sources.filter(i=>incomeSourceBucket(i)==='savings')
    },
    {
      key:'other',
      title:'Λοιπά εκτός budget',
      subtitle:'Πηγές που δεν επηρεάζουν το διαθέσιμο budget.',
      items:sources.filter(i=>incomeSourceBucket(i)==='other')
    }
  ].filter(g=>g.items.length>0);

  $('incomeList').innerHTML=groups.map(group=>`
    <section class="income-source-group income-source-group-${group.key}">
      <div class="income-source-group-head">
        <div>
          <strong>${esc(group.title)}</strong>
          <span>${esc(group.subtitle)}</span>
        </div>
        <em>${group.items.length}</em>
      </div>
      <div class="income-source-group-list">
        ${group.items.map(renderIncomeSourceItem).join('')}
      </div>
    </section>
  `).join('');
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
  document.querySelectorAll('#incomeQuickPresets button').forEach(btn=>btn.classList.remove('active'));
  document.body.classList.add('modal-open');
  refreshIncomeCustomPickers();
}


function availablePaymentSources(){
  return (D.incomeSources||[])
    .filter(i=>typeof isRestrictedPaymentSource==='function'?isRestrictedPaymentSource(i):(i.restriction && i.restriction!=='none'))
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
  ['fISName','fISAmount','fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>{
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
  return Number(normalized);
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
      kicker:'Πηγή εισοδήματος',
      title:'Προσθήκη μισθού',
      intro:'Βάλε το βασικό σου μηνιαίο εισόδημα για να υπολογίζεται σωστά το υπόλοιπο.',
      summaryTitle:'Μισθός',
      summaryText:'Σταθερό μηνιαίο εισόδημα που μετράει στο budget σου.',
      amountLabel:'Πόσο είναι ο μηνιαίος μισθός;',
      amountHint:'Θα προστεθεί στο διαθέσιμο budget κάθε μήνα.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως ο μισθός δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση μισθού',
      successText:'✅ Ο μισθός προστέθηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    budget:{
      icon:'💰',
      kicker:'Πηγή εισοδήματος',
      title:'Προσθήκη budget',
      intro:'Δήλωσε το ποσό που έχεις διαθέσιμο για τον μήνα.',
      summaryTitle:'Budget μήνα',
      summaryText:'Το βασικό ποσό που θες να χρησιμοποιείς μέσα στον μήνα.',
      amountLabel:'Πόσο budget έχεις διαθέσιμο;',
      amountHint:'Το CAPVO θα το χρησιμοποιήσει για υπόλοιπο, ημερήσιο διαθέσιμο και progress.',
      nameLabel:'Πώς να το ονομάσουμε;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το γενικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget προστέθηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    ticket:{
      icon:'🎫',
      kicker:'Restricted source',
      title:'Προσθήκη Ticket',
      intro:'Πρόσθεσε διαθέσιμο Ticket για φαγητό ή τρόφιμα.',
      summaryTitle:'Ticket',
      summaryText:'Περιορισμένη πηγή πληρωμής που δεν αυξάνει το ελεύθερο budget.',
      amountLabel:'Πόσο Ticket έχεις διαθέσιμο;',
      amountHint:'Το ποσό θα φαίνεται στο Voucher / Ticket section και θα μειώνεται με αντίστοιχα έξοδα.',
      nameLabel:'Όνομα Ticket',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Προτίμησε Τρόφιμα ή Φαγητό έξω, ανάλογα με τη χρήση.',
      saveText:'Αποθήκευση Ticket',
      successText:'✅ Το Ticket προστέθηκε',
      showRestricted:true,
      advancedHint:'Ρυθμίσεις Ticket'
    },
    voucher:{
      icon:'💳',
      kicker:'Restricted source',
      title:'Προσθήκη Voucher',
      intro:'Πρόσθεσε άυλη κάρτα ή voucher για ξεχωριστή παρακολούθηση.',
      summaryTitle:'Voucher / Άυλη κάρτα',
      summaryText:'Ξεχωριστή πηγή πληρωμής που εμφανίζεται στο dashboard χωρίς να μπερδεύει το budget.',
      amountLabel:'Πόσο υπόλοιπο έχει η άυλη κάρτα;',
      amountHint:'Το υπόλοιπο θα παρακολουθείται ξεχωριστά από το κανονικό budget.',
      nameLabel:'Όνομα άυλης κάρτας',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Άφησέ το κενό αν δεν αφορά συγκεκριμένη κατηγορία.',
      saveText:'Αποθήκευση Voucher',
      successText:'✅ Το Voucher προστέθηκε',
      showRestricted:true,
      advancedHint:'Ρυθμίσεις Voucher'
    },
    savings:{
      icon:'🔒',
      kicker:'Savings wallet',
      title:'Προσθήκη αποταμίευσης',
      intro:'Κράτησε χρήματα στην άκρη χωρίς να αυξάνουν το διαθέσιμο budget.',
      summaryTitle:'Αποταμίευση',
      summaryText:'Locked ποσό που εμφανίζεται ξεχωριστά και δεν χρησιμοποιείται για καθημερινά έξοδα.',
      amountLabel:'Πόσο θέλεις να κρατήσεις στην άκρη;',
      amountHint:'Δεν θα προστεθεί στο διαθέσιμο budget και δεν θα εμφανίζεται ως πηγή πληρωμής.',
      nameLabel:'Πώς να το ονομάσουμε;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Η αποταμίευση μένει locked, οπότε συνήθως δεν χρειάζεται κατηγορία.',
      saveText:'Αποθήκευση αποταμίευσης',
      successText:'✅ Η αποταμίευση προστέθηκε',
      showRestricted:false,
      advancedHint:'Locked wallet'
    },
    extra:{
      icon:'✨',
      kicker:'Έκτακτο ποσό',
      title:'Προσθήκη έκτακτου ποσού',
      intro:'Καταχώρησε χρήματα που δεν επαναλαμβάνονται κάθε μήνα.',
      summaryTitle:'Έκτακτο εισόδημα',
      summaryText:'One-time ποσό, χρήσιμο για bonus, επιστροφές ή δώρα.',
      amountLabel:'Πόσο είναι το έκτακτο ποσό;',
      amountHint:'Δεν θα επαναλαμβάνεται κάθε μήνα, εκτός αν το αλλάξεις στις ρυθμίσεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση ποσού',
      successText:'✅ Το έκτακτο ποσό προστέθηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    }
  };
  return configs[type]||configs.budget;
}

function setIncomeWizardMode(type,opts={}){
  const modal=document.querySelector('#mIncomeSource .income-source-modal');
  const cfg=getIncomePresetConfig(type);
  if(modal){
    modal.dataset.incomePreset=type;
    if(!opts.keepAdvanced)modal.dataset.advancedOpen='false';
    modal.classList.toggle('income-restricted-mode',!!cfg.showRestricted);
  }

  if($('incomeWizardIcon'))$('incomeWizardIcon').textContent=cfg.icon;
  if($('incomeModalKicker'))$('incomeModalKicker').textContent=cfg.kicker;
  if($('mIncomeSourceTitle'))$('mIncomeSourceTitle').textContent=cfg.title;
  if($('incomeModalIntro'))$('incomeModalIntro').textContent=cfg.intro;
  if($('incomeAmountLabel'))$('incomeAmountLabel').textContent=cfg.amountLabel;
  if($('incomeAmountHint'))$('incomeAmountHint').textContent=cfg.amountHint;
  if($('incomeNameLabel'))$('incomeNameLabel').textContent=cfg.nameLabel;
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
  if(!i)return 'budget';
  if(typeof isSavingsSource==='function' && isSavingsSource(i))return 'savings';
  if(i.restriction==='food_only' || i.category==='Ticket Restaurant')return 'ticket';
  if(i.restriction==='card_only' || i.category==='Άυλη κάρτα')return 'voucher';
  if(i.isRecurring===false)return 'extra';
  if(i.category==='Μισθός')return 'salary';
  return 'budget';
}

function getCurrentIncomeWizardMode(){
  return document.querySelector('#mIncomeSource .income-source-modal')?.dataset.incomePreset || 'budget';
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
      name:'Μισθός',
      category:'Μισθός',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:false
    },
    budget:{
      name:'Budget μήνα',
      category:'Άλλο',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:false
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
      isPrimaryIncome:false
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
      isPrimaryIncome:false
    },
    savings:{
      name:'Αποταμίευση',
      category:'Αποταμίευση',
      incomeType:'bank',
      restriction:'locked',
      restrictedCategory:'',
      includeInBudget:false,
      isSavings:true,
      isRecurring:false,
      notes:'Locked ποσό εκτός budget',
      isPrimaryIncome:false
    },
    extra:{
      name:'Έκτακτο εισόδημα',
      category:'Bonus',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:false,
      notes:'',
      isPrimaryIncome:false
    }
  };

  const preset=presets[type]||presets.budget;
  setIncomeWizardMode(type);

  const currentAmount=$('fISAmount')?.value || '';
  $('fISName').value=preset.name;
  if($('fISAmount'))$('fISAmount').value=currentAmount;
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

  if(!name){
    setIncomeModalFeedback('Συμπλήρωσε όνομα πηγής, π.χ. Μισθός ή Budget μήνα.','error');
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

  if(isSavings && includeInBudget){
    setIncomeModalFeedback('Η αποταμίευση πρέπει να μένει εκτός διαθέσιμου budget. Απενεργοποίησε το “Στο budget”.','error');
    showMiniToast('Η αποταμίευση μένει εκτός budget','error');
    markIncomeFieldError('fISIncludeBudget');
    return null;
  }

  if(isSavings && $('fISPrimary')?.checked){
    setIncomeModalFeedback('Η αποταμίευση δεν μπορεί να οριστεί ως βασικό budget.','error');
    showMiniToast('Η αποταμίευση δεν μπορεί να είναι βασικό budget','error');
    markIncomeFieldError('fISPrimary');
    return null;
  }

  return {name,amount,incomeType,restriction,includeInBudget,isSavings,isPrimaryIncome:!!$('fISPrimary')?.checked};
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
    category:$('fISCategory').value,
    incomeType:validation.incomeType,
    includeInBudget:validation.includeInBudget,
    isSavings:validation.isSavings,
    isRecurring:$('fISRecurring').checked,
    restriction:validation.restriction,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim(),
    isPrimaryIncome:!!validation.isPrimaryIncome
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
    ['fISName','fISAmount','fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>{
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

// ===== SAVINGS CENTER / KOUMPARADES (v1.1.5.1) =====
function activeSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>!g.isArchived);
}

function savingsGoalsTotal(){
  return activeSavingsGoals().reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
}

function savingsCycleSavedTotal(){
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=cycle?.startKey||'';
  const endKey=cycle?.endKey||'';
  return (D.savingsTransactions||[]).filter(t=>{
    const day=(t.createdAt||'').slice(0,10);
    return day && (!startKey || day>=startKey) && (!endKey || day<=endKey) && Number(t.amount)>0;
  }).reduce((s,t)=>s+(Number(t.amount)||0),0);
}

function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;

  const goals=activeSavingsGoals();
  const total=savingsGoalsTotal();
  const cycleSaved=savingsCycleSavedTotal();
  const targetTotal=goals.reduce((s,g)=>s+(Number(g.targetAmount)||0),0);
  const pct=targetTotal>0?Math.min(100,Math.round(total/targetTotal*100)):0;

  summary.innerHTML=`
    <article class="savings-summary-card bento-card primary">
      <span>Στην άκρη</span>
      <strong>${fmt(total)}</strong>
      <small>${goals.length} ενεργοί κουμπαράδες</small>
    </article>
    <article class="savings-summary-card bento-card">
      <span>Αυτόν τον κύκλο</span>
      <strong>${fmt(cycleSaved)}</strong>
      <small>Προσθήκες αποταμίευσης</small>
    </article>
    <article class="savings-summary-card bento-card">
      <span>Πρόοδος στόχων</span>
      <strong>${targetTotal>0?pct+'%':'—'}</strong>
      <small>${targetTotal>0?fmt(total)+' / '+fmt(targetTotal):'Βάλε στόχο για πλάνο'}</small>
    </article>
  `;

  if(goals.length===0){
    list.innerHTML=`
      <section class="savings-empty bento-card">
        <div class="savings-empty-icon">🏦</div>
        <h3>Φτιάξε τον πρώτο σου κουμπαρά</h3>
        <p>Κράτα χρήματα για αγορά, διακοπές, emergency fund ή καθαρή αποταμίευση χωρίς να μπερδεύονται με το διαθέσιμο budget.</p>
        <button type="button" class="section-add primary-add" onclick="openSavingsGoalSheet()">+ Νέος κουμπαράς</button>
      </section>`;
    return;
  }

  list.innerHTML=goals.map(g=>{
    const current=Number(g.currentAmount)||0;
    const target=Number(g.targetAmount)||0;
    const progress=target>0?Math.min(100,Math.round(current/target*100)):0;
    const remaining=Math.max(0,target-current);
    const targetMeta=g.targetDate?`Στόχος: ${formatGreekFullDate(g.targetDate)}`:'Χωρίς ημερομηνία στόχου';
    return `
      <article class="savings-goal-card bento-card">
        <div class="savings-goal-top">
          <div class="savings-goal-title">
            <span class="savings-goal-icon">${esc(g.icon||'🏦')}</span>
            <div>
              <strong>${esc(g.name)}</strong>
              <small>${esc(targetMeta)}</small>
            </div>
          </div>
          <button type="button" class="savings-goal-menu" onclick="openSavingsGoalSheet('${esc(g.id)}')">Επεξεργασία</button>
        </div>
        <div class="savings-goal-amounts">
          <strong>${fmt(current)}</strong>
          <span>${target>0?'/ '+fmt(target):'αποταμιευμένα'}</span>
        </div>
        <div class="savings-progress-track"><i style="width:${progress}%"></i></div>
        <div class="savings-goal-meta">
          <span>${target>0?progress+'% ολοκληρώθηκε':'Χωρίς ποσό στόχο'}</span>
          <span>${target>0?'Μένουν '+fmt(remaining):'Πρόσθεσε στόχο όποτε θέλεις'}</span>
        </div>
        <div class="savings-goal-actions">
          <button type="button" onclick="openSavingsDepositSheet('${esc(g.id)}','deposit')">+ Προσθήκη ποσού</button>
          <button type="button" onclick="openSavingsDepositSheet('${esc(g.id)}','withdrawal')">Ανάληψη</button>
        </div>
      </article>`;
  }).join('');
}

function ensureSavingsSheet(){
  let overlay=$('savingsSheetOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='savingsSheetOverlay';
  overlay.className='savings-sheet-overlay';
  overlay.onclick=e=>{if(e.target===overlay)closeSavingsSheet();};
  document.body.appendChild(overlay);
  return overlay;
}

function closeSavingsSheet(){
  const overlay=$('savingsSheetOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open');
}

function openSavingsGoalSheet(goalId){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>🏦</span>
        <div>
          <small>Κουμπαράς</small>
          <h2>${goal.id?'Επεξεργασία κουμπαρά':'Νέος κουμπαράς'}</h2>
          <p>Δώσε όνομα, στόχο και προαιρετικά ημερομηνία για να οργανώσεις καλύτερα την αποταμίευση.</p>
        </div>
      </div>
      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <div class="savings-form-stack">
        <label class="full">Όνομα<input id="savingsGoalName" type="text" value="${esc(goal.name||'')}" placeholder="π.χ. Νέο κινητό"></label>
        <div class="savings-inline-grid">
          <label class="savings-icon-field">Εικονίδιο<input id="savingsGoalIcon" type="text" value="${esc(goal.icon||'🏦')}" maxlength="4" inputmode="text"></label>
          <label>Ποσό στόχος<input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00"></label>
        </div>
        <label class="full">Ημερομηνία στόχου<input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}"></label>
        <label class="full">Σημείωση<textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση κουμπαρά</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}
  const id=$('savingsGoalId')?.value || crypto.randomUUID();
  const name=($('savingsGoalName')?.value||'').trim();
  if(!name){showMiniToast('Βάλε όνομα κουμπαρά.','error');return;}
  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||'🏦').trim()||'🏦',
    target_amount:Number($('savingsGoalTarget')?.value)||0,
    target_date:($('savingsGoalDate')?.value||null),
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:'general',
    is_archived:false,
    updated_at:new Date().toISOString()
  };
  const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
  if(error){console.error('saveSavingsGoal failed',error);showMiniToast('Δεν αποθηκεύτηκε ο κουμπαράς. Έλεγξε το SQL.','error');return;}
  closeSavingsSheet();
  await fetchAllData(ownerUserId); render();
  showMiniToast('✅ Ο κουμπαράς αποθηκεύτηκε');
}

function openSavingsDepositSheet(goalId,mode='deposit'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;
  const isWithdrawal=mode==='withdrawal';
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🏦')}</span>
        <div>
          <small>${isWithdrawal?'Ανάληψη από κουμπαρά':'Προσθήκη σε κουμπαρά'}</small>
          <h2>${esc(goal.name)}</h2>
          <p>Τρέχον ποσό: <strong>${fmt(goal.currentAmount||0)}</strong></p>
        </div>
      </div>
      <input type="hidden" id="savingsTxGoalId" value="${esc(goal.id)}">
      <input type="hidden" id="savingsTxMode" value="${isWithdrawal?'withdrawal':'deposit'}">
      <div class="savings-form-stack compact">
        <label class="full">Ποσό<input id="savingsTxAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
        <label class="full">Σημείωση<input id="savingsTxNote" type="text" placeholder="προαιρετικά"></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsTransactionFromSheet()">${isWithdrawal?'Αποθήκευση ανάληψης':'Προσθήκη ποσού'}</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function addSavingsTransaction(goalId,amount,type='deposit',source='manual',note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)throw new Error('Missing savings goal');
  const safeAmount=Number(amount)||0;
  if(safeAmount<=0)throw new Error('Invalid savings amount');
  const signed=type==='withdrawal'?-safeAmount:safeAmount;
  const nextAmount=Math.max(0,(Number(goal.currentAmount)||0)+signed);
  const txPayload={user_id:ownerUserId,goal_id:goalId,amount:signed,type,source,note,related_cycle_key:relatedCycleKey||null};
  const {error:txError}=await supabaseClient.from('savings_transactions').insert(txPayload);
  if(txError)throw txError;
  const {error:gError}=await supabaseClient.from('savings_goals').update({current_amount:nextAmount,updated_at:new Date().toISOString()}).eq('user_id',ownerUserId).eq('id',goalId);
  if(gError)throw gError;
}

async function saveSavingsTransactionFromSheet(){
  const goalId=$('savingsTxGoalId')?.value;
  const mode=$('savingsTxMode')?.value||'deposit';
  const amount=Number($('savingsTxAmount')?.value)||0;
  const note=($('savingsTxNote')?.value||'').trim();
  if(amount<=0){showMiniToast('Βάλε ποσό.','error');return;}
  try{
    await addSavingsTransaction(goalId,amount,mode,mode==='withdrawal'?'manual_withdrawal':'manual',note,'');
    closeSavingsSheet();
    await fetchAllData(getFinanceUserId()); render();
    showMiniToast(mode==='withdrawal'?'✅ Η ανάληψη αποθηκεύτηκε':'✅ Το ποσό προστέθηκε στον κουμπαρά');
  }catch(error){console.error('saveSavingsTransaction failed',error);showMiniToast('Δεν αποθηκεύτηκε η κίνηση.','error');}
}

function openCarryoverSavingsGoalSheet(){
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  if(!pending){showMiniToast('Δεν υπάρχει εκκρεμές υπόλοιπο.','info');return;}
  const goals=activeSavingsGoals();
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>🔒</span>
        <div>
          <small>Μεταφορά υπολοίπου</small>
          <h2>Σε ποιον κουμπαρά;</h2>
          <p>Θα μεταφερθούν <strong>${fmt(pending.amount)}</strong> από τον κύκλο ${esc(pending.previous.label)}.</p>
        </div>
      </div>
      <div class="savings-carryover-goals">
        ${goals.length?goals.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'🏦')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} αποταμιευμένα</small></button>`).join(''):`<div class="savings-mini-empty">Δεν έχεις ακόμα κουμπαρά. Δημιουργείται αυτόματα ένας γενικός κουμπαράς.</div>`}
      </div>
      ${goals.length?'<button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet()">+ Νέος κουμπαράς</button>':'<button type="button" class="savings-primary-btn" onclick="createDefaultGoalAndApplyCarryover()">Δημιουργία γενικού κουμπαρά</button>'}
    </section>`;
  closeCycleCarryoverSheet?.();
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function createDefaultGoalAndApplyCarryover(){
  const ownerUserId=getFinanceUserId();
  const id=crypto.randomUUID();
  const payload={id,user_id:ownerUserId,name:'Γενικός κουμπαράς',icon:'🏦',target_amount:0,current_amount:0,goal_type:'general',is_archived:false,updated_at:new Date().toISOString()};
  const {error}=await supabaseClient.from('savings_goals').insert(payload);
  if(error){console.error(error);showMiniToast('Δεν δημιουργήθηκε κουμπαράς.','error');return;}
  await fetchAllData(ownerUserId);
  await applyCarryoverToSavingsGoal(id);
}

async function applyCarryoverToSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!pending||!goal){showMiniToast('Δεν βρέθηκε κουμπαράς ή υπόλοιπο.','error');return;}
  try{
    await addSavingsTransaction(goalId,pending.amount,'carryover','cycle_carryover',`Υπόλοιπο κύκλου ${pending.previous.label}`,pending.previous.startKey);
    await upsertCycleCarryoverDecision(ownerUserId,pending,'move_to_savings',`Μεταφορά σε κουμπαρά: ${goal.name}`);
    closeSavingsSheet();
    await fetchAllData(ownerUserId); render(); renderBudgetCycleManager?.();
    showMiniToast('✅ Το υπόλοιπο μεταφέρθηκε σε κουμπαρά');
  }catch(error){console.error('applyCarryoverToSavingsGoal failed',error);showMiniToast('Δεν έγινε η μεταφορά σε κουμπαρά.','error');}
}

// Override v1.1.5 direct savings-source behavior: savings now live in dedicated goals.
function movePreviousCycleCarryoverToSavings(options={}){
  openCarryoverSavingsGoalSheet();
}

/* ============================================================
   CAPVO v1.1.5.3 - Savings production UX override
   General savings + target goals + validations + archive/complete flows
   ============================================================ */
function savingsGoalKind(goal){
  if(!goal)return 'target';
  const type=(goal.goalType||'').toLowerCase();
  if(type==='general' && !(Number(goal.targetAmount)>0))return 'general';
  return 'target';
}
function generalSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='general');
}
function targetSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='target');
}
function savingsCycleStats(){
  const current=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=current?.startKey||'';
  const endKey=current?.endKey||'';
  let deposits=0, withdrawals=0;
  (D.savingsTransactions||[]).forEach(t=>{
    const day=(t.createdAt||'').slice(0,10);
    if(!day || (startKey && day<startKey) || (endKey && day>endKey))return;
    const amount=Number(t.amount)||0;
    if(amount>0)deposits+=amount;
    if(amount<0)withdrawals+=Math.abs(amount);
  });
  return {deposits,withdrawals,net:deposits-withdrawals};
}
function savingsGoalStatus(goal){
  const target=Number(goal?.targetAmount)||0;
  const current=Number(goal?.currentAmount)||0;
  if(goal?.isArchived)return 'archived';
  if(savingsGoalKind(goal)==='target' && target>0 && current>=target)return 'completed';
  return 'active';
}
function renderSavingsSummaryCards(goals,total,stats,targetTotal,pct){
  const sign=stats.net<0?'-':'';
  return `
    <article class="savings-summary-card bento-card primary">
      <span>Στην άκρη</span>
      <strong>${fmt(total)}</strong>
      <small>${goals.length} ενεργοί κουμπαράδες</small>
    </article>
    <article class="savings-summary-card bento-card ${stats.net<0?'warning':''}">
      <span>Καθαρή αποταμίευση</span>
      <strong>${sign}${fmt(Math.abs(stats.net))}</strong>
      <small>+${fmt(stats.deposits)} μέσα · -${fmt(stats.withdrawals)} έξω</small>
    </article>
    <article class="savings-summary-card bento-card">
      <span>Πρόοδος στόχων</span>
      <strong>${targetTotal>0?pct+'%':'—'}</strong>
      <small>${targetTotal>0?fmt(total)+' / '+fmt(targetTotal):'Βάλε στόχο για πλάνο'}</small>
    </article>`;
}
function renderGeneralSavingsSection(goals){
  if(goals.length===0){
    return `<section class="savings-production-section bento-card savings-general-empty">
      <div class="savings-section-head">
        <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Χρήματα που κρατάς εκτός budget χωρίς συγκεκριμένο στόχο.</p></div>
      </div>
      <button type="button" class="savings-primary-btn" onclick="createGeneralSavingsGoal()">+ Δημιουργία γενικής αποταμίευσης</button>
    </section>`;
  }
  return `<section class="savings-production-section bento-card">
    <div class="savings-section-head">
      <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Λεφτά στην άκρη που δεν μετράνε στο διαθέσιμο budget.</p></div>
    </div>
    <div class="savings-card-stack">
      ${goals.map(g=>renderSavingsGoalCard(g)).join('')}
    </div>
  </section>`;
}
function renderTargetSavingsSection(goals){
  if(goals.length===0){
    return `<section class="savings-production-section bento-card savings-empty compact">
      <div class="savings-empty-icon">🎯</div>
      <h3>Βάλε τον πρώτο σου στόχο</h3>
      <p>Φτιάξε στόχο για αγορά, ταξίδι ή κάτι συγκεκριμένο και παρακολούθησε την πρόοδό του.</p>
      <button type="button" class="section-add primary-add" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  }
  return `<section class="savings-production-section bento-card">
    <div class="savings-section-head with-action">
      <div><small>Στόχοι</small><h3>Στόχοι αποταμίευσης</h3><p>Αγορές, ταξίδια και ποσά που θέλεις να πετύχεις.</p></div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Στόχος</button>
    </div>
    <div class="savings-card-stack">
      ${goals.map(g=>renderSavingsGoalCard(g)).join('')}
    </div>
  </section>`;
}
function renderSavingsGoalCard(g){
  const current=Number(g.currentAmount)||0;
  const target=Number(g.targetAmount)||0;
  const kind=savingsGoalKind(g);
  const completed=savingsGoalStatus(g)==='completed';
  const progress=target>0?Math.min(100,Math.round(current/target*100)):0;
  const remaining=Math.max(0,target-current);
  const targetMeta=kind==='general'
    ? 'Χωρίς συγκεκριμένο στόχο'
    : (g.targetDate?`Στόχος: ${formatGreekFullDate(g.targetDate)}`:'Χωρίς ημερομηνία στόχου');
  return `<article class="savings-goal-card savings-goal-card-v2 ${completed?'is-completed':''}">
    <div class="savings-goal-top">
      <div class="savings-goal-title">
        <span class="savings-goal-icon">${esc(g.icon||'🏦')}</span>
        <div>
          <strong>${esc(g.name)}</strong>
          <small>${esc(targetMeta)}</small>
        </div>
      </div>
      ${completed?'<em class="savings-complete-badge">Ολοκληρώθηκε</em>':`<button type="button" class="savings-goal-menu" onclick="openSavingsGoalSheet('${esc(g.id)}')">Επεξεργασία</button>`}
    </div>
    <div class="savings-goal-amounts">
      <strong>${fmt(current)}</strong>
      <span>${kind==='target' && target>0?'/ '+fmt(target):'στην άκρη'}</span>
    </div>
    ${kind==='target'?`<div class="savings-progress-track"><i style="width:${progress}%"></i></div>
    <div class="savings-goal-meta"><span>${progress}% ολοκληρώθηκε</span><span>${completed?'Έφτασες τον στόχο':('Μένουν '+fmt(remaining))}</span></div>`:''}
    <div class="savings-goal-actions">
      <button type="button" onclick="openSavingsDepositSheet('${esc(g.id)}','deposit')">+ Προσθήκη ποσού</button>
      <button type="button" onclick="openSavingsDepositSheet('${esc(g.id)}','withdrawal')">Αφαίρεση ποσού</button>
      ${completed?`<button type="button" class="savings-complete-action" onclick="completeSavingsGoal('${esc(g.id)}')">Ολοκλήρωση / Αγορά</button>`:''}
      <button type="button" class="savings-archive-action" onclick="archiveSavingsGoal('${esc(g.id)}')">Αρχειοθέτηση</button>
    </div>
  </article>`;
}
function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;
  const goals=activeSavingsGoals();
  const general=generalSavingsGoals();
  const targets=targetSavingsGoals();
  const total=savingsGoalsTotal();
  const stats=savingsCycleStats();
  const targetTotal=targets.reduce((s,g)=>s+(Number(g.targetAmount)||0),0);
  const targetCurrent=targets.reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
  const pct=targetTotal>0?Math.min(100,Math.round(targetCurrent/targetTotal*100)):0;
  summary.innerHTML=renderSavingsSummaryCards(goals,total,stats,targetTotal,pct);
  list.innerHTML=`
    ${renderGeneralSavingsSection(general)}
    ${renderTargetSavingsSection(targets)}
  `;
}
function openSavingsGoalSheet(goalId,kind='target'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const goalKind=goal.id?savingsGoalKind(goal):kind;
  const isGeneral=goalKind==='general';
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
          <p>${isGeneral?'Χρήματα στην άκρη χωρίς συγκεκριμένο ποσό στόχο.':'Δώσε ποσό στόχο και προαιρετικά ημερομηνία για να βλέπεις πρόοδο.'}</p>
        </div>
      </div>
      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <input type="hidden" id="savingsGoalKind" value="${esc(goalKind)}">
      <div class="savings-form-stack">
        <label class="full">Όνομα<input id="savingsGoalName" type="text" value="${esc(goal.name||'')}" placeholder="${isGeneral?'π.χ. Γενική αποταμίευση':'π.χ. Ταξίδι Ιαπωνία'}"></label>
        <div class="savings-inline-grid">
          <label class="savings-icon-field">Εικονίδιο<input id="savingsGoalIcon" type="text" value="${esc(goal.icon||(isGeneral?'💰':'🎯'))}" maxlength="4" inputmode="text"></label>
          <label>${isGeneral?'Προαιρετικό όριο':'Ποσό στόχος'}<input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00"></label>
        </div>
        <label class="full">Ημερομηνία στόχου<input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}" ${isGeneral?'disabled':''}></label>
        <label class="full">Σημείωση<textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}
async function createGeneralSavingsGoal(){
  openSavingsGoalSheet('', 'general');
}
async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}
  const id=$('savingsGoalId')?.value || crypto.randomUUID();
  const kind=$('savingsGoalKind')?.value||'target';
  const isGeneral=kind==='general';
  const name=($('savingsGoalName')?.value||'').trim();
  const target=Number($('savingsGoalTarget')?.value)||0;
  const targetDate=($('savingsGoalDate')?.value||null);
  if(!name){showMiniToast('Βάλε όνομα.','error');return;}
  if(!isGeneral && target<=0){showMiniToast('Για στόχο χρειάζεται ποσό στόχος.','error');return;}
  if(target<0){showMiniToast('Το ποσό στόχος δεν μπορεί να είναι αρνητικό.','error');return;}
  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||(isGeneral?'💰':'🎯')).trim()||(isGeneral?'💰':'🎯'),
    target_amount:target,
    target_date:isGeneral?null:targetDate,
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:isGeneral?'general':'target',
    is_archived:false,
    status:'active',
    updated_at:new Date().toISOString()
  };
  const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
  if(error){console.error('saveSavingsGoal failed',error);showMiniToast('Δεν αποθηκεύτηκε. Τρέξε το SQL του v1.1.5.3.','error');return;}
  closeSavingsSheet();
  await fetchAllData(ownerUserId); render();
  showMiniToast('✅ Αποθηκεύτηκε');
}
function openSavingsDepositSheet(goalId,mode='deposit'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;
  const isWithdrawal=mode==='withdrawal';
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🏦')}</span>
        <div>
          <small>${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</small>
          <h2>${esc(goal.name)}</h2>
          <p>Τρέχον ποσό: <strong>${fmt(goal.currentAmount||0)}</strong>${isWithdrawal?' · Δεν μπορείς να αφαιρέσεις περισσότερα.':''}</p>
        </div>
      </div>
      <input type="hidden" id="savingsTxGoalId" value="${esc(goal.id)}">
      <input type="hidden" id="savingsTxMode" value="${isWithdrawal?'withdrawal':'deposit'}">
      <div class="savings-form-stack compact">
        <label class="full">Ποσό<input id="savingsTxAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
        <label class="full">Σημείωση<input id="savingsTxNote" type="text" placeholder="προαιρετικά"></label>
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
  const safeAmount=Number(amount)||0;
  if(safeAmount<=0)throw new Error('Invalid savings amount');
  const current=Number(goal.currentAmount)||0;
  if(type==='withdrawal' && safeAmount>current){
    const err=new Error('Withdrawal exceeds current amount');
    err.code='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE';
    throw err;
  }
  const signed=type==='withdrawal'?-safeAmount:safeAmount;
  const nextAmount=Math.max(0,current+signed);
  const txPayload={user_id:ownerUserId,goal_id:goalId,amount:signed,type,source,note,related_cycle_key:relatedCycleKey||null};
  const {error:txError}=await supabaseClient.from('savings_transactions').insert(txPayload);
  if(txError)throw txError;
  const status=savingsGoalKind(goal)==='target' && Number(goal.targetAmount)>0 && nextAmount>=Number(goal.targetAmount)?'completed':'active';
  const goalUpdate={current_amount:nextAmount,status,updated_at:new Date().toISOString()};
  if(status==='completed')goalUpdate.completed_at=new Date().toISOString();
  if(status==='active')goalUpdate.completed_at=null;
  const {error:gError}=await supabaseClient.from('savings_goals').update(goalUpdate).eq('user_id',ownerUserId).eq('id',goalId);
  if(gError)throw gError;
}
async function saveSavingsTransactionFromSheet(){
  const goalId=$('savingsTxGoalId')?.value;
  const mode=$('savingsTxMode')?.value||'deposit';
  const amount=Number($('savingsTxAmount')?.value)||0;
  const note=($('savingsTxNote')?.value||'').trim();
  if(amount<=0){showMiniToast('Βάλε ποσό.','error');return;}
  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
  try{
    await addSavingsTransaction(goalId,amount,mode,mode==='withdrawal'?'manual_withdrawal':'manual',note,'');
    closeSavingsSheet();
    await fetchAllData(getFinanceUserId()); render();
    showMiniToast(mode==='withdrawal'?'✅ Το ποσό αφαιρέθηκε':'✅ Το ποσό προστέθηκε');
  }catch(error){
    console.error('saveSavingsTransaction failed',error);
    showMiniToast(error?.code==='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE'?'Δεν μπορείς να αφαιρέσεις περισσότερα από όσα έχει ο κουμπαράς.':'Δεν αποθηκεύτηκε η κίνηση.','error');
    if(btn){btn.disabled=false;btn.textContent=mode==='withdrawal'?'Αφαίρεση ποσού':'Προσθήκη ποσού';}
  }
}
async function archiveSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;
  if(Number(goal.currentAmount)>0){
    showMiniToast('Πρώτα αφαίρεσε το ποσό ή χρησιμοποίησε Ολοκλήρωση / Αγορά.','error');
    return;
  }
  try{
    const {error}=await supabaseClient.from('savings_goals').update({is_archived:true,status:savingsGoalStatus(goal)==='completed'?'completed':'archived',updated_at:new Date().toISOString()}).eq('user_id',ownerUserId).eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId); render();
    showMiniToast('Ο κουμπαράς αρχειοθετήθηκε.');
  }catch(error){console.error('archiveSavingsGoal failed',error);showMiniToast('Δεν έγινε αρχειοθέτηση.','error');}
}
async function completeSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;
  const amount=Number(goal.currentAmount)||0;
  if(amount<=0){await archiveSavingsGoal(goalId);return;}
  try{
    await addSavingsTransaction(goalId,amount,'withdrawal','goal_completed','Ολοκλήρωση στόχου / αγορά','');
    const {error}=await supabaseClient.from('savings_goals').update({is_archived:true,status:'completed',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',ownerUserId).eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId); render();
    showMiniToast('🎉 Ο στόχος ολοκληρώθηκε και αρχειοθετήθηκε');
  }catch(error){console.error('completeSavingsGoal failed',error);showMiniToast('Δεν ολοκληρώθηκε ο στόχος.','error');}
}
function openCarryoverSavingsGoalSheet(){
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  if(!pending){showMiniToast('Δεν υπάρχει εκκρεμές υπόλοιπο.','info');return;}
  const goals=activeSavingsGoals();
  const general=generalSavingsGoals();
  const targets=targetSavingsGoals();
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>🔒</span>
        <div>
          <small>Μεταφορά υπολοίπου</small>
          <h2>Πού θέλεις να μπει;</h2>
          <p>Θα μεταφερθούν <strong>${fmt(pending.amount)}</strong> από τον κύκλο ${esc(pending.previous.label)}.</p>
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Αποταμίευση</small>
        <div class="savings-carryover-goals">
          ${general.length?general.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'💰')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} στην άκρη</small></button>`).join(''):`<button type="button" onclick="createDefaultGoalAndApplyCarryover()"><span>💰</span><strong>Γενική αποταμίευση</strong><small>Δημιουργία και μεταφορά</small></button>`}
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Στόχοι</small>
        <div class="savings-carryover-goals">
          ${targets.length?targets.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'🎯')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} / ${fmt(g.targetAmount||0)}</small></button>`).join(''):`<div class="savings-mini-empty">Δεν έχεις ακόμα στόχο.</div>`}
        </div>
      </div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  closeCycleCarryoverSheet?.();
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}
async function createDefaultGoalAndApplyCarryover(){
  const ownerUserId=getFinanceUserId();
  const id=crypto.randomUUID();
  const payload={id,user_id:ownerUserId,name:'Γενική αποταμίευση',icon:'💰',target_amount:0,current_amount:0,goal_type:'general',status:'active',is_archived:false,updated_at:new Date().toISOString()};
  const {error}=await supabaseClient.from('savings_goals').insert(payload);
  if(error){console.error(error);showMiniToast('Δεν δημιουργήθηκε αποταμίευση. Τρέξε το SQL.','error');return;}
  await fetchAllData(ownerUserId);
  await applyCarryoverToSavingsGoal(id);
}

/* ============================================================
   CAPVO v1.1.5.4 - Savings UX Production Polish
   One general savings wallet, compact targets, archived restore,
   and budget impact for manual savings movements.
   ============================================================ */
function archivedSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>g.isArchived || (g.status||'').toLowerCase()==='archived');
}
function savingsGoalTransactions(goalId){
  return (D.savingsTransactions||[]).filter(t=>t.goalId===goalId || t.goal_id===goalId);
}
function canDeleteSavingsGoal(goal){
  if(!goal || savingsGoalKind(goal)==='general')return false;
  const current=Number(goal.currentAmount)||0;
  return current<=0 && savingsGoalTransactions(goal.id).length===0;
}
function setSavingsTxSource(value,btn){
  const input=$('savingsTxSource');
  if(input)input.value=value;
  const group=btn?.closest?.('.savings-choice-group');
  if(group){
    group.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
}
function savingsBudgetImpactTotal(){
  const current=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=current?.startKey||'';
  const endKey=current?.endKey||'';
  let impact=0;
  (D.savingsTransactions||[]).forEach(t=>{
    const day=(t.createdAt||'').slice(0,10);
    if(!day || (startKey && day<startKey) || (endKey && day>endKey))return;
    const amount=Number(t.amount)||0;
    const source=(t.source||'manual').toLowerCase();
    const type=(t.type||'deposit').toLowerCase();
    if(amount>0){
      // Carryover money was never added to the current budget, so putting it into savings should not reduce current budget.
      if(type==='carryover' || source==='cycle_carryover')return;
      impact+=amount;
      return;
    }
    if(amount<0){
      // Goal completion/purchase is consumption from savings, not money returned to spendable budget.
      if(source==='goal_completed')return;
      impact+=amount;
    }
  });
  return impact;
}
function generalSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='general');
}
function targetSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='target');
}
function openGeneralSavingsFlow(){
  const general=generalSavingsGoals()[0];
  if(general){
    openSavingsDepositSheet(general.id,'deposit');
    return;
  }
  openSavingsGoalSheet('', 'general');
}
function renderSavingsSummaryCards(goals,total,stats,targetTotal,pct){
  const sign=stats.net<0?'-':'';
  return `
    <article class="savings-summary-card savings-summary-hero-card bento-card primary">
      <span>Στην άκρη</span>
      <strong>${fmt(total)}</strong>
      <small>${goals.length} ενεργοί κουμπαράδες</small>
    </article>
    <article class="savings-summary-card bento-card ${stats.net<0?'warning':''}">
      <span>Καθαρή αποταμίευση</span>
      <strong>${sign}${fmt(Math.abs(stats.net))}</strong>
      <small>+${fmt(stats.deposits)} μέσα · -${fmt(stats.withdrawals)} έξω</small>
    </article>`;
}
function renderGeneralSavingsSection(goals){
  const general=goals[0];
  if(!general){
    return `<section class="savings-production-section bento-card savings-general-empty savings-wallet-section">
      <div class="savings-section-head with-action">
        <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Χρήματα που κρατάς εκτός budget χωρίς συγκεκριμένο στόχο.</p></div>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'general')">Δημιουργία</button>
      </div>
    </section>`;
  }
  return `<section class="savings-production-section bento-card savings-wallet-section">
    <div class="savings-section-head">
      <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Δεν έχει ποσό στόχο. Είναι λεφτά που βγαίνουν από το διαθέσιμο budget.</p></div>
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
      <div><small>Στόχοι</small><h3>Στόχοι αποταμίευσης</h3><p>Αγορές, ταξίδια και ποσά που θέλεις να πετύχεις.</p></div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Στόχος</button>
    </div>
    <div class="savings-compact-list">
      ${goals.map(g=>renderSavingsGoalCompactCard(g)).join('')}
    </div>
  </section>`;
}
function renderSavingsGoalCompactCard(g){
  const current=Number(g.currentAmount)||0;
  const target=Number(g.targetAmount)||0;
  const completed=savingsGoalStatus(g)==='completed';
  const progress=target>0?Math.min(100,Math.round(current/target*100)):0;
  const remaining=Math.max(0,target-current);
  const targetMeta=g.targetDate?`Στόχος: ${formatGreekFullDate(g.targetDate)}`:'Χωρίς ημερομηνία στόχου';
  return `<button type="button" class="savings-target-row ${completed?'is-completed':''}" onclick="openSavingsGoalDetailsSheet('${esc(g.id)}')">
    <span class="savings-goal-icon">${esc(g.icon||'🎯')}</span>
    <span class="savings-target-copy">
      <strong>${esc(g.name)}</strong>
      <small>${completed?'Ολοκληρώθηκε':esc(targetMeta)}</small>
      <i><b style="width:${progress}%"></b></i>
      <em>${fmt(current)} / ${fmt(target)} · ${completed?'έφτασες τον στόχο':'μένουν '+fmt(remaining)}</em>
    </span>
    <span class="savings-target-arrow">›</span>
  </button>`;
}
function renderArchivedSavingsSection(goals){
  if(!goals.length)return '';
  return `<section class="savings-production-section bento-card savings-archived-section">
    <details>
      <summary><span>Αρχειοθετημένα</span><em>${goals.length}</em></summary>
      <div class="savings-archived-list">
        ${goals.map(g=>`<article><span>${esc(g.icon||'🏦')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)}</small><button type="button" onclick="restoreSavingsGoal('${esc(g.id)}')">Επαναφορά</button></article>`).join('')}
      </div>
    </details>
  </section>`;
}
function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;
  const goals=activeSavingsGoals();
  const general=generalSavingsGoals();
  const targets=targetSavingsGoals();
  const archived=archivedSavingsGoals();
  const total=savingsGoalsTotal();
  const stats=savingsCycleStats();
  const targetTotal=targets.reduce((s,g)=>s+(Number(g.targetAmount)||0),0);
  const targetCurrent=targets.reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
  const pct=targetTotal>0?Math.min(100,Math.round(targetCurrent/targetTotal*100)):0;
  summary.innerHTML=renderSavingsSummaryCards(goals,total,stats,targetTotal,pct);
  list.innerHTML=`
    ${renderGeneralSavingsSection(general)}
    ${renderTargetSavingsSection(targets)}
    ${renderArchivedSavingsSection(archived)}
  `;
}
function openSavingsGoalDetailsSheet(goalId){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;
  const current=Number(goal.currentAmount)||0;
  const target=Number(goal.targetAmount)||0;
  const completed=savingsGoalStatus(goal)==='completed';
  const progress=target>0?Math.min(100,Math.round(current/target*100)):0;
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet savings-details-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🎯')}</span>
        <div>
          <small>${completed?'Ολοκληρωμένος στόχος':'Στόχος αποταμίευσης'}</small>
          <h2>${esc(goal.name)}</h2>
          <p>${goal.targetDate?'Στόχος: '+formatGreekFullDate(goal.targetDate):'Χωρίς ημερομηνία στόχου'}</p>
        </div>
      </div>
      <div class="savings-details-amount">
        <strong>${fmt(current)}</strong><span>/ ${fmt(target)}</span>
      </div>
      <div class="savings-progress-track"><i style="width:${progress}%"></i></div>
      <div class="savings-goal-meta"><span>${progress}% ολοκληρώθηκε</span><span>${completed?'Έφτασες τον στόχο':'Μένουν '+fmt(Math.max(0,target-current))}</span></div>
      <div class="savings-sheet-actions">
        <button type="button" class="savings-primary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','deposit')">+ Προσθήκη ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','withdrawal')">Αφαίρεση ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('${esc(goal.id)}','target')">Επεξεργασία</button>
        ${completed?`<button type="button" class="savings-complete-action" onclick="completeSavingsGoal('${esc(goal.id)}')">Ολοκλήρωση / Αγορά</button>`:''}
        ${canDeleteSavingsGoal(goal)
          ? `<button type="button" class="savings-delete-action" onclick="deleteSavingsGoal('${esc(goal.id)}')">Διαγραφή στόχου</button>`
          : `<button type="button" class="savings-archive-action" onclick="archiveSavingsGoal('${esc(goal.id)}')">Αρχειοθέτηση</button>`}
      </div>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}
function openSavingsGoalSheet(goalId,kind='target'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const goalKind=goal.id?savingsGoalKind(goal):kind;
  const isGeneral=goalKind==='general';
  const existingGeneral=generalSavingsGoals()[0];
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
          <p>${isGeneral?'Μία γενική αποταμίευση, χωρίς ποσό στόχο.':'Δώσε ποσό στόχο και προαιρετικά ημερομηνία για να βλέπεις πρόοδο.'}</p>
        </div>
      </div>
      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <input type="hidden" id="savingsGoalKind" value="${esc(goalKind)}">
      <div class="savings-form-stack">
        <label class="full">Όνομα<input id="savingsGoalName" type="text" value="${esc(goal.name||'')}" placeholder="${isGeneral?'π.χ. Γενική αποταμίευση':'π.χ. Ταξίδι Ιαπωνία'}"></label>
        <div class="savings-inline-grid ${isGeneral?'is-general-only':''}">
          <label class="savings-icon-field">Εικονίδιο<input id="savingsGoalIcon" type="text" value="${esc(goal.icon||(isGeneral?'💰':'🎯'))}" maxlength="4" inputmode="text"></label>
          ${isGeneral?'':`<label>Ποσό στόχος<input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00"></label>`}
        </div>
        ${isGeneral?'':`<label class="full">Ημερομηνία στόχου<input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}"></label>`}
        <label class="full">Σημείωση<textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}
async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}
  const id=$('savingsGoalId')?.value || crypto.randomUUID();
  const kind=$('savingsGoalKind')?.value||'target';
  const isGeneral=kind==='general';
  const existingGeneral=generalSavingsGoals()[0];
  if(isGeneral && !($('savingsGoalId')?.value) && existingGeneral){
    showMiniToast('Υπάρχει ήδη γενική αποταμίευση.','error');
    return;
  }
  const name=($('savingsGoalName')?.value||'').trim();
  const target=isGeneral?0:(Number($('savingsGoalTarget')?.value)||0);
  const targetDate=isGeneral?null:($('savingsGoalDate')?.value||null);
  if(!name){showMiniToast('Βάλε όνομα.','error');return;}
  if(!isGeneral && target<=0){showMiniToast('Για στόχο χρειάζεται ποσό στόχος.','error');return;}
  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||(isGeneral?'💰':'🎯')).trim()||(isGeneral?'💰':'🎯'),
    target_amount:target,
    target_date:targetDate,
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:isGeneral?'general':'target',
    is_archived:false,
    status:'active',
    updated_at:new Date().toISOString()
  };
  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
  const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
  if(error){console.error('saveSavingsGoal failed',error);showMiniToast('Δεν αποθηκεύτηκε.','error');if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}return;}
  closeSavingsSheet();
  await fetchAllData(ownerUserId); render();
  showMiniToast('✅ Αποθηκεύτηκε');
}
async function archiveSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;
  if(Number(goal.currentAmount)>0){
    showMiniToast('Πρώτα αφαίρεσε το ποσό ή χρησιμοποίησε Ολοκλήρωση / Αγορά.','error');
    return;
  }
  try{
    const {error}=await supabaseClient.from('savings_goals').update({is_archived:true,status:'archived',updated_at:new Date().toISOString()}).eq('user_id',ownerUserId).eq('id',goalId);
    if(error)throw error;
    closeSavingsSheet();
    await fetchAllData(ownerUserId); render();
    showMiniToast('Ο κουμπαράς αρχειοθετήθηκε.');
  }catch(error){console.error('archiveSavingsGoal failed',error);showMiniToast('Δεν έγινε αρχειοθέτηση.','error');}
}
async function deleteSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;
  if(!canDeleteSavingsGoal(goal)){
    showMiniToast('Ο στόχος έχει ιστορικό. Μπορείς να τον αρχειοθετήσεις, όχι να τον διαγράψεις.','error');
    return;
  }
  const confirmed=await showConfirmModal({
    title:'Διαγραφή στόχου',
    message:'Ο στόχος δεν έχει ποσό ή κινήσεις και μπορεί να διαγραφεί οριστικά. Θέλεις να συνεχίσεις;',
    confirmText:'Διαγραφή'
  });
  if(!confirmed)return;
  try{
    const {error}=await supabaseClient.from('savings_goals').delete().eq('user_id',ownerUserId).eq('id',goalId);
    if(error)throw error;
    closeSavingsSheet();
    await fetchAllData(ownerUserId); render();
    showMiniToast('✅ Ο στόχος διαγράφηκε');
  }catch(error){
    console.error('deleteSavingsGoal failed',error);
    showMiniToast('Δεν έγινε διαγραφή.','error');
  }
}

async function restoreSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)return;
  try{
    const {error}=await supabaseClient.from('savings_goals').update({is_archived:false,status:'active',updated_at:new Date().toISOString()}).eq('user_id',ownerUserId).eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId); render();
    showMiniToast('Ο κουμπαράς επανήλθε στους ενεργούς.');
  }catch(error){console.error('restoreSavingsGoal failed',error);showMiniToast('Δεν έγινε επαναφορά.','error');}
}
function openCarryoverSavingsGoalSheet(){
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  if(!pending){showMiniToast('Δεν υπάρχει εκκρεμές υπόλοιπο.','info');return;}
  const general=generalSavingsGoals();
  const targets=targetSavingsGoals();
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>🔒</span>
        <div>
          <small>Μεταφορά υπολοίπου</small>
          <h2>Πού θέλεις να μπει;</h2>
          <p>Θα μεταφερθούν <strong>${fmt(pending.amount)}</strong> από τον κύκλο ${esc(pending.previous.label)}.</p>
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Αποταμίευση</small>
        <div class="savings-carryover-goals">
          ${general.length?general.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'💰')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} στην άκρη</small></button>`).join(''):`<button type="button" onclick="createDefaultGoalAndApplyCarryover()"><span>💰</span><strong>Γενική αποταμίευση</strong><small>Δημιουργία και μεταφορά</small></button>`}
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Στόχοι</small>
        <div class="savings-carryover-goals">
          ${targets.length?targets.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'🎯')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} / ${fmt(g.targetAmount||0)}</small></button>`).join(''):`<div class="savings-mini-empty">Δεν έχεις ακόμα στόχο.</div>`}
        </div>
      </div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  closeCycleCarryoverSheet?.();
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

/* ============================================================
   CAPVO v1.1.6 - Money Allocation Foundation
   Default general savings + source-aware goal transfers + bonus allocation.
   ============================================================ */
let capvoEnsuringDefaultGeneralSavings=false;

function getDefaultGeneralSavingsGoal(){
  return (D.savingsGoals||[]).find(g=>!g.isArchived && savingsGoalKind(g)==='general' && (g.isDefault || (g.name||'').toLowerCase().includes('γενική'))) || generalSavingsGoals()[0] || null;
}

async function ensureDefaultGeneralSavingsGoal(){
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
  if(!ownerUserId || capvoEnsuringDefaultGeneralSavings)return null;
  const existing=getDefaultGeneralSavingsGoal();
  if(existing)return existing;
  capvoEnsuringDefaultGeneralSavings=true;
  try{
    const id=crypto.randomUUID();
    const payload={
      id,
      user_id:ownerUserId,
      name:'Γενική αποταμίευση',
      icon:'💰',
      target_amount:0,
      current_amount:0,
      target_date:null,
      notes:'Χρήματα στην άκρη, εκτός διαθέσιμου budget.',
      goal_type:'general',
      is_default:true,
      is_archived:false,
      status:'active',
      updated_at:new Date().toISOString()
    };
    const {error}=await supabaseClient.from('savings_goals').insert(payload);
    if(error)throw error;
    await fetchAllData(ownerUserId);
    render();
    return (D.savingsGoals||[]).find(g=>g.id===id)||null;
  }catch(error){
    console.warn('[CAPVO] ensureDefaultGeneralSavingsGoal failed',error);
    return null;
  }finally{
    capvoEnsuringDefaultGeneralSavings=false;
  }
}

// Override: one and only one default general savings wallet.
function renderGeneralSavingsSection(goals){
  const general=getDefaultGeneralSavingsGoal() || goals[0];
  if(!general){
    ensureDefaultGeneralSavingsGoal();
    return `<section class="savings-production-section bento-card savings-general-empty savings-wallet-section">
      <div class="savings-section-head with-action">
        <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Ετοιμάζουμε τον βασικό κουμπαρά σου.</p></div>
      </div>
    </section>`;
  }
  return `<section class="savings-production-section bento-card savings-wallet-section">
    <div class="savings-section-head with-action">
      <div><small>Αποταμίευση</small><h3>Γενική αποταμίευση</h3><p>Ένας βασικός κουμπαράς χωρίς όριο. Μπορείς να αλλάξεις όνομα και εικονίδιο.</p></div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('${esc(general.id)}','general')">Επεξεργασία</button>
    </div>
    <article class="savings-wallet-card is-default-wallet">
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

function openSavingsGoalSheet(goalId,kind='target'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const goalKind=goal.id?savingsGoalKind(goal):kind;
  const isGeneral=goalKind==='general';
  const existingGeneral=getDefaultGeneralSavingsGoal();
  if(isGeneral && !goal.id && existingGeneral){
    openSavingsGoalSheet(existingGeneral.id,'general');
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
          <small>${isGeneral?'Γενική αποταμίευση':'Στόχος'}</small>
          <h2>${isGeneral?'Επεξεργασία αποταμίευσης':goal.id?'Επεξεργασία στόχου':'Νέος στόχος'}</h2>
          <p>${isGeneral?'Ο βασικός κουμπαράς δεν έχει ποσό στόχο και δεν μπορεί να διαγραφεί.':'Οι στόχοι χρειάζονται ποσό στόχο και εμφανίζονται χωριστά από τη γενική αποταμίευση.'}</p>
        </div>
      </div>
      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <input type="hidden" id="savingsGoalKind" value="${esc(goalKind)}">
      <div class="savings-form-stack">
        <label class="full">Όνομα<input id="savingsGoalName" type="text" value="${esc(goal.name||(isGeneral?'Γενική αποταμίευση':''))}" placeholder="${isGeneral?'π.χ. Emergency fund':'π.χ. Ταξίδι Ιαπωνία'}"></label>
        <div class="savings-inline-grid ${isGeneral?'is-general-only':''}">
          <label class="savings-icon-field">Εικονίδιο<input id="savingsGoalIcon" type="text" value="${esc(goal.icon||(isGeneral?'💰':'🎯'))}" maxlength="4" inputmode="text"></label>
          ${isGeneral?'':`<label>Ποσό στόχος<input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00"></label>`}
        </div>
        ${isGeneral?'':`<label class="full">Ημερομηνία στόχου<input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}"></label>`}
        <label class="full">Σημείωση<textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}
  const id=$('savingsGoalId')?.value || crypto.randomUUID();
  const kind=$('savingsGoalKind')?.value||'target';
  const isGeneral=kind==='general';
  const existingGeneral=getDefaultGeneralSavingsGoal();
  if(isGeneral && !($('savingsGoalId')?.value) && existingGeneral){
    showMiniToast('Υπάρχει ήδη γενική αποταμίευση.','error');
    return;
  }
  const name=($('savingsGoalName')?.value||'').trim();
  const target=isGeneral?0:(Number($('savingsGoalTarget')?.value)||0);
  const targetDate=isGeneral?null:($('savingsGoalDate')?.value||null);
  if(!name){showMiniToast('Βάλε όνομα.','error');return;}
  if(!isGeneral && target<=0){showMiniToast('Για στόχο χρειάζεται ποσό στόχος.','error');return;}
  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||(isGeneral?'💰':'🎯')).trim()||(isGeneral?'💰':'🎯'),
    target_amount:target,
    target_date:targetDate,
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:isGeneral?'general':'target',
    is_default:!!isGeneral,
    is_archived:false,
    status:'active',
    updated_at:new Date().toISOString()
  };
  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
  const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
  if(error){console.error('saveSavingsGoal failed',error);showMiniToast('Δεν αποθηκεύτηκε. Τρέξε το SQL του v1.1.6.','error');if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}return;}
  closeSavingsSheet();
  await fetchAllData(ownerUserId); render();
  showMiniToast('✅ Αποθηκεύτηκε');
}

function openSavingsDepositSheet(goalId,mode='deposit'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;
  const isWithdrawal=mode==='withdrawal';
  const isGeneral=savingsGoalKind(goal)==='general';
  const general=getDefaultGeneralSavingsGoal();
  const generalBalance=Number(general?.currentAmount)||0;
  const overlay=ensureSavingsSheet();
  const sourceOptions=!isGeneral && !isWithdrawal?`
    <div class="full savings-source-select">
      <span>Από πού θα τα πάρεις;</span>
      <input type="hidden" id="savingsTxSource" value="manual_from_budget">
      <div class="savings-choice-group">
        <button type="button" class="active" onclick="setSavingsTxSource('manual_from_budget',this)"><strong>Τρέχον budget</strong><small>Μειώνει το διαθέσιμο ποσό.</small></button>
        <button type="button" ${generalBalance<=0?'disabled':''} onclick="setSavingsTxSource('manual_from_general',this)"><strong>Γενική αποταμίευση</strong><small>${general?fmt(generalBalance):fmt(0)} διαθέσιμα</small></button>
      </div>
    </div>`:!isGeneral && isWithdrawal?`
    <div class="full savings-source-select">
      <span>Πού να επιστρέψει;</span>
      <input type="hidden" id="savingsTxSource" value="manual_to_budget">
      <div class="savings-choice-group">
        <button type="button" class="active" onclick="setSavingsTxSource('manual_to_budget',this)"><strong>Τρέχον budget</strong><small>Αυξάνει το διαθέσιμο ποσό.</small></button>
        <button type="button" onclick="setSavingsTxSource('manual_to_general',this)"><strong>Γενική αποταμίευση</strong><small>Μένει εκτός budget.</small></button>
      </div>
    </div>`:`<input type="hidden" id="savingsTxSource" value="${isWithdrawal?'manual_to_budget':'manual_from_budget'}">`;
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🏦')}</span>
        <div>
          <small>${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</small>
          <h2>${esc(goal.name)}</h2>
          <p>${isGeneral?'Η γενική αποταμίευση συνδέεται με το budget.':'Για στόχο διάλεξε αν τα χρήματα έρχονται από budget ή από γενική αποταμίευση.'} Τρέχον ποσό: <strong>${fmt(goal.currentAmount||0)}</strong></p>
        </div>
      </div>
      <input type="hidden" id="savingsTxGoalId" value="${esc(goal.id)}">
      <input type="hidden" id="savingsTxMode" value="${isWithdrawal?'withdrawal':'deposit'}">
      <div class="savings-form-stack compact">
        ${sourceOptions}
        <label class="full">Ποσό<input id="savingsTxAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
        <label class="full">Σημείωση<input id="savingsTxNote" type="text" placeholder="προαιρετικά"></label>
      </div>
      <button type="button" class="savings-primary-btn" onclick="saveSavingsTransactionFromSheet()">${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</button>
    </section>`;
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function insertSavingsTx(ownerUserId,goalId,amount,type,source,note='',relatedCycleKey=''){
  const {error}=await supabaseClient.from('savings_transactions').insert({
    user_id:ownerUserId,goal_id:goalId,amount,type,source,note,related_cycle_key:relatedCycleKey||null
  });
  if(error)throw error;
}
async function updateSavingsGoalAmount(ownerUserId,goal,nextAmount){
  const status=savingsGoalKind(goal)==='target' && Number(goal.targetAmount)>0 && nextAmount>=Number(goal.targetAmount)?'completed':'active';
  const update={current_amount:Math.max(0,nextAmount),status,updated_at:new Date().toISOString()};
  update.completed_at=status==='completed'?new Date().toISOString():null;
  const {error}=await supabaseClient.from('savings_goals').update(update).eq('user_id',ownerUserId).eq('id',goal.id);
  if(error)throw error;
}

async function addSavingsTransaction(goalId,amount,type='deposit',source='manual_from_budget',note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)throw new Error('Missing savings goal');
  const safeAmount=Number(amount)||0;
  if(safeAmount<=0)throw new Error('Invalid savings amount');
  const current=Number(goal.currentAmount)||0;
  const general=getDefaultGeneralSavingsGoal();
  const isGoalGeneral=savingsGoalKind(goal)==='general';

  if(type==='withdrawal' && safeAmount>current){
    const err=new Error('Withdrawal exceeds current amount');
    err.code='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE';
    throw err;
  }

  if(!isGoalGeneral && type==='deposit' && source==='manual_from_general'){
    if(!general || general.id===goal.id){throw new Error('Missing general savings');}
    const generalCurrent=Number(general.currentAmount)||0;
    if(safeAmount>generalCurrent){const err=new Error('General savings insufficient');err.code='CAPVO_GENERAL_SAVINGS_INSUFFICIENT';throw err;}
    await insertSavingsTx(ownerUserId,general.id,-safeAmount,'transfer_out','general_to_goal',`Μεταφορά σε στόχο: ${goal.name}`,'');
    await insertSavingsTx(ownerUserId,goal.id,safeAmount,'transfer_in','general_to_goal',note||`Από γενική αποταμίευση`,'');
    await updateSavingsGoalAmount(ownerUserId,general,generalCurrent-safeAmount);
    await updateSavingsGoalAmount(ownerUserId,goal,current+safeAmount);
    return;
  }

  if(!isGoalGeneral && type==='withdrawal' && source==='manual_to_general'){
    if(!general || general.id===goal.id){throw new Error('Missing general savings');}
    const generalCurrent=Number(general.currentAmount)||0;
    await insertSavingsTx(ownerUserId,goal.id,-safeAmount,'transfer_out','goal_to_general',note||`Μεταφορά στη γενική αποταμίευση`,'');
    await insertSavingsTx(ownerUserId,general.id,safeAmount,'transfer_in','goal_to_general',`Από στόχο: ${goal.name}`,'');
    await updateSavingsGoalAmount(ownerUserId,goal,current-safeAmount);
    await updateSavingsGoalAmount(ownerUserId,general,generalCurrent+safeAmount);
    return;
  }

  const signed=type==='withdrawal'?-safeAmount:safeAmount;
  await insertSavingsTx(ownerUserId,goal.id,signed,type,source,note,relatedCycleKey);
  await updateSavingsGoalAmount(ownerUserId,goal,current+signed);
}

async function saveSavingsTransactionFromSheet(){
  const goalId=$('savingsTxGoalId')?.value;
  const mode=$('savingsTxMode')?.value||'deposit';
  const amount=Number($('savingsTxAmount')?.value)||0;
  const note=($('savingsTxNote')?.value||'').trim();
  const source=$('savingsTxSource')?.value || (mode==='withdrawal'?'manual_to_budget':'manual_from_budget');
  if(amount<=0){showMiniToast('Βάλε ποσό.','error');return;}
  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}
  try{
    await addSavingsTransaction(goalId,amount,mode,source,note,'');
    closeSavingsSheet();
    await fetchAllData(getFinanceUserId?.() || getDataOwnerId?.()); render();
    showMiniToast(mode==='withdrawal'?'✅ Το ποσό αφαιρέθηκε':'✅ Το ποσό προστέθηκε');
  }catch(error){
    console.error('saveSavingsTransaction failed',error);
    const msg=error?.code==='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE'
      ?'Δεν μπορείς να αφαιρέσεις περισσότερα από όσα έχει ο κουμπαράς.'
      :error?.code==='CAPVO_GENERAL_SAVINGS_INSUFFICIENT'
        ?'Δεν υπάρχει αρκετό ποσό στη Γενική αποταμίευση.'
        :'Δεν αποθηκεύτηκε η κίνηση.';
    showMiniToast(msg,'error');
    if(btn){btn.disabled=false;btn.textContent=mode==='withdrawal'?'Αφαίρεση ποσού':'Προσθήκη ποσού';}
  }
}

function savingsBudgetImpactTotal(){
  const current=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=current?.startKey||'';
  const endKey=current?.endKey||'';
  let impact=0;
  (D.savingsTransactions||[]).forEach(t=>{
    const day=(t.createdAt||'').slice(0,10);
    if(!day || (startKey && day<startKey) || (endKey && day>endKey))return;
    const amount=Number(t.amount)||0;
    const source=(t.source||'').toLowerCase();
    if(source==='manual_from_budget')impact+=Math.abs(amount);
    if(source==='manual_to_budget')impact-=Math.abs(amount);
  });
  return impact;
}

function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;
  const goals=activeSavingsGoals();
  const general=generalSavingsGoals();
  if(!getDefaultGeneralSavingsGoal())ensureDefaultGeneralSavingsGoal();
  const targets=targetSavingsGoals();
  const archived=archivedSavingsGoals();
  const total=savingsGoalsTotal();
  const stats=savingsCycleStats();
  const targetTotal=targets.reduce((s,g)=>s+(Number(g.targetAmount)||0),0);
  const targetCurrent=targets.reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
  const pct=targetTotal>0?Math.min(100,Math.round(targetCurrent/targetTotal*100)):0;
  summary.innerHTML=renderSavingsSummaryCards(goals,total,stats,targetTotal,pct);
  list.innerHTML=`
    ${renderGeneralSavingsSection(general)}
    ${renderTargetSavingsSection(targets)}
    ${renderArchivedSavingsSection(archived)}
  `;
}

function openCarryoverSavingsGoalSheet(){
  const pending=typeof getPendingCycleCarryover==='function'?getPendingCycleCarryover():null;
  if(!pending){showMiniToast('Δεν υπάρχει εκκρεμές υπόλοιπο.','info');return;}
  const general=getDefaultGeneralSavingsGoal();
  const targets=targetSavingsGoals();
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>🔒</span>
        <div>
          <small>Μεταφορά υπολοίπου</small>
          <h2>Πού θέλεις να μπει;</h2>
          <p>Θα μεταφερθούν <strong>${fmt(pending.amount)}</strong> από τον κύκλο ${esc(pending.previous.label)}.</p>
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Αποταμίευση</small>
        <div class="savings-carryover-goals">
          ${general?`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(general.id)}')"><span>${esc(general.icon||'💰')}</span><strong>${esc(general.name)}</strong><small>${fmt(general.currentAmount||0)} στην άκρη</small></button>`:`<button type="button" onclick="createDefaultGoalAndApplyCarryover()"><span>💰</span><strong>Γενική αποταμίευση</strong><small>Δημιουργία και μεταφορά</small></button>`}
        </div>
      </div>
      <div class="savings-carryover-block">
        <small>Στόχοι</small>
        <div class="savings-carryover-goals">
          ${targets.length?targets.map(g=>`<button type="button" onclick="applyCarryoverToSavingsGoal('${esc(g.id)}')"><span>${esc(g.icon||'🎯')}</span><strong>${esc(g.name)}</strong><small>${fmt(g.currentAmount||0)} / ${fmt(g.targetAmount||0)}</small></button>`).join(''):`<div class="savings-mini-empty">Δεν έχεις ακόμα στόχο.</div>`}
        </div>
      </div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  closeCycleCarryoverSheet?.();
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function createDefaultGoalAndApplyCarryover(){
  await ensureDefaultGeneralSavingsGoal();
  const general=getDefaultGeneralSavingsGoal();
  if(general)await applyCarryoverToSavingsGoal(general.id);
}

async function recordIncomeAllocation(incomeSourceId,sourceName,totalAmount,destinationType,destinationId,amount,note=''){
  try{
    const ownerUserId=getFinanceUserId?.() || getDataOwnerId?.();
    if(!ownerUserId)return;
    await supabaseClient.from('income_allocations').insert({
      user_id:ownerUserId,
      income_source_id:incomeSourceId||null,
      source_name:sourceName||'Έκτακτο εισόδημα',
      total_amount:Number(totalAmount)||Number(amount)||0,
      destination_type:destinationType,
      destination_id:destinationId||null,
      amount:Number(amount)||0,
      note:note||null
    });
  }catch(error){
    console.warn('[CAPVO] income allocation history unavailable. Run v1.1.6 SQL migration.',error?.message||error);
  }
}

const capvoV116BaseSaveIncomeSource = window.saveIncomeSource || saveIncomeSource;
async function saveExtraIncomeToBudget(obj,userId){
  await saveIncomeSourceRow(userId,obj);
  if(!D.incomeSources)D.incomeSources=[];
  D.incomeSources.push(obj);
  refreshComputedIncome();
  await recordIncomeAllocation(obj.id,obj.name,obj.amount,'budget',null,obj.amount,'Όλο στο budget');
}

function openExtraIncomeAllocationSheet(obj,userId){
  const general=getDefaultGeneralSavingsGoal();
  const targets=targetSavingsGoals();
  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet income-allocation-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>✨</span>
        <div>
          <small>Έκτακτο εισόδημα</small>
          <h2>Πού θέλεις να πάνε τα ${fmt(obj.amount)};</h2>
          <p>${esc(obj.name)} · διάλεξε αν θα μπουν στο budget, στην αποταμίευση ή σε στόχο.</p>
        </div>
      </div>
      <div class="income-allocation-actions">
        <button type="button" onclick="applyExtraIncomeAllocation('budget')"><strong>Όλο στο budget</strong><small>Αυξάνει το διαθέσιμο ποσό του κύκλου.</small></button>
        <button type="button" onclick="applyExtraIncomeAllocation('general')"><strong>Όλο στη γενική αποταμίευση</strong><small>Δεν αυξάνει το διαθέσιμο budget.</small></button>
        ${targets.length?`<label class="income-allocation-select"><span>Σε στόχο</span><select id="extraIncomeTargetId">${targets.map(g=>`<option value="${esc(g.id)}">${esc(g.name)} · ${fmt(g.currentAmount||0)} / ${fmt(g.targetAmount||0)}</option>`).join('')}</select><button type="button" onclick="applyExtraIncomeAllocation('target')">Μεταφορά σε στόχο</button></label>`:`<button type="button" onclick="openSavingsGoalSheet('', 'target')"><strong>+ Δημιουργία στόχου</strong><small>Φτιάξε στόχο και μετά κάνε την κατανομή.</small></button>`}
        <div class="income-allocation-split">
          <strong>Μοίρασμα</strong>
          <label>Budget<input id="allocBudgetAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
          <label>Γενική αποταμίευση<input id="allocGeneralAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
          ${targets.length?`<label>Στόχος<select id="allocTargetId"><option value="">Κανένας</option>${targets.map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><label>Ποσό στόχου<input id="allocTargetAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>`:''}
          <button type="button" class="savings-primary-btn" onclick="applyExtraIncomeAllocation('split')">Αποθήκευση μοιράσματος</button>
        </div>
      </div>
    </section>`;
  window.__capvoPendingExtraIncome={obj,userId};
  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function applyExtraIncomeAllocation(mode){
  const pending=window.__capvoPendingExtraIncome;
  if(!pending)return;
  const {obj,userId}=pending;
  const btn=document.querySelector('#savingsSheetOverlay button');
  try{
    if(mode==='budget'){
      await saveExtraIncomeToBudget({...obj,includeInBudget:true,isSavings:false,restriction:'none'},userId);
    }else if(mode==='general'){
      let general=getDefaultGeneralSavingsGoal() || await ensureDefaultGeneralSavingsGoal();
      await addSavingsTransaction(general.id,obj.amount,'deposit','bonus_allocation',`Bonus: ${obj.name}`,'');
      await recordIncomeAllocation(null,obj.name,obj.amount,'general_savings',general.id,obj.amount,'Όλο στη γενική αποταμίευση');
    }else if(mode==='target'){
      const targetId=$('extraIncomeTargetId')?.value;
      if(!targetId){showMiniToast('Διάλεξε στόχο.','error');return;}
      await addSavingsTransaction(targetId,obj.amount,'deposit','bonus_allocation',`Bonus: ${obj.name}`,'');
      await recordIncomeAllocation(null,obj.name,obj.amount,'savings_goal',targetId,obj.amount,'Όλο σε στόχο');
    }else if(mode==='split'){
      const budgetAmt=Number($('allocBudgetAmount')?.value)||0;
      const generalAmt=Number($('allocGeneralAmount')?.value)||0;
      const targetId=$('allocTargetId')?.value||'';
      const targetAmt=Number($('allocTargetAmount')?.value)||0;
      const total=budgetAmt+generalAmt+targetAmt;
      if(total<=0){showMiniToast('Βάλε ποσό για κατανομή.','error');return;}
      if(Math.round(total*100)>Math.round(Number(obj.amount)*100)){showMiniToast('Δεν μπορείς να κατανείμεις περισσότερα από το bonus.','error');return;}
      if(Math.round(total*100)<Math.round(Number(obj.amount)*100)){showMiniToast('Δεν έχει κατανεμηθεί όλο το ποσό.','error');return;}
      if(budgetAmt>0){
        await saveExtraIncomeToBudget({...obj,id:gid(),amount:budgetAmt,name:obj.name+' · Budget',includeInBudget:true,isSavings:false,restriction:'none'},userId);
      }
      if(generalAmt>0){
        let general=getDefaultGeneralSavingsGoal() || await ensureDefaultGeneralSavingsGoal();
        await addSavingsTransaction(general.id,generalAmt,'deposit','bonus_allocation',`Bonus: ${obj.name}`,'');
        await recordIncomeAllocation(null,obj.name,obj.amount,'general_savings',general.id,generalAmt,'Μοίρασμα bonus');
      }
      if(targetAmt>0){
        if(!targetId){showMiniToast('Διάλεξε στόχο για το ποσό στόχου.','error');return;}
        await addSavingsTransaction(targetId,targetAmt,'deposit','bonus_allocation',`Bonus: ${obj.name}`,'');
        await recordIncomeAllocation(null,obj.name,obj.amount,'savings_goal',targetId,targetAmt,'Μοίρασμα bonus');
      }
    }
    closeSavingsSheet(); closeM?.();
    window.__capvoPendingExtraIncome=null;
    await fetchAllData(userId); render();
    showMiniToast('✅ Το έκτακτο εισόδημα κατανεμήθηκε');
  }catch(error){
    console.error('applyExtraIncomeAllocation failed',error);
    showMiniToast('Δεν έγινε η κατανομή. Έλεγξε το SQL του v1.1.6.','error');
  }
}

window.saveIncomeSource = async function saveIncomeSource(){
  const mode=getCurrentIncomeWizardMode?.() || '';
  const id=$('fISID')?.value;
  if(mode!=='extra' || id){
    return capvoV116BaseSaveIncomeSource();
  }
  const validation=validateIncomeSourceForm();
  if(!validation)return;
  const userId=getDataOwnerId();
  if(!userId){showMiniToast('❌ Δεν υπάρχει ενεργή σύνδεση Google','error');return;}
  const obj={
    id:gid(),
    name:validation.name,
    amount:validation.amount,
    category:$('fISCategory').value || 'Bonus',
    incomeType:validation.incomeType,
    includeInBudget:false,
    isSavings:false,
    isRecurring:false,
    restriction:'none',
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim(),
    isPrimaryIncome:false
  };
  await ensureDefaultGeneralSavingsGoal();
  openExtraIncomeAllocationSheet(obj,userId);
};
