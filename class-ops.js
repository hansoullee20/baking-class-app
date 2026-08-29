(() => {
  let activeClassIndex = null;
  const byId = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const pct = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';
  const safe = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function recipeFor(name){
    try { return (recipes || []).find(r => r.name === name) || null; } catch(e) { return null; }
  }
  function isCostReady(r){
    return !!r && r.cost != null && !['부분원가','미산정'].includes(r.cost_status);
  }
  function rentForDay(date){
    const s = schedule?.settings || {};
    try { return dow(date) === '토' ? num(s.satRent || 90000) : num(s.weekdayRent || 81000); }
    catch(e){ return 81000; }
  }
  function classCosts(r){
    const rec = recipeFor(r.menu);
    const material = isCostReady(rec) ? num(rec.cost) * num(r.batchCount || 1) : null;
    const rent = num(r.rent || rentForDay(r.date));
    const packing = num(r.packing);
    const other = num(r.other);
    const total = material == null ? null : material + rent + packing + other;
    const revenue = r.status === '취소' ? 0 : num(r.people) * num(r.fee);
    const profit = total == null ? null : revenue - total;
    const margin = profit == null || revenue <= 0 ? null : profit / revenue * 100;
    const roi = profit == null || total <= 0 ? null : profit / total * 100;
    return {rec, material, rent, packing, other, total, revenue, profit, margin, roi};
  }
  function participantDue(p, row){ return p.amountDue == null || p.amountDue === '' ? num(row.fee) : num(p.amountDue); }
  function participantPaid(p, row){
    if (p.paymentStatus === '입금완료' && (p.amountPaid == null || p.amountPaid === '')) return participantDue(p,row);
    return num(p.amountPaid);
  }
  function paymentSummary(row){
    const list = Array.isArray(row.participants) ? row.participants : [];
    const expected = list.length ? list.reduce((s,p)=>s+participantDue(p,row),0) : num(row.people)*num(row.fee);
    const paid = list.reduce((s,p)=>s+participantPaid(p,row),0);
    const outstanding = Math.max(0, expected-paid);
    const paidCount = list.filter(p=>p.paymentStatus==='입금완료').length;
    const partialCount = list.filter(p=>p.paymentStatus==='부분입금').length;
    const unpaidCount = list.filter(p=>p.paymentStatus!=='입금완료' && p.paymentStatus!=='부분입금').length;
    const rate = expected > 0 ? paid / expected * 100 : 0;
    return {list, expected, paid, outstanding, paidCount, partialCount, unpaidCount, rate};
  }

  function ensureModal(){
    if (byId('classOpsModal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'classOpsModal';
    wrap.className = 'ops-modal';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML = `
      <div class="ops-backdrop" data-ops-close></div>
      <div class="ops-dialog" role="dialog" aria-modal="true" aria-labelledby="opsTitle">
        <div class="ops-dialog-head">
          <div>
            <div class="ops-kicker">CLASS DETAIL · PAYMENT</div>
            <h2 id="opsTitle">수업 상세</h2>
            <p id="opsSubtitle"></p>
          </div>
          <button class="ops-icon-btn" type="button" data-ops-close aria-label="닫기">×</button>
        </div>
        <div id="opsMetrics" class="ops-metrics"></div>
        <div class="ops-section-head">
          <div><h3>참가자 · 입금 관리</h3><p>이름과 입금 상태만 기록해도 미수금이 자동 계산됩니다.</p></div>
          <div class="ops-actions"><button class="btn ghost small" id="opsFillSeats" type="button">수강생 수만큼 만들기</button><button class="btn small" id="opsAddParticipant" type="button">+ 참가자</button></div>
        </div>
        <div id="opsRoster" class="ops-roster"></div>
        <div id="opsPaymentSummary" class="ops-payment-summary"></div>
        <div class="ops-section-head ops-profit-head">
          <div><h3>이 수업 수익성</h3><p>예상매출과 현재 입력된 원가·대관료를 기준으로 계산합니다.</p></div>
        </div>
        <div id="opsProfit" class="ops-profit-grid"></div>
        <div class="ops-modal-foot"><span>변경 내용은 기존 GitHub 자동저장 흐름으로 저장됩니다.</span><button class="btn secondary" type="button" data-ops-close>닫기</button></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-ops-close]')) closeClass();
      const del = e.target.closest('[data-participant-delete]');
      if (del) {
        const row = currentRow();
        if (!row) return;
        row.participants.splice(num(del.dataset.participantDelete),1);
        mark('schedule');
        renderModal();
        decorateSchedule();
        renderEmbeddedPayment();
      }
    });
    byId('opsAddParticipant').addEventListener('click', () => addParticipant());
    byId('opsFillSeats').addEventListener('click', () => fillParticipants());
    wrap.addEventListener('change', handleRosterChange);
    wrap.addEventListener('input', e => {
      const el=e.target.closest('[data-participant-field="name"],[data-participant-field="memo"]');
      if(!el)return;
      const row=currentRow(); if(!row)return;
      normalizeParticipants(row);
      const p=row.participants[num(el.dataset.pi)]; if(!p)return;
      p[el.dataset.participantField]=el.value;
      mark('schedule');
    });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && wrap.classList.contains('open')) closeClass(); });
  }

  function currentRow(){
    if (activeClassIndex == null) return null;
    return schedule?.rows?.[activeClassIndex] || null;
  }
  function normalizeParticipants(row){
    if (!Array.isArray(row.participants)) row.participants = [];
    row.participants.forEach((p,i)=>{
      if (!p.id) p.id = `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;
      if (!p.paymentStatus) p.paymentStatus = '미입금';
      if (p.amountDue == null) p.amountDue = num(row.fee);
      if (p.amountPaid == null) p.amountPaid = 0;
      if (p.paidAt == null) p.paidAt = '';
      if (p.memo == null) p.memo = '';
      if (p.name == null) p.name = '';
    });
  }
  function openClass(index){
    if (!schedule?.rows?.[index]) return;
    activeClassIndex = Number(index);
    const row = currentRow();
    normalizeParticipants(row);
    ensureModal();
    renderModal();
    const modal = byId('classOpsModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('ops-modal-open');
  }
  function closeClass(){
    const modal = byId('classOpsModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('ops-modal-open');
    activeClassIndex = null;
    try { renderSchedule(); renderDashboard(); renderFinance(); } catch(e) {}
    setTimeout(()=>{decorateSchedule();decorateUpcoming();renderEmbeddedPayment();renderProfitPlanner();},0);
  }
  function addParticipant(){
    const row = currentRow(); if(!row) return;
    normalizeParticipants(row);
    row.participants.push({id:`p-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',paymentStatus:'미입금',amountDue:num(row.fee),amountPaid:0,paidAt:'',memo:''});
    mark('schedule'); renderModal(); decorateSchedule(); renderEmbeddedPayment();
  }
  function fillParticipants(){
    const row = currentRow(); if(!row) return;
    normalizeParticipants(row);
    while(row.participants.length < num(row.people)){
      row.participants.push({id:`p-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',paymentStatus:'미입금',amountDue:num(row.fee),amountPaid:0,paidAt:'',memo:''});
    }
    mark('schedule'); renderModal(); decorateSchedule(); renderEmbeddedPayment();
  }
  function handleRosterChange(e){
    const el = e.target.closest('[data-participant-field]'); if(!el) return;
    const row=currentRow(); if(!row) return;
    normalizeParticipants(row);
    const i=num(el.dataset.pi), key=el.dataset.participantField, p=row.participants[i]; if(!p) return;
    let v=el.value;
    if(['amountDue','amountPaid'].includes(key)) v=v===''?'':Number(v);
    p[key]=v;
    if(key==='paymentStatus'){
      if(v==='입금완료'){
        if(!num(p.amountPaid)) p.amountPaid=participantDue(p,row);
        if(!p.paidAt) p.paidAt=today();
      } else if(v==='미입금'){
        p.amountPaid=0; p.paidAt='';
      }
    }
    if(key==='amountPaid'){
      const due=participantDue(p,row), paid=num(v);
      p.paymentStatus=paid>=due && due>0?'입금완료':paid>0?'부분입금':'미입금';
      if(p.paymentStatus==='입금완료'&&!p.paidAt)p.paidAt=today();
    }
    mark('schedule');
    renderModal();
    decorateSchedule();
    renderEmbeddedPayment();
  }
  function renderModal(){
    const row=currentRow(); if(!row) return;
    normalizeParticipants(row);
    const pay=paymentSummary(row), c=classCosts(row);
    byId('opsTitle').textContent = row.menu || row.classTitle || '메뉴 미정';
    byId('opsSubtitle').textContent = `${row.date || ''} · ${row.time || row.session || ''} · ${num(row.people)}명 · ${won(row.fee)}/인`;
    byId('opsMetrics').innerHTML = [
      ['수강생',`${num(row.people)}명`,row.capacity?`정원 ${num(row.capacity)}명`:'현재 일정 기준'],
      ['입금액',won(pay.paid),`예정 ${won(pay.expected)}`],
      ['미수금',won(pay.outstanding),`입금률 ${Math.round(pay.rate)}%`],
      ['예상이익',c.profit==null?'계산 보류':won(c.profit),c.margin==null?'원가 미확정':`마진 ${Math.round(c.margin)}%`]
    ].map(x=>`<div class="ops-metric"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
    byId('opsRoster').innerHTML = row.participants.length ? row.participants.map((p,i)=>`
      <div class="ops-person">
        <div class="ops-person-index">${i+1}</div>
        <div class="field"><label>이름</label><input data-pi="${i}" data-participant-field="name" value="${safe(p.name)}" placeholder="참가자 이름"></div>
        <div class="field"><label>입금 상태</label><select data-pi="${i}" data-participant-field="paymentStatus">
          <option ${p.paymentStatus==='미입금'?'selected':''}>미입금</option>
          <option ${p.paymentStatus==='부분입금'?'selected':''}>부분입금</option>
          <option ${p.paymentStatus==='입금완료'?'selected':''}>입금완료</option>
        </select></div>
        <div class="field"><label>결제 예정액</label><input data-pi="${i}" data-participant-field="amountDue" type="number" value="${participantDue(p,row)}"></div>
        <div class="field"><label>입금액</label><input data-pi="${i}" data-participant-field="amountPaid" type="number" value="${p.amountPaid ?? 0}"></div>
        <div class="field"><label>입금일</label><input data-pi="${i}" data-participant-field="paidAt" type="date" value="${safe(p.paidAt||'')}"></div>
        <div class="field ops-person-memo"><label>메모</label><input data-pi="${i}" data-participant-field="memo" value="${safe(p.memo||'')}" placeholder="재참여, 환불 등"></div>
        <button class="ops-delete" type="button" data-participant-delete="${i}" aria-label="참가자 삭제">삭제</button>
      </div>`).join('') : '<div class="analytics-empty">등록된 참가자가 없습니다. “수강생 수만큼 만들기”를 누르면 현재 인원수만큼 빈 행을 생성합니다.</div>';
    byId('opsPaymentSummary').innerHTML = `
      <div><span>입금완료</span><b>${pay.paidCount}명</b></div>
      <div><span>부분입금</span><b>${pay.partialCount}명</b></div>
      <div><span>미입금</span><b>${pay.unpaidCount}명</b></div>
      <div><span>입금률</span><b>${Math.round(pay.rate)}%</b></div>
      <div class="ops-payment-bar"><i style="width:${Math.max(0,Math.min(100,pay.rate))}%"></i></div>`;
    const cashProfit = c.total == null ? null : pay.paid - c.total;
    byId('opsProfit').innerHTML = [
      ['예상 매출',won(c.revenue),'수강생 × 수강료'],
      ['재료 원가',c.material==null?'미산정':won(c.material),c.rec?(c.rec.cost_status||''):'레시피 미연결'],
      ['대관료',won(c.rent),row.date && dow(row.date)==='토'?'토요일':'평일'],
      ['총 비용',c.total==null?'계산 보류':won(c.total),'재료+대관+추가비용'],
      ['예상이익',c.profit==null?'계산 보류':won(c.profit),c.margin==null?'—':`매출이익률 ${Math.round(c.margin)}%`],
      ['원가 대비 ROI',c.roi==null?'계산 보류':pct(c.roi),'이익 ÷ 총비용'],
      ['현재 입금 기준 잔액',cashProfit==null?'계산 보류':won(cashProfit),'입금액 - 총비용']
    ].map(x=>`<div class="ops-profit-item"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
  }

  function decorateSchedule(){
    const list=byId('scheduleList'); if(!list) return;
    list.querySelectorAll('.schedule').forEach(card=>{
      const i=num(card.dataset.i), row=schedule?.rows?.[i]; if(!row) return;
      card.classList.add('ops-clickable');
      let existing=card.querySelector('.ops-inline-summary');
      if(existing) existing.remove();
      const pay=paymentSummary(row), c=classCosts(row);
      const wrap=document.createElement('div'); wrap.className='ops-inline-summary';
      const rosterCount=Array.isArray(row.participants)?row.participants.filter(p=>String(p.name||'').trim()).length:0;
      wrap.innerHTML=`<button type="button" class="ops-open-detail" data-ops-index="${i}">
          <span>참가자·입금 관리</span>
          <b>${rosterCount ? `${rosterCount}/${num(row.people)}명 등록` : '명단 입력'}</b>
        </button>
        <span class="ops-chip ${pay.outstanding>0?'warn':'ok'}">입금 ${won(pay.paid)}${pay.expected?` / ${won(pay.expected)}`:''}</span>
        <span class="ops-chip">입금률 ${Math.round(pay.rate)}%</span>
        <span class="ops-chip ${c.margin!=null&&c.margin>=40?'ok':''}">마진 ${c.margin==null?'—':Math.round(c.margin)+'%'}</span>`;
      const calcEl=card.querySelector('.calc');
      if(calcEl) calcEl.insertAdjacentElement('afterend',wrap);
      else card.appendChild(wrap);
    });
  }
  function decorateUpcoming(){
    const box=byId('upcoming'); if(!box) return;
    let fut=[];
    try { fut=events().filter(e=>e.source==='schedule'&&e.date>=today()&&e.status!=='취소').slice(0,7); } catch(e){}
    box.querySelectorAll('.up').forEach((el,j)=>{
      const ev=fut[j]; if(!ev) return;
      el.classList.add('ops-upcoming-click');
      el.dataset.opsIndex=ev.index;
      const row=schedule?.rows?.[ev.index];
      if(!row) return;
      const pay=paymentSummary(row);
      let badge=el.querySelector('.ops-up-payment');
      if(!badge){badge=document.createElement('span');badge.className='ops-up-payment';el.appendChild(badge)}
      badge.textContent=Array.isArray(row.participants)&&row.participants.length?`입금 ${Math.round(pay.rate)}%`:'명단 입력';
    });
  }

  function installGlobalClicks(){
    document.addEventListener('click',e=>{
      const direct=e.target.closest('[data-ops-index]');
      if(direct){ e.preventDefault(); e.stopPropagation(); openClass(num(direct.dataset.opsIndex)); return; }
      const up=e.target.closest('.up[data-ops-index]');
      if(up){ openClass(num(up.dataset.opsIndex)); return; }
      const card=e.target.closest('#scheduleList .schedule');
      if(card && !e.target.closest('input,select,textarea,button,summary,details,label')){
        openClass(num(card.dataset.i));
      }
    }, true);
  }

  function ensurePaymentWidget(){
    const schedulePage=byId('schedule'); if(!schedulePage||byId('paymentOpsPanel')) return;
    const panel=document.createElement('div');
    panel.id='paymentOpsPanel';
    panel.className='analytics-card ops-embedded-card';
    panel.innerHTML=`<div class="analytics-head"><div><h3>입금 현황</h3><p>예정·확정 수업의 참가자 명단에서 자동 집계</p></div><span class="analytics-badge">Payment</span></div><div id="paymentOpsKpis" class="ops-payment-kpis"></div><div id="paymentOpsList"></div>`;
    const list=byId('scheduleList');
    if(list) list.insertAdjacentElement('beforebegin',panel);
  }
  function renderEmbeddedPayment(){
    ensurePaymentWidget();
    const k=byId('paymentOpsKpis'), list=byId('paymentOpsList'); if(!k||!list) return;
    const rows=(schedule?.rows||[]).filter(r=>r.status!=='취소' && r.date>=today());
    const sums=rows.map(r=>({r,p:paymentSummary(r)}));
    const expected=sums.reduce((s,x)=>s+x.p.expected,0), paid=sums.reduce((s,x)=>s+x.p.paid,0), outstanding=Math.max(0,expected-paid);
    const rate=expected?paid/expected*100:0;
    k.innerHTML=[['입금 예정',won(expected)],['입금 완료',won(paid)],['미수금',won(outstanding)],['전체 입금률',Math.round(rate)+'%']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
    const needs=sums.filter(x=>x.p.outstanding>0 || !Array.isArray(x.r.participants) || !x.r.participants.length).sort((a,b)=>a.r.date.localeCompare(b.r.date)).slice(0,6);
    list.innerHTML=needs.length?`<div class="ops-collection-list">${needs.map(x=>{
      const idx=schedule.rows.indexOf(x.r);
      const missingNames=!Array.isArray(x.r.participants)||!x.r.participants.length;
      return `<button class="ops-collection-row" type="button" data-ops-index="${idx}"><span><b>${safe(x.r.date.slice(5))} ${safe(x.r.menu||'메뉴 미정')}</b><small>${safe(x.r.time||x.r.session||'')} · ${num(x.r.people)}명</small></span><strong>${missingNames?'명단 미입력':`미수 ${won(x.p.outstanding)}`}</strong></button>`;
    }).join('')}</div>`:'<div class="analytics-empty">현재 예정 수업의 미수금이 없습니다.</div>';
  }

  function ensureProfitPlanner(){
    const page=byId('finance'); if(!page||byId('profitPlanner')) return;
    const box=document.createElement('div');
    box.id='profitPlanner'; box.className='card ops-planner';
    box.innerHTML=`<div class="ops-section-head"><div><h3>수익 플래너</h3><p>메뉴·인원·요일을 바꿔 가장 높은 예상이익과 손익분기점을 비교합니다.</p></div><span class="analytics-badge">Scenario planner</span></div>
      <div class="ops-planner-controls">
        <div class="field"><label>메뉴</label><select id="planMenu"></select></div>
        <div class="field"><label>예상 수강생</label><input id="planPeople" type="number" min="1" value="4"></div>
        <div class="field"><label>수강료/인</label><input id="planFee" type="number" value="60000"></div>
        <div class="field"><label>요일 기준</label><select id="planDay"><option value="weekday">평일</option><option value="sat">토요일</option></select></div>
        <div class="field"><label>배합수</label><input id="planBatch" type="number" min=".25" step=".25" value="1"></div>
        <div class="field"><label>기타비용</label><input id="planExtra" type="number" value="0"></div>
      </div>
      <div id="planMetrics" class="ops-profit-grid"></div>
      <div class="ops-planner-grid">
        <div><h3>메뉴별 예상 수익성</h3><div id="planRanking"></div></div>
        <div><h3>인원별 이익 시나리오</h3><div id="planMatrix" class="tablewrap"></div></div>
      </div>
      <div id="planAdvice" class="ops-plan-advice"></div>`;
    const anchor=byId('financeKpis');
    if(anchor) anchor.insertAdjacentElement('afterend',box); else page.appendChild(box);
    ['planMenu','planPeople','planFee','planDay','planBatch','planExtra'].forEach(id=>byId(id)?.addEventListener('input',renderProfitPlanner));
    byId('planDay')?.addEventListener('change',renderProfitPlanner);
    byId('planMenu')?.addEventListener('change',renderProfitPlanner);
  }
  function scenario(rec, people, fee, rent, batch=1, extra=0){
    if(!isCostReady(rec)) return null;
    const material=num(rec.cost)*num(batch), total=material+num(rent)+num(extra), revenue=num(people)*num(fee), profit=revenue-total;
    return {material,total,revenue,profit,margin:revenue?profit/revenue*100:null,roi:total?profit/total*100:null,breakEven:fee>0?Math.ceil(total/fee):null};
  }
  function renderProfitPlanner(){
    ensureProfitPlanner();
    const menu=byId('planMenu'); if(!menu) return;
    const ready=(recipes||[]).filter(isCostReady).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    const before=menu.value;
    menu.innerHTML=ready.map(r=>`<option value="${safe(r.name)}">${safe(r.name)}</option>`).join('');
    if(before && ready.some(r=>r.name===before)) menu.value=before;
    if(!menu.value && ready[0]) menu.value=ready[0].name;
    const people=Math.max(1,num(byId('planPeople').value||4)), fee=num(byId('planFee').value||60000), batch=Math.max(.25,num(byId('planBatch').value||1)), extra=num(byId('planExtra').value), rent=byId('planDay').value==='sat'?num(schedule?.settings?.satRent||90000):num(schedule?.settings?.weekdayRent||81000);
    const rec=ready.find(r=>r.name===menu.value)||ready[0], s=scenario(rec,people,fee,rent,batch,extra);
    byId('planMetrics').innerHTML=s?[
      ['예상 매출',won(s.revenue),`${people}명 × ${won(fee)}`],['총 비용',won(s.total),`재료 ${won(s.material)} + 대관 ${won(rent)}`],['예상이익',won(s.profit),`매출이익률 ${Math.round(s.margin)}%`],['원가 대비 ROI',pct(s.roi),'이익 ÷ 총비용'],['손익분기',`${s.breakEven}명`,`현재 조건 최소 인원`]
    ].map(x=>`<div class="ops-profit-item"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join(''):'<div class="analytics-empty">확정 원가 메뉴가 없습니다.</div>';
    const ranking=ready.map(r=>({r,s:scenario(r,people,fee,rent,batch,extra)})).filter(x=>x.s).sort((a,b)=>b.s.profit-a.s.profit);
    byId('planRanking').innerHTML=ranking.length?`<div class="ops-rank-list">${ranking.slice(0,8).map((x,i)=>`<div class="ops-rank-row"><span class="ops-rank-num">${i+1}</span><div><b>${safe(x.r.name)}</b><small>원가 ${won(x.s.material)} · 손익분기 ${x.s.breakEven}명</small></div><strong>${won(x.s.profit)}<small>마진 ${Math.round(x.s.margin)}%</small></strong></div>`).join('')}</div>`:'<div class="analytics-empty">비교 가능한 메뉴가 없습니다.</div>';
    const top=ranking.slice(0,6);
    const counts=[2,3,4,5];
    byId('planMatrix').innerHTML=top.length?`<table class="ops-matrix"><thead><tr><th>메뉴</th>${counts.map(c=>`<th>${c}명</th>`).join('')}</tr></thead><tbody>${top.map(x=>`<tr><td><b>${safe(x.r.name)}</b></td>${counts.map(c=>{const y=scenario(x.r,c,fee,rent,batch,extra);return `<td class="${y.profit>=0?'positive':'negative'}">${won(y.profit)}<br><small>${Math.round(y.margin)}%</small></td>`}).join('')}</tr>`).join('')}</tbody></table>`:'';
    if(ranking.length){
      const best=ranking[0], weekdayRent=num(schedule?.settings?.weekdayRent||81000), satRent=num(schedule?.settings?.satRent||90000);
      const rentGap=satRent-weekdayRent;
      byId('planAdvice').innerHTML=`<div class="insight"><div class="i-kicker">Best current scenario</div><b>${safe(best.r.name)} · ${people}명 기준 ${won(best.s.profit)}</b><p>현재 입력 조건에서 예상 마진 ${Math.round(best.s.margin)}%, 원가 대비 ROI ${Math.round(best.s.roi)}%입니다.</p></div>
        <div class="insight"><div class="i-kicker">Minimum enrollment</div><b>${safe(rec?.name||'선택 메뉴')}는 최소 ${s?.breakEven??'—'}명</b><p>이 인원 아래에서는 현재 수강료와 비용 구조상 적자가 발생합니다.</p></div>
        <div class="insight"><div class="i-kicker">Rent effect</div><b>토요일은 평일보다 ${won(rentGap)} 비용 증가</b><p>동일 메뉴·인원이라면 그만큼 이익이 낮아지므로 토요일은 추가 모집 또는 가격 조정 기준으로 볼 수 있습니다.</p></div>`;
    } else byId('planAdvice').innerHTML='';
  }

  function renderMarginWidgets(){
    const page=byId('finance'); if(!page) return;
    let box=byId('profitabilitySummary');
    if(!box){
      box=document.createElement('div'); box.id='profitabilitySummary'; box.className='analytics-card ops-embedded-card';
      const planner=byId('profitPlanner');
      if(planner) planner.insertAdjacentElement('afterend',box); else byId('financeKpis')?.insertAdjacentElement('afterend',box);
    }
    const a=byId('periodStart')?.value||'', b=byId('periodEnd')?.value||'';
    const rows=[];
    (history?.records||[]).forEach(h=>{
      if(a&&h.date<a||b&&h.date>b)return;
      const rec=recipeFor(h.menu), material=isCostReady(rec)?num(rec.cost)*num(h.batchCount||1):null, rent=num(h.rent);
      const extra=num(h.packing)+num(h.other), revenue=h.revenue==null?num(h.people)*num(h.fee):num(h.revenue);
      const total=material==null||!rent?null:material+rent+extra, profit=total==null?null:revenue-total;
      rows.push({date:h.date,menu:h.menu||h.classTitle||'메뉴 미정',revenue,total,profit,margin:profit==null||!revenue?null:profit/revenue*100,roi:profit==null||!total?null:profit/total*100});
    });
    (schedule?.rows||[]).forEach(r=>{
      if(a&&r.date<a||b&&r.date>b||r.status==='취소')return;
      const c=classCosts(r); rows.push({date:r.date,menu:r.menu||'메뉴 미정',revenue:c.revenue,total:c.total,profit:c.profit,margin:c.margin,roi:c.roi});
    });
    const known=rows.filter(x=>x.profit!=null), revenue=known.reduce((s,x)=>s+x.revenue,0), cost=known.reduce((s,x)=>s+x.total,0), profit=known.reduce((s,x)=>s+x.profit,0), margin=revenue?profit/revenue*100:null, roi=cost?profit/cost*100:null;
    box.innerHTML=`<div class="analytics-head"><div><h3>원가 대비 수익률</h3><p>원가와 대관료가 모두 확인되는 수업만 집계합니다.</p></div><span class="analytics-badge">Margin & ROI</span></div>
      <div class="ops-payment-kpis"><div><span>분석 가능 수업</span><b>${known.length}/${rows.length}회</b></div><div><span>총 계산 비용</span><b>${won(cost)}</b></div><div><span>계산 이익</span><b>${won(profit)}</b></div><div><span>매출이익률</span><b>${margin==null?'—':Math.round(margin)+'%'}</b></div><div><span>원가 대비 ROI</span><b>${roi==null?'—':Math.round(roi)+'%'}</b></div></div>
      <div class="ops-margin-bars">${known.sort((x,y)=>(y.margin||-999)-(x.margin||-999)).slice(0,8).map(x=>`<div class="viz-row"><div class="viz-name">${safe(x.menu)}</div><div class="viz-track"><div class="viz-fill" style="width:${Math.max(0,Math.min(100,x.margin||0))}%"></div></div><div class="viz-value">${x.margin==null?'—':Math.round(x.margin)+'%'}</div></div>`).join('')||'<div class="analytics-empty">원가와 대관료가 연결된 수업이 없습니다.</div>'}</div>`;
  }

  function installWrappers(){
    try{
      const rs=renderSchedule;
      renderSchedule=function(){ rs(); setTimeout(()=>{decorateSchedule();renderEmbeddedPayment();},0); };
    }catch(e){}
    try{
      const rd=renderDashboard;
      renderDashboard=function(){ rd(); setTimeout(decorateUpcoming,0); };
    }catch(e){}
    try{
      const rf=renderFinance;
      renderFinance=function(){ rf(); setTimeout(()=>{renderProfitPlanner();renderMarginWidgets();},0); };
    }catch(e){}
    try{
      const ra=renderAll;
      renderAll=function(){ ra(); setTimeout(()=>{decorateSchedule();decorateUpcoming();renderEmbeddedPayment();renderProfitPlanner();renderMarginWidgets();},0); };
    }catch(e){}
  }

  ensureModal();
  installGlobalClicks();
  installWrappers();
  ensurePaymentWidget();
  ensureProfitPlanner();
  setTimeout(()=>{decorateSchedule();decorateUpcoming();renderEmbeddedPayment();renderProfitPlanner();renderMarginWidgets();},350);
})();
