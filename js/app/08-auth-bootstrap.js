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


// ============================================================
// CAPVO — Dynamic floating dock clearance
// Measures the real bottom dock position and exposes it as CSS variable.
// This fixes PWA/Safari cases where hardcoded bottom padding either leaves
// a huge blank area or lets the final card hide behind the floating nav.
// ============================================================
(function capvoDynamicDockClearance(){
  let raf = 0;

  function setDockSpace(){
    raf = 0;
    const nav = document.querySelector('.mobile-bottom-nav');
    const root = document.documentElement;
    if(!nav || window.innerWidth > 768){
      root.style.removeProperty('--capvo-dock-real-space');
      return;
    }

    const rect = nav.getBoundingClientRect();
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    // Space from the top of the dock to the bottom of the visible viewport.
    // Add breathing room so the last card is fully readable above the glass dock.
    const coveredByDock = Math.max(0, viewportHeight - rect.top);
    const fallback = rect.height + 48;
    const clearance = Math.ceil(Math.max(132, coveredByDock + 30, fallback));

    root.style.setProperty('--capvo-dock-real-space', clearance + 'px');
  }

  function scheduleDockSpace(){
    if(raf) return;
    raf = requestAnimationFrame(setDockSpace);
  }

  window.capvoUpdateDockSpace = scheduleDockSpace;

  ['DOMContentLoaded','load','resize','orientationchange'].forEach(evt=>{
    window.addEventListener(evt, scheduleDockSpace, {passive:true});
  });

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', scheduleDockSpace, {passive:true});
    window.visualViewport.addEventListener('scroll', scheduleDockSpace, {passive:true});
  }

  document.addEventListener('click', ()=>setTimeout(scheduleDockSpace, 60), true);
  setTimeout(scheduleDockSpace, 0);
  setTimeout(scheduleDockSpace, 350);
})();

// ============================================================
// CAPVO — Dynamic Dock Clearance V5 (PWA initial-load stable)
// Why: on first PWA open, iOS can report an unstable dock position before
// layout settles. The old measurement could create a huge blank area until
// the user tapped a tab. This version clamps the clearance and re-measures
// after render/scroll/content mutations.
// ============================================================
(function capvoDynamicDockClearanceV5(){
  let raf = 0;
  let mutationTimer = 0;

  function clamp(n, min, max){
    return Math.min(max, Math.max(min, n));
  }

  function getDock(){
    return document.querySelector('.mobile-bottom-nav');
  }

  function setDockSpace(){
    raf = 0;
    const root = document.documentElement;
    const nav = getDock();

    if(!nav || window.innerWidth > 768){
      root.style.removeProperty('--capvo-dock-real-space');
      return;
    }

    const rect = nav.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;

    // If iOS measures before the dock has settled, rect.top may be nonsense.
    // In that case use a sane fallback instead of creating a huge scroll gap.
    const dockLooksSettled = rect.height > 40 && rect.top > viewportHeight * 0.55;
    const measuredCover = dockLooksSettled ? Math.max(0, viewportHeight - rect.top) : 0;
    const fallback = (rect.height > 40 ? rect.height : 78) + 34;

    // Real desired clearance: dock height + its bottom offset + small breathing room.
    // Clamp prevents both extremes: hidden final card and giant blank area.
    const wanted = measuredCover ? measuredCover + 24 : fallback;
    const clearance = Math.ceil(clamp(wanted, 116, 172));

    root.style.setProperty('--capvo-dock-real-space', clearance + 'px');
    root.classList.add('capvo-dock-ready');
  }

  function scheduleDockSpace(delay){
    if(delay){
      setTimeout(scheduleDockSpace, delay);
      return;
    }
    if(raf) return;
    raf = requestAnimationFrame(setDockSpace);
  }

  window.capvoUpdateDockSpace = scheduleDockSpace;

  ['DOMContentLoaded','load','resize','orientationchange','scroll'].forEach(evt=>{
    window.addEventListener(evt, ()=>scheduleDockSpace(), {passive:true});
  });

  ['touchstart','touchmove','pointerdown','click'].forEach(evt=>{
    document.addEventListener(evt, ()=>scheduleDockSpace(40), {passive:true, capture:true});
  });

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', ()=>scheduleDockSpace(), {passive:true});
    window.visualViewport.addEventListener('scroll', ()=>scheduleDockSpace(), {passive:true});
  }

  // Re-measure when views render async data, when a tab changes, or when cards appear.
  if('MutationObserver' in window){
    const observer = new MutationObserver(()=>{
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(()=>scheduleDockSpace(), 80);
    });
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style']});
  }

  // iOS PWA needs a few delayed passes after first paint and after data render.
  [0, 80, 180, 350, 700, 1200, 2000].forEach(ms=>scheduleDockSpace(ms));
})();
