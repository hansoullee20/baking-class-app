(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  const planKey=m=>`baking-ops-month-plan-${String(m).slice(0,7)}`;
  let dayDate='';
  let daySelection={kind:'new',index:null,id:null};

  function scheduleRows(){return typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[]}
  function historyRows(){return typeof history!=='undefined'&&Array.isArray(history?.records)?history.records:[]}
  function recipeRows(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
  function capacity(r){return Math.max(0,num(r?.capacity)||num(r?.people))}
  function status(r){return B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정')}
  function menu(r){return r?.menu||r?.recipeCandidate||r?.classTitle||'메뉴 미정'}
  function timeOf(r){if(/^\d{2}:\d{2}/.test(String(r?.time||'')))return String(r.time).slice(0,5);if(String(r?.session||'').includes('오후'))return'14:00';if(String(r?.session||'').includes('기타'))return'18:00';return'10:00'}
  function sessionFromTime(v){return Number(String(v||'10:00').slice(0,2))<13?'오전반':'오후반'}
  function defaultFee(){return num(schedule?.settings?.defaultFee)||60000}
  function defaultRent(date){return B.rent({date},schedule)}
  function ctx(){return{recipes:recipeRows(),schedule,source:'schedule'}}
  function menuOptions(sel=''){return '<option value="">메뉴 미정</option>'+recipeRows().map(r=>`<option value="${esc(r.name)}" ${r.name===sel?'selected':''}>${esc(r.name)}</option>`).join('')}
  function loadDraft(date=dayDate){try{const a=JSON.parse(localStorage.getItem(planKey(date))||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
  function saveDraft(rows,date=dayDate){localStorage.setItem(planKey(date),JSON.stringify(rows))}
  function dateItems(date){
    const items=[];
    scheduleRows().forEach((r,i)=>{if(r.date===date)items.push({kind:'schedule',index:i,r})});
    historyRows().forEach((r,i)=>{if(r.date===date)items.push({kind:'history',index:i,r})});
    loadDraft(date).forEach((r,i)=>{if(r.date===date)items.push({kind:'draft',index:i,id:r.draft_id,r})});
    return items.sort((a,b)=>timeOf(a.r).localeCompare(timeOf(b.r)));
  }
  function selectedItem(){
    if(daySelection.kind==='schedule')return scheduleRows()[daySelection.index]?{kind:'schedule',index:daySelection.index,r:scheduleRows()[daySelection.index]}:null;
    if(daySelection.kind==='history')return historyRows()[daySelection.index]?{kind:'history',index:daySelection.index,r:historyRows()[daySelection.index]}:null;
    if(daySelection.kind==='draft'){const rows=loadDraft(dayDate),i=rows.findIndex(x=>x.draft_id===daySelection.id);return i>=0?{kind:'draft',index:i,id:daySelection.id,r:rows[i]}:null}
    return null;
  }

  function normalizeParticipants(r){
    if(!Array.isArray(r.participants))r.participants=[];
    r.participants.forEach((p,i)=>{if(!p.id)p.id=`p-${Date.now()}-${i}`;if(p.name==null)p.name='';if(!p.paymentStatus)p.paymentStatus='미입금';if(p.amountDue==null)p.amountDue=num(r.fee);if(p.amountPaid==null)p.amountPaid=0;if(p.paidAt==null)p.paidAt='';if(p.memo==null)p.memo=''});
  }
  function due(p,r){return p.amountDue==null||p.amountDue===''?num(r.fee):num(p.amountDue)}
  function syncPaymentComplete(r){
    normalizeParticipants(r);const list=r.participants;
    const complete=list.length>=num(r.people)&&num(r.people)>0&&list.slice(0,num(r.people)).every(p=>p.paymentStatus==='입금완료'&&num(p.amountPaid)>=due(p,r));
    r.paymentComplete=complete;
    if(complete){r.paymentCompletedAt=r.paymentCompletedAt||today();r.paymentCompletedAmount=list.reduce((s,p)=>s+num(p.amountPaid),0)}else{r.paymentCompletedAt='';r.paymentCompletedAmount=0}
  }

  function ensureMonthControls(){
    const head=document.querySelector('#calendar .calendar-head');if(!head)return;
    if(!$('calendarMonthJump')){
      const input=document.createElement('input');input.id='calendarMonthJump';input.type='month';input.className='calendar-month-jump';
      const title=$('monthTitle');title?.insertAdjacentElement('afterend',input);
      input.addEventListener('change',()=>{if(!input.value)return;try{cursor=input.value+'-01';selected=null}catch(e){};try{renderCalendar()}catch(e){}});
    }
    try{$('calendarMonthJump').value=String(cursor).slice(0,7)}catch(e){}
    const page=$('calendar'),section=page?.querySelector('.section-head');
    if(section&&!$('calendarPlanModeBtn')){const b=document.createElement('button');b.id='calendarPlanModeBtn';b.type='button';b.className='btn ghost small';b.textContent='계획 모드';section.appendChild(b);b.addEventListener('click',()=>{page.classList.toggle('plan-mode');b.textContent=page.classList.contains('plan-mode')?'계획 닫기':'계획 모드'})}
    const h=section?.querySelector('h2'),p=section?.querySelector('p');if(h)h.textContent='달력';if(p)p.textContent='과거 · 현재 · 미래의 모든 수업을 한 곳에서 확인하고 관리';
  }

  function ensureDayModal(){
    if($('dayManager'))return;
    const el=document.createElement('div');el.id='dayManager';el.className='day-manager';el.setAttribute('aria-hidden','true');
    el.innerHTML=`<div class="day-manager-backdrop" data-day-close></div><div class="day-manager-dialog" role="dialog" aria-modal="true"><div class="day-manager-head"><div><span>CALENDAR · DAY MANAGER</span><h2 id="dayManagerTitle"></h2></div><button class="day-manager-close" type="button" data-day-close>×</button></div><div class="day-manager-body"><aside class="day-manager-list"><div class="day-manager-list-head"><b>이 날의 수업</b><button id="dayNewClass" class="btn ghost small" type="button">+ 추가</button></div><div id="dayManagerItems"></div></aside><main id="dayManagerMain" class="day-manager-main"></main></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click',handleModalClick);
    el.addEventListener('change',handleModalChange);
    el.addEventListener('input',handleModalInput);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el.classList.contains('open'))closeDay()});
  }
  function openDay(date){
    ensureDayModal();dayDate=date;try{selected=date}catch(e){}
    const items=dateItems(date),first=items.find(x=>x.kind==='schedule')||items.find(x=>x.kind==='draft')||items.find(x=>x.kind==='history');
    daySelection=first?{kind:first.kind,index:first.index,id:first.id||null}:{kind:'new',index:null,id:null};
    renderDay();const modal=$('dayManager');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('ops-modal-open');
  }
  function closeDay(){const m=$('dayManager');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}document.body.classList.remove('ops-modal-open')}
  function itemKey(x){return x.kind==='draft'?x.id:String(x.index)}
  function renderDay(){
    ensureDayModal();$('dayManagerTitle').textContent=dayDate;
    const items=dateItems(dayDate);$('dayManagerItems').innerHTML=items.map(x=>`<button class="day-manager-item ${x.kind} ${daySelection.kind===x.kind&&itemKey(x)===(x.kind==='draft'?daySelection.id:String(daySelection.index))?'active':''}" type="button" data-day-kind="${x.kind}" data-day-index="${x.index}" ${x.id?`data-day-id="${esc(x.id)}"`:''}><b>${esc(menu(x.r))}</b><small>${esc(timeOf(x.r))} · ${x.kind==='draft'?'Draft':x.kind==='history'?'완료 기록':esc(status(x.r))} · ${num(x.r.people)}/${capacity(x.r)||'—'}명</small></button>`).join('')+`<button class="day-manager-item ${daySelection.kind==='new'?'active':''}" type="button" data-day-kind="new"><b>+ 새 수업</b><small>실제 일정 또는 Draft 추가</small></button>`;
    renderDayMain();
  }
  function renderDayMain(){
    const host=$('dayManagerMain'),item=selectedItem();if(!host)return;
    if(daySelection.kind==='new'||!item){host.innerHTML=renderNew();return}
    if(item.kind==='history'){host.innerHTML=renderHistory(item.r);return}
    if(item.kind==='draft'){host.innerHTML=renderDraft(item.r);return}
    host.innerHTML=renderScheduleClass(item.r,item.index);
  }
  function renderNew(){
    return `<section class="day-section"><div class="day-section-head"><div><h3>수업 추가</h3><p>${esc(dayDate)}에 실제 수업 또는 Draft를 추가합니다.</p></div></div><div class="day-form"><label>구분<select id="newDayMode"><option value="schedule">실제 일정</option><option value="draft">Draft 계획</option></select></label><label>시간<input id="newDayTime" type="time" value="10:00"></label><label>수강생<input id="newDayPeople" type="number" min="0" value="0"></label><label>정원<input id="newDayCapacity" type="number" min="1" value="4"></label><label class="span2">메뉴<select id="newDayMenu">${menuOptions()}</select></label><label>수강료/인<input id="newDayFee" type="number" min="0" value="${defaultFee()}"></label><label>대관료<input id="newDayRent" type="number" min="0" value="${defaultRent(dayDate)}"></label><label class="span4">메모<textarea id="newDayMemo" placeholder="메모"></textarea></label></div><div class="day-actions"><button id="createDayClass" class="btn" type="button">추가</button></div></section>`;
  }
  function renderScheduleClass(r,index){
    normalizeParticipants(r);const p=B.payment(r),eff=status(r);
    const roster=r.participants.map((x,i)=>`<div class="day-person"><label>이름<input data-person="name" data-pi="${i}" value="${esc(x.name)}" placeholder="이름"></label><label>상태<select data-person="paymentStatus" data-pi="${i}"><option ${x.paymentStatus==='미입금'?'selected':''}>미입금</option><option ${x.paymentStatus==='부분입금'?'selected':''}>부분입금</option><option ${x.paymentStatus==='입금완료'?'selected':''}>입금완료</option></select></label><label>예정액<input data-person="amountDue" data-pi="${i}" type="number" value="${due(x,r)}"></label><label>입금액<input data-person="amountPaid" data-pi="${i}" type="number" value="${num(x.amountPaid)}"></label><label>입금일<input data-person="paidAt" data-pi="${i}" type="date" value="${esc(x.paidAt||'')}"></label><button type="button" data-person-delete="${i}">삭제</button></div>`).join('');
    return `<section class="day-section"><div class="day-section-head"><div><h3>${esc(menu(r))}</h3><p>${esc(eff)} · 이 화면에서 수업 자체를 수정합니다.</p></div></div><div class="day-form"><label>날짜<input data-class="date" type="date" value="${esc(r.date||'')}"></label><label>시간<input data-class="time" type="time" value="${esc(timeOf(r))}"></label><label>상태<select data-class="status"><option ${r.status==='예정'?'selected':''}>예정</option><option ${r.status==='확정'?'selected':''}>확정</option><option ${r.status==='완료'?'selected':''}>완료</option><option ${r.status==='취소'?'selected':''}>취소</option></select></label><label>수강생<input data-class="people" type="number" min="0" value="${num(r.people)}"></label><label class="span2">메뉴<select data-class="menu">${menuOptions(r.menu||r.classTitle||'')}</select></label><label>정원<input data-class="capacity" type="number" min="0" value="${capacity(r)}"></label><label>수강료/인<input data-class="fee" type="number" min="0" value="${num(r.fee)}"></label><label>대관료<input data-class="rent" type="number" min="0" value="${num(r.rent)}"></label><label>배합수<input data-class="batchCount" type="number" min=".25" step=".25" value="${num(r.batchCount)||1}"></label><label class="span4">메모<textarea data-class="memo">${esc(r.memo||'')}</textarea></label></div><div class="day-actions"><button id="fillDayRoster" class="btn ghost small" type="button">수강생 수만큼 참가자 만들기</button><button id="addDayPerson" class="btn secondary small" type="button">+ 참가자</button><button id="deleteDayClass" class="btn ghost small day-danger" type="button" data-delete-index="${index}">수업 삭제</button></div></section><section class="day-section"><div class="day-section-head"><div><h3>참가자 · 결제</h3><p>이 정보가 달력의 자리별 초록/빨강 원에 반영됩니다.</p></div></div><div class="day-pay-summary"><div><span>예정액</span><b>${won(p.expected)}</b></div><div><span>입금액</span><b>${won(p.collected)}</b></div><div><span>미수금</span><b>${won(p.outstanding)}</b></div></div><div class="day-roster">${roster||'<div class="day-manager-empty">등록된 참가자가 없습니다.</div>'}</div></section>`;
  }
  function renderHistory(r){const p=B.payment(r);return `<section class="day-section"><div class="day-section-head"><div><h3>${esc(menu(r))}</h3><p>과거 완료 기록 · history 데이터는 이 화면에서 읽기 전용입니다.</p></div></div><div class="day-readonly"><div class="day-readonly-row"><span>시간</span><b>${esc(timeOf(r))}</b></div><div class="day-readonly-row"><span>수강생</span><b>${num(r.people)}명</b></div><div class="day-readonly-row"><span>예상 수강료</span><b>${won(p.expected)}</b></div><div class="day-readonly-row"><span>확인 입금</span><b>${won(p.collected)}</b></div><div class="day-readonly-row"><span>메모</span><b>${esc(r.memo||'—')}</b></div></div></section>`}
  function renderDraft(r){return `<section class="day-section"><div class="day-section-head"><div><h3>${esc(menu(r))}</h3><p>Draft 계획 · 실제 일정과 분리되어 있습니다.</p></div></div><div class="day-form"><label>날짜<input data-draft="date" type="date" value="${esc(r.date||dayDate)}"></label><label>시간<input data-draft="time" type="time" value="${esc(timeOf(r))}"></label><label>수강생<input data-draft="people" type="number" min="0" value="${num(r.people)}"></label><label>정원<input data-draft="capacity" type="number" min="1" value="${capacity(r)||4}"></label><label class="span2">메뉴<select data-draft="menu">${menuOptions(r.menu||'')}</select></label><label>수강료/인<input data-draft="fee" type="number" min="0" value="${num(r.fee)||defaultFee()}"></label><label>대관료<input data-draft="rent" type="number" min="0" value="${num(r.rent)||defaultRent(r.date||dayDate)}"></label><label class="span4">메모<textarea data-draft="memo">${esc(r.memo||'')}</textarea></label></div><div class="day-actions"><button id="applyOneDraft" class="btn small" type="button">실제 일정으로 반영</button><button id="deleteOneDraft" class="btn ghost small day-danger" type="button">Draft 삭제</button></div></section>`}

  function markAndRefresh(keep=true){try{mark('schedule')}catch(e){};try{renderAll()}catch(e){};setTimeout(()=>{ensureMonthControls();if(keep&&$('dayManager')?.classList.contains('open'))renderDay()},90)}
  function addParticipant(){const item=selectedItem();if(item?.kind!=='schedule')return;const r=item.r;normalizeParticipants(r);r.participants.push({id:`p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});syncPaymentComplete(r);markAndRefresh()}
  function fillRoster(){const item=selectedItem();if(item?.kind!=='schedule')return;const r=item.r;normalizeParticipants(r);while(r.participants.length<num(r.people))r.participants.push({id:`p-${Date.now()}-${r.participants.length}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});syncPaymentComplete(r);markAndRefresh()}
  function createClass(){
    const mode=$('newDayMode')?.value||'schedule',time=$('newDayTime')?.value||'10:00',menuName=$('newDayMenu')?.value||'',people=Math.max(0,num($('newDayPeople')?.value)),cap=Math.max(1,num($('newDayCapacity')?.value)||4),fee=Math.max(0,num($('newDayFee')?.value)||defaultFee()),rent=Math.max(0,num($('newDayRent')?.value)||defaultRent(dayDate)),memo=$('newDayMemo')?.value||'';if(!menuName)return;
    const base={date:dayDate,time,session:sessionFromTime(time),status:'예정',classTitle:menuName,menu:menuName,people,capacity:cap,fee,batchCount:1,rent,packing:0,other:0,actualProfit:'',memo};
    if(mode==='draft'){const rows=loadDraft(dayDate),draft={...base,draft_id:`draft-${Date.now()}`,bookingStatus:'계획'};rows.push(draft);saveDraft(rows,dayDate);daySelection={kind:'draft',id:draft.draft_id,index:rows.length-1};try{renderCalendar()}catch(e){};setTimeout(renderDay,80);return}
    const stamp=Date.now(),row={...base,id:`${dayDate}-${time}-${menuName}-${stamp}`,class_id:`cls-${dayDate.replaceAll('-','')}-${time.replace(':','')}-${stamp}`,dow:B.dow(dayDate),participants:[]};schedule.rows.push(row);daySelection={kind:'schedule',index:schedule.rows.length-1,id:null};markAndRefresh();
  }
  function applyDraft(){const item=selectedItem();if(item?.kind!=='draft')return;const r=item.r,stamp=Date.now();schedule.rows.push({...r,id:`${r.date}-${timeOf(r)}-${menu(r)}-${stamp}`,class_id:`cls-${String(r.date).replaceAll('-','')}-${timeOf(r).replace(':','')}-${stamp}`,dow:B.dow(r.date),participants:[],draft_id:undefined,bookingStatus:undefined});const rows=loadDraft(dayDate).filter(x=>x.draft_id!==item.id);saveDraft(rows,dayDate);daySelection={kind:'schedule',index:schedule.rows.length-1,id:null};markAndRefresh()}
  function deleteDraft(){const item=selectedItem();if(item?.kind!=='draft')return;saveDraft(loadDraft(dayDate).filter(x=>x.draft_id!==item.id),dayDate);daySelection={kind:'new',index:null,id:null};try{renderCalendar()}catch(e){};setTimeout(renderDay,80)}

  function handleModalClick(e){
    if(e.target.closest('[data-day-close]')){closeDay();return}
    const pick=e.target.closest('[data-day-kind]');if(pick){const kind=pick.dataset.dayKind;daySelection={kind,index:pick.dataset.dayIndex==null?null:Number(pick.dataset.dayIndex),id:pick.dataset.dayId||null};renderDay();return}
    if(e.target.id==='dayNewClass'){daySelection={kind:'new',index:null,id:null};renderDay();return}
    if(e.target.id==='createDayClass'){createClass();return}
    if(e.target.id==='addDayPerson'){addParticipant();return}
    if(e.target.id==='fillDayRoster'){fillRoster();return}
    if(e.target.id==='applyOneDraft'){applyDraft();return}
    if(e.target.id==='deleteOneDraft'){deleteDraft();return}
    const delPerson=e.target.closest('[data-person-delete]');if(delPerson){const item=selectedItem();if(item?.kind!=='schedule')return;normalizeParticipants(item.r);item.r.participants.splice(Number(delPerson.dataset.personDelete),1);syncPaymentComplete(item.r);markAndRefresh();return}
    const del=e.target.closest('[data-delete-index]');if(del){const i=Number(del.dataset.deleteIndex),r=scheduleRows()[i];if(!r||!confirm(`${menu(r)} 수업을 삭제할까요?`))return;schedule.rows.splice(i,1);daySelection={kind:'new',index:null,id:null};markAndRefresh();return}
  }
  function handleModalChange(e){
    const cls=e.target.closest('[data-class]');if(cls){const item=selectedItem();if(item?.kind!=='schedule')return;const r=item.r,k=cls.dataset.class;let v=cls.value;if(['people','capacity','fee','rent','batchCount'].includes(k))v=v===''?'':Number(v);if(k==='time'){r.time=v;r.session=sessionFromTime(v)}else{r[k]=v;if(k==='menu')r.classTitle=v;if(k==='date'){r.dow=B.dow(v);dayDate=v}}syncPaymentComplete(r);markAndRefresh();return}
    const pf=e.target.closest('[data-person]');if(pf){const item=selectedItem();if(item?.kind!=='schedule')return;const r=item.r;normalizeParticipants(r);const p=r.participants[Number(pf.dataset.pi)];if(!p)return;const k=pf.dataset.person;let v=pf.value;if(['amountDue','amountPaid'].includes(k))v=v===''?'':Number(v);p[k]=v;if(k==='paymentStatus'){if(v==='입금완료'){p.amountPaid=due(p,r);p.paidAt=p.paidAt||today()}else if(v==='미입금'){p.amountPaid=0;p.paidAt=''}}if(k==='amountPaid'){const d=due(p,r),x=num(v);p.paymentStatus=x>=d&&d>0?'입금완료':x>0?'부분입금':'미입금';if(p.paymentStatus==='입금완료')p.paidAt=p.paidAt||today();if(p.paymentStatus==='미입금')p.paidAt=''}syncPaymentComplete(r);markAndRefresh();return}
    const df=e.target.closest('[data-draft]');if(df){const item=selectedItem();if(item?.kind!=='draft')return;const oldMonth=String(item.r.date||dayDate).slice(0,7),rows=loadDraft(item.r.date||dayDate),i=rows.findIndex(x=>x.draft_id===item.id);if(i<0)return;const r=rows[i],k=df.dataset.draft;let v=df.value;if(['people','capacity','fee','rent'].includes(k))v=v===''?'':Number(v);if(k==='time'){r.time=v;r.session=sessionFromTime(v)}else{r[k]=v;if(k==='menu')r.classTitle=v}if(k==='date'&&String(v).slice(0,7)!==oldMonth){rows.splice(i,1);localStorage.setItem(planKey(oldMonth),JSON.stringify(rows));const target=loadDraft(v);target.push(r);saveDraft(target,v);dayDate=v}else saveDraft(rows,r.date||dayDate);try{renderCalendar()}catch(err){};setTimeout(renderDay,80);return}
  }
  function handleModalInput(e){
    const cls=e.target.closest('textarea[data-class="memo"]');if(cls){const item=selectedItem();if(item?.kind==='schedule'){item.r.memo=cls.value;try{mark('schedule')}catch(err){}}return}
    const pf=e.target.closest('input[data-person="name"]');if(pf){const item=selectedItem();if(item?.kind!=='schedule')return;normalizeParticipants(item.r);const p=item.r.participants[Number(pf.dataset.pi)];if(p){p.name=pf.value;try{mark('schedule')}catch(err){}}return}
    const df=e.target.closest('textarea[data-draft="memo"]');if(df){const item=selectedItem();if(item?.kind!=='draft')return;const rows=loadDraft(dayDate),i=rows.findIndex(x=>x.draft_id===item.id);if(i>=0){rows[i].memo=df.value;saveDraft(rows,dayDate)}}
  }

  function futureRows(){const t=today();return scheduleRows().map((r,i)=>({r,i})).filter(x=>x.r.date>=t&&status(x.r)!=='취소'&&status(x.r)!=='완료').sort((a,b)=>a.r.date.localeCompare(b.r.date)||timeOf(a.r).localeCompare(timeOf(b.r)))}
  function dashboardSignals(){
    const rows=futureRows(),todayRows=scheduleRows().filter(r=>r.date===today()&&status(r)!=='취소'),recruit=rows.filter(x=>num(x.r.people)<capacity(x.r)),payment=rows.filter(x=>{const p=B.payment(x.r);return p.outstanding>0||p.missingRosterCount>0}),cost=rows.filter(x=>{const f=B.classFinancials(x.r,ctx());return !f.recipe||f.total==null});
    return{todayRows,rows,recruit,payment,cost};
  }
  function renderLeanDashboard(){
    const page=$('dashboard');if(!page)return;let host=$('leanDashboard');if(!host){host=document.createElement('div');host.id='leanDashboard';host.className='lean-dashboard';page.querySelector('.hero')?.after(host)}const s=dashboardSignals(),next=s.rows.slice(0,4),actions=[];
    s.payment.slice(0,3).forEach(x=>actions.push({date:x.r.date,title:`${menu(x.r)} 결제 확인`,detail:`참가자 결제 상태 확인`,kind:'calendar'}));
    s.recruit.slice(0,3).forEach(x=>actions.push({date:x.r.date,title:`${menu(x.r)} 모집`,detail:`${Math.max(0,capacity(x.r)-num(x.r.people))}자리 남음`,kind:'calendar'}));
    s.cost.slice(0,3).forEach(x=>actions.push({date:x.r.date,title:`${menu(x.r)} 원가 확인`,detail:'레시피/원가 연결 확인',kind:'recipes'}));
    actions.sort((a,b)=>a.date.localeCompare(b.date));
    host.innerHTML=`<div class="lean-signals"><button class="lean-signal" data-dash-date="${today()}"><span>오늘</span><b>${s.todayRows.length}건</b><small>오늘 수업 확인</small></button><button class="lean-signal attention" data-dash-page="calendar"><span>모집 필요</span><b>${s.recruit.length}건</b><small>남은 자리가 있는 미래 수업</small></button><button class="lean-signal attention" data-dash-page="calendar"><span>결제 확인</span><b>${s.payment.length}건</b><small>미수금 또는 명단 확인 필요</small></button><button class="lean-signal ${s.cost.length?'bad':''}" data-dash-page="recipes"><span>원가 확인</span><b>${s.cost.length}건</b><small>레시피/원가 연결 필요</small></button></div><div class="lean-dashboard-grid"><section class="lean-panel"><div class="lean-panel-head"><div><h3>지금 할 일</h3><p>운영 이슈만 표시합니다. 금액 분석은 원가 · 수익에서 확인합니다.</p></div></div>${actions.length?actions.slice(0,6).map(x=>`<button class="lean-action" ${x.kind==='calendar'?`data-dash-date="${x.date}"`:`data-dash-page="${x.kind}"`}><time>${esc(x.date.slice(5).replace('-','.'))}</time><div><b>${esc(x.title)}</b><small>${esc(x.detail)}</small></div><em>열기</em></button>`).join(''):'<div class="lean-empty">지금 처리할 운영 이슈가 없습니다.</div>'}</section><section class="lean-panel"><div class="lean-panel-head"><div><h3>가까운 수업</h3><p>상세 관리는 달력에서 합니다.</p></div></div>${next.length?next.map(x=>`<button class="lean-next" data-dash-date="${x.r.date}"><time>${esc(x.r.date.slice(5).replace('-','.'))}<br>${esc(timeOf(x.r))}</time><div><b>${esc(menu(x.r))}</b><small>${num(x.r.people)}/${capacity(x.r)}명</small></div></button>`).join(''):'<div class="lean-empty">예정 수업이 없습니다.</div>'}</section></div>`;
    const h=page.querySelector('.hero h2'),p=page.querySelector('.hero p');if(h)h.textContent='오늘 무엇을 처리해야 하나';if(p)p.textContent='운영 신호만 보고, 상세 일정은 달력에서, 금액은 원가 · 수익에서 관리합니다.';
  }
  function goPage(name){document.querySelector(`[data-page="${name}"]`)?.click()}
  function goCalendarDate(date){try{cursor=String(date).slice(0,7)+'-01';selected=date}catch(e){};goPage('calendar');try{renderCalendar()}catch(e){};setTimeout(()=>openDay(date),100)}

  document.addEventListener('click',e=>{
    const day=e.target.closest('#calendarGrid .day[data-day]');if(day){e.preventDefault();openDay(day.dataset.day);return}
    const dd=e.target.closest('[data-dash-date]');if(dd){goCalendarDate(dd.dataset.dashDate);return}
    const dp=e.target.closest('[data-dash-page]');if(dp){goPage(dp.dataset.dashPage);return}
  },true);

  function cleanSurface(){ensureMonthControls();renderLeanDashboard();if($('recipeDecision'))$('recipeDecision').hidden=true}
  try{const base=renderCalendar;renderCalendar=function(...args){const out=base.apply(this,args);setTimeout(ensureMonthControls,60);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(cleanSurface,90);return out}}catch(e){}
  try{const base=connect;connect=async function(...args){const out=await base.apply(this,args);setTimeout(cleanSurface,100);return out}}catch(e){}
  ensureDayModal();setTimeout(cleanSurface,700);
})();
