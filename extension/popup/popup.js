/**
 * FreeAI - Popup Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('popup-status-dot');
  const statusText = document.getElementById('popup-status-text');
  const workspaceText = document.getElementById('workspace-text');
  const reconnectBtn = document.getElementById('btn-reconnect');

  async function findBridge() {
    for (let port = 4000; port <= 4010; port++) {
      try {
        const res = await fetch(`http://localhost:${port}/api/status`, { signal: AbortSignal.timeout(350) });
        const data = await res.json();
        if (res.ok && data.status === 'online') return data;
      } catch {}
    }
    return null;
  }

  async function checkStatus() {
    statusDot.className = 'status-dot';
    statusText.innerText = 'Prüfe...';

    try {
      const data = await findBridge();

      if (data && data.status === 'online') {
        statusDot.className = 'status-dot online';
        statusText.innerText = 'Online';
        workspaceText.innerText = data.workspace || 'Nicht gesetzt';
        workspaceText.title = data.workspace || '';
      } else {
        throw new Error('Offline');
      }
    } catch (e) {
      statusDot.className = 'status-dot';
      statusText.innerText = 'Offline';
      workspaceText.innerText = 'Server nicht gestartet';
      workspaceText.title = '';
    }
  }

  reconnectBtn.addEventListener('click', checkStatus);
  checkStatus();
});
