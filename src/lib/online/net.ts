"use client";
/**
 * Peer-to-peer transport for online leagues (WebRTC via PeerJS's free public broker - no server of ours).
 * The host registers under a room code; guests connect to it. Every message is JSON, gzipped.
 */
import type { DataConnection, Peer as PeerType } from "peerjs";

const PREFIX = "front-office-nba-v1-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(): string {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export const normalizeCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function gzip(text: string): Promise<ArrayBuffer> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

async function gunzip(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

async function encode(msg: unknown) {
  return gzip(JSON.stringify(msg));
}

async function decode<T>(data: unknown): Promise<T | null> {
  try {
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) return JSON.parse(await gunzip(data)) as T;
    return null;
  } catch {
    return null;
  }
}

async function createPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import("peerjs");
  return id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
}

function friendlyError(e: { type?: string; message?: string }): string {
  switch (e.type) {
    case "unavailable-id":
      return "That room code is already being hosted (maybe in another tab).";
    case "peer-unavailable":
      return "No game found with that code - check it, and make sure the host has the room open.";
    case "network":
    case "server-error":
    case "socket-error":
      return "Couldn't reach the matchmaking server. Check your internet connection (school/work Wi-Fi can block it - try a hotspot).";
    case "browser-incompatible":
      return "This browser doesn't support online play.";
    default:
      return e.message || "Connection error";
  }
}

/** Host side: accepts guests, sends to one or all. */
export class HostNet {
  private peer: PeerType | null = null;
  private conns = new Map<string, DataConnection>();
  onMessage: (connId: string, msg: unknown) => void = () => {};
  onJoin: (connId: string) => void = () => {};
  onLeave: (connId: string) => void = () => {};
  onError: (text: string) => void = () => {};

  async start(code: string): Promise<void> {
    const peer = await createPeer(PREFIX + code);
    this.peer = peer;
    await new Promise<void>((resolve, reject) => {
      peer.once("open", () => resolve());
      peer.once("error", (e) => reject(new Error(friendlyError(e as never))));
    });
    peer.on("error", (e) => this.onError(friendlyError(e as never)));
    // the broker connection can drop on sleep; keep the room reachable
    peer.on("disconnected", () => {
      // closing the room also fires this, just before the peer is marked destroyed: check again when the timer runs
      if (!peer.destroyed) setTimeout(() => !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on("connection", (conn) => {
      conn.on("open", () => {
        this.conns.set(conn.connectionId, conn);
        this.onJoin(conn.connectionId);
      });
      conn.on("data", async (d) => {
        const msg = await decode(d);
        if (msg) this.onMessage(conn.connectionId, msg);
      });
      const leave = () => {
        if (this.conns.delete(conn.connectionId)) this.onLeave(conn.connectionId);
      };
      conn.on("close", leave);
      conn.on("error", leave);
    });
  }

  async send(connId: string, msg: unknown) {
    const c = this.conns.get(connId);
    if (c?.open) c.send(await encode(msg));
  }

  async broadcast(msg: unknown, except?: string) {
    const bytes = await encode(msg);
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(bytes);
  }

  close() {
    for (const c of this.conns.values()) c.close();
    this.conns.clear();
    this.peer?.destroy();
    this.peer = null;
  }
}

/** Guest side: one connection to the host. */
export class ClientNet {
  private peer: PeerType | null = null;
  private conn: DataConnection | null = null;
  onMessage: (msg: unknown) => void = () => {};
  onClose: () => void = () => {};

  async connect(code: string): Promise<void> {
    const peer = await createPeer();
    this.peer = peer;
    await new Promise<void>((resolve, reject) => {
      peer.once("open", () => resolve());
      peer.once("error", (e) => reject(new Error(friendlyError(e as never))));
    });
    const conn = peer.connect(PREFIX + code, { reliable: true });
    this.conn = conn;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("The host didn't answer - check the code and that the host has the room open.")), 15000);
      conn.once("open", () => {
        clearTimeout(t);
        resolve();
      });
      peer.once("error", (e) => {
        clearTimeout(t);
        reject(new Error(friendlyError(e as never)));
      });
    });
    conn.on("data", async (d) => {
      const msg = await decode(d);
      if (msg) this.onMessage(msg);
    });
    conn.on("close", () => this.onClose());
    conn.on("error", () => this.onClose());
  }

  async send(msg: unknown) {
    if (this.conn?.open) this.conn.send(await encode(msg));
  }

  close() {
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }
}
