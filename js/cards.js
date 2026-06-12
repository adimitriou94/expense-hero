// ===== CREDIT CARDS MODULE =====

function activeInstallmentPlansForCard(cardId){
  return (D.creditCardInstallmentPlans||[])
    .filter(p=>String(p.cardId)===String(cardId) && (p.status||'active')==='active');
}

const CAPVO_PLAN_PAID_AMOUNT_RE=/\[\[CAPVO_PLAN_PAID_AMOUNT:([0-9]+(?:\.[0-9]+)?)\]\]/;

function capvoPlanStoredPaidAmount(plan){
  const notes=String(plan?.notes||'');
  const m=notes.match(CAPVO_PLAN_PAID_AMOUNT_RE);
  return capvoMoney(m?Number(m[1])||0:0);
}

function capvoPlanInstallmentPaidAmount(plan){
  const total=Number(plan?.totalAmount)||0;
  const count=Math.max(1,Number(plan?.installmentCount)||1);
  const installment=Number(plan?.installmentAmount)||total/count;
  return capvoMoney(Math.max(0,Number(plan?.paidInstallments)||0)*installment);
}

function capvoPlanPaidAmount(plan){
  // notes keeps the real paid amount, including partial payments. paidInstallments remains
  // for full-installment progress/backward compatibility, so use the larger value.
  return capvoMoney(Math.max(capvoPlanStoredPaidAmount(plan),capvoPlanInstallmentPaidAmount(plan)));
}

function capvoSetPlanPaidAmount(plan,amount){
  if(!plan)return;
  const paid=capvoMoney(Math.max(0,Number(amount)||0));
  const raw=String(plan.notes||'').replace(CAPVO_PLAN_PAID_AMOUNT_RE,'').trim();
  plan.notes=(raw?raw+' ':'')+`[[CAPVO_PLAN_PAID_AMOUNT:${paid}]]`;
}

function capvoPlanRemainingAmount(plan){
  const total=Number(plan?.totalAmount)||0;
  return capvoMoney(Math.max(0,total-capvoPlanPaidAmount(plan)));
}

function capvoLegacyUnallocatedPlanPaymentForCard(cardId){
  const plans=activeInstallmentPlansForCard(cardId);
  if(!plans.length)return 0;

  // If plans already have paid metadata, do not infer anything. This is only for
  // payments created by v1.8.5.26 before installment allocation existed.
  const hasStoredPaid=plans.some(p=>capvoPlanStoredPaidAmount(p)>0 || capvoPlanInstallmentPaidAmount(p)>0);
  if(hasStoredPaid)return 0;

  const card=(D.creditCards||[]).find(c=>String(c.id)===String(cardId));
  const baseDebt=Number(card?.balance)||0;
  if(baseDebt>0)return 0;

  return capvoMoney((D.creditCardTransactions||[])
    .filter(t=>String(t.cardId||'')===String(cardId))
    .filter(t=>String(t.type||'')==='payment' || String(t.budgetEffectType||t.budget_effect_type||'')==='card_payment')
    .filter(t=>!t.installmentPlanId && !t.installment_plan_id)
    .reduce((sum,t)=>sum+(Number(t.amount)||0),0));
}

function activeInstallmentDebtForCard(cardId){
  let legacyPaid=capvoLegacyUnallocatedPlanPaymentForCard(cardId);
  return capvoMoney(activeInstallmentPlansForCard(cardId).reduce((sum,p)=>{
    let remaining=capvoPlanRemainingAmount(p);
    if(legacyPaid>0){
      const legacyApplied=Math.min(remaining,legacyPaid);
      remaining=capvoMoney(remaining-legacyApplied);
      legacyPaid=capvoMoney(legacyPaid-legacyApplied);
    }
    return sum+remaining;
  },0));
}

function normalizeCardDebtsFromPlans(){
  // Intentionally no mutation here.
  // Stored card.balance is the base/manual debt.
  // Active installment plans are added in cardDisplayDebt().
}


function cardBaseDebt(c){
  return capvoMoney(Number(c?.balance)||0);
}

function cardDisplayDebt(c){
  if(!c)return 0;
  if((c.accountType||'credit_card')==='loan')return cardBaseDebt(c);
  return capvoMoney(cardBaseDebt(c)+activeInstallmentDebtForCard(c.id));
}

function cardAvailableLimit(c){
  const limit=Number(c?.limit)||0;
  if(!limit)return 0;
  return capvoMoney(Math.max(0,limit-cardDisplayDebt(c)));
}



function cardTransactionsForCard(cardId){
  return (D.creditCardTransactions||[])
    .filter(t=>String(t.cardId)===String(cardId))
    .sort((a,b)=>String(b.transactionDate||'').localeCompare(String(a.transactionDate||'')) || String(b.id||'').localeCompare(String(a.id||'')));
}

function cardTransactionLabel(t){
  const type=String(t?.type||'');
  if(type==='payment')return 'Πληρωμή κάρτας';
  if(type==='installment_purchase')return 'Αγορά με δόσεις';
  return 'Αγορά με πιστωτική';
}

function cardTransactionAmountPrefix(t){
  return String(t?.type||'')==='payment' ? '-' : '+';
}

function renderCardActivityList(cardId, cardPlans){
  const txCount=cardTransactionsForCard(cardId).length;
  const planCount=(cardPlans||[]).length;
  if(!txCount && !planCount)return '';

  const items=[];
  if(planCount){
    items.push(`
      <button type="button" class="cc-card-list-item" onclick="openCardPlansSheet('${cardId}')">
        <span>
          <small>Πλάνα δόσεων</small>
          <strong>${planCount} ενεργό${planCount===1?' πλάνο':'ά πλάνα'}</strong>
        </span>
        <em>${planCount}</em>
      </button>`);
  }
  if(txCount){
    items.push(`
      <button type="button" class="cc-card-list-item" onclick="openCardTransactionsSheet('${cardId}')">
        <span>
          <small>Κινήσεις κάρτας</small>
          <strong>${txCount} κίνηση${txCount===1?'':'ς'}</strong>
        </span>
        <em>${txCount}</em>
      </button>`);
  }

  return `
    <div class="cc-card-lists-compact">
      <div class="cc-card-lists-head">
        <span>Λίστες κάρτας</span>
        <small>Άνοιγμα σε αναδυόμενο παράθυρο</small>
      </div>
      <div class="cc-card-lists-grid">
        ${items.join('')}
      </div>
    </div>`;
}

function renderCardTransactionsPreview(cardId){
  // Backward-compatible wrapper. Details should not expand the card body.
  return renderCardActivityList(cardId, activeInstallmentPlansForCard(cardId));
}

async function deleteCardPurchaseFromCard(expenseId){
  if(!expenseId)return;
  const expense=typeof getExistingDailyExpenseById==='function' ? getExistingDailyExpenseById(expenseId) : null;
  if(!expense){
    showMiniToast?.('Δεν βρήκα την αρχική αγορά για διαγραφή.','error');
    return;
  }

  const confirmed=await showConfirmModal({
    title:'Διαγραφή αγοράς κάρτας',
    message:`Θέλεις να διαγράψεις το «${expense.name}»; Θα αφαιρεθεί και από το χρέος της κάρτας.`,
    confirmText:'Διαγραφή',
    cancelText:'Άκυρο'
  });
  if(!confirmed)return;

  try{
    await deleteExpenseRow('daily',expenseId);
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(e=>String(e.id)!==String(expenseId));
    });
    closeCardTransactionsSheet?.();
    render();
    showMiniToast?.('✅ Η αγορά διαγράφηκε');
  }catch(e){
    console.error('deleteCardPurchaseFromCard failed:',e);
    showMiniToast?.(e?.message || '❌ Δεν μπόρεσα να διαγράψω την αγορά','error');
  }
}



function rCC(){
  normalizeCardDebtsFromPlans();
  const cards=D.creditCards||[];
  if(cards.length===0){
    $('ccList').innerHTML='<div class="chart-container empty-debt-state"><p style="text-align:center;color:var(--text3);font-size:13px">Δεν έχεις προσθέσει ακόμα κάρτα ή οφειλή. Πάτα «+ Προσθήκη».</p></div>';
    $('ccSummary').innerHTML='';$('ccPlanAnalysis').innerHTML='';return;
  }
  const fxS=fixedTotal();
  let h='';
  cards.forEach((c,idx)=>{
    const accountType=c.accountType||'credit_card';
    const isLoan=accountType==='loan';
    const isBnpl=accountType==='bnpl';
    const displayDebt=cardDisplayDebt(c);
    const pct=c.limit>0 && !isLoan?Math.min(100,Math.round(displayDebt/c.limit*100)):0;
    const mi=displayDebt*(c.rate/100/12);
    const bc=pct>80?'var(--red)':pct>50?'var(--amber)':'var(--teal)';
    const effectiveMin=effectiveCardMinPay(c);
    const pay=effectiveCardPayment(c);
    const maxPay=Math.max(
      Math.ceil(effectiveMin)+5,
      Math.min(Math.ceil(displayDebt>0?displayDebt:1),Math.ceil(D.income-fxS))
    );
    const minLabel=(Number(c.minPay)||0)>0?fmt(c.minPay):'~'+fmt(effectiveMin);
    const icon=isLoan?'🏦':isBnpl?'🧾':'💳';
    const metaPrefix=isLoan?'Δάνειο':isBnpl?'Πλάνο δόσεων':'Πιστωτική';
    const debtLabel=isLoan?'Υπόλοιπο δανείου':isBnpl?'Υπόλοιπο πλάνου':'Χρέος κάρτας';
    const payLabel=isLoan?'Πληρωμή δόσης':'Πληρωμή κάρτας';

    h+='<div class="cc-card debt-account-card type-'+esc(accountType)+'"><div class="cc-head"><div class="cc-icon">'+icon+'</div><div class="cc-info"><div class="cc-name">'+esc(c.name)+'</div><div class="cc-meta">'+metaPrefix+' · Επιτόκιο '+c.rate+'% · Πληρωμή '+minLabel+'</div></div><div class="cc-actions"><button class="edit-btn" onclick="editCC(\''+c.id+'\')" title="Επεξεργασία">✎</button><button class="del-btn" onclick="delCC(\''+c.id+'\')" title="Διαγραφή">×</button></div></div>';
    h+='<div class="cc-body">';
    h+='<div class="cc-row"><span class="lb">'+debtLabel+'</span><span class="vl" style="color:var(--red)">'+fmt(displayDebt)+'</span></div>';
    if(c.limit>0 && !isLoan)h+='<div class="cc-row"><span class="lb">Πιστωτικό όριο</span><span class="vl">'+fmt(c.limit)+'</span></div>';
    if(c.limit>0 && !isLoan)h+='<div class="cc-row"><span class="lb">Διαθέσιμο όριο</span><span class="vl">'+fmt(cardAvailableLimit(c))+'</span></div>';
    h+='<div class="cc-row"><span class="lb">Εκτίμηση μηνιαίου τόκου</span><span class="vl" style="color:var(--amber)">~'+fmt(mi)+'</span></div>';
    if(c.limit>0 && !isLoan){h+='<div class="cc-bar"><div class="cc-bar-info"><span>Χρήση ορίου</span><span>'+pct+'%</span></div><div class="cc-bar-track"><div class="cc-bar-fill" style="width:'+pct+'%;background:'+bc+'"></div></div></div>';}
    h+='<div class="cc-production-actions"><button type="button" onclick="openCardPaymentSheet(\''+c.id+'\')">'+payLabel+'</button>'+(!isLoan?'<button type="button" onclick="openCardPurchaseFromCard(\''+c.id+'\')">Νέα αγορά</button>':'')+'</div>';

    const cardPlans=activeInstallmentPlansForCard(c.id);
    h+=renderCardActivityList(c.id,cardPlans);

    if(displayDebt>0){
      const minPreset=Math.round(effectiveMin*100)/100;
      const comfyPreset=Math.min(maxPay,Math.ceil((effectiveMin*1.5)/5)*5);
      const fastPreset=Math.min(maxPay,Math.ceil((effectiveMin*2)/5)*5);
      const payRounded=Math.round(pay*100)/100;
      const activePreset=(a,b)=>Math.abs(Number(a)-Number(b))<0.01;
      const hasPresetActive=activePreset(payRounded,minPreset)||activePreset(payRounded,comfyPreset)||activePreset(payRounded,fastPreset);
      h+='<div class="pay-planner debt-pay-hybrid"><div class="debt-pay-head"><div><span>Δόση αποπληρωμής</span><strong id="payVal'+idx+'">'+fmt(pay)+'</strong></div><small>/ μήνα</small></div>';
      h+='<div class="debt-pay-presets" id="payPresets'+idx+'">';
      h+='<button type="button" class="debt-pay-preset '+(activePreset(payRounded,minPreset)?'active':'')+'" onclick="setPayPreset('+idx+','+minPreset+')"><span>Ελάχιστη</span><strong>'+fmt(minPreset)+'</strong></button>';
      h+='<button type="button" class="debt-pay-preset '+(activePreset(payRounded,comfyPreset)?'active':'')+'" onclick="setPayPreset('+idx+','+comfyPreset+')"><span>Άνετη</span><strong>'+fmt(comfyPreset)+'</strong></button>';
      h+='<button type="button" class="debt-pay-preset '+(activePreset(payRounded,fastPreset)?'active':'')+'" onclick="setPayPreset('+idx+','+fastPreset+')"><span>Γρήγορη</span><strong>'+fmt(fastPreset)+'</strong></button>';
      h+='</div>';
      h+='<div class="debt-pay-slider"><input id="payRange'+idx+'" type="range" min="'+minPreset+'" max="'+Math.max(maxPay,minPreset+1)+'" value="'+payRounded+'" step="5" oninput="updatePay('+idx+',this.value,true)"></div>';
      h+='<div class="debt-pay-custom '+(hasPresetActive?'':'active')+'" id="payCustom'+idx+'">Προσαρμοσμένη δόση</div>';
      h+='<div class="pay-result" id="payResult'+idx+'"></div>';
      h+='<div id="payFeasibility'+idx+'"></div></div>';
    }
    h+='</div></div>';
  });
  $('ccList').innerHTML=h;
  cards.forEach((c,idx)=>{if(cardDisplayDebt(c)>0) calcPay(idx)});
  rCCSummary();
  rCCPlanAnalysis();
  stabilizeCardsSectionFinalLayout?.();
}

// Calculate payoff for a card
function calcPayoff(balance, rate, payment){
  const mr=rate/100/12;
  const mi=balance*mr;
  if(payment<=mi) return {months:999,totalPaid:0,totalInterest:0,impossible:true};
  let bal=balance, months=0, tp=0;
  while(bal>0.01 && months<600){
    const i=bal*mr;
    const p=Math.min(payment,bal+i);
    bal=bal+i-p; tp+=p; months++;
  }
  return {months,totalPaid:tp,totalInterest:tp-balance,impossible:months>=600};
}

function calcPay(idx){
  const c=D.creditCards[idx];if(!c)return;
  const debt=cardDisplayDebt(c);
  const pay=effectiveCardPayment(c);
  const mr=c.rate/100/12, mi=debt*mr;
  const fxS=fixedTotal();
  const tOther=D.creditCards.reduce((s,cc,i)=>i!==idx?s+(cardDisplayDebt(cc)>0?effectiveCardPayment(cc):0):s,0);
  const left=D.income-fxS-tOther-pay;
  const res=calcPayoff(debt,c.rate,pay);
  let msg='';
  let cls='green';

  if(pay<=mi && debt>0){
    msg='⚠️ Η δόση δεν καλύπτει τον μηνιαίο τόκο. Το χρέος δεν θα μειωθεί.';
    cls='red';
  }else if(res.impossible){
    msg='⚠️ Χρειάζεται μεγαλύτερη πληρωμή για να μειωθεί ουσιαστικά.';
    cls='red';
  }else{
    const minRes=calcPayoff(debt,c.rate,effectiveCardMinPay(c));
    const saveInterest=Math.max(0,(minRes.totalInterest||0)-(res.totalInterest||0));
    msg='Εξόφληση σε '+res.months+' μ. · Σύνολο: '+fmt(res.totalPaid)+' (τόκοι: '+fmt(res.totalInterest)+')';
    if(saveInterest>0)msg+='<br>💰 Γλιτώνεις ~'+fmt(saveInterest)+' σε τόκους vs ελάχιστη!';
    cls=left>=0?'green':'red';
  }

  const msgEl=$('payMsg'+idx);
  if(msgEl){
    msgEl.innerHTML=msg;
    msgEl.className='tip '+cls;
  }

  const leftEl=$('leftMsg'+idx);
  if(leftEl){
    leftEl.innerHTML=(left>=0?'✅':'⚠️')+' '+fmt(left)+' για ημερήσια.';
    leftEl.className='tip '+(left>=0?'green':'red');
  }
}


function setPayPreset(idx,val){
  const range=$('payRange'+idx);
  if(range) range.value=val;
  updatePay(idx,val);
  rCC();
}

function refreshDashboardAfterCardPaymentChange(){
  try{
    if(typeof refreshComputedIncome==='function')refreshComputedIncome();

    const fxS=fixedTotal();
    const ccS=ccPayTotal();
    const dlS=dailyTotal();
    const cashDaily=typeof dailyCashTotal==='function'?dailyCashTotal():dlS;
    const spent=fxS+ccS+cashDaily;
    const bal=(Number(D.income)||0)-spent;
    const pct=D.income>0?Math.min(100,Math.round(spent/D.income*100)):0;

    const dIncome=$('dIncome');if(dIncome)dIncome.textContent=fmt(D.income);
    const dBalance=$('dBalance');
    if(dBalance){
      dBalance.textContent=fmt(bal);
      dBalance.style.color=bal<0?'#fca5a5':'#ffffff';
    }
    const dBar=$('dBar');if(dBar)dBar.style.width=pct+'%';
    const dPct=$('dPct');if(dPct)dPct.textContent=pct+'%';
    const dSpent=$('dSpent');if(dSpent)dSpent.textContent=fmt(spent)+' / '+fmt(D.income);

    const sFixed=$('sFixed');if(sFixed)sFixed.textContent=fmt(fxS);
    const sCC=$('sCC');if(sCC)sCC.textContent=fmt(ccS);
    const sDaily=$('sDaily');if(sDaily)sDaily.textContent=fmt(dlS);

    if(typeof renderDashboardAllowanceCards==='function')renderDashboardAllowanceCards(bal);
    if(typeof renderDashboardAdvisorSnapshot==='function')renderDashboardAdvisorSnapshot(pct,bal);
    if(typeof renderDashboardPreview==='function')renderDashboardPreview();
    if(typeof renderMobileCategoryInsights==='function')renderMobileCategoryInsights();
    if(typeof renderPaymentSourcesSummary==='function')renderPaymentSourcesSummary();
    if(typeof rStats==='function')rStats();
    if(typeof rArch==='function')rArch();
    if(typeof rAdv==='function')rAdv();
  }catch(e){
    console.warn('Dashboard refresh after card payment change failed:',e);
  }
}

function updatePay(idx,val,fromSlider=false){
  D.creditCards[idx].chosenPay=Number(val)||0;save();
  const el=$('payVal'+idx);if(el)el.textContent=fmt(Number(val)||0);

  if(fromSlider){
    const presets=$('payPresets'+idx);
    presets?.querySelectorAll('.debt-pay-preset.active').forEach(btn=>btn.classList.remove('active'));
    $('payCustom'+idx)?.classList.add('active');
  }

  calcPay(idx);
  rCCSummary();
  rCCPlanAnalysis();
  refreshDashboardAfterCardPaymentChange();
}

function rCCSummary(){
  const cards=(D.creditCards||[]).filter(c=>cardDisplayDebt(c)>0);
  if(cards.length===0){$('ccSummary').innerHTML='';return}
  const tDebt=cards.reduce((s,c)=>s+cardDisplayDebt(c),0);
  const tPay=typeof plannedCardPaymentTotal==='function' ? plannedCardPaymentTotal() : cards.reduce((s,c)=>s+effectiveCardPayment(c),0);
  const fxS=fixedTotal();
  const afterAll=D.income-fxS-tPay;

  let sm='<section class="cc-summary-card cc-summary-final-card"><h3>📊 Σύνολο</h3>';
  sm+='<div class="cc-row"><span class="lb">Συνολικό χρέος</span><span class="vl" style="color:var(--red)">'+fmt(tDebt)+'</span></div>';
  sm+='<div class="cc-row"><span class="lb">Δόσεις/μήνα</span><span class="vl">'+fmt(tPay)+'</span></div>';
  sm+='<div class="cc-row" style="padding-top:10px;margin-top:10px;border-top:1px solid #f0ede6"><span class="lb"><strong>Μένει για ημερήσια</strong></span><span class="vl" style="color:'+(afterAll>=0?'var(--teal)':'var(--red)')+'"><strong>'+fmt(afterAll)+'</strong></span></div>';
  if(afterAll<0)sm+='<div class="tip red" style="margin-top:12px">⚠️ Ξεπερνάς τα διαθέσιμα κατά '+fmt(Math.abs(afterAll))+'.</div>';
  else if(afterAll<200)sm+='<div class="tip amber" style="margin-top:12px">⚡ Μόνο '+fmt(afterAll)+' για ημερήσια.</div>';
  else sm+='<div class="tip green" style="margin-top:12px">✅ '+fmt(afterAll)+' για ημερήσια.</div>';
  sm+='</section>';
  $('ccSummary').innerHTML=sm;
}

// ===== DETAILED PLAN ANALYSIS =====
function rCCPlanAnalysis(){
  const cards=(D.creditCards||[]).filter(c=>cardDisplayDebt(c)>0);
  if(cards.length===0){$('ccPlanAnalysis').innerHTML='';return}

  const fxS=fixedTotal();
  const tPay=typeof plannedCardPaymentTotal==='function' ? plannedCardPaymentTotal() : cards.reduce((s,c)=>s+effectiveCardPayment(c),0);
  const afterAll=D.income-fxS-tPay;

  let score=50;
  if(afterAll<0) score-=30;
  else if(afterAll<150) score-=15;
  else if(afterAll>=400) score+=10;

  cards.forEach(c=>{
    const debt=cardDisplayDebt(c);
    const pay=effectiveCardPayment(c);
    const mi=debt*(c.rate/100/12);
    if(pay<=mi) score-=20;
    else if(pay>=effectiveCardMinPay(c)*2) score+=10;
    else if(pay>effectiveCardMinPay(c)) score+=5;
  });

  const dti=D.income>0?tPay/D.income*100:0;
  if(dti>36) score-=15;
  else if(dti<=20) score+=10;
  score=Math.max(0,Math.min(100,score));

  const sClass=score>=70?'good':score>=40?'ok':'bad';
  const sLabel=score>=70?'Καλό πλάνο':score>=40?'Θέλει προσοχή':'Πιεστικό πλάνο';
  const sText=score>=70
    ? 'Οι δόσεις σου είναι ρεαλιστικές και αφήνουν χώρο για καθημερινά έξοδα.'
    : score>=40
      ? 'Το πλάνο βγαίνει, αλλά υπάρχουν σημεία που μπορούν να βελτιωθούν.'
      : 'Το πλάνο πιέζει το budget και χρειάζεται άμεσα αλλαγή.';

  let h='<section class="cc-plan-analysis-card mature-analysis-card">';
  h+='<div class="mature-analysis-header">';
  h+='<div class="mature-score-circle '+sClass+'">'+score+'</div>';
  h+='<div class="mature-analysis-copy">';
  h+='<small>Αξιολόγηση πλάνου δόσεων</small>';
  h+='<h3>'+sLabel+'</h3>';
  h+='<p>'+sText+'</p>';
  h+='</div>';
  h+='</div>';

  h+='<div class="mature-analysis-section">';
  h+='<div class="mature-section-title">Ανά κάρτα</div>';
  cards.forEach(c=>{
    const debt=cardDisplayDebt(c);
    const pay=effectiveCardPayment(c);
    const res=calcPayoff(debt,c.rate,pay);
    const minRes=calcPayoff(debt,c.rate,effectiveCardMinPay(c));
    const saveInterest=Math.max(0,(minRes.totalInterest||0)-(res.totalInterest||0));

    h+='<article class="mature-card-plan-row">';
    h+='<div>';
    h+='<strong>'+esc(c.name)+'</strong>';
    h+='<span>'+fmt(pay)+'/μήνα</span>';
    h+='</div>';

    if(!res.impossible){
      h+='<small>'+res.months+' μήνες · τόκοι '+fmt(res.totalInterest);
      if(saveInterest>0)h+=' · εξοικ. '+fmt(saveInterest);
      h+='</small>';
    }else{
      h+='<small class="danger">Η δόση δεν αρκεί για αποπληρωμή.</small>';
    }

    h+='</article>';
  });
  h+='</div>';

  const suggestions=[];
  const highest=[...cards].sort((a,b)=>b.rate-a.rate)[0];
  if(highest&&highest.rate>15)suggestions.push('Προτεραιότητα στην κάρτα με επιτόκιο '+highest.rate+'%.');
  if(dti>30)suggestions.push('Οι δόσεις είναι υψηλές σε σχέση με το εισόδημα.');
  if(afterAll<200)suggestions.push('Κράτα χαμηλά τις νέες αγορές μέχρι να ανέβει το διαθέσιμο υπόλοιπο.');
  if(suggestions.length===0)suggestions.push('Συνέχισε με σταθερές πληρωμές και έλεγχο νέων αγορών.');

  h+='<div class="mature-analysis-section suggestions-section">';
  h+='<div class="mature-section-title">Προτάσεις</div>';
  suggestions.slice(0,3).forEach(s=>{
    h+='<div class="mature-suggestion-row"><span>✓</span><p>'+esc(s)+'</p></div>';
  });
  h+='</div>';

  h+='</section>';
  $('ccPlanAnalysis').innerHTML=h;
}


// ===== CREDIT CARD PRODUCTION ACTIONS =====
function openCardPurchaseFromCard(id){
  const card=(D.creditCards||[]).find(c=>String(c.id)===String(id));
  window.capvoLockedCardPurchaseId=id;
  closeM();
  openModal('daily');
  window.capvoLockedCardPurchaseId=id;

  const applyCardPurchaseLock=()=>{
    const pay=$('fDPay');
    if(pay){
      fillPaymentSourceSelect(id,{lockCard:true});
      pay.value=id;
      pay.disabled=true;
      pay.dataset.lockedCardId=id;
      pay.dispatchEvent(new Event('change',{bubbles:true}));
    }

    const category=$('fDC');
    if(category)category.value='Άλλο';
    syncDailyCategoryUI?.('Άλλο');

    const title=$('mDailyTitle');
    if(title)title.childNodes[0].nodeValue='Αγορά με '+(card?.name||'πιστωτική');

    setCardPurchaseMode?.('normal');
    updateDailyCreditCardOptions?.();
  };

  applyCardPurchaseLock();
  setTimeout(applyCardPurchaseLock,80);
}


function openCardPaymentSheet(id){
  const c=(D.creditCards||[]).find(x=>x.id===id);
  if(!c)return;

  let overlay=document.getElementById('cardPaymentSheet');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='cardPaymentSheet';
    overlay.className='card-payment-sheet-overlay';
    overlay.innerHTML=`
      <div class="card-payment-sheet" onclick="event.stopPropagation()">
        <div class="card-payment-handle"></div>
        <div class="card-payment-head">
          <div>
            <span>Πληρωμή πιστωτικής</span>
            <h3 id="cardPaymentTitle">Πληρωμή κάρτας</h3>
            <p id="cardPaymentSubtitle">Το ποσό θα αφαιρεθεί από το διαθέσιμο budget και θα μειώσει το χρέος της κάρτας.</p>
          </div>
          <button type="button" onclick="closeCardPaymentSheet()" aria-label="Κλείσιμο">×</button>
        </div>
        <input type="hidden" id="cardPaymentId">
        <div class="card-payment-amount">
          <label>Ποσό πληρωμής</label>
          <div><span>€</span><input type="number" id="cardPaymentAmount" step="0.01" min="0" inputmode="decimal"></div>
          <small id="cardPaymentHint"></small>
        </div>
        <div class="card-payment-error" id="cardPaymentError"></div>
        <button type="button" id="cardPaymentSubmit" class="card-payment-primary" onclick="saveCardPayment()">Καταχώρηση πληρωμής</button>
      </div>`;
    overlay.addEventListener('click',closeCardPaymentSheet);
    document.body.appendChild(overlay);
  }

  $('cardPaymentId').value=id;
  const isLoan=(c.accountType==='loan');
  $('cardPaymentTitle').textContent=c.name||(isLoan?'Πληρωμή δόσης':'Πληρωμή κάρτας');
  $('cardPaymentAmount').value=Number(c.chosenPay)||effectiveCardPayment(c)||'';
  $('cardPaymentHint').textContent=`Υπόλοιπο τώρα: ${fmt(cardDisplayDebt(c))}. Η πληρωμή αφαιρείται από το budget και μειώνει την οφειλή.`;
  $('cardPaymentError').textContent='';
  const submit=$('cardPaymentSubmit');
  if(submit){
    submit.disabled=false;
    submit.dataset.saving='0';
    submit.textContent='Καταχώρηση πληρωμής';
  }

  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));
}

function closeCardPaymentSheet(){
  const overlay=document.getElementById('cardPaymentSheet');
  if(overlay)overlay.classList.remove('active');
  setTimeout(()=>{
    if(!document.querySelector('.modal-overlay.active'))document.body.classList.remove('modal-open');
  },180);
}

function capvoSnapshotInstallmentPlans(){
  return (D.creditCardInstallmentPlans||[]).map(p=>({...p}));
}

function capvoRestoreInstallmentPlans(snapshot){
  D.creditCardInstallmentPlans=(snapshot||[]).map(p=>({...p}));
}

async function capvoPersistInstallmentPlanPayment(plan){
  const ownerUserId=String(getDataOwnerId?.()||'').trim();
  if(!ownerUserId || typeof supabaseClient==='undefined')return;
  const {error}=await supabaseClient
    .from('credit_card_installment_plans')
    .update({
      paid_installments:Number(plan.paidInstallments)||0,
      next_due_date:plan.nextDueDate||null,
      status:plan.status||'active',
      notes:plan.notes||null,
      updated_at:new Date().toISOString()
    })
    .eq('id',plan.id)
    .eq('user_id',ownerUserId);
  if(error)throw error;
}

async function capvoApplyPaymentToInstallmentPlans(cardId,amount){
  let remaining=capvoMoney(Number(amount)||0);
  if(remaining<=0)return 0;

  const plans=activeInstallmentPlansForCard(cardId)
    .slice()
    .sort((a,b)=>String(a.nextDueDate||a.firstDueDate||'').localeCompare(String(b.nextDueDate||b.firstDueDate||'')) || String(a.id||'').localeCompare(String(b.id||'')));

  let applied=0;
  for(const plan of plans){
    if(remaining<=0)break;

    const beforePaid=capvoPlanPaidAmount(plan);
    const planRemaining=capvoPlanRemainingAmount(plan);
    if(planRemaining<=0)continue;

    const part=capvoMoney(Math.min(remaining,planRemaining));
    const newPaid=capvoMoney(beforePaid+part);
    capvoSetPlanPaidAmount(plan,newPaid);

    const installment=Number(plan.installmentAmount)||((Number(plan.totalAmount)||0)/Math.max(1,Number(plan.installmentCount)||1));
    const paidInstallments=installment>0 ? Math.min(Number(plan.installmentCount)||1,Math.floor(newPaid/installment+0.000001)) : 0;
    plan.paidInstallments=paidInstallments;
    if(newPaid>=(Number(plan.totalAmount)||0)-0.005){
      plan.status='completed';
      plan.nextDueDate='';
    }else if(plan.firstDueDate){
      plan.nextDueDate=capvoAddMonths(plan.firstDueDate,paidInstallments);
    }

    await capvoPersistInstallmentPlanPayment(plan);

    applied=capvoMoney(applied+part);
    remaining=capvoMoney(remaining-part);
  }

  return applied;
}

async function saveCardPayment(){
  const id=$('cardPaymentId')?.value||'';
  const amount=Number($('cardPaymentAmount')?.value)||0;
  const err=$('cardPaymentError');
  const submit=$('cardPaymentSubmit');
  const c=(D.creditCards||[]).find(x=>x.id===id);

  if(submit?.dataset?.saving==='1')return;
  if(err)err.textContent='';
  if(!c)return;
  if(!amount || amount<=0){
    if(err)err.textContent='Συμπλήρωσε ποσό πληρωμής.';
    return;
  }
  if(amount>cardDisplayDebt(c)){
    if(err)err.textContent='Το ποσό πληρωμής δεν μπορεί να είναι μεγαλύτερο από το χρέος.';
    return;
  }

  if(submit){
    submit.disabled=true;
    submit.dataset.saving='1';
    submit.textContent='Καταχώρηση...';
  }

  const oldBalance=Number(c.balance)||0;
  const oldChosenPay=Number(c.chosenPay)||0;
  const oldLastPaymentDate=c.lastPaymentDate||'';
  const planSnapshot=capvoSnapshotInstallmentPlans();
  const basePayment=capvoMoney(Math.min(oldBalance,amount));
  const installmentPayment=capvoMoney(amount-basePayment);

  c.balance=capvoMoney(Math.max(0,oldBalance-basePayment));
  // Actual payment should not overwrite the planner's chosen monthly payment.
  c.chosenPay=oldChosenPay;
  c.lastPaymentDate=typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');

  const userId=getDataOwnerId?.();
  const tx={
    id:'cc_pay_'+gid(),
    cardId:c.id,
    type:'payment',
    amount,
    transactionDate:c.lastPaymentDate,
    description:'Πληρωμή '+(c.name||'κάρτας'),
    category:'Πιστωτικές',
    affectsBudget:true,
    budgetEffectType:'card_payment'
  };

  if(!Array.isArray(D.creditCardTransactions))D.creditCardTransactions=[];
  D.creditCardTransactions.unshift(tx);

  let txPersisted=false;
  try{
    if(userId && typeof supabaseClient!=='undefined'){
      const {error}=await supabaseClient.from('credit_card_transactions').upsert({
        id:tx.id,
        user_id:userId,
        card_id:c.id,
        type:'payment',
        amount,
        transaction_date:tx.transactionDate,
        description:tx.description,
        category:tx.category,
        affects_budget:true,
        budget_effect_type:'card_payment',
        updated_at:new Date().toISOString()
      },{onConflict:'id'});
      if(error)throw error;
      txPersisted=true;
    }

    if(installmentPayment>0){
      await capvoApplyPaymentToInstallmentPlans(c.id,installmentPayment);
    }

    await save();
    closeCardPaymentSheet();
    closeCardTransactionsSheet?.();
    closeCardPlansSheet?.();
    render();
    showMiniToast?.('✅ Η πληρωμή κάρτας καταχωρήθηκε');

  }catch(e){
    console.error('saveCardPayment failed:',e);
    c.balance=oldBalance;
    c.chosenPay=oldChosenPay;
    c.lastPaymentDate=oldLastPaymentDate;
    capvoRestoreInstallmentPlans(planSnapshot);
    D.creditCardTransactions=(D.creditCardTransactions||[]).filter(t=>String(t.id)!==String(tx.id));

    if(txPersisted && userId && typeof supabaseClient!=='undefined'){
      try{await supabaseClient.from('credit_card_transactions').delete().eq('id',tx.id).eq('user_id',userId);}catch(_e){}
    }

    if(err)err.textContent='Δεν μπόρεσα να αποθηκεύσω την πληρωμή.';
    showMiniToast?.('❌ Σφάλμα πληρωμής κάρτας','error');
  }finally{
    if(submit){
      submit.disabled=false;
      submit.dataset.saving='0';
      submit.textContent='Καταχώρηση πληρωμής';
    }
  }
}


function openCardTransactionsSheet(cardId){
  const card=(D.creditCards||[]).find(c=>String(c.id)===String(cardId));
  if(!card)return;

  let overlay=document.getElementById('cardTransactionsSheet');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='cardTransactionsSheet';
    overlay.className='card-payment-sheet-overlay';
    overlay.innerHTML=`
      <div class="card-payment-sheet card-transactions-sheet" onclick="event.stopPropagation()">
        <div class="card-payment-handle"></div>
        <div class="card-payment-head">
          <div>
            <span>Κινήσεις κάρτας</span>
            <h3 id="cardTransactionsTitle">Κινήσεις κάρτας</h3>
            <p id="cardTransactionsSubtitle">Δες όλες τις αγορές, τις δόσεις και τις πληρωμές αυτής της κάρτας.</p>
          </div>
          <button type="button" onclick="closeCardTransactionsSheet()" aria-label="Κλείσιμο">×</button>
        </div>
        <div id="cardTransactionsList"></div>
      </div>`;
    overlay.addEventListener('click',closeCardTransactionsSheet);
    document.body.appendChild(overlay);
  }

  $('cardTransactionsTitle').textContent='Κινήσεις · '+(card.name||'Κάρτα');
  const rows=cardTransactionsForCard(cardId);
  const list=$('cardTransactionsList');
  if(list){
    if(!rows.length){
      list.innerHTML='<div class="card-plans-empty">Δεν υπάρχουν ακόμα κινήσεις σε αυτή την κάρτα.</div>';
    }else{
      list.innerHTML=rows.map(t=>{
        const canDeletePurchase=(t.type==='purchase' || t.type==='installment_purchase') && (t.expenseId || t.installmentPlanId);
        const deleteAction=t.type==='installment_purchase' && t.installmentPlanId
          ? `deleteInstallmentPlan('${t.installmentPlanId}')`
          : `deleteCardPurchaseFromCard('${t.expenseId||''}')`;
        return `<div class="card-transaction-sheet-row type-${esc(t.type||'purchase')}">
          <div class="card-transaction-sheet-main">
            <strong>${esc(t.description||cardTransactionLabel(t))}</strong>
            <span>${esc(cardTransactionLabel(t))}</span>
            <small>${esc(t.transactionDate||'—')}</small>
          </div>
          <div class="card-transaction-sheet-amount">${cardTransactionAmountPrefix(t)}${fmt(t.amount||0)}</div>
          ${canDeletePurchase?`<button type="button" class="card-transaction-delete" onclick="${deleteAction}" aria-label="Διαγραφή κίνησης">×</button>`:''}
        </div>`;
      }).join('');
    }
  }

  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));
}

function closeCardTransactionsSheet(){
  const overlay=document.getElementById('cardTransactionsSheet');
  if(overlay)overlay.classList.remove('active');
  setTimeout(()=>{
    if(!document.querySelector('.modal-overlay.active') && !document.querySelector('.card-payment-sheet-overlay.active'))document.body.classList.remove('modal-open');
  },180);
}


function openCardPlansSheet(cardId){
  const card=(D.creditCards||[]).find(c=>String(c.id)===String(cardId));
  if(!card)return;
  let overlay=document.getElementById('cardPlansSheet');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='cardPlansSheet';
    overlay.className='card-payment-sheet-overlay';
    overlay.innerHTML=`
      <div class="card-payment-sheet card-plans-sheet" onclick="event.stopPropagation()">
        <div class="card-payment-handle"></div>
        <div class="card-payment-head">
          <div>
            <span>Πλάνα δόσεων</span>
            <h3 id="cardPlansTitle">Πλάνα κάρτας</h3>
            <p id="cardPlansSubtitle">Δες όλες τις ενεργές αγορές με δόσεις και διέγραψε λάθος καταχωρήσεις.</p>
          </div>
          <button type="button" onclick="closeCardPlansSheet()" aria-label="Κλείσιμο">×</button>
        </div>
        <div id="cardPlansList"></div>
      </div>`;
    overlay.addEventListener('click',closeCardPlansSheet);
    document.body.appendChild(overlay);
  }
  $('cardPlansTitle').textContent='Πλάνα · '+(card.name||'Κάρτα');
  const plans=(D.creditCardInstallmentPlans||[]).filter(p=>String(p.cardId)===String(cardId) && p.status==='active');
  const list=$('cardPlansList');
  if(list){
    if(!plans.length){
      list.innerHTML='<div class="card-plans-empty">Δεν υπάρχουν ενεργά πλάνα δόσεων σε αυτή την κάρτα.</div>';
    }else{
      list.innerHTML=plans.map(p=>{
        const paid=Number(p.paidInstallments)||0;
        const total=Number(p.installmentCount)||0;
        const paidAmount=capvoPlanPaidAmount(p);
        const remaining=capvoPlanRemainingAmount(p);
        return `<div class="card-plan-row"><div class="card-plan-main"><strong>${esc(p.title||'Πλάνο δόσεων')}</strong><span>${fmt(p.installmentAmount||0)} / μήνα · ${paid}/${total} δόσεις</span><small>Πληρωμένο ${fmt(paidAmount)} · Υπόλοιπο ${fmt(remaining)} · επόμενη ${esc(p.nextDueDate||'—')}</small></div><button type="button" class="card-plan-delete" onclick="deleteInstallmentPlan('${p.id}')">Διαγραφή</button></div>`;
      }).join('');
    }
  }
  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>overlay.classList.add('active'));
}

function closeCardPlansSheet(){
  const overlay=document.getElementById('cardPlansSheet');
  if(overlay)overlay.classList.remove('active');
  setTimeout(()=>{
    if(!document.querySelector('.modal-overlay.active'))document.body.classList.remove('modal-open');
  },180);
}

async function deleteInstallmentPlan(planId){
  const plan=(D.creditCardInstallmentPlans||[]).find(p=>String(p.id)===String(planId));
  if(!plan)return;
  if((Number(plan.paidInstallments)||0)>0 || capvoPlanPaidAmount(plan)>0 || capvoLegacyUnallocatedPlanPaymentForCard(plan.cardId)>0){
    showMiniToast?.('Δεν μπορείς να διαγράψεις πλάνο με ήδη πληρωμένες δόσεις/πληρωμές.','error');
    return;
  }
  const confirmed=await showConfirmModal({title:'Διαγραφή πλάνου δόσεων',message:'Η αγορά και το πλάνο θα αφαιρεθούν από την κάρτα. Συνέχεια;',confirmText:'Διαγραφή'});
  if(!confirmed)return;
  const card=(D.creditCards||[]).find(c=>String(c.id)===String(plan.cardId));
  const originalBalance=Number(card?.balance)||0;
  try{
    const userId=getDataOwnerId?.();
    if(userId && typeof supabaseClient!=='undefined'){
      await supabaseClient.from('credit_card_installment_items').delete().eq('plan_id',planId);
      await supabaseClient.from('credit_card_installment_plans').delete().eq('id',planId);
      if(plan.originalTransactionId)await supabaseClient.from('credit_card_transactions').delete().eq('id',plan.originalTransactionId);
      if(plan.originalExpenseId)await supabaseClient.from('expenses').delete().eq('id',plan.originalExpenseId);
    }
    if(card)card.balance=originalBalance;
    D.creditCardInstallmentPlans=(D.creditCardInstallmentPlans||[]).filter(p=>String(p.id)!==String(planId));
    D.creditCardInstallmentItems=(D.creditCardInstallmentItems||[]).filter(i=>String(i.planId)!==String(planId));
    D.creditCardTransactions=(D.creditCardTransactions||[]).filter(t=>String(t.installmentPlanId)!==String(planId) && String(t.id)!==String(plan.originalTransactionId));
    Object.values(D.months||{}).forEach(m=>{m.daily=(m.daily||[]).filter(e=>String(e.id)!==String(plan.originalExpenseId));});
    await save();
    closeCardPlansSheet();
    closeCardTransactionsSheet?.();
    render();
    showMiniToast?.('✅ Το πλάνο διαγράφηκε');
  }catch(e){
    console.error('deleteInstallmentPlan failed:',e);
    if(card)card.balance=originalBalance;
    showMiniToast?.('❌ Δεν μπόρεσα να διαγράψω το πλάνο','error');
  }
}


function stabilizeCardsSectionFinalLayout(){
  const page=$('vCards');
  const list=$('ccList');
  const summary=$('ccSummary');
  const analysis=$('ccPlanAnalysis');
  if(!page||!list||!summary||!analysis)return;

  page.classList.add('cards-final-flow');
  list.classList.add('cards-final-list');
  summary.classList.add('cards-final-summary');
  analysis.classList.add('cards-final-analysis');
}

// ===== CC MODALS =====
function setLoanType(type){
  if(!['mortgage','consumer','business','personal','other'].includes(type))type='consumer';
  const hidden=$('fCCLoanType');
  if(hidden)hidden.value=type;
  document.querySelectorAll('#ccLoanTypeCustom button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.loanType===type);
  });
}

function setLoanPurpose(purpose){
  if(!['car_purchase','renovation','studies','medical','debt_consolidation','household','other'].includes(purpose))purpose='other';
  const hidden=$('fCCLoanPurpose');
  if(hidden)hidden.value=purpose;
  document.querySelectorAll('#ccLoanPurposeCustom button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.loanPurpose===purpose);
  });
}

function resetCCFormUI(activePreset='credit_card'){
  const err=$('ccFormError');
  if(err){err.textContent='';err.classList.remove('show')}
  ['fCCN','fCCB','fCCR','fCCM','fCCL','fCCBank','fCCDueDay','fCCInstallments'].forEach(id=>{
    const el=$(id);
    if(el)el.classList.remove('field-error');
  });
  applyCCPreset(activePreset,{preserveValues:true});
}

function ccError(message,fieldId){
  const err=$('ccFormError');
  if(err){err.textContent=message;err.classList.add('show')}
  if(typeof showMiniToast==='function')showMiniToast(message,'error');
  if(fieldId && $(fieldId)){
    $(fieldId).classList.add('field-error');
    $(fieldId).focus();
  }
}

function applyCCPreset(type,opts={}){
  type=type==='credit'?'credit_card':type;
  type=type==='zero'?'credit_card':type;
  if(!['credit_card','loan'].includes(type))type='credit_card';

  const preserve=!!opts.preserveValues;
  const modal=$('mCC');
  if(modal)modal.dataset.debtType=type;

  const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text};
  const setDisplay=(id,display)=>{const el=$(id);if(el)el.style.display=display};

  if($('fCCType'))$('fCCType').value=type;
  if(type==='loan' && typeof setLoanType==='function')setLoanType($('fCCLoanType')?.value||'consumer');
  if(type==='loan' && typeof setLoanPurpose==='function')setLoanPurpose($('fCCLoanPurpose')?.value||'other');

  document.querySelectorAll('#mCC .debt-type-tabs button').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.cardPreset===type);
  });

  setDisplay('ccLoanTypeRow',type==='loan'?'block':'none');
  setDisplay('ccLoanPurposeRow',type==='loan'?'block':'none');
  setDisplay('ccLimitRow',type==='credit_card'?'block':'none');

  const icon=$('debtModalIcon');
  if(icon)icon.textContent=type==='loan'?'🏦':'💳';

  if(type==='credit_card'){
    setText('mCCTitle','Νέα πιστωτική κάρτα');
    setText('ccModalIntro','Δήλωσε την πιστωτική σου. Οι αγορές και οι άτοκες δόσεις μπαίνουν μετά από την Προσθήκη εξόδου.');
    setText('fCCNLabel','Όνομα κάρτας');
    setText('fCCBLabel','Τρέχον χρέος κάρτας');
    setText('fCCBHelp','Πόσα χρωστάς σήμερα στην κάρτα.');
    setText('fCCMLabel','Ελάχιστη πληρωμή');
    setText('fCCMHelp','Αν δεν την ξέρεις, άφησέ την 0.');
    setText('fCCDueLabel','Ημέρα πληρωμής');
    setText('ccModalHint','Πιστωτικό όριο = το συνολικό διαθέσιμο της κάρτας. Τρέχον χρέος = πόσα χρωστάς σήμερα.');
    if($('btnCC'))$('btnCC').textContent='Αποθήκευση πιστωτικής';
    if(!preserve){
      $('fCCN').value='';$('fCCR').value='18.5';$('fCCM').value='';$('fCCL').value='';
    }
  }
  else if(type==='loan'){
    setText('mCCTitle','Νέο δάνειο');
    setText('ccModalIntro','Δήλωσε οφειλή με μηνιαία δόση. Το συνολικό ποσό παρακολουθείται εδώ, ενώ στο dashboard μετράει μόνο η πληρωμή/δόση.');
    setText('fCCNLabel','Όνομα δανείου');
    setText('fCCBLabel','Υπόλοιπο οφειλής');
    setText('fCCBHelp','Πόσο απομένει να αποπληρωθεί.');
    setText('fCCMLabel','Μηνιαία δόση');
    setText('fCCMHelp','Το ποσό που πληρώνεις κάθε μήνα από το budget.');
    setText('fCCDueLabel','Ημέρα πληρωμής δόσης');
    setText('ccModalHint','Τύπος δανείου = προϊόν τράπεζας. Σκοπός δανείου = γιατί πήρες τα χρήματα, π.χ. αυτοκίνητο ή ανακαίνιση.');
    if($('btnCC'))$('btnCC').textContent='Αποθήκευση δανείου';
    if(!preserve){
      $('fCCN').value='';$('fCCR').value='6.5';$('fCCM').value='';$('fCCL').value='0';
      if(typeof setLoanType==='function')setLoanType('consumer');
      if(typeof setLoanPurpose==='function')setLoanPurpose('other');
    }
  }
}

function editCC(id){
  capvoSuppressAutoFocus?.(900);
  const c=D.creditCards.find(x=>x.id===id);if(!c)return;
  closeM();
  document.body.classList.add('modal-open');
  $('mCC').classList.add('active');
  $('fCCID').value=id;
  $('fCCN').value=c.name||'';
  $('fCCB').value=c.balance||'';
  $('fCCR').value=c.rate||0;
  $('fCCM').value=c.minPay||'';
  $('fCCL').value=c.limit||'';
  if($('fCCBank'))$('fCCBank').value=c.bankName||'';
  if($('fCCDueDay'))$('fCCDueDay').value=c.paymentDueDay||'';
  if($('fCCLoanType'))$('fCCLoanType').value=c.loanType||'consumer';
  if(typeof setLoanType==='function')setLoanType(c.loanType||'consumer');
  if($('fCCLoanPurpose'))$('fCCLoanPurpose').value=c.loanPurpose||'other';
  if(typeof setLoanPurpose==='function')setLoanPurpose(c.loanPurpose||'other');
  resetCCFormUI(c.accountType||'credit_card');
  // autofocus disabled: user taps the field when ready;
}

function saveCC(){
  const type=$('fCCType')?.value||'credit_card';
  resetCCFormUI(type);
  const n=$('fCCN').value.trim(),id=$('fCCID').value;
  const balance=parseFloat($('fCCB').value);
  const rate=parseFloat($('fCCR').value||'0');
  const minPay=parseFloat($('fCCM').value||'0');
  const limit=type==='credit_card'?parseFloat($('fCCL').value||'0'):0;
  const dueDay=parseInt($('fCCDueDay')?.value||'',10);
  const originalAmount=type==='loan'?Math.max(balance,0):0;

  if(!Number.isFinite(balance) || balance<0){
    ccError(type==='credit_card'?'Συμπλήρωσε τρέχον χρέος κάρτας.':'Συμπλήρωσε υπόλοιπο οφειλής.','fCCB');
    return;
  }
  if(!n){
    ccError(type==='credit_card'?'Συμπλήρωσε όνομα κάρτας.':'Συμπλήρωσε όνομα δανείου.','fCCN');
    return;
  }
  if(!Number.isFinite(rate) || rate<0){ccError('Το επιτόκιο δεν μπορεί να είναι αρνητικό.','fCCR');return}
  if(!Number.isFinite(minPay) || minPay<0){ccError(type==='loan'?'Η μηνιαία δόση δεν μπορεί να είναι αρνητική.':'Η ελάχιστη πληρωμή δεν μπορεί να είναι αρνητική.','fCCM');return}
  if(type==='credit_card' && (!Number.isFinite(limit) || limit<0)){ccError('Το πιστωτικό όριο δεν μπορεί να είναι αρνητικό.','fCCL');return}
  if(type==='credit_card' && limit>0 && balance>limit){
    ccError('Το χρέος είναι μεγαλύτερο από το πιστωτικό όριο. Έλεγξε τα ποσά.','fCCB');
    return;
  }
  if(dueDay && (dueDay<1 || dueDay>31)){ccError('Η ημέρα πληρωμής πρέπει να είναι από 1 έως 31.','fCCDueDay');return}
  if(type==='bnpl' && $('fCCInstallments')?.value && (!Number.isFinite(installments)||installments<1)){
    ccError('Οι δόσεις πρέπει να είναι τουλάχιστον 1.','fCCInstallments');
    return;
  }

  const obj={
    name:n,
    balance,
    rate,
    minPay,
    limit,
    accountType:type,
    bankName:$('fCCBank')?.value?.trim()||'',
    paymentDueDay:dueDay||null,
    loanType:type==='loan'?($('fCCLoanType')?.value||'consumer'):null,
    loanPurpose:type==='loan'?($('fCCLoanPurpose')?.value||'other'):null,
    originalAmount:type==='loan'?originalAmount:null,
    budgetTreatment:'payment_only',
    isActive:true
  };

  if(id){
    const c=D.creditCards.find(x=>x.id===id);
    if(c){const op=c.chosenPay;Object.assign(c,obj);c.chosenPay=op||obj.minPay}
  }
  else{
    obj.id=gid();
    obj.chosenPay=obj.minPay;
    D.creditCards.push(obj);
  }
  save();
  closeM();
  render();
  if(typeof showMiniToast==='function'){
    const label=type==='credit_card'?'πιστωτική':'δάνειο';
    showMiniToast(id?'✅ Η οφειλή ενημερώθηκε':'✅ Προστέθηκε '+label);
  }
}
async function delCC(id){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή κάρτας',
    message:'Θέλεις να διαγράψεις αυτή την κάρτα;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  try{

    D.creditCards=D.creditCards.filter(c=>c.id!==id);

    save();
    render();

    showMiniToast('✅ Η κάρτα διαγράφηκε');

  }catch(e){

    console.error('Delete CC failed:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}
