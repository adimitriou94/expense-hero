// ===== CAPVO ADVISOR MODULE =====
// v1.8.6.6 production-wise rewrite.
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
  return capvoMoney(cards.reduce((sum,c)=>sum+(Number(c?.limitAmount||c?.limit_amount)||0),0));
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
  const debtFixed=(D?.fixedExpenses||[])
    .filter(e=>String(e.category||'')==='Δάνεια')
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const debtPayments=capvoMoney(cardPayments+debtFixed);

  const needsCats=['Τρόφιμα','Μεταφορά','Στέγαση','Λογαριασμοί','Υγεία'];
  const wantsCats=['Καφέδες','Ψυχαγωγία','Φαγητό έξω','Ρούχα','Συνδρομές','Άλλο'];
  const fixedNeeds=(D?.fixedExpenses||[])
    .filter(e=>needsCats.includes(e.category))
    .reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const fixedWants=(D?.fixedExpenses||[])
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
    health
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

  if(ctx.fixedRatio>55){
    list.push({type:'warning',icon:'🏠',title:'Πολλά σταθερά έξοδα',text:`Τα πάγια είναι ${ctx.fixedRatio}% του budget. Αν αυτό μείνει έτσι, το καθημερινό περιθώριο θα είναι πάντα πιεσμένο.`});
  }

  if(ctx.debtRatio>20){
    list.push({type:'warning',icon:'💳',title:'Βαριές πληρωμές χρέους',text:`Οι πληρωμές καρτών/χρεών είναι ${ctx.debtRatio}% του budget. Θέλει πλάνο μείωσης ή καλύτερη κατανομή.`});
  }

  if(ctx.cardDebt>0 && ctx.cardUsagePct>=70){
    list.push({type:'warning',icon:'📉',title:'Υψηλή χρήση κάρτας',text:`Το υπόλοιπο καρτών είναι ${fmt(ctx.cardDebt)} και η χρήση ορίου περίπου ${ctx.cardUsagePct}%.`});
  }

  if(ctx.savingsRate<5 && ctx.balance>ctx.income*.10){
    list.push({type:'info',icon:'🏦',title:'Υπάρχει χώρος για κουμπαρά',text:`Αν κρατήσεις θετικό υπόλοιπο, μπορείς να μεταφέρεις μέρος του σε Γενική αποταμίευση ή στόχο.`});
  }else if(ctx.savingsRate>=10){
    list.push({type:'success',icon:'💰',title:'Καλή αποταμίευση',text:`Έχεις ήδη δεσμεύσει ${ctx.savingsRate}% του budget σε κουμπαράδες στον κύκλο.`});
  }

  if(ctx.topCategory.total>0){
    list.push({type:'info',icon:'👑',title:'Μεγαλύτερη budget κατηγορία',text:`Η μεγαλύτερη κατηγορία που επηρεάζει budget είναι ${ctx.topCategory.category} με ${fmt(ctx.topCategory.total)}.`});
  }

  return list.slice(0,5);
}

function capvoAdvisorBestNextStep(model){
  if(model.income<=0)return 'Πρόσθεσε πρώτα Μισθό / Budget κύκλου για να μπορέσει ο Σύμβουλος να κάνει σωστούς υπολογισμούς.';
  if(model.balance<0)return `Κάλυψε πρώτα την υπέρβαση ${fmt(Math.abs(model.balance))}. Μην προσθέσεις νέα αποταμίευση ή μη απαραίτητα έξοδα πριν ισορροπήσει ο κύκλος.`;
  if(model.dailyAllowance<10 && model.remainingDays>0)return 'Κράτα μόνο απαραίτητες κινήσεις μέχρι την επόμενη πληρωμή και απόφυγε νέες αγορές με κάρτα.';
  if(model.debtRatio>20)return 'Δες τις πληρωμές καρτών/χρεών και φτιάξε μικρό πλάνο μείωσης για τον επόμενο κύκλο.';
  if(model.savingsRate<10 && model.balance>model.income*.10)return 'Μετέφερε ένα μικρό μέρος του θετικού υπολοίπου στη Γενική αποταμίευση, χωρίς να ρίξεις πολύ το ημερήσιο όριο.';
  return 'Συνέχισε με το ίδιο όριο ανά ημέρα και κράτα τις νέες κινήσεις κάτω από το ασφαλές ημερήσιο budget.';
}

function capvoAdvisorDashboardStatus(model){
  if(!model || model.income<=0)return {label:'Setup',tone:'amber',icon:'💡'};
  if(model.balance<0 || model.health.score<38)return {label:'Κίνδυνος',tone:'red',icon:'🚨'};
  if(model.health.score<58 || model.dailyAllowance<10)return {label:'Προσοχή',tone:'amber',icon:'⚠️'};
  if(model.health.score>=78 && model.balance>0)return {label:'Καλό',tone:'teal',icon:'✅'};
  return {label:'OK',tone:'teal',icon:'✅'};
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
        ${capvoAdvisorBreakdownRow('Κουμπαράδες',-model.savingsNet,model.savingsNet>=0?'negative':'positive','Καθαρή επίδραση αποταμίευσης')}
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
        ${advisorRuleBar('Κουμπαράδες',Math.max(0,model.actualSavings),model.income*.20,false)}
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
          {label:'Κουμπαράδες',actual:Math.max(0,model.actualSavings),target:model.income*.20,max:false,note:'Στόχος να δεσμεύεται μέρος του budget σε αποταμίευση.'}
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
initApp();
