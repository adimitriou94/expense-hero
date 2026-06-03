// CAPVO app split: 05-income-pickers.js
// Source: js/legacy/app.monolith.backup.js
// Keep classic <script> loading order from index.html.

// ===== INCOME SOURCE CUSTOM PICKERS =====
const INCOME_PICKER_META={
  fISCategory:{
    'Μισθός':['💼','Σταθερό μηνιαίο εισόδημα'],
    'Bonus':['🎁','Έκτακτη επιβράβευση'],
    'Ενοίκιο':['🏠','Έσοδο από ακίνητο'],
    'Ticket Restaurant':['🍽️','Voucher για φαγητό'],
    'Άυλη κάρτα':['💳','Ψηφιακή κάρτα / benefit'],
    'Μερίσματα':['📈','Επενδυτικό εισόδημα'],
    'Freelance':['💻','Ελεύθερη εργασία'],
    'Δώρο':['🎀','Έκτακτο ποσό'],
    'Άλλο':['✨','Προσαρμοσμένη πηγή']
  },
  fISType:{
    bank:['🏦','Κατάθεση σε λογαριασμό'],
    cash:['💶','Μετρητά'],
    voucher:['🎫','Ticket / voucher balance'],
    card:['💳','Κάρτα ή prepaid'],
    investment:['📊','Επένδυση / απόδοση']
  },
  fISRestriction:{
    none:['🔓','Μπαίνει ελεύθερα στο budget'],
    food_only:['🍽️','Χρήση μόνο για φαγητό'],
    card_only:['💳','Χρήση μόνο με κάρτα'],
    locked:['🔒','Δεν ξοδεύεται ελεύθερα'],
    investment:['📈','Πηγαίνει σε επένδυση']
  },
  fISRestrictedCategory:{
    '':['✨','Δεν αφορά συγκεκριμένη κατηγορία'],
    'Τρόφιμα':['🛒','Super market / τρόφιμα'],
    'Φαγητό έξω':['🍕','Delivery / εστιατόρια'],
    'Μεταφορά':['🚗','Καύσιμα / μετακινήσεις'],
    'Στέγαση':['🏠','Σπίτι / ενοίκιο'],
    'Λογαριασμοί':['💡','Ρεύμα / internet / λοιπά'],
    'Υγεία':['🏥','Ιατρικά / φαρμακείο'],
    'Άλλο':['📌','Λοιπές κινήσεις']
  }
};

function incomePickerOptionMeta(selectId,value,label){
  const meta=INCOME_PICKER_META?.[selectId]?.[value] || INCOME_PICKER_META?.[selectId]?.[label];
  return meta || ['•','Επιλογή'];
}

function syncIncomeCustomPicker(select){
  if(!select)return;
  const picker=document.querySelector(`[data-income-picker-for="${select.id}"]`);
  if(!picker)return;

  const selected=select.options[select.selectedIndex] || select.options[0];
  const value=selected?.value ?? '';
  const label=selected?.textContent?.trim() || value;
  const [icon,desc]=incomePickerOptionMeta(select.id,value,label);

  picker.querySelector('.income-picker-icon').textContent=icon;
  picker.querySelector('.income-picker-title').textContent=label;
  picker.querySelector('.income-picker-desc').textContent=desc;

  picker.querySelectorAll('.income-picker-option').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.value===value);
  });
}

function closeIncomeCustomPickers(except=null){
  document.querySelectorAll('.income-custom-picker.is-open').forEach(picker=>{
    if(picker!==except)picker.classList.remove('is-open');
  });
}

function setupIncomeCustomPicker(selectId){
  const select=$(selectId);
  if(!select || select.dataset.incomePickerReady==='1')return;

  select.dataset.incomePickerReady='1';
  select.classList.add('income-native-select');

  const picker=document.createElement('div');
  picker.className='income-custom-picker';
  picker.dataset.incomePickerFor=selectId;

  const trigger=document.createElement('button');
  trigger.type='button';
  trigger.className='income-picker-trigger';
  trigger.innerHTML=`
    <span class="income-picker-icon">•</span>
    <span class="income-picker-copy">
      <strong class="income-picker-title"></strong>
      <small class="income-picker-desc"></small>
    </span>
    <span class="income-picker-chevron">⌄</span>
  `;

  const menu=document.createElement('div');
  menu.className='income-picker-menu';

  Array.from(select.options).forEach(option=>{
    const value=option.value;
    const label=option.textContent.trim();
    const [icon,desc]=incomePickerOptionMeta(selectId,value,label);

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='income-picker-option';
    btn.dataset.value=value;
    btn.innerHTML=`
      <span>${icon}</span>
      <span><strong>${esc(label)}</strong><small>${esc(desc)}</small></span>
    `;
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      syncIncomeCustomPicker(select);
      picker.classList.remove('is-open');
    });
    menu.appendChild(btn);
  });

  trigger.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    const willOpen=!picker.classList.contains('is-open');
    closeIncomeCustomPickers(picker);
    picker.classList.toggle('is-open',willOpen);
  });

  select.addEventListener('change',()=>syncIncomeCustomPicker(select));

  picker.appendChild(trigger);
  picker.appendChild(menu);
  select.insertAdjacentElement('afterend',picker);
  syncIncomeCustomPicker(select);
}

function setupIncomeCustomPickers(){
  ['fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(setupIncomeCustomPicker);
}

function refreshIncomeCustomPickers(){
  setupIncomeCustomPickers();
  ['fISCategory','fISType','fISRestriction','fISRestrictedCategory'].forEach(id=>syncIncomeCustomPicker($(id)));
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.income-custom-picker'))closeIncomeCustomPickers();
});
