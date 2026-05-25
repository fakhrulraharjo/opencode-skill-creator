import { expect, test } from "bun:test"

import { isFailedExitCode } from "../lib/process"

test("isFailedExitCode treats only defined non-zero exit codes as failures", () => {
  expect(isFailedExitCode(1)).toBe(true)
  expect(isFailedExitCode(0)).toBe(false)
  expect(isFailedExitCode(null)).toBe(false)
})
