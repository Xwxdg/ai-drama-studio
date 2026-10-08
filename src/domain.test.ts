import { describe, it, expect } from "vitest";
import {
  analyze,
  continuity,
  csv,
  demoProject,
  emptyProject,
  generateShots,
  timeline,
  validateProject,
} from "./domain";
import { prompt, splitSegments } from "./prompts";
describe("剧本到制作文件核心闭环", () => {
  it("解析多场次、两名角色并生成十个以上镜头，保留原文", () => {
    const p = demoProject();
    expect(p.scenes).toHaveLength(2);
    expect(p.characters.map((a) => a.name)).toEqual(["林舟", "苏晴"]);
    expect(p.shots.length).toBeGreaterThan(10);
    expect(p.script).toContain("第1集");
    expect(p.shots.some((s) => s.dialogue.includes("真相"))).toBe(true);
    expect(p.props.map((a) => a.name)).toContain("雨伞");
  });
  it("修改时长与重排后自动得到连续时间轴", () => {
    const p = demoProject();
    p.shots[0].duration = 2.5;
    p.shots.reverse();
    const t = timeline(p.shots);
    expect(t[0].start).toBe(0);
    t.slice(1).forEach((v, i) => expect(v.start).toBe(t[i].end));
    expect(t.at(-1)?.end).toBe(p.shots.reduce((n, s) => n + s.duration, 0));
  });
  it("独立模板保留资产描述、对白、顺序与画幅", () => {
    const p = demoProject();
    p.settings.ratio = "9:16";
    const seed = prompt(p, p.shots);
    p.settings.model = "wan";
    const wan = prompt(p, p.shots);
    expect(seed).toContain("视频规划");
    expect(wan).toContain("主体与世界");
    for (const out of [seed, wan]) {
      expect(out).toContain("9:16");
      expect(out).toContain("黑色短发");
      expect(out).toContain("米色风衣");
      expect(out).toContain("门在左侧");
      expect(out).toContain("我必须知道真相");
      expect(out.indexOf("你终于来了")).toBeLessThan(
        out.indexOf("那就不要再骗我"),
      );
      expect(out).toContain("0.0—3.0秒");
    }
  });
  it("资产编辑实时更新提示词且规则解析不覆盖分镜", () => {
    const p = demoProject();
    p.characters[0].hair = "银色短发";
    p.shots[0].picture = "用户精修";
    const next = analyze(p);
    expect(next.shots[0].picture).toBe("用户精修");
    expect(prompt(next, next.shots)).toContain("银色短发");
    expect(next.characters).toHaveLength(2);
  });
  it("JSON 完整往返，拒绝坏格式和非法时长", () => {
    const p = demoProject();
    p.templates.wan = "用户模板 {timeline}";
    p.prompt = "已编辑提示词";
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(() => validateProject({ version: 9 })).toThrow();
    const bad = structuredClone(p);
    bad.shots[0].duration = -1;
    expect(() => validateProject(bad)).toThrow();
    const bad2 = structuredClone(p);
    bad2.shots[0].characters = ["错误类型", 3] as string[];
    expect(() => validateProject(bad2)).toThrow();
  });
  it("CSV 中文 BOM、双引号和换行正确转义并导出完整字段", () => {
    const p = demoProject();
    p.shots[0].dialogue = '苏晴："好"\n下一句';
    const out = csv(p);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain('"苏晴：""好""\n下一句"');
    expect(out).toContain("摄影机机位");
    expect(out).toContain("林舟、苏晴");
  });
  it("片段拆分不丢镜头、不重排、不修改镜头", () => {
    const p = demoProject();
    const before = JSON.stringify(p.shots);
    const groups = splitSegments(p.shots, 10);
    expect(groups.flat()).toEqual(p.shots);
    groups.forEach((g) =>
      expect(g.reduce((n, s) => n + s.duration, 0)).toBeLessThanOrEqual(10),
    );
    expect(JSON.stringify(p.shots)).toBe(before);
  });
  it("连贯性检测资产缺失、道具消失、服装和站位变化以及目标时长", () => {
    const p = demoProject();
    p.shots[0].propIds = [p.props[0].id];
    p.shots[1].propIds = [];
    p.shots[1].costume = "新服装";
    p.shots[1].blocking = "门口";
    p.shots[1].characters.push("missing");
    const out = continuity(p).join("\n");
    expect(out).toContain("服装");
    expect(out).toContain("道具");
    expect(out).toContain("站位");
    expect(out).toContain("已删除资产");
    expect(out).toContain("目标");
  });
  it("无场次标记仍保留文本并允许生成镜头", () => {
    const p = analyze({ ...emptyProject(), script: "甲：你好\n乙：再见" });
    expect(p.scenes).toHaveLength(1);
    expect(generateShots(p)).toHaveLength(2);
  });
});
