(function(root,factory){
  const api=factory(root&&root.BakingBusiness);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document&&root.BakingBusiness)api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(B){
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?`${Math.round(Number(v))}%`:'—';
  const hasNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function summarizeRecords(recs){
    const rows=Array.isArray(recs)?recs:[];
    const s={count:rows.length,people:0,revenue:0,collected:0,outstanding:0,fixedCost:0,rent:0,packingOther:0,materialKnown:0,materialKnownCount:0,costable:0,costablePeople:0,costableRevenue:0,costableMaterial:0,costableFixed:0,costableCost:0,costableProfit:0};
    rows.forEach(x=>{
      s.people+=Math.max(0,num(x.people));
      s.revenue+=num(x.revenue);
      s.collected+=num(x.collected);
      s.outstanding+=num(x.outstanding);
      const fixed=num(x.rent)+num(x.packing)+num(x.other);
      s.rent+=num(x.rent);
      s.packingOther+=num(x.packing)+num(x.other);
      s.fixedCost+=fixed;
      if(x.material!=null&&Number.isFinite(Number(x.material))){s.materialKnown+=Number(x.material);s.materialKnownCount++}
      if(!x.costable)return;
      s.costable++;
      s.costablePeople+=Math.max(0,num(x.people));
      s.costableRevenue+=num(x.revenue);
      s.costableMaterial+=num(x.material);
      s.costableFixed+=fixed;
      s.costableProfit+=num(x.profit);
    });
    s.knownCost=s.fixedCost+s.materialKnown;
    s.costableCost=s.costableMaterial+s.costableFixed;
    s.complete=s.count===0||s.costable===s.count;
    s.missingCostCount=Math.max(0,s.count-s.costable);
    s.fullProfit=s.complete?s.costableProfit:null;
    s.fullCost=s.complete?s.revenue-s.fullProfit:null;
    s.margin=s.complete&&s.revenue>0?s.fullProfit/s.revenue*100:null;
    s.partialMargin=s.costableRevenue>0?s.costableProfit/s.costableRevenue*100:null;
    s.avgClassProfit=s.costable?s.costableProfit/s.costable:null;
    s.avgStudentProfit=s.costablePeople?s.costableProfit/s.costablePeople:null;
    return s;
  }

  function install(){
    if(typeof renderFinance!=='function')return;
    const baseRenderFinance=renderFinance;
    const $=id=>document.getElementById(id);
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
      const p=B.payment?B.payment(e.raw):{collected:0,outstanding:0};
      return{...e,people:Math.max(0,num(e.raw?.people)),fee:num(e.raw?.fee),revenue:num(f.revenue),material:f.material==null?null:num(f.material),rent:num(f.rent),packing:num(f.packing),other:num(f.other),profit:f.profit==null?null:num(f.profit),costable:f.profit!=null,collected:num(p.collected),outstanding:num(p.outstanding)};
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
    function coverage(s){return s.count?Math.round(s.costable/s.count*100):100}
    function width(v,base){return base>0?Math.max(0,Math.min(100,v/base*100)):0}
    function flowBar(s){
      if(!s.costable||!s.costableRevenue)return'<div class="flow-stack empty"><span>원가가 확인된 수업이 없습니다.</span></div>';
      const base=s.costableRevenue,parts={material:width(s.costableMaterial,base),rent:width(s.costableFixed,base),profit:s.costableProfit>0?width(s.costableProfit,base):0};
      const used=Math.min(100,parts.material+parts.rent+parts.profit),gap=Math.max(0,100-used);
      return`<div class="flow-stack" role="img" aria-label="원가 확인된 수업의 매출 대비 재료비 고정비 남는 돈 구성"><i class="material" style="width:${parts.material}%"></i><i class="rent" style="width:${parts.rent}%"></i><i class="profit ${s.costableProfit<0?'negative':''}" style="width:${parts.profit}%"></i>${gap?`<i class="gap" style="width:${gap}%"></i>`:''}</div>`;
    }
    function flowLegend(s){
      if(!s.costable)return'<div class="finance-partial-scope">원가 확인 후 수익 구성이 표시됩니다.</div>';
      return`<div class="finance-partial-scope">원가 확인된 ${s.costable}/${s.count}회 · 매출 ${won(s.costableRevenue)} 기준</div><div class="flow-legend"><span><i class="material"></i>재료비 ${won(s.costableMaterial)}</span><span><i class="rent"></i>대관·기타 ${won(s.costableFixed)}</span><span><i class="profit"></i>남는 돈 ${won(s.costableProfit)}</span></div>`;
    }
    function heroState(s){
      if(s.count===0)return{value:won(0),note:'해당 범위에 진행된 수업이 없습니다.'};
      if(s.complete)return{value:won(s.fullProfit),note:`이익률 ${pct(s.margin)}`};
      return{value:'계산 대기',note:`${s.missingCostCount}회 원가 확인 필요 · 확인된 ${s.costable}회 이익 ${won(s.costableProfit)}`};
    }
    function flowCard(kind,title,subtitle,s){
      const hero=heroState(s),knownMaterial=`${won(s.materialKnown)} · ${s.materialKnownCount}/${s.count}회`;
      return`<section class="focus-flow-card ${kind}"><div class="focus-flow-head"><div><span>${esc(subtitle)}</span><h3>${esc(title)}</h3></div><div class="focus-flow-badge">원가 확인 ${s.costable}/${s.count}회${s.count?` · ${coverage(s)}%`:''}</div></div><div class="focus-flow-hero"><div><span>전체 남는 금액</span><b>${hero.value}</b><small>${esc(hero.note)}</small></div><div class="focus-flow-count"><b>${s.count}회</b><span>${s.people}명</span></div></div>${flowBar(s)}${flowLegend(s)}<div class="focus-flow-kpis"><div><span>매출</span><b>${won(s.revenue)}</b></div><div><span>확정 고정비</span><b>${won(s.fixedCost)}</b></div><div><span>재료비 확인</span><b>${knownMaterial}</b></div><div><span>${s.complete?'회당 남음':'확인 회차 남음'}</span><b>${s.complete?won(s.avgClassProfit):(s.costable?won(s.costableProfit):'—')}</b></div></div></section>`;
    }
    function cashStrip(s){return`<div class="finance-cash-strip"><div><span>이번 달 예약매출</span><b>${won(s.revenue)}</b></div><div><span>현재 입금</span><b>${won(s.collected)}</b></div><div><span>미수금</span><b>${won(s.outstanding)}</b></div><div><span>현재 확인된 비용 하한</span><b>${won(s.knownCost)}</b><small>고정비 전체 + 확인된 재료비</small></div></div>`}
    function changeText(a,b,points=false){
      if(!hasNum(a)||!hasNum(b))return'비교 불가';
      const d=Number(a)-Number(b),sign=d>0?'+':'';
      return points?`${sign}${Math.round(d)}%p`:`${sign}${won(d)}`;
    }
    function monthSelector(months){
      if(!months.length)return'<div class="month-compare-empty">비교할 과거 월이 없습니다.</div>';
      if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
      return`<div class="month-selector">${months.map((m,i)=>`<button type="button" data-compare-month="${m}" class="${m===compareMonth?'active':''}"><b>${monthName(m)}</b><small>${i===0?'지난달':'이전'}</small></button>`).join('')}</div>`;
    }
    function comparePanel(forecast,months){
      if(!months.length)return'<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>비교할 과거 월이 없습니다.</p></div></div></section>';
      if(!compareMonth||!months.includes(compareMonth))compareMonth=months[0];
      const past=summarizeRecords(monthRecords(compareMonth));
      const metrics=[['매출',forecast.revenue,past.revenue,false],['전체 비용',forecast.fullCost,past.fullCost,false],['남는 금액',forecast.fullProfit,past.fullProfit,false],['이익률',forecast.margin,past.margin,true]];
      const val=(v,isPct)=>hasNum(v)?(isPct?pct(v):won(v)):'계산 대기';
      return`<section class="month-compare-card"><div class="ledger-head"><div><h3>월 비교</h3><p>전체 원가가 확인된 월끼리만 비용·이익을 비교합니다.</p></div></div>${monthSelector(months)}<div class="compare-surface"><div class="compare-title"><div><span>이번 달 예상</span><b>${monthName(currentMonth())}</b></div><em>vs</em><div><span>비교 월</span><b>${monthName(compareMonth)}</b></div></div><div class="compare-metrics">${metrics.map(([label,a,b,isPct])=>`<div><span>${label}</span><b>${val(a,isPct)}</b><i class="${hasNum(a)&&hasNum(b)&&a-b<0?'down':''}">${changeText(a,b,isPct)}</i><strong>${val(b,isPct)}</strong></div>`).join('')}</div></div></section>`;
    }
    function menuSummary(recs){
      const map=new Map();
      recs.forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,count:0,people:0,profit:0,costable:0,costableRevenue:0});const m=map.get(x.menu);m.count++;m.people+=x.people;if(x.costable){m.costable++;m.profit+=x.profit;m.costableRevenue+=x.revenue}});
      return[...map.values()].map(m=>({...m,avgClassProfit:m.costable?m.profit/m.costable:null,margin:m.costableRevenue?m.profit/m.costableRevenue*100:null}));
    }
    function menuValue(m){return menuMetric==='margin'?m.margin:menuMetric==='class'?m.avgClassProfit:m.profit}
    function menuPanel(recs){
      const rows=menuSummary(recs).filter(m=>m.costable&&hasNum(menuValue(m))).sort((a,b)=>menuValue(b)-menuValue(a)).slice(0,5),max=Math.max(1,...rows.map(m=>Math.abs(menuValue(m))));
      const caption=menuMetric==='profit'?'확인된 회차의 예상 총이익':menuMetric==='class'?'원가 확인된 회차당 예상이익':'원가 확인된 매출 기준 예상 마진';
      const body=rows.length?'<div class="month-menu-list">'+rows.map((m,i)=>{const v=menuValue(m),val=menuMetric==='margin'?pct(v):won(v);return`<div class="month-menu-row"><em>${i+1}</em><div><b>${esc(m.menu)}</b><small>${m.count}회 · ${m.people}명 · 원가 ${m.costable}/${m.count}</small></div><div class="month-menu-track"><i class="${v<0?'negative':''}" style="width:${Math.max(3,Math.abs(v)/max*100)}%"></i></div><strong>${val}</strong></div>`}).join('')+'</div>':'<div class="month-compare-empty">원가가 확인된 메뉴가 없습니다.</div>';
      return`<section class="month-menu-card"><div class="ledger-head"><div><h3>이번 달 메뉴 수익성</h3><p>원가가 확인된 회차만 같은 범위의 매출과 이익으로 비교합니다.</p></div><div class="menu-switch"><button data-fin-menu="profit" class="${menuMetric==='profit'?'active':''}">총이익</button><button data-fin-menu="class" class="${menuMetric==='class'?'active':''}">회당</button><button data-fin-menu="margin" class="${menuMetric==='margin'?'active':''}">마진</button></div></div>${body}<div class="ledger-caption">${caption}</div></section>`;
    }
    function classDetails(recs){
      const rows=recs.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
      const body=rows.map(x=>`<div class="finance-detail-row"><div><time>${esc(x.date)} ${esc(x.time)}</time><b>${esc(x.menu)}</b><small>${x.people}명 × ${won(x.fee)}</small></div><span>매출 <b>${won(x.revenue)}</b></span><span>대관·기타 <b>${won(num(x.rent)+num(x.packing)+num(x.other))}</b></span><span>재료 <b>${x.material==null?'확인 필요':won(x.material)}</b></span><strong>${x.profit==null?'전체 이익 계산 대기':won(x.profit)}</strong></div>`).join('');
      return`<details class="finance-detail-shell"><summary><span>수업별 계산 근거</span><small>${rows.length}회 · 대관비는 원가 미확정 수업도 표시</small></summary><div class="finance-detail-list">${body||'<div class="month-compare-empty">수업이 없습니다.</div>'}</div></details>`;
    }
    function ensureHost(){
      const page=$('finance'),head=page?.querySelector('.section-head');if(!page||!head)return null;
      let host=$('financeLedgerDetail');
      if(!host){host=document.createElement('div');host.id='financeLedgerDetail';host.className='finance-current-workspace';head.insertAdjacentElement('afterend',host)}
      [...page.children].forEach(el=>{if(el!==head&&el!==host)el.classList.add('finance-legacy-control')});
      return host;
    }
    function renderCanonical(){
      const host=ensureHost();if(!host)return;
      const key=currentMonth(),all=monthRecords(key),current=summarizeRecords(all.filter(occurred)),forecast=summarizeRecords(all),months=previousMonths(),now=seoulNow();
      host.innerHTML=`<div class="finance-focus-intro"><div><span>${monthName(key)} OPERATING FLOW</span><h2>이번 달 수익</h2><p>진행된 수업의 이익과 현재 예약 기준 월말 예상은 구분해서 계산합니다.</p></div><div class="finance-asof"><b>${now.date.replaceAll('-','.')} ${now.time}</b><span>Asia/Seoul 기준</span></div></div>${cashStrip(forecast)}<div class="finance-focus-grid">${flowCard('current','지금까지',`${monthName(key)} · 진행 완료 수업`,current)}${flowCard('forecast','월말 예상',`${monthName(key)} · 현재 예약 전체`,forecast)}</div>${comparePanel(forecast,months)}${menuPanel(all)}${classDetails(all)}<div class="finance-method-note">전체 월 이익은 모든 수업의 원가가 확인된 경우에만 표시합니다. 원가가 없는 수업도 대관비·포장·기타처럼 이미 아는 비용에서는 제외하지 않습니다. 일부 회차 이익을 보여줄 때는 반드시 같은 회차의 매출만 분모로 사용합니다.</div>`;
    }
    function canonicalRenderFinance(...args){
      const out=baseRenderFinance.apply(this,args);
      renderCanonical();
      return out;
    }
    renderFinance=canonicalRenderFinance;
    document.addEventListener('click',e=>{
      const month=e.target.closest('[data-compare-month]');if(month){compareMonth=month.dataset.compareMonth;renderCanonical();return}
      const metric=e.target.closest('[data-fin-menu]');if(metric){menuMetric=metric.dataset.finMenu;renderCanonical();return}
      if(e.target.closest('[data-page="finance"]'))requestAnimationFrame(renderCanonical);
    });
    window.BleuFinanceCanonical={render:renderCanonical,summarize:summarizeRecords};
  }

  return{summarizeRecords,install};
});
