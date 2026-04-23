/**
 * Extract game data from vs2 .vgsht2 binary files into JSON.
 * Format: A9B8ABCD magic, header at 0x20, commands block, then ID array + data array.
 * Strings are XOR-obfuscated (OB style) — in vs2 they may be plain or partially obfuscated.
 */
const fs = require("fs");
const path = require("path");

const VS2_DATA = "E:/XB/解包/vs2/x64";
const OUT_DIR = path.join(__dirname, "gamedata");

// Game string obfuscation: per-byte transform based on index%14
function obfTransformByte(index, byte) {
  const i = index >>> 0;
  const b = byte & 0xff;
  let r8d = (((b & 0x55) << 2) | (b & 0xaa)) >>> 0;
  const q = Math.floor(i / 7);
  const cl = (i - q * 7) & 0x1f;
  r8d = (r8d << 7) >>> 0;
  r8d = r8d >>> cl;
  r8d = (r8d | (r8d >>> 8)) >>> 0;
  if ((i & 1) !== 0) r8d = (~r8d) >>> 0;
  return r8d & 0xff;
}

function obfDecryptBytes(data) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length && out[i] !== 0; i++) {
    out[i] = obfTransformByte(i, out[i]);
  }
  return out;
}

function readObfString(buf, offset) {
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  if (end === offset) return "";
  const raw = buf.slice(offset, end);
  const decoded = obfDecryptBytes(raw);
  return decoded.toString("utf8");
}

function parseGenericTable(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.slice(0, 4).toString("hex").toUpperCase();
  if (magic !== "A9B8ABCD") throw new Error(`Bad magic: ${magic}`);

  const fileSize = buf.readInt32LE(0x08);
  const count = buf.readInt32LE(0x10);
  const commandsCount = buf.readInt32LE(0x14);
  const eachSize = buf.readInt32LE(0x18);

  const commandsBlockSize = commandsCount * 0x4 + commandsCount * 0xc;
  const dataStart = 0x20 + commandsBlockSize;
  const idPadding = count * 0x4;
  const entriesStart = dataStart + idPadding;

  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(buf.readInt32LE(dataStart + i * 4));
  }

  return { buf, count, eachSize, ids, entriesStart, fileSize };
}

// ========== CHARACTER LIST ==========
function extractCharacterList() {
  const filePath = path.join(VS2_DATA, "012list/character_list/character_list.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);

  console.log(`character_list: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const characters = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    const nameOffset = buf.readInt32LE(off + 0x14);
    const name = readObfString(buf, nameOffset);

    const entry = {
      characterId: ids[i],
      indexInSeries: buf.readInt32LE(off + 0x00),
      name,
      seriesId: buf.readUInt32LE(off + 0x8c).toString(16).padStart(8, "0"),
      msState: buf.readInt32LE(off + 0xc4),
      cardIconIndex: buf.readInt32LE(off + 0xa4),
      characterIdUnique: buf.readInt32LE(off + 0xd4),
      lmbCutInHash: buf.readUInt32LE(off + 0x50).toString(16).padStart(8, "0"),
      lmbBoostHash: buf.readUInt32LE(off + 0x88).toString(16).padStart(8, "0"),
      selectPilotLmbHash: buf.readUInt32LE(off + 0xec).toString(16).padStart(8, "0"),
    };

    // Try to read more string fields
    const stringOffsets = [0x44, 0x54, 0x5c, 0x68, 0x70, 0x7c, 0x90, 0x98, 0xc8, 0xd8, 0xe4, 0x100, 0x10c, 0x120];
    const stringLabels = [
      "unkStr1", "weaponText1", "weaponText2", "unkStr4", "unkStr5",
      "unkStr6", "unkStr7", "unkStr8", "unkStr9", "unkStr10",
      "unkStr11", "unkStr12", "unkStr13", "unkStr14"
    ];
    for (let si = 0; si < stringOffsets.length; si++) {
      const strOff = buf.readInt32LE(off + stringOffsets[si]);
      if (strOff > 0 && strOff < buf.length) {
        const str = readObfString(buf, strOff);
        if (str && str.length > 0 && str.length < 200) {
          entry[stringLabels[si]] = str;
        }
      }
    }

    characters.push(entry);
  }

  return characters;
}

// ========== PILOT LIST ==========
function extractPilotList() {
  const filePath = path.join(VS2_DATA, "012list/pilot_list/pilot_list.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);
  console.log(`pilot_list: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const pilots = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    pilots.push({ pilotId: ids[i], rawHex: buf.slice(off, off + Math.min(eachSize, 32)).toString("hex") });
  }
  return pilots;
}

// ========== SERIES LIST ==========
function extractSeriesList() {
  const filePath = path.join(VS2_DATA, "012list/series_list/series_list.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);
  console.log(`series_list: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const series = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    const nameOff = buf.readInt32LE(off + 0x00);
    const name = (nameOff > 0 && nameOff < buf.length) ? readObfString(buf, nameOff) : `series_${ids[i]}`;
    series.push({ seriesId: ids[i], name, rawHex: buf.slice(off, off + Math.min(eachSize, 16)).toString("hex") });
  }
  return series;
}

// ========== MASTERY LIST ==========
function extractMasteryList() {
  const filePath = path.join(VS2_DATA, "012list/mastery_list/mastery_list.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);
  console.log(`mastery_list: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const masteries = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    const entry = { masteryId: ids[i] };
    for (let j = 0; j < eachSize; j += 4) {
      entry[`field_0x${j.toString(16)}`] = buf.readInt32LE(off + j);
    }
    masteries.push(entry);
  }
  return masteries;
}

// ========== SKILL LIST ==========
function extractSkillList() {
  const filePath = path.join(VS2_DATA, "012list/skill_list/skill_list.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);
  console.log(`skill_list: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const skills = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    const entry = { skillId: ids[i] };
    for (let j = 0; j < Math.min(eachSize, 32); j += 4) {
      entry[`field_0x${j.toString(16)}`] = buf.readInt32LE(off + j);
    }
    skills.push(entry);
  }
  return skills;
}

// ========== AWAKENING PARAM ==========
function extractAwakeningParam() {
  const filePath = path.join(VS2_DATA, "100system/awakening_param/awakening_param.vgsht2");
  const { buf, count, eachSize, ids, entriesStart } = parseGenericTable(filePath);
  console.log(`awakening_param: ${count} entries, eachSize=0x${eachSize.toString(16)}`);

  const params = [];
  for (let i = 0; i < count; i++) {
    const off = entriesStart + i * eachSize;
    const entry = { awakeningId: ids[i] };
    for (let j = 0; j < Math.min(eachSize, 64); j += 4) {
      entry[`field_0x${j.toString(16)}`] = buf.readInt32LE(off + j);
    }
    params.push(entry);
  }
  return params;
}

// ========== COST DATA (from 020common) ==========
function extractCostData() {
  const costDir = path.join(VS2_DATA, "020common");
  if (!fs.existsSync(costDir)) {
    console.log("020common not found, skipping cost extraction");
    return null;
  }
  const files = fs.readdirSync(costDir, { recursive: true }).filter(f => f.endsWith(".vgsht2") || f.endsWith(".bin"));
  console.log(`020common files: ${files.join(", ")}`);
  return files;
}

// ========== MAIN ==========
fs.mkdirSync(OUT_DIR, { recursive: true });

const result = {};

try {
  result.characters = extractCharacterList();
  console.log(`  → ${result.characters.length} characters extracted`);
} catch (e) { console.error("character_list error:", e.message); }

try {
  result.pilots = extractPilotList();
  console.log(`  → ${result.pilots.length} pilots extracted`);
} catch (e) { console.error("pilot_list error:", e.message); }

try {
  result.series = extractSeriesList();
  console.log(`  → ${result.series.length} series extracted`);
} catch (e) { console.error("series_list error:", e.message); }

try {
  result.masteries = extractMasteryList();
  console.log(`  → ${result.masteries.length} mastery entries extracted`);
} catch (e) { console.error("mastery_list error:", e.message); }

try {
  result.skills = extractSkillList();
  console.log(`  → ${result.skills.length} skill entries extracted`);
} catch (e) { console.error("skill_list error:", e.message); }

try {
  result.awakeningParams = extractAwakeningParam();
  console.log(`  → ${result.awakeningParams.length} awakening params extracted`);
} catch (e) { console.error("awakening_param error:", e.message); }

const costFiles = extractCostData();
if (costFiles) result.costFiles = costFiles;

// Write combined output
fs.writeFileSync(path.join(OUT_DIR, "vs2_gamedata.json"), JSON.stringify(result, null, 2));
console.log(`\nWrote gamedata/vs2_gamedata.json`);

// Write summary
const summary = {
  characters: result.characters?.length || 0,
  pilots: result.pilots?.length || 0,
  series: result.series?.length || 0,
  masteries: result.masteries?.length || 0,
  skills: result.skills?.length || 0,
  awakeningParams: result.awakeningParams?.length || 0,
};
console.log("\nSummary:", JSON.stringify(summary));

// Print first 3 characters as sample
if (result.characters?.length > 0) {
  console.log("\nSample characters:");
  result.characters.slice(0, 3).forEach(c => console.log(`  ${c.characterId}: ${c.name} (series=${c.seriesId}, state=${c.msState})`));
}
