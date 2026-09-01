/**
 * FreeAI Bridge Server
 * Ein leichtgewichtiger, nativer Node.js Server (ohne externe Abhängigkeiten),
 * der der Chrome-Extension sicheren Dateisystem- und Terminal-/CMD-Zugriff
 * auf deinen lokalen Projektordner ermöglicht.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const DEFAULT_PORT = Number(process.env.PORT) || 4000;
const MAX_PORT = 4100;
let activePort = null;
let currentWorkspace = process.env.WORKSPACE_DIR || process.cwd();

// Standardmäßig zu ignorierende Ordner & Dateien
const IGNORED_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'coverage',
  '.gemini',
  '.agents',
  '__pycache__',
  '.venv',
  'venv',
  '.DS_Store',
  'Thumbs.db'
];

/**
 * Sendet eine JSON-Antwort mit CORS-Headern
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end(JSON.stringify(data));
}

/**
 * Liest den Request-Body asynchron
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 20 * 1024 * 1024) { // 20 MB Limit
        reject(new Error('Payload zu groß (> 20 MB)'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Ungültiges JSON im Request Body: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Löst einen relativen oder absoluten Pfad innerhalb des aktuellen Workspaces auf
 */
function resolveWorkspacePath(relativePath) {
  if (!relativePath || relativePath === '.' || relativePath === './') {
    return currentWorkspace;
  }
  if (path.isAbsolute(relativePath)) {
    return path.normalize(relativePath);
  }
  return path.normalize(path.join(currentWorkspace, relativePath));
}

/**
 * Rekursives Auflisten von Dateien und Ordnern
 */
function scanDirectory(dirPath, rootDir, maxDepth = 8, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const results = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_PATTERNS.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        results.push({
          type: 'directory',
          name: entry.name,
          path: relativePath,
          children: scanDirectory(fullPath, rootDir, maxDepth, currentDepth + 1)
        });
      } else if (entry.isFile()) {
        let size = 0;
        try {
          const stats = fs.statSync(fullPath);
          size = stats.size;
        } catch (e) {}

        results.push({
          type: 'file',
          name: entry.name,
          path: relativePath,
          size: size
        });
      }
    }
  } catch (err) {
    // Falls ein Unterordner nicht gelesen werden kann
  }

  return results;
}

/**
 * Flache Dateiliste erzeugen
 */
function flattenTree(tree, list = []) {
  for (const item of tree) {
    list.push({
      path: item.path,
      type: item.type,
      size: item.size || 0
    });
    if (item.children) {
      flattenTree(item.children, list);
    }
  }
  return list;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. Status Check
    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(res, 200, {
        status: 'online',
        version: '1.0.0',
        port: activePort,
        workspace: currentWorkspace,
        workspaceExists: fs.existsSync(currentWorkspace),
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }

    // 2. Set Workspace Folder
    if (req.method === 'POST' && pathname === '/api/set-workspace') {
      const body = await parseRequestBody(req);
      let targetPath = body.path ? path.normalize(body.path) : currentWorkspace;

      if (!fs.existsSync(targetPath)) {
        if (body.createIfNotExists) {
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          return sendJson(res, 400, {
            success: false,
            error: `Verzeichnis existiert nicht: ${targetPath}`
          });
        }
      }

      currentWorkspace = targetPath;
      return sendJson(res, 200, {
        success: true,
        workspace: currentWorkspace,
        message: `Workspace erfolgreich gewechselt zu: ${currentWorkspace}`
      });
    }

    // 3. Native Folder Picker (Windows PowerShell Dialog)
    if (req.method === 'POST' && pathname === '/api/pick-folder') {
      if (process.platform === 'win32') {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Wähle deinen Projektordner für FreeAI"
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $f.SelectedPath
}
`;
        exec(`powershell -NoProfile -Command "${psScript.replace(/\n/g, '; ')}"`, (err, stdout, stderr) => {
          const selected = stdout.trim();
          if (selected && fs.existsSync(selected)) {
            currentWorkspace = selected;
            return sendJson(res, 200, {
              success: true,
              workspace: currentWorkspace,
              message: `Ordner ausgewählt: ${currentWorkspace}`
            });
          } else {
            return sendJson(res, 200, {
              success: false,
              workspace: currentWorkspace,
              cancelled: true,
              message: 'Auswahl abgebrochen'
            });
          }
        });
        return;
      } else {
        return sendJson(res, 200, {
          success: false,
          error: 'Folder Picker Dialog wird nativ unter Windows unterstützt. Bitte Pfad manuell eingeben.'
        });
      }
    }

    // 4. List Files
    if (req.method === 'POST' && pathname === '/api/list-files') {
      const body = await parseRequestBody(req);
      const subDir = body.path ? resolveWorkspacePath(body.path) : currentWorkspace;

      if (!fs.existsSync(subDir)) {
        return sendJson(res, 404, {
          success: false,
          error: `Verzeichnis nicht gefunden: ${subDir}`
        });
      }

      const tree = scanDirectory(subDir, currentWorkspace, body.maxDepth || 8);
      const flat = flattenTree(tree);

      return sendJson(res, 200, {
        success: true,
        workspace: currentWorkspace,
        targetDir: subDir,
        totalFiles: flat.filter(f => f.type === 'file').length,
        totalDirectories: flat.filter(f => f.type === 'directory').length,
        tree: tree,
        files: flat
      });
    }

    // 5. Read File
    if (req.method === 'POST' && pathname === '/api/read-file') {
      const body = await parseRequestBody(req);
      if (!body.path) {
        return sendJson(res, 400, { success: false, error: 'Parameter "path" fehlt' });
      }

      const filePath = resolveWorkspacePath(body.path);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, {
          success: false,
          error: `Datei existiert nicht: ${body.path}`
        });
      }

      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return sendJson(res, 400, {
          success: false,
          error: `Angegebener Pfad ist ein Ordner, keine Datei: ${body.path}`
        });
      }

      // Prüfe auf Binärdateien / große Dateien (> 5MB)
      if (stats.size > 5 * 1024 * 1024) {
        return sendJson(res, 400, {
          success: false,
          error: `Datei ist zu groß zum direkten Lesen (${(stats.size / 1024 / 1024).toFixed(2)} MB)`
        });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      let resultText = content;
      let startLine = body.startLine ? parseInt(body.startLine, 10) : 1;
      let endLine = body.endLine ? parseInt(body.endLine, 10) : lines.length;

      if (body.startLine || body.endLine) {
        const sliced = lines.slice(Math.max(0, startLine - 1), endLine);
        resultText = sliced.join('\n');
      }

      return sendJson(res, 200, {
        success: true,
        path: body.path,
        fullPath: filePath,
        totalLines: lines.length,
        startLine: startLine,
        endLine: endLine,
        content: resultText,
        size: stats.size
      });
    }

    // 6. Write File (Create or Overwrite)
    if (req.method === 'POST' && pathname === '/api/write-file') {
      const body = await parseRequestBody(req);
      if (!body.path) {
        return sendJson(res, 400, { success: false, error: 'Parameter "path" fehlt' });
      }

      const filePath = resolveWorkspacePath(body.path);
      const content = body.content !== undefined ? body.content : '';

      // Verzeichnisse rekursiv erstellen
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      const stats = fs.statSync(filePath);

      return sendJson(res, 200, {
        success: true,
        path: body.path,
        fullPath: filePath,
        size: stats.size,
        message: `Datei erfolgreich geschrieben: ${body.path} (${stats.size} Bytes)`
      });
    }

    // 7. Edit File (Replace block)
    if (req.method === 'POST' && pathname === '/api/edit-file') {
      const body = await parseRequestBody(req);
      if (!body.path || body.targetContent === undefined || body.replacementContent === undefined) {
        return sendJson(res, 400, {
          success: false,
          error: 'Parameter "path", "targetContent" und "replacementContent" erforderlich'
        });
      }

      const filePath = resolveWorkspacePath(body.path);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, { success: false, error: `Datei nicht gefunden: ${body.path}` });
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Normalisiere Zeilenumbrüche für exaktes Matching
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const normalizedTarget = body.targetContent.replace(/\r\n/g, '\n');
      const normalizedReplacement = body.replacementContent.replace(/\r\n/g, '\n');

      if (!normalizedContent.includes(normalizedTarget)) {
        return sendJson(res, 400, {
          success: false,
          error: `Zu ersetzender Zieltext wurde in ${body.path} nicht gefunden. Prüfe exakte Formatierung/Leerzeichen.`
        });
      }

      const occurrences = normalizedContent.split(normalizedTarget).length - 1;
      if (occurrences > 1 && !body.allowMultiple) {
        return sendJson(res, 400, {
          success: false,
          error: `Zieltext kommt ${occurrences} Mal vor. Bitte mehr Kontext angeben oder allowMultiple: true setzen.`
        });
      }

      const newContent = body.allowMultiple
        ? normalizedContent.replaceAll(normalizedTarget, normalizedReplacement)
        : normalizedContent.replace(normalizedTarget, normalizedReplacement);

      fs.writeFileSync(filePath, newContent, 'utf-8');

      return sendJson(res, 200, {
        success: true,
        path: body.path,
        message: `Datei ${body.path} erfolgreich aktualisiert (${occurrences} Ersetzung(en))`
      });
    }

    // 8. Delete File or Directory
    if (req.method === 'POST' && pathname === '/api/delete-file') {
      const body = await parseRequestBody(req);
      if (!body.path) {
        return sendJson(res, 400, { success: false, error: 'Parameter "path" fehlt' });
      }

      const targetPath = resolveWorkspacePath(body.path);
      if (!fs.existsSync(targetPath)) {
        return sendJson(res, 404, { success: false, error: `Pfad nicht gefunden: ${body.path}` });
      }

      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }

      return sendJson(res, 200, {
        success: true,
        path: body.path,
        message: `Erfolgreich gelöscht: ${body.path}`
      });
    }

    // 9. Execute Terminal/CMD Command
    if (req.method === 'POST' && pathname === '/api/execute-cmd') {
      const body = await parseRequestBody(req);
      if (!body.command) {
        return sendJson(res, 400, { success: false, error: 'Parameter "command" fehlt' });
      }

      const command = body.command;
      const cwd = body.cwd ? resolveWorkspacePath(body.cwd) : currentWorkspace;
      const timeoutMs = body.timeoutMs || 120000; // Standard 2 Minuten Timeout

      const startTime = Date.now();

      exec(command, {
        cwd: cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      }, (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const exitCode = error ? (error.code !== undefined ? error.code : 1) : 0;

        return sendJson(res, 200, {
          success: !error || exitCode === 0,
          command: command,
          cwd: cwd,
          exitCode: exitCode,
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          executionTimeMs: executionTimeMs,
          timedOut: error && error.killed === true
        });
      });
      return;
    }

    // 404 für unbekannte Routen
    return sendJson(res, 404, { success: false, error: `Route nicht gefunden: ${req.method} ${pathname}` });

  } catch (err) {
    console.error('Serverfehler:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
});

function listenOnFreePort(candidate) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && candidate < MAX_PORT) {
      server.removeListener('error', onError);
      listenOnFreePort(candidate + 1);
      return;
    }
    console.error('Bridge Server Error:', err.message);
  };

  server.once('error', onError);
  server.listen(candidate, '127.0.0.1', () => {
    if (activePort !== null) return;
    activePort = server.address().port;
    console.log(`\n======================================================`);
    console.log(`  🚀 FreeAI Bridge Server läuft auf Port ${activePort}`);
    console.log(`  📂 Aktiver Workspace: ${currentWorkspace}`);
    console.log(`  🔗 Extension Status URL: http://localhost:${activePort}/api/status`);
    console.log(`======================================================\n`);
  });
}

listenOnFreePort(DEFAULT_PORT);
