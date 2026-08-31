(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BakingBusiness=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const hasNum=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
  const DEFAULT_RULES={
    version:1,timezone:'Asia/Seoul',currency:'KRW',
    rental:{mode:'stored_or_default',manualClassValueHasPriority:true,defaultByDay:{saturday:90000,other:81000},hourlyHeadcountAutoModelEnabled:false},
    batching:{mode:'manual_class_multiplier',defaultBatchCount:1,autoScaleByStudentCount:false},
    recipeMatching:{aliases:{'꾸덕브라우니':'브라우니','크랙소금빵':'소금빵','크랙소금빵 원데이':'소금빵','무화과깜빠뉴':'무화과깜파뉴','밤에끌레어':'밤 에끌레어','판나코타':'판나코타 (panna cotta)'}},
    costing:{costStatuses:{'확정':{usableForEstimate:true,confidence:'confirmed'},'조건부':{usableForEstimate:true,confidence:'estimated'},'부분원가':{usableForEstimate:false,confidence:'incomplete'},'미산정':{usableForEstimate:false,confidence:'incomplete'}}},
    profit:{actualProfitOverride:true,historyMethod:'current_recipe_cost_estimate_unless_actual_profit_exists',historyEstimateLabel:'현재 원가 기준 추정이익',plannedEstimateLabel:'예상이익',actualLabel:'실제이익'}
  };
  let rules=JSON.parse(JSON.stringify(DEFAULT_RULES));

  function merge(base,extra){
    if(!extra||typeof extra!=='object')return base;
    const out=Array.isArray(base)?base.slice():{...(base||{})};
    Object.keys(extra).forEach(k=>{
      const v=extra[k];
      out[k]=(v&&typeof v==='object'&&!Array.isArray(v))?merge(out[k]||{},v):v;
    });
    return out;
  }
  function setRules(next){rules=merge(DEFAULT_RULES,next||{});return rules}
  function getRules(){return rules}
  function dow(date){
    if(!date)return'';
    const [y,m,d]=String(date).split('-').map(Number);
    if(!y||!m||!d)return'';
    return ['일','월','화','수','목','금','토'][new Date(Date.UTC(y,m-1,d)).getUTCDay()];
  }
  function zonedDate(now=new Date()){
    const d=now instanceof Date?now:new Date(now);
    const tz=rules?.timezone||'Asia/Seoul';
    if(Number.isNaN(d.getTime()))return'';
    try{
      const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
      const get=t=>p.find(x=>x.type===t)?.value||'';
      return `${get('year')}-${get('month')}-${get('day')}`;
    }catch(e){
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
  }
  function effectiveStatus(raw,now=new Date()){
    const status=String(raw?.status||'예정').trim()||'예정';
    if(status==='취소')return'취소';
    const date=String(raw?.date||'').trim();
    if(!date)return status;
    const current=zonedDate(now);
    return current&&date<current?'완료':status;
  }
  function aliases(){return rules?.recipeMatching?.aliases||{}}
  function canonicalRecipeName(name){
    const raw=String(name||'').trim();
    return aliases()[raw]||raw;
  }
  function findRecipeByName(name,recipes){
    const list=Array.isArray(recipes)?recipes:[];
    const raw=String(name||'').trim();
    if(!raw)return null;
    return list.find(r=>r?.name===raw)||list.find(r=>r?.name===canonicalRecipeName(raw))||null;
  }
  function findRecipe(raw,recipes){
    if(!raw)return null;
    const list=Array.isArray(recipes)?recipes:[];
    if(raw.recipe_id){const hit=list.find(r=>r?.recipe_id&&r.recipe_id===raw.recipe_id);if(hit)return hit}
    const names=[raw.menu,raw.recipeCandidate,raw.classTitle].filter(Boolean);
    for(const name of names){const hit=findRecipeByName(name,list);if(hit)return hit}
    return null;
  }
  function effectiveCostSpec(recipe){
    if(!recipe)return null;
    const overlay=recipe.__costOverlay&&typeof recipe.__costOverlay==='object'?recipe.__costOverlay:null;
    if(overlay&&overlay.apply!==false&&hasNum(overlay.cost))return{source:'overlay',cost:Number(overlay.cost),status:overlay.cost_status||'조건부',range:overlay.cost_range||null,overlay};
    return{source:'recipe',cost:hasNum(recipe.cost)?Number(recipe.cost):null,status:recipe.cost_status||'미산정',range:recipe.cost_range||null,overlay:null};
  }
  function costState(recipe){
    if(!recipe)return{usable:false,status:'미연결',confidence:'incomplete',amount:null,min:null,max:null,source:'missing'};
    const spec=effectiveCostSpec(recipe),status=spec.status;
    const rule=rules?.costing?.costStatuses?.[status]||{usableForEstimate:false,confidence:'incomplete'};
    const usable=!!rule.usableForEstimate&&hasNum(spec.cost);
    let amount=usable?Number(spec.cost):null,min=amount,max=amount;
    if(usable&&spec.range&&hasNum(spec.range.min)&&hasNum(spec.range.max)){
      min=Number(spec.range.min);max=Number(spec.range.max);
    }
    return{usable,status,confidence:rule.confidence||'incomplete',amount,min,max,source:spec.source,overlay:spec.overlay};
  }
  function batchCount(raw){
    const def=num(rules?.batching?.defaultBatchCount)||1;
    return hasNum(raw?.batchCount)&&Number(raw.batchCount)>0?Number(raw.batchCount):def;
  }
  function revenue(raw){
    if(raw?.status==='취소')return 0;
    if(hasNum(raw?.revenue))return Number(raw.revenue);
    return num(raw?.people)*num(raw?.fee);
  }
  function rent(raw,schedule){
    if(rules?.rental?.manualClassValueHasPriority!==false&&hasNum(raw?.rent))return Number(raw.rent);
    const settings=schedule?.settings||{};
    const sat=num(settings.satRent)||num(rules?.rental?.defaultByDay?.saturday)||90000;
    const other=num(settings.weekdayRent)||num(rules?.rental?.defaultByDay?.other)||81000;
    return dow(raw?.date)==='토'?sat:other;
  }
  function materialCost(raw,recipe){
    const cs=costState(recipe),b=batchCount(raw);
    if(!cs.usable)return{amount:null,min:null,max:null,batchCount:b,costState:cs};
    return{amount:cs.amount*b,min:cs.min*b,max:cs.max*b,batchCount:b,costState:cs};
  }
  function payment(raw){
    const list=Array.isArray(raw?.participants)?raw.participants:[],fee=num(raw?.fee),people=Math.max(0,num(raw?.people));
    const participantExpected=list.reduce((s,p)=>s+(hasNum(p?.amountDue)?Number(p.amountDue):fee),0);
    const missingRosterCount=Math.max(0,people-list.length);
    const expected=participantExpected+missingRosterCount*fee;
    const collected=list.reduce((s,p)=>{
      const due=hasNum(p?.amountDue)?Number(p.amountDue):fee;
      if(p?.paymentStatus==='입금완료'&&!hasNum(p?.amountPaid))return s+due;
      return s+num(p?.amountPaid);
    },0);
    const completed=raw?.paymentComplete===true;
    const completedAmount=completed?(hasNum(raw?.paymentCompletedAmount)?Number(raw.paymentCompletedAmount):expected):null;
    const paid=completed?Math.max(collected,completedAmount):collected;
    return{expected,collected:paid,outstanding:Math.max(0,expected-paid),rate:expected>0?paid/expected*100:0,participantCount:list.length,missingRosterCount};
  }
  function classFinancials(raw,ctx){
    const source=ctx?.source||'schedule',recipe=findRecipe(raw,ctx?.recipes||[]),rev=revenue(raw),mat=materialCost(raw,recipe),r=rent(raw,ctx?.schedule),packing=num(raw?.packing),other=num(raw?.other);
    const total=mat.amount==null?null:mat.amount+r+packing+other;
    const est=total==null?null:rev-total;
    const estMin=mat.max==null?null:rev-(mat.max+r+packing+other);
    const estMax=mat.min==null?null:rev-(mat.min+r+packing+other);
    const actual=rules?.profit?.actualProfitOverride!==false&&hasNum(raw?.actualProfit)?Number(raw.actualProfit):null;
    const profit=actual!=null?actual:est;
    const margin=profit==null||rev<=0?null:profit/rev*100;
    const roi=profit==null||total==null||total<=0?null:profit/total*100;
    const feePerPerson=num(raw?.fee),breakEven=total!=null&&feePerPerson>0?Math.ceil(total/feePerPerson):null;
    let label=rules?.profit?.plannedEstimateLabel||'예상이익';
    if(actual!=null)label=rules?.profit?.actualLabel||'실제이익';
    else if(source==='history')label=rules?.profit?.historyEstimateLabel||'현재 원가 기준 추정이익';
    const confidence=actual!=null?'actual':mat.costState.confidence;
    return{source,recipe,revenue:rev,material:mat.amount,materialMin:mat.min,materialMax:mat.max,batchCount:mat.batchCount,rent:r,packing,other,total,estimatedProfit:est,estimatedProfitMin:estMin,estimatedProfitMax:estMax,actualProfit:actual,profit,margin,roi,breakEven,costStatus:mat.costState.status,costSource:mat.costState.source,confidence,profitLabel:label};
  }
  function classKey(raw){return raw?.class_id||raw?.id||[raw?.date,raw?.time||raw?.session,canonicalRecipeName(raw?.menu||raw?.classTitle||'')].join('|')}
  function dedupeEvents(rows){
    const seen=new Set();return (rows||[]).filter(x=>{const k=classKey(x?.raw||x);if(seen.has(k))return false;seen.add(k);return true});
  }
  return{version:'1.3.0',DEFAULT_RULES,setRules,getRules,dow,zonedDate,effectiveStatus,canonicalRecipeName,findRecipeByName,findRecipe,effectiveCostSpec,costState,batchCount,revenue,rent,materialCost,payment,classFinancials,classKey,dedupeEvents};
});
