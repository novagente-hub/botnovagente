import {
  IconBuildingBank,
  IconChecks,
  IconChevronRight,
  IconCode,
  IconDeviceDesktop,
  IconFileText,
  IconKey,
  IconLayoutGrid,
  IconListDetails,
  IconPuzzle,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  type LinkOptions,
} from "@tanstack/react-router";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authed/admin/")({
  component: RouteComponent,
});

/**
 * Grouped by what the decision is about rather than by how the code is organised.
 *
 * "What Bots can reach" is the group an administrator arrives worrying about, so it goes first.
 * Everything in it either grants a capability or fences one in.
 */
const SECTIONS: {
  title: string;
  description: string;
  items: {
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    linkOptions: LinkOptions;
    title: string;
  }[];
}[] = [
  {
    title: "O que os Bots podem acessar",
    description: "Controle o que os Bots podem acessar fora do OpenBot.",
    items: [
      {
        title: "Credenciais",
        description: "Gerencie as chaves e tokens desta implantação.",
        icon: IconKey,
        linkOptions: { to: "/admin/credentials" },
      },
      {
        title: "Limites",
        description: "Defina ações que nenhum Bot pode fazer.",
        icon: IconShieldCheck,
        linkOptions: { to: "/admin/boundaries" },
      },
      {
        title: "Aprovações",
        description: "Escolha quais ações exigem aprovação para os Bots dos membros.",
        icon: IconChecks,
        linkOptions: { to: "/admin/approvals" },
      },
      {
        title: "Computadores",
        description: "Gerencie os computadores que executam as ferramentas dos Bots.",
        icon: IconDeviceDesktop,
        linkOptions: { to: "/admin/computers" },
      },
    ],
  },
  {
    title: "O que os Bots podem fazer",
    description:
      "Configure os apps, habilidades e componentes de interface disponíveis para os Bots.",
    items: [
      {
        title: "Plugins",
        description: "Conecte serviços e escolha quais Bots podem usá-los.",
        icon: IconPuzzle,
        linkOptions: { to: "/admin/plugins" },
      },
      {
        title: "Habilidades",
        description: "Crie instruções reutilizáveis que as pessoas podem executar com /.",
        icon: IconFileText,
        linkOptions: { to: "/admin/skills" },
      },
      {
        title: "Aprendizado automático",
        description:
          "Aprenda com conversas finalizadas e revise as habilidades propostas.",
        icon: IconFileText,
        linkOptions: { to: "/admin/learning" },
      },
      {
        title: "Componentes de interface",
        description:
          "Gerencie componentes personalizados que os Bots podem exibir nas conversas.",
        icon: IconLayoutGrid,
        linkOptions: { to: "/admin/components" },
      },
      {
        title: "Playground",
        description: "Escreva um componente e veja-o renderizar enquanto digita.",
        icon: IconCode,
        linkOptions: { to: "/admin/playground" },
      },
    ],
  },
  {
    title: "Quem pode entrar",
    description: "",
    items: [
      {
        title: "Pessoas",
        description: "Revise membros, gerencie funções de administrador e remova acessos.",
        icon: IconUsers,
        linkOptions: { to: "/admin/people" },
      },
      {
        title: "Controles empresariais",
        description:
          "Configure funções, grupos, SSO, SCIM, compartilhamento de Habilidades, políticas de rede, listas de permissões e Gravação de ações.",
        icon: IconShieldCheck,
        linkOptions: { to: "/admin/enterprise" },
      },
      {
        title: "Provedores de identidade",
        description:
          "Configure o provedor de login da sua empresa para cada domínio de e-mail.",
        icon: IconBuildingBank,
        linkOptions: { to: "/admin/identity-providers" },
      },
    ],
  },
  {
    title: "O que aconteceu",
    description: "",
    items: [
      {
        title: "Auditoria",
        description: "Revise as ações feitas no OpenBot e quem as fez.",
        icon: IconListDetails,
        linkOptions: { to: "/admin/audit" },
      },
    ],
  },
];

function RouteComponent() {
  return (
    <PageShell
      description="Gerencie configurações que valem para todos e para todos os Bots desta implantação."
      title="Admin"
    >
      {SECTIONS.map((section) => (
        <PageSection
          description={section.description || undefined}
          key={section.title}
          title={section.title}
        >
          <PageRows>
            {section.items.map((item, index) => (
              <StaggerItem index={index} key={item.title}>
                {/*
                 * The whole row is the link, not a chevron somebody has to aim at: every row here
                 * goes exactly one place, so there is nothing else the row could mean.
                 */}
                <Item
                  render={(props) => <Link {...item.linkOptions} {...props} />}
                  size="sm"
                >
                  <ItemMedia variant="icon">
                    <item.icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.description}</ItemDescription>
                  </ItemContent>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Item>
                {index !== section.items.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        </PageSection>
      ))}
    </PageShell>
  );
}
