// CAPVO app split: 06d2-onboarding.js
// Onboarding: styles, rendering, navigation
// Source: 06d2-onboarding.js lines 864-1453

function capvoEnsureOnboardingProStyles(){
  if(document.getElementById('capvoOnboardingProStyles'))return;
  const style=document.createElement('style');
  style.id='capvoOnboardingProStyles';
  style.textContent=`
    #capvoOnboardingOverlay.capvo-onboarding-overlay{
      position:fixed !important; inset:0 !important; z-index:13000 !important;
      display:none !important; align-items:center !important; justify-content:center !important;
      padding:0 !important; background:#f7f8fe !important; overflow:hidden !important;
    }
    #capvoOnboardingOverlay.capvo-onboarding-overlay.active{display:flex !important;}
    #capvoOnboardingOverlay, #capvoOnboardingOverlay *{box-sizing:border-box !important;}
    #capvoOnboardingOverlay .ob-stepper-pro{
      width:min(100%,430px) !important; height:100dvh !important; max-height:100dvh !important;
      overflow:hidden !important; border:0 !important; border-radius:0 !important;
      background:radial-gradient(circle at 86% 2%,rgba(124,58,237,.09),transparent 34%),linear-gradient(180deg,#ffffff 0%,#fbfbff 100%) !important;
      box-shadow:none !important; padding:18px 17px calc(18px + env(safe-area-inset-bottom)) !important;
      display:grid !important; grid-template-rows:auto auto auto minmax(0,1fr) auto auto !important;
      gap:14px !important; font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif !important; color:#111827 !important;
    }
    #capvoOnboardingOverlay .ob-pro-header{display:grid !important;grid-template-columns:40px minmax(0,1fr) auto !important;align-items:center !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-back,#capvoOnboardingOverlay .ob-pro-skip{border:0 !important;cursor:pointer !important;font-family:inherit !important;}
    #capvoOnboardingOverlay .ob-pro-back{width:40px !important;height:40px !important;border-radius:999px !important;background:transparent !important;color:#7b8497 !important;font-size:28px !important;line-height:1 !important;display:grid !important;place-items:center !important;padding:0 !important;}
    #capvoOnboardingOverlay .ob-pro-back.is-hidden{visibility:hidden !important;}
    #capvoOnboardingOverlay .ob-pro-brand{display:flex !important;align-items:center !important;justify-content:flex-start !important;gap:10px !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-brand img{display:block !important;width:28px !important;height:28px !important;min-width:28px !important;border-radius:9px !important;object-fit:cover !important;box-shadow:0 8px 20px rgba(28,31,74,.18) !important;}
    #capvoOnboardingOverlay .ob-pro-brand-mark{display:none !important;
width:28px !important;height:28px !important;min-width:28px !important;border-radius:10px !important;display:grid !important;place-items:center !important;background:linear-gradient(135deg,#191f43,#6547f6) !important;color:#c9b8ff !important;font-size:13px !important;box-shadow:0 6px 18px rgba(15,23,42,.12) !important;}
    #capvoOnboardingOverlay .ob-pro-brand strong{display:block !important;margin:0 !important;color:#162033 !important;font-size:14px !important;line-height:1 !important;font-weight:950 !important;letter-spacing:.16em !important;}
    #capvoOnboardingOverlay .ob-pro-skip{justify-self:end !important;min-height:34px !important;padding:0 12px !important;border-radius:999px !important;background:#f4f5fb !important;color:#667085 !important;font-size:12px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-stepper{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:0 !important;align-items:start !important;padding:0 8px !important;margin:0 !important;list-style:none !important;}
    #capvoOnboardingOverlay .ob-pro-step{position:relative !important;display:grid !important;justify-items:center !important;gap:6px !important;color:#98a2b3 !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-step span{position:relative !important;z-index:2 !important;width:28px !important;height:28px !important;border-radius:999px !important;border:1px solid #e6e8f1 !important;display:grid !important;place-items:center !important;background:#fff !important;color:#7d8799 !important;font-size:12px !important;font-weight:950 !important;line-height:1 !important;}
    #capvoOnboardingOverlay .ob-pro-step i{position:absolute !important;top:13px !important;left:50% !important;width:100% !important;height:2px !important;background:#eceef6 !important;z-index:1 !important;}
    #capvoOnboardingOverlay .ob-pro-step.done i,#capvoOnboardingOverlay .ob-pro-step.active i{background:linear-gradient(90deg,#d9d1ff,#b9a6ff) !important;}
    #capvoOnboardingOverlay .ob-pro-step.done span,#capvoOnboardingOverlay .ob-pro-step.active span{background:linear-gradient(135deg,#6547f6,#7c3aed) !important;border-color:transparent !important;color:#fff !important;box-shadow:0 10px 22px rgba(101,71,246,.28) !important;}
    #capvoOnboardingOverlay .ob-pro-step small{display:block !important;max-width:72px !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;margin:0 !important;color:inherit !important;font-size:10.5px !important;font-weight:850 !important;letter-spacing:-.02em !important;line-height:1.1 !important;text-align:center !important;}
    #capvoOnboardingOverlay .ob-pro-step.active small{color:#6547f6 !important;}
    #capvoOnboardingOverlay .ob-pro-copy{display:grid !important;gap:6px !important;text-align:center !important;padding:0 10px !important;}
    #capvoOnboardingOverlay .ob-pro-copy h2{margin:0 !important;color:#101828 !important;font-size:clamp(21px,5.8vw,28px) !important;line-height:1.08 !important;letter-spacing:-.045em !important;font-weight:950 !important;}
    #capvoOnboardingOverlay .ob-pro-copy p{margin:0 auto !important;max-width:330px !important;color:#6b7280 !important;font-size:13.5px !important;line-height:1.42 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-body{min-height:0 !important;overflow:auto !important;padding:0 2px !important;display:grid !important;gap:12px !important;align-content:start !important;scrollbar-width:thin !important;}
    #capvoOnboardingOverlay .ob-pro-card{border:1px solid #e8eaf3 !important;border-radius:28px !important;background:linear-gradient(180deg,#ffffff,#fbfbff) !important;padding:18px !important;box-shadow:0 16px 34px rgba(15,23,42,.06) !important;display:grid !important;gap:14px !important;overflow:hidden !important;}
    #capvoOnboardingOverlay .ob-pro-card.hero{background:radial-gradient(circle at 92% 12%,rgba(101,71,246,.16),transparent 28%),linear-gradient(180deg,#ffffff,#fbfbff) !important;}
    #capvoOnboardingOverlay .ob-pro-card-head{display:grid !important;grid-template-columns:minmax(0,1fr) 74px !important;align-items:start !important;gap:14px !important;}
    #capvoOnboardingOverlay .ob-pro-card-head span{display:block !important;margin:0 0 7px !important;color:#6547f6 !important;font-size:12px !important;font-weight:950 !important;}
    #capvoOnboardingOverlay .ob-pro-card-head h3{margin:0 0 6px !important;color:#111827 !important;font-size:25px !important;line-height:1.08 !important;font-weight:950 !important;letter-spacing:-.04em !important;}
    #capvoOnboardingOverlay .ob-pro-card-head p{margin:0 !important;color:#6b7280 !important;font-size:13px !important;line-height:1.4 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-hero-icon{width:74px !important;height:74px !important;border-radius:26px !important;display:grid !important;place-items:center !important;background:linear-gradient(135deg,rgba(101,71,246,.12),rgba(124,58,237,.04)) !important;font-size:34px !important;box-shadow:0 16px 36px rgba(101,71,246,.14) !important;}
    #capvoOnboardingOverlay .ob-pro-benefits{display:grid !important;gap:9px !important;}
    #capvoOnboardingOverlay .ob-pro-benefits div{display:grid !important;grid-template-columns:32px 1fr !important;gap:10px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-benefits i{width:32px !important;height:32px !important;border-radius:12px !important;display:grid !important;place-items:center !important;background:#f3efff !important;font-style:normal !important;}
    #capvoOnboardingOverlay .ob-pro-benefits strong{color:#4b5563 !important;font-size:12.5px !important;line-height:1.35 !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-cycle-editor{border-top:1px solid #eef0f7 !important;padding-top:12px !important;display:grid !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-label,#capvoOnboardingOverlay .ob-pro-small-label{display:block !important;color:#6b7280 !important;font-size:12px !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-pill-grid.two,#capvoOnboardingOverlay .ob-pro-inline-two{display:grid !important;grid-template-columns:1fr 1fr !important;gap:10px !important;}
    #capvoOnboardingOverlay .ob-pro-pill{position:relative !important;border:1px solid #e7e8f0 !important;border-radius:18px !important;padding:14px !important;display:grid !important;gap:4px !important;background:#fff !important;cursor:pointer !important;user-select:none !important;}
    #capvoOnboardingOverlay .ob-pro-pill.selected{border-color:#8f78ff !important;background:#f8f5ff !important;box-shadow:0 10px 22px rgba(101,71,246,.08) !important;}
    #capvoOnboardingOverlay .ob-pro-pill input{position:absolute !important;opacity:0 !important;pointer-events:none !important;}
    #capvoOnboardingOverlay .ob-pro-pill strong{font-size:13px !important;color:#111827 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-pill small{font-size:11px !important;color:#6b7280 !important;font-weight:700 !important;}
    #capvoOnboardingOverlay .ob-pro-day-row{display:grid !important;grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:8px !important;}
    #capvoOnboardingOverlay .ob-pro-day-row button{min-height:42px !important;border-radius:14px !important;border:1px solid #e7e8f0 !important;background:#fff !important;color:#4b5563 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-day-row button.active{background:linear-gradient(135deg,#6547f6,#7c3aed) !important;color:#fff !important;border-color:transparent !important;}
    #capvoOnboardingOverlay .ob-pro-hidden-field{display:none !important;}
    #capvoOnboardingOverlay .ob-pro-inline-note,#capvoOnboardingOverlay .ob-pro-tip{border:1px solid #ece8ff !important;background:#f7f4ff !important;color:#6b7280 !important;border-radius:16px !important;padding:11px 13px !important;font-size:12px !important;line-height:1.4 !important;font-weight:800 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box{border:1px solid #ebeef5 !important;background:#fff !important;border-radius:24px !important;padding:16px !important;display:grid !important;place-items:center !important;gap:8px !important;text-align:center !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box .ob-pro-currency{font-size:26px !important;font-weight:900 !important;color:#111827 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box input{border:0 !important;outline:none !important;text-align:center !important;width:100% !important;color:#111827 !important;font-size:46px !important;line-height:1 !important;letter-spacing:-.06em !important;font-weight:950 !important;background:transparent !important;padding:0 !important;}
    #capvoOnboardingOverlay .ob-pro-budget-box small{color:#8c95a7 !important;font-size:13px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input{display:grid !important;gap:7px !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input span,#capvoOnboardingOverlay .ob-pro-inline-two small{font-size:11.5px !important;font-weight:850 !important;color:#6b7280 !important;}
    #capvoOnboardingOverlay input{font-family:inherit !important;}
    #capvoOnboardingOverlay .ob-pro-inline-input input,#capvoOnboardingOverlay .ob-pro-inline-two input,#capvoOnboardingOverlay .ob-pro-fixed-row input{width:100% !important;min-height:46px !important;border-radius:16px !important;border:1px solid #e7e8f0 !important;background:#fff !important;padding:0 13px !important;color:#111827 !important;font-size:14px !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-main{display:grid !important;gap:8px !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-category{width:100% !important;min-height:38px !important;border-radius:14px !important;border:1px solid #e7e8f0 !important;background:#f8fafc !important;padding:0 11px !important;color:#374151 !important;font-size:12px !important;font-weight:850 !important;outline:none !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-category:focus{border-color:#1d4ed8 !important;box-shadow:0 0 0 3px rgba(37,99,235,.10) !important;background:#fff !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel,#capvoOnboardingOverlay .ob-pro-optional-card{position:relative !important;border:1px solid #eceef6 !important;background:#f9faff !important;border-radius:18px !important;padding:14px !important;display:grid !important;gap:5px !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel strong,#capvoOnboardingOverlay .ob-pro-optional-card > span{font-size:13px !important;color:#111827 !important;font-weight:900 !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-panel small{font-size:12px !important;color:#6b7280 !important;font-weight:700 !important;padding-right:48px !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-on{position:absolute !important;right:14px !important;top:16px !important;width:38px !important;height:22px !important;border-radius:999px !important;background:linear-gradient(135deg,#6547f6,#7c3aed) !important;box-shadow:0 8px 18px rgba(101,71,246,.22) !important;}
    #capvoOnboardingOverlay .ob-pro-toggle-on::after{content:'' !important;position:absolute !important;right:3px !important;top:3px !important;width:16px !important;height:16px !important;border-radius:999px !important;background:#fff !important;}
    #capvoOnboardingOverlay .ob-pro-inline-two label{display:grid !important;gap:6px !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-stack{display:grid !important;gap:12px !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-row{display:grid !important;grid-template-columns:34px minmax(0,1fr) !important;gap:10px !important;align-items:start !important;padding:10px !important;border:1px solid rgba(226,232,240,.84) !important;border-radius:20px !important;background:rgba(255,255,255,.78) !important;box-shadow:0 10px 22px rgba(15,23,42,.035) !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-row i{width:34px !important;height:34px !important;border-radius:12px !important;display:grid !important;place-items:center !important;background:#f4f5fb !important;font-style:normal !important;margin-top:5px !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-main{display:grid !important;gap:9px !important;min-width:0 !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-meta{display:grid !important;grid-template-columns:minmax(0,1fr) minmax(88px,.72fr) !important;gap:8px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-fixed-amount{text-align:left !important;}
    #capvoOnboardingOverlay .ob-pro-add-fixed{border:1px dashed rgba(101,71,246,.35) !important;background:rgba(101,71,246,.06) !important;color:#6547f6 !important;min-height:46px !important;border-radius:16px !important;font-family:inherit !important;font-size:13px !important;font-weight:950 !important;}
    #capvoOnboardingOverlay .ob-pro-step-status{margin:-5px 0 0 !important;text-align:center !important;color:#6d4df7 !important;font-size:11.5px !important;font-weight:950 !important;letter-spacing:.01em !important;}
    #capvoOnboardingOverlay .ob-pro-telegram-orb{width:86px !important;height:86px !important;margin:2px auto 6px !important;border-radius:999px !important;display:grid !important;place-items:center !important;background:linear-gradient(180deg,#f7f3ff,#ffffff) !important;color:#6d4df7 !important;font-size:42px !important;box-shadow:0 18px 40px rgba(101,71,246,.14) !important;}
    #capvoOnboardingOverlay .ob-pro-actions{display:grid !important;gap:10px !important;align-items:center !important;}
    #capvoOnboardingOverlay .ob-pro-actions.single,#capvoOnboardingOverlay .ob-pro-actions.telegram{grid-template-columns:1fr !important;}
    #capvoOnboardingOverlay .ob-pro-actions.three{grid-template-columns:auto 1fr 1fr !important;}
    #capvoOnboardingOverlay .ob-pro-primary,#capvoOnboardingOverlay .ob-pro-secondary,#capvoOnboardingOverlay .ob-pro-link{min-height:50px !important;border-radius:18px !important;font-weight:950 !important;font-family:inherit !important;cursor:pointer !important;padding:0 14px !important;}
    #capvoOnboardingOverlay .ob-pro-primary{border:0 !important;background:linear-gradient(135deg,#6547f6,#7c3aed) !important;color:#fff !important;box-shadow:0 18px 34px rgba(101,71,246,.28) !important;display:flex !important;align-items:center !important;justify-content:center !important;gap:8px !important;}
    #capvoOnboardingOverlay .ob-pro-secondary{border:1px solid #e5e7ef !important;background:#fff !important;color:#667085 !important;}
    #capvoOnboardingOverlay .ob-pro-link{border:0 !important;background:transparent !important;color:#667085 !important;font-weight:850 !important;}
    #capvoOnboardingOverlay .ob-pro-link.wide{width:100% !important;}
    #capvoOnboardingOverlay .ob-pro-footnote{text-align:center !important;color:#98a2b3 !important;font-size:11px !important;line-height:1.35 !important;font-weight:750 !important;padding-bottom:2px !important;}
    @media (min-width:721px){
      #capvoOnboardingOverlay.capvo-onboarding-overlay{padding:22px !important;background:rgba(15,23,42,.55) !important;}
      #capvoOnboardingOverlay .ob-stepper-pro{height:min(840px,calc(100dvh - 44px)) !important;border-radius:34px !important;border:1px solid #e8eaf3 !important;box-shadow:0 24px 70px rgba(15,23,42,.22) !important;}
    }
    @media (max-width:520px){
      #capvoOnboardingOverlay .ob-pro-card.hero{gap:12px !important;}
      #capvoOnboardingOverlay .ob-pro-card-head{grid-template-columns:1fr !important;}
      #capvoOnboardingOverlay .ob-pro-hero-icon{display:none !important;}
    }
    @media (max-width:400px){
      #capvoOnboardingOverlay .ob-stepper-pro{padding:14px 14px calc(16px + env(safe-area-inset-bottom)) !important;gap:12px !important;}
      #capvoOnboardingOverlay .ob-pro-copy h2{font-size:26px !important;}
      #capvoOnboardingOverlay .ob-pro-pill-grid.two,#capvoOnboardingOverlay .ob-pro-inline-two{grid-template-columns:1fr !important;}
      #capvoOnboardingOverlay .ob-pro-step small{display:none !important;}
      #capvoOnboardingOverlay .ob-pro-fixed-row{grid-template-columns:34px 1fr !important;}
      #capvoOnboardingOverlay .ob-pro-fixed-meta{grid-template-columns:1fr 104px !important;}
      #capvoOnboardingOverlay .ob-pro-fixed-row input:last-of-type{grid-column:auto !important;}
      #capvoOnboardingOverlay .ob-pro-actions.three{grid-template-columns:1fr 1fr !important;}
      #capvoOnboardingOverlay .ob-pro-actions.three .ob-pro-link{grid-column:1/-1 !important;order:3 !important;}
    }
  `;
  document.head.appendChild(style);
}

function capvoEnsureOnboardingPremiumStyles(){
  if(document.getElementById('capvoOnboardingPremiumStyles'))return;
  const style=document.createElement('style');
  style.id='capvoOnboardingPremiumStyles';
  style.textContent=`
    #capvoOnboardingOverlay .ob-stepper-pro{
      background:
        radial-gradient(circle at 86% 4%,rgba(101,71,246,.075),transparent 32%),
        radial-gradient(circle at 12% 96%,rgba(79,70,229,.045),transparent 30%),
        linear-gradient(180deg,#ffffff 0%,#fbfbff 58%,#f8f8ff 100%) !important;
    }

    #capvoOnboardingOverlay .ob-pro-brand-mark{display:none !important;

      position:relative !important;
      width:28px !important;
      height:28px !important;
      min-width:28px !important;
      border-radius:9px !important;
      display:grid !important;
      place-items:center !important;
      overflow:hidden !important;
      background:
        radial-gradient(circle at 28% 22%,rgba(167,139,250,.95),transparent 22%),
        linear-gradient(135deg,#111827 0%,#24294f 58%,#6547f6 100%) !important;
      box-shadow:0 8px 20px rgba(28,31,74,.18) !important;
    }
    #capvoOnboardingOverlay .ob-pro-brand-mark::before{
      content:'' !important;
      width:13px !important;
      height:13px !important;
      border-radius:4px !important;
      border:2px solid rgba(255,255,255,.72) !important;
      transform:rotate(45deg) !important;
      box-shadow:inset 0 0 0 999px rgba(255,255,255,.06) !important;
    }
    #capvoOnboardingOverlay .ob-pro-brand-mark::after{
      content:'' !important;
      position:absolute !important;
      right:5px !important;
      bottom:5px !important;
      width:5px !important;
      height:5px !important;
      border-radius:999px !important;
      background:#7dd3fc !important;
      box-shadow:0 0 0 3px rgba(125,211,252,.12) !important;
    }

    #capvoOnboardingOverlay .ob-pro-copy h2{
      font-weight:920 !important;
      letter-spacing:-.05em !important;
      text-wrap:balance !important;
    }
    #capvoOnboardingOverlay .ob-pro-copy p{
      color:#6f7a8d !important;
      font-weight:680 !important;
    }

    #capvoOnboardingOverlay .ob-pro-card{
      background:
        linear-gradient(180deg,rgba(255,255,255,.96),rgba(252,252,255,.94)) !important;
      border-color:rgba(226,229,241,.92) !important;
      box-shadow:
        0 18px 40px rgba(17,24,39,.055),
        inset 0 1px 0 rgba(255,255,255,.88) !important;
    }
    #capvoOnboardingOverlay .ob-pro-card.hero{
      background:
        radial-gradient(circle at 90% 11%,rgba(101,71,246,.105),transparent 30%),
        linear-gradient(180deg,#ffffff,#fbfbff) !important;
    }

    #capvoOnboardingOverlay .ob-pro-hero-icon{
      position:relative !important;
      width:74px !important;
      height:74px !important;
      border-radius:25px !important;
      background:
        radial-gradient(circle at 30% 22%,rgba(255,255,255,.9),transparent 22%),
        linear-gradient(135deg,rgba(101,71,246,.15),rgba(79,70,229,.055)) !important;
      box-shadow:
        0 18px 42px rgba(101,71,246,.13),
        inset 0 1px 0 rgba(255,255,255,.95) !important;
      display:block !important;
      font-size:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-hero-icon.premium-cycle::before{
      content:'' !important;
      position:absolute !important;
      inset:18px 18px 24px 18px !important;
      border-radius:10px !important;
      border:2px solid rgba(101,71,246,.42) !important;
      background:
        linear-gradient(90deg,transparent 28%,rgba(101,71,246,.20) 29%,rgba(101,71,246,.20) 31%,transparent 32%),
        linear-gradient(180deg,rgba(101,71,246,.16),rgba(255,255,255,.25)) !important;
    }
    #capvoOnboardingOverlay .ob-pro-hero-icon.premium-cycle::after{
      content:'' !important;
      position:absolute !important;
      left:21px !important;
      right:19px !important;
      bottom:21px !important;
      height:15px !important;
      border-left:3px solid rgba(101,71,246,.75) !important;
      border-bottom:3px solid rgba(101,71,246,.75) !important;
      transform:skew(-18deg) !important;
      border-radius:2px !important;
      box-shadow:13px -7px 0 -2px rgba(101,71,246,.55),25px -14px 0 -3px rgba(101,71,246,.35) !important;
    }

    #capvoOnboardingOverlay .ob-pro-benefits i.premium-mini-icon,
    #capvoOnboardingOverlay .premium-mini-icon{
      position:relative !important;
      width:32px !important;
      height:32px !important;
      min-width:32px !important;
      border-radius:12px !important;
      display:grid !important;
      place-items:center !important;
      background:
        linear-gradient(180deg,rgba(247,244,255,.96),rgba(255,255,255,.96)) !important;
      border:1px solid rgba(228,222,255,.82) !important;
      font-size:0 !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9) !important;
    }
    #capvoOnboardingOverlay .premium-mini-icon::before,
    #capvoOnboardingOverlay .premium-mini-icon::after{
      content:'' !important;
      position:absolute !important;
      display:block !important;
    }
    #capvoOnboardingOverlay .premium-mini-icon.calendar::before{
      width:15px;height:14px;border:2px solid rgba(101,71,246,.68);border-radius:4px;top:8px;left:8px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.calendar::after{
      width:15px;height:2px;background:rgba(101,71,246,.58);top:12px;left:8px;border-radius:4px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chart::before{
      width:3px;height:12px;background:rgba(101,71,246,.70);bottom:8px;left:9px;border-radius:4px;
      box-shadow:6px -4px 0 rgba(101,71,246,.52),12px -8px 0 rgba(101,71,246,.36);
    }
    #capvoOnboardingOverlay .premium-mini-icon.target::before{
      width:16px;height:16px;border:2px solid rgba(101,71,246,.60);border-radius:999px;top:7px;left:7px;
      box-shadow:inset 0 0 0 4px rgba(101,71,246,.12);
    }
    #capvoOnboardingOverlay .premium-mini-icon.target::after{
      width:5px;height:5px;background:rgba(101,71,246,.76);border-radius:999px;top:13px;left:13px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chat::before{
      width:16px;height:12px;border:2px solid rgba(101,71,246,.62);border-radius:6px;top:8px;left:7px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.chat::after{
      width:6px;height:6px;border-left:2px solid rgba(101,71,246,.62);border-bottom:2px solid rgba(101,71,246,.62);transform:rotate(-22deg);top:17px;left:11px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.voice::before{
      width:8px;height:15px;border:2px solid rgba(101,71,246,.62);border-radius:999px;top:6px;left:11px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.voice::after{
      width:16px;height:10px;border-bottom:2px solid rgba(101,71,246,.62);border-radius:0 0 999px 999px;top:13px;left:7px;
    }
    #capvoOnboardingOverlay .premium-mini-icon.sync::before{
      width:16px;height:16px;border:2px solid rgba(101,71,246,.62);border-left-color:transparent;border-bottom-color:transparent;border-radius:999px;top:7px;left:7px;transform:rotate(35deg);
    }
    #capvoOnboardingOverlay .premium-mini-icon.sync::after{
      width:0;height:0;border-left:5px solid rgba(101,71,246,.62);border-top:4px solid transparent;border-bottom:4px solid transparent;top:7px;right:7px;transform:rotate(35deg);
    }

    #capvoOnboardingOverlay .ob-pro-pill{
      transition:border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease !important;
    }
    #capvoOnboardingOverlay .ob-pro-pill:active{
      transform:scale(.985) !important;
    }
    #capvoOnboardingOverlay .ob-pro-pill.selected{
      background:linear-gradient(180deg,#fbf9ff,#ffffff) !important;
      border-color:rgba(101,71,246,.48) !important;
      box-shadow:
        0 12px 26px rgba(101,71,246,.08),
        inset 0 1px 0 rgba(255,255,255,.9) !important;
    }

    #capvoOnboardingOverlay .ob-pro-budget-box{
      background:
        radial-gradient(circle at 50% 0%,rgba(101,71,246,.055),transparent 42%),
        #fff !important;
    }

    #capvoOnboardingOverlay .ob-pro-telegram-orb{
      position:relative !important;
      width:86px !important;
      height:86px !important;
      border-radius:999px !important;
      background:
        radial-gradient(circle at 36% 26%,rgba(255,255,255,.95),transparent 28%),
        linear-gradient(135deg,rgba(101,71,246,.14),rgba(79,70,229,.055)) !important;
      box-shadow:
        0 18px 42px rgba(101,71,246,.13),
        inset 0 1px 0 rgba(255,255,255,.95) !important;
      display:block !important;
      font-size:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-telegram-orb::before{
      content:'' !important;
      position:absolute !important;
      left:27px !important;
      top:30px !important;
      width:34px !important;
      height:24px !important;
      background:linear-gradient(135deg,#6547f6,#7c3aed) !important;
      clip-path:polygon(0 48%,100% 0,74% 100%,47% 66%,29% 83%) !important;
      filter:drop-shadow(0 8px 16px rgba(101,71,246,.22)) !important;
    }

    #capvoOnboardingOverlay .ob-pro-footnote{
      color:#a0a8b8 !important;
      letter-spacing:-.01em !important;
    }
    #capvoOnboardingOverlay .ob-pro-actions .ob-pro-primary{
      box-shadow:
        0 16px 30px rgba(101,71,246,.26),
        inset 0 1px 0 rgba(255,255,255,.22) !important;
    }

    #capvoOnboardingOverlay .ob-pro-day-input-wrap{
      display:grid !important;
      gap:8px !important;
      transition:opacity .16s ease, filter .16s ease !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input{
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto !important;
      align-items:center !important;
      gap:10px !important;
      min-height:54px !important;
      border:1px solid #e7e8f0 !important;
      border-radius:18px !important;
      background:#fff !important;
      padding:0 14px !important;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.9) !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input input{
      width:100% !important;
      height:52px !important;
      border:0 !important;
      outline:0 !important;
      background:transparent !important;
      color:#111827 !important;
      font-size:26px !important;
      line-height:1 !important;
      font-weight:950 !important;
      letter-spacing:-.04em !important;
      padding:0 !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input span{
      color:#8a94a6 !important;
      font-size:13px !important;
      font-weight:850 !important;
      white-space:nowrap !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled{
      opacity:.52 !important;
      filter:grayscale(.08) !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled .ob-pro-day-input{
      background:#f6f7fb !important;
      border-style:dashed !important;
      box-shadow:none !important;
    }
    #capvoOnboardingOverlay .ob-pro-day-input-wrap.is-disabled .ob-pro-day-input input{
      color:#98a2b3 !important;
      cursor:not-allowed !important;
    }

  `;
  document.head.appendChild(style);
}

function capvoEnsureWizardMobileScrollFixStyles(){
  if(document.getElementById('capvoWizardMobileScrollFixStyles'))return;
  const style=document.createElement('style');
  style.id='capvoWizardMobileScrollFixStyles';
  style.textContent=`
    #capvoOnboardingOverlay.capvo-onboarding-overlay{
      overflow:hidden !important;
    }

    #capvoOnboardingOverlay .ob-stepper-pro{
      overflow-y:auto !important;
      overflow-x:hidden !important;
      -webkit-overflow-scrolling:touch !important;
      overscroll-behavior:contain !important;
      grid-template-rows:auto auto auto auto auto auto !important;
      align-content:start !important;
      height:100dvh !important;
      max-height:100dvh !important;
      padding-bottom:calc(20px + env(safe-area-inset-bottom)) !important;
    }

    #capvoOnboardingOverlay .ob-pro-body{
      overflow:visible !important;
      min-height:auto !important;
      max-height:none !important;
      padding-right:0 !important;
    }

    #capvoOnboardingOverlay .ob-pro-actions{
      position:relative !important;
      margin-top:2px !important;
    }

    #capvoOnboardingOverlay .ob-pro-footnote{
      padding-bottom:4px !important;
    }

    #capvoOnboardingOverlay .ob-pro-card.hero{
      margin-bottom:2px !important;
    }

    @media (max-width:420px){
      #capvoOnboardingOverlay .ob-stepper-pro{
        padding-left:14px !important;
        padding-right:14px !important;
        gap:13px !important;
      }
      #capvoOnboardingOverlay .ob-pro-copy h2{
        font-size:26px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card{
        padding:16px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card-head h3{
        font-size:23px !important;
      }
      #capvoOnboardingOverlay .ob-pro-card-head p{
        font-size:12.5px !important;
      }
      #capvoOnboardingOverlay .ob-pro-benefits strong{
        font-size:12px !important;
      }
      #capvoOnboardingOverlay .ob-pro-cycle-editor{
        padding-top:10px !important;
        gap:9px !important;
      }
      #capvoOnboardingOverlay .ob-pro-day-input{
        min-height:52px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function renderCapvoOnboardingWizard(options={}){
  capvoEnsureOnboardingProStyles();
  capvoEnsureOnboardingPremiumStyles();
  capvoEnsureWizardMobileScrollFixStyles();
  const overlay=capvoEnsureOnboardingOverlay();
  const s=window.__capvoOnboarding||capvoWizardDefaultState();

  // Preserve the internal wizard scroll when the same step re-renders.
  // Mobile Safari/Chrome were jumping the onboarding back to the top when
  // a fixed-expense due-day input blurred and the step was re-rendered.
  // Step changes still start naturally from the top.
  const currentScroller=overlay.querySelector?.('.ob-stepper-pro');
  const currentStep=Number(window.__capvoLastOnboardingRenderStep);
  const nextStep=Number(s.step)||0;
  const shouldPreserveScroll=options.preserveScroll !== false &&
    overlay.classList.contains('active') &&
    Number.isFinite(currentStep) &&
    currentStep===nextStep;
  const preservedScrollTop=shouldPreserveScroll ? Number(currentScroller?.scrollTop||0) : 0;

  overlay.innerHTML=capvoOnboardingStepHtml(s);
  overlay.classList.add('active');
  window.__capvoLastOnboardingRenderStep=nextStep;

  if(shouldPreserveScroll && preservedScrollTop>0){
    requestAnimationFrame(()=>{
      const nextScroller=overlay.querySelector?.('.ob-stepper-pro');
      if(nextScroller)nextScroller.scrollTop=preservedScrollTop;
    });
  }

  if(window.__capvoWizardSmoothIntro){
    overlay.classList.add('capvo-wizard-smooth-intro');
    window.__capvoWizardSmoothIntro=false;
    setTimeout(()=>overlay.classList.remove('capvo-wizard-smooth-intro'),720);
  }

  document.body.classList.add('modal-open','onboarding-open');

  if(s && Number.isFinite(Number(s.step))){
    setTimeout(()=>capvoPersistOnboardingStep(s.step),0);
  }

  const fixed=document.getElementById('obCycleTypeFixed');
  const last=document.getElementById('obCycleTypeLast');
  const day=document.getElementById('obCycleDay');
  const dayWrap=day?.closest?.('.ob-pro-day-input-wrap');
  const note=dayWrap?.querySelector?.('.ob-pro-inline-note');
  const syncDay=()=>{
    const isLast=!!last?.checked;
    if(day)day.disabled=isLast;
    dayWrap?.classList.toggle('is-disabled',isLast);
    if(note){
      note.textContent=isLast
        ? 'Δεν χρειάζεται ημέρα. Το CAPVO θα βρίσκει αυτόματα την τελευταία εργάσιμη.'
        : 'Γράψε την ημέρα του μήνα από 1 έως 31, π.χ. 8 ή 28.';
    }
    const fixedCard=fixed?.closest?.('.ob-pro-pill, .ob-pill-choice');
    const lastCard=last?.closest?.('.ob-pro-pill, .ob-pill-choice');
    fixedCard?.classList.toggle('selected',!!fixed?.checked);
    lastCard?.classList.toggle('selected',!!last?.checked);
  };
  document.querySelectorAll('#capvoOnboardingOverlay [data-cycle-type]').forEach(card=>{
    card.addEventListener('click',()=>{
      const type=card.dataset.cycleType;
      if(type==='last_working_day' && last){
        last.checked=true;
      }else if(fixed){
        fixed.checked=true;
      }
      syncDay();
    });
  });
  day?.addEventListener('input',()=>handleBudgetCycleDayInput(day));
  day?.addEventListener('blur',()=>finalizeBudgetCycleDayInput(day,s.cycleDay||1));
  fixed?.addEventListener('change',syncDay);
  last?.addEventListener('change',syncDay);
  syncDay();
}

function capvoOnboardingPrev(){
  const s=capvoOnboardingUpdateFromInputs();
  s.step=Math.max(0,(s.step||0)-1);
  renderCapvoOnboardingWizard();
}

function capvoOnboardingNext(){
  const s=capvoOnboardingUpdateFromInputs();

  if(s.step===0 && s.cycleType==='fixed_day'){
    const dayInput=document.getElementById('obCycleDay');
    const parsedDay=finalizeBudgetCycleDayInput(dayInput,s.cycleDay||1);
    if(parsedDay===null){
      showMiniToast('Βάλε ημέρα πληρωμής από 1 έως 31.','error');
      dayInput?.focus?.();
      return;
    }
    s.cycleDay=parsedDay;
  }

  if(s.step===1){
    if(!capvoWizardValidateBudgetStep(s))return;
  }

  if(s.step===2){
    if(!capvoWizardValidateFixedStep(s))return;
  }

  s.step=Math.min(5,(s.step||0)+1);
  renderCapvoOnboardingWizard();
}


// ===== END 06d2-onboarding.js =====

// ===== END 06d2-onboarding.js =====
