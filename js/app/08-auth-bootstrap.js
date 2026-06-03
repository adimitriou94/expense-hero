// CAPVO app split: 08-auth-bootstrap.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== AUTH BOOTSTRAP SAFETY =====
// Do not depend on advisor.js being the last script. initApp has an internal
// guard, so the later advisor.js call is harmless.
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>initApp(),{once:true});
}else{
  initApp();
}


// ============================================================
// CAPVO FIXED EXPENSE CATEGORY PICKER — portal safety patch
// Keeps the fixed-expense category picker outside the modal clipping context.
// ============================================================
const FIXED_CATEGORY_META = window.FIXED_CATEGORY_META || {
  'Στέγαση':'🏠',
  'Λογαριασμοί':'💡',
  'Συνδρομές':'📱',
  'Μεταφορά':'🚗',
  'Δάνεια':'🏦',
  'Υγεία':'🏥',
  'Άλλο':'📌'
};

function syncFixedCategoryPicker(value){
  const selected=value||$('fFC')?.value||'Στέγαση';
  const input=$('fFC');
  const icon=$('fixedCategoryIcon');
  const label=$('fixedCategoryLabel');

  if(input)input.value=selected;
  if(icon)icon.textContent=FIXED_CATEGORY_META[selected]||'📌';
  if(label)label.textContent=selected;

  document.querySelectorAll('.fixed-category-option').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.value===selected);
  });
}

function selectFixedCategory(value, silent=false){
  syncFixedCategoryPicker(value);
  if(!silent)closeFixedCategoryPicker();
}

function ensureFixedCategoryPickerPortal(){
  const pop=$('fixedCategoryPopover');
  if(!pop)return null;
  if(pop.parentElement!==document.body){
    document.body.appendChild(pop);
  }
  return pop;
}

function toggleFixedCategoryPicker(event){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const pop=ensureFixedCategoryPickerPortal();
  if(!pop)return;
  const isOpening=!pop.classList.contains('active');
  pop.classList.toggle('active',isOpening);
  pop.setAttribute('aria-hidden',isOpening?'false':'true');
  document.body.classList.toggle('fixed-category-open',isOpening);
}

function closeFixedCategoryPicker(){
  const pop=$('fixedCategoryPopover');
  if(!pop)return;
  pop.classList.remove('active');
  pop.setAttribute('aria-hidden','true');
  document.body.classList.remove('fixed-category-open');
}

document.addEventListener('click',e=>{
  if(!e.target.closest('#mFixed .fixed-category-field') && !e.target.closest('.fixed-category-popover')){
    closeFixedCategoryPicker();
  }
});

(function(){
  const previousOpenModal=window.openModal;
  if(typeof previousOpenModal==='function' && !previousOpenModal.__capvoFixedCategoryPatched){
    window.openModal=function(t){
      previousOpenModal(t);
      if(t==='fixed'){
        syncFixedCategoryPicker($('fFC')?.value || 'Στέγαση');
      }
    };
    window.openModal.__capvoFixedCategoryPatched=true;
  }
})();
