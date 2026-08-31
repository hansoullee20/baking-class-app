(() => {
  let active='빵류';
  const labels={'빵류':['빵','발효 · 식사빵'],'디저트류':['디저트','구움과자 · 디저트'],'케이크류':['케이크','케이크 · 시트']};
  function category(card){
    if(card.dataset.recipeCategory)return card.dataset.recipeCategory;
    const name=card.querySelector('.rname')?.textContent?.trim()||card.querySelector('.recipe-pro-name')?.textContent?.trim()||'';
    if(/소금빵|깜파뉴|캄파뉴|치아바타|식빵|바게트|브리오슈|빵/.test(name))return'빵류';
    if(/케이크|제누아즈/.test(name))return'케이크류';
    return'디저트류';
  }
  function apply(){
    const page=document.getElementById('recipes'),bar=document.getElementById('recipeCategoryBar'),list=document.getElementById('recipeList');
    if(!page||!list)return;
    const head=page.querySelector(':scope > .section-head');
    if(head){const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='레시피';if(p)p.textContent='빵 · 디저트 · 케이크 3개 메뉴로 나누어 배합, 공정, 수율과 재료 원가를 관리합니다.'}
    const cards=[...list.querySelectorAll(':scope > details.recipe')];
    const counts={'빵류':0,'디저트류':0,'케이크류':0};cards.forEach(c=>{const cat=category(c);c.dataset.recipeCategory=cat;if(counts[cat]!=null)counts[cat]++});
    if(bar){
      bar.innerHTML=Object.keys(labels).map(cat=>{const [title,sub]=labels[cat];return`<button type="button" class="recipe-three-tab ${active===cat?'active':''}" data-three-recipe-category="${cat}"><span><b>${title}</b><small>${sub}</small></span><em>${counts[cat]||0}</em></button>`}).join('');
    }
    cards.forEach(c=>{c.hidden=category(c)!==active});
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-three-recipe-category]');
    if(b){active=b.dataset.threeRecipeCategory;apply();return}
    if(e.target.closest('[data-page="recipes"]'))setTimeout(apply,120);
  },true);
  document.addEventListener('input',e=>{if(e.target.id==='recipeSearch')setTimeout(apply,100)},true);
  try{const base=renderRecipes;renderRecipes=function(...args){const out=base.apply(this,args);setTimeout(apply,90);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(apply,220);return out}}catch(e){}
  setTimeout(apply,1300);
})();
