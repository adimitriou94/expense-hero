// CAPVO app split: 06c-nav-auth.js
// Navigation (go router), Auth (Google login, Telegram linking), initApp
// Source: 06-modals-nav-auth.js lines 2358-3101


function go(v,b){
  capvoBlurActiveField?.();
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));

  const target=$(v);
  if(target)target.classList.add('active');

  const mobileMoreViews=new Set(['vIncome','vCards','vSavings','vAdvisor','vStats','vArchive','vSettings']);
  const activeNavView=mobileMoreViews.has(v) ? 'vMore' : v;

  document.querySelectorAll('.nav-btn').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll(`.nav-btn[data-v="${activeNavView}"]`).forEach(el=>el.classList.add('active'));

  if(b && b.classList && b.classList.contains('nav-btn')){
    b.classList.add('active');
  }

  capvoScrollToTop?.();
}
function chMonth(d){const[y,mo]=curM.split('-').map(Number);let nm=mo+d,ny=y;if(nm>12){nm=1;ny++}if(nm<1){nm=12;ny--}curM=ny+'-'+String(nm).padStart(2,'0');ensM(curM);render()}
function goM(k){curM=k;ensM(k);go('vDash',document.querySelector('[data-v="vDash"]'));render()}

async function signInWithGoogle(){
  showAuthLoader();

  const redirectTo=window.location.origin+window.location.pathname;

  const {error}=await supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo,
      queryParams:{
        access_type:'offline',
        prompt:'select_account'
      }
    }
  });

  if(error){
    clearAuthLoader();
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

  const metadataPayload={
    user_id:user.id,
    email:user.email||'',
    full_name:metadata.full_name||metadata.name||'',
    avatar_url:metadata.avatar_url||metadata.picture||'',
    updated_at:new Date().toISOString()
  };

  const {data:existing,error:selectError}=await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id',user.id)
    .maybeSingle();

  if(selectError)throw selectError;

  if(existing){
    const updatePayload={...metadataPayload};

    // Production ownership now uses auth user_id. Older MVP builds stored
    // synthetic values like capvo_<user_id> in telegram_chat_id only to satisfy
    // Telegram-first RLS. Clear those values so Telegram remains a real optional link.
    if(existing.telegram_chat_id && !isRealTelegramChatId(existing.telegram_chat_id)){
      updatePayload.telegram_chat_id=null;
    }

    const {data,error}=await supabaseClient
      .from('profiles')
      .update(updatePayload)
      .eq('user_id',user.id)
      .select('*')
      .single();

    if(error){
      console.warn('Profile metadata update failed, using existing profile:',error);
      return {...existing,...updatePayload};
    }

    return data;
  }

  const insertPayload={
    ...metadataPayload,
    telegram_chat_id:null
  };

  const {data,error}=await supabaseClient
    .from('profiles')
    .insert(insertPayload)
    .select('*')
    .single();

  if(error)throw error;

  return data;
}


async function migrateLocalOwnerDataToTelegram(previousOwnerId,newTelegramChatId){
  // No-op after production ownership migration.
  // Finance data belongs to auth user_id; Telegram is only a linked input channel.
  return;
}


async function saveTelegramChatId(ev){
  if(ev)ev.preventDefault();

  const input=$('chatIdInput');
  const codeInput=$('telegramCodeInput');
  const err=$('authError');

  const chatId=(input?.value||'').trim();
  const code=(codeInput?.value||'').trim();
  const previousOwnerId=getDataOwnerId();

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

    let data={};

    try{
      data=await res.json();
    }catch(jsonError){
      data={
        error:'Verification response was not JSON',
        message:'Δεν μπορέσαμε να διαβάσουμε την απάντηση επιβεβαίωσης. Δοκίμασε ξανά.'
      };
    }

    if(!res.ok || data.error){
      const verificationError=new Error(data.message||data.error||'Verification failed');
      verificationError.code=data.code||'';
      verificationError.status=res.status;
      verificationError.detail=data.detail||'';
      throw verificationError;
    }

    let verifiedProfile=data.profile||null;

    // Telegram linking is a privileged operation and must be completed by the
    // Worker after validating the Telegram /code. The frontend must not update
    // profiles.telegram_chat_id directly.
    currentProfile={
      ...(currentProfile||{}),
      ...(verifiedProfile||{}),
      telegram_chat_id:chatId
    };

    changingTelegramId=false;
    localStorage.setItem(SK,chatId);

    const btn=$('authSubmitBtn');

    if(btn){
      btn.disabled=true;
      btn.innerHTML='⏳ Φόρτωση...';
    }

    showMiniToast('✅ Το Telegram συνδέθηκε');

    await loadUserData();

    return;

  }catch(e){
    console.error('saveTelegramChatId error:',e);

    if(err){
      const code=e?.code||'';
      let message=e?.message||'Δεν έγινε επιβεβαίωση. Έλεγξε Chat ID και κωδικό.';

      if(code==='TELEGRAM_ALREADY_LINKED_TO_OTHER_ACCOUNT'){
        message='Αυτό το Telegram είναι ήδη συνδεδεμένο με άλλο λογαριασμό. Για test, καθάρισε πρώτα το telegram_chat_id από το παλιό profile ή μπες με τον παλιό λογαριασμό.';
      }else if(code==='TELEGRAM_LINK_CODE_INVALID_OR_EXPIRED'){
        message='Ο κωδικός δεν είναι σωστός ή έχει λήξει. Στείλε ξανά /code στο Telegram bot και δοκίμασε ξανά.';
      }else if(code==='TELEGRAM_LINK_INVALID_FORMAT'){
        message='Το Chat ID πρέπει να είναι αριθμός και ο κωδικός πρέπει να είναι 6 ψηφία.';
      }else if(code==='TELEGRAM_LINK_PROFILE_UPDATE_FAILED'){
        message='Ο κωδικός επιβεβαιώθηκε, αλλά δεν μπορέσαμε να συνδέσουμε το Telegram στο profile. Δοκίμασε ξανά.';
      }else if(!message || message==='Verification failed' || message==='Profile update failed'){
        message='Δεν έγινε επιβεβαίωση. Έλεγξε Chat ID και κωδικό.';
      }

      err.textContent=message;
    }
  }finally{
    setAuthLoading(false);
  }
}


function showAuthLoader(){
  document.body.classList.add('auth-pending');

  const auth=$('authScreen');
  const err=$('authError');

  if(auth){
    auth.classList.remove('auth-hidden');
    auth.classList.add('capvo-auth-loading');
    auth.style.display='flex';
    auth.style.pointerEvents='auto';
    auth.style.opacity='1';
    auth.style.visibility='visible';
    auth.style.zIndex='9999';
  }

  if(err)err.textContent='';
}

function clearAuthLoader(){
  const auth=$('authScreen');
  if(auth)auth.classList.remove('capvo-auth-loading');
}

function showApp(){
  clearAuthLoader();

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


function cancelTelegramLinkFlow(){
  changingTelegramId=false;

  const cameFromWizard=!!window.__capvoTelegramFromWizardFinish;
  window.__capvoTelegramFromWizardFinish=false;

  const chatInput=$('chatIdInput');
  const codeInput=$('telegramCodeInput');
  const err=$('authError');

  if(chatInput)chatInput.value='';
  if(codeInput)codeInput.value='';
  if(err)err.textContent='';

  renderAuthState();
  hideAuth();

  if(cameFromWizard && typeof showCapvoOnboardingCompletion==='function'){
    showCapvoOnboardingCompletion();
    return;
  }

  try{
    if(currentUser){
      go('vDash',document.querySelector('[data-v="vDash"]'));
    }
  }catch(e){}
}

function capvoEnsureTelegramLinkTopbar(){
  const box=$('telegramLinkBox');
  if(!box)return;

  let topbar=box.querySelector('.capvo-telegram-option-b-topbar');
  if(!topbar){
    topbar=document.createElement('div');
    topbar.className='capvo-telegram-option-b-topbar';
    box.prepend(topbar);
  }

  const label=window.__capvoTelegramFromWizardFinish ? 'Πίσω στο τέλος' : 'Ακύρωση';
  topbar.innerHTML=`
    <button type="button" class="capvo-telegram-single-exit-btn" onclick="cancelTelegramLinkFlow()">${label}</button>
  `;
}

function capvoEnsureTelegramOptionBVisual(){
  const box=$('telegramLinkBox');
  if(!box || box.querySelector('.capvo-telegram-option-b-orb'))return;

  const userBox=$('authUserBox');
  const orb=document.createElement('div');
  orb.className='capvo-telegram-option-b-orb';
  orb.setAttribute('aria-hidden','true');
  orb.innerHTML='<span></span>';

  const hero=box.querySelector('.capvo-wizard-hero');
  if(hero){
    hero.parentNode.insertBefore(orb, hero);
  }else if(userBox){
    userBox.insertAdjacentElement('afterend', orb);
  }else{
    box.prepend(orb);
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

  // CAPVO v1.1.7.4
  // Telegram linking is no longer part of the mandatory post-Google-login flow.
  // After Google auth, the user should go to onboarding/dashboard. The Telegram
  // screen must be shown only from an explicit action, e.g. Settings -> connect/change Telegram,
  // or an onboarding CTA that intentionally sets changingTelegramId=true.
  const shouldShowTelegramLink = !!changingTelegramId;
  if(telegramBox)telegramBox.style.display = shouldShowTelegramLink ? 'block' : 'none';

  if(!shouldShowTelegramLink){
    return;
  }

  capvoEnsureTelegramLinkTopbar();
  capvoEnsureTelegramOptionBVisual();

  const forceTelegramTop=()=>{
    const auth=$('authScreen');
    const card=auth?.querySelector?.('.capvo-auth-card');
    const box=$('telegramLinkBox');
    try{
      window.scrollTo({top:0,left:0,behavior:'auto'});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      if(auth)auth.scrollTop=0;
      if(card)card.scrollTop=0;
      if(box)box.scrollTop=0;
    }catch(e){}
  };
  requestAnimationFrame(forceTelegramTop);
  setTimeout(forceTelegramTop,80);

  if(userBox){
    userBox.innerHTML=`
      <span>Google λογαριασμός</span>
      <strong>${esc(currentUser.email||'Google user')}</strong>
    `;
  }

  const realTelegramChatId=getTelegramChatId();

  if(realTelegramChatId && !changingTelegramId){
    const input=$('chatIdInput');
    if(input)input.value=realTelegramChatId;
  }
}

function setAuthLoading(isLoading){const btn=$('authSubmitBtn');if(!btn)return;btn.disabled=isLoading;btn.textContent=isLoading?'Σύνδεση...':'Σύνδεση'}

function showAuth(message){
  clearAuthLoader();

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

  // Avoid auto-focus on Telegram linking screens, especially mobile.
  // Focusing the Chat ID field opens the keyboard and scrolls the card to the lower inputs.
  if(input && !changingTelegramId){
    setTimeout(()=>input.focus(),80);
  }
}

function hideAuth(){
  clearAuthLoader();

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


function capvoShouldOpenOnboardingBeforeDashboard(){
  try{
    const prefs=D.preferences||{};
    if(prefs.onboardingCompleted || prefs.onboardingDismissed)return false;
    if(typeof capvoHasBasicSetup==='function' && capvoHasBasicSetup())return false;
    return !!currentUser;
  }catch(e){
    return false;
  }
}

async function loadUserData(userId){
  const ownerId=userId||getDataOwnerId();
  await fetchAllData(ownerId);
  curM=curMK();
  ensM(curM);

  const openWizardFirst=capvoShouldOpenOnboardingBeforeDashboard();

  render();

  if(openWizardFirst){
    document.body.classList.add('capvo-auth-to-wizard-transition');
    hideAuth();
    window.__capvoWizardSmoothIntro=true;

    await new Promise(resolve=>setTimeout(resolve,140));

    if(typeof openCapvoOnboardingWizard==='function'){
      openCapvoOnboardingWizard(0);
    }else if(typeof capvoAfterUserDataLoaded==='function'){
      await capvoAfterUserDataLoaded(ownerId);
    }

    setTimeout(()=>document.body.classList.remove('capvo-auth-to-wizard-transition'),760);
    return;
  }

  go('vDash',document.querySelector('[data-v="vDash"]'));
  hideAuth();

  if(typeof capvoAfterUserDataLoaded==='function'){
    await capvoAfterUserDataLoaded(ownerId);
  }
}

async function connectWithChatId(ev){
  return saveTelegramChatId(ev);
}

function switchChatId(){

  changingTelegramId=true;

  closeM();

  const input=$('chatIdInput');
  const codeInput=$('telegramCodeInput');
  if(input)input.value='';
  if(codeInput)codeInput.value='';

  showAuth(getTelegramChatId()?'Σύνδεσε νέο Telegram Chat ID. Μέχρι να ολοκληρωθεί η αλλαγή, η παλιά σύνδεση παραμένει ενεργή.':'Σύνδεσε το Telegram για να ενεργοποιήσεις το Sync.');
  renderAuthState();

  const auth=$('authScreen');
  const card=auth?.querySelector?.('.capvo-auth-card');
  const box=$('telegramLinkBox');

  const forceTelegramTop=()=>{
    try{
      window.scrollTo({top:0,left:0,behavior:'auto'});
      document.documentElement.scrollTop=0;
      document.body.scrollTop=0;
      if(auth)auth.scrollTop=0;
      if(card)card.scrollTop=0;
      if(box)box.scrollTop=0;
    }catch(e){}
  };

  requestAnimationFrame(forceTelegramTop);
  setTimeout(forceTelegramTop,80);
  setTimeout(forceTelegramTop,220);

  const btn=$('authSubmitBtn');

  if(btn){
    btn.disabled=false;
    btn.textContent='Σύνδεση Telegram';
  }

  // Do not auto-focus here. The Telegram screen should always open from the top.
  // User can tap the fields manually after reading the instructions.
}



/* CAPVO v1.1.7.35 — Exact Settings Telegram card CTA layout */
function capvoPolishSettingsTelegramCta(){
  try{
    const card=document.querySelector('#vSettings .settings-telegram-card');
    if(!card)return;

    const row=card.querySelector('.settings-actions');
    const syncBtn=card.querySelector('#syncBtn');
    const changeBtn=card.querySelector('#changeTelegramBtn');
    const label=card.querySelector('#settingsTelegramLabel');

    if(!row || !changeBtn)return;

    const labelText=(label?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    const chatIdText=(card.querySelector('#settingsChatId')?.textContent||'').replace(/\s+/g,' ').trim();
    const disconnected =
      labelText.includes('δεν έχει συνδεθεί') ||
      labelText.includes('δεν εχει συνδεθει') ||
      labelText.includes('not connected') ||
      !chatIdText ||
      chatIdText==='—' ||
      chatIdText==='-';

    if(disconnected){
      row.classList.add('telegram-disconnected');
      row.classList.remove('telegram-connected');

      if(syncBtn){
        syncBtn.style.display='none';
        syncBtn.setAttribute('aria-hidden','true');
      }

      changeBtn.style.display='flex';
      changeBtn.style.width='100%';
      changeBtn.style.maxWidth='none';
      changeBtn.style.justifyContent='center';
      changeBtn.style.alignItems='center';
      changeBtn.textContent='Σύνδεση Telegram';
    }else{
      row.classList.remove('telegram-disconnected');
      row.classList.add('telegram-connected');

      if(syncBtn){
        syncBtn.style.display='';
        syncBtn.removeAttribute('aria-hidden');
      }

      changeBtn.style.display='';
      changeBtn.style.width='';
      changeBtn.style.maxWidth='';
      changeBtn.style.justifyContent='';
      changeBtn.style.alignItems='';
      if(!/αλλαγή|αλλαγη/i.test(changeBtn.textContent||'')){
        changeBtn.textContent='Αλλαγή Telegram';
      }
    }
  }catch(e){}
}

function capvoInstallSettingsTelegramCtaPolish(){
  if(window.__capvoSettingsTelegramCtaObserverInstalledV35)return;
  window.__capvoSettingsTelegramCtaObserverInstalledV35=true;

  const run=()=>capvoPolishSettingsTelegramCta();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',run,{once:true});
  }else{
    run();
  }

  const obs=new MutationObserver(()=>{
    if(window.__capvoSettingsTelegramCtaPolishTimer)clearTimeout(window.__capvoSettingsTelegramCtaPolishTimer);
    window.__capvoSettingsTelegramCtaPolishTimer=setTimeout(run,40);
  });

  obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
  setTimeout(run,100);
  setTimeout(run,400);
  setInterval(run,1000);
}

capvoInstallSettingsTelegramCtaPolish();


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

// ===== END 06c-nav-auth.js =====
