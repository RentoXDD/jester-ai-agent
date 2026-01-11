export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";
export function log(level: LogLevel, message: string, meta: any = {}) {
  const time = new Date().toISOString();
  console.log(JSON.stringify({ time, level, message, ...meta }));
}
