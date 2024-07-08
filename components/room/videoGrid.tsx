import React, { RefObject } from "react";

interface VideoGridProps {
  isSharingScreen: boolean;
  videoRef: RefObject<HTMLVideoElement>;
  user: string;
}

export default function VideoGrid({
  isSharingScreen,
  videoRef,
  user,
}: VideoGridProps) {
  return (
    <div id="video-grid" className="video-grid">
    </div>
  );
}
