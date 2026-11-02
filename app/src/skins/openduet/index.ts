import type { Skin } from "../types";
import { OpenDuetFrame } from "./frame";
import { TASKS_SCREEN } from "./places";
import { TasksScreen } from "./tasks-screen";

export const openduet: Skin = {
  id: "openduet",
  name: "OpenDuet",
  description:
    "Bots que mantêm você informado, em uma coluna no formato de celular.",
  Frame: OpenDuetFrame,
  screens: { [TASKS_SCREEN]: TasksScreen },
};
