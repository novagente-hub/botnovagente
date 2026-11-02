import {
  IconChartBar,
  IconChevronRight,
  IconDeviceDesktop,
  IconFingerprint,
  IconKey,
  IconNetwork,
  IconPlug,
  IconShare,
  IconShieldLock,
  IconTerminal2,
  IconToggleRight,
  IconUsersGroup,
  IconWorld,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  removeNetworkPolicyMutationOptions,
  setCapabilityMutationOptions,
  setEnterpriseSettingMutationOptions,
  setNetworkPolicyMutationOptions,
  terminateInactiveComputersMutationOptions,
} from "@/lib/enterprise/mutations";
import {
  actionRecordsQueryOptions,
  type CapabilitySetting,
  type EgressRule,
  type EnterpriseOverview,
  enterpriseOverviewQueryOptions,
  modelUsageQueryOptions,
  type NetworkMode,
  type NetworkPolicy,
} from "@/lib/enterprise/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/enterprise")({
  component: EnterprisePage,
});

const MODE_NAMES: Record<NetworkMode, string> = {
  allow_all: "Permitir todo acesso à rede",
  defaults_plus_allowlist: "Padrões mais lista de permissões da equipe",
  allowlist_only: "Só a lista de permissões da equipe",
};

/** One rule per line: `example.com`, `*.corp.example`, or `10.0.0.0/8 443,8443`. */
function rulesFromText(text: string): EgressRule[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value = "", ports] = line.split(/\s+/, 2);
      return /^[\d.:a-fA-F]+(\/\d+)?$/.test(value) &&
        /[\d]/.test(value) &&
        /[.:]/.test(value)
        ? { type: "cidr" as const, value, ...(ports ? { ports } : {}) }
        : { type: "domain" as const, value };
    });
}

function rulesToText(rules: EgressRule[]): string {
  return rules
    .map((rule) =>
      rule.type === "domain"
        ? rule.value
        : `${rule.value}${rule.ports ? ` ${rule.ports}` : ""}`,
    )
    .join("\n");
}

function summarizePolicy(policy: NetworkPolicy | undefined): string {
  if (!policy)
    return "Sem política. Os computadores dos Bots podem acessar tudo o que o cluster permite";
  const count = policy.rules.length;
  return `${MODE_NAMES[policy.mode]} · ${count} ${count === 1 ? "rule" : "rules"}${policy.locked ? " · bloqueada" : ""}`;
}

function EnterprisePage() {
  const overview = useQuery(enterpriseOverviewQueryOptions());
  const setCapability = useMutation(setCapabilityMutationOptions(queryClient));
  const setSetting = useMutation(
    setEnterpriseSettingMutationOptions(queryClient),
  );
  const failure = setCapability.error ?? setSetting.error;

  return (
    <PageShell
      description="Gerencie permissões de membros, acesso à rede dos computadores dos Bots e configurações de gravação. Todas as alterações aparecem em Auditoria."
      title="Controles empresariais"
    >
      {failure ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {failure.message}
        </p>
      ) : null}
      {overview.isPending ? null : overview.error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          
          Não foi possível carregar os controles empresariais. Recarregue a página.
        </p>
      ) : (
        <EnterpriseSections
          data={overview.data}
          onCapability={(capability, allowed) =>
            setCapability.mutate({
              scopeKind: "organization",
              scopeId: "",
              capability,
              allowed,
            })
          }
          onSetting={(key, value) => setSetting.mutate({ key, value })}
          saving={setCapability.isPending || setSetting.isPending}
        />
      )}
    </PageShell>
  );
}

function EnterpriseSections({
  data,
  onCapability,
  onSetting,
  saving,
}: {
  data: EnterpriseOverview;
  onCapability: (
    capability: CapabilitySetting["capability"],
    allowed: boolean,
  ) => void;
  onSetting: (
    key: keyof EnterpriseOverview["settings"],
    value: unknown,
  ) => void;
  saving: boolean;
}) {
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [networkScope, setNetworkScope] = useState<
    { scopeKind: "organization" | "group"; scopeId: string } | undefined
  >();
  const [modelsOpen, setModelsOpen] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const { settings } = data;
  const overrideCount = data.capabilities.reduce(
    (count, capability) =>
      count +
      Object.keys(capability.roles).length +
      Object.keys(capability.groups).length,
    0,
  );
  const organizationPolicy = data.network.find(
    (row) => row.scopeKind === "organization",
  );
  const groupPolicies = data.network.filter((row) => row.scopeKind === "group");

  return (
    <>
      <PageSection
        description="Endereços em INITIAL_ADMIN_EMAILS sempre podem usar login social como acesso de emergência. Cada um desses logins aparece em Auditoria."
        title="Login"
      >
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconShieldLock />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Exigir SSO</ItemTitle>
              <ItemDescription>
                {settings.ssoRequired
                  ? "As pessoas só podem entrar por um provedor SAML ou OpenID Connect registrado."
                  : "As pessoas também podem entrar com Google, Microsoft ou Okta."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Exigir SSO"
                checked={settings.ssoRequired}
                disabled={saving}
                onCheckedChange={(checked) => onSetting("ssoRequired", checked)}
              />
            </ItemActions>
          </Item>
          <Separator />
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconFingerprint />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Provisionamento SCIM</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {data.scim.configured
                  ? `Directory base URL ${data.scim.baseUrl ?? "(defina BETTER_AUTH_URL)"} with the SCIM_BEARER_TOKEN bearer token. Deprovisioning ends sessions, blocks the address, retires connector credentials and stops their computers.`
                  : "Desativado. Defina SCIM_BEARER_TOKEN para aceitar provisionamento do Okta, Entra ou outro diretório."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-muted-foreground text-sm">
                {data.scim.configured ? "Em" : "Desativado"}
              </span>
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      <PageSection
        description="Cada chave vale para a organização inteira. Uma função pode sobrepô-la, e um grupo do diretório pode receber uma capacidade que a organização tem desativada."
        title="Capacidades"
      >
        <PageRows>
          {data.capabilities.map((capability) => {
            const effective = capability.organization ?? capability.default;
            return (
              <div key={capability.capability}>
                <Item size="sm">
                  <ItemMedia variant="icon">
                    <IconToggleRight />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{capability.title}</ItemTitle>
                    <ItemDescription>
                      {effective
                        ? capability.description
                        : "Desativado para todos, a menos que uma função ou grupo o ative."}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      aria-label={capability.title}
                      checked={effective}
                      disabled={saving}
                      onCheckedChange={(checked) =>
                        onCapability(capability.capability, checked)
                      }
                    />
                  </ItemActions>
                </Item>
                <Separator />
              </div>
            );
          })}
          <Item
            render={
              <button onClick={() => setOverridesOpen(true)} type="button" />
            }
            size="sm"
          >
            <ItemMedia variant="icon">
              <IconUsersGroup />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Exceções por função e grupo</ItemTitle>
              <ItemDescription>
                {overrideCount === 0
                  ? "Nenhuma. Todos recebem as chaves acima"
                  : `${overrideCount} set`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <IconChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      <PageSection
        description="As gravações de cada pessoa ensinam Habilidades no próprio espaço de Aprendizado, e essas Habilidades chegam aos Bots que a pessoa usa. Uma Habilidade compartilhada coloca o texto gravado e narrado da pessoa diante dos Bots de todos."
        title="Aprendizado"
      >
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconShare />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Compartilhamento de Habilidades</ItemTitle>
              <ItemDescription className="line-clamp-none">
                {settings.skillSharing
                  ? "As pessoas podem abrir suas Habilidades para todos os Bots em Configurações, Aprendizado."
                  : "Desativado. As Habilidades de cada pessoa só chegam aos Bots que ela usa, mesmo as que ela abriu antes."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Compartilhamento de Habilidades"
                checked={settings.skillSharing}
                disabled={saving}
                onCheckedChange={(checked) =>
                  onSetting("skillSharing", checked)
                }
              />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      <PageSection
        description="Controle onde os computadores dos Bots podem se conectar. As alterações valem em segundos, sem reiniciar. Políticas de grupo sobrepõem a da organização, a menos que ela esteja bloqueada."
        title="Rede"
      >
        <PageRows>
          <Item
            render={
              <button
                onClick={() =>
                  setNetworkScope({ scopeKind: "organization", scopeId: "" })
                }
                type="button"
              />
            }
            size="sm"
          >
            <ItemMedia variant="icon">
              <IconWorld />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Organização</ItemTitle>
              <ItemDescription>
                {summarizePolicy(organizationPolicy)}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <IconChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
          {groupPolicies.map((policy) => (
            <div key={policy.scopeId}>
              <Separator />
              <Item
                render={
                  <button
                    onClick={() =>
                      setNetworkScope({
                        scopeKind: "group",
                        scopeId: policy.scopeId,
                      })
                    }
                    type="button"
                  />
                }
                size="sm"
              >
                <ItemMedia variant="icon">
                  <IconNetwork />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Grupo: {policy.scopeId}</ItemTitle>
                  <ItemDescription>{summarizePolicy(policy)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <IconChevronRight className="size-4 text-muted-foreground" />
                </ItemActions>
              </Item>
            </div>
          ))}
        </PageRows>
        {data.groups.length > 0 ? (
          <Button
            className="mt-4"
            onClick={() => setNetworkScope({ scopeKind: "group", scopeId: "" })}
            size="sm"
            variant="outline"
          >
            
            Adicionar política de grupo
          </Button>
        ) : null}
      </PageSection>

      <PageSection
        description="Com a lista de permissões ativada, os Bots só podem chamar ferramentas dos servidores MCP aprovados aqui. Chamadas a qualquer outro servidor são recusadas."
        title="Servidores MCP"
      >
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconPlug />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Só servidores aprovados</ItemTitle>
              <ItemDescription>
                {settings.mcpAllowlist.enabled
                  ? `${settings.mcpAllowlist.servers.length} approved`
                  : "Desativado. Os Bots podem usar qualquer servidor registrado a que tenham acesso."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Só servidores MCP aprovados"
                checked={settings.mcpAllowlist.enabled}
                disabled={saving}
                onCheckedChange={(enabled) =>
                  onSetting("mcpAllowlist", {
                    ...settings.mcpAllowlist,
                    enabled,
                  })
                }
              />
            </ItemActions>
          </Item>
          {data.mcpServers.map((server) => {
            const approved = settings.mcpAllowlist.servers.includes(server.id);
            return (
              <div key={server.id}>
                <Separator />
                <Item size="sm">
                  <ItemMedia variant="icon">
                    <IconKey />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{server.title}</ItemTitle>
                    <ItemDescription>{server.url}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Switch
                      aria-label={`Approve ${server.title}`}
                      checked={approved}
                      disabled={saving}
                      onCheckedChange={(checked) =>
                        onSetting("mcpAllowlist", {
                          ...settings.mcpAllowlist,
                          servers: checked
                            ? [...settings.mcpAllowlist.servers, server.id]
                            : settings.mcpAllowlist.servers.filter(
                                (id) => id !== server.id,
                              ),
                        })
                      }
                    />
                  </ItemActions>
                </Item>
              </div>
            );
          })}
        </PageRows>
      </PageSection>

      <PageSection
        description={`O Bot integrado roda em ${data.builtInModel ?? "o modelo configurado na implantação"}. Um Bot remoto escolhe o próprio, e o modelo que ele informa é registrado.`}
        title="Modelos"
      >
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconShieldLock />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Lista de modelos permitidos</ItemTitle>
              <ItemDescription>
                {settings.modelAllowlist.enabled
                  ? "Um Bot integrado em um modelo fora da lista é recusado antes de executar."
                  : "Desativado. Qualquer modelo pode ser usado."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Lista de modelos permitidos"
                checked={settings.modelAllowlist.enabled}
                disabled={saving}
                onCheckedChange={(enabled) =>
                  onSetting("modelAllowlist", {
                    ...settings.modelAllowlist,
                    enabled,
                  })
                }
              />
            </ItemActions>
          </Item>
          <Separator />
          <Item
            render={
              <button onClick={() => setModelsOpen(true)} type="button" />
            }
            size="sm"
          >
            <ItemMedia variant="icon">
              <IconKey />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Modelos permitidos</ItemTitle>
              <ItemDescription>
                {settings.modelAllowlist.models.length === 0
                  ? "Nenhum listado"
                  : settings.modelAllowlist.models.join(", ")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <IconChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </PageRows>
        <ModelUsage />
      </PageSection>

      <PageSection
        description="Defina OTEL_EXPORTER_OTLP_ENDPOINT para enviar eventos de auditoria e ações dos Bots ao seu coletor OpenTelemetry ou SIEM. Eles levam a tag openbot.surface."
        title="Gravação e exportação"
      >
        <PageRows>
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconTerminal2 />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Gravação de ações</ItemTitle>
              <ItemDescription>
                {settings.actionRecording
                  ? `Os comandos de shell que os Bots executam são gravados sem segredos e mantidos por ${data.actionRecordRetentionDays} dias.`
                  : "Desativado. Os comandos aparecem só em Auditoria."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Gravação de ações"
                checked={settings.actionRecording}
                disabled={saving}
                onCheckedChange={(checked) =>
                  onSetting("actionRecording", checked)
                }
              />
            </ItemActions>
          </Item>
          <Separator />
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconChartBar />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Exportação OpenTelemetry</ItemTitle>
              <ItemDescription>
                {data.otel.configured
                  ? "Exportando por OTLP/HTTP."
                  : "Não configurado. Defina OTEL_EXPORTER_OTLP_ENDPOINT no servidor."}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-muted-foreground text-sm">
                {data.otel.configured ? "Em" : "Desativado"}
              </span>
            </ItemActions>
          </Item>
        </PageRows>
        {settings.actionRecording ? <RecordedActions /> : null}
      </PageSection>

      <PageSection
        description="Parar um computador encerra os Bots em execução e mantém o disco. O Bot recebe um computador novo na próxima sessão. Para parar os computadores de uma pessoa, vá em Pessoas."
        title="Computadores"
      >
        <PageRows>
          <Item
            render={<button onClick={() => setDaysOpen(true)} type="button" />}
            size="sm"
          >
            <ItemMedia variant="icon">
              <IconDeviceDesktop />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Parar computadores inativos</ItemTitle>
              <ItemDescription>
                {settings.inactiveComputerDays === 0
                  ? "Desativado"
                  : `Após ${settings.inactiveComputerDays} dias sem uso`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <IconChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        </PageRows>
        <SweepNow />
      </PageSection>

      <OverridesDialog
        data={data}
        onOpenChange={setOverridesOpen}
        open={overridesOpen}
      />
      {networkScope ? (
        <NetworkDialog
          data={data}
          initial={networkScope}
          onClose={() => setNetworkScope(undefined)}
        />
      ) : null}
      <ListDialog
        description="Informe um modelo por linha como provedor/modelo, por exemplo openai/gpt-5.6-terra."
        initial={settings.modelAllowlist.models}
        onClose={() => setModelsOpen(false)}
        onSave={(models) =>
          onSetting("modelAllowlist", { ...settings.modelAllowlist, models })
        }
        open={modelsOpen}
        title="Modelos permitidos"
      />
      <DaysDialog
        initial={settings.inactiveComputerDays}
        onClose={() => setDaysOpen(false)}
        onSave={(days) => onSetting("inactiveComputerDays", days)}
        open={daysOpen}
      />
    </>
  );
}

function ModelUsage() {
  const usage = useQuery(modelUsageQueryOptions(30));
  if (usage.isPending) return null;
  if (usage.error)
    return (
      <p className="mt-4 text-destructive text-sm" role="alert">
        
        Não foi possível carregar o uso de modelos. Recarregue a página.
      </p>
    );
  if (usage.data.summary.length === 0)
    return (
      <PageEmpty icon={IconChartBar} title="Nenhuma execução recente">
        
        Nenhuma execução de Bot nos últimos 30 dias.
      </PageEmpty>
    );
  return (
    <PageRows>
      {usage.data.summary.map((row, index) => (
        <div key={`${row.model}-${row.source}`}>
          {index > 0 ? <Separator /> : null}
          <Item size="sm">
            <ItemMedia variant="icon">
              <IconChartBar />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{row.model}</ItemTitle>
              <ItemDescription>
                {row.runs}  execuções por {row.people}{" "}
                {row.people === 1 ? "pessoa" : "pessoas"}  em 30 dias
                {row.refused > 0 ? ` · ${row.refused} fora da lista de permissões` : ""} ·{" "}
                {row.source}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-muted-foreground text-sm">
                {new Date(row.lastUsedAt).toLocaleDateString()}
              </span>
            </ItemActions>
          </Item>
        </div>
      ))}
    </PageRows>
  );
}

function RecordedActions() {
  const actions = useQuery(actionRecordsQueryOptions());
  if (actions.isPending) return null;
  if (actions.error)
    return (
      <p className="mt-4 text-destructive text-sm" role="alert">
        
        Não foi possível carregar as ações gravadas. Recarregue a página.
      </p>
    );
  if (actions.data.length === 0)
    return <PageEmpty icon={IconTerminal2} title="Nenhum comando gravado ainda" />;
  return (
    <PageRows>
      {actions.data.map((action, index) => (
        <div key={action.id}>
          {index > 0 ? <Separator /> : null}
          <Item size="sm">
            <ItemContent>
              <ItemTitle className="font-mono text-xs">
                {action.command}
              </ItemTitle>
              <ItemDescription>
                {action.surface === "local"
                  ? "Máquina do membro"
                  : `Bot ${action.botId ?? "?"}`}{" "}
                · {action.outcome} ·{" "}
                {new Date(action.createdAt).toLocaleString()}
              </ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ))}
    </PageRows>
  );
}

function SweepNow() {
  const sweep = useMutation(terminateInactiveComputersMutationOptions());
  return (
    <div className="mt-4 flex items-center gap-3">
      <Button
        disabled={sweep.isPending}
        onClick={() => sweep.mutate()}
        size="sm"
        variant="outline"
      >
        {sweep.isPending ? "Parando…" : "Parar computadores inativos agora"}
      </Button>
      {sweep.data ? (
        <span className="text-muted-foreground text-sm">
          
          Parado {sweep.data.stopped.length}.
        </span>
      ) : null}
      {sweep.error ? (
        <span className="text-destructive text-sm" role="alert">
          {sweep.error.message}
        </span>
      ) : null}
    </div>
  );
}

type Tri = "inherit" | "on" | "off";

function OverridesDialog({
  data,
  open,
  onOpenChange,
}: {
  data: EnterpriseOverview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setCapability = useMutation(setCapabilityMutationOptions(queryClient));
  const scopes: { kind: "role" | "group"; id: string; label: string }[] = [
    { kind: "role", id: "admin", label: "Administradores" },
    { kind: "role", id: "user", label: "Membros" },
    ...data.groups.map((group) => ({
      kind: "group" as const,
      id: group,
      label: `Group: ${group}`,
    })),
  ];
  const [scopeIndex, setScopeIndex] = useState(0);
  const scope = scopes[scopeIndex] ?? scopes[0];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exceções por função e grupo</DialogTitle>
        </DialogHeader>
        <DialogBody className="mt-4 space-y-4 overflow-y-auto">
          <Select
            onValueChange={(value) => setScopeIndex(Number(value))}
            value={String(scopeIndex)}
          >
            <SelectTrigger aria-label="Escopo">
              <SelectValue>{scope?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {scopes.map((candidate, index) => (
                  <SelectItem
                    key={`${candidate.kind}:${candidate.id}`}
                    value={String(index)}
                  >
                    {candidate.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {scope?.kind === "group"
              ? "Um grupo só pode adicionar. Conceder dá aos membros a capacidade mesmo quando a organização a tem desativada."
              : "A configuração de uma função substitui a chave da organização para todos com essa função."}
          </p>
          {scope
            ? data.capabilities.map((capability) => {
                const stored =
                  scope.kind === "role"
                    ? capability.roles[scope.id as "admin" | "user"]
                    : capability.groups[scope.id];
                const value: Tri =
                  stored === undefined ? "inherit" : stored ? "on" : "off";
                return (
                  <div
                    className="flex items-center justify-between gap-4"
                    key={capability.capability}
                  >
                    <Label>{capability.title}</Label>
                    <Select
                      onValueChange={(next) =>
                        setCapability.mutate({
                          scopeKind: scope.kind,
                          scopeId: scope.id,
                          capability: capability.capability,
                          allowed: next === "inherit" ? null : next === "on",
                        })
                      }
                      value={value}
                    >
                      <SelectTrigger
                        aria-label={`${capability.title} for ${scope.label}`}
                        className="w-36"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="inherit">Herdar</SelectItem>
                          <SelectItem value="on">
                            {scope.kind === "group" ? "Conceder" : "Em"}
                          </SelectItem>
                          {scope.kind === "role" ? (
                            <SelectItem value="off">Desativado</SelectItem>
                          ) : null}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })
            : null}
          {setCapability.error ? (
            <p className="text-destructive text-sm" role="alert">
              {setCapability.error.message}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)} size="sm" type="button">
            
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NetworkDialog({
  data,
  initial,
  onClose,
}: {
  data: EnterpriseOverview;
  initial: { scopeKind: "organization" | "group"; scopeId: string };
  onClose: () => void;
}) {
  const existing = data.network.find(
    (row) =>
      row.scopeKind === initial.scopeKind && row.scopeId === initial.scopeId,
  );
  const [group, setGroup] = useState(initial.scopeId || data.groups[0] || "");
  const [mode, setMode] = useState<NetworkMode>(
    existing?.mode ?? "defaults_plus_allowlist",
  );
  const [rules, setRules] = useState(rulesToText(existing?.rules ?? []));
  const [locked, setLocked] = useState(existing?.locked ?? false);
  const save = useMutation(setNetworkPolicyMutationOptions(queryClient));
  const remove = useMutation(removeNetworkPolicyMutationOptions(queryClient));
  const scopeId = initial.scopeKind === "group" ? group : "";
  const formId = useId();

  return (
    <Dialog onOpenChange={(open) => (open ? undefined : onClose())} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial.scopeKind === "organization"
              ? "Política de rede da organização"
              : "Política de rede do grupo"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="mt-4 space-y-4 overflow-y-auto">
          {/* The submit button is in the footer and reaches this form by id, so DialogBody stays a
              direct child of DialogContent and keeps scrolling. */}
          <form
            className="flex flex-col gap-4"
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(
                {
                  scopeKind: initial.scopeKind,
                  scopeId,
                  mode,
                  rules: rulesFromText(rules),
                  locked,
                },
                { onSuccess: onClose },
              );
            }}
          >
            {initial.scopeKind === "group" && !initial.scopeId ? (
              <div className="space-y-1.5">
                <Label>Grupo</Label>
                <Select
                  onValueChange={(value) => setGroup(String(value))}
                  value={group}
                >
                  <SelectTrigger aria-label="Grupo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {data.groups.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Modo</Label>
              <Select
                onValueChange={(value) => setMode(value as NetworkMode)}
                value={mode}
              >
                <SelectTrigger aria-label="Modo">
                  <SelectValue>{MODE_NAMES[mode]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(Object.keys(MODE_NAMES) as NetworkMode[]).map(
                      (candidate) => (
                        <SelectItem key={candidate} value={candidate}>
                          {MODE_NAMES[candidate]}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="network-rules">Lista de permissões</Label>
              <Textarea
                className="font-mono text-xs"
                id="network-rules"
                onChange={(event) => setRules(event.target.value)}
                placeholder={"example.com\n*.corp.example\n10.0.0.0/8 443,5432"}
                rows={8}
                value={rules}
              />
              <p className="text-muted-foreground text-xs">
                
                Um por linha. Um domínio cobre os subdomínios. *.nome cobre só subdomínios. Uma faixa de IP pode listar portas. Os padrões são{" "}
                {data.defaultDestinations.slice(0, 4).join(", ")} and{" "}
                {data.defaultDestinations.length - 4}  hosts de pacotes e código a mais.
              </p>
            </div>
            {initial.scopeKind === "organization" ? (
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="network-locked">
                  
                  Bloquear para que grupos não substituam esta política
                </Label>
                <Switch
                  checked={locked}
                  id="network-locked"
                  onCheckedChange={setLocked}
                />
              </div>
            ) : null}
          </form>
          {(save.error ?? remove.error) ? (
            <p className="text-destructive text-sm" role="alert">
              {(save.error ?? remove.error)?.message}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="mt-4">
          {existing ? (
            <Button
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { scopeKind: initial.scopeKind, scopeId },
                  { onSuccess: onClose },
                )
              }
              size="sm"
              type="button"
              variant="destructive"
            >
              
              Remover política
            </Button>
          ) : null}
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            
            Cancelar
          </Button>
          <Button
            disabled={
              save.isPending || (initial.scopeKind === "group" && !scopeId)
            }
            form={formId}
            size="sm"
            type="submit"
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListDialog({
  open,
  title,
  description,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  initial: string[];
  onSave: (values: string[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial.join("\n"));
  return (
    <Dialog
      onOpenChange={(next) => (next ? setText(initial.join("\n")) : onClose())}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="mt-4 space-y-2 overflow-y-auto">
          <Textarea
            className="font-mono text-xs"
            onChange={(event) => setText(event.target.value)}
            rows={8}
            value={text}
          />
          <p className="text-muted-foreground text-xs">{description}</p>
        </DialogBody>
        <DialogFooter className="mt-4">
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(
                text
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              );
              onClose();
            }}
            size="sm"
            type="button"
          >
            
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DaysDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: number;
  onSave: (days: number) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(String(initial));
  const parsed = Number(days);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650;
  return (
    <Dialog
      onOpenChange={(next) => (next ? setDays(String(initial)) : onClose())}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parar computadores inativos</DialogTitle>
        </DialogHeader>
        <DialogBody className="mt-4 space-y-2">
          <Label htmlFor="inactive-days">Dias sem uso</Label>
          <Input
            id="inactive-days"
            inputMode="numeric"
            onChange={(event) => setDays(event.target.value)}
            value={days}
          />
          <p className="text-muted-foreground text-xs">
            
            0 desativa. Verificado a cada hora.
          </p>
        </DialogBody>
        <DialogFooter className="mt-4">
          <Button onClick={onClose} size="sm" type="button" variant="outline">
            
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave(parsed);
              onClose();
            }}
            size="sm"
            type="button"
          >
            
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
