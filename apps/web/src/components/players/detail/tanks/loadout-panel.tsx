import {
  activeLayout,
  isSkillTree,
  premiumShellShare,
  type AmmoLayout,
  type DevicesLayout,
  type LoadoutCrewMember,
  type LoadoutSetupGroup,
  type StoredPlayerLoadout,
} from "@unicum.gg/shared";
import { getTranslation } from "@/lib/translations.server";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";

/**
 * How this player has set this vehicle up: the panel under their record.
 *
 * A **server** component, like the tank page's specifications tab and for the
 * same reason: every word it draws comes out of `game/equipment` and
 * `game/crew-perks`, the two catalogues that name a loadout in the reader's
 * own language and that together are 21 KB the browser would otherwise carry
 * on every page of the site. They are in `SERVER_ONLY_NAMESPACES`, so a client
 * component asking for them gets its key back.
 *
 * Wargaming publishes none of this about anyone, so the panel is absent rather
 * than empty for the players it knows nothing about, which is most of them:
 * what it draws exists only because that player runs the unicum.gg mod.
 */
export async function PlayerTankLoadoutPanel({
  loadout,
  locale,
}: {
  loadout: StoredPlayerLoadout;
  locale: string;
}) {
  const [{ t: tEquipment }, { t: tPerks }, { t }] = await Promise.all([
    getTranslation("game/equipment", locale),
    getTranslation("game/crew-perks", locale),
    getTranslation("components/players/detail/tanks/loadout-panel", locale),
  ]);

  const ammo = activeLayout(loadout.setups?.ammo);
  const devices = activeLayout(loadout.setups?.devices);
  const gold = premiumShellShare(ammo);

  return (
    <section className="border-t border-fd-border px-4 py-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{t("title")}</h3>
        <span className="text-xs text-fd-muted-foreground">
          <RelativeTime date={loadout.updatedAt} />
        </span>
      </header>

      {devices ? (
        <SlotRow
          label={t("equipment")}
          names={devices.optDevices.map((key) => key && tEquipment(key))}
          empty={t("slot-empty")}
        />
      ) : null}
      {devices && devices.boosters.some(Boolean) ? (
        <SlotRow
          label={t("directives")}
          names={devices.boosters.map((key) => key && tEquipment(key))}
          empty={t("slot-empty")}
        />
      ) : null}
      {ammo ? (
        <SlotRow
          label={t("consumables")}
          names={ammo.consumables.map((key) => key && tEquipment(key))}
          empty={t("slot-empty")}
        />
      ) : null}

      {ammo ? <Ammunition layout={ammo} gold={gold} label={t("ammo")} /> : null}
      {loadout.crew?.length ? (
        <Crew crew={loadout.crew} name={tPerks} label={t("crew")} />
      ) : null}
      <FieldMods loadout={loadout} name={tEquipment} label={t("field-mods")} />

      <Alternates
        ammo={loadout.setups?.ammo}
        devices={loadout.setups?.devices}
        label={t("second-setup")}
      />
    </section>
  );
}

/** One line of the panel: a label, then the slots in the order the game has them. */
function SlotRow({
  label,
  names,
  empty,
}: {
  label: string;
  names: (string | null | false)[];
  empty: string;
}) {
  return (
    <Row label={label}>
      {names.map((name, index) => (
        <Chip key={index} muted={!name}>
          {name || empty}
        </Chip>
      ))}
    </Row>
  );
}

/**
 * The ammunition rack, by kind, with the share that costs gold beside it.
 *
 * Rounds the player does not load are left out: the client lists every kind
 * the gun can fire, and a row reading zero says nothing a missing row does not
 * say more briefly.
 */
function Ammunition({
  layout,
  gold,
  label,
}: {
  layout: AmmoLayout;
  gold: number | null;
  label: string;
}) {
  const loaded = layout.shells.filter((shell) => shell.count > 0);
  if (loaded.length === 0) return null;
  return (
    <Row label={label}>
      {loaded.map((shell) => (
        <Chip key={shell.id} accent={shell.premium}>
          {shell.count} {shell.name}
        </Chip>
      ))}
      {gold !== null && gold > 0 ? (
        <Chip accent>{`${Math.round(gold * 100)}%`}</Chip>
      ) : null}
    </Row>
  );
}

/**
 * The crew's skills, one line per member, in the order they were learned.
 *
 * By member rather than as one deduplicated list, because the order is the
 * information: what a player trained first on a vehicle is the part somebody
 * reading this wants to copy.
 */
function Crew({
  crew,
  name,
  label,
}: {
  crew: LoadoutCrewMember[];
  name: (key: string) => string;
  label: string;
}) {
  return (
    <Row label={label}>
      <div className="flex flex-col gap-1">
        {crew.map((member, index) => (
          <div key={index} className="flex flex-wrap gap-1">
            {member.skills.map((skill) => (
              <Chip key={skill}>{name(skill)}</Chip>
            ))}
          </div>
        ))}
      </div>
    </Row>
  );
}

/**
 * Field modifications, or the skill tree a tier XI vehicle has instead.
 *
 * A pair's two sides are separate entries in the game's own catalogue, keyed
 * by the pair's name and a suffix, so the side chosen is what names the entry.
 */
function FieldMods({
  loadout,
  name,
  label,
}: {
  loadout: StoredPlayerLoadout;
  name: (key: string) => string;
  label: string;
}) {
  const progression = loadout.progression;
  if (!progression || isSkillTree(progression) || !progression.pairs.length) {
    return null;
  }
  return (
    <Row label={`${label} ${progression.level}`}>
      {progression.pairs.map((pair) => (
        <Chip key={pair.name}>
          {name(`${pair.name}_${pair.side === "first" ? 1 : 2}`)}
        </Chip>
      ))}
    </Row>
  );
}

/**
 * Whether a second setup exists, and on which of the two groups.
 *
 * Named rather than drawn: the groups move independently, so saying which one
 * the player switches is the useful half, and drawing a second full loadout
 * under the first doubles the panel to show what is mostly the same tank.
 */
function Alternates({
  ammo,
  devices,
  label,
}: {
  ammo?: LoadoutSetupGroup<AmmoLayout>;
  devices?: LoadoutSetupGroup<DevicesLayout>;
  label: string;
}) {
  const groups = [ammo, devices].filter(
    (group) => group && group.layouts.length > 1,
  );
  if (groups.length === 0) return null;
  return (
    <p className="mt-3 text-xs text-fd-muted-foreground">{label}</p>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="shrink-0 text-xs text-fd-muted-foreground sm:w-28">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Chip({
  children,
  muted,
  accent,
}: {
  children: React.ReactNode;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded border border-fd-border px-1.5 py-0.5 text-xs",
        muted && "text-fd-muted-foreground opacity-60",
        accent && "border-amber-500/40 text-amber-600 dark:text-amber-400",
      )}
    >
      {children}
    </span>
  );
}
