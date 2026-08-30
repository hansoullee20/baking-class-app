(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const money=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const pct=v=>Number.isFinite(Number(v))?Math.round(Number(v))+'%':'—';
  let rulesLoaded=false,activeOpsIndex=null;

  function sourceOf(raw){
    try{return (history?.records||[]).includes(raw)?'history':'schedule'}catch(e){return'schedule'}
  }
  function ctx(source){return{recipes:typeof recipes!=='undefined'?recipes:[],schedule:typeof schedule!=='undefined'?schedule:null,source}}
  async function loadRules(){
    try{
      if(typeof token==='undefined'||!token||typeof get!=='function'||typeof dec!=='function')return false;
      const f=await get('data/business-rules.json');
      B.setRules(JSON.parse(dec(f.content)));
      rulesLoaded=true;
      return true;
    }catch(e){
      rulesLoaded=false;
      console.warn('business-rules.json load failed; canonical embedded defaults used',e);
      return false;
    }
  }

  function installCore(){
    try{recipeOf=name=>B.findRecipeByName(name,recipes)}catch(e){}
    try{finalCost=r=>B.costState(r).usable}catch(e){}
    try{
      calc=raw=>{
        const c=B.classFinancials(raw,ctx(sourceOf(raw)));
        return{rev:c.revenue,rec:c.recipe,mat:c.material,profit:c.profit,profitMin:c.estimatedProfitMin,profitMax:c.estimatedProfitMax,profitLabel:c.profitLabel,confidence:c.confidence,rent:c.rent,total:c.total,margin:c.margin,roi:c.roi,breakEven:c.breakEven};
      };
    }catch(e){}
    try{
      events=()=>{
        const by=new Map();
        (history?.records||[]).forEach((r,i)=>{
          if(!r?.date)return;
          const menu=r.menu||r.recipeCandidate||r.classTitle||'수업';
          const key=[r.date,r.time||r.session||'',B.canonicalRecipeName(menu)].join('|');
          by.set(key,{source:'history',id:r.class_id||r.id||'h'+i,date:r.date,status:r.status||'완료',session:r.time||r.session||'',menu,people:Number(r.people)||0,revenue:B.revenue(r),raw:r});
        });
        (schedule?.rows||[]).forEach((r,i)=>{
          if(!r?.date)return;
          const menu=r.menu||r.classTitle||'메뉴 미정';
          const key=[r.date,r.time||r.session||'',B.canonicalRecipeName(menu)].join('|');
          if(by.has(key))return;
          by.set(key,{source:'schedule',id:r.class_id||r.id||'s'+i,index:i,date:r.date,status:r.status||'예정',session:r.session||r.time||'',menu,people:Number(r.people)||0,revenue:B.revenue(r),raw:r});
        });
        return [...by.values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.session).localeCompare(String(b.session)));
      };
    }catch(e){}
    try{
      financeRow=e=>{
        const c=B.classFinancials(e.raw,ctx(e.source));
        let label;
        if(c.profit!=null){
          label=`${c.profitLabel} ${money(c.profit)}`;
          if(c.confidence==='estimated')label+=` · 조건부 원가`;
        }else if(c.recipe)label=`${c.costStatus||'원가'} · 계산 보류`;
        else label='레시피 미연결';
        return{date:e.date,source:e.source,menu:e.menu,people:e.people,revenue:e.revenue,profit:c.profit,label};
      };
    }catch(e){}
  }

  function syncOpsModal(){
    try{
      const modal=document.getElementById('classOpsModal');
      if(!modal?.classList.contains('open')||activeOpsIndex==null)return;
      const row=schedule?.rows?.[activeOpsIndex];if(!row)return;
      const c=B.classFinancials(row,ctx('schedule'));
      const metrics=[...document.querySelectorAll('#opsMetrics .ops-metric')];
      if(metrics[3])metrics[3].innerHTML=`<span>${c.profitLabel}</span><b>${c.profit==null?'계산 보류':money(c.profit)}</b><small>${c.profit==null?'원가 미확정':`${c.confidence==='estimated'?'조건부 · ':''}마진 ${pct(c.margin)}`}</small>`;
      const host=document.getElementById('opsProfit');
      if(host)host.innerHTML=[
        ['예상 매출',money(c.revenue),'수강생 × 수강료'],
        ['재료 원가',c.material==null?'미산정':money(c.material),c.recipe?`${c.costStatus}${c.confidence==='estimated'?' · 추정':''}`:'레시피 미연결'],
        ['배합수',String(c.batchCount),'수업별 명시 배합수'],
        ['대관료',money(c.rent),'저장값 우선 · 없으면 평일 81,000 / 토요일 90,000'],
        ['총 비용',c.total==null?'계산 보류':money(c.total),'재료 + 대관 + 포장 + 기타'],
        [c.profitLabel,c.profit==null?'계산 보류':money(c.profit),c.margin==null?'—':`마진 ${pct(c.margin)}`],
        ['손익분기 인원',c.breakEven==null?'—':c.breakEven+'명','총비용 ÷ 1인 수강료'],
        ['원가 대비 ROI',c.roi==null?'—':pct(c.roi),'이익 ÷ 총비용']
      ].map(x=>`<div class="ops-profit-item"><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>`).join('');
    }catch(e){}
  }

  function syncAudit(){
    try{
      const host=document.getElementById('dataAudit');if(!host)return;
      const future=(schedule?.rows||[]).filter(r=>r.status!=='취소');
      const unlinked=[...new Set(future.filter(r=>!B.findRecipe(r,recipes)).map(r=>r.menu||r.classTitle).filter(Boolean))];
      const conditional=recipes.filter(r=>B.costState(r).confidence==='estimated').map(r=>r.name);
      const incomplete=recipes.filter(r=>!B.costState(r).usable).map(r=>r.name);
      const items=[
        ['Business rules',rulesLoaded?'canonical file loaded':'embedded canonical fallback',!rulesLoaded],
        ['일정 ↔ 레시피 미연결',unlinked.length?unlinked.join(', '):'없음',unlinked.length>0],
        ['조건부 원가 레시피',conditional.length?conditional.join(', '):'없음',false],
        ['원가 미완료 레시피',incomplete.length?incomplete.join(', '):'없음',incomplete.length>0]
      ];
      host.innerHTML=items.map(x=>`<div class="audit-item"><b>${x[0]}</b><span class="${x[2]?'':'subtle'}">${x[1]}</span></div>`).join('');
    }catch(e){}
  }

  function refresh(){installCore();syncOpsModal();syncAudit()}
  try{
    const oldConnect=connect;
    connect=async function(...args){const out=await oldConnect.apply(this,args);await loadRules();refresh();try{renderAll()}catch(e){};return out};
  }catch(e){}
  ['renderDashboard','renderSchedule','renderFinance','renderAll'].forEach(name=>{
    try{
      const old=window[name];if(typeof old!=='function')return;
      window[name]=function(...args){installCore();const out=old.apply(this,args);setTimeout(()=>{syncOpsModal();syncAudit()},0);return out};
    }catch(e){}
  });
  document.addEventListener('click',e=>{
    const direct=e.target.closest?.('[data-ops-index]');
    const card=e.target.closest?.('#scheduleList .schedule');
    const value=direct?.dataset?.opsIndex??card?.dataset?.i;
    if(value!=null&&Number.isFinite(Number(value))){activeOpsIndex=Number(value);setTimeout(syncOpsModal,80)}
    if(e.target.closest?.('[data-ops-close]'))activeOpsIndex=null;
  },true);
  document.addEventListener('change',()=>setTimeout(syncOpsModal,30),true);

  installCore();
  let attempts=0;
  const boot=setInterval(async()=>{
    attempts++;
    try{
      if(typeof token!=='undefined'&&token&&typeof schedule!=='undefined'&&schedule){await loadRules();refresh();try{renderAll()}catch(e){};clearInterval(boot)}
      else if(attempts>20)clearInterval(boot);
    }catch(e){if(attempts>20)clearInterval(boot)}
  },150);
})();
