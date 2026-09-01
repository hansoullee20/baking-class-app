(() => {
  if(typeof connect!=='function'||typeof get!=='function'||typeof renderAll!=='function')return;

  const baseConnect=connect;
  const componentRenderers={
    dashboard:typeof renderDashboard==='function'?renderDashboard:null,
    calendar:typeof renderCalendar==='function'?renderCalendar:null,
    schedule:typeof renderSchedule==='function'?renderSchedule:null,
    recipes:typeof renderRecipes==='function'?renderRecipes:null,
    nextMonth:typeof renderNextMonth==='function'?renderNextMonth:null,
    audit:typeof renderAudit==='function'?renderAudit:null,
    finance:typeof renderFinance==='function'?renderFinance:null
  };
  const resourceMap=()=>({
    schedule:[CFG.schedule,schedule],
    recipes:[CFG.recipes,recipes]
  });

  function stableRenderAll(){
    window.BleuInformationArchitecture?.refresh?.();
    componentRenderers.dashboard?.();
    componentRenderers.calendar?.();
    componentRenderers.schedule?.();
    componentRenderers.recipes?.();
    componentRenderers.nextMonth?.();
    componentRenderers.audit?.();
    const start=$('periodStart');
    if(start&&!start.value&&typeof preset==='function')preset('month');
    else componentRenderers.finance?.();
  }
  renderAll=stableRenderAll;

  function currentView(){
    return{
      page:document.querySelector('.page.active')?.id||'dashboard',
      scrollY:window.scrollY||0,
      openRecipes:[...document.querySelectorAll('#recipeList details.recipe[open]')].map(card=>card.querySelector('.rname')?.textContent?.trim()).filter(Boolean)
    };
  }

  function restoreView(view){
    if(!view)return;
    document.querySelectorAll('#recipeList details.recipe').forEach(card=>{
      const name=card.querySelector('.rname')?.textContent?.trim();
      if(name&&view.openRecipes.includes(name))card.open=true;
    });
    requestAnimationFrame(()=>window.scrollTo({top:view.scrollY,left:0,behavior:'auto'}));
  }

  async function fetchBundle(){
    const [s,r,h,i]=await Promise.all([get(CFG.schedule),get(CFG.recipes),get(CFG.history),get(CFG.ingredients)]);
    return{s,r,h,i,shas:{schedule:s.sha,recipes:r.sha,history:h.sha,ingredients:i.sha}};
  }

  async function refreshRemoteIfChanged(){
    if(loading||dirty.size||!token||conflict)return;
    loading=true;
    try{
      const bundle=await fetchBundle();
      const changed=Object.keys(bundle.shas).some(k=>bundle.shas[k]!==shas[k]);
      pill('connection','GitHub 연결됨','ok');
      if(!changed){pill('sync','최신 상태','ok');return}
      const view=currentView();
      schedule=JSON.parse(dec(bundle.s.content));
      recipes=JSON.parse(dec(bundle.r.content));
      history=JSON.parse(dec(bundle.h.content));
      ingredients=JSON.parse(dec(bundle.i.content));
      shas=bundle.shas;
      normalize();
      dirty.clear();
      conflict=false;
      pill('dirty','모두 저장됨','ok');
      pill('sync','새 데이터 반영','ok');
      stableRenderAll();
      restoreView(view);
    }catch(e){
      pill('sync','동기화 확인 필요','bad');
      err('최신 데이터 확인 실패: '+e.message);
    }finally{loading=false}
  }

  connect=async function(silent=false){
    if(silent&&token&&Object.keys(shas).length)return refreshRemoteIfChanged();
    return baseConnect(silent);
  };

  async function stableSaveAll(){
    if(!token||conflict||!dirty.size)return;
    clearTimeout(timer);
    const resources=resourceMap();
    const keys=[...dirty].filter(k=>resources[k]);
    if(!keys.length)return;
    const saved=[];
    try{
      pill('dirty','저장 전 확인 중…','warn');
      const latest=await Promise.all(keys.map(async k=>[k,await get(resources[k][0])]));
      const changed=latest.filter(([k,file])=>file.sha!==shas[k]).map(([k])=>k);
      if(changed.length){
        conflict=true;
        pill('sync','다른 변경 감지','bad');
        throw new Error(`다른 관리자가 먼저 저장했습니다: ${changed.join(', ')}. 다시 연결하세요.`);
      }
      pill('dirty','저장 중…','warn');
      for(const k of keys){
        const [path,obj]=resources[k];
        const res=await put(path,obj,shas[k],`Update ${k} ${new Date().toISOString()}`);
        shas[k]=res.content?.sha||shas[k];
        dirty.delete(k);
        saved.push(k);
      }
      pill('dirty','모두 저장됨','ok');
      pill('sync','최신 상태','ok');
      $('saveBtn').disabled=true;
      err('');
    }catch(e){
      pill('dirty','저장 실패','bad');
      const pending=[...dirty].join(', ')||'없음';
      const prefix=saved.length?`일부 저장됨: ${saved.join(', ')} · 남은 항목: ${pending}. `:'';
      err(prefix+e.message);
    }
  }

  saveAll=stableSaveAll;
  const saveButton=$('saveBtn');
  if(saveButton)saveButton.onclick=stableSaveAll;

  window.BleuStability={refreshRemoteIfChanged,saveAll:stableSaveAll,renderAll:stableRenderAll};
})();