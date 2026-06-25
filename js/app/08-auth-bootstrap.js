// CAPVO app split: 08-auth-bootstrap.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.


// ============================================================
// CAPVO PWA v1.0.2 — Service worker registration + zoom guard
// ============================================================
(function capvoPwaRuntimeGuards(){
  window.CAPVO_VERSION = window.CAPVO_VERSION || '1.0.2';

  // iOS Safari/PWA: prevent accidental pinch/double-tap zoom.
  // The viewport meta handles most cases; gesture/touch guards cover iOS edge cases.
  ['gesturestart','gesturechange','gestureend'].forEach(function(evt){
    document.addEventListener(evt, function(e){
      e.preventDefault();
    }, { passive:false });
  });

  // Extra iOS/PWA guard: stop pinch zoom even on charts/SVG/canvas areas.
  document.addEventListener('touchstart', function(e){
    if(e.touches && e.touches.length > 1){
      e.preventDefault();
    }
  }, { passive:false });

  document.addEventListener('touchmove', function(e){
    if(e.touches && e.touches.length > 1){
      e.preventDefault();
    }
  }, { passive:false });

  // Desktop/mobile web edge case: Ctrl/trackpad zoom.
  document.addEventListener('wheel', function(e){
    if(e.ctrlKey){
      e.preventDefault();
    }
  }, { passive:false });

  var lastTouchEnd = 0;
  document.addEventListener('touchend', function(e){
    var now = Date.now();
    if(now - lastTouchEnd <= 300){
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive:false });

  // Register the browser service worker for the PWA app shell.
  // This is NOT the Cloudflare Worker.
  if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('./service-worker.js')
        .then(function(reg){
          if(reg && reg.update) reg.update();
          console.info('[CAPVO] PWA service worker registered v' + window.CAPVO_VERSION);
        })
        .catch(function(err){
          console.warn('[CAPVO] PWA service worker registration failed', err);
        });
    });
  }
})();

// ===== AUTH BOOTSTRAP SAFETY =====
// Do not depend on advisor.js being the last script. initApp has an internal
// guard, so the later advisor.js call is harmless.
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{if(typeof initApp==='function')initApp();},{once:true});
}else{
  if(typeof initApp==='function')initApp();
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
// CAPVO — Dock Clearance V6 (PWA stable, no scroll jitter)
// Why:
// - V5 recalculated the dock clearance during scroll/touch/visualViewport scroll.
// - On iOS/PWA, when the user reaches the very bottom, rubber-band/bounce changes
//   the measured dock position by a few px and the page padding updates repeatedly.
// - That creates the small "tremble" the user sees at the bottom.
// Fix:
// - Measure on layout-changing events only: load, resize, orientation, tab click,
//   and content mutations.
// - Do NOT update while the page is actively scrolling.
// - Use hysteresis: ignore tiny changes under 6px.
// ============================================================
(function capvoDockClearanceV6(){
  const root = document.documentElement;
  let raf = 0;
  let lastValue = 0;
  let scrollTimer = 0;
  let isScrolling = false;
  let mutationTimer = 0;

  function clamp(n, min, max){
    return Math.min(max, Math.max(min, n));
  }

  function getDock(){
    return document.querySelector('.mobile-bottom-nav');
  }

  function measureDockSpace(){
    raf = 0;

    const nav = getDock();
    if(!nav || window.innerWidth > 768){
      root.style.removeProperty('--capvo-dock-real-space');
      lastValue = 0;
      return;
    }

    const rect = nav.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;

    // Ignore unstable measurements during active scroll/rubber-band.
    // A delayed pass after scrollend/touchend will correct it if needed.
    if(isScrolling && lastValue){
      return;
    }

    const dockLooksSettled = rect.height > 40 && rect.top > viewportHeight * 0.52;
    const measuredCover = dockLooksSettled ? Math.max(0, viewportHeight - rect.top) : 0;
    const fallback = (rect.height > 40 ? rect.height : 78) + 38;
    const wanted = measuredCover ? measuredCover + 24 : fallback;

    // Keep this stable. It should be enough for the last card, but never create
    // the huge blank area from the first attempts.
    const nextValue = Math.ceil(clamp(wanted, 124, 168));

    // Hysteresis: avoid 1-5px changes causing visual shaking at scroll limits.
    if(lastValue && Math.abs(nextValue - lastValue) < 6){
      return;
    }

    lastValue = nextValue;
    root.style.setProperty('--capvo-dock-real-space', nextValue + 'px');
    root.classList.add('capvo-dock-ready');
  }

  function schedule(delay){
    if(delay){
      setTimeout(schedule, delay);
      return;
    }
    if(raf) return;
    raf = requestAnimationFrame(measureDockSpace);
  }

  function markScrolling(){
    isScrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(()=>{
      isScrolling = false;
      schedule(80);
    }, 180);
  }

  window.capvoUpdateDockSpace = schedule;

  ['DOMContentLoaded','load','resize','orientationchange'].forEach(evt=>{
    window.addEventListener(evt, ()=>schedule(), {passive:true});
  });

  // Scroll only marks state; it does not update the CSS variable continuously.
  window.addEventListener('scroll', markScrolling, {passive:true});
  document.addEventListener('touchmove', markScrolling, {passive:true});
  document.addEventListener('touchend', ()=>{ isScrolling=false; schedule(120); }, {passive:true});

  // Tab clicks, modal opens, and UI interactions can change active content height.
  ['click','pointerdown'].forEach(evt=>{
    document.addEventListener(evt, ()=>schedule(90), {passive:true, capture:true});
  });

  if(window.visualViewport){
    // Resize matters (keyboard/orientation). visualViewport scroll is intentionally
    // ignored because it fires during iOS toolbar/bounce and caused jitter.
    window.visualViewport.addEventListener('resize', ()=>schedule(80), {passive:true});
  }

  if('ResizeObserver' in window){
    const ro = new ResizeObserver(()=>schedule(60));
    const tryObserve = ()=>{
      const nav = getDock();
      if(nav) ro.observe(nav);
    };
    tryObserve();
    setTimeout(tryObserve, 500);
  }

  if('MutationObserver' in window){
    const observer = new MutationObserver(()=>{
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(()=>schedule(), 120);
    });
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style']});
  }

  // Initial PWA passes after first paint/data render.
  [0, 120, 300, 700, 1200].forEach(ms=>schedule(ms));
})();
