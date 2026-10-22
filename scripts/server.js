// 多人連線伺服器：npm run server → 同一個網路的人打開印出來的網址一起玩
// 同一個 port 送網頁，也在 /ws 收發 WebSocket 訊息（不用裝套件）
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve.js';
import { attachWebSocket } from '../server/websocket.js';
import { Room } from '../server/room.js';

// host 不給：IPv4 和 IPv6 都聽（瀏覽器的 localhost 可能是 ::1）
export function startMultiplayerServer(port = 8080, host) {
  const room = new Room();
  const http = createStaticServer();
  const links = new Map(); // WebSocket 連線 → 給 Room 用的 conn
  attachWebSocket(http, '/ws', {
    onOpen(ws) {
      const conn = { send: (msg) => ws.send(JSON.stringify(msg)) };
      links.set(ws, conn);
      room.connect(conn);
    },
    onMessage(ws, text) {
      let msg;
      try { msg = JSON.parse(text); } catch { return; }
      room.receive(links.get(ws), msg);
    },
    onClose(ws) {
      room.disconnect(links.get(ws));
      links.delete(ws);
    },
  });
  return new Promise((done, fail) => {
    http.once('error', fail);
    http.listen(port, ...(host ? [host] : []), () => {
      done({
        port: http.address().port,
        room,
        close() {
          for (const ws of links.keys()) ws.close(1001);
          http.close();
        },
      });
    });
  });
}

function lanAddresses() {
  return Object.values(networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  startMultiplayerServer(port).then(() => {
    console.log('空中之島（多人）開好了，同一個網路的人打開：');
    console.log(`  http://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  http://${ip}:${port}`);
  }, (err) => {
    if (err.code === 'EADDRINUSE') console.error(`port ${port} 已經有別的程式在用（是不是 npm start 還開著？）。關掉它，或用 PORT=8081 npm run server`);
    else console.error(err);
    process.exit(1);
  });
}
