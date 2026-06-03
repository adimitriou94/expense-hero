// ===== FINANCIAL ADVISOR MODULE =====
// Mobile-first financial coach redesign.
// Keeps the same data model and calculations, changes only presentation.

function rAdv(){
  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const af=fxS+ccS;
  const m=D.months[curM]||{daily:[]};
  const dailyRows=m.daily||[];
  const dlS=dailyTotal();
  const tot=af+dlS;
  const income=Number(D.income)||0;
  const bal=income-tot;
  const free=income-af;
  const[y,mo]=curM.split('-');

  const content=$('advContent');
  if(!content)return;

  if(income<=0){
    content.innerHTML=`
      <section class="advisor-empty-card">
        <div class="advisor-empty-icon">💡</div>
        <h3>Ξεκίνα με τα έσοδά σου</h3>
        <p>Πρόσθεσε πρώτα το μηνιαίο εισόδημα για να μπορέσω να υπολογίσω budget, κανόνες και προτάσεις.</p>
        <button type="button" onclick="go('vIncome',document.querySelector('[data-v=vIncome]'))">Προσθήκη εσόδου</button>
      </section>
    `;
    return;
  }

  const fPct=Math.round(af/income*100);
  const dPct=Math.round(dlS/income*100);
  const totalPct=Math.round(tot/income*100);

  const dim=new Date(parseInt(y),parseInt(mo),0).getDate();
  const today=new Date();
  const dom=curM===curMK()?today.getDate():dim;
  const remD=Math.max(0,dim-dom);
  const db=remD>0?(free-dlS)/remD:bal;

  const needsCats=['Τρόφιμα','Μεταφορά','Στέγαση','Λογαριασμοί','Υγεία','Δάνεια'];

  const fixedNeeds=(D.fixedExpenses||[])
    .filter(e=>needsCats.includes(e.category))
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const fixedWants=(D.fixedExpenses||[])
    .filter(e=>!needsCats.includes(e.category))
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const dailyNeeds=dailyRows
    .filter(e=>needsCats.includes(e.category))
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const dailyWants=dailyRows
    .filter(e=>!needsCats.includes(e.category))
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const aN=fixedNeeds+ccS+dailyNeeds;
  const aW=fixedWants+dailyWants;
  const aS=income-aN-aW;

  const housing=(D.fixedExpenses||[])
    .filter(e=>e.category==='Στέγαση')
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const debtPayments=ccS+(D.fixedExpenses||[])
    .filter(e=>e.category==='Δάνεια')
    .reduce((s,e)=>s+(Number(e.amount)||0),0);

  const totalSpent=aN+aW;
  const saved80=income-totalSpent;

  const healthScore=calcHealthScore(aN,aW,aS,housing,debtPayments);
  const healthTone=healthScore.score>=70?'good':healthScore.score>=40?'ok':'bad';

  const topCategory=advisorTopCategory(dailyRows);
  const suggestions=advisorBuildSuggestions({
    income,
    bal,
    free,
    af,
    fxS,
    ccS,
    dlS,
    db,
    remD,
    fPct,
    dPct,
    totalPct,
    aN,
    aW,
    aS,
    debtPayments,
    topCategory,
    healthScore
  });

  content.innerHTML=`
    <section class="advisor-coach-card advisor-tone-${healthTone}">
      <div class="advisor-score-ring">
        <span>${healthScore.score}</span>
        <small>/100</small>
      </div>

      <div class="advisor-coach-copy">
        <span class="advisor-kicker">Financial Health</span>
        <h3>${esc(healthScore.label)}</h3>
        <p>${esc(healthScore.desc)}</p>
      </div>
    </section>

    <section class="advisor-kpi-grid">
      <article class="advisor-kpi-card ${bal>=0?'is-green':'is-red'}">
        <div class="advisor-kpi-icon">${bal>=0?'✅':'⚠️'}</div>
        <span>Τελικό υπόλοιπο</span>
        <strong>${fmt(bal)}</strong>
        <small>${bal>=0?'μετά από όλα τα έξοδα':'χρειάζεται μείωση εξόδων'}</small>
      </article>

      <article class="advisor-kpi-card ${db>=0?'is-blue':'is-red'}">
        <div class="advisor-kpi-icon">💡</div>
        <span>Ημερήσιο budget</span>
        <strong>${fmt(Math.max(0,db))}</strong>
        <small>${remD>0?`${remD} ημέρες απομένουν`:'τέλος μήνα'}</small>
      </article>

      <article class="advisor-kpi-card ${fPct>60?'is-red':fPct>45?'is-amber':'is-green'}">
        <div class="advisor-kpi-icon">🏦</div>
        <span>Σταθερές υποχρεώσεις</span>
        <strong>${fPct}%</strong>
        <small>${fmt(af)} / μήνα</small>
      </article>

      <article class="advisor-kpi-card ${totalPct>100?'is-red':totalPct>85?'is-amber':'is-purple'}">
        <div class="advisor-kpi-icon">📉</div>
        <span>Χρήση εισοδήματος</span>
        <strong>${totalPct}%</strong>
        <small>${fmt(tot)} σύνολο εξόδων</small>
      </article>
    </section>

    <section class="advisor-card advisor-rule-main">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Budget Rule</span>
          <h3>Κανόνας 50 / 30 / 20</h3>
        </div>
        <span class="advisor-pill">${aS>=income*.20?'Εντός στόχου':'Θέλει βελτίωση'}</span>
      </div>

      <div class="advisor-rule-bars">
        ${advisorRuleBar('Ανάγκες',aN,income*.50,true)}
        ${advisorRuleBar('Επιθυμίες',aW,income*.30,true)}
        ${advisorRuleBar('Αποταμίευση',Math.max(0,aS),income*.20,false)}
      </div>
    </section>

    <section class="advisor-card advisor-insights-card">
      <div class="advisor-section-head">
        <div>
          <span class="advisor-kicker">Coach Notes</span>
          <h3>Έξυπνες παρατηρήσεις</h3>
        </div>
      </div>

      <div class="advisor-insight-list">
        ${suggestions.map(s=>`
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
          <span class="advisor-kicker">More Rules</span>
          <h3>Έλεγχος οικονομικής υγείας</h3>
        </div>
      </div>

      <div class="advisor-rule-mini-list advisor-rule-accordion-list">
        ${advisorDetailedRule('80 / 20','Έξοδα έως 80%, αποταμίευση 20%',[
          {label:'Έξοδα',actual:totalSpent,target:income*.80,max:true, note:'Στόχος να μένουν τα συνολικά έξοδα κάτω από το 80% του εισοδήματος.'},
          {label:'Αποταμίευση',actual:Math.max(0,saved80),target:income*.20,max:false, note:'Στόχος να μένει τουλάχιστον 20% για αποταμίευση.'}
        ])}
        ${advisorDetailedRule('70 / 20 / 10','Βασικά έξοδα, αποταμίευση και χρέη σε ισορροπία',[
          {label:'Βασικά έξοδα',actual:aN-debtPayments,target:income*.70,max:true, note:'Τα βασικά έξοδα καλό είναι να μην ξεπερνούν το 70%.'},
          {label:'Αποταμίευση',actual:Math.max(0,aS),target:income*.20,max:false, note:'Η αποταμίευση ιδανικά να είναι τουλάχιστον 20%.'},
          {label:'Δάνεια / Χρέη',actual:debtPayments,target:income*.10,max:true, note:'Τα χρέη ιδανικά να μένουν κάτω από το 10% σε αυτόν τον κανόνα.'}
        ])}
        ${advisorDetailedRule('28 / 36','Στέγαση και χρέη σε ασφαλή όρια',[
          {label:'Στέγαση',actual:housing,target:income*.28,max:true, note:'Η στέγαση προτείνεται να μένει έως 28% του εισοδήματος.'},
          {label:'Στέγαση + Χρέη',actual:housing+debtPayments,target:income*.36,max:true, note:'Στέγαση μαζί με χρέη προτείνεται να μένουν έως 36%.'}
        ])}
        ${advisorDetailedRule('DTI','Δόσεις χρεών προς εισόδημα',[
          {label:'Δόσεις χρεών',actual:debtPayments,target:income*.36,max:true, note:'Αποδεκτό όριο έως 36%. Ιδανικά αρκετά χαμηλότερα, κοντά στο 15%.'}
        ])}
      </div>
    </section>

    <section class="advisor-action-card">
      <div class="advisor-action-icon">✨</div>
      <div>
        <h3>Επόμενο καλύτερο βήμα</h3>
        <p>${esc(advisorBestNextStep({bal,db,fPct,dPct,debtPayments,income,topCategory}))}</p>
      </div>
    </section>
  `;
}

// ===== ADVISOR HELPERS =====

function advisorTopCategory(rows){
  const totals={};

  (rows||[]).forEach(e=>{
    const cat=e.category||'Άλλο';
    totals[cat]=(totals[cat]||0)+(Number(e.amount)||0);
  });

  const sorted=Object.entries(totals)
    .map(([category,total])=>({category,total}))
    .sort((a,b)=>b.total-a.total);

  return sorted[0]||{category:'—',total:0};
}

function advisorRuleBar(label,actual,target,max=true){
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
    if(actual>target){
      return `${it.label} ξεπερνά το προτεινόμενο όριο κατά ${fmt(diff)}.`;
    }
    return `${it.label} είναι ${fmt(target-actual)} κάτω από το όριο.`;
  }

  if(actual<target){
    return `${it.label} υπολείπεται του στόχου κατά ${fmt(diff)}.`;
  }

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

function advisorMiniRule(name,desc,actual,target,max=true){
  return advisorDetailedRule(name,desc,[{label:name,actual,target,max}]);
}

function advisorBuildSuggestions(ctx){
  const list=[];

  if(ctx.bal<0){
    list.push({
      type:'danger',
      icon:'🚫',
      title:'Έχεις αρνητικό υπόλοιπο',
      text:`Χρειάζεται να μειώσεις έξοδα κατά ${fmt(Math.abs(ctx.bal))} για να κλείσει σωστά ο μήνας.`
    });
  }else{
    list.push({
      type:'success',
      icon:'✅',
      title:'Κλείνεις τον μήνα θετικά',
      text:`Αν δεν αλλάξει κάτι, μένουν περίπου ${fmt(ctx.bal)} μετά από όλα τα έξοδα.`
    });
  }

  if(ctx.db<15 && ctx.remD>0){
    list.push({
      type:'warning',
      icon:'⚡',
      title:'Χαμηλό ημερήσιο budget',
      text:`Για τις επόμενες ${ctx.remD} ημέρες έχεις περίπου ${fmt(Math.max(0,ctx.db))} ανά ημέρα.`
    });
  }else if(ctx.remD>0){
    list.push({
      type:'info',
      icon:'💡',
      title:'Καθαρό ημερήσιο όριο',
      text:`Μπορείς να κινείσαι κοντά στα ${fmt(Math.max(0,ctx.db))} ανά ημέρα μέχρι το τέλος του μήνα.`
    });
  }

  if(ctx.fPct>55){
    list.push({
      type:'warning',
      icon:'🏦',
      title:'Υψηλές σταθερές υποχρεώσεις',
      text:`Πάγια και δόσεις είναι ${ctx.fPct}% του εισοδήματος. Ιδανικά θέλουμε χαμηλότερα.`
    });
  }

  if(ctx.topCategory.total>0){
    list.push({
      type:'info',
      icon:'👑',
      title:'Μεγαλύτερη κατηγορία',
      text:`Η μεγαλύτερη κατηγορία ημερήσιων εξόδων είναι ${ctx.topCategory.category} με ${fmt(ctx.topCategory.total)}.`
    });
  }

  if(ctx.healthScore.tips && ctx.healthScore.tips.length>0){
    ctx.healthScore.tips.slice(0,2).forEach(t=>{
      list.push({
        type:t.type==='red'?'danger':t.type==='amber'?'warning':t.type==='green'?'success':'info',
        icon:t.type==='red'?'⚠️':t.type==='amber'?'⚡':t.type==='green'?'✅':'✨',
        title:'Πρόταση βελτίωσης',
        text:String(t.text||'').replace(/^[^\s]+\s/,'')
      });
    });
  }

  return list.slice(0,4);
}

function advisorBestNextStep(ctx){
  if(ctx.bal<0){
    return `Μείωσε άμεσα έξοδα κατά ${fmt(Math.abs(ctx.bal))}, ξεκινώντας από τη μεγαλύτερη μεταβλητή κατηγορία.`;
  }

  if(ctx.db<15 && ctx.remD>0){
    return 'Κράτα τις επόμενες ημέρες πολύ συντηρητικά και απέφυγε μη απαραίτητα έξοδα μέχρι να κλείσει ο μήνας.';
  }

  if(ctx.fPct>55){
    return 'Έλεγξε πάγια και δόσεις. Εκεί βρίσκεται το μεγαλύτερο περιθώριο βελτίωσης.';
  }

  if(ctx.debtPayments>ctx.income*.20){
    return 'Δώσε προτεραιότητα στη μείωση χρέους ή στην καλύτερη κατανομή δόσεων.';
  }

  return 'Κράτα το τρέχον πλάνο και βάλε στόχο να μεταφέρεις μέρος του θετικού υπολοίπου σε αποταμίευση.';
}

// ===== LEGACY RULE CARD GENERATOR =====
// Kept for compatibility in case another part calls it.
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
  const label=score>=85?'Εξαιρετική εικόνα':score>=70?'Καλή εικόνα':score>=50?'Μέτρια εικόνα':score>=30?'Θέλει προσοχή':'Κρίσιμη εικόνα';
  const desc=score>=70?'Τα βασικά οικονομικά σου είναι σε καλή κατάσταση.':score>=40?'Υπάρχουν σημεία που μπορείς να βελτιώσεις.':'Χρειάζονται σημαντικές αλλαγές στο πλάνο σου.';

  return {score,cls,label,desc,tips};
}

// ===== BOOT (last script to load) =====
initApp();
