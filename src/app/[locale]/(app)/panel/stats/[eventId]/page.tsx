import { GamePage } from "@/components/stats/GamePage";

/** The calendar lives in the browser for now, so every game id is resolved on the client. */
export const dynamicParams = true;

export default async function GameRoute({ params }: PageProps<"/[locale]/panel/stats/[eventId]">) {
  const { eventId } = await params;
  return <GamePage eventId={eventId} />;
}
