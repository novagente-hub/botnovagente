import { IconListCheck } from "@tabler/icons-react";
import { BotNeedsYou } from "@/components/approvals/waiting";
import { BotActivitySections } from "@/components/bot-profile/activity";
import { useMuse } from "../context";
import { MuseEmpty, MuseScreen } from "../ui";

/**
 * Activity: what the centre Bot is waiting on you for, then what it is doing, has scheduled and has
 * finished. Both are OpenBot's own sections from the Bot's page, under OpenMuse's title.
 */
export function ActivityScreen() {
  const { bot } = useMuse();
  return (
    <MuseScreen title="Atividade">
      {bot ? (
        <div className="[&>section:first-child]:mt-0">
          <BotNeedsYou agentId={bot.id} />
          <BotActivitySections agentId={bot.id} />
        </div>
      ) : (
        <NoBot />
      )}
    </MuseScreen>
  );
}

export function NoBot() {
  return (
    <MuseEmpty
      detail="Crie um com Novo Bot na página de Bots."
      icon={IconListCheck}
      title="Nenhum Bot ainda"
    />
  );
}
