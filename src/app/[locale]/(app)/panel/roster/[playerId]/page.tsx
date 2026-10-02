import { PlayerProfile } from "@/components/team/PlayerProfile";

/** The roster lives in the browser for now, so every player id is resolved on the client. */
export const dynamicParams = true;

export default async function PlayerRoute({ params }: PageProps<"/[locale]/panel/roster/[playerId]">) {
  const { playerId } = await params;
  return <PlayerProfile playerId={playerId} />;
}
