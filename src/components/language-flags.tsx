import { languageToCountryCode } from "@/lib/language-flags";
import { cn } from "@/lib/utils";

export function LanguageFlags({
  languages,
  className,
  size = "s",
}: {
  languages: string[];
  className?: string;
  size?: "s" | "m" | "l";
}) {
  if (languages.length === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-full items-stretch divide-x divide-fd-border border-l border-fd-border",
        className,
      )}
    >
      {languages.map((lang) => {
        const code = languageToCountryCode(lang);
        if (!code) {
          return (
            <span key={lang} className="text-xs font-medium uppercase">
              {lang}
            </span>
          );
        }
        return (
          <img
            key={lang}
            src={`/flags/${size}/${code}.svg`}
            alt={lang}
            className="h-full w-auto"
          />
        );
      })}
    </span>
  );
}
