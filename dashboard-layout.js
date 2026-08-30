(() => {
  const byId=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const won=v=>Number.isFinite(Number(v))?'₩'+Math.round(Number(v)).toLocaleString('ko-KR'):'—';
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));

  function setText(el,value){
    if(el && el.textContent!==value) el.textContent=value;
  }
  function sectionTitle(id,title,sub,before){
    let el=byId(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;
      el.className='dashboard-section-title';
      el.innerHTML=`<div><h3>${title}</h3><p>${sub}</p></div>`;
      before?.parentNode?.insertBefore(el,before);
    }else{
      setText(el.querySelector('h3'),title);
      setText(el.querySelector('p'),sub);
    }
    return el;
  }

  function recipeFor(name){
    const aliases={'꾸덕브라우니':'브라우니','크랙소금빵':'소금빵','크랙소금빵 원데이':'소금빵'};
    try{return (recipes||[]).find(r=>r.name===name)||(recipes||[]).find(r=>r.name===aliases[name])||null}catch(e){return null}
  }
  function costReady(r){return !!r&&r.cost!=null&&!['부분원가','미산정'].includes(r.cost_status)}
  function payment(row){
    const list=Array.isArray(row.participants)?row.participants:[];
    const expected=list.length?list.reduce((s,p)=>s+(p.amountDue==null||p.amountDue===''?num(row.fee):num(p.amountDue)),0):num(row.people)*num(row.fee);
    const paid=list.reduce((s,p)=>{
      const due=p.amountDue==null||p.amountDue===''?num(row.fee):num(p.amountDue);
      return s+(p.paymentStatus==='입금완료'&&(p.amountPaid==null||p.amountPaid==='')?due:num(p.amountPaid));
    },0);
    return {expected,paid,outstanding:Math.max(0,expected-paid),rate:expected?paid/expected*100:0,hasRoster:list.length>0};
  }
  function profit(row){
    const rec=recipeFor(row.menu||row.recipeCandidate);
    if(!costReady(rec)) return {profit:null,margin:null};
    let rent=num(row.rent);
    if(!rent){
      const sat=(()=>{try{return typeof dow==='function'?dow(row.date)==='토':new Date(`${row.date}T00:00:00`).getDay()===6}catch(e){return false}})();
      rent=sat?num(schedule?.settings?.satRent||90000):num(schedule?.settings?.weekdayRent||81000);
    }
    const revenue=num(row.people)*num(row.fee);
    const total=num(rec.cost)*num(row.batchCount||1)+rent+num(row.packing)+num(row.other);
    const p=revenue-total;
    return {profit:p,margin:revenue?p/revenue*100:null};
  }

  function compactUpcoming(){
    const box=byId('upcoming');
    if(!box||box.querySelector('.dashboard-next-row')) return;
    let rows=[];
    try{
      rows=(schedule?.rows||[]).map((row,index)=>({row,index}))
        .filter(x=>x.row.status!=='취소'&&x.row.date>=today())
        .sort((a,b)=>a.row.date.localeCompare(b.row.date)||String(a.row.time||a.row.session||'').localeCompare(String(b.row.time||b.row.session||'')));
    }catch(e){}

    const summary=rows.reduce((a,x)=>{const p=payment(x.row);a.people+=num(x.row.people);a.paid+=p.paid;a.outstanding+=p.outstanding;return a},{people:0,paid:0,outstanding:0});
    const sum=byId('upcomingSummary');
    if(sum){
      sum.classList.add('dashboard-compact-summary');
      const html=[
        ['예정',`${rows.length}회`],
        ['예약',`${summary.people}명`],
        ['입금',won(summary.paid)],
        ['미수금',won(summary.outstanding)]
      ].map(x=>`<div class="dashboard-mini-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
      if(sum.innerHTML!==html) sum.innerHTML=html;
    }

    const shown=rows.slice(0,3);
    box.innerHTML=shown.length?`<div class="dashboard-next-list">${shown.map(({row,index})=>{
      const p=payment(row),c=profit(row),cap=row.capacity!=null&&row.capacity!==''?num(row.capacity):null;
      const people=cap!=null?`${num(row.people)}/${cap}명`:`${num(row.people)}명`;
      const payText=p.hasRoster?`${Math.round(p.rate)}%`:'미입력';
      const profitText=c.profit==null?'원가 미등록':won(c.profit);
      return `<button type="button" class="dashboard-next-row" data-ops-index="${index}">
        <div class="dashboard-next-main"><span>${safe(row.date.slice(5).replace('-','.'))} · ${safe(row.time||row.session||'시간 미정')} <em>${safe(row.bookingStatus||row.status||'예정')}</em></span><b>${safe(row.classTitle||row.menu||'메뉴 미정')}</b></div>
        <div class="dashboard-next-metrics">
          <div><span>인원</span><b>${people}</b></div>
          <div><span>입금</span><b>${payText}</b></div>
          <div><span>예상이익</span><b>${profitText}</b></div>
        </div>
      </button>`;
    }).join('')}</div><div class="dashboard-next-footer"><span>가장 가까운 3개 수업만 표시</span><button type="button" data-dashboard-schedule-link>일정 전체보기 →</button></div>`:'<div class="empty">예정 수업이 없습니다.</div>';
  }

  function organize(){
    const dash=byId('dashboard'); if(!dash) return;
    const hero=dash.querySelector('.hero');
    if(hero){
      setText(hero.querySelector('small'),"SUNNY'S ATELIER · OPERATIONS");
      setText(hero.querySelector('h2'),'운영 한눈에 보기');
      setText(hero.querySelector('p'),'이번 달 숫자와 다음 수업, 매출 흐름만 빠르게 확인합니다.');
    }
    const kpis=byId('kpis');
    if(kpis) sectionTitle('dashboardSummaryTitle','이번 달 요약','수업 · 수강생 · 매출 · 계산 이익',kpis);

    const grid=dash.querySelector(':scope > .grid2');
    if(grid){
      grid.classList.add('dashboard-core-grid');
      const cards=[...grid.children].filter(x=>x.classList.contains('card'));
      const up=cards[0],health=cards[1];
      if(up){
        up.id='dashboardUpcomingCard';
        const h=up.querySelector(':scope > h3');
        setText(h,'다음 수업');
        let sub=up.querySelector('.dashboard-card-sub');
        if(!sub){sub=document.createElement('p');sub.className='dashboard-card-sub';h?.insertAdjacentElement('afterend',sub)}
        setText(sub,'가장 가까운 3개 수업의 인원 · 입금 · 예상이익');
      }
      if(health){health.id='dashboardHealthCard';health.hidden=true}
      sectionTitle('dashboardUpcomingTitle','다음 수업','세부 일정 관리는 일정 탭에서 확인',grid);
      compactUpcoming();
    }

    const analytics=byId('dashboardAnalytics');
    if(analytics){
      sectionTitle('dashboardTrendTitle','운영 흐름','예약 · 충원 · 매출 추이와 필요한 조치',analytics);
      const k=byId('opsKpis');
      if(k) k.setAttribute('aria-label','예정 수업 운영 지표');
      const revenue=byId('opsRevenue')?.closest('.analytics-card');
      const insights=byId('opsInsights')?.closest('.analytics-card');
      revenue?.classList.add('dashboard-revenue-card');
      insights?.classList.add('dashboard-insight-card');
    }
  }

  function install(){
    document.addEventListener('click',e=>{
      if(!e.target.closest('[data-dashboard-schedule-link]')) return;
      e.preventDefault();
      document.querySelector('[data-page="schedule"]')?.click();
    });
    try{const old=renderDashboard;renderDashboard=function(){old();setTimeout(organize,0)}}catch(e){}
    try{const old=renderAll;renderAll=function(){old();setTimeout(organize,0)}}catch(e){}
    setTimeout(organize,450);
  }
  install();
})();
