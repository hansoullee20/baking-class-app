(() => {
  const B=window.BakingBusiness,D=window.BakingData;
  if(!B)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const list=()=>{try{return Array.isArray(recipes)?recipes:[]}catch(e){return[]}};

  function reviewItems(){
    const rows=list();
    let variance=[];
    try{variance=D?.reconciliation?D.reconciliation(rows,ingredients,5)?.materialVariance||[]:[]}catch(e){}
    const varianceNames=new Set(variance.map(x=>x.name));
    return rows.map(r=>{
      const s=B.costState(r),reasons=[];
      let priority=9;
      if(!s.usable){reasons.push(s.status==='부분원가'?'부분원가 · 완성 원가 확인 필요':'원가 미산정');priority=1}
      else if(s.confidence!=='confirmed'){reasons.push(`${s.status||'조건부'} · 최종 확인 필요`);priority=Math.min(priority,2)}
      if(varianceNames.has(r.name)){reasons.push('재료 합산값과 5% 이상 차이');priority=Math.min(priority,3)}
      if(Array.isArray(r.missing_cost_ingredients)&&r.missing_cost_ingredients.length){reasons.push(`미확정 재료 ${r.missing_cost_ingredients.length}개`);priority=Math.min(priority,1)}
      if(Array.isArray(r.verification_required)&&r.verification_required.length){reasons.push('레시피/단가 검증 항목 있음');priority=Math.min(priority,2)}
      return reasons.length?{recipe:r,state:s,reasons:[...new Set(reasons)],priority}:null;
    }).filter(Boolean).sort((a,b)=>a.priority-b.priority||a.recipe.name.localeCompare(b.recipe.name,'ko'));
  }

  function itemButton(x,compact=false){
    const name=x.recipe.name,status=x.state.status||'확인 필요';
    return `<button type="button" class="cost-review-item${compact?' compact':''}" data-cost-review-recipe="${esc(name)}"><span class="cost-review-main"><b>${esc(name)}</b><small>${esc(x.reasons.join(' · '))}</small></span><span class="cost-review-meta"><strong>${x.state.amount==null?'—':won(x.state.amount)}</strong><em>${esc(status)}</em><i>바로 수정 →</i></span></button>`;
  }

  function renderDashboardQueue(){
    const dashboard=document.getElementById('operationsDashboard');
    if(!dashboard)return;
    const items=reviewItems();
    let host=document.getElementById('costReviewQueue');
    if(!host){host=document.createElement('section');host.id='costReviewQueue';host.className='decision-block cost-review-block';const anchor=dashboard.children[1]||null;dashboard.insertBefore(host,anchor)}
    host.innerHTML=`<div class="decision-head"><div><h3>원가 확인 필요</h3><p>확정 전 레시피와 자동 검증에서 차이가 난 항목입니다. 누르면 바로 수정 위치로 이동합니다.</p></div><span class="confidence ${items.length?'warn':'good'}">${items.length}개</span></div><div class="cost-review-list">${items.length?items.map(x=>itemButton(x)).join(''):'<div class="decision-empty">현재 확인이 필요한 레시피가 없습니다.</div>'}</div>`;
  }

  function renderRecipeQueue(){
    const host=document.querySelector('#recipeDecision .recipe-review-list');
    if(!host)return;
    const items=reviewItems();
    host.classList.add('cost-review-inline');
    host.innerHTML=items.length?`<div class="cost-review-inline-head"><b>원가 확인 필요 ${items.length}개</b><span>항목을 누르면 해당 원가 입력칸으로 이동</span></div>${items.map(x=>itemButton(x,true)).join('')}`:'현재 자동 검증에서 큰 경고가 없습니다.';
  }

  function goRecipes(){
    if(typeof window.nav==='function'){window.nav('recipes');return}
    document.querySelector('[data-page="recipes"]')?.click();
  }
  function openRecipe(name){
    goRecipes();
    const q=document.getElementById('recipeSearch');if(q)q.value=name;
    const all=document.querySelector('[data-filter="all"]');if(all)all.click();else if(typeof window.renderRecipes==='function')window.renderRecipes();
    setTimeout(()=>{
      const cards=[...document.querySelectorAll('#recipeList details.recipe')];
      const card=cards.find(c=>(c.querySelector('.rname')?.textContent||'').trim()===name);
      if(!card)return;
      const cat=card.dataset.recipeCategory;
      if(cat){const tab=[...document.querySelectorAll('[data-three-recipe-category]')].find(b=>b.dataset.threeRecipeCategory===cat);if(tab&&!tab.classList.contains('active'))tab.click()}
      card.hidden=false;card.open=true;
      card.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{const input=[...card.querySelectorAll('[data-rk="cost"]')].find(x=>x.dataset.r===name)||card.querySelector('[data-rk="cost"]');if(input){input.focus({preventScroll:true});input.select?.()}},220);
    },220);
  }

  function refresh(){renderDashboardQueue();renderRecipeQueue()}
  ['renderDashboard','renderRecipes','renderAll'].forEach(name=>{try{const base=window[name];if(typeof base!=='function')return;window[name]=function(...args){const out=base.apply(this,args);setTimeout(refresh,90);return out}}catch(e){}});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-cost-review-recipe]');if(!b)return;e.preventDefault();openRecipe(b.dataset.costReviewRecipe)},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,150)});
  setTimeout(refresh,1100);
})();
