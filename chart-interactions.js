(() => {
  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const monthLabel = k => { const [y,m]=k.split('-'); return `${Number(m)}월${String(new Date().getFullYear())===y?'':` '${y.slice(2)}`}`; };
  const currentMonth = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };

  function monthlyData(){
    const by = {};
    (history?.records || []).forEach(r => {
      if (!r.date || r.status === '취소') return;
      const m = r.date.slice(0,7);
      by[m] ??= {month:m,done:0,plan:0};
      by[m].done += r.revenue == null ? num(r.people)*num(r.fee) : num(r.revenue);
    });
    (schedule?.rows || []).forEach(r => {
      if (!r.date || r.status === '취소' || r.status === '완료') return;
      const m = r.date.slice(0,7);
      by[m] ??= {month:m,done:0,plan:0};
      by[m].plan += num(r.people)*num(r.fee);
    });
    return Object.values(by).sort((a,b)=>a.month.localeCompare(b.month)).slice(-6);
  }

  function niceStepMan(maxMan){
    const rough = Math.max(1, maxMan / 4);
    const candidates = [5,10,20,25,50,100,200,250,500,1000,2000,2500,5000,10000];
    return candidates.find(v => v >= rough) || Math.ceil(rough/10000)*10000;
  }

  function renderInteractiveChart(){
    const host = $('opsRevenue');
    if (!host) return;
    const months = monthlyData();
    if (!months.length) return;

    const W=760,H=230,L=54,R=16,T=18,B=42,iw=W-L-R,ih=H-T-B;
    const rawMax = Math.max(1,...months.map(m=>Math.max(m.done,m.plan)));
    const maxMan = rawMax/10000;
    const stepMan = niceStepMan(maxMan);
    const niceMaxMan = Math.max(stepMan, Math.ceil(maxMan/stepMan)*stepMan);
    const niceMax = niceMaxMan*10000;
    const ticks = Math.round(niceMaxMan/stepMan);
    const x = i => months.length===1 ? L+iw/2 : L+iw*i/(months.length-1);
    const y = v => T+ih-(v/niceMax)*ih;

    let grid='';
    for(let i=0;i<=ticks;i++){
      const valMan = i*stepMan;
      const yy = y(valMan*10000);
      grid += `<line class="chart-grid-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="chart-axis-text" x="${L-7}" y="${yy+3}" text-anchor="end">${valMan}만</text>`;
    }
    const path = key => months.map((m,i)=>`${i?'L':'M'} ${x(i)} ${y(m[key])}`).join(' ');
    const labels = months.map((m,i)=>`<text class="chart-axis-text chart-month-label" data-revenue-month="${i}" x="${x(i)}" y="${H-13}" text-anchor="middle">${esc(monthLabel(m.month))}</text>`).join('');
    const hitWidth = Math.max(56, iw/Math.max(1,months.length));

    host.innerHTML = `<div class="interactive-revenue-chart">
      <svg class="analytics-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="월별 완료 매출과 예약 매출">
        ${grid}
        <path class="chart-line" d="${path('done')}"/>
        <path d="${path('plan')}" style="fill:none;stroke:var(--terra);stroke-width:2.5;stroke-dasharray:6 5;stroke-linecap:round"/>
        <rect class="chart-selection-bar" x="${x(0)-2}" y="${T}" width="4" height="${ih}" rx="2" opacity="0"/>
        ${months.map((m,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(m.done)}" r="4"></circle><circle cx="${x(i)}" cy="${y(m.plan)}" r="3.5" style="fill:var(--terra);stroke:var(--paper);stroke-width:2"></circle><rect class="chart-month-hit" data-revenue-month="${i}" data-x="${x(i)}" x="${x(i)-hitWidth/2}" y="${T}" width="${hitWidth}" height="${ih+B}" fill="transparent"/>`).join('')}
        ${labels}
      </svg>
      <div class="chart-value-tooltip" hidden></div>
      <div class="mini-legend"><span><i style="background:var(--blue)"></i>완료 매출</span><span><i style="background:var(--terra)"></i>예약 매출</span><span class="chart-click-hint">월을 누르면 정확한 금액 표시</span></div>
    </div>`;

    if (!host.dataset.chartBound) {
      host.dataset.chartBound = '1';
      host.addEventListener('click', e => {
        const target = e.target.closest('[data-revenue-month]');
        if (!target) return;
        const data = monthlyData();
        const i = Number(target.dataset.revenueMonth);
        const m = data[i];
        if (!m) return;
        const svg = host.querySelector('svg');
        const bar = host.querySelector('.chart-selection-bar');
        const tooltip = host.querySelector('.chart-value-tooltip');
        const hit = svg?.querySelector(`.chart-month-hit[data-revenue-month="${i}"]`);
        const xx = Number(hit?.dataset.x || 0);
        if (bar) { bar.setAttribute('x', String(xx-2)); bar.setAttribute('opacity','1'); }
        if (tooltip) {
          tooltip.hidden = false;
          tooltip.innerHTML = `<b>${esc(monthLabel(m.month))}</b><span>완료 매출 ${won(m.done)}</span><span>예약 매출 ${won(m.plan)}</span><strong>합계 ${won(m.done+m.plan)}</strong>`;
        }
      });
    }
  }

  function paidForRow(row){
    const full = num(row.people) * num(row.fee);
    if (row.paymentComplete === true) {
      return row.paymentCompletedAmount == null || row.paymentCompletedAmount === '' ? full : num(row.paymentCompletedAmount);
    }
    const list = Array.isArray(row.participants) ? row.participants : [];
    return list.reduce((sum,p) => {
      const due = p.amountDue == null || p.amountDue === '' ? num(row.fee) : num(p.amountDue);
      if (p.paymentStatus === '입금완료' && (p.amountPaid == null || p.amountPaid === '')) return sum + due;
      return sum + num(p.amountPaid);
    },0);
  }

  function renderMonthlyForecast(){
    const host = $('opsKpis');
    if (!host) return;
    const month = currentMonth();
    const completed = (history?.records || []).filter(r => String(r.date || '').startsWith(month) && r.status !== '취소');
    const plannedRows = (schedule?.rows || []).filter(r => String(r.date || '').startsWith(month) && r.status !== '취소' && r.status !== '완료');

    const completedRevenue = completed.reduce((sum,r) => sum + (r.revenue == null ? num(r.people)*num(r.fee) : num(r.revenue)),0);
    const reservedRevenue = plannedRows.reduce((sum,r) => sum + num(r.people)*num(r.fee),0);
    const forecast = completedRevenue + reservedRevenue;
    const incomingPaid = plannedRows.reduce((sum,r) => sum + paidForRow(r),0);
    const secured = completedRevenue + incomingPaid;
    const remaining = Math.max(0, forecast - secured);
    const securedRate = forecast > 0 ? secured / forecast * 100 : 0;
    const capped = plannedRows.filter(r => num(r.capacity) > 0);
    const fill = capped.length ? capped.reduce((s,r) => s + Math.min(1,num(r.people)/num(r.capacity)),0) / capped.length * 100 : null;

    host.classList.add('monthly-forecast-grid');
    host.innerHTML = `
      <div class="analytics-kpi monthly-forecast-primary">
        <div class="ak-label">이번 달 예상 총수입</div>
        <div class="ak-value">${won(forecast)}</div>
        <div class="ak-sub">완료 수업 ${won(completedRevenue)} + 예약 수업 ${won(reservedRevenue)}</div>
      </div>
      <div class="analytics-kpi">
        <div class="ak-label">지금까지 들어온 수업료</div>
        <div class="ak-value">${won(secured)}</div>
        <div class="ak-sub">완료분 + 실제 입금 · 예상 총수입의 ${Math.round(securedRate)}%</div>
      </div>
      <div class="analytics-kpi">
        <div class="ak-label">아직 들어올 수업료</div>
        <div class="ak-value">${won(remaining)}</div>
        <div class="ak-sub">이번 달 예약 중 아직 확보되지 않은 금액</div>
      </div>
      <div class="analytics-kpi">
        <div class="ak-label">예정 충원율</div>
        <div class="ak-value">${fill == null ? '—' : Math.round(fill) + '%'}</div>
        <div class="ak-sub">${capped.length}개 예정 수업의 현재 예약 인원 기준</div>
      </div>`;

    const trend = $('dashboardTrendTitle');
    const trendText = trend?.querySelector('p');
    if (trendText) trendText.textContent = '이번 달 예상 총수입과 실제 입금액을 먼저 보고, 아래에서 월별 매출 흐름을 확인합니다.';
  }

  function scheduleRender(){ setTimeout(() => { renderMonthlyForecast(); renderInteractiveChart(); }, 80); }
  try { const base = renderDashboard; renderDashboard = function(){ base(); scheduleRender(); }; } catch(e) {}
  try { const base = renderAll; renderAll = function(){ base(); scheduleRender(); }; } catch(e) {}
  setTimeout(() => { renderMonthlyForecast(); renderInteractiveChart(); }, 550);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') scheduleRender(); });
})();
