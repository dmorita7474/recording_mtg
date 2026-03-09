import { useState, useRef, useCallback, useEffect } from "react";
import { signOut, fetchAuthSession } from "aws-amplify/auth";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import Transcript from "./Transcript";
import Summary from "./Summary";

interface WsMessage {
  type: "transcript" | "summary" | "suggestions";
  content: string;
}

export default function MeetingRoom() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [summary, setSummary] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const isRecordingRef = useRef(false);
  const interimTextRef = useRef("");
  const finalBufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const clearTimers = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (interimFlushTimerRef.current) {
      clearTimeout(interimFlushTimerRef.current);
      interimFlushTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError("");

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() ?? "";

      const credentials = fromCognitoIdentityPool({
        clientConfig: { region: "ap-northeast-1" },
        identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
        logins: {
          [`cognito-idp.ap-northeast-1.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]:
            idToken,
        },
      });

      // WebSocket 接続
      const token = idToken;
      const ws = new WebSocket(
        `${import.meta.env.VITE_WEBSOCKET_ENDPOINT}?token=${token}`
      );
      wsRef.current = ws;

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("WebSocket接続に失敗しました（コンソールで詳細を確認）");
        setIsRecording(false);
        isRecordingRef.current = false;
      };

      ws.onclose = (e) => {
        console.log("WebSocket closed:", e.code, e.reason);
      };

      ws.onmessage = (event) => {
        const msg: WsMessage = JSON.parse(event.data);
        if (msg.type === "transcript") {
          setPendingText("");
          setTranscript((prev) => [...prev, msg.content]);
        } else if (msg.type === "summary") {
          setSummary(msg.content);
        } else if (msg.type === "suggestions") {
          try {
            setSuggestions(JSON.parse(msg.content));
          } catch {
            setSuggestions([msg.content]);
          }
        }
      };

      ws.onopen = async () => {
        // バッファフラッシュ関数
        const flushBuffer = (text?: string) => {
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          if (interimFlushTimerRef.current) {
            clearTimeout(interimFlushTimerRef.current);
            interimFlushTimerRef.current = null;
          }
          const pending = text ?? finalBufferRef.current.join("");
          finalBufferRef.current = [];
          if (pending && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "sendMessage", type: "transcribe", text: pending }));
            ws.send(JSON.stringify({ action: "sendMessage", type: "summarize" }));
          }
        };

        const resetFlushTimer = () => {
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
          flushTimerRef.current = setTimeout(() => flushBuffer(), 500);
        };

        // interimテキストが3秒更新されなければ確定扱い
        const resetInterimFlushTimer = () => {
          if (interimFlushTimerRef.current) clearTimeout(interimFlushTimerRef.current);
          interimFlushTimerRef.current = setTimeout(() => {
            const interim = interimTextRef.current;
            if (interim) {
              interimTextRef.current = "";
              setInterimText("");
              flushBuffer(interim);
            }
          }, 3000);
        };

        try {
          // AudioContext + AudioWorklet セットアップ
          const audioContext = new AudioContext({ sampleRate: 48000 });
          audioContextRef.current = audioContext;
          await audioContext.audioWorklet.addModule("/pcm-processor.js");

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          mediaStreamRef.current = stream;

          const source = audioContext.createMediaStreamSource(stream);
          const workletNode = new AudioWorkletNode(
            audioContext,
            "pcm-processor"
          );
          source.connect(workletNode);

          // AudioWorklet → Transcribe への非同期ストリーム
          const audioChunkQueue: ArrayBuffer[] = [];
          workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            audioChunkQueue.push(e.data);
          };

          isRecordingRef.current = true;
          setIsRecording(true);

          async function* audioStream(): AsyncGenerator<
            { AudioEvent: { AudioChunk: Uint8Array } },
            void,
            unknown
          > {
            while (isRecordingRef.current) {
              if (audioChunkQueue.length > 0) {
                const chunk = audioChunkQueue.shift()!;
                yield { AudioEvent: { AudioChunk: new Uint8Array(chunk) } };
              } else {
                await new Promise((r) => setTimeout(r, 10));
              }
            }
          }

          const client = new TranscribeStreamingClient({
            region: "ap-northeast-1",
            credentials,
          });

          const command = new StartStreamTranscriptionCommand({
            LanguageCode: "ja-JP",
            MediaEncoding: "pcm",
            MediaSampleRateHertz: 16000,
            AudioStream: audioStream(),
          });

          const response = await client.send(command);

          for await (const event of response.TranscriptResultStream!) {
            if (event.TranscriptEvent) {
              for (const result of event.TranscriptEvent.Transcript?.Results ??
                []) {
                const text = result.Alternatives?.[0]?.Transcript ?? "";
                if (!result.IsPartial && text) {
                  interimTextRef.current = "";
                  setInterimText("");
                  setPendingText(text);
                  finalBufferRef.current.push(text);
                  resetFlushTimer();
                } else if (result.IsPartial && text) {
                  interimTextRef.current = text;
                  setInterimText(text);
                  resetInterimFlushTimer();
                }
              }
            }
          }

          // ストリーム終了後、残りのバッファをフラッシュ
          flushBuffer();
        } catch (err) {
          console.error("Transcribe error:", err);
          setError(
            `音声認識エラー: ${err instanceof Error ? err.message : String(err)}`
          );
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };
    } catch {
      setError("接続に失敗しました");
    }
  }, []);

  const requestSummary = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "sendMessage", type: "summarize" }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimers();
    isRecordingRef.current = false;

    // AudioContext クリーンアップ
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // MediaStream クリーンアップ
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    wsRef.current?.close();
    wsRef.current = null;
    setInterimText("");
    setIsRecording(false);
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      clearTimers();
      isRecordingRef.current = false;
      audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      wsRef.current?.close();
    };
  }, [clearTimers]);

  const handleSignOut = async () => {
    stopRecording();
    await signOut();
    window.location.reload();
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: "1rem 2rem",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ margin: 0, color: "#333" }}>会議室</h1>
        <button
          onClick={handleSignOut}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "transparent",
            border: "1px solid #999",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#666",
          }}
        >
          ログアウト
        </button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: "0.75rem 2rem",
            backgroundColor: isRecording ? "#d32f2f" : "#0066cc",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          {isRecording ? "録音停止" : "録音開始"}
        </button>
        {isRecording && (
          <>
            <span
              style={{ marginLeft: "1rem", color: "#d32f2f", fontWeight: "bold" }}
            >
              録音中...
            </span>
            <button
              onClick={requestSummary}
              style={{
                marginLeft: "1rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#388e3c",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              サマリ生成
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "#d32f2f", marginBottom: "1rem" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: "1.5rem" }}>
        <Transcript lines={transcript} interimText={interimText} pendingText={pendingText} />
        <Summary summary={summary} suggestions={suggestions} />
      </div>
    </div>
  );
}
