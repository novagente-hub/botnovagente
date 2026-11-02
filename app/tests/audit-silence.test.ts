import { describe, expect, test } from "bun:test";
import { silenceOf } from "../src/lib/audit/silence";

/**
 * The line that tells a stalled-turn row apart from every other stalled-turn row.
 *
 * The distinction the audit trail exists to draw here is between a Bot that dies partway through an
 * answer and one that accepts the request and never writes, so the zero case is the one that has to
 * read unmistakably.
 */

describe("what a stalled turn says on the audit page", () => {
  test("names the silence and how much came before it", () => {
    expect(silenceOf({ silentForMs: 120_000, chunks: 14 })).toBe(
      "Em silêncio por 120s, depois de 14 trechos",
    );
  });

  test("says outright when nothing ever arrived", () => {
    expect(silenceOf({ silentForMs: 60_000, chunks: 0 })).toBe(
      "Em silêncio por 60s, sem dizer nada",
    );
  });

  test("counts one chunk as one", () => {
    expect(silenceOf({ silentForMs: 60_000, chunks: 1 })).toBe(
      "Em silêncio por 60s, depois de 1 trecho",
    );
  });

  test("never says nought seconds, whatever the deployment configured", () => {
    expect(silenceOf({ silentForMs: 60, chunks: 0 })).toBe(
      "Em silêncio por 1s, sem dizer nada",
    );
  });

  test("draws nothing for a row that does not carry the numbers", () => {
    // An older row, written before these were recorded. Showing "0 chunks" there would be a claim
    // about a Bot nobody measured.
    expect(silenceOf({ bot: "risk-analyst" })).toBeNull();
    expect(silenceOf({ silentForMs: 60_000 })).toBeNull();
    expect(silenceOf({ silentForMs: "60000", chunks: 0 })).toBeNull();
  });
});
