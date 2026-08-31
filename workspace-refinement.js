(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const validCategories=['빵류','디저트류','케이크류'];
  const categoryLabels={'빵류':'빵','디저트류':'디저트','케이크류':'케이크'};
  let activeRecipeCategory='빵류';
  let popupEnhancing=false;

  function recipeRows(){return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}
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
  }

  function ensureRecipeManagement(card,r,cat){
    const body=card.querySelector('.recipe-body');if(!body)return;
    let host=body.querySelector('.recipe-management');
    if(!host){host=document.createElement('div');host.className='recipe-management';body.prepend(host)}
    host.innerHTML=`<div><span>분류</span><b>${esc(categoryLabels[cat]||cat)}</b></div><label>분류 변경<select class="recipe-category-select" data-recipe-name="${esc(r.name)}">${validCategories.map(x=>`<option value="${x}" ${x===cat?'selected':''}>${categoryLabels[x]}</option>`).join('')}</select></label>`;

    const grid=body.querySelector('.recipe-grid');if(!grid||grid.dataset.minimalized==='1')return;
    const processPanel=grid.children[1];
    if(processPanel){
      const details=document.createElement('details');details.className='recipe-process-details';
      const steps=processPanel.querySelectorAll('.steps li').length;
      const summary=document.createElement('summary');summary.innerHTML=`<span>공정</span><b>${steps?`${steps}단계`:'확인'}</b><small>필요할 때 펼치기</small>`;
      const wrap=document.createElement('div');wrap.className='recipe-process-body';
      const title=processPanel.querySelector(':scope > h3');if(title)title.remove();
      while(processPanel.firstChild)wrap.appendChild(processPanel.firstChild);
      details.append(summary,wrap);processPanel.replaceWith(details);
    }
    grid.dataset.minimalized='1';
  }

  function refreshRecipeCategories(){
    ensureRecipeCategoryBar();
    const list=recipeRows(),counts={'빵류':0,'디저트류':0,'케이크류':0};list.forEach(r=>counts[recipeCategory(r)]++);
    if(!validCategories.includes(activeRecipeCategory))activeRecipeCategory='빵류';
    const bar=$('recipeCategoryBar');if(bar)bar.innerHTML=validCategories.map(k=>`<button type="button" class="recipe-cat-btn ${activeRecipeCategory===k?'active':''}" data-recipe-category="${k}"><b>${categoryLabels[k]}</b><span>${counts[k]||0}</span></button>`).join('');
    document.querySelectorAll('#recipeList>details.recipe').forEach(card=>{
      const name=card.querySelector('.rname')?.textContent?.trim()||'',r=list.find(x=>x.name===name),cat=recipeCategory(r||{name});
      card.dataset.recipeCategory=cat;card.hidden=activeRecipeCategory!==cat;
      const sub=card.querySelector('.rsub');if(sub){sub.querySelectorAll('.recipe-cat-badge').forEach(x=>x.remove());sub.insertAdjacentHTML('afterbegin',`<span class="recipe-cat-badge">${esc(categoryLabels[cat]||cat)}</span>`)}
      card.querySelectorAll('summary .recipe-category-select').forEach(x=>x.remove());
      if(r)ensureRecipeManagement(card,r,cat);
    });
  }

  document.addEventListener('change',e=>{
    const sel=e.target.closest('.recipe-category-select');if(sel){const r=recipeRows().find(x=>x.name===sel.dataset.recipeName);if(r){r.category=sel.value;try{mark('recipes')}catch(err){};refreshRecipeCategories()}return}
    const check=e.target.closest('[data-quick-paid]');if(check){const row=check.closest('.dayops-person'),select=row?.querySelector('[data-person="paymentStatus"]');if(!select)return;select.value=check.checked?'입금완료':'미입금';select.dispatchEvent(new Event('change',{bubbles:true}));return}
    if(e.target.closest('[data-core="people"]'))setTimeout(enhancePaymentPopup,80);
  },true);

  function moveAdvancedClassFields(body){
    const core=body.querySelector('.dayops-core-grid');if(!core||body.querySelector('.dayops-advanced'))return;
    const fields=['fee','rent','batchCount'].map(k=>core.querySelector(`label:has([data-core="${k}"])`)).filter(Boolean);
    if(!fields.length)return;
    const details=document.createElement('details');details.className='dayops-advanced';details.innerHTML='<summary>수업 비용 설정 <span>수강료 · 대관료 · 배합수</span></summary><div class="dayops-advanced-grid"></div>';
    fields.forEach(x=>details.lastElementChild.appendChild(x));core.insertAdjacentElement('afterend',details);
  }

  function enhancePaymentPopup(){
    if(popupEnhancing)return;
    const modal=$('dayOpsModal'),body=$('dayOpsBody');if(!modal?.classList.contains('open')||!body)return;
    moveAdvancedClassFields(body);
    const peopleInput=body.querySelector('[data-core="people"]'),fill=body.querySelector('[data-fill-people]');
    const people=Math.max(0,num(peopleInput?.value)),rows=[...body.querySelectorAll('.dayops-person')];
    if(fill&&rows.length<people){popupEnhancing=true;fill.click();setTimeout(()=>{popupEnhancing=false;enhancePaymentPopup()},120);return}
    rows.forEach(row=>{
      const select=row.querySelector('[data-person="paymentStatus"]');if(!select)return;
      let quick=row.querySelector('.quick-paid-check');
      if(!quick){quick=document.createElement('label');quick.className='quick-paid-check';quick.innerHTML='<input type="checkbox" data-quick-paid><span>입금완료</span>';const name=row.querySelector('label:has([data-person="name"])');name?.insertAdjacentElement('afterend',quick)}
      quick.querySelector('input').checked=select.value==='입금완료';
    });
  }

  const popupObserver=new MutationObserver(()=>setTimeout(enhancePaymentPopup,0));
  function watchPopup(){const body=$('dayOpsBody');if(body&&!body.dataset.refineObserved){popupObserver.observe(body,{childList:true,subtree:true});body.dataset.refineObserved='1'}enhancePaymentPopup()}
  document.addEventListener('click',()=>setTimeout(watchPopup,35),true);

  try{const base=renderRecipes;renderRecipes=function(...args){const out=base.apply(this,args);setTimeout(refreshRecipeCategories,30);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(()=>{refreshRecipeCategories();watchPopup()},120);return out}}catch(e){}
  setTimeout(()=>{refreshRecipeCategories();watchPopup()},900);
})();