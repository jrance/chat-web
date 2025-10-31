import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { webcrypto } from "node:crypto";

expect.extend(matchers);

if (!globalThis.crypto || !("randomUUID" in globalThis.crypto)) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
