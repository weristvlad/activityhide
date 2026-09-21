import { definePlugin } from "@decky/api";
import { FaEyeSlash } from "react-icons/fa";

import App from "./App";
import { patchContextMenu } from "./contextMenu";
import { startHider, stopHider } from "./hider";

export default definePlugin(() => {
  startHider();
  const menuPatch = patchContextMenu();

  return {
    name: "ActivityHide",
    titleView: <div>ActivityHide</div>,
    content: <App />,
    icon: <FaEyeSlash />,
    onDismount() {
      menuPatch?.unpatch();
      stopHider();
    },
  };
});
