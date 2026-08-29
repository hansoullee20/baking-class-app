(() => {
  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const safe = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function readyRecipe(name){
    try {
      const r = (recipes || []).find(x => x.name === name) || null;
      return r && r.cost != null && !['부분원가','미산정'].includes(r.cost_status) ? r : null;
    } catch(e){ return null; }
  }
  function payment(row){
    const list = Array.isArray(row.participants) ? row.participants : [];
    const expected = list.length
      ? list.reduce((s,p)=>s+(p.amountDue == null || p.amountDue === '' ? num(row.fee) : num(p.amountDue)),0)
      : num(row.people) * num(row.fee);
    const paid = list.reduce((s,p)=>{
      const due = p.amountDue == null || p.amountDue === '' ? num(row.fee) : num(p.amountDue);
      if(p.paymentStatus === '입금완료' && (p.amountPaid == null || p.amountPaid === '')) return s + due;
      return s + num(p.amountPaid);
    },0);
    return {expected, paid, outstanding:Math.max(0,expected-paid), rate:expected>0?paid/expected*100:0, hasRoster:list.length>0};
  }
  function profitability(row){
    const rec = readyRecipe(row.menu) || (row.recipeCandidate ? readyRecipe(row.recipeCandidate) : null);
    const material = rec ? num(rec.cost) * num(row.batchCount || 1) : null;
    const settings = schedule?.settings || {};
    let rent = num(row.rent);
    if(!rent){
      try { rent = dow(row.date) === '토' ? num(settings.satRent || 90000) : num(settings.weekdayRent || 81000); }
      catch(e){ rent = num(settings.weekdayRent || 81000); }
    }
    const revenue = row.status === '취소' ? 0 : num(row.people) * num(row.fee);
    const total = material == null ? null : material + rent + num(row.packing) + num(row.other);
    const profit = total == null ? null : revenue - total;
    const margin = profit == null || revenue <= 0 ? null : profit / revenue * 100;
    return {revenue, material, rent, total, profit, margin};
  }
  function timeLabel(row){ return row.time || row.session || '시간 미정'; }
  function statusText(row){ return row.bookingStatus || row.status || '예정'; }

  function enhanceUpcoming(){
    const box = $('upcoming');
    if(!box || !schedule || !Array.isArray(schedule.rows)) return;
    const all = schedule.rows
      .map((row,index)=>({row,index}))
      .filter(x=>x.row.status !== '취소' && x.row.date >= today())
      .sort((a,b)=>a.row.date.localeCompare(b.row.date) || String(timeLabel(a.row)).localeCompare(String(timeLabel(b.row))));

    const summary = all.reduce((a,x)=>{
      const p = payment(x.row);
      a.people += num(x.row.people);
      a.revenue += num(x.row.people) * num(x.row.fee);
      a.paid += p.paid;
      a.outstanding += p.outstanding;
      return a;
    },{people:0,revenue:0,paid:0,outstanding:0});

    let summaryEl = $('upcomingSummary');
    if(!summaryEl){
      summaryEl = document.createElement('div');
      summaryEl.id = 'upcomingSummary';
      summaryEl.className = 'upcoming-summary';
      box.parentElement?.insertBefore(summaryEl, box);
    }
    summaryEl.innerHTML = [
      ['예정 수업', all.length + '회', '앞으로 등록된 전체 일정'],
      ['예약 인원', summary.people + '명', '실제 수강생 기준'],
      ['예상매출', won(summary.revenue), '현재 예약 인원 × 수강료'],
      ['입금 총액', won(summary.paid), summary.paid ? '참가자 입금 기록 합계' : '아직 입금 기록 없음'],
      ['남은 미수금', won(summary.outstanding), summary.outstanding ? '아직 받아야 할 금액' : '미수금 없음']
    ].map(x=>`<div class="upcoming-summary-item"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');

    const shown = all.slice(0,7);
    box.innerHTML = shown.length ? shown.map(({row,index})=>{
      const p = payment(row), c = profitability(row);
      const capacity = row.capacity != null && row.capacity !== '' ? num(row.capacity) : null;
      const peopleText = capacity != null ? `${num(row.people)}/${capacity}명` : `${num(row.people)}명`;
      const profitText = c.profit == null ? '원가 필요' : won(c.profit);
      const marginText = c.margin == null ? '마진 계산 대기' : `마진 ${Math.round(c.margin)}%`;
      return `<button type="button" class="up upcoming-labeled-card" data-ops-index="${index}">
        <div class="upcoming-card-head">
          <div>
            <div class="upcoming-date">${safe(row.date.slice(5).replace('-','.'))}</div>
            <div class="upcoming-menu">${safe(row.menu || row.classTitle || '메뉴 미정')}</div>
          </div>
          <span class="upcoming-status">${safe(statusText(row))}</span>
        </div>
        <div class="upcoming-label-grid">
          <div class="upcoming-labeled-value"><span>시간</span><b>${safe(timeLabel(row))}</b></div>
          <div class="upcoming-labeled-value"><span>인원</span><b>${peopleText}</b></div>
          <div class="upcoming-labeled-value"><span>예상매출</span><b>${won(c.revenue)}</b></div>
          <div class="upcoming-labeled-value ${p.paid>0?'positive':''}"><span>입금 총액</span><b>${won(p.paid)}</b><small>${p.hasRoster?`입금률 ${Math.round(p.rate)}%`:'명단 미입력'}</small></div>
          <div class="upcoming-labeled-value ${p.outstanding>0?'warning':''}"><span>미수금</span><b>${won(p.outstanding)}</b></div>
          <div class="upcoming-labeled-value ${c.profit!=null&&c.profit>=0?'positive':''}"><span>예상이익</span><b>${profitText}</b><small>${marginText}</small></div>
        </div>
        <div class="upcoming-open-hint">클릭해서 참가자 · 입금 상세 관리</div>
      </button>`;
    }).join('') : '<div class="empty">예정 수업이 없습니다.</div>';
  }

  function install(){
    try {
      const original = renderDashboard;
      renderDashboard = function(){ original(); setTimeout(enhanceUpcoming,0); };
    } catch(e){}
    try {
      const originalAll = renderAll;
      renderAll = function(){ originalAll(); setTimeout(enhanceUpcoming,0); };
    } catch(e){}
    setTimeout(enhanceUpcoming,350);
  }
  install();
})();
