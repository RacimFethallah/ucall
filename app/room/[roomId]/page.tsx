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
          console.log("Presence sync:", usersInRoom);
          setUserCount(usersInRoom.length);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          const newUser = {
            key,
            name: (newPresences as any)[0]?.name || "Anonymous",
            peerId: (newPresences as any)[0]?.peerId,
          };
          console.log("User joined:", newUser);
          toast.success(`${newUser.name} joined the room`);
          if (localStream && newUser.peerId !== peer.id) {
            connectToNewUser(newUser.peerId, newUser.name, peer, localStream);
          }
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          console.log("User left:", key);
          if (peersRef.current[key]) {
            peersRef.current[key].close();
            delete peersRef.current[key];
          }
          removeVideoElement(key);

          toast.info(`A user left the room`);
        })
        .on("broadcast", { event: "message" }, ({ payload }) => {
          console.log("New message:", payload);
          toast.info(`New message from ${payload.userId}`);
          setMessages((prevMessages) => [...prevMessages, payload]);
        })
        .on("broadcast", { event: "user_ready" }, ({ payload }) => {
          if (localStream && payload.peerId !== peer.id) {
            connectToNewUser(
              payload.peerId,
              payload.username,
              peer,
              localStream
            );
          }
        });

      setChannel(roomChannel);

      await roomChannel.subscribe();

      peer.on("open", async (peerId) => {
        console.log("Peer connection open with ID:", peerId);
        await roomChannel.track({
          online_at: new Date().toISOString(),
          name: username,
          peerId: peerId,
        });

        // After joining, set up the local stream
        try {
          console.log("Requesting local stream...");
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          console.log("Local stream obtained:", localStream);
          setStream(localStream);
          addLocalVideoStream(localStream, username);

          localStream
            .getVideoTracks()
            .forEach((track) => (track.enabled = false));

          // Notify other users that you're ready
          roomChannel.send({
            type: "broadcast",
            event: "user_ready",
            payload: { peerId, username },
          });

          peer.on("call", (call) => {
            console.log("Receiving call from", call.peer);
            call.answer(localStream);
            call.on("stream", (userVideoStream) => {
              console.log("Received remote stream from", call.peer);
              const remoteUsername = call.metadata?.username || "Remote User";
              addVideoStream(userVideoStream, call.peer, remoteUsername);
            });
            call.on("error", (err) => {
              console.error("Call error:", err);
            });
          });
        } catch (err) {
          console.error("Failed to get local stream", err);
        }
      });
    };

    setupRoom();

    return () => {
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
      peer.destroy();
      channel?.unsubscribe();
    };
  }, [params.roomId]);

  //to remove a video element
  const removeVideoElement = (userId: string) => {
    if (videoElementsRef.current[userId]) {
      videoElementsRef.current[userId].remove();
      delete videoElementsRef.current[userId];
    }
  };

  const addLocalVideoStream = (stream: MediaStream, username: string) => {
    console.log("Adding local video stream");
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
    addVideoStream(stream, "local", username);
  };

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

    // if(stream.getVideoTracks().length !== 0) {}
    console.log("stream:", stream);
    const video = document.createElement("video");
    video.srcObject = stream;
    console.log(userId);
    video.muted = userId === "local";
    video.addEventListener("loadedmetadata", () => {
      video.play();
    });

    const videoGrid = document.getElementById("video-grid");
    const videoContainer = document.createElement("div");
    videoContainer.id = "video-container";
    videoContainer.className =
      "video-container shadow-2xl bg-gray-700 border border-gray-300 p-3 rounded-xl flex flex-col justify-center items-center gap-2";
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

  const exitCall = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (channel) {
      await channel.untrack();
      channel.unsubscribe();
    }
    router.replace("/");
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setIsSharingScreen(true);

      const videoTrack = screenStream.getVideoTracks()[0];
      videoTrack.onended = stopScreenShare;

      if (stream) {
        const sender = peersRef.current[
          Object.keys(peersRef.current)[0]
        ]?.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        // Replace the video track in the local stream
        const oldVideoTrack = stream.getVideoTracks()[0];
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(videoTrack);
      }

      // Update local video
      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
      }

      setStream(screenStream);
    } catch (error) {
      console.error("Error starting screen share:", error);
    }
  };

  const stopScreenShare = async () => {
    try {
      setIsSharingScreen(false);
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      const videoTrack = webcamStream.getVideoTracks()[0];

      if (stream) {
        const sender = peersRef.current[
          Object.keys(peersRef.current)[0]
        ]?.peerConnection
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(videoTrack);
        }

        // Replace the video track in the local stream
        const oldVideoTrack = stream.getVideoTracks()[0];
        stream.removeTrack(oldVideoTrack);
        stream.addTrack(videoTrack);
      }

      // Update local video
      if (videoRef.current) {
        videoRef.current.srcObject = webcamStream;
      }

      setStream(webcamStream);
    } catch (error) {
      console.error("Error stopping screen share:", error);
    }
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
    <div className="flex flex-col justify-center items-center p-5 gap-10 w-full">
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
