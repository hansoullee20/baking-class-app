(() => {
  const B=window.BakingBusiness,D=window.BakingData;
  if(!B)return;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  let rulesLoaded=false,indexLoaded=false,provenanceLoaded=false,overridesLoaded=false,costOverrides={overrides:[],reference_only:[]};
  const context=source=>({recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source});
  const sourceOf=raw=>{try{return(history?.records||[]).includes(raw)?'history':'schedule'}catch(e){return'schedule'}};

  async function jsonFile(path){const f=await get(path);return JSON.parse(dec(f.content))}
  function applyNormalizedIds(){if(!D)return null;try{return D.applyEntityIndex(recipes,ingredients,schedule,history)}catch(e){return null}}
  function applyCostOverlays(){
    const list=costOverrides?.overrides||[],byId=new Map(list.filter(x=>x.recipe_id).map(x=>[x.recipe_id,x])),byName=new Map(list.filter(x=>x.recipe_name).map(x=>[x.recipe_name,x]));
    let applied=0;
    (recipes||[]).forEach(r=>{
      const o=byId.get(r.recipe_id)||byName.get(r.name)||null;
      if(!o||o.apply===false||r.cost!=null){try{if(r.__costOverlay)delete r.__costOverlay}catch(e){};return}
      try{Object.defineProperty(r,'__costOverlay',{value:o,writable:true,configurable:true,enumerable:false});applied++}catch(e){r.__costOverlay=o;applied++}
    });
    return applied;
  }
  async function loadGovernance(){
    if(typeof token==='undefined'||!token||typeof get!=='function'||typeof dec!=='function')return false;
    try{B.setRules(await jsonFile('data/business-rules.json'));rulesLoaded=true}catch(e){rulesLoaded=false;console.warn('Using embedded canonical business rules',e)}
    if(D){
      try{D.setIndex(await jsonFile('data/entity-index.json'));indexLoaded=true}catch(e){indexLoaded=false;console.warn('Entity index unavailable',e)}
      try{D.setProvenance(await jsonFile('data/price-provenance.json'));provenanceLoaded=true}catch(e){provenanceLoaded=false;console.warn('Price provenance unavailable',e)}
    }
    try{costOverrides=await jsonFile('data/cost-overrides.json');overridesLoaded=true}catch(e){costOverrides={overrides:[],reference_only:[]};overridesLoaded=false;console.warn('Cost overrides unavailable',e)}
    applyNormalizedIds();applyCostOverlays();
    return rulesLoaded&&(!D||indexLoaded);
  }

  function installCore(){
    applyNormalizedIds();applyCostOverlays();
    try{recipeOf=name=>B.findRecipeByName(name,recipes)}catch(e){}
    try{finalCost=recipe=>B.costState(recipe).usable}catch(e){}
    try{cv=recipe=>{const c=B.costState(recipe);if(!recipe)return{label:'미산정',amount:null,type:'missing'};if(c.usable)return{label:c.status+(c.source==='overlay'?' · 계산값':''),amount:c.amount,type:'final'};if(recipe.partial_cost!=null)return{label:'부분원가',amount:Number(recipe.partial_cost)||0,type:'partial'};return{label:c.status||'미산정',amount:null,type:'missing'}}}catch(e){}
    try{calc=raw=>{const c=B.classFinancials(raw,context(sourceOf(raw)));return{rev:c.revenue,rec:c.recipe,mat:c.material,profit:c.profit,profitLabel:c.profitLabel,confidence:c.confidence,rent:c.rent,total:c.total,margin:c.margin,roi:c.roi,breakEven:c.breakEven}}}catch(e){}
    try{events=()=>{const map=new Map();(history?.records||[]).forEach((r,i)=>{if(!r?.date)return;const menu=r.menu||r.recipeCandidate||r.classTitle||'수업',key=r.class_id||[r.date,r.time||r.session||'',B.canonicalRecipeName(menu)].join('|');map.set(key,{source:'history',id:r.class_id||r.id||'h'+i,date:r.date,status:r.status||'완료',session:r.time||r.session||'',menu,people:Number(r.people)||0,revenue:B.revenue(r),raw:r})});(schedule?.rows||[]).forEach((r,i)=>{if(!r?.date)return;const menu=r.menu||r.classTitle||'메뉴 미정',key=r.class_id||[r.date,r.time||r.session||'',B.canonicalRecipeName(menu)].join('|');if(map.has(key))return;map.set(key,{source:'schedule',id:r.class_id||r.id||'s'+i,index:i,date:r.date,status:r.status||'예정',session:r.session||r.time||'',menu,people:Number(r.people)||0,revenue:B.revenue(r),raw:r})});return[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.session).localeCompare(String(b.session)))} }catch(e){}
    try{financeRow=e=>{const c=B.classFinancials(e.raw,context(e.source));let label=c.recipe?`${c.costStatus||'원가'} · 계산 보류`:'레시피 미연결';if(c.profit!=null)label=`${c.profitLabel} ${won(c.profit)}${c.confidence==='estimated'?' · 조건부 원가':''}`;return{date:e.date,source:e.source,menu:e.menu,people:e.people,revenue:e.revenue,profit:c.profit,label}}}catch(e){}
  }

  function dataAuditItems(){
    const rows=(schedule?.rows||[]).filter(r=>r.status!=='취소'),unlinked=[...new Set(rows.filter(r=>!B.findRecipe(r,recipes)).map(r=>r.menu||r.classTitle).filter(Boolean))],incomplete=recipes.filter(r=>!B.costState(r).usable).map(r=>r.name),applied=recipes.filter(r=>B.costState(r).source==='overlay').map(r=>r.name),reference=(costOverrides?.reference_only||[]).map(x=>x.recipe_name);
    const out=[['Business rules',rulesLoaded?'canonical file loaded':'embedded canonical fallback'],['Entity index',indexLoaded?'loaded':(D?'load failed':'normalization unavailable')],['Price provenance',provenanceLoaded?'loaded':(D?'load failed':'normalization unavailable')],['Cost overlays',overridesLoaded?`${applied.length}개 적용${applied.length?' ('+applied.join(', ')+')':''}`:'load failed'],['일정 ↔ 레시피 미연결',unlinked.length?unlinked.join(', '):'없음'],['원가 미완료 레시피',incomplete.length?incomplete.join(', '):'없음']];
    if(reference.length)out.push(['참고 계산만 유지',reference.join(', ')]);
    if(!D)return out;
    try{const id=D.identityCoverage(recipes,ingredients,schedule,history);out.push(['ID 커버리지',`레시피 ${id.recipes.ready}/${id.recipes.total} · 재료 ${id.ingredients.ready}/${id.ingredients.total} · 일정 ${id.schedule.ready}/${id.schedule.total} · 이력 ${id.history.ready}/${id.history.total}`])}catch(e){}
    try{const p=D.provenanceAudit(ingredients);out.push(['구매처 검증',`${p.verified}/${p.total} 확인 · 재확인 ${p.needsReview.length}개${p.needsReview.length?' ('+p.needsReview.slice(0,5).join(', ')+(p.needsReview.length>5?' 외':'')+')':''}`])}catch(e){}
    try{const r=D.reconciliation(recipes,ingredients,5),names=r.materialVariance.slice(0,5).map(x=>`${x.name} ${x.variancePct>0?'+':''}${Math.round(x.variancePct)}%`);out.push(['원가 재계산 완성도',`${r.complete}/${r.total} 레시피 · 저장/유효원가 비교 가능 ${r.comparable}개`]);out.push(['유효원가 ↔ 재계산 차이 ≥5%',r.materialVariance.length?`${r.materialVariance.length}개 (${names.join(', ')}${r.materialVariance.length>5?' 외':''})`:'없음']);const specific=r.rows.flatMap(x=>x.missing.filter(m=>m.state==='specific-price-missing').map(m=>`${x.name}: ${m.ingredient}`));if(specific.length)out.push(['지정 제품 단가 필요',specific.slice(0,6).join(', ')+(specific.length>6?' 외':'')])}catch(e){}
    return out;
  }
  function syncVisible(){installCore();try{const audit=document.getElementById('dataAudit');if(audit)audit.innerHTML=dataAuditItems().map(x=>`<div class="audit-item"><b>${x[0]}</b><span class="subtle">${x[1]}</span></div>`).join('')}catch(e){}}

  try{const baseConnect=connect;connect=async function(...args){const result=await baseConnect.apply(this,args);await loadGovernance();syncVisible();try{renderAll()}catch(e){}return result}}catch(e){}
  ['renderDashboard','renderSchedule','renderRecipes','renderFinance','renderAll'].forEach(name=>{try{const base=window[name];if(typeof base!=='function')return;window[name]=function(...args){installCore();const result=base.apply(this,args);setTimeout(syncVisible,20);return result}}catch(e){}});
  installCore();let attempts=0;const boot=setInterval(async()=>{attempts++;if(typeof token!=='undefined'&&token&&typeof schedule!=='undefined'&&schedule){await loadGovernance();syncVisible();try{renderAll()}catch(e){}clearInterval(boot)}else if(attempts>20)clearInterval(boot)},150);
})();
