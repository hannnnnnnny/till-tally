// Registry the demo runtime fills at bootstrap. It lives outside the demo
// chunk so regular UI modules can read it without pulling demo fixtures
// into non-demo bundles.
export type DemoInfo = {
  credentials: { email: string; password: string };
  presetQuestions: string[];
  repoUrl: string;
};

let demoInfo: DemoInfo | null = null;

export function setDemoInfo(info: DemoInfo): void {
  demoInfo = info;
}

export function getDemoInfo(): DemoInfo | null {
  return demoInfo;
}
