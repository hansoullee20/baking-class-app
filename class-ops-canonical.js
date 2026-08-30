(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  let activeIndex=null;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'%':'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const todayISO=()=>{try{return today()}catch(e){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}};
  const ctx=()=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source:'schedule'});
  const row=()=>activeIndex==null?null:schedule?.rows?.[activeIndex]||null;

  function normalizeParticipants(r){
    if(!Array.isArray(r.participants))r.participants=[];
    r.participants.forEach((p,i)=>{
      if(!p.id)p.id=`p-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`;
      if(p.name==null)p.name='';if(!p.paymentStatus)p.paymentStatus='미입금';if(p.amountDue==null)p.amountDue=num(r.fee);if(p.amountPaid==null)p.amountPaid=0;if(p.paidAt==null)p.paidAt='';if(p.memo==null)p.memo='';
    });
  }
  const due=(p,r)=>p.amountDue==null||p.amountDue===''?num(r.fee):num(p.amountDue);
  function syncCompletion(r){
    normalizeParticipants(r);const list=r.participants;if(!list.length){r.paymentComplete=false;return}
    const complete=list.every(p=>p.paymentStatus==='입금완료'&&num(p.amountPaid)>=due(p,r));
    r.paymentComplete=complete;
    if(complete){r.paymentCompletedAt=r.paymentCompletedAt||todayISO();r.paymentCompletedAmount=list.reduce((s,p)=>s+num(p.amountPaid),0)}
    else{r.paymentCompletedAt='';r.paymentCompletedAmount=0}
  }

  function ensureModal(){
    if($('classOpsModal'))return;
    const el=document.createElement('div');el.id='classOpsModal';el.className='ops-modal';el.setAttribute('aria-hidden','true');
    el.innerHTML=`<div class="ops-backdrop" data-ops-close></div><div class="ops-dialog" role="dialog" aria-modal="true"><div class="ops-dialog-head"><div><div class="ops-kicker">CLASS DETAIL · PAYMENT</div><h2 id="opsTitle">수업 상세</h2><p id="opsSubtitle"></p></div><button class="ops-icon-btn" type="button" data-ops-close>×</button></div><div id="opsMetrics" class="ops-metrics"></div><div class="ops-section-head"><div><h3>참가자 · 입금 관리</h3><p>참가자별 결제 상태와 입금액을 기록합니다.</p></div><div class="ops-actions"><button class="btn ghost small" id="opsFillSeats" type="button">수강생 수만큼 만들기</button><button class="btn small" id="opsAddParticipant" type="button">+ 참가자</button></div></div><div id="opsRoster" class="ops-roster"></div><div id="opsPaymentSummary" class="ops-payment-summary"></div><div class="ops-section-head ops-profit-head"><div><h3>이 수업 수익성</h3><p>모든 금액은 canonical business engine 기준입니다.</p></div></div><div id="opsProfit" class="ops-profit-grid"></div><div class="ops-modal-foot"><span>변경 내용은 기존 GitHub 자동저장으로 반영됩니다.</span><button class="btn secondary" type="button" data-ops-close>닫기</button></div></div>`;
    document.body.appendChild(el);
    $('opsAddParticipant').addEventListener('click',addParticipant);$('opsFillSeats').addEventListener('click',fillParticipants);
    el.addEventListener('click',e=>{if(e.target.closest('[data-ops-close]'))close();const d=e.target.closest('[data-participant-delete]');if(d){const r=row();if(!r)return;normalizeParticipants(r);r.participants.splice(Number(d.dataset.participantDelete),1);syncCompletion(r);saveAndRender()}});
    el.addEventListener('change',handleChange);el.addEventListener('input',handleText);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el.classList.contains('open'))close()});
  }

  function open(index){
    if(!schedule?.rows?.[index])return;activeIndex=Number(index);const r=row();normalizeParticipants(r);ensureModal();renderModal();const m=$('classOpsModal');m.classList.add('open');m.setAttribute('aria-hidden','false');document.body.classList.add('ops-modal-open');
  }
  function close(){
    const m=$('classOpsModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}document.body.classList.remove('ops-modal-open');activeIndex=null;try{renderSchedule();renderDashboard();renderFinance()}catch(e){}setTimeout(decorateSchedule,40);
  }
  function addParticipant(){const r=row();if(!r)return;normalizeParticipants(r);r.participants.push({id:`p-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});syncCompletion(r);saveAndRender()}
  function fillParticipants(){const r=row();if(!r)return;normalizeParticipants(r);while(r.participants.length<num(r.people))r.participants.push({id:`p-${Date.now()}-${r.participants.length}`,name:'',paymentStatus:'미입금',amountDue:num(r.fee),amountPaid:0,paidAt:'',memo:''});syncCompletion(r);saveAndRender()}
  function saveAndRender(){try{mark('schedule')}catch(e){}renderModal();decorateSchedule();try{renderDashboard();renderFinance()}catch(e){}}

  function handleText(e){const el=e.target.closest('[data-participant-field="name"],[data-participant-field="memo"]');if(!el)return;const r=row();if(!r)return;normalizeParticipants(r);const p=r.participants[Number(el.dataset.pi)];if(!p)return;p[el.dataset.participantField]=el.value;try{mark('schedule')}catch(err){}}
  function handleChange(e){
    const el=e.target.closest('[data-participant-field]');if(!el)return;const r=row();if(!r)return;normalizeParticipants(r);const p=r.participants[Number(el.dataset.pi)];if(!p)return;const key=el.dataset.participantField;let v=el.value;if(['amountDue','amountPaid'].includes(key))v=v===''?'':Number(v);p[key]=v;
    if(key==='paymentStatus'){if(v==='입금완료'){p.amountPaid=due(p,r);p.paidAt=p.paidAt||todayISO()}else if(v==='미입금'){p.amountPaid=0;p.paidAt=''}}
    if(key==='amountPaid'){const d=due(p,r),paid=num(v);p.paymentStatus=paid>=d&&d>0?'입금완료':paid>0?'부분입금':'미입금';if(p.paymentStatus==='입금완료')p.paidAt=p.paidAt||todayISO();if(p.paymentStatus==='미입금')p.paidAt=''}
    syncCompletion(r);saveAndRender();
  }

  function renderModal(){
    const r=row();if(!r||!$('classOpsModal'))return;normalizeParticipants(r);const p=B.payment(r),f=B.classFinancials(r,ctx());
    $('opsTitle').textContent=r.menu||r.classTitle||'메뉴 미정';$('opsSubtitle').textContent=`${r.date||''} · ${r.time||r.session||''} · ${num(r.people)}명 · ${won(r.fee)}/인`;
    $('opsMetrics').innerHTML=[['수강생',`${num(r.people)}명`,r.capacity?`정원 ${num(r.capacity)}명`:'현재 일정'],['입금액',won(p.collected),`예정 ${won(p.expected)}`],['미수금',won(p.outstanding),`입금률 ${pct(p.rate)}`],[f.profitLabel,f.profit==null?'계산 보류':won(f.profit),f.margin==null?'원가 미확정':`${f.confidence==='estimated'?'조건부 · ':''}마진 ${pct(f.margin)}`]].map(x=>`<div class="ops-metric"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
    $('opsRoster').innerHTML=r.participants.length?r.participants.map((x,i)=>`<div class="ops-person"><div class="ops-person-index">${i+1}</div><div class="field"><label>이름</label><input data-pi="${i}" data-participant-field="name" value="${esc(x.name)}" placeholder="참가자 이름"></div><div class="field"><label>입금 상태</label><select data-pi="${i}" data-participant-field="paymentStatus"><option ${x.paymentStatus==='미입금'?'selected':''}>미입금</option><option ${x.paymentStatus==='부분입금'?'selected':''}>부분입금</option><option ${x.paymentStatus==='입금완료'?'selected':''}>입금완료</option></select></div><div class="field"><label>결제 예정액</label><input data-pi="${i}" data-participant-field="amountDue" type="number" value="${due(x,r)}"></div><div class="field"><label>입금액</label><input data-pi="${i}" data-participant-field="amountPaid" type="number" value="${x.amountPaid??0}"></div><div class="field"><label>입금일</label><input data-pi="${i}" data-participant-field="paidAt" type="date" value="${esc(x.paidAt||'')}"></div><div class="field ops-person-memo"><label>메모</label><input data-pi="${i}" data-participant-field="memo" value="${esc(x.memo||'')}"></div><button class="ops-delete" type="button" data-participant-delete="${i}">삭제</button></div>`).join(''):'<div class="empty">등록된 참가자가 없습니다.</div>';
    const list=r.participants,paidCount=list.filter(x=>x.paymentStatus==='입금완료').length,partialCount=list.filter(x=>x.paymentStatus==='부분입금').length,unpaidCount=list.length-paidCount-partialCount;
    $('opsPaymentSummary').innerHTML=`<div><span>입금완료</span><b>${paidCount}명</b></div><div><span>부분입금</span><b>${partialCount}명</b></div><div><span>미입금</span><b>${unpaidCount}명</b></div><div><span>입금률</span><b>${pct(p.rate)}</b></div><div class="ops-payment-bar"><i style="width:${Math.max(0,Math.min(100,p.rate))}%"></i></div>`;
    $('opsProfit').innerHTML=[['수업 매출',won(f.revenue),'수강생 × 수강료'],['재료 원가',f.material==null?'미산정':won(f.material),f.recipe?`${f.costStatus}${f.confidence==='estimated'?' · 조건부':''}`:'레시피 미연결'],['배합수',String(f.batchCount),'수업별 명시값'],['대관료',won(f.rent),'저장값 우선'],['총 비용',f.total==null?'계산 보류':won(f.total),'재료 + 대관 + 추가비용'],[f.profitLabel,f.profit==null?'계산 보류':won(f.profit),f.margin==null?'—':`마진 ${pct(f.margin)}`],['손익분기 인원',f.breakEven==null?'—':`${f.breakEven}명`,'총비용 ÷ 수강료'],['ROI',f.roi==null?'—':pct(f.roi),'이익 ÷ 총비용']].map(x=>`<div class="ops-profit-item"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
  }

  function decorateSchedule(){
    document.querySelectorAll('#scheduleList .schedule').forEach(card=>{const i=Number(card.dataset.i);if(!Number.isFinite(i))return;let btn=card.querySelector('[data-canonical-open]');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='btn ghost small ops-open-class';btn.dataset.canonicalOpen=String(i);btn.textContent='수업 상세 · 입금';const calc=card.querySelector('.calc');(calc||card).appendChild(btn)}const r=schedule?.rows?.[i];if(r){const p=B.payment(r);btn.title=`입금 ${pct(p.rate)} · 미수금 ${won(p.outstanding)}`}})
  }
  document.addEventListener('click',e=>{const direct=e.target.closest('[data-canonical-open]');if(direct){e.preventDefault();open(Number(direct.dataset.canonicalOpen));return}const op=e.target.closest('[data-ops-index]');if(op){e.preventDefault();open(Number(op.dataset.opsIndex))}},true);
  try{const base=renderSchedule;renderSchedule=function(...args){const x=base.apply(this,args);setTimeout(decorateSchedule,30);return x}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const x=base.apply(this,args);setTimeout(decorateSchedule,30);return x}}catch(e){}
  setTimeout(decorateSchedule,600);
})();