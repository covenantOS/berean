"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Jump straight to a Strong's number (H1…H8674, G1…G5624). */
export default function LexiconLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const id = value.trim().toUpperCase().replace(/\s+/g, "");
        if (/^[GH]\d+$/.test(id)) router.push(`/lexicon/${id}`);
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Strong's number — e.g. H7225 or G26"
        className="w-full rounded-[4px] border border-rule bg-surface px-4 py-2.5 text-sm outline-none focus:border-sapphire"
      />
      <button
        type="submit"
        className="small-caps rounded-[4px] bg-sapphire px-4 py-2.5 text-sm text-white"
      >
        Look up
      </button>
    </form>
  );
}
