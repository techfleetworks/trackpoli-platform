// The app's reporting spine. decisions.md (Error handling) requires every failure to "recover/retry AND
// report through the app's reporting spine" — a console.error alone is not reporting. This is the single
// seam the client/server app reports through. The TP1-02 infra step wires it to Sentry
// (NEXT_PUBLIC_SENTRY_DSN); until then it emits a structured line so a failure is never silently
// swallowed. report() never throws: reporting must not mask the original failure.

export type Severity = "debug" | "info" | "warning" | "error";

export interface ReportContext {
  readonly [key: string]: string | number | boolean | null | undefined;
}

export function report(severity: Severity, message: string, context: ReportContext = {}): void {
  const line = JSON.stringify({ at: "report", severity, message, ...context });
  // Placeholder sink until Sentry is wired in the TP1-02 infra step; structured so it is machine-greppable.
  if (severity === "error" || severity === "warning") {
    console.error(line);
  } else {
    console.info(line);
  }
}
