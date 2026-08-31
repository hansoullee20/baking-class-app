(() => {
  function unify(){
    const host=document.getElementById('financeLedgerDetail');
    if(!host)return;
    const existing=host.querySelector(':scope > .finance-supercard');
    if(existing)return;
    const intro=host.querySelector(':scope > .finance-focus-intro');
    const grid=host.querySelector(':scope > .finance-focus-grid');
    const compare=host.querySelector(':scope > .month-compare-card');
    if(!intro||!grid||!compare)return;
    const card=document.createElement('section');
    card.className='finance-supercard';
    intro.insertAdjacentElement('beforebegin',card);
    card.append(intro,grid,compare);
    intro.classList.add('finance-super-intro');
    grid.classList.add('finance-super-flows');
    compare.classList.add('finance-super-compare');
    const current=grid.querySelector('.focus-flow-card.current');
    const forecast=grid.querySelector('.focus-flow-card.forecast');
    current?.classList.add('finance-viz-row');
    forecast?.classList.add('finance-viz-row');
    const currentTitle=current?.querySelector('.focus-flow-head h3');
    const forecastTitle=forecast?.querySelector('.focus-flow-head h3');
    if(currentTitle)currentTitle.textContent='현재까지 실제';
    if(forecastTitle)forecastTitle.textContent='월말 예상';
    const compareTitle=compare.querySelector('.ledger-head h3');
    if(compareTitle)compareTitle.textContent='지난달부터 비교';
  }
  function scheduleUnify(delay=80){setTimeout(unify,delay)}
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-page="finance"],#finance [data-compare-month],#finance [data-fin-menu]'))scheduleUnify(130);
  },true);
  try{
    const base=renderFinance;
    renderFinance=function(...args){const out=base.apply(this,args);scheduleUnify(160);return out};
  }catch(e){}
  try{
    const base=renderAll;
    renderAll=function(...args){const out=base.apply(this,args);scheduleUnify(260);return out};
  }catch(e){}
  scheduleUnify(1500);
})();
