import { useEffect, useRef } from "react";

interface TranscriptProps {
  lines: string[];
  interimText?: string;
  pendingText?: string;
}

export default function Transcript({ lines, interimText, pendingText }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, interimText, pendingText]);

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        maxHeight: "60vh",
        overflowY: "auto",
      }}
    >
      <h2 style={{ margin: "0 0 0.75rem", color: "#333" }}>文字起こし</h2>
      <div>
        {lines.length === 0 && !interimText && !pendingText && (
          <p style={{ color: "#999" }}>録音を開始すると文字起こしが表示されます</p>
        )}
        {lines.map((line, i) => (
          <p key={i} style={{ margin: "0.25rem 0", lineHeight: 1.6 }}>
            {line}
          </p>
        ))}
        {pendingText && (
          <p style={{ margin: "0.25rem 0", lineHeight: 1.6, color: "#bbb" }}>
            {pendingText}
          </p>
        )}
        {interimText && (
          <p style={{ margin: "0.25rem 0", lineHeight: 1.6, color: "#999", fontStyle: "italic" }}>
            {interimText}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
