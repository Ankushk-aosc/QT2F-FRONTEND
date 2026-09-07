const fs = require('fs');
const currentConv = 'C:/Users/Admin/.gemini/antigravity-ide/brain/51c713b1-59e2-43ab-8ee8-77a39d29afc4/.system_generated/logs/transcript.jsonl';
const content = fs.readFileSync(currentConv, 'utf8');

const extract = (prefix, regexPattern) => {
  const match = content.match(regexPattern);
  if (match) {
    fs.writeFileSync(`f:/frontend qlik and tableau/${prefix}_sample.json`, match[0]);
    console.log(`Saved ${prefix}`);
  }
}

// Just look for the words in JSON strings
const lines = content.split('\n');
for (const line of lines) {
  try {
    if (line.includes('"agent_name":"Parsing Agent"') || line.includes('connector_category')) {
      const obj = JSON.parse(line);
      fs.appendFileSync('f:/frontend qlik and tableau/parsing_samples.jsonl', line + '\n');
    }
  } catch(e) {}
}

