(() => {
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const DEFAULT_VENUE = '달크닉 공방';

  function dayName(date){
    try { return dow(date); } catch(e) {}
    try { return ['일','월','화','수','목','금','토'][new Date(`${date}T00:00:00`).getDay()]; } catch(e) { return ''; }
  }
  function isWeekend(date){
    const d=dayName(date);
    return d==='토'||d==='일';
  }
  function venueOf(raw){
    return String(raw?.venue || schedule?.settings?.defaultVenue || DEFAULT_VENUE).trim() || DEFAULT_VENUE;
  }
  function isDalClinic(raw){ return venueOf(raw) === DEFAULT_VENUE; }
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
    const venue = venueOf(raw);
    const storedStudents = Math.max(0, num(raw?.people));
    const displayed = Math.max(0, num(raw?.displayedAttendance));
    const totalPeople = displayed > 0 ? displayed : storedStudents + 1;
    const students = raw?.people != null && raw?.people !== '' ? storedStudents : Math.max(0, totalPeople - 1);
    const instructorCount = totalPeople > 0 ? 1 : 0;
    const includedPeople = 2;
    const extraPeople = Math.max(0, totalPeople - includedPeople);
    const extraPersonFee = 10000;
    const hours = Math.max(3, num(raw?.durationHours || raw?.rentalHours || 3));
    const start = startHour(raw);
    const headcountSource = displayed > 0 ? 'displayedAttendance' : 'people+chef';

    if (venue !== DEFAULT_VENUE){
      const manual = raw?.rent !== '' && raw?.rent != null && Number.isFinite(Number(raw.rent)) ? num(raw.rent) : null;
      return {total:manual,base:null,extra:null,students,instructorCount,totalPeople,includedPeople,extraPeople,extraPersonFee,hours,start,day:dayName(raw?.date),weekend:isWeekend(raw?.date),rateStart:null,headcountSource,venue,automatic:false};
    }

    const base = baseRental(raw?.date, start, hours);
    const extra = extraPeople * extraPersonFee;
    return {total:base+extra,base,extra,students,instructorCount,totalPeople,includedPeople,extraPeople,extraPersonFee,hours,start,day:dayName(raw?.date),weekend:isWeekend(raw?.date),rateStart:hourlyRate(raw?.date,start),headcountSource,venue,automatic:true};
  }
  function rentalEstimate(students, type='weekday', start=10, hours=3){
    const fakeDate = ['weekend','sat','sun'].includes(type) ? '2026-08-30' : '2026-08-31';
    const fakeStart = type === 'evening' ? 19 : start;
    return rentalQuote({date:fakeDate,time:`${String(Math.floor(fakeStart)).padStart(2,'0')}:00`,people:students,durationHours:hours,venue:DEFAULT_VENUE}).total;
  }
  function rentalLabel(raw){
    const q = rentalQuote(raw);
    const headcount = q.headcountSource === 'displayedAttendance'
      ? `당근 표시 ${q.totalPeople}명(셰프 포함) · 실제 수강생 ${q.students}명`
      : `총 ${q.totalPeople}명(수강생 ${q.students}+셰프 1)`;
    if (!q.automatic){
      return `${q.venue} · ${q.hours}시간 · ${headcount} · 대관비 ${q.total == null ? '직접 입력 필요' : Math.round(q.total).toLocaleString('ko-KR')+'원'}`;
    }
    let rate;
    if (q.weekend) rate='주말 20,000원/h';
    else if (q.start >= 18) rate='평일 저녁 19,000원/h';
    else rate='평일 낮 17,000원/h';
    return `${DEFAULT_VENUE} · ${q.hours}시간 · ${headcount} · ${rate} · 추가 ${q.extraPeople}인`;
  }

  window.sunnyRentalQuote = rentalQuote;
  window.sunnyRentalEstimate = rentalEstimate;
  window.sunnyRentalLabel = rentalLabel;
  window.sunnyVenueOf = venueOf;

  function ensureStyle(){
    if(document.getElementById('sunnyVenueStyle')) return;
    const st=document.createElement('style');st.id='sunnyVenueStyle';st.textContent=`
      .sunny-venue-tag{display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:3px 7px;border:1px solid var(--line);border-radius:999px;font-size:7px;font-weight:850;color:var(--muted);background:color-mix(in srgb,var(--paper) 94%,var(--soft))}
      .sunny-venue-tag.alt{border-color:color-mix(in srgb,var(--warn) 45%,var(--line));color:var(--warn)}
      #scheduleList [data-venue-input]{min-width:150px}
      html[data-theme="dark"] .sunny-venue-tag{background:#171d25;border-color:#303844}
    `;document.head.appendChild(st);
  }

  function normalizeRows(){
    try {
      if (schedule?.settings){
        schedule.settings.defaultVenue = schedule.settings.defaultVenue || DEFAULT_VENUE;
        schedule.settings.rentPricing = {
          venue:DEFAULT_VENUE,
          minimumHours:3,weekdayDayHourly:17000,weekdayEveningHourly:19000,weekendHourly:20000,
          includedPeople:2,instructorCount:1,extraPersonFee:10000,
          attendanceRule:'당근 모임 표시 인원에는 셰프 1명이 이미 포함된다. displayedAttendance가 있으면 그 값을 대관 총인원으로 직접 사용한다.',
          note:'달크닉 공방에만 자동 적용. 기본 2인 포함, 총 3인부터 1인당 10,000원 추가. 주말은 토·일.'
        };
      }
      (schedule?.rows || []).forEach(r => {
        const venue=venueOf(r);
        if (venue !== DEFAULT_VENUE){
          r.rentAuto=false;
          if (r.rentManual !== true) r.rentManual=true;
          r.rentalHeadcount=rentalQuote(r).totalPeople;
          r.rentalHeadcountSource=rentalQuote(r).headcountSource;
          return;
        }
        if (r.rentManual === true && r.venue === DEFAULT_VENUE) return;
        const q=rentalQuote(r);
        r.rent=q.total;r.rentAuto=true;r.rentManual=false;r.rentalHours=q.hours;r.rentalHeadcount=q.totalPeople;r.rentalHeadcountSource=q.headcountSource;
      });
      (history?.records || []).forEach(r => {
        const venue=venueOf(r);
        if (venue !== DEFAULT_VENUE){
          r.rentAuto=false;
          if (r.rentManual !== true) r.rentManual=true;
          return;
        }
        if (r.rentManual === true && r.venue === DEFAULT_VENUE) return;
        const q=rentalQuote(r);
        r.rent=q.total;r.rentAuto=true;r.rentManual=false;r.rentalHours=q.hours;r.rentalHeadcount=q.totalPeople;r.rentalHeadcountSource=q.headcountSource;
      });
    } catch(e) {}
  }

  function decorateSchedule(){
    try {
      ensureStyle();
      document.querySelectorAll('#scheduleList .schedule').forEach(card=>{
        const i=Number(card.dataset.i),row=schedule?.rows?.[i];if(!row)return;
        const rentInput=card.querySelector('[data-k="rent"]');
        const rentField=rentInput?.closest('.field');
        const grid=rentField?.parentElement;
        if(grid&&!grid.querySelector('[data-venue-input]')){
          const f=document.createElement('div');f.className='field';
          f.innerHTML=`<label>장소</label><input data-venue-input value="${venueOf(row).replace(/"/g,'&quot;')}" placeholder="${DEFAULT_VENUE}">`;
          grid.insertBefore(f,grid.firstElementChild||null);
        }
        if(grid&&!grid.querySelector('[data-rental-hours]')){
          const f=document.createElement('div');f.className='field';
          f.innerHTML=`<label>대관 시간</label><input data-rental-hours type="number" min="3" step="0.5" value="${rentalQuote(row).hours}">`;
          grid.insertBefore(f,rentField);
        }
        if(rentField){
          const dal=isDalClinic(row);
          const label=rentField.querySelector('label');if(label)label.textContent=dal?(row.rentManual?'대관료 · 수동':'대관료 · 달크닉 자동'):'대관료 · 장소별 입력';
          rentInput.title=rentalLabel(row);
          if(!dal && (row.rent===''||row.rent==null)) rentInput.placeholder='대관비 입력';
        }
      });
    } catch(e) {}
  }
  function decorateUpcoming(){
    try {
      ensureStyle();
      document.querySelectorAll('#upcoming .upcoming-labeled-card[data-ops-index]').forEach(card=>{
        const row=schedule?.rows?.[Number(card.dataset.opsIndex)];if(!row)return;
        const head=card.querySelector('.upcoming-card-head > div');if(!head)return;
        let tag=head.querySelector('.sunny-venue-tag');
        if(!tag){tag=document.createElement('span');tag.className='sunny-venue-tag';head.appendChild(tag);}
        tag.textContent=venueOf(row);tag.classList.toggle('alt',!isDalClinic(row));
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
      const base=String(title.dataset.baseSubtitle||title.textContent||'').replace(/\s·\s장소:.*$/,'');
      title.dataset.baseSubtitle=base;title.textContent=`${base} · 장소: ${venueOf(row)}`;
      const cells=[...document.querySelectorAll('#opsProfit .ops-profit-item')];
      const rentCell=cells.find(c=>c.querySelector('span')?.textContent?.includes('대관'));
      if(rentCell){const small=rentCell.querySelector('small');if(small)small.textContent=rentalLabel(row);}
    } catch(e) {}
  }

  document.addEventListener('change', e => {
    const venueInput=e.target.closest?.('#scheduleList [data-venue-input]');
    if(venueInput){
      const card=venueInput.closest('.schedule'),i=Number(card?.dataset?.i),row=schedule?.rows?.[i];if(!row)return;
      const oldVenue=venueOf(row),newVenue=String(venueInput.value||'').trim()||DEFAULT_VENUE;
      row.venue=newVenue;
      if(newVenue===DEFAULT_VENUE){row.rentManual=false;row.rentAuto=true;}
      else if(oldVenue!==newVenue){row.rent='';row.rentManual=true;row.rentAuto=false;}
      normalizeRows();try{mark('schedule')}catch(e){};
      try{renderSchedule();renderDashboard();renderFinance()}catch(e){};
      setTimeout(()=>{decorateSchedule();decorateUpcoming();},0);return;
    }
    const hours=e.target.closest?.('#scheduleList [data-rental-hours]');
    if(hours){
      const card=hours.closest('.schedule'),i=Number(card?.dataset?.i),row=schedule?.rows?.[i];if(!row)return;
      row.rentalHours=Math.max(3,num(hours.value)||3);row.durationHours=row.rentalHours;
      if(isDalClinic(row)){row.rentManual=false;row.rentAuto=true;}
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
      window[name]=function(...args){normalizeRows();const out=old.apply(this,args);setTimeout(()=>{if(name==='renderSchedule')decorateSchedule();if(name==='renderDashboard')decorateUpcoming();},0);return out;};
    } catch(e) {}
  }
  ['renderSchedule','renderDashboard','renderFinance','renderAll'].forEach(wrap);

  document.addEventListener('click',()=>setTimeout(decorateModal,80),true);
  function refresh(){
    normalizeRows();
    try{renderDashboard()}catch(e){};try{renderSchedule()}catch(e){};try{renderFinance()}catch(e){};
    setTimeout(()=>{decorateSchedule();decorateUpcoming();decorateModal()},0);
  }
  setTimeout(refresh,500);
  setTimeout(normalizeRows,1200);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,120)});
})();
