import type {
  LearningSharingMode,
  PersonalLearningSharing,
} from "@openbot/shared/learning";
import {
  IconCheck,
  IconListCheck,
  IconLock,
  IconSparkles,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
} from "@/components/layout/page-shell";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  setLearnedSkillOpenMutationOptions,
  setLearningSharingModeMutationOptions,
} from "@/lib/learning/mutations";
import { personalLearningQueryOptions } from "@/lib/learning/queries";
import { queryClient } from "@/query-client";

/** The three choices, each with the one plain line that says who sees what. */
export const SHARING_CHOICES: {
  mode: LearningSharingMode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}[] = [
  {
    mode: "closed",
    icon: IconLock,
    title: "Só os meus Bots",
    description: "Só os Bots que você usa aproveitam suas Habilidades.",
  },
  {
    mode: "open",
    icon: IconUsersGroup,
    title: "Bots de todos",
    description: "Todos os Bots do OpenBot aproveitam todas as suas Habilidades.",
  },
  {
    mode: "choose",
    icon: IconListCheck,
    title: "As Habilidades que eu escolher",
    description:
      "Todos os Bots aproveitam as Habilidades que você abrir abaixo; seus próprios Bots usam todas.",
  },
];

/**
 * What the choice says above its rows. While an administrator has not turned on Skill sharing, plainly that, and, when
 * the person chose to share before it was turned off, that their choice is kept for when it is on again.
 */
function choiceSentence(data: PersonalLearningSharing): string {
  if (data.sharingAllowed)
    return "Seus próprios Bots sempre usam todas as Habilidades aprendidas com suas gravações.";
  const off =
    "Um administrador não ativou o compartilhamento de Habilidades com todos os Bots, então só os Bots que você usa aproveitam as suas.";
  return data.mode === "closed"
    ? off
    : `${off} Sua escolha abaixo volta a valer se um administrador ativar.`;
}

/** What the Skills list says when it has none to show. */
function emptySentence(data: PersonalLearningSharing): string {
  if (data.unavailable === "off")
    return "Um administrador desativou o Aprendizado automático, então nenhuma Habilidade é aprendida com suas gravações.";
  if (data.skills === null)
    return "Não foi possível ler suas Habilidades do Intelligence agora. Sua escolha acima continua valendo para elas.";
  return "Nenhuma Habilidade aprendida com suas gravações ainda. Quando houver, cada uma que você abrir aqui chega a todos os Bots.";
}

/**
 * Settings, Learning: every recording a person makes goes into their own Learning space, and the Skills learned there
 * reach every Bot they use. Here they choose who else's Bots may draw on them: none (the default), all, or the Skills
 * they open one by one. Each change takes effect when it is made; there is no save. Sharing waits for an administrator
 * (Admin, Enterprise controls, Skill sharing): until then nothing can be opened, and what was opened can still be closed.
 */
export function LearningSharing() {
  const sharing = useQuery(personalLearningQueryOptions());
  const setMode = useMutation(
    setLearningSharingModeMutationOptions(queryClient),
  );
  const setOpen = useMutation(setLearnedSkillOpenMutationOptions(queryClient));
  if (sharing.isPending) return null;
  if (sharing.error) {
    return (
      <p className="mt-6 text-destructive text-sm" role="alert">
        {sharing.error.message}
      </p>
    );
  }
  const data = sharing.data;
  // Shown at once while the save is on its way, as a switch is.
  const mode = (setMode.isPending ? setMode.variables : undefined) ?? data.mode;
  const failure = setMode.error ?? setOpen.error;

  return (
    <>
      <PageSection
        title="Bots de quem mais usam suas Habilidades"
        description={choiceSentence(data)}
      >
        <PageRows>
          {/* One pressed button of three, as Admin, Boundaries draws its enforcement choice. */}
          {SHARING_CHOICES.map((choice, index) => (
            <React.Fragment key={choice.mode}>
              {index > 0 ? <Separator /> : null}
              <Item
                size="sm"
                render={
                  <button
                    aria-pressed={mode === choice.mode}
                    disabled={
                      setMode.isPending ||
                      (!data.sharingAllowed && choice.mode !== "closed")
                    }
                    onClick={() => {
                      if (mode !== choice.mode) setMode.mutate(choice.mode);
                    }}
                    type="button"
                  />
                }
              >
                <ItemMedia variant="icon">
                  <choice.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{choice.title}</ItemTitle>
                  <ItemDescription className="line-clamp-none">
                    {choice.description}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {mode === choice.mode ? (
                    <IconCheck
                      aria-hidden="true"
                      className="size-4 text-foreground"
                    />
                  ) : null}
                </ItemActions>
              </Item>
            </React.Fragment>
          ))}
        </PageRows>
      </PageSection>
      {mode === "choose" ? (
        <PageSection
          title="Suas Habilidades"
          description="Abra uma Habilidade para que todos os Bots do OpenBot possam usá-la."
        >
          {data.skills === null || data.skills.length === 0 ? (
            <PageEmpty>{emptySentence(data)}</PageEmpty>
          ) : (
            <PageRows>
              {data.skills.map((skill, index) => {
                const open =
                  (setOpen.isPending && setOpen.variables?.name === skill.name
                    ? setOpen.variables.open
                    : undefined) ?? skill.open;
                return (
                  <React.Fragment key={skill.name}>
                    {index > 0 ? <Separator /> : null}
                    <Item size="sm">
                      <ItemMedia variant="icon">
                        <IconSparkles />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{skill.name}</ItemTitle>
                        <ItemDescription>
                          {open
                            ? "Todos os Bots podem usá-la."
                            : "Só os seus Bots a usam."}
                          {skill.description ? ` ${skill.description}` : ""}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Switch
                          aria-label={`Abrir ${skill.name} para todos`}
                          checked={open}
                          // An open Skill can always be closed; opening one waits for an admin.
                          disabled={
                            setOpen.isPending || (!data.sharingAllowed && !open)
                          }
                          onCheckedChange={(checked) =>
                            setOpen.mutate({ name: skill.name, open: checked })
                          }
                        />
                      </ItemActions>
                    </Item>
                  </React.Fragment>
                );
              })}
            </PageRows>
          )}
        </PageSection>
      ) : null}
      {failure ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {failure.message}
        </p>
      ) : null}
    </>
  );
}
