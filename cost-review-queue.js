(() => {
  const B=window.BakingBusiness,D=window.BakingData;
  if(!B)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const recipeRows=()=>{try{return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}catch(e){return[]}};
  const scheduleRows=()=>{try{return typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[]}catch(e){return[]}};
  const statusLabel=s=>({'확정':'확인 완료','조건부':'확인 필요','부분원가':'일부만 계산됨','미산정':'원가 미입력'}[s]||s||'확인 필요');

  function reviewItems(){
    const rows=recipeRows();
    let variance=[];
    try{variance=D?.reconciliation?D.reconciliation(rows,ingredients,5)?.materialVariance||[]:[]}catch(e){}
    const varianceNames=new Set(variance.map(x=>x.name));
    return rows.map(r=>{
      const s=B.costState(r),reasons=[];
      let priority=9;
      if(!s.usable){
        reasons.push(s.status==='부분원가'?'일부 재료만 계산됨':'완성 원가를 입력해 주세요');
        priority=1;
      }else if(s.confidence!=='confirmed'){
        reasons.push('원가를 한 번 더 확인해 주세요');
        priority=Math.min(priority,2);
      }
      if(varianceNames.has(r.name)){reasons.push('재료 합계와 저장 원가 차이가 큼');priority=Math.min(priority,3)}
      if(Array.isArray(r.missing_cost_ingredients)&&r.missing_cost_ingredients.length){reasons.push(`가격 확인 필요한 재료 ${r.missing_cost_ingredients.length}개`);priority=Math.min(priority,1)}
      if(Array.isArray(r.verification_required)&&r.verification_required.length){reasons.push('레시피·단가 확인 항목 있음');priority=Math.min(priority,2)}
      return reasons.length?{recipe:r,state:s,reasons:[...new Set(reasons)],priority}:null;
    }).filter(Boolean).sort((a,b)=>a.priority-b.priority||a.recipe.name.localeCompare(b.recipe.name,'ko'));
  }

  function reviewButton(x,compact=false){
    const name=x.recipe.name;
    return `<button type="button" class="ux-review-item${compact?' compact':''}" data-ux-cost-recipe="${esc(name)}"><span><b>${esc(name)}</b><small>${esc(x.reasons.join(' · '))}</small></span><em><strong>${x.state.amount==null?'—':won(x.state.amount)}</strong><i>${esc(statusLabel(x.state.status))}</i><u>수정 →</u></em></button>`;
  }

  function go(page){
    if(typeof window.nav==='function'){window.nav(page);return}
    document.querySelector(`[data-page="${page}"]`)?.click();
  }

  function openRecipe(name){
    go('recipes');
    const q=document.getElementById('recipeSearch');if(q){q.value=name;q.dispatchEvent(new Event('input',{bubbles:true}))}
    const all=document.querySelector('[data-filter="all"]');if(all)all.click();else if(typeof window.renderRecipes==='function')window.renderRecipes();
    setTimeout(()=>{
      const cards=[...document.querySelectorAll('#recipeList details.recipe')];
      const card=cards.find(c=>(c.querySelector('.rname')?.textContent||'').trim()===name);
      if(!card)return;
      const cat=card.dataset.recipeCategory;
      if(cat){
        const tab=[...document.querySelectorAll('[data-three-recipe-category],[data-recipe-category]')].find(b=>(b.dataset.threeRecipeCategory||b.dataset.recipeCategory)===cat);
        if(tab&&!tab.classList.contains('active'))tab.click();
      }
      card.hidden=false;card.open=true;card.classList.add('ux-cost-target');
      card.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{
        const input=[...card.querySelectorAll('[data-rk="cost"]')].find(x=>x.dataset.r===name)||card.querySelector('[data-rk="cost"]');
        if(input){input.focus({preventScroll:true});input.select?.()}
        setTimeout(()=>card.classList.remove('ux-cost-target'),1600);
      },220);
    },260);
  }

  function renderDashboardQueue(){
    const dashboard=document.getElementById('leanDashboard');if(!dashboard)return;
    const items=reviewItems();
    let host=document.getElementById('uxCostReviewDashboard');
    if(!items.length){host?.remove();return}
    if(!host){
      host=document.createElement('section');host.id='uxCostReviewDashboard';host.className='decision-block ux-cost-review';
      const signals=dashboard.querySelector('.lean-signal-grid');
      if(signals)signals.insertAdjacentElement('afterend',host);else dashboard.prepend(host);
    }
    const shown=items.slice(0,4);
    host.innerHTML=`<div class="ux-review-head"><div><h3>원가 확인할 레시피</h3><p>확인이 끝나면 수익 계산에 바로 반영됩니다.</p></div><b>${items.length}개</b></div><div class="ux-review-list">${shown.map(x=>reviewButton(x,true)).join('')}</div>${items.length>shown.length?'<button type="button" class="ux-review-more" data-ux-open-costs>전체 보기</button>':''}`;
  }

  function renderRecipeQueue(){
    const page=document.getElementById('recipes'),tools=page?.querySelector('.recipe-tools');if(!page||!tools)return;
    const items=reviewItems();
    let host=document.getElementById('uxRecipeCostReview');
    if(!items.length){host?.remove();return}
    if(!host){host=document.createElement('section');host.id='uxRecipeCostReview';host.className='ux-recipe-review';tools.insertAdjacentElement('afterend',host)}
    host.innerHTML=`<div class="ux-review-head"><div><h3>원가 확인 필요</h3><p>항목을 누르면 해당 레시피의 원가 입력칸으로 바로 이동합니다.</p></div><b>${items.length}개</b></div><div class="ux-review-list recipes">${items.map(x=>reviewButton(x,true)).join('')}</div>`;
    tools.insertAdjacentElement('afterend',host);
  }

  function setLabel(label,text){
    if(!label)return;
    const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.nodeValue.trim());
    if(node)node.nodeValue=text;else label.prepend(document.createTextNode(text));
  }

  function humanizeNavigation(){
    const labels={dashboard:'홈',calendar:'수업',recipes:'레시피',finance:'수익'};
    document.querySelectorAll('.nav [data-page],.mobile-nav [data-page]').forEach(b=>{if(labels[b.dataset.page])b.textContent=labels[b.dataset.page]});
    const brand=document.querySelector('.brand');if(brand)brand.textContent='BLEU 운영';
    document.querySelector('.side-note')?.setAttribute('aria-hidden','true');
    const top=document.querySelector('.top');
    if(top){const h=top.querySelector('h1'),p=top.querySelector('p');if(h)h.textContent='BLEU 운영';if(p)p.textContent='수업 · 레시피 · 원가 · 수익을 한곳에서 관리합니다.'}
    const cal=document.querySelector('#calendar .section-head');if(cal){const h=cal.querySelector('h2'),p=cal.querySelector('p');if(h)h.textContent='수업';if(p)p.textContent='날짜를 눌러 수업과 참가자, 입금 상태를 관리합니다.'}
    const rec=document.querySelector('#recipes .section-head');if(rec){const p=rec.querySelector('p');if(p)p.textContent='레시피와 재료 원가를 확인하고 필요한 항목만 수정합니다.'}
    const fin=document.querySelector('#finance .section-head');if(fin){const h=fin.querySelector('h2'),p=fin.querySelector('p');if(h)h.textContent='수익';if(p)p.textContent='이번 달 남는 금액과 월말 예상부터 확인합니다.'}
    const signal=document.querySelector('#leanDashboard .lean-signal-grid .lean-signal:nth-child(4)');
    if(signal){const s=signal.querySelector('span'),sm=signal.querySelector('small');if(s)s.textContent='수익 계산 보류';if(sm)sm.textContent='원가 확인 필요한 수업'}
  }

  function humanizeRecipes(){
    document.querySelectorAll('#recipeList [data-rk="status"]').forEach(sel=>{
      [...sel.options].forEach(opt=>{const canonical=opt.getAttribute('value')||opt.value||opt.textContent.trim();if(['확정','조건부','부분원가','미산정'].includes(canonical)){opt.value=canonical;opt.textContent=statusLabel(canonical)}});
      setLabel(sel.closest('label'),'확인 상태');
    });
    document.querySelectorAll('#recipeList [data-rk="cost"]').forEach(input=>setLabel(input.closest('label'),'완성 원가'));
    document.querySelectorAll('#recipeList [data-action="recipe-save"]').forEach(b=>b.textContent='저장');
    document.querySelectorAll('#recipeList .cost span').forEach(s=>{const t=s.textContent.trim();if(['확정','조건부','부분원가','미산정'].includes(t))s.textContent=statusLabel(t)});
  }

  function humanizeClassEditor(){
    const body=document.getElementById('dayOpsBody');if(!body)return;
    setLabel(body.querySelector('label:has([data-core="people"])'),'예약 인원');
    setLabel(body.querySelector('label:has([data-core="capacity"])'),'정원');
    setLabel(body.querySelector('label:has([data-core="fee"])'),'1인 수강료');
    setLabel(body.querySelector('label:has(#dayOpsPeople)'),'예약 인원');
    const add=document.getElementById('dayOpsAddClass');if(add)add.textContent='수업 추가';
  }

  function setupChrome(){
    const top=document.querySelector('.top'),connect=document.querySelector('.connect'),status=document.querySelector('.status');
    if(!top||!connect||!status)return;
    let tools=document.getElementById('uxTopTools');
    if(!tools){
      tools=document.createElement('div');tools.id='uxTopTools';tools.className='ux-top-tools';
      tools.innerHTML='<span id="uxSaveState" class="ux-save-state">연결 확인</span><details id="uxAppSettings" class="ux-settings"><summary>설정</summary><div class="ux-settings-body"><p>처음 연결하거나 기기를 바꿀 때만 사용합니다.</p></div></details>';
      top.appendChild(tools);
      const panel=tools.querySelector('.ux-settings-body');panel.append(connect,status);
      const token=document.getElementById('token');if(token)token.placeholder='데이터 연결 키';
      const clear=document.getElementById('clearBtn');if(clear)clear.textContent='연결 키 변경';
      try{if(!localStorage.getItem('baking-ops-github-token'))tools.querySelector('#uxAppSettings').open=true}catch(e){}
    }
    updateSaveState();
  }

  function updateSaveState(){
    const host=document.getElementById('uxSaveState');if(!host)return;
    const con=document.getElementById('connection')?.textContent||'',dirty=document.getElementById('dirty')?.textContent||'',sync=document.getElementById('sync')?.textContent||'';
    let text='저장됨',tone='ok';
    if(/실패|확인 필요|다른 변경/.test(con+' '+dirty+' '+sync)){text='확인 필요';tone='bad'}
    else if(!/연결됨/.test(con)){text='연결 필요';tone='warn'}
    else if(/저장 중|대기/.test(dirty)){text='저장 중…';tone='warn'}
    else if(/최신|저장됨/.test(sync+' '+dirty)){text='저장됨';tone='ok'}
    host.textContent=text;host.className=`ux-save-state ${tone}`;
  }

  function currentMonthKey(){
    try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-')}catch(e){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
  }

  function financeBlockers(){
    const key=currentMonthKey();
    return scheduleRows().filter(r=>String(r.date||'').startsWith(key)&&r.status!=='취소').filter(r=>{
      try{return B.classFinancials(r,{recipes:recipeRows(),schedule,source:'schedule'}).total==null}catch(e){return false}
    });
  }

  function refineFinance(){
    const host=document.getElementById('financeLedgerDetail');if(!host)return;
    const intro=host.querySelector('.finance-focus-intro');if(intro){const h=intro.querySelector('h2'),p=intro.querySelector('p');if(h)h.textContent='이번 달 수익';if(p)p.textContent='지금까지 남은 금액과 현재 예약 기준 월말 예상을 봅니다.'}
    const current=host.querySelector('.focus-flow-card.current .focus-flow-head h3');if(current)current.textContent='지금까지';
    const forecast=host.querySelector('.focus-flow-card.forecast .focus-flow-head h3');if(forecast)forecast.textContent='월말 예상';
    host.querySelectorAll('.focus-flow-badge').forEach(x=>{x.textContent=x.textContent.replace('원가 연결','원가 확인').replace(/\s*·\s*\d+%/,'')});
    let alert=host.querySelector('.ux-finance-alert');
    const blockers=financeBlockers();
    if(!alert){alert=document.createElement('button');alert.type='button';alert.className='ux-finance-alert';alert.setAttribute('data-ux-finance-costs','');const anchor=host.querySelector('.finance-supercard')||host.querySelector('.finance-focus-grid');anchor?.insertAdjacentElement('afterend',alert)}
    if(alert){alert.hidden=!blockers.length;alert.innerHTML=blockers.length?`<span>원가 때문에 계산 안 되는 수업</span><b>${blockers.length}건</b><em>확인 →</em>`:''}
    if(!host.querySelector(':scope > .ux-finance-more')){
      const details=document.createElement('details');details.className='ux-finance-more';details.innerHTML='<summary>수익 자세히 보기 <span>월 비교 · 메뉴별 · 수업별</span></summary><div class="ux-finance-more-body"></div>';
      const body=details.lastElementChild;
      [host.querySelector('.month-compare-card'),host.querySelector('.month-menu-card'),host.querySelector('.finance-detail-shell'),host.querySelector('.finance-method-note')].filter(Boolean).forEach(x=>body.appendChild(x));
      if(body.children.length)host.appendChild(details);
    }
  }

  function refresh(){
    setupChrome();humanizeNavigation();renderDashboardQueue();renderRecipeQueue();humanizeRecipes();humanizeClassEditor();refineFinance();updateSaveState();
  }

  ['renderDashboard','renderRecipes','renderFinance','renderAll'].forEach(name=>{
    try{const base=window[name];if(typeof base!=='function')return;window[name]=function(...args){const out=base.apply(this,args);setTimeout(refresh,180);return out}}catch(e){}
  });

  document.addEventListener('click',e=>{
    const r=e.target.closest('[data-ux-cost-recipe]');if(r){e.preventDefault();openRecipe(r.dataset.uxCostRecipe);return}
    if(e.target.closest('[data-ux-open-costs]')){go('recipes');setTimeout(()=>document.getElementById('uxRecipeCostReview')?.scrollIntoView({behavior:'smooth',block:'start'}),180);return}
    if(e.target.closest('[data-ux-finance-costs]')){go('recipes');setTimeout(()=>document.getElementById('uxRecipeCostReview')?.scrollIntoView({behavior:'smooth',block:'start'}),180);return}
    setTimeout(refresh,100);
  },true);
  document.addEventListener('input',()=>setTimeout(refresh,120),true);
  document.addEventListener('change',()=>setTimeout(refresh,120),true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,180)});
  new MutationObserver(()=>{clearTimeout(window.__bleuUxTimer);window.__bleuUxTimer=setTimeout(refresh,140)}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setTimeout(refresh,1200);
})();
