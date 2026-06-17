#!/usr/bin/env node
// PixelLab MCP API client — used for direct API calls (no MCP transport needed).
// Pass commands like: node scripts/pixellab-api.mjs balance
//                    node scripts/pixellab-api.mjs create-character '<json-args>'

const TOKEN = process.env.PIXELLAB_API_KEY;
if (!TOKEN) {
  console.error('PIXELLAB_API_KEY not set');
  process.exit(1);
}

const cmd = process.argv[2];
const argsJson = process.argv[3] || '{}';
let args;
try {
  args = JSON.parse(argsJson);
} catch (e) {
  console.error('Args must be valid JSON');
  process.exit(1);
}

const body = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: cmd, arguments: args },
};

const res = await fetch('https://api.pixellab.ai/mcp', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log('HTTP', res.status);
// SSE response: extract the data line
const dataLine = text.split('\n').find(l => l.startsWith('data: '));
if (dataLine) {
  const data = JSON.parse(dataLine.slice(6));
  if (data.error) {
    console.log('ERROR:', JSON.stringify(data.error, null, 2));
  } else {
    console.log(JSON.stringify(data.result, null, 2));
  }
} else {
  console.log(text);
}
