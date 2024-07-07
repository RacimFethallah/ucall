"use client";

import { createClient } from "@/utils/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { MdChat } from "react-icons/md";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { IoExitOutline } from "react-icons/io5";
import ChatWindow from "@/components/room/chatWindow";
import VideoGrid from "@/components/room/videoGrid";
import ControlBar from "@/components/room/ControlBar";
import Peer, { MediaConnection } from "peerjs";

export default function Room({ params }: { params: { roomId: string } }) {
  const [userCount, setUserCount] = useState(1);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{
    [key: string]: MediaStream;
  }>({});

  const router = useRouter();
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ userId: string; text: string }[]>(
    []
  );
  const [inputMessage, setInputMessage] = useState("");

  const [users, setUsers] = useState<{
    [key: string]: { name: string; peerId: string };
  }>({});

  const supabase = createClient();

  useEffect(() => {
    const setupPeerAndMedia = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      const newPeer = new Peer();
      setPeer(newPeer);

      newPeer.on("open", (id) => {
        console.log("My peer ID is: " + id);
        setupChannel(id);
      });

      newPeer.on("call", (call) => {
        call.answer(stream);
        call.on("stream", (remoteStream) => {
          setRemoteStreams((prev) => ({ ...prev, [call.peer]: remoteStream }));
        });
      });
    };

    setupPeerAndMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peer) {
        peer.destroy();
      }
    };
  }, []);

  const setupChannel = async (peerId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setCurrentUserId(user.id);

    const userKey = user.id;
    const username = user.user_metadata.username || user.email || "Anonymous";

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
        const usersInRoom = Object.entries(newState).reduce(
          (acc, [key, value]) => {
            acc[key] = {
              name: (value as any)[0]?.name || "Anonymous",
              peerId: (value as any)[0]?.peerId,
            };
            return acc;
          },
          {} as { [key: string]: { name: string; peerId: string } }
        );
        setUsers(usersInRoom);
        setUserCount(Object.keys(usersInRoom).length);
        Object.entries(usersInRoom).forEach(([userId, user]) => {
          if (user.peerId && user.peerId !== peerId && userId !== userKey) {
            connectToPeer(user.peerId);
          }
        });
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        const newUser = {
          name: (newPresences as any)[0]?.name || "Anonymous",
          peerId: (newPresences as any)[0]?.peerId,
        };
        setUsers((prev) => ({ ...prev, [key]: newUser }));
        toast.success(`${newUser.name} joined the room`);
        setUserCount((prev) => prev + 1);
        if (newUser.peerId && peer && key !== userKey) {
          connectToPeer(newUser.peerId);
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setUsers((prev) => {
          const newUsers = { ...prev };
          const leavingUser = newUsers[key];
          delete newUsers[key];
          toast.error(`${leavingUser?.name || "A user"} left the room`);
          return newUsers;
        });
        setUserCount((prev) => prev - 1);
        setRemoteStreams((prev) => {
          const newStreams = { ...prev };
          delete newStreams[key];
          return newStreams;
        });
      })
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((prevMessages) => [...prevMessages, payload]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await roomChannel.track({
            online_at: new Date().toISOString(),
            name: username,
            peerId,
          });
        }
      });

    setChannel(roomChannel);
  };

  const connectToPeer = (remotePeerId: string) => {
    if (peer && localStream) {
      const call = peer.call(remotePeerId, localStream);
      call.on("stream", (remoteStream) => {
        setRemoteStreams((prev) => ({ ...prev, [remotePeerId]: remoteStream }));
      });
    }
  };

  const toggleMic = () => {
    if (localStream) {
      localStream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setMicEnabled(!micEnabled);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream
        .getVideoTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setCameraEnabled(!cameraEnabled);
    }
  };

  const exitCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      peer.destroy();
    }
    if (channel) {
      channel.unsubscribe();
    }
    router.push("/");
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const sendMessage = () => {
    if (inputMessage.trim() !== "" && channel) {
      const newMessage = {
        userId: "You",
        text: inputMessage,
      };
      channel.send({
        type: "broadcast",
        event: "message",
        payload: newMessage,
      });
      setMessages((prev) => [...prev, newMessage]);
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
        localStream={localStream}
        remoteStreams={remoteStreams}
        users={users}
        currentUserId={currentUserId || ""}
      />
      <ControlBar
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        isSharingScreen={isSharingScreen}
        toggleMic={toggleMic}
        toggleCamera={toggleCamera}
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
        />
      )}
    </div>
  );
}

// startScreenShare = { startScreenShare };
// stopScreenShare = { stopScreenShare };

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

// useEffect(() => {
//   const setupChannel = async () => {
//     const {
//       data: { user },
//     } = await supabase.auth.getUser();

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const userKey = user.id;
//     const username = user.user_metadata.username || user.email || "Anonymous";

//     const roomChannel = supabase.channel(`room_${params.roomId}`, {
//       config: {
//         presence: {
//           key: userKey,
//         },
//       },
//     });

//     roomChannel
//       .on("presence", { event: "sync" }, () => {
//         const newState = roomChannel.presenceState();
//         const usersInRoom = Object.entries(newState).map(([key, value]) => ({
//           key,
//           name: (value as any)[0]?.name || "Anonymous",
//         }));
//         setUserCount(usersInRoom.length);
//       })
//       .on("presence", { event: "join" }, ({ key, newPresences }) => {
//         const newUser = {
//           key,
//           name: (newPresences as any)[0]?.name || "Anonymous",
//         };
//         toast.success(`${newUser.name} joined the room`);
//         setUserCount((prev) => prev + 1);
//       })
//       .on("presence", { event: "leave" }, ({ key }) => {
//         setUserCount((prev) => prev - 1);
//       })
//       .on("broadcast", { event: "message" }, ({ payload }) => {
//         setMessages((prevMessages) => [...prevMessages, payload]);
//       })
//       .subscribe(async (status) => {
//         if (status === "SUBSCRIBED") {
//           await roomChannel.track({
//             online_at: new Date().toISOString(),
//             name: username,
//           });
//         }
//       });

//     setChannel(roomChannel);

//     return () => {
//       roomChannel.unsubscribe();
//     };
//   };

//   setupChannel();
// }, [params.roomId]);
