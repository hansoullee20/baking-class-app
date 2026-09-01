(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  function ensureStyle(){if(document.querySelector('link[href*="information-architecture.css"]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='information-architecture.css?v=20260831-r2';link.dataset.informationArchitecture='1';document.head.appendChild(link)}
  ensureStyle();
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const todayISO=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  const capacityOf=r=>Math.max(0,num(r?.capacity)||num(r?.people));
  const statusOf=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const defaultFee=()=>num(schedule?.settings?.defaultFee)||60000;
  const defaultRent=date=>B.rent({date},schedule);
  const timeOf=r=>/^\d{2}:\d{2}/.test(String(r?.time||''))?String(r.time).slice(0,5):(String(r?.session||'').includes('오후')?'14:00':String(r?.session||'').includes('기타')?'18:00':'10:00');
  const sessionFromTime=v=>Number(String(v||'10:00').slice(0,2))<13?'오전반':'오후반';
  const menuOf=r=>r?.menu||r?.classTitle||r?.recipeCandidate||'메뉴 미정';
  const dateLabel=d=>{const [y,m,day]=String(d).split('-');return `${y}.${m}.${day}`};
  let dayDate='';
  let dayClassIndex=null;

  function scheduleRows(){return Array.isArray(schedule?.rows)?schedule.rows:[]}
  function futureRows(){const t=todayISO();return scheduleRows().map((r,i)=>({r,i})).filter(x=>x.r.date>=t&&statusOf(x.r)!=='취소'&&statusOf(x.r)!=='완료').sort((a,b)=>a.r.date.localeCompare(b.r.date)||timeOf(a.r).localeCompare(timeOf(b.r)))}
  function classIssues(){
    const out=[];
    futureRows().forEach(({r,i})=>{
      const cap=capacityOf(r),people=num(r.people),remain=Math.max(0,cap-people),p=B.payment(r),f=B.classFinancials(r,{recipes:Array.isArray(recipes)?recipes:[],schedule,source:'schedule'});
      if(remain>0)out.push({kind:'모집',date:r.date,time:timeOf(r),menu:menuOf(r),detail:`${people}/${cap}명 · ${remain}자리 남음`,i,rank:1});
      if(p.outstanding>0||p.missingRosterCount>0)out.push({kind:'결제',date:r.date,time:timeOf(r),menu:menuOf(r),detail:p.missingRosterCount>0?`명단 ${Math.max(0,people-p.missingRosterCount)}/${people}명 · 결제 확인`:`미수금 ${won(p.outstanding)}`,i,rank:2});
      if(!f.recipe||f.total==null)out.push({kind:'원가',date:r.date,time:timeOf(r),menu:menuOf(r),detail:!f.recipe?'레시피 연결 필요':'원가 확인 필요',i,rank:3});
    });
    return out.sort((a,b)=>a.rank-b.rank||a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }

  function renderLeanDashboard(){
    const page=$('dashboard');if(!page)return;
    const t=todayISO(),future=futureRows(),issues=classIssues(),todayClasses=future.filter(x=>x.r.date===t).length,recruit=[...new Set(issues.filter(x=>x.kind==='모집').map(x=>x.i))].length,payment=[...new Set(issues.filter(x=>x.kind==='결제').map(x=>x.i))].length,cost=[...new Set(issues.filter(x=>x.kind==='원가').map(x=>x.i))].length;
    page.querySelector('.hero small')?.replaceChildren(document.createTextNode('SUNNY’S ATELIER · OPERATIONS'));
    page.querySelector('.hero h2')?.replaceChildren(document.createTextNode('오늘 무엇을 처리할지'));
    page.querySelector('.hero p')?.replaceChildren(document.createTextNode('일정은 달력에서, 제조 정보는 레시피에서, 금액은 원가 · 수익에서 관리합니다.'));
    let host=$('leanDashboard');if(!host){host=document.createElement('div');host.id='leanDashboard';host.className='lean-dashboard';page.querySelector('.hero')?.after(host)}
    const actionRows=issues.slice(0,8),up=future.slice(0,5);
    host.innerHTML=`<div class="lean-signal-grid"><button class="lean-signal" type="button" data-ia-page="calendar"><span>오늘 수업</span><b>${todayClasses}건</b><small>달력에서 관리</small></button><button class="lean-signal" type="button" data-ia-page="calendar"><span>모집 필요</span><b>${recruit}건</b><small>정원 미달 수업</small></button><button class="lean-signal" type="button" data-ia-page="calendar"><span>결제 확인</span><b>${payment}건</b><small>참가자·입금 관리</small></button><button class="lean-signal" type="button" data-ia-page="recipes"><span>원가 확인</span><b>${cost}건</b><small>레시피 원가 확인</small></button></div><div class="lean-dashboard-grid"><section class="decision-block"><div class="lean-section-head"><div><h3>처리할 일</h3><p>중복 지표 대신 다음 행동만 표시합니다.</p></div></div><div class="lean-list">${actionRows.length?actionRows.map(x=>`<button class="lean-action" type="button" data-day-date="${esc(x.date)}" data-day-class="${x.i}"><time>${esc(x.date.slice(5).replace('-','.'))}<br>${esc(x.time)}</time><div><b>${esc(x.kind)} · ${esc(x.menu)}</b><small>${esc(x.detail)}</small></div><em>열기</em></button>`).join(''):'<div class="focus-empty">현재 우선 처리할 일이 없습니다.</div>'}</div></section><section class="decision-block"><div class="lean-section-head"><div><h3>가까운 수업</h3><p>상세 관리는 달력 팝업에서 합니다.</p></div><button type="button" data-ia-page="calendar">전체 달력</button></div><div class="lean-list">${up.length?up.map(({r,i})=>`<button class="lean-upcoming" type="button" data-day-date="${esc(r.date)}" data-day-class="${i}"><time>${esc(r.date.slice(5).replace('-','.'))}<br>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${capacityOf(r)}명 · ${esc(statusOf(r))}</small></div><em>상세</em></button>`).join(''):'<div class="focus-empty">예정 수업이 없습니다.</div>'}</div></section></div>`;
  }

  function ensureCalendarTools(){
    const page=$('calendar'),head=page?.querySelector('.section-head');if(!page||!head)return;
    const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='달력 · 운영';if(p)p.textContent='과거·현재·미래를 이 달력 하나에서 보고, 날짜를 눌러 수업과 참가자를 관리합니다.';
    if(!$('calendarModeTools')){
      const tools=document.createElement('div');tools.id='calendarModeTools';tools.className='calendar-mode-tools';tools.innerHTML='<input id="calendarMonthJump" class="calendar-month-jump" type="month" aria-label="월 바로가기"><button id="calendarPlanToggle" class="btn secondary small" type="button">계획 모드</button>';head.appendChild(tools);
      $('calendarPlanToggle').addEventListener('click',()=>{page.classList.toggle('planning-open');$('calendarPlanToggle').classList.toggle('active',page.classList.contains('planning-open'));$('calendarPlanToggle').textContent=page.classList.contains('planning-open')?'계획 닫기':'계획 모드'});
      $('calendarMonthJump').addEventListener('change',e=>{if(!e.target.value)return;try{cursor=e.target.value+'-01';selected=null;renderCalendar()}catch(err){}});
    }
    try{$('calendarMonthJump').value=String(cursor).slice(0,7)}catch(e){}
  }

  function rowsForDate(date){
    const out=[];try{scheduleRows().forEach((r,i)=>{if(r.date===date)out.push({source:'schedule',i,r})});(history?.records||[]).forEach((r,i)=>{if(r.date===date)out.push({source:'history',i,r})})}catch(e){}
    return out.sort((a,b)=>timeOf(a.r).localeCompare(timeOf(b.r)));
  }
  function menuOptions(sel=''){const list=Array.isArray(recipes)?recipes:[];return '<option value="">메뉴 선택</option>'+list.map(r=>`<option value="${esc(r.name)}" ${r.name===sel?'selected':''}>${esc(r.name)}</option>`).join('')}
  function statusOptions(sel){return['예정','확정','완료','취소'].map(s=>`<option ${s===sel?'selected':''}>${s}</option>`).join('')}
  function participantTemplate(p,i,r){const due=p.amountDue==null||p.amountDue===''?num(r.fee):num(p.amountDue);return `<div class="dayops-person" data-pi="${i}"><span class="dayops-person-index">${i+1}</span><label>이름<input data-person="name" value="${esc(p.name||'')}" placeholder="참가자 이름"></label><label>입금<select data-person="paymentStatus"><option ${p.paymentStatus==='미입금'?'selected':''}>미입금</option><option ${p.paymentStatus==='부분입금'?'selected':''}>부분입금</option><option ${p.paymentStatus==='입금완료'?'selected':''}>입금완료</option></select></label><label>예정액<input data-person="amountDue" type="number" value="${due}"></label><label>입금액<input data-person="amountPaid" type="number" value="${num(p.amountPaid)}"></label><label>입금일<input data-person="paidAt" type="date" value="${esc(p.paidAt||'')}"></label><button type="button" class="dayops-person-delete" data-person-delete="${i}">삭제</button></div>`}
  function normalizeParticipants(r){if(!Array.isArray(r.participants))r.participants=[];r.participants.forEach((p,i)=>{if(!p.id)p.id=`p-${Date.now()}-${i}`;if(p.name==null)p.name='';if(!p.paymentStatus)p.paymentStatus='미입금';if(p.amountDue==null)p.amountDue=num(r.fee);if(p.amountPaid==null)p.amountPaid=0;if(p.paidAt==null)p.paidAt='';if(p.memo==null)p.memo=''})}
  function syncPaymentComplete(r){normalizeParticipants(r);const due=(p)=>p.amountDue==null||p.amountDue===''?num(r.fee):num(p.amountDue),complete=r.participants.length>=num(r.people)&&num(r.people)>0&&r.participants.slice(0,num(r.people)).every(p=>p.paymentStatus==='입금완료'&&num(p.amountPaid)>=due(p));r.paymentComplete=complete;if(complete){r.paymentCompletedAt=r.paymentCompletedAt||todayISO();r.paymentCompletedAmount=r.participants.reduce((s,p)=>s+num(p.amountPaid),0)}else{r.paymentCompletedAt='';r.paymentCompletedAmount=0}}

  function ensureDayModal(){
    if($('dayOpsModal'))return;
    const modal=document.createElement('div');modal.id='dayOpsModal';modal.className='dayops-modal';modal.setAttribute('aria-hidden','true');modal.innerHTML='<div class="dayops-backdrop" data-dayops-close></div><div class="dayops-dialog" role="dialog" aria-modal="true"><div class="dayops-head"><div><span>CALENDAR DAY</span><h2 id="dayOpsTitle"></h2></div><button class="dayops-close" type="button" data-dayops-close>×</button></div><div id="dayOpsBody"></div></div>';document.body.appendChild(modal);
    modal.addEventListener('click',handleDayClick);modal.addEventListener('change',handleDayChange);modal.addEventListener('input',handleDayInput);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeDay()});
  }
  function closeDay(){const m=$('dayOpsModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('ops-modal-open');dayClassIndex=null}
  function openDay(date,classIndex=null){dayDate=date;dayClassIndex=classIndex;ensureDayModal();const m=$('dayOpsModal');$('dayOpsTitle').textContent=dateLabel(date);renderDayBody();m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('ops-modal-open')}
  function renderDayBody(){if(dayClassIndex!=null&&scheduleRows()[dayClassIndex])renderClassEditor();else renderDayOverview()}
  function renderDayOverview(){
    const body=$('dayOpsBody'),rows=rowsForDate(dayDate),canAdd=dayDate>=todayISO();
    const list=rows.length?rows.map(x=>{const r=x.r,status=x.source==='history'?'완료':statusOf(r),cap=capacityOf(r),p=B.payment(r);if(x.source==='history')return `<button class="dayops-class dayops-history" type="button" data-history-index="${x.i}"><time>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${cap||num(r.people)}명 · 완료 기록</small></div><i>보기</i></button>`;return `<button class="dayops-class" type="button" data-day-edit="${x.i}"><time>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${cap}명 · ${esc(status)} · 입금 ${Math.round(num(p.rate))}%</small></div><i>관리</i></button>`}).join(''):'<div class="dayops-empty">등록된 수업이 없습니다.</div>';
    body.innerHTML=`<div class="dayops-list">${list}</div>${canAdd?`<section class="dayops-add"><div class="dayops-add-head"><h3>새 수업 추가</h3><small>오늘 또는 미래 날짜</small></div><div class="dayops-form"><label>시간<input id="dayOpsTime" type="time" value="10:00"></label><label>정원<input id="dayOpsCapacity" type="number" min="1" value="4"></label><label class="span2">메뉴<select id="dayOpsMenu">${menuOptions()}</select></label><label>수강료/인<input id="dayOpsFee" type="number" min="0" value="${defaultFee()}"></label><label>현재 예약<input id="dayOpsPeople" type="number" min="0" value="0"></label><button id="dayOpsAddClass" type="button" class="btn">이 날짜에 수업 추가</button></div></section>`:'<div class="dayops-foot">과거 날짜는 기록 확인용입니다. 등록된 일정은 필요한 경우 열어 수정할 수 있습니다.</div>'}`;
  }
  function renderHistory(index){const r=history?.records?.[index],body=$('dayOpsBody');if(!r||!body)return;const p=B.payment(r);body.innerHTML=`<button class="dayops-back" type="button" data-day-back>← ${esc(dateLabel(dayDate))}</button><section class="dayops-record"><span>완료 기록</span><h3>${esc(menuOf(r))}</h3><p>${esc(timeOf(r))} · ${num(r.people)}명</p><div class="dayops-payment"><div><span>예상</span><b>${won(p.expected)}</b></div><div><span>입금 기록</span><b>${won(p.collected)}</b></div><div><span>미확인</span><b>${won(p.outstanding)}</b></div></div><small>과거 history 데이터는 이 화면에서 읽기 전용입니다.</small></section>`}
  function renderClassEditor(){
    const r=scheduleRows()[dayClassIndex],body=$('dayOpsBody');if(!r||!body){dayClassIndex=null;return renderDayOverview()}normalizeParticipants(r);const p=B.payment(r),status=statusOf(r),paid=r.participants.filter(x=>x.paymentStatus==='입금완료').length;
    body.innerHTML=`<button class="dayops-back" type="button" data-day-back>← ${esc(dateLabel(dayDate))} 수업 목록</button><section class="dayops-editor"><div class="dayops-editor-head"><div><span>CLASS OPERATIONS</span><h3>${esc(menuOf(r))}</h3><small>${esc(status)} · ${num(r.people)}/${capacityOf(r)}명</small></div><button type="button" class="dayops-delete-class" data-day-delete>수업 삭제</button></div><div class="dayops-core-grid"><label>날짜<input data-core="date" type="date" value="${esc(r.date||'')}"></label><label>시간<input data-core="time" type="time" value="${esc(timeOf(r))}"></label><label>상태<select data-core="status">${statusOptions(r.status||'예정')}</select></label><label class="span2">메뉴<select data-core="menu">${menuOptions(r.menu||r.classTitle||'')}</select></label><label>수강생<input data-core="people" type="number" min="0" value="${num(r.people)}"></label><label>정원<input data-core="capacity" type="number" min="1" value="${capacityOf(r)||4}"></label><label>수강료/인<input data-core="fee" type="number" min="0" value="${num(r.fee)}"></label><label>대관료<input data-core="rent" type="number" min="0" value="${num(r.rent)}"></label><label>배합수<input data-core="batchCount" type="number" min="0.25" step="0.25" value="${num(r.batchCount)||1}"></label></div><div class="dayops-payment"><div><span>예상 수강료</span><b>${won(p.expected)}</b></div><div><span>확인 입금</span><b>${won(p.collected)}</b></div><div><span>미수금</span><b>${won(p.outstanding)}</b></div><div><span>입금완료</span><b>${paid}/${num(r.people)}명</b></div></div><div class="dayops-roster-head"><div><h4>참가자 · 입금</h4><small>여기서 사람과 결제만 관리합니다. 수익 분석은 원가 · 수익 탭에서 확인합니다.</small></div><div><button class="btn ghost small" type="button" data-fill-people>수강생 수만큼 만들기</button><button class="btn small" type="button" data-add-person>+ 참가자</button></div></div><div class="dayops-roster">${r.participants.length?r.participants.map((x,i)=>participantTemplate(x,i,r)).join(''):'<div class="dayops-empty">등록된 참가자가 없습니다.</div>'}</div></section>`;
  }
  function saveClassAndRefresh(){const r=scheduleRows()[dayClassIndex];if(r)syncPaymentComplete(r);try{mark('schedule')}catch(e){};try{renderAll()}catch(e){};setTimeout(()=>{if($('dayOpsModal')?.classList.contains('open')&&dayClassIndex!=null)renderClassEditor()},60)}
  function addClassFromDay(){const date=dayDate,menu=$('dayOpsMenu')?.value,time=$('dayOpsTime')?.value||'10:00',capacity=Math.max(1,num($('dayOpsCapacity')?.value)||4),people=Math.max(0,num($('dayOpsPeople')?.value)),fee=Math.max(0,num($('dayOpsFee')?.value)||defaultFee());if(!date||date<todayISO()||!menu||!schedule?.rows)return;const stamp=Date.now(),row={id:`${date}-${time}-${menu}-${stamp}`,class_id:`cls-${date.replaceAll('-','')}-${time.replace(':','')}-${stamp}`,date,time,session:sessionFromTime(time),dow:B.dow(date),status:'예정',bookingStatus:people>=capacity?'마감':'모집중',classTitle:menu,menu,people,capacity,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,actualProfit:'',participants:[],memo:'달력에서 추가'};schedule.rows.push(row);try{mark('schedule')}catch(e){};try{renderAll()}catch(e){};setTimeout(()=>openDay(date,schedule.rows.length-1),70)}
  function deleteClass(){const r=scheduleRows()[dayClassIndex];if(!r||dayClassIndex==null)return;if(!confirm(`${menuOf(r)} 수업을 삭제할까요?`))return;schedule.rows.splice(dayClassIndex,1);try{mark('schedule')}catch(e){};dayClassIndex=null;try{renderAll()}catch(e){};setTimeout(renderDayOverview,60)}
  function handleDayClick(e){
    if(e.target.closest('[data-dayops-close]'))return closeDay();const edit=e.target.closest('[data-day-edit]');if(edit){dayClassIndex=Number(edit.dataset.dayEdit);return renderClassEditor()}const hist=e.target.closest('[data-history-index]');if(hist)return renderHistory(Number(hist.dataset.historyIndex));if(e.target.closest('[data-day-back]')){dayClassIndex=null;return renderDayOverview()}if(e.target.id==='dayOpsAddClass')return addClassFromDay();if(e.target.closest('[data-day-delete]'))return deleteClass();const r=scheduleRows()[dayClassIndex];if(!r)return;if(e.target.closest('[data-add-person]')){normalizeParticipants(r);r.participants.push({id:`p-${Date.now()}-${r.participants.length}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});return saveClassAndRefresh()}if(e.target.closest('[data-fill-people]')){normalizeParticipants(r);while(r.participants.length<num(r.people))r.participants.push({id:`p-${Date.now()}-${r.participants.length}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});return saveClassAndRefresh()}const del=e.target.closest('[data-person-delete]');if(del){normalizeParticipants(r);r.participants.splice(Number(del.dataset.personDelete),1);return saveClassAndRefresh()}
  }
  function handleDayInput(e){const el=e.target.closest('[data-person="name"]');if(!el)return;const r=scheduleRows()[dayClassIndex],wrap=el.closest('[data-pi]');if(!r||!wrap)return;normalizeParticipants(r);r.participants[Number(wrap.dataset.pi)].name=el.value;try{mark('schedule')}catch(err){}}
  function handleDayChange(e){
    const core=e.target.closest('[data-core]'),r=scheduleRows()[dayClassIndex];if(core&&r){const k=core.dataset.core;let v=core.value;if(['people','capacity','fee','rent','batchCount'].includes(k))v=v===''?'':Number(v);if(k==='time'){r.time=v;r.session=sessionFromTime(v)}else{r[k]=v;if(k==='date'){r.dow=B.dow(v);dayDate=v;$('dayOpsTitle').textContent=dateLabel(v)}if(k==='menu')r.classTitle=v}return saveClassAndRefresh()}
    const person=e.target.closest('[data-person]'),wrap=person?.closest('[data-pi]');if(!person||!wrap||!r)return;normalizeParticipants(r);const p=r.participants[Number(wrap.dataset.pi)],k=person.dataset.person;let v=person.value;if(['amountDue','amountPaid'].includes(k))v=v===''?'':Number(v);p[k]=v;const due=p.amountDue==null||p.amountDue===''?num(r.fee):num(p.amountDue);if(k==='paymentStatus'){if(v==='입금완료'){p.amountPaid=due;p.paidAt=p.paidAt||todayISO()}else if(v==='미입금'){p.amountPaid=0;p.paidAt=''}}if(k==='amountPaid'){const paid=num(v);p.paymentStatus=paid>=due&&due>0?'입금완료':paid>0?'부분입금':'미입금';if(p.paymentStatus==='입금완료')p.paidAt=p.paidAt||todayISO();if(p.paymentStatus==='미입금')p.paidAt=''}return saveClassAndRefresh()
  }

  function cleanRoleSurfaces(){
    renderLeanDashboard();ensureCalendarTools();
    if($('recipeDecision'))$('recipeDecision').hidden=true;
    const finance=$('financeDecision');if(finance){const forecast=finance.querySelector(':scope > .forecast');if(forecast)forecast.hidden=true}
    const nextCard=$('nextMonthKpis')?.closest('.card');if(nextCard)nextCard.hidden=true;
  }
  document.addEventListener('click',e=>{const day=e.target.closest('#calendarGrid .day[data-day]');if(day)return openDay(day.dataset.day);const jump=e.target.closest('[data-day-date]');if(jump){const date=jump.dataset.dayDate,index=Number(jump.dataset.dayClass);document.querySelector('.nav [data-page="calendar"]')?.click();try{cursor=date.slice(0,7)+'-01';selected=date;renderCalendar()}catch(err){}setTimeout(()=>openDay(date,Number.isFinite(index)?index:null),80);return}const go=e.target.closest('[data-ia-page]');if(go){const target=document.querySelector(`.nav [data-page="${go.dataset.iaPage}"]`)||document.querySelector(`.mobile-nav [data-page="${go.dataset.iaPage}"]`);target?.click()}},true);
  try{const base=renderCalendar;renderCalendar=function(...args){const out=base.apply(this,args);setTimeout(()=>{ensureCalendarTools();try{$('calendarMonthJump').value=String(cursor).slice(0,7)}catch(e){}},40);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(cleanRoleSurfaces,80);return out}}catch(e){}
  try{const base=connect;connect=async function(...args){const out=await base.apply(this,args);setTimeout(cleanRoleSurfaces,100);return out}}catch(e){}
  window.BleuInformationArchitecture={refresh:cleanRoleSurfaces,renderDashboard:renderLeanDashboard};
  ensureDayModal();setTimeout(cleanRoleSurfaces,700);
})();