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
  const moveMonth=(s,delta)=>{let [y,m]=String(s).slice(0,7).split('-').map(Number);m+=delta;while(m>12){y++;m-=12}while(m<1){y--;m+=12}return `${y}-${String(m).padStart(2,'0')}-01`};
  const monthEnd=s=>{const [y,m]=String(s).slice(0,7).split('-').map(Number);return `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`};
  const ctx=source=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source});
  const planKey=m=>`baking-ops-month-plan-${String(m).slice(0,7)}`;
  const targetKey=m=>`baking-ops-month-target-${String(m).slice(0,7)}`;
  let plannerCursor=moveMonth(monthStart(today()),1);
  let selectedPlanDate=plannerCursor;
  let selectedCalendarDate='';
  let selectedCalendarIndex=0;

  function scheduleReady(){return typeof schedule!=='undefined'&&schedule&&Array.isArray(schedule.rows)}
  function recipeList(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
  function effectiveStatus(r){return B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정')}
  function normalizedCapacity(r){return Math.max(0,num(r?.capacity)||num(r?.people))}
  function defaultFee(){return num(schedule?.settings?.defaultFee)||60000}
  function defaultRent(date){return B.rent({date},schedule)}
  function sessionFromTime(time){return String(time||'').slice(0,2)<'13'?'오전반':'오후반'}
  function localDateFromUTC(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}
  function addDays(s,n){const [y,m,d]=String(s).split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));x.setUTCDate(x.getUTCDate()+n);return localDateFromUTC(x)}
  function dowIndex(s){const [y,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(y,m-1,d)).getUTCDay()}

  function loadDraft(){
    try{const x=JSON.parse(localStorage.getItem(planKey(plannerCursor))||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}
  }
  function saveDraft(rows){localStorage.setItem(planKey(plannerCursor),JSON.stringify(rows))}
  function loadTarget(){
    try{return JSON.parse(localStorage.getItem(targetKey(plannerCursor))||'{}')||{}}catch(e){return{}}
  }
  function saveTarget(target){localStorage.setItem(targetKey(plannerCursor),JSON.stringify(target))}
  function baselineRows(){
    if(!scheduleReady())return[];const a=monthStart(plannerCursor),b=monthEnd(plannerCursor);
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
  function planTargetGap(summary,target){
    const gaps=[];
    if(num(target.classes)>summary.classes)gaps.push(`수업 +${num(target.classes)-summary.classes}`);
    if(num(target.seats)>summary.seats)gaps.push(`좌석 +${num(target.seats)-summary.seats}`);
    if(num(target.revenue)>summary.planRevenue)gaps.push(`매출 +${won(num(target.revenue)-summary.planRevenue)}`);
    return gaps.length?gaps.join(' · '):'설정된 목표 기준 충족';
  }
  function targetInput(id,label,value,placeholder,sub){return `<div class="planner-target"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" value="${value||''}" placeholder="${placeholder}"><small>${sub}</small></div>`}
  function stat(label,value,sub,tone=''){return `<div class="planner-stat ${tone}"><span>${label}</span><b>${value}</b><small>${sub}</small></div>`}

  function monthCalendar(base,draft){
    const start=monthStart(plannerCursor),firstDow=dowIndex(start),gridStart=addDays(start,-firstDow),key=start.slice(0,7),by={};
    base.forEach((r,i)=>{(by[r.date]??=[]).push({type:'base',r,i})});draft.forEach((r,i)=>{(by[r.date]??=[]).push({type:'draft',r,i})});
    let html='';
    for(let i=0;i<42;i++){
      const ds=addDays(gridStart,i),items=by[ds]||[],out=!ds.startsWith(key),selected=ds===selectedPlanDate;
      html+=`<button type="button" class="planner-day${out?' out':''}${selected?' selected':''}" data-plan-date="${ds}"><span class="planner-daynum">${Number(ds.slice(8))}</span>${items.slice(0,3).map(x=>{const cap=normalizedCapacity(x.r),label=x.type==='draft'?'DRAFT':(effectiveStatus(x.r)==='완료'?'완료':(x.r.bookingStatus||x.r.status||'일정'));return `<div class="planner-event ${x.type}"><b>${esc(x.r.menu||x.r.classTitle||'메뉴 미정')}</b><small>${esc(x.r.time||x.r.session||'')} · ${num(x.r.people)}/${cap} · ${esc(label)}</small></div>`}).join('')}${items.length>3?`<div class="planner-more">+${items.length-3}</div>`:''}${!items.length&&!out?'<span class="planner-empty-slot">+ 계획</span>':''}</button>`;
    }
    return html;
  }

  function recommendations(){
    if(!scheduleReady())return[];const fee=defaultFee(),date=selectedPlanDate&&selectedPlanDate.startsWith(plannerCursor.slice(0,7))?selectedPlanDate:plannerCursor;
    return recipeList().map(r=>{const cs=B.costState(r);if(!cs.usable)return null;const raw={date,menu:r.name,people:4,capacity:4,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,status:'예정'},f=B.classFinancials(raw,ctx('schedule'));return f.profit==null?null:{recipe:r,profit:f.profit,confidence:f.confidence}}).filter(Boolean).sort((a,b)=>b.profit-a.profit).slice(0,3);
  }

  function renderPlanner(){
    const host=$('plannerHost');if(!host)return;if(!scheduleReady()){host.innerHTML='<div class="card empty">GitHub 데이터를 연결하면 다음 달 계획을 만들 수 있습니다.</div>';return}
    const base=baselineRows(),draft=loadDraft(),summary=summarizePlan(base,draft),target=loadTarget(),monthNo=Number(plannerCursor.slice(5,7)),recs=recommendations();
    const baselineSummary=summarizePlan(base,[]),deltaRevenue=summary.planRevenue-baselineSummary.planRevenue,deltaProfit=summary.profit-baselineSummary.profit;
    const menuOptions='<option value="">메뉴 선택</option>'+recipeList().map(r=>`<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('');
    host.innerHTML=`
      <div class="planner-version"><div><span>기준 일정</span><b>${monthNo}월 현재 일정</b><small>${baselineSummary.classes}회 · ${baselineSummary.seats}석 · 정원매출 ${won(baselineSummary.planRevenue)}</small></div><i>→</i><div><span>작업중 Draft</span><b>${draft.length?`${draft.length}개 변경 추가`:'변경 없음'}</b><small>계획매출 ${deltaRevenue>=0?'+':''}${won(deltaRevenue)} · 계산가능 이익 ${deltaProfit>=0?'+':''}${won(deltaProfit)}</small></div><em>저장 전 시뮬레이션</em></div>
      <div class="planner-targets">${targetInput('planTargetClasses','목표 수업 수',target.classes,'예: 12',`현재 ${summary.classes}회`)}${targetInput('planTargetSeats','목표 좌석',target.seats,'예: 40',`현재 ${summary.seats}석`)}${targetInput('planTargetRevenue','목표 계획매출',target.revenue,'예: 2400000',`현재 ${won(summary.planRevenue)}`)}${targetInput('planTargetProfit','목표 이익',target.profit,'예: 1200000',`계산가능 ${won(summary.profit)}`)}</div>
      <div class="planner-stats">${stat('Draft 수업',`${summary.classes}회`,`기준 ${baselineSummary.classes} · Draft +${draft.length}`)}${stat('Draft 좌석',`${summary.seats}석`,`현재 예약 ${summary.booked}명`)}${stat('계획매출',won(summary.planRevenue),`정원 마감 가정 · ${deltaRevenue>=0?'+':''}${won(deltaRevenue)}`)}${stat('계산가능 이익',won(summary.profit),`${summary.costable}/${summary.classes} 수업 원가 연결`,summary.costable<summary.classes?'warn':'good')}${stat('현재 예약매출',won(summary.bookedRevenue),'실제 예약 인원 기준')}${stat('목표 Gap',planTargetGap(summary,target),'목표값은 이 브라우저에 저장',planTargetGap(summary,target).includes('+')?'warn':'good')}</div>
      <div class="planner-workspace"><section class="planner-calendar-card"><div class="planner-month-head"><button class="btn secondary small" data-plan-move="-1">‹ 이전</button><div><b>${plannerCursor.slice(0,4)}년 ${monthNo}월</b><small>기준 일정 + Draft를 함께 확인</small></div><button class="btn secondary small" data-plan-move="1">다음 ›</button></div><div class="planner-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="planner-calendar">${monthCalendar(base,draft)}</div></section><aside class="planner-editor"><h3>Draft 수업 추가</h3><div class="planner-editor-grid"><label>날짜<input id="planDate" type="date" value="${selectedPlanDate}"></label><label>시간<input id="planTime" type="time" value="10:00"></label><label class="span2">메뉴<select id="planMenu">${menuOptions}</select></label><label>정원<input id="planCapacity" type="number" min="1" value="4"></label><label>수강료/인<input id="planFee" type="number" min="0" value="${defaultFee()}"></label></div><button id="planAddDraft" class="btn" type="button">Draft에 추가</button><div class="planner-change-log"><h4>변경 내역</h4>${draft.length?draft.slice().reverse().map(r=>`<div class="planner-change"><div><b>${esc(r.menu)}</b><small>${esc(r.date)} · ${esc(r.time)} · ${normalizedCapacity(r)}석 · ${won(normalizedCapacity(r)*num(r.fee))}</small></div><button type="button" data-draft-remove="${esc(r.draft_id)}">삭제</button></div>`).join(''):'<p>아직 Draft 변경이 없습니다.</p>'}</div></aside></div>
      <section class="planner-recommend"><div><h3>원가가 연결된 메뉴 시나리오</h3><p>선택한 날짜 · 4명 · 현재 수강료 기준의 정원 마감 가정입니다.</p></div><div class="planner-recommend-grid">${recs.length?recs.map(x=>`<button type="button" data-plan-recipe="${esc(x.recipe.name)}"><span>${x.confidence==='confirmed'?'확정 원가':'조건부 원가'}</span><b>${esc(x.recipe.name)}</b><strong>${won(x.profit)}</strong><small>예상이익 / 4명 마감</small></button>`).join(''):'<div class="empty">추천 가능한 원가 연결 메뉴가 없습니다.</div>'}</div></section>`;
  }

  function addDraft(){
    const date=$('planDate')?.value,menu=$('planMenu')?.value,time=$('planTime')?.value||'10:00',capacity=Math.max(1,num($('planCapacity')?.value)||4),fee=Math.max(0,num($('planFee')?.value)||defaultFee());
    if(!date||!menu)return;const rows=loadDraft();rows.push({draft_id:`draft-${Date.now()}`,date,time,session:sessionFromTime(time),status:'예정',bookingStatus:'계획',classTitle:menu,menu,people:0,capacity,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,actualProfit:'',memo:'월간 계획 Draft'});saveDraft(rows);selectedPlanDate=date;renderPlanner();
  }
  function removeDraft(id){saveDraft(loadDraft().filter(r=>r.draft_id!==id));renderPlanner()}
  function resetDraft(){localStorage.removeItem(planKey(plannerCursor));renderPlanner()}
  function applyDraft(){
    if(!scheduleReady())return;const rows=loadDraft();if(!rows.length)return;if(!confirm(`${rows.length}개 Draft 수업을 실제 일정에 추가할까요?`))return;
    rows.forEach(r=>{const stamp=Date.now()+Math.floor(Math.random()*10000),id=`${r.date}-${r.time}-${r.menu}-${stamp}`,classId=`cls-${r.date.replaceAll('-','')}-${r.time.replace(':','')}-${stamp}`;schedule.rows.push({...r,id,class_id:classId,dow:B.dow(r.date),participants:[],memo:'월간 계획 Draft에서 추가',draft_id:undefined})});
    localStorage.removeItem(planKey(plannerCursor));try{mark('schedule')}catch(e){}try{renderAll()}catch(e){}renderPlanner();
  }

  function updateTarget(){
    const target={classes:num($('planTargetClasses')?.value)||null,seats:num($('planTargetSeats')?.value)||null,revenue:num($('planTargetRevenue')?.value)||null,profit:num($('planTargetProfit')?.value)||null};saveTarget(target);renderPlanner();
  }

  function calendarRows(date){
    const rows=[];try{(schedule?.rows||[]).forEach((r,i)=>{if(r.date===date)rows.push({source:'schedule',index:i,r})});(history?.records||[]).forEach((r,i)=>{if(r.date===date)rows.push({source:'history',index:i,r})})}catch(e){}return rows.sort((a,b)=>String(a.r.time||a.r.session||'').localeCompare(String(b.r.time||b.r.session||'')));
  }
  function participantRows(r){return Array.isArray(r?.participants)?r.participants:[]}
  function renderCalendarClassDetail(date,index=0){
    const host=$('calendarClassDetail');if(!host)return;const rows=calendarRows(date);selectedCalendarDate=date;selectedCalendarIndex=Math.min(index,Math.max(0,rows.length-1));
    if(!rows.length){host.innerHTML=`<div class="calendar-detail-empty"><b>${esc(date)}</b><span>등록된 수업이 없습니다.</span></div>`;return}
    const item=rows[selectedCalendarIndex],r=item.r,p=B.payment(r),list=participantRows(r),status=item.source==='history'?'완료':effectiveStatus(r),menu=r.menu||r.recipeCandidate||r.classTitle||'수업';
    const roster=list.map((x,i)=>{const due=x.amountDue!=null?num(x.amountDue):num(r.fee),paid=x.amountPaid!=null?num(x.amountPaid):(x.paymentStatus==='입금완료'?due:0);return `<div class="attendee-row"><div><b>${esc(x.name||`참가자 ${i+1} · 이름 미입력`)}</b><small>예정 ${won(due)} · 입금 ${won(paid)}</small></div><span class="payment-pill ${x.paymentStatus==='입금완료'?'paid':'pending'}">${esc(x.paymentStatus||'미확인')}</span></div>`}).join('');
    const missing=Math.max(0,num(r.people)-list.length);
    host.innerHTML=`<div class="calendar-detail-head"><div><span>${esc(date)} · ${esc(r.time||r.session||'')}</span><h3>${esc(menu)}</h3><small>${esc(status)} · ${num(r.people)}/${normalizedCapacity(r)}명</small></div>${rows.length>1?`<select id="calendarClassSelect">${rows.map((x,i)=>`<option value="${i}" ${i===selectedCalendarIndex?'selected':''}>${esc(x.r.time||x.r.session||'')} · ${esc(x.r.menu||x.r.recipeCandidate||x.r.classTitle||'수업')}</option>`).join('')}</select>`:''}</div><div class="calendar-payment-summary"><div><span>예상 수강료</span><b>${won(p.expected)}</b></div><div><span>확인 입금</span><b>${won(p.collected)}</b></div><div><span>미수금</span><b>${won(p.outstanding)}</b></div></div><div class="calendar-roster-head"><b>참가자 · 결제 상태</b><span>명단 ${list.length}/${num(r.people)}명</span></div><div class="attendee-list">${roster}${missing?`<div class="attendee-missing"><b>명단 미입력 ${missing}명</b><small>예약 인원은 있으나 이름/개별 결제 정보가 없습니다.</small></div>`:''}${!list.length&&!missing?'<div class="calendar-detail-empty">참가자 정보가 없습니다.</div>':''}</div>${item.source==='schedule'?`<button type="button" class="btn small calendar-edit-ops" data-ops-index="${item.index}">참가자 · 결제 편집</button>`:''}`;
  }

  function normalizePastStatuses(){
    if(!scheduleReady())return;for(const r of schedule.rows){if(r.status!=='취소'&&effectiveStatus(r)==='완료')r.status='완료'}
  }

  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-page="planner"]');if(nav)setTimeout(renderPlanner,20);
    const move=e.target.closest('[data-plan-move]');if(move){plannerCursor=moveMonth(plannerCursor,num(move.dataset.planMove));selectedPlanDate=plannerCursor;renderPlanner();return}
    const day=e.target.closest('[data-plan-date]');if(day){selectedPlanDate=day.dataset.planDate;renderPlanner();return}
    const remove=e.target.closest('[data-draft-remove]');if(remove){removeDraft(remove.dataset.draftRemove);return}
    const rec=e.target.closest('[data-plan-recipe]');if(rec){const sel=$('planMenu');if(sel)sel.value=rec.dataset.planRecipe;return}
    const calDay=e.target.closest('#calendarGrid .day');if(calDay)setTimeout(()=>renderCalendarClassDetail(calDay.dataset.day,0),30);
  },true);
  document.addEventListener('change',e=>{
    if(e.target.closest('#planTargetClasses,#planTargetSeats,#planTargetRevenue,#planTargetProfit'))updateTarget();
    if(e.target.id==='planDate'){selectedPlanDate=e.target.value;renderPlanner()}
    if(e.target.id==='calendarClassSelect')renderCalendarClassDetail(selectedCalendarDate,num(e.target.value));
  },true);
  document.addEventListener('click',e=>{if(e.target.id==='planAddDraft')addDraft();if(e.target.id==='plannerResetDraft')resetDraft();if(e.target.id==='plannerApplyDraft')applyDraft()},true);

  try{
    const baseConnect=connect;connect=async function(...args){const result=await baseConnect.apply(this,args);normalizePastStatuses();renderPlanner();return result};
  }catch(e){}
  try{
    const baseRenderAll=renderAll;renderAll=function(...args){normalizePastStatuses();const result=baseRenderAll.apply(this,args);setTimeout(()=>{renderPlanner();if(selectedCalendarDate)renderCalendarClassDetail(selectedCalendarDate,selectedCalendarIndex)},30);return result};
  }catch(e){}

  normalizePastStatuses();
  setTimeout(renderPlanner,500);
})();
