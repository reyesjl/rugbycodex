type LogLevel = "info" | "error" | "debug";

type LogFields = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function serializeError(err: unknown) {
  if (!err) return null;
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

function writeLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = {
    level,
    event,
    ts: nowIso(),
    ...fields,
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function logEvent(event: string, fields?: LogFields) {
  writeLog("info", event, fields);
}

export function logDebug(event: string, fields?: LogFields) {
  writeLog("debug", event, fields);
}

export function logError(event: string, err: unknown, fields?: LogFields) {
  writeLog("error", event, {
    error: serializeError(err),
    ...fields,
  });
}
