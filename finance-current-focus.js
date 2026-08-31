(() => {
  function seoulMonth(){
    try{
      const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());
      const get=t=>p.find(x=>x.type===t)?.value||'';
      return{year:Number(get('year')),month:Number(get('month'))};
    }catch(e){const d=new Date();return{year:d.getFullYear(),month:d.getMonth()+1}}
  }
  function enhance(){
    const intro=document.querySelector('#finance .finance-focus-intro');if(!intro)return;
    const lead=intro.firstElementChild;if(!lead)return;
    const {year,month}=seoulMonth();
    lead.classList.add('finance-month-focus');
    const kicker=lead.querySelector(':scope > span');if(kicker)kicker.textContent='THIS MONTH · CURRENT OPERATING PERIOD';
    const h=lead.querySelector(':scope > h2');if(h)h.innerHTML=`<strong>${year}년 ${month}월</strong><em>이번 달</em>`;
    const p=lead.querySelector(':scope > p');if(p)p.textContent='현재까지의 실제 흐름과 이번 달 말 예상 흐름을 가장 먼저 확인합니다.';
    const current=document.querySelector('#finance .focus-flow-card.current h3');if(current)current.textContent='현재까지 실제 흐름';
    const forecast=document.querySelector('#finance .focus-flow-card.forecast h3');if(forecast)forecast.textContent='이번 달 말 예상 흐름';
    const compare=document.querySelector('#finance .month-compare-card .ledger-head h3');if(compare)compare.textContent='지난달부터 과거 월 비교';
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-page="finance"],#finance [data-compare-month],#finance [data-fin-menu]'))setTimeout(enhance,130)},true);
  try{const base=renderFinance;renderFinance=function(...args){const out=base.apply(this,args);setTimeout(enhance,160);return out}}catch(e){}
  try{const base=renderAll;renderAll=function(...args){const out=base.apply(this,args);setTimeout(enhance,260);return out}}catch(e){}
  setTimeout(enhance,1400);
})();
