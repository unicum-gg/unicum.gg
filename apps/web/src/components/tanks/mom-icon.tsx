import { cn } from "@/lib/utils";

// The laurel wreath from RankMedal with its roman numeral stripped out (the
// numeral lived fused inside the same path; the relative moveto after it was
// re-absolutised to M14.715 21.594 so the lower branches stay put). The mastery
// symbol is drawn on top as text, since Ace uses "M" which RankMedal lacks.
const WREATH =
  "M24.152 16.243s.391-2.858 1.765-4.686c1.374-1.828 4.034-2.965 4.034-2.965s-.276 2.946-1.65 4.775c-1.374 1.828-4.149 2.876-4.149 2.876zm.575-6.154s-1.127-2.103-.706-4.355c.421-2.252 2.231-3.8 2.231-3.8s1.126 2.103.706 4.355c-.421 2.251-2.231 3.8-2.231 3.8zm-4.524-6.501c-.4-1.835.473-3.586.473-3.586s1.52 1.224 1.92 3.059c.399 1.835-.474 3.585-.474 3.585s-1.52-1.224-1.919-3.058zm9.805 13.718s-2.263 2.439-4.762 3.141c-2.5.702-5.743-.236-5.743-.236s2.308-2.284 4.807-2.986c2.5-.702 5.698.081 5.698.081zm-5.894 5.937s-1.885.796-4.281.466c-.963-.133-1.854-.428-2.585-.733l1.391 1.709c.2.286.121.674-.177.866l-.537.347a.665.665 0 01-.9-.169l-1.916-3.27a.608.608 0 01.176-.865l.051-.033a.663.663 0 01.899.171l.043.051c.774-.196 2.01-.4 3.439-.203 2.397.331 4.397 1.663 4.397 1.663zM14.715 21.594a.608.608 0 01.176.865l-1.916 3.27a.665.665 0 01-.9.169l-.538-.347a.61.61 0 01-.176-.866l1.39-1.709c-.731.305-1.621.6-2.584.733-2.396.33-4.281-.466-4.281-.466s2-1.332 4.397-1.663a9.091 9.091 0 013.439.203l.043-.051a.663.663 0 01.899-.171l.051.033zm-9.961-1.147c-2.499-.702-4.762-3.141-4.762-3.141s3.198-.783 5.698-.081c2.499.702 4.807 2.986 4.807 2.986s-3.243.938-5.743.236zM7.878 6.646s-.873-1.75-.474-3.585c.4-1.835 1.92-3.059 1.92-3.059s.873 1.751.473 3.586c-.399 1.834-1.919 3.058-1.919 3.058zm-4.836-.357c-.421-2.252.706-4.355.706-4.355s1.81 1.548 2.231 3.8c.421 2.252-.706 4.355-.706 4.355s-1.81-1.549-2.231-3.8zm2.806 9.954s-2.775-1.048-4.149-2.876C.325 11.538.049 8.592.049 8.592s2.66 1.137 4.034 2.965c1.374 1.828 1.765 4.686 1.765 4.686z";

// mark_of_mastery value -> symbol shown inside the wreath (Ace is "M"; the
// classes use plain arabic numerals, not roman).
const MOM_SYMBOL: Record<1 | 2 | 3 | 4, string> = {
  4: "M", // Ace Tanker
  3: "1", // 1st Class
  2: "2", // 2nd Class
  1: "3", // 3rd Class
};

// Prestige ramp: Ace gold, 1st silver, 2nd light bronze, 3rd dark bronze.
export const MOM_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: "#FFBA00",
  3: "#C4C9D1",
  2: "#D68C4E",
  1: "#9E5A24",
};

const MOM_LABEL: Record<1 | 2 | 3 | 4, string> = {
  4: "Ace Tanker",
  3: "1st Class",
  2: "2nd Class",
  1: "3rd Class",
};

export function MoMIcon({
  mastery,
  className,
}: {
  mastery: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 30 26"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid"
      role="img"
      aria-label={MOM_LABEL[mastery]}
      className={cn("mx-auto block h-5 w-auto", className)}
      style={{ color: MOM_COLORS[mastery] }}
    >
      <title>{MOM_LABEL[mastery]}</title>
      <path d={WREATH} fill="currentColor" fillRule="evenodd" />
      <text
        x="15"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={mastery === 4 ? 11 : 13}
        fontWeight={700}
        fill="currentColor"
      >
        {MOM_SYMBOL[mastery]}
      </text>
    </svg>
  );
}
