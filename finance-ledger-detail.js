(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const recipesList=()=>typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[];
  const scheduleRows=()=>typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[];
  const historyRows=()=>typeof history!=='undefined'&&Array.isArray(history?.records)?history.records:[];
  const financeCtx=source=>({recipes:recipesList(),schedule:typeof schedule!=='undefined'?schedule:null,source});
  const currentMonth=()=>seoulNow().date.slice(0,7);
  let compareMonth='';
  let menuMetric='profit';

  function seoulNow(){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const get=t=>parts.find(x=>x.type===t)?.value||'';
      return{date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`};
    }catch(e){
      const d=new Date(),pad=x=>String(x).padStart(2,'0');
      return{date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};
    }
  }
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
    return(B.dedupeEvents?B.dedupeEvents(out):out).filter(e=>e.date&&e.status!=='취소').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }
  function record(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source));
    const people=Math.max(0,num(e.raw?.people)),revenue=num(f.revenue),material=f.material==null?null:num(f.material),rent=num(f.rent),packing=num(f.packing),other=num(f.other),profit=f.profit==null?null:num(f.profit);
    return{...e,f,people,revenue,material,rent,packing,other,profit,costable:profit!=null,fee:num(e.raw?.fee)};
  }
  function occurred(e){
    if(e.status==='완료'||e.source==='history')return true;
    const now=seoulNow();
    if(e.date<now.date)return true;
    if(e.date>now.date)return false;
    const [h,m]=String(e.time||'10:00').split(':').map(Number),duration=Math.max(0.5,num(e.raw?.durationHours||e.raw?.rentalHours||3)),end=h*60+m+duration*60;
    const [nh,nm]=now.time.split(':').map(Number);
    return nh*60+nm>=end;
  }
  function monthRecords(key){return events().filter(e=>e.date.slice(0,7)===key).map(record)}
  function summarize(recs){
    const s={count:recs.length,people:0,revenue:0,costable:0,costableRevenue:0,material:0,rent:0,other:0,profit:0};
    recs.forEach(x=>{s.people+=x.people;s.revenue+=x.revenue;if(x.costable){s.costable++;s.costableRevenue+=x.revenue;s.material+=x.material||0;s.rent+=x.rent||0;s.other+=(x.packing||0)+(x.other||0);s.profit+=x.profit||0}});
    s.cost=s.material+s.rent+s.other;s.margin=s.costableRevenue?s.profit/s.costableRevenue*100:null;s.avgClass=s.costable?s.profit/s.costable:null;s.avgStudent=s.people?s.profit/s.people:null;
    return s;
  }
  function previousMonths(){
    const cur=currentMonth(),set=new Set(events().map(e=>e.date.slice(0,7)).filter(k=>k<cur));
    return[...set].sort((a,b)=>b.localeCompare(a));
  }
  function monthName(k){const[y,m]=String(k).split('-');return`${Number(m)}월`}
  function completeRate(s){return s.count?Math.round(s.costable/s.count*100):0}
  function segmentPct(v,base){return base>0?Math.max(0,Math.min(100,v/base*100)):0}
  function flowBar(s){
    if(!s.costable||!s.costableRevenue)return'<div class="flow-stack empty"><span>원가 연결 후 비용 구성이 표시됩니다.</span></div>';
    const base=s.costableRevenue,mat=segmentPct(s.material,base),rent=segmentPct(s.rent,base),other=segmentPct(s.other,base),profit=s.profit>=0?segmentPct(s.profit,base):0,used=Math.min(100,mat+rent+other+profit),gap=Math.max(0,100-used);
    return`<div class="flow-stack" role="img" aria-label="매출 대비 비용과 남는 금액 비율"><i class="material" style="width:${mat}%" title="재료비 ${won(s.material)}"></i><i class="rent" style="width:${rent}%" title="대관비 ${won(s.rent)}"></i><i class="other" style="width:${other}%" title="포장·기타 ${won(s.other)}"></i><i class="profit ${s.profit<0?'negative':''}" style="width:${profit}%" title="남는 돈 ${won(s.profit)}"></i>${gap?`<i class="gap" style="width:${gap}%"></i>`:''}</div>`;
  }
  function flowLegend(s){
    return`<div class="flow-legend"><span><i class="material"></i>재료 ${s.costable?won(s.material):'—'}</span><span><i class="rent"></i>대관 ${s.costable?won(s.rent):'—'}</span><span><i class="other"></i>기타 ${s.costable?won(s.other):'—'}</span><span><i class="profit"></i>남음 ${s.costable?won(s.profit):'—'}</span></div>`;
  }
  function flowCard(kind,title,subtitle,s){
    const margin=s.costable?pct(s.margin):'—',coverage=`원가 연결 ${s.costable}/${s.count}회 · ${completeRate(s)}%`,net=s.costable?won(s.profit):'계산 대기';
    return`<section class="focus-flow-card ${kind}"><div class="focus-flow-head"><div><span>${esc(subtitle)}</span><h3>${esc(title)}</h3></div><div class="focus-flow-badge">${coverage}</div></div><div class="focus-flow-hero"><div><span>남는 금액</span><b>${net}</b><small>${s.costable?`이익률 ${margin}`:'원가가 연결된 수업이 없습니다.'}</small></div><div class="focus-flow-count"><b>${s.count}회</b><span>${s.people}명</span></div></div>${flowBar(s)}${flowLegend(s)}<div class="focus-flow-kpis"><div><span>매출</span><b>${won(s.revenue)}</b></div><div><span>총비용</span><b>${s.costable?won(s.cost):'—'}</b></div><div><span>회당 남음</span><b>${s.costable?won(s.avgClass):'—'}</b></div><div><span>이익률</span><b>${margin}</b></div></div></section>`;
  }
  function changeText(current,previous,isPercent=false){
    if(!Number.isFinite(Number(current))||!Number.isFinite(Number(previous)))return'비교 불가';
    const d=Number(current)-Number(previous),sign=d>0?'+':'';
    return isPercent?`${sign}${Math.round(d)}%p`:`${sign}${won(d)}`;
  }
  function monthSelector(months){
    if(!months.length)return'<div class="month-compare-empty">비교할 과거 월 데이터가 없습니다.</div>';
    if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
    return`<div class="month-selector" aria-label="과거 월 선택">${months.map((m,i)=>`<button type="button" data-compare-month="${m}" class="${m===compareMonth?'active':''}"><b>${monthName(m)}</b><small>${i===0?'지난달':'이전'}</small></button>`).join('')}</div>`;
  }
  function comparePanel(currentForecast,months){
    if(!months.length)return`<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>지난달부터 과거순으로 확인합니다.</p></div></div><div class="month-compare-empty">비교할 과거 월 데이터가 없습니다.</div></section>`;
    if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
    const past=summarize(monthRecords(compareMonth));
    const cur=currentForecast;
    const curCost=cur.costable?cur.cost:null,pastCost=past.costable?past.cost:null,curProfit=cur.costable?cur.profit:null,pastProfit=past.costable?past.profit:null;
    return`<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>지난달부터 오래된 달 순서입니다. 누르면 바로 비교값이 바뀝니다.</p></div></div>${monthSelector(months)}<div class="compare-surface"><div class="compare-title"><div><span>이번 달 예상</span><b>${monthName(currentMonth())}</b></div><em>vs</em><div><span>비교 월</span><b>${monthName(compareMonth)}</b></div></div><div class="compare-metrics"><div><span>매출</span><b>${won(cur.revenue)}</b><i>${changeText(cur.revenue,past.revenue)}</i><strong>${won(past.revenue)}</strong></div><div><span>총비용</span><b>${curCost==null?'—':won(curCost)}</b><i>${curCost==null||pastCost==null?'비교 불가':changeText(curCost,pastCost)}</i><strong>${pastCost==null?'—':won(pastCost)}</strong></div><div><span>남는 금액</span><b>${curProfit==null?'—':won(curProfit)}</b><i class="${curProfit!=null&&pastProfit!=null&&curProfit-pastProfit<0?'down':''}">${curProfit==null||pastProfit==null?'비교 불가':changeText(curProfit,pastProfit)}</i><strong>${pastProfit==null?'—':won(pastProfit)}</strong></div><div><span>이익률</span><b>${pct(cur.margin)}</b><i>${cur.margin==null||past.margin==null?'비교 불가':changeText(cur.margin,past.margin,true)}</i><strong>${pct(past.margin)}</strong></div></div><div class="compare-flow-bars"><div><span>${monthName(currentMonth())} 예상</span>${flowBar(cur)}</div><div><span>${monthName(compareMonth)}</span>${flowBar(past)}</div></div></div></section>`;
  }
  function menuSummary(recs){
    const map=new Map();
    recs.forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,revenue:0,profit:0,costable:0,costableRevenue:0});const m=map.get(x.menu);m.count++;m.people+=x.people;m.revenue+=x.revenue;if(x.costable){m.costable++;m.profit+=x.profit;m.costableRevenue+=x.revenue}});
    return[...map.values()].map(m=>({...m,margin:m.costableRevenue?m.profit/m.costableRevenue*100:null,avg:m.costable?m.profit/m.costable:null}));
  }
  function menuValue(m){return menuMetric==='margin'?m.margin:menuMetric==='class'?m.avg:m.profit}
  function menuPanel(recs){
    const rows=menuSummary(recs).filter(m=>Number.isFinite(Number(menuValue(m)))).sort((a,b)=>menuValue(b)-menuValue(a)).slice(0,5),max=Math.max(1,...rows.map(m=>Math.abs(menuValue(m)));
    const caption=menuMetric==='profit'?'예상 총이익':menuMetric==='class'?'회당 예상이익':'예상 마진';
    return`<section class="month-menu-card"><div class="ledger-head"><div><h3>이번 달 메뉴 수익성</h3><p>이번 달 예약까지 포함한 예상 기준입니다.</p></div><div class="menu-switch"><button data-fin-menu="profit" class="${menuMetric==='profit'?'active':''}">총이익</button><button data-fin-menu="class" class="${menuMetric==='class'?'active':''}">회당</button><button data-fin-menu="margin" class="${menuMetric==='margin'?'active':''}">마진</button></div></div>${rows.length?`<div class="month-menu-list">${rows.map((m,i)=>{const v=menuValue(m),value=menuMetric==='margin'?pct(v):won(v);return`<div class="month-menu-row"><em>${i+1}</em><div><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 ${m.costable}/${m.count}</small></div><div class="month-menu-track"><i class="${v<0?'negative':''}" style="width:${Math.max(3,Math.abs(v)/max*100)}%"></i></div><strong>${value}</strong></div>`}).join('')}</div>`:'<div class="month-compare-empty">이번 달에 비교 가능한 메뉴 원가가 없습니다.</div>`}<div class="ledger-caption">현재 기준: ${caption}.</div></section>`;
  }
  function classDetails(recs){
    const rows=recs.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    return`<details class="finance-detail-shell"><summary><span>이번 달 수업별 손익 근거</span><small>${rows.length}회 · 필요할 때만 펼치기</small></summary><div class="finance-detail-list">${rows.map(x=>`<div class="finance-detail-row"><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 × ${won(x.fee)}</small></div><span>매출 <b>${won(x.revenue)}</b></span><span>재료 <b>${x.material==null?'—':won(x.material)}</b></span><span>대관 <b>${won(x.rent)}</b></span><strong>${x.profit==null?'계산 대기':won(x.profit)}</strong></div>`).join('')||'<div class="month-compare-empty">이번 달 수업이 없습니다.</div>'}</div></details>`;
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
    const month=currentMonth(),all=monthRecords(month),actual=all.filter(occurred),current=summarize(actual),forecast=summarize(all),months=previousMonths();
    const now=seoulNow();
    host.innerHTML=`<div class="finance-focus-intro"><div><span>${monthName(month)} OPERATING FLOW</span><h2>이번 달 돈의 흐름</h2><p>왼쪽은 지금까지 완료된 수업, 오른쪽은 현재 예약을 모두 진행했을 때의 월말 예상입니다.</p></div><div class="finance-asof"><b>${now.date.replaceAll('-','.')} ${now.time}</b><span>Asia/Seoul 기준</span></div></div><div class="finance-focus-grid">${flowCard('current','현재까지',`${monthName(month)} · 완료된 수업 기준`,current)}${flowCard('forecast','이번 달 예상',`${monthName(month)} · 현재 예약 포함`,forecast)}</div>${comparePanel(forecast,months)}${menuPanel(all)}${classDetails(all)}<div class="finance-method-note">재료비는 현재 레시피 원가와 배합 규칙, 대관비는 수업별 저장/운영 규칙을 사용합니다. 원가가 연결되지 않은 수업은 남는 금액에 억지로 포함하지 않습니다.</div>`;
  }
  document.addEventListener('click',e=>{
    const month=e.target.closest('[data-compare-month]');if(month){compareMonth=month.dataset.compareMonth;render();return}
    const metric=e.target.closest('[data-fin-menu]');if(metric){menuMetric=metric.dataset.finMenu;render();return}
    const nav=e.target.closest('[data-page="finance"]');if(nav)setTimeout(render,90);
  },true);
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(render,70);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(render,180);return out}}catch(e){}
  setTimeout(render,1100);
})();