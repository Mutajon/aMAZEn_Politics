import mammoth from 'mammoth';
import { writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const theoryDir = join(__dirname, '../src/data/theory');

const files = readdirSync(theoryDir).filter(f => f.endsWith('.docx'));

console.log(`Found ${files.length} .docx files to convert:\n`);

for (const file of files) {
  const result = await mammoth.extractRawText({ path: join(theoryDir, file) });
  // Convert filename: "AutonomyLONG.docx" -> "autonomy.md"
  const outputName = file.replace(/LONG\.docx$/i, '.md').toLowerCase();
  writeFileSync(join(theoryDir, outputName), result.value);
  console.log(`✓ Converted ${file} → ${outputName} (${result.value.length} characters)`);
}

console.log('\nConversion complete!');
