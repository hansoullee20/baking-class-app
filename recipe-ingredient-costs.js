(() => {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const normalize=s=>String(s||'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[\s·_\-]/g,'').replace(/[^0-9a-z가-힣]/g,'');
  const aliases={
    '따뜻한우유':'우유','차가운우유':'우유','우유':'우유','녹인버터':'버터','충전용버터':'버터','무염버터':'버터','앵커버터':'버터','anchorbutter':'버터','버터':'버터',
    '전란':'계란','노른자':'계란','난황':'계란','흰자':'계란','난백':'계란','계란':'계란','분유':'탈지분유','탈지분유':'탈지분유','필라델피아크림치즈':'크림치즈','크림치즈':'크림치즈',
    '휘핑크림':'생크림','동물성생크림':'생크림','생크림':'생크림','전분':'옥수수전분','콘스타치':'옥수수전분','옥수수전분':'옥수수전분','호두분태':'호두','호두':'호두',
    '아몬드파우더':'아몬드가루','아몬드분말':'아몬드가루','아몬드가루':'아몬드가루','헤이즐넛파우더':'헤이즐넛가루','헤이즐넛분말':'헤이즐넛가루','헤이즐넛가루':'헤이즐넛가루',
    '코코아':'코코아파우더','코코아가루':'코코아파우더','코코아파우더':'코코아파우더','다크컴파운드':'다크컴파운드초콜릿','다크컴파운드초콜릿':'다크컴파운드초콜릿','찬물':'물','미지근한물':'물','물':'물'
  };
  function recipeRows(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
  function masterRows(){return typeof ingredients!=='undefined'&&Array.isArray(ingredients?.items)?ingredients.items:[]}
  function masterMap(){const map=new Map();masterRows().forEach(x=>map.set(normalize(x.name),x));return map}
  function findMaster(name,map){const key=normalize(name),alias=aliases[key]||key;if(map.has(alias))return map.get(alias);if(map.has(key))return map.get(key);const candidates=[...map.entries()].filter(([k])=>key.includes(k)||k.includes(key));return candidates.length===1?candidates[0][1]:null}
  function perPieceCost(master){const text=[master?.basis,master?.conversion].filter(Boolean).join(' '),hit=text.match(/1개[^0-9]{0,12}([0-9,]+(?:\.\d+)?)원/);return hit?Number(hit[1].replaceAll(',','')):null}
  function gramsPerPiece(master){const hit=String(master?.conversion||'').match(/([0-9.]+)g\s*\/\s*개/);return hit?Number(hit[1]):null}
  function usageCalc(item,master,recipe){
    if(!master||item?.amount==null||item?.amount===''||!Number.isFinite(Number(item.amount)))return{cost:null,used:null,note:master?'사용량 확인 필요':'단가 미연결'};
    const amount=Number(item.amount),unit=String(item.unit||'').trim(),per100=Number(master.price_per_100g??master.unit_cost);
    if(['g','그램','gram','grams'].includes(unit))return{cost:Number.isFinite(per100)?amount/100*per100:null,used:`${amount}g`,note:null};
    if(/^g\s*\/\s*개$/.test(unit)){const y=Number(recipe?.yield?.value);return Number.isFinite(y)&&y>0?{cost:Number.isFinite(per100)?amount*y/100*per100:null,used:`${amount}g/개 × ${y} = ${amount*y}g`,note:null}:{cost:null,used:`${amount}${unit}`,note:'수율 연결 필요'}}
    if(unit==='개'){const each=perPieceCost(master);if(each!=null)return{cost:amount*each,used:`${amount}개`,note:`${won(each)}/개`};const gpp=gramsPerPiece(master);if(gpp!=null&&Number.isFinite(per100))return{cost:amount*gpp/100*per100,used:`${amount}개 ≈ ${amount*gpp}g`,note:`${gpp}g/개 환산`};return{cost:null,used:`${amount}개`,note:'개당 환산 필요'}}
    if(unit==='ml'||unit==='mL'){const ok=/1ml\s*[≈~=]\s*1g/i.test(String(master?.conversion||''));return ok&&Number.isFinite(per100)?{cost:amount/100*per100,used:`${amount}ml ≈ ${amount}g`,note:'등록 환산 적용'}:{cost:null,used:`${amount}ml`,note:'ml→g 환산 필요'}}
    return{cost:null,used:`${amount}${unit||''}`,note:'단위 환산 필요'};
  }
  function unitPrice(master){if(!master)return'단가 미연결';const price=Number(master.price_per_100g??master.unit_cost);return Number.isFinite(price)?`${won(price)}/100g`:'단가 미연결'}
  function renderTable(recipe,table){
    const map=masterMap(),rows=(recipe.ingredients||[]).map(item=>{const master=findMaster(item.name,map),calc=usageCalc(item,master,recipe);return{item,master,calc}}),linked=rows.filter(x=>x.calc.cost!=null),sum=linked.reduce((s,x)=>s+x.calc.cost,0);
    table.classList.add('ingredient-cost-table');table.dataset.recipeCostDetail='1';
    table.innerHTML=`<thead><tr><th>재료</th><th>사용량</th><th>적용 단가</th><th>사용량 원가</th><th>단가 상태</th></tr></thead><tbody>${rows.map(({item,master,calc})=>`<tr><td><b>${esc(item.name)}</b>${item.group?`<small>${esc(item.group)}</small>`:''}</td><td>${esc(calc.used||`${item.amount??'—'} ${item.unit||''}`)}</td><td>${esc(unitPrice(master))}</td><td class="ingredient-use-cost">${calc.cost==null?'<span>—</span>':won(calc.cost)}${calc.note?`<small>${esc(calc.note)}</small>`:''}</td><td>${master?`<span class="ingredient-price-status">${esc(master.status||'확인 필요')}</span>`:`<span class="ingredient-price-status missing">미연결</span>`}</td></tr>`).join('')}</tbody>`;
    const wrap=table.closest('.tablewrap')||table.parentElement;let summary=wrap?.parentElement?.querySelector(':scope > .ingredient-cost-summary');if(!summary&&wrap){summary=document.createElement('div');summary.className='ingredient-cost-summary';wrap.insertAdjacentElement('afterend',summary)}
    if(summary)summary.innerHTML=`<div><span>재료별 계산 합계</span><b>${linked.length?won(sum):'—'}</b><small>${linked.length}/${rows.length}개 재료 단가 연결 · 레시피 총원가는 카드 상단에서 확인</small></div>`;
  }
  function enhanceRecipeIngredientCosts(){const list=recipeRows();document.querySelectorAll('#recipeList>details.recipe').forEach(card=>{const name=card.querySelector('.rname')?.textContent?.trim(),recipe=list.find(r=>r.name===name);if(!recipe)return;const table=card.querySelector('.recipe-body .recipe-grid > div:first-child table');if(table)renderTable(recipe,table)})}
  const observer=new MutationObserver(()=>setTimeout(enhanceRecipeIngredientCosts,0));
  function start(){const host=$('recipeList');if(host&&!host.dataset.ingredientCostObserved){observer.observe(host,{childList:true,subtree:true});host.dataset.ingredientCostObserved='1'}enhanceRecipeIngredientCosts()}
  try{const base=renderRecipes;renderRecipes=function(...args){const out=base.apply(this,args);setTimeout(enhanceRecipeIngredientCosts,30);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(start,120);return out}}catch(e){}
  setTimeout(start,950);
})();