(() => {
  const B = window.BakingBusiness;
  const D = window.BakingData;
  if (!B) return;
  const won = v => Number.isFinite(Number(v)) ? '₩' + Math.round(Number(v)).toLocaleString('ko-KR') : '—';
  const pc = v => Number.isFinite(Number(v)) ? Math.round(Number(v)) + '%' : '—';
  let rulesLoaded = false;
  let indexLoaded = false;
  let provenanceLoaded = false;
  let activeIndex = null;

  const context = source => ({ recipes: typeof recipes !== 'undefined' ? recipes : [], schedule: typeof schedule !== 'undefined' ? schedule : null, source });
  const sourceOf = raw => { try { return (history?.records || []).includes(raw) ? 'history' : 'schedule'; } catch (e) { return 'schedule'; } };

  async function loadGovernance() {
    if (typeof token === 'undefined' || !token || typeof get !== 'function' || typeof dec !== 'function') return false;
    try {
      const file = await get('data/business-rules.json');
      B.setRules(JSON.parse(dec(file.content)));
      rulesLoaded = true;
    } catch (e) {
      rulesLoaded = false;
      console.warn('Using embedded canonical business rules', e);
    }
    if (D) {
      try {
        const file = await get('data/entity-index.json');
        D.setIndex(JSON.parse(dec(file.content)));
        indexLoaded = true;
      } catch (e) {
        indexLoaded = false;
        console.warn('Entity index unavailable', e);
      }
      try {
        const file = await get('data/price-provenance.json');
        D.setProvenance(JSON.parse(dec(file.content)));
        provenanceLoaded = true;
      } catch (e) {
        provenanceLoaded = false;
        console.warn('Price provenance unavailable', e);
      }
    }
    applyNormalizedIds();
    return rulesLoaded && (!D || indexLoaded);
  }

  function applyNormalizedIds() {
    if (!D) return null;
    try { return D.applyEntityIndex(recipes, ingredients, schedule, history); } catch (e) { return null; }
  }

  function installCore() {
    applyNormalizedIds();
    try { recipeOf = name => B.findRecipeByName(name, recipes); } catch (e) {}
    try { finalCost = recipe => B.costState(recipe).usable; } catch (e) {}
    try {
      calc = raw => {
        const c = B.classFinancials(raw, context(sourceOf(raw)));
        return { rev:c.revenue, rec:c.recipe, mat:c.material, profit:c.profit, profitLabel:c.profitLabel, confidence:c.confidence, rent:c.rent, total:c.total, margin:c.margin, roi:c.roi, breakEven:c.breakEven };
      };
    } catch (e) {}
    try {
      events = () => {
        const map = new Map();
        (history?.records || []).forEach((r,i) => {
          if (!r?.date) return;
          const menu = r.menu || r.recipeCandidate || r.classTitle || '수업';
          const key = r.class_id || [r.date, r.time || r.session || '', B.canonicalRecipeName(menu)].join('|');
          map.set(key, { source:'history', id:r.class_id || r.id || 'h'+i, date:r.date, status:r.status || '완료', session:r.time || r.session || '', menu, people:Number(r.people)||0, revenue:B.revenue(r), raw:r });
        });
        (schedule?.rows || []).forEach((r,i) => {
          if (!r?.date) return;
          const menu = r.menu || r.classTitle || '메뉴 미정';
          const key = r.class_id || [r.date, r.time || r.session || '', B.canonicalRecipeName(menu)].join('|');
          if (map.has(key)) return;
          map.set(key, { source:'schedule', id:r.class_id || r.id || 's'+i, index:i, date:r.date, status:r.status || '예정', session:r.session || r.time || '', menu, people:Number(r.people)||0, revenue:B.revenue(r), raw:r });
        });
        return [...map.values()].sort((a,b) => a.date.localeCompare(b.date) || String(a.session).localeCompare(String(b.session)));
      };
    } catch (e) {}
    try {
      financeRow = e => {
        const c = B.classFinancials(e.raw, context(e.source));
        let label = c.recipe ? `${c.costStatus || '원가'} · 계산 보류` : '레시피 미연결';
        if (c.profit != null) label = `${c.profitLabel} ${won(c.profit)}${c.confidence === 'estimated' ? ' · 조건부 원가' : ''}`;
        return { date:e.date, source:e.source, menu:e.menu, people:e.people, revenue:e.revenue, profit:c.profit, label };
      };
    } catch (e) {}
  }

  function dataAuditItems() {
    const rows = (schedule?.rows || []).filter(r => r.status !== '취소');
    const unlinked = [...new Set(rows.filter(r => !B.findRecipe(r,recipes)).map(r => r.menu || r.classTitle).filter(Boolean))];
    const incomplete = recipes.filter(r => !B.costState(r).usable).map(r => r.name);
    const out = [
      ['Business rules', rulesLoaded ? 'canonical file loaded' : 'embedded canonical fallback'],
      ['Entity index', indexLoaded ? 'loaded' : (D ? 'load failed' : 'normalization module unavailable')],
      ['Price provenance', provenanceLoaded ? 'loaded' : (D ? 'load failed' : 'normalization module unavailable')],
      ['일정 ↔ 레시피 미연결', unlinked.length ? unlinked.join(', ') : '없음'],
      ['원가 미완료 레시피', incomplete.length ? incomplete.join(', ') : '없음']
    ];
    if (!D) return out;
    try {
      const id = D.identityCoverage(recipes,ingredients,schedule,history);
      out.push(['ID 커버리지', `레시피 ${id.recipes.ready}/${id.recipes.total} · 재료 ${id.ingredients.ready}/${id.ingredients.total} · 일정 ${id.schedule.ready}/${id.schedule.total} · 이력 ${id.history.ready}/${id.history.total}`]);
    } catch (e) {}
    try {
      const p = D.provenanceAudit(ingredients);
      out.push(['구매처 검증', `${p.verified}/${p.total} 확인 · 재확인 ${p.needsReview.length}개${p.needsReview.length ? ' (' + p.needsReview.slice(0,5).join(', ') + (p.needsReview.length>5?' 외':'') + ')' : ''}`]);
    } catch (e) {}
    try {
      const r = D.reconciliation(recipes,ingredients,5);
      const names = r.materialVariance.slice(0,5).map(x => `${x.name} ${x.variancePct > 0 ? '+' : ''}${Math.round(x.variancePct)}%`);
      out.push(['원가 재계산 완성도', `${r.complete}/${r.total} 레시피 · 저장원가 비교 가능 ${r.comparable}개`]);
      out.push(['저장원가 ↔ 재계산 차이 ≥5%', r.materialVariance.length ? `${r.materialVariance.length}개 (${names.join(', ')}${r.materialVariance.length>5?' 외':''})` : '없음']);
      const specific = r.rows.flatMap(x => x.missing.filter(m => m.state === 'specific-price-missing').map(m => `${x.name}: ${m.ingredient}`));
      if (specific.length) out.push(['지정 제품 단가 필요', specific.slice(0,6).join(', ') + (specific.length>6?' 외':'')]);
    } catch (e) {}
    return out;
  }

  function syncVisible() {
    installCore();
    document.getElementById('profitPlanner')?.remove();
    try {
      document.querySelectorAll('#scheduleList .schedule').forEach(card => {
        const row = schedule?.rows?.[Number(card.dataset.i)];
        if (!row) return;
        const c = B.classFinancials(row, context('schedule'));
        const chip = [...card.querySelectorAll('.ops-chip')].find(x => String(x.textContent || '').startsWith('마진'));
        if (chip) chip.textContent = `마진 ${c.margin == null ? '—' : pc(c.margin)}`;
      });
    } catch (e) {}
    try {
      const modal = document.getElementById('classOpsModal');
      if (modal?.classList.contains('open') && activeIndex != null) {
        const row = schedule?.rows?.[activeIndex];
        const c = row ? B.classFinancials(row, context('schedule')) : null;
        const metric = document.querySelectorAll('#opsMetrics .ops-metric')[3];
        if (c && metric) metric.innerHTML = `<span>${c.profitLabel}</span><b>${c.profit == null ? '계산 보류' : won(c.profit)}</b><small>${c.margin == null ? '원가 미확정' : `${c.confidence === 'estimated' ? '조건부 · ' : ''}마진 ${pc(c.margin)}`}</small>`;
        const host = document.getElementById('opsProfit');
        if (c && host) host.innerHTML = [
          ['예상 매출',won(c.revenue)],['재료 원가',c.material==null?'미산정':won(c.material)],['배합수',String(c.batchCount)],['대관료',won(c.rent)],['총 비용',c.total==null?'계산 보류':won(c.total)],[c.profitLabel,c.profit==null?'계산 보류':won(c.profit)],['손익분기 인원',c.breakEven==null?'—':c.breakEven+'명'],['ROI',c.roi==null?'—':pc(c.roi)]
        ].map(x => `<div class="ops-profit-item"><span>${x[0]}</span><b>${x[1]}</b><small>canonical business engine</small></div>`).join('');
      }
    } catch (e) {}
    try {
      const audit = document.getElementById('dataAudit');
      if (audit) audit.innerHTML = dataAuditItems().map(x => `<div class="audit-item"><b>${x[0]}</b><span class="subtle">${x[1]}</span></div>`).join('');
    } catch (e) {}
  }

  try {
    const baseConnect = connect;
    connect = async function(...args) {
      const result = await baseConnect.apply(this,args);
      await loadGovernance();
      syncVisible();
      try { renderAll(); } catch (e) {}
      return result;
    };
  } catch (e) {}

  ['renderDashboard','renderSchedule','renderFinance','renderAll'].forEach(name => {
    try {
      const base = window[name];
      if (typeof base !== 'function') return;
      window[name] = function(...args) {
        installCore();
        const result = base.apply(this,args);
        setTimeout(syncVisible,30);
        return result;
      };
    } catch (e) {}
  });

  document.addEventListener('click', e => {
    const el = e.target.closest?.('[data-ops-index], #scheduleList .schedule');
    const value = el?.dataset?.opsIndex ?? el?.dataset?.i;
    if (value != null && Number.isFinite(Number(value))) {
      activeIndex = Number(value);
      setTimeout(syncVisible,80);
    }
    if (e.target.closest?.('[data-ops-close]')) activeIndex = null;
  }, true);
  document.addEventListener('change', () => setTimeout(syncVisible,40), true);

  installCore();
  let attempts = 0;
  const boot = setInterval(async () => {
    attempts++;
    if (typeof token !== 'undefined' && token && typeof schedule !== 'undefined' && schedule) {
      await loadGovernance();
      syncVisible();
      try { renderAll(); } catch (e) {}
      clearInterval(boot);
    } else if (attempts > 20) {
      clearInterval(boot);
    }
  },150);
})();