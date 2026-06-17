// CAPVO app split: 01-ui-selection-toast.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

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
    const rows=typeof getCurrentCycleDailyExpenses==='function' ? getCurrentCycleDailyExpenses() : ((D.months[curM]||{daily:[]}).daily||[]);
    rows.forEach(e=>selectedDaily.add(e.id));
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
    if(type==='daily' && typeof deleteExpenseRow==='function'){
      for(const id of ids){
        await deleteExpenseRow('daily',id);
      }
    }else if(type==='fixed' && typeof capvoSoftDeleteFixedExpense==='function'){
      for(const id of ids){
        await capvoSoftDeleteFixedExpense(id);
      }
    }else{
      await deleteRowsFromTable(table,ids);
    }

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
    $('confirmMessage').textContent=String(message||'').replace(/\\n/g,'\n');

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


/* ============================================================
   CAPVO v1.9.3.2 — Global operation lock
   Prevents navigation/double actions while a save/sync/payment is running.
   ============================================================ */
window.__capvoAppOperation = window.__capvoAppOperation || {
  locked:false,
  startedAt:0,
  message:'',
  detail:''
};

function capvoEnsureOperationOverlay(){
  let el=document.getElementById('capvoGlobalOperationOverlay');
  if(el)return el;

  el=document.createElement('div');
  el.id='capvoGlobalOperationOverlay';
  el.className='capvo-global-operation-overlay';
  el.setAttribute('aria-live','polite');
  el.setAttribute('aria-hidden','true');
  el.innerHTML=`
    <div class="capvo-global-operation-card" role="status">
      <div class="capvo-global-operation-spinner" aria-hidden="true"></div>
      <div class="capvo-global-operation-copy">
        <strong id="capvoGlobalOperationTitle">Επεξεργασία...</strong>
        <span id="capvoGlobalOperationDetail">Μην κλείσεις ή αλλάξεις σελίδα.</span>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function capvoBeginAppOperation(message='Επεξεργασία...',detail='Μην κλείσεις ή αλλάξεις σελίδα.'){
  if(window.__capvoAppOperation?.locked){
    showMiniToast?.('Περίμενε να ολοκληρωθεί η προηγούμενη ενέργεια.','error');
    return false;
  }

  window.__capvoAppOperation={
    locked:true,
    startedAt:Date.now(),
    message,
    detail
  };

  const el=capvoEnsureOperationOverlay();
  const title=document.getElementById('capvoGlobalOperationTitle');
  const desc=document.getElementById('capvoGlobalOperationDetail');
  if(title)title.textContent=message;
  if(desc)desc.textContent=detail;

  el.classList.remove('is-success','is-error');
  el.classList.add('is-active');
  el.setAttribute('aria-hidden','false');
  document.body.classList.add('capvo-operation-locked');

  return true;
}

function capvoUpdateAppOperation(message,detail,state='busy'){
  const el=capvoEnsureOperationOverlay();
  const title=document.getElementById('capvoGlobalOperationTitle');
  const desc=document.getElementById('capvoGlobalOperationDetail');
  if(title && message)title.textContent=message;
  if(desc && detail)desc.textContent=detail;

  el.classList.toggle('is-success',state==='success');
  el.classList.toggle('is-error',state==='error');
}

function capvoEndAppOperation(delay=0){
  const finish=()=>{
    const el=document.getElementById('capvoGlobalOperationOverlay');
    if(el){
      el.classList.remove('is-active','is-success','is-error');
      el.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('capvo-operation-locked');
    if(window.__capvoAppOperation){
      window.__capvoAppOperation.locked=false;
      window.__capvoAppOperation.message='';
      window.__capvoAppOperation.detail='';
    }
  };

  if(delay>0)setTimeout(finish,delay);
  else finish();
}

function capvoAppOperationSuccess(message='Ολοκληρώθηκε',detail='Η ενέργεια ολοκληρώθηκε με επιτυχία.'){
  capvoUpdateAppOperation(message,detail,'success');
}

function capvoAppOperationError(message='Κάτι πήγε στραβά',detail='Δοκίμασε ξανά.'){
  capvoUpdateAppOperation(message,detail,'error');
}

// Defensive capture: if a fast tap happens before the overlay receives pointer-events,
// block clicks while the app is locked.
document.addEventListener('click',function(e){
  if(!window.__capvoAppOperation?.locked)return;
  if(e.target?.closest?.('#capvoGlobalOperationOverlay'))return;
  e.preventDefault();
  e.stopPropagation();
},true);

