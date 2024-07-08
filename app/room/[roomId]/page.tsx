"use client";

import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { MdChat } from "react-icons/md";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import ChatWindow from "@/components/room/chatWindow";
import VideoGrid from "@/components/room/videoGrid";
import ControlBar from "@/components/room/ControlBar";
import Peer, { MediaConnection } from "peerjs";

export default function Room({ params }: { params: { roomId: string } }) {
  const [userCount, setUserCount] = useState(1);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<{ [id: string]: MediaConnection }>({});
  const videoElementsRef = useRef<{ [id: string]: HTMLDivElement }>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ userId: string; text: string }[]>(
    []
  );
  const [inputMessage, setInputMessage] = useState("");
  const [username, setUsername] = useState<string>("");

  const supabase = createClient();

  useEffect(() => {
    const peer = new Peer();
    let localStream: MediaStream;

    const setupRoom = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        console.error("Authentication error:", error);
        router.push("/login");
        return;
      }

      const userKey = user.id;
      const username = user.user_metadata.username;
      setUsername(username);

      const roomChannel = supabase.channel(`room_${params.roomId}`, {
        config: {
          presence: {
            key: userKey,
          },
        },
      });

      roomChannel
        .on("presence", { event: "sync" }, () => {
          const newState = roomChannel.presenceState();
          const usersInRoom = Object.entries(newState).map(([key, value]) => ({
            key,
            name: (value as any)[0]?.name || "Anonymous",
          }));
          setUserCount(usersInRoom.length);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          const newUser = {
            key,
            name: (newPresences as any)[0]?.name || "Anonymous",
            peerId: (newPresences as any)[0]?.peerId,
          };
          toast.success(`${newUser.name} joined the room`);
          if (localStream && newUser.peerId !== peer.id) {
            connectToNewUser(newUser.peerId, newUser.name, peer, localStream);
          }
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          if (peersRef.current[key]) {
            peersRef.current[key].close();
          }
          if (videoElementsRef.current[key]) {
            videoElementsRef.current[key].remove();
            delete videoElementsRef.current[key];
          }
          toast.info(`A user left the room`);
        })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          toast.info(`New message from ${payload.userId}`)
          setMessages((prevMessages) => [...prevMessages, payload]);
        });

      setChannel(roomChannel);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(localStream);
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          videoRef.current.play();
        }

        localStream
          .getVideoTracks()
          .forEach((track) => (track.enabled = false));

        peer.on("call", (call) => {
          call.answer(localStream);
          call.on("stream", (userVideoStream) => {
            const remoteUsername = call.metadata?.username || "Remote User";
            addVideoStream(userVideoStream, call.peer, remoteUsername);
          });
        });

        peer.on("open", (peerId) => {
          roomChannel.track({
            online_at: new Date().toISOString(),
            name: username,
            peerId: peerId,
          });
        });

        await roomChannel.subscribe();
      } catch (err) {
        console.error("Failed to get local stream", err);
      }
    };

    setupRoom();

    return () => {
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
      peer.destroy();
      channel?.unsubscribe();
    };
  }, [params.roomId]);

  const connectToNewUser = (
    userId: string,
    username: string,
    peer: Peer,
    stream: MediaStream
  ) => {
    const call = peer.call(userId, stream, {
      metadata: { username: username },
    });
    call.on("stream", (userVideoStream) => {
      addVideoStream(userVideoStream, userId, username);
    });

    call.on("close", () => {
      if (videoElementsRef.current[userId]) {
        videoElementsRef.current[userId].remove();
        delete videoElementsRef.current[userId];
      }
      if (peersRef.current[userId]) {
        delete peersRef.current[userId];
      }
    });

    peersRef.current[userId] = call;
  };

  const addVideoStream = (
    stream: MediaStream,
    userId: string,
    username: string
  ) => {
    if (videoElementsRef.current[userId]) {
      return;
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", () => {
      video.play();
    });

    const videoGrid = document.getElementById("video-grid");
    const videoContainer = document.createElement("div");
    videoContainer.id = "video-container";
    videoContainer.className =
      "video-container shadow-2xl bg-gray-700 border border-gray-300 p-3 rounded-xl flex flex-col justify-center items-center gap-2";
    const span = document.createElement("span");
    span.className = "text-lg text-black bg-white rounded-lg px-5 py-2";
    span.innerText = username || "Remote User";
    videoContainer.append(span);
    videoContainer.append(video);
    videoGrid?.append(videoContainer);
    videoElementsRef.current[userId] = videoContainer;
  };

  const toggleMic = () => {
    if (stream) {
      stream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setCameraEnabled(!cameraEnabled);
    }
  };

  const exitCall = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    router.replace("/");
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const startScreenShare = () => {
    navigator.mediaDevices
      .getDisplayMedia({ video: true })
      .then((screenStream) => {
        setIsSharingScreen(true);
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          videoRef.current.play();
        }
        setStream(screenStream);

        const videoTrack = screenStream.getVideoTracks()[0];
        videoTrack.onended = () => {
          stopScreenShare();
        };

        for (let userId in peersRef.current) {
          const call = peersRef.current[userId];
          const sender = call.peerConnection
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
      });
  };

  const stopScreenShare = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((webcamStream) => {
        setIsSharingScreen(false);
        if (videoRef.current) {
          videoRef.current.srcObject = webcamStream;
          videoRef.current.play();
        }
        setStream(webcamStream);

        const videoTrack = webcamStream.getVideoTracks()[0];
        for (let userId in peersRef.current) {
          const call = peersRef.current[userId];
          const sender = call.peerConnection
            .getSenders()
            .find((s) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
      });
  };

  const sendMessage = () => {
    if (inputMessage.trim() !== "" && channel) {
      const newMessage = {
        userId: username,
        text: inputMessage,
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);

      channel.send({
        type: "broadcast",
        event: "message",
        payload: newMessage,
      });

      setInputMessage("");
    }
  };

  return (
    <div className="flex flex-col justify-center items-center p-10 gap-10 w-full">
      <Toaster />
      <h1 className="text-2xl mb-4">Room: {params.roomId}</h1>
      <p className="mb-4">People in room: {userCount}</p>

      <VideoGrid
        isSharingScreen={isSharingScreen}
        videoRef={videoRef}
        user={username}
      />
      <ControlBar
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        isSharingScreen={isSharingScreen}
        toggleMic={toggleMic}
        toggleCamera={toggleCamera}
        startScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
        exitCall={exitCall}
      />
      <button
        onClick={toggleChat}
        className="fixed top-4 right-4 p-2 rounded-full"
      >
        <MdChat size={32} />
      </button>
      {isChatOpen && (
        <ChatWindow
          messages={messages}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          sendMessage={sendMessage}
          currentUser={username}
        />
      )}
    </div>
  );
}

// const startScreenShare = () => {
//   navigator.mediaDevices
//     .getDisplayMedia({ video: true })
//     .then((screenStream) => {
//       setIsSharingScreen(true);
//       if (videoRef.current) {
//         videoRef.current.srcObject = screenStream;
//         videoRef.current.play();
//       }
//       setStream(screenStream);

//       const videoTrack = screenStream.getVideoTracks()[0];
//       videoTrack.onended = () => {
//         stopScreenShare();
//       };

//       for (let userId in peersRef.current) {
//         const call = peersRef.current[userId];
//         const sender = call.peerConnection
//           .getSenders()
//           .find((s) => s.track?.kind === "video");
//         if (sender) {
//           sender.replaceTrack(videoTrack);
//         }
//       }
//     });
// };

// const stopScreenShare = () => {
//   navigator.mediaDevices
//     .getUserMedia({ video: true, audio: true })
//     .then((webcamStream) => {
//       setIsSharingScreen(false);
//       if (videoRef.current) {
//         videoRef.current.srcObject = webcamStream;
//         videoRef.current.play();
//       }
//       setStream(webcamStream);

//       const videoTrack = webcamStream.getVideoTracks()[0];
//       for (let userId in peersRef.current) {
//         const call = peersRef.current[userId];
//         const sender = call.peerConnection
//           .getSenders()
//           .find((s) => s.track?.kind === "video");
//         if (sender) {
//           sender.replaceTrack(videoTrack);
//         }
//       }
//     });
// };
