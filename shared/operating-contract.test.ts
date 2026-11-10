import { describe, expect, test } from "bun:test";
import { computerGuidance } from "./bot-prompt";
import { OPERATING_CONTRACT } from "./operating-contract";

describe("NovaBot default operating contract", () => {
  test("prioritizes short, natural answers and preserves requested deliverables", () => {
    expect(OPERATING_CONTRACT).toContain("85% less prose");
    expect(OPERATING_CONTRACT).toContain("under 60 words");
    expect(OPERATING_CONTRACT).toContain("person's language");
    expect(OPERATING_CONTRACT).toContain(
      "Do not shorten the actual deliverable",
    );
  });

  test("requires trying safe available execution paths before refusing", () => {
    expect(OPERATING_CONTRACT).toContain("authorized terminal/shell");
    expect(OPERATING_CONTRACT).toContain(
      "browser, API, file tool or connector",
    );
    expect(OPERATING_CONTRACT).toContain("smallest permitted");
    expect(OPERATING_CONTRACT).toContain("check the real result");
    expect(OPERATING_CONTRACT).toContain("genuinely");
  });

  test("keeps task context across sign-in handoff and checks the resumed browser", () => {
    expect(OPERATING_CONTRACT).toContain("concrete task continuation");
    expect(OPERATING_CONTRACT).toContain("After any approval, sign-in handoff");
    expect(OPERATING_CONTRACT).toContain("inspect the current state afresh");
    expect(OPERATING_CONTRACT).toContain(
      "A handoff request alone is not a completed login",
    );
  });

  test("does not treat CAPTCHA or rate limits as permission to evade controls", () => {
    expect(OPERATING_CONTRACT).toContain("never ask for");
    expect(OPERATING_CONTRACT).toContain("attempt to solve CAPTCHA");
    expect(OPERATING_CONTRACT).toContain(
      "change identity, proxy or IP to evade",
    );
  });

  test("never treats the harness as an authorization bypass", () => {
    expect(OPERATING_CONTRACT).toContain("Never bypass a denial");
    expect(OPERATING_CONTRACT).toContain(
      "Do not repeat writes with uncertain external effects",
    );
    expect(OPERATING_CONTRACT).toContain("Keep attempts bounded");
  });

  test.each([true, false])(
    "all computer agents get the contract (search=%s)",
    (search) => {
      const guidance = computerGuidance({ search });
      expect(guidance).toContain(OPERATING_CONTRACT);
      expect(guidance).toContain("Never invent");
    },
  );
});
