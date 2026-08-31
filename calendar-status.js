(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const timeOf=r=>String(r?.time||r?.session||'');
  const menuOf=r=>String(r?.menu||r?.recipeCandidate||r?.classTitle||'수업');
  const statusOf=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const capacityOf=r=>Math.max(0,num(r?.capacity)||num(r?.people));

  function rowsForDate(date){
    const rows=[];
    try{
      (history?.records||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'history',index:i,r})});
      (schedule?.rows||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'schedule',index:i,r})});
    }catch(e){}
    return rows.sort((a,b)=>timeOf(a.r).localeCompare(timeOf(b.r)));
  }

  function classState(item){
    const r=item.r,status=item.source==='history'?'완료':statusOf(r);
    if(status==='취소')return{key:'cancelled',label:'취소'};
    const capacity=capacityOf(r),people=Math.max(0,num(r?.people));
    const full=capacity>0&&people>=capacity;
    if(!full)return{key:'open',label:`모집/미달 · ${people}/${capacity||'—'}명`};
    const p=B.payment(r);
    const paid=r?.paymentComplete===true||(p.expected>0&&p.outstanding<=0&&p.missingRosterCount===0);
    if(paid)return{key:'paid',label:`정원 마감 · 입금 완료 · ${people}/${capacity}명`};
    return{key:'full',label:`정원 마감 · 입금 확인 필요 · ${people}/${capacity}명`};
  }

  function ensureLegend(){
    const calendar=document.querySelector('#calendar .calendar-head');
    if(!calendar||document.getElementById('calendarStatusLegend'))return;
    const legend=document.createElement('div');
    legend.id='calendarStatusLegend';
    legend.className='calendar-status-legend';
    legend.innerHTML='<span><i class="calendar-class-dot open"></i>모집/미달</span><span><i class="calendar-class-dot full"></i>정원 마감</span><span><i class="calendar-class-dot paid"></i>입금 완료</span>';
    calendar.insertAdjacentElement('afterend',legend);
  }

  function decorateCalendar(){
    ensureLegend();
    document.querySelectorAll('#calendarGrid .day[data-day]').forEach(day=>{
      const date=day.dataset.day,rows=rowsForDate(date);
      const events=[...day.querySelectorAll(':scope > .event:not(.unified-draft-event)')].filter(x=>x.querySelector('b'));
      events.forEach((event,i)=>{
        const item=rows[i];if(!item)return;
        event.querySelector(':scope > .calendar-class-dot')?.remove();
        const state=classState(item),dot=document.createElement('i');
        dot.className=`calendar-class-dot ${state.key}`;
        dot.setAttribute('aria-label',state.label);
        dot.title=state.label;
        event.prepend(dot);
        event.classList.add('calendar-status-event');
        event.dataset.statusState=state.key;
        event.title=`${menuOf(item.r)} · ${state.label} · 날짜를 클릭하면 상세`; 
      });
    });
  }

  try{
    const base=renderCalendar;
    renderCalendar=function(...args){const out=base.apply(this,args);setTimeout(decorateCalendar,45);return out};
  }catch(e){}
  try{
    const base=renderAll;
    renderAll=function(...args){const out=base.apply(this,args);setTimeout(decorateCalendar,70);return out};
  }catch(e){}
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="calendar"],#prevMonth,#nextMonth,#todayMonth'))setTimeout(decorateCalendar,90)},true);
  setTimeout(decorateCalendar,650);
})();
