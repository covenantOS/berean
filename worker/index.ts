import { Container, getRandom } from "@cloudflare/containers";

interface BereanEnv {
  BEREAN: unknown;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  MINIMAX_API_KEY?: string;
}

/**
 * The front door: every request load-balances across up to four container
 * instances of the standalone Next.js server. The app keeps its state in
 * Neon and the browser, so instances are interchangeable. Secrets set with
 * `wrangler secret put` bind to the Worker and are forwarded into the
 * container process here (see DEPLOY.md for the dashboard fallback).
 *
 * The Cloudflare runtime types stay out of the app's tsconfig on purpose:
 * @cloudflare/workers-types overrides the DOM fetch types the rest of the
 * app is built against, so this file leans on the containers package's own
 * generics and one honest cast at the namespace boundary.
 */
export class BereanServer extends Container {
  defaultPort = 8080;
  sleepAfter = "30s";

  constructor(ctx: ConstructorParameters<typeof Container>[0], env: BereanEnv) {
    super(ctx, env);
    this.envVars = {
      PORT: "8080",
      NODE_ENV: "production",
      ...(env.DATABASE_URL ? { DATABASE_URL: env.DATABASE_URL } : {}),
      ...(env.BETTER_AUTH_SECRET ? { BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET } : {}),
      ...(env.BETTER_AUTH_URL ? { BETTER_AUTH_URL: env.BETTER_AUTH_URL } : {}),
      ...(env.MINIMAX_API_KEY ? { MINIMAX_API_KEY: env.MINIMAX_API_KEY } : {}),
    };
  }

  override onStart() {
    console.log("Berean container started");
  }

  override onError(error: unknown) {
    console.log("Berean container error:", error);
  }
}

export default {
  async fetch(request: Request, env: BereanEnv): Promise<Response> {
    // Canonical host: berean.blue. The www subdomain and the bereanblue.com
    // defensive registration land here permanently.
    const url = new URL(request.url);
    if (url.hostname !== "berean.blue" && !url.hostname.endsWith(".workers.dev")) {
      url.hostname = "berean.blue";
      return Response.redirect(url.toString(), 308);
    }
    const container = await getRandom(
      env.BEREAN as Parameters<typeof getRandom>[0],
      1
    );
    return container.fetch(request);
  },
};
