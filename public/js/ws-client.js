import { AREA } from './area.js';

// WS-Client mit Auto-Reconnect: onState wird bei jedem State-Broadcast gerufen,
// onFact bei jedem Wechsel des Fun-Fact-Bands (D-043).
// Verbindet sich mit dem WS-Endpunkt des eigenen Bereichs (D-019).
export function connectState({ onState, onFact, onError } = {}) {
  let ws = null;
  let retryMs = 500;
  let closed = false;

  function open() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${location.host}${AREA.base}/ws`);

    ws.onopen = () => { retryMs = 500; };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'state') onState?.(msg);
      if (msg.type === 'fact') onFact?.(msg);
      if (msg.type === 'error') onError?.(msg.message);
    };

    ws.onclose = () => {
      if (closed) return;
      setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    };
  }

  open();

  return {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else onError?.('Keine Verbindung zum Server');
    },
    close() {
      closed = true;
      ws?.close();
    },
  };
}
