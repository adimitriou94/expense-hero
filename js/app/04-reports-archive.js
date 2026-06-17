// CAPVO app split: 04-reports-archive.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== STATS / ARCHIVE =====
function reportsPreviousMonthKey(monthKey){
  const [y,m]=String(monthKey||curMK()).split('-').map(Number);
  const d=new Date(y,(m||1)-2,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

function reportsMonthRange(monthKey){
  const [y,m]=String(monthKey||curMK()).split('-').map(Number);
  if(!y || !m)return null;
  return {
    start:new Date(y,m-1,1,12),
    end:new Date(y,m,0,12)
  };
}

function reportsItemFromExpense(e,type='daily'){
  return {
    id:e.id||'',
    name:e.name||'Κίνηση',
    category:e.category||'Άλλο',
    amount:Number(e.amount)||0,
    type:e.isCardPayment?'card_payment':type,
    date:e.date||'',
    paymentSourceName:e.paymentSourceName||'',
    affectsCashBudget:typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true
  };
}

function reportsFixedItems(monthKey){
  // v1.9.6.2: paid scheduled fixed expenses are real report items.
  // Filter out reversed rows and keep historical month/cycle filtering safe.
  const range=monthKey?reportsMonthRange(monthKey):null;
  const startKey=range?capvoDateKey(range.start):'';
  const endKey=range?capvoDateKey(range.end):'';

  return (Array.isArray(D.fixedExpensePayments)?D.fixedExpensePayments:[])
    .filter(p=>String(p.status||'paid')!=='reversed')
    .map(p=>{
      const fx=typeof capvoFixedExpenseById==='function'
        ? capvoFixedExpenseById(p.fixedExpenseId||p.fixed_expense_id)
        : (D.fixedExpenses||[]).find(e=>String(e.id)===String(p.fixedExpenseId||p.fixed_expense_id));
      const date=normalizeDateValue(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||'');
      if(!date)return null;
      if(startKey && date<startKey)return null;
      if(endKey && date>endKey)return null;
      return {
        id:p.id||'',
        name:fx?.name||'Πληρωμή παγίου',
        category:fx?.category||'Πάγια',
        amount:Number(p.amount)||0,
        type:'fixed',
        date,
        paymentSourceName:(typeof capvoWalletById==='function'?capvoWalletById(p.walletId||p.wallet_id)?.name:'')||'Wallet',
        affectsCashBudget:true
      };
    })
    .filter(Boolean);
}

function reportsActualCardPaymentsInRange(start,end){
  const s=start instanceof Date?start:null;
  const e=end instanceof Date?end:null;
  if(!s || !e)return [];

  return (D.creditCardTransactions||[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .map(t=>{
      const raw=t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||todayISO();
      const d=capvoParseDateKey(raw);
      if(!d || d<s || d>e)return null;
      const card=typeof cardById==='function'?cardById(t.cardId||t.card_id):null;
      return {
        id:t.id||'',
        name:t.description||('Πληρωμή '+(card?.name||'κάρτας')),
        category:t.category||'Πιστωτικές',
        amount:Number(t.amount)||0,
        type:'card_payment',
        date:normalizeDateValue(raw)||'',
        paymentSourceName:card?.name||'Πιστωτική κάρτα',
        affectsCashBudget:true
      };
    })
    .filter(Boolean);
}

function reportsCurrentCycleBudgetItems(includeFixed=true){
  const movements=typeof getCurrentCycleBudgetMovements==='function'
    ? getCurrentCycleBudgetMovements()
    : (typeof getCurrentCycleBudgetExpenses==='function' ? getCurrentCycleBudgetExpenses() : getCurrentCycleDailyExpenses());

  const items=(movements||[])
    .filter(e=>includeFixed || !(e.isFixedExpense || e.isFixedExpensePayment))
    .map(e=>reportsItemFromExpense(
      e,
      e.isFixedExpensePayment?'fixed':(e.isCardPayment?'card_payment':'daily')
    ));
  return items.filter(e=>Number(e.amount)!==0);
}

function reportsMonthBudgetItems(monthKey,includeFixed=true){
  const month=D.months?.[monthKey]||{daily:[]};
  const range=reportsMonthRange(monthKey);

  const daily=(month.daily||[])
    .filter(e=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(e):true)
    .map(e=>reportsItemFromExpense(e,'daily'));

  const cardPayments=range?reportsActualCardPaymentsInRange(range.start,range.end):[];
  return [...(includeFixed?reportsFixedItems(monthKey):[]),...cardPayments,...daily].filter(e=>Number(e.amount)!==0);
}

function reportsAllMonthlyItems(monthKey){
  // Reports are budget-impact first. For the active view, use the current
  // payday/budget cycle, not raw calendar-month rows or credit-card purchases.
  if(String(monthKey||curM)===String(curM))return reportsCurrentCycleBudgetItems(true);
  return reportsMonthBudgetItems(monthKey,true);
}

function reportsCurrentMovementItems(){
  // v1.9.6.2: fixed items are now actual payments, so they belong in the
  // daily movement chart as real budget-impact movements.
  return reportsCurrentCycleBudgetItems(true);
}

function reportsMonthDailyTotal(monthKey){
  return reportsAllMonthlyItems(monthKey).reduce((s,e)=>s+(Number(e.amount)||0),0);
}

function reportsCurrentCycleElapsedDays(){
  try{
    const cycle=getCurrentBudgetCycle();
    const today=new Date();
    const t=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
    const end=t<cycle.end?t:cycle.end;
    const ms=24*60*60*1000;
    return Math.max(1,Math.floor((end-cycle.start)/ms)+1);
  }catch(e){
    return 1;
  }
}

function reportsShortDate(dateStr){
  if(!dateStr)return 'τρέχων μήνας';
  const d=new Date(dateStr+'T12:00:00');
  if(Number.isNaN(d.getTime()))return 'τρέχων μήνας';
  return `${d.getDate()} ${MG[d.getMonth()]}`;
}

function reportsPctDelta(current,previous){
  if(!previous || previous<=0)return '';
  const diff=(current-previous)/previous*100;
  const sign=diff>0?'+':'';
  const rounded=Math.round(diff);
  return `${sign}${rounded}% από προηγ. μήνα`;
}

function rStats(){
  const items=reportsAllMonthlyItems(curM);
  const total=items.reduce((s,e)=>s+e.amount,0);

  const byCategory={};
  items.forEach(e=>{
    byCategory[e.category]=(byCategory[e.category]||0)+e.amount;
  });

  const sorted=Object.entries(byCategory).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const topCategory=sorted[0]||['—',0];
  const topPct=total>0?Math.round(topCategory[1]/total*100):0;

  const largest=items
    .filter(e=>e.type!=='card')
    .sort((a,b)=>b.amount-a.amount)[0] || items.sort((a,b)=>b.amount-a.amount)[0];

  const cycle=getCurrentBudgetCycle();
  const elapsed=reportsCurrentCycleElapsedDays();
  const avg=elapsed>0?total/elapsed:0;

  const prevKey=reportsPreviousMonthKey(curM);
  const prevTotal=reportsAllMonthlyItems(prevKey).reduce((s,e)=>s+e.amount,0);
  const prevAvg=prevTotal>0?prevTotal/new Date(Number(prevKey.split('-')[0]),Number(prevKey.split('-')[1]),0).getDate():0;

  if($('reportsTotal'))$('reportsTotal').textContent=fmt(total);
  if($('reportsTotalDelta'))$('reportsTotalDelta').textContent='τρέχων κύκλος';
  if($('reportsAvgDay'))$('reportsAvgDay').textContent=fmt(avg);
  if($('reportsAvgDelta'))$('reportsAvgDelta').textContent=`${elapsed} ημέρες κύκλου`;
  if($('reportsTopCategory'))$('reportsTopCategory').textContent=topCategory[0];
  if($('reportsTopPct'))$('reportsTopPct').textContent=`${topPct}% των εξόδων`;
  if($('reportsLargestTx'))$('reportsLargestTx').textContent=fmt(largest?.amount||0);
  if($('reportsLargestTxMeta'))$('reportsLargestTxMeta').textContent=largest?`${largest.name} · ${reportsShortDate(largest.date)}`:'—';

  if(sorted.length===0 || total<=0){
    if($('chartCatDonut'))$('chartCatDonut').style.background='#eef2f7';
    if($('chartCat'))$('chartCat').innerHTML='<div class="reports-empty">Δεν υπάρχουν έξοδα για στατιστικά ακόμα.</div>';
    if($('chartCatTotal'))$('chartCatTotal').textContent=fmt(0);
  }else{
    let startDeg=0;
    const gradientParts=sorted.map(([cat,catTotal])=>{
      const deg=catTotal/total*360;
      const endDeg=startDeg+deg;
      const color=CCLR[cat]||'#8b95ad';
      const part=`${color} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`;
      startDeg=endDeg;
      return part;
    });

    if($('chartCatDonut'))$('chartCatDonut').style.background=`conic-gradient(${gradientParts.join(',')})`;
    if($('chartCatTotal'))$('chartCatTotal').textContent=fmt(total);

    const visible=sorted.slice(0,5);
    const extra=sorted.length-visible.length;

    if($('chartCat'))$('chartCat').innerHTML=visible.map(([cat,catTotal])=>{
      const pct=Math.round(catTotal/total*100);
      const color=CCLR[cat]||'#8b95ad';

      return`
        <div class="donut-legend-row reports-category-row">
          <div class="donut-legend-left">
            <span class="donut-dot" style="background:${color}"></span>
            <span>${esc(cat)}</span>
          </div>
          <div class="donut-legend-right">
            <strong>${fmt(catTotal)}</strong>
            <small>${pct}%</small>
          </div>
        </div>`;
    }).join('') + (extra>0?`
      <button type="button" class="reports-more-categories" onclick="openReportsAllCategoriesSheet()">
        + ${extra} ακόμα ${extra===1?'κατηγορία':'κατηγορίες'}
        <span>›</span>
      </button>`:'');
  }

  const insights=[];
  insights.push({
    icon:'📌',
    tone:'blue',
    text:'Οι αναφορές μετρούν μόνο κινήσεις που επηρεάζουν πραγματικά το budget του κύκλου.'
  });

  if(topCategory[1]>0){
    insights.push({
      icon:'👑',
      tone:'amber',
      text:`Η μεγαλύτερη κατηγορία είναι <strong>${esc(topCategory[0])}</strong> με ${topPct}% των εξόδων.`
    });
  }

  const foodTotal=(byCategory['Τρόφιμα']||0)+(byCategory['Φαγητό έξω']||0)+(byCategory['Καφέδες']||0);
  if(foodTotal>0 && total>0){
    insights.push({
      icon:'💡',
      tone:'purple',
      text:`Τα έξοδα φαγητού/καφέ είναι <strong>${Math.round(foodTotal/total*100)}%</strong> του μήνα.`
    });
  }else{
    const freeAfterFixed=D.income-allFixedTotal();
    insights.push({
      icon:'💡',
      tone:'purple',
      text:`Μετά τις σταθερές υποχρεώσεις μένουν <strong>${fmt(Math.max(0,freeAfterFixed))}</strong> για ευέλικτη χρήση.`
    });
  }

  if($('reportsInsights')){
    $('reportsInsights').innerHTML=insights.slice(0,3).map(i=>`
      <div class="reports-insight ${i.tone}">
        <span>${i.icon}</span>
        <p>${i.text}</p>
      </div>
    `).join('');
  }

  const movementItems=reportsCurrentMovementItems();
  const days=[];
  const chartEnd=new Date(Math.min(new Date().setHours(12,0,0,0),cycle.end.getTime()));
  for(let i=13;i>=0;i--){
    const d=new Date(chartEnd.getFullYear(),chartEnd.getMonth(),chartEnd.getDate()-i,12);
    if(d<cycle.start)continue;
    const k=capvoDateKey(d);
    days.push({label:`${d.getDate()}/${d.getMonth()+1}`,total:movementItems.filter(e=>e.date===k).reduce((s,e)=>s+(Number(e.amount)||0),0)});
  }

  const dayMax=Math.max(...days.map(d=>d.total),1);
  if($('chartDay'))$('chartDay').innerHTML=days.map(d=>`
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.total/dayMax*100)}%;background:var(--amber)"></div></div>
      <div class="bar-value">${fmt(d.total)}</div>
    </div>`).join('');
}


function reportsBuildCategoryRows(limit=null){
  const items=reportsAllMonthlyItems(curM);
  const total=items.reduce((s,e)=>s+e.amount,0);
  const byCategory={};
  items.forEach(e=>{
    byCategory[e.category]=(byCategory[e.category]||0)+(Number(e.amount)||0);
  });

  const rows=Object.entries(byCategory)
    .sort((a,b)=>b[1]-a[1]);

  const visible=Number.isFinite(limit)?rows.slice(0,limit):rows;

  return {rows:visible,total,count:rows.length};
}

function openReportsAllCategoriesSheet(){
  const overlay=$('reportsAllCategoriesSheet');
  const list=$('reportsAllCategoriesList');
  const subtitle=$('reportsAllCategoriesSubtitle');
  if(!overlay || !list)return;

  const {rows,total,count}=reportsBuildCategoryRows();

  if(subtitle){
    subtitle.textContent=total>0?`${count} κατηγορίες · ${fmt(total)} συνολικά`:'Δεν υπάρχουν δεδομένα για τον κύκλο';
  }

  if(rows.length===0 || total<=0){
    list.innerHTML='<div class="reports-sheet-empty">Δεν υπάρχουν έξοδα για ανάλυση κατηγοριών ακόμα.</div>';
  }else{
    list.innerHTML=rows.map(([cat,amount])=>{
      const pct=Math.round(amount/total*100);
      const color=CCLR[cat]||'#8b95ad';
      return `
        <div class="reports-sheet-row">
          <div class="reports-sheet-row-main">
            <span class="reports-sheet-dot" style="background:${color}"></span>
            <div>
              <strong>${esc(cat)}</strong>
              <div class="reports-sheet-track"><span style="width:${pct}%;background:${color}"></span></div>
            </div>
          </div>
          <div class="reports-sheet-row-value">
            <strong>${fmt(amount)}</strong>
            <small>${pct}%</small>
          </div>
        </div>`;
    }).join('');
  }

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}

function openReportsAdvancedSheet(){
  const overlay=$('reportsAdvancedSheet');
  const content=$('reportsAdvancedContent');
  if(!overlay || !content)return;

  const items=reportsAllMonthlyItems(curM);
  const total=items.reduce((s,e)=>s+e.amount,0);
  const daily=reportsCurrentMovementItems();
  const elapsed=reportsCurrentCycleElapsedDays();
  const avg=elapsed>0?total/elapsed:0;

  const byDay={};
  daily.forEach(e=>{
    const key=e.date||'';
    if(key)byDay[key]=(byDay[key]||0)+(Number(e.amount)||0);
  });
  const topDay=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];

  const byPay={};
  daily.forEach(e=>{
    const name=e.paymentSourceName || e.paymentSourceType || 'Budget / Μετρητά';
    byPay[name]=(byPay[name]||0)+(Number(e.amount)||0);
  });
  const topPay=Object.entries(byPay).sort((a,b)=>b[1]-a[1])[0];

  const largest=items
    .filter(e=>e.type!=='card')
    .sort((a,b)=>b.amount-a.amount)[0] || items.sort((a,b)=>b.amount-a.amount)[0];

  const {rows}=reportsBuildCategoryRows();
  const topCategory=rows[0];

  const prevKey=reportsPreviousMonthKey(curM);
  const prevItems=reportsAllMonthlyItems(prevKey);
  const prevTotal=prevItems.reduce((s,e)=>s+e.amount,0);
  const diff=prevTotal>0?total-prevTotal:null;

  const cards=[
    {icon:'📅',label:'Μέση ημερήσια δαπάνη',value:fmt(avg),meta:`Υπολογισμός σε ${elapsed} ημέρες κύκλου`},
    {icon:'🔥',label:'Ημέρα με τα περισσότερα έξοδα',value:topDay?fmt(topDay[1]):'—',meta:topDay?reportsShortDate(topDay[0]):'Δεν υπάρχουν ημερήσιες κινήσεις'},
    {icon:'💳',label:'Πιο συχνή πηγή πληρωμής',value:topPay?esc(topPay[0]):'—',meta:topPay?fmt(topPay[1]):'Δεν υπάρχουν πηγές πληρωμής'},
    {icon:'↗',label:'Μεγαλύτερη συναλλαγή',value:fmt(largest?.amount||0),meta:largest?`${esc(largest.name)} · ${reportsShortDate(largest.date)}`:'—'},
    {icon:'👑',label:'Top κατηγορία',value:topCategory?esc(topCategory[0]):'—',meta:topCategory&&total>0?`${Math.round(topCategory[1]/total*100)}% του κύκλου`:'—'},
    {icon:diff===null?'📊':diff<=0?'✅':'⚠️',label:'Σύγκριση με προηγούμενο μήνα',value:diff===null?'—':fmt(Math.abs(diff)),meta:diff===null?'Χρειάζεται προηγούμενος μήνας':(diff<=0?'λιγότερα από προηγ. μήνα':'περισσότερα από προηγ. μήνα')}
  ];

  content.innerHTML=cards.map(c=>`
    <div class="reports-advanced-stat">
      <span>${c.icon}</span>
      <div>
        <small>${c.label}</small>
        <strong>${c.value}</strong>
        <em>${c.meta}</em>
      </div>
    </div>`).join('');

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}

function closeReportsSheet(id){
  const overlay=$(id);
  overlay?.classList.remove('active');
  if(!document.querySelector('.reports-sheet-overlay.active')){
    document.body.classList.remove('sheet-open');
  }
}


// Reports sheets: expose handlers for inline HTML events.
window.openReportsAllCategoriesSheet = openReportsAllCategoriesSheet;
window.openReportsAdvancedSheet = openReportsAdvancedSheet;
window.closeReportsSheet = closeReportsSheet;


let archiveExpandedItem = '';
let archiveViewMode = localStorage.getItem('capvoArchiveMode') || 'cycles';
if(!['cycles','months'].includes(archiveViewMode))archiveViewMode='cycles';

function archiveMonthName(k){
  const [y,mo]=String(k).split('-');
  return (MG[(parseInt(mo)||1)-1]||mo)+' '+y;
}

function archiveMonthLabelShort(k){
  const [y,mo]=String(k).split('-');
  return `${String(mo||'').padStart(2,'0')}/${String(y||'').slice(-2)}`;
}

function archivePrevKey(k){
  const [y,mo]=String(k).split('-').map(Number);
  const d=new Date(y,(mo||1)-2,1,12);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

function archiveAsDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
  }
  return capvoParseDateKey(value);
}

function archiveAddDays(date,days){
  const d=archiveAsDate(date);
  if(!d)return null;
  d.setDate(d.getDate()+Number(days||0));
  return d;
}

function archiveRangesOverlap(aStart,aEnd,bStart,bEnd){
  return aStart<=bEnd && bStart<=aEnd;
}

function archiveRowsInRange(start,end){
  const s=archiveAsDate(start);
  const e=archiveAsDate(end);
  if(!s||!e)return [];
  return getAllDailyExpenses().filter(row=>{
    const d=archiveAsDate(row.date);
    return d && d>=s && d<=e;
  });
}

function archiveBudgetDailyRowsInRange(start,end){
  return archiveRowsInRange(start,end)
    .filter(row=>typeof expenseAffectsCashBudget==='function'?expenseAffectsCashBudget(row):true)
    .map(row=>({
      ...row,
      amount:typeof capvoMoney==='function'?capvoMoney(Number(row.amount)||0):(Number(row.amount)||0),
      budgetImpactAmount:typeof capvoMoney==='function'?capvoMoney(Number(row.amount)||0):(Number(row.amount)||0),
      archiveKind:'daily'
    }));
}

function archiveCardPaymentRowsInRange(start,end){
  const s=archiveAsDate(start);
  const e=archiveAsDate(end);
  if(!s||!e)return [];
  return (Array.isArray(D?.creditCardTransactions)?D.creditCardTransactions:[])
    .filter(t=>t && (t.affectsBudget===true || t.affects_budget===true))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .map(t=>{
      const date=typeof normalizeDateValue==='function'
        ? normalizeDateValue(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at)
        : String(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at||'').slice(0,10);
      const d=archiveAsDate(date);
      if(!d || d<s || d>e)return null;
      const card=typeof cardById==='function'?cardById(t.cardId||t.card_id):null;
      const amount=typeof capvoMoney==='function'?capvoMoney(Number(t.amount)||0):(Number(t.amount)||0);
      return {
        id:t.id||`archive_card_${date}`,
        name:t.description||`Πληρωμή ${card?.name||'κάρτας'}`,
        category:t.category||'Πιστωτικές',
        amount,
        budgetImpactAmount:amount,
        date,
        archiveKind:'card_payment'
      };
    })
    .filter(Boolean);
}

function archiveSavingsBudgetRowsInRange(start,end){
  const s=archiveAsDate(start);
  const e=archiveAsDate(end);
  if(!s||!e)return [];
  return (Array.isArray(D?.savingsTransactions)?D.savingsTransactions:[])
    .map(t=>{
      const date=typeof normalizeDateValue==='function'
        ? normalizeDateValue(t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date)
        : String(t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date||'').slice(0,10);
      const d=archiveAsDate(date);
      if(!d || d<s || d>e)return null;
      const type=String(t.type||'').toLowerCase();
      const source=String(t.source||'').toLowerCase();
      if(type==='transfer_in' || type==='transfer_out' || source.includes('transfer'))return null;
      const raw=typeof capvoMoney==='function'?capvoMoney(Number(t.amount)||0):(Number(t.amount)||0);
      if(raw===0)return null;
      const abs=Math.abs(raw);
      const isWithdrawal=type==='withdrawal' || raw<0;
      const impact=typeof capvoMoney==='function'?capvoMoney(isWithdrawal?-abs:abs):(isWithdrawal?-abs:abs);
      const goal=typeof savingsGoalById==='function'?savingsGoalById(t.goalId||t.goal_id):null;
      return {
        id:t.id||`archive_savings_${date}`,
        name:isWithdrawal?`Επιστροφή από ${goal?.name||'κουμπαρά'}`:`Μεταφορά σε ${goal?.name||'κουμπαρά'}`,
        category:'Αποταμίευση',
        amount:impact,
        budgetImpactAmount:impact,
        date,
        archiveKind:'savings'
      };
    })
    .filter(Boolean);
}

function archiveFixedRowsInRange(start,end){
  const s=archiveAsDate(start);
  const e=archiveAsDate(end);
  if(!s||!e)return [];
  const startKey=typeof capvoDateKey==='function'?capvoDateKey(s):'';
  return (Array.isArray(D?.fixedExpenses)?D.fixedExpenses:[])
    .map(f=>{
      const amount=typeof capvoMoney==='function'?capvoMoney(Number(f.amount)||0):(Number(f.amount)||0);
      if(amount<=0)return null;
      const created=typeof normalizeDateValue==='function'
        ? normalizeDateValue(f.createdAt||f.created_at)
        : String(f.createdAt||f.created_at||'').slice(0,10);
      const createdDate=created?archiveAsDate(created):null;
      if(createdDate && createdDate>e)return null;
      const date=(createdDate && createdDate>=s && createdDate<=e)?created:startKey;
      return {
        id:f.id||`archive_fixed_${date}`,
        name:f.name||'Πάγιο έξοδο',
        category:f.category||'Πάγια',
        amount,
        budgetImpactAmount:amount,
        date,
        archiveKind:'fixed'
      };
    })
    .filter(Boolean);
}

function archiveBudgetMovementsInRange(start,end){
  return [
    ...archiveBudgetDailyRowsInRange(start,end),
    ...archiveFixedRowsInRange(start,end),
    ...archiveCardPaymentRowsInRange(start,end),
    ...archiveSavingsBudgetRowsInRange(start,end)
  ];
}

function archiveCycleSourceLabel(cycle){
  if(cycle?.source==='paid_today')return 'Πρόωρη πληρωμή';
  if(cycle?.source==='manual')return 'Χειροκίνητος κύκλος';
  return 'Κανονικός κανόνας';
}

function archiveCycleStatusLabel(cycle){
  if(cycle?.isCurrent)return 'Τρέχων κύκλος';
  if(cycle?.source==='paid_today')return 'Πρόωρη πληρωμή';
  return 'Ιστορικός κύκλος';
}

function archiveCycleIncome(cycle){
  if(typeof getCycleIncomeTotal==='function')return getCycleIncomeTotal(cycle);
  const cycleId=String(cycle?.id||'');
  const storedIncomes=cycleId && !String(cycleId).startsWith('standard_') && !String(cycleId).startsWith('normal_')
    ? getCycleIncomesForCycle(cycleId)
    : [];
  const storedTotal=storedIncomes.reduce((s,i)=>s+(Number(i.amount)||0),0);
  if(storedTotal>0)return storedTotal;
  if(Number(cycle?.primaryIncomeAmount)>0)return Number(cycle.primaryIncomeAmount)||0;
  return Number(D.income)||0;
}

function archiveBuildStoredCycles(){
  return (D.budgetCycles||[]).map(c=>{
    const start=archiveAsDate(c.startDate||c.start_date);
    const end=archiveAsDate(c.endDate||c.end_date);
    if(!start||!end)return null;
    return {
      id:c.id || `stored_${capvoDateKey(start)}_${capvoDateKey(end)}`,
      key:`cycle_${c.id || `${capvoDateKey(start)}_${capvoDateKey(end)}`}`,
      start,
      end,
      startKey:capvoDateKey(start),
      endKey:capvoDateKey(end),
      label:formatBudgetCycleLabel(start,end,{withYear:start.getFullYear()!==end.getFullYear()}),
      source:c.source||'normal',
      primaryIncomeAmount:Number(c.primaryIncomeAmount)||0,
      stored:true
    };
  }).filter(Boolean);
}

function archiveBuildNormalCycles(minDate,maxDate){
  const min=archiveAsDate(minDate);
  const max=archiveAsDate(maxDate);
  if(!min||!max)return [];

  const first=getStandardBudgetCycle(min).start;
  const cycles=[];
  let cursor=archiveAddDays(first,-35)||first;

  let guard=0;
  while(cursor<=max && guard<80){
    const c=getStandardBudgetCycle(cursor);
    const start=archiveAsDate(c.start);
    const end=archiveAsDate(c.end);
    const nextStart=archiveAsDate(c.nextStart)||archiveAddDays(end,1);
    if(end>=min && start<=max){
      cycles.push({
        id:`normal_${capvoDateKey(start)}_${capvoDateKey(end)}`,
        key:`normal_${capvoDateKey(start)}_${capvoDateKey(end)}`,
        start,
        end,
        startKey:capvoDateKey(start),
        endKey:capvoDateKey(end),
        label:formatBudgetCycleLabel(start,end,{withYear:start.getFullYear()!==end.getFullYear()}),
        source:'normal',
        stored:false
      });
    }
    cursor=nextStart||archiveAddDays(end,1);
    guard++;
  }
  return cycles;
}

function archiveSubtractStoredRanges(normalCycle,storedCycles){
  let segments=[{start:normalCycle.start,end:normalCycle.end}];
  storedCycles
    .filter(sc=>archiveRangesOverlap(normalCycle.start,normalCycle.end,sc.start,sc.end))
    .sort((a,b)=>a.start-b.start)
    .forEach(sc=>{
      const next=[];
      segments.forEach(seg=>{
        if(!archiveRangesOverlap(seg.start,seg.end,sc.start,sc.end)){
          next.push(seg);
          return;
        }
        const beforeEnd=archiveAddDays(sc.start,-1);
        const afterStart=archiveAddDays(sc.end,1);
        if(beforeEnd && seg.start<=beforeEnd){
          next.push({start:seg.start,end:new Date(Math.min(seg.end.getTime(),beforeEnd.getTime()))});
        }
        if(afterStart && afterStart<=seg.end){
          next.push({start:new Date(Math.max(seg.start.getTime(),afterStart.getTime())),end:seg.end});
        }
      });
      segments=next;
    });

  return segments.map(seg=>({
    ...normalCycle,
    id:`normal_${capvoDateKey(seg.start)}_${capvoDateKey(seg.end)}`,
    key:`normal_${capvoDateKey(seg.start)}_${capvoDateKey(seg.end)}`,
    start:seg.start,
    end:seg.end,
    startKey:capvoDateKey(seg.start),
    endKey:capvoDateKey(seg.end),
    label:formatBudgetCycleLabel(seg.start,seg.end,{withYear:seg.start.getFullYear()!==seg.end.getFullYear()}),
    isTrimmed:true
  }));
}

function archiveBuildCycles(){
  const today=new Date();
  const current=getCurrentBudgetCycle(today);
  const stored=archiveBuildStoredCycles();
  const dailyDates=getAllDailyExpenses().map(e=>archiveAsDate(e.date)).filter(Boolean);
  const cardDates=(Array.isArray(D?.creditCardTransactions)?D.creditCardTransactions:[])
    .map(t=>archiveAsDate(t.transactionDate||t.transaction_date||t.date||t.createdAt||t.created_at)).filter(Boolean);
  const savingsDates=(Array.isArray(D?.savingsTransactions)?D.savingsTransactions:[])
    .map(t=>archiveAsDate(t.createdAt||t.created_at||t.date||t.transactionDate||t.transaction_date)).filter(Boolean);
  const fixedDates=(Array.isArray(D?.fixedExpenses)?D.fixedExpenses:[])
    .map(f=>archiveAsDate(f.createdAt||f.created_at)).filter(Boolean);
  const datePool=[current.start,current.end,...stored.flatMap(c=>[c.start,c.end]),...dailyDates,...cardDates,...savingsDates,...fixedDates].filter(Boolean);

  if(datePool.length===0)return [];

  const minDate=new Date(Math.min(...datePool.map(d=>d.getTime())));
  const maxDate=new Date(Math.max(...datePool.map(d=>d.getTime())));

  const normal=archiveBuildNormalCycles(minDate,maxDate)
    .flatMap(c=>archiveSubtractStoredRanges(c,stored));

  const all=[...normal,...stored].map(c=>{
    const isCurrent=today>=c.start && today<=c.end;
    const rows=archiveBudgetMovementsInRange(c.start,c.end);
    return {...c,isCurrent,rowsCount:rows.length};
  });

  const dedup=new Map();
  all.forEach(c=>{
    const key=`${c.startKey}_${c.endKey}_${c.source}_${c.id}`;
    if(!dedup.has(key))dedup.set(key,c);
  });

  return [...dedup.values()]
    .filter(c=>c.rowsCount>0 || c.isCurrent || c.stored)
    .sort((a,b)=>b.start-a.start);
}

function archiveCycleSnapshot(cycle){
  const movementRows=archiveBudgetMovementsInRange(cycle.start,cycle.end);
  const dailyRows=movementRows.filter(r=>r.archiveKind==='daily');
  const daily=dailyRows.reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const fixed=movementRows.filter(r=>r.archiveKind==='fixed').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const cards=movementRows.filter(r=>r.archiveKind==='card_payment').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const savings=movementRows.filter(r=>r.archiveKind==='savings').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const total=movementRows.reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const income=archiveCycleIncome(cycle);
  const balance=income-total;
  return {
    key:cycle.key,
    id:cycle.id,
    type:'cycle',
    label:cycle.label,
    shortLabel:`${cycle.start.getDate()}/${cycle.start.getMonth()+1}`,
    start:cycle.start,
    end:cycle.end,
    startKey:cycle.startKey,
    endKey:cycle.endKey,
    source:cycle.source,
    sourceLabel:archiveCycleSourceLabel(cycle),
    statusLabel:archiveCycleStatusLabel(cycle),
    isCurrent:cycle.isCurrent,
    isStored:cycle.stored,
    dailyRows,
    movementRows,
    daily,fixed,cards,savings,total,income,balance
  };
}

function archiveMonthSnapshot(k){
  const [y,m]=String(k).split('-').map(Number);
  const start=new Date(y,(m||1)-1,1,12);
  const end=new Date(y,(m||1),0,12);
  const movementRows=archiveBudgetMovementsInRange(start,end);
  const dailyRows=movementRows.filter(r=>r.archiveKind==='daily');
  const daily=dailyRows.reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const fixed=movementRows.filter(r=>r.archiveKind==='fixed').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const cards=movementRows.filter(r=>r.archiveKind==='card_payment').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const savings=movementRows.filter(r=>r.archiveKind==='savings').reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const total=movementRows.reduce((s,e)=>s+(Number(e.budgetImpactAmount??e.amount)||0),0);
  const income=Number(D.income)||0;
  const balance=income-total;
  return {
    key:k,
    type:'month',
    label:archiveMonthName(k),
    shortLabel:archiveMonthLabelShort(k),
    statusLabel:k===curM?'Τρέχων μήνας':'Ιστορικός μήνας',
    isCurrent:k===curM,
    dailyRows,
    movementRows,
    daily,fixed,cards,savings,total,income,balance
  };
}

function archiveBestWorst(snaps){
  const rows=snaps||[];
  const best=[...rows].sort((a,b)=>b.balance-a.balance)[0];
  const worst=[...rows].sort((a,b)=>a.balance-b.balance)[0];
  const avg=rows.length?rows.reduce((s,x)=>s+x.balance,0)/rows.length:0;
  return {best,worst,avg};
}

function archiveTopCategories(rows,limit=5){
  const map={};
  (rows||[]).forEach(e=>{
    const cat=e.category||'Άλλο';
    map[cat]=(map[cat]||0)+(Number(e.budgetImpactAmount??e.amount)||0);
  });
  return Object.entries(map)
    .map(([name,amount])=>({name,amount,color:CCLR[name]||'#8b95aa'}))
    .sort((a,b)=>b.amount-a.amount)
    .slice(0,limit);
}

function archiveDiffLine(label,current,prev,invert=false){
  const diff=current-prev;
  const pct=prev>0?Math.round((diff/prev)*100):null;
  const good=invert?diff<=0:diff>=0;
  const cls=good?'good':'bad';
  const sign=diff>=0?'+':'';
  return `
    <div class="archive-compare-pill ${cls}">
      <span>${label}</span>
      <strong>${pct===null?'νέο':`${sign}${pct}%`}</strong>
    </div>`;
}

function archiveExpandedHtml(snap,prev=null){
  const cats=archiveTopCategories(snap.movementRows||snap.dailyRows,6);
  const kind=snap.type==='cycle'?'κύκλου':'μήνα';
  const comparisonLabel=prev?.label||'';

  return `
    <div class="archive-expanded">
      <div class="archive-expanded-title">Ανάλυση ${kind}</div>

      ${snap.type==='cycle'?`
        <div class="archive-cycle-meta-card">
          <span>${esc(snap.sourceLabel||'Κανονικός κανόνας')}</span>
          <strong>${esc(snap.label)}</strong>
          ${snap.source==='paid_today'?'<small>Ξεκίνησε από την επιλογή “Πληρώθηκα σήμερα”.</small>':''}
        </div>`:''}

      <div class="archive-breakdown-grid">
        ${cats.length?cats.map(c=>`
          <div class="archive-cat-row">
            <span><i style="background:${c.color}"></i>${esc(c.name)}</span>
            <strong>${fmt(c.amount)}</strong>
          </div>
        `).join(''):'<div class="archive-empty-mini">Δεν υπάρχουν κινήσεις budget.</div>'}
      </div>

      <div class="archive-month-totals">
        <div><span>Πάγια</span><strong>${fmt(snap.fixed)}</strong></div>
        <div><span>Πληρωμές καρτών</span><strong>${fmt(snap.cards)}</strong></div>
        <div><span>Αποταμίευση</span><strong>${fmt(snap.savings||0)}</strong></div>
        <div><span>Κινήσεις budget</span><strong>${fmt(snap.daily)}</strong></div>
      </div>

      ${prev?`
        <div class="archive-compare-box">
          <div class="archive-expanded-title">Σύγκριση με ${esc(comparisonLabel)}</div>
          <div class="archive-compare-grid">
            ${archiveDiffLine('Έξοδα',snap.total,prev.total,true)}
            ${archiveDiffLine('Υπόλοιπο',snap.balance,prev.balance,false)}
            ${archiveDiffLine('Κινήσεις budget',snap.daily,prev.daily,true)}
          </div>
        </div>
      `:`<div class="archive-empty-mini">Δεν υπάρχει προηγούμενος ${kind} για σύγκριση.</div>`}
    </div>`;
}

function toggleArchiveItem(k){
  archiveExpandedItem = archiveExpandedItem===k ? '' : k;
  rArch();

  if(archiveExpandedItem){
    requestAnimationFrame(()=>{
      const el=document.querySelector(`[data-archive-item="${CSS.escape(archiveExpandedItem)}"]`);
      if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
  }
}

function setArchiveMode(mode){
  archiveViewMode=['cycles','months'].includes(mode)?mode:'cycles';
  localStorage.setItem('capvoArchiveMode',archiveViewMode);
  archiveExpandedItem='';
  rArch();
}

function archiveModeSwitchHtml(){
  return `
    <div class="archive-mode-switch" role="tablist" aria-label="Προβολή αρχείου">
      <button type="button" class="${archiveViewMode==='cycles'?'active':''}" onclick="setArchiveMode('cycles')">Οικονομικοί κύκλοι</button>
      <button type="button" class="${archiveViewMode==='months'?'active':''}" onclick="setArchiveMode('months')">Ημερολογιακοί μήνες</button>
    </div>`;
}

function archiveEmptyHtml(isCycleMode){
  return `
    <section class="archive-empty-card">
      <div class="archive-empty-icon">🗓️</div>
      <h3>Δεν υπάρχει ιστορικό ακόμα</h3>
      <p>${isCycleMode?'Μόλις καταχωρήσεις κινήσεις, οι οικονομικοί κύκλοι θα εμφανιστούν εδώ.':'Μόλις καταχωρήσεις κινήσεις, οι μήνες θα εμφανιστούν εδώ.'}</p>
    </section>`;
}

function renderArchiveTimeline(snaps,{mode}){
  const isCycleMode=mode==='cycles';
  const meta=archiveBestWorst(snaps);
  const recent=snaps.slice(0,6).reverse();
  const maxAbs=Math.max(1,...recent.map(x=>Math.abs(x.balance)));
  const countLabel=isCycleMode?'Κύκλοι ιστορικού':'Μήνες ιστορικού';
  const bestLabel=isCycleMode?'Καλύτερος κύκλος':'Καλύτερος μήνας';
  const worstLabel=isCycleMode?'Χειρότερος κύκλος':'Χειρότερος μήνας';
  const timelineTitle=isCycleMode?`Τελευταίοι ${recent.length} κύκλοι`:`Τελευταίοι ${recent.length} μήνες`;
  const listTitle=isCycleMode?'Αρχείο οικονομικών κύκλων':'Μηνιαίο αρχείο';
  const listKicker=isCycleMode?'BUDGET CYCLES':'HISTORY';

  const summaryHtml=`
    <section class="archive-summary-grid">
      <article class="archive-summary-card">
        <div class="archive-summary-icon">🗓️</div>
        <span>${countLabel}</span>
        <strong>${snaps.length}</strong>
      </article>
      <article class="archive-summary-card is-green">
        <div class="archive-summary-icon">🏆</div>
        <span>${bestLabel}</span>
        <strong>${esc(meta.best?.label||'—')}</strong>
        <small>${fmt(meta.best?.balance||0)}</small>
      </article>
      <article class="archive-summary-card is-red">
        <div class="archive-summary-icon">📉</div>
        <span>${worstLabel}</span>
        <strong>${esc(meta.worst?.label||'—')}</strong>
        <small>${fmt(meta.worst?.balance||0)}</small>
      </article>
      <article class="archive-summary-card is-blue">
        <div class="archive-summary-icon">📊</div>
        <span>Μέσο υπόλοιπο</span>
        <strong>${fmt(meta.avg)}</strong>
      </article>
    </section>

    <section class="archive-trend-card">
      <div class="archive-section-head">
        <div>
          <span>Timeline</span>
          <h3>${timelineTitle}</h3>
        </div>
      </div>
      <div class="archive-mini-bars">
        ${recent.map(x=>{
          const h=Math.max(12,Math.round(Math.abs(x.balance)/maxAbs*58));
          const positive=x.balance>=0;
          return `<div class="archive-mini-bar ${positive?'good':'bad'}"><i style="height:${h}px"></i><span>${esc(x.shortLabel||'')}</span></div>`;
        }).join('')}
      </div>
    </section>`;

  const cards=snaps.map((snap,idx)=>{
    const prev=snaps[idx+1]||null;
    const open=archiveExpandedItem===snap.key;
    const sourceBadge=snap.type==='cycle'?`<em class="archive-source-badge ${snap.source==='paid_today'?'is-paid':''}">${esc(snap.sourceLabel)}</em>`:'';
    return `
      <article class="archive-month-card ${snap.isCurrent?'is-current':''} ${open?'is-open':''}" data-archive-item="${esc(snap.key)}">
        <button type="button" class="archive-month-main" onclick="toggleArchiveItem('${esc(snap.key)}')">
          <div class="archive-month-left">
            <strong>${esc(snap.label)}</strong>
            <span>${esc(snap.statusLabel)}</span>
            ${sourceBadge}
          </div>
          <div class="archive-month-right">
            <strong class="${snap.balance>=0?'is-positive':'is-negative'}">${fmt(snap.balance)}</strong>
            <span>Έξοδα ${fmt(snap.total)}</span>
          </div>
          <div class="archive-chevron">⌄</div>
        </button>

        <div class="archive-mini-stats">
          <div><span>Έσοδα</span><strong>${fmt(snap.income)}</strong></div>
          <div><span>Κινήσεις budget</span><strong>${fmt(snap.daily)}</strong></div>
          <div><span>Σύνολο</span><strong>${fmt(snap.total)}</strong></div>
        </div>

        ${open?archiveExpandedHtml(snap,prev):''}
      </article>`;
  }).join('');

  return `
    <div class="archive-page-content">
      ${archiveModeSwitchHtml()}
      ${isCycleMode?`
        <section class="archive-cycle-info-card">
          <strong>Το αρχείο ακολουθεί τον οικονομικό κύκλο σου</strong>
          <span>Τα έξοδα ομαδοποιούνται με βάση την ημέρα πληρωμής και τις πρόωρες πληρωμές, όχι μόνο με βάση τον ημερολογιακό μήνα.</span>
        </section>`:''}
      ${summaryHtml}
      <section class="archive-timeline-list">
        <div class="archive-section-head">
          <div>
            <span>${listKicker}</span>
            <h3>${listTitle}</h3>
          </div>
        </div>
        ${cards}
      </section>
    </div>`;
}

function rArch(){
  const list=$('archList');
  if(!list)return;

  if(archiveViewMode==='months'){
    const keys=Object.keys(D.months||{}).sort().reverse();
    if(keys.length===0){
      list.innerHTML=`${archiveModeSwitchHtml()}${archiveEmptyHtml(false)}`;
      return;
    }
    const snaps=keys.map(k=>archiveMonthSnapshot(k));
    list.innerHTML=renderArchiveTimeline(snaps,{mode:'months'});
    return;
  }

  const cycles=archiveBuildCycles();
  if(cycles.length===0){
    list.innerHTML=`${archiveModeSwitchHtml()}${archiveEmptyHtml(true)}`;
    return;
  }
  const snaps=cycles.map(c=>archiveCycleSnapshot(c));
  list.innerHTML=renderArchiveTimeline(snaps,{mode:'cycles'});
}

// Archive: expose handlers for inline HTML events.
window.toggleArchiveItem = toggleArchiveItem;
window.toggleArchiveMonth = toggleArchiveItem;
window.setArchiveMode = setArchiveMode;
