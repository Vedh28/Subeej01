export interface StoredChatMessage {
  sender: "user" | "ai";
  text: string;
  structured?: {
    title?: string;
    recommendation?: string;
    suitable_conditions?: string[];
    why?: string;
    missing_details_needed?: string[];
    follow_up_question?: string;
    final_answer?: string;
    quick_actions?: string[];
    intent?: string;
    response_mode?: string;
  };
}

export interface ChatSessionState {
  messages: StoredChatMessage[];
  sessionId: string;
}

let inMemoryChatSessionState: ChatSessionState = {
  messages: [],
  sessionId: ""
};

export function readChatSessionState() {
  return inMemoryChatSessionState;
}

export function writeChatSessionState(value: ChatSessionState) {
  inMemoryChatSessionState = value;
}
