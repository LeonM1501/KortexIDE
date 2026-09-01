/**
 * Automatischer Integrationstest für den FreeAI Bridge Server
 * Startet den Server falls nötig automatisch, führt alle Tests aus und validiert die API.
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const TEST_PORT = 4100 + Math.floor(Math.random() * 400);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- Starte FreeAI Bridge Server Test ---');

  // Prüfen ob Server schon läuft, falls nicht starten
  let serverProcess = null;
  try {
    await request('GET', '/api/status');
  } catch (e) {
    console.log('Server läuft noch nicht, starte temporären Server-Prozess...');
    serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
      stdio: 'inherit',
      cwd: __dirname,
      env: { ...process.env, PORT: String(TEST_PORT), WORKSPACE_DIR: __dirname }
    });
    await sleep(1000);
  }

  try {
    // 1. Status Test
    console.log('1. Prüfe /api/status...');
    const statusRes = await request('GET', '/api/status');
    console.log('   Status:', statusRes.data.status, '| Workspace:', statusRes.data.workspace);
    if (statusRes.data.status !== 'online') throw new Error('Status ist nicht online');

    // 2. Write File Test
    console.log('2. Teste /api/write-file...');
    const writeRes = await request('POST', '/api/write-file', {
      path: 'test-sandbox/hello.txt',
      content: 'Hello World from FreeAI Agent!\nLine 2: Test'
    });
    console.log('   Ergebnis:', writeRes.data.message);
    if (!writeRes.data.success) throw new Error('Write file fehlgeschlagen');

    // 3. Read File Test
    console.log('3. Teste /api/read-file...');
    const readRes = await request('POST', '/api/read-file', {
      path: 'test-sandbox/hello.txt'
    });
    console.log('   Inhalt gelesen:', JSON.stringify(readRes.data.content));
    if (!readRes.data.content.includes('Hello World')) throw new Error('Read file Inhalt stimmt nicht');

    // 4. Edit File Test
    console.log('4. Teste /api/edit-file...');
    const editRes = await request('POST', '/api/edit-file', {
      path: 'test-sandbox/hello.txt',
      targetContent: 'Line 2: Test',
      replacementContent: 'Line 2: Edited Successfully!'
    });
    console.log('   Ergebnis:', editRes.data.message);
    if (!editRes.data.success) throw new Error('Edit file fehlgeschlagen');

    // 5. List Files Test
    console.log('5. Teste /api/list-files...');
    const listRes = await request('POST', '/api/list-files', {});
    console.log(`   Dateien gefunden: ${listRes.data.totalFiles}, Ordner: ${listRes.data.totalDirectories}`);
    if (!listRes.data.success) throw new Error('List files fehlgeschlagen');

    // 6. Execute CMD Test
    console.log('6. Teste /api/execute-cmd (node -v)...');
    const cmdRes = await request('POST', '/api/execute-cmd', {
      command: 'node -v'
    });
    console.log('   Command stdout:', (cmdRes.data.stdout || '').trim(), '| ExitCode:', cmdRes.data.exitCode);
    if (!cmdRes.data.success) throw new Error('Execute CMD fehlgeschlagen');

    // 7. Delete File Test
    console.log('7. Teste /api/delete-file...');
    const delRes = await request('POST', '/api/delete-file', {
      path: 'test-sandbox'
    });
    console.log('   Ergebnis:', delRes.data.message);
    if (!delRes.data.success) throw new Error('Delete file fehlgeschlagen');

    console.log('\n✅ ALLE TESTS ERFOLGREICH BESTANDEN!');
  } catch (err) {
    console.error('\n❌ TEST FEHLGESCHLAGEN:', err.message);
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  if (serverProcess) {
    serverProcess.kill();
  }
}

runTests();
