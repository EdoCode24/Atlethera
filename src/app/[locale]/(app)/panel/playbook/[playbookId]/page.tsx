import { PlaybookDetail } from "@/components/playbook/PlaybookDetail";

/** Playbooks live in the browser for now, so every id is resolved on the client. */
export const dynamicParams = true;

export default async function PlaybookPage({ params }: PageProps<"/[locale]/panel/playbook/[playbookId]">) {
  const { playbookId } = await params;
  return <PlaybookDetail playbookId={playbookId} />;
}
