import { fields, timeline, type Project, type Shot } from "./domain";
import { renderSeedance } from "./models/seedance";
import { renderWan } from "./models/wan";
export function prompt(p: Project, shots: Shot[]) {
  const assets = (["characters", "locations", "props"] as const)
    .flatMap((kind) =>
      p[kind]
        .filter((a) =>
          shots.some((s) =>
            kind === "characters"
              ? s.characters.includes(a.id)
              : kind === "locations"
                ? s.locationId === a.id
                : s.propIds.includes(a.id),
          ),
        )
        .map((a) =>
          Object.entries(a)
            .filter(([k, v]) => k !== "id" && v)
            .map(([k, v]) => `${fields[kind][k] || k}：${v}`)
            .join("；"),
        ),
    )
    .join("\n");
  const timing = timeline(shots)
    .map(
      ({ shot: s, start, end }, i) =>
        `【${start.toFixed(1)}—${end.toFixed(1)}秒】镜头${i + 1}，${s.size}，${s.position}/${s.angle}，${s.movement}，${s.lens}/${s.depth}。画面：${s.picture}；站位：${s.blocking}；动作：${s.action}；表情与情绪：${s.expression}/${s.emotion}；光影：${s.lighting}；对白：${s.dialogue || "无"}；声音：${s.sound}；服装：${s.costume}；要求：${s.requirements}`,
    )
    .join("\n");
  return (p.settings.model === "seedance" ? renderSeedance : renderWan)(
    p,
    shots,
    assets,
    timing,
  );
}
export function splitSegments(shots: Shot[], limit: number) {
  const groups: Shot[][] = [];
  let group: Shot[] = [];
  let time = 0;
  for (const shot of shots) {
    if (group.length && time + shot.duration > limit) {
      groups.push(group);
      group = [];
      time = 0;
    }
    group.push(shot);
    time += shot.duration;
  }
  if (group.length) groups.push(group);
  return groups;
}
