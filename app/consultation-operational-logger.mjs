import fs from "node:fs";
import path from "node:path";

function safeErrorMessage(error) {
  const message = String(error?.message ?? "unexpected error");
  return message
    .replace(/[A-Za-z]:[\\/][^\s"']+/gu, "<local-path>")
    .replace(/(?:Bearer\s+)[^\s"']+/giu, "Bearer <redacted>");
}

export function errorFields(error) {
  return {
    error_name: String(error?.name ?? "Error"),
    error_code: error?.code ? String(error.code) : null,
    error_message: safeErrorMessage(error),
  };
}

export function createOperationalLogger({ service, logPath = null, stderr = console } = {}) {
  let stream = null;
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    stream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf8" });
  }
  const write = (level, event, fields = {}) => {
    const record = JSON.stringify({
      timestamp: new Date().toISOString(), service, level, event, ...fields,
    });
    stderr.error(record);
    stream?.write(`${record}\n`);
  };
  return {
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
    close: () => new Promise((resolve) => {
      if (!stream) return resolve();
      stream.end(resolve);
    }),
  };
}
