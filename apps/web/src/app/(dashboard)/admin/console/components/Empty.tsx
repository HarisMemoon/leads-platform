// app/admin/console/components/Empty.tsx
interface EmptyProps {
  title: string;
  body?: string;
}

export function Empty({ title, body }: EmptyProps) {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16,
        textAlign: "center",
        padding: "48px 24px",
        color: "rgba(255,255,255,0.55)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 16,
          fontWeight: 600,
          color: "rgba(255,255,255,0.75)",
          marginBottom: body ? 8 : 0,
        }}
      >
        {title}
      </div>
      {body && (
        <div style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.5 }}>
          {body}
        </div>
      )}
    </div>
  );
}
