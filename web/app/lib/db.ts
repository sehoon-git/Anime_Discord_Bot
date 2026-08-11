import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  webPool?: Pool;
  botPool?: Pool;
};

const webDatabaseUrl = process.env.WEB_DATABASE_URL || process.env.DATABASE_URL;
// 봇 데이터는 웹 DB로 대체하지 않습니다. BOT_DATABASE_URL이 없으면
// PostgreSQL 기본 연결로 잘못 붙거나 웹 DB와 데이터가 섞일 수 있습니다.
const botDatabaseUrl = process.env.BOT_DATABASE_URL;

const getSslOption = (url?: string) => {
  if (!url || url.includes("localhost")) return undefined;
  return { rejectUnauthorized: false };
};

export const webPool =
  globalForPg.webPool ??
  new Pool({
    connectionString: webDatabaseUrl,
    ssl: getSslOption(webDatabaseUrl),
  });

export const botPool =
  globalForPg.botPool ??
  new Pool({
    connectionString: botDatabaseUrl,
    ssl: getSslOption(botDatabaseUrl),
  });

export const pool = webPool;
export const db = webPool;

if (process.env.NODE_ENV !== "production") {
  globalForPg.webPool = webPool;
  globalForPg.botPool = botPool;
}
