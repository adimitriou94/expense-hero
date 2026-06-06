// ===== CREDIT CARDS MODULE =====

function rCC(){
  const cards=D.creditCards||[];
  if(cards.length===0){
    $('ccList').innerHTML='<div class="chart-container"><p style="text-align:center;color:var(--text3);font-size:13px">Δεν υπάρχουν κάρτες. Πάτα «+ Κάρτα».</p></div>';
    $('ccSummary').innerHTML='';$('ccPlanAnalysis').innerHTML='';return;
  }
  const fxS=fixedTotal();
  let h='';
  cards.forEach((c,idx)=>{
    const pct=c.limit>0?Math.min(100,Math.round(c.balance/c.limit*100)):0;
    const mi=c.balance*(c.rate/100/12);
    const bc=pct>80?'var(--red)':pct>50?'var(--amber)':'var(--teal)';
    const effectiveMin=effectiveCardMinPay(c);
    const pay=effectiveCardPayment(c);
    const maxPay=Math.max(
      Math.ceil(effectiveMin)+5,
      Math.min(Math.ceil(c.balance>0?c.balance:1),Math.ceil(D.income-fxS))
    );
    const minLabel=(Number(c.minPay)||0)>0?fmt(c.minPay):'~'+fmt(effectiveMin);

    h+='<div class="cc-card"><div class="cc-head"><div class="cc-icon">💳</div><div class="cc-info"><div class="cc-name">'+esc(c.name)+'</div><div class="cc-meta">Επιτόκιο '+c.rate+'% · Ελάχ. '+minLabel+'</div></div><div class="cc-actions"><button class="edit-btn" onclick="editCC(\''+c.id+'\')" title="Επεξεργασία">✎</button><button class="del-btn" onclick="delCC(\''+c.id+'\')" title="Διαγραφή">×</button></div></div>';
    h+='<div class="cc-body">';
    h+='<div class="cc-row"><span class="lb">Χρέος</span><span class="vl" style="color:var(--red)">'+fmt(c.balance)+'</span></div>';
    if(c.limit>0)h+='<div class="cc-row"><span class="lb">Όριο</span><span class="vl">'+fmt(c.limit)+'</span></div>';
    h+='<div class="cc-row"><span class="lb">Μηνιαίος τόκος</span><span class="vl" style="color:var(--amber)">~'+fmt(mi)+'</span></div>';
    if(c.limit>0){h+='<div class="cc-bar"><div class="cc-bar-info"><span>Χρήση ορίου</span><span>'+pct+'%</span></div><div class="cc-bar-track"><div class="cc-bar-fill" style="width:'+pct+'%;background:'+bc+'"></div></div></div>';}
    if(c.balance>0){
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
  cards.forEach((c,idx)=>{if(c.balance>0) calcPay(idx)});
  rCCSummary();
  rCCPlanAnalysis();
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
  const c=D.creditCards[idx];
  const pay=effectiveCardPayment(c);
  const mr=c.rate/100/12, mi=c.balance*mr;
  const fxS=fixedTotal();
  const tOther=D.creditCards.reduce((s,cc,i)=>i!==idx?s+(cc.balance>0?effectiveCardPayment(cc):0):s,0);
  const freeAfter=D.income-fxS-tOther-pay;

  const res=calcPayoff(c.balance,c.rate,pay);
  let rh='';
  if(res.impossible && pay<=mi){
    rh='<div style="color:var(--red);font-weight:500">⚠️ Η δόση δεν καλύπτει τον τόκο ('+fmt(mi)+'). Το χρέος αυξάνεται!</div>';
  } else if(res.impossible){
    rh='<div style="color:var(--red)">Δεν θα εξοφληθεί σε λογικό χρόνο.</div>';
  } else {
    rh='Εξόφληση σε <strong>'+Math.floor(res.months/12)+'χ '+res.months%12+'μ</strong> · Σύνολο: <strong>'+fmt(res.totalPaid)+'</strong> (τόκοι: <strong style="color:var(--red)">'+fmt(res.totalInterest)+'</strong>)';
    if(pay>effectiveCardMinPay(c)){
      const minRes=calcPayoff(c.balance,c.rate,effectiveCardMinPay(c));
      if(!minRes.impossible && minRes.totalPaid>res.totalPaid){
        rh+='<br><span style="color:var(--teal)">💰 Γλιτώνεις ~'+fmt(minRes.totalPaid-res.totalPaid)+' σε τόκους vs ελάχιστη!</span>';
      }
    }
  }
  const el=$('payResult'+idx);if(el)el.innerHTML=rh;

  let fh='';
  if(freeAfter<0) fh='<div class="feasibility bad">🚫 <div><strong>Μη εφικτό!</strong> Λείπουν '+fmt(Math.abs(freeAfter))+'.</div></div>';
  else if(freeAfter<150) fh='<div class="feasibility tight">⚡ <div><strong>Πολύ σφιχτά.</strong> Μένουν '+fmt(freeAfter)+'.</div></div>';
  else if(freeAfter<400) fh='<div class="feasibility tight">📊 <div><strong>Εφικτό αλλά tight.</strong> Μένουν '+fmt(freeAfter)+'.</div></div>';
  else fh='<div class="feasibility ok">✅ <div><strong>Εφικτό!</strong> Μένουν '+fmt(freeAfter)+'.</div></div>';
  const fl=$('payFeasibility'+idx);if(fl)fl.innerHTML=fh;
}


function setPayPreset(idx,val){
  const range=$('payRange'+idx);
  if(range) range.value=val;
  updatePay(idx,val);
  rCC();
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
  $('sCC').textContent=fmt(ccPayTotal());
  const spent=fixedTotal()+ccPayTotal()+dailyCashTotal();
  const bal=D.income-spent;
  const pct=D.income>0?Math.min(100,Math.round(spent/D.income*100)):0;
  if(typeof renderDashboardAdvisorSnapshot==='function') renderDashboardAdvisorSnapshot(pct,bal);
}

function rCCSummary(){
  const cards=(D.creditCards||[]).filter(c=>c.balance>0);
  if(cards.length===0){$('ccSummary').innerHTML='';return}
  const tDebt=cards.reduce((s,c)=>s+c.balance,0);
  const tPay=cards.reduce((s,c)=>s+effectiveCardPayment(c),0);
  const fxS=fixedTotal();
  const afterAll=D.income-fxS-tPay;

  let sm='<div class="adv-card blue" style="margin-top:16px"><h3>📊 Σύνολο</h3>';
  sm+='<div class="cc-row"><span class="lb">Συνολικό χρέος</span><span class="vl" style="color:var(--red)">'+fmt(tDebt)+'</span></div>';
  sm+='<div class="cc-row"><span class="lb">Δόσεις/μήνα</span><span class="vl">'+fmt(tPay)+'</span></div>';
  sm+='<div class="cc-row" style="padding-top:10px;margin-top:10px;border-top:1px solid #f0ede6"><span class="lb"><strong>Μένει για ημερήσια</strong></span><span class="vl" style="color:'+(afterAll>=0?'var(--teal)':'var(--red)')+'"><strong>'+fmt(afterAll)+'</strong></span></div>';
  if(afterAll<0)sm+='<div class="tip red" style="margin-top:12px">⚠️ Ξεπερνάς τα διαθέσιμα κατά '+fmt(Math.abs(afterAll))+'.</div>';
  else if(afterAll<200)sm+='<div class="tip amber" style="margin-top:12px">⚡ Μόνο '+fmt(afterAll)+' για ημερήσια.</div>';
  else sm+='<div class="tip green" style="margin-top:12px">✅ '+fmt(afterAll)+' για ημερήσια.</div>';
  sm+='</div>';
  $('ccSummary').innerHTML=sm;
}

// ===== DETAILED PLAN ANALYSIS =====
function rCCPlanAnalysis(){
  const cards=(D.creditCards||[]).filter(c=>c.balance>0);
  if(cards.length===0){$('ccPlanAnalysis').innerHTML='';return}

  const fxS=fixedTotal();
  const tPay=cards.reduce((s,c)=>s+effectiveCardPayment(c),0);
  const tDebt=cards.reduce((s,c)=>s+c.balance,0);
  const afterAll=D.income-fxS-tPay;

  // Score calculation (0-100)
  let score=50;
  // Feasibility
  if(afterAll<0) score-=30;
  else if(afterAll<150) score-=15;
  else if(afterAll>=400) score+=10;
  // Are payments above minimum?
  cards.forEach(c=>{
    const pay=effectiveCardPayment(c);
    const mi=c.balance*(c.rate/100/12);
    if(pay<=mi) score-=20;
    else if(pay>=effectiveCardMinPay(c)*2) score+=10;
    else if(pay>effectiveCardMinPay(c)) score+=5;
  });
  // DTI check
  const dti=D.income>0?tPay/D.income*100:0;
  if(dti>36) score-=15;
  else if(dti<=20) score+=10;
  score=Math.max(0,Math.min(100,score));

  const sClass=score>=70?'good':score>=40?'ok':'bad';
  const sLabel=score>=70?'Καλό πλάνο':score>=40?'Χρειάζεται βελτίωση':'Προβληματικό';

  let h='<div class="adv-card" style="margin-top:16px;border-left-color:var(--purple)"><h3>📝 Αξιολόγηση πλάνου δόσεων</h3>';

  // Score gauge
  h+='<div class="score-gauge"><div class="score-circle '+sClass+'">'+score+'</div><div class="score-info"><strong>'+sLabel+'</strong>';
  if(score>=70) h+='Οι δόσεις σου είναι ρεαλιστικές και θα εξοφλήσεις σε λογικό χρόνο.';
  else if(score>=40) h+='Υπάρχουν σημεία που μπορείς να βελτιώσεις — δες τις λεπτομέρειες.';
  else h+='Το πλάνο έχει σοβαρά προβλήματα. Χρειάζεται αλλαγή.';
  h+='</div></div>';

  // Per-card timeline
  h+='<div style="margin-top:16px"><div style="font-size:13px;font-weight:600;margin-bottom:10px">Αναλυτικά ανά κάρτα:</div>';
  let longestMonths=0;
  cards.forEach(c=>{
    const pay=effectiveCardPayment(c);
    const res=calcPayoff(c.balance,c.rate,pay);
    if(res.months>longestMonths) longestMonths=res.months;
    const minRes=calcPayoff(c.balance,c.rate,effectiveCardMinPay(c));
    h+='<div style="padding:12px 0;border-bottom:1px solid #f0ede6">';
    h+='<div style="display:flex;justify-content:space-between;font-size:13px"><strong>'+esc(c.name)+'</strong><span style="font-family:var(--mono);font-weight:600;color:var(--blue)">'+fmt(pay)+'/μήνα</span></div>';
    if(res.impossible){
      h+='<div style="color:var(--red);font-size:12px;margin-top:4px">⚠️ Δεν εξοφλείται με αυτή τη δόση</div>';
    } else {
      h+='<div style="font-size:12px;color:var(--text2);margin-top:4px">⏱ '+Math.floor(res.months/12)+'χ '+res.months%12+'μ · Τόκοι: <span style="color:var(--red)">'+fmt(res.totalInterest)+'</span>';
      if(!minRes.impossible && pay>c.minPay){
        h+=' · <span style="color:var(--teal)">Εξοικονόμηση: '+fmt(minRes.totalInterest-res.totalInterest)+'</span>';
      }
      h+='</div>';
    }
    h+='</div>';
  });
  h+='</div>';

  // Total summary
  const totalInterest=cards.reduce((s,c)=>{const r=calcPayoff(c.balance,c.rate,effectiveCardPayment(c));return s+(r.impossible?0:r.totalInterest)},0);
  if(longestMonths<600){
    h+='<div style="margin-top:16px;padding:14px 18px;background:var(--bg);border-radius:var(--radius-sm)">';
    h+='<div style="font-size:13px;color:var(--text2)">Θα είσαι <strong style="color:var(--teal)">ελεύθερος χρεών</strong> σε <strong>'+Math.floor(longestMonths/12)+' χρόνια '+longestMonths%12+' μήνες</strong></div>';
    h+='<div style="font-size:12px;color:var(--text3);margin-top:4px">Συνολικοί τόκοι: <strong style="color:var(--red)">'+fmt(totalInterest)+'</strong> ('+Math.round(totalInterest/tDebt*100)+'% επί του χρέους)</div>';
    h+='</div>';
  }

  // Strategy tips
  if(cards.length>1){
    const byRate=[...cards].sort((a,b)=>b.rate-a.rate);
    const byBal=[...cards].sort((a,b)=>a.balance-b.balance);
    h+='<div class="tip purple" style="margin-top:12px"><strong>💡 Avalanche (λιγότεροι τόκοι):</strong> Ρίξε extra στην «'+esc(byRate[0].name)+'» ('+byRate[0].rate+'%). Ελάχιστο στις υπόλοιπες.</div>';
    h+='<div class="tip green" style="margin-top:8px"><strong>🎯 Snowball (ψυχολογική ώθηση):</strong> Εξόφλησε πρώτα «'+esc(byBal[0].name)+'» ('+fmt(byBal[0].balance)+') — μικρότερο χρέος, γρήγορη νίκη.</div>';
  }

  h+='</div>';
  $('ccPlanAnalysis').innerHTML=h;
}

// ===== CC MODALS =====
function resetCCFormUI(activePreset='credit'){
  const err=$('ccFormError');
  if(err){err.textContent='';err.classList.remove('show')}
  ['fCCN','fCCB','fCCR','fCCM','fCCL'].forEach(id=>{
    const el=$(id);
    if(el)el.classList.remove('field-error');
  });
  document.querySelectorAll('#mCC .debt-preset-chip').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.cardPreset===activePreset);
  });
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

function applyCCPreset(type){
  resetCCFormUI(type);

  const nameEl=$('fCCN');
  const rateEl=$('fCCR');
  const minPayEl=$('fCCM');
  const limitEl=$('fCCL');

  // Presets are intentional shortcuts. When the user switches preset,
  // update the preset-controlled fields immediately instead of keeping
  // stale values from the previous selection. The balance/debt amount is
  // preserved because it is the user's actual input.
  if(type==='credit'){
    if(nameEl)nameEl.value='Πιστωτική κάρτα';
    if(rateEl)rateEl.value='18.5';
    if(minPayEl && !minPayEl.value)minPayEl.value='0.00';
    if(limitEl && !limitEl.value)limitEl.value='0.00';
  }
  else if(type==='loan'){
    if(nameEl)nameEl.value='Δάνειο';
    if(rateEl)rateEl.value='9.0';
    if(minPayEl && !minPayEl.value)minPayEl.value='0.00';
    if(limitEl)limitEl.value='0.00';
  }
  else if(type==='zero'){
    if(nameEl)nameEl.value='Άτοκη δόση';
    if(rateEl)rateEl.value='0';
    if(minPayEl)minPayEl.value='0.00';
    if(limitEl)limitEl.value='0.00';
  }
}

function editCC(id){
  capvoSuppressAutoFocus?.(900);
  const c=D.creditCards.find(x=>x.id===id);if(!c)return;
  closeM();
  document.body.classList.add('modal-open');
  $('mCC').classList.add('active');
  $('mCCTitle').textContent='Επεξεργασία κάρτας';
  $('fCCN').value=c.name;
  $('fCCB').value=c.balance;
  $('fCCR').value=c.rate;
  $('fCCM').value=c.minPay;
  $('fCCL').value=c.limit;
  $('fCCID').value=id;
  $('btnCC').textContent='Ενημέρωση κάρτας';
  resetCCFormUI(Number(c.rate)===0?'zero':'credit');
  // autofocus disabled: user taps the field when ready;
}

function saveCC(){
  resetCCFormUI();
  const n=$('fCCN').value.trim(),id=$('fCCID').value;
  const balance=parseFloat($('fCCB').value);
  const rate=parseFloat($('fCCR').value||'0');
  const minPay=parseFloat($('fCCM').value||'0');
  const limit=parseFloat($('fCCL').value||'0');

  if(!Number.isFinite(balance) || balance<=0){
    ccError('Συμπλήρωσε υπόλοιπο/χρέος μεγαλύτερο από 0.','fCCB');
    return;
  }
  if(!n){ccError('Συμπλήρωσε όνομα κάρτας ή δανείου.','fCCN');return}
  if(!Number.isFinite(rate) || rate<0){ccError('Το επιτόκιο δεν μπορεί να είναι αρνητικό.','fCCR');return}
  if(!Number.isFinite(minPay) || minPay<0){ccError('Η ελάχιστη δόση δεν μπορεί να είναι αρνητική.','fCCM');return}
  if(!Number.isFinite(limit) || limit<0){ccError('Το πιστωτικό όριο δεν μπορεί να είναι αρνητικό.','fCCL');return}
  if(limit>0 && balance>limit){
    ccError('Το χρέος είναι μεγαλύτερο από το πιστωτικό όριο. Έλεγξε τα ποσά ή άφησε το όριο 0.','fCCL');
    return;
  }

  const obj={name:n,balance,rate,minPay,limit};
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
  if(typeof showMiniToast==='function')showMiniToast(id?'✅ Η κάρτα ενημερώθηκε':'✅ Η κάρτα προστέθηκε');
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
