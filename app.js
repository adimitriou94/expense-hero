// ===== SUPABASE & CONFIG =====
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== CONSTANTS & STATE =====
const SK = 'current_chat_id';

const MG = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
const DG = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];

const CCLR = {
  'Τρόφιμα':'#e6960a','Καφέδες':'#8b6914','Μεταφορά':'#2471a3','Ψυχαγωγία':'#7d3c98',
  'Φαγητό έξω':'#c0392b','Στέγαση':'#1d9e75','Λογαριασμοί':'#d4a012','Υγεία':'#148f77',
  'Ρούχα':'#993556','Συνδρομές':'#3f51b5','Δάνεια':'#34495e','Πιστωτικές':'#2471a3','Άλλο':'#888780'
};

const CCLS = {
  'Τρόφιμα':'cat-food','Καφέδες':'cat-coffee','Μεταφορά':'cat-transport','Ψυχαγωγία':'cat-entertainment',
  'Φαγητό έξω':'cat-eating','Στέγαση':'cat-housing','Λογαριασμοί':'cat-bills','Υγεία':'cat-health',
  'Ρούχα':'cat-clothes','Συνδρομές':'cat-sub','Δάνεια':'cat-loans','Πιστωτικές':'cat-cc','Άλλο':'cat-other'
};

const CEMO = {
  'Τρόφιμα':'🛒','Καφέδες':'☕','Μεταφορά':'🚗','Ψυχαγωγία':'🎭','Φαγητό έξω':'🍕','Στέγαση':'🏠',
  'Λογαριασμοί':'💡','Υγεία':'🏥','Ρούχα':'👕','Συνδρομές':'📱','Δάνεια':'🏦','Πιστωτικές':'💳','Άλλο':'📌'
};

let D = { income:0, fixedExpenses:[], creditCards:[], months:{} };
let curM;

let selectionMode = { fixed:false, daily:false };
let selectedFixed = new Set();
let selectedDaily = new Set();

// ===== HELPERS =====
function curMK(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function ensM(k){if(!D.months[k])D.months[k]={daily:[]}}
function gid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,5)}
function fmt(n){n=Number(n)||0;return '€'+n.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function esc(s){const d=document.createElement('div');d.textContent=s??'';return d.innerHTML}
function $(id){return document.getElementById(id)}
function ccPayTotal(){return(D.creditCards||[]).filter(c=>c.balance>0).reduce((s,c)=>s+(c.chosenPay||c.minPay||0),0)}
function fixedTotal(){return(D.fixedExpenses||[]).reduce((s,e)=>s+(Number(e.amount)||0),0)}
function dailyTotal(){return((D.months[curM]||{daily:[]}).daily).reduce((s,e)=>s+(Number(e.amount)||0),0)}
function allFixedTotal(){return fixedTotal()+ccPayTotal()}
function save(){return saveToSupabase()}

function copyTelegramCommand(){
  navigator.clipboard.writeText('/id')
    .then(()=>alert('Η εντολή /id αντιγράφηκε. Άνοιξε το Telegram bot και κάνε επικόλληση.'))
    .catch(()=>alert('Δεν έγινε αντιγραφή. Γράψε χειροκίνητα /id στο Telegram bot.'));
}

// ===== BULK SELECT / DELETE =====
function toggleSelectMode(type){
  selectionMode[type]=!selectionMode[type];
  if(type==='fixed') selectedFixed.clear();
  if(type==='daily') selectedDaily.clear();
  render();
}

function toggleSelectExpense(type,id,checked){
  const set=type==='fixed'?selectedFixed:selectedDaily;
  if(checked) set.add(id);
  else set.delete(id);
  render();
}

function selectAllVisible(type){
  if(type==='fixed'){
    D.fixedExpenses.forEach(e=>selectedFixed.add(e.id));
  }

  if(type==='daily'){
    const m=D.months[curM]||{daily:[]};
    m.daily.forEach(e=>selectedDaily.add(e.id));
  }

  render();
}

function clearSelected(type){
  if(type==='fixed') selectedFixed.clear();
  if(type==='daily') selectedDaily.clear();
  render();
}

function bulkDelete(type){
  const set=type==='fixed'?selectedFixed:selectedDaily;

  if(set.size===0){
    alert('Δεν έχεις επιλέξει εγγραφές.');
    return;
  }

  if(!confirm(`Διαγραφή ${set.size} εγγραφών;`)) return;

  if(type==='fixed'){
    D.fixedExpenses=D.fixedExpenses.filter(e=>!set.has(e.id));
    selectedFixed.clear();
    selectionMode.fixed=false;
  }

  if(type==='daily'){
    ensM(curM);
    D.months[curM].daily=D.months[curM].daily.filter(e=>!set.has(e.id));
    selectedDaily.clear();
    selectionMode.daily=false;
  }

  saveToSupabase();
  render();
}

// ===== SUPABASE DATA OPERATIONS =====
async function fetchAllData(userId){
  try{
    let {data:user,error:errUser}=await supabaseClient.from('users').select('income').eq('chat_id',userId).single();

    if(errUser&&errUser.code==='PGRST116'){
      await supabaseClient.from('users').upsert({chat_id:userId,income:0},{onConflict:'chat_id'});
      user={income:0};
    }else if(errUser){
      throw errUser;
    }

    D.income=user.income||0;

    const {data:fixed,error:errFixed}=await supabaseClient.from('fixed_expenses').select('id,name,amount,category').eq('user_chat_id',userId);
    if(errFixed) throw errFixed;
    D.fixedExpenses=fixed||[];

    const {data:cards,error:errCards}=await supabaseClient.from('credit_cards').select('*').eq('user_chat_id',userId);
    if(errCards) throw errCards;

    D.creditCards=(cards||[]).map(c=>({
      id:c.id,
      name:c.name,
      balance:c.balance||0,
      rate:c.rate||0,
      minPay:c.min_pay||0,
      limit:c.limit_amount||0,
      chosenPay:c.chosen_pay||0
    }));

    const {data:daily,error:errDaily}=await supabaseClient.from('expenses').select('*').eq('user_chat_id',userId);
    if(errDaily) throw errDaily;

    D.months={};

    (daily||[]).forEach(e=>{
      const mk=e.month_key||(e.date?e.date.substring(0,7):curMK());
      if(!D.months[mk]) D.months[mk]={daily:[]};
      D.months[mk].daily.push({id:e.id,name:e.name,amount:e.amount,category:e.category,date:e.date});
    });

  }catch(e){
    console.error('Fetch error:',e);
    throw e;
  }
}

async function saveToSupabase(){
  const userId=localStorage.getItem(SK);
  if(!userId) return;

  try{
    await supabaseClient.from('users').upsert({chat_id:userId,income:D.income},{onConflict:'chat_id'});

    if(D.fixedExpenses.length>0){
      await supabaseClient.from('fixed_expenses').upsert(
        D.fixedExpenses.map(e=>({id:e.id,name:e.name,amount:e.amount,category:e.category,user_chat_id:userId})),
        {onConflict:'id'}
      );
    }

    const {data:dbFixed}=await supabaseClient.from('fixed_expenses').select('id').eq('user_chat_id',userId);
    const fixedIds=new Set(D.fixedExpenses.map(e=>e.id));
    const fixedToDelete=(dbFixed||[]).filter(e=>!fixedIds.has(e.id)).map(e=>e.id);
    if(fixedToDelete.length>0) await supabaseClient.from('fixed_expenses').delete().in('id',fixedToDelete);

    if(D.creditCards.length>0){
      await supabaseClient.from('credit_cards').upsert(
        D.creditCards.map(c=>({
          id:c.id,name:c.name,balance:c.balance,rate:c.rate,
          min_pay:c.minPay,limit_amount:c.limit,chosen_pay:c.chosenPay,user_chat_id:userId
        })),
        {onConflict:'id'}
      );
    }

    const {data:dbCards}=await supabaseClient.from('credit_cards').select('id').eq('user_chat_id',userId);
    const cardIds=new Set(D.creditCards.map(c=>c.id));
    const cardsToDelete=(dbCards||[]).filter(c=>!cardIds.has(c.id)).map(c=>c.id);
    if(cardsToDelete.length>0) await supabaseClient.from('credit_cards').delete().in('id',cardsToDelete);

    const {data:dbExpenses}=await supabaseClient.from('expenses').select('id').eq('user_chat_id',userId);
    const dbIds=new Set((dbExpenses||[]).map(e=>e.id));
    const appIds=new Set();

    Object.values(D.months).forEach(m=>m.daily.forEach(e=>appIds.add(e.id)));

    const toDelete=[...dbIds].filter(id=>!appIds.has(id));
    if(toDelete.length>0) await supabaseClient.from('expenses').delete().in('id',toDelete);

    const allDaily=[];

    Object.entries(D.months).forEach(([monthKey,m])=>{
      m.daily.forEach(e=>{
        allDaily.push({
          id:e.id,name:e.name,amount:e.amount,category:e.category,date:e.date,
          type:'daily',month_key:monthKey,user_chat_id:userId
        });
      });
    });

    if(allDaily.length>0){
      await supabaseClient.from('expenses').upsert(allDaily,{onConflict:'id'});
    }

  }catch(e){
    console.error('Save error:',e);
    alert('Σφάλμα αποθήκευσης: '+e.message);
  }
}

// ===== MAIN RENDER =====
function render(){
  const fxS=fixedTotal(),ccS=ccPayTotal(),dlS=dailyTotal();
  const tot=fxS+ccS+dlS,bal=D.income-tot;
  const pct=D.income>0?Math.min(100,Math.round(tot/D.income*100)):0;
  const[y,mo]=curM.split('-');

  $('mLabel').textContent=MG[parseInt(mo)-1]+' '+y;
  $('dIncome').textContent=fmt(D.income);
  $('dBalance').textContent=fmt(bal);
  $('dBalance').style.color=bal<0?'#fca5a5':'#ffffff';
  $('dBar').style.width=pct+'%';
  $('dPct').textContent=pct+'%';
  $('dSpent').textContent=fmt(tot)+' / '+fmt(D.income);

  $('sFixed').textContent=fmt(fxS);
  $('sCC').textContent=fmt(ccS);
  $('sDaily').textContent=fmt(dlS);
  $('sRemain').textContent=fmt(bal);
  $('sRemain').className='stat-value '+(bal>=0?'teal':'red');

  renderFixedList();
  renderDailyList();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof rAdv==='function') rAdv();
}

function renderFixedList(){
  const ccCards=(D.creditCards||[]).filter(c=>c.balance>0);
  const count=D.fixedExpenses.length+ccCards.length;

  $('cFixed').innerHTML=`
    ${count} εγγραφές
    <button class="mini-action" onclick="toggleSelectMode('fixed')">${selectionMode.fixed?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.fixed?`
      <button class="mini-action" onclick="selectAllVisible('fixed')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('fixed')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('fixed')">Διαγραφή</button>
    `:''}
  `;

  let html='';

  if(count===0){
    html=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        Βάλε τα πάγια μία φορά — ισχύουν παντού.
      </div>`;
  }else{
    html=D.fixedExpenses.map(e=>eRow(e,'fixed')).join('');

    ccCards.forEach(c=>{
      const pay=c.chosenPay||c.minPay||0;
      html+=`
        <div class="expense-item fadeIn">
          <div class="expense-icon cat-cc">💳</div>
          <div class="expense-info">
            <div class="expense-name">${esc(c.name)} <span class="auto-badge">από Κάρτες</span></div>
            <div class="expense-cat">Δόση πιστωτικής · Χρέος: ${fmt(c.balance)}</div>
          </div>
          <div class="expense-amount" style="color:var(--blue)">${fmt(pay)}</div>
          <button class="cc-link-btn" onclick="go('vCards',document.querySelector('[data-v=vCards]'))" title="Επεξεργασία">✎</button>
        </div>`;
    });
  }

  $('lFixed').innerHTML=html;
}

function renderDailyList(){
  const m=D.months[curM]||{daily:[]};

  $('cDaily').innerHTML=`
    ${m.daily.length} εγγραφές
    <button class="mini-action" onclick="toggleSelectMode('daily')">${selectionMode.daily?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.daily?`
      <button class="mini-action" onclick="selectAllVisible('daily')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('daily')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('daily')">Διαγραφή</button>
    `:''}
  `;

  if(m.daily.length===0){
    $('lDaily').innerHTML=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Κανένα ημερήσιο έξοδο ακόμα
      </div>`;
    return;
  }

  const grouped={};

  [...m.daily].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).forEach(e=>{
    if(!grouped[e.date]) grouped[e.date]=[];
    grouped[e.date].push(e);
  });

  let html='';

  Object.keys(grouped).sort().reverse().forEach(dt=>{
    const d=new Date(dt+'T12:00:00');
    const dayTotal=grouped[dt].reduce((s,e)=>s+e.amount,0);

    html+=`
      <div class="day-header">
        <span>${DG[d.getDay()]}, ${d.getDate()} ${MG[d.getMonth()]}</span>
        <span class="day-total">${fmt(dayTotal)}</span>
      </div>`;

    grouped[dt].forEach(e=>html+=eRow(e,'daily'));
  });

  $('lDaily').innerHTML=html;
}

function eRow(e,t){
  const c=CCLS[e.category]||'cat-other';
  const em=CEMO[e.category]||'📌';
  const cl=t==='fixed'?'color:var(--red)':'color:var(--amber-dark)';
  const isSelected=t==='fixed'?selectedFixed.has(e.id):selectedDaily.has(e.id);
  const showSelect=selectionMode[t];

  return `
    <div class="expense-item fadeIn ${isSelected?'selected-row':''}">
      ${showSelect?`
        <label class="select-box">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('${t}','${e.id}',this.checked)">
        </label>`:''}

      <div class="expense-icon ${c}">${em}</div>

      <div class="expense-info">
        <div class="expense-name">${esc(e.name)}</div>
        <div class="expense-cat">${esc(e.category)}</div>
      </div>

      <div class="expense-amount" style="${cl}">${fmt(e.amount)}</div>

      ${!showSelect?`
        <div class="expense-actions">
          <button class="edit-btn" onclick="editExp('${t}','${e.id}')" title="Επεξεργασία">✎</button>
          <button class="del-btn" onclick="delExp('${t}','${e.id}')" title="Διαγραφή">×</button>
        </div>`:''}
    </div>`;
}

// ===== STATS / ARCHIVE =====
function rStats(){
  const m=D.months[curM]||{daily:[]};
  const ccCards=(D.creditCards||[]).filter(c=>c.balance>0).map(c=>({category:'Πιστωτικές',amount:c.chosenPay||c.minPay||0}));
  const all=[...D.fixedExpenses,...ccCards,...m.daily];
  const byCategory={};

  all.forEach(e=>byCategory[e.category]=(byCategory[e.category]||0)+e.amount);

  const sorted=Object.entries(byCategory).sort((a,b)=>b[1]-a[1]);
  const max=sorted.length>0?sorted[0][1]:1;

  const catTotal=sorted.reduce((s,[_,total])=>s+total,0);

  if(sorted.length===0 || catTotal<=0){
    $('chartCatDonut').style.background='#eef2f7';
    $('chartCat').innerHTML='<p style="text-align:center;color:var(--text3);padding:20px">—</p>';
    $('chartCatTotal').textContent=fmt(0);
  }else{
    let start=0;
  
    const gradientParts=sorted.map(([cat,total])=>{
      const pct=total/catTotal*100;
      const end=start+pct;
      const color=CCLR[cat]||'#888';
      const part=`${color} ${start}% ${end}%`;
      start=end;
      return part;
    });
  
    $('chartCatDonut').style.background=`conic-gradient(${gradientParts.join(',')})`;
    $('chartCatTotal').textContent=fmt(catTotal);
  
    $('chartCat').innerHTML=sorted.map(([cat,total])=>{
      const pct=Math.round(total/catTotal*100);
      const color=CCLR[cat]||'#888';
  
      return`
        <div class="donut-legend-row">
          <div class="donut-legend-left">
            <span class="donut-dot" style="background:${color}"></span>
            <span>${esc(cat)}</span>
          </div>
  
          <div class="donut-legend-right">
            <strong>${fmt(total)}</strong>
            <small>${pct}%</small>
          </div>
        </div>`;
    }).join('');
  }

  const[y,mo]=curM.split('-');
  const dim=new Date(parseInt(y),parseInt(mo),0).getDate();
  const days=[];

  for(let i=dim;i>=Math.max(1,dim-13);i--){
    const k=curM+'-'+String(i).padStart(2,'0');
    days.unshift({label:i+'/'+parseInt(mo),total:m.daily.filter(e=>e.date===k).reduce((s,e)=>s+e.amount,0)});
  }

  const dayMax=Math.max(...days.map(d=>d.total),1);

  $('chartDay').innerHTML=days.map(d=>`
    <div class="bar-row">
      <div class="bar-label">${d.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.total/dayMax*100)}%;background:var(--amber)"></div></div>
      <div class="bar-value">${fmt(d.total)}</div>
    </div>`).join('');
}

function rArch(){
  const keys=Object.keys(D.months).sort().reverse();
  const af=allFixedTotal();

  if(keys.length===0){
    $('archList').innerHTML='<div class="chart-container"><p style="text-align:center;color:var(--text3)">Δεν υπάρχουν μήνες</p></div>';
    return;
  }

  $('archList').innerHTML=keys.map(k=>{
    const m=D.months[k];
    const ds=m.daily.reduce((s,e)=>s+e.amount,0);
    const tot=af+ds;
    const sav=D.income-tot;
    const[y,mo]=k.split('-');
    const nm=MG[parseInt(mo)-1]+' '+y;
    const active=k===curM;

    return `
      <div class="archive-card" ${active?'style="border-color:var(--teal)"':''} onclick="goM('${k}')">
        <div class="archive-month">${nm} ${active?'<span style="font-size:11px;color:var(--teal)">τρέχων</span>':''}</div>
        <div class="archive-info">
          <div class="archive-spent">-${fmt(tot)}</div>
          <div class="archive-saved" style="color:${sav>=0?'var(--teal)':'var(--red)'}">Υπόλ. ${fmt(sav)}</div>
        </div>
      </div>`;
  }).join('');
}

// ===== MODALS / SAVE ACTIONS / NAV / AUTH =====
function closeM(){document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active'))}

function openModal(t){
  closeM();
  if(t==='daily'){$('mDaily').classList.add('active');$('mDailyTitle').innerHTML='Νέο ημερήσιο έξοδο<button class="modal-close" onclick="closeM()">×</button>';$('fDN').value='';$('fDA').value='';$('fDD').value=new Date().toISOString().split('T')[0];$('fDID').value='';$('btnDaily').textContent='Αποθήκευση';$('fDN').focus()}
  if(t==='fixed'){$('mFixed').classList.add('active');$('mFixedTitle').innerHTML='🔒 Νέο πάγιο<button class="modal-close" onclick="closeM()">×</button>';$('fFN').value='';$('fFA').value='';$('fFID').value='';$('btnFixed').textContent='Αποθήκευση';$('fFN').focus()}
  if(t==='income'){$('fInc').value=D.income||'';$('mIncome').classList.add('active');$('fInc').focus()}
  if(t==='cc'){$('mCC').classList.add('active');$('mCCTitle').innerHTML='💳 Νέα κάρτα<button class="modal-close" onclick="closeM()">×</button>';$('fCCN').value='';$('fCCB').value='';$('fCCR').value='';$('fCCM').value='';$('fCCL').value='';$('fCCID').value='';$('btnCC').textContent='Αποθήκευση';$('fCCN').focus()}
}

function editExp(t,id){
  closeM();
  if(t==='fixed'){
    const e=D.fixedExpenses.find(x=>x.id===id);if(!e)return;
    $('mFixed').classList.add('active');$('mFixedTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';$('fFN').value=e.name;$('fFA').value=e.amount;$('fFC').value=e.category;$('fFID').value=id;$('btnFixed').textContent='Ενημέρωση';$('fFN').focus();
  }else{
    ensM(curM);const e=(D.months[curM]||{daily:[]}).daily.find(x=>x.id===id);if(!e)return;
    $('mDaily').classList.add('active');$('mDailyTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';$('fDN').value=e.name;$('fDA').value=e.amount;$('fDC').value=e.category;$('fDD').value=e.date;$('fDID').value=id;$('btnDaily').textContent='Ενημέρωση';$('fDN').focus();
  }
}

function saveIncome(){D.income=parseFloat($('fInc').value)||0;saveToSupabase();closeM();render()}

function saveDaily(){
  const n=$('fDN').value.trim(),a=parseFloat($('fDA').value),id=$('fDID').value;
  if(!n){$('fDN').style.borderColor='var(--red)';return}
  if(!a||a<=0){$('fDA').style.borderColor='var(--red)';return}
  ensM(curM);
  if(id){const e=D.months[curM].daily.find(x=>x.id===id);if(e){e.name=n;e.amount=a;e.category=$('fDC').value;e.date=$('fDD').value||new Date().toISOString().split('T')[0]}}
  else{D.months[curM].daily.push({id:gid(),name:n,amount:a,category:$('fDC').value,date:$('fDD').value||new Date().toISOString().split('T')[0]})}
  saveToSupabase();closeM();render();
}

function saveFixed(){
  const n=$('fFN').value.trim(),a=parseFloat($('fFA').value),id=$('fFID').value;
  if(!n){$('fFN').style.borderColor='var(--red)';return}
  if(!a||a<=0){$('fFA').style.borderColor='var(--red)';return}
  if(id){const e=D.fixedExpenses.find(x=>x.id===id);if(e){e.name=n;e.amount=a;e.category=$('fFC').value}}
  else{D.fixedExpenses.push({id:gid(),name:n,amount:a,category:$('fFC').value})}
  saveToSupabase();closeM();render();
}

function delExp(t,id){
  if(!confirm('Διαγραφή;'))return;
  if(t==='fixed')D.fixedExpenses=D.fixedExpenses.filter(e=>e.id!==id);
  else{ensM(curM);D.months[curM].daily=D.months[curM].daily.filter(e=>e.id!==id)}
  saveToSupabase();render();
}

function doExport(){const b=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='expense_tracker_'+new Date().toISOString().split('T')[0]+'.json';a.click();URL.revokeObjectURL(a.href)}
function doImport(ev){const f=ev.target.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{try{const d=JSON.parse(e.target.result);if(d.months||d.fixedExpenses){D=d;if(!D.fixedExpenses)D.fixedExpenses=[];if(!D.creditCards)D.creditCards=[];saveToSupabase();render();alert('✅ Επιτυχία!')}else alert('Μη έγκυρο αρχείο')}catch(err){alert('Σφάλμα: '+err.message)}};r.readAsText(f);ev.target.value=''}
function doReset(){if(confirm('Διαγραφή ΟΛΩΝ;')&&confirm('Σίγουρα;')){localStorage.removeItem(SK);location.reload()}}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeM();
  if(e.key==='Enter'){
    if($('authScreen')&&document.body.classList.contains('auth-pending')){
      if(document.activeElement&&document.activeElement.id==='chatIdInput')connectWithChatId(e);
      return;
    }
    if($('mDaily').classList.contains('active'))saveDaily();
    if($('mFixed').classList.contains('active'))saveFixed();
    if($('mIncome').classList.contains('active'))saveIncome();
    if($('mCC').classList.contains('active'))saveCC();
  }
});

document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeM()}));
['fDN','fDA','fFN','fFA','fCCN'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',function(){this.style.borderColor=''})});

function go(v,b){document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));const target=$(v);if(target)target.classList.add('active');document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));if(b)b.classList.add('active')}
function chMonth(d){const[y,mo]=curM.split('-').map(Number);let nm=mo+d,ny=y;if(nm>12){nm=1;ny++}if(nm<1){nm=12;ny--}curM=ny+'-'+String(nm).padStart(2,'0');ensM(curM);render()}
function goM(k){curM=k;ensM(k);go('vDash',document.querySelector('[data-v="vDash"]'));render()}

function setAuthLoading(isLoading){const btn=$('authSubmitBtn');if(!btn)return;btn.disabled=isLoading;btn.textContent=isLoading?'Σύνδεση...':'Σύνδεση'}
function showAuth(message){document.body.classList.add('auth-pending');const auth=$('authScreen'),input=$('chatIdInput'),err=$('authError');if(auth)auth.style.display='flex';if(err)err.textContent=message||'';if(input)setTimeout(()=>input.focus(),80)}
function hideAuth(){document.body.classList.remove('auth-pending');const auth=$('authScreen');if(auth)auth.style.display='none'}
async function loadUserData(userId){await fetchAllData(userId);curM=curMK();ensM(curM);render();go('vDash',document.querySelector('[data-v="vDash"]'));hideAuth()}

async function connectWithChatId(ev){
  if(ev)ev.preventDefault();
  const input=$('chatIdInput'),err=$('authError'),userId=(input?.value||'').trim();
  if(!userId){if(err)err.textContent='Βάλε το Telegram Chat ID σου.';input?.focus();return}
  if(!/^\d+$/.test(userId)){if(err)err.textContent='Το Chat ID πρέπει να περιέχει μόνο αριθμούς.';input?.focus();return}
  try{setAuthLoading(true);localStorage.setItem(SK,userId);await loadUserData(userId)}
  catch(e){console.error('Init error:',e);localStorage.removeItem(SK);if(err)err.textContent='Σφάλμα φόρτωσης. Έλεγξε το Chat ID, τη σύνδεση ή το config.js.';showAuth()}
  finally{setAuthLoading(false)}
}

function switchChatId(){localStorage.removeItem(SK);const input=$('chatIdInput');if(input)input.value='';closeM();showAuth('Βάλε νέο Telegram Chat ID.')}

async function initApp(){
  const userId=localStorage.getItem(SK);
  if(!userId){showAuth();return}
  try{await loadUserData(userId)}
  catch(e){console.error('Init error:',e);localStorage.removeItem(SK);showAuth('Σφάλμα φόρτωσης. Έλεγξε τη σύνδεση ή το config.js.')}
}

// initApp() is called from advisor.js