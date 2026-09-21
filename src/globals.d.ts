// Globals provided by the Steam client's SharedJSContext, where Decky plugins run.
// Only the members this plugin touches are declared; everything else is `any`.

declare const SteamClient: {
  GameSessions: {
    RegisterForAppLifetimeNotifications(
      cb: (update: { unAppID: number; nInstanceID: number; bRunning: boolean }) => void
    ): { unregister(): void };
  };
  [key: string]: any;
};

interface Window {
  appStore: any;
  collectionStore: any;
  DFL?: any;
}
