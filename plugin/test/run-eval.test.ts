import { expect, test } from "bun:test"

import {
  buildEvalWarnings,
  buildOpenCodeRunCommand,
  lineIndicatesTrigger,
  type EvalResultItem,
} from "../lib/run-eval"

const CLEAN_NAME = "docker-helper-skill-abcd1234"

const skillReadEvent = JSON.stringify({
  type: "tool_use",
  part: {
    tool: "read",
    input: {
      path: `/tmp/.opencode/skills/${CLEAN_NAME}/SKILL.md`,
    },
  },
})

const bashEvent = JSON.stringify({
  type: "tool_use",
  part: {
    tool: "bash",
    input: {
      command: `cat /tmp/.opencode/skills/${CLEAN_NAME}/SKILL.md`,
    },
  },
})

const textMentionEvent = JSON.stringify({
  type: "text",
  part: {
    text: `Delegating to Sisyphus with available skill ${CLEAN_NAME} for this task.`,
  },
})

const unrelatedEvent = JSON.stringify({
  type: "tool_use",
  part: {
    tool: "write",
    input: { path: "/tmp/other.md" },
  },
})

const baseResult = (overrides: Partial<EvalResultItem>): EvalResultItem => ({
  query: "query",
  should_trigger: true,
  trigger_rate: 0,
  triggers: 0,
  runs: 3,
  successful_runs: 3,
  errors: 0,
  pass: false,
  ...overrides,
})

test("buildOpenCodeRunCommand uses the build agent by default", () => {
  expect(buildOpenCodeRunCommand("Create a skill", {})).toEqual([
    "opencode",
    "run",
    "--format",
    "json",
    "--agent",
    "build",
    "Create a skill",
  ])
})

test("buildOpenCodeRunCommand accepts a custom agent and model", () => {
  expect(
    buildOpenCodeRunCommand("Create a skill", {
      agent: "custom-agent",
      model: "openai/gpt-5.5",
    }),
  ).toEqual([
    "opencode",
    "run",
    "--format",
    "json",
    "--agent",
    "custom-agent",
    "--model",
    "openai/gpt-5.5",
    "Create a skill",
  ])
})

test("buildEvalWarnings warns when all should-trigger results have zero triggers and no errors", () => {
  expect(
    buildEvalWarnings([
      baseResult({ query: "trigger one" }),
      baseResult({ query: "trigger two" }),
      baseResult({
        query: "negative",
        should_trigger: false,
        pass: true,
      }),
    ]),
  ).toEqual([
    "All should-trigger queries produced 0 triggers with no run errors. If you are using a routing agent (e.g. oh-my-openagent's Sisyphus) that does not emit skill tool events, set detectionMode: 'auto' or 'marker-scan' — the default 'auto' already tries both. Otherwise verify the eval set queries actually describe when this skill should trigger.",
  ])
})

test("buildEvalWarnings returns no warnings when any should-trigger query triggers", () => {
  expect(
    buildEvalWarnings([
      baseResult({ query: "trigger one" }),
      baseResult({
        query: "trigger two",
        trigger_rate: 1,
        triggers: 3,
        pass: true,
      }),
    ]),
  ).toEqual([])
})

test("lineIndicatesTrigger: tool-event mode catches skill/read events (stock build agent)", () => {
  expect(lineIndicatesTrigger(skillReadEvent, CLEAN_NAME, "tool-event")).toBe(true)
})

test("lineIndicatesTrigger: tool-event mode ignores non-skill/read tool_use events", () => {
  expect(lineIndicatesTrigger(bashEvent, CLEAN_NAME, "tool-event")).toBe(false)
})

test("lineIndicatesTrigger: tool-event mode ignores text-event marker mentions", () => {
  expect(lineIndicatesTrigger(textMentionEvent, CLEAN_NAME, "tool-event")).toBe(false)
})

test("lineIndicatesTrigger: auto mode catches any tool_use event referencing marker (oh-my-openagent)", () => {
  expect(lineIndicatesTrigger(bashEvent, CLEAN_NAME, "auto")).toBe(true)
})

test("lineIndicatesTrigger: auto mode catches text-event marker mentions (oh-my-openagent)", () => {
  expect(lineIndicatesTrigger(textMentionEvent, CLEAN_NAME, "auto")).toBe(true)
})

test("lineIndicatesTrigger: auto mode remains backwards-compatible with skill/read events", () => {
  expect(lineIndicatesTrigger(skillReadEvent, CLEAN_NAME, "auto")).toBe(true)
})

test("lineIndicatesTrigger: marker-scan mode matches broadly across event types", () => {
  expect(lineIndicatesTrigger(skillReadEvent, CLEAN_NAME, "marker-scan")).toBe(true)
  expect(lineIndicatesTrigger(bashEvent, CLEAN_NAME, "marker-scan")).toBe(true)
  expect(lineIndicatesTrigger(textMentionEvent, CLEAN_NAME, "marker-scan")).toBe(true)
})

test("lineIndicatesTrigger: no mode falsely triggers on unrelated events", () => {
  for (const mode of ["tool-event", "marker-scan", "auto"] as const) {
    expect(lineIndicatesTrigger(unrelatedEvent, CLEAN_NAME, mode)).toBe(false)
  }
})

test("lineIndicatesTrigger: gracefully skips non-JSON, empty, and malformed lines", () => {
  for (const mode of ["tool-event", "marker-scan", "auto"] as const) {
    expect(lineIndicatesTrigger("", CLEAN_NAME, mode)).toBe(false)
    expect(lineIndicatesTrigger("   ", CLEAN_NAME, mode)).toBe(false)
    expect(lineIndicatesTrigger("not-json", CLEAN_NAME, mode)).toBe(false)
    expect(lineIndicatesTrigger("{}", CLEAN_NAME, mode)).toBe(false)
  }
})
