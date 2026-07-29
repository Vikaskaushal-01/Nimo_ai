import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.util.js";
import {
  generateRefreshToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "./token.util.js";

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("S3cret!pass");
    expect(hash).not.toBe("S3cret!pass");
    expect(await verifyPassword("S3cret!pass", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse");
    expect(await verifyPassword("battery-staple", hash)).toBe(false);
  });
});

describe("access tokens", () => {
  it("round-trips payload through sign/verify", () => {
    const token = signAccessToken({ sub: "u1", email: "a@b.co", role: "user" });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe("u1");
    expect(decoded.email).toBe("a@b.co");
    expect(decoded.role).toBe("user");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken({ sub: "u1", email: "a@b.co", role: "admin" });
    expect(() => verifyAccessToken(`${token}x`)).toThrow();
  });
});

describe("refresh tokens", () => {
  it("hash is deterministic and stored hash differs from raw", () => {
    const { raw, hash } = generateRefreshToken();
    expect(hash).not.toBe(raw);
    expect(hashToken(raw)).toBe(hash);
  });

  it("produces unique tokens", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toBe(b.raw);
  });
});
