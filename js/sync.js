// ===== TELEGRAM SYNC MODULE =====

const SYNC_KEY_PREFIX='expense_sync_last_id';

const CAT_KEYWORDS={
  'Τρόφιμα':['σούπερ μάρκετ','super market','supermarket','market','μαρκετ','σουπερ','σούπερ','τρόφιμα','τροφίμα','ψώνια','ψωνια','μανάβης','μαναβης','κρεοπωλείο','κρεοπωλειο','ψάρια','ψαρια','φρούτα','φρουτα','λαχανικά','λαχανικα','σκλαβενίτης','σκλαβενιτης','σκληβενιτης','lidl','λιτλ','ab','βασιλόπουλος','βασιλοπουλος','my market','mymarket'],
  'Καφέδες':['καφές','καφε','καφέ','coffee','espresso','freddo','φρεντο','frappé','frappe','φραπε','καφετέρια','καφετερια','cappuccino','καπουτσινο'],
  'Μεταφορά':['βενζίνη','βενζινη','καύσιμα','καυσιμα','πετρέλαιο','πετρελαιο','parking','παρκινγκ','μετρό','μετρο','metro','λεωφορείο','λεωφορειο','ταξί','ταξι','taxi','uber','εισιτήριο','εισιτηριο'],
  'Ψυχαγωγία':['σινεμά','cinema','θέατρο','συναυλία','netflix','spotify','παιχνίδι','game'],
  'Φαγητό έξω':['φαγητο','φαγητό','φαγητα','φαγητά','εστιατόριο','εστιατοριο','ταβέρνα','ταβερνα','πίτσα','πιτσα','pizza','σουβλάκι','σουβλακι','γυρος','γύρος','delivery','ντελιβερι','wolt','efood','box','φαγητό έξω','φαγητο εξω','γεύμα','γευμα','δείπνο','δειπνο','burger','μπεργκερ'],
  'Στέγαση':['ενοίκιο','ενοικιο','ρεύμα','νερό','κοινόχρηστα','internet'],
  'Λογαριασμοί':['λογαριασμός','λογαριασμος','deh','δεη','ευδαπ','cosmote','vodafone','wind'],
  'Υγεία':['φαρμακείο','φάρμακο','γιατρός','γιατρος','νοσοκομείο','ιατρός','εξέταση','ασφάλεια'],
  'Ρούχα':['ρούχα','παπούτσια','zara','h&m','ένδυση'],
  'Συνδρομές':['συνδρομή','συνδρομη','subscription','youtube','prime','disney'],
  'Δάνεια':['δόση','δοση','δάνειο','δανειο','τράπεζα'],
  'Άλλο':[]
};

const ALL_CATS=['Τρόφιμα','Καφέδες','Μεταφορά','Ψυχαγωγία','Φαγητό έξω','Στέγαση','Λογαριασμοί','Υγεία','Ρούχα','Συνδρομές','Δάνεια','Άλλο'];

function syncDbCategoryCandidates(normalizedText){
  if(typeof capvoCategories!=='function')return [];
  const cats=capvoCategories();
  if(!Array.isArray(cats)||!cats.length)return [];

  const candidates=[];
  const ordered=cats.slice().sort((a,b)=>{
    const ad=a.parentId?0:1;
    const bd=b.parentId?0:1;
    return ad-bd || (Number(a.sortOrder)||0)-(Number(b.sortOrder)||0) || String(a.name||'').localeCompare(String(b.name||''),'el');
  });

  for(const cat of ordered){
    const terms=[cat.name,...(Array.isArray(cat.keywords)?cat.keywords:[])].filter(Boolean)
      .map(term=>({raw:String(term),key:syncNormalizeText(term)}))
      .filter(t=>t.key && t.key.length>1)
      .sort((a,b)=>b.key.length-a.key.length);

    for(const term of terms){
      if(!syncTextHasAlias(normalizedText,term.key))continue;
      const parent=cat.parentId && typeof capvoCategoryById==='function' ? capvoCategoryById(cat.parentId) : null;
      candidates.push({
        cat,
        parent,
        rawTerm:term.raw,
        termKey:term.key,
        isSubcategory:!!cat.parentId,
        termLength:term.key.length,
        sortOrder:Number(cat.sortOrder)||0
      });
    }
  }

  return candidates;
}

function syncMatchCategoryFromDb(normalizedText){
  const matches=syncDbCategoryCandidates(normalizedText);
  if(!matches.length)return null;

  matches.sort((a,b)=>{
    // Prefer specific subcategories, then longer/more precise terms.
    if(a.isSubcategory!==b.isSubcategory)return a.isSubcategory?-1:1;
    if(a.termLength!==b.termLength)return b.termLength-a.termLength;
    return a.sortOrder-b.sortOrder;
  });

  const best=matches[0];
  if(best.isSubcategory && best.parent){
    return {
      category:best.parent.name,
      categoryId:best.parent.id,
      subcategoryId:best.cat.id,
      subcategoryName:best.cat.name,
      matchedTerm:best.rawTerm,
      matchedTermKey:best.termKey
    };
  }

  return {
    category:best.cat.name,
    categoryId:best.cat.id,
    subcategoryId:null,
    subcategoryName:'',
    matchedTerm:best.rawTerm,
    matchedTermKey:best.termKey
  };
}

function syncGenericMerchantTermSet(){
  return new Set([
    'supermarket','super market','market','mini market','μαρκετ','σουπερ','σουπερ μαρκετ','σουπερμαρκετ',
    'καφεσ','καφε','coffee','espresso','freddo','φρεντο','cappuccino','καπουτσινο',
    'φαγητο','φαγητο εξω','delivery','ντελιβερι','pizza','πιτσα','burger','μπεργκερ','σουβλακι','γυροσ','γευμα','δειπνο',
    'βενζινη','καυσιμα','fuel','taxi','ταξι','parking','παρκινγκ','εισιτηριο','εισιτηρια','match ticket',
    'στοιχημα','bet','betting','online betting','casino','καζινο','τζογοσ','τυχερα παιχνιδια',
    'φαρμακειο','γιατροσ','εξετασεισ','ρουχα','παπουτσια','συνδρομη','subscription',
    'λογαριασμοσ','ρευμα','νερο','internet','κινητο','ενοικιο','κοινοχρηστα','αλλο','uncategorized'
  ].map(syncNormalizeText));
}

function syncHumanizeMerchantHint(term){
  const raw=String(term||'').trim();
  if(!raw)return '';
  const normalized=syncNormalizeText(raw);
  const known={
    'pizzahut':'Pizza Hut','pizza hut':'Pizza Hut','domino':'Domino','dominos':'Domino\'s',
    'stoiximan':'Stoiximan','novibet':'Novibet','bet365':'Bet365','betshop':'Betshop',
    'more com':'More.com','more.com':'More.com','ticketmaster':'Ticketmaster','viva tickets':'Viva Tickets',
    'wolt':'Wolt','efood':'efood','box':'BOX','lidl':'Lidl','ab':'AB','sklavenitis':'Σκλαβενίτης',
    'σκλαβενιτησ':'Σκλαβενίτης','σκλαβενιτης':'Σκλαβενίτης','my market':'My Market','mymarket':'My Market',
    'shell':'Shell','bp':'BP','avin':'Avin','eko':'EKO','cosmote':'Cosmote','vodafone':'Vodafone','nova':'Nova',
    'netflix':'Netflix','spotify':'Spotify','apple':'Apple','google':'Google','youtube':'YouTube','disney':'Disney+'
  };
  if(known[normalized])return known[normalized];

  return raw.split(/\s+/).map(part=>{
    if(!part)return part;
    if(/^[A-Z0-9]{2,}$/.test(part))return part;
    if(/^[a-z0-9.]+$/i.test(part))return part.charAt(0).toUpperCase()+part.slice(1).toLowerCase();
    return part.charAt(0).toLocaleUpperCase('el-GR')+part.slice(1);
  }).join(' ');
}

function syncExtractMerchantFromDb(normalizedText,categoryMatch){
  const matches=syncDbCategoryCandidates(normalizedText);
  if(!matches.length)return '';

  const generic=syncGenericMerchantTermSet();
  const parentName=syncNormalizeText(categoryMatch?.category||'');
  const subName=syncNormalizeText(categoryMatch?.subcategoryName||'');

  const candidates=matches
    .filter(m=>m.rawTerm && m.termKey)
    .filter(m=>m.termKey!==parentName && m.termKey!==subName)
    .filter(m=>!generic.has(m.termKey))
    .filter(m=>m.termKey.length>=3)
    .sort((a,b)=>b.termLength-a.termLength);

  if(!candidates.length)return '';
  return syncHumanizeMerchantHint(candidates[0].rawTerm);
}

function syncStripDbCategoryTermsFromName(value,categoryMatch){
  let out=syncNormalizeText(value);
  if(!categoryMatch)return out;

  const terms=[categoryMatch.category,categoryMatch.subcategoryName,categoryMatch.matchedTerm]
    .filter(Boolean)
    .map(syncNormalizeText)
    .filter(Boolean)
    .sort((a,b)=>b.length-a.length);

  for(const term of terms){
    // Do not remove merchant-like matched terms such as "pizza hut"; they are useful names.
    if(term.includes(' ') && ![syncNormalizeText(categoryMatch.category),syncNormalizeText(categoryMatch.subcategoryName)].includes(term))continue;
    const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out=out.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`,'gi'),' ');
  }

  return out.replace(/\s+/g,' ').trim();
}

function getCurrentChatId(){
  if(typeof getTelegramChatId==='function')return getTelegramChatId();
  return localStorage.getItem('current_chat_id');
}

function getCurrentDataOwnerId(){
  if(typeof getDataOwnerId==='function')return getDataOwnerId();
  return String(currentUser?.id || currentSession?.user?.id || '').trim();
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

async function getSupabaseAccessToken(){
  if(currentSession?.access_token){
    return currentSession.access_token;
  }

  const sessionPromise=supabaseClient.auth.getSession();

  const timeoutPromise=new Promise((_,reject)=>{
    setTimeout(()=>reject(new Error('Timeout στο Supabase session. Κάνε refresh ή ξανά login.')),8000);
  });

  const {data,error}=await Promise.race([
    sessionPromise,
    timeoutPromise
  ]);

  if(error)throw error;

  const token=data?.session?.access_token;

  if(!token){
    throw new Error('Δεν υπάρχει ενεργό Google session. Κάνε ξανά σύνδεση.');
  }

  currentSession=data.session;
  currentUser=data.session.user;

  return token;
}

async function fetchWithTimeout(url, options={}, timeoutMs=15000){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);

  try{
    return await fetch(url,{
      ...options,
      signal:controller.signal
    });
  }finally{
    clearTimeout(timeout);
  }
}

async function saveSyncedExpenses(newExpenseRows){
  if(!newExpenseRows || newExpenseRows.length===0)return;

  const token=await getSupabaseAccessToken();

  const res=await fetchWithTimeout(
    `${CONFIG.SUPABASE_URL}/rest/v1/expenses`,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':CONFIG.SUPABASE_ANON_KEY,
        'Authorization':'Bearer '+token,
        'Prefer':'resolution=merge-duplicates'
      },
      body:JSON.stringify(newExpenseRows)
    },
    15000
  );

  if(!res.ok){
    const txt=await res.text();
    throw new Error('Save synced expenses failed: '+txt);
  }
}

function syncNormalizeText(text){
  return String(text||'')
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/ς/g,'σ')
    .replace(/[^a-z0-9α-ω\s]/gi,' ')
    .replace(/\s+/g,' ')
    .trim();
}



function syncTokenSimilarity(a,b){
  a=syncNormalizeText(a);
  b=syncNormalizeText(b);
  if(!a||!b)return 0;
  if(a===b)return 1;
  if(a.length<3 || b.length<3)return 0;

  const maxLen=Math.max(a.length,b.length);
  const minLen=Math.min(a.length,b.length);
  if(maxLen-minLen>3)return 0;

  const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)dp[i][0]=i;
  for(let j=0;j<=b.length;j++)dp[0][j]=j;
  for(let i=1;i<=a.length;i++){
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      dp[i][j]=Math.min(
        dp[i-1][j]+1,
        dp[i][j-1]+1,
        dp[i-1][j-1]+cost
      );
    }
  }
  const dist=dp[a.length][b.length];
  if(maxLen<=5)return dist<=1?1-(dist/maxLen):0;
  if(maxLen<=8)return dist<=2?1-(dist/maxLen):0;
  return dist<=2?1-(dist/maxLen):0;
}

function syncTextHasAlias(normalizedText,alias){
  const t=syncNormalizeText(normalizedText);
  const a=syncNormalizeText(alias);
  if(!t||!a)return false;
  if(t.includes(a))return true;

  const aliasTokens=a.split(' ').filter(Boolean);
  const textTokens=t.split(' ').filter(Boolean);
  if(aliasTokens.length===0)return false;

  if(aliasTokens.length===1){
    const token=aliasTokens[0];
    if(token.length<4)return false;
    return textTokens.some(part=>syncTokenSimilarity(part,token)>=0.74);
  }

  // For multi-word aliases, compare sliding windows and allow one small speech-to-text typo.
  for(let i=0;i<=textTokens.length-aliasTokens.length;i++){
    const window=textTokens.slice(i,i+aliasTokens.length);
    let score=0;
    for(let j=0;j<aliasTokens.length;j++)score+=syncTokenSimilarity(window[j],aliasTokens[j]);
    if(score/aliasTokens.length>=0.82)return true;
  }
  return false;
}

function syncIsPaymentAliasToken(token,aliases){
  const t=syncNormalizeText(token);
  if(!t || t.length<3)return false;
  return (aliases||[]).some(alias=>{
    const a=syncNormalizeText(alias);
    if(!a || a.includes(' '))return false;
    if(t===a)return true;
    if(a.length>=4 && syncTokenSimilarity(t,a)>=0.74)return true;
    return false;
  });
}

function syncPaymentSources(){
  // Telegram/voice sync handles real wallets and Ticket/Voucher style sources.
  // Credit-card purchases still need the Cards flow because they update debt/installments.
  const wallets=(typeof capvoDailyExpenseEligibleWallets==='function'?capvoDailyExpenseEligibleWallets():[])
    .map(w=>({
      ...w,
      id:w.id,
      name:w.name,
      type:'wallet',
      sourceKind:'wallet',
      accountType:'wallet',
      incomeType:'wallet',
      currentBalance:Number(w.currentBalance ?? w.current_balance)||0,
      icon:w.icon||'🏦'
    }));

  const benefits=(D.incomeSources||[])
    .filter(i=>typeof capvoIsBenefitSource==='function'?capvoIsBenefitSource(i):(i.restriction && i.restriction!=='none'))
    .map(i=>({...i,sourceKind:'benefit'}));

  return wallets.concat(benefits);
}

function syncSourceLooksRestricted(source){
  const name=syncNormalizeText(source?.name||'');
  const meta=syncNormalizeText([
    source?.budgetRole,source?.budget_role,source?.restrictionType,source?.restriction_type,
    source?.restriction,source?.category,source?.sourceCategory,source?.source_category,
    source?.incomeType,source?.type
  ].filter(Boolean).join(' '));
  return !!(
    source?.isRestricted || source?.is_restricted ||
    /restricted|ticket|voucher|edenred|meal|benefit|food/.test(meta) ||
    /ticket|τικετ|voucher|βαουτσερ|edenred|κουπονι|διατακτικ/.test(name)
  );
}

function syncSourceAliases(source){
  const aliases=[source?.name,source?.category,source?.incomeType,source?.type,source?.institutionName,source?.maskedLabel]
    .filter(Boolean);

  const isWallet=typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(source);
  const name=syncNormalizeText(source?.name||'');
  const type=syncNormalizeText(source?.type||source?.incomeType||'');
  const restricted=syncSourceLooksRestricted(source);

  if(isWallet){
    if(type==='cash' || /μετρη|cash/.test(name)){
      aliases.push(
        'μετρητα','μετρητοισ','μετρητοις','μετρητο','μετρητα μου',
        'cash','cash money','metrita','metrhta','metrita mou','lefta','leuta','χρηματα','λεφτα'
      );
    }
    if(/revolut|revolout|revoloyt|ρεβολουτ|revo|ρεβο/.test(name)){
      aliases.push(
        'revolut','revolout','revoloyt','revolute','revoloud','revolut μου','revolout μου',
        'revo','rev','ρεβολουτ','ρεβολου','ρεβολουτ μου','ρεβολοτ','ρεβο','ρεβ'
      );
    }
    if(/κυριο|λογαριασ|main|primary/.test(name) || source?.isDefault || source?.is_default || source?.isPrimaryBudget || source?.is_primary_budget){
      aliases.push(
        'κυριοσ λογαριασμοσ','κυριος λογαριασμος','κυριο λογαριασμο','κυριοσ','κυριος','κυριο',
        'main','primary','bank','τραπεζα','λογαριασμοσ','λογαριασμος'
      );
    }
    if(restricted){
      aliases.push(
        'ticket','tickets','τικετ','τίκετ','τικετα','ticket restaurant','voucher','vouchers',
        'βαουτσερ','edenred','eden red','κουπονι','κουπονια','διατακτικη','διατακτικες','food pass'
      );
    }
    aliases.push('wallet','πορτοφολι');
  }else{
    aliases.push(
      'ticket','tickets','τικετ','τίκετ','τικετα','ticket restaurant','voucher','vouchers',
      'βαουτσερ','edenred','eden red','κουπονι','κουπονια','διατακτικη','διατακτικες','food pass'
    );
  }

  return [...new Set(aliases.map(syncNormalizeText).filter(Boolean))]
    .filter(a=>a.length>1);
}

function syncExplicitPaymentIntent(text){
  const t=syncNormalizeText(text);
  if(/ticket|τικετ|voucher|βαουτσερ|edenred|κουπονι|διατακτικ|food pass/.test(t))return 'restricted';
  if(/revolut|revolout|revoloyt|revolute|revo|ρεβολουτ|ρεβολου|ρεβολοτ|ρεβο/.test(t))return 'revolut';
  if(/μετρη|cash|metrita|metrhta|lefta|leuta/.test(t))return 'cash';
  if(/κυριο|λογαριασμο|main|primary/.test(t))return 'primary';
  return '';
}

function detectPaymentSourceFromText(text){
  const t=syncNormalizeText(text);

  const sources=typeof syncPaymentSources==='function'?syncPaymentSources():(D.incomeSources||[])
    .filter(i=>typeof isRestrictedPaymentSource==='function'?isRestrictedPaymentSource(i):(i.restriction && i.restriction!=='none'));

  if(sources.length===0)return null;

  const intent=syncExplicitPaymentIntent(t);
  const ordered=sources.slice().sort((a,b)=>{
    const aw=typeof capvoIsWalletPaymentSource==='function'&&capvoIsWalletPaymentSource(a);
    const bw=typeof capvoIsWalletPaymentSource==='function'&&capvoIsWalletPaymentSource(b);
    const ar=syncSourceLooksRestricted(a);
    const br=syncSourceLooksRestricted(b);
    const an=syncNormalizeText(a?.name||'');
    const bn=syncNormalizeText(b?.name||'');

    if(intent==='restricted' && ar!==br)return ar?-1:1;
    if(intent==='cash'){
      const ac=(syncNormalizeText(a?.type||a?.incomeType||'')==='cash') || /μετρη|cash/.test(an);
      const bc=(syncNormalizeText(b?.type||b?.incomeType||'')==='cash') || /μετρη|cash/.test(bn);
      if(ac!==bc)return ac?-1:1;
    }
    if(intent==='revolut'){
      const av=/revolut|revolout|revoloyt|ρεβολουτ|ρεβολου|revo|ρεβο/.test(an);
      const bv=/revolut|revolout|revoloyt|ρεβολουτ|ρεβολου|revo|ρεβο/.test(bn);
      if(av!==bv)return av?-1:1;
    }
    if(intent==='primary'){
      const ap=!!(a?.isDefault||a?.is_default||a?.isPrimaryBudget||a?.is_primary_budget||/κυριο|λογαριασ|main|primary/.test(an));
      const bp=!!(b?.isDefault||b?.is_default||b?.isPrimaryBudget||b?.is_primary_budget||/κυριο|λογαριασ|main|primary/.test(bn));
      if(ap!==bp)return ap?-1:1;
    }

    // Prefer real wallets over legacy income-source benefits unless the alias clearly points elsewhere.
    if(aw!==bw)return aw?-1:1;
    return 0;
  });

  for(const source of ordered){
    const tokens=syncSourceAliases(source).sort((a,b)=>b.length-a.length);
    if(tokens.some(token=>token && syncTextHasAlias(t,token))){
      return source;
    }
  }

  if(typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel()){
    const def=typeof capvoDailyExpenseDefaultWallet==='function'?capvoDailyExpenseDefaultWallet():(typeof capvoDefaultWallet==='function'?capvoDefaultWallet():null);
    if(def)return {
      ...def,
      id:def.id,
      name:def.name,
      type:'wallet',
      sourceKind:'wallet',
      accountType:'wallet',
      incomeType:'wallet',
      currentBalance:Number(def.currentBalance ?? def.current_balance)||0,
      icon:def.icon||'🏦'
    };
  }

  return null;
}

function syncExtractAmount(text){
  const value=String(text||'');
  const match=value.match(/(\d+(?:[.,]\d{1,2})?)(?:\s*(ευρώ|ευρω|euro|€))?(?:\s+(?:και)\s+(\d{1,2})(?:\s*(λεπτά|λεπτα|λεπτό|λεπτο|cents?))?)?/i);
  if(!match)return null;

  let amount=parseFloat(match[1].replace(',','.'));
  if(match[3] && !/[.,]/.test(match[1])){
    const cents=Number(match[3]);
    if(cents>0 && cents<100)amount+=cents/100;
  }

  if(!amount || amount<=0)return null;
  return {amount,raw:match[0]};
}

function syncStripPaymentWordsFromName(value,paymentSource){
  let out=syncNormalizeText(value);
  const common=[
    'ticket restaurant','ticket','tickets','τικετ','τικετα','voucher','vouchers','βαουτσερ','edenred','eden red','κουπονι','κουπονια','διατακτικη','διατακτικες','food pass',
    'μετρητα','μετρητοισ','μετρητοις','cash','metrita','metrhta','lefta','leuta',
    'revolut','revolout','revoloyt','revolute','revo','rev','ρεβολουτ','ρεβολου','ρεβολοτ','ρεβο','ρεβ',
    'κυριοσ λογαριασμοσ','κυριος λογαριασμος','κυριο λογαριασμο','κυριοσ','κυριος','κυριο','main','primary','bank','τραπεζα','wallet','πορτοφολι'
  ];
  const sourceAliases=paymentSource ? syncSourceAliases(paymentSource) : [];
  const removeList=[...new Set([...common,...sourceAliases])].filter(Boolean).sort((a,b)=>b.length-a.length);

  for(const alias of removeList){
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out=out.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`,'gi'),' ');
  }

  const fuzzyAliases=removeList.filter(a=>a && !a.includes(' ') && a.length>=4);
  out=out.split(' ').filter(part=>!syncIsPaymentAliasToken(part,fuzzyAliases)).join(' ');

  out=out
    .replace(/\b(με|απο|από|σε|στο|στη|στην|στον|απ|απτο|απο|apo|me|se|from|with|by)\b/gi,' ')
    .replace(/\s+/g,' ')
    .trim();

  return out;
}

function parseExpense(text){
  const normalized=(typeof window!=='undefined' && typeof window.normalizeQuickExpenseText==='function')
    ? window.normalizeQuickExpenseText(text)
    : String(text||'');
  const nt=syncNormalizeText(normalized);
  const amountInfo=syncExtractAmount(normalized);

  if(!amountInfo)return null;

  const amount=amountInfo.amount;
  let category='Άλλο';
  let categoryId=null;
  let subcategoryId=null;

  const dbCategory=syncMatchCategoryFromDb(nt);
  if(dbCategory){
    category=dbCategory.category||category;
    categoryId=dbCategory.categoryId||null;
    subcategoryId=dbCategory.subcategoryId||null;
  }else{
    for(const[cat,keywords]of Object.entries(CAT_KEYWORDS)){
      if(keywords.some(kw=>nt.includes(syncNormalizeText(kw)))){
        category=cat;
        break;
      }
    }
  }

  const paymentSource=detectPaymentSourceFromText(normalized);
  const merchantName=dbCategory ? syncExtractMerchantFromDb(nt,dbCategory) : '';

  let nameBase=normalized
    .replace(amountInfo.raw,' ')
    .replace(/\b(σήμερα|σημερα|χθες|χθεσ|αύριο|αυριο|πρωί|πρωι|βράδυ|βραδυ|μεσημέρι|μεσημερι)\b/gi,' ');

  nameBase=syncStripPaymentWordsFromName(nameBase,paymentSource);
  nameBase=syncStripDbCategoryTermsFromName(nameBase,dbCategory);

  let name=merchantName || nameBase;
  if(name.length>0)name=name.charAt(0).toLocaleUpperCase('el-GR')+name.slice(1);
  else name=dbCategory?.subcategoryName || category;

  let date=typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA');

  if(nt.includes('χθεσ')){
    const y=new Date();
    y.setDate(y.getDate()-1);
    date=typeof capvoLocalDateKey==='function'?capvoLocalDateKey(y):y.toLocaleDateString('en-CA');
  }

  const expense={
    amount,
    category,
    categoryId,
    subcategoryId,
    name,
    date,
    merchantName:merchantName||'',
    notes:'',
    paymentSourceId:paymentSource?.id||'',
    paymentSourceName:paymentSource?.name||'',
    paymentSourceType:paymentSource?.incomeType||''
  };

  if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(expense);
  if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});
  return expense;
}

async function markTelegramMessages(messageIds,status){
  if(!messageIds || messageIds.length===0)return;

  const token=await getSupabaseAccessToken();

  const url=new URL(CONFIG.WORKER_URL);
  url.pathname='/mark';

  const res=await fetchWithTimeout(url.toString(),{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token
    },
    body:JSON.stringify({
      message_ids:messageIds,
      status
    })
  });

  if(!res.ok){
    throw new Error('Mark messages failed: '+res.status);
  }

  const data=await res.json();

  if(data.error){
    throw new Error(data.error);
  }

  return data;
}

let syncRunning=false;

async function syncFromTelegram(){
  if(syncRunning)return;

  syncRunning=true;

  const btn=$('syncBtn');
  const statusEl=$('syncStatus');
  const chatId=getCurrentChatId();

  try{
    btn.disabled=true;
    btn.textContent='⏳ Συγχρονισμός...';

    statusEl.style.display='block';
    statusEl.className='sync-status loading';
    statusEl.textContent='Έλεγχος σύνδεσης...';

    if(!chatId){
      statusEl.className='sync-status info';
      statusEl.innerHTML='Για να χρησιμοποιήσεις Telegram Sync, σύνδεσε πρώτα το Telegram bot.';
      btn.disabled=false;
      btn.textContent='Σύνδεση Telegram';
      btn.onclick=()=>{ if(typeof switchChatId==='function')switchChatId(); };
      setTimeout(()=>{ if(typeof switchChatId==='function')switchChatId(); },150);
      return;
    }

    const token=await getSupabaseAccessToken();

    statusEl.textContent='Σύνδεση με Worker...';

    const workerUrl=new URL(CONFIG.WORKER_URL);

    const res=await fetchWithTimeout(workerUrl.toString(),{
      method:'GET',
      headers:{
        'Authorization':'Bearer '+token
      }
    },15000);

    statusEl.textContent='Ανάγνωση δεδομένων...';

    if(!res.ok){
      const txt=await res.text();
      throw new Error('Worker error '+res.status+': '+txt);
    }

    const data=await res.json();

    if(data.error){
      throw new Error(data.error);
    }

    const messages=data.messages||[];

    const newMessages=messages.filter(m=>
      m.text &&
      !m.text.trim().startsWith('/') &&
      !expenseExistsById(telegramExpenseId(chatId,m.message_id))
    );

    const alreadyExisting=messages
      .filter(m=>expenseExistsById(telegramExpenseId(chatId,m.message_id)))
      .map(m=>m.message_id);

    if(alreadyExisting.length>0){
      await markTelegramMessages(alreadyExisting,'imported');
    }

    if(newMessages.length===0){
      statusEl.className='sync-status info';
      statusEl.textContent='✅ Δεν υπάρχουν νέα έξοδα.';
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
    openSyncPreview(parsed);

  }catch(err){
    console.error('syncFromTelegram error:',err);

    statusEl.style.display='block';
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Σφάλμα: '+(
      err.name==='AbortError'
        ? 'Ο Worker άργησε πολύ να απαντήσει.'
        : err.message
    );

  }finally{
    syncRunning=false;
    if(btn){
      btn.disabled=false;
      btn.textContent=getCurrentChatId()?'Συγχρονισμός τώρα':'Σύνδεση Telegram';
    }
  }
}


function syncPickerOptionsHtml(options, selectedValue){
  return (options||[]).map(o=>{
    const value=String(o.value??'');
    const label=String(o.label??value);
    const desc=String(o.desc??'');
    const icon=String(o.icon??'');
    const active=value===String(selectedValue??'');
    return `
      <button type="button" class="capvo-sync-picker-option ${active?'active':''}" onclick="selectSyncPickerValue(event,'${esc(value)}','${esc(label)}')">
        ${icon?`<span class="capvo-sync-picker-icon">${esc(icon)}</span>`:''}
        <span class="capvo-sync-picker-copy">
          <strong>${esc(label)}</strong>
          ${desc?`<small>${esc(desc)}</small>`:''}
        </span>
      </button>`;
  }).join('');
}

function buildSyncPicker(selectId, options, selectedValue){
  const current=(options||[]).find(o=>String(o.value)===String(selectedValue)) || (options||[])[0] || {value:'',label:'—'};
  const hiddenOptions=(options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(selectedValue)?'selected':''}>${esc(o.label)}</option>`).join('');

  return `
    <select class="sync-select capvo-sync-native-select" id="${selectId}" aria-hidden="true" tabindex="-1">
      ${hiddenOptions}
    </select>
    <div class="capvo-sync-picker" data-select-id="${selectId}">
      <button type="button" class="capvo-sync-picker-trigger" onclick="toggleSyncPicker(event,this)">
        ${current.icon?`<span class="capvo-sync-picker-icon">${esc(current.icon)}</span>`:''}
        <span class="capvo-sync-picker-copy">
          <strong>${esc(current.label)}</strong>
          ${current.desc?`<small>${esc(current.desc)}</small>`:''}
        </span>
        <span class="capvo-sync-picker-chevron">⌄</span>
      </button>
      <div class="capvo-sync-picker-menu">
        ${syncPickerOptionsHtml(options,selectedValue)}
      </div>
    </div>`;
}

function toggleSyncPicker(event,btn){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const picker=btn.closest('.capvo-sync-picker');
  if(!picker)return;
  const shouldOpen=!picker.classList.contains('is-open');
  document.querySelectorAll('.capvo-sync-picker.is-open').forEach(p=>{
    if(p!==picker)p.classList.remove('is-open');
  });
  picker.classList.toggle('is-open',shouldOpen);
}

function selectSyncPickerValue(event,value,label){
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const option=event.currentTarget;
  const picker=option.closest('.capvo-sync-picker');
  if(!picker)return;
  const select=$(picker.dataset.selectId);
  if(select){
    select.value=value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  const trigger=picker.querySelector('.capvo-sync-picker-trigger');
  const copy=option.querySelector('.capvo-sync-picker-copy')?.innerHTML || `<strong>${esc(label)}</strong>`;
  const icon=option.querySelector('.capvo-sync-picker-icon')?.outerHTML || '';
  if(trigger){
    trigger.innerHTML=`${icon}<span class="capvo-sync-picker-copy">${copy}</span><span class="capvo-sync-picker-chevron">⌄</span>`;
  }
  picker.querySelectorAll('.capvo-sync-picker-option').forEach(o=>o.classList.remove('active'));
  option.classList.add('active');
  picker.classList.remove('is-open');
}

document.addEventListener('click',e=>{
  if(!e.target.closest?.('.capvo-sync-picker')){
    document.querySelectorAll('.capvo-sync-picker.is-open').forEach(p=>p.classList.remove('is-open'));
  }
});
function openSyncPreview(items){
  let overlay=$('mSyncPreview');

  if(!overlay){
    overlay=document.createElement('div');
    overlay.className='modal-overlay capvo-sync-review-overlay';
    overlay.id='mSyncPreview';
    overlay.innerHTML='<div class="modal modal-wide capvo-sync-review-sheet" id="mSyncPreviewInner"></div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click',e=>{
      if(e.target===overlay)closeSyncPreview();
    });
  }else{
    overlay.classList.add('capvo-sync-review-overlay');
    overlay.innerHTML='<div class="modal modal-wide capvo-sync-review-sheet" id="mSyncPreviewInner"></div>';
  }

  const invalidCount=items.filter(item=>{
    const duplicate=expenseExistsById(telegramExpenseId(getCurrentChatId(),item.message_id));
    return item.skip||duplicate;
  }).length;

  const rows=items.map((item,idx)=>{
    const e=item.expense||{
      name:'',
      amount:'',
      category:'Άλλο',
      date:typeof todayISO==='function'?todayISO():new Date().toLocaleDateString('en-CA'),
      paymentSourceId:'',
      paymentSourceName:'',
      paymentSourceType:''
    };

    const duplicate=expenseExistsById(
      telegramExpenseId(getCurrentChatId(),item.message_id)
    );

    const invalid=item.skip||duplicate;
    const skipChecked=invalid?'checked':'';
    const dimmed=invalid?'style="opacity:0.45;pointer-events:none"':'';

    return`
      <article class="sync-row capvo-sync-row ${invalid?'skipped':''}" id="syncRow${idx}" data-invalid="${invalid}">
        <div class="sync-row-original capvo-sync-original">
          <span class="capvo-sync-msg-icon">💬</span>
          <div class="capvo-sync-original-copy">
            <small>Μήνυμα Telegram</small>
            <strong>${esc(item.original)}</strong>
          </div>
          <div class="capvo-sync-badges">
            ${duplicate?'<span class="sync-badge duplicate">Ήδη υπάρχει</span>':''}
            ${item.skip?'<span class="sync-badge invalid">Θέλει έλεγχο</span>':''}
          </div>
        </div>

        <div class="sync-row-fields capvo-sync-fields" id="syncFields${idx}" ${dimmed}>
          <label class="capvo-sync-field capvo-sync-field-name">
            <span>Περιγραφή</span>
            <input class="sync-input" type="text" id="sName${idx}" value="${esc(e.name)}" placeholder="π.χ. Καφές">
          </label>

          <label class="capvo-sync-field capvo-sync-field-amount">
            <span>Ποσό</span>
            <input class="sync-input sync-amount" type="number" id="sAmt${idx}" value="${e.amount}" placeholder="€" step="0.01" min="0">
          </label>

          <label class="capvo-sync-field capvo-sync-field-category">
            <span>Κατηγορία</span>
            ${buildSyncPicker(`sCat${idx}`, ALL_CATS.map(c=>({
                value:c,
                label:c,
                icon:(typeof CEMO!=='undefined' && CEMO[c]) ? CEMO[c] : ''
              })), e.category)}
          </label>

          <label class="capvo-sync-field capvo-sync-field-date">
            <span>Ημερομηνία</span>
            <input class="sync-input sync-date" type="date" id="sDate${idx}" value="${e.date}">
          </label>

          <label class="capvo-sync-field capvo-sync-field-pay">
            <span>Πληρωμή</span>
            ${buildSyncPicker(`sPay${idx}`, [
                ...((typeof capvoHasWalletBudgetModel==='function' && capvoHasWalletBudgetModel())?[]:[{value:'',label:'Κανονικό budget',icon:'💶',desc:'Χωρίς wallet / Ticket'}]),
                ...(typeof syncPaymentSources==='function'?syncPaymentSources():availablePaymentSources()).map(src=>{
                  const isWallet=typeof capvoIsWalletPaymentSource==='function' && capvoIsWalletPaymentSource(src);
                  return {
                    value:src.id,
                    label:isWallet?`${src.name} · ${(typeof fmt==='function'?fmt(Number(src.currentBalance)||0):(Number(src.currentBalance)||0)+'€')}`:src.name,
                    icon:isWallet?(src.icon||'🏦'):'🎫',
                    desc:isWallet?'Wallet πληρωμής':'Ticket / Voucher'
                  };
                })
              ], e.paymentSourceId||'')}
          </label>
        </div>

        <label class="sync-skip-label capvo-sync-skip">
          <input type="checkbox" id="sSkip${idx}" ${skipChecked} onchange="toggleSyncRow(${idx})">
          <span>Παράλειψη αυτής της κίνησης</span>
        </label>
      </article>`;
  }).join('');

  const msgIds=JSON.stringify(items.map(i=>i.message_id));

  $('mSyncPreviewInner').innerHTML=`
    <div class="capvo-sync-review-head">
      <button class="modal-close capvo-sync-close" onclick="closeSyncPreview()" aria-label="Κλείσιμο">×</button>
      <span class="capvo-sync-kicker">TELEGRAM SYNC</span>
      <h2>Έλεγχος εξόδων</h2>
      <p>Δες τις κινήσεις που βρέθηκαν από το Telegram, διόρθωσε ό,τι χρειάζεται και πάτα αποθήκευση.</p>

      <div class="capvo-sync-summary">
        <div><strong>${items.length}</strong><span>κινήσεις</span></div>
        <div><strong>${Math.max(0,items.length-invalidCount)}</strong><span>έτοιμες</span></div>
        <div class="${invalidCount?'has-warning':''}"><strong>${invalidCount}</strong><span>για έλεγχο</span></div>
      </div>
    </div>

    <div class="sync-toolbar capvo-sync-toolbar">
      <button class="mini-action" onclick="setAllSyncRows(false)">✓ Επιλογή όλων</button>
      <button class="mini-action" onclick="setAllSyncRows(true)">Παράλειψη όλων</button>
      <button class="mini-action" onclick="setOnlyInvalidSyncRows()">Μόνο προβληματικά</button>
    </div>

    <div id="syncRowsList" class="capvo-sync-rows">${rows}</div>

    <div class="sync-actions-sticky capvo-sync-actions">
      <button type="button" class="btn btn-primary" id="btnConfirmSync">
        Αποθήκευση κινήσεων
      </button>

      <button class="btn btn-secondary" onclick="closeSyncPreview()">
        Ακύρωση
      </button>
    </div>
  `;

  overlay.style.display='';
  overlay.style.pointerEvents='';
  overlay.classList.add('active');
  document.body.style.overflow='hidden';

  // Always open review at the top on iOS/Safari.
  const reviewInner=$('mSyncPreviewInner');
  if(reviewInner) reviewInner.scrollTop=0;
  overlay.scrollTop=0;

  window.currentSyncMessageIds=items.map(i=>i.message_id);

  setTimeout(()=>{
    const btn=$('btnConfirmSync');
    if(btn){
      btn.onclick=()=>{
        confirmSync(window.currentSyncMessageIds);
      };
    }
  },0);
}
function toggleSyncRow(idx){
  const skip=$('sSkip'+idx).checked;
  const fields=$('syncFields'+idx);

  fields.style.opacity=skip?'0.4':'1';
  fields.style.pointerEvents=skip?'none':'';

  $('syncRow'+idx).className='sync-row capvo-sync-row'+(skip?' skipped':'');
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
  if(o){
    o.classList.remove('active');
    o.remove();
  }

  document.body.style.overflow='';
}

async function confirmSync(...messageIds){
  const ids=messageIds.flat();
  const rows=document.querySelectorAll('.sync-row');
  const chatId=getCurrentChatId();
  const dataOwnerId=getCurrentDataOwnerId();
  const statusEl=$('syncStatus');

  const importedIds=[];
  const skippedIds=[];
  const newExpenseRows=[];
  const pendingExpenses=[];
  const sourceUsage={};
  const walletUsage={};

  let added=0;
  let skipped=0;
  let maxId=parseInt(localStorage.getItem(getSyncKey())||'0');

  const failBeforeSave=(message,idx=null)=>{
    if(idx!==null){
      const row=$('syncRow'+idx);
      if(row){
        row.dataset.invalid='true';
        row.classList.add('skipped');
      }
    }
    if(statusEl){
      statusEl.style.display='block';
      statusEl.className='sync-status error';
      statusEl.textContent='❌ '+message;
    }
    if(typeof showMiniToast==='function')showMiniToast(message,'error');
    return false;
  };

  for(let idx=0;idx<rows.length;idx++){
    const msgId=ids[idx];
    if(msgId>maxId)maxId=msgId;

    if($('sSkip'+idx)?.checked){
      skippedIds.push(msgId);
      skipped++;
      continue;
    }

    const id=telegramExpenseId(chatId,msgId);

    if(expenseExistsById(id)){
      importedIds.push(msgId);
      skipped++;
      continue;
    }

    const name=String($('sName'+idx)?.value||'').trim();
    const amount=parseFloat($('sAmt'+idx)?.value);
    const cat=$('sCat'+idx)?.value||'Άλλο';
    const date=typeof normalizeDateValue==='function'
      ? normalizeDateValue($('sDate'+idx)?.value)
      : String($('sDate'+idx)?.value||'').slice(0,10);
    const paymentSourceId=$('sPay'+idx)?.value||'';
    const paymentSource=paymentSourceById(paymentSourceId);

    if(!name||!amount||amount<=0){
      return failBeforeSave('Υπάρχει Telegram κίνηση χωρίς σωστή περιγραφή ή ποσό. Διόρθωσέ τη ή επίλεξε παράλειψη.',idx);
    }
    if(!date){
      return failBeforeSave('Υπάρχει Telegram κίνηση χωρίς σωστή ημερομηνία. Διόρθωσέ τη ή επίλεξε παράλειψη.',idx);
    }
    if(paymentSource && typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(paymentSource)){
      return failBeforeSave('Οι αγορές με πιστωτική από Telegram Sync δεν υποστηρίζονται ακόμα. Καταχώρησέ τη από την ενότητα Κάρτες για να ενημερωθεί σωστά το χρέος.',idx);
    }

    const expense={
      id,
      name,
      amount,
      category:cat,
      date,
      paymentSourceId,
      paymentSourceName:paymentSource?.name||'',
      paymentSourceType:paymentSource?.incomeType||''
    };

    if(typeof capvoPrepareDailyExpenseFunding==='function')capvoPrepareDailyExpenseFunding(expense,{preserveBlank:false});
    const preparedSource=paymentSourceById(expense.paymentSourceId||expense.walletId||'');

    if(preparedSource && typeof isCreditCardPaymentSource==='function' && isCreditCardPaymentSource(preparedSource)){
      return failBeforeSave('Οι αγορές με πιστωτική από Telegram Sync δεν υποστηρίζονται ακόμα. Καταχώρησέ τη από την ενότητα Κάρτες για να ενημερωθεί σωστά το χρέος.',idx);
    }

    if(expense.walletId){
      const wallet=typeof capvoWalletById==='function'?capvoWalletById(expense.walletId):null;
      if(!wallet)return failBeforeSave('Δεν βρέθηκε το wallet πληρωμής.',idx);
      if(typeof capvoDailyExpenseIsSavingsWallet==='function' && capvoDailyExpenseIsSavingsWallet(wallet)){
        return failBeforeSave('Δεν μπορείς να πληρώσεις έξοδο από αποταμιευτικό wallet.',idx);
      }
      const available=Number(wallet.currentBalance)||0;
      const already=walletUsage[expense.walletId]||0;
      if(available-already-amount<0){
        return failBeforeSave(`Το wallet ${wallet.name||'Wallet'} δεν έχει αρκετά χρήματα. Διαθέσιμο: ${typeof fmt==='function'?fmt(Math.max(0,available-already)):`€${Math.max(0,available-already)}`}.`,idx);
      }
      walletUsage[expense.walletId]=already+amount;
    }else if(expense.paymentSourceId){
      const catCheck=typeof validateRestrictedSourceCategory==='function'
        ? validateRestrictedSourceCategory(expense)
        : {ok:true,source:preparedSource,allowed:[]};
      if(!catCheck.ok){
        return failBeforeSave(`Η πηγή ${catCheck.source?.name||'πληρωμής'} χρησιμοποιείται μόνο για: ${catCheck.allowed.join(', ')}.`,idx);
      }

      const available=typeof paymentSourceRemaining==='function'
        ? paymentSourceRemaining(preparedSource)
        : Number(preparedSource?.amount)||0;
      const already=sourceUsage[expense.paymentSourceId]||0;
      if(available-already-amount<0){
        return failBeforeSave(`Το υπόλοιπο ${preparedSource?.name||'της πηγής'} δεν επαρκεί. Διαθέσιμο: ${typeof fmt==='function'?fmt(Math.max(0,available-already)):`€${Math.max(0,available-already)}`}.`,idx);
      }
      sourceUsage[expense.paymentSourceId]=already+amount;
    }

    if(typeof capvoApplyExpenseCategoryMeta==='function')capvoApplyExpenseCategoryMeta(expense);
    pendingExpenses.push({msgId,expense,paymentSource:preparedSource});
  }

  pendingExpenses.forEach(({msgId,expense,paymentSource})=>{
    const monthKey=expense.date.substring(0,7);
    ensM(monthKey);
    D.months[monthKey].daily.push(expense);

    newExpenseRows.push({
      id:expense.id,
      user_id:dataOwnerId,
      user_chat_id:chatId || null,
      name:expense.name,
      amount:expense.amount,
      category:expense.category,
      category_id:expense.categoryId||expense.category_id||null,
      subcategory_id:expense.subcategoryId||expense.subcategory_id||null,
      merchant_name:expense.merchantName||expense.merchant_name||null,
      notes:expense.notes||null,
      date:expense.date,
      type:'daily',
      month_key:monthKey,
      payment_source_id:expense.paymentSourceId||null,
      payment_source_name:paymentSource?.name||null,
      payment_source_type:paymentSource?.incomeType||null,
      // Normalize to DB-valid values: cash | restricted_balance | credit_card | transfer
      payment_account_type:(()=>{ const t=expense.paymentAccountType||'cash'; return ['cash','restricted_balance','credit_card','transfer'].includes(t)?t:'restricted_balance'; })(),
      affects_cash_budget:expense.affectsCashBudget!==false,
      is_credit_card_purchase:false,
      // Fields required for schema parity with saveDailyExpenseRow (Telegram never sets these).
      credit_card_id:null,
      credit_card_transaction_id:null,
      installment_plan_id:null,
      purchase_mode:'normal',
      installment_count:null,
      interest_free:true,
      installment_rate:null,
      installment_amount:null,
      wallet_id:expense.walletId||null,
      budget_effect_amount:Object.prototype.hasOwnProperty.call(expense,'budgetEffectAmount') ? Number(expense.budgetEffectAmount)||0 : null,
      wallet_balance_effect_amount:Object.prototype.hasOwnProperty.call(expense,'walletBalanceEffectAmount') ? Number(expense.walletBalanceEffectAmount)||0 : 0
    });

    importedIds.push(msgId);
    added++;
  });

  let walletBatchRollback=null;
  try{
    statusEl.style.display='block';
    statusEl.className='sync-status loading';
    statusEl.textContent='Αποθήκευση εξόδων...';

    if(newExpenseRows.length>0){
      if(typeof capvoApplyDailyExpenseWalletEffects==='function'){
        const rollbackOps=[];
        for(const {expense} of pendingExpenses){
          const effect=await capvoApplyDailyExpenseWalletEffects(dataOwnerId,expense,null);
          if(effect?.rollback)rollbackOps.push(effect.rollback);
        }
        walletBatchRollback=async()=>{
          for(const rollback of rollbackOps.reverse()){
            try{await rollback();}catch(e){console.error('sync wallet rollback failed:',e);}
          }
        };
      }
      await saveSyncedExpenses(newExpenseRows);
      localStorage.setItem('needs_data_reload','1');
    }

    statusEl.textContent='Ενημέρωση Telegram messages...';

    if(importedIds.length>0){
      await markTelegramMessages(importedIds,'imported');
    }

    if(skippedIds.length>0){
      await markTelegramMessages(skippedIds,'skipped');
    }

    localStorage.setItem(getSyncKey(),maxId.toString());

    if(newExpenseRows.length>0 && chatId){
      try{
        await fetchAllData(dataOwnerId);
      }catch(reloadErr){
        console.warn('Telegram sync saved, but data reload failed:',reloadErr);
      }
    }

    closeSyncPreview();
    render();

    statusEl.style.display='block';
    statusEl.className='sync-status success';
    statusEl.textContent=`✅ Προστέθηκαν ${added} έξοδα${skipped>0?` (${skipped} παραλείφθηκαν)`:''}`;

    setTimeout(()=>{statusEl.style.display='none'},4000);

  }catch(err){
    console.error('confirmSync error:',err);
    if(walletBatchRollback){
      try{await walletBatchRollback();}catch(rollbackErr){console.error('confirmSync wallet rollback failed:',rollbackErr);}
    }
    try{
      pendingExpenses.forEach(({expense})=>{
        Object.values(D.months||{}).forEach(m=>{
          m.daily=(m.daily||[]).filter(x=>String(x.id)!==String(expense.id));
        });
      });
    }catch(cleanErr){console.error('confirmSync local cleanup failed:',cleanErr);}

    statusEl.style.display='block';
    statusEl.className='sync-status error';
    statusEl.textContent='❌ Δεν αποθηκεύτηκε: '+err.message;

    showMiniToast(
      '❌ Δεν αποθηκεύτηκε σωστά',
      'error'
    );
  }
}
