// CAPVO version source of truth
// Bump this value for each deploy/patch.
window.CAPVO_VERSION = '1.1.4.8';
window.CAPVO_CACHE_VERSION = 'capvo-app-shell-v1.1.4.8';

(function applyCapvoVersionLabel(){
  function apply(){
    var el = document.getElementById('capvoVersionLabel');
    if(el) el.textContent = 'Version ' + window.CAPVO_VERSION;
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, {once:true});
  else apply();
})();
