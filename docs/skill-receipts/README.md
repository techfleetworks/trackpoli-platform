# Skill-application receipts

`log.jsonl` is an append-only record: one entry per change, covering every enterprise skill as
`applied` (with a verbatim quote from the skill and the files it touched) or `not-applicable` (with a
reason). `npm run check:receipt` validates completeness and grounding.

This receipt is the agent's self-report. A human must review the work against the diff. It does not prove the work was done or done well.
