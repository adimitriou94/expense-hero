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
  return localStorage.getItem('current_chat_id');
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
    .filter(i=>i.restriction && i.restriction!=='none');

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
  const t=text.toLowerCase().trim();
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

  let name=text
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

  const paymentSource=detectPaymentSourceFromText(text);

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
      throw new Error('Δεν υπάρχει Chat ID. Κάνε σύνδεση ξανά.');
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
    btn.disabled=false;
    btn.textContent='📥 Συγχρονισμός';
  }
}

function openSyncPreview(items){
  let overlay=$('mSyncPreview');

  if(!overlay){
    overlay=document.createElement('div');
    overlay.className='modal-overlay';
    overlay.id='mSyncPreview';
    overlay.innerHTML='<div class="modal modal-wide" id="mSyncPreviewInner"></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay)closeSyncPreview();
    });
  }

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
    const dimmed=invalid?'style="opacity:0.4;pointer-events:none"':'';

    return`
      <div class="sync-row ${invalid?'skipped':''}" id="syncRow${idx}" data-invalid="${invalid}">
        <div class="sync-row-original">
          📨 <em>${esc(item.original)}</em>
          ${duplicate?'<span class="sync-badge duplicate">Ήδη υπάρχει</span>':''}
          ${item.skip?'<span class="sync-badge invalid">Δεν αναγνωρίστηκε</span>':''}
        </div>

        <div class="sync-row-fields" id="syncFields${idx}" ${dimmed}>
          <input class="sync-input" type="text" id="sName${idx}" value="${esc(e.name)}" placeholder="Περιγραφή">
          <input class="sync-input sync-amount" type="number" id="sAmt${idx}" value="${e.amount}" placeholder="€" step="0.01" min="0">

          <select class="sync-select" id="sCat${idx}">
            ${ALL_CATS.map(c=>`<option value="${c}" ${e.category===c?'selected':''}>${c}</option>`).join('')}
          </select>

          <input class="sync-input sync-date" type="date" id="sDate${idx}" value="${e.date}">
          <select class="sync-select" id="sPay${idx}">
              <option value="">Κανονικό budget</option>
                ${availablePaymentSources().map(s=>`
              <option value="${s.id}" ${e.paymentSourceId===s.id?'selected':''}>
                ${esc(s.name)}
              </option>
          `).join('')}
</select>
        </div>

        <label class="sync-skip-label">
          <input type="checkbox" id="sSkip${idx}" ${skipChecked} onchange="toggleSyncRow(${idx})">
          Παράλειψη
        </label>
      </div>`;
  }).join('');

  const msgIds=JSON.stringify(items.map(i=>i.message_id));

  $('mSyncPreviewInner').innerHTML=`
    <h2>
      📋 Έλεγχος εξόδων (${items.length})
      <button class="modal-close" onclick="closeSyncPreview()">×</button>
    </h2>

    <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
      Διόρθωσε αν χρειάζεται και πάτα <strong>Αποθήκευση</strong>.
    </p>

    <div class="sync-toolbar">
      <button class="mini-action" onclick="setAllSyncRows(false)">Επιλογή όλων</button>
      <button class="mini-action" onclick="setAllSyncRows(true)">Παράλειψη όλων</button>
      <button class="mini-action" onclick="setOnlyInvalidSyncRows()">Μόνο προβληματικά</button>
    </div>

    <div id="syncRowsList">${rows}</div>

    <div class="sync-actions-sticky" style="display:flex;gap:10px">
      <button type="button" class="btn btn-primary" id="btnConfirmSync" style="flex:1">
        ✅ Αποθήκευση
      </button>

      <button class="btn btn-secondary" style="flex:1" onclick="closeSyncPreview()">
        Ακύρωση
      </button>
    </div>
  `;

  overlay.style.display='';
  overlay.style.pointerEvents='';
  overlay.classList.add('active');
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

  $('syncRow'+idx).className='sync-row'+(skip?' skipped':'');
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
      name,
      amount,
      category:cat,
      date,
      type:'daily',
      month_key:monthKey,
      user_chat_id:chatId,
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