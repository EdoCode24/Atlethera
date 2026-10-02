import { MeetingPage } from "@/components/meetings/MeetingPage";

/** The calendar lives in the browser for now, so every meeting id is resolved on the client. */
export const dynamicParams = true;

export default async function MeetingRoute({ params }: PageProps<"/[locale]/panel/meetings/[eventId]">) {
  const { eventId } = await params;
  return <MeetingPage eventId={eventId} />;
}
