import React from "react";

interface ChatWindowProps {
  messages: Array<{ userId: string; text: string }>;
  inputMessage: string;
  setInputMessage: (message: string) => void;
  sendMessage: () => void;
  currentUser: string;
}

export default function ChatWindow({
  messages,
  inputMessage,
  setInputMessage,
  sendMessage,
  currentUser,
}: ChatWindowProps) {
  return (
    <div className="fixed top-16 right-4 w-80 h-3/4 bg-white shadow-lg rounded-lg flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 ${
              msg.userId === currentUser ? "text-right" : "text-left"
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                msg.userId === currentUser
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              <span className="font-bold">{msg.userId}: </span>
              <span>{msg.text}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          className="w-full px-2 py-1 border rounded"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="mt-2 w-full bg-blue-500 text-white py-1 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
