import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

/**
 * Every better-auth endpoint lives under this catch-all: magic-link request
 * and verify, anonymous sign-in, session read, sign-out. The handler speaks
 * plain Request/Response, so the App Router export is the whole wiring.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
