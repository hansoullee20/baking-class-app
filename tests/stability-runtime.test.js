const assert=require('assert');
const fs=require('fs');

const html=fs.readFileSync('index.html','utf8');
const queue=fs.readFileSync('cost-review-queue.js','utf8');
const stability=fs.readFileSync('stability-runtime.js','utf8');

function tagFor(src){
  const escaped=src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=html.match(new RegExp(`<script[^>]*src=["']${escaped}(?:\\?[^"']*)?["'][^>]*>`,`i`));
  return match?.[0]||'';
}
function active(src){
  const tag=tagFor(src);
  return !!tag&&!/type=["']text\/plain["']/i.test(tag);
}

['app.js','information-architecture.js','workspace-refinement.js','recipe-ingredient-costs.js','finance-ledger-detail.js','cost-review-queue.js','stability-runtime.js'].forEach(src=>{
  assert(active(src),`${src} must be an executable runtime script`);
});
['operations-ui.js','calendar-class-editor.js','finance-current-focus.js','finance-unified.js','recipe-three-menu.js'].forEach(src=>{
  assert(!active(src),`${src} must remain disabled in stable runtime mode`);
});

assert(queue.includes(`'"':'&quot;'`),'cost review HTML escaping must terminate &quot; correctly');
assert(!queue.includes("document.addEventListener('input'"),'cost review must not refresh the entire UX on every input');
assert(!queue.includes("document.addEventListener('change'"),'cost review must not refresh the entire UX on every change');
assert(stability.includes('refreshRemoteIfChanged'),'stability runtime must check remote changes without unconditional reconnect rendering');
assert(stability.includes('Object.keys(bundle.shas).some'),'remote refresh must compare SHAs before rendering');
assert(stability.includes('stableSaveAll'),'stability runtime must own preflighted multi-resource saves');
assert(stability.includes('Promise.all(keys.map'),'all dirty resource SHAs must be checked before the first write');
assert(stability.includes('일부 저장됨'),'partial network-save failures must be explicit to the operator');

console.log('stability runtime tests passed');
