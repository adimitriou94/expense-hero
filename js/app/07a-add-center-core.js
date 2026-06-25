// CAPVO app split: 07a-add-center-core.js
// V1 Core: Quick/Manual tabs, payment picker, category picker, manual form, recent chips
// Source: 07-add-center.js lines 1-502

// CAPVO app split: 07-add-center.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== ADD CENTER V1 — Quick / Αναλυτικό tabs =====
function addCenterToday(){
  return typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');
}

function fillAddCenterPaymentSources(selectedId='',opts={}){
  const el=document.getElementById('acDPay');
  if(!el)return;

  const sources=(typeof availablePaymentSources==='function')
    ? availablePaymentSources()
    : [];
  const hasWalletModel=typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel();
  const defaultWalletId=hasWalletModel && !selectedId && !opts.preserveBlank
    ? (typeof capvoDefaultWallet==='function'?capvoDefaultWallet()?.id:'')
    : '';
  const effectiveSelected=selectedId || defaultWalletId || '';

  el.innerHTML=`
    ${hasWalletModel?'':`<option value="" ${!effectiveSelected?'selected':''}>Κανονικό budget</option>`}
    ${sources.map(s=>{
      const isWallet=typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(s);
      const isCard=s.type==='credit_card' || s.accountType==='credit_card';
      const balance=isWallet ? ` · ${fmt(Number(s.currentBalance)||0)}` : '';
      // Keep the native option text clean. The custom picker renders the icon separately,
      // so including it here creates duplicate icons in the visible mobile UI.
      return `<option value="${esc(s.id)}" ${String(s.id)===String(effectiveSelected)?'selected':''}>${esc(s.name)}${balance}</option>`;
    }).join('')}
  `;

  if(effectiveSelected){
    el.value=effectiveSelected;
  }

  renderAddCenterPaymentPicker();
  syncAddCenterPaymentPicker();
}

function paymentSourceLabelById(id){
  if(!id)return (typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel())?'Επίλεξε wallet':'Κανονικό budget';

  const source=(typeof paymentSourceById==='function')
    ? paymentSourceById(id)
    : (D.incomeSources||[]).find(s=>s.id===id);

  if(source && typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source)){
    const bal=Number(source.currentBalance)||0;
    return `${source.name||'Wallet'} · ${typeof fmt==='function'?fmt(bal):bal+'€'}`;
  }
  return source?.name || 'Πηγή πληρωμής';
}

function paymentSourceCompactLabelById(id){
  if(!id)return (typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel())?'Επίλεξε wallet':'Κανονικό budget';

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

  if(typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(source))return '💳';
  if(typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source))return source?.icon||'🏦';
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
  if(text)text.textContent=paymentSourceCompactLabelById(value);
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
  const c=(typeof capvoRootCategoryByName==='function')?capvoRootCategoryByName(category):null;
  if(c?.icon)return c.icon;
  if(typeof CEMO!=='undefined' && CEMO[category])return CEMO[category];
  return '📌';
}
function addCenterSelectedRootCategory(){
  const select=document.getElementById('acDC');
  const selectedId=select?.value||'';
  return (typeof capvoCategoryById==='function'?capvoCategoryById(selectedId):null)
    || (typeof capvoDefaultRootCategory==='function'?capvoDefaultRootCategory():null);
}
function addCenterCustomCategoryValue(){return '__custom__';}
function normalizeAddCenterCategoryName(value){
  return typeof capvoNormalizeTextKey==='function'
    ? capvoNormalizeTextKey(value)
    : String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function addCenterSelectedCustomSubcategoryName(){
  return String(document.getElementById('acDCustomSubcategoryName')?.value||'').trim();
}
function addCenterManualSaveToast(message,type='error'){
  if(typeof clearQuickAddInlineError==='function')clearQuickAddInlineError('addCenterManualError');
  if(typeof showMiniToast==='function')showMiniToast(message,type);
}
function syncAddCenterCustomSubcategoryUI(){
  const select=document.getElementById('acDSubcategory');
  const block=document.getElementById('acDCustomSubcategoryBlock');
  const custom=select?.value===addCenterCustomCategoryValue();
  block?.classList.toggle('hidden',!custom);
  if(!custom){
    const input=document.getElementById('acDCustomSubcategoryName');
    const save=document.getElementById('acDSaveCustomSubcategory');
    if(input)input.value='';
    if(save)save.checked=false;
  }
}
async function capvoEnsureCustomSubcategory(parentId,name){
  const clean=String(name||'').trim().replace(/\s+/g,' ');
  if(!clean)return null;
  const parent=typeof capvoCategoryById==='function'?capvoCategoryById(parentId):null;
  if(!parent || parent.parentId)return null;
  const userId=typeof getDataOwnerId==='function'?getDataOwnerId():'';
  if(!userId)throw new Error('Missing user for custom category.');
  const key=normalizeAddCenterCategoryName(clean);
  const existing=(typeof capvoSubcategories==='function'?capvoSubcategories(parent.id):[])
    .find(c=>normalizeAddCenterCategoryName(c.name)===key);
  if(existing)return existing;
  if(typeof supabaseClient==='undefined' || !supabaseClient)throw new Error('Supabase client unavailable.');
  const row={
    user_id:userId,
    parent_id:parent.id,
    name:clean,
    icon:'🏷️',
    color:parent.color||'#6547f6',
    css_class:parent.cssClass||parent.css_class||'cat-other',
    sort_order:999,
    is_system:false,
    is_active:true,
    keywords:[]
  };
  const {data,error}=await supabaseClient
    .from('expense_categories')
    .insert(row)
    .select('*')
    .single();
  if(error)throw error;
  const mapped={
    id:data.id,
    userId:data.user_id||null,
    parentId:data.parent_id||null,
    name:data.name,
    icon:data.icon||'🏷️',
    color:data.color||parent.color||'#6547f6',
    cssClass:data.css_class||parent.cssClass||'cat-other',
    sortOrder:Number(data.sort_order)||999,
    isSystem:!!data.is_system,
    keywords:Array.isArray(data.keywords)?data.keywords:[]
  };
  if(typeof D!=='undefined'){
    D.expenseCategories=Array.isArray(D.expenseCategories)?D.expenseCategories:[];
    D.expenseCategories.push(mapped);
  }
  return mapped;
}
function renderAddCenterCategoryOptions(selectedIdOrName=''){
  const select=document.getElementById('acDC');
  const list=document.getElementById('acDCCustomList');
  if(!select || !list)return;
  const roots=(typeof capvoRootCategories==='function'?capvoRootCategories():[]);
  const fallback=roots[0] || null;
  let selected=(typeof capvoCategoryById==='function'?capvoCategoryById(selectedIdOrName):null)
    || (typeof capvoRootCategoryByName==='function'?capvoRootCategoryByName(selectedIdOrName):null)
    || fallback;
  if(!selected)return;
  select.innerHTML=roots.map(c=>`<option value="${esc(c.id)}">${esc(c.icon||'📌')} ${esc(c.name)}</option>`).join('');
  select.value=selected.id;
  list.innerHTML=roots.map(c=>`
    <button type="button" data-category-id="${esc(c.id)}" onclick="selectAddCenterCategory('${esc(c.id)}')">
      <span>${esc(c.icon||'📌')}</span><strong>${esc(c.name)}</strong>
    </button>`).join('');
  renderAddCenterSubcategoryOptions('',selected.id);
  syncAddCenterCategoryPicker();
}
function renderAddCenterSubcategoryOptions(selectedId='',parentId=''){
  const select=document.getElementById('acDSubcategory');
  const list=document.getElementById('acDSubcategoryCustomList');
  if(!select)return;
  const root=parentId ? (typeof capvoCategoryById==='function'?capvoCategoryById(parentId):null) : addCenterSelectedRootCategory();
  const children=(typeof capvoSubcategories==='function' && root?.id)?capvoSubcategories(root.id):[];
  const customValue=addCenterCustomCategoryValue();
  select.innerHTML=`<option value="">Χωρίς υποκατηγορία</option>`
    +children.map(c=>`<option value="${esc(c.id)}">${esc(c.icon||'📌')} ${esc(c.name)}</option>`).join('')
    +`<option value="${customValue}">✍️ Δική μου υποκατηγορία...</option>`;
  if(selectedId && [...select.options].some(o=>String(o.value)===String(selectedId)))select.value=selectedId;
  else select.value='';
  if(list){
    const noSubActive=!select.value;
    const customActive=select.value===customValue;
    list.innerHTML=`
      <button type="button" data-subcategory-id="" class="${noSubActive?'active':''}" onclick="selectAddCenterSubcategory('')">
        <span>—</span><strong>Χωρίς υποκατηγορία</strong>
      </button>
    `+children.map(c=>`
      <button type="button" data-subcategory-id="${esc(c.id)}" class="${String(select.value)===String(c.id)?'active':''}" onclick="selectAddCenterSubcategory('${esc(c.id)}')">
        <span>${esc(c.icon||'📌')}</span><strong>${esc(c.name)}</strong>
      </button>`).join('')+`
      <button type="button" data-subcategory-id="${customValue}" class="add-center-custom-subcategory-option ${customActive?'active':''}" onclick="selectAddCenterSubcategory('${customValue}')">
        <span>✍️</span><strong>Δική μου υποκατηγορία...</strong>
      </button>`;
  }
  syncAddCenterSubcategoryPicker();
  syncAddCenterCustomSubcategoryUI();
}
function closeAddCenterSubcategoryPicker(){
  const list=document.getElementById('acDSubcategoryCustomList');
  const btn=document.getElementById('acDSubcategoryCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}
function toggleAddCenterSubcategoryPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  closeAddCenterCategoryPicker();
  closeAddCenterPaymentPicker();
  const list=document.getElementById('acDSubcategoryCustomList');
  const btn=document.getElementById('acDSubcategoryCustom');
  if(!list || !btn)return;
  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}
function selectAddCenterSubcategory(subcategoryId){
  const select=document.getElementById('acDSubcategory');
  if(!select)return;
  select.value=subcategoryId||'';
  select.dispatchEvent(new Event('change',{bubbles:true}));
  syncAddCenterSubcategoryPicker();
  syncAddCenterCustomSubcategoryUI();
  closeAddCenterSubcategoryPicker();
  if(select.value===addCenterCustomCategoryValue()){
    setTimeout(()=>document.getElementById('acDCustomSubcategoryName')?.focus(),80);
  }
  clearQuickAddInlineError('addCenterManualError');
}
function closeAddCenterCategoryPicker(){
  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  list?.classList.remove('active');
  btn?.classList.remove('active');
  btn?.setAttribute('aria-expanded','false');
}
function syncAddCenterSubcategoryPicker(){
  const select=document.getElementById('acDSubcategory');
  const text=document.getElementById('acDSubcategoryCustomText');
  const icon=document.getElementById('acDSubcategoryCustomIcon');
  const list=document.getElementById('acDSubcategoryCustomList');
  const isCustom=select?.value===addCenterCustomCategoryValue();
  const c=!isCustom && select?.value && typeof capvoCategoryById==='function' ? capvoCategoryById(select.value) : null;
  if(text)text.textContent=isCustom?'Δική μου υποκατηγορία':(c?.name||'Χωρίς υποκατηγορία');
  if(icon)icon.textContent=isCustom?'✍️':(c?.icon||'🏷️');
  list?.querySelectorAll('button').forEach(btn=>{
    btn.classList.toggle('active',String(btn.dataset.subcategoryId||'')===String(select?.value||''));
  });
  syncAddCenterCustomSubcategoryUI();
}
function syncAddCenterCategoryPicker(){
  const select=document.getElementById('acDC');
  const text=document.getElementById('acDCCustomText');
  const icon=document.getElementById('acDCCustomIcon');
  const list=document.getElementById('acDCCustomList');
  if(!select)return;

  const c=(typeof capvoCategoryById==='function'?capvoCategoryById(select.value):null)
    || (typeof capvoDefaultRootCategory==='function'?capvoDefaultRootCategory():null);
  if(c && select.value!==c.id)select.value=c.id;
  if(text)text.textContent=c?.name||'Άλλο';
  if(icon)icon.textContent=c?.icon||'📌';

  list?.querySelectorAll('button').forEach(btn=>{
    btn.classList.toggle('active',String(btn.dataset.categoryId||'')===String(c?.id||''));
  });
  renderAddCenterSubcategoryOptions(document.getElementById('acDSubcategory')?.value||'',c?.id||'');
}
function toggleAddCenterCategoryPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();

  closeAddCenterPaymentPicker();
  closeAddCenterSubcategoryPicker();

  const list=document.getElementById('acDCCustomList');
  const btn=document.getElementById('acDCCustom');
  if(!list || !btn)return;

  const open=!list.classList.contains('active');
  list.classList.toggle('active',open);
  btn.classList.toggle('active',open);
  btn.setAttribute('aria-expanded',String(open));
}
function selectAddCenterCategory(categoryId){
  const select=document.getElementById('acDC');
  if(!select)return;

  select.value=categoryId;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  renderAddCenterSubcategoryOptions('',categoryId);
  syncAddCenterCategoryPicker();
  closeAddCenterCategoryPicker();
  clearQuickAddInlineError('addCenterManualError');
}
function setAddCenterCategoryFromExpense(e){
  const meta=typeof capvoResolveExpenseCategoryMeta==='function'?capvoResolveExpenseCategoryMeta(e):null;
  renderAddCenterCategoryOptions(meta?.categoryId||e?.category||'');
  renderAddCenterSubcategoryOptions(meta?.subcategoryId||'',meta?.categoryId||'');
  syncAddCenterCustomSubcategoryUI();
}

function resetAddCenterManualForm(){
  const name=document.getElementById('acDN');
  const amount=document.getElementById('acDA');
  const cat=document.getElementById('acDC');
  const subcat=document.getElementById('acDSubcategory');
  const merchant=document.getElementById('acDMerchant');
  const date=document.getElementById('acDD');
  const notes=document.getElementById('acDNotes');

  if(name)name.value='';
  if(amount)amount.value='';
  if(typeof renderAddCenterCategoryOptions==='function')renderAddCenterCategoryOptions('Τρόφιμα');
  else if(cat)cat.value='Τρόφιμα';
  if(subcat)subcat.value='';
  if(merchant)merchant.value='';
  const customInput=document.getElementById('acDCustomSubcategoryName');
  const customSave=document.getElementById('acDSaveCustomSubcategory');
  if(customInput)customInput.value='';
  if(customSave)customSave.checked=false;
  syncAddCenterCategoryPicker();
  syncAddCenterCustomSubcategoryUI();
  closeAddCenterCategoryPicker();
  closeAddCenterSubcategoryPicker();
  closeAddCenterPaymentPicker();
  if(date)date.value=addCenterToday();
  if(notes)notes.value='';

  fillAddCenterPaymentSources('');
  clearQuickAddInlineError('addCenterManualError');
}

function switchAddCenterTab(tab='quick'){
  capvoSuppressAutoFocus?.(600);
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
    // autofocus disabled: user taps the field when ready;
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
  capvoSuppressAutoFocus?.(900);
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
    // autofocus disabled: user taps the field when ready;
  },140);
}

function closeAddCenterSheet(event){
  // Overlay background tap: accept if target is root element or overlay div itself
  if(event && event.target){
    const root=document.getElementById('addCenterSheet');
    const isOverlayTap=event.target===root;
    const isRootTap=event.target.id==='addCenterSheet';
    if(!isOverlayTap && !isRootTap)return;
  }

  addCenterEditState=null;

  const sheet=document.getElementById('addCenterSheet');
  sheet?.classList.remove('active');

  const submit=document.getElementById('addCenterManualSubmit');
  if(submit)submit.textContent='Αποθήκευση εξόδου';

  if(typeof closeAddCenterCategoryPicker==='function')closeAddCenterCategoryPicker();
  if(typeof closeAddCenterPaymentPicker==='function')closeAddCenterPaymentPicker();

  document.body.classList.remove('quick-sheet-open','add-center-open','add-center-manual-active','add-center-success-active');
}


// ===== END 07a-add-center-core.js =====
