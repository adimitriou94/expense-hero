// CAPVO app split: 04a-reports.js
// Reports: rStats(), cycle grid, action items, category breakdown, tickets, insights, sheets
// Source: 04-reports-archive.js lines 1-828

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
  const categoryMeta=typeof capvoResolveExpenseCategoryMeta==='function'
    ? capvoResolveExpenseCategoryMeta(e)
    : {categoryName:e?.category||'Άλλο',subcategoryName:''};
  const categoryName=categoryMeta.categoryName || e?.category || 'Άλλο';
  const subcategoryName=categoryMeta.subcategoryName || '';
  const merchantName=String(e?.merchantName||e?.merchant_name||'').trim();
  const notes=String(e?.notes||e?.note||'').trim();
  const amount=typeof capvoMoney==='function'?capvoMoney(Number(e?.amount)||0):(Number(e?.amount)||0);
  const budgetImpactAmount=typeof capvoMovementBudgetImpact==='function'
    ? capvoMovementBudgetImpact(e)
    : (typeof e?.budgetImpactAmount!=='undefined'?Number(e.budgetImpactAmount)||0:amount);
  const movementKind=typeof capvoMovementKind==='function'
    ? capvoMovementKind(e)
    : (type==='fixed'?'fixed':type==='card_payment'?'cards':type==='savings'?'savings':'expenses');

  return {
    id:e?.id||'',
    name:e?.name||merchantName||'Κίνηση',
    displayTitle:merchantName || e?.name || 'Κίνηση',
    category:categoryName,
    categoryLabel:subcategoryName?`${categoryName} › ${subcategoryName}`:categoryName,
    subcategory:subcategoryName,
    merchantName,
    notes,
    amount,
    budgetImpactAmount,
    type:e?.isCardPayment?'card_payment':type,
    movementKind,
    date:e?.date||'',
    paymentSourceName:e?.paymentSourceName||e?.payment_source_name||'',
    paymentAccountType:e?.paymentAccountType||e?.payment_account_type||'',
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
    .filter(p=>typeof capvoFixedExpensePaymentIsCountable==='function' ? capvoFixedExpensePaymentIsCountable(p) : String(p.status||'paid')!=='reversed')
    .map(p=>{
      const fx=typeof capvoFixedExpensePaymentExpense==='function'
        ? capvoFixedExpensePaymentExpense(p)
        : (typeof capvoFixedExpenseById==='function'
          ? capvoFixedExpenseById(p.fixedExpenseId||p.fixed_expense_id)
          : (D.fixedExpenses||[]).find(e=>String(e.id)===String(p.fixedExpenseId||p.fixed_expense_id)));
      const date=normalizeDateValue(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||'');
      if(!date)return null;
      if(startKey && date<startKey)return null;
      if(endKey && date>endKey)return null;
      return {
        id:p.id||'',
        name:fx?.name||'Πληρωμή παγίου',
        category:fx?.category||'Πάγια',
        categoryLabel:fx?.category||'Πάγια',
        subcategory:'',
        merchantName:'',
        notes:p.notes||p.note||'',
        displayTitle:fx?.name||'Πληρωμή παγίου',
        amount:Number(p.amount)||0,
        budgetImpactAmount:Number(p.amount)||0,
        movementKind:'fixed',
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
        categoryLabel:t.category||'Πιστωτικές',
        subcategory:'',
        merchantName:'',
        notes:t.notes||t.note||'',
        displayTitle:t.description||('Πληρωμή '+(card?.name||'κάρτας')),
        amount:Number(t.amount)||0,
        budgetImpactAmount:Number(t.amount)||0,
        movementKind:'cards',
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
      e.isFixedExpensePayment?'fixed':(e.isCardPayment?'card_payment':(e.isSavingsMovement?'savings':'daily'))
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

function reportsAbsAmount(row){
  return Math.abs(Number(row?.amount)||0);
}

function reportsBudgetOutAmount(row){
  const impact=Number(row?.budgetImpactAmount ?? row?.amount)||0;
  return impact>0?impact:0;
}

function reportsGroupRows(rows,keyFn,amountFn=reportsBudgetOutAmount){
  const map=new Map();
  (rows||[]).forEach(row=>{
    const key=String(keyFn(row)||'').trim();
    if(!key)return;
    const amount=Number(amountFn(row))||0;
    if(amount<=0)return;
    const current=map.get(key)||{key,total:0,count:0,rows:[]};
    current.total+=amount;
    current.count+=1;
    current.rows.push(row);
    map.set(key,current);
  });
  return [...map.values()].sort((a,b)=>b.total-a.total || b.count-a.count || a.key.localeCompare(b.key,'el'));
}

function reportsRenderMiniList(id,rows,total,{empty='Δεν υπάρχουν δεδομένα ακόμα.',limit=5,showCount=false}={}){
  const el=$(id);
  if(!el)return;
  const visible=Number.isFinite(limit)?rows.slice(0,limit):rows;
  if(!visible.length || total<=0){
    el.innerHTML=`<div class="reports-empty reports-mini-empty">${esc(empty)}</div>`;
    return;
  }
  el.innerHTML=visible.map(row=>{
    const pct=total>0?Math.max(3,Math.round(row.total/total*100)):0;
    const meta=showCount?`${row.count} ${row.count===1?'κίνηση':'κινήσεις'} · ${Math.round(row.total/total*100)}%`:`${Math.round(row.total/total*100)}% του συνόλου`;
    return `
      <div class="reports-break-row">
        <div class="reports-break-main">
          <strong>${esc(row.key)}</strong>
          <small>${esc(meta)}</small>
          <div class="reports-break-track"><span style="width:${pct}%"></span></div>
        </div>
        <div class="reports-break-value">${fmt(row.total)}</div>
      </div>`;
  }).join('') + (rows.length>visible.length?`<div class="reports-mini-more">+ ${rows.length-visible.length} ακόμα</div>`:'');
}

function reportsMovementTypeTotals(items){
  const daily=items.filter(e=>{
    const kind=String(e.movementKind||'').toLowerCase();
    const type=String(e.type||'').toLowerCase();
    return kind==='expenses' || (type==='daily' && !['fixed','cards','savings'].includes(kind));
  }).reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const fixed=items.filter(e=>e.type==='fixed' || e.movementKind==='fixed').reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const cards=items.filter(e=>e.type==='card_payment' || e.movementKind==='cards').reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const savingsDeposit=items.filter(e=>e.movementKind==='savings' || e.category==='Αποταμίευση').reduce((s,e)=>s+reportsBudgetOutAmount(e),0);

  const allMovements=typeof getCurrentCycleAllMovements==='function'?getCurrentCycleAllMovements():[];
  const income=allMovements
    .filter(e=>typeof capvoMovementKind==='function'?capvoMovementKind(e)==='income':String(e.movementGroup||'')==='income')
    .reduce((s,e)=>s+Math.abs(Number(e.amount)||0),0);
  const walletTransfers=allMovements
    .filter(e=>typeof capvoMovementKind==='function'?capvoMovementKind(e)==='wallets':String(e.movementGroup||'')==='wallets')
    .reduce((s,e)=>s+Math.abs(Number(e.amount)||0),0);

  return {daily,fixed,cards,savingsDeposit,income,walletTransfers};
}

function reportsRenderCycleGrid(items){
  const el=$('reportsCycleGrid');
  if(!el)return;
  const totals=reportsMovementTypeTotals(items);
  const cards=[
    {icon:'🧾',label:'Flexible έξοδα',value:totals.daily,meta:'Καθημερινές budget κινήσεις'},
    {icon:'📌',label:'Πάγια πληρωμένα',value:totals.fixed,meta:'Μόνο όσα πατήθηκαν ως πληρωμένα'},
    {icon:'💳',label:'Πληρωμές καρτών',value:totals.cards,meta:'Actual cash outflow για κάρτες'},
    {icon:'🏦',label:'Στόχος',value:totals.savingsDeposit,meta:'Μεταφορές που επηρέασαν budget'},
    {icon:'💰',label:'Income / μισθός',value:totals.income,meta:'Καταθέσεις στον κύκλο',positive:true},
    {icon:'🔁',label:'Wallet transfers',value:totals.walletTransfers,meta:'Μεταφορές μεταξύ λογαριασμών',neutral:true}
  ];
  el.innerHTML=cards.map(c=>`
    <article class="reports-cycle-card ${c.positive?'positive':''} ${c.neutral?'neutral':''}">
      <span>${c.icon}</span>
      <div>
        <small>${esc(c.label)}</small>
        <strong>${fmt(c.value)}</strong>
        <em>${esc(c.meta)}</em>
      </div>
    </article>`).join('');
}


function reportsCycleTimeInfo(){
  try{
    const cycle=getCurrentBudgetCycle();
    const today=new Date();
    const t=new Date(today.getFullYear(),today.getMonth(),today.getDate(),12);
    const ms=24*60*60*1000;
    const elapsed=Math.max(1,Math.floor((Math.min(t,cycle.end)-cycle.start)/ms)+1);
    const totalDays=Math.max(1,Math.floor((cycle.end-cycle.start)/ms)+1);
    const remainingDays=Math.max(0,Math.floor((cycle.end-t)/ms));
    return {cycle,elapsed,totalDays,remainingDays};
  }catch(e){
    return {cycle:null,elapsed:1,totalDays:1,remainingDays:0};
  }
}

function reportsBenefitSources(){
  return (Array.isArray(D?.incomeSources)?D.incomeSources:[])
    .filter(src=>{
      if(!src)return false;
      if(typeof capvoIsBenefitSource==='function' && capvoIsBenefitSource(src))return true;
      const text=String(`${src.name||''} ${src.category||''} ${src.incomeType||src.income_type||''} ${src.restrictionType||src.restriction_type||''}`).toLowerCase();
      return !!(src.isRestricted || src.is_restricted || (src.restriction && src.restriction!=='none') || text.includes('ticket') || text.includes('voucher') || text.includes('άυλη'));
    });
}

function reportsBenefitExpenseRows(){
  const sources=reportsBenefitSources();
  const ids=new Set(sources.map(s=>String(s.id||'')).filter(Boolean));
  return (typeof getCurrentCycleDailyExpenses==='function'?getCurrentCycleDailyExpenses():[])
    .filter(e=>{
      const sourceId=String(e?.paymentSourceId||e?.payment_source_id||'');
      if(sourceId && ids.has(sourceId))return true;
      const text=String(`${e?.paymentSourceName||e?.payment_source_name||''} ${e?.paymentSourceType||e?.payment_source_type||''}`).toLowerCase();
      return text.includes('ticket') || text.includes('voucher') || text.includes('άυλη');
    })
    .map(e=>{
      const row=reportsItemFromExpense(e,'benefit');
      return {...row,amount:Math.abs(Number(e?.amount)||0),budgetImpactAmount:Math.abs(Number(e?.amount)||0),sourceId:e?.paymentSourceId||e?.payment_source_id||''};
    })
    .filter(e=>Number(e.amount)>0);
}

function reportsTicketUsageModel(){
  const sources=reportsBenefitSources();
  const rows=reportsBenefitExpenseRows();
  const rowsBySource=new Map();
  rows.forEach(r=>{
    const key=String(r.sourceId||'');
    if(!key)return;
    const list=rowsBySource.get(key)||[];
    list.push(r);
    rowsBySource.set(key,list);
  });

  const cards=sources.map(src=>{
    const sourceRows=rowsBySource.get(String(src.id||''))||[];
    const amount=capvoMoney(Number(src.amount)||0);
    const used=typeof restrictedCoverageFor==='function'
      ? capvoMoney(Number(restrictedCoverageFor(src))||0)
      : capvoMoney(sourceRows.reduce((s,r)=>s+Number(r.amount||0),0));
    const remaining=capvoMoney(Math.max(0,amount-used));
    const pct=amount>0?Math.min(100,Math.round(used/amount*100)):0;
    return {
      id:src.id||'',
      name:src.name||src.category||'Ticket / Voucher',
      amount,
      used,
      remaining,
      pct,
      rows:sourceRows
    };
  });

  const orphanRows=rows.filter(r=>!r.sourceId || !sources.some(s=>String(s.id)===String(r.sourceId)));
  if(orphanRows.length){
    const used=capvoMoney(orphanRows.reduce((s,r)=>s+Number(r.amount||0),0));
    cards.push({id:'benefit_other',name:'Ticket / Voucher',amount:used,used,remaining:0,pct:100,rows:orphanRows});
  }

  const allRows=cards.flatMap(c=>c.rows||[]);
  const totalAmount=cards.reduce((s,c)=>s+c.amount,0);
  const totalUsed=cards.reduce((s,c)=>s+c.used,0);
  const totalRemaining=cards.reduce((s,c)=>s+c.remaining,0);
  const byCategory=reportsGroupRows(allRows,e=>e.categoryLabel||e.category||'',row=>Number(row.amount)||0);
  const byMerchant=reportsGroupRows(allRows,e=>e.merchantName||'',row=>Number(row.amount)||0);
  return {cards,totalAmount,totalUsed,totalRemaining,byCategory,byMerchant,rows:allRows};
}

function reportsRenderTicketUsage(){
  const el=$('reportsTicketUsage');
  if(!el)return;
  const model=reportsTicketUsageModel();
  if(!model.cards.length && !model.rows.length){
    el.innerHTML='<div class="reports-empty reports-ticket-empty">Δεν υπάρχει ακόμα χρήση Ticket/Voucher σε αυτόν τον κύκλο.</div>';
    return;
  }

  const topCategory=model.byCategory[0];
  const topMerchant=model.byMerchant[0];
  const cardsHtml=model.cards.slice(0,3).map(c=>`
    <article class="reports-ticket-source">
      <div class="reports-ticket-source-head">
        <span>🎟️</span>
        <div>
          <strong>${esc(c.name)}</strong>
          <small>${fmt(c.used)} χρήση · ${fmt(c.remaining)} υπόλοιπο</small>
        </div>
      </div>
      <div class="reports-ticket-track"><span style="width:${Math.max(3,c.pct)}%"></span></div>
      <em>${c.pct}% χρησιμοποιημένο</em>
    </article>`).join('');

  const insights=[
    {label:'Χρήση',value:fmt(model.totalUsed),meta:model.totalAmount>0?`${Math.round(model.totalUsed/model.totalAmount*100)}% από διαθέσιμο`:'τρέχων κύκλος'},
    {label:'Υπόλοιπο',value:fmt(model.totalRemaining),meta:'restricted balance'},
    {label:'Top χρήση',value:topCategory?esc(topCategory.key):'—',meta:topCategory?fmt(topCategory.total):'δεν υπάρχουν αρκετά δεδομένα'},
    {label:'Top merchant',value:topMerchant?esc(topMerchant.key):'—',meta:topMerchant?`${topMerchant.count} κινήσεις · ${fmt(topMerchant.total)}`:'δεν έχει merchant ακόμα'}
  ];

  el.innerHTML=`
    <div class="reports-ticket-summary">
      ${insights.map(i=>`
        <div class="reports-ticket-stat">
          <small>${esc(i.label)}</small>
          <strong>${i.value}</strong>
          <em>${esc(i.meta)}</em>
        </div>`).join('')}
    </div>
    <div class="reports-ticket-sources">${cardsHtml}</div>
  `;
}

function reportsActionToneClass(tone){
  return ['blue','purple','amber','red','green'].includes(tone)?tone:'blue';
}

function reportsBuildActionItems(items,total,grouped={}){
  const totals=reportsMovementTypeTotals(items);
  const {elapsed,totalDays,remainingDays}=reportsCycleTimeInfo();
  const avg=elapsed>0?total/elapsed:0;
  const income=Number(D?.income)||0;
  const remainingBudget=capvoMoney(Math.max(0,income-total));
  const safeDaily=remainingDays>0?capvoMoney(remainingBudget/remainingDays):remainingBudget;
  const actions=[];

  if(total<=0){
    actions.push({icon:'🌱',tone:'green',title:'Ξεκίνα να γεμίζεις δεδομένα',text:'Μόλις περάσουν μερικές κινήσεις, εδώ θα εμφανίζονται πρακτικές προτάσεις για τον κύκλο.'});
    return actions;
  }

  if(remainingDays>0 && income>0){
    const tone=avg>safeDaily && safeDaily>0?'amber':'green';
    actions.push({
      icon:tone==='amber'?'⚠️':'✅',
      tone,
      title:'Ρυθμός μέχρι την επόμενη πληρωμή',
      text:tone==='amber'
        ? `Ο μέσος ρυθμός σου είναι ${fmt(avg)} / ημέρα, ενώ με το υπόλοιπο budget μένουν περίπου ${fmt(safeDaily)} / ημέρα για ${remainingDays} ημέρες.`
        : `Ο ρυθμός σου είναι ελεγχόμενος. Μέση ημέρα ${fmt(avg)} και ασφαλές υπόλοιπο περίπου ${fmt(safeDaily)} / ημέρα.`
    });
  }

  const fixedFlexibleBase=totals.daily+totals.fixed;
  if(fixedFlexibleBase>0){
    const fixedPct=Math.round(totals.fixed/fixedFlexibleBase*100);
    actions.push({
      icon:'📌',
      tone:fixedPct>=45?'amber':'blue',
      title:'Πάγια vs flexible',
      text:`Τα πάγια είναι ${fixedPct}% των βασικών εξόδων του κύκλου. Flexible: ${fmt(totals.daily)}, πάγια: ${fmt(totals.fixed)}.`
    });
  }

  const topMerchant=grouped.byMerchant?.[0];
  if(topMerchant){
    actions.push({
      icon:'🏪',
      tone:topMerchant.total/total>=0.25?'amber':'purple',
      title:'Top merchant',
      text:`Το ${esc(topMerchant.key)} έχει ${fmt(topMerchant.total)} σε ${topMerchant.count} ${topMerchant.count===1?'κίνηση':'κινήσεις'}.`
    });
  }

  const topSub=grouped.bySubcategory?.[0];
  if(topSub){
    actions.push({
      icon:'🧭',
      tone:topSub.total/total>=0.30?'amber':'blue',
      title:'Top υποκατηγορία',
      text:`Η πιο δυνατή υποκατηγορία είναι ${esc(topSub.key)} με ${fmt(topSub.total)}.`
    });
  }

  const foodTotal=(grouped.byCategory?.get?.('Τρόφιμα')||0)+(grouped.byCategory?.get?.('Φαγητό έξω')||0)+(grouped.byCategory?.get?.('Καφέδες')||0);
  if(foodTotal>0){
    const pct=Math.round(foodTotal/total*100);
    actions.push({
      icon:'🍽️',
      tone:pct>=35?'amber':'purple',
      title:'Φαγητό / καφές',
      text:`Φαγητό, καφέδες και supermarket είναι ${pct}% των εξόδων του κύκλου (${fmt(foodTotal)}).`
    });
  }

  const ticket=reportsTicketUsageModel();
  if(ticket.totalUsed>0){
    actions.push({
      icon:'🎟️',
      tone:'green',
      title:'Ticket / Voucher',
      text:`Χρησιμοποιήθηκαν ${fmt(ticket.totalUsed)} και μένουν ${fmt(ticket.totalRemaining)} σε restricted παροχές.`
    });
  }

  return actions.slice(0,5);
}

function reportsRenderActionItems(items,total,groups){
  const el=$('reportsActionList');
  if(!el)return;
  const actions=reportsBuildActionItems(items,total,groups);
  el.innerHTML=actions.map(a=>`
    <article class="reports-action-item ${reportsActionToneClass(a.tone)}">
      <span>${a.icon}</span>
      <div>
        <strong>${esc(a.title)}</strong>
        <p>${a.text}</p>
      </div>
    </article>`).join('');
}

function reportsRenderFoundationSections(items){
  reportsRenderCycleGrid(items);

  const expenseTotal=items.reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const bySubcategory=reportsGroupRows(items,e=>e.subcategory?`${e.category} › ${e.subcategory}`:'',reportsBudgetOutAmount);
  const byWallet=reportsGroupRows(items,e=>e.paymentSourceName||'Budget / Μετρητά',reportsBudgetOutAmount);
  const byMerchant=reportsGroupRows(items,e=>e.merchantName||'',reportsBudgetOutAmount);
  const byCategoryMap=new Map();
  (items||[]).forEach(e=>{
    const amount=reportsBudgetOutAmount(e);
    if(amount<=0)return;
    const key=e.category||'Άλλο';
    byCategoryMap.set(key,(byCategoryMap.get(key)||0)+amount);
  });

  reportsRenderActionItems(items,expenseTotal,{bySubcategory,byWallet,byMerchant,byCategory:byCategoryMap});
  reportsRenderMiniList('reportsSubcategoryList',bySubcategory,expenseTotal,{empty:'Δεν υπάρχουν αρκετές υποκατηγορίες ακόμα.',limit:6,showCount:true});
  reportsRenderMiniList('reportsWalletList',byWallet,expenseTotal,{empty:'Δεν υπάρχουν πηγές πληρωμής για τον κύκλο.',limit:5,showCount:true});
  reportsRenderMiniList('reportsMerchantList',byMerchant,expenseTotal,{empty:'Δεν υπάρχουν merchants/καταστήματα ακόμα.',limit:5,showCount:true});
  reportsRenderTicketUsage();
}

function rStats(){
  const items=reportsAllMonthlyItems(curM);
  const total=items.reduce((s,e)=>s+reportsBudgetOutAmount(e),0);

  const byCategory={};
  items.forEach(e=>{
    const amount=reportsBudgetOutAmount(e);
    if(amount<=0)return;
    const key=e.category||'Άλλο';
    byCategory[key]=(byCategory[key]||0)+amount;
  });

  const sorted=Object.entries(byCategory).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const topCategory=sorted[0]||['—',0];
  const topPct=total>0?Math.round(topCategory[1]/total*100):0;

  const largest=items
    .filter(e=>e.type!=='card')
    .sort((a,b)=>reportsBudgetOutAmount(b)-reportsBudgetOutAmount(a))[0] || [...items].sort((a,b)=>reportsBudgetOutAmount(b)-reportsBudgetOutAmount(a))[0];

  const cycle=getCurrentBudgetCycle();
  const elapsed=reportsCurrentCycleElapsedDays();
  const avg=elapsed>0?total/elapsed:0;

  const prevKey=reportsPreviousMonthKey(curM);
  const prevTotal=reportsAllMonthlyItems(prevKey).reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const prevAvg=prevTotal>0?prevTotal/new Date(Number(prevKey.split('-')[0]),Number(prevKey.split('-')[1]),0).getDate():0;

  if($('reportsTotal'))$('reportsTotal').textContent=fmt(total);
  if($('reportsTotalDelta'))$('reportsTotalDelta').textContent='τρέχων κύκλος';
  if($('reportsAvgDay'))$('reportsAvgDay').textContent=fmt(avg);
  if($('reportsAvgDelta'))$('reportsAvgDelta').textContent=`${elapsed} ημέρες κύκλου`;
  if($('reportsTopCategory'))$('reportsTopCategory').textContent=topCategory[0];
  if($('reportsTopPct'))$('reportsTopPct').textContent=`${topPct}% των εξόδων`;
  if($('reportsLargestTx'))$('reportsLargestTx').textContent=fmt(reportsBudgetOutAmount(largest));
  if($('reportsLargestTxMeta'))$('reportsLargestTxMeta').textContent=largest?`${largest.displayTitle||largest.name} · ${reportsShortDate(largest.date)}`:'—';

  reportsRenderFoundationSections(items);

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
    text:'Οι αναφορές μετρούν μόνο actual κινήσεις που επηρεάζουν πραγματικά το budget του κύκλου.'
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
      text:`Τα έξοδα φαγητού/καφέ είναι <strong>${Math.round(foodTotal/total*100)}%</strong> του κύκλου.`
    });
  }else{
    const freeAfterFixed=(Number(D.income)||0)-(typeof allFixedTotal==='function'?allFixedTotal():0);
    insights.push({
      icon:'💡',
      tone:'purple',
      text:`Μετά τις σταθερές υποχρεώσεις μένουν <strong>${fmt(Math.max(0,freeAfterFixed))}</strong> για ευέλικτη χρήση.`
    });
  }

  const ticketModel=reportsTicketUsageModel();
  if(ticketModel.totalUsed>0){
    insights.push({
      icon:'🎟️',
      tone:'green',
      text:`Ticket/Voucher χρήση: <strong>${fmt(ticketModel.totalUsed)}</strong>, υπόλοιπο ${fmt(ticketModel.totalRemaining)}.`
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
    days.push({label:`${d.getDate()}/${d.getMonth()+1}`,total:movementItems.filter(e=>e.date===k).reduce((s,e)=>s+reportsBudgetOutAmount(e),0)});
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
  const total=items.reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const byCategory={};
  items.forEach(e=>{
    const amount=reportsBudgetOutAmount(e);
    if(amount<=0)return;
    byCategory[e.category]=(byCategory[e.category]||0)+amount;
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
  const total=items.reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const daily=reportsCurrentMovementItems();
  const elapsed=reportsCurrentCycleElapsedDays();
  const avg=elapsed>0?total/elapsed:0;

  const byDay={};
  daily.forEach(e=>{
    const key=e.date||'';
    if(key)byDay[key]=(byDay[key]||0)+reportsBudgetOutAmount(e);
  });
  const topDay=Object.entries(byDay).sort((a,b)=>b[1]-a[1])[0];

  const byPay={};
  daily.forEach(e=>{
    const name=e.paymentSourceName || e.paymentSourceType || 'Budget / Μετρητά';
    byPay[name]=(byPay[name]||0)+reportsBudgetOutAmount(e);
  });
  const topPay=Object.entries(byPay).sort((a,b)=>b[1]-a[1])[0];

  const largest=items
    .filter(e=>e.type!=='card')
    .sort((a,b)=>reportsBudgetOutAmount(b)-reportsBudgetOutAmount(a))[0] || [...items].sort((a,b)=>reportsBudgetOutAmount(b)-reportsBudgetOutAmount(a))[0];

  const {rows}=reportsBuildCategoryRows();
  const topCategory=rows[0];

  const prevKey=reportsPreviousMonthKey(curM);
  const prevItems=reportsAllMonthlyItems(prevKey);
  const prevTotal=prevItems.reduce((s,e)=>s+reportsBudgetOutAmount(e),0);
  const diff=prevTotal>0?total-prevTotal:null;

  const cards=[
    {icon:'📅',label:'Μέση ημερήσια δαπάνη',value:fmt(avg),meta:`Υπολογισμός σε ${elapsed} ημέρες κύκλου`},
    {icon:'🔥',label:'Ημέρα με τα περισσότερα έξοδα',value:topDay?fmt(topDay[1]):'—',meta:topDay?reportsShortDate(topDay[0]):'Δεν υπάρχουν ημερήσιες κινήσεις'},
    {icon:'💳',label:'Πιο συχνή πηγή πληρωμής',value:topPay?esc(topPay[0]):'—',meta:topPay?fmt(topPay[1]):'Δεν υπάρχουν πηγές πληρωμής'},
    {icon:'↗',label:'Μεγαλύτερη συναλλαγή',value:fmt(reportsBudgetOutAmount(largest)),meta:largest?`${esc(largest.displayTitle||largest.name)} · ${reportsShortDate(largest.date)}`:'—'},
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

// ===== END 04a-reports.js =====
