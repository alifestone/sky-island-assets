// 整座島（32×32×32 個方塊編號）和文字互換，才能放進 JSON 訊息裡傳（base64）
export function encodeWorld(blocks) {
  let s = '';
  for (let i = 0; i < blocks.length; i += 8192) s += String.fromCharCode(...blocks.subarray(i, i + 8192));
  return btoa(s);
}

export function decodeWorld(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
