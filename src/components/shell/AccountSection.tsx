"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { authClient } from "@/lib/auth-client";
import { playSound } from "@/lib/sound";
import { configuredTransport, deviceNamespace } from "@/lib/sync";

/**
 * The Settings account section: the whole sign-in surface of the app. An
 * account is a magic link sent to an email address; there are no passwords
 * and no profile beyond the address itself. Three states render: signed out
 * (email field plus an anonymous-session option), anonymous (a server-side
 * identity without an email), and signed in (the address, the sign-out
 * action, and the namespace sync will use). Every state names the identity
 * sync resolves to, because that is what an account is for here.
 */
export default function AccountSection() {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  /** The signed-out sync identity, read in an effect because it lives in
   *  localStorage and minting it on the server would be a lie. */
  const [deviceSlug, setDeviceSlug] = useState<string | null>(null);

  useEffect(() => {
    if (configuredTransport()) setDeviceSlug(deviceNamespace());
  }, []);

  const user = session?.user;
  const isAnonymous = Boolean(user && (user as { isAnonymous?: boolean }).isAnonymous);

  async function sendLink() {
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setMessage("");
    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: "/workspace?tab=settings",
    });
    setBusy(false);
    setMessage(
      error
        ? "The link could not be sent. Try again in a moment."
        : `Link sent to ${address}. On a deployment without email configured, the server log holds the link instead.`,
    );
    // A sent link is a completion; a failed send is the honest low cluster.
    playSound(error ? "error" : "complete");
  }

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    setBusy(false);
  }

  async function goAnonymous() {
    setBusy(true);
    setMessage("");
    const { error } = await authClient.signIn.anonymous();
    setBusy(false);
    if (error) {
      setMessage("An anonymous session could not be started on this deployment.");
      playSound("error");
    }
  }

  /** The line every state ends with: what identity sync will use. */
  function syncIdentity(): string {
    if (user) return `Sync namespace: ${isAnonymous ? "this anonymous session" : "your account"} (${user.id})`;
    if (deviceSlug) return `Sync namespace while signed out: this device's slug (${deviceSlug})`;
    return "Sync is not configured on this deployment; export and import remain the bridge.";
  }

  return (
    <section className="glass rounded-[4px] p-5" style={{ "--i": 1 } as CSSProperties}>
      <h3 className="small-caps mb-3 text-sm text-muted">Account: one address, every device</h3>

      {isPending ? (
        <p className="text-sm text-muted">Reading the session…</p>
      ) : user && !isAnonymous ? (
        <div className="grid gap-3">
          <p className="text-sm">
            Signed in as <span className="font-medium">{user.email}</span>.
          </p>
          <button
            onClick={signOut}
            disabled={busy}
            className="fx-press justify-self-start rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-40"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {isAnonymous && (
            <p className="text-sm">
              This device works under an anonymous session: a server-side identity with no email
              attached. Add an address below to sign in; the named account starts its own sync
              namespace and does not inherit the anonymous one.
            </p>
          )}
          <label className="text-sm">
            <span className="mb-1 block font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendLink();
              }}
              placeholder="you@example.com"
              className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={sendLink}
              disabled={busy || !email.trim()}
              className="fx-press rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Send the link
            </button>
            {!isAnonymous && (
              <button
                onClick={goAnonymous}
                disabled={busy}
                className="fx-press rounded-[4px] border border-rule px-4 py-2 text-sm font-medium hover:bg-paper disabled:opacity-40"
              >
                Continue without an account
              </button>
            )}
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-sm text-emerald">{message}</p>}
      <p className="mt-3 border-t border-rule pt-3 text-xs text-muted">
        {syncIdentity()} An account is never required: nothing in the app is locked behind one, no
        password exists to lose, and the link is the whole credential.
      </p>
    </section>
  );
}
