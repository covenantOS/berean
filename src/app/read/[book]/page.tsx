import { notFound, permanentRedirect } from "next/navigation";
import { getBook } from "@/lib/canon";

/**
 * /read/[book] retired into the workspace: the canon tree in the workspace
 * launcher covers picking a chapter. The book still validates exactly as the
 * old picker did — unknown books 404 — then the workspace opens.
 * /read/[book]/[chapter] stays the citation scheme.
 */
export default async function BookRedirect({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book } = await params;
  if (!getBook(book)) notFound();
  permanentRedirect("/workspace");
}
