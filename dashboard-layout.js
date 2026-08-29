(() => {
  const byId=id=>document.getElementById(id);
  function sectionTitle(id,title,sub,before){
    let el=byId(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;
      el.className='dashboard-section-title';
      el.innerHTML=`<div><h3>${title}</h3><p>${sub}</p></div>`;
      before?.parentNode?.insertBefore(el,before);
    }
    return el;
  }
  function organize(){
    const dash=byId('dashboard'); if(!dash) return;
    const hero=dash.querySelector('.hero');
    if(hero){
      const small=hero.querySelector('small'),h=hero.querySelector('h2'),p=hero.querySelector('p');
      if(small) small.textContent="SUNNY'S ATELIER · OPERATIONS";
      if(h) h.textContent='오늘의 운영 현황';
      if(p) p.textContent='매출, 일정, 입금, 원가 상태를 우선순위대로 확인합니다.';
    }
    const kpis=byId('kpis');
    if(kpis) sectionTitle('dashboardSummaryTitle','이번 달 요약','이번 달 수업·수강생·매출·계산 가능한 이익',kpis);

    const grid=dash.querySelector(':scope > .grid2');
    if(grid){
      grid.classList.add('dashboard-core-grid');
      const cards=[...grid.children].filter(x=>x.classList.contains('card'));
      const up=cards[0],health=cards[1];
      if(up){
        up.id='dashboardUpcomingCard';
        const h=up.querySelector(':scope > h3');
        if(h) h.textContent='다가오는 수업';
        let sub=up.querySelector('.dashboard-card-sub');
        if(!sub){sub=document.createElement('p');sub.className='dashboard-card-sub';sub.textContent='시간 · 예약 인원 · 입금 · 미수금 · 예상이익을 수업별로 확인';h?.insertAdjacentElement('afterend',sub)}
      }
      if(health){
        health.id='dashboardHealthCard';
        if(!health.querySelector('.dashboard-health-head')){
          const head=document.createElement('div');head.className='dashboard-health-head';head.innerHTML='<h3>운영 체크</h3><span>준비 상태</span>';health.prepend(head);
        }
        const hs=health.querySelectorAll(':scope > h3');
        if(hs[0]) hs[0].textContent='원가 준비도';
        if(hs[1]) hs[1].textContent='수업 상태';
      }
      sectionTitle('dashboardUpcomingTitle','앞으로 할 일','다가오는 수업과 준비 상태를 먼저 확인',grid);
    }

    const analytics=byId('dashboardAnalytics');
    if(analytics){
      sectionTitle('dashboardTrendTitle','운영 추이','예약 흐름과 매출 추이, 지금 확인해야 할 운영 신호',analytics);
      const k=byId('opsKpis');
      if(k) k.setAttribute('aria-label','예정 수업 운영 지표');
      const revenue=byId('opsRevenue')?.closest('.analytics-card');
      const insights=byId('opsInsights')?.closest('.analytics-card');
      revenue?.classList.add('dashboard-revenue-card');
      insights?.classList.add('dashboard-insight-card');
    }
  }
  function install(){
    try{const old=renderDashboard;renderDashboard=function(){old();setTimeout(organize,0)}}catch(e){}
    try{const old=renderAll;renderAll=function(){old();setTimeout(organize,0)}}catch(e){}
    const dash=byId('dashboard');
    if(dash){new MutationObserver(()=>{clearTimeout(window.__dashboardOrganizeTimer);window.__dashboardOrganizeTimer=setTimeout(organize,40)}).observe(dash,{childList:true,subtree:true})}
    setTimeout(organize,450);
  }
  install();
})();
