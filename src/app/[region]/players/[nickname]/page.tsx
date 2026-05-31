import { notFound } from "next/navigation";
import {
  Panel,
  PanelContent,
  PanelHeader,
  PanelSeparator,
  PanelTitle,
} from "@/components/panel";
import { PlayerClansHistory } from "@/components/players/clans-history";
import { PlayerHeader } from "@/components/players/header";
import { PlayerStatsTable } from "@/components/players/stats-table";
import {
  diffStats,
  findPlayerByNicknameInDB,
  getPeriodComparators,
  recordCurrentSnapshot,
  statsFromSnapshot,
} from "@/services/snapshots/player";
import {
  diffTanks,
  getPeriodTankComparators,
} from "@/services/snapshots/tank";
import {
  findPlayerByNickname,
  getAccountWTR,
  getPlayerInfo,
} from "@/services/wargaming/wot/accounts";
import { isRegion } from "@/services/wargaming/wot";
import { getFullPlayerClanHistory } from "@/services/wargaming/wot/clans/player";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import { getTanksStats } from "@/services/wargaming/wot/tanks";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ region: string; nickname: string }>;
}) {
  const { region, nickname } = await params;
  if (!isRegion(region)) notFound();

  const decoded = decodeURIComponent(nickname);
  const found =
    (await findPlayerByNicknameInDB(region, decoded)) ??
    (await findPlayerByNickname(region, decoded));
  if (!found) notFound();

  const info = await getPlayerInfo(region, found.account_id);
  if (!info) notFound();

  const [
    tanks,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    wtr,
    clanHistory,
  ] = await Promise.all([
    getTanksStats(region, found.account_id),
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getAccountWTR(region, found.account_id),
    getFullPlayerClanHistory(region, found.account_id),
  ]);

  const { player, latest } = await recordCurrentSnapshot(
    region,
    info,
    wtr,
    tanks,
  );
  const [comparators, tankComparators] = await Promise.all([
    getPeriodComparators(player.id),
    getPeriodTankComparators(player.id),
  ]);

  const current = statsFromSnapshot(latest);
  const periods = {
    h24: comparators.h24 ? diffStats(current, statsFromSnapshot(comparators.h24)) : null,
    d7: comparators.d7 ? diffStats(current, statsFromSnapshot(comparators.d7)) : null,
    d30: comparators.d30 ? diffStats(current, statsFromSnapshot(comparators.d30)) : null,
  };
  const periodTanks = {
    h24: tankComparators.h24.size > 0 ? diffTanks(tanks, tankComparators.h24) : null,
    d7: tankComparators.d7.size > 0 ? diffTanks(tanks, tankComparators.d7) : null,
    d30: tankComparators.d30.size > 0 ? diffTanks(tanks, tankComparators.d30) : null,
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Panel>
        <PanelContent className="p-0">
          <PlayerHeader
            region={region}
            nickname={info.nickname}
            createdAt={new Date(info.created_at * 1000)}
            lastBattleAt={new Date(info.last_battle_time * 1000)}
            updatedAt={player.lastSeenAt}
            currentStint={clanHistory.currentStint}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <Panel>
        <PanelHeader>
          <PanelTitle>Overall stats</PanelTitle>
        </PanelHeader>
        <PanelContent className="p-0">
          <PlayerStatsTable
            current={current}
            periods={periods}
            tanks={tanks}
            periodTanks={periodTanks}
            encyclopedia={encyclopedia}
            wn8Expected={wn8Expected}
            wnxExpected={wnxExpected}
          />
        </PanelContent>
      </Panel>

      <PanelSeparator />

      <PlayerClansHistory
        region={region}
        accountCreatedAt={new Date(info.created_at * 1000)}
        clanHistory={clanHistory}
        // eslint-disable-next-line react-hooks/purity -- server component, evaluated once at request time, value is then serialized for hydration
        nowMs={Date.now()}
      />
    </div>
  );
}
