import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatSessionRenderer } from "../modules/chat/components/ChatSessionRenderer";
import { DEFAULT_TENANT_ID } from "../modules/chat/config/chatConfig";

type LocationState = {
  initialText?: string;
  agentId?: string;
  tenantId?: string;
};

export default function Chat(): JSX.Element {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as LocationState | null;

  const [initialMessage] = useState(() => {
    if (locationState?.initialText) {
      return { text: locationState.initialText, agentId: locationState.agentId };
    }
    return undefined;
  });

  const tenantId = locationState?.tenantId ?? DEFAULT_TENANT_ID;

  useEffect(() => {
    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  if (!sessionId) {
    return <p>Session not found.</p>;
  }

  return (
    <div className="chat-page">
      <ChatSessionRenderer tenantId={tenantId} sessionId={sessionId} initialMessage={initialMessage} />
    </div>
  );
}
