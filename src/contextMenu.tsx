import { afterPatch, fakeRenderComponent, findInReactTree, findInTree, findModuleByExport, MenuItem } from "@decky/ui";
import { toaster } from "@decky/api";

import { toggleApp } from "./api";
import { getCachedConfig, setCachedConfig } from "./hider";
import { describeToggle } from "./policy";
import { getAppInfo } from "./steam";

// Same approach as decky-steamgriddb's "Change Artwork..." entry: patch the render
// of Steam's LibraryContextMenu and splice our MenuItem in before "Properties...".

const MENU_KEY = "activityhide-toggle";

function findLibraryContextMenu(): any {
  const mod = findModuleByExport((e: any) => e?.toString && e.toString().includes("().LibraryContextMenu"));
  if (!mod) return null;
  const sibling = Object.values(mod).find((s: any) => s?.toString?.().includes("navigator:"));
  if (!sibling) return null;
  return fakeRenderComponent(sibling as any).type;
}

function buildMenuItem(appid: number) {
  const app = getAppInfo(appid);
  const desc = describeToggle(app, getCachedConfig());
  return (
    <MenuItem
      key={MENU_KEY}
      disabled={desc.disabled}
      onSelected={async () => {
        try {
          const next = await toggleApp(app);
          setCachedConfig(next);
          toaster.toast({
            title: "ActivityHide",
            body: desc.willHide ? `${app.name}: activity will be hidden` : `${app.name}: activity visible again`,
          });
        } catch (err) {
          console.error("[ActivityHide] toggle failed", err);
        }
      }}
    >
      {desc.label}
    </MenuItem>
  );
}

function removeOurItem(items: any[]): void {
  const idx = items.findIndex((x) => x?.key === MENU_KEY);
  if (idx !== -1) items.splice(idx, 1);
}

function spliceOurItem(items: any[], appid: number): void {
  removeOurItem(items);
  const propertiesIdx = items.findIndex((item) =>
    findInReactTree(item, (x: any) => x?.onSelected && x.onSelected.toString().includes("AppProperties"))
  );
  const entry = buildMenuItem(appid);
  if (propertiesIdx === -1) items.push(entry);
  else items.splice(propertiesIdx, 0, entry);
}

/** Only the game context menu has a "Play" entry whose handler mentions launchSource. */
function isAppContextMenu(items: any[]): boolean {
  if (!items?.length) return false;
  return !!findInReactTree(items, (x: any) => x?.props?.onSelected && x.props.onSelected.toString().includes("launchSource"));
}

function resolveAppid(items: any[], fallback: number): number {
  const parent = items.find((x) => x?._owner?.pendingProps?.overview?.appid && x._owner.pendingProps.overview.appid !== fallback);
  if (parent) return parent._owner.pendingProps.overview.appid;
  const found = findInTree(items, (x: any) => x?.app?.appid, { walkable: ["props", "children"] });
  return found?.app?.appid ?? fallback;
}

export interface ContextMenuPatch {
  unpatch(): void;
}

export function patchContextMenu(): ContextMenuPatch | null {
  const LibraryContextMenu = findLibraryContextMenu();
  if (!LibraryContextMenu) {
    console.error("[ActivityHide] LibraryContextMenu not found; context menu entry disabled");
    return null;
  }

  let inner: { unpatch(): void } | null = null;
  const outer = afterPatch(LibraryContextMenu.prototype, "render", (_: any, component: any) => {
    let appid = 0;
    if (component._owner) {
      appid = component._owner.pendingProps.overview.appid;
    } else {
      const found = findInTree(component.props.children, (x: any) => x?.app?.appid, { walkable: ["props", "children"] });
      if (found) appid = found.app.appid;
    }

    if (!inner) {
      inner = afterPatch(component, "type", (_: any, ret: any) => {
        afterPatch(ret.type.prototype, "render", (_: any, ret2: any) => {
          const items = ret2.props.children[0];
          if (!isAppContextMenu(items)) return ret2;
          try {
            spliceOurItem(items, resolveAppid(items, appid));
          } catch (err) {
            console.error("[ActivityHide] menu splice failed", err);
          }
          return ret2;
        });
        afterPatch(ret.type.prototype, "shouldComponentUpdate", ([nextProps]: any[], shouldUpdate: boolean) => {
          try {
            removeOurItem(nextProps.children);
            if (shouldUpdate === true) spliceOurItem(nextProps.children, resolveAppid(nextProps.children, appid));
          } catch {
            /* not our menu */
          }
          return shouldUpdate;
        });
        return ret;
      });
    } else if (appid) {
      spliceOurItem(component.props.children, appid);
    }
    return component;
  });

  return {
    unpatch() {
      outer?.unpatch();
      inner?.unpatch();
    },
  };
}
