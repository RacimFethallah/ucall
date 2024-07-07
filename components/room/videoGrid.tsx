import React from "react";



interface VideoGridProps {
  isSharingScreen: boolean;

  user: string | null;
}

export default function VideoGrid({
  isSharingScreen,
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
          <span className="text-lg text-black bg-white rounded-lg px-5 py-2">
            {user ? user : "You"}
          </span>
        )}
      </div>
    </div>
  );
}
