import { LiveMeeting } from "@/components/meetings/live/LiveMeeting";

/** The calendar lives on the client, so every meeting id is resolved there. */
export const dynamicParams = true;

export default async function LiveMeetingRoute({ params }: PageProps<"/[locale]/panel/meetings/[eventId]/live">) {
  const { eventId } = await params;
  return <LiveMeeting eventId={eventId} />;
}
