import * as Y from "yjs";

export function encodeYjsDoc(doc: Y.Doc): string {
  return uint8ArrayToBase64(Y.encodeStateAsUpdate(doc));
}

export function decodeYjsUpdate(b64: string): Uint8Array {
  return base64ToUint8Array(b64);
}

function uint8ArrayToBase64(u8: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += CHUNK) {
    binary += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const u8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);
  return u8;
}
