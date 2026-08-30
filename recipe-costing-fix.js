(() => {
  function normalizeMissingAmounts(){
    try{
      (recipes||[]).forEach(r=>(r.ingredients||[]).forEach(i=>{
        if(i && (i.amount===null || i.amount==='')) delete i.amount;
      }));
    }catch(e){}
  }
  function refresh(){
    normalizeMissingAmounts();
    try{ if(typeof renderRecipes==='function') renderRecipes(); }catch(e){}
  }
  try{
    const oldAll=renderAll;
    renderAll=function(...args){normalizeMissingAmounts();return oldAll.apply(this,args);};
  }catch(e){}
  setTimeout(refresh,900);
  setTimeout(refresh,1600);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(refresh,120)});
})();
