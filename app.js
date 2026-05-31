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
      detectSessionInUrl:false,
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
let pendingAuthEvent=null;
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
function effectiveCardMinPay(c){
  const balance=Number(c?.balance)||0;
  const enteredMin=Number(c?.minPay)||0;

  if(enteredMin>0)return enteredMin;
  if(balance<=0)return 0;

  // Greek-market fallback: around 2% of balance, with a practical €15 floor.
  return Math.max(balance*0.02,15);
}
function effectiveCardPayment(c){
  const chosen=Number(c?.chosenPay)||0;
  return chosen>0?chosen:effectiveCardMinPay(c);
}
function ccPayTotal(){return(D.creditCards||[]).filter(c=>c.balance>0).reduce((s,c)=>s+effectiveCardPayment(c),0)}
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

function copyTelegramCommand(command='/id'){
  navigator.clipboard.writeText(command)
    .then(()=>{
      showMiniToast(`✅ Το ${command} αντιγράφηκε`);
    })
    .catch(()=>{
      showMiniToast('❌ Δεν έγινε αντιγραφή','error');
    });
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
    showMiniToast('Δεν έχεις επιλέξει εγγραφές','error');
    return;
  }

  const confirmed=await showConfirmModal({
    title:'Μαζική διαγραφή',
    message:`Θέλεις να διαγράψεις ${set.size} εγγραφές;`,
    confirmText:'Διαγραφή'
  });
  
  if(!confirmed)return;

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

    showMiniToast('✅ Οι εγγραφές διαγράφηκαν');

  }catch(e){
    console.error('Bulk delete error:',e);
    showMiniToast(
      '❌ Σφάλμα μαζικής διαγραφής',
      'error'
    );
  }
}

function showMiniToast(message,type='success'){
  let el=$('miniToast');

  if(!el){
    el=document.createElement('div');
    el.id='miniToast';
    el.className='mini-toast';
    document.body.appendChild(el);
  }

  el.textContent=message;
  el.className='mini-toast '+type+' show';

  clearTimeout(window.miniToastTimer);
  window.miniToastTimer=setTimeout(()=>{
    el.classList.remove('show');
  },2500);
}

let confirmResolver=null;

function showConfirmModal({
  title='Επιβεβαίωση',
  message='Είσαι σίγουρος;',
  confirmText='Συνέχεια',
  cancelText='Ακύρωση'
}={}){

  return new Promise(resolve=>{

    confirmResolver=resolve;

    $('confirmTitle').textContent=title;
    $('confirmMessage').textContent=message;

    $('confirmCancelBtn').textContent=cancelText;
    $('confirmConfirmBtn').textContent=confirmText;

    $('confirmOverlay').classList.add('active');
  });
}

function closeConfirmModal(result=false){

  $('confirmOverlay').classList.remove('active');

  if(confirmResolver){
    confirmResolver(result);
    confirmResolver=null;
  }
}

$('confirmCancelBtn')?.addEventListener('click',()=>{
  closeConfirmModal(false);
});

$('confirmConfirmBtn')?.addEventListener('click',()=>{
  closeConfirmModal(true);
});

$('confirmOverlay')?.addEventListener('click',e=>{
  if(e.target.id==='confirmOverlay'){
    closeConfirmModal(false);
  }
});

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
    showMiniToast(
      '❌ Σφάλμα αποθήκευσης',
      'error'
    );
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

function renderSettingsPage(){
  const root=$('vSettings');
  if(!root)return;

  const chatId=localStorage.getItem(SK)||'';
  const months=Object.keys(D.months||{}).sort();
  const dailyCount=Object.values(D.months||{})
    .reduce((sum,m)=>sum+((m.daily||[]).length),0);
  const fixedCount=(D.fixedExpenses||[]).length;
  const cardCount=(D.creditCards||[]).length;
  const incomeCount=(D.incomeSources||[]).length;
  const totalData=dailyCount+fixedCount+cardCount+incomeCount;
  const email=currentUser?.email||currentSession?.user?.email||'';

  const setText=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
  const monthLabel=(mk)=>{
    if(!mk || !mk.includes('-'))return 'Τρέχων μήνας';
    const [y,mo]=mk.split('-');
    return `${MG[(parseInt(mo,10)||1)-1]||''} ${y}`.trim();
  };

  const memberSince=monthLabel(months[0]||curM||curMK());
  const syncKey=typeof getSyncKey==='function'?getSyncKey():'';
  const lastTelegramId=syncKey?localStorage.getItem(syncKey):'';
  const syncLabel=lastTelegramId?'Έχει γίνει sync':'Μετά τον πρώτο συγχρονισμό';

  setText('settingsTelegramState',chatId?'Συνδεδεμένο':'Δεν έχει συνδεθεί');
  setText('settingsTelegramLabel',chatId?'🟢 Συνδεδεμένο':'⚪ Δεν έχει συνδεθεί');
  setText('settingsChatId',chatId||'—');
  setText('settingsTelegramLastSync',syncLabel);
  setText('settingsDataCount',String(totalData));
  setText('settingsMonthCount',String(months.length));
  setText('settingsTxCount',String(dailyCount));
  setText('settingsFixedCount',String(fixedCount));
  setText('settingsIncomeCount',String(incomeCount));
  setText('settingsCardCount',String(cardCount));
  setText('settingsMemberSince',memberSince);

  const account=$('settingsAccountEmail');
  if(account){
    account.textContent=email||'Google account συνδεδεμένο.';
  }
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
  renderDashboardPreview();
  renderMobileCategoryInsights();
  if(typeof renderQuickRepeatChips==='function') renderQuickRepeatChips();
  if($('incomeList')) renderIncomePage();

  rStats();
  rArch();

  if(typeof rCC==='function') rCC();
  if(typeof rAdv==='function') rAdv();

  renderPaymentSourcesSummary();
  renderSettingsPage();
}


function renderFixedList(){
  const ccCards=(D.creditCards||[]).filter(c=>c.balance>0);
  const fixedItems=(D.fixedExpenses||[]).map(e=>({kind:'fixed',data:e}))
    .concat(ccCards.map(c=>({kind:'cc',data:c})));

  const count=fixedItems.length;
  const countEl=$('cFixed');
  const listEl=$('lFixed');
  if(!countEl || !listEl)return;

  countEl.innerHTML=`
    ${count} εγγραφές
    <button class="mini-action" onclick="toggleSelectMode('fixed')">${selectionMode.fixed?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.fixed?`
      <button class="mini-action" onclick="selectAllVisible('fixed')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('fixed')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('fixed')">Διαγραφή</button>
    `:''}
  `;

  if(count===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty tx-v25-fixed-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
        </svg>
        Δεν έχεις πάγια έξοδα ακόμα. Πρόσθεσε νέο πάγιο.
      </div>`;
    return;
  }

  const isMobile=window.innerWidth<=768;
  const visibleLimit=isMobile && !txMobileFixedExpanded ? 5 : fixedItems.length;
  const visibleItems=fixedItems.slice(0,visibleLimit);

  let html='';

  visibleItems.forEach(item=>{
    if(item.kind==='fixed'){
      html+=eRow(item.data,'fixed');
      return;
    }

    const c=item.data;
    const pay=effectiveCardPayment(c);
    html+=`
      <div class="expense-item fadeIn tx-v25-credit-row" onclick="go('vCards',document.querySelector('[data-v=vCards]'))">
        <div class="expense-icon cat-cc">💳</div>
        <div class="expense-info">
          <div class="expense-name">${esc(c.name)} <span class="auto-badge">από Κάρτες</span></div>
          <div class="expense-cat">Δόση πιστωτικής · Χρέος: ${fmt(c.balance)}</div>
        </div>
        <div class="expense-amount is-fixed" style="color:var(--blue)">${fmt(pay)}</div>
      </div>`;
  });

  if(isMobile && fixedItems.length>5){
    html+=`
      <button type="button" class="tx-v25-more-btn tx-v25-fixed-more" onclick="toggleTxMobileFixedExpanded()">
        ${txMobileFixedExpanded?'Λιγότερα':'Προβολή όλων των πάγιων'}
        <span>${txMobileFixedExpanded?'⌃':'⌄'}</span>
      </button>`;
  }

  listEl.innerHTML=html;
}

function toggleTxMobileFixedExpanded(){
  txMobileFixedExpanded=!txMobileFixedExpanded;
  renderFixedList();
}

let mobileTransactionFilter='all';
let txMobileDailyExpanded=false;
let txMobileFixedExpanded=false;

function setMobileTransactionFilter(filter='all'){
  mobileTransactionFilter=filter;
  txMobileDailyExpanded=false;
  document.querySelectorAll('[data-mobile-transaction-filter]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.mobileTransactionFilter===filter);
  });
  renderDailyList();
}

function mobileTransactionMatchesFilter(e){
  const filter=mobileTransactionFilter||'all';
  if(filter==='all' || filter==='expense') return true;

  const dateStr=String(e.date||'');
  if(!dateStr) return true;

  const today=new Date();
  const itemDate=new Date(dateStr+'T12:00:00');

  if(filter==='today'){
    return dateStr===today.toISOString().split('T')[0];
  }

  if(filter==='week'){
    const diff=(today-itemDate)/(1000*60*60*24);
    return diff>=0 && diff<=7;
  }

  return true;
}

function mobileTransactionMatchesSearch(e){
  const input=document.getElementById('mobileTransactionSearch');
  const q=(input?.value||'').trim().toLowerCase();
  if(!q)return true;

  return [e.name,e.category,e.paymentSourceName,e.date]
    .filter(Boolean)
    .some(v=>String(v).toLowerCase().includes(q));
}

function getExpenseByTypeAndId(type,id){
  if(type==='fixed') return (D.fixedExpenses||[]).find(x=>x.id===id);
  const m=D.months[curM]||{daily:[]};
  return (m.daily||[]).find(x=>x.id===id);
}

function showMobileTransactionDetail(type,id){
  if(window.innerWidth>768){
    return (type==='fixed') ? editExp(type,id) : undefined;
  }

  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  txCompleteDetailState={type,id};

  const overlay=document.getElementById('mobileTransactionDetail');
  const content=document.getElementById('mobileTransactionDetailContent');
  if(!overlay || !content)return;

  const category=e.category||'Άλλο';
  const icon=CEMO[category]||'📌';
  const payText=txCompletePaymentText(e,type);
  const amount=Number(e.amount)||0;
  const dateLabel=type==='fixed' ? 'Κάθε μήνα' : txCompleteLongDate(e.date);
  const typeLabel=type==='fixed' ? 'Πάγιο έξοδο' : 'Ημερήσια κίνηση';
  const noteText=e.notes || e.note || '';

  content.innerHTML=`
    <div class="tx-v25-detail-hero">
      <button class="tx-v25-close" type="button" onclick="closeMobileTransactionDetail()" aria-label="Κλείσιμο">×</button>
      <div class="tx-v25-icon ${CCLS[category]||'cat-other'}">${icon}</div>
      <div class="tx-v25-kicker">${typeLabel}</div>
      <h3>${esc(e.name)}</h3>
      <div class="tx-v25-amount">-${fmt(amount)}</div>
      <div class="tx-v25-subtitle">${esc(category)} · ${esc(payText)}</div>
    </div>

    <div class="tx-v25-summary">
      <div class="tx-v25-summary-item">
        <span>Ημερομηνία</span>
        <strong>${esc(dateLabel)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Κατηγορία</span>
        <strong>${esc(category)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Πληρωμή</span>
        <strong>${esc(payText)}</strong>
      </div>
      <div class="tx-v25-summary-item">
        <span>Τύπος</span>
        <strong>${type==='fixed'?'Σταθερό':'Ημερήσιο'}</strong>
      </div>
    </div>

    ${noteText ? `
      <div class="tx-v25-note">
        <span>Σημείωση</span>
        <p>${esc(noteText)}</p>
      </div>
    ` : ''}

    <div class="tx-v25-actions">
      <button type="button" class="tx-v25-action primary" onclick="txCompleteOpenManualForEdit('${type}','${id}')">
        <span>✎</span>
        Επεξεργασία
      </button>
      <button type="button" class="tx-v25-action secondary" onclick="txCompleteOpenManualForDuplicate('${type}','${id}')">
        <span>⧉</span>
        Αντιγραφή
      </button>
      <button type="button" class="tx-v25-action danger" onclick="txCompleteDeleteWithConfirm('${type}','${id}')">
        <span>🗑</span>
        Διαγραφή
      </button>
    </div>
  `;

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}

function closeMobileTransactionDetail(){
  const overlay=document.getElementById('mobileTransactionDetail');
  overlay?.classList.remove('active');
  document.body.classList.remove('sheet-open');
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

  [...m.daily]
    .filter(e=>mobileTransactionMatchesSearch(e) && mobileTransactionMatchesFilter(e))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id||'').localeCompare(String(a.id||'')))
    .forEach(e=>{
      if(!grouped[e.date]) grouped[e.date]=[];
      grouped[e.date].push(e);
    });

  if(Object.keys(grouped).length===0){
    $('lDaily').innerHTML=`
      <div class="empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <path d="M7.5 4.21l4.5 2.6 4.5-2.6"/>
          <path d="M7.5 19.79V14.6L3 12"/>
          <path d="M21 12l-4.5 2.6v5.19"/>
        </svg>
        Δεν υπάρχουν κινήσεις με αυτά τα φίλτρα.
      </div>`;
    return;
  }

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


function renderMobileCategoryInsights(){
  const donut = $('mobileCategoryDonut');
  const list = $('mobileCategoryList');
  const totalEl = $('mobileCategoryTotal');

  if(!donut || !list || !totalEl) return;

  const m = D.months[curM] || {daily:[]};
  const totals = {};

  (m.daily || []).forEach(e=>{
    const cat = e.category || 'Άλλο';
    totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
  });

  const rows = Object.entries(totals)
    .map(([category,total])=>({category,total}))
    .filter(x=>x.total>0)
    .sort((a,b)=>b.total-a.total)
    .slice(0,5);

  const total = rows.reduce((s,x)=>s+x.total,0);
  totalEl.textContent = fmt(total);

  if(total<=0 || rows.length===0){
    donut.style.background = 'conic-gradient(#eef2ff 0deg 360deg)';
    list.innerHTML = `
      <div class="mobile-category-empty">
        Δεν υπάρχουν ημερήσια έξοδα για γράφημα ακόμα.
      </div>
    `;
    return;
  }

  let start = 0;
  const segments = rows.map(row=>{
    const pct = row.total / total;
    const end = start + pct * 360;
    const color = CCLR[row.category] || '#8b5cf6';
    const segment = `${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    start = end;
    return segment;
  });

  if(start < 360){
    segments.push(`#e8edf7 ${start.toFixed(2)}deg 360deg`);
  }

  donut.style.background = `conic-gradient(${segments.join(',')})`;

  list.innerHTML = rows.map(row=>{
    const pct = Math.round((row.total / total) * 100);
    const color = CCLR[row.category] || '#8b5cf6';
    return `
      <div class="mobile-category-row">
        <span class="mobile-category-dot" style="background:${color}"></span>
        <span class="mobile-category-name">${esc(row.category)}</span>
        <span class="mobile-category-pct">${pct}%</span>
        <strong>${fmt(row.total)}</strong>
      </div>
    `;
  }).join('');
}

function renderDashboardPreview(){
  const el = $('dashRecentList');
  if(!el)return;

  const m = D.months[curM] || {daily:[]};
  const recent = [...(m.daily || [])]
    .sort((a,b)=>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      String(b.id || '').localeCompare(String(a.id || ''))
    )
    .slice(0,5);

  if(recent.length === 0){
    el.innerHTML = `
      <div class="empty mini-empty">
        Δεν υπάρχουν πρόσφατες κινήσεις για αυτόν τον μήνα.
      </div>
    `;
    return;
  }

  el.innerHTML = recent.map(e => `
    <div class="dashboard-preview-row">
      <div class="expense-icon ${CCLS[e.category] || 'cat-other'}">
        ${CEMO[e.category] || '📌'}
      </div>

      <div class="dashboard-preview-info">
        <strong>${esc(e.name)}</strong>
        <span>${esc(e.category)} · ${e.date || ''}</span>
      </div>

      <div class="dashboard-preview-amount">
        -${fmt(e.amount)}
      </div>
    </div>
  `).join('');
}

function paymentSourceExists(id){
  if(!id)return true;

  return (D.incomeSources||[]).some(i=>i.id===id);
}

function eRow(e,t){
  const category=e.category||'Άλλο';
  const c=CCLS[category]||'cat-other';
  const em=CEMO[category]||'📌';
  const isSelected=t==='fixed'?selectedFixed.has(e.id):selectedDaily.has(e.id);
  const showSelect=selectionMode[t];

  return `
    <div class="expense-item fadeIn ${isSelected?'selected-row':''}" onclick="${!showSelect?`showMobileTransactionDetail('${t}','${e.id}')`:''}">
      ${showSelect?`
        <label class="select-box" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('${t}','${e.id}',this.checked)">
        </label>`:''}

      <div class="expense-icon ${c}">${em}</div>

      <div class="expense-info">
        <div class="expense-name">${esc(e.name)}</div>
        <div class="expense-cat">
          ${esc(category)}
          ${t==='daily' && e.paymentSourceName
            ? ` <span class="payment-badge ${paymentSourceExists(e.paymentSourceId)?'':'deleted'}">
                  💳 ${esc(e.paymentSourceName)}${paymentSourceExists(e.paymentSourceId)?'':' (διαγραμμένο)'}
                </span>`
            : ''
          }
        </div>
      </div>

      <div class="expense-amount ${t==='fixed'?'is-fixed':'is-daily'}">${t==='fixed'?fmt(e.amount):'-'+fmt(e.amount)}</div>
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

        <div class="expense-actions" onclick="event.stopPropagation()">
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
  $('mIncomeSourceTitle').textContent='Επεξεργασία πηγής εισοδήματος';

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

  $('btnIncomeSource').textContent='Ενημέρωση πηγής';
  document.body.classList.add('modal-open');
  refreshIncomeCustomPickers();
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
    showMiniToast(
      '❌ Δεν βρέθηκε Telegram σύνδεση',
      'error'
    );
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
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση';
    }
  }
}

async function deleteIncomeSource(id){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή εισοδήματος',
    message:'Θέλεις να διαγράψεις αυτή την πηγή εισοδήματος;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  try{
    await deleteIncomeSourceRow(id);

    D.incomeSources=(D.incomeSources||[]).filter(i=>i.id!==id);

    refreshComputedIncome();
    render();

    showMiniToast('✅ Η πηγή εισοδήματος διαγράφηκε');

  }catch(e){
    console.error('deleteIncomeSource failed:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

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


// ===== INCOME SOURCE CUSTOM PICKERS =====
const INCOME_PICKER_META={
  fISCategory:{
    'Μισθός':['💼','Σταθερό μηνιαίο εισόδημα'],
    'Bonus':['🎁','Έκτακτη επιβράβευση'],
    'Ενοίκιο':['🏠','Έσοδο από ακίνητο'],
    'Ticket Restaurant':['🍽️','Voucher για φαγητό'],
    'Άυλη κάρτα':['💳','Ψηφιακή κάρτα / benefit'],
    'Μερίσματα':['📈','Επενδυτικό εισόδημα'],
    'Freelance':['💻','Ελεύθερη εργασία'],
    'Δώρο':['🎀','Έκτακτο ποσό'],
    'Άλλο':['✨','Προσαρμοσμένη πηγή']
  },
  fISType:{
    bank:['🏦','Κατάθεση σε λογαριασμό'],
    cash:['💶','Μετρητά'],
    voucher:['🎫','Ticket / voucher balance'],
    card:['💳','Κάρτα ή prepaid'],
    investment:['📊','Επένδυση / απόδοση']
  },
  fISRestriction:{
    none:['🔓','Μπαίνει ελεύθερα στο budget'],
    food_only:['🍽️','Χρήση μόνο για φαγητό'],
    card_only:['💳','Χρήση μόνο με κάρτα'],
    locked:['🔒','Δεν ξοδεύεται ελεύθερα'],
    investment:['📈','Πηγαίνει σε επένδυση']
  },
  fISRestrictedCategory:{
    '':['✨','Δεν αφορά συγκεκριμένη κατηγορία'],
    'Τρόφιμα':['🛒','Super market / τρόφιμα'],
    'Φαγητό έξω':['🍕','Delivery / εστιατόρια'],
    'Μεταφορά':['🚗','Καύσιμα / μετακινήσεις'],
    'Στέγαση':['🏠','Σπίτι / ενοίκιο'],
    'Λογαριασμοί':['💡','Ρεύμα / internet / λοιπά'],
    'Υγεία':['🏥','Ιατρικά / φαρμακείο'],
    'Άλλο':['📌','Λοιπές κινήσεις']
  }
};

function incomePickerOptionMeta(selectId,value,label){
  const meta=INCOME_PICKER_META?.[selectId]?.[value] || INCOME_PICKER_META?.[selectId]?.[label];
  return meta || ['•','Επιλογή'];
}

function syncIncomeCustomPicker(select){
  if(!select)return;
  const picker=document.querySelector(`[data-income-picker-for="${select.id}"]`);
  if(!picker)return;

  const selected=select.options[select.selectedIndex] || select.options[0];
  const value=selected?.value ?? '';
  const label=selected?.textContent?.trim() || value;
  const [icon,desc]=incomePickerOptionMeta(select.id,value,label);

  picker.querySelector('.income-picker-icon').textContent=icon;
  picker.querySelector('.income-picker-title').textContent=label;
  picker.querySelector('.income-picker-desc').textContent=desc;

  picker.querySelectorAll('.income-picker-option').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.value===value);
  });
}

function closeIncomeCustomPickers(except=null){
  document.querySelectorAll('.income-custom-picker.is-open').forEach(picker=>{
    if(picker!==except)picker.classList.remove('is-open');
  });
}

function setupIncomeCustomPicker(selectId){
  const select=$(selectId);
  if(!select || select.dataset.incomePickerReady==='1')return;

  select.dataset.incomePickerReady='1';
  select.classList.add('income-native-select');

  const picker=document.createElement('div');
  picker.className='income-custom-picker';
  picker.dataset.incomePickerFor=selectId;

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='income-picker-trigger';
  trigger.innerHTML=`
    <span class="income-picker-icon">•</span>
    <span class="income-picker-copy">
      <strong class="income-picker-title"></strong>
      <small class="income-picker-desc"></small>
    </span>
    <span class="income-picker-chevron">⌄</span>
  `;

  const menu=document.createElement('div');
  menu.className='income-picker-menu';

  Array.from(select.options).forEach(option=>{
    const value=option.value;
    const label=option.textContent.trim();
    const [icon,desc]=incomePickerOptionMeta(selectId,value,label);

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='income-picker-option';
    btn.dataset.value=value;
    btn.innerHTML=`
      <span>${icon}</span>
      <span><strong>${esc(label)}</strong><small>${esc(desc)}</small></span>
    `;
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      syncIncomeCustomPicker(select);
      picker.classList.remove('is-open');
    });
    menu.appendChild(btn);
  });

  trigger.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    const willOpen=!picker.classList.contains('is-open');
    closeIncomeCustomPickers(picker);
    picker.classList.toggle('is-open',willOpen);
  });

  select.addEventListener('change',()=>syncIncomeCustomPicker(select));

  picker.appendChild(trigger);
  picker.appendChild(menu);
  select.insertAdjacentElement('afterend',picker);
  syncIncomeCustomPicker(select);
}

function setupIncomeCustomPickers(){
  ['fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(setupIncomeCustomPicker);
}

function refreshIncomeCustomPickers(){
  setupIncomeCustomPickers();
  ['fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>syncIncomeCustomPicker($(id)));
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.income-custom-picker'))closeIncomeCustomPickers();
});

// ===== MODALS / SAVE ACTIONS / NAV / AUTH =====
function closeM(){
  document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active'));
  closeIncomeCustomPickers?.();
  document.body.classList.remove('modal-open');
}

function openModal(t){
  closeM();
  document.body.classList.add('modal-open');

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
    $('mCCTitle').textContent='Νέα κάρτα';
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
    $('mIncomeSourceTitle').textContent='Νέα πηγή εισοδήματος';

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
    $('btnIncomeSource').textContent='Αποθήκευση πηγής';

    refreshIncomeCustomPickers();
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
    showMiniToast(
      '❌ Σύνδεσε πρώτα το Telegram',
      'error'
    );
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
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

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
    showMiniToast(
      '❌ Σύνδεσε πρώτα το Telegram',
      'error'
    );
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
    showMiniToast(
      '❌ Αποτυχία αποθήκευσης',
      'error'
    );

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

  const confirmed=await showConfirmModal({
    title:'Διαγραφή εξόδου',
    message:'Θέλεις να διαγράψεις αυτή την εγγραφή;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

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

    showMiniToast('✅ Η εγγραφή διαγράφηκε');

  }catch(e){
    console.error('Delete error:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

let quickVoiceRecognition=null;
let quickVoiceListening=false;

function getSpeechRecognition(){
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function setQuickVoiceState(isListening){
  quickVoiceListening=isListening;

  const btn=$('quickVoiceBtn');
  if(!btn)return;

  btn.textContent=isListening?'⏹️':'🎤';
  btn.classList.toggle('listening',isListening);
}

function startQuickVoice(targetInputId='quickAddInput'){
  const Recognition=getSpeechRecognition();

  if(!Recognition){
    showMiniToast(
      '❌ Ο browser δεν υποστηρίζει voice input',
      'error'
    );
    return;
  }

  if(quickVoiceListening && quickVoiceRecognition){
    quickVoiceRecognition.stop();
    return;
  }

  const input=$(targetInputId) || $('quickAddInput');

  quickVoiceRecognition=new Recognition();
  quickVoiceRecognition.lang='el-GR';
  quickVoiceRecognition.interimResults=false;
  quickVoiceRecognition.maxAlternatives=1;
  quickVoiceRecognition.continuous=false;

  quickVoiceRecognition.onstart=()=>{
    setQuickVoiceState(true);
  };

  quickVoiceRecognition.onresult=e=>{
    const text=e.results?.[0]?.[0]?.transcript||'';

    if(input && text){
      input.value=text;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
    }
  };

  quickVoiceRecognition.onerror=e=>{
    console.warn('Voice recognition error:',e.error);

    if(e.error==='not-allowed'){

      showMiniToast(
        '❌ Δεν δόθηκε άδεια μικροφώνου',
        'error'
      );
    
    }else{
    
      showMiniToast(
        '❌ Δεν μπόρεσα να ακούσω καθαρά',
        'error'
      );
    }
  };

  quickVoiceRecognition.onend=()=>{
    setQuickVoiceState(false);
  };

  quickVoiceRecognition.start();
}

function setQuickAddInlineError(message,targetId='quickAddError'){
  const el=document.getElementById(targetId);
  if(!el)return;

  el.classList.add('visible');
  el.classList.remove('hidden');

  el.innerHTML=`
    <span class="quick-add-error-icon">⚠️</span>
    <span>${esc(message)}</span>
  `;
}

function clearQuickAddInlineError(targetId='quickAddError'){
  const el=document.getElementById(targetId);
  if(!el)return;

  el.classList.remove('visible');
  el.classList.add('hidden');
  el.innerHTML='';
}

function getQuickAddParsed(text){
  const value=(text||'').trim();
  if(!value)return null;

  if(typeof quickAddPreviewData==='function'){
    return quickAddPreviewData(value);
  }

  if(typeof parseExpense==='function'){
    try{
      return parseExpense(value);
    }catch(e){
      console.warn('quick add parser failed',e);
      return null;
    }
  }

  return null;
}

async function quickAddExpense(sourceInputId='quickAddInput',options={}){
  const input=$(sourceInputId) || $('quickAddInput');
  const text=(input?.value||'').trim();
  const isSheet=sourceInputId==='quickAddSheetInput';
  const errorTarget=options.errorTarget || (isSheet ? 'quickAddSheetError' : null);
  const fallbackToSheet=!!options.fallbackToSheet;

  if(errorTarget) clearQuickAddInlineError(errorTarget);

  if(!text){
    input?.focus();
    return false;
  }

  const parsed=getQuickAddParsed(text);
  const invalidMessage='Δεν βρέθηκε έγκυρο ποσό. Δοκίμασε π.χ. “καφές 3”.';

  if(!parsed || !Number(parsed.amount)){
    if(fallbackToSheet && !isSheet && typeof openQuickAddSheet==='function'){
      openQuickAddSheet(text,invalidMessage);
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      return false;
    }

    if(errorTarget){
      setQuickAddInlineError(invalidMessage,errorTarget);
    }else{
      showMiniToast('⚠️ Γράψε ποσό, π.χ. καφές 3','error');
    }

    input?.focus();
    return false;
  }

  const userId=localStorage.getItem(SK);

  if(!userId){
    const message='Σύνδεσε πρώτα το Telegram/Google για να αποθηκευτεί το έξοδο.';

    if(errorTarget){
      setQuickAddInlineError(message,errorTarget);
    }else{
      showMiniToast('❌ Δεν υπάρχει ενεργή σύνδεση','error');
    }

    return false;
  }

  const expense={
    id:gid(),
    name:parsed.name || 'Έξοδο',
    amount:Number(parsed.amount)||0,
    category:parsed.category || 'Άλλο',
    date:parsed.date||new Date().toISOString().split('T')[0],
    paymentSourceId:parsed.paymentSourceId||'',
    paymentSourceName:parsed.paymentSourceName||'',
    paymentSourceType:parsed.paymentSourceType||''
  };

  const monthKey=expense.date.substring(0,7);
  ensM(monthKey);

  try{
    D.months[monthKey].daily.push(expense);

    await saveDailyExpenseRow(userId,expense);

    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    curM=monthKey;

    if(errorTarget) clearQuickAddInlineError(errorTarget);

    render();
    showMiniToast('✅ Το έξοδο προστέθηκε');

    return true;

  }catch(e){
    D.months[monthKey].daily=D.months[monthKey].daily.filter(x=>x.id!==expense.id);

    console.error('quickAddExpense failed:',e);

    if(errorTarget){
      setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.',errorTarget);
    }else{
      showMiniToast('❌ Δεν μπόρεσα να αποθηκεύσω το έξοδο','error');
    }

    return false;
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
        showMiniToast(
          '❌ Μη έγκυρο αρχείο',
          'error'
        );
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
      showMiniToast('✅ Η εισαγωγή ολοκληρώθηκε');

    }catch(err){
      console.error('Import error:',err);
      showMiniToast(
        '❌ Σφάλμα εισαγωγής',
        'error'
      );
    }
  };

  r.readAsText(f);
  ev.target.value='';
}

async function doReset(){

  const confirmed=await showConfirmModal({
    title:'Διαγραφή δεδομένων',
    message:'Θέλεις να διαγράψεις όλα τα δεδομένα σου;',
    confirmText:'Διαγραφή'
  });

  if(!confirmed)return;

  const doubleConfirmed=await showConfirmModal({
    title:'Τελική επιβεβαίωση',
    message:'Η ενέργεια δεν αναιρείται.',
    confirmText:'Οριστική διαγραφή'
  });

  if(!doubleConfirmed)return;

  try{

    localStorage.removeItem(SK);

    showMiniToast('✅ Τα δεδομένα διαγράφηκαν');

    setTimeout(()=>{
      location.reload();
    },900);

  }catch(e){

    console.error('Reset failed:',e);

    showMiniToast(
      '❌ Σφάλμα διαγραφής',
      'error'
    );
  }
}

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeM();

  if(e.key==='Enter'){

    if(document.activeElement&&document.activeElement.id==='quickAddInput'){
      quickAddExpense('quickAddInput',{fallbackToSheet:true});
      return;
    }

    if($('authScreen')&&document.body.classList.contains('auth-pending')){
      if(document.activeElement&&document.activeElement.id==='chatIdInput'){
        connectWithChatId(e);
      }
      return;
    }

    if($('mDaily').classList.contains('active'))saveDaily();
    if($('mFixed').classList.contains('active'))saveFixed();
    if($('mCC').classList.contains('active'))saveCC();
  }
});

document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeM()}));
['fDN','fDA','fFN','fFA','fCCN'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',function(){this.style.borderColor=''})});

function go(v,b){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));

  const target=$(v);
  if(target)target.classList.add('active');

  const mobileMoreViews=new Set(['vCards','vAdvisor','vStats','vArchive','vSettings']);
  const activeNavView=mobileMoreViews.has(v) ? 'vMore' : v;

  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll(`.nav-btn[data-v="${activeNavView}"]`).forEach(el=>el.classList.add('active'));

  if(b && b.classList && b.classList.contains('nav-btn')){
    b.classList.add('active');
  }
}
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
    await supabaseClient.auth.signOut({
      scope:'global'
    });
  }catch(e){
    console.warn('Supabase signOut failed:',e);
  }

  try{
    localStorage.removeItem(SK);
    localStorage.removeItem('expense-hero-auth');
    localStorage.removeItem('expense-hero-auth-code-verifier');

    Object.keys(localStorage)
      .filter(k=>k.startsWith('sb-') || k.includes('supabase'))
      .forEach(k=>localStorage.removeItem(k));

    sessionStorage.clear();

  }catch(e){
    console.warn('Storage cleanup failed:',e);
  }

  currentSession=null;
  currentUser=null;
  currentProfile=null;

  window.location.href=window.location.origin+window.location.pathname;
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
  const codeInput=$('telegramCodeInput');
  const err=$('authError');

  const chatId=(input?.value||'').trim();
  const code=(codeInput?.value||'').trim();

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

  if(!code){
    if(err)err.textContent='Βάλε τον κωδικό σύνδεσης από το Telegram.';
    codeInput?.focus();
    return;
  }

  if(!/^\d{6}$/.test(code)){
    if(err)err.textContent='Ο κωδικός πρέπει να είναι 6 ψηφία.';
    codeInput?.focus();
    return;
  }

  setAuthLoading(true);

  try{
    const token=currentSession?.access_token;

    if(!token){
      throw new Error('Δεν υπάρχει ενεργό session.');
    }

    const workerUrl=(CONFIG.WORKER_URL||'').replace(/\/+$/,'');
    const verifyUrl=`${workerUrl}/verify-link`;

    console.log('verify-link url:', `${workerUrl}/verify-link`);

    const res=await fetch(verifyUrl,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+token
      },
      body:JSON.stringify({
        chat_id:chatId,
        code
      })
    });

    const data=await res.json();

    if(!res.ok || data.error){
      throw new Error(data.error||'Verification failed');
    }

    currentProfile=data.profile;
    changingTelegramId=false;
    localStorage.setItem(SK,chatId);

    const btn=$('authSubmitBtn');

    if(btn){
      btn.disabled=true;
      btn.innerHTML='⏳ Σύνδεση...';
    }

    showMiniToast('✅ Το Telegram συνδέθηκε');

    await new Promise(r=>setTimeout(r,1400));

    window.location.reload();

    return;

  }catch(e){
    console.error('saveTelegramChatId error:',e);

    if(err){
      err.textContent='Δεν έγινε επιβεβαίωση. Έλεγξε Chat ID και κωδικό.';
    }
  }finally{
    setAuthLoading(false);
  }
}

function showApp(){
  document.body.classList.remove('auth-pending');

  const auth=$('authScreen');

  if(auth){
    auth.classList.add('auth-hidden');
    auth.style.display='none';
    auth.style.pointerEvents='none';
    auth.style.opacity='0';
    auth.style.visibility='hidden';
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

async function handleOAuthCallback(){
  const url=new URL(window.location.href);
  const code=url.searchParams.get('code');

  if(!code)return null;

  try{
    const {data,error}=await supabaseClient.auth.exchangeCodeForSession(code);

    cleanOAuthUrl();

    if(error){
      console.error('OAuth exchange failed:',error);
      return null;
    }

    return data?.session||null;

  }catch(e){
    console.error('OAuth exchange failed:',e);

    cleanOAuthUrl();

    return null;
  }
}

async function saveTelegramLinkRequest(row, env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/telegram_link_requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        chat_id: row.chat_id,
        code: row.code
      })
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Telegram link request insert failed: ' + txt);
  }
}

async function initApp(){
  authBooting=true;

  try{
    const callbackSession=await handleOAuthCallback();

    let session=callbackSession;

    if(!session){
      const result=await supabaseClient.auth.getSession();

      if(result.error)throw result.error;

      session=result.data?.session||null;
    }

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

function quickAddFallbackParse(text){
  const raw=(text||'').trim();
  const amountMatch=raw.match(/(\d+[,.]?\d*)/);
  if(!amountMatch)return null;

  const amount=Number(amountMatch[1].replace(',','.'))||0;
  if(amount<=0)return null;

  const name=raw.replace(amountMatch[0],'').replace(/\b(ticket|voucher|κάρτα|card|μετρητά|cash)\b/gi,'').trim() || 'Έξοδο';
  const lower=raw.toLowerCase();

  let category='Άλλο';
  if(/καφ|coffee/.test(lower)) category='Καφέδες';
  else if(/σουπερ|super|market|μάρκετ|ψώνια/.test(lower)) category='Τρόφιμα';
  else if(/φαγη|food|burger|pizza|πίτσα|σουβλ/.test(lower)) category='Φαγητό έξω';
  else if(/βενζ|καυσ|ταξι|taxi|μεταφ/.test(lower)) category='Μεταφορά';

  let paymentSourceName='';
  if(/ticket|voucher/.test(lower)) paymentSourceName='Ticket';
  else if(/καρτα|κάρτα|card/.test(lower)) paymentSourceName='Κάρτα';
  else if(/cash|μετρη/.test(lower)) paymentSourceName='Μετρητά';

  return {name,amount,category,paymentSourceName};
}

function quickAddPreviewData(text){
  const value=(text||'').trim();
  if(!value)return null;

  if(typeof parseExpense==='function'){
    try{
      const parsed=parseExpense(value);
      if(parsed)return parsed;
    }catch(e){
      console.warn('quick preview parser failed',e);
    }
  }

  return quickAddFallbackParse(value);
}

function renderSmartQuickPreview(targetId,text){
  const el=document.getElementById(targetId);
  if(!el)return;

  const value=(text||'').trim();
  const parsed=quickAddPreviewData(value);

  if(!value){
    el.classList.remove('visible','invalid');
    el.innerHTML='';
    return;
  }

  if(!parsed){
    el.classList.add('visible','invalid');
    el.innerHTML=`
      <div class="smart-preview-icon">?</div>
      <div class="smart-preview-main">
        <strong>Δεν βρήκα ποσό</strong>
        <span>Δοκίμασε κάτι σαν “καφές 3”</span>
      </div>
    `;
    return;
  }

  const icon=(typeof CEMO!=='undefined' && CEMO[parsed.category]) ? CEMO[parsed.category] : '📌';
  const amount=(typeof fmt==='function') ? fmt(parsed.amount) : `€${Number(parsed.amount||0).toFixed(2)}`;
  const payment=parsed.paymentSourceName || 'Budget';

  el.classList.add('visible');
  el.classList.remove('invalid');
  el.innerHTML=`
    <div class="smart-preview-icon">${icon}</div>
    <div class="smart-preview-main">
      <strong>${esc(parsed.name || 'Έξοδο')}</strong>
      <span>${esc(parsed.category || 'Άλλο')} · ${esc(payment)}</span>
    </div>
    <div class="smart-preview-amount">-${amount}</div>
  `;
}

function renderQuickRepeatChips(){
  const el=document.getElementById('quickRepeatChips');
  if(!el || typeof D==='undefined' || typeof curM==='undefined')return;

  const daily=(D.months[curM]?.daily || [])
    .slice()
    .sort((a,b)=>String(b.id||'').localeCompare(String(a.id||'')))
    .slice(0,3);

  if(daily.length===0){
    el.innerHTML='';
    return;
  }

  el.innerHTML=daily.map(e=>{
    const text=`${e.name} ${String(Number(e.amount)||0).replace('.',',')}`;
    return `<button type="button" onclick="fillQuickAdd('${esc(text)}')">+ ${esc(e.name)} ${fmt(e.amount)}</button>`;
  }).join('');
}

function fillQuickAdd(text){
  const input=document.getElementById('quickAddInput');
  if(!input)return;
  input.value=text;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus();
}

function setupQuickAddMobileState(){
  const input=document.getElementById('quickAddInput');

  if(input){
    const sync=()=>{
      // Dashboard quick add is intentionally minimal:
      // input + voice + chips only. No preview, no inline error, no large submit button.
    };

    input.addEventListener('input',sync);
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        quickAddExpense('quickAddInput',{fallbackToSheet:true});
      }
    });
    sync();
  }

  const sheetInput=document.getElementById('quickAddSheetInput');
  const sheetSubmit=document.getElementById('quickAddSheetSubmit');

  if(sheetInput){
    const syncSheet=()=>{
      const hasValue=sheetInput.value.trim().length>0;
      sheetSubmit?.classList.toggle('is-visible',hasValue);
      renderSmartQuickPreview('quickAddSheetPreview',sheetInput.value);
      if(hasValue) clearQuickAddInlineError('quickAddSheetError');
    };

    sheetInput.addEventListener('input',syncSheet);
    sheetInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        e.stopPropagation();
        submitQuickAddSheet();
      }
    });
    syncSheet();
  }

  renderQuickRepeatChips();
}

function openQuickAddSheet(prefill='',errorMessage=''){
  const sheet=document.getElementById('quickAddSheet');
  const input=document.getElementById('quickAddSheetInput');
  if(!sheet)return;

  sheet.classList.add('active');
  document.body.classList.add('quick-sheet-open');

  if(input && typeof prefill==='string' && prefill.trim()){
    input.value=prefill.trim();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  clearQuickAddInlineError('quickAddSheetError');

  if(errorMessage){
    setQuickAddInlineError(errorMessage,'quickAddSheetError');
  }

  setTimeout(()=>input?.focus(),120);
}

function closeQuickAddSheet(event){
  if(event && event.target && event.target.id!=='quickAddSheet')return;

  const sheet=document.getElementById('quickAddSheet');
  sheet?.classList.remove('active');
  document.body.classList.remove('quick-sheet-open');
}

function fillQuickAddSheet(text){
  const input=document.getElementById('quickAddSheetInput');
  if(!input)return;
  input.value=text;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus();
}

async function submitQuickAddSheet(){
  const sheetInput=document.getElementById('quickAddSheetInput');

  clearQuickAddInlineError('quickAddSheetError');

  const text=(sheetInput?.value || '').trim();

  if(!text){
    sheetInput?.focus();
    return false;
  }

  const saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});

  if(!saved){
    return false;
  }

  if(sheetInput){
    sheetInput.value='';
    sheetInput.dispatchEvent(new Event('input',{bubbles:true}));
  }

  closeQuickAddSheet();
  return true;
}

document.addEventListener('DOMContentLoaded', setupQuickAddMobileState);
// initApp() is called from advisor.js

// ===== ADD CENTER V1 — Quick / Αναλυτικό tabs =====
function addCenterToday(){
  return new Date().toISOString().split('T')[0];
}

function fillAddCenterPaymentSources(selectedId=''){
  const el=document.getElementById('acDPay');
  if(!el)return;

  const sources=(typeof availablePaymentSources==='function')
    ? availablePaymentSources()
    : [];

  el.innerHTML=`
    <option value="">Κανονικό budget</option>
    ${sources.map(s=>`
      <option value="${esc(s.id)}" ${s.id===selectedId?'selected':''}>${esc(s.name)}</option>
    `).join('')}
  `;

  if(selectedId){
    el.value=selectedId;
  }

  renderAddCenterPaymentPicker();
  syncAddCenterPaymentPicker();
}

function paymentSourceLabelById(id){
  if(!id)return 'Κανονικό budget';

  const source=(typeof paymentSourceById==='function')
    ? paymentSourceById(id)
    : (D.incomeSources||[]).find(s=>s.id===id);

  return source?.name || 'Πηγή πληρωμής';
}

function paymentSourceIconById(id){
  if(!id)return '💶';

  const source=(typeof paymentSourceById==='function')
    ? paymentSourceById(id)
    : (D.incomeSources||[]).find(s=>s.id===id);

  if(source?.restriction && source.restriction!=='none')return '🎫';
  if(source?.isSavings)return '🏦';
  if(source?.incomeType==='card')return '💳';
  return '💰';
}

function closeAddCenterPaymentPicker(){
  const list=document.getElementById('acDPayCustomList');
  const btn=document.getElementById('acDPayCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}

function renderAddCenterPaymentPicker(){
  const list=document.getElementById('acDPayCustomList');
  const select=document.getElementById('acDPay');
  if(!list || !select)return;

  const options=[...select.options].map(option=>({
    id:option.value,
    label:option.textContent || 'Πηγή πληρωμής'
  }));

  list.innerHTML=options.map(option=>`
    <button type="button" data-payment-id="${esc(option.id)}" onclick="selectAddCenterPaymentSource('${esc(option.id)}')">
      <span>${paymentSourceIconById(option.id)}</span>
      <strong>${esc(option.label)}</strong>
    </button>
  `).join('');
}

function syncAddCenterPaymentPicker(){
  const select=document.getElementById('acDPay');
  const text=document.getElementById('acDPayCustomText');
  const icon=document.getElementById('acDPayCustomIcon');
  const list=document.getElementById('acDPayCustomList');
  if(!select)return;

  const value=select.value || '';
  if(text)text.textContent=paymentSourceLabelById(value);
  if(icon)icon.textContent=paymentSourceIconById(value);

  list?.querySelectorAll('button').forEach(btn=>{
    btn.classList.toggle('active',(btn.dataset.paymentId||'')===value);
  });
}

function toggleAddCenterPaymentPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();

  closeAddCenterCategoryPicker();

  const list=document.getElementById('acDPayCustomList');
  const btn=document.getElementById('acDPayCustom');
  if(!list || !btn)return;

  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}

function selectAddCenterPaymentSource(id=''){
  const select=document.getElementById('acDPay');
  if(!select)return;

  select.value=id;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  syncAddCenterPaymentPicker();
  closeAddCenterPaymentPicker();
  clearQuickAddInlineError('addCenterManualError');
}

function addCenterCategoryEmoji(category){
  if(typeof CEMO!=='undefined' && CEMO[category])return CEMO[category];

  return {
    'Τρόφιμα':'🛒',
    'Καφέδες':'☕',
    'Μεταφορά':'🚗',
    'Ψυχαγωγία':'🎭',
    'Φαγητό έξω':'🍕',
    'Λογαριασμοί':'💡',
    'Υγεία':'🏥',
    'Ρούχα':'👕',
    'Δάνεια':'🏦',
    'Συνδρομές':'📱',
    'Άλλο':'📌'
  }[category] || '📌';
}

function closeAddCenterCategoryPicker(){
  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}

function syncAddCenterCategoryPicker(){
  const select=document.getElementById('acDC');
  const text=document.getElementById('acDCCustomText');
  const icon=document.getElementById('acDCCustomIcon');
  const list=document.getElementById('acDCCustomList');
  if(!select)return;

  const value=select.value || 'Τρόφιμα';
  if(text)text.textContent=value;
  if(icon)icon.textContent=addCenterCategoryEmoji(value);

  list?.querySelectorAll('button').forEach(btn=>{
    const isActive=(btn.textContent || '').includes(value);
    btn.classList.toggle('active',isActive);
  });
}

function toggleAddCenterCategoryPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();

  closeAddCenterPaymentPicker();

  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  if(!list || !btn)return;

  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}

function selectAddCenterCategory(category){
  const select=document.getElementById('acDC');
  if(!select)return;

  select.value=category;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  syncAddCenterCategoryPicker();
  closeAddCenterCategoryPicker();
  clearQuickAddInlineError('addCenterManualError');
}

function resetAddCenterManualForm(){
  const name=document.getElementById('acDN');
  const amount=document.getElementById('acDA');
  const cat=document.getElementById('acDC');
  const date=document.getElementById('acDD');
  const notes=document.getElementById('acDNotes');

  if(name)name.value='';
  if(amount)amount.value='';
  if(cat)cat.value='Τρόφιμα';
  syncAddCenterCategoryPicker();
  closeAddCenterCategoryPicker();
  closeAddCenterPaymentPicker();
  if(date)date.value=addCenterToday();
  if(notes)notes.value='';

  fillAddCenterPaymentSources('');
  clearQuickAddInlineError('addCenterManualError');
}

function switchAddCenterTab(tab='quick'){
  const quickTab=document.getElementById('addCenterQuickTab');
  const manualTab=document.getElementById('addCenterManualTab');
  const quickPanel=document.getElementById('addCenterQuickPanel');
  const manualPanel=document.getElementById('addCenterManualPanel');
  const isManual=tab==='manual';

  quickTab?.classList.toggle('active',!isManual);
  manualTab?.classList.toggle('active',isManual);
  quickPanel?.classList.toggle('active',!isManual);
  manualPanel?.classList.toggle('active',isManual);

  quickTab?.setAttribute('aria-selected',String(!isManual));
  manualTab?.setAttribute('aria-selected',String(isManual));

  setTimeout(()=>{
    if(isManual){
      document.getElementById('acDN')?.focus();
    }else{
      document.getElementById('quickAddSheetInput')?.focus();
    }
  },80);
}

function renderAddCenterRecentChips(){
  const el=document.getElementById('addCenterRecentChips');
  if(!el || typeof D==='undefined' || typeof curM==='undefined')return;

  const daily=(D.months?.[curM]?.daily || [])
    .slice()
    .sort((a,b)=>String(b.id||'').localeCompare(String(a.id||'')))
    .slice(0,3);

  if(daily.length===0){
    el.innerHTML='<span class="add-center-empty-chip">Δεν υπάρχουν πρόσφατα</span>';
    return;
  }

  el.innerHTML=daily.map(e=>{
    const amountText=String(Number(e.amount)||0).replace('.',',');
    const text=`${e.name} ${amountText}`;
    return `<button type="button" onclick="fillQuickAddSheet('${esc(text)}')">+ ${esc(e.name)} ${fmt(e.amount)}</button>`;
  }).join('');
}

function openAddCenterSheet(tab='quick',prefill='',errorMessage=''){
  const sheet=document.getElementById('addCenterSheet') || document.getElementById('quickAddSheet');
  const input=document.getElementById('quickAddSheetInput');
  if(!sheet)return;

  sheet.classList.add('active');
  document.body.classList.add('quick-sheet-open','add-center-open');

  resetAddCenterManualForm();
  renderAddCenterRecentChips();
  switchAddCenterTab(tab==='manual'?'manual':'quick');

  if(input && typeof prefill==='string' && prefill.trim()){
    input.value=prefill.trim();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  clearQuickAddInlineError('quickAddSheetError');

  if(errorMessage){
    setQuickAddInlineError(errorMessage,'quickAddSheetError');
  }

  setTimeout(()=>{
    if(tab==='manual') document.getElementById('acDN')?.focus();
    else input?.focus();
  },140);
}

function closeAddCenterSheet(event){
  if(event && event.target && event.target.id!=='addCenterSheet')return;

  const sheet=document.getElementById('addCenterSheet');
  sheet?.classList.remove('active');
  closeAddCenterCategoryPicker();
  closeAddCenterPaymentPicker();
  document.body.classList.remove('quick-sheet-open','add-center-open');
}

// Backwards compatibility: old calls still open the new Add Center on Quick tab.
function openQuickAddSheet(prefill='',errorMessage=''){
  openAddCenterSheet('quick',prefill,errorMessage);
}

function closeQuickAddSheet(event){
  closeAddCenterSheet(event);
}

async function saveAddCenterManualExpense(){
  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const btn=document.getElementById('addCenterManualSubmit');

  clearQuickAddInlineError('addCenterManualError');

  const name=(nameEl?.value||'').trim();
  const amount=parseFloat(String(amountEl?.value||'').replace(',','.'));
  const category=catEl?.value||'Άλλο';
  const paymentSourceId=payEl?.value||'';
  const paymentSource=typeof paymentSourceById==='function' ? paymentSourceById(paymentSourceId) : null;
  const date=dateEl?.value||addCenterToday();
  const userId=localStorage.getItem(SK);

  if(!name){
    setQuickAddInlineError('Συμπλήρωσε τίτλο εξόδου.','addCenterManualError');
    nameEl?.focus();
    return false;
  }

  if(!amount || amount<=0){
    setQuickAddInlineError('Συμπλήρωσε έγκυρο ποσό.','addCenterManualError');
    amountEl?.focus();
    return false;
  }

  if(!userId){
    setQuickAddInlineError('Δεν υπάρχει ενεργή σύνδεση.','addCenterManualError');
    return false;
  }

  const expense={
    id:gid(),
    name,
    amount,
    category,
    date,
    paymentSourceId,
    paymentSourceName:paymentSource?.name||'',
    paymentSourceType:paymentSource?.incomeType||''
  };

  const monthKey=date.substring(0,7);
  ensM(monthKey);
  D.months[monthKey].daily.push(expense);

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    await saveDailyExpenseRow(userId,expense);
    curM=monthKey;
    render();
    closeAddCenterSheet();
    showMiniToast('✅ Το έξοδο αποθηκεύτηκε');
    return true;

  }catch(e){
    D.months[monthKey].daily=D.months[monthKey].daily.filter(x=>x.id!==expense.id);
    console.error('saveAddCenterManualExpense failed:',e);
    setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.','addCenterManualError');
    return false;

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='Αποθήκευση εξόδου';
    }
  }
}

function setupAddCenterState(){
  syncAddCenterCategoryPicker();

  const manualFields=['acDN','acDA','acDC','acDPay','acDD','acDNotes'];
  manualFields.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',()=>clearQuickAddInlineError('addCenterManualError'));
    el.addEventListener('change',()=>clearQuickAddInlineError('addCenterManualError'));
  });

  document.addEventListener('click',e=>{
    const list=document.getElementById('acDCCustomList');
    const btn=document.getElementById('acDCCustom');
    if(!list?.classList.contains('active'))return;
    if(list.contains(e.target) || btn?.contains(e.target))return;
    closeAddCenterCategoryPicker();
    closeAddCenterPaymentPicker();
  });

  document.addEventListener('keydown',e=>{
    const sheet=document.getElementById('addCenterSheet');
    if(e.key==='Escape' && sheet?.classList.contains('active')){
      closeAddCenterSheet();
    }
  });
}

document.addEventListener('DOMContentLoaded', setupAddCenterState);


// Compatibility helpers: any page-level add button should open the shared Add Center.
function openAddCenter(tab='quick', prefill='', errorMessage=''){
  return openAddCenterSheet(tab, prefill, errorMessage);
}

function openDailyAddCenter(){
  return openAddCenterSheet('manual');
}


/* ============================================================
   TRANSACTIONS COMPLETE V3 — mobile management layer
   - Details sheet actions
   - Edit through shared Add Center
   - Duplicate prefill
   - Premium delete confirmation
   - Better mobile date grouping
   ============================================================ */

let txCompleteDetailState = null;
let addCenterEditState = null;

function txCompleteTodayISO(){
  return new Date().toISOString().split('T')[0];
}

function txCompleteDateLabel(dateStr){
  if(!dateStr)return 'Χωρίς ημερομηνία';
  const d=new Date(dateStr+'T12:00:00');
  const today=txCompleteTodayISO();
  const y=new Date();
  y.setDate(y.getDate()-1);
  const yesterday=y.toISOString().split('T')[0];

  if(dateStr===today)return 'Σήμερα';
  if(dateStr===yesterday)return 'Χθες';

  return d.toLocaleDateString('el-GR',{
    weekday:'long',
    day:'2-digit',
    month:'long'
  });
}

function txCompleteLongDate(dateStr){
  if(!dateStr)return '-';
  return new Date(dateStr+'T12:00:00').toLocaleDateString('el-GR',{
    weekday:'long',
    day:'2-digit',
    month:'long',
    year:'numeric'
  });
}

function txCompleteFindDailyById(id){
  let found=null;
  Object.values(D.months||{}).forEach(m=>{
    const x=(m.daily||[]).find(e=>e.id===id);
    if(x)found=x;
  });
  return found;
}

function txCompleteFindByTypeAndId(type,id){
  if(type==='fixed')return (D.fixedExpenses||[]).find(e=>e.id===id)||null;
  return txCompleteFindDailyById(id);
}

function txCompletePaymentText(e,type){
  if(type==='fixed')return 'Σταθερό έξοδο';
  if(e.paymentSourceName)return e.paymentSourceName;
  return 'Budget / Μετρητά';
}

function txCompleteFillManualForm(e,{edit=false}={}){
  if(!e)return;

  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const notesEl=document.getElementById('acDNotes');
  const submit=document.getElementById('addCenterManualSubmit');

  if(nameEl)nameEl.value=e.name||'';
  if(amountEl)amountEl.value=Number(e.amount||0);
  if(catEl)catEl.value=e.category||'Άλλο';
  if(payEl)payEl.value=e.paymentSourceId||'';
  if(dateEl)dateEl.value=e.date||addCenterToday();
  if(notesEl)notesEl.value=e.notes||'';

  if(typeof syncAddCenterCategoryPicker==='function')syncAddCenterCategoryPicker();
  if(typeof syncAddCenterPaymentPicker==='function')syncAddCenterPaymentPicker();

  if(submit){
    submit.textContent=edit?'Ενημέρωση εξόδου':'Αποθήκευση εξόδου';
  }
}

function txCompleteOpenManualForEdit(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  closeMobileTransactionDetail();

  if(type==='fixed'){
    // Fixed expenses keep the existing fixed-expense edit modal for now.
    return txCompleteLegacyEditExp ? txCompleteLegacyEditExp(type,id) : undefined;
  }

  addCenterEditState={type,id};
  openAddCenterSheet('manual');

  setTimeout(()=>{
    txCompleteFillManualForm(e,{edit:true});
    document.getElementById('acDN')?.focus();
  },80);
}

function txCompleteOpenManualForDuplicate(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  closeMobileTransactionDetail();

  const copy={
    ...e,
    id:'',
    date:txCompleteTodayISO()
  };

  addCenterEditState=null;
  openAddCenterSheet('manual');

  setTimeout(()=>{
    txCompleteFillManualForm(copy,{edit:false});
    showMiniToast('Έτοιμο αντίγραφο για αποθήκευση');
    document.getElementById('acDN')?.focus();
  },80);
}

async function txCompleteDeleteWithConfirm(type,id){
  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  const confirmed=await showConfirmModal({
    title:'Διαγραφή κίνησης',
    message:`Θέλεις να διαγράψεις το «${e.name}»;`,
    confirmText:'Διαγραφή',
    cancelText:'Άκυρο'
  });

  if(!confirmed)return;

  closeMobileTransactionDetail();

  try{
    await deleteExpenseRow(type,id);

    if(type==='fixed'){
      D.fixedExpenses=(D.fixedExpenses||[]).filter(x=>x.id!==id);
    }else{
      Object.values(D.months||{}).forEach(m=>{
        m.daily=(m.daily||[]).filter(x=>x.id!==id);
      });
    }

    render();
    showMiniToast('✅ Η κίνηση διαγράφηκε');
  }catch(err){
    console.error('txCompleteDeleteWithConfirm failed:',err);
    showMiniToast('❌ Δεν έγινε διαγραφή','error');
  }
}

function showMobileTransactionDetail(type,id){
  if(window.innerWidth>768){
    return (type==='fixed') ? editExp(type,id) : undefined;
  }

  const e=txCompleteFindByTypeAndId(type,id);
  if(!e)return;

  txCompleteDetailState={type,id};

  const overlay=document.getElementById('mobileTransactionDetail');
  const content=document.getElementById('mobileTransactionDetailContent');
  if(!overlay || !content)return;

  const icon=CEMO[e.category]||'📌';
  const payText=txCompletePaymentText(e,type);
  const category=e.category||'Άλλο';
  const amount=Number(e.amount)||0;

  content.innerHTML=`
    <div class="tx-v3-detail-head">
      <button class="tx-v3-sheet-close" type="button" onclick="closeMobileTransactionDetail()">×</button>
      <div class="tx-v3-detail-icon ${CCLS[category]||'cat-other'}">${icon}</div>
      <div class="tx-v3-detail-kicker">${type==='fixed'?'Πάγιο':'Ημερήσιο έξοδο'}</div>
      <h3>${esc(e.name)}</h3>
      <div class="tx-v3-detail-amount">-${fmt(amount)}</div>
      <div class="tx-v3-detail-subtitle">${esc(category)} · ${esc(payText)}</div>
    </div>

    <div class="tx-v3-detail-grid">
      <div class="tx-v3-info-tile">
        <span>Ημερομηνία</span>
        <strong>${txCompleteLongDate(e.date)}</strong>
      </div>
      <div class="tx-v3-info-tile">
        <span>Κατηγορία</span>
        <strong>${esc(category)}</strong>
      </div>
      <div class="tx-v3-info-tile">
        <span>Πληρωμή</span>
        <strong>${esc(payText)}</strong>
      </div>
      <div class="tx-v3-info-tile">
        <span>ID</span>
        <strong>${esc(String(e.id||'').slice(0,8))}</strong>
      </div>
    </div>

    <div class="tx-v3-detail-actions">
      <button type="button" class="tx-v3-action primary" onclick="txCompleteOpenManualForEdit('${type}','${id}')">✎ Επεξεργασία</button>
      <button type="button" class="tx-v3-action secondary" onclick="txCompleteOpenManualForDuplicate('${type}','${id}')">⧉ Αντιγραφή</button>
      <button type="button" class="tx-v3-action danger" onclick="txCompleteDeleteWithConfirm('${type}','${id}')">🗑 Διαγραφή</button>
    </div>
  `;

  overlay.classList.add('active');
  document.body.classList.add('sheet-open');
}

function closeMobileTransactionDetail(){
  const overlay=document.getElementById('mobileTransactionDetail');
  overlay?.classList.remove('active');
  document.body.classList.remove('sheet-open');
  txCompleteDetailState=null;
}

function txCompleteDailyRow(e){
  const category=e.category||'Άλλο';
  const c=CCLS[category]||'cat-other';
  const em=CEMO[category]||'📌';
  const pay=e.paymentSourceName ? ` · ${esc(e.paymentSourceName)}` : '';
  const isSelected=selectedDaily.has(e.id);
  const showSelect=selectionMode.daily;

  return `
    <div class="expense-item tx-v3-row fadeIn ${isSelected?'selected-row':''}" onclick="${!showSelect?`showMobileTransactionDetail('daily','${e.id}')`:''}">
      ${showSelect?`
        <label class="select-box" onclick="event.stopPropagation()">
          <input type="checkbox" ${isSelected?'checked':''} onchange="toggleSelectExpense('daily','${e.id}',this.checked)">
        </label>`:''}
      <div class="expense-icon ${c}">${em}</div>
      <div class="expense-info">
        <div class="expense-name">${esc(e.name)}</div>
        <div class="expense-cat">${esc(category)}${pay}</div>
      </div>
      <div class="tx-v3-row-right">
        <div class="expense-amount is-daily">-${fmt(e.amount)}</div>
      </div>
    </div>`;
}

function renderDailyList(){
  const m=D.months[curM]||{daily:[]};
  const countEl=$('cDaily');
  const listEl=$('lDaily');
  if(!countEl || !listEl)return;

  countEl.innerHTML=`
    ${m.daily.length} εγγραφές
    <button class="mini-action" onclick="toggleSelectMode('daily')">${selectionMode.daily?'Άκυρο':'Επιλογή'}</button>
    ${selectionMode.daily?`
      <button class="mini-action" onclick="selectAllVisible('daily')">Όλα</button>
      <button class="mini-action" onclick="clearSelected('daily')">Κανένα</button>
      <button class="mini-action danger" onclick="bulkDelete('daily')">Διαγραφή</button>
    `:''}
  `;

  if((m.daily||[]).length===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Δεν έχεις κινήσεις ακόμα. Πάτα το + για νέα καταχώρηση.
      </div>`;
    return;
  }

  const filtered=[...(m.daily||[])]
    .filter(e=>mobileTransactionMatchesSearch(e) && mobileTransactionMatchesFilter(e))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || String(b.id||'').localeCompare(String(a.id||'')));

  if(filtered.length===0){
    listEl.innerHTML=`
      <div class="empty tx-v3-empty">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        Δεν υπάρχουν κινήσεις με αυτά τα φίλτρα.
      </div>`;
    return;
  }

  const grouped={};
  filtered.forEach(e=>{
    const key=e.date||'no-date';
    if(!grouped[key])grouped[key]=[];
    grouped[key].push(e);
  });

  const isMobile=window.innerWidth<=768;
  const visibleLimit=isMobile && !txMobileDailyExpanded ? 4 : filtered.length;
  const visibleItems=filtered.slice(0, visibleLimit);
  const visibleGrouped={};
  visibleItems.forEach(e=>{
    const key=e.date||'no-date';
    if(!visibleGrouped[key])visibleGrouped[key]=[];
    visibleGrouped[key].push(e);
  });

  let html='';
  Object.keys(visibleGrouped).sort().reverse().forEach(dt=>{
    const allForDay=grouped[dt]||[];
    const dayTotal=allForDay.reduce((s,e)=>s+(Number(e.amount)||0),0);
    html+=`
      <div class="day-header tx-v3-day-header">
        <div>
          <span>${txCompleteDateLabel(dt)}</span>
          <small>${allForDay.length} κινήσεις</small>
        </div>
        <span class="day-total">-${fmt(dayTotal)}</span>
      </div>`;
    visibleGrouped[dt].forEach(e=>html+=txCompleteDailyRow(e));
  });

  if(isMobile && filtered.length>4){
    html+=`
      <button type="button" class="tx-mobile-more-btn" onclick="toggleTxMobileDailyExpanded()">
        ${txMobileDailyExpanded?'Προβολή λιγότερων':'Προβολή περισσότερων'}
        <span>${txMobileDailyExpanded?'⌃':'⌄'}</span>
      </button>`;
  }

  listEl.innerHTML=html;
}

function toggleTxMobileDailyExpanded(){
  txMobileDailyExpanded=!txMobileDailyExpanded;
  renderDailyList();
}

const txCompleteLegacyEditExp = typeof editExp==='function' ? editExp : null;
function editExp(t,id){
  if(t==='daily' && window.innerWidth<=768){
    return txCompleteOpenManualForEdit(t,id);
  }
  return txCompleteLegacyEditExp ? txCompleteLegacyEditExp(t,id) : undefined;
}

function closeAddCenterSheet(event){
  if(event && event.target && event.target.id!=='addCenterSheet')return;

  addCenterEditState=null;

  const submit=document.getElementById('addCenterManualSubmit');
  if(submit)submit.textContent='Αποθήκευση εξόδου';

  const sheet=document.getElementById('addCenterSheet');
  sheet?.classList.remove('active');

  if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
  if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();

  document.body.classList.remove('quick-sheet-open','add-center-open');
}

async function saveAddCenterManualExpense(){
  const nameEl=document.getElementById('acDN');
  const amountEl=document.getElementById('acDA');
  const catEl=document.getElementById('acDC');
  const payEl=document.getElementById('acDPay');
  const dateEl=document.getElementById('acDD');
  const btn=document.getElementById('addCenterManualSubmit');

  clearQuickAddInlineError('addCenterManualError');

  const name=(nameEl?.value||'').trim();
  const amount=parseFloat(String(amountEl?.value||'').replace(',','.'));
  const category=catEl?.value||'Άλλο';
  const paymentSourceId=payEl?.value||'';
  const paymentSource=typeof paymentSourceById==='function' ? paymentSourceById(paymentSourceId) : null;
  const date=dateEl?.value||addCenterToday();
  const userId=localStorage.getItem(SK);
  const editing=addCenterEditState?.type==='daily';
  const id=editing ? addCenterEditState.id : gid();

  if(!name){
    setQuickAddInlineError('Συμπλήρωσε τίτλο εξόδου.','addCenterManualError');
    nameEl?.focus();
    return false;
  }

  if(!amount || amount<=0){
    setQuickAddInlineError('Συμπλήρωσε έγκυρο ποσό.','addCenterManualError');
    amountEl?.focus();
    return false;
  }

  if(!userId){
    setQuickAddInlineError('Δεν υπάρχει ενεργή σύνδεση.','addCenterManualError');
    return false;
  }

  const expense={
    id,
    name,
    amount,
    category,
    date,
    paymentSourceId,
    paymentSourceName:paymentSource?.name||'',
    paymentSourceType:paymentSource?.incomeType||''
  };

  const monthKey=date.substring(0,7);
  ensM(monthKey);

  // Optimistic local update. For edits, remove the old copy from every month first.
  if(editing){
    Object.values(D.months||{}).forEach(m=>{
      m.daily=(m.daily||[]).filter(x=>x.id!==id);
    });
  }

  D.months[monthKey].daily.push(expense);

  try{
    if(btn){
      btn.disabled=true;
      btn.textContent=editing?'Ενημέρωση...':'Αποθήκευση...';
    }

    await saveDailyExpenseRow(userId,expense);
    curM=monthKey;
    addCenterEditState=null;
    render();
    closeAddCenterSheet();
    showMiniToast(editing?'✅ Η κίνηση ενημερώθηκε':'✅ Το έξοδο αποθηκεύτηκε');
    return true;

  }catch(e){
    console.error('saveAddCenterManualExpense v3 failed:',e);
    // Safest recovery: reload canonical data if possible.
    try{
      await fetchAllData(userId);
      render();
    }catch(reloadErr){
      console.error('Reload after save failure failed:',reloadErr);
    }
    setQuickAddInlineError('Δεν μπόρεσα να αποθηκεύσω το έξοδο. Δοκίμασε ξανά.','addCenterManualError');
    return false;

  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent=addCenterEditState?'Ενημέρωση εξόδου':'Αποθήκευση εξόδου';
    }
  }
}


// ============================================================
// ADD CENTER V4 — Premium Quick Add overrides
// Kept at the end on purpose so it safely overrides older patch functions.
// ============================================================
(function(){
  function acEl(id){return document.getElementById(id);}

  window.renderSmartQuickPreview=function(targetId,text){
    const el=acEl(targetId);
    if(!el)return;

    const value=(text||'').trim();
    const parsed=quickAddPreviewData(value);

    if(!value){
      el.classList.remove('visible','invalid','is-visible');
      el.innerHTML='';
      return;
    }

    if(!parsed){
      el.classList.add('visible','invalid','is-visible');
      el.innerHTML=`
        <div class="smart-preview-card">
          <div class="smart-preview-top">
            <div>
              <div class="smart-preview-amount-big">?</div>
              <div class="smart-preview-name">Δεν βρήκα ποσό</div>
            </div>
            <div class="smart-preview-chip">💬</div>
          </div>
          <div class="smart-preview-lines">
            <div class="smart-preview-line"><span>Παράδειγμα</span><strong>καφές 3 ticket</strong></div>
          </div>
        </div>`;
      return;
    }

    const icon=(typeof CEMO!=='undefined' && CEMO[parsed.category]) ? CEMO[parsed.category] : '📌';
    const amount=(typeof fmt==='function') ? fmt(parsed.amount) : `€${Number(parsed.amount||0).toFixed(2)}`;
    const payment=parsed.paymentSourceName || 'Κανονικό budget';
    const today=typeof addCenterToday==='function' ? addCenterToday() : new Date().toISOString().split('T')[0];

    el.classList.add('visible','is-visible');
    el.classList.remove('invalid');
    el.innerHTML=`
      <div class="smart-preview-card">
        <div class="smart-preview-top">
          <div>
            <div class="smart-preview-amount-big">${amount}</div>
            <div class="smart-preview-name">${esc(parsed.name || 'Έξοδο')}</div>
          </div>
          <div class="smart-preview-chip">${icon}</div>
        </div>
        <div class="smart-preview-lines">
          <div class="smart-preview-line"><span>Κατηγορία</span><strong>${esc(parsed.category || 'Άλλο')}</strong></div>
          <div class="smart-preview-line"><span>Πληρωμή</span><strong>${esc(payment)}</strong></div>
          <div class="smart-preview-line"><span>Ημερομηνία</span><strong>${esc(today)}</strong></div>
        </div>
      </div>`;
  };

  window.switchAddCenterTab=function(tab='quick'){
    const quickTab=acEl('addCenterQuickTab');
    const manualTab=acEl('addCenterManualTab');
    const quickPanel=acEl('addCenterQuickPanel');
    const manualPanel=acEl('addCenterManualPanel');
    const success=acEl('addCenterSuccess');
    const isManual=tab==='manual';

    document.body.classList.toggle('add-center-manual-active',isManual);
    document.body.classList.remove('add-center-success-active');
    success?.classList.remove('active');

    quickTab?.classList.toggle('active',!isManual);
    manualTab?.classList.toggle('active',isManual);
    quickPanel?.classList.toggle('active',!isManual);
    manualPanel?.classList.toggle('active',isManual);

    quickTab?.setAttribute('aria-selected',String(!isManual));
    manualTab?.setAttribute('aria-selected',String(isManual));

    setTimeout(()=>{
      if(isManual) acEl('acDN')?.focus();
      else acEl('quickAddSheetInput')?.focus();
    },80);
  };

  window.openAddCenterSheet=function(tab='quick',prefill='',errorMessage=''){
    const sheet=acEl('addCenterSheet');
    const input=acEl('quickAddSheetInput');
    if(!sheet)return;

    sheet.classList.add('active');
    document.body.classList.add('quick-sheet-open','add-center-open');
    document.body.classList.remove('add-center-success-active');

    if(typeof resetAddCenterManualForm==='function')resetAddCenterManualForm();
    if(typeof renderAddCenterRecentChips==='function')renderAddCenterRecentChips();
    switchAddCenterTab(tab==='manual'?'manual':'quick');

    if(input){
      if(typeof prefill==='string' && prefill.trim())input.value=prefill.trim();
      else if(tab!=='manual')input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    clearQuickAddInlineError('quickAddSheetError');
    clearQuickAddInlineError('addCenterManualError');

    if(errorMessage)setQuickAddInlineError(errorMessage,'quickAddSheetError');

    setTimeout(()=>{
      if(tab==='manual') acEl('acDN')?.focus();
      else input?.focus();
    },180);
  };

  window.closeAddCenterSheet=function(event){
    if(event && event.target && event.target.id!=='addCenterSheet')return;

    addCenterEditState=null;
    document.body.classList.remove('quick-sheet-open','add-center-open','add-center-manual-active','add-center-success-active');
    acEl('addCenterSheet')?.classList.remove('active');
    acEl('addCenterSuccess')?.classList.remove('active');

    const submit=acEl('addCenterManualSubmit');
    if(submit)submit.textContent='Αποθήκευση εξόδου';

    if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
    if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();
  };

  window.openQuickAddSheet=function(prefill='',errorMessage=''){
    return openAddCenterSheet('quick',prefill,errorMessage);
  };

  window.closeQuickAddSheet=function(event){
    return closeAddCenterSheet(event);
  };

  window.fillQuickAddSheet=function(text){
    const input=acEl('quickAddSheetInput');
    if(!input)return;
    input.value=text;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
  };

  window.showAddCenterSuccess=function(){
    acEl('addCenterSuccess')?.classList.add('active');
    document.body.classList.add('add-center-success-active');
  };

  window.submitQuickAddSheet=async function(){
    const sheetInput=acEl('quickAddSheetInput');
    const btn=acEl('quickAddSheetSubmit');
    clearQuickAddInlineError('quickAddSheetError');

    const text=(sheetInput?.value || '').trim();
    if(!text){
      setQuickAddInlineError('Γράψε κάτι όπως “καφές 3”.','quickAddSheetError');
      sheetInput?.focus();
      return false;
    }

    if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

    const saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});

    if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}

    if(!saved)return false;

    if(sheetInput){
      sheetInput.value='';
      sheetInput.dispatchEvent(new Event('input',{bubbles:true}));
    }

    showAddCenterSuccess();
    setTimeout(()=>closeAddCenterSheet(),700);
    return true;
  };

  const previousSetup=window.setupAddCenterState;
  window.setupAddCenterState=function(){
    if(typeof previousSetup==='function')previousSetup();

    const sheetInput=acEl('quickAddSheetInput');
    const submit=acEl('quickAddSheetSubmit');

    if(sheetInput && !sheetInput.dataset.v4Bound){
      sheetInput.dataset.v4Bound='1';
      const sync=()=>{
        const hasValue=sheetInput.value.trim().length>0;
        if(submit)submit.disabled=!hasValue;
        renderSmartQuickPreview('quickAddSheetPreview',sheetInput.value);
        if(hasValue)clearQuickAddInlineError('quickAddSheetError');
      };
      sheetInput.addEventListener('input',sync);
      sheetInput.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          e.stopPropagation();
          submitQuickAddSheet();
        }
      });
      sync();
    }
  };

  // Bind once for pages where DOMContentLoaded already fired before this override is parsed.
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setupAddCenterState(),{once:true});
  }else{
    setupAddCenterState();
  }
})();

// ============================================================
// QUICK ADD V5 HOTFIX — stable open/close/save state
// Keeps the existing V4 HTML, but prevents broken success/duplicate button state.
// ============================================================
(function(){
  function qav5(id){return document.getElementById(id);}

  function qav5CleanState(){
    document.body.classList.remove('add-center-success-active');
    qav5('addCenterSuccess')?.classList.remove('active');

    const quickBtn=qav5('quickAddSheetSubmit');
    const manualBtn=qav5('addCenterManualSubmit');

    if(quickBtn){
      quickBtn.disabled=!((qav5('quickAddSheetInput')?.value || '').trim());
      quickBtn.textContent='Αποθήκευση';
    }

    if(manualBtn){
      manualBtn.disabled=false;
      manualBtn.textContent='Αποθήκευση εξόδου';
    }
  }

  const previousOpenAddCenterSheet=window.openAddCenterSheet;
  window.openAddCenterSheet=function(tab='quick',prefill='',errorMessage=''){
    if(typeof previousOpenAddCenterSheet==='function'){
      previousOpenAddCenterSheet(tab,prefill,errorMessage);
    }else{
      qav5('addCenterSheet')?.classList.add('active');
      document.body.classList.add('quick-sheet-open','add-center-open');
    }

    qav5CleanState();

    const isManual=tab==='manual';
    document.body.classList.toggle('add-center-manual-active',isManual);

    qav5('addCenterQuickTab')?.classList.toggle('active',!isManual);
    qav5('addCenterManualTab')?.classList.toggle('active',isManual);
    qav5('addCenterQuickPanel')?.classList.toggle('active',!isManual);
    qav5('addCenterManualPanel')?.classList.toggle('active',isManual);

    const input=qav5('quickAddSheetInput');
    if(input && !isManual){
      if(prefill && String(prefill).trim())input.value=String(prefill).trim();
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    setTimeout(()=>{
      if(isManual)qav5('acDN')?.focus();
      else input?.focus();
    },120);
  };

  window.closeAddCenterSheet=function(event){
    if(event && event.target && event.target.id && event.target.id!=='addCenterSheet')return;

    if(typeof addCenterEditState!=='undefined')addCenterEditState=null;

    qav5CleanState();
    document.body.classList.remove('quick-sheet-open','add-center-open','add-center-manual-active','add-center-success-active');
    qav5('addCenterSheet')?.classList.remove('active');

    if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
    if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();
  };

  window.closeQuickAddSheet=function(event){
    return window.closeAddCenterSheet(event);
  };

  window.openQuickAddSheet=function(prefill='',errorMessage=''){
    return window.openAddCenterSheet('quick',prefill,errorMessage);
  };

  window.showAddCenterSuccess=function(){
    // No inline success state for now. It caused duplicate/broken visual state.
    // We keep user feedback through toast and close the sheet.
    if(typeof showMiniToast==='function')showMiniToast('✅ Το έξοδο αποθηκεύτηκε');
    setTimeout(()=>window.closeAddCenterSheet(),120);
  };

  window.submitQuickAddSheet=async function(){
    const input=qav5('quickAddSheetInput');
    const btn=qav5('quickAddSheetSubmit');

    if(typeof clearQuickAddInlineError==='function')clearQuickAddInlineError('quickAddSheetError');

    const text=(input?.value || '').trim();
    if(!text){
      if(typeof setQuickAddInlineError==='function')setQuickAddInlineError('Γράψε κάτι όπως “καφές 3”.','quickAddSheetError');
      input?.focus();
      return false;
    }

    if(btn){
      btn.disabled=true;
      btn.textContent='Αποθήκευση...';
    }

    let saved=false;
    try{
      saved=await quickAddExpense('quickAddSheetInput',{errorTarget:'quickAddSheetError'});
    }finally{
      if(btn){
        btn.disabled=false;
        btn.textContent='Αποθήκευση';
      }
    }

    if(!saved)return false;

    if(input){
      input.value='';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }

    if(typeof showMiniToast==='function')showMiniToast('✅ Το έξοδο αποθηκεύτηκε');
    window.closeAddCenterSheet();
    return true;
  };

  const previousSetup=window.setupAddCenterState;
  window.setupAddCenterState=function(){
    if(typeof previousSetup==='function')previousSetup();

    qav5CleanState();

    const input=qav5('quickAddSheetInput');
    const submit=qav5('quickAddSheetSubmit');
    if(input && !input.dataset.v5Bound){
      input.dataset.v5Bound='1';
      input.addEventListener('input',()=>{
        if(submit)submit.disabled=!input.value.trim();
      });
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>window.setupAddCenterState(),{once:true});
  }else{
    window.setupAddCenterState();
  }
})();
