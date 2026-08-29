(() => {
  const pfNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const pfMoney = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const pfEsc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pfPct = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';

  function costReady(r){
    return !!r && r.cost != null && !['부분원가','미산정'].includes(r.cost_status);
  }
  function findRecipe(raw){
    const names = [raw?.menu, raw?.recipeCandidate].filter(Boolean);
    for (const name of names){
      const hit = (recipes || []).find(r => r.name === name);
      if (hit) return hit;
    }
    return null;
  }
  function defaultRent(date){
    const s = schedule?.settings || {};
    try { return dow(date) === '토' ? pfNum(s.satRent || 90000) : pfNum(s.weekdayRent || 81000); }
    catch(e){ return 81000; }
  }
  function calcAny(raw, source){
    const revenue = raw?.status === '취소' ? 0 : (raw?.revenue != null ? pfNum(raw.revenue) : pfNum(raw?.people) * pfNum(raw?.fee));
    const rec = findRecipe(raw);
    const material = costReady(rec) ? pfNum(rec.cost) * pfNum(raw?.batchCount || 1) : null;
    const rent = raw?.rent !== '' && raw?.rent != null ? pfNum(raw.rent) : defaultRent(raw?.date);
    const packing = pfNum(raw?.packing);
    const other = pfNum(raw?.other);
    const total = material == null ? null : material + rent + packing + other;
    let profit = total == null ? null : revenue - total;
    if (raw?.actualProfit !== '' && raw?.actualProfit != null && Number.isFinite(Number(raw.actualProfit))) profit = Number(raw.actualProfit);
    const margin = profit == null || revenue <= 0 ? null : profit / revenue * 100;
    const roi = profit == null || total == null || total <= 0 ? null : profit / total * 100;
    let reason = '';
    if (!rec) reason = raw?.recipeCandidate ? `레시피 후보 '${raw.recipeCandidate}' 미등록` : '레시피 미연결';
    else if (!costReady(rec)) reason = `${rec.cost_status || '원가'} · 원가 확정 필요`;
    return {source, rec, revenue, material, rent, packing, other, total, profit, margin, roi, reason};
  }
  function allPeriodRows(a,b){
    const out=[];
    (history?.records || []).forEach((r,i)=>{
      if(!r.date || r.date<a || r.date>b || r.status==='취소') return;
      out.push({date:r.date, source:'history', menu:r.menu || r.classTitle || '메뉴 미정', people:pfNum(r.people), raw:r, calc:calcAny(r,'history')});
    });
    (schedule?.rows || []).forEach((r,i)=>{
      if(!r.date || r.date<a || r.date>b || r.status==='취소') return;
      out.push({date:r.date, source:'schedule', menu:r.menu || r.classTitle || '메뉴 미정', people:pfNum(r.people), raw:r, calc:calcAny(r,'schedule')});
    });
    return out.sort((x,y)=>x.date.localeCompare(y.date));
  }

  function repairDashboardProfit(){
    const box=document.getElementById('kpis');
    if(!box) return;
    const a=monthStart(today()), b=monthEnd(a), rows=allPeriodRows(a,b);
    const ready=rows.filter(x=>x.calc.profit!=null);
    const total=ready.reduce((s,x)=>s+x.calc.profit,0);
    const kpis=box.querySelectorAll('.kpi');
    if(kpis.length<4) return;
    const k=kpis[3], bEl=k.querySelector('b'), sEl=k.querySelector('span');
    if(bEl) bEl.textContent = ready.length ? pfMoney(total) : '원가 입력 필요';
    if(sEl) sEl.textContent = ready.length ? `계산 이익 · ${ready.length}/${rows.length}회` : '계산가능 이익';
    k.title = rows.length===ready.length ? '선택된 월의 모든 수업 원가가 연결되어 있습니다.' : `원가 미연결 ${Math.max(0,rows.length-ready.length)}회는 합계에서 제외`;
  }

  function repairFinance(){
    const start=document.getElementById('periodStart'), end=document.getElementById('periodEnd');
    const a=start?.value || monthStart(today()), b=end?.value || monthEnd(today());
    const rows=allPeriodRows(a,b);
    const totalRevenue=rows.reduce((s,x)=>s+x.calc.revenue,0);
    const completedRevenue=rows.reduce((s,x)=>s+((x.source==='history'||x.raw.status==='완료')?x.calc.revenue:0),0);
    const plannedRevenue=rows.reduce((s,x)=>s+(x.source==='schedule'&&x.raw.status!=='완료'?x.calc.revenue:0),0);
    const ready=rows.filter(x=>x.calc.profit!=null);
    const totalProfit=ready.reduce((s,x)=>s+x.calc.profit,0);
    const totalCost=ready.reduce((s,x)=>s+(x.calc.total||0),0);
    const readyRevenue=ready.reduce((s,x)=>s+x.calc.revenue,0);
    const margin=readyRevenue>0?totalProfit/readyRevenue*100:null;

    const kpi=document.getElementById('financeKpis');
    if(kpi){
      kpi.innerHTML=[
        ['총 수입',pfMoney(totalRevenue)],
        ['완료 수입',pfMoney(completedRevenue)],
        ['예정 수입',pfMoney(plannedRevenue)],
        ['계산 이익',ready.length?pfMoney(totalProfit):'원가 입력 필요']
      ].map((x,i)=>`<div class="kpi"><b>${x[1]}</b><span>${i===3&&ready.length?`${x[0]} · ${ready.length}/${rows.length}회 · 마진 ${pfPct(margin)}`:x[0]}</span></div>`).join('');
    }

    const by={};
    rows.forEach(x=>{
      const key=x.menu||'메뉴 미정';
      if(!by[key]) by[key]={menu:key,count:0,people:0,revenue:0,profit:0,ready:0,total:0,reasons:new Set(),statuses:new Set()};
      const g=by[key]; g.count++; g.people+=x.people; g.revenue+=x.calc.revenue;
      if(x.calc.profit!=null){g.profit+=x.calc.profit;g.ready++;g.total+=x.calc.total||0;}
      else if(x.calc.reason) g.reasons.add(x.calc.reason);
      if(x.calc.rec) g.statuses.add(x.calc.rec.cost_status||'원가');
    });
    const menuBody=document.getElementById('menuFinance');
    if(menuBody){
      menuBody.innerHTML=Object.values(by).sort((x,y)=>y.revenue-x.revenue).map(g=>{
        const gm=g.ready&&g.revenue?g.profit/g.revenue*100:null;
        const status=g.ready===g.count?([...g.statuses].join(', ')||'계산 가능'):(g.ready?`부분 계산 ${g.ready}/${g.count}`:[...g.reasons].join(', ')||'원가 필요');
        return `<tr><td><b>${pfEsc(g.menu)}</b></td><td>${g.count}회</td><td>${g.people}명</td><td>${pfMoney(g.revenue)}</td><td>${pfEsc(status)}</td><td>${g.ready?`${pfMoney(g.profit)} · ${pfPct(gm)}`:'원가 입력 필요'}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">데이터 없음</td></tr>';
    }

    const sessionBody=document.getElementById('sessionFinance');
    if(sessionBody){
      sessionBody.innerHTML=rows.slice().sort((x,y)=>y.date.localeCompare(x.date)).map(x=>{
        const c=x.calc;
        const label=c.profit!=null ? `이익 ${pfMoney(c.profit)} · 마진 ${pfPct(c.margin)} · ROI ${pfPct(c.roi)}` : c.reason || '원가 입력 필요';
        return `<tr><td>${pfEsc(x.date)}</td><td>${x.source==='history'?'완료기록':'일정'}</td><td>${pfEsc(x.menu)}</td><td>${x.people}명</td><td>${pfMoney(c.revenue)}</td><td>${pfEsc(label)}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty">데이터 없음</td></tr>';
    }

    let note=document.getElementById('profitCoverageNote');
    const anchor=document.getElementById('financeKpis');
    if(anchor){
      if(!note){note=document.createElement('div');note.id='profitCoverageNote';note.style.cssText='font-size:10px;color:var(--muted);margin:7px 2px 1px;line-height:1.45';anchor.insertAdjacentElement('afterend',note);}
      const missing=rows.filter(x=>x.calc.profit==null);
      note.textContent=missing.length ? `수익 계산 완료 ${ready.length}/${rows.length}회 · 원가 미연결 ${missing.length}회는 이익 합계에서 제외됩니다. 기존처럼 전체를 “보류” 처리하지 않습니다.` : `선택 기간 ${rows.length}회 모두 수익 계산 완료 · 총비용 ${pfMoney(totalCost)}`;
    }
  }

  try{
    const oldDashboard=renderDashboard;
    renderDashboard=function(){oldDashboard();repairDashboardProfit();};
  }catch(e){}
  try{
    const oldFinance=renderFinance;
    renderFinance=function(){oldFinance();repairFinance();};
  }catch(e){}
  try{
    const oldAll=renderAll;
    renderAll=function(){oldAll();setTimeout(()=>{repairDashboardProfit();repairFinance();},0);};
  }catch(e){}

  setTimeout(()=>{try{repairDashboardProfit();repairFinance();}catch(e){}},450);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>{try{repairDashboardProfit();repairFinance();}catch(e){}},120)});
})();
