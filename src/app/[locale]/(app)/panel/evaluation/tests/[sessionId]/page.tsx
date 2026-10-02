import { TestSessionPage } from "@/components/evaluation/TestSessionPage";

/** Test days live in the browser for now, so every id is resolved on the client. */
export const dynamicParams = true;

export default async function TestSessionRoute({ params }: PageProps<"/[locale]/panel/evaluation/tests/[sessionId]">) {
  const { sessionId } = await params;
  return <TestSessionPage sessionId={sessionId} />;
}
