(() => {
  let activeIndex = null;
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const todayISO = () => {
    try { return today(); } catch(e) {}
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function captureIndex(e){
    const direct = e.target.closest?.('[data-ops-index]');
    if (direct && direct.dataset.opsIndex != null) {
      activeIndex = Number(direct.dataset.opsIndex);
      return;
    }
    const card = e.target.closest?.('#scheduleList .schedule');
    if (card && card.dataset.i != null) activeIndex = Number(card.dataset.i);
  }

  function currentRow(){
    return activeIndex == null ? null : schedule?.rows?.[activeIndex] || null;
  }

  function allPaid(row){
    if (row?.paymentComplete === true) return true;
    const list = Array.isArray(row?.participants) ? row.participants : [];
    if (!list.length) return false;
    return list.every(p => p.paymentStatus === '입금완료' && num(p.amountPaid) >= num(p.amountDue == null || p.amountDue === '' ? row.fee : p.amountDue));
  }

  function ensureParticipants(row){
    if (!Array.isArray(row.participants)) row.participants = [];
    while (row.participants.length < num(row.people)) {
      row.participants.push({
        id:`p-bulk-${Date.now()}-${row.participants.length}`,
        name:'',
        paymentStatus:'미입금',
        amountDue:num(row.fee),
        amountPaid:0,
        paidAt:'',
        memo:''
      });
    }
  }

  function completeClassPayment(){
    const row = currentRow();
    if (!row || allPaid(row)) return;
    ensureParticipants(row);
    const paidAt = todayISO();
    row.participants.forEach(p => {
      const due = p.amountDue == null || p.amountDue === '' ? num(row.fee) : num(p.amountDue);
      p.amountDue = due;
      p.amountPaid = due;
      p.paymentStatus = '입금완료';
      if (!p.paidAt) p.paidAt = paidAt;
    });
    row.paymentComplete = true;
    row.paymentCompletedAt = paidAt;
    row.paymentCompletedAmount = row.participants.reduce((s,p)=>s+num(p.amountPaid),0);
    try { mark('schedule'); } catch(e) {}
    const btn = document.getElementById('opsMarkAllPaid');
    if (btn) {
      btn.textContent = '입금 완료 ✓';
      btn.disabled = true;
      btn.classList.add('secondary');
    }
    const summary = document.getElementById('opsPaymentSummary');
    if (summary) summary.insertAdjacentHTML('afterbegin','<div class="ops-bulk-paid-note"><span>수업 전체</span><b>입금 완료 ✓</b></div>');
    setTimeout(() => {
      const close = document.querySelector('#classOpsModal [data-ops-close]');
      if (close) close.click();
      else {
        try { renderSchedule(); renderDashboard(); renderFinance(); } catch(e) {}
      }
    }, 220);
  }

  function ensureButton(){
    const modal = document.getElementById('classOpsModal');
    if (!modal) return;
    const actions = modal.querySelector('.ops-section-head .ops-actions');
    if (!actions) return;
    let btn = document.getElementById('opsMarkAllPaid');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'opsMarkAllPaid';
      btn.type = 'button';
      btn.className = 'btn small ops-bulk-paid-btn';
      btn.addEventListener('click', completeClassPayment);
      actions.prepend(btn);
    }
    const row = currentRow();
    const done = row && allPaid(row);
    btn.textContent = done ? '입금 완료 ✓' : '전체 입금 완료';
    btn.disabled = !!done;
    btn.classList.toggle('secondary', !!done);
    btn.title = done ? '이 수업은 전액 입금 완료로 처리되어 있습니다.' : '참가자 이름을 입력하지 않고 이 수업 전체를 전액 입금 완료로 처리합니다.';
  }

  document.addEventListener('click', captureIndex, true);
  const observer = new MutationObserver(() => ensureButton());
  observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-hidden']});
  setTimeout(ensureButton, 350);
})();
