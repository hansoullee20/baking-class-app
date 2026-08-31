(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'%':'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const today=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  const monthStart=s=>String(s).slice(0,7)+'-01';
  const monthEnd=s=>{const [y,m]=String(s).slice(0,7).split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`};
  const ctx=source=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source});
  const planKey=m=>`baking-ops-month-plan-${String(m).slice(0,7)}`;
  const targetKey=m=>`baking-ops-month-target-${String(m).slice(0,7)}`;
  let selectedCalendarDate='';
  let selectedCalendarIndex=0;

  function installStyle(){
    if(document.querySelector('link[data-unified-calendar]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='calendar-unified.css?v=20260831-r1';link.dataset.unifiedCalendar='1';document.head.appendChild(link);
  }
  function scheduleReady(){return typeof schedule!=='undefined'&&schedule&&Array.isArray(schedule.rows)}
  function recipeList(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
  function effectiveStatus(r){return B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정')}
  function normalizedCapacity(r){return Math.max(0,num(r?.capacity)||num(r?.people))}
  function defaultFee(){return num(schedule?.settings?.defaultFee)||60000}
  function defaultRent(date){return B.rent({date},schedule)}
  function sessionFromTime(time){return String(time||'').slice(0,2)<'13'?'오전반':'오후반'}
  function currentMonth(){try{return monthStart(cursor)}catch(e){return monthStart(today())}}
  function selectedDate(){try{return selected||selectedCalendarDate||currentMonth()}catch(e){return selectedCalendarDate||currentMonth()}}

  function loadDraft(month=currentMonth()){
    try{const x=JSON.parse(localStorage.getItem(planKey(month))||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}
  }
  function saveDraft(rows,month=currentMonth()){localStorage.setItem(planKey(month),JSON.stringify(rows))}
  function loadTarget(month=currentMonth()){
    try{return JSON.parse(localStorage.getItem(targetKey(month))||'{}')||{}}catch(e){return{}}
  }
  function saveTarget(target,month=currentMonth()){localStorage.setItem(targetKey(month),JSON.stringify(target))}
  function baselineRows(month=currentMonth()){
    if(!scheduleReady())return[];const a=monthStart(month),b=monthEnd(month);
    return schedule.rows.filter(r=>r?.date>=a&&r?.date<=b&&effectiveStatus(r)!=='취소');
  }
  function fullCapacityFinance(r){
    const cap=normalizedCapacity(r),raw={...r,people:cap,revenue:null,status:'예정'};
    return B.classFinancials(raw,ctx('schedule'));
  }
  function summarizePlan(base,draft){
    const all=[...base,...draft],booked=base.reduce((s,r)=>s+num(r.people),0),bookedRevenue=base.reduce((s,r)=>s+B.revenue(r),0);
    let seats=0,planRevenue=0,profit=0,costable=0;
    all.forEach(r=>{const cap=normalizedCapacity(r),fee=num(r.fee)||defaultFee(),f=fullCapacityFinance(r);seats+=cap;planRevenue+=cap*fee;if(f.profit!=null){profit+=f.profit;costable++}});
    return{classes:all.length,seats,planRevenue,profit,costable,booked,bookedRevenue,baseClasses:base.length,draftClasses:draft.length};
  }
  function targetGap(summary,target){
    const gaps=[];
    if(num(target.classes)>summary.classes)gaps.push(`수업 +${num(target.classes)-summary.classes}`);
    if(num(target.seats)>summary.seats)gaps.push(`좌석 +${num(target.seats)-summary.seats}`);
    if(num(target.revenue)>summary.planRevenue)gaps.push(`매출 +${won(num(target.revenue)-summary.planRevenue)}`);
    return gaps.length?gaps.join(' · '):'설정된 목표 기준 충족';
  }
  function stat(label,value,sub,tone=''){return `<div class="planner-stat ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub||'')}</small></div>`}
  function targetInput(id,label,value,sub){return `<label class="unified-target"><span>${esc(label)}</span><input id="${id}" type="number" min="0" value="${value||''}" placeholder="목표 입력"><small>${esc(sub)}</small></label>`}

  function ensureUnifiedSurface(){
    installStyle();
    document.querySelectorAll('[data-page="planner"]').forEach(x=>x.remove());
    const old=$('planner');if(old)old.remove();
    const page=$('calendar');if(!page)return;
    const head=page.querySelector('.section-head');
    if(head){const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='달력 · 월간 계획';if(p)p.textContent='실제 일정과 Draft 계획 · 참가자 명단 · 입금 상태를 한 화면에서 관리';
      if(!$('calendarPlanActions')){const actions=document.createElement('div');actions.id='calendarPlanActions';actions.className='calendar-plan-actions';actions.innerHTML='<button id="calendarResetDraft" class="btn secondary small" type="button">Draft 초기화</button><button id="calendarApplyDraft" class="btn small" type="button">Draft 일정 반영</button>';head.appendChild(actions)}
    }
    if(!$('calendarPlanHost')){const host=document.createElement('div');host.id='calendarPlanHost';host.className='calendar-plan-host';const layout=page.querySelector('.calendar-layout');if(layout)layout.before(host)}
  }

  function renderPlanPanel(){
    ensureUnifiedSurface();const host=$('calendarPlanHost');if(!host)return;
    if(!scheduleReady()){host.innerHTML='<div class="card empty">GitHub 데이터를 연결하면 월간 계획을 사용할 수 있습니다.</div>';return}
    const month=currentMonth(),base=baselineRows(month),draft=loadDraft(month),summary=summarizePlan(base,draft),baseline=summarizePlan(base,[]),target=loadTarget(month),monthNo=Number(month.slice(5,7)),gap=targetGap(summary,target),deltaRevenue=summary.planRevenue-baseline.planRevenue,deltaProfit=summary.profit-baseline.profit;
    host.innerHTML=`<div class="unified-plan-overview"><div class="unified-plan-version"><div><span>기준 일정</span><b>${monthNo}월 ${baseline.classes}회</b><small>${baseline.seats}석 · 정원매출 ${won(baseline.planRevenue)}</small></div><i>→</i><div><span>현재 Draft</span><b>${draft.length?`+${draft.length}회 계획`:'변경 없음'}</b><small>매출 ${deltaRevenue>=0?'+':''}${won(deltaRevenue)} · 이익 ${deltaProfit>=0?'+':''}${won(deltaProfit)}</small></div></div><div class="unified-targets">${targetInput('planTargetClasses','목표 수업',target.classes,`현재 ${summary.classes}회`)}${targetInput('planTargetSeats','목표 좌석',target.seats,`현재 ${summary.seats}석`)}${targetInput('planTargetRevenue','목표 매출',target.revenue,`현재 ${won(summary.planRevenue)}`)}${targetInput('planTargetProfit','목표 이익',target.profit,`계산가능 ${won(summary.profit)}`)}</div></div><div class="planner-stats unified-stats">${stat('계획 수업',`${summary.classes}회`,`기준 ${baseline.classes} · Draft +${draft.length}`)}${stat('계획 좌석',`${summary.seats}석`,`현재 예약 ${summary.booked}명`)}${stat('계획매출',won(summary.planRevenue),'정원 마감 가정')}${stat('계산가능 이익',won(summary.profit),`${summary.costable}/${summary.classes} 수업 원가 연결`,summary.costable<summary.classes?'warn':'good')}${stat('현재 예약매출',won(summary.bookedRevenue),'실제 예약 인원 기준')}${stat('목표 Gap',gap,'달력에서 Draft를 추가하며 조정',gap.includes('+')?'warn':'good')}</div>`;
  }

  function decorateDraftEvents(){
    const month=currentMonth(),draft=loadDraft(month);document.querySelectorAll('#calendarGrid .unified-draft-event').forEach(x=>x.remove());
    draft.forEach(r=>{const day=document.querySelector(`#calendarGrid .day[data-day="${CSS.escape(r.date)}"]`);if(!day)return;const el=document.createElement('div');el.className='event unified-draft-event';el.innerHTML=`<b>${esc(r.menu||'메뉴 미정')}</b><br>${esc(r.time||r.session||'')} · ${normalizedCapacity(r)}석 · DRAFT`;day.appendChild(el)});
  }

  function calendarRows(date){
    const rows=[];try{(schedule?.rows||[]).forEach((r,i)=>{if(r.date===date)rows.push({source:'schedule',index:i,r})});(history?.records||[]).forEach((r,i)=>{if(r.date===date)rows.push({source:'history',index:i,r})})}catch(e){}return rows.sort((a,b)=>String(a.r.time||a.r.session||'').localeCompare(String(b.r.time||b.r.session||'')));
  }
  function participantRows(r){return Array.isArray(r?.participants)?r.participants:[]}
  function menuOptions(selected=''){return '<option value="">메뉴 선택</option>'+recipeList().map(r=>`<option value="${esc(r.name)}" ${r.name===selected?'selected':''}>${esc(r.name)}</option>`).join('')}
  function recommendations(date){
    if(!scheduleReady())return[];const fee=defaultFee();
    return recipeList().map(r=>{const cs=B.costState(r);if(!cs.usable)return null;const raw={date,menu:r.name,people:4,capacity:4,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,status:'예정'},f=B.classFinancials(raw,ctx('schedule'));return f.profit==null?null:{name:r.name,profit:f.profit,confidence:f.confidence}}).filter(Boolean).sort((a,b)=>b.profit-a.profit).slice(0,3);
  }

  function renderCalendarClassDetail(date,index=0){
    ensureUnifiedSurface();const host=$('calendarClassDetail');if(!host)return;selectedCalendarDate=date||selectedDate();const rows=calendarRows(selectedCalendarDate),month=currentMonth(),draft=loadDraft(month),dateDraft=draft.filter(r=>r.date===selectedCalendarDate),recs=recommendations(selectedCalendarDate);selectedCalendarIndex=Math.min(index,Math.max(0,rows.length-1));
    let classHtml='';
    if(rows.length){const item=rows[selectedCalendarIndex],r=item.r,p=B.payment(r),list=participantRows(r),status=item.source==='history'?'완료':effectiveStatus(r),menu=r.menu||r.recipeCandidate||r.classTitle||'수업',missing=Math.max(0,num(r.people)-list.length);const roster=list.map((x,i)=>{const due=x.amountDue!=null?num(x.amountDue):num(r.fee),paid=x.amountPaid!=null?num(x.amountPaid):(x.paymentStatus==='입금완료'?due:0);return `<div class="attendee-row"><div><b>${esc(x.name||`참가자 ${i+1} · 이름 미입력`)}</b><small>예정 ${won(due)} · 입금 ${won(paid)}</small></div><span class="payment-pill ${x.paymentStatus==='입금완료'?'paid':'pending'}">${esc(x.paymentStatus||'미확인')}</span></div>`}).join('');classHtml=`<div class="calendar-detail-head"><div><span>${esc(selectedCalendarDate)} · ${esc(r.time||r.session||'')}</span><h3>${esc(menu)}</h3><small>${esc(status)} · ${num(r.people)}/${normalizedCapacity(r)}명</small></div>${rows.length>1?`<select id="calendarClassSelect">${rows.map((x,i)=>`<option value="${i}" ${i===selectedCalendarIndex?'selected':''}>${esc(x.r.time||x.r.session||'')} · ${esc(x.r.menu||x.r.recipeCandidate||x.r.classTitle||'수업')}</option>`).join('')}</select>`:''}</div><div class="calendar-payment-summary"><div><span>예상 수강료</span><b>${won(p.expected)}</b></div><div><span>확인 입금</span><b>${won(p.collected)}</b></div><div><span>미수금</span><b>${won(p.outstanding)}</b></div></div><div class="calendar-roster-head"><b>참가자 · 결제 상태</b><span>명단 ${list.length}/${num(r.people)}명</span></div><div class="attendee-list">${roster}${missing?`<div class="attendee-missing"><b>명단 미입력 ${missing}명</b><small>예약 인원은 있으나 이름/개별 결제 정보가 없습니다.</small></div>`:''}${!list.length&&!missing?'<div class="calendar-detail-empty compact">참가자 정보가 없습니다.</div>':''}</div>${item.source==='schedule'?`<button type="button" class="btn small calendar-edit-ops" data-ops-index="${item.index}">참가자 · 결제 편집</button>`:''}`}
    else classHtml='<div class="calendar-detail-empty compact"><b>실제 수업 없음</b><span>이 날짜에는 아직 등록된 수업이 없습니다.</span></div>';
    const draftList=dateDraft.length?dateDraft.map(r=>`<div class="unified-date-draft"><div><b>${esc(r.menu)}</b><small>${esc(r.time)} · ${normalizedCapacity(r)}석 · ${won(normalizedCapacity(r)*num(r.fee))}</small></div><button type="button" data-draft-remove="${esc(r.draft_id)}">삭제</button></div>`).join(''):'<p class="unified-no-draft">이 날짜의 Draft는 없습니다.</p>';
    host.innerHTML=`<section class="unified-day-plan"><div class="unified-day-plan-head"><div><span>DATE PLAN</span><h3>${esc(selectedCalendarDate)}</h3></div><small>실제 일정과 분리된 Draft</small></div><div class="unified-editor"><label>시간<input id="planTime" type="time" value="10:00"></label><label>정원<input id="planCapacity" type="number" min="1" value="4"></label><label class="span2">메뉴<select id="planMenu">${menuOptions()}</select></label><label class="span2">수강료/인<input id="planFee" type="number" min="0" value="${defaultFee()}"></label></div><button id="planAddDraft" class="btn small" type="button">이 날짜에 Draft 추가</button><div class="unified-recommend">${recs.map(x=>`<button type="button" data-plan-recipe="${esc(x.name)}"><b>${esc(x.name)}</b><small>${won(x.profit)} / 4명</small></button>`).join('')}</div><div class="unified-date-drafts">${draftList}</div></section><div class="unified-detail-divider"></div><section class="unified-class-detail">${classHtml}</section>`;
  }

  function addDraft(){
    const date=selectedCalendarDate||selectedDate(),menu=$('planMenu')?.value,time=$('planTime')?.value||'10:00',capacity=Math.max(1,num($('planCapacity')?.value)||4),fee=Math.max(0,num($('planFee')?.value)||defaultFee());if(!date||!menu)return;
    const month=monthStart(date),rows=loadDraft(month);rows.push({draft_id:`draft-${Date.now()}`,date,time,session:sessionFromTime(time),status:'예정',bookingStatus:'계획',classTitle:menu,menu,people:0,capacity,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,actualProfit:'',memo:'달력 월간 계획 Draft'});saveDraft(rows,month);renderPlanPanel();decorateDraftEvents();renderCalendarClassDetail(date,selectedCalendarIndex);
  }
  function removeDraft(id){const month=currentMonth();saveDraft(loadDraft(month).filter(r=>r.draft_id!==id),month);renderPlanPanel();decorateDraftEvents();renderCalendarClassDetail(selectedCalendarDate,selectedCalendarIndex)}
  function resetDraft(){localStorage.removeItem(planKey(currentMonth()));renderPlanPanel();decorateDraftEvents();if(selectedCalendarDate)renderCalendarClassDetail(selectedCalendarDate,0)}
  function applyDraft(){
    if(!scheduleReady())return;const month=currentMonth(),rows=loadDraft(month);if(!rows.length)return;if(!confirm(`${rows.length}개 Draft 수업을 실제 일정에 추가할까요?`))return;
    rows.forEach(r=>{const stamp=Date.now()+Math.floor(Math.random()*10000),id=`${r.date}-${r.time}-${r.menu}-${stamp}`,classId=`cls-${r.date.replaceAll('-','')}-${r.time.replace(':','')}-${stamp}`;schedule.rows.push({...r,id,class_id:classId,dow:B.dow(r.date),participants:[],memo:'달력 월간 계획 Draft에서 추가',draft_id:undefined})});localStorage.removeItem(planKey(month));try{mark('schedule')}catch(e){}try{renderAll()}catch(e){}renderPlanPanel();decorateDraftEvents();if(selectedCalendarDate)renderCalendarClassDetail(selectedCalendarDate,0);
  }
  function updateTarget(){const target={classes:num($('planTargetClasses')?.value)||null,seats:num($('planTargetSeats')?.value)||null,revenue:num($('planTargetRevenue')?.value)||null,profit:num($('planTargetProfit')?.value)||null};saveTarget(target);renderPlanPanel()}
  function normalizePastStatuses(){if(!scheduleReady())return;for(const r of schedule.rows){if(r.status!=='취소'&&effectiveStatus(r)==='완료')r.status='완료'}}
  function refreshUnified(){ensureUnifiedSurface();renderPlanPanel();decorateDraftEvents();const d=selectedCalendarDate||selectedDate();if(d)renderCalendarClassDetail(d,selectedCalendarIndex)}

  document.addEventListener('click',e=>{
    const day=e.target.closest('#calendarGrid .day');if(day){selectedCalendarDate=day.dataset.day;selectedCalendarIndex=0;setTimeout(()=>renderCalendarClassDetail(selectedCalendarDate,0),30)}
    const rec=e.target.closest('[data-plan-recipe]');if(rec){const sel=$('planMenu');if(sel)sel.value=rec.dataset.planRecipe}
    const remove=e.target.closest('[data-draft-remove]');if(remove){removeDraft(remove.dataset.draftRemove);return}
    if(e.target.id==='planAddDraft')addDraft();
    if(e.target.id==='calendarResetDraft')resetDraft();
    if(e.target.id==='calendarApplyDraft')applyDraft();
  },true);
  document.addEventListener('change',e=>{
    if(e.target.closest('#planTargetClasses,#planTargetSeats,#planTargetRevenue,#planTargetProfit'))updateTarget();
    if(e.target.id==='calendarClassSelect')renderCalendarClassDetail(selectedCalendarDate,num(e.target.value));
  },true);

  try{const base=renderCalendar;renderCalendar=function(...args){const x=base.apply(this,args);setTimeout(()=>{renderPlanPanel();decorateDraftEvents();const d=selectedCalendarDate||selectedDate();if(d)renderCalendarClassDetail(d,selectedCalendarIndex)},20);return x}}catch(e){}
  try{const base=connect;connect=async function(...args){const result=await base.apply(this,args);normalizePastStatuses();setTimeout(refreshUnified,30);return result}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){normalizePastStatuses();const result=base.apply(this,args);setTimeout(refreshUnified,30);return result}}catch(e){}

  ensureUnifiedSurface();normalizePastStatuses();setTimeout(refreshUnified,500);
})();