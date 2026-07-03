import APP from "@/constants/app";

export function RegionHeaderCell({ region }: { region: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "20px 40px",
        background: "#27272A",
      }}
    >
      <span
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: "#F5F5F5",
        }}
      >
        {region.toUpperCase()}
      </span>
    </div>
  );
}

export function BrandHeaderCell({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "20px 32px",
        borderLeft: "1px solid #3F3F46",
      }}
    >
      <img src={logoSrc} width={35} height={48} alt="" />
      <span style={{ fontSize: 36, fontWeight: 700, color: "#F5F5F5" }}>
        {APP.NAME}
      </span>
    </div>
  );
}

// Footer cells share the outer container's border; only the dividers between
// cells are drawn here (borderLeft on every cell except the first). Colored
// ratings keep their bucket bg; unrated cells stay transparent.
export function StatCard({
  label,
  value,
  bg,
  first,
}: {
  label: string;
  value: string;
  bg: string | null;
  first?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        padding: "20px 24px",
        borderLeft: first ? "none" : "1px solid #3F3F46",
        background: bg ?? "transparent",
        color: "#F5F5F5",
      }}
    >
      <span style={{ fontSize: 22, opacity: 0.8 }}>{label}</span>
      <span style={{ fontSize: 56, fontWeight: 700, marginTop: 4 }}>
        {value}
      </span>
    </div>
  );
}
