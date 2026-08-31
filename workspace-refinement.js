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
  function financeRange(){
    const t=B.zonedDate?B.zonedDate(new Date()):new Date().toLocaleDateString('en-CA'),a=$('periodStart')?.value||t.slice(0,7)+'-01',b=$('periodEnd')?.value||t;
    return[a,b];
  }
  function rangeRows(){const[a,b]=financeRange();return eventRows().filter(e=>e.date>=a&&e.date<=b)}
  function summarize(rows){
    let booked=0,collected=0,outstanding=0,profit=0,costable=0,costableRevenue=0;
    rows.forEach(e=>{const f=B.classFinancials(e.raw,financeCtx(e.source)),p=B.payment(e.raw);booked+=f.revenue;collected+=p.collected;outstanding+=p.outstanding;if(f.profit!=null){profit+=f.profit;costable++;costableRevenue+=f.revenue}});
    return{booked,collected,outstanding,profit,costable,costableRevenue,count:rows.length,coverage:booked?costableRevenue/booked*100:100};
  }
  function monthKey(date){return String(date).slice(0,7)}
  function lastMonths(count=6){
    const now=new Date(),out=[];for(let i=count-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}return out;
  }
  function monthlyData(){
    const keys=lastMonths(6),map=Object.fromEntries(keys.map(k=>[k,{month:k,booked:0,collected:0,profit:0,costable:0}]));
    eventRows().forEach(e=>{const k=monthKey(e.date);if(!map[k])return;const f=B.classFinancials(e.raw,financeCtx(e.source)),p=B.payment(e.raw);map[k].booked+=f.revenue;map[k].collected+=p.collected;if(f.profit!=null){map[k].profit+=f.profit;map[k].costable++}});return keys.map(k=>map[k]);
  }
  function moneyShort(v){const n=Math.round(num(v));if(Math.abs(n)>=1000000)return`${(n/1000000).toFixed(n%1000000?1:0)}M`;if(Math.abs(n)>=1000)return`${Math.round(n/1000)}k`;return String(n)}
  function renderMonthlyBars(rows){
    const max=Math.max(1,...rows.flatMap(x=>[x.booked,x.collected]));
    return `<div class="finance-month-chart">${rows.map(x=>`<div class="finance-month"><div class="finance-month-bars"><i class="booked" style="height:${Math.max(2,x.booked/max*100)}%" title="예약/매출 ${won(x.booked)}"></i><i class="collected" style="height:${Math.max(1,x.collected/max*100)}%" title="확인 입금 ${won(x.collected)}"></i></div><b>${Number(x.month.slice(5))}월</b><small>${moneyShort(x.collected)}</small></div>`).join('')}</div><div class="finance-viz-legend"><span><i class="booked"></i>예약/매출</span><span><i class="collected"></i>확인 입금</span></div>`;
  }
  function menuProfit(rows){
    const map=new Map();rows.forEach(e=>{const f=B.classFinancials(e.raw,financeCtx(e.source));if(!map.has(e.menu))map.set(e.menu,{menu:e.menu,profit:0,count:0});const x=map.get(e.menu);if(f.profit!=null){x.profit+=f.profit;x.count++}});return[...map.values()].filter(x=>x.count).sort((a,b)=>b.profit-a.profit).slice(0,8);
  }
  function renderProfitBars(rows){
    if(!rows.length)return'<div class="finance-viz-empty">계산 가능한 메뉴 이익 데이터가 없습니다.</div>';const max=Math.max(1,...rows.map(x=>Math.abs(x.profit)));
    return `<div class="finance-profit-bars">${rows.map(x=>`<div class="finance-profit-row"><span>${esc(x.menu)}</span><div><i class="${x.profit<0?'negative':''}" style="width:${Math.max(2,Math.abs(x.profit)/max*100)}%"></i></div><b>${won(x.profit)}</b></div>`).join('')}</div>`;
  }
  function ensureFinanceVisual(){
    const page=$('finance'),period=page?.querySelector('.period-fields');if(!page||!period)return null;
    let host=$('financeVisual');if(!host){host=document.createElement('div');host.id='financeVisual';host.className='finance-visual';period.insertAdjacentElement('afterend',host)}return host;
  }
  function renderFinanceVisual(){
    const host=ensureFinanceVisual();if(!host)return;const rows=rangeRows(),s=summarize(rows),months=monthlyData(),profits=menuProfit(rows),expected=Math.max(0,s.collected+s.outstanding),paidPct=expected?s.collected/expected*100:0;
    host.innerHTML=`<div class="finance-visual-top"><div><span>선택 기간 확인 입금</span><b>${won(s.collected)}</b><small>예약/매출 ${won(s.booked)}</small></div><div><span>미수금</span><b>${won(s.outstanding)}</b><small>결제 체크 기준</small></div><div><span>계산가능 이익</span><b>${s.costable?won(s.profit):'계산 보류'}</b><small>원가 커버 ${Math.round(s.coverage)}%</small></div></div><div class="finance-visual-grid"><section class="finance-viz-card wide"><div class="finance-viz-head"><div><h3>6개월 매출 · 입금 흐름</h3><p>예약/매출과 실제 확인 입금을 분리해서 봅니다.</p></div></div>${renderMonthlyBars(months)}</section><section class="finance-viz-card"><div class="finance-viz-head"><div><h3>선택 기간 결제 상태</h3><p>참가자 입금 체크가 바로 반영됩니다.</p></div></div><div class="finance-collection"><div class="finance-ring" style="--paid:${Math.max(0,Math.min(100,paidPct))}"><b>${Math.round(paidPct)}%</b><span>입금 확인</span></div><div class="finance-collection-copy"><div><span>확인</span><b>${won(s.collected)}</b></div><div><span>미수</span><b>${won(s.outstanding)}</b></div></div></div></section><section class="finance-viz-card wide"><div class="finance-viz-head"><div><h3>메뉴별 계산가능 이익</h3><p>선택 기간 중 원가가 연결된 수업만 비교합니다.</p></div></div>${renderProfitBars(profits)}</section></div>`;
    const decision=$('financeDecision');if(decision)decision.hidden=true;if($('financeKpis'))$('financeKpis').hidden=true;const next=$('nextMonthKpis')?.closest('.card');if(next)next.hidden=true;
    [...page.querySelectorAll(':scope > .card')].forEach(card=>{const h=card.querySelector(':scope > h3');if(h&&['메뉴별 집계','수업별 내역'].includes(h.textContent.trim()))card.hidden=true});
    const ing=$('ingredientGrid')?.closest('details');if(ing)ing.hidden=true;
  }

  try{filter='all'}catch(e){}
  try{const base=renderRecipes;renderRecipes=function(...args){const out=base.apply(this,args);setTimeout(refreshRecipeCategories,0);return out}}catch(e){}
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(renderFinanceVisual,0);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(()=>{refreshRecipeCategories();renderFinanceVisual();enhancePaymentPopup()},100);return out}}catch(e){}
  setTimeout(()=>{ensureRecipeCategoryBar();refreshRecipeCategories();renderFinanceVisual();enhancePaymentPopup()},850);
})();