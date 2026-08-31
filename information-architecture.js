(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  function ensureStyle(){if(document.querySelector('link[data-information-architecture]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='information-architecture.css?v=20260831-r1';link.dataset.informationArchitecture='1';document.head.appendChild(link)}
  ensureStyle();
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const todayISO=()=>B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA');
  const capacityOf=r=>Math.max(0,num(r?.capacity)||num(r?.people));
  const statusOf=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const defaultFee=()=>num(schedule?.settings?.defaultFee)||60000;
  const defaultRent=date=>B.rent({date},schedule);
  const timeOf=r=>/^\d{2}:\d{2}/.test(String(r?.time||''))?String(r.time).slice(0,5):(String(r?.session||'').includes('오후')?'14:00':String(r?.session||'').includes('기타')?'18:00':'10:00');
  const sessionFromTime=v=>Number(String(v||'10:00').slice(0,2))<13?'오전반':'오후반';
  const menuOf=r=>r?.menu||r?.classTitle||r?.recipeCandidate||'메뉴 미정';
  const dateLabel=d=>{try{const [y,m,day]=String(d).split('-').map(Number);return `${y}.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')}`}catch(e){return d}};

  function scheduleRows(){return Array.isArray(schedule?.rows)?schedule.rows:[]}
  function futureRows(){const t=todayISO();return scheduleRows().map((r,i)=>({r,i})).filter(x=>x.r.date>=t&&statusOf(x.r)!=='취소'&&statusOf(x.r)!=='완료').sort((a,b)=>a.r.date.localeCompare(b.r.date)||timeOf(a.r).localeCompare(timeOf(b.r)))}
  function classIssues(){
    const out=[];
    futureRows().forEach(({r,i})=>{
      const cap=capacityOf(r),people=num(r.people),remain=Math.max(0,cap-people),p=B.payment(r),f=B.classFinancials(r,{recipes:Array.isArray(recipes)?recipes:[],schedule,source:'schedule'});
      if(remain>0)out.push({kind:'모집',date:r.date,time:timeOf(r),menu:menuOf(r),detail:`${people}/${cap}명 · ${remain}자리 남음`,i,rank:1});
      if(p.outstanding>0||p.missingRosterCount>0)out.push({kind:'결제',date:r.date,time:timeOf(r),menu:menuOf(r),detail:p.missingRosterCount>0?`명단 ${Math.max(0,people-p.missingRosterCount)}/${people}명 · 결제 확인`:`미수금 확인 필요`,i,rank:2});
      if(!f.recipe||f.total==null)out.push({kind:'원가',date:r.date,time:timeOf(r),menu:menuOf(r),detail:!f.recipe?'레시피 연결 필요':'원가 확인 필요',i,rank:3});
    });
    return out.sort((a,b)=>a.rank-b.rank||a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }

  function renderLeanDashboard(){
    const page=$('dashboard');if(!page)return;
    const t=todayISO(),future=futureRows(),issues=classIssues(),todayClasses=future.filter(x=>x.r.date===t).length,recruit=[...new Set(issues.filter(x=>x.kind==='모집').map(x=>x.i))].length,payment=[...new Set(issues.filter(x=>x.kind==='결제').map(x=>x.i))].length,cost=[...new Set(issues.filter(x=>x.kind==='원가').map(x=>x.i))].length;
    page.querySelector('.hero small')?.replaceChildren(document.createTextNode('SUNNY’S ATELIER · OPERATIONS'));
    page.querySelector('.hero h2')?.replaceChildren(document.createTextNode('오늘 무엇을 처리할지'));
    page.querySelector('.hero p')?.replaceChildren(document.createTextNode('금액 분석은 원가 · 수익에서, 일정과 참가자 관리는 달력에서 확인합니다.'));
    let host=$('leanDashboard');if(!host){host=document.createElement('div');host.id='leanDashboard';host.className='lean-dashboard';page.querySelector('.hero')?.after(host)}
    const actionRows=issues.slice(0,8),up=future.slice(0,5);
    host.innerHTML=`<div class="lean-signal-grid"><div class="lean-signal"><span>오늘 수업</span><b>${todayClasses}건</b><small>달력에서 상세 관리</small></div><div class="lean-signal"><span>모집 필요</span><b>${recruit}건</b><small>정원 미달 수업</small></div><div class="lean-signal"><span>결제 확인</span><b>${payment}건</b><small>미수금·명단 확인</small></div><div class="lean-signal"><span>원가 확인</span><b>${cost}건</b><small>레시피·원가 연결</small></div></div><div class="lean-dashboard-grid"><section class="decision-block"><div class="lean-section-head"><div><h3>처리할 일</h3><p>같은 숫자를 반복하지 않고 행동만 표시합니다.</p></div></div><div class="lean-list">${actionRows.length?actionRows.map(x=>`<button class="lean-action" type="button" data-ops-index="${x.i}"><time>${esc(x.date.slice(5).replace('-','.'))}<br>${esc(x.time)}</time><div><b>${esc(x.kind)} · ${esc(x.menu)}</b><small>${esc(x.detail)}</small></div><em>열기</em></button>`).join(''):'<div class="decision-empty">현재 우선 처리할 일이 없습니다.</div>'}</div></section><section class="decision-block"><div class="lean-section-head"><div><h3>가까운 수업</h3><p>일정 확인만 하고 상세는 달력에서 관리합니다.</p></div><button type="button" data-ia-page="calendar">전체 달력</button></div><div class="lean-list">${up.length?up.map(({r,i})=>`<button class="lean-upcoming" type="button" data-ops-index="${i}"><time>${esc(r.date.slice(5).replace('-','.'))}<br>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${capacityOf(r)}명 · ${esc(statusOf(r))}</small></div><em>상세</em></button>`).join(''):'<div class="decision-empty">예정 수업이 없습니다.</div>'}</div></section></div>`;
  }

  function ensureCalendarTools(){
    const page=$('calendar'),head=page?.querySelector('.section-head');if(!page||!head)return;
    const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='달력 · 운영';if(p)p.textContent='과거·현재·미래 수업을 한 달력에서 보고 날짜를 눌러 관리합니다.';
    if(!$('calendarModeTools')){
      const tools=document.createElement('div');tools.id='calendarModeTools';tools.className='calendar-mode-tools';tools.innerHTML='<input id="calendarMonthJump" class="calendar-month-jump" type="month" aria-label="월 바로가기"><button id="calendarPlanToggle" class="btn secondary small" type="button">계획 모드</button>';head.appendChild(tools);
      $('calendarPlanToggle').addEventListener('click',()=>{page.classList.toggle('planning-open');$('calendarPlanToggle').classList.toggle('active',page.classList.contains('planning-open'));$('calendarPlanToggle').textContent=page.classList.contains('planning-open')?'계획 닫기':'계획 모드'});
      $('calendarMonthJump').addEventListener('change',e=>{if(!e.target.value)return;try{cursor=e.target.value+'-01';selected=null;renderCalendar()}catch(err){}});
    }
    try{$('calendarMonthJump').value=String(cursor).slice(0,7)}catch(e){}
  }

  function rowsForDate(date){
    const out=[];
    try{scheduleRows().forEach((r,i)=>{if(r.date===date)out.push({source:'schedule',i,r})});(history?.records||[]).forEach((r,i)=>{if(r.date===date)out.push({source:'history',i,r})})}catch(e){}
    return out.sort((a,b)=>timeOf(a.r).localeCompare(timeOf(b.r)));
  }
  function menuOptions(){const list=Array.isArray(recipes)?recipes:[];return '<option value="">메뉴 선택</option>'+list.map(r=>`<option value="${esc(r.name)}">${esc(r.name)}</option>`).join('')}
  function ensureDayModal(){
    if($('dayOpsModal'))return;
    const modal=document.createElement('div');modal.id='dayOpsModal';modal.className='dayops-modal';modal.setAttribute('aria-hidden','true');modal.innerHTML='<div class="dayops-backdrop" data-dayops-close></div><div class="dayops-dialog" role="dialog" aria-modal="true"><div class="dayops-head"><div><span>CALENDAR DAY</span><h2 id="dayOpsTitle"></h2></div><button class="dayops-close" type="button" data-dayops-close>×</button></div><div id="dayOpsBody"></div></div>';document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-dayops-close]'))closeDay();const cls=e.target.closest('.dayops-class[data-ops-index]');if(cls)closeDay();if(e.target.id==='dayOpsAddClass')addClassFromDay()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeDay()});
  }
  function closeDay(){const m=$('dayOpsModal');if(!m)return;m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('ops-modal-open')}
  function openDay(date){
    ensureDayModal();const m=$('dayOpsModal'),body=$('dayOpsBody'),rows=rowsForDate(date);m.dataset.date=date;$('dayOpsTitle').textContent=dateLabel(date);
    const list=rows.length?rows.map(x=>{const r=x.r,status=x.source==='history'?'완료':statusOf(r),cap=capacityOf(r);if(x.source==='history')return `<div class="dayops-class dayops-history"><time>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${cap||num(r.people)}명 · 완료 기록</small></div><i>기록</i></div>`;return `<button class="dayops-class" type="button" data-ops-index="${x.i}"><time>${esc(timeOf(r))}</time><div><b>${esc(menuOf(r))}</b><small>${num(r.people)}/${cap}명 · ${esc(status)}</small></div><i>수정</i></button>`}).join(''):'<div class="dayops-empty">등록된 수업이 없습니다.</div>';
    body.innerHTML=`<div class="dayops-list">${list}</div><section class="dayops-add"><div class="dayops-add-head"><h3>새 수업 추가</h3></div><div class="dayops-form"><label>시간<input id="dayOpsTime" type="time" value="10:00"></label><label>정원<input id="dayOpsCapacity" type="number" min="1" value="4"></label><label class="span2">메뉴<select id="dayOpsMenu">${menuOptions()}</select></label><label>수강료/인<input id="dayOpsFee" type="number" min="0" value="${defaultFee()}"></label><label>현재 예약<input id="dayOpsPeople" type="number" min="0" value="0"></label><button id="dayOpsAddClass" type="button" class="btn">이 날짜에 수업 추가</button></div></section><div class="dayops-foot">수업을 누르면 수업 내용 · 참가자 · 입금 · 삭제까지 한 팝업에서 관리합니다. 과거 history 기록은 읽기 전용입니다.</div>`;
    m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('ops-modal-open');
  }
  function addClassFromDay(){
    const modal=$('dayOpsModal'),date=modal?.dataset.date,menu=$('dayOpsMenu')?.value,time=$('dayOpsTime')?.value||'10:00',capacity=Math.max(1,num($('dayOpsCapacity')?.value)||4),people=Math.max(0,num($('dayOpsPeople')?.value)),fee=Math.max(0,num($('dayOpsFee')?.value)||defaultFee());if(!date||!menu||!schedule?.rows)return;
    const stamp=Date.now(),past=date<todayISO(),row={id:`${date}-${time}-${menu}-${stamp}`,class_id:`cls-${date.replaceAll('-','')}-${time.replace(':','')}-${stamp}`,date,time,session:sessionFromTime(time),dow:B.dow(date),status:past?'완료':'예정',bookingStatus:people>=capacity?'마감':'모집중',classTitle:menu,menu,people,capacity,fee,batchCount:1,rent:defaultRent(date),packing:0,other:0,actualProfit:'',participants:[],memo:'달력에서 추가'};
    schedule.rows.push(row);try{mark('schedule')}catch(e){};try{renderAll()}catch(e){};setTimeout(()=>openDay(date),80);
  }

  function cleanRoleSurfaces(){
    renderLeanDashboard();ensureCalendarTools();
    const recipeDecision=$('recipeDecision');if(recipeDecision)recipeDecision.hidden=true;
    const finance=$('financeDecision');if(finance){const forecast=finance.querySelector(':scope > .forecast');if(forecast)forecast.hidden=true}
  }

  document.addEventListener('click',e=>{
    const day=e.target.closest('#calendarGrid .day[data-day]');if(day){openDay(day.dataset.day)}
    const go=e.target.closest('[data-ia-page]');if(go){const target=document.querySelector(`.nav [data-page="${go.dataset.iaPage}"]`)||document.querySelector(`.mobile-nav [data-page="${go.dataset.iaPage}"]`);target?.click()}
  },true);
  try{const base=renderCalendar;renderCalendar=function(...args){const out=base.apply(this,args);setTimeout(()=>{ensureCalendarTools();try{$('calendarMonthJump').value=String(cursor).slice(0,7)}catch(e){}},40);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(cleanRoleSurfaces,80);return out}}catch(e){}
  try{const base=connect;connect=async function(...args){const out=await base.apply(this,args);setTimeout(cleanRoleSurfaces,100);return out}}catch(e){}
  ensureDayModal();setTimeout(cleanRoleSurfaces,700);
})();
