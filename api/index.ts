if (typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;

    constructor(init?: any) {
      if (Array.isArray(init)) {
        if (init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        } else if (init.length === 16) {
          [this.m11, this.m12, this.m13, this.m14,
           this.m21, this.m22, this.m23, this.m24,
           this.m31, this.m32, this.m33, this.m34,
           this.m41, this.m42, this.m43, this.m44] = init;
        }
      }
    }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    translate() { return this; }
    scale() { return this; }
    invertSelf() { return this; }
    rotateSelf() { return this; }
    transformPoint(p?: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
  }
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}

if (typeof globalThis.DOMPoint === "undefined") {
  class DOMPointPolyfill {
    x = 0; y = 0; z = 0; w = 1;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
    static fromPoint(other?: any) {
      return new DOMPointPolyfill(other?.x ?? 0, other?.y ?? 0, other?.z ?? 0, other?.w ?? 1);
    }
  }
  (globalThis as any).DOMPoint = DOMPointPolyfill;
}

if (typeof globalThis.WebSocket === "undefined") {
  class NodeWebSocketStub {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readonly readyState = 3;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  }
  (globalThis as any).WebSocket = NodeWebSocketStub;
}

let appInstance: any = null;
let initError: any = null;

async function getApp() {
  if (appInstance) return appInstance;
  if (initError) throw initError;
  try {
    const { createExpressApp } = await import("../server/app");
    appInstance = createExpressApp();
    return appInstance;
  } catch (err: any) {
    initError = err?.stack || err?.message || String(err);
    console.error("[Vercel App Init Error]:", initError);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err: any) {
    console.error("[Vercel Handler Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Server initialization failed",
        message: err?.message || String(err),
        stack: err?.stack || null,
      })
    );
  }
}
