import { IconBell, IconHandStop } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { WaitingForYou } from "@/components/approvals/waiting";
import { approvalInboxOptions } from "@/lib/approvals";
import { waitingOnYou } from "./model";
import { LinkRow, MuseEmpty, MuseSheet } from "./ui";

/**
 * The bell: what every Bot is waiting on the person for. The list is OpenBot's own `WaitingForYou`,
 * so every question, approval, choice and detail is exactly the one OpenBot's Bot pages show.
 */
export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const inbox = useQuery(approvalInboxOptions());
  const nothing =
    inbox.data !== undefined && waitingOnYou(inbox.data).count === 0;
  return (
    <MuseSheet
      onClose={onClose}
      subtitle="Aprovações e perguntas que seus Bots estão esperando."
      title="Precisa de você"
    >
      <div className="flex flex-col gap-3.5">
        {nothing ? (
          <MuseEmpty
            detail="Quando um Bot precisar do seu OK ou de uma resposta, aparece aqui."
            icon={IconBell}
            title="Tudo em dia"
          />
        ) : (
          <WaitingForYou />
        )}
        <LinkRow
          detail="O que seus Bots podem fazer sem perguntar"
          icon={IconHandStop}
          render={<Link onClick={onClose} to="/settings/approvals" />}
          tint="lavender"
          title="Regras de aprovação"
        />
      </div>
    </MuseSheet>
  );
}
