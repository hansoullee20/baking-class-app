(() => {
  const byId = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';

  function currentMonth(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
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
    const host = byId('opsKpis');
    if (!host) return;
    const month = currentMonth();

    const completed = (history?.records || []).filter(r =>
      String(r.date || '').startsWith(month) && r.status !== '취소'
    );
    const plannedRows = (schedule?.rows || []).filter(r =>
      String(r.date || '').startsWith(month) && r.status !== '취소' && r.status !== '완료'
    );

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

    const trend = byId('dashboardTrendTitle');
    const trendText = trend?.querySelector('p');
    if (trendText) trendText.textContent = '이번 달 예상 총수입과 실제 입금액을 먼저 보고, 아래에서 월별 매출 흐름을 확인합니다.';
  }

  function scheduleRender(){ setTimeout(renderMonthlyForecast, 120); }

  try {
    const base = renderDashboard;
    renderDashboard = function(){ base(); scheduleRender(); };
  } catch(e) {}
  try {
    const base = renderAll;
    renderAll = function(){ base(); scheduleRender(); };
  } catch(e) {}

  setTimeout(renderMonthlyForecast, 700);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRender();
  });
})();
