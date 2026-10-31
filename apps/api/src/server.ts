import { buildApp } from "./app";
import { env } from "./env";

const app = await buildApp({ logger: false });
try {
  // "::" listens on IPv6 and IPv4, so "localhost" works whichever it resolves to.
  await app.listen({ port: env.port, host: "::" });
  console.log(`WindVeal API running on http://localhost:${env.port}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
