import { describe, expect, test } from "bun:test";
import { sendNovabotOtp } from "../src/auth/otp-email";
import { loadConfig } from "../src/config";
import { testEnvironment } from "./support/environment";

describe("NovaBot passwordless email sign-in", () => {
  const otpOnly = {
    ...testEnvironment(),
    GOOGLE_OAUTH_CLIENT_ID: undefined,
    GOOGLE_OAUTH_CLIENT_SECRET: undefined,
    NOVABOT_APPROVAL_REQUIRED: "true",
    NOVABOT_OTP_RESEND_API_KEY: "test-api-key",
    NOVABOT_OTP_FROM: "login@example.com",
  };

  test("can configure an email-code-only deployment without Google", () => {
    const config = loadConfig(otpOnly);
    expect(config.auth?.emailOtp).toEqual({
      apiKey: "test-api-key",
      from: "login@example.com",
    });
    expect(config.auth?.google).toBeUndefined();
    expect(config.singleUser).toBe(false);
  });

  test("refuses email-code login without approval", () => {
    expect(() =>
      loadConfig({
        ...otpOnly,
        NOVABOT_APPROVAL_REQUIRED: "false",
      }),
    ).toThrow(/approval/i);
  });

  test("refuses half-configured email delivery", () => {
    expect(() =>
      loadConfig({
        ...otpOnly,
        NOVABOT_OTP_FROM: undefined,
      }),
    ).toThrow(/together/);
  });

  test("refuses malformed sender addresses", () => {
    expect(() =>
      loadConfig({
        ...otpOnly,
        NOVABOT_OTP_FROM: "bad\\r\\naddress",
      }),
    ).toThrow(/valid/);
  });

  test("sends the code through authenticated email transport without exposing it", async () => {
    let captured: { url?: string; options?: RequestInit } = {};
    const fake = async (url: RequestInfo | URL, options?: RequestInit) => {
      captured = { url: String(url), options };
      return new Response(JSON.stringify({ id: "accepted" }), { status: 200 });
    };
    await sendNovabotOtp(
      { apiKey: "private-api-key", from: "login@example.com" },
      { email: "person@example.com", otp: "123456", type: "sign-in" },
      fake as typeof fetch,
    );
    expect(captured.url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(captured.options?.body));
    expect(body.to).toEqual(["person@example.com"]);
    expect(body.text).toContain("123456");
    expect(
      String(
        (captured.options?.headers as Record<string, string> | undefined)
          ?.authorization,
      ),
    ).toContain("private-api-key");
  });

  test("does not announce success when the mail provider rejects delivery", async () => {
    const fake = async () => new Response("bad key", { status: 401 });
    await expect(
      sendNovabotOtp(
        { apiKey: "x", from: "login@example.com" },
        { email: "person@example.com", otp: "123456", type: "sign-in" },
        fake as typeof fetch,
      ),
    ).rejects.toThrow(/401/);
  });

  test("rejects wrong length OTPs and non-login purposes", async () => {
    const noCall = async () => {
      throw new Error("fetch must not run");
    };
    await expect(
      sendNovabotOtp(
        { apiKey: "x", from: "login@example.com" },
        { email: "person@example.com", otp: "invalid", type: "sign-in" },
        noCall as typeof fetch,
      ),
    ).rejects.toThrow(/format/);
    await expect(
      sendNovabotOtp(
        { apiKey: "x", from: "login@example.com" },
        { email: "person@example.com", otp: "123456", type: "forget-password" },
        noCall as typeof fetch,
      ),
    ).rejects.toThrow(/Only sign-in/);
  });
});
