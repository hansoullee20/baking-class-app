(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const recipeRows=()=>typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[];
  const scheduleRows=()=>typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[];
  const historyRows=()=>typeof history!=='undefined'&&Array.isArray(history?.records)?history.records:[];
  const financeCtx=source=>({recipes:recipeRows(),schedule:typeof schedule!=='undefined'?schedule:null,source});
  let compareMonth='';
  let menuMetric='profit';

  function seoulNow(){
    try{
      const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const get=t=>p.find(x=>x.type===t)?.value||'';
      return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
    }catch(e){
      const d=new Date(),pad=x=>String(x).padStart(2,'0');
      return{date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};
    }
  }
  function currentMonth(){return seoulNow().date.slice(0,7)}
  function timeOf(r){
    const t=String(r?.time||'').match(/^(\d{1,2})(?::(\d{2}))?/);
    if(t)return`${String(Number(t[1])).padStart(2,'0')}:${String(Number(t[2]||0)).padStart(2,'0')}`;
    const s=String(r?.session||'');
    if(s.includes('저녁')||s.includes('야간')||s.includes('기타'))return'19:00';
    if(s.includes('오후'))return'13:00';
    return'10:00';
  }
  function menuOf(r){return r?.menu||r?.recipeCandidate||r?.classTitle||'메뉴 미정'}
  function statusOf(r){return B.effectiveStatus?B.effectiveStatus(r):(r?.status||'예정')}
  function events(){
    const out=[];
    historyRows().forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    scheduleRows().forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,time:timeOf(r),menu:menuOf(r),status:statusOf(r),raw:r}));
    const rows=B.dedupeEvents?B.dedupeEvents(out):out;
    return rows.filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }
  function record(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source));
    const people=Math.max(0,num(e.raw?.people));
    return{...e,people,fee:num(e.raw?.fee),revenue:num(f.revenue),material:f.material==null?null:num(f.material),rent:num(f.rent),packing:num(f.packing),other:num(f.other),profit:f.profit==null?null:num(f.profit),costable:f.profit!=null};
  }
  function occurred(r){
    if(r.source==='history'||r.status==='완료')return true;
    const now=seoulNow();
    if(r.date<now.date)return true;
    if(r.date>now.date)return false;
    const [h,m]=String(r.time||'10:00').split(':').map(Number);
    const duration=Math.max(.5,num(r.raw?.durationHours||r.raw?.rentalHours||3));
    const [nh,nm]=now.time.split(':').map(Number);
    return nh*60+nm>=h*60+m+duration*60;
  }
  function monthRecords(key){return events().filter(e=>e.date.slice(0,7)===key).map(record)}
  function summarize(recs){
    const s={count:recs.length,people:0,revenue:0,costable:0,costablePeople:0,costableRevenue:0,material:0,rent:0,other:0,profit:0};
    recs.forEach(x=>{
      s.people+=x.people;s.revenue+=x.revenue;
      if(!x.costable)return;
      s.costable++;s.costablePeople+=x.people;s.costableRevenue+=x.revenue;s.material+=x.material||0;s.rent+=x.rent||0;s.other+=(x.packing||0)+(x.other||0);s.profit+=x.profit||0;
    });
    s.cost=s.material+s.rent+s.other;
    s.margin=s.costableRevenue?s.profit/s.costableRevenue*100:null;
    s.avgClassProfit=s.costable?s.profit/s.costable:null;
    s.avgStudentProfit=s.costablePeople?s.profit/s.costablePeople:null;
    return s;
  }
  function shiftMonth(key,delta){
    const [y,m]=String(key).split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));
    return`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function previousMonths(){
    const cur=currentMonth(),dates=events().map(e=>e.date.slice(0,7)).filter(Boolean).sort(),earliest=dates[0]||shiftMonth(cur,-1),out=[];
    for(let k=shiftMonth(cur,-1);k>=earliest;k=shiftMonth(k,-1)){out.push(k);if(out.length>=18)break}
    return out;
  }
  function monthName(k){return`${Number(String(k).slice(5,7))}월`}
  function coverage(s){return s.count?Math.round(s.costable/s.count*100):0}
  function width(v,base){return base>0?Math.max(0,Math.min(100,v/base*100)):0}
  function flowBar(s){
    if(!s.costable||!s.costableRevenue)return'<div class="flow-stack empty"><span>원가 연결 후 비용 구성이 표시됩니다.</span></div>';
    const base=s.costableRevenue,parts={material:width(s.material,base),rent:width(s.rent,base),other:width(s.other,base),profit:s.profit>0?width(s.profit,base):0};
    const used=Math.min(100,parts.material+parts.rent+parts.other+parts.profit),gap=Math.max(0,100-used);
    return`<div class="flow-stack" role="img" aria-label="매출 대비 재료비 대관비 기타비 남는 돈 구성"><i class="material" style="width:${parts.material}%"></i><i class="rent" style="width:${parts.rent}%"></i><i class="other" style="width:${parts.other}%"></i><i class="profit ${s.profit<0?'negative':''}" style="width:${parts.profit}%"></i>${gap?`<i class="gap" style="width:${gap}%"></i>`:''}</div>`;
  }
  function flowLegend(s){return`<div class="flow-legend"><span><i class="material"></i>재료비 ${s.costable?won(s.material):'—'}</span><span><i class="rent"></i>대관비 ${s.costable?won(s.rent):'—'}</span><span><i class="other"></i>포장·기타 ${s.costable?won(s.other):'—'}</span><span><i class="profit"></i>남는 돈 ${s.costable?won(s.profit):'—'}</span></div>`}
  function flowCard(kind,title,subtitle,s){
    const margin=s.costable?pct(s.margin):'—';
    return`<section class="focus-flow-card ${kind}"><div class="focus-flow-head"><div><span>${esc(subtitle)}</span><h3>${esc(title)}</h3></div><div class="focus-flow-badge">원가 연결 ${s.costable}/${s.count}회 · ${coverage(s)}%</div></div><div class="focus-flow-hero"><div><span>남는 금액</span><b>${s.costable?won(s.profit):'계산 대기'}</b><small>${s.costable?`이익률 ${margin}`:'원가가 연결된 수업이 없습니다.'}</small></div><div class="focus-flow-count"><b>${s.count}회</b><span>${s.people}명</span></div></div>${flowBar(s)}${flowLegend(s)}<div class="focus-flow-kpis"><div><span>매출</span><b>${won(s.revenue)}</b></div><div><span>총비용</span><b>${s.costable?won(s.cost):'—'}</b></div><div><span>회당 남음</span><b>${s.costable?won(s.avgClassProfit):'—'}</b></div><div><span>인당 남음</span><b>${s.costable?won(s.avgStudentProfit):'—'}</b></div></div></section>`;
  }
  function changeText(a,b,points=false){
    if(!Number.isFinite(Number(a))||!Number.isFinite(Number(b)))return'비교 불가';
    const d=Number(a)-Number(b),sign=d>0?'+':'';
    return points?`${sign}${Math.round(d)}%p`:`${sign}${won(d)}`;
  }
  function monthSelector(months){
    if(!months.length)return'<div class="month-compare-empty">비교할 과거 월이 없습니다.</div>';
    if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
    return`<div class="month-selector">${months.map((m,i)=>`<button type="button" data-compare-month="${m}" class="${m===compareMonth?'active':''}"><b>${monthName(m)}</b><small>${i===0?'지난달':'이전'}</small></button>`).join('')}</div>`;
  }
  function comparePanel(forecast,months){
    if(!months.length)return'<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>지난달부터 과거 월 순서로 비교합니다.</p></div></div><div class="month-compare-empty">비교할 과거 월이 없습니다.</div></section>';
    if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
    const past=summarize(monthRecords(compareMonth));
    const metrics=[['매출',forecast.revenue,past.revenue,false],['총비용',forecast.costable?forecast.cost:null,past.costable?past.cost:null,false],['남는 금액',forecast.costable?forecast.profit:null,past.costable?past.profit:null,false],['이익률',forecast.margin,past.margin,true]];
    return`<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>지난달부터 한 달씩 오래된 순서입니다. 월을 누르면 즉시 비교합니다.</p></div></div>${monthSelector(months)}<div class="compare-surface"><div class="compare-title"><div><span>이번 달 예상</span><b>${monthName(currentMonth())}</b></div><em>vs</em><div><span>비교 월</span><b>${monthName(compareMonth)}</b></div></div><div class="compare-metrics">${metrics.map(([label,a,b,isPct])=>`<div><span>${label}</span><b>${isPct?pct(a):won(a)}</b><i class="${Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&a-b<0?'down':''}">${changeText(a,b,isPct)}</i><strong>${isPct?pct(b):won(b)}</strong></div>`).join('')}</div><div class="compare-flow-bars"><div><span>${monthName(currentMonth())} 예상</span>${flowBar(forecast)}</div><div><span>${monthName(compareMonth)}</span>${flowBar(past)}</div></div></div></section>`;
  }
  function menuSummary(recs){
    const map=new Map();
    recs.forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,profit:0,costable:0,costableRevenue:0});const m=map.get(x.menu);m.count++;m.people+=x.people;if(x.costable){m.costable++;m.profit+=x.profit;m.costableRevenue+=x.revenue}});
    return[...map.values()].map(m=>({...m,avgClassProfit:m.costable?m.profit/m.costable:null,margin:m.costableRevenue?m.profit/m.costableRevenue*100:null}));
  }
  function menuValue(m){return menuMetric==='margin'?m.margin:menuMetric==='class'?m.avgClassProfit:m.profit}
  function menuPanel(recs){
    const rows=menuSummary(recs).filter(m=>Number.isFinite(Number(menuValue(m)))).sort((a,b)=>menuValue(b)-menuValue(a)).slice(0,5),max=Math.max(1,...rows.map(m=>Math.abs(menuValue(m))));
    const caption=menuMetric==='profit'?'예상 총이익':menuMetric==='class'?'회당 예상이익':'예상 마진';
    const body=rows.length?'<div class="month-menu-list">'+rows.map((m,i)=>{const v=menuValue(m),val=menuMetric==='margin'?pct(v):won(v);return`<div class="month-menu-row"><em>${i+1}</em><div><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 ${m.costable}/${m.count}</small></div><div class="month-menu-track"><i class="${v<0?'negative':''}" style="width:${Math.max(3,Math.abs(v)/max*100)}%"></i></div><strong>${val}</strong></div>`}).join('')+'</div>':'<div class="month-compare-empty">이번 달에 비교 가능한 메뉴 원가가 없습니다.</div>';
    return`<section class="month-menu-card"><div class="ledger-head"><div><h3>이번 달 메뉴 수익성</h3><p>현재 예약까지 포함한 이번 달 예상 기준입니다.</p></div><div class="menu-switch"><button data-fin-menu="profit" class="${menuMetric==='profit'?'active':''}">총이익</button><button data-fin-menu="class" class="${menuMetric==='class'?'active':''}">회당</button><button data-fin-menu="margin" class="${menuMetric==='margin'?'active':''}">마진</button></div></div>${body}<div class="ledger-caption">현재 기준: ${caption}.</div></section>`;
  }
  function classDetails(recs){
    const rows=recs.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    const body=rows.map(x=>`<div class="finance-detail-row"><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 × ${won(x.fee)}</small></div><span>매출 <b>${won(x.revenue)}</b></span><span>재료 <b>${x.material==null?'—':won(x.material)}</b></span><span>대관 <b>${won(x.rent)}</b></span><strong>${x.profit==null?'계산 대기':won(x.profit)}</strong></div>`).join('')||'<div class="month-compare-empty">이번 달 수업이 없습니다.</div>';
    return`<details class="finance-detail-shell"><summary><span>이번 달 수업별 손익 근거</span><small>${rows.length}회 · 필요할 때만 펼치기</small></summary><div class="finance-detail-list">${body}</div></details>`;
  }
  function ensureHost(){
    const page=$('finance');if(!page)return null;
    const head=page.querySelector(':scope > .section-head');
    if(head){head.querySelector('h2')?.replaceChildren(document.createTextNode('재정 · 수익'));head.querySelector('p')?.replaceChildren(document.createTextNode('이번 달 현재 흐름과 월말 예상 흐름을 먼저 보고, 지난달부터 과거 월을 비교합니다.'))}
    page.querySelector(':scope > .period')?.classList.add('finance-legacy-control');
    page.querySelector(':scope > .period-fields')?.classList.add('finance-legacy-control');
    if($('financeKpis')){$('financeKpis').hidden=true;$('financeKpis').style.display='none'}
    const next=$('nextMonthKpis')?.closest('.card');if(next){next.hidden=true;next.style.display='none'}
    [...page.querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim())){card.hidden=true;card.style.display='none'}});
    const audit=$('dataAudit')?.closest('details');if(audit){audit.hidden=true;audit.style.display='none'}
    const ing=$('ingredientGrid')?.closest('details');if(ing){ing.hidden=true;ing.style.display='none'}
    let host=$('financeLedgerDetail');if(!host){host=document.createElement('div');host.id='financeLedgerDetail'}
    host.className='finance-current-workspace';
    if(head?.nextElementSibling!==host)head?.insertAdjacentElement('afterend',host);
    return host;
  }
  function render(){
    const host=ensureHost();if(!host)return;
    const key=currentMonth(),all=monthRecords(key),current=summarize(all.filter(occurred)),forecast=summarize(all),months=previousMonths(),now=seoulNow();
    host.innerHTML=`<div class="finance-focus-intro"><div><span>${monthName(key)} OPERATING FLOW</span><h2>이번 달 돈의 흐름</h2><p>왼쪽은 지금까지 진행 완료된 수업, 오른쪽은 현재 예약을 모두 진행했을 때의 월말 예상입니다.</p></div><div class="finance-asof"><b>${now.date.replaceAll('-','.')} ${now.time}</b><span>Asia/Seoul 기준</span></div></div><div class="finance-focus-grid">${flowCard('current','현재까지',`${monthName(key)} · 완료 수업 기준`,current)}${flowCard('forecast','이번 달 예상',`${monthName(key)} · 현재 예약 포함`,forecast)}</div>${comparePanel(forecast,months)}${menuPanel(all)}${classDetails(all)}<div class="finance-method-note">재료비는 현재 레시피 원가와 배합 규칙, 대관비는 수업별 저장/운영 규칙을 사용합니다. 원가가 연결되지 않은 수업은 남는 금액에 임의로 포함하지 않습니다.</div>`;
  }
  document.addEventListener('click',e=>{const m=e.target.closest('[data-compare-month]');if(m){compareMonth=m.dataset.compareMonth;render();return}const metric=e.target.closest('[data-fin-menu]');if(metric){menuMetric=metric.dataset.finMenu;render();return}if(e.target.closest('[data-page="finance"]'))setTimeout(render,90)},true);
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(render,70);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(render,180);return out}}catch(e){}
  setTimeout(render,1100);
})();