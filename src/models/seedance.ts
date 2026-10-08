import type { Project, Shot } from "../domain";
export const template =
  "视频规划：{duration}秒，{ratio}，{style}，画质目标{quality}。\n资产与空间约束：\n{assets}\n按时间顺序执行：\n{timeline}\n一致性：角色面部、发型、服装保持资产设定；门窗、家具、光源位置固定。保留对白，禁止擅自添加角色。";
export function renderSeedance(
  p: Project,
  shots: Shot[],
  assets: string,
  timeline: string,
) {
  return (p.templates.seedance || template).replace(
    /\{(duration|ratio|style|quality|assets|timeline)\}/g,
    (_, key: string) =>
      (
        ({
          duration: shots.reduce((a, s) => a + s.duration, 0).toFixed(1),
          ...p.settings,
          assets,
          timeline,
        }) as Record<string, unknown>
      )[key] as string,
  );
}
