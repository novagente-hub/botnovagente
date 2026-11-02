import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GALLERY as FORMS,
  FormCard,
  FormCardArgs,
} from "@/components/gallery/form";
import {
  DataTable,
  DataTableProps,
  GALLERY as TABLES,
} from "@/components/gallery/table";
import { settleReactWork } from "./settle-react-work";

beforeAll(() => GlobalRegistrator.register({ url: "http://localhost/" }));
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  user = userEvent.setup({ document });
});
afterEach(cleanup);
afterAll(async () => {
  await settleReactWork();
  GlobalRegistrator.unregister();
});
const TABLE = {
  title: "Capacidade da equipe",
  columns: ["Equipe", "Hours"],
  rows: [
    { cells: ["Design", 18] },
    { cells: ["Produto", 4] },
    { cells: ["Engenharia", 72] },
  ],
};
const FORM = {
  title: "Project brief",
  fields: [
    { id: "team", label: "Equipe", type: "text", required: true },
    { id: "email", label: "E-mail de trabalho", type: "email", required: true },
    {
      id: "seats",
      label: "Seats",
      type: "number",
      min: 1,
      max: 20,
      required: true,
    },
    {
      id: "priority",
      label: "Prioridade",
      type: "select",
      options: ["Esta semana", "Este mês"],
      required: true,
    },
    { id: "notes", label: "Notes", type: "textarea" },
  ],
};
async function fillForm(view: ReturnType<typeof render>) {
  await user.type(view.getByRole("textbox", { name: "Equipe" }), "  Design  ");
  await user.type(
    view.getByRole("textbox", { name: "E-mail de trabalho" }),
    "designer@example.test",
  );
  await user.type(view.getByRole("spinbutton", { name: "Seats" }), "3");
  await user.selectOptions(
    view.getByRole("combobox", { name: "Prioridade" }),
    "Este mês",
  );
}
test("table sorts numeric cells in both directions with accessible headers", async () => {
  const view = render(<DataTable {...TABLE} />);
  const order = () =>
    view
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent);
  expect(order()).toEqual(["Design", "Produto", "Engenharia"]);
  const header = view.getByRole("columnheader", { name: "Hours" });
  await user.click(view.getByRole("button", { name: "Hours" }));
  expect(order()).toEqual(["Produto", "Design", "Engenharia"]);
  expect(header.getAttribute("aria-sort")).toBe("ascending");
  await user.keyboard("{Enter}");
  expect(order()).toEqual(["Engenharia", "Design", "Produto"]);
  expect(header.getAttribute("aria-sort")).toBe("descending");
  expect(view.getByRole("region").getAttribute("tabindex")).toBe("0");
});
test("empty tables stay explicit and mismatched cells are refused", () => {
  const view = render(<DataTable {...TABLE} rows={[]} />);
  expect(view.getByText("Nenhuma linha para mostrar.")).toBeTruthy();
  expect(view.getAllByRole("columnheader")).toHaveLength(2);
  expect(
    DataTableProps.safeParse({ ...TABLE, rows: [{ cells: ["Only one"] }] })
      .success,
  ).toBe(false);
  view.rerender(<DataTable {...TABLE} rows={[{ cells: ["Only one"] }]} />);
  expect(view.queryByRole("table")).toBeNull();
  expect(
    DataTableProps.safeParse({ ...TABLE, columns: ["Same", "Same"] }).success,
  ).toBe(false);
});
test("required and typed fields keep the form pending until corrected", async () => {
  const answers: unknown[] = [];
  const view = render(
    <FormCard
      status="executing"
      args={FORM}
      respond={async (answer: unknown) => {
        answers.push(answer);
      }}
    />,
  );
  await user.click(view.getByRole("button", { name: "Enviar respostas" }));
  expect(view.getAllByRole("alert")).toHaveLength(4);
  expect(document.activeElement).toBe(
    view.getByRole("textbox", { name: "Equipe" }),
  );
  expect(
    view.getByRole("textbox", { name: "Equipe" }).getAttribute("aria-invalid"),
  ).toBe("true");
  await fillForm(view);
  await user.clear(view.getByRole("textbox", { name: "E-mail de trabalho" }));
  await user.type(view.getByRole("textbox", { name: "E-mail de trabalho" }), "invalid");
  await user.clear(view.getByRole("spinbutton", { name: "Seats" }));
  await user.type(view.getByRole("spinbutton", { name: "Seats" }), "21");
  await user.click(view.getByRole("button", { name: "Enviar respostas" }));
  expect(view.getByText("Insira um endereço de e-mail válido.")).toBeTruthy();
  expect(view.getByText("Insira 20 ou menos.")).toBeTruthy();
  expect(answers).toEqual([]);
  await user.clear(view.getByRole("textbox", { name: "E-mail de trabalho" }));
  await user.type(
    view.getByRole("textbox", { name: "E-mail de trabalho" }),
    "designer@example.test",
  );
  await user.clear(view.getByRole("spinbutton", { name: "Seats" }));
  await user.type(view.getByRole("spinbutton", { name: "Seats" }), "3");
  await user.click(view.getByRole("button", { name: "Enviar respostas" }));
  await waitFor(() => expect(view.getByText("Enviado")).toBeTruthy());
  expect(answers).toEqual([
    {
      status: "submitted",
      values: {
        team: "Design",
        email: "designer@example.test",
        seats: 3,
        priority: "Este mês",
      },
    },
  ]);
  expect(view.queryByRole("form")).toBeNull();
  expect(view.getByText("Não informado")).toBeTruthy();
});
test("a failed answer preserves values and retries without duplicate submissions", async () => {
  let attempts = 0;
  let release: (() => void) | undefined;
  const view = render(
    <FormCard
      status="executing"
      args={FORM}
      respond={async () => {
        attempts++;
        if (attempts === 1) throw new Error("synthetic transport failure");
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }}
    />,
  );
  await fillForm(view);
  await user.click(view.getByRole("button", { name: "Enviar respostas" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain(
      "Não foi possível enviar suas respostas",
    ),
  );
  const team = view.getByRole("textbox", { name: "Equipe" });
  expect(team instanceof HTMLInputElement).toBe(true);
  if (team instanceof HTMLInputElement) expect(team.value).toBe("  Design  ");
  await user.click(view.getByRole("button", { name: "Enviar respostas" }));
  fireEvent.submit(view.getByRole("form"));
  expect(attempts).toBe(2);
  expect(
    view.getByRole("button", { name: "Enviando…" }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => {
    release?.();
  });
  await waitFor(() => expect(view.getByText("Enviado")).toBeTruthy());
  expect(view.queryByRole("button")).toBeNull();
});
test("completed SDK results show saved values and never offer another submission", () => {
  const view = render(
    <FormCard
      status="complete"
      args={FORM}
      result={JSON.stringify({
        status: "submitted",
        values: {
          team: "Saved team",
          email: "saved@example.test",
          seats: 7,
          priority: "Esta semana",
          notes: "First line\nSecond line",
        },
      })}
    />,
  );
  expect(view.getByText("Saved team")).toBeTruthy();
  expect(view.getByText("7")).toBeTruthy();
  expect(view.queryByRole("textbox")).toBeNull();
  expect(view.queryByRole("button")).toBeNull();
  view.rerender(
    <FormCard status="complete" args={FORM} result="unreadable result" />,
  );
  expect(view.getByText(/respostas salvas não estão disponíveis/)).toBeTruthy();
  expect(view.queryByRole("button")).toBeNull();
});
test("streaming or malformed form specifications expose no active fields", () => {
  const view = render(
    <FormCard status="inProgress" args={{ title: "Incoming" }} />,
  );
  expect(view.queryByRole("textbox")).toBeNull();
  expect(
    FormCardArgs.safeParse({
      title: "Bad",
      fields: [{ id: "team", label: "Equipe", type: "select" }],
    }).success,
  ).toBe(false);
  expect(
    FormCardArgs.safeParse({
      ...FORM,
      fields: [FORM.fields[0], FORM.fields[0]],
    }).success,
  ).toBe(false);
  view.rerender(<FormCard status="executing" args={FORM} />);
  expect(
    view
      .getByRole("button", { name: "Enviar respostas" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
test("gallery exports have valid previews and existing card/decision kinds", () => {
  expect(TABLES[0].name).toBe("showTable");
  expect(TABLES[0].kind).toBe("card");
  expect(DataTableProps.safeParse(TABLES[0].preview).success).toBe(true);
  expect(FORMS[0].name).toBe("askForm");
  expect(FORMS[0].kind).toBe("decision");
  expect(FormCardArgs.safeParse(FORMS[0].preview?.args).success).toBe(true);
});

test("invalid form arguments release the suspended run once so the Bot can repair them", async () => {
  const answers: unknown[] = [];
  const card = (
    <FormCard
      status="executing"
      args={{ title: "Bad form", fields: [] }}
      respond={async (answer: unknown) => {
        answers.push(answer);
      }}
    />
  );
  const view = render(card);
  await waitFor(() => expect(answers).toHaveLength(1));
  expect(answers[0]).toEqual({
    status: "invalid",
    message:
      "Não foi possível exibir o formulário porque as perguntas eram inválidas.",
  });
  expect(view.queryByRole("form")).toBeNull();
  view.rerender(card);
  expect(answers).toHaveLength(1);
});
