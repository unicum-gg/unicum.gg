"use client";

import {
  NAME_COLOR_HEX,
  NAME_EFFECTS_WITHOUT_COLOR,
  NAME_EFFECTS_WITH_TWO_COLORS,
  NameColor,
  NameEffect,
  NameFont,
  type NameStyle,
} from "@unicum.gg/shared";
import { StyledText } from "@/components/entity/name-style";
import { NAME_FONT_CLASS } from "@/components/entity/name-style/fonts";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const FONTS = Object.values(NameFont);
const EFFECTS = Object.values(NameEffect);
const COLORS = Object.values(NameColor);

/**
 * How each effect tile shows itself: in the site's own font and colours of its
 * own, the way Discord's do, so the tile says what the effect does whatever
 * the reader has picked so far. Solid has none, and is drawn in the text colour.
 */
const EFFECT_DEMO: Record<NameEffect, NameStyle | null> = {
  [NameEffect.Solid]: null,
  [NameEffect.Gradient]: {
    font: NameFont.Default,
    effect: NameEffect.Gradient,
    color: NameColor.Steel,
    color2: NameColor.Gold,
  },
  [NameEffect.Neon]: {
    font: NameFont.Default,
    effect: NameEffect.Neon,
    color: NameColor.Purple,
    color2: NameColor.Purple,
  },
  [NameEffect.Toon]: {
    font: NameFont.Default,
    effect: NameEffect.Toon,
    color: NameColor.Brand,
    color2: NameColor.Brand,
  },
  [NameEffect.Pop]: {
    font: NameFont.Default,
    effect: NameEffect.Pop,
    color: NameColor.Green,
    color2: NameColor.Green,
  },
  [NameEffect.Gummy]: {
    font: NameFont.Default,
    effect: NameEffect.Gummy,
    color: NameColor.Brand,
    color2: NameColor.Brand,
  },
  [NameEffect.Prism]: {
    font: NameFont.Default,
    effect: NameEffect.Prism,
    color: NameColor.Sky,
    color2: NameColor.Sky,
  },
};

/** One choice among several, drawn as a pressed or unpressed tile. */
function Tile({
  selected,
  onClick,
  label,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-lg border bg-fd-secondary/40 transition-colors",
        selected
          ? "border-brand ring-1 ring-brand"
          : "border-fd-border hover:bg-fd-secondary",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-heading text-base font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Swatches({
  value,
  onChange,
}: {
  value: NameColor;
  onChange: (color: NameColor) => void;
}) {
  const { t } = useTranslation("components/account/name-style/choices");
  return (
    <div className="grid grid-cols-6 gap-2">
      {COLORS.map((color) => (
        <Tile
          key={color}
          selected={value === color}
          onClick={() => onChange(color)}
          label={t(`colors.${color}`)}
          className="h-10 p-1"
        >
          <span
            className="block size-full rounded-md"
            style={{ backgroundColor: NAME_COLOR_HEX[color] }}
          />
        </Tile>
      ))}
    </div>
  );
}

/**
 * Everything a nickname style is made of, laid out as Discord lays its own:
 * the fonts as large glyphs, each effect named in itself, then the colours the
 * effect reads (none for Prism, two for the effects that blend a pair).
 */
export function NameStyleChoices({
  style,
  onChange,
}: {
  style: NameStyle;
  onChange: (patch: Partial<NameStyle>) => void;
}) {
  const { t } = useTranslation("components/account/name-style/choices");
  const twoColors = NAME_EFFECTS_WITH_TWO_COLORS.has(style.effect);
  const noColor = NAME_EFFECTS_WITHOUT_COLOR.has(style.effect);
  return (
    <div className="flex flex-col gap-6">
      <Section title={t("font")}>
        <div className="grid grid-cols-4 gap-2">
          {FONTS.map((font) => (
            <Tile
              key={font}
              selected={style.font === font}
              onClick={() => onChange({ font })}
              label={t(`fonts.${font}`)}
              className="h-16"
            >
              <span
                className={cn(
                  "text-2xl leading-none",
                  font === NameFont.Default && "font-bold",
                  NAME_FONT_CLASS[font],
                )}
              >
                Gg
              </span>
            </Tile>
          ))}
        </div>
      </Section>

      <Section title={t("effect")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EFFECTS.map((effect) => (
            <Tile
              key={effect}
              selected={style.effect === effect}
              onClick={() => onChange({ effect })}
              label={t(`effects.${effect}`)}
              className="h-14 px-2"
            >
              <StyledText
                text={t(`effects.${effect}`)}
                style={EFFECT_DEMO[effect]}
                animated
                className="text-lg font-semibold"
              />
            </Tile>
          ))}
        </div>
      </Section>

      {!noColor && (
        <Section title={twoColors ? t("first-color") : t("color")}>
          <Swatches
            value={style.color}
            onChange={(color) => onChange({ color })}
          />
          {twoColors && (
            <>
              <p className="pt-1 text-sm font-medium text-fd-muted-foreground">
                {t("second-color")}
              </p>
              <Swatches
                value={style.color2}
                onChange={(color2) => onChange({ color2 })}
              />
            </>
          )}
        </Section>
      )}
    </div>
  );
}
