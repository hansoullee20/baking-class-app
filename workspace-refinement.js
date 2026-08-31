(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const validCategories=['빵류','디저트류','케이크류'];
  let activeRecipeCategory='all';
  let popupEnhancing=false;

  function recipeRows(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
  function scheduleRows(){return typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[]}
  function historyRows(){return typeof history!=='undefined'&&Array.isArray(history?.records)?history.records:[]}
  function recipeCategory(r){
    if(validCategories.includes(r?.category))return r.category;
    const name=String(r?.name||'');
    if(/소금빵|깜파뉴|캄파뉴|치아바타|식빵|바게트|브리오슈|빵/.test(name))return'빵류';
    if(/케이크|제누아즈/.test(name))return'케이크류';
    return'디저트류';
  }

  function ensureRecipeCategoryBar(){
    const page=$('recipes'),tools=page?.querySelector('.recipe-tools');if(!page||!tools)return;
    page.querySelectorAll('.recipe-tools .seg[data-filter]').forEach(x=>x.hidden=true);
    if($('recipeCategoryBar'))return;
    const bar=document.createElement('div');bar.id='recipeCategoryBar';bar.className='recipe-category-bar';tools.insertAdjacentElement('afterend',bar);
    bar.addEventListener('click',e=>{const b=e.target.closest('[data-recipe-category]');if(!b)return;activeRecipeCategory=b.dataset.recipeCategory;refreshRecipeCategories()});
    document.addEventListener('click',e=>{if(e.target.closest('.recipe-category-select'))e.stopPropagation()},true);
    document.addEventListener('change',e=>{
      const sel=e.target.closest('.recipe-category-select');if(!sel)return;
      const r=recipeRows().find(x=>x.name===sel.dataset.recipeName);if(!r)return;
      r.category=sel.value;try{mark('recipes')}catch(err){};refreshRecipeCategories();
    });
  }
  function refreshRecipeCategories(){
    ensureRecipeCategoryBar();
    const list=recipeRows(),counts={all:list.length,'빵류':0,'디저트류':0,'케이크류':0};list.forEach(r=>counts[recipeCategory(r)]++);
    const bar=$('recipeCategoryBar');if(bar)bar.innerHTML=[['all','전체'],...validCategories.map(x=>[x,x])].map(([k,label])=>`<button type="button" class="recipe-cat-btn ${activeRecipeCategory===k?'active':''}" data-recipe-category="${k}"><b>${label}</b><span>${counts[k]||0}</span></button>`).join('');
    document.querySelectorAll('#recipeList>details.recipe').forEach(card=>{
      const name=card.querySelector('.rname')?.textContent?.trim()||'',r=list.find(x=>x.name===name),cat=recipeCategory(r||{name});
      card.dataset.recipeCategory=cat;card.hidden=activeRecipeCategory!=='all'&&activeRecipeCategory!==cat;
      const sub=card.querySelector('.rsub');if(sub&&!sub.querySelector('.recipe-cat-badge'))sub.insertAdjacentHTML('afterbegin',`<span class="recipe-cat-badge">${esc(cat)}</span>`);
      const summary=card.querySelector('summary .rsum');if(summary&&!summary.querySelector('.recipe-category-select')){
        const sel=document.createElement('select');sel.className='recipe-category-select';sel.dataset.recipeName=name;sel.setAttribute('aria-label',`${name} 분류`);sel.innerHTML=validCategories.map(x=>`<option ${x===cat?'selected':''}>${x}</option>`).join('');summary.appendChild(sel);
      }
    });
  }

  function enhancePaymentPopup(){
    if(popupEnhancing)return;
    const modal=$('dayOpsModal'),body=$('dayOpsBody');if(!modal?.classList.contains('open')||!body)return;
    const peopleInput=body.querySelector('[data-core="people"]'),fill=body.querySelector('[data-fill-people]');
    const people=Math.max(0,num(peopleInput?.value)),rows=[...body.querySelectorAll('.dayops-person')];
    if(fill&&rows.length<people){popupEnhancing=true;fill.click();setTimeout(()=>{popupEnhancing=false;enhancePaymentPopup()},100);return}
    rows.forEach(row=>{
      const select=row.querySelector('[data-person="paymentStatus"]');if(!select)return;
      let quick=row.querySelector('.quick-paid-check');
      if(!quick){
        quick=document.createElement('label');quick.className='quick-paid-check';quick.innerHTML='<input type="checkbox" data-quick-paid><span>입금완료</span>';row.insertBefore(quick,row.children[2]||null);
      }
      quick.querySelector('input').checked=select.value==='입금완료';
    });
  }
  document.addEventListener('change',e=>{
    const check=e.target.closest('[data-quick-paid]');if(!check)return;
    const row=check.closest('.dayops-person'),select=row?.querySelector('[data-person="paymentStatus"]');if(!select)return;
    select.value=check.checked?'입금완료':'미입금';select.dispatchEvent(new Event('change',{bubbles:true}));
  },true);
  const popupObserver=new MutationObserver(()=>setTimeout(enhancePaymentPopup,0));
  document.addEventListener('click',()=>setTimeout(()=>{const body=$('dayOpsBody');if(body&&!body.dataset.refineObserved){popupObserver.observe(body,{childList:true,subtree:true});body.dataset.refineObserved='1'}enhancePaymentPopup()},30),true);

  function eventRows(){
    const out=[];
    historyRows().forEach((r,i)=>out.push({source:'history',id:r.class_id||`h${i}`,date:r.date,status:B.effectiveStatus?B.effectiveStatus(r):(r.status||'완료'),menu:r.menu||r.recipeCandidate||r.classTitle||'메뉴 미정',raw:r}));
    scheduleRows().forEach((r,i)=>out.push({source:'schedule',id:r.class_id||r.id||`s${i}`,date:r.date,status:B.effectiveStatus?B.effectiveStatus(r):(r.status||'예정'),menu:r.menu||r.classTitle||'메뉴 미정',raw:r}));
    return (B.dedupeEvents?B.dedupeEvents(out):out).filter(x=>x.date&&x.status!=='취소');
  }
  function financeCtx(source){return{recipes:recipeRows(),schedule:typeof schedule!=='undefined'?schedule:null,source}}
  function todayISO(){return B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA')}
  function financeRange(){
    const t=todayISO(),a=$('periodStart')?.value||t.slice(0,7)+'-01',b=$('periodEnd')?.value||t;
    return[a,b];
  }
  function rangeRows(){const[a,b]=financeRange();return eventRows().filter(e=>e.date>=a&&e.date<=b)}
  function pastPaymentException(raw){return raw?.paymentComplete===false||raw?.paymentException===true||raw?.paymentHold===true}
  function effectiveCollected(e,f){
    const p=B.payment(e.raw),past=e.date<todayISO();
    if(past&&!pastPaymentException(e.raw))return{collected:f.revenue,outstanding:0,assumed:true};
    return{collected:p.collected,outstanding:p.outstanding,assumed:false};
  }
  function financeRecord(e){
    const f=B.classFinancials(e.raw,financeCtx(e.source)),cash=effectiveCollected(e,f),material=f.material==null?0:num(f.material),rent=num(f.rent),packing=num(f.packing),other=num(f.other),knownSpend=material+rent+packing+other;
    return{...e,f,cash,revenue:num(f.revenue),material,rent,packing,other,knownSpend,profit:f.profit==null?null:num(f.profit),costComplete:f.total!=null,margin:f.profit==null||num(f.revenue)<=0?null:num(f.profit)/num(f.revenue)*100};
  }
  function summarize(rows){
    const recs=rows.map(financeRecord);let revenue=0,collected=0,outstanding=0,material=0,rent=0,packing=0,other=0,knownSpend=0,profit=0,costable=0,costableRevenue=0,assumedPaid=0;
    recs.forEach(x=>{revenue+=x.revenue;collected+=x.cash.collected;outstanding+=x.cash.outstanding;material+=x.material;rent+=x.rent;packing+=x.packing;other+=x.other;knownSpend+=x.knownSpend;if(x.cash.assumed)assumedPaid++;if(x.profit!=null){profit+=x.profit;costable++;costableRevenue+=x.revenue}});
    return{recs,revenue,collected,outstanding,material,rent,packing,other,knownSpend,profit,costable,costableRevenue,count:recs.length,coverage:revenue?costableRevenue/revenue*100:100,margin:costableRevenue?profit/costableRevenue*100:null,assumedPaid};
  }
  function monthKey(date){return String(date).slice(0,7)}
  function lastMonths(count=6){
    const [y,m]=todayISO().split('-').map(Number),out=[];
    for(let i=count-1;i>=0;i--){const d=new Date(Date.UTC(y,m-1-i,1));out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`)}return out;
  }
  function monthlyData(){
    const keys=lastMonths(6),map=Object.fromEntries(keys.map(k=>[k,{month:k,revenue:0,spend:0,profit:0,costableRevenue:0,count:0,costable:0}]));
    eventRows().forEach(e=>{const k=monthKey(e.date);if(!map[k])return;const x=financeRecord(e),m=map[k];m.revenue+=x.revenue;m.spend+=x.knownSpend;m.count++;if(x.profit!=null){m.profit+=x.profit;m.costableRevenue+=x.revenue;m.costable++}});return keys.map(k=>map[k]);
  }
  function moneyShort(v){const n=Math.round(num(v));if(Math.abs(n)>=1000000)return`${(n/1000000).toFixed(n%1000000?1:0)}M`;if(Math.abs(n)>=1000)return`${Math.round(n/1000)}k`;return String(n)}
  function renderOperatingFlow(rows){
    const max=Math.max(1,...rows.flatMap(x=>[Math.abs(x.revenue),Math.abs(x.spend),Math.abs(x.profit)]));
    return `<div class="finance-operating-chart">${rows.map(x=>`<div class="finance-month"><div class="finance-month-bars"><i class="revenue" style="height:${Math.max(2,Math.abs(x.revenue)/max*100)}%" title="매출 ${won(x.revenue)}"></i><i class="spend" style="height:${Math.max(1,Math.abs(x.spend)/max*100)}%" title="확인 운영비 ${won(x.spend)}"></i><i class="profit ${x.profit<0?'negative':''}" style="height:${Math.max(1,Math.abs(x.profit)/max*100)}%" title="계산가능 이익 ${won(x.profit)}"></i></div><b>${Number(x.month.slice(5))}월</b><small>${x.costable?`이익 ${moneyShort(x.profit)}`:'원가 미연결'}</small></div>`).join('')}</div><div class="finance-viz-legend"><span><i class="revenue"></i>매출</span><span><i class="spend"></i>확인 운영비</span><span><i class="profit"></i>계산가능 이익</span></div><div class="finance-chart-note">운영비는 현재 확인 가능한 재료비·대관료·포장비·기타비 기준이며, 이익은 원가가 연결된 수업만 계산합니다.</div>`;
  }
  function renderCostBreakdown(s){
    const rows=[['재료비',s.material,'material'],['대관료',s.rent,'rent'],['포장비',s.packing,'packing'],['기타비',s.other,'other']],total=Math.max(0,rows.reduce((sum,x)=>sum+x[1],0));
    if(total<=0)return'<div class="finance-viz-empty">선택 기간에 확인된 운영비가 없습니다.</div>';
    return `<div class="finance-cost-bars">${rows.map(([label,value,kind])=>{const pct=total?value/total*100:0;return`<div class="finance-cost-row"><div><span>${label}</span><b>${won(value)}</b></div><div class="finance-cost-track"><i class="${kind}" style="width:${Math.max(value>0?2:0,pct)}%"></i></div><small>${Math.round(pct)}%</small></div>`}).join('')}</div><div class="finance-cost-total"><span>확인된 운영비 합계</span><b>${won(total)}</b></div>`;
  }
  function menuProfit(rows){
    const map=new Map();rows.map(financeRecord).forEach(x=>{if(!map.has(x.menu))map.set(x.menu,{menu:x.menu,revenue:0,profit:0,count:0,costable:0,costableRevenue:0});const m=map.get(x.menu);m.revenue+=x.revenue;m.count++;if(x.profit!=null){m.profit+=x.profit;m.costable++;m.costableRevenue+=x.revenue}});
    return[...map.values()].filter(x=>x.costable).map(x=>({...x,avgProfit:x.profit/x.costable,margin:x.costableRevenue?x.profit/x.costableRevenue*100:0})).sort((a,b)=>b.profit-a.profit).slice(0,10);
  }
  function renderProfitBars(rows){
    if(!rows.length)return'<div class="finance-viz-empty">계산 가능한 메뉴 이익 데이터가 없습니다.</div>';const max=Math.max(1,...rows.map(x=>Math.abs(x.profit)));
    return `<div class="finance-profit-bars">${rows.map((x,i)=>`<div class="finance-profit-row"><span><em>${i+1}</em>${esc(x.menu)}</span><div><i class="${x.profit<0?'negative':''}" style="width:${Math.max(2,Math.abs(x.profit)/max*100)}%"></i></div><section><b>${won(x.profit)}</b><small>회당 ${won(x.avgProfit)} · 이익률 ${Math.round(x.margin)}%</small></section></div>`).join('')}</div>`;
  }
  function ensureFinanceVisual(){
    const page=$('finance'),period=page?.querySelector('.period-fields');if(!page||!period)return null;
    let host=$('financeVisual');if(!host){host=document.createElement('div');host.id='financeVisual';host.className='finance-visual';period.insertAdjacentElement('afterend',host)}return host;
  }
  function labelFinanceSurface(){
    const page=$('finance');if(!page)return;
    const head=page.querySelector('.section-head');if(head){const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='재정 · 수익';if(p)p.textContent='매출이 어디서 생기고, 비용이 어디에 쓰이며, 어떤 메뉴가 가장 남는지 봅니다.'}
    document.querySelector('.nav [data-page="finance"]')?.replaceChildren(document.createTextNode('재정 · 수익'));
    document.querySelector('.mobile-nav [data-page="finance"]')?.replaceChildren(document.createTextNode('재정'));
  }
  function renderFinanceVisual(){
    const host=ensureFinanceVisual();if(!host)return;labelFinanceSurface();const rows=rangeRows(),s=summarize(rows),months=monthlyData(),profits=menuProfit(rows),margin=s.margin==null?'—':`${Math.round(s.margin)}%`;
    host.innerHTML=`<div class="finance-visual-top"><div><span>선택 기간 매출</span><b>${won(s.revenue)}</b><small>${s.count}회 수업 · 과거는 실적, 미래는 예약 기준</small></div><div><span>확인된 운영비</span><b>${won(s.knownSpend)}</b><small>재료 원가 연결 ${s.costable}/${s.count}회</small></div><div><span>계산가능 이익</span><b>${s.costable?won(s.profit):'계산 보류'}</b><small>원가 연결 매출 ${won(s.costableRevenue)} 기준</small></div><div><span>계산가능 이익률</span><b>${margin}</b><small>원가가 연결된 수업 기준</small></div></div><div class="finance-visual-grid"><section class="finance-viz-card wide"><div class="finance-viz-head"><div><h3>6개월 돈의 흐름</h3><p>매출이 들어오고 운영비가 나간 뒤 얼마가 남는지 봅니다.</p></div></div>${renderOperatingFlow(months)}</section><section class="finance-viz-card"><div class="finance-viz-head"><div><h3>돈이 어디에 쓰였나</h3><p>선택 기간의 확인된 운영비 구성입니다.</p></div></div>${renderCostBreakdown(s)}</section><section class="finance-viz-card wide finance-menu-profit"><div class="finance-viz-head"><div><h3>어떤 메뉴가 가장 돈이 되나</h3><p>총이익 순위와 회당이익·이익률을 같이 봅니다.</p></div></div>${renderProfitBars(profits)}</section></div><div class="finance-assumption-note"><b>입금 처리 기준</b><span>지난 수업은 별도 미입금 표시가 없으면 전액 입금된 것으로 간주합니다. 현재 선택 기간 확인 입금 ${won(s.collected)}${s.outstanding>0?` · 별도 표시된 미수 ${won(s.outstanding)}`:''}.</span></div>`;
    const decision=$('financeDecision');if(decision)decision.hidden=true;if($('financeKpis'))$('financeKpis').hidden=true;const next=$('nextMonthKpis')?.closest('.card');if(next)next.hidden=true;
    [...$('finance').querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim()))card.hidden=true});
    const ing=$('ingredientGrid')?.closest('details');if(ing)ing.hidden=true;const audit=$('dataAudit')?.closest('details');if(audit){audit.open=false;audit.classList.add('finance-secondary-details')}
  }

  try{filter='all'}catch(e){}
  try{const base=renderRecipes;renderRecipes=function(...args){const out=base.apply(this,args);setTimeout(refreshRecipeCategories,0);return out}}catch(e){}
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(renderFinanceVisual,0);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(()=>{refreshRecipeCategories();renderFinanceVisual();enhancePaymentPopup()},100);return out}}catch(e){}
  setTimeout(()=>{ensureRecipeCategoryBar();refreshRecipeCategories();renderFinanceVisual();enhancePaymentPopup()},850);
})();