// ===== TELEGRAM SYNC MODULE =====

const SYNC_KEY_PREFIX='expense_sync_last_id';

const CAT_KEYWORDS={
  'Τρόφιμα':['σούπερ μάρκετ','super market','σουπερ','τρόφιμα','ψώνια','μανάβης','κρεοπωλείο','ψάρια','φρούτα','λαχανικά'],
  'Καφέδες':['καφές','καφε','καφέ','coffee','espresso','freddo','frappé','frappe','καφετέρια'],
  'Μεταφορά':['βενζίνη','πετρέλαιο','parking','παρκινγκ','μετρό','metro','λεωφορείο','ταξί','taxi','uber','εισιτήριο'],
  'Ψυχαγωγία':['σινεμά','cinema','θέατρο','συναυλία','netflix','spotify','παιχνίδι','game'],
  'Φαγητό έξω':['εστιατόριο','ταβέρνα','πίτσα','pizza','σουβλάκι','delivery','wolt','efood','φαγητό έξω','γεύμα','δείπνο'],
  'Στέγαση':['ενοίκιο','ενοικιο','ρεύμα','νερό','κοινόχρηστα','internet'],
  'Λογαριασμοί':['λογαριασμός','λογαριασμος','deh','δεη','ευδαπ','cosmote','vodafone','wind'],
  'Υγεία':['φαρμακείο','φάρμακο','γιατρός','γιατρος','νοσοκομείο','ιατρός','εξέταση','ασφάλεια'],
  'Ρούχα':['ρούχα','παπούτσια','zara','h&m','ένδυση'],
  'Συνδρομές':['συνδρομή','συνδρομη','subscription','youtube','prime','disney'],
  'Δάνεια':['δόση','δοση','δάνειο','δανειο','τράπεζα'],
  'Άλλο':[]
};

const ALL_CATS=['Τρόφιμα','Καφέδες','Μεταφορά','Ψυχαγωγία','Φαγητό έξω','Στέγαση','Λογαριασμοί','Υγεία','Ρούχα','Συνδρομές','Δάνεια','Άλλο'];

function getCurrentChatId(){
  if(typeof getTelegramChatId==='function')return getTelegramChatId();
  return localStorage.getItem('current_chat_id');
}

function getCurrentDataOwnerId(){
  if(typeof getDataOwnerId==='function')return getDataOwnerId();
  return String(currentUser?.id || currentSession?.user?.id || '').trim();
}

function getSyncKey(){
  const chatId=getCurrentChatId();
  return `${SYNC_KEY_PREFIX}_${chatId||'unknown'}`;
}

function telegramExpenseId(chatId,messageId){
  return `tg_${chatId}_${messageId}`;
}

function expenseExistsById(id){
  return Object.values(D.months||{}).some(m=>(m.daily||[]).some(e=>e.id===id));
}

async function getSupabaseAccessToken(){
  if(currentSession?.access_token){
    return currentSession.access_token;
  }

  const sessionPromise=supabaseClient.auth.getSession();

  const timeoutPromise=new Promise((_,reject)=>{
    setTimeout(()=>reject(new Error('Timeout στο Supabase session. Κάνε refresh ή ξανά login.')),8000);
  });

  const {data,error}=await Promise.race([
    sessionPromise,
    timeoutPromise
  ]);

  if(error)throw error;

  const token=data?.session?.access_token;

  if(!token){
    throw new Error('Δεν υπάρχει ενεργό Google session. Κάνε ξανά σύνδεση.');
  }

  currentSession=data.session;
  currentUser=data.session.user;

  return token;
}

async function fetchWithTimeout(url, options={}, timeoutMs=15000){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);

  try{
    return await fetch(url,{
      ...options,
      signal:controller.signal
    });
  }finally{
    clearTimeout(timeout);
  }
}

async function saveSyncedExpenses(newExpenseRows){
  if(!newExpenseRows || newExpenseRows.length===0)return;

  const token=await getSupabaseAccessToken();

  const res=await fetchWithTimeout(
    `${CONFIG.SUPABASE_URL}/rest/v1/expenses`,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':CONFIG.SUPABASE_ANON_KEY,
        'Authorization':'Bearer '+token,
        'Prefer':'resolution=merge-duplicates'
      },
      body:JSON.stringify(newExpenseRows)
    },
    15000
  );

  if(!res.ok){
    const txt=await res.text();
    throw new Error('Save synced expenses failed: '+txt);
  }
}

function detectPaymentSourceFromText(text){
  const t=(text||'').toLowerCase();

  const sources=(D.incomeSources||[])
    .filter(i=>typeof isRestrictedPaymentSource==='function'?isRestrictedPaymentSource(i):(i.restriction && i.restriction!=='none'));

  if(sources.length===0)return null;

  for(const source of sources){
    const name=(source.name||'').toLowerCase();
    const category=(source.category||'').toLowerCase();
    const type=(source.incomeType||'').toLowerCase();

    const tokens=[
      name,
      category,
      type,
      'ticket',
      'voucher',
      'edenred',
      'meal',
      'restaurant'
    ].filter(Boolean);

    if(tokens.some(token=>token && t.includes(token))){
      return source;
    }
  }

  return null;
}

function parseExpense(text){
  const normalized=(typeof window!=='undefined' && typeof window.normalizeQuickExpenseText==='function')
    ? window.normalizeQuickExpenseText(text)
    : String(text||'');
  const t=normalized.toLowerCase().trim();
  const amountMatch=t.match(/(\d+([.,]\d{1,2})?)\s*(ευρώ|ευρω|euro|€)?/);

  if(!amountMatch)return null;

  const amount=parseFloat(amountMatch[1].replace(',','.'));
  if(!amount||amount<=0)return null;

  let category='Άλλο';

  for(const[cat,keywords]of Object.entries(CAT_KEYWORDS)){
    if(keywords.some(kw=>t.includes(kw))){
      category=cat;
      break;
    }
  }

  let name=normalized
    .replace(/\d+([.,]\d{1,2})?\s*(ευρώ|ευρω|euro|€)?/gi,'')
    .replace(/\b(σήμερα|χθες|αύριο|πρωί|βράδυ|μεσημέρι)\b/gi,'')
    .trim();

  if(name.length>0)name=name.charAt(0).toUpperCase()+name.slice(1);
  else name=category;

  let date=new Date().toISOString().split('T')[0];

  if(t.includes('χθες')){
    const y=new Date();
    y.setDate(y.getDate()-1);
    date=y.toISOString().split('T')[0];
  }

  const paymentSource=detectPaymentSourceFromText(normalized);

  return{
    amount,
    category,
    name,
    date,
    paymentSourceId:paymentSource?.id||'',
    paymentSourceName:paymentSource?.name||'',
    paymentSourceType:paymentSource?.incomeType||''
  };
}

async function markTelegramMessages(messageIds,status){
  if(!messageIds || messageIds.length===0)return;

  const token=await getSupabaseAccessToken();

  const url=new URL(CONFIG.WORKER_URL);
  url.pathname='/mark';

  const res=await fetchWithTimeout(url.toString(),{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token
    },
    body:JSON.stringify({
      message_ids:messageIds,
      status
    })
  });

  if(!res.ok){
    throw new Error('Mark messages failed: '+res.status);
  }

  const data=await res.json();

  if(data.error){
    throw new Error(data.error);
  }

  return data;
}

let syncRunning=false;

async function syncFromTelegram(){
  if(syncRunning)return;

  syncRunning=true;

  const btn=$('syncBtn');
  const statusEl=$('syncStatus');
  const chatId=getCurrentChatId();

  try{
    btn.disabled=true;
    btn.textContent='⏳ Συγχρονισμός...';

    statusEl.style.display='block';
    statusEl.className='sync-status loading';
    statusEl.textContent='Έλεγχος σύνδεσης...';

    if(!chatId){
      statusEl.className='sync-status info';
      statusEl.innerHTML='Για να χρησιμοποιήσεις Telegram Sync, σύνδεσε πρώτα το Telegram bot.';
      btn.disabled=false;
      btn.textContent='Σύνδεση Telegram';
      btn.onclick=()=>{ if(typeof switchChatId==='function')switchChatId(); };
      setTimeout(()=>{ if(typeof switchChatId==='function')switchChatId(); },150);
      return;
    }

    const token=await getSupabaseAccessToken();

    statusEl.textContent='Σύνδεση με Worker...';

    const workerUrl=new URL(CONFIG.WORKER_URL);

    const res=await fetchWithTimeout(workerUrl.toString(),{
      method:'GET',
      headers:{
        'Authorization':'Bearer '+token
      }
    },15000);

    statusEl.textContent='Ανάγνωση δεδομένων...';

    if(!res.ok){
      const txt=await res.text();
      throw new Error('Worker error '+res.status+': '+txt);
    }

    const data=await res.json();

    if(data.error){
      throw new Error(data.error);
    }

    const messages=data.messages||[];

    const newMessages=messages.filter(m=>
      m.text &&
      !m.text.trim().startsWith('/') &&
      !expenseExistsById(telegramExpenseId(chatId,m.message_id))
    );

    const alreadyExisting=messages
      .filter(m=>expenseExistsById(telegramExpenseId(chatId,m.message_id)))
      .map(m=>m.message_id);

    if(alreadyExisting.length>0){
      await markTelegramMessages(alreadyExisting,'imported');
    }

    if(newMessages.length===0){
      statusEl.className='sync-status info';
      statusEl.textContent='✅ Δεν υπάρχουν νέα έξοδα.';
      setTimeout(()=>{statusEl.style.display='none'},3000);
      return;
    }

    const parsed=newMessages.map(msg=>{
      const expense=parseExpense(msg.text);

      return{
        message_id:msg.message_id,
        original:msg.text,
        expense,
        skip:expense===null
      };
    });

    statusEl.style.display='none';
    openSyncPreview(parsed);

  }catch(err){
    console.error('syncFromTelegram error:',err);

    statusEl.style.display='block';
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Σφάλμα: '+(
      err.name==='AbortError'
        ? 'Ο Worker άργησε πολύ να απαντήσει.'
        : err.message
    );

  }finally{
    syncRunning=false;
    if(btn){
      btn.disabled=false;
      btn.textContent=getCurrentChatId()?'Συγχρονισμός τώρα':'Σύνδεση Telegram';
    }
  }
}


function syncPickerOptionsHtml(options, selectedValue){
  return (options||[]).map(o=>{
    const value=String(o.value??'');
    const label=String(o.label??value);
    const desc=String(o.desc??'');
    const icon=String(o.icon??'');
    const active=value===String(selectedValue??'');
    return `
      <button type="button" class="capvo-sync-picker-option ${active?'active':''}" onclick="selectSyncPickerValue(event,'${esc(value)}','${esc(label)}')">
        ${icon?`<span class="capvo-sync-picker-icon">${esc(icon)}</span>`:''}
        <span class="capvo-sync-picker-copy">
          <strong>${esc(label)}</strong>
          ${desc?`<small>${esc(desc)}</small>`:''}
        </span>
      </button>`;
  }).join('');
}

function buildSyncPicker(selectId, options, selectedValue){
  const current=(options||[]).find(o=>String(o.value)===String(selectedValue)) || (options||[])[0] || {value:'',label:'—'};
  const hiddenOptions=(options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(selectedValue)?'selected':''}>${esc(o.label)}</option>`).join('');

  return `
    <select class="sync-select capvo-sync-native-select" id="${selectId}" aria-hidden="true" tabindex="-1">
      ${hiddenOptions}
    </select>
    <div class="capvo-sync-picker" data-select-id="${selectId}">
      <button type="button" class="capvo-sync-picker-trigger" onclick="toggleSyncPicker(event,this)">
        ${current.icon?`<span class="capvo-sync-picker-icon">${esc(current.icon)}</span>`:''}
        <span class="capvo-sync-picker-copy">
          <strong>${esc(current.label)}</strong>
          ${current.desc?`<small>${esc(current.desc)}</small>`:''}
        </span>
        <span class="capvo-sync-picker-chevron">⌄</span>
      </button>
      <div class="capvo-sync-picker-menu">
        ${syncPickerOptionsHtml(options,selectedValue)}
      </div>
    </div>`;
}

function toggleSyncPicker(event,btn){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const picker=btn.closest('.capvo-sync-picker');
  if(!picker)return;
  const shouldOpen=!picker.classList.contains('is-open');
  document.querySelectorAll('.capvo-sync-picker.is-open').forEach(p=>{
    if(p!==picker)p.classList.remove('is-open');
  });
  picker.classList.toggle('is-open',shouldOpen);
}

function selectSyncPickerValue(event,value,label){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const option=event.currentTarget;
  const picker=option.closest('.capvo-sync-picker');
  if(!picker)return;
  const select=$(picker.dataset.selectId);
  if(select){
    select.value=value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  const trigger=picker.querySelector('.capvo-sync-picker-trigger');
  const copy=option.querySelector('.capvo-sync-picker-copy')?.innerHTML || `<strong>${esc(label)}</strong>`;
  const icon=option.querySelector('.capvo-sync-picker-icon')?.outerHTML || '';
  if(trigger){
    trigger.innerHTML=`${icon}<span class="capvo-sync-picker-copy">${copy}</span><span class="capvo-sync-picker-chevron">⌄</span>`;
  }
  picker.querySelectorAll('.capvo-sync-picker-option').forEach(o=>o.classList.remove('active'));
  option.classList.add('active');
  picker.classList.remove('is-open');
}

document.addEventListener('click',e=>{
  if(!e.target.closest?.('.capvo-sync-picker')){
    document.querySelectorAll('.capvo-sync-picker.is-open').forEach(p=>p.classList.remove('is-open'));
  }
});
function openSyncPreview(items){
  let overlay=$('mSyncPreview');

  if(!overlay){
    overlay=document.createElement('div');
    overlay.className='modal-overlay capvo-sync-review-overlay';
    overlay.id='mSyncPreview';
    overlay.innerHTML='<div class="modal modal-wide capvo-sync-review-sheet" id="mSyncPreviewInner"></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay)closeSyncPreview();
    });
  }else{
    overlay.classList.add('capvo-sync-review-overlay');
    overlay.innerHTML='<div class="modal modal-wide capvo-sync-review-sheet" id="mSyncPreviewInner"></div>';
  }

  const invalidCount=items.filter(item=>{
    const duplicate=expenseExistsById(telegramExpenseId(getCurrentChatId(),item.message_id));
    return item.skip||duplicate;
  }).length;

  const rows=items.map((item,idx)=>{
    const e=item.expense||{
      name:'',
      amount:'',
      category:'Άλλο',
      date:new Date().toISOString().split('T')[0],
      paymentSourceId:'',
      paymentSourceName:'',
      paymentSourceType:''
    };

    const duplicate=expenseExistsById(
      telegramExpenseId(getCurrentChatId(),item.message_id)
    );

    const invalid=item.skip||duplicate;
    const skipChecked=invalid?'checked':'';
    const dimmed=invalid?'style="opacity:0.45;pointer-events:none"':'';

    return`
      <article class="sync-row capvo-sync-row ${invalid?'skipped':''}" id="syncRow${idx}" data-invalid="${invalid}">
        <div class="sync-row-original capvo-sync-original">
          <span class="capvo-sync-msg-icon">💬</span>
          <div class="capvo-sync-original-copy">
            <small>Μήνυμα Telegram</small>
            <strong>${esc(item.original)}</strong>
          </div>
          <div class="capvo-sync-badges">
            ${duplicate?'<span class="sync-badge duplicate">Ήδη υπάρχει</span>':''}
            ${item.skip?'<span class="sync-badge invalid">Θέλει έλεγχο</span>':''}
          </div>
        </div>

        <div class="sync-row-fields capvo-sync-fields" id="syncFields${idx}" ${dimmed}>
          <label class="capvo-sync-field capvo-sync-field-name">
            <span>Περιγραφή</span>
            <input class="sync-input" type="text" id="sName${idx}" value="${esc(e.name)}" placeholder="π.χ. Καφές">
          </label>

          <label class="capvo-sync-field capvo-sync-field-amount">
            <span>Ποσό</span>
            <input class="sync-input sync-amount" type="number" id="sAmt${idx}" value="${e.amount}" placeholder="€" step="0.01" min="0">
          </label>

          <label class="capvo-sync-field capvo-sync-field-category">
            <span>Κατηγορία</span>
            ${buildSyncPicker(`sCat${idx}`, ALL_CATS.map(c=>({
                value:c,
                label:c,
                icon:(typeof CEMO!=='undefined' && CEMO[c]) ? CEMO[c] : ''
              })), e.category)}
          </label>

          <label class="capvo-sync-field capvo-sync-field-date">
            <span>Ημερομηνία</span>
            <input class="sync-input sync-date" type="date" id="sDate${idx}" value="${e.date}">
          </label>

          <label class="capvo-sync-field capvo-sync-field-pay">
            <span>Πληρωμή</span>
            ${buildSyncPicker(`sPay${idx}`, [
                {value:'',label:'Κανονικό budget',icon:'💳',desc:'Χωρίς Ticket / Voucher'},
                ...availablePaymentSources().map(src=>({
                  value:src.id,
                  label:src.name,
                  icon:'🎫',
                  desc:'Πηγή πληρωμής'
                }))
              ], e.paymentSourceId||'')}
          </label>
        </div>

        <label class="sync-skip-label capvo-sync-skip">
          <input type="checkbox" id="sSkip${idx}" ${skipChecked} onchange="toggleSyncRow(${idx})">
          <span>Παράλειψη αυτής της κίνησης</span>
        </label>
      </article>`;
  }).join('');

  const msgIds=JSON.stringify(items.map(i=>i.message_id));

  $('mSyncPreviewInner').innerHTML=`
    <div class="capvo-sync-review-head">
      <button class="modal-close capvo-sync-close" onclick="closeSyncPreview()" aria-label="Κλείσιμο">×</button>
      <span class="capvo-sync-kicker">TELEGRAM SYNC</span>
      <h2>Έλεγχος εξόδων</h2>
      <p>Δες τις κινήσεις που βρέθηκαν από το Telegram, διόρθωσε ό,τι χρειάζεται και πάτα αποθήκευση.</p>

      <div class="capvo-sync-summary">
        <div><strong>${items.length}</strong><span>κινήσεις</span></div>
        <div><strong>${Math.max(0,items.length-invalidCount)}</strong><span>έτοιμες</span></div>
        <div class="${invalidCount?'has-warning':''}"><strong>${invalidCount}</strong><span>για έλεγχο</span></div>
      </div>
    </div>

    <div class="sync-toolbar capvo-sync-toolbar">
      <button class="mini-action" onclick="setAllSyncRows(false)">✓ Επιλογή όλων</button>
      <button class="mini-action" onclick="setAllSyncRows(true)">Παράλειψη όλων</button>
      <button class="mini-action" onclick="setOnlyInvalidSyncRows()">Μόνο προβληματικά</button>
    </div>

    <div id="syncRowsList" class="capvo-sync-rows">${rows}</div>

    <div class="sync-actions-sticky capvo-sync-actions">
      <button type="button" class="btn btn-primary" id="btnConfirmSync">
        Αποθήκευση κινήσεων
      </button>

      <button class="btn btn-secondary" onclick="closeSyncPreview()">
        Ακύρωση
      </button>
    </div>
  `;

  overlay.style.display='';
  overlay.style.pointerEvents='';
  overlay.classList.add('active');
  document.body.style.overflow='hidden';

  // Always open review at the top on iOS/Safari.
  const reviewInner=$('mSyncPreviewInner');
  if(reviewInner) reviewInner.scrollTop=0;
  overlay.scrollTop=0;

  window.currentSyncMessageIds=items.map(i=>i.message_id);

  setTimeout(()=>{
    const btn=$('btnConfirmSync');
    if(btn){
      btn.onclick=()=>{
        confirmSync(window.currentSyncMessageIds);
      };
    }
  },0);
}
function toggleSyncRow(idx){
  const skip=$('sSkip'+idx).checked;
  const fields=$('syncFields'+idx);

  fields.style.opacity=skip?'0.4':'1';
  fields.style.pointerEvents=skip?'none':'';

  $('syncRow'+idx).className='sync-row capvo-sync-row'+(skip?' skipped':'');
}

function setAllSyncRows(skip){
  document.querySelectorAll('.sync-row').forEach((_,idx)=>{
    const cb=$('sSkip'+idx);
    if(cb){
      cb.checked=skip;
      toggleSyncRow(idx);
    }
  });
}

function setOnlyInvalidSyncRows(){
  document.querySelectorAll('.sync-row').forEach((row,idx)=>{
    const cb=$('sSkip'+idx);
    if(!cb)return;

    const isInvalid=row.dataset.invalid==='true';
    cb.checked=isInvalid;
    toggleSyncRow(idx);
  });
}

function closeSyncPreview(){
  const o=$('mSyncPreview');
  if(o){
    o.classList.remove('active');
    o.remove();
  }

  document.body.style.overflow='';
}

async function confirmSync(...messageIds){
  const ids=messageIds.flat();
  const rows=document.querySelectorAll('.sync-row');
  const chatId=getCurrentChatId();
  const dataOwnerId=getCurrentDataOwnerId();

  const importedIds=[];
  const skippedIds=[];
  const newExpenseRows=[];

  let added=0;
  let skipped=0;
  let maxId=parseInt(localStorage.getItem(getSyncKey())||'0');

  rows.forEach((_,idx)=>{
    const msgId=ids[idx];

    if(msgId>maxId)maxId=msgId;

    if($('sSkip'+idx).checked){
      skippedIds.push(msgId);
      skipped++;
      return;
    }

    const id=telegramExpenseId(chatId,msgId);

    if(expenseExistsById(id)){
      importedIds.push(msgId);
      skipped++;
      return;
    }

    const name=$('sName'+idx).value.trim();
    const amount=parseFloat($('sAmt'+idx).value);
    const cat=$('sCat'+idx).value;
    const date=$('sDate'+idx).value;
    const paymentSourceId=$('sPay'+idx)?.value||'';
    const paymentSource=paymentSourceById(paymentSourceId);

    if(!name||!amount||amount<=0){
      skippedIds.push(msgId);
      skipped++;
      return;
    }

    const monthKey=date.substring(0,7);

    ensM(monthKey);

    const expense={
      id,
      name,
      amount,
      category:cat,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };
    D.months[monthKey].daily.push(expense);

    newExpenseRows.push({
      id,
      user_id:dataOwnerId,
      user_chat_id:chatId || null,
      name,
      amount,
      category:cat,
      date,
      type:'daily',
      month_key:monthKey,
      payment_source_id:paymentSourceId||null,
      payment_source_name:paymentSource?.name||null,
      payment_source_type:paymentSource?.incomeType||null
    });

    importedIds.push(msgId);
    added++;
  });

  const statusEl=$('syncStatus');

  try{
    statusEl.style.display='block';
    statusEl.className='sync-status loading';
    statusEl.textContent='Αποθήκευση εξόδων...';

    if(newExpenseRows.length>0){
      await saveSyncedExpenses(newExpenseRows);

      // Keep dashboard/reports/advisor canonical after Telegram sync.
      // We save to Supabase first, then reload all data so the local state
      // uses the exact same structure/calculations as a normal page refresh.
      localStorage.setItem('needs_data_reload','1');
    }


    statusEl.textContent='Ενημέρωση Telegram messages...';

    if(importedIds.length>0){
      await markTelegramMessages(importedIds,'imported');
    }

    if(skippedIds.length>0){
      await markTelegramMessages(skippedIds,'skipped');
    }

    localStorage.setItem(getSyncKey(),maxId.toString());

    // Re-fetch after successful Telegram import so dashboard balance,
    // category totals, reports and advisor all include the synced rows.
    if(newExpenseRows.length>0 && chatId){
      try{
        await fetchAllData(dataOwnerId);
      }catch(reloadErr){
        console.warn('Telegram sync saved, but data reload failed:',reloadErr);
      }
    }

    closeSyncPreview();
    render();

    statusEl.style.display='block';
    statusEl.className='sync-status success';
    statusEl.textContent=`✅ Προστέθηκαν ${added} έξοδα${skipped>0?` (${skipped} παραλείφθηκαν)`:''}`;

    setTimeout(()=>{statusEl.style.display='none'},4000);

  }catch(err){
    console.error('confirmSync error:',err);

    statusEl.style.display='block';
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Δεν αποθηκεύτηκε: '+err.message;

    showMiniToast(
      '❌ Δεν αποθηκεύτηκε σωστά',
      'error'
    );
  }
}