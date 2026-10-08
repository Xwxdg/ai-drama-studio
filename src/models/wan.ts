import type { Project, Shot } from "../domain";
export const template =
  "主体与世界：{assets}\n构图基调：{ratio}画幅，{style}，{quality}视觉目标。规划片段{duration}秒。\n镜头调度与运动方向（逐段衔接）：\n{timeline}\n连续性规则：每次切镜继承前镜动作终点与人物身份，运动方向保持一致；场景切换须交代空间，物件位置依据资产约束。对白与环境声音作为制作参考。";
export function renderWan(
  p: Project,
  shots: Shot[],
  assets: string,
  timeline: string,
) {
  return (p.templates.wan || template).replace(
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
