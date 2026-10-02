import { PlayEditor } from "@/components/playbook/PlayEditor";

export const dynamicParams = true;

export default async function PlayPage({ params }: PageProps<"/[locale]/panel/playbook/[playbookId]/[playId]">) {
  const { playbookId, playId } = await params;
  return <PlayEditor playbookId={playbookId} playId={playId} />;
}
