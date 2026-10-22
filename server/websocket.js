// 自己寫的 WebSocket 伺服器端（RFC 6455），只做這個遊戲需要的：文字訊息、ping/pong、關閉
// 不用裝套件。每個連線最多收 64 KB 的訊息，超過就斷線（1009），免得被塞爆
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP = { continuation: 0, text: 1, binary: 2, close: 8, ping: 9, pong: 10 };

export function attachWebSocket(httpServer, path, handlers, { maxPayload = 64 * 1024 } = {}) {
  httpServer.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const ok = new URL(req.url, 'http://x').pathname === path
      && (req.headers.upgrade ?? '').toLowerCase() === 'websocket' && key;
    if (!ok) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    const conn = new Connection(socket, handlers, maxPayload);
    handlers.onOpen?.(conn);
  });
}

class Connection {
  constructor(socket, handlers, maxPayload) {
    this.socket = socket;
    this.handlers = handlers;
    this.maxPayload = maxPayload;
    this.buffer = Buffer.alloc(0);
    this.fragments = null; // 分成好幾段送來的訊息
    this.closed = false;
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parse();
    });
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  parse() {
    while (!this.closed && this.buffer.length >= 2) {
      const b = this.buffer;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        if (b.readUInt32BE(2) !== 0) return this.close(1009);
        len = b.readUInt32BE(6);
        offset = 10;
      }
      if (!masked) return this.close(1002); // 瀏覽器送來的一定要有遮罩
      const pending = (this.fragments?.size ?? 0) + len;
      if (pending > this.maxPayload) return this.close(1009);
      if (b.length < offset + 4 + len) return; // 還沒收完，等下一段
      const mask = b.subarray(offset, offset + 4);
      const payload = Buffer.from(b.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = b.subarray(offset + 4 + len);
      this.frame(fin, opcode, payload);
    }
  }

  frame(fin, opcode, payload) {
    if (opcode === OP.text || opcode === OP.binary) {
      if (this.fragments) return this.close(1002);
      if (fin) return this.message(opcode, payload);
      this.fragments = { opcode, parts: [payload], size: payload.length };
    } else if (opcode === OP.continuation) {
      if (!this.fragments) return this.close(1002);
      this.fragments.parts.push(payload);
      this.fragments.size += payload.length;
      if (fin) {
        const { opcode: op, parts } = this.fragments;
        this.fragments = null;
        this.message(op, Buffer.concat(parts));
      }
    } else if (opcode === OP.ping) {
      this.write(OP.pong, payload);
    } else if (opcode === OP.close) {
      this.close(payload.length >= 2 ? payload.readUInt16BE(0) : 1000);
    } else if (opcode !== OP.pong) {
      this.close(1002);
    }
  }

  message(opcode, payload) {
    if (opcode !== OP.text) return this.close(1003); // 這個遊戲只用文字訊息
    this.handlers.onMessage?.(this, payload.toString('utf8'));
  }

  write(opcode, payload) {
    if (this.closed) return;
    const n = payload.length;
    let header;
    if (n < 126) {
      header = Buffer.from([0x80 | opcode, n]);
    } else if (n < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(n, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(n, 6);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) {
    this.write(OP.text, Buffer.from(text, 'utf8'));
  }

  close(code = 1000) {
    if (this.closed) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code, 0);
    this.write(OP.close, body);
    this.socket.end();
    this.finish();
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    this.buffer = Buffer.alloc(0);
    this.handlers.onClose?.(this);
    setTimeout(() => this.socket.destroy(), 1000).unref();
  }
}
