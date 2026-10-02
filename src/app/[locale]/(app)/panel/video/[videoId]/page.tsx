import { VideoPage } from "@/components/video/VideoPage";

/** Videos live in the browser for now, so every id is resolved on the client. */
export const dynamicParams = true;

export default async function VideoDetailRoute({ params }: PageProps<"/[locale]/panel/video/[videoId]">) {
  const { videoId } = await params;
  return <VideoPage videoId={videoId} />;
}
