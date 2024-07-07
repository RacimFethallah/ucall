import React from "react";
import { BsCameraVideoFill, BsCameraVideoOffFill } from "react-icons/bs";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import { ImPhoneHangUp } from "react-icons/im";
import { LuScreenShareOff, LuScreenShare } from "react-icons/lu";

export default function ControlBar({
  micEnabled,
  cameraEnabled,
  isSharingScreen,
  toggleMic,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  exitCall,
}: any) {
  return (
    <div className="floating-bottom-bar">
      <button onClick={toggleMic} className={micEnabled ? "" : "!bg-red-500"}>
        {micEnabled ? (
          <FaMicrophone />
        ) : (
          <FaMicrophoneSlash className="text-white" />
        )}
      </button>
      <button
        onClick={toggleCamera}
        className={cameraEnabled ? "" : "!bg-red-500"}
      >
        {cameraEnabled ? (
          <BsCameraVideoFill />
        ) : (
          <BsCameraVideoOffFill className="text-white" />
        )}
      </button>
      {isSharingScreen ? (
        <button
          onClick={stopScreenShare}
          className={isSharingScreen ? "" : "!bg-red-500"}
        >
          <LuScreenShareOff className="text-white" />
        </button>
      ) : (
        <button onClick={startScreenShare}>
          <LuScreenShare />
        </button>
      )}
      <button onClick={exitCall} className="!bg-red-500">
        <ImPhoneHangUp className="text-white" />
      </button>
    </div>
  );
}
