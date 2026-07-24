"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { playSound } from "@/lib/sound";

/**
 * The landing's account form: one email address, one magic link. It posts
 * to the better-auth route (/api/auth/sign-in/magic-link) through the same
 * client the Settings account section uses, so the two surfaces never
 * disagree about the shape of a sign-in. The link itself is the whole
 * credential; delivery is the deployment's concern (RESEND_API_KEY on the
 * server), and this form says nothing about how it travels. The success
 * state is the honest end of the flow from the user's side: the email is
 * where the link lives now.
 */
export default function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!address || state === "busy") return;
    setState("busy");
    const { error } = await authClient.signIn.magicLink({
      email: address,
      callbackURL: "/workspace",
    });
    setState(error ? "error" : "sent");
    playSound(error ? "error" : "complete");
  }

  if (state === "sent") {
    return (
      <div role="status">
        <p className="font-editorial text-xl font-bold">Check your email.</p>
        <p className="mt-2 text-sm text-muted">
          The link for <span className="font-medium text-ink">{email.trim()}</span>{" "}
          signs you in and returns you to the workspace. It expires shortly and
          works once.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-[4px] border border-rule bg-paper px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={state === "busy" || !email.trim()}
        className="fx-press justify-self-start rounded-[4px] bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40"
      >
        {state === "busy" ? "Sending…" : "Send the link"}
      </button>
      {state === "error" && (
        <p role="alert" className="text-sm text-ruby">
          The link could not be sent. Try again in a moment.
        </p>
      )}
    </form>
  );
}
