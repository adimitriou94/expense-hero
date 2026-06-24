// CAPVO app split: 03c-income.js
// Savings goals: lists, sheets, transactions, archive/restore
// Source: 03c-income.js lines 781-1637



/* ============================================================
   CAPVO v1.8.5.18 — Restore Savings / Koumparas functions
   Scope: restore missing button handlers and page rendering only.
   ============================================================ */

function activeSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>!g.isArchived && (g.status||'active')!=='archived');
}

function archivedSavingsGoals(){
  return (D.savingsGoals||[]).filter(g=>g.isArchived || (g.status||'').toLowerCase()==='archived');
}

function savingsGoalKind(goal){
  const t=(goal?.goalType||goal?.goal_type||'target').toLowerCase();
  return t==='general'?'general':'target';
}

function savingsGoalStatus(goal){
  return (goal?.status||'active').toLowerCase();
}

function generalSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='general');
}
function getDefaultGeneralSavingsGoal(){
  const goals=generalSavingsGoals();
  if(!goals.length)return null;
  return goals.find(g=>g.isDefault) ||
    goals.find(g=>String(g.name||'').toLowerCase().includes('γενική')) ||
    goals[0];
}

function mapSavingsGoalRow(row){
  if(!row)return null;
  return {
    id:row.id,
    userId:row.user_id,
    name:row.name||'Γενική αποταμίευση',
    icon:row.icon||'💰',
    targetAmount:Number(row.target_amount)||0,
    currentAmount:Number(row.current_amount)||0,
    targetDate:row.target_date||'',
    goalType:row.goal_type||'general',
    isDefault:!!row.is_default,
    isArchived:!!row.is_archived,
    notes:row.notes||'',
    status:row.status||'active',
    completedAt:row.completed_at||'',
    createdAt:row.created_at||'',
    updatedAt:row.updated_at||''
  };
}

async function ensureDefaultGeneralSavingsGoal(){
  const ownerUserId=getFinanceUserId?.();
  if(!ownerUserId || typeof supabaseClient==='undefined')return getDefaultGeneralSavingsGoal();

  const existing=getDefaultGeneralSavingsGoal();
  if(existing){
    if(!existing.isDefault || savingsGoalKind(existing)!=='general' || existing.isArchived || savingsGoalStatus(existing)!=='active'){
      try{
        await supabaseClient.from('savings_goals').update({
          goal_type:'general',
          is_default:true,
          is_archived:false,
          status:'active',
          target_amount:0,
          target_date:null,
          updated_at:new Date().toISOString()
        }).eq('user_id',ownerUserId).eq('id',existing.id);
        existing.goalType='general';
        existing.isDefault=true;
        existing.isArchived=false;
        existing.status='active';
        existing.targetAmount=0;
        existing.targetDate='';
      }catch(e){
        console.warn('[CAPVO] default general savings normalize skipped',e?.message||e);
      }
    }
    return existing;
  }

  const payload={
    id:crypto.randomUUID(),
    user_id:ownerUserId,
    name:'Γενική αποταμίευση',
    icon:'💰',
    target_amount:0,
    current_amount:0,
    target_date:null,
    goal_type:'general',
    is_default:true,
    is_archived:false,
    notes:'Αυτόματος βασικός στόχος CAPVO',
    status:'active',
    updated_at:new Date().toISOString()
  };

  const {data,error}=await supabaseClient
    .from('savings_goals')
    .insert(payload)
    .select('*')
    .single();
  if(error)throw error;

  const mapped=mapSavingsGoalRow(data||payload);
  D.savingsGoals=[mapped,...(D.savingsGoals||[]).filter(g=>g.id!==mapped.id)];
  return mapped;
}


function targetSavingsGoals(){
  return activeSavingsGoals().filter(g=>savingsGoalKind(g)==='target');
}

function savingsGoalsTotal(){
  return activeSavingsGoals().reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
}

function savingsCycleStats(){
  const cycle=typeof getCurrentBudgetCycle==='function'?getCurrentBudgetCycle():null;
  const startKey=cycle?.startKey||'';
  const endKey=cycle?.endKey||'';
  let deposits=0;
  let withdrawals=0;

  (D.savingsTransactions||[]).forEach(t=>{
    const day=(t.createdAt||'').slice(0,10);
    if(day && ((startKey && day<startKey) || (endKey && day>endKey)))return;

    const type=String(t.type||'').toLowerCase();
    const source=String(t.source||'').toLowerCase();
    if(type==='transfer_in' || type==='transfer_out' || source.includes('transfer'))return;

    const amount=Number(t.amount)||0;
    if(type==='withdrawal' || amount<0)withdrawals+=Math.abs(amount);
    else if(type==='deposit' || amount>0)deposits+=Math.abs(amount);
  });

  return {deposits,withdrawals,net:deposits-withdrawals};
}

function ensureSavingsSheet(){
  let overlay=$('savingsSheetOverlay');
  if(overlay)return overlay;

  overlay=document.createElement('div');
  overlay.id='savingsSheetOverlay';
  overlay.className='savings-sheet-overlay';
  overlay.onclick=e=>{
    if(e.target===overlay)closeSavingsSheet();
  };
  document.body.appendChild(overlay);
  return overlay;
}

function closeSavingsSheet(){
  const overlay=$('savingsSheetOverlay');
  if(overlay)overlay.classList.remove('active');
  document.body.classList.remove('modal-open');
}

function renderSavingsSummaryCards(goals,total,stats){
  return `
    <article class="savings-summary-card savings-summary-hero-card bento-card primary">
      <span>Στην άκρη</span>
      <strong>${fmt(total)}</strong>
      <small>${goals.length} ενεργοί στόχοι</small>
    </article>
    <article class="savings-summary-card bento-card ${stats.net<0?'warning':''}">
      <span>Αυτόν τον κύκλο</span>
      <strong>${stats.net<0?'-':''}${fmt(Math.abs(stats.net))}</strong>
      <small>+${fmt(stats.deposits)} μέσα · -${fmt(stats.withdrawals)} έξω</small>
    </article>
  `;
}

function renderSavingsProgress(goal){
  const current=Number(goal.currentAmount)||0;
  const target=Number(goal.targetAmount)||0;
  return target>0?Math.min(100,Math.round(current/target*100)):0;
}

function renderGeneralSavingsSection(goals){
  const general=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||goals[0];

  if(!general){
    return `<section class="savings-production-section bento-card savings-general-empty savings-wallet-section">
      <div class="savings-section-head with-action">
        <div>
          <small>Αποταμίευση</small>
          <h3>Γενική αποταμίευση</h3>
          <p>Χρήματα που κρατάς εκτός budget χωρίς συγκεκριμένο στόχο.</p>
        </div>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'general')">Δημιουργία</button>
      </div>
    </section>`;
  }

  return `<section class="savings-production-section bento-card savings-wallet-section">
    <div class="savings-section-head">
      <div>
        <small>Αποταμίευση</small>
        <h3>Γενική αποταμίευση</h3>
        <p>Λεφτά που έχεις βγάλει από το διαθέσιμο budget.</p>
      </div>
    </div>
    <article class="savings-wallet-card">
      <div class="savings-wallet-icon">${esc(general.icon||'💰')}</div>
      <div class="savings-wallet-main">
        <strong>${esc(general.name||'Γενική αποταμίευση')}</strong>
        <small>${esc(general.notes||'Χωρίς συγκεκριμένο στόχο')}</small>
        <em>${fmt(general.currentAmount||0)}</em>
      </div>
      <button type="button" onclick="openSavingsDepositSheet('${esc(general.id)}','deposit')">+ Ποσό</button>
      <button type="button" onclick="openSavingsDepositSheet('${esc(general.id)}','withdrawal')">Αφαίρεση</button>
    </article>
  </section>`;
}

function renderSavingsGoalCompactCard(g){
  const current=Number(g.currentAmount)||0;
  const target=Number(g.targetAmount)||0;
  const completed=savingsGoalStatus(g)==='completed';
  const progress=renderSavingsProgress(g);
  const remaining=Math.max(0,target-current);
  const targetMeta=g.targetDate?`Στόχος: ${formatGreekFullDate(g.targetDate)}`:'Χωρίς ημερομηνία στόχου';

  return `<button type="button" class="savings-target-row ${completed?'is-completed':''}" onclick="openSavingsGoalDetailsSheet('${esc(g.id)}')">
    <span class="savings-goal-icon">${esc(g.icon||'🎯')}</span>
    <span class="savings-target-copy">
      <strong>${esc(g.name||'Στόχος')}</strong>
      <small>${completed?'Ολοκληρώθηκε':esc(targetMeta)}</small>
      <i><b style="width:${progress}%"></b></i>
      <em>${target>0?fmt(current)+' / '+fmt(target)+' · μένουν '+fmt(remaining):fmt(current)+' αποταμιευμένα'}</em>
    </span>
    <span class="savings-target-arrow">›</span>
  </button>`;
}

function renderTargetSavingsSection(goals){
  if(goals.length===0){
    return `<section class="savings-production-section bento-card savings-empty compact savings-targets-section">
      <div class="savings-empty-icon">🎯</div>
      <h3>Βάλε τον πρώτο σου στόχο</h3>
      <p>Φτιάξε στόχο για αγορά, ταξίδι ή κάτι συγκεκριμένο και παρακολούθησε την πρόοδό του.</p>
      <button type="button" class="section-add primary-add" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </section>`;
  }

  return `<section class="savings-production-section bento-card savings-targets-section">
    <div class="savings-section-head with-action">
      <div>
        <small>Στόχοι</small>
        <h3>Οι στόχοι μου</h3>
        <p>Ποσά που θέλεις να μαζέψεις, με ημερομηνία, σημειώσεις και κινήσεις.</p>
      </div>
      <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('', 'target')">+ Νέος στόχος</button>
    </div>
    <div class="savings-compact-list">
      ${goals.map(g=>renderSavingsGoalCompactCard(g)).join('')}
    </div>
  </section>`;
}

function renderArchivedSavingsSection(goals){
  if(!goals.length)return '';
  return `<section class="savings-production-section bento-card savings-archived-section">
    <details>
      <summary><span>Αρχειοθετημένα</span><em>${goals.length}</em></summary>
      <div class="savings-archived-list">
        ${goals.map(g=>`<article>
          <span>${esc(g.icon||'🏦')}</span>
          <strong>${esc(g.name||'Στόχος')}</strong>
          <small>${fmt(g.currentAmount||0)}</small>
          <button type="button" onclick="restoreSavingsGoal('${esc(g.id)}')">Επαναφορά</button>
        </article>`).join('')}
      </div>
    </details>
  </section>`;
}

function renderSavingsPage(){
  const summary=$('savingsSummaryGrid');
  const list=$('savingsGoalList');
  if(!summary||!list)return;

  const targets=targetSavingsGoals();
  const archived=archivedSavingsGoals().filter(g=>savingsGoalKind(g)==='target');
  const total=targets.reduce((s,g)=>s+(Number(g.currentAmount)||0),0);
  const stats=savingsCycleStats();

  summary.innerHTML=renderSavingsSummaryCards(targets,total,stats);
  list.innerHTML=`
    ${renderTargetSavingsSection(targets)}
    ${renderArchivedSavingsSection(archived)}
  `;
}

function openGeneralSavingsFlow(){
  const general=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||generalSavingsGoals()[0];
  if(general){
    openSavingsDepositSheet(general.id,'deposit');
    return;
  }
  openSavingsGoalSheet('', 'general');
}

function openSavingsGoalSheet(goalId='',kind='target'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId)||{};
  const goalKind=goal.id?savingsGoalKind(goal):kind;
  const isGeneral=goalKind==='general';
  const existingGeneral=(typeof getDefaultGeneralSavingsGoal==='function'?getDefaultGeneralSavingsGoal():null)||generalSavingsGoals()[0];

  if(isGeneral && !goal.id && existingGeneral){
    showMiniToast('Υπάρχει ήδη γενική αποταμίευση. Πρόσθεσε ποσό εκεί.','info');
    openSavingsDepositSheet(existingGeneral.id,'deposit');
    return;
  }

  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${isGeneral?'💰':'🎯'}</span>
        <div>
          <small>${isGeneral?'Αποταμίευση':'Στόχος'}</small>
          <h2>${goal.id?'Επεξεργασία':'Νέος '+(isGeneral?'στόχος':'στόχος')}</h2>
          <p>${isGeneral?'Μία γενική αποταμίευση, χωρίς ποσό στόχο.':'Δώσε ποσό στόχο και προαιρετικά ημερομηνία.'}</p>
        </div>
      </div>

      <input type="hidden" id="savingsGoalId" value="${esc(goal.id||'')}">
      <input type="hidden" id="savingsGoalKind" value="${esc(goalKind)}">

      <div class="savings-form-stack">
        <label class="full">Όνομα
          <input id="savingsGoalName" type="text" value="${esc(goal.name||'')}" placeholder="${isGeneral?'π.χ. Γενική αποταμίευση':'π.χ. Ταξίδι'}">
        </label>
        <div class="savings-inline-grid ${isGeneral?'is-general-only':''}">
          <label class="savings-icon-field">Εικονίδιο
            <input id="savingsGoalIcon" type="text" value="${esc(goal.icon||(isGeneral?'💰':'🎯'))}" maxlength="4" inputmode="text">
          </label>
          ${isGeneral?'':`<label>Ποσό στόχος
            <input id="savingsGoalTarget" type="number" min="0" step="0.01" inputmode="decimal" value="${Number(goal.targetAmount)||''}" placeholder="0,00">
          </label>`}
        </div>
        ${isGeneral?'':`<label class="full">Ημερομηνία στόχου
          <input id="savingsGoalDate" type="date" value="${esc(goal.targetDate||'')}">
        </label>`}
        <label class="full">Σημείωση
          <textarea id="savingsGoalNotes" rows="2" placeholder="προαιρετικά">${esc(goal.notes||'')}</textarea>
        </label>
      </div>

      <button type="button" class="savings-primary-btn" onclick="saveSavingsGoalFromSheet()">Αποθήκευση</button>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function saveSavingsGoalFromSheet(){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId){showMiniToast('Δεν βρέθηκε συνδεδεμένος χρήστης.','error');return;}

  const existingId=$('savingsGoalId')?.value||'';
  const existing=(D.savingsGoals||[]).find(g=>g.id===existingId)||{};
  const kind=$('savingsGoalKind')?.value||'target';
  const isGeneral=kind==='general';
  const existingDefaultGeneral=isGeneral && !existingId && typeof getDefaultGeneralSavingsGoal==='function' ? getDefaultGeneralSavingsGoal() : null;
  const id=existingId || existingDefaultGeneral?.id || crypto.randomUUID();
  const name=($('savingsGoalName')?.value||'').trim();

  if(!name){showMiniToast('Βάλε όνομα.','error');return;}

  const target=isGeneral?0:(Number($('savingsGoalTarget')?.value)||0);
  if(!isGeneral && target<=0){showMiniToast('Για στόχο χρειάζεται ποσό στόχος.','error');return;}

  const payload={
    id,
    user_id:ownerUserId,
    name,
    icon:($('savingsGoalIcon')?.value||(isGeneral?'💰':'🎯')).trim()||(isGeneral?'💰':'🎯'),
    target_amount:target,
    current_amount:Number((existingDefaultGeneral||existing).currentAmount)||0,
    target_date:isGeneral?null:($('savingsGoalDate')?.value||null),
    notes:($('savingsGoalNotes')?.value||'').trim(),
    goal_type:isGeneral?'general':'target',
    is_default:isGeneral,
    is_archived:false,
    status:existing.status||'active',
    updated_at:new Date().toISOString()
  };

  const opTitle=existingId?'Ενημερώνεται στόχος...':'Αποθηκεύεται στόχος...';
  const opDetail=existingId?'Ενημερώνω τα στοιχεία του στόχου.':'Δημιουργώ τον στόχο και ετοιμάζω το ιστορικό του.';
  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(opTitle,opDetail))return;

  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn){btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    const {error}=await supabaseClient.from('savings_goals').upsert(payload,{onConflict:'id'});
    if(error)throw error;
    await fetchAllData(ownerUserId);
    render();
    closeSavingsSheet();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε', existingId?'Ο στόχος ενημερώθηκε.':'Ο στόχος αποθηκεύτηκε.');
    showMiniToast(existingId?'✅ Ο στόχος ενημερώθηκε':'✅ Ο στόχος αποθηκεύτηκε');
  }catch(error){
    console.error('saveSavingsGoal failed',error);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν αποθηκεύτηκε ο στόχος.');
    showMiniToast('Δεν αποθηκεύτηκε ο στόχος.','error');
    if(btn){btn.disabled=false;btn.textContent='Αποθήκευση';}
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

function renderSavingsGoalTransactionHistory(goalId,expanded=false){
  const allRows=(D.savingsTransactions||[])
    .filter(t=>String(t.goalId||t.goal_id)===String(goalId))
    .sort((a,b)=>String(b.createdAt||b.created_at||'').localeCompare(String(a.createdAt||a.created_at||'')));
  if(!allRows.length){
    return `<section class="savings-goal-history"><div class="savings-goal-history-head"><span>Κινήσεις στόχου</span><small>Δεν υπάρχουν κινήσεις ακόμα.</small></div></section>`;
  }
  const rows=expanded?allRows:allRows.slice(0,4);
  const depositCount=allRows.filter(t=>String(t.type||'deposit').toLowerCase()!=='withdrawal' && Number(t.amount)>=0).length;
  const withdrawalCount=allRows.length-depositCount;
  const moreCount=Math.max(0,allRows.length-rows.length);
  return `<section class="savings-goal-history">
    <div class="savings-goal-history-head">
      <span>Κινήσεις στόχου</span>
      <small>${allRows.length} συνολικά</small>
    </div>
    <div class="savings-goal-history-summary">
      <span>+ ${depositCount} προσθήκες</span>
      ${withdrawalCount?`<span>- ${withdrawalCount} αφαιρέσεις</span>`:''}
    </div>
    <div class="savings-goal-history-list ${expanded?'is-expanded':''}">
      ${rows.map(t=>{
        const amount=Number(t.amount)||0;
        const type=String(t.type||'deposit').toLowerCase();
        const isOut=type==='withdrawal' || amount<0;
        const date=(t.createdAt||t.created_at||'').slice(0,10);
        const note=String(t.note||'').trim();
        return `<article class="savings-goal-history-row ${isOut?'is-out':'is-in'}">
          <div class="savings-goal-history-icon">${isOut?'−':'+'}</div>
          <div class="savings-goal-history-main"><strong>${isOut?'Αφαίρεση':'Προσθήκη'}</strong><small>${date?formatGreekFullDate(date):'Χωρίς ημερομηνία'}${note?' · '+esc(note):''}</small></div>
          <em>${isOut?'-':'+'}${fmt(Math.abs(amount))}</em>
        </article>`;
      }).join('')}
    </div>
    ${allRows.length>4?`<button type="button" class="savings-goal-history-toggle" onclick="openSavingsGoalDetailsSheet('${esc(String(goalId))}',${expanded?'false':'true'})">${expanded?'Εμφάνιση λιγότερων':'Προβολή όλων '+allRows.length}</button>`:''}
  </section>`;
}

function openSavingsGoalDetailsSheet(goalId,showAllTransactions=false){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;

  const current=Number(goal.currentAmount)||0;
  const target=Number(goal.targetAmount)||0;
  const completed=savingsGoalStatus(goal)==='completed';
  const progress=renderSavingsProgress(goal);

  const overlay=ensureSavingsSheet();
  overlay.innerHTML=`
    <section class="savings-sheet savings-details-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'🎯')}</span>
        <div>
          <small>${completed?'Ολοκληρωμένος στόχος':'Στόχος αποταμίευσης'}</small>
          <h2>${esc(goal.name||'Στόχος')}</h2>
          <p>${goal.targetDate?'Στόχος: '+formatGreekFullDate(goal.targetDate):'Χωρίς ημερομηνία στόχου'}</p>
        </div>
      </div>

      <div class="savings-details-amount">
        <strong>${fmt(current)}</strong>${target>0?'<span>/ '+fmt(target)+'</span>':''}
      </div>
      ${target>0?`<div class="savings-progress-track"><i style="width:${progress}%"></i></div>`:''}
      ${goal.notes?`<div class="savings-goal-note"><span>Σημείωση</span><p>${esc(goal.notes)}</p></div>`:''}
      ${renderSavingsGoalTransactionHistory(goal.id,showAllTransactions)}

      <div class="savings-sheet-actions">
        <button type="button" class="savings-primary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','deposit')">+ Προσθήκη ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsDepositSheet('${esc(goal.id)}','withdrawal')">Αφαίρεση ποσού</button>
        <button type="button" class="savings-secondary-btn" onclick="openSavingsGoalSheet('${esc(goal.id)}','${savingsGoalKind(goal)}')">Επεξεργασία</button>
        <button type="button" class="savings-archive-action" onclick="archiveSavingsGoal('${esc(goal.id)}')">Αρχειοθέτηση</button>
      </div>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

function savingsCurrentBudgetBalance(){
  const income=Number(D?.income)||0;
  const fixed=typeof fixedTotal==='function'?fixedTotal():0;
  const cardPayments=typeof ccPayTotal==='function'?ccPayTotal():0;
  const budgetMovements=typeof dailyCashTotal==='function'?dailyCashTotal():0;
  return capvoMoney(income-fixed-cardPayments-budgetMovements);
}

function savingsTxMapRow(row){
  if(!row)return null;
  return {
    id:row.id,
    userId:row.user_id,
    goalId:row.goal_id,
    amount:Number(row.amount)||0,
    type:row.type||'deposit',
    source:row.source||'manual',
    note:row.note||'',
    relatedCycleKey:row.related_cycle_key||'',
    createdAt:row.created_at||new Date().toISOString()
  };
}

function savingsApplyGoalLocal(goalId,patch){
  const goal=(D.savingsGoals||[]).find(g=>String(g.id)===String(goalId));
  if(!goal)return null;
  if(Object.prototype.hasOwnProperty.call(patch,'currentAmount'))goal.currentAmount=capvoMoney(Number(patch.currentAmount)||0);
  if(Object.prototype.hasOwnProperty.call(patch,'status'))goal.status=patch.status||'active';
  if(Object.prototype.hasOwnProperty.call(patch,'completedAt'))goal.completedAt=patch.completedAt||'';
  goal.updatedAt=new Date().toISOString();
  return goal;
}

function savingsGoalCompletionPatch(goal,nextAmount){
  const target=Number(goal?.targetAmount)||0;
  if(savingsGoalKind(goal)==='target' && target>0 && nextAmount>=target){
    return {status:'completed',completedAt:new Date().toISOString()};
  }
  return {status:'active',completedAt:''};
}

function savingsBuildGoalUpdate(goal,nextAmount){
  const completion=savingsGoalCompletionPatch(goal,nextAmount);
  return {
    current_amount:capvoMoney(nextAmount),
    status:completion.status,
    completed_at:completion.completedAt||null,
    updated_at:new Date().toISOString()
  };
}

function savingsSourceChoiceMarkup(goal,mode){
  return `
    <div class="savings-transfer-choice savings-goal-virtual-note">
      <p>Απλή κίνηση στόχου</p>
      <small>Δεν συνδέεται με λογαριασμό και δεν αλλάζει υπόλοιπα wallet. Κρατά μόνο ιστορικό για τον στόχο.</small>
    </div>
    <input type="hidden" id="savingsTxSource" value="goal_manual">
    <input type="hidden" id="savingsTxDestination" value="goal_manual">`;
}


function openSavingsDepositSheet(goalId,mode='deposit'){
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!goal)return;

  const isWithdrawal=mode==='withdrawal';
  const overlay=ensureSavingsSheet();
  const sourceMarkup=savingsSourceChoiceMarkup(goal,mode);

  overlay.innerHTML=`
    <section class="savings-sheet" onclick="event.stopPropagation()">
      <div class="cycle-carryover-handle" aria-hidden="true"></div>
      <button type="button" class="cycle-carryover-close" onclick="closeSavingsSheet()" aria-label="Κλείσιμο">×</button>
      <div class="savings-sheet-hero">
        <span>${esc(goal.icon||'💰')}</span>
        <div>
          <small>${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</small>
          <h2>${esc(goal.name||'Στόχος')}</h2>
          <p>Τρέχον ποσό: <strong>${fmt(goal.currentAmount||0)}</strong></p>
        </div>
      </div>

      <input type="hidden" id="savingsTxGoalId" value="${esc(goal.id)}">
      <input type="hidden" id="savingsTxMode" value="${isWithdrawal?'withdrawal':'deposit'}">

      <div class="savings-form-stack compact">
        ${sourceMarkup}
        <label class="full">Ποσό
          <input id="savingsTxAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00">
        </label>
        <label class="full">Σημείωση
          <input id="savingsTxNote" type="text" placeholder="προαιρετικά">
        </label>
      </div>

      <button type="button" class="savings-primary-btn" onclick="saveSavingsTransactionFromSheet()">${isWithdrawal?'Αφαίρεση ποσού':'Προσθήκη ποσού'}</button>
    </section>`;

  overlay.classList.add('active');
  document.body.classList.add('modal-open');
}

async function addSavingsTransaction(goalId,amount,type='deposit',source='manual',note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)throw new Error('Missing savings goal');

  const safeAmount=capvoMoney(Number(amount)||0);
  if(safeAmount<=0)throw new Error('Invalid savings amount');

  const current=capvoMoney(Number(goal.currentAmount)||0);
  if(type==='withdrawal' && safeAmount>current){
    const err=new Error('Withdrawal exceeds current amount');
    err.code='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE';
    throw err;
  }

  if(type==='deposit' && String(source||'')==='budget'){
    const available=savingsCurrentBudgetBalance();
    if(safeAmount>available+0.004){
      const err=new Error('Deposit exceeds available budget');
      err.code='CAPVO_SAVINGS_BUDGET_EXCEEDS_AVAILABLE';
      throw err;
    }
  }

  const signed=type==='withdrawal'?-safeAmount:safeAmount;
  const nextAmount=Math.max(0,capvoMoney(current+signed));

  const txPayload={
    user_id:ownerUserId,
    goal_id:goalId,
    amount:signed,
    type,
    source,
    note,
    related_cycle_key:relatedCycleKey||null
  };

  const {data:inserted,error:txError}=await supabaseClient
    .from('savings_transactions')
    .insert(txPayload)
    .select('*');
  if(txError)throw txError;

  const goalUpdate=savingsBuildGoalUpdate(goal,nextAmount);
  const {error:gError}=await supabaseClient
    .from('savings_goals')
    .update(goalUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',goalId);

  if(gError)throw gError;

  const completion=savingsGoalCompletionPatch(goal,nextAmount);
  savingsApplyGoalLocal(goalId,{currentAmount:nextAmount,status:completion.status,completedAt:completion.completedAt});

  const txRows=(inserted||[txPayload]).map(savingsTxMapRow).filter(Boolean);
  D.savingsTransactions=[...txRows,...(D.savingsTransactions||[])];
  return {transactions:txRows,goal:savingsGoalById?.(goalId)||goal};
}

async function addSavingsTransfer(fromGoalId,toGoalId,amount,note='',relatedCycleKey=''){
  const ownerUserId=getFinanceUserId();
  const fromGoal=(D.savingsGoals||[]).find(g=>String(g.id)===String(fromGoalId));
  const toGoal=(D.savingsGoals||[]).find(g=>String(g.id)===String(toGoalId));
  if(!ownerUserId||!fromGoal||!toGoal)throw new Error('Missing savings transfer goal');

  const safeAmount=capvoMoney(Number(amount)||0);
  if(safeAmount<=0)throw new Error('Invalid savings amount');

  const fromCurrent=capvoMoney(Number(fromGoal.currentAmount)||0);
  const toCurrent=capvoMoney(Number(toGoal.currentAmount)||0);
  if(safeAmount>fromCurrent){
    const err=new Error('Transfer exceeds source amount');
    err.code='CAPVO_SAVINGS_TRANSFER_EXCEEDS_BALANCE';
    throw err;
  }

  const txPayloads=[
    {
      user_id:ownerUserId,
      goal_id:fromGoalId,
      amount:-safeAmount,
      type:'transfer_out',
      source:'transfer',
      note:note||`Μεταφορά προς ${toGoal.name||'στόχο'}`,
      related_cycle_key:relatedCycleKey||null
    },
    {
      user_id:ownerUserId,
      goal_id:toGoalId,
      amount:safeAmount,
      type:'transfer_in',
      source:'transfer',
      note:note||`Μεταφορά από ${fromGoal.name||'στόχο'}`,
      related_cycle_key:relatedCycleKey||null
    }
  ];

  const {data:inserted,error:txError}=await supabaseClient
    .from('savings_transactions')
    .insert(txPayloads)
    .select('*');
  if(txError)throw txError;

  const fromNext=Math.max(0,capvoMoney(fromCurrent-safeAmount));
  const toNext=capvoMoney(toCurrent+safeAmount);
  const toUpdate=savingsBuildGoalUpdate(toGoal,toNext);
  const fromUpdate=savingsBuildGoalUpdate(fromGoal,fromNext);

  const {error:fromError}=await supabaseClient
    .from('savings_goals')
    .update(fromUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',fromGoalId);
  if(fromError)throw fromError;

  const {error:toError}=await supabaseClient
    .from('savings_goals')
    .update(toUpdate)
    .eq('user_id',ownerUserId)
    .eq('id',toGoalId);
  if(toError)throw toError;

  const fromCompletion=savingsGoalCompletionPatch(fromGoal,fromNext);
  const toCompletion=savingsGoalCompletionPatch(toGoal,toNext);
  savingsApplyGoalLocal(fromGoalId,{currentAmount:fromNext,status:fromCompletion.status,completedAt:fromCompletion.completedAt});
  savingsApplyGoalLocal(toGoalId,{currentAmount:toNext,status:toCompletion.status,completedAt:toCompletion.completedAt});

  const txRows=(inserted||txPayloads).map(savingsTxMapRow).filter(Boolean);
  D.savingsTransactions=[...txRows,...(D.savingsTransactions||[])];
  return {transactions:txRows,fromGoal:savingsGoalById?.(fromGoalId)||fromGoal,toGoal:savingsGoalById?.(toGoalId)||toGoal};
}

function savingsErrorMessage(error){
  const code=error?.code||'';
  if(code==='CAPVO_WITHDRAWAL_EXCEEDS_BALANCE')return 'Δεν μπορείς να αφαιρέσεις περισσότερα από όσα έχει ο στόχος.';
  if(code==='CAPVO_SAVINGS_TRANSFER_EXCEEDS_BALANCE')return 'Δεν υπάρχουν αρκετά χρήματα στην επιλεγμένη πηγή.';
  if(code==='CAPVO_SAVINGS_BUDGET_EXCEEDS_AVAILABLE')return 'Το ποσό είναι μεγαλύτερο από το διαθέσιμο budget σου.';
  return 'Δεν αποθηκεύτηκε η κίνηση.';
}

async function saveSavingsTransactionFromSheet(){
  const goalId=$('savingsTxGoalId')?.value;
  const mode=$('savingsTxMode')?.value||'deposit';
  const amount=Number($('savingsTxAmount')?.value)||0;
  const note=($('savingsTxNote')?.value||'').trim();
  const goal=(D.savingsGoals||[]).find(g=>String(g.id)===String(goalId));

  if(amount<=0){showMiniToast('Βάλε ποσό.','error');return;}
  if(!goal){showMiniToast('Δεν βρέθηκε ο στόχος.','error');return;}

  const btn=document.querySelector('#savingsSheetOverlay .savings-primary-btn');
  if(btn?.dataset.saving==='true')return;

  const isWithdrawal=mode==='withdrawal';
  const opTitle=isWithdrawal?'Αφαιρείται ποσό στόχου...':'Προστίθεται ποσό στόχου...';
  const opDetail=isWithdrawal?`Αφαιρώ ${fmt(amount)} από τον στόχο.`:`Προσθέτω ${fmt(amount)} στον στόχο.`;
  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation(opTitle,opDetail))return;

  if(btn){btn.dataset.saving='true';btn.disabled=true;btn.textContent='Αποθήκευση...';}

  try{
    const cycleKey=currentCycleKey?.()||'';

    if(mode==='deposit'){
      await addSavingsTransaction(goalId,amount,'deposit','goal_manual',note,cycleKey);
    }else{
      await addSavingsTransaction(goalId,amount,'withdrawal','goal_manual_return',note,cycleKey);
    }

    render();
    closeSavingsSheet();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε', isWithdrawal?'Το ποσό αφαιρέθηκε από τον στόχο.':'Το ποσό προστέθηκε στον στόχο.');
    showMiniToast(mode==='withdrawal'?'✅ Το ποσό αφαιρέθηκε':'✅ Το ποσό προστέθηκε');
  }catch(error){
    console.error('saveSavingsTransaction failed',error);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε',savingsErrorMessage(error));
    showMiniToast(savingsErrorMessage(error),'error');
    if(btn){btn.dataset.saving='false';btn.disabled=false;btn.textContent=mode==='withdrawal'?'Αφαίρεση ποσού':'Προσθήκη ποσού';}
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

async function archiveSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  const goal=(D.savingsGoals||[]).find(g=>g.id===goalId);
  if(!ownerUserId||!goal)return;

  const amount=Number(goal.currentAmount)||0;
  const message=amount>0
    ? `Ο στόχος έχει ${fmt(amount)}. Θα κρυφτεί από τους ενεργούς, αλλά οι κινήσεις και το ποσό του θα μείνουν στο ιστορικό.`
    : 'Θέλεις να αρχειοθετήσεις αυτόν τον στόχο;';

  const confirmFn=typeof showConfirmModal==='function'
    ?()=>showConfirmModal({title:'Αρχειοθέτηση στόχου',message,confirmText:'Αρχειοθέτηση'})
    :()=>Promise.resolve(window.confirm('Αρχειοθέτηση στόχου;'));

  const ok=await confirmFn();
  if(!ok)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Αρχειοθετείται στόχος...', 'Κρατάω το ιστορικό και κρύβω τον στόχο από τους ενεργούς.'))return;

  try{
    const {error}=await supabaseClient.from('savings_goals')
      .update({is_archived:true,status:'archived',updated_at:new Date().toISOString()})
      .eq('user_id',ownerUserId)
      .eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId);
    render();
    closeSavingsSheet();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Ο στόχος αρχειοθετήθηκε.');
    showMiniToast('Ο στόχος αρχειοθετήθηκε.');
  }catch(error){
    console.error('archiveSavingsGoal failed',error);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν έγινε αρχειοθέτηση.');
    showMiniToast('Δεν έγινε αρχειοθέτηση.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}

async function restoreSavingsGoal(goalId){
  const ownerUserId=getFinanceUserId();
  if(!ownerUserId)return;

  if(typeof capvoBeginAppOperation==='function' && !capvoBeginAppOperation('Επαναφέρεται στόχος...', 'Ενεργοποιώ ξανά τον στόχο και κρατάω το ίδιο ιστορικό.'))return;

  try{
    const {error}=await supabaseClient.from('savings_goals')
      .update({is_archived:false,status:'active',updated_at:new Date().toISOString()})
      .eq('user_id',ownerUserId)
      .eq('id',goalId);
    if(error)throw error;
    await fetchAllData(ownerUserId);
    render();
    capvoAppOperationSuccess?.('Ολοκληρώθηκε','Ο στόχος επανήλθε στους ενεργούς.');
    showMiniToast('Ο στόχος επανήλθε στους ενεργούς.');
  }catch(error){
    console.error('restoreSavingsGoal failed',error);
    capvoAppOperationError?.('Δεν ολοκληρώθηκε','Δεν έγινε επαναφορά.');
    showMiniToast('Δεν έγινε επαναφορά.','error');
  }finally{
    if(typeof capvoEndAppOperation==='function')capvoEndAppOperation(520);
  }
}
// ===== END 03c-income.js =====

// ===== END 03c-income.js =====
