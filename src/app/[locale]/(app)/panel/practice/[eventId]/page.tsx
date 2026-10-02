import { PracticePlanPage } from "@/components/practice/PracticePlanPage";

/** The calendar lives in the browser for now, so every practice id is resolved on the client. */
export const dynamicParams = true;

export default async function PracticePlanRoute({ params }: PageProps<"/[locale]/panel/practice/[eventId]">) {
  const { eventId } = await params;
  return <PracticePlanPage eventId={eventId} />;
}
