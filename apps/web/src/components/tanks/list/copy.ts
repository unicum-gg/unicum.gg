import { TankTab } from "@/components/tanks/list/tabs";

// Per-tab wording for the tank index. Each tab is its own indexable URL, so it
// gets its own heading, on-page intro, title and description rather than five
// copies of the same one.
//
// Pure and framework-free so both sides can use it: the server page (for
// `generateMetadata`) and the client view, which re-renders the heading when the
// user switches tab without a server round-trip. Keeping one source means the
// `<h1>` and the `<title>` can never describe different tabs.

/** `heading` is split so the second half can carry the brand colour, and
 * `intro` takes the formatted vehicle count. */
export type TankTabCopy = {
  heading: { lead: string; accent: string };
  intro: (count: string) => string;
  title: string;
  description: string;
};

export function tankTabCopy(tab: TankTab, regionLabel: string): TankTabCopy {
  switch (tab) {
    case TankTab.Specifications:
      return {
        heading: { lead: "Tank", accent: "specifications" },
        intro: (count) =>
          `DPM, penetration, armour, view range and mobility for all ${count} World of Tanks vehicles on ${regionLabel}. Sort on any column, then filter by tier, nation, class and role.`,
        title: `World of Tanks tank specifications (${regionLabel}), compare every vehicle`,
        description: `Compare the specifications of every World of Tanks tank on ${regionLabel}: DPM, penetration, armour, view range and mobility, sortable and filterable by tier, nation, class and role.`,
      };
    case TankTab.Economics:
      return {
        heading: { lead: "Tank", accent: "economics" },
        intro: (count) =>
          `Purchase and repair costs, shell prices and credit earnings for all ${count} World of Tanks vehicles on ${regionLabel}. Sort on any column, then filter by tier, nation, class and role.`,
        title: `World of Tanks tank economics (${regionLabel}), credits and XP costs`,
        description: `Credit and XP costs, repair and shell prices for every World of Tanks tank on ${regionLabel}, sortable and filterable by tier, nation, class and role.`,
      };
    case TankTab.Videos:
      return {
        heading: { lead: "Gameplay", accent: "videos" },
        // The count is battles, not vehicles, so the wording says so: this is
        // the one tab whose rows are not tanks.
        intro: (count) =>
          `${count} battles the community has linked on ${regionLabel}, each opening at the second it starts. Suggested from the tank pages, and checked before they show up here.`,
        title: `World of Tanks gameplay videos (${regionLabel})`,
        description: `Community-suggested World of Tanks battles on ${regionLabel}, each opening at the second it starts: the tank played, the map, the side of it and how the battle ended.`,
      };
    case TankTab.MarksOfExcellence:
      return {
        heading: { lead: "Marks of", accent: "excellence" },
        intro: (count) =>
          `Moving-average damage needed for one, two and three marks on all ${count} World of Tanks vehicles on ${regionLabel}. Sort on any column, then filter by tier, nation, class and role.`,
        title: `World of Tanks marks of excellence requirements (${regionLabel})`,
        description: `Damage needed for one, two and three marks of excellence on every World of Tanks tank on ${regionLabel}, sortable and filterable by tier, nation, class and role.`,
      };
    case TankTab.MarksOfMastery:
      return {
        heading: { lead: "Marks of", accent: "mastery" },
        intro: (count) =>
          `Ace Tanker and mastery badge XP thresholds for all ${count} World of Tanks vehicles on ${regionLabel}. Sort on any column, then filter by tier, nation, class and role.`,
        title: `World of Tanks marks of mastery requirements (${regionLabel})`,
        description: `Ace Tanker and mastery badge XP thresholds for every World of Tanks tank on ${regionLabel}, sortable and filterable by tier, nation, class and role.`,
      };
    default:
      return {
        heading: { lead: "All", accent: "tanks" },
        intro: (count) =>
          `Every one of the ${count} World of Tanks vehicles on ${regionLabel}. Filter by tier, nation, class and role, then open a tank for its stats, best players and expected values.`,
        title: `All World of Tanks tanks (${regionLabel}), browse every vehicle`,
        description: `Browse every World of Tanks tank on ${regionLabel}: filter by tier, nation, class and role, then dive into per-tank stats, top players and expected values.`,
      };
  }
}
