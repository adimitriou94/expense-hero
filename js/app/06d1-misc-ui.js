// CAPVO app split: 06d1-misc-ui.js
// Quick Add & misc: initApp, quick add sheet, fallback parse, setup prompt basics
// Source: 06d-misc-ui.js lines 1-345

// CAPVO app split: 06d-misc-ui.js
// Misc UI: quick add, onboarding wizard, setup prompt, utility functions
// Source: 06-modals-nav-auth.js lines 3102-5397


async function initApp(){
  if(appInitStarted){
    return;
  }

  appInitStarted=true;
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

    showAuthLoader();

    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=getTelegramChatId();

    if(chatId){
      if(!isRealTelegramChatId(currentProfile?.telegram_chat_id)){
        currentProfile={...(currentProfile||{}),telegram_chat_id:chatId};
      }
      localStorage.setItem(SK,chatId);
    }else{
      localStorage.removeItem(SK);
    }

    await loadUserData();

  }catch(e){
    console.error('Init error:',e);
    showAuth('Σφάλμα φόρτωσης: '+e.message);
    renderAuthState();

  }finally{
    authBooting=false;
  }
}

supabaseClient.auth.onAuthStateChange(async (event,session)=>{
  // During the manual PKCE callback (?code=...), initApp() is responsible for
  // exchanging the code. Supabase may emit a temporary null INITIAL_SESSION before
  // the exchange completes; do not show the login screen from that transient event.
  if(authBooting || window.location.search.includes('code='))return;

  currentSession=session;
  currentUser=session?.user||null;

  if(event==='SIGNED_IN' || event==='INITIAL_SESSION'){
    cleanOAuthUrl();
  }

  if(!currentUser){
    currentProfile=null;

    // Only clear the linked chat id on an explicit sign out.
    // Other transient auth events can momentarily have no user/session and
    // should not wipe the Telegram link.
    if(event==='SIGNED_OUT'){
      localStorage.removeItem(SK);
    }

    showAuth();
    renderAuthState();
    return;
  }

  try{
    showAuthLoader();

    currentProfile=await getOrCreateProfile(currentUser);
    renderAuthState();

    const chatId=getTelegramChatId();

    if(chatId){
      if(!isRealTelegramChatId(currentProfile?.telegram_chat_id)){
        currentProfile={...(currentProfile||{}),telegram_chat_id:chatId};
      }
      localStorage.setItem(SK,chatId);
    }else{
      localStorage.removeItem(SK);
    }

    await loadUserData();

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

  const name=raw.replace(amountMatch[0],'').replace(/\b(ticket|voucher|edenred|τίκετ|τικετ|κάρτα|καρτα|card|μετρητά|μετρητα|cash|revolut|revolout|revoloyt|revolute|revo|ρεβολουτ|ρεβολου|ρεβολοτ|ρεβο)\b/gi,'').trim() || 'Έξοδο';
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
  else if(/revolut|revolout|revoloyt|revolute|revo|ρεβολουτ|ρεβολου|ρεβολοτ|ρεβο/.test(lower)) paymentSourceName='Revolut';

  return {name,amount,category,paymentSourceName};
}

function quickAddPreviewData(text){
  const value=(typeof normalizeQuickExpenseText==='function' ? normalizeQuickExpenseText(text) : (text||'')).trim();
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


/* ============================================================
   CAPVO v1.1.7 - First-use Wizard / Onboarding
   ============================================================ */

// ===== END 06d1-misc-ui.js =====
