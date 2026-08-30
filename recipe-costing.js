(() => {
  const $ = id => document.getElementById(id);
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const esc2 = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const aliases = {
    '따뜻한 우유':'우유','차가운 우유':'우유','찬우유':'우유',
    '녹인버터':'버터','녹인 버터':'버터','무염 버터':'버터','무염버터':'버터','틀 코팅 버터':'버터','앵커버터':'버터','충전용 버터':'버터',
    '전란':'계란','노른자':'계란','흰자':'계란','달걀':'계란',
    '필라델피아크림치즈':'크림치즈','필라델피아 크림치즈':'크림치즈',
    '휘핑크림':'생크림','전분':'옥수수전분','아몬드파우더':'아몬드가루','분유':'탈지분유','이스트':'드라이이스트','찬물':'물',
    '건무화과':'말린무화과','포도주':'와인','레몬제스트':'생레몬'
  };
  const approximateAliases = new Set(['레몬제스트']);

  function costItems(){
    const out = new Map();
    (ingredients?.items || []).forEach(i => out.set(String(i.name||'').trim(), i));
    return out;
  }
  function costItem(name){
    const map=costItems(), raw=String(name||'').trim();
    if(map.has(raw)) return {item:map.get(raw),canonical:raw,alias:false,approx:false};
    const canonical=aliases[raw];
    if(canonical && map.has(canonical)) return {item:map.get(canonical),canonical,alias:true,approx:approximateAliases.has(raw)};
    return {item:null,canonical:canonical||raw,alias:!!canonical,approx:false};
  }
  function parseAmount(v){
    if(Number.isFinite(Number(v))) return {kind:'number',min:Number(v),max:Number(v)};
    const s=String(v??'').trim();
    const range=s.match(/^(\d+(?:\.\d+)?)\s*[~～-]\s*(\d+(?:\.\d+)?)$/);
    if(range) return {kind:'range',min:Number(range[1]),max:Number(range[2])};
    return {kind:s?'text':'missing',text:s};
  }
  function yieldCount(recipe){
    const y=Number(recipe?.yield?.value);
    return Number.isFinite(y)&&y>0?y:null;
  }
  function quantityCost(amount, unit, item, recipe, ingredientName){
    const parsed=parseAmount(amount);
    if(parsed.kind==='missing') return {state:'usage-missing'};
    if(parsed.kind==='text') return {state:'structural',note:parsed.text};
    const unitText=String(unit||'').trim();
    let factor=1/100, note='';
    if(unitText==='개'){
      if(['계란','달걀','전란','노른자','흰자'].includes(ingredientName) || item?.name==='계란'){
        factor=50/100; note='계란 1개≈50g 환산';
      } else if(item?.name==='바닐라빈'){
        const perPiece=1900;
        return {state:'ok',min:parsed.min*perPiece,max:parsed.max*perPiece,note:'1개=₩1,900 구매단가 적용'};
      } else return {state:'unsupported',note:'개수 단가 환산 필요'};
    } else if(unitText.includes('/개')){
      const y=yieldCount(recipe);
      if(!y) return {state:'usage-missing',note:'수율 필요'};
      factor=y/100; note=`${unitText} × 수율 ${y}개`;
    } else if(unitText==='ml'){
      factor=1/100; note='1ml≈1g 원가 환산';
    } else if(unitText && unitText!=='g'){
      return {state:'unsupported',note:`${unitText} 환산 필요`};
    }
    return {state:'ok',min:parsed.min*num(item?.unit_cost)*factor,max:parsed.max*num(item?.unit_cost)*factor,note};
  }
  function ingredientQuote(ing, recipe){
    const match=costItem(ing?.name), parsed=parseAmount(ing?.amount);
    if(!match.item){
      if(parsed.kind==='text') return {state:'structural',match,parsed};
      return {state:'price-missing',match,parsed};
    }
    const c=quantityCost(ing?.amount,ing?.unit,match.item,recipe,ing?.name);
    return {...c,match,parsed};
  }
  function recipeQuote(recipe){
    const rows=(recipe?.ingredients||[]).map(ing=>({ing,q:ingredientQuote(ing,recipe)}));
    let min=0,max=0,priced=0,costable=0;
    const missingPrice=[],missingUsage=[],unsupported=[];
    rows.forEach(x=>{
      if(x.q.state==='structural') return;
      costable++;
      if(x.q.state==='ok'){
        priced++;min+=x.q.min;max+=x.q.max;
      } else if(x.q.state==='price-missing') missingPrice.push(x.ing.name);
      else if(x.q.state==='usage-missing') missingUsage.push(x.ing.name);
      else if(x.q.state==='unsupported') unsupported.push(x.ing.name);
    });
    const complete=costable>0 && priced===costable;
    return {rows,min,max,priced,costable,complete,missingPrice:[...new Set(missingPrice)],missingUsage:[...new Set(missingUsage)],unsupported:[...new Set(unsupported)]};
  }
  function costText(q){
    if(q.state==='price-missing') return '<span class="rc-missing">단가 필요</span>';
    if(q.state==='usage-missing') return '<span class="rc-missing">사용량 필요</span>';
    if(q.state==='unsupported') return '<span class="rc-missing">환산 필요</span>';
    if(q.state==='structural') return '<span class="rc-structural">하위배합/전량</span>';
    if(Math.abs(q.min-q.max)>0.5) return `${won(q.min)}–${won(q.max)}`;
    return won(q.min);
  }
  function totalText(rq){
    if(!rq.priced) return '계산 대기';
    const value=Math.abs(rq.min-rq.max)>0.5?`${won(rq.min)}–${won(rq.max)}`:won(rq.min);
    return rq.complete?value:`${value} + 미연결`;
  }
  function unitCostText(q){
    const item=q.match?.item;if(!item)return '—';
    if(item.name==='바닐라빈')return '₩1,900 / 1개';
    return `${won(item.unit_cost)} / ${esc2(item.unit||'100g')}`;
  }
  function contribution(q,rq){
    if(q.state!=='ok'||!rq.complete)return '—';
    const row=(q.min+q.max)/2,total=(rq.min+rq.max)/2;
    return total>0?`${Math.round(row/total*100)}%`:'—';
  }
  function yieldText(r){
    return r?.yield?.value?`${r.yield.value}${r.yield.unit||''}`:(r?.yield?.description||'—');
  }
  function timeText(r){
    return r?.time?.total || r?.time?.rest || '—';
  }
  function statusClass(s){return s==='확정'?'ok':s==='조건부'?'warn':'bad'}
  function ingredientRow(x,rq){
    const i=x.ing,q=x.q,item=q.match?.item;
    const note=[q.match?.alias?`${q.match.canonical} 단가 연결`:null,q.match?.approx?'근사 환산':null,q.note||null,item?.status||null].filter(Boolean).join(' · ');
    return `<tr class="${q.state!=='ok'&&q.state!=='structural'?'needs-cost':''}">
      <td><b>${esc2(i.name)}</b>${i.group?`<small>${esc2(i.group)}</small>`:''}</td>
      <td>${i.amount==null?'—':esc2(i.amount)}${i.unit?` ${esc2(i.unit)}`:''}</td>
      <td>${unitCostText(q)}${note?`<small>${esc2(note)}</small>`:''}</td>
      <td class="rc-money">${costText(q)}</td>
      <td>${contribution(q,rq)}</td>
    </tr>`;
  }
  function warnings(rq){
    const items=[];
    if(rq.missingPrice.length)items.push(`단가 필요: ${rq.missingPrice.join(', ')}`);
    if(rq.missingUsage.length)items.push(`사용량 필요: ${rq.missingUsage.join(', ')}`);
    if(rq.unsupported.length)items.push(`환산 필요: ${rq.unsupported.join(', ')}`);
    return items;
  }
  function overview(list){
    let costable=0,priced=0,complete=0,missing=new Set();
    list.forEach(r=>{const q=recipeQuote(r);costable+=q.costable;priced+=q.priced;if(q.complete)complete++;[...q.missingPrice,...q.missingUsage,...q.unsupported].forEach(x=>missing.add(x));});
    const rate=costable?Math.round(priced/costable*100):0;
    return {complete,rate,missing:[...missing]};
  }
  function ensureOverview(){
    const page=$('recipes');if(!page)return null;
    const head=page.querySelector(':scope > .section-head');
    if(head){const h=head.querySelector('h2'),p=head.querySelector('p');if(h)h.textContent='레시피 · 배합 원가';if(p)p.textContent='사용량 기준 재료 원가, 배합 총원가, 수율과 제조 공정을 한 화면에서 관리';}
    let o=$('recipeCostOverview');
    if(!o){o=document.createElement('div');o.id='recipeCostOverview';o.className='recipe-cost-overview';const tools=page.querySelector('.recipe-tools');tools?.before(o);}
    return o;
  }
  function currentList(){
    const q=String($('recipeSearch')?.value||'').trim().toLowerCase();
    return (recipes||[]).filter(r=>(filter==='all'||group(r)===filter)&&(!q||(`${r.name} ${(r.ingredients||[]).map(i=>i.name).join(' ')}`).toLowerCase().includes(q)))
      .sort((a,b)=>({missing:0,partial:1,final:2}[group(a)]-({missing:0,partial:1,final:2}[group(b)]))||a.name.localeCompare(b.name,'ko'));
  }
  function renderProRecipes(){
    const list=currentList(),o=ensureOverview(),ov=overview(recipes||[]);
    if(o)o.innerHTML=`<div><span>등록 레시피</span><b>${(recipes||[]).length}개</b><small>전체 소스 기준</small></div><div><span>재료 단가 연결률</span><b>${ov.rate}%</b><small>사용량 계산 가능한 재료 기준</small></div><div><span>완전 계산 레시피</span><b>${ov.complete}/${(recipes||[]).length}</b><small>모든 재료 단가·사용량 연결</small></div><div class="${ov.missing.length?'warn':''}"><span>확인 필요 재료</span><b>${ov.missing.length}개</b><small>${ov.missing.length?esc2(ov.missing.slice(0,3).join(', ')):'추가 확인 없음'}</small></div>`;
    const box=$('recipeList');if(!box)return;
    box.innerHTML=list.length?list.map(r=>{
      const rq=recipeQuote(r),saved=Number.isFinite(Number(r.cost))?Number(r.cost):null,y=yieldCount(r),perPiece=rq.complete&&y?rq.min/y:null,warn=warnings(rq),savedDiff=saved!=null&&rq.complete?saved-rq.min:null;
      return `<details class="recipe recipe-pro-card">
        <summary><div class="recipe-pro-summary"><div class="recipe-pro-title"><div class="recipe-pro-name">${esc2(r.name)}</div><div class="recipe-pro-meta"><span>수율 ${esc2(yieldText(r))}</span><span>소요 ${esc2(timeText(r))}</span>${r.recipe?`<span>${esc2(r.recipe)}</span>`:''}</div></div><div class="recipe-pro-costs"><div><span>재료 계산합계</span><b>${totalText(rq)}</b></div><div><span>저장 배합원가</span><b>${saved==null?'—':won(saved)}</b><small class="status-${statusClass(r.cost_status)}">${esc2(r.cost_status||'미산정')}</small></div>${perPiece!=null?`<div><span>1개당 재료원가</span><b>${won(perPiece)}</b></div>`:''}</div></div></summary>
        <div class="recipe-body recipe-pro-body">
          ${warn.length?`<div class="recipe-cost-alert">${warn.map(x=>`<span>${esc2(x)}</span>`).join('')}</div>`:''}
          <div class="recipe-cost-head"><div><h3>재료별 원가 Breakdown</h3><p>공통 재료 단가 × 실제 사용량. 별칭·환산 사용 시 기준을 함께 표시합니다.</p></div><div class="recipe-cost-total"><span>계산된 재료비</span><b>${totalText(rq)}</b>${savedDiff!=null&&Math.abs(savedDiff)>=1?`<small>저장 원가와 ${savedDiff>0?'+':''}${won(savedDiff)} 차이</small>`:''}</div></div>
          <div class="recipe-cost-tablewrap"><table class="recipe-cost-table"><thead><tr><th>재료</th><th>사용량</th><th>기준 단가</th><th>들어간 원가</th><th>기여율</th></tr></thead><tbody>${rq.rows.map(x=>ingredientRow(x,rq)).join('')}</tbody><tfoot><tr><td colspan="3"><b>재료비 합계</b><small>${rq.complete?'전체 재료 계산 완료':'미연결 항목은 합계에서 제외'}</small></td><td class="rc-money"><b>${totalText(rq)}</b></td><td>${rq.complete?'100%':'—'}</td></tr></tfoot></table></div>
          <div class="recipe-pro-lower"><div><div class="recipe-subhead"><h3>제조 공정</h3><span>${(r.process||[]).length} steps</span></div>${(r.process||[]).length?`<ol class="steps recipe-steps">${r.process.map(s=>`<li>${esc2(s)}</li>`).join('')}</ol>`:'<div class="empty">확정된 공정 정보가 없습니다.</div>'}</div><div class="recipe-control-card"><div class="recipe-subhead"><h3>운영 원가</h3><span>수익 계산에 사용</span></div><div class="recipe-control-grid"><div class="field"><label>저장 배합원가</label><input data-r="${esc2(r.name)}" data-rk="cost" type="number" value="${r.cost??''}"></div><div class="field"><label>원가 상태</label><select data-r="${esc2(r.name)}" data-rk="status"><option ${r.cost_status==='확정'?'selected':''}>확정</option><option ${r.cost_status==='조건부'?'selected':''}>조건부</option><option ${r.cost_status==='부분원가'?'selected':''}>부분원가</option><option ${r.cost_status==='미산정'?'selected':''}>미산정</option></select></div><button class="btn small" data-action="recipe-save" data-name="${esc2(r.name)}">원가 저장</button></div><div class="recipe-control-note">재료 계산합계는 단가표에서 자동 계산됩니다. 저장 배합원가는 수업 수익 계산에 쓰는 운영 기준값입니다.</div></div></div>
        </div>
      </details>`;
    }).join(''):'<div class="empty">해당 레시피가 없습니다.</div>';
  }

  function install(){
    try{window.renderRecipes=renderProRecipes;}catch(e){}
    const search=$('recipeSearch');if(search)search.oninput=renderProRecipes;
    document.querySelectorAll('[data-filter]').forEach(b=>{b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderProRecipes();};});
    setTimeout(renderProRecipes,450);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&$('recipes')?.classList.contains('active'))setTimeout(renderProRecipes,100)});
  }
  install();
})();
