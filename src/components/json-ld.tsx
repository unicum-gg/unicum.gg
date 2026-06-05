import type { Thing, WithContext } from "schema-dts";

export function JsonLd({ data }: { data: Thing | WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
