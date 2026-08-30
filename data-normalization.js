(function(root){
  const B=root.BakingBusiness;
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const has=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  let index={recipes:[],recipe_aliases:[],ingredients:[],classes:{schedule:[],history:[]}},provenance={};

  const ingredientAliases={
    '따뜻한 우유':'우유','차가운 우유':'우유','찬우유':'우유',
    '녹인버터':'버터','녹인 버터':'버터','무염 버터':'버터','무염버터':'버터','틀 코팅 버터':'버터','충전용 버터':'버터',
    '전란':'계란','노른자':'계란','흰자':'계란','달걀':'계란',
    '휘핑크림':'생크림','전분':'옥수수전분','아몬드파우더':'아몬드가루','분유':'탈지분유','이스트':'드라이이스트','찬물':'물',
    '건무화과':'말린무화과','포도주':'와인','레몬제스트':'생레몬','밤페이스트':'밤 페이스트'
  };
  const approximateAliases=new Set(['레몬제스트']);

  function setIndex(v){index=v||index;return index}
  function setProvenance(v){provenance=v||provenance;return provenance}
  function getIndex(){return index}
  function getProvenance(){return provenance}

  function classSignature(raw){return [raw?.date||'',raw?.time||raw?.session||'',raw?.menu||raw?.recipeCandidate||raw?.classTitle||''].join('|')}
  function applyEntityIndex(recipes,ingredientMaster,schedule,history){
    const recipeByName=new Map((index.recipes||[]).map(x=>[x.name,x]));
    (recipes||[]).forEach(r=>{const e=recipeByName.get(r.name);if(e&&!r.recipe_id)r.recipe_id=e.recipe_id});
    const ingByName=new Map((index.ingredients||[]).map(x=>[x.name,x]));
    (ingredientMaster?.items||[]).forEach(i=>{const e=ingByName.get(i.name);if(e&&!i.ingredient_id)i.ingredient_id=e.ingredient_id});
    const recipeIdByAlias=new Map((index.recipe_aliases||[]).map(x=>[x.alias,x.recipe_id]));
    const recipeNameById=new Map((index.recipes||[]).map(x=>[x.recipe_id,x.name]));
    const scheduleByLegacy=new Map((index.classes?.schedule||[]).filter(x=>x.legacy_id).map(x=>[x.legacy_id,x]));
    (schedule?.rows||[]).forEach(r=>{
      const e=scheduleByLegacy.get(r.id)||null;
      if(e){if(!r.class_id)r.class_id=e.class_id;if(!r.recipe_id&&e.recipe_id)r.recipe_id=e.recipe_id}
      if(!r.recipe_id){const rid=recipeIdByAlias.get(r.menu||r.classTitle);if(rid)r.recipe_id=rid}
      if(r.recipe_id&&!r.recipe_name)r.recipe_name=recipeNameById.get(r.recipe_id)||'';
    });
    const histMap=new Map((index.classes?.history||[]).map(x=>[[x.date,x.time,x.menu].join('|'),x]));
    (history?.records||[]).forEach(r=>{
      const menu=r.menu||r.recipeCandidate||r.classTitle||'';
      const canonical=B?B.canonicalRecipeName(menu):menu;
      let e=histMap.get([r.date,r.time||r.session||'',canonical].join('|'))||histMap.get([r.date,r.time||r.session||'',menu].join('|'))||null;
      if(e){if(!r.class_id)r.class_id=e.class_id;if(!r.recipe_id&&e.recipe_id)r.recipe_id=e.recipe_id}
      if(!r.recipe_id){const rid=recipeIdByAlias.get(menu);if(rid)r.recipe_id=rid}
      if(r.recipe_id&&!r.recipe_name)r.recipe_name=recipeNameById.get(r.recipe_id)||'';
    });
    return identityCoverage(recipes,ingredientMaster,schedule,history);
  }

  function identityCoverage(recipes,ingredientMaster,schedule,history){
    const rp=recipes||[],ing=ingredientMaster?.items||[],sc=schedule?.rows||[],hi=history?.records||[];
    const count=(a,k)=>a.filter(x=>!!x?.[k]).length;
    return{
      recipes:{ready:count(rp,'recipe_id'),total:rp.length},
      ingredients:{ready:count(ing,'ingredient_id'),total:ing.length},
      schedule:{ready:count(sc,'class_id'),total:sc.length},
      history:{ready:count(hi,'class_id'),total:hi.length}
    };
  }

  function specificOverride(name){return (provenance.specific_product_overrides||[]).find(x=>x.ingredient_name===name)||null}
  function statusRule(status){return (provenance.status_mapping||[]).find(x=>String(status||'').startsWith(x.status_prefix))||null}
  function ingredientProvenance(item){
    if(!item)return{source_type:'missing',verification_status:'missing'};
    const specific=specificOverride(item.name);
    if(specific)return{...specific,ingredient_id:item.ingredient_id||null,ingredient_name:item.name,status:item.status||''};
    const sr=statusRule(item.status);
    if(sr)return{...sr,ingredient_id:item.ingredient_id||null,ingredient_name:item.name,status:item.status||''};
    return{ingredient_id:item.ingredient_id||null,ingredient_name:item.name,source_type:'coupang_lowest',marketplace:'쿠팡',verification_status:'needs_coupang_recheck',status:item.status||'',note:'일반 재료 기본 정책은 쿠팡 최저가. 현재 cost master에 쿠팡 확인 상태가 명시되지 않아 재확인 필요.'};
  }
  function provenanceAudit(ingredientMaster){
    const rows=(ingredientMaster?.items||[]).map(ingredientProvenance);
    return{total:rows.length,verified:rows.filter(x=>!String(x.verification_status).includes('needed')&&!String(x.verification_status).includes('recheck')).length,needsReview:rows.filter(x=>String(x.verification_status).includes('needed')||String(x.verification_status).includes('recheck')).map(x=>x.ingredient_name),rows};
  }

  function parseAmount(v){
    if(has(v))return{kind:'number',min:Number(v),max:Number(v)};
    const s=String(v??'').trim();
    const m=s.match(/^(\d+(?:\.\d+)?)\s*[~～-]\s*(\d+(?:\.\d+)?)$/);
    if(m)return{kind:'range',min:Number(m[1]),max:Number(m[2])};
    return{kind:s?'text':'missing',text:s};
  }
  function costMap(ingredientMaster){return new Map((ingredientMaster?.items||[]).map(x=>[String(x.name||'').trim(),x]))}
  function exactProductGuard(name){return new Set(provenance.specific_name_alias_guard?.do_not_collapse_without_exact_price||[]).has(name)}
  function ingredientMatch(name,ingredientMaster){
    const map=costMap(ingredientMaster),raw=String(name||'').trim();
    if(map.has(raw))return{item:map.get(raw),canonical:raw,alias:false,approx:false};
    if(exactProductGuard(raw))return{item:null,canonical:raw,alias:false,approx:false,specificMissing:true};
    const canonical=ingredientAliases[raw];
    if(canonical&&map.has(canonical))return{item:map.get(canonical),canonical,alias:true,approx:approximateAliases.has(raw)};
    return{item:null,canonical:canonical||raw,alias:!!canonical,approx:false};
  }
  function quantityCost(ing,item,recipe){
    const a=parseAmount(ing?.amount);if(a.kind==='missing')return{state:'usage-missing'};if(a.kind==='text')return{state:'structural',note:a.text};
    const unit=String(ing?.unit||'').trim();let factor=.01,note='';
    if(unit==='개'){
      if(item?.name==='바닐라빈')return{state:'ok',min:a.min*1900,max:a.max*1900,note:'바닐라빈 1개=1,900원 기준'};
      if(item?.name==='계란'){factor=.5;note='계란 1개≈50g 환산'}else return{state:'unsupported',note:'개수 단가 환산 필요'};
    }else if(unit.includes('/개')){
      const y=Number(recipe?.yield?.value);if(!Number.isFinite(y)||y<=0)return{state:'usage-missing',note:'수율 필요'};
      factor=y/100;note=`${unit} × 수율 ${y}개`;
    }else if(unit==='ml'){factor=.01;note='1ml≈1g 원가 환산'}
    else if(unit&&unit!=='g')return{state:'unsupported',note:`${unit} 환산 필요`};
    return{state:'ok',min:a.min*num(item?.unit_cost)*factor,max:a.max*num(item?.unit_cost)*factor,note};
  }
  function recipeCalculatedCost(recipe,ingredientMaster){
    const rows=(recipe?.ingredients||[]).map(ing=>{
      const match=ingredientMatch(ing.name,ingredientMaster);
      if(!match.item){const a=parseAmount(ing.amount);return{ing,match,state:match.specificMissing?'specific-price-missing':a.kind==='text'?'structural':'price-missing'};}
      const c=quantityCost(ing,match.item,recipe);return{ing,match,...c};
    });
    let min=0,max=0,priced=0,costable=0;const missing=[];
    rows.forEach(x=>{if(x.state==='structural')return;costable++;if(x.state==='ok'){priced++;min+=x.min;max+=x.max}else missing.push({ingredient:x.ing.name,state:x.state,note:x.note||''})});
    const complete=costable>0&&priced===costable;
    const spec=B?.effectiveCostSpec?B.effectiveCostSpec(recipe):null;
    const saved=spec&&has(spec.cost)?Number(spec.cost):(has(recipe?.cost)?Number(recipe.cost):null);
    const savedSource=spec?.source||(saved!=null?'recipe':'missing');
    const calculated=complete?(min+max)/2:null;
    const variance=saved!=null&&calculated!=null?saved-calculated:null;
    const variancePct=variance!=null&&calculated?variance/calculated*100:null;
    return{recipe_id:recipe?.recipe_id||null,name:recipe?.name||'',complete,priced,costable,min,max,calculated,saved,savedSource,variance,variancePct,missing,rows};
  }
  function reconciliation(recipes,ingredientMaster,thresholdPct=5){
    const rows=(recipes||[]).map(r=>recipeCalculatedCost(r,ingredientMaster));
    const comparable=rows.filter(x=>x.saved!=null&&x.calculated!=null);
    const materialVariance=comparable.filter(x=>Math.abs(x.variancePct)>=thresholdPct);
    return{total:rows.length,complete:rows.filter(x=>x.complete).length,comparable:comparable.length,materialVariance,needsCostInput:rows.filter(x=>!x.complete),rows};
  }

  root.BakingData={version:'2.1.0',setIndex,setProvenance,getIndex,getProvenance,applyEntityIndex,identityCoverage,ingredientProvenance,provenanceAudit,recipeCalculatedCost,reconciliation};
})(typeof globalThis!=='undefined'?globalThis:this);
