import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  webPool?: Pool;
  botPool?: Pool;
};

const getSslOption = (url?: string) => {
  if (!url || url.includes("localhost")) return undefined;
  return { rejectUnauthorized: false };
};

// 1. 웹 전용 DB (유저, 결제, 동의)
export const webPool =
  globalForPg.webPool ??
  new Pool({
    connectionString: process.env.WEB_DATABASE_URL || process.env.DATABASE_URL,
    ssl: getSslOption(process.env.WEB_DATABASE_URL || process.env.DATABASE_URL),
  });

// 2. 봇 전용 DB (대화 내역, 장기기억)
export const botPool =
  globalForPg.botPool ??
  new Pool({
    connectionString: process.env.BOT_DATABASE_URL,
    ssl: getSslOption(process.env.BOT_DATABASE_URL),
  });

// 기존 파일들(users.ts 등)과의 호환성을 위한 별칭 export
export const pool = webPool;
export const db = webPool;

if (process.env.NODE_ENV !== "production") {
  globalForPg.webPool = webPool;
  globalForPg.botPool = botPool;
}