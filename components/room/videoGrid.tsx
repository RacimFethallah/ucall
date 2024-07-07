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
      <div
        id="video-container"
        className={
          isSharingScreen
            ? "full-screen"
            : "video-container shadow-2xl bg-gray-700 border border-gray-300 p-3 rounded-xl flex flex-col justify-center items-center gap-2"
        }
      >
        {!isSharingScreen && (
          <>
          </>
          // <span className="text-lg text-black bg-white rounded-lg px-5 py-2">
          //   {user} (You)
          // </span>
        )}
        <video
          ref={videoRef}
          muted
          className={`rounded-lg ${
            isSharingScreen ? "w-full" : ""
          } object-cover`}
        />
      </div>
    </div>
  );
}
