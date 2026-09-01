/**
 * Embedded Kortex Bridge Server (Port 4000)
 * Runs directly inside Electron main process — provides full compatibility for
 * both Chrome Extension, Kortex IDE and external tools.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const DEFAULT_PORT = 4000;
const MAX_PORT = 4100;
let currentWorkspace = process.cwd();
let serverInstance = null;
let bridgePort = null;

const IGNORED_PATTERNS = [
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  'coverage', '.gemini', '.agents', '__pycache__', '.venv', 'venv',
  '.DS_Store', 'Thumbs.db'
];

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end(JSON.stringify(data));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) reject(new Error('Payload zu groß'));
    });
    req.on('end', () => {
      if (!body || !body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        try {
          resolve(JSON.parse(body.replace(/\\/g, '/')));
        } catch {
          resolve({});
        }
      }
    });
    req.on('error', reject);
  });
}

function resolveWorkspacePath(relPath) {
  if (!relPath || relPath === '.' || relPath === './') return currentWorkspace;
  if (path.isAbsolute(relPath)) return path.normalize(relPath);
  return path.normalize(path.join(currentWorkspace, relPath));
}

function scanDirectory(dirPath, rootDir, maxDepth = 8, currentDepth = 0) {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
  const results = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_PATTERNS.includes(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        results.push({ type: 'directory', path: relPath, name: entry.name });
        results.push(...scanDirectory(fullPath, rootDir, maxDepth, currentDepth + 1));
      } else {
        const stat = fs.statSync(fullPath);
        results.push({ type: 'file', path: relPath, name: entry.name, size: stat.size });
      }
    }
  } catch {}
  return results;
}

function startBridgeServer(initialWorkspace, onWorkspaceChanged) {
  if (serverInstance) return serverInstance;
  if (initialWorkspace) currentWorkspace = initialWorkspace;

  serverInstance = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = url.pathname;

    try {
      // 1. Status / Health Check (both /status and /api/status)
      if (pathname === '/api/status' || pathname === '/status' || pathname === '/health' || pathname === '/') {
        return sendJson(res, 200, {
          status: 'online',
          server: 'Kortex Integrated Bridge Server',
          version: '1.0.0',
          port: bridgePort,
          workspace: currentWorkspace,
          workspaceExists: fs.existsSync(currentWorkspace),
          platform: process.platform,
          arch: process.arch,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString()
        });
      }

      // 2. Set Workspace Folder
      if (pathname === '/api/set-workspace' || (req.method === 'POST' && pathname === '/api/workspace')) {
        const body = await parseRequestBody(req);
        let targetPath = body.workspace || body.path ? path.normalize(body.workspace || body.path) : currentWorkspace;

        if (!fs.existsSync(targetPath)) {
          if (body.createIfNotExists) {
            fs.mkdirSync(targetPath, { recursive: true });
          } else {
            return sendJson(res, 400, { success: false, error: `Verzeichnis existiert nicht: ${targetPath}` });
          }
        }

        currentWorkspace = targetPath;
        if (onWorkspaceChanged) onWorkspaceChanged(currentWorkspace);
        return sendJson(res, 200, {
          success: true,
          workspace: currentWorkspace,
          message: `Workspace gewechselt zu: ${currentWorkspace}`
        });
      }

      // 3. Get Workspace
      if (req.method === 'GET' && pathname === '/api/workspace') {
        return sendJson(res, 200, { success: true, workspace: currentWorkspace });
      }

      // 4. Native Folder Picker
      if (pathname === '/api/pick-folder') {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Wähle deinen Projektordner für Kortex"
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }
`;
        exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`, (err, stdout) => {
          const selected = stdout.trim();
          if (selected && fs.existsSync(selected)) {
            currentWorkspace = selected;
            if (onWorkspaceChanged) onWorkspaceChanged(currentWorkspace);
            return sendJson(res, 200, { success: true, workspace: currentWorkspace });
          }
          return sendJson(res, 200, { success: false, workspace: currentWorkspace, cancelled: true });
        });
        return;
      }

      // 5. List Files (supports /api/list_files and /api/list-files)
      if (pathname === '/api/list_files' || pathname === '/api/list-files') {
        const body = await parseRequestBody(req);
        const ws = body.workspace || body.path ? resolveWorkspacePath(body.workspace || body.path) : currentWorkspace;
        if (!fs.existsSync(ws)) {
          return sendJson(res, 404, { success: false, error: `Verzeichnis nicht gefunden: ${ws}` });
        }
        const files = scanDirectory(ws, ws, body.maxDepth || 8);
        return sendJson(res, 200, {
          success: true,
          workspace: ws,
          files,
          totalFiles: files.filter(f => f.type === 'file').length,
          totalDirectories: files.filter(f => f.type === 'directory').length
        });
      }

      // 6. Read File (/api/read_file and /api/read-file)
      if (pathname === '/api/read_file' || pathname === '/api/read-file') {
        const body = await parseRequestBody(req);
        const filePath = resolveWorkspacePath(body.path || body.filePath);
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { success: false, error: `Datei nicht gefunden: ${body.path || body.filePath}` });
        }
        let content = fs.readFileSync(filePath, 'utf8');
        const MAX_BYTES = 45000;
        let truncated = false;
        if (content.length > MAX_BYTES) {
          content = content.substring(0, MAX_BYTES) + '\n\n... [Trunkiert: Datei ist sehr groß, erste 45KB angezeigt] ...';
          truncated = true;
        }
        return sendJson(res, 200, {
          success: true,
          path: body.path || body.filePath,
          content,
          truncated,
          totalLines: content.split('\n').length
        });
      }

      // 7. Write File (/api/write_file and /api/write-file)
      if (pathname === '/api/write_file' || pathname === '/api/write-file') {
        const body = await parseRequestBody(req);
        const filePath = resolveWorkspacePath(body.path || body.filePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        let oldContent = null;
        if (fs.existsSync(filePath)) oldContent = fs.readFileSync(filePath, 'utf8');
        fs.writeFileSync(filePath, body.content || '', 'utf8');
        return sendJson(res, 200, {
          success: true,
          path: body.path || body.filePath,
          isNew: oldContent === null,
          oldContent,
          newContent: body.content,
          size: Buffer.byteLength(body.content || '')
        });
      }

      // 8. Edit File (/api/edit_file and /api/edit-file)
      if (pathname === '/api/edit_file' || pathname === '/api/edit-file') {
        const body = await parseRequestBody(req);
        const filePath = resolveWorkspacePath(body.path || body.filePath);
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { success: false, error: `Datei nicht gefunden: ${body.path || body.filePath}` });
        }
        const oldContent = fs.readFileSync(filePath, 'utf8');
        if (!oldContent.includes(body.targetContent)) {
          return sendJson(res, 400, { success: false, error: 'targetContent nicht in Datei gefunden' });
        }
        const newContent = body.allowMultiple
          ? oldContent.split(body.targetContent).join(body.replacementContent)
          : oldContent.replace(body.targetContent, body.replacementContent);
        fs.writeFileSync(filePath, newContent, 'utf8');
        return sendJson(res, 200, { success: true, path: body.path || body.filePath, oldContent, newContent });
      }

      // 9. Delete File (/api/delete_file and /api/delete-file)
      if (pathname === '/api/delete_file' || pathname === '/api/delete-file') {
        const body = await parseRequestBody(req);
        const filePath = resolveWorkspacePath(body.path || body.filePath);
        if (!fs.existsSync(filePath)) {
          return sendJson(res, 404, { success: false, error: 'Datei existiert nicht' });
        }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
        else fs.unlinkSync(filePath);
        return sendJson(res, 200, { success: true, path: body.path || body.filePath, message: `Gelöscht: ${body.path || body.filePath}` });
      }

      // 10. Run Command (/api/run_command and /api/run-command)
      if (pathname === '/api/run_command' || pathname === '/api/run-command') {
        const body = await parseRequestBody(req);
        const cmd = body.command || body.cmd;
        const ws = body.workspace ? resolveWorkspacePath(body.workspace) : currentWorkspace;
        const start = Date.now();
        exec(cmd, { cwd: ws, timeout: body.timeoutMs || 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          return sendJson(res, 200, {
            success: !err,
            exitCode: err ? (err.code || 1) : 0,
            stdout: (stdout || '').trim(),
            stderr: (stderr || '').trim(),
            executionTimeMs: Date.now() - start
          });
        });
        return;
      }

      sendJson(res, 404, { success: false, error: `Endpoint nicht gefunden: ${pathname}` });
    } catch (e) {
      console.error('Bridge route error:', e);
      sendJson(res, 500, { success: false, error: e.message });
    }
  });

  const listenOnFreePort = (candidate) => {
    const onError = (err) => {
      if (err.code === 'EADDRINUSE' && candidate < MAX_PORT) {
        serverInstance.removeListener('error', onError);
        listenOnFreePort(candidate + 1);
        return;
      }
      console.error('Bridge Server Error:', err.message);
    };

    serverInstance.once('error', onError);
    serverInstance.listen(candidate, '127.0.0.1', () => {
      if (bridgePort !== null) return;
      bridgePort = serverInstance.address().port;
      console.log(`Kortex Integrated Bridge Server running on http://127.0.0.1:${bridgePort}`);
      if (typeof onWorkspaceChanged === 'function') {
        onWorkspaceChanged(currentWorkspace, bridgePort);
      }
    });
  };

  listenOnFreePort(Number(process.env.KORTEX_BRIDGE_PORT) || DEFAULT_PORT);

  return serverInstance;
}

function setBridgeWorkspace(newWorkspace) {
  if (newWorkspace && fs.existsSync(newWorkspace)) {
    currentWorkspace = path.normalize(newWorkspace);
  }
}

function getBridgePort() {
  return bridgePort;
}

module.exports = {
  startBridgeServer,
  setBridgeWorkspace,
  getBridgePort
};
