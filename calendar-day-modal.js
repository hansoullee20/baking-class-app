(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const todayISO=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  let activeDate='';

  function scheduleRows(date){
    const rows=[];try{(schedule?.rows||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'schedule',index:i,r})})}catch(e){}
    return rows.sort((a,b)=>String(a.r.time||a.r.session||'').localeCompare(String(b.r.time||b.r.session||'')));
  }
  function historyRows(date){
    const rows=[];try{(history?.records||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'history',index:i,r})})}catch(e){}
    return rows.sort((a,b)=>String(a.r.time||a.r.session||'').localeCompare(String(b.r.time||b.r.session||'')));
  }
  function menuOptions(sel=''){
    const list=typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[];
    return '<option value="">메뉴 선택</option>'+list.map(r=>`<option value="${esc(r.name)}" ${r.name===sel?'selected':''}>${esc(r.name)}</option>`).join('');
  }
  function sessionFromTime(v){return Number(String(v||'10:00').slice(0,2))<13?'오전반':'오후반'}
  function defaultFee(){return num(schedule?.settings?.defaultFee)||60000}
  function defaultRent(date){return B.rent({date},schedule)}
  function capacityOf(r){return Math.max(0,num(r?.capacity)||num(r?.people))}

  function ensure(){
    if($('dayOpsModal'))return;
    const modal=document.createElement('div');modal.id='dayOpsModal';modal.className='day-ops-modal';modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="day-ops-backdrop" data-day-close></div><div class="day-ops-dialog" role="dialog" aria-modal="true"><header><div><span>CALENDAR · DAY OPERATIONS</span><h2 id="dayOpsTitle"></h2><p id="dayOpsSub"></p></div><button type="button" data-day-close>×</button></header><div id="dayOpsBody"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',handleClick);
    modal.addEventListener('change',handleChange);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
  }
  function open(date){
    ensure();activeDate=date;render();const m=$('dayOpsModal');m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('day-ops-open');
  }
  function close(){const m=$('dayOpsModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('day-ops-open')}

  function statusSeats(r){
    const cap=capacityOf(r),people=Math.min(cap,num(r.people)),participants=Array.isArray(r.participants)?r.participants:[];
    let paid=Math.min(people,participants.filter(p=>p?.paymentStatus==='입금완료'&&num(p?.amountPaid)>=num(p?.amountDue??r.fee)).length);
    const pending=Math.max(0,people-paid),open=Math.max(0,cap-people);
    return `<div class="day-seat-row">${Array.from({length:paid},()=>'<i class="paid"></i>').join('')}${Array.from({length:pending},()=>'<i class="full"></i>').join('')}${Array.from({length:open},()=>'<i class="open"></i>').join('')}</div>`;
  }
  function classCard(item){
    const r=item.r,status=B.effectiveStatus?B.effectiveStatus(r):(r.status||'예정'),p=B.payment(r);
    return `<article class="day-class-card"><div class="day-class-main"><div><span>${esc(r.time||r.session||'시간 미정')} · ${esc(status)}</span><h3>${esc(r.menu||r.classTitle||r.recipeCandidate||'메뉴 미정')}</h3>${statusSeats(r)}</div><div class="day-class-meta"><b>${num(r.people)}/${capacityOf(r)}명</b><small>입금 ${won(p.collected)} · 미수 ${won(p.outstanding)}</small></div></div>${item.source==='schedule'?`<button type="button" data-open-class="${item.index}">수업 전체 관리</button>`:'<div class="day-history-note">완료 기록 · 읽기 전용</div>'}</article>`;
  }
  function render(){
    const body=$('dayOpsBody');if(!body)return;const live=scheduleRows(activeDate),past=historyRows(activeDate),canCreate=activeDate>=todayISO();
    $('dayOpsTitle').textContent=activeDate;
    $('dayOpsSub').textContent=canCreate?'수업 추가 · 수정 · 삭제 · 참가자 · 입금 관리':'과거 수업 기록 확인';
    const classes=[...live,...past];
    body.innerHTML=`<section class="day-ops-section"><div class="day-ops-section-head"><div><h3>이 날짜의 수업</h3><p>${classes.length?`${classes.length}개 수업`:'등록된 수업 없음'}</p></div>${canCreate?'<button type="button" class="btn small" id="dayAddToggle">+ 새 수업</button>':''}</div><div class="day-class-list">${classes.length?classes.map(classCard).join(''):'<div class="day-empty">아직 등록된 수업이 없습니다.</div>'}</div></section>${canCreate?`<section id="dayCreateBox" class="day-create-box" hidden><div class="day-create-grid"><label>시간<input id="dayNewTime" type="time" value="10:00"></label><label>정원<input id="dayNewCapacity" type="number" min="1" value="4"></label><label class="span2">메뉴<select id="dayNewMenu">${menuOptions()}</select></label><label>수강생<input id="dayNewPeople" type="number" min="0" value="0"></label><label>수강료/인<input id="dayNewFee" type="number" min="0" value="${defaultFee()}"></label></div><div class="day-create-actions"><button type="button" class="btn secondary" id="dayCancelCreate">취소</button><button type="button" class="btn" id="dayCreateClass">수업 만들기</button></div></section>`:''}`;
  }
  function createClass(){
    if(activeDate<todayISO())return;const menu=$('dayNewMenu')?.value;if(!menu)return;const time=$('dayNewTime')?.value||'10:00',capacity=Math.max(1,num($('dayNewCapacity')?.value)||4),people=Math.max(0,Math.min(capacity,num($('dayNewPeople')?.value))),fee=Math.max(0,num($('dayNewFee')?.value)||defaultFee()),stamp=Date.now();
    schedule.rows.push({id:`${activeDate}-${time}-${menu}-${stamp}`,class_id:`cls-${activeDate.replaceAll('-','')}-${time.replace(':','')}-${stamp}`,date:activeDate,dow:B.dow(activeDate),time,session:sessionFromTime(time),status:'예정',bookingStatus:'모집중',menu,classTitle:menu,people,capacity,fee,batchCount:1,rent:defaultRent(activeDate),packing:0,other:0,actualProfit:'',participants:[],memo:'달력 날짜 팝업에서 추가'});
    try{mark('schedule')}catch(e){};try{renderAll()}catch(e){};render();
  }
  function openClass(index){
    const trigger=document.createElement('button');trigger.dataset.opsIndex=String(index);trigger.hidden=true;document.body.appendChild(trigger);trigger.click();trigger.remove();close();
  }
  function handleClick(e){
    if(e.target.closest('[data-day-close]')){close();return}
    const openBtn=e.target.closest('[data-open-class]');if(openBtn){openClass(Number(openBtn.dataset.openClass));return}
    if(e.target.id==='dayAddToggle'){const box=$('dayCreateBox');if(box)box.hidden=false}
    if(e.target.id==='dayCancelCreate'){const box=$('dayCreateBox');if(box)box.hidden=true}
    if(e.target.id==='dayCreateClass')createClass();
  }
  function handleChange(e){}

  function installCalendarControls(){
    const head=document.querySelector('#calendar .calendar-head');if(!head||$('calendarMonthPicker'))return;
    const picker=document.createElement('input');picker.id='calendarMonthPicker';picker.className='calendar-month-picker';picker.type='month';
    try{picker.value=String(cursor).slice(0,7)}catch(e){}
    picker.addEventListener('change',()=>{if(!picker.value)return;try{cursor=monthStart(picker.value+'-01');selected=null;renderCalendar();picker.value=String(cursor).slice(0,7)}catch(e){}});
    head.querySelector('.month')?.insertAdjacentElement('afterend',picker);
  }
  function installPlanningToggle(){
    const section=document.querySelector('#calendar .section-head');if(!section||$('calendarPlanningToggle'))return;
    const btn=document.createElement('button');btn.id='calendarPlanningToggle';btn.className='btn ghost small';btn.type='button';btn.textContent='계획 모드';
    btn.addEventListener('click',()=>{const page=$('calendar');if(!page)return;const on=page.classList.toggle('planning-open');btn.classList.toggle('active',on);btn.textContent=on?'계획 닫기':'계획 모드'});
    section.appendChild(btn);
  }
  function simplifyCalendarSurface(){
    installCalendarControls();installPlanningToggle();const right=$('calendarClassDetail');if(right)right.hidden=true;const detail=$('dayDetail');if(detail)detail.hidden=true;
    const layout=document.querySelector('#calendar .calendar-layout');if(layout)layout.classList.add('calendar-single-surface');
  }
  document.addEventListener('click',e=>{
    const day=e.target.closest('#calendarGrid .day[data-day]');if(!day)return;e.preventDefault();e.stopPropagation();open(day.dataset.day);
  },true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="calendar"],#prevMonth,#nextMonth,#todayMonth'))setTimeout(simplifyCalendarSurface,50)},true);
  try{const base=renderCalendar;renderCalendar=function(...args){const out=base.apply(this,args);setTimeout(simplifyCalendarSurface,35);return out}}catch(e){}
  ensure();simplifyCalendarSurface();
})();