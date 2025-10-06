import { ChatTurn, ToolCall } from '../model/types';
import { applyPatch } from 'fast-json-patch'; // or rfc6902

export interface TranscriptState {
  turns: ChatTurn[];
  inFlightId?: string;     // the assistant turn currently streaming
}

export function initState(): TranscriptState { return { turns: [] }; }

export function applyEvent(state: TranscriptState, type: string, data: any, id?: string): TranscriptState {
  const next = { ...state, turns: [...state.turns] };

  switch (type) {
    case 'session.started':
      // prepare a new in-flight assistant turn
      next.inFlightId = `inflight-${data.turnId}`;
      next.turns.push({ id: next.inFlightId, role:'assistant', isStreaming:true, toolCalls: [] });
      return next;

    case 'message.delta': {
      const t = ensureInFlight(next);
      t.text = (t.text ?? '') + (data.text ?? '');
      return next;
    }

    case 'schema': {
      const t = ensureInFlight(next);
      t.structured = { schemaId: data.schemaId, schemaVersion: data.schemaVersion, object: {}, valid:false };
      return next;
    }

    case 'json.patch': {
      const t = ensureInFlight(next);
      if (!t.structured) t.structured = { schemaId:'unknown', schemaVersion:'', object:{}, valid:false };
      t.structured.object = applyPatch(structuredClone(t.structured.object), data.patch).newDocument;
      return next;
    }

    case 'json.done': {
      const t = ensureInFlight(next);
      if (t.structured) t.structured.valid = true;
      return next;
    }

    case 'tool.requested': {
      const t = ensureInFlight(next);
      t.toolCalls?.push({ requestId: data.requestId, name: data.name, argsSummary: data.argsSummary, ok: undefined, blobUri:null, error:null });
      return next;
    }

    case 'tool.result': {
      const t = ensureInFlight(next);
      const call = t.toolCalls?.find(c => c.requestId === data.requestId);
      if (call) {
        call.ok = !!data.ok;
        call.resultSummary = data.resultSummary;
        call.blobUri = data.blobUri ?? null;
        call.error = data.ok ? null : { code:'tool_error', message: data.error ?? 'error' };
      }
      return next;
    }

    case 'completed': {
      const t = ensureInFlight(next);
      t.isStreaming = false;
      next.inFlightId = undefined;
      return next;
    }

    case 'error': {
      const t = ensureInFlight(next);
      t.error = { code: data.code ?? 'error', message: data.message ?? 'Unknown error' };
      t.isStreaming = false;
      next.inFlightId = undefined;
      return next;
    }

    default:
      return next;
  }
}

function ensureInFlight(s: TranscriptState): ChatTurn {
  if (!s.inFlightId) {
    s.inFlightId = `inflight-${crypto.randomUUID()}`;
    s.turns.push({ id: s.inFlightId, role:'assistant', isStreaming:true, toolCalls: [] });
  }
  return s.turns[s.turns.length - 1];
}
