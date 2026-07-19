import { NextResponse } from "next/server";
import { getAvailableTranslations } from "@/lib/translations";

/**
 * The translation shelf as workspace chrome sees it: the reader pane's swap
 * control lists these. The shelf itself lives in src/lib/translations.ts,
 * which reads the disk and so cannot be imported by client components.
 */
export async function GET() {
  const available = await getAvailableTranslations();
  return NextResponse.json({
    translations: available.map((t) => ({
      id: t.id,
      abbrev: t.abbrev,
      name: t.name,
      otOnly: t.otOnly === true,
    })),
  });
}
