import { buildApp } from "./app";
import { env } from "./env";

const app = await buildApp({ logger: false });
try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
  console.log(`WindVeal API running on http://localhost:${env.port}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
