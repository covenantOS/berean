import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace",
  description: "The Berean workspace: tabbed, splittable panes over one knowledge graph.",
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
