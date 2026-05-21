// ===== FINANCIAL ADVISOR MODULE =====

function rAdv(){
  const fxS=fixedTotal(), ccS=ccPayTotal(), af=fxS+ccS;
  const m=D.months[curM]||{daily:[]};
  const dlS=dailyTotal();
  const tot=af+dlS, bal=D.income-tot, free=D.income-af;
  const[y,mo]=curM.split('-');
  let h='';

  if(D.income<=0){
    h='<div class="adv-card"><h3>👋 Ξεκίνα</h3><p>Βάλε το εισόδημά σου (Dashboard → Αλλαγή) για συμβουλές.</p></div>';
    $('advContent').innerHTML=h; return;
  }

  // ===== 1. OVERVIEW =====
  const fPct=Math.round(af/D.income*100);
  const dPct=D.income>0?Math.round(dlS/D.income*100):0;
  const totalPct=D.income>0?Math.round(tot/D.income*100):0;

  h+='<div class="adv-card '+(fPct>60?'danger':fPct>45?'warn':'green')+'"><h3>'+(fPct>60?'⚠️':fPct>45?'⚡':'✅')+' Σταθερές υποχρεώσεις</h3>';
  h+='<p>Πάγια + δόσεις: <strong>'+fmt(af)+'</strong> ('+fPct+'%)</p>';
  if(ccS>0) h+='<p style="font-size:12px;color:var(--text3)">Πάγια: '+fmt(fxS)+' + Κάρτες: '+fmt(ccS)+'</p>';
  h+='<p>Μετά από αυτά:</p><span class="adv-big" style="color:'+(free>0?'var(--teal)':'var(--red)')+'">'+fmt(Math.max(0,free))+'</span>';
  h+='<div class="tip blue">ℹ️ Αυτό είναι το ποσό που μένει πριν αφαιρεθούν τα ημερήσια έξοδα.</div>';
  h+='</div>';

  h+='<div class="adv-card '+(bal<0?'danger':bal<200?'warn':'blue')+'"><h3>'+(bal<0?'⚠️':'📉')+' Πραγματική εικόνα μήνα</h3>';
  h+='<div class="cc-row"><span class="lb">Ημερήσια έξοδα</span><span class="vl" style="color:var(--amber)">'+fmt(dlS)+' ('+dPct+'%)</span></div>';
  h+='<div class="cc-row"><span class="lb">Σύνολο εξόδων</span><span class="vl">'+fmt(tot)+' ('+totalPct+'%)</span></div>';
  h+='<p style="margin-top:12px">Τελικό υπόλοιπο:</p><span class="adv-big" style="color:'+(bal>=0?'var(--teal)':'var(--red)')+'">'+fmt(bal)+'</span>';
  if(bal<0) h+='<div class="tip red">🚫 Έχεις ξεπεράσει το εισόδημά σου κατά '+fmt(Math.abs(bal))+'.</div>';
  else if(bal<200) h+='<div class="tip amber">⚡ Το πραγματικό υπόλοιπο είναι χαμηλό. Πρόσεχε τα υπόλοιπα έξοδα του μήνα.</div>';
  else h+='<div class="tip green">✅ Αυτό είναι το πραγματικό ποσό που σου μένει αφού αφαιρεθούν όλα τα έξοδα του μήνα.</div>';
  h+='</div>';

  // ===== 2. DAILY BUDGET =====
  const dim=new Date(parseInt(y),parseInt(mo),0).getDate();
  const today=new Date(), dom=curM===curMK()?today.getDate():dim;
  const remD=dim-dom, db=remD>0?(free-dlS)/remD:0;
  h+='<div class="adv-card"><h3>💡 Ημερήσιο budget</h3>';
  if(remD>0){
    h+='<p>Απομένουν <strong>'+remD+' ημέρες</strong>:</p>';
    h+='<span class="adv-big" style="color:'+(db>0?'var(--blue)':'var(--red)')+'">'+fmt(Math.max(0,db))+' / ημέρα</span>';
    if(db<0) h+='<div class="tip red">⚠️ Έχεις ξεπεράσει τα ελεύθερα. Πρόσεχε τα ημερήσια.</div>';
    else if(db<15) h+='<div class="tip amber">⚡ Πολύ χαμηλό budget. Αποφύγε τα μη απαραίτητα.</div>';
  } else {
    h+='<p>Αποταμίευση μήνα:</p><span class="adv-big" style="color:'+(bal>=0?'var(--teal)':'var(--red)')+'">'+fmt(bal)+'</span>';
  }
  h+='</div>';

  // ===== 3. FINANCIAL RULES =====
  h+='<div class="adv-card green"><h3>📐 Κανόνες υγιούς οικονομίας</h3>';
  h+='<p>Πόσο καλά τα πας βάσει γνωστών κανόνων:</p>';

  const needsCats=['Τρόφιμα','Μεταφορά','Στέγαση','Λογαριασμοί','Υγεία','Δάνεια'];

  const fixedNeeds=D.fixedExpenses.filter(e=>needsCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);
  const fixedWants=D.fixedExpenses.filter(e=>!needsCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);
  const dailyNeeds=m.daily.filter(e=>needsCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);
  const dailyWants=m.daily.filter(e=>!needsCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);

  const aN=fixedNeeds+ccS+dailyNeeds;
  const aW=fixedWants+dailyWants;

  const housingCats=['Στέγαση'];
  const housing=D.fixedExpenses.filter(e=>housingCats.includes(e.category)).reduce((s,e)=>s+e.amount,0);
  const debtPayments=ccS+D.fixedExpenses.filter(e=>e.category==='Δάνεια').reduce((s,e)=>s+e.amount,0);
  const aS=D.income-aN-aW;

  const n50=D.income*0.50, w30=D.income*0.30, s20=D.income*0.20;
  h+=ruleCard('Κανόνας 50/30/20','Ανάγκες ≤50%, Επιθυμίες ≤30%, Αποταμίευση ≥20%',
    [
      {label:'Ανάγκες',actual:aN,target:n50,max:true},
      {label:'Επιθυμίες',actual:aW,target:w30,max:true},
      {label:'Αποταμίευση',actual:Math.max(0,aS),target:s20,max:false}
    ]);

  const totalSpent=aN+aW;
  const saved80=D.income-totalSpent;
  h+=ruleCard('Κανόνας 80/20','Ξόδεψε ≤80%, Αποταμίευσε ≥20%',
    [
      {label:'Έξοδα',actual:totalSpent,target:D.income*0.80,max:true},
      {label:'Αποταμίευση',actual:Math.max(0,saved80),target:D.income*0.20,max:false}
    ]);

  h+=ruleCard('Κανόνας 70/20/10','Βασικά ≤70%, Αποταμίευση ≥20%, Δάνεια/Δωρεές ≤10%',
    [
      {label:'Βασικά έξοδα',actual:aN-debtPayments,target:D.income*0.70,max:true},
      {label:'Αποταμίευση',actual:Math.max(0,aS),target:D.income*0.20,max:false},
      {label:'Δάνεια/Χρέη',actual:debtPayments,target:D.income*0.10,max:true}
    ]);

  h+=ruleCard('Κανόνας 28/36 (Στέγαση & Χρέη)','Στέγαση ≤28%, Σύνολο χρεών ≤36% εισοδήματος',
    [
      {label:'Στέγαση',actual:housing,target:D.income*0.28,max:true},
      {label:'Στέγαση + Χρέη',actual:housing+debtPayments,target:D.income*0.36,max:true}
    ]);

  const dti=D.income>0?debtPayments/D.income*100:0;
  const dtiStatus=dti<=15?'pass':dti<=36?'warn':'fail';
  const dtiLabel=dti<=15?'✅ Χαμηλό':dti<=36?'⚡ Μέτριο':'⚠️ Υψηλό';
  h+='<div class="rule-card"><div class="rule-head"><span class="rule-name">Debt-to-Income Ratio (DTI)</span><span class="rule-status '+dtiStatus+'">'+dtiLabel+'</span></div>';
  h+='<div class="rule-bar"><div class="rule-fill" style="width:'+Math.min(100,Math.round(dti/50*100))+'%;background:'+(dtiStatus==='pass'?'var(--teal)':dtiStatus==='warn'?'var(--amber)':'var(--red)')+'"></div></div>';
  h+='<div class="rule-detail">Δόσεις χρεών: <strong>'+fmt(debtPayments)+'</strong> = <strong>'+Math.round(dti)+'%</strong> του εισοδήματος. Ιδανικό: ≤15%. Αποδεκτό: ≤36%.</div></div>';

  h+='</div>';

  // ===== 4. HEALTH SCORE =====
  const healthScore = calcHealthScore(aN,aW,aS,housing,debtPayments);
  h+='<div class="adv-card" style="border-left-color:'+(healthScore.score>=70?'var(--teal)':healthScore.score>=40?'var(--amber)':'var(--red)')+'"><h3>🏥 Συνολική οικονομική υγεία</h3>';
  h+='<div class="score-gauge"><div class="score-circle '+healthScore.cls+'">'+healthScore.score+'</div><div class="score-info"><strong>'+healthScore.label+'</strong>'+healthScore.desc+'</div></div>';

  if(healthScore.tips.length>0){
    h+='<div style="margin-top:12px">';
    healthScore.tips.forEach(t=>{
      h+='<div class="tip '+(t.type||'purple')+'" style="margin-top:8px">'+t.text+'</div>';
    });
    h+='</div>';
  }
  h+='</div>';

  $('advContent').innerHTML=h;
}

// ===== RULE CARD GENERATOR =====
function ruleCard(name, desc, items){
  let allPass=true, anyFail=false;
  items.forEach(it=>{
    if(it.max && it.actual>it.target*1.1) anyFail=true;
    if(!it.max && it.actual<it.target*0.8) anyFail=true;
    if(it.max && it.actual>it.target) allPass=false;
    if(!it.max && it.actual<it.target) allPass=false;
  });
  const status=anyFail?'fail':allPass?'pass':'warn';
  const statusLabel=anyFail?'⚠️ Αποτυχία':allPass?'✅ Επιτυχία':'⚡ Μερική';

  let h='<div class="rule-card"><div class="rule-head"><span class="rule-name">'+name+'</span><span class="rule-status '+status+'">'+statusLabel+'</span></div>';
  h+='<div class="rule-detail" style="margin-bottom:8px">'+desc+'</div>';

  items.forEach(it=>{
    const pct=it.target>0?Math.min(150,Math.round(it.actual/it.target*100)):0;
    const barW=Math.min(100,pct);
    let barColor='var(--teal)';
    if(it.max){barColor=pct>110?'var(--red)':pct>100?'var(--amber)':'var(--teal)'}
    else{barColor=pct<80?'var(--red)':pct<100?'var(--amber)':'var(--teal)'}

    h+='<div style="margin-top:6px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3)"><span>'+it.label+'</span><span style="font-weight:600;color:'+(barColor)+'">'+fmt(it.actual)+' / '+fmt(it.target)+'</span></div>';
    h+='<div class="rule-bar"><div class="rule-fill" style="width:'+barW+'%;background:'+barColor+'"></div></div></div>';
  });

  h+='</div>';
  return h;
}

// ===== HEALTH SCORE =====
function calcHealthScore(needs,wants,savings,housing,debtPay){
  let score=50;
  const tips=[];

  const nPct=D.income>0?needs/D.income*100:0;
  const wPct=D.income>0?wants/D.income*100:0;
  const sPct=D.income>0?Math.max(0,savings)/D.income*100:0;

  if(nPct<=50) score+=8; else if(nPct>60){score-=10;tips.push({type:'red',text:'📊 Οι ανάγκες σου είναι '+Math.round(nPct)+'% — πολύ πάνω από το 50%. Δες αν μπορείς να μειώσεις πάγια ή τρόφιμα.'})}
  if(wPct<=30) score+=8; else if(wPct>40){score-=8;tips.push({type:'amber',text:'🎭 Οι επιθυμίες σου είναι '+Math.round(wPct)+'%. Μείωσε ψυχαγωγία/φαγητό έξω.'})}
  if(sPct>=20) score+=12; else if(sPct>=10) score+=5; else if(sPct<5){score-=10;tips.push({type:'red',text:'💰 Αποταμιεύεις μόνο '+Math.round(sPct)+'%. Στόχος: τουλάχιστον 20%.'})}

  const hPct=D.income>0?housing/D.income*100:0;
  if(hPct<=28) score+=5; else if(hPct>35){score-=8;tips.push({type:'amber',text:'🏠 Η στέγαση είναι '+Math.round(hPct)+'% — πάνω από 28%. Αν γίνεται, αναζήτα φθηνότερη στέγαση.'})}

  const dti=D.income>0?debtPay/D.income*100:0;
  if(dti<=15) score+=8;
  else if(dti>36){score-=15;tips.push({type:'red',text:'🏦 DTI '+Math.round(dti)+'% — πολύ υψηλό! Πρώτη προτεραιότητα η μείωση χρέους.'})}
  else if(dti>20){score-=5;tips.push({type:'amber',text:'🏦 DTI '+Math.round(dti)+'% — μέτριο. Προσπάθησε να το φέρεις κάτω από 20%.'})}

  if(dti===0 && (D.creditCards||[]).every(c=>c.balance<=0)){
    score+=10;tips.push({type:'green',text:'🎉 Μπράβο! Δεν έχεις χρέη — αυτό σε βάζει σε πολύ καλή θέση.'});
  }

  const bal=D.income-needs-wants;
  if(bal<0){score-=15;tips.push({type:'red',text:'⚠️ Ξοδεύεις περισσότερα από όσα βγάζεις! Χρειάζεται άμεση μείωση εξόδων.'})}

  if(sPct>=20 && tips.filter(t=>t.type==='green').length===0){
    tips.push({type:'green',text:'✅ Αποταμιεύεις '+Math.round(sPct)+'% — εντός στόχου! Σκέψου επένδυση για τα πλεονάσματα.'});
  }

  score=Math.max(0,Math.min(100,Math.round(score)));
  const cls=score>=70?'good':score>=40?'ok':'bad';
  const label=score>=85?'Εξαιρετική!':score>=70?'Καλή':score>=50?'Μέτρια':score>=30?'Χρειάζεται δουλειά':'Κρίσιμη';
  const desc=score>=70?'Τα οικονομικά σου είναι σε καλή κατάσταση.':score>=40?'Υπάρχουν σημεία βελτίωσης.':'Χρειάζονται σημαντικές αλλαγές.';

  return {score,cls,label,desc,tips};
}

// ===== BOOT (last script to load) =====
initApp();