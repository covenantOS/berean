/**
 * The browser half of the account system (src/lib/auth.ts): one auth client
 * for the Settings account section. The plugins mirror the server config so
 * the client knows the magic-link and anonymous endpoints exist. Session
 * state comes from useSession(), which polls /api/auth; nothing is stored
 * client-side beyond better-auth's own cookie.
 */

import { anonymousClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), anonymousClient()],
});
