export type AssetKind = "characters" | "locations" | "props";
export type Asset = { id: string; name: string; [key: string]: string };
export type Scene = {
  id: string;
  episode: string;
  name: string;
  interior: string;
  time: string;
  characters: string[];
  text: string;
  events: string;
  emotion: string;
  props: string;
};
export type Shot = {
  id: string;
  sceneId: string;
  duration: number;
  size: string;
  position: string;
  angle: string;
  movement: string;
  lens: string;
  depth: string;
  characters: string[];
  locationId: string;
  propIds: string[];
  picture: string;
  action: string;
  expression: string;
  emotion: string;
  lighting: string;
  sound: string;
  dialogue: string;
  requirements: string;
  blocking: string;
  costume: string;
  confirmed: boolean;
};
export type Project = {
  version: 1;
  id: string;
  name: string;
  script: string;
  scenes: Scene[];
  characters: Asset[];
  locations: Asset[];
  props: Asset[];
  shots: Shot[];
  settings: {
    model: "seedance" | "wan";
    ratio: string;
    style: string;
    quality: string;
    target: number;
    segment: number;
  };
  templates: { seedance: string; wan: string };
  prompt: string;
  updatedAt: string;
};
export const uid = () => crypto.randomUUID();
export const fields: Record<AssetKind, Record<string, string>> = {
  characters: {
    name: "角色名称",
    genderAge: "性别与年龄",
    body: "身高与体型",
    face: "面部特征",
    hair: "发型与发色",
    costume: "服装版本",
    personality: "性格特征",
    voice: "声音描述",
    prompt: "固定人物提示词",
    notes: "备注",
  },
  locations: {
    name: "场景名称",
    type: "场景类型",
    layout: "空间结构 / 门窗与家具位置",
    material: "建筑与装修材质",
    lighting: "光照 / 光源方向",
    weather: "时间与天气",
    anchors: "关键环境锚点",
    prompt: "场景固定提示词",
  },
  props: {
    name: "道具名称",
    color: "颜色",
    material: "材质",
    size: "尺寸",
    appearance: "外观描述",
    user: "使用人物",
    scene: "关联场景",
    prompt: "固定提示词",
  },
};
export const sampleScript = `第1集 雨夜来信
场次1 内景 咖啡馆 夜
出场人物：林舟、苏晴
林舟：你终于来了。
苏晴：那封信在哪里？
林舟从外套口袋取出信封，放在桌上。
苏晴迟疑地伸手，停在信封上方。
林舟：先答应我，别一个人去。
苏晴：我必须知道真相。
场次2 外景 街道 夜
出场人物：林舟、苏晴
苏晴推开门，走进雨里。
林舟拿起雨伞，追到街道。
林舟：等等，我和你一起。
苏晴回头，眼眶泛红。
苏晴：那就不要再骗我。
两人并肩沿街道走远，雨伞遮住信封。`;
export function emptyProject(name = "未命名项目"): Project {
  return {
    version: 1,
    id: uid(),
    name,
    script: "",
    scenes: [],
    characters: [],
    locations: [],
    props: [],
    shots: [],
    settings: {
      model: "seedance",
      ratio: "16:9",
      style: "3D动漫",
      quality: "1080P",
      target: 30,
      segment: 10,
    },
    templates: { seedance: "", wan: "" },
    prompt: "",
    updatedAt: new Date().toISOString(),
  };
}
export function parseScript(script: string): Scene[] {
  let episode = "1",
    current: Scene | undefined;
  const scenes: Scene[] = [];
  for (const raw of script.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const ep = line.match(/^第\s*(\S+?)\s*集/);
    if (ep) {
      episode = ep[1];
      continue;
    }
    if (
      /^(场次\s*\S+|场景\s*\S+|\d+[.、]\s*(内|外)|(?:内景|外景))/.test(line)
    ) {
      current = {
        id: uid(),
        episode,
        name: line.replace(/^场[次景]\s*\d+\s*/, ""),
        interior: line.includes("外景")
          ? "外景"
          : line.includes("内景")
            ? "内景"
            : "待补充",
        time: /夜|晚/.test(line)
          ? "夜"
          : /日|白天|早晨/.test(line)
            ? "日"
            : "待补充",
        characters: [],
        text: "",
        events: "",
        emotion: "待人工补充",
        props: "",
      };
      scenes.push(current);
    } else {
      if (!current) {
        current = {
          id: uid(),
          episode,
          name: "未标注场景",
          interior: "待补充",
          time: "待补充",
          characters: [],
          text: "",
          events: "",
          emotion: "待人工补充",
          props: "",
        };
        scenes.push(current);
      }
      current.text += (current.text ? "\n" : "") + raw;
      if (/^出场人物[：:]/.test(line))
        current.characters.push(
          ...line
            .split(/[：:]/)
            .slice(1)
            .join(":")
            .split(/[、，,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      const d = line.match(/^([^：:]{1,12})[：:]/);
      if (d && !/^出场人物/.test(line)) current.characters.push(d[1]);
      current.characters = [...new Set(current.characters)];
      current.events = current.text
        .split("\n")
        .filter((s) => !s.includes("："))
        .join("；");
      current.props = [
        ...new Set(current.text.match(/信封|雨伞|手机|钥匙|刀|杯子/g) || []),
      ].join("、");
    }
  }
  return scenes;
}
export function newShot(sceneId = ""): Shot {
  return {
    id: uid(),
    sceneId,
    duration: 3,
    size: "中景",
    position: "平视",
    angle: "正面",
    movement: "固定",
    lens: "50mm",
    depth: "浅景深",
    characters: [],
    locationId: "",
    propIds: [],
    picture: "",
    action: "",
    expression: "待补充",
    emotion: "待补充",
    lighting: "柔和主光",
    sound: "环境底噪",
    dialogue: "",
    requirements: "保持角色与场景一致",
    blocking: "待补充",
    costume: "使用角色资产服装",
    confirmed: false,
  };
}
export function generateShots(p: Project): Shot[] {
  return p.scenes.flatMap((scene) =>
    scene.text
      .split("\n")
      .filter((l) => l.trim() && !/^出场人物[：:]/.test(l))
      .map((line, index) => {
        const s = newShot(scene.id);
        const d = line.match(/^([^：:]+)[：:](.*)$/);
        s.characters = p.characters
          .filter((a) => scene.characters.includes(a.name))
          .map((a) => a.id);
        s.locationId = p.locations.find((a) => a.name === scene.name)?.id || "";
        s.propIds = p.props
          .filter((a) => line.includes(a.name))
          .map((a) => a.id);
        s.picture = line;
        s.dialogue = d ? `${d[1]}：${d[2]}` : "";
        s.action = d ? "人物交谈，动作待精修" : line;
        s.size = d ? "近景" : index === 0 ? "全景" : "中景";
        s.movement = d ? "缓慢推进" : "固定";
        return s;
      }),
  );
}
export function analyze(p: Project): Project {
  const scenes = parseScript(p.script);
  const add = (existing: Asset[], names: string[]) => [
    ...existing,
    ...[...new Set(names)]
      .filter((n) => !existing.some((a) => a.name === n))
      .map((name) => ({ id: uid(), name })),
  ];
  return {
    ...p,
    scenes,
    characters: add(
      p.characters,
      scenes.flatMap((s) => s.characters),
    ),
    locations: add(
      p.locations,
      scenes.map((s) => s.name),
    ),
    props: add(
      p.props,
      scenes.flatMap((s) => s.props.split("、").filter(Boolean)),
    ),
  };
}
export function timeline(shots: Shot[]) {
  let cursor = 0;
  return shots.map((s) => {
    const start = cursor;
    cursor = Math.round((cursor + s.duration) * 1000) / 1000;
    return { shot: s, start, end: cursor };
  });
}
export function continuity(p: Project, shots = p.shots): string[] {
  const warnings: string[] = [];
  shots.forEach((s, i) => {
    if (!Number.isFinite(s.duration) || s.duration <= 0)
      warnings.push(`镜头${i + 1}时长无效`);
    if (!s.locationId || !p.locations.some((a) => a.id === s.locationId))
      warnings.push(`镜头${i + 1}未关联有效场景`);
    if (
      s.characters.some((id) => !p.characters.some((a) => a.id === id)) ||
      s.propIds.some((id) => !p.props.some((a) => a.id === id))
    )
      warnings.push(`镜头${i + 1}含已删除资产`);
    if (s.blocking === "待补充" || !s.blocking)
      warnings.push(`镜头${i + 1}站位未填写，无法核对空间变化`);
    if (i) {
      const prev = shots[i - 1];
      if (s.sceneId === prev.sceneId) {
        if (s.locationId !== prev.locationId)
          warnings.push(`镜头${i + 1}同场次场景资产发生变化`);
        if (s.costume !== prev.costume)
          warnings.push(`镜头${i + 1}服装描述变化，请确认`);
        if (prev.propIds.some((id) => !s.propIds.includes(id)))
          warnings.push(`镜头${i + 1}前镜道具未关联，请核对去向`);
        if (s.blocking !== prev.blocking)
          warnings.push(`镜头${i + 1}人物站位变化，请核对动作衔接`);
        if (s.position !== prev.position)
          warnings.push(`镜头${i + 1}机位变化，请核对视线与轴线`);
      }
    }
  });
  const total = shots.reduce((a, s) => a + s.duration, 0);
  if (Math.abs(total - p.settings.target) > 0.01)
    warnings.push(
      `所选镜头 ${total.toFixed(1)} 秒，与目标 ${p.settings.target} 秒不符`,
    );
  warnings.push("规则无法确认动作语义连续性，请人工审核关键动作和对白。");
  return warnings;
}
export function validateProject(v: unknown): Project {
  if (!v || typeof v !== "object") throw Error("不是项目对象");
  const p = v as Project;
  if (
    p.version !== 1 ||
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    typeof p.script !== "string" ||
    typeof p.prompt !== "string" ||
    typeof p.updatedAt !== "string"
  )
    throw Error("项目版本或基础字段错误");
  for (const k of ["characters", "locations", "props"] as const) {
    if (
      !Array.isArray(p[k]) ||
      p[k].some(
        (a) =>
          !a ||
          typeof a.id !== "string" ||
          typeof a.name !== "string" ||
          Object.values(a).some((x) => typeof x !== "string"),
      )
    )
      throw Error("资产格式错误");
    if (new Set(p[k].map((a) => a.id)).size !== p[k].length)
      throw Error("资产ID重复");
  }
  if (
    !Array.isArray(p.scenes) ||
    p.scenes.some(
      (s) =>
        !s ||
        [
          "id",
          "episode",
          "name",
          "interior",
          "time",
          "text",
          "events",
          "emotion",
          "props",
        ].some(
          (k) =>
            typeof (s as unknown as Record<string, unknown>)[k] !== "string",
        ) ||
        !Array.isArray(s.characters) ||
        s.characters.some((c) => typeof c !== "string"),
    )
  )
    throw Error("场次格式错误");
  if (
    !Array.isArray(p.shots) ||
    p.shots.some(
      (s) =>
        !s ||
        !Number.isFinite(s.duration) ||
        s.duration <= 0 ||
        s.duration > 3600 ||
        typeof s.confirmed !== "boolean" ||
        Object.keys(newShot())
          .filter(
            (k) =>
              !["duration", "confirmed", "characters", "propIds"].includes(k),
          )
          .some(
            (k) =>
              typeof (s as unknown as Record<string, unknown>)[k] !== "string",
          ) ||
        !Array.isArray(s.characters) ||
        !Array.isArray(s.propIds) ||
        [...s.characters, ...s.propIds].some((x) => typeof x !== "string"),
    )
  )
    throw Error("镜头字段或时长错误");
  if (
    new Set(p.shots.map((s) => s.id)).size !== p.shots.length ||
    new Set(p.scenes.map((s) => s.id)).size !== p.scenes.length
  )
    throw Error("镜头或场次ID重复");
  if (
    !p.settings ||
    !["seedance", "wan"].includes(p.settings.model) ||
    !["16:9", "9:16"].includes(p.settings.ratio) ||
    typeof p.settings.style !== "string" ||
    typeof p.settings.quality !== "string" ||
    ![p.settings.target, p.settings.segment].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 3600,
    ) ||
    !p.templates ||
    typeof p.templates.seedance !== "string" ||
    typeof p.templates.wan !== "string"
  )
    throw Error("模型配置错误");
  return p;
}
export const shotColumns: Record<string, string> = {
  sceneId: "所属场次",
  duration: "镜头时长",
  size: "景别",
  position: "摄影机机位",
  angle: "拍摄角度",
  movement: "镜头运动",
  lens: "焦段",
  depth: "景深",
  locationId: "场景",
  characters: "出场人物",
  propIds: "道具",
  picture: "画面描述",
  action: "人物动作",
  expression: "人物表情",
  emotion: "情绪",
  lighting: "光影设计",
  sound: "环境音效",
  dialogue: "对白或旁白",
  requirements: "AI视频生成要求",
  blocking: "人物站位",
  costume: "服装约束",
};
export function csv(p: Project) {
  const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const resolve = (s: Shot, k: string) =>
    k === "characters"
      ? s.characters
          .map((id) => p.characters.find((a) => a.id === id)?.name || id)
          .join("、")
      : k === "propIds"
        ? s.propIds
            .map((id) => p.props.find((a) => a.id === id)?.name || id)
            .join("、")
        : k === "locationId"
          ? p.locations.find((a) => a.id === s.locationId)?.name || ""
          : k === "sceneId"
            ? p.scenes.find((a) => a.id === s.sceneId)?.name || ""
            : s[k as keyof Shot];
  return (
    "\uFEFF" +
    [
      ["镜号", ...Object.values(shotColumns)].map(quote).join(","),
      ...p.shots.map((s, i) =>
        [i + 1, ...Object.keys(shotColumns).map((k) => resolve(s, k))]
          .map(quote)
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function demoProject() {
  let p = emptyProject("雨夜来信 · 第01集");
  p.script = sampleScript;
  p = analyze(p);
  p.characters.forEach((a, i) =>
    Object.assign(a, {
      genderAge: i ? "女，25岁" : "男，28岁",
      body: i ? "168cm，匀称" : "180cm，修长",
      face: i ? "鹅蛋脸，深棕眼睛" : "轮廓分明，深棕眼睛",
      hair: i ? "黑色齐肩发" : "黑色短发",
      costume: i ? "米色风衣" : "深灰外套",
      voice: "自然中文对白",
      prompt: "保持五官和服装一致",
    }),
  );
  p.locations.forEach((a) =>
    Object.assign(a, {
      layout: a.name.includes("咖啡")
        ? "门在左侧，靠窗桌在右侧"
        : "咖啡馆出口在身后，道路向前延伸",
      lighting: "左侧暖光与雨夜冷光",
      anchors: "固定门窗与道路方向",
    }),
  );
  p.shots = generateShots(p);
  return p;
}
