import fs from "fs";
import postgres from "postgres";
const env = fs.readFileSync(new URL("../../../.env.local", import.meta.url),"utf8");
const m = env.match(/^DATABASE_URL=["']?([^"'\n]+)/m);
if(!m) throw new Error("no DATABASE_URL");
export const sql = postgres(m[1].trim(), { ssl: "require", max: 2, prepare:false, idle_timeout: 5 });
