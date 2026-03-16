import WorkspaceContent from "@/components/workspace/workspace-content";

export const metadata = {
  title: "Workspace – MathBoard",
};

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <WorkspaceContent workspaceId={id} />;
}
