import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.prod-temp" });

const c = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const r1 = await c`SELECT column_name FROM information_schema.columns WHERE table_schema='cognify_v2' AND table_name='calibration_runs' AND column_name='alert_sent_at'`;
  const r2 = await c`SELECT to_regclass('cognify_v2.score_corrections') as t`;
  console.log("PROD calibration_runs.alert_sent_at exists:", r1.length > 0);
  console.log("PROD score_corrections table exists:", r2[0].t !== null);
} finally {
  await c.end();
}
