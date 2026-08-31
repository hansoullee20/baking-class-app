const assert=require('assert');
const fs=require('fs');
const ui=fs.readFileSync('operations-ui.js','utf8');
const ops=fs.readFileSync('class-ops-canonical.js','utf8');
const planner=fs.readFileSync('management-planner.js','utf8');
const editor=fs.readFileSync('calendar-class-editor.js','utf8');
const status=fs.readFileSync('calendar-status.js','utf8');
const ia=fs.readFileSync('information-architecture.js','utf8');
const iaCss=fs.readFileSync('information-architecture.css','utf8');
const html=fs.readFileSync('index.html','utf8');

assert(!ui.includes('toISOString()'),'operations UI must not use UTC ISO conversion for local month boundaries');
assert(ui.includes('monthEnd'),'operations UI must define explicit local month boundary handling');
assert(ui.includes('B.effectiveStatus'),'operations UI must use canonical effective class status');
assert(ops.includes('B.classFinancials'),'class operations must use canonical financial engine');
assert(ops.includes('B.payment'),'class operations must use canonical payment engine');
assert(!ops.includes('function classCosts'),'legacy independent class-cost helper must not return');
assert(!ops.includes('rentForDay'),'legacy independent rent helper must not return');
assert(planner.includes('B.classFinancials'),'calendar planning must use canonical financial engine for scenario profit');
assert(planner.includes('localStorage'),'draft planning must remain separate from schedule until explicitly applied');
assert(planner.includes("mark('schedule')"),'explicit draft apply must use normal schedule persistence flow');
assert(editor.includes("mark('schedule')"),'legacy compatibility class editor must use normal schedule persistence flow');
assert(status.includes('B.payment'),'calendar seat indicators must use canonical payment state');
assert(status.includes('function seatStates'),'calendar status module must calculate one state per recruiting seat');
assert(status.includes("state:'open'")&&status.includes("state:'full'")&&status.includes("state:'paid'"),'calendar seat indicators must preserve empty/booked/paid states');
assert(status.includes('for(let i=0;i<capacity;i++)'),'calendar must render seat state from class capacity');
assert(status.includes('calendar-seat-dots'),'calendar events must render a seat-dot group');
assert(!status.includes('information-architecture.js'),'calendar status must not dynamically load the role-separation runtime a second time');

assert(ia.includes('renderLeanDashboard'),'dashboard must be action-oriented instead of repeating finance summaries');
assert(ia.includes('calendarMonthJump'),'single calendar must support direct navigation across past and future months');
assert(ia.includes('dayOpsModal'),'calendar date click must open the unified day management modal');
assert(ia.includes('data-day-edit'),'day modal must edit scheduled classes without opening a second class popup');
assert(ia.includes('data-person="paymentStatus"'),'day modal must manage participant payment state in the same popup');
assert(ia.includes('data-day-delete'),'day modal must support class deletion');
assert(ia.includes('dayOpsAddClass'),'future/current dates must support new class creation from the same popup');
assert(ia.includes("mark('schedule')"),'calendar day manager must persist through normal schedule persistence');
assert(ia.includes("$('recipeDecision').hidden=true"),'recipe tab must suppress duplicate dashboard-like summary cards');
assert(ia.includes('forecast.hidden=true'),'finance must suppress fixed next-month duplicate forecast');
assert(iaCss.includes('#calendar #calendarClassDetail')&&iaCss.includes('display:none!important'),'inline calendar detail must stay hidden in favor of the single day popup');
assert(iaCss.includes('#dashboard #operationsDashboard'),'legacy repeated dashboard summary must stay hidden');

assert(html.includes('id="calendarClassDetail"'),'calendar compatibility host must exist for legacy runtime');
assert(!html.includes('<button data-page="schedule">'),'schedule management must not remain a visible navigation destination');
assert(!html.includes('<button data-page="planner">'),'standalone month planner must not remain a visible navigation destination');
assert(html.includes('calendar-status.js'),'calendar status runtime must be loaded');
assert(html.includes('information-architecture.js'),'role-separation runtime must be loaded explicitly');
assert(html.includes('information-architecture.css'),'role-separation styling must be loaded explicitly');

const order=['app.js','business-engine.js','data-normalization.js','class-ops-canonical.js','business-engine-adapter.js','operations-ui.js','management-planner.js','calendar-class-editor.js','calendar-status.js','information-architecture.js'].map(x=>html.indexOf(x));
assert(order.every(x=>x>=0),'all canonical runtime modules must be loaded');
for(let i=1;i<order.length;i++)assert(order[i]>order[i-1],`runtime script order invalid at position ${i}`);

console.log('runtime architecture tests passed');
