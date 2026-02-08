// Quick script to analyze do_action unknown fields from the raw LMB
const KaitaiStream = require('kaitai-struct').KaitaiStream;
const fs = require('fs');

// Load Lmb.js via its UMD pattern
const fakeExports = {};
const factory = require('./Lmb.js');
// The UMD wrapper already ran and wrote to fakeExports or global
// Let's try the direct approach
let Lmb;
try {
  // The module uses `factory(exports, KaitaiStream)` pattern
  // So after require, the export should be in the module
  const mod = {};
  // Re-evaluate by providing our own exports object
  const vm = require('vm');
  const code = fs.readFileSync('./Lmb.js', 'utf8');
  const script = new vm.Script(code);
  const context = vm.createContext({
    self: global,
    KaitaiStream: KaitaiStream,
    Lmb: {},
    define: undefined,
    exports: undefined,
    module: undefined,
    require: undefined,
  });
  script.runInContext(context);
  Lmb = context.Lmb.Lmb;
} catch(e) {
  console.error('Failed to load Lmb:', e.message);
  process.exit(1);
}

console.log('Lmb loaded:', typeof Lmb);

const buf = fs.readFileSync('machineselect.lm');
const parsed = new Lmb(new KaitaiStream(buf));

// Find all action_script tags
function findTags(tags, targetType, path) {
  const results = [];
  if (!tags) return results;
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    if (t.tagType === targetType) {
      results.push({ path: path + '[' + i + ']', data: t.data });
    }
    if (t.children && t.children.length > 0) {
      results.push(...findTags(t.children, targetType, path + '>' + t.tagType + '[' + i + ']'));
    }
  }
  return results;
}

// 0xF005 = 61445 = action_script
const actionScripts = findTags(parsed.lmb.tags, 61445, 'root');
console.log('\n=== ACTION_SCRIPT tags ===');
console.log('Count:', actionScripts.length);
actionScripts.forEach((as, idx) => {
  const bc = as.data.bytecode;
  console.log('ActionScript[' + idx + '] at ' + as.path + ': bytecode length=' + bc.length + ' bytes=' + Array.from(bc.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
});

// 0xFF05 = 65285 = action_script_2
const actionScripts2 = findTags(parsed.lmb.tags, 65285, 'root');
console.log('\n=== ACTION_SCRIPT_2 tags ===');
console.log('Count:', actionScripts2.length);
actionScripts2.forEach((as, idx) => {
  const bc = as.data.bytecode;
  console.log('ActionScript2[' + idx + '] at ' + as.path + ': bytecode length=' + bc.length + ' bytes=' + Array.from(bc.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' '));
});

// 0x000C = 12 = do_action
console.log('\n=== DO_ACTION unique (actionId, unknown) pairs ===');
const doActions = findTags(parsed.lmb.tags, 12, 'root');
const pairs = new Map();
doActions.forEach(da => {
  const key = da.data.actionId + ',' + da.data.unknown;
  if (!pairs.has(key)) {
    pairs.set(key, { actionId: da.data.actionId, unknown: da.data.unknown, count: 0, examples: [] });
  }
  const p = pairs.get(key);
  p.count++;
  if (p.examples.length < 3) p.examples.push(da.path);
});
for (const [, info] of pairs) {
  console.log('actionId=' + info.actionId + ' unknown=' + info.unknown + ' (0x' + info.unknown.toString(16) + ') count=' + info.count);
}
