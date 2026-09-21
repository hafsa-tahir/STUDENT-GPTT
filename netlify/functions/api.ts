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

import serverless from "serverless-http";
import { createExpressApp } from "../../server/app";

const app = createExpressApp();

export const handler = serverless(app);

