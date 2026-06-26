// CAPVO app split: 04b-archive.js
// Archive: cycles, months, snapshots, top categories, timeline rendering
// Source: 04-reports-archive.js lines 829-1565



let archiveExpandedItem = '';
let archiveViewMode = localStorage.getItem('capvoArchiveMode') || 'cycles';
if(!['cycles','months'].includes(archiveViewMode))archiveViewMode='cycles';

// ===== CACHE LAYER for archiveBuildCycles =====
// Prevents expensive re-computation on every render. Bump __archiveCacheVersion when data changes.
let __archiveCacheVersion = 0;
let __archiveCached = null;
window.capvoArchiveCacheVersion = () => __archiveCacheVersion;
window.capvoInvalidateArchiveCache = () => { __archiveCacheVersion++; __archiveCached = null; };
function archiveBuildCyclesCached(){
  if(__archiveCached && __archiveCached.version === __archiveCacheVersion){
    return __archiveCached.data;
  }
  const data = archiveBuildCycles();
  __archiveCached = { version: __archiveCacheVersion, data };
  return data;
}

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

function archiveCashImpactAmount(row){
  if(!row)return 0;
  if(String(row.archiveKind||'')==='benefit')return 0;
  return Number(row.budgetImpactAmount ?? row.amount)||0;
}

function archiveBenefitAmount(row){
  if(!row || String(row.archiveKind||'')!=='benefit')return 0;
  return Number(row.benefitAmount ?? row.amount)||0;
}

function archiveBenefitSourceForExpense(row){
  const sourceId=row?.paymentSourceId||row?.payment_source_id||'';
  const source=sourceId ? (D.incomeSources||[]).find(s=>String(s.id)===String(sourceId)) : null;
  if(source && (typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(source):(source.restriction&&source.restriction!=='none')))return source;
  const type=String(row?.paymentAccountType||row?.payment_account_type||'').toLowerCase();
  if(type==='restricted_balance')return source || {name:row?.paymentSourceName||row?.payment_source_name||'Παροχή'};
  return null;
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

function archiveBenefitRowsInRange(start,end){
  return archiveRowsInRange(start,end)
    .map(row=>{
      const source=archiveBenefitSourceForExpense(row);
      if(!source)return null;
      const isCard=!!(row.isCreditCardPurchase || row.is_credit_card_purchase || row.creditCardId || row.credit_card_id || row.installmentPlanId || row.installment_plan_id);
      if(isCard)return null;
      const amount=typeof capvoMoney==='function'?capvoMoney(Number(row.amount)||0):(Number(row.amount)||0);
      if(amount<=0)return null;
      return {
        ...row,
        name:row.name||row.merchantName||row.merchant_name||source.name||'Χρήση παροχής',
        category:row.category||source.restrictedCategory||source.category||'Παροχές',
        amount,
        benefitAmount:amount,
        budgetImpactAmount:0,
        archiveKind:'benefit',
        paymentSourceName:row.paymentSourceName||row.payment_source_name||source.name||'Παροχή'
      };
    })
    .filter(Boolean);
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
      // Since v1.14.0 Goals are virtual tracking. Manual goal deposits/withdrawals
      // should stay in the goal history and must not pollute archive cash outflows.
      if(source.includes('goal_manual'))return null;
      const raw=typeof capvoMoney==='function'?capvoMoney(Number(t.amount)||0):(Number(t.amount)||0);
      if(raw===0)return null;
      const abs=Math.abs(raw);
      const isWithdrawal=type==='withdrawal' || raw<0;
      const impact=typeof capvoMoney==='function'?capvoMoney(isWithdrawal?-abs:abs):(isWithdrawal?-abs:abs);
      const goal=typeof savingsGoalById==='function'?savingsGoalById(t.goalId||t.goal_id):null;
      return {
        id:t.id||`archive_savings_${date}`,
        name:isWithdrawal?`Επιστροφή από ${goal?.name||'στόχο'}`:`Μεταφορά σε ${goal?.name||'στόχο'}`,
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

  return (Array.isArray(D?.fixedExpensePayments)?D.fixedExpensePayments:[])
    .filter(p=>typeof capvoFixedExpensePaymentIsCountable==='function' ? capvoFixedExpensePaymentIsCountable(p) : String(p.status||'paid')!=='reversed')
    .map(p=>{
      const fx=typeof capvoFixedExpensePaymentExpense==='function'
        ? capvoFixedExpensePaymentExpense(p)
        : (typeof capvoFixedExpenseById==='function'
          ? capvoFixedExpenseById(p.fixedExpenseId||p.fixed_expense_id)
          : (D.fixedExpenses||[]).find(e=>String(e.id)===String(p.fixedExpenseId||p.fixed_expense_id)));
      if(!fx)return null;
      const date=typeof normalizeDateValue==='function'
        ? normalizeDateValue(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||p.createdAt||p.created_at)
        : String(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||p.createdAt||p.created_at||'').slice(0,10);
      const d=archiveAsDate(date);
      if(!d || d<s || d>e)return null;
      const amount=typeof capvoMoney==='function'?capvoMoney(Number(p.amount)||0):(Number(p.amount)||0);
      if(amount<=0)return null;
      const wallet=(p.walletId||p.wallet_id) && typeof capvoWalletById==='function'?capvoWalletById(p.walletId||p.wallet_id):null;
      return {
        id:p.id||`archive_fixed_payment_${date}`,
        name:fx.name||'Πληρωμή παγίου',
        category:fx.category||'Πάγια',
        amount,
        budgetImpactAmount:amount,
        date,
        paymentSourceName:wallet?.name||'Wallet',
        notes:p.note||p.notes||'',
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
    ...archiveSavingsBudgetRowsInRange(start,end),
    ...archiveBenefitRowsInRange(start,end)
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
  const fixedDates=(Array.isArray(D?.fixedExpensePayments)?D.fixedExpensePayments:[])
    .filter(p=>typeof capvoFixedExpensePaymentIsCountable==='function' ? capvoFixedExpensePaymentIsCountable(p) : String(p.status||'paid')!=='reversed')
    .map(p=>archiveAsDate(p.paidAt||p.paid_at||p.paidForDate||p.paid_for_date||p.createdAt||p.created_at)).filter(Boolean);
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
  const daily=dailyRows.reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const fixed=movementRows.filter(r=>r.archiveKind==='fixed').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const cards=movementRows.filter(r=>r.archiveKind==='card_payment').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const savings=movementRows.filter(r=>r.archiveKind==='savings').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const benefits=movementRows.filter(r=>r.archiveKind==='benefit').reduce((s,e)=>s+archiveBenefitAmount(e),0);
  const total=movementRows.reduce((s,e)=>s+archiveCashImpactAmount(e),0);
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
    daily,fixed,cards,savings,benefits,total,income,balance
  };
}

function archiveMonthSnapshot(k){
  const [y,m]=String(k).split('-').map(Number);
  const start=new Date(y,(m||1)-1,1,12);
  const end=new Date(y,(m||1),0,12);
  const movementRows=archiveBudgetMovementsInRange(start,end);
  const dailyRows=movementRows.filter(r=>r.archiveKind==='daily');
  const daily=dailyRows.reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const fixed=movementRows.filter(r=>r.archiveKind==='fixed').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const cards=movementRows.filter(r=>r.archiveKind==='card_payment').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const savings=movementRows.filter(r=>r.archiveKind==='savings').reduce((s,e)=>s+archiveCashImpactAmount(e),0);
  const benefits=movementRows.filter(r=>r.archiveKind==='benefit').reduce((s,e)=>s+archiveBenefitAmount(e),0);
  const total=movementRows.reduce((s,e)=>s+archiveCashImpactAmount(e),0);
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
    daily,fixed,cards,savings,benefits,total,income,balance
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
    const value=archiveCashImpactAmount(e);
    if(value<=0)return;
    const cat=e.category||'Άλλο';
    map[cat]=(map[cat]||0)+value;
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

function archiveMovementKindLabel(kind){
  if(kind==='fixed')return 'Πάγιο πληρωμένο';
  if(kind==='card_payment')return 'Πληρωμή κάρτας';
  if(kind==='savings')return 'Στόχος / αποταμίευση';
  if(kind==='benefit')return 'Παροχή';
  return 'Έξοδο budget';
}

function archiveRecentMovementsHtml(rows){
  const recent=[...(rows||[])]
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
    .slice(0,6);
  if(!recent.length)return '<div class="archive-empty-mini">Δεν υπάρχουν πραγματικές κινήσεις σε αυτή την περίοδο.</div>';
  return `<div class="archive-movement-list">${recent.map(row=>{
    const kind=String(row.archiveKind||'daily');
    const isBenefit=kind==='benefit';
    const amount=isBenefit?archiveBenefitAmount(row):archiveCashImpactAmount(row);
    const sign=isBenefit?'':(amount>0?'-':'');
    const title=row.name||row.merchantName||row.merchant_name||archiveMovementKindLabel(kind);
    const meta=[archiveMovementKindLabel(kind),row.category||'',row.paymentSourceName||''].filter(Boolean).join(' · ');
    return `<div class="archive-movement-row ${isBenefit?'is-benefit':''}">
      <div>
        <strong>${esc(title)}</strong>
        <span>${esc(meta)}</span>
      </div>
      <em>${sign}${fmt(Math.abs(amount))}</em>
    </div>`;
  }).join('')}</div>`;
}

function archiveArchivedObjectsHtml(){
  const wallets=typeof capvoArchivedWallets==='function'?capvoArchivedWallets():[];
  const goals=typeof archivedSavingsGoals==='function'?archivedSavingsGoals().filter(g=>typeof savingsGoalKind==='function'?savingsGoalKind(g)==='target':true):[];
  const fixed=(D.fixedExpenseArchive||[]).filter(f=>!!f.deletedAt);
  const total=wallets.length+goals.length+fixed.length;
  if(!total)return '';
  return `<section class="archive-objects-card">
    <div class="archive-section-head">
      <div>
        <span>ARCHIVED ITEMS</span>
        <h3>Αρχειοθετημένα αντικείμενα</h3>
      </div>
    </div>
    <p>Δεν μπερδεύονται με το οικονομικό ιστορικό. Εδώ απλώς βλέπεις τι έχει κρυφτεί από ενεργές λίστες.</p>
    <div class="archive-objects-grid">
      <div><span>Λογαριασμοί</span><strong>${wallets.length}</strong></div>
      <div><span>Στόχοι</span><strong>${goals.length}</strong></div>
      <div><span>Πάγια</span><strong>${fixed.length}</strong></div>
    </div>
  </section>`;
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
        <div><span>Πάγια πληρωμένα</span><strong>${fmt(snap.fixed)}</strong></div>
        <div><span>Πληρωμές καρτών</span><strong>${fmt(snap.cards)}</strong></div>
        <div><span>Στόχοι</span><strong>${fmt(snap.savings||0)}</strong></div>
        <div><span>Έξοδα budget</span><strong>${fmt(snap.daily)}</strong></div>
        <div><span>Ticket / Voucher</span><strong>${fmt(snap.benefits||0)}</strong></div>
      </div>

      <div class="archive-actual-note">
        Τα πάγια εδώ είναι μόνο όσα πληρώθηκαν πραγματικά. Τα προγραμματισμένα πάγια δεν μετράνε σαν έξοδο.
      </div>

      <div class="archive-expanded-title">Τελευταίες πραγματικές κινήσεις</div>
      ${archiveRecentMovementsHtml(snap.movementRows)}

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
          <div><span>Έξοδα budget</span><strong>${fmt(snap.daily)}</strong></div>
          <div><span>Πραγματικό cash out</span><strong>${fmt(snap.total)}</strong></div>
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
      ${archiveArchivedObjectsHtml()}
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

  const cycles=archiveBuildCyclesCached();
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
// ===== END 04b-archive.js =====
