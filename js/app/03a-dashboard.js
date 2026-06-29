// CAPVO app split: 03a-dashboard.js
// Dashboard: render(), greeting, action center, fixed calendar, allowance
// Source: 03-render-dashboard-transactions-income.js lines 1-1042

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
    sub.textContent=`Η μηνιαία περίοδος ${cycle.label} είναι ενημερωμένη.`;
  }
}

// ===== MAIN RENDER =====
function render(){
  refreshComputedIncome();

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const dlS=dailyTotal();
  const cashDaily=dailyCashTotal();

  // Balance formula and dashboard usage display are intentionally separated.
  // In the wallet model, wallet balances are already reduced by actual payments/expenses,
  // so fixedTotal/ccPayTotal/dailyCashTotal can be 0 to avoid double-subtracting.
  // The hero usage panel, however, must still show the real actual movements of the cycle.
  const formulaTot=capvoMoney(fxS+ccS+cashDaily);
  const bal=capvoMoney(D.income-formulaTot);

  const snapshotTotals=typeof capvoDashboardSnapshotTotals==='function'
    ? capvoDashboardSnapshotTotals()
    : {fixed:fxS,cards:ccS,daily:cashDaily};
  const usageSpent=capvoMoney((Number(snapshotTotals.fixed)||0)+(Number(snapshotTotals.cards)||0)+(Number(snapshotTotals.daily)||0));
  const isWalletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  const cycleBase=capvoMoney(typeof totalCycleAmount==='function'?totalCycleAmount():0);
  const usageBase=capvoMoney(isWalletModel
    ? Math.max(cycleBase||0, (Number(D.income)||0)+usageSpent, Number(D.income)||0)
    : Math.max(Number(D.income)||0, usageSpent));
  const pct=usageBase>0?Math.min(100,Math.round(usageSpent/usageBase*100)):0;
  const cycle=getCurrentBudgetCycle();

  $('mLabel').textContent=cycle.label;
  const eyebrow=document.querySelector('.modern-hero-card .eyebrow');
  if(eyebrow)eyebrow.textContent='Υπόλοιπο μήνα';
  const heroCaption=document.querySelector('.modern-hero-caption');
  if(heroCaption)heroCaption.textContent=`Τρέχουσα μηνιαία περίοδος: ${cycle.label}.`;
  renderDashboardGreeting();
  $('dIncome').textContent=fmt(usageBase);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  const heroCard=document.querySelector('.modern-hero-card');
  if(heroCard)heroCard.style.setProperty('--capvo-hero-pct', pct+'%');
  $('dSpent').textContent=fmt(usageSpent)+' / '+fmt(usageBase);
  renderDashboardAllowanceCards(bal);
  renderFirstUseBudgetPrompt();

  $('sFixed').textContent=fmt(snapshotTotals.fixed);
  $('sCC').textContent=fmt(snapshotTotals.cards);
  $('sDaily').textContent=fmt(snapshotTotals.daily);
  renderDashboardAdvisorSnapshot(pct,bal);

  renderFixedList();
  renderCapvoActionCenterBadge();
  renderDailyList();
  renderDashboardPreview();
  renderMobileCategoryInsights();
  if(typeof renderQuickRepeatChips==='function') renderQuickRepeatChips();
  if(typeof renderWalletCards==='function') renderWalletCards();
  if($('incomeList')) renderIncomePage();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof renderSavingsPage==='function') renderSavingsPage();
  if(typeof rAdv==='function') rAdv();
  renderSettingsPage();
}



function renderDashboardAdvisorSnapshot(pct,bal){
  const valueEl=$('sAdvisor');
  const iconEl=$('sAdvisorIcon');
  const labelEl=valueEl?.parentElement?.querySelector?.('.stat-label');
  if(!valueEl)return;

  let label='OK';
  let tone='teal';
  let icon='✅';
  let summary='Advisor';

  // v1.8.6.6: the dashboard Advisor badge follows the same production
  // model as the full Advisor page. It is based on budget-impact movements,
  // cards, savings and current budget cycle, not raw monthly expenses.
  if(typeof capvoAdvisorBuildModel==='function' && typeof capvoAdvisorDashboardStatus==='function'){
    try{
      const model=capvoAdvisorBuildModel();
      const status=capvoAdvisorDashboardStatus(model);
      label=status.label||label;
      tone=status.tone||tone;
      icon=status.icon||icon;
      summary=status.summary||summary;
    }catch(_){
      // Fall back to the old lightweight status below.
      if(D.income<=0){label='Setup';tone='amber';icon='💡';}
      else if(bal<0 || pct>100){label='Υπέρβαση';tone='red';icon='🚨';}
      else if(pct>=70){label='Προσοχή';tone='amber';icon='⚠️';}
    }
  }else{
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
  }

  valueEl.textContent=label;
  valueEl.className='stat-value '+tone;
  valueEl.title=summary;
  if(labelEl)labelEl.textContent=summary;
  if(iconEl)iconEl.textContent=icon;
}


function capvoActionCenterDaysUntil(dateKey){
  const today=capvoParseDateKey(todayISO());
  const target=capvoParseDateKey(dateKey);
  if(!today || !target)return 9999;
  return Math.round((target-today)/(1000*60*60*24));
}

function capvoActionCenterFixedItems({includeUpcoming=false}={}){
  return (D.fixedExpenses||[])
    .map(expense=>{
      const status=typeof capvoFixedExpenseStatus==='function'
        ? capvoFixedExpenseStatus(expense)
        : {state:'upcoming',label:'Προσεχώς',tone:'slate',nextDueDate:expense.nextDueDate||''};
      const days=capvoActionCenterDaysUntil(status.nextDueDate);
      const wallet=expense.sourceWalletId && typeof capvoWalletById==='function'
        ? capvoWalletById(expense.sourceWalletId)
        : null;
      return {type:'fixed',expense,status,days,wallet};
    })
    .filter(row=>{
      if(!row.expense || !row.status?.nextDueDate)return false;
      if(row.status.state==='overdue' || row.status.state==='due')return true;
      return includeUpcoming && row.status.state==='upcoming' && row.days>=0 && row.days<=7;
    })
    .sort((a,b)=>{
      const priority={overdue:0,due:1,upcoming:2,paid:9};
      return (priority[a.status.state]??5)-(priority[b.status.state]??5) ||
        String(a.status.nextDueDate).localeCompare(String(b.status.nextDueDate)) ||
        String(a.expense.name||'').localeCompare(String(b.expense.name||''));
    });
}

function capvoActionCenterUrgentCount(){
  return capvoActionCenterFixedItems({includeUpcoming:false}).length;
}

function renderCapvoActionCenterBadge(){
  const btn=$('capvoActionCenterBtn');
  const badge=$('capvoActionCenterBadge');
  if(!btn || !badge)return;

  // v1.9.6.9: hard-lock the bell position because older CSS/cache rules
  // have repeatedly overridden the placement. Keep it top-right inside the hero.
  btn.style.setProperty('position','absolute','important');
  btn.style.setProperty('top','18px','important');
  btn.style.setProperty('right','18px','important');
  btn.style.setProperty('left','auto','important');
  btn.style.setProperty('bottom','auto','important');
  btn.style.setProperty('width','42px','important');
  btn.style.setProperty('height','42px','important');
  btn.style.setProperty('border-radius','16px','important');

  const count=capvoActionCenterUrgentCount();
  btn.classList.toggle('has-alerts',count>0);
  badge.textContent=String(Math.min(count,99));
  badge.style.display=count>0?'':'none';
  btn.title=count>0
    ? `${count} εκκρεμείς ενέργειες`
    : 'Κέντρο ενεργειών';
}

function openCapvoActionCenter(){
  renderCapvoActionCenterSheet();
  const overlay=$('capvoActionCenterOverlay');
  if(!overlay)return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden','false');
  document.body.classList.add('sheet-open');
}

function closeCapvoActionCenter(){
  const overlay=$('capvoActionCenterOverlay');
  if(!overlay)return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden','true');
  document.body.classList.remove('sheet-open');
}

function renderCapvoActionCenterSheet(){
  const list=$('capvoActionCenterList');
  const meta=$('capvoActionCenterMeta');
  if(!list || !meta)return;

  const urgent=capvoActionCenterFixedItems({includeUpcoming:false});
  const upcoming=capvoActionCenterFixedItems({includeUpcoming:true})
    .filter(row=>row.status.state==='upcoming')
    .slice(0,3);

  const totalUrgent=capvoMoney(urgent.reduce((s,row)=>s+(Number(row.expense.amount)||0),0));
  meta.textContent=urgent.length
    ? `${urgent.length} εκκρεμείς πληρωμές · ${fmt(totalUrgent)}`
    : upcoming.length
      ? `${upcoming.length} επερχόμενες πληρωμές`
      : 'Δεν έχεις εκκρεμείς πληρωμές αυτή τη στιγμή.';

  if(urgent.length===0 && upcoming.length===0){
    list.innerHTML=`
      <div class="capvo-action-center-empty">
        <div>✅</div>
        <strong>Όλα καλά</strong>
        <p>Δεν υπάρχουν πάγια που χρειάζονται άμεση ενέργεια.</p>
      </div>`;
    return;
  }

  const section=(title,rows,kind)=>rows.length?`
    <div class="capvo-action-center-section ${kind}">
      <h4>${esc(title)}</h4>
      ${rows.map(row=>capvoActionCenterFixedRow(row)).join('')}
    </div>`:'';

  list.innerHTML=[
    section('Χρειάζονται ενέργεια',urgent,'urgent'),
    section('Έρχονται σύντομα',upcoming,'upcoming')
  ].join('');
}

function capvoActionCenterFixedRow(row){
  const {expense,status,days,wallet}=row;
  const state=status.state;
  const isPayable=state==='overdue' || state==='due';
  const dateLabel=formatGreekFullDate(status.nextDueDate);
  const whenLabel=state==='overdue'
    ? `Έπρεπε ${dateLabel}`
    : state==='due'
      ? 'Σήμερα'
      : days===1
        ? 'Αύριο'
        : `Σε ${days} ημέρες`;

  return `
    <article class="capvo-action-item ${esc(state)}">
      <div class="capvo-action-item-icon">${state==='overdue'?'⚠️':state==='due'?'📌':'🗓️'}</div>
      <div class="capvo-action-item-copy">
        <strong>${esc(expense.name||'Πάγιο')}</strong>
        <span>${esc(whenLabel)} · ${esc(expense.category||'Άλλο')}${wallet?` · ${esc(wallet.name)}`:''}</span>
      </div>
      <div class="capvo-action-item-side">
        <strong>${fmt(expense.amount)}</strong>
        ${isPayable?`
          <button type="button" onclick="capvoActionCenterPayFixed('${expense.id}')">
            Πληρώθηκε
          </button>`:''}
      </div>
    </article>`;
}

async function capvoActionCenterPayFixed(fixedExpenseId){
  await capvoPayFixedExpense(fixedExpenseId);
  renderCapvoActionCenterBadge();
  renderCapvoActionCenterSheet();
}

document.addEventListener('click',event=>{
  const overlay=$('capvoActionCenterOverlay');
  if(overlay && event.target===overlay)closeCapvoActionCenter();
});



let capvoFixedCalendarMonthKey='';
let capvoFixedCalendarSelectedDateKey='';
let capvoFixedAllExpanded=false;

function capvoFixedCalendarJs(value){
  return String(value??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}

function capvoFixedCalendarMonthDate(monthKey){
  const today=capvoParseDateKey(todayISO())||new Date();
  const raw=String(monthKey||'').slice(0,7);
  if(/^\d{4}-\d{2}$/.test(raw)){
    const [y,m]=raw.split('-').map(Number);
    return new Date(y,m-1,1,12);
  }
  return new Date(today.getFullYear(),today.getMonth(),1,12);
}

function capvoFixedCalendarMonthKeyFromDate(date){
  const d=date instanceof Date && !Number.isNaN(date.getTime())?date:capvoFixedCalendarMonthDate('');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function capvoFixedCalendarMonthLabel(monthKey){
  const d=capvoFixedCalendarMonthDate(monthKey);
  return `${MG[d.getMonth()]||''} ${d.getFullYear()}`;
}

function capvoFixedCalendarSelectedLabel(dateKey){
  const d=capvoParseDateKey(dateKey);
  if(!d)return 'Επιλεγμένη ημέρα';
  const today=todayISO();
  if(dateKey===today)return `Σήμερα, ${formatGreekDayMonth(dateKey)}`;
  return `${DG[d.getDay()]||''}, ${formatGreekDayMonth(dateKey)}`;
}

function capvoFixedCalendarEnsureState(rows=[]){
  const today=todayISO();
  const todayMonth=today.slice(0,7);
  if(!capvoFixedCalendarMonthKey)capvoFixedCalendarMonthKey=todayMonth;
  const selected=String(capvoFixedCalendarSelectedDateKey||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(selected) || selected.slice(0,7)!==capvoFixedCalendarMonthKey){
    const firstDue=(rows||[]).map(r=>r.dueDate).filter(Boolean).sort()[0];
    capvoFixedCalendarSelectedDateKey=capvoFixedCalendarMonthKey===todayMonth
      ? today
      : (firstDue || `${capvoFixedCalendarMonthKey}-01`);
  }
}

function capvoFixedCalendarChangeMonth(delta){
  const base=capvoFixedCalendarMonthDate(capvoFixedCalendarMonthKey);
  const next=new Date(base.getFullYear(),base.getMonth()+Number(delta||0),1,12);
  capvoFixedCalendarMonthKey=capvoFixedCalendarMonthKeyFromDate(next);
  capvoFixedCalendarSelectedDateKey='';
  renderFixedList();
}

function capvoFixedCalendarToday(){
  capvoFixedCalendarMonthKey=todayISO().slice(0,7);
  capvoFixedCalendarSelectedDateKey=todayISO();
  renderFixedList();
}

function capvoFixedCalendarSelect(dateKey){
  const key=String(dateKey||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return;
  capvoFixedCalendarMonthKey=key.slice(0,7);
  capvoFixedCalendarSelectedDateKey=key;
  renderFixedList();
}

function capvoFixedCalendarStatusForDueDate(expense,dueDate){
  const payment=typeof capvoFixedExpensePaymentForDueDate==='function'
    ? capvoFixedExpensePaymentForDueDate(expense?.id,dueDate)
    : null;
  if(payment)return {state:'paid',label:'Πληρώθηκε',tone:'green',nextDueDate:dueDate,payment};
  const today=todayISO();
  if(String(dueDate)<today)return {state:'overdue',label:'Εκκρεμεί',tone:'orange',nextDueDate:dueDate,payment:null};
  if(String(dueDate)===today)return {state:'due',label:'Σήμερα',tone:'purple',nextDueDate:dueDate,payment:null};
  return {state:'upcoming',label:'Προσεχώς',tone:'slate',nextDueDate:dueDate,payment:null};
}

function capvoFixedCalendarExpenseActiveOn(expense,dateKey){
  const effective=String(expense?.effectiveFromDate||expense?.effective_from_date||'').slice(0,10);
  if(effective && String(dateKey)<effective)return false;
  return true;
}

function capvoFixedCalendarOccurrenceDates(expense,monthDate){
  const year=monthDate.getFullYear();
  const month=monthDate.getMonth();
  const start=new Date(year,month,1,12);
  const end=new Date(year,month,capvoDaysInMonth(year,month),12);
  const type=typeof capvoFixedExpenseScheduleType==='function'?capvoFixedExpenseScheduleType(expense):(expense?.scheduleType||'monthly');
  const dueDay=typeof capvoFixedExpenseDueDay==='function'?capvoFixedExpenseDueDay(expense):(Number(expense?.dueDay)||1);
  const nextDue=String(expense?.nextDueDate||expense?.next_due_date||'').slice(0,10);
  const dates=[];

  if(type==='weekly'){
    let base=capvoParseDateKey(nextDue)||new Date(year,month,Math.min(dueDay,capvoDaysInMonth(year,month)),12);
    while(base>end)base=new Date(base.getFullYear(),base.getMonth(),base.getDate()-7,12);
    while(base<start)base=new Date(base.getFullYear(),base.getMonth(),base.getDate()+7,12);
    while(base<=end){
      const key=capvoLocalDateKey(base);
      if(capvoFixedCalendarExpenseActiveOn(expense,key))dates.push(key);
      base=new Date(base.getFullYear(),base.getMonth(),base.getDate()+7,12);
    }
    return dates;
  }

  if(type==='yearly'){
    if(nextDue){
      const d=capvoParseDateKey(nextDue);
      if(d && d.getMonth()===month){
        const key=capvoDateKeyFromParts(year,month,Math.min(d.getDate(),capvoDaysInMonth(year,month)));
        if(capvoFixedCalendarExpenseActiveOn(expense,key))dates.push(key);
      }
      return dates;
    }
  }

  if(type==='custom'){
    if(nextDue && nextDue.slice(0,7)===capvoFixedCalendarMonthKeyFromDate(monthDate) && capvoFixedCalendarExpenseActiveOn(expense,nextDue))dates.push(nextDue);
    return dates;
  }

  const key=capvoDateKeyFromParts(year,month,Math.min(dueDay,capvoDaysInMonth(year,month)));
  if(capvoFixedCalendarExpenseActiveOn(expense,key))dates.push(key);
  return dates;
}

function capvoFixedCalendarRowsForMonth(monthKey){
  const monthDate=capvoFixedCalendarMonthDate(monthKey);
  const keyPrefix=String(monthKey||capvoFixedCalendarMonthKeyFromDate(monthDate));
  const activeExpenses=(D.fixedExpenses||[]);
  const rows=activeExpenses.flatMap(expense=>capvoFixedCalendarOccurrenceDates(expense,monthDate).map(dueDate=>{
    const status=capvoFixedCalendarStatusForDueDate(expense,dueDate);
    const wallet=expense.sourceWalletId && typeof capvoWalletById==='function'?capvoWalletById(expense.sourceWalletId):null;
    return {expense,dueDate,status,wallet,payment:status.payment||null};
  }));

  // Also place real paid fixed-payment rows on the month calendar. This lets
  // the current month show what already happened even after the fixed expense
  // has advanced to its next due date. It is visual/history only and does not
  // create or change payments.
  const seen=new Set(rows.map(row=>`${String(row.expense?.id||'')}|${String(row.dueDate||'').slice(0,10)}`));
  (D.fixedExpensePayments||[])
    .filter(p=>typeof capvoFixedExpensePaymentIsCountable==='function' ? capvoFixedExpensePaymentIsCountable(p) : String(p.status||'paid')!=='reversed')
    .forEach(payment=>{
      const dueDate=String(payment.paidForDate||payment.paid_for_date||payment.paidAt||payment.paid_at||'').slice(0,10);
      if(!dueDate || dueDate.slice(0,7)!==keyPrefix)return;
      const expenseId=payment.fixedExpenseId||payment.fixed_expense_id;
      const duplicateKey=`${String(expenseId||'')}|${dueDate}`;
      if(seen.has(duplicateKey))return;
      const expense=activeExpenses.find(e=>String(e.id)===String(expenseId));
      if(!expense)return;
      const wallet=(payment.walletId||payment.wallet_id) && typeof capvoWalletById==='function'
        ? capvoWalletById(payment.walletId||payment.wallet_id)
        : (expense.sourceWalletId && typeof capvoWalletById==='function'?capvoWalletById(expense.sourceWalletId):null);
      rows.push({
        expense,
        dueDate,
        status:{state:'paid',label:'Πληρώθηκε',tone:'green',nextDueDate:dueDate,payment},
        wallet,
        payment
      });
      seen.add(duplicateKey);
    });

  return rows.sort(capvoFixedCalendarSortRows);
}

function capvoFixedCalendarCurrentRows(){
  return (D.fixedExpenses||[])
    .map(expense=>{
      const rawStatus=typeof capvoFixedExpenseStatus==='function'?capvoFixedExpenseStatus(expense):null;
      const dueDate=rawStatus?.nextDueDate||capvoFixedExpenseNextDueDate?.(expense)||expense.nextDueDate||todayISO();
      const status=capvoFixedCalendarStatusForDueDate(expense,dueDate);
      const wallet=expense.sourceWalletId && typeof capvoWalletById==='function'?capvoWalletById(expense.sourceWalletId):null;
      return {expense,dueDate,status,wallet,payment:status.payment||null};
    })
    .filter(row=>row.dueDate)
    .sort(capvoFixedCalendarSortRows);
}

function capvoFixedCalendarRecentPayments(limit=5){
  return (D.fixedExpensePayments||[])
    .filter(p=>typeof capvoFixedExpensePaymentIsCountable==='function' ? capvoFixedExpensePaymentIsCountable(p) : String(p.status||'paid')!=='reversed')
    .map(payment=>{
      const expense=typeof capvoFixedExpensePaymentExpense==='function'
        ? capvoFixedExpensePaymentExpense(payment)
        : (typeof capvoFixedExpenseById==='function'
          ? capvoFixedExpenseById(payment.fixedExpenseId||payment.fixed_expense_id)
          : (D.fixedExpenses||[]).find(e=>String(e.id)===String(payment.fixedExpenseId||payment.fixed_expense_id)));
      const wallet=payment.walletId && typeof capvoWalletById==='function'?capvoWalletById(payment.walletId):null;
      return {payment,expense,wallet,dueDate:String(payment.paidForDate||payment.paid_for_date||payment.paidAt||payment.paid_at||'').slice(0,10)};
    })
    .sort((a,b)=>String(b.payment.paidAt||b.payment.paid_at||b.payment.createdAt||b.payment.created_at||'').localeCompare(String(a.payment.paidAt||a.payment.paid_at||a.payment.createdAt||a.payment.created_at||'')))
    .slice(0,limit);
}

function capvoFixedCalendarSortRows(a,b){
  const priority={overdue:0,due:1,upcoming:2,paid:3};
  return String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31')) ||
    (priority[a.status?.state]??5)-(priority[b.status?.state]??5) ||
    String(a.expense?.name||'').localeCompare(String(b.expense?.name||''));
}

function capvoFixedCalendarGroupByDate(rows){
  return (rows||[]).reduce((acc,row)=>{
    if(!acc[row.dueDate])acc[row.dueDate]=[];
    acc[row.dueDate].push(row);
    return acc;
  },{});
}

function capvoFixedCalendarDayTone(rows){
  if(rows.some(r=>r.status?.state==='overdue'))return 'overdue';
  if(rows.some(r=>r.status?.state==='due'))return 'due';
  if(rows.every(r=>r.status?.state==='paid'))return 'paid';
  return 'upcoming';
}

function capvoRenderFixedCalendar(rows){
  const monthDate=capvoFixedCalendarMonthDate(capvoFixedCalendarMonthKey);
  const year=monthDate.getFullYear();
  const month=monthDate.getMonth();
  const days=capvoDaysInMonth(year,month);
  const first=new Date(year,month,1,12);
  const leading=(first.getDay()+6)%7; // Monday-first calendar.
  const byDate=capvoFixedCalendarGroupByDate(rows);
  const today=todayISO();
  const selected=capvoFixedCalendarSelectedDateKey;
  const weekdays=['Δ','Τ','Τ','Π','Π','Σ','Κ'];
  let cells='';

  for(let i=0;i<leading;i++)cells+='<div class="fixed-calendar-day is-empty"></div>';
  for(let day=1;day<=days;day++){
    const key=capvoDateKeyFromParts(year,month,day);
    const dayRows=byDate[key]||[];
    const tone=dayRows.length?capvoFixedCalendarDayTone(dayRows):'';
    const total=capvoMoney(dayRows.reduce((s,row)=>s+(Number(row.expense?.amount)||0),0));
    cells+=`
      <button type="button" class="fixed-calendar-day ${dayRows.length?'has-items':''} ${key===today?'is-today':''} ${key===selected?'is-selected':''} ${tone?`tone-${tone}`:''}" onclick="capvoFixedCalendarSelect('${key}')">
        <span class="fixed-calendar-date">${day}</span>
        ${dayRows.length?`
          <span class="fixed-calendar-dots">${dayRows.slice(0,3).map(row=>`<i class="tone-${esc(row.status?.state||'upcoming')}"></i>`).join('')}</span>
          <span class="fixed-calendar-day-meta">${dayRows.length>1?`${dayRows.length} πάγια`:fmt(total)}</span>
        `:''}
      </button>`;
  }

  return `
    <section class="fixed-calendar-card">
      <div class="fixed-calendar-topbar">
        <button type="button" class="fixed-calendar-nav" onclick="capvoFixedCalendarChangeMonth(-1)" aria-label="Προηγούμενος μήνας">‹</button>
        <div class="fixed-calendar-title-wrap">
          <strong>${esc(capvoFixedCalendarMonthLabel(capvoFixedCalendarMonthKey))}</strong>
          <button type="button" onclick="capvoFixedCalendarToday()">Σήμερα</button>
        </div>
        <button type="button" class="fixed-calendar-nav" onclick="capvoFixedCalendarChangeMonth(1)" aria-label="Επόμενος μήνας">›</button>
      </div>
      <div class="fixed-calendar-weekdays">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div>
      <div class="fixed-calendar-grid">${cells}</div>
    </section>`;
}

function capvoFixedRelativeText(row){
  const today=todayISO();
  const due=row.dueDate;
  if(row.status?.state==='paid')return `Πληρώθηκε ${formatGreekDayMonth(row.payment?.paidAt||row.payment?.paid_at||row.dueDate)}`;
  const todayDate=capvoParseDateKey(today);
  const dueDate=capvoParseDateKey(due);
  if(!todayDate || !dueDate)return 'Προγραμματισμένο';
  const diff=Math.round((dueDate-todayDate)/(1000*60*60*24));
  if(diff<0)return `Έπρεπε ${formatGreekDayMonth(due)}`;
  if(diff===0)return 'Λήγει σήμερα';
  if(diff===1)return 'Αύριο';
  return `Σε ${diff} ημέρες`;
}

function capvoRenderFixedObligationCard(row,{compact=false,showUndo=true,showEdit=true,showDelete=false}={}){
  const expense=row.expense||{};
  const status=row.status||{};
  const payment=row.payment||status.payment||null;
  const wallet=row.wallet || (expense.sourceWalletId && typeof capvoWalletById==='function'?capvoWalletById(expense.sourceWalletId):null);
  const category=expense.category||'Άλλο';
  const icon=CEMO[category]||'📌';
  const canUndo=showUndo && payment?.id;
  const canPay=!canUndo && ['overdue','due'].includes(status.state);
  const id=capvoFixedCalendarJs(expense.id||'');
  const paymentId=capvoFixedCalendarJs(payment?.id||'');

  return `
    <article class="fixed-obligation-card ${compact?'compact':''} state-${esc(status.state||'upcoming')}">
      <button type="button" class="fixed-obligation-main" onclick="editExp('fixed','${id}')">
        <span class="fixed-obligation-icon">${icon}</span>
        <span class="fixed-obligation-copy">
          <strong>${esc(expense.name||'Πάγιο')}</strong>
          <small>${esc(category)} · ${esc(capvoFixedRelativeText(row))}${wallet?` · ${esc(wallet.name)}`:''}</small>
          <em>Επόμενη: ${esc(formatGreekFullDate(row.dueDate))}</em>
        </span>
      </button>
      <div class="fixed-obligation-side">
        <strong>${fmt(expense.amount)}</strong>
        <span class="fixed-due-pill ${esc(status.tone||'slate')}">${esc(status.label||'Προσεχώς')}</span>
        <div class="fixed-obligation-actions">
          ${canPay?`<button type="button" class="fixed-pay-btn" onclick="capvoPayFixedExpense('${id}')">Πληρώθηκε</button>`:''}
          ${canUndo?`<button type="button" class="fixed-pay-btn undo" onclick="capvoUndoFixedExpensePayment('${paymentId}')">Αναίρεση</button>`:''}
          ${showEdit?`<button type="button" class="fixed-edit-btn" onclick="editExp('fixed','${id}')">Edit</button>`:''}
          ${showDelete?`<button type="button" class="fixed-delete-btn" onclick="capvoConfirmDeleteFixedExpense('${id}')">Διαγραφή</button>`:''}
        </div>
      </div>
    </article>`;
}


let capvoFixedPaymentPreviewExpenseId='';
let capvoFixedPaymentPreviewResolve=null;
let capvoFixedPaymentPreviewSelectedWalletId='';

function capvoFixedPaymentIsSavingsWallet(wallet){
  if(!wallet)return false;
  const role=typeof capvoWalletBudgetRole==='function'?String(capvoWalletBudgetRole(wallet)||''):String(wallet.budgetRole||wallet.budget_role||'');
  return !!(wallet.isSavings || wallet.is_savings || String(wallet.type||'')==='savings' || role==='savings');
}

function capvoFixedPaymentEligibleWallets(){
  const wallets=typeof capvoActiveWallets==='function'
    ? capvoActiveWallets()
    : (Array.isArray(D.wallets)?D.wallets.filter(w=>w&&w.isActive!==false&&w.is_active!==false):[]);
  return wallets.filter(w=>w && w.isActive!==false && w.is_active!==false && !capvoFixedPaymentIsSavingsWallet(w));
}

function capvoFixedPaymentPickWallet(expense,selectedWalletId=''){
  const wallets=capvoFixedPaymentEligibleWallets();
  const find=id=>id?wallets.find(w=>String(w.id)===String(id)):null;
  return find(selectedWalletId)
    || find(expense?.sourceWalletId||expense?.source_wallet_id)
    || find(typeof capvoDefaultWallet==='function'?capvoDefaultWallet()?.id:'')
    || wallets[0]
    || null;
}

function capvoFixedPaymentPreviewData(fixedExpenseId,selectedWalletId=''){
  const expense=(D.fixedExpenses||[]).find(x=>String(x.id)===String(fixedExpenseId));
  if(!expense)return null;
  const dueDate=typeof capvoFixedExpenseNextDueDate==='function'?capvoFixedExpenseNextDueDate(expense):todayISO();
  const payment=typeof capvoFixedExpensePaymentForDueDate==='function'
    ? capvoFixedExpensePaymentForDueDate(expense.id,dueDate)
    : null;
  const eligibleWallets=capvoFixedPaymentEligibleWallets();
  const wallet=capvoFixedPaymentPickWallet(expense,selectedWalletId);
  const amount=capvoMoney(Number(expense.amount)||0);
  const before=capvoMoney(Number(wallet?.currentBalance)||0);
  const after=capvoMoney(before-amount);
  return {expense,dueDate,payment,wallet,eligibleWallets,amount,before,after};
}

function capvoEnsureFixedPaymentPreviewSheet(){
  let overlay=$('capvoFixedPaymentPreviewOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='capvoFixedPaymentPreviewOverlay';
  overlay.className='fixed-payment-preview-overlay';
  overlay.innerHTML=`
    <div class="fixed-payment-preview-sheet" role="dialog" aria-modal="true" aria-labelledby="fixedPaymentPreviewTitle" onclick="event.stopPropagation()">
      <div class="fixed-payment-preview-handle"></div>
      <div class="fixed-payment-preview-head">
        <div>
          <span>Επιβεβαίωση</span>
          <h3 id="fixedPaymentPreviewTitle">Πληρωμή παγίου</h3>
          <p id="fixedPaymentPreviewSubtitle">Διάλεξε wallet και έλεγξε τι θα αφαιρεθεί πριν συνεχίσεις.</p>
        </div>
        <button type="button" class="fixed-payment-preview-close" onclick="capvoCloseFixedPaymentPreview(false)" aria-label="Κλείσιμο">×</button>
      </div>
      <div id="fixedPaymentPreviewBody" class="fixed-payment-preview-body"></div>
      <div class="fixed-payment-preview-actions">
        <button type="button" class="fixed-payment-preview-secondary" onclick="capvoCloseFixedPaymentPreview(false)">Άκυρο</button>
        <button type="button" id="fixedPaymentPreviewConfirm" class="fixed-payment-preview-primary" onclick="capvoConfirmFixedPaymentPreview()">Πληρώθηκε</button>
      </div>
    </div>`;
  overlay.addEventListener('click',event=>{
    if(event.target===overlay)capvoCloseFixedPaymentPreview(false);
  });
  document.body.appendChild(overlay);
  return overlay;
}

function capvoRenderFixedPaymentPreviewBody(data){
  const {expense,dueDate,payment,wallet,eligibleWallets=[],amount,before,after}=data;
  const category=expense.category||'Άλλο';
  const icon=CEMO[category]||'📌';
  if(payment){
    return `
      <div class="fixed-payment-preview-alert soft">
        <strong>Έχει ήδη πληρωθεί</strong>
        <span>Το πάγιο φαίνεται πληρωμένο για ${esc(formatGreekFullDate(dueDate))}.</span>
      </div>`;
  }
  if(!eligibleWallets.length){
    return `
      <div class="fixed-payment-preview-alert danger">
        <strong>Δεν υπάρχει διαθέσιμο wallet πληρωμής</strong>
        <span>Δεν μπορεί να πληρωθεί πάγιο από αποταμιευτικό wallet. Δημιούργησε ή ενεργοποίησε ένα wallet τύπου κύριος λογαριασμός, μετρητά ή Revolut.</span>
      </div>`;
  }
  if(!wallet){
    return `
      <div class="fixed-payment-preview-alert danger">
        <strong>Δεν βρέθηκε wallet</strong>
        <span>Διάλεξε wallet πληρωμής για αυτό το πάγιο πριν συνεχίσεις.</span>
      </div>`;
  }
  const walletOptions=eligibleWallets.map(w=>{
    const selected=String(w.id)===String(wallet.id)?' selected':'';
    const label=`${w.icon||'💳'} ${w.name||'Wallet'} · ${fmt(Number(w.currentBalance)||0)}`;
    return `<option value="${esc(w.id)}"${selected}>${esc(label)}</option>`;
  }).join('');
  const isInsufficient=after<0;
  const missingAmount=Math.abs(after);
  return `
    <div class="fixed-payment-preview-hero">
      <span class="fixed-payment-preview-icon">${icon}</span>
      <div>
        <strong>${esc(expense.name||'Πάγιο')}</strong>
        <small>${esc(category)} · ${esc(formatGreekFullDate(dueDate))}</small>
      </div>
      <em>${fmt(amount)}</em>
    </div>

    <label class="fixed-payment-preview-wallet-picker" for="fixedPaymentPreviewWalletSelect">
      <span>Πλήρωσε από wallet</span>
      <select id="fixedPaymentPreviewWalletSelect" class="fixed-payment-preview-wallet-select" onchange="capvoChangeFixedPaymentPreviewWallet(this.value)">
        ${walletOptions}
      </select>
      <small>Τα αποταμιευτικά wallets δεν εμφανίζονται για πληρωμή παγίων.</small>
    </label>

    <div class="fixed-payment-preview-balance-grid">
      <div>
        <span>Πριν</span>
        <strong>${fmt(before)}</strong>
      </div>
      <div>
        <span>Πληρωμή</span>
        <strong>-${fmt(amount)}</strong>
      </div>
      <div class="${after<0?'is-negative':''}">
        <span>Μετά</span>
        <strong>${fmt(after)}</strong>
      </div>
    </div>

    ${isInsufficient?`
      <div class="fixed-payment-preview-alert danger">
        <strong>Ανεπαρκές υπόλοιπο</strong>
        <span>Το wallet "${esc(wallet.name||'Wallet')}" δεν έχει αρκετά χρήματα για αυτή την πληρωμή. Λείπουν ${fmt(missingAmount)}. Διάλεξε άλλο wallet ή μετέφερε χρήματα πριν συνεχίσεις.</span>
      </div>`:`
      <div class="fixed-payment-preview-alert soft">
        <strong>Τι θα γίνει</strong>
        <span>Θα μειωθεί μόνο το wallet "${esc(wallet.name||'Wallet')}" και θα καταχωρηθεί actual πληρωμή παγίου στα movements/reports.</span>
      </div>`}
  `;
}

function capvoOpenFixedPaymentPreview(fixedExpenseId){
  return new Promise(resolve=>{
    const data=capvoFixedPaymentPreviewData(fixedExpenseId);
    if(!data){showMiniToast('Δεν βρέθηκε το πάγιο.','error');resolve(false);return;}

    capvoFixedPaymentPreviewExpenseId=String(fixedExpenseId||'');
    capvoFixedPaymentPreviewSelectedWalletId=String(data.wallet?.id||'');
    capvoFixedPaymentPreviewResolve=resolve;
    const overlay=capvoEnsureFixedPaymentPreviewSheet();
    capvoRefreshFixedPaymentPreview(data);
    overlay.classList.add('active');
    document.body.classList.add('fixed-payment-preview-open');
  });
}

function capvoRefreshFixedPaymentPreview(data=null){
  const nextData=data || capvoFixedPaymentPreviewData(capvoFixedPaymentPreviewExpenseId,capvoFixedPaymentPreviewSelectedWalletId);
  const body=$('fixedPaymentPreviewBody');
  const confirm=$('fixedPaymentPreviewConfirm');
  if(!nextData){
    if(body)body.innerHTML=`<div class="fixed-payment-preview-alert danger"><strong>Δεν βρέθηκε το πάγιο</strong><span>Κλείσε το παράθυρο και δοκίμασε ξανά.</span></div>`;
    if(confirm)confirm.disabled=true;
    return;
  }
  capvoFixedPaymentPreviewSelectedWalletId=String(nextData.wallet?.id||'');
  if(body)body.innerHTML=capvoRenderFixedPaymentPreviewBody(nextData);
  if(confirm){
    const isInsufficient=Number(nextData.after)<0;
    confirm.disabled=!!nextData.payment || !nextData.wallet || !nextData.eligibleWallets?.length || isInsufficient;
    confirm.textContent=nextData.payment?'Ήδη πληρωμένο':(isInsufficient?'Ανεπαρκές υπόλοιπο':'Πληρώθηκε');
  }
}

function capvoChangeFixedPaymentPreviewWallet(walletId){
  capvoFixedPaymentPreviewSelectedWalletId=String(walletId||'');
  capvoRefreshFixedPaymentPreview();
}

function capvoCloseFixedPaymentPreview(result=false){
  const overlay=$('capvoFixedPaymentPreviewOverlay');
  if(overlay)overlay.classList.remove('active','is-busy');
  document.body.classList.remove('fixed-payment-preview-open');
  const confirm=$('fixedPaymentPreviewConfirm');
  if(confirm){confirm.disabled=false;confirm.textContent='Πληρώθηκε';}
  capvoFixedPaymentPreviewExpenseId='';
  capvoFixedPaymentPreviewSelectedWalletId='';
  const resolve=capvoFixedPaymentPreviewResolve;
  capvoFixedPaymentPreviewResolve=null;
  if(typeof resolve==='function')resolve(!!result);
}

async function capvoConfirmFixedPaymentPreview(){
  const fixedExpenseId=capvoFixedPaymentPreviewExpenseId;
  if(!fixedExpenseId)return;
  const overlay=$('capvoFixedPaymentPreviewOverlay');
  const confirm=$('fixedPaymentPreviewConfirm');
  if(overlay)overlay.classList.add('is-busy');
  if(confirm){confirm.disabled=true;confirm.textContent='Καταχώρηση...';}
  try{
    await capvoPayFixedExpense(fixedExpenseId,{skipPreview:true,skipLegacyConfirm:true,walletId:capvoFixedPaymentPreviewSelectedWalletId});
    capvoCloseFixedPaymentPreview(true);
  }catch(e){
    console.error('capvoConfirmFixedPaymentPreview failed:',e);
    if(overlay)overlay.classList.remove('is-busy');
    if(confirm){confirm.disabled=false;confirm.textContent='Πληρώθηκε';}
  }
}

function capvoRenderFixedSection(title,subtitle,rows,emptyText,extraClass=''){
  return `
    <section class="fixed-obligation-section ${esc(extraClass)}">
      <div class="fixed-obligation-section-head">
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle?`<p>${esc(subtitle)}</p>`:''}
        </div>
        <span>${rows.length}</span>
      </div>
      <div class="fixed-obligation-section-list">
        ${rows.length?rows.map(row=>capvoRenderFixedObligationCard(row,{compact:true})).join(''):`<div class="fixed-section-empty">${esc(emptyText)}</div>`}
      </div>
    </section>`;
}

function capvoToggleFixedAllExpanded(){
  capvoFixedAllExpanded=!capvoFixedAllExpanded;
  renderFixedList();
}

function capvoRenderFixedAllSection(rows,paidMonthTotal){
  const safeRows=Array.isArray(rows)?rows:[];
  const limit=10;
  const total=safeRows.length;
  const visibleRows=capvoFixedAllExpanded?safeRows:safeRows.slice(0,limit);
  const remaining=Math.max(0,total-visibleRows.length);
  const hasMore=total>limit;
  const subtitle=hasMore && !capvoFixedAllExpanded
    ? `Εμφάνιση ${visibleRows.length} από ${total} · πληρωμένα στον μήνα ${fmt(paidMonthTotal)}.`
    : `Επόμενες προγραμματισμένες πληρωμές · πληρωμένα στον μήνα ${fmt(paidMonthTotal)}.`;

  return `
    <section class="fixed-obligation-section all compact-all">
      <div class="fixed-obligation-section-head">
        <div>
          <h3>Όλα τα πάγια</h3>
          <p>${esc(subtitle)}</p>
        </div>
        <span>${total}</span>
      </div>
      <div class="fixed-obligation-section-list">
        ${visibleRows.length?visibleRows.map(row=>capvoRenderFixedObligationCard(row,{compact:true,showDelete:true})).join(''):`<div class="fixed-section-empty">Δεν υπάρχουν ενεργά πάγια.</div>`}
      </div>
      ${hasMore?`
        <div class="fixed-obligation-section-actions">
          <button type="button" class="fixed-all-toggle-btn" onclick="capvoToggleFixedAllExpanded()">
            ${capvoFixedAllExpanded?'Δες μόνο τα πρώτα 10':`Φόρτωσε άλλα ${Math.min(limit,remaining)}`}
          </button>
        </div>
      `:''}
    </section>`;
}

function capvoRenderFixedPaymentHistoryCard(row){
  const payment=row.payment||{};
  const expense=row.expense||{};
  const wallet=row.wallet;
  const category=expense.category||'Πάγια';
  const icon=CEMO[category]||'📌';
  const paymentId=capvoFixedCalendarJs(payment.id||'');
  const paidAt=String(payment.paidAt||payment.paid_at||payment.createdAt||payment.created_at||'').slice(0,10);
  const paidFor=String(payment.paidForDate||payment.paid_for_date||row.dueDate||'').slice(0,10);
  const deleted=!!expense.deletedAt;

  return `
    <article class="fixed-obligation-card compact state-paid fixed-payment-history-card ${deleted?'is-deleted-schedule':''}">
      <div class="fixed-obligation-main fixed-history-main">
        <span class="fixed-obligation-icon">${icon}</span>
        <span class="fixed-obligation-copy">
          <strong>${esc(expense.name||'Πάγιο')}</strong>
          <small>${esc(category)} · Πληρώθηκε${wallet?` · ${esc(wallet.name)}`:''}${deleted?' · Διαγραμμένο πάγιο':''}</small>
          <em>Πληρώθηκε: ${esc(formatGreekFullDate(paidAt||paidFor))} · Αφορούσε: ${esc(formatGreekFullDate(paidFor||paidAt))}</em>
        </span>
      </div>
      <div class="fixed-obligation-side">
        <strong>${fmt(Number(payment.amount)||0)}</strong>
        <span class="fixed-due-pill green">Πληρώθηκε</span>
        <div class="fixed-obligation-actions">
          ${paymentId?`<button type="button" class="fixed-pay-btn undo" onclick="capvoUndoFixedExpensePayment('${paymentId}')">Αναίρεση</button>`:''}
        </div>
      </div>
    </article>`;
}

function capvoRenderRecentFixedPayments(rows){
  return `
    <section class="fixed-obligation-section paid-recent">
      <div class="fixed-obligation-section-head">
        <div>
          <h3>Πληρωμένα πρόσφατα</h3>
          <p>Οι τελευταίες actual πληρωμές παγίων.</p>
        </div>
        <span>${rows.length}</span>
      </div>
      <div class="fixed-obligation-section-list">
        ${rows.length?rows.map(row=>capvoRenderFixedPaymentHistoryCard(row)).join(''):`<div class="fixed-section-empty">Δεν υπάρχουν πρόσφατες πληρωμές.</div>`}
      </div>
    </section>`;
}

function renderFixedList(){
  const fixedItems=(D.fixedExpenses||[])
    .slice()
    .sort((a,b)=>{
      const sa=typeof capvoFixedExpenseStatus==='function'?capvoFixedExpenseStatus(a):{nextDueDate:a.nextDueDate||''};
      const sb=typeof capvoFixedExpenseStatus==='function'?capvoFixedExpenseStatus(b):{nextDueDate:b.nextDueDate||''};
      return String(sa.nextDueDate||'9999-12-31').localeCompare(String(sb.nextDueDate||'9999-12-31'));
    })
    .map(e=>({kind:'fixed',data:e}));

  const count=fixedItems.length;
  const countEl=$('cFixed');
  const listEl=$('lFixed');
  if(!countEl || !listEl)return;

  const currentRows=capvoFixedCalendarCurrentRows();
  const urgentRows=currentRows.filter(row=>row.status?.state==='overdue');
  const todayRows=currentRows.filter(row=>row.dueDate===todayISO() && row.status?.state!=='paid');
  const upcomingRows=currentRows.filter(row=>{
    if(row.status?.state!=='upcoming')return false;
    const diff=(capvoParseDateKey(row.dueDate)-capvoParseDateKey(todayISO()))/(1000*60*60*24);
    return diff>0 && diff<=7;
  });

  countEl.innerHTML=`
    ${count} πάγια · ${urgentRows.length+todayRows.length} ενέργειες
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

  if(selectionMode.fixed){
    listEl.innerHTML=fixedItems.map(item=>eRow(item.data,'fixed')).join('');
    return;
  }

  const monthRows=capvoFixedCalendarRowsForMonth(capvoFixedCalendarMonthKey);
  capvoFixedCalendarEnsureState(monthRows);
  const selectedRows=monthRows.filter(row=>row.dueDate===capvoFixedCalendarSelectedDateKey);
  const recentPayments=capvoFixedCalendarRecentPayments(5);
  const monthTotal=capvoMoney(monthRows.reduce((s,row)=>s+(Number(row.expense?.amount)||0),0));
  const paidMonthTotal=capvoMoney(monthRows.filter(row=>row.status?.state==='paid').reduce((s,row)=>s+(Number(row.expense?.amount)||0),0));

  listEl.innerHTML=`
    <div class="fixed-calendar-dashboard">
      <div class="fixed-summary-chip action"><span>Ενέργειες</span><strong>${urgentRows.length+todayRows.length}</strong></div>
      <div class="fixed-summary-chip today"><span>Σήμερα</span><strong>${todayRows.length}</strong></div>
      <div class="fixed-summary-chip upcoming"><span>7 ημέρες</span><strong>${upcomingRows.length}</strong></div>
      <div class="fixed-summary-chip total"><span>Μήνας</span><strong>${fmt(monthTotal)}</strong></div>
    </div>

    ${capvoRenderFixedCalendar(monthRows)}

    <section class="fixed-selected-day-card">
      <div class="fixed-selected-day-head">
        <div>
          <h3>${esc(capvoFixedCalendarSelectedLabel(capvoFixedCalendarSelectedDateKey))}</h3>
          <p>${selectedRows.length?`${selectedRows.length} υποχρεώσεις · ${fmt(selectedRows.reduce((s,row)=>s+(Number(row.expense?.amount)||0),0))}`:'Καμία πληρωμή σε αυτή την ημέρα.'}</p>
        </div>
        <span>${selectedRows.length?fmt(selectedRows.reduce((s,row)=>s+(Number(row.expense?.amount)||0),0)):fmt(0)}</span>
      </div>
      <div class="fixed-selected-day-list">
        ${selectedRows.length?selectedRows.map(row=>capvoRenderFixedObligationCard(row)).join(''):`<div class="fixed-section-empty">Δεν έχεις πάγιο προγραμματισμένο για αυτή την ημέρα.</div>`}
      </div>
    </section>

    ${capvoRenderFixedSection('Χρειάζονται ενέργεια','Πάγια που έχουν περάσει και δεν φαίνονται ως πληρωμένα.',urgentRows,'Δεν έχεις καθυστερημένες υποχρεώσεις.','needs-action')}
    ${capvoRenderFixedSection('Σήμερα','Όσα λήγουν σήμερα και θέλουν άμεση απόφαση.',todayRows,'Δεν λήγει κάποιο πάγιο σήμερα.','today')}
    ${capvoRenderFixedSection('Έρχονται σύντομα','Επόμενες υποχρεώσεις μέσα στις 7 ημέρες.',upcomingRows,'Δεν έχεις πάγια στις επόμενες 7 ημέρες.','upcoming')}
    ${capvoRenderFixedAllSection(currentRows,paidMonthTotal)}
    ${capvoRenderRecentFixedPayments(recentPayments)}
  `;
}

function toggleTxMobileFixedExpanded(){
  txMobileFixedExpanded=!txMobileFixedExpanded;
  renderFixedList();
}
// ===== END 03a-dashboard.js =====
