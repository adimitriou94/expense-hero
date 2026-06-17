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
  
  const tot=capvoMoney(fxS+ccS+cashDaily);
  const bal=capvoMoney(D.income-tot);

  const pct=D.income>0?Math.min(100,Math.round(tot/D.income*100)):0;
  const cycle=getCurrentBudgetCycle();

  $('mLabel').textContent=cycle.label;
  const eyebrow=document.querySelector('.modern-hero-card .eyebrow');
  if(eyebrow)eyebrow.textContent='Υπόλοιπο μήνα';
  const heroCaption=document.querySelector('.modern-hero-caption');
  if(heroCaption)heroCaption.textContent=`Τρέχουσα μηνιαία περίοδος: ${cycle.label}.`;
  renderDashboardGreeting();
  $('dIncome').textContent=fmt(D.income);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  const heroCard=document.querySelector('.modern-hero-card');
  if(heroCard)heroCard.style.setProperty('--capvo-hero-pct', pct+'%');
  $('dSpent').textContent=fmt(tot)+' / '+fmt(D.income);
  renderDashboardAllowanceCards(bal);
  renderFirstUseBudgetPrompt();

  const snapshotTotals=typeof capvoDashboardSnapshotTotals==='function'
    ? capvoDashboardSnapshotTotals()
    : {fixed:fxS,cards:ccS,daily:cashDaily};
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
  return (D.fixedExpenses||[])
    .flatMap(expense=>capvoFixedCalendarOccurrenceDates(expense,monthDate).map(dueDate=>{
      const status=capvoFixedCalendarStatusForDueDate(expense,dueDate);
      const wallet=expense.sourceWalletId && typeof capvoWalletById==='function'?capvoWalletById(expense.sourceWalletId):null;
      return {expense,dueDate,status,wallet,payment:status.payment||null};
    }))
    .sort(capvoFixedCalendarSortRows);
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
    .filter(p=>String(p.status||'paid')!=='reversed')
    .map(payment=>{
      const expense=typeof capvoFixedExpenseById==='function'
        ? capvoFixedExpenseById(payment.fixedExpenseId||payment.fixed_expense_id)
        : (D.fixedExpenses||[]).find(e=>String(e.id)===String(payment.fixedExpenseId||payment.fixed_expense_id));
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
    if(isSavings)badges.push('Κουμπαράς');
    if(!affects)badges.push('Δεν επηρεάζει budget');
    if(affects && isReturn)badges.push('Επιστροφή budget');

    const meta=[
      esc(e.category || 'Άλλο'),
      e.date||'',
      e.sourceLabel?esc(e.sourceLabel):'',
      ...badges.map(esc)
    ].filter(Boolean).join(' · ');

    return `
    <div class="dashboard-preview-row">
      <div class="expense-icon ${CCLS[e.category] || 'cat-other'}">
        ${CEMO[e.category] || (isFixed?'📌':'📌')}
      </div>

      <div class="dashboard-preview-info">
        <strong>${esc(e.name || 'Κίνηση')}</strong>
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

function updateIncomeDestinationHelp(){
  const help=$('incomeDestinationHint');
  const wallet=incomeDestinationWallet();
  if(!help)return;
  if(!wallet){
    help.textContent='Το έσοδο θα κατατεθεί στο wallet που θα επιλέξεις. Ο ρόλος budget βγαίνει από το wallet.';
    return;
  }
  const counts=typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(wallet):!wallet.isSavings;
  help.textContent=counts
    ? 'Ο προορισμός μετράει στο budget, άρα το διαθέσιμο budget θα αυξηθεί.'
    : 'Ο προορισμός είναι εκτός budget, άρα θα αυξηθεί μόνο το συνολικό υπόλοιπο.';
}

async function capvoApplyExtraIncomeWalletEffect(userId,obj,previous){
  if(!obj || obj.isRestricted || obj.sourceType==='benefit')return {applied:false,reason:'restricted'};
  if(!obj.destinationWalletId)return {applied:false,reason:'no_wallet'};

  const previousApplied=previous && previous.walletDepositApplied && previous.destinationWalletId && (Number(previous.walletBalanceEffectAmount)||0)>0;
  if(previousApplied){
    const oldWallet=capvoWalletById(previous.destinationWalletId);
    if(oldWallet){
      await capvoUpdateWalletBalance(oldWallet.id,capvoMoney((Number(oldWallet.currentBalance)||0)-(Number(previous.walletBalanceEffectAmount)||0)));
    }
  }

  const wallet=capvoWalletById(obj.destinationWalletId);
  if(!wallet)return {applied:false,reason:'wallet_missing'};

  const amount=Number(obj.amount)||0;
  if(amount<=0)return {applied:false,reason:'invalid_amount'};

  const before=Number(wallet.currentBalance)||0;
  const after=capvoMoney(before+amount);
  await capvoUpdateWalletBalance(wallet.id,after);

  obj.walletDepositApplied=true;
  obj.walletDepositAppliedAt=new Date().toISOString();
  obj.walletBalanceEffectAmount=amount;
  obj.includeInBudget=typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(wallet):!wallet.isSavings;
  obj.isSavings=!obj.includeInBudget;
  obj.allocationTarget=obj.includeInBudget?'spending_budget':'outside_budget';

  return {applied:true,wallet,amount,before,after};
}

async function capvoReverseExtraIncomeWalletEffect(previous){
  if(!previous || !previous.walletDepositApplied || !previous.destinationWalletId)return;
  const amount=Number(previous.walletBalanceEffectAmount)||Number(previous.amount)||0;
  if(amount<=0)return;
  const wallet=capvoWalletById(previous.destinationWalletId);
  if(!wallet)return;
  await capvoUpdateWalletBalance(wallet.id,capvoMoney((Number(wallet.currentBalance)||0)-amount));
}

async function saveIncomeSourceRow(userId,item){
  const ownerUserId=String(userId || getDataOwnerId() || '').trim();

  if(!ownerUserId)throw new Error('Missing authenticated user id.');

  const payload={
    id:item.id,
    user_id:ownerUserId,
    user_chat_id:null, // legacy field — nullable after DB migration 2026-06-14
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
    is_primary_income:false,
    destination_wallet_id:item.destinationWalletId||null,
    wallet_deposit_applied:!!item.walletDepositApplied,
    wallet_deposit_applied_at:item.walletDepositAppliedAt||null,
    wallet_balance_effect_amount:Number(item.walletBalanceEffectAmount)||0,
    updated_at:new Date().toISOString()
  };

  let {error}=await supabaseClient
    .from('income_sources')
    .upsert(payload,{onConflict:'id'});

  if(error && /destination_wallet_id|wallet_deposit_applied|wallet_deposit_applied_at|wallet_balance_effect_amount/i.test(String(error.message||error.details||''))){
    const legacyPayload={...payload};
    delete legacyPayload.destination_wallet_id;
    delete legacyPayload.wallet_deposit_applied;
    delete legacyPayload.wallet_deposit_applied_at;
    delete legacyPayload.wallet_balance_effect_amount;
    const retry=await supabaseClient
      .from('income_sources')
      .upsert(legacyPayload,{onConflict:'id'});
    error=retry.error;
    if(!error)return {legacy:true};
  }

  if(error)throw error;
  return {legacy:false};
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
  ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory','fISDestinationWallet'].forEach(id=>{
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
      kicker:'Budget μήνα',
      title:'Budget μήνα',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget μήνα',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό μήνα',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget μήνα αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    budget:{
      icon:'💼',
      kicker:'Budget μήνα',
      title:'Budget μήνα',
      intro:'Το βασικό ποσό με το οποίο πορεύεσαι μέχρι την επόμενη πληρωμή.',
      summaryTitle:'Budget μήνα',
      summaryText:'Για μισθό, σύνταξη ή βασικό μηνιαίο budget. Προαιρετικά βάλε όριο εξόδων.',
      amountLabel:'Ποσό μήνα',
      amountHint:'Αν δεν βάλεις όριο, όλο το ποσό θα θεωρηθεί διαθέσιμο για έξοδα.',
      spendingLimitHint:'Αν θέλεις να κρατήσεις μέρος του ποσού εκτός budget, βάλε εδώ πόσα θες να ξοδεύεις.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Το βασικό budget συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση budget',
      successText:'✅ Το budget μήνα αποθηκεύτηκε',
      showRestricted:false,
      advancedHint:'Προαιρετικά'
    },
    other:{
      icon:'🏠',
      kicker:'Άλλο εισόδημα',
      title:'Άλλο εισόδημα',
      intro:'Για έξτρα χρήματα εκτός βασικού μισθού.',
      summaryTitle:'Άλλο εισόδημα',
      summaryText:'Freelance, ενοίκιο που εισπράττεις, επίδομα, bonus ή δεύτερη δουλειά.',
      amountLabel:'Ποσό εισοδήματος',
      amountHint:'Θα προστεθεί στο wallet προορισμού. Το budget impact βγαίνει από το wallet.',
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget μήνα.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό. Αν πληρώνεις ενοίκιο, καταχώρησέ το στα Πάγια.',
      saveText:'Αποθήκευση εσόδου',
      successText:'✅ Το έσοδο προστέθηκε',
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
      spendingLimitHint:'Το όριο εξόδων εφαρμόζεται μόνο στο Budget μήνα.',
      nameLabel:'Πώς να εμφανίζεται;',
      restrictedLabel:'Πού χρησιμοποιείται;',
      restrictedHint:'Συνήθως δεν χρειάζεται περιορισμό.',
      saveText:'Αποθήκευση ποσού',
      successText:'✅ Το έκτακτο ποσό προστέθηκε',
      showRestricted:false,
      advancedHint:'Budget / επανάληψη'
    }
  };
  // v1.9.3.0: salary/basic budget is configured from the primary wallet,
  // not from the Extra income page. If old buttons/links ask for salary,
  // redirect the modal to an extra-income flow.
  if(type==='salary'||type==='budget')type='extra';
  return configs[type]||configs.extra||configs.other;
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

  if($('incomeDestinationCard'))$('incomeDestinationCard').style.display=cfg.showRestricted?'none':'block';
  fillIncomeDestinationWalletSelect?.($('fISDestinationWallet')?.value||'');
  updateIncomeDestinationHelp?.();

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
  if(type==='salary'||type==='budget')type='extra';

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
      name:'Bonus / έκτακτο',
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
      sourceCategory:'bonus',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    rent:{
      name:'Ενοίκιο που εισπράττω',
      category:'Ενοίκιο',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:true,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'income',
      sourceCategory:'rent_income',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    },
    dividends:{
      name:'Μερίσματα',
      category:'Μερίσματα',
      incomeType:'bank',
      restriction:'none',
      restrictedCategory:'',
      includeInBudget:true,
      isSavings:false,
      isRecurring:false,
      notes:'',
      isPrimaryIncome:false,
      sourceType:'one_time',
      sourceCategory:'dividends',
      restrictionType:null,
      isRestricted:false,
      allocationTarget:'spending_budget'
    }
  };

  const preset=presets[type]||presets.extra||presets.other;
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

  fillIncomeDestinationWalletSelect?.($('fISDestinationWallet')?.value||'');
  updateIncomeDestinationHelp?.();
  refreshIncomeCustomPickers?.();

  // Do not auto-focus amount after preset; keep keyboard closed until user taps a field.
}

function validateIncomeSourceForm(){
  clearIncomeValidation();

  const name=$('fISName').value.trim();
  const rawAmount=$('fISAmount').value;
  const amount=parseIncomeAmountValue(rawAmount);
  const mode=getCurrentIncomeWizardMode();

  if(!name){
    setIncomeModalFeedback('Συμπλήρωσε όνομα, π.χ. Bonus, Ενοίκιο, Μερίσματα.','error');
    showMiniToast('Συμπλήρωσε όνομα πηγής','error');
    markIncomeFieldError('fISName');
    return null;
  }

  if(String(rawAmount||'').trim()===''){
    setIncomeModalFeedback('Συμπλήρωσε ποσό εισοδήματος.','error');
    showMiniToast('Συμπλήρωσε ποσό','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  if(!Number.isFinite(amount) || amount<=0){
    setIncomeModalFeedback('Το ποσό πρέπει να είναι μεγαλύτερο από 0.','error');
    showMiniToast('Το ποσό δεν είναι έγκυρο','error');
    markIncomeFieldError('fISAmount');
    return null;
  }

  const incomeType=$('fISType').value;
  const restriction=$('fISRestriction').value;
  const category=$('fISCategory').value;
  const isBenefit=mode==='benefit'||mode==='ticket'||mode==='voucher'||category==='Ticket Restaurant'||category==='Άυλη κάρτα';
  const destinationWalletId=$('fISDestinationWallet')?.value||'';
  const destinationWallet=destinationWalletId?capvoWalletById(destinationWalletId):null;

  if(!isBenefit && !destinationWalletId){
    setIncomeModalFeedback('Επίλεξε σε ποιο wallet μπήκαν αυτά τα χρήματα.','error');
    showMiniToast('Επίλεξε προορισμό','error');
    markIncomeFieldError('fISDestinationWallet');
    return null;
  }

  const sourceType=isBenefit?'benefit':(mode==='extra'||!$('fISRecurring')?.checked?'one_time':'income');
  const sourceCategory=isBenefit
    ? (category==='Ticket Restaurant'?'ticket':category==='Άυλη κάρτα'?'voucher':'benefit')
    : category==='Ενοίκιο'?'rent_income'
      : category==='Μερίσματα'?'dividends'
      : category==='Freelance'?'freelance'
      : category.includes('Δώρο')?'bonus'
      : category==='Bonus'?'bonus'
      : category==='Επιστροφή χρημάτων'?'refund'
      : category==='Πώληση αντικειμένου'?'sale'
      : 'other_income';

  const isRestricted=isBenefit || (restriction&&restriction!=='none');
  const restrictionType=isBenefit?(category==='Ticket Restaurant'?'ticket':category==='Άυλη κάρτα'?'voucher':'benefit'):null;
  const includeInBudget=!isBenefit && destinationWallet ? (typeof capvoWalletCountsInBudget==='function'?capvoWalletCountsInBudget(destinationWallet):!destinationWallet.isSavings) : false;
  const isSavings=!isBenefit && !includeInBudget;

  return {
    name,
    amount,
    spendingLimit:0,
    incomeType,
    restriction:isBenefit?restriction:'none',
    includeInBudget,
    isSavings,
    isPrimaryIncome:false,
    sourceType,
    sourceCategory,
    restrictionType,
    isRestricted,
    allocationTarget:isBenefit?'restricted_balance':includeInBudget?'spending_budget':'outside_budget',
    destinationWalletId:isBenefit?null:destinationWalletId
  };
}

async function saveIncomeSource(){
  const id=$('fISID').value;
  const validation=validateIncomeSourceForm();
  if(!validation)return;

  const userId=getDataOwnerId();
  const btn=$('btnIncomeSource');

  if(!userId){
    showMiniToast('❌ Δεν υπάρχει ενεργή σύνδεση Google','error');
    return;
  }

  const previous=id?(D.incomeSources||[]).find(x=>String(x.id)===String(id)):null;
  const obj={
    id:id||gid(),
    name:validation.name,
    amount:validation.amount,
    spendingLimit:0,
    category:$('fISCategory').value,
    incomeType:validation.incomeType,
    includeInBudget:validation.includeInBudget,
    isSavings:validation.isSavings,
    isRecurring:$('fISRecurring')?.checked!==false,
    restriction:validation.restriction,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim(),
    isPrimaryIncome:false,
    sourceType:validation.sourceType,
    sourceCategory:validation.sourceCategory,
    restrictionType:validation.restrictionType,
    isRestricted:validation.isRestricted,
    allocationTarget:validation.allocationTarget,
    destinationWalletId:validation.destinationWalletId,
    walletDepositApplied:false,
    walletDepositAppliedAt:null,
    walletBalanceEffectAmount:0
  };

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(id?'Ενημερώνεται έσοδο...':'Αποθηκεύεται έσοδο...', 'Περνάω την κίνηση στο σωστό wallet.'))return;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent=id?'Ενημέρωση...':'Αποθήκευση...';
    }

    if(obj.isRestricted && previous?.walletDepositApplied){
      await capvoReverseExtraIncomeWalletEffect(previous);
    }

    const initialSave=await saveIncomeSourceRow(userId,obj);
    let applyResult={applied:false,reason:'restricted'};
    if(!obj.isRestricted && initialSave?.legacy!==true){
      applyResult=await capvoApplyExtraIncomeWalletEffect(userId,obj,previous);
      await saveIncomeSourceRow(userId,obj);
    }else if(!obj.isRestricted && initialSave?.legacy===true){
      showMiniToast('Το έσοδο αποθηκεύτηκε, αλλά χρειάζεται SQL migration για να περαστεί στο wallet.','error');
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

    const suffix=applyResult.applied && applyResult.wallet ? ` · μπήκε στο ${applyResult.wallet.name}` : '';
    const successMsg=id?`✅ Το έσοδο ενημερώθηκε${suffix}`:`✅ Το έσοδο προστέθηκε${suffix}`;
    capvoAppOperationSuccess?.('Ολοκληρώθηκε',successMsg);
    showMiniToast(successMsg);

  }catch(e){
    console.error('saveIncomeSource failed:',e);
    setIncomeModalFeedback('Δεν μπόρεσα να αποθηκεύσω το έσοδο. Δοκίμασε ξανά.','error');
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να αποθηκεύσω το έσοδο.');
    showMiniToast('❌ Αποτυχία αποθήκευσης','error');

  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
    if(btn){
      btn.disabled=false;
      btn.textContent=id?'Ενημέρωση εσόδου':getIncomePresetConfig(getCurrentIncomeWizardMode()).saveText;
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

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Διαγράφεται έσοδο...', 'Ενημερώνω το wallet και τα στοιχεία σου.'))return;

  try{
    const previous=(D.incomeSources||[]).find(i=>String(i.id)===String(id));
    await capvoReverseExtraIncomeWalletEffect(previous);
    await deleteIncomeSourceRow(id);

    D.incomeSources=(D.incomeSources||[]).filter(i=>i.id!==id);

    refreshComputedIncome();
    render();

    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Το έσοδο διαγράφηκε.');
    showMiniToast('✅ Η πηγή εισοδήματος διαγράφηκε');

  }catch(e){
    console.error('deleteIncomeSource failed:',e);

    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν μπόρεσα να διαγράψω το έσοδο.');
    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

// v1.0.11 — clear inline validation while user edits Add Income/Budget fields
(function setupIncomeSourceValidationCleanup(){
  function bind(){
    ['fISName','fISAmount','fISSpendingLimit','fISCategory','fISType','fISRestriction','fISRestrictedCategory','fISDestinationWallet'].forEach(id=>{
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
          <small>Θα αυξήσει το υπόλοιπο μήνα</small>
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
