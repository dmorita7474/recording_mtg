import ReactMarkdown from "react-markdown";

interface SummaryProps {
  summary: string;
  suggestions: string[];
}

export default function Summary({ summary, suggestions }: SummaryProps) {
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
      <h2 style={{ margin: "0 0 0.75rem", color: "#333" }}>サマリ</h2>
      {summary ? (
        <div style={{ lineHeight: 1.6, color: "#333" }}>
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      ) : (
        <p style={{ color: "#999" }}>録音を開始するとサマリが表示されます</p>
      )}

      <h2 style={{ margin: "1rem 0 0.75rem", color: "#333" }}>次の議論の提案</h2>
      {suggestions.length === 0 ? (
        <p style={{ color: "#999" }}>提案はまだありません</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem" }}>
          {suggestions.map((s, i) => (
            <li key={i} style={{ marginBottom: "0.5rem", lineHeight: 1.6 }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
