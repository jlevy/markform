/**
 * Tests for engine/session.ts
 *
 * The session module handles parsing and serializing session transcripts
 * for golden testing and session replay.
 */
import { describe, it, expect } from "vitest";
import { parseSession, serializeSession } from "../../../src/engine/session";
import type { SessionTranscript } from "../../../src/engine/types";

// =============================================================================
// Test Fixtures
// =============================================================================

const VALID_SESSION_YAML = `session_version: "0.1.0"
mode: mock
form:
  path: examples/simple/simple.form.md
mock:
  completed_mock: examples/simple/simple.mock.filled.form.md
harness:
  max_issues: 5
  max_patches_per_turn: 3
  max_turns: 10
turns:
  - turn: 1
    inspect:
      issues:
        - ref: name
          scope: field
          reason: required_missing
          message: Required field "Name" is empty
          severity: required
          priority: 1
    apply:
      patches:
        - op: set_string
          field_id: name
          value: John Doe
    after:
      required_issue_count: 0
      markdown_sha256: abc123def456
final:
  expect_complete: true
  expected_completed_form: examples/simple/simple.mock.filled.form.md
`;

const MINIMAL_SESSION = `session_version: "0.1.0"
mode: mock
form:
  path: test.form.md
harness:
  max_issues: 5
  max_patches_per_turn: 3
  max_turns: 10
turns: []
final:
  expect_complete: true
  expected_completed_form: test.filled.form.md
`;

const INVALID_SESSION_YAML = `session_version: "0.1.0"
mode: invalid_mode
form:
  path: test.form.md
`;

// =============================================================================
// Tests
// =============================================================================

describe("session module", () => {
  describe("parseSession", () => {
    it("parses valid session YAML", () => {
      const session = parseSession(VALID_SESSION_YAML);

      expect(session.sessionVersion).toBe("0.1.0");
      expect(session.mode).toBe("mock");
      expect(session.form.path).toBe("examples/simple/simple.form.md");
      expect(session.harness.maxIssues).toBe(5);
      expect(session.turns.length).toBe(1);
    });

    it("parses minimal session YAML", () => {
      const session = parseSession(MINIMAL_SESSION);

      expect(session.sessionVersion).toBe("0.1.0");
      expect(session.mode).toBe("mock");
      expect(session.turns.length).toBe(0);
    });

    it("converts snake_case keys to camelCase", () => {
      const session = parseSession(VALID_SESSION_YAML);

      // Check that snake_case keys are converted
      expect(session.harness.maxPatchesPerTurn).toBe(3);
      expect(session.harness.maxTurns).toBe(10);
      expect(session.mock?.completedMock).toBe(
        "examples/simple/simple.mock.filled.form.md"
      );
      expect(session.final.expectComplete).toBe(true);
      expect(session.final.expectedCompletedForm).toBe(
        "examples/simple/simple.mock.filled.form.md"
      );
    });

    it("parses turn structure correctly", () => {
      const session = parseSession(VALID_SESSION_YAML);
      const turn = session.turns[0]!;

      expect(turn.turn).toBe(1);
      expect(turn.inspect.issues.length).toBe(1);
      expect(turn.inspect.issues[0]!.ref).toBe("name");
      expect(turn.inspect.issues[0]!.scope).toBe("field");
      expect(turn.inspect.issues[0]!.reason).toBe("required_missing");
      expect(turn.apply.patches.length).toBe(1);
      expect(turn.after.requiredIssueCount).toBe(0);
      expect(turn.after.markdownSha256).toBe("abc123def456");
    });

    it("throws on invalid session YAML", () => {
      expect(() => parseSession(INVALID_SESSION_YAML)).toThrow();
    });

    it("throws on malformed YAML", () => {
      expect(() => parseSession("not: valid: yaml: {{")).toThrow();
    });
  });

  describe("serializeSession", () => {
    it("serializes session to YAML", () => {
      const session: SessionTranscript = {
        sessionVersion: "0.1.0",
        mode: "mock",
        form: { path: "test.form.md" },
        harness: {
          maxIssues: 5,
          maxPatchesPerTurn: 3,
          maxTurns: 10,
        },
        turns: [],
        final: {
          expectComplete: true,
          expectedCompletedForm: "test.filled.form.md",
        },
      };

      const yaml = serializeSession(session);

      expect(yaml).toContain("session_version:");
      expect(yaml).toContain("mode: mock");
      expect(yaml).toContain("max_issues: 5");
      expect(yaml).toContain("max_patches_per_turn: 3");
    });

    it("converts camelCase keys to snake_case", () => {
      const session: SessionTranscript = {
        sessionVersion: "0.1.0",
        mode: "live",
        form: { path: "test.form.md" },
        harness: {
          maxIssues: 10,
          maxPatchesPerTurn: 5,
          maxTurns: 20,
        },
        turns: [],
        final: {
          expectComplete: false,
          expectedCompletedForm: "test.form.md",
        },
      };

      const yaml = serializeSession(session);

      // Should use snake_case in YAML output
      expect(yaml).toContain("session_version:");
      expect(yaml).toContain("max_issues:");
      expect(yaml).toContain("max_patches_per_turn:");
      expect(yaml).toContain("max_turns:");
      expect(yaml).toContain("expect_complete:");
      expect(yaml).toContain("expected_completed_form:");

      // Should NOT contain camelCase
      expect(yaml).not.toContain("sessionVersion:");
      expect(yaml).not.toContain("maxIssues:");
    });

    it("serializes turns with all fields", () => {
      const session: SessionTranscript = {
        sessionVersion: "0.1.0",
        mode: "mock",
        form: { path: "test.form.md" },
        harness: {
          maxIssues: 5,
          maxPatchesPerTurn: 3,
          maxTurns: 10,
        },
        turns: [
          {
            turn: 1,
            inspect: {
              issues: [
                {
                  ref: "field1",
                  scope: "field",
                  reason: "required_missing",
                  message: "Field is empty",
                  severity: "required",
                  priority: 1,
                },
              ],
            },
            apply: {
              patches: [{ op: "set_string", fieldId: "field1", value: "test" }],
            },
            after: {
              requiredIssueCount: 1,
              markdownSha256: "abc123def456",
            },
          },
        ],
        final: {
          expectComplete: true,
          expectedCompletedForm: "test.filled.form.md",
        },
      };

      const yaml = serializeSession(session);

      expect(yaml).toContain("turn: 1");
      expect(yaml).toContain("field_id: field1");
      expect(yaml).toContain("required_issue_count:");
      expect(yaml).toContain("markdown_sha256: abc123def456");
    });
  });

  describe("round-trip", () => {
    it("parse → serialize → parse produces identical session", () => {
      const original = parseSession(VALID_SESSION_YAML);
      const serialized = serializeSession(original);
      const reparsed = parseSession(serialized);

      expect(reparsed.sessionVersion).toBe(original.sessionVersion);
      expect(reparsed.mode).toBe(original.mode);
      expect(reparsed.form.path).toBe(original.form.path);
      expect(reparsed.harness.maxIssues).toBe(original.harness.maxIssues);
      expect(reparsed.turns.length).toBe(original.turns.length);
      expect(reparsed.final.expectComplete).toBe(original.final.expectComplete);
    });

    it("preserves turn details through round-trip", () => {
      const original = parseSession(VALID_SESSION_YAML);
      const serialized = serializeSession(original);
      const reparsed = parseSession(serialized);

      expect(reparsed.turns[0]!.turn).toBe(original.turns[0]!.turn);
      expect(reparsed.turns[0]!.inspect.issues.length).toBe(
        original.turns[0]!.inspect.issues.length
      );
      expect(reparsed.turns[0]!.apply.patches.length).toBe(
        original.turns[0]!.apply.patches.length
      );
    });
  });
});
