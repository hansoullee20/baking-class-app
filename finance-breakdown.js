(() => {
  if (!document.querySelector('script[data-sunny-rent-rule]')) {
    const s=document.createElement('script');
    s.src='./rent-rule.js?v=20260830-rent3';
    s.dataset.sunnyRentRule='1';
    document.head.appendChild(s);
  }
})();

(() => {
  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const pct = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';
  const aliases = {'꾸덕브라우니':'브라우니','크랙소금빵':'소금빵','크랙소금빵 원데이':'소금빵'};

  function recipeFor(raw){
    const names=[raw?.menu,raw?.recipeCandidate,raw?.classTitle].filter(Boolean);
    for(const name of names){
      const direct=(recipes||[]).find(r=>r.name===name); if(direct)return direct;
      const alias=aliases[name]; if(alias){const hit=(recipes||[]).find(r=>r.name===alias);if(hit)return hit;}
    }
    return null;
  }
  function costReady(r){return !!r&&r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)}
  function rentFor(date){const s=schedule?.settings||{};try{const d=dow(date);return (d==='토'||d==='일')?num(s.satRent||90000):num(s.weekdayRent||81000)}catch(e){return num(s.weekdayRent||81000)}}
  function calc(raw){
    const revenue=raw?.status==='취소'?0:(raw?.revenue!=null?num(raw.revenue):num(raw?.people)*num(raw?.fee));
    const rec=recipeFor(raw),material=costReady(rec)?num(rec.cost)*num(raw?.batchCount||1):null;
    const rent=window.sunnyRentalQuote?window.sunnyRentalQuote(raw).total:(raw?.rent!==''&&raw?.rent!=null?num(raw.rent):rentFor(raw?.date)),packing=num(raw?.packing),other=num(raw?.other);
    const total=material==null?null:material+rent+packing+other;
    return {revenue,material,rent,packing,other,total,net:total==null?null:revenue-total};
  }
  function rows(){
    const a=$('periodStart')?.value||'0000-01-01',b=$('periodEnd')?.value||'9999-12-31',out=[];
    (history?.records||[]).forEach(r=>{if(r.date&&r.date>=a&&r.date<=b&&r.status!=='취소')out.push({raw:r,calc:calc(r)})});
    (schedule?.rows||[]).forEach(r=>{if(r.date&&r.date>=a&&r.date<=b&&r.status!=='취소')out.push({raw:r,calc:calc(r)})});
    return out;
  }
  function share(v,total){return total>0?v/total*100:0}
  function install(){
    const kpi=$('financeKpis'); if(!kpi)return null;
    let card=$('financeMoneyFlow');
    if(!card){card=document.createElement('section');card.id='financeMoneyFlow';card.className='finance-money-flow';}
    if(card.previousElementSibling!==kpi)kpi.insertAdjacentElement('afterend',card);
    return card;
  }
  function render(){
    const card=install(); if(!card)return;
    const all=rows(),ready=all.filter(x=>x.calc.total!=null),totalRevenue=all.reduce((s,x)=>s+x.calc.revenue,0);
    const revenue=ready.reduce((s,x)=>s+x.calc.revenue,0),material=ready.reduce((s,x)=>s+x.calc.material,0),rent=ready.reduce((s,x)=>s+x.calc.rent,0),packing=ready.reduce((s,x)=>s+x.calc.packing,0),other=ready.reduce((s,x)=>s+x.calc.other,0),extra=packing+other,totalCost=material+rent+extra,net=revenue-totalCost,margin=revenue?net/revenue*100:null;
    const missingRevenue=Math.max(0,totalRevenue-revenue),positiveNet=Math.max(0,net),loss=Math.max(0,-net);
    const denom=net>=0?Math.max(revenue,1):Math.max(material+rent+extra+loss,1);
    const segments=[['재료비',material,'material'],['대관비',rent,'rent'],['포장·기타',extra,'extra'],[net>=0?'남는 금액':'초과 비용',net>=0?positiveNet:loss,net>=0?'net':'loss']];
    card.innerHTML=`
      <div class="finance-flow-head"><div><h3>돈의 흐름 · 최종 남는 금액</h3><p>매출에서 재료비, 실제 인원·시간 기준 대관비, 포장·기타비를 차감한 운영 잔액입니다.</p></div><div class="finance-flow-coverage">${ready.length}/${all.length}회 계산 기준</div></div>
      <div class="finance-net-hero"><span>최종 남는 금액</span><b>${ready.length?won(net):'원가 입력 필요'}</b><small>${ready.length?`계산대상 매출 ${won(revenue)} · 마진 ${pct(margin)}`:'계산 가능한 수업이 없습니다.'}</small></div>
      <div class="finance-flow-steps">
        <div class="finance-flow-step revenue"><span>계산대상 매출</span><b>${won(revenue)}</b><small>선택 기간 총매출 ${won(totalRevenue)}</small></div>
        <div class="finance-flow-arrow">−</div>
        <div class="finance-flow-step"><span>재료비</span><b>${won(material)}</b><small>${pct(share(material,revenue))}</small></div>
        <div class="finance-flow-arrow">−</div>
        <div class="finance-flow-step"><span>대관비</span><b>${won(rent)}</b><small>${pct(share(rent,revenue))}</small></div>
        <div class="finance-flow-arrow">−</div>
        <div class="finance-flow-step"><span>포장·기타</span><b>${won(extra)}</b><small>${pct(share(extra,revenue))}</small></div>
        <div class="finance-flow-arrow">=</div>
        <div class="finance-flow-step net"><span>남는 금액</span><b>${won(net)}</b><small>${pct(margin)}</small></div>
      </div>
      <div class="finance-stack" role="img" aria-label="계산대상 매출의 비용 구성">
        ${segments.filter(x=>x[1]>0).map(x=>`<i class="${x[2]}" style="width:${Math.max(1,x[1]/denom*100)}%" title="${x[0]} ${won(x[1])}"></i>`).join('')}
      </div>
      <div class="finance-stack-legend">${segments.map(x=>`<div><i class="${x[2]}"></i><span>${x[0]}</span><b>${won(x[1])}</b><small>${pct(share(x[1],revenue))}</small></div>`).join('')}</div>
      <div class="finance-flow-equation"><b>${won(revenue)}</b> 매출 − <b>${won(material)}</b> 재료 − <b>${won(rent)}</b> 대관 − <b>${won(extra)}</b> 포장·기타 = <strong>${won(net)}</strong> 남음</div>
      ${missingRevenue>0?`<div class="finance-flow-note">원가가 아직 연결되지 않은 수업 매출 ${won(missingRevenue)}은 최종 남는 금액 계산에서 제외되어 있습니다.</div>`:''}
      <div class="finance-flow-note subtle">대관 총인원은 당근 모임 표시 인원을 그대로 사용합니다(셰프 1명 포함). 표시 인원이 없는 기록만 실제 수강생+셰프 1명으로 계산합니다. 최소 3시간 · 기본 2인 포함 · 총 3인부터 1인당 10,000원 추가 · 평일 낮 17,000원/h · 평일 저녁 19,000원/h · 주말 20,000원/h.</div>`;
    const summary=$('profitabilitySummary');
    if(summary){
      summary.classList.add('finance-margin-only');
      const h=summary.querySelector('.analytics-head h3'),p=summary.querySelector('.analytics-head p');
      if(h)h.textContent='메뉴별 마진 비교';
      if(p)p.textContent='선택 기간에서 실제로 어떤 메뉴가 더 많이 남는지 비교합니다.';
    }
  }
  function refresh(){try{render()}catch(e){}}
  try{const old=renderFinance;renderFinance=function(){old();setTimeout(refresh,0)}}catch(e){}
  try{const oldAll=renderAll;renderAll=function(){oldAll();setTimeout(refresh,0)}}catch(e){}
  setTimeout(refresh,650);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,120)});
})();
