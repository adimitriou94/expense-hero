// ===== SUPABASE & CONFIG =====
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY;


const authStorage={
  getItem:(key)=>{
    return window.localStorage.getItem(key);
  },
  setItem:(key,value)=>{
    window.localStorage.setItem(key,value);
  },
  removeItem:(key)=>{
    window.localStorage.removeItem(key);
  }
};

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true,
      storage:authStorage,
      storageKey:'expense-hero-auth',
      flowType:'pkce'
    }
  }
);

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

let D = {
  income:0,
  incomeSources:[],
  fixedExpenses:[],
  creditCards:[],
  months:{}
};
let curM;

let currentSession=null;
let currentUser=null;
let currentProfile=null;
let authBooting=false;
let changingTelegramId=false;
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
function incomeSourcesTotal(){
  return (D.incomeSources||[])
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function budgetIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.includeInBudget)
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function savingsIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.isSavings || !i.includeInBudget)
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedIncomeTotal(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .reduce((s,i)=>s+(Number(i.amount)||0),0);
}

function restrictedCategoriesFor(source){
  if(!source?.restriction || source.restriction==='none'){
    return [];
  }

  if(source.restriction==='food_only'){
    return ['Τρόφιμα','Καφέδες','Φαγητό έξω'];
  }

  if(source.restriction==='specific_category'){
    return [source.restrictedCategory].filter(Boolean);
  }

  return [];
}

function categoryExpensesTotal(categories){
  if(!Array.isArray(categories) || categories.length===0){
    return 0;
  }

  const allowed=new Set(categories);

  let total=0;

  Object.values(D.months||{}).forEach(month=>{
    (month.daily||[]).forEach(exp=>{
      if(allowed.has(exp.category)){
        total+=Number(exp.amount)||0;
      }
    });
  });

  return total;
}

function restrictedCoverageFor(source){
  if(!source?.id)return 0;

  let total=0;

  Object.values(D.months||{}).forEach(month=>{
    (month.daily||[]).forEach(exp=>{
      if(exp.paymentSourceId===source.id){
        total+=Number(exp.amount)||0;
      }
    });
  });

  return Math.min(
    Number(source.amount)||0,
    total
  );
}

function paymentSourceRemaining(source){
  return Math.max(
    0,
    (Number(source.amount)||0)-restrictedCoverageFor(source)
  );
}

function dailyCashTotal(){
  const m=D.months[curM]||{daily:[]};

  return (m.daily||[])
    .filter(e=>!e.paymentSourceId)
    .reduce((s,e)=>s+(Number(e.amount)||0),0);
}

function totalRestrictedCoverage(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .reduce((sum,i)=>sum+restrictedCoverageFor(i),0);
}

function remainingRestrictedAmount(source){
  return Math.max(
    0,
    (Number(source.amount)||0)-restrictedCoverageFor(source)
  );
}

function refreshComputedIncome(){
  D.income = budgetIncomeTotal();
}

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

async function deleteRowsFromTable(table,ids){
  if(!ids || ids.length===0)return;

  const token=currentSession?.access_token;
  if(!token)throw new Error('Δεν υπάρχει ενεργό session.');

  const filter=ids.map(id=>`"${id}"`).join(',');

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);

  try{
    const res=await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/${table}?id=in.(${filter})`,
      {
        method:'DELETE',
        headers:{
          apikey:CONFIG.SUPABASE_ANON_KEY,
          Authorization:'Bearer '+token,
          Prefer:'return=minimal'
        },
        signal:controller.signal
      }
    );

    if(!res.ok){
      const txt=await res.text();
      throw new Error(txt);
    }

  }finally{
    clearTimeout(timeout);
  }
}

async function bulkDelete(type){
  const set=type==='fixed'?selectedFixed:selectedDaily;

  if(set.size===0){
    alert('Δεν έχεις επιλέξει εγγραφές.');
    return;
  }

  if(!confirm(`Διαγραφή ${set.size} εγγραφών;`))return;

  const ids=[...set];
  const table=type==='fixed'?'fixed_expenses':'expenses';

  try{
    await deleteRowsFromTable(table,ids);

    if(type==='fixed'){
      D.fixedExpenses=D.fixedExpenses.filter(e=>!ids.includes(e.id));
      selectedFixed.clear();
      selectionMode.fixed=false;
    }

    if(type==='daily'){
      Object.values(D.months||{}).forEach(m=>{
        m.daily=(m.daily||[]).filter(e=>!ids.includes(e.id));
      });

      selectedDaily.clear();
      selectionMode.daily=false;
    }

    render();

  }catch(e){
    console.error('Bulk delete error:',e);
    alert('Σφάλμα μαζικής διαγραφής: '+e.message);
  }
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

    const {data:incomeSources,error:errIncomeSources}=await supabaseClient
    .from('income_sources')
    .select('*')
    .eq('user_chat_id',userId);
  
  if(errIncomeSources)throw errIncomeSources;
  
  D.incomeSources=(incomeSources||[]).map(i=>({
    id:i.id,
    name:i.name,
    amount:Number(i.amount)||0,
    category:i.category||'Άλλο',
    incomeType:i.income_type||'cash',
    includeInBudget:i.include_in_budget,
    isSavings:i.is_savings,
    isRecurring:i.is_recurring,
    restriction:i.restriction||'none',
    restrictedCategory:i.restricted_category||'',
    notes:i.notes||''
  }));
  
  refreshComputedIncome();

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
      D.months[mk].daily.push({
        id:e.id,
        name:e.name,
        amount:e.amount,
        category:e.category,
        date:e.date,
        paymentSourceId:e.payment_source_id||'',
        paymentSourceName:e.payment_source_name||'',
        paymentSourceType:e.payment_source_type||''
      });
    });

  }catch(e){
    console.error('Fetch error:',e);
    throw e;
  }
}

async function syncIncomeSources(userId){
  if((D.incomeSources||[]).length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .upsert(
        D.incomeSources.map(i=>({
          id:i.id,
          user_chat_id:userId,
          name:i.name,
          amount:i.amount,
          category:i.category,
          income_type:i.incomeType,
          include_in_budget:i.includeInBudget,
          is_savings:i.isSavings,
          is_recurring:i.isRecurring,
          restriction:i.restriction,
          restricted_category:i.restrictedCategory||null,
          notes:i.notes||null,
          updated_at:new Date().toISOString()
        })),
        {onConflict:'id'}
      );

    if(error)throw error;
  }

  if(!Array.isArray(D.incomeSources)){
    D.incomeSources=[];
  }

  const {data:dbRows,error:fetchError}=await supabaseClient
    .from('income_sources')
    .select('id')
    .eq('user_chat_id',userId);

  if(fetchError)throw fetchError;

   const appIds=new Set(
    D.incomeSources
      .filter(i=>i && i.id)
      .map(i=>i.id)
  );

  const idsToDelete=(dbRows||[])
    .filter(i=>!appIds.has(i.id))
    .map(i=>i.id);

  if(idsToDelete.length>0){
    const {error}=await supabaseClient
      .from('income_sources')
      .delete()
      .in('id',idsToDelete);

    if(error)throw error;
  }
}

async function saveToSupabase(){
  const userId=localStorage.getItem(SK);
  if(!userId) return;

  try{
    refreshComputedIncome();

    await supabaseClient.from('users').upsert({chat_id:userId,income:D.income},{onConflict:'chat_id'});

    await syncIncomeSources(userId);

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

    const allDaily=[];

    Object.entries(D.months).forEach(([monthKey,m])=>{
      m.daily.forEach(e=>{
        allDaily.push({
          id:e.id,
          name:e.name,
          amount:e.amount,
          category:e.category,
          date:e.date,
          type:'daily',
          month_key:monthKey,
          user_chat_id:userId,
          payment_source_id:e.paymentSourceId||null,
          payment_source_name:e.paymentSourceName||null,
          payment_source_type:e.paymentSourceType||null
        });
      });
    });
    
    if(allDaily.length>0){
      await supabaseClient
        .from('expenses')
        .upsert(allDaily,{onConflict:'id'});
    }
    
    const {data:dbExpenses}=await supabaseClient
      .from('expenses')
      .select('id')
      .eq('user_chat_id',userId);
    
    const dbIds=new Set((dbExpenses||[]).map(e=>e.id));
    const appIds=new Set(allDaily.map(e=>e.id));
    
    const toDelete=[...dbIds].filter(id=>!appIds.has(id));
    
    if(toDelete.length>0){
      await supabaseClient
        .from('expenses')
        .delete()
        .in('id',toDelete);
    }

  }catch(e){
    console.error('Save error:',e);
    alert('Σφάλμα αποθήκευσης: '+e.message);
    throw e;
  }
}

function renderPaymentSourcesSummary(){
  const el=$('paymentSourcesSummary');
  if(!el)return;

  const restricted=(D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none');

  if(restricted.length===0){
    el.closest('.payment-sources-widget').style.display='none';
    el.innerHTML='';
    return;
  }

  el.closest('.payment-sources-widget').style.display='block';

  el.innerHTML=restricted.map(i=>{
    const remaining=paymentSourceRemaining(i);
    const total=Number(i.amount)||0;
    const used=Math.max(0,total-remaining);
    const pct=total>0?Math.round(used/total*100):0;

    return`
      <div class="payment-source-mini-card">
        <div class="widget-icon teal">🎫</div>

        <div class="payment-source-mini-content">
          <div class="stat-label">${esc(i.name)}</div>
          <div class="stat-value teal">${fmt(remaining)}</div>
          <div class="payment-mini-meta">διαθέσιμα / ${fmt(total)}</div>

          <div class="payment-mini-bar">
            <div class="payment-mini-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
// ===== MAIN RENDER =====
function render(){
  refreshComputedIncome();

  const fxS=fixedTotal();
  const ccS=ccPayTotal();
  const dlS=dailyTotal();
  const cashDaily=dailyCashTotal();
  
  const tot=fxS+ccS+cashDaily;
  const bal=D.income-tot;

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
  if($('incomeList')) renderIncomePage();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof rAdv==='function') rAdv();

  renderPaymentSourcesSummary();
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


function paymentSourceExists(id){
  if(!id)return true;

  return (D.incomeSources||[]).some(i=>i.id===id);
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
<div class="expense-cat">
  ${esc(e.category)}
  ${t==='daily' && e.paymentSourceName
    ? ` <span class="payment-badge ${paymentSourceExists(e.paymentSourceId)?'':'deleted'}">
          💳 ${esc(e.paymentSourceName)}${paymentSourceExists(e.paymentSourceId)?'':' (διαγραμμένο)'}
        </span>`
    : ''
  }
</div>
      </div>

      <div class="expense-amount" style="${cl}">${fmt(e.amount)}</div>

      ${!showSelect?`
        <div class="expense-actions">
          <button class="edit-btn" onclick="editExp('${t}','${e.id}')" title="Επεξεργασία">✎</button>
          <button class="del-btn" onclick="delExp('${t}','${e.id}')" title="Διαγραφή">×</button>
        </div>`:''}
    </div>`;
}

const INCOME_COLORS={
  'Μισθός':'#10b981',
  'Bonus':'#3b82f6',
  'Ενοίκιο':'#8b5cf6',
  'Ticket Restaurant':'#f59e0b',
  'Άυλη κάρτα':'#ef4444',
  'Μερίσματα':'#14b8a6',
  'Freelance':'#6366f1',
  'Δώρο':'#ec4899',
  'Άλλο':'#64748b'
};

const INCOME_ICONS={
  'Μισθός':'💼',
  'Bonus':'🎁',
  'Ενοίκιο':'🏠',
  'Ticket Restaurant':'🍽️',
  'Άυλη κάρτα':'💳',
  'Μερίσματα':'📈',
  'Freelance':'🧑‍💻',
  'Δώρο':'🎉',
  'Άλλο':'💰'
};

function renderIncomePage(){
  const sources=D.incomeSources||[];

  const total=incomeSourcesTotal();
  const budget=budgetIncomeTotal();
  const savings=savingsIncomeTotal();
  const restricted=restrictedIncomeTotal();
  const restrictedCovered=totalRestrictedCoverage();
  const restrictedRemaining=Math.max(0,restricted-restrictedCovered);

  $('incomeTotalBox').textContent=fmt(total);
  $('incomeBudgetBox').textContent=fmt(budget);
  $('incomeSavingsBox').textContent=fmt(savings);
  $('incomeRestrictedBox').textContent= fmt(restrictedRemaining)+' / '+fmt(restricted);
  $('incomeCount').textContent=sources.length+' εγγραφές';

  renderIncomeDonut();
  renderIncomeList();
}

function renderIncomeDonut(){
  const sources=D.incomeSources||[];
  const byCat={};

  sources.forEach(i=>{
    byCat[i.category]=(byCat[i.category]||0)+(Number(i.amount)||0);
  });

  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const total=sorted.reduce((s,[_,v])=>s+v,0);

  if(sorted.length===0||total<=0){
    $('incomeDonut').style.background='#eef2f7';
    $('incomeDonutTotal').textContent=fmt(0);
    $('incomeLegend').innerHTML='<p style="text-align:center;color:var(--text3);padding:20px">Δεν υπάρχουν έσοδα</p>';
    return;
  }

  let start=0;

  const parts=sorted.map(([cat,value])=>{
    const pct=value/total*100;
    const end=start+pct;
    const color=INCOME_COLORS[cat]||'#64748b';
    const part=`${color} ${start}% ${end}%`;
    start=end;
    return part;
  });

  $('incomeDonut').style.background=`conic-gradient(${parts.join(',')})`;
  $('incomeDonutTotal').textContent=fmt(total);

  $('incomeLegend').innerHTML=sorted.map(([cat,value])=>{
    const pct=Math.round(value/total*100);
    const color=INCOME_COLORS[cat]||'#64748b';

    return`
      <div class="donut-legend-row">
        <div class="donut-legend-left">
          <span class="donut-dot" style="background:${color}"></span>
          <span>${esc(cat)}</span>
        </div>

        <div class="donut-legend-right">
          <strong>${fmt(value)}</strong>
          <small>${pct}%</small>
        </div>
      </div>`;
  }).join('');
}

function renderIncomeList(){
  const sources=D.incomeSources||[];

  if(sources.length===0){
    $('incomeList').innerHTML=`
      <div class="empty">
        Δεν έχεις προσθέσει ακόμα πηγές εισοδήματος.
      </div>`;
    return;
  }

  $('incomeList').innerHTML=sources.map(i=>{
    const icon=INCOME_ICONS[i.category]||'💰';

    return`
      <div class="income-source-item">
        <div class="income-source-icon">${icon}</div>

        <div class="income-source-info">
          <div class="income-source-name">${esc(i.name)}</div>
          <div class="income-source-meta">${esc(i.category)} · ${esc(i.incomeType)} · ${i.isRecurring?'Μηνιαίο':'One-time'}</div>

          <div class="income-badges">
            ${i.includeInBudget?'<span class="income-badge budget">Στο budget</span>':'<span class="income-badge savings">Εκτός budget</span>'}
            ${i.isSavings?'<span class="income-badge savings">Αποταμίευση</span>':''}
            ${i.restriction&&i.restriction!=='none'
              ?`<span class="income-badge restricted">
                  Διαθέσιμο ${fmt(paymentSourceRemaining(i))} / ${fmt(i.amount)}
                </span>`
              :''
            }
          </div>
        </div>

        <div class="income-source-amount">${fmt(i.amount)}</div>

        <div class="expense-actions">
          <button class="edit-btn" onclick="editIncomeSource('${i.id}')">✎</button>
          <button class="del-btn" onclick="deleteIncomeSource('${i.id}')">×</button>
        </div>
      </div>`;
  }).join('');
}

function editIncomeSource(id){
  const i=(D.incomeSources||[]).find(x=>x.id===id);
  if(!i)return;

  closeM();

  $('mIncomeSource').classList.add('active');
  $('mIncomeSourceTitle').innerHTML='✎ Επεξεργασία εσόδου<button class="modal-close" onclick="closeM()">×</button>';

  $('fISName').value=i.name;
  $('fISAmount').value=i.amount;
  $('fISCategory').value=i.category;
  $('fISType').value=i.incomeType;
  $('fISRestriction').value=i.restriction;
  $('fISRestrictedCategory').value=i.restrictedCategory||'';
  $('fISIncludeBudget').checked=!!i.includeInBudget;
  $('fISSavings').checked=!!i.isSavings;
  $('fISRecurring').checked=!!i.isRecurring;
  $('fISNotes').value=i.notes||'';
  $('fISID').value=id;

  $('btnIncomeSource').textContent='Ενημέρωση';
}

function availablePaymentSources(){
  return (D.incomeSources||[])
    .filter(i=>i.restriction && i.restriction!=='none')
    .map(i=>({
      id:i.id,
      name:i.name,
      type:i.incomeType||'voucher'
    }));
}

function paymentSourceById(id){
  return (D.incomeSources||[]).find(i=>i.id===id)||null;
}

function fillPaymentSourceSelect(selectedId=''){
  const el=$('fDPay');
  if(!el)return;

  const sources=availablePaymentSources();

  el.innerHTML=`
    <option value="">Κανονικό budget</option>
    ${sources.map(s=>`
      <option value="${s.id}" ${s.id===selectedId?'selected':''}>
        ${esc(s.name)}
      </option>
    `).join('')}
  `;
}


async function saveIncomeSourceRow(userId,item){
  const {error}=await supabaseClient
    .from('income_sources')
    .upsert({
      id:item.id,
      user_chat_id:userId,
      name:item.name,
      amount:item.amount,
      category:item.category,
      income_type:item.incomeType,
      include_in_budget:item.includeInBudget,
      is_savings:item.isSavings,
      is_recurring:item.isRecurring,
      restriction:item.restriction,
      restricted_category:item.restrictedCategory||null,
      notes:item.notes||null,
      updated_at:new Date().toISOString()
    },{onConflict:'id'});

  if(error)throw error;
}

async function deleteIncomeSourceRow(id){
  const {error}=await supabaseClient
    .from('income_sources')
    .delete()
    .eq('id',id);

  if(error)throw error;
}

async function saveIncomeSource(){
  const id=$('fISID').value;
  const name=$('fISName').value.trim();
  const amount=parseFloat($('fISAmount').value)||0;
  const userId=localStorage.getItem(SK);
  const btn=$('btnIncomeSource');

  if(!name){
    $('fISName').style.borderColor='var(--red)';
    return;
  }

  if(amount<=0){
    $('fISAmount').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    alert('Δεν υπάρχει συνδεδεμένο Telegram ID.');
    return;
  }

  const obj={
    id:id||gid(),
    name,
    amount,
    category:$('fISCategory').value,
    incomeType:$('fISType').value,
    includeInBudget:$('fISIncludeBudget').checked,
    isSavings:$('fISSavings').checked,
    isRecurring:$('fISRecurring').checked,
    restriction:$('fISRestriction').value,
    restrictedCategory:$('fISRestrictedCategory').value,
    notes:$('fISNotes').value.trim()
  };

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveIncomeSourceRow(userId,obj);

    if(id){
      const idx=D.incomeSources.findIndex(x=>x.id===id);
      if(idx>=0)D.incomeSources[idx]=obj;
    }else{
      if(!D.incomeSources)D.incomeSources=[];
      D.incomeSources.push(obj);
    }

    refreshComputedIncome();
    closeM();
    render();

  }catch(e){
    console.error('saveIncomeSource failed:',e);
    alert('Save failed: '+e.message);

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}

async function deleteIncomeSource(id){
  if(!confirm('Διαγραφή πηγής εισοδήματος;'))return;

  try{
    await deleteIncomeSourceRow(id);

    D.incomeSources=(D.incomeSources||[]).filter(i=>i.id!==id);

    refreshComputedIncome();
    render();

  }catch(e){
    console.error('deleteIncomeSource failed:',e);
    alert('Σφάλμα διαγραφής: '+e.message);
  }
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

  if(t==='daily'){
    $('mDaily').classList.add('active');
    $('mDailyTitle').innerHTML='Νέο ημερήσιο έξοδο<button class="modal-close" onclick="closeM()">×</button>';
    $('fDN').value='';
    $('fDA').value='';
    $('fDD').value=new Date().toISOString().split('T')[0];
    $('fDID').value='';
    $('btnDaily').textContent='Αποθήκευση';

    fillPaymentSourceSelect('');

    $('fDN').focus();
  }

  if(t==='fixed'){
    $('mFixed').classList.add('active');
    $('mFixedTitle').innerHTML='🔒 Νέο πάγιο<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value='';
    $('fFA').value='';
    $('fFID').value='';
    $('btnFixed').textContent='Αποθήκευση';
    $('fFN').focus();
  }

  if(t==='cc'){
    $('mCC').classList.add('active');
    $('mCCTitle').innerHTML='💳 Νέα κάρτα<button class="modal-close" onclick="closeM()">×</button>';
    $('fCCN').value='';
    $('fCCB').value='';
    $('fCCR').value='';
    $('fCCM').value='';
    $('fCCL').value='';
    $('fCCID').value='';
    $('btnCC').textContent='Αποθήκευση';
    $('fCCN').focus();
  }

  if(t==='incomeSource'){
    $('mIncomeSource').classList.add('active');
    $('mIncomeSourceTitle').innerHTML='💰 Νέο έσοδο<button class="modal-close" onclick="closeM()">×</button>';

    $('fISName').value='';
    $('fISAmount').value='';
    $('fISCategory').value='Μισθός';
    $('fISType').value='bank';
    $('fISRestriction').value='none';
    $('fISRestrictedCategory').value='';
    $('fISIncludeBudget').checked=true;
    $('fISSavings').checked=false;
    $('fISRecurring').checked=true;
    $('fISNotes').value='';
    $('fISID').value='';
    $('btnIncomeSource').textContent='Αποθήκευση';

    $('fISName').focus();
  }
}

function editExp(t,id){
  closeM();

  if(t==='fixed'){
    const e=D.fixedExpenses.find(x=>x.id===id);
    if(!e)return;

    $('mFixed').classList.add('active');
    $('mFixedTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';
    $('fFN').value=e.name;
    $('fFA').value=e.amount;
    $('fFC').value=e.category;
    $('fFID').value=id;
    $('btnFixed').textContent='Ενημέρωση';
    $('fFN').focus();

    return;
  }

  ensM(curM);

  let e=null;

  Object.values(D.months||{}).forEach(m=>{
    const found=(m.daily||[]).find(x=>x.id===id);
    if(found)e=found;
  });

  if(!e)return;

  $('mDaily').classList.add('active');
  $('mDailyTitle').innerHTML='✎ Επεξεργασία<button class="modal-close" onclick="closeM()">×</button>';
  $('fDN').value=e.name;
  $('fDA').value=e.amount;
  $('fDC').value=e.category;
  $('fDD').value=e.date;
  $('fDID').value=id;
  $('btnDaily').textContent='Ενημέρωση';

  fillPaymentSourceSelect(e.paymentSourceId||'');

  $('fDN').focus();
}

async function saveDailyExpenseRow(userId,expense){
  const token=currentSession?.access_token;

  if(!token)throw new Error('Δεν υπάρχει ενεργό session.');

  const row={
    id:expense.id,
    user_chat_id:userId,
    name:expense.name,
    amount:expense.amount,
    category:expense.category,
    date:expense.date,
    type:'daily',
    month_key:expense.date.substring(0,7),
    payment_source_id:expense.paymentSourceId||null,
    payment_source_name:expense.paymentSourceName||null,
    payment_source_type:expense.paymentSourceType||null
  };

  const res=await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/expenses`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      apikey:CONFIG.SUPABASE_ANON_KEY,
      Authorization:'Bearer '+token,
      Prefer:'resolution=merge-duplicates'
    },
    body:JSON.stringify(row)
  });

  if(!res.ok){
    const txt=await res.text();
    throw new Error(txt);
  }
}

async function saveDaily(){
  const n=$('fDN').value.trim();
  const a=parseFloat($('fDA').value);
  const id=$('fDID').value;
  const date=$('fDD').value||new Date().toISOString().split('T')[0];
  const category=$('fDC').value;
  const paymentSourceId=$('fDPay')?.value||'';
  const paymentSource=paymentSourceById(paymentSourceId);
  const userId=localStorage.getItem(SK);
  const btn=$('btnDaily');

  if(!n){
    $('fDN').style.borderColor='var(--red)';
    return;
  }

  if(!a||a<=0){
    $('fDA').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    alert('Δεν υπάρχει συνδεδεμένο Telegram ID.');
    return;
  }

  const monthKey=date.substring(0,7);
  ensM(monthKey);

  let expense;

  if(id){
    Object.values(D.months).forEach(m=>{
      m.daily=m.daily.filter(e=>e.id!==id);
    });

    expense={
      id,
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };
  }else{
    expense={
      id:gid(),
      name:n,
      amount:a,
      category,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };
  }

  D.months[monthKey].daily.push(expense);

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveDailyExpenseRow(userId,expense);

    closeM();
    render();

  }catch(e){
    console.error('saveDaily failed:',e);
    alert('Save failed: '+e.message);

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}

async function saveFixedExpenseRow(userId,expense){
  const {error}=await supabaseClient
    .from('fixed_expenses')
    .upsert({
      id:expense.id,
      user_chat_id:userId,
      name:expense.name,
      amount:expense.amount,
      category:expense.category
    },{onConflict:'id'});

  if(error)throw error;
}

async function saveFixed(){
  const n=$('fFN').value.trim();
  const a=parseFloat($('fFA').value);
  const id=$('fFID').value;
  const category=$('fFC').value;
  const userId=localStorage.getItem(SK);
  const btn=$('btnFixed');

  if(!n){
    $('fFN').style.borderColor='var(--red)';
    return;
  }

  if(!a||a<=0){
    $('fFA').style.borderColor='var(--red)';
    return;
  }

  if(!userId){
    alert('Δεν υπάρχει συνδεδεμένο Telegram ID.');
    return;
  }

  let expense;

  if(id){
    expense=D.fixedExpenses.find(x=>x.id===id);

    if(expense){
      expense.name=n;
      expense.amount=a;
      expense.category=category;
    }
  }else{
    expense={
      id:gid(),
      name:n,
      amount:a,
      category
    };

    D.fixedExpenses.push(expense);
  }

  if(!expense)return;

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveFixedExpenseRow(userId,expense);

    closeM();
    render();

  }catch(e){
    console.error('saveFixed failed:',e);
    alert('Save failed: '+e.message);

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}


async function deleteExpenseRow(type,id){
  const table=type==='fixed'?'fixed_expenses':'expenses';
  await deleteRowsFromTable(table,[id]);
}

async function delExp(t,id){
  if(!confirm('Διαγραφή;'))return;

  try{
    await deleteExpenseRow(t,id);

    if(t==='fixed'){
      D.fixedExpenses=D.fixedExpenses.filter(e=>e.id!==id);
    }else{
      Object.values(D.months||{}).forEach(m=>{
        m.daily=(m.daily||[]).filter(e=>e.id!==id);
      });
    }

    render();

  }catch(e){
    console.error('Delete error:',e);
    alert('Σφάλμα διαγραφής: '+e.message);
  }
}

function doExport(){const b=new Blob([JSON.stringify(D,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='expense_tracker_'+new Date().toISOString().split('T')[0]+'.json';a.click();URL.revokeObjectURL(a.href)}

function doImport(ev){
  const f=ev.target.files[0];
  if(!f)return;

  const r=new FileReader();

  r.onload=async e=>{
    try{
      const d=JSON.parse(e.target.result);

      if(!d.months && !d.fixedExpenses){
        alert('Μη έγκυρο αρχείο');
        return;
      }

      D=d;

      if(!D.incomeSources)D.incomeSources=[];
      if(!D.fixedExpenses)D.fixedExpenses=[];
      if(!D.creditCards)D.creditCards=[];
      if(!D.months)D.months={};

      refreshComputedIncome();

      await saveToSupabase();

      render();
      alert('✅ Επιτυχία!');

    }catch(err){
      console.error('Import error:',err);
      alert('Σφάλμα: '+err.message);
    }
  };

  r.readAsText(f);
  ev.target.value='';
}

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
    if($('mCC').classList.contains('active'))saveCC();
  }
});

document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeM()}));
['fDN','fDA','fFN','fFA','fCCN'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',function(){this.style.borderColor=''})});

function go(v,b){document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));const target=$(v);if(target)target.classList.add('active');document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));if(b)b.classList.add('active')}
function chMonth(d){const[y,mo]=curM.split('-').map(Number);let nm=mo+d,ny=y;if(nm>12){nm=1;ny++}if(nm<1){nm=12;ny--}curM=ny+'-'+String(nm).padStart(2,'0');ensM(curM);render()}
function goM(k){curM=k;ensM(k);go('vDash',document.querySelector('[data-v="vDash"]'));render()}

async function signInWithGoogle(){
  const redirectTo=window.location.origin+window.location.pathname;

  const {error}=await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo,
      queryParams:{
        access_type:'offline'
      }
    }
  });

  if(error){
    const err=$('authError');
    if(err)err.textContent='Σφάλμα Google login: '+error.message;
  }
}

async function signOutUser(){

  try{
    supabaseClient.auth.signOut().catch(()=>{});
  }catch{}

  localStorage.removeItem(SK);
  localStorage.removeItem('expense-hero-auth');
  localStorage.removeItem('expense-hero-auth-code-verifier');

  Object.keys(localStorage)
    .filter(k=>k.startsWith('sb-') || k.includes('supabase'))
    .forEach(k=>localStorage.removeItem(k));

  currentSession=null;
  currentUser=null;
  currentProfile=null;

  window.location.reload();
}

async function getOrCreateProfile(user){
  const metadata=user.user_metadata||{};

  const profilePayload={
    user_id:user.id,
    email:user.email||'',
    full_name:metadata.full_name||metadata.name||'',
    avatar_url:metadata.avatar_url||metadata.picture||'',
    updated_at:new Date().toISOString()
  };

  const {data,error}=await supabaseClient
    .from('profiles')
    .upsert(profilePayload,{onConflict:'user_id'})
    .select('*')
    .single();

  if(error)throw error;

  return data;
}

async function saveTelegramChatId(ev){
  if(ev)ev.preventDefault();

  const input=$('chatIdInput');
  const err=$('authError');
  const chatId=(input?.value||'').trim();

  if(err)err.textContent='';

  if(!currentUser){
    if(err)err.textContent='Πρέπει πρώτα να συνδεθείς με Google.';
    return;
  }

  if(!chatId){
    if(err)err.textContent='Βάλε το Telegram Chat ID σου.';
    input?.focus();
    return;
  }

  if(!/^\d+$/.test(chatId)){
    if(err)err.textContent='Το Chat ID πρέπει να περιέχει μόνο αριθμούς.';
    input?.focus();
    return;
  }

  setAuthLoading(true);

  try{
    const meta=currentUser.user_metadata||{};

    const {data,error}=await supabaseClient
      .from('profiles')
      .upsert({
        user_id:currentUser.id,
        email:currentUser.email||'',
        full_name:meta.full_name||meta.name||'',
        avatar_url:meta.avatar_url||meta.picture||'',
        telegram_chat_id:chatId,
        updated_at:new Date().toISOString()
      },{onConflict:'user_id'})
      .select('*')
      .single();

    if(error)throw error;

    currentProfile=data;
    changingTelegramId=false;
    localStorage.setItem(SK,chatId);

    await loadUserData(chatId);

  }catch(e){
    console.error('saveTelegramChatId error:',e);
    if(err)err.textContent='Σφάλμα αποθήκευσης Chat ID: '+(e.message||JSON.stringify(e));
  }finally{
    setAuthLoading(false);
  }
}

function renderAuthState(){
  const googleBox=$('googleLoginBox');
  const telegramBox=$('telegramLinkBox');
  const userBox=$('authUserBox');
  const err=$('authError');

  if(err)err.textContent='';

  if(!currentUser){
    if(googleBox)googleBox.style.display='block';
    if(telegramBox)telegramBox.style.display='none';
    return;
  }

  if(googleBox)googleBox.style.display='none';
  if(telegramBox)telegramBox.style.display='block';

  if(userBox){
    userBox.innerHTML=`
      Συνδέθηκες ως:<br>
      <strong>${esc(currentUser.email||'Google user')}</strong>
    `;
  }

  if(currentProfile?.telegram_chat_id && !changingTelegramId){
    const input=$('chatIdInput');
    if(input)input.value=currentProfile.telegram_chat_id;
  }
}

function setAuthLoading(isLoading){const btn=$('authSubmitBtn');if(!btn)return;btn.disabled=isLoading;btn.textContent=isLoading?'Σύνδεση...':'Σύνδεση'}

function showAuth(message){
  document.body.classList.add('auth-pending');

  const auth=$('authScreen');
  const input=$('chatIdInput');
  const err=$('authError');

  if(auth){
    auth.classList.remove('auth-hidden');
    auth.style.display='flex';
    auth.style.pointerEvents='auto';
    auth.style.opacity='1';
    auth.style.visibility='visible';
    auth.style.zIndex='9999';
  }

  if(err)err.textContent=message||'';
  if(input)setTimeout(()=>input.focus(),80);
}

function hideAuth(){
  document.body.classList.remove('auth-pending');

  const auth=$('authScreen');

  if(auth){
    auth.classList.add('auth-hidden');
    auth.style.display='none';
    auth.style.pointerEvents='none';
    auth.style.opacity='0';
    auth.style.visibility='hidden';
    auth.style.zIndex='-1';
  }
}

async function loadUserData(userId){await fetchAllData(userId);curM=curMK();ensM(curM);render();go('vDash',document.querySelector('[data-v="vDash"]'));hideAuth()}

async function connectWithChatId(ev){
  return saveTelegramChatId(ev);
}

function switchChatId(){

  changingTelegramId=true;

  closeM();

  const input=$('chatIdInput');
  if(input)input.value='';

  showAuth('Σύνδεσε νέο Telegram Chat ID.');
  renderAuthState();

  const btn=$('authSubmitBtn');

  if(btn){
    btn.disabled=false;
    btn.textContent='Σύνδεση Telegram';
  }

  setTimeout(()=>{
    input?.focus();
  },100);
}

function cleanOAuthUrl(){
  if(window.location.search.includes('code=')){
    window.history.replaceState(
      {},
      document.title,
      window.location.origin + window.location.pathname
    );
  }
}

async function initApp(){
  authBooting=true;

  try{
    const {data:{session},error}=await supabaseClient.auth.getSession();

    if(error)throw error;

    currentSession=session;
    currentUser=session?.user||null;

    if(!currentUser){
      showAuth();
      renderAuthState();
      return;
    }

    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=currentProfile?.telegram_chat_id;

    if(!chatId){
      showAuth('Σύνδεσε το Telegram Chat ID σου για να συνεχίσεις.');
      return;
    }

    localStorage.setItem(SK,chatId);
    await loadUserData(chatId);

  }catch(e){
    console.error('Init error:',e);
    showAuth('Σφάλμα φόρτωσης: '+e.message);
    renderAuthState();
  }finally{
    authBooting=false;
  }
}

supabaseClient.auth.onAuthStateChange(async (event,session)=>{
  if(authBooting)return;

  currentSession=session;
  currentUser=session?.user||null;

  if(event==='SIGNED_IN' || event==='INITIAL_SESSION'){
    cleanOAuthUrl();
  }

  if(!currentUser){
    currentProfile=null;
    localStorage.removeItem(SK);
    showAuth();
    renderAuthState();
    return;
  }

  try{
    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=currentProfile?.telegram_chat_id;

    if(!chatId){
      showAuth('Σύνδεσε το Telegram Chat ID σου για να συνεχίσεις.');
      return;
    }

    localStorage.setItem(SK,chatId);
    await loadUserData(chatId);

  }catch(e){
    console.error('Auth state error:',e);
    showAuth('Σφάλμα authentication: '+e.message);
    renderAuthState();
  }
});
// initApp() is called from advisor.js