// CAPVO app split: 04-reports-archive.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== STATS / ARCHIVE =====
function reportsPreviousMonthKey(monthKey){
  const [y,m]=String(monthKey||curMK()).split('-').map(Number);
  const d=new Date(y,(m||1)-2,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

function reportsMonthDailyTotal(monthKey){
  const month=D.months?.[monthKey]||{daily:[]};
  return (month.daily||[]).reduce((s,e)=>s+(Number(e.amount)||0),0);
}

function reportsAllMonthlyItems(monthKey){
  const month=D.months?.[monthKey]||{daily:[]};

  const fixed=(D.fixedExpenses||[]).map(e=>({
    name:e.name||'Πάγιο',
    category:e.category||'Άλλο',
    amount:Number(e.amount)||0,
    type:'fixed',
    date:''
  }));

  const cards=(D.creditCards||[])
    .filter(c=>Number(c.balance)>0)
    .map(c=>({
      name:c.name||'Πιστωτική',
      category:'Πιστωτικές',
      amount:effectiveCardPayment(c),
      type:'card',
      date:''
    }));

  const daily=(month.daily||[]).map(e=>({
    name:e.name||'Κίνηση',
    category:e.category||'Άλλο',
    amount:Number(e.amount)||0,
    type:'daily',
    date:e.date||'',
    paymentSourceName:e.paymentSourceName||''
  }));

  return [...fixed,...cards,...daily].filter(e=>e.amount>0);
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

  const sorted=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const topCategory=sorted[0]||['—',0];
  const topPct=total>0?Math.round(topCategory[1]/total*100):0;

  const largest=items
    .filter(e=>e.type!=='card')
    .sort((a,b)=>b.amount-a.amount)[0] || items.sort((a,b)=>b.amount-a.amount)[0];

  const [y,mo]=curM.split('-').map(Number);
  const dim=new Date(y,mo,0).getDate();
  const today=new Date();
  const elapsed=curM===curMK()?Math.max(1,Math.min(today.getDate(),dim)):dim;
  const avg=total/elapsed;

  const prevKey=reportsPreviousMonthKey(curM);
  const prevTotal=reportsAllMonthlyItems(prevKey).reduce((s,e)=>s+e.amount,0);
  const prevAvg=prevTotal>0?prevTotal/new Date(Number(prevKey.split('-')[0]),Number(prevKey.split('-')[1]),0).getDate():0;

  if($('reportsTotal'))$('reportsTotal').textContent=fmt(total);
  if($('reportsTotalDelta'))$('reportsTotalDelta').textContent=reportsPctDelta(total,prevTotal)||'τρέχων μήνας';
  if($('reportsAvgDay'))$('reportsAvgDay').textContent=fmt(avg);
  if($('reportsAvgDelta'))$('reportsAvgDelta').textContent=reportsPctDelta(avg,prevAvg)||`${elapsed} ημέρες`;
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
  if(prevTotal>0){
    const diff=total-prevTotal;
    const pct=Math.round(Math.abs(diff)/prevTotal*100);
    insights.push({
      icon:diff<=0?'↘':'↗',
      tone:diff<=0?'green':'red',
      text:diff<=0
        ? `Ξόδεψες <strong>${pct}% λιγότερα</strong> από τον προηγούμενο μήνα.`
        : `Ξόδεψες <strong>${pct}% περισσότερα</strong> από τον προηγούμενο μήνα.`
    });
  }else{
    insights.push({
      icon:'📌',
      tone:'blue',
      text:'Συνέχισε την καταχώρηση για να εμφανιστεί σύγκριση με προηγούμενο μήνα.'
    });
  }

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

  const month=D.months[curM]||{daily:[]};
  const days=[];
  for(let i=dim;i>=Math.max(1,dim-13);i--){
    const k=curM+'-'+String(i).padStart(2,'0');
    days.unshift({label:i+'/'+mo,total:(month.daily||[]).filter(e=>e.date===k).reduce((s,e)=>s+(Number(e.amount)||0),0)});
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
    subtitle.textContent=total>0?`${count} κατηγορίες · ${fmt(total)} συνολικά`:'Δεν υπάρχουν δεδομένα για τον μήνα';
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
  const month=D.months[curM]||{daily:[]};
  const daily=month.daily||[];
  const [y,mo]=curM.split('-').map(Number);
  const dim=new Date(y,mo,0).getDate();
  const today=new Date();
  const elapsed=curM===curMK()?Math.max(1,Math.min(today.getDate(),dim)):dim;
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
    {icon:'📅',label:'Μέση ημερήσια δαπάνη',value:fmt(avg),meta:`Υπολογισμός σε ${elapsed} ημέρες`},
    {icon:'🔥',label:'Ημέρα με τα περισσότερα έξοδα',value:topDay?fmt(topDay[1]):'—',meta:topDay?reportsShortDate(topDay[0]):'Δεν υπάρχουν ημερήσιες κινήσεις'},
    {icon:'💳',label:'Πιο συχνή πηγή πληρωμής',value:topPay?esc(topPay[0]):'—',meta:topPay?fmt(topPay[1]):'Δεν υπάρχουν πηγές πληρωμής'},
    {icon:'↗',label:'Μεγαλύτερη συναλλαγή',value:fmt(largest?.amount||0),meta:largest?`${esc(largest.name)} · ${reportsShortDate(largest.date)}`:'—'},
    {icon:'👑',label:'Top κατηγορία',value:topCategory?esc(topCategory[0]):'—',meta:topCategory&&total>0?`${Math.round(topCategory[1]/total*100)}% του μήνα`:'—'},
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


let archiveExpandedMonth = '';

function archiveMonthName(k){
  const [y,mo]=String(k).split('-');
  return (MG[(parseInt(mo)||1)-1]||mo)+' '+y;
}

function archivePrevKey(k){
  const [y,mo]=String(k).split('-').map(Number);
  const d=new Date(y,(mo||1)-2,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}

function archiveMonthSnapshot(k){
  const m=D.months[k]||{daily:[]};
  const dailyRows=m.daily||[];
  const daily=dailyRows.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const fixed=fixedTotal();
  const cards=ccPayTotal();
  const total=fixed+cards+daily;
  const income=Number(D.income)||0;
  const balance=income-total;
  return {key:k,dailyRows,daily,fixed,cards,total,income,balance};
}

function archiveBestWorst(keys){
  const rows=keys.map(k=>archiveMonthSnapshot(k));
  const best=[...rows].sort((a,b)=>b.balance-a.balance)[0];
  const worst=[...rows].sort((a,b)=>a.balance-b.balance)[0];
  const avg=rows.length?rows.reduce((s,x)=>s+x.balance,0)/rows.length:0;
  return {best,worst,avg};
}

function archiveTopCategories(rows,limit=5){
  const map={};
  (rows||[]).forEach(e=>{
    const cat=e.category||'Άλλο';
    map[cat]=(map[cat]||0)+(Number(e.amount)||0);
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

function archiveExpandedHtml(snap){
  const cats=archiveTopCategories(snap.dailyRows,6);
  const prevKey=archivePrevKey(snap.key);
  const prev=D.months[prevKey]?archiveMonthSnapshot(prevKey):null;

  return `
    <div class="archive-expanded">
      <div class="archive-expanded-title">Ανάλυση μήνα</div>

      <div class="archive-breakdown-grid">
        ${cats.length?cats.map(c=>`
          <div class="archive-cat-row">
            <span><i style="background:${c.color}"></i>${esc(c.name)}</span>
            <strong>${fmt(c.amount)}</strong>
          </div>
        `).join(''):'<div class="archive-empty-mini">Δεν υπάρχουν ημερήσιες κινήσεις.</div>'}
      </div>

      <div class="archive-month-totals">
        <div><span>Πάγια</span><strong>${fmt(snap.fixed)}</strong></div>
        <div><span>Κάρτες</span><strong>${fmt(snap.cards)}</strong></div>
        <div><span>Ημερήσια</span><strong>${fmt(snap.daily)}</strong></div>
      </div>

      ${prev?`
        <div class="archive-compare-box">
          <div class="archive-expanded-title">Σύγκριση με ${archiveMonthName(prevKey)}</div>
          <div class="archive-compare-grid">
            ${archiveDiffLine('Έξοδα',snap.total,prev.total,true)}
            ${archiveDiffLine('Υπόλοιπο',snap.balance,prev.balance,false)}
            ${archiveDiffLine('Ημερήσια',snap.daily,prev.daily,true)}
          </div>
        </div>
      `:'<div class="archive-empty-mini">Δεν υπάρχει προηγούμενος μήνας για σύγκριση.</div>'}
    </div>`;
}

function toggleArchiveMonth(k){
  archiveExpandedMonth = archiveExpandedMonth===k ? '' : k;
  rArch();

  if(archiveExpandedMonth){
    requestAnimationFrame(()=>{
      const el=document.querySelector(`[data-archive-month="${archiveExpandedMonth}"]`);
      if(el){
        el.scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    });
  }
}

function rArch(){
  const keys=Object.keys(D.months||{}).sort().reverse();
  const list=$('archList');
  if(!list)return;

  if(keys.length===0){
    list.innerHTML=`
      <section class="archive-empty-card">
        <div class="archive-empty-icon">🗓️</div>
        <h3>Δεν υπάρχει ιστορικό ακόμα</h3>
        <p>Μόλις καταχωρήσεις κινήσεις, οι μήνες θα εμφανιστούν εδώ.</p>
      </section>`;
    return;
  }

  const meta=archiveBestWorst(keys);
  const recent=keys.slice(0,6).reverse().map(k=>archiveMonthSnapshot(k));
  const maxAbs=Math.max(1,...recent.map(x=>Math.abs(x.balance)));

  const summaryHtml=`
    <section class="archive-summary-grid">
      <article class="archive-summary-card">
        <div class="archive-summary-icon">🗓️</div>
        <span>Μήνες ιστορικού</span>
        <strong>${keys.length}</strong>
      </article>
      <article class="archive-summary-card is-green">
        <div class="archive-summary-icon">🏆</div>
        <span>Καλύτερος μήνας</span>
        <strong>${archiveMonthName(meta.best.key)}</strong>
        <small>${fmt(meta.best.balance)}</small>
      </article>
      <article class="archive-summary-card is-red">
        <div class="archive-summary-icon">📉</div>
        <span>Χειρότερος μήνας</span>
        <strong>${archiveMonthName(meta.worst.key)}</strong>
        <small>${fmt(meta.worst.balance)}</small>
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
          <h3>Τελευταίοι ${recent.length} μήνες</h3>
        </div>
      </div>
      <div class="archive-mini-bars">
        ${recent.map(x=>{
          const h=Math.max(12,Math.round(Math.abs(x.balance)/maxAbs*58));
          const positive=x.balance>=0;
          const label=archiveMonthName(x.key).split(' ')[0].slice(0,3);
          return `<div class="archive-mini-bar ${positive?'good':'bad'}"><i style="height:${h}px"></i><span>${label}</span></div>`;
        }).join('')}
      </div>
    </section>`;

  const cards=keys.map(k=>{
    const snap=archiveMonthSnapshot(k);
    const active=k===curM;
    const open=archiveExpandedMonth===k;
    return `
      <article class="archive-month-card ${active?'is-current':''} ${open?'is-open':''}" data-archive-month="${k}">
        <button type="button" class="archive-month-main" onclick="toggleArchiveMonth('${k}')">
          <div class="archive-month-left">
            <strong>${archiveMonthName(k)}</strong>
            <span>${active?'Τρέχων μήνας':'Ιστορικός μήνας'}</span>
          </div>
          <div class="archive-month-right">
            <strong class="${snap.balance>=0?'is-positive':'is-negative'}">${fmt(snap.balance)}</strong>
            <span>Έξοδα ${fmt(snap.total)}</span>
          </div>
          <div class="archive-chevron">⌄</div>
        </button>

        <div class="archive-mini-stats">
          <div><span>Έσοδα</span><strong>${fmt(snap.income)}</strong></div>
          <div><span>Ημερήσια</span><strong>${fmt(snap.daily)}</strong></div>
          <div><span>Σύνολο</span><strong>${fmt(snap.total)}</strong></div>
        </div>

        ${open?archiveExpandedHtml(snap):''}
      </article>`;
  }).join('');

  list.innerHTML=`
    <div class="archive-page-content">
      ${summaryHtml}
      <section class="archive-timeline-list">
        <div class="archive-section-head">
          <div>
            <span>History</span>
            <h3>Μηνιαίο αρχείο</h3>
          </div>
        </div>
        ${cards}
      </section>
    </div>`;
}
