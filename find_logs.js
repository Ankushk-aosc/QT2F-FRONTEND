const fs = require('fs');
const files = fs.readdirSync('C:/Users/Admin/.gemini/antigravity-ide/brain');
let found = 0;
for (const dir of files) {
  try {
    const p = `C:/Users/Admin/.gemini/antigravity-ide/brain/${dir}/.system_generated/logs/transcript.jsonl`;
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('Parsing started') || content.includes('mapping_results') || content.includes('assessment_results')) {
        console.log('Found in', dir);
        found++;
        if (found > 2) break;
      }
    }
  } catch (e) {}
}
