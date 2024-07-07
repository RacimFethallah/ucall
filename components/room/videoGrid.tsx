import React, { useRef, useEffect } from "react";

interface VideoGridProps {
  isSharingScreen: boolean;
  localStream: MediaStream | null;
  remoteStreams: { [key: string]: MediaStream };
  users: { [key: string]: { name: string; peerId: string } };
  currentUserId: string;
}

export default function VideoGrid({
  isSharingScreen,
  localStream,
  remoteStreams,
  users,
  currentUserId,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const videoContainerClass = isSharingScreen
    ? "full-screen"
    : "video-container shadow-2xl bg-gray-700 border border-gray-300 p-3 rounded-xl flex flex-col justify-center items-center gap-2";

  return (
    <div id="video-grid" className="video-grid grid grid-cols-2 gap-4">
      <div className={videoContainerClass}>
        <video ref={localVideoRef} autoPlay muted playsInline />
        <span className="text-lg text-black bg-white rounded-lg px-5 py-2">
          {users[currentUserId]?.name || "You"}
        </span>
      </div>
      {Object.entries(users).map(([userId, user]) => {
        if (userId === currentUserId) return null; // Skip the current user
        const stream = remoteStreams[user.peerId];
        return (
          <div key={userId} className={videoContainerClass}>
            {stream ? (
              <video
                ref={(el) => {
                  if (el) el.srcObject = stream;
                }}
                autoPlay
                playsInline
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p>Connecting...</p>
              </div>
            )}
            <span className="text-lg text-black bg-white rounded-lg px-5 py-2">
              {user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
