(() => {
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

  function dayName(date){
    try { return dow(date); } catch(e) {}
    try { return ['일','월','화','수','목','금','토'][new Date(`${date}T00:00:00`).getDay()]; } catch(e) { return ''; }
  }
  function isWeekend(date){
    const d=dayName(date);
    return d==='토'||d==='일';
  }
  function startHour(raw){
    const t = String(raw?.time || '').match(/^(\d{1,2})(?::(\d{2}))?/);
    if (t) return Number(t[1]) + Number(t[2] || 0) / 60;
    const s = String(raw?.session || '');
    if (s.includes('저녁') || s.includes('야간')) return 19;
    if (s.includes('오후')) return 13;
    return 10;
  }
  function hourlyRate(date, hour){
    if (isWeekend(date)) return 20000;
    return hour >= 18 ? 19000 : 17000;
  }
  function baseRental(date, start, hours){
    let left = Math.max(3, num(hours) || 3), h = start, total = 0;
    while (left > 0.0001){
      const step = Math.min(1, left);
      total += hourlyRate(date, h) * step;
      h += step;
      left -= step;
    }
    return Math.round(total);
  }
  function rentalQuote(raw){
    const storedStudents = Math.max(0, num(raw?.people));
    const displayed = Math.max(0, num(raw?.displayedAttendance));
    // 당근 모임 표시 인원에는 셰프 본인이 이미 포함된다.
    // 표시 인원이 있으면 그 값을 공방 총 입장 인원으로 직접 사용하고 셰프를 다시 더하지 않는다.
    const totalPeople = displayed > 0 ? displayed : storedStudents + 1;
    const students = raw?.people != null && raw?.people !== '' ? storedStudents : Math.max(0, totalPeople - 1);
    const instructorCount = totalPeople > 0 ? 1 : 0;
    const includedPeople = 2;
    const extraPeople = Math.max(0, totalPeople - includedPeople);
    const extraPersonFee = 10000;
    const hours = Math.max(3, num(raw?.durationHours || raw?.rentalHours || 3));
    const start = startHour(raw);
    const base = baseRental(raw?.date, start, hours);
    const extra = extraPeople * extraPersonFee;
    const headcountSource = displayed > 0 ? 'displayedAttendance' : 'people+chef';
    return {total:base+extra,base,extra,students,instructorCount,totalPeople,includedPeople,extraPeople,extraPersonFee,hours,start,day:dayName(raw?.date),weekend:isWeekend(raw?.date),rateStart:hourlyRate(raw?.date,start),headcountSource};
  }
  function rentalEstimate(students, type='weekday', start=10, hours=3){
    const fakeDate = ['weekend','sat','sun'].includes(type) ? '2026-08-30' : '2026-08-31';
    const fakeStart = type === 'evening' ? 19 : start;
    return rentalQuote({date:fakeDate,time:`${String(Math.floor(fakeStart)).padStart(2,'0')}:00`,people:students,durationHours:hours}).total;
  }
  function rentalLabel(raw){
    const q = rentalQuote(raw);
    let rate;
    if (q.weekend) rate='주말 20,000원/h';
    else if (q.start >= 18) rate='평일 저녁 19,000원/h';
    else rate='평일 낮 17,000원/h';
    const headcount = q.headcountSource === 'displayedAttendance'
      ? `당근 표시 ${q.totalPeople}명(셰프 포함) · 실제 수강생 ${q.students}명`
      : `총 ${q.totalPeople}명(수강생 ${q.students}+셰프 1)`;
    return `${q.hours}시간 · ${headcount} · ${rate} · 추가 ${q.extraPeople}인`;
  }

  window.sunnyRentalQuote = rentalQuote;
  window.sunnyRentalEstimate = rentalEstimate;
  window.sunnyRentalLabel = rentalLabel;

  function normalizeRows(){
    try {
      if (schedule?.settings){
        schedule.settings.rentPricing = {
          minimumHours:3,weekdayDayHourly:17000,weekdayEveningHourly:19000,weekendHourly:20000,
          includedPeople:2,instructorCount:1,extraPersonFee:10000,
          attendanceRule:'당근 모임 표시 인원에는 셰프 1명이 이미 포함된다. displayedAttendance가 있으면 그 값을 대관 총인원으로 직접 사용한다.',
          note:'기본 2인 포함, 총 3인부터 1인당 10,000원 추가. 주말은 토·일.'
        };
      }
      (schedule?.rows || []).forEach(r => {
        if (r.rentManual === true) return;
        const q=rentalQuote(r);
        r.rent=q.total;r.rentAuto=true;r.rentalHours=q.hours;r.rentalHeadcount=q.totalPeople;r.rentalHeadcountSource=q.headcountSource;
      });
      (history?.records || []).forEach(r => {
        if (r.rentManual === true) return;
        const q=rentalQuote(r);
        r.rent=q.total;r.rentAuto=true;r.rentalHours=q.hours;r.rentalHeadcount=q.totalPeople;r.rentalHeadcountSource=q.headcountSource;
      });
    } catch(e) {}
  }

  function decorateSchedule(){
    try {
      document.querySelectorAll('#scheduleList .schedule').forEach(card=>{
        const i=Number(card.dataset.i),row=schedule?.rows?.[i];if(!row)return;
        const rentInput=card.querySelector('[data-k="rent"]');
        const rentField=rentInput?.closest('.field');
        const grid=rentField?.parentElement;
        if(grid&&!grid.querySelector('[data-rental-hours]')){
          const f=document.createElement('div');f.className='field';
          f.innerHTML=`<label>대관 시간</label><input data-rental-hours type="number" min="3" step="0.5" value="${rentalQuote(row).hours}">`;
          grid.insertBefore(f,rentField);
        }
        if(rentField){
          const label=rentField.querySelector('label');if(label)label.textContent=row.rentManual?'대관료 · 수동':'대관료 · 자동';
          rentInput.title=row.rentManual?'직접 입력한 대관료를 사용합니다.':rentalLabel(row);
        }
      });
    } catch(e) {}
  }
  function decorateModal(){
    try {
      const modal=document.getElementById('classOpsModal');if(!modal||!modal.classList.contains('open'))return;
      const title=document.getElementById('opsSubtitle');
      const menu=document.getElementById('opsTitle')?.textContent;
      const row=(schedule?.rows||[]).find(r=>(r.menu||r.classTitle||'')===menu && title?.textContent?.includes(r.date||''));
      if(!row)return;
      const cells=[...document.querySelectorAll('#opsProfit .ops-profit-item')];
      const rentCell=cells.find(c=>c.querySelector('span')?.textContent?.includes('대관'));
      if(rentCell){const small=rentCell.querySelector('small');if(small)small.textContent=rentalLabel(row);}
    } catch(e) {}
  }

  document.addEventListener('change', e => {
    const hours=e.target.closest?.('#scheduleList [data-rental-hours]');
    if(hours){
      const card=hours.closest('.schedule'),i=Number(card?.dataset?.i),row=schedule?.rows?.[i];if(!row)return;
      row.rentalHours=Math.max(3,num(hours.value)||3);row.durationHours=row.rentalHours;row.rentManual=false;row.rentAuto=true;
      normalizeRows();try{mark('schedule')}catch(e){};
      try{renderSchedule();renderDashboard();renderFinance()}catch(e){};
      setTimeout(decorateSchedule,0);return;
    }
    const el=e.target.closest?.('#scheduleList [data-k="rent"]');
    if (!el) return;
    const card=el.closest('.schedule'),i=Number(card?.dataset?.i);
    if(!Number.isFinite(i)||!schedule?.rows?.[i])return;
    schedule.rows[i].rentManual=true;schedule.rows[i].rentAuto=false;
  }, true);

  function wrap(name){
    try {
      const old=window[name];if(typeof old!=='function')return;
      window[name]=function(...args){normalizeRows();const out=old.apply(this,args);if(name==='renderSchedule')setTimeout(decorateSchedule,0);return out;};
    } catch(e) {}
  }
  ['renderSchedule','renderDashboard','renderFinance','renderAll'].forEach(wrap);

  document.addEventListener('click',()=>setTimeout(decorateModal,80),true);
  function refresh(){
    normalizeRows();
    try{renderDashboard()}catch(e){};try{renderSchedule()}catch(e){};try{renderFinance()}catch(e){};
    setTimeout(()=>{decorateSchedule();decorateModal()},0);
  }
  setTimeout(refresh,500);
  setTimeout(normalizeRows,1200);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,120)});
})();
