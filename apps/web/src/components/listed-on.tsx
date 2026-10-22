import { Panel, PanelContent } from "@/components/panel";

export type Directory = { name: string; href: string };

/**
 * The directories that list one of our integrations, each linking to our entry
 * there.
 *
 * Some directories list a project for free only if it links back, and a
 * reviewer checks for that link on the page, so these stay plain followed
 * links: no `nofollow`, rendered on the server. A directory whose own link to
 * us is `nofollow` does not belong here: the line exists to trade links, and
 * that one gives nothing back.
 */
export function ListedOn({
  label,
  directories,
}: {
  label: string;
  directories: Directory[];
}) {
  return (
    <Panel>
      <PanelContent className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-4 text-sm">
        <span className="text-fd-muted-foreground">{label}</span>
        {directories.map((directory, index) => (
          <span key={directory.href} className="flex items-center gap-x-2">
            {index > 0 ? (
              <span className="text-fd-muted-foreground" aria-hidden>
                ·
              </span>
            ) : null}
            <a
              href={directory.href}
              target="_blank"
              rel="noopener"
              className="text-fd-foreground underline-offset-2 hover:underline"
            >
              {directory.name}
            </a>
          </span>
        ))}
      </PanelContent>
    </Panel>
  );
}
