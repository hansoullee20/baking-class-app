(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const timeOf=r=>String(r?.time||r?.session||'');
  const menuOf=r=>String(r?.menu||r?.recipeCandidate||r?.classTitle||'수업');
  const statusOf=r=>B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정');
  const capacityOf=r=>Math.max(0,num(r?.capacity)||num(r?.studentCapacity)||num(r?.maxPeople)||num(r?.people));

  function rowsForDate(date){
    const rows=[];
    try{
      (history?.records||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'history',index:i,r})});
      (schedule?.rows||[]).forEach((r,i)=>{if(r?.date===date)rows.push({source:'schedule',index:i,r})});
    }catch(e){}
    return rows.sort((a,b)=>timeOf(a.r).localeCompare(timeOf(b.r)));
  }

  function participantPaid(p,r){
    const due=p?.amountDue==null||p?.amountDue===''?num(r?.fee):num(p.amountDue);
    const paid=p?.amountPaid==null||p?.amountPaid===''?(p?.paymentStatus==='입금완료'?due:0):num(p.amountPaid);
    return p?.paymentStatus==='입금완료'||(due>0&&paid>=due);
  }

  function seatStates(item){
    const r=item.r,status=item.source==='history'?'완료':statusOf(r),capacity=capacityOf(r),participants=Array.isArray(r?.participants)?r.participants:[];
    if(status==='취소')return{cancelled:true,capacity,seats:[],booked:0,paid:0,open:capacity,key:'cancelled',label:'취소'};
    const people=Math.max(0,num(r?.people));
    const booked=Math.min(capacity,Math.max(people,participants.length));
    const payment=B.payment(r);
    const classPaid=r?.paymentComplete===true||(payment.expected>0&&payment.outstanding<=0&&payment.missingRosterCount===0);
    const seats=[];
    let paid=0;
    for(let i=0;i<capacity;i++){
      if(i>=booked){seats.push({state:'open',label:`${i+1}번 자리 · 빈자리`});continue}
      const isPaid=classPaid||(i<participants.length&&participantPaid(participants[i],r));
      if(isPaid){paid++;seats.push({state:'paid',label:`${i+1}번 자리 · 예약 · 입금완료`})}
      else seats.push({state:'full',label:`${i+1}번 자리 · 예약 · 입금확인 필요`});
    }
    const open=Math.max(0,capacity-booked),key=booked>=capacity?(paid>=capacity&&capacity>0?'paid':'full'):'open';
    const label=`${booked}/${capacity||'—'}명 예약 · 입금완료 ${paid}명 · 빈자리 ${open}명`;
    return{cancelled:false,capacity,seats,booked,paid,open,key,label};
  }

  function ensureLegend(){
    const calendar=document.querySelector('#calendar .calendar-head');
    if(!calendar||document.getElementById('calendarStatusLegend'))return;
    const legend=document.createElement('div');
    legend.id='calendarStatusLegend';
    legend.className='calendar-status-legend';
    legend.innerHTML='<span><i class="calendar-seat-dot open"></i>빈자리</span><span><i class="calendar-seat-dot full"></i>예약</span><span><i class="calendar-seat-dot paid"></i>입금완료</span><small>원 1개 = 모집 1자리</small>';
    calendar.insertAdjacentElement('afterend',legend);
  }

  function decorateCalendar(){
    ensureLegend();
    document.querySelectorAll('#calendarGrid .day[data-day]').forEach(day=>{
      const date=day.dataset.day,rows=rowsForDate(date);
      const events=[...day.querySelectorAll(':scope > .event:not(.unified-draft-event)')].filter(x=>x.querySelector('b'));
      events.forEach((event,i)=>{
        const item=rows[i];if(!item)return;
        event.querySelector(':scope > .calendar-seat-dots')?.remove();
        const state=seatStates(item);
        event.classList.add('calendar-status-event');
        event.dataset.statusState=state.key;
        if(state.cancelled){event.title=`${menuOf(item.r)} · 취소 · 날짜를 클릭하면 상세`;return}
        const group=document.createElement('span');
        group.className='calendar-seat-dots';
        group.setAttribute('aria-label',state.label);
        group.title=state.label;
        state.seats.forEach(seat=>{
          const dot=document.createElement('i');
          dot.className=`calendar-seat-dot ${seat.state}`;
          dot.setAttribute('aria-label',seat.label);
          dot.title=seat.label;
          group.appendChild(dot);
        });
        event.prepend(group);
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
