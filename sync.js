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

  return{amount,category,name,date};
}

async function syncFromTelegram(){
  const btn=$('syncBtn');
  const statusEl=$('syncStatus');
  const chatId=getCurrentChatId();

  if(!chatId){
    statusEl.style.display='block';
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Δεν υπάρχει Chat ID. Κάνε σύνδεση ξανά.';
    return;
  }

  btn.disabled=true;
  btn.textContent='⏳ Συγχρονισμός...';

  statusEl.style.display='block';
  statusEl.className='sync-status loading';
  statusEl.textContent='Σύνδεση με Telegram...';

  try{
    const workerUrl=new URL(CONFIG.WORKER_URL);
    workerUrl.searchParams.set('chat_id',chatId);

    const res=await fetch(workerUrl.toString());

    if(!res.ok)throw new Error('Worker error: '+res.status);

    const data=await res.json();

    if(data.error)throw new Error(data.error);

    const messages=data.messages||[];
    const lastId=parseInt(localStorage.getItem(getSyncKey())||'0');

    const newMessages=messages.filter(m=>
      m.message_id>lastId &&
      m.text &&
      !m.text.trim().startsWith('/') &&
      !expenseExistsById(telegramExpenseId(chatId,m.message_id))
    );

    if(newMessages.length===0){
      statusEl.className='sync-status info';
      statusEl.textContent='✅ Δεν υπάρχουν νέα έξοδα.';

      btn.disabled=false;
      btn.textContent='📥 Συγχρονισμός';

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
    btn.disabled=false;
    btn.textContent='📥 Συγχρονισμός';

    openSyncPreview(parsed);

  }catch(err){
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Σφάλμα: '+err.message;

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
      date:new Date().toISOString().split('T')[0]
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

  <div style="display:flex;gap:10px;margin-top:20px">
    <button class="btn btn-primary" style="flex:1" onclick="confirmSync(${msgIds})">
      ✅ Αποθήκευση
    </button>

    <button class="btn btn-secondary" style="flex:1" onclick="closeSyncPreview()">
      Ακύρωση
    </button>
  </div>
`;

  overlay.classList.add('active');
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
  if(o)o.classList.remove('active');
}

function confirmSync(...messageIds){
  const ids=messageIds.flat();
  const rows=document.querySelectorAll('.sync-row');
  const chatId=getCurrentChatId();

  let added=0;
  let skipped=0;
  let maxId=parseInt(localStorage.getItem(getSyncKey())||'0');

  rows.forEach((_,idx)=>{
    const msgId=ids[idx];

    if(msgId>maxId)maxId=msgId;

    if($('sSkip'+idx).checked){
      skipped++;
      return;
    }

    const id=telegramExpenseId(chatId,msgId);

    if(expenseExistsById(id)){
      skipped++;
      return;
    }

    const name=$('sName'+idx).value.trim();
    const amount=parseFloat($('sAmt'+idx).value);
    const cat=$('sCat'+idx).value;
    const date=$('sDate'+idx).value;

    if(!name||!amount||amount<=0){
      skipped++;
      return;
    }

    const monthKey=date.substring(0,7);

    ensM(monthKey);

    D.months[monthKey].daily.push({
      id,
      name,
      amount,
      category:cat,
      date
    });

    added++;
  });

  localStorage.setItem(getSyncKey(),maxId.toString());

  saveToSupabase();
  render();
  closeSyncPreview();

  const statusEl=$('syncStatus');

  statusEl.style.display='block';
  statusEl.className='sync-status success';
  statusEl.textContent=`✅ Προστέθηκαν ${added} έξοδα${skipped>0?` (${skipped} παραλείφθηκαν)`:''}`;

  setTimeout(()=>{statusEl.style.display='none'},4000);
}