// app/admin/console/components/SectionTitle.tsx
interface SectionTitleProps {
  title: string;
  sub?: string;
}

export function SectionTitle({ title, sub }: SectionTitleProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2
        style={{
          fontSize: 22,
          fontFamily: "Manrope, sans-serif",
          fontWeight: 700,
          margin: 0,
          color: "#fff",
        }}
      >
        {title}
      </h2>
      {sub && (
        <p
          style={{
            color: "rgba(255,255,255,0.5)",
            margin: "6px 0 0",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
