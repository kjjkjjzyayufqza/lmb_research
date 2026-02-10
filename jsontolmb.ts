import * as fs from 'fs';
import * as path from 'path';
import { encodeLmbAst, type LmbAst } from './lmbast';

interface LmbJsonLike {
  ast?: LmbAst;
}

function main() {
  const argv = (globalThis as any).Bun?.argv
    ? (globalThis as any).Bun.argv.slice(2)
    : process.argv.slice(2);

  const inputPath = argv[0];
  if (!inputPath) {
    console.error('Usage: bun jsontolmb.ts <input.json> [output.lmb]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const outputPath =
    argv[1] ??
    path.join(
      path.dirname(resolvedInput),
      `${path.basename(resolvedInput, path.extname(resolvedInput))}.rebuild.lmb`,
    );

  const jsonText = fs.readFileSync(resolvedInput, 'utf8');
  const parsed = JSON.parse(jsonText) as LmbJsonLike;
  if (!parsed.ast) {
    throw new Error('Input JSON is missing `.ast` section. Re-export JSON using the updated lmbtojson.ts.');
  }

  const outBuf = encodeLmbAst(parsed.ast);
  fs.writeFileSync(outputPath, outBuf);

  console.log(`Wrote ${outputPath}`);
  console.log(`- bytes: ${outBuf.length}`);
}

main();

