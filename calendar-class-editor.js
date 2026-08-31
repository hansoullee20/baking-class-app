(() => {
  const B=window.BakingBusiness;
  if(!B)return;
  const $=id=>document.getElementById(id);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let selectedIndex=null;

  function currentRow(){return selectedIndex==null?null:schedule?.rows?.[selectedIndex]||null}
  function timeOf(r){
    if(/^\d{2}:\d{2}/.test(String(r?.time||'')))return String(r.time).slice(0,5);
    const session=String(r?.session||'');
    if(session.includes('오후'))return '14:00';
    if(session.includes('기타'))return '18:00';
    return '10:00';
  }
  function sessionFromTime(v){const h=Number(String(v||'10:00').slice(0,2));return h<13?'오전반':'오후반'}
  function menuOptions(sel){
    const list=typeof recipes!=='undefined'&&Array.isArray(recipes)?recipes:[];
    return '<option value="">메뉴 미정</option>'+list.map(r=>`<option value="${esc(r.name)}" ${r.name===sel?'selected':''}>${esc(r.name)}</option>`).join('');
  }
  function ensurePanel(){
    const dialog=document.querySelector('#classOpsModal .ops-dialog');
    if(!dialog||$('calendarClassCore'))return;
    const panel=document.createElement('section');panel.id='calendarClassCore';panel.className='calendar-class-core';
    const metrics=$('opsMetrics');if(metrics)metrics.before(panel);else dialog.querySelector('.ops-dialog-head')?.after(panel);
    panel.addEventListener('change',handleChange);
    panel.addEventListener('click',e=>{if(e.target.closest('#calendarDeleteClass'))deleteClass()});
  }
  function render(){
    ensurePanel();const host=$('calendarClassCore'),r=currentRow();if(!host||!r)return;
    const status=B.effectiveStatus?B.effectiveStatus(r):(r.status||'예정');
    host.innerHTML=`<div class="calendar-core-head"><div><h3>수업 정보</h3><p>달력에서 바로 운영 정보를 수정합니다.</p></div><span>${esc(status)}</span></div><div class="calendar-core-grid"><label>날짜<input data-core="date" type="date" value="${esc(r.date||'')}"></label><label>시간<input data-core="time" type="time" value="${esc(timeOf(r))}"></label><label>상태<select data-core="status"><option ${r.status==='예정'?'selected':''}>예정</option><option ${r.status==='확정'?'selected':''}>확정</option><option ${r.status==='완료'?'selected':''}>완료</option><option ${r.status==='취소'?'selected':''}>취소</option></select></label><label class="span2">메뉴<select data-core="menu">${menuOptions(r.menu||r.classTitle||'')}</select></label><label>수강생<input data-core="people" type="number" min="0" value="${num(r.people)}"></label><label>정원<input data-core="capacity" type="number" min="0" value="${num(r.capacity)||num(r.people)}"></label><label>수강료/인<input data-core="fee" type="number" min="0" value="${num(r.fee)}"></label><label>대관료<input data-core="rent" type="number" min="0" value="${num(r.rent)}"></label><label>배합수<input data-core="batchCount" type="number" min="0.25" step="0.25" value="${num(r.batchCount)||1}"></label></div><button id="calendarDeleteClass" type="button" class="calendar-delete-class">수업 삭제</button>`;
  }
  function handleChange(e){
    const el=e.target.closest('[data-core]'),r=currentRow();if(!el||!r)return;const k=el.dataset.core;let v=el.value;
    if(['people','capacity','fee','rent','batchCount'].includes(k))v=v===''?'':Number(v);
    if(k==='time'){r.time=v;r.session=sessionFromTime(v)}
    else{r[k]=v;if(k==='date')r.dow=B.dow(v);if(k==='menu')r.classTitle=v}
    try{mark('schedule')}catch(err){}
    try{renderAll()}catch(err){}
    setTimeout(()=>{render();const subtitle=$('opsSubtitle');if(subtitle)subtitle.textContent=`${r.date||''} · ${r.time||r.session||''} · ${num(r.people)}명 · ₩${Math.round(num(r.fee)).toLocaleString('ko-KR')}/인`},50);
  }
  function deleteClass(){
    const r=currentRow();if(!r||selectedIndex==null)return;if(!confirm(`${r.menu||r.classTitle||'이 수업'}을 삭제할까요?`))return;
    schedule.rows.splice(selectedIndex,1);try{mark('schedule')}catch(e){};selectedIndex=null;
    document.querySelector('#classOpsModal [data-ops-close]')?.click();try{renderAll()}catch(e){}
  }
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-ops-index],[data-canonical-open]');if(!trigger)return;
    const raw=trigger.dataset.opsIndex??trigger.dataset.canonicalOpen,index=Number(raw);if(!Number.isFinite(index)||!schedule?.rows?.[index])return;
    selectedIndex=index;setTimeout(render,20);
  },true);
  const observer=new MutationObserver(()=>{const modal=$('classOpsModal');if(modal?.classList.contains('open')&&selectedIndex!=null)setTimeout(render,0)});
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();
