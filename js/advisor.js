// ===== CAPVO ADVISOR MODULE =====
// v1.8.6.9 production-wise advisor with orphan-plan-safe card intelligence.
// The advisor is now based on the same budget-impact model as Dashboard,
// Cards, Savings and Transactions. It does not treat every raw movement as
// a cash expense.

function capvoAdvisorSum(rows, mapper){
  return capvoMoney((rows||[]).reduce((sum,row)=>sum+(Number(mapper?mapper(row):row)||0),0));
}

function capvoAdvisorPercent(value,total){
  const base=Number(total)||0;
  if(base<=0)return 0;
  return Math.round((Number(value)||0)/base*100);
}

function capvoAdvisorDaysBetween(start,end){
  const s=start instanceof Date?start:capvoParseDateKey(start);
  const e=end instanceof Date?end:capvoParseDateKey(end);
  if(!s||!e)return 1;
  const ms=24*60*60*1000;
  return Math.max(1,Math.floor((e-s)/ms)+1);
}

function capvoAdvisorToday(){
  const now=new Date();
  return new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
}

function capvoAdvisorClamp(n,min,max){
  n=Number(n)||0;
  return Math.min(max,Math.max(min,n));
}

function capvoAdvisorMovementAmount(row){
  if(typeof capvoMovementBudgetImpact==='function')return capvoMovementBudgetImpact(row);
  if(row?.affectsBudget===false || row?.affectsCashBudget===false || row?.affects_cash_budget===false)return 0;
  return capvoMoney(Number(row?.amount)||0);
}

function capvoAdvisorCardDebt(){
  const cards=Array.isArray(D?.creditCards)?D.creditCards:[];
  return capvoMoney(cards.reduce((sum,c)=>{
    if(!c || c.isActive===false || c.is_active===false)return sum;
    if(typeof cardDisplayDebt==='function')return sum+(Number(cardDisplayDebt(c))||0);
    return sum+(Number(c.balance)||0);
  },0));
}

function capvoAdvisorCardLimit(){
  const cards=Array.isArray(D?.creditCards)?D.creditCards:[];
  return capvoMoney(cards.reduce((sum,c)=>sum+(Number(c?.limit||c?.limitAmount||c?.limit_amount)||0),0));
}

function capvoAdvisorFloorToStep(value,step=5){
  const v=Number(value)||0;
  if(v<=0)return 0;
  return capvoMoney(Math.floor(v/step)*step);
}

function capvoAdvisorCardBaseDebtTotal(){
  const cards=Array.isArray(D?.creditCards)?D.creditCards:[];
  return capvoMoney(cards.reduce((sum,c)=>{
    if(!c || c.isActive===false || c.is_active===false)return sum;
    if(String(c.accountType||c.account_type||'credit_card')==='loan')return sum;
    if(typeof cardBaseDebt==='function')return sum+(Number(cardBaseDebt(c))||0);
    return sum+(Number(c.balance)||0);
  },0));
}

function capvoAdvisorActiveCardIdSet(){
  const cards=Array.isArray(D?.creditCards)?D.creditCards:[];
  return new Set(cards
    .filter(c=>c && !(c.isActive===false||c.is_active===false))
    .map(c=>String(c.id||c.cardId||c.card_id||''))
    .filter(Boolean));
}

function capvoAdvisorActiveCardPlans(){
  const plans=Array.isArray(D?.creditCardInstallmentPlans)?D.creditCardInstallmentPlans:[];
  const activeCardIds=capvoAdvisorActiveCardIdSet();
  if(activeCardIds.size<=0)return [];
  return plans.filter(p=>{
    if(String(p?.status||'active')!=='active')return false;
    const cardId=String(p?.cardId||p?.card_id||'');
    if(!cardId)return false;
    return activeCardIds.has(cardId);
  });
}

function capvoAdvisorPlanRemaining(plan){
  if(typeof capvoPlanRemainingAmount==='function')return capvoMoney(capvoPlanRemainingAmount(plan));
  const total=Number(plan?.totalAmount||plan?.total_amount)||0;
  const paid=Number(plan?.paidAmount||plan?.paid_amount)||0;
  return capvoMoney(Math.max(0,total-paid));
}

function capvoAdvisorCardMinPaymentTotal(){
  const cards=Array.isArray(D?.creditCards)?D.creditCards:[];
  return capvoMoney(cards.reduce((sum,c)=>{
    if(!c || c.isActive===false || c.is_active===false)return sum;
    const debt=typeof cardDisplayDebt==='function'?Number(cardDisplayDebt(c))||0:Number(c.balance)||0;
    if(debt<=0)return sum;
    if(typeof effectiveCardMinPay==='function')return sum+(Number(effectiveCardMinPay(c))||0);
    return sum+(Number(c.minPay||c.min_pay)||0);
  },0));
}

function capvoAdvisorBuildCardAdvice(baseModel){
  const income=Number(baseModel?.income)||0;
  const balance=Number(baseModel?.balance)||0;
  const remainingDays=Math.max(1,Number(baseModel?.remainingDays)||1);
  const totalDays=Math.max(1,Number(baseModel?.totalDays)||30);
  const dailyAllowance=Number(baseModel?.dailyAllowance)||0;
  const cardDebt=Number(baseModel?.cardDebt)||0;
  const cardLimit=Number(baseModel?.cardLimit)||0;
  const cardUsagePct=Number(baseModel?.cardUsagePct)||0;

  const plans=capvoAdvisorActiveCardPlans();
  const activePlans=plans.filter(p=>capvoAdvisorPlanRemaining(p)>0);
  const installmentRemaining=capvoMoney(activePlans.reduce((sum,p)=>sum+capvoAdvisorPlanRemaining(p),0));
  const monthlyInstallments=capvoMoney(activePlans.reduce((sum,p)=>{
    const total=Number(p?.totalAmount||p?.total_amount)||0;
    const count=Math.max(1,Number(p?.installmentCount||p?.installment_count)||1);
    const amount=Number(p?.installmentAmount||p?.installment_amount)||total/count;
    return sum+(Number(amount)||0);
  },0));
  const baseDebt=capvoAdvisorCardBaseDebtTotal();
  const minPayment=capvoAdvisorCardMinPaymentTotal();
  const installmentRatio=capvoAdvisorPercent(monthlyInstallments,income);
  const debtRatio=capvoAdvisorPercent(cardDebt,income);

  const averageDailyBudget=income>0?income/totalDays:0;
  const safeDailyFloor=capvoMoney(Math.min(25,Math.max(10,averageDailyBudget*.50)));
  const minimumDailyFloor=capvoMoney(Math.min(15,Math.max(7,averageDailyBudget*.25)));
  const safeCapacity=capvoMoney(Math.max(0,balance-(safeDailyFloor*remainingDays)));
  const stretchCapacity=capvoMoney(Math.max(0,balance-(minimumDailyFloor*remainingDays)));
  const safePayment=capvoAdvisorFloorToStep(Math.min(cardDebt,safeCapacity),5);
  const maxWithoutPressure=capvoAdvisorFloorToStep(Math.min(cardDebt,stretchCapacity),5);
  let recommendedPayment=0;
  if(cardDebt>0 && safePayment>0){
    if(minPayment>0 && minPayment<=safePayment){
      recommendedPayment=capvoAdvisorFloorToStep(Math.min(safePayment,Math.max(minPayment,safePayment*.40)),5);
    }else{
      recommendedPayment=capvoAdvisorFloorToStep(Math.min(safePayment,safePayment*.35),5);
    }
    if(recommendedPayment<=0 && safePayment>0)recommendedPayment=Math.min(safePayment,cardDebt);
  }
  const afterSafeDaily=safePayment>0?capvoMoney((balance-safePayment)/remainingDays):dailyAllowance;
  const afterRecommendedDaily=recommendedPayment>0?capvoMoney((balance-recommendedPayment)/remainingDays):dailyAllowance;

  const cardsWithDebt=(Array.isArray(D?.creditCards)?D.creditCards:[])
    .filter(c=>c && !(c.isActive===false||c.is_active===false))
    .filter(c=>{
      const debt=typeof cardDisplayDebt==='function'?Number(cardDisplayDebt(c))||0:Number(c.balance)||0;
      return debt>0;
    }).length;

  const insights=[];
  if(cardDebt<=0){
    insights.push({type:'success',icon:'✅',title:'Δεν υπάρχει ενεργό χρέος καρτών',text:'Οι κάρτες δεν πιέζουν τον τρέχοντα κύκλο.'});
  }else{
    if(safePayment>0){
      insights.push({type:'success',icon:'💳',title:'Υπάρχει ασφαλής χώρος πληρωμής',text:`Μπορείς να πληρώσεις έως ${fmt(safePayment)} κρατώντας περίπου ${fmt(afterSafeDaily)} ανά ημέρα.`});
    }else{
      insights.push({type:'warning',icon:'⏳',title:'Όχι άλλη πληρωμή κάρτας τώρα',text:`Με το τρέχον υπόλοιπο, προτεραιότητα είναι να κρατήσεις το budget μέχρι την πληρωμή.`});
    }

    if(minPayment>0 && safePayment>0 && minPayment>safePayment){
      insights.push({type:'danger',icon:'⚠️',title:'Η ελάχιστη πληρωμή πιέζει',text:`Η εκτίμηση ελάχιστης πληρωμής είναι ${fmt(minPayment)}, πάνω από τον ασφαλή χώρο ${fmt(safePayment)}.`});
    }

    if(cardUsagePct>=80){
      insights.push({type:'danger',icon:'📉',title:'Υψηλή χρήση ορίου',text:`Η χρήση πιστωτικού ορίου είναι περίπου ${cardUsagePct}%. Απόφυγε νέες αγορές με κάρτα.`});
    }else if(cardUsagePct>=60){
      insights.push({type:'warning',icon:'📉',title:'Μέτρια προς υψηλή χρήση ορίου',text:`Η χρήση ορίου είναι ${cardUsagePct}%. Κράτα τις νέες αγορές χαμηλά.`});
    }

    if(installmentRatio>=12){
      insights.push({type:'warning',icon:'🧾',title:'Οι δόσεις πιέζουν τον κύκλο',text:`Οι ενεργές δόσεις είναι περίπου ${fmt(monthlyInstallments)} / κύκλο (${installmentRatio}% του budget).`});
    }else if(activePlans.length>0){
      insights.push({type:'info',icon:'🧾',title:'Υπάρχουν ενεργά πλάνα δόσεων',text:`Έχεις ${activePlans.length} ενεργό${activePlans.length===1?' πλάνο':'ά πλάνα'} με υπόλοιπο ${fmt(installmentRemaining)}.`});
    }

    if(debtRatio>=60){
      insights.push({type:'danger',icon:'🔥',title:'Μεγάλο χρέος σε σχέση με budget',text:`Το χρέος καρτών είναι ${debtRatio}% του budget κύκλου. Θέλει σταδιακή μείωση.`});
    }
  }

  return {
    cardsWithDebt,
    baseDebt,
    installmentRemaining,
    activePlanCount:activePlans.length,
    monthlyInstallments,
    installmentRatio,
    minPayment,
    safeDailyFloor,
    minimumDailyFloor,
    safePayment,
    maxWithoutPressure,
    recommendedPayment,
    afterSafeDaily,
    afterRecommendedDaily,
    debtRatio,
    cardUsagePct,
    insights:insights.slice(0,5)
  };
}

function capvoAdvisorTopCategory(rows){
  const totals={};
  (rows||[]).forEach(row=>{
    const cat=row.category||'Άλλο';
    const amount=Math.abs(Number(capvoAdvisorMovementAmount(row))||Number(row.amount)||0);
    if(amount<=0)return;
    totals[cat]=(totals[cat]||0)+amount;
  });
  const sorted=Object.entries(totals)
    .map(([category,total])=>({category,total:capvoMoney(total)}))
    .sort((a,b)=>b.total-a.total);
  return sorted[0]||{category:'—',total:0};
}

function capvoAdvisorDateKeyFromDate(date){
  const d=date instanceof Date?date:new Date(date);
  if(Number.isNaN(d.getTime()))return typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function capvoAdvisorLastDateKeys(count){
  const days=Math.max(1,Number(count)||1);
  const base=capvoAdvisorToday();
  const out=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date(base);
    d.setDate(base.getDate()-i);
    out.push(capvoAdvisorDateKeyFromDate(d));
  }
  return out;
}

function capvoAdvisorMovementDateKey(row){
  if(typeof capvoMovementDate==='function')return capvoMovementDate(row);
  return normalizeDateValue(row?.date||row?.transactionDate||row?.transaction_date||row?.createdAt||row?.created_at)||todayISO();
}

function capvoAdvisorIsFixedMovement(row){
  return row?.isFixedExpense || String(row?.movementType||'')==='fixed_expense' || String(row?.paymentAccountType||'')==='fixed_expense';
}

function capvoAdvisorPositiveBudgetImpact(row){
  const amount=Number(capvoAdvisorMovementAmount(row))||0;
  return amount>0?amount:0;
}

function capvoAdvisorRecentAverage(allMovements,days=7){
  const keys=capvoAdvisorLastDateKeys(days);
  const totals=Object.fromEntries(keys.map(k=>[k,0]));
  (allMovements||[]).forEach(row=>{
    if(capvoAdvisorIsFixedMovement(row))return;
    const key=capvoAdvisorMovementDateKey(row);
    if(!Object.prototype.hasOwnProperty.call(totals,key))return;
    totals[key]+=capvoAdvisorPositiveBudgetImpact(row);
  });
  const values=keys.map(k=>capvoMoney(totals[k]||0));
  const total=values.reduce((s,n)=>s+n,0);
  return {
    days:keys.length,
    total:capvoMoney(total),
    average:capvoMoney(total/Math.max(1,keys.length)),
    values,
    keys
  };
}

function capvoAdvisorTodayNetImpact(allMovements){
  const today=typeof todayISO==='function'?todayISO():capvoAdvisorDateKeyFromDate(new Date());
  return capvoMoney((allMovements||[]).reduce((sum,row)=>{
    if(capvoAdvisorMovementDateKey(row)!==today)return sum;
    return sum+(Number(capvoAdvisorMovementAmount(row))||0);
  },0));
}

function capvoAdvisorBuildPracticalPlan(ctx){
  const income=Number(ctx?.income)||0;
  const balance=Number(ctx?.balance)||0;
  const remainingDays=Math.max(1,Number(ctx?.remainingDays)||1);
  const totalDays=Math.max(1,Number(ctx?.totalDays)||30);
  const allMovements=Array.isArray(ctx?.allMovements)?ctx.allMovements:[];
  const safePerDay=capvoMoney(balance/remainingDays);
  const safeToday=capvoAdvisorFloorToStep(Math.max(0,safePerDay),1);
  const comfortToday=capvoAdvisorFloorToStep(Math.max(0,safePerDay*.80),1);
  const stretchToday=capvoAdvisorFloorToStep(Math.max(0,safePerDay*1.20),1);
  const todayNet=capvoAdvisorTodayNetImpact(allMovements);
  const todayOutflow=capvoMoney((allMovements||[]).reduce((sum,row)=>{
    const key=capvoAdvisorMovementDateKey(row);
    const today=typeof todayISO==='function'?todayISO():capvoAdvisorDateKeyFromDate(new Date());
    if(key!==today || capvoAdvisorIsFixedMovement(row))return sum;
    return sum+capvoAdvisorPositiveBudgetImpact(row);
  },0));
  const recent=capvoAdvisorRecentAverage(allMovements,7);
  const recentAvg=Number(recent.average)||0;
  const safeForecast=capvoMoney(Math.max(0,balance-(safeToday*remainingDays)));
  const currentPaceForecast=capvoMoney(balance-(recentAvg*remainingDays));
  const conservativeForecast=capvoMoney(balance-((recentAvg>0?recentAvg*.70:safeToday*.70)*remainingDays));
  const overspendPerDay=currentPaceForecast<0?capvoMoney(Math.abs(currentPaceForecast)/remainingDays):0;

  let tone='good';
  let label='Σε καλό ρυθμό';
  let headline=`Μπορείς να κινηθείς γύρω στα ${fmt(Math.max(0,safeToday))} σήμερα.`;
  let action='Κράτα τις νέες κινήσεις κοντά στο ασφαλές ημερήσιο όριο και συνέχισε έτσι μέχρι την πληρωμή.';

  if(income<=0){
    tone='setup';
    label='Χρειάζεται setup';
    headline='Πρόσθεσε πρώτα budget για να βγει πρακτική πρόταση.';
    action='Πρόσθεσε Μισθό / Budget κύκλου.';
  }else if(balance<0){
    tone='bad';
    label='Χρειάζεται άμεση διόρθωση';
    headline=`Υπάρχει υπέρβαση ${fmt(Math.abs(balance))}.`;
    action='Πάγωσε μη απαραίτητες κινήσεις και διόρθωσε πρώτα την υπέρβαση.';
  }else if(safeToday<10){
    tone='bad';
    label='Πολύ πιεσμένο';
    headline=`Το ασφαλές περιθώριο είναι μόνο ${fmt(safeToday)} / ημέρα.`;
    action='Κράτα μόνο απαραίτητα έξοδα μέχρι την επόμενη πληρωμή.';
  }else if(currentPaceForecast<0){
    tone='warn';
    label='Ο ρυθμός σε οδηγεί σε πίεση';
    headline=`Με τον ρυθμό 7 ημερών προβλέπεται έλλειμμα ${fmt(Math.abs(currentPaceForecast))}.`;
    action=`Μείωσε τις ημερήσιες κινήσεις περίπου κατά ${fmt(overspendPerDay)} ή κράτα τες κάτω από ${fmt(safeToday)}.`;
  }else if(recentAvg>safeToday*1.25 && recentAvg>0){
    tone='warn';
    label='Πρόσεχε τον ρυθμό';
    headline=`Τις τελευταίες 7 ημέρες κινείσαι με περίπου ${fmt(recentAvg)} / ημέρα.`;
    action=`Ρίξε τον ρυθμό κοντά στα ${fmt(safeToday)} / ημέρα για να κρατήσεις τον κύκλο ασφαλή.`;
  }else if(balance>income*.10 && safeToday>=20){
    tone='good';
    label='Υπάρχει άνεση';
    headline=`Έχεις ασφαλές ημερήσιο περιθώριο περίπου ${fmt(safeToday)}.`;
    action='Μπορείς να κρατήσεις αυτό το όριο ή να μεταφέρεις μικρό μέρος σε αποταμίευση αν δεν έχεις άμεσες ανάγκες.';
  }

  const scenarios=[
    {
      label:'Αν κρατήσεις το ασφαλές όριο',
      value:capvoMoney(safeForecast),
      subtitle:`${fmt(safeToday)} / ημέρα μέχρι πληρωμή`,
      tone:safeForecast>=0?'good':'warn'
    },
    {
      label:'Με ρυθμό τελευταίων 7 ημερών',
      value:capvoMoney(currentPaceForecast),
      subtitle:recentAvg>0?`${fmt(recentAvg)} / ημέρα`:'δεν υπάρχουν αρκετές κινήσεις',
      tone:currentPaceForecast>=0?'good':'bad'
    },
    {
      label:'Με πιο συντηρητικό ρυθμό',
      value:capvoMoney(conservativeForecast),
      subtitle:recentAvg>0?`${fmt(recentAvg*.70)} / ημέρα`:`${fmt(safeToday*.70)} / ημέρα`,
      tone:conservativeForecast>=0?'good':'warn'
    }
  ];

  return {
    tone,
    label,
    headline,
    action,
    safeToday,
    comfortToday,
    stretchToday,
    todayNet,
    todayOutflow,
    recentAvg:capvoMoney(recentAvg),
    recentTotal:recent.total,
    recentDays:recent.days,
    currentPaceForecast,
    conservativeForecast,
    safeForecast,
    overspendPerDay,
    scenarios
  };
}

function capvoAdvisorBuildModel(){
  const income=capvoMoney(Number(D?.income)||0);
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const cycleLabel=cycle?.label||'Τρέχων κύκλος';
  const cycleStart=cycle?.start||capvoAdvisorToday();
  const cycleEnd=cycle?.end||capvoAdvisorToday();
  const totalDays=capvoAdvisorDaysBetween(cycleStart,cycleEnd);
  const today=capvoAdvisorToday();
  const elapsedDays=capvoAdvisorClamp(capvoAdvisorDaysBetween(cycleStart,today),1,totalDays);
  const remainingDays=typeof budgetCycleRemainingDays==='function'?budgetCycleRemainingDays():Math.max(1,totalDays-elapsedDays+1);

  const fixedTotalAmount=typeof fixedTotal==='function'?capvoMoney(fixedTotal()):0;
  const cardPayments=typeof ccPayTotal==='function'?capvoMoney(ccPayTotal()):0;
  const cashExpenses=capvoAdvisorSum(
    typeof getCurrentCycleBudgetExpenses==='function'?getCurrentCycleBudgetExpenses():[],
    row=>Number(row.amount)||0
  );
  const savingsMovements=typeof getCurrentCycleSavingsBudgetMovements==='function'?getCurrentCycleSavingsBudgetMovements():[];
  const savingsNet=capvoAdvisorSum(savingsMovements,row=>Number(row.amount)||0);
  const savingsIn=capvoAdvisorSum(savingsMovements,row=>Math.max(0,Number(row.amount)||0));
  const savingsOut=capvoAdvisorSum(savingsMovements,row=>Math.max(0,-(Number(row.amount)||0)));
  const fixedRows=typeof getCurrentCycleFixedExpenseMovements==='function'?getCurrentCycleFixedExpenseMovements():[];
  const budgetMovements=typeof getCurrentCycleBudgetMovements==='function'?getCurrentCycleBudgetMovements():[];
  const allMovements=typeof getCurrentCycleAllMovements==='function'?getCurrentCycleAllMovements():budgetMovements;

  const spent=capvoMoney(fixedTotalAmount+cardPayments+cashExpenses+savingsNet);
  const balance=capvoMoney(income-spent);
  const utilization=capvoAdvisorPercent(spent,income);
  const dailyAllowance=remainingDays>0?capvoMoney(balance/remainingDays):balance;
  const expectedByToday=capvoMoney(income*(elapsedDays/totalDays));
  const paceDiff=capvoMoney(spent-expectedByToday);
  const pacePct=capvoAdvisorPercent(spent,expectedByToday||income);

  const cardDebt=capvoAdvisorCardDebt();
  const cardLimit=capvoAdvisorCardLimit();
  const cardUsagePct=capvoAdvisorPercent(cardDebt,cardLimit);
  const debtFixed=(fixedRows||[])
    .filter(e=>String(e.category||'')==='Δάνεια')
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const debtPayments=capvoMoney(cardPayments+debtFixed);

  const needsCats=['Τρόφιμα','Μεταφορά','Στέγαση','Λογαριασμοί','Υγεία'];
  const wantsCats=['Καφέδες','Ψυχαγωγία','Φαγητό έξω','Ρούχα','Συνδρομές','Άλλο'];
  const fixedNeeds=(fixedRows||[])
    .filter(e=>needsCats.includes(e.category))
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const fixedWants=(fixedRows||[])
    .filter(e=>wantsCats.includes(e.category))
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const variableNeeds=(typeof getCurrentCycleBudgetExpenses==='function'?getCurrentCycleBudgetExpenses():[])
    .filter(e=>needsCats.includes(e.category))
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const variableWants=(typeof getCurrentCycleBudgetExpenses==='function'?getCurrentCycleBudgetExpenses():[])
    .filter(e=>!needsCats.includes(e.category))
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);

  const needs=capvoMoney(fixedNeeds+variableNeeds+debtPayments);
  const wants=capvoMoney(fixedWants+variableWants);
  const actualSavings=capvoMoney(Math.max(0,savingsNet));
  const unallocatedPositive=capvoMoney(Math.max(0,balance));
  const topCategory=capvoAdvisorTopCategory([
    ...(fixedRows||[]),
    ...(typeof getCurrentCycleBudgetExpenses==='function'?getCurrentCycleBudgetExpenses():[]),
    ...(typeof getCurrentCycleActualCardPayments==='function'?getCurrentCycleActualCardPayments():[]),
    ...(savingsMovements||[])
  ]);

  const fixedRatio=capvoAdvisorPercent(fixedTotalAmount,income);
  const debtRatio=capvoAdvisorPercent(debtPayments,income);
  const savingsRate=capvoAdvisorPercent(actualSavings,income);
  const balanceRate=capvoAdvisorPercent(balance,income);
  const cardAdvice=capvoAdvisorBuildCardAdvice({
    income,
    balance,
    remainingDays,
    totalDays,
    dailyAllowance,
    cardDebt,
    cardLimit,
    cardUsagePct
  });
  const practical=capvoAdvisorBuildPracticalPlan({
    income,
    balance,
    remainingDays,
    totalDays,
    dailyAllowance,
    allMovements
  });

  const health=capvoAdvisorHealthScore({
    income,
    spent,
    balance,
    utilization,
    dailyAllowance,
    remainingDays,
    fixedRatio,
    debtRatio,
    savingsRate,
    cardDebt,
    cardUsagePct,
    paceDiff,
    pacePct,
    actualSavings
  });

  const suggestions=capvoAdvisorSuggestions({
    income,
    balance,
    utilization,
    dailyAllowance,
    remainingDays,
    fixedTotalAmount,
    fixedRatio,
    debtPayments,
    debtRatio,
    cardDebt,
    cardUsagePct,
    savingsNet,
    actualSavings,
    savingsRate,
    topCategory,
    paceDiff,
    pacePct,
    health,
    cardAdvice,
    practical
  });

  return {
    income,
    cycle,
    cycleLabel,
    totalDays,
    elapsedDays,
    remainingDays,
    fixedTotalAmount,
    cardPayments,
    cashExpenses,
    savingsNet,
    savingsIn,
    savingsOut,
    spent,
    balance,
    utilization,
    dailyAllowance,
    expectedByToday,
    paceDiff,
    pacePct,
    cardDebt,
    cardLimit,
    cardUsagePct,
    debtPayments,
    needs,
    wants,
    actualSavings,
    unallocatedPositive,
    topCategory,
    fixedRatio,
    debtRatio,
    savingsRate,
    balanceRate,
    cardAdvice,
    practical,
    health,
    suggestions,
    allMovements,
    budgetMovements
  };
}

function capvoAdvisorHealthScore(ctx){
  let score=72;
  const reasons=[];

  if(ctx.income<=0){
    return {score:0,tone:'setup',label:'Χρειάζεται setup',desc:'Πρόσθεσε πρώτα budget/έσοδα για να γίνει σωστή αξιολόγηση.',reasons};
  }

  if(ctx.balance<0){
    score-=34;
    reasons.push({type:'danger',text:`Το budget έχει υπέρβαση ${fmt(Math.abs(ctx.balance))}.`});
  }else if(ctx.balance>ctx.income*.15){
    score+=8;
    reasons.push({type:'success',text:`Υπάρχει θετικό περιθώριο ${fmt(ctx.balance)} στον κύκλο.`});
  }

  if(ctx.utilization>100)score-=16;
  else if(ctx.utilization>90)score-=10;
  else if(ctx.utilization<75)score+=5;

  if(ctx.dailyAllowance<0)score-=15;
  else if(ctx.remainingDays>0 && ctx.dailyAllowance<10)score-=10;
  else if(ctx.remainingDays>0 && ctx.dailyAllowance>=25)score+=4;

  if(ctx.fixedRatio>60){
    score-=16;
    reasons.push({type:'warning',text:`Οι σταθερές υποχρεώσεις είναι ${ctx.fixedRatio}% του budget.`});
  }else if(ctx.fixedRatio>45){
    score-=8;
    reasons.push({type:'warning',text:`Τα πάγια είναι σχετικά υψηλά (${ctx.fixedRatio}%).`});
  }else if(ctx.fixedRatio>0){
    score+=4;
  }

  if(ctx.debtRatio>25){
    score-=16;
    reasons.push({type:'danger',text:`Οι πληρωμές χρεών/καρτών είναι ${ctx.debtRatio}% του budget.`});
  }else if(ctx.debtRatio>15){
    score-=7;
  }else if(ctx.debtRatio===0){
    score+=5;
  }

  if(ctx.cardUsagePct>80){
    score-=10;
    reasons.push({type:'warning',text:`Η χρήση πιστωτικού ορίου είναι υψηλή (${ctx.cardUsagePct}%).`});
  }

  if(ctx.savingsRate>=15)score+=8;
  else if(ctx.savingsRate>=5)score+=3;
  else score-=4;

  if(ctx.paceDiff>ctx.income*.15){
    score-=8;
    reasons.push({type:'warning',text:`Ο ρυθμός κατανάλωσης είναι μπροστά από τον κύκλο κατά ${fmt(ctx.paceDiff)}.`});
  }

  score=capvoAdvisorClamp(Math.round(score),0,100);
  const tone=score>=78?'good':score>=58?'ok':score>=38?'warn':'bad';
  const label=score>=86?'Πολύ δυνατή εικόνα':score>=78?'Καλή εικόνα':score>=58?'Σταθερό αλλά θέλει προσοχή':score>=38?'Πιεστικό πλάνο':'Κρίσιμο πλάνο';
  const desc=score>=78
    ? 'Ο κύκλος κινείται υγιώς με βάση τις πραγματικές εκροές budget.'
    : score>=58
      ? 'Υπάρχει βάση, αλλά θέλει έλεγχο στις επόμενες κινήσεις.'
      : score>=38
        ? 'Το πλάνο πιέζεται και χρειάζεται περιορισμό εξόδων.'
        : 'Χρειάζεται άμεση διόρθωση για να μην κλείσει αρνητικά ο κύκλος.';
  return {score,tone,label,desc,reasons};
}

function capvoAdvisorSuggestions(ctx){
  const list=[];

  if(ctx.balance<0){
    list.push({type:'danger',icon:'🚨',title:'Άμεση υπέρβαση budget',text:`Πρέπει να καλύψεις ${fmt(Math.abs(ctx.balance))}. Ξεκίνα από μη απαραίτητα έξοδα ή μείωσε κάποια προγραμματισμένη εκροή.`});
  }else{
    list.push({type:'success',icon:'✅',title:'Το budget κλείνει θετικά',text:`Με τα σημερινά δεδομένα μένουν ${fmt(ctx.balance)} μέχρι το τέλος του κύκλου.`});
  }

  if(ctx.remainingDays>0){
    if(ctx.dailyAllowance<0){
      list.push({type:'danger',icon:'⛔',title:'Δεν υπάρχει διαθέσιμο ημερήσιο όριο',text:'Μέχρι να διορθωθεί η υπέρβαση, κάθε νέο cash έξοδο χειροτερεύει το πλάνο.'});
    }else if(ctx.dailyAllowance<10){
      list.push({type:'warning',icon:'⚡',title:'Πολύ χαμηλό ημερήσιο όριο',text:`Για τις επόμενες ${ctx.remainingDays} ημέρες έχεις περίπου ${fmt(ctx.dailyAllowance)} ανά ημέρα.`});
    }else{
      list.push({type:'info',icon:'💡',title:'Ασφαλές ημερήσιο όριο',text:`Κράτα τις καθημερινές κινήσεις κοντά στα ${fmt(ctx.dailyAllowance)} για τις επόμενες ${ctx.remainingDays} ημέρες.`});
    }
  }

  if(ctx.practical){
    const p=ctx.practical;
    list.push({
      type:p.tone==='bad'?'danger':p.tone==='warn'?'warning':'info',
      icon:p.tone==='bad'?'🚨':p.tone==='warn'?'⚠️':'🧭',
      title:'Πρακτικό πλάνο σήμερα',
      text:p.action
    });
  }

  if(ctx.fixedRatio>55){
    list.push({type:'warning',icon:'🏠',title:'Πολλά σταθερά έξοδα',text:`Τα πάγια είναι ${ctx.fixedRatio}% του budget. Αν αυτό μείνει έτσι, το καθημερινό περιθώριο θα είναι πάντα πιεσμένο.`});
  }

  if(ctx.debtRatio>20){
    list.push({type:'warning',icon:'💳',title:'Βαριές πληρωμές χρέους',text:`Οι πληρωμές καρτών/χρεών είναι ${ctx.debtRatio}% του budget. Θέλει πλάνο μείωσης ή καλύτερη κατανομή.`});
  }

  if(ctx.cardDebt>0 && ctx.cardUsagePct>=70){
    list.push({type:'warning',icon:'📉',title:'Υψηλή χρήση κάρτας',text:`Το υπόλοιπο καρτών είναι ${fmt(ctx.cardDebt)} και η χρήση ορίου περίπου ${ctx.cardUsagePct}%.`});
  }

  if(ctx.cardDebt>0 && ctx.cardAdvice){
    if(ctx.cardAdvice.safePayment>0){
      list.push({type:'info',icon:'💳',title:'Ασφαλής πληρωμή κάρτας',text:`Ο Advisor βλέπει ασφαλή χώρο έως ${fmt(ctx.cardAdvice.safePayment)} χωρίς να πέσεις κάτω από το όριο ημέρας.`});
    }else{
      list.push({type:'warning',icon:'💳',title:'Περίμενε με τις κάρτες',text:'Δεν υπάρχει άνετος χώρος για έξτρα πληρωμή κάρτας στον τρέχοντα κύκλο.'});
    }
  }

  if(ctx.savingsRate<5 && ctx.balance>ctx.income*.10){
    list.push({type:'info',icon:'🏦',title:'Υπάρχει χώρος για στόχο',text:`Αν κρατήσεις θετικό υπόλοιπο, μπορείς να το βάλεις σε κάποιον στόχο.`});
  }else if(ctx.savingsRate>=10){
    list.push({type:'success',icon:'💰',title:'Καλή αποταμίευση',text:`Έχεις ήδη δεσμεύσει ${ctx.savingsRate}% του budget σε στόχοι στον κύκλο.`});
  }

  if(ctx.topCategory.total>0){
    list.push({type:'info',icon:'👑',title:'Μεγαλύτερη budget κατηγορία',text:`Η μεγαλύτερη κατηγορία που επηρεάζει budget είναι ${ctx.topCategory.category} με ${fmt(ctx.topCategory.total)}.`});
  }

  return list.slice(0,5);
}

function capvoAdvisorBestNextStep(model){
  if(model.income<=0)return 'Πρόσθεσε πρώτα Μισθό / Budget κύκλου για να μπορέσει ο Σύμβουλος να κάνει σωστούς υπολογισμούς.';
  if(model.practical?.action && model.practical?.tone==='bad')return model.practical.action;
  if(model.balance<0)return `Κάλυψε πρώτα την υπέρβαση ${fmt(Math.abs(model.balance))}. Μην προσθέσεις νέα αποταμίευση ή μη απαραίτητα έξοδα πριν ισορροπήσει ο κύκλος.`;
  if(model.dailyAllowance<10 && model.remainingDays>0)return 'Κράτα μόνο απαραίτητες κινήσεις μέχρι την επόμενη πληρωμή και απόφυγε νέες αγορές με κάρτα.';
  if(model.cardDebt>0 && model.cardAdvice?.recommendedPayment>0 && model.cardAdvice?.cardUsagePct>=60)return `Πλήρωσε περίπου ${fmt(model.cardAdvice.recommendedPayment)} στην κάρτα. Μειώνεις χρέος και κρατάς περίπου ${fmt(model.cardAdvice.afterRecommendedDaily)} ανά ημέρα.`;
  if(model.cardDebt>0 && model.cardAdvice?.safePayment<=0)return 'Μην κάνεις έξτρα πληρωμή κάρτας τώρα. Κράτα το budget για τις ημέρες μέχρι την πληρωμή.';
  if(model.debtRatio>20)return 'Δες τις πληρωμές καρτών/χρεών και φτιάξε μικρό πλάνο μείωσης για τον επόμενο κύκλο.';
  if(model.savingsRate<10 && model.balance>model.income*.10)return 'Μετέφερε ένα μικρό μέρος του θετικού υπολοίπου στη Στόχοι, χωρίς να ρίξεις πολύ το ημερήσιο όριο.';
  if(model.practical?.action)return model.practical.action;
  return 'Συνέχισε με το ίδιο όριο ανά ημέρα και κράτα τις νέες κινήσεις κάτω από το ασφαλές ημερήσιο budget.';
}

function capvoAdvisorDashboardStatus(model){
  const daily=model?.practical?.safeToday!=null?model.practical.safeToday:(model?.dailyAllowance??0);
  const summary=(model && model.income>0) ? `Advisor · ${fmt(Math.max(0,daily))}/ημ.` : 'Advisor';
  if(!model || model.income<=0)return {label:'Setup',tone:'amber',icon:'💡',summary:'Advisor'};
  if(model.balance<0 || model.health.score<38)return {label:'Κίνδυνος',tone:'red',icon:'🚨',summary};
  if(model.health.score<58 || model.dailyAllowance<10 || model.practical?.tone==='warn')return {label:'Προσοχή',tone:'amber',icon:'⚠️',summary};
  if(model.health.score>=78 && model.balance>0)return {label:'Καλό',tone:'teal',icon:'✅',summary};
  return {label:'OK',tone:'teal',icon:'✅',summary};
}

function capvoAdvisorBreakdownRow(label,value,tone,sub){
  return `
    <div class="advisor-breakdown-row advisor-breakdown-${tone||'neutral'}">
      <div><strong>${esc(label)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</div>
      <b>${fmt(value)}</b>
    </div>
  `;
}

function capvoAdvisorSignal(label,value,sub,tone){
  return `
    <article class="advisor-signal advisor-signal-${tone||'neutral'}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(sub||'')}</small>
    </article>
  `;
}

function capvoAdvisorMoneySignal(label,value,sub,tone){
  return capvoAdvisorSignal(label,fmt(value),sub,tone);
}


function capvoAdvisorPracticalSection(model){
  const p=model?.practical;
  if(!p)return '';
  const tone=p.tone==='bad'?'bad':p.tone==='warn'?'warn':p.tone==='setup'?'warn':'good';
  const todayLabel=p.safeToday>0?fmt(p.safeToday):'Μόνο απαραίτητα';
  const forecastText=p.currentPaceForecast>=0
    ? `Με τον ρυθμό των τελευταίων 7 ημερών προβλέπεται να μείνουν ${fmt(p.currentPaceForecast)}.`
    : `Με τον ρυθμό των τελευταίων 7 ημερών προβλέπεται έλλειμμα ${fmt(Math.abs(p.currentPaceForecast))}.`;

  return `
    <section class="advisor-card advisor-practical-card advisor-practical-${tone}">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Practical Advisor</span>
          <h3>Τι να κάνεις σήμερα</h3>
        </div>
        <span class="advisor-pill">${esc(model.cycleLabel)}</span>
      </div>

      <div class="advisor-practical-hero">
        <div class="advisor-practical-orb">🧭</div>
        <div>
          <span>${esc(p.label)}</span>
          <strong>${esc(todayLabel)}</strong>
          <p>${esc(p.headline)}</p>
        </div>
      </div>

      <div class="advisor-signal-grid advisor-practical-grid">
        ${capvoAdvisorMoneySignal('Άνετο όριο σήμερα',p.comfortToday,'πιο συντηρητική κίνηση',p.comfortToday>0?'good':'warn')}
        ${capvoAdvisorMoneySignal('Ασφαλές / ημέρα',p.safeToday,`${model.remainingDays} ημέρες μέχρι πληρωμή`,tone==='bad'?'bad':tone)}
        ${capvoAdvisorMoneySignal('Ήδη σήμερα',p.todayOutflow,'budget κινήσεις σήμερα',p.todayOutflow>p.safeToday&&p.safeToday>0?'warn':'neutral')}
        ${capvoAdvisorMoneySignal('Ρυθμός 7 ημερών',p.recentAvg,forecastText,p.currentPaceForecast>=0?'good':'bad')}
      </div>

      <div class="advisor-forecast-list">
        ${p.scenarios.map(sc=>`
          <article class="advisor-forecast-item advisor-forecast-${sc.tone}">
            <div>
              <strong>${esc(sc.label)}</strong>
              <span>${esc(sc.subtitle)}</span>
            </div>
            <b>${fmt(sc.value)}</b>
          </article>
        `).join('')}
      </div>

      <div class="advisor-practical-action">
        <span>Καλύτερη επόμενη κίνηση</span>
        <p>${esc(p.action)}</p>
      </div>
    </section>`;
}

function capvoAdvisorCardIntelSection(model){
  const a=model?.cardAdvice;
  if(!a)return '';

  if((Number(model.cardDebt)||0)<=0){
    return `
      <section class="advisor-card advisor-card-intel-card">
        <div class="advisor-section-head">
          <div>
            <span class="advisor-kicker">Cards intelligence</span>
            <h3>Έξυπνη διαχείριση καρτών</h3>
          </div>
          <span class="advisor-pill">Καθαρό</span>
        </div>
        <div class="advisor-card-empty-intel">
          <strong>Δεν υπάρχει ενεργό χρέος καρτών.</strong>
          <p>Ο Advisor δεν βλέπει πίεση από πιστωτικές ή πλάνα δόσεων στον τρέχοντα κύκλο.</p>
        </div>
      </section>`;
  }

  const safeTone=a.safePayment>0?'good':'warn';
  const stretchTone=a.maxWithoutPressure>0?'good':'warn';
  const planTone=a.installmentRatio>=12?'bad':a.installmentRatio>=7?'warn':'good';
  const usageTone=a.cardUsagePct>=80?'bad':a.cardUsagePct>=60?'warn':'good';
  const recommendedText=a.recommendedPayment>0
    ? `Προτεινόμενη πληρωμή τώρα: ${fmt(a.recommendedPayment)}. Μετά από αυτήν μένεις περίπου με ${fmt(a.afterRecommendedDaily)} / ημέρα.`
    : 'Δεν προτείνεται έξτρα πληρωμή κάρτας τώρα. Κράτα το διαθέσιμο budget για τις υπόλοιπες ημέρες.';

  return `
    <section class="advisor-card advisor-card-intel-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Cards intelligence</span>
          <h3>Έξυπνη διαχείριση καρτών</h3>
        </div>
        <span class="advisor-pill">${a.cardsWithDebt} με υπόλοιπο</span>
      </div>

      <div class="advisor-signal-grid advisor-card-signal-grid">
        ${capvoAdvisorMoneySignal('Ασφαλής πληρωμή τώρα',a.safePayment,a.safePayment>0?`κρατάς ~${fmt(a.afterSafeDaily)} / ημέρα`:'όχι άνετος χώρος',safeTone)}
        ${capvoAdvisorMoneySignal('Μέγιστη χωρίς μεγάλη πίεση',a.maxWithoutPressure,`κρατάς τουλάχιστον ~${fmt(a.minimumDailyFloor)} / ημέρα`,stretchTone)}
        ${capvoAdvisorMoneySignal('Δόσεις / κύκλο',a.monthlyInstallments,`${a.activePlanCount} ενεργό${a.activePlanCount===1?' πλάνο':'ά πλάνα'}`,planTone)}
        ${capvoAdvisorSignal('Χρήση ορίου',`${a.cardUsagePct}%`,model.cardLimit>0?`${fmt(model.cardDebt)} / ${fmt(model.cardLimit)}`:'χωρίς όριο',usageTone)}
      </div>

      <div class="advisor-card-payment-plan">
        <div class="advisor-card-payment-main">
          <span>Πρόταση πληρωμής</span>
          <strong>${a.recommendedPayment>0?fmt(a.recommendedPayment):'Περίμενε'}</strong>
          <small>${esc(recommendedText)}</small>
        </div>
        <div class="advisor-card-debt-split">
          <div><span>Κανονικό χρέος</span><b>${fmt(a.baseDebt)}</b></div>
          <div><span>Υπόλοιπο δόσεων</span><b>${fmt(a.installmentRemaining)}</b></div>
          <div><span>Ελάχιστη εκτίμηση</span><b>${fmt(a.minPayment)}</b></div>
        </div>
      </div>

      <div class="advisor-card-insights">
        ${a.insights.map(it=>`
          <article class="advisor-card-insight advisor-card-insight-${it.type}">
            <span>${esc(it.icon)}</span>
            <div>
              <strong>${esc(it.title)}</strong>
              <p>${esc(it.text)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>`;
}

function rAdv(){
  const content=$('advContent');
  if(!content)return;

  const model=capvoAdvisorBuildModel();

  if(model.income<=0){
    content.innerHTML=`
      <section class="advisor-empty-card">
        <div class="advisor-empty-icon">💡</div>
        <h3>Ξεκίνα με τα έσοδά σου</h3>
        <p>Πρόσθεσε πρώτα Μισθό / Budget κύκλου για να υπολογίσω υπόλοιπο, ημερήσιο όριο και πραγματικές προτάσεις.</p>
        <button type="button" onclick="go('vIncome',document.querySelector('[data-v=vIncome]'))">Προσθήκη εσόδου</button>
      </section>
    `;
    return;
  }

  const tone=model.health.tone==='warn'?'ok':model.health.tone;
  const dailyTone=model.dailyAllowance<0?'is-red':model.dailyAllowance<10?'is-amber':'is-blue';
  const balanceTone=model.balance<0?'is-red':model.balance>0?'is-green':'is-amber';
  const utilizationTone=model.utilization>100?'is-red':model.utilization>85?'is-amber':'is-purple';
  const cardTone=model.cardDebt>0?'is-amber':'is-green';
  const ruleStatus=model.actualSavings>=model.income*.10?'Εντός στόχου':'Χρειάζεται ενίσχυση';

  content.innerHTML=`
    <section class="advisor-coach-card advisor-tone-${tone}">
      <div class="advisor-score-ring">
        <span>${model.health.score}</span>
        <small>/100</small>
      </div>
      <div class="advisor-coach-copy">
        <span class="advisor-kicker">CAPVO Advisor · ${esc(model.cycleLabel)}</span>
        <h3>${esc(model.health.label)}</h3>
        <p>${esc(model.health.desc)}</p>
      </div>
    </section>

    <section class="advisor-kpi-grid">
      <article class="advisor-kpi-card ${balanceTone}">
        <div class="advisor-kpi-icon">${model.balance>=0?'✅':'🚨'}</div>
        <span>Υπόλοιπο κύκλου</span>
        <strong>${fmt(model.balance)}</strong>
        <small>${model.balance>=0?'διαθέσιμο μέχρι πληρωμή':'υπέρβαση budget'}</small>
      </article>

      <article class="advisor-kpi-card ${dailyTone}">
        <div class="advisor-kpi-icon">📆</div>
        <span>Ασφαλές / ημέρα</span>
        <strong>${fmt(Math.max(0,model.dailyAllowance))}</strong>
        <small>${model.remainingDays} ημέρες ακόμη</small>
      </article>

      <article class="advisor-kpi-card ${utilizationTone}">
        <div class="advisor-kpi-icon">📊</div>
        <span>Χρήση budget</span>
        <strong>${model.utilization}%</strong>
        <small>${fmt(model.spent)} από ${fmt(model.income)}</small>
      </article>

      <article class="advisor-kpi-card ${cardTone}">
        <div class="advisor-kpi-icon">💳</div>
        <span>Χρέος καρτών</span>
        <strong>${fmt(model.cardDebt)}</strong>
        <small>${model.cardLimit>0?`${model.cardUsagePct}% χρήση ορίου`:'τρέχον υπόλοιπο'}</small>
      </article>
    </section>

    ${capvoAdvisorPracticalSection(model)}

    <section class="advisor-card advisor-cycle-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Budget impact</span>
          <h3>Τι μετράει πραγματικά στον κύκλο</h3>
        </div>
        <span class="advisor-pill">${esc(model.cycleLabel)}</span>
      </div>
      <div class="advisor-breakdown-list">
        ${capvoAdvisorBreakdownRow('Budget κύκλου',model.income,'positive','Διαθέσιμο για έξοδα')}
        ${capvoAdvisorBreakdownRow('Πάγια',-model.fixedTotalAmount,'negative','Σταθερές υποχρεώσεις')}
        ${capvoAdvisorBreakdownRow('Κινήσεις budget',-model.cashExpenses,'negative','Cash/bank έξοδα')}
        ${capvoAdvisorBreakdownRow('Πληρωμές καρτών',-model.cardPayments,'negative','Πραγματική εκροή προς κάρτες')}
        ${capvoAdvisorBreakdownRow('Στόχοι',-model.savingsNet,model.savingsNet>=0?'negative':'positive','Καθαρή επίδραση αποταμίευσης')}
        ${capvoAdvisorBreakdownRow('Υπόλοιπο',model.balance,model.balance>=0?'positive':'negative','Μετά από όλα τα παραπάνω')}
      </div>
    </section>

    <section class="advisor-card advisor-payday-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Payday plan</span>
          <h3>Πλάνο μέχρι την επόμενη πληρωμή</h3>
        </div>
      </div>
      <div class="advisor-signal-grid">
        ${capvoAdvisorSignal('Ημέρες που πέρασαν',`${model.elapsedDays}/${model.totalDays}`,'μέσα στον κύκλο','neutral')}
        ${capvoAdvisorSignal('Ρυθμός κατανάλωσης',`${model.pacePct}%`,model.paceDiff>0?`μπροστά κατά ${fmt(model.paceDiff)}`:'εντός ρυθμού',model.paceDiff>model.income*.15?'bad':'good')}
        ${capvoAdvisorSignal('Αποταμίευση κύκλου',fmt(model.actualSavings),`${model.savingsRate}% του budget`,model.savingsRate>=10?'good':'warn')}
      </div>
    </section>

    ${capvoAdvisorCardIntelSection(model)}

    <section class="advisor-card advisor-rule-main">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Budget Rule</span>
          <h3>Κανόνας 50 / 30 / 20</h3>
        </div>
        <span class="advisor-pill">${esc(ruleStatus)}</span>
      </div>
      <div class="advisor-rule-bars">
        ${advisorRuleBar('Ανάγκες + χρέη',model.needs,model.income*.50,true)}
        ${advisorRuleBar('Επιθυμίες',model.wants,model.income*.30,true)}
        ${advisorRuleBar('Στόχοι',Math.max(0,model.actualSavings),model.income*.20,false)}
      </div>
    </section>

    <section class="advisor-card advisor-insights-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Coach Notes</span>
          <h3>Πρακτικές παρατηρήσεις</h3>
        </div>
      </div>
      <div class="advisor-insight-list">
        ${model.suggestions.map(s=>`
          <article class="advisor-insight advisor-insight-${s.type}">
            <div class="advisor-insight-icon">${s.icon}</div>
            <div>
              <strong>${esc(s.title)}</strong>
              <p>${esc(s.text)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="advisor-card advisor-rules-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Production checks</span>
          <h3>Έλεγχος υγείας budget</h3>
        </div>
      </div>
      <div class="advisor-rule-mini-list advisor-rule-accordion-list">
        ${advisorDetailedRule('80 / 20','Έξοδα έως 80%, αποταμίευση 20%',[
          {label:'Budget impact',actual:model.spent,target:model.income*.80,max:true,note:'Περιλαμβάνει μόνο πραγματικές κινήσεις budget.'},
          {label:'Στόχοι',actual:Math.max(0,model.actualSavings),target:model.income*.20,max:false,note:'Στόχος να δεσμεύεται μέρος του budget σε αποταμίευση.'}
        ])}
        ${advisorDetailedRule('Σταθερές υποχρεώσεις','Τα πάγια να μην πνίγουν τον κύκλο',[
          {label:'Πάγια',actual:model.fixedTotalAmount,target:model.income*.45,max:true,note:'Ιδανικά κάτω από 45% του διαθέσιμου budget.'}
        ])}
        ${advisorDetailedRule('Χρέος / Κάρτες','Πληρωμές καρτών και δανείων σε ασφαλή όρια',[
          {label:'Πληρωμές χρέους',actual:model.debtPayments,target:model.income*.20,max:true,note:'Πάνω από 20% αρχίζει να πιέζει το budget.'},
          {label:'Υπόλοιπο καρτών',actual:model.cardDebt,target:model.income*.50,max:true,note:'Για προσωπικό budget, το υπόλοιπο καρτών καλό είναι να μειώνεται σταδιακά.'}
        ])}
      </div>
    </section>

    <section class="advisor-action-card">
      <div class="advisor-action-icon">✨</div>
      <div>
        <h3>Επόμενο καλύτερο βήμα</h3>
        <p>${esc(capvoAdvisorBestNextStep(model))}</p>
      </div>
    </section>
  `;
}

// ===== SHARED RULE HELPERS =====
function advisorRuleBar(label,actual,target,max=true){
  actual=capvoMoney(Number(actual)||0);
  target=capvoMoney(Number(target)||0);
  const pct=target>0?Math.round(actual/target*100):0;
  const width=Math.min(100,Math.max(0,pct));
  const good=max?actual<=target:actual>=target;
  const warn=max?actual<=target*1.15:actual>=target*.75;
  const tone=good?'good':warn?'warn':'bad';

  return `
    <div class="advisor-rule-row advisor-rule-${tone}">
      <div class="advisor-rule-row-top">
        <span>${esc(label)}</span>
        <strong>${fmt(actual)} / ${fmt(target)}</strong>
      </div>
      <div class="advisor-rule-track">
        <div class="advisor-rule-fill" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function advisorRuleStatus(items){
  let hardFail=false;
  let softFail=false;
  (items||[]).forEach(it=>{
    const actual=Number(it.actual)||0;
    const target=Number(it.target)||0;
    if(target<=0)return;
    if(it.max){
      if(actual>target*1.10)hardFail=true;
      else if(actual>target)softFail=true;
    }else{
      if(actual<target*.80)hardFail=true;
      else if(actual<target)softFail=true;
    }
  });
  if(hardFail)return {tone:'bad',label:'Εκτός στόχου'};
  if(softFail)return {tone:'warn',label:'Οριακά'};
  return {tone:'good',label:'Εντός στόχου'};
}

function advisorRuleItemMessage(it){
  const actual=Number(it.actual)||0;
  const target=Number(it.target)||0;
  if(target<=0)return it.note||'';
  const diff=Math.abs(actual-target);
  if(it.max){
    if(actual>target)return `${it.label} ξεπερνά το προτεινόμενο όριο κατά ${fmt(diff)}.`;
    return `${it.label} είναι ${fmt(target-actual)} κάτω από το όριο.`;
  }
  if(actual<target)return `${it.label} υπολείπεται του στόχου κατά ${fmt(diff)}.`;
  return `${it.label} είναι ${fmt(actual-target)} πάνω από τον στόχο.`;
}

function advisorDetailedRule(name,desc,items){
  const status=advisorRuleStatus(items);
  const rows=(items||[]).map(it=>{
    const actual=Number(it.actual)||0;
    const target=Number(it.target)||0;
    const pct=target>0?Math.round(actual/target*100):0;
    const width=Math.min(100,Math.max(0,pct));
    const good=it.max?actual<=target:actual>=target;
    const warn=it.max?actual<=target*1.10:actual>=target*.80;
    const tone=good?'good':warn?'warn':'bad';
    return `
      <div class="advisor-rule-detail-row advisor-rule-detail-${tone}">
        <div class="advisor-rule-detail-top">
          <span>${esc(it.label)}</span>
          <strong>${fmt(actual)} / ${fmt(target)}</strong>
        </div>
        <div class="advisor-rule-detail-track">
          <div class="advisor-rule-detail-fill" style="width:${width}%"></div>
        </div>
        <p>${esc(advisorRuleItemMessage(it))}</p>
      </div>
    `;
  }).join('');

  return `
    <details class="advisor-rule-accordion advisor-rule-accordion-${status.tone}">
      <summary>
        <div>
          <strong>${esc(name)}</strong>
          <p>${esc(desc)}</p>
        </div>
        <span class="advisor-rule-status-badge">${esc(status.label)}</span>
      </summary>
      <div class="advisor-rule-detail-body">
        ${rows}
      </div>
    </details>
  `;
}

// Legacy helper kept for compatibility.
function ruleCard(name,desc,items){
  return advisorDetailedRule(name,desc,(items||[]).map(it=>({
    label:it.label||name,
    actual:it.actual,
    target:it.target,
    max:it.max!==false,
    note:desc
  })));
}

// Legacy compatibility: old code may still call calcHealthScore.
function calcHealthScore(needs,wants,savings,housing,debtPay){
  const income=Number(D?.income)||0;
  const scoreModel=capvoAdvisorHealthScore({
    income,
    spent:capvoMoney((Number(needs)||0)+(Number(wants)||0)),
    balance:capvoMoney(income-(Number(needs)||0)-(Number(wants)||0)),
    utilization:capvoAdvisorPercent((Number(needs)||0)+(Number(wants)||0),income),
    dailyAllowance:0,
    remainingDays:0,
    fixedRatio:capvoAdvisorPercent(housing,income),
    debtRatio:capvoAdvisorPercent(debtPay,income),
    savingsRate:capvoAdvisorPercent(savings,income),
    cardDebt:0,
    cardUsagePct:0,
    paceDiff:0,
    pacePct:0,
    actualSavings:Number(savings)||0
  });
  return {score:scoreModel.score,cls:scoreModel.tone,label:scoreModel.label,desc:scoreModel.desc,tips:scoreModel.reasons};
}

// ===== BOOT =====
if(typeof initApp==='function')initApp();
