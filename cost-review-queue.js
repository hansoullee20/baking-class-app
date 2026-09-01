(() => {
  const B=window.BakingBusiness,D=window.BakingData;if(!B)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const recipesList=()=>{try{return typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[]}catch(e){return[]}};
  const schedules=()=>{try{return typeof schedule!=='undefined'&&Array.isArray(schedule?.rows)?schedule.rows:[]}catch(e){return[]}};
  const label=s=>({'확정':'확인 완료','조건부':'확인 필요','부분원가':'일부만 계산됨','미산정':'원가 미입력'}[s]||s||'확인 필요');

  function reviewItems(){
    const rows=recipesList();let variance=[];
    try{variance=D?.reconciliation?D.reconciliation(rows,ingredients,5)?.materialVariance||[]:[]}catch(e){}
    const names=new Set(variance.map(x=>x.name));
    return rows.map(r=>{const s=B.costState(r),reasons=[];let priority=9;
      if(!s.usable){reasons.push(s.status==='부분원가'?'일부 재료만 계산됨':'완성 원가를 입력해 주세요');priority=1}
      else if(s.confidence!=='confirmed'){reasons.push('원가를 한 번 더 확인해 주세요');priority=2}
      if(names.has(r.name)){reasons.push('재료 합계와 저장 원가 차이가 큼');priority=Math.min(priority,3)}
      if(r.missing_cost_ingredients?.length){reasons.push(`가격 확인 필요한 재료 ${r.missing_cost_ingredients.length}개`);priority=1}
      if(r.verification_required?.length){reasons.push('레시피·단가 확인 항목 있음');priority=Math.min(priority,2)}
      return reasons.length?{r,s,reasons:[...new Set(reasons)],priority}:null
    }).filter(Boolean).sort((a,b)=>a.priority-b.priority||a.r.name.localeCompare(b.r.name,'ko'));
  }
  const item=(x,compact=false)=>`<button type="button" class="ux-review-item${compact?' compact':''}" data-ux-cost-recipe="${esc(x.r.name)}"><span><b>${esc(x.r.name)}</b><small>${esc(x.reasons.join(' · '))}</small></span><em><strong>${x.s.amount==null?'—':won(x.s.amount)}</strong><i>${esc(label(x.s.status))}</i><u>수정 →</u></em></button>`;
  function go(page){if(typeof window.nav==='function')window.nav(page);else document.querySelector(`[data-page="${page}"]`)?.click()}
  function openRecipe(name){
    go('recipes');const q=document.getElementById('recipeSearch');if(q){q.value=name;q.dispatchEvent(new Event('input',{bubbles:true}))}
    document.querySelector('[data-filter="all"]')?.click();
    setTimeout(()=>{const card=[...document.querySelectorAll('#recipeList details.recipe')].find(c=>c.querySelector('.rname')?.textContent.trim()===name);if(!card)return;
      const cat=card.dataset.recipeCategory,tab=[...document.querySelectorAll('[data-three-recipe-category],[data-recipe-category]')].find(b=>(b.dataset.threeRecipeCategory||b.dataset.recipeCategory)===cat);if(tab&&!tab.classList.contains('active'))tab.click();
      card.hidden=false;card.open=true;card.classList.add('ux-cost-target');card.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{const input=[...card.querySelectorAll('[data-rk="cost"]')].find(x=>x.dataset.r===name)||card.querySelector('[data-rk="cost"]');if(input){input.focus({preventScroll:true});input.select?.()}setTimeout(()=>card.classList.remove('ux-cost-target'),1600)},160);
    },180);
  }

  function setHtmlIfChanged(el,html){if(el&&el.innerHTML!==html)el.innerHTML=html}
  function renderQueues(){
    const items=reviewItems(),dash=document.getElementById('leanDashboard');let d=document.getElementById('uxCostReviewDashboard');
    if(dash&&items.length){if(!d){d=document.createElement('section');d.id='uxCostReviewDashboard';d.className='decision-block ux-cost-review';const a=dash.querySelector('.lean-signal-grid');a?a.insertAdjacentElement('afterend',d):dash.prepend(d)}const shown=items.slice(0,4);setHtmlIfChanged(d,`<div class="ux-review-head"><div><h3>원가 확인할 레시피</h3><p>확인이 끝나면 수익 계산에 바로 반영됩니다.</p></div><b>${items.length}개</b></div><div class="ux-review-list">${shown.map(x=>item(x,true)).join('')}</div>${items.length>4?'<button type="button" class="ux-review-more" data-ux-open-costs>전체 보기</button>':''}`)}
    else d?.remove();
    const tools=document.querySelector('#recipes .recipe-tools');let r=document.getElementById('uxRecipeCostReview');
    if(tools&&items.length){if(!r){r=document.createElement('section');r.id='uxRecipeCostReview';r.className='ux-recipe-review';tools.insertAdjacentElement('afterend',r)}else if(r.previousElementSibling!==tools)tools.insertAdjacentElement('afterend',r);setHtmlIfChanged(r,`<div class="ux-review-head"><div><h3>원가 확인 필요</h3><p>누르면 해당 레시피의 원가 입력칸으로 바로 이동합니다.</p></div><b>${items.length}개</b></div><div class="ux-review-list recipes">${items.map(x=>item(x,true)).join('')}</div>`)}else r?.remove();
  }

  function setLabel(el,text){if(!el)return;const n=[...el.childNodes].find(x=>x.nodeType===Node.TEXT_NODE&&x.nodeValue.trim());if(n&&n.nodeValue!==text)n.nodeValue=text;else if(!n)el.prepend(document.createTextNode(text))}
  function navCopy(){
    const map={dashboard:'홈',calendar:'수업',recipes:'레시피',finance:'수익'};document.querySelectorAll('.nav [data-page],.mobile-nav [data-page]').forEach(b=>{if(map[b.dataset.page]&&b.textContent!==map[b.dataset.page])b.textContent=map[b.dataset.page]});
    const brand=document.querySelector('.brand');if(brand&&brand.textContent!=='BLEU 운영')brand.textContent='BLEU 운영';
    const top=document.querySelector('.top');if(top){const h=top.querySelector('h1'),p=top.querySelector('p');if(h&&h.textContent!=='BLEU 운영')h.textContent='BLEU 운영';if(p&&p.textContent!=='수업 · 레시피 · 원가 · 수익을 한곳에서 관리합니다.')p.textContent='수업 · 레시피 · 원가 · 수익을 한곳에서 관리합니다.'}
    const cal=document.querySelector('#calendar .section-head');if(cal){const h=cal.querySelector('h2'),p=cal.querySelector('p');if(h&&h.textContent!=='수업')h.textContent='수업';if(p&&p.textContent!=='날짜를 눌러 수업과 참가자, 입금 상태를 관리합니다.')p.textContent='날짜를 눌러 수업과 참가자, 입금 상태를 관리합니다.'}
    const rp=document.querySelector('#recipes .section-head p');if(rp&&rp.textContent!=='레시피와 재료 원가를 확인하고 필요한 항목만 수정합니다.')rp.textContent='레시피와 재료 원가를 확인하고 필요한 항목만 수정합니다.';
    const fin=document.querySelector('#finance .section-head');if(fin){const h=fin.querySelector('h2'),p=fin.querySelector('p');if(h&&h.textContent!=='수익')h.textContent='수익';if(p&&p.textContent!=='이번 달 남는 금액과 월말 예상부터 확인합니다.')p.textContent='이번 달 남는 금액과 월말 예상부터 확인합니다.'}
    const s=document.querySelector('#leanDashboard .lean-signal:nth-child(4)');if(s){const a=s.querySelector('span'),b=s.querySelector('small');if(a&&a.textContent!=='수익 계산 보류')a.textContent='수익 계산 보류';if(b&&b.textContent!=='원가 확인 필요한 수업')b.textContent='원가 확인 필요한 수업'}
  }

  function recipeCopy(){
    document.querySelectorAll('#recipeList [data-rk="status"]').forEach(sel=>{[...sel.options].forEach(o=>{const v=o.getAttribute('value')||o.value||o.textContent.trim();if(['확정','조건부','부분원가','미산정'].includes(v)){o.value=v;const t=label(v);if(o.textContent!==t)o.textContent=t}});setLabel(sel.closest('label'),'확인 상태')});
    document.querySelectorAll('#recipeList [data-rk="cost"]').forEach(x=>setLabel(x.closest('label'),'완성 원가'));
    document.querySelectorAll('#recipeList [data-action="recipe-save"]').forEach(x=>{if(x.textContent!=='저장')x.textContent='저장'});
    document.querySelectorAll('#recipeList .cost span').forEach(x=>{const t=x.textContent.trim();if(['확정','조건부','부분원가','미산정'].includes(t))x.textContent=label(t)});
  }
  function classCopy(){const body=document.getElementById('dayOpsBody');if(!body)return;setLabel(body.querySelector('label:has([data-core="people"])'),'예약 인원');setLabel(body.querySelector('label:has([data-core="capacity"])'),'정원');setLabel(body.querySelector('label:has([data-core="fee"])'),'1인 수강료');setLabel(body.querySelector('label:has(#dayOpsPeople)'),'예약 인원');const add=document.getElementById('dayOpsAddClass');if(add&&add.textContent!=='수업 추가')add.textContent='수업 추가'}

  function setupChrome(){
    const top=document.querySelector('.top'),connect=document.querySelector('.connect'),status=document.querySelector('.status');if(!top||!connect||!status)return;
    let tools=document.getElementById('uxTopTools');if(!tools){tools=document.createElement('div');tools.id='uxTopTools';tools.className='ux-top-tools';tools.innerHTML='<span id="uxSaveState" class="ux-save-state">연결 확인</span><details id="uxAppSettings" class="ux-settings"><summary>설정</summary><div class="ux-settings-body"><p>처음 연결하거나 기기를 바꿀 때만 사용합니다.</p></div></details>';top.appendChild(tools);tools.querySelector('.ux-settings-body').append(connect,status);const token=document.getElementById('token');if(token)token.placeholder='데이터 연결 키';const clear=document.getElementById('clearBtn');if(clear)clear.textContent='연결 키 변경';try{if(!localStorage.getItem('baking-ops-github-token'))tools.querySelector('#uxAppSettings').open=true}catch(e){}}
    updateSaveState();watchSaveState();
  }
  function updateSaveState(){const x=document.getElementById('uxSaveState');if(!x)return;const con=document.getElementById('connection')?.textContent||'',d=document.getElementById('dirty')?.textContent||'',s=document.getElementById('sync')?.textContent||'';let t='저장됨',c='ok';if(/실패|확인 필요|다른 변경/.test(con+d+s)){t='확인 필요';c='bad'}else if(!/연결됨/.test(con)){t='연결 필요';c='warn'}else if(/저장 중|대기/.test(d)){t='저장 중…';c='warn'}if(x.textContent!==t)x.textContent=t;const cls=`ux-save-state ${c}`;if(x.className!==cls)x.className=cls}
  function watchSaveState(){['connection','dirty','sync'].forEach(id=>{const el=document.getElementById(id);if(!el||el.dataset.uxSaveObserved)return;new MutationObserver(updateSaveState).observe(el,{childList:true,subtree:true,characterData:true});el.dataset.uxSaveObserved='1'})}

  function monthKey(){try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date()),g=k=>p.find(x=>x.type===k)?.value;return`${g('year')}-${g('month')}`}catch(e){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}}
  function blockers(){return schedules().filter(r=>String(r.date||'').startsWith(monthKey())&&r.status!=='취소').filter(r=>{try{return B.classFinancials(r,{recipes:recipesList(),schedule,source:'schedule'}).total==null}catch(e){return false}})}
  function financeCopy(){
    const host=document.getElementById('financeLedgerDetail');if(!host)return;const intro=host.querySelector('.finance-focus-intro');if(intro){const h=intro.querySelector('h2'),p=intro.querySelector('p');if(h&&h.textContent!=='이번 달 수익')h.textContent='이번 달 수익';if(p&&p.textContent!=='지금까지 남은 금액과 현재 예약 기준 월말 예상을 봅니다.')p.textContent='지금까지 남은 금액과 현재 예약 기준 월말 예상을 봅니다.'}
    const a=host.querySelector('.focus-flow-card.current .focus-flow-head h3'),b=host.querySelector('.focus-flow-card.forecast .focus-flow-head h3');if(a&&a.textContent!=='지금까지')a.textContent='지금까지';if(b&&b.textContent!=='월말 예상')b.textContent='월말 예상';host.querySelectorAll('.focus-flow-badge').forEach(x=>{const t=x.textContent.replace('원가 연결','원가 확인').replace(/\s*·\s*\d+%/,'');if(x.textContent!==t)x.textContent=t});
    const bad=blockers();let alert=host.querySelector('.ux-finance-alert');if(!alert){alert=document.createElement('button');alert.type='button';alert.className='ux-finance-alert';alert.dataset.uxFinanceCosts='';(host.querySelector('.finance-supercard')||host.querySelector('.finance-focus-grid'))?.insertAdjacentElement('afterend',alert)}if(alert){alert.hidden=!bad.length;const html=bad.length?`<span>원가 때문에 계산 안 되는 수업</span><b>${bad.length}건</b><em>확인 →</em>`:'';setHtmlIfChanged(alert,html)}
    if(!host.querySelector(':scope > .ux-finance-more')){const more=document.createElement('details');more.className='ux-finance-more';more.innerHTML='<summary>수익 자세히 보기 <span>월 비교 · 메뉴별 · 수업별</span></summary><div class="ux-finance-more-body"></div>';const body=more.lastElementChild;[host.querySelector('.month-compare-card'),host.querySelector('.month-menu-card'),host.querySelector('.finance-detail-shell'),host.querySelector('.finance-method-note')].filter(Boolean).forEach(x=>body.appendChild(x));if(body.children.length)host.appendChild(more)}
  }

  function refresh(){setupChrome();navCopy();renderQueues();recipeCopy();classCopy();financeCopy();updateSaveState()}
  let refreshTimer=null;
  function scheduleRefresh(delay=0){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshTimer=null;refresh()},delay)}
  ['renderDashboard','renderRecipes','renderFinance','renderAll'].forEach(k=>{try{const base=window[k];if(typeof base==='function')window[k]=function(...args){const out=base.apply(this,args);scheduleRefresh(70);return out}}catch(e){}});
  document.addEventListener('click',e=>{const r=e.target.closest('[data-ux-cost-recipe]');if(r){e.preventDefault();openRecipe(r.dataset.uxCostRecipe);return}if(e.target.closest('[data-ux-open-costs],[data-ux-finance-costs]')){go('recipes');setTimeout(()=>document.getElementById('uxRecipeCostReview')?.scrollIntoView({behavior:'smooth',block:'start'}),120);return}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleRefresh(100)});
  setTimeout(()=>scheduleRefresh(0),850);
})();